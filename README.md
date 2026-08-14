# TaskFlow

TaskFlow là capstone quản lý workspace, dự án và công việc, áp dụng nội dung từ tuần 1 đến tuần 9. Giao diện giữ đơn giản để dễ trình bày; backend dùng Express, PostgreSQL/Prisma, Redis và BullMQ.

## Chạy Bằng Docker

```bash
docker compose up --build
```

Mở `http://localhost:3000`. Compose khởi động app, PostgreSQL và Redis; Prisma tự chạy migration khi app bắt đầu.

## Chạy Local

1. Copy `.env.example` thành `.env` và đặt `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`; chỉ đặt `CORS_ORIGIN` khi frontend chạy khác origin.
2. Khởi động PostgreSQL. Redis là bắt buộc ở production; nếu không có Redis ở local, app dùng memory cache và tắt BullMQ reminder.
3. Chạy các lệnh:

```bash
npm ci
npm run db:deploy
npm run dev
```

Swagger UI: `http://localhost:3000/docs`.

## Lệnh Chính

```bash
npm run lint
npm test
npm run build
npm run db:migrate
npm run db:seed
```

Khi chưa có `DATABASE_URL`, test PostgreSQL integration sẽ được skip; unit test và kiểm tra giao diện vẫn chạy. CI luôn khởi động PostgreSQL/Redis trước khi chạy toàn bộ integration test.

## API Chính

- `POST /api/v1/auth/register`, `/login`, `/refresh`
- `GET /api/v1/me`
- `GET/POST /api/v1/workspaces`, `PATCH/DELETE /api/v1/workspaces/:workspaceId`
- `POST /api/v1/workspaces/:workspaceId/members`
- `GET/POST /api/v1/workspaces/:workspaceId/projects`, `PATCH/DELETE /api/v1/projects/:projectId`
- `GET/POST /api/v1/projects/:projectId/tasks`
- `PATCH/DELETE /api/v1/tasks/:taskId`
- `GET /api/v1/workspaces/:workspaceId/stats`

`ADMIN` tạo workspace, project và task; admin thêm `USER` vào workspace rồi giao task. `USER` chỉ xem các task được giao và không thể tạo/sửa/xóa task qua giao diện hay API.

## Phân Quyền

1. Chạy `npm run db:seed` để tạo tài khoản `ADMIN` từ `SEED_EMAIL` và `SEED_PASSWORD`.
2. Đăng ký tài khoản thứ hai; tài khoản mới có role `USER`.
3. Admin thêm email user vào workspace, rồi chọn một hoặc nhiều user ở ô “Giao cho user” khi tạo task.
4. Một user được giao bấm “Xác nhận đã làm xong” sẽ hoàn thành task chung; admin xem tài khoản và thời điểm xác nhận trong “Lịch sử hoàn thành”.

## Nội Dung Áp Dụng

| Tuần | Áp dụng trong TaskFlow |
| --- | --- |
| 1 | TypeScript strict, ESM, async/await, npm scripts và config dự án |
| 2 | Node core (`crypto`/`process.env`), xử lý bất đồng bộ, health check |
| 3 | Express REST API, middleware, route params, service layer và mã HTTP chuẩn |
| 4 | PostgreSQL/Prisma, migration, User-Workspace-Membership-Project-Task relation, index và transaction khi đăng ký |
| 5 | Password hash bcrypt, JWT access/refresh, Helmet, CORS allowlist, rate limit và RBAC workspace |
| 6 | Zod validation, error response chuẩn, Pino request log/redact, request ID và env fail-fast |
| 7 | Unit test điểm ưu tiên; integration auth, refresh token, cursor pagination và RBAC VIEWER; coverage từ Node test runner |
| 8 | Redis cache-aside TTL/invalidation, cursor pagination, BullMQ job nhắc hạn retry hằng ngày |
| 9 | Docker multi-stage, Compose app/Postgres/Redis, healthcheck, graceful shutdown, Swagger/OpenAPI, GitHub Actions CI |

## Lưu Ý Bảo Mật

Giá trị trong `.env.example` chỉ dùng cho môi trường học tập. Thay toàn bộ JWT secret và PostgreSQL password trước khi triển khai thật.
