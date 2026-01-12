import bcrypt from 'bcrypt';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { DatabaseConnection, RedisConnection, JWTService } from '@mansion/common';

const SALT_ROUNDS = 12;
const TWO_FA_ISSUER = process.env.TWO_FA_ISSUER || 'Mansion';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  is2faEnabled: boolean;
  twoFaSecret?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

export class AuthService {
  constructor(
    private db: DatabaseConnection,
    private redis: RedisConnection,
    private jwtService: JWTService
  ) {}

  async register(email: string, password: string): Promise<{ userId: string; message: string }> {
    // Check if user already exists
    const existingUser = await this.db.query('SELECT id FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      throw new Error('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const result = await this.db.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
      [email, passwordHash]
    );

    const userId = result.rows[0].id;

    return { userId, message: 'User registered successfully' };
  }

  async login(
    email: string,
    password: string,
    twoFactorCode?: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: string; userId: string }> {
    // Get user
    const result = await this.db.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user: User = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Check 2FA if enabled
    if (user.is2faEnabled) {
      if (!twoFactorCode) {
        throw new Error('2FA code required');
      }

      const isValid = speakeasy.totp.verify({
        secret: user.twoFaSecret!,
        encoding: 'base32',
        token: twoFactorCode,
        window: 2,
      });

      if (!isValid) {
        throw new Error('Invalid 2FA code');
      }
    }

    // Update last login
    await this.db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Generate tokens
    const accessToken = this.jwtService.generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = this.jwtService.generateRefreshToken({ userId: user.id, email: user.email });

    // Store refresh token
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = this.jwtService.getTokenExpiration(process.env.JWT_REFRESH_EXPIRES_IN || '7d');

    await this.db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    // Store user session in Redis for quick lookup
    await this.redis.set(`session:${user.id}`, JSON.stringify({ email: user.email }), 3600);

    return {
      accessToken,
      refreshToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      userId: user.id,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: string }> {
    // Verify refresh token
    let payload;
    try {
      payload = this.jwtService.verifyRefreshToken(refreshToken);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }

    // Check if token exists in database and is not revoked
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const result = await this.db.query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked = false AND expires_at > NOW()',
      [tokenHash]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid refresh token');
    }

    // Generate new access token
    const accessToken = this.jwtService.generateAccessToken({ userId: payload.userId, email: payload.email });

    return {
      accessToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    };
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    // Revoke refresh token
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.db.query('UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1', [tokenHash]);

    // Remove session from Redis
    await this.redis.del(`session:${userId}`);
  }

  async setup2FA(userId: string): Promise<{ secret: string; qrCode: string }> {
    // Get user email
    const result = await this.db.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const email = result.rows[0].email;

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `${TWO_FA_ISSUER} (${email})`,
      issuer: TWO_FA_ISSUER,
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    // Store secret temporarily in Redis (not enabled yet)
    await this.redis.set(`2fa:setup:${userId}`, secret.base32, 600);

    return {
      secret: secret.base32,
      qrCode,
    };
  }

  async verify2FA(userId: string, code: string): Promise<void> {
    // Get temporary secret from Redis
    const secret = await this.redis.get(`2fa:setup:${userId}`);
    if (!secret) {
      throw new Error('2FA setup not initiated or expired');
    }

    // Verify code
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!isValid) {
      throw new Error('Invalid 2FA code');
    }

    // Enable 2FA and save secret
    await this.db.query('UPDATE users SET is_2fa_enabled = true, two_fa_secret = $1 WHERE id = $2', [
      secret,
      userId,
    ]);

    // Remove temporary secret
    await this.redis.del(`2fa:setup:${userId}`);
  }

  async disable2FA(userId: string, code: string): Promise<void> {
    // Get user
    const result = await this.db.query('SELECT two_fa_secret FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const secret = result.rows[0].two_fa_secret;
    if (!secret) {
      throw new Error('2FA is not enabled');
    }

    // Verify code
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!isValid) {
      throw new Error('Invalid 2FA code');
    }

    // Disable 2FA
    await this.db.query('UPDATE users SET is_2fa_enabled = false, two_fa_secret = NULL WHERE id = $1', [
      userId,
    ]);
  }

  async getUserById(userId: string): Promise<Omit<User, 'passwordHash' | 'twoFaSecret'> | null> {
    const result = await this.db.query('SELECT id, email, is_2fa_enabled, created_at, updated_at, last_login FROM users WHERE id = $1', [
      userId,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }
}
