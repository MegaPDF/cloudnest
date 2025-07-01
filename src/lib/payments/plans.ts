import { SupportedCurrency } from '../i18n/config';
import { SUBSCRIPTION_PLANS, STORAGE_LIMITS } from '../utils/constants';

export interface PlanFeature {
  id: string;
  name: string;
  description: string;
  included: boolean;
  limit?: number;
  unit?: string;
}

export interface PlanPricing {
  currency: SupportedCurrency;
  monthly: number;
  yearly: number;
  stripePriceIds: {
    monthly: string;
    yearly: string;
  };
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  storageLimit: number; // in bytes
  maxFiles: number;
  maxShares: number;
  features: PlanFeature[];
  pricing: PlanPricing[];
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
  metadata: Record<string, any>;
}

// Define core features available across plans
const PLAN_FEATURES = {
  BASIC_STORAGE: {
    id: 'basic_storage',
    name: 'File Storage',
    description: 'Store your files securely in the cloud'
  },
  FILE_SHARING: {
    id: 'file_sharing',
    name: 'File Sharing',
    description: 'Share files with others via secure links'
  },
  FILE_PREVIEW: {
    id: 'file_preview',
    name: 'File Preview',
    description: 'Preview files without downloading'
  },
  FOLDER_ORGANIZATION: {
    id: 'folder_organization',
    name: 'Folder Organization',
    description: 'Organize files in folders and subfolders'
  },
  VERSION_HISTORY: {
    id: 'version_history',
    name: 'Version History',
    description: 'Keep track of file versions'
  },
  ADVANCED_SHARING: {
    id: 'advanced_sharing',
    name: 'Advanced Sharing',
    description: 'Password protection, expiration dates, download limits'
  },
  PRIORITY_SUPPORT: {
    id: 'priority_support',
    name: 'Priority Support',
    description: 'Get faster response times for support requests'
  },
  API_ACCESS: {
    id: 'api_access',
    name: 'API Access',
    description: 'Integrate with third-party applications'
  },
  CUSTOM_BRANDING: {
    id: 'custom_branding',
    name: 'Custom Branding',
    description: 'Customize the interface with your brand'
  },
  TEAM_COLLABORATION: {
    id: 'team_collaboration',
    name: 'Team Collaboration',
    description: 'Collaborate with team members'
  },
  ADMIN_CONTROLS: {
    id: 'admin_controls',
    name: 'Admin Controls',
    description: 'Advanced administrative features'
  },
  BACKUP_RESTORE: {
    id: 'backup_restore',
    name: 'Backup & Restore',
    description: 'Automatic backups and restore capabilities'
  }
} as const;

