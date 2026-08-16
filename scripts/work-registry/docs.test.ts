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

describe("work-registry internals doc", () => {
  it("passes mechanical rules and prohibited-claim checks", () => {
    const source = readFileSync(path.join(repoRoot, doc), "utf8");
    const records = extractMarkdown(doc, source);
    const findings = records.flatMap((record) => [
      ...checkMechanicalRules({
        path: record.path,
        line: record.line,
        column: record.column,
        text: record.text,
        kind: "descriptive",
      }),
      ...checkClaims(record),
    ]);
    assert.deepEqual(findings, [], `${doc} still has findings`);
  });
});
