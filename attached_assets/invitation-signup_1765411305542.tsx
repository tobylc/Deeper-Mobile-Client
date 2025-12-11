import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import DeeperLogo from "@/components/deeper-logo";
import QuotesIcon from "@/components/quotes-icon";

export default function InvitationSignup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Get invitation ID from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const invitationId = urlParams.get('id');

  // Fetch invitation details
  const { data: invitation, isLoading: invitationLoading, error: invitationError } = useQuery({
    queryKey: ['/api/invitation', invitationId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/invitation/${invitationId}`);
      return response.json();
    },
    enabled: !!invitationId,
  });

  const getInviterName = () => {
    return invitation?.inviterEmail ? invitation.inviterEmail.split('@')[0] : 'someone special';
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim() || !lastName.trim()) {
      toast({
        title: "Full Name Required",
        description: "Please enter your first and last name.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Create account with invitation acceptance
      const response = await apiRequest("POST", "/api/invitation/accept", {
        connectionId: invitation?.id,
        inviteeEmail: invitation?.inviteeEmail,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
      });

      if (response.ok) {
        const result = await response.json();
        
        // Get role display for personalized toast
        const roleDisplay = invitation.inviterRole && invitation.inviteeRole 
          ? `${invitation.inviterRole}/${invitation.inviteeRole}`
          : invitation.relationshipType;
        
        toast({
          title: "Welcome to Deeper!",
          description: `${roleDisplay} connection established with ${getInviterName()}. Taking you to your dashboard...`,
        });
        
        // Invalidate authentication cache to refresh user state
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        
        // Redirect with welcome parameters to trigger popup
        setTimeout(() => {
          const welcomeParams = new URLSearchParams({
            welcome: 'true',
            inviter: invitation.inviterEmail,
            relationship: invitation.relationshipType,
            inviterRole: invitation.inviterRole || '',
            inviteeRole: invitation.inviteeRole || ''
          });
          // Use setLocation for proper SPA navigation
          setLocation(`/dashboard?${welcomeParams.toString()}`);
        }, 1500); // Increased delay to allow cache invalidation
      } else {
        const error = await response.json();
        
        let errorMessage = "Failed to create account. Please try again.";
        if (error.message) {
          errorMessage = error.message;
        } else if (error.required) {
          errorMessage = `Missing required fields: ${error.required.join(", ")}`;
        }
        
        toast({
          title: "Signup Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Signup error:", error);
      toast({
        title: "Connection Error",
        description: "Unable to connect to server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while fetching invitation
  if (invitationLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <Card className="w-full max-w-md mx-4 bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardContent className="pt-6">
            <p className="text-center text-slate-300">Loading invitation details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error if invitation not found or invalid
  if (invitationError || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <Card className="w-full max-w-md mx-4 bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardContent className="pt-6">
            <p className="text-center text-slate-300">Invalid invitation link. Please check your email for the correct link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-radial from-slate-900 via-slate-800 to-slate-900">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-ocean/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-amber/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal/10 rounded-full blur-3xl"></div>
      </div>
      
      <Card className="relative z-10 w-full max-w-lg mx-4 bg-card/50 border-border backdrop-blur-sm rounded-3xl shadow-2xl">
        <CardHeader className="text-center pb-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-ocean to-teal flex items-center justify-center p-2">
              <QuotesIcon size="sm" className="brightness-0 invert" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white font-inter">
            Complete Your Connection
          </CardTitle>
          <CardDescription className="text-slate-100 font-inter">
            {getInviterName()} invited you to connect on Deeper
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" className="text-white font-inter font-medium">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="bg-input border-border text-foreground focus:border-ocean rounded-2xl font-inter"
                  placeholder="Your first name"
                />
              </div>
              <div>
                <Label htmlFor="lastName" className="text-white font-inter font-medium">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="bg-input border-border text-foreground focus:border-ocean rounded-2xl font-inter"
                  placeholder="Your last name"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="inviteeEmail" className="text-white font-inter font-medium">Your Email Address</Label>
              <Input
                id="inviteeEmail"
                type="email"
                value={invitation.inviteeEmail || ''}
                readOnly
                disabled
                className="bg-muted border-border text-muted-foreground cursor-not-allowed rounded-2xl font-inter"
              />
              <div className="mt-2 p-3 bg-ocean/10 border border-ocean/20 rounded-lg">
                <p className="text-sm text-ocean font-inter font-medium">
                  ⚠️ Important: You must use this exact email address to sign up
                </p>
                <p className="text-xs text-slate-300 mt-1 font-inter">
                  This ensures you're connected with the right person. You can link your Google account after login for easier access.
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="relationshipType" className="text-white font-inter font-medium">Relationship Type</Label>
              <Input
                id="relationshipType"
                value={invitation.relationshipType || ''}
                readOnly
                className="bg-muted border-border text-muted-foreground cursor-not-allowed rounded-2xl font-inter"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-white font-inter font-medium">Create Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="bg-input border-border text-foreground focus:border-ocean rounded-2xl font-inter"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-white font-inter font-medium">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="bg-input border-border text-foreground focus:border-ocean rounded-2xl font-inter"
                placeholder="Confirm your password"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading || !firstName.trim() || !lastName.trim() || !password || !confirmPassword}
              className="w-full btn-ocean py-3 rounded-2xl font-inter font-medium"
            >
              {isLoading ? "Creating Connection..." : "Begin Deeper Connection"}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-card/30 rounded-2xl border border-border">
            <h4 className="text-sm font-medium text-white mb-2 font-inter">What happens next?</h4>
            <ul className="text-xs text-slate-300 space-y-1 font-inter">
              <li>• Your account will be created with the designated email address</li>
              <li>• A private connection will be established with {getInviterName()}</li>
              <li>• You'll be taken to your dashboard to start conversations immediately</li>
              <li>• {getInviterName()} will be notified of your acceptance</li>
              <li>• After login, you can link your Google account for easier sign-in</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}