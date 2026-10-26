"use client";

import React from "react";
import { Text } from "@react-pdf/renderer";

import type { ResumePdfContext } from "../shared/pdf";

import { pxToPt } from "@/features/resume/constants/resume-layout";
import { createResumePdfTemplate, createStackedPdfHeader } from "../shared/pdf";
import {
  precisionAtsGeometry as geometry,
  precisionAtsPagePadding,
  precisionAtsScale,
  precisionAtsSectionSpacing,
} from "./skin";

const Header = createStackedPdfHeader({ geometry });

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
