"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { usePathname } from "next/navigation";

import type { MarketingNavItem, MarketingSimpleLink } from "./types";

import { cn } from "../../../utils";

import { Button } from "../../ui/Button";

import { Container } from "../Container";
import { GithubIcon } from "../social/SocialIcons";
import { ThemeToggle } from "../theme/ThemeToggle";

import { isActivePath } from "./isActivePath";
import { MARKETING_MOBILE_NAV_ID } from "./MarketingNavbar";

interface MarketingMobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  items: MarketingNavItem[];
  resourceLinks: MarketingSimpleLink[];
  legalLinks: MarketingSimpleLink[];
  githubHref: string;
  appHref: string;
  ctaLabel?: string;
  footerNote?: string;
}

const eyebrowClassName = "text-muted mb-3 text-xs font-semibold tracking-[0.24em] uppercase";

function rise(isOpen: boolean, delayMs: number): React.CSSProperties {
  return {
    transitionDelay: isOpen ? `${delayMs}ms` : "0ms",
    transform: isOpen ? "translateY(0)" : "translateY(12px)",
    opacity: isOpen ? 1 : 0,
  };
}

const riseClassName =
  "transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]";

export const MarketingMobileNav = ({
  isOpen,
  onClose,
  items,
  resourceLinks,
  legalLinks,
  githubHref,
  appHref,
  ctaLabel = "Start Building Free",
  footerNote = "No login required · Free forever",
}: MarketingMobileNavProps) => {
  const pathname = usePathname();

  return (
    <div
      id={MARKETING_MOBILE_NAV_ID}
      inert={!isOpen}
      className={cn(
        "bg-background fixed inset-0 z-90 flex h-dvh w-full flex-col overflow-hidden lg:hidden",
        "transition-[transform,opacity] duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]",
        isOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0",
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-1/4 -right-1/4 size-[70%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent)_14%,transparent),transparent)]"
      />

      <Container className="relative flex h-full flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-4 pt-28 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <nav aria-label="Main" className="flex-1 space-y-8">
          <ul className="grid gap-2">
            {items.map((item, i) => {
              const active = !item.external && isActivePath(pathname, item.href);

              return (
                <li key={item.name} className={riseClassName} style={rise(isOpen, i * 40)}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    className={cn(
                      "group focus-visible:ring-accent flex items-center justify-between rounded-2xl px-4 py-4 transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-hidden",
                      active
                        ? "bg-accent/10 text-foreground"
                        : "text-muted hover:bg-accent/5 hover:text-foreground",
                    )}
                  >
                    <span className="flex items-center gap-4">
                      <span
                        className={cn(
                          "border-border/40 flex size-12 shrink-0 items-center justify-center rounded-xl border transition-colors",
                          active
                            ? "bg-accent border-accent/20 text-accent-foreground"
                            : "bg-accent/5",
                        )}
                      >
                        <item.icon aria-hidden="true" className="size-6" />
                      </span>

                      <span className="text-xl font-semibold tracking-tight">{item.name}</span>
                      {item.external ? <span className="sr-only">(opens in a new tab)</span> : null}
                    </span>

                    <ArrowRight
                      aria-hidden="true"
                      className={cn(
                        "size-5 transition-[opacity,transform] duration-300 ease-out",
                        active ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0",
                      )}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>

          <div
            className={cn("border-border/40 grid grid-cols-2 gap-6 border-t pt-8", riseClassName)}
            style={rise(isOpen, 160)}
          >
            {(
              [
                ["Resources", resourceLinks],
                ["Legal", legalLinks],
              ] as const
            ).map(([title, links]) => (
              <section key={title} aria-labelledby={`${MARKETING_MOBILE_NAV_ID}-${title}`}>
                <h2 id={`${MARKETING_MOBILE_NAV_ID}-${title}`} className={eyebrowClassName}>
                  {title}
                </h2>

                <ul className="flex flex-col gap-1">
                  {links.map((link) => (
                    <li key={link.name}>
                      <Link
                        href={link.href}
                        onClick={onClose}
                        className="text-muted hover:text-foreground focus-visible:ring-accent -mx-1 block rounded-md px-1 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </nav>

        <div className={cn("mt-10 space-y-6", riseClassName)} style={rise(isOpen, 220)}>
          <div className="bg-accent/5 border-border/40 flex items-center justify-between gap-4 rounded-3xl border p-4">
            <div className="flex items-center gap-4">
              <ThemeToggle />

              <div>
                <p className="text-sm font-semibold">Appearance</p>
                <p className="text-muted text-xs">Switch between light and dark</p>
              </div>
            </div>

            <Link
              target="_blank"
              href={githubHref}
              onClick={onClose}
              rel="noopener noreferrer"
              aria-label="VeriWorkly on GitHub (opens in a new tab)"
              className="text-muted hover:text-foreground focus-visible:ring-accent flex size-11 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
            >
              <GithubIcon className="size-5" />
            </Link>
          </div>

          <Button
            asChild
            onClick={onClose}
            className="bg-foreground text-background shadow-foreground/5 h-14 w-full rounded-2xl text-base font-semibold shadow-xl hover:opacity-90"
          >
            <Link href={appHref}>{ctaLabel}</Link>
          </Button>

          <p className="text-muted text-center text-xs font-medium">{footerNote}</p>
        </div>
      </Container>
    </div>
  );
};
