/** Self-hosted on purpose: next.config.ts allowlists remote image hosts and the CSP sets frame-src 'none', so Giphy is blocked. */
export type ApplyReaction = {
  /** Path under /public, or null to use the emoji sticker fallback. */
  src: string | null;
  emoji: string;
  caption: string;
  alt: string;
};

export const APPLY_REACTIONS = {
  intro: {
    src: null,
    emoji: "🚀",
    caption: "no cover letter, we promise",
    alt: "An excited reaction",
  },
  college: {
    src: null,
    emoji: "🏫",
    caption: "campus rivalry starts now",
    alt: "A campus reaction",
  },
  year: {
    src: null,
    emoji: "🎓",
    caption: "the countdown is real",
    alt: "A graduation reaction",
  },
  why: {
    src: null,
    emoji: "💬",
    caption: "spill it, we're listening",
    alt: "A listening reaction",
  },
  superpower: {
    src: null,
    emoji: "⚡",
    caption: "flex responsibly",
    alt: "A superpower reaction",
  },
  funfact: {
    src: null,
    emoji: "🎲",
    caption: "make it weird",
    alt: "A surprised reaction",
  },
  vibe: {
    src: null,
    emoji: "🌈",
    caption: "there are no wrong answers (there is one wrong answer)",
    alt: "A vibing reaction",
  },
  social: {
    src: null,
    emoji: "📱",
    caption: "so we can hype you up publicly",
    alt: "A phone-scrolling reaction",
  },
  review: {
    src: null,
    emoji: "🧐",
    caption: "one last look",
    alt: "A reviewing reaction",
  },
  success: {
    src: null,
    emoji: "🎉",
    caption: "certified main character behaviour",
    alt: "A celebration reaction",
  },
} as const satisfies Record<string, ApplyReaction>;

export type ApplyReactionKey = keyof typeof APPLY_REACTIONS;
