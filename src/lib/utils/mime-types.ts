
import { FileCategory } from '@/types/file';
import { FILE_CATEGORIES } from './constants';

export class MimeTypeUtils {
  // MIME type mappings based on file extensions
  private static readonly MIME_TYPES: Record<string, string> = {
    // Images
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    
    // Videos
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.m4v': 'video/x-m4v',
    
    // Audio
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.wma': 'audio/x-ms-wma',
    '.m4a': 'audio/mp4',
    
    // Documents
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.odt': 'application/vnd.oasis.opendocument.text',
    '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
    '.odp': 'application/vnd.oasis.opendocument.presentation',
    
    // Text
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.rtf': 'application/rtf',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.ts': 'application/typescript',
    
    // Archives
    '.zip': 'application/zip',
    '.rar': 'application/vnd.rar',
    '.7z': 'application/x-7z-compressed',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.bz2': 'application/x-bzip2'
  };

  // Category mappings for MIME types
  private static readonly CATEGORY_MAPPINGS: Record<string, FileCategory> = {
    'image/': FILE_CATEGORIES.IMAGE,
    'video/': FILE_CATEGORIES.VIDEO,
    'audio/': FILE_CATEGORIES.AUDIO,
    'application/pdf': FILE_CATEGORIES.PDF,
    'text/': FILE_CATEGORIES.TEXT,
    'application/json': FILE_CATEGORIES.TEXT,
    'application/xml': FILE_CATEGORIES.TEXT,
    'application/javascript': FILE_CATEGORIES.TEXT,
    'application/typescript': FILE_CATEGORIES.TEXT,
    'application/zip': FILE_CATEGORIES.ARCHIVE,
    'application/x-': FILE_CATEGORIES.ARCHIVE
  };

  /**
   * Get MIME type from file extension
   */
  static getMimeType(filename: string): string {
    const ext = this.getExtension(filename);
    return this.MIME_TYPES[ext] || 'application/octet-stream';
  }

  /**
   * Get file extension from filename
   */
  private static getExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot === -1 ? '' : filename.substring(lastDot).toLowerCase();
  }

  /**
   * Get file category from MIME type
   */
  static getCategoryFromMimeType(mimeType: string): FileCategory {
    // Check exact matches first
    if (this.CATEGORY_MAPPINGS[mimeType]) {
      return this.CATEGORY_MAPPINGS[mimeType];
    }

    // Check prefix matches
    for (const [prefix, category] of Object.entries(this.CATEGORY_MAPPINGS)) {
      if (mimeType.startsWith(prefix)) {
        return category;
      }
    }

    return FILE_CATEGORIES.OTHER;
  }

  /**
   * Check if MIME type is allowed
   */
  static isAllowedMimeType(mimeType: string, allowedTypes: string[]): boolean {
    return allowedTypes.includes(mimeType) || 
           allowedTypes.some(type => type.endsWith('/*') && mimeType.startsWith(type.replace('/*', '/')));
  }

  /**
   * Validate file MIME type
   */
  static validateMimeType(filename: string, actualMimeType?: string): {
    isValid: boolean;
    expectedMimeType: string;
    actualMimeType?: string;
    error?: string;
  } {
    const expectedMimeType = this.getMimeType(filename);
    
    if (!actualMimeType) {
      return {
        isValid: true,
        expectedMimeType
      };
    }

    // Allow some flexibility for common variations
    const isValid = actualMimeType === expectedMimeType ||
                   this.areCompatibleMimeTypes(expectedMimeType, actualMimeType);

    return {
      isValid,
      expectedMimeType,
      actualMimeType,
      error: isValid ? undefined : `Expected ${expectedMimeType}, got ${actualMimeType}`
    };
  }

  /**
   * Check if two MIME types are compatible
   */
  private static areCompatibleMimeTypes(expected: string, actual: string): boolean {
    // Handle common variations
    const compatibilityMap: Record<string, string[]> = {
      'image/jpeg': ['image/jpg'],
      'application/javascript': ['text/javascript'],
      'application/xml': ['text/xml']
    };

    return compatibilityMap[expected]?.includes(actual) ||
           compatibilityMap[actual]?.includes(expected) ||
           false;
  }

  /**
   * Get all supported MIME types for a category
   */
  static getMimeTypesForCategory(category: FileCategory): string[] {
    return Object.entries(this.MIME_TYPES)
      .filter(([ext, mimeType]) => this.getCategoryFromMimeType(mimeType) === category)
      .map(([ext, mimeType]) => mimeType);
  }

  /**
   * Check if file can be previewed based on MIME type
   */
  static canPreviewMimeType(mimeType: string): boolean {
    const previewableTypes = [
      'image/', 'video/', 'audio/', 'text/', 'application/pdf',
      'application/json', 'application/xml', 'application/javascript'
    ];

    return previewableTypes.some(type => mimeType.startsWith(type));
  }

  /**
   * Get file extension suggestions for MIME type
   */
  static getExtensionsForMimeType(mimeType: string): string[] {
    return Object.entries(this.MIME_TYPES)
      .filter(([ext, mime]) => mime === mimeType)
      .map(([ext, mime]) => ext);
  }
}