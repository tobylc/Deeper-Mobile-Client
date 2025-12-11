import { emailService, EmailService } from "./email";
import { smsService, SMSService } from "./sms";
import { Connection } from "../shared/schema";
import { storage } from "./storage";

export interface NotificationParams {
  recipientEmail: string;
  senderEmail: string;
  conversationId: number;
  relationshipType: string;
  messageType: 'question' | 'response';
}

export class UnifiedNotificationService {
  constructor(
    private emailService: EmailService,
    private smsService: SMSService
  ) {}

  async sendConnectionInvitation(connection: Connection): Promise<void> {
    const invitee = await storage.getUserByEmail(connection.inviteeEmail);
    
    // Always send email notification for invitations
    await this.emailService.sendConnectionInvitation(connection);
    
    // Send SMS if user has phone number and prefers SMS notifications
    if (invitee?.phoneNumber && invitee.phoneVerified && 
        (invitee.notificationPreference === 'sms' || invitee.notificationPreference === 'both')) {
      const connectionWithPhone = {
        ...connection,
        inviteePhone: invitee.phoneNumber,
        inviterName: await storage.getUserDisplayNameByEmail(connection.inviterEmail)
      };
      await this.smsService.sendConnectionInvitation(connectionWithPhone);
    }
  }

  async sendConnectionAccepted(connection: Connection): Promise<void> {
    const inviter = await storage.getUserByEmail(connection.inviterEmail);
    
    // Always send email notification
    await this.emailService.sendConnectionAccepted(connection);
    
    // Send SMS if user has phone number and prefers SMS notifications
    if (inviter?.phoneNumber && inviter.phoneVerified && 
        (inviter.notificationPreference === 'sms' || inviter.notificationPreference === 'both')) {
      const connectionWithPhone = {
        ...connection,
        inviterPhone: inviter.phoneNumber,
        inviteeName: await storage.getUserDisplayNameByEmail(connection.inviteeEmail)
      };
      await this.smsService.sendConnectionAccepted(connectionWithPhone);
    }
  }

  async sendConnectionDeclined(connection: Connection): Promise<void> {
    const inviter = await storage.getUserByEmail(connection.inviterEmail);
    
    // Always send email notification
    await this.emailService.sendConnectionDeclined(connection);
    
    // Send SMS if user has phone number and prefers SMS notifications
    if (inviter?.phoneNumber && inviter.phoneVerified && 
        (inviter.notificationPreference === 'sms' || inviter.notificationPreference === 'both')) {
      const connectionWithPhone = {
        ...connection,
        inviterPhone: inviter.phoneNumber,
        inviteeName: await storage.getUserDisplayNameByEmail(connection.inviteeEmail)
      };
      await this.smsService.sendConnectionDeclined(connectionWithPhone);
    }
  }

  async sendTurnNotification(params: NotificationParams): Promise<void> {
    const recipient = await storage.getUserByEmail(params.recipientEmail);
    const senderName = await storage.getUserDisplayNameByEmail(params.senderEmail);
    
    // Email notification parameters
    const emailParams = {
      recipientEmail: params.recipientEmail,
      senderEmail: params.senderEmail,
      conversationId: params.conversationId,
      relationshipType: params.relationshipType,
      messageType: params.messageType
    };

    // SMS notification parameters
    const smsParams = {
      recipientPhone: recipient?.phoneNumber || '',
      senderName,
      conversationId: params.conversationId,
      relationshipType: params.relationshipType,
      messageType: params.messageType
    };

    // Send notifications based on user preference
    if (!recipient || recipient.notificationPreference === 'email' || recipient.notificationPreference === 'both') {
      await this.emailService.sendTurnNotification(emailParams);
    }

    if (recipient?.phoneNumber && recipient.phoneVerified && 
        (recipient.notificationPreference === 'sms' || recipient.notificationPreference === 'both')) {
      await this.smsService.sendTurnNotification(smsParams);
    }
  }

  async sendPhoneVerification(phoneNumber: string): Promise<string> {
    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    await this.smsService.sendVerificationCode(phoneNumber, code);
    
    return code;
  }
}

export const notificationService = new UnifiedNotificationService(emailService, smsService);