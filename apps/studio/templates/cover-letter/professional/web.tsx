/* eslint-disable @next/next/no-img-element */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { CSSProperties } from "react";
import type { CoverLetterContent } from "@/features/cover-letter/types";
import type { ResumeLinkDisplayMode, ResumeLinkItem } from "@/types/resume";
import type { CoverLetterTokens } from "../tokens";

import {
  buildCoverLetterFlowContent,
  buildProfessionalFlowItems,
  getCoverLetterState,
  getFlowPageKey,
  getProfessionalFlowItemWeight,
  getCoverLetterFlowSenderName,
  isCoverLetterSectionVisible,
  paginateMeasuredItems,
  paginateWeightedItems,
  type CoverLetterPalette,
  type ProfessionalFlowItem,
} from "../shared";

import {
  normalizeLinkHref,
  getLinkDisplayText,
} from "@/features/documents/rendering/resume-rendering";
import { FONT_FAMILY_MAP, getFontStylesheetHref } from "@/features/documents/constants/fonts";
import { escapeHtml } from "@/features/resume/services/resume-formatters";
import { webFixedWidth, webFlexible } from "@/templates/shared/box";
import { webText } from "@/templates/shared/text-tokens";
import { BULLET_MARKER } from "@/templates/resume/shared/typography";
import { COVER_LETTER_SCALE as S } from "../tokens";

import { SOCIAL_ICON_SRC_BY_TYPE } from "@/templates/shared/social-icons";

const PAGE_HEIGHT = S.pageHeight;

const px = (value: number) => `${value}px`;

/**
 * Geometry comes from `../tokens`; `./pdf.tsx` reads the same constants, so a
 * spacing change moves the preview and the export together.
 */
function renderFlowItem(
  item: ProfessionalFlowItem,
  palette: CoverLetterPalette,
  tokens: CoverLetterTokens,
  paragraphSpacing: number,
) {
  const spacing = { marginBottom: px(paragraphSpacing) };

  if (item.type === "greeting")
    return <p style={{ ...webText(tokens.strong), ...spacing }}>{item.text}</p>;

  if (item.type === "paragraph" || item.type === "closing")
    return <p style={{ ...webText(tokens.body), ...spacing }}>{item.text}</p>;

  if (item.type === "body-list" || item.type === "proof-list")
    return (
      <div
        style={{
          backgroundColor: palette.surface,
          padding: `${px(S.listPadY)} ${px(S.listPadX)}`,
          ...spacing,
        }}
      >
        {item.items.map((listItem, index) => (
          <div
            key={listItem}
            style={{
              columnGap: px(S.bulletGap),
              display: "flex",
              marginTop: index === 0 ? 0 : px(S.bulletRowGap),
            }}
          >
            <span
              aria-hidden="true"
              style={{
                ...webText(tokens.body),
                ...webFixedWidth(S.bulletIndent - S.bulletGap),
                textAlign: "right",
              }}
            >
              {BULLET_MARKER}
            </span>

            <span style={{ ...webText(tokens.body), ...webFlexible }}>{listItem}</span>
          </div>
        ))}
      </div>
    );

  if (item.type === "signature") return <p style={webText(tokens.strong)}>{item.text}</p>;

  return (
    <p
      style={{
        ...webText(tokens.postscript),
        borderTop: `${S.hairline}px solid ${palette.border}`,
        marginTop: px(S.postscriptTop),
        paddingTop: px(S.postscriptPadTop),
      }}
    >
      P.S. {item.text}
    </p>
  );
}

function renderGroupedFlowItems(
  items: ProfessionalFlowItem[],
  palette: CoverLetterPalette,
  tokens: CoverLetterTokens,
  paragraphSpacing: number,
) {
  return items.map((item) => (
    <div key={item.id}>{renderFlowItem(item, palette, tokens, paragraphSpacing)}</div>
  ));
}

// ---------------------------------------------------------------------------
// Page furniture, shared by the measurement probe and the rendered pages so the
// two can never drift apart.
// ---------------------------------------------------------------------------

