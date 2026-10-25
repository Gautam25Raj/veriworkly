import { NextFunction, Request, Response } from "express";

import { ApiError } from "#lib/errors";
import { config } from "#config";

import { convertNodeHeadersToWebHeaders, getSessionFromRequestHeaders } from "#auth/index";

import { cacheGet, cacheSet } from "#lib/redis";
import { getSessionCacheKey } from "#utils/authCache";

export async function getSessionUserFromRequest(req: Request): Promise<AuthenticatedUser | null> {
  // 1. Per-request cache
  if (req.authUser) return req.authUser;
  if (req._authChecked) return null;

  // 2. Quick check: if no auth cookie is present, skip expensive session lookup
  const cookieHeader = req.headers.cookie || "";

  if (!cookieHeader.includes("veriworkly-auth")) {
    req._authChecked = true;
    return null;
  }

  try {
    // 3. Try Redis cache. The key is derived from the session token alone (so revocation paths,
    //    which only know the token, can clear it). No session-token cookie means nothing to
    //    cache under, not "unauthenticated": better-auth still gets to decide.
    const cacheKey = getSessionCacheKey(cookieHeader);

    const cachedUser = cacheKey ? await cacheGet<AuthenticatedUser>(cacheKey) : null;

    if (cachedUser) {
      req.authUser = cachedUser;
      req._authChecked = true;
      return cachedUser;
    }

    // 4. Perform actual session lookup
    const headers = convertNodeHeadersToWebHeaders(req.headers);
    const session = await getSessionFromRequestHeaders(headers);

    req._authChecked = true;

    if (!session?.user) return null;

    const user = session.user as {
      id?: string;
      email?: string | null;
      name?: string | null;
    };

    if (!user.id) return null;

    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
    };

    if (cacheKey) await cacheSet(cacheKey, authUser, config.auth.sessionCacheMaxAgeSeconds);

    req.authUser = authUser;
    return authUser;
  } catch {
    req._authChecked = true;
    return null;
  }
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  let user: AuthenticatedUser | null = null;
  try {
    user = await getSessionUserFromRequest(req);

    if (!user) throw new ApiError(401, "Authentication required");

    req.authUser = user;
  } catch (error) {
    if (error instanceof ApiError) return next(error);

    return next(new ApiError(401, "Invalid or expired session"));
  }

  next();
}

export function requireAuthUser(req: Request): AuthenticatedUser {
  if (!req.authUser?.id) throw new ApiError(401, "Authentication required");

  return req.authUser;
}
