"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { cn } from "../../../utils";

import { Button } from "../../ui/Button";

const emptySubscribe = () => () => {};

const iconClassName =
  "absolute size-[1.2rem] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]";

export const ThemeToggle = ({ className }: { className?: string }) => {
  const { resolvedTheme, setTheme } = useTheme();

  const isClient = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const isDark = resolvedTheme === "dark";
  const label = !isClient
    ? "Toggle colour theme"
    : isDark
      ? "Switch to light theme"
      : "Switch to dark theme";

  return (
    <Button
      variant="secondary"
      aria-label={label}
      title={isClient ? label : undefined}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "bg-accent/5 hover:bg-accent/10 relative size-10 shrink-0 rounded-full p-0",
        className,
      )}
    >
      <Sun
        aria-hidden="true"
        className={cn(
          iconClassName,
          "scale-100 rotate-0 opacity-100 dark:scale-50 dark:-rotate-90 dark:opacity-0",
        )}
      />
      <Moon
        aria-hidden="true"
        className={cn(
          iconClassName,
          "scale-50 rotate-90 opacity-0 dark:scale-100 dark:rotate-0 dark:opacity-100",
        )}
      />
    </Button>
  );
};
