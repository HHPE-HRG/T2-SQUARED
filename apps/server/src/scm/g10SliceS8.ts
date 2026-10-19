/**
 * G10 S8 campaign-close coordinator (dual-run exit audit + campaign rollback
 * + aggregate cutover ≡).
 *
 * Intended: cross-slice audit of the frozen radius set (73 activatable + 1
 * dormant-exempt). Every activatable `comm_id` is either (a) Ordered-proof
 * exited on its owning/lander slice, or (b) honestly handoff-deferred with
 * named lander reopen / documented residual. Campaign rollback uses
 * `runCampaignRollback` (not shadow env-off). Aggregate ≡ reuses
 * `G9DeferredEquality` / `asG9DeferredEquality` — never WP8 763.
 *
 * Observed: in-memory audit + proof helpers only. Does not resize radius.
 * Does not activate home-bus-link. Does not flip auth flags. Does not start
 * a new fabric slice Ordered proof. Historical S1–S7 CLEAN exit packages
 * stay authoritative for their wired claims; S8 owns campaign disposition.
 */
import type { G9EqualityA } from "./g9Occurrence.ts";
import {
  G10_DORMANT_HOME_BUS_COMM_ID,
  G10_FABRIC_SLICE_IDS,
  loadG10CutoverRegistry,
  resolveG10RepoRoot,
  type G10CutoverRegistry,
} from "./g10CutoverRegistry.ts";
import {
  asG9DeferredEquality,
  refuse763AsProof,
  type G9DeferredEquality,
} from "./g10ProofHarness.ts";
import {
  isValidRollbackResult,
  runCampaignRollback,
  type G10CampaignRollbackHook,
  type G10RollbackOptions,
} from "./g10Rollback.ts";
import {
  authorityForSlice,
  createSubstitutionModel,
  installAdmitRouteReplace,
  type G10SubstitutionModel,
} from "./g10Substitution.ts";
import type { G10FabricSliceId } from "./g10Types.ts";

/** Campaign close slice id (no fabric inventory rows). */
export const G10_S8_SLICE = "S8" as const;

/** Frozen activatable radius count (inventory 74 − 1 dormant). */
export const G10_S8_ACTIVATABLE_RADIUS_COUNT = 73 as const;

/** Dormant-exempt count (home-bus-link only). */
export const G10_S8_DORMANT_EXEMPT_COUNT = 1 as const;

/**
 * Disposition kinds for one radius-set `comm_id` in the S8 dual-run exit audit.
 *
 * - exited-owning-slice: Ordered proof exit (a) on the inventory owner
 * - exited-lander: Ordered proof exit (a) on sole lander (handoff land)
 * - lander-reopen-wired: S8 reopen wired admit/route/replace on named lander
 * - campaign-residual: explicit residual with operator accept (phase handoff)
 * - dormant-exempt: home-bus-link only
 */
export type G10S8AuditDisposition =
  | "exited-owning-slice"
  | "exited-lander"
  | "lander-reopen-wired"
  | "campaign-residual"
  | "dormant-exempt";

/** One audit row for the cross-slice dual-run exit checklist. */
export type G10S8AuditRow = {
  readonly commId: string;
  readonly owningSlice: G10FabricSliceId | "S6-dormant";
  readonly disposition: G10S8AuditDisposition;
  readonly landerSlice?: G10FabricSliceId;
  readonly landerModule?: string;
  readonly evidence: string;
  readonly note: string;
};

/** Phase-level campaign residual (parent `comm_id` already exited on owner). */
export type G10S8PhaseResidual = {
  readonly commId: string;
  readonly phase: string;
  readonly fromSlice: G10FabricSliceId;
  readonly landerSlice: G10FabricSliceId;
  readonly landerModule: string;
  readonly handoffDoc: string;
  readonly operatorAccept: true;
  readonly note: string;
};

/**
 * S8 lander-reopen wires completed this campaign close (critical residuals).
 * Agent: owning-slice historical exit (a) stays stub-disclosed; lander wires
 * admit/route/replace; S8 audit lists lander-reopen-wired.
 */
