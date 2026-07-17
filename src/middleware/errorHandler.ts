import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors.js";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { RequestWithId } from "./requestId.js";

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as RequestWithId).requestId || "unknown";

  if (err instanceof AppError) {
    logger.warn({ requestId, error: err.code, message: err.message, details: err.details });
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && typeof err.details === "object" ? { details: err.details } : {}),
      },
    });
    return;
  }

  logger.error({ requestId, error: err.message, stack: err.stack });
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: config.NODE_ENV === "production" ? "Internal server error" : err.message,
    },
  });
}
