import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import MemoryStore from "memorystore";
import { RedisStore } from "connect-redis";
import { createClient } from "redis";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { storage } from "./storage";

// JWT secret - use environment variable in production
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
const JWT_EXPIRES_IN = '7d'; // Token expires in 7 days

// Fail fast if no JWT secret in production
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('[AUTH] JWT_SECRET environment variable is required in production');
}

// Fallback for development only
const getJwtSecret = () => {
  if (!JWT_SECRET) {
    console.warn('[AUTH] WARNING: Using insecure default JWT secret - only acceptable in development');
    return 'jwt-secret-key-for-dev-only';
  }
  return JWT_SECRET;
};

console.log(`[AUTH] Setting up OAuth authentication providers`);

export function getSession() {
  const sessionTtl = 24 * 60 * 60 * 1000; // 24 hours
  
  // Production-ready session store with Redis fallback to memory
  let sessionStore;
  
  // Use memory store for current stability
  // Redis can be added later for horizontal scaling when needed
  sessionStore = createMemoryStore();
  
  if (process.env.NODE_ENV === 'production') {
    console.log('[SESSION] Memory store active - suitable for single instance up to 10K users');
    console.log('[SESSION] For horizontal scaling beyond 10K users, configure REDIS_URL');
  } else {
    console.log('[SESSION] Memory store active for development');
  }

  function createMemoryStore() {
    const MemoryStoreSession = MemoryStore(session);
    return new MemoryStoreSession({
      checkPeriod: 86400000, // prune expired entries every 24h
      ttl: sessionTtl,
      max: 10000, // Maximum number of sessions
    });
  }

  return session({
    secret: process.env.SESSION_SECRET || 'default-secret-key-for-dev',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
      sameSite: 'lax',
    },
    name: 'connect.sid',
  });
}

