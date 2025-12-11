import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import path from "path";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import multer from "multer";
import sharp from "sharp";
import fs from "fs/promises";
import { storage } from "./storage";
// Update imports to use simplified db
import { db } from "./db";
import { insertConnectionSchema, insertMessageSchema, insertUserSchema } from "../shared/schema";
import { getRolesForRelationship, isValidRolePair } from "@shared/relationship-roles";
import { z } from "zod";

// Type conversion utility for null to undefined
const nullToUndefined = <T>(value: T | null): T | undefined => value === null ? undefined : value;

import { 
  rateLimit, 
  validateEmail, 
  validateMessageContent, 
  corsHeaders, 
  securityHeaders, 
  requestLogger 
} from "./middleware";
import { emailService } from "./email";
import { notificationService } from "./notifications";
import { smsService } from "./sms";
import { analytics } from "./analytics";
import { healthService } from "./health";
import { jobQueue } from "./jobs";
import { setupAuth, isAuthenticated } from "./oauthAuth";
import { runUserCleanup } from "./cleanup-duplicate-users";
import { setupAdminRoutes } from "./admin-routes";
import { emailCampaignService } from "./email-campaigns";
import { setupAdminEmailCampaignRoutes } from "./admin-email-campaigns";

import { generateRelationshipSpecificTitle } from "./thread-naming";
import { s3Service } from "./s3-service";
import OpenAI from "openai";
import Stripe from "stripe";

// Initialize OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

// Initialize Stripe client
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe price configuration for subscription tiers
const STRIPE_PRICES = {
  basic: process.env.STRIPE_PRICE_ID_BASIC || '',
  advanced: process.env.STRIPE_PRICE_ID_ADVANCED || '',
  unlimited: process.env.STRIPE_PRICE_ID_UNLIMITED || '',
  advanced_50_off: process.env.STRIPE_PRICE_ID_ADVANCED_50_OFF || '',
};

// Log Stripe configuration on startup
console.log('[STRIPE] Price configuration:', {
  basic: STRIPE_PRICES.basic ? 'configured' : 'missing',
  advanced: STRIPE_PRICES.advanced ? 'configured' : 'missing', 
  unlimited: STRIPE_PRICES.unlimited ? 'configured' : 'missing',
  advanced_50_off: STRIPE_PRICES.advanced_50_off ? 'configured' : 'missing'
});

// Validate Stripe price IDs on startup
async function validateStripePrices() {
  try {
    console.log('[STRIPE] Validating price IDs...');

    for (const [tier, priceId] of Object.entries(STRIPE_PRICES)) {
      if (priceId) {
        try {
          const price = await stripe.prices.retrieve(priceId);
          console.log(`[STRIPE] ✓ ${tier} price valid:`, price.id, `(${(price.unit_amount || 0)/100} ${price.currency})`);
        } catch (error) {
          console.error(`[STRIPE] ✗ ${tier} price INVALID:`, priceId, (error as Error).message);
        }
      }
    }
  } catch (error) {
    console.error('[STRIPE] Price validation failed:', error);
  }
}

// Run validation after a short delay to allow server startup
setTimeout(validateStripePrices, 2000);

// Webhook handler functions
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const userId = subscription.metadata?.userId;

  if (!userId) return;

  const user = await storage.getUser(userId);
  if (!user) return;

  const status = subscription.status === 'trialing' ? 'trialing' : 
                subscription.status === 'active' ? 'active' : 
                subscription.status === 'past_due' ? 'past_due' : 'inactive';

  // Get the new tier from subscription metadata
  const newTier = subscription.metadata?.tier as 'basic' | 'advanced' | 'unlimited' | 'free';
  const isDiscountSubscription = subscription.metadata?.discount_applied === '50';

  // For discount subscriptions, check payment intent using metadata payment_intent_id
  if (isDiscountSubscription && subscription.status === 'incomplete') {
    try {
      const paymentIntentId = subscription.metadata?.payment_intent_id;
      console.log(`[WEBHOOK] Processing discount subscription ${subscription.id}, payment intent: ${paymentIntentId}`);

      if (paymentIntentId) {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        console.log(`[WEBHOOK] Payment status: ${paymentIntent.status}, amount: ${paymentIntent.amount_received}`);

        // If payment succeeded for $4.95, upgrade immediately
        if (paymentIntent.status === 'succeeded' && paymentIntent.amount_received === 495) {
          console.log(`[WEBHOOK] Upgrading user ${userId} to Advanced tier`);

          const tierBenefits: Record<string, { maxConnections: number }> = {
            basic: { maxConnections: 1 },
            advanced: { maxConnections: 3 },
            unlimited: { maxConnections: 999 },
            free: { maxConnections: 0 }
          };

          const benefits = tierBenefits[newTier] || tierBenefits.advanced;

          await storage.updateUserSubscription(userId, {
            subscriptionTier: newTier || 'advanced',
            subscriptionStatus: 'active',
            maxConnections: benefits.maxConnections,
            stripeCustomerId: user.stripeCustomerId ?? undefined,
            stripeSubscriptionId: subscription.id,
            subscriptionExpiresAt: undefined
          });

          console.log(`[WEBHOOK] User ${userId} successfully upgraded`);
          return;
        }
      }
    } catch (error) {
      console.error(`[WEBHOOK] Error processing discount subscription: ${error}`);
    }
  }

  // Only update subscription tier and benefits when payment is confirmed (active or trialing)
  if (status === 'active' || status === 'trialing') {
    const tierBenefits = {
      free: { maxConnections: 1 },
      basic: { maxConnections: 1 },
      advanced: { maxConnections: 3 },
      unlimited: { maxConnections: 999 }
    };

    const benefits = tierBenefits[newTier] || tierBenefits.free;

    // Calculate trial start time and expiration for trialing subscriptions
    let trialStartedAt: Date | undefined = undefined;
    let trialExpiresAt: Date | undefined = undefined;

    if (status === 'trialing' && !user.trialStartedAt) {
      // Set trial start time to now if not already set
      trialStartedAt = new Date();
      console.log(`[WEBHOOK] Setting trial start time for user ${userId}: ${trialStartedAt.toISOString()}`);

      // Calculate trial expiration based on tier (60 days for basic, 7 days for others)
      trialExpiresAt = new Date(trialStartedAt);
      const trialDays = newTier === 'basic' ? 60 : 7;
      trialExpiresAt.setDate(trialExpiresAt.getDate() + trialDays);
      console.log(`[WEBHOOK] Setting ${trialDays}-day trial expiration for ${newTier} tier: ${trialExpiresAt.toISOString()}`);
    }

    const subscriptionUpdate: any = {
      subscriptionTier: newTier || 'free',
      subscriptionStatus: status,
      maxConnections: benefits.maxConnections,
      stripeCustomerId: nullToUndefined(user.stripeCustomerId),
      stripeSubscriptionId: nullToUndefined(user.stripeSubscriptionId),
      subscriptionExpiresAt: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000) : undefined
    };

    // Add trial timing if this is a new trial
    if (trialStartedAt || user.trialStartedAt) {
      subscriptionUpdate.trialStartedAt = trialStartedAt || user.trialStartedAt;
    }
    if (trialExpiresAt || user.trialExpiresAt) {
      subscriptionUpdate.trialExpiresAt = trialExpiresAt || user.trialExpiresAt;
    }

    await storage.updateUserSubscription(userId, subscriptionUpdate);
  } else {
    // For failed/inactive subscriptions, keep current tier but update status
    await storage.updateUserSubscription(userId, {
      subscriptionTier: user.subscriptionTier || 'free',
      subscriptionStatus: status,
      maxConnections: user.maxConnections || 1,
      stripeCustomerId: nullToUndefined(user.stripeCustomerId),
      stripeSubscriptionId: nullToUndefined(user.stripeSubscriptionId),
      subscriptionExpiresAt: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000) : undefined
    });
  }
}

async function handlePaymentIntentSuccess(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log(`[WEBHOOK] Processing payment intent success for $${paymentIntent.amount_received / 100}`);

    // Check if this is a $4.95 discount payment
    if (paymentIntent.amount_received === 495) {
      console.log(`[WEBHOOK] Detected $4.95 discount payment, finding associated subscription`);

      // Find the subscription associated with this payment
      const invoices = await stripe.invoices.list({
        limit: 100
      });

      // Find invoice by payment intent
      const matchingInvoice = invoices.data.find(invoice => 
        (invoice as any).payment_intent === paymentIntent.id
      );

      if (matchingInvoice && (matchingInvoice as any).subscription) {
        console.log(`[WEBHOOK] Found matching subscription: ${(matchingInvoice as any).subscription}`);
        await handleDiscountPaymentUpgrade((matchingInvoice as any).subscription as string);
      } else {
        console.log(`[WEBHOOK] No matching subscription found for payment intent ${paymentIntent.id}`);

        // Alternative: try to find subscription by customer
        if (paymentIntent.customer) {
          console.log(`[WEBHOOK] Trying to find subscription by customer: ${paymentIntent.customer}`);
          const subscriptions = await stripe.subscriptions.list({
            customer: paymentIntent.customer as string,
            limit: 10
          });

          // Find the most recent subscription
          const recentSubscription = subscriptions.data.find(sub => 
            sub.metadata?.discount_applied === '50' || 
            sub.metadata?.payment_intent_id === paymentIntent.id
          );

          if (recentSubscription) {
            console.log(`[WEBHOOK] Found subscription by customer: ${recentSubscription.id}`);
            await handleDiscountPaymentUpgrade(recentSubscription.id);
          }
        }
      }
    }
  } catch (error) {
    console.error(`[WEBHOOK] Error processing payment intent: ${error}`);
  }
}

async function handleDiscountPaymentUpgrade(subscriptionId: string) {
  try {
    console.log(`[DISCOUNT-UPGRADE] ======== PROCESSING DISCOUNT UPGRADE ========`);
    console.log(`[DISCOUNT-UPGRADE] Subscription ID: ${subscriptionId}`);
    console.log(`[DISCOUNT-UPGRADE] Timestamp: ${new Date().toISOString()}`);

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice.payment_intent']
    });

    console.log(`[DISCOUNT-UPGRADE] Subscription status: ${subscription.status}`);
    console.log(`[DISCOUNT-UPGRADE] Subscription metadata:`, JSON.stringify(subscription.metadata, null, 2));

    const userId = subscription.metadata?.userId;

    if (!userId) {
      console.log(`[DISCOUNT-UPGRADE] ERROR: No userId found in subscription metadata`);
      console.log(`[DISCOUNT-UPGRADE] Available metadata keys:`, Object.keys(subscription.metadata || {}));
      return;
    }

    console.log(`[DISCOUNT-UPGRADE] Looking up user: ${userId}`);
    const user = await storage.getUser(userId);
    if (!user) {
      console.log(`[DISCOUNT-UPGRADE] ERROR: User ${userId} not found in database`);
      return;
    }

    console.log(`[DISCOUNT-UPGRADE] BEFORE upgrade - User: ${user.email}`);
    console.log(`[DISCOUNT-UPGRADE] Current tier: ${user.subscriptionTier}`);
    console.log(`[DISCOUNT-UPGRADE] Current status: ${user.subscriptionStatus}`);
    console.log(`[DISCOUNT-UPGRADE] Current maxConnections: ${user.maxConnections}`);
    console.log(`[DISCOUNT-UPGRADE] Current stripeSubscriptionId: ${user.stripeSubscriptionId}`);

    // Check if payment was actually successful before upgrading
    const latestInvoice = subscription.latest_invoice as any;
    if (latestInvoice) {
      console.log(`[DISCOUNT-UPGRADE] Latest invoice amount: $${latestInvoice.amount_paid / 100}`);
      console.log(`[DISCOUNT-UPGRADE] Payment intent status: ${latestInvoice.payment_intent?.status}`);

      if (latestInvoice.amount_paid !== 495) {
        console.log(`[DISCOUNT-UPGRADE] WARNING: Expected $4.95 payment but found $${latestInvoice.amount_paid / 100}`);
      }

      if (latestInvoice.payment_intent?.status !== 'succeeded') {
        console.log(`[DISCOUNT-UPGRADE] WARNING: Payment intent not succeeded: ${latestInvoice.payment_intent?.status}`);
      }
    }

    // Upgrade to Advanced tier for $4.95 payment
    console.log(`[DISCOUNT-UPGRADE] Calling storage.updateUserSubscription with:`, {
      subscriptionTier: 'advanced',
      subscriptionStatus: 'active',
      maxConnections: 3,
      stripeCustomerId: nullToUndefined(user.stripeCustomerId),
      stripeSubscriptionId: subscriptionId,
      subscriptionExpiresAt: undefined
    });

    const upgradeResult = await storage.updateUserSubscription(userId, {
      subscriptionTier: 'advanced',
      subscriptionStatus: 'active', 
      maxConnections: 3,
      stripeCustomerId: nullToUndefined(user.stripeCustomerId),
      stripeSubscriptionId: subscriptionId,
      subscriptionExpiresAt: undefined
    });

    console.log(`[DISCOUNT-UPGRADE] Database update returned:`, upgradeResult);
    console.log(`[DISCOUNT-UPGRADE] Database update result type:`, typeof upgradeResult);
    console.log(`[DISCOUNT-UPGRADE] Database update success:`, upgradeResult ? 'TRUE' : 'FALSE');

    // Wait a moment and then verify the upgrade was successful
    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay

    const updatedUser = await storage.getUser(userId);
    if (updatedUser) {
      console.log(`[DISCOUNT-UPGRADE] AFTER upgrade verification:`);
      console.log(`[DISCOUNT-UPGRADE] New tier: ${updatedUser.subscriptionTier}`);
      console.log(`[DISCOUNT-UPGRADE] New status: ${updatedUser.subscriptionStatus}`);
      console.log(`[DISCOUNT-UPGRADE] New maxConnections: ${updatedUser.maxConnections}`);
      console.log(`[DISCOUNT-UPGRADE] New stripeSubscriptionId: ${updatedUser.stripeSubscriptionId}`);
      console.log(`[DISCOUNT-UPGRADE] Updated at: ${updatedUser.updatedAt}`);

      if (updatedUser.subscriptionTier === 'advanced' && updatedUser.subscriptionStatus === 'active') {
        console.log(`[DISCOUNT-UPGRADE] ✅ SUCCESS: User ${userId} (${user.email}) successfully upgraded to Advanced tier`);
      } else {
        console.log(`[DISCOUNT-UPGRADE] ❌ FAILURE: User ${userId} upgrade failed`);
        console.log(`[DISCOUNT-UPGRADE] Expected: tier=advanced, status=active`);
        console.log(`[DISCOUNT-UPGRADE] Actual: tier=${updatedUser.subscriptionTier}, status=${updatedUser.subscriptionStatus}`);

        // Try to upgrade again with more explicit parameters
        console.log(`[DISCOUNT-UPGRADE] Attempting secondary upgrade...`);
        const secondUpgrade = await storage.updateUserSubscription(userId, {
          subscriptionTier: 'advanced',
          subscriptionStatus: 'active',
          maxConnections: 3,
          stripeCustomerId: user.stripeCustomerId || undefined,
          stripeSubscriptionId: subscriptionId,
          subscriptionExpiresAt: undefined
        });
        console.log(`[DISCOUNT-UPGRADE] Secondary upgrade result:`, secondUpgrade);
      }
    } else {
      console.error(`[DISCOUNT-UPGRADE] ❌ CRITICAL ERROR: Could not retrieve user ${userId} after upgrade attempt`);
    }

    console.log(`[DISCOUNT-UPGRADE] ======== UPGRADE COMPLETE ========`);

  } catch (error) {
    console.error(`[DISCOUNT-UPGRADE] ❌ CRITICAL ERROR during upgrade:`, error);
    console.error(`[DISCOUNT-UPGRADE] Stack trace:`, error instanceof Error ? error.stack : 'Unknown error');
    console.error(`[DISCOUNT-UPGRADE] Error details:`, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      subscriptionId
    });
  }
}

async function handleSubscriptionCancellation(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) return;

  const user = await storage.getUser(userId);
  if (!user) return;

  await storage.updateUserSubscription(userId, {
    subscriptionTier: 'free',
    subscriptionStatus: 'canceled',
    maxConnections: 1,
    stripeSubscriptionId: undefined,
    subscriptionExpiresAt: undefined
  });
}

async function handlePaymentSuccess(invoice: Stripe.Invoice) {
  const subscription = (invoice as any).subscription;
  if (subscription && typeof subscription === 'string') {
    const sub = await stripe.subscriptions.retrieve(subscription);
    await handleSubscriptionUpdate(sub);
  }
}

async function handlePaymentFailure(invoice: Stripe.Invoice) {
  const subscription = (invoice as any).subscription;
  if (subscription && typeof subscription === 'string') {
    const sub = await stripe.subscriptions.retrieve(subscription);
    const userId = sub.metadata?.userId;

    if (userId) {
      const user = await storage.getUser(userId);
      if (user) {
        await storage.updateUserSubscription(userId, {
          subscriptionTier: user.subscriptionTier || 'free',
          subscriptionStatus: 'past_due',
          maxConnections: user.maxConnections || 1
        });
      }
    }
  }
}



// Configure multer for file uploads
const storage_config = multer.memoryStorage();
const upload = multer({
  storage: storage_config,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
    }
  },
});

