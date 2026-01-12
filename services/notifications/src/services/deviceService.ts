import { RedisConnection } from '@mansion/common';

export class DeviceService {
  constructor(private redis: RedisConnection) {}
  async registerDevice(userId: string, deviceToken: string, platform: 'ios' | 'android'): Promise<void> {
    const key = `device:${userId}`;
    const device = JSON.stringify({
      deviceToken,
      platform,
      registeredAt: new Date().toISOString(),
    });

    // Store device token (supports multiple devices per user)
    await this.redis.sAdd(key, device);
  }

  async unregisterDevice(userId: string, deviceToken: string): Promise<void> {
    const key = `device:${userId}`;
    const devices = await this.redis.sMembers(key);

    for (const device of devices) {
      const parsed = JSON.parse(device);
      if (parsed.deviceToken === deviceToken) {
        await this.redis.sRem(key, device);
        break;
      }
    }
  }

  async getUserDevices(userId: string): Promise<Array<{ deviceToken: string; platform: string }>> {
    const key = `device:${userId}`;
    const devices = await this.redis.sMembers(key);

    return devices.map((device) => {
      const parsed = JSON.parse(device);
      return {
        deviceToken: parsed.deviceToken,
        platform: parsed.platform,
      };
    });
  }
}
