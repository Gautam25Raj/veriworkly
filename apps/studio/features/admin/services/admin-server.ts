import "server-only";

import { cache } from "react";
import { notFound, unstable_rethrow } from "next/navigation";

import { serverFetch } from "@/lib/server-fetch";
import { fetchCurrentUser } from "@/features/auth/services/current-user";

import type { RoadmapFeature } from "@/features/roadmap/services/roadmap-backend";

import type {
  AdminActionQueue,
  AdminAffiliateRow,
  AdminAffiliateSummary,
  AdminAmbassadorRosterRow,
  AdminAmbassadorRow,
  AdminAmbassadorSummary,
  AdminApiKeyRow,
  AdminApiKeySummary,
  AdminAuditEntry,
  AdminAuditFilters,
  AdminBillingSummary,
  AdminCommissionRow,
  AdminCreditWalletRow,
  AdminDocumentRow,
  AdminDocumentSummary,
  AdminEntitlementRow,
  AdminGithubStatus,
  AdminJobStatus,
  AdminOverview,
  AdminPaginatedResponse,
  AdminPortfolioDetail,
  AdminPortfolioRow,
  AdminPortfolioSummary,
  AdminRecentActivity,
  AdminReferralRow,
  AdminRequestLogPage,
  AdminShareLinkRow,
  AdminSubscriptionRow,
  AdminSystemHealth,
  AdminTimeSeries,
  AdminUsageMetrics,
  AdminUserDetail,
  AdminUserRef,
  AdminUserRow,
  AdminWebhookRow,
  AdminWithdrawalRow,
} from "@/features/admin/types/admin-types";

interface ApiSuccessResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface AdminSession {
  user?: {
    email?: string;
    name?: string;
  };
}

/**
 * Frontend defense-in-depth for `/admin/*`: fails closed (404, not a leaky 403) if the
 * signed-in user isn't the configured admin. This must never be the ONLY check — the
 * backend's `adminAuthMiddleware` remains the authoritative gate on every admin API
 * route — but without this, any authenticated user could reach the admin shell UI even
 * if every fetch call inside it then failed. `ADMIN_EMAIL` here is a server-only env
 * var (never `NEXT_PUBLIC_*`), so the admin identity never reaches the client bundle.
 *
 * Wrapped in `cache()` so the layout and every admin read in one request share a single
 * session lookup. Each read awaits it first, so a page's own fetches cannot start before the
 * gate has passed: layouts and pages render in parallel, and a client navigation inside
 * `/admin` does not re-run the layout at all.
 */
export const requireAdminUser = cache(async () => {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!adminEmail) {
    // Fail closed: an unconfigured admin email must never be treated as "anyone is admin".
    notFound();
  }

  const user = await fetchCurrentUser();

  if (!user?.email || user.email.toLowerCase() !== adminEmail) {
    notFound();
  }

  return user;
});

function fetchWithSession(path: string, options?: RequestInit) {
  return serverFetch(path, options);
}

/** Drops empty/undefined params so `?status=` never reaches a strict enum validator. */
export function buildAdminQuery(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === null) continue;
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

/**
 * Carries the upstream HTTP status alongside the message.
 *
 * Callers need to tell "this record does not exist" (404) apart from "the API is broken"
 * (401/403/500/network), because those want opposite UI: a not-found page versus an error
 * boundary the operator can retry from. Before this, the status was only readable by
 * substring-matching the message, so no caller did it.
 */
export class AdminApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

/**
 * Every admin page reads through here.
 *
 * A failed admin fetch throws rather than returning a partial shape: an ops dashboard that
 * silently renders zeros when the API is unreachable is worse than one that shows an error,
 * because the zeros look like real data.
 */
async function fetchAdmin<T>(path: string, options?: RequestInit): Promise<T> {
  await requireAdminUser();

  const response = await fetchWithSession(`/admin${path}`, { method: "GET", ...options });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;

    throw new AdminApiError(
      response.status,
      `Admin request failed (${response.status}): ${body?.message ?? response.statusText}`,
    );
  }

  return ((await response.json()) as ApiSuccessResponse<T>).data;
}

/**
 * Detail-page loader: resolves to `null` only when the record genuinely does not exist, and
 * rethrows everything else so the route's `error.tsx` can explain it.
 *
 * The detail pages used to write `fetchX(id).catch(() => null)` and then `notFound()`, which
 * turned *every* failure — a 500, an expired session, an unreachable API — into "this record
 * does not exist". That sent an operator looking for a user that was plainly there off to
 * check the id, and it made each `[id]/error.tsx` unreachable dead code.
 */
export async function loadAdminDetail<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 404) return null;
    throw error;
  }
}

/* ── Overview ─────────────────────────────────────────────────────────────────────── */

export function fetchAdminOverview(days = 30) {
  return fetchAdmin<AdminOverview>(`/overview${buildAdminQuery({ days })}`);
}

export function fetchAdminRecentActivity() {
  return fetchAdmin<AdminRecentActivity>("/overview/activity");
}

