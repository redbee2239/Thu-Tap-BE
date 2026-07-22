import crypto from 'node:crypto';
import type { PublicUser, Role, User, UserRepo } from '../types.js';

type RegisterInput = { email?: string; password?: string; role?: Role };
type LoginInput = { email?: string; password?: string };
type TokenPayload = { sub: string; role: Role };

function sign(payload: TokenPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verify(token: string, secret: string): TokenPayload {
  const [body, signature] = token.split('.');
  if (!body || !signature) throw new Error('Invalid token');

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload;
  if (sign(payload, secret) !== token) throw new Error('Invalid token');
  return payload;
}

export function createAuthService(userRepo: UserRepo, { secret = 'test-secret' } = {}) {
  return {
    register({ email, password, role = 'OWNER' }: RegisterInput): PublicUser {
      if (!email || !password) throw new Error('Email and password are required');
      if (userRepo.findByEmail(email)) throw new Error('Email already exists');

      const user: User = {
        id: crypto.randomUUID(),
        email,
        passwordHash: crypto.createHash('sha256').update(password).digest('hex'),
        role
      };
      userRepo.create(user);
      return { id: user.id, email: user.email, role: user.role };
    },

    login({ email, password }: LoginInput): string {
      const user = email ? userRepo.findByEmail(email) : null;
      const passwordHash = crypto.createHash('sha256').update(password || '').digest('hex');
      if (!user || user.passwordHash !== passwordHash) throw new Error('Invalid credentials');
      return sign({ sub: user.id, role: user.role }, secret);
    },

    authenticate(token: string): PublicUser {
      const payload = verify(token, secret);
      const user = userRepo.findById(payload.sub);
      if (!user) throw new Error('Invalid token');
      return { id: user.id, email: user.email, role: user.role };
    }
  };
}