"use client";

import React from "react";

import type { ResumeWebContext } from "../shared/web";

import { WebContactRow, WebLinkRow, createResumeWebTemplate, px } from "../shared/web";
import { webText } from "../shared/tokens";
import { executiveClarityGeometry as geometry, executiveClarityScale } from "./skin";

function Header(ctx: ResumeWebContext) {
  const { model, scale, style, tokens } = ctx;

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
          {/* Stacked, never side by side: text extractors read glyphs sharing a
              baseline as one line, so a headline beside the name became part of
              it and the ATS lost the name. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              rowGap: px(geometry.nameGapY),
            }}
          >
            <h1 style={webText(tokens.name)}>{model.name}</h1>

            {model.headline && (
              <p style={{ ...webText(tokens.role), fontWeight: 400 }}>{model.headline}</p>
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
