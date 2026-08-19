import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
    writeFileSync(path.join(src, "page_0001.txt"), "QZVSTELEMMAONE (n)");
    writeFileSync(path.join(src, "page_0002.jpg"), EMPTY_JPEG);
    writeFileSync(path.join(src, "page_0002.txt"), "- qzvstelemmatwo (v)");
    const dest = path.join(tempDir(), "bridge.sqlite");
    assert.equal(destInsideGitWorkTree(dest), false);
    runLexiconScan({ src, dest, actorId: "agent-test" });
    const rows = listEntities(dest);
    const roots = rows.filter((row) => row.parentId === null);
    assert.equal(roots.length, 2);
    assert.equal(
      roots.every((row) => row.noT2Function),
      true,
    );
    assert.equal(
      rows.some((row) => row.originalText === "t2"),
      true,
    );
    assert.equal(
      rows.some((row) => row.originalText === "canBus"),
      true,
    );
    const exported = JSON.parse(
      readFileSync(path.join(path.dirname(dest), "words.json"), "utf8"),
    ) as {
      words: Array<string>;
    };
    assert.equal(exported.words.includes("t2"), false);
    assert.equal(exported.words.includes("canBus"), false);
    const approved = JSON.parse(
      readFileSync(path.join(path.dirname(dest), "approved-words.json"), "utf8"),
    ) as { words: Array<string> };
    assert.equal(approved.words.includes("qzvstelemmaone"), true);
    assert.equal(approved.words.includes("qzvstelemmatwo"), false);
    assert.equal(approved.words.includes("t2"), false);
    assert.equal(approved.words.includes("canbus"), false);
  });

  it("ocrs into dest sidecars when the jpg has no twin", () => {
    const src = tempDir();
    writeFileSync(path.join(src, "page_0001.jpg"), EMPTY_JPEG);
    const dest = path.join(tempDir(), "bridge.sqlite");
    const ocrHits: Array<string> = [];
    runLexiconScan({
      src,
      dest,
      actorId: "agent-test",
      ocrPage: (_jpg, txt) => {
        ocrHits.push(txt);
        writeFileSync(txt, "qzvstelemmaone");
      },
    });
    assert.equal(ocrHits.length, 1);
    assert.equal(
      listEntities(dest).some((row) => row.originalText === "qzvstelemmaone"),
      true,
    );
    const afterFirst = listEntities(dest).length;
    runLexiconScan({
      src,
      dest,
      actorId: "agent-test",
      ocrPage: () => {
        throw new Error("must not ocr again");
      },
    });
    assert.equal(listEntities(dest).length, afterFirst);
  });
});

describe("main --from-words", () => {
  it("writes approved lemmas and removes T2 surfaces from the extract", () => {
    const dir = tempDir();
    const wordsPath = path.join(dir, "words.json");
    const approvedPath = path.join(dir, "approved-words.json");
    writeFileSync(
      wordsPath,
      `${JSON.stringify({ words: ["FLUMBO (v)", "quarble (adj)", "t2", "canBus"] })}\n`,
    );
    assert.equal(main(["--from-words", wordsPath, "--approved", approvedPath]), 0);
    const approved = JSON.parse(readFileSync(approvedPath, "utf8")) as { words: Array<string> };
    const extract = JSON.parse(readFileSync(wordsPath, "utf8")) as { words: Array<string> };
    assert.deepEqual(approved.words, ["flumbo"]);
    assert.equal(extract.words.includes("t2"), false);
    assert.equal(extract.words.includes("canBus"), false);
    assert.equal(extract.words.includes("FLUMBO (v)"), true);
  });
});
