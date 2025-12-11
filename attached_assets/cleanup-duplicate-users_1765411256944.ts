import { storage } from "./storage";
import { db } from "./db";
import { users, connections, conversations, messages } from "../shared/schema";
import { eq, or } from "drizzle-orm";

interface DuplicateUser {
  emailUser: any;
  googleUser: any;
}

/**
 * Cleanup utility to merge duplicate user accounts
 * This fixes the issue where Google OAuth creates separate accounts
 * instead of linking to existing email-based accounts
 */
export async function cleanupDuplicateUsers() {
  console.log('[CLEANUP] Starting duplicate user cleanup...');
  
  try {
    // Find all users with Google IDs that have corresponding email users
    const allUsers = await db.select().from(users);
    
    const duplicates: DuplicateUser[] = [];
    const googleUsers = allUsers.filter(user => user.googleId && user.id.startsWith('google_'));
    
    for (const googleUser of googleUsers) {
      if (googleUser.email) {
        // Find corresponding email-based user
        const emailUser = allUsers.find(user => 
          user.email === googleUser.email && 
          !user.googleId && 
          !user.id.startsWith('google_')
        );
        
        if (emailUser) {
          duplicates.push({ emailUser, googleUser });
        }
      }
    }
    
    console.log(`[CLEANUP] Found ${duplicates.length} duplicate user pairs to merge`);
    
    // Merge each duplicate pair
    for (const { emailUser, googleUser } of duplicates) {
      await mergeDuplicateUsers(emailUser, googleUser);
    }
    
    console.log('[CLEANUP] Duplicate user cleanup completed successfully');
    return duplicates.length;
  } catch (error) {
    console.error('[CLEANUP] Error during duplicate user cleanup:', error);
    throw error;
  }
}

/**
 * Merge a Google OAuth user into an existing email-based user
 */
async function mergeDuplicateUsers(emailUser: any, googleUser: any) {
  console.log(`[CLEANUP] Merging users: ${emailUser.email} (${emailUser.id}) <- ${googleUser.id}`);
  
  try {
    // 1. Update the email user with Google ID and any missing profile data
    await db
      .update(users)
      .set({
        googleId: googleUser.googleId,
        firstName: emailUser.firstName || googleUser.firstName,
        lastName: emailUser.lastName || googleUser.lastName,
        profileImageUrl: emailUser.profileImageUrl || googleUser.profileImageUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, emailUser.id));
    
    // 2. Update all connections that reference the Google user
    await db
      .update(connections)
      .set({ inviterEmail: emailUser.email })
      .where(eq(connections.inviterEmail, googleUser.email));
    
    await db
      .update(connections)
      .set({ inviteeEmail: emailUser.email })
      .where(eq(connections.inviteeEmail, googleUser.email));
    
    // 3. Update all conversations that reference the Google user
    await db
      .update(conversations)
      .set({ participant1Email: emailUser.email })
      .where(eq(conversations.participant1Email, googleUser.email));
    
    await db
      .update(conversations)
      .set({ participant2Email: emailUser.email })
      .where(eq(conversations.participant2Email, googleUser.email));
    
    await db
      .update(conversations)
      .set({ currentTurn: emailUser.email })
      .where(eq(conversations.currentTurn, googleUser.email));
    
    // 4. Update all messages that reference the Google user
    await db
      .update(messages)
      .set({ senderEmail: emailUser.email })
      .where(eq(messages.senderEmail, googleUser.email));
    
    // 5. Delete the duplicate Google user
    await db
      .delete(users)
      .where(eq(users.id, googleUser.id));
    
    console.log(`[CLEANUP] Successfully merged ${googleUser.id} into ${emailUser.id}`);
  } catch (error) {
    console.error(`[CLEANUP] Error merging users ${emailUser.id} and ${googleUser.id}:`, error);
    throw error;
  }
}

/**
 * Run cleanup and return results
 */
export async function runUserCleanup(): Promise<{ merged: number; message: string }> {
  try {
    const mergedCount = await cleanupDuplicateUsers();
    return {
      merged: mergedCount,
      message: `Successfully merged ${mergedCount} duplicate user accounts`
    };
  } catch (error) {
    console.error('[CLEANUP] Cleanup failed:', error);
    return {
      merged: 0,
      message: `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}