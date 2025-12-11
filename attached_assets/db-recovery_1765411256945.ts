// Direct Neon connection with minimal overhead
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// Simple database operations with timeout protection
class DatabaseRecovery {
  private lastQueryTime = 0;
  private queryDelay = 500; // 500ms between queries

  private async enforceDelay() {
    const timeSinceLastQuery = Date.now() - this.lastQueryTime;
    if (timeSinceLastQuery < this.queryDelay) {
      await new Promise(resolve => setTimeout(resolve, this.queryDelay - timeSinceLastQuery));
    }
    this.lastQueryTime = Date.now();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.enforceDelay();
      const result = await sql`SELECT 1 as alive`;
      return result[0]?.alive === 1;
    } catch (error) {
      console.error('[DB-RECOVERY] Health check failed:', error);
      return false;
    }
  }

  async getUserByEmail(email: string) {
    try {
      await this.enforceDelay();
      const result = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
      return result[0] || null;
    } catch (error) {
      console.error('[DB-RECOVERY] getUserByEmail failed:', error);
      return null;
    }
  }

  async getUserById(id: string) {
    try {
      await this.enforceDelay();
      const result = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
      return result[0] || null;
    } catch (error) {
      console.error('[DB-RECOVERY] getUserById failed:', error);
      return null;
    }
  }
}

export const dbRecovery = new DatabaseRecovery();
console.log('[DB-RECOVERY] Database recovery system initialized');