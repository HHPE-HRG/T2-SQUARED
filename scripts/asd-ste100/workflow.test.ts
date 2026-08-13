import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workflowPath = path.join(repoRoot, ".forgejo/workflows/asd-ste100.yml");
const anchorPath = path.join(repoRoot, "t2.asd-ste100.anchor.json");

const workflow = (): string => readFileSync(workflowPath, "utf8");

const jobBlock = (source: string, jobId: string): string => {
  const match = source.match(
    new RegExp(`(?:^|\\n)  ${jobId}:\\n([\\s\\S]*?)(?=\\n  [a-z].*:\\n|$)`),
  );
  assert.notEqual(match, null, `missing job ${jobId}`);
  return match?.[1] ?? "";
};

describe("asd-ste100 workflow", () => {
  it("names the workflow asd-ste100 and dispatches on the hhpe-ci runner", () => {
    const source = workflow();
    assert.match(source, /^name:\s*asd-ste100\s*$/m);
    assert.match(source, /workflow_dispatch:/);
    const dispatch = jobBlock(source, "advisory");
    assert.match(dispatch, /runs-on:\s*hhpe-ci/);
  });

  it("uses stable status-context job names for PR, main, and release", () => {
    const source = workflow();
    assert.match(source, /name:\s*asd-ste100 \/ advisory/);
    assert.match(source, /name:\s*asd-ste100 \/ trusted-pr/);
    assert.match(source, /name:\s*asd-ste100 \/ trusted-main/);
    assert.match(source, /name:\s*asd-ste100 \/ trusted-release/);
  });

  it("runs the public command with PR, main, and release modes", () => {
    const source = workflow();
    assert.match(source, /npm run ci:asd-ste100 -- --mode pr/);
    assert.match(source, /npm run ci:asd-ste100 -- --mode main/);
    assert.match(source, /npm run ci:asd-ste100 -- --mode release/);
  });

  it("keeps vocabulary, reviewer, release, and package secrets off the advisory job", () => {
    const advisory = jobBlock(workflow(), "advisory");
    assert.doesNotMatch(advisory, /secrets\./);
    assert.doesNotMatch(advisory, /ASD_STE100_VOCABULARY/);
    assert.doesNotMatch(advisory, /FORGEJO_TOKEN|PACKAGE_TOKEN|RELEASE_TOKEN/);
  });

  it("loads trusted checker code from the pull-request base, not the head", () => {
    const trusted = jobBlock(workflow(), "trusted-pr");
    assert.match(trusted, /pull_request\.base\.sha/);
    assert.doesNotMatch(trusted, /npm run ci:asd-ste100.*pr-tree/);
    assert.match(trusted, /checker/);
    assert.match(trusted, /pr-tree/);
  });

  it("rejects trusted jobs scheduled from another repository", () => {
    const source = workflow();
    for (const jobId of ["trusted-pr", "trusted-main", "trusted-release"]) {
      const block = jobBlock(source, jobId);
      assert.match(block, /github\.repository\s*==\s*'maxholden\/T2-SQUARED'/);
      assert.match(block, /runs-on:\s*t2-trusted/);
    }
  });

  it("starts trusted jobs from an empty workspace and removes secret mounts", () => {
    const trusted = jobBlock(workflow(), "trusted-pr");
    assert.match(trusted, /empty workspace|ephemeral/i);
    assert.match(trusted, /if:\s*always\(\)/);
    assert.match(trusted, /unset|unmount|remove.*secret/i);
  });

  it("refuses GitHub v* tag promotion and only creates t2-v* tags after release mode", () => {
    const release = jobBlock(workflow(), "trusted-release");
    assert.match(release, /t2-v\*/);
    assert.doesNotMatch(release, /git tag v\$/);
    assert.match(release, /create no tag|startsWith\(inputs.tag, 't2-v'\)|t2-v/);
    assert.match(release, /generic/);
  });

  it("fails connected modes unless GitHub Actions are verified disabled", () => {
    const source = workflow();
    assert.match(source, /ASD_STE100_GITHUB_ACTIONS/);
    const advisory = jobBlock(source, "advisory");
    assert.doesNotMatch(advisory, /ASD_STE100_GITHUB_ACTIONS/);
  });
});

describe("bootstrap anchor", () => {
  it("records checker SHA, reviewer principal, fixture result, and protection activation fields", () => {
    const anchor = JSON.parse(readFileSync(anchorPath, "utf8")) as Record<string, unknown>;
    assert.equal("checkerSha" in anchor, true);
    assert.equal("reviewerPrincipal" in anchor, true);
    assert.equal("fixtureResult" in anchor, true);
    assert.equal("protectionActivation" in anchor, true);
    assert.match(String(anchor.protectionActivation), /workflow-dispatch|after-dispatch/i);
  });
});
