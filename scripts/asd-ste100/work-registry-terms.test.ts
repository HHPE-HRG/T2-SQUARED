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
    ) as { terms: Array<TechnicalTerm> };
    validateTechnicalTerms(payload.terms);
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
