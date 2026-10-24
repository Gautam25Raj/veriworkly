"use client";

import { useEffect } from "react";

const ENDPOINT = process.env.NEXT_PUBLIC_VITALS_URL;

type Metric = {
  name: string;
  value: number;
  rating: string;
  id: string;
  navigationType: string;
};
type OnMetric = (callback: (metric: Metric) => void) => void;

/**
 * Field Core Web Vitals: each metric is sent as one small JSON beacon to NEXT_PUBLIC_VITALS_URL
 * (any endpoint that accepts a plain JSON POST; an OTLP collector needs a converter in front), so the Phase 2 budgets can be checked
 * on real devices and not only in the lab (W-061).
 *
 * The web-vitals library (the copy Next bundles) is imported inside the effect, so it is its own
 * chunk and only downloads when a collector is configured. useReportWebVitals imports it
 * statically, which put about 3 KB gz on every page even with no collector.
 */
export function WebVitals() {
  useEffect(() => {
    if (!ENDPOINT) return;

    const report = (metric: Metric) => {
      const body = JSON.stringify({
        app: "site",
        name: metric.name,
        value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
        rating: metric.rating,
        id: metric.id,
        navigationType: metric.navigationType,
        path: window.location.pathname,
      });

      if (!navigator.sendBeacon?.(ENDPOINT, body))
        void fetch(ENDPOINT, { method: "POST", body, keepalive: true }).catch(() => {});
    };

    // @ts-expect-error Next's compiled copy of web-vitals ships without type declarations.
    void import("next/dist/compiled/web-vitals").then((vitals: Record<string, OnMetric>) => {
      for (const name of ["onLCP", "onINP", "onCLS", "onFCP", "onTTFB"]) vitals[name]?.(report);
    });
  }, []);

  return null;
}
