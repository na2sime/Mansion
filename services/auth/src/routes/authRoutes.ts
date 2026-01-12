import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { AuthService } from '../services/authService';
import {
  AuthMiddleware,
  DatabaseConnection,
  RedisConnection,
  JWTService,
  validateRequest,
} from '@mansion/common';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  verify2FASchema,
} from '../schemas/validation';

export function createAuthRoutes(
  db: DatabaseConnection,
  redis: RedisConnection,
  jwtService: JWTService
): Router {
  const router = Router();

  // Initialize services and middleware
  const authService = new AuthService(db, redis, jwtService);
  const authController = new AuthController(authService);
  const authMiddleware = new AuthMiddleware(jwtService);

  // Public routes
  router.post('/register', validateRequest(registerSchema), authController.register.bind(authController));
  router.post('/login', validateRequest(loginSchema), authController.login.bind(authController));
  router.post('/refresh', validateRequest(refreshTokenSchema), authController.refresh.bind(authController));

  // Protected routes
  router.post('/logout', authMiddleware.authenticate, authController.logout.bind(authController));
  router.get('/me', authMiddleware.authenticate, authController.getMe.bind(authController));

  // 2FA routes
  router.post('/2fa/setup', authMiddleware.authenticate, authController.setup2FA.bind(authController));
  router.post('/2fa/verify', authMiddleware.authenticate, validateRequest(verify2FASchema), authController.verify2FA.bind(authController));
  router.post('/2fa/disable', authMiddleware.authenticate, validateRequest(verify2FASchema), authController.disable2FA.bind(authController));

  return router;
}
