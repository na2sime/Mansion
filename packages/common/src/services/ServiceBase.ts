import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { DatabaseConnection } from '../config/database';
import { RedisConnection } from '../config/redis';
import { RabbitMQConnection } from '../config/rabbitmq';
import { JWTService } from '../utils/jwt';
import { Logger } from '../utils/logger';
import { errorHandler } from '../middleware/errorHandler';

export interface ServiceConfig {
  serviceName: string;
  port: number;
  useDatabase?: boolean;
  useRedis?: boolean;
  useRabbitMQ?: boolean;
}

export abstract class ServiceBase {
  protected app: Application;
  protected config: ServiceConfig;
  protected logger: Logger;
  protected db?: DatabaseConnection;
  protected redis?: RedisConnection;
  protected rabbitmq?: RabbitMQConnection;
  protected jwtService?: JWTService;

  constructor(config: ServiceConfig) {
    this.config = config;
    this.app = express();
    this.logger = new Logger({ serviceName: config.serviceName });
    this.jwtService = new JWTService();

    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(morgan('dev'));
    this.app.use(express.json());

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: this.config.serviceName,
        timestamp: new Date().toISOString(),
      });
    });
  }

  protected async initializeConnections(): Promise<void> {
    // Initialize database
    if (this.config.useDatabase) {
      this.db = new DatabaseConnection();
      await this.db.testConnection();
    }

    // Initialize Redis
    if (this.config.useRedis) {
      this.redis = new RedisConnection();
      await this.redis.connect();
    }

    // Initialize RabbitMQ
    if (this.config.useRabbitMQ) {
      this.rabbitmq = new RabbitMQConnection();
      await this.rabbitmq.connect();
    }
  }

  protected setupErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });

    // Global error handler
    this.app.use(errorHandler(this.logger));
  }

  protected async closeConnections(): Promise<void> {
    if (this.db) await this.db.close();
    if (this.redis) await this.redis.disconnect();
    if (this.rabbitmq) await this.rabbitmq.close();
  }

  protected setupGracefulShutdown(): void {
    const shutdown = async () => {
      this.logger.info('Shutting down gracefully...');
      await this.closeConnections();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  // Abstract methods to be implemented by services
  protected abstract setupRoutes(): void;
  protected abstract onReady?(): Promise<void>;

  public async start(): Promise<void> {
    try {
      // Initialize connections
      await this.initializeConnections();

      // Setup routes
      this.setupRoutes();

      // Setup error handling
      this.setupErrorHandling();

      // Call onReady hook if exists
      if (this.onReady) {
        await this.onReady();
      }

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      // Start server
      this.app.listen(this.config.port, () => {
        this.logger.info(`${this.config.serviceName} running on port ${this.config.port}`);
      });
    } catch (error) {
      this.logger.error('Failed to start service:', error);
      process.exit(1);
    }
  }
}
