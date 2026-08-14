import type { ErrorRequestHandler } from 'express';
import { AppError, BadRequestError, ConflictError, InternalServerError, NotFoundError } from '../errors.js';
import { logger } from '../logger.js';

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const appError = error instanceof AppError
    ? error
    : error instanceof SyntaxError && 'body' in error
      ? new BadRequestError('Malformed JSON')
      : typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
        ? new ConflictError('Dữ liệu đã tồn tại')
        : typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025'
          ? new NotFoundError('Không tìm thấy dữ liệu')
          : undefined;

  if (!appError) logger.error({ err: error, requestId: req.requestId }, 'Unhandled error');
  const responseError = appError ?? new InternalServerError();

  res.status(responseError.statusCode).json({
    error: {
      code: responseError.code,
      message: responseError.message,
      ...(responseError.details === undefined ? {} : { details: responseError.details })
    }
  });
};
