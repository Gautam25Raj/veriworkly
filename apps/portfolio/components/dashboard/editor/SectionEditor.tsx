import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { createId, type PortfolioSection } from "@/lib/portfolio";
import { usePortfolioStore } from "@/store/portfolio-store";
import { EditorPanel } from "./EditorPanel";
import { Field } from "./Field";
import { ItemAction } from "./ItemAction";
import { AssetUpload } from "./AssetUpload";
import { actionClass as action, inputClass as input, sectionInfo } from "./constants";
import { PortfolioAiAssist } from "./PortfolioAiAssist";
import { ItemFields } from "./ItemFields";
import { emptyItemFor, sectionFields, sectionSubtitleDefaults } from "@/lib/section-fields";

export interface SectionEditorProps {
  section: PortfolioSection;
}

export function SectionEditor({ section }: SectionEditorProps) {
  const updateSection = usePortfolioStore((state) => state.updateSection);
  const documentId = usePortfolioStore((state) => state.draft?.id);
  const replaceItems = (items: Array<Record<string, unknown>>) =>
    updateSection(section.id, { items });
  const updateItem = (index: number, patch: Record<string, unknown>) =>
    replaceItems(section.items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= section.items.length) return;
    const items = [...section.items];
    [items[index], items[target]] = [items[target], items[index]];
    replaceItems(items);
  };

  return (
    <EditorPanel
      title={section.title.trim() || `Untitled ${sectionInfo[section.type].label}`}
      detail={`${section.items.length} ${section.items.length === 1 ? "item" : "items"} · ${sectionInfo[section.type].detail}`}
    >
      <Field label="Section title">
        <input
          className={input}
          value={section.title}
          onChange={(e) => updateSection(section.id, { title: e.target.value })}
        />
      </Field>
      {section.type !== "contact" ? (
        <Field
          label="Section subtitle"
          help="Shown under the heading. Clear it to hide the subtitle entirely."
        >
          <input
            className={input}
            placeholder={sectionSubtitleDefaults[section.type]}
            value={typeof section.subtitle === "string" ? section.subtitle : ""}
            onChange={(e) => updateSection(section.id, { subtitle: e.target.value })}
          />
        </Field>
      ) : null}
      {section.type === "contact" ? (
        <p className="bg-paper text-muted rounded-xl p-3 text-xs leading-5">
          The contact section uses your public email and availability from Introduction.
        </p>
      ) : null}
      {section.type === "writing" ? (
        <div className="border-line bg-panel mb-4 rounded-xl border p-4">
          <label className="flex cursor-pointer items-start gap-3 select-none">
            <input
              type="checkbox"
              className="border-line bg-paper text-accent focus:ring-accent mt-0.5 rounded"
              checked={section.settings?.showNewsletter !== false}
              onChange={(e) =>
                updateSection(section.id, {
                  settings: { ...section.settings, showNewsletter: e.target.checked },
                })
              }
            />
            <div>
              <span className="text-ink block text-sm font-semibold">
                Include newsletter signup
              </span>
              <span className="text-muted text-xs">
                Display a subscription card at the bottom of your writing section.
              </span>
            </div>
          </label>
        </div>
      ) : null}
      <div className="space-y-3">
        {section.items.map((item, index) => (
          <div
            key={String(item.id ?? index)}
            className="border-line bg-paper rounded-xl border p-3"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-muted text-[10px] font-extrabold tracking-[.12em] uppercase">
                Item {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex items-center gap-1">
                <ItemAction
                  label="Move item up"
                  disabled={index === 0}
                  onClick={() => moveItem(index, -1)}
                >
                  <ArrowUp size={13} aria-hidden="true" />
                </ItemAction>
                <ItemAction
                  label="Move item down"
                  disabled={index === section.items.length - 1}
                  onClick={() => moveItem(index, 1)}
                >
                  <ArrowDown size={13} aria-hidden="true" />
                </ItemAction>
                <ItemAction
                  label="Delete item"
                  danger
                  onClick={() =>
                    replaceItems(section.items.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  <Trash2 size={13} aria-hidden="true" />
                </ItemAction>
              </div>
            </div>
            <div className="grid gap-3">
              <ItemFields
                fields={sectionFields[section.type]}
                item={item}
                onChange={(patch) => updateItem(index, patch)}
              />
            </div>
            <PortfolioAiAssist
              context={JSON.stringify({
                sectionType: section.type,
                sectionTitle: section.title,
                itemTitle: item.title ?? item.role ?? item.school,
                year: item.year ?? item.date ?? item.startDate,
              })}
              documentId={documentId}
              onApply={(summary) => updateItem(index, { summary })}
              text={String(item.summary ?? "")}
            />
            {section.type === "projects" ? (
              <AssetUpload
                kind="PROJECT_COVER"
                label="Project cover"
                value={assetUrl(item.coverImage)}
                onUploaded={(coverImage) => updateItem(index, { coverImage })}
              />
            ) : null}
          </div>
        ))}
        {section.type !== "contact" ? (
          <button
            className={`${action} border-line bg-panel text-ink border`}
            onClick={() =>
              updateSection(section.id, {
                items: [...section.items, { id: createId("item"), ...emptyItemFor(section.type) }],
              })
            }
            type="button"
          >
            <Plus size={14} aria-hidden="true" /> Add item
          </button>
        ) : null}
      </div>
    </EditorPanel>
  );
}

function assetUrl(value: unknown) {
  return value && typeof value === "object" && "url" in value
    ? String((value as { url?: unknown }).url ?? "")
    : undefined;
}
