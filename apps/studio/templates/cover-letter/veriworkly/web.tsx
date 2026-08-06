/* eslint-disable @next/next/no-img-element */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { CSSProperties } from "react";
import type { CoverLetterContent } from "@/features/cover-letter/types";
import type { CoverLetterTokens } from "../tokens";

import {
  buildCoverLetterFlowContent,
  buildVeriworklyFlowItems,
  getCoverLetterFlowSenderName,
  getCoverLetterState,
  getFlowPageKey,
  getVeriworklyFlowItemWeight,
  isCoverLetterSectionVisible,
  keepVeriworklyProofHeadingWithNext,
  paginateMeasuredItems,
  paginateWeightedItems,
  type CoverLetterPalette,
  type VeriworklyFlowItem,
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

function renderFlowItem(
  item: VeriworklyFlowItem,
  palette: CoverLetterPalette,
  tokens: CoverLetterTokens,
  paragraphSpacing: number,
) {
  const spacing = { marginBottom: px(paragraphSpacing) };

  if (item.type === "greeting")
    return <p style={{ ...webText(tokens.strong), ...spacing }}>{item.text}</p>;

  if (item.type === "paragraph")
    return <p style={{ ...webText(tokens.body), ...spacing }}>{item.text}</p>;

  if (item.type === "body-list")
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

  if (item.type === "proof-heading")
    return (
      <p
        style={{
          ...webText(tokens.continued),
          borderTop: `${S.hairline}px solid ${palette.border}`,
          marginTop: px(S.subjectTop),
          paddingTop: px(S.railTargetTop),
        }}
      >
        Selected Proof
      </p>
    );

  if (item.type === "proof-item")
    return (
      <div
        style={{
          borderBottom: item.isLast ? "none" : `${S.hairline}px solid ${palette.border}`,
          columnGap: "12px",
          display: "flex",
          marginTop: px(S.proofRowGap),
          paddingBottom: px(S.proofPadBottom),
        }}
      >
        <span
          style={{
            ...webText(tokens.proofIndex),
            ...webFixedWidth(S.proofIndexWidth),
          }}
        >
          {String(item.index + 1).padStart(2, "0")}
        </span>

        <span style={{ ...webText(tokens.proofText), ...webFlexible }}>{item.text}</span>
      </div>
    );

  if (item.type === "signoff")
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: px(S.subjectTop),
          rowGap: "8px",
        }}
      >
        {item.closing ? <p style={webText(tokens.body)}>{item.closing}</p> : null}
        <p style={{ ...webText(tokens.strong), fontSize: "16px", lineHeight: "19.2px" }}>
          {item.signature}
        </p>
      </div>
    );

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
  items: VeriworklyFlowItem[],
  palette: CoverLetterPalette,
  tokens: CoverLetterTokens,
  paragraphSpacing: number,
) {
  return items.map((item) => (
    <div key={item.id}>{renderFlowItem(item, palette, tokens, paragraphSpacing)}</div>
  ));
}

function RecipientMeta({
  date,
  palette,
  recipient,
  tokens,
}: {
  date: string;
  palette: CoverLetterPalette;
  recipient: string[];
  tokens: CoverLetterTokens;
}) {
  return (
    <div
      style={{
        borderBottom: `${S.hairline}px solid ${palette.border}`,
        columnGap: px(S.metaColumnGap),
        display: "flex",
        justifyContent: "space-between",
        paddingBottom: px(S.headerPadBottom),
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          ...webFlexible,
          rowGap: px(S.metaRowGap),
        }}
      >
        {recipient.map((line) => (
          <p key={line} style={webText(tokens.contact)}>
            {line}
          </p>
        ))}
      </div>

      {/*
        A fixed date column, not a content-sized one.

        react-pdf reads `flexShrink: 0` as `value || 1`, so a date column that
        must not shrink there cannot say so — it gets squeezed and the date
        wraps in the export while the preview keeps it on one line. Pinning the
        width states the same split to both engines, and the text is
        right-aligned so a short date looks identical either way.
      */}
      {date ? (
        <p
          style={{
            ...webText(tokens.metaDate),
            ...webFixedWidth(S.metaDateWidth),
            textAlign: "right",
          }}
        >
          {date}
        </p>
      ) : null}
    </div>
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
        borderLeft: `${S.subjectBarWidth}px solid ${palette.accent}`,
        marginTop: px(S.subjectTop),
        paddingLeft: px(S.subjectPadLeft),
      }}
    >
      <p style={webText(tokens.railLabel)}>Cover Letter</p>
      <h2 style={{ ...webText(tokens.railSubject), marginTop: px(S.subjectLabelGap) }}>
        {subject}
      </h2>
    </section>
  );
}

