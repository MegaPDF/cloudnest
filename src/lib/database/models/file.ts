import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IFileVersion {
  version: number;
  size: number;
  storageKey: string;
  uploadedAt: Date;
  uploadedBy: mongoose.Types.ObjectId;
}

export interface IFile extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  originalName: string;
  description?: string;
  mimeType: string;
  size: number;
  extension: string;
  storageProvider: 'aws' | 'cloudflare' | 'wasabi' | 'gridfs';
  storageKey: string;
  hash: string;
  owner: mongoose.Types.ObjectId;
  folder?: mongoose.Types.ObjectId;
  isPublic: boolean;
  versions: IFileVersion[];
  currentVersion: number;
  tags: string[];
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
    bitrate?: number;
    [key: string]: any;
  };
  access: {
    views: number;
    downloads: number;
    lastAccessedAt?: Date;
  };
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFileMethods {
  addVersion(data: Omit<IFileVersion, 'version' | 'uploadedAt'>): Promise<void>;
  getLatestVersion(): IFileVersion;
  incrementViews(): Promise<void>;
  incrementDownloads(): Promise<void>;
  softDelete(userId: mongoose.Types.ObjectId): Promise<void>;
  restore(): Promise<void>;
  getPublicUrl(): string;
}

export interface FileModel extends Model<IFile, {}, IFileMethods> {
  findByOwner(userId: mongoose.Types.ObjectId): Promise<IFile[]>;
  findInFolder(folderId: mongoose.Types.ObjectId): Promise<IFile[]>;
  findByHash(hash: string): Promise<IFile | null>;
  searchFiles(query: string, userId: mongoose.Types.ObjectId): Promise<IFile[]>;
  getDeletedFiles(userId: mongoose.Types.ObjectId): Promise<IFile[]>;
}

const fileVersionSchema = new Schema<IFileVersion>({
  version: {
    type: Number,
    required: true
  },
  size: {
    type: Number,
    required: true,
    min: 0
  },
  storageKey: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { _id: false });

const fileSchema = new Schema<IFile, FileModel, IFileMethods>({
  name: {
    type: String,
    required: [true, 'File name is required'],
    trim: true,
    maxlength: [255, 'File name cannot exceed 255 characters']
  },
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    trim: true
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required']
  },
  size: {
    type: Number,
    required: [true, 'File size is required'],
    min: [0, 'File size cannot be negative']
  },
  extension: {
    type: String,
    required: true,
    lowercase: true
  },
  storageProvider: {
    type: String,
    enum: ['aws', 'cloudflare', 'wasabi', 'gridfs'],
    required: true
  },
  storageKey: {
    type: String,
    required: true,
    unique: true
  },
  hash: {
    type: String,
    required: true,
    index: true
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  folder: {
    type: Schema.Types.ObjectId,
    ref: 'Folder',
    default: null
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  versions: [fileVersionSchema],
  currentVersion: {
    type: Number,
    default: 1
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  access: {
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
    lastAccessedAt: Date
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date,
  deletedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
fileSchema.index({ owner: 1, isDeleted: 1 });
fileSchema.index({ folder: 1, isDeleted: 1 });
fileSchema.index({ name: 'text', description: 'text', tags: 'text' });
fileSchema.index({ mimeType: 1 });
fileSchema.index({ createdAt: -1 });
fileSchema.index({ 'access.lastAccessedAt': -1 });

// Virtual for file type category
fileSchema.virtual('category').get(function() {
  const mimeType = this.mimeType;
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('text/') || mimeType === 'application/json') return 'text';
  return 'other';
});

// Pre-save middleware
fileSchema.pre('save', function(next) {
  if (this.versions.length === 0) {
    this.versions.push({
      version: 1,
      size: this.size,
      storageKey: this.storageKey,
      uploadedAt: new Date(),
      uploadedBy: this.owner
    });
  }
  next();
});

// Instance methods
fileSchema.methods.addVersion = async function(data: Omit<IFileVersion, 'version' | 'uploadedAt'>): Promise<void> {
  const newVersion = this.currentVersion + 1;
  this.versions.push({
    ...data,
    version: newVersion,
    uploadedAt: new Date()
  });
  this.currentVersion = newVersion;
  this.storageKey = data.storageKey;
  this.size = data.size;
  await this.save();
};

fileSchema.methods.getLatestVersion = function(): IFileVersion {
  return this.versions.find(v => v.version === this.currentVersion) || this.versions[this.versions.length - 1];
};

fileSchema.methods.incrementViews = async function(): Promise<void> {
  this.access.views += 1;
  this.access.lastAccessedAt = new Date();
  await this.save();
};

fileSchema.methods.incrementDownloads = async function(): Promise<void> {
  this.access.downloads += 1;
  this.access.lastAccessedAt = new Date();
  await this.save();
};

fileSchema.methods.softDelete = async function(userId: mongoose.Types.ObjectId): Promise<void> {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  await this.save();
};

fileSchema.methods.restore = async function(): Promise<void> {
  this.isDeleted = false;
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  await this.save();
};

fileSchema.methods.getPublicUrl = function(): string {
  return `/api/files/download/${this._id}`;
};

// Static methods
fileSchema.statics.findByOwner = function(userId: mongoose.Types.ObjectId) {
  return this.find({ owner: userId, isDeleted: false }).populate('folder', 'name path');
};

fileSchema.statics.findInFolder = function(folderId: mongoose.Types.ObjectId) {
  return this.find({ folder: folderId, isDeleted: false }).populate('owner', 'name email');
};

fileSchema.statics.findByHash = function(hash: string) {
  return this.findOne({ hash, isDeleted: false });
};

fileSchema.statics.searchFiles = function(query: string, userId: mongoose.Types.ObjectId) {
  return this.find({
    $and: [
      { owner: userId, isDeleted: false },
      {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ]
      }
    ]
  }).populate('folder', 'name path');
};

fileSchema.statics.getDeletedFiles = function(userId: mongoose.Types.ObjectId) {
  return this.find({ owner: userId, isDeleted: true }).populate('folder', 'name path');
};

export const File = (mongoose.models.File as FileModel) || mongoose.model<IFile, FileModel>('File', fileSchema);
