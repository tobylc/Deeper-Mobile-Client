import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'url';

interface WebSocketClient {
  ws: WebSocket;
  userId: string;
  email: string;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients = new Map<string, WebSocketClient[]>();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      verifyClient: (info) => {
        // Basic verification - in production you'd validate auth tokens
        return true;
      }
    });

    this.wss.on('connection', (ws, request) => {
      const { query } = parse(request.url || '', true);
      const userEmail = query.email as string;
      const userId = query.userId as string;

      if (!userEmail || !userId) {
        ws.close(1008, 'Missing email or userId');
        return;
      }



      // Add client to tracking
      if (!this.clients.has(userEmail)) {
        this.clients.set(userEmail, []);
      }
      
      const client: WebSocketClient = { ws, userId, email: userEmail };
      this.clients.get(userEmail)!.push(client);

      // Handle client messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(client, message);
        } catch (error) {
          console.error('[WebSocket] Invalid message format:', error);
        }
      });

      // Handle disconnection
      ws.on('close', () => {

        this.removeClient(userEmail, client);
      });

      // Send initial connection confirmation
      this.sendToClient(client, {
        type: 'connection_confirmed',
        message: 'WebSocket connection established'
      });
    });
  }

  private handleClientMessage(client: WebSocketClient, message: any) {
    switch (message.type) {
      case 'ping':
        this.sendToClient(client, { type: 'pong' });
        break;
      case 'subscribe_dashboard':
        // Client wants to receive dashboard updates
        this.sendToClient(client, { 
          type: 'dashboard_subscribed',
          message: 'You will receive real-time dashboard updates'
        });
        break;
      default:

    }
  }

  private removeClient(email: string, clientToRemove: WebSocketClient) {
    const clients = this.clients.get(email);
    if (clients) {
      const index = clients.indexOf(clientToRemove);
      if (index > -1) {
        clients.splice(index, 1);
      }
      if (clients.length === 0) {
        this.clients.delete(email);
      }
    }
  }

  private sendToClient(client: WebSocketClient, data: any) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(data));
      } catch (error) {

      }
    }
  }

  // Public methods for sending notifications
  public notifyUser(email: string, data: any) {
    const clients = this.clients.get(email);
    if (clients) {
      clients.forEach(client => {
        this.sendToClient(client, data);
      });
    }
  }

  public notifyNewMessage(recipientEmail: string, messageData: {
    conversationId: number;
    senderEmail: string;
    senderName: string;
    messageType: string;
    relationshipType: string;
  }) {
    this.notifyUser(recipientEmail, {
      type: 'new_message',
      data: messageData,
      timestamp: new Date().toISOString()
    });
  }

  public notifyConnectionUpdate(email: string, connectionData: {
    connectionId: number;
    status: string;
    inviterEmail?: string;
    inviteeEmail?: string;
    relationshipType?: string;
  }) {
    this.notifyUser(email, {
      type: 'connection_update',
      data: connectionData,
      timestamp: new Date().toISOString()
    });
  }

  public notifyConversationUpdate(email: string, conversationData: {
    conversationId: number;
    connectionId?: number;
    action: string;
    relationshipType?: string;
    newTurn?: string; // Added for turn synchronization
  }) {
    console.log(`[WEBSOCKET] Sending conversation update to ${email}:`, JSON.stringify(conversationData));
    
    const clients = this.clients.get(email);
    if (clients && clients.length > 0) {
      console.log(`[WEBSOCKET] Found ${clients.length} client(s) for ${email}`);
      this.notifyUser(email, {
        type: 'conversation_update',
        data: conversationData,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`[WEBSOCKET] No connected clients found for ${email}`);
    }
  }

  public broadcast(data: any) {
    this.clients.forEach((clients) => {
      clients.forEach(client => {
        this.sendToClient(client, data);
      });
    });
  }

  public getConnectedUsers(): string[] {
    return Array.from(this.clients.keys());
  }

  public getConnectionCount(): number {
    let total = 0;
    this.clients.forEach(clients => {
      total += clients.length;
    });
    return total;
  }
}

// Global WebSocket manager instance
let wsManager: WebSocketManager | null = null;

export function initializeWebSocket(server: Server): WebSocketManager {
  if (!wsManager) {
    wsManager = new WebSocketManager(server);
    console.log('[WebSocket] Server initialized');
  }
  return wsManager;
}

export function getWebSocketManager(): WebSocketManager | null {
  return wsManager;
}