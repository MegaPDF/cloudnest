// src/lib/config/storage.ts
import { env } from './env';
import { StorageProvider } from '@/types/file';
import { StorageConfig } from '@/lib/storage/types';

export interface StorageProviderTemplate {
  provider: StorageProvider;
  name: string;
  description: string;
  icon: string;
  features: string[];
  pricing: 'free' | 'paid' | 'hybrid';
  reliability: 'high' | 'medium' | 'low';
  performance: 'high' | 'medium' | 'low';
  configFields: StorageConfigField[];
  defaultSettings: Partial<StorageConfig['settings']>;
  supportedRegions?: string[];
  maxFileSize?: number;
  supportedFeatures: {
    multipart: boolean;
    versioning: boolean;
    encryption: boolean;
    cdn: boolean;
    publicAccess: boolean;
    deduplication: boolean;
    compression: boolean;
  };
}

export interface StorageConfigField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'select' | 'boolean' | 'url';
  required: boolean;
  description: string;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

// Storage provider templates for easy configuration
export const storageProviderTemplates: Record<StorageProvider, StorageProviderTemplate> = {
  aws: {
    provider: 'aws',
    name: 'Amazon S3',
    description: 'Industry-leading object storage with high durability and availability',
    icon: '🅰️',
    features: [
      'High durability (99.999999999%)',
      'Global infrastructure',
      'Advanced security features',
      'Intelligent tiering',
      'Lifecycle management',
      'Cross-region replication',
    ],
    pricing: 'paid',
    reliability: 'high',
    performance: 'high',
    supportedRegions: [
      'us-east-1',
      'us-west-1',
      'us-west-2',
      'eu-west-1',
      'eu-central-1',
      'ap-southeast-1',
      'ap-northeast-1',
    ],
    maxFileSize: 5 * 1024 * 1024 * 1024 * 1024, // 5TB
    supportedFeatures: {
      multipart: true,
      versioning: true,
      encryption: true,
      cdn: true,
      publicAccess: true,
      deduplication: false,
      compression: false,
    },
    configFields: [
      {
        name: 'accessKeyId',
        label: 'Access Key ID',
        type: 'text',
        required: true,
        description: 'AWS IAM Access Key ID',
        placeholder: 'AKIAIOSFODNN7EXAMPLE',
      },
      {
        name: 'secretAccessKey',
        label: 'Secret Access Key',
        type: 'password',
        required: true,
        description: 'AWS IAM Secret Access Key',
        placeholder: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      },
      {
        name: 'region',
        label: 'Region',
        type: 'select',
        required: true,
        description: 'AWS region for your S3 bucket',
        options: [
          { label: 'US East (N. Virginia)', value: 'us-east-1' },
          { label: 'US West (Oregon)', value: 'us-west-2' },
          { label: 'EU (Ireland)', value: 'eu-west-1' },
          { label: 'Asia Pacific (Singapore)', value: 'ap-southeast-1' },
        ],
      },
      {
        name: 'bucket',
        label: 'Bucket Name',
        type: 'text',
        required: true,
        description: 'S3 bucket name to store files',
        placeholder: 'my-cloudnest-bucket',
      },
      {
        name: 'endpoint',
        label: 'Custom Endpoint (Optional)',
        type: 'url',
        required: false,
        description: 'Custom S3 endpoint URL if using S3-compatible service',
        placeholder: 'https://s3.amazonaws.com',
      },
    ],
    defaultSettings: {
      uploadTimeout: 30000,
      retryAttempts: 3,
      chunkSize: 10 * 1024 * 1024, // 10MB
      enableCompression: false,
      enableEncryption: true,
      enableVersioning: true,
      enableDeduplication: false,
      autoCleanup: true,
      cleanupDays: 30,
    },
  },
  cloudflare: {
    provider: 'cloudflare',
    name: 'Cloudflare R2',
    description: 'Zero egress fees object storage with global edge network',
    icon: '☁️',
    features: [
      'Zero egress fees',
      'S3-compatible API',
      'Global edge network',
      'High performance',
      'Competitive pricing',
      'Built-in CDN',
    ],
    pricing: 'paid',
    reliability: 'high',
    performance: 'high',
    maxFileSize: 5 * 1024 * 1024 * 1024 * 1024, // 5TB
    supportedFeatures: {
      multipart: true,
      versioning: false,
      encryption: true,
      cdn: true,
      publicAccess: true,
      deduplication: false,
      compression: false,
    },
    configFields: [
      {
        name: 'accountId',
        label: 'Account ID',
        type: 'text',
        required: true,
        description: 'Cloudflare Account ID',
        placeholder: '1234567890abcdef1234567890abcdef',
      },
      {
        name: 'accessKeyId',
        label: 'Access Key ID',
        type: 'text',
        required: true,
        description: 'R2 API Token Access Key ID',
        placeholder: 'f1234567890abcdef1234567890abcdef12',
      },
      {
        name: 'secretAccessKey',
        label: 'Secret Access Key',
        type: 'password',
        required: true,
        description: 'R2 API Token Secret',
        placeholder: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
      },
      {
        name: 'bucket',
        label: 'Bucket Name',
        type: 'text',
        required: true,
        description: 'R2 bucket name to store files',
        placeholder: 'my-cloudnest-bucket',
      },
    ],
    defaultSettings: {
      uploadTimeout: 30000,
      retryAttempts: 3,
      chunkSize: 10 * 1024 * 1024, // 10MB
      enableCompression: false,
      enableEncryption: true,
      enableVersioning: false,
      enableDeduplication: false,
      autoCleanup: true,
      cleanupDays: 30,
    },
  },
  wasabi: {
    provider: 'wasabi',
    name: 'Wasabi Hot Cloud Storage',
    description: 'Hot cloud storage that is 1/5th the price of Amazon S3',
    icon: '🔥',
    features: [
      'Extremely low pricing',
      'No egress fees',
      'S3-compatible API',
      'High performance',
      'Immutable buckets',
      'Instant access',
    ],
    pricing: 'paid',
    reliability: 'medium',
    performance: 'high',
    supportedRegions: [
      'us-east-1',
      'us-west-1',
      'eu-central-1',
      'ap-northeast-1',
    ],
    maxFileSize: 5 * 1024 * 1024 * 1024 * 1024, // 5TB
    supportedFeatures: {
      multipart: true,
      versioning: true,
      encryption: true,
      cdn: false,
      publicAccess: true,
      deduplication: false,
      compression: false,
    },
    configFields: [
      {
        name: 'accessKeyId',
        label: 'Access Key',
        type: 'text',
        required: true,
        description: 'Wasabi Access Key',
        placeholder: 'WASABI_ACCESS_KEY',
      },
      {
        name: 'secretAccessKey',
        label: 'Secret Key',
        type: 'password',
        required: true,
        description: 'Wasabi Secret Key',
        placeholder: 'WASABI_SECRET_KEY',
      },
      {
        name: 'region',
        label: 'Region',
        type: 'select',
        required: true,
        description: 'Wasabi storage region',
        options: [
          { label: 'US East 1 (N. Virginia)', value: 'us-east-1' },
          { label: 'US West 1 (Oregon)', value: 'us-west-1' },
          { label: 'EU Central 1 (Amsterdam)', value: 'eu-central-1' },
          { label: 'AP Northeast 1 (Tokyo)', value: 'ap-northeast-1' },
        ],
      },
      {
        name: 'bucket',
        label: 'Bucket Name',
        type: 'text',
        required: true,
        description: 'Wasabi bucket name to store files',
        placeholder: 'my-cloudnest-bucket',
      },
      {
        name: 'endpoint',
        label: 'Endpoint (Optional)',
        type: 'url',
        required: false,
        description: 'Custom Wasabi endpoint URL',
        placeholder: 'https://s3.wasabisys.com',
      },
    ],
    defaultSettings: {
      uploadTimeout: 30000,
      retryAttempts: 3,
      chunkSize: 5 * 1024 * 1024, // 5MB
      enableCompression: false,
      enableEncryption: true,
      enableVersioning: true,
      enableDeduplication: false,
      autoCleanup: true,
      cleanupDays: 30,
    },
  },
  gridfs: {
    provider: 'gridfs',
    name: 'MongoDB GridFS',
    description: 'File storage using MongoDB GridFS - ideal for development and small deployments',
    icon: '🍃',
    features: [
      'No additional setup required',
      'Built-in with MongoDB',
      'Perfect for development',
      'File versioning support',
      'Automatic sharding',
      'No bandwidth costs',
    ],
    pricing: 'free',
    reliability: 'medium',
    performance: 'medium',
    maxFileSize: 16 * 1024 * 1024, // 16MB per chunk, unlimited total
    supportedFeatures: {
      multipart: false,
      versioning: true,
      encryption: true,
      cdn: false,
      publicAccess: false,
      deduplication: true,
      compression: true,
    },
    configFields: [
      {
        name: 'database',
        label: 'Database Name',
        type: 'text',
        required: false,
        description: 'MongoDB database name (uses default if empty)',
        placeholder: 'cloudnest',
      },
      {
        name: 'bucketName',
        label: 'Bucket Name',
        type: 'text',
        required: false,
        description: 'GridFS bucket name (default: files)',
        placeholder: 'files',
      },
    ],
    defaultSettings: {
      uploadTimeout: 30000,
      retryAttempts: 3,
      chunkSize: 255 * 1024, // 255KB
      enableCompression: true,
      enableEncryption: true,
      enableVersioning: true,
      enableDeduplication: true,
      autoCleanup: true,
      cleanupDays: 30,
    },
  },
};

