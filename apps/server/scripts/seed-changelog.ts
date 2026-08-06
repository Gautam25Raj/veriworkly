import "dotenv/config";

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { Prisma } from "@prisma/client";

import { logger } from "#lib/logger";
import { prisma } from "#lib/prisma";
import { initRedis, closeRedis, cacheDelByPrefix } from "#lib/redis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type ChangelogType = "major" | "minor" | "patch";

interface ChangelogSeedItem {
  id: string;
  version: string;
  title: string;
  summary?: string | null;
  type: ChangelogType;
  publishedAt: string;
  githubUrl?: string | null;
  added?: string[];
  improved?: string[];
  fixed?: string[];
  breaking?: string[];
  security?: string[];
  tags?: string[];
  prRefs?: Array<{ number: number; title: string }>;
}

const WIPE_EXISTING = process.argv.includes("--wipe");
const DATA_FILE = path.join(__dirname, "seed-data", "changelog-entries.json");

async function run() {
  const raw = readFileSync(DATA_FILE, "utf8");
  const items: ChangelogSeedItem[] = JSON.parse(raw);

  logger.info(`Loaded ${items.length} changelog entries from ${DATA_FILE}`);

  await prisma.$queryRaw`SELECT 1`;

  if (WIPE_EXISTING) {
    const deleted = await prisma.changelogEntry.deleteMany({});
    logger.info(`Wiped ${deleted.count} existing changelog entry rows (--wipe flag set)`);
  }

  let created = 0;
  let updated = 0;

  for (const item of items) {
    const data = {
      version: item.version,
      title: item.title,
      summary: item.summary ?? null,
      type: item.type,
      publishedAt: new Date(item.publishedAt),
      githubUrl: item.githubUrl ?? null,
      added: item.added ?? [],
      improved: item.improved ?? [],
      fixed: item.fixed ?? [],
      breaking: item.breaking ?? [],
      security: item.security ?? [],
      tags: item.tags ?? [],
      prRefs: (item.prRefs as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    };

    const existing = await prisma.changelogEntry.findUnique({ where: { id: item.id } });

    await prisma.changelogEntry.upsert({
      where: { id: item.id },
      create: { id: item.id, ...data },
      update: data,
    });

    if (existing) updated++;
    else created++;
  }

  logger.info(`Changelog seed complete: ${created} created, ${updated} updated`);

  try {
    await Promise.race([
      initRedis(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Redis connect timeout")), 5000),
      ),
    ]);
    await cacheDelByPrefix("changelog:");
    logger.info("Flushed changelog:* Redis cache prefix");
  } catch (error) {
    logger.warn(
      "Skipping Redis cache flush (Redis unreachable from this environment). " +
        "If this points at the same Redis instance the running server uses, flush the " +
        "'changelog:' key prefix there manually so the public site doesn't serve stale cached data.",
    );
    logger.warn(String(error instanceof Error ? error.message : error));
  }
}

run()
  .catch((error) => {
    logger.error("Changelog seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closeRedis();
    } catch {
      // Redis was never connected — nothing to close.
    }
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
