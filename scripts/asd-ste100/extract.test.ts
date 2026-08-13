import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractMarkdown, extractTypeScript } from "./extract.ts";

describe("extractMarkdown", () => {
  it("extracts prose with original line and column", () => {
    const source = "Do not skip the gate.\n";
    const records = extractMarkdown("docs/note.md", source);
    assert.equal(records.length, 1);
    assert.equal(records[0]?.text, "Do not skip the gate.");
    assert.equal(records[0]?.line, 1);
    assert.equal(records[0]?.column, 1);
  });

  it("keeps separate paragraphs as separate records", () => {
    const source = "The first paragraph is short.\n\nThe second paragraph is also short.\n";
    const records = extractMarkdown("docs/note.md", source);
    assert.equal(records.length, 2);
    assert.equal(records[0]?.text, "The first paragraph is short.");
    assert.equal(records[1]?.text, "The second paragraph is also short.");
  });

  it("does not treat fenced code, frontmatter, or inline code as prose", () => {
    const source = `---
title: x
---

See \`ROOT_URL\`.

\`\`\`ts
const tooManyWords = "this is a very long code string that must not become a finding";
\`\`\`
`;
    const records = extractMarkdown("docs/note.md", source);
    assert.equal(
      records.some(
        (record) => record.text.includes("tooManyWords") || record.text.includes("ROOT_URL"),
      ),
      false,
    );
  });
});

describe("extractTypeScript", () => {
  it("extracts a warning added to an upstream TypeScript file", () => {
    const source = `export const n = 1;
export const t2Warning = "Do not skip the gate.";
`;
    const records = extractTypeScript("apps/server/src/index.ts", source);
    const warning = records.find((record) => record.text === "Do not skip the gate.");
    assert.ok(warning);
    assert.equal(warning.line, 2);
  });
});
