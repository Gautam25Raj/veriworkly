"use client";

import React from "react";

import type { ResumeWebContext } from "../shared/web";

import { cleanResumeText } from "@/features/documents/rendering/resume-rendering";
import { WebContactRow, WebLinkRow, createResumeWebTemplate, px } from "../shared/web";
import { webText } from "../shared/tokens";
import { executiveClarityGeometry as geometry, executiveClarityScale } from "./skin";

function Header(ctx: ResumeWebContext) {
  const { model, resume, scale, style, tokens } = ctx;

  return (
    <header
      style={{
        borderBottom: `${scale.hairline}px solid ${style.borderColor}`,
        display: "flex",
        flexDirection: "column",
        marginBottom: px(geometry.headerGap),
        paddingBottom: px(geometry.headerPadBottom),
      }}
    >
      {model.showBasics && (
        <>
          {/* flex-end, not baseline: react-pdf resolves "baseline" to the box
              bottom, so bottom alignment is the one rule both engines share. */}
          <div
            style={{
              alignItems: "flex-end",
              columnGap: px(geometry.nameGapX),
              display: "flex",
              flexWrap: "wrap",
              rowGap: px(geometry.nameGapY),
            }}
          >
            <h1 style={webText(tokens.name)}>
              {cleanResumeText(resume.basics.fullName) || "Your Name"}
            </h1>

            {(resume.basics.headline || resume.basics.role) && (
              <p style={{ ...webText(tokens.role), fontWeight: 400 }}>
                {cleanResumeText(resume.basics.headline || resume.basics.role)}
              </p>
            )}
          </div>

          <WebContactRow ctx={ctx} style={{ marginTop: px(geometry.contactTop) }} />
        </>
      )}

      <WebLinkRow ctx={ctx} style={{ marginTop: px(geometry.linksTop) }} />
    </header>
  );
}

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
