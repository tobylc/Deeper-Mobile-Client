import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Features from "@/pages/features";
import Pricing from "@/pages/pricing";
import Dashboard from "@/pages/dashboard";
import Conversation from "@/pages/conversation";
import Auth from "@/pages/auth";
import InvitationLanding from "@/pages/invitation";
import InvitationSignup from "@/pages/invitation-signup";
import Checkout from "@/pages/checkout";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";
import { PrivacyPolicy } from "@/pages/privacy-policy";
import { SmsOptInPolicyPage } from "@/pages/sms-opt-in-policy";
import { Component, ReactNode, useEffect } from "react";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error boundary caught an error:', error, errorInfo);
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-radial from-slate-900 via-slate-800 to-slate-900">
          <div className="text-center p-8">
            <h2 className="text-xl text-white mb-4">Something went wrong</h2>
            <button
              className="px-4 py-2 bg-ocean text-white rounded-lg hover:bg-blue-600"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Check if this is a Stripe redirect
  const urlParams = new URLSearchParams(window.location.search);
  const isStripeRedirect = urlParams.get('payment_success') === 'true';

  // Enhanced global error handler for unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Enhanced logging for debugging
      console.error('Global unhandled rejection:', event.reason);
      console.error('Error type:', typeof event.reason);
      console.error('Error message:', event.reason?.message);
      console.error('Error stack:', event.reason?.stack);
      console.error('Promise:', event.promise);
      
      // Prevent ALL unhandled rejections from triggering error boundary
      event.preventDefault();
      return false;
    };

    const handleError = (event: ErrorEvent) => {
      console.error('Global JavaScript error:', event.error);
      console.error('Error message:', event.message);
      console.error('Error filename:', event.filename);
      console.error('Error line:', event.lineno);
      
      // Prevent some errors from bubbling up
      const nonCriticalErrors = [
        'voice message', 'transcription', 'audio', 'network', 
        'fetch', 'AbortError', 'NotAllowedError', 'filter is not a function'
      ];
      
      const errorMessage = event.message || event.error?.message || '';
      if (nonCriticalErrors.some(err => String(errorMessage).toLowerCase().includes(err))) {
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  // Show loading state with automatic timeout
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-radial from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-ocean to-teal flex items-center justify-center p-3 mx-auto mb-4">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-300">
            {isStripeRedirect ? 'Processing payment...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Invitation and auth routes are always accessible */}
      <Route path="/invitation-signup" component={InvitationSignup} />
      <Route path="/invitation/signup" component={InvitationSignup} />
      <Route path="/invitation/:params*" component={InvitationLanding} />
      <Route path="/invitation" component={InvitationLanding} />
      <Route path="/auth" component={Auth} />
      
      <Route path="/checkout/:tier" component={Checkout} />
      
      {/* Special handling for Stripe redirects - always show dashboard for payment success */}
      {isStripeRedirect && window.location.pathname === '/dashboard' ? (
        <Route path="/dashboard" component={Dashboard} />
      ) : !isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/features" component={Features} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/privacy-policy" component={PrivacyPolicy} />
          <Route path="/sms-opt-in-policy" component={SmsOptInPolicyPage} />
          <Route component={NotFound} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/conversation/:id" component={Conversation} />
          <Route path="/admin" component={Admin} />
          <Route path="/features" component={Features} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/privacy-policy" component={PrivacyPolicy} />
          <Route path="/sms-opt-in-policy" component={SmsOptInPolicyPage} />
          <Route component={NotFound} />
        </>
      )}
    </Switch>
  );
}

function GlobalErrorHandler() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.warn('Unhandled promise rejection:', event.reason);
      event.preventDefault(); // Prevent the default browser behavior
    };

    const handleError = (event: ErrorEvent) => {
      console.warn('Global error:', event.error);
      event.preventDefault();
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <GlobalErrorHandler />
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
