import type { ReactNode } from "react";

interface AdminPageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

/**
 * The title block at the top of every admin page.
 *
 * Plain markup rather than a card. The previous version wrapped this in a `rounded-4xl` panel
 * with a blurred accent orb behind it, which cost roughly 130px of vertical space above the
 * fold on every page before a single row of data appeared. On an operations tool the first
 * screenful should be the work, not the chrome — the breadcrumb in the topbar already says
 * where you are, so this only needs to name the page and hold its actions.
 */
const AdminPageHeader = ({ eyebrow, title, description, actions }: AdminPageHeaderProps) => (
  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
    <div className="min-w-0">
      {eyebrow ? <p className="admin-label text-muted mb-1">{eyebrow}</p> : null}

      <h1 className="text-foreground text-xl font-semibold tracking-tight">{title}</h1>

      {description ? (
        <p className="text-muted mt-1 max-w-2xl text-sm leading-6">{description}</p>
      ) : null}
    </div>

    {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);

export default AdminPageHeader;
