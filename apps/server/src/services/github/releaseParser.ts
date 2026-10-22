import type { MergedPullRequest, ParsedReleaseBody } from "./types.js";

type ChangeList = "added" | "improved" | "fixed" | "breaking" | "security";
type Section = ChangeList | "skip" | "summary" | "pulls";

const CATEGORY_KEYWORDS: Array<{ pattern: RegExp; category: Section }> = [
  { pattern: /contributor|dependency|dependencies|artifact|asset/i, category: "skip" },
  { pattern: /pull request|full changelog/i, category: "pulls" },
  { pattern: /summary|overview|highlights/i, category: "summary" },
  { pattern: /security/i, category: "security" },
  { pattern: /breaking/i, category: "breaking" },
  { pattern: /fix|bug|patch|resolved/i, category: "fixed" },
  { pattern: /improve|enhance|refactor|update|perf|polish/i, category: "improved" },
  {
    pattern: /feature|feat|added|addition|add\b|new\s+feature|what'?s changed/i,
    category: "added",
  },
];

/** "**#191** — [Feature] title" or "**#221** - `[Chore] title` by @user". */
const PULL_REQUEST_LINE = /^\*{0,2}#(\d+)\*{0,2}\s+[—–-]\s+`?(.+?)`?(?:\s+by\s+@[\w-]+)?$/;

/**
 * Robust markdown parser for GitHub release notes.
 * Buckets bullet points under headers by category keyword match,
 * preserves multi-line/wrapped bullet items, extracts preamble summaries,
 * and skips metadata sections like Contributors or Full Changelog links.
 */
