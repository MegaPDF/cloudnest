import { 
  PaginationResult, 
  UploadProgress, 
  ErrorDetails 
} from '@/types/common';
import { User } from '@/types/user';
import { File, FileUploadResult } from '@/types/file';
import { Folder } from '@/types/folder';
import { Share } from '@/types/sharing';
import { Subscription, Invoice } from '@/types/subscription';

/**
 * Base API Response structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
  meta?: ApiMeta;
}

/**
 * API Error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

/**
 * API Response metadata
 */
export interface ApiMeta {
  pagination?: PaginationResult<any>['pagination'];
  timestamp: Date;
  version: string;
  requestId: string;
  executionTime?: number;
}

/**
 * API Request structure
 */
export interface ApiRequest<T = any> {
  body?: T;
  query?: Record<string, string | string[]>;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  user?: User;
  files?: File[];
}

/**
 * Authentication API Types
 */
export interface LoginRequest {
  email: string;
  password: string;
  remember?: boolean;
}

export interface LoginResponse {
  user: User;
  token: string;
  expiresAt: Date;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export interface RegisterResponse {
  user: User;
  verificationRequired: boolean;
  message: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

/**
 * File API Types
 */
export interface FileListRequest {
  folderId?: string;
  category?: string;
  mimeType?: string;
  tags?: string[];
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  includeDeleted?: boolean;
}

export interface FileListResponse {
  files: File[];
  pagination: PaginationResult<File>['pagination'];
  stats: {
    totalFiles: number;
    totalSize: number;
    categories: Record<string, number>;
  };
}

export interface FileUploadRequest {
  files: File[];
  folderId?: string;
  description?: string;
  tags?: string[];
  isPublic?: boolean;
  replaceExisting?: boolean;
}

export interface FileUploadResponse {
  files: FileUploadResult[];
  failed: FileUploadError[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalSize: number;
  };
}

export interface FileUploadError {
  filename: string;
  error: string;
  code: string;
}

export interface FileMoveRequest {
  fileIds: string[];
  targetFolderId?: string;
}

export interface FileCopyRequest {
  fileIds: string[];
  targetFolderId?: string;
  namePattern?: string;
}

export interface FileDeleteRequest {
  fileIds: string[];
  permanent?: boolean;
}

export interface FileRestoreRequest {
  fileIds: string[];
}

export interface FileSearchRequest {
  query: string;
  category?: string;
  mimeType?: string;
  sizeMin?: number;
  sizeMax?: number;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  tags?: string[];
  folderId?: string;
  page?: number;
  limit?: number;
}

export interface FileSearchResponse {
  files: File[];
  folders: Folder[];
  total: number;
  suggestions: string[];
  facets: SearchFacet[];
  took: number;
}

export interface SearchFacet {
  field: string;
  values: SearchFacetValue[];
}

export interface SearchFacetValue {
  value: string;
  count: number;
  selected: boolean;
}

/**
 * Folder API Types
 */
export interface FolderListRequest {
  parentId?: string;
  includeFiles?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  includeDeleted?: boolean;
}

export interface FolderListResponse {
  folders: Folder[];
  pagination: PaginationResult<Folder>['pagination'];
  breadcrumbs: Array<{
    id: string;
    name: string;
    path: string;
  }>;
}

export interface FolderCreateRequest {
  name: string;
  parentId?: string;
  description?: string;
  color?: string;
}

export interface FolderUpdateRequest {
  name?: string;
  description?: string;
  color?: string;
}

export interface FolderMoveRequest {
  folderIds: string[];
  targetParentId?: string;
}

/**
 * Sharing API Types
 */
export interface ShareCreateRequest {
  type: 'file' | 'folder';
  resourceId: string;
  permissions?: {
    canView?: boolean;
    canDownload?: boolean;
    canEdit?: boolean;
    canShare?: boolean;
    canComment?: boolean;
  };
  access?: {
    type?: 'public' | 'restricted' | 'password';
    password?: string;
    allowedEmails?: string[];
    domains?: string[];
  };
  settings?: {
    expiresAt?: Date;
    downloadLimit?: number;
    viewLimit?: number;
    requireSignIn?: boolean;
    allowComments?: boolean;
    customMessage?: string;
  };
}

export interface ShareResponse {
  share: Share;
  url: string;
  qrCode?: string;
}

export interface ShareListRequest {
  type?: 'file' | 'folder';
  status?: 'active' | 'expired' | 'disabled';
  page?: number;
  limit?: number;
}

export interface ShareAccessRequest {
  password?: string;
  userAgent?: string;
  ip?: string;
}

/**
 * User API Types
 */
export interface UserProfileUpdateRequest {
  name?: string;
  avatar?: string;
  bio?: string;
  website?: string;
  location?: string;
}

export interface UserPreferencesUpdateRequest {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  currency?: string;
  timezone?: string;
  notifications?: {
    email?: boolean;
    sharing?: boolean;
    storage?: boolean;
  };
  defaultView?: 'grid' | 'list';
  itemsPerPage?: number;
}

export interface UserStorageResponse {
  used: number;
  limit: number;
  percentage: number;
  breakdown: {
    images: number;
    videos: number;
    documents: number;
    other: number;
  };
  recentActivity: Array<{
    action: string;
    size: number;
    timestamp: Date;
  }>;
}

/**
 * Admin API Types
 */
export interface AdminStatsResponse {
  users: {
    total: number;
    active: number;
    newThisMonth: number;
    growthRate: number;
  };
  files: {
    total: number;
    totalSize: number;
    newThisMonth: number;
    storageGrowthRate: number;
  };
  subscriptions: {
    total: number;
    active: number;
    revenue: number;
    churnRate: number;
  };
  shares: {
    total: number;
    active: number;
    views: number;
    downloads: number;
  };
}

export interface AdminUserListRequest {
  search?: string;
  role?: 'user' | 'admin';
  subscription?: 'free' | 'pro' | 'enterprise';
  status?: 'active' | 'inactive';
  provider?: 'email' | 'google';
  verified?: boolean;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AdminUserUpdateRequest {
  name?: string;
  email?: string;
  role?: 'user' | 'admin';
  isActive?: boolean;
  isVerified?: boolean;
  subscription?: {
    plan?: 'free' | 'pro' | 'enterprise';
    status?: 'active' | 'canceled' | 'past_due' | 'trialing';
  };
  storage?: {
    limit?: number;
  };
}

export interface AdminBulkActionRequest {
  action: 'activate' | 'deactivate' | 'delete' | 'verify' | 'unverify' | 'reset_password';
  userIds: string[];
  options?: {
    sendNotification?: boolean;
    reason?: string;
    newPassword?: string;
  };
}

export interface AdminAnalyticsRequest {
  metrics: ('users' | 'files' | 'storage' | 'shares' | 'downloads')[];
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  groupBy?: 'hour' | 'day' | 'week' | 'month';
  filters?: {
    userId?: string;
    provider?: string;
    fileType?: string;
  };
}

export interface AdminAnalyticsResponse {
  metrics: Array<{
    name: string;
    data: Array<{
      timestamp: Date;
      value: number;
    }>;
  }>;
  summary: Record<string, number>;
  comparisons: Record<string, {
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  }>;
}

/**
 * Payment API Types
 */
export interface SubscriptionCreateRequest {
  planId: string;
  paymentMethodId?: string;
  couponCode?: string;
  billingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
}

export interface SubscriptionResponse {
  subscription: Subscription;
  invoice?: Invoice;
  paymentIntent?: {
    clientSecret: string;
    status: string;
  };
}

export interface PaymentMethodResponse {
  id: string;
  type: 'card' | 'bank_account';
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
}

/**
 * Storage API Types
 */
export interface StorageUsageResponse {
  total: number;
  used: number;
  available: number;
  percentage: number;
  breakdown: {
    files: number;
    versions: number;
    thumbnails: number;
    temporary: number;
  };
  providers: Array<{
    name: string;
    type: string;
    usage: number;
    isHealthy: boolean;
  }>;
}

export interface StorageConfigRequest {
  provider: 'aws' | 'cloudflare' | 'wasabi' | 'gridfs';
  name: string;
  config: {
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
    bucket?: string;
    endpoint?: string;
    accountId?: string;
    database?: string;
  };
  settings?: {
    maxFileSize?: number;
    enableCompression?: boolean;
    enableEncryption?: boolean;
    enableVersioning?: boolean;
  };
  isDefault?: boolean;
}

export interface StorageTestRequest {
  configId?: string;
  config?: StorageConfigRequest;
}

export interface StorageTestResponse {
  success: boolean;
  latency: number;
  error?: string;
  details: {
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
    version?: string;
  };
}

/**
 * Email API Types
 */
export interface EmailSendRequest {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  variables?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

export interface EmailTemplateRequest {
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables?: Array<{
    name: string;
    description: string;
    required: boolean;
    defaultValue?: string;
  }>;
}

export interface EmailConfigRequest {
  provider: 'smtp' | 'sendgrid' | 'mailgun' | 'ses';
  name: string;
  config: {
    host?: string;
    port?: number;
    secure?: boolean;
    username?: string;
    password?: string;
    apiKey?: string;
    domain?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  settings: {
    fromEmail: string;
    fromName: string;
    replyTo?: string;
    enableTracking?: boolean;
  };
  isDefault?: boolean;
}

export interface EmailTestRequest {
  configId?: string;
  config?: EmailConfigRequest;
  toEmail: string;
  subject?: string;
  content?: string;
}

/**
 * Health Check Types
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  version: string;
  timestamp: Date;
  uptime: number;
  services: {
    database: ServiceHealth;
    storage: ServiceHealth;
    email: ServiceHealth;
    cache?: ServiceHealth;
  };
  metrics?: {
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency: number;
  lastCheck: Date;
  error?: string;
}

/**
 * Webhook Types
 */
export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  source: 'stripe' | 'internal';
  signature?: string;
}

/**
 * Batch Operation Types
 */
export interface BatchOperation<T> {
  action: string;
  items: T[];
  options?: Record<string, any>;
}

export interface BatchOperationResult<T> {
  successful: T[];
  failed: BatchOperationError<T>[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    duration: number;
  };
}

export interface BatchOperationError<T> {
  item: T;
  error: string;
  code: string;
}

/**
 * Upload Progress Types
 */
export interface UploadProgressEvent {
  fileId: string;
  filename: string;
  progress: UploadProgress;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
}

/**
 * Rate Limiting Types
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

/**
 * Utility types for API operations
 */
export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiEndpoint = string;

export type QueryParams = Record<string, string | number | boolean | undefined>;

export type PathParams = Record<string, string>;

export type RequestBody = any;

export type ResponseData<T> = T extends undefined ? void : T;

/**
 * Generic API operation type
 */
export interface ApiOperation<TRequest = any, TResponse = any> {
  method: ApiMethod;
  endpoint: ApiEndpoint;
  request?: TRequest;
  response: ApiResponse<TResponse>;
}