// Default storage configurations based on environment
export const getDefaultStorageConfigs = (): Partial<StorageConfig>[] => {
  const configs: Partial<StorageConfig>[] = [];

  // Always include GridFS as fallback
  configs.push({
    provider: 'gridfs',
    name: 'Default MongoDB Storage',
    isActive: true,
    isDefault: env.DEFAULT_STORAGE_PROVIDER === 'gridfs',
    config: {
      database: 'cloudnest',
    },
    settings: storageProviderTemplates.gridfs.defaultSettings as Required<StorageConfig['settings']>,
  });

  // Add AWS S3 if configured
  if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_BUCKET) {
    configs.push({
      provider: 'aws',
      name: 'Amazon S3',
      isActive: true,
      isDefault: env.DEFAULT_STORAGE_PROVIDER === 'aws',
      config: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        region: env.AWS_REGION,
        bucket: env.AWS_BUCKET,
        endpoint: env.AWS_ENDPOINT,
      },
      settings: storageProviderTemplates.aws.defaultSettings as Required<StorageConfig['settings']>,
    });
  }

  // Add Cloudflare R2 if configured
  if (env.CLOUDFLARE_ACCESS_KEY_ID && env.CLOUDFLARE_SECRET_ACCESS_KEY && env.CLOUDFLARE_BUCKET) {
    configs.push({
      provider: 'cloudflare',
      name: 'Cloudflare R2',
      isActive: true,
      isDefault: env.DEFAULT_STORAGE_PROVIDER === 'cloudflare',
      config: {
        accountId: env.CLOUDFLARE_ACCOUNT_ID,
        accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID,
        secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS_KEY,
        bucket: env.CLOUDFLARE_BUCKET,
        endpoint: env.CLOUDFLARE_ENDPOINT,
      },
      settings: storageProviderTemplates.cloudflare.defaultSettings as Required<StorageConfig['settings']>,
    });
  }

  // Add Wasabi if configured
  if (env.WASABI_ACCESS_KEY_ID && env.WASABI_SECRET_ACCESS_KEY && env.WASABI_BUCKET) {
    configs.push({
      provider: 'wasabi',
      name: 'Wasabi Hot Storage',
      isActive: true,
      isDefault: env.DEFAULT_STORAGE_PROVIDER === 'wasabi',
      config: {
        accessKeyId: env.WASABI_ACCESS_KEY_ID,
        secretAccessKey: env.WASABI_SECRET_ACCESS_KEY,
        region: env.WASABI_REGION,
        bucket: env.WASABI_BUCKET,
        endpoint: env.WASABI_ENDPOINT,
      },
      settings: storageProviderTemplates.wasabi.defaultSettings as Required<StorageConfig['settings']>,
    });
  }

  return configs;
};

