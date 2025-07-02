
import { ApiError } from '@/types/api';
import { HTTP_STATUS, ERROR_CODES } from '../utils/constants';

/**
 * Custom API Error classes
 */
export class BaseApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();

    // Maintain proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): ApiError {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    };
  }
}

export class ValidationError extends BaseApiError {
  constructor(message: string, code: string = ERROR_CODES.VALIDATION_ERROR, statusCode: number = HTTP_STATUS.UNPROCESSABLE_ENTITY, details?: Record<string, any>) {
    super(message, code, statusCode, details);
  }
}

export class AuthenticationError extends BaseApiError {
  constructor(message: string = 'Authentication required', code: string = ERROR_CODES.AUTHENTICATION_ERROR, statusCode: number = HTTP_STATUS.UNAUTHORIZED, details?: Record<string, any>) {
    super(message, code, statusCode, details);
  }
}

export class AuthorizationError extends BaseApiError {
  constructor(message: string = 'Insufficient permissions', code: string = ERROR_CODES.AUTHORIZATION_ERROR, statusCode: number = HTTP_STATUS.FORBIDDEN, details?: Record<string, any>) {
    super(message, code, statusCode, details);
  }
}

export class NotFoundError extends BaseApiError {
  constructor(message: string = 'Resource not found', code: string = ERROR_CODES.NOT_FOUND_ERROR, statusCode: number = HTTP_STATUS.NOT_FOUND, details?: Record<string, any>) {
    super(message, code, statusCode, details);
  }
}

export class ConflictError extends BaseApiError {
  constructor(message: string = 'Resource conflict', code: string = ERROR_CODES.DUPLICATE_ERROR, statusCode: number = HTTP_STATUS.CONFLICT, details?: Record<string, any>) {
    super(message, code, statusCode, details);
  }
}

export class StorageError extends BaseApiError {
  constructor(message: string, code: string = ERROR_CODES.STORAGE_ERROR, statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR, details?: Record<string, any>) {
    super(message, code, statusCode, details);
  }
}

export class QuotaExceededError extends BaseApiError {
  constructor(message: string = 'Storage quota exceeded', code: string = ERROR_CODES.QUOTA_EXCEEDED, statusCode: number = HTTP_STATUS.UNPROCESSABLE_ENTITY, details?: Record<string, any>) {
    super(message, code, statusCode, details);
  }
}

export class FileTooLargeError extends BaseApiError {
  constructor(message: string = 'File too large', code: string = ERROR_CODES.FILE_TOO_LARGE, statusCode: number = HTTP_STATUS.UNPROCESSABLE_ENTITY, details?: Record<string, any>) {
    super(message, code, statusCode, details);
  }
}

export class InvalidFileTypeError extends BaseApiError {
  constructor(message: string = 'Invalid file type', code: string = ERROR_CODES.INVALID_FILE_TYPE, statusCode: number = HTTP_STATUS.UNPROCESSABLE_ENTITY, details?: Record<string, any>) {
    super(message, code, statusCode, details);
  }
}

export class ShareExpiredError extends BaseApiError {
  constructor(message: string = 'Share link has expired', code: string = ERROR_CODES.SHARE_EXPIRED, statusCode: number = 410, details?: Record<string, any>) {
    super(message, code, statusCode, details);
  }
}

export class RateLimitError extends BaseApiError {
  constructor(message: string = 'Rate limit exceeded', code: string = ERROR_CODES.RATE_LIMIT_ERROR, statusCode: number = HTTP_STATUS.TOO_MANY_REQUESTS, details?: Record<string, any>) {
    super(message, code, statusCode, details);
  }
}

export class PaymentError extends BaseApiError {
  constructor(message: string, code: string = ERROR_CODES.PAYMENT_ERROR, statusCode: number = HTTP_STATUS.UNPROCESSABLE_ENTITY, details?: Record<string, any>) {
    super(message, code, statusCode, details);
  }
}

export class EmailError extends BaseApiError {
  constructor(message: string, code: string = ERROR_CODES.EMAIL_ERROR, statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR, details?: Record<string, any>) {
    super(message, code, statusCode, details);
  }
}

/**
 * API Error Handler class
 */
export class ApiErrorHandler {
  private readonly errorMap: Map<string, typeof BaseApiError>;

  constructor() {
    this.errorMap = new Map([
      [ERROR_CODES.VALIDATION_ERROR, ValidationError],
      [ERROR_CODES.AUTHENTICATION_ERROR, AuthenticationError],
      [ERROR_CODES.AUTHORIZATION_ERROR, AuthorizationError],
      [ERROR_CODES.NOT_FOUND_ERROR, NotFoundError],
      [ERROR_CODES.DUPLICATE_ERROR, ConflictError],
      [ERROR_CODES.STORAGE_ERROR, StorageError],
      [ERROR_CODES.QUOTA_EXCEEDED, QuotaExceededError],
      [ERROR_CODES.FILE_TOO_LARGE, FileTooLargeError],
      [ERROR_CODES.INVALID_FILE_TYPE, InvalidFileTypeError],
      [ERROR_CODES.SHARE_EXPIRED, ShareExpiredError],
      [ERROR_CODES.RATE_LIMIT_ERROR, RateLimitError],
      [ERROR_CODES.PAYMENT_ERROR, PaymentError],
      [ERROR_CODES.EMAIL_ERROR, EmailError],
    ]);
  }

