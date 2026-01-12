import { RabbitMQConnection } from '@mansion/common';

export class MessageQueueService {
  constructor(private rabbitmq: RabbitMQConnection) {}

  async setup(): Promise<void> {
    // Declare exchange for messages
    await this.rabbitmq.assertExchange('messages', 'direct', { durable: true });

    // Declare dead letter exchange for failed deliveries
    await this.rabbitmq.assertExchange('messages_dlx', 'direct', { durable: true });
  }

  async publishMessage(userId: string, message: any): Promise<void> {
    const channel = this.rabbitmq.getChannel();

    // Create user-specific queue if it doesn't exist
    await channel.assertQueue(`messages:${userId}`, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'messages_dlx',
        'x-message-ttl': 7 * 24 * 60 * 60 * 1000, // 7 days TTL
      },
    });

    // Bind queue to exchange
    await channel.bindQueue(`messages:${userId}`, 'messages', userId);

    const messageBuffer = Buffer.from(JSON.stringify(message));
    await this.rabbitmq.publish('messages', userId, messageBuffer, { persistent: true });
  }

  async consumeMessages(userId: string, callback: (message: any) => void): Promise<void> {
    const channel = this.rabbitmq.getChannel();

    // Ensure queue exists
    await channel.assertQueue(`messages:${userId}`, { durable: true });

    await channel.consume(
      `messages:${userId}`,
      (msg: any) => {
        if (msg) {
          try {
            const message = JSON.parse(msg.content.toString());
            callback(message);
            channel.ack(msg);
          } catch (error) {
            console.error('Error processing message:', error);
            channel.nack(msg, false, false);
          }
        }
      },
      { noAck: false }
    );
  }
}
