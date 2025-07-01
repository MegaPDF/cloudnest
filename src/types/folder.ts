import { ObjectId } from "mongoose";
import { DateRange } from "./common";
export interface Folder {
  id: ObjectId;
  name: string;
  description?: string;
  owner: ObjectId;
  parent?: ObjectId;
  path: string;
  color?: string;
  isShared: boolean;
  isPublic: boolean;
  children?: Folder[];
  files?: File[];
  depth: number;
  itemCount: number;
  totalSize: number;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface FolderTree {
  id: ObjectId;
  name: string;
  path: string;
  children: FolderTree[];
  expanded: boolean;
  hasChildren: boolean;
}

export interface FolderBreadcrumb {
  id: ObjectId;
  name: string;
  path: string;
}

export interface FolderStats {
  totalFolders: number;
  totalFiles: number;
  totalSize: number;
  depth: number;
}

export interface FolderCreate {
  name: string;
  description?: string;
  parentId?: ObjectId;
  color?: string;
}

export interface FolderUpdate {
  name?: string;
  description?: string;
  color?: string;
}

export interface FolderMove {
  folderId: ObjectId;
  targetParentId?: ObjectId;
}

export interface FolderCopy {
  folderId: ObjectId;
  targetParentId?: ObjectId;
  name?: string;
  includeFiles: boolean;
}

export interface FolderFilter {
  name?: string;
  owner?: ObjectId;
  parent?: ObjectId;
  hasFiles?: boolean;
  isShared?: boolean;
  dateRange?: DateRange;
}

export interface FolderPermissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canShare: boolean;
  canManage: boolean;
}

export interface FolderActivity {
  id: ObjectId;
  folderId: ObjectId;
  userId: ObjectId;
  action: 'created' | 'renamed' | 'moved' | 'deleted' | 'restored' | 'shared';
  oldValue?: string;
  newValue?: string;
  timestamp: Date;
}
