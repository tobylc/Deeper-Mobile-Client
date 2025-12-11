/**
 * Utility script to fix conversation titles for existing conversations
 * This ensures all conversations have proper summarized titles based on their first question
 */

import { finalDb } from './db-final';
import { conversations, messages } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { generateRelationshipSpecificTitle } from './thread-naming';

export async function fixConversationTitles() {
  try {
    console.log('Starting conversation title fix...');
    
    // Get all conversations without titles
    const conversationsWithoutTitles = await finalDb
      .select()
      .from(conversations)
      .where(eq(conversations.title, null));
    
    console.log(`Found ${conversationsWithoutTitles.length} conversations without titles`);
    
    let fixedCount = 0;
    
    for (const conversation of conversationsWithoutTitles) {
      try {
        // Get the first message in this conversation
        const firstMessage = await finalDb
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conversation.id))
          .orderBy(messages.createdAt)
          .limit(1);
        
        if (firstMessage.length > 0 && firstMessage[0].type === 'question') {
          // Generate title based on the first question
          const threadTitle = generateRelationshipSpecificTitle(
            firstMessage[0].content,
            conversation.relationshipType
          );
          
          // Update the conversation with the generated title
          await finalDb
            .update(conversations)
            .set({ title: threadTitle })
            .where(eq(conversations.id, conversation.id));
          
          console.log(`Fixed conversation ${conversation.id}: "${threadTitle}"`);
          fixedCount++;
        }
      } catch (error) {
        console.error(`Error fixing conversation ${conversation.id}:`, error);
      }
    }
    
    console.log(`Fixed ${fixedCount} conversation titles`);
    return { success: true, fixed: fixedCount };
    
  } catch (error) {
    console.error('Error in fixConversationTitles:', error);
    return { success: false, error: error.message };
  }
}

// Also add a function to update existing titles to be more concise
export async function makeConversationTitlesMoreConcise() {
  try {
    console.log('Making conversation titles more concise...');
    
    // Get all conversations with titles
    const conversationsWithTitles = await finalDb
      .select()
      .from(conversations)
      .where(ne(conversations.title, null));
    
    console.log(`Found ${conversationsWithTitles.length} conversations with titles`);
    
    let updatedCount = 0;
    
    for (const conversation of conversationsWithTitles) {
      try {
        if (conversation.title && conversation.title.length > 50) {
          // Get the first message to regenerate a more concise title
          const firstMessage = await finalDb
            .select()
            .from(messages)
            .where(eq(messages.conversationId, conversation.id))
            .orderBy(messages.createdAt)
            .limit(1);
          
          if (firstMessage.length > 0 && firstMessage[0].type === 'question') {
            // Generate a more concise title
            const newTitle = generateRelationshipSpecificTitle(
              firstMessage[0].content,
              conversation.relationshipType
            );
            
            // Only update if the new title is shorter
            if (newTitle.length < conversation.title.length) {
              await finalDb
                .update(conversations)
                .set({ title: newTitle })
                .where(eq(conversations.id, conversation.id));
              
              console.log(`Updated conversation ${conversation.id}: "${conversation.title}" -> "${newTitle}"`);
              updatedCount++;
            }
          }
        }
      } catch (error) {
        console.error(`Error updating conversation ${conversation.id}:`, error);
      }
    }
    
    console.log(`Updated ${updatedCount} conversation titles to be more concise`);
    return { success: true, updated: updatedCount };
    
  } catch (error) {
    console.error('Error in makeConversationTitlesMoreConcise:', error);
    return { success: false, error: error.message };
  }
}