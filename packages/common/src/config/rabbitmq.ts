import * as amqp from 'amqplib';

export interface RabbitMQConfig {
  url?: string;
  user?: string;
  password?: string;
  host?: string;
  port?: number;
}

export class RabbitMQConnection {
  private connection?: any; // Using any to bypass amqplib typing issues
  private channel?: any;
  private isConnected: boolean = false;
  private url: string;

  constructor(config?: RabbitMQConfig) {
    if (config?.url) {
      this.url = config.url;
    } else {
      const user = config?.user || process.env.RABBITMQ_USER || 'guest';
      const password = config?.password || process.env.RABBITMQ_PASSWORD || 'guest';
      const host = config?.host || process.env.RABBITMQ_HOST || 'localhost';
      const port = config?.port || parseInt(process.env.RABBITMQ_PORT || '5672');
      this.url = process.env.RABBITMQ_URL || `amqp://${user}:${password}@${host}:${port}`;
    }
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();
      this.isConnected = true;
      console.log('✅ Connected to RabbitMQ');
    } catch (error) {
      console.error('❌ Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  getChannel(): any {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized. Call connect() first.');
    }
    return this.channel;
  }

  async assertQueue(queueName: string, options?: any): Promise<void> {
    const channel = this.getChannel();
    await channel.assertQueue(queueName, options);
  }

  async assertExchange(
    exchangeName: string,
    exchangeType: string,
    options?: any
  ): Promise<void> {
    const channel = this.getChannel();
    await channel.assertExchange(exchangeName, exchangeType, options);
  }

  async publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options?: any
  ): Promise<void> {
    const channel = this.getChannel();
    channel.publish(exchange, routingKey, content, options);
  }

  async publishToQueue(queueName: string, message: any): Promise<void> {
    const channel = this.getChannel();
    const content = Buffer.from(JSON.stringify(message));
    channel.sendToQueue(queueName, content, { persistent: true });
  }

  async consume(
    queueName: string,
    onMessage: (message: any) => void | Promise<void>,
    options?: any
  ): Promise<void> {
    const channel = this.getChannel();
    await channel.consume(
      queueName,
      async (msg: any) => {
        if (msg) {
          try {
            const message = JSON.parse(msg.content.toString());
            await onMessage(message);
            channel.ack(msg);
          } catch (error) {
            console.error('Error processing message:', error);
            channel.nack(msg, false, false);
          }
        }
      },
      { noAck: false, ...options }
    );
  }

  async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    this.isConnected = false;
  }
}
