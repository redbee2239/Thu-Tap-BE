import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import type { Logger } from '../infra/cache.js';
import type { TaskRepo } from '../types.js';

export const REMINDER_QUEUE = 'task-reminders';
export const DAILY_REMINDER_REPEAT = { pattern: '0 8 * * *', tz: 'Asia/Ho_Chi_Minh' } as const;
export const REMINDER_JOB_OPTIONS = {
  repeat: DAILY_REMINDER_REPEAT,
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1000 },
  removeOnComplete: 100,
  removeOnFail: 100
};

export function redisConnection(redisUrl: string): ConnectionOptions {
  return { url: redisUrl, maxRetriesPerRequest: null };
}

export function createReminderQueue(redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'): Queue {
  return new Queue(REMINDER_QUEUE, { connection: redisConnection(redisUrl) });
}

export function scheduleDailyReminder(queue: Queue) {
  return queue.add('scan-upcoming-tasks', {}, REMINDER_JOB_OPTIONS);
}

export function createReminderWorker(
  taskRepo: TaskRepo,
  redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  logger: Logger = console
): Worker {
  return new Worker(
    REMINDER_QUEUE,
    async (_job: Job) => {
      const upcomingTasks = taskRepo.listDueSoon(1);
      for (const task of upcomingTasks) {
        logger.log(`[reminder] ${task.title} (${task.id}) còn ${task.dueInDays} ngày`);
      }
      logger.log(`[reminder] scan complete: ${upcomingTasks.length} task(s)`);
      return { reminded: upcomingTasks.length };
    },
    { connection: redisConnection(redisUrl) }
  );
}
