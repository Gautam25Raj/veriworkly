import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `admin-server.ts` is a server module: it imports the `server-only` guard (which throws when
// resolved outside a React Server Component) and reads request cookies. Both are stubbed so the
// data-loading contract below can be exercised in a plain node environment.
vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ toString: () => "veriworkly-auth.session_token=test-session" }),
}));

const ORIGINAL_FETCH = globalThis.fetch;

function respondWith(status: number, body: unknown) {
  globalThis.fetch = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  ) as unknown as typeof fetch;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_BACKEND_URL ||= "http://localhost:8080/api/v1";
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

/**
 * Admin detail pages (`/admin/users/[id]`, `/admin/affiliates/[id]`, `/admin/portfolios/[id]`,
 * `/admin/ambassadors/[id]`) must distinguish "this record does not exist" from "the API is
 * broken". They previously wrote `fetchX(id).catch(() => null)` and then `notFound()`, which
 * rendered a 404 for a 500, an expired session or an unreachable API — telling an operator that
 * a user who plainly exists does not, and leaving each `[id]/error.tsx` unreachable.
 */
describe("admin detail loading contract", () => {
  it("carries the upstream status on the thrown error", async () => {
    const { AdminApiError, fetchAdminUserDetail } =
      await import("@/features/admin/services/admin-server");

    respondWith(500, { message: "Database unavailable" });

    const error = await fetchAdminUserDetail("user-1").catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(AdminApiError);
    expect((error as InstanceType<typeof AdminApiError>).status).toBe(500);
  });

  it("returns null only for a genuine 404, so the page can call notFound()", async () => {
    const { fetchAdminUserDetail, loadAdminDetail } =
      await import("@/features/admin/services/admin-server");

    respondWith(404, { message: "User not found." });

    await expect(loadAdminDetail(fetchAdminUserDetail("missing"))).resolves.toBeNull();
  });

  it("rethrows a server error instead of degrading it into a not-found page", async () => {
    const { fetchAdminUserDetail, loadAdminDetail } =
      await import("@/features/admin/services/admin-server");

    respondWith(500, { message: "Database unavailable" });

    await expect(loadAdminDetail(fetchAdminUserDetail("user-1"))).rejects.toThrow(
      /Admin request failed \(500\)/,
    );
  });

  it("rethrows an auth failure rather than claiming the record is missing", async () => {
    const { fetchAdminUserDetail, loadAdminDetail } =
      await import("@/features/admin/services/admin-server");

    respondWith(403, { message: "Forbidden" });

    await expect(loadAdminDetail(fetchAdminUserDetail("user-1"))).rejects.toThrow(
      /Admin request failed \(403\)/,
    );
  });

  it("rethrows a transport failure, which carries no HTTP status at all", async () => {
    const { loadAdminDetail } = await import("@/features/admin/services/admin-server");

    await expect(loadAdminDetail(Promise.reject(new TypeError("fetch failed")))).rejects.toThrow(
      /fetch failed/,
    );
  });

  // The defect lived in the pages, not the service, so guard the call site too: any detail page
  // that goes back to catching everything would pass the unit tests above while reintroducing
  // exactly the reported symptom.
  it("keeps every admin detail page routed through loadAdminDetail", async () => {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");

    const pages = [
      "app/admin/users/[id]/page.tsx",
      "app/admin/affiliates/[id]/page.tsx",
      "app/admin/portfolios/[id]/page.tsx",
      "app/admin/ambassadors/[id]/page.tsx",
    ];

    for (const page of pages) {
      const source = await readFile(path.join(process.cwd(), page), "utf8");

      expect(source, `${page} must not swallow every fetch failure`).not.toMatch(
        /\.catch\(\(\)\s*=>\s*null\)/,
      );
      expect(source, `${page} must load its record through loadAdminDetail`).toContain(
        "loadAdminDetail(",
      );
    }
  });

  it("passes a successful payload straight through", async () => {
    const { fetchAdminUserDetail, loadAdminDetail } =
      await import("@/features/admin/services/admin-server");

    respondWith(200, { success: true, message: "ok", data: { user: { id: "user-1" } } });

    await expect(loadAdminDetail(fetchAdminUserDetail("user-1"))).resolves.toEqual({
      user: { id: "user-1" },
    });
  });
});
