import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Role } from '../src/types.js';

async function registerAndLogin(app: Express, email: string, role: Role = 'OWNER'): Promise<string> {
  await request(app).post('/auth/register').send({ email, password: 'secret', role }).expect(201);
  const login = await request(app).post('/auth/login').send({ email, password: 'secret' }).expect(200);
  return login.body.token as string;
}

describe('Tích hợp TaskFlow', () => {
  it('chạy luồng đăng ký, đăng nhập, tạo project, tạo task và xem danh sách', async () => {
    const app = createApp();
    const token = await registerAndLogin(app, 'owner@test.com');

    const project = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Tuần 7' })
      .expect(201);

    await request(app).post('/tasks').send({ projectId: project.body.id, title: 'Chưa đăng nhập' }).expect(401);
    await request(app).post('/tasks').set('Authorization', `Bearer ${token}`).send({ projectId: project.body.id, title: 'x' }).expect(400);

    const task = await request(app)
      .post('/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId: project.body.id, title: 'Viết test', priority: 5, dueInDays: 0 })
      .expect(201);

    const list = await request(app).get(`/projects/${project.body.id}/tasks`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(task.body.id);
  });

  it('trả về 403 khi VIEWER xóa task', async () => {
    const app = createApp();
    const ownerToken = await registerAndLogin(app, 'owner2@test.com');
    const viewerToken = await registerAndLogin(app, 'viewer@test.com', 'VIEWER');
    const project = await request(app).post('/projects').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Phân quyền' });
    const task = await request(app).post('/tasks').set('Authorization', `Bearer ${ownerToken}`).send({ projectId: project.body.id, title: 'Task được bảo vệ' });

    await request(app).delete(`/tasks/${task.body.id}`).set('Authorization', `Bearer ${viewerToken}`).expect(403);
  });
});