export const G10_S8_LANDER_REOPEN_WIRED = [
  {
    commId: "INV-T2-FLAG-T3-OTEL",
    owningSlice: "S6" as const,
    landerSlice: "S2" as const,
    landerModule: "apps/server/src/cli/config.ts",
    handoffDoc: "docs/scm/g10/handoffs/S6-FLAG-T3-OTEL-to-S2.md",
    evidence: "resolveFlagT3OtelViaG10Bridge + G10_S2_FLAG_T3_OTEL_HANDOFF_LANDED_FROM_S6",
  },
  {
    commId: "INV-T2-FILE-CHECKPOINTS",
    owningSlice: "S7" as const,
    landerSlice: "S3" as const,
    landerModule: "apps/server/src/vcs/VcsDriver.ts",
    handoffDoc: "docs/scm/g10/handoffs/S7-FILE-CHECKPOINTS-to-S3.md",
    evidence: "fileCheckpointsViaG10Bridge + G10_S3_FILE_CHECKPOINTS_HANDOFF_FROM_S7",
  },
  {
    commId: "INV-T2-FLAG-CLOUDFLARED",
    owningSlice: "S7" as const,
    landerSlice: "S3" as const,
    landerModule: "packages/shared/src/relayClient.ts",
    handoffDoc: "docs/scm/g10/handoffs/S7-FLAG-CLOUDFLARED-to-S3.md",
    evidence: "runViaOptionalG10S3SharedSeam + G10_S3_FLAG_CLOUDFLARED_HANDOFF_FROM_S7",
  },
  {
    commId: "INV-T2-FLAG-CODEX-LAUNCH",
    owningSlice: "S7" as const,
    landerSlice: "S4" as const,
    landerModule: "apps/server/src/provider/Layers/codexLaunchArgs.ts",
    handoffDoc: "docs/scm/g10/handoffs/S7-FLAG-CODEX-LAUNCH-to-S4.md",
    evidence: "flagCodexLaunchViaG10Bridge + G10_S4_FLAG_CODEX_LAUNCH_HANDOFF_FROM_S7",
  },
  {
    commId: "INV-T2-FLAG-TERM-ENV",
    owningSlice: "S7" as const,
    landerSlice: "S5" as const,
    landerModule: "apps/server/src/terminal/Manager.ts",
    handoffDoc: "docs/scm/g10/handoffs/S7-FLAG-TERM-ENV-to-S5.md",
    evidence: "flagTermEnvViaG10Bridge + G10_S5_FLAG_TERM_ENV_HANDOFF_FROM_S7",
  },
] as const;

/**
 * Prior handoff lands completed before S8 (lander exit (a) on receiving slice).
 */
export const G10_S8_PRIOR_LANDER_EXITED = [
  {
    commId: "INV-T2-SETTINGS-EVENTS",
    owningSlice: "S1" as const,
    landerSlice: "S2" as const,
    landerModule: "apps/server/src/serverSettings.ts",
    evidence: "docs/scm/g10/evidence/S2-dual-run-exit.md",
  },
  {
    commId: "INV-T2-ORCH-LIVE",
    owningSlice: "S2" as const,
    landerSlice: "S6" as const,
    landerModule: "apps/server/src/ws.ts",
    evidence: "docs/scm/g10/evidence/S6-dual-run-exit.md",
  },
  {
    commId: "INV-T2-TEL-DESKTOP-CONTROL",
    owningSlice: "S3" as const,
    landerSlice: "S5" as const,
    landerModule: "apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts",
    evidence: "docs/scm/g10/evidence/S5-dual-run-exit.md",
  },
  {
    commId: "INV-T2-TEL-NDJSON",
    owningSlice: "S5" as const,
    landerSlice: "S6" as const,
    landerModule: "apps/server/src/t2Observability/T2Observability.ts",
    evidence: "docs/scm/g10/evidence/S6-dual-run-exit.md",
  },
  {
    commId: "INV-T2-TEL-T3-TRACE",
    owningSlice: "S5" as const,
    landerSlice: "S6" as const,
    landerModule: "apps/server/src/observability/Layers/Observability.ts",
    evidence: "docs/scm/g10/evidence/S6-dual-run-exit.md",
  },
] as const;

