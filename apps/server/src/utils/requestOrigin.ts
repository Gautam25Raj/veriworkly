import type { IncomingHttpHeaders } from "node:http";

/**
 * Whether `Host` and `X-Forwarded-Proto` can be assembled into a URL that `new Request()` accepts.
 *
 * better-auth's node handler builds `new Request(`${proto}://${host}${url}`)` from these two raw
 * headers (it does not consult Express's `trust proxy`), and the WHATWG URL parser throws on an
 * out-of-range port, an empty host, or a scheme that is not http/https. Those throws happen
 * outside any try/catch, so they must be refused before the handler runs.
 */
export function hasWellFormedHostAndProto(headers: IncomingHttpHeaders): boolean {
  const host = firstHeaderValue(headers.host);
  if (!host) return false;

  const proto = firstHeaderValue(headers["x-forwarded-proto"]) ?? "http";
  if (!/^https?$/i.test(proto)) return false;

  try {
    const url = new URL(`${proto.toLowerCase()}://${host}/`);
    // The parser accepts credentials and paths inside a host string; a real Host header has none.
    return url.host === host.toLowerCase() || url.host === host;
  } catch {
    return false;
  }
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null) return undefined;

  const first = raw.split(",")[0]?.trim();
  return first ? first : undefined;
}
