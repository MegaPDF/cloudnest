// src/lib/config/stripe.ts
import { env } from './env';
import { SupportedCurrency } from '@/lib/i18n/config';
import { SUBSCRIPTION_PLANS, STORAGE_LIMITS } from '@/lib/utils/constants';

export interface StripeConfig {
  apiVersion: string;
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  features: {
    billing: boolean;
    subscriptions: boolean;
    invoices: boolean;
    paymentMethods: boolean;
    checkout: boolean;
    portal: boolean;
    trials: boolean;
    coupons: boolean;
    metering: boolean;
  };
  webhooks: {
    enabledEvents: string[];
    tolerance: number;
    maxRetries: number;
    retryDelay: number;
  };
  checkout: {
    mode: 'payment' | 'subscription' | 'setup';
    successUrl: string;
    cancelUrl: string;
    allowPromotionCodes: boolean;
    collectTaxes: boolean;
    billingAddressCollection: 'auto' | 'required';
    phoneNumberCollection: boolean;
    consentCollection: {
      promotions: 'auto' | 'none';
      termsOfService: 'required' | 'none';
    };
  };
  portal: {
    features: {
      paymentMethodUpdate: boolean;
      subscriptionCancel: boolean;
      subscriptionPause: boolean;
      subscriptionUpdate: boolean;
      invoiceHistory: boolean;
    };
    returnUrl: string;
  };
  trial: {
    enabled: boolean;
    periodDays: number;
    requirePaymentMethod: boolean;
  };
  taxes: {
    enabled: boolean;
    automaticTax: boolean;
    taxIdCollection: boolean;
  };
}

export interface StripePlan {
  id: string;
  name: string;
  description: string;
  features: string[];
  storageLimit: number;
  prices: {
    [K in SupportedCurrency]: {
      monthly: {
        amount: number;
        priceId: string;
      };
      yearly: {
        amount: number;
        priceId: string;
        discount: number; // percentage discount compared to monthly
      };
    };
  };
  limits: {
    files: number;
    shares: number;
    bandwidth: number; // bytes per month
    apiCalls: number; // per month
  };
  support: 'community' | 'email' | 'priority';
  sla: number; // uptime percentage
  isPopular: boolean;
  isEnterprise: boolean;
}

export interface StripeWebhookEvent {
  type: string;
  handler: string;
  description: string;
  critical: boolean;
}

// Main Stripe configuration
export const stripeConfig: StripeConfig = {
  apiVersion: env.STRIPE_API_VERSION,
  secretKey: env.STRIPE_SECRET_KEY || '',
  publishableKey: env.STRIPE_PUBLISHABLE_KEY || '',
  webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
  features: {
    billing: Boolean(env.STRIPE_SECRET_KEY),
    subscriptions: Boolean(env.STRIPE_SECRET_KEY),
    invoices: Boolean(env.STRIPE_SECRET_KEY),
    paymentMethods: Boolean(env.STRIPE_SECRET_KEY),
    checkout: Boolean(env.STRIPE_SECRET_KEY),
    portal: Boolean(env.STRIPE_SECRET_KEY),
    trials: true,
    coupons: true,
    metering: false,
  },
  webhooks: {
    enabledEvents: [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'invoice.upcoming',
      'customer.created',
      'customer.updated',
      'customer.deleted',
      'payment_method.attached',
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'checkout.session.completed',
      'customer.subscription.trial_will_end',
    ],
    tolerance: 300, // 5 minutes
    maxRetries: 3,
    retryDelay: 5000, // 5 seconds
  },
  checkout: {
    mode: 'subscription',
    successUrl: `${env.NEXTAUTH_URL}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${env.NEXTAUTH_URL}/upgrade?canceled=true`,
    allowPromotionCodes: true,
    collectTaxes: true,
    billingAddressCollection: 'auto',
    phoneNumberCollection: false,
    consentCollection: {
      promotions: 'auto',
      termsOfService: 'required',
    },
  },
  portal: {
    features: {
      paymentMethodUpdate: true,
      subscriptionCancel: true,
      subscriptionPause: false,
      subscriptionUpdate: true,
      invoiceHistory: true,
    },
    returnUrl: `${env.NEXTAUTH_URL}/settings/billing`,
  },
  trial: {
    enabled: true,
    periodDays: 14,
    requirePaymentMethod: true,
  },
  taxes: {
    enabled: true,
    automaticTax: true,
    taxIdCollection: true,
  },
};

