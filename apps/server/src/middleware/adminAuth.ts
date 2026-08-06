import { Request, Response, NextFunction } from "express";

import { config } from "#config";

import { prisma } from "#lib/prisma";
import { logger } from "#lib/logger";
import { createErrorResponse } from "#lib/errors";
import { isAdminUser } from "#lib/isAdminUser";
import { getSessionUserFromRequest } from "#middleware/auth";

/**
 * The authoritative gate on every `/api/v1/admin/*` route.
 *
 * It checks three things, in order, and fails closed at each:
 *
 * 1. `ADMIN_EMAIL` is configured. An unset admin email must never mean "everyone is admin".
 * 2. The session's email matches it.
 * 3. That account's email is actually verified, read from the database rather than the session.
 *
 * Step 3 is the addition worth explaining. The session user is a cached projection carrying
 * only `{ id, email, name }`, so an email address in a session was previously sufficient on its
 * own to grant every admin capability — including deleting users and adjusting credit balances.
 * Account linking is enabled for Google, GitHub and LinkedIn (`auth/index.ts`), and a trusted
 * provider will link on a matching email; GitHub in particular can surface an address the user
 * has not proven they control. Requiring `emailVerified` from the `User` row closes that path
 * and costs one indexed primary-key lookup on an admin-only route.
 *
 * The lookup deliberately does NOT require `role === "ADMIN"`. Nothing in the codebase promotes
 * the configured admin's row on first sign-in, so requiring it would lock the operator out of
 * the panel that sets roles — a bootstrap deadlock. The mismatch is logged instead.
 */
export async function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    if (!config.admin.email)
      return res.status(500).json(createErrorResponse(500, "ADMIN_EMAIL is not configured"));

    const sessionUser = await getSessionUserFromRequest(req);

    if (!sessionUser?.email)
      return res.status(401).json(createErrorResponse(401, "Authentication required"));

    if (!isAdminUser(sessionUser.email))
      return res.status(403).json(createErrorResponse(403, "Forbidden"));

    const account = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { emailVerified: true, email: true, role: true },
    });

    // The session outlived the account, or the address on the row no longer matches the one the
    // session was minted with (an email change). Either way this is no longer the admin.
    if (!account || !isAdminUser(account.email))
      return res.status(403).json(createErrorResponse(403, "Forbidden"));

    if (!account.emailVerified) {
      logger.warn("Admin access denied: configured admin email is not verified", {
        userId: sessionUser.id,
      });

      return res.status(403).json(createErrorResponse(403, "Forbidden"));
    }

    if (account.role !== "ADMIN") {
      // Not fatal (see the note above on the bootstrap deadlock), but it means the database and
      // ADMIN_EMAIL disagree about who the operator is, which is worth seeing in the logs.
      logger.warn("Admin access granted to an account whose role column is not ADMIN", {
        userId: sessionUser.id,
        role: account.role,
      });
    }
  } catch (error) {
    logger.error("Admin auth middleware failure", error);
    return res.status(401).json(createErrorResponse(401, "Invalid or expired session"));
  }

  next();
}
