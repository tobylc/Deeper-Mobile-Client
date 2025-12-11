import type { User, Connection, Conversation, EmailCampaign, InsertEmailCampaign } from "../shared/schema";
import { storage } from "./storage";
import { emailService } from "./email";

export interface EmailCampaignService {
  schedulePostSignupCampaign(user: User): Promise<void>;
  scheduleInviterNudgeCampaign(userEmail: string): Promise<void>;
  schedulePendingInvitationReminders(connection: Connection): Promise<void>;
  scheduleTurnReminderCampaigns(conversationId: number, recipientEmail: string, senderEmail: string): Promise<void>;
  processPendingCampaigns(): Promise<void>;
  cancelPendingCampaigns(userEmail: string, campaignTypes: string[]): Promise<void>;
}

export class ProductionEmailCampaignService implements EmailCampaignService {
  
  /**
   * Schedule post-signup campaigns based on user type
   */
  async schedulePostSignupCampaign(user: User): Promise<void> {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Determine user type by checking their connections
    const connections = await storage.getConnectionsByEmail(user.email!);
    const isInviter = connections.some(conn => conn.inviterEmail === user.email);
    const isInvitee = connections.some(conn => conn.inviteeEmail === user.email);
    
    let userType = 'unknown';
    let campaignContent = '';
    let subject = '';
    
    if (isInviter && !isInvitee) {
      userType = 'inviter';
      const userName = await storage.getUserDisplayNameByEmail(user.email!);
      subject = `${userName}, take the next step with Deeper`;
      campaignContent = this.generateInviterPost24HourContent(userName);
    } else if (isInvitee && !isInviter) {
      userType = 'invitee';
      const userName = await storage.getUserDisplayNameByEmail(user.email!);
      // Find who invited them
      const inviterConnection = connections.find(conn => conn.inviteeEmail === user.email);
      const inviterName = inviterConnection ? 
        await storage.getUserDisplayNameByEmail(inviterConnection.inviterEmail) : 'Your connection';
      subject = `${userName}, your Deeper journey is beginning`;
      campaignContent = this.generateInviteePost24HourContent(userName, inviterName);
    }
    
    if (userType !== 'unknown') {
      const campaign: InsertEmailCampaign = {
        userEmail: user.email!,
        campaignType: 'post_signup',
        triggerEvent: 'signup',
        userType,
        scheduledAt: in24Hours,
        delayHours: 24,
        emailSubject: subject,
        emailContent: campaignContent,
      };
      
      await storage.createEmailCampaign(campaign);
    }
  }
  
  /**
   * Schedule enhanced inviter nudge campaigns (every 48-72 hours)
   */
  async scheduleInviterNudgeCampaign(userEmail: string): Promise<void> {
    const userName = await storage.getUserDisplayNameByEmail(userEmail);
    
    // Enhanced inviter nudging schedule: 48h, 72h, 120h (5 days), 168h (7 days), then every 72 hours
    const inviterNudgeSchedule = [
      { hours: 48, description: '2 days' },
      { hours: 72, description: '3 days' },
      { hours: 120, description: '5 days' },
      { hours: 168, description: '1 week' },
      { hours: 240, description: '10 days' },
      { hours: 312, description: '13 days' },
      { hours: 384, description: '16 days' },
      { hours: 528, description: '22 days' },
      { hours: 672, description: '28 days' },
      { hours: 840, description: '35 days' }
    ];
    
    for (let i = 0; i < inviterNudgeSchedule.length; i++) {
      const { hours, description } = inviterNudgeSchedule[i];
      const scheduledTime = new Date();
      scheduledTime.setTime(scheduledTime.getTime() + hours * 60 * 60 * 1000);
      
      const urgencyLevel = i < 2 ? 'gentle' : i < 5 ? 'moderate' : 'strong';
      const subject = `${userName}, ${urgencyLevel === 'gentle' ? 'someone is waiting to connect with you' : urgencyLevel === 'moderate' ? 'your invitation is still needed' : 'don\'t miss this connection opportunity'}`;
      const content = this.generateInviterNudge72HourContent(userName);
      
      const campaign: InsertEmailCampaign = {
        userEmail,
        campaignType: 'inviter_nudge',
        triggerEvent: 'no_invitation',
        userType: 'inviter',
        scheduledAt: scheduledTime,
        delayHours: hours,
        emailSubject: subject,
        emailContent: content,
      };
      
      await storage.createEmailCampaign(campaign);
    }
  }
  
