import { ChatOpenAI } from "@langchain/openai";
// @ts-ignore - TS cannot resolve export map using default node resolution
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { env } from "../../src/config/env";
import {
  makeClient,
  getPrMetadata,
  listPrFiles,
  readFileAtRef,
  parseHunks,
  type RepoRef,
} from "./github";
import { ReviewResultSchema, type ReviewResult } from "./schemas";

// ═══════════════════════════════════════════
// LLM factory — mirrors backend/src/services/langgraph.service.ts
// ═══════════════════════════════════════════

function createLLM(temperature = 0.2) {
  return new ChatOpenAI({
    model: "deepseek-chat",
    temperature,
    configuration: { baseURL: env.DEEPSEEK_BASE_URL },
    apiKey: env.DEEPSEEK_API_KEY,
    maxTokens: 4000,
  });
}

// ═══════════════════════════════════════════
// Agent tools (bound to a specific PR + GitHub client)
// ═══════════════════════════════════════════

function buildTools(ref: RepoRef, prNumber: number, headSha: string) {
  const client = makeClient(env.GITHUB_TOKEN);

  const getMetadata = tool(
    async () => {
      const md = await getPrMetadata(client, ref, prNumber);
      return JSON.stringify({
        number: md.number,
        title: md.title,
        body: md.body,
        author: md.author,
        baseRef: md.baseRef,
        headRef: md.headRef,
        state: md.state,
        draft: md.draft,
      });
    },
    {
      name: "get_pr_metadata",
      description:
        "Returns title, body, author, base branch, head branch and draft status of the PR under review. Call once at the start to ground yourself in the PR's intent.",
      schema: z.object({}),
    },
  );

  const listFiles = tool(
    async () => {
      const files = await listPrFiles(client, ref, prNumber);
      // Strip the patch field from this overview tool — it's huge. Use
      // `get_diff_hunks` per file when you need the actual changes.
      return JSON.stringify(
        files.map(f => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
        })),
      );
    },
    {
      name: "list_pr_files",
      description:
        "Lists all files changed in the PR with status and line counts (no diff content). Use this first to decide which files deserve a deeper look.",
      schema: z.object({}),
    },
  );

  const getDiffHunks = tool(
    async ({ filename }) => {
      const files = await listPrFiles(client, ref, prNumber);
      const file = files.find(f => f.filename === filename);
      if (!file) return `File "${filename}" is not part of PR #${prNumber}.`;
      if (!file.patch) {
        return `File "${filename}" has no patch (binary, renamed only, or too large).`;
      }
      const hunks = parseHunks(file.patch);
      return JSON.stringify(
        hunks.map(h => ({
          oldStart: h.oldStart,
          oldLines: h.oldLines,
          newStart: h.newStart,
          newLines: h.newLines,
          body: h.lines.join("\n"),
        })),
      );
    },
    {
      name: "get_diff_hunks",
      description:
        "Returns the parsed diff hunks of a single file with old/new starting line numbers and the raw +/-/context body. Use this to find concrete issues — the `newStart` plus the offset of a `+` line gives you the line number to attach a finding to.",
      schema: z.object({
        filename: z.string().describe("Path of the file as returned by list_pr_files"),
      }),
    },
  );

  const readFile = tool(
    async ({ path }) => {
      try {
        const content = await readFileAtRef(client, ref, path, headSha);
        // Cap at ~12k chars to keep the model honest about scope.
        if (content.length > 12000) {
          return content.slice(0, 12000) + "\n\n[... truncated; file exceeds 12k chars ...]";
        }
        return content;
      } catch (err: any) {
        return `Could not read "${path}" at ${headSha.slice(0, 7)}: ${err.message ?? err}`;
      }
    },
    {
      name: "read_file_at_head",
      description:
        "Returns the full content of a file as it exists at the PR head commit. Use sparingly — only when the diff alone doesn't give you enough context (e.g. understanding a helper called from the changed code).",
      schema: z.object({
        path: z.string().describe("Path of the file relative to repo root"),
      }),
    },
  );

  return [getMetadata, listFiles, getDiffHunks, readFile];
}

// ═══════════════════════════════════════════
// Public entry point
// ═══════════════════════════════════════════

export interface RunReviewArgs {
  ref: RepoRef;
  prNumber: number;
  headSha: string;
}

const SYSTEM_PROMPT = `You are a senior code reviewer for a TypeScript/Node.js backend (Express + Prisma + LangGraph + DeepSeek). You review pull requests carefully and report your findings as structured JSON.

REVIEW WORKFLOW (do this in order):
1. Call get_pr_metadata to understand intent.
2. Call list_pr_files to get the change surface.
3. For every file that looks important (skip auto-generated, lockfiles, vendored), call get_diff_hunks.
4. When the diff alone isn't enough to judge correctness, call read_file_at_head on the same file — but only when needed; favor terse reviews.
5. Compose findings.

WHAT TO LOOK FOR (priority order):
- bugs / correctness errors / null-deref / unhandled promise rejections
- security: leaked secrets, missing auth checks on routes, SQL injection, SSRF, prototype pollution
- performance: N+1 queries, O(n²) loops on hot paths, missing indexes
- design: wrong layering (e.g. business logic in routes), duplicated code, dead code
- tests: missing tests for new behavior (only flag if the repo has a test pattern already)
- style/typos: ONLY as severity "nit"; skip if low-signal

SEVERITY RULES:
- critical: shipping this breaks prod or leaks data
- major: a real bug or design problem that should block merge
- minor: real issue, but not blocking
- nit: subjective / cosmetic

OUTPUT FORMAT (this is non-negotiable):
Respond with ONE JSON object only — no markdown fences, no prose, no preamble. Schema:
{
  "summary": "2-4 sentence overview of the PR and the review",
  "verdict": "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  "findings": [
    {
      "severity": "critical" | "major" | "minor" | "nit",
      "category": "bug" | "security" | "perf" | "design" | "style" | "test" | "docs",
      "file": "<path from list_pr_files>",
      "line": <new-side line number>,
      "body": "Concise explanation (1-3 sentences)",
      "suggestion": "(optional) concrete fix; for code use a \\\`\\\`\\\`suggestion fenced block"
    }
  ]
}

Pick verdict like this:
- any critical or major finding → "REQUEST_CHANGES"
- only minor/nit findings → "COMMENT"
- zero findings → "APPROVE"

Do NOT invent files, lines, or quote diff content you didn't actually fetch via the tools.`;

export async function runReview(args: RunReviewArgs): Promise<ReviewResult> {
  const tools = buildTools(args.ref, args.prNumber, args.headSha);

  const agent = createReactAgent({
    llm: createLLM(0.2),
    tools,
  });

  const result = await agent.invoke({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Review PR #${args.prNumber} in ${args.ref.owner}/${args.ref.repo}. Head SHA: ${args.headSha}.`,
      },
    ],
  });

  const raw = result.messages[result.messages.length - 1].content as string;
  const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Agent did not return valid JSON. Raw output:\n${raw.slice(0, 2000)}`,
    );
  }

  // Zod-validate so a misbehaving model can't blow up downstream code.
  return ReviewResultSchema.parse(parsed);
}
