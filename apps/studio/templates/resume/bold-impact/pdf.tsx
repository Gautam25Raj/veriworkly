"use client";

import React from "react";
import { Text, View } from "@react-pdf/renderer";

import type { ResumePdfContext } from "../shared/pdf";

import { cleanResumeText } from "@/features/documents/rendering/resume-rendering";
import { pxToPt } from "@/features/resume/constants/resume-layout";
import { PdfContactRow, PdfLinkRow, createResumePdfTemplate } from "../shared/pdf";
import { boldImpactGeometry as geometry, boldImpactScale } from "./skin";

function Header(ctx: ResumePdfContext) {
  const { model, resume, style, styles } = ctx;

  return (
    <View
      style={{
        borderBottomColor: style.accentColor,
        borderBottomWidth: pxToPt(geometry.headerRule),
        marginBottom: pxToPt(geometry.headerGap),
        paddingBottom: pxToPt(geometry.headerPadBottom),
      }}
    >
      {model.showBasics && (
        <>
          <Text style={[styles.name, { textAlign: "center", textTransform: "uppercase" }]}>
            {cleanResumeText(resume.basics.fullName) || "Your Name"}
          </Text>

          {(resume.basics.headline || resume.basics.role) && (
            <Text
              style={[styles.role, { marginTop: pxToPt(geometry.roleTop), textAlign: "center" }]}
            >
              {cleanResumeText(resume.basics.headline || resume.basics.role)}
            </Text>
          )}

          <PdfContactRow
            ctx={ctx}
            justify="center"
            style={{ marginTop: pxToPt(geometry.contactTop) }}
          />
        </>
      )}

      <PdfLinkRow ctx={ctx} justify="center" style={{ marginTop: pxToPt(geometry.linksTop) }} />
    </View>
  );
}

function SectionHeading(title: string, ctx: ResumePdfContext) {
  const { scale, style, styles } = ctx;

  return (
    <View style={{ marginBottom: pxToPt(scale.headingGap) }}>
      <Text style={styles.sectionTitle}>{title}</Text>

      <View
        style={{
          backgroundColor: style.accentColor,
          height: pxToPt(geometry.underlineHeight),
          marginTop: pxToPt(geometry.underlineTop),
          width: pxToPt(geometry.underlineWidth),
        }}
      />
    </View>
  );
}

export const BoldImpactPdf = createResumePdfTemplate({
  renderHeader: Header,
  renderSectionHeading: SectionHeading,
  scale: boldImpactScale,
});