export function fetchAdminTimeSeries(days = 30) {
  return fetchAdmin<AdminTimeSeries>(`/overview/series${buildAdminQuery({ days })}`);
}

/**
 * The shell's queue badges. The admin layout renders on a full load and when a navigation
 * enters `/admin`; client navigations inside the section reuse it, so the counts refresh with
 * `router.refresh()` (every admin action does one), not on every click. It hits the cheap
 * standalone endpoint rather than reading `actionQueue` off the full overview payload, which
 * would run every domain summary aggregate to display six counts.
 *
 * Unlike every other reader here it does not throw: the badges are an affordance, and a
 * transient counting error must not take down a page whose own data loaded fine. A failure is
 * logged and every count comes back `null` (unknown); a zero would claim the queue is empty.
 */
export async function fetchAdminActionQueue(): Promise<AdminActionQueue> {
  try {
    return await fetchAdmin<AdminActionQueue>("/overview/queue");
  } catch (error) {
    unstable_rethrow(error);
    console.error("Admin action queue unavailable", error);

    return {
      pendingAmbassadorApplications: null,
      pendingWithdrawals: null,
      pendingCommissions: null,
      failedWebhooks: null,
      suspendedPortfolios: null,
      pendingPortfolioAssets: null,
    };
  }
}

/* ── Users ────────────────────────────────────────────────────────────────────────── */

export function fetchAdminUsers(params: Record<string, string | number | undefined> = {}) {
  return fetchAdmin<AdminPaginatedResponse<AdminUserRow>>(`/users${buildAdminQuery(params)}`);
}

export function fetchAdminUserDetail(id: string) {
  return fetchAdmin<AdminUserDetail>(`/users/${id}`);
}

/* ── Affiliates ───────────────────────────────────────────────────────────────────── */

export function fetchAdminAffiliateSummary() {
  return fetchAdmin<AdminAffiliateSummary>("/affiliates/summary");
}

export function fetchAdminAffiliates(params: Record<string, string | number | undefined> = {}) {
  return fetchAdmin<AdminPaginatedResponse<AdminAffiliateRow>>(
    `/affiliates${buildAdminQuery(params)}`,
  );
}

export function fetchAdminAffiliateDetail(userId: string) {
  return fetchAdmin<{
    affiliate: AdminAffiliateRow & {
      affiliateWallet: {
        pendingCents: number;
        availableCents: number;
        paidCents: number;
      } | null;
    };
    referrals: AdminReferralRow[];
    commissions: AdminCommissionRow[];
    withdrawals: AdminWithdrawalRow[];
    topReferrerHosts: Array<{ host: string; clicks: number }>;
  }>(`/affiliates/${userId}`);
}

export function fetchAdminCommissions(params: Record<string, string | number | undefined> = {}) {
  return fetchAdmin<AdminPaginatedResponse<AdminCommissionRow> & { totalAmountCents: number }>(
    `/affiliates/commissions${buildAdminQuery(params)}`,
  );
}

export function fetchAdminWithdrawals(params: Record<string, string | number | undefined> = {}) {
  return fetchAdmin<AdminPaginatedResponse<AdminWithdrawalRow> & { totalAmountCents: number }>(
    `/affiliates/withdrawals${buildAdminQuery(params)}`,
  );
}

export function fetchAdminReferrals(params: Record<string, string | number | undefined> = {}) {
  return fetchAdmin<AdminPaginatedResponse<AdminReferralRow>>(
    `/affiliates/referrals${buildAdminQuery(params)}`,
  );
}

/* ── Ambassadors ──────────────────────────────────────────────────────────────────── */

export function fetchAdminAmbassadorSummary() {
  return fetchAdmin<AdminAmbassadorSummary>("/ambassadors/summary");
}

export function fetchAdminAmbassadorApplications(
  params: Record<string, string | number | undefined> = {},
) {
  return fetchAdmin<AdminPaginatedResponse<AdminAmbassadorRow>>(
    `/ambassadors${buildAdminQuery(params)}`,
  );
}

export function fetchAdminAmbassadorRoster(
  params: Record<string, string | number | undefined> = {},
) {
  return fetchAdmin<AdminPaginatedResponse<AdminAmbassadorRosterRow>>(
    `/ambassadors/roster${buildAdminQuery(params)}`,
  );
}

export function fetchAdminAmbassadorApplication(id: string) {
  return fetchAdmin<{
    application: AdminAmbassadorRow;
    reviewer: AdminUserRef | null;
    auditEntries: AdminAuditEntry[];
  }>(`/ambassadors/${id}`);
}

/* ── Portfolios ───────────────────────────────────────────────────────────────────── */

export function fetchAdminPortfolios(params: Record<string, string | number | undefined> = {}) {
  return fetchAdmin<AdminPaginatedResponse<AdminPortfolioRow>>(
    `/portfolios${buildAdminQuery(params)}`,
  );
}

export function fetchAdminPortfolioSummary() {
  return fetchAdmin<AdminPortfolioSummary>("/portfolios/summary");
}

export function fetchAdminPortfolioDetail(id: string, days = 30) {
  return fetchAdmin<AdminPortfolioDetail>(`/portfolios/${id}${buildAdminQuery({ days })}`);
}

