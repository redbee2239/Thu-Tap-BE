import crypto from 'node:crypto';
import type { Project, ProjectRepo, PublicUser } from '../types.js';

type CreateProjectInput = { name?: string };

export function createProjectService(projectRepo: ProjectRepo) {
  return {
    createProject(user: PublicUser | null | undefined, { name }: CreateProjectInput): Project {
      if (!user) throw new Error('Unauthorized');
      if (!name || name.trim().length < 3) throw new Error('Project name must be at least 3 characters');

      return projectRepo.create({
        id: crypto.randomUUID(),
        name: name.trim(),
        ownerId: user.id
      });
    }
  };
}