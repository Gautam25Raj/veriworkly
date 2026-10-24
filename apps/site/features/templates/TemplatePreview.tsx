import Image from "next/image";

import { cn } from "@veriworkly/ui";

import type { TemplateSummary } from "@/config/templates";

type Props = {
  template: Pick<TemplateSummary, "name" | "documentType" | "documentTypeLabel" | "previewImage">;
  sizes: string;
  /** "lcp": the page's largest image (eager, high fetch priority); "eager": above the fold. */
  loading?: "lcp" | "eager";
  className?: string;
};

/** The shape follows the document type: sheets are 8.5x11, portfolios a 1900x937 screenshot. */
const TemplatePreview = ({ template, sizes, loading, className }: Props) => {
  const isPortfolio = template.documentType === "portfolio-website";

  return (
    <div
      className={cn(
        // The sheet edge: a white page on a white band otherwise has no outline at all.
        "ring-foreground/10 relative overflow-hidden bg-white ring-1",
        isPortfolio ? "aspect-1900/937 rounded-2xl" : "aspect-8.5/11 rounded-md",
        className,
      )}
    >
      <Image
        fill
        sizes={sizes}
        loading={loading ? "eager" : undefined}
        fetchPriority={loading === "lcp" ? "high" : undefined}
        src={template.previewImage}
        alt={`${template.name} ${template.documentTypeLabel.toLowerCase()} template preview`}
        className={isPortfolio ? "object-cover object-top" : "object-contain object-top"}
      />
    </div>
  );
};

export default TemplatePreview;
