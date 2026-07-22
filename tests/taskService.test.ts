import { describe, expect, it, vi } from 'vitest';
import { calculateTaskPriorityScore, createTaskService, type TaskPriorityInput } from '../src/services/taskService.js';
import type { Project, ProjectRepo, PublicUser, Task, TaskRepo } from '../src/types.js';

const user: PublicUser = { id: 'u1', email: 'u@test.com', role: 'OWNER' };

function taskRepo(): TaskRepo {
  return {
    create: vi.fn((task: Task) => task),
    listByProject: vi.fn(() => []),
    findById: vi.fn(() => null),
    delete: vi.fn(() => false)
  };
}

function projectRepo(project: Project | null): ProjectRepo {
  return {
    create: vi.fn((newProject: Project) => newProject),
    findById: vi.fn(() => project)
  };
}

describe('taskService', () => {
  it.each<[TaskPriorityInput, number]>([
    [{ priority: 5, dueInDays: 0, blocked: true }, 120],
    [{ priority: 0, dueInDays: 30, blocked: false }, 10],
    [{ priority: 9, dueInDays: 10, blocked: false }, 70],
    [{ priority: 3, dueInDays: -1, blocked: false }, 80],
    [{ priority: 1, dueInDays: 31, blocked: false }, 10]
  ])('calculates priority score for edge case %#', (task, score) => {
    expect(calculateTaskPriorityScore(task)).toBe(score);
  });

  it('creates task with mocked repositories', () => {
    const task = createTaskService(taskRepo(), projectRepo({ id: 'p1', name: 'Demo', ownerId: 'u1' })).createTask(
      user,
      { projectId: 'p1', title: ' Write tests ', priority: 3, dueInDays: 5 }
    );

    expect(task).toMatchObject({ title: 'Write tests', projectId: 'p1' });
    expect(task.score).toBe(55);
  });

  it('rejects missing project and viewer delete', () => {
    const service = createTaskService(taskRepo(), projectRepo(null));

    expect(() => service.createTask(user, { projectId: 'missing', title: 'Task' })).toThrow('Project not found');
    expect(() => service.deleteTask({ id: 'u2', email: 'v@test.com', role: 'VIEWER' }, 't1')).toThrow('Forbidden');
  });

  it('rejects unauthorized listing and missing task deletion', () => {
    const service = createTaskService(taskRepo(), projectRepo({ id: 'p1', name: 'Demo', ownerId: 'u1' }));

    expect(() => service.listTasks(null, 'p1')).toThrow('Unauthorized');
    expect(() => service.deleteTask(user, 'missing')).toThrow('Task not found');
  });
});
