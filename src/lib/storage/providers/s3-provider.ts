import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { BaseStorageProvider } from './base-provider';
import { 
  UploadOptions, 
  UploadResult, 
  DownloadOptions, 
  DownloadResult,
  DeleteOptions,
  CopyOptions,
  StorageHealth
} from '../types';
import { EncryptionUtils } from '@/lib/utils/encryption';

export class S3Provider extends BaseStorageProvider {
  private client: S3Client;
  private readonly bucket: string;

  constructor(config: any) {
    super(config);
    
    this.bucket = config.config.bucket;
    if (!this.bucket) {
      throw new Error('S3 bucket not configured');
    }

    this.client = new S3Client({
      region: config.config.region || 'us-east-1',
      credentials: {
        accessKeyId: config.config.accessKeyId,
        secretAccessKey: config.config.secretAccessKey
      },
      ...(config.config.endpoint && { endpoint: config.config.endpoint })
    });
  }

  async upload(data: Buffer, options: UploadOptions): Promise<UploadResult> {
    const startTime = Date.now();
    
    try {
      let processedData = data;
      let metadata = { ...options.metadata };

      // Compression
      if (this.config.settings.enableCompression) {
        processedData = await this.compressData(processedData);
        metadata.compressed = 'true';
      }

      // Encryption
      if (this.config.settings.enableEncryption && options.encrypt) {
        const password = process.env.ENCRYPTION_KEY || 'default-key';
        const encrypted = await this.encryptData(processedData, password);
        processedData = encrypted.encrypted;
        Object.assign(metadata, encrypted.metadata);
      }

      const storageKey = this.generateStorageKey(options.filename);
      const hash = EncryptionUtils.hashFile(data);

      // Add standard metadata
      metadata.originalName = options.filename;
      metadata.mimeType = options.mimeType;
      metadata.hash = hash;
      metadata.uploadedAt = new Date().toISOString();
      metadata.tags = JSON.stringify(options.tags || []);

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: processedData,
        ContentType: options.mimeType,
        ContentLength: processedData.length,
        Metadata: this.sanitizeMetadata(metadata),
        ...(options.isPublic && { ACL: 'public-read' })
      });

      await this.client.send(command);

      this.recordOperation({
        type: 'upload',
        storageKey,
        size: data.length,
        duration: Date.now() - startTime,
        success: true
      });

      const url = options.isPublic 
        ? `https://${this.bucket}.s3.amazonaws.com/${storageKey}`
        : undefined;

      return {
        storageKey,
        size: data.length,
        hash,
        url,
        metadata
      };

    } catch (error) {
      this.recordOperation({
        type: 'upload',
        storageKey: options.filename,
        size: data.length,
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message
      });
      throw error;
    }
  }

  async download(options: DownloadOptions): Promise<DownloadResult> {
    const startTime = Date.now();
    
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: options.storageKey,
        ...(options.range && {
          Range: `bytes=${options.range.start}-${options.range.end}`
        })
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('No file data received');
      }

      this.recordOperation({
        type: 'download',
        storageKey: options.storageKey,
        size: response.ContentLength || 0,
        duration: Date.now() - startTime,
        success: true
      });

      return {
        stream: response.Body as ReadableStream,
        size: response.ContentLength || 0,
        mimeType: response.ContentType || 'application/octet-stream',
        metadata: response.Metadata || {}
      };

    } catch (error) {
      this.recordOperation({
        type: 'download',
        storageKey: options.storageKey,
        size: 0,
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message
      });
      throw error;
    }
  }

  async delete(options: DeleteOptions): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Get file info for stats
      const info = await this.getFileInfo(options.storageKey);

      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: options.storageKey
      });

      await this.client.send(command);

      this.recordOperation({
        type: 'delete',
        storageKey: options.storageKey,
        size: info.size,
        duration: Date.now() - startTime,
        success: true
      });

    } catch (error) {
      this.recordOperation({
        type: 'delete',
        storageKey: options.storageKey,
        size: 0,
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message
      });
      throw error;
    }
  }

  async copy(options: CopyOptions): Promise<void> {
    const startTime = Date.now();
    
    try {
      const copySource = `${this.bucket}/${options.fromKey}`;
      
      const command = new CopyObjectCommand({
        Bucket: this.bucket,
        Key: options.toKey,
        CopySource: copySource,
        ...(options.metadata && {
          Metadata: this.sanitizeMetadata(options.metadata),
          MetadataDirective: 'REPLACE'
        })
      });

      await this.client.send(command);

      const info = await this.getFileInfo(options.toKey);

      this.recordOperation({
        type: 'copy',
        storageKey: options.fromKey,
        size: info.size,
        duration: Date.now() - startTime,
        success: true
      });

    } catch (error) {
      this.recordOperation({
        type: 'copy',
        storageKey: options.fromKey,
        size: 0,
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message
      });
      throw error;
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: storageKey
      });

      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async getFileInfo(storageKey: string): Promise<{ size: number; mimeType: string; metadata: Record<string, any> }> {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: storageKey
    });

    const response = await this.client.send(command);

    return {
      size: response.ContentLength || 0,
      mimeType: response.ContentType || 'application/octet-stream',
      metadata: response.Metadata || {}
    };
  }

  async testConnection(): Promise<StorageHealth> {
    try {
      // Test by listing bucket (lightweight operation)
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: 'health-check-test-file'
      });

      await this.client.send(command);
      
      return {
        isHealthy: true,
        latency: 0,
        lastCheck: new Date(),
        errors: []
      };
    } catch (error) {
      // Expected error for non-existent file is OK
      const err = error as any;
      if (err?.$metadata?.httpStatusCode === 404) {
        return {
          isHealthy: true,
          latency: 0,
          lastCheck: new Date(),
          errors: []
        };
      }

      return {
        isHealthy: false,
        latency: -1,
        lastCheck: new Date(),
        errors: [err.message]
      };
    }
  }

  private sanitizeMetadata(metadata: Record<string, any>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== null && value !== undefined) {
        sanitized[key] = String(value);
      }
    }
    
    return sanitized;
  }
}
