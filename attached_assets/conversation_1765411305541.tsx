import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, Users, Clock, MessageCircle, Grid3X3, Eye, EyeOff } from "lucide-react";
import ConversationInterface from "@/components/conversation-interface";
import ConversationThreads from "@/components/conversation-threads";
import QuestionSuggestions from "@/components/question-suggestions";
import ProfileAvatar from "@/components/profile-avatar";
import OnboardingPopup from "@/components/onboarding-popup";
import ThoughtfulResponsePopup from "@/components/thoughtful-response-popup";
import QuestionChoicePopup from "@/components/question-choice-popup";
import NotificationPreferencePopup from "@/components/notification-preference-popup";
import TrialExpirationPopup from "@/components/trial-expiration-popup";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { UserDisplayName, useUserDisplayName } from "@/hooks/useUserDisplayName";
import { useWebSocket } from "@/hooks/useWebSocket";
import { getRoleDisplayInfo, getConversationHeaderText } from "@shared/role-display-utils";
import { HypnoticOrbs } from "@/components/hypnotic-orbs";
import FloatingWaitingText from "@/components/floating-waiting-text";
import type { Conversation, Message, Connection, User } from "@shared/schema";

export default function ConversationPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();
  const [newMessage, setNewMessage] = useState("");
  const [isFromQuestionSuggestions, setIsFromQuestionSuggestions] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<number | undefined>();
  const [showThreadsView, setShowThreadsView] = useState(false);
  const [showOnboardingPopup, setShowOnboardingPopup] = useState(false);
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [showTrialExpirationPopup, setShowTrialExpirationPopup] = useState(false);

  const [showThoughtfulResponsePopup, setShowThoughtfulResponsePopup] = useState(false);
  const [responseStartTime, setResponseStartTime] = useState<Date | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string>("");
  const [hasStartedResponse, setHasStartedResponse] = useState(false);
  
  // CORE LOGIC: Question Choice Popup State - detects when user types question ending with "?"
  const [showQuestionChoicePopup, setShowQuestionChoicePopup] = useState(false);
  const [pendingQuestionText, setPendingQuestionText] = useState("");
  
  // Orbs visibility toggle state with localStorage persistence
  const [showOrbsBackground, setShowOrbsBackground] = useState(() => {
    const saved = localStorage.getItem('deeperapp-show-orbs');
    return saved !== null ? JSON.parse(saved) : true; // Default to true (show orbs)
  });

  // Function to toggle orbs visibility and save to localStorage
  const toggleOrbsBackground = () => {
    const newValue = !showOrbsBackground;
    setShowOrbsBackground(newValue);
    localStorage.setItem('deeperapp-show-orbs', JSON.stringify(newValue));
  };
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Initialize WebSocket for real-time conversation synchronization - CRITICAL FIX
  const { isConnected: wsConnected, connectionAttempts } = useWebSocket();

  // Check if user was invited by someone else (is an invitee)
  const { data: connections = [] } = useQuery<Connection[]>({
    queryKey: [`/api/connections/${user?.email}`],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/connections/${user?.email}`);
        if (!response.ok) {
          return [];
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Connections loading error:', error);
        return [];
      }
    },
    enabled: !!user?.email,
    throwOnError: false,
    retry: false,
  });

  const isInviteeUser = Array.isArray(connections) ? connections.some(c => c.inviteeEmail === user?.email) : false;

  useEffect(() => {
    if (!user) {
      setLocation("/auth");
      return;
    }
  }, [user, setLocation]);

  // Show loading if user is not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-radial from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-ocean to-teal flex items-center justify-center p-3 mx-auto mb-4">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-300">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Initialize selected conversation ID from URL
  useEffect(() => {
    if (id && !selectedConversationId) {
      console.log("Setting conversation ID from URL:", id);
      setSelectedConversationId(parseInt(id));
    }
  }, [id, selectedConversationId]);

  // Listen for WebSocket conversation thread creation events
  useEffect(() => {
    const handleConversationThreadCreated = (event: CustomEvent) => {
      const { conversationId } = event.detail;
      if (conversationId) {
        setSelectedConversationId(conversationId);
        setNewMessage(""); // Clear any existing message
      }
    };

    window.addEventListener('conversationThreadCreated', handleConversationThreadCreated as EventListener);
    
    return () => {
      window.removeEventListener('conversationThreadCreated', handleConversationThreadCreated as EventListener);
    };
  }, []);

  // Listen for trial expiration events from voice messages and other actions
  useEffect(() => {
    const handleTrialExpired = (event: CustomEvent) => {
      if (!isInviteeUser) {
        setShowTrialExpirationPopup(true);
      }
    };

    window.addEventListener('trialExpired', handleTrialExpired as EventListener);
    
    return () => {
      window.removeEventListener('trialExpired', handleTrialExpired as EventListener);
    };
  }, [isInviteeUser]);

  // Listen for subscription canceled events from voice messages and other actions
  useEffect(() => {
    const handleSubscriptionCanceled = (event: CustomEvent) => {
      if (!isInviteeUser) {
        setShowTrialExpirationPopup(true); // Reuse the same popup for now, as it handles upgrade flow
      }
    };

    window.addEventListener('subscriptionCanceled', handleSubscriptionCanceled as EventListener);
    
    return () => {
      window.removeEventListener('subscriptionCanceled', handleSubscriptionCanceled as EventListener);
    };
  }, [isInviteeUser]);

  // Enhanced WebSocket integration to synchronize thread reopening between users
  useEffect(() => {
    const handleThreadSyncEvent = (event: CustomEvent) => {
      console.log('[CONVERSATION] Received conversationSync event:', event.detail);
      const { conversationId, action } = event.detail;
      
      if (action === 'thread_reopened' && conversationId) {
        console.log('[CONVERSATION] Processing thread reopening sync for conversation:', conversationId);
        console.log('[CONVERSATION] Current selected conversation:', selectedConversationId);
        
        // Always sync to the reopened thread, regardless of current selection
        // This ensures both users see identical conversation states
        setSelectedConversationId(conversationId);
        setNewMessage(""); // Clear any pending message
        setLocation(`/conversation/${conversationId}`);
        
        // CRITICAL FIX: ZERO query invalidation during thread reopening to preserve turn state
        // Thread reopening is pure navigation - WebSocket sync handles user coordination
        // Any query refresh here corrupts turn state by race conditions with backend
        
        console.log('[CONVERSATION] Successfully synchronized to reopened conversation thread - ZERO data refresh for turn preservation');
      } else {
        console.log('[CONVERSATION] Thread sync event ignored - different action or missing conversationId');
      }
    };

    console.log('[CONVERSATION] Adding conversationSync event listener');
    window.addEventListener('conversationSync', handleThreadSyncEvent as EventListener);
    
    return () => {
      console.log('[CONVERSATION] Removing conversationSync event listener');
      window.removeEventListener('conversationSync', handleThreadSyncEvent as EventListener);
    };
  }, [selectedConversationId, setLocation, queryClient]);

  const { data: conversation, isLoading: conversationLoading, error: conversationError } = useQuery<Conversation>({
    queryKey: [`/api/conversations/${selectedConversationId || id}`],
    queryFn: async () => {
      const conversationId = selectedConversationId || id;
      try {
        const response = await apiRequest('GET', `/api/conversations/${conversationId}`);
        if (!response.ok) {
          throw new Error(`Failed to load conversation: ${response.status}`);
        }
        return response.json();
      } catch (error) {
        console.error('Conversation loading error:', error);
        throw error;
      }
    },
    enabled: !!(selectedConversationId || id) && !!user,
    retry: 1,
    retryDelay: 1000,
    throwOnError: false,
  });

  // Determine other participant after conversation is loaded
  const otherParticipant = conversation && user?.email 
    ? (conversation.participant1Email === user.email 
        ? conversation.participant2Email 
        : conversation.participant1Email)
    : null;

  // Get connection info for threading
  const { data: connection } = useQuery<Connection>({
    queryKey: [`/api/connections/by-id/${conversation?.connectionId}`],
    queryFn: async () => {
      try {
        console.log('[CONNECTION_DEBUG] Fetching connection for ID:', conversation?.connectionId);
        const response = await apiRequest('GET', `/api/connections/by-id/${conversation?.connectionId}`);
        if (!response.ok) {
          console.log('[CONNECTION_DEBUG] Connection fetch failed:', response.status);
          return null;
        }
        const connectionData = await response.json();
        console.log('[CONNECTION_DEBUG] Fetched connection data:', connectionData);
        return connectionData;
      } catch (error) {
        console.error('[CONNECTION_DEBUG] Connection loading error:', error);
        return null;
      }
    },
    enabled: !!conversation?.connectionId && !!user,
    retry: false,
    throwOnError: false,
  });

  // Determine user roles based on connection data
  const currentUserRole = connection && user?.email 
    ? (connection.inviterEmail === user.email 
        ? connection.inviterRole 
        : connection.inviteeRole)
    : '';

  const otherUserRole = connection && user?.email 
    ? (connection.inviterEmail === user.email 
        ? connection.inviteeRole 
        : connection.inviterRole)
    : '';

  // Determine if current user is the inviter
  const isInviter = connection && user?.email 
    ? connection.inviterEmail === user.email 
    : false;

  // Get user data for both participants
  const { data: currentUserData } = useQuery<User>({
    queryKey: [`/api/users/by-email/${user?.email}`],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/users/by-email/${user?.email}`);
        if (!response.ok) {
          return null;
        }
        return response.json();
      } catch (error) {
        console.error('Current user data loading error:', error);
        return null;
      }
    },
    enabled: !!user?.email,
    retry: false,
    throwOnError: false,
  });

  const { data: otherUserData } = useQuery<User>({
    queryKey: [`/api/users/by-email/${otherParticipant}`],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/users/by-email/${otherParticipant}`);
        if (!response.ok) {
          return null;
        }
        return response.json();
      } catch (error) {
        console.error('Other user data loading error:', error);
        return null;
      }
    },
    enabled: !!otherParticipant && typeof otherParticipant === 'string',
    retry: false,
    throwOnError: false,
  });

  const { data: messages = [], isLoading: messagesLoading, error: messagesError } = useQuery<Message[]>({
    queryKey: [`/api/conversations/${selectedConversationId || id}/messages`],
    queryFn: async () => {
      const conversationId = selectedConversationId || id;
      try {
        const response = await apiRequest('GET', `/api/conversations/${conversationId}/messages`);
        if (!response.ok) {
          return [];
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Messages loading error:', error);
        return [];
      }
    },
    enabled: !!(selectedConversationId || id) && !!user,
    retry: 1,
    retryDelay: 1000,
    staleTime: 0,
    refetchOnMount: true,
    throwOnError: false,
  });

  // Check notification preference status for this conversation
  const { data: notificationPref } = useQuery({
    queryKey: [`/api/users/notification-preference/${selectedConversationId || id}`],
    queryFn: async () => {
      const conversationId = selectedConversationId || id;
      const response = await apiRequest('GET', `/api/users/notification-preference/${conversationId}`);
      return response.json();
    },
    enabled: !!(selectedConversationId || id) && !!user,
  });

  // Check if user needs to see onboarding popup - only show once globally per user
  useEffect(() => {
    if (currentUserData && currentUserData.hasSeenOnboarding === false && conversation && !showOnboardingPopup) {
      // Only show if user has never seen onboarding globally
      setShowOnboardingPopup(true);
    }
  }, [currentUserData?.hasSeenOnboarding, conversation?.id]);





  // Mutation to mark onboarding as complete
  const markOnboardingCompleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/users/mark-onboarding-complete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/by-email/${user?.email}`] });
      setShowOnboardingPopup(false);
    },
  });

  // Mutation to set notification preference
  const setNotificationPreferenceMutation = useMutation({
    mutationFn: async (data: { conversationId: number; preference: "email" | "sms" | "both" }) => {
      return apiRequest('POST', '/api/users/notification-preference', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/notification-preference/${selectedConversationId || id}`] });
      setShowNotificationPopup(false);
    },
  });

  // Mutation to dismiss notification popup
  const dismissNotificationPopupMutation = useMutation({
    mutationFn: async (data: { conversationId: number; dismissType: "never" | "later" }) => {
      return apiRequest('POST', '/api/users/dismiss-notification-popup', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/notification-preference/${selectedConversationId || id}`] });
      setShowNotificationPopup(false);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content: string; type: 'question' | 'response' | 'follow up' }) => {
      if (!user?.email) {
        throw new Error("User not authenticated");
      }
      if (!data.content.trim()) {
        throw new Error("Message content cannot be empty");
      }
      const response = await apiRequest("POST", `/api/conversations/${selectedConversationId || id}/messages`, {
        senderEmail: user.email,
        content: data.content.trim(),
        type: data.type,
      });
      
      return response.json();
    },
    onSuccess: (responseData) => {
      // Check if a new thread was created automatically
      if (responseData.newThreadCreated && responseData.newConversationId) {
        console.log('[THREAD_CREATION] New thread created automatically, switching to:', responseData.newConversationId);
        
        // Switch to the new conversation thread immediately
        setSelectedConversationId(responseData.newConversationId);
        setLocation(`/conversation/${responseData.newConversationId}`);
        
        // Force immediate cache refresh for thread lists to ensure left column updates instantly
        if (conversation?.connectionId) {
          // Invalidate and immediately refetch to force synchronous update
          queryClient.invalidateQueries({ queryKey: [`/api/connections/${conversation.connectionId}/conversations`] });
          queryClient.invalidateQueries({ queryKey: [`/api/connections/${conversation.connectionId}/conversations/message-counts`] });
          
          // Use setTimeout to trigger refetch after invalidation
          setTimeout(() => {
            queryClient.refetchQueries({ queryKey: [`/api/connections/${conversation.connectionId}/conversations`] });
            queryClient.refetchQueries({ queryKey: [`/api/connections/${conversation.connectionId}/conversations/message-counts`] });
          }, 100);
        }
        
        // Invalidate queries for both old and new conversations
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/${responseData.originalConversationId}/messages`] });
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/${responseData.newConversationId}/messages`] });
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/${responseData.newConversationId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/by-email/${user?.email}`] });
        
        toast({
          title: "New conversation started!",
          description: "Your question has started a new conversation thread",
        });
      } else {
        // Regular message sent to existing conversation - ENHANCED IMMEDIATE SYNC
        const conversationId = selectedConversationId || id;
        
        // PHASE 1: Immediate local cache invalidation
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/messages`] });
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/conversations/by-email/${user?.email}`] });
        queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
        
        // PHASE 2: Force immediate refetch with no delay
        Promise.all([
          queryClient.refetchQueries({ queryKey: [`/api/conversations/${conversationId}`] }),
          queryClient.refetchQueries({ queryKey: [`/api/conversations/${conversationId}/messages`] }),
          queryClient.refetchQueries({ queryKey: ['/api/connections'] }),
          queryClient.refetchQueries({ queryKey: [`/api/conversations/by-email/${user?.email}`] })
        ]).then(() => {
          console.log('[SYNC] Immediate sync completed successfully');
        });
        
        // PHASE 3: Enhanced sync for conversation threads if available
        if (conversation?.connectionId) {
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: [`/api/connections/${conversation.connectionId}/conversations`] });
            queryClient.invalidateQueries({ queryKey: [`/api/connections/${conversation.connectionId}/conversations/message-counts`] });
            queryClient.refetchQueries({ queryKey: [`/api/connections/${conversation.connectionId}/conversations`] });
            queryClient.refetchQueries({ queryKey: [`/api/connections/${conversation.connectionId}/conversations/message-counts`] });
          }, 50); // Minimal delay for thread sync
        }
        
        toast({
          title: "Message sent!",
          description: "Your message has been delivered",
        });
      }
      
      // Check if this is user's first message in this conversation and they haven't set notification preferences
      if (messages.length === 0 && notificationPref && !notificationPref.hasPreference && !notificationPref.neverShow) {
        setShowNotificationPopup(true);
      }
      
      setNewMessage("");
    },
    onError: (error: any) => {
      console.error('[CONVERSATION] Message sending error:', error);
      
      // Parse error response to check for trial expiration
      let errorData;
      try {
        // Handle cases where error message includes HTTP status code prefix (e.g., "403: {json}")
        let errorMessage = error.message || "";
        
        // Extract JSON part if there's a status code prefix
        const jsonMatch = errorMessage.match(/\d{3}:\s*(\{.*\})/);
        if (jsonMatch) {
          errorMessage = jsonMatch[1];
        }
        
        errorData = JSON.parse(errorMessage);
      } catch {
        // If JSON parsing fails, check if the raw message contains trial expiration indicators
        const errorMessage = error.message || "";
        errorData = { 
          message: errorMessage,
          type: errorMessage.includes("TRIAL_EXPIRED") ? "TRIAL_EXPIRED" : undefined
        };
      }
      
      // Show beautiful trial expiration popup for trial expired errors (but not for invitee users)
      if ((errorData.type === "TRIAL_EXPIRED" || (errorData.message && errorData.message.includes("trial has expired"))) && !isInviteeUser) {
        console.log('[CONVERSATION] Showing trial expiration popup');
        setShowTrialExpirationPopup(true);
        return;
      }
      
      // Show trial expiration popup for subscription canceled errors (but not for invitee users)
      if ((errorData.type === "SUBSCRIPTION_CANCELED" || (errorData.message && errorData.message.includes("subscription has been canceled"))) && !isInviteeUser) {
        console.log('[CONVERSATION] Showing trial expiration popup for canceled subscription');
        setShowTrialExpirationPopup(true); // Reuse the same popup for upgrade flow
        return;
      }
      
      // For other errors, still show a nicer toast (not destructive red)
      toast({
        title: "Unable to send message",
        description: errorData.message || "Please try again in a moment",
      });
    },
  });

  // Create new conversation thread mutation
  const createNewThreadMutation = useMutation({
    mutationFn: async (question: string) => {
      if (!conversation?.connectionId) {
        throw new Error("Connection ID not available");
      }
      const response = await apiRequest("POST", `/api/connections/${conversation.connectionId}/conversations/with-question`, {
        question: question.trim()
      });
      return response.json();
    },
    onSuccess: (data) => {
      const conversationId = data.conversation?.id;
      if (conversationId) {
        handleNewThreadCreated(conversationId);
        
        // ENHANCED IMMEDIATE SYNC for new thread creation
        Promise.all([
          queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] }),
          queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/messages`] }),
          queryClient.invalidateQueries({ queryKey: [`/api/conversations/by-email/${user?.email}`] }),
          queryClient.invalidateQueries({ queryKey: ['/api/connections'] })
        ]).then(() => {
          queryClient.refetchQueries({ queryKey: [`/api/conversations/${conversationId}`] });
          queryClient.refetchQueries({ queryKey: [`/api/conversations/${conversationId}/messages`] });
          queryClient.refetchQueries({ queryKey: [`/api/conversations/by-email/${user?.email}`] });
          queryClient.refetchQueries({ queryKey: ['/api/connections'] });
          console.log('[SYNC] New thread immediate sync completed');
        });
        
        toast({
          title: "New conversation started!",
          description: "Your question has started a new conversation thread",
        });
      } else {
        console.error('[NEW_THREAD] No conversation ID in response:', data);
        toast({
          title: "Error creating conversation",
          description: "Please try again",
        });
      }
    },
    onError: (error) => {
      console.error('[NEW_THREAD] Failed to create new thread:', error);
      
      // Parse error response to check for trial expiration
      let errorData;
      try {
        // Handle cases where error message includes HTTP status code prefix (e.g., "403: {json}")
        let errorMessage = error.message || "";
        
        // Extract JSON part if there's a status code prefix
        const jsonMatch = errorMessage.match(/\d{3}:\s*(\{.*\})/);
        if (jsonMatch) {
          errorMessage = jsonMatch[1];
        }
        
        errorData = JSON.parse(errorMessage);
        console.log('[NEW_THREAD] Error details:', errorData);
      } catch {
        // If JSON parsing fails, check if the raw message contains trial expiration indicators
        const errorMessage = error.message || "";
        errorData = { 
          message: errorMessage,
          type: errorMessage.includes("TRIAL_EXPIRED") ? "TRIAL_EXPIRED" : undefined
        };
      }
      
      // Show beautiful trial expiration popup for trial expired errors (but not for invitee users)
      if ((errorData.type === "TRIAL_EXPIRED" || (errorData.message && errorData.message.includes("trial has expired"))) && !isInviteeUser) {
        console.log('[NEW_THREAD] Showing trial expiration popup');
        setShowTrialExpirationPopup(true);
        return;
      }
      
      // Show trial expiration popup for subscription canceled errors (but not for invitee users)
      if ((errorData.type === "SUBSCRIPTION_CANCELED" || (errorData.message && errorData.message.includes("subscription has been canceled"))) && !isInviteeUser) {
        console.log('[NEW_THREAD] Showing trial expiration popup for canceled subscription');
        setShowTrialExpirationPopup(true); // Reuse the same popup for upgrade flow
        return;
      }
      
      // For other errors, show a nicer toast (not destructive red)
      toast({
        title: "Unable to start new conversation",
        description: errorData.message || "Please try again",
      });
    }
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
          <h2 className="text-xl font-semibold mb-4">Please log in to view this conversation</h2>
          <Button onClick={() => setLocation("/auth")} className="btn-ocean">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  if (conversationLoading || messagesLoading) {
    return (
      <div className="min-h-screen bg-gradient-radial from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-ocean to-teal flex items-center justify-center p-3 mx-auto mb-4">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-300">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (conversationError || messagesError) {

    return (
      <div className="min-h-screen bg-gradient-radial from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="bg-[#1B2137]/90 backdrop-blur-md p-8 rounded-2xl shadow-lg text-center border border-[#4FACFE]/30">
          <h2 className="text-xl font-semibold mb-4 text-white">Error loading conversation</h2>
          <p className="text-slate-300 mb-4">There was an issue loading this conversation. This might be a temporary network issue.</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => window.location.reload()} className="bg-gradient-to-r from-[#4FACFE] to-teal text-white">
              Try Again
            </Button>
            <Button onClick={() => setLocation("/dashboard")} variant="outline" className="border-[#4FACFE]/30 text-[#4FACFE] hover:bg-[#4FACFE]/10">
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="min-h-screen bg-gradient-radial from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="bg-[#1B2137]/90 backdrop-blur-md p-8 rounded-2xl shadow-lg text-center border border-[#4FACFE]/30">
          <h2 className="text-xl font-semibold mb-4 text-white">Conversation not found</h2>
          <p className="text-slate-300 mb-4">This conversation may not exist or you may not have access to it.</p>
          <Button onClick={() => setLocation("/dashboard")} className="bg-gradient-to-r from-[#4FACFE] to-teal text-white">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Correct turn logic: inviter (participant1) always starts the conversation
  // For empty conversations, inviter should always have the first turn
  const isMyTurn = conversation && user?.email && messages && Array.isArray(messages)
    ? (messages.length === 0 
        ? conversation.participant1Email === user.email // Inviter gets first turn in empty conversation
        : conversation.currentTurn === user.email)
    : false;
  
  // CORE RULES: Message type determination based on conversation state
  const getNextMessageType = (): 'question' | 'response' => {
    try {
      // CORE RULE #1: Empty conversation, inviter always starts with a question
      if (!messages || !Array.isArray(messages) || messages.length === 0) return 'question';
      
      // Find the most recent question in the conversation
      let lastQuestionIndex = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i] && messages[i].type === 'question') {
          lastQuestionIndex = i;
          break;
        }
      }
      
      // CORE RULE #2: If there's a question without a response, only allow responses
      if (lastQuestionIndex !== -1) {
        const messagesAfterLastQuestion = messages.slice(lastQuestionIndex + 1);
        const hasResponseToLastQuestion = messagesAfterLastQuestion.some(msg => msg && msg.type === 'response');
        
        if (!hasResponseToLastQuestion) {
          return 'response';
        }
      }
      
      // CORE RULE #7: After questions are answered, text input creates follow-up responses
      // New questions ONLY via right column suggestions or "Ask New Question" button
      return 'response';
    } catch (error) {
      return 'response'; // Safe default to prevent accidental new thread creation
    }
  };

  const nextMessageType = getNextMessageType();

  // Check if user has provided at least one response to allow new questions
  const hasProvidedResponse = messages && Array.isArray(messages) 
    ? messages.some(msg => msg && msg.type === 'response' && msg.senderEmail === user?.email)
    : false;

  // CORE RULE #1: Inviter ALWAYS asks the FIRST INITIAL QUESTION without restrictions
  // CORE RULE #10: After initial question, new questions need responses before other actions
  const checkLastQuestionNeedsResponse = () => {
    try {
      // RULE #1: Empty conversations (first message) never need responses - inviter starts freely
      if (!messages || !Array.isArray(messages) || messages.length === 0) return false;
      
      // Find the most recent question in current conversation
      let lastQuestionIndex = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i] && messages[i].type === 'question') {
          lastQuestionIndex = i;
          break;
        }
      }
      
      // If there's a question, check if it has a response
      if (lastQuestionIndex !== -1) {
        const messagesAfterLastQuestion = messages.slice(lastQuestionIndex + 1);
        const hasResponseToLastQuestion = messagesAfterLastQuestion.some(msg => msg && msg.type === 'response');
        return !hasResponseToLastQuestion;
      }
      
      return false;
    } catch (error) {

      return false;
    }
  };

  const lastQuestionNeedsResponse = checkLastQuestionNeedsResponse();

  // Check if there has been at least one complete question-response exchange in this thread
  const hasCompleteExchange = messages && Array.isArray(messages) && messages.length >= 2 && 
    messages.some(msg => msg && msg.type === 'question') && 
    messages.some(msg => msg && msg.type === 'response');



  // CORE RULES VALIDATION: Right column availability based on fundamental conversation logic
  const checkCanUseRightColumn = () => {
    try {
      // Safety checks for required data
      if (!conversation || !user?.email || !messages || !Array.isArray(messages)) return false;
      
      // CORE RULE #1: Inviter ALWAYS gets first turn in empty conversation (no restrictions)
      if (messages.length === 0 && conversation.participant1Email === user.email) return true;
      
      // Basic turn validation for non-empty conversations
      if (!isMyTurn) return false;
      
      // CORE RULE #10: Block right column if current conversation has unanswered question (but not for first message)
      if (messages.length > 0 && lastQuestionNeedsResponse) return false;
      
      // Allow right column usage when it's user's turn and no unanswered questions
      return true;
    } catch (error) {
      return false; // Safe default
    }
  };

  const canUseRightColumn = checkCanUseRightColumn();
  
  // CORE RULES VALIDATION: New thread creation based on exchange requirements
  const checkCanCreateNewThread = () => {
    try {
      // Safety checks for required data
      if (!conversation || !user?.email || !messages || !Array.isArray(messages)) return false;
      
      // CORE RULE #2: Must have complete exchange before creating new threads (not applicable to first message)
      if (messages.length === 0) return false; // Can't create new thread if no initial conversation exists
      if (!hasCompleteExchange) return false;
      
      // CORE RULE #10: Must not have unanswered questions in current conversation
      if (lastQuestionNeedsResponse) return false;
      
      return true;
    } catch (error) {
      return false;
    }
  };

  const canCreateNewThread = checkCanCreateNewThread();



  const checkResponseTime = () => {
    if (!responseStartTime) return true;
    
    const now = new Date();
    const timeDifference = now.getTime() - responseStartTime.getTime();
    const tenMinutesInMs = 10 * 60 * 1000; // 10 minutes in milliseconds
    
    return timeDifference >= tenMinutesInMs;
  };

  const getRemainingTime = () => {
    if (!responseStartTime) return 0;
    
    const now = new Date();
    const timeDifference = now.getTime() - responseStartTime.getTime();
    const tenMinutesInMs = 10 * 60 * 1000;
    const remaining = tenMinutesInMs - timeDifference;
    
    return Math.max(0, Math.ceil(remaining / 1000)); // Return seconds remaining
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    // CORE LOGIC: Question Mark Detection - check if user typed a question in the middle column
    // Only applies when nextMessageType would be 'response' and message ends with "?"
    const messageEndsWithQuestionMark = newMessage.trim().endsWith('?');
    const isTypedDirectly = !isFromQuestionSuggestions;
    const wouldBeResponse = nextMessageType === 'response';
    
    if (messageEndsWithQuestionMark && isTypedDirectly && wouldBeResponse && canCreateNewThread) {
      // Show question choice popup - let user decide if this should be new question or response
      setPendingQuestionText(newMessage.trim());
      setShowQuestionChoicePopup(true);
      return;
    }
    
    // Determine message type: if from question suggestions, always use "question"
    const messageType = isFromQuestionSuggestions ? 'question' : nextMessageType;
    
    // CORE RULE #1: Inviter's first question always sends immediately (no timer)
    // CORE RULE #6: NO questions should have the thoughtful timer attached
    if (messageType === 'question') {
      proceedWithSending(newMessage);
      return;
    }
    
    // For responses, check timer requirements
    if (messageType === 'response' && hasStartedResponse && !checkResponseTime()) {
      setPendingMessage(newMessage);
      setShowThoughtfulResponsePopup(true);
      return;
    }
    
    // Proceed with sending the message
    proceedWithSending(newMessage);
  };

  const proceedWithSending = (messageContent: string) => {
    // Determine message type: if from question suggestions, always use "question"
    const messageType = isFromQuestionSuggestions ? 'question' : nextMessageType;
    
    // CORE RULE #1: Inviter's first message ALWAYS goes to current conversation, never creates new thread
    const isFirstMessage = messages.length === 0;
    const isInviterFirstMessage = isFirstMessage && conversation.participant1Email === user?.email;
    
    // CORE RULE #1: First message by inviter should always be sent to current conversation
    if (isInviterFirstMessage || messageType === 'response') {
      // Send to current conversation thread
      sendMessageMutation.mutate({
        content: messageContent,
        type: messageType,
      });
    } else if (messageType === 'question' && !isFirstMessage) {
      // Only create new thread for questions AFTER the initial exchange
      createNewThreadMutation.mutate(messageContent);
    } else {
      // Fallback: send to current thread
      sendMessageMutation.mutate({
        content: messageContent,
        type: messageType,
      });
    }

    // Reset response tracking and question suggestion flag
    setResponseStartTime(null);
    setHasStartedResponse(false);
    setPendingMessage("");
    setNewMessage("");
    setIsFromQuestionSuggestions(false);
  };

  const handleThoughtfulResponseProceed = () => {
    setShowThoughtfulResponsePopup(false);
    proceedWithSending(pendingMessage);
  };

  const handleThoughtfulResponseClose = () => {
    setShowThoughtfulResponsePopup(false);
    setPendingMessage("");
  };

  // CORE LOGIC: Question Choice Popup Handlers
  const handleQuestionChoiceSendAsNewQuestion = () => {
    setShowQuestionChoicePopup(false);
    
    // CORE FUNCTIONALITY: Send the same text to BOTH current thread AND create new thread
    // First, add the message to the current conversation thread
    sendMessageMutation.mutate({
      content: pendingQuestionText,
      type: 'question', // This is treated as a question in the current thread
    });
    
    // Then, create new thread with the same text
    createNewThreadMutation.mutate(pendingQuestionText);
    
    // Reset all states
    setNewMessage("");
    setPendingQuestionText("");
    setIsFromQuestionSuggestions(false);
  };

  const handleQuestionChoiceSendAsResponse = () => {
    setShowQuestionChoicePopup(false);
    // Send as regular response using existing logic
    const messageType = 'response';
    
    // Check timer requirements for responses
    if (hasStartedResponse && !checkResponseTime()) {
      setPendingMessage(pendingQuestionText);
      setShowThoughtfulResponsePopup(true);
      setPendingQuestionText("");
      return;
    }
    
    // Send immediately as response
    sendMessageMutation.mutate({
      content: pendingQuestionText,
      type: messageType,
    });
    
    // Reset all states
    setNewMessage("");
    setPendingQuestionText("");
    setResponseStartTime(null);
    setHasStartedResponse(false);
    setIsFromQuestionSuggestions(false);
  };

  const handleQuestionChoiceClose = () => {
    setShowQuestionChoicePopup(false);
    setPendingQuestionText("");
  };

  const handleRecordingStart = () => {
    // NEVER start timer for inviter's first question
    const messagesArray = Array.isArray(messages) ? messages : [];
    const isInviterFirstQuestion = messagesArray.length === 0 && 
                                   connection?.inviterEmail === user?.email &&
                                   nextMessageType === 'question';
    
    if (isInviterFirstQuestion) {
      // Completely skip timer for inviter's first question
      return;
    }
    
    // NEVER start timer for new questions that will create new conversation threads
    const isNewQuestionAfterExchange = nextMessageType === 'question' && messagesArray.length > 0 && (() => {
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
      
      return hasQuestion && hasResponse && lastQuestionHasResponse;
    })();
    
    if (isNewQuestionAfterExchange) {
      // Completely skip timer for new questions that create new threads
      return;
    }
    
    if (!hasStartedResponse && !responseStartTime) {
      setHasStartedResponse(true);
      setResponseStartTime(new Date());
    }
  };

  const handleQuestionSelect = (question: string) => {
    setNewMessage(question);
    setIsFromQuestionSuggestions(true); // Mark this message as coming from question suggestions
  };

  const handleThreadSelect = async (conversationId: number) => {
    console.log('[THREAD_SELECT] Pure navigation to conversation:', conversationId);
    
    // Update frontend state immediately (pure navigation)
    setSelectedConversationId(conversationId);
    setNewMessage(""); // Clear message when switching threads
    setShowThreadsView(false); // Hide threads view on mobile after selection
    
    // Update the URL to reflect the selected conversation
    setLocation(`/conversation/${conversationId}`);
    
    // Send WebSocket notification to synchronize both users (no turn modification)
    if (conversation?.connectionId) {
      try {
        await fetch(`/api/connections/${conversation.connectionId}/switch-active-thread`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId: conversationId
          })
        });
        console.log('[THREAD_SELECT] Navigation synchronized between users');
      } catch (error) {
        console.error('[THREAD_SELECT] Sync error:', error);
      }
    }
  };

  const handleNewThreadCreated = (conversationId: number) => {
    console.log('[HANDLE_NEW_THREAD] Switching to new conversation:', conversationId);
    
    // Validate conversationId before proceeding
    if (!conversationId || isNaN(conversationId)) {
      console.error('[HANDLE_NEW_THREAD] Invalid conversation ID:', conversationId);
      return;
    }
    
    // Switch to the new conversation thread automatically
    setSelectedConversationId(conversationId);
    setNewMessage(""); // Clear any existing message
    
    // Invalidate queries to ensure fresh data for the new conversation
    queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/messages`] });
    queryClient.invalidateQueries({ queryKey: [`/api/conversations/by-email/${user?.email}`] });
    
    // Update the URL to reflect the new conversation
    setLocation(`/conversation/${conversationId}`);
  };

  const handleNotificationPreferenceSet = (preference: "email" | "sms" | "both") => {
    const conversationId = selectedConversationId || parseInt(id || '0');
    setNotificationPreferenceMutation.mutate({
      conversationId,
      preference
    });
  };

  const handleNotificationPopupDismiss = (type: "never" | "later") => {
    const conversationId = selectedConversationId || parseInt(id || '0');
    dismissNotificationPopupMutation.mutate({
      conversationId,
      dismissType: type
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-100 flex-shrink-0">
        <div className="w-full px-2 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-12 min-w-0">
            <Button 
              variant="ghost" 
              onClick={() => setLocation("/dashboard")}
              className="flex items-center text-xs sm:text-sm shrink-0"
            >
              <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
            
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1 justify-center">
              <div className="flex -space-x-1 sm:-space-x-2 shrink-0">
                <ProfileAvatar
                  email={user?.email || ''}
                  firstName={currentUserData?.firstName}
                  lastName={currentUserData?.lastName}
                  profileImageUrl={currentUserData?.profileImageUrl}
                  size="sm"
                  className="border-2 border-white shadow-md z-10 w-6 h-6 sm:w-8 sm:h-8"
                />
                <ProfileAvatar
                  email={otherParticipant || ''}
                  firstName={otherUserData?.firstName}
                  lastName={otherUserData?.lastName}
                  profileImageUrl={otherUserData?.profileImageUrl}
                  size="sm"
                  className="border-2 border-white shadow-md w-6 h-6 sm:w-8 sm:h-8"
                />
              </div>
              <div className="min-w-0 flex-1 text-center">
                <div className="font-semibold text-slate-800 text-xs sm:text-sm truncate">
                  {((currentUserData?.firstName || user?.firstName || user?.email?.split('@')[0] || 'You').substring(0, 8))} & <UserDisplayName email={otherParticipant} />
                </div>
                <div className="text-xs text-slate-600 truncate">
                  {(() => {
                    if (connection) {
                      const roleInfo = getRoleDisplayInfo(
                        connection.relationshipType, 
                        connection.inviterRole, 
                        connection.inviteeRole
                      );
                      return roleInfo.relationshipDisplay;
                    }
                    return conversation.relationshipType;
                  })()}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowThreadsView(!showThreadsView)}
                className="lg:hidden text-xs px-1 sm:px-2 py-1"
              >
                <Grid3X3 className="w-3 h-3" />
                <span className="hidden sm:inline ml-1">Questions</span>
              </Button>
              {!isMyTurn && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={toggleOrbsBackground}
                  className="text-xs px-1 sm:px-2 py-1"
                  title={showOrbsBackground ? "Hide floating orbs" : "Show floating orbs"}
                >
                  {showOrbsBackground ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span className="hidden sm:inline ml-1">Orbs</span>
                </Button>
              )}
              <div className="hidden sm:flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} 
                     title={`WebSocket: ${wsConnected ? 'Connected' : `Disconnected (${connectionAttempts} attempts)`}`} />
                <span className="text-xs text-gray-500">
                  {wsConnected ? 'Live' : 'Offline'}
                </span>
              </div>
              <Badge variant={isMyTurn ? "default" : "outline"} className="text-xs px-1 sm:px-2">
                <span className="sm:hidden">{isMyTurn ? "You" : "Them"}</span>
                <span className="hidden sm:inline">{isMyTurn ? "Your turn" : "Their turn"}</span>
              </Badge>
              <div className="hidden sm:flex text-xs text-gray-600 items-center">
                <Clock className="w-3 h-3 mr-1" />
                {messages.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full px-2 sm:px-4 lg:px-8 py-2">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 sm:gap-3 min-h-full">
          {/* Conversation Threads Sidebar */}
          <div className={`lg:col-span-1 ${showThreadsView ? 'block' : 'hidden lg:block'}`}>
            {conversation && connection && (
              <ConversationThreads
                connectionId={conversation.connectionId}
                currentUserEmail={user.email || ''}
                otherParticipantEmail={otherParticipant || ''}
                relationshipType={conversation.relationshipType}
                onThreadSelect={handleThreadSelect}
                selectedConversationId={selectedConversationId || parseInt(id!)}
                isMyTurn={isMyTurn}
                isInviter={isInviter}
              />
            )}
          </div>

          {/* Main Conversation */}
          <div className={`lg:col-span-2 ${showThreadsView ? 'hidden lg:block' : 'block'} flex flex-col h-[calc(100vh-7rem)] sm:h-[calc(100vh-8rem)] overflow-hidden`}>
            {/* Hypnotic Orbs Background Effect with Floating Text */}
            {!isMyTurn && (
              <>
                {showOrbsBackground && <HypnoticOrbs className="absolute inset-0 z-0" />}
                {/* Only show floating text when there are no messages or when messages don't fill the screen */}
                {(!messages || messages.length === 0 || messages.length < 3) && (
                  <FloatingWaitingText className="absolute inset-0 z-30" />
                )}
              </>
            )}
            <ConversationInterface 
              messages={messages}
              currentUserEmail={user.email || ''}
              participant1Email={conversation.participant1Email}
              participant2Email={conversation.participant2Email}
              isMyTurn={isMyTurn}
              relationshipType={conversation.relationshipType}
              connection={connection}

              newMessage={newMessage}
              setNewMessage={(message: string) => {
                setNewMessage(message);
                
                // Reset question suggestion flag when user manually types
                if (isFromQuestionSuggestions) {
                  setIsFromQuestionSuggestions(false);
                }
                
                // Determine if this is actually a response that needs timer
                const isActualResponse = nextMessageType === 'response' && !isFromQuestionSuggestions;
                
                // Only start timer for actual responses (NOT questions from suggestions)
                if (isActualResponse) {
                  if (message.trim() && !hasStartedResponse) {
                    setHasStartedResponse(true);
                    setResponseStartTime(new Date());
                  } else if (!message.trim() && hasStartedResponse) {
                    setHasStartedResponse(false);
                    setResponseStartTime(null);
                  }
                }
              }}
              onSendMessage={handleSendMessage}
              onRecordingStart={handleRecordingStart}
              isSending={sendMessageMutation.isPending}
              nextMessageType={nextMessageType}
              isFromQuestionSuggestions={isFromQuestionSuggestions}
              conversationId={selectedConversationId || 0}
              hasStartedResponse={hasStartedResponse}
              responseStartTime={responseStartTime}
              onTimerStart={() => {
                // Only start timer for responses (never for questions)
                const messageType = isFromQuestionSuggestions ? 'question' : nextMessageType;
                if (messageType === 'response') {
                  setHasStartedResponse(true);
                  setResponseStartTime(new Date());
                }
              }}
            />
          </div>

          {/* Question Suggestions Sidebar - Always visible */}
          <div className={`lg:col-span-1 ${showThreadsView ? 'hidden lg:block' : 'block'} h-[calc(100vh-7rem)] sm:h-[calc(100vh-8rem)] overflow-hidden`}>
            <QuestionSuggestions 
              relationshipType={conversation.relationshipType}
              userRole={currentUserRole || ''}
              otherUserRole={otherUserRole || ''}
              isMyTurn={isMyTurn}
              otherParticipant={otherParticipant || ''}
              connectionId={conversation.connectionId}
              onNewThreadCreated={handleNewThreadCreated}
              canUseRightColumn={canUseRightColumn}
              canCreateNewThread={canCreateNewThread}
              nextMessageType={nextMessageType}
              onQuestionSelect={handleQuestionSelect}
            />
          </div>
        </div>
      </div>

      {/* Onboarding Popup */}
      {showOnboardingPopup && conversation && (
        <OnboardingPopup
          isOpen={showOnboardingPopup}
          onClose={() => setShowOnboardingPopup(false)}
          onComplete={() => markOnboardingCompleteMutation.mutate()}
          userRole={conversation.participant1Email === user?.email ? 'questioner' : 'responder'}
          otherParticipant={otherParticipant}
          relationshipType={conversation.relationshipType}
          inviterRole={connection?.inviterRole}
          inviteeRole={connection?.inviteeRole}
        />
      )}

      {/* Notification Preference Popup */}
      {showNotificationPopup && notificationPref && conversation && (
        <NotificationPreferencePopup
          conversationId={selectedConversationId || parseInt(id || '0')}
          currentPreference={notificationPref.globalPreference || "email"}
          onPreferenceSet={handleNotificationPreferenceSet}
          onDismiss={handleNotificationPopupDismiss}
        />
      )}

      {/* Thoughtful Response Popup */}
      <ThoughtfulResponsePopup
        isOpen={showThoughtfulResponsePopup}
        onClose={handleThoughtfulResponseClose}
        onProceed={handleThoughtfulResponseProceed}
        remainingSeconds={getRemainingTime()}
      />

      {/* CORE LOGIC: Question Choice Popup - detects when user types question ending with "?" */}
      <QuestionChoicePopup
        isOpen={showQuestionChoicePopup}
        onClose={handleQuestionChoiceClose}
        onSendAsNewQuestion={handleQuestionChoiceSendAsNewQuestion}
        onSendAsResponse={handleQuestionChoiceSendAsResponse}
        messageText={pendingQuestionText}
      />

      {/* Trial Expiration Popup */}
      <TrialExpirationPopup
        isOpen={showTrialExpirationPopup}
        onClose={() => setShowTrialExpirationPopup(false)}
        action="messaging"
      />
    </div>
  );
}
