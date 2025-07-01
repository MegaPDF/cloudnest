import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IShare extends Document {
  _id: mongoose.Types.ObjectId;
  type: 'file' | 'folder';
  resourceId: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  shareToken: string;
  shareUrl: string;
  permissions: {
    canView: boolean;
    canDownload: boolean;
    canEdit: boolean;
    canShare: boolean;
  };
  access: {
    type: 'public' | 'restricted' | 'password';
    password?: string;
    allowedEmails?: string[];
    domains?: string[];
  };
  settings: {
    expiresAt?: Date;
    downloadLimit?: number;
    viewLimit?: number;
    requireSignIn: boolean;
    allowComments: boolean;
  };
  stats: {
    views: number;
    downloads: number;
    lastAccessedAt?: Date;
    accessHistory: {
      ip: string;
      userAgent: string;
      accessedAt: Date;
      action: 'view' | 'download';
    }[];
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IShareMethods {
  generateShareToken(): string;
  generateShareUrl(): string;
  isExpired(): boolean;
  canAccess(email?: string, domain?: string): boolean;
  incrementViews(ip: string, userAgent: string): Promise<void>;
  incrementDownloads(ip: string, userAgent: string): Promise<void>;
  checkLimits(): { canView: boolean; canDownload: boolean };
}

export interface ShareModel extends Model<IShare, {}, IShareMethods> {
  findByToken(token: string): Promise<IShare | null>;
  findByResource(resourceId: mongoose.Types.ObjectId, type: 'file' | 'folder'): Promise<IShare | null>;
  findByOwner(userId: mongoose.Types.ObjectId): Promise<IShare[]>;
  createShare(data: Partial<IShare>): Promise<IShare>;
}

const shareSchema = new Schema<IShare, ShareModel, IShareMethods>({
  type: {
    type: String,
    enum: ['file', 'folder'],
    required: true
  },
  resourceId: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: 'type'
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  shareToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  shareUrl: {
    type: String,
    required: true
  },
  permissions: {
    canView: {
      type: Boolean,
      default: true
    },
    canDownload: {
      type: Boolean,
      default: true
    },
    canEdit: {
      type: Boolean,
      default: false
    },
    canShare: {
      type: Boolean,
      default: false
    }
  },
  access: {
    type: {
      type: String,
      enum: ['public', 'restricted', 'password'],
      default: 'public'
    },
    password: {
      type: String,
      select: false
    },
    allowedEmails: [String],
    domains: [String]
  },
  settings: {
    expiresAt: Date,
    downloadLimit: {
      type: Number,
      min: 0
    },
    viewLimit: {
      type: Number,
      min: 0
    },
    requireSignIn: {
      type: Boolean,
      default: false
    },
    allowComments: {
      type: Boolean,
      default: false
    }
  },
  stats: {
    views: {
      type: Number,
      default: 0,
      min: 0
    },
    downloads: {
      type: Number,
      default: 0,
      min: 0
    },
    lastAccessedAt: Date,
    accessHistory: [{
      ip: {
        type: String,
        required: true
      },
      userAgent: {
        type: String,
        required: true
      },
      accessedAt: {
        type: Date,
        default: Date.now
      },
      action: {
        type: String,
        enum: ['view', 'download'],
        required: true
      }
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
shareSchema.index({ shareToken: 1, isActive: 1 });
shareSchema.index({ resourceId: 1, type: 1 });
shareSchema.index({ owner: 1, isActive: 1 });
shareSchema.index({ 'settings.expiresAt': 1 });
shareSchema.index({ createdAt: -1 });

// Pre-save middleware
shareSchema.pre('save', function(next) {
  if (this.isNew) {
    this.shareToken = this.generateShareToken();
    this.shareUrl = this.generateShareUrl();
  }
  next();
});

// Instance methods
shareSchema.methods.generateShareToken = function(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
};

shareSchema.methods.generateShareUrl = function(): string {
  return `/shared/${this.shareToken}`;
};

shareSchema.methods.isExpired = function(): boolean {
  return this.settings.expiresAt ? new Date() > this.settings.expiresAt : false;
};

shareSchema.methods.canAccess = function(email?: string, domain?: string): boolean {
  if (!this.isActive || this.isExpired()) return false;
  
  if (this.access.type === 'public') return true;
  
  if (this.access.type === 'restricted') {
    if (email && this.access.allowedEmails?.includes(email)) return true;
    if (domain && this.access.domains?.some(d => email?.endsWith(d))) return true;
    return false;
  }
  
  return true; // Password access is handled separately
};

shareSchema.methods.incrementViews = async function(ip: string, userAgent: string): Promise<void> {
  this.stats.views += 1;
  this.stats.lastAccessedAt = new Date();
  this.stats.accessHistory.push({
    ip,
    userAgent,
    accessedAt: new Date(),
    action: 'view'
  });
  await this.save();
};

shareSchema.methods.incrementDownloads = async function(ip: string, userAgent: string): Promise<void> {
  this.stats.downloads += 1;
  this.stats.lastAccessedAt = new Date();
  this.stats.accessHistory.push({
    ip,
    userAgent,
    accessedAt: new Date(),
    action: 'download'
  });
  await this.save();
};

shareSchema.methods.checkLimits = function(): { canView: boolean; canDownload: boolean } {
  const canView = !this.settings.viewLimit || this.stats.views < this.settings.viewLimit;
  const canDownload = !this.settings.downloadLimit || this.stats.downloads < this.settings.downloadLimit;
  
  return { canView, canDownload };
};

// Static methods
shareSchema.statics.findByToken = function(token: string) {
  return this.findOne({ shareToken: token, isActive: true });
};

shareSchema.statics.findByResource = function(resourceId: mongoose.Types.ObjectId, type: 'file' | 'folder') {
  return this.findOne({ resourceId, type, isActive: true });
};

shareSchema.statics.findByOwner = function(userId: mongoose.Types.ObjectId) {
  return this.find({ owner: userId, isActive: true }).sort('-createdAt');
};

shareSchema.statics.createShare = function(data: Partial<IShare>) {
  const share = new this(data);
  return share.save();
};

export const Share = (mongoose.models.Share as ShareModel) || mongoose.model<IShare, ShareModel>('Share', shareSchema);
