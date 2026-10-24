/**
 * Strict integer parsing for environment variables.
 *
 * `parseInt` is too forgiving for config: `parseInt("abc")` is NaN, which then compares false
 * against everything (`count > NaN` never trips, so `RATE_LIMIT_MAX_REQUESTS=abc` turned the
 * limiter off), and `parseInt("12abc")` is 12, which hides a typo. Anything that is not a plain
 * base-10 integer falls back to the default here, and `validateEnvironmentConfig` rejects the
 * same value at boot so the typo is loud rather than silently defaulted.
 *
 * Kept free of imports (no dotenv, no `#config`) so the boot validator and its tests can use it
 * without loading the developer's `.env` into `process.env`.
 */
export const INTEGER_PATTERN = /^-?\d+$/;

export function parseIntegerEnv(value: string | undefined, fallback: number): number {
  if (value == null) return fallback;

  const trimmed = value.trim();
  if (!INTEGER_PATTERN.test(trimmed)) return fallback;

  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}
