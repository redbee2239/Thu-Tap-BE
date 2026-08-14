import { Queue, Worker, type ConnectionOptions } from 'bullmq';

export const REMINDER_QUEUE = 'task-reminders';
const connection = (url: string): ConnectionOptions => ({ url, maxRetriesPerRequest: null });

export function createReminderQueue(redisUrl: string) {
  return new Queue(REMINDER_QUEUE, { connection: connection(redisUrl) });
}

export function scheduleDailyReminder(queue: Queue) {
  return queue.add('scan-due-tasks', {}, {
    repeat: { pattern: '0 8 * * *', tz: 'Asia/Ho_Chi_Minh' },
    attempts: 3,
    backoff: { type: 'exponential', delay: 1_000 },
    removeOnComplete: 100,
    removeOnFail: 100
  });
}

export function createReminderWorker(
  redisUrl: string,
  findDueSoon: () => Promise<Array<{ id: string; title: string; dueDate: Date | null; project: { workspaceId: string } }>>,
  log: (object: unknown, message?: string) => void
) {
  return new Worker(REMINDER_QUEUE, async () => {
    const tasks = await findDueSoon();
    for (const task of tasks) log({ taskId: task.id, workspaceId: task.project.workspaceId, dueDate: task.dueDate }, `Nhắc hạn: ${task.title}`);
    return { reminded: tasks.length };
  }, { connection: connection(redisUrl) });
}
