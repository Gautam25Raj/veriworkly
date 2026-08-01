"use client";

import React, { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CornerDownLeft,
  GraduationCap,
  Lock,
  PartyPopper,
  Rocket,
  Sparkles,
  Wand2,
} from "lucide-react";
import Link from "next/link";

import { submitAmbassadorApplication } from "@/features/ambassador/ambassador-api";
import { APPLY_REACTIONS } from "@/features/ambassador/apply-reactions";
import { ReactionMedia } from "@/features/ambassador/ReactionMedia";
import type { AmbassadorApplicationPayload, ApplyViewer } from "@/features/ambassador/types";

type FormState = {
  collegeName: string;
  graduationYear: string;
  whyJoin: string;
  superpower: string;
  funFact: string;
  vibeCheck: string;
  socialHandle: string;
};

const EMPTY_FORM: FormState = {
  collegeName: "",
  graduationYear: "",
  whyJoin: "",
  superpower: "",
  funFact: "",
  vibeCheck: "",
  socialHandle: "",
};

const QUESTION_STEPS = [
  "college",
  "year",
  "why",
  "superpower",
  "funfact",
  "vibe",
  "social",
] as const;

const STEP_ORDER = ["intro", ...QUESTION_STEPS, "review"] as const;
type StepId = (typeof STEP_ORDER)[number];

const REVIEW_INDEX = STEP_ORDER.indexOf("review");

const VIBES = [
  { value: "Meme Lord", emoji: "😎" },
  { value: "Library Goblin", emoji: "📚" },
  { value: "Group Project MVP", emoji: "🧑‍💻" },
  { value: "LinkedIn Influencer", emoji: "💼" },
  { value: "Chaos Coordinator", emoji: "🌀" },
  { value: "Quiet Overachiever", emoji: "🤫" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_CHIPS = [CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2, CURRENT_YEAR + 3];
/** Mirrors GRADUATION_YEARS_AHEAD in the server's ambassadorValidator. */
const MAX_GRADUATION_YEAR = CURRENT_YEAR + 8;
const MIN_GRADUATION_YEAR = CURRENT_YEAR - 1;

const FORM_ERROR_ID = "ambassador-apply-error";

/**
 * Mirrors AMBASSADOR_FIELD_LIMITS in the server's ambassadorValidator. These are the
 * server's real ceilings — when they drifted, `maxLength` silently truncated answers the
 * API would happily have accepted.
 */
const FIELD_LIMITS = {
  collegeName: 120,
  graduationYear: 4,
  whyJoin: 1000,
  superpower: 160,
  funFact: 200,
  socialHandle: 100,
} as const;

/**
 * Guests fill the whole form before signing in, so the answers have to survive a
 * round-trip to the login app on another origin. sessionStorage (not localStorage) keeps
 * that scoped to the tab, so a shared computer does not leak half an application into the
 * next person's session.
 */
const DRAFT_KEY = "veriworkly:ambassador-apply-draft";

type StoredDraft = {
  form: FormState;
  stepIndex: number;
  /** Set when a guest hit "sign in & send" — tells us to auto-submit once they return. */
  pendingSubmit: boolean;
};

function readDraft(): StoredDraft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredDraft>;
    if (!parsed || typeof parsed !== "object" || !parsed.form) return null;

    return {
      form: { ...EMPTY_FORM, ...parsed.form },
      stepIndex:
        typeof parsed.stepIndex === "number"
          ? Math.min(Math.max(parsed.stepIndex, 0), STEP_ORDER.length - 1)
          : 0,
      pendingSubmit: Boolean(parsed.pendingSubmit),
    };
  } catch {
    // Private-mode storage errors and hand-mangled JSON both land here. A lost draft is
    // annoying; a crashed apply page is worse.
    return null;
  }
}

function writeDraft(draft: StoredDraft) {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable — the form still works, it just will not survive a reload */
  }
}

function clearDraft() {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to do */
  }
}

