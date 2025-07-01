import { REGEX_PATTERNS, USER_LIMITS } from './constants';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  code?: string;
}

export class ValidationUtils {
  /**
   * Validate email format
   */
  static validateEmail(email: string): ValidationResult {
    if (!email) {
      return { isValid: false, error: 'Email is required', code: 'REQUIRED' };
    }

    if (!REGEX_PATTERNS.EMAIL.test(email)) {
      return { isValid: false, error: 'Invalid email format', code: 'INVALID_FORMAT' };
    }

    if (email.length > 255) {
      return { isValid: false, error: 'Email too long', code: 'TOO_LONG' };
    }

    return { isValid: true };
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string, requirements?: {
    minLength?: number;
    requireUppercase?: boolean;
    requireNumbers?: boolean;
    requireSymbols?: boolean;
  }): ValidationResult {
    const {
      minLength = USER_LIMITS.PASSWORD_MIN_LENGTH,
      requireUppercase = false,
      requireNumbers = false,
      requireSymbols = false
    } = requirements || {};

    if (!password) {
      return { isValid: false, error: 'Password is required', code: 'REQUIRED' };
    }

    if (password.length < minLength) {
      return { 
        isValid: false, 
        error: `Password must be at least ${minLength} characters`, 
        code: 'TOO_SHORT' 
      };
    }

    if (password.length > USER_LIMITS.PASSWORD_MAX_LENGTH) {
      return { 
        isValid: false, 
        error: `Password must not exceed ${USER_LIMITS.PASSWORD_MAX_LENGTH} characters`, 
        code: 'TOO_LONG' 
      };
    }

    if (requireUppercase && !/[A-Z]/.test(password)) {
      return { 
        isValid: false, 
        error: 'Password must contain at least one uppercase letter', 
        code: 'NO_UPPERCASE' 
      };
    }

    if (requireNumbers && !/\d/.test(password)) {
      return { 
        isValid: false, 
        error: 'Password must contain at least one number', 
        code: 'NO_NUMBERS' 
      };
    }

    if (requireSymbols && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return { 
        isValid: false, 
        error: 'Password must contain at least one symbol', 
        code: 'NO_SYMBOLS' 
      };
    }

    return { isValid: true };
  }

  /**
   * Validate ObjectId format
   */
  static validateObjectId(id: string): ValidationResult {
    if (!id) {
      return { isValid: false, error: 'ID is required', code: 'REQUIRED' };
    }

    if (!REGEX_PATTERNS.OBJECTID.test(id)) {
      return { isValid: false, error: 'Invalid ID format', code: 'INVALID_FORMAT' };
    }

    return { isValid: true };
  }

  /**
   * Validate file size
   */
  static validateFileSize(size: number, maxSize?: number): ValidationResult {
    if (size <= 0) {
      return { isValid: false, error: 'File size must be greater than 0', code: 'INVALID_SIZE' };
    }

    const limit = maxSize || 100 * 1024 * 1024; // 100MB default
    if (size > limit) {
      return { 
        isValid: false, 
        error: `File size exceeds limit of ${this.formatBytes(limit)}`, 
        code: 'TOO_LARGE' 
      };
    }

    return { isValid: true };
  }

  /**
   * Validate filename
   */
  static validateFilename(filename: string): ValidationResult {
    if (!filename) {
      return { isValid: false, error: 'Filename is required', code: 'REQUIRED' };
    }

    if (filename.length > 255) {
      return { isValid: false, error: 'Filename too long', code: 'TOO_LONG' };
    }

    if (REGEX_PATTERNS.FILENAME_INVALID.test(filename)) {
      return { 
        isValid: false, 
        error: 'Filename contains invalid characters', 
        code: 'INVALID_CHARACTERS' 
      };
    }

    return { isValid: true };
  }

  /**
   * Validate URL format
   */
  static validateUrl(url: string): ValidationResult {
    if (!url) {
      return { isValid: false, error: 'URL is required', code: 'REQUIRED' };
    }

    if (!REGEX_PATTERNS.URL.test(url)) {
      return { isValid: false, error: 'Invalid URL format', code: 'INVALID_FORMAT' };
    }

    return { isValid: true };
  }

  /**
   * Validate hex color
   */
  static validateHexColor(color: string): ValidationResult {
    if (!color) {
      return { isValid: false, error: 'Color is required', code: 'REQUIRED' };
    }

    if (!REGEX_PATTERNS.HEX_COLOR.test(color)) {
      return { isValid: false, error: 'Invalid color format', code: 'INVALID_FORMAT' };
    }

    return { isValid: true };
  }

  /**
   * Validate IP address
   */
  static validateIpAddress(ip: string): ValidationResult {
    if (!ip) {
      return { isValid: false, error: 'IP address is required', code: 'REQUIRED' };
    }

    if (!REGEX_PATTERNS.IPV4.test(ip)) {
      return { isValid: false, error: 'Invalid IP address format', code: 'INVALID_FORMAT' };
    }

    return { isValid: true };
  }

  /**
   * Validate date range
   */
  static validateDateRange(startDate: Date, endDate: Date): ValidationResult {
    if (startDate >= endDate) {
      return { 
        isValid: false, 
        error: 'Start date must be before end date', 
        code: 'INVALID_RANGE' 
      };
    }

    return { isValid: true };
  }

  /**
   * Validate array length
   */
  static validateArrayLength(
    array: any[], 
    min: number = 0, 
    max: number = Infinity,
    fieldName: string = 'Array'
  ): ValidationResult {
    if (array.length < min) {
      return { 
        isValid: false, 
        error: `${fieldName} must have at least ${min} item${min !== 1 ? 's' : ''}`, 
        code: 'TOO_FEW' 
      };
    }

    if (array.length > max) {
      return { 
        isValid: false, 
        error: `${fieldName} cannot have more than ${max} item${max !== 1 ? 's' : ''}`, 
        code: 'TOO_MANY' 
      };
    }

    return { isValid: true };
  }

  /**
   * Validate string length
   */
  static validateStringLength(
    str: string, 
    min: number = 0, 
    max: number = Infinity,
    fieldName: string = 'Field'
  ): ValidationResult {
    if (str.length < min) {
      return { 
        isValid: false, 
        error: `${fieldName} must be at least ${min} character${min !== 1 ? 's' : ''}`, 
        code: 'TOO_SHORT' 
      };
    }

    if (str.length > max) {
      return { 
        isValid: false, 
        error: `${fieldName} cannot exceed ${max} character${max !== 1 ? 's' : ''}`, 
        code: 'TOO_LONG' 
      };
    }

    return { isValid: true };
  }

  /**
   * Format bytes for error messages
   */
  private static formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
  }

  /**
   * Combine multiple validation results
   */
  static combineValidations(...validations: ValidationResult[]): ValidationResult {
    const invalid = validations.find(v => !v.isValid);
    
    if (invalid) {
      return invalid;
    }

    return { isValid: true };
  }

  /**
   * Validate enum value
   */
  static validateEnum<T>(
    value: T, 
    allowedValues: T[], 
    fieldName: string = 'Value'
  ): ValidationResult {
    if (!allowedValues.includes(value)) {
      return { 
        isValid: false, 
        error: `${fieldName} must be one of: ${allowedValues.join(', ')}`, 
        code: 'INVALID_ENUM' 
      };
    }

    return { isValid: true };
  }
}