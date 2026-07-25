"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CornerDownLeft,
  GraduationCap,
  PartyPopper,
  Rocket,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { submitAmbassadorApplication } from "@/features/ambassador/ambassador-api";

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

const FORM_ERROR_ID = "ambassador-apply-error";

const FIELD_LIMITS = {
  collegeName: 120,
  graduationYear: 4,
  whyJoin: 1000,
  superpower: 160,
  funFact: 200,
  socialHandle: 100,
} as const;

function validateStep(step: StepId, form: FormState): string | null {
  switch (step) {
    case "college":
      return form.collegeName.trim().length >= 2 ? null : "Tell us where you're studying.";
    case "year":
      return /^(19|20)\d{2}$/.test(form.graduationYear.trim())
        ? null
        : "Enter a real 4-digit graduation year.";
    case "why":
      return form.whyJoin.trim().length >= 20
        ? null
        : `Give us ${20 - form.whyJoin.trim().length} more characters — we want the real story.`;
    case "superpower":
      return form.superpower.trim().length >= 2 ? null : "Every ambassador needs a superpower.";
    case "funfact":
      return form.funFact.trim().length >= 2 ? null : "Drop literally anything fun about you.";
    default:
      return null;
  }
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

const AmbassadorApplyExperience = () => {
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const step = STEP_ORDER[stepIndex];
  const questionNumber = QUESTION_STEPS.indexOf(step as (typeof QUESTION_STEPS)[number]) + 1;
  const progress =
    questionNumber > 0 ? Math.round((questionNumber / QUESTION_STEPS.length) * 100) : 0;

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

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await submitAmbassadorApplication({
        collegeName: form.collegeName.trim(),
        graduationYear: form.graduationYear.trim(),
        whyJoin: form.whyJoin.trim(),
        superpower: form.superpower.trim(),
        funFact: form.funFact.trim(),
        vibeCheck: form.vibeCheck || undefined,
        socialHandle: form.socialHandle.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something glitched. Mind giving it another shot?",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (step === "review") {
      void handleSubmit();
    } else {
      goNext();
    }
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
          review, then check your inbox — good news travels fast.
        </p>
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
                  Let&apos;s see if you&apos;ve got main-character energy 🎓
                </h1>
                <p className="mt-4 max-w-md text-sm leading-6 text-zinc-500 sm:text-base dark:text-zinc-400">
                  Seven quick questions. No essays, no cover letters, no cap. Just be yourself —
                  that&apos;s literally the whole application.
                </p>
                <button
                  onClick={goNext}
                  className="mt-10 inline-flex items-center justify-center gap-2 rounded-full border border-zinc-950/10 bg-zinc-950 px-8 py-4 text-xs font-black tracking-wider text-white uppercase shadow-lg transition-all hover:bg-zinc-900 active:scale-[0.98] dark:border-white/20 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                >
                  Let&apos;s go
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {step === "college" && (
              <QuestionShell
                fieldId="collegeName"
                emoji="🏫"
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
                  onChange={(v) => setForm((f) => ({ ...f, collegeName: v }))}
                />
              </QuestionShell>
            )}

            {step === "year" && (
              <QuestionShell
                fieldId="graduationYear"
                emoji="🎓"
                title="When do you graduate?"
                subtitle="Pick a year or type your own."
              >
                <BigInput
                  autoFocus
                  id="graduationYear"
                  value={form.graduationYear}
                  placeholder="e.g. 2027"
                  inputMode="numeric"
                  maxLength={FIELD_LIMITS.graduationYear}
                  invalid={Boolean(error)}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, graduationYear: v.replace(/\D/g, "").slice(0, 4) }))
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
                      onClick={() => setForm((f) => ({ ...f, graduationYear: String(year) }))}
                    />
                  ))}
                </div>
              </QuestionShell>
            )}

            {step === "why" && (
              <QuestionShell
                fieldId="whyJoin"
                emoji="💬"
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
                  onChange={(v) => setForm((f) => ({ ...f, whyJoin: v }))}
                />
              </QuestionShell>
            )}

            {step === "superpower" && (
              <QuestionShell
                fieldId="superpower"
                emoji="⚡"
                title="If you had one superpower for this gig, what would it be?"
                subtitle="Convincing your entire group chat to try a new app counts."
              >
                <BigInput
                  autoFocus
                  id="superpower"
                  value={form.superpower}
                  placeholder="e.g. Turning DMs into instant conversions"
                  maxLength={FIELD_LIMITS.superpower}
                  invalid={Boolean(error)}
                  onChange={(v) => setForm((f) => ({ ...f, superpower: v }))}
                />
              </QuestionShell>
            )}

            {step === "funfact" && (
              <QuestionShell
                fieldId="funFact"
                emoji="🎲"
                title="Give us a fun fact about you"
                subtitle="Weird talent, wild trivia, embarrassing hobby — we want it."
              >
                <BigInput
                  autoFocus
                  id="funFact"
                  value={form.funFact}
                  placeholder="e.g. I can solve a Rubik's cube in under a minute"
                  maxLength={FIELD_LIMITS.funFact}
                  invalid={Boolean(error)}
                  onChange={(v) => setForm((f) => ({ ...f, funFact: v }))}
                />
              </QuestionShell>
            )}

            {step === "vibe" && (
              <QuestionShell
                fieldId="vibeCheck"
                emoji="🌈"
                title="Pick your campus vibe"
                subtitle="Optional — but we're curious."
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
                        setForm((f) => ({
                          ...f,
                          vibeCheck: f.vibeCheck === vibe.value ? "" : vibe.value,
                        }))
                      }
                    />
                  ))}
                </div>
              </QuestionShell>
            )}

            {step === "social" && (
              <QuestionShell
                fieldId="socialHandle"
                emoji="📱"
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
                  onChange={(v) => setForm((f) => ({ ...f, socialHandle: v }))}
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

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-zinc-950 text-sm font-black tracking-wider text-white uppercase shadow-lg transition-all hover:bg-zinc-900 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                >
                  {submitting ? "Sending it..." : "Submit application"}
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

function QuestionShell({
  emoji,
  title,
  subtitle,
  fieldId,
  children,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  /** Id of the field this question labels — wires the heading/subtitle to it. */
  fieldId: string;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="text-3xl" aria-hidden="true">
        {emoji}
      </span>
      <h2
        id={`${fieldId}-label`}
        className="mt-4 text-xl font-extrabold tracking-tight text-zinc-950 sm:text-2xl dark:text-white"
      >
        {title}
      </h2>
      <p id={`${fieldId}-hint`} className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        {subtitle}
      </p>
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
