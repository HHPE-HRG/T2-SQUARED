import { readFileSync } from "node:fs";
import path from "node:path";

import {
  checkArticleBeforeNoun,
  checkVocabularyMembership,
  type ArticleInput,
  type MembershipInput,
} from "./membership.ts";
import { checkMechanicalRules, type Finding, type RuleInput } from "./rules.ts";
import type { AsdRuleMapping } from "./vocabulary.ts";

export const ASD_RULE_PREFIX = "ASD-STE100-";

export type EnforcedCheckerId =
  | "vocabulary-membership"
  | "article-before-noun"
  | "procedural-sentence-word-count"
  | "descriptive-sentence-word-count"
  | "paragraph-sentence-count";

export interface EnforcedCheckerInput extends RuleInput {
  approvedWords?: MembershipInput["approvedWords"];
  technicalTerms?: MembershipInput["technicalTerms"];
  knownNouns?: ArticleInput["knownNouns"];
}

export interface EnforcedChecker {
  id: EnforcedCheckerId;
  asdId: string;
  check: (input: EnforcedCheckerInput) => Array<Finding>;
}

function asdFindings(input: RuleInput, asdId: string): Array<Finding> {
  return checkMechanicalRules(input).filter(
    (finding) => finding.ruleId === `${ASD_RULE_PREFIX}${asdId}`,
  );
}

export const ENFORCED_CHECKERS: Record<EnforcedCheckerId, EnforcedChecker> = {
  "vocabulary-membership": {
    id: "vocabulary-membership",
    asdId: "1.1",
    check: (input) =>
      checkVocabularyMembership({
        path: input.path,
        line: input.line,
        column: input.column,
        text: input.text,
        approvedWords: input.approvedWords ?? new Set(),
        technicalTerms: input.technicalTerms ?? [],
      }),
  },
  "article-before-noun": {
    id: "article-before-noun",
    asdId: "4.5",
    check: (input) =>
      checkArticleBeforeNoun({
        path: input.path,
        line: input.line,
        column: input.column,
        text: input.text,
        knownNouns: input.knownNouns ?? new Set(),
      }),
  },
  "procedural-sentence-word-count": {
    id: "procedural-sentence-word-count",
    asdId: "5.1",
    check: (input) => asdFindings({ ...input, kind: "procedural" }, "5.1"),
  },
  "descriptive-sentence-word-count": {
    id: "descriptive-sentence-word-count",
    asdId: "6.3",
    check: (input) => asdFindings({ ...input, kind: "descriptive" }, "6.3"),
  },
  "paragraph-sentence-count": {
    id: "paragraph-sentence-count",
    asdId: "6.6",
    check: (input) => asdFindings(input, "6.6"),
  },
};

export function enforcedChecker(checkerId: string): EnforcedChecker {
  const checker = ENFORCED_CHECKERS[checkerId as EnforcedCheckerId];
  if (checker === undefined) {
    throw new Error(`unregistered checker: ${checkerId}`);
  }
  return checker;
}

export function registeredAsdIds(): Array<string> {
  return Object.values(ENFORCED_CHECKERS).map((checker) => checker.asdId);
}

export function loadLiveRuleMappings(root: string): Array<AsdRuleMapping> {
  const parsed = JSON.parse(readFileSync(path.join(root, "t2.asd-ste100.rules.json"), "utf8")) as {
    rules?: Array<AsdRuleMapping>;
  };
  return parsed.rules ?? [];
}

export function assertLiveRulesMatchEnforcedCheckers(rules: ReadonlyArray<AsdRuleMapping>): void {
  for (const rule of rules) {
    if (rule.checker === undefined) {
      throw new Error(`unregistered checker: (missing)`);
    }
    const checker = ENFORCED_CHECKERS[rule.checker as EnforcedCheckerId];
    if (checker === undefined) {
      throw new Error(`unregistered checker: ${rule.checker}`);
    }
    if (checker.asdId !== rule.id) {
      throw new Error(`checker ${rule.checker} binds ${checker.asdId}, profile lists ${rule.id}`);
    }
  }
  for (const checker of Object.values(ENFORCED_CHECKERS)) {
    if (!rules.some((rule) => rule.checker === checker.id)) {
      throw new Error(`enforced checker missing from live profile: ${checker.id}`);
    }
  }
}
