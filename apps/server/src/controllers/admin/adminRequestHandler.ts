import type { NextFunction, Request, RequestHandler, Response } from "express";
import { z } from "zod";

import { requireAuthUser } from "#middleware/auth";
import { createSuccessResponse, handleValidationError } from "#lib/errors";

/**
 * Wraps an admin controller body.
 *
 * Every admin endpoint shares the same three concerns — resolve the acting admin, turn a
 * ZodError into a 400 rather than a 500, and wrap the result in the standard success envelope.
 * Repeating that try/catch in ~50 handlers is how one of them ends up leaking a raw Zod error
 * or forgetting `next()`, so it lives here once.
 */
export function adminHandler<T>(
  run: (context: {
    req: Request;
    res: Response;
    /** The authenticated admin. Guaranteed present: adminAuthMiddleware runs first. */
    actorId: string;
  }) => Promise<T>,
  message = "Success",
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = requireAuthUser(req);
      const data = await run({ req, res, actorId: actor.id });

      // A handler that already wrote the response (file download, custom status) returns
      // undefined and is left alone.
      if (res.headersSent) return;

      res.json(createSuccessResponse(data, message));
    } catch (error) {
      next(error instanceof z.ZodError ? handleValidationError(error) : error);
    }
  };
}
