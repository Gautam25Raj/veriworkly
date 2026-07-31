import Link from "next/link";

import { buttonClassName } from "@veriworkly/ui";

interface AdminPaginationProps {
  total: number;
  limit: number;
  offset: number;
  /** Path without a query string, e.g. `/admin/users`. */
  basePath: string;
  /** Current filters, re-emitted on the prev/next links so paging never drops them. */
  params?: Record<string, string | number | undefined>;
}

function buildHref(
  basePath: string,
  params: Record<string, string | number | undefined>,
  offset: number,
) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || key === "offset") continue;
    search.set(key, String(value));
  }

  if (offset > 0) search.set("offset", String(offset));

  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

const AdminPagination = ({ total, limit, offset, basePath, params = {} }: AdminPaginationProps) => {
  const page = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const hasPrevious = offset > 0;
  const hasNext = offset + limit < total;

  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted text-xs">
        Showing <span className="text-foreground font-medium">{rangeStart}</span>–
        <span className="text-foreground font-medium">{rangeEnd}</span> of{" "}
        <span className="text-foreground font-medium">{total}</span> · page {page} of {pageCount}
      </p>

      <div className="flex items-center gap-2">
        {hasPrevious ? (
          <Link
            href={buildHref(basePath, params, Math.max(0, offset - limit))}
            className={buttonClassName("secondary", "sm")}
          >
            Previous
          </Link>
        ) : (
          <span className={`${buttonClassName("secondary", "sm")} pointer-events-none opacity-40`}>
            Previous
          </span>
        )}

        {hasNext ? (
          <Link
            href={buildHref(basePath, params, offset + limit)}
            className={buttonClassName("secondary", "sm")}
          >
            Next
          </Link>
        ) : (
          <span className={`${buttonClassName("secondary", "sm")} pointer-events-none opacity-40`}>
            Next
          </span>
        )}
      </div>
    </div>
  );
};

export default AdminPagination;
