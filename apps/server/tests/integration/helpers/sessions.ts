import { randomBytes, randomUUID } from "node:crypto";

import { prisma } from "#lib/prisma";
import { getRedis } from "#lib/redis";

import { signSessionCookie } from "./auth.js";

type TestSession = {
  sessionToken: string;
  /** Value for the `Cookie` header, signed the way better-call signs cookies. */
  cookie: string;
};

/** A second (or third) device for a user that `createUserWithSession` already created. */
export async function createSessionForUser(userId: string): Promise<TestSession> {
  const sessionToken = randomBytes(32).toString("base64url");

  await prisma.session.create({
    data: {
      id: randomUUID(),
      token: sessionToken,
      userId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "integration-suite-second-device",
    },
  });

  return { sessionToken, cookie: signSessionCookie(sessionToken) };
}

/**
 * Writes the Redis entries better-auth's `createSession` would have written for these tokens
 * (`<token>` -> `{ session, user }` and the `active-sessions-<userId>` index). Sessions inserted
 * straight into Postgres never get them, and `findSession` only falls back to the database when
 * the Redis entry is missing — so without this a test cannot tell whether revocation cleared
 * better-auth's store or whether there was nothing there to begin with.
 */
export async function seedBetterAuthSessionEntries(userId: string, tokens: string[]) {
  const redis = getRedis();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const sessions = await prisma.session.findMany({ where: { userId, token: { in: tokens } } });

  for (const session of sessions) {
    const ttl = Math.max(1, Math.ceil((session.expiresAt.getTime() - Date.now()) / 1000));
    await redis.set(session.token, JSON.stringify({ session, user }), { EX: ttl });
  }

  await redis.set(
    `active-sessions-${userId}`,
    JSON.stringify(
      sessions.map((session) => ({ token: session.token, expiresAt: session.expiresAt.getTime() })),
    ),
    { EX: 3600 },
  );
}
