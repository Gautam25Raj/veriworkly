import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * V-022 / V-144: import side effects and the GitHub username parser, through the real stack.
 * Only the outbound AI call and `fetch` (GitHub's API) are replaced at the module boundary.
 */

const { convertResume } = vi.hoisted(() => ({
  convertResume: vi.fn(),
}));

vi.mock("#services/ats/atsAi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#services/ats/atsAi")>()),
  createServerAtsAi: () => ({ convertResume }),
}));

vi.mock("#services/ats/aiPolicy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#services/ats/aiPolicy")>()),
  getAtsAiPolicy: () => ({
    resumeConversion: {
      model: "test-model",
      maxOutputTokens: 100,
      temperature: 0,
      structuredOutputs: false,
    },
    prompts: { resumeConversion: "convert" },
  }),
}));

import { app } from "#app";
import { prisma } from "#lib/prisma";
import { buildResumeShell } from "#services/profileImportService";

import { STUDIO_ORIGIN } from "./env.js";
import { createUserWithSession, type TestUser } from "./helpers/auth.js";

function asUser(user: TestUser) {
  return {
    get: (url: string) =>
      request(app).get(url).set("Origin", STUDIO_ORIGIN).set("Cookie", user.cookie),
    post: (url: string) =>
      request(app).post(url).set("Origin", STUDIO_ORIGIN).set("Cookie", user.cookie),
  };
}

function storedProfile(fullName: string) {
  return buildResumeShell({
    basics: {
      fullName,
      role: "Engineer",
      headline: "",
      email: "",
      phone: "",
      location: "",
      linkEmail: false,
      linkPhone: false,
      linkLocation: false,
    },
    links: [],
    summary: "",
    projects: [],
    skills: [],
  });
}

const PROFILE_TEXT = "Jane Doe. Senior engineer at Example Corp since 2020. Builds things.";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  convertResume.mockReset();
});

describe("POST /profiles/import/linkedin side effects (V-022)", () => {
  it("free user with an existing resume and replaceMaster: 402, profile and quota untouched, no AI call", async () => {
    const user = await createUserWithSession();
    const api = asUser(user);

    await prisma.masterProfile.create({
      data: { userId: user.id, content: storedProfile("Original Name") },
    });
    const before = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: user.id } });

    expect(
      (await api.post("/api/v1/documents").send({ type: "RESUME", title: "Existing" })).status,
    ).toBe(201);

    const response = await api
      .post("/api/v1/profiles/import/linkedin")
      .send({ profileText: PROFILE_TEXT, replaceMaster: true });

    expect(response.status).toBe(402);
    expect(convertResume).not.toHaveBeenCalled();

    const after = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(after.content).toEqual(before.content);
    expect(after.updatedAt.toISOString()).toBe(before.updatedAt.toISOString());

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.lastLinkedinImportAt).toBeNull();
    expect(await prisma.document.count({ where: { userId: user.id } })).toBe(1);
  });

  it("an AI failure after the quota check leaves the quota unconsumed", async () => {
    const user = await createUserWithSession();
    convertResume.mockRejectedValueOnce(new Error("provider down"));

    const response = await asUser(user)
      .post("/api/v1/profiles/import/linkedin")
      .send({ profileText: PROFILE_TEXT, replaceMaster: false });

    expect(response.status).toBe(502);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.lastLinkedinImportAt).toBeNull();
    expect(await prisma.document.count({ where: { userId: user.id } })).toBe(0);
  });

  it("a successful import consumes the quota, replaces the profile and creates the document together", async () => {
    const user = await createUserWithSession();
    const api = asUser(user);
    await prisma.masterProfile.create({
      data: { userId: user.id, content: storedProfile("Original Name") },
    });

    convertResume.mockResolvedValueOnce({
      result: { basics: { fullName: "Jane Doe" }, summary: "Builds things." },
      rejected: [],
    });

    const response = await api
      .post("/api/v1/profiles/import/linkedin")
      .send({ profileText: PROFILE_TEXT, replaceMaster: true });

    expect(response.status).toBe(200);
    expect(response.body.data.type).toBe("RESUME");

    const profile = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: user.id } });
    expect((profile.content as { basics: { fullName: string } }).basics.fullName).toBe("Jane Doe");

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.lastLinkedinImportAt).toBeInstanceOf(Date);
    expect(await prisma.document.count({ where: { userId: user.id, deletedAt: null } })).toBe(1);

    // The profile cache was invalidated by the import, not left holding the old content.
    const fetched = await api.get("/api/v1/profiles/master");
    expect(fetched.body.data.profile.content.basics.fullName).toBe("Jane Doe");

    // Quota is now spent for a free user.
    const again = await api
      .post("/api/v1/profiles/import/linkedin")
      .send({ profileText: PROFILE_TEXT, replaceMaster: false });
    expect(again.status).toBe(429);
  });
});

describe("POST /profiles/import/github (V-144 / V-022)", () => {
  it("rejects an invalid username taken from a URL with 400 before any network call", async () => {
    const user = await createUserWithSession();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const cases = [
      "https://github.com/-leading-dash",
      "https://github.com/",
      "https://gitlab.com/someone",
      "https://github.com/this-username-is-far-too-long-for-github-to-accept",
      "https://github.com/octo%20cat",
      "octo.cat",
    ];

    for (const usernameOrUrl of cases) {
      const response = await asUser(user)
        .post("/api/v1/profiles/import/github")
        .send({ usernameOrUrl, replaceMaster: false });
      expect(response.status, usernameOrUrl).toBe(400);
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not consume the free GitHub quota when the profile fetch 404s", async () => {
    const user = await createUserWithSession();
    await prisma.account.create({
      data: { userId: user.id, providerId: "github", accountId: "12345", accessToken: "gho_test" },
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "https://api.github.com/user") return jsonResponse({ login: "octocat" });
      if (url.startsWith("https://api.github.com/users/octocat"))
        return jsonResponse({ message: "Not Found" }, 404);
      throw new Error(`unexpected fetch ${url}`);
    });

    const response = await asUser(user)
      .post("/api/v1/profiles/import/github")
      .send({ usernameOrUrl: "octocat", replaceMaster: false });

    expect(response.status).toBe(404);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.lastGithubImportAt).toBeNull();
    expect(await prisma.document.count({ where: { userId: user.id } })).toBe(0);
  });

  it("a free user whose quota is spent is refused before GitHub is called", async () => {
    const user = await createUserWithSession();
    await prisma.user.update({ where: { id: user.id }, data: { lastGithubImportAt: new Date() } });
    await prisma.account.create({
      data: { userId: user.id, providerId: "github", accountId: "67890", accessToken: "gho_test" },
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await asUser(user)
      .post("/api/v1/profiles/import/github")
      .send({ usernameOrUrl: "octocat", replaceMaster: false });

    expect(response.status).toBe(429);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
