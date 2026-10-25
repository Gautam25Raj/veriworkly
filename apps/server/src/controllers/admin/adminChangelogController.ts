import { Request, Response, NextFunction } from "express";

import { adminHandler } from "#controllers/admin/adminRequestHandler";
import {
  createChangelogEntry,
  deleteChangelogEntry,
  updateChangelogEntry,
} from "#services/admin/adminChangelogService";
import { type ChangelogType, getChangelogSyncStatus } from "#services/changelog/index";
import { startChangelogSync } from "#services/admin/adminSyncTrigger";

import {
  changelogAdminCreateSchema,
  changelogAdminUpdateSchema,
} from "#validators/changelogValidator";
import { adminIdParamSchema } from "#validators/admin/adminCommonValidator";

import { ADMIN_AUDIT_ACTIONS, recordAdminAudit } from "#services/admin/adminAuditService";
import { requireAuthUser } from "#middleware/auth";

import { createSuccessResponse } from "#lib/errors";

/**
 * Create a new changelog entry (admin only).
 *
 * req.body:
 * - version, title, type and optional release metadata
 *
 * res:
 * - 201 with created entry payload; 409 for a version or id already in use (P2002, central mapper)
 */

export const createChangelogEntryController = adminHandler(async ({ req, res, actorId }) => {
  const payload = changelogAdminCreateSchema.parse(req.body);

  const created = await createChangelogEntry({
    id: payload.id,
    version: payload.version,
    title: payload.title,
    summary: payload.summary,
    type: payload.type as ChangelogType,
    publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : undefined,
    githubUrl: payload.githubUrl,
    added: payload.added,
    improved: payload.improved,
    fixed: payload.fixed,
    breaking: payload.breaking,
    security: payload.security,
    tags: payload.tags,
    prRefs: payload.prRefs,
  });

  await recordAdminAudit({
    actorId,
    action: ADMIN_AUDIT_ACTIONS.changelogCreate,
    targetType: "ChangelogEntry",
    targetId: created.id,
    metadata: { version: created.version, title: created.title },
  });

  res.status(201);
  return created;
}, "Changelog entry created successfully");

/**
 * Update an existing changelog entry by id (admin only).
 *
 * req.params:
 * - id: changelog entry id (required)
 *
 * req.body:
 * - partial changelog entry fields to update
 *
 * res:
 * - 200 with updated entry payload; 409 when the new version is already taken
 */

export const updateChangelogEntryController = adminHandler(async ({ req, actorId }) => {
  const { id } = adminIdParamSchema.parse(req.params);
  const payload = changelogAdminUpdateSchema.parse(req.body);

  const updated = await updateChangelogEntry(id, {
    version: payload.version,
    title: payload.title,
    summary: payload.summary,
    type: payload.type as ChangelogType | undefined,
    publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : undefined,
    githubUrl: payload.githubUrl,
    added: payload.added,
    improved: payload.improved,
    fixed: payload.fixed,
    breaking: payload.breaking,
    security: payload.security,
    tags: payload.tags,
    prRefs: payload.prRefs,
  });

  await recordAdminAudit({
    actorId,
    action: ADMIN_AUDIT_ACTIONS.changelogUpdate,
    targetType: "ChangelogEntry",
    targetId: id,
    metadata: { fields: Object.keys(payload) },
  });

  return updated;
}, "Changelog entry updated successfully");

/**
 * Delete a changelog entry by id (admin only).
 *
 * req.params:
 * - id: changelog entry id (required)
 *
 * res:
 * - 200 with deleted id payload
 *
 * next:
 * - forwards runtime errors to global error handler
 */

export async function deleteChangelogEntryController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = adminIdParamSchema.parse(req.params);

    const deleted = await deleteChangelogEntry(id);

    await recordAdminAudit({
      actorId: requireAuthUser(req).id,
      action: ADMIN_AUDIT_ACTIONS.changelogDelete,
      targetType: "ChangelogEntry",
      targetId: id,
    });

    res.json(createSuccessResponse(deleted, "Changelog entry deleted successfully"));
  } catch (error) {
    next(error);
  }
}

/**
 * Manually trigger a sync of missing GitHub releases into the changelog (admin only).
 *
 * The sync pages through GitHub for minutes, so it runs in the background (V-080).
 *
 * res:
 * - 202 with { status: "started", statusUrl }; poll GET /admin/changelog/sync for the outcome
 * - 409 if a sync is already in progress, 503 when Redis (which holds the lock) is down
 */

export const syncChangelogReleasesController = adminHandler(async ({ res, actorId }) => {
  const started = await startChangelogSync();

  // After the start, so a refused sync (409/503) leaves no entry. Never throws: a failed write is
  // logged, and the admin still gets the 202 for the sync that is running.
  await recordAdminAudit({
    actorId,
    action: ADMIN_AUDIT_ACTIONS.changelogSync,
    targetType: "ChangelogEntry",
  });

  res.status(202);
  return started;
}, "Changelog release sync started");

/**
 * Whether a release sync is running, and how the last one went (admin only).
 *
 * res:
 * - 200 with { running, lastRun: { status, startedAt, finishedAt?, result?, error? } | null };
 *   both null when Redis cannot be read
 */

export const changelogSyncStatusController = adminHandler(
  () => getChangelogSyncStatus(),
  "Changelog release sync status fetched successfully",
);
