/**
 * Example: Simple Service using @mansion/common
 *
 * This demonstrates how to quickly create a microservice using the ServiceBase class
 */

import { ServiceBase, AuthMiddleware, JWTService, validateRequest, AppError, asyncHandler } from '@mansion/common';
import { Router } from 'express';
import Joi from 'joi';

class ExampleService extends ServiceBase {
  private jwtService: JWTService;
  private authMiddleware: AuthMiddleware;

  constructor() {
    super({
      serviceName: 'example-service',
      port: 3005,
      useDatabase: true,  // Enable PostgreSQL
      useRedis: true,     // Enable Redis
      useRabbitMQ: true,  // Enable RabbitMQ
    });

    // Initialize JWT service
    this.jwtService = new JWTService();
    this.authMiddleware = new AuthMiddleware(this.jwtService);
  }

  protected setupRoutes(): void {
    const router = Router();

    // Public route
    router.get('/public', (req, res) => {
      res.json({ message: 'This is a public endpoint' });
    });

    // Protected route with JWT authentication
    router.get('/protected', this.authMiddleware.authenticate, (req, res) => {
      res.json({
        message: 'This is a protected endpoint',
        user: req.user,
      });
    });

    // Route with validation
    const createSchema = Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().required(),
    });

    router.post(
      '/create',
      validateRequest(createSchema),
      asyncHandler(async (req, res) => {
        const { name, email } = req.body;

        // Use database
        const result = await this.db!.query(
          'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
          [name, email]
        );

        // Use Redis cache
        await this.redis!.set(`user:${result.rows[0].id}`, JSON.stringify(result.rows[0]), 3600);

        // Publish event to RabbitMQ
        await this.rabbitmq!.publishToQueue('user_created', {
          userId: result.rows[0].id,
          name,
          email,
        });

        res.status(201).json(result.rows[0]);
      })
    );

    // Route with custom error
    router.get('/error', () => {
      throw new AppError('This is a custom error', 400);
    });

    // Mount router
    this.app.use('/api/example', router);
  }

  protected async onReady(): Promise<void> {
    this.logger.info('Example service is ready!');

    // Setup RabbitMQ consumers
    await this.rabbitmq!.assertQueue('user_created');
    await this.rabbitmq!.consume('user_created', async (message) => {
      this.logger.info('Received user_created event', message);
    });
  }
}

// Start the service
const service = new ExampleService();
service.start();
