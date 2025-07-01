import { z } from 'zod';

export const SUPPORTED_LANGUAGES = ['en', 'id'] as const;
export const SUPPORTED_CURRENCIES = ['USD', 'IDR'] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

export interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
  dateFormat: string;
  numberFormat: string;
}

export interface CurrencyConfig {
  code: SupportedCurrency;
  name: string;
  symbol: string;
  symbolPosition: 'before' | 'after';
  decimals: number;
  thousandsSeparator: string;
  decimalSeparator: string;
  stripe_currency: string; // Stripe currency code
}

export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    dateFormat: 'MM/dd/yyyy',
    numberFormat: 'en-US'
  },
  id: {
    code: 'id',
    name: 'Indonesian',
    nativeName: 'Bahasa Indonesia',
    flag: '🇮🇩',
    dateFormat: 'dd/MM/yyyy',
    numberFormat: 'id-ID'
  }
};

export const CURRENCY_CONFIGS: Record<SupportedCurrency, CurrencyConfig> = {
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    symbolPosition: 'before',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
    stripe_currency: 'usd'
  },
  IDR: {
    code: 'IDR',
    name: 'Indonesian Rupiah',
    symbol: 'Rp',
    symbolPosition: 'before',
    decimals: 0, // Indonesian Rupiah doesn't use decimals
    thousandsSeparator: '.',
    decimalSeparator: ',',
    stripe_currency: 'idr'
  }
};

// Default settings
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';
export const DEFAULT_CURRENCY: SupportedCurrency = 'USD';

// Regional currency mapping
export const REGION_CURRENCY_MAP: Record<string, SupportedCurrency> = {
  'US': 'USD',
  'ID': 'IDR',
  'GB': 'USD', // Fallback to USD for other regions
  'AU': 'USD',
  'SG': 'USD'
};

// Validation schemas
export const languageSchema = z.enum(SUPPORTED_LANGUAGES);
export const currencySchema = z.enum(SUPPORTED_CURRENCIES);
