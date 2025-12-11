import { 
  users, connections, conversations, messages, emails, smsMessages, verificationCodes, emailCampaigns,
  type User, type InsertUser,
  type Connection, type InsertConnection,
  type Conversation, type InsertConversation,
  type Message, type InsertMessage,
  type Email, type InsertEmail,
  type SMSMessage, type InsertSMSMessage,
  type VerificationCode, type InsertVerificationCode,
  type EmailCampaign, type InsertEmailCampaign
} from "../shared/schema";
import { db } from "./db";
import { eq, or, and, sql, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createInviterUser(user: InsertUser): Promise<User>;
  upsertUser(user: InsertUser): Promise<User>;
  upsertUserById(user: InsertUser): Promise<User>;
  updateUser(userId: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  linkGoogleAccount(userId: string, googleId: string): Promise<User | undefined>;
  updateUserProfileImage(email: string, profileImageUrl: string): Promise<User | undefined>;
  updateUserSubscription(userId: string, subscriptionData: {
    subscriptionTier: string;
    subscriptionStatus: string;
    maxConnections: number;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionExpiresAt?: Date;
    trialStartedAt?: Date;
    trialExpiresAt?: Date;
    phoneNumber?: string;
    phoneVerified?: boolean;
    notificationPreference?: string;
  }): Promise<User | undefined>;
  
  // Trial management
  initializeTrial(userId: string): Promise<User | undefined>;
  checkTrialStatus(userId: string): Promise<{ isExpired: boolean; daysRemaining: number; user: User | undefined }>;
  expireTrialUser(userId: string): Promise<User | undefined>;

  // Connections
  getConnection(id: number): Promise<Connection | undefined>;
  getConnectionsByEmail(email: string): Promise<Connection[]>;
  getInitiatedConnectionsCount(email: string): Promise<number>;
  createConnection(connection: InsertConnection): Promise<Connection>;
  updateConnectionStatus(id: number, status: string, acceptedAt?: Date): Promise<Connection | undefined>;
  isUserInvitee(email: string): Promise<boolean>;

  // Conversations
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationsByEmail(email: string): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversationTurn(id: number, currentTurn: string): Promise<Conversation | undefined>;

  // Messages
  getMessagesByConversationId(conversationId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Emails
  getEmailsByEmail(email: string): Promise<Email[]>;
  createEmail(email: InsertEmail): Promise<Email>;
  getEmailById(id: number): Promise<Email | undefined>;
  getEmails(): Promise<Email[]>;

  // SMS Messages
  getSMSMessagesByPhone(phoneNumber: string): Promise<SMSMessage[]>;
  createSMSMessage(sms: InsertSMSMessage): Promise<SMSMessage>;
  getSMSMessages(): Promise<SMSMessage[]>;

  // Helper methods for user display names
  getUserDisplayNameByEmail(email: string): Promise<string>;

  // Verification Codes
  createVerificationCode(code: InsertVerificationCode): Promise<VerificationCode>;
  getVerificationCode(email: string, phoneNumber: string): Promise<VerificationCode | undefined>;
  markVerificationCodeUsed(id: number): Promise<void>;
  cleanupExpiredVerificationCodes(): Promise<void>;

  // Email Campaigns
  createEmailCampaign(campaign: InsertEmailCampaign): Promise<EmailCampaign>;
  getPendingEmailCampaigns(before: Date): Promise<EmailCampaign[]>;
  updateEmailCampaignStatus(id: number, status: string): Promise<EmailCampaign | undefined>;
  cancelPendingEmailCampaigns(userEmail: string, campaignTypes: string[]): Promise<void>;
  getConnectionById(id: number): Promise<Connection | undefined>;
  getConversationById(id: number): Promise<Conversation | undefined>;
  
  // Admin Email Campaign Management
  getEmailCampaignsWithFilters(filters: {
    status?: string;
    campaignType?: string;
    userEmail?: string;
    startDate?: string;
    endDate?: string;
    limit: number;
    offset: number;
  }): Promise<EmailCampaign[]>;
  getEmailCampaignsCount(filters: {
    status?: string;
    campaignType?: string;
    userEmail?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<number>;
  getEmailCampaignStats(): Promise<{
    total: number;
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
    byType: Record<string, number>;
  }>;
  updateEmailCampaignSchedule(id: number, scheduledAt: Date): Promise<EmailCampaign | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    const allUsers = await db.select().from(users);
    return allUsers;
  }

  async createUser(userData: InsertUser): Promise<User> {
    // Default user creation - this should only be used for invitees
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        // Use provided values if specified, otherwise use defaults for invitees
        subscriptionTier: userData.subscriptionTier || 'free',
        subscriptionStatus: userData.subscriptionStatus || 'forever',
        maxConnections: userData.maxConnections !== undefined ? userData.maxConnections : 0, // Invitees cannot send invitations
      })
      .returning();
    return user;
  }

  async createInviterUser(userData: InsertUser): Promise<User> {
    // Initialize 60-day trial for new inviters (OAuth signups) - default to basic tier 60-day trial
    const trialStartsAt = new Date();
    const trialExpiresAt = new Date(trialStartsAt.getTime() + (60 * 24 * 60 * 60 * 1000)); // 60 days from now
    
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        subscriptionTier: 'trial',
        subscriptionStatus: 'active',
        maxConnections: 1,
        trialStartedAt: trialStartsAt,
        trialExpiresAt: trialExpiresAt,
        subscriptionExpiresAt: trialExpiresAt
      })
      .returning();
    return user;
  }

  async getUserByEmail(email: string | null | undefined): Promise<User | undefined> {
    if (!email) return undefined;
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async upsertUser(userData: InsertUser): Promise<User> {
    // First try to find existing user by email
    const existingUser = userData.email ? await this.getUserByEmail(userData.email) : undefined;
    
    if (existingUser) {
      // Update existing user
      const [user] = await db
        .update(users)
        .set(userData)
        .where(eq(users.email, userData.email!))
        .returning();
      return user;
    } else {
      // Create new user - use createUser (for invitees) unless specified otherwise
      return await this.createUser(userData);
    }
  }

  async upsertUserById(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user || undefined;
  }

  async updateUser(userId: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async linkGoogleAccount(userId: string, googleId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        googleId: googleId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async updateUserProfileImage(email: string, profileImageUrl: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        profileImageUrl: profileImageUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.email, email))
      .returning();
    return user || undefined;
  }

  async updateUserSubscription(userId: string, subscriptionData: {
    subscriptionTier: string;
    subscriptionStatus: string;
    maxConnections: number;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionExpiresAt?: Date;
    trialStartedAt?: Date;
    trialExpiresAt?: Date;
    phoneNumber?: string;
    phoneVerified?: boolean;
    notificationPreference?: string;
  }): Promise<User | undefined> {
    console.log(`[STORAGE] ======== UPDATING USER SUBSCRIPTION ========`);
    console.log(`[STORAGE] User ID: ${userId}`);
    console.log(`[STORAGE] Input data:`, JSON.stringify(subscriptionData, null, 2));
    
    const updateData: any = {
      subscriptionTier: subscriptionData.subscriptionTier,
      subscriptionStatus: subscriptionData.subscriptionStatus,
      maxConnections: subscriptionData.maxConnections,
      updatedAt: new Date(),
    };

    if (subscriptionData.stripeCustomerId !== undefined) {
      updateData.stripeCustomerId = subscriptionData.stripeCustomerId;
    }
    if (subscriptionData.stripeSubscriptionId !== undefined) {
      updateData.stripeSubscriptionId = subscriptionData.stripeSubscriptionId;
    }
    if (subscriptionData.subscriptionExpiresAt !== undefined) {
      updateData.subscriptionExpiresAt = subscriptionData.subscriptionExpiresAt;
    }
    if (subscriptionData.trialStartedAt !== undefined) {
      updateData.trialStartedAt = subscriptionData.trialStartedAt;
    }
    if (subscriptionData.trialExpiresAt !== undefined) {
      updateData.trialExpiresAt = subscriptionData.trialExpiresAt;
    }
    if (subscriptionData.phoneNumber !== undefined) {
      updateData.phoneNumber = subscriptionData.phoneNumber;
    }
    if (subscriptionData.phoneVerified !== undefined) {
      updateData.phoneVerified = subscriptionData.phoneVerified;
    }
    if (subscriptionData.notificationPreference !== undefined) {
      updateData.notificationPreference = subscriptionData.notificationPreference;
    }

    console.log(`[STORAGE] Final update data:`, JSON.stringify(updateData, null, 2));

    try {
      const [user] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();
      
      console.log(`[STORAGE] Database update completed. Returned user:`, user ? {
        id: user.id,
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        maxConnections: user.maxConnections,
        stripeSubscriptionId: user.stripeSubscriptionId,
        updatedAt: user.updatedAt
      } : 'NULL');
      
      return user || undefined;
    } catch (error) {
      console.error(`[STORAGE] Database update failed:`, error);
      console.error(`[STORAGE] Error details:`, {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        userId,
        updateData
      });
      throw error;
    }
  }

  // Connections
  async getConnection(id: number): Promise<Connection | undefined> {
    const [connection] = await db.select().from(connections).where(eq(connections.id, id));
    return connection || undefined;
  }

  async getConnectionsByEmail(email: string): Promise<Connection[]> {
    return await db
      .select()
      .from(connections)
      .where(or(eq(connections.inviterEmail, email), eq(connections.inviteeEmail, email)));
  }

  async getInitiatedConnectionsCount(email: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(connections)
      .where(eq(connections.inviterEmail, email));
    return result[0]?.count || 0;
  }

  async isUserInvitee(email: string): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(connections)
      .where(eq(connections.inviteeEmail, email));
    return (result[0]?.count || 0) > 0;
  }

  async createConnection(insertConnection: InsertConnection): Promise<Connection> {
    const [connection] = await db
      .insert(connections)
      .values({
        ...insertConnection,
        status: 'pending',
      })
      .returning();
    return connection;
  }

  async updateConnectionStatus(id: number, status: string, acceptedAt?: Date): Promise<Connection | undefined> {
    const [connection] = await db
      .update(connections)
      .set({
        status,
        acceptedAt: acceptedAt || null,
      })
      .where(eq(connections.id, id))
      .returning();
    return connection || undefined;
  }

  // Conversations
  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation || undefined;
  }

  async getConversationsByEmail(email: string): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .where(or(eq(conversations.participant1Email, email), eq(conversations.participant2Email, email)));
  }

  async getConversationsByConnection(connectionId: number): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.connectionId, connectionId))
      .orderBy(conversations.lastActivityAt);
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const [conversation] = await db
      .insert(conversations)
      .values({
        ...insertConversation,
        status: 'active',
      })
      .returning();
    return conversation;
  }

  async updateConversationTurn(id: number, currentTurn: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .update(conversations)
      .set({ currentTurn })
      .where(eq(conversations.id, id))
      .returning();
    return conversation || undefined;
  }

  async updateConversationTitle(id: number, title: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .update(conversations)
      .set({ title })
      .where(eq(conversations.id, id))
      .returning();
    return conversation || undefined;
  }

  // Messages
  async getMessagesByConversationId(conversationId: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async getMessages(conversationId: number): Promise<Message[]> {
    return this.getMessagesByConversationId(conversationId);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }

  // Emails
  async getEmailsByEmail(email: string): Promise<Email[]> {
    return await db
      .select()
      .from(emails)
      .where(or(eq(emails.toEmail, email), eq(emails.fromEmail, email)))
      .orderBy(emails.sentAt);
  }

  async createEmail(insertEmail: InsertEmail): Promise<Email> {
    if (!insertEmail || Object.keys(insertEmail).length === 0) {
      throw new Error('Email data is required');
    }
    const [email] = await db
      .insert(emails)
      .values(insertEmail)
      .returning();
    return email;
  }

  async getEmailById(id: number): Promise<Email | undefined> {
    const [email] = await db
      .select()
      .from(emails)
      .where(eq(emails.id, id));
    return email;
  }

  async getEmails(): Promise<Email[]> {
    try {
      const result = await db.select().from(emails).orderBy(desc(emails.id));
      return result;
    } catch (error) {
      console.error("Error getting all emails:", error);
      return [];
    }
  }

  // SMS Messages
  async getSMSMessagesByPhone(phoneNumber: string): Promise<SMSMessage[]> {
    try {
      const result = await db
        .select()
        .from(smsMessages)
        .where(eq(smsMessages.toPhone, phoneNumber))
        .orderBy(desc(smsMessages.id));
      return result;
    } catch (error) {
      console.error("Error getting SMS messages by phone:", error);
      return [];
    }
  }

  async createSMSMessage(smsData: InsertSMSMessage): Promise<SMSMessage> {
    const [sms] = await db
      .insert(smsMessages)
      .values(smsData)
      .returning();
    return sms;
  }

  async getSMSMessages(): Promise<SMSMessage[]> {
    try {
      const result = await db.select().from(smsMessages).orderBy(desc(smsMessages.id));
      return result;
    } catch (error) {
      console.error("Error getting all SMS messages:", error);
      return [];
    }
  }

  async getUserDisplayNameByEmail(email: string): Promise<string> {
    const user = await this.getUserByEmail(email);
    if (!user) return email.split('@')[0];
    
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    
    if (user.firstName) {
      return user.firstName;
    }
    
    if (user.lastName) {
      return user.lastName;
    }
    
    return email.split('@')[0];
  }

  // Verification Codes
  async createVerificationCode(codeData: InsertVerificationCode): Promise<VerificationCode> {
    const [verificationCode] = await db
      .insert(verificationCodes)
      .values(codeData)
      .returning();
    return verificationCode;
  }

  async getVerificationCode(email: string, phoneNumber: string): Promise<VerificationCode | undefined> {
    const [code] = await db
      .select()
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.email, email),
          eq(verificationCodes.phoneNumber, phoneNumber),
          eq(verificationCodes.verified, false),
          sql`${verificationCodes.expiresAt} > NOW()`
        )
      )
      .orderBy(desc(verificationCodes.createdAt))
      .limit(1);
    return code;
  }

  async markVerificationCodeUsed(id: number): Promise<void> {
    await db
      .update(verificationCodes)
      .set({ verified: true })
      .where(eq(verificationCodes.id, id));
  }

  async cleanupExpiredVerificationCodes(): Promise<void> {
    await db
      .delete(verificationCodes)
      .where(sql`${verificationCodes.expiresAt} < NOW()`);
  }

  // Trial Management
  async initializeTrial(userId: string): Promise<User | undefined> {
    const trialStartedAt = new Date();
    const trialExpiresAt = new Date(trialStartedAt);
    trialExpiresAt.setDate(trialExpiresAt.getDate() + 60); // 60 days from now

    const [user] = await db
      .update(users)
      .set({
        subscriptionTier: 'trial',
        subscriptionStatus: 'active',
        maxConnections: 1,
        trialStartedAt,
        trialExpiresAt,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async checkTrialStatus(userId: string): Promise<{ isExpired: boolean; daysRemaining: number; user: User | undefined }> {
    const user = await this.getUser(userId);
    if (!user) return { isExpired: true, daysRemaining: 0, user: undefined };

    // Clean up subscription tier to handle potential trailing spaces
    const cleanTier = user.subscriptionTier?.trim();

    // If user has paid subscription, trial doesn't apply
    if (cleanTier && !['trial', 'free'].includes(cleanTier)) {
      return { isExpired: false, daysRemaining: 0, user };
    }

    // For invitee users (free forever), never expired
    if (cleanTier === 'free' && user.subscriptionStatus === 'forever') {
      return { isExpired: false, daysRemaining: 0, user };
    }

    // For trial users, check expiration
    if (cleanTier === 'trial') {
      if (!user.trialExpiresAt) {
        // Initialize trial if not set
        const updatedUser = await this.initializeTrial(userId);
        return { isExpired: false, daysRemaining: 60, user: updatedUser };
      }

      const now = new Date();
      const isExpired = now > user.trialExpiresAt;
      const daysRemaining = Math.max(0, Math.ceil((user.trialExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      return { isExpired, daysRemaining, user };
    }

    // For free users without trial or unknown status, consider expired
    return { isExpired: true, daysRemaining: 0, user };
  }

  async expireTrialUser(userId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        subscriptionStatus: 'trial_expired',
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Email Campaigns
  async createEmailCampaign(campaign: InsertEmailCampaign): Promise<EmailCampaign> {
    const [emailCampaign] = await db
      .insert(emailCampaigns)
      .values(campaign)
      .returning();
    return emailCampaign;
  }

  async getPendingEmailCampaigns(before: Date): Promise<EmailCampaign[]> {
    return await db
      .select()
      .from(emailCampaigns)
      .where(
        and(
          eq(emailCampaigns.status, 'scheduled'),
          sql`${emailCampaigns.scheduledAt} <= ${before}`
        )
      )
      .orderBy(emailCampaigns.scheduledAt);
  }

  async updateEmailCampaignStatus(id: number, status: string): Promise<EmailCampaign | undefined> {
    const [campaign] = await db
      .update(emailCampaigns)
      .set({ 
        status,
        sentAt: status === 'sent' ? new Date() : undefined
      })
      .where(eq(emailCampaigns.id, id))
      .returning();
    return campaign;
  }

  async cancelPendingEmailCampaigns(userEmail: string, campaignTypes: string[]): Promise<void> {
    await db
      .update(emailCampaigns)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(emailCampaigns.userEmail, userEmail),
          eq(emailCampaigns.status, 'scheduled'),
          sql`${emailCampaigns.campaignType} = ANY(${campaignTypes})`
        )
      );
  }

  async getConnectionById(id: number): Promise<Connection | undefined> {
    const [connection] = await db
      .select()
      .from(connections)
      .where(eq(connections.id, id));
    return connection;
  }

  async getConversationById(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    return conversation;
  }

  // Admin Email Campaign Management Implementation
  async getEmailCampaignsWithFilters(filters: {
    status?: string;
    campaignType?: string;
    userEmail?: string;
    startDate?: string;
    endDate?: string;
    limit: number;
    offset: number;
  }): Promise<EmailCampaign[]> {
    let query = db.select().from(emailCampaigns);
    const conditions = [];

    if (filters.status) {
      conditions.push(eq(emailCampaigns.status, filters.status));
    }
    if (filters.campaignType) {
      conditions.push(eq(emailCampaigns.campaignType, filters.campaignType));
    }
    if (filters.userEmail) {
      conditions.push(eq(emailCampaigns.userEmail, filters.userEmail));
    }
    if (filters.startDate) {
      conditions.push(sql`${emailCampaigns.createdAt} >= ${new Date(filters.startDate)}`);
    }
    if (filters.endDate) {
      conditions.push(sql`${emailCampaigns.createdAt} <= ${new Date(filters.endDate)}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query
      .orderBy(desc(emailCampaigns.createdAt))
      .limit(filters.limit)
      .offset(filters.offset);
  }

  async getEmailCampaignsCount(filters: {
    status?: string;
    campaignType?: string;
    userEmail?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<number> {
    let query = db.select({ count: sql<number>`count(*)` }).from(emailCampaigns);
    const conditions = [];

    if (filters.status) {
      conditions.push(eq(emailCampaigns.status, filters.status));
    }
    if (filters.campaignType) {
      conditions.push(eq(emailCampaigns.campaignType, filters.campaignType));
    }
    if (filters.userEmail) {
      conditions.push(eq(emailCampaigns.userEmail, filters.userEmail));
    }
    if (filters.startDate) {
      conditions.push(sql`${emailCampaigns.createdAt} >= ${new Date(filters.startDate)}`);
    }
    if (filters.endDate) {
      conditions.push(sql`${emailCampaigns.createdAt} <= ${new Date(filters.endDate)}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const [result] = await query;
    return result.count;
  }

  async getEmailCampaignStats(): Promise<{
    total: number;
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
    byType: Record<string, number>;
  }> {
    // Get status counts
    const statusCounts = await db
      .select({
        status: emailCampaigns.status,
        count: sql<number>`count(*)`
      })
      .from(emailCampaigns)
      .groupBy(emailCampaigns.status);

    // Get campaign type counts
    const typeCounts = await db
      .select({
        campaignType: emailCampaigns.campaignType,
        count: sql<number>`count(*)`
      })
      .from(emailCampaigns)
      .groupBy(emailCampaigns.campaignType);

    const stats = {
      total: 0,
      pending: 0,
      sent: 0,
      failed: 0,
      cancelled: 0,
      byType: {} as Record<string, number>
    };

    // Process status counts
    for (const { status, count } of statusCounts) {
      stats.total += count;
      if (status === 'scheduled') stats.pending = count;
      else if (status === 'sent') stats.sent = count;
      else if (status === 'failed') stats.failed = count;
      else if (status === 'cancelled') stats.cancelled = count;
    }

    // Process type counts
    for (const { campaignType, count } of typeCounts) {
      stats.byType[campaignType] = count;
    }

    return stats;
  }

  async updateEmailCampaignSchedule(id: number, scheduledAt: Date): Promise<EmailCampaign | undefined> {
    const [campaign] = await db
      .update(emailCampaigns)
      .set({ scheduledAt })
      .where(eq(emailCampaigns.id, id))
      .returning();
    return campaign;
  }
}

export const storage = new DatabaseStorage();

// Export individual functions for convenience
export const getUserByEmail = (email: string) => storage.getUserByEmail(email);
export const getUserDisplayNameByEmail = (email: string) => storage.getUserDisplayNameByEmail(email);
