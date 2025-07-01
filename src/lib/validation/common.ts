import { z } from 'zod';

// Base ObjectId validation
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

// Email validation
export const emailSchema = z.string()
  .email('Invalid email address')
  .toLowerCase()
  .max(255, 'Email must not exceed 255 characters');

// Password validation (matches User model requirements)
export const passwordSchema = z.string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password must not exceed 128 characters');

// Color validation (matches model hex pattern)
export const colorSchema = z.string()
  .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color format')
  .default('#3B82F6');

// URL validation
export const urlSchema = z.string().url('Invalid URL format');

// Phone validation
export const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format');

// Tags validation (matches File model)
export const tagsSchema = z.array(z.string().min(1).max(50).trim().toLowerCase()).max(10);

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Search schema extending pagination
export const searchSchema = paginationSchema.extend({
  query: z.string().min(1).max(100).optional(),
  filters: z.record(z.any()).optional()
});

// Date range validation
export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional()
}).refine(data => {
  if (data.startDate && data.endDate) {
    return data.startDate <= data.endDate;
  }
  return true;
}, {
  message: 'Start date must be before end date'
});

// File size validation helpers
export const fileSizeSchema = z.number().min(0, 'File size cannot be negative');
export const storageLimitSchema = z.number().min(0, 'Storage limit cannot be negative');

// Metadata validation (matches model)
export const metadataSchema = z.record(z.any()).default({});

// IP address validation
export const ipAddressSchema = z.string().ip('Invalid IP address');