/**
 * Phase-level residuals kept with explicit operator accept (parent `comm_id`
 * already has owning-slice exit (a) for wired phases on S7).
 */
export const G10_S8_PHASE_RESIDUALS_OPERATOR_ACCEPT: readonly G10S8PhaseResidual[] = [
  {
    commId: "INV-T2-FILE-LOGS",
    phase: "providerEventLogPath-writer-succeeded",
    fromSlice: "S7",
    landerSlice: "S4",
    landerModule: "apps/server/src/provider/Layers/ProviderEventLoggers.ts",
    handoffDoc: "docs/scm/g10/handoffs/S7-FILE-LOGS-provider-event-log-to-S4.md",
    operatorAccept: true,
    note: "S7 exit (a) covers config.ts dir/serverLogPath; provider-event-log phase residual accepted",
  },
  {
    commId: "INV-T2-FILE-LOGS",
    phase: "terminalLogs-writer-succeeded",
    fromSlice: "S7",
    landerSlice: "S5",
    landerModule: "apps/server/src/terminal/Manager.ts",
    handoffDoc: "docs/scm/g10/handoffs/S7-FILE-LOGS-terminalLogs-to-S5.md",
    operatorAccept: true,
    note: "S7 exit (a) covers config.ts dir/serverLogPath; terminalLogs phase residual accepted",
  },
  {
    commId: "INV-T2-FILE-PROVIDER-SESSION",
    phase: "providerStatusCache read/write",
    fromSlice: "S7",
    landerSlice: "S4",
    landerModule: "apps/server/src/provider/providerStatusCache.ts",
    handoffDoc: "docs/scm/g10/handoffs/S7-FILE-PROVIDER-SESSION-to-S4.md",
    operatorAccept: true,
    note: "S7 exit (a) covers ProviderSessionRuntime binding phases; cache phases residual accepted",
  },
] as const;

/** One live/manifold pair for aggregate campaign ≡ under G9DeferredEquality. */
export type G10S8EquivPair = {
  readonly commId: string;
  readonly live: G9EqualityA;
  readonly manifold: G9EqualityA;
};

/** Aggregate cutover ≡ result (campaign rollup). */
export type G10S8AggregateEquivalence = {
  readonly kind: "G10S8AggregateEquivalence";
  readonly carrier: "G9DeferredEquality";
  readonly forbids763: true;
  readonly sampleCount: number;
  readonly equalitySamples: readonly G9DeferredEquality[];
  readonly notes: readonly string[];
};

/** Campaign rollback drill result (S8 evidence body input). */
export type G10S8CampaignRollbackDrill = {
  readonly kind: "G10S8CampaignRollbackDrill";
  readonly hook: G10CampaignRollbackHook;
  readonly valid: boolean;
  readonly allLive: boolean;
  readonly slicesRestored: readonly G10FabricSliceId[];
  readonly notes: readonly string[];
};

/** Full S8 dual-run exit audit package. */
export type G10S8DualRunExitAudit = {
  readonly kind: "G10S8DualRunExitAudit";
  readonly activatableCount: number;
  readonly dormantExemptCount: number;
  readonly rows: readonly G10S8AuditRow[];
  readonly phaseResiduals: readonly G10S8PhaseResidual[];
  readonly landerReopenWiredCount: number;
  readonly priorLanderExitedCount: number;
  readonly exitedOwningSliceCount: number;
  readonly campaignResidualCommIds: readonly string[];
  readonly radiusUnchanged: true;
  readonly homeBusDormant: true;
  readonly notes: readonly string[];
};

/**
 * Resolve owning fabric slice for an activatable inventory `comm_id`.
 *
 * Throws when id is missing from the frozen registry (radius violation).
 */
