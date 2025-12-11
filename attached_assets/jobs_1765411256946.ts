import { emailService } from "./email";
import { storage } from "./storage";

export interface Job {
  id: string;
  type: 'send_email' | 'cleanup_expired_sessions' | 'generate_analytics';
  payload: any;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledFor: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startProcessing();
  }

  addJob(type: Job['type'], payload: any, delay: number = 0): string {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job: Job = {
      id,
      type,
      payload,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      scheduledFor: new Date(Date.now() + delay),
      status: 'pending'
    };

    this.jobs.set(id, job);
    if (process.env.NODE_ENV === 'development') {
      console.log(`📋 Job queued: ${type} (${id})`);
    }
    return id;
  }

  private startProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(() => {
      this.processJobs();
    }, 5000); // Process jobs every 5 seconds
  }

  private async processJobs() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    const now = new Date();

    try {
      this.jobs.forEach(async (job, id) => {
        if (job.status === 'pending' && job.scheduledFor <= now) {
          await this.processJob(job);
        }
      });

      // Clean up completed/failed jobs older than 1 hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      this.jobs.forEach((job, id) => {
        if ((job.status === 'completed' || job.status === 'failed') && job.createdAt < oneHourAgo) {
          this.jobs.delete(id);
        }
      });
    } catch (error) {
      console.error("Error processing jobs:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processJob(job: Job) {
    job.status = 'running';
    job.attempts++;

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 Processing job: ${job.type} (attempt ${job.attempts}/${job.maxAttempts})`);
    }

    try {
      switch (job.type) {
        case 'send_email':
          await this.processSendEmailJob(job);
          break;
        case 'cleanup_expired_sessions':
          await this.processCleanupJob(job);
          break;
        case 'generate_analytics':
          await this.processAnalyticsJob(job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      job.status = 'completed';
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Job completed: ${job.type} (${job.id})`);
      }
    } catch (error) {
      console.error(`❌ Job failed: ${job.type} (${job.id})`, error);
      
      if (job.attempts >= job.maxAttempts) {
        job.status = 'failed';
      } else {
        job.status = 'pending';
        job.scheduledFor = new Date(Date.now() + job.attempts * 30000); // Exponential backoff
      }
    }
  }

  private async processSendEmailJob(job: Job) {
    const { emailType, connection } = job.payload;
    
    switch (emailType) {
      case 'invitation':
        await emailService.sendConnectionInvitation(connection);
        break;
      case 'accepted':
        await emailService.sendConnectionAccepted(connection);
        break;
      case 'declined':
        await emailService.sendConnectionDeclined(connection);
        break;
      default:
        throw new Error(`Unknown email type: ${emailType}`);
    }
  }

  private async processCleanupJob(job: Job) {
    // Clean up old rate limit entries, expired sessions, etc.
    console.log("🧹 Running cleanup tasks");
    // Implementation would go here
  }

  private async processAnalyticsJob(job: Job) {
    // Generate and cache analytics data
    console.log("📊 Generating analytics");
    // Implementation would go here
  }

  getJobStats() {
    const stats = {
      total: this.jobs.size,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0
    };

    this.jobs.forEach((job) => {
      if (job.status === 'pending') stats.pending++;
      else if (job.status === 'running') stats.running++;
      else if (job.status === 'completed') stats.completed++;
      else if (job.status === 'failed') stats.failed++;
    });

    return stats;
  }

  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }
}

export const jobQueue = new JobQueue();