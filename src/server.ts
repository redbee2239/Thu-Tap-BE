import { createClient } from 'redis';
import { createRedisCache } from './infra/cache.js';
import { createRuntime } from './app.js';
import { createReminderQueue, createReminderWorker, scheduleDailyReminder } from './jobs/reminderJob.js';

const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
const port = Number(process.env.PORT ?? 3000);

const redis = createClient({ url: redisUrl });
redis.on('error', (error) => console.error('[redis]', error));
await redis.connect();

const { app, store } = createRuntime({ cache: createRedisCache(redis) });
const queue = createReminderQueue(redisUrl);
await scheduleDailyReminder(queue);
const worker = createReminderWorker(store.tasks, redisUrl);
worker.on('failed', (job, error) => console.error(`[reminder] failed ${job?.id}`, error));

const server = app.listen(port, () => console.log(`TaskFlow listening on http://localhost:${port}`));

async function shutdown(): Promise<void> {
  await worker.close();
  await queue.close();
  await redis.quit();
  server.close();
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
