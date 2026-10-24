export const fieldBase = [
  "text-foreground w-full border transition-[color,background-color,border-color,box-shadow] duration-200 ease-out",
  "placeholder:text-muted",
  "focus-visible:border-accent focus-visible:ring-accent/20 focus-visible:ring-3 focus-visible:outline-hidden",
  "aria-invalid:border-destructive/60 aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-destructive/15",
  "disabled:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

export const fieldOutline = "border-border bg-background hover:border-foreground/25";
