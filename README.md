# TaskFlow - Tuần 8

## Chạy

```bash
npm install
docker run --rm --name taskflow-redis -p 6379:6379 redis:7
npm run dev
```

`REDIS_URL` mặc định là `redis://127.0.0.1:6379`.

## API chính

- `GET /projects/:projectId/tasks?limit=20&cursor=...&status=TODO&assigneeId=...&sort=createdAt:desc`
- `GET /workspaces/:workspaceId/projects` dùng cache-aside TTL 60 giây.
- `GET /workspaces/:workspaceId/stats` dùng Redis cache, trả về hit/miss trong log.
- `PATCH /tasks/:taskId` tự invalidate thống kê workspace.

Job `scan-upcoming-tasks` chạy lúc 08:00 mỗi ngày theo múi giờ `Asia/Ho_Chi_Minh`, retry 3 lần với exponential backoff.

Khi chạy test, app dùng `MemoryCache`, nên không cần Redis.
