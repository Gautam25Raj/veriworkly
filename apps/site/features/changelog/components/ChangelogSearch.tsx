"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

const ChangelogSearch = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [value, setValue] = useState(searchParams.get("search") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (value.trim()) params.set("search", value.trim());
      else params.delete("search");

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="border-border/30 bg-background/60 focus-within:ring-accent/30 flex min-w-0 flex-1 items-center gap-2 rounded-full border px-3.5 py-1.5 transition-shadow focus-within:ring-2 sm:flex-none sm:basis-64">
      <Search className="text-muted h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search releases…"
        aria-label="Search changelog"
        className="text-foreground placeholder:text-muted/70 w-full min-w-0 bg-transparent font-sans text-xs font-medium outline-none"
      />
    </div>
  );
};

export default ChangelogSearch;
