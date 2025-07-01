import { SupportedCurrency } from '../i18n/config';

export type StorageProvider = 'aws' | 'cloudflare' | 'wasabi' | 'gridfs';

export interface StorageConfig {
  // Common fields
  provider: StorageProvider;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  
  // Provider-specific config
  config: {
    // AWS S3 / Wasabi
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
    bucket?: string;
    endpoint?: string;
    
    // Cloudflare R2
    accountId?: string;
    
    // GridFS (MongoDB)
    database?: string;
    
    // Common settings
    maxFileSize?: number;
    allowedMimeTypes?: string[];
    cdnUrl?: string;
    publicRead?: boolean;
  };
  
  // Operational settings
  settings: {
    uploadTimeout: number;
    retryAttempts: number;
    chunkSize: number;
    enableCompression: boolean;
    enableEncryption: boolean;
    enableVersioning: boolean;
    enableDeduplication: boolean;
    autoCleanup: boolean;
    cleanupDays: number;
  };
}

export interface StorageFile {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  hash: string;
  storageKey: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadOptions {
  filename: string;
  mimeType: string;
  size: number;
  metadata?: Record<string, any>;
  tags?: string[];
  isPublic?: boolean;
  encrypt?: boolean;
  compress?: boolean;
}

export interface UploadResult {
  storageKey: string;
  size: number;
  hash: string;
  url?: string;
  metadata: Record<string, any>;
}

export interface DownloadOptions {
  storageKey: string;
  range?: {
    start: number;
    end: number;
  };
}

export interface DownloadResult {
  stream: ReadableStream;
  size: number;
  mimeType: string;
  metadata: Record<string, any>;
}

export interface DeleteOptions {
  storageKey: string;
  permanent?: boolean;
}

export interface CopyOptions {
  fromKey: string;
  toKey: string;
  metadata?: Record<string, any>;
}

export interface StorageStats {
  totalFiles: number;
  totalSize: number;
  avgFileSize: number;
  lastUsed?: Date;
  errorCount: number;
  successRate: number;
  bandwidth: {
    upload: number;
    download: number;
    period: 'day' | 'week' | 'month';
  };
}

export interface StorageHealth {
  isHealthy: boolean;
  latency: number;
  lastCheck: Date;
  errors: string[];
  version?: string;
}

export interface StorageQuota {
  used: number;
  limit: number;
  available: number;
  percentage: number;
}

export interface StorageOperation {
  type: 'upload' | 'download' | 'delete' | 'copy' | 'move';
  storageKey: string;
  size: number;
  duration: number;
  success: boolean;
  error?: string;
  timestamp: Date;
}

export interface ChunkUploadOptions {
  chunkIndex: number;
  totalChunks: number;
  uploadId: string;
  data: Buffer;
}

export interface MultipartUpload {
  uploadId: string;
  storageKey: string;
  chunks: Array<{
    index: number;
    etag: string;
    size: number;
  }>;
}