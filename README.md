# Week 2 - Node.js Core & Async Programming

## Cài đặt

```bash
git clone https://github.com/redbee2239/Thu-Tap-BE.git
cd Thu-Tap-BE
git checkout tuan-2
npm install
```

## Chạy Server

```bash
npm start
```

Server chạy tại `http://127.0.0.1:3000`

### API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | /health | Kiểm tra trạng thái server |
| GET | /users | Lấy danh sách người dùng |
| POST | /users | Tạo người dùng mới (cần field `name`) |

### Ví dụ

```bash
# Kiểm tra health
curl http://localhost:3000/health

# Lấy danh sách users
curl http://localhost:3000/users

# Tạo user mới
curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{"name": "Nguyen Van A"}'
```

## Chạy Drills

```bash
# Drill 1: Đếm số dòng trong file
npm run drill:lines

# Drill 2: EventEmitter
npm run drill:events

# Drill 3: Đọc và so sánh file
npm run drill:compare
```


