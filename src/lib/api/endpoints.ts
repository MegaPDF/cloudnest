/**
 * API Endpoints Configuration
 * Centralized endpoint definitions matching the API route structure
 */

export const API_ENDPOINTS = {
  // Authentication endpoints
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    VERIFY_EMAIL: '/auth/verify-email',
    REFRESH_TOKEN: '/auth/refresh-token',
  },

  // User endpoints
  USERS: {
    PROFILE: '/users/profile',
    PREFERENCES: '/users/preferences',
    STORAGE_USAGE: '/users/:userId/storage-usage',
    SUBSCRIPTION: '/users/:userId/subscription',
    LIST: '/users',
    GET: '/users/:userId',
    UPDATE: '/users/:userId',
    DELETE: '/users/:userId',
  },

  // File endpoints
  FILES: {
    LIST: '/files',
    UPLOAD: '/files/upload',
    GET: '/files/:fileId',
    UPDATE: '/files/:fileId',
    DELETE: '/files/:fileId',
    DOWNLOAD: '/files/download/:fileId',
    PREVIEW: '/files/preview/:fileId',
    THUMBNAIL: '/files/thumbnail/:fileId',
    MOVE: '/files/move',
    COPY: '/files/copy',
    RESTORE: '/files/restore',
    SEARCH: '/files/search',
    VERSIONS: '/files/:fileId/versions',
    PERMISSIONS: '/files/:fileId/permissions',
    SHARE: '/files/share',
    BULK_DELETE: '/files/delete',
    RECENT: '/files/recent',
    SHARED: '/files/shared',
    TRASH: '/files/trash',
  },

  // Folder endpoints
  FOLDERS: {
    LIST: '/folders',
    CREATE: '/folders/create',
    GET: '/folders/:folderId',
    UPDATE: '/folders/:folderId',
    DELETE: '/folders/:folderId',
    MOVE: '/folders/move',
    COPY: '/folders/copy',
    RESTORE: '/folders/restore',
    PERMISSIONS: '/folders/:folderId/permissions',
    SHARE: '/folders/:folderId/share',
    BULK_DELETE: '/folders/delete',
    RENAME: '/folders/rename',
  },

  // Sharing endpoints
  SHARES: {
    CREATE: '/shares',
    LIST: '/shares',
    GET: '/shares/:shareId',
    UPDATE: '/shares/:shareId',
    DELETE: '/shares/:shareId',
    PUBLIC: '/shared/:shareId',
    VERIFY_PASSWORD: '/shares/:shareId/verify-password',
    ACCESS_LOG: '/shares/:shareId/access',
    BULK_ACTION: '/shares/bulk-action',
  },

  // Admin endpoints
  ADMIN: {
    DASHBOARD: '/admin',
    STATS: '/admin/stats',
    ANALYTICS: '/admin/analytics',
    
    // User management
    USERS: '/admin/users',
    USER: '/admin/users/:userId',
    USER_BULK_ACTION: '/admin/users/bulk-action',
    USER_INVITE: '/admin/users/invite',
    
    // System settings
    SYSTEM_SETTINGS: '/admin/system/settings',
    EMAIL_CONFIG: '/admin/system/email-config',
    STORAGE_CONFIG: '/admin/system/storage-config',
    PRICING_CONFIG: '/admin/pricing',
    
    // Health and monitoring
    HEALTH_CHECK: '/admin/health',
    SYSTEM_HEALTH: '/admin/system/health',
    
    // Testing
    EMAIL_TEST: '/admin/email/test',
    STORAGE_TEST: '/admin/storage/test-connection',
    
    // Audit logs
    AUDIT_LOGS: '/admin/audit-logs',
    
    // System alerts
    ALERTS: '/admin/alerts',
    ALERT_ACKNOWLEDGE: '/admin/alerts/acknowledge',
    
    // Maintenance
    MAINTENANCE: '/admin/maintenance',
    BACKUP: '/admin/backup',
    
    // Analytics
    USER_ANALYTICS: '/admin/analytics/users',
    FILE_ANALYTICS: '/admin/analytics/files',
    STORAGE_ANALYTICS: '/admin/analytics/storage',
    REVENUE_ANALYTICS: '/admin/analytics/revenue',
  },

  // Payment endpoints
  PAYMENTS: {
    CREATE_SUBSCRIPTION: '/payments/create-subscription',
    CANCEL_SUBSCRIPTION: '/payments/cancel-subscription',
    PORTAL: '/payments/portal',
    WEBHOOK: '/payments/webhook',
    INVOICES: '/payments/invoices',
    PAYMENT_METHODS: '/payments/payment-methods',
    BILLING_INFO: '/payments/billing-info',
  },

  // Storage endpoints
  STORAGE: {
    USAGE: '/storage/usage',
    CONFIG: '/storage/config',
    TEST_CONNECTION: '/storage/test-connection',
    PROVIDERS: '/storage/providers',
    CLEANUP: '/storage/cleanup',
    MIGRATION: '/storage/migration',
  },

  // Email endpoints
  EMAIL: {
    SEND: '/email/send',
    TEMPLATES: '/email/templates',
    TEST: '/email/test',
    CONFIG: '/email/config',
    QUEUE: '/email/queue',
    STATS: '/email/stats',
  },

  // Search endpoints
  SEARCH: {
    GLOBAL: '/search',
    FILES: '/search/files',
    FOLDERS: '/search/folders',
    USERS: '/search/users',
    SUGGESTIONS: '/search/suggestions',
  },

  // Public endpoints (no auth required)
  PUBLIC: {
    HEALTH: '/health',
    ABOUT: '/about',
    PRICING: '/pricing',
    SHARED_FILE: '/public/shared/:shareId',
    PREVIEW: '/public/preview/:shareId',
    DOWNLOAD: '/public/download/:shareId',
  },

  // Health check
  HEALTH: '/health',
} as const;

