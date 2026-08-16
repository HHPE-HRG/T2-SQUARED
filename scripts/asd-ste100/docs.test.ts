import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { checkClaims } from "./claim.ts";
import { extractMarkdown } from "./extract.ts";
import { checkMechanicalRules } from "./rules.ts";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const ownedDocs = [
  "docs/internals/asd-ste100-enforcement.md",
  "docs/operations/asd-ste100-forgejo.md",
];

const read = (relative: string): string => readFileSync(path.join(repoRoot, relative), "utf8");

describe("owned enforcement documentation", () => {
  it("passes mechanical rules and prohibited-claim checks", () => {
    for (const relative of ownedDocs) {
      const source = read(relative);
      const records = extractMarkdown(relative, source);
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
      assert.deepEqual(findings, [], `${relative} still has findings`);
    }
  });

  it("uses only mechanical rule-subset language", () => {
    const text = ownedDocs.map(read).join("\n");
    assert.doesNotMatch(text, /ASD(?:-STE100)?\s+(certified|approved|certification)/i);
    assert.match(text, /mechanical rule-subset/);
  });

  it("names the raw conversation exception and T2 ownership boundary", () => {
    const text = read("docs/internals/asd-ste100-enforcement.md");
    assert.match(text, /raw (prompt|conversation)/i);
    assert.match(text, /T2-owned|ownership/i);
    assert.match(text, /upstream/i);
  });

  it("records the staged Forgejo path, runner pairing, and distinct accounts", () => {
    const text = read("docs/operations/asd-ste100-forgejo.md");
    assert.match(text, /9\.0\.3/);
    assert.match(text, /10\.0\.3/);
    assert.match(text, /11\.0\.16/);
    assert.match(text, /15\.0\.6/);
    assert.match(text, /hhpe-ci/);
    assert.match(text, /distinct/i);
    assert.match(text, /t2-trusted/);
    assert.match(text, /pending-human/);
  });

  it("does not copy official dictionary entries or ASD examples", () => {
    const text = ownedDocs.map(read).join("\n");
    assert.doesNotMatch(text, /approved word list|dictionary entry|camshaft/i);
  });

  it("records Forgejo admission, excluded transcripts and machine text, and deferred registry work", () => {
    const text = read("docs/internals/asd-ste100-enforcement.md");
    assert.match(text, /Forgejo admission/);
    assert.match(text, /not a local commit typecheck/);
    assert.match(text, /transcripts/);
    assert.match(text, /machine text/);
    assert.match(text, /does not start work-registry/);
    assert.match(text, /does not start CAN campaign/);
    assert.doesNotMatch(text, /Work-registry implementation can start after this slice/);
  });
});

describe("contributor index", () => {
  it("points maintainers to the enforcement docs and public command", () => {
    const readme = read("docs/README.md");
    const scripts = read("docs/internals/scripts.md");
    const agents = read("AGENTS.md");
    assert.match(readme, /asd-ste100-enforcement/);
    assert.match(readme, /asd-ste100-forgejo/);
    assert.match(scripts, /ci:asd-ste100/);
    assert.match(agents, /T2-owned/);
    assert.match(agents, /raw conversation/i);
  });
});