// Storage optimization presets
export const storageOptimizationPresets = {
  development: {
    name: 'Development',
    description: 'Optimized for development with fast uploads and minimal complexity',
    settings: {
      uploadTimeout: 15000,
      retryAttempts: 1,
      chunkSize: 1 * 1024 * 1024, // 1MB
      enableCompression: false,
      enableEncryption: false,
      enableVersioning: false,
      enableDeduplication: false,
      autoCleanup: false,
      cleanupDays: 7,
    },
  },
  production: {
    name: 'Production',
    description: 'Optimized for production with reliability and performance',
    settings: {
      uploadTimeout: 60000,
      retryAttempts: 3,
      chunkSize: 10 * 1024 * 1024, // 10MB
      enableCompression: true,
      enableEncryption: true,
      enableVersioning: true,
      enableDeduplication: true,
      autoCleanup: true,
      cleanupDays: 30,
    },
  },
  storage: {
    name: 'Storage Optimized',
    description: 'Optimized for storage efficiency with compression and deduplication',
    settings: {
      uploadTimeout: 45000,
      retryAttempts: 3,
      chunkSize: 5 * 1024 * 1024, // 5MB
      enableCompression: true,
      enableEncryption: true,
      enableVersioning: false,
      enableDeduplication: true,
      autoCleanup: true,
      cleanupDays: 90,
    },
  },
  performance: {
    name: 'Performance Optimized',
    description: 'Optimized for upload/download speed with larger chunks',
    settings: {
      uploadTimeout: 30000,
      retryAttempts: 2,
      chunkSize: 20 * 1024 * 1024, // 20MB
      enableCompression: false,
      enableEncryption: false,
      enableVersioning: false,
      enableDeduplication: false,
      autoCleanup: true,
      cleanupDays: 30,
    },
  },
};

