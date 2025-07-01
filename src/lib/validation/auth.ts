import { z } from 'zod';
import { emailSchema, passwordSchema } from './common';

// Login validation (matches LoginCredentials type)
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().default(false)
});

// Register validation (matches RegisterData type and User model)
export const registerSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name cannot exceed 50 characters')
    .trim(),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions'
  })
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

// Forgot password validation
export const forgotPasswordSchema = z.object({
  email: emailSchema
});

// Reset password validation (matches User model resetPasswordToken)
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

// Change password validation
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
}).refine(data => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword']
});

// Email verification validation (matches User model verificationToken)
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required')
});

// Two-factor authentication validation
export const twoFactorSetupSchema = z.object({
  code: z.string()
    .length(6, 'Code must be 6 digits')
    .regex(/^\d+$/, 'Code must contain only numbers')
});

export const twoFactorVerifySchema = z.object({
  code: z.string()
    .length(6, 'Code must be 6 digits')
    .regex(/^\d+$/, 'Code must contain only numbers')
    .optional(),
  backupCode: z.string().optional()
}).refine(data => data.code || data.backupCode, {
  message: 'Either code or backup code is required'
});

// OAuth provider validation (matches User model provider field)
export const oauthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().optional(),
  provider: z.enum(['google']).default('google')
});

// Session management validation
export const sessionManagementSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required')
});