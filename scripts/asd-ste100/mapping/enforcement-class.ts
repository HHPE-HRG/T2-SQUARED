import type { CheckerClass } from "./merge.ts";

export const ENFORCEMENT_CLASSES = [
  "deterministic",
  "parser-mechanical",
  "contextual/semantic",
  "human-review",
  "not-applicable-to-surface",
] as const;

export type EnforcementClass = (typeof ENFORCEMENT_CLASSES)[number];

const PARSER_MECHANICAL = new Set(["4.5", "5.1", "6.3", "6.6"]);
const DETERMINISTIC = new Set(["1.1"]);
const CONTEXTUAL = new Set(["1.5", "1.6", "1.8", "1.9", "1.10", "1.11"]);
const NOT_APPLICABLE_PREFIX = /^(?:GR-|front-matter|part2-)/;

export function enforcementClassFor(id: string, mappingClass: CheckerClass): EnforcementClass {
  if (mappingClass === "private_lexicon" || NOT_APPLICABLE_PREFIX.test(id)) {
    return "not-applicable-to-surface";
  }
  if (DETERMINISTIC.has(id)) {
    return "deterministic";
  }
  if (PARSER_MECHANICAL.has(id)) {
    return "parser-mechanical";
  }
  if (CONTEXTUAL.has(id)) {
    return "contextual/semantic";
  }
  return "human-review";
}