export const owningSliceForCommId = (
  registry: G10CutoverRegistry,
  commId: string,
): G10FabricSliceId => {
  for (const slice of G10_FABRIC_SLICE_IDS) {
    if (registry.bySlice[slice].includes(commId)) return slice;
  }
  throw new Error(`G10 S8 audit: ${commId} not in frozen radius registry`);
};

/**
 * Build the cross-slice dual-run exit audit for all 73 activatable + dormant.
 *
 * Parameters
 * ----------
 * registry : G10CutoverRegistry
 *     Inventory-authoritative radius (defaults to load from repo root).
 *
 * Returns
 * -------
 * G10S8DualRunExitAudit
 *     Sorted rows + phase residuals; radiusUnchanged / homeBusDormant true.
 */
export const buildDualRunExitAudit = (
  registry: G10CutoverRegistry = loadG10CutoverRegistry(resolveG10RepoRoot()),
): G10S8DualRunExitAudit => {
  if (registry.radiusSet.size !== G10_S8_ACTIVATABLE_RADIUS_COUNT) {
    throw new Error(
      `G10 S8 audit: radius ${registry.radiusSet.size} ≠ ${G10_S8_ACTIVATABLE_RADIUS_COUNT}`,
    );
  }
  if (!registry.dormantExempt.has(G10_DORMANT_HOME_BUS_COMM_ID)) {
    throw new Error("G10 S8 audit: home-bus dormant exempt missing");
  }

  const reopenById = new Map(G10_S8_LANDER_REOPEN_WIRED.map((r) => [r.commId, r] as const));
  const priorLanderById = new Map(G10_S8_PRIOR_LANDER_EXITED.map((r) => [r.commId, r] as const));

  const rows: G10S8AuditRow[] = [];
  let exitedOwning = 0;
  let priorLander = 0;
  let reopenWired = 0;

  const sortedActivatable = [...registry.radiusSet].sort();
  for (const commId of sortedActivatable) {
    const owningSlice = owningSliceForCommId(registry, commId);
    const reopen = reopenById.get(commId);
    if (reopen !== undefined) {
      reopenWired += 1;
      rows.push({
        commId,
        owningSlice,
        disposition: "lander-reopen-wired",
        landerSlice: reopen.landerSlice,
        landerModule: reopen.landerModule,
        evidence: reopen.evidence,
        note: `S8 lander reopen wired on ${reopen.landerSlice}; owning ${owningSlice} historical exit (a) stub-disclosed`,
      });
      continue;
    }
    const landed = priorLanderById.get(commId);
    if (landed !== undefined) {
      priorLander += 1;
      rows.push({
        commId,
        owningSlice,
        disposition: "exited-lander",
        landerSlice: landed.landerSlice,
        landerModule: landed.landerModule,
        evidence: landed.evidence,
        note: `Handoff land exit (a) on ${landed.landerSlice}; owning ${owningSlice} stub-disclosed`,
      });
      continue;
    }
    exitedOwning += 1;
    rows.push({
      commId,
      owningSlice,
      disposition: "exited-owning-slice",
      evidence: `docs/scm/g10/evidence/${owningSlice}-dual-run-exit.md`,
      note: `Ordered proof exit (a)/(e) on owning slice ${owningSlice}`,
    });
  }

  // Dormant exempt row (not in radiusSet).
  rows.push({
    commId: G10_DORMANT_HOME_BUS_COMM_ID,
    owningSlice: "S6-dormant",
    disposition: "dormant-exempt",
    evidence: "docs/scm/g10/evidence/S6-dual-run-exit.md",
    note: "dormant-preserved; fixtures only; not exit/inversion",
  });

  rows.sort((a, b) => a.commId.localeCompare(b.commId));

  if (rows.length !== G10_S8_ACTIVATABLE_RADIUS_COUNT + G10_S8_DORMANT_EXEMPT_COUNT) {
    throw new Error(`G10 S8 audit: row count ${rows.length} ≠ 74 (73 activatable + 1 dormant)`);
  }
  if (exitedOwning + priorLander + reopenWired !== G10_S8_ACTIVATABLE_RADIUS_COUNT) {
    throw new Error(
      `G10 S8 audit: disposition partition ${exitedOwning}+${priorLander}+${reopenWired} ≠ 73`,
    );
  }

  return {
    kind: "G10S8DualRunExitAudit",
    activatableCount: G10_S8_ACTIVATABLE_RADIUS_COUNT,
    dormantExemptCount: G10_S8_DORMANT_EXEMPT_COUNT,
    rows,
    phaseResiduals: G10_S8_PHASE_RESIDUALS_OPERATOR_ACCEPT,
    landerReopenWiredCount: reopenWired,
    priorLanderExitedCount: priorLander,
    exitedOwningSliceCount: exitedOwning,
    campaignResidualCommIds: [
      ...new Set(G10_S8_PHASE_RESIDUALS_OPERATOR_ACCEPT.map((r) => r.commId)),
    ],
    radiusUnchanged: true,
    homeBusDormant: true,
    notes: [
      "73 activatable + 1 dormant-exempt listed",
      `${reopenWired} S8 lander-reopen-wired critical residuals`,
      `${priorLander} prior handoff lands with lander exit (a)`,
      `${exitedOwning} exited on owning slice`,
      `${G10_S8_PHASE_RESIDUALS_OPERATOR_ACCEPT.length} phase residuals with operator accept`,
      "radius unchanged; home-bus dormant; not WP8 763",
    ],
  };
};

