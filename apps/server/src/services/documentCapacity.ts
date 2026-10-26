import type { DocumentType, Prisma } from "@prisma/client";

import { prisma } from "#lib/prisma";
import { ApiError } from "#lib/errors";
import { EntitlementService, PAID_ACCESS_PHRASE } from "#services/entitlementService";

/** `details.code` of the free-tier document limit 402, wherever it is raised (V-201). */
export const DOCUMENT_LIMIT_CODE = "DOCUMENT_LIMIT";

/**
 * Free users keep one active document per type. Callers that do expensive or paid work before
 * the insert (the imports, the AI resume conversion) use this as a pre-check; the authoritative
 * check runs again inside the create transaction under the per-user lock, so two concurrent
 * creates cannot both pass it. Kept out of documentService so the AI paths can use it without
 * loading the document and share services.
 */
export async function assertFreeTierCapacity(
  userId: string,
  type: DocumentType,
  client: Prisma.TransactionClient = prisma,
) {
  // `client` keeps the entitlement count on the caller's transaction connection.
  if (await EntitlementService.isPaid(userId, new Date(), client)) return;

  const activeCount = await client.document.count({
    where: { userId, type, deletedAt: null },
  });

  if (activeCount >= 1) {
    throw new ApiError(
      402,
      `Free accounts can keep 1 active ${type.toLowerCase().replace("_", " ")} at a time. Unlimited documents come with ${PAID_ACCESS_PHRASE}; credit packs add AI credits only.`,
      { code: DOCUMENT_LIMIT_CODE, type },
    );
  }
}
