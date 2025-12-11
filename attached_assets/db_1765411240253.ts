import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Create Neon HTTP client for raw SQL queries
const sql = neon(process.env.DATABASE_URL);

// Create Drizzle ORM instance with schema for type-safe queries
export const db = drizzle(sql, { schema });

// Export raw sql client for direct queries if needed
export { sql };

// Simple query execution with basic error handling (backward compatibility)
export async function executeQuery<T>(
  queryFn: (sql: any) => Promise<T>
): Promise<T | null> {
  try {
    return await queryFn(sql);
  } catch (error: any) {
    console.error('[DB] Query failed:', error.message);
    return null;
  }
}

// Legacy helper functions for backward compatibility with routes.ts and other modules
export async function getUserByEmail(email: string) {
  return executeQuery(async (sql) => {
    const result = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
    return result[0] || null;
  });
}

export async function getUserById(id: string) {
  return executeQuery(async (sql) => {
    const result = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
    return result[0] || null;
  });
}

// Attach helper methods to db object for backward compatibility
(db as any).getUserByEmail = getUserByEmail;
(db as any).getUserById = getUserById;
(db as any).healthCheck = async () => {
  return executeQuery(async (sql) => {
    const result = await sql`SELECT 1 as alive`;
    return result[0]?.alive === 1;
  });
};

// Health check function for production monitoring
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await sql`SELECT 1 as alive`;
    return result[0]?.alive === 1;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// No-op graceful shutdown for compatibility (Neon HTTP is stateless)
export async function closeDatabaseConnection(): Promise<void> {
  console.log('Database connections closed gracefully');
}
