import type { Finding } from "./rules.ts";

const PROHIBITED = /\bASD(?:-STE100)?\s+(certified|approved|certification)\b/i;

export function checkClaims(input: {
  path: string;
  line: number;
  column: number;
  text: string;
}): Array<Finding> {
  if (!PROHIBITED.test(input.text)) {
    return [];
  }
  return [
    {
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "T10",
      message: "prohibited ASD approval or certification claim.",
    },
  ];
}
