"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Button, Card, Input, Select } from "@veriworkly/ui";

export interface AdminFilterOption {
  label: string;
  value: string;
}

export interface AdminFilterSelect {
  name: string;
  label: string;
  options: AdminFilterOption[];
}

interface AdminFilterBarProps {
  basePath: string;
  searchPlaceholder?: string;
  selects?: AdminFilterSelect[];
}

/**
 * Filters are URL state, not component state.
 *
 * Every admin list page is a server component that reads `searchParams`, so applying a filter
 * has to be a navigation. The payoff is that a filtered view is a shareable link — an operator
 * can paste "the failed webhooks page" into a ticket and it still means the same thing.
 */
const AdminFilterBar = ({
  basePath,
  searchPlaceholder = "Search…",
  selects = [],
}: AdminFilterBarProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentQuery = searchParams.get("query") ?? "";

  const applyParam = (name: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());

    if (value) next.set(name, value);
    else next.delete(name);

    // Any filter change invalidates the current page position.
    next.delete("offset");

    const search = next.toString();
    router.push(search ? `${basePath}?${search}` : basePath);
  };

  const hasFilters = [...searchParams.keys()].some((key) => key !== "offset");

  return (
    <Card className="rounded-3xl p-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();

          const submitted = new FormData(event.currentTarget).get("query");
          applyParam("query", typeof submitted === "string" ? submitted.trim() : "");
        }}
      >
        <div className="min-w-56 flex-1 space-y-1.5">
          <label htmlFor="admin-filter-query" className="text-muted text-xs font-medium">
            Search
          </label>

          {/*
            Uncontrolled, keyed on the URL value. The URL is the source of truth for filters, so
            keying here remounts the input with the right default whenever the URL changes (back
            button, Reset) without an effect that writes state on every render.
          */}
          <Input
            key={currentQuery}
            id="admin-filter-query"
            name="query"
            inputSize="sm"
            defaultValue={currentQuery}
            placeholder={searchPlaceholder}
          />
        </div>

        {selects.map((select) => (
          <div key={select.name} className="min-w-40 space-y-1.5">
            <label
              htmlFor={`admin-filter-${select.name}`}
              className="text-muted text-xs font-medium"
            >
              {select.label}
            </label>

            <Select
              id={`admin-filter-${select.name}`}
              className="h-9 text-xs"
              value={searchParams.get(select.name) ?? ""}
              onChange={(event) => applyParam(select.name, event.target.value)}
            >
              {select.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        ))}

        <div className="flex items-center gap-2">
          <Button type="submit" size="sm">
            Apply
          </Button>

          {hasFilters ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => router.push(basePath)}>
              Reset
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
};

export default AdminFilterBar;
