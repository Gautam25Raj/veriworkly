import { readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `admin-server.ts` is a server module: the `server-only` guard and request cookies are stubbed so
// it runs in a plain node environment, and the session lookup is replaced so each test decides
// who is signed in without a backend.
vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ toString: () => "veriworkly-auth.session_token=test-session" }),
  headers: async () => new Headers(),
}));

const session = vi.hoisted(() => ({
  user: { id: "admin-1", email: "admin@example.com" } as {
    id: string;
    email: string;
  } | null,
}));

vi.mock("@/features/auth/services/current-user", () => ({
  fetchCurrentUser: async () => session.user,
}));

const ORIGINAL_FETCH = globalThis.fetch;

type FetchCall = { url: string; init: RequestInit };

function mockFetch(handler: (url: URL, init: RequestInit) => { status: number; body: unknown }) {
  const calls: FetchCall[] = [];

  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    calls.push({ url: url.toString(), init });
    const { status, body } = handler(url, init);

    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;

  return calls;
}

function roadmapItem(index: number) {
  return {
    id: `feature-${index}`,
    title: `Feature ${index}`,
    description: "d",
    status: "todo",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_BACKEND_URL ||= "http://localhost:8080/api/v1";
  process.env.ADMIN_EMAIL = "admin@example.com";
  session.user = { id: "admin-1", email: "admin@example.com" };
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe("admin server contract", () => {
  it("S-042: follows hasMore so a 25-item roadmap shows all 25", async () => {
    const all = Array.from({ length: 25 }, (_, index) => roadmapItem(index));

    const calls = mockFetch((url) => {
      // Pages smaller than asked for, so only `hasMore` can tell the client there is more.
      const limit = Math.min(Number(url.searchParams.get("limit")), 20);
      const offset = Number(url.searchParams.get("offset"));
      const items = all.slice(offset, offset + limit);
      const hasMore = offset + limit < all.length;

      return {
        status: 200,
        body: {
          success: true,
          message: "ok",
          data: {
            items,
            total: all.length,
            limit,
            offset,
            hasMore,
            pagination: { mode: "offset", nextOffset: hasMore ? offset + limit : null },
          },
        },
      };
    });

    const { fetchAdminRoadmapServer } = await import("@/features/admin/services/admin-server");
    const items = await fetchAdminRoadmapServer();

    expect(items).toHaveLength(25);
    expect(new Set(items.map((item) => item.id)).size).toBe(25);
    expect(calls.length).toBeGreaterThan(1);
  });

  it("S-049: a non-admin session 404s before any admin API request is made", async () => {
    session.user = { id: "user-1", email: "someone@example.com" };
    const calls = mockFetch(() => ({ status: 200, body: { success: true, data: {} } }));

    const { fetchAdminUsers } = await import("@/features/admin/services/admin-server");
    const error = (await fetchAdminUsers().catch((thrown: unknown) => thrown)) as {
      digest?: string;
    };

    expect(error?.digest).toMatch(/404/);
    expect(calls).toHaveLength(0);
  });

  it("S-049: requireAdminUser 404s when ADMIN_EMAIL is unset", async () => {
    delete process.env.ADMIN_EMAIL;

    const { requireAdminUser } = await import("@/features/admin/services/admin-server");
    const error = (await requireAdminUser().catch((thrown: unknown) => thrown)) as {
      digest?: string;
    };

    expect(error?.digest).toMatch(/404/);
  });

  it("S-050: document and portfolio pages read their own summaries, not the full overview", async () => {
    for (const page of ["app/admin/documents/page.tsx", "app/admin/portfolios/page.tsx"]) {
      const source = await readFile(path.join(process.cwd(), page), "utf8");

      expect(source, page).not.toContain("fetchAdminOverview");
    }

    const calls = mockFetch(() => ({ status: 200, body: { success: true, data: {} } }));
    const { fetchAdminDocumentSummary, fetchAdminPortfolioSummary } =
      await import("@/features/admin/services/admin-server");

    await fetchAdminDocumentSummary();
    await fetchAdminPortfolioSummary();

    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/api/v1/admin/documents/summary",
      "/api/v1/admin/portfolios/summary",
    ]);
  });

  it("S-187: an unreadable queue reports unknown counts, never zeros", async () => {
    mockFetch(() => ({ status: 500, body: { message: "boom" } }));

    const { fetchAdminActionQueue } = await import("@/features/admin/services/admin-server");
    const queue = await fetchAdminActionQueue();

    expect(Object.values(queue).every((count) => count === null)).toBe(true);
  });

  it("S-187: an overview section that failed reads as unavailable", async () => {
    const { adminSection } = await import("@/features/admin/types/admin-types");

    expect(adminSection({ error: true })).toBeNull();
    expect(adminSection({ total: 3 })).toEqual({ total: 3 });
  });
});

