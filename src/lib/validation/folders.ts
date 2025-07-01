import { z } from 'zod';
import { objectIdSchema, colorSchema, paginationSchema } from './common';

// Folder creation validation (matches Folder model)
export const folderCreateSchema = z.object({
  name: z.string()
    .min(1, 'Folder name is required')
    .max(100, 'Folder name cannot exceed 100 characters')
    .refine(name => !/[<>:"/\\|?*]/.test(name), 'Folder name contains invalid characters'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional(),
  parentId: objectIdSchema.optional(),
  color: colorSchema.optional()
});

// Folder update validation (matches Folder model updatable fields)
export const folderUpdateSchema = z.object({
  name: z.string()
    .min(1)
    .max(100)
    .refine(name => !/[<>:"/\\|?*]/.test(name), 'Folder name contains invalid characters')
    .optional(),
  description: z.string().max(500).optional(),
  color: colorSchema.optional(),
  isShared: z.boolean().optional(),
  isPublic: z.boolean().optional()
});

// Folder move validation
export const folderMoveSchema = z.object({
  folderIds: z.array(objectIdSchema).min(1, 'At least one folder is required').max(100),
  targetParentId: objectIdSchema.optional()
});

// Folder copy validation
export const folderCopySchema = z.object({
  folderId: objectIdSchema,
  targetParentId: objectIdSchema.optional(),
  name: z.string().min(1).max(100).optional(),
  includeFiles: z.boolean().default(true),
  includeSubfolders: z.boolean().default(true)
});

// Folder delete validation (matches soft delete functionality)
export const folderDeleteSchema = z.object({
  folderIds: z.array(objectIdSchema).min(1, 'At least one folder is required').max(100),
  permanent: z.boolean().default(false),
  includeContents: z.boolean().default(true)
});

// Folder restore validation
export const folderRestoreSchema = z.object({
  folderIds: z.array(objectIdSchema).min(1, 'At least one folder is required').max(100)
});

// Folder search validation (matches Folder model fields)
export const folderSearchSchema = paginationSchema.extend({
  query: z.string().min(1).max(100).optional(),
  parentId: objectIdSchema.optional(),
  ownerId: objectIdSchema.optional(),
  hasFiles: z.boolean().optional(),
  isShared: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  color: colorSchema.optional(),
  includeDeleted: z.boolean().default(false),
  dateRange: z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional()
  }).optional()
});

// Folder permissions validation
export const folderPermissionsSchema = z.object({
  folderId: objectIdSchema,
  permissions: z.object({
    canRead: z.boolean().default(true),
    canWrite: z.boolean().default(false),
    canDelete: z.boolean().default(false),
    canShare: z.boolean().default(false),
    canManage: z.boolean().default(false)
  })
});

// Folder bulk actions validation
export const folderBulkActionSchema = z.object({
  action: z.enum(['move', 'copy', 'delete', 'restore', 'color', 'share', 'unshare']),
  folderIds: z.array(objectIdSchema).min(1).max(100),
  options: z.object({
    targetParentId: objectIdSchema.optional(),
    color: colorSchema.optional(),
    permanent: z.boolean().optional(),
    includeContents: z.boolean().optional(),
    isShared: z.boolean().optional(),
    isPublic: z.boolean().optional()
  }).optional()
});
