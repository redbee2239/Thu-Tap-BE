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

describe('authService', () => {
  it('registers a new user', () => {
    const repo = userRepo();
    const user = createAuthService(repo).register({ email: 'a@test.com', password: 'secret' });

    expect(user).toMatchObject({ email: 'a@test.com', role: 'OWNER' });
    expect(repo.create).toHaveBeenCalledOnce();
  });

  it('rejects duplicate email', () => {
    const repo = userRepo([{ id: 'u1', email: 'a@test.com', passwordHash: 'x', role: 'OWNER' }]);

    expect(() => createAuthService(repo).register({ email: 'a@test.com', password: 'secret' })).toThrow('Email already exists');
  });

  it('logs in and authenticates token', () => {
    const service = createAuthService(userRepo());
    service.register({ email: 'a@test.com', password: 'secret' });

    const token = service.login({ email: 'a@test.com', password: 'secret' });

    expect(service.authenticate(token)).toMatchObject({ email: 'a@test.com' });
  });

  it('rejects invalid credentials and tokens', () => {
    const service = createAuthService(userRepo());
    service.register({ email: 'a@test.com', password: 'secret' });

    expect(() => service.login({ email: 'a@test.com', password: 'wrong' })).toThrow('Invalid credentials');
    const token = service.login({ email: 'a@test.com', password: 'secret' });
    expect(() => service.authenticate(`${token}x`)).toThrow('Invalid token');
  });
});
