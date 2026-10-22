import Link from "next/link";
import { ArrowRight, Check, ExternalLink } from "lucide-react";

import type { TemplateSummary } from "@/config/templates";

import TemplatePreview from "./TemplatePreview";
import { buildPreviewUrl, getTemplateHref } from "./utils";

type TemplateCardProps = {
  template: TemplateSummary;
  priority?: boolean;
};

/** One template as a spread: the real preview large on one side, the decision on the other. */
const TemplateCard = ({ template, priority }: TemplateCardProps) => {
  const href = getTemplateHref(template);
  const previewUrl = buildPreviewUrl(template);
  const isPortfolio = template.documentType === "portfolio-website";

  return (
    <article
      className={`reveal bg-card grid overflow-hidden rounded-3xl ${
        isPortfolio
          ? "lg:grid-cols-[1.35fr_1fr]"
          : "md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
      }`}
    >
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className={`group bg-background flex items-center justify-center ${
          isPortfolio ? "p-5 sm:p-8" : "px-8 pt-8 sm:px-10 sm:pt-10 md:pb-10"
        }`}
      >
        <TemplatePreview
          priority={priority}
          template={template}
          sizes={isPortfolio ? "(min-width: 1024px) 640px, 92vw" : "(min-width: 768px) 380px, 80vw"}
          className={`w-full transition-transform duration-300 ease-out group-hover:-translate-y-1.5 ${
            isPortfolio ? "" : "max-w-xs max-md:rounded-b-none"
          }`}
        />
      </Link>

      <div className="flex min-w-0 flex-col justify-center gap-6 p-6 sm:p-8 lg:p-10">
        <div>
          <p className="text-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
            <span
              aria-hidden="true"
              className="size-3 rounded-full"
              style={{ backgroundColor: template.accentColor }}
            />
            {template.family}
            <span aria-hidden="true">/</span>
            {template.layout}
          </p>

          <h3 className="mt-3 text-xl leading-snug font-bold tracking-tight">
            <Link
              href={href}
              className="hover:text-accent focus-visible:ring-accent/40 rounded-lg transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none"
            >
              {template.name}
            </Link>
          </h3>

          <p className="text-muted mt-3 max-w-xl text-base leading-7 text-pretty">
            {template.shortDescription}
          </p>
        </div>

        <ul className="space-y-3 text-base leading-7">
          {template.bestFor.slice(0, 2).map((item) => (
            <li key={item} className="flex gap-3">
              <Check className="text-accent mt-1.5 size-4 shrink-0" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <p className="text-muted text-base">
          For {template.audience.slice(0, 3).join(", ").toLowerCase()}.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href={href}
            className="group bg-foreground text-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-accent/40 inline-flex h-11 items-center gap-2 rounded-full px-6 text-base font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97]"
          >
            Review template
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform duration-200 group-hover:translate-x-1"
            />
          </Link>

          {previewUrl && (
            <a
              href={previewUrl}
              className="border-border hover:bg-background focus-visible:ring-accent/40 inline-flex h-11 items-center gap-2 rounded-full border px-6 text-base font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.97]"
            >
              Live preview
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
};

export default TemplateCard;
