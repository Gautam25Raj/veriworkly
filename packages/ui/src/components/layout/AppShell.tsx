import * as React from "react";

import { cn } from "../../utils";

interface AppShellProps {
  children: React.ReactNode;
  navbar?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  mainClassName?: string;
}

export const AppShell = ({ children, navbar, footer, className, mainClassName }: AppShellProps) => {
  return (
    <div className={cn("flex min-h-dvh flex-col", className)}>
      <a
        href="#main-content"
        className="bg-background text-foreground focus-visible:ring-accent sr-only rounded-md px-4 py-2 text-sm font-semibold shadow-lg focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-300 focus-visible:ring-2 focus-visible:outline-hidden"
      >
        Skip to main content
      </a>

      {navbar}
      <main id="main-content" tabIndex={-1} className={cn("flex-1 outline-none", mainClassName)}>
        {children}
      </main>
      {footer}
    </div>
  );
};
