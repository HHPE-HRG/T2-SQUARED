import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { importOriginals } from "./import.ts";
import { explodeFrozenPages } from "./layout.ts";
import { exportApprovedWordsJson, lemmasFromStockTexts } from "./normalize.ts";
import { tagNoT2Function } from "./export.ts";

function dbPath(): string {
  return path.join(mkdtempSync(path.join(tmpdir(), "t2-lexicon-norm-")), "bridge.sqlite");
}

describe("lemmasFromStockTexts", () => {
  it("keeps unique lowercase synthetic tokens and drops T2 surfaces", () => {
    const lemmas = lemmasFromStockTexts(["# qzvstelemmaone", "t2", "Qzvstelemmaone", "canBus"]);
    assert.deepEqual(lemmas, ["qzvstelemmaone"]);
  });
});

describe("exportApprovedWordsJson", () => {
  it("exports token lemmas from line rows and omits tagged pages", () => {
    const dest = dbPath();
    const rows = importOriginals(dest, {
      actorId: "agent-test",
      items: [{ page: 1, kind: "word", originalText: "qzvstelemmaone qzvstelemmatwo" }],
    });
    explodeFrozenPages(dest, "agent-test");
    const page = rows[0];
    if (page === undefined) {
      throw new Error("import");
    }
    tagNoT2Function(dest, page.id, "agent-test");
    const out = path.join(path.dirname(dest), "approved-words.json");
    const result = exportApprovedWordsJson(dest, out, "agent-test");
    const parsed = JSON.parse(readFileSync(out, "utf8")) as {
      words: Array<string>;
      records: Array<{ lemma: string; status: string }>;
    };
    assert.equal(parsed.words.includes("qzvstelemmaone"), true);
    assert.equal(parsed.words.includes("qzvstelemmatwo"), true);
    assert.equal(
      parsed.records.every((row) => row.status === "approved"),
      true,
    );
    assert.equal(result.lemmaCount, parsed.words.length);
  });
});
