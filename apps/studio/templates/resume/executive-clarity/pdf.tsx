"use client";

import React from "react";
import { Text, View } from "@react-pdf/renderer";

import type { ResumePdfContext } from "../shared/pdf";

import { pxToPt } from "@/features/resume/constants/resume-layout";
import { createResumePdfTemplate, createStackedPdfHeader } from "../shared/pdf";
import { executiveClarityGeometry as geometry, executiveClarityScale } from "./skin";

const Header = createStackedPdfHeader({ geometry, headlineWeight: 400 });

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
