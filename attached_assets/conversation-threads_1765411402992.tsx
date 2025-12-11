import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, Users, Clock, ChevronDown, ChevronUp, RotateCcw, Layers } from 'lucide-react';
import { WaitingTurnPopup } from './waiting-turn-popup';
import { RespondFirstPopup } from './respond-first-popup';
import { useUserDisplayName } from '@/hooks/useUserDisplayName';

interface ConversationThreadsProps {
  connectionId: number;
  currentUserEmail: string;
  otherParticipantEmail: string;
  relationshipType: string;
  onThreadSelect: (conversationId: number) => void;
  selectedConversationId?: number;
  isMyTurn: boolean;
  isInviter: boolean;
}

interface Conversation {
  id: number;
  title: string | null;
  topic: string;
  lastMessageAt: Date | null;
  messageCount: number;
  currentTurn: string;
  status: string;
  isMainThread: boolean;
  parentConversationId: number | null;
  lastActivityAt: Date | null;
  connectionId: number;
  participant1Email: string;
  participant2Email: string;
  relationshipType: string;
  createdAt: Date | null;
}



// Component for displaying multiple stacked conversations
function ConversationStack({ 
  conversations, 
  onThreadSelect,
  currentUserEmail,
  isMyTurn,
  isInviter,
  selectedConversationId,
  onWaitingClick,
  onRespondFirstClick 
}: {
  conversations: Conversation[];
  onThreadSelect: (conversationId: number) => void;
  currentUserEmail: string;
  isMyTurn: boolean;
  isInviter: boolean;
  selectedConversationId?: number;
  onWaitingClick: () => void;
  onRespondFirstClick: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (conversations.length === 0) return null;
  
  // Show top conversation with stack effect underneath
  const topConversation = conversations[0];
  const stackCount = conversations.length;
  
  return (
    <Card className="relative transition-all duration-200 rounded-lg border-amber-200 border-2 bg-gradient-to-br from-amber-50 to-white hover:from-amber-100 hover:to-gray-50 cursor-pointer shadow-sm">
      {/* Stack effect - multiple papers underneath */}
      <div className="absolute -bottom-1 -right-1 w-full h-full border-2 border-amber-100 rounded-lg rotate-1 bg-white shadow-sm"></div>
      <div className="absolute -bottom-0.5 -right-0.5 w-full h-full border-2 border-amber-50 rounded-lg rotate-0.5 bg-white shadow-sm"></div>
      
      <CardContent className="p-3 relative">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <Layers className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <h4 className="text-sm font-semibold text-slate-800">
                {stackCount} Older Conversations
              </h4>
            </div>
            
            <div className="text-xs text-slate-600 mb-2">
              Most recent: {topConversation.title || 'Untitled conversation'}
            </div>
            
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="text-xs px-3 py-1 h-7 rounded-lg border-amber-300 text-amber-700 hover:text-amber-800 hover:border-amber-400 bg-white hover:bg-amber-50 font-medium"
            >
              {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
              {isExpanded ? 'Collapse Stack' : 'Expand Stack'}
            </Button>
          </div>
          
          <Badge variant="outline" className="text-xs px-2 py-1 bg-slate-50 text-slate-600 border-slate-200">
            {stackCount} threads
          </Badge>
        </div>
        
        {/* Expanded view showing all stacked conversations */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
            {conversations.map((conversation, index) => (
              <div key={conversation.id} className="p-2 bg-slate-50 rounded-md">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <MessageSquare className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-slate-700 truncate">
                        {conversation.title || 'Untitled conversation'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-500">
                      <Users className="w-3 h-3" />
                      <span>{conversation.messageCount} messages</span>
                      {conversation.lastMessageAt && (
                        <>
                          <Clock className="w-3 h-3" />
                          <span>{new Date(conversation.lastMessageAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async (e) => {
                      e.stopPropagation();
                      // Same reopening logic as individual conversations
                      try {
                        const response = await fetch(`/api/conversations/${conversation.id}/can-reopen?currentConversationId=${selectedConversationId}`, {
                          credentials: 'include'
                        });
                        const result = await response.json();
                        
                        if (result.canReopen) {
                          onThreadSelect(conversation.id);
                        } else {
                          if (result.reason === 'respond_to_question') {
                            onRespondFirstClick();
                          } else if (result.reason === 'not_your_turn') {
                            onWaitingClick();
                          } else {
                            onWaitingClick();
                          }
                        }
                      } catch (error) {
                        onThreadSelect(conversation.id);
                      }
                    }}
                    className="text-xs px-2 py-1 h-6 rounded-lg border-ocean text-ocean hover:text-white hover:bg-ocean hover:border-ocean"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper component for individual conversation display
function StackedConversation({ 
  conversation, 
  isSelected, 
  onClick, 
  onThreadSelect,
  currentUserEmail, 
  isMyTurn,
  isInviter,
  selectedConversationId,
  onWaitingClick,
  onRespondFirstClick,
  index
}: { 
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
  onThreadSelect: (conversationId: number) => void;
  currentUserEmail: string;
  isMyTurn: boolean;
  isInviter: boolean;
  selectedConversationId?: number;
  onWaitingClick: () => void;
  onRespondFirstClick: () => void;
  index: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [canReopen, setCanReopen] = useState<boolean | null>(null);
  const [isCheckingReopen, setIsCheckingReopen] = useState(false);
  
  // Determine if this conversation should be stacked based on its position and content
  const shouldStack = conversation.messageCount >= 3;

  // Check if this thread can be reopened for visual feedback
  useEffect(() => {
    const checkCanReopen = async () => {
      if (!selectedConversationId || conversation.id === selectedConversationId) {
        setCanReopen(true);
        return;
      }

      setIsCheckingReopen(true);
      try {
        const response = await fetch(`/api/conversations/${conversation.id}/can-reopen?currentConversationId=${selectedConversationId}`, {
          credentials: 'include'
        });
        const result = await response.json();
        setCanReopen(result.canReopen);
      } catch (error) {
        // Default to allowing if check fails
        setCanReopen(true);
      } finally {
        setIsCheckingReopen(false);
      }
    };

    checkCanReopen();
  }, [conversation.id, selectedConversationId, isMyTurn]);

  // Rotating border colors: ocean blue, amber, dark navy
  const borderColors = [
    'border-[#4FACFE] border-4', // Ocean blue from app
    'border-[#D7A087] border-4', // Amber from app
    'border-[#1e3a8a] border-4'  // Dark navy blue
  ];
  
  const borderStyle = borderColors[index % 3];
  
  return (
    <Card 
      className={`transition-all duration-200 rounded-lg ${shouldStack ? 'relative' : ''} ${borderStyle} ${
        isCheckingReopen
          ? 'bg-slate-50 cursor-wait'
          : canReopen === false
          ? 'bg-slate-50 cursor-not-allowed'
          : canReopen === true
          ? 'bg-white hover:bg-gray-50 cursor-pointer'
          : 'bg-white hover:bg-gray-50 cursor-pointer'
      } ${
        isSelected ? 'ring-2 ring-gray-400' : ''
      }`}
      onClick={() => {
        // Thread reopening validation handled in parent onClick
        onClick();
      }}
    >
      {shouldStack && !isExpanded && (
        <>
          {/* Clean stacked paper effect without background colors */}
          <div className="absolute -bottom-1 -right-1 w-full h-full border-2 border-gray-200 rounded-lg rotate-1"></div>
          <div className="absolute -bottom-0.5 -right-0.5 w-full h-full border-2 border-gray-100 rounded-lg rotate-0.5"></div>
        </>
      )}
      
      <CardContent className="p-3 relative">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <MessageSquare className={`w-3 h-3 flex-shrink-0 ${
                canReopen === false ? 'text-slate-300' : 'text-slate-500'
              }`} />
              <h4 className={`text-xs font-medium truncate ${
                canReopen === false ? 'text-slate-400' : 'text-slate-800'
              }`}>
                {conversation.title || 'Untitled conversation'}
              </h4>
            </div>
            
            <div className={`flex items-center space-x-2 text-xs ${
              canReopen === false ? 'text-slate-300' : 'text-slate-500'
            }`}>
              <Users className="w-3 h-3" />
              <span>{conversation.messageCount} messages</span>
              {conversation.lastMessageAt && (
                <>
                  <Clock className="w-3 h-3" />
                  <span>{new Date(conversation.lastMessageAt).toLocaleDateString()}</span>
                </>
              )}
            </div>
            
            {/* Reopen Thread Button - Visual feedback based on availability */}
            <div className="mt-2">
              <Button
                size="sm"
                variant="outline"
                disabled={canReopen === false || isCheckingReopen}
                onClick={async (e) => {
                  e.stopPropagation();
                  
                  // If we already know it can't be reopened, show appropriate popup
                  if (canReopen === false) {
                    // Re-check the reason for blocking
                    try {
                      const response = await fetch(`/api/conversations/${conversation.id}/can-reopen?currentConversationId=${selectedConversationId}`, {
                        credentials: 'include'
                      });
                      const result = await response.json();
                      
                      if (result.reason === 'respond_to_question') {
                        onRespondFirstClick();
                      } else if (result.reason === 'not_your_turn') {
                        onWaitingClick();
                      } else {
                        onWaitingClick();
                      }
                    } catch (error) {
                      onWaitingClick();
                    }
                    return;
                  }
                  
                  // CORE RULES #10, #11, #12: Double-check if thread reopening is allowed
                  try {
                    const response = await fetch(`/api/conversations/${conversation.id}/can-reopen?currentConversationId=${selectedConversationId}`, {
                      credentials: 'include'
                    });
                    const result = await response.json();
                    
                    if (result.canReopen) {
                      onThreadSelect(conversation.id); // Thread reopening allowed
                    } else {
                      // Show appropriate popup based on the reason
                      if (result.reason === 'respond_to_question') {
                        onRespondFirstClick();
                      } else if (result.reason === 'not_your_turn') {
                        onWaitingClick();
                      } else {
                        onWaitingClick();
                      }
                    }
                  } catch (error) {
                    // Fallback to allowing reopening if check fails
                    onThreadSelect(conversation.id);
                  }
                }}
                className={`text-xs px-2 py-1 h-6 rounded-lg transition-all duration-200 ${
                  isCheckingReopen
                    ? 'border-slate-200 text-slate-400 bg-slate-50'
                    : canReopen === false
                    ? 'border-slate-200 text-slate-400 bg-slate-50 opacity-50 cursor-not-allowed'
                    : canReopen === true
                    ? 'border-ocean text-ocean hover:text-white hover:bg-ocean hover:border-ocean shadow-sm'
                    : 'border-slate-300 text-slate-600 hover:text-slate-800 hover:border-slate-400'
                }`}
              >
                <RotateCcw className={`w-3 h-3 mr-1 ${
                  isCheckingReopen 
                    ? 'animate-spin' 
                    : canReopen === false 
                    ? 'opacity-50' 
                    : ''
                }`} />
                {isCheckingReopen ? 'Checking...' : 'Reopen Thread'}
              </Button>
            </div>
          </div>
          
          <div className="flex flex-col items-end space-y-1">
            {/* Turn indicator badge - Show "Your Turn" for all past conversations since user can reopen them */}
            <Badge 
              variant="outline"
              className={`text-xs px-2 py-1 text-center min-w-[60px] ${
                canReopen === false
                  ? 'bg-slate-50 text-slate-300 border-slate-200'
                  : 'bg-green-50 text-green-700 border-green-200'
              }`}
            >
              Your Turn
            </Badge>
            
            {/* Stack expansion control */}
            {shouldStack && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>
        
        {shouldStack && isExpanded && (
          <div className="mt-2 pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-600">
              Conversation expanded - showing all {conversation.messageCount} messages in main view
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ConversationThreads({
  connectionId,
  currentUserEmail,
  otherParticipantEmail,
  relationshipType,
  onThreadSelect,
  selectedConversationId,
  isMyTurn,
  isInviter
}: ConversationThreadsProps) {
  const [showWaitingPopup, setShowWaitingPopup] = useState(false);
  const [showRespondFirstPopup, setShowRespondFirstPopup] = useState(false);
  const { data: otherParticipantName } = useUserDisplayName(otherParticipantEmail);
  const conversationListRef = useRef<HTMLDivElement>(null);
  const [availableHeight, setAvailableHeight] = useState(0);

  // Calculate available space and determine stacking
  useEffect(() => {
    const updateAvailableHeight = () => {
      if (conversationListRef.current) {
        const container = conversationListRef.current.parentElement;
        if (container) {
          const rect = container.getBoundingClientRect();
          const headerHeight = 80; // Approximate header height
          const padding = 24; // Padding and margins
          setAvailableHeight(rect.height - headerHeight - padding);
        }
      }
    };

    updateAvailableHeight();
    window.addEventListener('resize', updateAvailableHeight);
    return () => window.removeEventListener('resize', updateAvailableHeight);
  }, []);

  // Fetch real conversations from API
  const { data: conversationData, isLoading } = useQuery({
    queryKey: [`/api/connections/${connectionId}/conversations`],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/connections/${connectionId}/conversations`);
        if (!response.ok) {
          return { conversations: [], activeConversationId: null, previousConversations: [] };
        }
        const data = await response.json();
        // API returns { conversations, activeConversationId, previousConversations }
        return data && typeof data === 'object' ? data : { conversations: [], activeConversationId: null, previousConversations: [] };
      } catch (error) {
        console.error('Error fetching conversations:', error);
        return { conversations: [], activeConversationId: null, previousConversations: [] };
      }
    },
    enabled: !!connectionId
  });

  const conversations = conversationData?.conversations || [];


  // Fetch message counts for each conversation
  const { data: messageCounts = {} } = useQuery({
    queryKey: [`/api/connections/${connectionId}/conversations/message-counts`],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/connections/${connectionId}/conversations/message-counts`);
        if (!response.ok) {
          return {};
        }
        const data = await response.json();
        return typeof data === 'object' && data !== null ? data : {};
      } catch (error) {
        console.error('Error fetching message counts:', error);
        return {};
      }
    },
    enabled: !!connectionId
  });

  // Filter out the currently active conversation and sort remaining conversations
  const sortedConversations = Array.isArray(conversations) 
    ? conversations
        .filter((conv: Conversation) => conv && conv.id !== selectedConversationId) // Hide currently active conversation
        .map((conv: Conversation) => ({
          ...conv,
          messageCount: messageCounts[conv.id] || 0,
          lastMessageAt: conv.lastActivityAt
        }))
        .sort((a: Conversation, b: Conversation) => {
          if (a.isMainThread && !b.isMainThread) return -1;
          if (!a.isMainThread && b.isMainThread) return 1;
          return new Date(b.lastActivityAt || 0).getTime() - new Date(a.lastActivityAt || 0).getTime();
        })
    : [];

  // Calculate stacking logic
  const CONVERSATION_ITEM_HEIGHT = 120; // Approximate height of each conversation item
  const STACK_ITEM_HEIGHT = 100; // Height of stacked conversations component
  const maxVisibleConversations = Math.max(2, Math.floor(availableHeight / CONVERSATION_ITEM_HEIGHT));
  
  // Determine which conversations to show individually vs stack
  // For better UX: Show recent conversations individually, stack oldest ones at the top
  const shouldUseStacking = sortedConversations.length > maxVisibleConversations;
  const conversationsToShow = shouldUseStacking 
    ? sortedConversations.slice(0, maxVisibleConversations - 1) // Most recent conversations shown individually
    : sortedConversations;
  const conversationsToStack = shouldUseStacking 
    ? sortedConversations.slice(maxVisibleConversations - 1) // Oldest conversations to stack
    : [];



  if (isLoading) {
    return (
      <div className="h-full flex flex-col space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-3">
              <div className="h-3 bg-slate-200 rounded mb-2"></div>
              <div className="h-2 bg-slate-100 rounded w-2/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 mb-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-slate-800">Previous Conversations</h3>
          {sortedConversations.length > 0 && (
            <Badge variant="outline" className="text-xs px-2 py-1 bg-slate-50 text-slate-600 border-slate-200">
              {sortedConversations.length} total
            </Badge>
          )}
        </div>
        {shouldUseStacking && (
          <p className="text-xs text-slate-500">
            Recent conversations shown individually • Older conversations stacked above
          </p>
        )}
      </div>

      {/* Conversations List */}
      <div ref={conversationListRef} className="flex-1 overflow-hidden space-y-2">
        {sortedConversations.length === 0 ? (
          <Card className="border-dashed border-slate-300">
            <CardContent className="p-6 text-center">
              <MessageSquare className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600">
                {conversations.length === 0 ? "No conversations yet." : "Current conversation is active."}
              </p>
              <p className="text-xs text-slate-500">
                {conversations.length === 0 
                  ? "Start a new question to begin your conversation history." 
                  : "Previous conversations will appear here when you start new questions."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Show stacked conversations (oldest conversations) at the top */}
            {conversationsToStack.length > 0 && (
              <ConversationStack
                conversations={conversationsToStack}
                onThreadSelect={onThreadSelect}
                currentUserEmail={currentUserEmail}
                isMyTurn={isMyTurn}
                isInviter={isInviter}
                selectedConversationId={selectedConversationId}
                onWaitingClick={() => setShowWaitingPopup(true)}
                onRespondFirstClick={() => setShowRespondFirstPopup(true)}
              />
            )}
            
            {/* Show individual conversations (newest first) below the stack */}
            {conversationsToShow.map((conversation: Conversation, index: number) => (
              <StackedConversation
                key={conversation.id}
                conversation={conversation}
                isSelected={false} // Never selected since active conversation is hidden
                onClick={async () => {
                  // CORE RULES #10, #11, #12: Check if thread reopening is allowed
                  try {
                    const response = await fetch(`/api/conversations/${conversation.id}/can-reopen?currentConversationId=${selectedConversationId}`, {
                      credentials: 'include'
                    });
                    const result = await response.json();
                    
                    if (result.canReopen) {
                      onThreadSelect(conversation.id); // Thread reopening allowed
                    } else {
                      // Show appropriate popup based on the reason
                      if (result.reason === 'respond_to_question') {
                        setShowRespondFirstPopup(true);
                      } else if (result.reason === 'not_your_turn') {
                        setShowWaitingPopup(true);
                      } else {
                        setShowWaitingPopup(true);
                      }
                    }
                  } catch (error) {
                    // Fallback to allowing reopening if check fails
                    onThreadSelect(conversation.id);
                  }
                }}
                onThreadSelect={onThreadSelect}
                currentUserEmail={currentUserEmail}
                isMyTurn={isMyTurn}
                isInviter={isInviter}
                selectedConversationId={selectedConversationId}
                onWaitingClick={() => setShowWaitingPopup(true)}
                onRespondFirstClick={() => setShowRespondFirstPopup(true)}
                index={index}
              />
            ))}
          </>
        )}
      </div>
      
      {/* Waiting Turn Popup */}
      <WaitingTurnPopup
        isOpen={showWaitingPopup}
        onClose={() => setShowWaitingPopup(false)}
        otherParticipantName={otherParticipantName || 'the other person'}
      />
      
      {/* Respond First Popup */}
      <RespondFirstPopup
        isOpen={showRespondFirstPopup}
        onClose={() => setShowRespondFirstPopup(false)}
        otherParticipantName={otherParticipantName || 'the other person'}
      />
    </div>
  );
}