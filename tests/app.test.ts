import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import pino from 'pino';
import { createRuntime } from '../src/app.js';
import { MemoryCache } from '../src/cache.js';
import { createDatabase } from '../src/db.js';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const secrets = {
  jwtSecret: 'test-access-secret-must-be-at-least-thirty-two-characters',
  jwtRefreshSecret: 'test-refresh-secret-must-be-at-least-thirty-two-characters'
};

test('giao diện tham chiếu đúng các file public', async () => {
  const page = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(page, /TaskFlow/);
  assert.match(page, /app\.css/);
  assert.match(page, /app\.js/);
  assert.match(page, /accountDialog/);
  assert.match(page, /accountButton/);
  assert.match(page, /renameDialog/);
  assert.match(page, /taskEditDialog/);
  assert.match(page, /taskEditAssigneeSearch/);
  assert.match(page, /assigneeSearch/);
  assert.match(script, /enhanceSelects/);
});

test('API v1 và API cũ dùng cùng router', async (t) => {
  const runtime = createRuntime({
    database: { prisma: {} } as never,
    cache: new MemoryCache(),
    authSecrets: secrets,
    corsOrigin: 'https://frontend.test',
    logger: pino({ enabled: false })
  });
  const server = runtime.app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  t.after(async () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));

  const health = await fetch(`http://127.0.0.1:${address.port}/health`);
  assert.equal((await health.json()).cache, 'memory');

  for (const path of ['/api/auth/register', '/api/v1/auth/register']) {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://frontend.test' }, body: '{}'
    });
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://frontend.test');
  }
});

