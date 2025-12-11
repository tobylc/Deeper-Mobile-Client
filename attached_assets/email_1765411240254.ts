import type { Connection } from "../shared/schema";
import { storage } from "./storage";
import sgMail from '@sendgrid/mail';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { getInvitationText, getEmailSubjectWithRoles } from "../shared/role-display-utils";

// Email service interface for sending notifications
export interface EmailService {
  sendConnectionInvitation(connection: Connection): Promise<void>;
  sendConnectionAccepted(connection: Connection): Promise<void>;
  sendConnectionDeclined(connection: Connection): Promise<void>;
  sendTurnNotification(params: {
    recipientEmail: string;
    senderEmail: string;
    conversationId: number;
    relationshipType: string;
    senderRole?: string;
    recipientRole?: string;
    messageType: 'question' | 'response';
  }): Promise<void>;
}

// Simple console email service for development
export class ConsoleEmailService implements EmailService {
  async sendConnectionInvitation(connection: Connection): Promise<void> {
    const appUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : 'https://joindeeper.com';
    const inviterName = await storage.getUserDisplayNameByEmail(connection.inviterEmail);
    const invitationText = getInvitationText(connection.inviterRole, connection.inviteeRole, connection.relationshipType);
    const subject = getEmailSubjectWithRoles('Invitation', connection.inviterRole, connection.inviteeRole, connection.relationshipType);
    
    console.log(`
📧 INVITATION EMAIL
To: ${connection.inviteeEmail}
From: ${connection.inviterEmail}
Subject: ${subject}

Hi there!

${inviterName} has invited you to connect on Deeper for ${invitationText}.

${connection.personalMessage ? `Personal message: "${connection.personalMessage}"` : ''}

To accept this invitation, simply click the button below or visit:
${appUrl}/invitation-signup?id=${connection.id}

You must use the email address: ${connection.inviteeEmail}

This is a private, turn-based conversation space where you can build deeper understanding through thoughtful questions and responses.

Best regards,
The Deeper Team
    `);
  }

  async sendConnectionAccepted(connection: Connection): Promise<void> {
    const inviteeName = await storage.getUserDisplayNameByEmail(connection.inviteeEmail);
    const subject = getEmailSubjectWithRoles('Connection Accepted', connection.inviterRole, connection.inviteeRole, connection.relationshipType);
    const roleDisplay = connection.inviterRole && connection.inviteeRole 
      ? `${connection.inviterRole.toLowerCase()}/${connection.inviteeRole.toLowerCase()}`
      : connection.relationshipType.toLowerCase();
    
    console.log(`
📧 CONNECTION ACCEPTED EMAIL
To: ${connection.inviterEmail}
Subject: ${subject}

Great news! ${inviteeName} has accepted your invitation to connect.

Your private ${roleDisplay} conversation space is now ready. You can start by asking the first question.

Visit your dashboard to begin: [Dashboard Link]

Happy connecting!
The Deeper Team
    `);
  }

  async sendConnectionDeclined(connection: Connection): Promise<void> {
    const inviteeName = await storage.getUserDisplayNameByEmail(connection.inviteeEmail);
    const subject = getEmailSubjectWithRoles('Connection Declined', connection.inviterRole, connection.inviteeRole, connection.relationshipType);
    const roleDisplay = connection.inviterRole && connection.inviteeRole 
      ? `${connection.inviterRole.toLowerCase()}/${connection.inviteeRole.toLowerCase()}`
      : connection.relationshipType.toLowerCase();
    
    console.log(`
📧 CONNECTION DECLINED EMAIL
To: ${connection.inviterEmail}
Subject: ${subject}

${inviteeName} has respectfully declined your ${roleDisplay} connection invitation.

Don't worry - meaningful connections take time. You can always try reaching out through other channels or invite them again in the future.

Keep building meaningful relationships!
The Deeper Team
    `);
  }

  async sendTurnNotification(params: {
    recipientEmail: string;
    senderEmail: string;
    conversationId: number;
    relationshipType: string;
    senderRole?: string;
    recipientRole?: string;
    messageType: 'question' | 'response';
  }): Promise<void> {
    const senderName = await storage.getUserDisplayNameByEmail(params.senderEmail);
    const actionText = params.messageType === 'question' ? 'asked a question' : 'shared a response';
    const conversationContext = params.senderRole && params.recipientRole 
      ? `${params.senderRole.toLowerCase()}/${params.recipientRole.toLowerCase()}`
      : params.relationshipType.toLowerCase();
    
    console.log(`
📧 TURN NOTIFICATION EMAIL
To: ${params.recipientEmail}
Subject: It's your turn! ${senderName} ${actionText}

Hi there!

${senderName} just ${actionText} in your ${conversationContext} conversation.

It's now your turn to respond and continue this meaningful dialogue.

[Visit Conversation Button - ID: ${params.conversationId}]

This is your private, turn-based conversation space designed to deepen your connection.

Best regards,
The Deeper Team
    `);
  }
}