function LetterHead({
  contact,
  linkDisplayMode,
  palette,
  renderedLinks,
  senderName,
  senderTitle,
  tokens,
}: {
  contact: string[];
  linkDisplayMode: ResumeLinkDisplayMode;
  palette: CoverLetterPalette;
  renderedLinks: ResumeLinkItem[];
  senderName: string;
  senderTitle: string;
  tokens: CoverLetterTokens;
}) {
  return (
    <header
      style={{
        borderBottom: `${S.headerRule}px solid ${palette.strong}`,
        display: "flex",
        paddingBottom: px(S.headerPadBottom),
      }}
    >
      <div style={webFlexible}>
        <h1 style={webText(tokens.senderName)}>{senderName}</h1>
        <p style={{ ...webText(tokens.senderTitle), marginTop: px(S.subjectLabelGap) }}>
          {senderTitle}
        </p>
      </div>

      {contact.length > 0 || renderedLinks.length > 0 ? (
        <div
          style={{
            alignItems: "flex-end",
            display: "flex",
            flexDirection: "column",
            ...webFixedWidth(S.headerContactWidth),
            marginLeft: px(S.headerColumnGap),
            rowGap: px(S.headerRowGap),
          }}
        >
          {contact.map((item) => (
            <p key={item} style={webText(tokens.contact)}>
              {item}
            </p>
          ))}

          {renderedLinks.map((link) => (
            <a
              key={link.id}
              href={normalizeLinkHref(link.url)}
              style={{
                ...webText(tokens.contact),
                alignItems: "center",
                color: palette.strong,
                columnGap: "4px",
                display: "flex",
                textDecoration: "none",
              }}
            >
              {linkDisplayMode !== "url" && (
                <img
                  alt=""
                  aria-hidden="true"
                  src={SOCIAL_ICON_SRC_BY_TYPE[link.type] || SOCIAL_ICON_SRC_BY_TYPE.custom}
                  style={{
                    display: "block",
                    ...webFixedWidth(S.contact),
                    height: px(S.contact),
                  }}
                />
              )}

              {linkDisplayMode !== "icon" && (
                <span>{getLinkDisplayText(link, linkDisplayMode)}</span>
              )}
            </a>
          ))}
        </div>
      ) : null}
    </header>
  );
}

function RecipientMeta({
  date,
  recipient,
  tokens,
}: {
  date: string;
  recipient: string[];
  tokens: CoverLetterTokens;
}) {
  return (
    <section style={{ display: "flex", marginTop: px(S.metaTop) }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          flexShrink: 1,
          minWidth: 0,
          rowGap: px(S.metaRowGap),
        }}
      >
        {recipient.map((line) => (
          <p key={line} style={webText(tokens.contact)}>
            {line}
          </p>
        ))}
      </div>

      {date ? (
        <p
          style={{
            ...webText(tokens.metaDate),
            ...webFixedWidth(S.metaDateWidth),
            marginLeft: px(S.metaColumnGap),
            textAlign: "right",
          }}
        >
          {date}
        </p>
      ) : null}
    </section>
  );
}

function SubjectBlock({
  palette,
  subject,
  tokens,
}: {
  palette: CoverLetterPalette;
  subject: string;
  tokens: CoverLetterTokens;
}) {
  return (
    <section
      style={{
        borderBottom: `${S.hairline}px solid ${palette.border}`,
        borderTop: `${S.hairline}px solid ${palette.border}`,
        marginTop: px(S.subjectTop),
        paddingBottom: px(S.subjectPadY),
        paddingTop: px(S.subjectPadY),
      }}
    >
      <p style={webText(tokens.label)}>Re</p>
      <h2 style={{ ...webText(tokens.subject), marginTop: px(S.subjectLabelGap) }}>{subject}</h2>
    </section>
  );
}

/*
 * There is deliberately no "Cover Letter Continued" banner on later pages.
 *
 * The export cannot reproduce one: react-pdf repeats a `fixed` node at the same
 * y on every page without reserving flow space for it, so the running text
 * would print underneath it. Keeping the banner in the preview alone meant the
 * second page of a letter looked different once downloaded, and the preview
 * also had to reserve height for a thing the PDF never drew — which moved the
 * page break. A recipient reading a numbered attachment does not need telling
 * that a letter continues.
 */

