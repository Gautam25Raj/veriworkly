import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#config", () => ({
  config: { nodeEnv: "production" },
}));

vi.mock("#lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { errorHandler } = await import("#middleware/errorHandler");
const { ApiError } = await import("#lib/errors");

/**
 * Regression cover for the audit log's always-NULL `error` column: loggingMiddleware persists
 * res.locals.errorMessage, but nothing ever assigned it, so every AuditLog row recorded that a
 * request failed and never why.
 */
describe("errorHandler audit diagnostics", () => {
  let req: Request;
  let res: Response & { locals: Record<string, unknown> };
  let next: NextFunction;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    req = { method: "POST", path: "/api/v1/documents" } as Request;
    res = { locals: {}, status: statusMock } as unknown as Response & {
      locals: Record<string, unknown>;
    };
    next = vi.fn();
  });

  it("records the message for an ApiError", () => {
    errorHandler(new ApiError(409, "Slug already taken"), req, res, next);

    expect(res.locals.errorMessage).toBe("Slug already taken");
    expect(statusMock).toHaveBeenCalledWith(409);
  });

  it("records the real message for an unhandled error even though the response is generic", () => {
    errorHandler(new Error("connect ECONNREFUSED 10.0.0.5:5432"), req, res, next);

    // The audit log is admin-only, so it keeps the detail the client is not shown.
    expect(res.locals.errorMessage).toBe("connect ECONNREFUSED 10.0.0.5:5432");
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Internal server error" }),
    );
  });

  it("truncates so a large error payload cannot become an unbounded column write", () => {
    errorHandler(new ApiError(400, "x".repeat(5_000)), req, res, next);

    expect((res.locals.errorMessage as string).length).toBe(500);
  });

  it("records a placeholder for a non-Error throw", () => {
    errorHandler("something odd", req, res, next);

    expect(res.locals.errorMessage).toBe("Unknown error type");
  });
});
