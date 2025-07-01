import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { StripeService } from './stripe';
import { User, Subscription as SubscriptionModel } from '../database/models';
import { PlanManager } from './plans';
import { PaymentUtils } from './utils';
import { QuotaUtils } from '../utils/quota-utils';

export interface WebhookHandler {
  eventType: string;
  handler: (event: Stripe.Event) => Promise<void>;
}

export class StripeWebhookProcessor {
  private stripeService: StripeService;
  private planManager: PlanManager;
  private handlers: Map<string, (event: Stripe.Event) => Promise<void>>;

  constructor(
    stripeService: StripeService = new StripeService(),
    planManager: PlanManager = new PlanManager()
  ) {
    this.stripeService = stripeService;
    this.planManager = planManager;
    this.handlers = new Map();
    
    this.registerDefaultHandlers();
  }

  private registerDefaultHandlers(): void {
    // Customer events
    this.registerHandler('customer.created', this.handleCustomerCreated.bind(this));
    this.registerHandler('customer.updated', this.handleCustomerUpdated.bind(this));
    this.registerHandler('customer.deleted', this.handleCustomerDeleted.bind(this));

    // Subscription events
    this.registerHandler('customer.subscription.created', this.handleSubscriptionCreated.bind(this));
    this.registerHandler('customer.subscription.updated', this.handleSubscriptionUpdated.bind(this));
    this.registerHandler('customer.subscription.deleted', this.handleSubscriptionDeleted.bind(this));
    this.registerHandler('customer.subscription.trial_will_end', this.handleTrialWillEnd.bind(this));

    // Invoice events
    this.registerHandler('invoice.created', this.handleInvoiceCreated.bind(this));
    this.registerHandler('invoice.payment_succeeded', this.handlePaymentSucceeded.bind(this));
    this.registerHandler('invoice.payment_failed', this.handlePaymentFailed.bind(this));
    this.registerHandler('invoice.finalized', this.handleInvoiceFinalized.bind(this));

    // Payment events
    this.registerHandler('payment_intent.succeeded', this.handlePaymentIntentSucceeded.bind(this));
    this.registerHandler('payment_intent.payment_failed', this.handlePaymentIntentFailed.bind(this));
    this.registerHandler('payment_method.attached', this.handlePaymentMethodAttached.bind(this));

    // Setup intent events
    this.registerHandler('setup_intent.succeeded', this.handleSetupIntentSucceeded.bind(this));
  }

  registerHandler(eventType: string, handler: (event: Stripe.Event) => Promise<void>): void {
    this.handlers.set(eventType, handler);
  }

  async processWebhook(request: NextRequest): Promise<NextResponse> {
    try {
      const body = await request.text();
      const signature = request.headers.get('stripe-signature');

      if (!signature) {
        return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
      }

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
      }

      // Construct and verify webhook event
      const event = this.stripeService.constructWebhookEvent(body, signature, webhookSecret);

      // Process the event
      await this.processEvent(event);

      return NextResponse.json({ received: true });

    } catch (error) {
      console.error('Webhook processing error:', error);
      
      if (error instanceof Error && error.message.includes('signature')) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }

