import { z } from "zod";

import { installZod3Messages } from "#lib/zodMessages";

installZod3Messages();

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";

    Object.setPrototypeOf(this, new.target.prototype);

    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }
}

export function handleValidationError(error: z.ZodError): ApiError {
  const formattedErrors = error.issues.map((err) => ({
    path: err.path.map(String).join("."),
    message: err.message,
  }));

  return new ApiError(400, "Validation failed", formattedErrors);
}

export function createSuccessResponse<T>(data: T, message = "Success") {
  return {
    success: true,
    message,
    data,
  };
}

export function createErrorResponse(statusCode: number, message: string, details?: unknown) {
  return {
    success: false,
    message,
    statusCode,
    details,
  };
}