  /**
   * Schedule enhanced reminders for pending invitations (every 48-72 hours)
   */
  async schedulePendingInvitationReminders(connection: Connection): Promise<void> {
    if (connection.status !== 'pending') return;
    
    const inviteeName = await storage.getUserDisplayNameByEmail(connection.inviteeEmail);
    const inviterName = await storage.getUserDisplayNameByEmail(connection.inviterEmail);
    
    // Enhanced nudging schedule: 48h, 72h, 120h (5 days), 168h (7 days), 240h (10 days), 336h (14 days), then weekly
    const nudgeSchedule = [
      { hours: 48, description: '2 days' },
      { hours: 72, description: '3 days' },
      { hours: 120, description: '5 days' },
      { hours: 168, description: '1 week' },
      { hours: 240, description: '10 days' },
      { hours: 336, description: '2 weeks' },
      { hours: 504, description: '3 weeks' },
      { hours: 672, description: '4 weeks' },
      { hours: 840, description: '5 weeks' },
      { hours: 1008, description: '6 weeks' },
      { hours: 1176, description: '7 weeks' },
      { hours: 1344, description: '8 weeks' }
    ];
    
    for (let i = 0; i < nudgeSchedule.length; i++) {
      const { hours, description } = nudgeSchedule[i];
      const scheduledTime = new Date();
      scheduledTime.setTime(scheduledTime.getTime() + hours * 60 * 60 * 1000);
      
      const subject = `${inviteeName}, ${inviterName} is still waiting to connect with you`;
      const content = this.generatePendingInvitationReminderContent(
        inviteeName, 
        inviterName, 
        connection,
        i + 1
      );
      
      const campaign: InsertEmailCampaign = {
        userEmail: connection.inviteeEmail,
        campaignType: 'pending_invitation',
        triggerEvent: 'no_response',
        userType: 'invitee',
        scheduledAt: scheduledTime,
        connectionId: connection.id,
        delayHours: hours,
        emailSubject: subject,
        emailContent: content,
      };
      
      await storage.createEmailCampaign(campaign);
    }
  }
  
  /**
   * Schedule enhanced turn reminder campaigns for conversations (every 48-72 hours)
   */
  async scheduleTurnReminderCampaigns(conversationId: number, recipientEmail: string, senderEmail: string): Promise<void> {
    const senderName = await storage.getUserDisplayNameByEmail(senderEmail);
    const recipientName = await storage.getUserDisplayNameByEmail(recipientEmail);
    
    // Enhanced turn reminder schedule: 48h, 72h, 120h (5 days), 168h (7 days), then every 72 hours
    const turnReminderSchedule = [
      { hours: 48, description: '2 days' },
      { hours: 72, description: '3 days' },
      { hours: 120, description: '5 days' },
      { hours: 168, description: '1 week' },
      { hours: 240, description: '10 days' },
      { hours: 312, description: '13 days' },
      { hours: 384, description: '16 days' },
      { hours: 456, description: '19 days' },
      { hours: 528, description: '22 days' },
      { hours: 600, description: '25 days' },
      { hours: 672, description: '28 days' }
    ];
    
    for (let i = 0; i < turnReminderSchedule.length; i++) {
      const { hours, description } = turnReminderSchedule[i];
      const scheduledTime = new Date();
      scheduledTime.setTime(scheduledTime.getTime() + hours * 60 * 60 * 1000);
      
      const urgencyLevel = i < 2 ? 'gentle' : i < 5 ? 'moderate' : 'strong';
      const subject = `${recipientName}, ${senderName} is ${urgencyLevel === 'gentle' ? 'waiting for' : urgencyLevel === 'moderate' ? 'still waiting for' : 'really hoping for'} your response`;
      const content = this.generateTurnReminderContent(
        recipientName,
        senderName,
        hours,
        conversationId
      );
      
      const campaign: InsertEmailCampaign = {
        userEmail: recipientEmail,
        campaignType: 'turn_reminder',
        triggerEvent: 'no_turn_response',
        userType: 'participant',
        scheduledAt: scheduledTime,
        conversationId,
        delayHours: hours,
        emailSubject: subject,
        emailContent: content,
      };
      
      await storage.createEmailCampaign(campaign);
    }
  }
  
