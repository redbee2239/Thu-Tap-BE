import { Request, Response, NextFunction } from "express";
import { type ZodSchema, ZodError } from "zod";
import { ValidationError } from "../errors.js";

type RequestSource = "body" | "query" | "params";

export function validate(schema: ZodSchema, source: RequestSource = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[source]);
      if (source === "query") {
        (req as unknown as Record<string, unknown>)._validatedQuery = data;
      } else {
        req[source] = data;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(new ValidationError("Invalid request data", err.flatten().fieldErrors));
      } else {
        next(err);
      }
    }
  };
}
