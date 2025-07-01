import { STORAGE_LIMITS, SUBSCRIPTION_PLANS } from './constants';
import { SupportedLanguage } from '../i18n/config';
import { FileUtils } from './file-utils';

export interface QuotaInfo {
  used: number;
  limit: number;
  available: number;
  percentage: number;
  isExceeded: boolean;
  isNearLimit: boolean; // 90% or more
}

export class QuotaUtils {
  /**
   * Get storage limit for subscription plan
   */
  static getStorageLimitForPlan(plan: 'free' | 'pro' | 'enterprise'): number {
    switch (plan) {
      case SUBSCRIPTION_PLANS.FREE:
        return STORAGE_LIMITS.FREE;
      case SUBSCRIPTION_PLANS.PRO:
        return STORAGE_LIMITS.PRO;
      case SUBSCRIPTION_PLANS.ENTERPRISE:
        return STORAGE_LIMITS.ENTERPRISE;
      default:
        return STORAGE_LIMITS.FREE;
    }
  }

  /**
   * Calculate quota information
   */
  static calculateQuota(used: number, limit: number): QuotaInfo {
    const available = Math.max(0, limit - used);
    const percentage = limit > 0 ? (used / limit) * 100 : 0;
    
    return {
      used,
      limit,
      available,
      percentage: Math.min(100, percentage),
      isExceeded: used > limit,
      isNearLimit: percentage >= 90
    };
  }

  /**
   * Check if file upload would exceed quota
   */
  static canUploadFile(fileSize: number, currentUsed: number, limit: number): {
    canUpload: boolean;
    reason?: string;
    availableSpace: number;
  } {
    const availableSpace = Math.max(0, limit - currentUsed);
    
    if (fileSize > availableSpace) {
      return {
        canUpload: false,
        reason: 'Insufficient storage space',
        availableSpace
      };
    }

    return {
      canUpload: true,
      availableSpace
    };
  }

  /**
   * Check if multiple files can be uploaded
   */
  static canUploadFiles(fileSizes: number[], currentUsed: number, limit: number): {
    canUpload: boolean;
    reason?: string;
    totalSize: number;
    availableSpace: number;
    exceedsBy?: number;
  } {
    const totalSize = fileSizes.reduce((sum, size) => sum + size, 0);
    const availableSpace = Math.max(0, limit - currentUsed);
    
    if (totalSize > availableSpace) {
      return {
        canUpload: false,
        reason: 'Total file size exceeds available storage',
        totalSize,
        availableSpace,
        exceedsBy: totalSize - availableSpace
      };
    }

    return {
      canUpload: true,
      totalSize,
      availableSpace
    };
  }

  /**
   * Get quota status message
   */
  static getQuotaStatusMessage(
    quota: QuotaInfo,
    language: SupportedLanguage = 'en'
  ): string {
    const messages = {
      en: {
        normal: 'Storage usage is normal',
        nearLimit: 'Storage is nearly full (90% used)',
        exceeded: 'Storage limit exceeded'
      },
      id: {
        normal: 'Penggunaan penyimpanan normal',
        nearLimit: 'Penyimpanan hampir penuh (90% terpakai)',
        exceeded: 'Batas penyimpanan terlampaui'
      }
    };

    const t = messages[language];

    if (quota.isExceeded) return t.exceeded;
    if (quota.isNearLimit) return t.nearLimit;
    return t.normal;
  }

  /**
   * Get quota color indicator
   */
  static getQuotaColor(quota: QuotaInfo): 'green' | 'yellow' | 'red' {
    if (quota.isExceeded) return 'red';
    if (quota.isNearLimit) return 'yellow';
    return 'green';
  }

  /**
   * Format quota usage string
   */
  static formatQuotaUsage(
    used: number,
    limit: number,
    language: SupportedLanguage = 'en'
  ): string {
    const usedFormatted = FileUtils.formatFileSize(used, language);
    const limitFormatted = FileUtils.formatFileSize(limit, language);
    
    return `${usedFormatted} / ${limitFormatted}`;
  }

