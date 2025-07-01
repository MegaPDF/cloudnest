import { ObjectId } from "mongoose";

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  storageLimit: number;
  features: PlanFeature[];
  limitations: PlanLimitation[];
  isPopular: boolean;
  isActive: boolean;
  stripePriceId?: string;
}

export interface PlanFeature {
  id: string;
  name: string;
  description: string;
  included: boolean;
  limit?: number;
}

export interface PlanLimitation {
  feature: string;
  limit: number;
  unit: string;
}

export interface Subscription {
  id: ObjectId;
  userId: ObjectId;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  plan: Plan;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionStatus = 
  | 'active' 
  | 'canceled' 
  | 'past_due' 
  | 'incomplete' 
  | 'trialing' 
  | 'unpaid';

export interface SubscriptionCreate {
  userId: ObjectId;
  planId: string;
  paymentMethodId?: string;
  trialDays?: number;
  couponCode?: string;
}

export interface SubscriptionUpdate {
  planId?: string;
  cancelAtPeriodEnd?: boolean;
  metadata?: Record<string, any>;
}

export interface BillingInfo {
  customerId: string;
  email: string;
  name: string;
  address?: BillingAddress;
  taxId?: string;
  currency: string;
  paymentMethod?: PaymentMethod;
}

export interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'paypal';
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
}

export interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  dueDate: Date;
  paidAt?: Date;
  items: InvoiceItem[];
  downloadUrl: string;
  createdAt: Date;
}

export interface InvoiceItem {
  description: string;
  amount: number;
  quantity: number;
  period: {
    start: Date;
    end: Date;
  };
}

export interface UsageRecord {
  subscriptionId: ObjectId;
  metricName: string;
  quantity: number;
  timestamp: Date;
  period: Date;
}

export interface BillingPortalSession {
  url: string;
  returnUrl: string;
  expiresAt: Date;
}
