// src/lib/services/email.ts
import { connectToDatabase } from '@/lib/database/connection';
import { EmailConfig } from '@/lib/database/models';
import { env } from '@/lib/config/env';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailSendOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export class EmailService {
  private static transporter: Transporter | null = null;

  /**
   * Initialize email transporter using existing EmailConfig model
   */
  private static async getTransporter(): Promise<Transporter> {
    if (this.transporter) {
      return this.transporter;
    }

    try {
      await connectToDatabase();

      // Get default email configuration from your EmailConfig model
      const emailConfig = await EmailConfig.getDefaultProvider();

      if (!emailConfig) {
        // Fallback to environment variables if no database config
        this.transporter = nodemailer.createTransporter({
          host: env.SMTP_HOST || 'localhost',
          port: parseInt(env.SMTP_PORT || '587'),
          secure: env.SMTP_SECURE === 'true',
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS
          }
        });
      } else {
        // Use database configuration - convert to nodemailer config
        const transportConfig = this.buildTransportConfig(emailConfig);
        this.transporter = nodemailer.createTransporter(transportConfig);
      }

      // Verify transporter
      await this.transporter.verify();
      
      return this.transporter;
    } catch (error) {
      console.error('Failed to initialize email transporter:', error);
      throw new Error('Email service initialization failed');
    }
  }

  /**
   * Build transport config from your EmailConfig model
   */
  private static buildTransportConfig(emailConfig: any): any {
    const { provider, config } = emailConfig;

    switch (provider) {
      case 'smtp':
        return {
          host: config.host,
          port: config.port,
          secure: config.secure || false,
          auth: {
            user: config.username,
            pass: config.password
          }
        };

      case 'sendgrid':
        return {
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: config.apiKey
          }
        };

      case 'mailgun':
        return {
          service: 'Mailgun',
          auth: {
            user: `api`,
            pass: config.apiKey
          }
        };

      case 'ses':
        return {
          service: 'SES',
          auth: {
            user: config.accessKeyId,
            pass: config.secretAccessKey
          },
          region: config.region
        };

      default:
        throw new Error(`Unsupported email provider: ${provider}`);
    }
  }

  /**
   * Send email using your existing patterns
   */
  static async sendEmail(options: EmailSendOptions): Promise<void> {
    try {
      const transporter = await this.getTransporter();

      const mailOptions = {
        from: options.from || env.SMTP_FROM || 'noreply@cloudnest.com',
        to: Array.isArray(options.to) ? options.to.join(',') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        attachments: options.attachments
      };

      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error('Failed to send email');
    }
  }

  /**
   * Send verification email using your User model patterns
   */
  static async sendVerificationEmail(
    email: string,
    name: string,
    verificationToken: string
  ): Promise<void> {
    const verificationUrl = `${env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=${verificationToken}`;
    
    const template = this.getVerificationEmailTemplate(name, verificationUrl);

    await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
  }

  /**
   * Send password reset email using your User model patterns
   */
  static async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string
  ): Promise<void> {
    const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;
    
    const template = this.getPasswordResetEmailTemplate(name, resetUrl);

    await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
  }

  /**
   * Send password reset confirmation email
   */
  static async sendPasswordResetConfirmationEmail(
    email: string,
    name: string
  ): Promise<void> {
    const template = this.getPasswordResetConfirmationTemplate(name);

    await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
  }

  /**
   * Send welcome email following your patterns
   */
  static async sendWelcomeEmail(
    email: string,
    name: string
  ): Promise<void> {
    const template = this.getWelcomeEmailTemplate(name);

    await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text
    });
  }

  /**
   * Email templates following your design patterns
   */
  private static getVerificationEmailTemplate(name: string, verificationUrl: string): EmailTemplate {
    return {
      subject: 'Verify your CloudNest account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify your CloudNest account</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">CloudNest</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0; font-size: 16px;">Secure Cloud Storage</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1F2937; margin: 0 0 16px; font-size: 24px; font-weight: 600;">Welcome to CloudNest, ${name}!</h2>
              
              <p style="color: #6B7280; line-height: 1.6; margin-bottom: 24px; font-size: 16px;">
                Thank you for signing up for CloudNest. To complete your registration and start using our secure cloud storage service, please verify your email address by clicking the button below.
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${verificationUrl}" style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                  Verify Email Address
                </a>
              </div>
              
              <p style="color: #9CA3AF; line-height: 1.6; margin-bottom: 20px; font-size: 14px;">
                If the button doesn't work, you can also copy and paste this link into your browser:
              </p>
              
              <p style="color: #3B82F6; word-break: break-all; margin-bottom: 32px; font-size: 14px; background: #F3F4F6; padding: 12px; border-radius: 6px;">
                ${verificationUrl}
              </p>
              
              <p style="color: #9CA3AF; line-height: 1.6; margin-bottom: 0; font-size: 14px;">
                If you didn't create a CloudNest account, you can safely ignore this email.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #F9FAFB; padding: 24px 30px; border-top: 1px solid #E5E7EB;">
              <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin: 0;">
                This email was sent by CloudNest. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Welcome to CloudNest, ${name}!

Thank you for signing up for CloudNest. To complete your registration and start using our secure cloud storage service, please verify your email address by visiting:

${verificationUrl}

If you didn't create a CloudNest account, you can safely ignore this email.

--
CloudNest Team
      `
    };
  }

  private static getPasswordResetEmailTemplate(name: string, resetUrl: string): EmailTemplate {
    return {
      subject: 'Reset your CloudNest password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset your CloudNest password</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">CloudNest</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0; font-size: 16px;">Password Reset</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1F2937; margin: 0 0 16px; font-size: 24px; font-weight: 600;">Reset your password</h2>
              
              <p style="color: #6B7280; line-height: 1.6; margin-bottom: 8px; font-size: 16px;">
                Hi ${name},
              </p>
              
              <p style="color: #6B7280; line-height: 1.6; margin-bottom: 24px; font-size: 16px;">
                We received a request to reset your CloudNest account password. Click the button below to create a new password:
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}" style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);">
                  Reset Password
                </a>
              </div>
              
              <p style="color: #9CA3AF; line-height: 1.6; margin-bottom: 20px; font-size: 14px;">
                If the button doesn't work, you can also copy and paste this link into your browser:
              </p>
              
              <p style="color: #3B82F6; word-break: break-all; margin-bottom: 24px; font-size: 14px; background: #F3F4F6; padding: 12px; border-radius: 6px;">
                ${resetUrl}
              </p>
              
              <div style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #92400E; margin: 0; font-size: 14px; font-weight: 500;">
                  ⚠️ This link will expire in 10 minutes for security reasons.
                </p>
              </div>
              
              <p style="color: #9CA3AF; line-height: 1.6; margin-bottom: 0; font-size: 14px;">
                If you didn't request a password reset, you can safely ignore this email.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #F9FAFB; padding: 24px 30px; border-top: 1px solid #E5E7EB;">
              <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin: 0;">
                This email was sent by CloudNest. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Reset your CloudNest password

Hi ${name},

We received a request to reset your CloudNest account password. Visit this link to create a new password:

${resetUrl}

This link will expire in 10 minutes for security reasons.

If you didn't request a password reset, you can safely ignore this email.

--
CloudNest Team
      `
    };
  }

  private static getPasswordResetConfirmationTemplate(name: string): EmailTemplate {
    return {
      subject: 'Your CloudNest password has been reset',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password reset confirmation</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">CloudNest</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0; font-size: 16px;">Password Reset Successful</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1F2937; margin: 0 0 16px; font-size: 24px; font-weight: 600;">Password successfully reset</h2>
              
              <p style="color: #6B7280; line-height: 1.6; margin-bottom: 8px; font-size: 16px;">
                Hi ${name},
              </p>
              
              <p style="color: #6B7280; line-height: 1.6; margin-bottom: 24px; font-size: 16px;">
                This email confirms that your CloudNest account password has been successfully reset.
              </p>
              
              <p style="color: #6B7280; line-height: 1.6; margin-bottom: 32px; font-size: 16px;">
                You can now log in to your account using your new password.
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${env.NEXT_PUBLIC_APP_URL}/login" style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                  Log In to CloudNest
                </a>
              </div>
              
              <div style="background: #FEE2E2; border: 1px solid #F87171; border-radius: 6px; padding: 16px;">
                <p style="color: #DC2626; margin: 0; font-size: 14px; font-weight: 500;">
                  🚨 If you didn't reset your password, please contact our support team immediately.
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background: #F9FAFB; padding: 24px 30px; border-top: 1px solid #E5E7EB;">
              <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin: 0;">
                This email was sent by CloudNest. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Password successfully reset

Hi ${name},

This email confirms that your CloudNest account password has been successfully reset.

You can now log in to your account using your new password at:
${env.NEXT_PUBLIC_APP_URL}/login

If you didn't reset your password, please contact our support team immediately.

--
CloudNest Team
      `
    };
  }

  private static getWelcomeEmailTemplate(name: string): EmailTemplate {
    return {
      subject: 'Welcome to CloudNest! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to CloudNest!</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">CloudNest</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0; font-size: 16px;">Welcome Aboard! 🎉</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1F2937; margin: 0 0 16px; font-size: 24px; font-weight: 600;">Welcome to CloudNest, ${name}! 🎉</h2>
              
              <p style="color: #6B7280; line-height: 1.6; margin-bottom: 24px; font-size: 16px;">
                Your email has been verified and your CloudNest account is now active! We're excited to have you join our community.
              </p>
              
              <p style="color: #6B7280; line-height: 1.6; margin-bottom: 16px; font-size: 16px;">
                With CloudNest, you can:
              </p>
              
              <!-- Features List -->
              <div style="margin: 24px 0;">
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                  <span style="color: #10B981; font-size: 16px; margin-right: 8px;">✓</span>
                  <span style="color: #4B5563; font-size: 15px;">Securely store and organize your files</span>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                  <span style="color: #10B981; font-size: 16px; margin-right: 8px;">✓</span>
                  <span style="color: #4B5563; font-size: 15px;">Share files and folders with ease</span>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                  <span style="color: #10B981; font-size: 16px; margin-right: 8px;">✓</span>
                  <span style="color: #4B5563; font-size: 15px;">Access your data from anywhere</span>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                  <span style="color: #10B981; font-size: 16px; margin-right: 8px;">✓</span>
                  <span style="color: #4B5563; font-size: 15px;">Collaborate with team members</span>
                </div>
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                  <span style="color: #10B981; font-size: 16px; margin-right: 8px;">✓</span>
                  <span style="color: #4B5563; font-size: 15px;">Keep your files synchronized across devices</span>
                </div>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${env.NEXT_PUBLIC_APP_URL}/dashboard" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
                  Start Using CloudNest
                </a>
              </div>
              
              <p style="color: #6B7280; line-height: 1.6; margin-bottom: 0; font-size: 16px;">
                If you have any questions or need help getting started, feel free to reach out to our support team.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #F9FAFB; padding: 24px 30px; border-top: 1px solid #E5E7EB;">
              <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin: 0;">
                This email was sent by CloudNest. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Welcome to CloudNest, ${name}!

Your email has been verified and your CloudNest account is now active! We're excited to have you join our community.

With CloudNest, you can:
- Securely store and organize your files
- Share files and folders with ease
- Access your data from anywhere
- Collaborate with team members
- Keep your files synchronized across devices

Get started at: ${env.NEXT_PUBLIC_APP_URL}/dashboard

If you have any questions or need help getting started, feel free to reach out to our support team.

--
CloudNest Team
      `
    };
  }
}