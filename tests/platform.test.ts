import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('platform endpoints', () => {
  it('reports dependency readiness and exposes OpenAPI', async () => {
    const app = createApp();

    await request(app).get('/health').expect(200, { status: 'ok' });
    const spec = await request(app).get('/openapi.json').expect(200);
    expect(Object.keys(spec.body.paths)).toEqual(expect.arrayContaining([
      '/health',
      '/auth/register',
      '/auth/login',
      '/projects',
      '/workspaces/{workspaceId}/projects',
      '/tasks',
      '/projects/{projectId}/tasks',
      '/workspaces/{workspaceId}/stats',
      '/tasks/{taskId}'
    ]));
    await request(app).get('/docs/').expect(200).expect('Content-Type', /html/);
  });

  it('returns 503 when a dependency health check fails', async () => {
    const app = createApp({ healthcheck: async () => { throw new Error('unavailable'); } });
    await request(app).get('/health').expect(503, { status: 'error' });
  });
});
