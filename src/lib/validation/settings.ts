import { z } from 'zod';
import { colorSchema, emailSchema, ipAddressSchema, urlSchema, objectIdSchema } from './common';

// App settings validation (matches SystemSettings model app field)
export const appSettingsSchema = z.object({
  name: z.string().min(1).max(50, 'App name cannot exceed 50 characters').default('CloudNest'),
  description: z.string().max(200, 'Description cannot exceed 200 characters').default('Secure cloud storage and file management'),
  logo: urlSchema.optional(),
  favicon: urlSchema.optional(),
  primaryColor: colorSchema.default('#3B82F6'),
  secondaryColor: colorSchema.default('#1E40AF'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be in format x.y.z').default('1.0.0')
});

// Feature settings validation (matches SystemSettings model features field)
export const featureSettingsSchema = z.object({
  registration: z.boolean().default(true),
  emailVerification: z.boolean().default(true),
  googleAuth: z.boolean().default(true),
  fileSharing: z.boolean().default(true),
  publicSharing: z.boolean().default(true),
  fileVersioning: z.boolean().default(true),
  trash: z.boolean().default(true),
  compression: z.boolean().default(false),
  encryption: z.boolean().default(false)
});

// System limits validation (matches SystemSettings model limits field)
export const systemLimitsSchema = z.object({
  maxFileSize: z.number().min(1024).max(10 * 1024 * 1024 * 1024).default(100 * 1024 * 1024), // 1KB to 10GB, default 100MB
  maxFilesPerUpload: z.number().min(1).max(100).default(10),
  maxFolderDepth: z.number().min(1).max(50).default(10),
  maxSharesPerUser: z.number().min(1).default(100),
  sessionTimeout: z.number().min(60 * 1000).default(24 * 60 * 60 * 1000) // Min 1 minute, default 24 hours
});

// Storage settings validation (matches SystemSettings model storage field)
export const systemStorageSettingsSchema = z.object({
  defaultProvider: z.enum(['aws', 'cloudflare', 'wasabi', 'gridfs']).default('gridfs'),
  autoCleanup: z.boolean().default(true),
  cleanupDays: z.number().min(1).default(30),
  backupEnabled: z.boolean().default(false),
  backupInterval: z.number().min(1).default(24) // hours
});

// Email settings validation (matches SystemSettings model email field)
export const systemEmailSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  defaultProvider: z.enum(['smtp', 'sendgrid', 'mailgun', 'ses']).default('smtp'),
  templates: z.object({
    branding: z.boolean().default(true),
    customFooter: z.string().max(1000).optional(),
    customHeader: z.string().max(1000).optional()
  })
});

// Security settings validation (matches SystemSettings model security field)
export const securitySettingsSchema = z.object({
  passwordMinLength: z.number().min(4).max(50).default(6),
  passwordRequireUppercase: z.boolean().default(false),
  passwordRequireNumbers: z.boolean().default(false),
  passwordRequireSymbols: z.boolean().default(false),
  sessionTimeout: z.number().min(15 * 60 * 1000).default(24 * 60 * 60 * 1000), // Min 15 minutes, default 24 hours
  maxLoginAttempts: z.number().min(3).max(10).default(5),
  lockoutDuration: z.number().min(60 * 1000).default(15 * 60 * 1000), // Min 1 minute, default 15 minutes
  enableTwoFactor: z.boolean().default(false)
});

// Analytics settings validation (matches SystemSettings model analytics field)
export const analyticsSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.string().optional(),
  trackingId: z.string().optional(),
  anonymizeIp: z.boolean().default(true)
});

// Maintenance settings validation (matches SystemSettings model maintenance field)
export const maintenanceSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  message: z.string().max(500).default('System is under maintenance. Please try again later.'),
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

// Notification settings validation (matches SystemSettings model notifications field)
export const notificationSettingsSchema = z.object({
  webhook: z.object({
    url: urlSchema,
    events: z.array(z.string()),
    enabled: z.boolean().default(false)
  }).optional(),
  slack: z.object({
    webhookUrl: urlSchema,
    channel: z.string().min(1),
    enabled: z.boolean().default(false)
  }).optional()
});

// Complete system settings validation (matches SystemSettings model)
export const systemSettingsSchema = z.object({
  app: appSettingsSchema,
  features: featureSettingsSchema,
  limits: systemLimitsSchema,
  storage: systemStorageSettingsSchema,
  email: systemEmailSettingsSchema,
  security: securitySettingsSchema,
  analytics: analyticsSettingsSchema,
  maintenance: maintenanceSettingsSchema,
  notifications: notificationSettingsSchema,
  updatedBy: objectIdSchema
});

// User preferences validation (matches User model preferences field)
export const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  language: z.string().length(2).default('en'),
  notifications: z.object({
    email: z.boolean().default(true),
    sharing: z.boolean().default(true),
    storage: z.boolean().default(true)
  }),
  defaultView: z.enum(['grid', 'list']).default('grid'),
  itemsPerPage: z.number().min(10).max(100).default(20)
});

// Email config validation (matches EmailConfig model)
export const emailConfigSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  provider: z.enum(['smtp', 'sendgrid', 'mailgun', 'ses']),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  config: z.object({
    // SMTP
    host: z.string().optional(),
    port: z.number().min(1).max(65535).optional(),
    secure: z.boolean().default(true),
    username: z.string().optional(),
    password: z.string().optional(),
    
    // SendGrid
    apiKey: z.string().optional(),
    
    // Mailgun
    domain: z.string().optional(),
    
    // SES
    region: z.string().optional(),
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional()
  }),
  settings: z.object({
    fromEmail: emailSchema,
    fromName: z.string().min(1).max(100),
    replyTo: emailSchema.optional(),
    timeout: z.number().min(1000).max(60000).default(30000),
    retryAttempts: z.number().min(0).max(10).default(3),
    enableTracking: z.boolean().default(true),
    enableBounceHandling: z.boolean().default(true)
  }),
  templates: z.object({
    welcome: z.boolean().default(true),
    passwordReset: z.boolean().default(true),
    fileShared: z.boolean().default(true),
    storageQuota: z.boolean().default(true),
    subscription: z.boolean().default(true),
    customBranding: z.boolean().default(true)
  })
});
