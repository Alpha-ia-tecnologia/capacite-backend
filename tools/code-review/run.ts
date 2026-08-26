/**
 * CLI entry point for the LangGraph code-review agent.
 *
 *   npm run review -- <pr_number>            # dry-run; writes code-review-<pr>.json
 *   npm run review -- <pr_number> --post     # also submits the review to GitHub
 *   npm run review -- <pr_number> --repo owner/name
 *
 * The PAT is read from process.env.GITHUB_TOKEN — never hardcode it.
 */
import { writeFileSync } from "node:fs";
import { env } from "../../src/config/env";
import {
  parseRepo,
  makeClient,
  getPrMetadata,
  listPrFiles,
  parseHunks,
  findingToDiffPosition,
  postReview,
} from "./github";
import { runReview } from "./graph";
import { deriveVerdict, type Finding } from "./schemas";

interface CliArgs {
  prNumber: number;
  repoSlug: string;
  post: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  // argv comes in as positional + flags; PR number is the first positional.
  let prNumber: number | null = null;
  let repoSlug = env.GITHUB_REPO;
  let post = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--post") {
      post = true;
    } else if (a === "--repo") {
      repoSlug = argv[++i] ?? repoSlug;
    } else if (/^\d+$/.test(a)) {
      prNumber = parseInt(a, 10);
    } else {
      throw new Error(`Unknown argument "${a}"`);
    }
  }

  if (prNumber === null) {
    throw new Error(
      "Usage: npm run review -- <pr_number> [--repo owner/name] [--post]",
    );
  }
  if (!repoSlug) {
    throw new Error(
      "Repo not configured. Set GITHUB_REPO in .env or pass --repo owner/name.",
    );
  }
  return { prNumber, repoSlug, post };
}

function formatFinding(f: Finding): string {
  const sev = f.severity.toUpperCase().padEnd(8);
  const cat = `[${f.category}]`.padEnd(10);
  return `  ${sev} ${cat} ${f.file}:${f.line}\n    ${f.body}${
    f.suggestion ? `\n    └─ suggestion: ${f.suggestion.replace(/\n/g, "\n       ")}` : ""
  }`;
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const ref = parseRepo(cli.repoSlug);

  if (!env.GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN is not set. Add it to backend/.env first.");
  }
  if (!env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY is not set. Add it to backend/.env first.");
  }

  const client = makeClient(env.GITHUB_TOKEN);
  console.log(`▶ Fetching PR #${cli.prNumber} from ${cli.repoSlug}…`);
  const md = await getPrMetadata(client, ref, cli.prNumber);
  console.log(`  ${md.title}  (by @${md.author}, ${md.state}${md.draft ? ", draft" : ""})`);

  console.log("▶ Running LangGraph review agent…");
  const review = await runReview({ ref, prNumber: cli.prNumber, headSha: md.headSha });

  // Recompute verdict from findings as a safety net — the model sometimes
  // disagrees with its own severity rubric.
  const derived = deriveVerdict(review.findings);
  if (derived !== review.verdict) {
    console.log(
      `  ⚠ Model returned verdict ${review.verdict}; recomputed to ${derived} from findings.`,
    );
    review.verdict = derived;
  }

  // Write the structured result to disk for inspection / CI consumption.
  const outFile = `code-review-${cli.prNumber}.json`;
  writeFileSync(outFile, JSON.stringify(review, null, 2));
  console.log(`▶ Wrote ${outFile}`);

  console.log(`\n── Summary ─────────────────────────────────────`);
  console.log(review.summary);
  console.log(`── Verdict: ${review.verdict} ─────────────────`);
  if (review.findings.length === 0) {
    console.log("(no findings)");
  } else {
    for (const f of review.findings) console.log(formatFinding(f));
  }
  console.log();

  if (!cli.post) {
    console.log("Dry-run only. Re-run with --post to submit this review to GitHub.");
    return;
  }

  // Build inline comments: only findings whose line falls inside the diff
  // can be posted inline. Everything else goes into the trailing body so
  // we don't lose the signal.
  console.log("▶ Posting review to GitHub…");
  const files = await listPrFiles(client, ref, cli.prNumber);
  const hunksByFile = new Map(files.map(f => [f.filename, parseHunks(f.patch)]));

  const inlineComments: Array<{ path: string; position: number; body: string }> = [];
  const orphans: Finding[] = [];

  for (const f of review.findings) {
    const hunks = hunksByFile.get(f.file);
    const position = hunks ? findingToDiffPosition(hunks, f.line) : null;
    if (position == null) {
      orphans.push(f);
      continue;
    }
    inlineComments.push({
      path: f.file,
      position,
      body: `**${f.severity.toUpperCase()} · ${f.category}**\n\n${f.body}${
        f.suggestion ? `\n\n${f.suggestion}` : ""
      }`,
    });
  }

  const trailingBody =
    orphans.length === 0
      ? ""
      : "### Out-of-diff findings\n\n" +
        orphans
          .map(
            f =>
              `- **${f.severity.toUpperCase()} · ${f.category}** \`${f.file}:${f.line}\` — ${f.body}`,
          )
          .join("\n");

  const posted = await postReview(client, {
    ref,
    prNumber: cli.prNumber,
    headSha: md.headSha,
    verdict: review.verdict,
    summary: review.summary,
    inlineComments,
    trailingBody,
  });
  console.log(`  ✓ Posted: ${posted.htmlUrl}`);
}

main().catch(err => {
  console.error("✗ Code review failed:", err.message ?? err);
  process.exit(1);
});
