// src/lib/config/env.ts
import { z } from 'zod';

// Enhanced environment schema with all variables used in the project
const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),

  // Database
  MONGODB_URI: z.string().min(1, 'MongoDB URI is required'),
  DB_MAX_POOL_SIZE: z.string().default('10'),
  DB_TIMEOUT: z.string().default('45000'),

  // NextAuth
  NEXTAUTH_SECRET: z.string().min(1, 'NextAuth secret is required'),
  NEXTAUTH_URL: z.string().url().optional(),

  // OAuth Providers
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // AWS S3
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_BUCKET: z.string().optional(),
  AWS_ENDPOINT: z.string().optional(),

  // Cloudflare R2
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_ACCESS_KEY_ID: z.string().optional(),
  CLOUDFLARE_SECRET_ACCESS_KEY: z.string().optional(),
  CLOUDFLARE_BUCKET: z.string().optional(),
  CLOUDFLARE_ENDPOINT: z.string().optional(),

  // Wasabi
  WASABI_ACCESS_KEY_ID: z.string().optional(),
  WASABI_SECRET_ACCESS_KEY: z.string().optional(),
  WASABI_REGION: z.string().default('us-east-1'),
  WASABI_BUCKET: z.string().optional(),
  WASABI_ENDPOINT: z.string().optional(),

  // Stripe Payment
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_API_VERSION: z.string().default('2023-10-16'),

  // Email Providers - SMTP
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587'),
  SMTP_SECURE: z.string().default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Email Providers - SendGrid
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM: z.string().optional(),

  // Email Providers - Mailgun
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_DOMAIN: z.string().optional(),
  MAILGUN_HOST: z.string().default('api.mailgun.net'),

  // Email Providers - AWS SES
  SES_REGION: z.string().default('us-east-1'),
  SES_ACCESS_KEY_ID: z.string().optional(),
  SES_SECRET_ACCESS_KEY: z.string().optional(),

  // Email Configuration
  DEFAULT_EMAIL_PROVIDER: z.enum(['smtp', 'sendgrid', 'mailgun', 'ses']).default('smtp'),
  FALLBACK_EMAIL_PROVIDER: z.enum(['smtp', 'sendgrid', 'mailgun', 'ses']).optional(),
  DEFAULT_FROM_EMAIL: z.string().email().optional(),
  DEFAULT_FROM_NAME: z.string().default('CloudNest'),

  // Storage Configuration
  DEFAULT_STORAGE_PROVIDER: z.enum(['aws', 'cloudflare', 'wasabi', 'gridfs']).default('gridfs'),
  FALLBACK_STORAGE_PROVIDER: z.enum(['aws', 'cloudflare', 'wasabi', 'gridfs']).optional(),
  MAX_FILE_SIZE: z.string().default('104857600'), // 100MB in bytes
  ENABLE_FILE_COMPRESSION: z.string().default('false'),
  ENABLE_FILE_ENCRYPTION: z.string().default('false'),

  // Security
  ENCRYPTION_KEY: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  RATE_LIMIT_WINDOW: z.string().default('900000'), // 15 minutes
  RATE_LIMIT_MAX: z.string().default('100'),

  // Application Features
  ENABLE_REGISTRATION: z.string().default('true'),
  ENABLE_EMAIL_VERIFICATION: z.string().default('true'),
  ENABLE_FILE_SHARING: z.string().default('true'),
  ENABLE_PUBLIC_SHARING: z.string().default('true'),
  ENABLE_FILE_VERSIONING: z.string().default('true'),
  ENABLE_TRASH: z.string().default('true'),

  // Analytics & Monitoring
  ENABLE_ANALYTICS: z.string().default('false'),
  ANALYTICS_PROVIDER: z.string().optional(),
  ANALYTICS_TRACKING_ID: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Redis (for caching and sessions)
  REDIS_URL: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  ENABLE_REDIS: z.string().default('false'),

  // CDN Configuration
  CDN_URL: z.string().optional(),
  ASSET_PREFIX: z.string().optional(),

  // Backup Configuration
  BACKUP_ENABLED: z.string().default('false'),
  BACKUP_PROVIDER: z.enum(['aws', 'cloudflare', 'wasabi']).optional(),
  BACKUP_SCHEDULE: z.string().default('0 2 * * *'), // Daily at 2 AM
  BACKUP_RETENTION_DAYS: z.string().default('30'),

  // Webhooks
  WEBHOOK_SECRET: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().optional(),

  // Admin Configuration
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  ALLOW_ADMIN_REGISTRATION: z.string().default('false'),

  // Localization
  DEFAULT_LANGUAGE: z.enum(['en', 'id']).default('en'),
  DEFAULT_CURRENCY: z.enum(['USD', 'IDR']).default('USD'),
  DEFAULT_TIMEZONE: z.string().default('UTC'),

  // Rate Limiting
  UPLOAD_RATE_LIMIT: z.string().default('10'), // uploads per minute
  DOWNLOAD_RATE_LIMIT: z.string().default('50'), // downloads per minute
  API_RATE_LIMIT: z.string().default('100'), // API calls per minute
  SHARE_RATE_LIMIT: z.string().default('20'), // shares per minute

  // Development
  SKIP_ENV_VALIDATION: z.string().default('false'),
  DEBUG_MODE: z.string().default('false'),
  MOCK_EMAIL: z.string().default('false'),
  MOCK_PAYMENT: z.string().default('false'),
});

export type EnvConfig = z.infer<typeof envSchema>;

