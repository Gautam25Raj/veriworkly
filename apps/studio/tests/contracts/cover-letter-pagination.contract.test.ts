import { afterEach, describe, expect, it, vi } from "vitest";

import { getCoverLetterState } from "@/templates/cover-letter/shared";
import { createDefaultCoverLetter } from "@/features/cover-letter/defaults";
import { parseCoverLetterContent } from "@/features/cover-letter/schema";
import { paginateCoverLetterFlow, type FlowSplitKind } from "@/templates/cover-letter/measure";

/**
 * Just enough DOM for `paginateCoverLetterFlow`: a page box with padding, a body that
 * stacks its children, and text boxes whose words wrap `wordsPerLine` to a line.
 */
const PAGE_HEIGHT = 200;
const PADDING = 20;

let appends = 0;

class FakeText {
  parentNode: FakeElement | null = null;
  constructor(public textContent: string) {}
}

class FakeElement {
  parentNode: FakeElement | null = null;
  children: (FakeElement | FakeText)[] = [];
  style: Record<string, string> = {};

  constructor(
    public role: "page" | "body" | "wrapper" | "box",
    public lineHeight = 0,
    public wordsPerLine = 0,
  ) {}

  get firstElementChild() {
    return this.children.find((child): child is FakeElement => child instanceof FakeElement);
  }

  get textContent(): string {
    return this.children.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    this.children = [new FakeText(value)];
    this.children[0].parentNode = this;
  }

  set innerHTML(_: string) {
    this.children = [];
  }

  appendChild<T extends FakeElement | FakeText>(child: T) {
    // The old loop never ended; fail instead of hanging the worker.
    if ((appends += 1) > 10_000) throw new Error("pagination did not terminate");
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    const siblings = this.parentNode?.children ?? [];
    siblings.splice(siblings.indexOf(this), 1);
    this.parentNode = null;
  }

  cloneNode(): FakeElement {
    const clone = new FakeElement(this.role, this.lineHeight, this.wordsPerLine);
    clone.style = { ...this.style };
    for (const child of this.children) {
      clone.appendChild(
        child instanceof FakeElement ? child.cloneNode() : new FakeText(child.textContent),
      );
    }
    return clone;
  }

  querySelectorAll() {
    return [];
  }

  height(): number {
    if (this.role === "box") {
      const words = this.textContent.split(/\s+/).filter(Boolean).length;
      return Math.ceil(words / this.wordsPerLine) * this.lineHeight;
    }
    if (this.role === "page") return PAGE_HEIGHT;

    return this.children.reduce(
      (total, child) => total + (child instanceof FakeElement ? child.height() : 0),
      0,
    );
  }

  top(): number {
    if (this.role === "page") return 0;
    const parent = this.parentNode!;
    const start = parent.role === "page" ? PADDING : parent.top();
    const index = parent.children.indexOf(this);

    return parent.children
      .slice(0, index)
      .reduce((top, child) => top + (child instanceof FakeElement ? child.height() : 0), start);
  }

  getBoundingClientRect() {
    const top = this.top();
    const height = this.height();
    return { top, bottom: top + height, height };
  }
}

function stubDom() {
  vi.stubGlobal("window", {
    getComputedStyle: (element: FakeElement) =>
      element.role === "page"
        ? { paddingTop: `${PADDING}px`, paddingBottom: `${PADDING}px` }
        : {
            lineHeight: `${element.lineHeight}px`,
            marginBottom: "0px",
            borderTopWidth: "0px",
            paddingTop: "0px",
          },
  });
  vi.stubGlobal("NodeFilter", { SHOW_TEXT: 4 });
  vi.stubGlobal("document", {
    createTreeWalker: (root: FakeElement) => {
      const nodes = root.children.filter((child) => child instanceof FakeText);
      return { nextNode: () => nodes.shift() ?? null };
    },
    createRange: () => {
      let start = 0;
      let node: FakeText;
      return {
        setStart: (target: FakeText, offset: number) => {
          node = target;
          start = offset;
        },
        setEnd: () => {},
        getClientRects: () => {
          const box = node.parentNode!;
          const word = node.textContent.slice(0, start).split(/\s+/).filter(Boolean).length;
          const top = box.top() + Math.floor(word / box.wordsPerLine) * box.lineHeight;
          return [{ top, height: box.lineHeight }];
        },
      };
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  appends = 0;
});

function paragraph(words: number, lineHeight: number, wordsPerLine: number) {
  const wrapper = new FakeElement("wrapper");
  const box = new FakeElement("box", lineHeight, wordsPerLine);
  box.textContent = Array.from({ length: words }, (_, index) => `w${index}`).join(" ");
  wrapper.appendChild(box);
  return wrapper;
}

function paginate(nodes: FakeElement[]) {
  const page = new FakeElement("page");
  const items = nodes.map((node, index) => ({ id: `item-${index}`, node }));

  return paginateCoverLetterFlow(items, {
    measureRoot: page as unknown as HTMLElement,
    contentRoot: page as unknown as HTMLElement,
    getPrefix: () => null,
    getItemNode: (item) => item.node as unknown as HTMLElement,
    getSplitKind: (): FlowSplitKind => "text",
    createBody: () => new FakeElement("body") as unknown as HTMLElement,
  });
}

describe("cover-letter pagination always terminates", () => {
  it("keeps a paragraph that cannot start any page instead of re-queuing it forever", () => {
    stubDom();

    // Three 70px lines on a page with 160px of room: two fit, which react-pdf's
    // orphan/widow rule refuses for a three-line paragraph, on every page.
    const pages = paginate([paragraph(9, 70, 3)]);
    const printed = pages.flat().filter((fragment) => fragment.range?.[0] !== fragment.range?.[1]);

    expect(printed).toHaveLength(1);
    expect(pages.length).toBeLessThanOrEqual(2);
  });

  it("still splits an ordinary long paragraph across pages", () => {
    stubDom();

    const pages = paginate([paragraph(60, 20, 5)]);

    expect(pages.length).toBe(2);
    expect(pages.flat().map((fragment) => fragment.range)).toEqual([
      [0, 40],
      [40, 60],
    ]);
  });
});

describe("appearance numbers stay inside the editor's ranges", () => {
  const extreme = { lineHeight: 40, pageMargin: 5000, paragraphSpacing: -3 };

  it("clamps them in the render state and on import", () => {
    const base = createDefaultCoverLetter("clamp").content;
    const { appearance } = getCoverLetterState({
      ...base,
      appearance: { ...base.appearance, ...extreme },
    });

    expect(appearance).toMatchObject({ lineHeight: 1.8, pageMargin: 72, paragraphSpacing: 4 });
    expect(parseCoverLetterContent({ appearance: extreme }).appearance).toMatchObject({
      lineHeight: 1.8,
      pageMargin: 72,
      paragraphSpacing: 4,
    });
  });
});
