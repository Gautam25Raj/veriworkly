"use client";

import { ChevronDown, Search } from "lucide-react";

export const ALL = "All";

export type TemplateFilterState = { query: string; family: string; layout: string };

type Props = {
  value: TemplateFilterState;
  onChange: (next: TemplateFilterState) => void;
  familyOptions: string[];
  layoutOptions: string[];
  shown: number;
  total: number;
  noun: string;
  /** Present only while a filter is active. */
  onReset?: () => void;
};

const control =
  "bg-card text-foreground focus-visible:ring-accent/40 h-12 w-full rounded-full text-base transition-shadow focus-visible:ring-2 focus-visible:outline-none";

/** A native select: it scales to any number of options and works with every input method. */
const Select = ({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}) => (
  <label className="relative block sm:w-56">
    <span className="sr-only">{label}</span>
    <select
      value={selected}
      onChange={(event) => onSelect(event.target.value)}
      className={`${control} cursor-pointer appearance-none pr-11 pl-5 font-medium`}
    >
      <option value={ALL}>{`Any ${label.toLowerCase()}`}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
    <ChevronDown
      aria-hidden="true"
      className="text-muted pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2"
    />
  </label>
);

/**
 * Search, the two filters and the result count on one row. Filtering is view state over a list
 * already on the page, so nothing here navigates.
 */
const TemplateFilters = ({
  value,
  onChange,
  familyOptions,
  layoutOptions,
  shown,
  total,
  noun,
  onReset,
}: Props) => (
  <div className="mb-10 flex flex-col gap-4 lg:mb-12">
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <label className="relative block min-w-0 sm:flex-1 sm:basis-72">
        <span className="sr-only">Search {noun}</span>
        <Search
          aria-hidden="true"
          className="text-muted pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2"
        />
        <input
          type="search"
          value={value.query}
          onChange={(event) => onChange({ ...value, query: event.target.value })}
          placeholder="Search by name, style or role"
          className={`${control} placeholder:text-muted pr-5 pl-12`}
        />
      </label>

      {familyOptions.length > 1 && (
        <Select
          label="Style"
          options={familyOptions}
          selected={value.family}
          onSelect={(family) => onChange({ ...value, family })}
        />
      )}
      {layoutOptions.length > 1 && (
        <Select
          label="Layout"
          options={layoutOptions}
          selected={value.layout}
          onSelect={(layout) => onChange({ ...value, layout })}
        />
      )}
    </div>

    <p className="text-muted flex flex-wrap items-center gap-x-3 text-sm" aria-live="polite">
      <span className="tabular-nums">
        {shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`}
      </span>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="text-accent focus-visible:ring-accent/40 cursor-pointer rounded font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          Clear filters
        </button>
      )}
    </p>
  </div>
);

export default TemplateFilters;
