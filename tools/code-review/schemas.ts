import { z } from "zod";

// ═══════════════════════════════════════════
// Schemas for the code-review agent output
// ═══════════════════════════════════════════

export const SeverityEnum = z.enum(["critical", "major", "minor", "nit"]);
export type Severity = z.infer<typeof SeverityEnum>;

export const CategoryEnum = z.enum([
  "bug",
  "security",
  "perf",
  "design",
  "style",
  "test",
  "docs",
]);
export type Category = z.infer<typeof CategoryEnum>;

export const VerdictEnum = z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]);
export type Verdict = z.infer<typeof VerdictEnum>;

export const FindingSchema = z.object({
  severity: SeverityEnum,
  category: CategoryEnum,
  file: z.string().describe("Path of the file relative to repo root"),
  line: z.number().int().positive().describe("New-side line number where the issue lives"),
  body: z.string().describe("Concise explanation of the issue (1-3 sentences)"),
  suggestion: z.string().optional().describe("Concrete fix; if a code block, use a markdown ```suggestion fence"),
});
export type Finding = z.infer<typeof FindingSchema>;

export const ReviewResultSchema = z.object({
  summary: z.string().describe("High-level summary of the PR and the review"),
  verdict: VerdictEnum,
  findings: z.array(FindingSchema),
});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

/**
 * Derive a verdict from a list of findings using the project convention:
 *   - any `critical` or `major` → REQUEST_CHANGES
 *   - only `minor` / `nit`      → COMMENT
 *   - empty                     → APPROVE
 */
export function deriveVerdict(findings: Finding[]): Verdict {
  if (findings.some(f => f.severity === "critical" || f.severity === "major")) {
    return "REQUEST_CHANGES";
  }
  if (findings.length === 0) return "APPROVE";
  return "COMMENT";
}
