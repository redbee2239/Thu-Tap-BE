import crypto from 'node:crypto';
import { MemoryCache, type CacheStore, type Logger, workspaceStatsKey } from '../infra/cache.js';
import type { ProjectRepo, PublicUser, Task, TaskRepo, TaskStatus, TaskUpdate } from '../types.js';

export type TaskPriorityInput = { priority?: number; dueInDays?: number; blocked?: boolean };
export type TaskSort = 'createdAt' | 'dueAt' | 'dueInDays' | 'priority' | 'score' | 'title';
export type SortOrder = 'asc' | 'desc';

type CreateTaskInput = TaskPriorityInput & {
  projectId?: string;
  title?: string;
  status?: TaskStatus;
  assigneeId?: string | null;
  dueAt?: string | null;
};

export type ListTasksOptions = {
  cursor?: string;
  limit?: number;
  status?: TaskStatus;
  assigneeId?: string;
  sort?: string;
  order?: string;
};

type Cursor = {
  sort: TaskSort;
  order: SortOrder;
  value: string | number | null;
  id: string;
};

export function calculateTaskPriorityScore({ priority = 1, dueInDays = 30, blocked = false }: TaskPriorityInput): number {
  const clampedPriority = Math.min(Math.max(priority, 1), 5);
  const urgency = dueInDays <= 0 ? 50 : Math.max(0, 30 - dueInDays);
  return clampedPriority * 10 + urgency + (blocked ? 20 : 0);
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(value: string): Cursor {
  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString()) as Cursor;
    if (
      typeof cursor.id !== 'string' ||
      !['createdAt', 'dueAt', 'dueInDays', 'priority', 'score', 'title'].includes(cursor.sort) ||
      (cursor.order !== 'asc' && cursor.order !== 'desc') ||
      (typeof cursor.value !== 'string' && typeof cursor.value !== 'number' && cursor.value !== null)
    ) {
      throw new Error();
    }
    return cursor;
  } catch {
    throw new Error('Cursor không hợp lệ');
  }
}

function resolveSort(sortInput?: string, orderInput?: string): { sort: TaskSort; order: SortOrder } {
  const [rawSort, inlineOrder] = (sortInput || 'createdAt').split(':');
  if (!['createdAt', 'dueAt', 'dueInDays', 'priority', 'score', 'title'].includes(rawSort)) {
    throw new Error('Sort không hợp lệ');
  }

  const order = orderInput || inlineOrder || 'desc';
  if (order !== 'asc' && order !== 'desc') throw new Error('Order không hợp lệ');
  return { sort: rawSort as TaskSort, order };
}

function taskValue(task: Task, sort: TaskSort): string | number | null {
  if (sort === 'dueAt') return task.dueAt ? Date.parse(task.dueAt) : task.dueInDays;
  return task[sort];
}

function compareValues(left: string | number | null, right: string | number | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left < right ? -1 : 1;
}

function validateStatus(status: TaskStatus | undefined): void {
  if (status !== undefined && !['TODO', 'IN_PROGRESS', 'DONE'].includes(status)) {
    throw new Error('Trạng thái không hợp lệ');
  }
}

