import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Crown, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import TrialExpirationPopup from "./trial-expiration-popup";
import type { Connection } from "@shared/schema";

export function InviteeUpgradeBanner() {
  const { user } = useAuth();

  // Check if user was invited by someone else (is an invitee)
  const { data: connections = [] } = useQuery<Connection[]>({
    queryKey: [`/api/connections/${user?.email}`],
    enabled: !!user?.email,
  });

  const isInviteeUser = connections.some(c => c.inviteeEmail === user?.email);
  
  // Invitees should never see upgrade banners - they have permanent free access
  if (!isInviteeUser || !user) {
    return null;
  }

  // Return null for all invitee users - no upgrade prompts
  return null;
}