  /**
   * Create error from HTTP response
   */
  createError(statusCode: number, response?: any): BaseApiError {
    const message = response?.message || response?.error?.message || this.getDefaultMessage(statusCode);
    const code = response?.error?.code || this.getDefaultCode(statusCode);
    const details = response?.error?.details || response?.details;

    const ErrorClass = this.errorMap.get(code) || BaseApiError;
    return new ErrorClass(message, code, statusCode, details);
  }

  /**
   * Handle different types of errors
   */
  handleError(error: any): BaseApiError {
    // Already a BaseApiError
    if (error instanceof BaseApiError) {
      return error;
    }

    // Fetch/Network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return new BaseApiError(
        'Network error - please check your connection',
        'NETWORK_ERROR',
        0,
        { originalError: error.message }
      );
    }

    // Abort errors
    if (error.name === 'AbortError') {
      return new BaseApiError(
        'Request was cancelled',
        'REQUEST_CANCELLED',
        0,
        { originalError: error.message }
      );
    }

    // Timeout errors
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return new BaseApiError(
        'Request timed out',
        'REQUEST_TIMEOUT',
        408,
        { originalError: error.message }
      );
    }

    // JSON parsing errors
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return new BaseApiError(
        'Invalid response format',
        'INVALID_RESPONSE',
        500,
        { originalError: error.message }
      );
    }

    // Generic error
    return new BaseApiError(
      error.message || 'An unexpected error occurred',
      'UNKNOWN_ERROR',
      500,
      { originalError: error.message }
    );
  }

  /**
   * Format error for display
   */
  formatError(error: BaseApiError): string {
    switch (error.code) {
      case ERROR_CODES.VALIDATION_ERROR:
        return this.formatValidationError(error);
      
      case ERROR_CODES.AUTHENTICATION_ERROR:
        return 'Please sign in to continue';
      
      case ERROR_CODES.AUTHORIZATION_ERROR:
        return 'You don\'t have permission to perform this action';
      
      case ERROR_CODES.NOT_FOUND_ERROR:
        return 'The requested item could not be found';
      
      case ERROR_CODES.QUOTA_EXCEEDED:
        return 'Storage quota exceeded. Please upgrade your plan or free up space';
      
      case ERROR_CODES.FILE_TOO_LARGE:
        return 'File is too large. Please choose a smaller file';
      
      case ERROR_CODES.INVALID_FILE_TYPE:
        return 'File type not supported. Please choose a different file';
      
      case ERROR_CODES.SHARE_EXPIRED:
        return 'This share link has expired or is no longer available';
      
      case ERROR_CODES.RATE_LIMIT_ERROR:
        return 'Too many requests. Please wait a moment and try again';
      
      case 'NETWORK_ERROR':
        return 'Connection failed. Please check your internet connection';
      
      case 'REQUEST_TIMEOUT':
        return 'Request timed out. Please try again';
      
      default:
        return error.message || 'An unexpected error occurred';
    }
  }

  /**
   * Format validation error with field details
   */
  private formatValidationError(error: BaseApiError): string {
    if (!error.details?.fields) {
      return error.message;
    }

    const fieldErrors = Object.entries(error.details.fields as Record<string, string[]>)
      .map(([field, messages]) => `${field}: ${(messages as string[]).join(', ')}`)
      .join('; ');

    return fieldErrors || error.message;
  }

  /**
   * Get default message for HTTP status code
   */
  private getDefaultMessage(statusCode: number): string {
    switch (statusCode) {
      case HTTP_STATUS.BAD_REQUEST:
        return 'Invalid request';
      case HTTP_STATUS.UNAUTHORIZED:
        return 'Authentication required';
      case HTTP_STATUS.FORBIDDEN:
        return 'Access forbidden';
      case HTTP_STATUS.NOT_FOUND:
        return 'Resource not found';
      case HTTP_STATUS.CONFLICT:
        return 'Resource conflict';
      case HTTP_STATUS.UNPROCESSABLE_ENTITY:
        return 'Validation failed';
      case HTTP_STATUS.TOO_MANY_REQUESTS:
        return 'Rate limit exceeded';
      case HTTP_STATUS.INTERNAL_SERVER_ERROR:
        return 'Internal server error';
      case HTTP_STATUS.SERVICE_UNAVAILABLE:
        return 'Service temporarily unavailable';
      default:
        return 'An error occurred';
    }
  }

  /**
   * Get default error code for HTTP status code
   */
  private getDefaultCode(statusCode: number): string {
    switch (statusCode) {
      case HTTP_STATUS.BAD_REQUEST:
        return ERROR_CODES.VALIDATION_ERROR;
      case HTTP_STATUS.UNAUTHORIZED:
        return ERROR_CODES.AUTHENTICATION_ERROR;
      case HTTP_STATUS.FORBIDDEN:
        return ERROR_CODES.AUTHORIZATION_ERROR;
      case HTTP_STATUS.NOT_FOUND:
        return ERROR_CODES.NOT_FOUND_ERROR;
      case HTTP_STATUS.CONFLICT:
        return ERROR_CODES.DUPLICATE_ERROR;
      case HTTP_STATUS.UNPROCESSABLE_ENTITY:
        return ERROR_CODES.VALIDATION_ERROR;
      case HTTP_STATUS.TOO_MANY_REQUESTS:
        return ERROR_CODES.RATE_LIMIT_ERROR;
      default:
        return 'UNKNOWN_ERROR';
    }
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError(error: any): boolean {
    if (error instanceof BaseApiError) {
      return error.statusCode >= 400 && error.statusCode < 500;
    }
    return false;
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(error: any): boolean {
    if (error instanceof BaseApiError) {
      return error.statusCode >= 500;
    }
    return false;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error: any): boolean {
    if (error instanceof BaseApiError) {
      // Don't retry client errors (4xx) except for 408 (timeout) and 429 (rate limit)
      if (error.statusCode >= 400 && error.statusCode < 500) {
        return error.statusCode === 408 || error.statusCode === 429;
      }
      
      // Retry server errors (5xx)
      return error.statusCode >= 500;
    }

    // Retry network errors, timeouts
    return error.name === 'TypeError' || 
           error.name === 'TimeoutError' ||
           error.message?.includes('fetch') ||
           error.message?.includes('timeout');
  }

  /**
   * Get retry delay for retryable errors
   */
  getRetryDelay(attempt: number, error?: any): number {
    // Exponential backoff with jitter
    const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s...
    const jitter = Math.random() * 1000; // 0-1s random jitter
    
    // Rate limit errors might include Retry-After header info
    if (error instanceof RateLimitError && error.details?.retryAfter) {
      return error.details.retryAfter * 1000;
    }
    
    return Math.min(baseDelay + jitter, 30000); // Max 30 seconds
  }

  /**
   * Log error for debugging/monitoring
   */
  logError(error: BaseApiError, context?: Record<string, any>): void {
    const logData = {
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
        stack: error.stack,
        timestamp: error.timestamp
      },
      context
    };

    // In development, log to console
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', logData);
    }

    // In production, you might want to send to logging service
    // Example: sendToLoggingService(logData);
  }

  /**
   * Transform error for analytics/monitoring
   */
  getErrorMetrics(error: BaseApiError): Record<string, any> {
    return {
      error_code: error.code,
      error_type: error.name,
      status_code: error.statusCode,
      is_client_error: this.isClientError(error),
      is_server_error: this.isServerError(error),
      is_retryable: this.isRetryable(error),
      timestamp: error.timestamp.toISOString()
    };
  }
}