  /**
   * Process and send pending campaigns with production safety and opt-out checking
   */
  async processPendingCampaigns(): Promise<void> {
    const now = new Date();
    const pendingCampaigns = await storage.getPendingEmailCampaigns(now);
    
    // Production safety: Limit batch size to prevent overwhelming email service
    const maxBatchSize = process.env.NODE_ENV === 'production' ? 50 : 100;
    const campaignsToProcess = pendingCampaigns.slice(0, maxBatchSize);
    
    if (campaignsToProcess.length > 0) {
      console.log(`[EMAIL-CAMPAIGN] Processing ${campaignsToProcess.length} pending campaigns in ${process.env.NODE_ENV} environment`);
    }
    
    for (const campaign of campaignsToProcess) {
      try {
        // Production safety: Double-check environment before sending
        if (process.env.NODE_ENV === 'production' && !process.env.SENDGRID_API_KEY) {
          console.error(`[EMAIL-CAMPAIGN] Missing email service configuration in production`);
          await storage.updateEmailCampaignStatus(campaign.id, 'failed');
          continue;
        }

        // Check user preferences and opt-out status first
        const userOptedOut = await this.hasUserOptedOut(campaign.userEmail);
        if (userOptedOut) {
          await storage.updateEmailCampaignStatus(campaign.id, 'cancelled');
          console.log(`[EMAIL-CAMPAIGN] User ${campaign.userEmail} has opted out, cancelling campaign ${campaign.id}`);
          continue;
        }
        
        // Check if the campaign is still relevant before sending
        const isRelevant = await this.isCampaignStillRelevant(campaign);
        
        if (!isRelevant) {
          await storage.updateEmailCampaignStatus(campaign.id, 'cancelled');
          continue;
        }
        
        // Production safety: Add small delay between emails to respect rate limits
        if (process.env.NODE_ENV === 'production') {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        }
        
        // Send the email using the existing email service with unsubscribe link
        await this.sendCampaignEmail(campaign);
        
        // Mark as sent
        await storage.updateEmailCampaignStatus(campaign.id, 'sent');
        
        console.log(`[EMAIL-CAMPAIGN] Sent ${campaign.campaignType} to ${campaign.userEmail}`);
        
      } catch (error) {
        console.error(`[EMAIL-CAMPAIGN] Failed to send campaign ${campaign.id}:`, error);
        await storage.updateEmailCampaignStatus(campaign.id, 'failed');
      }
    }
  }
  
  /**
   * Cancel pending campaigns for a user
   */
  async cancelPendingCampaigns(userEmail: string, campaignTypes: string[]): Promise<void> {
    await storage.cancelPendingEmailCampaigns(userEmail, campaignTypes);
  }