function fitsInsideBottomPadding(container: HTMLElement, content: HTMLElement) {
  const containerStyle = window.getComputedStyle(container);
  const paddingBottom = Number.parseFloat(containerStyle.paddingBottom) || 0;
  const containerBottom = container.getBoundingClientRect().bottom - paddingBottom;
  const contentBottom = content.getBoundingClientRect().bottom;

  return contentBottom <= containerBottom + 1;
}

function paginateVeriworklyHtmlItems(items: VeriworklyFlowItem[]) {
  return paginateWeightedItems(
    items,
    getVeriworklyFlowItemWeight,
    () => 24,
    keepVeriworklyProofHeadingWithNext,
  );
}

function renderVeriworklyHtmlItem(item: VeriworklyFlowItem) {
  if (item.type === "greeting") return `<p class="greeting">${escapeHtml(item.text)}</p>`;
  if (item.type === "paragraph") return `<p>${escapeHtml(item.text)}</p>`;
  if (item.type === "body-list") {
    return `<div class="list">${item.items
      .map(
        (listItem) =>
          `<div class="bullet"><span class="marker">${BULLET_MARKER}</span><span>${escapeHtml(listItem)}</span></div>`,
      )
      .join("")}</div>`;
  }
  if (item.type === "proof-heading") return `<p class="proof-label">Selected Proof</p>`;
  if (item.type === "proof-item") {
    return `<div class="proof-item${item.isLast ? " last" : ""}"><span class="proof-index">${String(
      item.index + 1,
    ).padStart(2, "0")}</span><span class="proof-text">${escapeHtml(item.text)}</span></div>`;
  }
  if (item.type === "signoff") {
    return `<div class="signoff">${item.closing ? `<p>${escapeHtml(item.closing)}</p>` : ""}<p class="signature">${escapeHtml(item.signature)}</p></div>`;
  }

  return `<p class="postscript">P.S. ${escapeHtml(item.text)}</p>`;
}

