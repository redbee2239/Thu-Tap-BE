import assert from 'node:assert/strict';
import test from 'node:test';
import { accountUpdateSchema, registerSchema, taskSchema } from '../src/schemas.js';

test('schema đăng ký từ chối confirm password không khớp', () => {
  const result = registerSchema.safeParse({
    name: 'Nguyen Van A',
    email: 'a@example.com',
    password: 'correct-horse-battery',
    confirmPassword: 'different-password'
  });
  assert.equal(result.success, false);
});

test('schema cập nhật tài khoản yêu cầu đủ mật khẩu khi đổi', () => {
  assert.equal(accountUpdateSchema.safeParse({ name: 'Nguyen Van A' }).success, true);
  assert.equal(accountUpdateSchema.safeParse({ newPassword: 'new-password' }).success, false);
  assert.equal(accountUpdateSchema.safeParse({ currentPassword: 'correct-horse-battery', newPassword: 'new-password', confirmPassword: 'different-password' }).success, false);
  assert.equal(accountUpdateSchema.safeParse({ currentPassword: 'correct-horse-battery', newPassword: 'new-password', confirmPassword: 'new-password' }).success, true);
});

test('schema task áp dụng giá trị mặc định', () => {
  const task = taskSchema.parse({
    title: 'Hoàn thiện báo cáo',
    description: 'Tổng hợp nội dung và gửi bản cuối.',
    dueDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  });
  assert.equal(task.status, 'TODO');
  assert.equal(task.priority, 3);
});

test('schema task yêu cầu tên, mô tả, ngày hạn hợp lệ', () => {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  assert.equal(taskSchema.safeParse({ description: 'Mô tả', dueDate: tomorrow }).success, false);
  assert.equal(taskSchema.safeParse({ title: 'Tên task', dueDate: tomorrow }).success, false);
  assert.equal(taskSchema.safeParse({ title: 'Tên task', description: 'Mô tả' }).success, false);
  assert.equal(taskSchema.safeParse({ title: 'Tên task', description: 'Mô tả', dueDate: yesterday }).success, false);
});