// Subscription plans configuration
export const stripePlans: Record<string, StripePlan> = {
  [SUBSCRIPTION_PLANS.FREE]: {
    id: SUBSCRIPTION_PLANS.FREE,
    name: 'Free',
    description: 'Perfect for getting started with basic file storage needs',
    features: [
      '5GB storage',
      'Basic file sharing',
      'Web access',
      'Community support',
      'Basic file preview',
      'Folder organization',
    ],
    storageLimit: STORAGE_LIMITS.FREE,
    prices: {
      USD: {
        monthly: { amount: 0, priceId: '' },
        yearly: { amount: 0, priceId: '', discount: 0 },
      },
      IDR: {
        monthly: { amount: 0, priceId: '' },
        yearly: { amount: 0, priceId: '', discount: 0 },
      },
    },
    limits: {
      files: 1000,
      shares: 10,
      bandwidth: 10 * 1024 * 1024 * 1024, // 10GB per month
      apiCalls: 1000,
    },
    support: 'community',
    sla: 99.0,
    isPopular: false,
    isEnterprise: false,
  },
  [SUBSCRIPTION_PLANS.PRO]: {
    id: SUBSCRIPTION_PLANS.PRO,
    name: 'Pro',
    description: 'Advanced features for professionals and growing teams',
    features: [
      '100GB storage',
      'Advanced file sharing',
      'Password protection',
      'Email support',
      'File versioning',
      'Advanced previews',
      'Custom branding',
      'Priority uploads',
      'Extended retention',
      'Analytics dashboard',
    ],
    storageLimit: STORAGE_LIMITS.PRO,
    prices: {
      USD: {
        monthly: { amount: 999, priceId: 'price_pro_monthly_usd' }, // $9.99
        yearly: { amount: 9999, priceId: 'price_pro_yearly_usd', discount: 17 }, // $99.99 (17% discount)
      },
      IDR: {
        monthly: { amount: 149000, priceId: 'price_pro_monthly_idr' }, // 149,000 IDR
        yearly: { amount: 1490000, priceId: 'price_pro_yearly_idr', discount: 17 }, // 1,490,000 IDR (17% discount)
      },
    },
    limits: {
      files: 50000,
      shares: 100,
      bandwidth: 500 * 1024 * 1024 * 1024, // 500GB per month
      apiCalls: 10000,
    },
    support: 'email',
    sla: 99.5,
    isPopular: true,
    isEnterprise: false,
  },
  [SUBSCRIPTION_PLANS.ENTERPRISE]: {
    id: SUBSCRIPTION_PLANS.ENTERPRISE,
    name: 'Enterprise',
    description: 'Full-featured solution for large teams and organizations',
    features: [
      '1TB storage',
      'Unlimited file sharing',
      'Advanced security',
      'Priority support',
      'SSO integration',
      'Advanced analytics',
      'Custom branding',
      'API access',
      'Backup & restore',
      'Audit logs',
      'Team management',
      'Custom integrations',
    ],
    storageLimit: STORAGE_LIMITS.ENTERPRISE,
    prices: {
      USD: {
        monthly: { amount: 2999, priceId: 'price_enterprise_monthly_usd' }, // $29.99
        yearly: { amount: 29999, priceId: 'price_enterprise_yearly_usd', discount: 17 }, // $299.99 (17% discount)
      },
      IDR: {
        monthly: { amount: 449000, priceId: 'price_enterprise_monthly_idr' }, // 449,000 IDR
        yearly: { amount: 4490000, priceId: 'price_enterprise_yearly_idr', discount: 17 }, // 4,490,000 IDR (17% discount)
      },
    },
    limits: {
      files: 1000000,
      shares: 1000,
      bandwidth: 5 * 1024 * 1024 * 1024 * 1024, // 5TB per month
      apiCalls: 100000,
    },
    support: 'priority',
    sla: 99.9,
    isPopular: false,
    isEnterprise: true,
  },
};

