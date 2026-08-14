import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import type { Logger } from 'pino';
import { MemoryCache, type CacheStore } from './cache.js';
import type { AuthSecrets } from './auth.js';
import type { Database } from './db.js';
import { BadRequestError, TooManyRequestsError } from './errors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authenticate, type AuthenticatedRequest } from './middleware/auth.js';
import { requestId } from './middleware/requestId.js';
import { validate } from './middleware/validate.js';
import { openapi } from './openapi.js';
import {
  idParamsSchema,
  accountUpdateSchema,
  loginSchema,
  memberSchema,
  projectParamsSchema,
  projectSchema,
  renameSchema,
  refreshSchema,
  registerSchema,
  taskParamsSchema,
  taskQuerySchema,
  taskSchema,
  taskUpdateSchema,
  workspaceParamsSchema,
  workspaceSchema
} from './schemas.js';
import { createServices } from './services.js';

export type RuntimeOptions = {
  database: Database;
  authSecrets: AuthSecrets;
  cache?: CacheStore;
  cacheName?: 'memory' | 'redis';
  logger: Logger;
  corsOrigin?: string;
  healthcheck?: () => Promise<void>;
};

type AsyncHandler = (req: Request, res: Response) => Promise<void> | void;

function route(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

function authRateLimit(limit = 10, windowMs = 60_000) {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const entry = attempts.get(key);
    if (!entry || entry.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (entry.count >= limit) {
      next(new TooManyRequestsError('Bạn đã thử quá nhiều lần, hãy chờ một phút'));
      return;
    }
    entry.count += 1;
    next();
  };
}

function userId(req: Request): string {
  return (req as AuthenticatedRequest).user.sub;
}

function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string') throw new BadRequestError('Tham số đường dẫn không hợp lệ');
  return value;
}

export function createRuntime(options: RuntimeOptions) {
  const cache = options.cache ?? new MemoryCache();
  const services = createServices(options.database, cache, options.authSecrets, options.logger);
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: options.corsOrigin ?? false }));
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(requestId);
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      options.logger.info({
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt
      }, 'HTTP request completed');
    });
    next();
  });
  app.use(express.json({ limit: '20kb' }));

  app.get('/health', route(async (_req, res) => {
    await options.healthcheck?.();
    res.json({ status: 'ok', database: 'postgresql', cache: options.cacheName ?? 'memory', time: new Date().toISOString() });
  }));
  app.get('/openapi.json', (_req, res) => res.json(openapi));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

  const api = express.Router();
  const loginLimit = authRateLimit();
  api.post('/auth/register', loginLimit, validate(registerSchema), route(async (req, res) => {
    res.status(201).json(await services.register(req.body));
  }));
  api.post('/auth/login', loginLimit, validate(loginSchema), route(async (req, res) => {
    res.json(await services.login(req.body.email, req.body.password));
  }));
  api.post('/auth/refresh', validate(refreshSchema), route(async (req, res) => {
    res.json(await services.refresh(req.body.refreshToken));
  }));

  api.use(authenticate(options.authSecrets));

  api.get('/me', route(async (req, res) => {
    res.json({ user: await services.me(userId(req)) });
  }));
  api.patch('/me', validate(accountUpdateSchema), route(async (req, res) => {
    res.json({ user: await services.updateMe(userId(req), req.body) });
  }));

  api.get('/workspaces', route(async (req, res) => {
    res.json({ workspaces: await services.listWorkspaces(userId(req)) });
  }));
  api.post('/workspaces', validate(workspaceSchema), route(async (req, res) => {
    res.status(201).json({ workspace: await services.createWorkspace(userId(req), req.body) });
  }));
  api.post('/workspaces/:workspaceId/members', validate(workspaceParamsSchema, 'params'), validate(memberSchema), route(async (req, res) => {
    res.status(201).json({ membership: await services.addMember(userId(req), routeParam(req, 'workspaceId'), req.body) });
  }));
  api.get('/workspaces/:workspaceId/members', validate(workspaceParamsSchema, 'params'), route(async (req, res) => {
    res.json({ members: await services.listMembers(userId(req), routeParam(req, 'workspaceId')) });
  }));
  api.delete('/workspaces/:workspaceId', validate(workspaceParamsSchema, 'params'), route(async (req, res) => {
    await services.deleteWorkspace(userId(req), routeParam(req, 'workspaceId'));
    res.status(204).end();
  }));
  api.patch('/workspaces/:workspaceId', validate(workspaceParamsSchema, 'params'), validate(renameSchema), route(async (req, res) => {
    res.json({ workspace: await services.updateWorkspace(userId(req), routeParam(req, 'workspaceId'), req.body) });
  }));

  api.get('/workspaces/:workspaceId/projects', validate(workspaceParamsSchema, 'params'), route(async (req, res) => {
    res.json({ projects: await services.listProjects(userId(req), routeParam(req, 'workspaceId')) });
  }));
  api.post('/workspaces/:workspaceId/projects', validate(workspaceParamsSchema, 'params'), validate(projectSchema), route(async (req, res) => {
    res.status(201).json({ project: await services.createProject(userId(req), routeParam(req, 'workspaceId'), req.body) });
  }));
  api.delete('/projects/:projectId', validate(projectParamsSchema, 'params'), route(async (req, res) => {
    await services.deleteProject(userId(req), routeParam(req, 'projectId'));
    res.status(204).end();
  }));
  api.patch('/projects/:projectId', validate(projectParamsSchema, 'params'), validate(renameSchema), route(async (req, res) => {
    res.json({ project: await services.updateProject(userId(req), routeParam(req, 'projectId'), req.body) });
  }));

  api.get('/projects/:projectId/tasks', validate(projectParamsSchema, 'params'), validate(taskQuerySchema, 'query'), route(async (req, res) => {
    res.json(await services.listTasks(userId(req), routeParam(req, 'projectId'), res.locals.validatedQuery as never));
  }));
  api.post('/projects/:projectId/tasks', validate(projectParamsSchema, 'params'), validate(taskSchema), route(async (req, res) => {
    res.status(201).json({ task: await services.createTask(userId(req), routeParam(req, 'projectId'), req.body) });
  }));
  api.post('/tasks/:taskId/complete', validate(taskParamsSchema, 'params'), route(async (req, res) => {
    res.json(await services.completeTask(userId(req), routeParam(req, 'taskId')));
  }));
  api.patch('/tasks/:taskId', validate(taskParamsSchema, 'params'), validate(taskUpdateSchema), route(async (req, res) => {
    res.json({ task: await services.updateTask(userId(req), routeParam(req, 'taskId'), req.body) });
  }));
  api.delete('/tasks/:taskId', validate(taskParamsSchema, 'params'), route(async (req, res) => {
    await services.deleteTask(userId(req), routeParam(req, 'taskId'));
    res.status(204).end();
  }));
  api.get('/workspaces/:workspaceId/stats', validate(workspaceParamsSchema, 'params'), route(async (req, res) => {
    res.json({ stats: await services.workspaceStats(userId(req), routeParam(req, 'workspaceId')) });
  }));
  api.get('/workspaces/:workspaceId/completions', validate(workspaceParamsSchema, 'params'), route(async (req, res) => {
    res.json({ completions: await services.listCompletions(userId(req), routeParam(req, 'workspaceId')) });
  }));

  app.use('/api/v1', api);
  app.use('/api', api);
  app.use(express.static('public'));
  app.use(errorHandler);

  return { app, services };
}
