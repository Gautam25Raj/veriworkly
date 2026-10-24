"use client";

import * as React from "react";
import { X, Menu } from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "../../../utils";
import { lockScroll } from "../../../lib/scroll-lock";

import { Container } from "../Container";

export const MARKETING_MOBILE_NAV_ID = "marketing-mobile-nav";

interface MarketingNavbarProps {
  logo: React.ReactNode;
  desktopNav: React.ReactNode;
  actions: React.ReactNode;
  mobileNav: (props: { isOpen: boolean; onClose: () => void }) => React.ReactNode;
}

export const MarketingNavbar = ({ logo, desktopNav, actions, mobileNav }: MarketingNavbarProps) => {
  const pathname = usePathname();

  const headerRef = React.useRef<HTMLElement>(null);
  const toggleRef = React.useRef<HTMLButtonElement>(null);

  const [scrolled, setScrolled] = React.useState(false);
  const [mobileMenuPath, setMobileMenuPath] = React.useState<string | null>(null);

  const isOpen = mobileMenuPath !== null && mobileMenuPath === pathname;

  const close = React.useCallback(() => setMobileMenuPath(null), []);

  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;

    const header = headerRef.current;
    const unlockScroll = lockScroll();
    const inerted: HTMLElement[] = [];

    for (const sibling of Array.from(header?.parentElement?.children ?? [])) {
      if (
        sibling instanceof HTMLElement &&
        sibling !== header &&
        sibling.id !== MARKETING_MOBILE_NAV_ID &&
        !sibling.inert
      ) {
        sibling.inert = true;
        inerted.push(sibling);
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      close();
      toggleRef.current?.focus();
    };

    const desktop = window.matchMedia("(min-width: 64rem)");
    const handleBreakpoint = (event: MediaQueryListEvent) => {
      if (event.matches) close();
    };

    document.addEventListener("keydown", handleKeyDown);
    desktop.addEventListener("change", handleBreakpoint);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      desktop.removeEventListener("change", handleBreakpoint);
      for (const element of inerted) element.inert = false;
      unlockScroll();
    };
  }, [isOpen, close]);

  return (
    <>
      <header
        ref={headerRef}
        className={cn(
          "fixed top-0 right-0 left-0 z-100 border-b transition-[padding,background-color,border-color] duration-300 ease-out",
          scrolled || isOpen
            ? "border-border/40 bg-background/85 py-3 backdrop-blur-xl"
            : "border-transparent bg-transparent py-5",
        )}
      >
        <Container>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-10">
              {logo}
              {desktopNav}
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              {actions}

              <button
                ref={toggleRef}
                type="button"
                aria-expanded={isOpen}
                aria-controls={MARKETING_MOBILE_NAV_ID}
                aria-label={isOpen ? "Close menu" : "Open menu"}
                onClick={() => setMobileMenuPath((prev) => (prev === pathname ? null : pathname))}
                className="text-muted hover:text-foreground bg-accent/5 focus-visible:ring-accent relative flex size-11 cursor-pointer items-center justify-center rounded-xl transition-[color,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:outline-hidden active:scale-[0.97] lg:hidden"
              >
                {isOpen ? (
                  <X aria-hidden="true" className="size-6" />
                ) : (
                  <Menu aria-hidden="true" className="size-6" />
                )}
              </button>
            </div>
          </div>
        </Container>
      </header>

      {mobileNav({ isOpen, onClose: close })}
    </>
  );
};