// Webhook events configuration
export const webhookEvents: Record<string, StripeWebhookEvent> = {
  'customer.subscription.created': {
    type: 'customer.subscription.created',
    handler: 'handleSubscriptionCreated',
    description: 'New subscription created',
    critical: true,
  },
  'customer.subscription.updated': {
    type: 'customer.subscription.updated',
    handler: 'handleSubscriptionUpdated',
    description: 'Subscription updated',
    critical: true,
  },
  'customer.subscription.deleted': {
    type: 'customer.subscription.deleted',
    handler: 'handleSubscriptionDeleted',
    description: 'Subscription cancelled',
    critical: true,
  },
  'invoice.payment_succeeded': {
    type: 'invoice.payment_succeeded',
    handler: 'handlePaymentSucceeded',
    description: 'Payment successful',
    critical: true,
  },
  'invoice.payment_failed': {
    type: 'invoice.payment_failed',
    handler: 'handlePaymentFailed',
    description: 'Payment failed',
    critical: true,
  },
  'invoice.upcoming': {
    type: 'invoice.upcoming',
    handler: 'handleUpcomingInvoice',
    description: 'Upcoming invoice (3 days before)',
    critical: false,
  },
  'customer.subscription.trial_will_end': {
    type: 'customer.subscription.trial_will_end',
    handler: 'handleTrialWillEnd',
    description: 'Trial ending soon (3 days before)',
    critical: false,
  },
  'checkout.session.completed': {
    type: 'checkout.session.completed',
    handler: 'handleCheckoutCompleted',
    description: 'Checkout session completed',
    critical: true,
  },
};

// Currency configurations for Stripe
export const stripeCurrencyConfig: Record<SupportedCurrency, {
  code: string;
  symbol: string;
  decimals: number;
  minimumAmount: number;
  maximumAmount: number;
  supportedPaymentMethods: string[];
  taxSupported: boolean;
}> = {
  USD: {
    code: 'usd',
    symbol: '$',
    decimals: 2,
    minimumAmount: 50, // $0.50
    maximumAmount: 99999900, // $999,999.00
    supportedPaymentMethods: ['card', 'bank_transfer', 'ach_debit', 'link'],
    taxSupported: true,
  },
  IDR: {
    code: 'idr',
    symbol: 'Rp',
    decimals: 0,
    minimumAmount: 1000, // 1,000 IDR
    maximumAmount: 400000000000, // 400,000,000,000 IDR
    supportedPaymentMethods: ['card', 'bank_transfer'],
    taxSupported: true,
  },
};

// Coupon configurations
export const couponConfigs = {
  welcome: {
    id: 'WELCOME50',
    name: 'Welcome Discount',
    description: '50% off first month for new users',
    type: 'percent_off' as const,
    amount: 50,
    duration: 'once' as const,
    maxRedemptions: 1000,
    active: true,
  },
  annual: {
    id: 'ANNUAL20',
    name: 'Annual Plan Discount',
    description: '20% off annual plans',
    type: 'percent_off' as const,
    amount: 20,
    duration: 'once' as const,
    appliesTo: ['yearly'],
    active: true,
  },
  student: {
    id: 'STUDENT30',
    name: 'Student Discount',
    description: '30% off for students',
    type: 'percent_off' as const,
    amount: 30,
    duration: 'forever' as const,
    requirements: ['student_verification'],
    active: true,
  },
};

