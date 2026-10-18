// @effect-diagnostics nodeBuiltinImport:off
/**
 * G1A manifest shape tests.
 *
 * These tests prove the completeness manifest names every frozen mechanism
 * class and points at retained evidence files. They must not claim that every
 * live communication has an inventory row.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const g1aDir = join(repoRoot, "docs/scm/g1a");
const FROZEN_CLASSES = [
  "rpc-service-interfaces",
  "streams",
  "queues",
  "callbacks",
  "persistence",
  "process-flags",
  "subprocess",
  "external-transport",
] as const;

interface ManifestClass {
  readonly id: string;
  readonly discoveryProcedure: string;
  readonly retainedResultsRef: string;
  readonly inventoryRowIds: ReadonlyArray<string>;
  readonly exclusions: ReadonlyArray<string>;
  readonly steward: string;
  readonly reviewStatus: string;
}

interface LoadedSurface {
  readonly package: string;
  readonly treatment: string;
}

interface Manifest {
  readonly gate: string;
  readonly doesNotClaim: string;
  readonly status: string;
  readonly discoveryAuthor: string;
  readonly g1bAuthorized: boolean;
  readonly a7Steward: {
    readonly identity: string;
    readonly reviewStatus: string;
    readonly priorReviews: ReadonlyArray<{
      readonly identity: string;
      readonly result: string;
    }>;
  };
  readonly loadedWorkspaceSurfaces: ReadonlyArray<LoadedSurface>;
  readonly shippedProviderDrivers: ReadonlyArray<string>;
  readonly proposedOtelPathNames: Record<string, string>;
  readonly boundaryRef: string;
  readonly evidenceRef: string;
  readonly exclusionsRef: string;
  readonly retainedResultsRef: string;
  readonly negativeControl: {
    readonly pathId: string;
    readonly symbol: string;
    readonly mechanismClass: string;
  };
  readonly mechanismClasses: ReadonlyArray<ManifestClass>;
}

const loadManifest = (): Manifest =>
  JSON.parse(readFileSync(join(g1aDir, "completeness-manifest.json"), "utf8")) as Manifest;

describe("G1A completeness manifest", () => {
  it("names every frozen mechanism class and does not claim total inventory completeness", () => {
    const manifest = loadManifest();
    assert.equal(manifest.gate, "G1A");
    assert.equal(manifest.doesNotClaim, "every live communication has an inventory row");
    assert.equal(manifest.status, "a7-approved-to-proceed-to-g1b");
    assert.notEqual(manifest.discoveryAuthor, manifest.a7Steward.identity);
    assert.notEqual(manifest.a7Steward.identity, "human-operator-of-campaign");
    assert.equal(manifest.a7Steward.reviewStatus, "approved-to-proceed-to-g1b");
    assert.equal(manifest.g1bAuthorized, true);
    assert.equal(manifest.a7Steward.priorReviews[0]?.identity, "codex-independent-review");
    assert.equal(manifest.a7Steward.priorReviews[0]?.result, "withheld");
    assert.equal(manifest.a7Steward.priorReviews[1]?.identity, "codex-independent-review");
    assert.equal(manifest.a7Steward.priorReviews[1]?.result, "approved-to-proceed-to-g1b");

    const ids = manifest.mechanismClasses.map((row) => row.id);
    assert.deepEqual(ids, [...FROZEN_CLASSES]);

    for (const row of manifest.mechanismClasses) {
      assert.ok(Array.isArray(row.inventoryRowIds));
      assert.ok(row.inventoryRowIds.length > 0);
      assert.ok(row.discoveryProcedure.length > 0);
      assert.ok(row.retainedResultsRef.includes("docs/scm/g1a/evidence.md"));
      assert.equal(row.reviewStatus, "approved-a7-for-g1b");
    }
  });

  it("references retained evidence files that exist on disk", () => {
    const manifest = loadManifest();
    assert.equal(existsSync(join(repoRoot, manifest.boundaryRef)), true);
    assert.equal(existsSync(join(repoRoot, manifest.evidenceRef)), true);
    assert.equal(existsSync(join(repoRoot, manifest.exclusionsRef)), true);
    assert.equal(existsSync(join(repoRoot, manifest.retainedResultsRef)), true);
    assert.equal(existsSync(join(repoRoot, manifest.negativeControl.symbol)), true);
    assert.equal(manifest.negativeControl.mechanismClass, "external-transport");
    assert.equal(manifest.negativeControl.pathId, "NC-MCP-HTTP");

    const loaded = manifest.loadedWorkspaceSurfaces.map((row) => row.package);
    assert.deepEqual(loaded, [
      "@t3tools/contracts",
      "@t3tools/shared",
      "@t3tools/tailscale",
      "effect-acp",
      "effect-codex-app-server",
      "@t3tools/web",
    ]);
    assert.equal(
      manifest.loadedWorkspaceSurfaces.find((row) => row.package === "@t3tools/web")?.treatment,
      "EX-WEB-BUILD",
    );
    assert.deepEqual(manifest.shippedProviderDrivers, [
      "codex",
      "claudeAgent",
      "cursor",
      "grok",
      "opencode",
    ]);
    assert.equal(
      manifest.proposedOtelPathNames.admission,
      "no-live-t2-host-communication-discovered",
    );
    assert.equal(
      manifest.proposedOtelPathNames["realization/projection"],
      "in-scope-under-discovered-classes",
    );

    const evidence = readFileSync(join(repoRoot, manifest.evidenceRef), "utf8");
    const subprocessSection = evidence.slice(
      evidence.indexOf("## 7. subprocess"),
      evidence.indexOf("## 8. external-transport"),
    );
    const externalSection = evidence.slice(evidence.indexOf("## 8. external-transport"));
    assert.equal(subprocessSection.includes("BitbucketApi"), false);
    assert.equal(externalSection.includes("BitbucketApi"), true);
    assert.equal(subprocessSection.includes("GitHubCli"), true);
    assert.equal(subprocessSection.includes("GitLabCli"), true);
    assert.equal(subprocessSection.includes("AzureDevOpsCli"), true);

    const exclusions = readFileSync(join(repoRoot, manifest.exclusionsRef), "utf8");
    assert.equal(exclusions.includes("empty canonical HHPE seeds"), true);
    assert.equal(exclusions.includes("Reference HHPE inventory disposition"), false);
  });
});
