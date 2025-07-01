import Stripe from 'stripe';
import { PaymentConfigManager } from './config';
import { PlanManager } from './plans';
import { SupportedCurrency } from '../i18n/config';
import { User, Subscription } from '../database/models';
import { EncryptionUtils } from '../utils/encryption';

export interface CreateSubscriptionOptions {
  userId: string;
  planId: string;
  currency: SupportedCurrency;
  interval: 'monthly' | 'yearly';
  paymentMethodId?: string;
  couponCode?: string;
  trialDays?: number;
  customerEmail?: string;
  customerName?: string;
  billingAddress?: Stripe.AddressParam;
}

export interface UpdateSubscriptionOptions {
  subscriptionId: string;
  newPlanId?: string;
  newInterval?: 'monthly' | 'yearly';
  newCurrency?: SupportedCurrency;
  prorate?: boolean;
}

export interface CreatePaymentIntentOptions {
  amount: number;
  currency: SupportedCurrency;
  customerId?: string;
  metadata?: Record<string, string>;
  description?: string;
  automaticPaymentMethods?: boolean;
}

export class StripeService {
  private stripe: Stripe;
  private config: PaymentConfigManager;
  private planManager: PlanManager;

  constructor(
    config: PaymentConfigManager = new PaymentConfigManager(),
    planManager: PlanManager = new PlanManager()
  ) {
    this.config = config;
    this.planManager = planManager;
    
    const stripeConfig = this.config.getConfig().stripe;
    this.stripe = new Stripe(stripeConfig.secretKey, {
      apiVersion: stripeConfig.apiVersion as Stripe.LatestApiVersion,
      typescript: true
    });
  }

  // Customer Management
  async createCustomer(email: string, name: string, metadata: Record<string, string> = {}): Promise<Stripe.Customer> {
    return this.stripe.customers.create({
      email,
      name,
      metadata: {
        source: 'cloudnest',
        ...metadata
      }
    });
  }

