export interface DeviceToken {
  userId: string;
  deviceToken: string;
  platform: 'ios' | 'android';
  registeredAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  type: 'contact_request' | 'contact_accepted' | 'message' | 'system';
  createdAt: Date;
}

export interface UserEvent {
  eventType: string;
  data: any;
  timestamp: string;
}
