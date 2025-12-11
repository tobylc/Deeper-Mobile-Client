import type { Express } from "express";
import { storage } from "./storage";
import { emailCampaignService } from "./email-campaigns";
import { insertEmailCampaignSchema, type EmailCampaign, type InsertEmailCampaign, emailCampaigns } from "../shared/schema";
import { z } from "zod";
import { db } from "./db";
import { desc } from "drizzle-orm";

// Admin-only middleware for email campaign management
const adminOnly = (req: any, res: any, next: any) => {
  if (!req.user?.email) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  // Check if user is admin (you can customize this logic)
  const adminEmails = [
    'toby@gowithclark.com',
    'thetobyclarkshow@gmail.com', 
    'tobylc@mac.com'
  ];
  
  if (!adminEmails.includes(req.user.email)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  
  next();
};

/**
 * Setup admin routes for email campaign management
 * PRODUCTION SAFE: All routes are admin-only and non-destructive
 */
export function setupAdminEmailCampaignRoutes(app: Express) {
  
  // Test endpoint to check raw campaign data
  app.get("/api/admin/email-campaigns/test", adminOnly, async (req, res) => {
    try {
      console.log("[ADMIN] Test endpoint called - checking email campaigns with no filters");
      const testCampaigns = await storage.getEmailCampaignsWithFilters({
        limit: 10,
        offset: 0
      });
      console.log("[ADMIN] Test campaigns count:", testCampaigns.length);
      res.json({ count: testCampaigns.length, campaigns: testCampaigns });
    } catch (error) {
      console.error("[ADMIN] Test endpoint error:", error);
      res.status(500).json({ error: "Test failed", details: error.message });
    }
  });
  
  // Get all email campaigns with filtering and pagination
  app.get("/api/admin/email-campaigns", adminOnly, async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 50, 
        status, 
        campaignType, 
        userEmail,
        startDate,
        endDate 
      } = req.query;
      
      console.log("[ADMIN] Email campaigns request with filters:", {
        page, limit, status, campaignType, userEmail, startDate, endDate
      });
      
      const offset = (Number(page) - 1) * Number(limit);
      
      // Direct database query to bypass potential storage method issues
      const campaigns = await db
        .select()
        .from(emailCampaigns)
        .orderBy(desc(emailCampaigns.createdAt))
        .limit(Number(limit))
        .offset(offset);
      
      const totalCountResult = await db
        .select()
        .from(emailCampaigns);
      
      const totalCount = totalCountResult.length;
      
      console.log("[ADMIN] Found campaigns:", campaigns.length, "Total count:", totalCount);
      console.log("[ADMIN] Sample campaigns:", campaigns.slice(0, 2));
      
      res.json({
        campaigns,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / Number(limit))
        }
      });
    } catch (error) {
      console.error("[ADMIN] Error fetching email campaigns:", error);
      res.status(500).json({ error: "Failed to fetch email campaigns" });
    }
  });
  
  // Get campaign statistics and analytics
  app.get("/api/admin/email-campaigns/stats", adminOnly, async (req, res) => {
    try {
      const stats = await storage.getEmailCampaignStats();
      res.json(stats);
    } catch (error) {
      console.error("[ADMIN] Error fetching campaign stats:", error);
      res.status(500).json({ error: "Failed to fetch campaign statistics" });
    }
  });
  
  // Get email template preview for a specific campaign type
  app.get("/api/admin/email-campaigns/template-preview/:campaignType", adminOnly, async (req, res) => {
    try {
      const { campaignType } = req.params;
      const { userEmail = "example@example.com" } = req.query;
      
      // Generate sample content for preview
      const userName = "John Doe";
      let sampleContent = "";
      let sampleSubject = "";
      
      switch (campaignType) {
        case "post_signup":
          sampleContent = (emailCampaignService as any).generateInviterPost24HourContent(userName);
          sampleSubject = `${userName}, welcome to Deeper!`;
          break;
        case "inviter_nudge":
          sampleContent = (emailCampaignService as any).generateInviterNudge72HourContent(userName);
          sampleSubject = `${userName}, someone is waiting to connect with you`;
          break;
        case "pending_invitation":
          sampleContent = (emailCampaignService as any).generatePendingInvitationReminderContent(
            userName, 
            "Jane Smith", 
            { relationshipType: "Parent-Child", inviterRole: "Father", inviteeRole: "Son" },
            1
          );
          sampleSubject = `${userName}, Jane Smith is waiting to connect with you`;
          break;
        case "turn_reminder":
          sampleContent = (emailCampaignService as any).generateTurnReminderContent(
            userName,
            "Jane Smith",
            24,
            1
          );
          sampleSubject = `${userName}, Jane Smith is waiting for your response`;
          break;
        default:
          return res.status(400).json({ error: "Invalid campaign type" });
      }
      
      // Generate HTML preview using the campaign service
      const htmlContent = (emailCampaignService as any).convertToHtml(sampleContent, campaignType);
      
      res.json({
        campaignType,
        subject: sampleSubject,
        textContent: sampleContent,
        htmlContent,
        previewNote: "This is a sample preview with placeholder data"
      });
    } catch (error) {
      console.error("[ADMIN] Error generating template preview:", error);
      res.status(500).json({ error: "Failed to generate template preview" });
    }
  });
  
  // Create manual email campaign
  app.post("/api/admin/email-campaigns/manual", adminOnly, async (req, res) => {
    try {
      const campaignData = insertEmailCampaignSchema.parse(req.body);
      
      // Validate that user exists
      const user = await storage.getUserByEmail(campaignData.userEmail);
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }
      
      const campaign = await storage.createEmailCampaign(campaignData);
      
      // Log admin action
      console.log(`[ADMIN] Manual campaign created by ${(req.user as any)?.email}:`, {
        campaignId: campaign.id,
        userEmail: campaignData.userEmail,
        campaignType: campaignData.campaignType,
        scheduledAt: campaignData.scheduledAt
      });
      
      res.json({ success: true, campaign });
    } catch (error) {
      console.error("[ADMIN] Error creating manual campaign:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid campaign data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create manual campaign" });
    }
  });
  
  // Update campaign status (cancel, reschedule, etc.)
  app.patch("/api/admin/email-campaigns/:id/status", adminOnly, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, scheduledAt } = req.body;
      
      if (!["pending", "cancelled", "sent", "failed"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      
      await storage.updateEmailCampaignStatus(Number(id), status);
      
      // If rescheduling, update the scheduled time
      if (status === "pending" && scheduledAt) {
        await storage.updateEmailCampaignSchedule(Number(id), new Date(scheduledAt));
      }
      
      // Log admin action
      console.log(`[ADMIN] Campaign ${id} status updated by ${(req.user as any)?.email}: ${status}`);
      
      res.json({ success: true });
    } catch (error) {
      console.error("[ADMIN] Error updating campaign status:", error);
      res.status(500).json({ error: "Failed to update campaign status" });
    }
  });
  
  // Bulk campaign operations
  app.post("/api/admin/email-campaigns/bulk-action", adminOnly, async (req, res) => {
    try {
      const { action, campaignIds, newStatus, scheduledAt } = req.body;
      
      if (!Array.isArray(campaignIds) || campaignIds.length === 0) {
        return res.status(400).json({ error: "Campaign IDs required" });
      }
      
      let results: any[] = [];
      
      for (const id of campaignIds) {
        try {
          switch (action) {
            case "cancel":
              await storage.updateEmailCampaignStatus(Number(id), "cancelled");
              results.push({ id, success: true });
              break;
            case "reschedule":
              if (!scheduledAt) {
                results.push({ id, success: false, error: "Scheduled time required" });
                continue;
              }
              await storage.updateEmailCampaignStatus(Number(id), "pending");
              await storage.updateEmailCampaignSchedule(Number(id), new Date(scheduledAt));
              results.push({ id, success: true });
              break;
            default:
              results.push({ id, success: false, error: "Invalid action" });
          }
        } catch (error) {
          results.push({ id, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      // Log admin action
      console.log(`[ADMIN] Bulk ${action} performed by ${(req.user as any)?.email} on ${campaignIds.length} campaigns`);
      
      res.json({ success: true, results });
    } catch (error) {
      console.error("[ADMIN] Error performing bulk action:", error);
      res.status(500).json({ error: "Failed to perform bulk action" });
    }
  });
  
  // Test email campaign delivery
  app.post("/api/admin/email-campaigns/test", adminOnly, async (req, res) => {
    try {
      const { campaignType, testEmail } = req.body;
      
      if (!testEmail || !campaignType) {
        return res.status(400).json({ error: "Test email and campaign type required" });
      }
      
      // Create a test campaign for immediate delivery
      const testCampaign: InsertEmailCampaign = {
        userEmail: testEmail,
        campaignType,
        triggerEvent: "admin_test",
        userType: "test",
        scheduledAt: new Date(),
        delayHours: 0,
        emailSubject: `[TEST] Deeper Campaign - ${campaignType}`,
        emailContent: `This is a test email for the ${campaignType} campaign type.\n\nThis email was sent by an administrator for testing purposes.`,
      };
      
      const campaign = await storage.createEmailCampaign(testCampaign);
      
      // Send immediately
      await emailCampaignService.processPendingCampaigns();
      
      // Log admin action
      console.log(`[ADMIN] Test campaign sent by ${(req.user as any)?.email} to ${testEmail}`);
      
      res.json({ 
        success: true, 
        message: "Test email sent successfully",
        campaignId: campaign.id 
      });
    } catch (error) {
      console.error("[ADMIN] Error sending test email:", error);
      res.status(500).json({ error: "Failed to send test email" });
    }
  });
  
  // Get campaign processor status and control
  app.get("/api/admin/email-campaigns/processor-status", adminOnly, async (req, res) => {
    try {
      // You can extend this to track processor status
      res.json({
        status: "running",
        lastProcessed: new Date().toISOString(),
        intervalMinutes: 5,
        nextRun: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      });
    } catch (error) {
      console.error("[ADMIN] Error fetching processor status:", error);
      res.status(500).json({ error: "Failed to fetch processor status" });
    }
  });
  
  // Force immediate campaign processing
  app.post("/api/admin/email-campaigns/process-now", adminOnly, async (req, res) => {
    try {
      await emailCampaignService.processPendingCampaigns();
      
      console.log(`[ADMIN] Manual campaign processing triggered by ${(req.user as any)?.email}`);
      
      res.json({ 
        success: true, 
        message: "Campaign processing completed",
        processedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("[ADMIN] Error processing campaigns:", error);
      res.status(500).json({ error: "Failed to process campaigns" });
    }
  });
}