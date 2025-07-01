import { z } from 'zod';
import { objectIdSchema, emailSchema, ipAddressSchema } from './common';

// Share permissions validation (matches ISharePermissions)
export const sharePermissionsSchema = z.object({
  canView: z.boolean().default(true),
  canDownload: z.boolean().default(true),
  canEdit: z.boolean().default(false),
  canShare: z.boolean().default(false),
  canComment: z.boolean().default(false)
});

// Share access validation (matches IShareAccess)
export const shareAccessSchema = z.object({
  type: z.enum(['public', 'restricted', 'password']).default('public'),
  password: z.string().min(4).max(100).optional(),
  allowedEmails: z.array(emailSchema).max(100).optional(),
  domains: z.array(z.string().min(1).max(100)).max(50).optional()
}).refine(data => {
  if (data.type === 'password' && !data.password) {
    return false;
  }
  if (data.type === 'restricted' && (!data.allowedEmails?.length && !data.domains?.length)) {
    return false;
  }
  return true;
}, {
  message: 'Invalid access configuration for the selected type'
});

// Share settings validation (matches IShareSettings)
export const shareSettingsSchema = z.object({
  expiresAt: z.coerce.date().min(new Date(), 'Expiration date must be in the future').optional(),
  downloadLimit: z.number().min(1).max(10000).optional(),
  viewLimit: z.number().min(1).max(100000).optional(),
  requireSignIn: z.boolean().default(false),
  allowComments: z.boolean().default(false),
  trackAccess: z.boolean().default(true),
  customMessage: z.string().max(500).optional()
});

// Share creation validation (matches Share model)
export const shareCreateSchema = z.object({
  type: z.enum(['file', 'folder']),
  resourceId: objectIdSchema,
  permissions: sharePermissionsSchema.partial().optional(),
  access: shareAccessSchema.optional(),
  settings: shareSettingsSchema.optional()
});

// Share update validation (matches Share model updatable fields)
export const shareUpdateSchema = z.object({
  permissions: sharePermissionsSchema.partial().optional(),
  access: shareAccessSchema.optional(),
  settings: shareSettingsSchema.optional(),
  isActive: z.boolean().optional()
});

// Share password verification
export const sharePasswordSchema = z.object({
  password: z.string().min(1, 'Password is required')
});

// Share access log validation (matches IShareAccessLog)
export const shareAccessLogSchema = z.object({
  ip: ipAddressSchema,
  userAgent: z.string().min(1, 'User agent is required'),
  action: z.enum(['view', 'download', 'comment']),
  userId: objectIdSchema.optional(),
  location: z.string().optional()
});

// Share notification validation
export const shareNotificationSchema = z.object({
  shareId: objectIdSchema,
  recipientEmails: z.array(emailSchema).min(1, 'At least one recipient is required').max(50),
  message: z.string().max(500).optional(),
  includeLink: z.boolean().default(true)
});

// Share comment validation
export const shareCommentSchema = z.object({
  shareId: objectIdSchema,
  content: z.string().min(1, 'Comment cannot be empty').max(1000),
  author: z.string().min(1).max(100).optional(),
  isAnonymous: z.boolean().default(false)
});

// Share bulk actions validation
export const shareBulkActionSchema = z.object({
  action: z.enum(['activate', 'deactivate', 'delete', 'extend', 'revoke']),
  shareIds: z.array(objectIdSchema).min(1).max(100),
  options: z.object({
    expiresAt: z.coerce.date().optional(),
    daysToExtend: z.number().min(1).max(365).optional(),
    reason: z.string().max(500).optional()
  }).optional()
});

// Share analytics validation
export const shareAnalyticsSchema = z.object({
  shareIds: z.array(objectIdSchema).optional(),
  dateRange: z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date()
  }).optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
  metrics: z.array(z.enum(['views', 'downloads', 'comments', 'unique_visitors'])).optional()
});