describe("admin chart trend", () => {
  it("S-144: a flat series has no trend", async () => {
    const { trendFromSeries } = await import("@/components/admin/charts/geometry");

    expect(trendFromSeries([5, 5, 5, 5, 5, 5, 5])).toBe(0);
    expect(trendFromSeries([5, 5, 5, 5, 5, 5])).toBe(0);
    expect(trendFromSeries([1, 1, 1, 9, 3, 3, 3])).toBe(200);
  });
});

describe("admin mutation contract", () => {
  it("S-077: a roadmap create body carries no null fields", async () => {
    const calls = mockFetch(() => ({ status: 201, body: { success: true, data: { id: "f" } } }));

    const { buildRoadmapPayload } = await import("@/app/admin/roadmap/components/roadmap-payload");
    const { createRoadmapFeature } = await import("@/features/roadmap/services/admin-roadmap");

    const empty = {
      title: " New ",
      description: " Desc ",
      status: "todo" as const,
      eta: "",
      completedQuarter: "",
      tags: "",
      fullDescription: "",
      whyItMatters: "",
      timeline: "",
      startedAt: "",
      completedAt: "",
      detailsJson: "",
    };

    await createRoadmapFeature(buildRoadmapPayload(empty, "create"));

    const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    expect(Object.values(body)).not.toContain(null);
    expect(body).toEqual({ title: "New", description: "Desc", status: "todo", tags: [] });

    // An edit still clears a field the operator emptied.
    expect(buildRoadmapPayload(empty, "edit").startedAt).toBeNull();
  });

  it("S-077: a rejected roadmap write shows the server's message", async () => {
    mockFetch(() => ({ status: 400, body: { message: "completedAt: Invalid datetime" } }));

    const { createRoadmapFeature } = await import("@/features/roadmap/services/admin-roadmap");

    await expect(
      createRoadmapFeature({ title: "t", description: "d", status: "todo" }),
    ).rejects.toThrow("completedAt: Invalid datetime");
  });

  it("S-186: a credit adjustment carries an idempotency key", async () => {
    const calls = mockFetch(() => ({ status: 200, body: { success: true, data: {} } }));

    const { adjustAdminCredits } = await import("@/features/admin/services/admin-actions");
    await adjustAdminCredits("user-1", 50, "goodwill", "attempt-1");

    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      userId: "user-1",
      amount: 50,
      reason: "goodwill",
      idempotencyKey: "attempt-1",
    });
  });

  it("S-186/S-090: optional reasons may be blank but never 1–2 characters", async () => {
    const { isAdminReasonValid } = await import("@/components/admin/admin-reason");

    expect(isAdminReasonValid("", { required: false, minLength: 3 })).toBe(true);
    expect(isAdminReasonValid("ok", { required: false, minLength: 3 })).toBe(false);
    expect(isAdminReasonValid("", { required: true, minLength: 3 })).toBe(false);
    expect(isAdminReasonValid("too short", { required: true, minLength: 10 })).toBe(false);
    expect(isAdminReasonValid("long enough", { required: true, minLength: 10 })).toBe(true);
  });

  it("S-090: suspending a portfolio asks for the server's 10-character minimum", async () => {
    const source = await readFile(
      path.join(process.cwd(), "app/admin/portfolios/PortfolioModerationActions.tsx"),
      "utf8",
    );

    expect(source).toMatch(/minReasonLength=\{nextStatus === "SUSPENDED" \? 10 : 3\}/);
  });

  it("S-186: suspension reasons are shown without the internal moderation prefix", async () => {
    const { formatSuspensionReason } = await import("@/features/admin/utils/admin-format");

    expect(formatSuspensionReason("moderation:Spam links")).toBe("Spam links");
    expect(formatSuspensionReason("payment lapsed")).toBe("payment lapsed");
    expect(formatSuspensionReason(null)).toBe("—");
  });

  it("S-189: the admin entitlement list matches the server's", async () => {
    const { ADMIN_ENTITLEMENT_KEYS } = await import("@/features/admin/services/admin-actions");
    const validator = await readFile(
      path.join(process.cwd(), "../server/src/validators/admin/adminBillingValidator.ts"),
      "utf8",
    );
    const serverKeys = [
      ...(validator.match(/ENTITLEMENT_KEYS = \[([^\]]+)\]/)?.[1] ?? "").matchAll(/"([^"]+)"/g),
    ].map((match) => match[1]);

    expect(serverKeys.length).toBeGreaterThan(0);
    expect([...ADMIN_ENTITLEMENT_KEYS].sort()).toEqual([...serverKeys].sort());

    for (const file of [
      "app/admin/billing/BillingActions.tsx",
      "app/admin/billing/entitlements/page.tsx",
      "app/admin/users/[id]/UserAdminActions.tsx",
    ]) {
      const source = await readFile(path.join(process.cwd(), file), "utf8");
      expect(source, file).not.toContain("custom_subdomain");
    }
  });

  it("S-188/S-249: restore and delete failures carry the server's own message", async () => {
    const { deleteAdminUser, restoreAdminDocument } =
      await import("@/features/admin/services/admin-actions");

    mockFetch(() => ({
      status: 410,
      body: {
        message: "This document was deleted and its content has since been permanently removed.",
      },
    }));
    await expect(restoreAdminDocument("doc-1", "owner asked")).rejects.toThrow(
      /permanently removed/,
    );

    mockFetch(() => ({
      status: 409,
      body: { message: "This account has a live subscription. Cancel it first." },
    }));
    await expect(deleteAdminUser("user-1", "a@b.c", "owner asked")).rejects.toThrow(
      /live subscription/,
    );
  });

  it("S-191: a GitHub sync start is accepted as running, and polling reports when it ends", async () => {
    const { fetchAdminGithubSyncRunning, triggerAdminGithubSync } =
      await import("@/features/admin/services/admin-actions");

    mockFetch((url) =>
      url.pathname.endsWith("/sync")
        ? {
            status: 202,
            body: {
              success: true,
              data: { status: "started", statusUrl: "/api/v1/admin/system/github" },
            },
          }
        : { status: 200, body: { success: true, data: { running: false, latestSync: null } } },
    );

    await expect(triggerAdminGithubSync("refresh", false)).resolves.toEqual({
      status: "started",
      statusUrl: "/api/v1/admin/system/github",
    });
    await expect(fetchAdminGithubSyncRunning()).resolves.toBe(false);
  });
});

