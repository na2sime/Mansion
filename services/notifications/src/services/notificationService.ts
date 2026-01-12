import { v4 as uuidv4 } from 'uuid';
import { DeviceService } from './deviceService';
import { Notification, UserEvent } from '../types';

export class NotificationService {
  constructor(private deviceService: DeviceService) {}
  async processUserEvent(event: UserEvent): Promise<void> {
    const { eventType, data } = event;

    switch (eventType) {
      case 'contact.request_sent':
        await this.handleContactRequest(data);
        break;
      case 'contact.request_accepted':
        await this.handleContactAccepted(data);
        break;
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }
  }

  private async handleContactRequest(data: any): Promise<void> {
    const { toUserId, fromUserTag } = data;

    const notification: Omit<Notification, 'id' | 'createdAt'> = {
      userId: toUserId,
      title: 'New Contact Request',
      body: `${fromUserTag} wants to add you as a contact`,
      data: {
        requestId: data.requestId,
        fromUserId: data.fromUserId,
        fromUserTag: data.fromUserTag,
      },
      type: 'contact_request',
    };

    await this.sendNotification(notification);
  }

  private async handleContactAccepted(data: any): Promise<void> {
    const { fromUserId } = data;

    const notification: Omit<Notification, 'id' | 'createdAt'> = {
      userId: fromUserId,
      title: 'Contact Request Accepted',
      body: 'Your contact request has been accepted',
      data: {
        requestId: data.requestId,
        toUserId: data.toUserId,
      },
      type: 'contact_accepted',
    };

    await this.sendNotification(notification);
  }

  private async sendNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<void> {
    const fullNotification: Notification = {
      id: uuidv4(),
      createdAt: new Date(),
      ...notification,
    };

    console.log(`📬 Sending notification to user ${notification.userId}:`, fullNotification);

    // Get user's devices
    const devices = await this.deviceService.getUserDevices(notification.userId);

    if (devices.length === 0) {
      console.log(`No devices registered for user ${notification.userId}`);
      return;
    }

    // Send to each device
    for (const device of devices) {
      await this.sendPushNotification(device.deviceToken, device.platform, fullNotification);
    }
  }

  private async sendPushNotification(
    deviceToken: string,
    platform: string,
    notification: Notification
  ): Promise<void> {
    // TODO: Implement actual push notification sending via FCM/APNS
    // For now, just log
    console.log(`📱 Push notification to ${platform} device ${deviceToken.substring(0, 10)}...`);
    console.log(`   Title: ${notification.title}`);
    console.log(`   Body: ${notification.body}`);

    // Implementation would use Firebase Cloud Messaging (FCM) for Android
    // and Apple Push Notification Service (APNS) for iOS
    // Example with FCM:
    // await admin.messaging().send({
    //   token: deviceToken,
    //   notification: {
    //     title: notification.title,
    //     body: notification.body,
    //   },
    //   data: notification.data,
    // });
  }
}
