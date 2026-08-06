export type AdminSearchParams = Record<string, string | string[] | undefined>;

/**
 * Collapses Next's `string | string[]` search params to the single-value shape the admin API
 * expects. A repeated `?status=A&status=B` is a malformed admin URL, and taking the first
 * value keeps a hand-edited URL from 400ing the whole page.
 */
export function toSingleValueParams(params: AdminSearchParams): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single === undefined || single === "") continue;

    result[key] = single;
  }

  return result;
}
