import { z } from "zod";

import {
  notBothPageAndOffset,
  notBothPageAndOffsetError,
  publicOffsetParam,
  publicPageParam,
} from "#utils/pagination";

/**
 * Validation schema for GitHub query parameters.
 */

// A date (2026-08-01) or a full ISO datetime; anything else is a 400 rather than a silent no-op.
const isoDateFilter = z
  .union([z.string().date(), z.string().datetime({ offset: true })])
  .optional();

export const githubQuerySchema = z
  .object({
    status: z.enum(["todo", "in-progress", "done"]).optional(),
    kind: z.enum(["issue", "pull-request", "all"]).optional(),
    page: publicPageParam,
    pageSize: z.coerce.number().int().min(1).max(50).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: publicOffsetParam,
    createdFrom: isoDateFilter,
    createdTo: isoDateFilter,
    updatedFrom: isoDateFilter,
    updatedTo: isoDateFilter,
  })
  .strict()
  .refine(notBothPageAndOffset, notBothPageAndOffsetError);
