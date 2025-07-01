import { ObjectId } from "mongoose";
import { DateRange } from "./common";

export interface File {
  id: ObjectId;
  name: string;
  originalName: string;
  description?: string;
  mimeType: string;
  size: number;
  extension: string;
  category: FileCategory;
  storageProvider: StorageProvider;
  storageKey: string;
  hash: string;
  owner: ObjectId;
  folder?: ObjectId;
  isPublic: boolean;
  versions: FileVersion[];
  currentVersion: number;
  tags: string[];
  metadata: FileMetadata;
  access: FileAccess;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type FileCategory = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'archive' | 'other';

export type StorageProvider = 'aws' | 'cloudflare' | 'wasabi' | 'gridfs';

export interface FileVersion {
  version: number;
  size: number;
  storageKey: string;
  uploadedAt: Date;
  uploadedBy: ObjectId;
  changes?: string;
}

export interface FileMetadata {
  // Image metadata
  width?: number;
  height?: number;
  format?: string;
  colorSpace?: string;
  hasAlpha?: boolean;
  
  // Video metadata
  duration?: number;
  bitrate?: number;
  framerate?: number;
  codec?: string;
  resolution?: string;
  
  // Audio metadata
  artist?: string;
  album?: string;
  title?: string;
  genre?: string;
  year?: number;
  
  // Document metadata
  pageCount?: number;
  wordCount?: number;
  author?: string;
  
  // General metadata
  encoding?: string;
  language?: string;
  [key: string]: any;
}

export interface FileAccess {
  views: number;
  downloads: number;
  lastAccessedAt?: Date;
  uniqueViewers: number;
}

export interface FileUpload {
  file: File;
  name: string;
  size: number;
  type: string;
  folderId?: ObjectId;
  tags?: string[];
  description?: string;
}

export interface FileUploadResult {
  id: ObjectId;
  name: string;
  size: number;
  url: string;
  thumbnail?: string;
}

export interface FileBatch {
  files: FileUpload[];
  folderId?: ObjectId;
  overwrite: boolean;
}

export interface FileFilter {
  category?: FileCategory;
  mimeType?: string;
  sizeMin?: number;
  sizeMax?: number;
  dateRange?: DateRange;
  tags?: string[];
  owner?: ObjectId;
  folder?: ObjectId;
}

export interface FileSort {
  field: 'name' | 'size' | 'createdAt' | 'updatedAt' | 'lastAccessedAt';
  order: 'asc' | 'desc';
}

export interface FilePreview {
  id: ObjectId;
  type: 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'unsupported';
  url: string;
  thumbnail?: string;
  metadata: FileMetadata;
}

export interface FileCompression {
  enabled: boolean;
  algorithm: 'gzip' | 'brotli' | 'deflate';
  level: number;
  originalSize: number;
  compressedSize: number;
  ratio: number;
}

export interface FileEncryption {
  enabled: boolean;
  algorithm: 'aes-256-gcm' | 'aes-256-cbc';
  keyId: string;
  iv: string;
}