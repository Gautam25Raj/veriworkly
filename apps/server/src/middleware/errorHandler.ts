import { Request, Response, NextFunction } from "express";
import multer from "multer";

import { config } from "#config";

import { logger } from "#lib/logger";
import { ApiError, createErrorResponse } from "#lib/errors";

// Cap on what we persist to AuditLog.error — an error carrying a large payload (a serialized
// upstream response, a validation dump) should not become an unbounded column write per request.
const MAX_AUDIT_ERROR_CHARS = 500;

/**
 * Records the diagnostic that `loggingMiddleware` persists to AuditLog.error on the `finish`
 * event. Without this the column was written as NULL on every single row, so the audit log
 * recorded that a request failed but never why.
 */
function recordAuditError(res: Response, message: string) {
  res.locals.errorMessage = message.slice(0, MAX_AUDIT_ERROR_CHARS);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(error: unknown, req: Request, res: Response, next: NextFunction) {
  if (error instanceof ApiError) {
    logger.warn(`API Error [${req.method} ${req.path}]: ${error.message}`, error.details);
    recordAuditError(res, error.message);

    return res
      .status(error.statusCode)
      .json(createErrorResponse(error.statusCode, error.message, error.details));
  }

  // An upload the limits refuse (too large, an extra field): the caller's mistake, not ours. It
  // reached the 500 below, so a 6 MB resume read "Internal server error".
  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const message =
      status === 413
        ? "The file is larger than the 5 MB upload limit."
        : `Upload refused: ${error.message}.`;
    logger.warn(`Upload refused [${req.method} ${req.path}]: ${error.code}`);
    recordAuditError(res, error.code);
    return res.status(status).json(createErrorResponse(status, message));
  }

  if (error instanceof Error) {
    logger.error(`Unhandled Error [${req.method} ${req.path}]: ${error.message}`, {
      stack: error.stack,
    });

    // The audit log is internal and admin-only, so it keeps the real message even though the
    // response body is generic in production.
    recordAuditError(res, error.message);

    const message = config.nodeEnv === "production" ? "Internal server error" : error.message;
    return res.status(500).json(createErrorResponse(500, message));
  }

  logger.error("Unknown error type", error);
  recordAuditError(res, "Unknown error type");

  return res.status(500).json(createErrorResponse(500, "Internal server error"));
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json(createErrorResponse(404, `Endpoint ${req.method} ${req.path} not found`));
}
