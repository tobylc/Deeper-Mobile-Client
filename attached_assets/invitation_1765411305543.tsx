import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, MessageCircle, Users, Sparkles, CheckCircle } from "lucide-react";
import DeeperLogo from "@/components/deeper-logo";
import QuotesIcon from "@/components/quotes-icon";
import { Link } from "wouter";
import { getRoleDisplayInfo } from "@shared/role-display-utils";

export default function InvitationLanding() {
  const [, setLocation] = useLocation();
  const [inviterEmail, setInviterEmail] = useState<string>("");
  const [relationshipType, setRelationshipType] = useState<string>("");
  const [connectionId, setConnectionId] = useState<string>("");

  useEffect(() => {
    // Extract invitation details from URL parameters (both query and path formats)
    let inviter = '';
    let relationship = '';
    let id = '';

    // First try query parameters (standard format)
    const urlParams = new URLSearchParams(window.location.search);
    inviter = urlParams.get('inviter') || '';
    relationship = urlParams.get('relationship') || '';
    id = urlParams.get('id') || '';

    // If no query params, try path format (for email client compatibility)
    if (!inviter && window.location.pathname.includes('/invitation/')) {
      const pathPart = window.location.pathname.split('/invitation/')[1];
      if (pathPart) {
        // Parse path format: inviter=email&relationship=type&id=123
        const pathParams = new URLSearchParams(pathPart.replace(/^inviter=/, ''));
        inviter = decodeURIComponent(pathPart.split('&')[0].replace('inviter=', ''));
        relationship = pathParams.get('relationship') || '';
        id = pathParams.get('id') || '';
      }
    }
    
    setInviterEmail(inviter);
    setRelationshipType(relationship);
    setConnectionId(id);
  }, []);

  // Fetch connection details to get specific roles
  const { data: connectionData } = useQuery({
    queryKey: ['/api/invitation', connectionId],
    queryFn: async () => {
      const response = await fetch(`/api/invitation/${connectionId}`);
      if (!response.ok) throw new Error('Failed to fetch connection details');
      return response.json();
    },
    enabled: !!connectionId,
  });

  // Fetch the inviter's display name using their email
  const { data: inviterName } = useQuery<string>({
    queryKey: ['/api/users/display-name', inviterEmail],
    queryFn: async () => {
      const response = await fetch(`/api/users/display-name/${encodeURIComponent(inviterEmail)}`);
      const data = await response.json();
      return data.displayName;
    },
    enabled: !!inviterEmail,
  });

  // Check if invitee email already has an account
  const { data: existingUser } = useQuery({
    queryKey: ['/api/users/by-email', connectionData?.inviteeEmail],
    queryFn: async () => {
      if (!connectionData?.inviteeEmail) return null;
      
      try {
        const response = await fetch(`/api/users/by-email/${encodeURIComponent(connectionData.inviteeEmail)}`);
        if (response.ok) {
          return await response.json();
        }
        return null;
      } catch (error) {
        return null;
      }
    },
    enabled: !!connectionData?.inviteeEmail,
  });

  const getInviterName = () => {
    return inviterName || (inviterEmail ? inviterEmail.split('@')[0] : 'someone special');
  };

  const getRelationshipDescription = () => {
    // If we have connection data with specific roles, use them
    if (connectionData?.inviterRole && connectionData?.inviteeRole) {
      const roleInfo = getRoleDisplayInfo(
        connectionData.relationshipType,
        connectionData.inviterRole,
        connectionData.inviteeRole
      );
      return roleInfo.conversationContext;
    }

    // Fallback to generic descriptions
    switch (relationshipType.toLowerCase()) {
      case 'parent-child':
        return 'parent-child';
      case 'romantic partners':
        return 'romantic';
      case 'friends':
        return 'friendship';
      case 'siblings':
        return 'sibling';
      case 'colleagues':
        return 'professional';
      default:
        return 'meaningful';
    }
  };

  const getRoleDisplayText = () => {
    // If we have connection data with specific roles, use them
    if (connectionData?.inviterRole && connectionData?.inviteeRole) {
      const roleInfo = getRoleDisplayInfo(
        connectionData.relationshipType,
        connectionData.inviterRole,
        connectionData.inviteeRole
      );
      return roleInfo.relationshipDisplay;
    }

    // Fallback to relationship type
    return relationshipType || 'Connection';
  };

  return (
    <div className="min-h-screen bg-gradient-radial from-slate-900 via-slate-800 to-slate-900">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-ocean/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-amber/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal/10 rounded-full blur-3xl"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-ocean to-teal flex items-center justify-center p-3">
                <DeeperLogo size="md" />
              </div>
            </div>
            <h1 className="text-4xl lg:text-6xl font-inter font-bold mb-4 leading-tight">
              <span className="text-ocean">You've been personally</span>
              <br />
              <span className="bg-gradient-to-r from-ocean to-amber bg-clip-text text-transparent">invited to connect</span>
            </h1>
            <p className="text-xl text-slate-50 font-inter max-w-2xl mx-auto leading-relaxed">
              {getInviterName()} has chosen you for something truly special - a private, intimate space designed exclusively for the two of you.
            </p>
          </div>

          {/* Invitation Details Card */}
          <Card className="bg-card/50 border-border backdrop-blur-sm rounded-3xl shadow-2xl mb-12">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-ocean mr-3" />
                <h2 className="text-2xl font-inter font-bold text-white">
                  This invitation is just for you
                </h2>
              </div>
              <p className="text-lg text-slate-100 mb-6 font-inter leading-relaxed">
                {getInviterName()} has invited you to begin a{' '}
                {connectionData?.inviterRole && connectionData?.inviteeRole ? (
                  <span className="font-medium text-ocean">
                    {getRoleDisplayInfo(
                      connectionData.relationshipType,
                      connectionData.inviterRole,
                      connectionData.inviteeRole
                    ).conversationContext}
                  </span>
                ) : (
                  getRelationshipDescription()
                )}{' '}
                journey together on Deeper. 
                This isn't a group chat or social network - it's a sacred space created exclusively for meaningful 
                one-on-one conversations between you and {getInviterName()}.
              </p>
              {connectionData?.inviterRole && connectionData?.inviteeRole && (
                <div className="mb-4">
                  <span className="inline-block bg-ocean/20 text-ocean px-3 py-1 rounded-full text-sm font-medium">
                    {getRoleDisplayText()}
                  </span>
                </div>
              )}
              <div className="flex justify-center">
                <Button 
                  size="lg" 
                  className="btn-ocean px-12 py-4 text-lg font-medium rounded-2xl"
                  onClick={() => {
                    if (existingUser) {
                      // User already has an account, redirect to login with invitation context
                      setLocation(`/auth?invitation=${connectionId}&existing=true`);
                    } else {
                      // New user, proceed to signup
                      setLocation(`/invitation/signup?id=${connectionId}`);
                    }
                  }}
                  disabled={!connectionData} // Disable until invitation data is loaded
                >
                  Accept Your Personal Invitation
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* What Makes This Special */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <Card className="bg-card/50 border-border backdrop-blur-sm p-8 text-left rounded-3xl">
              <CardContent className="p-0">
                <div className="w-12 h-12 rounded-xl bg-ocean/10 flex items-center justify-center mb-6">
                  <Shield className="w-6 h-6 text-ocean" />
                </div>
                <h3 className="text-xl font-inter font-semibold text-white mb-4">
                  Completely Private & Secure
                </h3>
                <p className="text-slate-100 leading-relaxed">
                  Your conversation space is encrypted and completely private. Only you and {getInviterName()} 
                  will ever have access. No algorithms, no ads, no interruptions.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border backdrop-blur-sm p-8 text-left rounded-3xl">
              <CardContent className="p-0">
                <div className="w-12 h-12 rounded-xl bg-ocean/10 flex items-center justify-center mb-6">
                  <MessageCircle className="w-6 h-6 text-ocean" />
                </div>
                <h3 className="text-xl font-inter font-semibold text-white mb-4">
                  Thoughtfully Guided Conversations
                </h3>
                <p className="text-slate-100 leading-relaxed">
                  Our expertly curated questions help you explore deeper topics naturally, 
                  creating meaningful dialogue that strengthens your connection over time.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* What Happens Next */}
          <Card className="bg-card/50 border-border backdrop-blur-sm rounded-3xl">
            <CardContent className="p-8">
              <h3 className="text-2xl font-inter font-bold text-white mb-8 text-center">
                What happens when you accept?
              </h3>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-ocean/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-6 h-6 text-ocean" />
                  </div>
                  <h4 className="font-inter font-semibold text-white mb-2">1. Quick Registration</h4>
                  <p className="text-sm text-slate-100">
                    Sign up with your preferred method - Google, Facebook, Apple, or email
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-ocean/10 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-6 h-6 text-ocean" />
                  </div>
                  <h4 className="font-inter font-semibold text-white mb-2">2. Private Space Created</h4>
                  <p className="text-sm text-slate-100">
                    Your exclusive conversation space with {getInviterName()} becomes available immediately
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-ocean/10 flex items-center justify-center mx-auto mb-4 p-2">
                    <QuotesIcon size="sm" />
                  </div>
                  <h4 className="font-inter font-semibold text-white mb-2">3. Begin Your Journey</h4>
                  <p className="text-sm text-slate-100">
                    Start exchanging thoughtful questions and responses, deepening your connection
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Call to Action */}
          <div className="text-center mt-12">
            <p className="text-slate-50 mb-6 font-inter">
              {getInviterName()} is waiting to begin this special journey with you.
            </p>
            <Button 
              size="lg" 
              className="btn-amber px-12 py-4 text-lg font-medium rounded-2xl mr-4"
              onClick={() => {
                setLocation(`/invitation/signup?id=${connectionId}`);
              }}
            >
              Accept & Join Now
            </Button>
            <p className="text-sm text-slate-100 mt-4 font-inter">
              Free to start • Private & secure • Designed for meaningful connections
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}