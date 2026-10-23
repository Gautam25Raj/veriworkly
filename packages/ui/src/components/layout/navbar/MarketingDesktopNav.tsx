"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";

import type { MarketingNavItem } from "./types";

import { cn } from "../../../utils";

import { isActivePath } from "./isActivePath";

interface MarketingDesktopNavProps {
  items: MarketingNavItem[];
  label?: string;
}

export const MarketingDesktopNav = ({ items, label = "Main" }: MarketingDesktopNavProps) => {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = !item.external && isActivePath(pathname, item.href);

          return (
            <li key={item.name}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                className={cn(
                  "group text-muted hover:text-foreground hover:bg-accent/5 focus-visible:ring-accent relative flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-hidden",
                  active && "text-foreground bg-accent/10",
                )}
              >
                <span className="font-sans">{item.name}</span>

                {item.external ? (
                  <>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-3.5 opacity-40 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                    <span className="sr-only">(opens in a new tab)</span>
                  </>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
