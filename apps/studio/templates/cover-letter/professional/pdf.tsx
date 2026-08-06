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
  buildProfessionalFlowItems,
  getCoverLetterFlowSenderName,
  getCoverLetterPalette,
  getCoverLetterLinks,
  getCoverLetterLinkDisplayMode,
  isCoverLetterSectionVisible,
  type ProfessionalFlowItem,
} from "../shared";

import {
  getLinkDisplayText,
  normalizeLinkHref,
} from "@/features/documents/rendering/resume-rendering";
import { PdfSocialIcon } from "@/templates/pdf/SocialIcon";

/**
 * The preview page is 794x1123 CSS pixels, so the PDF states the same size in
 * points rather than using `size="A4"` (793.71x1122.52px) — otherwise the text
 * column is a fraction narrower in the export and long lines wrap differently.
 */
const PAGE_WIDTH_PT = pxToPt(S.pageWidth);
const PAGE_HEIGHT_PT = pxToPt(S.pageHeight);

/**
 * Every spatial value goes through `pxToPt` and every text node pins its own
 * line box, so this file lays out exactly like `./web.tsx`. A bare number here
 * would mean points and render 1.333x too large.
 */
function createStyles(palette: CoverLetterPalette, tokens: CoverLetterTokens, pageMargin: number) {
  /**
   * Column widths, stated rather than left to flex — see the same note in
   * `../veriworkly/pdf.tsx`. `@react-pdf/layout` breaks a `Text` into lines on
   * Yoga's first measure pass and never again, so a paragraph sized by flex is
   * broken for the container's width and overruns its own column.
   */
  const contentWidth = S.pageWidth - pageMargin * 2;
  const identityWidth = contentWidth - S.headerContactWidth - S.headerColumnGap;
  const recipientWidth = contentWidth - S.metaDateWidth - S.metaColumnGap;
  const listWidth = contentWidth - S.listPadX * 2;

  const column = (width: number) => ({ width: pxToPt(width), maxWidth: pxToPt(width) });

  return StyleSheet.create({
    page: { color: palette.text },

    header: {
      ...column(contentWidth),
      borderBottomColor: palette.strong,
      borderBottomWidth: pxToPt(S.headerRule),
      flexDirection: "row",
      paddingBottom: pxToPt(S.headerPadBottom),
    },
    headerIdentity: { ...pdfFlexible, ...column(identityWidth) },
    headerContact: {
      ...pdfFixedWidth(S.headerContactWidth),
      alignItems: "flex-end",
      marginLeft: pxToPt(S.headerColumnGap),
      rowGap: pxToPt(S.headerRowGap),
    },

    name: { ...pdfText(tokens.senderName), ...column(identityWidth) },
    title: {
      ...pdfText(tokens.senderTitle),
      ...column(identityWidth),
      marginTop: pxToPt(S.subjectLabelGap),
    },
    contact: { ...pdfText(tokens.contact), ...column(S.headerContactWidth) },
    contactLink: { ...pdfText(tokens.contact), color: palette.strong, textDecoration: "none" },
    linkRow: { alignItems: "center", columnGap: pxToPt(4), flexDirection: "row" },
    linkIcon: { ...pdfFixedWidth(S.contact), height: pxToPt(S.contact) },

    meta: { ...column(contentWidth), flexDirection: "row", marginTop: pxToPt(S.metaTop) },
    metaLeft: { ...pdfFlexible, ...column(recipientWidth), rowGap: pxToPt(S.metaRowGap) },
    metaLine: { ...pdfText(tokens.contact), ...column(recipientWidth) },
    metaDate: {
      ...pdfText(tokens.metaDate),
      ...pdfFixedWidth(S.metaDateWidth),
      marginLeft: pxToPt(S.metaColumnGap),
      textAlign: "right",
    },

    subject: {
      ...column(contentWidth),
      borderBottomColor: palette.border,
      borderBottomWidth: pxToPt(S.hairline),
      borderTopColor: palette.border,
      borderTopWidth: pxToPt(S.hairline),
      marginTop: pxToPt(S.subjectTop),
      paddingBottom: pxToPt(S.subjectPadY),
      paddingTop: pxToPt(S.subjectPadY),
    },
    label: { ...pdfText(tokens.label), ...column(contentWidth) },
    subjectText: {
      ...pdfText(tokens.subject),
      ...column(contentWidth),
      marginTop: pxToPt(S.subjectLabelGap),
    },

    body: { ...column(contentWidth), marginTop: pxToPt(S.bodyTop) },
    paragraph: { ...pdfText(tokens.body), ...column(contentWidth) },
    greeting: { ...pdfText(tokens.strong), ...column(contentWidth) },
    signature: { ...pdfText(tokens.strong), ...column(contentWidth) },

    list: {
      ...column(contentWidth),
      backgroundColor: palette.surface,
      paddingHorizontal: pxToPt(S.listPadX),
      paddingVertical: pxToPt(S.listPadY),
    },
    bulletRow: { ...column(listWidth), columnGap: pxToPt(S.bulletGap), flexDirection: "row" },
    bulletMarkerColumn: pdfFixedWidth(S.bulletIndent - S.bulletGap),
    bulletMarker: { ...pdfText(tokens.body), textAlign: "right" },
    bulletText: { ...pdfText(tokens.body), ...column(listWidth - S.bulletIndent) },

    postscript: {
      ...pdfText(tokens.postscript),
      ...column(contentWidth),
      borderTopColor: palette.border,
      borderTopWidth: pxToPt(S.hairline),
      marginTop: pxToPt(S.postscriptTop),
      paddingTop: pxToPt(S.postscriptPadTop),
    },
  });
}