// Production email service using SendGrid
export class ProductionEmailService implements EmailService {
  private fromEmail: string;

  constructor(apiKey: string, fromEmail: string = "notifications@joindeeper.com") {
    sgMail.setApiKey(apiKey);
    this.fromEmail = fromEmail;
  }

  async sendConnectionInvitation(connection: Connection): Promise<void> {
    const appUrl = 'https://joindeeper.com';
    const inviterName = await storage.getUserDisplayNameByEmail(connection.inviterEmail);
    const invitationText = getInvitationText(connection.inviterRole, connection.inviteeRole, connection.relationshipType);
    const subject = getEmailSubjectWithRoles('Invitation', connection.inviterRole, connection.inviteeRole, connection.relationshipType);

    const msg = {
      to: connection.inviteeEmail,
      from: this.fromEmail,
      subject: subject,
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Deeper</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Meaningful conversations that matter</p>
          </div>
          
          <div style="background: #f8fafc; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
            <h2 style="color: #1e293b; margin: 0 0 20px 0;">You've been invited to connect!</h2>
            <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0;">
              <strong>${inviterName}</strong> has invited you to start ${invitationText} on Deeper.
            </p>
            
            ${connection.personalMessage ? `
              <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #4FACFE; margin: 20px 0;">
                <p style="margin: 0; color: #1e293b; font-style: italic;">"${connection.personalMessage}"</p>
              </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}/invitation-signup?id=${connection.id}" style="display: inline-block; background: linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 12px rgba(79, 172, 254, 0.3);">
                Accept Invitation
              </a>
            </div>
          </div>
          
          <div style="background: white; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0;">
            <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px;">What happens next?</h3>
            <ul style="color: #64748b; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li>Click the button above or visit the sign-up link</li>
              <li>You must register with this email: <strong>${connection.inviteeEmail}</strong></li>
              <li>Create your password and complete the registration</li>
              <li>Start your private conversation space immediately</li>
              <li>You can link a Google account later for easier sign-in</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 14px; margin: 0;">
              This is a private, turn-based conversation space designed to deepen relationships through meaningful dialogue.
            </p>
          </div>
        </div>
      `,
      text: `
Hi there!

${inviterName} has invited you to connect on Deeper for ${invitationText}.

${connection.personalMessage ? `Personal message: "${connection.personalMessage}"` : ''}

To accept this invitation, simply visit:
${appUrl}/invitation-signup?id=${connection.id}

You must use the email address: ${connection.inviteeEmail}

This is a private, turn-based conversation space where you can build deeper understanding through thoughtful questions and responses.

Best regards,
The Deeper Team
      `
    };

    try {
      await sgMail.send(msg);
      console.log(`[EMAIL] Invitation sent to ${connection.inviteeEmail}`);
    } catch (error: any) {
      console.error('[EMAIL] Failed to send invitation:', error);
      console.error('[EMAIL] Error details:', error.response?.body);
      throw error;
    }
  }

  async sendConnectionAccepted(connection: Connection): Promise<void> {
    const appUrl = 'https://joindeeper.com';
    const inviteeName = await storage.getUserDisplayNameByEmail(connection.inviteeEmail);
    const subject = getEmailSubjectWithRoles('Connection Accepted', connection.inviterRole, connection.inviteeRole, connection.relationshipType);
    const roleDisplay = connection.inviterRole && connection.inviteeRole 
      ? `${connection.inviterRole.toLowerCase()}/${connection.inviteeRole.toLowerCase()}`
      : connection.relationshipType.toLowerCase();

    const msg = {
      to: connection.inviterEmail,
      from: this.fromEmail,
      subject: subject,
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Great News!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your invitation was accepted</p>
          </div>
          
          <div style="background: #f8fafc; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
            <p style="color: #1e293b; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px;">
              <strong>${inviteeName}</strong> has accepted your ${roleDisplay} connection invitation!
            </p>
            
            <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0;">
              Your private ${roleDisplay} conversation space is now ready. You can start by asking the first question.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}" style="display: inline-block; background: linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 12px rgba(79, 172, 254, 0.3);">
                Start Conversation
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 14px; margin: 0;">
              Happy connecting! Build meaningful relationships through thoughtful dialogue.
            </p>
          </div>
        </div>
      `,
      text: `
Great news! ${inviteeName} has accepted your invitation to connect.

Your private conversation space is now ready. You can start by asking the first question.

Visit your dashboard to begin: ${appUrl}

Happy connecting!
The Deeper Team
      `
    };

    try {
      await sgMail.send(msg);
      console.log(`[EMAIL] Acceptance notification sent to ${connection.inviterEmail}`);
    } catch (error) {
      console.error('[EMAIL] Failed to send acceptance notification:', error);
      throw error;
    }
  }

  async sendConnectionDeclined(connection: Connection): Promise<void> {
    const inviteeName = await storage.getUserDisplayNameByEmail(connection.inviteeEmail);
    const subject = getEmailSubjectWithRoles('Connection Declined', connection.inviterRole, connection.inviteeRole, connection.relationshipType);
    const roleDisplay = connection.inviterRole && connection.inviteeRole 
      ? `${connection.inviterRole.toLowerCase()}/${connection.inviteeRole.toLowerCase()}`
      : connection.relationshipType.toLowerCase();
    
    const msg = {
      to: connection.inviterEmail,
      from: this.fromEmail,
      subject: subject,
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Invitation Update</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
            <p style="color: #374151; line-height: 1.6; margin: 0 0 20px 0;">
              ${inviteeName} has respectfully declined your ${roleDisplay} connection invitation.
            </p>
            
            <p style="color: #6B7280; line-height: 1.6; margin: 0;">
              Don't worry - meaningful connections take time. You can always try reaching out through other channels or invite them again in the future.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 14px; margin: 0;">
              Keep building meaningful relationships!
            </p>
          </div>
        </div>
      `,
      text: `
${inviteeName} has respectfully declined your invitation to connect.

Don't worry - meaningful connections take time. You can always try reaching out through other channels or invite them again in the future.

Keep building meaningful relationships!
The Deeper Team
      `
    };

    try {
      await sgMail.send(msg);
      console.log(`[EMAIL] Decline notification sent to ${connection.inviterEmail}`);
    } catch (error) {
      console.error('[EMAIL] Failed to send decline notification:', error);
      throw error;
    }
  }

