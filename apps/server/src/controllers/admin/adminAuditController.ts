import { adminHandler } from "#controllers/admin/adminRequestHandler";

import * as AdminAuditService from "#services/admin/adminAuditService";

import { adminAuditListQuerySchema } from "#validators/admin/adminAuditValidator";

export const AdminAuditController = {
  /** GET /admin/audit — filterable trail of every mutating admin action. */
  list: adminHandler(async ({ req }) => {
    const query = adminAuditListQuerySchema.parse(req.query);
    return AdminAuditService.listAuditEntries(query);
  }, "Audit entries fetched successfully"),

  /** GET /admin/audit/filters — the option lists that populate the audit filter controls. */
  filters: adminHandler(
    () => AdminAuditService.getAuditFilters(),
    "Audit filters fetched successfully",
  ),
};
