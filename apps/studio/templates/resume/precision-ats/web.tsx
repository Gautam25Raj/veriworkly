"use client";

import React from "react";

import type { ResumeWebContext } from "../shared/web";

import { createResumeWebTemplate, createStackedWebHeader, px } from "../shared/web";
import { webText } from "../shared/tokens";
import {
  precisionAtsGeometry as geometry,
  precisionAtsPagePadding,
  precisionAtsScale,
  precisionAtsSectionSpacing,
} from "./skin";

const Header = createStackedWebHeader({ geometry });

function SectionHeading(title: string, ctx: ResumeWebContext) {
  const { scale, style, tokens } = ctx;

  return (
    <div
      style={{
        ...webText(tokens.sectionTitle),
        borderBottom: `${scale.hairline}px solid ${style.borderColor}`,
        marginBottom: px(scale.headingGap),
        paddingBottom: px(geometry.headingPadBottom),
        textTransform: "uppercase",
      }}
    >
      {title}
    </div>
  );
}

export const CompactAtsWeb = createResumeWebTemplate({
  pagePadding: precisionAtsPagePadding,
  renderHeader: Header,
  renderSectionHeading: SectionHeading,
  scale: precisionAtsScale,
  sectionSpacing: precisionAtsSectionSpacing,
});