// Pre-configured subscription plans
export const SUBSCRIPTION_PLANS_CONFIG: SubscriptionPlan[] = [
  {
    id: SUBSCRIPTION_PLANS.FREE,
    name: 'Free',
    description: 'Perfect for personal use',
    storageLimit: STORAGE_LIMITS.FREE, // 5GB
    maxFiles: 1000,
    maxShares: 10,
    isPopular: false,
    isActive: true,
    sortOrder: 1,
    metadata: {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      supportLevel: 'community'
    },
    features: [
      { ...PLAN_FEATURES.BASIC_STORAGE, included: true, limit: 5, unit: 'GB' },
      { ...PLAN_FEATURES.FILE_SHARING, included: true, limit: 10, unit: 'shares' },
      { ...PLAN_FEATURES.FILE_PREVIEW, included: true },
      { ...PLAN_FEATURES.FOLDER_ORGANIZATION, included: true },
      { ...PLAN_FEATURES.VERSION_HISTORY, included: false },
      { ...PLAN_FEATURES.ADVANCED_SHARING, included: false },
      { ...PLAN_FEATURES.PRIORITY_SUPPORT, included: false },
      { ...PLAN_FEATURES.API_ACCESS, included: false },
      { ...PLAN_FEATURES.CUSTOM_BRANDING, included: false },
      { ...PLAN_FEATURES.TEAM_COLLABORATION, included: false },
      { ...PLAN_FEATURES.ADMIN_CONTROLS, included: false },
      { ...PLAN_FEATURES.BACKUP_RESTORE, included: false }
    ],
    pricing: [
      {
        currency: 'USD',
        monthly: 0,
        yearly: 0,
        stripePriceIds: {
          monthly: '', // Free plan doesn't need Stripe price IDs
          yearly: ''
        }
      },
      {
        currency: 'IDR',
        monthly: 0,
        yearly: 0,
        stripePriceIds: {
          monthly: '',
          yearly: ''
        }
      }
    ]
  },
  {
    id: SUBSCRIPTION_PLANS.PRO,
    name: 'Pro',
    description: 'For professionals and small teams',
    storageLimit: STORAGE_LIMITS.PRO, // 100GB
    maxFiles: 50000,
    maxShares: 100,
    isPopular: true,
    isActive: true,
    sortOrder: 2,
    metadata: {
      maxFileSize: 500 * 1024 * 1024, // 500MB
      supportLevel: 'email'
    },
    features: [
      { ...PLAN_FEATURES.BASIC_STORAGE, included: true, limit: 100, unit: 'GB' },
      { ...PLAN_FEATURES.FILE_SHARING, included: true, limit: 100, unit: 'shares' },
      { ...PLAN_FEATURES.FILE_PREVIEW, included: true },
      { ...PLAN_FEATURES.FOLDER_ORGANIZATION, included: true },
      { ...PLAN_FEATURES.VERSION_HISTORY, included: true },
      { ...PLAN_FEATURES.ADVANCED_SHARING, included: true },
      { ...PLAN_FEATURES.PRIORITY_SUPPORT, included: true },
      { ...PLAN_FEATURES.API_ACCESS, included: true },
      { ...PLAN_FEATURES.CUSTOM_BRANDING, included: false },
      { ...PLAN_FEATURES.TEAM_COLLABORATION, included: true, limit: 5, unit: 'members' },
      { ...PLAN_FEATURES.ADMIN_CONTROLS, included: false },
      { ...PLAN_FEATURES.BACKUP_RESTORE, included: true }
    ],
    pricing: [
      {
        currency: 'USD',
        monthly: 999, // $9.99 (in cents)
        yearly: 9999, // $99.99 (in cents) - 2 months free
        stripePriceIds: {
          monthly: 'price_pro_monthly_usd',
          yearly: 'price_pro_yearly_usd'
        }
      },
      {
        currency: 'IDR',
        monthly: 149000, // 149,000 IDR
        yearly: 1490000, // 1,490,000 IDR - 2 months free
        stripePriceIds: {
          monthly: 'price_pro_monthly_idr',
          yearly: 'price_pro_yearly_idr'
        }
      }
    ]
  },
  {
    id: SUBSCRIPTION_PLANS.ENTERPRISE,
    name: 'Enterprise',
    description: 'For large teams and organizations',
    storageLimit: STORAGE_LIMITS.ENTERPRISE, // 1TB
    maxFiles: 1000000,
    maxShares: 1000,
    isPopular: false,
    isActive: true,
    sortOrder: 3,
    metadata: {
      maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
      supportLevel: 'priority'
    },
    features: [
      { ...PLAN_FEATURES.BASIC_STORAGE, included: true, limit: 1, unit: 'TB' },
      { ...PLAN_FEATURES.FILE_SHARING, included: true, limit: 1000, unit: 'shares' },
      { ...PLAN_FEATURES.FILE_PREVIEW, included: true },
      { ...PLAN_FEATURES.FOLDER_ORGANIZATION, included: true },
      { ...PLAN_FEATURES.VERSION_HISTORY, included: true },
      { ...PLAN_FEATURES.ADVANCED_SHARING, included: true },
      { ...PLAN_FEATURES.PRIORITY_SUPPORT, included: true },
      { ...PLAN_FEATURES.API_ACCESS, included: true },
      { ...PLAN_FEATURES.CUSTOM_BRANDING, included: true },
      { ...PLAN_FEATURES.TEAM_COLLABORATION, included: true, limit: 50, unit: 'members' },
      { ...PLAN_FEATURES.ADMIN_CONTROLS, included: true },
      { ...PLAN_FEATURES.BACKUP_RESTORE, included: true }
    ],
    pricing: [
      {
        currency: 'USD',
        monthly: 2999, // $29.99 (in cents)
        yearly: 29999, // $299.99 (in cents) - 2 months free
        stripePriceIds: {
          monthly: 'price_enterprise_monthly_usd',
          yearly: 'price_enterprise_yearly_usd'
        }
      },
      {
        currency: 'IDR',
        monthly: 449000, // 449,000 IDR
        yearly: 4490000, // 4,490,000 IDR - 2 months free
        stripePriceIds: {
          monthly: 'price_enterprise_monthly_idr',
          yearly: 'price_enterprise_yearly_idr'
        }
      }
    ]
  }
];

