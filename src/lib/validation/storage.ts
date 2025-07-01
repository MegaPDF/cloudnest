import { z } from 'zod';
import { objectIdSchema, urlSchema, storageLimitSchema } from './common';

// Storage provider validation (matches StorageProvider type)
export const storageProviderSchema = z.enum(['aws', 'cloudflare', 'wasabi', 'gridfs']);

// Storage provider config validation (matches IStorageProviderConfig)
export const storageProviderConfigSchema = z.object({
  // AWS S3 / Wasabi
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  region: z.string().optional(),
  bucket: z.string().optional(),
  endpoint: urlSchema.optional(),
  
  // Cloudflare R2
  accountId: z.string().optional(),
  
  // GridFS (MongoDB)
  database: z.string().optional(),
  
  // Common settings
  maxFileSize: z.number().min(1024).max(10 * 1024 * 1024 * 1024).optional(), // 1KB to 10GB
  allowedMimeTypes: z.array(z.string()).optional(),
  cdnUrl: urlSchema.optional(),
  publicRead: z.boolean().default(false)
});

// Storage settings validation (matches IStorageSettings from model)
export const storageSettingsSchema = z.object({
  uploadTimeout: z.number().min(5000).max(300000).default(30000), // 5s to 5min
  retryAttempts: z.number().min(0).max(10).default(3),
  chunkSize: z.number().min(1024 * 1024).max(100 * 1024 * 1024).default(5 * 1024 * 1024), // 1MB to 100MB
  enableCompression: z.boolean().default(false),
  enableEncryption: z.boolean().default(false),
  enableVersioning: z.boolean().default(true),
  enableDeduplication: z.boolean().default(true),
  autoCleanup: z.boolean().default(true),
  cleanupDays: z.number().min(1).max(365).default(30)
});

// Storage config validation (matches StorageConfig model)
export const storageConfigSchema = z.object({
  provider: storageProviderSchema,
  name: z.string().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  config: storageProviderConfigSchema,
  settings: storageSettingsSchema
});

// Storage config update validation
export const storageConfigUpdateSchema = storageConfigSchema.omit({ provider: true }).partial();

// Storage connection test validation
export const storageTestConnectionSchema = z.object({
  configId: objectIdSchema
});

// Storage usage query validation
export const storageUsageQuerySchema = z.object({
  userId: objectIdSchema.optional(),
  provider: storageProviderSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  includeDetails: z.boolean().default(false)
});

// Storage cleanup validation
export const storageCleanupSchema = z.object({
  provider: storageProviderSchema.optional(),
  dryRun: z.boolean().default(true),
  olderThanDays: z.number().min(1).max(365).default(30),
  includeVersions: z.boolean().default(true),
  fileTypes: z.array(z.string()).optional()
});

// Storage migration validation
export const storageMigrationSchema = z.object({
  fromProvider: storageProviderSchema,
  toProvider: storageProviderSchema,
  fileIds: z.array(objectIdSchema).optional(),
  batchSize: z.number().min(1).max(1000).default(100),
  preserveOriginal: z.boolean().default(false),
  verifyIntegrity: z.boolean().default(true)
});

// Storage quota update validation
export const storageQuotaUpdateSchema = z.object({
  userId: objectIdSchema,
  newLimit: storageLimitSchema
});

// Storage statistics validation
export const storageStatsSchema = z.object({
  provider: storageProviderSchema.optional(),
  dateRange: z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date()
  }).optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day')
});