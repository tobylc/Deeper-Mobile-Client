import { storage } from "./storage";
import { db } from "./db";
import { finalDb } from "./db-final";

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  error?: string;
  details?: Record<string, any>;
}

export class HealthService {
  async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      // Use production-ready database connection with rate limiting
      const isHealthy = await finalDb.healthCheck();
      return {
        service: 'database',
        status: isHealthy ? 'healthy' : 'unhealthy',
        responseTime: Date.now() - start,
        details: { connectionType: 'direct_neon' }
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async checkStorage(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      // Test basic storage functionality
      const testUser = await storage.getUserByEmail('health-check@test.com');
      return {
        service: 'storage',
        status: 'healthy',
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        service: 'storage',
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getSystemHealth(): Promise<{
    status: 'healthy' | 'unhealthy' | 'degraded';
    checks: HealthCheck[];
    timestamp: string;
    uptime: number;
  }> {
    const checks: HealthCheck[] = [];
    
    // Run all health checks
    checks.push(await this.checkDatabase());
    checks.push(await this.checkStorage());
    
    // Add memory usage check
    const memUsage = process.memoryUsage();
    checks.push({
      service: 'memory',
      status: memUsage.heapUsed < 500 * 1024 * 1024 ? 'healthy' : 'degraded', // 500MB threshold
      details: {
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
      }
    });

    // Determine overall status
    const hasUnhealthy = checks.some(check => check.status === 'unhealthy');
    const hasDegraded = checks.some(check => check.status === 'degraded');
    
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (hasUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (hasDegraded) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  }
}

export const healthService = new HealthService();