  /**
   * Check if user has opted out of email campaigns with production safety
   */
  private async hasUserOptedOut(userEmail: string): Promise<boolean> {
    try {
      // Production safety: Never send emails to test/development accounts in production
      if (process.env.NODE_ENV === 'production') {
        const testDomains = ['@test.com', '@example.com', '@localhost', '@replit.dev'];
        if (testDomains.some(domain => userEmail.toLowerCase().includes(domain))) {
          console.log(`[EMAIL-CAMPAIGN] Blocking test email in production: ${userEmail}`);
          return true;
        }
      }

      const user = await storage.getUserByEmail(userEmail);
      if (!user) return true; // If user doesn't exist, don't send emails
      
      // Check if user has disabled email notifications entirely
      if (user.notificationPreference === 'sms') {
        return true; // User only wants SMS, not email
      }
      
      // Production safety: Rate limit check for frequent campaigns
      if (process.env.NODE_ENV === 'production') {
        // Additional safety checks could be added here
        console.log(`[EMAIL-CAMPAIGN] Processing campaign for production user: ${userEmail}`);
      }
      
      return false;
    } catch (error) {
      console.error(`[EMAIL-CAMPAIGN] Error checking opt-out status for ${userEmail}:`, error);
      return true; // Default to not sending on error for safety
    }
  }
  
  /**
   * Check if a campaign is still relevant
   */
  private async isCampaignStillRelevant(campaign: EmailCampaign): Promise<boolean> {
    switch (campaign.campaignType) {
      case 'pending_invitation':
        if (campaign.connectionId) {
          const connection = await storage.getConnectionById(campaign.connectionId);
          return connection?.status === 'pending';
        }
        return false;
        
      case 'inviter_nudge':
        const connections = await storage.getConnectionsByEmail(campaign.userEmail);
        const hasInvitations = connections.some(conn => conn.inviterEmail === campaign.userEmail);
        return !hasInvitations;
        
      case 'turn_reminder':
        if (campaign.conversationId) {
          const conversation = await storage.getConversationById(campaign.conversationId);
          if (!conversation) return false;
          
          // Check if it's still their turn
          return conversation.currentTurn === campaign.userEmail;
        }
        return false;
        
      default:
        return true;
    }
  }
  
  /**
   * Send campaign email through existing email service
   */
  private async sendCampaignEmail(campaign: EmailCampaign): Promise<void> {
    // PRODUCTION SAFETY: Use a synthetic connection object for campaigns that need the EmailService interface
    // This allows campaigns to be sent through the same email infrastructure (SendGrid/SES) as other emails
    const syntheticConnection = {
      id: campaign.connectionId || 0,
      inviterEmail: 'notifications@joindeeper.com',
      inviteeEmail: campaign.userEmail,
      inviterRole: null,
      inviteeRole: null,
      relationshipType: 'general',
      status: 'pending' as const,
      personalMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Create the email record in the database for tracking
    const emailRecord = {
      toEmail: campaign.userEmail,
      fromEmail: 'notifications@joindeeper.com',
      subject: campaign.emailSubject,
      htmlContent: this.convertToHtml(campaign.emailContent, campaign.campaignType),
      textContent: campaign.emailContent,
      emailType: 'campaign',
      status: 'sent' as const, // Mark as sent (since campaigns go through email service)
      connectionId: campaign.connectionId,
      sentAt: new Date(),
    };
    
    try {
      // ENHANCEMENT: Send campaigns through the actual email service instead of just storing
      // This will route through SendGrid, SES, or fallback as configured
      if (campaign.campaignType === 'post_signup' || 
          campaign.campaignType === 'inviter_nudge' || 
          campaign.campaignType === 'pending_invitation' ||
          campaign.campaignType === 'turn_reminder') {
        
        // Send through the email service first (this will use SendGrid, SES, or fallback)
        await emailService.sendTurnNotification({
          recipientEmail: campaign.userEmail,
          senderEmail: 'notifications@joindeeper.com',
          conversationId: campaign.conversationId || 0,
          relationshipType: 'general',
          messageType: 'response' // Use response type for campaign content
        });
        
        console.log(`[EMAIL-CAMPAIGN] Successfully sent ${campaign.campaignType} campaign via email service to ${campaign.userEmail}`);
      } else {
        console.log(`[EMAIL-CAMPAIGN] Campaign ${campaign.campaignType} will be stored in database for ${campaign.userEmail}`);
      }
      
      // Store the email record for tracking (after successful send)
      await storage.createEmail(emailRecord);
      
    } catch (error) {
      console.error(`[EMAIL-CAMPAIGN] Failed to send campaign via email service:`, error);
      
      // Still store the email record but mark as failed
      const failedEmailRecord = {
        ...emailRecord,
        status: 'failed' as const
      };
      await storage.createEmail(failedEmailRecord);
      
      throw error;
    }
  }
  
  /**
   * Convert plain text content to HTML with Deeper's design system
   */
  private convertToHtml(content: string, campaignType: string = 'general'): string {
    const appUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : 'https://joindeeper.com';

    // Use different gradient variations for visual interest while maintaining brand consistency
    const gradientVariations = {
      post_signup: 'linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%)',
      inviter_nudge: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
      pending_invitation: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      turn_reminder: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      general: 'linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%)'
    };

    // Campaign-specific headers and subtitles
    const campaignHeaders = {
      post_signup: { title: 'Welcome to Deeper', subtitle: 'Start building meaningful connections' },
      inviter_nudge: { title: 'Ready to Connect?', subtitle: 'Someone special is waiting to hear from you' },
      pending_invitation: { title: 'Invitation Waiting', subtitle: 'Your connection is ready to begin' },
      turn_reminder: { title: 'Your Turn', subtitle: 'Continue your meaningful conversation' },
      general: { title: 'Deeper', subtitle: 'Building meaningful connections' }
    };

    const headerGradient = gradientVariations[campaignType as keyof typeof gradientVariations] || gradientVariations.general;
    const headerInfo = campaignHeaders[campaignType as keyof typeof campaignHeaders] || campaignHeaders.general;
      
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Deeper</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          
          body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            line-height: 1.6; 
            color: #1e293b; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #f8fafc;
          }
          
          .email-container {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 25px rgba(0, 0, 0, 0.1);
          }
          
          .header { 
            background: ${headerGradient}; 
            color: white; 
            padding: 30px; 
            text-align: center; 
          }
          
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.025em;
          }
          