describe("admin route boundaries", () => {
  async function adminFiles(name: string) {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(path.join(process.cwd(), "app/admin"), { recursive: true });

    return entries
      .map((entry) => entry.split(path.sep).join("/"))
      .filter((entry) => entry === name || entry.endsWith(`/${name}`));
  }

  function routeOf(file: string) {
    const folder = path.posix.dirname(file);
    return folder === "." ? "/admin" : `/admin/${folder}`;
  }

  it("names every admin page in the route table, static siblings before [id]", async () => {
    const { resolveAdminRoute } = await import("@/features/admin/config/admin-routes");

    // A redirect-only page never renders, so it needs no surface or skeleton.
    const pages = (await adminFiles("page.tsx")).filter((page) => page !== "monetization/page.tsx");

    expect(pages.length).toBeGreaterThan(20);

    for (const page of pages) {
      const route = routeOf(page);
      const url = route.replaceAll("[id]", "abc123");

      expect(resolveAdminRoute(url).path, page).toBe(route);
    }

    expect(resolveAdminRoute("/admin/affiliates/commissions").surface).toBe(
      "the commissions queue",
    );
    expect(resolveAdminRoute("/admin/users/abc123").surface).toBe("this user");
    expect(resolveAdminRoute("/admin/nope/at/all").surface).toBe("this page");
  });

  it("has one admin error boundary and one shared loading UI", async () => {
    expect(await adminFiles("error.tsx")).toEqual(["error.tsx"]);

    const loaders = await adminFiles("loading.tsx");
    expect(loaders).toContain("loading.tsx");

    for (const loader of loaders.filter((file) => file !== "loading.tsx")) {
      const source = await readFile(path.join(process.cwd(), "app/admin", loader), "utf8");
      expect(source.trim(), loader).toBe('export { default } from "../loading";');
    }
  });

  it("gives each list and detail page a skeleton with its own stat row and side form", async () => {
    const { resolveAdminRoute } = await import("@/features/admin/config/admin-routes");

    for (const page of await adminFiles("page.tsx")) {
      const { skeleton, path: route } = resolveAdminRoute(routeOf(page).replaceAll("[id]", "x"));
      if (route !== routeOf(page)) continue;

      const source = await readFile(path.join(process.cwd(), "app/admin", page), "utf8");
      const statRow = source.match(/<section className="grid gap-3[^"]*">([\s\S]*?)<\/section>/);
      const statCount = statRow?.[1].match(/<AdminStatCard\b/g)?.length;

      if (skeleton.kind === "list") {
        expect(skeleton.stats, page).toBe(statCount);
        expect(Boolean(skeleton.aside), page).toBe(source.includes("aside={"));
      }

      if (skeleton.kind === "detail") {
        expect(skeleton.stats, page).toBe(statCount);
      }
    }

    expect(resolveAdminRoute("/admin/roadmap").skeleton.kind).toBe("kanban");
  });
});
