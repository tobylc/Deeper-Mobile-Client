import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AdminNavLink from "@/components/admin-nav-link";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, MessageCircle, Clock, Users, Mail } from "lucide-react";
import InvitationForm from "@/components/invitation-form";
import AccountLinking from "@/components/account-linking";
import ProfileImageUpload from "@/components/profile-image-upload";
import InviteeWelcomePopup from "@/components/invitee-welcome-popup";
import NotificationPreferences from "@/components/notification-preferences";
import type { Connection, Conversation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { UserDisplayName } from "@/hooks/useUserDisplayName";
import { useWebSocket } from "@/hooks/useWebSocket";
import DeeperLogo from "@/components/deeper-logo";
import QuotesIcon from "@/components/quotes-icon";
import { getRoleDisplayInfo, getDashboardSectionTitle } from "@shared/role-display-utils";
import { TrialStatus } from "@/components/trial-status";
import { SubscriptionEnforcement } from "@/components/subscription-enforcement";
import AdminCleanup from "@/components/admin-cleanup";
import { PaymentSuccessNotification } from "@/components/payment-success-notification";
import { InviteeUpgradeBanner } from "@/components/invitee-upgrade-banner";

interface TrialStatusData {
  isExpired: boolean;
  daysRemaining: number;
  subscriptionTier: string;
  subscriptionStatus: string;
}

export default function Dashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [welcomeData, setWelcomeData] = useState<{inviterName: string, relationshipType: string, inviterRole?: string | null, inviteeRole?: string | null} | null>(null);
  const [showSubscriptionEnforcement, setShowSubscriptionEnforcement] = useState(false);
  const [enforcementAction, setEnforcementAction] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Initialize WebSocket for real-time dashboard updates
  const { isConnected } = useWebSocket();

  // Fetch account status for profile image import options
  const { data: accountStatus } = useQuery({
    queryKey: ["/api/auth/account-status"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch trial status for countdown display
  const { data: trialStatus } = useQuery<TrialStatusData>({
    queryKey: ['/api/trial-status'],
    refetchInterval: 60000, // Check every minute
    enabled: !!user,
    retry: false,
  });

  // Check for account linking success and new invitee welcome
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const linkedProvider = urlParams.get('linked');
    const newInvitee = urlParams.get('welcome');
    const inviterEmail = urlParams.get('inviter');
    const relationshipType = urlParams.get('relationship');
    
    if (linkedProvider === 'google') {
      toast({
        title: "Account Linked Successfully!",
        description: "Your Google account has been linked. You can now sign in using either method.",
        duration: 5000,
      });
    }
    
    // Show welcome popup for new invitees
    if (newInvitee === 'true' && inviterEmail && relationshipType && user) {
      const inviterRole = urlParams.get('inviterRole');
      const inviteeRole = urlParams.get('inviteeRole');
      
      // Fetch the inviter's display name for the welcome popup
      fetch(`/api/users/display-name/${encodeURIComponent(inviterEmail)}`, {
        credentials: 'include'
      })
      .then(response => response.json())
      .then(data => {
        const inviterName = data.displayName || inviterEmail.split('@')[0];
        setWelcomeData({ inviterName, relationshipType, inviterRole: inviterRole || undefined, inviteeRole: inviteeRole || undefined });
        setShowWelcomePopup(true);
      })
      .catch(() => {
        // Fallback to email username if API fails
        const inviterName = inviterEmail.split('@')[0];
        setWelcomeData({ inviterName, relationshipType, inviterRole: inviterRole || undefined, inviteeRole: inviteeRole || undefined });
        setShowWelcomePopup(true);
      });
    }
    
    // Clean up URL parameters
    if (linkedProvider || newInvitee) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/auth");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  // Show loading state while authentication is being checked
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-radial from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  const { data: connections = [], refetch: refetchConnections } = useQuery<Connection[]>({
    queryKey: [`/api/connections/${user.email}`],
    enabled: !!user.email,
  });

  const { data: conversations = [], error: conversationsError } = useQuery<Conversation[]>({
    queryKey: [`/api/conversations/by-email/${user.email}`],
    enabled: !!user.email,
    retry: (failureCount, error: any) => {
      // Don't retry on authentication errors - these need a full page refresh
      if (error?.status === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });

  // Group conversations by connection to show only one conversation per connection
  const conversationsByConnection = conversations.reduce((acc, conversation) => {
    const connectionKey = `${conversation.participant1Email}-${conversation.participant2Email}`;
    const reverseKey = `${conversation.participant2Email}-${conversation.participant1Email}`;
    
    // Use a consistent key regardless of participant order
    const key = connectionKey < reverseKey ? connectionKey : reverseKey;
    
    if (!acc[key]) {
      acc[key] = conversation;
    } else {
      // Keep the most recently active conversation for this connection
      if (new Date(conversation.lastActivityAt || conversation.createdAt || '') > 
          new Date(acc[key].lastActivityAt || acc[key].createdAt || '')) {
        acc[key] = conversation;
      }
    }
    return acc;
  }, {} as Record<string, Conversation>);

  const uniqueConversations = Object.values(conversationsByConnection);

  // Handle authentication errors by showing a refresh prompt
  useEffect(() => {
    if (conversationsError && (conversationsError as any)?.status === 401) {
      console.log("[DASHBOARD] Authentication error detected, conversations may not load properly");
      // Optionally show a user-friendly message about refreshing
      toast({
        title: "Session Expired",
        description: "Please refresh the page to continue viewing your conversations.",
        variant: "destructive",
        duration: 10000,
      });
    }
  }, [conversationsError, toast]);

  const handleAcceptConnection = async (connectionId: number) => {
    if (!user) return;
    
    try {
      await apiRequest("PATCH", `/api/connections/${connectionId}/accept`, {
        accepterEmail: user.email,
      });
      // Find the connection to get role information for personalized toast
      const acceptedConnection = connections.find(c => c.id === connectionId);
      const roleDisplay = acceptedConnection?.inviterRole && acceptedConnection?.inviteeRole 
        ? `${acceptedConnection.inviterRole}/${acceptedConnection.inviteeRole}`
        : acceptedConnection?.relationshipType || 'Connection';
      
      toast({
        title: `${roleDisplay} connection accepted!`,
        description: "Your conversation space is ready.",
      });
      refetchConnections();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to accept connection",
        variant: "destructive",
      });
    }
  };

  const handleDeclineConnection = async (connectionId: number) => {
    if (!user) return;
    
    try {
      await apiRequest("PATCH", `/api/connections/${connectionId}/decline`, {
        declinerEmail: user.email,
      });
      toast({
        title: "Connection declined",
        description: "The invitation has been declined.",
      });
      refetchConnections();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to decline connection",
        variant: "destructive",
      });
    }
  };



  if (!user) return null;

  // Separate connections by type for better subscription clarity
  const pendingInvitations = connections.filter(c => c.status === 'pending' && c.inviteeEmail === user.email);
  const sentInvitations = connections.filter(c => c.status === 'pending' && c.inviterEmail === user.email);
  const acceptedConnections = connections.filter(c => c.status === 'accepted');
  const initiatedConnections = acceptedConnections.filter(c => c.inviterEmail === user.email);
  const receivedConnections = acceptedConnections.filter(c => c.inviteeEmail === user.email);
  const activeConversations = uniqueConversations.filter(c => c.status === 'active');

  // Check if user is an invitee (has been invited by someone else)
  const isInviteeUser = connections.some(c => c.inviteeEmail === user.email);
  
  // Invitee users cannot initiate connections, so their limit should be 0
  const userConnectionLimit = isInviteeUser ? 0 : ((user as any)?.maxConnections || 1);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="glass-nav">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <DeeperLogo size="header" />
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <span className="text-xs sm:text-sm text-white/80 truncate">
                <span className="hidden sm:inline">Welcome, </span>{(user.firstName || user.email?.split('@')[0] || 'there').substring(0, 10)}
              </span>
              
              <AdminNavLink />

              <Button 
                className="btn-ocean px-3 sm:px-6 py-2 text-xs sm:text-sm"
                onClick={async () => {
                  try {
                    await apiRequest("POST", "/api/auth/logout", {});
                    window.location.href = '/';
                  } catch (error) {
                    console.error("Logout failed:", error);
                    // Force redirect even if logout fails
                    window.location.href = '/';
                  }
                }}
              >
                <span className="sm:hidden">Out</span>
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Payment Success Notification */}
        <PaymentSuccessNotification />
        
        {/* Invitee Upgrade Banner */}
        <InviteeUpgradeBanner />

        {/* Trial Status */}
        <TrialStatus />

        {/* Subscription Status */}
        <Card className="mb-8 card-elevated border-amber/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-foreground">
                <QuotesIcon size="sm" className="mr-2" />
                Subscription Status
              </CardTitle>
              <Button 
                onClick={() => setLocation('/pricing')}
                className="btn-ocean px-4 py-2 text-sm"
                size="sm"
              >
                Upgrade
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Current Plan</p>
                <Badge variant="secondary" className="text-lg px-4 py-2">
                  {(user as any)?.subscriptionTier || 'trial'}
                </Badge>
                {/* Show trial countdown if user is on trial */}
                {trialStatus && ((user as any)?.subscriptionTier === 'trial' || trialStatus.subscriptionStatus === 'trialing') && trialStatus.daysRemaining > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {trialStatus.daysRemaining} {trialStatus.daysRemaining === 1 ? 'day' : 'days'} remaining
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Connections Initiated</p>
                <p className="text-2xl font-bold text-amber">
                  {sentInvitations.length + initiatedConnections.length} / {userConnectionLimit}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Total Connections</p>
                <p className="text-2xl font-bold text-primary">
                  {acceptedConnections.length}
                </p>
              </div>
            </div>
            <div className="mt-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Only paid members can invite others
              </p>
              <div className="flex justify-center gap-3">
                {((user as any)?.subscriptionTier === 'trial' || !(user as any)?.subscriptionTier) && (
                  <Button 
                    onClick={() => setLocation('/pricing')}
                    className="btn-amber px-6 py-2"
                  >
                    Upgrade Plan
                  </Button>
                )}
                <Button 
                  onClick={() => setLocation('/pricing')}
                  className="btn-ocean px-6 py-2"
                  variant="outline"
                >
                  View Plans
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Welcome Section */}
        <div className="mb-8 smooth-enter">
          <h1 className="text-3xl font-inter font-bold text-foreground mb-2">
            Your Connection Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage your meaningful conversations and connections
          </p>
        </div>

        {/* Quick Actions */}
        <div className={`grid gap-6 mb-8 ${isInviteeUser ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
          <Card className="card-elevated smooth-enter">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">Active Conversations</h3>
                  <p className="text-2xl font-bold text-primary">{activeConversations.length}</p>
                </div>
                <MessageCircle className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/5 border-secondary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">Pending Invites</h3>
                  <p className="text-2xl font-bold text-secondary-foreground">{pendingInvitations.length}</p>
                </div>
                <Mail className="w-8 h-8 text-secondary-foreground" />
              </div>
            </CardContent>
          </Card>

          {!isInviteeUser && (
            <Card className="bg-accent/5 border-accent/20">
              <CardContent className="p-6">
                <Button 
                  onClick={() => {
                    // Check subscription status before allowing invitation
                    if ((user as any)?.subscriptionTier === 'free' || 
                        ((user as any)?.subscriptionStatus === 'trialing' && 
                         (user as any)?.subscriptionExpiresAt && 
                         new Date((user as any).subscriptionExpiresAt) < new Date())) {
                      setEnforcementAction("invite");
                      setShowSubscriptionEnforcement(true);
                    } else {
                      setShowInviteForm(true);
                    }
                  }}
                  className="w-full h-full min-h-[80px] btn-ocean"
                >
                  <Plus className="w-6 h-6 mr-2" />
                  Send New Invitation
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <Card className="mb-8 card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center text-foreground">
                <Mail className="w-5 h-5 mr-2 text-primary" />
                Pending Invitations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingInvitations.map((connection) => (
                  <div key={connection.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">
                        <UserDisplayName email={connection.inviterEmail} />
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {(() => {
                          const roleInfo = getRoleDisplayInfo(
                            connection.relationshipType, 
                            connection.inviterRole, 
                            connection.inviteeRole
                          );
                          return `Wants to connect as: ${roleInfo.relationshipDisplay}`;
                        })()}
                      </p>
                      {connection.personalMessage && (
                        <p className="text-sm text-muted-foreground mt-1 italic">
                          "{connection.personalMessage}"
                        </p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        onClick={() => handleAcceptConnection(connection.id)}
                        className="bg-success hover:bg-success/90"
                      >
                        Accept
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleDeclineConnection(connection.id)}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sent Invitations */}
        {sentInvitations.length > 0 && (
          <Card className="mb-8 card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center text-foreground">
                <Clock className="w-5 h-5 mr-2 text-primary" />
                Sent Invitations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sentInvitations.map((connection) => (
                  <div key={connection.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">{connection.inviteeEmail}</p>
                      <p className="text-sm text-muted-foreground">
                        {(() => {
                          const roleInfo = getRoleDisplayInfo(
                            connection.relationshipType, 
                            connection.inviterRole, 
                            connection.inviteeRole
                          );
                          return `Relationship: ${roleInfo.relationshipDisplay}`;
                        })()}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline">Pending</Badge>
                        <Badge variant="secondary">{connection.inviterSubscriptionTier || 'free'} tier</Badge>
                      </div>
                      {connection.personalMessage && (
                        <p className="text-sm text-muted-foreground mt-1 italic">
                          "{connection.personalMessage}"
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        Sent {new Date(connection.createdAt!).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        They'll inherit your {connection.inviterSubscriptionTier || 'free'} benefits
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ready to Start Conversations */}
        {(() => {
          // If conversations API failed due to auth error, don't show Ready to Start section
          // This prevents showing "Start Conversation" buttons for existing conversations
          if (conversationsError && (conversationsError as any)?.status === 401) {
            return null;
          }
          
          // Find accepted connections that don't have active conversations yet
          const connectionsReadyToStart = acceptedConnections.filter(connection => {
            // Only show for inviters who need to start conversations
            if (connection.inviterEmail !== user.email) return false;
            
            // Check if there's already an active conversation for this connection
            const hasActiveConversation = activeConversations.some(conv => 
              (conv.participant1Email === connection.inviterEmail && conv.participant2Email === connection.inviteeEmail) ||
              (conv.participant1Email === connection.inviteeEmail && conv.participant2Email === connection.inviterEmail)
            );
            
            return !hasActiveConversation;
          });

          if (connectionsReadyToStart.length === 0) return null;

          return (
            <Card className="mb-8 card-elevated border-success/30 bg-success/5">
              <CardHeader>
                <CardTitle className="flex items-center text-foreground">
                  <QuotesIcon size="sm" className="mr-2" />
                  Ready to Start Conversations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {connectionsReadyToStart.map((connection) => (
                    <div key={connection.id} className="p-6 bg-white dark:bg-slate-800 border border-success/20 rounded-2xl">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center p-2">
                              <QuotesIcon size="sm" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground text-lg">
                                Connection Accepted!
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                <UserDisplayName email={connection.inviteeEmail} /> has accepted your invitation
                              </p>
                            </div>
                          </div>
                          
                          <div className="bg-amber/10 border border-amber/20 rounded-xl p-4 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageCircle className="w-4 h-4 text-amber" />
                              <h4 className="font-medium text-foreground">
                                {(() => {
                                  const roleInfo = getRoleDisplayInfo(
                                    connection.relationshipType, 
                                    connection.inviterRole, 
                                    connection.inviteeRole
                                  );
                                  return `Ready to begin your ${roleInfo.conversationContext} journey`;
                                })()}
                              </h4>
                            </div>
                            <p className="text-sm text-slate-600">
                              Your private conversation space is ready. Start with a meaningful question to begin your dialogue together.
                            </p>
                          </div>

                          <div className="flex items-center space-x-2 mb-4">
                            <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                              {(() => {
                                const roleInfo = getRoleDisplayInfo(
                                  connection.relationshipType, 
                                  connection.inviterRole, 
                                  connection.inviteeRole
                                );
                                return roleInfo.relationshipDisplay;
                              })()}
                            </Badge>
                            <Badge variant="outline">
                              Accepted {new Date(connection.acceptedAt!).toLocaleDateString()}
                            </Badge>
                          </div>

                          {connection.personalMessage && (
                            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium">Your message:</span> "{connection.personalMessage}"
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <div className="ml-6">
                          <Button 
                            onClick={async () => {
                              try {
                                console.log("Creating conversation for connection:", connection.id);
                                
                                // Create a new conversation
                                const response = await apiRequest("POST", "/api/conversations", {
                                  connectionId: connection.id,
                                  participant1Email: connection.inviterEmail,
                                  participant2Email: connection.inviteeEmail,
                                  relationshipType: connection.relationshipType,
                                  currentTurn: connection.inviterEmail // Inviter starts first
                                });
                                
                                if (!response.ok) {
                                  const errorData = await response.json();
                                  
                                  // Handle subscription enforcement errors
                                  if (errorData.type === "TRIAL_EXPIRED" || errorData.type === "SUBSCRIPTION_LIMIT") {
                                    setEnforcementAction("create_conversation");
                                    setShowSubscriptionEnforcement(true);
                                    return;
                                  }
                                  
                                  console.error("API Error Response:", response.status, errorData);
                                  throw new Error(errorData.message || `API Error: ${response.status}`);
                                }
                                
                                const conversation = await response.json();
                                console.log("Created conversation:", conversation);
                                
                                if (conversation && conversation.id) {
                                  // Refresh conversations data and wait for it
                                  await queryClient.invalidateQueries({ queryKey: [`/api/conversations/by-email/${user.email}`] });
                                  
                                  // Add a small delay to ensure the conversation is fully created
                                  setTimeout(() => {
                                    setLocation(`/conversation/${conversation.id}`);
                                  }, 500);
                                } else {

                                  toast({
                                    title: "Error",
                                    description: "Failed to create conversation - no ID returned",
                                    variant: "destructive",
                                  });
                                }
                              } catch (error: any) {

                                toast({
                                  title: "Error",
                                  description: `Failed to start conversation: ${error?.message || 'Unknown error'}`,
                                  variant: "destructive",
                                });
                              }
                            }}
                            className="btn-ocean px-6 py-3 text-lg"
                          >
                            <MessageCircle className="w-5 h-5 mr-2" />
                            Start Your First Conversation
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Active Conversations */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center text-foreground">
              <MessageCircle className="w-5 h-5 mr-2 text-primary" />
              Active Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Show loading state if conversations API failed due to auth but connections loaded successfully */}
            {conversationsError && (conversationsError as any)?.status === 401 && acceptedConnections.length > 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Loading conversations...</h3>
                <p className="text-muted-foreground mb-4">
                  Your conversations are loading. If this persists, please refresh the page.
                </p>
              </div>
            ) : activeConversations.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                {isInviteeUser ? (
                  <>
                    <h3 className="text-lg font-medium text-foreground mb-2">Connected and waiting</h3>
                    <p className="text-muted-foreground mb-4">
                      {(() => {
                        // Find the connection where user is invitee to get inviter's name
                        const inviterConnection = connections.find(c => c.inviteeEmail === user.email && c.status === 'accepted');
                        if (inviterConnection) {
                          return (
                            <span>
                              You've been connected to <UserDisplayName email={inviterConnection.inviterEmail} />.
                              <br />
                              Waiting for them to initiate your first conversation.
                            </span>
                          );
                        }
                        return "You've been connected! Waiting for your conversation partner to start your first dialogue.";
                      })()}
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-medium text-foreground mb-2">No active conversations</h3>
                    <p className="text-muted-foreground mb-4">
                      Send an invitation to start your first meaningful conversation
                    </p>
                    <Button onClick={() => setShowInviteForm(true)} className="btn-ocean">
                      <Plus className="w-4 h-4 mr-2" />
                      Send Invitation
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {activeConversations.map((conversation) => {
                  const otherParticipant = conversation.participant1Email === user.email 
                    ? conversation.participant2Email 
                    : conversation.participant1Email;
                  const isMyTurn = conversation.currentTurn === user.email;
                  
                  return (
                    <div key={conversation.id} className="flex items-center justify-between p-4 bg-muted rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {otherParticipant.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              <UserDisplayName email={otherParticipant} />
                            </p>
                            <div className="flex items-center space-x-2">
                              <Badge variant="secondary">
                                {(() => {
                                  // Find the connection for this conversation to get roles
                                  const connection = acceptedConnections.find(conn => 
                                    (conn.inviterEmail === conversation.participant1Email && conn.inviteeEmail === conversation.participant2Email) ||
                                    (conn.inviterEmail === conversation.participant2Email && conn.inviteeEmail === conversation.participant1Email)
                                  );
                                  
                                  if (connection) {
                                    const roleInfo = getRoleDisplayInfo(
                                      connection.relationshipType, 
                                      connection.inviterRole, 
                                      connection.inviteeRole
                                    );
                                    return roleInfo.relationshipDisplay;
                                  }
                                  
                                  return conversation.relationshipType; // fallback
                                })()}
                              </Badge>
                              <Badge variant={isMyTurn ? "default" : "outline"}>
                                {isMyTurn ? "Your turn" : "Their turn"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {new Date(conversation.createdAt!).toLocaleDateString()}
                        </span>
                        <Button 
                          onClick={() => setLocation(`/conversation/${conversation.id}`)}
                          className="ml-4 btn-ocean"
                        >
                          Continue
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profile Management Section */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Profile Image Upload */}
          <ProfileImageUpload 
            currentImageUrl={user?.profileImageUrl ?? undefined}
            userEmail={user?.email || undefined}
            hasGoogleLinked={user?.googleId ? true : false}
            onImageUpdate={() => {
              // Refresh user data
              queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
            }}
          />
          
          {/* Account Security */}
          <AccountLinking />
        </div>

        {/* Notification Preferences Section */}
        {user && (
          <div className="mb-8">
            <NotificationPreferences user={user} />
          </div>
        )}

        {/* Admin Section */}
        {user && (user.email?.includes('toby@gowithclark.com') || user.email?.includes('thetobyclarkshow@gmail.com')) && (
          <div className="mb-8">
            <AdminCleanup />
          </div>
        )}
      </div>

      {/* Invitation Form Modal */}
      {showInviteForm && (
        <InvitationForm 
          onClose={() => setShowInviteForm(false)}
          onSuccess={() => {
            setShowInviteForm(false);
            refetchConnections();
          }}
        />
      )}

      {/* Welcome Popup for New Invitees */}
      {showWelcomePopup && welcomeData && (
        <InviteeWelcomePopup
          inviterName={welcomeData.inviterName}
          relationshipType={welcomeData.relationshipType}
          inviterRole={welcomeData.inviterRole ?? undefined}
          inviteeRole={welcomeData.inviteeRole ?? undefined}
          onClose={() => setShowWelcomePopup(false)}
        />
      )}

      {/* Subscription Enforcement Modal */}
      <SubscriptionEnforcement
        isOpen={showSubscriptionEnforcement}
        onClose={() => setShowSubscriptionEnforcement(false)}
        action={enforcementAction}
      />

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-slate-700 bg-slate-900/50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <DeeperLogo size="sm" />
              <span className="text-slate-400 text-sm">© 2025 Deeper. All rights reserved.</span>
            </div>
            <div className="flex items-center space-x-6">
              <a 
                href="/privacy-policy" 
                className="text-slate-400 hover:text-ocean text-sm transition-colors"
              >
                Privacy Policy
              </a>
              <a 
                href="mailto:support@joindeeper.com" 
                className="text-slate-400 hover:text-ocean text-sm transition-colors"
              >
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
