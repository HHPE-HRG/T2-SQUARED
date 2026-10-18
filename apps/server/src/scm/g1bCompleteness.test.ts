// @effect-diagnostics nodeBuiltinImport:off
/**
 * G1B inventory enforcement tests.
 *
 * These tests prove the frozen G1A boundary, retained results, catalog
 * registry, and negative-control path are consistent with completed D15C
 * rows. They must not claim that every conceivable live communication has
 * a row.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";

import { T2_CATALOG_BOUNDARIES } from "../t2Observability/boundaries.ts";
import { checkG1bCompleteness, loadG1bPackage, NEGATIVE_CONTROL_PATH_ID } from "./g1bInventory.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const g1bDir = join(repoRoot, "docs/scm/g1b");

/** Mutable clone for negative-path completeness mutations (structuredClone keeps readonly). */
const draft = (pkg: ReturnType<typeof loadG1bPackage>): any => structuredClone(pkg);

const FORBIDDEN_NO_LIVE_COMM_IDS = [
  "INV-T2-ADMIT",
  "INV-T2-EVIDENCE",
  "INV-T2-STE",
  "INV-T2-AUTH",
  "INV-T2-REGISTRY",
] as const;

describe("G1B D15C inventory", () => {
  it("records approved G1 closure without claiming total inventory completeness", () => {
    const pkg = loadG1bPackage(repoRoot);
    assert.equal(pkg.manifest.gate, "G1B");
    assert.equal(pkg.manifest.status, "g1-closed");
    assert.equal(pkg.manifest.g1Closed, true);
    assert.equal(pkg.manifest.a7.g1ExitReview, "approved");
    assert.equal(pkg.manifest.a7.identity, "codex-independent-review");
    assert.equal(pkg.manifest.g3Authorized, false);
    assert.equal(pkg.manifest.g4toG7Authorized, false);
    assert.equal(pkg.manifest.doesNotClaim, "every live communication has an inventory row");
    assert.equal(existsSync(join(g1bDir, "inventory.json")), true);
    assert.equal(existsSync(join(g1bDir, "coverage.json")), true);
    assert.equal(existsSync(join(repoRoot, "docs/scm/g1a/retained-results.json")), true);
    assert.equal(existsSync(join(g1bDir, "aggregation.md")), true);
  });

  it("materializes completed D15C rows for every G1A retained result or governed exclusion", () => {
    const pkg = loadG1bPackage(repoRoot);
    const result = checkG1bCompleteness(pkg);
    assert.equal(
      result.ok,
      true,
      result.ok ? "" : result.failures.map((row) => row.message).join("\n"),
    );
    assert.ok(pkg.inventory.rows.length > 0);
    for (const commId of FORBIDDEN_NO_LIVE_COMM_IDS) {
      assert.equal(
        pkg.inventory.rows.some((row) => row.comm_id === commId),
        false,
        `${commId} must not exist: no live T2-host communication was discovered`,
      );
    }
    assert.ok(pkg.inventory.rows.some((row) => row.comm_id === "INV-T2-PROJECT-READ"));
    assert.ok(pkg.inventory.rows.some((row) => row.comm_id === "INV-T2-PROJECT-QUEUE"));
    assert.equal(
      pkg.inventory.rows.some((row) => row.comm_id === "INV-T2-RECEIPT-BUS"),
      false,
    );
    assert.equal(
      pkg.inventory.rows.some((row) => row.comm_id === "INV-T2-TEL-DESKTOP-FD"),
      false,
    );
    assert.equal(
      pkg.inventory.rows.some((row) => row.comm_id === "INV-T2-RPC-STREAM"),
      false,
    );
  });

  it("reconciles every T2_CATALOG_BOUNDARIES entry to at least one inventory row", () => {
    const pkg = loadG1bPackage(repoRoot);
    const result = checkG1bCompleteness(pkg);
    assert.equal(
      result.ok,
      true,
      result.ok ? "" : result.failures.map((row) => row.message).join("\n"),
    );
    for (const boundary of T2_CATALOG_BOUNDARIES) {
      assert.ok(
        pkg.inventory.rows.some((row) => row.catalog_boundary === boundary),
        `catalog boundary ${boundary} has no D15C row`,
      );
    }
  });

  it("fails completeness when the MCP HTTP negative-control row is removed", () => {
    const pkg = loadG1bPackage(repoRoot);
    const stripped = {
      ...pkg,
      inventory: {
        ...pkg.inventory,
        rows: pkg.inventory.rows.filter(
          (row: { comm_id: string }) => row.comm_id !== "INV-T2-MCP-HTTP",
        ),
      },
    };
    const result = checkG1bCompleteness(stripped);
    assert.equal(result.ok, false);
    assert.ok(
      result.ok === false &&
        result.failures.some(
          (row) =>
            row.code === "negative-control-missing" &&
            row.message.includes("INV-T2-MCP-HTTP") &&
            row.message.includes(NEGATIVE_CONTROL_PATH_ID),
        ),
    );
  });

  it("fails completeness when a required D15C column is empty", () => {
    const pkg = loadG1bPackage(repoRoot);
    const blanked = draft(pkg);
    const first = blanked.inventory.rows[0];
    assert.ok(first);
    first.name = "";
    const result = checkG1bCompleteness(blanked);
    assert.equal(result.ok, false);
    assert.ok(
      result.ok === false && result.failures.some((row) => row.code === "empty-d15c-column"),
    );
  });

  it("records BitbucketApi as external-transport HTTP, not subprocess CLI", () => {
    const pkg = loadG1bPackage(repoRoot);
    const bitbucket = pkg.inventory.rows.find((row) => row.comm_id === "INV-T2-SC-BITBUCKET");
    assert.ok(bitbucket);
    assert.equal(bitbucket.mechanism_classes.includes("external-transport"), true);
    assert.equal(bitbucket.mechanism_classes.includes("subprocess"), false);
    assert.ok(bitbucket.transport_boundary.toLowerCase().includes("http"));
  });

  it("requires exact set equality between frozen G1A retained-result IDs and coverage IDs", () => {
    const pkg = loadG1bPackage(repoRoot);
    const frozenIds = pkg.retainedResults.results.map((row) => row.id).sort();
    const coverageIds = pkg.coverage.results.map((row) => row.id).sort();
    assert.deepEqual(coverageIds, frozenIds);

    const stripped = draft(pkg);
    stripped.coverage.results = stripped.coverage.results.filter(
      (row: { id: string }) => row.id !== "G1A-PROVIDER-STREAMS",
    );
    const result = checkG1bCompleteness(stripped);
    assert.equal(result.ok, false);
    assert.ok(
      result.ok === false &&
        result.failures.some(
          (row) => row.code === "coverage-id-set" && row.message.includes("G1A-PROVIDER-STREAMS"),
        ),
    );
  });

  it("rejects transferring MCP negative-control metadata onto another row", () => {
    const pkg = loadG1bPackage(repoRoot);
    const transferred = draft(pkg);
    transferred.inventory.rows = transferred.inventory.rows.filter(
      (row: { comm_id: string }) => row.comm_id !== "INV-T2-MCP-HTTP",
    );
    const host = transferred.inventory.rows.find(
      (row: { comm_id: string }) => row.comm_id === "INV-T2-HTTP-STATIC",
    );
    assert.ok(host);
    host.path_id = NEGATIVE_CONTROL_PATH_ID;
    host.negative_control = true;
    transferred.coverage.results = transferred.coverage.results.map(
      (row: { id: string; comm_ids: string[] }) =>
        row.id === "G1A-EXT-MCP" ? { ...row, comm_ids: ["INV-T2-HTTP-STATIC"] } : row,
    );
    const result = checkG1bCompleteness(transferred);
    assert.equal(result.ok, false);
    assert.ok(
      result.ok === false &&
        result.failures.some(
          (row) =>
            row.code === "negative-control-identity" || row.code === "negative-control-missing",
        ),
    );
  });

  it("rejects an arbitrary coverage disposition string", () => {
    const pkg = loadG1bPackage(repoRoot);
    const mutated = draft(pkg);
    const target = mutated.coverage.results.find(
      (row: { id: string }) => row.id === "G1A-NO-LIVE-ADMISSION",
    );
    assert.ok(target);
    target.disposition = "skip";
    const result = checkG1bCompleteness(mutated);
    assert.equal(result.ok, false);
    assert.ok(
      result.ok === false && result.failures.some((row) => row.code === "disposition-unknown"),
    );
  });

  it("splits desktop-host telemetry input, control output, and native monitor protocol", () => {
    const pkg = loadG1bPackage(repoRoot);
    const input = pkg.inventory.rows.find((row) => row.comm_id === "INV-T2-TEL-DESKTOP-IN");
    const control = pkg.inventory.rows.find((row) => row.comm_id === "INV-T2-TEL-DESKTOP-CONTROL");
    const monitor = pkg.inventory.rows.find((row) => row.comm_id === "INV-T2-RES-MONITOR");
    assert.ok(input);
    assert.ok(control);
    assert.ok(monitor);
    assert.ok(
      input.symbols?.includes("apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts"),
    );
    assert.ok(
      control.symbols?.includes("apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts"),
    );
    assert.ok(
      monitor.symbols?.includes("apps/server/src/resourceTelemetry/NativeTelemetryClient.ts"),
    );
    assert.ok(input.transport_boundary.toLowerCase().includes("telemetry"));
    assert.ok(control.transport_boundary.toLowerCase().includes("control"));
    assert.equal(input.mechanism_classes.includes("external-transport"), true);
    assert.equal(control.mechanism_classes.includes("external-transport"), true);
    assert.equal(monitor.mechanism_classes.includes("subprocess"), true);
  });

  it("splits RPC subscribe streams by D15C identity families", () => {
    const pkg = loadG1bPackage(repoRoot);
    const families = [
      "INV-T2-RPC-STREAM-TERM",
      "INV-T2-RPC-STREAM-ORCH",
      "INV-T2-RPC-STREAM-TEL",
      "INV-T2-RPC-STREAM-AUTH",
      "INV-T2-RPC-STREAM-CONFIG",
      "INV-T2-RPC-STREAM-DISCOVERY",
    ] as const;
    for (const commId of families) {
      const row = pkg.inventory.rows.find((candidate) => candidate.comm_id === commId);
      assert.ok(row, commId);
      assert.equal(row.aggregation_rule === undefined, true, commId);
      assert.equal(row.mechanism_classes.includes("streams"), true, commId);
    }
    const auth = pkg.inventory.rows.find((row) => row.comm_id === "INV-T2-RPC-STREAM-AUTH");
    const telemetry = pkg.inventory.rows.find((row) => row.comm_id === "INV-T2-RPC-STREAM-TEL");
    assert.ok(auth);
    assert.ok(telemetry);
    assert.equal(auth.authority_class, "A1");
    assert.equal(telemetry.authority_class, "observer");
    assert.notEqual(auth.sender, telemetry.sender);
  });

  it("maps the complete G1A derived-file path list without truncated hidden members", () => {
    const pkg = loadG1bPackage(repoRoot);
    const frozen = pkg.retainedResults.results.find((row) => row.id === "G1A-DERIVED-FILES");
    assert.ok(frozen);
    for (const pathName of [
      "stateDir",
      "dbPath",
      "keybindingsConfigPath",
      "settingsPath",
      "providerStatusCacheDir",
      "worktreesDir",
      "attachmentsDir",
      "logsDir",
      "serverLogPath",
      "serverTracePath",
      "providerLogsDir",
      "providerEventLogPath",
      "terminalLogsDir",
      "anonymousIdPath",
      "environmentIdPath",
      "serverRuntimeStatePath",
      "secretsDir",
    ]) {
      assert.ok(frozen.quote.includes(pathName), pathName);
    }
    const coverage = pkg.coverage.results.find((row) => row.id === "G1A-DERIVED-FILES");
    assert.ok(coverage);
    for (const commId of [
      "INV-T2-SQLITE",
      "INV-T2-FILE-SETTINGS",
      "INV-T2-FILE-RUNTIME-STATE",
      "INV-T2-FILE-SECRETS",
      "INV-T2-FILE-LOGS",
      "INV-T2-FILE-PROVIDER-SESSION",
      "INV-T2-FILE-WORKTREES",
      "INV-T2-FILE-ATTACHMENTS",
      "INV-T2-FILE-USAGE-CACHE",
      "INV-T2-TEL-T3-TRACE",
    ]) {
      assert.ok(coverage.comm_ids?.includes(commId), commId);
      assert.ok(
        pkg.inventory.rows.some((row) => row.comm_id === commId),
        commId,
      );
    }
  });

  it("rejects structured aggregation members whose D15C identity diverges from the row", () => {
    const pkg = loadG1bPackage(repoRoot);
    const mutated = draft(pkg);
    const logs = mutated.inventory.rows.find(
      (row: { comm_id: string }) => row.comm_id === "INV-T2-FILE-LOGS",
    );
    assert.ok(logs);
    assert.ok(Array.isArray(logs.aggregated_members) && logs.aggregated_members.length >= 2);
    const first = logs.aggregated_members[0];
    assert.ok(first && typeof first === "object");
    first.authority_class = "A0";
    const result = checkG1bCompleteness(mutated);
    assert.equal(result.ok, false);
    assert.ok(
      result.ok === false && result.failures.some((row) => row.code === "aggregation-identity"),
    );
  });

  it("enforces exact A7 review / status / g1Closed tuples", () => {
    const pkg = loadG1bPackage(repoRoot);
    const expectTupleFailure = (patch: {
      readonly review: string;
      readonly status: string;
      readonly g1Closed: boolean;
    }) => {
      const mutated = draft(pkg);
      mutated.manifest.a7 = { ...mutated.manifest.a7, g1ExitReview: patch.review };
      mutated.manifest.status = patch.status;
      mutated.manifest.g1Closed = patch.g1Closed;
      mutated.manifest.g3Authorized = false;
      mutated.manifest.g4toG7Authorized = false;
      const result = checkG1bCompleteness(mutated);
      assert.equal(result.ok, false);
      assert.ok(result.ok === false && result.failures.some((row) => row.code === "closure-tuple"));
    };

    expectTupleFailure({
      review: "approved",
      status: "awaiting-a7-g1-exit",
      g1Closed: true,
    });
    expectTupleFailure({
      review: "approved",
      status: "g1-closed",
      g1Closed: false,
    });
    expectTupleFailure({
      review: "pending",
      status: "g1-closed",
      g1Closed: false,
    });
    expectTupleFailure({
      review: "withheld",
      status: "a7-withheld",
      g1Closed: true,
    });

    const approvedClosed = draft(pkg);
    approvedClosed.manifest.a7 = { ...approvedClosed.manifest.a7, g1ExitReview: "approved" };
    approvedClosed.manifest.status = "g1-closed";
    approvedClosed.manifest.g1Closed = true;
    approvedClosed.manifest.g3Authorized = false;
    approvedClosed.manifest.g4toG7Authorized = false;
    const approvedResult = checkG1bCompleteness(approvedClosed);
    assert.equal(
      approvedResult.ok,
      true,
      approvedResult.ok ? "" : approvedResult.failures.map((row) => row.message).join("\n"),
    );

    const authorized = draft(approvedClosed);
    authorized.manifest.g3Authorized = true;
    const authorizedResult = checkG1bCompleteness(authorized);
    assert.equal(authorizedResult.ok, false);
    assert.ok(
      authorizedResult.ok === false &&
        authorizedResult.failures.some((row) => row.code === "g3-authorized"),
    );
  });
});
