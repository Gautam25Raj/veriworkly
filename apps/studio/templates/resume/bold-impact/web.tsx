"use client";

import React from "react";

import type { ResumeWebContext } from "../shared/web";

import { cleanResumeText } from "@/features/documents/rendering/resume-rendering";
import { WebContactRow, WebLinkRow, createResumeWebTemplate, px } from "../shared/web";
import { webText } from "../shared/tokens";
import { boldImpactGeometry as geometry, boldImpactScale } from "./skin";

function Header(ctx: ResumeWebContext) {
  const { model, resume, style, tokens } = ctx;

  return (
    <header
      style={{
        borderBottom: `${geometry.headerRule}px solid ${style.accentColor}`,
        display: "flex",
        flexDirection: "column",
        marginBottom: px(geometry.headerGap),
        paddingBottom: px(geometry.headerPadBottom),
      }}
    >
      {model.showBasics && (
        <>
          <h1 style={{ ...webText(tokens.name), textAlign: "center", textTransform: "uppercase" }}>
            {cleanResumeText(resume.basics.fullName) || "Your Name"}
          </h1>

          {(resume.basics.headline || resume.basics.role) && (
            <p
              style={{
                ...webText(tokens.role),
                marginTop: px(geometry.roleTop),
                textAlign: "center",
              }}
            >
              {cleanResumeText(resume.basics.headline || resume.basics.role)}
            </p>
          )}

          <WebContactRow align="center" ctx={ctx} style={{ marginTop: px(geometry.contactTop) }} />
        </>
      )}

      <WebLinkRow align="center" ctx={ctx} style={{ marginTop: px(geometry.linksTop) }} />
    </header>
  );
}

function SectionHeading(title: string, ctx: ResumeWebContext) {
  const { scale, style, tokens } = ctx;

  return (
    <div style={{ marginBottom: px(scale.headingGap) }}>
      <span
        style={{
          ...webText(tokens.sectionTitle),
          display: "block",
          textTransform: "uppercase",
        }}
      >
        {title}
      </span>

      <span
        style={{
          backgroundColor: style.accentColor,
          display: "block",
          height: px(geometry.underlineHeight),
          marginTop: px(geometry.underlineTop),
          width: px(geometry.underlineWidth),
        }}
      />
    </div>
  );
}

export const BoldImpactWeb = createResumeWebTemplate({
  renderHeader: Header,
  renderSectionHeading: SectionHeading,
  scale: boldImpactScale,
});
