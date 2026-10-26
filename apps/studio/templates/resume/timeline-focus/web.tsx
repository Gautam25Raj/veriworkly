"use client";

import React from "react";

import type { ResumeWebContext } from "../shared/web";

import { createResumeWebTemplate, createStackedWebHeader, px } from "../shared/web";
import { webText } from "../shared/tokens";
import { timelineFocusGeometry as geometry, timelineFocusScale } from "./skin";

const Header = createStackedWebHeader({
  geometry,
  ruleWeight: geometry.headerRule,
  ruleColor: "accentColor",
});

function SectionHeading(title: string, ctx: ResumeWebContext) {
  const { scale, style, tokens } = ctx;

  return (
    <div
      style={{
        alignItems: "center",
        columnGap: px(geometry.headingRuleGap),
        display: "flex",
        marginBottom: px(scale.headingGap),
      }}
    >
      <span style={{ ...webText(tokens.sectionTitle), textTransform: "uppercase" }}>{title}</span>

      <span
        style={{
          backgroundColor: style.borderColor,
          flexGrow: 1,
          height: px(scale.hairline),
        }}
      />
    </div>
  );
}

export const TimelineFocusWeb = createResumeWebTemplate({
  itemLayout: "gutter",
  renderHeader: Header,
  renderSectionHeading: SectionHeading,
  scale: timelineFocusScale,
});
