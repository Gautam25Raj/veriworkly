import type { Prisma } from "@prisma/client";
import type { z } from "zod";

import { prisma } from "#lib/prisma";
import { ApiError } from "#lib/errors";
import { cacheDel, cacheDelByPrefix } from "#lib/redis";
import { documentListCachePrefix } from "#lib/cacheKeys";

import type {
  AdminDocumentListQuery,
  adminShareLinkListQuerySchema,
} from "#validators/admin/adminDocumentValidator";

type ShareLinkListQuery = z.infer<typeof adminShareLinkListQuerySchema>;

const DOCUMENT_LIST_SELECT = {
  id: true,
  title: true,
  type: true,
  slug: true,
  tags: true,
  templateId: true,
  visibility: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  user: { select: { id: true, name: true, email: true, username: true } },
  _count: { select: { shareLinks: true } },
} satisfies Prisma.DocumentSelect;

export async function getDocumentSummary() {
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [byType, byVisibility, deleted, createdLast30, shareLinks, shareViews] = await Promise.all([
    prisma.document.groupBy({
      by: ["type"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.document.groupBy({
      by: ["visibility"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.document.count({ where: { deletedAt: { not: null } } }),
    prisma.document.count({ where: { createdAt: { gte: since30 } } }),
    prisma.shareLink.count(),
    prisma.shareLink.aggregate({ _sum: { viewCount: true } }),
  ]);

  return {
    byType: Object.fromEntries(byType.map((row) => [row.type, row._count._all])),
    byVisibility: Object.fromEntries(byVisibility.map((row) => [row.visibility, row._count._all])),
    active: byType.reduce((sum, row) => sum + row._count._all, 0),
    softDeleted: deleted,
    createdLast30Days: createdLast30,
    shareLinks,
    shareViews: shareViews._sum.viewCount ?? 0,
  };
}

export async function listDocuments(query: AdminDocumentListQuery) {
  const where: Prisma.DocumentWhereInput = {
    ...(query.includeDeleted ? {} : { deletedAt: null }),
    ...(query.type ? { type: query.type } : {}),
    ...(query.visibility ? { visibility: query.visibility } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.query
      ? {
          OR: [
            { title: { contains: query.query, mode: "insensitive" } },
            { slug: { contains: query.query, mode: "insensitive" } },
            { id: query.query },
            { user: { email: { contains: query.query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.document.findMany({
      where,
      // `content` is a full JSON Resume payload — several KB per row. It is never selected in
      // a list view; the detail endpoint is the only place it is read.
      select: DOCUMENT_LIST_SELECT,
      orderBy: query.sort === "newest" ? { createdAt: "desc" } : { updatedAt: "desc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.document.count({ where }),
  ]);

  return { items, total, limit: query.limit, offset: query.offset };
}

export async function getDocumentDetail(documentId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      ...DOCUMENT_LIST_SELECT,
      metadata: true,
      schemaVersion: true,
      lastSyncedAt: true,
      shareLinks: {
        select: {
          id: true,
          slug: true,
          viewCount: true,
          lastViewedAt: true,
          expiresAt: true,
          createdAt: true,
          passwordHash: true,
        },
      },
      portfolioPublication: {
        select: { id: true, subdomain: true, status: true, updatedAt: true },
      },
    },
  });

  if (!document) throw new ApiError(404, "Document not found.");

  const auditEntries = await prisma.adminAuditEntry.findMany({
    where: { targetType: "Document", targetId: documentId },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { id: true, name: true, email: true } } },
    take: 20,
  });

  return {
    document: {
      ...document,
      // Never leak the hash itself — the operator only needs to know a password exists.
      shareLinks: document.shareLinks.map(({ passwordHash, ...share }) => ({
        ...share,
        passwordProtected: Boolean(passwordHash),
      })),
    },
    auditEntries,
  };
}

/**
 * Documents are cached per owner, so every admin mutation has to invalidate using the owner's
 * id rather than the acting admin's. Forgetting this is why moderation used to appear to do
 * nothing for up to an hour.
 */
async function invalidateOwnerDocumentCaches(
  userId: string,
  documentId: string,
  type: string,
  username: string | null,
  shareSlugs: string[],
) {
  await Promise.all([
    cacheDel(`document:${userId}:${documentId}`),
    cacheDelByPrefix(documentListCachePrefix(userId)),
    cacheDelByPrefix(`share:shared-document-ids:${userId}:`),
    ...(username
      ? shareSlugs.map((slug) => cacheDel(`share:public-readable:${username}:${slug}`))
      : []),
  ]);
}

async function loadDocumentForMutation(documentId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      userId: true,
      type: true,
      title: true,
      visibility: true,
      deletedAt: true,
      user: { select: { username: true } },
      shareLinks: { select: { slug: true } },
    },
  });

  if (!document) throw new ApiError(404, "Document not found.");

  return document;
}

export async function updateDocumentVisibility(
  documentId: string,
  visibility: "PRIVATE" | "UNLISTED",
) {
  const document = await loadDocumentForMutation(documentId);

  const updated = await prisma.document.update({
    where: { id: documentId },
    data: { visibility },
    select: DOCUMENT_LIST_SELECT,
  });

  await invalidateOwnerDocumentCaches(
    document.userId,
    documentId,
    document.type,
    document.user.username,
    document.shareLinks.map((share) => share.slug),
  );

  return { document: updated, previousVisibility: document.visibility };
}

export async function softDeleteDocument(documentId: string) {
  const document = await loadDocumentForMutation(documentId);

  if (document.deletedAt) throw new ApiError(409, "Document is already deleted.");

  const updated = await prisma.document.update({
    where: { id: documentId },
    data: { deletedAt: new Date() },
    select: DOCUMENT_LIST_SELECT,
  });

  await invalidateOwnerDocumentCaches(
    document.userId,
    documentId,
    document.type,
    document.user.username,
    document.shareLinks.map((share) => share.slug),
  );

  return updated;
}

export async function restoreDocument(documentId: string) {
  const document = await loadDocumentForMutation(documentId);

  if (!document.deletedAt) throw new ApiError(409, "Document is not deleted.");

  const updated = await prisma.document.update({
    where: { id: documentId },
    data: { deletedAt: null },
    select: DOCUMENT_LIST_SELECT,
  });

  await invalidateOwnerDocumentCaches(
    document.userId,
    documentId,
    document.type,
    document.user.username,
    document.shareLinks.map((share) => share.slug),
  );

  return updated;
}

export async function listShareLinks(query: ShareLinkListQuery) {
  const where: Prisma.ShareLinkWhereInput = {
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.query
      ? {
          OR: [
            { slug: { contains: query.query, mode: "insensitive" } },
            { document: { title: { contains: query.query, mode: "insensitive" } } },
            { user: { email: { contains: query.query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.shareLink.findMany({
      where,
      select: {
        id: true,
        slug: true,
        viewCount: true,
        lastViewedAt: true,
        expiresAt: true,
        createdAt: true,
        passwordHash: true,
        user: { select: { id: true, name: true, email: true, username: true } },
        document: { select: { id: true, title: true, type: true, visibility: true } },
        _count: { select: { views: true } },
      },
      orderBy: query.sort === "views" ? { viewCount: "desc" } : { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.shareLink.count({ where }),
  ]);

  return {
    items: items.map(({ passwordHash, ...share }) => ({
      ...share,
      passwordProtected: Boolean(passwordHash),
    })),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function revokeShareLink(shareLinkId: string) {
  const share = await prisma.shareLink.findUnique({
    where: { id: shareLinkId },
    select: {
      id: true,
      slug: true,
      userId: true,
      documentId: true,
      document: { select: { type: true } },
      user: { select: { username: true } },
    },
  });

  if (!share) throw new ApiError(404, "Share link not found.");

  await prisma.shareLink.delete({ where: { id: shareLinkId } });

  await invalidateOwnerDocumentCaches(
    share.userId,
    share.documentId,
    share.document.type,
    share.user.username,
    [share.slug],
  );

  await cacheDelByPrefix(`share:list:${share.userId}:${share.documentId}:`);

  return { id: shareLinkId, slug: share.slug };
}
