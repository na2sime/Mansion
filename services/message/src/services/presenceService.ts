import { RedisConnection } from '@mansion/common';

const PRESENCE_TTL = 30; // seconds
const PRESENCE_KEY_PREFIX = 'presence:';

export class PresenceService {
  constructor(private redis: RedisConnection) {}
  async setOnline(userId: string, socketId: string): Promise<void> {
    await this.redis.setEx(`${PRESENCE_KEY_PREFIX}${userId}`, PRESENCE_TTL, socketId);
    await this.redis.sAdd('online_users', userId);
  }

  async setOffline(userId: string): Promise<void> {
    await this.redis.del(`${PRESENCE_KEY_PREFIX}${userId}`);
    await this.redis.sRem('online_users', userId);
    await this.redis.set(`lastseen:${userId}`, new Date().toISOString());
  }

  async isOnline(userId: string): Promise<boolean> {
    const exists = await this.redis.exists(`${PRESENCE_KEY_PREFIX}${userId}`);
    return exists === 1;
  }

  async getSocketId(userId: string): Promise<string | null> {
    return await this.redis.get(`${PRESENCE_KEY_PREFIX}${userId}`);
  }

  async heartbeat(userId: string, socketId: string): Promise<void> {
    await this.redis.setEx(`${PRESENCE_KEY_PREFIX}${userId}`, PRESENCE_TTL, socketId);
  }

  async getLastSeen(userId: string): Promise<string | null> {
    return await this.redis.get(`lastseen:${userId}`);
  }

  async getOnlineUsers(): Promise<string[]> {
    return await this.redis.sMembers('online_users');
  }
}
