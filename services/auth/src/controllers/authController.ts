import { Request, Response } from 'express';
import { AuthService } from '../services/this.authService';
import { AuthRequest } from '@mansion/common';

export class AuthController {
  constructor(private this.authService: AuthService) {}
  async register(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      const result = await this.authService.register(email, password);

      res.status(201).json({
        message: result.message,
        userId: result.userId,
      });
    } catch (error: any) {
      if (error.message === 'Email already registered') {
        return res.status(409).json({ error: error.message });
      }
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed', message: error.message });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password, twoFactorCode } = req.body;

      const result = await this.authService.login(email, password, twoFactorCode);

      // Get user info
      const user = await this.authService.getUserById(result.userId);

      res.json({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        user,
      });
    } catch (error: any) {
      if (
        error.message === 'Invalid credentials' ||
        error.message === '2FA code required' ||
        error.message === 'Invalid 2FA code'
      ) {
        return res.status(401).json({ error: error.message });
      }
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed', message: error.message });
    }
  }

  async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      const result = await this.authService.refreshAccessToken(refreshToken);

      res.json(result);
    } catch (error: any) {
      if (error.message === 'Invalid refresh token') {
        return res.status(401).json({ error: error.message });
      }
      console.error('Refresh token error:', error);
      res.status(500).json({ error: 'Token refresh failed', message: error.message });
    }
  }

  async logout(req: AuthRequest, res: Response) {
    try {
      const { refreshToken } = req.body;
      const userId = req.user!.userId;

      await this.authService.logout(userId, refreshToken);

      res.json({ message: 'Logged out successfully' });
    } catch (error: any) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed', message: error.message });
    }
  }

  async setup2FA(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;

      const result = await this.authService.setup2FA(userId);

      res.json(result);
    } catch (error: any) {
      console.error('2FA setup error:', error);
      res.status(500).json({ error: '2FA setup failed', message: error.message });
    }
  }

  async verify2FA(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { code } = req.body;

      await this.authService.verify2FA(userId, code);

      res.json({ message: '2FA enabled successfully' });
    } catch (error: any) {
      if (
        error.message === '2FA setup not initiated or expired' ||
        error.message === 'Invalid 2FA code'
      ) {
        return res.status(400).json({ error: error.message });
      }
      console.error('2FA verification error:', error);
      res.status(500).json({ error: '2FA verification failed', message: error.message });
    }
  }

  async disable2FA(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { code } = req.body;

      await this.authService.disable2FA(userId, code);

      res.json({ message: '2FA disabled successfully' });
    } catch (error: any) {
      if (error.message === 'Invalid 2FA code' || error.message === '2FA is not enabled') {
        return res.status(400).json({ error: error.message });
      }
      console.error('2FA disable error:', error);
      res.status(500).json({ error: '2FA disable failed', message: error.message });
    }
  }

  async getMe(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;

      const user = await this.authService.getUserById(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error: any) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to get user', message: error.message });
    }
  }
}