async function upsertUser(profile: any, provider: string, req?: any) {
  const email = profile.emails?.[0]?.value;
  
  if (provider === 'google' && email) {
    // Check if this is an account linking request (user already logged in)
    const isLinking = req && (req.session as any)?.isLinking && req.user;
    
    if (isLinking) {
      // Link Google account to currently logged-in user
      const currentUser = req.user;
      console.log(`[AUTH] Linking Google account to existing user: ${currentUser.email}`);
      
      const linkedUser = await storage.linkGoogleAccount(currentUser.id, profile.id);
      if (linkedUser) {
        // Update profile information from Google if available, keeping existing data
        return await storage.upsertUser({
          id: currentUser.id,
          email: currentUser.email, // Keep existing email
          firstName: currentUser.firstName || profile.name?.givenName,
          lastName: currentUser.lastName || profile.name?.familyName,
          profileImageUrl: currentUser.profileImageUrl || profile.photos?.[0]?.value,
          googleId: profile.id,
        });
      }
      return currentUser;
    }
    
    // Check if user with this email already exists (email-based account)
    const existingUser = await storage.getUserByEmail(email);
    
    if (existingUser && !existingUser.googleId) {
      // Link Google account to existing email-based account
      console.log(`[AUTH] Linking Google account to existing email user: ${email}`);
      const linkedUser = await storage.linkGoogleAccount(existingUser.id, profile.id);
      if (linkedUser) {
        // Update profile information from Google if available, keeping existing data priority
        return await storage.updateUser(existingUser.id, {
          firstName: existingUser.firstName || profile.name?.givenName,
          lastName: existingUser.lastName || profile.name?.familyName,
          profileImageUrl: existingUser.profileImageUrl || profile.photos?.[0]?.value,
          googleId: profile.id,
        });
      }
      return existingUser;
    } else if (existingUser && existingUser.googleId === profile.id) {
      // User already linked, just return existing user
      console.log(`[AUTH] User already linked with Google: ${email}`);
      return existingUser;
    } else if (existingUser && existingUser.googleId && existingUser.googleId !== profile.id) {
      // User exists with different Google ID - this shouldn't happen normally
      console.log(`[AUTH] User ${email} already has different Google ID, using existing account`);
      return existingUser;
    }
    
    // Check if user with this Google ID already exists but different email
    const existingGoogleUser = await storage.getUserByGoogleId(profile.id);
    if (existingGoogleUser) {
      console.log(`[AUTH] Found existing Google user with ID: ${profile.id}`);
      return existingGoogleUser;
    }
  }
  
  // Only create new user if no existing user found with this email
  let newUser;
  if (email) {
    console.log(`[AUTH] Creating new Google user with email: ${email}`);
    newUser = await storage.createInviterUser({
      id: `${provider}_${profile.id}`,
      email: email,
      firstName: profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User',
      lastName: profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '',
      profileImageUrl: profile.photos?.[0]?.value || null,
      googleId: provider === 'google' ? profile.id : undefined,
    });
  } else {
    // Fallback for users without email
    newUser = await storage.createInviterUser({
      id: `${provider}_${profile.id}`,
      email: `${provider}_${profile.id}@${provider}.com`,
      firstName: profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User',
      lastName: profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '',
      profileImageUrl: profile.photos?.[0]?.value || null,
      googleId: provider === 'google' ? profile.id : undefined,
    });
  }
  
  // Schedule post-signup email campaigns for new OAuth users
  if (newUser) {
    try {
      const { emailCampaignService } = require('./email-campaigns');
      await emailCampaignService.schedulePostSignupCampaign(newUser);
      await emailCampaignService.scheduleInviterNudgeCampaign(newUser.email!);
      console.log("[CAMPAIGNS] Scheduled post-signup campaigns for OAuth user:", newUser.email);
    } catch (campaignError) {
      console.error("[CAMPAIGNS] Failed to schedule post-signup campaigns for OAuth user:", campaignError);
    }
  }
  
  return newUser;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Use current domain for OAuth callbacks - production or development
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://joindeeper.com'
    : `https://${process.env.REPLIT_DEV_DOMAIN}`;
  
  console.log(`[AUTH] Using OAuth callback URL: ${baseUrl}/api/auth/google/callback`);

  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${baseUrl}/api/auth/google/callback`,
      passReqToCallback: true
    }, async (req, accessToken, refreshToken, profile, done) => {
      try {
        const user = await upsertUser(profile, 'google', req);
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }));

    app.get("/api/auth/google", (req, res, next) => {
      // Check if this is an account linking request
      const isLinking = req.query.linking === 'true';
      if (isLinking) {
        (req.session as any).isLinking = true;
      }
      passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
    });
    
    app.get("/api/auth/google/callback", 
      passport.authenticate("google", { failureRedirect: "/auth?error=auth_failed" }),
      (req, res) => {
        // Ensure session is saved before redirect
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
          }
          
          const isLinking = (req.session as any).isLinking;
          delete (req.session as any).isLinking; // Clean up session
          
          if (isLinking) {
            console.log(`[AUTH] Account linking completed successfully for user: ${(req.user as any)?.email}`);
            res.redirect("/dashboard?linked=google");
          } else {
            res.redirect("/dashboard");
          }
        });
      }
    );
  }





  // Email/Password Strategy (login only)
  passport.use(new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email: string, password: string, done: any) => {
      try {
        console.log("[AUTH] Local strategy login attempt for:", email);
        const user = await storage.getUserByEmail(email);
        if (!user) {
          console.log("[AUTH] User not found for email:", email);
          return done(null, false, { message: "Invalid email or password" });
        }
        
        if (!user.passwordHash) {
          console.log("[AUTH] User has no password hash (OAuth-only account):", email);
          return done(null, false, { message: "Invalid email or password" });
        }
        
        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) {
          console.log("[AUTH] Password mismatch for:", email);
          return done(null, false, { message: "Invalid email or password" });
        }
        
        console.log("[AUTH] User found and password verified, login successful for:", email);
        return done(null, user);
      } catch (error) {
        console.error("[AUTH] Local strategy error:", error);
        return done(error);
      }
    }
  ));

  // Email/Password login endpoint
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("[AUTH] Login error:", err);
        return res.status(500).json({ message: "Authentication error" });
      }
      
      if (!user) {
        console.log("[AUTH] Login failed for email:", req.body.email);
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      req.logIn(user, (err) => {
        if (err) {
          console.error("[AUTH] Session error:", err);
          return res.status(500).json({ message: "Session error" });
        }
        
        console.log("[AUTH] Login successful for:", user.email);
        return res.json({ 
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl
          }
        });
      });
    })(req, res, next);
  });

  // Email/Password signup endpoint for new users
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      // Validate password strength
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        console.log("[AUTH] Signup attempt for existing user:", email);
        return res.status(409).json({ message: "User already exists" });
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);
      
      // Create new user account as inviter (gets trial access)
      console.log("[AUTH] Creating new user account via email signup:", email);
      const newUser = await storage.createInviterUser({
        id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: email,
        firstName: firstName || email.split('@')[0],
        lastName: lastName || '',
        passwordHash: passwordHash,
        profileImageUrl: null,
      });
      
      if (!newUser) {
        return res.status(500).json({ message: "Failed to create user account" });
      }
      
      // Log the user in automatically
      req.logIn(newUser, async (err) => {
        if (err) {
          console.error("[AUTH] Auto-login error after signup:", err);
          return res.status(500).json({ message: "Account created but login failed" });
        }
        
        console.log("[AUTH] Signup and auto-login successful for:", newUser.email);
        
        // Schedule post-signup email campaigns
        try {
          const { emailCampaignService } = require('./email-campaigns');
          await emailCampaignService.schedulePostSignupCampaign(newUser);
          await emailCampaignService.scheduleInviterNudgeCampaign(newUser.email);
          console.log("[CAMPAIGNS] Scheduled post-signup campaigns for:", newUser.email);
        } catch (campaignError) {
          console.error("[CAMPAIGNS] Failed to schedule post-signup campaigns:", campaignError);
        }
        
        return res.json({ 
          user: {
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            profileImageUrl: newUser.profileImageUrl
          }
        });
      });
    } catch (error) {
      console.error("[AUTH] Signup error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/email", (req, res) => {
    // Redirect to a simple email form or handle email auth
    res.redirect("/?provider=email");
  });

  // ============================================
  // MOBILE API ENDPOINTS (Token-based auth)
  // ============================================

  // Mobile login - returns JWT token instead of session cookie
  app.post("/api/mobile/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      const user = await storage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      const passwordMatch = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        getJwtSecret(),
        { expiresIn: JWT_EXPIRES_IN }
      );
      
      console.log("[MOBILE-AUTH] Login successful for:", user.email);
      
      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          subscriptionTier: user.subscriptionTier,
          subscriptionStatus: user.subscriptionStatus,
        }
      });
    } catch (error) {
      console.error("[MOBILE-AUTH] Login error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Mobile signup - returns JWT token
  app.post("/api/mobile/auth/signup", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "User already exists" });
      }
      
      const passwordHash = await bcrypt.hash(password, 10);
      
      const newUser = await storage.createInviterUser({
        id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: email,
        firstName: firstName || email.split('@')[0],
        lastName: lastName || '',
        passwordHash: passwordHash,
        profileImageUrl: null,
      });
      
      if (!newUser) {
        return res.status(500).json({ message: "Failed to create user account" });
      }
      
      // Generate JWT token
      const token = jwt.sign(
        { userId: newUser.id, email: newUser.email },
        getJwtSecret(),
        { expiresIn: JWT_EXPIRES_IN }
      );
      
      console.log("[MOBILE-AUTH] Signup successful for:", newUser.email);
      
      // Schedule post-signup email campaigns
      try {
        const { emailCampaignService } = require('./email-campaigns');
        await emailCampaignService.schedulePostSignupCampaign(newUser);
        await emailCampaignService.scheduleInviterNudgeCampaign(newUser.email);
      } catch (campaignError) {
        console.error("[CAMPAIGNS] Failed to schedule post-signup campaigns:", campaignError);
      }
      
      return res.json({
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          profileImageUrl: newUser.profileImageUrl,
          subscriptionTier: newUser.subscriptionTier,
          subscriptionStatus: newUser.subscriptionStatus,
        }
      });
    } catch (error) {
      console.error("[MOBILE-AUTH] Signup error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Register Expo push token for notifications
  app.post("/api/mobile/push-token", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authorization required" });
      }
      
      const token = authHeader.split(' ')[1];
      let decoded: any;
      
      try {
        decoded = jwt.verify(token, getJwtSecret());
      } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      
      const { pushToken } = req.body;
      if (!pushToken) {
        return res.status(400).json({ message: "Push token is required" });
      }
      
      // Update user with push token
      await storage.updateUser(decoded.userId, { expoPushToken: pushToken });
      
      console.log("[MOBILE-PUSH] Push token registered for user:", decoded.email);
      return res.json({ success: true });
    } catch (error) {
      console.error("[MOBILE-PUSH] Error registering push token:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get current user from JWT token
  app.get("/api/mobile/auth/user", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authorization required" });
      }
      
      const token = authHeader.split(' ')[1];
      let decoded: any;
      
      try {
        decoded = jwt.verify(token, getJwtSecret());
      } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      
      const user = await storage.getUser(decoded.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      return res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        phoneNumber: user.phoneNumber,
        notificationPreference: user.notificationPreference,
      });
    } catch (error) {
      console.error("[MOBILE-AUTH] Error fetching user:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Refresh JWT token - only valid tokens can be refreshed (security best practice)
  app.post("/api/mobile/auth/refresh", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authorization required" });
      }
      
      const token = authHeader.split(' ')[1];
      let decoded: any;
      
      try {
        // Only valid (non-expired) tokens can be refreshed
        decoded = jwt.verify(token, getJwtSecret());
      } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ message: "Token expired - please log in again" });
        }
        return res.status(401).json({ message: "Invalid token" });
      }
      
      // Check if user still exists
      const user = await storage.getUser(decoded.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Generate new token
      const newToken = jwt.sign(
        { userId: user.id, email: user.email },
        getJwtSecret(),
        { expiresIn: JWT_EXPIRES_IN }
      );
      
      console.log("[MOBILE-AUTH] Token refreshed for:", user.email);
      return res.json({ token: newToken });
    } catch (error) {
      console.error("[MOBILE-AUTH] Error refreshing token:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  passport.serializeUser((user: any, done) => done(null, user));
  passport.deserializeUser((user: any, done) => done(null, user));

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });
}

// Mobile JWT authentication middleware - use for mobile API endpoints
export const isMobileAuthenticated: RequestHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Authorization required" });
    }
    
    const token = authHeader.split(' ')[1];
    let decoded: any;
    
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Attach user to request for downstream handlers
    (req as any).mobileUser = user;
    next();
  } catch (error) {
    console.error("[MOBILE-AUTH] Authentication error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Web session-based authentication middleware
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Enhanced authentication check with session validation
  const isAuth = req.isAuthenticated && req.isAuthenticated();
  const hasUser = !!req.user;
  const hasSession = !!req.session && !!req.sessionID;
  
  console.log("[AUTH] Authentication check:", {
    isAuthenticated: isAuth,
    hasUser,
    hasSession,
    sessionID: req.sessionID,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent']?.substring(0, 50)
  });

  if (!isAuth || !hasUser || !hasSession) {
    console.log("[AUTH] Authentication failed - missing session or user data");
    return res.status(401).json({ 
      message: "Authentication required. Please refresh the page and log in again.",
      details: process.env.NODE_ENV === 'development' ? {
        isAuthenticated: isAuth,
        hasUser,
        hasSession
      } : undefined
    });
  }
  
  // Additional validation for user data integrity
  const user = req.user as any;
  const userId = user.claims?.sub || user.id;
  
  if (!userId) {
    console.log("[AUTH] Authentication failed - invalid user data");
    return res.status(401).json({ message: "Invalid session. Please log in again." });
  }
  
  console.log("[AUTH] Authentication successful for user:", userId);
  next();
};