import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { UserService } from '../services/userService';
import {
  AuthMiddleware,
  DatabaseConnection,
  RedisConnection,
  RabbitMQConnection,
  JWTService,
  validateRequest,
} from '@mansion/common';
import {
  createProfileSchema,
  updateTagSchema,
  updatePublicKeySchema,
  sendContactRequestSchema,
  respondContactRequestSchema,
} from '../middleware/validation';

export function createUserRoutes(
  db: DatabaseConnection,
  redis: RedisConnection,
  rabbitmq: RabbitMQConnection,
  jwtService: JWTService
): Router {
  const router = Router();

  // Initialize services and middleware
  const userService = new UserService(db, redis, rabbitmq);
  const userController = new UserController(userService);
  const authMiddleware = new AuthMiddleware(jwtService);

  // Profile management
  router.post('/profile', authMiddleware.authenticate, validateRequest(createProfileSchema), userController.createProfile.bind(userController));
  router.get('/me', authMiddleware.authenticate, userController.getMyProfile.bind(userController));
  router.put('/tag', authMiddleware.authenticate, validateRequest(updateTagSchema), userController.updateTag.bind(userController));
  router.put('/public-key', authMiddleware.authenticate, validateRequest(updatePublicKeySchema), userController.updatePublicKey.bind(userController));

  // User search
  router.get('/search', authMiddleware.authenticate, userController.searchUser.bind(userController));

  // Contact management
  router.get('/contacts', authMiddleware.authenticate, userController.getContacts.bind(userController));
  router.post('/contacts', authMiddleware.authenticate, validateRequest(sendContactRequestSchema), userController.sendContactRequest.bind(userController));
  router.delete('/contacts/:contactId', authMiddleware.authenticate, userController.removeContact.bind(userController));

  // Contact requests
  router.get('/contacts/requests', authMiddleware.authenticate, userController.getPendingRequests.bind(userController));
  router.put('/contacts/requests/:requestId', authMiddleware.authenticate, validateRequest(respondContactRequestSchema), userController.respondToRequest.bind(userController));

  return router;
}
