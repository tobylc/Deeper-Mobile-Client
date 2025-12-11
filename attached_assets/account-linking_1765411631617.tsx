import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Link, Mail, Shield } from "lucide-react";

interface AccountStatus {
  hasPassword: boolean;
  hasGoogleLinked: boolean;
  email: string;
  firstName: string;
  lastName: string;
}

export default function AccountLinking() {
  const { toast } = useToast();
  const [isLinking, setIsLinking] = useState(false);

  const { data: accountStatus, isLoading, refetch } = useQuery<AccountStatus>({
    queryKey: ["/api/auth/account-status"],
    enabled: true,
  });

  const handleLinkGoogle = async () => {
    try {
      setIsLinking(true);
      // Redirect to Google OAuth endpoint with linking parameter
      window.location.href = '/api/auth/google?linking=true';
    } catch (error) {
      toast({
        title: "Linking Failed",
        description: "Unable to start Google account linking. Please try again.",
        variant: "destructive",
      });
      setIsLinking(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card/50 border-border backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!accountStatus) {
    return (
      <Card className="bg-card/50 border-border backdrop-blur-sm">
        <CardContent className="p-6">
          <p className="text-muted-foreground">Unable to load account information.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground font-inter">
          <Shield className="w-5 h-5 text-ocean" />
          Account Security
        </CardTitle>
        <CardDescription className="text-muted-foreground font-inter">
          Manage your login methods for easier and more secure access
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Account Info */}
        <div className="space-y-2">
          <h4 className="font-medium text-foreground font-inter">Current Account</h4>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="w-4 h-4" />
            <span>{accountStatus.email}</span>
          </div>
          {accountStatus.firstName && (
            <div className="text-sm text-muted-foreground">
              {accountStatus.firstName} {accountStatus.lastName}
            </div>
          )}
        </div>

        {/* Authentication Methods */}
        <div className="space-y-3">
          <h4 className="font-medium text-foreground font-inter">Login Methods</h4>
          
          {/* Email/Password */}
          <div className="flex items-center justify-between p-3 rounded-2xl border border-border bg-card/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber/20 flex items-center justify-center">
                <Mail className="w-4 h-4 text-amber" />
              </div>
              <div>
                <p className="font-medium text-foreground font-inter">Email & Password</p>
                <p className="text-xs text-muted-foreground">Sign in with your email and password</p>
              </div>
            </div>
            {accountStatus.hasPassword ? (
              <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground border-border">
                Not Set
              </Badge>
            )}
          </div>

          {/* Google OAuth */}
          <div className="flex items-center justify-between p-3 rounded-2xl border border-border bg-card/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-ocean/20 flex items-center justify-center">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium text-foreground font-inter">Google Account</p>
                <p className="text-xs text-muted-foreground">Quick sign-in with Google</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {accountStatus.hasGoogleLinked ? (
                <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Linked
                </Badge>
              ) : (
                <>
                  <Badge variant="outline" className="text-muted-foreground border-border">
                    Not Linked
                  </Badge>
                  <Button
                    onClick={handleLinkGoogle}
                    disabled={isLinking}
                    size="sm"
                    className="btn-ocean font-inter text-xs px-3 py-1 h-auto rounded-xl"
                  >
                    <Link className="w-3 h-3 mr-1" />
                    {isLinking ? "Linking..." : "Link"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Benefits of Account Linking */}
        {!accountStatus.hasGoogleLinked && (
          <div className="mt-4 p-3 rounded-2xl bg-ocean/10 border border-ocean/20">
            <h5 className="font-medium text-foreground font-inter mb-2">Benefits of Linking Google</h5>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Quick one-click sign-in</li>
              <li>• Access your account even if you forget your password</li>
              <li>• Enhanced security with Google's authentication</li>
              <li>• Seamless experience across devices</li>
            </ul>
          </div>
        )}

        {/* Success Message */}
        {accountStatus.hasPassword && accountStatus.hasGoogleLinked && (
          <div className="mt-4 p-3 rounded-2xl bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <p className="text-sm font-medium text-green-400 font-inter">
                Account Fully Secured
              </p>
            </div>
            <p className="text-xs text-green-300/80 mt-1">
              You can now sign in using either your email/password or Google account.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}