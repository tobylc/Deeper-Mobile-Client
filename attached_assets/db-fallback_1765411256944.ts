import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "../shared/schema";

// Fallback database with minimal connection pool
let fallbackPool: Pool | null = null;
let fallbackDb: any = null;

export function initializeFallback() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }

  // Ultra-minimal pool configuration
  fallbackPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    min: 0,
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 500,
  });

  fallbackDb = drizzle({ client: fallbackPool, schema });
  
  // Minimal error handling
  fallbackPool.on('error', (err) => {
    console.error('[FALLBACK] Pool error:', err.message);
  });

  console.log('[FALLBACK] Database fallback initialized');
  return fallbackDb;
}

export async function testFallbackConnection(): Promise<boolean> {
  try {
    if (!fallbackDb) {
      initializeFallback();
    }
    
    const result = await fallbackDb.execute('SELECT 1 as test');
    return true;
  } catch (error) {
    console.error('[FALLBACK] Connection test failed:', error);
    return false;
  }
}

export function getFallbackDb() {
  if (!fallbackDb) {
    initializeFallback();
  }
  return fallbackDb;
}

export async function closeFallback() {
  if (fallbackPool) {
    await fallbackPool.end();
    fallbackPool = null;
    fallbackDb = null;
  }
}