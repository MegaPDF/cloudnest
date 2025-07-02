// src/lib/config/site.ts
import { env } from './env';
import { SupportedLanguage, SupportedCurrency } from '@/lib/i18n/config';

export interface SiteConfig {
  name: string;
  description: string;
  url: string;
  version: string;
  author: {
    name: string;
    email: string;
    url: string;
  };
  keywords: string[];
  social: {
    twitter?: string;
    github?: string;
    linkedin?: string;
    facebook?: string;
  };
  support: {
    email: string;
    docs: string;
    community: string;
    status: string;
  };
  legal: {
    privacyPolicy: string;
    termsOfService: string;
    cookiePolicy: string;
  };
  branding: {
    logo: {
      light: string;
      dark: string;
      favicon: string;
      appleTouchIcon: string;
    };
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      foreground: string;
    };
    fonts: {
      sans: string[];
      mono: string[];
    };
  };
  features: {
    auth: {
      enableRegistration: boolean;
      enableEmailVerification: boolean;
      enableOAuth: boolean;
      enableTwoFactor: boolean;
      providers: string[];
    };
    storage: {
      maxFileSize: number;
      maxFilesPerUpload: number;
      enableCompression: boolean;
      enableEncryption: boolean;
      enableVersioning: boolean;
    };
    sharing: {
      enableFileSharing: boolean;
      enablePublicSharing: boolean;
      enablePasswordProtection: boolean;
      enableExpirationDates: boolean;
      maxSharesPerUser: number;
    };
    collaboration: {
      enableComments: boolean;
      enableRealTimeUpdates: boolean;
      enableActivityFeed: boolean;
    };
    subscription: {
      enableBilling: boolean;
      enableTrials: boolean;
      trialDays: number;
      enableCoupons: boolean;
    };
  };
  limits: {
    storage: {
      free: number;
      pro: number;
      enterprise: number;
    };
    files: {
      maxPerUpload: number;
      maxFileSize: number;
      maxFolderDepth: number;
    };
    api: {
      rateLimit: number;
      burstLimit: number;
      windowMs: number;
    };
  };
  localization: {
    defaultLanguage: SupportedLanguage;
    supportedLanguages: SupportedLanguage[];
    defaultCurrency: SupportedCurrency;
    supportedCurrencies: SupportedCurrency[];
    defaultTimezone: string;
  };
  seo: {
    titleTemplate: string;
    defaultTitle: string;
    defaultDescription: string;
    openGraph: {
      type: string;
      siteName: string;
      images: Array<{
        url: string;
        width: number;
        height: number;
        alt: string;
      }>;
    };
    twitter: {
      card: string;
      site?: string;
      creator?: string;
    };
  };
  analytics: {
    googleAnalytics?: string;
    plausible?: string;
    mixpanel?: string;
    hotjar?: string;
  };
  integrations: {
    sentry?: string;
    crisp?: string;
    intercom?: string;
    calendly?: string;
  };
}

