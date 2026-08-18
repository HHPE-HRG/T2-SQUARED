import type { Finding } from "./rules.ts";
import { isQualifiedTerm, type TechnicalTerm } from "./vocabulary.ts";

const TOKEN = /[A-Za-z][A-Za-z'-]*/g;
const DETERMINERS = new Set(["the", "a", "an", "this", "these"]);

export const IDENTIFIER_POLICY_RULE_ID = "T2-IDENTIFIER-projection";
export const TERM_CANONICAL_RULE_ID = "T2-TERM-canonical";

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

export interface IdentifierPolicyInput {
  path: string;
  line: number;
  column: number;
  text: string;
  technicalTerms: ReadonlyArray<TechnicalTerm>;
}

function tokenize(text: string): Array<{ token: string; index: number }> {
  const parts: Array<{ token: string; index: number }> = [];
  const re = new RegExp(TOKEN.source, TOKEN.flags);
  let match: RegExpExecArray | null = re.exec(text);
  while (match !== null) {
    parts.push({ token: match[0], index: match.index });
    match = re.exec(text);
  }
  return parts;
}

function tokens(text: string): Array<string> {
  return tokenize(text).map((part) => part.token);
}

function isSentenceStart(text: string, index: number): boolean {
  const before = text.slice(0, index);
  if (before.trim().length === 0) {
    return true;
  }
  return /[.!?]["')\]]*\s+$/.test(before);
}

function sentenceInitialCanonical(canonical: string): string {
  if (canonical.length === 0) {
    return canonical;
  }
  return canonical.charAt(0).toUpperCase() + canonical.slice(1);
}

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

function isIdentifierShape(token: string): boolean {
  return /[a-z][A-Z]/.test(token) || /[A-Z][a-z]+[A-Z]/.test(token);
}

function qualifiedCanonicalLemmas(terms: ReadonlyArray<TechnicalTerm>): Set<string> {
  return new Set(
    terms.filter((term) => isQualifiedTerm(term)).map((term) => term.term.toLowerCase()),
  );
}

function identifierBindings(terms: ReadonlyArray<TechnicalTerm>): Map<string, TechnicalTerm> {
  const bindings = new Map<string, TechnicalTerm>();
  for (const term of terms) {
    if (!isQualifiedTerm(term)) {
      continue;
    }
    const canonical = term.term.toLowerCase();
    for (const form of derivedIdentifierForms(term.term)) {
      const key = form.toLowerCase();
      if (key === canonical) {
        continue;
      }
      bindings.set(key, term);
    }
    const software = term.softwareForms;
    if (software === undefined) {
      continue;
    }
    for (const value of [software.typescriptType, software.typescriptValue, software.cli]) {
      if (value === undefined || value.length === 0) {
        continue;
      }
      const key = value.toLowerCase();
      if (key === canonical) {
        continue;
      }
      bindings.set(key, term);
    }
  }
  return bindings;
}

function isIdentifierToken(token: string, bindings: ReadonlyMap<string, TechnicalTerm>): boolean {
  return bindings.has(token.toLowerCase()) || isIdentifierShape(token);
}

export function unapprovedTokenMessage(token: string): string {
  return `word "${token}" is not in the approved set.`;
}

export function unboundIdentifierMessage(token: string): string {
  return `T2 identifier "${token}" is not bound to a qualified concept.`;
}

export function noncanonicalTermMessage(token: string, canonical: string): string {
  return `prose "${token}" is not the canonical human form "${canonical}".`;
}

export function checkVocabularyMembership(input: MembershipInput): Array<Finding> {
  const allowed = new Set(
    [...input.approvedWords, ...qualifiedCanonicalLemmas(input.technicalTerms)].map((word) =>
      word.toLowerCase(),
    ),
  );
  const bindings = identifierBindings(input.technicalTerms);
  const findings: Array<Finding> = [];
  for (const token of tokens(input.text)) {
    if (isIdentifierToken(token, bindings)) {
      continue;
    }
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

export function checkIdentifierPolicy(input: IdentifierPolicyInput): Array<Finding> {
  const bindings = identifierBindings(input.technicalTerms);
  const findings: Array<Finding> = [];
  for (const token of tokens(input.text)) {
    const key = token.toLowerCase();
    if (bindings.has(key)) {
      continue;
    }
    if (!isIdentifierShape(token)) {
      continue;
    }
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: IDENTIFIER_POLICY_RULE_ID,
      message: unboundIdentifierMessage(token),
    });
  }
  return findings;
}

export function checkCanonicalTermForm(input: IdentifierPolicyInput): Array<Finding> {
  const canonicalByLemma = new Map<string, string>();
  for (const term of input.technicalTerms) {
    if (!isQualifiedTerm(term)) {
      continue;
    }
    canonicalByLemma.set(term.term.toLowerCase(), term.term);
  }
  const findings: Array<Finding> = [];
  for (const part of tokenize(input.text)) {
    if (isIdentifierShape(part.token)) {
      continue;
    }
    const canonical = canonicalByLemma.get(part.token.toLowerCase());
    if (canonical === undefined || part.token === canonical) {
      continue;
    }
    if (
      isSentenceStart(input.text, part.index) &&
      part.token === sentenceInitialCanonical(canonical)
    ) {
      continue;
    }
    findings.push({
      path: input.path,
      line: input.line,
      column: input.column,
      ruleId: TERM_CANONICAL_RULE_ID,
      message: noncanonicalTermMessage(part.token, canonical),
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
    terms
      .filter((term) => term.kind === "noun" && isQualifiedTerm(term))
      .map((term) => term.term.toLowerCase()),
  );
}

export function approvedWordSet(words: ReadonlyArray<string>): Set<string> {
  return new Set(words.map((word) => word.toLowerCase()));
}

export function checkMembershipAndIdentification(
  input: MembershipInput & ArticleInput,
): Array<Finding> {
  return [
    ...checkVocabularyMembership(input),
    ...checkArticleBeforeNoun(input),
    ...checkIdentifierPolicy(input),
    ...checkCanonicalTermForm(input),
  ];
}
