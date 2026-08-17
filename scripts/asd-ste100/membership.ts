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

// T2 policy: a hyphenated term also matches its camel and Pascal code forms.
function derivedIdentifierForms(term: string): Array<string> {
  const forms = [term];
  if (!/[-_]/.test(term)) {
    return forms;
  }
  const parts = term.split(/[-_]/).filter((part) => part.length > 0);
  if (parts.length < 2) {
    return forms;
  }
  const pascal = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
  const camel = pascal.charAt(0).toLowerCase() + pascal.slice(1);
  forms.push(pascal, camel);
  return forms;
}

function technicalNames(terms: ReadonlyArray<TechnicalTerm>): Set<string> {
  const names = new Set<string>();
  for (const term of terms) {
    for (const form of derivedIdentifierForms(term.term)) {
      names.add(form.toLowerCase());
    }
    const software = term.softwareForms;
    if (software === undefined) {
      continue;
    }
    for (const value of [software.typescriptType, software.typescriptValue, software.cli]) {
      if (value !== undefined && value.length > 0) {
        names.add(value.toLowerCase());
      }
    }
  }
  return names;
}

export function unapprovedTokenMessage(token: string): string {
  return `word "${token}" is not in the approved set.`;
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
      message: unapprovedTokenMessage(token),
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

export function checkMembershipAndIdentification(
  input: MembershipInput & ArticleInput,
): Array<Finding> {
  return [...checkVocabularyMembership(input), ...checkArticleBeforeNoun(input)];
}
