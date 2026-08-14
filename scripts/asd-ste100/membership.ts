import type { Finding } from "./rules.ts";
import type { TechnicalTerm } from "./vocabulary.ts";

const TOKEN = /[A-Za-z][A-Za-z'-]*/g;
const DETERMINERS = new Set(["the", "a", "an", "this", "these"]);

export interface MembershipInput {
  path: string;
  line: number;
  column: number;
  text: string;
  approvedWords: ReadonlySet<string>;
  technicalTerms: ReadonlyArray<TechnicalTerm>;
}

export interface ArticleInput {
  path: string;
  line: number;
  column: number;
  text: string;
  knownNouns: ReadonlySet<string>;
}

function tokens(text: string): Array<string> {
  return text.match(TOKEN) ?? [];
}

function technicalNames(terms: ReadonlyArray<TechnicalTerm>): Set<string> {
  return new Set(terms.map((term) => term.term.toLowerCase()));
}

export function checkVocabularyMembership(input: MembershipInput): Array<Finding> {
  const allowed = new Set(
    [...input.approvedWords, ...technicalNames(input.technicalTerms)].map((word) =>
      word.toLowerCase(),
    ),
  );
  const findings: Array<Finding> = [];
  for (const token of tokens(input.text)) {
    const key = token.toLowerCase();
    if (allowed.has(key)) {
      continue;
    }
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "ASD-STE100-1.1",
      message: `word "${token}" is not in the approved set.`,
    });
  }
  return findings;
}

export function checkArticleBeforeNoun(input: ArticleInput): Array<Finding> {
  const findings: Array<Finding> = [];
  const parts = tokens(input.text);
  for (let index = 0; index < parts.length; index += 1) {
    const word = parts[index]?.toLowerCase();
    if (word === undefined || !input.knownNouns.has(word)) {
      continue;
    }
    const previous = parts[index - 1]?.toLowerCase();
    if (previous !== undefined && DETERMINERS.has(previous)) {
      continue;
    }
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: "ASD-STE100-4.5",
      message: `known noun "${parts[index]}" needs an article or demonstrative.`,
    });
  }
  return findings;
}

export function knownNounsFromTerms(terms: ReadonlyArray<TechnicalTerm>): Set<string> {
  return new Set(
    terms.filter((term) => term.kind === "noun").map((term) => term.term.toLowerCase()),
  );
}

export function approvedWordSet(words: ReadonlyArray<string>): Set<string> {
  return new Set(words.map((word) => word.toLowerCase()));
}

export function checkMembershipAndIdentification(input: MembershipInput & ArticleInput): Array<Finding> {
  return [
    ...checkVocabularyMembership(input),
    ...checkArticleBeforeNoun(input),
  ];
}