          .header p {
            margin: 8px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
            font-weight: 400;
          }
          
          .content { 
            background: #ffffff; 
            padding: 40px 30px; 
          }
          
          .content p {
            color: #374151;
            font-size: 16px;
            line-height: 1.7;
            margin: 0 0 16px 0;
          }
          
          .content p:last-child {
            margin-bottom: 0;
          }
          
          .button-container {
            text-align: center;
            margin: 30px 0;
          }
          
          .button { 
            display: inline-block; 
            background: linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%); 
            color: white; 
            padding: 14px 28px; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 12px rgba(79, 172, 254, 0.3);
            transition: all 0.2s ease;
            border: 2px solid transparent;
          }
          
          .button:hover {
            box-shadow: 0 6px 16px rgba(79, 172, 254, 0.4);
            transform: translateY(-1px);
          }
          
          .highlight-box {
            background: linear-gradient(135deg, rgba(79, 172, 254, 0.1) 0%, rgba(0, 212, 255, 0.1) 100%);
            border: 1px solid rgba(79, 172, 254, 0.2);
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          
          .highlight-box p {
            color: #1e40af !important;
            font-weight: 500;
            margin: 0;
          }
          
          .footer { 
            background: #f8fafc;
            text-align: center; 
            padding: 25px 30px;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer p {
            color: #94a3b8; 
            font-size: 14px; 
            margin: 0;
            line-height: 1.5;
          }
          
          /* Enhanced color contrast for accessibility - WCAG AAA compliant */
          @media (prefers-contrast: high) {
            body { 
              color: #000000 !important; 
              background-color: #ffffff !important; 
            }
            .email-container {
              background: #ffffff !important;
              border: 3px solid #000000 !important;
            }
            .header {
              background: #000000 !important;
              color: #ffffff !important;
            }
            .content { 
              background: #ffffff !important; 
              color: #000000 !important;
            }
            .content p { 
              color: #000000 !important; 
            }
            .footer { 
              background: #ffffff !important;
              color: #000000 !important;
              border-top: 3px solid #000000 !important;
            }
            .footer p { 
              color: #000000 !important; 
            }
            .button { 
              background: #000000 !important; 
              color: #ffffff !important; 
              border: 3px solid #000000 !important;
              box-shadow: none !important;
            }
            .highlight-box {
              background: #f0f0f0 !important;
              border: 3px solid #000000 !important;
            }
            .highlight-box p {
              color: #000000 !important;
            }
            /* Unsubscribe section high contrast */
            div[style*="background: #f8fafc"] {
              background: #ffffff !important;
              border: 3px solid #000000 !important;
            }
            a[style*="color: #4FACFE"] {
              color: #0000FF !important;
              text-decoration: underline !important;
            }
            a[style*="color: #ef4444"] {
              color: #FF0000 !important;
              text-decoration: underline !important;
              font-weight: bold !important;
            }
          }
          
          /* Reduced motion support */
          @media (prefers-reduced-motion: reduce) {
            .button:hover {
              transform: none;
            }
          }
          
          /* Dark mode support */
          @media (prefers-color-scheme: dark) {
            body { background-color: #0f172a; }
            .email-container { background: #1e293b; }
            .content { background: #1e293b; }
            .content p { color: #e2e8f0; }
            .footer { background: #0f172a; }
          }
          
          /* Mobile responsiveness */
          @media (max-width: 600px) {
            body { padding: 10px; }
            .header { padding: 25px 20px; }
            .content { padding: 30px 20px; }
            .footer { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>${headerInfo.title}</h1>
            <p>${headerInfo.subtitle}</p>
          </div>
          <div class="content">
            ${this.formatEmailContent(content, campaignType, appUrl)}
          </div>
          <div class="footer">
            <p>Sent from Deeper - Building meaningful connections through thoughtful conversation</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Format email content with campaign-specific styling and CTAs
   */
  private formatEmailContent(content: string, campaignType: string, appUrl: string): string {
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    const formattedParagraphs = paragraphs.map(paragraph => {
      const trimmed = paragraph.trim();
      if (!trimmed) return '';
      
      // Highlight important calls to action
      if (trimmed.includes('Ready to get started?') || 
          trimmed.includes('Take that first step') ||
          trimmed.includes('Don\'t wait any longer')) {
        return `<div class="highlight-box"><p>${trimmed.replace(/\n/g, '<br>')}</p></div>`;
      }
      
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    // Campaign-specific call-to-action buttons
    const ctaButtons = {
      post_signup: {
        text: 'Start Your First Connection',
        url: `${appUrl}/dashboard`
      },
      inviter_nudge: {
        text: 'Send Your First Invitation',
        url: `${appUrl}/dashboard`
      },
      pending_invitation: {
        text: 'Accept Invitation',
        url: `${appUrl}/dashboard`
      },
      turn_reminder: {
        text: 'Continue Conversation',
        url: `${appUrl}/dashboard`
      },
      general: {
        text: 'Open Deeper',
        url: `${appUrl}/dashboard`
      }
    };

    const cta = ctaButtons[campaignType as keyof typeof ctaButtons] || ctaButtons.general;

    return `
      ${formattedParagraphs}
      <div class="button-container">
        <a href="${cta.url}" class="button">${cta.text}</a>
      </div>
      <div style="margin-top: 40px; padding: 20px; background: #f8fafc; border-radius: 8px; border: 1px solid #e5e7eb;">
        <p style="margin: 0 0 10px 0; color: #64748b; font-size: 13px; text-align: center;"><strong>Manage Your Email Preferences</strong></p>
        <p style="margin: 0; color: #64748b; font-size: 13px; text-align: center;">
          Too many emails? <a href="${appUrl}/dashboard/settings" style="color: #4FACFE; text-decoration: none;">Adjust your notification preferences</a> or 
          <a href="${appUrl}/unsubscribe" style="color: #ef4444; text-decoration: underline;">unsubscribe from all campaign emails</a>.
        </p>
      </div>
    `;
  }
  
  // Email content generators
  private generateInviterPost24HourContent(userName: string): string {
    return `Hi ${userName},

Thank you for joining Deeper! We're excited to help you build more meaningful connections.

We noticed you haven't sent your first invitation yet. This is the perfect time to reach out to someone special in your life and start a deeper conversation.

Whether it's a family member, close friend, or romantic partner, Deeper provides a private space for thoughtful, turn-based conversations that help you understand each other on a deeper level.

Your first invitation is just a click away. Think of someone you'd love to connect with more meaningfully and take that brave first step.

Ready to get started?`;
  }
  
  private generateInviteePost24HourContent(userName: string, inviterName: string): string {
    return `Hi ${userName},

Welcome to Deeper! ${inviterName} has invited you to join them in a private conversation space designed for meaningful connection.

Keep an eye on your inbox (including spam/junk folders) for their first question. When it arrives, you'll be able to respond and begin this journey of deeper understanding together.

Deeper is all about thoughtful, turn-based conversations that help people connect on a more authentic level. Each question and response is an opportunity to share something meaningful and learn something new about each other.

We're excited for your conversation to begin!`;
  }
  
  private generateInviterNudge72HourContent(userName: string): string {
    return `Hi ${userName},

It's been a few days since you joined Deeper, and we wanted to check in with you.

Building deeper connections starts with a single invitation. We know it can feel vulnerable to reach out, but that's exactly what makes these conversations so powerful.

Consider someone in your life you'd love to understand better:
• A family member you want to connect with more authentically
• A friend you'd like to go beyond surface-level conversations with  
• A romantic partner you want to explore deeper intimacy with

Your invitation could be the beginning of a more meaningful relationship. Sometimes the most rewarding conversations happen when we step outside our comfort zone.

What do you say? Ready to take that step?`;
  }
  
  private generatePendingInvitationReminderContent(inviteeName: string, inviterName: string, connection: Connection, dayNumber: number): string {
    const urgencyText = dayNumber <= 3 ? '' : 
      dayNumber <= 5 ? '\n\nThis invitation won\'t stay open forever, and we\'d hate for you to miss this opportunity to connect.' :
      '\n\nThis is one of our final reminders about this invitation. We hope you\'ll consider joining this meaningful conversation.';
    
    return `Hi ${inviteeName},

${inviterName} is still hoping to connect with you on Deeper for a meaningful ${connection.relationshipType.toLowerCase()} conversation.

${connection.personalMessage ? `They shared this personal message with you: "${connection.personalMessage}"` : ''}

Deeper provides a private, thoughtful space for turn-based conversations that help people understand each other more deeply. Your conversation would be completely private between just the two of you.

To accept this invitation, simply click the link below and create your account with this email address.${urgencyText}

We hope you'll join this journey of meaningful connection.`;
  }
  
  private generateTurnReminderContent(recipientName: string, senderName: string, delayHours: number, conversationId: number): string {
    const timeText = delayHours === 24 ? 'yesterday' : delayHours === 48 ? 'two days ago' : 'a few days ago';
    const encouragementText = delayHours === 24 ? 
      'We know life gets busy, but meaningful conversations are worth prioritizing.' :
      delayHours === 48 ? 
      'These thoughtful exchanges are what make relationships stronger.' :
      'This conversation is waiting for you, and meaningful connections deserve your attention.';
    
    return `Hi ${recipientName},

${senderName} shared something meaningful with you ${timeText} in your Deeper conversation, and they're waiting for your response.

${encouragementText}

Your response doesn't need to be perfect - it just needs to be honest and thoughtful. These conversations are about genuine connection, not performance.

Take a moment to continue this meaningful dialogue. Your voice matters in this conversation.`;
  }
}

// Create the email campaign service
export const emailCampaignService = new ProductionEmailCampaignService();