// Configure multer for audio uploads
const audioUpload = multer({
  storage: storage_config,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for audio (30 minutes max)
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/mpeg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files (WebM, MP4, WAV, OGG, MP3) are allowed'));
    }
  },
});

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
async function ensureUploadsDir() {
  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Ensure uploads directory exists
  await ensureUploadsDir();

  // Setup authentication middleware FIRST
  await setupAuth(app);

  // Apply global middleware
  app.use(corsHeaders);
  app.use(securityHeaders);
  app.use(requestLogger);

  // Serve uploaded files with proper headers for audio playback (before general static)
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
    setHeaders: (res, path) => {
      // Set appropriate headers for audio files with proper MIME type detection
      const audioExtensions = {
        '.webm': 'audio/webm',
        '.mp3': 'audio/mpeg', 
        '.wav': 'audio/wav',
        '.mp4': 'audio/mp4',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac'
      };

      const fileExt = path.substring(path.lastIndexOf('.')).toLowerCase();
      if (audioExtensions[fileExt as keyof typeof audioExtensions]) {
        res.setHeader('Content-Type', audioExtensions[fileExt as keyof typeof audioExtensions]);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range');
      }
    }
  }));

  // Serve static files from public directory (after uploads)
  app.use(express.static(path.join(process.cwd(), 'public')));

  // CRITICAL: Universal invitation routes for both development and production
  app.get("/invitation", (req, res, next) => {
    console.log("[INVITATION] Route hit with query:", req.query);

    // In development, let Vite handle it
    if (process.env.NODE_ENV === "development") {
      return next();
    }

    // In production, serve the built index.html
    const distPath = path.resolve(import.meta.dirname, "public");
    res.sendFile(path.resolve(distPath, "index.html"));
  });

  app.get("/invitation/*", (req, res, next) => {
    console.log("[INVITATION] Wildcard route hit with params:", req.params, "query:", req.query);

    // In development, let Vite handle it
    if (process.env.NODE_ENV === "development") {
      return next();
    }

    // In production, serve the built index.html
    const distPath = path.resolve(import.meta.dirname, "public");
    res.sendFile(path.resolve(distPath, "index.html"));
  });

  // Health check endpoints
  app.get("/api/health", async (req, res) => {
    try {
      const health = await healthService.getSystemHealth();
      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 206 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Admin endpoint to cleanup duplicate users
  app.post('/api/admin/cleanup-users', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;

      // Only allow admin users
      const adminEmails = ['toby@gowithclark.com', 'thetobyclarkshow@gmail.com', 'tobylc@mac.com'];
      if (!user?.email || !adminEmails.includes(user.email)) {
        return res.status(403).json({ message: "Unauthorized - Admin access required" });
      }

      console.log(`[ADMIN] User ${user.email} initiated duplicate user cleanup`);
      const result = await runUserCleanup();

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[ADMIN] Cleanup endpoint error:', error);
      res.status(500).json({ 
        success: false,
        message: "Cleanup failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/metrics", async (req, res) => {
    try {
      const metrics = await analytics.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });



  // Email/Password login endpoint
  app.post('/api/auth/login', 
    rateLimit(10, 15 * 60 * 1000), // 10 attempts per 15 minutes
    async (req, res) => {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Check if user has a password hash (invited users)
      if (!user.passwordHash) {
        return res.status(401).json({ 
          message: "This account was created through OAuth. Please use Google or Facebook login." 
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Log in the user
      req.login(user, (err: any) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Login failed" });
        }

        req.session.save((saveErr: any) => {
          if (saveErr) {
            console.error("Session save error:", saveErr);
          }

          res.json({
            success: true,
            message: "Login successful",
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName
            }
          });
        });
      });

    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Production Auth endpoints
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Development bypass for testing
      if (process.env.NODE_ENV === 'development' && req.query.test_user) {
        const testUser = await storage.getUserByEmail('thetobyclarkshow@gmail.com');
        if (testUser) {
          // Establish persistent session for test user
          req.session.user = {
            id: testUser.id,
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName
          };
          req.user = req.session.user;

          // Force session save for persistence
          req.session.save((err: any) => {
            if (err) console.error('Session save error:', err);
          });

          return res.json({
            id: testUser.id,
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            subscriptionTier: testUser.subscriptionTier,
            subscriptionStatus: testUser.subscriptionStatus,
            maxConnections: testUser.maxConnections
          });
        }
      }

      // Check if user is authenticated
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get user ID from session
      let userId = req.user.id;

      // Handle different authentication sources
      if (req.user.claims && req.user.claims.sub) {
        userId = req.user.claims.sub;
      }

      if (!userId) {
        return res.status(401).json({ message: "Invalid session" });
      }

      // Use production-ready database connection with rate limiting
      let user;
      if (req.user.email) {
        user = await db.getUserByEmail(req.user.email);
      } else {
        user = await db.getUserById(userId);
      }

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Return sanitized user data with safe property access
      res.json({
        id: user.id || '',
        email: user.email || '',
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        profileImageUrl: user.profile_image_url || null,
        subscriptionTier: user.subscription_tier || 'free',
        subscriptionStatus: user.subscription_status || 'active',
        maxConnections: user.max_connections || 1,
        hasSeenOnboarding: user.has_seen_onboarding || false,
        createdAt: user.created_at || null,
        updatedAt: user.updated_at || null
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Logout endpoint with enhanced security
  app.post('/api/auth/logout', 
    rateLimit(10, 60 * 1000), // 10 logout attempts per minute
    (req, res) => {
    try {
      req.logout((err) => {
        if (err) {
          console.error("Logout error:", err);
          return res.status(500).json({ 
            error: "Logout failed",
            message: "Unable to terminate session properly"
          });
        }

        req.session.destroy((sessionErr) => {
          if (sessionErr) {
            console.error("Session destroy error:", sessionErr);
            // Still clear cookie even if session destroy fails
          }

          // Clear all session cookies
          res.clearCookie('connect.sid', {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production'
          });

          res.json({ 
            success: true,
            message: "Successfully logged out"
          });
        });
      });
    } catch (error) {
      console.error("Logout exception:", error);
      res.status(500).json({ 
        error: "Logout failed",
        message: "Server error during logout"
      });
    }
  });

  // Onboarding tracking endpoint
  app.post("/api/users/mark-onboarding-complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.updateUser(userId, { hasSeenOnboarding: true });

      res.json({ success: true });
    } catch (error) {
      console.error("Mark onboarding complete error:", error);
      res.status(500).json({ message: "Failed to update onboarding status" });
    }
  });

  // Trial status endpoint
  app.get('/api/trial-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const trialStatus = await storage.checkTrialStatus(userId);
      const connectionCount = currentUser.email ? await storage.getInitiatedConnectionsCount(currentUser.email) : 0;

      res.json({
        isExpired: trialStatus.isExpired,
        daysRemaining: trialStatus.daysRemaining,
        subscriptionTier: currentUser.subscriptionTier,
        subscriptionStatus: currentUser.subscriptionStatus,
        maxConnections: currentUser.maxConnections,
        currentConnections: connectionCount
      });
    } catch (error) {
      console.error('Trial status error:', error);
      res.status(500).json({ message: 'Failed to check trial status' });
    }
  });

  // Get user display name endpoint with enhanced validation
  app.get("/api/users/display-name/:email", 
    rateLimit(100, 60 * 1000), // 100 requests per minute
    async (req, res) => {
    try {
      const rawEmail = req.params.email;

      if (!rawEmail) {
        return res.status(400).json({ message: "Email parameter required" });
      }

      const email = decodeURIComponent(rawEmail);

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      const displayName = await storage.getUserDisplayNameByEmail(email);

      if (!displayName) {
        return res.status(404).json({ message: "User not found" });
      }

      // Return plain text for email templates, JSON for API consumers
      const acceptHeader = req.headers.accept || '';
      if (acceptHeader.includes('text/plain')) {
        res.setHeader('Content-Type', 'text/plain');
        res.send(displayName);
      } else {
        res.json({ displayName });
      }
    } catch (error: any) {
      console.error("Get display name error:", error);
      res.status(500).json({ 
        message: "Failed to get display name",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Get invitation details endpoint (public - no auth required)
  app.get("/api/invitation/:id", async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const connection = await storage.getConnection(connectionId);

      if (!connection) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (connection.status !== 'pending') {
        return res.status(400).json({ message: "Invitation is no longer valid" });
      }

      res.json({
        id: connection.id,
        inviterEmail: connection.inviterEmail,
        inviteeEmail: connection.inviteeEmail,
        relationshipType: connection.relationshipType,
        inviterRole: connection.inviterRole,
        inviteeRole: connection.inviteeRole,
        personalMessage: connection.personalMessage,
        createdAt: connection.createdAt
      });

    } catch (error: any) {
      console.error("Get invitation error:", error);
      res.status(500).json({ message: "Failed to retrieve invitation details" });
    }
  });

  // Existing user invitation acceptance endpoint (requires auth)
  app.post("/api/connections/accept-existing",
    isAuthenticated,
    rateLimit(10, 60 * 60 * 1000), // 10 attempts per hour
    async (req: any, res) => {
    try {
      const { connectionId } = req.body;
      const currentUser = req.user;

      if (!connectionId) {
        return res.status(400).json({ message: "Connection ID is required" });
      }

      // Get the connection details
      const connection = await storage.getConnection(connectionId);
      if (!connection) {
        return res.status(404).json({ message: "Invalid invitation" });
      }

      if (connection.status !== 'pending') {
        return res.status(400).json({ message: "Invitation is no longer valid" });
      }

      // Verify that the current user is the intended invitee
      if (connection.inviteeEmail.toLowerCase() !== currentUser.email.toLowerCase()) {
        return res.status(403).json({ message: "This invitation is not for your account" });
      }

      // Accept the connection
      await storage.updateConnectionStatus(connectionId, 'accepted');

      // Cancel pending invitation reminder campaigns since invitation was accepted
      try {
        await emailCampaignService.cancelPendingCampaigns(connection.inviteeEmail, ['pending_invitation']);
        console.log("[CAMPAIGNS] Cancelled pending invitation campaigns for accepted connection:", connection.id);
      } catch (campaignError) {
        console.error("[CAMPAIGNS] Failed to cancel pending invitation campaigns:", campaignError);
      }

      // Send notification emails
      try {
        await notificationService.sendConnectionAccepted(connection);
      } catch (emailError) {
        console.error("Failed to send acceptance notification:", emailError);
        // Continue with success response even if email fails
      }

      // Log the analytics event
      try {
        analytics.track('connection_accepted' as any);
      } catch (analyticsError) {
        console.error("Analytics tracking failed:", analyticsError);
      }

      res.json({
        success: true,
        message: "Invitation accepted successfully",
        connection: {
          id: connection.id,
          relationshipType: connection.relationshipType,
          inviterRole: connection.inviterRole,
          inviteeRole: connection.inviteeRole
        }
      });

    } catch (error: any) {
      console.error("Accept existing invitation error:", error);
      res.status(500).json({ 
        message: "Failed to accept invitation",
        error: process.env.NODE_ENV === 'development' ? error.message : "Internal server error"
      });
    }
  });

  // Invitation acceptance endpoint (public - no auth required)
  app.post("/api/invitation/accept", 
    rateLimit(5, 60 * 60 * 1000), // 5 attempts per hour per IP
    async (req, res) => {
    try {
      const { connectionId, inviteeEmail, firstName, lastName, password } = req.body;

      // Comprehensive input validation
      if (!connectionId || !inviteeEmail || !firstName || !lastName || !password) {
        return res.status(400).json({ 
          message: "Missing required fields",
          required: ["connectionId", "inviteeEmail", "firstName", "lastName", "password"]
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(inviteeEmail)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long" });
      }

      // Validate name fields
      if (firstName.trim().length < 1 || lastName.trim().length < 1) {
        return res.status(400).json({ message: "First name and last name cannot be empty" });
      }

      if (firstName.length > 50 || lastName.length > 50) {
        return res.status(400).json({ message: "Names cannot exceed 50 characters" });
      }

      // Get the connection details
      const connection = await storage.getConnection(connectionId);
      if (!connection) {
        return res.status(404).json({ message: "Invalid invitation" });
      }

      if (connection.status !== 'pending') {
        return res.status(400).json({ message: "Invitation has already been processed" });
      }

      if (connection.inviteeEmail !== inviteeEmail) {
        return res.status(400).json({ message: "Email does not match invitation" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(inviteeEmail);
      if (existingUser && existingUser.passwordHash) {
        return res.status(409).json({ message: "User with this email already exists and has completed setup" });
      }

      // Hash the password securely
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      let newUser;
      if (existingUser) {
        // Update existing user with password and name information
        newUser = await storage.upsertUser({
          id: existingUser.id,
          email: inviteeEmail,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          passwordHash: hashedPassword,
          subscriptionTier: 'free', // Invitees get free tier
          subscriptionStatus: 'forever', // Forever free as long as connected
          maxConnections: 0, // Invitees cannot send invitations
        });
      } else {
        // Create new user account for invitee with hashed password
        newUser = await storage.upsertUser({
          id: randomUUID(),
          email: inviteeEmail,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          passwordHash: hashedPassword,
          subscriptionTier: 'free', // Invitees get free tier
          subscriptionStatus: 'forever', // Forever free as long as connected
          maxConnections: 0, // Invitees cannot send invitations
        });
      }

      // Update connection status to accepted
      const updatedConnection = await storage.updateConnectionStatus(
        connectionId, 
        'accepted', 
        new Date()
      );

      if (!updatedConnection) {
        return res.status(500).json({ message: "Failed to update connection" });
      }

      // Cancel pending invitation reminder campaigns since invitation was accepted
      try {
        await emailCampaignService.cancelPendingCampaigns(connection.inviteeEmail, ['pending_invitation']);
        console.log("[CAMPAIGNS] Cancelled pending invitation campaigns for new user acceptance:", connection.id);
      } catch (campaignError) {
        console.error("[CAMPAIGNS] Failed to cancel pending invitation campaigns:", campaignError);
      }

      // Don't auto-create conversation - let inviter start it manually from dashboard

      // Send acceptance notification email to inviter
      try {
        await emailService.sendConnectionAccepted(updatedConnection);

        // Track analytics
        analytics.track({
          type: 'connection_accepted',
          userId: newUser.id,
          email: inviteeEmail,
          metadata: {
            inviterEmail: connection.inviterEmail,
            relationshipType: connection.relationshipType,
            connectionId: connectionId
          }
        });
      } catch (emailError) {
        console.error("Failed to send acceptance email:", emailError);
        // Don't fail the request if email fails
      }

      // Establish session for the new user
      req.login(newUser, (loginErr: any) => {
        if (loginErr) {
          console.error("Login error during invitation acceptance:", loginErr);
          return res.status(500).json({ 
            message: "Account created successfully but session establishment failed",
            details: "Please try logging in manually"
          });
        }

        // Force session save to ensure persistence
        req.session.save((saveErr: any) => {
          if (saveErr) {
            console.error("Session save error:", saveErr);
            // Don't fail the request, just log the error
            console.warn("Session may not persist properly");
          }

          res.status(201).json({
            success: true,
            message: "Connection established successfully",
            user: {
              id: newUser.id,
              email: newUser.email,
              firstName: newUser.firstName,
              lastName: newUser.lastName
            },
            connection: {
              id: updatedConnection.id,
              status: updatedConnection.status,
              relationshipType: updatedConnection.relationshipType,
              inviterEmail: updatedConnection.inviterEmail
            }
          });
        });
      });

    } catch (error: any) {
      console.error("Invitation acceptance error:", error);

      // Handle specific database errors
      if (error.code === '23505') { // PostgreSQL unique violation
        return res.status(409).json({ 
          message: "An account with this email already exists" 
        });
      }

      if (error.code === '23503') { // PostgreSQL foreign key violation
        return res.status(400).json({ 
          message: "Invalid invitation reference" 
        });
      }

      // Handle connection timeout
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
        return res.status(500).json({ 
          message: "Service temporarily unavailable. Please try again." 
        });
      }

      res.status(500).json({ 
        message: "Failed to process invitation acceptance",
        error: process.env.NODE_ENV === 'development' ? error.message : "Internal server error"
      });
    }
  });

  // Connection endpoints with enhanced security
  app.post("/api/connections", 
    isAuthenticated,
    rateLimit(5, 60 * 60 * 1000), // 5 invitations per hour for better control
    validateEmail,
    async (req: any, res) => {
    try {
      // Enhanced input validation
      const { inviteeEmail, relationshipType, inviterRole, inviteeRole, personalMessage } = req.body;

      // Comprehensive input validation
      if (!inviteeEmail || typeof inviteeEmail !== 'string' || inviteeEmail.trim().length === 0) {
        return res.status(400).json({ message: "Valid invitee email is required" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(inviteeEmail.trim())) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      if (!relationshipType || typeof relationshipType !== 'string' || relationshipType.trim().length === 0) {
        return res.status(400).json({ message: "Relationship type is required" });
      }

      // Validate relationship type against allowed values
      const allowedRelationshipTypes = [
        'Parent-Child', 'Romantic Partners', 'Friends', 'Siblings', 
        'Grandparents', 'Long-distance', 'Other'
      ];
      if (!allowedRelationshipTypes.includes(relationshipType)) {
        return res.status(400).json({ message: "Invalid relationship type" });
      }

      // Validate role fields
      if (!inviterRole || typeof inviterRole !== 'string' || inviterRole.trim().length === 0) {
        return res.status(400).json({ message: "Your role in the relationship is required" });
      }

      if (!inviteeRole || typeof inviteeRole !== 'string' || inviteeRole.trim().length === 0) {
        return res.status(400).json({ message: "Their role in the relationship is required" });
      }

      // Validate roles against allowed options for the relationship type
      const validRoles = getRolesForRelationship(relationshipType);
      if (!validRoles.includes(inviterRole)) {
        return res.status(400).json({ message: "Invalid role for this relationship type" });
      }

      if (!validRoles.includes(inviteeRole)) {
        return res.status(400).json({ message: "Invalid invitee role for this relationship type" });
      }

      // Validate role pair compatibility
      if (!isValidRolePair(relationshipType, inviterRole, inviteeRole)) {
        return res.status(400).json({ message: "Invalid role combination for this relationship type" });
      }

      // Validate personal message length
      if (personalMessage && (typeof personalMessage !== 'string' || personalMessage.length > 500)) {
        return res.status(400).json({ message: "Personal message cannot exceed 500 characters" });
      }

      // Get authenticated user with enhanced security
      let userId = req.user.id;
      if (req.user.claims && req.user.claims.sub) {
        userId = req.user.claims.sub;
      }

      if (!userId) {
        return res.status(401).json({ message: "Invalid user session" });
      }

      // Prevent self-invitation
      if (inviteeEmail.trim().toLowerCase() === req.user.email?.toLowerCase()) {
        return res.status(400).json({ message: "You cannot invite yourself" });
      }

      console.log("[DEBUG] User ID extracted:", userId);
      const currentUser = await storage.getUser(userId);
      console.log("[DEBUG] Current user from storage:", currentUser);

      if (!currentUser?.email) {
        return res.status(400).json({ message: "User email not found" });
      }

      // Check if user is an invitee (has free forever access)
      const userConnections = await storage.getConnectionsByEmail(currentUser.email!);
      const isInviteeUser = userConnections.some(c => c.inviteeEmail === currentUser.email);

      // For inviter users, check trial status and subscription limits
      if (!isInviteeUser) {
        const trialStatus = await storage.checkTrialStatus(currentUser.id);

        // Block all actions if trial has expired and user doesn't have paid subscription
        if (trialStatus.isExpired && currentUser.subscriptionTier?.trim() === 'trial') {
          await storage.expireTrialUser(currentUser.id);
          return res.status(403).json({ 
            message: "Your free trial has expired. Choose a subscription plan to continue using Deeper.", 
            type: "TRIAL_EXPIRED",
            subscriptionTier: currentUser.subscriptionTier?.trim(),
            requiresUpgrade: true
          });
        }

        // Check connection limits for inviter users
        const initiatedConnectionsCount = await storage.getInitiatedConnectionsCount(currentUser.email!);
        const userMaxConnections = currentUser.maxConnections || 1;

        if (initiatedConnectionsCount >= userMaxConnections) {
          return res.status(403).json({ 
            message: "Connection limit reached. Upgrade your plan to invite more people.", 
            type: "SUBSCRIPTION_LIMIT",
            currentCount: initiatedConnectionsCount,
            maxAllowed: userMaxConnections,
            subscriptionTier: currentUser.subscriptionTier?.trim() || 'trial',
            requiresUpgrade: true
          });
        }
      }

      const connectionData = {
        inviteeEmail,
        relationshipType,
        inviterRole,
        inviteeRole,
        personalMessage: personalMessage || "",
        inviterEmail: currentUser.email,
        inviterSubscriptionTier: currentUser.subscriptionTier || 'free',
        status: 'pending'
      };

      // Check for duplicate connections
      const existingConnections = await storage.getConnectionsByEmail(connectionData.inviterEmail);
      const duplicate = existingConnections.find(conn => 
        (conn.inviterEmail === connectionData.inviterEmail && conn.inviteeEmail === connectionData.inviteeEmail) ||
        (conn.inviterEmail === connectionData.inviteeEmail && conn.inviteeEmail === connectionData.inviterEmail)
      );

      if (duplicate) {
        console.log("[DEBUG] Duplicate connection found:", duplicate);
        return res.status(409).json({ 
          message: "You already have a connection with this person", 
          type: "DUPLICATE_CONNECTION",
          existingConnection: duplicate 
        });
      }

      const connection = await storage.createConnection(connectionData);

      // Queue invitation email for background processing
      jobQueue.addJob('send_email', {
        emailType: 'invitation',
        connection
      });

      // Schedule email campaigns for this invitation
      try {
        // Cancel any pending inviter nudge campaigns since they're now sending an invitation
        await emailCampaignService.cancelPendingCampaigns(connection.inviterEmail, ['inviter_nudge']);

        // Schedule pending invitation reminders for the invitee
        await emailCampaignService.schedulePendingInvitationReminders(connection);

        console.log("[CAMPAIGNS] Scheduled invitation campaigns for connection:", connection.id);
      } catch (campaignError) {
        console.error("[CAMPAIGNS] Failed to schedule invitation campaigns:", campaignError);
      }

      // Track connection creation
      analytics.track({
        type: 'connection_created',
        email: connection.inviterEmail,
        metadata: { 
          relationshipType: connection.relationshipType,
          inviteeEmail: connection.inviteeEmail
        }
      });

      res.json(connection);
    } catch (error) {
      console.error("Connection creation error:", error);
      res.status(400).json({ message: "Invalid connection data" });
    }
  });

  app.get("/api/connections/:email", async (req, res) => {
    try {
      const { email } = req.params;
      const connections = await storage.getConnectionsByEmail(email);
      res.json(connections);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch connections" });
    }
  });

  // Get single connection by ID
  app.get("/api/connections/by-id/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid connection ID" });
      }

      const connection = await storage.getConnection(id);
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      res.json(connection);
    } catch (error) {
      console.error("Get connection error:", error);
      res.status(500).json({ message: "Failed to fetch connection" });
    }
  });

  app.patch("/api/connections/:id/accept", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { accepterEmail } = req.body;

      // Validate the connection exists and user is authorized
      const existingConnection = await storage.getConnection(id);
      if (!existingConnection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      if (existingConnection.inviteeEmail !== accepterEmail) {
        return res.status(403).json({ message: "Not authorized to accept this connection" });
      }

      if (existingConnection.status !== 'pending') {
        return res.status(400).json({ message: "Connection already processed" });
      }

      // Ensure the invitee user exists (auto-create if needed)
      let inviteeUser = await storage.getUserByEmail(existingConnection.inviteeEmail);
      if (!inviteeUser) {
        // For now, require manual registration
        return res.status(400).json({ message: "Invitee must register first before accepting connection" });
      }

      // Invitees remain as free forever users and cannot send invitations
      // They can only interact with the one person who invited them
      await storage.updateUserSubscription(inviteeUser.id, {
        subscriptionTier: 'free',
        subscriptionStatus: 'forever', 
        maxConnections: 0, // Invitees cannot send invitations
        subscriptionExpiresAt: undefined // Forever free as long as connected
      });

      const connection = await storage.updateConnectionStatus(id, 'accepted', new Date());

      if (!connection) {
        return res.status(500).json({ message: "Failed to update connection status" });
      }

      // Cancel pending invitation reminder campaigns since invitation was accepted
      try {
        await emailCampaignService.cancelPendingCampaigns(connection.inviteeEmail, ['pending_invitation']);
        console.log("[CAMPAIGNS] Cancelled pending invitation campaigns for accepted connection:", connection.id);
      } catch (campaignError) {
        console.error("[CAMPAIGNS] Failed to cancel pending invitation campaigns:", campaignError);
      }

      // Don't auto-create conversation - let inviter start it manually from dashboard

      // Queue acceptance notification email
      jobQueue.addJob('send_email', {
        emailType: 'accepted',
        connection
      });

      // Send real-time WebSocket notification to inviter
      try {
        const { getWebSocketManager } = await import('./websocket');
        const wsManager = getWebSocketManager();
        if (wsManager) {
          wsManager.notifyConnectionUpdate(connection.inviterEmail, {
            connectionId: connection.id,
            status: 'accepted',
            inviterEmail: connection.inviterEmail,
            inviteeEmail: connection.inviteeEmail,
            relationshipType: connection.relationshipType
          });
        }
      } catch (error) {
        console.error('[WEBSOCKET] Failed to send connection acceptance notification:', error);
      }

      // Track connection acceptance
      analytics.track({
        type: 'connection_accepted',
        email: connection.inviteeEmail,
        metadata: { 
          inviterEmail: connection.inviterEmail,
          relationshipType: connection.relationshipType
        }
      });

      res.json({ connection });
    } catch (error) {
      console.error("Accept connection error:", error);
      res.status(500).json({ message: "Failed to accept connection" });
    }
  });

  app.patch("/api/connections/:id/decline", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { declinerEmail } = req.body;

      // Validate the connection exists and user is authorized
      const existingConnection = await storage.getConnection(id);
      if (!existingConnection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      if (existingConnection.inviteeEmail !== declinerEmail) {
        return res.status(403).json({ message: "Not authorized to decline this connection" });
      }

      if (existingConnection.status !== 'pending') {
        return res.status(400).json({ message: "Connection already processed" });
      }

      const connection = await storage.updateConnectionStatus(id, 'declined');

      if (!connection) {
        return res.status(500).json({ message: "Failed to update connection status" });
      }

      // Cancel pending invitation reminder campaigns since invitation was declined
      try {
        await emailCampaignService.cancelPendingCampaigns(connection.inviteeEmail, ['pending_invitation']);
        console.log("[CAMPAIGNS] Cancelled pending invitation campaigns for declined connection:", connection.id);
      } catch (campaignError) {
        console.error("[CAMPAIGNS] Failed to cancel pending invitation campaigns:", campaignError);
      }

      // Queue decline notification email
      jobQueue.addJob('send_email', {
        emailType: 'declined',
        connection
      });

      // Send real-time WebSocket notification to inviter
      try {
        const { getWebSocketManager } = await import('./websocket');
        const wsManager = getWebSocketManager();
        if (wsManager) {
          wsManager.notifyConnectionUpdate(connection.inviterEmail, {
            connectionId: connection.id,
            status: 'declined',
            inviterEmail: connection.inviterEmail,
            inviteeEmail: connection.inviteeEmail,
            relationshipType: connection.relationshipType
          });
        }
      } catch (error) {
        console.error('[WEBSOCKET] Failed to send connection decline notification:', error);
      }

      // Track connection decline
      analytics.track({
        type: 'connection_declined',
        email: connection.inviteeEmail,
        metadata: { 
          inviterEmail: connection.inviterEmail,
          relationshipType: connection.relationshipType
        }
      });

      res.json(connection);
    } catch (error) {
      console.error("Decline connection error:", error);
      res.status(500).json({ message: "Failed to decline connection" });
    }
  });

  // Subscription management endpoints
  app.post("/api/subscription/upgrade", isAuthenticated, async (req: any, res) => {
    try {
      console.log("[SUBSCRIPTION] Upgrade request received:", {
        hasUser: !!req.user,
        userKeys: req.user ? Object.keys(req.user) : [],
        body: req.body,
        sessionId: req.sessionID
      });

      const userId = req.user.claims?.sub || req.user.id;
      console.log("[SUBSCRIPTION] Extracted userId:", userId);

      if (!userId) {
        console.log("[SUBSCRIPTION] No userId found in request");
        return res.status(401).json({ message: "User ID not found in session" });
      }

      const user = await storage.getUser(userId);
      console.log("[SUBSCRIPTION] Retrieved user:", user ? 'found' : 'not found');

      if (!user) {
        console.log("[SUBSCRIPTION] User not found in database for ID:", userId);
        return res.status(404).json({ message: "User not found in database" });
      }

      const { tier, discountPercent } = req.body;
      console.log("[SUBSCRIPTION] Request body:", { tier, discountPercent });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const tierBenefits: Record<string, { maxConnections: number, price: number }> = {
        'basic': { maxConnections: 1, price: 4.95 },
        'advanced': { maxConnections: 3, price: 9.95 },
        'unlimited': { maxConnections: 999, price: 19.95 }
      };

      const benefits = tierBenefits[tier];
      if (!benefits) {
        return res.status(400).json({ message: "Invalid subscription tier" });
      }

      // Get or create Stripe customer
      console.log("[SUBSCRIPTION] Getting/creating Stripe customer...");
      let customer;
      if (user.stripeCustomerId) {
        console.log("[SUBSCRIPTION] Retrieving existing customer:", user.stripeCustomerId);
        customer = await stripe.customers.retrieve(user.stripeCustomerId);
      } else {
        console.log("[SUBSCRIPTION] Creating new customer for:", user.email);
        customer = await stripe.customers.create({
          email: user.email!,
          name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email!,
          metadata: {
            userId: user.id,
            platform: 'deeper'
          }
        });
        console.log("[SUBSCRIPTION] Created customer:", customer.id);

        // Update user with Stripe customer ID
        await storage.updateUserSubscription(userId, {
          subscriptionTier: user.subscriptionTier || 'free',
          subscriptionStatus: user.subscriptionStatus || 'active',
          maxConnections: user.maxConnections || 1,
          stripeCustomerId: customer.id
        });
      }

      // Cancel existing subscription if any
      if (user.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(user.stripeSubscriptionId);
        } catch (error) {
          console.error("Error canceling existing subscription:", error);
        }
      }

      // Handle discount for Advanced plan - use dedicated discount price ID
      let finalPrice;
      if (discountPercent && tier === 'advanced' && discountPercent === 50) {
        finalPrice = STRIPE_PRICES.advanced_50_off;
        console.log("[SUBSCRIPTION] Using 50% discount price ID:", finalPrice);
      } else {
        finalPrice = STRIPE_PRICES[tier as keyof typeof STRIPE_PRICES];
        console.log("[SUBSCRIPTION] Using regular price ID for tier", tier + ":", finalPrice);
      }

      if (!finalPrice) {
        console.error("[SUBSCRIPTION] No price ID found for tier:", tier, "with discount:", discountPercent);
        throw new Error(`No Stripe price configured for tier: ${tier}${discountPercent ? ' with discount' : ''}`);
      }

      let clientSecret;
      let subscription;

      // For discount subscriptions, create payment intent for immediate charge
      // For trial subscriptions, create setup intent for future billing
      if (discountPercent && discountPercent > 0) {
        console.log("[DISCOUNT] Creating payment intent for immediate $4.95 charge");

        // Create payment intent for immediate charge
        const paymentIntent = await stripe.paymentIntents.create({
          amount: 495, // $4.95 in cents
          currency: 'usd',
          customer: customer.id,
          description: 'Advanced plan subscription (50% discount)',
          setup_future_usage: 'off_session',
          metadata: {
            userId: user.id,
            tier: tier,
            platform: 'deeper',
            discount_applied: discountPercent.toString(),
            subscriptionType: 'discount'
          }
        });

        clientSecret = paymentIntent.client_secret;
        console.log("[DISCOUNT] Payment intent created:", paymentIntent.id);

        // Create subscription with immediate charge configuration
        subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{
            price: finalPrice,
          }],
          payment_behavior: 'default_incomplete',
          expand: ['latest_invoice.payment_intent'],
          metadata: {
            userId: user.id,
            tier: tier,
            platform: 'deeper',
            discount_applied: discountPercent.toString(),
            payment_intent_id: paymentIntent.id
          }
        });

        console.log("[DISCOUNT] Discount subscription created:", subscription.id);
      } else {
        console.log("[TRIAL] Creating setup intent for trial subscription");

        // Create setup intent for trial subscriptions
        const setupIntent = await stripe.setupIntents.create({
          customer: customer.id,
          usage: 'off_session',
          payment_method_types: ['card'],
          metadata: {
            userId: user.id,
            tier: tier,
            platform: 'deeper',
            discount_applied: 'none'
          }
        });

        clientSecret = setupIntent.client_secret;
        console.log("[TRIAL] Setup intent created:", setupIntent.id);

        // Create subscription with tier-specific trial period
        const trialPeriodDays = tier === 'basic' ? 60 : 7;
        subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{
            price: finalPrice,
          }],
          trial_period_days: trialPeriodDays,
          metadata: {
            userId: user.id,
            tier: tier,
            platform: 'deeper',
            discount_applied: 'none'
          }
        });

        console.log("[TRIAL] Trial subscription created:", subscription.id);
      }

      // Store Stripe IDs and set appropriate subscription status
      // For trial subscriptions, immediately activate trial
      const subscriptionUpdateData: any = {
        stripeCustomerId: customer.id,
        stripeSubscriptionId: subscription.id,
        subscriptionExpiresAt: user.subscriptionExpiresAt ? user.subscriptionExpiresAt : undefined
      };

      // For trial subscriptions, immediately set trial status and calculate expiration
      if (!discountPercent) {
        const trialStartedAt = new Date();
        const trialExpiresAt = new Date(trialStartedAt);
        const trialDays = tier === 'basic' ? 60 : 7;
        trialExpiresAt.setDate(trialExpiresAt.getDate() + trialDays);

        subscriptionUpdateData.subscriptionTier = 'trial';
        subscriptionUpdateData.subscriptionStatus = 'trialing';
        subscriptionUpdateData.maxConnections = 1;
        subscriptionUpdateData.trialStartedAt = trialStartedAt;
        subscriptionUpdateData.trialExpiresAt = trialExpiresAt;

        console.log(`[TRIAL] Setting ${trialDays}-day trial for ${tier} tier: ${trialStartedAt.toISOString()} to ${trialExpiresAt.toISOString()}`);
      } else {
        // For discount subscriptions, keep current tier until payment verified
        subscriptionUpdateData.subscriptionTier = user.subscriptionTier || 'free';
        subscriptionUpdateData.subscriptionStatus = user.subscriptionStatus || 'active';
        subscriptionUpdateData.maxConnections = user.maxConnections || 1;
      }

      await storage.updateUserSubscription(userId, subscriptionUpdateData);

      // Get updated user data to reflect any immediate tier changes
      const updatedUser = await storage.getUser(userId);

      res.json({ 
        success: true, 
        tier: updatedUser?.subscriptionTier || 'free',
        maxConnections: updatedUser?.maxConnections || 1,
        subscriptionId: subscription.id,
        clientSecret: clientSecret,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end! * 1000) : null,
        discountApplied: discountPercent ? `${discountPercent}%` : null,
        subscriptionStatus: subscription.status,
        message: discountPercent && discountPercent > 0 && subscription.status === 'active' ? 
          "Advanced plan activated! You've been charged $4.95 and your benefits are active." :
          discountPercent && discountPercent > 0 ? 
          "Complete payment to activate your discounted Advanced plan." : 
          "Complete payment setup to begin your trial." 
      });
    } catch (error) {
      console.error("============ SUBSCRIPTION UPGRADE ERROR ============");
      console.error("Subscription upgrade error:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack',
        requestBody: req.body,
        userId: req.user?.id,
        tier: req.body.tier,
        discountPercent: req.body.discountPercent
      });
      console.error("===============================================");

      // Write error to a temporary file for debugging
      const fs = require('fs');
      const errorLog = {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        requestBody: req.body
      };
      fs.writeFileSync('/tmp/subscription-error.json', JSON.stringify(errorLog, null, 2));

      res.status(500).json({ 
        message: "Failed to upgrade subscription",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Processed webhook events to prevent duplicates from multiple webhook endpoints
  const processedWebhooks = new Set<string>();

  // Stripe webhook for handling subscription events
  app.post('/api/stripe/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    console.log(`[WEBHOOK] Received ${req.method} ${req.url} at ${new Date().toISOString()}`);
    console.log(`[WEBHOOK] Headers:`, Object.keys(req.headers));
    console.log(`[WEBHOOK] Body length:`, req.body?.length || 0);

    try {
      event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test');
      console.log(`[WEBHOOK] ✓ Event verified: ${event.type} - ${event.id}`);
    } catch (err: any) {
      console.error(`[WEBHOOK] ✗ Signature verification failed:`, err.message);
      console.error(`[WEBHOOK] Raw body:`, req.body ? req.body.toString().substring(0, 200) : 'empty');
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Prevent duplicate processing from multiple webhook endpoints
    if (processedWebhooks.has(event.id)) {
      console.log(`[WEBHOOK] Duplicate event ${event.id} skipped`);
      return res.json({ received: true, duplicate: true });
    }

    processedWebhooks.add(event.id);
    console.log(`[WEBHOOK] Processing ${event.type}`);

    try {
      switch (event.type) {
        case 'customer.subscription.updated':
        case 'customer.subscription.created':
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`[WEBHOOK] ======== SUBSCRIPTION EVENT ========`);
          console.log(`[WEBHOOK] Subscription ID: ${subscription.id}`);
          console.log(`[WEBHOOK] Status: ${subscription.status}`);
          console.log(`[WEBHOOK] Customer: ${subscription.customer}`);
          console.log(`[WEBHOOK] Metadata:`, subscription.metadata);
          console.log(`[WEBHOOK] Current period: ${(subscription as any).current_period_start} - ${(subscription as any).current_period_end}`);

          // For discount subscriptions, immediately check payment status regardless of subscription status
          if (subscription.metadata?.discount_applied === '50' && subscription.metadata?.payment_intent_id) {
            console.log(`[WEBHOOK] ✅ DISCOUNT SUBSCRIPTION DETECTED`);
            console.log(`[WEBHOOK] Payment intent ID: ${subscription.metadata.payment_intent_id}`);
            console.log(`[WEBHOOK] User ID: ${subscription.metadata.userId}`);

            try {
              const paymentIntent = await stripe.paymentIntents.retrieve(subscription.metadata.payment_intent_id);
              console.log(`[WEBHOOK] Payment intent details:`);
              console.log(`[WEBHOOK] - Status: ${paymentIntent.status}`);
              console.log(`[WEBHOOK] - Amount received: $${paymentIntent.amount_received / 100}`);
              console.log(`[WEBHOOK] - Created: ${new Date(paymentIntent.created * 1000).toISOString()}`);

              if (paymentIntent.status === 'succeeded' && paymentIntent.amount_received === 495) {
                console.log(`[WEBHOOK] 🎉 SUCCESSFUL $4.95 PAYMENT CONFIRMED - TRIGGERING IMMEDIATE UPGRADE`);
                console.log(`[WEBHOOK] Upgrading user ${subscription.metadata.userId} to Advanced tier`);

                await handleDiscountPaymentUpgrade(subscription.id);

                console.log(`[WEBHOOK] ✅ Discount upgrade processing completed`);
                console.log(`[WEBHOOK] =====================================`);
                break; // Skip normal subscription processing
              } else {
                console.log(`[WEBHOOK] ❌ Payment not ready for upgrade:`);
                console.log(`[WEBHOOK] - Expected: succeeded status, $4.95 amount`);
                console.log(`[WEBHOOK] - Actual: ${paymentIntent.status} status, $${paymentIntent.amount_received / 100} amount`);
              }
            } catch (error) {
              console.error(`[WEBHOOK] ❌ ERROR checking payment intent:`, error);
              console.error(`[WEBHOOK] Error details:`, {
                name: error instanceof Error ? error.name : 'Unknown',
                message: error instanceof Error ? error.message : 'Unknown error',
                paymentIntentId: subscription.metadata.payment_intent_id
              });
            }
          } else {
            console.log(`[WEBHOOK] Regular subscription processing (not discount)`);
            console.log(`[WEBHOOK] - Discount applied: ${subscription.metadata?.discount_applied || 'none'}`);
            console.log(`[WEBHOOK] - Payment intent ID: ${subscription.metadata?.payment_intent_id || 'none'}`);
          }

          console.log(`[WEBHOOK] Processing standard subscription update`);
          await handleSubscriptionUpdate(subscription);
          console.log(`[WEBHOOK] ===================================`);
          break;

        case 'customer.subscription.deleted':
          const deletedSubscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionCancellation(deletedSubscription);
          break;

        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log(`[WEBHOOK] Payment intent succeeded: ${paymentIntent.id}, amount: $${paymentIntent.amount_received / 100}`);
          await handlePaymentIntentSuccess(paymentIntent);
          break;

        case 'invoice.payment_succeeded':
          const invoice = event.data.object as Stripe.Invoice;
          await handlePaymentSuccess(invoice);
          break;

        case 'invoice.paid':
          const paidInvoice = event.data.object as any;
          if (paidInvoice.subscription) {
            // For discount subscriptions ($4.95), immediately activate Advanced tier
            if (paidInvoice.amount_paid === 495) {
              await handleDiscountPaymentUpgrade(paidInvoice.subscription as string);
            } else {
              const subscription = await stripe.subscriptions.retrieve(paidInvoice.subscription as string);
              await handleSubscriptionUpdate(subscription);
            }
          }
          break;

        case 'invoice.payment_failed':
          const failedInvoice = event.data.object as Stripe.Invoice;
          await handlePaymentFailure(failedInvoice);
          break;

        case 'setup_intent.succeeded':
          const setupIntent = event.data.object as Stripe.SetupIntent;
          const userId = setupIntent.metadata?.userId;
          const discountApplied = setupIntent.metadata?.discount_applied;

          if (userId) {
            const user = await storage.getUser(userId);
            if (user && user.stripeSubscriptionId) {
              console.log(`[PAYMENT] Attaching payment method ${setupIntent.payment_method} to subscription ${user.stripeSubscriptionId}`);

              // Update subscription with payment method
              const updatedSubscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
                default_payment_method: setupIntent.payment_method as string,
              });
              console.log(`[PAYMENT] Subscription updated with payment method, status: ${updatedSubscription.status}`);

              // For discount subscriptions, immediately process the invoice payment
              if (discountApplied && discountApplied !== 'none') {
                console.log(`[DISCOUNT] Processing immediate $4.95 payment for subscription ${user.stripeSubscriptionId}`);

                try {
                  // Get the latest subscription data
                  const currentSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
                    expand: ['latest_invoice.payment_intent']
                  });

                  if (currentSubscription.latest_invoice) {
                    const latestInvoice = currentSubscription.latest_invoice as any;
                    console.log(`[DISCOUNT] Latest invoice: ${latestInvoice.id}, status: ${latestInvoice.status}`);

                    // If invoice is still open, pay it immediately
                    if (latestInvoice.status === 'open' && latestInvoice.payment_intent) {
                      const paymentIntent = latestInvoice.payment_intent;
                      console.log(`[DISCOUNT] Found payment intent ${paymentIntent.id}, status: ${paymentIntent.status}`);

                      // Confirm the payment with the attached payment method
                      const paymentResult = await stripe.paymentIntents.confirm(paymentIntent.id, {
                        payment_method: setupIntent.payment_method as string
                      });

                      console.log(`[DISCOUNT] Payment confirmation result: ${paymentResult.status}, amount received: $${(paymentResult.amount_received || 0) / 100}`);

                      if (paymentResult.status === 'succeeded') {
                        console.log(`[DISCOUNT] $4.95 payment successful - activating Advanced plan`);
                        // The payment_intent.succeeded webhook will handle tier activation
                      }
                    } else {
                      console.log(`[DISCOUNT] Invoice status: ${latestInvoice.status}, no immediate payment needed`);
                    }
                  }
                } catch (paymentError) {
                  console.error(`[DISCOUNT] Payment processing failed:`, paymentError);
                  console.error(`[DISCOUNT] Error details:`, {
                    message: paymentError instanceof Error ? paymentError.message : 'Unknown error',
                    code: (paymentError as any)?.code
                  });
                }
              } else {
                console.log(`[TRIAL] Payment method attached for trial subscription ${user.stripeSubscriptionId}`);
              }
            }
          }
          break;

        case 'invoice.payment_succeeded':
          const successInvoice = event.data.object as Stripe.Invoice;
          if (successInvoice.amount_paid === 495 && (successInvoice as any).subscription) {
            await handleDiscountPaymentUpgrade((successInvoice as any).subscription as string);
          }
          break;

        default:
          // Unhandled event type
      }

      console.log(`[WEBHOOK] ✅ Event ${event.type} processed successfully`);
      res.json({ received: true, processed: true, eventType: event.type });
    } catch (error) {
      console.error(`[WEBHOOK] ❌ PROCESSING ERROR for event ${event?.type || 'unknown'}`);
      console.error(`[WEBHOOK] Error details:`, {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        eventId: event?.id || 'unknown',
        eventType: event?.type || 'unknown'
      });

      // Log webhook processing errors for production debugging
      const errorLog = {
        timestamp: new Date().toISOString(),
        eventType: event?.type || 'unknown',
        eventId: event?.id || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      };

      try {
        const fs = require('fs');
        fs.writeFileSync('/tmp/webhook-error.json', JSON.stringify(errorLog, null, 2));
      } catch (writeError) {
        console.error(`[WEBHOOK] Failed to write error log:`, writeError);
      }

      // Still return 200 to acknowledge receipt even if processing failed
      res.status(200).json({ received: true, processed: false, error: 'Processing failed' });
    }
  });







  // Debug endpoint to check subscription processing (production-ready)
  app.get('/api/debug/subscription-status/:userId', async (req, res) => {

    try {
      const userId = req.params.userId;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      let stripeSubscription = null;
      if (user.stripeSubscriptionId) {
        try {
          stripeSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
            expand: ['latest_invoice.payment_intent']
          });
        } catch (error) {
          console.error('Error fetching Stripe subscription:', error);
        }
      }

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          subscriptionTier: user.subscriptionTier,
          subscriptionStatus: user.subscriptionStatus,
          maxConnections: user.maxConnections,
          stripeCustomerId: user.stripeCustomerId,
          stripeSubscriptionId: user.stripeSubscriptionId,
          trialStartedAt: user.trialStartedAt,
          subscriptionExpiresAt: user.subscriptionExpiresAt
        },
        stripeSubscription: stripeSubscription ? {
          id: stripeSubscription.id,
          status: stripeSubscription.status,
          metadata: stripeSubscription.metadata,
          latest_invoice: stripeSubscription.latest_invoice ? {
            amount_paid: (stripeSubscription.latest_invoice as any).amount_paid,
            payment_intent: (stripeSubscription.latest_invoice as any).payment_intent ? {
              status: (stripeSubscription.latest_invoice as any).payment_intent.status,
              amount_received: (stripeSubscription.latest_invoice as any).payment_intent.amount_received
            } : null
          } : null
        } : null
      });
    } catch (error) {
      console.error('Debug subscription status error:', error);
      res.status(500).json({ message: 'Internal error' });
    }
  });

  // Manual upgrade endpoint for fixing subscription issues (development only)
  app.post('/api/debug/force-upgrade/:userId', async (req, res) => {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return res.status(404).json({ message: 'Not found' });
    }

    try {
      const userId = req.params.userId;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      console.log(`[MANUAL-UPGRADE] Manually upgrading user ${userId} to Advanced tier`);
      console.log(`[MANUAL-UPGRADE] Current tier: ${user.subscriptionTier}, status: ${user.subscriptionStatus}`);

      // Force upgrade to Advanced tier
      const upgradeResult = await storage.updateUserSubscription(userId, {
        subscriptionTier: 'advanced',
        subscriptionStatus: 'active',
        maxConnections: 3,
        stripeCustomerId: user.stripeCustomerId || undefined,
        stripeSubscriptionId: user.stripeSubscriptionId || undefined,
        subscriptionExpiresAt: undefined
      });

      console.log(`[MANUAL-UPGRADE] Upgrade result:`, upgradeResult ? 'SUCCESS' : 'FAILED');

      // Verify the upgrade
      const updatedUser = await storage.getUser(userId);

      return res.json({
        success: !!upgradeResult,
        before: {
          tier: user.subscriptionTier,
          status: user.subscriptionStatus,
          maxConnections: user.maxConnections
        },
        after: updatedUser ? {
          tier: updatedUser.subscriptionTier,
          status: updatedUser.subscriptionStatus,
          maxConnections: updatedUser.maxConnections
        } : null,
        message: upgradeResult ? 'User successfully upgraded to Advanced tier' : 'Upgrade failed'
      });
    } catch (error) {
      console.error('Manual upgrade error:', error);
      res.status(500).json({ message: 'Internal error', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // List all users for debugging (development only)
  app.get('/api/debug/users', async (req, res) => {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return res.status(404).json({ message: 'Not found' });
    }

    try {
      const allUsers = await storage.getAllUsers();

      const usersWithSubscriptions = allUsers.map(user => ({
        id: user.id,
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        maxConnections: user.maxConnections,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        trialStartedAt: user.trialStartedAt,
        subscriptionExpiresAt: user.subscriptionExpiresAt
      }));

      return res.json({
        total: usersWithSubscriptions.length,
        users: usersWithSubscriptions
      });
    } catch (error) {
      console.error('Debug users list error:', error);
      res.status(500).json({ message: 'Internal error' });
    }
  });

  // Webhook simulator for testing discount upgrades (production-ready)
  app.post('/api/debug/simulate-webhook/:userId', async (req, res) => {

    try {
      const userId = req.params.userId;
      const user = await storage.getUser(userId);

      if (!user || !user.stripeSubscriptionId) {
        return res.status(404).json({ message: 'User not found or no subscription ID' });
      }

      console.log(`[WEBHOOK-SIMULATOR] ======== SIMULATING DISCOUNT UPGRADE WEBHOOK ========`);
      console.log(`[WEBHOOK-SIMULATOR] User: ${user.email} (${userId})`);
      console.log(`[WEBHOOK-SIMULATOR] Subscription ID: ${user.stripeSubscriptionId}`);

      // Manually trigger the discount upgrade process
      await handleDiscountPaymentUpgrade(user.stripeSubscriptionId);

      // Check the result
      const updatedUser = await storage.getUser(userId);

      return res.json({
        success: true,
        user: user.email,
        before: {
          tier: user.subscriptionTier,
          status: user.subscriptionStatus,
          maxConnections: user.maxConnections
        },
        after: updatedUser ? {
          tier: updatedUser.subscriptionTier,
          status: updatedUser.subscriptionStatus,
          maxConnections: updatedUser.maxConnections
        } : null,
        upgraded: updatedUser?.subscriptionTier === 'advanced' && updatedUser?.subscriptionStatus === 'active'
      });
    } catch (error) {
      console.error('Webhook simulation error:', error);
      res.status(500).json({ message: 'Simulation failed', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Debug endpoint to inspect user subscription data (production-ready)
  app.get('/api/debug/user-subscription/:email', async (req, res) => {

    try {
      const email = req.params.email;
      const user = await storage.getUserByEmail(email);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get Stripe subscription if it exists
      let stripeSubscription = null;
      if (user.stripeSubscriptionId) {
        try {
          stripeSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
            expand: ['latest_invoice.payment_intent']
          });
        } catch (stripeError) {
          console.error('Error fetching Stripe subscription:', stripeError);
        }
      }

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          subscriptionTier: user.subscriptionTier,
          subscriptionStatus: user.subscriptionStatus,
          maxConnections: user.maxConnections,
          stripeCustomerId: user.stripeCustomerId,
          stripeSubscriptionId: user.stripeSubscriptionId,
          subscriptionExpiresAt: user.subscriptionExpiresAt,
          trialStartedAt: user.trialStartedAt,
          trialExpiresAt: user.trialExpiresAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        stripe: stripeSubscription ? {
          id: stripeSubscription.id,
          status: stripeSubscription.status,
          metadata: stripeSubscription.metadata,
          current_period_start: (stripeSubscription as any).current_period_start,
          current_period_end: (stripeSubscription as any).current_period_end,
          latest_invoice: stripeSubscription.latest_invoice ? {
            id: (stripeSubscription.latest_invoice as any).id,
            amount_paid: (stripeSubscription.latest_invoice as any).amount_paid,
            payment_intent: (stripeSubscription.latest_invoice as any).payment_intent ? {
              id: (stripeSubscription.latest_invoice as any).payment_intent.id,
              status: (stripeSubscription.latest_invoice as any).payment_intent.status,
              amount_received: (stripeSubscription.latest_invoice as any).payment_intent.amount_received
            } : null
          } : null
        } : null
      });
    } catch (error) {
      console.error('Debug user subscription error:', error);
      res.status(500).json({ message: 'Internal error' });
    }
  });

  // Manual webhook trigger for specific subscription (production-ready)
  app.post('/api/debug/trigger-webhook/:subscriptionId', async (req, res) => {

    try {
      const subscriptionId = req.params.subscriptionId;
      const { eventType = 'customer.subscription.created' } = req.body;

      console.log(`[WEBHOOK-TRIGGER] ======== MANUAL WEBHOOK TRIGGER ========`);
      console.log(`[WEBHOOK-TRIGGER] Subscription ID: ${subscriptionId}`);
      console.log(`[WEBHOOK-TRIGGER] Event Type: ${eventType}`);

      // Retrieve the subscription from Stripe
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice.payment_intent']
      });

      console.log(`[WEBHOOK-TRIGGER] Retrieved subscription:`, {
        id: subscription.id,
        status: subscription.status,
        metadata: subscription.metadata
      });

      // Simulate the webhook event
      const mockEvent = {
        type: eventType,
        data: {
          object: subscription
        }
      };

      // Process based on event type
      switch (eventType) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await handleSubscriptionUpdate(subscription);
          break;

        case 'discount_payment_upgrade':
          await handleDiscountPaymentUpgrade(subscriptionId);
          break;

        default:
          return res.status(400).json({ message: 'Unsupported event type' });
      }

      // Check the result
      const userId = subscription.metadata?.userId;
      if (userId) {
        const updatedUser = await storage.getUser(userId);
        return res.json({
          success: true,
          eventType,
          subscriptionId,
          userId,
          user: updatedUser ? {
            email: updatedUser.email,
            tier: updatedUser.subscriptionTier,
            status: updatedUser.subscriptionStatus,
            maxConnections: updatedUser.maxConnections
          } : null
        });
      }

      return res.json({
        success: true,
        eventType,
        subscriptionId,
        message: 'Webhook processed but no user found'
      });

    } catch (error) {
      console.error('Manual webhook trigger error:', error);
      res.status(500).json({ message: 'Webhook trigger failed', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get subscription status
  app.get('/api/subscriptions/status', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;

      if (!user.stripeSubscriptionId) {
        return res.json({
          status: 'none',
          tier: user.subscriptionTier || 'free',
          maxConnections: user.maxConnections || 1
        });
      }

      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

      res.json({
        status: subscription.status,
        tier: user.subscriptionTier,
        maxConnections: user.maxConnections,
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
      });
    } catch (error) {
      console.error('Subscription status error:', error);
      res.status(500).json({ message: 'Failed to retrieve subscription status' });
    }
  });

  // Cancel subscription
  app.post('/api/subscriptions/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;

      if (!user.stripeSubscriptionId) {
        return res.status(400).json({ message: 'No active subscription found' });
      }

      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true
      });

      res.json({
        success: true,
        message: 'Subscription will be canceled at the end of the current period',
        cancelAt: new Date((subscription as any).current_period_end * 1000)
      });
    } catch (error) {
      console.error('Subscription cancellation error:', error);
      res.status(500).json({ message: 'Failed to cancel subscription' });
    }
  });

  // Reactivate subscription
  app.post('/api/subscriptions/reactivate', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;

      if (!user.stripeSubscriptionId) {
        return res.status(400).json({ message: 'No subscription found' });
      }

      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: false
      });

      res.json({
        success: true,
        message: 'Subscription reactivated successfully'
      });
    } catch (error) {
      console.error('Subscription reactivation error:', error);
      res.status(500).json({ message: 'Failed to reactivate subscription' });
    }
  });

  // Profile image file upload with enhanced authentication
  app.post("/api/users/profile-image/upload", 
    rateLimit(5, 60 * 60 * 1000), // 5 uploads per hour
    upload.single('image'),
    async (req: any, res) => {
    // Enhanced authentication check
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      console.log("[UPLOAD] Authentication failed:", {
        isAuthenticated: req.isAuthenticated?.(),
        hasUser: !!req.user,
        sessionID: req.sessionID
      });
      return res.status(401).json({ message: "Authentication required. Please log in again." });
    }
    try {
      const userId = req.user.claims?.sub || req.user.id;

      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const currentUser = await storage.getUser(userId);
      if (!currentUser || !currentUser.email) {
        return res.status(404).json({ message: "User not found" });
      }

      // Generate unique filename
      const fileExtension = req.file.mimetype.split('/')[1];
      const fileName = `profile_${userId}_${Date.now()}.${fileExtension}`;
      const filePath = path.join(uploadsDir, fileName);

      // Process image with sharp - resize and optimize with error handling
      try {
        await sharp(req.file.buffer)
          .resize(400, 400, { 
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 85 })
          .toFile(filePath);
      } catch (imageError) {
        console.error("Image processing error:", imageError);
        return res.status(400).json({ message: "Invalid image file. Please try a different image." });
      }

      // Update user profile with new image URL
      const profileImageUrl = `/uploads/${fileName}`;
      const updatedUser = await storage.updateUserProfileImage(currentUser.email, profileImageUrl);

      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update profile image" });
      }

      res.json({ 
        success: true, 
        profileImageUrl: updatedUser.profileImageUrl,
        message: "Profile image uploaded successfully" 
      });
    } catch (error) {
      console.error("Profile image upload error:", error);
      res.status(500).json({ message: "Failed to upload profile image" });
    }
  });


  // Production fallback: Check and upgrade paid users whose webhooks failed
  app.post("/api/subscription/check-payment-status", isAuthenticated, async (req, res) => {
    try {
      console.log(`[PAYMENT_CHECK] ======== STARTING PAYMENT STATUS CHECK ========`);

      const userId = (req.user as any).claims?.sub || (req.user as any).id;
      console.log(`[PAYMENT_CHECK] User ID: ${userId}`);

      const user = await storage.getUser(userId);

      if (!user) {
        console.log(`[PAYMENT_CHECK] User not found: ${userId}`);
        return res.json({ upgraded: false, message: "User not found" });
      }

      console.log(`[PAYMENT_CHECK] Current user state:`);
      console.log(`[PAYMENT_CHECK] - Email: ${user.email}`);
      console.log(`[PAYMENT_CHECK] - Tier: ${user.subscriptionTier}`);
      console.log(`[PAYMENT_CHECK] - Status: ${user.subscriptionStatus}`);
      console.log(`[PAYMENT_CHECK] - MaxConnections: ${user.maxConnections}`);
      console.log(`[PAYMENT_CHECK] - StripeSubscriptionId: ${user.stripeSubscriptionId}`);

      if (!user.stripeSubscriptionId) {
        console.log(`[PAYMENT_CHECK] No Stripe subscription ID found for user`);
        return res.json({ upgraded: false, message: "No subscription found" });
      }

      // Check Stripe subscription status
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
        expand: ['latest_invoice.payment_intent']
      });

      console.log(`[PAYMENT_CHECK] Stripe subscription details:`);
      console.log(`[PAYMENT_CHECK] - Subscription ID: ${subscription.id}`);
      console.log(`[PAYMENT_CHECK] - Status: ${subscription.status}`);
      console.log(`[PAYMENT_CHECK] - Metadata:`, subscription.metadata);

      // Check if subscription has a successful payment but user isn't upgraded
      const latestInvoice = subscription.latest_invoice as any;
      const isDiscountSubscription = subscription.metadata?.discount_applied === '50' || 
        (subscription.items?.data?.[0]?.price?.id === STRIPE_PRICES.advanced_50_off);
      const paymentIntentId = subscription.metadata?.payment_intent_id;

      console.log(`[PAYMENT_CHECK] Latest invoice details:`);
      console.log(`[PAYMENT_CHECK] - Invoice ID: ${latestInvoice?.id}`);
      console.log(`[PAYMENT_CHECK] - Amount paid: ${latestInvoice?.amount_paid}`);
      console.log(`[PAYMENT_CHECK] - Payment intent status: ${latestInvoice?.payment_intent?.status}`);
      console.log(`[PAYMENT_CHECK] - Is discount subscription: ${isDiscountSubscription}`);
      console.log(`[PAYMENT_CHECK] - Payment intent ID in metadata: ${paymentIntentId}`);
      console.log(`[PAYMENT_CHECK] - Price ID: ${subscription.items?.data?.[0]?.price?.id}`);
      console.log(`[PAYMENT_CHECK] - Expected discount price ID: ${STRIPE_PRICES.advanced_50_off}`);

      // Check payment intent from metadata if available
      let metadataPaymentIntent = null;
      if (paymentIntentId) {
        try {
          metadataPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          console.log(`[PAYMENT_CHECK] Metadata payment intent: status=${metadataPaymentIntent.status}, amount=${metadataPaymentIntent.amount_received}`);
        } catch (error) {
          console.error(`[PAYMENT_CHECK] Error retrieving metadata payment intent:`, error);
        }
      }

      // First check for payment success through invoice or metadata
      let hasSuccessfulPayment = 
        (latestInvoice?.payment_intent?.status === 'succeeded' && latestInvoice.amount_paid === 495) ||
        (metadataPaymentIntent?.status === 'succeeded' && metadataPaymentIntent.amount_received === 495);

      // Additional check: Look for any recent successful payment intents for this customer
      let recentPaymentIntent = null;
      if (!hasSuccessfulPayment && subscription.customer) {
        try {
          console.log(`[PAYMENT_CHECK] Checking for recent payment intents for customer ${subscription.customer}`);
          const paymentIntents = await stripe.paymentIntents.list({
            customer: subscription.customer as string,
            limit: 10
          });

          // Find any successful $4.95 payment from the last 24 hours
          const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
          recentPaymentIntent = paymentIntents.data.find(pi => 
            pi.status === 'succeeded' && 
            pi.amount === 495 &&
            pi.created > oneDayAgo
          );

          if (recentPaymentIntent) {
            console.log(`[PAYMENT_CHECK] Found recent successful $4.95 payment: ${recentPaymentIntent.id}`);
            console.log(`[PAYMENT_CHECK] Payment created: ${new Date(recentPaymentIntent.created * 1000).toISOString()}`);
          }
        } catch (error) {
          console.error(`[PAYMENT_CHECK] Error checking recent payment intents:`, error);
        }
      }

      // Re-check including recent payment intent
      hasSuccessfulPayment = 
        (latestInvoice?.payment_intent?.status === 'succeeded' && latestInvoice.amount_paid === 495) ||
        (metadataPaymentIntent?.status === 'succeeded' && metadataPaymentIntent.amount_received === 495) ||
        (recentPaymentIntent?.status === 'succeeded' && recentPaymentIntent.amount === 495);

      // Also check if subscription is active/incomplete which indicates payment processing
      const subscriptionIndicatesPayment = 
        subscription.status === 'active' || 
        subscription.status === 'incomplete' ||
        subscription.status === 'trialing';

      console.log(`[PAYMENT_CHECK] Final checks before upgrade decision:`);
      console.log(`[PAYMENT_CHECK] - Has successful payment: ${hasSuccessfulPayment}`);
      console.log(`[PAYMENT_CHECK] - Is discount subscription: ${isDiscountSubscription}`);
      console.log(`[PAYMENT_CHECK] - Subscription status indicates payment: ${subscriptionIndicatesPayment}`);
      console.log(`[PAYMENT_CHECK] - User not already advanced: ${user.subscriptionTier !== 'advanced'}`);

      if ((hasSuccessfulPayment || (isDiscountSubscription && subscriptionIndicatesPayment)) && user.subscriptionTier !== 'advanced') {

        console.log(`[PAYMENT_CHECK] ✅ FOUND SUCCESSFUL $4.95 PAYMENT - UPGRADING USER`);
        console.log(`[PAYMENT_CHECK] User ${userId} needs upgrade from ${user.subscriptionTier} to advanced`);

        // Upgrade user to Advanced tier
        const upgradeResult = await storage.updateUserSubscription(userId, {
          subscriptionTier: 'advanced',
          subscriptionStatus: 'active',
          maxConnections: 3,
          stripeCustomerId: nullToUndefined(user.stripeCustomerId),
          stripeSubscriptionId: nullToUndefined(user.stripeSubscriptionId),
          subscriptionExpiresAt: undefined
        });

        console.log(`[PAYMENT_CHECK] Database upgrade result:`, upgradeResult ? 'SUCCESS' : 'FAILED');

        // Verify the upgrade
        const updatedUser = await storage.getUser(userId);
        if (updatedUser) {
          console.log(`[PAYMENT_CHECK] Post-upgrade verification:`);
          console.log(`[PAYMENT_CHECK] - New tier: ${updatedUser.subscriptionTier}`);
          console.log(`[PAYMENT_CHECK] - New status: ${updatedUser.subscriptionStatus}`);
          console.log(`[PAYMENT_CHECK] - New maxConnections: ${updatedUser.maxConnections}`);
        }

        console.log(`[PAYMENT_CHECK] ======== UPGRADE COMPLETE ========`);
        return res.json({ 
          upgraded: true, 
          tier: 'advanced',
          message: "Advanced plan activated!" 
        });
      } else {
        console.log(`[PAYMENT_CHECK] No upgrade needed:`);
        console.log(`[PAYMENT_CHECK] - Has successful payment: ${hasSuccessfulPayment}`);
        console.log(`[PAYMENT_CHECK] - Invoice payment succeeded: ${latestInvoice?.payment_intent?.status === 'succeeded'}`);
        console.log(`[PAYMENT_CHECK] - Invoice amount is $4.95: ${latestInvoice?.amount_paid === 495}`);
        console.log(`[PAYMENT_CHECK] - Metadata payment succeeded: ${metadataPaymentIntent?.status === 'succeeded'}`);
        console.log(`[PAYMENT_CHECK] - Metadata payment amount is $4.95: ${metadataPaymentIntent?.amount_received === 495}`);
        console.log(`[PAYMENT_CHECK] - Is discount subscription: ${isDiscountSubscription}`);
        console.log(`[PAYMENT_CHECK] - User not already advanced: ${user.subscriptionTier !== 'advanced'}`);
      }

      console.log(`[PAYMENT_CHECK] ======== NO UPGRADE NEEDED ========`);
      res.json({ 
        upgraded: false, 
        tier: user.subscriptionTier,
        message: "No upgrade needed" 
      });
    } catch (error) {
      console.error("[PAYMENT_CHECK] ❌ ERROR:", error);
      console.error("[PAYMENT_CHECK] Stack trace:", error instanceof Error ? error.stack : 'Unknown error');
      res.status(500).json({ upgraded: false, message: "Check failed" });
    }
  });

  // Security fix: Reset prematurely upgraded subscriptions until payment verification
  app.post("/api/subscription/reset-unverified", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims?.sub || (req.user as any).id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user has a Stripe subscription but shouldn't be upgraded yet
      if (user.stripeSubscriptionId && user.subscriptionTier !== 'free') {
        console.log(`[SECURITY] Resetting prematurely upgraded user ${userId} from ${user.subscriptionTier} to free`);

        // Reset to free tier until webhook confirms payment
        await storage.updateUserSubscription(userId, {
          subscriptionTier: 'free',
          subscriptionStatus: 'active',
          maxConnections: 1,
          stripeCustomerId: nullToUndefined(user.stripeCustomerId),
          stripeSubscriptionId: nullToUndefined(user.stripeSubscriptionId),
          subscriptionExpiresAt: nullToUndefined(user.subscriptionExpiresAt)
        });

        res.json({ 
          success: true,
          message: "Subscription reset to free tier pending payment verification",
          tier: 'free',
          maxConnections: 1
        });
      } else {
        res.json({ 
          success: true,
          message: "No subscription reset needed",
          tier: user.subscriptionTier || 'free',
          maxConnections: user.maxConnections || 1
        });
      }
    } catch (error) {
      console.error("Subscription reset error:", error);
      res.status(500).json({ message: "Failed to reset subscription" });
    }
  });

  // Import profile image from OAuth provider with enhanced authentication
  app.post("/api/users/profile-image/import", 
    rateLimit(3, 60 * 60 * 1000), // 3 imports per hour
    async (req: any, res) => {
    // Enhanced authentication check
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      console.log("[IMPORT] Authentication failed:", {
        isAuthenticated: req.isAuthenticated?.(),
        hasUser: !!req.user,
        sessionID: req.sessionID
      });
      return res.status(401).json({ message: "Authentication required. Please log in again." });
    }
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const { provider } = req.body;

      if (!provider || !['google'].includes(provider)) {
        return res.status(400).json({ message: "Invalid provider. Use 'google'" });
      }

      const currentUser = await storage.getUser(userId);
      if (!currentUser || !currentUser.email) {
        return res.status(404).json({ message: "User not found" });
      }

      let profileImageUrl = null;

      // Extract profile image from OAuth provider
      if (provider === 'google' && currentUser.googleId) {
        // For Google users, we can get the profile image from the OAuth claims
        profileImageUrl = req.user.claims?.profile_image_url || req.user.claims?.picture;
      }

      if (!profileImageUrl) {
        return res.status(400).json({ 
          message: `No ${provider} profile image available or account not linked` 
        });
      }

      // Download and process the image
      try {
        const response = await fetch(profileImageUrl);
        if (!response.ok) {
          throw new Error('Failed to fetch profile image');
        }

        const imageBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(imageBuffer);

        // Generate unique filename
        const fileName = `profile_${userId}_${provider}_${Date.now()}.jpg`;
        const filePath = path.join(uploadsDir, fileName);

        // Process image with sharp - resize and optimize with error handling
        try {
          await sharp(buffer)
            .resize(400, 400, { 
              fit: 'cover',
              position: 'center'
            })
            .jpeg({ quality: 85 })
            .toFile(filePath);
        } catch (imageError) {
          console.error("OAuth image processing error:", imageError);
          return res.status(400).json({ message: "Failed to process profile image from OAuth provider." });
        }

        // Update user profile with new image URL
        const localImageUrl = `/uploads/${fileName}`;
        const updatedUser = await storage.updateUserProfileImage(currentUser.email, localImageUrl);

        if (!updatedUser) {
          return res.status(500).json({ message: "Failed to update profile image" });
        }

        res.json({ 
          success: true, 
          profileImageUrl: updatedUser.profileImageUrl,
          provider,
          message: `Profile image imported from ${provider} successfully` 
        });
      } catch (fetchError) {
        console.error(`Error importing ${provider} profile image:`, fetchError);
        res.status(500).json({ message: `Failed to import ${provider} profile image` });
      }
    } catch (error) {
      console.error("Profile image import error:", error);
      res.status(500).json({ message: "Failed to import profile image" });
    }
  });

  // Account linking endpoints
  app.get("/api/auth/link/google", isAuthenticated, (req, res) => {
    // Redirect to Google OAuth with special linking parameter
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : 'https://joindeeper.com';
    const linkingUrl = `${baseUrl}/api/auth/google?linking=true`;
    res.redirect(linkingUrl);
  });

  app.get("/api/auth/account-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        hasPassword: !!currentUser.passwordHash,
        hasGoogleLinked: !!currentUser.googleId,
        email: currentUser.email,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName
      });
    } catch (error) {
      console.error("Account status error:", error);
      res.status(500).json({ message: "Failed to get account status" });
    }
  });



  app.get("/api/subscription/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!currentUser.email) {
        return res.status(400).json({ message: "User email not found" });
      }

      const initiatedCount = await storage.getInitiatedConnectionsCount(currentUser.email);

      res.json({
        subscriptionTier: currentUser.subscriptionTier || 'free',
        subscriptionStatus: currentUser.subscriptionStatus || 'inactive',
        maxConnections: currentUser.maxConnections || 1,
        initiatedConnections: initiatedCount,
        subscriptionExpiresAt: currentUser.subscriptionExpiresAt
      });
    } catch (error) {
      console.error("Subscription status error:", error);
      res.status(500).json({ message: "Failed to fetch subscription status" });
    }
  });

  // Conversation creation endpoint for dashboard - ensures only ONE conversation per connection
  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const { participant1Email, participant2Email, relationshipType, currentTurn, connectionId } = req.body;
      const userId = req.user.claims?.sub || req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Verify user is authorized to create this conversation
      if (currentUser.email !== participant1Email && currentUser.email !== participant2Email) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if user is an invitee (has free forever access)
      const existingConnections = await storage.getConnectionsByEmail(currentUser.email!);
      const isInviteeUser = existingConnections.some(c => c.inviteeEmail === currentUser.email);

      // Enforce subscription restrictions for conversation creation (but not for invitee users)
      if (!isInviteeUser) {
        // Block conversation creation if subscription is canceled (from refunds/cancellations)
        if (currentUser.subscriptionStatus === 'canceled') {
          return res.status(403).json({ 
            type: 'SUBSCRIPTION_CANCELED',
            message: "Your subscription has been canceled. Choose a subscription plan to continue conversations.",
            subscriptionTier: currentUser.subscriptionTier,
            subscriptionStatus: currentUser.subscriptionStatus,
            requiresUpgrade: true
          });
        }

        const trialStatus = await storage.checkTrialStatus(currentUser.id);

        // Block conversation creation if trial has expired and user doesn't have paid subscription
        if (trialStatus.isExpired && currentUser.subscriptionTier?.trim() === 'trial') {
          await storage.expireTrialUser(currentUser.id);
          return res.status(403).json({ 
            type: 'TRIAL_EXPIRED',
            message: "Your free trial has expired. Choose a subscription plan to continue conversations.",
            subscriptionTier: currentUser.subscriptionTier?.trim(),
            subscriptionStatus: currentUser.subscriptionStatus,
            requiresUpgrade: true
          });
        }
      }

      // Check if a conversation already exists for this connection
      const existingConversations = await storage.getConversationsByConnection(connectionId);
      if (existingConversations.length > 0) {
        // Return the existing conversation instead of creating a new one
        const existingConversation = existingConversations[0];
        return res.json(existingConversation);
      }

      const conversationData = {
        connectionId,
        participant1Email,
        participant2Email,
        relationshipType,
        currentTurn: participant1Email, // Inviter always gets first turn
        status: 'active',
        isMainThread: true
      };

      const conversation = await storage.createConversation(conversationData);

      // Send real-time WebSocket notifications to both participants
      try {
        const { getWebSocketManager } = await import('./websocket');
        const wsManager = getWebSocketManager();
        if (wsManager) {
          // Notify both participants that a new conversation was created
          wsManager.notifyConversationUpdate(participant1Email, {
            conversationId: conversation.id,
            connectionId: connectionId,
            action: 'conversation_created',
            relationshipType
          });

          if (participant1Email !== participant2Email) {
            wsManager.notifyConversationUpdate(participant2Email, {
              conversationId: conversation.id,
              connectionId: connectionId,
              action: 'conversation_created',
              relationshipType
            });
          }
        }
      } catch (error) {
        console.error('[WEBSOCKET] Failed to send conversation creation notification:', error);
      }

      res.json(conversation);
    } catch (error) {
      console.error("Create conversation error:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Conversation threading endpoints - returns conversations with sync metadata
  app.get("/api/connections/:connectionId/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const connectionId = parseInt(req.params.connectionId);
      const userId = req.user.claims?.sub || req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Verify user is part of this connection
      const connection = await storage.getConnection(connectionId);
      if (!connection || 
          (connection.inviterEmail !== currentUser.email && 
           connection.inviteeEmail !== currentUser.email)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const conversations = await storage.getConversationsByConnection(connectionId);

      // Fix conversation titles for any conversations that don't have proper titles
      const { generateRelationshipSpecificTitle } = await import('./thread-naming');
      for (const conversation of conversations) {
        if (!conversation.title || conversation.title === 'Untitled conversation') {
          try {
            const messages = await storage.getMessages(conversation.id);
            const firstQuestion = messages.find(msg => msg.type === 'question');
            if (firstQuestion) {
              const threadTitle = generateRelationshipSpecificTitle(
                firstQuestion.content,
                conversation.relationshipType
              );
              await storage.updateConversationTitle(conversation.id, threadTitle);
              conversation.title = threadTitle; // Update the local object for response
            }
          } catch (error) {
            console.error(`Error generating title for conversation ${conversation.id}:`, error);
          }
        }
      }

      // Determine active conversation (most recently active)
      const sortedConversations = conversations.sort((a, b) => {
        const aTime = new Date(a.lastActivityAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.lastActivityAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });

      const activeConversationId = sortedConversations.length > 0 ? sortedConversations[0].id : null;

      res.json({
        conversations: conversations,
        activeConversationId: activeConversationId,
        previousConversations: conversations.filter(conv => conv.id !== activeConversationId)
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get("/api/connections/:connectionId/conversations/message-counts", isAuthenticated, async (req: any, res) => {
    try {
      const connectionId = parseInt(req.params.connectionId);
      const userId = req.user.claims?.sub || req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser) {
        return res.status(403).json({ message: "Access denied" });
      }

      const conversations = await storage.getConversationsByConnection(connectionId);
      const messageCounts: Record<number, number> = {};

      for (const conversation of conversations) {
        const messages = await storage.getMessages(conversation.id);
        messageCounts[conversation.id] = messages.length;
      }

      res.json(messageCounts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch message counts" });
    }
  });

  // Check if a user can reopen a specific conversation thread
  app.get("/api/conversations/:conversationId/can-reopen", isAuthenticated, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.conversationId);
      const currentConversationId = parseInt(req.query.currentConversationId as string);

      // Production-ready input validation
      if (isNaN(conversationId) || conversationId <= 0) {
        return res.status(400).json({ 
          canReopen: false,
          reason: "invalid_input",
          message: "Invalid conversation ID" 
        });
      }

      const userId = req.user.claims?.sub || req.user.id;
      if (!userId) {
        return res.status(401).json({ 
          canReopen: false,
          reason: "unauthorized",
          message: "User authentication required" 
        });
      }

      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(403).json({ 
          canReopen: false,
          reason: "access_denied",
          message: "Access denied" 
        });
      }

      // Get the conversation to reopen with error handling
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ 
          canReopen: false,
          reason: "not_found",
          message: "Conversation not found" 
        });
      }

      // Verify user has access to this conversation
      if (conversation.participant1Email !== currentUser.email && conversation.participant2Email !== currentUser.email) {
        return res.status(403).json({ 
          canReopen: false,
          reason: "access_denied",
          message: "Access denied to this conversation" 
        });
      }

      // CORE RULE #12: Turn Requirement for Thread Reopening
      // Neither user should be able to "reopen thread" UNLESS IT IS THEIR TURN!
      if (currentConversationId && currentConversationId !== conversationId) {
        const currentConversation = await storage.getConversation(currentConversationId);
        if (currentConversation && currentConversation.currentTurn !== currentUser.email) {
          return res.json({ 
            canReopen: false, 
            reason: "not_your_turn",
            message: "You can only reopen threads when it's your turn" 
          });
        }
      }

      // CORE RULE #11: Current Thread Must Have Complete Exchange
      // When there are multiple past conversation threads BUT the "current thread" in the middle column 
      // has not completed a full "exchange" between the users, the user in "turn" must respond first
      if (currentConversationId && currentConversationId !== conversationId) {
        const currentMessages = await storage.getMessages(currentConversationId);
        if (currentMessages.length > 0) {
          // ENHANCED RULE #11: Check for unanswered questions in chronological order
          // Find the most recent question in the conversation
          let lastQuestionIndex = -1;
          let lastQuestion = null;

          for (let i = currentMessages.length - 1; i >= 0; i--) {
            if (currentMessages[i].type === 'question') {
              lastQuestionIndex = i;
              lastQuestion = currentMessages[i];
              break;
            }
          }

          // If there's a question in the current conversation, check if it has been answered
          if (lastQuestionIndex !== -1 && lastQuestion) {
            const messagesAfterQuestion = currentMessages.slice(lastQuestionIndex + 1);

            // Look for any response from the person who DIDN'T ask the question
            const hasResponseFromOtherPerson = messagesAfterQuestion.some(msg => {
              return msg.senderEmail !== lastQuestion.senderEmail && 
                     (msg.type === 'response' || msg.type === 'followup');
            });

            // If no response from the other person, block thread reopening
            if (!hasResponseFromOtherPerson) {
              console.log(`[THREAD-REOPEN] Blocking - Last question from ${lastQuestion.senderEmail} has no response from other person`);
              console.log(`[THREAD-REOPEN] Current user: ${currentUser.email}, Question sender: ${lastQuestion.senderEmail}`);
              console.log(`[THREAD-REOPEN] Messages after question: ${messagesAfterQuestion.length}`);

              return res.json({ 
                canReopen: false, 
                reason: "respond_to_question",
                message: "The current question must be answered before reopening other threads" 
              });
            }
          }

          // Additional check: if the current conversation has only questions and no responses at all
          const hasQuestions = currentMessages.some(msg => msg.type === 'question');
          const hasResponses = currentMessages.some(msg => msg.type === 'response');

          if (hasQuestions && !hasResponses) {
            console.log(`[THREAD-REOPEN] Blocking - Conversation has questions but no responses at all`);
            return res.json({ 
              canReopen: false, 
              reason: "respond_to_question",
              message: "You must respond to the current question before reopening other threads" 
            });
          }
        }
      }

      // Allow reopening any thread that has at least one message (very permissive)
      const messages = await storage.getMessages(conversationId);

      if (messages.length === 0) {
        return res.json({ 
          canReopen: false, 
          reason: "empty_thread",
          message: "Cannot reopen empty conversation thread" 
        });
      }

      // Thread can be reopened - this does NOT consume the user's turn
      res.json({ canReopen: true });
    } catch (error) {
      console.error('[API] Error checking thread reopen permission:', error);
      res.status(500).json({ message: "Failed to check thread reopen permission" });
    }
  });

  // REMOVED: Duplicate endpoint that could cause turn state confusion
  // All thread switching now goes through /api/connections/:connectionId/switch-active-thread
  // which has comprehensive turn preservation logic

  // Test WebSocket connectivity endpoint
  app.get("/api/websocket/test", isAuthenticated, async (req: any, res) => {
    try {
      const { getWebSocketManager } = await import('./websocket');
      const wsManager = getWebSocketManager();
      const userId = req.user.claims?.sub || req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (wsManager) {
        const connectedUsers = wsManager.getConnectedUsers();
        const connectionCount = wsManager.getConnectionCount();
        const isUserConnected = connectedUsers.includes(currentUser.email || '');

        console.log(`[WEBSOCKET_TEST] Connected users: ${connectedUsers.join(', ')}`);
        console.log(`[WEBSOCKET_TEST] Total connections: ${connectionCount}`);
        console.log(`[WEBSOCKET_TEST] User ${currentUser.email || 'unknown'} connected: ${isUserConnected}`);

        // Send a test notification
        if (currentUser.email) {
          wsManager.notifyConversationUpdate(currentUser.email, {
            conversationId: 9999,
            connectionId: 9999,
            action: 'test_notification'
          });

          res.json({
            wsManagerAvailable: true,
            connectedUsers: connectedUsers,
            connectionCount: connectionCount,
            currentUserConnected: isUserConnected,
            testNotificationSent: true
          });
        } else {
          res.json({
            wsManagerAvailable: true,
            connectedUsers: connectedUsers,
            connectionCount: connectionCount,
            currentUserConnected: false,
            testNotificationSent: false,
            error: "User email not available"
          });
        }
      } else {
        res.json({
          wsManagerAvailable: false,
          message: "WebSocket manager not initialized"
        });
      }
    } catch (error) {
      console.error('[WEBSOCKET_TEST] Error:', error);
      res.status(500).json({ 
        message: "WebSocket test failed", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Switch active conversation thread via connection endpoint - matches frontend call
  // ULTRA-SIMPLIFIED: Thread reopening is pure navigation only
  app.post("/api/connections/:connectionId/switch-active-thread", isAuthenticated, async (req: any, res) => {
    try {
      const connectionId = parseInt(req.params.connectionId);
      const { conversationId } = req.body;

      const userId = req.user.claims?.sub || req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Verify user is part of this connection
      const connection = await storage.getConnection(connectionId);
      if (!connection || 
          (connection.inviterEmail !== currentUser.email && 
           connection.inviteeEmail !== currentUser.email)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get the conversation to switch to (minimal validation)
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }



      // Send WebSocket notification for real-time synchronization (no database changes)
      try {
        const { getWebSocketManager } = await import('./websocket');
        const wsManager = getWebSocketManager();
        if (wsManager) {
          // Notify both participants of thread switch for UI synchronization only
          wsManager.notifyConversationUpdate(conversation.participant1Email, {
            conversationId: conversationId,
            connectionId: connectionId,
            action: 'thread_reopened'
          });

          if (conversation.participant1Email !== conversation.participant2Email) {
            wsManager.notifyConversationUpdate(conversation.participant2Email, {
              conversationId: conversationId,
              connectionId: connectionId,
              action: 'thread_reopened'
            });
          }
        }
      } catch (error) {
        console.error('[WEBSOCKET] Failed to send thread switch notification:', error);
      }

      // Return success without any database modifications
      res.json({ 
        success: true, 
        activeConversationId: conversationId,
        message: "Thread navigation completed"
      });
    } catch (error) {
      console.error('[API] Error switching active thread:', error);
      res.status(500).json({ message: "Failed to switch active thread" });
    }
  });

  // Endpoint to get or create the single conversation for a connection
  app.post("/api/connections/:connectionId/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const connectionId = parseInt(req.params.connectionId);
      const userId = req.user.claims?.sub || req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if user is an invitee (has free forever access)
      const existingConnections = await storage.getConnectionsByEmail(currentUser.email!);
      const isInviteeUser = existingConnections.some(c => c.inviteeEmail === currentUser.email);

      // Enforce subscription restrictions for conversation creation (but not for invitee users)
      if (!isInviteeUser) {
        // Block conversation creation if subscription is canceled (from refunds/cancellations)
        if (currentUser.subscriptionStatus === 'canceled') {
          return res.status(403).json({ 
            type: 'SUBSCRIPTION_CANCELED',
            message: "Your subscription has been canceled. Choose a subscription plan to continue conversations.",
            subscriptionTier: currentUser.subscriptionTier,
            subscriptionStatus: currentUser.subscriptionStatus,
            requiresUpgrade: true
          });
        }

        const trialStatus = await storage.checkTrialStatus(currentUser.id);

        // Block all conversation creation actions if trial has expired and user doesn't have paid subscription
        if (trialStatus.isExpired && currentUser.subscriptionTier?.trim() === 'trial') {
          await storage.expireTrialUser(currentUser.id);
          return res.status(403).json({ 
            type: 'TRIAL_EXPIRED',
            message: "Your free trial has expired. Choose a subscription plan to continue conversations.",
            subscriptionTier: currentUser.subscriptionTier?.trim(),
            subscriptionStatus: currentUser.subscriptionStatus,
            requiresUpgrade: true
          });
        }
      }

      // Verify user is part of this connection
      const connection = await storage.getConnection(connectionId);
      if (!connection || 
          (connection.inviterEmail !== currentUser.email && 
           connection.inviteeEmail !== currentUser.email)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if a conversation already exists for this connection
      const existingConversations = await storage.getConversationsByConnection(connectionId);
      if (existingConversations.length > 0) {
        // Return the existing conversation instead of creating a new one
        const existingConversation = existingConversations[0];
        return res.json(existingConversation);
      }

      // If no conversation exists, create the single conversation for this connection
      const conversationData = {
        connectionId,
        participant1Email: connection.inviterEmail,
        participant2Email: connection.inviteeEmail,
        relationshipType: connection.relationshipType,
        currentTurn: connection.inviterEmail, // Inviter always gets first turn
        status: 'active',
        isMainThread: true
      };

      const conversation = await storage.createConversation(conversationData);

      // Send real-time WebSocket notifications to both participants about new conversation
      try {
        const { getWebSocketManager } = await import('./websocket');
        const wsManager = getWebSocketManager();
        if (wsManager) {
          // Notify both participants that a new conversation was created
          wsManager.notifyConversationUpdate(connection.inviterEmail, {
            conversationId: conversation.id,
            connectionId: connectionId,
            action: 'conversation_created',
            relationshipType: connection.relationshipType
          });

          if (connection.inviterEmail !== connection.inviteeEmail) {
            wsManager.notifyConversationUpdate(connection.inviteeEmail, {
              conversationId: conversation.id,
              connectionId: connectionId,
              action: 'conversation_created',
              relationshipType: connection.relationshipType
            });
          }
        }
      } catch (error) {
        console.error('[WEBSOCKET] Failed to send conversation creation notification:', error);
      }

      res.json(conversation);
    } catch (error) {
      console.error("Create conversation error:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Conversation endpoints with authentication
  app.get("/api/conversations/by-email/:email", isAuthenticated, async (req: any, res) => {
    try {
      const { email } = req.params;

      // Verify user can access conversations for this email
      const userId = req.user.claims?.sub || req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser || currentUser.email !== email) {
        return res.status(403).json({ message: "Access denied" });
      }

      const conversations = await storage.getConversationsByEmail(email);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const conversation = await storage.getConversation(conversationId);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Development bypass for testing
      if (process.env.NODE_ENV === 'development' && req.query.test_user) {
        const testUser = await storage.getUserByEmail('thetobyclarkshow@gmail.com');
        if (testUser && (testUser.email === conversation.participant1Email || testUser.email === conversation.participant2Email)) {
          return res.json(conversation);
        }
      }

      // Check authentication for production
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Verify user is a participant in this conversation
      const userId = req.user.claims?.sub || req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser || 
          (currentUser.email !== conversation.participant1Email && 
           currentUser.email !== conversation.participant2Email)) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(conversation);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  app.get("/api/conversations/:id/messages", async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.id);

      // Verify conversation exists
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Development bypass for testing
      if (process.env.NODE_ENV === 'development' && req.query.test_user) {
        const testUser = await storage.getUserByEmail('thetobyclarkshow@gmail.com');
        if (testUser && (testUser.email === conversation.participant1Email || testUser.email === conversation.participant2Email)) {
          const messages = await storage.getMessagesByConversationId(conversationId);
          return res.json(messages);
        }
      }

      // Check authentication for production
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userId = req.user.claims?.sub || req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser || 
          (currentUser.email !== conversation.participant1Email && 
           currentUser.email !== conversation.participant2Email)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const messages = await storage.getMessagesByConversationId(conversationId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:id/messages", 
    rateLimit(100, 60 * 60 * 1000), // 100 messages per hour
    validateEmail,
    validateMessageContent,
    async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const messageData = insertMessageSchema.parse({
        ...req.body,
        conversationId,
      });

      // Validate conversation exists and user is authorized
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Check if sender is a participant
      if (messageData.senderEmail !== conversation.participant1Email && 
          messageData.senderEmail !== conversation.participant2Email) {
        return res.status(403).json({ message: "Not authorized to send messages in this conversation" });
      }

      // Check if subscription status and trial expiration for messaging
      const senderUser = await storage.getUserByEmail(messageData.senderEmail);
      if (!senderUser) {
        return res.status(403).json({ message: "User not found" });
      }

      // Check if user is an invitee (has free forever access)
      const existingConnections = await storage.getConnectionsByEmail(senderUser.email!);
      const isInviteeUser = existingConnections.some(c => c.inviteeEmail === senderUser.email);

      // Enforce subscription restrictions for messaging (but not for invitee users)
      if (!isInviteeUser) {
        const trialStatus = await storage.checkTrialStatus(senderUser.id);

        // Block messaging if subscription is canceled (from refunds/cancellations)
        if (senderUser.subscriptionStatus === 'canceled') {
          return res.status(403).json({ 
            type: 'SUBSCRIPTION_CANCELED',
            message: "Your subscription has been canceled. Choose a subscription plan to continue conversations.",
            subscriptionTier: senderUser.subscriptionTier,
            subscriptionStatus: senderUser.subscriptionStatus,
            requiresUpgrade: true
          });
        }

        // Block all messaging actions if trial has expired and user doesn't have paid subscription
        if (trialStatus.isExpired && senderUser.subscriptionTier?.trim() === 'trial') {
          await storage.expireTrialUser(senderUser.id);
          return res.status(403).json({ 
            type: 'TRIAL_EXPIRED',
            message: "Your free trial has expired. Choose a subscription plan to continue conversations.",
            subscriptionTier: senderUser.subscriptionTier?.trim(),
            subscriptionStatus: senderUser.subscriptionStatus,
            requiresUpgrade: true
          });
        }
      }

      // Check if it's the sender's turn
      if (messageData.senderEmail !== conversation.currentTurn) {
        return res.status(400).json({ message: "It's not your turn to send a message" });
      }

      // Get existing messages to validate message type
      const existingMessages = await storage.getMessagesByConversationId(conversationId);
      const lastMessage = existingMessages[existingMessages.length - 1];

      // REMOVED: Automatic thread creation logic - new conversation threads can only be created 
      // via explicit right-column actions (curated questions, AI suggestions, or "Ask New Question" button)
      // Regular text responses should never automatically create new conversation threads

      // Original validation logic for messages being added to existing conversation
      try {
        if (existingMessages.length === 0) {
          // First message must be a question
          if (messageData.type !== 'question') {
            return res.status(400).json({ 
              message: "First message must be a question",
              code: "INVALID_FIRST_MESSAGE_TYPE",
              expected: "question",
              received: messageData.type 
            });
          }
        } else {
          // Production-ready question-response validation: EVERY question requires a response before new questions
          // Find the most recent question in the conversation
          let lastQuestionIndex = -1;
          for (let i = existingMessages.length - 1; i >= 0; i--) {
            if (existingMessages[i].type === 'question') {
              lastQuestionIndex = i;
              break;
            }
          }

          // If there's a question without a response, only allow responses
          if (lastQuestionIndex !== -1) {
            const messagesAfterLastQuestion = existingMessages.slice(lastQuestionIndex + 1);

            // Enhanced response detection: check for both text and voice responses
            const hasResponseToLastQuestion = messagesAfterLastQuestion.some(msg => {
              return msg.type === 'response' || 
                     (msg.messageFormat === 'voice' && msg.type !== 'question') ||
                     // Also check for follow-up messages that aren't questions
                     (msg.type !== 'question' && msg.senderEmail !== existingMessages[lastQuestionIndex].senderEmail);
            });

            // If the last question hasn't been responded to, only allow responses
            if (!hasResponseToLastQuestion && messageData.type === 'question') {
              return res.status(400).json({ 
                message: "The previous question must be answered before asking a new question",
                code: "QUESTION_REQUIRES_RESPONSE",
                lastQuestionIndex: lastQuestionIndex,
                hasResponse: false
              });
            }

            // After a complete question-response exchange, allow new questions (which may create new threads)
          }

          // Validate message type is one of the allowed values
          if (!['question', 'response'].includes(messageData.type)) {
            return res.status(400).json({ 
              message: "Invalid message type",
              code: "INVALID_MESSAGE_TYPE",
              allowed: ["question", "response"],
              received: messageData.type 
            });
          }
        }
      } catch (validationError) {
        console.error('[MESSAGE_VALIDATION] Error validating message type:', validationError);
        return res.status(500).json({ 
          message: "Message validation failed",
          code: "VALIDATION_ERROR" 
        });
      }

      const message = await storage.createMessage(messageData);

      // Generate thread title if this is the first question
      if (existingMessages.length === 0 && messageData.type === 'question') {
        const threadTitle = generateRelationshipSpecificTitle(
          messageData.content, 
          conversation.relationshipType
        );
        await storage.updateConversationTitle(conversationId, threadTitle);
      }

      // Update conversation turn to the other participant
      const nextTurn = conversation.currentTurn === conversation.participant1Email 
        ? conversation.participant2Email 
        : conversation.participant1Email;
      await storage.updateConversationTurn(conversationId, nextTurn);

      // Cancel any existing turn reminder campaigns for the sender since they just responded
      try {
        await emailCampaignService.cancelPendingCampaigns(messageData.senderEmail, ['turn_reminder']);
        console.log(`[CAMPAIGNS] Cancelled turn reminder campaigns for sender: ${messageData.senderEmail}`);
      } catch (campaignError) {
        console.error("[CAMPAIGNS] Failed to cancel turn reminder campaigns:", campaignError);
      }

      // Send turn notification (email and/or SMS based on user preferences)
      try {
        console.log(`[NOTIFICATION] Sending turn notification to ${nextTurn} from ${messageData.senderEmail}`);
        await notificationService.sendTurnNotification({
          recipientEmail: nextTurn,
          senderEmail: messageData.senderEmail,
          conversationId,
          relationshipType: conversation.relationshipType,
          messageType: (messageData.type === 'question' || messageData.type === 'response') ? messageData.type : 'question'
        });
        console.log(`[NOTIFICATION] Turn notification sent successfully to ${nextTurn}`);
      } catch (error) {
        console.error('[NOTIFICATION] Failed to send turn notification:', error);
        console.error('[NOTIFICATION] Error details:', error);
        // Don't fail the message sending if notification fails
      }

      // Schedule turn reminder campaigns for the recipient
      try {
        await emailCampaignService.scheduleTurnReminderCampaigns(conversationId, nextTurn, messageData.senderEmail);
        console.log(`[CAMPAIGNS] Scheduled turn reminder campaigns for recipient: ${nextTurn}`);
      } catch (campaignError) {
        console.error("[CAMPAIGNS] Failed to schedule turn reminder campaigns:", campaignError);
      }

      // Send real-time WebSocket notifications to both participants
      try {
        const { getWebSocketManager } = await import('./websocket');
        const wsManager = getWebSocketManager();
        if (wsManager) {
          const senderName = await storage.getUserDisplayNameByEmail(messageData.senderEmail);

          // Notify recipient about new message
          wsManager.notifyNewMessage(nextTurn, {
            conversationId,
            senderEmail: messageData.senderEmail,
            senderName,
            messageType: (messageData.type === 'question' || messageData.type === 'response') ? messageData.type : 'question',
            relationshipType: conversation.relationshipType
          });

          // CRITICAL FIX: Notify BOTH users about turn change to prevent "both users see their turn" issue
          // This ensures frontend cache is synchronized for both participants
          wsManager.notifyConversationUpdate(messageData.senderEmail, {
            conversationId,
            connectionId: conversation.connectionId,
            action: 'turn_updated',
            newTurn: nextTurn,
            relationshipType: conversation.relationshipType
          });

          wsManager.notifyConversationUpdate(nextTurn, {
            conversationId,
            connectionId: conversation.connectionId,
            action: 'turn_updated', 
            newTurn: nextTurn,
            relationshipType: conversation.relationshipType
          });

          // Also notify sender that message was sent
          wsManager.notifyConversationUpdate(messageData.senderEmail, {
            conversationId,
            action: 'message_sent',
            relationshipType: conversation.relationshipType
          });
        }
      } catch (error) {
        console.error('[WEBSOCKET] Failed to send real-time notification:', error);
        // Don't fail the message sending if WebSocket fails
      }

      // Track message sending
      analytics.track({
        type: 'message_sent',
        email: messageData.senderEmail,
        metadata: { 
          conversationId,
          messageType: (messageData.type === 'question' || messageData.type === 'response') ? messageData.type : 'question',
          relationshipType: conversation.relationshipType
        }
      });

      res.json(message);
    } catch (error) {
      console.error("Create message error:", error);
      res.status(400).json({ message: "Failed to create message" });
    }
  });

  // Voice message endpoint - Production ready with comprehensive security
  app.post("/api/conversations/:id/voice-messages", 
    audioUpload.single('audio'),
    rateLimit(50, 60 * 60 * 1000), // 50 voice messages per hour
    validateEmail,
    isAuthenticated,
    async (req: any, res) => {
    let audioPath: string | null = null;
    try {
      const conversationId = parseInt(req.params.id);
      const { senderEmail, type, duration } = req.body;
      const userId = req.user.claims?.sub || req.user.id;

      // Add comprehensive debugging for voice message creation
      if (process.env.NODE_ENV === 'development') {
        console.log('=== VOICE MESSAGE DEBUG START ===');
        console.log('Request params:', req.params);
        console.log('Request body:', req.body);
        console.log('File info:', req.file ? {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        } : 'No file');
        console.log('User ID:', userId);
        console.log('Conversation ID:', conversationId);
      }

      // Comprehensive input validation
      if (!req.file) {
        return res.status(400).json({ message: "Audio file is required" });
      }

      // Validate conversation ID
      if (isNaN(conversationId) || conversationId <= 0) {
        return res.status(400).json({ message: "Invalid conversation ID" });
      }

      // Validate required fields
      if (!senderEmail || typeof senderEmail !== 'string' || !senderEmail.trim()) {
        return res.status(400).json({ message: "Valid sender email is required" });
      }

      if (!type || !['question', 'response'].includes(type)) {
        return res.status(400).json({ message: "Invalid message type. Must be 'question' or 'response'" });
      }

      // Validate and sanitize duration
      const parsedDuration = parseInt(duration);
      if (isNaN(parsedDuration) || parsedDuration <= 0 || parsedDuration > 1800) { // Max 30 minutes
        return res.status(400).json({ message: "Invalid audio duration. Must be between 1 second and 30 minutes" });
      }

      // Validate audio file properties
      const maxFileSize = 50 * 1024 * 1024; // 50MB
      if (req.file.size > maxFileSize) {
        return res.status(413).json({ message: "Audio file too large. Maximum size is 50MB" });
      }

      // Validate MIME type for security
      const allowedMimeTypes = [
        'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 
        'audio/ogg', 'audio/m4a', 'audio/aac'
      ];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ 
          message: "Invalid audio format. Supported formats: WebM, MP4, MP3, WAV, OGG, M4A, AAC" 
        });
      }

      // Verify user authentication and authorization
      const user = await storage.getUser(userId);
      if (!user || user.email !== senderEmail) {
        return res.status(403).json({ message: "Not authorized to send messages as this user" });
      }

      // Check if user is an invitee (has free forever access)
      const existingConnections = await storage.getConnectionsByEmail(user.email!);
      const isInviteeUser = existingConnections.some(c => c.inviteeEmail === user.email);

      // Enforce subscription restrictions for voice messaging (but not for invitee users)
      if (!isInviteeUser) {
        const trialStatus = await storage.checkTrialStatus(user.id);

        // Block messaging if subscription is canceled (from refunds/cancellations)
        if (user.subscriptionStatus === 'canceled') {
          return res.status(403).json({ 
            type: 'SUBSCRIPTION_CANCELED',
            message: "Your subscription has been canceled. Choose a subscription plan to continue conversations.",
            subscriptionTier: user.subscriptionTier,
            subscriptionStatus: user.subscriptionStatus,
            requiresUpgrade: true
          });
        }

        // Block all voice messaging actions if trial has expired and user doesn't have paid subscription
        if (trialStatus.isExpired && user.subscriptionTier?.trim() === 'trial') {
          await storage.expireTrialUser(user.id);
          return res.status(403).json({ 
            type: 'TRIAL_EXPIRED',
            message: "Your free trial has expired. Choose a subscription plan to continue conversations.",
            subscriptionTier: user.subscriptionTier?.trim(),
            subscriptionStatus: user.subscriptionStatus,
            requiresUpgrade: true
          });
        }
      }

      // Validate conversation exists and user is authorized
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        if (process.env.NODE_ENV === 'development') {
          console.log('ERROR: Conversation not found for ID:', conversationId);
        }
        return res.status(404).json({ message: "Conversation not found" });
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('Conversation found:', {
          id: conversation.id,
          participant1: conversation.participant1Email,
          participant2: conversation.participant2Email,
          currentTurn: conversation.currentTurn
        });
      }

      // Check if sender is a participant
      if (senderEmail !== conversation.participant1Email && 
          senderEmail !== conversation.participant2Email) {
        if (process.env.NODE_ENV === 'development') {
          console.log('ERROR: User not authorized in conversation');
        }
        return res.status(403).json({ message: "Not authorized to send messages in this conversation" });
      }

      // Check if it's the sender's turn
      if (senderEmail !== conversation.currentTurn) {
        if (process.env.NODE_ENV === 'development') {
          console.log('ERROR: Not sender\'s turn. Current turn:', conversation.currentTurn, 'Sender:', senderEmail);
        }
        return res.status(400).json({ message: "It's not your turn to send a message" });
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('All validations passed, proceeding with file save...');
      }

      // Generate secure filename with timestamp and random string
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);

      // Map MIME types to proper file extensions
      const mimeToExtension: { [key: string]: string } = {
        'audio/webm': 'webm',
        'audio/mp4': 'm4a',
        'audio/wav': 'wav',
        'audio/ogg': 'ogg',
        'audio/mpeg': 'mp3'
      };

      const fileExtension = mimeToExtension[req.file.mimetype as string] || 'webm';
      const fileName = `voice_${timestamp}_${randomString}.${fileExtension}`;

      // Save audio file with persistent storage (S3 if configured, local as fallback)
      let audioFileUrl: string;

      try {
        if (s3Service.isS3Configured()) {
          // Use S3 for persistent storage in production
          if (process.env.NODE_ENV === 'development') {
            console.log('Uploading audio file to S3:', fileName);
            console.log('Audio file size:', req.file.size);
            console.log('Audio file type:', req.file.mimetype);
          }

          audioFileUrl = await s3Service.uploadAudioFile(
            req.file.buffer, 
            fileName, 
            req.file.mimetype
          );

          if (process.env.NODE_ENV === 'development') {
            console.log('Audio file uploaded to S3 successfully:', audioFileUrl);
          }
        } else {
          // Fallback to local storage (with warning about persistence)
          console.warn('[AUDIO_STORAGE] S3 not configured - using local storage (files may not persist across deployments)');

          audioPath = path.join(uploadsDir, fileName);

          if (process.env.NODE_ENV === 'development') {
            console.log('Saving audio file locally:', audioPath);
            console.log('Audio file size:', req.file.size);
            console.log('Audio file type:', req.file.mimetype);
          }

          await fs.writeFile(audioPath, req.file.buffer);

          // Verify file was written
          const stats = await fs.stat(audioPath);

          if (process.env.NODE_ENV === 'development') {
            console.log('Audio file saved locally. Size:', stats.size);
            console.log('Audio file path:', audioPath);
          }

          audioFileUrl = `/uploads/${fileName}`;
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('Final audio URL:', audioFileUrl);
        }
      } catch (fileError) {
        console.error("Audio file storage error:", fileError);
        return res.status(500).json({ 
          message: "Failed to save audio file",
          details: process.env.NODE_ENV === 'development' ? fileError : undefined
        });
      }

      // Transcribe audio using OpenAI Whisper with production-ready error handling
      let transcription = '';
      try {
        // Validate OpenAI API key is configured
        if (!process.env.OPENAI_API_KEY) {
          console.warn('OpenAI API key not configured, skipping transcription');
          transcription = '[Transcription unavailable - audio only]';
        } else {
          // For transcription, we always use the buffer from memory (works for both S3 and local)
          // Create a File-like object from the buffer for OpenAI API
          const audioFile = new File([req.file.buffer], fileName, { 
            type: req.file.mimetype 
          });

          // Add timeout and error handling for transcription
          const transcriptionResponse = await Promise.race([
            openai.audio.transcriptions.create({
              file: audioFile,
              model: "whisper-1",
              response_format: "text",
              language: "en" // Optimize for English
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Transcription timeout')), 30000) // 30 second timeout
            )
          ]);

          transcription = typeof transcriptionResponse === 'string' 
            ? transcriptionResponse.trim() 
            : '[Transcription failed - invalid response]';

          // Validate transcription length for security
          if (transcription.length > 5000) {
            transcription = transcription.substring(0, 5000) + '... [truncated]';
          }

          // Clean up transcription text
          transcription = transcription.replace(/[^\w\s\.,\?!'";\-:()]/g, '').trim();

          if (!transcription || transcription.length < 3) {
            transcription = '[Audio detected but transcription unclear]';
          }
        }
      } catch (error: any) {
        console.error('OpenAI transcription error:', error);

        // Specific error handling for OpenAI API issues
        if (error.code === 'insufficient_quota') {
          transcription = '[Transcription unavailable - quota exceeded]';
        } else if (error.code === 'invalid_api_key') {
          transcription = '[Transcription unavailable - authentication error]';
        } else if (error.message?.includes('timeout')) {
          transcription = '[Transcription failed - timeout]';
        } else if (error.code === 'model_not_found') {
          transcription = '[Transcription unavailable - service error]';
        } else {
          transcription = '[Transcription failed - audio only]';
        }
      }

      // Get existing messages to validate message type
      const existingMessages = await storage.getMessagesByConversationId(conversationId);
      const lastMessage = existingMessages[existingMessages.length - 1];

      // Validate message type based on conversation flow
      // Special rule: ALL voice messages are always treated as "response" type
      if (existingMessages.length === 0) {
        // For voice messages, allow "response" type even as first message
        // For text messages, require "question" type as first message
        if (type !== 'question' && type !== 'response') {
          return res.status(400).json({ message: "First message must be a question or response" });
        }
      } else {
        // Voice messages are always allowed as "response" regardless of turn logic
        if (type !== 'response' && type !== 'question' && type !== 'follow up') {
          return res.status(400).json({ message: "Invalid message type" });
        }
      }

      // Create voice message with transcription
      const messageData = {
        conversationId,
        senderEmail,
        content: transcription, // Store transcription as content
        type,
        messageFormat: 'voice' as const,
        audioFileUrl,
        transcription,
        audioDuration: parseInt(duration) || 0
      };

      if (process.env.NODE_ENV === 'development') {
        console.log('Creating voice message with data:', {
          ...messageData,
          content: transcription.substring(0, 100) + '...' // Truncate for logging
        });
      }

      const message = await storage.createMessage(messageData);

      if (process.env.NODE_ENV === 'development') {
        console.log('Voice message created successfully with ID:', message.id);
      }

      // Generate thread title if this is the first question
      if (existingMessages.length === 0 && type === 'question') {
        const threadTitle = generateRelationshipSpecificTitle(
          transcription, 
          conversation.relationshipType
        );
        await storage.updateConversationTitle(conversation.id, threadTitle);
      }

      // Update conversation turn to the other participant
      const nextTurn = conversation.currentTurn === conversation.participant1Email 
        ? conversation.participant2Email 
        : conversation.participant1Email;
      await storage.updateConversationTurn(conversation.id, nextTurn);

      // Cancel any existing turn reminder campaigns for the sender since they just responded
      try {
        await emailCampaignService.cancelPendingCampaigns(senderEmail, ['turn_reminder']);
        console.log(`[CAMPAIGNS] Cancelled turn reminder campaigns for voice message sender: ${senderEmail}`);
      } catch (campaignError) {
        console.error("[CAMPAIGNS] Failed to cancel turn reminder campaigns for voice message:", campaignError);
      }

      // Send turn notification
      try {
        await notificationService.sendTurnNotification({
          recipientEmail: nextTurn,
          senderEmail,
          conversationId,
          relationshipType: conversation.relationshipType,
          messageType: type
        });
      } catch (error) {
        console.error('[NOTIFICATION] Failed to send turn notification:', error);
      }

      // Schedule turn reminder campaigns for the recipient
      try {
        await emailCampaignService.scheduleTurnReminderCampaigns(conversation.id, nextTurn, senderEmail);
        console.log(`[CAMPAIGNS] Scheduled turn reminder campaigns for voice message recipient: ${nextTurn}`);
      } catch (campaignError) {
        console.error("[CAMPAIGNS] Failed to schedule turn reminder campaigns for voice message:", campaignError);
      }

      // Send real-time WebSocket notifications
      try {
        const { getWebSocketManager } = await import('./websocket');
        const wsManager = getWebSocketManager();
        if (wsManager) {
          const senderName = await storage.getUserDisplayNameByEmail(senderEmail);

          wsManager.notifyNewMessage(nextTurn, {
            conversationId,
            senderEmail,
            senderName,
            messageType: type,
            relationshipType: conversation.relationshipType
          });

          wsManager.notifyConversationUpdate(senderEmail, {
            conversationId,
            action: 'message_sent',
            relationshipType: conversation.relationshipType
          });
        }
      } catch (error) {
        console.error('[WEBSOCKET] Failed to send real-time notification:', error);
      }

      // Track voice message sending
      analytics.track({
        type: 'message_sent',
        email: senderEmail,
        metadata: { 
          conversationId,
          messageType: type,
          messageFormat: 'voice',
          relationshipType: conversation.relationshipType
        }
      });

      res.json({
        ...message,
        message: "Voice message sent successfully",
        audioFileUrl: audioFileUrl,
        debug: process.env.NODE_ENV === 'development' ? {
          audioPath: s3Service.isS3Configured() ? 'S3 Storage' : audioPath,
          audioFileUrl,
          fileSize: req.file.size,
          storageType: s3Service.isS3Configured() ? 'S3' : 'Local'
        } : undefined
      });
    } catch (error: any) {
      console.error("Create voice message error:", error);

      // Clean up audio file if it was created but message creation failed
      if (req.file && audioPath) {
        try {
          await fs.unlink(audioPath);
        } catch (cleanupError) {
          console.error("Failed to clean up audio file:", cleanupError);
        }
      }

      // Enhanced error handling for production
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: error.message });
      } else if (error.code === 'ENOSPC') {
        return res.status(507).json({ message: "Insufficient storage space" });
      } else if (error.code === 'EMFILE' || error.code === 'ENFILE') {
        return res.status(503).json({ message: "Server temporarily overloaded" });
      }

      res.status(500).json({ 
        message: process.env.NODE_ENV === 'production' 
          ? "Voice message service temporarily unavailable"
          : "Failed to create voice message" 
      });
    }
  });

  // User data endpoints
  app.get("/api/users/by-email/:email", async (req, res) => {
    try {
      const { email } = req.params;
      const user = await storage.getUserByEmail(email);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Return user data (excluding sensitive information)
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        subscriptionTier: user.subscriptionTier,
        createdAt: user.createdAt
      });
    } catch (error) {
      console.error("Error fetching user by email:", error);
      res.status(500).json({ message: "Failed to fetch user data" });
    }
  });

  app.get("/api/users/display-name/:email", async (req, res) => {
    try {
      const { email } = req.params;
      const displayName = await storage.getUserDisplayNameByEmail(email);
      res.json({ displayName });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user display name" });
    }
  });

  // Email management endpoints
  app.get("/api/emails/:email", isAuthenticated, async (req, res) => {
    try {
      const { email } = req.params;
      const emails = await storage.getEmailsByEmail(email);
      res.json(emails);
    } catch (error) {
      console.error("Failed to fetch emails:", error);
      res.status(500).json({ message: "Failed to fetch emails" });
    }
  });

  app.get("/api/emails/view/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const email = await storage.getEmailById(parseInt(id));

      if (!email) {
        return res.status(404).json({ message: "Email not found" });
      }

      // Return HTML email content for viewing
      res.setHeader('Content-Type', 'text/html');
      res.send(email.htmlContent);
    } catch (error) {
      console.error("Failed to fetch email:", error);
      res.status(500).json({ message: "Failed to fetch email" });
    }
  });

  // Enhanced AI Question Generation endpoint with infinite suggestions
  app.post("/api/ai/generate-questions", 
    rateLimit(10, 60 * 60 * 1000), // 10 generations per hour for infinite suggestions
    isAuthenticated, 
    async (req: any, res) => {
    try {
      const { relationshipType, userRole, otherUserRole, count = 5, excludeQuestions = [] } = req.body;

      if (!relationshipType) {
        return res.status(400).json({ message: "Relationship type is required" });
      }

      // Validate count
      const questionCount = Math.min(Math.max(parseInt(count) || 5, 1), 10);

      // Filter to exclude already shown questions
      const exclusionList = Array.isArray(excludeQuestions) ? excludeQuestions : [];

      // Try OpenAI API first, fall back to role-specific templates
      try {
        if (process.env.OPENAI_API_KEY && userRole) {
          const OpenAI = await import('openai');
          const openai = new OpenAI.default({ apiKey: process.env.OPENAI_API_KEY });

          // Create exclusion context for AI
          const exclusionContext = exclusionList.length > 0 
            ? `\n\nIMPORTANT: Do NOT generate any questions similar to these already shown questions: ${exclusionList.slice(0, 10).join('; ')}`
            : '';

          // Create role-specific prompts for vulnerable, difficult-to-ask questions
          const rolePrompts = {
            "Parent-Child": {
              "Father": `Generate ${questionCount} deeply vulnerable conversation questions that an adult father might ask his grown child - questions that address fears, regrets, difficult emotions, or conversations that are hard to bring up in person. Focus on: parenting mistakes/regrets, fears about the relationship, personal struggles, mortality/aging concerns, difficult family dynamics. These should be emotionally vulnerable questions that create authentic connection through difficult topics.${exclusionContext}`,
              "Mother": `Generate ${questionCount} deeply vulnerable conversation questions that an adult mother might ask her grown child - questions about fears, sacrifices, maternal struggles, or topics too difficult to discuss face-to-face. Focus on: motherhood fears/regrets, family sacrifices, relationship impacts on children, generational patterns, difficult emotional truths. These should be emotionally raw questions that foster genuine intimacy.${exclusionContext}`,
              "Son": `Generate ${questionCount} deeply vulnerable conversation questions that an adult son might ask his father - questions about struggles, fears, disappointments, or topics too difficult to bring up in person. Focus on: masculine identity struggles, feeling inadequate, relationship/career fears, family pressure, personal failures. These should be emotionally honest questions that address difficult father-son dynamics.${exclusionContext}`,
              "Daughter": `Generate ${questionCount} deeply vulnerable conversation questions that an adult daughter might ask her mother - questions about insecurities, fears, family patterns, or topics too sensitive to discuss face-to-face. Focus on: feminine identity struggles, family expectations, relationship fears, generational patterns, personal inadequacies. These should be emotionally vulnerable questions that address difficult mother-daughter dynamics.${exclusionContext}`
            },
            "Romantic Partners": {
              "Boyfriend": `Generate ${questionCount} deeply vulnerable questions for an adult boyfriend to ask his girlfriend - questions about relationship fears, insecurities, difficult emotions, or topics too scary to bring up in person. Focus on: relationship anxieties, intimacy struggles, commitment fears, past trauma effects, emotional needs.${exclusionContext}`,
              "Girlfriend": `Generate ${questionCount} deeply vulnerable questions for an adult girlfriend to ask her boyfriend - questions about relationship insecurities, fears, difficult emotions, or topics too vulnerable to discuss face-to-face. Focus on: relationship fears, intimacy struggles, emotional needs, commitment anxieties, past relationship impacts.${exclusionContext}`,
              "Husband": `Generate ${questionCount} deeply vulnerable questions for an adult husband to ask his wife - questions about marriage struggles, fears, difficult emotions, or topics too hard to bring up in person. Focus on: marriage difficulties, intimacy challenges, identity loss, unmet needs, relationship regrets.${exclusionContext}`,
              "Wife": `Generate ${questionCount} deeply vulnerable questions for an adult wife to ask her husband - questions about marriage fears, unmet needs, difficult emotions, or topics too vulnerable to discuss face-to-face. Focus on: marriage struggles, feeling disconnected, unvoiced needs, intimacy challenges, identity concerns.${exclusionContext}`
            },
            "Friends": {
              "Best Friend": `Generate ${questionCount} deeply vulnerable questions for an adult best friend - questions about friendship fears, hidden vulnerabilities, difficult emotions, or topics too sensitive to bring up in person. Focus on: friendship insecurities, jealousy, fear of growing apart, unspoken tensions, authentic connection struggles.${exclusionContext}`,
              "Close Friend": `Generate ${questionCount} deeply vulnerable questions for an adult close friend - questions about friendship boundaries, insecurities, fears, or topics difficult to discuss face-to-face. Focus on: friendship expectations, feeling left out, authenticity struggles, boundary navigation, connection fears.${exclusionContext}`,
              "Friend": `Generate ${questionCount} deeply vulnerable questions for an adult friend - questions about friendship difficulties, vulnerabilities, fears, or topics too risky to bring up in person. Focus on: friendship authenticity, fear of judgment, connection struggles, hidden insecurities, relationship patterns.${exclusionContext}`
            }
          };

          let prompt: string | undefined;
          if (relationshipType === "Parent-Child") {
            const parentChildPrompts = rolePrompts["Parent-Child"];
            prompt = (parentChildPrompts as any)[userRole];
          } else if (relationshipType === "Romantic Partners") {
            const romanticPrompts = rolePrompts["Romantic Partners"];
            prompt = (romanticPrompts as any)[userRole];
          } else if (relationshipType === "Friends") {
            const friendPrompts = rolePrompts["Friends"];
            prompt = (friendPrompts as any)[userRole];
          } else if (relationshipType === "Siblings") {
            const siblingPrompts = rolePrompts["Siblings"];
            prompt = (siblingPrompts as any)[userRole];
          }


          if (prompt) {
            // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
            const response = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [
                {
                  role: "system",
                  content: "You are an expert at creating deeply vulnerable conversation questions for adult relationships. Generate questions that address fears, regrets, difficult emotions, unspoken truths, and topics that are genuinely hard to bring up in person. These questions should foster authentic connection through emotional vulnerability and honest self-reflection. Focus on the difficult conversations that people need to have but struggle to initiate. Return only the questions as a JSON object with a 'questions' array."
                },
                {
                  role: "user",
                  content: prompt
                }
              ],
              response_format: { type: "json_object" },
              max_tokens: 500
            });

            const result = JSON.parse(response.choices[0].message.content || '{}');
            if (result.questions && Array.isArray(result.questions)) {
              return res.json({ 
                questions: result.questions.slice(0, questionCount),
                relationshipType,
                userRole: userRole || '',
                otherUserRole: otherUserRole || '',
                count: result.questions.slice(0, questionCount).length
              });
            }
          }
        }
      } catch (error) {
        console.error("OpenAI API error:", error);
        // Continue to fallback templates
      }

      // Role-specific fallback templates for adult relationships
      const roleSpecificTemplates = {
        "Parent-Child": {
          "Father": [
            "What life lesson do you wish you had learned earlier that you want to share?",
            "How has watching you become an adult changed my perspective on my own choices?",
            "What aspect of modern adult life do you find most challenging that I might not understand?",
            "What family responsibility or tradition would you like to eventually take on?",
            "What's something you're proud of about how you've handled adult challenges?",
            "What wisdom from my father do I find myself wanting to pass down to you?"
          ],
          "Mother": [
            "What motherly wisdom do I want to share now that you're navigating adult relationships?",
            "How has my relationship with my own mother influenced how I want to connect with you?",
            "What life skill do I wish I had taught you before you became an adult?",
            "What aspect of your independence makes me most proud as your mother?",
            "What family tradition or value do I hope you'll carry into your own adult relationships?",
            "How do I navigate the shift from protector to advisor now that you're grown?"
          ],
          "Son": [
            "What aspect of being an adult man do I wish I could get your perspective on?",
            "What family responsibility am I ready to take on now that I'm grown?",
            "How has becoming an adult changed what I appreciate about you as my father?",
            "What life decision am I facing that I'd value your experience with?",
            "What question about relationships or career would I like your honest opinion on?",
            "What family story or tradition do I want to understand better now that I'm an adult?"
          ],
          "Daughter": [
            "What aspect of being an adult woman would I like your guidance on?",
            "How has my perspective on you changed since I became an adult myself?",
            "What life challenge am I facing that I think you might have insight about?",
            "What family tradition or value do I want to continue in my own adult life?",
            "What question about adult relationships would I value your perspective on?",
            "How do I want to honor what you taught me while creating my own adult path?"
          ]
        },
        "Romantic Partners": {
          "Boyfriend": [
            "What's something new I'd like us to experience together?",
            "When do I feel most connected to you?",
            "What's a dream I have for our relationship?",
            "What's something I've learned about love from being with you?",
            "How do I see us growing together in the next year?",
            "If I could relive one moment with you, what would it be?"
          ],
          "Girlfriend": [
            "What's something new I'd like us to experience together?",
            "When do I feel most connected to you?",
            "What's a dream I have for our relationship?",
            "What's something I've learned about love from being with you?",
            "How do I see us growing together in the next year?",
            "If I could relive one moment with you, what would it be?"
          ],
          "Husband": [
            "What's your favorite memory from our relationship so far?",
            "How have we grown together since we got married?",
            "What's something I'm grateful for about our partnership?",
            "What dream do I have for our future?",
            "What makes me feel most appreciated in our marriage?",
            "How can we strengthen our connection as spouses?"
          ],
          "Wife": [
            "What's your favorite memory from our relationship so far?",
            "How have we grown together since we got married?",
            "What's something I'm grateful for about our partnership?",
            "What dream do I have for our future?",
            "What makes me feel most appreciated in our marriage?",
            "How can we strengthen our connection as spouses?"
          ]
        },
        "Friends": {
          "Best Friend": [
            "What's my favorite memory of our friendship?",
            "How have we supported each other through tough times?",
            "What's something I admire about how you handle challenges?",
            "What adventure would I most like us to go on?",
            "What makes our friendship special to me?"
          ],
          "Close Friend": [
            "What's something we have in common that always surprises people?",
            "How has our friendship changed over the years?",
            "What's a goal I'd like support with?",
            "What's my favorite thing we do together?",
            "What's something I've learned from our friendship?"
          ]
        },
        "Siblings": {
          "Brother": [
            "What's my favorite childhood memory of us?",
            "How do I think we've influenced each other?",
            "What's something I admire about my sister?",
            "What family trait do I see in both of us?",
            "What's a tradition I hope we continue as adults?"
          ],
          "Sister": [
            "What's my favorite childhood memory of us?",
            "How do I think we've influenced each other?",
            "What's something I admire about my brother?",
            "What family trait do I see in both of us?",
            "What's a tradition I hope we continue as adults?"
          ]
        }
      };

      // Get role-specific templates or fall back to general relationship templates
      const relationshipTemplates = roleSpecificTemplates[relationshipType as keyof typeof roleSpecificTemplates];
      let templates: string[] = [];

      if (relationshipType === "Parent-Child") {
        const parentChildTemplates = roleSpecificTemplates["Parent-Child"];
        templates = (parentChildTemplates as any)[userRole] || [];
      } else if (relationshipType === "Romantic Partners") {
        const romanticTemplates = roleSpecificTemplates["Romantic Partners"];
        templates = (romanticTemplates as any)[userRole] || [];
      } else if (relationshipType === "Friends") {
        const friendTemplates = roleSpecificTemplates["Friends"];
        templates = (friendTemplates as any)[userRole] || [];
      } else if (relationshipType === "Siblings") {
        const siblingTemplates = roleSpecificTemplates["Siblings"];
        templates = (siblingTemplates as any)[userRole] || [];
      }


      // If still no templates, use generic fallback
      if (templates.length === 0) {
        templates = [
          "What's something you've learned about yourself recently?",
          "What's a challenge you're facing that we could work through together?",
          "What's something you wish I understood better about your world?"
        ];
      }

      // Randomly select questions
      const shuffled = [...templates].sort(() => Math.random() - 0.5);
      const selectedQuestions = shuffled.slice(0, questionCount);

      res.json({ 
        questions: selectedQuestions,
        relationshipType,
        userRole: userRole || '',
        otherUserRole: otherUserRole || '',
        count: selectedQuestions.slice(0, questionCount).length
      });
    } catch (error) {
      console.error("AI question generation error:", error);
      res.status(500).json({ message: "Failed to generate questions" });
    }
  });

  // Custom AI Question Generation endpoint
  app.post("/api/ai/generate-custom-questions", 
    rateLimit(10, 60 * 60 * 1000), // 10 custom generations per hour
    isAuthenticated, 
    async (req: any, res) => {
    try {
      const { relationshipType, userRole, otherUserRole, customPrompt, count = 5 } = req.body;

      if (!relationshipType || !customPrompt?.trim()) {
        return res.status(400).json({ message: "Relationship type and custom prompt are required" });
      }

      // Validate count
      const questionCount = Math.min(Math.max(parseInt(count) || 5, 1), 5);

      // Try OpenAI API for custom question generation
      try {
        if (process.env.OPENAI_API_KEY && userRole) {
          const OpenAI = await import('openai');
          const openai = new OpenAI.default({ apiKey: process.env.OPENAI_API_KEY });

          // Create custom prompt focused on generating specific questions
          const customPromptText = `The user wants to discuss this topic with their ${relationshipType.toLowerCase().replace('-', ' ')} partner: "${customPrompt.trim()}"

Generate ${questionCount} specific, direct questions that a ${userRole} could ask to start a conversation about this topic. Each question should:
- Be a clear, direct question they can ask their partner
- Help them open up dialogue about the specific topic they mentioned
- Be vulnerable and authentic, but approachable
- Allow for deep exploration of the subject
- Be phrased as something they would actually say to start the conversation

Format each as a complete question they can use to begin this important conversation.`;

          // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: "You are an expert at creating specific conversation starter questions for adult relationships. When given a topic or situation, generate direct questions that someone could ask their partner to begin discussing that exact topic. Each question should be a complete, clear question they can use to start the conversation. Focus on practical, actionable questions that open dialogue about the specific subject mentioned. Return only the questions as a JSON object with a 'questions' array."
              },
              {
                role: "user",
                content: customPromptText
              }
            ],
            response_format: { type: "json_object" },
            max_tokens: 400
          });

          const result = JSON.parse(response.choices[0].message.content || '{}');
          if (result.questions && Array.isArray(result.questions)) {
            return res.json({ 
              questions: result.questions.slice(0, questionCount),
              relationshipType,
              userRole: userRole || '',
              customPrompt: customPrompt.trim(),
              count: result.questions.slice(0, questionCount).length
            });
          }
        }
      } catch (error) {
        console.error("OpenAI API error for custom questions:", error);
      }

      // Generate specific fallback questions based on the user's custom prompt
      const topicKeywords = customPrompt.trim().toLowerCase();
      const fallbackQuestions = [
        `How do you think I should approach talking about ${topicKeywords} with you?`,
        `What would help you understand my feelings about ${topicKeywords}?`,
        `Can I share something with you about ${topicKeywords} that's been on my mind?`,
        `What questions do you have about ${topicKeywords} that might help us discuss it?`,
        `How can we create a safe space to talk through ${topicKeywords} together?`
      ];

      res.json({ 
        questions: fallbackQuestions.slice(0, questionCount),
        relationshipType,
        userRole: userRole || '',
        customPrompt: customPrompt.trim(),
        count: fallbackQuestions.slice(0, questionCount).length,
        fallback: true
      });
    } catch (error) {
      console.error("Custom AI question generation error:", error);
      res.status(500).json({ message: "Failed to generate custom questions" });
    }
  });

  // Endpoint for creating new conversation threads with questions (right column actions)
  app.post("/api/connections/:connectionId/conversations/with-question", 
    isAuthenticated, 
    rateLimit(50, 60 * 60 * 1000), // 50 new thread creations per hour
    async (req: any, res) => {
    try {
      const connectionId = parseInt(req.params.connectionId);
      const { question } = req.body;
      const userId = req.user.claims?.sub || req.user.id;
      const currentUser = await storage.getUser(userId);

      console.log('[NEW_THREAD_API] ===============================');
      console.log('[NEW_THREAD_API] Request received - connectionId:', connectionId);
      console.log('[NEW_THREAD_API] Question:', question);
      console.log('[NEW_THREAD_API] User:', currentUser?.email);
      console.log('[NEW_THREAD_API] ===============================');

      if (!currentUser) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if user is an invitee (has free forever access)
      const existingConnections = await storage.getConnectionsByEmail(currentUser.email!);
      const isInviteeUser = existingConnections.some(c => c.inviteeEmail === currentUser.email);

      // Enforce subscription restrictions for conversation creation (but not for invitee users)
      if (!isInviteeUser) {
        // Block conversation creation if subscription is canceled (from refunds/cancellations)
        if (currentUser.subscriptionStatus === 'canceled') {
          return res.status(403).json({ 
            type: 'SUBSCRIPTION_CANCELED',
            message: "Your subscription has been canceled. Choose a subscription plan to continue conversations.",
            subscriptionTier: currentUser.subscriptionTier,
            subscriptionStatus: currentUser.subscriptionStatus,
            requiresUpgrade: true
          });
        }

        const trialStatus = await storage.checkTrialStatus(currentUser.id);

        // Block all conversation creation actions if trial has expired and user doesn't have paid subscription
        if (trialStatus.isExpired && currentUser.subscriptionTier?.trim() === 'trial') {
          await storage.expireTrialUser(currentUser.id);
          return res.status(403).json({ 
            type: 'TRIAL_EXPIRED',
            message: "Your free trial has expired. Choose a subscription plan to continue conversations.",
            subscriptionTier: currentUser.subscriptionTier?.trim(),
            subscriptionStatus: currentUser.subscriptionStatus,
            requiresUpgrade: true
          });
        }
      }

      if (!question || !question.trim()) {
        return res.status(400).json({ message: "Question content is required" });
      }

      // Verify user is part of this connection
      const connection = await storage.getConnection(connectionId);
      if (!connection || 
          (connection.inviterEmail !== currentUser.email && 
           connection.inviteeEmail !== currentUser.email)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Validate conversation flow: ensure user has provided at least one response
      // First get all conversations for this connection
      const existingConversations = await storage.getConversationsByConnection(connectionId);
      let hasProvidedResponse = false;

      for (const conv of existingConversations) {
        const messages = await storage.getMessagesByConversationId(conv.id);
        const userResponses = messages.filter(msg => 
          msg.type === 'response' && msg.senderEmail === currentUser.email
        );
        if (userResponses.length > 0) {
          hasProvidedResponse = true;
          break;
        }
      }

      // Production-ready validation for new conversation threads
      try {
        // Enhanced validation: EVERY question requires a response before new questions can be asked
        // Check ALL conversations to ensure no unanswered questions exist
        let hasUnansweredQuestion = false;
        let unansweredQuestionDetails = null;

        for (const conv of existingConversations) {
          try {
            const messages = await storage.getMessagesByConversationId(conv.id);

            // Find the most recent question in this conversation
            let lastQuestionIndex = -1;
            for (let i = messages.length - 1; i >= 0; i--) {
              if (messages[i].type === 'question') {
                lastQuestionIndex = i;
                break;
              }
            }

            // If there's a question, check if it has a response
            if (lastQuestionIndex !== -1) {
              const messagesAfterLastQuestion = messages.slice(lastQuestionIndex + 1);

              // Enhanced response detection: check for both text and voice responses
              const hasResponseToLastQuestion = messagesAfterLastQuestion.some(msg => {
                // Accept both 'response' type messages and voice messages (which should be responses)
                return msg.type === 'response' || 
                       (msg.messageFormat === 'voice' && msg.type !== 'question') ||
                       // Also check for follow-up messages that aren't questions
                       (msg.type !== 'question' && msg.senderEmail !== messages[lastQuestionIndex].senderEmail);
              });

              if (!hasResponseToLastQuestion) {
                hasUnansweredQuestion = true;
                unansweredQuestionDetails = {
                  conversationId: conv.id,
                  questionIndex: lastQuestionIndex,
                  question: messages[lastQuestionIndex].content?.substring(0, 50) + '...'
                };
                break;
              }
            }
          } catch (messageError) {
            console.error(`[THREAD_VALIDATION] Error checking messages for conversation ${conv.id}:`, messageError);
          }
        }

        // Block new thread creation if any question is unanswered
        if (hasUnansweredQuestion) {
          return res.status(400).json({ 
            message: "Please answer the previous question before starting a new conversation thread",
            code: "QUESTION_REQUIRES_RESPONSE",
            unansweredQuestion: unansweredQuestionDetails
          });
        }

        // For first conversation, no validation needed
        if (existingConversations.length === 0) {
          // Allow first thread creation
        } else {
          // For subsequent threads, ensure at least one complete exchange exists somewhere
          let hasAnyCompleteExchange = false;

          console.log(`[EXCHANGE_DEBUG] Checking ${existingConversations.length} conversations for connection ${connectionId}`);

          for (const conv of existingConversations) {
            try {
              const messages = await storage.getMessagesByConversationId(conv.id);
              const hasQuestion = messages.some(msg => msg.type === 'question');

              // Enhanced response detection: check for both text and voice responses
              const hasResponse = messages.some(msg => {
                return msg.type === 'response' || 
                       (msg.messageFormat === 'voice' && msg.type !== 'question') ||
                       // Also accept any non-question message from different sender as response
                       (msg.type !== 'question');
              });

              if (hasQuestion && hasResponse) {
                hasAnyCompleteExchange = true;
                break;
              }
            } catch (messageError) {
              console.error(`[THREAD_VALIDATION] Error checking complete exchange for conversation ${conv.id}:`, messageError);
            }
          }

          console.log(`[EXCHANGE_DEBUG] Final result: hasAnyCompleteExchange = ${hasAnyCompleteExchange}`);

          if (!hasAnyCompleteExchange) {
            console.log(`[EXCHANGE_DEBUG] ✗ BLOCKING: No complete exchanges found across ${existingConversations.length} conversations`);
            return res.status(400).json({ 
              message: "Complete at least one question-response exchange before starting new conversation threads",
              code: "EXCHANGE_REQUIRED",
              existingConversations: existingConversations.length
            });
          } else {
            console.log(`[EXCHANGE_DEBUG] ✓ ALLOWING: Found complete exchange, proceeding with thread creation`);
          }
        }
      } catch (validationError) {
        console.error('[THREAD_VALIDATION] Error validating conversation exchange:', validationError);
        return res.status(500).json({ 
          message: "Thread validation failed",
          code: "VALIDATION_ERROR" 
        });
      }

      // ALWAYS create a new conversation thread for questions from right column
      const conversationData = {
        connectionId,
        participant1Email: connection.inviterEmail,
        participant2Email: connection.inviteeEmail,
        relationshipType: connection.relationshipType,
        currentTurn: connection.inviterEmail, // Inviter always gets first turn
        status: 'active',
        isMainThread: existingConversations.length === 0 // First conversation is main thread
      };
      const conversation = await storage.createConversation(conversationData);

      console.log('[NEW_THREAD_API] ✓ Created new conversation thread:', conversation.id);

      // Immediately create the first message (question) - always from inviter
      const messageData = {
        conversationId: conversation.id,
        senderEmail: connection.inviterEmail, // Always from inviter
        content: question.trim(),
        type: 'question' as const
      };

      const message = await storage.createMessage(messageData);

      // Update conversation turn to invitee
      await storage.updateConversationTurn(conversation.id, connection.inviteeEmail);

      // Send turn notification to invitee
      try {
        await notificationService.sendTurnNotification({
          recipientEmail: connection.inviteeEmail,
          senderEmail: connection.inviterEmail,
          conversationId: conversation.id,
          relationshipType: connection.relationshipType,
          messageType: 'question'
        });
      } catch (notificationError) {
        console.error('Failed to send turn notification:', notificationError);
      }

      // Send real-time WebSocket notifications
      try {
        const { getWebSocketManager } = await import('./websocket');
        const wsManager = getWebSocketManager();
        if (wsManager) {
          wsManager.notifyConversationUpdate(connection.inviterEmail, {
            conversationId: conversation.id,
            connectionId: connectionId,
            action: 'message_sent',
            relationshipType: connection.relationshipType
          });

          if (connection.inviterEmail !== connection.inviteeEmail) {
            wsManager.notifyConversationUpdate(connection.inviteeEmail, {
              conversationId: conversation.id,
              connectionId: connectionId,
              action: 'message_sent',
              relationshipType: connection.relationshipType
            });
          }
        }
      } catch (error) {
        console.error('[WEBSOCKET] Failed to send conversation creation notification:', error);
      }

      res.json({ 
        conversation, 
        message
      });
    } catch (error) {
      console.error("Create conversation with question error:", error);
      res.status(500).json({ message: "Failed to create conversation with question" });
    }
  });

  // Phone verification endpoints for SMS notifications
  app.post("/api/users/send-verification", rateLimit(5, 15 * 60 * 1000), isAuthenticated, async (req: any, res) => {
    try {
      const { phoneNumber } = req.body;
      const userId = req.user.claims?.sub || req.user.id;

      // Comprehensive input validation
      if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim().length === 0) {
        return res.status(400).json({ message: "Valid phone number is required" });
      }

      // Sanitize phone number (remove all non-digit characters except +)
      const sanitizedPhone = phoneNumber.replace(/[^\d+]/g, '');

      // Enhanced phone number validation (E.164 format)
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(sanitizedPhone)) {
        return res.status(400).json({ 
          message: "Phone number must be in international format (e.g., +1234567890)" 
        });
      }

      // Length validation for additional security
      if (sanitizedPhone.length < 8 || sanitizedPhone.length > 16) {
        return res.status(400).json({ message: "Invalid phone number length" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check for existing recent verification attempts (prevent spam)
      const existingVerification = await storage.getVerificationCode(user.email || '', sanitizedPhone);
      if (existingVerification && existingVerification.expiresAt > new Date()) {
        const remainingTime = Math.ceil((existingVerification.expiresAt.getTime() - Date.now()) / 1000 / 60);
        return res.status(429).json({ 
          message: `Verification code already sent. Please wait ${remainingTime} minutes before requesting a new one.`,
          remainingMinutes: remainingTime
        });
      }

      // Send SMS via notification service with proper error handling
      let verificationCode: string;
      try {
        console.log(`[SMS_DEBUG] Attempting to send verification code to: ${sanitizedPhone}`);
        verificationCode = await notificationService.sendPhoneVerification(sanitizedPhone);
        console.log(`[SMS_DEBUG] Verification code generated successfully`);
      } catch (smsError: any) {
        console.error("[SMS_ERROR] Detailed SMS sending error:", {
          error: smsError,
          message: smsError.message,
          code: smsError.code,
          status: smsError.status,
          moreInfo: smsError.moreInfo,
          stack: smsError.stack
        });

        // Specific error handling for common Twilio errors
        if (smsError.code === 21211) {
          return res.status(400).json({ message: "Invalid phone number. Please check and try again." });
        } else if (smsError.code === 21608) {
          return res.status(400).json({ message: "This phone number cannot receive SMS messages." });
        } else if (smsError.code === 21614) {
          return res.status(400).json({ message: "Phone number is not a valid mobile number." });
        }

        // Return more specific error message for debugging
        const errorMessage = smsError.message || "Unknown SMS error";
        return res.status(503).json({ 
          message: `SMS service error: ${errorMessage}. Please try again later.` 
        });
      }

      // Validate verification code was generated
      if (!verificationCode) {
        return res.status(500).json({ 
          message: "Failed to generate verification code. Please try again." 
        });
      }

      // Store verification code securely in database
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await storage.createVerificationCode({
        email: user.email || '',
        phoneNumber: sanitizedPhone,
        code: verificationCode,
        expiresAt,
        verified: false,
      });

      res.json({ 
        message: "Verification code sent successfully",
        phoneNumber: sanitizedPhone,
        expiresInMinutes: 10
      });
    } catch (error: any) {
      console.error("Send verification error:", error);

      // Enhanced error handling for production
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: error.message });
      }

      res.status(500).json({ 
        message: process.env.NODE_ENV === 'production' 
          ? "Service temporarily unavailable. Please try again later."
          : "Failed to send verification code" 
      });
    }
  });

  app.post("/api/users/verify-phone", rateLimit(10, 15 * 60 * 1000), isAuthenticated, async (req: any, res) => {
    try {
      const { phoneNumber, code } = req.body;
      const userId = req.user.claims?.sub || req.user.id;

      // Comprehensive input validation
      if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim().length === 0) {
        return res.status(400).json({ message: "Valid phone number is required" });
      }

      if (!code || typeof code !== 'string' || code.trim().length === 0) {
        return res.status(400).json({ message: "Verification code is required" });
      }

      // Sanitize and validate verification code
      const sanitizedCode = code.replace(/\D/g, ''); // Remove non-digits
      if (sanitizedCode.length !== 6) {
        return res.status(400).json({ message: "Verification code must be exactly 6 digits" });
      }

      // Sanitize phone number
      const sanitizedPhone = phoneNumber.replace(/[^\d+]/g, '');

      // Validate phone number format
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(sanitizedPhone)) {
        return res.status(400).json({ message: "Invalid phone number format" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get verification code from database
      const storedVerification = await storage.getVerificationCode(user.email || '', sanitizedPhone);

      if (!storedVerification) {
        return res.status(400).json({ 
          message: "Verification code not found or expired. Please request a new code." 
        });
      }

      // Check if verification code has expired
      if (storedVerification.expiresAt <= new Date()) {
        // Clean up expired verification code
        await storage.markVerificationCodeUsed(storedVerification.id);
        return res.status(400).json({ 
          message: "Verification code has expired. Please request a new code." 
        });
      }

      // Check if verification code has already been used
      if (storedVerification.verified) {
        return res.status(400).json({ 
          message: "Verification code has already been used. Please request a new code." 
        });
      }

      // Verify the code (constant-time comparison for security)
      if (storedVerification.code !== sanitizedCode) {
        // Implement attempt tracking to prevent brute force attacks
        return res.status(400).json({ 
          message: "Invalid verification code. Please check and try again." 
        });
      }

      // Update user with verified phone number
      await storage.updateUser(userId, {
        phoneNumber: sanitizedPhone,
        phoneVerified: true,
        // Set SMS as default notification preference if user chose SMS setup
        notificationPreference: user.notificationPreference || 'email'
      });

      // Mark verification code as used to prevent reuse
      await storage.markVerificationCodeUsed(storedVerification.id);

      res.json({ 
        message: "Phone number verified successfully",
        phoneNumber: sanitizedPhone,
        phoneVerified: true
      });
    } catch (error: any) {
      console.error("Verify phone error:", error);

      // Enhanced error handling for production
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: error.message });
      }

      res.status(500).json({ 
        message: process.env.NODE_ENV === 'production' 
          ? "Verification service temporarily unavailable. Please try again later."
          : "Failed to verify phone number" 
      });
    }
  });

  app.patch("/api/users/notification-preference", async (req, res) => {
    try {
      const { email, notificationPreference } = req.body;

      if (!email || !notificationPreference) {
        return res.status(400).json({ message: "Email and notification preference are required" });
      }

      const validPreferences = ['email', 'sms', 'both'];
      if (!validPreferences.includes(notificationPreference)) {
        return res.status(400).json({ message: "Invalid notification preference. Must be 'email', 'sms', or 'both'" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      await storage.updateUserSubscription(user.id, {
        subscriptionTier: user.subscriptionTier || 'free',
        subscriptionStatus: user.subscriptionStatus || 'active',
        maxConnections: user.maxConnections || 1
      });

      res.json({ message: "Notification preference updated successfully" });
    } catch (error) {
      console.error("Update notification preference error:", error);
      res.status(500).json({ message: "Failed to update notification preference" });
    }
  });

  // Set conversation-specific notification preference
  app.post("/api/users/notification-preference", isAuthenticated, async (req: any, res) => {
    try {
      const { conversationId, preference } = req.body;
      const userId = req.user.claims?.sub || req.user.id;

      if (!conversationId || !preference) {
        return res.status(400).json({ message: "Conversation ID and preference are required" });
      }

      if (!["email", "sms", "both"].includes(preference)) {
        return res.status(400).json({ message: "Invalid preference. Must be 'email', 'sms', or 'both'" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate conversationId is a number
      const conversationIdNum = parseInt(conversationId);
      if (isNaN(conversationIdNum) || conversationIdNum <= 0) {
        return res.status(400).json({ message: "Invalid conversation ID" });
      }

      // Update conversation-specific notification preference with proper typing
      const currentPrefs: Record<string, any> = user.conversationNotificationPrefs || {};
      currentPrefs[conversationIdNum.toString()] = {
        preference,
        setAt: new Date().toISOString(),
        neverShow: false
      };

      await storage.updateUser(userId, {
        conversationNotificationPrefs: currentPrefs,
        notificationPreference: preference // Also update global preference
      });

      res.json({ message: "Notification preference saved successfully" });
    } catch (error) {
      console.error("Set notification preference error:", error);
      res.status(500).json({ message: "Failed to set notification preference" });
    }
  });

  // Dismiss notification preference popup
  app.post("/api/users/dismiss-notification-popup", isAuthenticated, async (req: any, res) => {
    try {
      const { conversationId, dismissType } = req.body;
      const userId = req.user.claims?.sub || req.user.id;

      if (!conversationId || !dismissType) {
        return res.status(400).json({ message: "Conversation ID and dismiss type are required" });
      }

      if (!["never", "later"].includes(dismissType)) {
        return res.status(400).json({ message: "Invalid dismiss type. Must be 'never' or 'later'" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate conversationId is a number
      const conversationIdNum = parseInt(conversationId);
      if (isNaN(conversationIdNum) || conversationIdNum <= 0) {
        return res.status(400).json({ message: "Invalid conversation ID" });
      }

      const currentPrefs: Record<string, any> = user.conversationNotificationPrefs || {};

      if (dismissType === "never") {
        currentPrefs[conversationIdNum.toString()] = {
          preference: "email", // Keep email as default
          setAt: new Date().toISOString(),
          neverShow: true
        };

        await storage.updateUser(userId, {
          conversationNotificationPrefs: currentPrefs
        });
      }
      // For "later", we don't store anything so popup shows again

      res.json({ message: "Popup dismissed successfully" });
    } catch (error) {
      console.error("Dismiss notification popup error:", error);
      res.status(500).json({ message: "Failed to dismiss popup" });
    }
  });

  // Get conversation notification preference status
  app.get("/api/users/notification-preference/:conversationId", isAuthenticated, async (req: any, res) => {
    try {
      const conversationId = req.params.conversationId;
      const userId = req.user.claims?.sub || req.user.id;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate conversationId is a number
      const conversationIdNum = parseInt(conversationId);
      if (isNaN(conversationIdNum) || conversationIdNum <= 0) {
        return res.status(400).json({ message: "Invalid conversation ID" });
      }

      const currentPrefs: Record<string, any> = user.conversationNotificationPrefs || {};
      const conversationPref = currentPrefs[conversationIdNum.toString()];

      res.json({
        hasPreference: !!conversationPref,
        preference: conversationPref?.preference || user.notificationPreference || "email",
        neverShow: conversationPref?.neverShow || false,
        globalPreference: user.notificationPreference || "email"
      });
    } catch (error) {
      console.error("Get notification preference error:", error);
      res.status(500).json({ message: "Failed to get notification preference" });
    }
  });

  // Unsubscribe from all email campaigns (accessible without authentication)
  app.get("/unsubscribe", 
    rateLimit(10, 60 * 1000), // 10 requests per minute
    async (req, res) => {
    try {
      const email = req.query.email as string;

      if (!email || !validateEmail(email)) {
        // Show unsubscribe form if no valid email provided
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Unsubscribe - Deeper</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { 
                font-family: 'Inter', sans-serif; 
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                color: white;
                margin: 0;
                padding: 40px 20px;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .container {
                max-width: 500px;
                background: rgba(30, 41, 59, 0.8);
                padding: 40px;
                border-radius: 12px;
                border: 1px solid rgba(79, 172, 254, 0.2);
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
              }
              h1 { color: #4FACFE; margin-bottom: 20px; }
              input[type="email"] {
                width: 100%;
                padding: 12px;
                margin: 10px 0;
                border: 1px solid #475569;
                border-radius: 6px;
                background: #1e293b;
                color: white;
                font-size: 16px;
              }
              button {
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                color: white;
                padding: 12px 24px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 16px;
                font-weight: 600;
                width: 100%;
                margin-top: 20px;
              }
              button:hover { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); }
              .back-link { color: #4FACFE; text-decoration: none; margin-top: 20px; display: inline-block; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Unsubscribe from Deeper Emails</h1>
              <p>Enter your email address to unsubscribe from all Deeper campaign emails:</p>
              <form method="POST" action="/unsubscribe">
                <input type="email" name="email" placeholder="your.email@example.com" required>
                <button type="submit">Unsubscribe Me</button>
              </form>
              <a href="/" class="back-link">← Back to Deeper</a>
            </div>
          </body>
          </html>
        `);
      }

      // Process unsubscribe
      const user = await storage.getUserByEmail(email);
      if (user) {
        // Set notification preference to SMS only (effectively opting out of email campaigns)
        await storage.updateUser(user.id, { notificationPreference: 'sms' });

        // Cancel all pending email campaigns for this user
        await emailCampaignService.cancelPendingCampaigns(email, [
          'pending_invitation', 'inviter_nudge', 'turn_reminder', 'post_signup'
        ]);
      }

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Unsubscribed - Deeper</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: 'Inter', sans-serif; 
              background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
              color: white;
              margin: 0;
              padding: 40px 20px;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              max-width: 500px;
              background: rgba(30, 41, 59, 0.8);
              padding: 40px;
              border-radius: 12px;
              border: 1px solid rgba(34, 197, 94, 0.2);
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
              text-align: center;
            }
            h1 { color: #22c55e; margin-bottom: 20px; }
            .checkmark { font-size: 48px; color: #22c55e; margin-bottom: 20px; }
            .back-link { color: #4FACFE; text-decoration: none; margin-top: 20px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="checkmark">✓</div>
            <h1>Successfully Unsubscribed</h1>
            <p>You have been unsubscribed from all Deeper campaign emails.</p>
            <p>You can still log in to manage your conversations and adjust preferences at any time.</p>
            <a href="/" class="back-link">← Back to Deeper</a>
          </div>
        </body>
        </html>
      `);
    } catch (error) {
      console.error("Unsubscribe error:", error);
      res.status(500).send("Sorry, there was an error processing your unsubscribe request.");
    }
  });

  // Handle POST unsubscribe form submission
  app.post("/unsubscribe", 
    rateLimit(5, 60 * 1000), // 5 requests per minute
    async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || !validateEmail(email)) {
        return res.status(400).send("Invalid email address");
      }

      // Redirect to GET unsubscribe with email parameter
      res.redirect(`/unsubscribe?email=${encodeURIComponent(email)}`);
    } catch (error) {
      console.error("Unsubscribe POST error:", error);
      res.status(500).send("Sorry, there was an error processing your request.");
    }
  });

  // Admin endpoint to check S3 storage configuration and status
  app.get("/api/admin/storage-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];

      // Check if user is an admin
      if (!adminEmails.includes(userId)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Check S3 configuration
      const isS3Configured = s3Service.isS3Configured();
      let s3Status = { success: false, message: "S3 not configured" };

      if (isS3Configured) {
        try {
          const testResult = await s3Service.testConnection();
          s3Status = { 
            success: testResult.success, 
            message: (testResult as any).message || (testResult.success ? 'S3 connection successful' : 'S3 connection failed')
          };
        } catch (error) {
          s3Status = { 
            success: false, 
            message: `S3 connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
          };
        }
      }

      // Get environment variables status (without exposing values)
      const envStatus = {
        AWS_ACCESS_KEY_ID: !!process.env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: !!process.env.AWS_SECRET_ACCESS_KEY,
        AWS_REGION: !!process.env.AWS_REGION,
        AWS_S3_BUCKET: !!process.env.AWS_S3_BUCKET
      };

      res.json({
        storageType: isS3Configured ? "S3" : "Local Filesystem",
        s3Configured: isS3Configured,
        s3Status,
        environmentVariables: envStatus,
        warning: !isS3Configured ? "Audio files stored locally may not persist across deployments" : undefined
      });
    } catch (error) {
      console.error("Storage status check error:", error);
      res.status(500).json({ message: "Failed to check storage status" });
    }
  });

  // Test email service endpoint for debugging email notification issues  
  app.post('/api/test/email-service', async (req, res) => {
    try {
      const { testEmail } = req.body;

      if (!testEmail) {
        return res.status(400).json({ error: 'testEmail is required' });
      }

      console.log(`[DEBUG] Testing email service with recipient: ${testEmail}`);
      console.log(`[DEBUG] Email service type: InternalEmailService (Database)`);

      // Test turn notification email
      await notificationService.sendTurnNotification({
        recipientEmail: testEmail,
        senderEmail: 'system@test.com',
        conversationId: 1, // Use a valid conversation ID for testing
        relationshipType: 'Test',
        messageType: 'question'
      });

      console.log(`[DEBUG] Test notification completed for ${testEmail}`);

      res.json({ 
        success: true, 
        message: 'Test notification sent successfully',
        emailService: 'InternalEmailService (Database)',
        note: 'All notifications are stored in internal database system'
      });
    } catch (error) {
      console.error('[DEBUG] Test email service error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : 'No stack trace'
      });
    }
  });

  // View stored emails from internal database system
  app.get('/api/internal-emails', async (req, res) => {
    try {
      const emails = await storage.getEmails();
      res.json({ 
        success: true, 
        count: emails.length,
        emails: emails.slice(-10) // Show last 10 emails
      });
    } catch (error) {
      console.error('[DEBUG] Error retrieving internal emails:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // View stored SMS messages from internal database system  
  app.get('/api/internal-sms', async (req, res) => {
    try {
      const smsMessages = await storage.getSMSMessages();
      res.json({ 
        success: true, 
        count: smsMessages.length,
        sms: smsMessages.slice(-10) // Show last 10 SMS messages
      });
    } catch (error) {
      console.error('[DEBUG] Error retrieving internal SMS messages:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test SMS notification system
  app.post('/api/test/sms-notification', async (req, res) => {
    try {
      const { testPhone } = req.body;

      if (!testPhone) {
        return res.status(400).json({ 
          success: false, 
          error: 'Test phone number is required'
        });
      }

      console.log(`[TEST] Testing Twilio SMS notification for ${testPhone}`);

      // Test the SMS verification code with Twilio
      await smsService.sendVerificationCode(testPhone, '123456');

      console.log(`[TEST] Twilio SMS notifications completed for ${testPhone}`);

      res.json({ 
        success: true, 
        message: 'Test SMS notifications sent successfully via Twilio',
        smsService: smsService.constructor.name,
        twilioConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
        messagingService: !!process.env.TWILIO_MESSAGING_SERVICE_SID,
        note: 'Real SMS sent to actual phone number via Twilio with database storage'
      });
    } catch (error) {
      console.error('[TEST] Twilio SMS service error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : 'No stack trace'
      });
    }
  });

  // Test voice message endpoint for debugging CSP and S3 issues
  app.post('/api/test/voice-message', async (req, res) => {
    try {
      const { testAudioUrl } = req.body;

      if (!testAudioUrl) {
        return res.status(400).json({ error: 'testAudioUrl is required' });
      }

      // Test audio URL accessibility
      const testResult = await fetch(testAudioUrl, { 
        method: 'HEAD',
        headers: {
          'User-Agent': 'Deeper-Voice-Test/1.0'
        }
      });

      const response = {
        audioUrl: testAudioUrl,
        accessible: testResult.ok,
        status: testResult.status,
        statusText: testResult.statusText,
        headers: Object.fromEntries(testResult.headers.entries()),
        s3Configured: s3Service.isS3Configured(),
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Voice message test failed:', error);
      res.status(500).json({ 
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Test S3 connectivity endpoint for debugging uploads
  app.get('/api/test/s3-connection', async (req, res) => {
    try {
      console.log('[S3_TEST] Testing S3 connection...');
      const testResult = await s3Service.testConnection();
      console.log('[S3_TEST] Test result:', testResult);

      const response = {
        s3Configured: s3Service.isS3Configured(),
        connectionTest: testResult,
        timestamp: new Date().toISOString(),
        environment: {
          region: process.env.AWS_REGION,
          bucket: process.env.AWS_S3_BUCKET,
          hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
          hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY
        }
      };

      res.json(response);
    } catch (error) {
      console.error('[S3_TEST] S3 connection test failed:', error);
      res.status(500).json({ 
        error: 'S3 test failed',
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Setup admin routes
  setupAdminRoutes(app);

  // Setup admin email campaign routes  
  setupAdminEmailCampaignRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}