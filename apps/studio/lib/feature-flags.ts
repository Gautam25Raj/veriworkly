import "server-only";

// An empty value (`AFFILIATE_PROGRAM_ENABLED=`) means unset, so the environment default applies.
function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  return ["1", "true", "yes", "on"].includes(normalized);
}

const isProductionRuntime = process.env.NODE_ENV === "production";

// Growth programs (affiliate, campus ambassador) are still being finished. They stay reachable in
// non-production environments by default and are hidden behind a "coming soon" screen in
// production until explicitly turned on, mirroring the same flags enforced server-side.
export function isAffiliateProgramEnabled() {
  return parseBoolean(process.env.AFFILIATE_PROGRAM_ENABLED, !isProductionRuntime);
}

export function isAmbassadorProgramEnabled() {
  return parseBoolean(process.env.AMBASSADOR_PROGRAM_ENABLED, !isProductionRuntime);
}
