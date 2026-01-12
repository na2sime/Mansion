import { DatabaseConnection, RedisConnection, RabbitMQConnection } from '@mansion/common';
import { isValidUserTag, generateRandomTag, normalizeTag } from '../utils/tagValidator';

export interface UserProfile {
  id: string;
  userTag: string;
  publicKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

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

export class UserService {
  constructor(
    private db: DatabaseConnection,
    private redis: RedisConnection,
    private rabbitmq: RabbitMQConnection
  ) {}

  private async publishUserEvent(eventType: string, data: any): Promise<void> {
    const message = {
      eventType,
      data,
      timestamp: new Date().toISOString(),
    };
    await this.rabbitmq.publish('user_events', eventType, Buffer.from(JSON.stringify(message)), { persistent: true });
  }

  async createUserProfile(userId: string, publicKey?: string): Promise<UserProfile> {
    // Generate a unique tag
    let userTag: string;
    let isUnique = false;

    while (!isUnique) {
      userTag = generateRandomTag();
      const existing = await this.db.query('SELECT id FROM user_profiles WHERE user_tag = $1', [userTag]);
      isUnique = existing.rows.length === 0;
    }

    const result = await this.db.query(
      'INSERT INTO user_profiles (id, user_tag, public_key) VALUES ($1, $2, $3) RETURNING *',
      [userId, userTag!, publicKey]
    );

    const profile = result.rows[0];

    // Cache profile in Redis
    await this.redis.setEx(`user:profile:${userId}`, 3600, JSON.stringify(profile));

    // Publish event
    await publishUserEvent('user.created', { userId, userTag: userTag! });

    return profile;
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    // Try cache first
    const cached = await this.redis.get(`user:profile:${userId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await this.db.query('SELECT * FROM user_profiles WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const profile = result.rows[0];

    // Cache for future requests
    await this.redis.setEx(`user:profile:${userId}`, 3600, JSON.stringify(profile));

    return profile;
  }

  async updateUserTag(userId: string, newTag: string): Promise<void> {
    const normalizedTag = normalizeTag(newTag);

    // Validate tag format
    if (!isValidUserTag(normalizedTag)) {
      throw new Error('Invalid tag format. Must be 8 alphanumeric characters + # + max 3 alphanumeric characters');
    }

    // Check if tag is already taken
    const existing = await this.db.query('SELECT id FROM user_profiles WHERE user_tag = $1 AND id != $2', [
      normalizedTag,
      userId,
    ]);

    if (existing.rows.length > 0) {
      throw new Error('Tag already taken');
    }

    // Update tag
    await this.db.query('UPDATE user_profiles SET user_tag = $1, updated_at = NOW() WHERE id = $2', [
      normalizedTag,
      userId,
    ]);

    // Invalidate cache
    await this.redis.del(`user:profile:${userId}`);

    // Publish event
    await publishUserEvent('user.tag_updated', { userId, newTag: normalizedTag });
  }

  async updatePublicKey(userId: string, publicKey: string): Promise<void> {
    await this.db.query('UPDATE user_profiles SET public_key = $1, updated_at = NOW() WHERE id = $2', [
      publicKey,
      userId,
    ]);

    // Invalidate cache
    await this.redis.del(`user:profile:${userId}`);
  }

  async searchUserByTag(tag: string): Promise<UserProfile | null> {
    const normalizedTag = normalizeTag(tag);

    const result = await this.db.query('SELECT * FROM user_profiles WHERE user_tag = $1', [normalizedTag]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  async sendContactRequest(fromUserId: string, toUserTag: string): Promise<ContactRequest> {
    const normalizedTag = normalizeTag(toUserTag);

    // Find target user
    const targetUser = await this.searchUserByTag(normalizedTag);
    if (!targetUser) {
      throw new Error('User not found');
    }

    const toUserId = targetUser.id;

    // Cannot add yourself
    if (fromUserId === toUserId) {
      throw new Error('Cannot add yourself as contact');
    }

    // Check if already in contacts
    const existingContact = await this.db.query(
      'SELECT id FROM contacts WHERE user_id = $1 AND contact_user_id = $2',
      [fromUserId, toUserId]
    );

    if (existingContact.rows.length > 0) {
      throw new Error('Already in contacts');
    }

    // Check if request already exists
    const existingRequest = await this.db.query(
      'SELECT id, status FROM contact_requests WHERE (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1)',
      [fromUserId, toUserId]
    );

    if (existingRequest.rows.length > 0) {
      const status = existingRequest.rows[0].status;
      if (status === 'pending') {
        throw new Error('Contact request already pending');
      }
    }

    // Get sender tag
    const fromUser = await this.getUserProfile(fromUserId);
    if (!fromUser) {
      throw new Error('Sender profile not found');
    }

    // Create contact request
    const result = await this.db.query(
      'INSERT INTO contact_requests (from_user_id, to_user_id, status) VALUES ($1, $2, $3) RETURNING *',
      [fromUserId, toUserId, 'pending']
    );

    const request = result.rows[0];

    // Publish event for notification service
    await publishUserEvent('contact.request_sent', {
      requestId: request.id,
      fromUserId,
      fromUserTag: fromUser.userTag,
      toUserId,
      toUserTag: normalizedTag,
    });

    return {
      ...request,
      fromUserTag: fromUser.userTag,
      toUserTag: normalizedTag,
    };
  }

  async getPendingContactRequests(userId: string): Promise<ContactRequest[]> {
    const result = await this.db.query(
      `SELECT cr.*,
              from_profile.user_tag as from_user_tag,
              to_profile.user_tag as to_user_tag
       FROM contact_requests cr
       JOIN user_profiles from_profile ON cr.from_user_id = from_profile.id
       JOIN user_profiles to_profile ON cr.to_user_id = to_profile.id
       WHERE cr.to_user_id = $1 AND cr.status = 'pending'
       ORDER BY cr.created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  async respondToContactRequest(
    requestId: string,
    userId: string,
    action: 'accept' | 'reject',
    nickname?: string
  ): Promise<void> {
    // Get request
    const requestResult = await this.db.query('SELECT * FROM contact_requests WHERE id = $1 AND to_user_id = $2', [
      requestId,
      userId,
    ]);

    if (requestResult.rows.length === 0) {
      throw new Error('Contact request not found');
    }

    const request = requestResult.rows[0];

    if (request.status !== 'pending') {
      throw new Error('Request already processed');
    }

    const newStatus = action === 'accept' ? 'accepted' : 'rejected';

    // Update request status
    await this.db.query('UPDATE contact_requests SET status = $1, updated_at = NOW() WHERE id = $2', [
      newStatus,
      requestId,
    ]);

    if (action === 'accept') {
      // Add to contacts (both ways)
      await this.db.query('INSERT INTO contacts (user_id, contact_user_id, nickname) VALUES ($1, $2, $3)', [
        userId,
        request.from_user_id,
        nickname,
      ]);

      await this.db.query('INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2)', [
        request.from_user_id,
        userId,
      ]);

      // Publish event
      await publishUserEvent('contact.request_accepted', {
        requestId,
        fromUserId: request.from_user_id,
        toUserId: userId,
      });
    } else {
      // Publish event
      await publishUserEvent('contact.request_rejected', {
        requestId,
        fromUserId: request.from_user_id,
        toUserId: userId,
      });
    }
  }

  async getContacts(userId: string): Promise<Contact[]> {
    const result = await this.db.query(
      `SELECT c.*,
              p.user_tag as contact_user_tag,
              p.public_key
       FROM contacts c
       JOIN user_profiles p ON c.contact_user_id = p.id
       WHERE c.user_id = $1
       ORDER BY c.added_at DESC`,
      [userId]
    );

    return result.rows;
  }

  async removeContact(userId: string, contactId: string): Promise<void> {
    // Get contact to find contact_user_id
    const contactResult = await this.db.query('SELECT contact_user_id FROM contacts WHERE id = $1 AND user_id = $2', [
      contactId,
      userId,
    ]);

    if (contactResult.rows.length === 0) {
      throw new Error('Contact not found');
    }

    const contactUserId = contactResult.rows[0].contact_user_id;

    // Remove contact (both ways)
    await this.db.query('DELETE FROM contacts WHERE id = $1', [contactId]);
    await this.db.query('DELETE FROM contacts WHERE user_id = $1 AND contact_user_id = $2', [
      contactUserId,
      userId,
    ]);

    // Publish event
    await publishUserEvent('contact.removed', {
      userId,
      contactUserId,
    });
  }
}
