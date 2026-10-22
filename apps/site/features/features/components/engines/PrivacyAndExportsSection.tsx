import { PageSection, TYPE } from "@/components/marketing/PageLayout";

import { EXPORT_FORMATS } from "../../data";

const STORAGE_FACTS = [
  { term: "Where your drafts live", detail: "Your browser's local storage" },
  { term: "Account to start", detail: "None" },
  { term: "Watermarks", detail: "None, in any format" },
];

export const PrivacyAndExportsSection = () => (
  <PageSection
    id="exports"
    tone="card"
    title="Six formats. All of them free."
    lede="Export as often as you like, with no watermark and no download limit, on every tier."
  >
    <ul className="grid gap-x-12 md:grid-cols-2">
      {EXPORT_FORMATS.map((format) => (
        <li
          key={format.ext}
          className="reveal border-border grid grid-cols-[5rem_1fr] items-baseline gap-4 border-t py-5 sm:grid-cols-[6rem_1fr] sm:py-6"
        >
          <span className="text-accent text-2xl font-bold tracking-tighter">.{format.ext}</span>
          <span>
            <span className="block text-lg leading-snug font-semibold">{format.name}</span>
            <span className="text-muted mt-1 block text-base leading-7 text-pretty">
              {format.desc}
            </span>
          </span>
        </li>
      ))}
    </ul>

    <div className="reveal bg-background mt-14 grid gap-8 rounded-3xl p-6 sm:p-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:gap-10 lg:p-10">
      <div>
        <h3 className={TYPE.title}>Local-first by default.</h3>
        <p className="text-muted mt-3 max-w-xl text-base leading-7 text-pretty">
          Cloud-only resume builders keep your phone number, address and history on their servers.
          VeriWorkly keeps your drafts in your browser. Before you clear your cache or change
          devices, make a one-click JSON backup, or opt into passwordless cloud sync.
        </p>
      </div>

      <dl className="space-y-2">
        {STORAGE_FACTS.map((fact) => (
          <div
            key={fact.term}
            className="bg-card flex items-center justify-between gap-4 rounded-2xl px-5 py-4"
          >
            <dt className="text-muted text-base">{fact.term}</dt>
            <dd className="text-right text-base font-semibold">{fact.detail}</dd>
          </div>
        ))}
      </dl>
    </div>
  </PageSection>
);

export default PrivacyAndExportsSection;
