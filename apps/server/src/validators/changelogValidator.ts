import { z } from "zod";

export const changelogQuerySchema = z.object({
  type: z.enum(["major", "minor", "patch"]).optional(),
  tag: z.string().min(1).optional(),
  search: z.string().min(1).max(120).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const prRefAuthorSchema = z.object({
  login: z.string(),
  avatarUrl: z.string().url(),
  htmlUrl: z.string().url(),
});

const prRefsSchema = z
  .array(
    z.object({
      number: z.number().int().positive(),
      title: z.string(),
      url: z.string().url().optional(),
      author: prRefAuthorSchema.nullable().optional(),
    }),
  )
  .nullable()
  .optional();

export const changelogAdminCreateSchema = z.object({
  id: z.string().min(1).optional(),
  version: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().nullable().optional(),
  type: z.enum(["major", "minor", "patch"]).default("minor"),
  publishedAt: z.string().datetime().optional(),
  githubUrl: z.string().url().nullable().optional(),
  added: z.array(z.string()).optional(),
  improved: z.array(z.string()).optional(),
  fixed: z.array(z.string()).optional(),
  breaking: z.array(z.string()).optional(),
  security: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  prRefs: prRefsSchema,
});

export const changelogAdminUpdateSchema = z
  .object({
    version: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    summary: z.string().nullable().optional(),
    type: z.enum(["major", "minor", "patch"]).optional(),
    publishedAt: z.string().datetime().optional(),
    githubUrl: z.string().url().nullable().optional(),
    added: z.array(z.string()).optional(),
    improved: z.array(z.string()).optional(),
    fixed: z.array(z.string()).optional(),
    breaking: z.array(z.string()).optional(),
    security: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    prRefs: prRefsSchema,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required for update",
  });
