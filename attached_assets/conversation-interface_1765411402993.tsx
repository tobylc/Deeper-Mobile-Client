import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Send, Type, Mic, ArrowRight, Clock, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserDisplayName } from '@/hooks/useUserDisplayName';
import ProfileAvatar from '@/components/profile-avatar';
import VoiceRecorder from '@/components/voice-recorder';
import VoiceMessageDisplay from '@/components/voice-message-display';
import TranscriptionProgress from '@/components/transcription-progress';
import ThoughtfulResponsePopup from '@/components/thoughtful-response-popup';

import type { Message } from '@shared/schema';

interface User {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

interface Connection {
  id: number;
  inviterEmail: string;
  inviteeEmail: string;
  relationshipType: string;
  inviterRole?: string;
  inviteeRole?: string;
}

interface ConversationInterfaceProps {
  messages: Message[];
  currentUserEmail: string;
  participant1Email: string;
  participant2Email: string;
  isMyTurn: boolean;
  relationshipType: string;
  connection?: Connection;
  newMessage: string;
  setNewMessage: (message: string) => void;
  onSendMessage: () => void;

  onRecordingStart: () => void;
  isSending: boolean;
  nextMessageType: 'question' | 'response';
  hasStartedResponse?: boolean;
  responseStartTime?: Date | null;
  onTimerStart?: () => void;
  conversationId?: number;
  isFromQuestionSuggestions?: boolean;
}

const ConversationInterface = memo(function ConversationInterface({ 
  messages,
  currentUserEmail,
  participant1Email,
  participant2Email,
  isMyTurn,
  relationshipType,
  connection,
  newMessage,
  setNewMessage,
  onSendMessage,
  onRecordingStart,
  isSending,
  nextMessageType,
  conversationId,
  hasStartedResponse = false,
  responseStartTime = null,
  onTimerStart,
  isFromQuestionSuggestions = false
}: ConversationInterfaceProps) {
  const [messageMode, setMessageMode] = useState<'text' | 'voice'>('text');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showThoughtfulResponsePopup, setShowThoughtfulResponsePopup] = useState(false);
  const [showTranscriptionProgress, setShowTranscriptionProgress] = useState(false);
  const [isTranscriptionComplete, setIsTranscriptionComplete] = useState(false);
  const [isConversationExpanded, setIsConversationExpanded] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Check if this is inviter's first question to bypass timer completely
  const isInviterFirstQuestion = useCallback(() => {
    // Simple, reliable check for inviter's first question with null safety
    const messagesArray = Array.isArray(messages) ? messages : [];
    return messagesArray.length === 0 && 
           connection?.inviterEmail === currentUserEmail &&
           nextMessageType === 'question';
  }, [messages, connection, currentUserEmail, nextMessageType]);

  // Check if this is a new question that will create a new conversation thread
  const isNewQuestionAfterExchange = useCallback(() => {
    const messagesArray = Array.isArray(messages) ? messages : [];
    
    // Only applies to questions
    if (nextMessageType !== 'question') return false;
    
    // Must have messages in current conversation
    if (messagesArray.length === 0) return false;
    
    // Check if there's been a complete question-response exchange
    const hasQuestion = messagesArray.some(msg => msg.type === 'question');
    const hasResponse = messagesArray.some(msg => msg.type === 'response');
    
    // Find the most recent question
    let lastQuestionIndex = -1;
    for (let i = messagesArray.length - 1; i >= 0; i--) {
      if (messagesArray[i].type === 'question') {
        lastQuestionIndex = i;
        break;
      }
    }
    
    // Check if the last question has been responded to
    const lastQuestionHasResponse = lastQuestionIndex !== -1 ? 
      messagesArray.slice(lastQuestionIndex + 1).some(msg => msg.type === 'response') : false;
    
    // This will create a new thread if there's been a complete exchange and last question is answered
    return hasQuestion && hasResponse && lastQuestionHasResponse;
  }, [messages, nextMessageType]);

  // Handle voice message sending with AI transcription
  const handleVoiceMessageSend = useCallback(async (audioBlob: Blob, duration: number) => {
    try {
      if (!conversationId || !currentUserEmail || !nextMessageType) {
        console.error('Missing required data for voice message sending');
        return;
      }

      setShowTranscriptionProgress(true);
      setIsTranscriptionComplete(false);
      
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-message.webm');
      formData.append('senderEmail', currentUserEmail);
      // ALL voice messages should always be treated as responses, never questions
      formData.append('type', 'response');
      formData.append('duration', duration.toString());

      // Send voice message to backend for AI transcription
      const response = await fetch(`/api/conversations/${conversationId}/voice-messages`, {
        method: 'POST',
        body: formData,
        credentials: 'include', // Include auth cookies
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Voice message send failed:', response.status, errorText);
        throw new Error(`Failed to send voice message: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      // Invalidate queries to refresh conversation data immediately
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/messages`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/by-email/${currentUserEmail}`] })
      ]);
      
      // Signal completion to progress component
      setIsTranscriptionComplete(true);
      
      // Hide progress after showing completion state briefly
      setTimeout(() => {
        setShowTranscriptionProgress(false);
        setIsTranscriptionComplete(false);
        // Reset message mode to text after successful voice message send
        setMessageMode('text');
      }, 2000);
      
    } catch (error: any) {
      console.error('Error sending voice message:', error);
      setShowTranscriptionProgress(false);
      setIsTranscriptionComplete(false);
      
      // Parse error response to check for trial expiration
      let errorData;
      try {
        if (error.message && error.message.includes('Failed to send voice message')) {
          const errorText = error.message.split(' - ')[1]; // Extract the response text after the status code
          if (errorText) {
            errorData = JSON.parse(errorText);
          } else {
            errorData = { message: error.message };
          }
        } else {
          errorData = { message: error.message };
        }
      } catch {
        errorData = { message: error.message };
      }
      
      // Check if this is a trial expiration or subscription canceled error and trigger popup
      if (errorData.type === "TRIAL_EXPIRED" || (errorData.message && errorData.message.includes("trial has expired"))) {
        // Trigger trial expiration popup via custom event since we don't have direct access to the state setter
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          const trialExpiredEvent = new CustomEvent('trialExpired', {
            detail: { action: 'voice_messaging' }
          });
          window.dispatchEvent(trialExpiredEvent);
        }
        return;
      }
      
      // Check if this is a subscription canceled error and trigger popup
      if (errorData.type === "SUBSCRIPTION_CANCELED" || (errorData.message && errorData.message.includes("subscription has been canceled"))) {
        // Trigger subscription canceled popup via custom event
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          const subscriptionCanceledEvent = new CustomEvent('subscriptionCanceled', {
            detail: { action: 'voice_messaging' }
          });
          window.dispatchEvent(subscriptionCanceledEvent);
        }
        return;
      }
      
      // For other errors, show user-friendly error without triggering error boundary
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        const toast = new CustomEvent('showToast', {
          detail: {
            title: 'Voice message error',
            description: errorData.message || 'There was an issue sending your voice message. Please try again.',
          }
        });
        window.dispatchEvent(toast);
      }
      
      // Prevent error boundary from triggering
      return;
    }
  }, [conversationId, currentUserEmail, nextMessageType, queryClient]);

  // Real-time countdown timer synchronization for text input with error handling
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    try {
      if (hasStartedResponse && responseStartTime) {
        interval = setInterval(() => {
          setCurrentTime(new Date());
        }, 1000);
      }
    } catch (error) {
      console.error('Error setting up timer interval:', error);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [hasStartedResponse, responseStartTime]);

  // Scroll detection removed - floating text now handled at conversation page level

  // Calculate remaining time for thoughtful response timer with error handling
  const getRemainingTime = useCallback(() => {
    try {
      if (!hasStartedResponse || !responseStartTime) return 600; // 10 minutes in seconds
      const elapsed = (currentTime.getTime() - responseStartTime.getTime()) / 1000;
      return Math.max(0, 600 - elapsed);
    } catch (error) {
      console.error('Error calculating remaining time:', error);
      return 600; // Default to full time on error
    }
  }, [hasStartedResponse, responseStartTime, currentTime]);

  const formatTime = useCallback((seconds: number) => {
    try {
      const totalSeconds = Math.max(0, Math.floor(seconds));
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    } catch (error) {
      console.error('Error formatting time:', error);
      return '10:00'; // Default display
    }
  }, []);

  // Production-ready message sending validation with comprehensive error handling
  const canSendNow = useCallback(() => {
    // Determine actual message type: if from question suggestions, always use "question"
    const messageType = isFromQuestionSuggestions ? 'question' : nextMessageType;
    
    // Always allow questions immediately (no timer for any questions)
    if (messageType === 'question') {
      return true;
    }
    
    // For responses: apply 10-minute thoughtful response timer
    if (messageType === 'response') {
      if (!hasStartedResponse) {
        return true; // Timer hasn't started yet
      }
      
      // Check if 10 minutes have passed since response started
      const remainingTime = getRemainingTime();
      return remainingTime <= 0;
    }
    
    // For follow-ups and other message types, allow sending immediately
    return true;
  }, [nextMessageType, isFromQuestionSuggestions, hasStartedResponse, getRemainingTime]);

  return (
    <div className="h-full flex flex-col">
      {/* Messages Container - flex-1 to take remaining space */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-8 min-h-0 relative bg-gradient-to-br from-amber-50/40 via-yellow-50/30 to-orange-50/20 pb-24">
        {/* Wood desk texture background */}
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(ellipse_at_center,_rgba(139,69,19,0.4)_0%,_transparent_70%)]" />
        
        {/* Subtle paper scattered texture */}
        <div className="absolute inset-0 opacity-10" 
             style={{
               backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4a574' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
             }} />

        {(!Array.isArray(messages) || messages.length === 0) ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center max-w-md space-y-6">
              <div className="mb-8">
                <h3 className="text-2xl font-serif text-slate-800 mb-3">
                  Begin Your Journey
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Start a meaningful conversation by asking a thoughtful question or sharing what's on your heart.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 relative z-10">
            {/* Stacked Conversation Logic */}
            {(() => {
              const messagesArray = Array.isArray(messages) ? messages : [];
              const shouldStack = messagesArray.length >= 4;
              const displayMessages = shouldStack && !isConversationExpanded 
                ? messagesArray.slice(-2) // Show only last 2 messages when stacked
                : messagesArray; // Show all messages when expanded or less than 4 total

              return (
                <>
                  {/* Stacked Papers Indicator */}
                  {shouldStack && !isConversationExpanded && (
                    <div className="relative mb-6">
                      {/* Paper stack effect with multiple layers */}
                      <div className="relative">
                        <div className="absolute -top-2 -left-2 w-full h-20 bg-slate-100/80 rounded-xl rotate-2 shadow-md"></div>
                        <div className="absolute -top-1 -left-1 w-full h-20 bg-slate-50/90 rounded-xl rotate-1 shadow-sm"></div>
                        
                        {/* Top visible paper with summary */}
                        <div className="relative bg-white p-4 rounded-xl shadow-lg border-2 border-slate-200/50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <FileText className="w-5 h-5 text-slate-600" />
                              <div>
                                <p className="text-sm font-medium text-slate-800">
                                  {messagesArray.length - 2} earlier messages
                                </p>
                                <p className="text-xs text-slate-600">
                                  Conversation started {new Date(messagesArray[0]?.createdAt || '').toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setIsConversationExpanded(true)}
                              className="text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                            >
                              <ChevronDown className="w-4 h-4 mr-1" />
                              Expand All
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Conversation Messages */}
                  <div className={cn(
                    "space-y-6",
                    shouldStack && isConversationExpanded ? "max-h-[500px] overflow-y-auto" : ""
                  )}>
                    {displayMessages.map((message, index) => (
                      <div key={message.id} className="relative">
                        <div className={cn(
                          "text-gray-800 leading-relaxed font-serif text-base whitespace-pre-wrap bg-white p-4 rounded-lg shadow-sm",
                          // Role-based glowing effects for message bubbles
                          message.senderEmail === currentUserEmail
                            ? (connection?.inviterEmail === currentUserEmail
                                ? "shadow-[0_0_30px_rgba(79,172,254,0.6),0_0_50px_rgba(79,172,254,0.3)] border-2 border-[#4FACFE]/50 ring-2 ring-[#4FACFE]/30 bg-gradient-to-br from-[#4FACFE]/5 to-white"
                                : "shadow-[0_0_30px_rgba(215,160,135,0.6),0_0_50px_rgba(215,160,135,0.3)] border-2 border-[#D7A087]/50 ring-2 ring-[#D7A087]/30 bg-gradient-to-br from-[#D7A087]/5 to-white")
                            : (connection?.inviterEmail !== currentUserEmail
                                ? "shadow-[0_0_30px_rgba(79,172,254,0.6),0_0_50px_rgba(79,172,254,0.3)] border-2 border-[#4FACFE]/50 ring-2 ring-[#4FACFE]/30 bg-gradient-to-br from-[#4FACFE]/5 to-white"
                                : "shadow-[0_0_30px_rgba(215,160,135,0.6),0_0_50px_rgba(215,160,135,0.3)] border-2 border-[#D7A087]/50 ring-2 ring-[#D7A087]/30 bg-gradient-to-br from-[#D7A087]/5 to-white")
                        )}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-600">
                              {message.senderEmail === currentUserEmail ? 'You' : <UserDisplayName email={message.senderEmail} />}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {message.type}
                            </Badge>
                          </div>
                          
                          {/* Voice message display */}
                          {message.messageFormat === 'voice' && message.audioFileUrl ? (
                            <VoiceMessageDisplay 
                              message={{
                                ...message,
                                conversationId: message.conversationId || conversationId || 0
                              }}
                              isCurrentUser={message.senderEmail === currentUserEmail}
                              className="mt-2"
                            />
                          ) : (
                            message.content
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Restack Button - shown when conversation is expanded */}
                  {shouldStack && isConversationExpanded && (
                    <div className="flex justify-center mt-6">
                      <Button
                        variant="outline"
                        onClick={() => setIsConversationExpanded(false)}
                        className="text-slate-600 hover:text-slate-800 border-slate-300 hover:border-slate-400"
                      >
                        <ChevronUp className="w-4 h-4 mr-2" />
                        Restack Conversation
                      </Button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Floating Waiting Text removed from here - now handled at conversation page level to prevent duplication */}

      {/* Static Minimalistic Input Area at Bottom */}
      {isMyTurn && (
        <div className="flex-shrink-0">
          {/* Message Mode Toggle - Thin and minimal */}
          <div className="flex items-center justify-center space-x-2 mb-0.5 px-1">
            <button
              onClick={() => setMessageMode('text')}
              className={cn(
                "inline-flex items-center gap-1 h-6 rounded px-2 text-xs font-medium transition-colors",
                messageMode === 'text' 
                  ? "bg-ocean text-white" 
                  : "text-slate-500 hover:text-slate-700"
              )}
              disabled={isSending}
            >
              <Type className="w-3 h-3" />
              Text
            </button>
            <button
              onClick={() => setMessageMode('voice')}
              className={cn(
                "inline-flex items-center gap-1 h-6 rounded px-2 text-xs font-medium transition-colors",
                messageMode === 'voice' 
                  ? "bg-[#4FACFE] text-white" 
                  : "text-slate-500 hover:text-slate-700"
              )}
              disabled={isSending}
            >
              <Mic className="w-3 h-3" />
              Voice
            </button>
          </div>

          {/* Input Surface - Thin and Static */}
          <div className="px-1 pb-0">
            {messageMode === 'text' ? (
              /* Text Input with Proper Border Containment */
              <div className="bg-white border-2 border-slate-300 rounded-lg shadow-sm">
                <div className="flex items-start space-x-2 p-3">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      // Start thoughtful response timer ONLY for responses (not questions)
                      const messageType = isFromQuestionSuggestions ? 'question' : nextMessageType;
                      if (messageType === 'response' && !hasStartedResponse && e.target.value.trim() && onTimerStart) {
                        onTimerStart();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (canSendNow()) {
                          onSendMessage();
                        } else {
                          setShowThoughtfulResponsePopup(true);
                        }
                      }
                    }}
                    placeholder={
                      nextMessageType === 'question' 
                        ? "What would you like to explore together?"
                        : "Express what's in your heart..."
                    }
                    className="conversation-textarea flex-1 min-h-[100px] max-h-[200px] resize-none border-0 bg-transparent text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none focus:border-0 focus:shadow-none focus-visible:ring-0 focus-visible:outline-none focus-visible:border-0 focus-visible:shadow-none focus-visible:ring-offset-0 text-sm leading-relaxed p-0"
                    disabled={isSending}
                  />
                  <div className="flex flex-col justify-center items-center">
                    <Button
                      onClick={() => {
                        if (canSendNow()) {
                          onSendMessage();
                        } else {
                          setShowThoughtfulResponsePopup(true);
                        }
                      }}
                      disabled={!newMessage.trim() || isSending}
                      size="sm"
                      className={cn(
                        "w-6 h-6 rounded-full shadow-sm transition-all duration-200",
                        "bg-gradient-to-br from-ocean to-ocean/80 hover:from-ocean/90 hover:to-ocean",
                        !newMessage.trim() || isSending 
                          ? "opacity-50 cursor-not-allowed" 
                          : "cursor-pointer"
                      )}
                    >
                      {isSending ? (
                        <div className="w-2 h-2 border border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Send className="h-2 w-2" />
                      )}
                    </Button>
                    {!isFromQuestionSuggestions && nextMessageType === 'response' && hasStartedResponse && !canSendNow() && (
                      <span className="text-xs text-slate-400 font-mono mt-1">
                        {formatTime(getRemainingTime())}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Voice Recorder with Matching Border */
              <div className="bg-white border-2 border-slate-300 rounded-lg shadow-sm p-3">
                <VoiceRecorder
                  onSendVoiceMessage={handleVoiceMessageSend}
                  onRecordingStart={onRecordingStart}
                  disabled={isSending}
                  canSendMessage={true}
                  hasStartedResponse={hasStartedResponse}
                  responseStartTime={responseStartTime}
                  onTimerStart={onTimerStart}
                  messages={messages}
                  connection={connection}
                  currentUserEmail={currentUserEmail}
                  nextMessageType={nextMessageType}
                  isFromQuestionSuggestions={isFromQuestionSuggestions}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Thoughtful Response Popup */}
      {showThoughtfulResponsePopup && (
        <ThoughtfulResponsePopup
          isOpen={showThoughtfulResponsePopup}
          onProceed={onSendMessage}
          onClose={() => setShowThoughtfulResponsePopup(false)}
          remainingSeconds={Math.floor(getRemainingTime())}
        />
      )}

      {/* Transcription Progress */}
      {showTranscriptionProgress && (
        <TranscriptionProgress 
          isVisible={showTranscriptionProgress} 
          isProcessingComplete={isTranscriptionComplete}
        />
      )}
    </div>
  );
});

export default ConversationInterface;