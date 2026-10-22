import type { TemplateSummary } from "@/config/templates";

import { TYPE } from "@/components/marketing/PageLayout";

import TemplateCard from "./TemplateCard";

type TemplateGroupProps = {
  group: {
    title: string;
    description: string;
    items: TemplateSummary[];
  };
};

/**
 * A style system and its templates. Most systems hold one or two templates, so the heading
 * is a block title, not a section heading: six of those in a row would shout over the previews.
 */
const TemplateGroup = ({ group }: TemplateGroupProps) => (
  <section aria-label={group.title}>
    <div className="border-border border-t pt-6">
      <h2 className={`reveal ${TYPE.title}`}>{group.title}</h2>
      <p className="reveal text-muted mt-2 max-w-2xl text-base leading-7 text-pretty">
        {group.description ? `${group.description} ` : ""}
        {group.items.length} available.
      </p>
    </div>

    <div className="mt-6 grid gap-6">
      {group.items.map((template, index) => (
        <TemplateCard key={template.id} template={template} priority={index === 0} />
      ))}
    </div>
  </section>
);

export default TemplateGroup;
