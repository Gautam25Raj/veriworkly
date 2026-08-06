import Link from "next/link";
import { Eye, ExternalLink, Plus } from "lucide-react";

import { WorkspaceNavigation } from "./WorkspaceNavigation";

/** `publicUrl` is only supplied once the portfolio is actually publicly reachable. */
const Header = ({ publicUrl }: { publicUrl?: string }) => {
  return (
    <header className="border-line bg-paper-glass sticky top-0 z-40 flex min-h-17 items-center gap-3 border-b px-4 backdrop-blur-xl sm:px-6">
      <WorkspaceNavigation variant="mobile" />

      <p className="text-muted hidden flex-1 text-xs font-bold md:block">Portfolio workspace</p>

      <div className="ml-auto flex items-center gap-2">
        {publicUrl ? (
          <a
            target="_blank"
            rel="noreferrer"
            href={publicUrl}
            className="border-line bg-panel text-ink hidden min-h-10 items-center gap-2 rounded-xl border px-4 text-xs font-extrabold sm:inline-flex"
          >
            <Eye size={13} /> View site <ExternalLink size={11} />
          </a>
        ) : null}

        <Link
          href="/editor"
          className="bg-accent text-accent-ink inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-xs font-extrabold"
        >
          <Plus size={14} /> Edit portfolio
        </Link>
      </div>
    </header>
  );
};

export { Header };