      return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
  }

  private async processEvent(event: Stripe.Event): Promise<void> {
    console.log(`Processing webhook event: ${event.type}`);

    const handler = this.handlers.get(event.type);
    if (handler) {
      try {
        await handler(event);
        console.log(`Successfully processed ${event.type}`);
      } catch (error) {
        console.error(`Error processing ${event.type}:`, error);
        throw error;
      }
    } else {
      console.log(`No handler registered for event type: ${event.type}`);
    }
  }

  // Customer event handlers
  private async handleCustomerCreated(event: Stripe.Event): Promise<void> {
    const customer = event.data.object as Stripe.Customer;
    const userId = customer.metadata?.userId;

    if (userId) {
      await User.findByIdAndUpdate(userId, {
        'subscription.stripeCustomerId': customer.id
      });
    }
  }

  private async handleCustomerUpdated(event: Stripe.Event): Promise<void> {
    const customer = event.data.object as Stripe.Customer;
    // Handle customer updates if needed
    console.log(`Customer updated: ${customer.id}`);
  }

  private async handleCustomerDeleted(event: Stripe.Event): Promise<void> {
    const customer = event.data.object as Stripe.Customer;
    
    // Find user by customer ID and remove Stripe reference
    await User.updateOne(
      { 'subscription.stripeCustomerId': customer.id },
      {
        $unset: {
          'subscription.stripeCustomerId': '',
          'subscription.stripeSubscriptionId': ''
        },
        $set: {
          'subscription.plan': 'free',
          'subscription.status': 'canceled'
        }
      }
    );
  }

  // Subscription event handlers
  private async handleSubscriptionCreated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    await this.updateUserSubscription(subscription);
    
    // Send welcome email or notification
    await this.sendSubscriptionNotification(subscription, 'created');
  }

  private async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    await this.updateUserSubscription(subscription);
    
    // Send update notification
    await this.sendSubscriptionNotification(subscription, 'updated');
  }

  private async handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    
    // Update user to free plan
    await User.updateOne(
      { 'subscription.stripeSubscriptionId': subscription.id },
      {
        $set: {
          'subscription.plan': 'free',
          'subscription.status': 'canceled',
          'storage.limit': QuotaUtils.getStorageLimitForPlan('free')
        },
        $unset: {
          'subscription.stripeSubscriptionId': '',
          'subscription.currentPeriodEnd': ''
        }
      }
    );

    // Send cancellation notification
    await this.sendSubscriptionNotification(subscription, 'canceled');
  }

  private async handleTrialWillEnd(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    
    // Send trial ending notification
    await this.sendSubscriptionNotification(subscription, 'trial_ending');
  }

  // Invoice event handlers
  private async handleInvoiceCreated(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    console.log(`Invoice created: ${invoice.id}`);
  }

  private async handlePaymentSucceeded(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    
    if (invoice.subscription) {
      // Ensure subscription is active
      const subscriptionId = typeof invoice.subscription === 'string' 
        ? invoice.subscription 
        : invoice.subscription.id;

      const subscription = await this.stripeService.getSubscription(subscriptionId);
      await this.updateUserSubscription(subscription);
      
      // Send payment success notification
      await this.sendPaymentNotification(invoice, 'succeeded');
    }
  }

  private async handlePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    
    // Send payment failed notification
    await this.sendPaymentNotification(invoice, 'failed');
    
    // Handle subscription status if needed
    if (invoice.subscription) {
      const subscriptionId = typeof invoice.subscription === 'string' 
        ? invoice.subscription 
        : invoice.subscription.id;

      await User.updateOne(
        { 'subscription.stripeSubscriptionId': subscriptionId },
        { $set: { 'subscription.status': 'past_due' } }
      );
    }
  }

  private async handleInvoiceFinalized(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    console.log(`Invoice finalized: ${invoice.id}`);
  }

  // Payment intent handlers
  private async handlePaymentIntentSucceeded(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    console.log(`Payment succeeded: ${paymentIntent.id}`);
  }

  private async handlePaymentIntentFailed(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    console.log(`Payment failed: ${paymentIntent.id}`);
  }

  private async handlePaymentMethodAttached(event: Stripe.Event): Promise<void> {
    const paymentMethod = event.data.object as Stripe.PaymentMethod;
    console.log(`Payment method attached: ${paymentMethod.id}`);
  }

  private async handleSetupIntentSucceeded(event: Stripe.Event): Promise<void> {
    const setupIntent = event.data.object as Stripe.SetupIntent;
    console.log(`Setup intent succeeded: ${setupIntent.id}`);
  }

  // Helper methods
  private async updateUserSubscription(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    const planId = subscription.metadata?.planId;

    if (!userId || !planId) {
      console.error('Missing user ID or plan ID in subscription metadata');
      return;
    }

    const plan = this.planManager.getPlan(planId);
    if (!plan) {
      console.error(`Plan not found: ${planId}`);
      return;
    }

    const updateData = {
      'subscription.plan': planId,
      'subscription.stripeSubscriptionId': subscription.id,
      'subscription.status': subscription.status,
      'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000),
      'storage.limit': plan.storageLimit
    };

    await User.findByIdAndUpdate(userId, updateData);

    // Create or update subscription record
    await SubscriptionModel.findOneAndUpdate(
      { user: userId },
      {
        user: userId,
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price.id || '',
        plan: {
          id: planId,
          name: plan.name,
          description: plan.description,
          price: 0, // Will be updated with actual price
          currency: 'USD', // Will be updated with actual currency
          interval: subscription.metadata?.interval || 'monthly',
          storageLimit: plan.storageLimit,
          features: plan.features.map(f => f.name),
          isActive: true
        },
        status: subscription.status as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : undefined,
        trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
        metadata: subscription.metadata || {}
      },
      { upsert: true, new: true }
    );
  }

  private async sendSubscriptionNotification(
    subscription: Stripe.Subscription,
    type: 'created' | 'updated' | 'canceled' | 'trial_ending'
  ): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    const user = await User.findById(userId);
    if (!user) return;

    // Import email service and send notification
    // This would integrate with the email system we'll create
    console.log(`Sending ${type} notification to ${user.email}`);
  }

  private async sendPaymentNotification(
    invoice: Stripe.Invoice,
    type: 'succeeded' | 'failed'
  ): Promise<void> {
    const customerId = invoice.customer;
    if (!customerId) return;

    const user = await User.findOne({ 'subscription.stripeCustomerId': customerId });
    if (!user) return;

    // Import email service and send notification
    console.log(`Sending payment ${type} notification to ${user.email}`);
  }

  // Utility method to validate webhook events
  static validateWebhookEvent(event: Stripe.Event): boolean {
    // Add validation logic here
    // Check event age, validate required fields, etc.
    
    const eventAge = Date.now() - event.created * 1000;
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    if (eventAge > maxAge) {
      console.warn(`Webhook event too old: ${event.id}`);
      return false;
    }

    return true;
  }

  // Method to replay failed webhooks
  async replayWebhook(eventId: string): Promise<void> {
    try {
      // Retrieve the event from Stripe
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2023-10-16'
      });
      
      const event = await stripe.events.retrieve(eventId);
      
      if (StripeWebhookProcessor.validateWebhookEvent(event)) {
        await this.processEvent(event);
      }
    } catch (error) {
      console.error(`Failed to replay webhook ${eventId}:`, error);
      throw error;
    }
  }
}