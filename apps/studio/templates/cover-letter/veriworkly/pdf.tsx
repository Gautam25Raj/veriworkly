import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { CoverLetterContent } from "@/features/cover-letter/types";
import type { CoverLetterPalette } from "../shared";
import type { CoverLetterTokens } from "../tokens";

import { getPdfFontStack } from "@/features/documents/constants/fonts";
import { pxToPt } from "@/features/resume/constants/resume-layout";
import { pdfFixedWidth, pdfFlexible } from "@/templates/shared/box";
import { pdfText } from "@/templates/shared/text-tokens";
import { BULLET_MARKER } from "@/templates/resume/shared/typography";
import { COVER_LETTER_SCALE as S, createCoverLetterTokens } from "../tokens";

import {
  buildCoverLetterFlowContent,
  buildVeriworklyFlowItems,
  getCoverLetterFlowSenderName,
  getCoverLetterPalette,
  getVeriworklyFlowItemWeight,
  keepVeriworklyProofHeadingWithNext,
  paginateWeightedItems,
  getCoverLetterLinks,
  getCoverLetterLinkDisplayMode,
  isCoverLetterSectionVisible,
  type VeriworklyFlowItem,
} from "../shared";

import {
  normalizeLinkHref,
  getLinkDisplayText,
} from "@/features/documents/rendering/resume-rendering";
import { PdfSocialIcon } from "@/templates/pdf/SocialIcon";

const PAGE_WIDTH_PT = pxToPt(S.pageWidth);
const PAGE_HEIGHT_PT = pxToPt(S.pageHeight);

/**
 * Every spatial value goes through `pxToPt` and every text node pins its own
 * line box, so this file lays out exactly like `./web.tsx`.
 */
