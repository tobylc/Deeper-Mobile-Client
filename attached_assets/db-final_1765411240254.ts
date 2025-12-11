import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// Global connection state management
let connectionState = {
  instance: null as any,
  lastUse: 0,
  isConnecting: false,
  cooldownUntil: 0
};

const CONFIG = {
  QUERY_DELAY: 5000,     // 5 seconds between queries
  COOLDOWN_PERIOD: 15000, // 15 seconds cooldown after errors
  MAX_RETRIES: 1,        // Single retry only
  TIMEOUT: 3000          // 3 second timeout
};

async function getConnection(): Promise<any> {
  const now = Date.now();
  
  // Check if we're in cooldown period
  if (now < connectionState.cooldownUntil) {
    const waitTime = connectionState.cooldownUntil - now;
    console.log(`[DB-FINAL] In cooldown, waiting ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  // Reuse existing connection if available
  if (connectionState.instance && (now - connectionState.lastUse) < 30000) {
    return connectionState.instance;
  }
  
  // Prevent concurrent connection attempts
  if (connectionState.isConnecting) {
    while (connectionState.isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return connectionState.instance;
  }
  
  connectionState.isConnecting = true;
  try {
    console.log('[DB-FINAL] Creating new connection');
    connectionState.instance = neon(process.env.DATABASE_URL!);
    connectionState.lastUse = now;
    return connectionState.instance;
  } finally {
    connectionState.isConnecting = false;
  }
}

async function executeWithRetry<T>(operation: (sql: any) => Promise<T>): Promise<T | null> {
  const startTime = Date.now();
  
  // Enforce minimum delay between queries
  const timeSinceLastQuery = startTime - connectionState.lastUse;
  if (timeSinceLastQuery < CONFIG.QUERY_DELAY) {
    const waitTime = CONFIG.QUERY_DELAY - timeSinceLastQuery;
    console.log(`[DB-FINAL] Rate limiting: waiting ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  for (let attempt = 0; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      const sql = await getConnection();
      
      // Add timeout protection
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), CONFIG.TIMEOUT)
      );
      
      const result = await Promise.race([operation(sql), timeoutPromise]);
      connectionState.lastUse = Date.now();
      
      console.log(`[DB-FINAL] Query successful (${Date.now() - startTime}ms)`);
      return result;
      
    } catch (error: any) {
      const isRateLimit = error.message?.includes('Too many database connection attempts') ||
                         error.message?.includes('Control plane request failed');
      
      console.error(`[DB-FINAL] Attempt ${attempt + 1} failed:`, error.message);
      
      if (isRateLimit) {
        // Reset connection and enter cooldown
        connectionState.instance = null;
        connectionState.cooldownUntil = Date.now() + CONFIG.COOLDOWN_PERIOD;
        
        if (attempt < CONFIG.MAX_RETRIES) {
          console.log(`[DB-FINAL] Rate limited, retrying after cooldown`);
          continue;
        }
      }
      
      // Log error and return null for graceful degradation
      console.error(`[DB-FINAL] Query failed after ${attempt + 1} attempts`);
      return null;
    }
  }
  
  return null;
}

export const finalDb = {
  async healthCheck(): Promise<boolean> {
    const result = await executeWithRetry(async (sql) => {
      const rows = await sql`SELECT 1 as alive`;
      return rows[0]?.alive === 1;
    });
    return result === true;
  },

  async getUserByEmail(email: string): Promise<any> {
    return executeWithRetry(async (sql) => {
      const result = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
      return result[0] || null;
    });
  },

  async getUserById(id: string): Promise<any> {
    return executeWithRetry(async (sql) => {
      const result = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
      return result[0] || null;
    });
  }
};

console.log('[DB-FINAL] Production-ready database interface initialized');