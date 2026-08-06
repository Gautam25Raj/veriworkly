import "dotenv/config";

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { Prisma } from "@prisma/client";

import { logger } from "#lib/logger";
import { prisma } from "#lib/prisma";
import { initRedis, closeRedis, cacheDelByPrefix } from "#lib/redis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type RoadmapStatus = "todo" | "in-progress" | "done";

interface RoadmapSeedItem {
  id: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  eta?: string | null;
  tags?: string[];
  createdAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  completedQuarter?: string | null;
  updatedAt?: string;
  fullDescription?: string | null;
  whyItMatters?: string | null;
  timeline?: string | null;
  details?: Record<string, unknown> | null;
}

const WIPE_EXISTING = process.argv.includes("--wipe");
const DATA_FILE = path.join(__dirname, "seed-data", "roadmap-features.json");

function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

async function run() {
  const raw = readFileSync(DATA_FILE, "utf8");
  const items: RoadmapSeedItem[] = JSON.parse(raw);

  logger.info(`Loaded ${items.length} roadmap items from ${DATA_FILE}`);

  await prisma.$queryRaw`SELECT 1`;

  if (WIPE_EXISTING) {
    const deleted = await prisma.roadmapFeature.deleteMany({});
    logger.info(`Wiped ${deleted.count} existing roadmap feature rows (--wipe flag set)`);
  }

  let created = 0;
  let updated = 0;

  for (const item of items) {
    const data = {
      title: item.title,
      description: item.description,
      status: item.status,
      eta: item.eta ?? null,
      tags: item.tags ?? [],
      createdAt: toDate(item.createdAt) ?? new Date(),
      startedAt: toDate(item.startedAt),
      completedAt: toDate(item.completedAt),
      completedQuarter: item.completedQuarter ?? null,
      updatedAt: toDate(item.updatedAt) ?? new Date(),
      fullDescription: item.fullDescription ?? null,
      whyItMatters: item.whyItMatters ?? null,
      timeline: item.timeline ?? null,
      details: (item.details as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    };

    const existing = await prisma.roadmapFeature.findUnique({ where: { id: item.id } });

    await prisma.roadmapFeature.upsert({
      where: { id: item.id },
      create: { id: item.id, ...data },
      update: data,
    });

    if (existing) updated++;
    else created++;
  }

  logger.info(`Roadmap seed complete: ${created} created, ${updated} updated`);

  try {
    await Promise.race([
      initRedis(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Redis connect timeout")), 5000),
      ),
    ]);
    await cacheDelByPrefix("roadmap:");
    logger.info("Flushed roadmap:* Redis cache prefix");
  } catch (error) {
    logger.warn(
      "Skipping Redis cache flush (Redis unreachable from this environment). " +
        "If this points at the same Redis instance the running server uses, flush the " +
        "'roadmap:' key prefix there manually so the public site doesn't serve stale cached data.",
    );
    logger.warn(String(error instanceof Error ? error.message : error));
  }
}

run()
  .catch((error) => {
    logger.error("Roadmap seed failed", error);
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
