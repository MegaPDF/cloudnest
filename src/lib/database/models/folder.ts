import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IFolder extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  owner: mongoose.Types.ObjectId;
  parent?: mongoose.Types.ObjectId;
  path: string;
  color?: string;
  isShared: boolean;
  isPublic: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFolderMethods {
  getChildren(): Promise<IFolder[]>;
  getFiles(): Promise<any[]>;
  getFullPath(): Promise<string>;
  softDelete(userId: mongoose.Types.ObjectId): Promise<void>;
  restore(): Promise<void>;
  move(newParentId?: mongoose.Types.ObjectId): Promise<void>;
  getDescendants(): Promise<IFolder[]>;
}

export interface FolderModel extends Model<IFolder, {}, IFolderMethods> {
  findByOwner(userId: mongoose.Types.ObjectId): Promise<IFolder[]>;
  findRootFolders(userId: mongoose.Types.ObjectId): Promise<IFolder[]>;
  findByPath(path: string, userId: mongoose.Types.ObjectId): Promise<IFolder | null>;
  createFolder(data: Partial<IFolder>): Promise<IFolder>;
  getDeletedFolders(userId: mongoose.Types.ObjectId): Promise<IFolder[]>;
}

const folderSchema = new Schema<IFolder, FolderModel, IFolderMethods>({
  name: {
    type: String,
    required: [true, 'Folder name is required'],
    trim: true,
    maxlength: [100, 'Folder name cannot exceed 100 characters'],
    validate: {
      validator: function(name: string) {
        return !/[<>:"/\\|?*]/.test(name);
      },
      message: 'Folder name contains invalid characters'
    }
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    trim: true
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  parent: {
    type: Schema.Types.ObjectId,
    ref: 'Folder',
    default: null
  },
  path: {
    type: String,
    required: true,
    index: true
  },
  color: {
    type: String,
    match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
    default: '#3B82F6'
  },
  isShared: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: false
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
folderSchema.index({ owner: 1, parent: 1, isDeleted: 1 });
folderSchema.index({ path: 1, owner: 1 });
folderSchema.index({ name: 'text', description: 'text' });
folderSchema.index({ createdAt: -1 });

// Virtual for depth level
folderSchema.virtual('depth').get(function() {
  return this.path.split('/').length - 1;
});

// Pre-save middleware to generate path
folderSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('parent') || this.isModified('name')) {
    if (!this.parent) {
      this.path = `/${this.name}`;
    } else {
      const parent = await (this.constructor as FolderModel).findById(this.parent);
      if (parent) {
        this.path = `${(parent as IFolder).path}/${this.name}`;
      }
    }
  }
  next();
});

// Instance methods
folderSchema.methods.getChildren = function(): Promise<IFolder[]> {
  return (this.constructor as FolderModel).find({ parent: this._id, isDeleted: false }).sort('name');
};

folderSchema.methods.getFiles = async function(): Promise<any[]> {
  const File = mongoose.model('File');
  return File.find({ folder: this._id, isDeleted: false }).sort('name');
};

folderSchema.methods.getFullPath = async function(): Promise<string> {
  return this.path;
};

folderSchema.methods.softDelete = async function(userId: mongoose.Types.ObjectId): Promise<void> {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  await this.save();
  
  // Also soft delete all children
  const children = await this.getDescendants();
  for (const child of children) {
    await (child as IFolder & IFolderMethods).softDelete(userId);
  }

  // Soft delete all files in this folder
  const File = mongoose.model('File');
  await File.updateMany(
    { folder: this._id },
    { 
      isDeleted: true, 
      deletedAt: new Date(), 
      deletedBy: userId 
    }
  );
};

folderSchema.methods.restore = async function(): Promise<void> {
  this.isDeleted = false;
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  await this.save();
};

folderSchema.methods.move = async function(newParentId?: mongoose.Types.ObjectId): Promise<void> {
  this.parent = newParentId || undefined;
  await this.save();
  
  // Update paths for all descendants
  const descendants = await this.getDescendants();
  for (const descendant of descendants) {
    await descendant.save(); // This will trigger the pre-save hook to update path
  }
};

folderSchema.methods.getDescendants = async function(): Promise<IFolder[]> {
  return (this.constructor as FolderModel).find({
    path: { $regex: `^${this.path}/` },
    owner: this.owner,
    isDeleted: false
  });
};

// Static methods
folderSchema.statics.findByOwner = function(userId: mongoose.Types.ObjectId) {
  return this.find({ owner: userId, isDeleted: false }).sort('path');
};

folderSchema.statics.findRootFolders = function(userId: mongoose.Types.ObjectId) {
  return this.find({ owner: userId, parent: null, isDeleted: false }).sort('name');
};

folderSchema.statics.findByPath = function(path: string, userId: mongoose.Types.ObjectId) {
  return this.findOne({ path, owner: userId, isDeleted: false });
};

folderSchema.statics.createFolder = async function(data: Partial<IFolder>): Promise<IFolder> {
  const folder = new this(data);
  return folder.save();
};

folderSchema.statics.getDeletedFolders = function(userId: mongoose.Types.ObjectId) {
  return this.find({ owner: userId, isDeleted: true }).sort('-deletedAt');
};

export const Folder = (mongoose.models.Folder as FolderModel) || mongoose.model<IFolder, FolderModel>('Folder', folderSchema);
