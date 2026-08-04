"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, RotateCcw, ScanSearch, TriangleAlert } from "lucide-react";

import {
  extractResumeFile,
  getAtsQuota,
  runAtsCheck,
} from "@/features/ats-checker/ats-checker-api";
import type { AtsCheckResult, AtsQuota } from "@/features/ats-checker/types";
import { ApiRequestError } from "@/utils/fetchApiData";
import { Stepper } from "@/features/ats-checker/components/Stepper";
import { ResumeStep } from "@/features/ats-checker/components/ResumeStep";
import { ScanLoader, SCAN_LOADER_MIN_MS } from "@/features/ats-checker/components/ScanLoader";
import { QuotaNotice } from "@/features/ats-checker/components/QuotaNotice";
import { RestrictedResults } from "@/features/ats-checker/components/RestrictedResults";
import { FullResults } from "@/features/ats-checker/components/FullResults";

const STEP_LABELS = ["Resume", "Target role", "Results"];

type Phase = "resume" | "target" | "scanning" | "results";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function wordCountOf(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function AtsCheckerTool() {
  const [phase, setPhase] = useState<Phase>("resume");
  const [resume, setResume] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [quota, setQuota] = useState<AtsQuota | null>(null);
  const [result, setResult] = useState<AtsCheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shouldReduceMotion = useReducedMotion();
  // Results replace the form entirely, so keyboard and screen-reader users need focus to
  // follow the content rather than being left on a button that no longer exists.
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void getAtsQuota()
      .then(setQuota)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (phase === "results") resultsRef.current?.focus();
  }, [phase]);

  const stepIndex = phase === "resume" ? 0 : phase === "target" ? 1 : 2;
  const outOfScans = quota !== null && quota.remaining <= 0;

  async function handleFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const text = await extractResumeFile(file);
      setResume(text);
      setSourceLabel(file.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Resume file could not be read.");
    } finally {
      setBusy(false);
    }
  }

  function handlePaste(text: string) {
    setResume(text);
    setSourceLabel("Pasted resume");
    setError("");
  }

  function clearResume() {
    setResume("");
    setSourceLabel("");
  }

  async function runScan() {
    setPhase("scanning");
    setError("");
    const hasTarget = Boolean(jobDescription.trim());
    try {
      const [next] = await Promise.all([
        runAtsCheck({ resume, jobDescription: jobDescription || undefined }),
        delay(shouldReduceMotion ? 0 : SCAN_LOADER_MIN_MS(hasTarget)),
      ]);
      setResult(next);
      setQuota(next.quota);
      setPhase("results");
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.status === 429) {
        // Refresh the quota so the notice above the form reports the real reset time rather
        // than the stale snapshot the page loaded with.
        const fresh = await getAtsQuota().catch(() => null);
        if (fresh) setQuota(fresh);
        setError("");
      } else {
        setError(cause instanceof Error ? cause.message : "The scan could not be completed.");
      }
      setPhase("target");
    }
  }

  function startOver() {
    setResult(null);
    setJobDescription("");
    clearResume();
    setError("");
    setPhase("resume");
  }

  const entrance = shouldReduceMotion
    ? {}
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 } };

  return (
    <div className="mx-auto max-w-2xl">
      {phase !== "results" ? (
        <>
          <div className="mb-6">
            <Stepper steps={STEP_LABELS} current={stepIndex} />
          </div>
          {quota ? <QuotaNotice quota={quota} /> : null}
        </>
      ) : null}

      <AnimatePresence mode="wait">
        {phase === "resume" ? (
          <motion.div
            key="resume"
            {...entrance}
            className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-white/2"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Add your resume</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Upload a file or paste the text. It is scored in memory and never written to disk.
            </p>
            <div className="mt-5">
              <ResumeStep
                hasResume={Boolean(resume.trim())}
                sourceLabel={sourceLabel}
                wordCount={wordCountOf(resume)}
                busy={busy}
                error={error}
                onFile={handleFile}
                onPaste={handlePaste}
                onClear={clearResume}
              />
            </div>
            {resume.trim() ? (
              <button
                type="button"
                onClick={() => setPhase("target")}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-zinc-950 text-sm font-semibold text-white transition hover:bg-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-white dark:text-zinc-950 dark:hover:bg-blue-500 dark:hover:text-white dark:focus-visible:ring-offset-black"
              >
                Continue <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </motion.div>
        ) : null}

        {phase === "target" ? (
          <motion.div
            key="target"
            {...entrance}
            className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-white/2"
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Add the target role{" "}
              <span className="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span>
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Paste the job description for a keyword match score. Skip it to review parsing,
              structure, and evidence only.
            </p>
            <label htmlFor="ats-job-description" className="sr-only">
              Job description
            </label>
            <textarea
              id="ats-job-description"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              rows={7}
              placeholder="Paste the job description here"
              className="mt-5 w-full resize-y rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-800 outline-none placeholder:text-zinc-500 focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/30 dark:border-zinc-800 dark:bg-white/2 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />

            {error ? (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-700 dark:text-red-400"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}
              </p>
            ) : null}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setPhase("resume")}
                className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold text-zinc-600 transition hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:text-zinc-300 dark:hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void runScan()}
                disabled={outOfScans}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-zinc-950 text-sm font-semibold text-white transition hover:bg-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 dark:bg-white dark:text-zinc-950 dark:hover:bg-blue-500 dark:hover:text-white dark:focus-visible:ring-offset-black"
              >
                <ScanSearch className="h-4 w-4" aria-hidden="true" />{" "}
                {outOfScans ? "No scans left" : "Run free scan"}
              </button>
            </div>
          </motion.div>
        ) : null}

        {phase === "scanning" ? (
          <motion.div
            key="scanning"
            initial={shouldReduceMotion ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ScanLoader hasTarget={Boolean(jobDescription.trim())} />
          </motion.div>
        ) : null}

        {phase === "results" && result ? (
          <motion.div
            key="results"
            {...entrance}
            ref={resultsRef}
            tabIndex={-1}
            className="focus-visible:outline-none"
          >
            <h2 className="sr-only" aria-live="polite">
              Scan complete. Your ATS report is ready.
            </h2>
            {result.report.restricted ? (
              <RestrictedResults report={result.report} />
            ) : (
              <FullResults report={result.report} quota={result.quota} />
            )}
            <button
              type="button"
              onClick={startOver}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-zinc-200 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-white dark:focus-visible:ring-offset-black"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Scan another resume
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
