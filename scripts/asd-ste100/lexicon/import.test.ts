import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { LexiconError, importOriginals, listEntities } from "./import.ts";
import { listEvents } from "./events.ts";

function dbPath(): string {
  return path.join(mkdtempSync(path.join(tmpdir(), "t2-lexicon-")), "bridge.sqlite");
}

const SYNTHETIC_ITEMS = [
  { page: 1, kind: "header" as const, originalText: "qzvstelemmaone" },
  { page: 1, kind: "item" as const, originalText: "qzvstelemmatwo" },
  { page: 2, kind: "word" as const, originalText: "qzvstelemmathree" },
];

describe("importOriginals", () => {
  it("imports three synthetic items in scan order", () => {
    const dest = dbPath();
    importOriginals(dest, { actorId: "agent-test", items: SYNTHETIC_ITEMS });
    const rows = listEntities(dest);
    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((row) => row.ordinal),
      [0, 1, 2],
    );
    assert.deepEqual(
      rows.map((row) => row.originalText),
      ["qzvstelemmaone", "qzvstelemmatwo", "qzvstelemmathree"],
    );
    assert.equal(rows[0]?.kind, "header");
    assert.equal(rows[1]?.kind, "item");
    assert.equal(rows[2]?.kind, "word");
    assert.equal(rows[2]?.page, 2);
  });

  it("appends an import event with id and UTC time", () => {
    const dest = dbPath();
    importOriginals(dest, { actorId: "agent-test", items: SYNTHETIC_ITEMS });
    const events = listEvents(dest);
    assert.equal(events.length, 1);
    const event = events[0];
    assert.equal(typeof event?.id, "string");
    assert.equal((event?.id ?? "").length > 0, true);
    assert.equal(typeof event?.utcTime, "string");
    assert.match(event?.utcTime ?? "", /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(event?.actorId, "agent-test");
    assert.equal(event?.action, "import");
    assert.equal(event?.subjectEntityIds.length, 3);
    assert.equal(typeof event?.payloadHash, "string");
    assert.equal(event?.error, null);
  });

  it("rejects a second import of the same set", () => {
    const dest = dbPath();
    importOriginals(dest, { actorId: "agent-test", items: SYNTHETIC_ITEMS });
    assert.throws(
      () => importOriginals(dest, { actorId: "agent-test", items: SYNTHETIC_ITEMS }),
      (error: unknown) => error instanceof LexiconError && /scan once/i.test(error.message),
    );
    assert.equal(listEntities(dest).length, 3);
  });
});
