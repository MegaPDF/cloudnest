import { REGEX_PATTERNS } from './constants';

export class URLUtils {
  /**
   * Validate URL format
   */
  static isValidUrl(url: string): boolean {
    return REGEX_PATTERNS.URL.test(url);
  }

  /**
   * Ensure URL has protocol
   */
  static ensureProtocol(url: string, defaultProtocol: string = 'https'): string {
    if (!url) return url;
    
    if (!/^https?:\/\//i.test(url)) {
      return `${defaultProtocol}://${url}`;
    }
    
    return url;
  }

  /**
   * Extract domain from URL
   */
  static extractDomain(url: string): string | null {
    try {
      const urlObj = new URL(this.ensureProtocol(url));
      return urlObj.hostname;
    } catch {
      return null;
    }
  }

  /**
   * Build query string from object
   */
  static buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, String(v)));
        } else {
          searchParams.append(key, String(value));
        }
      }
    });
    
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  /**
   * Parse query string to object
   */
  static parseQueryString(queryString: string): Record<string, string | string[]> {
    const params: Record<string, string | string[]> = {};
    const searchParams = new URLSearchParams(queryString.replace(/^\?/, ''));
    
    for (const [key, value] of searchParams.entries()) {
      if (params[key]) {
        if (Array.isArray(params[key])) {
          (params[key] as string[]).push(value);
        } else {
          params[key] = [params[key] as string, value];
        }
      } else {
        params[key] = value;
      }
    }
    
    return params;
  }

  /**
   * Generate file download URL
   */
  static generateFileDownloadUrl(fileId: string, filename?: string): string {
    const baseUrl = '/api/files/download';
    const params: Record<string, string> = {};
    
    if (filename) {
      params.filename = filename;
    }
    
    const queryString = this.buildQueryString(params);
    return `${baseUrl}/${fileId}${queryString}`;
  }

  /**
   * Generate file preview URL
   */
  static generateFilePreviewUrl(fileId: string): string {
    return `/api/files/preview/${fileId}`;
  }

  /**
   * Generate share URL
   */
  static generateShareUrl(shareToken: string, baseUrl?: string): string {
    const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${base}/shared/${shareToken}`;
  }

  /**
   * Generate avatar URL from email (Gravatar)
   */
  static generateGravatarUrl(email: string, size: number = 80): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
    return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
  }

  /**
   * Generate API endpoint URL
   */
  static generateApiUrl(endpoint: string, params?: Record<string, any>): string {
    const baseUrl = '/api';
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const queryString = params ? this.buildQueryString(params) : '';
    
    return `${baseUrl}${cleanEndpoint}${queryString}`;
  }

  /**
   * Check if URL is safe for redirect
   */
  static isSafeRedirectUrl(url: string, allowedDomains: string[] = []): boolean {
    try {
      const urlObj = new URL(url);
      
      // Allow relative URLs
      if (!urlObj.hostname) return true;
      
      // Check against allowed domains
      return allowedDomains.includes(urlObj.hostname);
    } catch {
      // Invalid URL
      return false;
    }
  }

  /**
   * Normalize URL for comparison
   */
  static normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(this.ensureProtocol(url));
      
      // Remove trailing slash
      if (urlObj.pathname.endsWith('/') && urlObj.pathname.length > 1) {
        urlObj.pathname = urlObj.pathname.slice(0, -1);
      }
      
      // Sort query parameters
      urlObj.searchParams.sort();
      
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * Get file extension from URL
   */
  static getFileExtensionFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const lastDot = pathname.lastIndexOf('.');
      
      if (lastDot === -1) return '';
      
      return pathname.substring(lastDot).toLowerCase();
    } catch {
      return '';
    }
  }

  /**
   * Join URL paths safely
   */
  static joinPaths(...paths: string[]): string {
    return paths
      .map((path, index) => {
        if (index === 0) {
          return path.replace(/\/+$/, '');
        }
        return path.replace(/^\/+|\/+$/g, '');
      })
      .filter(path => path.length > 0)
      .join('/');
  }

  /**
   * Encode URL component safely
   */
  static encodeComponent(component: string): string {
    return encodeURIComponent(component).replace(/[!'()*]/g, (c) => {
      return '%' + c.charCodeAt(0).toString(16);
    });
  }

  /**
   * Generate thumbnail URL
   */
  static generateThumbnailUrl(fileId: string, size: string = 'medium'): string {
    return `/api/files/thumbnail/${fileId}?size=${size}`;
  }

  /**
   * Build pagination URL
   */
  static buildPaginationUrl(
    basePath: string, 
    currentParams: Record<string, any>, 
    page: number
  ): string {
    const params = { ...currentParams, page };
    const queryString = this.buildQueryString(params);
    return `${basePath}${queryString}`;
  }
}
