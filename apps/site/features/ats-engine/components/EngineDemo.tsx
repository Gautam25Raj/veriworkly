"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, RotateCcw } from "lucide-react";
import type { AtsReport } from "@veriworkly/ats-engine";
import { categoryLabel, scoreTone, sortByCategoryOrder } from "@veriworkly/ats-engine/format";

import { ScoreGauge } from "@/features/ats-checker/components/tool/ScoreGauge";
import { TONE_CLASSES } from "@/features/ats-checker/data/categories";

import { ENGINE_SAMPLES } from "../data/samples";

type CheckFn = typeof import("@veriworkly/ats-engine").check;

/** A fixed reference date, so a sample scores the same on every visit. */
const DEMO_NOW = new Date("2026-10-01T00:00:00Z");

const STATUS_STYLE: Record<AtsReport["requirements"][number]["status"], string> = {
  met: TONE_CLASSES.good.chip,
  partial: TONE_CLASSES.warn.chip,
  missing: TONE_CLASSES.bad.chip,
  unverifiable: "bg-muted/10 text-muted",
};

/**
 * Scores invented sample resumes with the real engine, in the visitor's browser. The engine is
 * loaded only when the demo scrolls into view, and nothing is sent anywhere. Visitors can edit
 * the posting, not the resume: checking their own resume is what /ats-checker is for.
 */
