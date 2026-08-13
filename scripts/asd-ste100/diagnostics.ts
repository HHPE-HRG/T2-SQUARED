import type { Finding } from "./rules.ts";

export function formatDiagnostic(finding: Finding): string {
  return `${finding.path}:${finding.line}:${finding.column} ${finding.ruleId} ${finding.message}`;
}
