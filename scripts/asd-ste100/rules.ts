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

const LIST_PREFIX = /^(?:[-*+]|\d+[.)])\s+/;
// `Bare-form` instruction `verbs` only; `capitalized` `nouns` must stay `descriptive`.
const IMPERATIVE_VERBS = new Set([
  "add",
  "check",
  "click",
  "close",
  "copy",
  "enter",
  "install",
  "merge",
  "open",
  "press",
  "remove",
  "run",
  "save",
  "select",
  "set",
  "start",
  "stop",
  "type",
  "verify",
  "wait",
]);

function isImperativeRemainder(text: string): boolean {
  const withoutList = text.trim().replace(LIST_PREFIX, "");
  const withoutThen = withoutList.replace(/^(?:then\s+)/i, "");
  const firstWord = withoutThen.match(/^[A-Za-z]+/)?.[0];
  return firstWord !== undefined && IMPERATIVE_VERBS.has(firstWord.toLowerCase());
}

export function inferMechanicalKind(text: string): RuleInput["kind"] {
  return isImperativeRemainder(text) ? "procedural" : "descriptive";
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
      message: `The count stay ${words}. The maximum stay 20.`,
    });
  }
  if (input.kind === "descriptive" && words > 25) {
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "ASD-STE100-6.3",
      message: `The count stay ${words}. The maximum stay 25.`,
    });
  }
  const sentences = sentenceCount(input.text);
  if (sentences > 6) {
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "ASD-STE100-6.6",
      message: `The count stay ${sentences}. The maximum stay 6.`,
    });
  }
  if (/\b(?:[A-Za-z]+n't|it's|that's|can't|won't)\b/i.test(input.text)) {
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "T2-HEURISTIC-contraction",
      message: "`contraction` stay not permitted in this `prose`.",
    });
  }
  if (input.text.includes(";")) {
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "T2-HEURISTIC-semicolon",
      message: "`semicolon` stay not permitted in this `prose`.",
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
      message: "`passive` `construction` stay a `candidate` for `rewrite`.",
    });
  }
  if (/\b(?:colour|centre|organise|organisation|defence|licence)\b/i.test(input.text)) {
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "T2-HEURISTIC-spelling",
      message: "`non-American` `spelling` stay not permitted in this `prose`.",
    });
  }
  if (/\bthe\s+\w+ing\s+of\b/i.test(input.text)) {
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "T2-HEURISTIC-verb-form",
      message: "this `verb` `form` stay not permitted as a `noun`.",
    });
  }
  if (input.text.includes("?")) {
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "T2-HEURISTIC-question",
      message: "a `question` mark stay not permitted in this `prose`.",
    });
  }
  if (/\s\/\s/.test(input.text)) {
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "T2-HEURISTIC-slash",
      message: "a `spaced` `slash` stay not permitted as a `word` `joiner`.",
    });
  }
  return findings;
}