test('luồng PostgreSQL: auth, RBAC, cursor pagination và refresh token', { skip: !databaseUrl }, async (t) => {
  const database = createDatabase(databaseUrl!);
  await database.connect();
  await database.prisma.task.deleteMany();
  await database.prisma.project.deleteMany();
  await database.prisma.membership.deleteMany();
  await database.prisma.workspace.deleteMany();
  await database.prisma.user.deleteMany();

  const runtime = createRuntime({
    database,
    cache: new MemoryCache(),
    authSecrets: secrets,
    logger: pino({ enabled: false })
  });
  const server = runtime.app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  const request = async (path: string, options: RequestInit = {}) => {
    const versionedPath = path.startsWith('/api/') ? path.replace('/api/', '/api/v1/') : path;
    const response = await fetch(`http://127.0.0.1:${address.port}${versionedPath}`, options);
    return { response, body: await response.clone().json().catch(() => null) };
  };
  const post = (path: string, body: unknown, token?: string) => request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  });
  const patch = (path: string, body: unknown, token: string) => request(path, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body)
  });

  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await database.disconnect();
  });

  const alice = await post('/api/auth/register', {
    name: 'Alice Nguyen', email: 'alice@example.com', password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery'
  });
  assert.equal(alice.response.status, 201);
  assert.ok(alice.body.accessToken);
  assert.ok(alice.body.refreshToken);

  const mismatched = await post('/api/auth/register', {
    name: 'Wrong Password', email: 'wrong@example.com', password: 'correct-horse-battery', confirmPassword: 'different-password'
  });
  assert.equal(mismatched.response.status, 400);
  assert.equal(mismatched.body.error.code, 'VALIDATION_ERROR');

  const refreshed = await post('/api/auth/refresh', { refreshToken: alice.body.refreshToken });
  assert.equal(refreshed.response.status, 200);
  const aliceToken = refreshed.body.accessToken as string;
  const aliceHeaders = { Authorization: `Bearer ${aliceToken}` };
  const renamedAccount = await patch('/api/me', { name: 'Alice Updated' }, aliceToken);
  assert.equal(renamedAccount.response.status, 200);
  assert.equal(renamedAccount.body.user.name, 'Alice Updated');
  const wrongCurrentPassword = await patch('/api/me', {
    currentPassword: 'incorrect-password', newPassword: 'new-correct-password', confirmPassword: 'new-correct-password'
  }, aliceToken);
  assert.equal(wrongCurrentPassword.response.status, 403);
  const changedPassword = await patch('/api/me', {
    name: 'Alice Updated', currentPassword: 'correct-horse-battery', newPassword: 'new-correct-password', confirmPassword: 'new-correct-password'
  }, aliceToken);
  assert.equal(changedPassword.response.status, 200);
  const oldPasswordLogin = await post('/api/auth/login', { email: 'alice@example.com', password: 'correct-horse-battery' });
  assert.equal(oldPasswordLogin.response.status, 401);
  const newPasswordLogin = await post('/api/auth/login', { email: 'alice@example.com', password: 'new-correct-password' });
  assert.equal(newPasswordLogin.response.status, 200);

  await database.prisma.user.update({ where: { id: alice.body.user.id }, data: { role: 'ADMIN' } });
  const createdWorkspace = await post('/api/workspaces', { name: 'Admin workspace' }, aliceToken);
  assert.equal(createdWorkspace.response.status, 201);

  const workspaces = await request('/api/workspaces', { headers: aliceHeaders });
  assert.equal(workspaces.response.status, 200);
  const workspaceId = workspaces.body.workspaces[0].id as string;
  assert.equal(workspaces.body.workspaces[0].role, 'OWNER');
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const cannotDemoteOwner = await post(`/api/workspaces/${workspaceId}/members`, { email: 'alice@example.com', role: 'VIEWER' }, aliceToken);
  assert.equal(cannotDemoteOwner.response.status, 409);
  const ownerAfterRepeatAdd = await request('/api/workspaces', { headers: aliceHeaders });
  assert.equal(ownerAfterRepeatAdd.body.workspaces[0].role, 'OWNER');
  const renamedWorkspace = await patch(`/api/workspaces/${workspaceId}`, { name: 'Workspace moi' }, aliceToken);
  assert.equal(renamedWorkspace.response.status, 200);
  assert.equal(renamedWorkspace.body.workspace.name, 'Workspace moi');

  const projects = await request(`/api/workspaces/${workspaceId}/projects`, { headers: aliceHeaders });
  const projectId = projects.body.projects[0].id as string;
  const renamedProject = await patch(`/api/projects/${projectId}`, { name: 'Du an moi' }, aliceToken);
  assert.equal(renamedProject.response.status, 200);
  assert.equal(renamedProject.body.project.name, 'Du an moi');
  const firstTask = await post(`/api/projects/${projectId}/tasks`, { title: 'Viết API', description: 'Hoàn thiện API', dueDate: today, priority: 5 }, aliceToken);
  const secondTask = await post(`/api/projects/${projectId}/tasks`, { title: 'Viết test', description: 'Viết test API', dueDate: tomorrow, priority: 3 }, aliceToken);
  assert.equal(firstTask.response.status, 201);
  assert.equal(firstTask.body.task.overdue, true);
  assert.equal(secondTask.response.status, 201);

  const firstPage = await request(`/api/projects/${projectId}/tasks?limit=1&sort=createdAt&order=desc`, { headers: aliceHeaders });
  assert.equal(firstPage.response.status, 200);
  assert.equal(firstPage.body.items.length, 1);
  assert.equal(firstPage.body.pagination.hasNextPage, true);
  const nextPage = await request(`/api/projects/${projectId}/tasks?limit=1&sort=createdAt&order=desc&cursor=${encodeURIComponent(firstPage.body.pagination.nextCursor)}`, { headers: aliceHeaders });
  assert.equal(nextPage.response.status, 200);
  assert.equal(nextPage.body.items.length, 1);

  const bob = await post('/api/auth/register', {
    name: 'Bob Tran', email: 'bob@example.com', password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery'
  });
  const bobHeaders = { Authorization: `Bearer ${bob.body.accessToken}` };
  const charlie = await post('/api/auth/register', {
    name: 'Charlie Tran', email: 'charlie@example.com', password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery'
  });
  const charlieHeaders = { Authorization: `Bearer ${charlie.body.accessToken}` };
  const noAccess = await request(`/api/workspaces/${workspaceId}/projects`, { headers: bobHeaders });
  assert.equal(noAccess.response.status, 403);

  const member = await post(`/api/workspaces/${workspaceId}/members`, { email: 'bob@example.com', role: 'VIEWER' }, aliceToken);
  assert.equal(member.response.status, 201);
  const secondMember = await post(`/api/workspaces/${workspaceId}/members`, { email: 'charlie@example.com', role: 'VIEWER' }, aliceToken);
  assert.equal(secondMember.response.status, 201);
  const members = await request(`/api/workspaces/${workspaceId}/members`, { headers: aliceHeaders });
  assert.equal(members.response.status, 200);
  assert.equal(members.body.members.find((item: { email: string }) => item.email === 'bob@example.com').role, 'USER');
  const assignedTask = await post(`/api/projects/${projectId}/tasks`, { title: 'Giao cho Bob va Charlie', description: 'Cùng xử lý task', dueDate: tomorrow, assigneeIds: [bob.body.user.id, charlie.body.user.id] }, aliceToken);
  assert.equal(assignedTask.response.status, 201);
  assert.equal(assignedTask.body.task.assignees.length, 2);
  const canRead = await request(`/api/projects/${projectId}/tasks`, { headers: bobHeaders });
  assert.equal(canRead.response.status, 200);
  assert.equal(canRead.body.items.length, 1);
  assert.ok(canRead.body.items[0].assignees.some((assignee: { id: string }) => assignee.id === bob.body.user.id));
  const charlieCanRead = await request(`/api/projects/${projectId}/tasks`, { headers: charlieHeaders });
  assert.equal(charlieCanRead.body.items.length, 1);
  const cannotCompleteOther = await post(`/api/tasks/${firstTask.body.task.id}/complete`, {}, bob.body.accessToken);
  assert.equal(cannotCompleteOther.response.status, 403);
  const completed = await post(`/api/tasks/${assignedTask.body.task.id}/complete`, {}, bob.body.accessToken);
  assert.equal(completed.response.status, 200);
  assert.equal(completed.body.completion.confirmedBy.email, 'bob@example.com');
  const activeTasks = await request(`/api/projects/${projectId}/tasks`, { headers: bobHeaders });
  assert.equal(activeTasks.body.items.length, 0);
  const charlieActiveTasks = await request(`/api/projects/${projectId}/tasks`, { headers: charlieHeaders });
  assert.equal(charlieActiveTasks.body.items.length, 0);
  const doneTask = await request(`/api/projects/${projectId}/tasks?status=DONE`, { headers: bobHeaders });
  assert.equal(doneTask.body.items[0].status, 'DONE');
  const history = await request(`/api/workspaces/${workspaceId}/completions`, { headers: aliceHeaders });
  assert.equal(history.response.status, 200);
  assert.equal(history.body.completions[0].confirmedBy.email, 'bob@example.com');
  const editedTask = await patch(`/api/tasks/${firstTask.body.task.id}`, {
    title: 'API da sua', description: 'Mo ta da sua', dueDate: tomorrow, status: 'IN_PROGRESS', priority: 1, assigneeIds: [charlie.body.user.id]
  }, aliceToken);
  assert.equal(editedTask.response.status, 200);
  assert.equal(editedTask.body.task.title, 'API da sua');
  assert.equal(editedTask.body.task.description, 'Mo ta da sua');
  assert.equal(editedTask.body.task.status, 'IN_PROGRESS');
  assert.equal(editedTask.body.task.priority, 1);
  assert.equal(editedTask.body.task.dueDate, tomorrow);
  assert.equal(editedTask.body.task.assignees[0].id, charlie.body.user.id);
  const cannotWrite = await post(`/api/projects/${projectId}/tasks`, { title: 'Không được tạo', description: 'User không được tạo task', dueDate: tomorrow }, bob.body.accessToken);
  assert.equal(cannotWrite.response.status, 403);
  const cannotCreateWorkspace = await post('/api/workspaces', { name: 'Workspace cua Bob' }, bob.body.accessToken);
  assert.equal(cannotCreateWorkspace.response.status, 403);
  const cannotRenameProject = await patch(`/api/projects/${projectId}`, { name: 'Khong duoc doi' }, bob.body.accessToken);
  assert.equal(cannotRenameProject.response.status, 403);
  const cannotDeleteProject = await request(`/api/projects/${projectId}`, { method: 'DELETE', headers: bobHeaders });
  assert.equal(cannotDeleteProject.response.status, 403);
  const deletedProject = await request(`/api/projects/${projectId}`, { method: 'DELETE', headers: aliceHeaders });
  assert.equal(deletedProject.response.status, 204);
  const emptyHistory = await request(`/api/workspaces/${workspaceId}/completions`, { headers: aliceHeaders });
  assert.equal(emptyHistory.body.completions.length, 0);
  const deletedWorkspace = await request(`/api/workspaces/${workspaceId}`, { method: 'DELETE', headers: aliceHeaders });
  assert.equal(deletedWorkspace.response.status, 204);
});
