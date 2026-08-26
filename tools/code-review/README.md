# Code Review Agent (LangGraph)

Internal dev tool. Reuses the backend's LangGraph + DeepSeek stack to review pull requests on this repo. **Not part of the Envisionar product runtime** — lives outside `src/` and is excluded from the production build.

## How it works

A LangGraph ReAct agent with four tools:

| Tool                | What it does                                                |
| ------------------- | ----------------------------------------------------------- |
| `get_pr_metadata`   | Title, body, author, base/head ref of the PR                |
| `list_pr_files`     | Files changed (status, additions, deletions; no diff body)  |
| `get_diff_hunks`    | Parsed unified-diff hunks for one file, with line numbers   |
| `read_file_at_head` | Full file content at the PR head SHA, capped at 12k chars   |

The agent walks the PR, produces structured findings (severity + category + file/line + suggestion), and the CLI either prints them or posts them as a GitHub review.

## Setup

1. Install deps (once, after pulling these changes):
   ```bash
   cd backend
   npm install
   ```

2. Add to `backend/.env`:
   ```env
   GITHUB_TOKEN=ghp_yourFreshlyRotatedToken
   # Optional — defaults to Alpha-ia-tecnologia/capacite-backend
   GITHUB_REPO=Alpha-ia-tecnologia/capacite-backend
   ```

   The PAT needs at minimum:
   - **Contents: Read** (to fetch file contents and diffs)
   - **Pull requests: Read & Write** (Write only required for `--post`)

3. `DEEPSEEK_API_KEY` and `DEEPSEEK_BASE_URL` are already configured for the rest of the backend; the agent reuses them.

## Usage

Dry-run — prints findings and writes `code-review-<pr>.json`:
```bash
npm run review -- 42
```

Override the target repo:
```bash
npm run review -- 42 --repo Alpha-ia-tecnologia/some-other-repo
```

Actually submit the review to GitHub (inline comments + verdict):
```bash
npm run review -- 42 --post
```

## Verdict policy

- any `critical` or `major` finding → **REQUEST_CHANGES**
- only `minor` / `nit`              → **COMMENT**
- zero findings                     → **APPROVE**

The CLI recomputes the verdict from findings even if the model disagrees with its own rubric.

## When findings live outside the diff

If a finding's line isn't part of the PR's diff (e.g. the agent flags an existing helper), the comment can't be posted inline. Those go into an "Out-of-diff findings" section appended to the review body so you don't lose them.

## Files

```
tools/code-review/
├── graph.ts      # LangGraph agent + 4 tools (mirrors the createLLM pattern in services/langgraph.service.ts)
├── github.ts     # Octokit wrapper + diff parsing
├── schemas.ts    # zod: Finding, ReviewResult, deriveVerdict()
├── run.ts        # CLI entry point
└── README.md
```
