/**
 * G3 topology overlay enforcement tests.
 *
 * These tests prove every frozen G1 comm_id maps to a node/bus overlay
 * without mutating G1 or introducing runtime buses.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";

import { loadG1bPackage } from "./g1bInventory.ts";
import { checkG3Topology, computeG3ReviewedArtifactHash, loadG3Package } from "./g3Topology.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const g3Dir = join(repoRoot, "docs/scm/g3");
const g1InventoryPath = join(repoRoot, "docs/scm/g1b/inventory.json");

describe("G3 node and bus overlay", () => {
  it("covers every G1 comm_id exactly once without rewriting G1", () => {
    const pkg = loadG3Package(repoRoot);
    const g1b = loadG1bPackage(repoRoot);
    assert.equal(pkg.manifest.gate, "G3");
    assert.equal(pkg.manifest.status, "completed");
    assert.equal(pkg.manifest.authorized, true);
    assert.equal(pkg.manifest.completed, true);
    assert.equal(pkg.manifest.review.status, "approved");
    assert.equal(pkg.manifest.review.reviewedArtifactHash, computeG3ReviewedArtifactHash(pkg));
    assert.equal(g1b.manifest.g3Authorized, false);
    assert.equal(g1b.manifest.g4toG7Authorized, false);
    const g1Ids = g1b.inventory.rows.map((row) => row.comm_id).sort();
    const overlayIds = pkg.topology.mappings.map((row) => row.comm_id).sort();
    assert.equal(g1Ids.length, 74);
    assert.deepEqual(overlayIds, g1Ids);
    const inventoryText = readFileSync(g1InventoryPath, "utf8");
    assert.equal(inventoryText.includes('"home_bus_id"'), false);
    assert.equal(inventoryText.includes('"node_id"'), false);
    const result = checkG3Topology(pkg);
    assert.equal(
      result.ok,
      true,
      result.ok ? "" : result.failures.map((row) => row.message).join("\n"),
    );
  });

  it("rejects missing, duplicate, and unexpected comm_id values", () => {
    const pkg = loadG3Package(repoRoot);
    const missing = structuredClone(pkg);
    missing.topology.mappings = missing.topology.mappings.filter(
      (row) => row.comm_id !== "INV-T2-ORCH-QUEUE",
    );
    const missingResult = checkG3Topology(missing);
    assert.equal(missingResult.ok, false);
    assert.ok(
      missingResult.ok === false &&
        missingResult.failures.some((row) => row.code === "coverage-id-set"),
    );

    const duplicate = structuredClone(pkg);
    duplicate.topology.mappings.push({ ...duplicate.topology.mappings[0]! });
    const duplicateResult = checkG3Topology(duplicate);
    assert.equal(duplicateResult.ok, false);
    assert.ok(
      duplicateResult.ok === false &&
        duplicateResult.failures.some((row) => row.code === "coverage-id-set"),
    );

    const extra = structuredClone(pkg);
    extra.topology.mappings[0] = { ...extra.topology.mappings[0]!, comm_id: "INV-T2-INVENTED" };
    const extraResult = checkG3Topology(extra);
    assert.equal(extraResult.ok, false);
    assert.ok(
      extraResult.ok === false &&
        extraResult.failures.some((row) => row.code === "coverage-id-set"),
    );
  });

  it("rejects placed nodes without one home bus and nodes with two homes", () => {
    const pkg = loadG3Package(repoRoot);
    const zero = structuredClone(pkg);
    zero.bindings = zero.bindings.filter(
      (row) => !(row.node_id === "node.orchestration" && row.relationship === "home"),
    );
    const zeroResult = checkG3Topology(zero);
    assert.equal(zeroResult.ok, false);
    assert.ok(
      zeroResult.ok === false && zeroResult.failures.some((row) => row.code === "home-bus"),
    );

    const two = structuredClone(pkg);
    two.bindings.push({
      node_id: "node.orchestration",
      bus_id: "bus.rpc",
      relationship: "home",
    });
    const twoResult = checkG3Topology(two);
    assert.equal(twoResult.ok, false);
    assert.ok(twoResult.ok === false && twoResult.failures.some((row) => row.code === "home-bus"));
  });

  it("rejects missing node or bus references and buses without stewards", () => {
    const pkg = loadG3Package(repoRoot);
    const missingNode = structuredClone(pkg);
    missingNode.topology.mappings[0] = {
      ...missingNode.topology.mappings[0]!,
      node_id: "node.missing",
    };
    const missingNodeResult = checkG3Topology(missingNode);
    assert.equal(missingNodeResult.ok, false);
    assert.ok(
      missingNodeResult.ok === false &&
        missingNodeResult.failures.some((row) => row.code === "unknown-node"),
    );

    const missingBus = structuredClone(pkg);
    missingBus.topology.mappings[0] = {
      ...missingBus.topology.mappings[0]!,
      home_bus_id: "bus.missing",
      origin_bus_id: "bus.missing",
    };
    const missingBusResult = checkG3Topology(missingBus);
    assert.equal(missingBusResult.ok, false);
    assert.ok(
      missingBusResult.ok === false &&
        missingBusResult.failures.some((row) => row.code === "unknown-bus"),
    );

    const noSteward = structuredClone(pkg);
    noSteward.buses[0] = { ...noSteward.buses[0]!, steward: "" };
    const stewardResult = checkG3Topology(noSteward);
    assert.equal(stewardResult.ok, false);
    assert.ok(
      stewardResult.ok === false &&
        stewardResult.failures.some((row) => row.code === "bus-steward"),
    );
  });

  it("rejects permanent buses without approval and origin/home mismatch", () => {
    const pkg = loadG3Package(repoRoot);
    const permanent = structuredClone(pkg);
    permanent.buses[0] = {
      ...permanent.buses[0]!,
      permanent: true,
    };
    delete permanent.buses[0]!.permanenceApproval;
    const permanentResult = checkG3Topology(permanent);
    assert.equal(permanentResult.ok, false);
    assert.ok(
      permanentResult.ok === false &&
        permanentResult.failures.some((row) => row.code === "permanence"),
    );

    const origin = structuredClone(pkg);
    origin.topology.mappings[0] = {
      ...origin.topology.mappings[0]!,
      origin_bus_id: "bus.observer",
    };
    const originResult = checkG3Topology(origin);
    assert.equal(originResult.ok, false);
    assert.ok(
      originResult.ok === false && originResult.failures.some((row) => row.code === "origin-bus"),
    );
  });

  it("rejects unplaced rows without gaps, manifold nodes, and halt yes", () => {
    const pkg = loadG3Package(repoRoot);
    const unplaced = structuredClone(pkg);
    unplaced.topology.mappings[0] = {
      ...unplaced.topology.mappings[0]!,
      node_id: "unplaced",
      placementStatus: "unplaced",
      home_bus_id: null,
      origin_bus_id: null,
    };
    delete unplaced.topology.mappings[0]!.placement;
    const unplacedResult = checkG3Topology(unplaced);
    assert.equal(unplacedResult.ok, false);
    assert.ok(
      unplacedResult.ok === false &&
        unplacedResult.failures.some((row) => row.code === "unplaced-gap"),
    );

    const manifold = structuredClone(pkg);
    manifold.nodes.push({
      node_id: "node.manifold",
      halt_initiator: "no",
      baseline_authority: "observer",
      placementStatus: "placed",
    });
    const manifoldResult = checkG3Topology(manifold);
    assert.equal(manifoldResult.ok, false);
    assert.ok(
      manifoldResult.ok === false && manifoldResult.failures.some((row) => row.code === "manifold"),
    );

    const haltYes = structuredClone(pkg);
    haltYes.nodes[0] = { ...haltYes.nodes[0]!, halt_initiator: "yes" };
    const haltResult = checkG3Topology(haltYes);
    assert.equal(haltResult.ok, false);
    assert.ok(
      haltResult.ok === false && haltResult.failures.some((row) => row.code === "halt-initiator"),
    );
  });

  it("keeps observers and reserved 404 halt-ineligible", () => {
    const pkg = loadG3Package(repoRoot);
    const observer = pkg.nodes.find((row) => row.node_id === "node.t2-observer");
    const reserved = pkg.nodes.find((row) => row.node_id === "node.observer.404");
    assert.ok(observer);
    assert.ok(reserved);
    assert.equal(observer.halt_initiator, "no");
    assert.equal(reserved.halt_initiator, "no");
    assert.equal(reserved.placementStatus, "reserved");
    assert.deepEqual(reserved.live_g1_comm_ids, []);
    assert.equal(
      pkg.topology.mappings.some((row) => row.node_id === "node.observer.404"),
      false,
    );

    const mutated = structuredClone(pkg);
    const target = mutated.nodes.find((row) => row.node_id === "node.observer.404");
    assert.ok(target);
    target.halt_initiator = "open";
    const result = checkG3Topology(mutated);
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.failures.some((row) => row.code === "halt-initiator"));
  });

  it("records provider children, Git/CLI endpoints, and human editor-launch", () => {
    const pkg = loadG3Package(repoRoot);
    assert.ok(pkg.nodes.some((row) => row.node_id === "node.provider.codex"));
    assert.ok(
      pkg.bindings.some(
        (row) =>
          row.node_id === "node.provider.codex" &&
          row.relationship === "permissioned-child" &&
          row.bus_id === "bus.provider",
      ),
    );
    const github = pkg.topology.mappings.find((row) => row.comm_id === "INV-T2-SC-GITHUB");
    assert.ok(github);
    assert.equal(github.node_id, "node.source-control");
    assert.equal(github.endpoint, "GitHubCli");
    const editor = pkg.topology.mappings.find((row) => row.comm_id === "INV-T2-EDITOR-LAUNCH");
    assert.ok(editor);
    assert.equal(editor.node_id, "node.lifecycle");
    assert.equal(editor.row_authority_class, "human");
  });

  it("rejects completion that authorizes later gates and keeps G1 frozen", () => {
    const pkg = loadG3Package(repoRoot);
    const mutated = structuredClone(pkg);
    mutated.manifest.status = "completed";
    mutated.manifest.authorized = true;
    mutated.manifest.completed = true;
    mutated.manifest.doesNotAuthorizeLaterGates = false;
    mutated.manifest.g4toG7Authorized = true;
    const result = checkG3Topology(mutated);
    assert.equal(result.ok, false);
    assert.ok(
      result.ok === false &&
        result.failures.some(
          (row) => row.code === "later-gates" || row.code === "g4-g7-authorized",
        ),
    );
    assert.equal(existsSync(join(g3Dir, "node-roster.json")), true);
    assert.equal(existsSync(join(g3Dir, "bus-roster.json")), true);
    assert.equal(existsSync(join(g3Dir, "inventory-topology.json")), true);
    const g3Sources = [
      readFileSync(join(g3Dir, "README.md"), "utf8"),
      readFileSync(join(repoRoot, "apps/server/src/scm/g3Topology.ts"), "utf8"),
    ].join("\n");
    assert.equal(g3Sources.includes("createRuntimeBus"), false);
    assert.equal(g3Sources.includes("W1Word"), false);
  });

  it("rejects overlay authority that does not equal frozen G1 authority", () => {
    const pkg = loadG3Package(repoRoot);
    const cases: ReadonlyArray<{ commId: string; next: string }> = [
      { commId: "INV-T2-HTTP-AUTH", next: "A2" },
      { commId: "INV-T2-RPC-STREAM-TEL", next: "A2" },
      { commId: "INV-T2-EDITOR-LAUNCH", next: "A2" },
    ];
    for (const { commId, next } of cases) {
      const mutated = structuredClone(pkg);
      const row = mutated.topology.mappings.find((item) => item.comm_id === commId);
      assert.ok(row, commId);
      row.row_authority_class = next;
      const result = checkG3Topology(mutated);
      assert.equal(result.ok, false, commId);
      assert.ok(
        result.ok === false && result.failures.some((item) => item.code === "row-authority"),
        commId,
      );
    }

    const missing = structuredClone(pkg);
    const authRow = missing.topology.mappings.find((item) => item.comm_id === "INV-T2-HTTP-AUTH");
    assert.ok(authRow);
    delete authRow.row_authority_class;
    const missingResult = checkG3Topology(missing);
    assert.equal(missingResult.ok, false);
    assert.ok(
      missingResult.ok === false &&
        missingResult.failures.some((item) => item.code === "row-authority"),
    );
  });

  it("requires explicit intended bus relationship disposition for A1, human, and observer rows", () => {
    const pkg = loadG3Package(repoRoot);
    const auth = pkg.topology.mappings.find((row) => row.comm_id === "INV-T2-HTTP-AUTH");
    const human = pkg.topology.mappings.find((row) => row.comm_id === "INV-T2-EDITOR-LAUNCH");
    const observer = pkg.topology.mappings.find((row) => row.comm_id === "INV-T2-TEL-NDJSON");
    assert.ok(auth);
    assert.ok(human);
    assert.ok(observer);
    assert.equal(auth.origin_relationship, "home");
    assert.equal(auth.intended_bus_relationship, "authority");
    assert.equal(human.intended_bus_relationship, "authority");
    assert.equal(observer.intended_bus_relationship, "linked");
    assert.ok(
      pkg.bindings.some(
        (row) =>
          row.node_id === "node.rpc" &&
          row.bus_id === "bus.rpc" &&
          row.relationship === "authority",
      ),
    );
    assert.ok(
      pkg.bindings.some(
        (row) => row.node_id === "node.t2-observer" && row.relationship === "linked",
      ),
    );

    const mutated = structuredClone(pkg);
    const mutatedAuth = mutated.topology.mappings.find((row) => row.comm_id === "INV-T2-HTTP-AUTH");
    assert.ok(mutatedAuth);
    mutatedAuth.intended_bus_relationship = "home";
    const result = checkG3Topology(mutated);
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.failures.some((row) => row.code === "relationship"));
  });

  it("rejects contradictory placement tuples", () => {
    const pkg = loadG3Package(repoRoot);
    const unplacedMarkedPlaced = structuredClone(pkg);
    unplacedMarkedPlaced.topology.mappings[0] = {
      ...unplacedMarkedPlaced.topology.mappings[0]!,
      node_id: "unplaced",
      placementStatus: "placed",
      home_bus_id: null,
      origin_bus_id: null,
      placement: {
        gapId: "G3-GAP-TEST",
        steward: "t2-server-host",
        reason: "test",
        resolutionEvidence: "test",
      },
    };
    const unplacedMarkedPlacedResult = checkG3Topology(unplacedMarkedPlaced);
    assert.equal(unplacedMarkedPlacedResult.ok, false);
    assert.ok(
      unplacedMarkedPlacedResult.ok === false &&
        unplacedMarkedPlacedResult.failures.some((row) => row.code === "placement"),
    );

    const placedMarkedUnplaced = structuredClone(pkg);
    placedMarkedUnplaced.topology.mappings[0] = {
      ...placedMarkedUnplaced.topology.mappings[0]!,
      node_id: "node.rpc",
      placementStatus: "unplaced",
      home_bus_id: "bus.rpc",
      origin_bus_id: "bus.rpc",
    };
    const placedMarkedUnplacedResult = checkG3Topology(placedMarkedUnplaced);
    assert.equal(placedMarkedUnplacedResult.ok, false);
    assert.ok(
      placedMarkedUnplacedResult.ok === false &&
        placedMarkedUnplacedResult.failures.some((row) => row.code === "placement"),
    );
  });

  it("rejects placed-node membership lists rather than treating them as topology truth", () => {
    const pkg = loadG3Package(repoRoot);
    const mutated = structuredClone(pkg);
    mutated.nodes[0] = {
      ...mutated.nodes[0]!,
      live_g1_comm_ids: ["INV-T2-INVENTED"],
    };
    const result = checkG3Topology(mutated);
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.failures.some((row) => row.code === "membership"));
  });

  it("rejects reserved 404 that omits live_g1_comm_ids", () => {
    const pkg = loadG3Package(repoRoot);
    const mutated = structuredClone(pkg);
    const target = mutated.nodes.find((row) => row.node_id === "node.observer.404");
    assert.ok(target);
    delete target.live_g1_comm_ids;
    const result = checkG3Topology(mutated);
    assert.equal(result.ok, false);
    assert.ok(
      result.ok === false &&
        result.failures.some((row) => row.code === "reserved-404" || row.code === "shape"),
    );
  });

  it("rejects reserved live_g1_comm_ids null as shape without throwing", () => {
    const pkg = loadG3Package(repoRoot);
    const mutated = structuredClone(pkg);
    const target = mutated.nodes.find((row) => row.node_id === "node.observer.404");
    assert.ok(target);
    (target as { live_g1_comm_ids?: unknown }).live_g1_comm_ids = null;
    const result = checkG3Topology(mutated);
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.failures.some((row) => row.code === "shape"));
  });

  it("rejects reserved live_g1_comm_ids non-array as shape without throwing", () => {
    const pkg = loadG3Package(repoRoot);
    const mutated = structuredClone(pkg);
    const target = mutated.nodes.find((row) => row.node_id === "node.observer.404");
    assert.ok(target);
    (target as { live_g1_comm_ids?: unknown }).live_g1_comm_ids = "nope";
    const result = checkG3Topology(mutated);
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.failures.some((row) => row.code === "shape"));
  });

  it("rejects reserved live_g1_comm_ids non-string members as shape without throwing", () => {
    const pkg = loadG3Package(repoRoot);
    const badMembers: ReadonlyArray<unknown> = [null, 42, {}];
    for (const member of badMembers) {
      const mutated = structuredClone(pkg);
      const target = mutated.nodes.find((row) => row.node_id === "node.observer.404");
      assert.ok(target);
      (target as { live_g1_comm_ids?: unknown }).live_g1_comm_ids = [member];
      const result = checkG3Topology(mutated);
      assert.equal(result.ok, false, `reserved:[${JSON.stringify(member)}]`);
      assert.ok(
        result.ok === false && result.failures.some((row) => row.code === "shape"),
        `reserved:[${JSON.stringify(member)}]`,
      );
    }
  });

  it("rejects placed live_g1_comm_ids string list as membership", () => {
    const pkg = loadG3Package(repoRoot);
    const mutated = structuredClone(pkg);
    mutated.nodes[0] = {
      ...mutated.nodes[0]!,
      live_g1_comm_ids: ["INV-T2-RPC-WS"],
    };
    const result = checkG3Topology(mutated);
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.failures.some((row) => row.code === "membership"));
  });

  it("rejects placed live_g1_comm_ids [null] as shape without throwing", () => {
    const pkg = loadG3Package(repoRoot);
    const mutated = structuredClone(pkg);
    (mutated.nodes[0] as { live_g1_comm_ids?: unknown }).live_g1_comm_ids = [null];
    const result = checkG3Topology(mutated);
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.failures.some((row) => row.code === "shape"));
  });

  it("rejects G1 input hash drift while preserving overlay IDs", () => {
    const pkg = loadG3Package(repoRoot);
    const mutated = structuredClone(pkg);
    mutated.manifest.g1Inputs = {
      ...mutated.manifest.g1Inputs,
      inventorySha256: "00".repeat(32),
    };
    const result = checkG3Topology(mutated);
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.failures.some((row) => row.code === "g1-input-drift"));
  });

  it("rejects completed review that is missing or withheld", () => {
    const pkg = loadG3Package(repoRoot);
    const completed = structuredClone(pkg);
    completed.manifest.status = "completed";
    completed.manifest.authorized = true;
    completed.manifest.completed = true;
    delete (completed.manifest as { review?: unknown }).review;
    const result = checkG3Topology(completed);
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.failures.some((row) => row.code === "review"));

    const unboundHash = structuredClone(pkg);
    unboundHash.manifest.status = "completed";
    unboundHash.manifest.authorized = true;
    unboundHash.manifest.completed = true;
    unboundHash.manifest.review = {
      status: "approved",
      identity: "codex-independent-review",
      independentOfImplementationAuthor: true,
      reviewedArtifactHash: "a".repeat(64),
      note: "format-valid hash not bound to artifacts",
    };
    const unboundHashResult = checkG3Topology(unboundHash);
    assert.equal(unboundHashResult.ok, false);
    assert.ok(
      unboundHashResult.ok === false &&
        unboundHashResult.failures.some((row) => row.code === "review"),
    );
  });

  it("rejects completed review whose digest is bound to a spoofed identity or dependent author", () => {
    const pkg = loadG3Package(repoRoot);
    const bind = (identity: string, independent: boolean) => {
      const next = structuredClone(pkg);
      next.manifest.status = "completed";
      next.manifest.authorized = true;
      next.manifest.completed = true;
      next.manifest.doesNotAuthorizeLaterGates = true;
      next.manifest.g4toG7Authorized = false;
      next.manifest.review = {
        status: "approved",
        identity,
        independentOfImplementationAuthor: independent,
        reviewedArtifactHash: "",
        note: "spoofed identity still hashed",
      };
      next.manifest.review.reviewedArtifactHash = computeG3ReviewedArtifactHash(next);
      return next;
    };

    const dependentResult = checkG3Topology(bind("codex-independent-review", false));
    assert.equal(dependentResult.ok, false);
    assert.ok(
      dependentResult.ok === false && dependentResult.failures.some((row) => row.code === "review"),
    );

    const wrongIdentityResult = checkG3Topology(bind("self-review", true));
    assert.equal(wrongIdentityResult.ok, false);
    assert.ok(
      wrongIdentityResult.ok === false &&
        wrongIdentityResult.failures.some((row) => row.code === "review"),
    );
  });

  it("rejects bare unknown relationships and duplicate or empty bus IDs", () => {
    const pkg = loadG3Package(repoRoot);
    const unknown = structuredClone(pkg);
    unknown.bindings.push({
      node_id: "node.rpc",
      bus_id: "bus.rpc",
      relationship: "unknown",
    });
    const unknownResult = checkG3Topology(unknown);
    assert.equal(unknownResult.ok, false);
    assert.ok(
      unknownResult.ok === false &&
        unknownResult.failures.some((row) => row.code === "unknown-relationship"),
    );

    const duplicate = structuredClone(pkg);
    duplicate.buses.push({ ...duplicate.buses[0]! });
    const duplicateResult = checkG3Topology(duplicate);
    assert.equal(duplicateResult.ok, false);
    assert.ok(
      duplicateResult.ok === false &&
        duplicateResult.failures.some((row) => row.code === "duplicate-bus"),
    );

    const empty = structuredClone(pkg);
    empty.buses[0] = { ...empty.buses[0]!, bus_id: "" };
    const emptyResult = checkG3Topology(empty);
    assert.equal(emptyResult.ok, false);
    assert.ok(
      emptyResult.ok === false && emptyResult.failures.some((row) => row.code === "empty-id"),
    );
  });

  it("returns shape failures instead of throwing on malformed overlay JSON", () => {
    const pkg = loadG3Package(repoRoot);
    const missingNodes = structuredClone(pkg);
    (missingNodes as { nodes?: unknown }).nodes = undefined;
    const missingNodesResult = checkG3Topology(missingNodes);
    assert.equal(missingNodesResult.ok, false);
    assert.ok(
      missingNodesResult.ok === false &&
        missingNodesResult.failures.some((row) => row.code === "shape"),
    );

    const missingMappings = structuredClone(pkg);
    (missingMappings.topology as { mappings?: unknown }).mappings = null;
    const missingMappingsResult = checkG3Topology(missingMappings);
    assert.equal(missingMappingsResult.ok, false);
    assert.ok(
      missingMappingsResult.ok === false &&
        missingMappingsResult.failures.some((row) => row.code === "shape"),
    );

    const nullReview = structuredClone(pkg);
    (nullReview.manifest as { review?: unknown }).review = null;
    const nullReviewResult = checkG3Topology(nullReview);
    assert.equal(nullReviewResult.ok, false);
    assert.ok(
      nullReviewResult.ok === false &&
        nullReviewResult.failures.some((row) => row.code === "review" || row.code === "shape"),
    );

    const nullGap = structuredClone(pkg);
    nullGap.topology.mappings[0] = {
      ...nullGap.topology.mappings[0]!,
      node_id: "unplaced",
      placementStatus: "unplaced",
      home_bus_id: null,
      origin_bus_id: null,
    };
    (nullGap.topology.mappings[0] as { placement?: unknown }).placement = null;
    const nullGapResult = checkG3Topology(nullGap);
    assert.equal(nullGapResult.ok, false);
    assert.ok(
      nullGapResult.ok === false &&
        nullGapResult.failures.some((row) => row.code === "unplaced-gap" || row.code === "shape"),
    );

    const nullG1Row = structuredClone(pkg);
    (nullG1Row as { g1Rows: unknown }).g1Rows = [null];
    const nullG1RowResult = checkG3Topology(nullG1Row);
    assert.equal(nullG1RowResult.ok, false);
    assert.ok(
      nullG1RowResult.ok === false && nullG1RowResult.failures.some((row) => row.code === "shape"),
    );

    const collections: ReadonlyArray<{ path: "nodes" | "buses" | "bindings" | "mappings" }> = [
      { path: "nodes" },
      { path: "buses" },
      { path: "bindings" },
      { path: "mappings" },
    ];
    const members: ReadonlyArray<unknown> = [null, 42, {}];
    for (const { path } of collections) {
      for (const member of members) {
        const mutated = structuredClone(pkg);
        if (path === "mappings") {
          mutated.topology.mappings = [member as (typeof mutated.topology.mappings)[number]];
        } else if (path === "nodes") {
          mutated.nodes = [member as (typeof mutated.nodes)[number]];
        } else if (path === "buses") {
          mutated.buses = [member as (typeof mutated.buses)[number]];
        } else {
          mutated.bindings = [member as (typeof mutated.bindings)[number]];
        }
        const result = checkG3Topology(mutated);
        assert.equal(result.ok, false, `${path}:${JSON.stringify(member)}`);
        assert.ok(
          result.ok === false && result.failures.some((row) => row.code === "shape"),
          `${path}:${JSON.stringify(member)}`,
        );
      }
    }
  });

  it("rejects open node-roster placement vocabulary and illegal placement tuples", () => {
    const pkg = loadG3Package(repoRoot);
    for (const status of ["", "unknown", "invalid", "unplaced"]) {
      const mutated = structuredClone(pkg);
      mutated.nodes[0] = { ...mutated.nodes[0]!, placementStatus: status };
      const result = checkG3Topology(mutated);
      assert.equal(result.ok, false, status);
      assert.ok(
        result.ok === false && result.failures.some((row) => row.code === "placement"),
        status,
      );
    }

    const reservedHome = structuredClone(pkg);
    reservedHome.bindings.push({
      node_id: "node.observer.404",
      bus_id: "bus.observer",
      relationship: "home",
    });
    const reservedHomeResult = checkG3Topology(reservedHome);
    assert.equal(reservedHomeResult.ok, false);
    assert.ok(
      reservedHomeResult.ok === false &&
        reservedHomeResult.failures.some((row) => row.code === "placement"),
    );

    const extraReserved = structuredClone(pkg);
    extraReserved.nodes.push({
      node_id: "node.invented.reserved",
      halt_initiator: "no",
      baseline_authority: "observer",
      placementStatus: "reserved",
      live_g1_comm_ids: [],
    });
    const extraReservedResult = checkG3Topology(extraReserved);
    assert.equal(extraReservedResult.ok, false);
    assert.ok(
      extraReservedResult.ok === false &&
        extraReservedResult.failures.some(
          (row) => row.code === "placement" || row.code === "reserved-404",
        ),
    );
  });

  it("binds completed review hash to G3 artifacts and rejects one-byte drift", () => {
    const pkg = loadG3Package(repoRoot);
    const approve = () => {
      const next = structuredClone(pkg);
      next.manifest.status = "completed";
      next.manifest.authorized = true;
      next.manifest.completed = true;
      next.manifest.doesNotAuthorizeLaterGates = true;
      next.manifest.g4toG7Authorized = false;
      next.manifest.review = {
        status: "approved",
        identity: "codex-independent-review",
        independentOfImplementationAuthor: true,
        reviewedArtifactHash: "",
        note: "bound",
      };
      next.manifest.review.reviewedArtifactHash = computeG3ReviewedArtifactHash(next);
      return next;
    };

    const bound = approve();
    const boundResult = checkG3Topology(bound);
    assert.equal(
      boundResult.ok,
      true,
      boundResult.ok ? "" : boundResult.failures.map((row) => row.message).join("\n"),
    );

    const nodeDrift = approve();
    nodeDrift.nodes[0] = {
      ...nodeDrift.nodes[0]!,
      baseline_authority: `${nodeDrift.nodes[0]!.baseline_authority}x`,
    };
    nodeDrift.manifest.review = {
      ...nodeDrift.manifest.review!,
      reviewedArtifactHash: bound.manifest.review!.reviewedArtifactHash,
    };
    const nodeResult = checkG3Topology(nodeDrift);
    assert.equal(nodeResult.ok, false);
    assert.ok(nodeResult.ok === false && nodeResult.failures.some((row) => row.code === "review"));

    const busDrift = approve();
    busDrift.buses[0] = { ...busDrift.buses[0]!, steward: `${busDrift.buses[0]!.steward}x` };
    busDrift.manifest.review = {
      ...busDrift.manifest.review!,
      reviewedArtifactHash: bound.manifest.review!.reviewedArtifactHash,
    };
    const busResult = checkG3Topology(busDrift);
    assert.equal(busResult.ok, false);
    assert.ok(busResult.ok === false && busResult.failures.some((row) => row.code === "review"));

    const topologyDrift = approve();
    topologyDrift.topology.mappings[0] = {
      ...topologyDrift.topology.mappings[0]!,
      endpoint: `${topologyDrift.topology.mappings[0]!.endpoint ?? ""}x`,
    };
    topologyDrift.manifest.review = {
      ...topologyDrift.manifest.review!,
      reviewedArtifactHash: bound.manifest.review!.reviewedArtifactHash,
    };
    const topologyResult = checkG3Topology(topologyDrift);
    assert.equal(topologyResult.ok, false);
    assert.ok(
      topologyResult.ok === false && topologyResult.failures.some((row) => row.code === "review"),
    );

    const manifestDrift = approve();
    (
      manifestDrift.manifest as {
        authorization?: { identity?: string; scope?: string; note?: string };
      }
    ).authorization = {
      identity: "human-operator",
      scope: "g3-execution",
      note: "x",
    };
    manifestDrift.manifest.review = {
      ...manifestDrift.manifest.review!,
      reviewedArtifactHash: bound.manifest.review!.reviewedArtifactHash,
    };
    const manifestResult = checkG3Topology(manifestDrift);
    assert.equal(manifestResult.ok, false);
    assert.ok(
      manifestResult.ok === false && manifestResult.failures.some((row) => row.code === "review"),
    );
  });
});
