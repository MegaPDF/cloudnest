import { z } from 'zod';
import { objectIdSchema, paginationSchema, ipAddressSchema, emailSchema } from './common';
import { systemSettingsSchema } from './settings';

// Admin dashboard stats validation
export const adminStatsSchema = z.object({
  dateRange: z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date()
  }).optional(),
  includeGrowthRate: z.boolean().default(true)
});

// System health check validation
export const healthCheckSchema = z.object({
  includeDetails: z.boolean().default(false),
  checkExternal: z.boolean().default(true)
});

// System alert validation (matches SystemAlert type)
export const systemAlertSchema = z.object({
  type: z.enum(['info', 'warning', 'error', 'critical']),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  source: z.string().min(1).max(100),
  metadata: z.record(z.any()).optional()
});

// Alert acknowledgment validation
export const alertAcknowledgeSchema = z.object({
  alertIds: z.array(objectIdSchema).min(1).max(100),
  acknowledgedBy: objectIdSchema
});

// Audit log filter validation
export const auditLogFilterSchema = paginationSchema.extend({
  userId: objectIdSchema.optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  resourceId: objectIdSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  ip: ipAddressSchema.optional(),
  userAgent: z.string().optional()
});

// User management filters (matches admin user filtering needs)
export const adminUserFilterSchema = paginationSchema.extend({
  query: z.string().min(1).max(100).optional(),
  role: z.enum(['user', 'admin']).optional(),
  subscription: z.enum(['free', 'pro', 'enterprise']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  provider: z.enum(['email', 'google']).optional(),
  verified: z.boolean().optional(),
  hasFiles: z.boolean().optional(),
  storageUsageMin: z.number().min(0).optional(),
  storageUsageMax: z.number().min(0).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional()
});

// Admin user actions validation
export const adminUserActionSchema = z.object({
  action: z.enum(['activate', 'deactivate', 'delete', 'verify', 'unverify', 'reset_password', 'impersonate']),
  userIds: z.array(objectIdSchema).min(1).max(100),
  options: z.object({
    sendNotification: z.boolean().default(true),
    reason: z.string().max(500).optional(),
    newPassword: z.string().min(6).optional()
  }).optional()
});

// System maintenance validation
export const maintenanceModeSchema = z.object({
  enabled: z.boolean(),
  message: z.string().max(500).optional(),
  allowedIps: z.array(ipAddressSchema).default([]),
  scheduledStart: z.coerce.date().optional(),
  scheduledEnd: z.coerce.date().optional()
}).refine(data => {
  if (data.scheduledStart && data.scheduledEnd) {
    return data.scheduledStart < data.scheduledEnd;
  }
  return true;
}, {
  message: 'Scheduled start must be before scheduled end'
});

// Backup configuration validation
export const backupConfigSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['aws', 'cloudflare', 'wasabi']),
  interval: z.number().min(1).max(168).default(24), // 1 hour to 1 week
  retention: z.number().min(1).max(365).default(30), // 1 day to 1 year
  includeFiles: z.boolean().default(true),
  includeDatabase: z.boolean().default(true),
  compression: z.boolean().default(true),
  encryption: z.boolean().default(true),
  config: z.object({
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
    region: z.string().optional(),
    bucket: z.string().optional(),
    endpoint: z.string().optional()
  })
});

// Analytics query validation
export const analyticsQuerySchema = z.object({
  metrics: z.array(z.enum(['users', 'files', 'storage', 'shares', 'downloads'])).min(1),
  dateRange: z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date()
  }),
  groupBy: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  filters: z.object({
    userId: objectIdSchema.optional(),
    provider: z.enum(['aws', 'cloudflare', 'wasabi', 'gridfs']).optional(),
    fileType: z.string().optional()
  }).optional()
});

// Email template validation
export const emailTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  htmlContent: z.string().min(1),
  textContent: z.string().min(1),
  variables: z.array(z.object({
    name: z.string().min(1),
    description: z.string().max(200),
    required: z.boolean().default(false),
    defaultValue: z.string().optional()
  })).default([]),
  isActive: z.boolean().default(true)
});

// Email test validation
export const emailTestSchema = z.object({
  configId: objectIdSchema,
  toEmail: emailSchema,
  templateId: z.string().optional(),
  subject: z.string().default('Test Email'),
  content: z.string().default('This is a test email from CloudNest.'),
  variables: z.record(z.any()).optional()
});

// System settings update validation (matches complete SystemSettings model)
export const adminSystemSettingsUpdateSchema = systemSettingsSchema.partial().extend({
  updatedBy: objectIdSchema
});

// Plan management validation (matches Subscription model plans)
export const planManagementSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  price: z.number().min(0),
  currency: z.string().length(3).toUpperCase().default('USD'),
  interval: z.enum(['month', 'year']),
  storageLimit: z.number().min(0),
  features: z.array(z.string()).default([]),
  limitations: z.array(z.object({
    feature: z.string().min(1),
    limit: z.number().min(0),
    unit: z.string().min(1)
  })).default([]),
  isPopular: z.boolean().default(false),
  isActive: z.boolean().default(true),
  stripePriceId: z.string().optional()
});

// Subscription management validation
export const subscriptionManagementSchema = z.object({
  userId: objectIdSchema,
  action: z.enum(['upgrade', 'downgrade', 'cancel', 'reactivate', 'extend']),
  planId: z.string().optional(),
  reason: z.string().max(500).optional(),
  sendNotification: z.boolean().default(true)
});