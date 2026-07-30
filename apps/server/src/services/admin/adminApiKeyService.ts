import type { Prisma } from "@prisma/client";
import type { z } from "zod";

import { prisma } from "#lib/prisma";
import { ApiError } from "#lib/errors";
import { ApiKeyService } from "#services/apiKeyService";

import type {
  adminApiKeyListQuerySchema,
  adminApiKeyUpdateSchema,
} from "#validators/admin/adminApiKeyValidator";

type ApiKeyListQuery = z.infer<typeof adminApiKeyListQuerySchema>;
type ApiKeyUpdateInput = z.infer<typeof adminApiKeyUpdateSchema>;

/**
 * `keyHash` is deliberately absent from every selection in this module. An admin can disable
 * or revoke a key but must never be able to read material that would let them impersonate the
 * key's owner.
 */
const API_KEY_SELECT = {
  id: true,
  name: true,
  keyPrefix: true,
  keySuffix: true,
  scopes: true,
  isActive: true,
  rateLimit: true,
  expiresAt: true,
  revokedAt: true,
  lastUsed: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ApiKeySelect;

export async function getApiKeySummary() {
  const now = new Date();

  const [total, active, revoked, expired, usedLast7Days] = await Promise.all([
    prisma.apiKey.count(),
    prisma.apiKey.count({ where: { isActive: true, revokedAt: null } }),
    prisma.apiKey.count({ where: { revokedAt: { not: null } } }),
    prisma.apiKey.count({ where: { expiresAt: { lt: now } } }),
    prisma.apiKey.count({
      where: { lastUsed: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  return { total, active, revoked, expired, usedLast7Days };
}

export async function listApiKeys(query: ApiKeyListQuery) {
  const where: Prisma.ApiKeyWhereInput = {
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.active !== undefined
      ? query.active
        ? { isActive: true, revokedAt: null }
        : { OR: [{ isActive: false }, { revokedAt: { not: null } }] }
      : {}),
    ...(query.query
      ? {
          AND: [
            {
              OR: [
                { name: { contains: query.query, mode: "insensitive" } },
                { keyPrefix: { contains: query.query, mode: "insensitive" } },
                { user: { email: { contains: query.query, mode: "insensitive" } } },
              ],
            },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.apiKey.findMany({
      where,
      select: API_KEY_SELECT,
      orderBy: query.sort === "lastUsed" ? { lastUsed: "desc" } : { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.apiKey.count({ where }),
  ]);

  return { items, total, limit: query.limit, offset: query.offset };
}

export async function updateApiKey(apiKeyId: string, input: ApiKeyUpdateInput) {
  const existing = await prisma.apiKey.findUnique({
    where: { id: apiKeyId },
    select: { id: true, isActive: true, rateLimit: true, userId: true },
  });

  if (!existing) throw new ApiError(404, "API key not found.");

  const updated = await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: {
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.rateLimit !== undefined ? { rateLimit: input.rateLimit } : {}),
    },
    select: API_KEY_SELECT,
  });

  // validateKey() caches the whole auth record (isActive, rateLimit, revokedAt included), so a
  // disabled key keeps authenticating until that entry expires unless it is evicted here.
  await ApiKeyService.invalidateAuthCacheForUser(existing.userId);

  return { apiKey: updated, previous: existing };
}

export async function revokeApiKey(apiKeyId: string) {
  const existing = await prisma.apiKey.findUnique({
    where: { id: apiKeyId },
    select: { id: true, revokedAt: true, userId: true },
  });

  if (!existing) throw new ApiError(404, "API key not found.");
  if (existing.revokedAt) throw new ApiError(409, "This API key is already revoked.");

  const updated = await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: { isActive: false, revokedAt: new Date() },
    select: API_KEY_SELECT,
  });

  await ApiKeyService.invalidateAuthCacheForUser(existing.userId);

  return updated;
}
