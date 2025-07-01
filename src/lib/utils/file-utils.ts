import path from 'path';
import { FILE_CATEGORIES, FILE_EXTENSIONS, FILE_LIMITS, REGEX_PATTERNS } from './constants';
import { SupportedLanguage } from '../i18n/config';
import { FileCategory } from '@/types/file';

export class FileUtils {
  /**
   * Get file extension from filename
   */
  static getExtension(filename: string): string {
    return path.extname(filename).toLowerCase();
  }

  /**
   * Get filename without extension
   */
  static getBasename(filename: string): string {
    return path.basename(filename, path.extname(filename));
  }

  /**
   * Validate filename
   */
  static validateFilename(filename: string): { isValid: boolean; error?: string } {
    if (!filename || filename.trim().length === 0) {
      return { isValid: false, error: 'Filename cannot be empty' };
    }

    if (filename.length > FILE_LIMITS.MAX_FILENAME_LENGTH) {
      return { isValid: false, error: `Filename too long (max ${FILE_LIMITS.MAX_FILENAME_LENGTH} characters)` };
    }

    if (REGEX_PATTERNS.FILENAME_INVALID.test(filename)) {
      return { isValid: false, error: 'Filename contains invalid characters' };
    }

    return { isValid: true };
  }

  /**
   * Sanitize filename for safe storage
   */
  static sanitizeFilename(filename: string): string {
    return filename
      .replace(REGEX_PATTERNS.FILENAME_INVALID, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .trim();
  }

  /**
   * Generate unique filename if duplicate exists
   */
  static generateUniqueFilename(filename: string, existingNames: string[]): string {
    const ext = this.getExtension(filename);
    const base = this.getBasename(filename);
    
    let counter = 1;
    let newFilename = filename;
    
    while (existingNames.includes(newFilename)) {
      newFilename = `${base} (${counter})${ext}`;
      counter++;
    }
    
    return newFilename;
  }

  /**
   * Get file category based on extension
   */
  static getFileCategory(filename: string): FileCategory {
    const ext = this.getExtension(filename);
    
    if (FILE_EXTENSIONS.IMAGE.includes(ext as typeof FILE_EXTENSIONS.IMAGE[number])) return FILE_CATEGORIES.IMAGE;
    if (FILE_EXTENSIONS.VIDEO.includes(ext as typeof FILE_EXTENSIONS.VIDEO[number])) return FILE_CATEGORIES.VIDEO;
    if (FILE_EXTENSIONS.AUDIO.includes(ext as typeof FILE_EXTENSIONS.AUDIO[number])) return FILE_CATEGORIES.AUDIO;
    if (FILE_EXTENSIONS.PDF.includes(ext as typeof FILE_EXTENSIONS.PDF[number])) return FILE_CATEGORIES.PDF;
    if (FILE_EXTENSIONS.TEXT.includes(ext as typeof FILE_EXTENSIONS.TEXT[number])) return FILE_CATEGORIES.TEXT;
    if (FILE_EXTENSIONS.ARCHIVE.includes(ext as typeof FILE_EXTENSIONS.ARCHIVE[number])) return FILE_CATEGORIES.ARCHIVE;
    
    return FILE_CATEGORIES.OTHER;
  }

  /**
   * Format file size in human readable format
   */
  static formatFileSize(
    bytes: number,
    language: SupportedLanguage = 'en',
    decimals: number = 2
  ): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = language === 'id' 
      ? ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
      : ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = bytes / Math.pow(k, i);
    
    return `${size.toFixed(decimals)} ${sizes[i]}`;
  }

  /**
   * Parse file size string to bytes
   */
  static parseFileSize(sizeString: string): number {
    const units: Record<string, number> = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024
    };
    
    const match = sizeString.match(/^(\d+(?:\.\d+)?)\s*([A-Z]+)$/i);
    if (!match) return 0;
    
    const [, size, unit] = match;
    const multiplier = units[unit.toUpperCase()] || 1;
    
    return Math.floor(parseFloat(size) * multiplier);
  }

  /**
   * Check if file size is within limit
   */
  static isFileSizeValid(size: number, maxSize: number = FILE_LIMITS.MAX_FILE_SIZE): boolean {
    return size > 0 && size <= maxSize;
  }

  /**
   * Generate file hash for deduplication
   */
  static generateFileHash(buffer: Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Check if file is an image
   */
  static isImage(filename: string): boolean {
    return this.getFileCategory(filename) === FILE_CATEGORIES.IMAGE;
  }

  /**
   * Check if file is a video
   */
  static isVideo(filename: string): boolean {
    return this.getFileCategory(filename) === FILE_CATEGORIES.VIDEO;
  }

  /**
   * Check if file is an audio file
   */
  static isAudio(filename: string): boolean {
    return this.getFileCategory(filename) === FILE_CATEGORIES.AUDIO;
  }

  /**
   * Check if file can be previewed in browser
   */
  static canPreview(filename: string): boolean {
    const category = this.getFileCategory(filename);
    return ([
      FILE_CATEGORIES.IMAGE,
      FILE_CATEGORIES.PDF,
      FILE_CATEGORIES.TEXT,
      FILE_CATEGORIES.VIDEO,
      FILE_CATEGORIES.AUDIO
    ] as FileCategory[]).includes(category);
  }

  /**
   * Get file icon based on category
   */
  static getFileIcon(filename: string): string {
    const category = this.getFileCategory(filename);
    
    const icons: Record<FileCategory, string> = {
      image: '🖼️',
      video: '🎥',
      audio: '🎵',
      pdf: '📄',
      text: '📝',
      archive: '🗜️',
      other: '📎'
    };
    
    return icons[category];
  }

  /**
   * Split file into chunks for upload
   */
  static splitIntoChunks(file: File, chunkSize: number = FILE_LIMITS.CHUNK_SIZE): Blob[] {
    const chunks: Blob[] = [];
    let start = 0;
    
    while (start < file.size) {
      const end = Math.min(start + chunkSize, file.size);
      chunks.push(file.slice(start, end));
      start = end;
    }
    
    return chunks;
  }

  /**
   * Validate file type against allowed types
   */
  static validateFileType(filename: string, allowedTypes: string[]): boolean {
    const ext = this.getExtension(filename);
    return allowedTypes.includes(ext);
  }

  /**
   * Get storage key (path) for file
   */
  static generateStorageKey(userId: string, filename: string, folder?: string): string {
    const sanitizedFilename = this.sanitizeFilename(filename);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    
    const key = `${userId}/${timestamp}-${random}-${sanitizedFilename}`;
    
    return folder ? `${folder}/${key}` : key;
  }
}
