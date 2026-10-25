import express, { Router } from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import "#lib/asyncRouteErrors";

/**
 * Express 4 ignores a handler's returned promise; `#lib/asyncRouteErrors` forwards its rejection
 * to `next`, so a throw in an async handler is an error response, not an `unhandledRejection`
 * (which shuts the worker down).
 */
function appWith(router: Router) {
  const app = express();
  app.use(router);
  app.use(
    (error: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (res.headersSent) return next(error);
      res.status(500).json({ error: error.message });
    },
  );
  return app;
}

describe("async route errors", () => {
  const unhandled = vi.fn();

  afterEach(() => {
    process.off("unhandledRejection", unhandled);
  });

  it("sends an async route handler's rejection to the error handler", async () => {
    process.on("unhandledRejection", unhandled);
    const router = Router();
    router.get("/boom", async () => {
      await Promise.resolve();
      throw new Error("async boom");
    });

    const response = await request(appWith(router)).get("/boom");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "async boom" });
    await new Promise((resolve) => setImmediate(resolve));
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("does the same for async middleware mounted with use()", async () => {
    const router = Router();
    router.use(async () => {
      throw new Error("middleware boom");
    });
    router.get("/never", (_req, res) => res.send("unreachable"));

    const response = await request(appWith(router)).get("/never");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "middleware boom" });
  });

  it("leaves handlers that resolve, or that call next themselves, alone", async () => {
    const router = Router();
    router.get("/ok", async (_req, res) => {
      await Promise.resolve();
      res.json({ ok: true });
    });
    router.get("/next", async (_req, _res, next) => {
      await Promise.resolve();
      next(new Error("passed to next"));
    });

    const app = appWith(router);

    expect((await request(app).get("/ok")).body).toEqual({ ok: true });
    const passed = await request(app).get("/next");
    expect(passed.status).toBe(500);
    expect(passed.body).toEqual({ error: "passed to next" });
  });

  it("a rejection with no reason still becomes an error", async () => {
    const router = Router();
    router.get("/empty", () => Promise.reject(undefined));

    const response = await request(appWith(router)).get("/empty");

    expect(response.status).toBe(500);
    expect(response.body.error).toMatch(/rejected without a reason/);
  });
});
