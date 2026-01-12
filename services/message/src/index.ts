import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { ServiceBase } from '@mansion/common';
import { MessageService } from './services/messageService';
import { PresenceService } from './services/presenceService';
import { MessageQueueService } from './services/messageQueueService';

dotenv.config();

class MessageServiceApp extends ServiceBase {
  private io?: Server;
  private messageService?: MessageService;

  constructor() {
    super({
      serviceName: 'message-service',
      port: parseInt(process.env.PORT || '3003'),
      useDatabase: false,
      useRedis: true,
      useRabbitMQ: true,
    });
  }

  protected async setupRoutes(): Promise<void> {
    // WebSocket info endpoint
    this.app.get('/api/messages/info', (_req, res) => {
      res.json({
        message: 'WebSocket messaging service',
        connectionUrl: `ws://localhost:${this.config.port}`,
        authentication: 'Provide JWT token in auth.token or query.token',
        events: {
          send: 'message:send',
          receive: 'message:receive',
          typing: 'typing:start / typing:stop',
          status: 'message:delivered / message:read',
        },
      });
    });
  }

  protected async onReady(): Promise<void> {
    this.logger.info('Message Service is ready to handle requests');
  }

  // Override start to add Socket.IO support
  public async start(): Promise<void> {
    try {
      // Initialize connections (DB, Redis, RabbitMQ)
      await this.initializeConnections();

      // Setup RabbitMQ exchanges
      await this.rabbitmq!.assertExchange('messages', 'direct', { durable: true });
      await this.rabbitmq!.assertExchange('messages_dlx', 'direct', { durable: true });

      // Setup routes
      await this.setupRoutes();

      // Setup error handling
      this.setupErrorHandling();

      // Create HTTP server from Express app
      const httpServer = createServer(this.app);

      // Setup Socket.IO
      this.io = new Server(httpServer, {
        cors: {
          origin: process.env.WEBSOCKET_CORS_ORIGIN || '*',
          methods: ['GET', 'POST'],
          credentials: true,
        },
        transports: ['websocket', 'polling'],
      });

      // Initialize message services
      const presenceService = new PresenceService(this.redis!);
      const messageQueue = new MessageQueueService(this.rabbitmq!);
      this.messageService = new MessageService(this.io, presenceService, messageQueue, this.jwtService!);

      // Socket.IO connection handler
      this.io.on('connection', (socket) => {
        this.messageService!.handleConnection(socket);
      });

      // Call onReady hook
      if (this.onReady) {
        await this.onReady();
      }

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      // Start server
      httpServer.listen(this.config.port, () => {
        this.logger.info(`${this.config.serviceName} running on port ${this.config.port}`);
        this.logger.info(`WebSocket server ready at ws://localhost:${this.config.port}`);
      });
    } catch (error) {
      this.logger.error('Failed to start service:', error);
      process.exit(1);
    }
  }
}

// Start the service
const messageService = new MessageServiceApp();
messageService.start();
