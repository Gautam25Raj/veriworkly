"use client";

import React from "react";

import type { ResumeWebContext } from "../shared/web";

import { cleanResumeText } from "@/features/documents/rendering/resume-rendering";
import { WebContactRow, WebLinkRow, createResumeWebTemplate, px } from "../shared/web";
import { webText } from "../shared/tokens";
import { webFixedWidth } from "@/templates/shared/box";
import { corporateBriefGeometry as geometry, corporateBriefScale } from "./skin";

function Header(ctx: ResumeWebContext) {
  const { model, resume, scale, style, tokens } = ctx;

  return (
    <header
      style={{
        alignItems: "flex-end",
        borderBottom: `${scale.hairline}px solid ${style.borderColor}`,
        columnGap: px(geometry.headerColumnGap),
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        marginBottom: px(geometry.headerGap),
        paddingBottom: px(geometry.headerPadBottom),
        rowGap: px(geometry.headerRowGap),
      }}
    >
      {model.showBasics && (
        <div style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
          <h1 style={webText(tokens.name)}>
            {cleanResumeText(resume.basics.fullName) || "Your Name"}
          </h1>

          {(resume.basics.headline || resume.basics.role) && (
            <p style={{ ...webText(tokens.role), marginTop: px(geometry.roleTop) }}>
              {cleanResumeText(resume.basics.headline || resume.basics.role)}
            </p>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexShrink: 1,
          rowGap: px(geometry.contactRowGap),
        }}
      >
        <WebContactRow align="right" ctx={ctx} />
        <WebLinkRow align="right" ctx={ctx} />
      </div>
    </header>
  );
}

function SectionHeading(title: string, ctx: ResumeWebContext) {
  const { scale, style, tokens } = ctx;

  return (
    <div
      style={{
        alignItems: "center",
        columnGap: px(geometry.barGap),
        display: "flex",
        marginBottom: px(scale.headingGap),
      }}
    >
      <span
        style={{
          ...webFixedWidth(geometry.barWidth),
          backgroundColor: style.accentColor,
          display: "block",
          height: px(scale.sectionTitle + geometry.barHeightPad),
        }}
      />

      <span style={{ ...webText(tokens.sectionTitle), textTransform: "uppercase" }}>{title}</span>
    </div>
  );
}

export const CorporateBriefWeb = createResumeWebTemplate({
  renderHeader: Header,
  renderSectionHeading: SectionHeading,
  scale: corporateBriefScale,
});
