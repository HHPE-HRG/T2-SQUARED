/**
 * Admission-reconcile exits from the 20 October review.
 *
 * Intended: schema and digest drift stay pending, unknown machine ids and
 * canBus aliases deny, opaque payloads are exempt, removal and revoke block,
 * unchanged admitted tools dispatch, coverage emits four classes, and the
 * G10 radius stays 73 activatable + 1 dormant.
 */
import { PREVIEW_AUTOMATION_OPERATIONS } from "@t3tools/contracts";
import { assert, describe, it } from "@effect/vitest";

import { PreviewToolkit } from "../mcp/toolkits/preview/tools.ts";
import {
  ADMISSION_RECONCILE_ENV,
  HOME_BUS_ACTIVATED,
  admitCapability,
  createCapabilityRecord,
  judgeMachineIdentifier,
  revokeCapability,
  suspendCapability,
  type CapabilityRecord,
} from "./admissionCatalog.ts";
import { joinCoverage } from "./admissionCoverage.ts";
import {
  discoverHostMcpServers,
  discoverPreviewTools,
  discoverProviderNative,
  discoverSkillEntries,
  previewCapabilityIdForOperation,
} from "./admissionDiscover.ts";
import {
  ADMISSION_RECONCILE_ENV_DISTINCT,
  ADMISSION_RECONCILE_REQUIRES_RESTART,
  decideDispatch,
} from "./admissionDispatch.ts";
import { canonicalCatalog, compareCatalog } from "./admissionDrift.ts";
import { CODEC_ENV } from "./codecBootstrap.ts";
import { EQUALITY_IR_ENV } from "./equalityIrBootstrap.ts";
import { FABRIC_DEPTH_ENV } from "./fabricDepthBootstrap.ts";
import { G10_DORMANT_HOME_BUS_COMM_ID, loadG10CutoverRegistry } from "./g10CutoverRegistry.ts";
import { G10_CUTOVER_ENV } from "./g10Bootstrap.ts";
import { G10_S8_ACTIVATABLE_RADIUS_COUNT, G10_S8_DORMANT_EXEMPT_COUNT } from "./g10SliceS8.ts";

const tool = (
  capabilityId: string,
  patch: Partial<Parameters<typeof createCapabilityRecord>[0]> = {},
) =>
  createCapabilityRecord({
    capability_id: capabilityId,
    node_id: "node.tool",
    operation: "run",
    class_id: "C2",
    effect_classes: ["E0"],
    boundary: "B0",
    adapter_type: "test",
    implementation_digest: "digest-1",
    input_schema: "schema-1",
    output_schema: "out-1",
    allowed_destinations: ["local"],
    ...patch,
  });

const admit = (record: CapabilityRecord) => admitCapability([record], record.capability_id);