  /**
   * Calculate storage needed for plan upgrade
   */
  static calculateUpgradeNeeded(
    currentUsed: number,
    currentPlan: 'free' | 'pro' | 'enterprise'
  ): {
    needsUpgrade: boolean;
    recommendedPlan?: 'pro' | 'enterprise';
    additionalStorage: number;
  } {
    const currentLimit = this.getStorageLimitForPlan(currentPlan);
    
    if (currentUsed <= currentLimit) {
      return {
        needsUpgrade: false,
        additionalStorage: currentLimit - currentUsed
      };
    }

    // Check if Pro plan would be sufficient
    const proLimit = this.getStorageLimitForPlan(SUBSCRIPTION_PLANS.PRO);
    if (currentUsed <= proLimit && currentPlan === SUBSCRIPTION_PLANS.FREE) {
      return {
        needsUpgrade: true,
        recommendedPlan: SUBSCRIPTION_PLANS.PRO,
        additionalStorage: proLimit - currentUsed
      };
    }

    // Recommend Enterprise plan
    const enterpriseLimit = this.getStorageLimitForPlan(SUBSCRIPTION_PLANS.ENTERPRISE);
    return {
      needsUpgrade: true,
      recommendedPlan: SUBSCRIPTION_PLANS.ENTERPRISE,
      additionalStorage: enterpriseLimit - currentUsed
    };
  }

  /**
   * Get time estimate until quota is full
   */
  static estimateTimeToQuotaFull(
    currentUsed: number,
    limit: number,
    averageDailyUsage: number
  ): {
    daysRemaining: number;
    willBeFull: boolean;
  } {
    const available = limit - currentUsed;
    
    if (available <= 0) {
      return { daysRemaining: 0, willBeFull: true };
    }

    if (averageDailyUsage <= 0) {
      return { daysRemaining: Infinity, willBeFull: false };
    }

    const daysRemaining = Math.floor(available / averageDailyUsage);
    
    return {
      daysRemaining,
      willBeFull: daysRemaining <= 30 // Consider it "will be full" if less than 30 days
    };
  }

  /**
   * Clean up storage by suggesting files to delete
   */
  static suggestFilesToDelete(
    files: Array<{
      id: string;
      name: string;
      size: number;
      lastAccessedAt?: Date;
      downloads: number;
    }>,
    targetBytesToFree: number
  ): Array<{ id: string; name: string; size: number; reason: string }> {
    // Sort by least accessed and largest files
    const sortedFiles = files
      .map(file => ({
        ...file,
        score: this.calculateDeleteScore(file)
      }))
      .sort((a, b) => b.score - a.score);

    const suggestions: Array<{ id: string; name: string; size: number; reason: string }> = [];
    let totalFreed = 0;

    for (const file of sortedFiles) {
      if (totalFreed >= targetBytesToFree) break;

      let reason = 'Large file';
      if (!file.lastAccessedAt || Date.now() - file.lastAccessedAt.getTime() > 90 * 24 * 60 * 60 * 1000) {
        reason = 'Not accessed in 90+ days';
      } else if (file.downloads === 0) {
        reason = 'Never downloaded';
      }

      suggestions.push({
        id: file.id,
        name: file.name,
        size: file.size,
        reason
      });

      totalFreed += file.size;
    }

    return suggestions;
  }

  /**
   * Calculate delete score for file cleanup suggestions
   */
  private static calculateDeleteScore(file: {
    size: number;
    lastAccessedAt?: Date;
    downloads: number;
  }): number {
    let score = 0;

    // Size factor (larger files get higher score)
    score += file.size / (1024 * 1024); // MB

    // Access time factor
    if (file.lastAccessedAt) {
      const daysSinceAccess = (Date.now() - file.lastAccessedAt.getTime()) / (24 * 60 * 60 * 1000);
      score += Math.min(daysSinceAccess * 0.1, 30); // Max 30 points for old files
    } else {
      score += 50; // Never accessed
    }

    // Download factor (less downloaded = higher score)
    score += Math.max(0, 10 - file.downloads);

    return score;
  }
}

