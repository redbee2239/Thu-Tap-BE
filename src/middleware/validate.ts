import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { ValidationError } from '../errors.js';

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: ZodTypeAny, part: RequestPart = 'body'): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(new ValidationError('Validation failed', result.error.issues));
      return;
    }
    if (part === 'query') res.locals.validatedQuery = result.data;
    else (req as unknown as Record<RequestPart, unknown>)[part] = result.data;
    next();
  };
}
