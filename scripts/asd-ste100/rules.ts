export interface Finding {
  path: string;
  line: number;
  column: number;
  ruleId: string;
  message: string;
}

export interface RuleInput {
  path: string;
  line: number;
  column: number;
  text: string;
  kind: "procedural" | "descriptive";
}

function wordCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

function sentenceCount(text: string): number {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return sentences.length;
}

export function checkMechanicalRules(input: RuleInput): Array<Finding> {
  const findings: Array<Finding> = [];
  const words = wordCount(input.text);
  if (input.kind === "procedural" && words > 20) {
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "ASD-STE100-5.1",
      message: `sentence has ${words} words. Maximum is 20.`,
    });
  }
  if (input.kind === "descriptive" && words > 25) {
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "ASD-STE100-6.3",
      message: `sentence has ${words} words. Maximum is 25.`,
    });
  }
  const sentences = sentenceCount(input.text);
  if (sentences > 6) {
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "ASD-STE100-6.6",
      message: `paragraph has ${sentences} sentences. Maximum is 6.`,
    });
  }
  if (/\b(?:[A-Za-z]+n't|it's|that's|can't|won't)\b/i.test(input.text)) {
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "T2-HEURISTIC-contraction",
      message: "contraction is not permitted in governed prose.",
    });
  }
  if (input.text.includes(";")) {
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "T2-HEURISTIC-semicolon",
      message: "semicolon is not permitted in governed prose.",
    });
  }
  if (
    /\b(?:is|are|was|were|be|been|being)\s+(?:\w+ed|written|done|made|given|taken)\b/i.test(
      input.text,
    )
  ) {
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "T2-HEURISTIC-passive",
      message: "passive construction is a candidate for rewrite.",
    });
  }
  if (/\b(?:colour|centre|organise|organisation|defence|licence)\b/i.test(input.text)) {
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "T2-HEURISTIC-spelling",
      message: "non-American spelling is not permitted in governed prose.",
    });
  }
  if (/\bthe\s+\w+ing\s+of\b/i.test(input.text)) {
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "T2-HEURISTIC-verb-form",
      message: "this verb form is not permitted as a noun.",
    });
  }
  return findings;
}
