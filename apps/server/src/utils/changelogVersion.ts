export type ChangelogType = "major" | "minor" | "patch";

export function slugifyVersion(version: string): string {
  return `v${version
    .trim()
    .replace(/[^\w.]+/g, "-")
    .replace(/\./g, "-")}`;
}

/**
 * Parses a GitHub release tag into a bare version string. Handles both the
 * common `Release-vX.Y.Z` format and the occasional `Release-X.Y.Z` (no `v`)
 * seen in older tags.
 */

export function parseReleaseTag(tagName: string): string {
  return tagName.replace(/^Release-/i, "").replace(/^v/i, "");
}

function parseSemverParts(version: string): [number, number, number] {
  const base = version.split("-")[0];
  const [major, minor, patch] = base.split(".").map((part) => Number.parseInt(part, 10) || 0);
  return [major, minor, patch];
}

/**
 * Derives a major/minor/patch label by diffing two version strings.
 * Defaults to "minor" when there's no previous version to compare against.
 */

export function deriveReleaseType(
  prevVersion: string | undefined,
  currentVersion: string,
): ChangelogType {
  if (!prevVersion) return "minor";

  const [prevMajor, prevMinor, prevPatch] = parseSemverParts(prevVersion);
  const [major, minor, patch] = parseSemverParts(currentVersion);

  if (major !== prevMajor) return "major";
  if (minor !== prevMinor) return "minor";
  if (patch !== prevPatch) return "patch";

  return "minor";
}
