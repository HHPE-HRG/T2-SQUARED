import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  humanProfileCount,
  loadMappingPrincipals,
  loadMappingPrincipalsFile,
  selfSignAllowed,
  selfSignMode,
  type MappingIdentity,
} from "./promote.ts";
import type { MappingRow } from "./merge.ts";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const mappingDir = path.join(path.dirname(fileURLToPath(import.meta.url)));

describe("mapping KTD28 mode after a second human reviewer exists", () => {
  it("keeps two human profiles and co-sign once a second reviewer exists", () => {
    const file = loadMappingPrincipalsFile(repoRoot);
    const identities = loadMappingPrincipals(repoRoot);
    const principals = new Set(identities.map((entry: MappingIdentity) => entry.principal));
    assert.equal(humanProfileCount(file), 2);
    assert.equal(selfSignMode(file), "co-sign");
    assert.equal(principals.has("t2-single-operator"), true);
    assert.equal(principals.has("t2-reviewer-operator"), true);
    assert.equal(selfSignAllowed(identities, 2, file.profiles), false);
  });

  it("records selfSign on live mapping rows", () => {
    const live = JSON.parse(
      readFileSync(path.join(mappingDir, "records/records.json"), "utf8"),
    ) as {
      coverageKind: string;
      selfSign: boolean;
      rows: Array<MappingRow>;
    };
    assert.equal(live.coverageKind, "issue9-self-sign");
    assert.equal(live.selfSign, true);
    assert.equal(
      live.rows.every((row) => row.reviewerId === "operator-self-sign"),
      true,
    );
  });
});
