import { config, isProduction } from "#config";

// The raw-environment schema (NODE_ENV, integer formats, production-only TRUST_PROXY /
// WEB_CONCURRENCY / public-https URLs / non-example secrets). It lives in its own module, free of
// `#config`, so it can be called before anything else reads the defaulted config and tested
// without loading `.env`. It does not repeat the Dodo/R2 checks below.
export { validateEnvironmentConfig } from "./environmentSchema.js";

function ensure(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Billing (Dodo Payments) and storage (R2) secrets are otherwise only checked lazily —
 * getDodoClient()/getClient() 503 on first real use — so a misconfigured production deploy would
 * boot successfully and only fail loudly (but late) on the first webhook, checkout, or upload.
 * Fail fast at startup instead, matching validateAuthRuntimeConfig/validateAiRuntimeConfig.
 */
export function validateBillingAndStorageRuntimeConfig(): void {
  if (!isProduction) return;

  ensure(
    Boolean(config.dodo.apiKey),
    "DODO_PAYMENTS_API_KEY must be configured in production for billing to function",
  );
  ensure(
    Boolean(config.dodo.webhookSecret),
    "DODO_PAYMENTS_WEBHOOK_SECRET must be configured in production for billing webhooks",
  );

  ensure(
    Boolean(config.r2.endpoint),
    "R2_ENDPOINT must be configured in production for portfolio asset uploads",
  );
  ensure(
    Boolean(config.r2.bucket),
    "R2_BUCKET must be configured in production for portfolio asset uploads",
  );
  ensure(
    Boolean(config.r2.accessKeyId) && Boolean(config.r2.secretAccessKey),
    "R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be configured in production for portfolio asset uploads",
  );
  ensure(
    Boolean(config.r2.publicBaseUrl),
    "R2_PUBLIC_BASE_URL must be configured in production for portfolio asset uploads",
  );
}
