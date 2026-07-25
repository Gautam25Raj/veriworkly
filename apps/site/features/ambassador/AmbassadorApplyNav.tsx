"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const AmbassadorApplyNav = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-6 z-50 mx-auto w-full max-w-2xl px-6">
      <div className="flex items-center justify-between gap-4 rounded-full border border-zinc-200/50 bg-white/60 px-4 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.05)] backdrop-blur-xl dark:border-white/5 dark:bg-zinc-950/60 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
        <Link href="/ambassador" className="group flex items-center gap-3 active:scale-[0.98]">
          <div className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 shadow-inner dark:bg-white/5">
            <Image
              src="/veriworkly-logo.png"
              alt="VeriWorkly Logo"
              width={20}
              height={20}
              className="object-contain transition-transform duration-500 group-hover:rotate-12"
            />
          </div>
          <span className="font-mono text-sm font-semibold tracking-tight text-zinc-900 dark:text-white">
            VeriWorkly
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/ambassador"
            className="group inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-zinc-600 uppercase transition-colors duration-300 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-3 w-3 transition-transform duration-300 group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline">Back</span>
          </Link>

          {mounted && (
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="cursor-pointer border-l border-zinc-200/50 pl-3 text-zinc-600 transition-all hover:text-zinc-900 active:scale-95 dark:border-white/10 dark:text-zinc-400 dark:hover:text-white"
              aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
            >
              <AnimatePresence mode="wait">
                {resolvedTheme === "dark" ? (
                  <motion.div
                    key="sun"
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 90 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Sun className="h-3.5 w-3.5" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="moon"
                    initial={{ scale: 0, rotate: 90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: -90 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Moon className="h-3.5 w-3.5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default AmbassadorApplyNav;