  async sendTurnNotification(params: {
    recipientEmail: string;
    senderEmail: string;
    conversationId: number;
    relationshipType: string;
    senderRole?: string;
    recipientRole?: string;
    messageType: 'question' | 'response';
  }): Promise<void> {
    const appUrl = 'https://joindeeper.com';
    const senderName = await storage.getUserDisplayNameByEmail(params.senderEmail);
    const actionText = params.messageType === 'question' ? 'asked a question' : 'shared a response';
    const responseText = params.messageType === 'question' ? 'respond' : 'continue the conversation';
    const conversationContext = params.senderRole && params.recipientRole 
      ? `${params.senderRole.toLowerCase()}/${params.recipientRole.toLowerCase()}`
      : params.relationshipType.toLowerCase();

    const msg = {
      to: params.recipientEmail,
      from: this.fromEmail,
      subject: `It's your turn! ${senderName} ${actionText}`,
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Your Turn!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Time to continue your meaningful conversation</p>
          </div>
          
          <div style="background: #f8fafc; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
            <h2 style="color: #1e293b; margin: 0 0 20px 0;">Message waiting for you</h2>
            <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px;">
              <strong>${senderName}</strong> just ${actionText} in your ${conversationContext} conversation.
            </p>
            
            <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0;">
              It's now your turn to ${responseText} and continue this meaningful dialogue.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}/conversation/${params.conversationId}" style="display: inline-block; background: linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 12px rgba(79, 172, 254, 0.3);">
                Continue Conversation
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 14px; margin: 0;">
              This is your private, turn-based conversation space designed to deepen relationships through meaningful dialogue.
            </p>
          </div>
        </div>
      `,
      text: `
Hi there!

${senderName} just ${actionText} in your ${params.relationshipType.toLowerCase()} conversation.

It's now your turn to ${responseText} and continue this meaningful dialogue.

Visit your conversation: ${appUrl}/conversation/${params.conversationId}

This is your private, turn-based conversation space designed to deepen your connection.

Best regards,
The Deeper Team
      `
    };

    try {
      console.log(`[EMAIL] Attempting to send turn notification via SendGrid...`);
      console.log(`[EMAIL] From: ${this.fromEmail} | To: ${params.recipientEmail} | Subject: It's your turn! ${senderName} ${actionText}`);
      
      await sgMail.send(msg);
      console.log(`[EMAIL] ✅ Turn notification sent successfully to ${params.recipientEmail} via SendGrid`);
    } catch (error: any) {
      console.error('[EMAIL] ❌ Failed to send turn notification via SendGrid:', error);
      if (error.response?.body) {
        console.error('[EMAIL] SendGrid error details:', JSON.stringify(error.response.body, null, 2));
        
        // Check if it's a quota/credit limit issue
        if (error.response.body.errors && error.response.body.errors.some((e: any) => 
          e.message?.includes('Maximum credits exceeded') || e.message?.includes('quota') || e.message?.includes('limit'))) {
          console.error('[EMAIL] 🚨 ISSUE IDENTIFIED: SendGrid account has exceeded its sending quota/credits limit');
          console.error('[EMAIL] 💡 SOLUTION: Upgrade your SendGrid plan or wait for quota reset');
          console.error('[EMAIL] 📧 Until resolved, turn notifications will not be delivered to users');
        }
      }
      throw error;
    }
  }
}

