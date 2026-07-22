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

describe('projectService', () => {
  it('creates project for an authenticated user', () => {
    const repo = projectRepo();

    const project = createProjectService(repo).createProject(user, { name: ' Demo ' });

    expect(project).toMatchObject({ name: 'Demo', ownerId: 'u1' });
  });

  it('rejects missing user', () => {
    expect(() => createProjectService(projectRepo()).createProject(null, { name: 'Demo' })).toThrow('Unauthorized');
  });

  it('rejects short project name', () => {
    expect(() => createProjectService(projectRepo()).createProject(user, { name: 'x' })).toThrow('Project name');
  });
});