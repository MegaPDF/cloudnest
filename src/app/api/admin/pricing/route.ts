import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database/connection';
import { SystemSettings } from '@/lib/database/models';
import { planManagementSchema, subscriptionManagementSchema } from '@/lib/validation/admin';
import { PermissionUtils } from '@/lib/utils/permission-utils';
import { HTTP_STATUS, ERROR_CODES } from '@/lib/utils/constants';
import { PlanManager, SUBSCRIPTION_PLANS_CONFIG } from '@/lib/payments/plans';
import { getServerSession } from 'next-auth';
import { ApiResponse } from '@/types/api';
import { SupportedCurrency } from '@/lib/i18n/config';
import mongoose from 'mongoose';

// Initialize plan manager with default plans
const planManager = new PlanManager(SUBSCRIPTION_PLANS_CONFIG);

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.AUTHENTICATION_ERROR,
          message: 'Authentication required'
        }
      }, { status: HTTP_STATUS.UNAUTHORIZED });
    }

    // Check admin permissions
    if (!PermissionUtils.requireAdmin(session.user.role as 'user' | 'admin')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.AUTHORIZATION_ERROR,
          message: 'Admin access required'
        }
      }, { status: HTTP_STATUS.FORBIDDEN });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    await connectToDatabase();

    switch (action) {
      case 'plans':
        // Get all subscription plans
        const plans = planManager.getActivePlans();
        
        return NextResponse.json<ApiResponse>({
          success: true,
          data: {
            plans,
            currencies: ['USD', 'IDR'],
            intervals: ['monthly', 'yearly']
          },
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'analytics':
        // Get pricing analytics
        const analytics = await getPricingAnalytics();
        
        return NextResponse.json<ApiResponse>({
          success: true,
          data: analytics,
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'comparison':
        // Get plan comparison data
        const comparison = await getPlanComparison();
        
        return NextResponse.json<ApiResponse>({
          success: true,
          data: comparison,
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      default:
        // Get pricing overview
        const overview = await getPricingOverview();
        
        return NextResponse.json<ApiResponse>({
          success: true,
          data: overview,
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });
    }

  } catch (error) {
    console.error('Admin pricing fetch error:', error);
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to fetch pricing data'
      }
    }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.AUTHENTICATION_ERROR,
          message: 'Authentication required'
        }
      }, { status: HTTP_STATUS.UNAUTHORIZED });
    }

    // Check admin permissions
    if (!PermissionUtils.requireAdmin(session.user.role as 'user' | 'admin')) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: {
          code: ERROR_CODES.AUTHORIZATION_ERROR,
          message: 'Admin access required'
        }
      }, { status: HTTP_STATUS.FORBIDDEN });
    }

    const body = await request.json();
    const { action } = body;

    await connectToDatabase();

    switch (action) {
      case 'create_plan':
        // Create new subscription plan
        const planData = planManagementSchema.parse(body.plan);
        
        planManager.addCustomPlan({
          id: planData.id,
          name: planData.name,
          description: planData.description,
          storageLimit: planData.storageLimit,
          maxFiles: 1000000, // Default high limit
          maxShares: 1000,   // Default high limit
          features: planData.features.map(feature => ({
            id: feature,
            name: feature.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: '',
            included: true
          })),
          pricing: [
            {
              currency: planData.currency as SupportedCurrency,
              monthly: planData.interval === 'month' ? planData.price : Math.round(planData.price / 10),
              yearly: planData.interval === 'year' ? planData.price : planData.price * 10,
              stripePriceIds: {
                monthly: planData.stripePriceId || '',
                yearly: planData.stripePriceId || ''
              }
            }
          ],
          isPopular: planData.isPopular,
          isActive: planData.isActive,
          sortOrder: planManager.getActivePlans().length + 1,
          metadata: {}
        });

        return NextResponse.json<ApiResponse>({
          success: true,
          message: 'Plan created successfully',
          data: { planId: planData.id },
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'update_plan':
        // Update existing plan
        const { planId, updates } = body;
        const updateData = planManagementSchema.partial().parse(updates);

        // Transform features if present
        let transformedUpdateData = { ...updateData };
        if (updateData.features) {
          // Convert string[] to PlanFeature[]
          const featureObjects = updateData.features.map((feature: string) => ({
            id: feature,
            name: feature.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: '',
            included: true
          }));
          // Ensure correct type
          (transformedUpdateData as any).features = featureObjects;
        } else if ('features' in transformedUpdateData) {
          // If features is present but undefined, remove it to avoid type issues
          delete (transformedUpdateData as any).features;
        }
        
        planManager.updatePlan(planId, transformedUpdateData as Partial<import('@/lib/payments/plans').SubscriptionPlan>);

        return NextResponse.json<ApiResponse>({
          success: true,
          message: 'Plan updated successfully',
          data: { planId },
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'deactivate_plan':
        // Deactivate plan
        const { planId: deactivatePlanId } = body;
        planManager.deactivatePlan(deactivatePlanId);

        return NextResponse.json<ApiResponse>({
          success: true,
          message: 'Plan deactivated successfully',
          data: { planId: deactivatePlanId },
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'manage_subscription':
        // Manage user subscription
        const subscriptionData = subscriptionManagementSchema.parse(body);
        const result = await manageUserSubscription(subscriptionData);

        return NextResponse.json<ApiResponse>({
          success: true,
          data: result,
          message: `Subscription ${subscriptionData.action} completed`,
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      case 'bulk_pricing_update':
        // Update pricing for multiple plans
        const { priceUpdates } = body;
        type UpdateResult = { planId: any; success: boolean; error?: string };
        const updateResults: UpdateResult[] = [];

        for (const update of priceUpdates) {
          try {
            const pricing = planManager.getPlanPricing(update.planId, update.currency);
            if (pricing) {
              pricing[update.interval] = update.newPrice;
              planManager.updatePlan(update.planId, {});
              updateResults.push({ planId: update.planId, success: true });
            } else {
              updateResults.push({ planId: update.planId, success: false, error: 'Plan not found' });
            }
          } catch (error) {
            updateResults.push({ 
              planId: update.planId, 
              success: false, 
              error: (error as Error).message 
            });
          }
        }

        return NextResponse.json<ApiResponse>({
          success: true,
          data: updateResults,
          message: 'Bulk pricing update completed',
          meta: {
            timestamp: new Date(),
            version: '1.0.0',
            requestId: crypto.randomUUID()
          }
        });

      default:
        return NextResponse.json<ApiResponse>({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid action specified'
          }
        }, { status: HTTP_STATUS.BAD_REQUEST });
    }

  } catch (error) {
    console.error('Admin pricing action error:', error);
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to perform pricing action'
      }
    }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
  }
}

// Helper functions

async function getPricingOverview() {
  const { Subscription, User } = await import('@/lib/database/models');
  
  const [
    subscriptionStats,
    revenueStats,
    userDistribution
  ] = await Promise.all([
    Subscription.aggregate([
      {
        $group: {
          _id: '$plan.id',
          count: { $sum: 1 },
          revenue: { $sum: '$plan.price' }
        }
      }
    ]),
    Subscription.aggregate([
      {
        $match: { status: 'active' }
      },
      {
        $group: {
          _id: {
            month: { $month: '$createdAt' },
            year: { $year: '$createdAt' }
          },
          monthlyRevenue: { $sum: '$plan.price' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]),
    User.aggregate([
      {
        $group: {
          _id: '$subscription.plan',
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  return {
    plans: planManager.getActivePlans(),
    subscriptionStats,
    revenueStats,
    userDistribution,
    summary: {
      totalActiveSubscriptions: subscriptionStats.reduce((sum, stat) => sum + stat.count, 0),
      totalMonthlyRevenue: subscriptionStats.reduce((sum, stat) => sum + stat.revenue, 0),
      averageRevenuePerUser: subscriptionStats.length > 0 
        ? subscriptionStats.reduce((sum, stat) => sum + stat.revenue, 0) / subscriptionStats.reduce((sum, stat) => sum + stat.count, 0)
        : 0
    }
  };
}

async function getPricingAnalytics() {
  const { Subscription } = await import('@/lib/database/models');
  
  // Get subscription trends over time
  const trends = await Subscription.aggregate([
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          plan: '$plan.id'
        },
        newSubscriptions: { $sum: 1 },
        revenue: { $sum: '$plan.price' }
      }
    },
    {
      $group: {
        _id: {
          year: '$_id.year',
          month: '$_id.month'
        },
        plans: {
          $push: {
            plan: '$_id.plan',
            newSubscriptions: '$newSubscriptions',
            revenue: '$revenue'
          }
        },
        totalNewSubscriptions: { $sum: '$newSubscriptions' },
        totalRevenue: { $sum: '$revenue' }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 12 }
  ]);

  // Get churn analysis
  const churnAnalysis = await Subscription.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  return {
    trends,
    churnAnalysis,
    conversionRates: {
      freeToProConversion: 0.12, // 12% - would calculate from actual data
      proToEnterpriseConversion: 0.08 // 8% - would calculate from actual data
    }
  };
}

async function getPlanComparison() {
  const plans = planManager.getActivePlans();
  
  return {
    plans: plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      features: plan.features,
      pricing: plan.pricing,
      popular: plan.isPopular,
      savings: planManager.calculateSavings(plan.id, 'USD')
    })),
    featureMatrix: plans.reduce((matrix, plan) => {
      plan.features.forEach(feature => {
        if (!matrix[feature.id]) {
          matrix[feature.id] = {
            name: feature.name,
            description: feature.description,
            plans: {}
          };
        }
        matrix[feature.id].plans[plan.id] = {
          included: feature.included,
          limit: feature.limit,
          unit: feature.unit
        };
      });
      return matrix;
    }, {} as any)
  };
}

async function manageUserSubscription(data: any) {
  const { User, Subscription } = await import('@/lib/database/models');
  
  const user = await User.findById(data.userId);
  if (!user) {
    throw new Error('User not found');
  }

  const subscription = await Subscription.findOne({ user: data.userId });

  switch (data.action) {
    case 'upgrade':
    case 'downgrade':
      if (subscription && data.planId) {
        const newPlan = planManager.getPlan(data.planId);
        if (newPlan) {
          subscription.plan = {
            id: newPlan.id,
            name: newPlan.name,
            description: newPlan.description,
            features: newPlan.features.map((f: any) => f.id),
            price: data.price ?? (newPlan.pricing?.[0]?.monthly ?? 0),
            currency: data.currency ?? (newPlan.pricing?.[0]?.currency ?? 'USD'),
            interval: data.interval ?? 'month',
            storageLimit: newPlan.storageLimit,
            isActive: newPlan.isActive
          };
          await subscription.save();
        }
      }
      break;

    case 'cancel':
      if (subscription) {
        await subscription.cancel();
      }
      break;

    case 'reactivate':
      if (subscription) {
        await subscription.reactivate();
      }
      break;

    case 'extend':
      if (subscription) {
        const extensionDays = 30; // Default extension
        subscription.currentPeriodEnd = new Date(
          subscription.currentPeriodEnd.getTime() + (extensionDays * 24 * 60 * 60 * 1000)
        );
        await subscription.save();
      }
      break;
  }

  return {
    userId: data.userId,
    action: data.action,
    subscription: subscription?.toObject()
  };
}