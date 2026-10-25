import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// V-040: the import routes sat behind flexibleAuth with no scope check, so a `user:read` key could
// overwrite the master profile and run the AI LinkedIn import.

const { controller, authState } = vi.hoisted(() => ({
  controller: {
    getMasterProfile: vi.fn((_req: unknown, res: { json: (b: unknown) => void }) =>
      res.json({ ok: "master" }),
    ),
    updateMasterProfile: vi.fn((_req: unknown, res: { json: (b: unknown) => void }) =>
      res.json({ ok: "update" }),
    ),
    getImportQuota: vi.fn((_req: unknown, res: { json: (b: unknown) => void }) =>
      res.json({ ok: "quota" }),
    ),
    importGithub: vi.fn((_req: unknown, res: { json: (b: unknown) => void }) =>
      res.json({ ok: "github" }),
    ),
    importLinkedin: vi.fn((_req: unknown, res: { json: (b: unknown) => void }) =>
      res.json({ ok: "linkedin" }),
    ),
  },
  authState: { apiKey: null as null | { scopes: string[] } },
}));

vi.mock("#controllers/profileController", () => ({ ProfileController: controller }));
vi.mock("#middleware/flexibleAuth", () => ({
  flexibleAuth: (
    req: { apiKey?: unknown; authUser?: unknown },
    _res: unknown,
    next: () => void,
  ) => {
    if (authState.apiKey) req.apiKey = authState.apiKey;
    else req.authUser = { id: "u1", email: "u@example.test", name: null };
    next();
  },
}));

import router from "#routes/profiles";

const app = express();
app.use(express.json());
app.use("/api/v1/profiles", router);

describe("profile import routes require API-key scopes (V-040)", () => {
  beforeEach(() => {
    authState.apiKey = null;
    Object.values(controller).forEach((fn) => fn.mockClear());
  });

  it.each([
    ["get", "/api/v1/profiles/import/quota", "resume:read", "getImportQuota"],
    ["post", "/api/v1/profiles/import/github", "resume:write", "importGithub"],
    ["post", "/api/v1/profiles/import/linkedin", "resume:write", "importLinkedin"],
  ] as const)("%s %s is refused for a key without %s", async (method, url, _scope, handler) => {
    authState.apiKey = { scopes: ["user:read"] };

    const response = await request(app)[method](url).send({});

    expect(response.status).toBe(403);
    expect(controller[handler]).not.toHaveBeenCalled();
  });

  it("the LinkedIn import also needs ai:write", async () => {
    authState.apiKey = { scopes: ["resume:write"] };

    const response = await request(app).post("/api/v1/profiles/import/linkedin").send({});

    expect(response.status).toBe(403);
    expect(controller.importLinkedin).not.toHaveBeenCalled();
  });

  it("lets a key with the right scopes through", async () => {
    authState.apiKey = { scopes: ["resume:read", "resume:write", "ai:write"] };

    expect((await request(app).get("/api/v1/profiles/import/quota")).status).toBe(200);
    expect((await request(app).post("/api/v1/profiles/import/github").send({})).status).toBe(200);
    expect((await request(app).post("/api/v1/profiles/import/linkedin").send({})).status).toBe(200);
  });

  it("does not affect session users", async () => {
    const response = await request(app).post("/api/v1/profiles/import/linkedin").send({});

    expect(response.status).toBe(200);
    expect(controller.importLinkedin).toHaveBeenCalledTimes(1);
  });
});
