import { createHash } from "node:crypto";

const ANALYTICS_HASH_PEPPER = process.env.ANALYTICS_HASH_PEPPER || "veriworkly-analytics-pepper";

/**
 * One-way hash for non-security analytics use (viewer IP dedup, etc.) — never for anything
 * security-sensitive. Uses its own pepper rather than reusing config.auth.secret, so rotating
 * the auth secret can't silently change analytics hashes and vice versa.
 */
export function hashForAnalytics(value: string): string {
  return createHash("sha256").update(value + ANALYTICS_HASH_PEPPER).digest("hex");
}
