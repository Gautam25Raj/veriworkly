import type { ReactNode } from "react";

import { Badge, Card } from "@veriworkly/ui";

interface AdminPageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

const AdminPageHeader = ({ eyebrow, title, description, actions }: AdminPageHeaderProps) => (
  <Card className="border-border bg-card relative overflow-hidden rounded-4xl px-6 py-7 md:px-8">
    <div className="bg-accent/12 pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full blur-3xl" />

    <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
      <div className="space-y-3">
        {eyebrow ? <Badge className="bg-background/70">{eyebrow}</Badge> : null}

        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight md:text-3xl">
            {title}
          </h1>

          {description ? (
            <p className="text-muted mt-2 max-w-2xl text-sm leading-6">{description}</p>
          ) : null}
        </div>
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  </Card>
);

export default AdminPageHeader;
