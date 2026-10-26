import cors from "cors";

import { config } from "#config";

import { ApiError } from "#lib/errors";

function isWildcardPortfolioOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin || allowedOrigins.includes(origin)) {
    return false;
  }

  return (
    /^https:\/\/[a-z0-9-]+\.veriworkly\.com$/i.test(origin) ||
    /^http:\/\/[a-z0-9-]+\.localhost:3004$/i.test(origin)
  );
}

export const corsMiddleware = cors((req, callback) => {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;

  const explicitlyAllowedOrigin = Boolean(origin && config.allowedOrigins.includes(origin));
  const trustedPortfolioOrigin = isWildcardPortfolioOrigin(origin, config.allowedOrigins);

  callback(null, {
    origin: (requestOrigin, originCallback) => {
      if (!requestOrigin) {
        originCallback(null, true);
        return;
      }

      if (config.allowedOrigins.includes(requestOrigin) || trustedPortfolioOrigin) {
        originCallback(null, true);
      } else {
        originCallback(new ApiError(403, "Not allowed by CORS"));
      }
    },
    credentials: explicitlyAllowedOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    // Idempotency-Key: the admin credit-adjust and plan-change routes read it (or the
    // `idempotencyKey` body field), and a browser cannot send a header the preflight does not
    // allow (V-194).
    allowedHeaders: ["Content-Type", "Authorization", "X-API-KEY", "Idempotency-Key"],
    maxAge: 86400,
  });
});

export { isWildcardPortfolioOrigin };