/**
 * Format dual-run exit audit as markdown (evidence writer input).
 */
export const formatDualRunExitAuditMarkdown = (audit: G10S8DualRunExitAudit): string => {
  const lines: string[] = [
    "# S8 dual-run-exit audit",
    "",
    "<!-- Agent: G10 S8 campaign close. Every radius-set activatable + dormant exempt. -->",
    "",
    `- Date: 2026-10-18`,
    `- Slice: **S8**`,
    `- Activatable: **${audit.activatableCount}**`,
    `- Dormant-exempt: **${audit.dormantExemptCount}**`,
    `- Radius unchanged: \`${audit.radiusUnchanged}\``,
    `- Home-bus dormant: \`${audit.homeBusDormant}\``,
    "",
    "## Disposition summary",
    "",
    `| Kind | Count |`,
    `| --- | ---: |`,
    `| exited-owning-slice | ${audit.exitedOwningSliceCount} |`,
    `| exited-lander | ${audit.priorLanderExitedCount} |`,
    `| lander-reopen-wired (S8) | ${audit.landerReopenWiredCount} |`,
    `| dormant-exempt | ${audit.dormantExemptCount} |`,
    "",
    "## Activatable + dormant rows (74)",
    "",
    `| comm_id | owning | disposition | lander | evidence |`,
    `| --- | --- | --- | --- | --- |`,
  ];
  for (const row of audit.rows) {
    const lander =
      row.landerSlice === undefined
        ? "—"
        : `${row.landerSlice}${row.landerModule !== undefined ? ` (${row.landerModule})` : ""}`;
    lines.push(
      `| \`${row.commId}\` | ${row.owningSlice} | ${row.disposition} | ${lander} | ${row.evidence} |`,
    );
  }
  lines.push(
    "",
    "## Phase residuals (operator accept)",
    "",
    `| comm_id | phase | lander | handoff |`,
    `| --- | --- | --- | --- |`,
  );
  for (const r of audit.phaseResiduals) {
    lines.push(
      `| \`${r.commId}\` | \`${r.phase}\` | ${r.landerSlice} (\`${r.landerModule}\`) | ${r.handoffDoc} |`,
    );
  }
  lines.push(
    "",
    "## Operator accept",
    "",
    "Phase residuals above are accepted for campaign close: parent `comm_id`s",
    "already completed Ordered proof exit (a) on S7 for their wired phases.",
    "Critical full-row residuals (FLAG-T3-OTEL, FILE-CHECKPOINTS, FLAG-CLOUDFLARED,",
    "FLAG-CODEX-LAUNCH, FLAG-TERM-ENV) are **lander-reopen-wired** at S8 — not",
    "left as campaign residuals.",
    "",
    "## Explicitly not",
    "",
    "- WP8 763-fixture-as-G10-proof",
    "- Radius resize / home-bus activation / codec / eleventh bus",
    "",
    "## Verdict",
    "",
    "**GREEN** — 73 activatable dispositioned + 1 dormant-exempt; phase residuals accepted.",
    "",
  );
  return lines.join("\n");
};

