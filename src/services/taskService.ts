import crypto from 'node:crypto';
import type { ProjectRepo, PublicUser, Task, TaskRepo } from '../types.js';

export type TaskPriorityInput = { priority?: number; dueInDays?: number; blocked?: boolean };
type CreateTaskInput = TaskPriorityInput & { projectId?: string; title?: string };

export function calculateTaskPriorityScore({ priority = 1, dueInDays = 30, blocked = false }: TaskPriorityInput): number {
  const clampedPriority = Math.min(Math.max(priority, 1), 5);
  const urgency = dueInDays <= 0 ? 50 : Math.max(0, 30 - dueInDays);
  return clampedPriority * 10 + urgency + (blocked ? 20 : 0);
}

export function createTaskService(taskRepo: TaskRepo, projectRepo: ProjectRepo) {
  return {
    createTask(user: PublicUser | null | undefined, { projectId, title, priority, dueInDays, blocked }: CreateTaskInput): Task {
      if (!user) throw new Error('Unauthorized');
      if (!projectId || !projectRepo.findById(projectId)) throw new Error('Project not found');
      if (!title || title.trim().length < 3) throw new Error('Task title must be at least 3 characters');

      const task: Task = {
        id: crypto.randomUUID(),
        projectId,
        title: title.trim(),
        priority: priority ?? 1,
        dueInDays: dueInDays ?? 30,
        blocked: Boolean(blocked),
        score: 0
      };
      task.score = calculateTaskPriorityScore(task);
      return taskRepo.create(task);
    },

    listTasks(user: PublicUser | null | undefined, projectId: string): Task[] {
      if (!user) throw new Error('Unauthorized');
      return taskRepo.listByProject(projectId);
    },

    deleteTask(user: PublicUser | null | undefined, taskId: string): true {
      if (!user) throw new Error('Unauthorized');
      if (user.role === 'VIEWER') throw new Error('Forbidden');
      if (!taskRepo.delete(taskId)) throw new Error('Task not found');
      return true;
    }
  };
}