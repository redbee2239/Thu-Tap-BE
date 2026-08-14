import { describe, expect, it } from 'vitest';
import { createTaskService, calculateTaskPriorityScore } from '../src/services/taskService.js';
import { MemoryCache } from '../src/infra/cache.js';
import { createMemoryStore } from '../src/repositories/memoryStore.js';
import type { PublicUser } from '../src/types.js';

const user: PublicUser = { id: 'u1', email: 'u@test.com', role: 'OWNER' };

describe('task service', () => {
  it('keeps the priority-score calculation', () => {
    expect(calculateTaskPriorityScore({ priority: 5, dueInDays: 0, blocked: true })).toBe(120);
  });

  it('returns stable cursor pages when sort values match', async () => {
    const store = createMemoryStore();
    store.projects.create({ id: 'p1', name: 'Demo', ownerId: 'u1', workspaceId: 'w1' });
    const service = createTaskService(store.tasks, store.projects, new MemoryCache());
    await service.createTask(user, { projectId: 'p1', title: 'One' });
    await service.createTask(user, { projectId: 'p1', title: 'Two' });

    const first = service.listTasks(user, 'p1', { limit: 1, sort: 'priority:asc' });
    const second = service.listTasks(user, 'p1', {
      limit: 1,
      sort: 'priority:asc',
      cursor: first.pagination.nextCursor ?? undefined
    });
    expect(first.items).toHaveLength(1);
    expect(second.items).toHaveLength(1);
    expect(second.items[0].id).not.toBe(first.items[0].id);
  });
});