/**
 * Default error handler instance
 */
export const apiErrorHandler = new ApiErrorHandler();

/**
 * Utility functions for common error scenarios
 */
export const ErrorUtils = {
  /**
   * Check if error is authentication related
   */
  isAuthError(error: any): boolean {
    return error instanceof AuthenticationError || 
           error instanceof AuthorizationError ||
           (error instanceof BaseApiError && 
            [HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.FORBIDDEN].includes(error.statusCode as any));
  },

  /**
   * Check if error requires user action
   */
  requiresUserAction(error: any): boolean {
    if (!(error instanceof BaseApiError)) return false;
    
    return [
      ERROR_CODES.AUTHENTICATION_ERROR,
      ERROR_CODES.AUTHORIZATION_ERROR,
      ERROR_CODES.VALIDATION_ERROR,
      ERROR_CODES.QUOTA_EXCEEDED,
      ERROR_CODES.FILE_TOO_LARGE,
      ERROR_CODES.INVALID_FILE_TYPE
    ].includes(error.code as typeof ERROR_CODES.VALIDATION_ERROR | 
                           typeof ERROR_CODES.AUTHENTICATION_ERROR | 
                           typeof ERROR_CODES.AUTHORIZATION_ERROR | 
                           typeof ERROR_CODES.QUOTA_EXCEEDED | 
                           typeof ERROR_CODES.FILE_TOO_LARGE | 
                           typeof ERROR_CODES.INVALID_FILE_TYPE);
  },

  /**
   * Get user-friendly error message
   */
  getUserMessage(error: any): string {
    return apiErrorHandler.formatError(error instanceof BaseApiError ? error : apiErrorHandler.handleError(error));
  },

  /**
   * Extract validation field errors
   */
  getFieldErrors(error: any): Record<string, string[]> | null {
    if (error instanceof ValidationError && error.details?.fields) {
      return error.details.fields as Record<string, string[]>;
    }
    return null;
  }
};