  async updateCustomer(customerId: string, updates: Stripe.CustomerUpdateParams): Promise<Stripe.Customer> {
    return this.stripe.customers.update(customerId, updates);
  }

  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    return this.stripe.customers.retrieve(customerId) as Promise<Stripe.Customer>;
  }

  async deleteCustomer(customerId: string): Promise<Stripe.DeletedCustomer> {
    return this.stripe.customers.del(customerId);
  }

  // Subscription Management
  async createSubscription(options: CreateSubscriptionOptions): Promise<{
    subscription: Stripe.Subscription;
    clientSecret?: string;
    setupIntent?: Stripe.SetupIntent;
  }> {
    try {
      // Get user details
      const user = await User.findById(options.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Create or get Stripe customer
      let customer: Stripe.Customer;
      if (user.subscription.stripeCustomerId) {
        customer = await this.getCustomer(user.subscription.stripeCustomerId);
      } else {
        customer = await this.createCustomer(
          options.customerEmail || user.email,
          options.customerName || user.name,
          { userId: options.userId }
        );

        // Update user with customer ID
        await User.findByIdAndUpdate(options.userId, {
          'subscription.stripeCustomerId': customer.id
        });
      }

      // Get Stripe price ID
      const stripePriceId = this.planManager.getStripePriceId(
        options.planId,
        options.currency,
        options.interval
      );

      if (!stripePriceId) {
        throw new Error(`Price not found for plan ${options.planId}`);
      }

      // Create subscription params
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customer.id,
        items: [{ price: stripePriceId }],
        currency: options.currency.toLowerCase(),
        metadata: {
          userId: options.userId,
          planId: options.planId,
          interval: options.interval
        },
        expand: ['latest_invoice.payment_intent'],
        payment_behavior: 'default_incomplete'
      };

      // Add trial if enabled and specified
      if (this.config.isFeatureEnabled('enableTrials') && options.trialDays) {
        subscriptionParams.trial_period_days = options.trialDays;
      }

      // Add coupon if provided
      if (options.couponCode && this.config.isFeatureEnabled('enableCoupons')) {
        subscriptionParams.discounts = [{
          coupon: options.couponCode
        }];
      }

      // Add payment method if provided
      if (options.paymentMethodId) {
        subscriptionParams.default_payment_method = options.paymentMethodId;
      }

      // Add billing address if provided
      if (options.billingAddress) {
        await this.updateCustomer(customer.id, {
          address: options.billingAddress
        });
      }

      // Create subscription
      const subscription = await this.stripe.subscriptions.create(subscriptionParams);

      const result: {
        subscription: Stripe.Subscription;
        clientSecret?: string;
        setupIntent?: Stripe.SetupIntent;
      } = { subscription };

      // Handle payment intent for immediate payment
      if (subscription.latest_invoice && typeof subscription.latest_invoice === 'object') {
        const invoice = subscription.latest_invoice as Stripe.Invoice;
        const paymentIntent = (invoice as any)?.payment_intent as Stripe.PaymentIntent | undefined;
        if (paymentIntent && typeof paymentIntent === 'object') {
          result.clientSecret = paymentIntent.client_secret || undefined;
        }
      }

      // Create setup intent if no payment method provided
      if (!options.paymentMethodId && !options.trialDays) {
        const setupIntent = await this.stripe.setupIntents.create({
          customer: customer.id,
          usage: 'off_session',
          metadata: {
            subscription_id: subscription.id
          }
        });
        result.setupIntent = setupIntent;
      }

      return result;

    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  async updateSubscription(options: UpdateSubscriptionOptions): Promise<Stripe.Subscription> {
    const subscription = await this.stripe.subscriptions.retrieve(options.subscriptionId);
    
    const updateParams: Stripe.SubscriptionUpdateParams = {
      proration_behavior: options.prorate ? 'create_prorations' : 'none'
    };

    // Update plan if specified
    if (options.newPlanId && (options.newInterval || options.newCurrency)) {
      const stripePriceId = this.planManager.getStripePriceId(
        options.newPlanId,
        options.newCurrency || 'USD',
        options.newInterval || 'monthly'
      );

      if (!stripePriceId) {
        throw new Error(`Price not found for plan ${options.newPlanId}`);
      }

      updateParams.items = [{
        id: subscription.items.data[0].id,
        price: stripePriceId
      }];

      updateParams.metadata = {
        ...subscription.metadata,
        planId: options.newPlanId,
        interval: options.newInterval || subscription.metadata?.interval || 'monthly'
      };
    }

    return this.stripe.subscriptions.update(options.subscriptionId, updateParams);
  }

  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<Stripe.Subscription> {
    if (immediately) {
      return this.stripe.subscriptions.cancel(subscriptionId);
    } else {
      return this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    }
  }

  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    });
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice', 'customer']
    });
  }

  // Payment Methods
  async createPaymentMethod(customerId: string, paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId
    });
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<Stripe.Customer> {
    return this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });
  }

  async getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });

    return paymentMethods.data;
  }

  async deletePaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.detach(paymentMethodId);
  }

  // Payment Intents
  async createPaymentIntent(options: CreatePaymentIntentOptions): Promise<Stripe.PaymentIntent> {
    const currencyConfig = this.config.getCurrencyConfig(options.currency);
    
    return this.stripe.paymentIntents.create({
      amount: options.amount,
      currency: currencyConfig.code,
      customer: options.customerId,
      metadata: options.metadata || {},
      description: options.description,
      automatic_payment_methods: options.automaticPaymentMethods ? {
        enabled: true
      } : undefined
    });
  }

  // Invoices
  async getInvoices(customerId: string, limit: number = 10): Promise<Stripe.Invoice[]> {
    const invoices = await this.stripe.invoices.list({
      customer: customerId,
      limit,
      expand: ['data.payment_intent']
    });

    return invoices.data;
  }

  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    return this.stripe.invoices.retrieve(invoiceId, {
      expand: ['payment_intent']
    });
  }

  async downloadInvoice(invoiceId: string): Promise<string> {
    const invoice = await this.getInvoice(invoiceId);
    return invoice.hosted_invoice_url || invoice.invoice_pdf || '';
  }

  // Billing Portal
  async createBillingPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    return this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });
  }

  // Coupons
  async createCoupon(options: {
    id?: string;
    name: string;
    percentOff?: number;
    amountOff?: number;
    currency?: SupportedCurrency;
    duration: 'forever' | 'once' | 'repeating';
    durationInMonths?: number;
    maxRedemptions?: number;
    redeemBy?: number;
  }): Promise<Stripe.Coupon> {
    return this.stripe.coupons.create({
      id: options.id,
      name: options.name,
      percent_off: options.percentOff,
      amount_off: options.amountOff,
      currency: options.currency?.toLowerCase(),
      duration: options.duration,
      duration_in_months: options.durationInMonths,
      max_redemptions: options.maxRedemptions,
      redeem_by: options.redeemBy
    });
  }

  async getCoupon(couponId: string): Promise<Stripe.Coupon> {
    return this.stripe.coupons.retrieve(couponId);
  }

  // Usage Records (for metered billing)
  async createUsageRecord(subscriptionItemId: string, quantity: number, timestamp?: number): Promise<Stripe.UsageRecord> {
    return this.stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
      quantity,
      timestamp: timestamp || Math.floor(Date.now() / 1000),
      action: 'set'
    });
  }

  // Webhook helpers
  constructWebhookEvent(payload: string | Buffer, signature: string, endpointSecret: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, endpointSecret);
  }

  // Utility methods
  formatAmount(amount: number, currency: SupportedCurrency): string {
    const currencyConfig = this.config.getCurrencyConfig(currency);
    const divisor = Math.pow(10, currencyConfig.decimals);
    const formattedAmount = amount / divisor;

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: currencyConfig.decimals,
      maximumFractionDigits: currencyConfig.decimals
    }).format(formattedAmount);
  }

  parseAmount(amount: number, currency: SupportedCurrency): number {
    const currencyConfig = this.config.getCurrencyConfig(currency);
    const multiplier = Math.pow(10, currencyConfig.decimals);
    return Math.round(amount * multiplier);
  }
}
