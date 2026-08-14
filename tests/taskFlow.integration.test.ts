import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp, createRuntime } from '../src/app.js';
import type { Logger } from '../src/infra/cache.js';
import type { Role } from '../src/types.js';

async function registerAndLogin(app: Express, email: string, role: Role = 'OWNER'): Promise<string> {
  await request(app).post('/auth/register').send({ email, password: 'secret', role }).expect(201);
  const login = await request(app).post('/auth/login').send({ email, password: 'secret' }).expect(200);
  return login.body.token as string;
}

function testLogger() {
  const lines: string[] = [];
  const logger: Logger = { log: (...args) => lines.push(args.join(' ')) };
  return { lines, logger };
}

describe('Tích hợp TaskFlow tuần 8', () => {
  it('phân trang cursor, filter và sort không lặp task', async () => {
    const app = createApp();
    const token = await registerAndLogin(app, 'owner@test.com');
    const project = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hiệu năng', workspaceId: 'workspace-1' })
      .expect(201);

    for (const [title, status, assigneeId] of [
      ['Task 1', 'TODO', 'u1'],
      ['Task 2', 'IN_PROGRESS', 'u2'],
      ['Task 3', 'DONE', 'u1']
    ]) {
      await request(app)
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ projectId: project.body.id, title, status, assigneeId })
        .expect(201);
    }

    const first = await request(app)
      .get(`/projects/${project.body.id}/tasks?limit=2&sort=createdAt:asc`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.pagination.hasNextPage).toBe(true);

    const second = await request(app)
      .get(`/projects/${project.body.id}/tasks?limit=2&sort=createdAt:asc&cursor=${first.body.pagination.nextCursor}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.items[0].id).not.toBe(first.body.items[0].id);

    const filtered = await request(app)
      .get(`/projects/${project.body.id}/tasks?status=TODO&assigneeId=u1`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0].title).toBe('Task 1');
  });

  it('cache danh sách project và stats có hit/miss, invalidate khi dữ liệu đổi', async () => {
    const { lines, logger } = testLogger();
    const app = createRuntime({ logger }).app;
    const token = await registerAndLogin(app, 'cache@test.com');
    const project = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cache demo', workspaceId: 'workspace-cache' })
      .expect(201);

    await request(app).get('/workspaces/workspace-cache/projects').set('Authorization', `Bearer ${token}`).expect(200);
    await request(app).get('/workspaces/workspace-cache/projects').set('Authorization', `Bearer ${token}`).expect(200);
    expect(lines.some((line) => line.includes('[cache] miss workspace:workspace-cache:projects'))).toBe(true);
    expect(lines.some((line) => line.includes('[cache] hit workspace:workspace-cache:projects'))).toBe(true);

    const task = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId: project.body.id, title: 'Task cache', status: 'TODO' })
      .expect(201);
    const before = await request(app).get('/workspaces/workspace-cache/stats').set('Authorization', `Bearer ${token}`).expect(200);
    const cached = await request(app).get('/workspaces/workspace-cache/stats').set('Authorization', `Bearer ${token}`).expect(200);
    expect(before.body).toEqual(cached.body);
    expect(before.body.byStatus.TODO).toBe(1);

    await request(app)
      .patch(`/tasks/${task.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'DONE' })
      .expect(200);
    const after = await request(app).get('/workspaces/workspace-cache/stats').set('Authorization', `Bearer ${token}`).expect(200);
    expect(after.body.byStatus).toMatchObject({ TODO: 0, DONE: 1 });
    expect(lines.some((line) => line.includes('[cache] hit workspace:workspace-cache:task-stats'))).toBe(true);
  });
});
