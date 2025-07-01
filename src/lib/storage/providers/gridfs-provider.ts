import { MongoClient, GridFSBucket, GridFSBucketReadStream } from 'mongodb';
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
import { Readable } from 'stream';
import { EncryptionUtils } from '@/lib/utils/encryption';

export class GridFSProvider extends BaseStorageProvider {
  private client: MongoClient | null = null;
  private bucket: GridFSBucket | null = null;
  private readonly bucketName: string;

  constructor(config: any) {
    super(config);
    this.bucketName = config.config.bucketName || 'files';
  }

  async connect(): Promise<void> {
    if (this.client) return;

    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MongoDB URI not configured');
    }

    this.client = new MongoClient(uri);
    await this.client.connect();
    
    const db = this.client.db(this.config.config.database || 'cloudnest');
    this.bucket = new GridFSBucket(db, { bucketName: this.bucketName });
  }

  async upload(data: Buffer, options: UploadOptions): Promise<UploadResult> {
    const startTime = Date.now();
    
    try {
      await this.connect();
      if (!this.bucket) throw new Error('GridFS bucket not initialized');

      let processedData = data;
      let metadata = { ...options.metadata };

      // Compression
      if (this.config.settings.enableCompression) {
        processedData = await this.compressData(processedData);
        metadata.compressed = true;
      }

      // Encryption
      if (this.config.settings.enableEncryption && options.encrypt) {
        const password = process.env.ENCRYPTION_KEY || 'default-key';
        const encrypted = await this.encryptData(processedData, password);
        processedData = encrypted.encrypted;
        metadata = { ...metadata, ...encrypted.metadata };
      }

      const storageKey = this.generateStorageKey(options.filename);
      const hash = EncryptionUtils.hashFile(data);

      // Check for deduplication
      if (this.config.settings.enableDeduplication) {
        const existing = await this.findByHash(hash);
        if (existing) {
          this.recordOperation({
            type: 'upload',
            storageKey,
            size: data.length,
            duration: Date.now() - startTime,
            success: true
          });

          return {
            storageKey: existing.filename,
            size: data.length,
            hash,
            metadata: existing.metadata
          };
        }
      }

      const uploadStream = this.bucket.openUploadStream(storageKey, {
        metadata: {
          ...metadata,
          originalName: options.filename,
          mimeType: options.mimeType,
          hash,
          uploadedAt: new Date(),
          tags: options.tags || []
        }
      });

      return new Promise((resolve, reject) => {
        const readable = new Readable();
        readable.push(processedData);
        readable.push(null);

        readable.pipe(uploadStream);

        uploadStream.on('finish', () => {
          this.recordOperation({
            type: 'upload',
            storageKey,
            size: data.length,
            duration: Date.now() - startTime,
            success: true
          });

          resolve({
            storageKey,
            size: data.length,
            hash,
            metadata: uploadStream.options.metadata || {}
          });
        });

        uploadStream.on('error', (error) => {
          this.recordOperation({
            type: 'upload',
            storageKey,
            size: data.length,
            duration: Date.now() - startTime,
            success: false,
            error: error.message
          });
          reject(error);
        });
      });

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
      await this.connect();
      if (!this.bucket) throw new Error('GridFS bucket not initialized');

      const file = await this.bucket.find({ filename: options.storageKey }).next();
      if (!file) {
        throw new Error('File not found');
      }

      const downloadStream = this.bucket.openDownloadStreamByName(options.storageKey, {
        start: options.range?.start,
        end: options.range?.end
      });

      // Convert GridFS stream to web ReadableStream
      const webStream = new ReadableStream({
        start(controller) {
          downloadStream.on('data', (chunk) => {
            controller.enqueue(new Uint8Array(chunk));
          });

          downloadStream.on('end', () => {
            controller.close();
          });

          downloadStream.on('error', (error) => {
            controller.error(error);
          });
        }
      });

      this.recordOperation({
        type: 'download',
        storageKey: options.storageKey,
        size: file.length,
        duration: Date.now() - startTime,
        success: true
      });

      return {
        stream: webStream,
        size: file.length,
        mimeType: file.metadata?.mimeType || 'application/octet-stream',
        metadata: file.metadata || {}
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
      await this.connect();
      if (!this.bucket) throw new Error('GridFS bucket not initialized');

      const file = await this.bucket.find({ filename: options.storageKey }).next();
      if (!file) {
        throw new Error('File not found');
      }

      await this.bucket.delete(file._id);

      this.recordOperation({
        type: 'delete',
        storageKey: options.storageKey,
        size: file.length,
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
      // Download source file
      const sourceData = await this.download({ storageKey: options.fromKey });
      
      // Read stream to buffer
      const chunks: Uint8Array[] = [];
      const reader = sourceData.stream.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const buffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
      
      // Upload to new location
      await this.upload(buffer, {
        filename: options.toKey,
        mimeType: sourceData.mimeType,
        size: buffer.length,
        metadata: options.metadata || sourceData.metadata
      });

      this.recordOperation({
        type: 'copy',
        storageKey: options.fromKey,
        size: buffer.length,
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
      await this.connect();
      if (!this.bucket) return false;

      const file = await this.bucket.find({ filename: storageKey }).next();
      return !!file;
    } catch {
      return false;
    }
  }

  async getFileInfo(storageKey: string): Promise<{ size: number; mimeType: string; metadata: Record<string, any> }> {
    await this.connect();
    if (!this.bucket) throw new Error('GridFS bucket not initialized');

    const file = await this.bucket.find({ filename: storageKey }).next();
    if (!file) throw new Error('File not found');

    return {
      size: file.length,
      mimeType: file.metadata?.mimeType || 'application/octet-stream',
      metadata: file.metadata || {}
    };
  }

  async testConnection(): Promise<StorageHealth> {
    try {
      await this.connect();
      if (!this.client) throw new Error('Not connected');
      
      await this.client.db().admin().ping();
      
      return {
        isHealthy: true,
        latency: 0,
        lastCheck: new Date(),
        errors: []
      };
    } catch (error) {
      return {
        isHealthy: false,
        latency: -1,
        lastCheck: new Date(),
        errors: [(error as Error).message]
      };
    }
  }

  private async findByHash(hash: string): Promise<any> {
    if (!this.bucket) return null;
    
    return this.bucket.find({ 'metadata.hash': hash }).next();
  }

  async cleanup(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.bucket = null;
    }
  }
}