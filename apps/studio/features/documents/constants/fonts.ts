export const FONT_IDS = ["geist", "modern", "inter"] as const;

export type FontFamilyId = (typeof FONT_IDS)[number];

type FontScope = "editor" | "on-demand";

type PdfFontFace = {
  src: string;
  fontWeight: number;
};

export interface FontRegistryEntry {
  id: FontFamilyId;
  label: string;
  primaryFamily: string;
  fallbackStack: string;
  stylesheetHref: string;
  scope: FontScope;
  pdfFonts: PdfFontFace[];
}

const fontDefinitions: FontRegistryEntry[] = [
  {
    id: "geist",
    label: "Geist Sans",
    primaryFamily: "Geist",
    fallbackStack: "Inter, 'Segoe UI', Arial, sans-serif",
    // Only 400/700 are requested — matches the two weights registered in pdfFonts
    // below. Requesting extra web weights the PDF renderer can't reproduce creates a
    // WYSIWYG mismatch between the live preview and the downloaded PDF.
    stylesheetHref: "https://fonts.googleapis.com/css2?family=Geist:wght@400;700&display=swap",
    scope: "editor",
    pdfFonts: [
      { src: "/fonts/geist/Geist-Regular.ttf", fontWeight: 400 },
      { src: "/fonts/geist/Geist-Bold.ttf", fontWeight: 700 },
    ],
  },
  {
    id: "modern",
    label: "Manrope Grotesk",
    primaryFamily: "Manrope",
    fallbackStack: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    stylesheetHref: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;700&display=swap",
    scope: "editor",
    pdfFonts: [
      { src: "/fonts/manrope/Manrope-Regular.ttf", fontWeight: 400 },
      { src: "/fonts/manrope/Manrope-Bold.ttf", fontWeight: 700 },
    ],
  },
  {
    id: "inter",
    label: "Inter",
    primaryFamily: "Inter",
    fallbackStack: "'Segoe UI', Arial, sans-serif",
    stylesheetHref: "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap",
    scope: "editor",
    pdfFonts: [
      { src: "/fonts/inter/Inter_18pt-Regular.ttf", fontWeight: 400 },
      { src: "/fonts/inter/Inter_18pt-Bold.ttf", fontWeight: 700 },
    ],
  },
];

const FONT_ALIAS_MAP: Record<string, FontFamilyId> = {
  mono: "geist",
};

const FONT_ID_SET = new Set<FontFamilyId>(fontDefinitions.map((font) => font.id));

export const DEFAULT_FONT_FAMILY: FontFamilyId = "geist";

export const FONT_REGISTRY: Record<FontFamilyId, FontRegistryEntry> = Object.fromEntries(
  fontDefinitions.map((font) => [font.id, font]),
) as Record<FontFamilyId, FontRegistryEntry>;

export function isFontFamilyId(value: string): value is FontFamilyId {
  return FONT_ID_SET.has(value as FontFamilyId);
}

export function normalizeFontFamilyId(value: string | null | undefined): FontFamilyId {
  const normalized = (value ?? "").trim().toLowerCase();

  if (isFontFamilyId(normalized)) {
    return normalized;
  }

  if (normalized in FONT_ALIAS_MAP) {
    return FONT_ALIAS_MAP[normalized];
  }

  return DEFAULT_FONT_FAMILY;
}

export const fontOptions: Array<{ value: FontFamilyId; label: string }> = fontDefinitions.map(
  (font) => ({
    value: font.id,
    label: font.label,
  }),
);

function toFontFamilyValue(font: FontRegistryEntry) {
  return `'${font.primaryFamily}', ${font.fallbackStack}`;
}

export const FONT_FAMILY_MAP: Record<FontFamilyId, string> = Object.fromEntries(
  fontDefinitions.map((font) => [font.id, toFontFamilyValue(font)]),
) as Record<FontFamilyId, string>;

export function getFontStylesheetHref(fontFamily: string | null | undefined) {
  const normalized = normalizeFontFamilyId(fontFamily);
  return FONT_REGISTRY[normalized].stylesheetHref;
}

export const EDITOR_FONT_STYLESHEET_HREFS = fontDefinitions
  .filter((font) => font.scope === "editor")
  .map((font) => font.stylesheetHref);
