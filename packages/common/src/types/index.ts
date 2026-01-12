// User types
export interface User {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  userTag: string;
  publicKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

// User tag format: AAAAAAA#BBB (8 alphanumeric + # + max 3 alphanumeric)
export type UserTag = string;

// Message types
export interface EncryptedMessage {
  messageId: string;
  fromUserId: string;
  toUserId: string;
  encryptedContent: string;
  timestamp: string;
  type: 'text' | 'file' | 'image';
}

export interface MessageDeliveryStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'read';
  timestamp: string;
}

// Presence types
export interface UserPresence {
  userId: string;
  status: 'online' | 'offline';
  lastSeen?: string;
}

export interface TypingIndicator {
  userId: string;
  isTyping: boolean;
}

// Contact types
export interface Contact {
  id: string;
  userId: string;
  contactUserId: string;
  contactUserTag: string;
  nickname?: string;
  publicKey?: string;
  addedAt: Date;
}

export interface ContactRequest {
  id: string;
  fromUserId: string;
  fromUserTag: string;
  toUserId: string;
  toUserTag: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

// Notification types
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

// Event types
export interface UserEvent {
  eventType: string;
  data: any;
  timestamp: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