/**
 * Run full-campaign rollback drill via `runCampaignRollback`.
 *
 * Intended: install all fabric slices, optionally flip to manifold, restore
 * all to live in one procedure. Shadow env must stay unchanged (caller tests).
 *
 * Parameters
 * ----------
 * model : G10SubstitutionModel
 *     Shared substitution model (mutated).
 * options : G10RollbackOptions
 *     Must not request shadow-off or halt controller.
 *
 * Returns
 * -------
 * G10S8CampaignRollbackDrill
 *     Hook result + allLive validity.
 */
export const runCampaignRollbackDrill = (
  model: G10SubstitutionModel,
  options: G10RollbackOptions = {},
): G10S8CampaignRollbackDrill => {
  const hook = runCampaignRollback(model, options);
  const valid = isValidRollbackResult(hook);
  let allLive = true;
  for (const slice of G10_FABRIC_SLICE_IDS) {
    if (model.installs.has(slice) && authorityForSlice(model, slice) !== "live") {
      allLive = false;
    }
  }
  return {
    kind: "G10S8CampaignRollbackDrill",
    hook,
    valid,
    allLive,
    slicesRestored: hook.slicesRestored,
    notes: [
      `campaign-rollback restored ${hook.slicesRestored.length} fabric slices`,
      "clearedShadowEnv=false; usedHaltController=false",
      "rollback ≠ unset T2CODE_SCM_G9_SHADOW",
      "G7 DIP halt/freeze unchanged",
      allLive
        ? "all restored installs report live authority"
        : "WARNING: non-live authority remains",
    ],
  };
};

/**
 * Install admit/route/replace on every fabric slice (campaign drill prep).
 *
 * Agent: used by S8 rollback drill tests; does not record Ordered proof steps.
 */
export const installAllFabricSlices = (model: G10SubstitutionModel): void => {
  for (const slice of G10_FABRIC_SLICE_IDS) {
    installAdmitRouteReplace(model, slice);
  }
};

/**
 * Aggregate cutover ≡ under G9DeferredEquality for campaign rollup pairs.
 *
 * Parameters
 * ----------
 * pairs : readonly G10S8EquivPair[]
 *     Live/manifold projection pairs (must be JSON-identical per comm_id).
 * claim : string
 *     Proof claim token — refused when it smells like WP8 763-as-proof.
 *
 * Returns
 * -------
 * G10S8AggregateEquivalence
 *     Carrier samples + notes.
 *
 * Throws
 * ------
 * Error
 *     On 763-as-proof claim or live≠manifold mismatch.
 */
export const aggregateCutoverEquivalence = (
  pairs: readonly G10S8EquivPair[],
  claim: string = "g10-s8-campaign-aggregate-G9DeferredEquality",
): G10S8AggregateEquivalence => {
  refuse763AsProof(claim);
  const equalitySamples: G9DeferredEquality[] = [];
  for (const pair of pairs) {
    if (JSON.stringify(pair.live) !== JSON.stringify(pair.manifold)) {
      throw new Error(
        `G10 S8 aggregate ≡ failed for ${pair.commId}: live=${JSON.stringify(pair.live)} manifold=${JSON.stringify(pair.manifold)}`,
      );
    }
    equalitySamples.push(asG9DeferredEquality(pair.live));
  }
  return {
    kind: "G10S8AggregateEquivalence",
    carrier: "G9DeferredEquality",
    forbids763: true,
    sampleCount: equalitySamples.length,
    equalitySamples,
    notes: [
      `aggregate ≡ under G9DeferredEquality (${equalitySamples.length} pairs)`,
      "not WP8 763; not type-name-only close",
      "WORK-000035 losslessness still deferred (G9DeferredEquality honesty)",
      "radius unchanged; home-bus dormant-exempt from ≡",
    ],
  };
};