// Amazon SES email service for production
export class AmazonSESEmailService implements EmailService {
  private sesClient: SESv2Client;
  private fromEmail: string;

  constructor(fromEmail: string = "notifications@joindeeper.com") {
    this.sesClient = new SESv2Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.fromEmail = fromEmail;
  }

  private async sendEmail(to: string, subject: string, htmlContent: string, textContent: string): Promise<void> {
    const command = new SendEmailCommand({
      FromEmailAddress: this.fromEmail,
      Destination: {
        ToAddresses: [to],
      },
      Content: {
        Simple: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: htmlContent,
              Charset: 'UTF-8',
            },
            Text: {
              Data: textContent,
              Charset: 'UTF-8',
            },
          },
        },
      },
    });

    try {
      const response = await this.sesClient.send(command);
      console.log(`[EMAIL-SES] Email sent successfully: ${response.MessageId}`);
    } catch (error: any) {
      console.error('[EMAIL-SES] Failed to send email:', error);
      throw error;
    }
  }

  async sendConnectionInvitation(connection: Connection): Promise<void> {
    const appUrl = 'https://joindeeper.com';
    const inviterName = await storage.getUserDisplayNameByEmail(connection.inviterEmail);
    const invitationText = getInvitationText(connection.inviterRole, connection.inviteeRole, connection.relationshipType);
    const subject = getEmailSubjectWithRoles('Invitation', connection.inviterRole, connection.inviteeRole, connection.relationshipType);

    const htmlContent = `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Deeper</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Meaningful conversations that matter</p>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
          <h2 style="color: #1e293b; margin: 0 0 20px 0;">You've been invited to connect!</h2>
          <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0;">
            <strong>${inviterName}</strong> has invited you to start ${invitationText} on Deeper.
          </p>
          
          ${connection.personalMessage ? `
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #4FACFE; margin: 20px 0;">
              <p style="margin: 0; color: #1e293b; font-style: italic;">"${connection.personalMessage}"</p>
            </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${appUrl}/invitation-signup?id=${connection.id}" style="display: inline-block; background: linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 12px rgba(79, 172, 254, 0.3);">
              Accept Invitation
            </a>
          </div>
        </div>
        
        <div style="background: white; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px;">What happens next?</h3>
          <ul style="color: #64748b; line-height: 1.6; margin: 0; padding-left: 20px;">
            <li>Click the button above or visit the sign-up link</li>
            <li>You must register with this email: <strong>${connection.inviteeEmail}</strong></li>
            <li>Create your password and complete the registration</li>
            <li>Start your private conversation space immediately</li>
            <li>You can link a Google account later for easier sign-in</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 14px; margin: 0;">
            This is a private, turn-based conversation space designed to deepen relationships through meaningful dialogue.
          </p>
        </div>
      </div>
    `;

    const textContent = `
Hi there!

${inviterName} has invited you to connect on Deeper for ${invitationText}.

${connection.personalMessage ? `Personal message: "${connection.personalMessage}"` : ''}

To accept this invitation, simply visit:
${appUrl}/invitation-signup?id=${connection.id}

You must use the email address: ${connection.inviteeEmail}

This is a private, turn-based conversation space where you can build deeper understanding through thoughtful questions and responses.

Best regards,
The Deeper Team
    `;

    try {
      await this.sendEmail(connection.inviteeEmail, subject, htmlContent, textContent);
      console.log(`[EMAIL-SES] Invitation sent to ${connection.inviteeEmail}`);
    } catch (error: any) {
      console.error('[EMAIL-SES] Failed to send invitation:', error);
      throw error;
    }
  }

  async sendConnectionAccepted(connection: Connection): Promise<void> {
    const appUrl = 'https://joindeeper.com';
    const inviteeName = await storage.getUserDisplayNameByEmail(connection.inviteeEmail);
    const subject = getEmailSubjectWithRoles('Connection Accepted', connection.inviterRole, connection.inviteeRole, connection.relationshipType);
    const roleDisplay = connection.inviterRole && connection.inviteeRole 
      ? `${connection.inviterRole.toLowerCase()}/${connection.inviteeRole.toLowerCase()}`
      : connection.relationshipType.toLowerCase();

    const htmlContent = `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Great News!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Your invitation was accepted</p>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
          <p style="color: #1e293b; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px;">
            <strong>${inviteeName}</strong> has accepted your ${roleDisplay} connection invitation!
          </p>
          
          <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0;">
            Your private ${roleDisplay} conversation space is now ready. You can start by asking the first question.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${appUrl}" style="display: inline-block; background: linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 12px rgba(79, 172, 254, 0.3);">
              Start Conversation
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 14px; margin: 0;">
            Happy connecting! Build meaningful relationships through thoughtful dialogue.
          </p>
        </div>
      </div>
    `;

    const textContent = `
Great news! ${inviteeName} has accepted your invitation to connect.

Your private conversation space is now ready. You can start by asking the first question.

Visit your dashboard to begin: ${appUrl}

Happy connecting!
The Deeper Team
    `;

    try {
      await this.sendEmail(connection.inviterEmail, subject, htmlContent, textContent);
      console.log(`[EMAIL-SES] Acceptance notification sent to ${connection.inviterEmail}`);
    } catch (error) {
      console.error('[EMAIL-SES] Failed to send acceptance notification:', error);
      throw error;
    }
  }

  async sendConnectionDeclined(connection: Connection): Promise<void> {
    const inviteeName = await storage.getUserDisplayNameByEmail(connection.inviteeEmail);
    const subject = getEmailSubjectWithRoles('Connection Declined', connection.inviterRole, connection.inviteeRole, connection.relationshipType);
    const roleDisplay = connection.inviterRole && connection.inviteeRole 
      ? `${connection.inviterRole.toLowerCase()}/${connection.inviteeRole.toLowerCase()}`
      : connection.relationshipType.toLowerCase();

    const htmlContent = `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Invitation Update</h1>
        </div>
        
        <div style="background: #f9fafb; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
          <p style="color: #374151; line-height: 1.6; margin: 0 0 20px 0;">
            ${inviteeName} has respectfully declined your ${roleDisplay} connection invitation.
          </p>
          
          <p style="color: #6B7280; line-height: 1.6; margin: 0;">
            Don't worry - meaningful connections take time. You can always try reaching out through other channels or invite them again in the future.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 14px; margin: 0;">
            Keep building meaningful relationships!
          </p>
        </div>
      </div>
    `;

    const textContent = `
${inviteeName} has respectfully declined your invitation to connect.

Don't worry - meaningful connections take time. You can always try reaching out through other channels or invite them again in the future.

Keep building meaningful relationships!
The Deeper Team
    `;

    try {
      await this.sendEmail(connection.inviterEmail, subject, htmlContent, textContent);
      console.log(`[EMAIL-SES] Decline notification sent to ${connection.inviterEmail}`);
    } catch (error) {
      console.error('[EMAIL-SES] Failed to send decline notification:', error);
      throw error;
    }
  }

  async sendTurnNotification(params: {
    recipientEmail: string;
    senderEmail: string;
    conversationId: number;
    relationshipType: string;
    senderRole?: string;
    recipientRole?: string;
    messageType: 'question' | 'response';
  }): Promise<void> {
    const appUrl = 'https://joindeeper.com';
    const senderName = await storage.getUserDisplayNameByEmail(params.senderEmail);
    const actionText = params.messageType === 'question' ? 'asked a question' : 'shared a response';
    const responseText = params.messageType === 'question' ? 'respond' : 'continue the conversation';
    const conversationContext = params.senderRole && params.recipientRole 
      ? `${params.senderRole.toLowerCase()}/${params.recipientRole.toLowerCase()}`
      : params.relationshipType.toLowerCase();

    const subject = `It's your turn! ${senderName} ${actionText}`;

    const htmlContent = `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Your Turn!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Continue your meaningful conversation</p>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
          <p style="color: #1e293b; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px;">
            <strong>${senderName}</strong> just ${actionText} in your ${conversationContext} conversation.
          </p>
          
          <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0;">
            It's now your turn to ${responseText} and continue this meaningful dialogue.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${appUrl}" style="display: inline-block; background: linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 12px rgba(79, 172, 254, 0.3);">
              View Conversation
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 14px; margin: 0;">
            This is your private, turn-based conversation space designed to deepen your connection.
          </p>
        </div>
      </div>
    `;

    const textContent = `
Hi there!

${senderName} just ${actionText} in your ${conversationContext} conversation.

It's now your turn to ${responseText} and continue this meaningful dialogue.

Visit your conversation: ${appUrl}

This is your private, turn-based conversation space designed to deepen your connection.

Best regards,
The Deeper Team
    `;

    try {
      await this.sendEmail(params.recipientEmail, subject, htmlContent, textContent);
      console.log(`[EMAIL-SES] Turn notification sent to ${params.recipientEmail}`);
    } catch (error) {
      console.error('[EMAIL-SES] Failed to send turn notification:', error);
      throw error;
    }
  }
}

