"use client";

import React from "react";
import { Text, View } from "@react-pdf/renderer";

import type { ResumePdfContext } from "../shared/pdf";

import { pxToPt } from "@/features/resume/constants/resume-layout";
import { PdfContactRow, PdfLinkRow, createResumePdfTemplate } from "../shared/pdf";
import { executiveClarityGeometry as geometry, executiveClarityScale } from "./skin";

function Header(ctx: ResumePdfContext) {
  const { model, scale, style, styles } = ctx;

  return (
    <View
      style={{
        borderBottomColor: style.borderColor,
        borderBottomWidth: pxToPt(scale.hairline),
        marginBottom: pxToPt(geometry.headerGap),
        paddingBottom: pxToPt(geometry.headerPadBottom),
      }}
    >
      {model.showBasics && (
        <>
          {/* Stacked, never side by side: text extractors read glyphs sharing a
              baseline as one line, so a headline beside the name became part of
              it and the ATS lost the name. */}
          <View style={{ flexDirection: "column", rowGap: pxToPt(geometry.nameGapY) }}>
            <Text style={styles.name}>{model.name}</Text>

            {model.headline && (
              <Text style={[styles.role, { fontWeight: 400 }]}>{model.headline}</Text>
            )}
          </View>

          <PdfContactRow ctx={ctx} style={{ marginTop: pxToPt(geometry.contactTop) }} />
        </>
      )}

      <PdfLinkRow ctx={ctx} style={{ marginTop: pxToPt(geometry.linksTop) }} />
    </View>
  );
}

function SectionHeading(title: string, ctx: ResumePdfContext) {
  const { scale, styles } = ctx;

  return (
    <View
      style={{
        alignItems: "center",
        columnGap: pxToPt(geometry.headingRuleGap),
        flexDirection: "row",
        marginBottom: pxToPt(scale.headingGap),
      }}
    >
      <View style={styles.rule} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.rule} />
    </View>
  );
}

export const CleanProfessionalPdf = createResumePdfTemplate({
  renderHeader: Header,
  renderSectionHeading: SectionHeading,
  scale: executiveClarityScale,
});
