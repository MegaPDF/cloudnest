import { SupportedLanguage, LANGUAGE_CONFIGS } from '../i18n/config';

export class DateUtils {
  /**
   * Format date based on user locale
   */
  static formatDate(
    date: Date | string,
    language: SupportedLanguage = 'en',
    options?: Intl.DateTimeFormatOptions
  ): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const config = LANGUAGE_CONFIGS[language];
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options
    };
    
    try {
      return new Intl.DateTimeFormat(config.numberFormat, defaultOptions).format(dateObj);
    } catch (error) {
      return dateObj.toLocaleDateString();
    }
  }

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  static formatRelativeTime(
    date: Date | string,
    language: SupportedLanguage = 'en'
  ): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
    
    const translations = {
      en: {
        now: 'just now',
        seconds: 'seconds ago',
        minute: 'a minute ago',
        minutes: 'minutes ago',
        hour: 'an hour ago',
        hours: 'hours ago',
        day: 'a day ago',
        days: 'days ago',
        week: 'a week ago',
        weeks: 'weeks ago',
        month: 'a month ago',
        months: 'months ago',
        year: 'a year ago',
        years: 'years ago'
      },
      id: {
        now: 'baru saja',
        seconds: 'detik yang lalu',
        minute: 'semenit yang lalu',
        minutes: 'menit yang lalu',
        hour: 'sejam yang lalu',
        hours: 'jam yang lalu',
        day: 'sehari yang lalu',
        days: 'hari yang lalu',
        week: 'seminggu yang lalu',
        weeks: 'minggu yang lalu',
        month: 'sebulan yang lalu',
        months: 'bulan yang lalu',
        year: 'setahun yang lalu',
        years: 'tahun yang lalu'
      }
    };

    const t = translations[language];

    if (diffInSeconds < 10) return t.now;
    if (diffInSeconds < 60) return `${diffInSeconds} ${t.seconds}`;
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes === 1) return t.minute;
    if (diffInMinutes < 60) return `${diffInMinutes} ${t.minutes}`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours === 1) return t.hour;
    if (diffInHours < 24) return `${diffInHours} ${t.hours}`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return t.day;
    if (diffInDays < 7) return `${diffInDays} ${t.days}`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks === 1) return t.week;
    if (diffInWeeks < 4) return `${diffInWeeks} ${t.weeks}`;
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths === 1) return t.month;
    if (diffInMonths < 12) return `${diffInMonths} ${t.months}`;
    
    const diffInYears = Math.floor(diffInDays / 365);
    if (diffInYears === 1) return t.year;
    return `${diffInYears} ${t.years}`;
  }

  /**
   * Check if date is within range
   */
  static isWithinDateRange(
    date: Date | string,
    startDate?: Date | string,
    endDate?: Date | string
  ): boolean {
    const checkDate = typeof date === 'string' ? new Date(date) : date;
    
    if (startDate) {
      const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
      if (checkDate < start) return false;
    }
    
    if (endDate) {
      const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
      if (checkDate > end) return false;
    }
    
    return true;
  }

  /**
   * Add time to date
   */
  static addTime(
    date: Date,
    amount: number,
    unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'
  ): Date {
    const result = new Date(date);
    
    switch (unit) {
      case 'seconds':
        result.setSeconds(result.getSeconds() + amount);
        break;
      case 'minutes':
        result.setMinutes(result.getMinutes() + amount);
        break;
      case 'hours':
        result.setHours(result.getHours() + amount);
        break;
      case 'days':
        result.setDate(result.getDate() + amount);
        break;
      case 'weeks':
        result.setDate(result.getDate() + (amount * 7));
        break;
      case 'months':
        result.setMonth(result.getMonth() + amount);
        break;
      case 'years':
        result.setFullYear(result.getFullYear() + amount);
        break;
    }
    
    return result;
  }

  /**
   * Get start and end of day
   */
  static getDateBoundaries(date: Date): { startOfDay: Date; endOfDay: Date } {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return { startOfDay, endOfDay };
  }

  /**
   * Parse date string safely
   */
  static parseDate(dateString: string): Date | null {
    if (!dateString) return null;
    
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Format date for database storage (ISO string)
   */
  static toISOString(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toISOString();
  }

  /**
   * Get timezone offset in minutes
   */
  static getTimezoneOffset(): number {
    return new Date().getTimezoneOffset();
  }
}
