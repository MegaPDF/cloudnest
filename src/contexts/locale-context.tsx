"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { DEFAULT_TRANSLATIONS } from "@/lib/i18n/translations";
import {
  CURRENCY_CONFIGS,
  SupportedLanguage,
  SupportedCurrency,
} from "@/lib/i18n/config";

// Context type
interface LocaleContextType {
  language: SupportedLanguage;
  currency: SupportedCurrency;
  setLanguage: (lang: SupportedLanguage) => void;
  setCurrency: (curr: SupportedCurrency) => void;
  t: (namespace: string, key: string) => string;
  formatCurrency: (amount: number) => string;
  formatFileSize: (bytes: number) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

// Provider component
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<SupportedLanguage>("en");
  const [currency, setCurrency] = useState<SupportedCurrency>("USD");

  // Load from localStorage on mount
  useEffect(() => {
    const savedLang = localStorage.getItem(
      "cloudnest-language"
    ) as SupportedLanguage;
    const savedCurrency = localStorage.getItem(
      "cloudnest-currency"
    ) as SupportedCurrency;

    if (savedLang && ["en", "id"].includes(savedLang)) setLanguage(savedLang);
    if (savedCurrency && ["USD", "IDR"].includes(savedCurrency))
      setCurrency(savedCurrency);
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem("cloudnest-language", language);
    localStorage.setItem("cloudnest-currency", currency);
  }, [language, currency]);

  // Translation function using existing DEFAULT_TRANSLATIONS
  const t = (namespace: string, key: string): string => {
    const translations =
      DEFAULT_TRANSLATIONS[namespace as keyof typeof DEFAULT_TRANSLATIONS];
    if (!translations) return key;

    const translation = translations[key as keyof typeof translations] as { [lang in SupportedLanguage]?: string } | undefined;
    if (!translation) return key;

    return translation[language] || translation["en"] || key;
  };

  // Format currency using existing CURRENCY_CONFIGS
  const formatCurrency = (amount: number): string => {
    const config = CURRENCY_CONFIGS[currency];

    // Format number based on currency decimals
    const formattedNumber =
      currency === "IDR"
        ? Math.round(amount).toLocaleString("id-ID")
        : amount
            .toFixed(config.decimals)
            .replace(/\B(?=(\d{3})+(?!\d))/g, config.thousandsSeparator);

    return config.symbolPosition === "before"
      ? `${config.symbol}${formattedNumber}`
      : `${formattedNumber} ${config.symbol}`;
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    const units =
      language === "id"
        ? ["B", "KB", "MB", "GB", "TB"]
        : ["B", "KB", "MB", "GB", "TB"];

    if (bytes === 0) return `0 ${units[0]}`;

    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = bytes / Math.pow(k, i);

    const formattedSize = i === 0 ? size.toString() : size.toFixed(1);
    return `${formattedSize} ${units[i]}`;
  };

  return (
    <LocaleContext.Provider
      value={{
        language,
        currency,
        setLanguage,
        setCurrency,
        t,
        formatCurrency,
        formatFileSize,
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

// Hook to use the context
export function useLocale() {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}
