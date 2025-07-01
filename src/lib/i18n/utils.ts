import { CURRENCY_CONFIGS, LANGUAGE_CONFIGS, SupportedLanguage, SupportedCurrency } from './config';

export class LocaleUtils {
  /**
   * Format currency based on locale
   */
  static formatCurrency(
    amount: number,
    currency: SupportedCurrency,
    language: SupportedLanguage = 'en'
  ): string {
    const config = CURRENCY_CONFIGS[currency];
    const langConfig = LANGUAGE_CONFIGS[language];
    
    try {
      const formatter = new Intl.NumberFormat(langConfig.numberFormat, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: config.decimals,
        maximumFractionDigits: config.decimals
      });
      
      return formatter.format(amount);
    } catch (error) {
      // Fallback formatting
      const formattedAmount = this.formatNumber(amount, config.decimals, language);
      return config.symbolPosition === 'before' 
        ? `${config.symbol}${formattedAmount}`
        : `${formattedAmount} ${config.symbol}`;
    }
  }

  /**
   * Format number based on locale
   */
  static formatNumber(
    number: number,
    decimals: number = 0,
    language: SupportedLanguage = 'en'
  ): string {
    const langConfig = LANGUAGE_CONFIGS[language];
    
    try {
      return new Intl.NumberFormat(langConfig.numberFormat, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(number);
    } catch (error) {
      return number.toFixed(decimals);
    }
  }

  /**
   * Format date based on locale
   */
  static formatDate(
    date: Date,
    language: SupportedLanguage = 'en',
    options?: Intl.DateTimeFormatOptions
  ): string {
    const langConfig = LANGUAGE_CONFIGS[language];
    
    try {
      return new Intl.DateTimeFormat(langConfig.numberFormat, options).format(date);
    } catch (error) {
      return date.toLocaleDateString();
    }
  }

  /**
   * Format file size with proper units
   */
  static formatFileSize(
    bytes: number,
    language: SupportedLanguage = 'en'
  ): string {
    const units = language === 'id' 
      ? ['B', 'KB', 'MB', 'GB', 'TB']
      : ['B', 'KB', 'MB', 'GB', 'TB'];
    
    if (bytes === 0) return `0 ${units[0]}`;
    
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = bytes / Math.pow(k, i);
    
    return `${this.formatNumber(size, i === 0 ? 0 : 1, language)} ${units[i]}`;
  }

  /**
   * Convert currency using exchange rates
   */
  static async convertCurrency(
    amount: number,
    fromCurrency: SupportedCurrency,
    toCurrency: SupportedCurrency
  ): Promise<number> {
    if (fromCurrency === toCurrency) return amount;
    
    // In real implementation, this would fetch from database or API
    const exchangeRates = {
      'USD_IDR': 15500, // 1 USD = 15,500 IDR (example rate)
      'IDR_USD': 1 / 15500
    };
    
    const rateKey = `${fromCurrency}_${toCurrency}` as keyof typeof exchangeRates;
    const rate = exchangeRates[rateKey];
    
    if (!rate) {
      throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
    }
    
    return amount * rate;
  }

  /**
   * Get currency by region/country
   */
  static getCurrencyByRegion(countryCode: string): SupportedCurrency {
    const regionMap: Record<string, SupportedCurrency> = {
      'ID': 'IDR',
      'US': 'USD'
    };
    
    return regionMap[countryCode.toUpperCase()] || 'USD';
  }

  /**
   * Detect language from browser or request
   */
  static detectLanguage(acceptLanguage?: string): SupportedLanguage {
    if (!acceptLanguage) return 'en';
    
    const languages = acceptLanguage
      .split(',')
      .map(lang => lang.split(';')[0].trim().slice(0, 2));
    
    for (const lang of languages) {
      if (lang === 'id' || lang === 'in') return 'id'; // 'in' is sometimes used for Indonesian
      if (lang === 'en') return 'en';
    }
    
    return 'en'; // Default fallback
  }
}