describe("admission reconcile", () => {
  it("keeps its env distinct and default-off", () => {
    assert.equal(ADMISSION_RECONCILE_ENV, "T2CODE_SCM_ADMISSION_RECONCILE");
    assert.equal(ADMISSION_RECONCILE_ENV_DISTINCT, true);
    assert.equal(ADMISSION_RECONCILE_REQUIRES_RESTART, true);
    assert.notEqual(ADMISSION_RECONCILE_ENV, CODEC_ENV);
    assert.notEqual(ADMISSION_RECONCILE_ENV, EQUALITY_IR_ENV);
    assert.notEqual(ADMISSION_RECONCILE_ENV, FABRIC_DEPTH_ENV);
    assert.notEqual(ADMISSION_RECONCILE_ENV, G10_CUTOVER_ENV);
    assert.equal(HOME_BUS_ACTIVATED, false);
  });

  it("refuses a live home-bus id", () => {
    assert.throws(() => tool("tool.home", { home_bus_id: "bus.scm.a" }), /home bus stays dormant/);
  });

  it("holds schema drift as pending and does not dispatch", () => {
    const proposed = tool("tool.schema");
    const admitted = admit(proposed);
    const drifted = tool("tool.schema", { input_schema: "schema-2" });
    const compared = compareCatalog(admitted, [drifted]);
    const delta = compared.deltas.find((row) => row.capability_id === "tool.schema");
    assert.equal(delta?.kind, "schema");
    assert.equal(delta?.pending, true);
    assert.equal(compared.records[0]?.admission_state, "proposed");
    assert.notEqual(canonicalCatalog(admitted), canonicalCatalog(compared.records));
    const decision = decideDispatch({
      capabilityId: "tool.schema",
      operation: "run",
      records: compared.records,
      deltas: compared.deltas,
    });
    assert.deepEqual(decision, {
      allow: false,
      capabilityId: "tool.schema",
      reason: "pending-drift",
    });
  });

  it("holds effect and destination drift as pending", () => {
    const proposed = tool("tool.effect");
    const admitted = admit(proposed);
    const effectCompared = compareCatalog(admitted, [
      tool("tool.effect", { effect_classes: ["E3"] }),
    ]);
    assert.equal(effectCompared.deltas[0]?.kind, "effect");
    const destinationCompared = compareCatalog(admitted, [
      tool("tool.effect", { allowed_destinations: ["remote"] }),
    ]);
    assert.equal(destinationCompared.deltas[0]?.kind, "destination");
    const decision = decideDispatch({
      capabilityId: "tool.effect",
      operation: "run",
      records: destinationCompared.records,
      deltas: destinationCompared.deltas,
    });
    assert.equal(decision.allow, false);
    if (!decision.allow) assert.equal(decision.reason, "pending-drift");
  });

  it("holds digest drift as pending and does not dispatch", () => {
    const proposed = tool("tool.digest");
    const admitted = admit(proposed);
    const compared = compareCatalog(admitted, [
      tool("tool.digest", { implementation_digest: "digest-2" }),
    ]);
    assert.equal(compared.deltas[0]?.kind, "digest");
    const decision = decideDispatch({
      capabilityId: "tool.digest",
      operation: "run",
      records: compared.records,
      deltas: compared.deltas,
    });
    assert.equal(decision.allow, false);
    if (!decision.allow) assert.equal(decision.reason, "pending-drift");
  });

  it("dispatches an unchanged admitted tool", () => {
    const proposed = tool("tool.same");
    const admitted = admit(proposed);
    const compared = compareCatalog(admitted, [proposed]);
    assert.equal(compared.deltas[0]?.kind, "unchanged");
    assert.equal(compared.deltas[0]?.pending, false);
    assert.equal(compared.records[0]?.admission_state, "admitted");
    const decision = decideDispatch({
      capabilityId: "tool.same",
      operation: "run",
      records: compared.records,
      deltas: compared.deltas,
    });
    assert.deepEqual(decision, { allow: true, capabilityId: "tool.same" });
  });

  it("rejects an unknown capability id and exempts a quoted payload", () => {
    const admitted = admit(tool("tool.known"));
    const unknown = decideDispatch({
      capabilityId: "tool.missing",
      operation: "run",
      records: admitted,
      deltas: [],
    });
    assert.deepEqual(unknown, { allow: false, capabilityId: "tool.missing", reason: "unknown" });
    const quoted = judgeMachineIdentifier("operation", '"a quoted search result"', new Set());
    assert.deepEqual(quoted, { disposition: "opaque-exempt" });
    const prose = judgeMachineIdentifier("operation", "free form search result", new Set());
    assert.deepEqual(prose, { disposition: "opaque-exempt" });
    const machine = judgeMachineIdentifier("operation", "xyzzyGate", new Set(["run"]));
    assert.deepEqual(machine, { disposition: "unknown", kind: "operation" });
  });

  it("does not accept canBus as an SCM capability alias", () => {
    assert.throws(() => tool("canBus"), /canBus is not an SCM capability alias/);
    const decision = decideDispatch({
      capabilityId: "canBus",
      records: admit(tool("tool.known")),
      deltas: [],
    });
    assert.deepEqual(decision, { allow: false, capabilityId: "canBus", reason: "canBus-alias" });
    const operation = decideDispatch({
      capabilityId: "tool.known",
      operation: "can-bus",
      records: admit(tool("tool.known")),
      deltas: [],
    });
    assert.equal(operation.allow, false);
    if (!operation.allow) assert.equal(operation.reason, "canBus-alias");
  });

  it("blocks a removed endpoint and a revoked credential", () => {
    const admitted = admit(tool("tool.gone"));
    const removed = compareCatalog(admitted, []);
    assert.equal(removed.deltas[0]?.kind, "removed");
    assert.equal(removed.records[0]?.admission_state, "revoked");
    const removedDecision = decideDispatch({
      capabilityId: "tool.gone",
      operation: "run",
      records: removed.records,
      deltas: removed.deltas,
    });
    assert.deepEqual(removedDecision, {
      allow: false,
      capabilityId: "tool.gone",
      reason: "removed",
    });

    const revoked = revokeCapability(admitted, "tool.gone");
    const rediscovered = compareCatalog(revoked, [tool("tool.gone")]);
    assert.equal(rediscovered.records[0]?.admission_state, "revoked");
    const revokedDecision = decideDispatch({
      capabilityId: "tool.gone",
      operation: "run",
      records: revoked,
      deltas: [],
    });
    assert.deepEqual(revokedDecision, {
      allow: false,
      capabilityId: "tool.gone",
      reason: "revoked",
    });
  });

  it("denies a suspended capability and a missing snapshot", () => {
    const suspended = suspendCapability(admit(tool("tool.hold")), "tool.hold");
    const decision = decideDispatch({
      capabilityId: "tool.hold",
      operation: "run",
      records: suspended,
      deltas: [],
    });
    assert.deepEqual(decision, { allow: false, capabilityId: "tool.hold", reason: "suspended" });
    const missing = decideDispatch({ capabilityId: "tool.hold", records: null });
    assert.deepEqual(missing, {
      allow: false,
      capabilityId: "tool.hold",
      reason: "missing-snapshot",
    });
  });

  it("does not admit provider-native tools or a script because its skill was read", () => {
    const native = discoverProviderNative();
    const search = native.find((row) => row.capability_id === "provider.web_search");
    assert.ok(search);
    assert.equal(search.class_id, "C12");
    assert.equal(search.boundary, "B4");
    assert.equal(search.admission_state, "proposed");
    assert.throws(
      () => admitCapability(native, "provider.web_search"),
      /outside granular guarantees/,
    );

    const skills = discoverSkillEntries([
      { path: "skills/demo/SKILL.md", textDigest: "skill-digest" },
      { path: "skills/demo/scripts/search.py", textDigest: "script-digest" },
    ]);
    assert.equal(skills[0]?.class_id, "C1");
    assert.equal(skills[1]?.class_id, "C3");
    const admittedSkill = admitCapability(skills, "skill:skills/demo/SKILL.md");
    const script = admittedSkill.find(
      (row) => row.capability_id === "script:skills/demo/scripts/search.py",
    );
    assert.equal(script?.admission_state, "proposed");
    const scriptDecision = decideDispatch({
      capabilityId: "script:skills/demo/scripts/search.py",
      operation: "execute",
      records: admittedSkill,
      deltas: [],
    });
    assert.equal(scriptDecision.allow, false);
  });

  it("discovers host MCP servers as proposed nodes", () => {
    const rows = discoverHostMcpServers({ mcpServers: { xcodebuildmcp: { command: "npx" } } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.capability_id, "mcp-host:xcodebuildmcp");
    assert.equal(rows[0]?.admission_state, "proposed");
    assert.equal(rows[0]?.home_bus_id, "unknown");
  });

  it("matches preview tool names to the live toolkit", () => {
    const toolkitNames = Object.values(PreviewToolkit.tools)
      .map((entry) => entry.name)
      .sort();
    const mapped = PREVIEW_AUTOMATION_OPERATIONS.map((operation) =>
      previewCapabilityIdForOperation(operation),
    ).sort();
    assert.deepEqual(toolkitNames, mapped);
    const discovered = discoverPreviewTools(mapped);
    assert.equal(
      discovered.every((row) => row.admission_state === "proposed"),
      true,
    );
    const navigate = discovered.find((row) => row.capability_id === "preview_navigate");
    assert.equal(navigate?.operation, "navigate");
  });

  it("emits each coverage class and leaves the radius unchanged", () => {
    const admitted = admit(tool("declared.only"));
    const approved = admit(tool("tool.approved"));
    const findings = joinCoverage({
      records: [...admitted, ...approved],
      discoveredIds: ["preview_navigate"],
      outsideGuaranteeIds: ["provider.web_search"],
      g10CommIds: ["INV-T2-SETTINGS-EVENTS"],
      activities: [
        { capabilityId: "tool.ran", source: "orchestration-tool", hasEffectReceipt: false },
        { capabilityId: "tool.approved", source: "g9-occurrence", hasEffectReceipt: false },
      ],
    });
    const classes = findings.map((finding) => finding.coverageClass);
    assert.ok(classes.includes("declared-but-unreachable"));
    assert.ok(classes.includes("executable-but-unregistered"));
    assert.ok(classes.includes("executed-without-policy-record"));
    assert.ok(classes.includes("policy-approved-but-unconfirmed"));
    assert.equal(
      findings.some((finding) => finding.id === "provider.web_search"),
      true,
    );
    assert.equal(
      findings.some((finding) => finding.id === "INV-T2-SETTINGS-EVENTS"),
      true,
    );

    const registry = loadG10CutoverRegistry();
    assert.equal(G10_S8_ACTIVATABLE_RADIUS_COUNT, 73);
    assert.equal(G10_S8_DORMANT_EXEMPT_COUNT, 1);
    assert.equal(registry.radiusSet.size, G10_S8_ACTIVATABLE_RADIUS_COUNT);
    assert.equal(registry.dormantExempt.has(G10_DORMANT_HOME_BUS_COMM_ID), true);
    assert.equal(HOME_BUS_ACTIVATED, false);
  });
});
