import { afterAll, beforeAll } from "vitest";

import { applyServerEnv } from "./env.js";

// Must run before anything imports `#config` (which runs dotenv) or `#lib/prisma` (which reads
// DATABASE_URL at import time). setupFiles execute before the test file's own imports.
applyServerEnv();

const { prisma, closePrisma } = await import("#lib/prisma");
const { initRedis, closeRedis, getRedis } = await import("#lib/redis");

/**
 * Every test file starts from an empty database and an empty Redis db. Tables are truncated in
 * one statement (CASCADE resolves the foreign keys) rather than dropped, so the migrated schema,
 * enums and indexes stay exactly as `migrate deploy` left them.
 */
export async function resetStores(): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  if (tables.length) {
    const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }

  await getRedis().flushDb();
}

beforeAll(async () => {
  await initRedis();
  await resetStores();
});

afterAll(async () => {
  await closeRedis();
  await closePrisma();
});