// Internal email service that stores emails in database
export class InternalEmailService implements EmailService {
  private fromEmail: string;

  constructor(fromEmail: string = "notifications@joindeeper.com") {
    this.fromEmail = fromEmail;
  }

  async sendConnectionInvitation(connection: Connection): Promise<void> {
    const appUrl = 'https://joindeeper.com';
    const inviterName = await storage.getUserDisplayNameByEmail(connection.inviterEmail);
    const invitationText = getInvitationText(connection.inviterRole, connection.inviteeRole, connection.relationshipType);
    const subject = getEmailSubjectWithRoles('Invitation', connection.inviterRole, connection.inviteeRole, connection.relationshipType);
    
    const htmlContent = `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Deeper</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Meaningful conversations that matter</p>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
          <h2 style="color: #1e293b; margin: 0 0 20px 0;">You've been invited to connect!</h2>
          <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0;">
            <strong>${inviterName}</strong> has invited you to start ${invitationText} on Deeper.
          </p>
          
          ${connection.personalMessage ? `
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #4FACFE; margin: 20px 0;">
              <p style="margin: 0; color: #1e293b; font-style: italic;">"${connection.personalMessage}"</p>
            </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${appUrl}/invitation-signup?id=${connection.id}" style="display: inline-block; background: linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 12px rgba(79, 172, 254, 0.3);">
              Accept Invitation
            </a>
          </div>
        </div>
        
        <div style="background: white; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px;">What happens next?</h3>
          <ul style="color: #64748b; line-height: 1.6; margin: 0; padding-left: 20px;">
            <li>Click the button above or visit the sign-up link</li>
            <li>You must register with this email: <strong>${connection.inviteeEmail}</strong></li>
            <li>Create your password and complete the registration</li>
            <li>Start your private conversation space immediately</li>
            <li>You can link a Google account later for easier sign-in</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 14px; margin: 0;">
            This is a private, turn-based conversation space designed to deepen relationships through meaningful dialogue.
          </p>
        </div>
      </div>
    `;

    const textContent = `
Hi there!

${inviterName} has invited you to connect on Deeper for ${invitationText}.

${connection.personalMessage ? `Personal message: "${connection.personalMessage}"` : ''}

To accept this invitation, simply visit:
${appUrl}/invitation-signup?id=${connection.id}

You must use the email address: ${connection.inviteeEmail}

This is a private, turn-based conversation space where you can build deeper understanding through thoughtful questions and responses.

Best regards,
The Deeper Team
    `;

    // Store email in database instead of sending
    await storage.createEmail({
      toEmail: connection.inviteeEmail,
      fromEmail: this.fromEmail,
      subject,
      htmlContent,
      textContent,
      emailType: "invitation",
      connectionId: connection.id,
    });

    console.log(`[EMAIL] Invitation notification stored for ${connection.inviteeEmail}`);
  }

  async sendConnectionAccepted(connection: Connection): Promise<void> {
    const appUrl = 'https://joindeeper.com';
    const inviteeName = await storage.getUserDisplayNameByEmail(connection.inviteeEmail);
    const subject = getEmailSubjectWithRoles('Connection Accepted', connection.inviterRole, connection.inviteeRole, connection.relationshipType);
    const roleDisplay = connection.inviterRole && connection.inviteeRole 
      ? `${connection.inviterRole.toLowerCase()}/${connection.inviteeRole.toLowerCase()}`
      : connection.relationshipType.toLowerCase();
    
    const htmlContent = `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Great News!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Your invitation was accepted</p>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
          <p style="color: #1e293b; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px;">
            <strong>${inviteeName}</strong> has accepted your ${roleDisplay} connection invitation!
          </p>
          
          <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0;">
            Your private ${roleDisplay} conversation space is now ready. You can start by asking the first question.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${appUrl}" style="display: inline-block; background: linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 12px rgba(79, 172, 254, 0.3);">
              Start Conversation
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 14px; margin: 0;">
            Happy connecting! Build meaningful relationships through thoughtful dialogue.
          </p>
        </div>
      </div>
    `;

    const textContent = `
Great news! ${inviteeName} has accepted your invitation to connect.

Your private conversation space is now ready. You can start by asking the first question.

Visit your dashboard to begin: ${appUrl}

Happy connecting!
The Deeper Team
    `;

    await storage.createEmail({
      toEmail: connection.inviterEmail,
      fromEmail: this.fromEmail,
      subject,
      htmlContent,
      textContent,
      emailType: "acceptance",
      connectionId: connection.id,
    });

    console.log(`[EMAIL] Acceptance notification stored for ${connection.inviterEmail}`);
  }

  async sendConnectionDeclined(connection: Connection): Promise<void> {
    const inviteeName = await storage.getUserDisplayNameByEmail(connection.inviteeEmail);
    const subject = getEmailSubjectWithRoles('Connection Declined', connection.inviterRole, connection.inviteeRole, connection.relationshipType);
    const roleDisplay = connection.inviterRole && connection.inviteeRole 
      ? `${connection.inviterRole.toLowerCase()}/${connection.inviteeRole.toLowerCase()}`
      : connection.relationshipType.toLowerCase();
    
    const htmlContent = `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Invitation Update</h1>
        </div>
        
        <div style="background: #f9fafb; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
          <p style="color: #374151; line-height: 1.6; margin: 0 0 20px 0;">
            ${inviteeName} has respectfully declined your ${roleDisplay} connection invitation.
          </p>
          
          <p style="color: #6B7280; line-height: 1.6; margin: 0;">
            Don't worry - meaningful connections take time. You can always try reaching out through other channels or invite them again in the future.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 14px; margin: 0;">
            Keep building meaningful relationships!
          </p>
        </div>
      </div>
    `;

    const textContent = `
${inviteeName} has respectfully declined your invitation to connect.

Don't worry - meaningful connections take time. You can always try reaching out through other channels or invite them again in the future.

Keep building meaningful relationships!
The Deeper Team
    `;

    await storage.createEmail({
      toEmail: connection.inviterEmail,
      fromEmail: this.fromEmail,
      subject,
      htmlContent,
      textContent,
      emailType: "decline",
      connectionId: connection.id,
    });

    console.log(`[EMAIL] Decline notification stored for ${connection.inviterEmail}`);
  }

  async sendTurnNotification(params: {
    recipientEmail: string;
    senderEmail: string;
    conversationId: number;
    relationshipType: string;
    senderRole?: string;
    recipientRole?: string;
    messageType: 'question' | 'response';
  }): Promise<void> {
    const appUrl = 'https://joindeeper.com';
    const senderName = await storage.getUserDisplayNameByEmail(params.senderEmail);
    const actionText = params.messageType === 'question' ? 'asked a question' : 'shared a response';
    const responseText = params.messageType === 'question' ? 'respond' : 'continue the conversation';
    const conversationContext = params.senderRole && params.recipientRole 
      ? `${params.senderRole.toLowerCase()}/${params.recipientRole.toLowerCase()}`
      : params.relationshipType.toLowerCase();

    const subject = `It's your turn! ${senderName} ${actionText}`;
    
    const htmlContent = `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Your Turn!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Time to continue your meaningful conversation</p>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
          <h2 style="color: #1e293b; margin: 0 0 20px 0;">Message waiting for you</h2>
          <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px;">
            <strong>${senderName}</strong> just ${actionText} in your ${conversationContext} conversation.
          </p>
          
          <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0;">
            It's now your turn to ${responseText} and continue this meaningful dialogue.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${appUrl}/conversation/${params.conversationId}" style="display: inline-block; background: linear-gradient(135deg, #4FACFE 0%, #00D4FF 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; box-shadow: 0 4px 12px rgba(79, 172, 254, 0.3);">
              Continue Conversation
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 14px; margin: 0;">
            This is your private, turn-based conversation space designed to deepen relationships through meaningful dialogue.
          </p>
        </div>
      </div>
    `;

    const textContent = `
Hi there!

${senderName} just ${actionText} in your ${params.relationshipType.toLowerCase()} conversation.

It's now your turn to ${responseText} and continue this meaningful dialogue.

Visit your conversation: ${appUrl}/conversation/${params.conversationId}

This is your private, turn-based conversation space designed to deepen your connection.

Best regards,
The Deeper Team
    `;

    // Store email in database as internal notification system
    await storage.createEmail({
      toEmail: params.recipientEmail,
      fromEmail: this.fromEmail,
      subject,
      htmlContent,
      textContent,
      emailType: "turn_notification",
      // connectionId is optional and can be omitted for test emails
    });

    console.log(`[EMAIL] Turn notification stored for ${params.recipientEmail}`);
  }
}

