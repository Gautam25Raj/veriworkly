import "server-only";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { backendApiUrl } from "@/lib/constants";
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
  AdminCommissionRow,
  AdminCreditWalletRow,
  AdminDocumentRow,
  AdminEntitlementRow,
  AdminGithubStatus,
  AdminJobStatus,
  AdminOverview,
  AdminPaginatedResponse,
  AdminPortfolioDetail,
  AdminPortfolioRow,
  AdminRecentActivity,
  AdminReferralRow,
  AdminRequestLogRow,
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

async function getCookieHeaderValue() {
  const cookieStore = await cookies();
  return cookieStore.toString();
}

/**
 * Frontend defense-in-depth for `/admin/*`: fails closed (404, not a leaky 403) if the
 * signed-in user isn't the configured admin. This must never be the ONLY check — the
 * backend's `adminAuthMiddleware` remains the authoritative gate on every admin API
 * route — but without this, any authenticated user could reach the admin shell UI even
 * if every fetch call inside it then failed. `ADMIN_EMAIL` here is a server-only env
 * var (never `NEXT_PUBLIC_*`), so the admin identity never reaches the client bundle.
 */
export async function requireAdminUser() {
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
}

function normalizeHeaders(headers?: HeadersInit) {
  return Object.fromEntries(new Headers(headers ?? {}).entries());
}

function firstPartyServerHeaders(headers?: HeadersInit) {
  const normalizedHeaders = normalizeHeaders(headers);
  const siteOrigin = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : "";

  if (!siteOrigin) return normalizedHeaders;

  return {
    Origin: siteOrigin,
    ...normalizedHeaders,
  };
}

async function fetchWithSession(path: string, options?: RequestInit) {
  const cookieHeader = await getCookieHeaderValue();

  return fetch(backendApiUrl(path), {
    ...options,
    cache: "no-store",
    headers: firstPartyServerHeaders({
      "Content-Type": "application/json",
      cookie: cookieHeader,
      ...(options?.headers ?? {}),
    }),
  });
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
 * The shell renders queue badges on every admin page, so this runs on every navigation. It
 * intentionally hits the cheap standalone endpoint rather than reading `actionQueue` off the
 * full overview payload, which would run every domain summary aggregate to display six counts.
 *
 * Unlike every other reader here it swallows failures and returns zeros: the badges are an
 * affordance, and a transient counting error must not take down the navigation of a page whose
 * own data loaded fine.
 */
export async function fetchAdminActionQueue(): Promise<AdminActionQueue> {
  try {
    return await fetchAdmin<AdminActionQueue>("/overview/queue");
  } catch {
    return {
      pendingAmbassadorApplications: 0,
      pendingWithdrawals: 0,
      pendingCommissions: 0,
      failedWebhooks: 0,
      suspendedPortfolios: 0,
      pendingPortfolioAssets: 0,
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

export function fetchAdminPortfolioDetail(id: string, days = 30) {
  return fetchAdmin<AdminPortfolioDetail>(`/portfolios/${id}${buildAdminQuery({ days })}`);
}

/* ── Documents & share links ──────────────────────────────────────────────────────── */

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
  return fetchAdmin<AdminOverview["billing"]>("/billing/summary");
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
  return fetchAdmin<AdminPaginatedResponse<AdminRequestLogRow>>(
    `/system/request-logs${buildAdminQuery(params)}`,
  );
}

/* ── Roadmap (reads come from the public router) ──────────────────────────────────── */

export async function fetchAdminRoadmapServer(sort = "newest") {
  const response = await fetchWithSession(`/roadmap?sort=${sort}&limit=20&offset=0`, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`Roadmap request failed (${response.status})`);
  }

  const payload = (await response.json()) as ApiSuccessResponse<{
    items: RoadmapFeature[];
    total: number;
  }>;

  return payload.data.items;
}

export async function fetchAdminRoadmapFeatureServer(id: string) {
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
