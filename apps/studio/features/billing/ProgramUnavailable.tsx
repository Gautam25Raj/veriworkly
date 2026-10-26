import { ComingSoon } from "@/components/dashboard/ComingSoon";

const PROGRAM_NAMES = {
  affiliate: "Affiliate program",
  ambassador: "Ambassador program",
} as const;

/** The server has the program switched off: say so, rather than inviting the user to join. */
export function ProgramUnavailable({ program }: { program: keyof typeof PROGRAM_NAMES }) {
  return (
    <ComingSoon
      title={`${PROGRAM_NAMES[program]} unavailable`}
      description="This program is not open right now. Check back soon."
    />
  );
}
