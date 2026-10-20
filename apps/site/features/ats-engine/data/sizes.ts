import sizes from "@veriworkly/ats-engine/sizes.json";

const measured = sizes as { subpaths: Record<string, { kb: number }> };

/**
 * A subpath's size, minified and gzipped, as the installed engine measured it for its release
 * (`@veriworkly/ats-engine/sizes.json`), so the page moves with each engine bump. An unknown
 * subpath fails the build.
 */
export function engineSize(subpath: string, whole = false): string {
  const size = measured.subpaths[subpath];
  if (!size)
    throw new Error(`The installed @veriworkly/ats-engine reports no size for "${subpath}".`);
  return whole ? `${Math.round(size.kb)} KB` : `${size.kb.toFixed(1)} KB`;
}
