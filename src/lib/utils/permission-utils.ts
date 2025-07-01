import { USER_ROLES } from './constants';

export type Permission = 
  | 'files:read' | 'files:write' | 'files:delete' | 'files:share'
  | 'folders:read' | 'folders:write' | 'folders:delete' | 'folders:share'
  | 'users:read' | 'users:write' | 'users:delete'
  | 'admin:read' | 'admin:write' | 'admin:delete'
  | 'settings:read' | 'settings:write'
  | 'storage:read' | 'storage:write' | 'storage:config'
  | 'email:read' | 'email:write' | 'email:send'
  | 'analytics:read' | 'system:maintenance';

export interface UserPermissions {
  role: 'user' | 'admin';
  permissions: Permission[];
}

export class PermissionUtils {
  // Role-based permissions mapping
  private static readonly ROLE_PERMISSIONS: Record<string, Permission[]> = {
    [USER_ROLES.USER]: [
      'files:read', 'files:write', 'files:delete', 'files:share',
      'folders:read', 'folders:write', 'folders:delete', 'folders:share',
      'settings:read', 'settings:write'
    ],
    [USER_ROLES.ADMIN]: [
      // All user permissions plus admin permissions
      'files:read', 'files:write', 'files:delete', 'files:share',
      'folders:read', 'folders:write', 'folders:delete', 'folders:share',
      'users:read', 'users:write', 'users:delete',
      'admin:read', 'admin:write', 'admin:delete',
      'settings:read', 'settings:write',
      'storage:read', 'storage:write', 'storage:config',
      'email:read', 'email:write', 'email:send',
      'analytics:read', 'system:maintenance'
    ]
  };

  /**
   * Get permissions for a user role
   */
  static getPermissionsForRole(role: 'user' | 'admin'): Permission[] {
    return this.ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Check if user has specific permission
   */
  static hasPermission(userRole: 'user' | 'admin', permission: Permission): boolean {
    const permissions = this.getPermissionsForRole(userRole);
    return permissions.includes(permission);
  }

  /**
   * Check if user has any of the required permissions
   */
  static hasAnyPermission(userRole: 'user' | 'admin', permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(userRole, permission));
  }

  /**
   * Check if user has all required permissions
   */
  static hasAllPermissions(userRole: 'user' | 'admin', permissions: Permission[]): boolean {
    return permissions.every(permission => this.hasPermission(userRole, permission));
  }

  /**
   * Check if user can access resource
   */
  static canAccessResource(
    userRole: 'user' | 'admin',
    userId: string,
    resourceOwnerId: string,
    requiredPermission: Permission
  ): boolean {
    // Admin can access everything
    if (userRole === USER_ROLES.ADMIN) {
      return this.hasPermission(userRole, requiredPermission);
    }

    // User can access their own resources
    if (userId === resourceOwnerId) {
      return this.hasPermission(userRole, requiredPermission);
    }

    return false;
  }

  /**
   * Check file access permissions
   */
  static canAccessFile(
    userRole: 'user' | 'admin',
    userId: string,
    fileOwnerId: string,
    action: 'read' | 'write' | 'delete' | 'share'
  ): boolean {
    const permission = `files:${action}` as Permission;
    return this.canAccessResource(userRole, userId, fileOwnerId, permission);
  }

  /**
   * Check folder access permissions
   */
  static canAccessFolder(
    userRole: 'user' | 'admin',
    userId: string,
    folderOwnerId: string,
    action: 'read' | 'write' | 'delete' | 'share'
  ): boolean {
    const permission = `folders:${action}` as Permission;
    return this.canAccessResource(userRole, userId, folderOwnerId, permission);
  }

  /**
   * Check share access permissions
   */
  static canAccessShare(
    shareSettings: {
      isPublic: boolean;
      allowedEmails?: string[];
      requireSignIn: boolean;
      expiresAt?: Date;
    },
    userEmail?: string
  ): { canAccess: boolean; reason?: string } {
    // Check if share is expired
    if (shareSettings.expiresAt && new Date() > shareSettings.expiresAt) {
      return { canAccess: false, reason: 'Share has expired' };
    }

    // Public shares
    if (shareSettings.isPublic && !shareSettings.requireSignIn) {
      return { canAccess: true };
    }

    // Requires sign in but no user email provided
    if (shareSettings.requireSignIn && !userEmail) {
      return { canAccess: false, reason: 'Sign in required' };
    }

    // Check allowed emails
    if (shareSettings.allowedEmails && shareSettings.allowedEmails.length > 0) {
      if (!userEmail || !shareSettings.allowedEmails.includes(userEmail)) {
        return { canAccess: false, reason: 'Email not authorized' };
      }
    }

    return { canAccess: true };
  }

  /**
   * Get user's effective permissions
   */
  static getUserPermissions(userRole: 'user' | 'admin'): UserPermissions {
    return {
      role: userRole,
      permissions: this.getPermissionsForRole(userRole)
    };
  }

  /**
   * Check admin-only access
   */
  static requireAdmin(userRole: 'user' | 'admin'): boolean {
    return userRole === USER_ROLES.ADMIN;
  }

  /**
   * Filter permissions for frontend
   */
  static getClientPermissions(userRole: 'user' | 'admin'): Record<string, boolean> {
    const permissions = this.getPermissionsForRole(userRole);
    
    return {
      canManageUsers: permissions.includes('users:write'),
      canManageSystem: permissions.includes('admin:write'),
      canConfigureStorage: permissions.includes('storage:config'),
      canConfigureEmail: permissions.includes('email:write'),
      canViewAnalytics: permissions.includes('analytics:read'),
      canMaintainSystem: permissions.includes('system:maintenance'),
      canShareFiles: permissions.includes('files:share'),
      canShareFolders: permissions.includes('folders:share'),
      isAdmin: userRole === USER_ROLES.ADMIN
    };
  }
}
