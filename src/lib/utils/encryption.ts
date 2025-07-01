import crypto from 'crypto';

export class EncryptionUtils {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16;  // 128 bits
  private static readonly TAG_LENGTH = 16; // 128 bits

  /**
   * Generate encryption key from password
   */
  static generateKey(password: string, salt: string): Buffer {
    return crypto.pbkdf2Sync(password, salt, 10000, this.KEY_LENGTH, 'sha512');
  }

  /**
   * Generate random salt
   */
  static generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate random IV
   */
  static generateIV(): Buffer {
    return crypto.randomBytes(this.IV_LENGTH);
  }

  /**
   * Encrypt data
   */
  static encrypt(data: string | Buffer, password: string): {
    encrypted: string;
    salt: string;
    iv: string;
    tag: string;
  } {
    const salt = this.generateSalt();
    const key = this.generateKey(password, salt);
    const iv = this.generateIV();
    
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv, { authTagLength: this.TAG_LENGTH });
    
    let encrypted: Buffer;
    if (typeof data === 'string') {
      encrypted = Buffer.concat([
        cipher.update(data, 'utf8'),
        cipher.final()
      ]);
    } else {
      encrypted = Buffer.concat([
        cipher.update(data),
        cipher.final()
      ]);
    }
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted.toString('hex'),
      salt,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  /**
   * Decrypt data
   */
  static decrypt(
    encryptedData: string,
    password: string,
    salt: string,
    iv: string,
    tag: string
  ): string {
    const key = this.generateKey(password, salt);
    const decipher = crypto.createDecipheriv(
      this.ALGORITHM,
      key,
      Buffer.from(iv, 'hex'),
      { authTagLength: this.TAG_LENGTH }
    );

    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedData, 'hex')),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Hash file content for deduplication
   */
  static hashFile(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Generate secure random token
   */
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash password for storage
   */
  static async hashPassword(password: string): Promise<string> {
    const bcrypt = await import('bcryptjs');
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }

  /**
   * Verify password against hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT-safe random string
   */
  static generateJWTSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Create HMAC signature
   */
  static createSignature(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  static verifySignature(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.createSignature(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }
}