// Storage health check configuration
export const storageHealthConfig = {
  checkInterval: 30000, // 30 seconds
  timeout: 10000, // 10 seconds
  maxRetries: 3,
  unhealthyThreshold: 3, // Mark unhealthy after 3 failed checks
  healthyThreshold: 2, // Mark healthy after 2 successful checks
};

// Storage migration settings
export const storageMigrationConfig = {
  batchSize: 100,
  concurrency: 5,
  verifyIntegrity: true,
  preserveMetadata: true,
  deleteSourceAfterMigration: false,
  retryFailedMigrations: true,
  maxRetryAttempts: 3,
};

// File type specific configurations
export const fileTypeConfigs = {
  images: {
    enableThumbnails: true,
    thumbnailSizes: [150, 300, 600],
    enableMetadataExtraction: true,
    allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
    compressionEnabled: true,
    compressionQuality: 85,
  },
  videos: {
    enableThumbnails: true,
    thumbnailSizes: [300, 600],
    enableTranscoding: false,
    allowedFormats: ['mp4', 'avi', 'mov', 'wmv', 'webm'],
    maxDuration: 3600, // 1 hour in seconds
  },
  documents: {
    enablePreview: true,
    enableTextExtraction: true,
    allowedFormats: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
    enableVersioning: true,
  },
  archives: {
    enableExtraction: false,
    scanForMalware: true,
    allowedFormats: ['zip', 'rar', '7z', 'tar', 'gz'],
    maxFiles: 1000, // Max files in archive
  },
};

export default {
  providers: storageProviderTemplates,
  defaultConfigs: getDefaultStorageConfigs(),
  optimizationPresets: storageOptimizationPresets,
  healthConfig: storageHealthConfig,
  migrationConfig: storageMigrationConfig,
  fileTypeConfigs,
};