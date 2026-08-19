import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { listEvents } from "./events.ts";
import { importOriginals, listEntities } from "./import.ts";
import { LexiconError } from "./import.ts";
import { addEntityRef, listRefsTo, shuffleDuplicate } from "./refs.ts";

function dbPath(): string {
  return path.join(mkdtempSync(path.join(tmpdir(), "t2-lexicon-refs-")), "bridge.sqlite");
}

describe("shuffleDuplicate", () => {
  it("retargets any entity pointer to the saved row and drops the duplicate", () => {
    const dest = dbPath();
    const rows = importOriginals(dest, {
      actorId: "agent-test",
      items: [
        { page: 1, kind: "word", originalText: "qzvstelemmaone" },
        { page: 1, kind: "word", originalText: "qzvstelemmaone" },
        { page: 2, kind: "workflow", originalText: "qzvstelemmatwo" },
      ],
    });
    const saved = rows[0];
    const duplicate = rows[1];
    const pointer = rows[2];
    if (saved === undefined || duplicate === undefined || pointer === undefined) {
      throw new Error("import");
    }
    addEntityRef(dest, pointer.id, duplicate.id);
    shuffleDuplicate(dest, {
      actorId: "agent-test",
      savedId: saved.id,
      duplicateId: duplicate.id,
    });
    assert.equal(
      listEntities(dest).some((row) => row.id === duplicate.id),
      false,
    );
    assert.equal(
      listEntities(dest).some((row) => row.id === saved.id),
      true,
    );
    assert.deepEqual(listRefsTo(dest, saved.id), [{ fromId: pointer.id, toId: saved.id }]);
  });

  it("writes a complete error event when shuffle subjects are missing", () => {
    const dest = dbPath();
    importOriginals(dest, {
      actorId: "agent-test",
      items: [{ page: 1, kind: "word", originalText: "qzvstelemmaone" }],
    });
    assert.throws(
      () =>
        shuffleDuplicate(dest, {
          actorId: "agent-test",
          savedId: "missing-saved",
          duplicateId: "missing-dup",
        }),
      (error: unknown) => error instanceof LexiconError,
    );
    const event = listEvents(dest).find((row) => row.action === "shuffle-duplicate");
    assert.equal(typeof event?.id, "string");
    assert.match(event?.utcTime ?? "", /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(event?.subjectEntityIds, ["missing-saved", "missing-dup"]);
    assert.match(event?.error ?? "", /missing/);
  });
});