function validateStep(step: StepId, form: FormState): string | null {
  switch (step) {
    case "college":
      return form.collegeName.trim().length >= 2
        ? null
        : "We need a campus name — even if it's just 'the library, mostly'.";
    case "year": {
      const value = form.graduationYear.trim();
      if (!/^\d{4}$/.test(value)) return "Enter a real 4-digit graduation year.";

      const year = Number(value);
      if (year < MIN_GRADUATION_YEAR || year > MAX_GRADUATION_YEAR) {
        return `This one's for current students — pick a year between ${MIN_GRADUATION_YEAR} and ${MAX_GRADUATION_YEAR}.`;
      }

      return null;
    }
    case "why": {
      const remaining = 20 - form.whyJoin.trim().length;
      return remaining <= 0
        ? null
        : `${remaining} more character${remaining === 1 ? "" : "s"} — we want the real story.`;
    }
    case "superpower":
      return form.superpower.trim().length >= 2 ? null : "Every ambassador needs a superpower.";
    case "funfact":
      return form.funFact.trim().length >= 2 ? null : "Drop literally anything fun about you.";
    default:
      return null;
  }
}

/** Re-checks every required question. Guards the review step and the post-login resume. */
function findFirstInvalidStep(form: FormState): { step: StepId; message: string } | null {
  for (const step of QUESTION_STEPS) {
    const message = validateStep(step, form);
    if (message) return { step, message };
  }

  return null;
}

const stepVariants = {
  enter: (direction: number) => ({ opacity: 0, y: direction > 0 ? 24 : -24 }),
  center: { opacity: 1, y: 0 },
  exit: (direction: number) => ({ opacity: 0, y: direction > 0 ? -24 : 24 }),
};

type ConfettiPiece = {
  id: number;
  emoji: string;
  x: number;
  y: number;
  rotate: number;
  delay: number;
};

function generateConfetti(): ConfettiPiece[] {
  return Array.from({ length: 18 }, (_, i) => ({
    id: i,
    emoji: ["🎉", "✨", "🎊", "🚀", "💎"][i % 5],
    x: (Math.random() - 0.5) * 360,
    y: -(Math.random() * 220 + 60),
    rotate: (Math.random() - 0.5) * 180,
    delay: Math.random() * 0.15,
  }));
}

function ConfettiBurst() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPieces(generateConfetti());
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-start justify-center overflow-hidden">
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 0.6 }}
          animate={{ opacity: 0, x: piece.x, y: piece.y, rotate: piece.rotate, scale: 1.1 }}
          transition={{ duration: 1.4, delay: piece.delay, ease: "easeOut" }}
          className="absolute top-1/3 text-2xl"
        >
          {piece.emoji}
        </motion.span>
      ))}
    </div>
  );
}

function formFromViewer(viewer: ApplyViewer): FormState {
  const draft = viewer.draft;
  if (!draft) return EMPTY_FORM;

  return {
    collegeName: draft.collegeName ?? "",
    graduationYear: draft.graduationYear ?? "",
    whyJoin: draft.whyJoin ?? "",
    superpower: draft.superpower ?? "",
    funFact: draft.funFact ?? "",
    vibeCheck: draft.vibeCheck ?? "",
    socialHandle: draft.socialHandle ?? "",
  };
}

