import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { checkClaims } from "../asd-ste100/claim.ts";
import { extractMarkdown } from "../asd-ste100/extract.ts";
import { checkMechanicalRules } from "../asd-ste100/rules.ts";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const doc = "docs/internals/t2-squared-work-registry.md";
const proposal = "T2_Squared-Work-Registry/asd-ste100-compliance/proposal.md";
const yamlProposal = "T2_Squared-Work-Registry/registry-yaml-write/proposal.md";

function findingsFor(relative: string): Array<unknown> {
  const source = readFileSync(path.join(repoRoot, relative), "utf8");
  const records = extractMarkdown(relative, source);
  return records.flatMap((record) => [
    ...checkMechanicalRules({
      path: record.path,
      line: record.line,
      column: record.column,
      text: record.text,
      kind: "descriptive",
    }),
    ...checkClaims(record),
  ]);
}

describe("work-registry internals doc", () => {
  it("passes mechanical rules and prohibited-claim checks", () => {
    assert.deepEqual(findingsFor(doc), [], `${doc} still has findings`);
  });

  it("records dump, yaml documents, and the live override campaign", () => {
    const text = readFileSync(path.join(repoRoot, doc), "utf8");
    assert.match(text, /--dump/);
    assert.match(text, /--lookup/);
    assert.match(text, /yaml/i);
    assert.match(text, /override/);
    assert.match(text, /asd-ste100-compliance/);
    assert.match(text, /registry-yaml-write/);
    assert.match(text, /forgejoClosed/);
    assert.match(text, /synthetic/);
    assert.match(text, /`work`/);
    assert.match(text, /`pull`/);
    assert.match(text, /`event`/);
    assert.doesNotMatch(text, /first live campaign waits/i);
  });
});

describe("live campaign proposal", () => {
  it("passes mechanical rules and prohibited-claim checks", () => {
    assert.deepEqual(findingsFor(proposal), [], `${proposal} still has findings`);
  });

  it("keeps the yaml-write campaign proposal in STE", () => {
    assert.deepEqual(findingsFor(yamlProposal), [], `${yamlProposal} still has findings`);
  });
});
