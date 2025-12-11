import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Lock, Users, MessageCircle, Infinity } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SubscriptionEnforcementProps {
  isOpen: boolean;
  onClose: () => void;
  action: string; // "invite", "create_conversation", etc.
}

interface TrialStatusData {
  isExpired: boolean;
  daysRemaining: number;
  subscriptionTier: string;
  subscriptionStatus: string;
  maxConnections: number;
  currentConnections: number;
}

export function SubscriptionEnforcement({ isOpen, onClose, action }: SubscriptionEnforcementProps) {
  const { data: trialStatus } = useQuery<TrialStatusData>({
    queryKey: ['/api/trial-status'],
  });

  if (!trialStatus) return null;

  const getActionMessage = () => {
    switch (action) {
      case "invite":
        if (trialStatus.isExpired) {
          return "Your free trial has expired. Choose a subscription plan to send invitations and continue your conversations.";
        }
        if (trialStatus.currentConnections >= trialStatus.maxConnections) {
          return `You've reached your ${trialStatus.subscriptionTier} plan limit of ${trialStatus.maxConnections} connection${trialStatus.maxConnections === 1 ? '' : 's'}. Upgrade to invite more people.`;
        }
        return "You need a subscription to send invitations.";
      case "create_conversation":
        return trialStatus.isExpired 
          ? "Your free trial has expired. Choose a subscription plan to start new conversations."
          : "You need a subscription to create conversations.";
      default:
        return trialStatus.isExpired 
          ? "Your free trial has expired. Choose a subscription plan to continue using Deeper."
          : "This feature requires a subscription.";
    }
  };

  const getRecommendedPlan = () => {
    if (trialStatus.currentConnections <= 1) return "basic";
    if (trialStatus.currentConnections <= 3) return "advanced";
    return "unlimited";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Lock className="w-5 h-5 text-amber-600" />
            <span>Subscription Required</span>
          </DialogTitle>
          <DialogDescription>
            {getActionMessage()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Status */}
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-amber-800 dark:text-amber-200">
                    {trialStatus.isExpired ? "Trial Expired" : "Free Trial"}
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {trialStatus.isExpired 
                      ? "Your 60-day trial has ended"
                      : `${trialStatus.daysRemaining} days remaining`
                    }
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {trialStatus.currentConnections} / {trialStatus.maxConnections} connections used
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Plans */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Basic Plan */}
            <Card className={`border-2 ${getRecommendedPlan() === 'basic' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`}>
              <CardHeader className="text-center pb-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <CardTitle className="text-lg">Basic</CardTitle>
                <div className="text-2xl font-bold text-foreground">$4.95</div>
                <p className="text-xs text-muted-foreground">per month</p>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-1 text-xs">
                  <li>• 1 connection</li>
                  <li>• Unlimited messages</li>
                  <li>• All features</li>
                  <li>• 60-day free trial</li>
                </ul>
                <Link href="/checkout/basic">
                  <Button className="w-full mt-3 btn-ocean flex flex-col gap-1 h-auto py-3" onClick={onClose}>
                    <span className="text-xs font-semibold">60 Day Free Trial</span>
                    <span className="text-xs font-normal opacity-90">No Credit Card Required</span>
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Advanced Plan */}
            <Card className={`border-2 ${getRecommendedPlan() === 'advanced' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`}>
              <CardHeader className="text-center pb-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <MessageCircle className="w-4 h-4 text-blue-600" />
                </div>
                <CardTitle className="text-lg">Advanced</CardTitle>
                <div className="text-2xl font-bold text-foreground">$9.95</div>
                <p className="text-xs text-muted-foreground">per month</p>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-1 text-xs">
                  <li>• 3 connections</li>
                  <li>• Unlimited messages</li>
                  <li>• All features</li>
                  <li>• 7-day free trial</li>
                </ul>
                <Link href="/checkout/advanced">
                  <Button className="w-full mt-3 btn-ocean text-xs py-2" onClick={onClose}>
                    Choose Advanced
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Unlimited Plan */}
            <Card className={`border-2 ${getRecommendedPlan() === 'unlimited' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`}>
              <CardHeader className="text-center pb-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Infinity className="w-4 h-4 text-blue-600" />
                </div>
                <CardTitle className="text-lg">Unlimited</CardTitle>
                <div className="text-2xl font-bold text-foreground">$19.95</div>
                <p className="text-xs text-muted-foreground">per month</p>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-1 text-xs">
                  <li>• Unlimited connections</li>
                  <li>• Unlimited messages</li>
                  <li>• All features</li>
                  <li>• 7-day free trial</li>
                </ul>
                <Link href="/checkout/unlimited">
                  <Button className="w-full mt-3 btn-ocean text-xs py-2" onClick={onClose}>
                    Choose Unlimited
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center">
            <Button variant="outline" onClick={onClose}>
              Maybe Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}