import express, { type NextFunction, type Request, type Response } from 'express';
import { MemoryCache, type CacheStore, type Logger } from './infra/cache.js';
import { createMemoryStore } from './repositories/memoryStore.js';
import { createAuthService } from './services/authService.js';
import { createProjectService } from './services/projectService.js';
import { createTaskService } from './services/taskService.js';
import type { PublicUser, Store, TaskStatus } from './types.js';

type AuthedRequest = Request & { user?: PublicUser | null };
export type AppOptions = { store?: Store; cache?: CacheStore; logger?: Logger };

function statusFor(error: Error): number {
  if (error.message === 'Chưa đăng nhập' || error.message === 'Token không hợp lệ') return 401;
  if (error.message === 'Không có quyền') return 403;
  if (
    error.message.includes('bắt buộc') ||
    error.message.includes('ký tự') ||
    error.message.includes('không hợp lệ') ||
    error.message.startsWith('Cursor') ||
    error.message.startsWith('Limit') ||
    error.message.startsWith('Sort') ||
    error.message.startsWith('Order') ||
    error.message.startsWith('Trạng thái')
  ) return 400;
  return 404;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Lỗi không xác định');
}

function queryValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function queryLimit(value: unknown): number | undefined {
  const raw = queryValue(value);
  if (raw === undefined) return undefined;
  const limit = Number(raw);
  if (!Number.isInteger(limit)) throw new Error('Limit không hợp lệ');
  return limit;
}

export function createRuntime(options: AppOptions = {}) {
  const store = options.store ?? createMemoryStore();
  const cache = options.cache ?? new MemoryCache();
  const logger = options.logger ?? console;
  const authService = createAuthService(store.users);
  const projectService = createProjectService(store.projects, cache, logger);
  const taskService = createTaskService(store.tasks, store.projects, cache, logger);
  const app = express();

  app.use(express.json());

  app.use((req: AuthedRequest, _res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        req.user = authService.authenticate(token);
      } catch {
        req.user = null;
      }
    }
    next();
  });

  app.post('/auth/register', (req: Request, res: Response) => {
    try {
      res.status(201).json(authService.register(req.body));
    } catch (error) {
      res.status(400).json({ error: asError(error).message });
    }
  });

  app.post('/auth/login', (req: Request, res: Response) => {
    try {
      res.json({ token: authService.login(req.body) });
    } catch (error) {
      res.status(401).json({ error: asError(error).message });
    }
  });

  app.post('/projects', async (req: AuthedRequest, res: Response) => {
    try {
      res.status(201).json(await projectService.createProject(req.user, req.body));
    } catch (error) {
      const err = asError(error);
      res.status(statusFor(err)).json({ error: err.message });
    }
  });

  app.get('/workspaces/:workspaceId/projects', async (req: AuthedRequest, res: Response) => {
    try {
      res.json(await projectService.listProjects(req.user, String(req.params.workspaceId)));
    } catch (error) {
      const err = asError(error);
      res.status(statusFor(err)).json({ error: err.message });
    }
  });

  app.post('/tasks', async (req: AuthedRequest, res: Response) => {
    try {
      res.status(201).json(await taskService.createTask(req.user, req.body));
    } catch (error) {
      const err = asError(error);
      res.status(statusFor(err)).json({ error: err.message });
    }
  });

  app.get('/projects/:projectId/tasks', (req: AuthedRequest, res: Response) => {
    try {
      const status = queryValue(req.query.status) as TaskStatus | undefined;
      res.json(
        taskService.listTasks(req.user, String(req.params.projectId), {
          cursor: queryValue(req.query.cursor),
          limit: queryLimit(req.query.limit),
          status,
          assigneeId: queryValue(req.query.assigneeId) ?? queryValue(req.query.assignee),
          sort: queryValue(req.query.sort) ?? queryValue(req.query.sortBy),
          order: queryValue(req.query.order)
        })
      );
    } catch (error) {
      const err = asError(error);
      res.status(statusFor(err)).json({ error: err.message });
    }
  });

  app.get('/workspaces/:workspaceId/stats', async (req: AuthedRequest, res: Response) => {
    try {
      res.json(await taskService.workspaceStats(req.user, String(req.params.workspaceId)));
    } catch (error) {
      const err = asError(error);
      res.status(statusFor(err)).json({ error: err.message });
    }
  });

  app.patch('/tasks/:taskId', async (req: AuthedRequest, res: Response) => {
    try {
      res.json(await taskService.updateTask(req.user, String(req.params.taskId), req.body));
    } catch (error) {
      const err = asError(error);
      res.status(statusFor(err)).json({ error: err.message });
    }
  });

  app.delete('/tasks/:taskId', async (req: AuthedRequest, res: Response) => {
    try {
      await taskService.deleteTask(req.user, String(req.params.taskId));
      res.status(204).end();
    } catch (error) {
      const err = asError(error);
      res.status(statusFor(err)).json({ error: err.message });
    }
  });

  return { app, store, cache };
}

export function createApp(options: AppOptions = {}) {
  return createRuntime(options).app;
}
