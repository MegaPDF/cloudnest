import { EventEmitter } from 'events';
import { 
  StorageConfig, 
  UploadOptions, 
  UploadResult, 
  DownloadOptions, 
  DownloadResult,
  DeleteOptions,
  CopyOptions,
  StorageStats,
  StorageHealth,
  StorageOperation,
  ChunkUploadOptions,
  MultipartUpload
} from '../types';
import { FileUtils } from '@/lib/utils/file-utils';
import { EncryptionUtils } from '@/lib/utils/encryption';

export abstract class BaseStorageProvider extends EventEmitter {
  protected config: StorageConfig;
  protected stats: StorageStats;
  protected operationHistory: StorageOperation[] = [];

  constructor(config: StorageConfig) {
    super();
    this.config = config;
    this.stats = {
      totalFiles: 0,
      totalSize: 0,
      avgFileSize: 0,
      errorCount: 0,
      successRate: 100,
      bandwidth: {
        upload: 0,
        download: 0,
        period: 'day'
      }
    };
  }

  // Abstract methods that must be implemented by providers
  abstract upload(data: Buffer, options: UploadOptions): Promise<UploadResult>;
  abstract download(options: DownloadOptions): Promise<DownloadResult>;
  abstract delete(options: DeleteOptions): Promise<void>;
  abstract copy(options: CopyOptions): Promise<void>;
  abstract exists(storageKey: string): Promise<boolean>;
  abstract getFileInfo(storageKey: string): Promise<{ size: number; mimeType: string; metadata: Record<string, any> }>;
  abstract testConnection(): Promise<StorageHealth>;

  // Optional methods for advanced features
  async move(fromKey: string, toKey: string): Promise<void> {
    await this.copy({ fromKey, toKey });
    await this.delete({ storageKey: fromKey, permanent: true });
  }

  async startMultipartUpload(storageKey: string, options: UploadOptions): Promise<string> {
    throw new Error('Multipart upload not supported by this provider');
  }

  async uploadChunk(options: ChunkUploadOptions): Promise<string> {
    throw new Error('Chunk upload not supported by this provider');
  }

  async completeMultipartUpload(uploadId: string, chunks: Array<{ index: number; etag: string }>): Promise<UploadResult> {
    throw new Error('Multipart upload completion not supported by this provider');
  }

  async abortMultipartUpload(uploadId: string): Promise<void> {
    throw new Error('Multipart upload abort not supported by this provider');
  }

  // Common utility methods
  protected generateStorageKey(filename: string, userId?: string): string {
    const sanitizedFilename = FileUtils.sanitizeFilename(filename);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    
    const key = `${timestamp}-${random}-${sanitizedFilename}`;
    return userId ? `${userId}/${key}` : key;
  }

  protected async encryptData(data: Buffer, password: string): Promise<{
    encrypted: Buffer;
    metadata: Record<string, any>;
  }> {
    const result = EncryptionUtils.encrypt(data, password);
    
    return {
      encrypted: Buffer.from(result.encrypted, 'hex'),
      metadata: {
        encrypted: true,
        salt: result.salt,
        iv: result.iv,
        tag: result.tag,
        algorithm: 'aes-256-gcm'
      }
    };
  }

  protected async decryptData(
    encryptedData: Buffer, 
    password: string, 
    metadata: Record<string, any>
  ): Promise<Buffer> {
    if (!metadata.encrypted) {
      return encryptedData;
    }

    const decrypted = EncryptionUtils.decrypt(
      encryptedData.toString('hex'),
      password,
      metadata.salt,
      metadata.iv,
      metadata.tag
    );

    return Buffer.from(decrypted, 'utf8');
  }

  protected async compressData(data: Buffer): Promise<Buffer> {
    const zlib = await import('zlib');
    return new Promise((resolve, reject) => {
      zlib.gzip(data, (err, compressed) => {
        if (err) reject(err);
        else resolve(compressed);
      });
    });
  }

  protected async decompressData(data: Buffer): Promise<Buffer> {
    const zlib = await import('zlib');
    return new Promise((resolve, reject) => {
      zlib.gunzip(data, (err, decompressed) => {
        if (err) reject(err);
        else resolve(decompressed);
      });
    });
  }

  protected recordOperation(operation: Omit<StorageOperation, 'timestamp'>): void {
    const op: StorageOperation = {
      ...operation,
      timestamp: new Date()
    };

    this.operationHistory.push(op);
    
    // Keep only last 1000 operations
    if (this.operationHistory.length > 1000) {
      this.operationHistory.shift();
    }

    // Update stats
    this.updateStats(op);
    
    // Emit event
    this.emit('operation', op);
  }

  protected updateStats(operation: StorageOperation): void {
    if (operation.success) {
      this.stats.totalFiles += operation.type === 'upload' ? 1 : 0;
      this.stats.totalSize += operation.type === 'upload' ? operation.size : 0;
      
      if (operation.type === 'upload') {
        this.stats.bandwidth.upload += operation.size;
      } else if (operation.type === 'download') {
        this.stats.bandwidth.download += operation.size;
      }
    } else {
      this.stats.errorCount += 1;
    }

    // Calculate success rate
    const totalOps = this.operationHistory.length;
    const successfulOps = this.operationHistory.filter(op => op.success).length;
    this.stats.successRate = totalOps > 0 ? (successfulOps / totalOps) * 100 : 100;

    // Calculate average file size
    const uploadOps = this.operationHistory.filter(op => op.type === 'upload' && op.success);
    if (uploadOps.length > 0) {
      const totalUploadSize = uploadOps.reduce((sum, op) => sum + op.size, 0);
      this.stats.avgFileSize = totalUploadSize / uploadOps.length;
    }

    this.stats.lastUsed = new Date();
  }

  // Public methods
  getStats(): StorageStats {
    return { ...this.stats };
  }

  getConfig(): StorageConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<StorageConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getOperationHistory(limit: number = 100): StorageOperation[] {
    return this.operationHistory.slice(-limit);
  }

  clearOperationHistory(): void {
    this.operationHistory = [];
  }

  // Health check with retry logic
  async healthCheck(retries: number = 3): Promise<StorageHealth> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < retries; i++) {
      try {
        const start = Date.now();
        const health = await this.testConnection();
        const latency = Date.now() - start;
        
        return {
          ...health,
          latency,
          lastCheck: new Date()
        };
      } catch (error) {
        lastError = error as Error;
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
      }
    }

    return {
      isHealthy: false,
      latency: -1,
      lastCheck: new Date(),
      errors: [lastError?.message || 'Unknown error']
    };
  }
}