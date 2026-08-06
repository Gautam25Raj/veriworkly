"use client";

import React from "react";
import { Text, View } from "@react-pdf/renderer";

import type { ResumePdfContext } from "../shared/pdf";

import { cleanResumeText } from "@/features/documents/rendering/resume-rendering";
import { pxToPt } from "@/features/resume/constants/resume-layout";
import { PdfContactRow, PdfLinkRow, createResumePdfTemplate } from "../shared/pdf";
import {
  precisionAtsGeometry as geometry,
  precisionAtsPagePadding,
  precisionAtsScale,
  precisionAtsSectionSpacing,
} from "./skin";

function Header(ctx: ResumePdfContext) {
  const { model, resume, scale, style, styles } = ctx;

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
          {/* flex-end, not baseline: react-pdf resolves "baseline" to the box
              bottom, so bottom alignment is the one rule both engines share. */}
          <View
            style={{
              alignItems: "flex-end",
              columnGap: pxToPt(geometry.nameGapX),
              flexDirection: "row",
              flexWrap: "wrap",
              rowGap: pxToPt(geometry.nameGapY),
            }}
          >
            <Text style={styles.name}>
              {cleanResumeText(resume.basics.fullName) || "Your Name"}
            </Text>

            {(resume.basics.headline || resume.basics.role) && (
              <Text style={styles.role}>
                {cleanResumeText(resume.basics.headline || resume.basics.role)}
              </Text>
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
  const { scale, style, styles } = ctx;

  return (
    <Text
      style={[
        styles.sectionTitle,
        {
          borderBottomColor: style.borderColor,
          borderBottomWidth: pxToPt(scale.hairline),
          marginBottom: pxToPt(scale.headingGap),
          paddingBottom: pxToPt(geometry.headingPadBottom),
        },
      ]}
    >
      {title}
    </Text>
  );
}

export const CompactAtsPdf = createResumePdfTemplate({
  pagePadding: precisionAtsPagePadding,
  renderHeader: Header,
  renderSectionHeading: SectionHeading,
  scale: precisionAtsScale,
  sectionSpacing: precisionAtsSectionSpacing,
});
