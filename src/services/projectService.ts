import crypto from 'node:crypto';
import { MemoryCache, type CacheStore, type Logger, workspaceProjectsKey, workspaceStatsKey } from '../infra/cache.js';
import type { Project, ProjectRepo, PublicUser } from '../types.js';

type CreateProjectInput = { name?: string; workspaceId?: string };

export function createProjectService(projectRepo: ProjectRepo, cache: CacheStore = new MemoryCache(), logger: Logger = console) {
  return {
    async createProject(user: PublicUser | null | undefined, { name, workspaceId }: CreateProjectInput = {}): Promise<Project> {
      if (!user) throw new Error('Chưa đăng nhập');
      if (!name || name.trim().length < 3) throw new Error('Tên dự án phải có ít nhất 3 ký tự');

      const project = projectRepo.create({
        id: crypto.randomUUID(),
        name: name.trim(),
        ownerId: user.id,
        workspaceId: workspaceId?.trim() || user.id
      });

      await cache.delete(workspaceProjectsKey(project.workspaceId));
      await cache.delete(workspaceStatsKey(project.workspaceId));
      logger.log(`[cache] invalidated ${workspaceProjectsKey(project.workspaceId)}`);
      return project;
    },

    async listProjects(user: PublicUser | null | undefined, workspaceId: string): Promise<Project[]> {
      if (!user) throw new Error('Chưa đăng nhập');
      if (!workspaceId) throw new Error('Workspace là bắt buộc');

      const key = workspaceProjectsKey(workspaceId);
      const cached = await cache.get(key);
      if (cached) {
        logger.log(`[cache] hit ${key}`);
        try {
          return JSON.parse(cached) as Project[];
        } catch {
          await cache.delete(key);
        }
      }

      logger.log(`[cache] miss ${key}`);
      const projects = projectRepo.listByWorkspace(workspaceId);
      await cache.set(key, JSON.stringify(projects), 60);
      return projects;
    }
  };
}
