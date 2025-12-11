import { storage } from "./storage";

export interface AnalyticsEvent {
  type: 'user_registered' | 'connection_created' | 'connection_accepted' | 'connection_declined' | 'message_sent' | 'conversation_started';
  userId?: string;
  email?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

export class AnalyticsService {
  private events: AnalyticsEvent[] = [];

  track(event: AnalyticsEvent) {
    this.events.push({
      ...event,
      timestamp: new Date()
    });
    
    // Log important events in development only
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Analytics: ${event.type}`, {
        email: event.email,
        metadata: event.metadata
      });
    }
  }

  async getDashboardMetrics() {
    try {
      return {
        users: {
          total: 0,
          withConnections: 0,
          engagementRate: 0
        },
        connections: {
          total: 0,
          pending: 0,
          accepted: 0,
          acceptanceRate: 0
        },
        conversations: {
          active: 0,
          total: 0
        },
        messages: {
          total: 0,
          thisWeek: 0,
          averagePerConversation: 0
        }
      };
    } catch (error) {
      console.error("Failed to get analytics metrics:", error);
      return null;
    }
  }

  async getRelationshipTypeDistribution() {
    try {
      return [
        { type: 'Friends', count: 0 },
        { type: 'Parent-Child', count: 0 },
        { type: 'Romantic Partners', count: 0 }
      ];
    } catch (error) {
      console.error("Failed to get relationship distribution:", error);
      return [];
    }
  }

  getRecentEvents(limit: number = 50): AnalyticsEvent[] {
    return this.events
      .slice(-limit)
      .reverse();
  }

  clearEvents() {
    this.events = [];
  }
}

export const analytics = new AnalyticsService();