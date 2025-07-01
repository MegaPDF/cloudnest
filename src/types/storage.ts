import { ObjectId } from "mongoose";
import { StorageProvider } from "./file";

export interface StorageConfig {
  id: ObjectId;
  provider: StorageProvider;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  config: StorageProviderConfig;
  settings: StorageSettings;
  stats: StorageStats;
  isHealthy: boolean;
  lastHealthCheck?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StorageProviderConfig {
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
  
  // Common
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  cdnUrl?: string;
  publicRead?: boolean;
}

export interface StorageSettings {
  uploadTimeout: number;
  retryAttempts: number;
  chunkSize: number;
  enableCompression: boolean;
  enableEncryption: boolean;
  enableVersioning: boolean;
  enableDeduplication: boolean;
  autoCleanup: boolean;
  cleanupDays: number;
}

export interface StorageStats {
  totalFiles: number;
  totalSize: number;
  avgFileSize: number;
  lastUsed?: Date;
  errorCount: number;
  successRate: number;
  bandwidth: StorageBandwidth;
}

export interface StorageBandwidth {
  upload: number;
  download: number;
  period: 'day' | 'week' | 'month';
}

export interface StorageQuota {
  used: number;
  limit: number;
  percentage: number;
  remaining: number;
}

export interface StorageOperation {
  type: 'upload' | 'download' | 'delete' | 'copy' | 'move';
  fileId: ObjectId;
  size: number;
  duration: number;
  success: boolean;
  error?: string;
  timestamp: Date;
}

export interface StorageHealth {
  provider: StorageProvider;
  isHealthy: boolean;
  latency: number;
  lastCheck: Date;
  errors: string[];
}

export interface StorageUsageByUser {
  userId: ObjectId;
  userName: string;
  used: number;
  limit: number;
  fileCount: number;
  lastActivity: Date;
}

export interface StorageAnalytics {
  totalStorage: number;
  storageByProvider: Record<StorageProvider, number>;
  storageByUser: StorageUsageByUser[];
  growthRate: number;
  predictions: {
    nextMonth: number;
    nextQuarter: number;
    fullCapacityDate?: Date;
  };
}