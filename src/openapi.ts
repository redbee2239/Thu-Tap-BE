const errorResponse = {
  description: 'Request failed',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
};

const idParameter = (name: string, description: string) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string' }
});

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'TaskFlow API',
    version: '1.0.0',
    description: 'Task and project management API.'
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local Docker stack' }],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'System' },
    { name: 'Auth' },
    { name: 'Projects' },
    { name: 'Tasks' },
    { name: 'Workspaces' }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Check PostgreSQL and Redis readiness',
        security: [],
        responses: {
          '200': { description: 'Dependencies are ready', content: { 'application/json': { schema: { $ref: '#/components/schemas/Health' } } } },
          '503': { description: 'A dependency is unavailable', content: { 'application/json': { schema: { $ref: '#/components/schemas/Health' } } } }
        }
      }
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a user',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterInput' } } }
        },
        responses: {
          '201': { description: 'User created', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
          '400': errorResponse
        }
      }
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Get a bearer token',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginInput' } } }
        },
        responses: {
          '200': { description: 'Authenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Token' } } } },
          '401': errorResponse
        }
      }
    },
    '/projects': {
      post: {
        tags: ['Projects'],
        summary: 'Create a project',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateProjectInput' } } }
        },
        responses: {
          '201': { description: 'Project created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Project' } } } },
          '400': errorResponse,
          '401': errorResponse
        }
      }
    },
    '/workspaces/{workspaceId}/projects': {
      get: {
        tags: ['Workspaces', 'Projects'],
        summary: 'List workspace projects',
        parameters: [idParameter('workspaceId', 'Workspace identifier')],
        responses: {
          '200': { description: 'Projects', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Project' } } } } },
          '401': errorResponse
        }
      }
    },
    '/tasks': {
      post: {
        tags: ['Tasks'],
        summary: 'Create a task',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTaskInput' } } }
        },
        responses: {
          '201': { description: 'Task created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } },
          '400': errorResponse,
          '401': errorResponse,
          '404': errorResponse
        }
      }
    },
    '/projects/{projectId}/tasks': {
      get: {
        tags: ['Projects', 'Tasks'],
        summary: 'List tasks with cursor pagination',
        parameters: [
          idParameter('projectId', 'Project identifier'),
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/TaskStatus' } },
          { name: 'assigneeId', in: 'query', schema: { type: 'string' } },
          { name: 'sort', in: 'query', description: 'field[:asc|desc]', schema: { type: 'string', default: 'createdAt:desc' } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } }
        ],
        responses: {
          '200': { description: 'Task page', content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskPage' } } } },
          '400': errorResponse,
          '401': errorResponse,
          '404': errorResponse
        }
      }
    },
    '/workspaces/{workspaceId}/stats': {
      get: {
        tags: ['Workspaces'],
        summary: 'Get cached workspace task statistics',
        parameters: [idParameter('workspaceId', 'Workspace identifier')],
        responses: {
          '200': { description: 'Task statistics', content: { 'application/json': { schema: { $ref: '#/components/schemas/WorkspaceStats' } } } },
          '401': errorResponse
        }
      }
    },
    '/tasks/{taskId}': {
      patch: {
        tags: ['Tasks'],
        summary: 'Update a task',
        parameters: [idParameter('taskId', 'Task identifier')],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateTaskInput' } } }
        },
        responses: {
          '200': { description: 'Task updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } },
          '400': errorResponse,
          '401': errorResponse,
          '403': errorResponse,
          '404': errorResponse
        }
      },
      delete: {
        tags: ['Tasks'],
        summary: 'Delete a task',
        parameters: [idParameter('taskId', 'Task identifier')],
        responses: {
          '204': { description: 'Task deleted' },
          '401': errorResponse,
          '403': errorResponse,
          '404': errorResponse
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'HMAC token' }
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: { error: { type: 'string', example: 'Chưa đăng nhập' } }
      },
      Health: {
        type: 'object',
        required: ['status'],
        properties: { status: { type: 'string', enum: ['ok', 'error'] } }
      },
      User: {
        type: 'object',
        required: ['id', 'email', 'role'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['OWNER', 'VIEWER'] }
        }
      },
      Token: {
        type: 'object',
        required: ['token'],
        properties: { token: { type: 'string' } }
      },
      RegisterInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password', minLength: 1 },
          role: { type: 'string', enum: ['OWNER', 'VIEWER'], default: 'OWNER' }
        }
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password' }
        }
      },
      CreateProjectInput: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 3 },
          workspaceId: { type: 'string', description: 'Defaults to the authenticated user id' }
        }
      },
      Project: {
        type: 'object',
        required: ['id', 'name', 'ownerId', 'workspaceId'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          ownerId: { type: 'string', format: 'uuid' },
          workspaceId: { type: 'string' }
        }
      },
      TaskStatus: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'] },
      CreateTaskInput: {
        type: 'object',
        required: ['projectId', 'title'],
        properties: {
          projectId: { type: 'string', format: 'uuid' },
          title: { type: 'string', minLength: 3 },
          priority: { type: 'integer', minimum: 1, maximum: 5, default: 1 },
          dueInDays: { type: 'integer', default: 30 },
          blocked: { type: 'boolean', default: false },
          status: { $ref: '#/components/schemas/TaskStatus' },
          assigneeId: { type: 'string', nullable: true },
          dueAt: { type: 'string', format: 'date-time', nullable: true }
        }
      },
      UpdateTaskInput: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 3 },
          priority: { type: 'integer', minimum: 1, maximum: 5 },
          dueInDays: { type: 'integer' },
          blocked: { type: 'boolean' },
          status: { $ref: '#/components/schemas/TaskStatus' },
          assigneeId: { type: 'string', nullable: true },
          dueAt: { type: 'string', format: 'date-time', nullable: true }
        }
      },
      Task: {
        type: 'object',
        required: ['id', 'projectId', 'title', 'priority', 'dueInDays', 'blocked', 'score', 'status', 'assigneeId', 'dueAt', 'createdAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          projectId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          priority: { type: 'integer' },
          dueInDays: { type: 'integer' },
          blocked: { type: 'boolean' },
          score: { type: 'number' },
          status: { $ref: '#/components/schemas/TaskStatus' },
          assigneeId: { type: 'string', nullable: true },
          dueAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      TaskPage: {
        type: 'object',
        required: ['items', 'pagination'],
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
          pagination: {
            type: 'object',
            required: ['limit', 'sort', 'order', 'hasNextPage', 'nextCursor'],
            properties: {
              limit: { type: 'integer' },
              sort: { type: 'string' },
              order: { type: 'string', enum: ['asc', 'desc'] },
              hasNextPage: { type: 'boolean' },
              nextCursor: { type: 'string', nullable: true }
            }
          }
        }
      },
      WorkspaceStats: {
        type: 'object',
        required: ['workspaceId', 'total', 'byStatus'],
        properties: {
          workspaceId: { type: 'string' },
          total: { type: 'integer' },
          byStatus: {
            type: 'object',
            required: ['TODO', 'IN_PROGRESS', 'DONE'],
            properties: {
              TODO: { type: 'integer' },
              IN_PROGRESS: { type: 'integer' },
              DONE: { type: 'integer' }
            }
          }
        }
      }
    }
  }
};
