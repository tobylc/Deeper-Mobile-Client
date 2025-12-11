import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import DeeperLogo from "@/components/deeper-logo";
import NoAccountPopup from "@/components/no-account-popup";

export default function Auth() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showNoAccountPopup, setShowNoAccountPopup] = useState(false);
  const { toast } = useToast();

  // Check for invitation context from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const invitationId = urlParams.get('invitation');
  const isExistingUser = urlParams.get('existing') === 'true';

  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/dashboard");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);

    // Validate password confirmation for signup
    if (isSignUp && password !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Please make sure both passwords match.",
        variant: "destructive",
      });
      setIsLoggingIn(false);
      return;
    }

    try {
      const endpoint = isSignUp ? "/api/auth/signup" : "/api/auth/login";
      const payload = isSignUp 
        ? { email: email.trim(), password, firstName: firstName.trim(), lastName: lastName.trim() }
        : { email: email.trim(), password };

      console.log("[AUTH] Attempting login with:", { endpoint, email: email.trim(), isSignUp });
      
      // Use direct fetch instead of apiRequest to avoid automatic redirect on 401
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (response.ok) {
        const result = await response.json();
        
        // If logging in with invitation context, accept the invitation
        if (invitationId && isExistingUser && !isSignUp) {
          try {
            const acceptResponse = await apiRequest("POST", "/api/connections/accept-existing", {
              connectionId: invitationId
            });
            
            if (acceptResponse.ok) {
              toast({
                title: "Welcome back!",
                description: "Successfully logged in and accepted invitation.",
              });
            } else {
              toast({
                title: "Welcome back!",
                description: "Logged in successfully. Please check your dashboard for pending invitations.",
              });
            }
          } catch (error) {
            console.error("Error accepting invitation:", error);
            toast({
              title: "Welcome back!",
              description: "Logged in successfully. Please check your dashboard for pending invitations.",
            });
          }
        } else {
          toast({
            title: isSignUp ? "Welcome to Deeper!" : "Welcome back!",
            description: isSignUp ? "Your account has been created successfully." : "Successfully logged in to your account.",
          });
        }
        
        // Invalidate auth cache and redirect to dashboard
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        setTimeout(() => {
          setLocation("/dashboard");
        }, 1000);
      } else {
        const error = await response.json();
        console.log("[AUTH] Login failed:", { status: response.status, error, isSignUp });
        
        // Check if this is a login attempt (not signup) and the error is "user not found"
        if (!isSignUp && response.status === 401 && 
            (error.message === "Invalid email or password" || error.message === "User not found")) {
          // Show the "no account found" popup instead of a toast
          console.log("[AUTH] Showing no account popup for:", email);
          setShowNoAccountPopup(true);
          // Don't invalidate queries when showing the popup to prevent auth refetch
          setIsLoggingIn(false);
          return;
        } else {
          // Show normal error toast for other errors
          toast({
            title: isSignUp ? "Signup Failed" : "Login Failed",
            description: error.message || (isSignUp ? "Unable to create account." : "Invalid email or password."),
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error(isSignUp ? "Signup error:" : "Login error:", error);
      toast({
        title: "Connection Error",
        description: "Unable to connect. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleOAuthLogin = () => {
    // Clear any existing auth state before redirecting
    queryClient.clear();
    window.location.href = `/api/auth/google`;
  };


  const handleNoAccountPopupSignUp = () => {
    setShowNoAccountPopup(false);
    setIsSignUp(true);
    setConfirmPassword("");
  };

  const handleNoAccountPopupClose = () => {
    setShowNoAccountPopup(false);
    // Clear the password field to let user try a different email
    setPassword("");
    setConfirmPassword("");
  };

  const toggleSignUpMode = () => {
    setIsSignUp(!isSignUp);
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-50 glass-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <ArrowLeft className="w-5 h-5 text-white/80" />
              <DeeperLogo size="header" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Background Effects - matching landing page design */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-primary/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-secondary/20 rounded-full blur-3xl"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Auth Card - using design system classes */}
          <Card className="card-elevated rounded-3xl backdrop-blur-xl border-border/50 shadow-2xl">
            <CardHeader className="text-center">
              <div className="flex flex-col items-center gap-2 mb-2">
                <span className="text-lg text-muted-foreground font-inter">Welcome to</span>
                <DeeperLogo size="xl" />
              </div>
              <CardDescription className="text-muted-foreground font-inter">
                {showEmailLogin 
                  ? (isSignUp ? "Create your account with email and password" : "Sign in with your email and password") 
                  : "Sign in to start building deeper relationships"
                }
              </CardDescription>
              {showEmailLogin && !isSignUp && (
                <div className="text-center mt-2">
                  <button
                    type="button"
                    onClick={toggleSignUpMode}
                    className="text-sm font-inter font-bold glow-amber-blue"
                  >
                    Don't have an account? Sign up
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {showEmailLogin ? (
                // Email/Password Form for login or signup
                <form onSubmit={handleEmailAuth} className="space-y-4">
                  {isSignUp && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-foreground font-inter">First Name</Label>
                        <Input
                          id="firstName"
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="First name"
                          className="rounded-2xl bg-card border-border font-inter"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-foreground font-inter">Last Name</Label>
                        <Input
                          id="lastName"
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Last name"
                          className="rounded-2xl bg-card border-border font-inter"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground font-inter">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      className="rounded-2xl bg-card border-border font-inter"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-foreground font-inter">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        className="rounded-2xl bg-card border-border font-inter pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isSignUp && (
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-foreground font-inter">Confirm Password</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm your password"
                          required
                          className="rounded-2xl bg-card border-border font-inter pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoggingIn || !email.trim() || !password.trim() || (isSignUp && (!firstName.trim() || !lastName.trim() || !confirmPassword.trim()))}
                    className="w-full btn-ocean font-inter font-medium py-3 rounded-3xl transition-all duration-200"
                  >
                    {isLoggingIn ? (isSignUp ? "Creating Account..." : "Signing in...") : (isSignUp ? "Create Account" : "Sign In")}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={toggleSignUpMode}
                      className="text-sm text-primary hover:text-primary/80 font-inter font-bold"
                    >
                      {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                    </button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowEmailLogin(false);
                      setIsSignUp(false);
                      setEmail("");
                      setPassword("");
                      setFirstName("");
                      setLastName("");
                    }}
                    className="w-full text-sm text-muted-foreground hover:text-foreground font-inter"
                  >
                    ← Back to login options
                  </Button>
                </form>
              ) : (
                <>
                  {/* Google OAuth */}
                  <Button
                onClick={() => window.location.href = '/api/auth/google'}
                variant="outline"
                size="lg"
                className="w-full bg-card hover:bg-accent text-foreground border-border font-inter font-medium py-3 rounded-3xl transition-all duration-200 hover:shadow-md"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>



              {/* Email fallback */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <Button
                onClick={() => setShowEmailLogin(true)}
                variant="outline"
                size="lg"
                className="w-full bg-card hover:bg-accent text-foreground border-border font-inter font-medium py-3 rounded-3xl transition-all duration-200 hover:shadow-md"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                Continue with Email & Password
              </Button>

                  <p className="text-center text-xs text-muted-foreground font-inter">
                    Sign up or sign in with email
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* No Account Found Popup */}
      <NoAccountPopup
        isOpen={showNoAccountPopup}
        onClose={handleNoAccountPopupClose}
        onSignUp={handleNoAccountPopupSignUp}
        email={email}
      />
    </div>
  );
}