function createStyles(
  palette: CoverLetterPalette,
  tokens: CoverLetterTokens,
  appearance: CoverLetterContent["appearance"],
) {
  /**
   * Column widths, stated rather than left to flex.
   *
   * `@react-pdf/layout` breaks a `Text` into lines once, on Yoga's first
   * measure pass, and then refuses to redo it (`shouldLayoutText` returns false
   * as soon as `node.lines` exists). For a `Text` sized by flex that first pass
   * proposes the *container's* width, so the lines are broken for a column the
   * text is not in — and the paragraph runs off the right edge of the page,
   * which is exactly what the preview does not do.
   */
  const mainWidth = S.pageWidth - S.railWidth - S.hairline - appearance.pageMargin * 2;
  const railTextWidth = S.railWidth - S.railPadX * 2;
  const listWidth = mainWidth - S.listPadX * 2;
  const recipientWidth = mainWidth - S.metaDateWidth - S.metaColumnGap;

  const column = (width: number) => ({ width: pxToPt(width), maxWidth: pxToPt(width) });

  return StyleSheet.create({
    page: {
      backgroundColor: appearance.pageColor,
      color: palette.text,
      height: PAGE_HEIGHT_PT,
      minHeight: PAGE_HEIGHT_PT,
      padding: 0,
      width: PAGE_WIDTH_PT,
    },
    shell: { flexDirection: "row", height: PAGE_HEIGHT_PT, minHeight: PAGE_HEIGHT_PT },

    sidebar: {
      ...pdfFixedWidth(S.railWidth),
      backgroundColor: appearance.sidebarColor,
      borderRightColor: palette.sidebarBorder,
      borderRightWidth: pxToPt(S.hairline),
      height: PAGE_HEIGHT_PT,
      paddingHorizontal: pxToPt(S.railPadX),
      paddingVertical: pxToPt(S.railPadY),
    },
    main: {
      ...pdfFlexible,
      backgroundColor: appearance.pageColor,
      height: PAGE_HEIGHT_PT,
      padding: pxToPt(appearance.pageMargin),
    },

    railLabel: { ...pdfText(tokens.railLabel), ...column(railTextWidth) },
    railName: { ...pdfText(tokens.railName), ...column(railTextWidth), marginTop: pxToPt(16) },
    railTitle: { ...pdfText(tokens.railTitle), ...column(railTextWidth), marginTop: pxToPt(8) },
    railText: { ...pdfText(tokens.railText), ...column(railTextWidth) },
    railBlock: { marginTop: pxToPt(S.railBlockTop), rowGap: pxToPt(8) },
    rule: {
      backgroundColor: palette.accent,
      height: pxToPt(S.hairline),
      marginBottom: pxToPt(S.railBlockTop),
      marginTop: pxToPt(S.railBlockTop),
      width: pxToPt(S.railRuleWidth),
    },
    railDivider: {
      backgroundColor: palette.accent,
      height: pxToPt(S.hairline),
      marginBottom: pxToPt(16),
      marginTop: pxToPt(16),
      width: pxToPt(S.railRuleWidth),
    },
    railLinkRow: { alignItems: "center", columnGap: pxToPt(4), flexDirection: "row" },
    railLinkIcon: { ...pdfFixedWidth(14), height: pxToPt(14) },
    railLink: { ...pdfText(tokens.railText), color: palette.accent, textDecoration: "none" },

    targetBlock: {
      borderTopColor: palette.sidebarBorder,
      borderTopWidth: pxToPt(S.hairline),
      marginTop: "auto",
      paddingTop: pxToPt(S.railTargetTop),
      rowGap: pxToPt(8),
    },
    targetTitle: {
      ...pdfText(tokens.railText),
      ...column(railTextWidth),
      color: palette.sidebarText,
      fontWeight: 700,
    },

    meta: {
      borderBottomColor: palette.border,
      borderBottomWidth: pxToPt(S.hairline),
      columnGap: pxToPt(S.metaColumnGap),
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: pxToPt(S.headerPadBottom),
    },
    metaLeft: { ...pdfFlexible, ...column(recipientWidth), rowGap: pxToPt(S.metaRowGap) },
    metaLine: { ...pdfText(tokens.contact), ...column(recipientWidth) },
    metaDate: {
      ...pdfText(tokens.metaDate),
      ...pdfFixedWidth(S.metaDateWidth),
      textAlign: "right",
    },

    subject: {
      ...column(mainWidth),
      borderLeftColor: palette.accent,
      borderLeftWidth: pxToPt(S.subjectBarWidth),
      marginTop: pxToPt(S.subjectTop),
      paddingLeft: pxToPt(S.subjectPadLeft),
    },
    subjectText: {
      ...pdfText(tokens.railSubject),
      ...column(mainWidth - S.subjectBarWidth - S.subjectPadLeft),
      marginTop: pxToPt(S.subjectLabelGap),
    },

    body: { ...column(mainWidth), marginTop: pxToPt(S.subjectTop) },
    paragraph: { ...pdfText(tokens.body), ...column(mainWidth) },
    greeting: { ...pdfText(tokens.strong), ...column(mainWidth) },
    signature: {
      ...pdfText(tokens.strong),
      ...column(mainWidth),
      fontSize: pxToPt(16),
      lineHeight: 1.2,
    },

    list: {
      ...column(mainWidth),
      backgroundColor: palette.surface,
      paddingHorizontal: pxToPt(S.listPadX),
      paddingVertical: pxToPt(S.listPadY),
    },
    bulletRow: { ...column(listWidth), columnGap: pxToPt(S.bulletGap), flexDirection: "row" },
    bulletMarkerColumn: pdfFixedWidth(S.bulletIndent - S.bulletGap),
    bulletMarker: { ...pdfText(tokens.body), textAlign: "right" },
    bulletText: { ...pdfText(tokens.body), ...column(listWidth - S.bulletIndent) },

    proofLabel: {
      ...pdfText(tokens.continued),
      ...column(mainWidth),
      borderTopColor: palette.border,
      borderTopWidth: pxToPt(S.hairline),
      marginTop: pxToPt(S.subjectTop),
      paddingTop: pxToPt(S.railTargetTop),
    },
    proofItem: {
      ...column(mainWidth),
      borderBottomColor: palette.border,
      borderBottomWidth: pxToPt(S.hairline),
      columnGap: pxToPt(12),
      flexDirection: "row",
      marginTop: pxToPt(S.proofRowGap),
      paddingBottom: pxToPt(S.proofPadBottom),
    },
    proofIndexColumn: pdfFixedWidth(S.proofIndexWidth),
    proofIndex: pdfText(tokens.proofIndex),
    proofText: { ...pdfText(tokens.proofText), ...column(mainWidth - S.proofIndexWidth - 12) },

    signoff: { ...column(mainWidth), marginTop: pxToPt(S.subjectTop), rowGap: pxToPt(8) },
    postscript: {
      ...pdfText(tokens.postscript),
      ...column(mainWidth),
      borderTopColor: palette.border,
      borderTopWidth: pxToPt(S.hairline),
      marginTop: pxToPt(S.postscriptTop),
      paddingTop: pxToPt(S.postscriptPadTop),
    },
  });
}