/**
 * API endpoint utilities
 */
export class EndpointUtils {
  /**
   * Replace path parameters with actual values
   */
  static buildPath(endpoint: string, params: Record<string, string>): string {
    let path = endpoint;
    
    Object.entries(params).forEach(([key, value]) => {
      path = path.replace(`:${key}`, encodeURIComponent(value));
    });
    
    return path;
  }

  /**
   * Build URL with query parameters
   */
  static buildUrl(endpoint: string, queryParams?: Record<string, any>): string {
    if (!queryParams || Object.keys(queryParams).length === 0) {
      return endpoint;
    }

    const searchParams = new URLSearchParams();
    
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, String(v)));
        } else {
          searchParams.append(key, String(value));
        }
      }
    });

    const queryString = searchParams.toString();
    return queryString ? `${endpoint}?${queryString}` : endpoint;
  }

  /**
   * Check if endpoint is public (doesn't require authentication)
   */
  static isPublicEndpoint(endpoint: string): boolean {
    const publicPrefixes = [
      '/health',
      '/public/',
      '/shared/',
      '/auth/',
      '/payments/webhook'
    ];

    return publicPrefixes.some(prefix => endpoint.startsWith(prefix));
  }

  /**
   * Check if endpoint is admin-only
   */
  static isAdminEndpoint(endpoint: string): boolean {
    return endpoint.startsWith('/admin/');
  }

  /**
   * Get all endpoints as flat array
   */
  static getAllEndpoints(): string[] {
    const endpoints: string[] = [];
    
    const flatten = (obj: any, prefix = '') => {
      Object.entries(obj).forEach(([key, value]) => {
        if (typeof value === 'string') {
          endpoints.push(value);
        } else if (typeof value === 'object') {
          flatten(value, `${prefix}${key}.`);
        }
      });
    };

    flatten(API_ENDPOINTS);
    return endpoints;
  }

  /**
   * Validate endpoint format
   */
  static validateEndpoint(endpoint: string): boolean {
    // Check if endpoint starts with /
    if (!endpoint.startsWith('/')) {
      return false;
    }

    // Check for valid characters (alphanumeric, hyphens, underscores, colons for params)
    const validPattern = /^\/[a-zA-Z0-9\-_\/:]*$/;
    return validPattern.test(endpoint);
  }

  /**
   * Extract path parameters from endpoint
   */
  static extractPathParams(endpoint: string): string[] {
    const matches = endpoint.match(/:([a-zA-Z0-9_]+)/g);
    return matches ? matches.map(match => match.substring(1)) : [];
  }

  /**
   * Get endpoint category
   */
  static getEndpointCategory(endpoint: string): string {
    const segments = endpoint.split('/').filter(Boolean);
    if (segments.length === 0) return 'root';
    
    const firstSegment = segments[0];
    
    // Map common prefixes to categories
    const categoryMap: Record<string, string> = {
      'auth': 'authentication',
      'users': 'user_management',
      'files': 'file_management',
      'folders': 'folder_management',
      'shares': 'sharing',
      'admin': 'administration',
      'payments': 'billing',
      'storage': 'storage',
      'email': 'messaging',
      'search': 'search',
      'public': 'public',
      'health': 'monitoring'
    };

    return categoryMap[firstSegment] || 'miscellaneous';
  }

  /**
   * Get HTTP methods typically used for endpoint
   */
  static getTypicalMethods(endpoint: string): string[] {
    if (endpoint.includes('upload') || endpoint.includes('create')) {
      return ['POST'];
    }
    
    if (endpoint.includes('download') || endpoint.includes('list') || endpoint.includes('get')) {
      return ['GET'];
    }
    
    if (endpoint.includes('update') || endpoint.includes('move') || endpoint.includes('restore')) {
      return ['PATCH', 'PUT'];
    }
    
    if (endpoint.includes('delete')) {
      return ['DELETE'];
    }

    // Generic endpoints that might support multiple methods
    if (endpoint.match(/\/[^\/]+\/:[a-zA-Z]+$/)) {
      return ['GET', 'PATCH', 'DELETE'];
    }

    return ['GET', 'POST'];
  }
}

/**
 * Type-safe endpoint building
 */
type ExtractEndpointStrings<T> =
  T extends string ? T :
  T extends Record<string, any> ? { [K in keyof T]: ExtractEndpointStrings<T[K]> }[keyof T] :
  never;

export type EndpointPath = ExtractEndpointStrings<typeof API_ENDPOINTS> | string;

export interface EndpointOptions {
  pathParams?: Record<string, string>;
  queryParams?: Record<string, any>;
}

export function buildEndpoint(
  endpoint: EndpointPath,
  options: EndpointOptions = {}
): string {
  let path = endpoint;
  
  // Replace path parameters
  if (options.pathParams) {
    path = EndpointUtils.buildPath(path, options.pathParams);
  }
  
  // Add query parameters
  if (options.queryParams) {
    path = EndpointUtils.buildUrl(path, options.queryParams);
  }
  
  return path;
}

/**
 * Export commonly used endpoint groups for convenience
 */
export const {
  AUTH,
  USERS,
  FILES,
  FOLDERS,
  SHARES,
  ADMIN,
  PAYMENTS,
  STORAGE,
  EMAIL,
  SEARCH,
  PUBLIC,
  HEALTH
} = API_ENDPOINTS;