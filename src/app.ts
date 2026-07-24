import express, { type NextFunction, type Request, type Response } from 'express';
import { createMemoryStore } from './repositories/memoryStore.js';
import { createAuthService } from './services/authService.js';
import { createProjectService } from './services/projectService.js';
import { createTaskService } from './services/taskService.js';
import type { PublicUser } from './types.js';

type AuthedRequest = Request & { user?: PublicUser | null };

function statusFor(error: Error): number {
  if (error.message === 'Chưa đăng nhập' || error.message === 'Token không hợp lệ') return 401;
  if (error.message === 'Không có quyền') return 403;
  if (error.message.includes('bắt buộc') || error.message.includes('ký tự')) return 400;
  return 404;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Lỗi không xác định');
}

export function createApp() {
  const store = createMemoryStore();
  const authService = createAuthService(store.users);
  const projectService = createProjectService(store.projects);
  const taskService = createTaskService(store.tasks, store.projects);
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

  app.post('/projects', (req: AuthedRequest, res: Response) => {
    try {
      res.status(201).json(projectService.createProject(req.user, req.body));
    } catch (error) {
      const err = asError(error);
      res.status(statusFor(err)).json({ error: err.message });
    }
  });

  app.post('/tasks', (req: AuthedRequest, res: Response) => {
    try {
      res.status(201).json(taskService.createTask(req.user, req.body));
    } catch (error) {
      const err = asError(error);
      res.status(statusFor(err)).json({ error: err.message });
    }
  });

  app.get('/projects/:projectId/tasks', (req: AuthedRequest, res: Response) => {
    try {
      res.json(taskService.listTasks(req.user, String(req.params.projectId)));
    } catch (error) {
      const err = asError(error);
      res.status(statusFor(err)).json({ error: err.message });
    }
  });

  app.delete('/tasks/:taskId', (req: AuthedRequest, res: Response) => {
    try {
      taskService.deleteTask(req.user, String(req.params.taskId));
      res.status(204).end();
    } catch (error) {
      const err = asError(error);
      res.status(statusFor(err)).json({ error: err.message });
    }
  });

  return app;
}
