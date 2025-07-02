import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { User } from '../database/models/user';
import { connectToDatabase } from '../database/connection';
import { PermissionUtils } from '../utils/permission-utils';
import type { Permission } from '../utils/permission-utils';

// Route configuration
interface RouteConfig {
  pattern: RegExp;
  auth: boolean;
  roles?: ('user' | 'admin')[];
  permissions?: Permission[];
  redirect?: string;
}

// Define protected routes and their requirements
const routeConfigs: RouteConfig[] = [
  // Public routes (no auth required)
  { pattern: /^\/$/i, auth: false },
  { pattern: /^\/about$/i, auth: false },
  { pattern: /^\/pricing$/i, auth: false },
  { pattern: /^\/terms$/i, auth: false },
  { pattern: /^\/privacy$/i, auth: false },
  { pattern: /^\/login$/i, auth: false },
  { pattern: /^\/register$/i, auth: false },
  { pattern: /^\/forgot-password$/i, auth: false },
  { pattern: /^\/reset-password$/i, auth: false },
  { pattern: /^\/shared\/[^\/]+$/i, auth: false },
  { pattern: /^\/preview\/[^\/]+$/i, auth: false },

  // API health check
  { pattern: /^\/api\/health$/i, auth: false },

  // Auth routes (redirect if already authenticated)
  { pattern: /^\/(login|register|forgot-password|reset-password)$/i, auth: false, redirect: '/dashboard' },

  // Dashboard routes (user access)
  { pattern: /^\/dashboard/i, auth: true, roles: ['user', 'admin'] },
  { pattern: /^\/files/i, auth: true, roles: ['user', 'admin'] },
  { pattern: /^\/search/i, auth: true, roles: ['user', 'admin'] },
  { pattern: /^\/settings/i, auth: true, roles: ['user', 'admin'] },
  { pattern: /^\/upgrade/i, auth: true, roles: ['user', 'admin'] },

  // Admin routes (admin only)
  { pattern: /^\/admin/i, auth: true, roles: ['admin'], permissions: ['admin:read'] },

  // API routes requiring authentication
  { pattern: /^\/api\/users/i, auth: true, roles: ['user', 'admin'] },
  { pattern: /^\/api\/files/i, auth: true, roles: ['user', 'admin'] },
  { pattern: /^\/api\/folders/i, auth: true, roles: ['user', 'admin'] },
  { pattern: /^\/api\/storage/i, auth: true, roles: ['user', 'admin'] },
  { pattern: /^\/api\/payments/i, auth: true, roles: ['user', 'admin'] },

  // Admin API routes
  { pattern: /^\/api\/admin/i, auth: true, roles: ['admin'], permissions: ['admin:read'] },
  
  // Default: require authentication
  { pattern: /.*/, auth: true, roles: ['user', 'admin'] }
];

export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Find matching route configuration
  const routeConfig = routeConfigs.find(config => config.pattern.test(pathname));
  
  if (!routeConfig) {
    // No matching config, allow by default
    return NextResponse.next();
  }

  try {
    // Get token from request
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });

    // Handle routes that don't require authentication
    if (!routeConfig.auth) {
      // If user is authenticated and trying to access auth pages, redirect
      if (token && routeConfig.redirect) {
        const redirectUrl = new URL(routeConfig.redirect, request.url);
        return NextResponse.redirect(redirectUrl);
      }
      return NextResponse.next();
    }

    // Route requires authentication but no token found
    if (!token) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(
          JSON.stringify({ 
            success: false, 
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Redirect to login with return URL
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Check if user exists and is active
    await connectToDatabase();
    const user = await User.findById(token.id);
    
    if (!user || !user.isActive) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(
          JSON.stringify({ 
            success: false, 
            error: { code: 'USER_INACTIVE', message: 'User account is inactive' }
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Redirect to login
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Check role requirements
    if (routeConfig.roles && !routeConfig.roles.includes(user.role)) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(
          JSON.stringify({ 
            success: false, 
            error: { code: 'INSUFFICIENT_ROLE', message: 'Insufficient role permissions' }
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Redirect based on user role
      const redirectUrl = user.role === 'admin' ? '/admin' : '/dashboard';
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }

    // Check specific permissions
    if (routeConfig.permissions) {
      const hasPermissions = routeConfig.permissions.every(permission =>
        PermissionUtils.hasPermission(user.role, permission)
      );
      
      if (!hasPermissions) {
        if (pathname.startsWith('/api/')) {
          return new NextResponse(
            JSON.stringify({ 
              success: false, 
              error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Insufficient permissions' }
            }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        // Redirect to appropriate dashboard
        const redirectUrl = user.role === 'admin' ? '/admin' : '/dashboard';
        return NextResponse.redirect(new URL(redirectUrl, request.url));
      }
    }

    // Add user info to request headers for API routes
    if (pathname.startsWith('/api/')) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', user._id.toString());
      requestHeaders.set('x-user-role', user.role);
      requestHeaders.set('x-user-email', user.email);
      
      return NextResponse.next({
        request: {
          headers: requestHeaders
        }
      });
    }

    return NextResponse.next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ 
          success: false, 
          error: { code: 'AUTH_ERROR', message: 'Authentication error' }
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Redirect to login on error
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}

// Helper function to check if route requires authentication
export function requiresAuth(pathname: string): boolean {
  const routeConfig = routeConfigs.find(config => config.pattern.test(pathname));
  return routeConfig?.auth ?? true;
}

// Helper function to check if user has access to route
export async function hasRouteAccess(
  pathname: string, 
  userRole: 'user' | 'admin'
): Promise<boolean> {
  const routeConfig = routeConfigs.find(config => config.pattern.test(pathname));
  
  if (!routeConfig) return true;
  if (!routeConfig.auth) return true;
  
  // Check role requirements
  if (routeConfig.roles && !routeConfig.roles.includes(userRole)) {
    return false;
  }
  
  // Check permission requirements
  if (routeConfig.permissions) {
    return routeConfig.permissions.every(permission =>
      PermissionUtils.hasPermission(userRole, permission)
    );
  }
  
  return true;
}

// Helper function to get redirect URL for unauthorized access
export function getUnauthorizedRedirect(userRole?: 'user' | 'admin'): string {
  if (!userRole) return '/login';
  return userRole === 'admin' ? '/admin' : '/dashboard';
}

// Rate limiting configuration for auth routes
export const authRateLimits = {
  '/api/auth/signin': { requests: 5, window: 60 * 1000 }, // 5 attempts per minute
  '/api/auth/register': { requests: 3, window: 60 * 1000 }, // 3 attempts per minute
  '/api/auth/forgot-password': { requests: 3, window: 60 * 1000 }, // 3 attempts per minute
  '/api/auth/reset-password': { requests: 5, window: 60 * 1000 }, // 5 attempts per minute
};

// Maintenance mode check
export async function checkMaintenanceMode(): Promise<boolean> {
  try {
    await connectToDatabase();
    const SystemSettings = (await import('../database/models/system-settings')).SystemSettings;
    const settings = await SystemSettings.getInstance();
    return settings.maintenance.enabled;
  } catch (error) {
    console.error('Error checking maintenance mode:', error);
    return false;
  }
}