"use client";

import React from "react";
import { Text, View } from "@react-pdf/renderer";

import type { ResumePdfContext } from "../shared/pdf";

import { pxToPt } from "@/features/resume/constants/resume-layout";
import { PdfContactRow, PdfLinkRow, createResumePdfTemplate } from "../shared/pdf";
import {
  modernMinimalGeometry as geometry,
  modernMinimalPagePadding,
  modernMinimalScale,
  modernMinimalSectionSpacing,
} from "./skin";

function Header(ctx: ResumePdfContext) {
  const { model, style, styles } = ctx;

  return (
    <View style={{ marginBottom: pxToPt(geometry.headerGap) }}>
      {model.showBasics && (
        <>
          {/* Minimal keeps the identity quiet: body colour, not accent. */}
          <Text style={[styles.name, { color: style.textColor }]}>{model.name}</Text>

          {model.headline && (
            <Text style={[styles.role, { fontWeight: 400, marginTop: pxToPt(geometry.roleTop) }]}>
              {model.headline}
            </Text>
          )}

          <PdfContactRow
            ctx={ctx}
            separator="·"
            style={{ marginTop: pxToPt(geometry.contactTop) }}
          />
        </>
      )}

      <PdfLinkRow ctx={ctx} separator="·" style={{ marginTop: pxToPt(geometry.linksTop) }} />
    </View>
  );
}

function SectionHeading(title: string, ctx: ResumePdfContext) {
  const { scale, styles } = ctx;

  return (
    <Text style={[styles.sectionTitle, { marginBottom: pxToPt(scale.headingGap) }]}>{title}</Text>
  );
}

export const ModernMinimalPdf = createResumePdfTemplate({
  pagePadding: modernMinimalPagePadding,
  renderHeader: Header,
  renderSectionHeading: SectionHeading,
  scale: modernMinimalScale,
  sectionSpacing: modernMinimalSectionSpacing,
});
