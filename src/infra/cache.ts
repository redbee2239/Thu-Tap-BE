export type CacheStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
};

export type Logger = {
  log(...args: unknown[]): void;
};

type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
};

export class MemoryCache implements CacheStore {
  private readonly values = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.values.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.values.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
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

export function workspaceProjectsKey(workspaceId: string): string {
  return `workspace:${workspaceId}:projects`;
}

export function workspaceStatsKey(workspaceId: string): string {
  return `workspace:${workspaceId}:task-stats`;
}