// Validation function with better error handling
export function validateEnv(): EnvConfig {
  // Skip validation in certain scenarios
  if (process.env.SKIP_ENV_VALIDATION === 'true') {
    return process.env as any;
  }

  try {
    const parsed = envSchema.parse(process.env);
    
    // Additional validation logic
    validateProviderCredentials(parsed);
    validateRequiredCombinations(parsed);
    
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => 
        `❌ ${err.path.join('.')}: ${err.message}`
      ).join('\n');
      
      console.error('❌ Invalid environment variables:\n' + errorMessages);
      
      // In development, show helpful hints
      if (process.env.NODE_ENV === 'development') {
        console.log('\n💡 Hints:');
        console.log('- Copy .env.example to .env.local and fill in your values');
        console.log('- Check the documentation for required environment variables');
        console.log('- Some variables are optional but may be needed for certain features');
      }
    }
    
    throw new Error('Invalid environment configuration');
  }
}

// Validate that provider credentials are complete when a provider is configured
function validateProviderCredentials(env: EnvConfig): void {
  // Validate AWS credentials if AWS is the default storage provider
  if (env.DEFAULT_STORAGE_PROVIDER === 'aws' && (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_BUCKET)) {
    throw new Error('AWS storage provider selected but AWS credentials are incomplete');
  }

  // Validate Cloudflare credentials
  if (env.DEFAULT_STORAGE_PROVIDER === 'cloudflare' && (!env.CLOUDFLARE_ACCESS_KEY_ID || !env.CLOUDFLARE_SECRET_ACCESS_KEY || !env.CLOUDFLARE_ACCOUNT_ID)) {
    throw new Error('Cloudflare storage provider selected but Cloudflare credentials are incomplete');
  }

  // Validate Wasabi credentials
  if (env.DEFAULT_STORAGE_PROVIDER === 'wasabi' && (!env.WASABI_ACCESS_KEY_ID || !env.WASABI_SECRET_ACCESS_KEY || !env.WASABI_BUCKET)) {
    throw new Error('Wasabi storage provider selected but Wasabi credentials are incomplete');
  }

  // Validate email provider credentials
  if (env.DEFAULT_EMAIL_PROVIDER === 'smtp' && (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS)) {
    console.warn('⚠️ SMTP email provider selected but SMTP credentials are incomplete');
  }

  if (env.DEFAULT_EMAIL_PROVIDER === 'sendgrid' && !env.SENDGRID_API_KEY) {
    console.warn('⚠️ SendGrid email provider selected but SendGrid API key is missing');
  }

  if (env.DEFAULT_EMAIL_PROVIDER === 'mailgun' && (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN)) {
    console.warn('⚠️ Mailgun email provider selected but Mailgun credentials are incomplete');
  }

  if (env.DEFAULT_EMAIL_PROVIDER === 'ses' && (!env.SES_ACCESS_KEY_ID || !env.SES_SECRET_ACCESS_KEY)) {
    console.warn('⚠️ SES email provider selected but SES credentials are incomplete');
  }
}

// Validate required combinations of environment variables
function validateRequiredCombinations(env: EnvConfig): void {
  // If Stripe is configured, all Stripe variables should be present
  if (env.STRIPE_SECRET_KEY && (!env.STRIPE_PUBLISHABLE_KEY || !env.STRIPE_WEBHOOK_SECRET)) {
    console.warn('⚠️ Stripe secret key provided but other Stripe configuration is incomplete');
  }

  // If Google OAuth is configured, both client ID and secret should be present
  if (env.GOOGLE_CLIENT_ID && !env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Google Client ID provided but Google Client Secret is missing');
  }

  // If encryption is enabled, encryption key should be provided
  if (env.ENABLE_FILE_ENCRYPTION === 'true' && !env.ENCRYPTION_KEY) {
    console.warn('⚠️ File encryption enabled but no encryption key provided');
  }

  // Production-specific validations
  if (env.NODE_ENV === 'production') {
    if (!env.NEXTAUTH_URL) {
      throw new Error('NEXTAUTH_URL is required in production');
    }

    if (env.NEXTAUTH_SECRET.length < 32) {
      throw new Error('NEXTAUTH_SECRET should be at least 32 characters in production');
    }
  }
}

// Export parsed and validated environment variables
export const env = validateEnv();

// Helper functions for checking feature flags
export const isFeatureEnabled = {
  registration: () => env.ENABLE_REGISTRATION === 'true',
  emailVerification: () => env.ENABLE_EMAIL_VERIFICATION === 'true',
  fileSharing: () => env.ENABLE_FILE_SHARING === 'true',
  publicSharing: () => env.ENABLE_PUBLIC_SHARING === 'true',
  fileVersioning: () => env.ENABLE_FILE_VERSIONING === 'true',
  trash: () => env.ENABLE_TRASH === 'true',
  compression: () => env.ENABLE_FILE_COMPRESSION === 'true',
  encryption: () => env.ENABLE_FILE_ENCRYPTION === 'true',
  analytics: () => env.ENABLE_ANALYTICS === 'true',
  redis: () => env.ENABLE_REDIS === 'true',
  backup: () => env.BACKUP_ENABLED === 'true',
  debugMode: () => env.DEBUG_MODE === 'true',
  mockEmail: () => env.MOCK_EMAIL === 'true',
  mockPayment: () => env.MOCK_PAYMENT === 'true',
};

// Helper function to get provider configurations
export const getProviderConfig = {
  storage: () => ({
    default: env.DEFAULT_STORAGE_PROVIDER,
    fallback: env.FALLBACK_STORAGE_PROVIDER,
  }),
  email: () => ({
    default: env.DEFAULT_EMAIL_PROVIDER,
    fallback: env.FALLBACK_EMAIL_PROVIDER,
  }),
};

export default env;