export function EngineDemo() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [check, setCheck] = useState<CheckFn | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sampleId, setSampleId] = useState(ENGINE_SAMPLES[0]!.id);
  const [postings, setPostings] = useState<Record<string, string>>(() =>
    Object.fromEntries(ENGINE_SAMPLES.map((sample) => [sample.id, sample.posting])),
  );
  const [result, setResult] = useState<{ report: AtsReport; ms: number } | null>(null);

  const sample = ENGINE_SAMPLES.find((entry) => entry.id === sampleId) ?? ENGINE_SAMPLES[0]!;
  const posting = postings[sample.id] ?? sample.posting;

  // What to score next, kept current by the handlers so callbacks never read stale state.
  const current = useRef({ resume: sample.resume, posting });
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const score = (checkFn: CheckFn) => {
    const started = performance.now();
    const report = checkFn(current.current.resume, undefined, {
      jobDescription: current.current.posting,
      now: DEMO_NOW,
    });
    setResult({ report, ms: performance.now() - started });
  };

  // Load the engine once the demo is near the viewport, then score the selected sample.
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || check) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        import("@veriworkly/ats-engine")
          .then((engine) => {
            setCheck(() => engine.check);
            score(engine.check);
          })
          .catch(() => setLoadFailed(true));
      },
      { rootMargin: "300px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [check]);

  useEffect(() => () => clearTimeout(debounce.current), []);

  const selectSample = (id: string) => {
    const next = ENGINE_SAMPLES.find((entry) => entry.id === id);
    if (!next) return;

    setSampleId(id);
    clearTimeout(debounce.current);
    current.current = { resume: next.resume, posting: postings[id] ?? next.posting };
    if (check) score(check);
  };

  const editPosting = (value: string) => {
    setPostings((existing) => ({ ...existing, [sample.id]: value }));
    current.current = { resume: sample.resume, posting: value };

    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      if (check) score(check);
    }, 250);
  };

  const resetPosting = () => editPosting(sample.posting);

  const report = result?.report;

  return (
    <div ref={sectionRef} className="space-y-6">
      <div role="tablist" aria-label="Sample resumes" className="flex flex-wrap gap-2">
        {ENGINE_SAMPLES.map((entry) => {
          const selected = entry.id === sample.id;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => selectSample(entry.id)}
              className={`focus-visible:ring-accent rounded-full border px-4 py-2 text-xs font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none sm:text-sm ${
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/80 bg-card/60 text-muted hover:text-foreground"
              }`}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      <p className="text-muted text-sm">{sample.summary}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <div className="border-border/60 bg-card/40 rounded-2xl border">
            <div className="border-border/60 flex items-center justify-between border-b px-4 py-2.5">
              <span className="text-foreground text-xs font-semibold">Resume (invented)</span>
              <span className="text-muted font-mono text-[10px] tracking-widest uppercase">
                read-only
              </span>
            </div>
            <pre
              tabIndex={0}
              aria-label="Sample resume text"
              className="text-muted focus-visible:ring-accent max-h-72 overflow-auto p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap focus-visible:ring-2 focus-visible:outline-none"
            >
              {sample.resume}
            </pre>
          </div>

          <div className="border-border/60 bg-card/40 rounded-2xl border">
            <div className="border-border/60 flex items-center justify-between border-b px-4 py-2.5">
              <label
                htmlFor="engine-demo-posting"
                className="text-foreground text-xs font-semibold"
              >
                Job posting (edit it)
              </label>
              <button
                type="button"
                onClick={resetPosting}
                disabled={posting === sample.posting}
                className="text-muted hover:text-foreground focus-visible:ring-accent inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                Reset
              </button>
            </div>
            <textarea
              id="engine-demo-posting"
              value={posting}
              onChange={(event) => editPosting(event.target.value)}
              rows={10}
              spellCheck={false}
              className="text-foreground focus-visible:ring-accent block w-full resize-y bg-transparent p-4 font-mono text-[11px] leading-relaxed focus-visible:ring-2 focus-visible:outline-none"
            />
          </div>
        </div>

        <div aria-live="polite" className="min-w-0 space-y-5">
          {!report ? (
            <div className="border-border/60 bg-card/40 text-muted flex h-full min-h-72 items-center justify-center gap-2 rounded-2xl border text-sm">
              {loadFailed ? (
                "The engine could not be loaded. Reload the page to try again."
              ) : (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Loading the engine into this page…
                </>
              )}
            </div>
          ) : (
            <>
              <div className="border-border/60 bg-card/40 flex flex-wrap items-start justify-around gap-6 rounded-2xl border p-6">
                <ScoreGauge score={report.readinessScore} label="Readiness" size="sm" />
                {report.jobMatchScore !== null ? (
                  <ScoreGauge score={report.jobMatchScore} label="Job match" size="sm" />
                ) : null}
              </div>

              <p className="text-muted font-mono text-[11px]">
                Scored in {result.ms < 1 ? "<1" : Math.round(result.ms)} ms in this browser · engine{" "}
                {report.engine.version} · policy {report.engine.policy}
              </p>

              <div className="flex flex-wrap gap-2">
                {sortByCategoryOrder(report.categories).map((category) => (
                  <span
                    key={category.category}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold tabular-nums ${TONE_CLASSES[scoreTone(category.score)].chip}`}
                  >
                    {categoryLabel(category.category)} {category.score}%
                  </span>
                ))}
              </div>

              <div className="space-y-3">
                <h3 className="text-foreground text-sm font-semibold">
                  {report.failedChecks.length === 0
                    ? "No failed checks"
                    : `Failed checks (${report.failedChecks.length})`}
                </h3>
                <ul className="space-y-2.5">
                  {[...report.failedChecks]
                    .sort((a, b) => b.scoreImpact - a.scoreImpact)
                    .slice(0, 4)
                    .map((rule) => (
                      <li
                        key={rule.id}
                        className="border-border/60 bg-card/40 space-y-1 rounded-xl border p-3.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <code className="text-foreground truncate font-mono text-[11px]">
                            {rule.id}
                          </code>
                          <span className="text-muted shrink-0 font-mono text-[11px] tabular-nums">
                            −{rule.scoreImpact}
                          </span>
                        </div>
                        <p className="text-muted text-xs leading-relaxed">{rule.evidence}</p>
                        <p className="text-foreground text-xs leading-relaxed">{rule.fix}</p>
                      </li>
                    ))}
                </ul>
              </div>

              {report.requirements.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-foreground text-sm font-semibold">Requirements</h3>
                  <ul className="space-y-2">
                    {report.requirements.slice(0, 6).map((requirement, index) => (
                      <li key={`${requirement.text}-${index}`} className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-semibold ${STATUS_STYLE[requirement.status]}`}
                        >
                          {requirement.status}
                        </span>
                        <span className="text-muted min-w-0 text-xs leading-relaxed">
                          {requirement.text}
                          {requirement.detail ? (
                            <span className="text-muted/80 block text-[11px]">
                              {requirement.detail}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}

          <Link
            href="/ats-checker/scan"
            className="text-accent inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
          >
            Check your own resume, with PDF upload
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default EngineDemo;
