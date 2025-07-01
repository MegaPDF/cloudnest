import { SupportedCurrency, SupportedLanguage } from "@/lib/i18n/config";

export interface LocalePreferences {
  language: SupportedLanguage;
  currency: SupportedCurrency;
  timezone: string;
}

export interface TranslationKey {
  key: string;
  namespace: string;
  en: string;
  id: string;
}

export interface PricingByRegion {
  planId: string;
  prices: {
    USD: number;
    IDR: number;
  };
  stripePriceIds: {
    USD: string;
    IDR: string;
  };
}