export function createTaskService(
  taskRepo: TaskRepo,
  projectRepo: ProjectRepo,
  cache: CacheStore = new MemoryCache(),
  logger: Logger = console
) {
  async function invalidateStats(projectId: string): Promise<void> {
    const project = projectRepo.findById(projectId);
    if (!project) return;
    const key = workspaceStatsKey(project.workspaceId);
    await cache.delete(key);
    logger.log(`[cache] invalidated ${key}`);
  }

  return {
    async createTask(
      user: PublicUser | null | undefined,
      { projectId, title, priority, dueInDays, blocked, status, assigneeId, dueAt }: CreateTaskInput = {}
    ): Promise<Task> {
      if (!user) throw new Error('Chưa đăng nhập');
      if (!projectId || !projectRepo.findById(projectId)) throw new Error('Không tìm thấy dự án');
      if (!title || title.trim().length < 3) throw new Error('Tên công việc phải có ít nhất 3 ký tự');
      validateStatus(status);

      const task: Task = {
        id: crypto.randomUUID(),
        projectId,
        title: title.trim(),
        priority: priority ?? 1,
        dueInDays: dueInDays ?? 30,
        blocked: Boolean(blocked),
        score: 0,
        status: status ?? 'TODO',
        assigneeId: assigneeId ?? null,
        dueAt: dueAt ?? null,
        createdAt: new Date().toISOString()
      };
      task.score = calculateTaskPriorityScore(task);
      const created = taskRepo.create(task);
      await invalidateStats(created.projectId);
      return created;
    },

    listTasks(user: PublicUser | null | undefined, projectId: string, options: ListTasksOptions = {}) {
      if (!user) throw new Error('Chưa đăng nhập');
      if (!projectRepo.findById(projectId)) throw new Error('Không tìm thấy dự án');
      validateStatus(options.status);

      const limit = options.limit === undefined ? 20 : Math.min(options.limit, 100);
      if (!Number.isInteger(limit) || limit < 1) throw new Error('Limit không hợp lệ');
      const { sort, order } = resolveSort(options.sort, options.order);
      const cursor = options.cursor ? decodeCursor(options.cursor) : null;
      if (cursor && (cursor.sort !== sort || cursor.order !== order)) throw new Error('Cursor không hợp lệ');

      const tasks = taskRepo.listByProject(projectId)
        .filter((task) => !options.status || task.status === options.status)
        .filter((task) => options.assigneeId === undefined || task.assigneeId === options.assigneeId);

      tasks.sort((left, right) => {
        const valueComparison = compareValues(taskValue(left, sort), taskValue(right, sort));
        const comparison = valueComparison || left.id.localeCompare(right.id);
        return order === 'asc' ? comparison : -comparison;
      });

      let start = 0;
      if (cursor) {
        const index = tasks.findIndex((task) => {
          const comparison = compareValues(taskValue(task, sort), cursor.value) || task.id.localeCompare(cursor.id);
          return order === 'asc' ? comparison > 0 : comparison < 0;
        });
        start = index === -1 ? tasks.length : index;
      }

      const page = tasks.slice(start, start + limit + 1);
      const hasNextPage = page.length > limit;
      const items = hasNextPage ? page.slice(0, limit) : page;
      const last = items.at(-1);
      const nextCursor = hasNextPage && last
        ? encodeCursor({ sort, order, value: taskValue(last, sort), id: last.id })
        : null;

      return {
        items,
        pagination: { limit, sort, order, hasNextPage, nextCursor }
      };
    },

    async updateTask(
      user: PublicUser | null | undefined,
      taskId: string,
      changes: CreateTaskInput = {}
    ): Promise<Task> {
      if (!user) throw new Error('Chưa đăng nhập');
      if (user.role === 'VIEWER') throw new Error('Không có quyền');

      const existing = taskRepo.findById(taskId);
      if (!existing) throw new Error('Không tìm thấy công việc');
      validateStatus(changes.status);
      if (changes.title !== undefined && changes.title.trim().length < 3) throw new Error('Tên công việc phải có ít nhất 3 ký tự');

      const data: TaskUpdate = {};
      if (changes.title !== undefined) data.title = changes.title.trim();
      if (changes.priority !== undefined) data.priority = changes.priority;
      if (changes.dueInDays !== undefined) data.dueInDays = changes.dueInDays;
      if (changes.blocked !== undefined) data.blocked = Boolean(changes.blocked);
      if (changes.status !== undefined) data.status = changes.status;
      if (changes.assigneeId !== undefined) data.assigneeId = changes.assigneeId;
      if (changes.dueAt !== undefined) data.dueAt = changes.dueAt;

      const updated = taskRepo.update(taskId, data);
      if (!updated) throw new Error('Không tìm thấy công việc');
      updated.score = calculateTaskPriorityScore(updated);
      await invalidateStats(updated.projectId);
      return updated;
    },

    async deleteTask(user: PublicUser | null | undefined, taskId: string): Promise<true> {
      if (!user) throw new Error('Chưa đăng nhập');
      if (user.role === 'VIEWER') throw new Error('Không có quyền');
      const task = taskRepo.findById(taskId);
      if (!task || !taskRepo.delete(taskId)) throw new Error('Không tìm thấy công việc');
      await invalidateStats(task.projectId);
      return true;
    },

    async workspaceStats(user: PublicUser | null | undefined, workspaceId: string) {
      if (!user) throw new Error('Chưa đăng nhập');
      if (!workspaceId) throw new Error('Workspace là bắt buộc');

      const key = workspaceStatsKey(workspaceId);
      const cached = await cache.get(key);
      if (cached) {
        logger.log(`[cache] hit ${key}`);
        try {
          return JSON.parse(cached) as { workspaceId: string; total: number; byStatus: Record<TaskStatus, number> };
        } catch {
          await cache.delete(key);
        }
      }

      logger.log(`[cache] miss ${key}`);
      const projectIds = projectRepo.listByWorkspace(workspaceId).map((project) => project.id);
      const byStatus: Record<TaskStatus, number> = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
      for (const task of taskRepo.listByProjects(projectIds)) byStatus[task.status] += 1;
      const stats = { workspaceId, total: Object.values(byStatus).reduce((sum, count) => sum + count, 0), byStatus };
      await cache.set(key, JSON.stringify(stats), 60);
      return stats;
    }
  };
}
