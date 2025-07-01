import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  storageLimit: number;
  features: string[];
  isActive: boolean;
}

export interface ISubscription extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  plan: IPlan;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing' | 'unpaid';
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

export interface ISubscriptionMethods {
  isActive(): boolean;
  isTrialing(): boolean;
  isExpired(): boolean;
  daysUntilExpiry(): number;
  cancel(): Promise<void>;
  reactivate(): Promise<void>;
}

export interface SubscriptionModel extends Model<ISubscription, {}, ISubscriptionMethods> {
  findByUser(userId: mongoose.Types.ObjectId): Promise<ISubscription | null>;
  findByStripeId(stripeSubscriptionId: string): Promise<ISubscription | null>;
  findActiveSubscriptions(): Promise<ISubscription[]>;
  findExpiringSubscriptions(days: number): Promise<ISubscription[]>;
}

const planSchema = new Schema<IPlan>({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'usd'
  },
  interval: {
    type: String,
    enum: ['month', 'year'],
    required: true
  },
  storageLimit: {
    type: Number,
    required: true,
    min: 0
  },
  features: [String],
  isActive: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const subscriptionSchema = new Schema<ISubscription, SubscriptionModel, ISubscriptionMethods>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  stripeCustomerId: {
    type: String,
    required: true,
    index: true
  },
  stripeSubscriptionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  stripePriceId: {
    type: String,
    required: true
  },
  plan: {
    type: planSchema,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'canceled', 'past_due', 'incomplete', 'trialing', 'unpaid'],
    required: true,
    index: true
  },
  currentPeriodStart: {
    type: Date,
    required: true
  },
  currentPeriodEnd: {
    type: Date,
    required: true,
    index: true
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  canceledAt: Date,
  trialStart: Date,
  trialEnd: Date,
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1, status: 1 });
subscriptionSchema.index({ createdAt: -1 });

// Virtual for days remaining
subscriptionSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const diff = this.currentPeriodEnd.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Instance methods
subscriptionSchema.methods.isActive = function(): boolean {
  return ['active', 'trialing'].includes(this.status);
};

subscriptionSchema.methods.isTrialing = function(): boolean {
  return this.status === 'trialing' && !!this.trialEnd && new Date() < this.trialEnd;
};

subscriptionSchema.methods.isExpired = function(): boolean {
  return new Date() > this.currentPeriodEnd;
};

subscriptionSchema.methods.daysUntilExpiry = function(): number {
  const now = new Date();
  const diff = this.currentPeriodEnd.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

subscriptionSchema.methods.cancel = async function(): Promise<void> {
  this.status = 'canceled';
  this.canceledAt = new Date();
  this.cancelAtPeriodEnd = true;
  await this.save();
};

subscriptionSchema.methods.reactivate = async function(): Promise<void> {
  this.status = 'active';
  this.canceledAt = undefined;
  this.cancelAtPeriodEnd = false;
  await this.save();
};

// Static methods
subscriptionSchema.statics.findByUser = function(userId: mongoose.Types.ObjectId) {
  return this.findOne({ user: userId }).populate('user', 'name email');
};

subscriptionSchema.statics.findByStripeId = function(stripeSubscriptionId: string) {
  return this.findOne({ stripeSubscriptionId }).populate('user', 'name email');
};

subscriptionSchema.statics.findActiveSubscriptions = function() {
  return this.find({ status: { $in: ['active', 'trialing'] } }).populate('user', 'name email');
};

subscriptionSchema.statics.findExpiringSubscriptions = function(days: number) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + days);
  
  return this.find({
    status: { $in: ['active', 'trialing'] },
    currentPeriodEnd: { $lte: targetDate }
  }).populate('user', 'name email');
};

export const Subscription = (mongoose.models.Subscription as SubscriptionModel) || mongoose.model<ISubscription, SubscriptionModel>('Subscription', subscriptionSchema);
