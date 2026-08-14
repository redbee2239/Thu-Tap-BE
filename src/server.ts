import { createClient } from 'redis';
import { createRuntime } from './app.js';
import { MemoryCache, createRedisCache, type CacheStore } from './cache.js';
import { config } from './config.js';
import { createDatabase } from './db.js';
import { createReminderQueue, createReminderWorker, scheduleDailyReminder } from './jobs.js';
import { logger } from './logger.js';

const isProduction = process.env.NODE_ENV === 'production';
const database = createDatabase(config.DATABASE_URL);
const redis = createClient({ url: config.REDIS_URL, socket: { reconnectStrategy: false } });
let redisReady = false;
redis.on('error', (error) => {
  if (redisReady || isProduction) logger.error({ err: error }, 'Redis connection error');
});

await database.connect();
let cache: CacheStore = new MemoryCache();
try {
  await redis.connect();
  redisReady = true;
  cache = createRedisCache(redis);
} catch (error) {
  if (isProduction) {
    await database.disconnect();
    throw error;
  }
  // ponytail: local mode works without Redis; cache and reminders resume when Redis is available.
  logger.warn({ err: error }, 'Redis unavailable; using memory cache and disabling reminders');
}

let stopping = false;
const runtime = createRuntime({
  database,
  cache,
  cacheName: redisReady ? 'redis' : 'memory',
  authSecrets: { jwtSecret: config.JWT_SECRET, jwtRefreshSecret: config.JWT_REFRESH_SECRET },
  corsOrigin: config.CORS_ORIGIN,
  logger,
  healthcheck: async () => {
    if (stopping) throw new Error('Server is stopping');
    await database.health();
    if (redisReady) await redis.ping();
  }
});

let queue: ReturnType<typeof createReminderQueue> | undefined;
let worker: ReturnType<typeof createReminderWorker> | undefined;
if (redisReady) {
  queue = createReminderQueue(config.REDIS_URL);
  await scheduleDailyReminder(queue);
  worker = createReminderWorker(config.REDIS_URL, runtime.services.dueSoon, (object, message) => logger.info(object, message));
  worker.on('failed', (job, error) => logger.error({ err: error, jobId: job?.id }, 'Reminder job failed'));
}

const server = runtime.app.listen(config.PORT, () => logger.info({ port: config.PORT }, 'TaskFlow started'));

function closeServer(): Promise<void> {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, 'TaskFlow stopping');
  await closeServer();
  await Promise.allSettled([
    worker?.close(),
    queue?.close(),
    redisReady && redis.isOpen ? redis.quit() : Promise.resolve(),
    database.disconnect()
  ]);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown(signal).then(() => process.exit(0)).catch((error) => {
      logger.error({ err: error }, 'Graceful shutdown failed');
      process.exit(1);
    });
  });
}
