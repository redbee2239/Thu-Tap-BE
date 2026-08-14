export type CacheStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
};

type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
};

export class MemoryCache implements CacheStore {
  private readonly entries = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1_000 });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

export function createRedisCache(redis: RedisLike): CacheStore {
  return {
    get: (key) => redis.get(key),
    async set(key, value, ttlSeconds) {
      await redis.set(key, value, { EX: ttlSeconds });
    },
    async delete(key) {
      await redis.del(key);
    }
  };
}

export const workspaceProjectsKey = (workspaceId: string) => `workspace:${workspaceId}:projects`;
export const workspaceStatsKey = (workspaceId: string) => `workspace:${workspaceId}:task-stats`;