export function VeriworklyCoverLetterPreview({ content }: { content: CoverLetterContent }) {
  const state = getCoverLetterState(content, { firstPage: 15, nextPage: 23 });

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
  const subject = content.subject || content.jobTitle || "Application";
  const flowContent = useMemo(() => buildCoverLetterFlowContent(content), [content]);
  const flowItems = useMemo(
    () => buildVeriworklyFlowItems(flowContent, flowSenderName),
    [flowContent, flowSenderName],
  );
  const [pages, setPages] = useState<VeriworklyFlowItem[][]>(() => [flowItems]);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const firstPrefixRef = useRef<HTMLDivElement | null>(null);
  const nextPrefixRef = useRef<HTMLDivElement | null>(null);
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

  const shellStyle: CSSProperties = {
    backgroundColor: appearance.pageColor,
    color: palette.text,
    display: "flex",
    fontFamily,
  };

  // The page box matches the PDF page exactly; see COVER_LETTER_SCALE.
  const pageBox: CSSProperties = { height: px(S.pageHeight), width: px(S.pageWidth) };

  const mainStyle: CSSProperties = {
    backgroundColor: appearance.pageColor,
    ...webFlexible,
    padding: px(appearance.pageMargin),
  };

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const probe = document.createElement("article");

      probe.className = "mx-auto max-w-full overflow-hidden";
      probe.style.height = px(S.pageHeight);
      probe.style.width = px(S.pageWidth);
      Object.assign(probe.style, { display: "flex", fontFamily });

      const aside = document.createElement("aside");
      aside.style.width = px(S.railWidth);
      aside.style.flexShrink = "0";
      probe.appendChild(aside);

      const main = document.createElement("main");
      Object.assign(main.style, {
        backgroundColor: appearance.pageColor,
        color: palette.text,
        flexGrow: "1",
        minWidth: "0",
        padding: px(appearance.pageMargin),
      });
      probe.appendChild(main);
      measureRef.current?.appendChild(probe);

      const fitsPage = (items: VeriworklyFlowItem[], pageIndex: number) => {
        main.innerHTML = "";

        const prefix = pageIndex === 0 ? firstPrefixRef.current : nextPrefixRef.current;
        if (prefix) main.appendChild(prefix.cloneNode(true));

        const body = document.createElement("section");
        body.style.marginTop = px(S.subjectTop);

        items.forEach((item) => {
          const node = itemRefs.current.get(item.id);
          if (node) body.appendChild(node.cloneNode(true));
        });

        main.appendChild(body);

        return main.scrollHeight <= PAGE_HEIGHT + 1 && fitsInsideBottomPadding(main, body);
      };

      const nextPages = paginateMeasuredItems(
        flowItems,
        fitsPage,
        keepVeriworklyProofHeadingWithNext,
      );
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

  function renderSidebar() {
    return (
      <aside
        style={{
          backgroundColor: appearance.sidebarColor,
          borderRight: `${S.hairline}px solid ${palette.sidebarBorder}`,
          display: "flex",
          flexDirection: "column",
          ...webFixedWidth(S.railWidth),
          height: px(S.pageHeight),
          padding: `${px(S.railPadY)} ${px(S.railPadX)}`,
        }}
      >
        <p style={webText(tokens.railLabel)}>Candidate</p>
        <h1 style={{ ...webText(tokens.railName), marginTop: "16px" }}>{senderName}</h1>
        <p style={{ ...webText(tokens.railTitle), marginTop: "8px" }}>{senderTitle}</p>

        <div
          style={{
            backgroundColor: palette.accent,
            height: px(S.hairline),
            marginBottom: px(S.railBlockTop),
            marginTop: px(S.railBlockTop),
            width: px(S.railRuleWidth),
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: px(S.railBlockTop),
            rowGap: "8px",
          }}
        >
          {contact.map((item) => (
            <p key={item} style={webText(tokens.railText)}>
              {item}
            </p>
          ))}

          {renderedLinks.length > 0 && (
            <div
              style={{
                backgroundColor: palette.accent,
                height: px(S.hairline),
                marginBottom: "16px",
                marginTop: "16px",
                width: px(S.railRuleWidth),
              }}
            />
          )}

          {renderedLinks.map((link) => (
            <a
              key={link.id}
              href={normalizeLinkHref(link.url)}
              style={{
                ...webText(tokens.railText),
                alignItems: "center",
                color: palette.accent,
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
                  style={{ ...webFixedWidth(14), display: "block", height: "14px" }}
                />
              )}
              {linkDisplayMode !== "icon" && (
                <span>{getLinkDisplayText(link, linkDisplayMode)}</span>
              )}
            </a>
          ))}
        </div>

        {showTarget ? (
          <div
            style={{
              borderTop: `${S.hairline}px solid ${palette.sidebarBorder}`,
              display: "flex",
              flexDirection: "column",
              marginTop: "auto",
              paddingTop: px(S.railTargetTop),
              rowGap: "8px",
            }}
          >
            <p style={webText(tokens.railLabel)}>Target</p>
            <p
              style={{
                ...webText(tokens.railText),
                color: palette.sidebarText,
                fontWeight: 700,
              }}
            >
              {content.jobTitle || content.subject || "Open role"}
            </p>
            {content.companyName ? (
              <p style={webText(tokens.railText)}>{content.companyName}</p>
            ) : null}
          </div>
        ) : null}
      </aside>
    );
  }

  return (
    <div className="grid gap-6">
      <div
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none absolute opacity-0"
        style={{ left: -10000, top: 0, width: 794 }}
      >
        <article className="overflow-hidden" style={{ ...shellStyle, ...pageBox }}>
          {renderSidebar()}

          <main style={mainStyle}>
            <div ref={firstPrefixRef}>
              <RecipientMeta
                date={content.date}
                palette={palette}
                recipient={recipient}
                tokens={tokens}
              />
              {showTarget ? (
                <SubjectBlock palette={palette} subject={subject} tokens={tokens} />
              ) : null}
            </div>

            <div ref={nextPrefixRef} />

            <section style={{ marginTop: px(S.subjectTop) }}>
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
            </section>
          </main>
        </article>
      </div>

      {pages.map((pageBlocks, pageIndex) => (
        <article
          key={pageIndex}
          className="mx-auto max-w-full overflow-hidden shadow-sm ring-1 ring-zinc-200"
          style={{ ...shellStyle, ...pageBox }}
        >
          {renderSidebar()}

          <main style={mainStyle}>
            {pageIndex === 0 ? (
              <>
                <RecipientMeta
                  date={content.date}
                  palette={palette}
                  recipient={recipient}
                  tokens={tokens}
                />
                {showTarget ? (
                  <SubjectBlock palette={palette} subject={subject} tokens={tokens} />
                ) : null}
              </>
            ) : null}

            <section style={{ marginTop: px(S.subjectTop) }}>
              {renderGroupedFlowItems(pageBlocks, palette, tokens, appearance.paragraphSpacing)}
            </section>
          </main>
        </article>
      ))}
    </div>
  );
}

