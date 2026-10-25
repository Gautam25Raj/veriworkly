/**
 * The one place the integration suite decides which Postgres and Redis it talks to, and the
 * environment the server boots with. Imported by the global setup (main process) and by the
 * per-file setup (worker), so both see the same answer without passing state between them.
 *
 * Safety: this suite TRUNCATEs every table and FLUSHes the Redis db it is pointed at. It refuses
 * anything that is not loopback, and refuses Redis db 0, unless `INTEGRATION_ALLOW_REMOTE=1` is
 * set on purpose (CI service containers are loopback, so CI never needs it). The repo's `.env`
 * can hold a production `DATABASE_URL`; it is never consulted here because this runs before
 * `dotenv` and sets the variables first, and `dotenv` does not override what is already set.
 */

const DEFAULT_DATABASE_URL = "postgresql://veriworkly:veriworkly@localhost:5433/veriworkly_test";
const DEFAULT_REDIS_URL = "redis://localhost:6379/15";

export type IntegrationEnv = {
  databaseUrl: string;
  redisUrl: string;
  redisDbIndex: number;
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    throw new Error(`Integration suite: cannot parse URL "${redact(url)}"`);
  }
}

function redact(url: string): string {
  return url.replace(/\/\/([^:/@]+):[^@]+@/, "//$1:***@");
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

export function resolveIntegrationEnv(env: NodeJS.ProcessEnv = process.env): IntegrationEnv {
  const databaseUrl = env.INTEGRATION_DATABASE_URL || env.DATABASE_URL || DEFAULT_DATABASE_URL;
  const redisUrl = env.INTEGRATION_REDIS_URL || env.REDIS_URL || DEFAULT_REDIS_URL;
  const allowRemote = env.INTEGRATION_ALLOW_REMOTE === "1";

  const dbHost = hostOf(databaseUrl);
  const redisHost = hostOf(redisUrl);
  const redisDbIndex = Number.parseInt(new URL(redisUrl).pathname.replace(/^\//, "") || "0", 10);

  if (!allowRemote) {
    if (!isLoopbackHost(dbHost))
      throw new Error(
        `Integration suite refuses a non-local database (${redact(databaseUrl)}). ` +
          "It truncates every table. Point INTEGRATION_DATABASE_URL at a local Postgres, " +
          "or set INTEGRATION_ALLOW_REMOTE=1 if you really mean it.",
      );
    if (!isLoopbackHost(redisHost))
      throw new Error(
        `Integration suite refuses a non-local Redis (${redact(redisUrl)}). It flushes the db.`,
      );
    if (!Number.isFinite(redisDbIndex) || redisDbIndex === 0)
      throw new Error(
        `Integration suite refuses Redis db 0 (${redisUrl}); the local dev server uses it. ` +
          "Use a db index such as redis://localhost:6379/15.",
      );
  }

  return { databaseUrl, redisUrl, redisDbIndex };
}

/**
 * The server's own configuration for the suite. Applied with `process.env` assignment before any
 * `#config` import, so `dotenv` (which never overrides) cannot pull `.env` values in underneath.
 */
export function applyServerEnv(target: NodeJS.ProcessEnv = process.env): IntegrationEnv {
  const resolved = resolveIntegrationEnv(target);

  const serverEnv: Record<string, string> = {
    NODE_ENV: "test",
    DATABASE_URL: resolved.databaseUrl,
    REDIS_URL: resolved.redisUrl,
    PORT: "0",
    CLUSTERING_ENABLED: "false",
    WEB_CONCURRENCY: "1",
    TRUST_PROXY: "0",
    LOG_LEVEL: "error",
    ALLOWED_ORIGINS: "http://localhost:3001,http://localhost:3004",
    AUTH_SECRET: "integration-test-auth-secret-0123456789abcdef",
    AUTH_BASE_URL: "http://localhost:8080",
    AUTH_EMAIL_PROVIDER: "console",
    AUTH_SESSION_CACHE_ENABLED: "false",
    ADMIN_EMAIL: "admin@example.test",
    API_KEY_HASH_SECRET: "integration-test-api-key-secret",
    ANALYTICS_HASH_PEPPER: "integration-test-pepper",
    STUDIO_URL: "http://localhost:3001",
    PORTFOLIO_URL: "http://localhost:3004",
    PORTFOLIO_REVALIDATE_SECRET: "integration-test-revalidate",
    // Billing: a real Standard Webhooks secret so signed deliveries verify. 32 zero bytes, base64.
    DODO_PAYMENTS_API_KEY: "integration-test-dodo-key",
    DODO_PAYMENTS_WEBHOOK_SECRET: "whsec_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    DODO_PAYMENTS_ENVIRONMENT: "test_mode",
    DODO_PAYMENTS_AI_CREDITS_MONTHLY_PRODUCT_ID: "prod_ai_credits_monthly",
    DODO_PAYMENTS_AI_CREDITS_ANNUAL_PRODUCT_ID: "prod_ai_credits_annual",
    DODO_PAYMENTS_PORTFOLIO_PRO_MONTHLY_PRODUCT_ID: "prod_portfolio_pro_monthly",
    DODO_PAYMENTS_PORTFOLIO_PRO_ANNUAL_PRODUCT_ID: "prod_portfolio_pro_annual",
    DODO_PAYMENTS_BUNDLE_MONTHLY_PRODUCT_ID: "prod_bundle_monthly",
    DODO_PAYMENTS_BUNDLE_ANNUAL_PRODUCT_ID: "prod_bundle_annual",
    DODO_PAYMENTS_BUNDLE_ONE_DAY_PRODUCT_ID: "prod_bundle_one_day",
    DODO_PAYMENTS_BUNDLE_SEVEN_DAY_PRODUCT_ID: "prod_bundle_seven_day",
    DODO_PAYMENTS_CREDIT_PACK_250_PRODUCT_ID: "prod_pack_250",
    DODO_PAYMENTS_CREDIT_PACK_500_PRODUCT_ID: "prod_pack_500",
    GITHUB_SYNC_ENABLED: "false",
    CHANGELOG_RELEASE_SYNC_ENABLED: "false",
    AFFILIATE_PROGRAM_ENABLED: "true",
    AMBASSADOR_PROGRAM_ENABLED: "true",
  };

  for (const [key, value] of Object.entries(serverEnv)) target[key] = value;

  return resolved;
}

/** Origin header every browser-style request carries so `flexibleAuth` treats it as first-party. */
export const STUDIO_ORIGIN = "http://localhost:3001";
