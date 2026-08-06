import { join } from "node:path";
import { createRequire } from "node:module";

import { createElement } from "react";
import { Document, Font, Page, Text, pdf } from "@react-pdf/renderer";
import { beforeAll, describe, expect, it } from "vitest";

import {
  FONT_IDS,
  FONT_REGISTRY,
  getPdfFontStack,
  type FontFamilyId,
} from "@/features/documents/constants/fonts";
import { registerPdfHyphenation } from "@/templates/pdf/fonts";

/**
 * What the export can actually draw.
 *
 * A character the embedded fonts have no glyph for does not fail loudly — it
 * resolves to `.notdef`, which has zero width and no ink. The preview hides
 * this completely, because a browser is free to borrow a face from the reader's
 * system when the CSS stack runs out; a PDF only contains what it embeds. So a
 * name renders perfectly on screen and is simply absent from the download.
 *
 * `hasGlyphForCodePoint` is the wrong way to check this: it says Geist cannot
 * draw "ễ", yet the shaper composes it from a base letter and two combining
 * marks and the output is fine. Only laying the text out tells the truth, so
 * that is what these tests do.
 */

const require_ = createRequire(import.meta.url);
const layoutEngine = createRequire(require_.resolve("@react-pdf/renderer"))(
  "@react-pdf/layout",
).default;

interface Glyph {
  name?: string;
}
interface Node {
  type?: string;
  lines?: { runs?: { glyphs?: Glyph[] }[] }[];
  children?: Node[];
}

/** Scripts a resume written in English is expected to contain. */
const SUPPORTED = {
  latin: "The quick brown fox jumps over the lazy dog",
  latinAccents: "José Müller-Nagy Łukasz Świątek François Şahin Ñuñez Gülşah Çelik",
  vietnamese: "Nguyễn Thị Hương kỹ sư phần mềm",
  greek: "Γεώργιος Παπαδόπουλος μηχανικός",
  cyrillic: "Александр Петров инженер",
  punctuation: "£ $ € ¥ ₹ — – “ ” ‘ ’ … • ½ © ® § ¶ † ‡",
  bullet: "•",
};

/** Scripts no embedded family covers. Tracked, not silently accepted. */
const UNSUPPORTED = {
  japanese: "山田太郎 分散システム",
  chinese: "分布式系统架构师",
  korean: "분산 시스템 아키텍트",
  arabic: "مهندس برمجيات",
  hebrew: "מהנדס תוכנה",
  devanagari: "सॉफ़्टवेयर इंजीनियर",
  thai: "วิศวกรซอฟต์แวร์",
};

function countBlanks(node: Node, acc = { total: 0, blank: 0 }) {
  for (const line of node.lines ?? []) {
    for (const run of line.runs ?? []) {
      for (const glyph of run.glyphs ?? []) {
        if (glyph.name === "space") continue;
        acc.total += 1;
        if (glyph.name === ".notdef") acc.blank += 1;
      }
    }
  }

  for (const child of node.children ?? []) countBlanks(child, acc);
  return acc;
}

async function blanksFor(fontId: FontFamilyId, text: string) {
  const element = createElement(
    Document,
    null,
    createElement(
      Page,
      { size: [595, 842], style: { padding: 20 } },
      createElement(Text, { style: { fontFamily: getPdfFontStack(fontId), fontSize: 14 } }, text),
    ),
  );

  const instance = pdf(element as never) as unknown as {
    container: { document: Node };
    toBuffer: () => Promise<unknown>;
  };

  await instance.toBuffer();
  return countBlanks(await layoutEngine(instance.container.document, Font));
}

describe("the PDF can draw every script the editor is meant to accept", () => {
  beforeAll(() => {
    registerPdfHyphenation();

    for (const font of Object.values(FONT_REGISTRY)) {
      Font.register({
        family: font.primaryFamily,
        fonts: font.pdfFonts.map((face) => ({
          src: join(process.cwd(), "public", face.src),
          fontWeight: face.fontWeight,
        })),
      });
    }
  });

  for (const fontId of FONT_IDS) {
    for (const [script, text] of Object.entries(SUPPORTED)) {
      it(`${fontId} draws ${script}`, async () => {
        const { total, blank } = await blanksFor(fontId, text);

        expect(total).toBeGreaterThan(0);
        expect(
          blank,
          `${fontId} leaves ${blank} of ${total} characters blank in "${text}". ` +
            `Its stack is [${getPdfFontStack(fontId).join(", ")}] — add a family that covers ` +
            `this script to \`pdfFallbackIds\`.`,
        ).toBe(0);
      }, 60_000);
    }
  }

  /**
   * Records the limitation instead of pretending it away.
   *
   * Supporting these needs a CJK-capable family embedded, which is several
   * megabytes; until then the editor accepts the text and the export drops it.
   * Written to fail the day coverage arrives, so it cannot outlive its cause.
   */
  for (const [script, text] of Object.entries(UNSUPPORTED)) {
    it(`no font draws ${script} — it exports blank`, async () => {
      const results = await Promise.all(FONT_IDS.map((id) => blanksFor(id, text)));

      expect(
        results.every((r) => r.blank === r.total && r.total > 0),
        `a font gained ${script} coverage: move it to SUPPORTED and drop this case`,
      ).toBe(true);
    }, 60_000);
  }
});
