import { createHmac, randomBytes, randomUUID } from "node:crypto";

import { config } from "#config";
import { prisma } from "#lib/prisma";

export type TestUser = {
  id: string;
  email: string;
  sessionToken: string;
  /** Value for the `Cookie` header: the session token signed the way better-call signs cookies. */
  cookie: string;
};

/**
 * Signs a cookie value exactly as better-call does (`value.base64(HMAC-SHA256(secret, value))`,
 * URL-encoded), so better-auth accepts a session row we inserted ourselves. The cookie name has
 * no `__Secure-` prefix because `useSecureCookies` is off outside production.
 */
export function signSessionCookie(token: string, secret = config.auth.secret): string {
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  return `veriworkly-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
}

export async function createUserWithSession(
  overrides: { email?: string; name?: string; username?: string; emailVerified?: boolean } = {},
): Promise<TestUser> {
  const suffix = randomBytes(4).toString("hex");
  const email = overrides.email ?? `user-${suffix}@example.test`;

  const user = await prisma.user.create({
    data: {
      email,
      name: overrides.name ?? `User ${suffix}`,
      username: overrides.username ?? `user${suffix}`,
      emailVerified: overrides.emailVerified ?? true,
    },
  });

  const sessionToken = randomBytes(32).toString("base64url");

  await prisma.session.create({
    data: {
      id: randomUUID(),
      token: sessionToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "integration-suite",
    },
  });

  return { id: user.id, email, sessionToken, cookie: signSessionCookie(sessionToken) };
}
