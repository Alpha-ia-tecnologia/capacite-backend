import { Octokit } from "@octokit/rest";
import type { Finding, Verdict } from "./schemas";

// ═══════════════════════════════════════════
// Octokit wrapper for the code-review agent
// ═══════════════════════════════════════════

export interface RepoRef {
  owner: string;
  repo: string;
}

export function parseRepo(slug: string): RepoRef {
  const [owner, repo] = slug.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repo slug "${slug}", expected "owner/repo"`);
  }
  return { owner, repo };
}

export function makeClient(token: string): Octokit {
  if (!token) throw new Error("GITHUB_TOKEN is empty; cannot talk to GitHub");
  return new Octokit({ auth: token });
}

export interface PrMetadata {
  number: number;
  title: string;
  body: string | null;
  author: string;
  baseRef: string;
  headRef: string;
  baseSha: string;
  headSha: string;
  state: string;
  draft: boolean;
}

export async function getPrMetadata(
  client: Octokit,
  ref: RepoRef,
  prNumber: number,
): Promise<PrMetadata> {
  const { data } = await client.pulls.get({ ...ref, pull_number: prNumber });
  return {
    number: data.number,
    title: data.title,
    body: data.body,
    author: data.user?.login ?? "unknown",
    baseRef: data.base.ref,
    headRef: data.head.ref,
    baseSha: data.base.sha,
    headSha: data.head.sha,
    state: data.state,
    draft: !!data.draft,
  };
}

export interface PrFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export async function listPrFiles(
  client: Octokit,
  ref: RepoRef,
  prNumber: number,
): Promise<PrFile[]> {
  const files: PrFile[] = [];
  // Paginate so we capture all changed files even on big PRs.
  for await (const page of client.paginate.iterator(client.pulls.listFiles, {
    ...ref,
    pull_number: prNumber,
    per_page: 100,
  })) {
    for (const f of page.data) {
      files.push({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: f.patch,
      });
    }
  }
  return files;
}

export async function readFileAtRef(
  client: Octokit,
  ref: RepoRef,
  path: string,
  sha: string,
): Promise<string> {
  const { data } = await client.repos.getContent({ ...ref, path, ref: sha });
  if (Array.isArray(data) || data.type !== "file") {
    throw new Error(`Path "${path}" at ${sha} is not a file`);
  }
  // GitHub returns base64-encoded content for files.
  const content = (data as any).content as string;
  const encoding = (data as any).encoding as string;
  if (encoding !== "base64") {
    throw new Error(`Unexpected encoding "${encoding}" for ${path}`);
  }
  return Buffer.from(content, "base64").toString("utf8");
}

/**
 * Parse a unified diff patch into hunks with the new-side starting line.
 * Used so the agent can ask for line numbers on the NEW side without
 * re-implementing diff parsing inside its prompt.
 */
export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  /** Raw hunk body lines, including the leading +/-/space marker. */
  lines: string[];
}

export function parseHunks(patch: string | undefined): DiffHunk[] {
  if (!patch) return [];
  const hunks: DiffHunk[] = [];
  const headerRe = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
  let current: DiffHunk | null = null;
  for (const line of patch.split("\n")) {
    const m = line.match(headerRe);
    if (m) {
      if (current) hunks.push(current);
      current = {
        oldStart: parseInt(m[1], 10),
        oldLines: m[2] ? parseInt(m[2], 10) : 1,
        newStart: parseInt(m[3], 10),
        newLines: m[4] ? parseInt(m[4], 10) : 1,
        lines: [],
      };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) hunks.push(current);
  return hunks;
}

/**
 * Map a finding's (file, line) to the diff position GitHub expects for
 * inline review comments. Returns null when the line isn't part of the diff
 * — in that case the agent's comment becomes part of the top-level review body
 * instead of an inline comment.
 */
export function findingToDiffPosition(
  hunks: DiffHunk[],
  newLine: number,
): number | null {
  let position = 0;
  for (const h of hunks) {
    let cursor = h.newStart;
    for (const raw of h.lines) {
      position += 1;
      if (raw.startsWith("-")) continue; // old-side only, doesn't advance new cursor
      if (cursor === newLine && !raw.startsWith("-")) {
        return position;
      }
      cursor += 1;
    }
    // +1 in `position` was already advanced per line; the hunk header itself
    // doesn't count as a position, so nothing to add between hunks.
  }
  return null;
}

export interface PostReviewArgs {
  ref: RepoRef;
  prNumber: number;
  headSha: string;
  verdict: Verdict;
  summary: string;
  inlineComments: Array<{ path: string; position: number; body: string }>;
  trailingBody: string;
}

export async function postReview(
  client: Octokit,
  args: PostReviewArgs,
): Promise<{ id: number; htmlUrl: string }> {
  const event =
    args.verdict === "APPROVE"
      ? "APPROVE"
      : args.verdict === "REQUEST_CHANGES"
      ? "REQUEST_CHANGES"
      : "COMMENT";

  const body = [args.summary, args.trailingBody].filter(Boolean).join("\n\n");

  const { data } = await client.pulls.createReview({
    owner: args.ref.owner,
    repo: args.ref.repo,
    pull_number: args.prNumber,
    commit_id: args.headSha,
    event,
    body,
    comments: args.inlineComments,
  });

  return { id: data.id, htmlUrl: data.html_url };
}