function fitsInsideBottomPadding(container: HTMLElement, content: HTMLElement) {
  const containerStyle = window.getComputedStyle(container);
  const paddingBottom = Number.parseFloat(containerStyle.paddingBottom) || 0;
  const containerBottom = container.getBoundingClientRect().bottom - paddingBottom;
  const contentBottom = content.getBoundingClientRect().bottom;

  return contentBottom <= containerBottom + 1;
}

function paginateProfessionalHtmlItems(items: ProfessionalFlowItem[]) {
  return paginateWeightedItems(items, getProfessionalFlowItemWeight, (pageIndex) =>
    pageIndex === 0 ? 17 : 26,
  );
}

function renderProfessionalHtmlItem(item: ProfessionalFlowItem) {
  if (item.type === "greeting") return `<p class="greeting">${escapeHtml(item.text)}</p>`;
  if (item.type === "paragraph") return `<p>${escapeHtml(item.text)}</p>`;
  if (item.type === "body-list" || item.type === "proof-list") {
    return `<div class="list">${item.items
      .map(
        (listItem) =>
          `<div class="bullet"><span class="marker">${BULLET_MARKER}</span><span>${escapeHtml(listItem)}</span></div>`,
      )
      .join("")}</div>`;
  }
  if (item.type === "closing") return `<p>${escapeHtml(item.text)}</p>`;
  if (item.type === "signature") return `<p class="signature">${escapeHtml(item.text)}</p>`;

  return `<p class="postscript">P.S. ${escapeHtml(item.text)}</p>`;
}

