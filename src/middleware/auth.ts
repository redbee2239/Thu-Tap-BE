import type { Request, RequestHandler } from 'express';
import { verifyAccessToken, type AuthSecrets, type TokenPayload } from '../auth.js';
import { UnauthorizedError } from '../errors.js';

export type AuthenticatedRequest = Request & { user: TokenPayload };

export function authenticate(secrets: AuthSecrets): RequestHandler {
  return (req, _res, next) => {
  const token = req.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    next(new UnauthorizedError('Missing access token'));
    return;
  }

  try {
    (req as AuthenticatedRequest).user = verifyAccessToken(token, secrets);
    next();
  } catch (error) {
    next(error instanceof UnauthorizedError ? error : new UnauthorizedError());
  }
  };
}
