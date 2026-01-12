// Configuration
export { DatabaseConnection } from './config/database';
export type { DatabaseConfig } from './config/database';

export { RedisConnection } from './config/redis';
export type { RedisConfig } from './config/redis';

export { RabbitMQConnection } from './config/rabbitmq';
export type { RabbitMQConfig } from './config/rabbitmq';

// Utilities
export { JWTService } from './utils/jwt';
export type { JWTConfig, JWTPayload } from './utils/jwt';

export { Logger, LogLevel } from './utils/logger';
export type { LoggerConfig } from './utils/logger';

// Middleware
export { AuthMiddleware } from './middleware/auth';
export type { AuthRequest } from './middleware/auth';

export { validateRequest, validateQuery, validateParams } from './middleware/validation';

export { errorHandler, asyncHandler, AppError } from './middleware/errorHandler';

// Services
export { ServiceBase } from './services/ServiceBase';
export type { ServiceConfig } from './services/ServiceBase';

// Types
export type {
  User,
  UserProfile,
  UserTag,
  EncryptedMessage,
  MessageDeliveryStatus,
  UserPresence,
  TypingIndicator,
  Contact,
  ContactRequest,
  DeviceToken,
  Notification,
  UserEvent,
  ApiResponse,
  PaginatedResponse,
} from './types';
