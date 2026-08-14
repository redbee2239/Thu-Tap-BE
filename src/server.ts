import { Pool } from 'pg';
import { createClient } from 'redis';
import { createRuntime } from './app.js';
import { createRedisCache } from './infra/cache.js';
import { createReminderQueue, createReminderWorker, scheduleDailyReminder } from './jobs/reminderJob.js';

const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://taskflow:taskflow@127.0.0.1:5432/taskflow';
const port = Number(process.env.PORT ?? 3000);

const database = new Pool({ connectionString: databaseUrl });
const redis = createClient({ url: redisUrl });
redis.on('error', (error) => console.error('[redis]', error));

try {
  await Promise.all([database.query('SELECT 1'), redis.connect()]);
} catch (error) {
  await Promise.allSettled([database.end(), redis.isOpen ? redis.quit() : Promise.resolve()]);
  throw error;
}

let stopping = false;
const { app, store } = createRuntime({
  cache: createRedisCache(redis),
  healthcheck: async () => {
    if (stopping) throw new Error('Server is shutting down');
    await Promise.all([database.query('SELECT 1'), redis.ping()]);
  }
});
const queue = createReminderQueue(redisUrl);
await scheduleDailyReminder(queue);
const worker = createReminderWorker(store.tasks, redisUrl);
worker.on('failed', (job, error) => console.error(`[reminder] failed ${job?.id}`, error));

const server = app.listen(port, () => console.log(`TaskFlow listening on http://localhost:${port}`));

function closeServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(`${signal} received: stopping TaskFlow`);

  await closeServer();
  await Promise.allSettled([
    worker.close(),
    queue.close(),
    redis.isOpen ? redis.quit() : Promise.resolve(),
    database.end()
  ]);
  process.exit(0);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown(signal).catch((error) => {
      console.error('Graceful shutdown failed', error);
      process.exit(1);
    });
  });
}
