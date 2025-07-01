import { SupportedCurrency } from '../i18n/config';
import { STRIPE_CURRENCY_CONFIG } from './config';
import { DateUtils } from '../utils/date-utils';
import { StringUtils } from '../utils/string-utils';

export interface PaymentAmount {
  amount: number;
  currency: SupportedCurrency;
  formatted: string;
  cents: number;
}

export interface BillingCycle {
  start: Date;
  end: Date;
  daysRemaining: number;
  isInTrial: boolean;
  trialEndsAt?: Date;
}

export interface PaymentHistory {
  id: string;
  amount: PaymentAmount;
  status: 'succeeded' | 'failed' | 'pending' | 'refunded';
  description: string;
  createdAt: Date;
  invoiceUrl?: string;
  receiptUrl?: string;
}

export interface SubscriptionUsage {
  storageUsed: number;
  storageLimit: number;
  filesUsed: number;
  filesLimit: number;
  sharesUsed: number;
  sharesLimit: number;
  usagePercentage: number;
}

export class PaymentUtils {
  /**
   * Format amount for display
   */
  static formatAmount(
    amount: number,
    currency: SupportedCurrency,
    includeSymbol: boolean = true
  ): string {
    const config = STRIPE_CURRENCY_CONFIG[currency];
    const displayAmount = amount / Math.pow(10, config.decimals);

    if (!includeSymbol) {
      return displayAmount.toFixed(config.decimals);
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals
    }).format(displayAmount);
  }

  /**
   * Convert display amount to Stripe format (cents)
   */
  static toStripeAmount(amount: number, currency: SupportedCurrency): number {
    const config = STRIPE_CURRENCY_CONFIG[currency];
    return Math.round(amount * Math.pow(10, config.decimals));
  }

  /**
   * Convert Stripe amount to display format
   */
  static fromStripeAmount(amount: number, currency: SupportedCurrency): number {
    const config = STRIPE_CURRENCY_CONFIG[currency];
    return amount / Math.pow(10, config.decimals);
  }

  /**
   * Calculate tax amount
   */
  static calculateTax(amount: number, taxRate: number): number {
    return Math.round(amount * taxRate);
  }

  /**
   * Calculate discount amount
   */
  static calculateDiscount(
    amount: number,
    discount: { type: 'percentage' | 'fixed'; value: number },
    currency: SupportedCurrency
  ): number {
    if (discount.type === 'percentage') {
      return Math.round(amount * (discount.value / 100));
    } else {
      return this.toStripeAmount(discount.value, currency);
    }
  }

  /**
   * Calculate proration amount
   */
  static calculateProration(
    oldAmount: number,
    newAmount: number,
    daysRemaining: number,
    totalDays: number
  ): number {
    const oldProration = (oldAmount * daysRemaining) / totalDays;
    const newProration = (newAmount * daysRemaining) / totalDays;
    return Math.round(newProration - oldProration);
  }

  /**
   * Get billing cycle information
   */
  static getBillingCycle(
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    trialEnd?: Date
  ): BillingCycle {
    const now = new Date();
    const daysRemaining = Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    const isInTrial = trialEnd ? now < trialEnd : false;

    return {
      start: currentPeriodStart,
      end: currentPeriodEnd,
      daysRemaining: Math.max(0, daysRemaining),
      isInTrial,
      trialEndsAt: trialEnd
    };
  }

  /**
   * Check if amount meets minimum requirements
   */
  static isValidAmount(amount: number, currency: SupportedCurrency): boolean {
    const config = STRIPE_CURRENCY_CONFIG[currency];
    return amount >= config.minimumAmount;
  }

  /**
   * Get supported payment methods for currency
   */
  static getSupportedPaymentMethods(currency: SupportedCurrency): string[] {
    const config = STRIPE_CURRENCY_CONFIG[currency];
    return config.supportedPaymentMethods;
  }

  /**
   * Format payment method for display
   */
  static formatPaymentMethod(paymentMethod: any): string {
    if (paymentMethod.type === 'card') {
      const card = paymentMethod.card;
      return `•••• •••• •••• ${card.last4} (${card.brand.toUpperCase()})`;
    }
    
    return StringUtils.toTitleCase(paymentMethod.type.replace('_', ' '));
  }

  /**
   * Get payment status display info
   */
  static getPaymentStatusInfo(status: string): {
    label: string;
    color: 'green' | 'red' | 'yellow' | 'blue';
    icon: string;
  } {
    const statusMap: Record<string, { label: string; color: 'green' | 'red' | 'yellow' | 'blue'; icon: string }> = {
      succeeded: { label: 'Paid', color: 'green', icon: '✅' },
      failed: { label: 'Failed', color: 'red', icon: '❌' },
      pending: { label: 'Pending', color: 'yellow', icon: '⏳' },
      refunded: { label: 'Refunded', color: 'blue', icon: '🔄' },
      canceled: { label: 'Canceled', color: 'red', icon: '❌' },
      requires_payment_method: { label: 'Payment Required', color: 'yellow', icon: '💳' },
      requires_confirmation: { label: 'Confirmation Required', color: 'yellow', icon: '⚠️' },
      requires_action: { label: 'Action Required', color: 'yellow', icon: '⚡' }
    };

    return statusMap[status] || { label: StringUtils.toTitleCase(status), color: 'blue', icon: 'ℹ️' };
  }

  /**
   * Calculate subscription metrics
   */
  static calculateSubscriptionMetrics(
    amount: number,
    interval: 'monthly' | 'yearly',
    currency: SupportedCurrency
  ): {
    monthlyEquivalent: number;
    yearlyEquivalent: number;
    savings: number;
    savingsPercentage: number;
  } {
    const monthlyAmount = interval === 'monthly' ? amount : Math.round(amount / 12);
    const yearlyAmount = interval === 'yearly' ? amount : amount * 12;
    
    const savings = interval === 'yearly' ? (monthlyAmount * 12) - amount : 0;
    const savingsPercentage = interval === 'yearly' ? ((monthlyAmount * 12 - amount) / (monthlyAmount * 12)) * 100 : 0;

    return {
      monthlyEquivalent: monthlyAmount,
      yearlyEquivalent: yearlyAmount,
      savings,
      savingsPercentage: Math.round(savingsPercentage)
    };
  }

  /**
   * Generate payment description
   */
  static generatePaymentDescription(
    planName: string,
    interval: 'monthly' | 'yearly',
    period?: { start: Date; end: Date }
  ): string {
    const intervalText = interval === 'monthly' ? 'Monthly' : 'Yearly';
    let description = `${planName} Plan - ${intervalText} Subscription`;
    
    if (period) {
      const startDate = DateUtils.formatDate(period.start, 'en', { month: 'short', day: 'numeric' });
      const endDate = DateUtils.formatDate(period.end, 'en', { month: 'short', day: 'numeric', year: 'numeric' });
      description += ` (${startDate} - ${endDate})`;
    }
    
    return description;
  }

  /**
   * Calculate usage percentage
   */
  static calculateUsage(used: number, limit: number): {
    percentage: number;
    isNearLimit: boolean;
    isOverLimit: boolean;
  } {
    const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
    
    return {
      percentage: Math.round(percentage),
      isNearLimit: percentage >= 90,
      isOverLimit: used > limit
    };
  }

  /**
   * Get next billing date
   */
  static getNextBillingDate(
    currentPeriodEnd: Date,
    interval: 'monthly' | 'yearly'
  ): Date {
    const nextBilling = new Date(currentPeriodEnd);
    
    if (interval === 'monthly') {
      nextBilling.setMonth(nextBilling.getMonth() + 1);
    } else {
      nextBilling.setFullYear(nextBilling.getFullYear() + 1);
    }
    
    return nextBilling;
  }

  /**
   * Validate coupon code format
   */
  static isValidCouponCode(code: string): boolean {
    // Coupon codes should be 3-50 characters, alphanumeric with hyphens/underscores
    return /^[A-Z0-9_-]{3,50}$/i.test(code);
  }

  /**
   * Generate invoice number
   */
  static generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = StringUtils.generateRandomString(6, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
    
    return `CN-${year}${month}-${random}`;
  }

  /**
   * Calculate refund amount
   */
  static calculateRefund(
    totalAmount: number,
    refundType: 'full' | 'partial' | 'prorated',
    options?: {
      partialAmount?: number;
      daysUsed?: number;
      totalDays?: number;
    }
  ): number {
    switch (refundType) {
      case 'full':
        return totalAmount;
      
      case 'partial':
        return options?.partialAmount || 0;
      
      case 'prorated':
        if (options?.daysUsed && options?.totalDays) {
          const unusedDays = options.totalDays - options.daysUsed;
          return Math.round((totalAmount * unusedDays) / options.totalDays);
        }
        return 0;
      
      default:
        return 0;
    }
  }

  /**
   * Format billing address
   */
  static formatBillingAddress(address: any): string {
    if (!address) return '';
    
    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.postal_code,
      address.country
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  /**
   * Get currency symbol
   */
  static getCurrencySymbol(currency: SupportedCurrency): string {
    const symbols: Record<SupportedCurrency, string> = {
      USD: '$',
      IDR: 'Rp'
    };
    
    return symbols[currency] || currency;
  }
}