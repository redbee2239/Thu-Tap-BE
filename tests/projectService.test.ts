import { describe, expect, it, vi } from 'vitest';
import { createProjectService } from '../src/services/projectService.js';
import type { Project, ProjectRepo, PublicUser } from '../src/types.js';

const user: PublicUser = { id: 'u1', email: 'u@test.com', role: 'OWNER' };

function projectRepo(): ProjectRepo {
  return {
    create: vi.fn((project: Project) => project),
    findById: vi.fn(() => null)
  };
}

describe('dịch vụ dự án', () => {
  it('tạo dự án cho người dùng đã đăng nhập', () => {
    const repo = projectRepo();

    const project = createProjectService(repo).createProject(user, { name: ' Ví dụ ' });

    expect(project).toMatchObject({ name: 'Ví dụ', ownerId: 'u1' });
  });

  it('từ chối khi chưa đăng nhập', () => {
    expect(() => createProjectService(projectRepo()).createProject(null, { name: 'Demo' })).toThrow('Chưa đăng nhập');
  });

  it('từ chối tên dự án quá ngắn', () => {
    expect(() => createProjectService(projectRepo()).createProject(user, { name: 'x' })).toThrow('Tên dự án');
  });
});
