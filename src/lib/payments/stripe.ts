import Stripe from 'stripe';
import { connectToDatabase } from '../database/connection';
import { User, Subscription } from '../database/models';
import { PaymentConfigManager, STRIPE_CURRENCY_CONFIG } from './config';
import { PaymentUtils } from './utils';
import { PlanManager, SUBSCRIPTION_PLANS_CONFIG } from './plans';
import { SupportedCurrency } from '../i18n/config';
import { 
  BillingInfo, 
  SubscriptionCreate, 
  SubscriptionUpdate, 
  BillingPortalSession,
  PaymentMethod,
  Invoice,
  Plan,
  SubscriptionStatus
} from '@/types/subscription';
import { ObjectId } from 'mongoose';

export class StripeService {
  private stripe: Stripe;
  private planManager: PlanManager;
  
  constructor(secretKey?: string) {
    if (!secretKey && !process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe secret key is required');
    }
    
    this.stripe = new Stripe(secretKey || process.env.STRIPE_SECRET_KEY!, {
      typescript: true,
      apiVersion: '2023-10-16', // Specify API version for consistency
    });
    
    this.planManager = new PlanManager(SUBSCRIPTION_PLANS_CONFIG);
  }

  /**
   * Create a new Stripe customer
   */
  async createCustomer(email: string, name: string, metadata?: Record<string, string>): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          source: 'cloudnest',
          ...metadata
        }
      });
      
      return customer;
    } catch (error) {
      throw new Error(`Failed to create Stripe customer: ${(error as Error).message}`);
    }
  }

  /**
   * Get or create customer for user
   */
  async getOrCreateCustomer(userId: string | ObjectId): Promise<Stripe.Customer> {
    await connectToDatabase();
    
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // If user already has a Stripe customer ID, retrieve it
    if (user.subscription.stripeCustomerId) {
      try {
        const customer = await this.stripe.customers.retrieve(user.subscription.stripeCustomerId);
        if (!customer.deleted) {
          return customer as Stripe.Customer;
        }
      } catch (error) {
        console.warn(`Failed to retrieve existing customer: ${error}`);
      }
    }

    // Create new customer
    const customer = await this.createCustomer(
      user.email,
      user.name,
      { userId: userId.toString() }
    );

    // Update user with customer ID
    user.subscription.stripeCustomerId = customer.id;
    await user.save();

    return customer;
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(data: {
    userId: string | ObjectId;
    planId: string;
    currency: SupportedCurrency;
    interval: 'monthly' | 'yearly';
    successUrl: string;
    cancelUrl: string;
    couponCode?: string;
    trialDays?: number;
  }): Promise<Stripe.Checkout.Session> {
    try {
      const customer = await this.getOrCreateCustomer(data.userId);
      const stripePriceId = this.planManager.getStripePriceId(data.planId, data.currency, data.interval);
      
      if (!stripePriceId) {
        throw new Error(`Price not found for plan ${data.planId} in ${data.currency}`);
      }

      const sessionData: Stripe.Checkout.SessionCreateParams = {
        customer: customer.id,
        mode: 'subscription',
        line_items: [
          {
            price: stripePriceId,
            quantity: 1,
          },
        ],
        success_url: data.successUrl,
        cancel_url: data.cancelUrl,
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        metadata: {
          userId: data.userId.toString(),
          planId: data.planId,
          currency: data.currency,
          interval: data.interval
        }
      };

      // Add trial if specified
      if (data.trialDays && data.trialDays > 0) {
        sessionData.subscription_data = {
          trial_period_days: data.trialDays,
          metadata: sessionData.metadata
        };
      }

      // Add coupon if provided
      if (data.couponCode) {
        sessionData.discounts = [{ coupon: data.couponCode }];
      }

      const session = await this.stripe.checkout.sessions.create(sessionData);
      return session;
    } catch (error) {
      throw new Error(`Failed to create checkout session: ${(error as Error).message}`);
    }
  }

  /**
   * Create subscription directly (for programmatic creation)
   */
  async createSubscription(data: SubscriptionCreate): Promise<{ 
    subscription: Stripe.Subscription; 
    customer: Stripe.Customer 
  }> {
    try {
      const customer = await this.getOrCreateCustomer(data.userId);
      
      // Get plan and price information
      const plan = this.planManager.getPlan(data.planId);
      if (!plan) {
        throw new Error(`Plan ${data.planId} not found`);
      }

      // Determine currency and interval from plan
      const currency: SupportedCurrency = 'USD'; // Default, could be passed in data
      const interval = 'monthly'; // Default, could be passed in data
      const stripePriceId = this.planManager.getStripePriceId(data.planId, currency, interval);
      
      if (!stripePriceId) {
        throw new Error(`Price not found for plan ${data.planId}`);
      }

      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: customer.id,
        items: [{ price: stripePriceId }],
        metadata: {
          userId: data.userId.toString(),
          planId: data.planId,
          currency,
          interval
        }
      };

      // Add payment method if provided
      if (data.paymentMethodId) {
        subscriptionData.default_payment_method = data.paymentMethodId;
      }

      // Add trial if specified
      if (data.trialDays && data.trialDays > 0) {
        subscriptionData.trial_period_days = data.trialDays;
      }

      // Add coupon if provided
      if (data.couponCode) {
        subscriptionData.discounts = [{ coupon: data.couponCode }];
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionData);
      
      return { subscription, customer };
    } catch (error) {
      throw new Error(`Failed to create subscription: ${(error as Error).message}`);
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    subscriptionId: string, 
    updates: SubscriptionUpdate
  ): Promise<Stripe.Subscription> {
    try {
      const updateData: Stripe.SubscriptionUpdateParams = {};

      if (updates.planId) {
        // Get current subscription to get currency and interval
        const currentSub = await this.stripe.subscriptions.retrieve(subscriptionId);
        const currency = (currentSub.metadata?.currency as SupportedCurrency) || 'USD';
        const interval = (currentSub.metadata?.interval as 'monthly' | 'yearly') || 'monthly';
        
        const newStripePriceId = this.planManager.getStripePriceId(updates.planId, currency, interval);
        if (!newStripePriceId) {
          throw new Error(`Price not found for plan ${updates.planId}`);
        }

        const firstItem = currentSub.items?.data?.[0];
        if (!firstItem) {
          throw new Error('No subscription items found');
        }

        updateData.items = [
          {
            id: firstItem.id,
            price: newStripePriceId,
          },
        ];
        updateData.proration_behavior = 'create_prorations';
      }

      if (updates.cancelAtPeriodEnd !== undefined) {
        updateData.cancel_at_period_end = updates.cancelAtPeriodEnd;
      }

      if (updates.metadata) {
        updateData.metadata = updates.metadata;
      }

      const subscription = await this.stripe.subscriptions.update(subscriptionId, updateData);
      return subscription;
    } catch (error) {
      throw new Error(`Failed to update subscription: ${(error as Error).message}`);
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<Stripe.Subscription> {
    try {
      if (cancelAtPeriodEnd) {
        return await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      } else {
        return await this.stripe.subscriptions.cancel(subscriptionId);
      }
    } catch (error) {
      throw new Error(`Failed to cancel subscription: ${(error as Error).message}`);
    }
  }

  /**
   * Reactivate subscription
   */
  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });
    } catch (error) {
      throw new Error(`Failed to reactivate subscription: ${(error as Error).message}`);
    }
  }

  /**
   * Create billing portal session
   */
  async createBillingPortalSession(
    customerId: string, 
    returnUrl: string
  ): Promise<BillingPortalSession> {
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      return {
        url: session.url,
        returnUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };
    } catch (error) {
      throw new Error(`Failed to create billing portal session: ${(error as Error).message}`);
    }
  }

  /**
   * Get customer's payment methods using your PaymentMethod type
   */
  async getPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    try {
      const [paymentMethods, customer] = await Promise.all([
        this.stripe.paymentMethods.list({
          customer: customerId,
          type: 'card',
        }),
        this.stripe.customers.retrieve(customerId) as Promise<Stripe.Customer>
      ]);

      const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method as string | undefined;

      return paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type as PaymentMethod['type'],
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        } : undefined,
        isDefault: pm.id === defaultPaymentMethodId
      }));
    } catch (error) {
      throw new Error(`Failed to get payment methods: ${(error as Error).message}`);
    }
  }

  /**
   * Get customer's invoices using your Invoice type
   */
  async getInvoices(customerId: string, limit: number = 10): Promise<Invoice[]> {
    try {
      const invoices = await this.stripe.invoices.list({
        customer: customerId,
        limit,
      });

      return invoices.data.map(invoice => ({
        id: invoice.id || '',
        number: invoice.number || '',
        amount: invoice.total,
        currency: invoice.currency.toUpperCase(),
        status: invoice.status as Invoice['status'],
        dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : new Date(),
        paidAt: invoice.status_transitions.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : undefined,
        downloadUrl: invoice.hosted_invoice_url || '',
        createdAt: new Date(invoice.created * 1000),
        items: invoice.lines.data.map(item => ({
          description: item.description || '',
          amount: item.amount,
          quantity: item.quantity || 1,
          period: {
            start: new Date(item.period.start * 1000),
            end: new Date(item.period.end * 1000),
          }
        }))
      }));
    } catch (error) {
      throw new Error(`Failed to get invoices: ${(error as Error).message}`);
    }
  }

  /**
   * Record usage for metered billing
   */
  async recordUsage(subscriptionItemId: string, quantity: number, timestamp?: Date): Promise<void> {
    try {
      // Using the Stripe SDK directly
      const response = await this.stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
        quantity,
        timestamp: timestamp ? Math.floor(timestamp.getTime() / 1000) : Math.floor(Date.now() / 1000),
        action: 'increment',
      });
    } catch (error) {
      // If the method doesn't exist in the SDK, fall back to direct API call
      try {
        await fetch(`https://api.stripe.com/v1/subscription_items/${subscriptionItemId}/usage_records`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            quantity: quantity.toString(),
            timestamp: timestamp ? Math.floor(timestamp.getTime() / 1000).toString() : Math.floor(Date.now() / 1000).toString(),
            action: 'increment',
          }),
        });
      } catch (fallbackError) {
        throw new Error(`Failed to record usage: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Create payment intent for one-time payments
   */
  async createPaymentIntent(
    amount: number,
    currency: SupportedCurrency,
    customerId?: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.PaymentIntent> {
    try {
      const currencyConfig = STRIPE_CURRENCY_CONFIG[currency];
      const stripeAmount = PaymentUtils.toStripeAmount(amount, currency);

      if (stripeAmount < currencyConfig.minimumAmount) {
        throw new Error(`Amount below minimum for ${currency}`);
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: stripeAmount,
        currency: currencyConfig.code,
        customer: customerId,
        metadata: {
          source: 'cloudnest',
          ...metadata
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return paymentIntent;
    } catch (error) {
      throw new Error(`Failed to create payment intent: ${(error as Error).message}`);
    }
  }

  /**
   * Refund payment
   */
  async createRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: string
  ): Promise<Stripe.Refund> {
    try {
      const refundData: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
      };

      if (amount) {
        refundData.amount = amount;
      }

      if (reason) {
        refundData.reason = reason as Stripe.RefundCreateParams.Reason;
      }

      return await this.stripe.refunds.create(refundData);
    } catch (error) {
      throw new Error(`Failed to create refund: ${(error as Error).message}`);
    }
  }

  /**
   * Get customer billing info using your BillingInfo type
   */
  async getBillingInfo(customerId: string): Promise<BillingInfo> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId, {
        expand: ['tax_ids']
      }) as Stripe.Customer;
      
      // Get default payment method
      let paymentMethod: PaymentMethod | undefined;
      if (customer.invoice_settings?.default_payment_method) {
        const pm = await this.stripe.paymentMethods.retrieve(
          customer.invoice_settings.default_payment_method as string
        );
        
        paymentMethod = {
          id: pm.id,
          type: pm.type as PaymentMethod['type'],
          card: pm.card ? {
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          } : undefined,
          isDefault: true
        };
      }

      return {
        customerId: customer.id,
        email: customer.email || '',
        name: customer.name || '',
        address: customer.address ? {
          line1: customer.address.line1 || '',
          line2: customer.address.line2 || undefined,
          city: customer.address.city || '',
          state: customer.address.state || undefined,
          postalCode: customer.address.postal_code || '',
          country: customer.address.country || '',
        } : undefined,
        taxId: customer.tax_ids?.data?.[0]?.value,
        currency: 'USD', // Default, could be stored in metadata
        paymentMethod
      };
    } catch (error) {
      throw new Error(`Failed to get billing info: ${(error as Error).message}`);
    }
  }

  /**
   * Update customer billing info
   */
  async updateBillingInfo(customerId: string, billingInfo: Partial<BillingInfo>): Promise<Stripe.Customer> {
    try {
      const updateData: Stripe.CustomerUpdateParams = {};

      if (billingInfo.email) updateData.email = billingInfo.email;
      if (billingInfo.name) updateData.name = billingInfo.name;
      
      if (billingInfo.address) {
        updateData.address = {
          line1: billingInfo.address.line1,
          line2: billingInfo.address.line2,
          city: billingInfo.address.city,
          state: billingInfo.address.state,
          postal_code: billingInfo.address.postalCode,
          country: billingInfo.address.country,
        };
      }

      return await this.stripe.customers.update(customerId, updateData);
    } catch (error) {
      throw new Error(`Failed to update billing info: ${(error as Error).message}`);
    }
  }

  /**
   * Sync subscription from Stripe to database using your types
   */
  async syncSubscriptionFromStripe(stripeSubscriptionId: string): Promise<void> {
    try {
      await connectToDatabase();
      
      const stripeSubscription = await this.stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ['customer', 'items.data.price']
      });

      const userId = stripeSubscription.metadata?.userId;
      if (!userId) {
        throw new Error('User ID not found in subscription metadata');
      }

      // Get plan info from Stripe price
      const priceId = stripeSubscription.items.data[0]?.price?.id;
      if (!priceId) {
        throw new Error('Price ID not found in subscription');
      }

      const planInfo = this.planManager.getPlanByStripePriceId(priceId);
      if (!planInfo) {
        throw new Error(`Plan not found for Stripe price ID: ${priceId}`);
      }

      // Find or create subscription in database
      let subscription = await Subscription.findByStripeId(stripeSubscriptionId);
      
      const subscriptionData = {
        user: userId,
        stripeCustomerId: typeof stripeSubscription.customer === 'string' 
          ? stripeSubscription.customer 
          : stripeSubscription.customer?.id || '',
        stripeSubscriptionId: stripeSubscriptionId,
        stripePriceId: priceId,
        plan: planInfo.plan,
        status: stripeSubscription.status as SubscriptionStatus,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
        canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : undefined,
        trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : undefined,
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : undefined,
        metadata: stripeSubscription.metadata || {}
      };

      if (!subscription) {
        subscription = new Subscription(subscriptionData);
      } else {
        // Update existing subscription
        Object.assign(subscription, {
          status: subscriptionData.status,
          currentPeriodStart: subscriptionData.currentPeriodStart,
          currentPeriodEnd: subscriptionData.currentPeriodEnd,
          cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd,
          canceledAt: subscriptionData.canceledAt,
          metadata: subscriptionData.metadata
        });
      }

      await subscription.save();

      // Update user's subscription info
      const user = await User.findById(userId);
      if (user) {
        user.subscription.plan = planInfo.plan.id as 'free' | 'pro' | 'enterprise';
        user.subscription.status = stripeSubscription.status as any;
        user.subscription.stripeCustomerId = subscriptionData.stripeCustomerId;
        user.subscription.stripeSubscriptionId = stripeSubscriptionId;
        user.subscription.currentPeriodEnd = subscriptionData.currentPeriodEnd;
        
        // Update storage limit based on plan
        user.storage.limit = planInfo.plan.storageLimit;
        
        await user.save();
      }
    } catch (error) {
      throw new Error(`Failed to sync subscription: ${(error as Error).message}`);
    }
  }

  /**
   * Get Stripe instance for direct access
   */
  getStripeInstance(): Stripe {
    return this.stripe;
  }
}