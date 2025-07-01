
import { StorageProvider, StorageConfig, UploadOptions } from './types';
import { FileUtils } from '../utils/file-utils';
import { ValidationUtils } from '../utils/validation-utils';
import { STORAGE_PROVIDERS, FILE_LIMITS } from '../utils/constants';

export class StorageUtils {
  /**
   * Validate upload options
   */
  static validateUploadOptions(options: UploadOptions): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate filename
    const filenameValidation = ValidationUtils.validateFilename(options.filename);
    if (!filenameValidation.isValid) {
      errors.push(filenameValidation.error!);
    }

    // Validate file size
    const sizeValidation = ValidationUtils.validateFileSize(options.size);
    if (!sizeValidation.isValid) {
      errors.push(sizeValidation.error!);
    }

    // Validate MIME type
    if (!options.mimeType) {
      errors.push('MIME type is required');
    }

    // Validate tags
    if (options.tags && options.tags.length > 10) {
      errors.push('Maximum 10 tags allowed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate storage usage for a provider
   */
  static calculateStorageUsage(files: Array<{ size: number }>): {
    totalSize: number;
    totalFiles: number;
    averageSize: number;
  } {
    const totalFiles = files.length;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const averageSize = totalFiles > 0 ? totalSize / totalFiles : 0;

    return {
      totalFiles,
      totalSize,
      averageSize
    };
  }

  /**
   * Generate storage path based on date and user
   */
  static generateStoragePath(userId: string, filename: string, provider: StorageProvider): string {
    const sanitizedFilename = FileUtils.sanitizeFilename(filename);
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${provider}/${userId}/${year}/${month}/${day}/${Date.now()}-${sanitizedFilename}`;
  }

  /**
   * Determine optimal chunk size for upload
   */
  static getOptimalChunkSize(fileSize: number, provider: StorageProvider): number {
    const baseChunkSize = 5 * 1024 * 1024; // 5MB

    // GridFS works better with smaller chunks
    if (provider === STORAGE_PROVIDERS.GRIDFS) {
      return Math.min(baseChunkSize, 1 * 1024 * 1024); // 1MB max
    }

    // S3-compatible providers can handle larger chunks for big files
    if (fileSize > 100 * 1024 * 1024) { // > 100MB
      return 10 * 1024 * 1024; // 10MB chunks
    }

    return baseChunkSize;
  }

  /**
   * Check if file should be compressed
   */
  static shouldCompress(filename: string, size: number): boolean {
    const extension = FileUtils.getExtension(filename);
    const category = FileUtils.getFileCategory(filename);

    // Don't compress already compressed formats
    const compressedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.mp3', '.mp4', '.zip', '.rar', '.7z'];
    if (compressedFormats.includes(extension)) {
      return false;
    }

    // Don't compress small files (compression overhead not worth it)
    if (size < 1024) { // < 1KB
      return false;
    }

    // Compress text files and documents
    return ['text', 'pdf', 'other'].includes(category);
  }

  /**
   * Estimate compression ratio
   */
  static estimateCompressionRatio(filename: string): number {
    const category = FileUtils.getFileCategory(filename);
    
    const ratios: Record<string, number> = {
      text: 0.3,      // Text compresses very well
      pdf: 0.8,       // PDFs already somewhat compressed
      image: 0.95,    // Images don't compress much
      video: 0.98,    // Videos already compressed
      audio: 0.98,    // Audio already compressed
      other: 0.6      // General files
    };

    return ratios[category] || 0.6;
  }

  /**
   * Calculate bandwidth usage
   */
  static calculateBandwidth(
    operations: Array<{ type: 'upload' | 'download'; size: number; timestamp: Date }>,
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): { upload: number; download: number } {
    const now = new Date();
    const periodMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };

    const cutoff = new Date(now.getTime() - periodMs[period]);
    
    const recentOps = operations.filter(op => op.timestamp >= cutoff);
    
    return recentOps.reduce(
      (totals, op) => {
        if (op.type === 'upload') {
          totals.upload += op.size;
        } else if (op.type === 'download') {
          totals.download += op.size;
        }
        return totals;
      },
      { upload: 0, download: 0 }
    );
  }

  /**
   * Get provider display name
   */
  static getProviderDisplayName(provider: StorageProvider): string {
    const names: Record<StorageProvider, string> = {
      aws: 'Amazon S3',
      cloudflare: 'Cloudflare R2',
      wasabi: 'Wasabi Hot Cloud Storage',
      gridfs: 'MongoDB GridFS'
    };

    return names[provider] || provider;
  }

  /**
   * Get provider icon
   */
  static getProviderIcon(provider: StorageProvider): string {
    const icons: Record<StorageProvider, string> = {
      aws: '🅰️',
      cloudflare: '☁️',
      wasabi: '🔥',
      gridfs: '🍃'
    };

    return icons[provider] || '💾';
  }

  /**
   * Check if provider supports feature
   */
  static supportsFeature(provider: StorageProvider, feature: string): boolean {
    const features: Record<StorageProvider, string[]> = {
      aws: ['multipart', 'versioning', 'encryption', 'cdn', 'public-access'],
      cloudflare: ['multipart', 'cdn', 'public-access'],
      wasabi: ['multipart', 'versioning', 'encryption'],
      gridfs: ['versioning', 'encryption', 'deduplication']
    };

    return features[provider]?.includes(feature) || false;
  }

  /**
   * Format storage config for display
   */
  static formatConfigForDisplay(config: StorageConfig): Record<string, string> {
    const display: Record<string, string> = {
      provider: this.getProviderDisplayName(config.provider),
      name: config.name,
      status: config.isActive ? 'Active' : 'Inactive'
    };

    // Add provider-specific info
    switch (config.provider) {
      case STORAGE_PROVIDERS.AWS:
      case STORAGE_PROVIDERS.WASABI:
        display.bucket = config.config.bucket || 'Not configured';
        display.region = config.config.region || 'Not configured';
        break;
      
      case STORAGE_PROVIDERS.CLOUDFLARE:
        display.bucket = config.config.bucket || 'Not configured';
        display.accountId = config.config.accountId || 'Not configured';
        break;
      
      case STORAGE_PROVIDERS.GRIDFS:
        display.database = config.config.database || 'Not configured';
        break;
    }

    return display;
  }

  /**
   * Validate provider credentials
   */
  static validateProviderCredentials(config: StorageConfig): { isValid: boolean; missing: string[] } {
    const missing: string[] = [];

    switch (config.provider) {
      case STORAGE_PROVIDERS.AWS:
      case STORAGE_PROVIDERS.WASABI:
        if (!config.config.accessKeyId) missing.push('Access Key ID');
        if (!config.config.secretAccessKey) missing.push('Secret Access Key');
        if (!config.config.bucket) missing.push('Bucket Name');
        if (!config.config.region) missing.push('Region');
        break;

      case STORAGE_PROVIDERS.CLOUDFLARE:
        if (!config.config.accountId) missing.push('Account ID');
        if (!config.config.accessKeyId) missing.push('Access Key ID');
        if (!config.config.secretAccessKey) missing.push('Secret Access Key');
        if (!config.config.bucket) missing.push('Bucket Name');
        break;

      case STORAGE_PROVIDERS.GRIDFS:
        if (!config.config.database) missing.push('Database Name');
        break;
    }

    return {
      isValid: missing.length === 0,
      missing
    };
  }

  /**
   * Get provider pricing tier (for display purposes)
   */
  static getProviderPricingTier(provider: StorageProvider): 'low' | 'medium' | 'high' {
    const tiers: Record<StorageProvider, 'low' | 'medium' | 'high'> = {
      gridfs: 'low',      // Usually cheapest (using existing MongoDB)
      wasabi: 'low',      // Known for low pricing
      cloudflare: 'medium', // Competitive pricing
      aws: 'high'         // Premium pricing but feature-rich
    };

    return tiers[provider];
  }
}