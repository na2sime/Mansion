import dotenv from 'dotenv';
import { ServiceBase } from '@mansion/common';
import { createAuthRoutes } from './routes/authRoutes';

dotenv.config();

class AuthService extends ServiceBase {
  constructor() {
    super({
      serviceName: 'auth-service',
      port: parseInt(process.env.PORT || '3001'),
      useDatabase: true,
      useRedis: true,
      useRabbitMQ: false,
    });
  }

  protected setupRoutes(): void {
    // Mount auth routes with injected dependencies
    const authRoutes = createAuthRoutes(this.db!, this.redis!, this.jwtService!);
    this.app.use('/api/auth', authRoutes);
  }

  protected async onReady(): Promise<void> {
    this.logger.info('Auth Service is ready to handle requests');
  }
}

// Start the service
const authService = new AuthService();
authService.start();
