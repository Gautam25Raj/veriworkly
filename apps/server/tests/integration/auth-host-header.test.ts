import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "#app";

/**
 * V-155: better-call builds `new Request(`${proto}://${host}${url}`)` with no try/catch, so a
 * junk Host or X-Forwarded-Proto used to reject outside Express's error path, which `index.ts`
 * answers with a worker shutdown. The route must answer 400 and the process must stay alive.
 */
describe("auth route hardening against malformed Host / X-Forwarded-Proto (V-155)", () => {
  function captureUnhandledRejections() {
    const seen: unknown[] = [];
    const onRejection = (reason: unknown) => seen.push(reason);
    process.on("unhandledRejection", onRejection);
    return {
      seen,
      stop: () => process.off("unhandledRejection", onRejection),
    };
  }

  it("answers a well-formed request normally", async () => {
    const response = await request(app).get("/api/v1/auth/ok");

    expect(response.status).toBe(200);
  });

  it("returns 400 for an out-of-range port in Host and raises no unhandled rejection", async () => {
    const capture = captureUnhandledRejections();
    try {
      const response = await request(app).get("/api/v1/auth/ok").set("Host", "a:99999");

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ success: false, statusCode: 400 });

      await new Promise((resolve) => setImmediate(resolve));
      expect(capture.seen).toEqual([]);
    } finally {
      capture.stop();
    }
  });

  it("returns 400 for a non-http X-Forwarded-Proto", async () => {
    const capture = captureUnhandledRejections();
    try {
      const response = await request(app)
        .get("/api/v1/auth/ok")
        .set("X-Forwarded-Proto", "javascript");

      expect(response.status).toBe(400);

      await new Promise((resolve) => setImmediate(resolve));
      expect(capture.seen).toEqual([]);
    } finally {
      capture.stop();
    }
  });
});
