"use client";

import React from "react";
import { Text, View } from "@react-pdf/renderer";

import type { ResumePdfContext } from "../shared/pdf";

import { pxToPt } from "@/features/resume/constants/resume-layout";
import { createResumePdfTemplate, createStackedPdfHeader } from "../shared/pdf";
import { timelineFocusGeometry as geometry, timelineFocusScale } from "./skin";

const Header = createStackedPdfHeader({
  geometry,
  ruleWeight: geometry.headerRule,
  ruleColor: "accentColor",
});

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
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.rule} />
    </View>
  );
}

export const TimelineFocusPdf = createResumePdfTemplate({
  itemLayout: "gutter",
  renderHeader: Header,
  renderSectionHeading: SectionHeading,
  scale: timelineFocusScale,
});
