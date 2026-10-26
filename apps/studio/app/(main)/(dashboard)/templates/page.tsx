import type { Metadata } from "next";

import { templateGallery } from "./template-gallery";
import { TemplateExplorer } from "./TemplateExplorer";

export const metadata: Metadata = {
  title: "Templates",
  description: "Browse resume and cover letter templates and start a document from one.",
  robots: { index: false, follow: false },
};

export default function TemplatesPage() {
  return (
    <main className="space-y-6" aria-labelledby="templates-title">
      <header className="border-border bg-card rounded-2xl border p-5 sm:p-6">
        <p className="text-accent text-xs font-bold tracking-[0.2em] uppercase">Templates</p>

        <h1 id="templates-title" className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
          Pick a starting design
        </h1>

        <p className="text-muted mt-2 max-w-2xl text-base">
          Start a document from any template and switch templates any time from the editor&apos;s
          style settings. Guests and free accounts keep one document of each type: if you already
          have one, the template is applied to it.
        </p>
      </header>

      <TemplateExplorer templates={templateGallery} />
    </main>
  );
}
