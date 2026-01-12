import dotenv from 'dotenv';
import { ServiceBase } from '@mansion/common';
import { NotificationService } from './services/notificationService';
import { DeviceService } from './services/deviceService';
import { UserEvent } from './types';

dotenv.config();

class NotificationServiceApp extends ServiceBase {
  private notificationService?: NotificationService;
  private deviceService?: DeviceService;

  constructor() {
    super({
      serviceName: 'notification-service',
      port: parseInt(process.env.PORT || '3004'),
      useDatabase: false,
      useRedis: true,
      useRabbitMQ: true,
    });
  }

  protected async setupRoutes(): Promise<void> {
    // Initialize services
    this.deviceService = new DeviceService(this.redis!);
    this.notificationService = new NotificationService(this.deviceService);

    // Register device for push notifications
    this.app.post('/api/notifications/register', async (req, res) => {
      try {
        const { userId, deviceToken, platform } = req.body;

        if (!userId || !deviceToken || !platform) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        if (platform !== 'ios' && platform !== 'android') {
          return res.status(400).json({ error: 'Invalid platform. Must be ios or android' });
        }

        await this.deviceService!.registerDevice(userId, deviceToken, platform);

        res.json({ message: 'Device registered successfully' });
      } catch (error: any) {
        this.logger.error('Register device error:', error);
        res.status(500).json({ error: 'Failed to register device', message: error.message });
      }
    });

    // Unregister device
    this.app.post('/api/notifications/unregister', async (req, res) => {
      try {
        const { userId, deviceToken } = req.body;

        if (!userId || !deviceToken) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        await this.deviceService!.unregisterDevice(userId, deviceToken);

        res.json({ message: 'Device unregistered successfully' });
      } catch (error: any) {
        this.logger.error('Unregister device error:', error);
        res.status(500).json({ error: 'Failed to unregister device', message: error.message });
      }
    });

    // Start consuming events from RabbitMQ
    await this.startEventConsumer();
  }

  private async startEventConsumer(): Promise<void> {
    const channel = this.rabbitmq!.getChannel();

    await channel.assertQueue('notifications', { durable: true });

    await channel.consume(
      'notifications',
      async (msg: any) => {
        if (msg) {
          try {
            const event: UserEvent = JSON.parse(msg.content.toString());
            this.logger.info(`Received event: ${event.eventType}`);

            await this.notificationService!.processUserEvent(event);

            channel.ack(msg);
          } catch (error) {
            this.logger.error('Error processing event:', error);
            channel.nack(msg, false, false);
          }
        }
      },
      { noAck: false }
    );

    this.logger.info('Listening for notification events...');
  }

  protected async onReady(): Promise<void> {
    this.logger.info('Notification Service is ready to handle requests');
  }
}

// Start the service
const notificationService = new NotificationServiceApp();
notificationService.start();
