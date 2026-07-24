import { describe, expect, it, vi } from 'vitest';
import { createAuthService } from '../src/services/authService.js';
import type { User, UserRepo } from '../src/types.js';

function userRepo(users: User[] = []): UserRepo {
  return {
    create: vi.fn((user: User) => {
      users.push(user);
      return user;
    }),
    findByEmail: vi.fn((email: string) => users.find((user) => user.email === email) || null),
    findById: vi.fn((id: string) => users.find((user) => user.id === id) || null)
  };
}

describe('dịch vụ tài khoản', () => {
  it('đăng ký người dùng mới', () => {
    const repo = userRepo();
    const user = createAuthService(repo).register({ email: 'a@test.com', password: 'secret' });

    expect(user).toMatchObject({ email: 'a@test.com', role: 'OWNER' });
    expect(repo.create).toHaveBeenCalledOnce();
  });

  it('từ chối email trùng', () => {
    const repo = userRepo([{ id: 'u1', email: 'a@test.com', passwordHash: 'x', role: 'OWNER' }]);

    expect(() => createAuthService(repo).register({ email: 'a@test.com', password: 'secret' })).toThrow('Email đã tồn tại');
  });

  it('đăng nhập và xác thực token', () => {
    const service = createAuthService(userRepo());
    service.register({ email: 'a@test.com', password: 'secret' });

    const token = service.login({ email: 'a@test.com', password: 'secret' });

    expect(service.authenticate(token)).toMatchObject({ email: 'a@test.com' });
  });

  it('từ chối thông tin đăng nhập và token sai', () => {
    const service = createAuthService(userRepo());
    service.register({ email: 'a@test.com', password: 'secret' });

    expect(() => service.login({ email: 'a@test.com', password: 'wrong' })).toThrow('Thông tin đăng nhập không đúng');
    const token = service.login({ email: 'a@test.com', password: 'secret' });
    expect(() => service.authenticate(`${token}x`)).toThrow('Token không hợp lệ');
  });
});
