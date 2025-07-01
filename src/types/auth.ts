import { ObjectId } from "mongoose";
import { User } from "./user";

export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: Date;
}

export interface AuthProvider {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
}

export interface OAuth2Provider extends AuthProvider {
  clientId: string;
  redirectUri: string;
  scope: string[];
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface TwoFactorVerification {
  code: string;
  backupCode?: string;
}

export interface SessionInfo {
  id: string;
  userId: ObjectId;
  device: string;
  browser: string;
  ip: string;
  location?: string;
  current: boolean;
  lastActive: Date;
  createdAt: Date;
}

export interface LoginAttempt {
  email: string;
  ip: string;
  userAgent: string;
  success: boolean;
  timestamp: Date;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: number;
  allowedIps: string[];
  blockedIps: string[];
}