function paginateVeriworklyPdfItems(items: VeriworklyFlowItem[]) {
  return paginateWeightedItems(
    items,
    getVeriworklyFlowItemWeight,
    () => 24,
    keepVeriworklyProofHeadingWithNext,
  );
}

export function VeriworklyCoverLetterPdf({ content }: { content: CoverLetterContent }) {
  const appearance = content.appearance;
  const palette = getCoverLetterPalette(appearance);
  const tokens = createCoverLetterTokens(appearance, palette);
  const styles = createStyles(palette, tokens, appearance);

  const showProfile = isCoverLetterSectionVisible(content, "profile");
  const showLinks = isCoverLetterSectionVisible(content, "links");
  const showTarget = isCoverLetterSectionVisible(content, "target");

  const paragraphSpacing = { marginBottom: pxToPt(appearance.paragraphSpacing) };
  const senderName = getCoverLetterFlowSenderName(content);

  const contact = showProfile
    ? [
        content.senderEmail,
        content.senderPhone,
        content.senderLocation,
        content.senderWebsite,
      ].filter(Boolean)
    : [];

  const links = showLinks ? getCoverLetterLinks(content) : [];
  const linkDisplayMode = getCoverLetterLinkDisplayMode(content);

  const recipient = showTarget
    ? [
        content.recipientName,
        content.recipientTitle,
        content.companyName,
        content.companyLocation,
      ].filter(Boolean)
    : [];

  const flowItems = buildVeriworklyFlowItems(buildCoverLetterFlowContent(content), senderName);
  const pages = paginateVeriworklyPdfItems(flowItems);
  const renderPages = pages.length > 0 ? pages : [[]];

  function renderSidebar() {
    return (
      <View style={styles.sidebar}>
        <Text style={styles.railLabel}>Candidate</Text>
        <Text style={styles.railName}>{senderName}</Text>

        {content.senderTitle ? <Text style={styles.railTitle}>{content.senderTitle}</Text> : null}

        <View style={styles.rule} />

        <View style={styles.railBlock}>
          {contact.map((item) => (
            <Text key={item} style={styles.railText}>
              {item}
            </Text>
          ))}

          {links.length > 0 && <View style={styles.railDivider} />}

          {links.map((link) => (
            <View key={link.id} style={styles.railLinkRow}>
              {linkDisplayMode !== "url" ? (
                <Link src={normalizeLinkHref(link.url)} style={styles.railLinkIcon}>
                  <PdfSocialIcon color={palette.accent} size={pxToPt(14)} type={link.type} />
                </Link>
              ) : null}

              {linkDisplayMode !== "icon" ? (
                <Link src={normalizeLinkHref(link.url)} style={styles.railLink}>
                  {getLinkDisplayText(link, linkDisplayMode)}
                </Link>
              ) : null}
            </View>
          ))}
        </View>

        {showTarget ? (
          <View style={styles.targetBlock}>
            <Text style={styles.railLabel}>Target</Text>
            <Text style={styles.targetTitle}>
              {content.jobTitle || content.subject || "Open role"}
            </Text>
            {content.companyName ? (
              <Text style={styles.railText}>{content.companyName}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  function renderFlowItem(item: VeriworklyFlowItem) {
    if (item.type === "greeting") {
      return (
        <Text key={item.id} style={[styles.greeting, paragraphSpacing]} wrap={false}>
          {item.text}
        </Text>
      );
    }

    if (item.type === "paragraph") {
      return (
        <Text key={item.id} style={[styles.paragraph, paragraphSpacing]} wrap={false}>
          {item.text}
        </Text>
      );
    }

    if (item.type === "body-list") {
      return (
        <View key={item.id} style={[styles.list, paragraphSpacing]} wrap={false}>
          {item.items.map((listItem, index) => (
            <View
              key={listItem}
              style={[
                styles.bulletRow,
                index === 0 ? {} : { marginTop: pxToPt(S.bulletRowGap) },
              ].flat()}
            >
              <View style={styles.bulletMarkerColumn}>
                <Text style={styles.bulletMarker}>{BULLET_MARKER}</Text>
              </View>
              <Text style={styles.bulletText}>{listItem}</Text>
            </View>
          ))}
        </View>
      );
    }

    if (item.type === "proof-heading") {
      return (
        <View key={item.id} wrap={false}>
          <Text style={styles.proofLabel}>Selected Proof</Text>
        </View>
      );
    }

    if (item.type === "proof-item") {
      return (
        <View
          key={item.id}
          style={[styles.proofItem, item.isLast ? { borderBottomWidth: 0 } : {}].flat()}
          wrap={false}
        >
          <View style={styles.proofIndexColumn}>
            <Text style={styles.proofIndex}>{String(item.index + 1).padStart(2, "0")}</Text>
          </View>

          <Text style={styles.proofText}>{item.text}</Text>
        </View>
      );
    }

    if (item.type === "signoff") {
      return (
        <View key={item.id} style={styles.signoff} wrap={false}>
          {item.closing ? <Text style={styles.paragraph}>{item.closing}</Text> : null}
          <Text style={styles.signature}>{item.signature}</Text>
        </View>
      );
    }

    return (
      <Text key={item.id} style={styles.postscript} wrap={false}>
        P.S. {item.text}
      </Text>
    );
  }

  return (
    <Document>
      {renderPages.map((pageItems, pageIndex) => (
        <Page
          key={pageIndex}
          size={[PAGE_WIDTH_PT, PAGE_HEIGHT_PT]}
          style={[styles.page, { fontFamily: getPdfFontStack(appearance.fontFamily) }]}
          wrap={false}
        >
          <View style={styles.shell}>
            {renderSidebar()}

            <View style={styles.main}>
              {pageIndex === 0 ? (
                <>
                  <View style={styles.meta}>
                    <View style={styles.metaLeft}>
                      {recipient.map((line) => (
                        <Text key={line} style={styles.metaLine}>
                          {line}
                        </Text>
                      ))}
                    </View>

                    {content.date ? <Text style={styles.metaDate}>{content.date}</Text> : null}
                  </View>

                  {showTarget ? (
                    <View style={styles.subject}>
                      <Text style={styles.railLabel}>Cover Letter</Text>
                      <Text style={styles.subjectText}>
                        {content.subject || content.jobTitle || "Application"}
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : null}

              <View style={styles.body}>{pageItems.map((item) => renderFlowItem(item))}</View>
            </View>
          </View>
        </Page>
      ))}
    </Document>
  );
}
