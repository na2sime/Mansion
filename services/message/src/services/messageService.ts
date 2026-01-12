import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { JWTService } from '@mansion/common';
import { PresenceService } from './this.presenceService';
import { MessageQueueService } from './messageQueueService';
import { EncryptedMessage, MessageDeliveryStatus, TypingIndicator } from '../types';

export class MessageService {
  private io: Server;
  private userSockets: Map<string, string>; // userId -> socketId

  constructor(
    io: Server,
    private this.presenceService: PresenceService,
    private messageQueue: MessageQueueService,
    private jwtService: JWTService
  ) {
    this.io = io;
    this.userSockets = new Map();
  }

  async handleConnection(socket: Socket): Promise<void> {
    try {
      // Authenticate via token
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        socket.disconnect();
        return;
      }

      const payload = this.jwtService.verifyAccessToken(token as string);
      const userId = payload.userId;

      // Store socket mapping
      this.userSockets.set(userId, socket.id);
      socket.data.userId = userId;

      // Set user online
      await this.this.presenceService.setOnline(userId, socket.id);

      console.log(`User ${userId} connected`);

      // Notify about online status
      socket.broadcast.emit('user:online', { userId, timestamp: new Date().toISOString() });

      // Setup heartbeat
      const heartbeatInterval = setInterval(async () => {
        await this.presenceService.heartbeat(userId, socket.id);
      }, 15000);

      // Consume queued messages from RabbitMQ
      await this.deliverQueuedMessages(userId, socket);

      // Handle incoming messages
      socket.on('message:send', async (data: Omit<EncryptedMessage, 'messageId' | 'timestamp'>) => {
        await this.handleSendMessage(socket, data);
      });

      // Handle typing indicator
      socket.on('typing:start', (data: { toUserId: string }) => {
        this.handleTypingIndicator(socket, data.toUserId, true);
      });

      socket.on('typing:stop', (data: { toUserId: string }) => {
        this.handleTypingIndicator(socket, data.toUserId, false);
      });

      // Handle message delivery confirmation
      socket.on('message:delivered', (data: { messageId: string }) => {
        this.handleDeliveryStatus(socket, data.messageId, 'delivered');
      });

      // Handle message read confirmation
      socket.on('message:read', (data: { messageId: string }) => {
        this.handleDeliveryStatus(socket, data.messageId, 'read');
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        clearInterval(heartbeatInterval);
        await this.handleDisconnection(userId, socket);
      });
    } catch (error) {
      console.error('Connection error:', error);
      socket.disconnect();
    }
  }

  private async handleSendMessage(
    socket: Socket,
    data: Omit<EncryptedMessage, 'messageId' | 'timestamp'>
  ): Promise<void> {
    try {
      const fromUserId = socket.data.userId;
      const { toUserId, encryptedContent, type } = data;

      const message: EncryptedMessage = {
        messageId: uuidv4(),
        fromUserId,
        toUserId,
        encryptedContent,
        type,
        timestamp: new Date().toISOString(),
      };

      // Check if recipient is online
      const isOnline = await this.presenceService.isOnline(toUserId);

      if (isOnline) {
        // Deliver directly via WebSocket
        const recipientSocketId = await this.presenceService.getSocketId(toUserId);
        if (recipientSocketId) {
          this.io.to(recipientSocketId).emit('message:receive', message);

          // Confirm sent to sender
          socket.emit('message:sent', {
            messageId: message.messageId,
            timestamp: message.timestamp,
          });
        }
      } else {
        // Queue message in RabbitMQ for offline user
        await this.messageQueue.publishMessage(toUserId, message);

        // Confirm queued to sender
        socket.emit('message:queued', {
          messageId: message.messageId,
          timestamp: message.timestamp,
        });
      }

      console.log(`Message ${message.messageId} from ${fromUserId} to ${toUserId}`);
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('message:error', { error: 'Failed to send message' });
    }
  }

  private handleTypingIndicator(socket: Socket, toUserId: string, isTyping: boolean): void {
    const fromUserId = socket.data.userId;

    const indicator: TypingIndicator & { fromUserId: string } = {
      userId: fromUserId,
      fromUserId,
      isTyping,
    };

    // Send to recipient if online
    const recipientSocketId = this.userSockets.get(toUserId);
    if (recipientSocketId) {
      this.io.to(recipientSocketId).emit('typing:indicator', indicator);
    }
  }

  private handleDeliveryStatus(socket: Socket, messageId: string, status: 'delivered' | 'read'): void {
    const statusUpdate: MessageDeliveryStatus = {
      messageId,
      status,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to sender
    socket.broadcast.emit('message:status', statusUpdate);
  }

  private async deliverQueuedMessages(userId: string, socket: Socket): Promise<void> {
    try {
      await this.messageQueue.consumeMessages(userId, (message: EncryptedMessage) => {
        socket.emit('message:receive', message);
      });
    } catch (error) {
      console.error('Error delivering queued messages:', error);
    }
  }

  private async handleDisconnection(userId: string, socket: Socket): Promise<void> {
    this.userSockets.delete(userId);
    await this.presenceService.setOffline(userId);

    console.log(`User ${userId} disconnected`);

    // Notify about offline status
    const lastSeen = await this.presenceService.getLastSeen(userId);
    socket.broadcast.emit('user:offline', { userId, lastSeen });
  }
}
