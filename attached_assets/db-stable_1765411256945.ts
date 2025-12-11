import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// Connection management with aggressive rate limiting
let connectionInstance: any = null;
let isInitializing = false;
let lastQueryTime = 0;
const QUERY_DELAY = 3000; // 3 seconds between queries
const CONNECTION_RETRY_DELAY = 10000; // 10 seconds between connection attempts

async function getStableConnection() {
  if (connectionInstance) {
    return connectionInstance;
  }
  
  if (isInitializing) {
    // Wait for existing initialization
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return connectionInstance;
  }
  
  isInitializing = true;
  try {
    // Wait for connection retry delay
    await new Promise(resolve => setTimeout(resolve, CONNECTION_RETRY_DELAY));
    connectionInstance = neon(process.env.DATABASE_URL!);
    console.log('[DB-STABLE] New connection established');
    return connectionInstance;
  } finally {
    isInitializing = false;
  }
}

async function enforceRateLimit() {
  const timeSinceLastQuery = Date.now() - lastQueryTime;
  if (timeSinceLastQuery < QUERY_DELAY) {
    await new Promise(resolve => setTimeout(resolve, QUERY_DELAY - timeSinceLastQuery));
  }
  lastQueryTime = Date.now();
}

async function safeQuery<T>(queryFn: (sql: any) => Promise<T>, timeout: number = 2000): Promise<T | null> {
  try {
    await enforceRateLimit();
    const sql = await getStableConnection();
    
    // Add timeout wrapper
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Query timeout')), timeout)
    );
    
    return await Promise.race([queryFn(sql), timeoutPromise]);
  } catch (error: any) {
    console.error('[DB-STABLE] Query failed:', error.message);
    
    // Reset connection on failure
    if (error.message?.includes('Too many database connection attempts') || 
        error.message?.includes('Control plane request failed')) {
      connectionInstance = null;
      console.log('[DB-STABLE] Connection reset due to rate limiting');
    }
    
    return null;
  }
}

export const stableDb = {
  async healthCheck(): Promise<boolean> {
    const result = await safeQuery(async (sql) => {
      const rows = await sql`SELECT 1 as alive`;
      return rows[0]?.alive === 1;
    });
    return result === true;
  },

  async getUserByEmail(email: string) {
    return safeQuery(async (sql) => {
      const result = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
      return result[0] || null;
    });
  },

  async getUserById(id: string) {
    return safeQuery(async (sql) => {
      const result = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
      return result[0] || null;
    });
  }
};

console.log('[DB-STABLE] Stable database interface initialized');