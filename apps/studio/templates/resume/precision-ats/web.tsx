"use client";

import React from "react";

import type { ResumeWebContext } from "../shared/web";

import { cleanResumeText } from "@/features/documents/rendering/resume-rendering";
import { WebContactRow, WebLinkRow, createResumeWebTemplate, px } from "../shared/web";
import { webText } from "../shared/tokens";
import {
  precisionAtsGeometry as geometry,
  precisionAtsPagePadding,
  precisionAtsScale,
  precisionAtsSectionSpacing,
} from "./skin";

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
              <p style={webText(tokens.role)}>
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