export function parseReleaseBody(body: string | null): ParsedReleaseBody {
  const result: ParsedReleaseBody = {
    summary: null,
    added: [],
    improved: [],
    fixed: [],
    breaking: [],
    security: [],
    pullRequests: [],
  };

  if (!body) return result;

  let currentCategory: Section | null = null;
  const summaryLines: string[] = [];
  let isPreamble = true;

  const lines = body.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Blank lines and horizontal rules ("---") carry no content.
    if (!line || /^([-*_])(\s*\1){2,}$/.test(line)) {
      continue;
    }

    // Check for Markdown headers: #, ##, ###, etc. A heading does not end the preamble, so the
    // intro paragraph under a release's title heading ("## v3.22.0") is still its summary.
    if (/^#{1,6}\s+/.test(line)) {
      const header = line.replace(/^#{1,6}\s+/, "");
      const match = CATEGORY_KEYWORDS.find(({ pattern }) => pattern.test(header));
      currentCategory = match?.category ?? "added";
      continue;
    }

    // Skip metadata lines like "**Full Changelog**: https://..."
    if (/^\*\*Full Changelog\*\*:/i.test(line) || /^Full Changelog:/i.test(line)) {
      continue;
    }

    // Check for bullet list items: "* ", "- ", "+ ", "• ", or "1. "
    const isBullet = /^[-*+•]\s+/.test(line) || /^\d+\.\s+/.test(line);

    if (isBullet) {
      isPreamble = false;
      const item = line
        .replace(/^[-*+•]\s+/, "")
        .replace(/^\d+\.\s+/, "")
        .trim();

      if (currentCategory === "skip") {
        continue;
      }

      if (currentCategory === "pulls") {
        const pr = PULL_REQUEST_LINE.exec(item);
        if (pr) result.pullRequests.push({ number: Number(pr[1]), title: pr[2].trim() });
        continue;
      }

      const targetCategory =
        currentCategory && currentCategory !== "summary" ? currentCategory : "added";

      if (item) {
        result[targetCategory].push(item);
      }
      continue;
    }

    // Indented or wrapped continuation of previous bullet
    if (
      !isPreamble &&
      currentCategory &&
      currentCategory !== "skip" &&
      currentCategory !== "summary" &&
      currentCategory !== "pulls"
    ) {
      const targetCategory = currentCategory;
      const currentList = result[targetCategory];
      if (currentList.length > 0 && (/^\s{2,}/.test(rawLine) || !/^[A-Z#]/.test(line))) {
        currentList[currentList.length - 1] += ` ${line}`;
        continue;
      }
    }

    // Capture summary from preamble before any headers/bullets, or inside explicit summary header
    if (isPreamble || currentCategory === "summary") {
      summaryLines.push(line);
    }
  }

  if (summaryLines.length > 0) {
    result.summary = summaryLines.join(" ");
  }

  return result;
}

export interface ReleasePrRef {
  number: number;
  title: string;
  url?: string;
  author?: { login: string; avatarUrl: string; htmlUrl: string } | null;
}

/** A release's listed PRs as refs; GitHub's merged-PR list fills in their authors later. */
export function listedPullRequests(
  pulls: ParsedReleaseBody["pullRequests"],
  repoUrl: string,
): ReleasePrRef[] {
  return pulls.map((pr) => ({ ...pr, url: `${repoUrl}/pull/${pr.number}`, author: null }));
}

/**
 * Two PR lists as one, newest first. Nothing is dropped, and a ref without an author is replaced
 * by the same PR from the other list when that one has the author.
 */
export function unionPullRequests(a: ReleasePrRef[], b: ReleasePrRef[]): ReleasePrRef[] {
  const byNumber = new Map<number, ReleasePrRef>();

  for (const ref of [...a, ...b]) {
    const known = byNumber.get(ref.number);
    if (!known || (!known.author && ref.author)) byNumber.set(ref.number, ref);
  }

  return [...byNumber.values()].sort((x, y) => y.number - x.number);
}

/**
 * Whether two PR lists say the same thing. Compared by content, not as JSON: Postgres jsonb
 * stores object keys in its own order, so a stored list never stringifies like a fresh one.
 */
export function samePullRequests(a: ReleasePrRef[], b: ReleasePrRef[]): boolean {
  const key = (refs: ReleasePrRef[]) =>
    refs.map((ref) => [ref.number, ref.title, ref.url ?? "", ref.author?.login ?? ""].join("|"));

  return JSON.stringify(key(a)) === JSON.stringify(key(b));
}

const DEFAULT_BRANCHES = new Set(["master", "main"]);

/**
 * Which pull requests shipped in which release. A PR a release's notes name belongs to that
 * release; every other merged PR belongs to the first release published after it merged.
 * "Sync dev from master" PRs only move code that already shipped, so they are left out.
 */
export function assignPullRequestsToReleases(
  releases: Array<{ id: string; publishedAt: string; listed: number[] }>,
  pulls: MergedPullRequest[],
): Map<string, ReleasePrRef[]> {
  const ordered = [...releases].sort(
    (a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt),
  );
  const listedBy = new Map<number, string>();
  for (const release of ordered)
    for (const number of release.listed) listedBy.set(number, release.id);

  const assigned = new Map<string, ReleasePrRef[]>(ordered.map((release) => [release.id, []]));

  for (const pr of pulls) {
    if (DEFAULT_BRANCHES.has(pr.headRef) && !DEFAULT_BRANCHES.has(pr.baseRef)) continue;

    const merged = Date.parse(pr.mergedAt);
    const id =
      listedBy.get(pr.number) ??
      ordered.find((release) => Date.parse(release.publishedAt) >= merged)?.id;

    if (id)
      assigned
        .get(id)!
        .push({ number: pr.number, title: pr.title, url: pr.url, author: pr.author });
  }

  for (const refs of assigned.values()) refs.sort((x, y) => y.number - x.number);

  return assigned;
}

export type StoredReleaseFields = Pick<
  ParsedReleaseBody,
  "summary" | "added" | "improved" | "fixed" | "breaking" | "security"
> & { prRefs: ReleasePrRef[] };

/**
 * What a stored release becomes when its body is parsed again, or null when nothing changes.
 * Entries synced before the parser learned about rules, intros and PR lists are repaired this
 * way without re-fetching anything from GitHub.
 */
export function reparseStoredRelease(
  body: string | null,
  stored: StoredReleaseFields,
  repoUrl: string,
): StoredReleaseFields | null {
  const parsed = parseReleaseBody(body);

  const next: StoredReleaseFields = {
    summary: parsed.summary,
    added: parsed.added,
    improved: parsed.improved,
    fixed: parsed.fixed,
    breaking: parsed.breaking,
    security: parsed.security,
    prRefs: unionPullRequests(stored.prRefs, listedPullRequests(parsed.pullRequests, repoUrl)),
  };

  const same =
    samePullRequests(next.prRefs, stored.prRefs) &&
    (["summary", "added", "improved", "fixed", "breaking", "security"] as const).every(
      (key) => JSON.stringify(next[key]) === JSON.stringify(stored[key]),
    );

  return same ? null : next;
}
