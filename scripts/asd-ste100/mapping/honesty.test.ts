import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { loadMappingPrincipals, selfSignAllowed, type MappingIdentity } from "./promote.ts";
import type { MappingRow } from "./merge.ts";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const mappingDir = path.join(path.dirname(fileURLToPath(import.meta.url)));

describe("mapping self-sign is not distinct-principal review", () => {
  it("keeps live identities on one principal", () => {
    const identities = loadMappingPrincipals(repoRoot);
    const principals = new Set(identities.map((entry: MappingIdentity) => entry.principal));
    assert.equal(principals.size, 1);
    assert.equal(principals.has("t2-single-operator"), true);
    assert.equal(selfSignAllowed(identities), true);
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
