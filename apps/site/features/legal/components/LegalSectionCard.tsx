"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";

import { TYPE } from "@/components/marketing/PageLayout";

import type { LegalSection } from "../types";

interface LegalSectionCardProps {
  section: LegalSection;
  displayIndex: number;
}

const PARAGRAPH = "text-foreground/85 mt-4 text-base leading-8 lg:text-[1.0625rem]";

/** One clause of the document, set for reading: numbered, because people cite clauses. */
export function LegalSectionCard({ section, displayIndex }: LegalSectionCardProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#${section.id}`;

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard access can be refused (permissions, insecure origin). The URL bar still
      // gets the anchor, so the link is not lost.
      window.location.hash = section.id;
      return;
    }

    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article id={section.id} className="scroll-mt-28 lg:scroll-mt-32">
      <div className="flex items-start justify-between gap-4">
        <h2 className={`text-balance ${TYPE.title}`}>
          <span className="text-muted mr-3 tabular-nums">{displayIndex}.</span>
          {section.title}
        </h2>

        <button
          type="button"
          onClick={copyLink}
          aria-label={copied ? "Link copied" : `Copy link to "${section.title}"`}
          className="text-muted hover:text-foreground hover:bg-card focus-visible:ring-accent/40 mt-1 inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none active:scale-[0.95]"
        >
          {copied ? (
            <Check aria-hidden="true" className="text-success size-4" />
          ) : (
            <Link2 aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Link copied" : ""}
      </span>

      {section.intro?.map((paragraph, i) => (
        <p key={i} className={PARAGRAPH}>
          {paragraph}
        </p>
      ))}

      {section.subsections?.map((sub, si) => (
        <div key={si} className="mt-8">
          {sub.heading && (
            <h3 className="text-lg leading-snug font-semibold tracking-tight">
              <span className="text-muted mr-2 tabular-nums">
                {displayIndex}.{si + 1}
              </span>
              {sub.heading}
            </h3>
          )}

          {sub.paragraphs?.map((paragraph, pi) => (
            <p key={pi} className={PARAGRAPH}>
              {paragraph}
            </p>
          ))}

          {sub.list && (
            <ul className="text-foreground/85 mt-4 space-y-3 text-base leading-7 lg:text-[1.0625rem]">
              {sub.list.map((item, li) => (
                <li key={li} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="bg-accent mt-3 size-1.5 shrink-0 rounded-full"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}

          {sub.orderedList && (
            <ol className="text-foreground/85 marker:text-muted mt-4 list-decimal space-y-3 pl-6 text-base leading-7 marker:font-semibold lg:text-[1.0625rem]">
              {sub.orderedList.map((item, li) => (
                <li key={li} className="pl-2">
                  {item}
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </article>
  );
}
