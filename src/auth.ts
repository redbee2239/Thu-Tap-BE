import bcrypt from 'bcryptjs';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { UnauthorizedError } from './errors.js';

export type AuthSecrets = {
  jwtSecret: string;
  jwtRefreshSecret: string;
};

export type TokenPayload = JwtPayload & {
  sub: string;
  tokenType: 'access' | 'refresh';
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  return bcrypt.compare(password, stored);
}

function sign(userId: string, tokenType: TokenPayload['tokenType'], secret: string, expiresIn: '15m' | '7d'): string {
  return jwt.sign({ tokenType }, secret, { algorithm: 'HS256', subject: userId, expiresIn });
}

function verify(token: string, secret: string, tokenType: TokenPayload['tokenType']): TokenPayload {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (
      typeof payload === 'string' ||
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0 ||
      payload.tokenType !== tokenType
    ) {
      throw new Error('Invalid token');
    }
    return payload as TokenPayload;
  } catch {
    throw new UnauthorizedError(tokenType === 'access' ? 'Access token không hợp lệ hoặc đã hết hạn' : 'Refresh token không hợp lệ hoặc đã hết hạn');
  }
}

export function issueTokens(userId: string, secrets: AuthSecrets) {
  return {
    accessToken: sign(userId, 'access', secrets.jwtSecret, '15m'),
    refreshToken: sign(userId, 'refresh', secrets.jwtRefreshSecret, '7d')
  };
}

export const verifyAccessToken = (token: string, secrets: AuthSecrets) => verify(token, secrets.jwtSecret, 'access');
export const verifyRefreshToken = (token: string, secrets: AuthSecrets) => verify(token, secrets.jwtRefreshSecret, 'refresh');
