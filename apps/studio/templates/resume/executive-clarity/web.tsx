"use client";

import React from "react";

import type { ResumeWebContext } from "../shared/web";

import { createResumeWebTemplate, createStackedWebHeader, px } from "../shared/web";
import { webText } from "../shared/tokens";
import { executiveClarityGeometry as geometry, executiveClarityScale } from "./skin";

const Header = createStackedWebHeader({ geometry, headlineWeight: 400 });

function SectionHeading(title: string, ctx: ResumeWebContext) {
  const { scale, style, tokens } = ctx;

  const rule = (
    <span style={{ backgroundColor: style.borderColor, flexGrow: 1, height: px(scale.hairline) }} />
  );

  return (
    <div
      style={{
        alignItems: "center",
        columnGap: px(geometry.headingRuleGap),
        display: "flex",
        marginBottom: px(scale.headingGap),
      }}
    >
      {rule}
      <span style={{ ...webText(tokens.sectionTitle), textTransform: "uppercase" }}>{title}</span>
      {rule}
    </div>
  );
}

export const CleanProfessionalWeb = createResumeWebTemplate({
  renderHeader: Header,
  renderSectionHeading: SectionHeading,
  scale: executiveClarityScale,
});
