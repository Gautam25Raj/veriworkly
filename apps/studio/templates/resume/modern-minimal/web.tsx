"use client";

import React from "react";

import type { ResumeWebContext } from "../shared/web";

import { WebContactRow, WebLinkRow, createResumeWebTemplate, px } from "../shared/web";
import { webText } from "../shared/tokens";
import {
  modernMinimalGeometry as geometry,
  modernMinimalPagePadding,
  modernMinimalScale,
  modernMinimalSectionSpacing,
} from "./skin";

function Header(ctx: ResumeWebContext) {
  const { model, style, tokens } = ctx;

  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        marginBottom: px(geometry.headerGap),
      }}
    >
      {model.showBasics && (
        <>
          {/* Minimal keeps the identity quiet: body colour, not accent. */}
          <h1 style={{ ...webText(tokens.name), color: style.textColor }}>{model.name}</h1>

          {model.headline && (
            <p
              style={{ ...webText(tokens.role), fontWeight: 400, marginTop: px(geometry.roleTop) }}
            >
              {model.headline}
            </p>
          )}

          <WebContactRow ctx={ctx} separator="·" style={{ marginTop: px(geometry.contactTop) }} />
        </>
      )}

      <WebLinkRow ctx={ctx} separator="·" style={{ marginTop: px(geometry.linksTop) }} />
    </header>
  );
}

function SectionHeading(title: string, ctx: ResumeWebContext) {
  const { scale, tokens } = ctx;

  return (
    <div
      style={{
        ...webText(tokens.sectionTitle),
        marginBottom: px(scale.headingGap),
        textTransform: "uppercase",
      }}
    >
      {title}
    </div>
  );
}

export const ModernMinimalWeb = createResumeWebTemplate({
  pagePadding: modernMinimalPagePadding,
  renderHeader: Header,
  renderSectionHeading: SectionHeading,
  scale: modernMinimalScale,
  sectionSpacing: modernMinimalSectionSpacing,
});
