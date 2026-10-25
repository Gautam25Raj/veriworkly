import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "#app";
import { prisma } from "#lib/prisma";
import { buildResumeShell } from "#services/profileImportService";

import { STUDIO_ORIGIN } from "./env.js";
import { createUserWithSession, type TestUser } from "./helpers/auth.js";

/**
 * V-139 / V-026 / V-137: the master profile read and write contract against a real database.
 */

function asUser(user: TestUser) {
  return {
    get: (url: string) =>
      request(app).get(url).set("Origin", STUDIO_ORIGIN).set("Cookie", user.cookie),
    put: (url: string) =>
      request(app).put(url).set("Origin", STUDIO_ORIGIN).set("Cookie", user.cookie),
  };
}

function validProfile(fullName = "Jane Doe") {
  return buildResumeShell({
    basics: {
      fullName,
      role: "Engineer",
      headline: "Builds things.",
      email: "jane@example.test",
      phone: "",
      location: "Remote",
      linkEmail: true,
      linkPhone: false,
      linkLocation: true,
    },
    links: [],
    summary: "Builds things.",
    projects: [],
    skills: [],
  });
}

describe("GET /profiles/master (V-139)", () => {
  it("is 404 for a user with no master profile row", async () => {
    const user = await createUserWithSession();

    const response = await asUser(user).get("/api/v1/profiles/master");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      message: "Master profile not found",
      statusCode: 404,
    });
  });

  it("returns the row once one exists, and the 404 was not cached", async () => {
    const user = await createUserWithSession();
    const api = asUser(user);

    expect((await api.get("/api/v1/profiles/master")).status).toBe(404);

    const saved = await api.put("/api/v1/profiles/master").send({ profile: validProfile() });
    expect(saved.status).toBe(200);

    const fetched = await api.get("/api/v1/profiles/master");
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.profile.content.basics.fullName).toBe("Jane Doe");
    expect(fetched.body.data.summary.id).toBe(user.id);
  });
});

describe("PUT /profiles/master optimistic concurrency (V-026)", () => {
  it("first save creates the row without an expectedUpdatedAt", async () => {
    const user = await createUserWithSession();

    const saved = await asUser(user)
      .put("/api/v1/profiles/master")
      .send({ profile: validProfile() });

    expect(saved.status).toBe(200);
    expect(saved.body.data.userId).toBe(user.id);
    expect(await prisma.masterProfile.count({ where: { userId: user.id } })).toBe(1);
  });

  it("refuses a blind overwrite of an existing row (no expectedUpdatedAt) with 409", async () => {
    const user = await createUserWithSession();
    const api = asUser(user);

    const first = await api.put("/api/v1/profiles/master").send({ profile: validProfile() });
    expect(first.status).toBe(200);
    const updatedAt: string = first.body.data.updatedAt;

    const blind = await api
      .put("/api/v1/profiles/master")
      .send({ profile: validProfile("Hijack") });
    expect(blind.status).toBe(409);
    expect(blind.body.details).toMatchObject({ currentUpdatedAt: updatedAt });

    const row = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: user.id } });
    expect((row.content as { basics: { fullName: string } }).basics.fullName).toBe("Jane Doe");
  });

  it("two saves with the same expectedUpdatedAt: one 200, one 409 with the current updatedAt (10 pairs)", async () => {
    const user = await createUserWithSession();
    const api = asUser(user);

    const first = await api.put("/api/v1/profiles/master").send({ profile: validProfile() });
    expect(first.status).toBe(200);
    let expectedUpdatedAt: string = first.body.data.updatedAt;

    // The compare lives in the UPDATE's WHERE clause, so every pair must split 200/409 no
    // matter how the two statements interleave; each pair starts from the previous winner.
    for (let pair = 0; pair < 10; pair++) {
      const [a, b] = await Promise.all([
        api
          .put("/api/v1/profiles/master")
          .send({ profile: validProfile(`Session A ${pair}`), expectedUpdatedAt }),
        api
          .put("/api/v1/profiles/master")
          .send({ profile: validProfile(`Session B ${pair}`), expectedUpdatedAt }),
      ]);

      expect([a.status, b.status].sort(), `pair ${pair}`).toEqual([200, 409]);

      const winner = a.status === 200 ? a : b;
      const loser = a.status === 409 ? a : b;

      expect(loser.body.details.currentUpdatedAt).toBe(winner.body.data.updatedAt);
      expect(winner.body.data.updatedAt).not.toBe(expectedUpdatedAt);

      const row = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: user.id } });
      const winnerName = (winner.body.data.content as { basics: { fullName: string } }).basics
        .fullName;
      expect((row.content as { basics: { fullName: string } }).basics.fullName).toBe(winnerName);

      expectedUpdatedAt = winner.body.data.updatedAt;
    }
  });

  it("a matching expectedUpdatedAt saves and advances the cursor", async () => {
    const user = await createUserWithSession();
    const api = asUser(user);

    const first = await api.put("/api/v1/profiles/master").send({ profile: validProfile() });
    const second = await api
      .put("/api/v1/profiles/master")
      .send({ profile: validProfile("Edited"), expectedUpdatedAt: first.body.data.updatedAt });

    expect(second.status).toBe(200);
    expect(second.body.data.content.basics.fullName).toBe("Edited");

    const stale = await api
      .put("/api/v1/profiles/master")
      .send({ profile: validProfile("Stale"), expectedUpdatedAt: first.body.data.updatedAt });
    expect(stale.status).toBe(409);
  });
});

describe("PUT /profiles/master validation (V-137)", () => {
  it("rejects invalid content with 400 and [{ path, message }] details", async () => {
    const user = await createUserWithSession();
    const invalid = validProfile();
    invalid.basics.phone = "123";

    const response = await asUser(user).put("/api/v1/profiles/master").send({ profile: invalid });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(Array.isArray(response.body.details)).toBe(true);
    expect(response.body.details.length).toBeGreaterThan(0);
    for (const issue of response.body.details) {
      expect(Object.keys(issue).sort()).toEqual(["message", "path"]);
      expect(typeof issue.path).toBe("string");
      expect(typeof issue.message).toBe("string");
    }
    expect(await prisma.masterProfile.count({ where: { userId: user.id } })).toBe(0);
  });
});
