import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { importOriginals, listEntities } from "./import.ts";
import { applyFixtureForks, forkInterpret } from "./interpret.ts";
import { explodeFrozenPages } from "./layout.ts";

const fixture = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../test/fixtures/lexicon/product-class.json",
);

function dbPath(): string {
  return path.join(mkdtempSync(path.join(tmpdir(), "t2-lexicon-fork-")), "bridge.sqlite");
}

describe("forkInterpret", () => {
  it("keeps the stock row and adds a unique child per mutate", () => {
    const dest = dbPath();
    const imported = importOriginals(dest, {
      actorId: "agent-test",
      items: [{ page: 1, kind: "word", originalText: "qzvstelemmaone" }],
    });
    const parentId = imported[0]?.id ?? "";
    const spec = JSON.parse(readFileSync(fixture, "utf8")) as {
      interpreterId: string;
      outputSurfaces: Array<string>;
    };
    forkInterpret(dest, {
      actorId: "agent-test",
      parentId,
      interpreterId: spec.interpreterId,
      surfaceText: spec.outputSurfaces[0] ?? "t2",
    });
    forkInterpret(dest, {
      actorId: "agent-test",
      parentId,
      interpreterId: spec.interpreterId,
      surfaceText: spec.outputSurfaces[1] ?? "canBus",
    });
    const rows = listEntities(dest);
    const stock = rows.find((row) => row.id === parentId);
    const children = rows.filter((row) => row.parentId === parentId);
    assert.equal(stock?.originalText, "qzvstelemmaone");
    assert.equal(stock?.parentId, null);
    assert.equal(children.length, 2);
    assert.deepEqual(children.map((row) => row.originalText).sort(), ["canBus", "t2"]);
    assert.equal(new Set(children.map((row) => row.id)).size, 2);
  });

  it("keeps the git interpreter fixture free of official-shaped words arrays", () => {
    const text = readFileSync(fixture, "utf8");
    assert.doesNotMatch(text, /"words"\s*:/);
  });
});

describe("applyFixtureForks", () => {
  it("forks each fixture surface once from the first header", () => {
    const dest = dbPath();
    importOriginals(dest, {
      actorId: "agent-test",
      items: [{ page: 1, kind: "word", originalText: "# qzvstelemmaone\n- qzvstelemmatwo" }],
    });
    const spec = JSON.parse(readFileSync(fixture, "utf8")) as {
      interpreterId: string;
      outputSurfaces: Array<string>;
    };
    explodeFrozenPages(dest, "agent-test");
    applyFixtureForks(dest, "agent-test", spec);
    applyFixtureForks(dest, "agent-test", spec);
    const surfaces = listEntities(dest)
      .filter((row) => row.parentId !== null)
      .map((row) => row.originalText);
    assert.equal(surfaces.filter((text) => text === "t2").length, 1);
    assert.equal(surfaces.filter((text) => text === "canBus").length, 1);
  });
});