// Resilient email service with fallback capability
class FallbackEmailService implements EmailService {
  private primaryService: EmailService;
  private fallbackService: EmailService;

  constructor(primaryService: EmailService, fallbackService: EmailService) {
    this.primaryService = primaryService;
    this.fallbackService = fallbackService;
  }

  async sendConnectionInvitation(connection: Connection): Promise<void> {
    try {
      await this.primaryService.sendConnectionInvitation(connection);
    } catch (error) {
      console.log('[EMAIL] Primary service failed, using fallback...');
      await this.fallbackService.sendConnectionInvitation(connection);
    }
  }

  async sendConnectionAccepted(connection: Connection): Promise<void> {
    try {
      await this.primaryService.sendConnectionAccepted(connection);
    } catch (error) {
      console.log('[EMAIL] Primary service failed, using fallback...');
      await this.fallbackService.sendConnectionAccepted(connection);
    }
  }

  async sendConnectionDeclined(connection: Connection): Promise<void> {
    try {
      await this.primaryService.sendConnectionDeclined(connection);
    } catch (error) {
      console.log('[EMAIL] Primary service failed, using fallback...');
      await this.fallbackService.sendConnectionDeclined(connection);
    }
  }

  async sendTurnNotification(params: {
    recipientEmail: string;
    senderEmail: string;
    conversationId: number;
    relationshipType: string;
    messageType: 'question' | 'response';
  }): Promise<void> {
    try {
      await this.primaryService.sendTurnNotification(params);
    } catch (error) {
      console.log('[EMAIL] Primary service failed, using fallback for turn notification...');
      await this.fallbackService.sendTurnNotification(params);
    }
  }
}

