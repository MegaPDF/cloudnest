import { z } from 'zod';
import { emailSchema, objectIdSchema, phoneSchema, urlSchema, paginationSchema } from './common';

// User preferences validation (matches User model preferences)
export const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  language: z.string().length(2, 'Language must be 2 characters').default('en'),
  notifications: z.object({
    email: z.boolean().default(true),
    sharing: z.boolean().default(true),
    storage: z.boolean().default(true)
  }),
  defaultView: z.enum(['grid', 'list']).default('grid'),
  itemsPerPage: z.number().min(10).max(100).default(20)
});

// User subscription validation (matches User model subscription)
export const userSubscriptionSchema = z.object({
  plan: z.enum(['free', 'pro', 'enterprise']).default('free'),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  status: z.enum(['active', 'canceled', 'past_due', 'trialing']).default('active'),
  currentPeriodEnd: z.coerce.date().optional()
});

// User storage validation (matches User model storage)
export const userStorageSchema = z.object({
  used: z.number().min(0).default(0),
  limit: z.number().min(0).default(5 * 1024 * 1024 * 1024) // 5GB default
});

// User profile validation (matches User model fields)
export const userProfileSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name cannot exceed 50 characters')
    .trim(),
  email: emailSchema,
  avatar: urlSchema.optional(),
  bio: z.string().max(500, 'Bio must not exceed 500 characters').optional(),
  website: urlSchema.optional(),
  location: z.string().max(100, 'Location must not exceed 100 characters').optional(),
  phone: phoneSchema.optional()
});

// User creation validation (matches User model - admin use)
export const userCreateSchema = z.object({
  name: z.string().min(2).max(50).trim(),
  email: emailSchema,
  password: z.string().min(6).max(128),
  role: z.enum(['user', 'admin']).default('user'),
  provider: z.enum(['email', 'google']).default('email'),
  providerId: z.string().optional(),
  isVerified: z.boolean().default(false),
  subscription: userSubscriptionSchema.optional(),
  storage: userStorageSchema.optional(),
  preferences: userPreferencesSchema.optional()
});

// User update validation (matches User model fields)
export const userUpdateSchema = z.object({
  name: z.string().min(2).max(50).trim().optional(),
  email: emailSchema.optional(),
  avatar: urlSchema.optional(),
  role: z.enum(['user', 'admin']).optional(),
  isActive: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  subscription: userSubscriptionSchema.partial().optional(),
  storage: userStorageSchema.partial().optional(),
  preferences: userPreferencesSchema.partial().optional()
});

// User search validation (matches admin requirements)
export const userSearchSchema = paginationSchema.extend({
  query: z.string().min(1).max(100).optional(),
  role: z.enum(['user', 'admin']).optional(),
  subscription: z.enum(['free', 'pro', 'enterprise']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  provider: z.enum(['email', 'google']).optional(),
  verified: z.boolean().optional(),
  dateRange: z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional()
  }).optional()
});

// User bulk actions validation
export const userBulkActionSchema = z.object({
  action: z.enum(['activate', 'deactivate', 'delete', 'verify', 'unverify', 'reset_password']),
  userIds: z.array(objectIdSchema).min(1, 'At least one user must be selected').max(100),
  options: z.object({
    sendNotification: z.boolean().default(true),
    reason: z.string().max(500).optional()
  }).optional()
});

// User invitation validation
export const userInviteSchema = z.object({
  email: emailSchema,
  role: z.enum(['user', 'admin']).default('user'),
  message: z.string().max(500).optional()
});

// Storage quota update validation
export const userStorageQuotaSchema = z.object({
  userId: objectIdSchema,
  newLimit: z.number().min(0, 'Storage limit cannot be negative')
});