export function ProfessionalCoverLetterPreview({ content }: { content: CoverLetterContent }) {
  const state = getCoverLetterState(content, { firstPage: 18, nextPage: 27 });
  const {
    appearance,
    palette,
    tokens,
    senderName,
    senderTitle,
    contact,
    linkDisplayMode,
    renderedLinks,
    recipient,
  } = state;
  const fontFamily = FONT_FAMILY_MAP[appearance.fontFamily];
  const flowSenderName = getCoverLetterFlowSenderName(content);
  const showTarget = isCoverLetterSectionVisible(content, "target");
  const subject = content.subject || content.jobTitle;
  const flowContent = useMemo(() => buildCoverLetterFlowContent(content), [content]);
  const flowItems = useMemo(
    () => buildProfessionalFlowItems(flowContent, flowSenderName),
    [flowContent, flowSenderName],
  );
  const [pages, setPages] = useState<ProfessionalFlowItem[][]>(() => [flowItems]);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const firstPrefixRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const [fontsReady, setFontsReady] = useState(() => typeof document === "undefined");

  // Measuring before the document font has loaded fills the probe with
  // fallback metrics, producing page breaks the PDF export will not reproduce.
  useEffect(() => {
    if (fontsReady) return;

    let cancelled = false;

    document.fonts.ready.then(() => {
      if (!cancelled) setFontsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [fontsReady]);

  const pageStyle: CSSProperties = {
    backgroundColor: appearance.pageColor,
    color: palette.text,
    fontFamily,
    padding: px(appearance.pageMargin),
  };

  // The page box matches the PDF page exactly; see COVER_LETTER_SCALE.
  const pageBox: CSSProperties = { height: px(S.pageHeight), width: px(S.pageWidth) };

  const bodyStyle: CSSProperties = { marginTop: px(S.bodyTop) };

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const probe = document.createElement("article");

      probe.className = "mx-auto max-w-full overflow-hidden";
      probe.style.height = px(S.pageHeight);
      probe.style.width = px(S.pageWidth);
      Object.assign(probe.style, {
        backgroundColor: appearance.pageColor,
        color: palette.text,
        fontFamily,
        padding: px(appearance.pageMargin),
      });
      measureRef.current?.appendChild(probe);

      const fitsPage = (items: ProfessionalFlowItem[], pageIndex: number) => {
        probe.innerHTML = "";

        // Only the first page carries the letterhead; later pages are body only.
        const prefix = pageIndex === 0 ? firstPrefixRef.current : null;
        if (prefix) probe.appendChild(prefix.cloneNode(true));

        const main = document.createElement("main");
        main.style.marginTop = px(S.bodyTop);

        items.forEach((item) => {
          const node = itemRefs.current.get(item.id);
          if (node) main.appendChild(node.cloneNode(true));
        });

        probe.appendChild(main);

        return probe.scrollHeight <= PAGE_HEIGHT + 1 && fitsInsideBottomPadding(probe, main);
      };

      const nextPages = paginateMeasuredItems(flowItems, fitsPage);
      probe.remove();
      const nextKey = getFlowPageKey(nextPages);

      setPages((current) => {
        const currentKey = getFlowPageKey(current);
        return currentKey === nextKey ? current : nextPages;
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    appearance.pageColor,
    appearance.pageMargin,
    flowItems,
    fontFamily,
    fontsReady,
    palette.text,
  ]);

  const head = (
    <LetterHead
      contact={contact}
      linkDisplayMode={linkDisplayMode}
      palette={palette}
      renderedLinks={renderedLinks}
      senderName={senderName}
      senderTitle={senderTitle}
      tokens={tokens}
    />
  );

  return (
    <div className="grid gap-6">
      <div
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none absolute opacity-0"
        style={{ left: -10000, top: 0, width: 794 }}
      >
        <article className="overflow-hidden" style={{ ...pageStyle, ...pageBox }}>
          <div ref={firstPrefixRef}>
            {head}
            <RecipientMeta date={content.date} recipient={recipient} tokens={tokens} />
            {showTarget && subject ? (
              <SubjectBlock palette={palette} subject={subject} tokens={tokens} />
            ) : null}
          </div>

          <main style={bodyStyle}>
            {flowItems.map((item) => (
              <div
                key={item.id}
                ref={(node) => {
                  if (node) itemRefs.current.set(item.id, node);
                  else itemRefs.current.delete(item.id);
                }}
              >
                {renderFlowItem(item, palette, tokens, appearance.paragraphSpacing)}
              </div>
            ))}
          </main>
        </article>
      </div>

      {pages.map((pageBlocks, pageIndex) => (
        <article
          key={pageIndex}
          className="mx-auto max-w-full overflow-hidden shadow-sm ring-1 ring-zinc-200"
          style={{ ...pageStyle, ...pageBox }}
        >
          {pageIndex === 0 ? (
            <>
              {head}
              <RecipientMeta date={content.date} recipient={recipient} tokens={tokens} />
              {showTarget && subject ? (
                <SubjectBlock palette={palette} subject={subject} tokens={tokens} />
              ) : null}
            </>
          ) : null}

          <main style={bodyStyle}>
            {renderGroupedFlowItems(pageBlocks, palette, tokens, appearance.paragraphSpacing)}
          </main>
        </article>
      ))}
    </div>
  );
}

export function buildProfessionalCoverLetterHtml(content: CoverLetterContent): string {
  const state = getCoverLetterState(content, { firstPage: 18, nextPage: 27 });

  const {
    appearance,
    palette,
    tokens,
    senderName,
    senderTitle,
    contact,
    linkDisplayMode,
    renderedLinks,
    recipient,
  } = state;
  const showTarget = isCoverLetterSectionVisible(content, "target");
  const subject = escapeHtml(
    showTarget ? content.subject || content.jobTitle || "Application" : "",
  );
  const fontFamily = FONT_FAMILY_MAP[appearance.fontFamily];
  const fontHref = getFontStylesheetHref(appearance.fontFamily);
  const flowItems = buildProfessionalFlowItems(buildCoverLetterFlowContent(content), senderName);
  const pages = paginateProfessionalHtmlItems(flowItems);

  const t = tokens;
  const font = (token: (typeof t)["body"]) =>
    `font-size:${token.fontSize}px;line-height:${token.lineHeight}px;font-weight:${token.fontWeight};color:${token.color};`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(content.senderName || "Cover Letter")}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${escapeHtml(fontHref)}"><style>
*{box-sizing:border-box}body{margin:0;padding:32px 16px;background:${palette.surface};color:${palette.text};font-family:${fontFamily}}.page{width:794px;height:1123px;margin:0 auto 24px;overflow:hidden;background:${appearance.pageColor};box-shadow:0 0 0 1px ${palette.border};page-break-after:always;padding:${appearance.pageMargin}px}.page:last-child{page-break-after:auto}p,h1,h2{margin:0}header{display:flex;border-bottom:${S.headerRule}px solid ${palette.strong};padding-bottom:${S.headerPadBottom}px}header .identity{flex:1 1 auto;min-width:0}header h1{${font(t.senderName)}}header .identity p{${font(t.senderTitle)}margin-top:${S.subjectLabelGap}px}.contact{display:flex;flex-direction:column;align-items:flex-end;flex:0 0 ${S.headerContactWidth}px;width:${S.headerContactWidth}px;margin-left:${S.headerColumnGap}px;row-gap:${S.headerRowGap}px}.contact p{${font(t.contact)}}.contact a{${font({ ...t.contact, color: palette.strong })}text-decoration:none}.meta{display:flex;margin-top:${S.metaTop}px}.meta .to{display:flex;flex-direction:column;flex:1 1 auto;min-width:0;row-gap:${S.metaRowGap}px}.meta .to p{${font(t.contact)}}.meta .date{${font(t.metaDate)}flex:0 0 ${S.metaDateWidth}px;width:${S.metaDateWidth}px;margin-left:${S.metaColumnGap}px;text-align:right}.subject{border-top:${S.hairline}px solid ${palette.border};border-bottom:${S.hairline}px solid ${palette.border};margin-top:${S.subjectTop}px;padding:${S.subjectPadY}px 0}.label{${font(t.label)}letter-spacing:${t.label.letterSpacing}px;text-transform:uppercase}.subject h2{${font(t.subject)}margin-top:${S.subjectLabelGap}px}.body{margin-top:${S.bodyTop}px}.body p{${font(t.body)}margin-bottom:${appearance.paragraphSpacing}px}.greeting,.signature{${font(t.strong)}}.list{background:${palette.surface};padding:${S.listPadY}px ${S.listPadX}px;margin-bottom:${appearance.paragraphSpacing}px}.bullet{display:flex;column-gap:${S.bulletGap}px}.bullet+.bullet{margin-top:${S.bulletRowGap}px}.bullet .marker{flex:0 0 ${S.bulletIndent - S.bulletGap}px;width:${S.bulletIndent - S.bulletGap}px;text-align:right}.bullet span{${font(t.body)}}.postscript{${font(t.postscript)}border-top:${S.hairline}px solid ${palette.border};margin-top:${S.postscriptTop}px;padding-top:${S.postscriptPadTop}px}.continued{${font(t.continued)}letter-spacing:${t.continued.letterSpacing}px;text-transform:uppercase;border-bottom:${S.hairline}px solid ${palette.border};padding-bottom:${S.continuedPadBottom}px}@media print{body{padding:0;background:white}.page{box-shadow:none;margin:0}}</style></head><body>${pages
    .map((blocks, pageIndex) => {
      const first = pageIndex === 0;
      const body = blocks.map((item) => renderProfessionalHtmlItem(item)).join("");
      return `<article class="page">${
        first
          ? `<header><div class="identity"><h1>${escapeHtml(senderName)}</h1><p>${escapeHtml(senderTitle)}</p></div><div class="contact">${contact
              .map((item) => `<p>${escapeHtml(item)}</p>`)
              .join("")}${renderedLinks
              .map(
                (link) =>
                  `<a href="${escapeHtml(normalizeLinkHref(link.url))}">${escapeHtml(getLinkDisplayText(link, linkDisplayMode))}</a>`,
              )
              .join("")}</div></header><section class="meta"><div class="to">${recipient
              .map((line) => `<p>${escapeHtml(line)}</p>`)
              .join("")}</div><p class="date">${escapeHtml(content.date)}</p></section>${
              showTarget
                ? `<section class="subject"><p class="label">Re</p><h2>${subject}</h2></section>`
                : ""
            }`
          : ""
      }<main class="body">${body}</main></article>`;
    })
    .join("")}</body></html>`;
}
