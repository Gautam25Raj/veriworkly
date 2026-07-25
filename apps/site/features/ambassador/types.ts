export type AmbassadorStatus = {
  role: "USER" | "AMBASSADOR" | "ADMIN";
  ambassadorStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED" | string;
  collegeName: string | null;
  graduationYear: string | null;
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
