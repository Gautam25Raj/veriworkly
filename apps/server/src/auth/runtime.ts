import { config, isProduction } from "#config";

import { logger } from "#lib/logger";
import { prisma } from "#lib/prisma";
import { ensure } from "#config/validateRuntimeConfig";

/**
 * Auth checks the environment schema (`config/environmentSchema.ts`) cannot make, because they
 * depend on another variable or on the configured provider. The schema already covers the
 * integer TTLs, AUTH_SECRET, AUTH_BASE_URL (https in production), TRUST_PROXY and
 * API_KEY_HASH_SECRET, and runs first.
 */
export function validateAuthRuntimeConfig(): void {
  ensure(Boolean(config.admin.email), "ADMIN_EMAIL must be configured for admin auth");

  if (config.auth.emailProvider === "smtp") {
    ensure(Boolean(config.auth.smtpHost), "AUTH_SMTP_HOST must be configured when using SMTP");
    ensure(Boolean(config.auth.smtpUser), "AUTH_SMTP_USER must be configured when using SMTP");
    ensure(Boolean(config.auth.smtpPass), "AUTH_SMTP_PASS must be configured when using SMTP");
  } else if (config.auth.emailProvider === "resend") {
    ensure(
      Boolean(config.auth.resendApiKey),
      "RESEND_API_KEY must be configured when using Resend",
    );
  }

  if (isProduction) {
    ensure(
      config.auth.emailProvider === "smtp" || config.auth.emailProvider === "resend",
      "AUTH_EMAIL_PROVIDER must be smtp or resend in production",
    );
  }
}

export async function ensureAdminUserExists(): Promise<void> {
  const email = config.admin.email;
  let retries = 3;

  while (retries > 0) {
    try {
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (!existing) {
        await prisma.user.create({
          data: {
            email,
            name: "Admin",
          },
        });

        logger.info("Admin user created for auth", { email });
      }

      // An existing row keeps whatever display name the admin chose.
      return;
    } catch (err) {
      retries -= 1;
      if (retries === 0) throw err;
      logger.warn(
        `Database connection initial query failed (Neon spin-up delay), retrying (${retries} attempts left)...`,
        err instanceof Error ? err.message : err,
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}
