import { createClient } from "redis";

import { config } from "#config";

import { logger } from "./logger.js";

let redisClient: ReturnType<typeof createClient> | null = null;
let connectionPromise: Promise<ReturnType<typeof createClient>> | null = null;

export async function initRedis() {
  if (redisClient?.isOpen) return redisClient;
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    try {
      redisClient = createClient({
        url: config.redis.url,
        // While reconnecting, fail commands at once so callers fall back instead of hanging.
        disableOfflineQueue: true,
        socket: {
          reconnectStrategy: (retries) => {
            // Reconnect indefinitely, backing off to 5 s, with up to 50% jitter so every worker
            // and replica does not reconnect in the same instant after an outage (V-095).
            const delay = Math.min(retries * 100, 5000);
            return Math.round(delay / 2 + Math.random() * (delay / 2));
          },
        },
      });

      redisClient.on("error", (err) => {
        logger.error("Redis Client Error", err);
      });

      redisClient.on("connect", () => {
        logger.info("Redis Client Connected");
      });

      redisClient.on("reconnecting", () => {
        logger.warn("Redis Client Reconnecting...");
      });

      await redisClient.connect();
      return redisClient;
    } catch (error) {
      logger.error("Failed to initialize Redis", error);
      connectionPromise = null;
      throw error;
    }
  })();

  return connectionPromise;
}

export function getRedis() {
  // `isOpen` stays true while reconnecting; only `isReady` means commands will run.
  if (!redisClient?.isReady) throw new Error("Redis client not ready");

  return redisClient;
}

export async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (error) {
      logger.error("Error closing Redis connection", error);
    } finally {
      redisClient = null;
      connectionPromise = null;
    }
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedis();
    const data = await redis.get(key);

    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error("Cache get error", error);
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  expirationSeconds: number = 3600,
): Promise<void> {
  try {
    const redis = getRedis();
    await redis.setEx(key, expirationSeconds, JSON.stringify(value));
  } catch (error) {
    logger.error("Cache set error", error);
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.unlink(key);
  } catch (error) {
    logger.error("Cache del error", error);
  }
}

/**
 * Walks the whole keyspace (`SCAN MATCH prefix*`), so its cost grows with every key in Redis.
 * Only for the operator "flush cache" button (`adminSystemService.flushCache`); request paths
 * invalidate through generation namespaces (`#lib/cacheGeneration`) instead.
 */
export async function cacheDelByPrefix(prefix: string): Promise<void> {
  try {
    const redis = getRedis();
    let cursor = "0";

    do {
      const result = await redis.scan(cursor, {
        MATCH: `${prefix}*`,
        COUNT: 100,
      });

      cursor = result.cursor;

      if (result.keys.length > 0) await redis.unlink(result.keys);
    } while (cursor !== "0");
  } catch (error) {
    logger.error("Cache prefix delete error", error);
  }
}
