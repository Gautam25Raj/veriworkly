export interface LegalSubsection {
  heading?: string;
  paragraphs?: string[];
  list?: string[];
  orderedList?: string[];
}

export interface LegalSection {
  id: string;
  title: string;
  intro?: string[];
  subsections?: LegalSubsection[];
}

interface LegalSectionsProps {
  sections: LegalSection[];
}

export function LegalSections({ sections }: LegalSectionsProps) {
  return (
    <section className="space-y-14">
      <nav
        aria-label="Table of contents"
        className="border-border/60 bg-card/40 rounded-3xl border p-6 md:p-8"
      >
        <h2 className="text-foreground text-xs font-bold tracking-widest uppercase">
          Table of contents
        </h2>
        <ol className="text-muted mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {sections.map((section, idx) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="hover:text-accent transition-colors">
                {idx + 1}. {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((section, idx) => (
        <article
          key={section.id}
          id={section.id}
          className="border-border/60 scroll-mt-28 border-t pt-10 first:border-t-0 first:pt-0"
        >
          <h2 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
            {idx + 1}. {section.title}
          </h2>

          {section.intro?.map((paragraph, i) => (
            <p key={i} className="text-muted mt-4 text-sm leading-7 md:text-base md:leading-8">
              {paragraph}
            </p>
          ))}

          {section.subsections?.map((sub, si) => (
            <div key={si} className="mt-6">
              {sub.heading ? (
                <h3 className="text-foreground text-lg font-semibold tracking-tight">
                  {idx + 1}.{si + 1} {sub.heading}
                </h3>
              ) : null}

              {sub.paragraphs?.map((paragraph, pi) => (
                <p key={pi} className="text-muted mt-3 text-sm leading-7">
                  {paragraph}
                </p>
              ))}

              {sub.list ? (
                <ul className="text-muted mt-3 list-disc space-y-2 pl-5 text-sm leading-6">
                  {sub.list.map((item, li) => (
                    <li key={li}>{item}</li>
                  ))}
                </ul>
              ) : null}

              {sub.orderedList ? (
                <ol className="text-muted mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">
                  {sub.orderedList.map((item, li) => (
                    <li key={li}>{item}</li>
                  ))}
                </ol>
              ) : null}
            </div>
          ))}
        </article>
      ))}
    </section>
  );
}

export default LegalSections;