// src/lib/utils/string-utils.ts
import { REGEX_PATTERNS } from './constants';

export class StringUtils {
  /**
   * Capitalize first letter of string
   */
  static capitalize(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Convert string to title case
   */
  static toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }

  /**
   * Convert string to kebab-case
   */
  static toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  /**
   * Convert string to camelCase
   */
  static toCamelCase(str: string): string {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => 
        index === 0 ? word.toLowerCase() : word.toUpperCase()
      )
      .replace(/\s+/g, '');
  }

  /**
   * Convert string to snake_case
   */
  static toSnakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase();
  }

  /**
   * Truncate string with ellipsis
   */
  static truncate(str: string, length: number, suffix: string = '...'): string {
    if (str.length <= length) return str;
    return str.substring(0, length - suffix.length) + suffix;
  }

  /**
   * Truncate string at word boundary
   */
  static truncateWords(str: string, maxWords: number, suffix: string = '...'): string {
    const words = str.split(' ');
    if (words.length <= maxWords) return str;
    return words.slice(0, maxWords).join(' ') + suffix;
  }

  /**
   * Strip HTML tags from string
   */
  static stripHtml(str: string): string {
    return str.replace(/<[^>]*>/g, '');
  }

  /**
   * Escape HTML entities
   */
  static escapeHtml(str: string): string {
    const entityMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;'
    };

    return str.replace(/[&<>"'\/]/g, (char) => entityMap[char]);
  }

  /**
   * Generate random string
   */
  static generateRandomString(length: number, chars?: string): string {
    const defaultChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const characters = chars || defaultChars;
    let result = '';

    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return result;
  }

  /**
   * Generate URL-safe random string
   */
  static generateUrlSafeString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    return this.generateRandomString(length, chars);
  }

  /**
   * Sanitize string for use in filename
   */
  static sanitizeForFilename(str: string): string {
    return str
      .replace(REGEX_PATTERNS.FILENAME_INVALID, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .trim();
  }

  /**
   * Extract initials from name
   */
  static getInitials(name: string, maxInitials: number = 2): string {
    return name
      .split(' ')
      .filter(word => word.length > 0)
      .slice(0, maxInitials)
      .map(word => word.charAt(0).toUpperCase())
      .join('');
  }

  /**
   * Mask email address for privacy
   */
  static maskEmail(email: string): string {
    const [username, domain] = email.split('@');
    if (!username || !domain) return email;

    const maskedUsername = username.length > 2
      ? username.charAt(0) + '*'.repeat(username.length - 2) + username.charAt(username.length - 1)
      : username;

    return `${maskedUsername}@${domain}`;
  }

  /**
   * Generate slug from string
   */
  static generateSlug(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Count words in string
   */
  static countWords(str: string): number {
    return str.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Estimate reading time in minutes
   */
  static estimateReadingTime(str: string, wordsPerMinute: number = 200): number {
    const wordCount = this.countWords(str);
    return Math.ceil(wordCount / wordsPerMinute);
  }

  /**
   * Compare strings for similarity (simple implementation)
   */
  static similarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Format bytes to human readable string with proper pluralization
   */
  static pluralize(count: number, singular: string, plural?: string): string {
    if (count === 1) return `${count} ${singular}`;
    return `${count} ${plural || singular + 's'}`;
  }

  /**
   * Clean and normalize whitespace
   */
  static normalizeWhitespace(str: string): string {
    return str.replace(/\s+/g, ' ').trim();
  }

  /**
   * Check if string contains only whitespace
   */
  static isWhitespace(str: string): boolean {
    return /^\s*$/.test(str);
  }

  /**
   * Pad string to specified length
   */
  static padStart(str: string, length: number, padString: string = ' '): string {
    return str.padStart(length, padString);
  }

  /**
   * Pad string to specified length at end
   */
  static padEnd(str: string, length: number, padString: string = ' '): string {
    return str.padEnd(length, padString);
  }
}