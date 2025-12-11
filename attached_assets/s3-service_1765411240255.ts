// S3 service for persistent audio file storage
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface S3Config {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private isConfigured: boolean = false;

  constructor() {
    // Initialize S3 client with environment variables
    const config = this.getConfig();
    
    if (config) {
      this.s3Client = new S3Client({
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
      this.bucketName = config.bucketName;
      this.isConfigured = true;
      console.log(`[S3] S3 service configured successfully - Region: ${config.region}, Bucket: ${config.bucketName}`);
    } else {
      console.warn('[S3] S3 not configured - falling back to local storage');
      this.isConfigured = false;
    }
  }

  private getConfig(): S3Config | null {
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const bucketName = process.env.AWS_S3_BUCKET;

    if (!region || !accessKeyId || !secretAccessKey || !bucketName) {
      return null;
    }

    return { region, accessKeyId, secretAccessKey, bucketName };
  }

  public isS3Configured(): boolean {
    return this.isConfigured;
  }

  /**
   * Upload audio file to S3 and return the public URL
   */
  async uploadAudioFile(
    buffer: Buffer, 
    fileName: string, 
    mimeType: string
  ): Promise<string> {
    if (!this.isConfigured) {
      throw new Error('S3 not configured');
    }

    const key = `audio/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000', // 1 year cache
      // Note: Removed ACL as bucket may not have ACL permissions enabled
      // Files will be publicly accessible via bucket policy instead
      Metadata: {
        'upload-source': 'deeper-voice-messages',
        'upload-timestamp': Date.now().toString()
      }
    });

    try {
      console.log(`[S3] Attempting upload to bucket: ${this.bucketName}, key: ${key}`);
      const result = await this.s3Client.send(command);
      console.log(`[S3] Upload command completed successfully, ETag: ${result.ETag}`);
      
      // Return the public URL for the uploaded file
      const publicUrl = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
      
      console.log(`[S3] Audio file uploaded successfully: ${fileName} -> ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      console.error('[S3] Upload failed with detailed error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'Unknown',
        code: (error as any)?.code,
        statusCode: (error as any)?.statusCode,
        region: process.env.AWS_REGION,
        bucket: this.bucketName,
        key: key
      });
      throw new Error(`Failed to upload audio file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a presigned URL for private file access (alternative to public URLs)
   */
  async getPresignedUrl(fileName: string, expiresIn: number = 3600): Promise<string> {
    if (!this.isConfigured) {
      throw new Error('S3 not configured');
    }

    const key = `audio/${fileName}`;

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      console.error('[S3] Failed to generate presigned URL:', error);
      throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test S3 connectivity by attempting a simple operation
   */
  async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    if (!this.isConfigured) {
      return { success: false, error: 'S3 not configured' };
    }

    try {
      // Test with a small upload operation
      const testKey = `test/connection-test-${Date.now()}.txt`;
      const testBuffer = Buffer.from('S3 connection test');
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: testKey,
        Body: testBuffer,
        ContentType: 'text/plain',
      });

      const result = await this.s3Client.send(command);
      console.log(`[S3] Connection test successful, ETag: ${result.ETag}`);
      
      // Clean up test file immediately
      try {
        await this.s3Client.send(new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: testKey,
        }));
      } catch (cleanupError) {
        console.warn(`[S3] Failed to clean up test file: ${cleanupError}`);
      }
      
      return { success: true };
    } catch (error) {
      console.error('[S3] Connection test failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          name: error instanceof Error ? error.name : 'Unknown',
          code: (error as any)?.code,
          statusCode: (error as any)?.statusCode,
          region: process.env.AWS_REGION,
          bucket: this.bucketName
        }
      };
    }
  }

  /**
   * Delete audio file from S3 (for cleanup)
   */
  async deleteAudioFile(fileName: string): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('S3 not configured');
    }

    const key = `audio/${fileName}`;

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
      console.log(`[S3] Audio file deleted successfully: ${fileName}`);
    } catch (error) {
      console.error('[S3] Delete failed:', error);
      throw new Error(`Failed to delete audio file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test S3 connectivity and permissions
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured) {
      return { 
        success: false, 
        message: 'S3 not configured - missing environment variables' 
      };
    }

    try {
      // Try to upload a small test file
      const testBuffer = Buffer.from('test-audio-connection');
      const testFileName = `test_${Date.now()}.txt`;
      
      await this.uploadAudioFile(testBuffer, testFileName, 'text/plain');
      
      // Clean up test file
      await this.deleteAudioFile(testFileName);
      
      return { 
        success: true, 
        message: 'S3 connection successful' 
      };
    } catch (error) {
      return { 
        success: false, 
        message: `S3 connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}

// Export singleton instance
export const s3Service = new S3Service();