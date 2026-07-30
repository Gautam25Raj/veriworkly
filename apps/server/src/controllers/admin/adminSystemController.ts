import { adminHandler } from "#controllers/admin/adminRequestHandler";

import * as AdminSystemService from "#services/admin/adminSystemService";
import { ADMIN_AUDIT_ACTIONS, recordAdminAudit } from "#services/admin/adminAuditService";

import { adminRequestLogQuerySchema } from "#validators/admin/adminAuditValidator";
import {
  adminCacheFlushSchema,
  adminGithubSyncSchema,
  adminUsageMetricsQuerySchema,
} from "#validators/admin/adminSystemValidator";

export const AdminSystemController = {
  /** GET /admin/system/health — per-dependency probe, reports degraded rather than failing. */
  health: adminHandler(
    () => AdminSystemService.getSystemHealth(),
    "System health fetched successfully",
  ),

  /** GET /admin/system/jobs — background job freshness and unresolved queues. */
  jobs: adminHandler(() => AdminSystemService.getJobStatus(), "Job status fetched successfully"),

  /** GET /admin/system/metrics — daily usage series, with today read live from Redis. */
  metrics: adminHandler(async ({ req }) => {
    const query = adminUsageMetricsQuerySchema.parse(req.query);
    return AdminSystemService.getUsageMetrics(query);
  }, "Usage metrics fetched successfully"),

  /** GET /admin/system/dashboard — legacy combined GitHub + usage payload. */
  dashboard: adminHandler(
    () => AdminSystemService.getDashboardMetrics(),
    "Dashboard metrics fetched successfully",
  ),

  /** GET /admin/system/github */
  github: adminHandler(
    () => AdminSystemService.getGithubSyncStatus(),
    "GitHub sync status fetched successfully",
  ),

  /** POST /admin/system/github/sync — manual sync, normally driven by a 12-hourly job. */
  syncGithub: adminHandler(async ({ req, actorId }) => {
    const input = adminGithubSyncSchema.parse(req.body);

    const result = await AdminSystemService.triggerGithubSync(input.force);

    await recordAdminAudit({
      actorId,
      action: ADMIN_AUDIT_ACTIONS.githubSync,
      targetType: "GitHubSync",
      reason: input.reason,
      metadata: { force: input.force },
    });

    return result;
  }, "GitHub sync triggered successfully"),

  /** GET /admin/system/request-logs — the API request trail, for incident triage. */
  requestLogs: adminHandler(async ({ req }) => {
    const query = adminRequestLogQuerySchema.parse(req.query);
    return AdminSystemService.listRequestLogs(query);
  }, "Request logs fetched successfully"),

  /** POST /admin/system/cache/flush — restricted to platform-owned key prefixes. */
  flushCache: adminHandler(async ({ req, actorId }) => {
    const input = adminCacheFlushSchema.parse(req.body);

    const result = await AdminSystemService.flushCache(input.prefix);

    await recordAdminAudit({
      actorId,
      action: ADMIN_AUDIT_ACTIONS.cacheFlush,
      targetType: "Cache",
      targetId: input.prefix,
      reason: input.reason,
      metadata: { targets: result.targets },
    });

    return result;
  }, "Cache flushed successfully"),
};
