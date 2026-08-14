import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { DAILY_REMINDER_REPEAT, REMINDER_JOB_OPTIONS, scheduleDailyReminder } from '../src/jobs/reminderJob.js';

describe('reminder job', () => {
  it('schedules daily work with retry', async () => {
    const add = vi.fn().mockResolvedValue({ id: 'job-1' });
    await scheduleDailyReminder({ add } as unknown as Queue);

    expect(add).toHaveBeenCalledWith('scan-upcoming-tasks', {}, REMINDER_JOB_OPTIONS);
    expect(REMINDER_JOB_OPTIONS.repeat).toEqual(DAILY_REMINDER_REPEAT);
    expect(REMINDER_JOB_OPTIONS.attempts).toBe(3);
    expect(REMINDER_JOB_OPTIONS.backoff).toEqual({ type: 'exponential', delay: 1000 });
  });
});