export const siteConfig: SiteConfig = {
  name: 'CloudNest',
  description: 'Secure cloud storage and file management platform with powerful sharing capabilities',
  url: env.NEXTAUTH_URL || 'https://cloudnest.com',
  version: '1.0.0',
  author: {
    name: 'CloudNest Team',
    email: 'hello@cloudnest.com',
    url: 'https://cloudnest.com',
  },
  keywords: [
    'cloud storage',
    'file management',
    'file sharing',
    'secure storage',
    'collaboration',
    'document management',
    'backup',
    'sync',
    'team collaboration',
    'file hosting',
  ],
  social: {
    twitter: '@cloudnest',
    github: 'https://github.com/cloudnest',
    linkedin: 'https://linkedin.com/company/cloudnest',
    facebook: 'https://facebook.com/cloudnest',
  },
  support: {
    email: 'support@cloudnest.com',
    docs: 'https://docs.cloudnest.com',
    community: 'https://community.cloudnest.com',
    status: 'https://status.cloudnest.com',
  },
  legal: {
    privacyPolicy: '/privacy',
    termsOfService: '/terms',
    cookiePolicy: '/cookies',
  },
  branding: {
    logo: {
      light: '/images/logo-light.svg',
      dark: '/images/logo-dark.svg',
      favicon: '/favicon.ico',
      appleTouchIcon: '/apple-touch-icon.png',
    },
    colors: {
      primary: '#3B82F6', // blue-500
      secondary: '#1E40AF', // blue-700
      accent: '#F59E0B', // amber-500
      background: '#FFFFFF',
      foreground: '#0F172A', // slate-900
    },
    fonts: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'Consolas', 'monospace'],
    },
  },
  features: {
    auth: {
      enableRegistration: env.ENABLE_REGISTRATION === 'true',
      enableEmailVerification: env.ENABLE_EMAIL_VERIFICATION === 'true',
      enableOAuth: Boolean(env.GOOGLE_CLIENT_ID),
      enableTwoFactor: false,
      providers: [
        env.GOOGLE_CLIENT_ID ? 'google' : null,
        env.GITHUB_CLIENT_ID ? 'github' : null,
      ].filter(Boolean) as string[],
    },
    storage: {
      maxFileSize: parseInt(env.MAX_FILE_SIZE),
      maxFilesPerUpload: 50,
      enableCompression: env.ENABLE_FILE_COMPRESSION === 'true',
      enableEncryption: env.ENABLE_FILE_ENCRYPTION === 'true',
      enableVersioning: env.ENABLE_FILE_VERSIONING === 'true',
    },
    sharing: {
      enableFileSharing: env.ENABLE_FILE_SHARING === 'true',
      enablePublicSharing: env.ENABLE_PUBLIC_SHARING === 'true',
      enablePasswordProtection: true,
      enableExpirationDates: true,
      maxSharesPerUser: 100,
    },
    collaboration: {
      enableComments: true,
      enableRealTimeUpdates: false,
      enableActivityFeed: true,
    },
    subscription: {
      enableBilling: Boolean(env.STRIPE_SECRET_KEY),
      enableTrials: true,
      trialDays: 14,
      enableCoupons: true,
    },
  },
  limits: {
    storage: {
      free: 5 * 1024 * 1024 * 1024, // 5GB
      pro: 100 * 1024 * 1024 * 1024, // 100GB
      enterprise: 1024 * 1024 * 1024 * 1024, // 1TB
    },
    files: {
      maxPerUpload: 50,
      maxFileSize: parseInt(env.MAX_FILE_SIZE),
      maxFolderDepth: 10,
    },
    api: {
      rateLimit: parseInt(env.API_RATE_LIMIT),
      burstLimit: parseInt(env.API_RATE_LIMIT) * 2,
      windowMs: parseInt(env.RATE_LIMIT_WINDOW),
    },
  },
  localization: {
    defaultLanguage: env.DEFAULT_LANGUAGE,
    supportedLanguages: ['en', 'id'],
    defaultCurrency: env.DEFAULT_CURRENCY,
    supportedCurrencies: ['USD', 'IDR'],
    defaultTimezone: env.DEFAULT_TIMEZONE,
  },
  seo: {
    titleTemplate: '%s | CloudNest',
    defaultTitle: 'CloudNest - Secure Cloud Storage',
    defaultDescription: 'Store, share, and collaborate on your files with CloudNest. Secure cloud storage with powerful sharing features for individuals and teams.',
    openGraph: {
      type: 'website',
      siteName: 'CloudNest',
      images: [
        {
          url: '/images/og-image.png',
          width: 1200,
          height: 630,
          alt: 'CloudNest - Secure Cloud Storage',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@cloudnest',
      creator: '@cloudnest',
    },
  },
  analytics: {
    googleAnalytics: env.ANALYTICS_TRACKING_ID,
    plausible: env.NODE_ENV === 'production' ? 'cloudnest.com' : undefined,
  },
  integrations: {
    sentry: env.SENTRY_DSN,
  },
};

// Navigation configuration
export interface NavigationConfig {
  main: NavigationItem[];
  dashboard: NavigationItem[];
  admin: NavigationItem[];
  footer: NavigationItem[];
  mobile: NavigationItem[];
}

export interface NavigationItem {
  label: string;
  href: string;
  icon?: string;
  description?: string;
  external?: boolean;
  badge?: string;
  children?: NavigationItem[];
  roles?: ('user' | 'admin')[];
  feature?: string; // Feature flag to check
}

export const navigationConfig: NavigationConfig = {
  main: [
    {
      label: 'Features',
      href: '/features',
      description: 'Explore CloudNest features',
    },
    {
      label: 'Pricing',
      href: '/pricing',
      description: 'Simple, transparent pricing',
    },
    {
      label: 'About',
      href: '/about',
      description: 'Learn about CloudNest',
    },
    {
      label: 'Contact',
      href: '/contact',
      description: 'Get in touch with us',
    },
  ],
  dashboard: [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: 'Home',
    },
    {
      label: 'My Files',
      href: '/files',
      icon: 'FolderOpen',
      children: [
        { label: 'All Files', href: '/files' },
        { label: 'Recent', href: '/files/recent' },
        { label: 'Shared', href: '/files/shared' },
        { label: 'Trash', href: '/files/trash' },
      ],
    },
    {
      label: 'Search',
      href: '/search',
      icon: 'Search',
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: 'Settings',
      children: [
        { label: 'Profile', href: '/settings/profile' },
        { label: 'Preferences', href: '/settings/preferences' },
        { label: 'Billing', href: '/settings/billing', feature: 'subscription.enableBilling' },
        { label: 'Storage', href: '/settings/storage' },
      ],
    },
    {
      label: 'Upgrade',
      href: '/upgrade',
      icon: 'Crown',
      badge: 'Pro',
      feature: 'subscription.enableBilling',
    },
  ],
  admin: [
    {
      label: 'Admin Dashboard',
      href: '/admin',
      icon: 'BarChart3',
      roles: ['admin'],
    },
    {
      label: 'Users',
      href: '/admin/users',
      icon: 'Users',
      roles: ['admin'],
    },
    {
      label: 'Analytics',
      href: '/admin/analytics',
      icon: 'TrendingUp',
      roles: ['admin'],
    },
    {
      label: 'System Settings',
      href: '/admin/system-settings',
      icon: 'Settings',
      roles: ['admin'],
    },
    {
      label: 'Storage Config',
      href: '/admin/storage-config',
      icon: 'HardDrive',
      roles: ['admin'],
    },
    {
      label: 'Email Config',
      href: '/admin/email-config',
      icon: 'Mail',
      roles: ['admin'],
    },
    {
      label: 'Pricing',
      href: '/admin/pricing',
      icon: 'DollarSign',
      roles: ['admin'],
    },
  ],
  footer: [
    {
      label: 'Features',
      href: '/features',
    },
    {
      label: 'Pricing',
      href: '/pricing',
    },
    {
      label: 'About',
      href: '/about',
    },
    {
      label: 'Contact',
      href: '/contact',
    },
    {
      label: 'Privacy Policy',
      href: '/privacy',
    },
    {
      label: 'Terms of Service',
      href: '/terms',
    },
    {
      label: 'Status',
      href: 'https://status.cloudnest.com',
      external: true,
    },
    {
      label: 'Documentation',
      href: 'https://docs.cloudnest.com',
      external: true,
    },
  ],
  mobile: [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: 'Home',
    },
    {
      label: 'Files',
      href: '/files',
      icon: 'FolderOpen',
    },
    {
      label: 'Search',
      href: '/search',
      icon: 'Search',
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: 'Settings',
    },
  ],
};

