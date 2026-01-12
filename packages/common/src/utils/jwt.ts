import jwt from 'jsonwebtoken';

export interface JWTConfig {
  secret?: string;
  refreshSecret?: string;
  expiresIn?: string;
  refreshExpiresIn?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export class JWTService {
  private secret: string;
  private refreshSecret: string;
  private expiresIn: string;
  private refreshExpiresIn: string;

  constructor(config?: JWTConfig) {
    this.secret = config?.secret || process.env.JWT_SECRET || 'change_this_secret';
    this.refreshSecret = config?.refreshSecret || process.env.JWT_REFRESH_SECRET || 'change_this_refresh_secret';
    this.expiresIn = config?.expiresIn || process.env.JWT_EXPIRES_IN || '15m';
    this.refreshExpiresIn = config?.refreshExpiresIn || process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  }

  generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn } as any);
  }

  generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.refreshSecret, { expiresIn: this.refreshExpiresIn } as any);
  }

  verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.secret) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  verifyRefreshToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.refreshSecret) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  getTokenExpiration(expiresIn: string = this.refreshExpiresIn): Date {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return new Date(Date.now() + 15 * 60 * 1000);

    const value = parseInt(match[1]);
    const unit = match[2];

    let milliseconds = 0;
    switch (unit) {
      case 's':
        milliseconds = value * 1000;
        break;
      case 'm':
        milliseconds = value * 60 * 1000;
        break;
      case 'h':
        milliseconds = value * 60 * 60 * 1000;
        break;
      case 'd':
        milliseconds = value * 24 * 60 * 60 * 1000;
        break;
    }

    return new Date(Date.now() + milliseconds);
  }
}
