import type { ReactNode } from "react";

import { Card, cn } from "@veriworkly/ui";

export interface AdminTableColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Applied to both the header cell and every body cell in the column. */
  className?: string;
  /** Hidden below `md`. Use for columns that are useful but not load-bearing on mobile. */
  hideOnMobile?: boolean;
}

interface AdminTableProps<T> {
  columns: Array<AdminTableColumn<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  caption?: ReactNode;
}

/**
 * The one table used by every admin list page.
 *
 * The wrapper scrolls horizontally rather than letting a wide table push the page body wide —
 * an admin table with ten columns will always overflow on a laptop, and a horizontally
 * scrolling *page* makes the nav unreachable.
 */
function AdminTable<T>({ columns, rows, rowKey, emptyMessage, caption }: AdminTableProps<T>) {
  return (
    <Card className="overflow-hidden rounded-3xl p-0">
      {caption ? (
        <div className="border-border/70 text-muted border-b px-5 py-3 text-xs">{caption}</div>
      ) : null}

      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-border/70 border-b">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "text-muted px-4 py-3 text-xs font-medium tracking-wide whitespace-nowrap uppercase",
                    column.hideOnMobile && "hidden md:table-cell",
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-muted px-4 py-10 text-center text-sm">
                  {emptyMessage ?? "Nothing to show yet."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-border/50 hover:bg-background/60 border-b transition last:border-b-0"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "px-4 py-3 align-middle",
                        column.hideOnMobile && "hidden md:table-cell",
                        column.className,
                      )}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default AdminTable;