export function ProfessionalCoverLetterPdf({ content }: { content: CoverLetterContent }) {
  const appearance = content.appearance;
  const palette = getCoverLetterPalette(appearance);
  const tokens = createCoverLetterTokens(appearance, palette);
  const styles = createStyles(palette, tokens, appearance.pageMargin);

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

  const flowItems = buildProfessionalFlowItems(buildCoverLetterFlowContent(content), senderName);

  function renderList(items: string[], key: string) {
    return (
      <View key={key} style={[styles.list, paragraphSpacing]}>
        {items.map((item, index) => (
          <View
            key={`${key}-${index}`}
            style={[
              styles.bulletRow,
              index === 0 ? {} : { marginTop: pxToPt(S.bulletRowGap) },
            ].flat()}
          >
            <View style={styles.bulletMarkerColumn}>
              <Text style={styles.bulletMarker}>{BULLET_MARKER}</Text>
            </View>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>
    );
  }

  function renderFlowItem(item: ProfessionalFlowItem) {
    if (item.type === "greeting") {
      return (
        <Text key={item.id} style={[styles.greeting, paragraphSpacing]}>
          {item.text}
        </Text>
      );
    }

    if (item.type === "paragraph" || item.type === "closing") {
      return (
        <Text key={item.id} style={[styles.paragraph, paragraphSpacing]}>
          {item.text}
        </Text>
      );
    }

    if (item.type === "body-list" || item.type === "proof-list") {
      return renderList(item.items, item.id);
    }

    if (item.type === "signature") {
      return (
        <Text key={item.id} style={styles.signature}>
          {item.text}
        </Text>
      );
    }

    return (
      <Text key={item.id} style={styles.postscript}>
        P.S. {item.text}
      </Text>
    );
  }

  return (
    <Document>
      <Page
        size={[PAGE_WIDTH_PT, PAGE_HEIGHT_PT]}
        style={[
          styles.page,
          {
            backgroundColor: appearance.pageColor,
            fontFamily: getPdfFontStack(appearance.fontFamily),
            padding: pxToPt(appearance.pageMargin),
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerIdentity}>
            <Text style={styles.name}>{senderName}</Text>

            {content.senderTitle ? <Text style={styles.title}>{content.senderTitle}</Text> : null}
          </View>

          {contact.length > 0 || links.length > 0 ? (
            <View style={styles.headerContact}>
              {contact.map((item) => (
                <Text key={item} style={styles.contact}>
                  {item}
                </Text>
              ))}

              {links.map((link) => (
                <View key={link.id} style={styles.linkRow}>
                  {linkDisplayMode !== "url" ? (
                    <Link src={normalizeLinkHref(link.url)} style={styles.linkIcon}>
                      <PdfSocialIcon
                        color={palette.strong}
                        size={pxToPt(S.contact)}
                        type={link.type}
                      />
                    </Link>
                  ) : null}

                  {linkDisplayMode !== "icon" ? (
                    <Link src={normalizeLinkHref(link.url)} style={styles.contactLink}>
                      {getLinkDisplayText(link, linkDisplayMode)}
                    </Link>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>

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

        {showTarget && (content.subject || content.jobTitle) ? (
          <View style={styles.subject}>
            <Text style={styles.label}>Re</Text>
            <Text style={styles.subjectText}>{content.subject || content.jobTitle}</Text>
          </View>
        ) : null}

        <View style={styles.body}>{flowItems.map((item) => renderFlowItem(item))}</View>
      </Page>
    </Document>
  );
}
