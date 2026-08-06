import { adminHandler } from "#controllers/admin/adminRequestHandler";
import * as AdminOverviewService from "#services/admin/adminOverviewService";
import { getAdminTimeSeries } from "#services/admin/adminTimeSeriesService";
import {
  adminOverviewQuerySchema,
  adminTimeSeriesQuerySchema,
} from "#validators/admin/adminSystemValidator";

export const AdminOverviewController = {
  /** GET /admin/overview — every domain summary plus the operator action queue. */
  getOverview: adminHandler(async ({ req }) => {
    const { days } = adminOverviewQuerySchema.parse(req.query);
    return AdminOverviewService.getAdminOverview(days);
  }, "Admin overview fetched successfully"),

  /** GET /admin/overview/activity — recent signups, publishes, subscriptions, applications. */
  getRecentActivity: adminHandler(
    () => AdminOverviewService.getRecentActivity(),
    "Recent activity fetched successfully",
  ),

  /** GET /admin/overview/queue — just the six action-queue counts, for the shell's nav badges. */
  getActionQueue: adminHandler(
    () => AdminOverviewService.getActionQueue(),
    "Action queue fetched successfully",
  ),

  /** GET /admin/overview/series — daily buckets for every metric the dashboard charts. */
  getTimeSeries: adminHandler(async ({ req }) => {
    const { days } = adminTimeSeriesQuerySchema.parse(req.query);
    return getAdminTimeSeries(days);
  }, "Admin time series fetched successfully"),
};