// Tax configurations by region
export const taxConfigurations = {
  US: {
    enabled: true,
    automaticTax: true,
    taxBehavior: 'exclusive' as const,
    taxCodeMapping: {
      storage: 'txcd_10103001', // Cloud storage services
      support: 'txcd_10401300', // Support services
    },
  },
  ID: {
    enabled: true,
    automaticTax: true,
    taxBehavior: 'inclusive' as const,
    vatRate: 11, // 11% VAT in Indonesia
    taxCodeMapping: {
      storage: 'txcd_10103001',
      support: 'txcd_10401300',
    },
  },
  EU: {
    enabled: true,
    automaticTax: true,
    taxBehavior: 'exclusive' as const,
    vatRequired: true,
    taxCodeMapping: {
      storage: 'txcd_10103001',
      support: 'txcd_10401300',
    },
  },
};

// Payment method configurations by region
export const paymentMethodConfigs = {
  US: {
    card: { enabled: true, priority: 1 },
    ach_debit: { enabled: true, priority: 2 },
    link: { enabled: true, priority: 3 },
    bank_transfer: { enabled: false, priority: 4 },
  },
  ID: {
    card: { enabled: true, priority: 1 },
    bank_transfer: { enabled: true, priority: 2 },
    gopay: { enabled: false, priority: 3 }, // Future support
    shopeepay: { enabled: false, priority: 4 }, // Future support
  },
  EU: {
    card: { enabled: true, priority: 1 },
    sepa_debit: { enabled: true, priority: 2 },
    sofort: { enabled: true, priority: 3 },
    eps: { enabled: true, priority: 4 },
  },
  DEFAULT: {
    card: { enabled: true, priority: 1 },
  },
};

// Stripe metadata keys used throughout the application
export const metadataKeys = {
  USER_ID: 'user_id',
  PLAN_ID: 'plan_id',
  BILLING_CYCLE: 'billing_cycle',
  UPGRADE_FROM: 'upgrade_from',
  COUPON_CODE: 'coupon_code',
  REFERRAL_CODE: 'referral_code',
  COMPANY_NAME: 'company_name',
  COMPANY_SIZE: 'company_size',
  USE_CASE: 'use_case',
  SOURCE: 'source',
  CAMPAIGN: 'campaign',
};

// Billing portal configuration
export const billingPortalConfig = {
  businessProfile: {
    headline: 'Manage your CloudNest subscription',
    privacyPolicyUrl: `${env.NEXTAUTH_URL}/privacy`,
    termsOfServiceUrl: `${env.NEXTAUTH_URL}/terms`,
  },
  features: {
    paymentMethodUpdate: {
      enabled: true,
    },
    subscriptionUpdate: {
      enabled: true,
      defaultAllowedUpdates: ['price', 'promotion_code', 'quantity'],
      proration_behavior: 'create_prorations',
    },
    subscriptionCancel: {
      enabled: true,
      mode: 'at_period_end',
      cancellationReason: {
        enabled: true,
        options: [
          'too_expensive',
          'missing_features',
          'switched_service',
          'unused',
          'other',
        ],
      },
    },
    invoiceHistory: {
      enabled: true,
    },
  },
  customFields: [
    {
      key: 'company_name',
      label: {
        type: 'custom',
        custom: 'Company name',
      },
      type: 'text',
      optional: true,
    },
  ],
};

// Development/testing configurations
export const testingConfig = {
  enabled: env.NODE_ENV !== 'production',
  testClocks: {
    enabled: false,
    scenarios: {
      trialExpiring: '2024-01-01T00:00:00Z',
      subscriptionRenewal: '2024-02-01T00:00:00Z',
      paymentFailed: '2024-01-15T00:00:00Z',
    },
  },
  webhookTesting: {
    enabled: env.NODE_ENV === 'development',
    endpoint: `${env.NEXTAUTH_URL}/api/payments/webhook`,
    events: Object.keys(webhookEvents),
  },
};

export default {
  config: stripeConfig,
  plans: stripePlans,
  webhooks: webhookEvents,
  currencies: stripeCurrencyConfig,
  coupons: couponConfigs,
  taxes: taxConfigurations,
  paymentMethods: paymentMethodConfigs,
  metadata: metadataKeys,
  portal: billingPortalConfig,
  testing: testingConfig,
};