export class PlanManager {
  private plans: Map<string, SubscriptionPlan> = new Map();

  constructor(plans: SubscriptionPlan[] = SUBSCRIPTION_PLANS_CONFIG) {
    plans.forEach(plan => {
      this.plans.set(plan.id, plan);
    });
  }

  getPlan(planId: string): SubscriptionPlan | null {
    return this.plans.get(planId) || null;
  }

  getActivePlans(): SubscriptionPlan[] {
    return Array.from(this.plans.values())
      .filter(plan => plan.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  getPlanPricing(planId: string, currency: SupportedCurrency): PlanPricing | null {
    const plan = this.getPlan(planId);
    if (!plan) return null;

    return plan.pricing.find(p => p.currency === currency) || null;
  }

  getStripePriceId(planId: string, currency: SupportedCurrency, interval: 'monthly' | 'yearly'): string | null {
    const pricing = this.getPlanPricing(planId, currency);
    if (!pricing) return null;

    return pricing.stripePriceIds[interval] || null;
  }

  getPlanByStripePriceId(stripePriceId: string): { plan: SubscriptionPlan; currency: SupportedCurrency; interval: 'monthly' | 'yearly' } | null {
    for (const plan of this.plans.values()) {
      for (const pricing of plan.pricing) {
        if (pricing.stripePriceIds.monthly === stripePriceId) {
          return { plan, currency: pricing.currency, interval: 'monthly' };
        }
        if (pricing.stripePriceIds.yearly === stripePriceId) {
          return { plan, currency: pricing.currency, interval: 'yearly' };
        }
      }
    }
    return null;
  }

  getFeatureValue(planId: string, featureId: string): { included: boolean; limit?: number; unit?: string } | null {
    const plan = this.getPlan(planId);
    if (!plan) return null;

    const feature = plan.features.find(f => f.id === featureId);
    if (!feature) return null;

    return {
      included: feature.included,
      limit: feature.limit,
      unit: feature.unit
    };
  }

  comparePlans(planId1: string, planId2: string): {
    upgrade: boolean;
    downgrade: boolean;
    same: boolean;
  } {
    const plan1 = this.getPlan(planId1);
    const plan2 = this.getPlan(planId2);

    if (!plan1 || !plan2) {
      return { upgrade: false, downgrade: false, same: false };
    }

    if (plan1.sortOrder === plan2.sortOrder) {
      return { upgrade: false, downgrade: false, same: true };
    }

    return {
      upgrade: plan2.sortOrder > plan1.sortOrder,
      downgrade: plan2.sortOrder < plan1.sortOrder,
      same: false
    };
  }

  calculateSavings(planId: string, currency: SupportedCurrency): number {
    const pricing = this.getPlanPricing(planId, currency);
    if (!pricing) return 0;

    const monthlyTotal = pricing.monthly * 12;
    const yearlySavings = monthlyTotal - pricing.yearly;
    
    return Math.max(0, yearlySavings);
  }

  getUpgradeOptions(currentPlanId: string): SubscriptionPlan[] {
    const currentPlan = this.getPlan(currentPlanId);
    if (!currentPlan) return [];

    return this.getActivePlans().filter(plan => 
      plan.sortOrder > currentPlan.sortOrder
    );
  }

  getDowngradeOptions(currentPlanId: string): SubscriptionPlan[] {
    const currentPlan = this.getPlan(currentPlanId);
    if (!currentPlan) return [];

    return this.getActivePlans().filter(plan => 
      plan.sortOrder < currentPlan.sortOrder
    );
  }

  addCustomPlan(plan: SubscriptionPlan): void {
    this.plans.set(plan.id, plan);
  }

  updatePlan(planId: string, updates: Partial<SubscriptionPlan>): void {
    const existing = this.plans.get(planId);
    if (existing) {
      this.plans.set(planId, { ...existing, ...updates });
    }
  }

  deactivatePlan(planId: string): void {
    this.updatePlan(planId, { isActive: false });
  }
}