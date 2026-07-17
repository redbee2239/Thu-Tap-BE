import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { AuthError } from "../errors.js";

export interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new AuthError("Missing or invalid token"));
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), config.JWT_SECRET) as { id: string; role: string };
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch {
    next(new AuthError("Invalid or expired token"));
  }
}
