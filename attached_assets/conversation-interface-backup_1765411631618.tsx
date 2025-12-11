import React, { useState, useEffect } from 'react';
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
  type: 'question' | 'response' | 'follow_up';
  createdAt: string;
  messageFormat?: 'text' | 'voice';
  audioFileUrl?: string | null;
  transcription?: string | null;
  audioDuration?: number | null;
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

export default function ConversationInterface({ 
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

  // Real-time countdown timer synchronization for text input
  useEffect(() => {
    if (hasStartedResponse && responseStartTime) {
      const interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [hasStartedResponse, responseStartTime]);

  // Calculate remaining time for thoughtful response timer
  const getRemainingTime = () => {
    if (!hasStartedResponse || !responseStartTime) return 600; // 10 minutes in seconds
    const elapsed = (currentTime.getTime() - responseStartTime.getTime()) / 1000;
    return Math.max(0, 600 - elapsed);
  };

  const formatTime = (seconds: number) => {
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const canSendNow = () => {
    if (!hasStartedResponse) return true;
    return getRemainingTime() <= 0;
  };

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
                <div className="text-gray-800 leading-relaxed font-serif text-base whitespace-pre-wrap bg-white p-4 rounded-lg shadow-sm">
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

        {/* Glowing waiting state for non-turn users */}
        {!isMyTurn && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
            <div className="relative bg-gradient-to-br from-white via-amber-50/20 to-amber/5 p-4 rounded-sm border border-amber/20 shadow-md shadow-amber/10"
                 style={{
                   background: `
                     linear-gradient(135deg, 
                       rgba(255,255,255,0.98) 0%, 
                       rgba(255,251,235,0.96) 30%, 
                       rgba(215,160,135,0.08) 70%, 
                       rgba(215,160,135,0.12) 100%
                     )
                   `,
                   filter: 'drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.06))',
                   backdropFilter: 'blur(0.5px)'
                 }}>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700 mb-1">Their turn to write</p>
                <p className="text-xs text-slate-600">Waiting for their thoughtful response...</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Input Area at Bottom - Only visible when it's user's turn */}
      {isMyTurn && (
        <div className="flex-shrink-0 border-t border-slate-200/60 bg-gradient-to-r from-slate-50/50 to-white/50 backdrop-blur-sm p-4">
          {/* Message Mode Toggle */}
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Button
              onClick={() => setMessageMode('text')}
              variant={messageMode === 'text' ? 'default' : 'outline'}
              size="sm"
              className={cn(
                "transition-all duration-200",
                messageMode === 'text' 
                  ? "bg-ocean text-white shadow-ocean/20" 
                  : "text-slate-600 border-slate-300 hover:bg-slate-50"
              )}
            >
              <Type className="w-4 h-4 mr-2" />
              Write Text
            </Button>
            <Button
              onClick={() => setMessageMode('voice')}
              variant={messageMode === 'voice' ? 'default' : 'outline'}
              size="sm"
              className={cn(
                "transition-all duration-200",
                messageMode === 'voice' 
                  ? "bg-white text-[#4FACFE] border-2 border-[#4FACFE] shadow-lg hover:bg-slate-50" 
                  : "text-[#4FACFE] border-slate-300 hover:bg-slate-50 hover:border-[#4FACFE]/50"
              )}
            >
              <Mic className="w-4 h-4 mr-2" />
              Record Voice
            </Button>
          </div>

          {/* Input Surface */}
          <div className="relative">
            {messageMode === 'text' ? (
              /* Text Writing Surface */
              <div className="relative bg-gradient-to-br from-white via-ocean/5 to-ocean/8 p-6 border border-ocean/20 shadow-md rounded-sm">
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <Textarea
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        if (!hasStartedResponse && e.target.value.trim() && onTimerStart) {
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
                        messages.length >= 2
                          ? "Continue your thoughts..."
                          : nextMessageType === 'question' 
                            ? "What would you like to explore together?"
                            : "Express what's in your heart..."
                      }
                      className="min-h-[120px] resize-none border-0 bg-transparent text-slate-800 placeholder:text-slate-500 focus:ring-0 text-base leading-relaxed p-0"
                      disabled={isSending}
                    />
                  </div>
                  <div className="flex flex-col items-center justify-between py-2">
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
                        "w-12 h-12 rounded-full shadow-lg transition-all duration-200",
                        "bg-gradient-to-br from-ocean to-ocean/80 hover:from-ocean/90 hover:to-ocean",
                        "hover:shadow-xl hover:scale-105 active:scale-95",
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
                      {hasStartedResponse && !canSendNow() && (
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
                onSendVoiceMessage={() => {}}
                onRecordingStart={onRecordingStart}
                disabled={isSending}
                canSendMessage={true}
                hasStartedResponse={hasStartedResponse}
                responseStartTime={responseStartTime}
                onTimerStart={onTimerStart}
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
}