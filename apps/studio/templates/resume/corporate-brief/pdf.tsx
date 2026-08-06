"use client";

import React from "react";
import { Text, View } from "@react-pdf/renderer";

import type { ResumePdfContext } from "../shared/pdf";

import { cleanResumeText } from "@/features/documents/rendering/resume-rendering";
import { pxToPt } from "@/features/resume/constants/resume-layout";
import { PdfContactRow, PdfLinkRow, createResumePdfTemplate } from "../shared/pdf";
import { pdfFixedWidth } from "@/templates/shared/box";
import { corporateBriefGeometry as geometry, corporateBriefScale } from "./skin";

function Header(ctx: ResumePdfContext) {
  const { model, resume, scale, style, styles } = ctx;

  return (
    <View
      style={{
        alignItems: "flex-end",
        borderBottomColor: style.borderColor,
        borderBottomWidth: pxToPt(scale.hairline),
        columnGap: pxToPt(geometry.headerColumnGap),
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        marginBottom: pxToPt(geometry.headerGap),
        paddingBottom: pxToPt(geometry.headerPadBottom),
        rowGap: pxToPt(geometry.headerRowGap),
      }}
    >
      {model.showBasics && (
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
          <Text style={styles.name}>{cleanResumeText(resume.basics.fullName) || "Your Name"}</Text>

          {(resume.basics.headline || resume.basics.role) && (
            <Text style={[styles.role, { marginTop: pxToPt(geometry.roleTop) }]}>
              {cleanResumeText(resume.basics.headline || resume.basics.role)}
            </Text>
          )}
        </View>
      )}

      <View style={{ flexShrink: 1, rowGap: pxToPt(geometry.contactRowGap) }}>
        <PdfContactRow ctx={ctx} justify="flex-end" />
        <PdfLinkRow ctx={ctx} justify="flex-end" />
      </View>
    </View>
  );
}

function SectionHeading(title: string, ctx: ResumePdfContext) {
  const { scale, style, styles } = ctx;

  return (
    <View
      style={{
        alignItems: "center",
        columnGap: pxToPt(geometry.barGap),
        flexDirection: "row",
        marginBottom: pxToPt(scale.headingGap),
      }}
    >
      <View
        style={{
          ...pdfFixedWidth(geometry.barWidth),
          backgroundColor: style.accentColor,
          height: pxToPt(scale.sectionTitle + geometry.barHeightPad),
        }}
      />

      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export const CorporateBriefPdf = createResumePdfTemplate({
  renderHeader: Header,
  renderSectionHeading: SectionHeading,
  scale: corporateBriefScale,
});
