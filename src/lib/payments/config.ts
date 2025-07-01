import { SupportedCurrency } from '../i18n/config';
import { SUBSCRIPTION_PLANS, STORAGE_LIMITS } from '../utils/constants';

export interface PaymentConfig {
  stripe: {
    secretKey: string;
    publishableKey: string;
    webhookSecret: string;
    apiVersion: string;
  };
  features: {
    enableTrials: boolean;
    trialDays: number;
    enableCoupons: boolean;
    enableTaxes: boolean;
    requireBillingAddress: boolean;
    allowPartialPayments: boolean;
  };
  limits: {
    maxRetryAttempts: number;
    webhookRetentionDays: number;
    invoiceRetentionDays: number;
  };
  notifications: {
    sendPaymentSuccess: boolean;
    sendPaymentFailed: boolean;
    sendSubscriptionUpdates: boolean;
    sendExpirationWarnings: boolean;
    warningDaysBefore: number[];
  };
}

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    apiVersion: '2023-10-16'
  },
  features: {
    enableTrials: true,
    trialDays: 14,
    enableCoupons: true,
    enableTaxes: false, // Can be enabled for specific regions
    requireBillingAddress: false,
    allowPartialPayments: false
  },
  limits: {
    maxRetryAttempts: 3,
    webhookRetentionDays: 30,
    invoiceRetentionDays: 365
  },
  notifications: {
    sendPaymentSuccess: true,
    sendPaymentFailed: true,
    sendSubscriptionUpdates: true,
    sendExpirationWarnings: true,
    warningDaysBefore: [7, 3, 1] // Days before subscription expires
  }
};

// Currency configuration for Stripe
export const STRIPE_CURRENCY_CONFIG: Record<SupportedCurrency, {
  code: string;
  decimals: number;
  minimumAmount: number;
  supportedPaymentMethods: string[];
}> = {
  USD: {
    code: 'usd',
    decimals: 2,
    minimumAmount: 50, // $0.50 minimum
    supportedPaymentMethods: ['card', 'bank_transfer', 'paypal']
  },
  IDR: {
    code: 'idr',
    decimals: 0, // Indonesian Rupiah doesn't use decimals
    minimumAmount: 1000, // 1,000 IDR minimum
    supportedPaymentMethods: ['card', 'bank_transfer']
  }
};

// Regional tax configuration
export const TAX_CONFIG: Record<string, {
  enabled: boolean;
  taxRate: number;
  taxName: string;
  stripeTaxId?: string;
}> = {
  US: {
    enabled: true,
    taxRate: 0.08, // 8% average sales tax
    taxName: 'Sales Tax',
    stripeTaxId: 'txr_us_sales_tax'
  },
  ID: {
    enabled: true,
    taxRate: 0.11, // 11% VAT in Indonesia
    taxName: 'PPN (VAT)',
    stripeTaxId: 'txr_id_vat'
  }
};

// Payment method configuration by region
export const PAYMENT_METHODS_BY_REGION: Record<string, string[]> = {
  US: ['card', 'ach_debit', 'link'],
  ID: ['card', 'bank_transfer', 'gopay', 'shopeepay'],
  GB: ['card', 'bacs_debit'],
  EU: ['card', 'sepa_debit', 'sofort'],
  DEFAULT: ['card']
};

export class PaymentConfigManager {
  private config: PaymentConfig;

  constructor(config: Partial<PaymentConfig> = {}) {
    this.config = { ...DEFAULT_PAYMENT_CONFIG, ...config };
    this.validateConfig();
  }

  getConfig(): PaymentConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<PaymentConfig>): void {
    this.config = { ...this.config, ...updates };
    this.validateConfig();
  }

  isFeatureEnabled(feature: keyof PaymentConfig['features']): boolean {
    return Boolean(this.config.features[feature]);
  }

  getNotificationSettings(): PaymentConfig['notifications'] {
    return this.config.notifications;
  }

  getCurrencyConfig(currency: SupportedCurrency) {
    return STRIPE_CURRENCY_CONFIG[currency];
  }

  getTaxConfig(countryCode: string) {
    return TAX_CONFIG[countryCode.toUpperCase()] || { enabled: false, taxRate: 0, taxName: 'Tax' };
  }

  getPaymentMethods(countryCode: string): string[] {
    return PAYMENT_METHODS_BY_REGION[countryCode.toUpperCase()] || PAYMENT_METHODS_BY_REGION.DEFAULT;
  }

  private validateConfig(): void {
    if (!this.config.stripe.secretKey) {
      throw new Error('Stripe secret key is required');
    }

    if (!this.config.stripe.publishableKey) {
      throw new Error('Stripe publishable key is required');
    }

    if (!this.config.stripe.webhookSecret) {
      console.warn('Stripe webhook secret not configured - webhooks will not work');
    }

    if (this.config.features.trialDays < 0 || this.config.features.trialDays > 365) {
      throw new Error('Trial days must be between 0 and 365');
    }
  }
}