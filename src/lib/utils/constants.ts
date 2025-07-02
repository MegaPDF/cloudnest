import { SupportedLanguage, SupportedCurrency } from '../i18n/config';

// App Constants
export const APP_CONFIG = {
  NAME: 'CloudNest',
  VERSION: '1.0.0',
  DESCRIPTION: 'Secure cloud storage and file management',
  AUTHOR: 'CloudNest Team',
  WEBSITE: 'https://cloudnest.com',
  SUPPORT_EMAIL: 'support@cloudnest.com'
} as const;

// Default Storage Limits (in bytes)
export const STORAGE_LIMITS = {
  FREE: 5 * 1024 * 1024 * 1024,        // 5GB
  PRO: 100 * 1024 * 1024 * 1024,       // 100GB
  ENTERPRISE: 1024 * 1024 * 1024 * 1024 // 1TB
} as const;

// File Upload Limits
export const FILE_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024,     // 100MB default
  MAX_FILES_PER_UPLOAD: 50,
  MAX_FOLDER_DEPTH: 10,
  MAX_FILENAME_LENGTH: 255,
  MAX_PATH_LENGTH: 1000,
  CHUNK_SIZE: 5 * 1024 * 1024,          // 5MB chunks
  MAX_VERSIONS_PER_FILE: 10
} as const;

// Share Limits
export const SHARE_LIMITS = {
  MAX_SHARES_PER_USER: 100,
  MAX_SHARE_RECIPIENTS: 50,
  MAX_SHARE_VIEWS: 100000,
  MAX_SHARE_DOWNLOADS: 10000,
  MAX_SHARE_EXPIRY_DAYS: 365,
  MAX_PASSWORD_ATTEMPTS: 3
} as const;

// User Limits
export const USER_LIMITS = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000,     // 15 minutes
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
  PASSWORD_MIN_LENGTH: 6,
  PASSWORD_MAX_LENGTH: 128,
  MAX_TAGS_PER_FILE: 10,
  MAX_TAG_LENGTH: 50
} as const;

// System Constants
export const SYSTEM_CONFIG = {
  DEFAULT_LANGUAGE: 'en' as SupportedLanguage,
  DEFAULT_CURRENCY: 'USD' as SupportedCurrency,
  DEFAULT_TIMEZONE: 'UTC',
  DEFAULT_THEME: 'system',
  DEFAULT_VIEW: 'grid',
  ITEMS_PER_PAGE: 20,
  MAX_SEARCH_RESULTS: 1000
} as const;

// File Categories (matches File model virtual)
export const FILE_CATEGORIES = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  PDF: 'pdf',
  TEXT: 'text',
  ARCHIVE: 'archive',
  OTHER: 'other'
} as const;

// Storage Providers (matches model enums)
export const STORAGE_PROVIDERS = {
  AWS: 'aws',
  CLOUDFLARE: 'cloudflare',
  WASABI: 'wasabi',
  GRIDFS: 'gridfs'
} as const;

// Email Providers (matches model enums)
export const EMAIL_PROVIDERS = {
  SMTP: 'smtp',
  SENDGRID: 'sendgrid',
  MAILGUN: 'mailgun',
  SES: 'ses'
} as const;

// User Roles (matches model enums)
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin'
} as const;

// Subscription Plans (matches model enums)
export const SUBSCRIPTION_PLANS = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise'
} as const;

// Subscription Status (matches model enums)
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  PAST_DUE: 'past_due',
  TRIALING: 'trialing'
} as const;

// File Extensions by Category
export const FILE_EXTENSIONS = {
  IMAGE: ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico'],
  VIDEO: ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'],
  AUDIO: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'],
  PDF: ['.pdf'],
  TEXT: ['.txt', '.md', '.rtf', '.csv', '.json', '.xml', '.html', '.css', '.js', '.ts'],
  ARCHIVE: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'],
  DOCUMENT: ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp']
} as const;

// Regular Expressions
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_STRONG: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  FILENAME_INVALID: /[<>:"/\\|?*]/,
  OBJECTID: /^[0-9a-fA-F]{24}$/,
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  IPV4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

// API Rate Limits
export const RATE_LIMITS = {
  AUTH: { requests: 5, window: 60 },      // 5 attempts per minute
  UPLOAD: { requests: 10, window: 60 },   // 10 uploads per minute
  DOWNLOAD: { requests: 50, window: 60 }, // 50 downloads per minute
  API: { requests: 100, window: 60 },     // 100 API calls per minute
  SHARE: { requests: 20, window: 60 }     // 20 shares per minute
} as const;

// Cache TTL (Time To Live) in seconds
export const CACHE_TTL = {
  SHORT: 300,      // 5 minutes
  MEDIUM: 1800,    // 30 minutes
  LONG: 3600,      // 1 hour
  VERY_LONG: 86400 // 24 hours
} as const;

// Error Codes
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  SHARE_EXPIRED: 'SHARE_EXPIRED',
  SHARE_LIMIT_EXCEEDED: 'SHARE_LIMIT_EXCEEDED',
  EMAIL_ERROR: 'EMAIL_ERROR',
  PAYMENT_ERROR: 'PAYMENT_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;