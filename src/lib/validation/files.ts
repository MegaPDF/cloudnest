import { z } from 'zod';
import { objectIdSchema, tagsSchema, metadataSchema, paginationSchema, fileSizeSchema } from './common';

// File upload validation (matches File model)
export const fileUploadSchema = z.object({
  name: z.string()
    .min(1, 'File name is required')
    .max(255, 'File name must not exceed 255 characters')
    .refine(name => !/[<>:"/\\|?*]/.test(name), 'File name contains invalid characters'),
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1, 'MIME type is required'),
  size: fileSizeSchema.min(1, 'File size must be greater than 0'),
  extension: z.string().min(1).toLowerCase(),
  folderId: objectIdSchema.optional(),
  description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
  tags: tagsSchema.optional(),
  isPublic: z.boolean().default(false),
  metadata: metadataSchema.optional(),
  replaceExisting: z.boolean().default(false)
});

// File update validation (matches File model updatable fields)
export const fileUpdateSchema = z.object({
  name: z.string()
    .min(1)
    .max(255)
    .refine(name => !/[<>:"/\\|?*]/.test(name), 'File name contains invalid characters')
    .optional(),
  description: z.string().max(500).optional(),
  tags: tagsSchema.optional(),
  folderId: objectIdSchema.optional(),
  isPublic: z.boolean().optional()
});

// File version validation (matches IFileVersion)
export const fileVersionSchema = z.object({
  size: fileSizeSchema.min(1),
  storageKey: z.string().min(1, 'Storage key is required'),
  uploadedBy: objectIdSchema,
  changes: z.string().max(500).optional()
});

// File move validation
export const fileMoveSchema = z.object({
  fileIds: z.array(objectIdSchema).min(1, 'At least one file is required').max(1000),
  targetFolderId: objectIdSchema.optional()
});

// File copy validation
export const fileCopySchema = z.object({
  fileIds: z.array(objectIdSchema).min(1, 'At least one file is required').max(100),
  targetFolderId: objectIdSchema.optional(),
  namePattern: z.string().optional()
});

// File delete validation (matches soft delete functionality)
export const fileDeleteSchema = z.object({
  fileIds: z.array(objectIdSchema).min(1, 'At least one file is required').max(1000),
  permanent: z.boolean().default(false)
});

// File restore validation
export const fileRestoreSchema = z.object({
  fileIds: z.array(objectIdSchema).min(1, 'At least one file is required').max(1000)
});

// File search validation (matches File model fields and search capabilities)
export const fileSearchSchema = paginationSchema.extend({
  query: z.string().min(1).max(100).optional(),
  category: z.enum(['image', 'video', 'audio', 'pdf', 'text', 'other']).optional(),
  mimeType: z.string().optional(),
  extension: z.string().optional(),
  sizeMin: fileSizeSchema.optional(),
  sizeMax: fileSizeSchema.optional(),
  dateRange: z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional()
  }).optional(),
  tags: z.array(z.string()).optional(),
  folderId: objectIdSchema.optional(),
  ownerId: objectIdSchema.optional(),
  isPublic: z.boolean().optional(),
  includeDeleted: z.boolean().default(false)
});

// File batch upload validation
export const fileBatchUploadSchema = z.object({
  files: z.array(fileUploadSchema).min(1, 'At least one file is required').max(50),
  folderId: objectIdSchema.optional(),
  overwrite: z.boolean().default(false)
});

// File bulk actions validation
export const fileBulkActionSchema = z.object({
  action: z.enum(['move', 'copy', 'delete', 'restore', 'tag', 'untag', 'public', 'private']),
  fileIds: z.array(objectIdSchema).min(1).max(1000),
  options: z.object({
    targetFolderId: objectIdSchema.optional(),
    tags: tagsSchema.optional(),
    permanent: z.boolean().optional(),
    isPublic: z.boolean().optional()
  }).optional()
});

// File compression validation
export const fileCompressionSchema = z.object({
  enabled: z.boolean().default(false),
  algorithm: z.enum(['gzip', 'brotli', 'deflate']).default('gzip'),
  level: z.number().min(1).max(9).default(6)
});

// File encryption validation
export const fileEncryptionSchema = z.object({
  enabled: z.boolean().default(false),
  algorithm: z.enum(['aes-256-gcm', 'aes-256-cbc']).default('aes-256-gcm'),
  keyId: z.string().optional(),
  iv: z.string().optional()
});