/* ── Documents & share links ──────────────────────────────────────────────────────── */

export function fetchAdminDocumentSummary() {
  return fetchAdmin<AdminDocumentSummary>("/documents/summary");
}

export function fetchAdminDocuments(params: Record<string, string | number | undefined> = {}) {
  return fetchAdmin<AdminPaginatedResponse<AdminDocumentRow>>(
    `/documents${buildAdminQuery(params)}`,
  );
}

export function fetchAdminShareLinks(params: Record<string, string | number | undefined> = {}) {
  return fetchAdmin<AdminPaginatedResponse<AdminShareLinkRow>>(
    `/share-links${buildAdminQuery(params)}`,
  );
}

/* ── Billing ──────────────────────────────────────────────────────────────────────── */

export function fetchAdminBillingSummary() {
  return fetchAdmin<AdminBillingSummary>("/billing/summary");
}

export function fetchAdminSubscriptions(params: Record<string, string | number | undefined> = {}) {
  return fetchAdmin<AdminPaginatedResponse<AdminSubscriptionRow>>(
    `/billing/subscriptions${buildAdminQuery(params)}`,
  );
}

export function fetchAdminCreditWallets(params: Record<string, string | number | undefined> = {}) {
  return fetchAdmin<AdminPaginatedResponse<AdminCreditWalletRow>>(
    `/billing/credits${buildAdminQuery(params)}`,
  );
}

export function fetchAdminEntitlements(params: Record<string, string | number | undefined> = {}) {
  return fetchAdmin<AdminPaginatedResponse<AdminEntitlementRow>>(
    `/billing/entitlements${buildAdminQuery(params)}`,
  );
}

export function fetchAdminWebhooks(params: Record<string, string | number | undefined> = {}) {
  return fetchAdmin<AdminPaginatedResponse<AdminWebhookRow>>(
    `/billing/webhooks${buildAdminQuery(params)}`,
  );
}

/* ── Audit ────────────────────────────────────────────────────────────────────────── */

export function fetchAdminAuditEntries(params: Record<string, string | number | undefined> = {}) {
  return fetchAdmin<AdminPaginatedResponse<AdminAuditEntry>>(`/audit${buildAdminQuery(params)}`);
}

export function fetchAdminAuditFilters() {
  return fetchAdmin<AdminAuditFilters>("/audit/filters");
}

/* ── API keys ─────────────────────────────────────────────────────────────────────── */

export function fetchAdminApiKeySummary() {
  return fetchAdmin<AdminApiKeySummary>("/api-keys/summary");
}

export function fetchAdminApiKeys(params: Record<string, string | number | undefined> = {}) {
  return fetchAdmin<AdminPaginatedResponse<AdminApiKeyRow>>(`/api-keys${buildAdminQuery(params)}`);
}

/* ── System ───────────────────────────────────────────────────────────────────────── */

export function fetchAdminSystemHealth() {
  return fetchAdmin<AdminSystemHealth>("/system/health");
}

export function fetchAdminJobStatus() {
  return fetchAdmin<AdminJobStatus>("/system/jobs");
}

export function fetchAdminUsageMetrics(params: Record<string, string | number | undefined> = {}) {
  return fetchAdmin<AdminUsageMetrics>(`/system/metrics${buildAdminQuery(params)}`);
}

export function fetchAdminGithubStatus() {
  return fetchAdmin<AdminGithubStatus>("/system/github");
}

export function fetchAdminRequestLogs(params: Record<string, string | number | undefined> = {}) {
  return fetchAdmin<AdminRequestLogPage>(`/system/request-logs${buildAdminQuery(params)}`);
}

/* ── Roadmap (reads come from the public router) ──────────────────────────────────── */

/** Every roadmap item: the public list is paged (at most 50 a request), so read to the end. */
export async function fetchAdminRoadmapServer(sort = "newest") {
  await requireAdminUser();

  const items = new Map<string, RoadmapFeature>();
  let offset = 0;

  while (true) {
    const query = buildAdminQuery({ sort, limit: 50, offset });
    const response = await fetchWithSession(`/roadmap${query}`, { method: "GET" });

    if (!response.ok) {
      throw new Error(`Roadmap request failed (${response.status})`);
    }

    const payload = (await response.json()) as ApiSuccessResponse<{
      items: RoadmapFeature[];
      hasMore: boolean;
      pagination: { nextOffset: number | null };
    }>;

    for (const item of payload.data.items) {
      if (!items.has(item.id)) items.set(item.id, item);
    }

    if (!payload.data.hasMore || payload.data.pagination.nextOffset === null) break;
    offset = payload.data.pagination.nextOffset;
  }

  return Array.from(items.values());
}

export async function fetchAdminRoadmapFeatureServer(id: string) {
  await requireAdminUser();

  const response = await fetchWithSession(`/roadmap/${id}`, {
    method: "GET",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Roadmap item request failed (${response.status})`);
  }

  const payload = (await response.json()) as ApiSuccessResponse<RoadmapFeature>;
  return payload.data;
}
