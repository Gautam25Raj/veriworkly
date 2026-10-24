"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@veriworkly/ui";

import { useSlidingPill } from "@/hooks/use-sliding-pill";

import { NAVIGATION_ITEMS } from "./constants";

export const DesktopNav = () => {
  const pathname = usePathname();

  const activeHref = NAVIGATION_ITEMS.find((item) => item.href === pathname)?.href ?? null;
  const pill = useSlidingPill(activeHref);

  return (
    <nav
      aria-label="Main"
      onMouseLeave={pill.onLeave}
      className="pointer-events-auto relative hidden items-center gap-1 rounded-full border border-black/8 bg-white/85 p-1.5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.1)] backdrop-blur-xl lg:flex dark:border-white/10 dark:bg-[#121212]/90 dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)]"
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1.5 bottom-1.5 left-0 rounded-full border shadow-2xs ease-[cubic-bezier(0.32,0.72,0,1)]",
          pill.box?.instant
            ? "transition-[opacity,background-color,border-color] duration-200"
            : "transition-[translate,width,opacity,background-color,border-color] duration-300",
          pill.hovered
            ? "border-zinc-200/90 bg-zinc-100/90 dark:border-white/10 dark:bg-white/12"
            : "border-zinc-200/60 bg-zinc-100/70 dark:border-white/10 dark:bg-white/10",
          pill.visible ? "opacity-100" : "opacity-0",
        )}
        style={pill.box ? { translate: `${pill.box.x}px 0`, width: pill.box.width } : undefined}
      />

      {NAVIGATION_ITEMS.map((item) => {
        const isActive = pathname === item.href;

        const Icon = item.icon;
        const isExternal = item.external;

        const LinkComponent = isExternal ? "a" : Link;
        const linkProps = isExternal
          ? { href: item.href, target: "_blank", rel: "noopener noreferrer" }
          : { href: item.href };

        return (
          <LinkComponent
            key={item.href}
            {...linkProps}
            ref={pill.itemRef(item.href)}
            onMouseEnter={() => pill.onItemEnter(item.href)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium text-zinc-600 transition-colors duration-200 select-none hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white",
              "aria-[current=page]:font-semibold aria-[current=page]:text-zinc-950 dark:aria-[current=page]:text-white",
              !pill.engaged &&
                "aria-[current=page]:before:absolute aria-[current=page]:before:inset-0 aria-[current=page]:before:rounded-full aria-[current=page]:before:border aria-[current=page]:before:border-zinc-200/60 aria-[current=page]:before:bg-zinc-100/70 aria-[current=page]:before:shadow-2xs dark:aria-[current=page]:before:border-white/10 dark:aria-[current=page]:before:bg-white/10",
            )}
          >
            <span className="relative z-10 flex items-center gap-1.5">
              {Icon && (
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110",
                    isActive
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-zinc-500 group-hover:text-zinc-800 dark:text-zinc-400 dark:group-hover:text-zinc-200",
                  )}
                  aria-hidden="true"
                />
              )}

              <span>{item.name}</span>

              {item.badge && (
                <span className="py-0.2 rounded-full bg-emerald-500/10 px-1.5 font-mono text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                  {item.badge}
                </span>
              )}

              {item.external && (
                <ArrowUpRight
                  aria-hidden="true"
                  className="h-3 w-3 opacity-40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-blue-500 group-hover:opacity-100"
                />
              )}
            </span>
          </LinkComponent>
        );
      })}
    </nav>
  );
};

export default DesktopNav;