const AmbassadorApplyExperience = ({
  viewer,
  loginUrl,
}: {
  viewer: ApplyViewer;
  /** Where a guest goes to sign in, already carrying a callback back to this page. */
  loginUrl: string;
}) => {
  const prefilled = formFromViewer(viewer);

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState<FormState>(prefilled);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const step = STEP_ORDER[stepIndex];
  const questionNumber = QUESTION_STEPS.indexOf(step as (typeof QUESTION_STEPS)[number]) + 1;
  const progress =
    questionNumber > 0 ? Math.round((questionNumber / QUESTION_STEPS.length) * 100) : 0;

  const autofilledSchool = Boolean(prefilled.collegeName || prefilled.graduationYear);

  const submitApplication = useCallback(async (payload: FormState) => {
    setSubmitting(true);
    setError("");

    try {
      const body: AmbassadorApplicationPayload = {
        collegeName: payload.collegeName.trim(),
        graduationYear: payload.graduationYear.trim(),
        whyJoin: payload.whyJoin.trim(),
        superpower: payload.superpower.trim(),
        funFact: payload.funFact.trim(),
        vibeCheck: payload.vibeCheck || undefined,
        socialHandle: payload.socialHandle.trim() || undefined,
      };

      await submitAmbassadorApplication(body);
      clearDraft();
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something glitched. Mind giving it another shot?",
      );
    } finally {
      setSubmitting(false);
    }
  }, []);

  // Restore a draft on mount, and finish the job for a guest who just came back from
  // logging in. Runs once — later edits are persisted by the effect below.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;

    const draft = readDraft();
    if (!draft) return;

    // The account is the better source for school/year; the local draft wins everywhere
    // else, since it is what the visitor actually typed this session.
    const merged: FormState = {
      ...draft.form,
      collegeName: draft.form.collegeName || prefilled.collegeName,
      graduationYear: draft.form.graduationYear || prefilled.graduationYear,
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(merged);

    if (draft.pendingSubmit && viewer.isAuthenticated) {
      const invalid = findFirstInvalidStep(merged);

      if (invalid) {
        // Signed in but the draft no longer validates — drop them on the offending
        // question rather than firing a request we know the API will reject.
        setStepIndex(STEP_ORDER.indexOf(invalid.step));
        setError(invalid.message);
        return;
      }

      setStepIndex(REVIEW_INDEX);
      void submitApplication(merged);
      return;
    }

    setStepIndex(draft.stepIndex);
  }, [prefilled.collegeName, prefilled.graduationYear, viewer.isAuthenticated, submitApplication]);

  // Keep the draft warm so a reload — or the trip through login — does not cost answers.
  useEffect(() => {
    if (submitted || !restored.current) return;
    writeDraft({ form, stepIndex, pendingSubmit: false });
  }, [form, stepIndex, submitted]);

  const updateField = useCallback((patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    // Clearing on edit stops a stale message from sitting there — and stops the field
    // being announced as invalid while the visitor is actively fixing it.
    setError("");
  }, []);

  const goNext = () => {
    const validationError = validateStep(step, form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setDirection(1);
    setStepIndex((i) => Math.min(i + 1, STEP_ORDER.length - 1));
  };

  const goBack = () => {
    setError("");
    setDirection(-1);
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const handleReviewSubmit = () => {
    const invalid = findFirstInvalidStep(form);
    if (invalid) {
      setDirection(-1);
      setStepIndex(STEP_ORDER.indexOf(invalid.step));
      setError(invalid.message);
      return;
    }

    if (!viewer.isAuthenticated) {
      // Park the finished application and send them to sign in. The mount effect above
      // picks it back up and submits automatically when they land here again.
      writeDraft({ form, stepIndex, pendingSubmit: true });
      window.location.href = loginUrl;
      return;
    }

    void submitApplication(form);
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (step === "review") handleReviewSubmit();
    else goNext();
  };

  useEffect(() => {
    if (submitted) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [submitted]);

  if (submitted) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="glass-card relative mx-auto flex max-w-xl flex-col items-center overflow-hidden rounded-3xl border border-zinc-200/60 px-8 py-16 text-center shadow-2xl dark:border-white/10"
      >
        <ConfettiBurst />
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
        >
          <PartyPopper className="h-8 w-8" />
        </motion.div>
        <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl dark:text-white">
          You&apos;re officially in the running!
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          We just read your application and we&apos;re already vibing with it. Give us a few days to
          review — your status lives in your dashboard, and we&apos;ll email you the moment it
          changes.
        </p>
        <ReactionMedia reaction={APPLY_REACTIONS.success} className="mt-8" />
        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-full border border-zinc-950/10 bg-zinc-950 px-8 py-3.5 text-xs font-black tracking-wider text-white uppercase shadow-lg transition-all hover:bg-zinc-900 active:scale-[0.98] dark:border-white/20 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
        >
          Back to VeriWorkly
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {questionNumber > 0 && (
        <div className="mb-8 flex items-center gap-3">
          <div
            role="progressbar"
            aria-label="Application progress"
            aria-valuemin={0}
            aria-valuemax={QUESTION_STEPS.length}
            aria-valuenow={questionNumber}
            aria-valuetext={`Question ${questionNumber} of ${QUESTION_STEPS.length}`}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-white/10"
          >
            <motion.div
              className="h-full rounded-full bg-indigo-500"
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 30 }}
            />
          </div>
          <span aria-hidden="true" className="font-mono text-[11px] font-bold text-zinc-500">
            {questionNumber}/{QUESTION_STEPS.length}
          </span>
        </div>
      )}

      <form
        noValidate
        onSubmit={handleFormSubmit}
        aria-label="Student ambassador application"
        className="glass-card relative min-h-100 overflow-hidden rounded-3xl border border-zinc-200/60 p-8 shadow-2xl sm:p-12 dark:border-white/10"
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            {step === "intro" && (
              <div className="flex flex-col items-center py-6 text-center">
                <motion.div
                  animate={{ rotate: [0, -8, 8, -8, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.5 }}
                  className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                >
                  <Rocket className="h-8 w-8" />
                </motion.div>
                <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl dark:text-white">
                  {viewer.name
                    ? `${viewer.name.split(" ")[0]}, let's see that main-character energy 🎓`
                    : "Let's see if you've got main-character energy 🎓"}
                </h1>
                <p className="mt-4 max-w-md text-sm leading-6 text-zinc-500 sm:text-base dark:text-zinc-400">
                  Seven quick questions. No essays, no cover letters, no cap. Roughly two minutes —
                  less if you type like you&apos;re in a group chat.
                </p>
                <ReactionMedia reaction={APPLY_REACTIONS.intro} className="mt-8" />
                {viewer.draft?.whyJoin && (
                  <p className="mt-6 max-w-md rounded-xl border border-zinc-200/70 bg-zinc-50 px-4 py-3 text-xs leading-5 text-zinc-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
                    We kept your last answers — edit what you want and send it again.
                  </p>
                )}
                {viewer.reviewNote && (
                  <div className="mt-4 max-w-md rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-left">
                    <p className="text-[10px] font-black tracking-widest text-amber-700 uppercase dark:text-amber-500">
                      Feedback from last time
                    </p>
                    <p className="mt-1.5 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                      {viewer.reviewNote}
                    </p>
                  </div>
                )}
                {!viewer.isAuthenticated && (
                  <p className="mt-6 flex items-center gap-1.5 rounded-full bg-zinc-100 px-4 py-2 text-[11px] font-semibold text-zinc-500 dark:bg-white/5 dark:text-zinc-400">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    Answer first, sign in at the end. We&apos;ll keep your answers.
                  </p>
                )}
                <button
                  // Explicitly `button`: inside a <form> the default is `submit`, which
                  // fired onClick *and* the form's onSubmit, advancing two steps at once
                  // and skipping the very first question.
                  type="button"
                  onClick={goNext}
                  className="mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-zinc-950/10 bg-zinc-950 px-8 py-4 text-xs font-black tracking-wider text-white uppercase shadow-lg transition-all hover:bg-zinc-900 active:scale-[0.98] dark:border-white/20 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                >
                  Let&apos;s go
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {step === "college" && (
              <QuestionShell
                fieldId="collegeName"
                reactionKey="college"
                title="Where do you go to school?"
                subtitle="College, university, bootcamp — whatever your campus looks like."
              >
                <BigInput
                  autoFocus
                  id="collegeName"
                  value={form.collegeName}
                  placeholder="e.g. University of Michigan"
                  maxLength={FIELD_LIMITS.collegeName}
                  autoComplete="organization"
                  invalid={Boolean(error)}
                  onChange={(v) => updateField({ collegeName: v })}
                />
                {autofilledSchool && <AutofillHint />}
              </QuestionShell>
            )}

            {step === "year" && (
              <QuestionShell
                fieldId="graduationYear"
                reactionKey="year"
                title="When do they finally let you leave?"
                subtitle="Pick a year or type your own."
              >
                <BigInput
                  autoFocus
                  id="graduationYear"
                  value={form.graduationYear}
                  placeholder={`e.g. ${CURRENT_YEAR + 1}`}
                  inputMode="numeric"
                  maxLength={FIELD_LIMITS.graduationYear}
                  invalid={Boolean(error)}
                  onChange={(v) =>
                    updateField({ graduationYear: v.replace(/\D/g, "").slice(0, 4) })
                  }
                />
                <div
                  role="group"
                  aria-label="Suggested graduation years"
                  className="mt-4 flex flex-wrap gap-2"
                >
                  {YEAR_CHIPS.map((year) => (
                    <Chip
                      key={year}
                      label={String(year)}
                      active={form.graduationYear === String(year)}
                      onClick={() => updateField({ graduationYear: String(year) })}
                    />
                  ))}
                </div>
                {autofilledSchool && <AutofillHint />}
              </QuestionShell>
            )}

            {step === "why" && (
              <QuestionShell
                fieldId="whyJoin"
                reactionKey="why"
                title="Why do you want to rep VeriWorkly on campus?"
                subtitle="Real talk, no corporate speak. At least 20 characters."
              >
                <BigTextarea
                  autoFocus
                  id="whyJoin"
                  value={form.whyJoin}
                  placeholder="I'm the friend who unofficially fixes everyone's resume anyway..."
                  maxLength={FIELD_LIMITS.whyJoin}
                  invalid={Boolean(error)}
                  onChange={(v) => updateField({ whyJoin: v })}
                />
              </QuestionShell>
            )}

            {step === "superpower" && (
              <QuestionShell
                fieldId="superpower"
                reactionKey="superpower"
                title="What's your unfair advantage?"
                subtitle="Convincing your entire group chat to try a new app absolutely counts."
              >
                <BigInput
                  autoFocus
                  id="superpower"
                  value={form.superpower}
                  placeholder="e.g. Turning DMs into instant conversions"
                  maxLength={FIELD_LIMITS.superpower}
                  invalid={Boolean(error)}
                  onChange={(v) => updateField({ superpower: v })}
                />
              </QuestionShell>
            )}

            {step === "funfact" && (
              <QuestionShell
                fieldId="funFact"
                reactionKey="funfact"
                title="Give us a fun fact about you"
                subtitle="Weird talent, wild trivia, deeply embarrassing hobby — we want it."
              >
                <BigInput
                  autoFocus
                  id="funFact"
                  value={form.funFact}
                  placeholder="e.g. I can solve a Rubik's cube in under a minute"
                  maxLength={FIELD_LIMITS.funFact}
                  invalid={Boolean(error)}
                  onChange={(v) => updateField({ funFact: v })}
                />
              </QuestionShell>
            )}

            {step === "vibe" && (
              <QuestionShell
                fieldId="vibeCheck"
                reactionKey="vibe"
                title="Pick your campus vibe"
                subtitle="Optional — but this is the one we'll all argue about internally."
              >
                <div
                  role="group"
                  aria-labelledby="vibeCheck-label"
                  aria-describedby="vibeCheck-hint"
                  className="flex flex-wrap gap-2"
                >
                  {VIBES.map((vibe) => (
                    <Chip
                      key={vibe.value}
                      label={`${vibe.emoji} ${vibe.value}`}
                      active={form.vibeCheck === vibe.value}
                      onClick={() =>
                        updateField({ vibeCheck: form.vibeCheck === vibe.value ? "" : vibe.value })
                      }
                    />
                  ))}
                </div>
              </QuestionShell>
            )}

            {step === "social" && (
              <QuestionShell
                fieldId="socialHandle"
                reactionKey="social"
                title="Drop a social handle"
                subtitle="Instagram, LinkedIn, X, TikTok — optional, so we can hype you up."
              >
                <BigInput
                  autoFocus
                  id="socialHandle"
                  value={form.socialHandle}
                  placeholder="@yourhandle"
                  maxLength={FIELD_LIMITS.socialHandle}
                  invalid={Boolean(error)}
                  onChange={(v) => updateField({ socialHandle: v })}
                />
              </QuestionShell>
            )}

            {step === "review" && (
              <div>
                <div className="mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
                      Last look before you send it
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Everything checks out?
                    </p>
                  </div>
                </div>

                <dl className="divide-y divide-zinc-200/70 rounded-2xl border border-zinc-200/70 dark:divide-white/10 dark:border-white/10">
                  <ReviewRow
                    icon={GraduationCap}
                    label="School"
                    value={`${form.collegeName} · Class of ${form.graduationYear}`}
                  />
                  <ReviewRow label="Why you" value={form.whyJoin} />
                  <ReviewRow label="Superpower" value={form.superpower} />
                  <ReviewRow label="Fun fact" value={form.funFact} />
                  {form.vibeCheck && <ReviewRow label="Vibe" value={form.vibeCheck} />}
                  {form.socialHandle && <ReviewRow label="Social" value={form.socialHandle} />}
                </dl>

                {!viewer.isAuthenticated && (
                  <p className="mt-5 flex items-start gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-xs leading-5 font-semibold text-indigo-700 dark:text-indigo-300">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    One last step: sign in so we know who to send the good news to. Your answers are
                    saved and sent automatically the second you&apos;re back.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-zinc-950 text-sm font-black tracking-wider text-white uppercase shadow-lg transition-all hover:bg-zinc-900 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                >
                  {submitting
                    ? "Sending it..."
                    : viewer.isAuthenticated
                      ? "Submit application"
                      : "Sign in & send it"}
                  {!submitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div id={FORM_ERROR_ID} role="alert" aria-live="assertive">
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-600 dark:text-red-400"
            >
              {error}
            </motion.p>
          )}
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {submitting ? "Submitting your application" : ""}
        </p>

        {step !== "intro" && (
          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-zinc-500 uppercase transition-colors hover:text-zinc-900 dark:hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back
            </button>

            {step !== "review" && (
              <div className="flex items-center gap-3">
                {(step === "vibe" || step === "social") && (
                  <button
                    type="button"
                    onClick={goNext}
                    className="text-xs font-bold tracking-wider text-zinc-400 uppercase transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    Skip
                  </button>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-5 py-2.5 text-xs font-black tracking-wider text-white uppercase shadow-md transition-all hover:bg-indigo-500 active:scale-[0.97]"
                >
                  Continue
                  <CornerDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
};

function AutofillHint() {
  return (
    <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
      <Wand2 className="h-3 w-3" aria-hidden="true" />
      Filled in from your account — change it if it&apos;s wrong.
    </p>
  );
}

function QuestionShell({
  reactionKey,
  title,
  subtitle,
  fieldId,
  children,
}: {
  reactionKey: keyof typeof APPLY_REACTIONS;
  title: string;
  subtitle: string;
  /** Id of the field this question labels — wires the heading/subtitle to it. */
  fieldId: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h2
            id={`${fieldId}-label`}
            className="text-xl font-extrabold tracking-tight text-zinc-950 sm:text-2xl dark:text-white"
          >
            {title}
          </h2>
          <p id={`${fieldId}-hint`} className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {subtitle}
          </p>
        </div>
        <ReactionMedia
          reaction={APPLY_REACTIONS[reactionKey]}
          className="hidden shrink-0 sm:flex"
        />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

/** Shared a11y wiring for the big single-question fields. */
const fieldA11y = (id: string, invalid: boolean) => ({
  id,
  name: id,
  "aria-labelledby": `${id}-label`,
  "aria-describedby": invalid ? `${id}-hint ${FORM_ERROR_ID}` : `${id}-hint`,
  "aria-invalid": invalid || undefined,
});

function BigInput({
  id,
  value,
  onChange,
  placeholder,
  autoFocus,
  inputMode,
  maxLength,
  autoComplete,
  invalid = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  inputMode?: "text" | "numeric";
  maxLength: number;
  autoComplete?: string;
  invalid?: boolean;
}) {
  return (
    <input
      {...fieldA11y(id, invalid)}
      value={value}
      autoFocus={autoFocus}
      inputMode={inputMode}
      placeholder={placeholder}
      maxLength={maxLength}
      autoComplete={autoComplete ?? "off"}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border-b-2 border-zinc-200 bg-transparent pb-3 text-xl font-semibold text-zinc-950 transition-colors outline-none placeholder:text-zinc-300 focus:border-indigo-500 sm:text-2xl dark:border-white/15 dark:text-white dark:placeholder:text-zinc-700"
    />
  );
}

function BigTextarea({
  id,
  value,
  onChange,
  placeholder,
  autoFocus,
  maxLength,
  invalid = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  maxLength: number;
  invalid?: boolean;
}) {
  return (
    <textarea
      {...fieldA11y(id, invalid)}
      value={value}
      autoFocus={autoFocus}
      placeholder={placeholder}
      rows={4}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-none border-b-2 border-zinc-200 bg-transparent pb-3 text-lg leading-7 font-medium text-zinc-950 transition-colors outline-none placeholder:text-zinc-300 focus:border-indigo-500 dark:border-white/15 dark:text-white dark:placeholder:text-zinc-700"
    />
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      whileTap={{ scale: 0.95 }}
      className={`rounded-full border px-4 py-2 text-xs font-bold tracking-wide transition-colors ${
        active
          ? "border-indigo-500 bg-indigo-500 text-white"
          : "border-zinc-200 bg-transparent text-zinc-600 hover:border-indigo-500/40 dark:border-white/15 dark:text-zinc-400"
      }`}
    >
      {label}
    </motion.button>
  );
}

function ReviewRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof GraduationCap;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />}
      <div className="min-w-0">
        <p className="text-[10px] font-black tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
          {label}
        </p>
        <p className="mt-1 text-sm leading-6 wrap-break-word text-zinc-800 dark:text-zinc-200">
          {value}
        </p>
      </div>
    </div>
  );
}

export default AmbassadorApplyExperience;
