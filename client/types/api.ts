export interface Connection {
  id: number;
  inviterEmail: string;
  inviteeEmail: string;
  inviterRole: string | null;
  inviteeRole: string | null;
  relationshipType: string;
  personalMessage: string | null;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: number;
  connectionId: number;
  participant1Email: string;
  participant2Email: string;
  relationshipType: string;
  title: string | null;
  status: 'active' | 'archived';
  currentTurn: string;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: number;
  conversationId: number;
  senderEmail: string;
  content: string;
  type: 'question' | 'response';
  messageFormat: 'text' | 'voice';
  audioUrl: string | null;
  transcription: string | null;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  subscriptionTier: 'trial' | 'basic' | 'advanced' | 'unlimited';
  subscriptionStatus: 'active' | 'canceled' | 'expired';
  maxConnections: number;
  createdAt: string;
}

export const RELATIONSHIP_TYPES = [
  { value: 'Parent-Child', label: 'Parent-Child', roles: ['Parent', 'Child'] },
  { value: 'Romantic Partners', label: 'Romantic Partners', roles: ['Partner', 'Partner'] },
  { value: 'Friends', label: 'Friends', roles: ['Friend', 'Friend'] },
  { value: 'Siblings', label: 'Siblings', roles: ['Sibling', 'Sibling'] },
  { value: 'Colleagues', label: 'Colleagues', roles: ['Colleague', 'Colleague'] },
] as const;

export function getDisplayName(email: string, firstName?: string | null, lastName?: string | null): string {
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  if (firstName) {
    return firstName;
  }
  return email.split('@')[0];
}

export function getRelationshipDisplay(
  relationshipType: string,
  inviterRole: string | null,
  inviteeRole: string | null
): string {
  if (inviterRole && inviteeRole && inviterRole !== inviteeRole) {
    return `${inviterRole}/${inviteeRole}`;
  }
  return relationshipType;
}