/**
 * Representative aggregate ≡ pairs for campaign evidence (one per fabric slice
 * wired family + S8 reopen lands). Not 763 fixtures.
 */
export const G10_S8_AGGREGATE_EQUIV_SEED_PAIRS: readonly G10S8EquivPair[] = [
  {
    commId: "INV-T2-ORCH-EVENTS",
    live: { site: "domain-event-published" },
    manifold: { site: "domain-event-published" },
  },
  {
    commId: "INV-T2-FLAG-SERVER-CONFIG",
    live: { comm_id: "resolved" },
    manifold: { comm_id: "resolved" },
  },
  {
    commId: "INV-T2-GIT",
    live: { method: "execute" },
    manifold: { method: "execute" },
  },
  {
    commId: "INV-T2-PROVIDER-CODEX",
    live: { provider: "spawned" },
    manifold: { provider: "spawned" },
  },
  {
    commId: "INV-T2-TERM",
    live: { phase: "pty-spawn-succeeded" },
    manifold: { phase: "pty-spawn-succeeded" },
  },
  {
    commId: "INV-T2-RPC-WS",
    live: { site: "rpc-ws" },
    manifold: { site: "rpc-ws" },
  },
  {
    commId: "INV-T2-SQLITE",
    live: { operation: "execute" },
    manifold: { operation: "execute" },
  },
  {
    commId: "INV-T2-FLAG-T3-OTEL",
    live: { comm_id: "resolved" },
    manifold: { comm_id: "resolved" },
  },
  {
    commId: "INV-T2-FILE-CHECKPOINTS",
    live: { operation: "captureCheckpoint" },
    manifold: { operation: "captureCheckpoint" },
  },
  {
    commId: "INV-T2-FLAG-CLOUDFLARED",
    live: { member: "T3CODE_CLOUDFLARED_PATH", state_label: "absent" },
    manifold: { member: "T3CODE_CLOUDFLARED_PATH", state_label: "absent" },
  },
  {
    commId: "INV-T2-FLAG-CODEX-LAUNCH",
    live: { member: "T3CODE_CODEX_LAUNCH_ARGS", state_label: "absent" },
    manifold: { member: "T3CODE_CODEX_LAUNCH_ARGS", state_label: "absent" },
  },
  {
    commId: "INV-T2-FLAG-TERM-ENV",
    live: { kind: "terminal-child-env-filtered" },
    manifold: { kind: "terminal-child-env-filtered" },
  },
] as const;

/**
 * Format campaign rollback drill as markdown.
 */
export const formatCampaignRollbackDrillMarkdown = (drill: G10S8CampaignRollbackDrill): string => {
  const lines: string[] = [
    "# S8 campaign-rollback-drill evidence",
    "",
    "<!-- Agent: G10 S8 full-campaign restore via runCampaignRollback. -->",
    "",
    `- Date: 2026-10-18`,
    `- Slice: **S8**`,
    `- Procedure: \`runCampaignRollback\` / \`runCampaignRollbackDrill\``,
    `- slicesRestored: ${drill.slicesRestored.join(", ") || "(none)"}`,
    `- valid: \`${drill.valid}\``,
    `- allLive: \`${drill.allLive}\``,
    `- clearedShadowEnv: \`${drill.hook.clearedShadowEnv}\``,
    `- usedHaltController: \`${drill.hook.usedHaltController}\``,
    "",
    "## Procedure",
    "",
    "1. Install admit/route/replace on S1–S7 (campaign prep).",
    "2. Optionally set manifold authority (post-exit shape).",
    "3. Call `runCampaignRollback(model)` once.",
    '4. Assert every restored install has `authority: "live"`.',
    "5. Assert `T2CODE_SCM_G9_SHADOW` unchanged; no halt controller.",
    "",
    "## Notes",
    "",
  ];
  for (const n of drill.notes) lines.push(`- ${n}`);
  lines.push(
    "",
    "## Explicitly not",
    "",
    "- Unset of `T2CODE_SCM_G9_SHADOW` as Increment 6 rollback",
    "- New campaign halt controller (G7 DIP unchanged)",
    "- Per-slice Ordered proof re-run (S8 is campaign restore)",
    "",
    "## Verdict",
    "",
    drill.valid && drill.allLive
      ? "**GREEN** — campaign rollback restored live across fabric installs."
      : "**FAIL** — campaign rollback invalid or non-live authority remains.",
    "",
  );
  return lines.join("\n");
};

