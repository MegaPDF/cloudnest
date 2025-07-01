import { StorageConfig, StorageProvider } from './types';
import { STORAGE_PROVIDERS } from '../utils/constants';

export const DEFAULT_STORAGE_CONFIG: Partial<StorageConfig> = {
  settings: {
    uploadTimeout: 30000, // 30 seconds
    retryAttempts: 3,
    chunkSize: 5 * 1024 * 1024, // 5MB
    enableCompression: false,
    enableEncryption: false,
    enableVersioning: true,
    enableDeduplication: true,
    autoCleanup: true,
    cleanupDays: 30
  }
};