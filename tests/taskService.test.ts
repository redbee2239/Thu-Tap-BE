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

describe('dịch vụ task', () => {
  it.each<[TaskPriorityInput, number]>([
    [{ priority: 5, dueInDays: 0, blocked: true }, 120],
    [{ priority: 0, dueInDays: 30, blocked: false }, 10],
    [{ priority: 9, dueInDays: 10, blocked: false }, 70],
    [{ priority: 3, dueInDays: -1, blocked: false }, 80],
    [{ priority: 1, dueInDays: 31, blocked: false }, 10]
  ])('tính điểm ưu tiên cho trường hợp biên %#', (task, score) => {
    expect(calculateTaskPriorityScore(task)).toBe(score);
  });

  it('tạo công việc bằng kho dữ liệu giả', () => {
    const task = createTaskService(taskRepo(), projectRepo({ id: 'p1', name: 'Ví dụ', ownerId: 'u1' })).createTask(
      user,
      { projectId: 'p1', title: ' Viết test ', priority: 3, dueInDays: 5 }
    );

    expect(task).toMatchObject({ title: 'Viết test', projectId: 'p1' });
    expect(task.score).toBe(55);
  });

  it('từ chối dự án không tồn tại và VIEWER xóa công việc', () => {
    const service = createTaskService(taskRepo(), projectRepo(null));

    expect(() => service.createTask(user, { projectId: 'missing', title: 'Công việc' })).toThrow('Không tìm thấy dự án');
    expect(() => service.deleteTask({ id: 'u2', email: 'v@test.com', role: 'VIEWER' }, 't1')).toThrow('Không có quyền');
  });

  it('từ chối xem danh sách khi chưa đăng nhập và xóa công việc không tồn tại', () => {
    const service = createTaskService(taskRepo(), projectRepo({ id: 'p1', name: 'Ví dụ', ownerId: 'u1' }));

    expect(() => service.listTasks(null, 'p1')).toThrow('Chưa đăng nhập');
    expect(() => service.deleteTask(user, 'missing')).toThrow('Không tìm thấy công việc');
  });
});
