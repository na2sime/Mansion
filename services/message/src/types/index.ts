export interface EncryptedMessage {
  messageId: string;
  fromUserId: string;
  toUserId: string;
  encryptedContent: string; // Encrypted by client
  timestamp: string;
  type: 'text' | 'file' | 'image';
}

export interface MessageDeliveryStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'read';
  timestamp: string;
}

export interface TypingIndicator {
  userId: string;
  isTyping: boolean;
}

export interface UserPresence {
  userId: string;
  status: 'online' | 'offline';
  lastSeen?: string;
}
