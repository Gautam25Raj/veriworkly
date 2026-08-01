export type AmbassadorApplicationSnapshot = {
  collegeName: string;
  graduationYear: string;
  whyJoin: string;
  superpower: string;
  funFact: string;
  vibeCheck: string | null;
  socialHandle: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  reviewNote: string | null;
  reviewedAt: string | null;
  submittedAt: string;
  updatedAt: string;
};

export type AmbassadorStatus = {
  name: string | null;
  email: string | null;
  role: "USER" | "AMBASSADOR" | "ADMIN";
  ambassadorStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED" | string;
  collegeName: string | null;
  graduationYear: string | null;
  application: AmbassadorApplicationSnapshot | null;
};

export type AmbassadorApplicationPayload = {
  collegeName: string;
  graduationYear: string;
  whyJoin: string;
  superpower: string;
  funFact: string;
  vibeCheck?: string;
  socialHandle?: string;
};

/**
 * What the apply form knows about the person filling it in. A guest gets the full
 * seven-question run and signs in at the end; a signed-in visitor gets their school and
 * class year prefilled from the account instead of retyping them.
 */
export type ApplyViewer = {
  isAuthenticated: boolean;
  name: string | null;
  /** Previous answers, when re-applying after a rejection. */
  draft: Partial<AmbassadorApplicationPayload> | null;
  /** Reviewer feedback from a prior rejected attempt, if any. */
  reviewNote: string | null;
};
