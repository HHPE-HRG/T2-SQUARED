import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { listEvents } from "./events.ts";
import { importOriginals, listEntities } from "./import.ts";
import { applyLayoutAutomation, guessLayoutKind } from "./layout.ts";

function dbPath(): string {
  return path.join(mkdtempSync(path.join(tmpdir(), "t2-lexicon-layout-")), "bridge.sqlite");
}

describe("guessLayoutKind", () => {
  it("guesses a header-like synthetic line as header", () => {
    assert.equal(guessLayoutKind("# qzvstelemmaone"), "header");
  });

  it("guesses a list-like synthetic line as item", () => {
    assert.equal(guessLayoutKind("- qzvstelemmatwo"), "item");
  });

  it("guesses a plain synthetic token as word", () => {
    assert.equal(guessLayoutKind("qzvstelemmathree"), "word");
  });
});

describe("applyLayoutAutomation", () => {
  it("applies the static guess then an agent override and records both events", () => {
    const dest = dbPath();
    importOriginals(dest, {
      actorId: "agent-test",
      items: [{ page: 1, kind: "word", originalText: "# qzvstelemmaone" }],
    });
    applyLayoutAutomation(dest, {
      actorId: "agent-test",
      agentCorrect: () => "workflow",
    });
    const rows = listEntities(dest);
    assert.equal(rows[0]?.kind, "workflow");
    const actions = listEvents(dest).map((event) => event.action);
    assert.equal(actions.includes("import"), true);
    assert.equal(actions.includes("layout-guess"), true);
    assert.equal(actions.includes("layout-correct"), true);
    const correct = listEvents(dest).find((event) => event.action === "layout-correct");
    assert.equal(correct?.subjectEntityIds.length, 1);
    assert.equal(typeof correct?.id, "string");
    assert.match(correct?.utcTime ?? "", /^\d{4}-\d{2}-\d{2}T/);
  });
});
