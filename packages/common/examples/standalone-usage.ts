/**
 * Example: Standalone usage without ServiceBase
 *
 * This shows how to use individual components from @mansion/common
 */

import express from 'express';
import {
  DatabaseConnection,
  RedisConnection,
  RabbitMQConnection,
  JWTService,
  Logger,
  LogLevel,
  AuthMiddleware,
  validateRequest,
  errorHandler,
} from '@mansion/common';
import Joi from 'joi';

const app = express();
app.use(express.json());

// Setup logger
const logger = new Logger({
  serviceName: 'standalone-service',
  level: LogLevel.INFO,
});

// Initialize connections
const db = new DatabaseConnection();
const redis = new RedisConnection();
const rabbitmq = new RabbitMQConnection();

// Initialize JWT service
const jwtService = new JWTService({
  secret: 'my_secret',
  expiresIn: '1h',
});

// Initialize auth middleware
const authMiddleware = new AuthMiddleware(jwtService);

// Routes
app.post('/login', validateRequest(Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
})), async (req, res) => {
  const { email, password } = req.body;

  // Your authentication logic here
  const user = { userId: '123', email };

  const token = jwtService.generateAccessToken(user);
  const refreshToken = jwtService.generateRefreshToken(user);

  res.json({ token, refreshToken });
});

app.get('/profile', authMiddleware.authenticate, async (req, res) => {
  const userId = req.user?.userId;

  // Check Redis cache first
  const cached = await redis.get(`user:${userId}`);
  if (cached) {
    logger.info('User found in cache', { userId });
    return res.json(JSON.parse(cached));
  }

  // Query database
  const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  const user = result.rows[0];

  // Cache the result
  await redis.set(`user:${userId}`, JSON.stringify(user), 3600);

  res.json(user);
});

// Error handler
app.use(errorHandler(logger));

// Start server
async function start() {
  try {
    await db.testConnection();
    await redis.connect();
    await rabbitmq.connect();

    app.listen(3005, () => {
      logger.info('Standalone service running on port 3005');
    });
  } catch (error) {
    logger.error('Failed to start:', error);
    process.exit(1);
  }
}

start();