export function buildVeriworklyCoverLetterHtml(content: CoverLetterContent): string {
  const state = getCoverLetterState(content, { firstPage: 15, nextPage: 23 });
  const {
    appearance,
    palette,
    tokens: t,
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
  const flowItems = buildVeriworklyFlowItems(buildCoverLetterFlowContent(content), senderName);
  const pages = paginateVeriworklyHtmlItems(flowItems);

  const font = (token: (typeof t)["body"]) =>
    `font-size:${token.fontSize}px;line-height:${token.lineHeight}px;font-weight:${token.fontWeight};color:${token.color};`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(content.senderName || "Cover Letter")}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${escapeHtml(fontHref)}"><style>
*{box-sizing:border-box}body{margin:0;padding:32px 16px;background:${palette.surface};color:${palette.text};font-family:${fontFamily}}p,h1,h2{margin:0}.page{width:794px;height:1123px;margin:0 auto 24px;overflow:hidden;background:${appearance.pageColor};box-shadow:0 0 0 1px ${palette.border};page-break-after:always;display:flex}.page:last-child{page-break-after:auto}aside{background:${appearance.sidebarColor};border-right:${S.hairline}px solid ${palette.sidebarBorder};padding:${S.railPadY}px ${S.railPadX}px;display:flex;flex-direction:column;flex:0 0 ${S.railWidth}px;width:${S.railWidth}px}aside h1{${font(t.railName)}margin-top:16px}aside .rail-title{${font(t.railTitle)}margin-top:8px}.rule{background:${palette.accent};height:${S.hairline}px;width:${S.railRuleWidth}px;margin:${S.railBlockTop}px 0}.rail{display:flex;flex-direction:column;margin-top:${S.railBlockTop}px;row-gap:8px}.rail p{${font(t.railText)}}.rail a{${font({ ...t.railText, color: palette.accent })}text-decoration:none;display:block}.target{border-top:${S.hairline}px solid ${palette.sidebarBorder};margin-top:auto;padding-top:${S.railTargetTop}px;display:flex;flex-direction:column;row-gap:8px}.target .title{${font({ ...t.railText, color: palette.sidebarText, fontWeight: 700 })}}main{flex:1 1 auto;min-width:0;background:${appearance.pageColor};padding:${appearance.pageMargin}px}.label{${font(t.railLabel)}letter-spacing:${t.railLabel.letterSpacing}px;text-transform:uppercase}.meta{display:flex;justify-content:space-between;column-gap:${S.metaColumnGap}px;border-bottom:${S.hairline}px solid ${palette.border};padding-bottom:${S.headerPadBottom}px}.meta .to{display:flex;flex-direction:column;flex:1 1 auto;min-width:0;row-gap:${S.metaRowGap}px}.meta .to p{${font(t.contact)}}.meta .date{${font(t.metaDate)}text-align:right;flex-shrink:0}.subject{border-left:${S.subjectBarWidth}px solid ${palette.accent};margin-top:${S.subjectTop}px;padding-left:${S.subjectPadLeft}px}.subject h2{${font(t.railSubject)}margin-top:${S.subjectLabelGap}px}.body{margin-top:${S.subjectTop}px}.body p{${font(t.body)}margin-bottom:${appearance.paragraphSpacing}px}.greeting{${font(t.strong)}}.list{background:${palette.surface};padding:${S.listPadY}px ${S.listPadX}px;margin-bottom:${appearance.paragraphSpacing}px}.bullet{display:flex;column-gap:${S.bulletGap}px}.bullet+.bullet{margin-top:${S.bulletRowGap}px}.bullet .marker{flex:0 0 ${S.bulletIndent - S.bulletGap}px;width:${S.bulletIndent - S.bulletGap}px;text-align:right}.bullet span{${font(t.body)}}.proof-label{${font(t.continued)}letter-spacing:${t.continued.letterSpacing}px;text-transform:uppercase;border-top:${S.hairline}px solid ${palette.border};margin-top:${S.subjectTop}px;padding-top:${S.railTargetTop}px}.proof-item{display:flex;column-gap:12px;border-bottom:${S.hairline}px solid ${palette.border};margin-top:${S.proofRowGap}px;padding-bottom:${S.proofPadBottom}px}.proof-item.last{border-bottom:0}.proof-index{${font(t.proofIndex)}flex:0 0 ${S.proofIndexWidth}px;width:${S.proofIndexWidth}px}.proof-text{${font(t.proofText)}flex:1 1 auto;min-width:0}.signoff{display:flex;flex-direction:column;margin-top:${S.subjectTop}px;row-gap:8px}.signature{${font({ ...t.strong, fontSize: 16, lineHeight: 19.2 })}}.postscript{${font(t.postscript)}border-top:${S.hairline}px solid ${palette.border};margin-top:${S.postscriptTop}px;padding-top:${S.postscriptPadTop}px}@media print{body{padding:0;background:white}.page{box-shadow:none;margin:0}}</style></head><body>${pages
    .map((blocks, pageIndex) => {
      const first = pageIndex === 0;
      const body = blocks.map((item) => renderVeriworklyHtmlItem(item)).join("");
      return `<article class="page"><aside><p class="label">Candidate</p><h1>${escapeHtml(
        senderName,
      )}</h1><p class="rail-title">${escapeHtml(senderTitle)}</p><div class="rule"></div><div class="rail">${contact
        .map((item) => `<p>${escapeHtml(item)}</p>`)
        .join("")}${renderedLinks
        .map(
          (link) =>
            `<a href="${escapeHtml(normalizeLinkHref(link.url))}">${escapeHtml(getLinkDisplayText(link, linkDisplayMode))}</a>`,
        )
        .join("")}</div>${
        showTarget
          ? `<div class="target"><p class="label">Target</p><p class="title">${subject}</p><p>${escapeHtml(content.companyName)}</p></div>`
          : ""
      }</aside><main>${
        first
          ? `<div class="meta"><div class="to">${recipient
              .map((line) => `<p>${escapeHtml(line)}</p>`)
              .join("")}</div><p class="date">${escapeHtml(content.date)}</p></div>${
              showTarget
                ? `<section class="subject"><p class="label">Cover Letter</p><h2>${subject}</h2></section>`
                : ""
            }`
          : ""
      }<section class="body">${body}</section></main></article>`;
    })
    .join("")}</body></html>`;
}
