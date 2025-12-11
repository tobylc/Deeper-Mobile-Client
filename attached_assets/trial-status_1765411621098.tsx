import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Crown, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import TrialExpirationPopup from "./trial-expiration-popup";
import { useState } from "react";
import type { Connection } from "@shared/schema";

interface TrialStatusData {
  isExpired: boolean;
  daysRemaining: number;
  subscriptionTier: string;
  subscriptionStatus: string;
}

export function TrialStatus() {
  const { user } = useAuth();
  const [showTrialExpiredPopup, setShowTrialExpiredPopup] = useState(false);
  
  const { data: trialStatus, isLoading, error } = useQuery<TrialStatusData>({
    queryKey: ['/api/trial-status'],
    refetchInterval: 60000, // Check every minute
    enabled: !!user,
    retry: false, // Don't retry on auth errors
    meta: {
      errorMessage: "Failed to load trial status"
    }
  });

  // Check if user was invited by someone else (is an invitee)
  const { data: connections = [] } = useQuery<Connection[]>({
    queryKey: [`/api/connections/${user?.email}`],
    enabled: !!user?.email,
  });

  const isInviteeUser = connections.some(c => c.inviteeEmail === user?.email);

  // Fallback to user data when API fails but user is authenticated
  if (isLoading && !error) {
    return (
      <div className="mt-4">
        <div className="flex items-center space-x-2 text-slate-600">
          <Clock className="w-4 h-4" />
          <span className="text-sm">Loading subscription status...</span>
        </div>
      </div>
    );
  }

  // Use user data as fallback when trial status API fails
  // Calculate trial period based on subscription tier
  const getTrialDays = (tier: string) => tier === 'basic' ? 60 : 7;
  const effectiveTrialStatus = trialStatus || {
    isExpired: user?.subscriptionStatus !== 'trialing' && user?.subscriptionTier === 'free',
    daysRemaining: user?.subscriptionStatus === 'trialing' ? getTrialDays(user?.subscriptionTier || 'basic') : 0,
    subscriptionTier: user?.subscriptionTier || 'free',
    subscriptionStatus: user?.subscriptionStatus || 'inactive'
  };

  if (!user) {
    return null;
  }

  // Calculate days remaining for trialing users using effective data
  const isDuringTrial = effectiveTrialStatus.subscriptionStatus === 'trialing';
  const isExpiredTrial = effectiveTrialStatus.subscriptionTier === 'free' && !isDuringTrial;
  const isPaidSubscription = effectiveTrialStatus.subscriptionTier && ['basic', 'advanced', 'unlimited'].includes(effectiveTrialStatus.subscriptionTier);

  if (isPaidSubscription) {
    return (
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-600">Current Plan</span>
          </div>
          <Badge className="bg-ocean text-white capitalize">
            {effectiveTrialStatus.subscriptionTier}
          </Badge>
        </div>
        {effectiveTrialStatus.subscriptionStatus === 'trialing' && effectiveTrialStatus.daysRemaining > 0 && (
          <div className="mt-2 text-xs text-slate-500">
            Trial ends in {effectiveTrialStatus.daysRemaining} {effectiveTrialStatus.daysRemaining === 1 ? 'day' : 'days'}
          </div>
        )}
      </div>
    );
  }

  if (isExpiredTrial || effectiveTrialStatus.isExpired) {
    // For invitee users, show free status without any upgrade options
    if (isInviteeUser) {
      return (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-600">Current Plan</span>
            </div>
            <Badge variant="secondary" className="bg-slate-200 text-slate-700">
              free forever
            </Badge>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            You have permanent access through your connection
          </div>
        </div>
      );
    }

    // For regular users, show trial expired
    return (
      <>
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-600">Current Plan</span>
            </div>
            <Badge variant="secondary" className="bg-slate-200 text-slate-700">
              free
            </Badge>
          </div>
          <div className="mt-2 flex items-center space-x-2 text-xs text-red-600">
            <AlertTriangle className="w-3 h-3" />
            <span>Trial expired</span>
          </div>
          <Button 
            size="sm" 
            className="mt-3 w-full bg-gradient-to-r from-ocean to-teal text-white hover:from-ocean/90 hover:to-teal/90"
            onClick={() => setShowTrialExpiredPopup(true)}
          >
            <Crown className="w-3 h-3 mr-1" />
            Upgrade Now
          </Button>
        </div>
        
        <TrialExpirationPopup 
          isOpen={showTrialExpiredPopup} 
          onClose={() => setShowTrialExpiredPopup(false)} 
        />
      </>
    );
  }

  // Free user during trial
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-600">Current Plan</span>
        </div>
        <Badge variant="secondary" className="bg-slate-200 text-slate-700">
          free
        </Badge>
      </div>
      {isDuringTrial && effectiveTrialStatus.daysRemaining > 0 && (
        <div className="mt-2 flex items-center space-x-2 text-xs text-amber-600">
          <Clock className="w-3 h-3" />
          <span>{effectiveTrialStatus.daysRemaining} {effectiveTrialStatus.daysRemaining === 1 ? 'day' : 'days'} left in trial</span>
        </div>
      )}
      <Link href="/pricing">
        <Button 
          size="sm" 
          variant="outline"
          className="mt-3 w-full border-ocean text-ocean hover:bg-ocean hover:text-white"
        >
          <Crown className="w-3 h-3 mr-1" />
          View Plans
        </Button>
      </Link>
    </div>
  );
}