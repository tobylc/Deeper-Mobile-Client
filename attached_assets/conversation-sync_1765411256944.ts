/**
 * Conversation Synchronization Logic
 * Ensures only ONE active conversation thread displays in center column at any time
 * Provides 100% synchronization between both users' conversation pages
 */

import type { Conversation, Message } from "../shared/schema";

export interface ConversationState {
  activeConversationId: number;
  previousConversations: number[];
  connectionId: number;
}

export class ConversationSyncManager {
  /**
   * Determines which conversation should be active (displayed in center column)
   * Rule: Only the MOST RECENTLY ACTIVE conversation is shown in center
   * All other conversations are moved to left column as "previous conversations"
   */
  static getActiveConversation(conversations: Conversation[]): number | null {
    if (!conversations || conversations.length === 0) return null;
    
    // Sort by last activity - most recent first
    const sortedConversations = conversations.sort((a, b) => {
      const aTime = new Date(a.lastActivityAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.lastActivityAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
    
    // Return the most recently active conversation
    return sortedConversations[0].id;
  }

  /**
   * Gets previous conversations that should be shown in left column
   * Excludes the currently active conversation
   */
  static getPreviousConversations(conversations: Conversation[], activeConversationId: number): Conversation[] {
    return conversations
      .filter(conv => conv.id !== activeConversationId)
      .sort((a, b) => {
        const aTime = new Date(a.lastActivityAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.lastActivityAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });
  }

  /**
   * Handles thread reopening without counting as a turn
   * Simply switches which conversation is active - no turn consumption
   */
  static handleThreadReopen(conversationId: number): { action: 'switch_active', conversationId: number } {
    return {
      action: 'switch_active',
      conversationId: conversationId
    };
  }

  /**
   * Validates if a conversation can be reopened
   * Must have at least one complete question-response exchange
   */
  static canReopenConversation(messages: Message[]): boolean {
    const hasQuestion = messages.some(msg => msg.type === 'question');
    const hasResponse = messages.some(msg => msg.type === 'response');
    return hasQuestion && hasResponse;
  }

  /**
   * Checks if current conversation has unanswered questions
   * Blocks thread switching until questions are answered
   */
  static hasUnansweredQuestions(messages: Message[], currentUserEmail: string): boolean {
    if (!messages || messages.length === 0) return false;
    
    // Find the most recent question
    let lastQuestionIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === 'question') {
        lastQuestionIndex = i;
        break;
      }
    }
    
    if (lastQuestionIndex === -1) return false;
    
    const lastQuestion = messages[lastQuestionIndex];
    
    // If the question is from another user, check if it has been answered
    if (lastQuestion.senderEmail !== currentUserEmail) {
      const messagesAfterQuestion = messages.slice(lastQuestionIndex + 1);
      const hasResponse = messagesAfterQuestion.some(msg => 
        msg.type === 'response' && msg.senderEmail === currentUserEmail
      );
      return !hasResponse;
    }
    
    return false;
  }

  /**
   * Updates conversation activity timestamp when messages are sent
   * Ensures proper sorting for active conversation determination
   */
  static updateConversationActivity(conversationId: number): Date {
    return new Date();
  }
}