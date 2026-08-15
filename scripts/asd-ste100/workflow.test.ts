import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workflowPath = path.join(repoRoot, ".forgejo/workflows/asd-ste100.yml");

describe("asd-ste100 workflow wiring", () => {
  it("maps secrets and mounts vocabulary on trusted jobs", () => {
    const yaml = readFileSync(workflowPath, "utf8");
    assert.match(yaml, /ASD_STE100_VOCABULARY:/);
    assert.match(yaml, /secrets\.GITHUB_TOKEN/);
    assert.match(yaml, /secrets\.PACKAGE_TOKEN/);
    assert.match(yaml, /pull_request\.base\.sha/);
    assert.match(yaml, /pull_request\.head\.sha/);
    const advisory = yaml.split("trusted-pr")[0] ?? "";
    assert.equal(advisory.includes("ASD_STE100_VOCABULARY:"), false);
  });
});
