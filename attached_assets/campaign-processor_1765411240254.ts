import { emailCampaignService } from "./email-campaigns";

/**
 * Background processor for email campaigns
 * This will be called periodically to process and send scheduled campaigns
 */
export class CampaignProcessor {
  private isProcessing = false;
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Start the campaign processor to run every 15 minutes
   */
  start(): void {
    if (this.intervalId) {
      console.log('[CAMPAIGN-PROCESSOR] Already running');
      return;
    }

    console.log('[CAMPAIGN-PROCESSOR] Starting email campaign processor');
    
    // Process immediately on start
    this.processCampaigns();
    
    // Then process every 15 minutes
    this.intervalId = setInterval(() => {
      this.processCampaigns();
    }, 15 * 60 * 1000); // 15 minutes
  }

  /**
   * Stop the campaign processor
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[CAMPAIGN-PROCESSOR] Stopped email campaign processor');
    }
  }

  /**
   * Process pending campaigns
   */
  private async processCampaigns(): Promise<void> {
    if (this.isProcessing) {
      console.log('[CAMPAIGN-PROCESSOR] Already processing campaigns, skipping...');
      return;
    }

    this.isProcessing = true;
    
    try {
      console.log('[CAMPAIGN-PROCESSOR] Processing pending email campaigns...');
      await emailCampaignService.processPendingCampaigns();
      console.log('[CAMPAIGN-PROCESSOR] Completed processing email campaigns');
    } catch (error) {
      console.error('[CAMPAIGN-PROCESSOR] Error processing campaigns:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Manually trigger campaign processing (for testing or immediate processing)
   */
  async processNow(): Promise<void> {
    await this.processCampaigns();
  }
}

export const campaignProcessor = new CampaignProcessor();