// Email service factory with support for multiple providers
export function createEmailService(): EmailService {
  const sendGridApiKey = process.env.SENDGRID_API_KEY;
  const awsCredentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
  const emailProvider = process.env.EMAIL_PROVIDER; // 'sendgrid', 'ses', or undefined (defaults to sendgrid if available)
  
  // PRODUCTION SAFETY: Log provider selection for monitoring
  console.log('[EMAIL] Email provider selection:', {
    emailProvider: emailProvider || 'auto',
    sendGridAvailable: !!sendGridApiKey,
    awsCredentialsAvailable: !!awsCredentials,
    environment: process.env.NODE_ENV
  });

  // Create internal service as fallback for all configurations
  const internalService = new InternalEmailService();

  // Determine primary email service based on configuration
  let primaryService: EmailService;

  if (emailProvider === 'ses' && awsCredentials) {
    console.log('[EMAIL] Using Amazon SES production email service with internal database fallback');
    primaryService = new AmazonSESEmailService();
  } else if (emailProvider === 'sendgrid' && sendGridApiKey) {
    console.log('[EMAIL] Using SendGrid production email service with internal database fallback');
    primaryService = new ProductionEmailService(sendGridApiKey);
  } else if (sendGridApiKey && !emailProvider) {
    // TEMPORARY: Use SendGrid as default while AWS SES is being set up
    console.log('[EMAIL] Using SendGrid production email service (temporary default while AWS SES setup pending) with internal database fallback');
    primaryService = new ProductionEmailService(sendGridApiKey);
  } else if (awsCredentials && !emailProvider && sendGridApiKey) {
    // AWS SES available but using SendGrid as primary until SES is verified
    console.log('[EMAIL] AWS credentials available but using SendGrid primary until SES sender verification complete');
    primaryService = new ProductionEmailService(sendGridApiKey);
  } else {
    // No external email service available
    console.log('[EMAIL] No external email service configured, using internal database notification system only');
    return internalService;
  }

  // Always return with fallback to internal service for production safety
  return new FallbackEmailService(primaryService, internalService);
}

export const emailService = createEmailService();