import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("work-registry workflow wiring", () => {
  it("runs ci:work-registry on trusted PR and main", () => {
    const yaml = readFileSync(path.join(repoRoot, ".forgejo/workflows/asd-ste100.yml"), "utf8");
    assert.match(yaml, /ci:work-registry/);
    assert.match(yaml, /T2_WORK_REGISTRY_ROOT/);
    assert.match(yaml, /Work-registry release gate/);
  });
});
