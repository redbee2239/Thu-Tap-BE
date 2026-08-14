const error = {
  description: 'Request failed',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
};

const id = (name: string, description: string) => ({ name, in: 'path', required: true, description, schema: { type: 'string' } });
const auth = [{ bearerAuth: [] }];

export const openapi = {
  openapi: '3.0.3',
  info: { title: 'TaskFlow API', version: '1.0.0', description: 'TaskFlow capstone API: workspaces, projects, tasks, RBAC and JWT.' },
  servers: [{ url: 'http://localhost:3000', description: 'Local development' }],
  tags: [{ name: 'System' }, { name: 'Auth' }, { name: 'Workspaces' }, { name: 'Projects' }, { name: 'Tasks' }],
  paths: {
    '/health': {
      get: { tags: ['System'], summary: 'Check PostgreSQL and Redis readiness', responses: { '200': { description: 'Ready' }, '503': error } }
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'], summary: 'Register a USER account for an admin to invite',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterInput' } } } },
        responses: { '201': { description: 'Registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } }, '400': error, '409': error }
      }
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Get access and refresh tokens',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginInput' } } } },
        responses: { '200': { description: 'Authenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } }, '401': error, '429': error }
      }
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth'], summary: 'Refresh access and refresh tokens',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshInput' } } } },
        responses: { '200': { description: 'Tokens renewed', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } }, '401': error }
      }
    },
    '/api/v1/me': {
      get: { tags: ['Auth'], summary: 'Get the authenticated user', security: auth, responses: { '200': { description: 'Current user' }, '401': error } },
      patch: {
        tags: ['Auth'], summary: 'Update display name or password', security: auth,
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountUpdateInput' } } } },
        responses: { '200': { description: 'Account updated' }, '400': error, '401': error, '403': error }
      }
    },
    '/api/v1/workspaces': {
      get: { tags: ['Workspaces'], summary: 'List workspaces where the user is a member', security: auth, responses: { '200': { description: 'Workspaces' }, '401': error } },
      post: {
        tags: ['Workspaces'], summary: 'Create a workspace with the requester as OWNER (ADMIN only)', security: auth,
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/WorkspaceInput' } } } },
        responses: { '201': { description: 'Workspace created' }, '400': error, '401': error }
      }
    },
    '/api/v1/workspaces/{workspaceId}': {
      patch: {
        tags: ['Workspaces'], summary: 'Rename a workspace (ADMIN OWNER only)', security: auth, parameters: [id('workspaceId', 'Workspace identifier')],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/WorkspaceInput' } } } },
        responses: { '200': { description: 'Renamed' }, '400': error, '403': error, '404': error }
      },
      delete: { tags: ['Workspaces'], summary: 'Delete a workspace (OWNER only)', security: auth, parameters: [id('workspaceId', 'Workspace identifier')], responses: { '204': { description: 'Deleted' }, '403': error, '404': error } }
    },
    '/api/v1/workspaces/{workspaceId}/members': {
      get: {
        tags: ['Workspaces'], summary: 'List assignable users (ADMIN OWNER only)', security: auth, parameters: [id('workspaceId', 'Workspace identifier')],
        responses: { '200': { description: 'Members' }, '403': error }
      },
      post: {
        tags: ['Workspaces'], summary: 'Add or update MEMBER/VIEWER membership (ADMIN OWNER only)', security: auth, parameters: [id('workspaceId', 'Workspace identifier')],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/MemberInput' } } } },
        responses: { '201': { description: 'Membership saved' }, '403': error, '404': error }
      }
    },
    '/api/v1/workspaces/{workspaceId}/projects': {
      get: { tags: ['Projects'], summary: 'List projects in a workspace', security: auth, parameters: [id('workspaceId', 'Workspace identifier')], responses: { '200': { description: 'Projects' }, '403': error } },
      post: {
        tags: ['Projects'], summary: 'Create a project (ADMIN OWNER only)', security: auth, parameters: [id('workspaceId', 'Workspace identifier')],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProjectInput' } } } },
        responses: { '201': { description: 'Project created' }, '403': error }
      }
    },
    '/api/v1/workspaces/{workspaceId}/stats': {
      get: { tags: ['Workspaces'], summary: 'Get cached task statistics', security: auth, parameters: [id('workspaceId', 'Workspace identifier')], responses: { '200': { description: 'Statistics' }, '403': error } }
    },
    '/api/v1/workspaces/{workspaceId}/completions': {
      get: { tags: ['Workspaces'], summary: 'List task completion history (ADMIN OWNER only)', security: auth, parameters: [id('workspaceId', 'Workspace identifier')], responses: { '200': { description: 'Completion history' }, '403': error } }
    },
    '/api/v1/projects/{projectId}/tasks': {
      get: {
        tags: ['Tasks'], summary: 'List tasks with cursor pagination, filters and sorting', security: auth, parameters: [
          id('projectId', 'Project identifier'),
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'] } },
          { name: 'assigneeId', in: 'query', schema: { type: 'string' } },
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['createdAt', 'dueDate', 'priority', 'score', 'title'] } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } }
        ],
        responses: { '200': { description: 'Task page', content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskPage' } } } }, '403': error }
      },
      post: {
        tags: ['Tasks'], summary: 'Create and assign a task to multiple users (ADMIN OWNER only)', security: auth, parameters: [id('projectId', 'Project identifier')],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskInput' } } } },
        responses: { '201': { description: 'Task created' }, '400': error, '403': error }
      }
    },
    '/api/v1/projects/{projectId}': {
      patch: {
        tags: ['Projects'], summary: 'Rename a project (ADMIN OWNER only)', security: auth, parameters: [id('projectId', 'Project identifier')],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProjectInput' } } } },
        responses: { '200': { description: 'Renamed' }, '400': error, '403': error, '404': error }
      },
      delete: { tags: ['Projects'], summary: 'Delete a project and its tasks (ADMIN OWNER only)', security: auth, parameters: [id('projectId', 'Project identifier')], responses: { '204': { description: 'Deleted' }, '403': error, '404': error } }
    },
    '/api/v1/tasks/{taskId}': {
      patch: {
        tags: ['Tasks'], summary: 'Update a task (ADMIN OWNER only)', security: auth, parameters: [id('taskId', 'Task identifier')],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskInput' } } } },
        responses: { '200': { description: 'Task updated' }, '400': error, '403': error, '404': error }
      },
      delete: { tags: ['Tasks'], summary: 'Delete a task (ADMIN OWNER only)', security: auth, parameters: [id('taskId', 'Task identifier')], responses: { '204': { description: 'Deleted' }, '403': error, '404': error } }
    },
    '/api/v1/tasks/{taskId}/complete': {
      post: { tags: ['Tasks'], summary: 'Confirm an assigned task is complete', security: auth, parameters: [id('taskId', 'Task identifier')], responses: { '200': { description: 'Completion recorded' }, '403': error, '404': error } }
    }
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      ErrorResponse: { type: 'object', properties: { error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} } } } },
      RegisterInput: { type: 'object', required: ['name', 'email', 'password', 'confirmPassword'], properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password', minLength: 8 }, confirmPassword: { type: 'string', format: 'password' } } },
      LoginInput: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' } } },
      RefreshInput: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } },
      AccountUpdateInput: { type: 'object', properties: { name: { type: 'string', minLength: 2 }, currentPassword: { type: 'string', format: 'password', minLength: 8 }, newPassword: { type: 'string', format: 'password', minLength: 8 }, confirmPassword: { type: 'string', format: 'password', minLength: 8 } } },
      AuthResponse: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' }, accessToken: { type: 'string' }, refreshToken: { type: 'string' } } },
      User: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string', format: 'email' }, role: { type: 'string', enum: ['ADMIN', 'USER'] }, createdAt: { type: 'string', format: 'date-time' } } },
      WorkspaceInput: { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 3 } } },
      MemberInput: { type: 'object', required: ['email', 'role'], properties: { email: { type: 'string', format: 'email' }, role: { type: 'string', enum: ['MEMBER', 'VIEWER'] } } },
      ProjectInput: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, description: { type: 'string' } } },
      TaskInput: { type: 'object', required: ['title', 'description', 'dueDate'], properties: { title: { type: 'string' }, description: { type: 'string', minLength: 1 }, status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'DONE'] }, priority: { type: 'integer', minimum: 1, maximum: 5 }, dueDate: { type: 'string', format: 'date' }, assigneeIds: { type: 'array', items: { type: 'string' } } } },
      TaskPage: { type: 'object', properties: { items: { type: 'array', items: { type: 'object' } }, pagination: { type: 'object', properties: { limit: { type: 'integer' }, hasNextPage: { type: 'boolean' }, nextCursor: { type: 'string', nullable: true } } } } }
    }
  }
} as const;
