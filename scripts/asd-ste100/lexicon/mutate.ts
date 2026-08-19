import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { tagNoT2Function } from "./export.ts";
import { listEntities } from "./import.ts";
import { applyFixtureForks, type InterpreterFixture } from "./interpret.ts";
import { applyLayoutAutomation, explodeFrozenPages } from "./layout.ts";

const defaultFixture = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../test/fixtures/lexicon/product-class.json",
);

export function mutateFrozenLexicon(
  dbPath: string,
  actorId: string,
  fixturePath: string = defaultFixture,
): void {
  explodeFrozenPages(dbPath, actorId);
  applyLayoutAutomation(dbPath, {
    actorId,
    agentCorrect: (entity) => entity.kind,
  });
  for (const row of listEntities(dbPath)) {
    if (row.parentId === null && !row.noT2Function) {
      tagNoT2Function(dbPath, row.id, actorId);
    }
  }
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as InterpreterFixture;
  applyFixtureForks(dbPath, actorId, fixture);
}
