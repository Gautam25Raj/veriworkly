"use client";

import { cn } from "@veriworkly/ui";

type Props = {
  familyOptions: string[];
  layoutOptions: string[];
  selectedFamily: string;
  selectedLayout: string;
  onFamilyChange: (family: string) => void;
  onLayoutChange: (layout: string) => void;
};

const withAll = (values: string[]) => ["All", ...values];

/**
 * Filtering is view state over a list already rendered on the page, so these are
 * buttons rather than links - no navigation, no server round-trip. `aria-pressed`
 * carries the on/off state that the old active-link styling only conveyed visually.
 */
const FilterGroup = ({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string;
  onChange: (value: string) => void;
}) => (
  <div role="group" aria-label={label} className="flex flex-col gap-3">
    <p className="text-muted text-sm font-semibold">{label}</p>
    {/* A scrolling row on phones, so six long layout names do not stack into a wall. */}
    <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {withAll(options).map((option) => {
        const active = selected === option;

        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={cn(
              "focus-visible:ring-accent/40 h-11 shrink-0 cursor-pointer rounded-full px-4 text-base font-semibold whitespace-nowrap transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.97] sm:px-5",
              active ? "bg-foreground text-background" : "bg-card text-muted hover:text-foreground",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  </div>
);

const TemplateFilters = ({
  familyOptions,
  layoutOptions,
  selectedFamily,
  selectedLayout,
  onFamilyChange,
  onLayoutChange,
}: Props) => (
  <div className="mb-14 flex flex-col gap-6 lg:mb-16">
    {familyOptions.length > 1 && (
      <FilterGroup
        label="Style system"
        options={familyOptions}
        selected={selectedFamily}
        onChange={onFamilyChange}
      />
    )}
    {layoutOptions.length > 1 && (
      <FilterGroup
        label="Layout"
        options={layoutOptions}
        selected={selectedLayout}
        onChange={onLayoutChange}
      />
    )}
  </div>
);

export default TemplateFilters;