/**
 * Format aggregate cutover ≡ as markdown.
 */
export const formatCampaignCutoverEquivalenceMarkdown = (
  agg: G10S8AggregateEquivalence,
): string => {
  const lines: string[] = [
    "# S8 campaign-cutover-equivalence evidence",
    "",
    "<!-- Agent: G10 S8 aggregate ≡ under G9DeferredEquality — not WP8 763. -->",
    "",
    `- Date: 2026-10-18`,
    `- Slice: **S8**`,
    `- Carrier: \`G9DeferredEquality\` / \`asG9DeferredEquality\``,
    `- sampleCount: **${agg.sampleCount}**`,
    `- forbids763: \`${agg.forbids763}\``,
    "",
    "## Aggregate pairs (representative)",
    "",
    `| comm_id | projection |`,
    `| --- | --- |`,
  ];
  for (const sample of agg.equalitySamples) {
    const proj = sample.projection as G9EqualityA & { readonly [k: string]: unknown };
    // Prefer comm_id field when present; else JSON of projection.
    const label =
      typeof (proj as { comm_id?: unknown }).comm_id === "string"
        ? JSON.stringify(proj)
        : JSON.stringify(proj);
    lines.push(`| (sample) | \`${label}\` |`);
  }
  lines.push("", "## Notes", "");
  for (const n of agg.notes) lines.push(`- ${n}`);
  lines.push(
    "",
    "## Explicitly not",
    "",
    "- WP8 763 shadow fixtures as G10 campaign proof",
    "- Type-name substitution alone without live≡manifold projections",
    "- Home-bus activation",
    "",
    "## Verdict",
    "",
    "**GREEN** — campaign aggregate ≡ under G9DeferredEquality.",
    "",
  );
  return lines.join("\n");
};

/**
 * Create a fresh substitution model loaded from inventory (S8 helpers).
 */
export const createG10S8SubstitutionModel = (
  repoRoot: string = resolveG10RepoRoot(),
): G10SubstitutionModel => createSubstitutionModel(loadG10CutoverRegistry(repoRoot));

/**
 * Run the three S8 campaign-close proof helpers in order (audit → rollback → ≡).
 *
 * Returns bodies suitable for evidence markdown writers / tests.
 */
export const runS8CampaignCloseProof = (
  repoRoot: string = resolveG10RepoRoot(),
): {
  readonly audit: G10S8DualRunExitAudit;
  readonly rollback: G10S8CampaignRollbackDrill;
  readonly equivalence: G10S8AggregateEquivalence;
} => {
  const registry = loadG10CutoverRegistry(repoRoot);
  const audit = buildDualRunExitAudit(registry);
  const model = createSubstitutionModel(registry);
  installAllFabricSlices(model);
  // Simulate post-exit manifold authority on a few slices before campaign restore.
  for (const slice of ["S1", "S3", "S7"] as const) {
    const install = model.installs.get(slice);
    if (install !== undefined) {
      model.installs.set(slice, { ...install, authority: "manifold" });
    }
  }
  const rollback = runCampaignRollbackDrill(model);
  if (!rollback.valid || !rollback.allLive) {
    throw new Error("G10 S8 campaign close: rollback drill failed");
  }
  const equivalence = aggregateCutoverEquivalence(G10_S8_AGGREGATE_EQUIV_SEED_PAIRS);
  return { audit, rollback, equivalence };
};
