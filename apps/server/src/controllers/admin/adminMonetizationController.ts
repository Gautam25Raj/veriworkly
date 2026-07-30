import { adminHandler } from "#controllers/admin/adminRequestHandler";

import { prisma } from "#lib/prisma";
import { AffiliateService } from "#services/affiliate/index";

/**
 * The original combined monetization overview, preserved verbatim for the compatibility route.
 *
 * Its `{ affiliate, audits }` shape is what the pre-split admin UI consumed. Richer, paginated
 * equivalents now live on `/admin/affiliates/summary`, `/admin/billing/summary` and
 * `/admin/audit`; this exists so an older client does not break.
 */
export const AdminMonetizationController = {
  overview: adminHandler(async () => {
    const [affiliate, audits] = await Promise.all([
      AffiliateService.adminOverview(),
      prisma.adminAuditEntry.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    ]);

    return { affiliate, audits };
  }, "Monetization overview fetched successfully"),
};
