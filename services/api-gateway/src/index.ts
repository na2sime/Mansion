import dotenv from 'dotenv';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ServiceBase } from '@mansion/common';

dotenv.config();

class APIGateway extends ServiceBase {
  constructor() {
    super({
      serviceName: 'api-gateway',
      port: parseInt(process.env.PORT || '3000'),
      useDatabase: false,
      useRedis: false,
      useRabbitMQ: false,
    });
  }

  protected setupRoutes(): void {
    // OpenAPI Documentation
    const swaggerDocument = YAML.load(path.join(__dirname, '../openapi.yaml'));
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

    // Service URLs
    const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
    const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3002';
    const MESSAGE_SERVICE_URL = process.env.MESSAGE_SERVICE_URL || 'http://localhost:3003';
    const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004';

    // Proxy configurations
    const proxyOptions = {
      changeOrigin: true,
      onError: (err: Error, _req: any, res: any) => {
        this.logger.error('Proxy error:', err);
        res.status(503).json({ error: 'Service unavailable', message: err.message });
      },
    };

    // Route proxies
    this.app.use('/api/auth', createProxyMiddleware({ target: AUTH_SERVICE_URL, ...proxyOptions }));
    this.app.use('/api/users', createProxyMiddleware({ target: USER_SERVICE_URL, ...proxyOptions }));
    this.app.use('/api/messages', createProxyMiddleware({ target: MESSAGE_SERVICE_URL, ...proxyOptions }));
    this.app.use('/api/notifications', createProxyMiddleware({ target: NOTIFICATION_SERVICE_URL, ...proxyOptions }));

    // Root endpoint
    this.app.get('/', (_req, res) => {
      res.json({
        service: 'Mansion API Gateway',
        version: '1.0.0',
        documentation: '/api-docs',
        health: '/health',
      });
    });
  }

  protected async onReady(): Promise<void> {
    this.logger.info('API Gateway is ready to proxy requests');
    this.logger.info(`API Documentation available at http://localhost:${this.config.port}/api-docs`);
  }
}

// Start the service
const gateway = new APIGateway();
gateway.start();
