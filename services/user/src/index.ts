import dotenv from 'dotenv';
import { ServiceBase } from '@mansion/common';
import { createUserRoutes } from './routes/userRoutes';

dotenv.config();

class UserService extends ServiceBase {
  constructor() {
    super({
      serviceName: 'user-service',
      port: parseInt(process.env.PORT || '3002'),
      useDatabase: true,
      useRedis: true,
      useRabbitMQ: true,
    });
  }

  protected async setupRoutes(): Promise<void> {
    // Setup RabbitMQ exchanges and queues
    await this.rabbitmq!.assertExchange('user_events', 'topic', { durable: true });
    await this.rabbitmq!.assertQueue('contact_requests', { durable: true });
    await this.rabbitmq!.assertQueue('contact_updates', { durable: true });

    // Mount user routes with injected dependencies
    const userRoutes = createUserRoutes(this.db!, this.redis!, this.rabbitmq!, this.jwtService!);
    this.app.use('/api/users', userRoutes);
  }

  protected async onReady(): Promise<void> {
    this.logger.info('User Service is ready to handle requests');
  }
}

// Start the service
const userService = new UserService();
userService.start();