// Quick actions configuration
export interface QuickAction {
  label: string;
  href: string;
  icon: string;
  description: string;
  color?: string;
  feature?: string;
}

export const quickActions: QuickAction[] = [
  {
    label: 'Upload Files',
    href: '/files?action=upload',
    icon: 'Upload',
    description: 'Upload new files to your storage',
    color: 'blue',
  },
  {
    label: 'Create Folder',
    href: '/files?action=create-folder',
    icon: 'FolderPlus',
    description: 'Organize your files in folders',
    color: 'green',
  },
  {
    label: 'Share Files',
    href: '/files/shared',
    icon: 'Share',
    description: 'Share files with others',
    color: 'purple',
    feature: 'sharing.enableFileSharing',
  },
  {
    label: 'View Trash',
    href: '/files/trash',
    icon: 'Trash2',
    description: 'Recover deleted files',
    color: 'red',
    feature: 'ENABLE_TRASH',
  },
];

// Help links configuration
export interface HelpLink {
  label: string;
  href: string;
  icon: string;
  external: boolean;
}

export const helpLinks: HelpLink[] = [
  {
    label: 'Documentation',
    href: 'https://docs.cloudnest.com',
    icon: 'BookOpen',
    external: true,
  },
  {
    label: 'Video Tutorials',
    href: 'https://docs.cloudnest.com/tutorials',
    icon: 'Video',
    external: true,
  },
  {
    label: 'Community Forum',
    href: 'https://community.cloudnest.com',
    icon: 'MessageCircle',
    external: true,
  },
  {
    label: 'Contact Support',
    href: '/contact',
    icon: 'HelpCircle',
    external: false,
  },
  {
    label: 'Feature Requests',
    href: 'https://feedback.cloudnest.com',
    icon: 'Lightbulb',
    external: true,
  },
  {
    label: 'System Status',
    href: 'https://status.cloudnest.com',
    icon: 'Activity',
    external: true,
  },
];

export default siteConfig;