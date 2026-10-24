import sizes from "@veriworkly/ats-engine/sizes.json";

const measured = sizes as { subpaths: Record<string, { kb: number }> };

/** Read from the installed engine's sizes.json; an unknown subpath fails the build. */
export function engineSize(subpath: string, whole = false): string {
  const size = measured.subpaths[subpath];
  if (!size)
    throw new Error(`The installed @veriworkly/ats-engine reports no size for "${subpath}".`);
  return whole ? `${Math.round(size.kb)} KB` : `${size.kb.toFixed(1)} KB`;
}
