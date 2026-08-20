import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { REQUIRED_WORK_REGISTRY_TERMS } from "../work-registry/glossary.ts";
import { validateTechnicalTerms, type TechnicalTerm } from "./vocabulary.ts";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("work-registry technical terms", () => {
  it("lists required work-registry terms as reviewed T2 nouns or verbs", () => {
    const payload = JSON.parse(
      readFileSync(path.join(repoRoot, "t2.asd-ste100.terms.json"), "utf8"),
    ) as {
      subjectFields?: Record<string, { admittedTerms: Array<string> }>;
      terms: Array<TechnicalTerm>;
    };
    validateTechnicalTerms(payload.terms, payload.subjectFields ?? {});
    for (const required of REQUIRED_WORK_REGISTRY_TERMS) {
      const hit = payload.terms.find(
        (term) =>
          term.term.toLowerCase() === required.term.toLowerCase() &&
          term.kind === required.kind &&
          term.reviewed === true,
      );
      assert.ok(
        hit,
        `missing reviewed ${required.kind} ${required.term} in t2.asd-ste100.terms.json`,
      );
      assert.equal(hit.canonical, true, required.term);
      assert.equal(typeof hit.concept, "string", required.term);
      assert.equal((hit.subjectFields ?? []).length > 0, true, required.term);
      assert.equal(typeof hit.technicalTermClass, "string", required.term);
      assert.equal(hit.softwareForms !== undefined, true, required.term);
      assert.deepEqual(hit.asdBasis, ["1.5"], required.term);
      assert.notEqual(hit.asdBasis?.[0], "1.1", required.term);
      for (const field of hit.subjectFields ?? []) {
        const admitted = payload.subjectFields?.[field]?.admittedTerms ?? [];
        assert.equal(admitted.includes(hit.term), true, `${required.term} admitted in ${field}`);
      }
    }
  });

  it("keeps asdBasis overlay ids out of live G2 rules", () => {
    const payload = JSON.parse(
      readFileSync(path.join(repoRoot, "t2.asd-ste100.terms.json"), "utf8"),
    ) as { terms: Array<TechnicalTerm> };
    const rules = JSON.parse(
      readFileSync(path.join(repoRoot, "t2.asd-ste100.rules.json"), "utf8"),
    ) as { rules: Array<{ id: string }> };
    const live = new Set(rules.rules.map((rule) => rule.id));
    for (const term of payload.terms) {
      for (const id of term.asdBasis ?? []) {
        if (id === "1.1") {
          continue;
        }
        assert.equal(live.has(id), false, `asdBasis ${id} must stay out of live G2`);
      }
    }
  });

  it("keeps Issue 9 mapping ids out of the T2 work-registry glossary file", () => {
    const mapping = JSON.parse(
      readFileSync(
        path.join(repoRoot, "scripts/asd-ste100/mapping/records/official-unreviewed.json"),
        "utf8",
      ),
    ) as { rows: Array<{ id: string }> };
    const glossary = new Set(REQUIRED_WORK_REGISTRY_TERMS.map((term) => term.term.toLowerCase()));
    for (const row of mapping.rows) {
      assert.equal(
        glossary.has(row.id.toLowerCase()),
        false,
        `official-unreviewed.json must not use T2 glossary term ${row.id} as an Issue 9 mapping id`,
      );
    }
  });
});
