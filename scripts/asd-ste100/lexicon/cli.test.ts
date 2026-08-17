import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { destInsideGitWorkTree, main, runLexiconScan } from "./cli.ts";
import { LexiconError, listEntities } from "./import.ts";

const EMPTY_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "t2-lexicon-cli-"));
}

describe("runLexiconScan", () => {
  it("rejects dest under a fake git root", () => {
    const root = tempDir();
    mkdirSync(path.join(root, ".git"));
    const dest = path.join(root, "bridge.sqlite");
    assert.equal(destInsideGitWorkTree(dest), true);
    assert.throws(
      () =>
        runLexiconScan({
          src: root,
          dest,
          actorId: "agent-test",
        }),
      LexiconError,
    );
  });

  it("accepts dest under tmpdir with synthetic images", () => {
    const src = tempDir();
    writeFileSync(path.join(src, "page_0001.jpg"), EMPTY_JPEG);
    writeFileSync(path.join(src, "page_0001.txt"), "qzvstelemmaone");
    writeFileSync(path.join(src, "page_0002.jpg"), EMPTY_JPEG);
    writeFileSync(path.join(src, "page_0002.txt"), "- qzvstelemmatwo");
    const dest = path.join(tempDir(), "bridge.sqlite");
    assert.equal(destInsideGitWorkTree(dest), false);
    runLexiconScan({ src, dest, actorId: "agent-test" });
    const rows = listEntities(dest);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.originalText, "qzvstelemmaone");
    assert.equal(rows[1]?.kind, "item");
  });
});

describe("main --git-merge", () => {
  it("returns nonzero without words profile and terms", () => {
    assert.equal(main(["--git-merge"]), 1);
  });
});
