import { adminHandler } from "#controllers/admin/adminRequestHandler";
import * as AdminOverviewService from "#services/admin/adminOverviewService";
import { adminOverviewQuerySchema } from "#validators/admin/adminSystemValidator";

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
};
