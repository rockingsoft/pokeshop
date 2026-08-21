import Redis from 'ioredis';

const { REDIS_URL = '' } = process.env;
const defaultExpireTimeInSeconds = 300; // 5 minutes

export interface CacheService<T> {
  isAvailable(): Promise<boolean>;
  get(key: string): Promise<T | null>;
  set(key: string, value: T): Promise<void>;
  invalidate(key: string): Promise<void>;
}

function getCacheService<T>(): CacheService<T> {
  return new RedisCacheService<T>(REDIS_URL);
}

class RedisCacheService<T> implements CacheService<T> {
  readonly redis: Redis.Redis;

  public constructor(redisUrl: string) {
    this.redis = new Redis({
      host: redisUrl,
    });
  }

  public async get(key: string): Promise<T | null> {
    const result = await this.redis.get(key);
    return result ? (JSON.parse(result) as T) : null;
  }

  public async set(key: string, value: T): Promise<void> {
    await this.redis.setex(key, defaultExpireTimeInSeconds, JSON.stringify(value));
  }

  public async isAvailable(): Promise<boolean> {
    try {
      const response = await this.redis.ping();
      return response === 'PONG';
    } catch (ex) {
      return false;
    }
  }

  public async invalidate(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

export { getCacheService };
