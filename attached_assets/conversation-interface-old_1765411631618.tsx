import React, { useState, useEffect, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Send, Type, Mic, ArrowRight, Clock } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserDisplayName } from '@/hooks/useUserDisplayName';
import ProfileAvatar from '@/components/profile-avatar';
import VoiceRecorder from '@/components/voice-recorder';
import VoiceMessageDisplay from '@/components/voice-message-display';
import TranscriptionProgress from '@/components/transcription-progress';
import ThoughtfulResponsePopup from '@/components/thoughtful-response-popup';

interface Message {
  id: number;
  senderEmail: string;
  content: string;
  type: string;
  createdAt: string | Date | null;
  messageFormat?: string;
  audioFileUrl?: string | null;
  transcription?: string | null;
  audioDuration?: number | null;
  conversationId?: number;
}

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
  onQuestionSelect: (question: string) => void;
  onRecordingStart?: () => void;
  isSending: boolean;
  nextMessageType: 'question' | 'response';
  conversationId: number;
  hasStartedResponse?: boolean;
  responseStartTime?: Date | null;
  onTimerStart?: () => void;
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
  onQuestionSelect,
  onRecordingStart,
  isSending,
  nextMessageType,
  conversationId,
  hasStartedResponse = false,
  responseStartTime = null,
  onTimerStart
}: ConversationInterfaceProps) {
  const [messageMode, setMessageMode] = useState<'text' | 'voice'>('text');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showThoughtfulResponsePopup, setShowThoughtfulResponsePopup] = useState(false);
  const [showTranscriptionProgress, setShowTranscriptionProgress] = useState(false);
  const queryClient = useQueryClient();

  // Handle voice message sending with AI transcription
  const handleVoiceMessageSend = useCallback(async (audioBlob: Blob, duration: number) => {
    try {
      if (!conversationId || !currentUserEmail || !nextMessageType) {
        console.error('Missing required data for voice message sending');
        return;
      }

      setShowTranscriptionProgress(true);
      
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-message.webm');
      formData.append('senderEmail', currentUserEmail);
      formData.append('type', nextMessageType);
      formData.append('duration', duration.toString());

      // Send voice message to backend for AI transcription
      const response = await fetch(`/api/conversations/${conversationId}/voice-messages`, {
        method: 'POST',
        body: formData,
        credentials: 'include', // Include auth cookies
      });

      if (!response.ok) {
        throw new Error(`Failed to send voice message: ${response.status}`);
      }

      const result = await response.json();
      
      // Invalidate queries to refresh conversation data
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/messages`] });
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/by-email/${currentUserEmail}`] });
      
      setShowTranscriptionProgress(false);
      
    } catch (error) {
      console.error('Error sending voice message:', error);
      setShowTranscriptionProgress(false);
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

  // Check if this is inviter's first question to bypass timer completely
  const isInviterFirstQuestion = useCallback(() => {
    try {
      if (!messages || !connection || !currentUserEmail) return false;
      return messages.length === 0 && 
             connection.inviterEmail === currentUserEmail &&
             nextMessageType === 'question';
    } catch (error) {
      console.error('[CONVERSATION_INTERFACE] Error checking inviter first question:', error);
      return false;
    }
  }, [messages, connection, currentUserEmail, nextMessageType]);

  // Production-ready message sending validation with comprehensive error handling
  const canSendNow = useCallback(() => {
    try {
      // Skip timer completely for inviter's first question
      if (isInviterFirstQuestion()) return true;
      
      // Skip timer for empty conversations (inviter's first question)
      if (!messages || messages.length === 0) return true;
      
      // Skip timer if user hasn't started responding yet
      if (!hasStartedResponse) return true;
      
      // Check if 10 minutes have passed
      const remainingTime = getRemainingTime();
      return remainingTime <= 0;
    } catch (error) {
      console.error('[CONVERSATION_INTERFACE] Error validating send capability:', error);
      return false; // Safe default - prevent sending if validation fails
    }
  }, [isInviterFirstQuestion, messages, hasStartedResponse, getRemainingTime]);

  return (
    <div className="h-full flex flex-col">
      {/* Messages Container - flex-1 to take remaining space */}
      <div className="flex-1 overflow-y-auto p-8 min-h-0 relative bg-gradient-to-br from-amber-50/40 via-yellow-50/30 to-orange-50/20">
        {/* Wood desk texture background */}
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(ellipse_at_center,_rgba(139,69,19,0.4)_0%,_transparent_70%)]" />
        
        {/* Subtle paper scattered texture */}
        <div className="absolute inset-0 opacity-10" 
             style={{
               backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4a574' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
             }} />

        {messages.length === 0 ? (
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
            {messages.map((message, index) => (
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
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        )}


      </div>

      {/* Fixed Input Area at Bottom - Only visible when it's user's turn */}
      {isMyTurn && (
        <div className="flex-shrink-0">
          {/* Message Mode Toggle */}
          <div className="flex items-center justify-center space-x-2 pt-4 mb-4 px-4">
            <button
              onClick={() => {
                try {
                  setMessageMode('text');
                } catch (error) {
                  console.error('Error switching to text mode:', error);
                }
              }}
              aria-pressed={messageMode === 'text'}
              aria-label="Switch to text message mode"
              className={cn(
                "inline-flex items-center justify-center gap-2 h-9 rounded-md px-3 text-sm font-medium transition-all duration-200",
                "border-0 outline-0 ring-0 shadow-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
                "disabled:pointer-events-none disabled:opacity-50",
                messageMode === 'text' 
                  ? "bg-ocean text-white shadow-ocean/20" 
                  : "text-slate-600 hover:bg-slate-50"
              )}
              disabled={isSending}
            >
              <Type className="w-4 h-4 mr-2" aria-hidden="true" />
              Write Text
            </button>
            <button
              onClick={() => {
                try {
                  setMessageMode('voice');
                } catch (error) {
                  console.error('Error switching to voice mode:', error);
                }
              }}
              aria-pressed={messageMode === 'voice'}
              aria-label="Switch to voice message mode"
              className={cn(
                "inline-flex items-center justify-center gap-2 h-9 rounded-md px-3 text-sm font-medium transition-all duration-200",
                "border-0 outline-0 ring-0 shadow-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
                "disabled:pointer-events-none disabled:opacity-50",
                messageMode === 'voice' 
                  ? "bg-white text-[#4FACFE] shadow-lg hover:bg-slate-50" 
                  : "text-[#4FACFE] hover:bg-slate-50"
              )}
              disabled={isSending}
            >
              <Mic className="w-4 h-4 mr-2" />
              Record Voice
            </button>
          </div>

          {/* Input Surface */}
          <div className="relative">
            {messageMode === 'text' ? (
              /* Text Writing Surface */
              <div className="relative bg-gradient-to-br from-white via-ocean/5 to-ocean/8 p-6 pb-4 border border-ocean/20 shadow-md rounded-t-sm">
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <Textarea
                      value={newMessage}
                      onChange={(e) => {
                        try {
                          setNewMessage(e.target.value);
                          // Only start timer if this is not inviter's first question
                          if (!isInviterFirstQuestion() && !hasStartedResponse && e.target.value.trim() && onTimerStart) {
                            onTimerStart();
                          }
                        } catch (error) {
                          console.error('Error handling message input:', error);
                        }
                      }}
                      onKeyDown={(e) => {
                        try {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            // Skip timer validation for inviter's first question
                            if (canSendNow()) {
                              onSendMessage();
                            } else {
                              setShowThoughtfulResponsePopup(true);
                            }
                          }
                        } catch (error) {
                          console.error('Error handling key press:', error);
                        }
                      }}
                      placeholder={
                        nextMessageType === 'question' 
                          ? "What would you like to explore together?"
                          : "Express what's in your heart..."
                      }
                      className="min-h-[120px] resize-none border-0 bg-transparent text-slate-800 placeholder:text-slate-500 focus:ring-0 text-base leading-relaxed p-0"
                      disabled={isSending}
                      aria-label="Message composition area"
                      aria-describedby="message-help"
                    />
                  </div>
                  <div className="flex flex-col items-center justify-between py-2">
                    <Button
                      onClick={() => {
                        try {
                          // Skip timer validation for inviter's first question
                          if (canSendNow()) {
                            onSendMessage();
                          } else {
                            setShowThoughtfulResponsePopup(true);
                          }
                        } catch (error) {
                          console.error('Error sending message:', error);
                        }
                      }}
                      disabled={!newMessage.trim() || isSending}
                      size="sm"
                      aria-label={isSending ? "Sending message..." : "Send message"}
                      className={cn(
                        "w-12 h-12 rounded-full shadow-lg transition-all duration-200",
                        "bg-gradient-to-br from-ocean to-ocean/80 hover:from-ocean/90 hover:to-ocean",
                        "hover:shadow-xl hover:scale-105 active:scale-95",
                        "focus:outline-none focus:ring-2 focus:ring-ocean/50 focus:ring-offset-2",
                        !newMessage.trim() || isSending 
                          ? "opacity-50 cursor-not-allowed" 
                          : "cursor-pointer"
                      )}
                    >
                      {isSending ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-600">Share</span>
                      {!isInviterFirstQuestion() && hasStartedResponse && !canSendNow() && (
                        <span className="text-xs text-slate-500 font-mono">
                          {formatTime(getRemainingTime())}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Voice Recording Surface */
              <VoiceRecorder
                onSendVoiceMessage={(audioBlob, duration) => {
                  // Send voice message with AI transcription
                  handleVoiceMessageSend(audioBlob, duration);
                }}
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
              />
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
    </div>
  );
});

export default ConversationInterface;