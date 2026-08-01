"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/config/site";
import { NAVIGATION_ITEMS } from "./navbar/constants";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { cn } from "@veriworkly/ui";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Moon, Sun, ArrowUpRight } from "lucide-react";
import { useTheme } from "next-themes";

const MOBILE_MENU_ID = "site-mobile-menu";

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const isDark = resolvedTheme === "dark";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useFocusTrap(mobileMenuOpen, mobileMenuRef, {
    onEscape: () => setMobileMenuOpen(false),
  });

  return (
    <>
      <header
        className={cn(
          "pointer-events-none fixed top-2 right-2 left-2 z-50 transition-all duration-300 md:top-4 md:right-4 md:left-4",
          scrolled ? "py-2" : "py-4",
        )}
      >
        <div className="container mx-auto flex max-w-7xl items-center justify-between px-4">
          {/* Logo Pill */}
          {/*
            Relative, not `siteConfig.links.main`. The absolute origin made the single most
            clicked control in the header a full document navigation — discarding the router
            cache and re-downloading the app shell to reach a route Next can render instantly.
          */}
          <Link
            href="/"
            aria-label={`${siteConfig.shortName} home`}
            className="group pointer-events-auto relative flex items-center gap-2 rounded-full border border-black/5 bg-white/70 px-5 py-2.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] backdrop-blur-md transition-transform hover:scale-[1.02] dark:border-white/5 dark:bg-[#111]/70"
          >
            <Image
              src="/veriworkly-logo.png"
              alt="VeriWorkly"
              width={24}
              height={24}
              priority
              className="h-6 w-auto"
            />
            <span className="hidden font-mono font-bold tracking-tight text-gray-900 sm:block dark:text-white">
              {siteConfig.shortName || "VeriWorkly"}
            </span>
          </Link>

          {/* Desktop Nav Pill */}
          <nav className="pointer-events-auto hidden items-center gap-1 rounded-full border border-black/5 bg-white/70 px-2 py-1.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] backdrop-blur-md md:flex dark:border-white/5 dark:bg-[#111]/70">
            {NAVIGATION_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                  className={cn(
                    "relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "text-gray-900 dark:text-white"
                      : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-full bg-black/5 dark:bg-white/10"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1">
                    {item.name}
                    {item.external && (
                      <>
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </>
                    )}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Actions Pill */}
          <div className="pointer-events-auto hidden items-center gap-1 rounded-full border border-black/5 bg-white/70 p-1.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] backdrop-blur-md md:flex dark:border-white/5 dark:bg-[#111]/70">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} theme` : "Toggle theme"}
            >
              {mounted ? (
                isDark ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )
              ) : (
                <div className="h-4 w-4" />
              )}
            </button>

            {/* GitHub Link */}
            <Link
              href={siteConfig.links.github}
              target="_blank"
              rel="noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="GitHub Repository"
            >
              <Image
                src="/icons/socials/github.svg"
                alt="GitHub"
                width={16}
                height={16}
                className="h-4 w-4 opacity-80 transition-opacity hover:opacity-100 dark:invert"
              />
            </Link>

            <Link
              href={`${siteConfig.links.app}/login`}
              className="ml-1 rounded-full bg-gray-900 px-5 py-1.5 text-sm font-medium text-white shadow-sm transition-[transform,box-shadow] duration-200 ease-out hover:scale-[1.02] active:scale-[0.97] dark:bg-white dark:text-gray-900"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="pointer-events-auto rounded-full border border-black/5 bg-white/70 p-2.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] backdrop-blur-md md:hidden dark:border-white/5 dark:bg-[#111]/70"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-haspopup="dialog"
            aria-controls={MOBILE_MENU_ID}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/*
              The panel is `aria-modal` and traps focus, but nothing sat behind it — so on
              touch the only way out was to find the small X again. Tapping away from an
              open sheet is the expected gesture; this gives it something to hit.
            */}
            <motion.div
              key="mobile-menu-backdrop"
              aria-hidden="true"
              onClick={() => setMobileMenuOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[2px] md:hidden dark:bg-black/50"
            />
            <motion.div
              key="mobile-menu-panel"
              ref={mobileMenuRef}
              id={MOBILE_MENU_ID}
              role="dialog"
              aria-modal="true"
              aria-label="Site navigation"
              tabIndex={-1}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-x-4 top-24 z-40 flex flex-col gap-4 rounded-3xl border border-black/5 bg-white/95 p-4 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] backdrop-blur-xl md:hidden dark:border-white/5 dark:bg-[#111]/95"
            >
              <nav className="flex flex-col gap-1">
                {NAVIGATION_ITEMS.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "rounded-2xl px-4 py-3 text-base font-medium transition-colors",
                        isActive
                          ? "bg-black/5 text-gray-900 dark:bg-white/10 dark:text-white"
                          : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {item.name}
                        {item.external && (
                          <>
                            <ArrowUpRight className="h-4 w-4 opacity-50" aria-hidden="true" />
                            <span className="sr-only">(opens in a new tab)</span>
                          </>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </nav>
              <div className="h-px w-full bg-gray-100 dark:bg-white/10" />
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-4">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Theme
                  </span>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
                    aria-label={
                      mounted ? `Switch to ${isDark ? "light" : "dark"} theme` : "Toggle theme"
                    }
                  >
                    {mounted ? (
                      isDark ? (
                        <Sun className="h-5 w-5" />
                      ) : (
                        <Moon className="h-5 w-5" />
                      )
                    ) : (
                      <div className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <div className="mb-2 flex items-center justify-between px-4">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    GitHub
                  </span>
                  <Link
                    href={siteConfig.links.github}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
                    aria-label="GitHub Repository"
                  >
                    <Image
                      src="/icons/socials/github.svg"
                      alt="GitHub"
                      width={20}
                      height={20}
                      className="h-5 w-5 opacity-80 transition-opacity hover:opacity-100 dark:invert"
                    />
                  </Link>
                </div>

                <Link
                  href={`${siteConfig.links.app}/login`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center rounded-2xl bg-gray-900 px-4 py-3 text-base font-medium text-white shadow-sm transition-transform active:scale-[0.98] dark:bg-white dark:text-gray-900"
                >
                  Get Started
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default React.memo(Navbar);
