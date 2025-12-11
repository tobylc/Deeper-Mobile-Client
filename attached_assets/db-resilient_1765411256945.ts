import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// Connection queue with exponential backoff for Neon stability
class DatabaseQueue {
  private queue: Array<{ operation: () => Promise<any>, resolve: Function, reject: Function }> = [];
  private isProcessing = false;
  private backoffDelay = 1000; // Start with 1 second
  private maxBackoff = 10000; // Max 10 seconds
  private lastFailure = 0;

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ operation, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const { operation, resolve, reject } = this.queue.shift()!;
      
      try {
        // Apply backoff if recent failures
        const timeSinceFailure = Date.now() - this.lastFailure;
        if (timeSinceFailure < this.backoffDelay) {
          await new Promise(r => setTimeout(r, this.backoffDelay - timeSinceFailure));
        }
        
        const result = await operation();
        this.backoffDelay = 1000; // Reset on success
        resolve(result);
        
        // Small delay between operations
        await new Promise(r => setTimeout(r, 100));
        
      } catch (error) {
        this.lastFailure = Date.now();
        this.backoffDelay = Math.min(this.backoffDelay * 2, this.maxBackoff);
        console.error('[DB-QUEUE] Operation failed, backoff increased to', this.backoffDelay);
        reject(error);
      }
    }
    
    this.isProcessing = false;
  }
}

const dbQueue = new DatabaseQueue();
const sql = neon(process.env.DATABASE_URL);

// Resilient query execution with queue and retry
export async function executeResilientQuery<T>(
  queryFn: (sql: any) => Promise<T>,
  maxRetries: number = 2
): Promise<T> {
  return dbQueue.execute(async () => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await queryFn(sql);
      } catch (error: any) {
        lastError = error;
        
        if (attempt < maxRetries && 
            (error.message?.includes('Control plane') || 
             error.message?.includes('connection') || 
             error.message?.includes('permit'))) {
          
          await new Promise(r => setTimeout(r, attempt * 500));
          continue;
        }
        break;
      }
    }
    
    throw lastError;
  });
}

// Production-ready database operations
export const resilientDb = {
  async getUserByEmail(email: string) {
    return executeResilientQuery(async (sql) => {
      const result = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
      return result[0] || null;
    });
  },

  async getUserById(id: string) {
    return executeResilientQuery(async (sql) => {
      const result = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
      return result[0] || null;
    });
  },

  async healthCheck() {
    return executeResilientQuery(async (sql) => {
      const result = await sql`SELECT 1 as alive`;
      return result[0]?.alive === 1;
    }, 1); // Single attempt for health checks
  },

  async createUser(userData: any) {
    return executeResilientQuery(async (sql) => {
      const { id, email, firstName, lastName, profileImageUrl, googleId } = userData;
      const result = await sql`
        INSERT INTO users (id, email, first_name, last_name, profile_image_url, google_id, subscription_tier, subscription_status, max_connections)
        VALUES (${id}, ${email}, ${firstName}, ${lastName}, ${profileImageUrl}, ${googleId}, 'free', 'active', 1)
        RETURNING *
      `;
      return result[0];
    });
  },

  async getConnectionsByEmail(email: string) {
    return executeResilientQuery(async (sql) => {
      return await sql`
        SELECT * FROM connections 
        WHERE inviter_email = ${email} OR invitee_email = ${email}
        ORDER BY created_at DESC
      `;
    });
  }
};

console.log('[DB-RESILIENT] Database resilience layer initialized');