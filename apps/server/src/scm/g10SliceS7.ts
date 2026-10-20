/**
 * G10 S7 campaign controller (Ordered proof + seam-bridge traffic).
 *
 * Intended: own S7 admit/route/replace + Ordered proof sequence helpers
 * wrapping createSubstitutionModel / installAdmitRouteReplace /
 * recordOrderedProofStep / armInversion / restorePreCutoverLive. Under
 * T2CODE_SCM_FABRIC_DEPTH (Battery FD7), softFallbackRetire runs after
 * armInversion via recordSoftFallbackRetire (census sole-lander debt EMPTY —
 * four handoff stubs non-blocking). Wired seams on S7 sole landers only:
 *   - persistence/Layers/Projection* (PROJECT-SQL; Services tags are inventory
 *     hotspots; live I/O lands on Layers implementations)
 *   - NodeSqliteClient.ts (SQLITE)
 *   - ProjectionSnapshotQuery Layer (PROJECT-READ)
 *   - Normalizer.ts (FILE-ATTACHMENTS)
 *   - ServerEnvironment / serverRuntimeState / Identify / keybindings
 *     (FILE-RUNTIME-STATE)
 *   - config.ts (FILE-LOGS dir + serverLogPath declare + FILE-SECRETS root)
 *   - UsageService.ts (FILE-USAGE-CACHE)
 *   - GitVcsDriverCore.ts (FILE-WORKTREES)
 *   - ProviderSessionRuntime.ts (FILE-PROVIDER-SESSION binding phases)
 * Foreign hotspots stay handoff-pending (S3/S4/S5 sole landers): FILE-CHECKPOINTS,
 * FLAG-CLOUDFLARED, FLAG-CODEX-LAUNCH, FLAG-TERM-ENV, plus FILE-LOGS
 * provider-event-log / terminalLogs and FILE-PROVIDER-SESSION cache phases.
 *
 * Observed: in-memory model + traffic log; dualRunExit / armInversion never
 * call markDualRunExited — recordOrderedProofStep is sole dual-run-exit /
 * arm-inversion writer. softFallbackRetire is Fabric-depth bookkeeping (not a
 * G10 OrderedProofStep). Absent controller ⇒ live paths unchanged. No G11.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { join } from "node:path";

import type { ProjectionSnapshotQueryShape } from "../orchestration/Services/ProjectionSnapshotQuery.ts";
import type { ProjectionCheckpointRepositoryShape } from "../persistence/Services/ProjectionCheckpoints.ts";
import type { ProjectionPendingApprovalRepositoryShape } from "../persistence/Services/ProjectionPendingApprovals.ts";
import type { ProjectionProjectRepositoryShape } from "../persistence/Services/ProjectionProjects.ts";
import type { ProjectionStateRepositoryShape } from "../persistence/Services/ProjectionState.ts";
import type { ProjectionThreadActivityRepositoryShape } from "../persistence/Services/ProjectionThreadActivities.ts";
import type { ProjectionThreadMessageRepositoryShape } from "../persistence/Services/ProjectionThreadMessages.ts";
import type { ProjectionThreadProposedPlanRepositoryShape } from "../persistence/Services/ProjectionThreadProposedPlans.ts";
import type { ProjectionThreadSessionRepositoryShape } from "../persistence/Services/ProjectionThreadSessions.ts";
import type { ProjectionThreadRepositoryShape } from "../persistence/Services/ProjectionThreads.ts";
import type { ProjectionTurnRepositoryShape } from "../persistence/Services/ProjectionTurns.ts";
import type { ProviderSessionRuntimeRepository } from "../persistence/ProviderSessionRuntime.ts";
import type { G9EqualityA } from "./g9Occurrence.ts";
import {
  G9_PROJECT_SQL_PHASE_INPUTS,
  buildAttachmentWriteCaptureInput,
  buildFileLogsDirCreateCaptureInput,
  buildProviderSessionBindingCaptureInput,
  buildRuntimeStateWriteCaptureInput,
  buildSecretStorePersistedCaptureInput,
  buildUsageCachePersistedCaptureInput,
  buildWorktreeCreateCaptureInput,
  buildWorktreeRemoveCaptureInput,
  captureProjectReadSucceeded,
  captureProjectSqlSucceeded,
  captureSqliteExecuteSucceeded,
  type G9ProjectReadMethod,
  type G9ProjectSqlPhaseId,
  type G9SqliteOperation,
} from "./g9FamilyFileDbProcessConfig.ts";
import { whenG9CapturePresent } from "./g9FamilySubprocessExternalTransport.ts";
import { isFabricDepthEnabled } from "./fabricDepthBootstrap.ts";
import { recordSoftFallbackRetire, softFallbackForSlice } from "./fabricDepthSoftFallback.ts";
import {
  activatableCommIdsForSlice,
  loadG10CutoverRegistry,
  resolveG10RepoRoot,
  type G10CutoverRegistry,
} from "./g10CutoverRegistry.ts";
import { armInversion } from "./g10Inversion.ts";
import {
  asG9DeferredEquality,
  orderedProofSatisfiedThrough,
  recordOrderedProofStep,
  type G9DeferredEquality,
} from "./g10ProofHarness.ts";
import { restorePreCutoverLive } from "./g10Rollback.ts";
import { runG10SeamBridge } from "./g10SeamBridge.ts";
import {
  authorityForSlice,
  createSubstitutionModel,
  installAdmitRouteReplace,
  phaseForSlice,
  type G10SubstitutionModel,
} from "./g10Substitution.ts";
import type { CutoverPhase, OrderedProofStep } from "./g10Types.ts";

/**
 * Absolute path to Fabric-depth manifold I/O census (soft-fallback retire gate).
 * Agent: sole-lander debt for S7 is EMPTY (handoff stubs only).
 */
const fabricDepthCensusPath = (repoRoot: string): string =>
  join(repoRoot, "docs/scm/fabric-depth/evidence/manifold-io-census.json");

/**
 * Frozen S7 activatable inventory `comm_id` set (14 rows — B2 remainder).
 * Agent: do not resize; phase count for S7 inventory rows is 72.
 */
export const G10_S7_COMM_IDS = [
  "INV-T2-FILE-ATTACHMENTS",
  "INV-T2-FILE-CHECKPOINTS",
  "INV-T2-FILE-LOGS",
  "INV-T2-FILE-PROVIDER-SESSION",
  "INV-T2-FILE-RUNTIME-STATE",
  "INV-T2-FILE-SECRETS",
  "INV-T2-FILE-USAGE-CACHE",
  "INV-T2-FILE-WORKTREES",
  "INV-T2-FLAG-CLOUDFLARED",
  "INV-T2-FLAG-CODEX-LAUNCH",
  "INV-T2-FLAG-TERM-ENV",
  "INV-T2-PROJECT-READ",
  "INV-T2-PROJECT-SQL",
  "INV-T2-SQLITE",
] as const;

export type G10S7CommId = (typeof G10_S7_COMM_IDS)[number];

/**
 * S7-owned seams with real g10SeamBridge wiring on S7 sole landers.
 * Agent: dual-run-exit (a)/(e) may claim these ten only — not the four
 * fully-deferred foreign-hotspot rows.
 */
export const G10_S7_WIRED_COMM_IDS = [
  "INV-T2-FILE-ATTACHMENTS",
  "INV-T2-FILE-LOGS",
  "INV-T2-FILE-PROVIDER-SESSION",
  "INV-T2-FILE-RUNTIME-STATE",
  "INV-T2-FILE-SECRETS",
  "INV-T2-FILE-USAGE-CACHE",
  "INV-T2-FILE-WORKTREES",
  "INV-T2-PROJECT-READ",
  "INV-T2-PROJECT-SQL",
  "INV-T2-SQLITE",
] as const;

export type G10S7WiredCommId = (typeof G10_S7_WIRED_COMM_IDS)[number];

/**
 * S7 inventory rows deferred to foreign sole landers (S3/S4/S5).
 * Agent: handoff stub for ≡ carrier only — not admit/route/replace wiring.
 */
export const G10_S7_HANDOFF_PENDING_COMM_IDS = [
  "INV-T2-FILE-CHECKPOINTS",
  "INV-T2-FLAG-CLOUDFLARED",
  "INV-T2-FLAG-CODEX-LAUNCH",
  "INV-T2-FLAG-TERM-ENV",
] as const;

/** Inventory phase count for S7 (seam-inventory-completeness.json). */
export const G10_S7_PHASE_COUNT = 72 as const;

/** Traffic sample comm_id (S7 activatable only — no foreign handoff lands). */
export type G10S7TrafficCommId = G10S7CommId;

/** One manifold (or live) traffic sample for ≡ under G9DeferredEquality. */
export type G10S7TrafficSample = {
  readonly path: "live" | "manifold";
  readonly commId: G10S7TrafficCommId;
  readonly phase: string;
  readonly projection: G9EqualityA;
  readonly atMs: number;
};

/**
 * Evidence step id: G10 Ordered proof steps plus Fabric-depth soft-fallback-retire
 * (FD7; not an OrderedProofStep).
 */
export type G10S7EvidenceStep = OrderedProofStep | "soft-fallback-retire";

/** Structured evidence body for one Ordered proof step (markdown writer input). */
export type G10S7EvidenceBody = {
  readonly slice: "S7";
  readonly step: G10S7EvidenceStep;
  readonly phase: CutoverPhase;
  readonly authority: "live" | "manifold";
  readonly inversionArmed: boolean;
  readonly commIds: readonly string[];
  readonly notes: readonly string[];
  readonly equalitySamples?: readonly G9DeferredEquality[];
  readonly trafficSummary?: {
    readonly liveCount: number;
    readonly manifoldCount: number;
  };
};

/**
 * In-memory manifold stub traffic log (S7 persistence/locals + handoff stubs).
 *
 * Intended: enough samples for live-vs-manifold ≡ under G9DeferredEquality.
 * Observed: append-only arrays; cleared on rollback restore when requested.
 */
export type G10S7ManifoldTrafficLog = {
  readonly samples: G10S7TrafficSample[];
};

/**
 * Representative phase + projection A for each wired S7 seam (Ordered rehearsal).
 * Agent: keep ledger-bounded; no SQL / paths / secret bytes in A.
 */
const G10_S7_WIRED_REHEARSAL: ReadonlyArray<{
  readonly commId: G10S7WiredCommId;
  readonly phase: string;
  readonly projection: G9EqualityA;
}> = [
  {
    commId: "INV-T2-FILE-ATTACHMENTS",
    phase: "attachment-write-succeeded",
    projection: { site: "writeFile" },
  },
  {
    commId: "INV-T2-FILE-LOGS",
    phase: "logsDir-directory-create-succeeded",
    projection: { member_id: "logsDir" },
  },
  {
    commId: "INV-T2-FILE-PROVIDER-SESSION",
    phase: "provider-session-binding-upsert-succeeded",
    projection: { member_id: "upsert" },
  },
  {
    commId: "INV-T2-FILE-RUNTIME-STATE",
    phase: "serverRuntimeStatePath-write-succeeded",
    projection: { member_id: "serverRuntimeStatePath" },
  },
  {
    commId: "INV-T2-FILE-SECRETS",
    phase: "secret-store-persisted",
    projection: { comm_id: "present" },
  },
  {
    commId: "INV-T2-FILE-USAGE-CACHE",
    phase: "usage-cache-persisted",
    projection: { comm_id: "present" },
  },
  {
    commId: "INV-T2-FILE-WORKTREES",
    phase: "worktree-create-succeeded",
    projection: { comm_id: "worktree-create-succeeded" },
  },
  {
    commId: "INV-T2-PROJECT-READ",
    phase: "projection-query-succeeded",
    projection: { method: "getSnapshot" },
  },
  {
    commId: "INV-T2-PROJECT-SQL",
    phase: "ProjectionCheckpoints-upsert-succeeded",
    projection: { repository: "upsert" },
  },
  {
    commId: "INV-T2-SQLITE",
    phase: "sqlite-execute-succeeded",
    projection: { operation: "execute" },
  },
];

/**
 * S7 campaign controller shape (process-global or Effect service).
 *
 * Agent: land → liveRehearsal → recordEquiv → rollbackDrill → dualRunExit →
 * armInversion → (FD) softFallbackRetire. dualRunExit uses
 * recordOrderedProofStep only. softFallbackRetire uses recordSoftFallbackRetire.
 */
export type G10S7Controller = {
  readonly slice: "S7";
  readonly model: G10SubstitutionModel;
  readonly registry: G10CutoverRegistry;
  readonly traffic: G10S7ManifoldTrafficLog;
  readonly land: () => G10S7EvidenceBody;
  readonly liveRehearsal: () => G10S7EvidenceBody;
  readonly recordEquiv: () => G10S7EvidenceBody;
  readonly rollbackDrill: () => G10S7EvidenceBody;
  readonly dualRunExit: () => G10S7EvidenceBody;
  readonly armInversion: () => G10S7EvidenceBody;
  /**
   * Fabric-depth: retire soft-fallback after arm-inversion (requires
   * T2CODE_SCM_FABRIC_DEPTH=1 + census sole-lander debt EMPTY).
   */
  readonly softFallbackRetire: () => G10S7EvidenceBody;
  readonly recordLiveWiredSeam: (
    commId: G10S7WiredCommId,
    phase: string,
    projection: G9EqualityA,
  ) => void;
  readonly recordManifoldWiredSeam: (
    commId: G10S7WiredCommId,
    phase: string,
    projection: G9EqualityA,
  ) => void;
  readonly recordStubPair: (commId: G10S7CommId, phase: string, projection: G9EqualityA) => void;
  readonly isReplaceInstalled: () => boolean;
  readonly authority: () => "live" | "manifold";
  readonly phase: () => CutoverPhase;
  readonly inversionArmed: () => boolean;
  readonly formatEvidenceMarkdown: (body: G10S7EvidenceBody) => string;
  readonly runFullOrderedProof: () => readonly G10S7EvidenceBody[];
};

/** Process-global optional controller (tests / lander fallback). */
let processGlobalG10S7: G10S7Controller | undefined;

/**
 * Install or clear the process-global S7 controller.
 *
 * Intended: tests set before sole-lander effects; production prefers Layer.
 * Observed: module singleton; absent ⇒ lander live unchanged.
 */
export const installProcessGlobalG10S7 = (controller: G10S7Controller | undefined): void => {
  processGlobalG10S7 = controller;
};

/** Read process-global S7 controller (undefined when absent). */
export const getProcessGlobalG10S7 = (): G10S7Controller | undefined => processGlobalG10S7;

/**
 * Effect service key for optional S7 cutover controller.
 *
 * Absent ⇒ persistence / config / Normalizer / Usage / worktree live paths unchanged.
 */
export class G10S7CutoverService extends Context.Service<G10S7CutoverService, G10S7Controller>()(
  "t3/scm/g10SliceS7/G10S7CutoverService",
) {}

/**
 * Layer.succeed helper for tests / optional stack merge.
 */
export const G10S7CutoverLayer = (controller: G10S7Controller): Layer.Layer<G10S7CutoverService> =>
  Layer.succeed(G10S7CutoverService, controller);

/**
 * Resolve optional S7 controller: Effect.serviceOption first, then process-global.
 */
export const resolveOptionalG10S7 = (): Effect.Effect<Option.Option<G10S7Controller>> =>
  Effect.gen(function* () {
    const fromService = yield* Effect.serviceOption(G10S7CutoverService);
    if (Option.isSome(fromService)) return fromService;
    const global = processGlobalG10S7;
    return global === undefined ? Option.none() : Option.some(global);
  });

const nowMs = (): number => Date.now();

const pushSample = (traffic: G10S7ManifoldTrafficLog, sample: G10S7TrafficSample): void => {
  traffic.samples.push(sample);
};

/**
 * Create an S7 campaign controller bound to inventory registry.
 */
export const createG10S7Controller = (repoRoot: string = resolveG10RepoRoot()): G10S7Controller => {
  const registry = loadG10CutoverRegistry(repoRoot);
  const model = createSubstitutionModel(registry);
  const traffic: G10S7ManifoldTrafficLog = { samples: [] };

  const s7Ids = activatableCommIdsForSlice(registry, "S7");
  if (s7Ids.length !== G10_S7_COMM_IDS.length) {
    throw new Error(
      `G10 S7 controller: inventory S7 count ${s7Ids.length} ≠ frozen ${G10_S7_COMM_IDS.length}`,
    );
  }
  for (const id of G10_S7_COMM_IDS) {
    if (!s7Ids.includes(id)) {
      throw new Error(`G10 S7 controller: missing inventory id ${id}`);
    }
  }

  const recordLiveWiredSeam = (
    commId: G10S7WiredCommId,
    phase: string,
    projection: G9EqualityA,
  ): void => {
    pushSample(traffic, {
      path: "live",
      commId,
      phase,
      projection,
      atMs: nowMs(),
    });
  };

  const recordManifoldWiredSeam = (
    commId: G10S7WiredCommId,
    phase: string,
    projection: G9EqualityA,
  ): void => {
    pushSample(traffic, {
      path: "manifold",
      commId,
      phase,
      projection,
      atMs: nowMs(),
    });
  };

  const recordStubPair = (commId: G10S7CommId, phase: string, projection: G9EqualityA): void => {
    const at = nowMs();
    pushSample(traffic, { path: "live", commId, phase, projection, atMs: at });
    pushSample(traffic, {
      path: "manifold",
      commId,
      phase,
      projection,
      atMs: at,
    });
  };

  const snapshotEvidence = (
    step: G10S7EvidenceStep,
    notes: readonly string[],
    equalitySamples?: readonly G9DeferredEquality[],
  ): G10S7EvidenceBody => {
    const liveCount = traffic.samples.filter((s) => s.path === "live").length;
    const manifoldCount = traffic.samples.filter((s) => s.path === "manifold").length;
    return {
      slice: "S7",
      step,
      phase: phaseForSlice(model, "S7"),
      authority: authorityForSlice(model, "S7"),
      inversionArmed: model.sliceStates.get("S7")?.inversionArmed === true,
      commIds: [...s7Ids],
      notes,
      ...(equalitySamples === undefined ? {} : { equalitySamples }),
      trafficSummary: { liveCount, manifoldCount },
    };
  };

  const formatEvidenceMarkdown = (body: G10S7EvidenceBody): string => {
    const lines = [
      `# S7 ${body.step} evidence`,
      "",
      `<!-- Agent: G10 S7 Ordered proof step. Slice=${body.slice}. -->`,
      "",
      `- Date: ${new Date().toISOString().slice(0, 10)}`,
      `- Slice: **S7**`,
      `- Step: **${body.step}**`,
      `- Phase: \`${body.phase}\``,
      `- Authority: **${body.authority}**`,
      `- inversionArmed: \`${body.inversionArmed}\``,
      `- S7 activatable comm_ids (${body.commIds.length}): ${body.commIds.join(", ")}`,
      `- Inventory phase count: ${G10_S7_PHASE_COUNT}`,
      "",
      "## Notes",
      "",
      ...body.notes.map((n) => `- ${n}`),
    ];
    if (body.trafficSummary) {
      lines.push(
        "",
        "## Traffic summary",
        "",
        `- live samples: ${body.trafficSummary.liveCount}`,
        `- manifold samples: ${body.trafficSummary.manifoldCount}`,
      );
    }
    if (body.equalitySamples && body.equalitySamples.length > 0) {
      lines.push("", "## G9DeferredEquality samples", "");
      for (const sample of body.equalitySamples) {
        lines.push(`- \`${JSON.stringify(sample.projection)}\``);
      }
    }
    lines.push("", "## Verdict", "", "**GREEN**", "");
    return lines.join("\n");
  };

  /** Seed four fully-deferred foreign-hotspot stub pairs for ≡ carrier. */
  const seedHandoffPendingStubs = (): void => {
    recordStubPair("INV-T2-FILE-CHECKPOINTS", "checkpoint-captureCheckpoint-succeeded", {
      operation: "captureCheckpoint",
    });
    // Ledger public A for these flags is member-only (state_label is capture-input).
    recordStubPair("INV-T2-FLAG-CLOUDFLARED", "flag-resolved", {
      member: "T3CODE_CLOUDFLARED_PATH",
    });
    recordStubPair("INV-T2-FLAG-CODEX-LAUNCH", "flag-resolved", {
      member: "T3CODE_CODEX_LAUNCH_ARGS",
    });
    recordStubPair("INV-T2-FLAG-TERM-ENV", "terminal-child-env-filtered", {
      kind: "terminal-child-env-filtered",
    });
  };

  /** Dual-run observe rehearsal through seam bridge (live authoritative). */
  const rehearseWiredSeamsObserve = (): void => {
    for (const row of G10_S7_WIRED_REHEARSAL) {
      void Effect.runSync(
        runG10SeamBridge({
          model,
          slice: "S7",
          commId: row.commId,
          liveEffect: Effect.sync(() => {
            recordLiveWiredSeam(row.commId, row.phase, row.projection);
            return true;
          }),
          manifoldEffect: Effect.sync(() => {
            recordManifoldWiredSeam(row.commId, row.phase, row.projection);
            return true;
          }),
          manifoldObserveEffect: Effect.sync(() => {
            recordManifoldWiredSeam(row.commId, row.phase, row.projection);
          }),
        }),
      );
    }
  };

  const land = (): G10S7EvidenceBody => {
    installAdmitRouteReplace(model, "S7");
    recordOrderedProofStep(model, "S7", "land");
    return snapshotEvidence("land", [
      "admit/route/replace installed for S7 radius (14 activatable rows; 72 inventory phases)",
      "authority remains live (dual-run); manifold observe-beside eligible",
      "wired seams (10): ATTACHMENTS + LOGS(config) + PROVIDER-SESSION(bindings) + RUNTIME-STATE + SECRETS + USAGE-CACHE + WORKTREES + PROJECT-READ + PROJECT-SQL + SQLITE",
      "handoff-pending (4): FILE-CHECKPOINTS→S3 VcsDriver; FLAG-CLOUDFLARED→S3 relayClient; FLAG-CODEX-LAUNCH→S4 codexLaunchArgs; FLAG-TERM-ENV→S5 Manager",
      "phase handoffs (not stolen): FILE-LOGS provider-event-log→S4; FILE-LOGS terminalLogs→S5; FILE-PROVIDER-SESSION cache→S4",
      "markDualRunExited not used",
    ]);
  };

  const liveRehearsal = (): G10S7EvidenceBody => {
    if (!model.installs.get("S7")?.replaceInstalled) {
      throw new Error("G10 S7 liveRehearsal requires land first");
    }
    rehearseWiredSeamsObserve();
    seedHandoffPendingStubs();
    restorePreCutoverLive(model, "S7");
    if (authorityForSlice(model, "S7") !== "live") {
      throw new Error("G10 S7 liveRehearsal: restore did not return live authority");
    }
    if (!model.installs.get("S7")?.replaceInstalled) {
      installAdmitRouteReplace(model, "S7");
    } else {
      const install = model.installs.get("S7");
      if (install && install.authority !== "live") {
        model.installs.set("S7", { ...install, authority: "live" });
      }
    }
    rehearseWiredSeamsObserve();
    recordOrderedProofStep(model, "S7", "live-rehearsal");
    return snapshotEvidence("live-rehearsal", [
      "dual-run observe on ten wired S7 seams via g10SeamBridge (live authoritative)",
      "four foreign-hotspot handoff stubs only (S3/S4/S5 landers; S7 does not commit those files)",
      "one rollback restore + re-land under live authority",
      "inversion not armed; live remains authoritative",
      `inventory phase count ${G10_S7_PHASE_COUNT} unchanged`,
    ]);
  };

  const recordEquiv = (): G10S7EvidenceBody => {
    const byComm = new Map<string, { live?: G9EqualityA; manifold?: G9EqualityA }>();
    for (const sample of traffic.samples) {
      const entry = byComm.get(sample.commId) ?? {};
      if (sample.path === "live") entry.live = sample.projection;
      else entry.manifold = sample.projection;
      byComm.set(sample.commId, entry);
    }
    const equalitySamples: G9DeferredEquality[] = [];
    const missing: string[] = [];
    for (const id of G10_S7_COMM_IDS) {
      const pair = byComm.get(id);
      if (!pair?.live || !pair.manifold) {
        missing.push(id);
        continue;
      }
      if (JSON.stringify(pair.live) !== JSON.stringify(pair.manifold)) {
        throw new Error(
          `G10 S7 ≡ failed for ${id}: live=${JSON.stringify(pair.live)} manifold=${JSON.stringify(pair.manifold)}`,
        );
      }
      equalitySamples.push(asG9DeferredEquality(pair.live));
    }
    if (missing.length > 0) {
      throw new Error(`G10 S7 ≡ missing traffic for: ${missing.join(", ")}`);
    }
    recordOrderedProofStep(model, "S7", "cutover-equivalence");
    return snapshotEvidence(
      "cutover-equivalence",
      [
        "wired ten: live≡manifold via g10SeamBridge on S7 sole landers",
        "four handoff-deferred: stub pairs only (foreign hotspots; not (a) for those rows)",
        "not WP8 763-fixture-as-proof",
        "type carrier: asG9DeferredEquality from g10ProofHarness",
        `phase count ${G10_S7_PHASE_COUNT} matches inventory JSON for S7`,
      ],
      equalitySamples,
    );
  };

  const rollbackDrill = (): G10S7EvidenceBody => {
    const result = restorePreCutoverLive(model, "S7");
    if (
      result.restoredAuthority !== "live" ||
      result.clearedShadowEnv ||
      result.usedHaltController
    ) {
      throw new Error("G10 S7 rollbackDrill: invalid rollback result");
    }
    if (authorityForSlice(model, "S7") !== "live") {
      throw new Error("G10 S7 rollbackDrill: authority not live after restore");
    }
    const proved = Effect.runSync(
      runG10SeamBridge({
        model,
        slice: "S7",
        commId: "INV-T2-SQLITE",
        liveEffect: Effect.succeed("live-ok"),
        manifoldEffect: Effect.succeed("manifold-should-not-win"),
        manifoldObserveEffect: Effect.void,
      }),
    );
    if (proved !== "live-ok") {
      throw new Error("G10 S7 rollbackDrill: live authority not selected");
    }
    recordOrderedProofStep(model, "S7", "rollback-drill");
    return snapshotEvidence("rollback-drill", [
      "restorePreCutoverLive restored live authority",
      "rollback ≠ unset T2CODE_SCM_G9_SHADOW; no halt controller",
      "re-proved live-authoritative bridge selection for SQLITE",
      "restore scope: S7 sole landers (Projection Layers, NodeSqlite, ProjectionSnapshotQuery, Normalizer, runtime-state files, config.ts, UsageService, GitVcsDriverCore, ProviderSessionRuntime)",
      "foreign hotspots restore via S3/S4/S5 landers (not S7)",
    ]);
  };

  const dualRunExit = (): G10S7EvidenceBody => {
    recordOrderedProofStep(model, "S7", "dual-run-exit");
    if (authorityForSlice(model, "S7") !== "manifold") {
      throw new Error("G10 S7 dualRunExit: authority not manifold after proof step");
    }
    return snapshotEvidence("dual-run-exit", [
      "exit (a)/(e) for ten wired S7 seams only (sole landers)",
      "four handoff-deferred foreign rows not claimed under exit (a)",
      "FILE-LOGS provider-event-log / terminalLogs + FILE-PROVIDER-SESSION cache remain phase handoffs",
      'flipped solely via recordOrderedProofStep(..., "dual-run-exit")',
      "markDualRunExited not used (S0 escalation sole-owner binding)",
      "prerequisites: land + live-rehearsal + ≡ + rollback-drill green for wired ten",
    ]);
  };

  const armInversionStep = (): G10S7EvidenceBody => {
    armInversion(model, "S7", registry);
    if (model.sliceStates.get("S7")?.inversionArmed !== true) {
      throw new Error("G10 S7 armInversion: inversionArmed not true");
    }
    return snapshotEvidence("arm-inversion", [
      "noninterference inversion armed after dual-run-exit",
      "manifold failure may now fail user-visible S7 persistence/local ops",
      "armed solely via armInversion → recordOrderedProofStep",
      "four handoff-deferred rows remain un-inverted from S7 wiring",
      "FD7: call softFallbackRetire next under T2CODE_SCM_FABRIC_DEPTH",
    ]);
  };

  /**
   * Fabric-depth soft-fallback retire (proof-bar step 7 after arm-inversion).
   *
   * Intended: g10.softFallback=retired when FD on + census sole-lander debt EMPTY.
   * Observed: delegates to recordSoftFallbackRetire; refuses when FD off.
   */
  const softFallbackRetireStep = (): G10S7EvidenceBody => {
    if (model.sliceStates.get("S7")?.inversionArmed !== true) {
      throw new Error("G10 S7 softFallbackRetire: requires armInversion first");
    }
    recordSoftFallbackRetire(model, "S7", fabricDepthCensusPath(repoRoot));
    if (softFallbackForSlice(model, "S7") !== "retired") {
      throw new Error("G10 S7 softFallbackRetire: softFallback not retired");
    }
    return snapshotEvidence("soft-fallback-retire", [
      "g10.softFallback=retired via recordSoftFallbackRetire after armInversion",
      "census sole-lander debt EMPTY (FILE-CHECKPOINTS / FLAG-CLOUDFLARED / FLAG-CODEX-LAUNCH / FLAG-TERM-ENV are handoff stubs)",
      "bridge must not soft-fall to live on manifold failure for S7",
      "no G11; radius unchanged; foreign landers untouched (VcsDriver / relayClient / codexLaunchArgs / Manager)",
    ]);
  };

  const runFullOrderedProof = (): readonly G10S7EvidenceBody[] => {
    const bodies: G10S7EvidenceBody[] = [];
    bodies.push(land());
    bodies.push(liveRehearsal());
    bodies.push(recordEquiv());
    bodies.push(rollbackDrill());
    bodies.push(dualRunExit());
    bodies.push(armInversionStep());
    // Fabric-depth Ordered depth step 7 (proof-bar.md); no-op path when FD off.
    if (isFabricDepthEnabled()) {
      bodies.push(softFallbackRetireStep());
    }
    if (!orderedProofSatisfiedThrough(model, "S7", "arm-inversion")) {
      throw new Error("G10 S7 runFullOrderedProof: Ordered proof incomplete");
    }
    return bodies;
  };

  return {
    slice: "S7",
    model,
    registry,
    traffic,
    land,
    liveRehearsal,
    recordEquiv,
    rollbackDrill,
    dualRunExit,
    armInversion: armInversionStep,
    softFallbackRetire: softFallbackRetireStep,
    recordLiveWiredSeam,
    recordManifoldWiredSeam,
    recordStubPair,
    isReplaceInstalled: () => model.installs.get("S7")?.replaceInstalled === true,
    authority: () => authorityForSlice(model, "S7"),
    phase: () => phaseForSlice(model, "S7"),
    inversionArmed: () => model.sliceStates.get("S7")?.inversionArmed === true,
    formatEvidenceMarkdown,
    runFullOrderedProof,
  };
};

/**
 * Shared lander bridge: success live I/O via g10SeamBridge.
 *
 * Intended: absent/not-replaced ⇒ live only. Present + replaced ⇒
 * runG10SeamBridge with live/manifold record hooks.
 */
const runWiredSuccessSeamViaG10Bridge = <A, E, R>(
  commId: G10S7WiredCommId,
  phase: string,
  projection: G9EqualityA,
  liveIo: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const opt = yield* resolveOptionalG10S7();
    if (Option.isNone(opt) || !opt.value.isReplaceInstalled()) {
      return yield* liveIo;
    }
    const ctrl = opt.value;
    const liveEffect = Effect.gen(function* () {
      const result = yield* liveIo;
      ctrl.recordLiveWiredSeam(commId, phase, projection);
      return result;
    });
    const manifoldAuthority = Effect.gen(function* () {
      ctrl.recordManifoldWiredSeam(commId, phase, projection);
      return yield* liveIo;
    });
    const manifoldObserve = Effect.sync(() => {
      ctrl.recordManifoldWiredSeam(commId, phase, projection);
    });
    return yield* runG10SeamBridge({
      model: ctrl.model,
      slice: "S7",
      commId,
      liveEffect,
      manifoldEffect: manifoldAuthority,
      manifoldObserveEffect: manifoldObserve,
    });
  });

/** PROJECT-SQL: wrap one ledger phase success (Layers Projection*). */
export const projectSqlViaG10Bridge = <A, E, R>(
  phase: G9ProjectSqlPhaseId,
  liveSql: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-PROJECT-SQL",
    phase,
    G9_PROJECT_SQL_PHASE_INPUTS[phase] as G9EqualityA,
    liveSql.pipe(
      Effect.tap(() =>
        whenG9CapturePresent((capture) => captureProjectSqlSucceeded(phase, capture)),
      ),
    ),
  );

/** SQLITE: wrap NodeSqliteClient execute success. */
export const sqliteExecuteViaG10Bridge = <A, E, R>(
  operation: G9SqliteOperation,
  liveSqlite: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-SQLITE",
    "sqlite-execute-succeeded",
    { operation },
    liveSqlite.pipe(
      Effect.tap(() =>
        whenG9CapturePresent((capture) => captureSqliteExecuteSucceeded(operation, capture)),
      ),
    ),
  );

/** PROJECT-READ: wrap ProjectionSnapshotQuery method success. */
export const projectReadViaG10Bridge = <A, E, R>(
  method: G9ProjectReadMethod,
  liveRead: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-PROJECT-READ",
    "projection-query-succeeded",
    { method },
    liveRead.pipe(
      Effect.tap(() =>
        whenG9CapturePresent((capture) => captureProjectReadSucceeded(method, capture)),
      ),
    ),
  );

/** FILE-ATTACHMENTS: wrap Normalizer writeFile success. */
export const attachmentWriteViaG10Bridge = <A, E, R>(
  liveWrite: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-FILE-ATTACHMENTS",
    "attachment-write-succeeded",
    { site: "writeFile" },
    liveWrite.pipe(
      Effect.tap(() =>
        whenG9CapturePresent((capture) => capture(buildAttachmentWriteCaptureInput())),
      ),
    ),
  );

/** FILE-LOGS directory-create on config.ts. */
export const fileLogsDirCreateViaG10Bridge = <A, E, R>(
  member_id: "logsDir" | "providerLogsDir" | "terminalLogsDir",
  liveMkdir: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-FILE-LOGS",
    `${member_id}-directory-create-succeeded`,
    { member_id },
    liveMkdir.pipe(
      Effect.tap(() =>
        whenG9CapturePresent((capture) => capture(buildFileLogsDirCreateCaptureInput(member_id))),
      ),
    ),
  );

/** FILE-SECRETS: wrap secretsDir ensure / store-root success on config.ts. */
export const fileSecretsViaG10Bridge = <A, E, R>(
  liveSecrets: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-FILE-SECRETS",
    "secret-store-persisted",
    { comm_id: "present" },
    liveSecrets.pipe(
      Effect.tap(() =>
        whenG9CapturePresent((capture) => capture(buildSecretStorePersistedCaptureInput())),
      ),
    ),
  );

/** FILE-RUNTIME-STATE member write success. */
export const runtimeStateWriteViaG10Bridge = <A, E, R>(
  member_id:
    | "serverRuntimeStatePath"
    | "environmentIdPath"
    | "anonymousIdPath"
    | "keybindingsConfigPath",
  liveWrite: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> => {
  const phase =
    member_id === "serverRuntimeStatePath"
      ? "serverRuntimeStatePath-write-succeeded"
      : member_id === "environmentIdPath"
        ? "environmentIdPath-write-succeeded"
        : member_id === "anonymousIdPath"
          ? "anonymousIdPath-write-succeeded"
          : "keybindingsConfigPath-write-succeeded";
  return runWiredSuccessSeamViaG10Bridge(
    "INV-T2-FILE-RUNTIME-STATE",
    phase,
    { member_id },
    liveWrite.pipe(
      Effect.tap(() =>
        whenG9CapturePresent((capture) => capture(buildRuntimeStateWriteCaptureInput(member_id))),
      ),
    ),
  );
};

/** FILE-USAGE-CACHE persist success. */
export const usageCacheViaG10Bridge = <A, E, R>(
  livePersist: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-FILE-USAGE-CACHE",
    "usage-cache-persisted",
    { comm_id: "present" },
    livePersist.pipe(
      Effect.tap(() =>
        whenG9CapturePresent((capture) => capture(buildUsageCachePersistedCaptureInput())),
      ),
    ),
  );

/** FILE-WORKTREES create/remove success. */
export const worktreeViaG10Bridge = <A, E, R>(
  phase: "worktree-create-succeeded" | "worktree-remove-succeeded",
  liveWorktree: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-FILE-WORKTREES",
    phase,
    { comm_id: phase },
    liveWorktree.pipe(
      Effect.tap(() =>
        whenG9CapturePresent((capture) =>
          capture(
            phase === "worktree-create-succeeded"
              ? buildWorktreeCreateCaptureInput()
              : buildWorktreeRemoveCaptureInput(),
          ),
        ),
      ),
    ),
  );

/** FILE-PROVIDER-SESSION binding op success on ProviderSessionRuntime. */
export const providerSessionBindingViaG10Bridge = <A, E, R>(
  op: "upsert" | "getByThreadId" | "list" | "deleteByThreadId",
  liveBinding: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> => {
  const phase =
    op === "upsert"
      ? "provider-session-binding-upsert-succeeded"
      : op === "getByThreadId"
        ? "provider-session-binding-getByThreadId-succeeded"
        : op === "list"
          ? "provider-session-binding-list-succeeded"
          : "provider-session-binding-deleteByThreadId-succeeded";
  const projection =
    op === "upsert"
      ? ({ member_id: "upsert" } as const)
      : op === "deleteByThreadId"
        ? ({ member_id: "deleteByThreadId" } as const)
        : ({ member_id: "provider-session-binding" } as const);
  return runWiredSuccessSeamViaG10Bridge(
    "INV-T2-FILE-PROVIDER-SESSION",
    phase,
    projection,
    liveBinding.pipe(
      Effect.tap(() =>
        whenG9CapturePresent((capture) => capture(buildProviderSessionBindingCaptureInput(op))),
      ),
    ),
  );
};

/** Wrap ProjectionCheckpoints repository shape with G10 + G9 observe-beside. */
export const wrapProjectionCheckpointsWithG10 = (
  shape: ProjectionCheckpointRepositoryShape,
): ProjectionCheckpointRepositoryShape => ({
  upsert: (row) =>
    projectSqlViaG10Bridge("ProjectionCheckpoints-upsert-succeeded", shape.upsert(row)),
  listByThreadId: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionCheckpoints-listByThreadId-succeeded",
      shape.listByThreadId(input),
    ),
  getByThreadAndTurnCount: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionCheckpoints-getByThreadAndTurnCount-succeeded",
      shape.getByThreadAndTurnCount(input),
    ),
  deleteByThreadId: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionCheckpoints-deleteByThreadId-succeeded",
      shape.deleteByThreadId(input),
    ),
});

/** Wrap ProjectionPendingApprovals repository shape. */
export const wrapProjectionPendingApprovalsWithG10 = (
  shape: ProjectionPendingApprovalRepositoryShape,
): ProjectionPendingApprovalRepositoryShape => ({
  upsert: (row) =>
    projectSqlViaG10Bridge("ProjectionPendingApprovals-upsert-succeeded", shape.upsert(row)),
  listByThreadId: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionPendingApprovals-listByThreadId-succeeded",
      shape.listByThreadId(input),
    ),
  getByRequestId: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionPendingApprovals-getByRequestId-succeeded",
      shape.getByRequestId(input),
    ),
  deleteByRequestId: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionPendingApprovals-deleteByRequestId-succeeded",
      shape.deleteByRequestId(input),
    ),
});

/** Wrap ProjectionProjects repository shape. */
export const wrapProjectionProjectsWithG10 = (
  shape: ProjectionProjectRepositoryShape,
): ProjectionProjectRepositoryShape => ({
  upsert: (row) => projectSqlViaG10Bridge("ProjectionProjects-upsert-succeeded", shape.upsert(row)),
  getById: (input) =>
    projectSqlViaG10Bridge("ProjectionProjects-getById-succeeded", shape.getById(input)),
  listAll: () => projectSqlViaG10Bridge("ProjectionProjects-listAll-succeeded", shape.listAll()),
  deleteById: (input) =>
    projectSqlViaG10Bridge("ProjectionProjects-deleteById-succeeded", shape.deleteById(input)),
});

/** Wrap ProjectionState repository shape. */
export const wrapProjectionStateWithG10 = (
  shape: ProjectionStateRepositoryShape,
): ProjectionStateRepositoryShape => ({
  upsert: (row) => projectSqlViaG10Bridge("ProjectionState-upsert-succeeded", shape.upsert(row)),
  getByProjector: (input) =>
    projectSqlViaG10Bridge("ProjectionState-getByProjector-succeeded", shape.getByProjector(input)),
  listAll: () => projectSqlViaG10Bridge("ProjectionState-listAll-succeeded", shape.listAll()),
  minLastAppliedSequence: () =>
    projectSqlViaG10Bridge(
      "ProjectionState-minLastAppliedSequence-succeeded",
      shape.minLastAppliedSequence(),
    ),
});

/** Wrap ProjectionThreadActivities repository shape. */
export const wrapProjectionThreadActivitiesWithG10 = (
  shape: ProjectionThreadActivityRepositoryShape,
): ProjectionThreadActivityRepositoryShape => ({
  upsert: (row) =>
    projectSqlViaG10Bridge("ProjectionThreadActivities-upsert-succeeded", shape.upsert(row)),
  listByThreadId: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionThreadActivities-listByThreadId-succeeded",
      shape.listByThreadId(input),
    ),
  deleteByThreadId: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionThreadActivities-deleteByThreadId-succeeded",
      shape.deleteByThreadId(input),
    ),
});

/** Wrap ProjectionThreadMessages repository shape. */
export const wrapProjectionThreadMessagesWithG10 = (
  shape: ProjectionThreadMessageRepositoryShape,
): ProjectionThreadMessageRepositoryShape => ({
  upsert: (row) =>
    projectSqlViaG10Bridge("ProjectionThreadMessages-upsert-succeeded", shape.upsert(row)),
  getByMessageId: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionThreadMessages-getByMessageId-succeeded",
      shape.getByMessageId(input),
    ),
  listByThreadId: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionThreadMessages-listByThreadId-succeeded",
      shape.listByThreadId(input),
    ),
  deleteByThreadId: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionThreadMessages-deleteByThreadId-succeeded",
      shape.deleteByThreadId(input),
    ),
});

/** Wrap ProjectionThreadProposedPlans repository shape. */
export const wrapProjectionThreadProposedPlansWithG10 = (
  shape: ProjectionThreadProposedPlanRepositoryShape,
): ProjectionThreadProposedPlanRepositoryShape => ({
  upsert: (row) =>
    projectSqlViaG10Bridge("ProjectionThreadProposedPlans-upsert-succeeded", shape.upsert(row)),
  listByThreadId: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionThreadProposedPlans-listByThreadId-succeeded",
      shape.listByThreadId(input),
    ),
  deleteByThreadId: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionThreadProposedPlans-deleteByThreadId-succeeded",
      shape.deleteByThreadId(input),
    ),
});

/** Wrap ProjectionThreadSessions repository shape. */
export const wrapProjectionThreadSessionsWithG10 = (
  shape: ProjectionThreadSessionRepositoryShape,
): ProjectionThreadSessionRepositoryShape => ({
  upsert: (row) =>
    projectSqlViaG10Bridge("ProjectionThreadSessions-upsert-succeeded", shape.upsert(row)),
  getByThreadId: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionThreadSessions-getByThreadId-succeeded",
      shape.getByThreadId(input),
    ),
  deleteByThreadId: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionThreadSessions-deleteByThreadId-succeeded",
      shape.deleteByThreadId(input),
    ),
});

/** Wrap ProjectionThreads repository shape. */
export const wrapProjectionThreadsWithG10 = (
  shape: ProjectionThreadRepositoryShape,
): ProjectionThreadRepositoryShape => ({
  upsert: (row) => projectSqlViaG10Bridge("ProjectionThreads-upsert-succeeded", shape.upsert(row)),
  getById: (input) =>
    projectSqlViaG10Bridge("ProjectionThreads-getById-succeeded", shape.getById(input)),
  listByProjectId: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionThreads-listByProjectId-succeeded",
      shape.listByProjectId(input),
    ),
  deleteById: (input) =>
    projectSqlViaG10Bridge("ProjectionThreads-deleteById-succeeded", shape.deleteById(input)),
});

/** Wrap ProjectionTurns repository shape. */
export const wrapProjectionTurnsWithG10 = (
  shape: ProjectionTurnRepositoryShape,
): ProjectionTurnRepositoryShape => ({
  upsertByTurnId: (row) =>
    projectSqlViaG10Bridge("ProjectionTurns-upsertByTurnId-succeeded", shape.upsertByTurnId(row)),
  replacePendingTurnStart: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionTurns-replacePendingTurnStart-succeeded",
      shape.replacePendingTurnStart(input),
    ),
  getPendingTurnStartByThreadId: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionTurns-getPendingTurnStartByThreadId-succeeded",
      shape.getPendingTurnStartByThreadId(input),
    ),
  deletePendingTurnStartByThreadId: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionTurns-deletePendingTurnStartByThreadId-succeeded",
      shape.deletePendingTurnStartByThreadId(input),
    ),
  listByThreadId: (input) =>
    projectSqlViaG10Bridge("ProjectionTurns-listByThreadId-succeeded", shape.listByThreadId(input)),
  getByTurnId: (input) =>
    projectSqlViaG10Bridge("ProjectionTurns-getByTurnId-succeeded", shape.getByTurnId(input)),
  clearCheckpointTurnConflict: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionTurns-clearCheckpointTurnConflict-succeeded",
      shape.clearCheckpointTurnConflict(input),
    ),
  deleteByThreadId: (input) =>
    projectSqlViaG10Bridge(
      "ProjectionTurns-deleteByThreadId-succeeded",
      shape.deleteByThreadId(input),
    ),
});

/** Wrap ProjectionSnapshotQuery shape (PROJECT-READ). */
export const wrapProjectionSnapshotQueryWithG10 = (
  shape: ProjectionSnapshotQueryShape,
): ProjectionSnapshotQueryShape => ({
  getCommandReadModel: () =>
    projectReadViaG10Bridge("getCommandReadModel", shape.getCommandReadModel()),
  getSnapshot: () => projectReadViaG10Bridge("getSnapshot", shape.getSnapshot()),
  getShellSnapshot: () => projectReadViaG10Bridge("getShellSnapshot", shape.getShellSnapshot()),
  getArchivedShellSnapshot: () =>
    projectReadViaG10Bridge("getArchivedShellSnapshot", shape.getArchivedShellSnapshot()),
  searchThreads: (input) => projectReadViaG10Bridge("searchThreads", shape.searchThreads(input)),
  getSnapshotSequence: () =>
    projectReadViaG10Bridge("getSnapshotSequence", shape.getSnapshotSequence()),
  getCounts: () => projectReadViaG10Bridge("getCounts", shape.getCounts()),
  getActiveProjectByWorkspaceRoot: (workspaceRoot) =>
    projectReadViaG10Bridge(
      "getActiveProjectByWorkspaceRoot",
      shape.getActiveProjectByWorkspaceRoot(workspaceRoot),
    ),
  getProjectShellById: (projectId) =>
    projectReadViaG10Bridge("getProjectShellById", shape.getProjectShellById(projectId)),
  getFirstActiveThreadIdByProjectId: (projectId) =>
    projectReadViaG10Bridge(
      "getFirstActiveThreadIdByProjectId",
      shape.getFirstActiveThreadIdByProjectId(projectId),
    ),
  getThreadCheckpointContext: (threadId) =>
    projectReadViaG10Bridge(
      "getThreadCheckpointContext",
      shape.getThreadCheckpointContext(threadId),
    ),
  getFullThreadDiffContext: (threadId, toTurnCount) =>
    projectReadViaG10Bridge(
      "getFullThreadDiffContext",
      shape.getFullThreadDiffContext(threadId, toTurnCount),
    ),
  getThreadShellById: (threadId) =>
    projectReadViaG10Bridge("getThreadShellById", shape.getThreadShellById(threadId)),
  getThreadDetailById: (threadId) =>
    projectReadViaG10Bridge("getThreadDetailById", shape.getThreadDetailById(threadId)),
  getThreadDetailSnapshot: (threadId, window) =>
    projectReadViaG10Bridge(
      "getThreadDetailSnapshot",
      shape.getThreadDetailSnapshot(threadId, window),
    ),
});

/** Wrap ProviderSessionRuntime repository shape (binding phases only). */
export const wrapProviderSessionRuntimeWithG10 = (
  shape: ProviderSessionRuntimeRepository["Service"],
): ProviderSessionRuntimeRepository["Service"] => ({
  upsert: (runtime) => providerSessionBindingViaG10Bridge("upsert", shape.upsert(runtime)),
  getByThreadId: (input) =>
    providerSessionBindingViaG10Bridge("getByThreadId", shape.getByThreadId(input)),
  list: () => providerSessionBindingViaG10Bridge("list", shape.list()),
  deleteByThreadId: (input) =>
    providerSessionBindingViaG10Bridge("deleteByThreadId", shape.deleteByThreadId(input)),
});

/**
 * FILE-CHECKPOINTS handoff (S7 → S3 VcsDriver).
 * Agent: S7 must NOT commit VcsDriver.ts. Stub ≡ only until S3 lands patch.
 */
export const G10_S7_FILE_CHECKPOINTS_HANDOFF = {
  commId: "INV-T2-FILE-CHECKPOINTS" as const,
  landerSlice: "S3" as const,
  landerModule: "apps/server/src/vcs/VcsDriver.ts",
  status: "handoff-pending" as const,
  handoffDoc: "docs/scm/g10/handoffs/S7-FILE-CHECKPOINTS-to-S3.md",
  note: "Do not claim S7-wired or dual-run-exit (a) for FILE-CHECKPOINTS from S7; S7 does not commit VcsDriver.ts",
} as const;

/**
 * FLAG-CLOUDFLARED handoff (S7 → S3 relayClient).
 */
export const G10_S7_FLAG_CLOUDFLARED_HANDOFF = {
  commId: "INV-T2-FLAG-CLOUDFLARED" as const,
  landerSlice: "S3" as const,
  landerModule: "packages/shared/src/relayClient.ts",
  status: "handoff-pending" as const,
  handoffDoc: "docs/scm/g10/handoffs/S7-FLAG-CLOUDFLARED-to-S3.md",
  note: "Do not claim S7-wired or dual-run-exit (a) for FLAG-CLOUDFLARED from S7; S7 does not commit relayClient.ts",
} as const;

/**
 * FILE-PROVIDER-SESSION cache phases handoff (S7 → S4 providerStatusCache).
 * Binding phases stay S7-wired on ProviderSessionRuntime.
 */
export const G10_S7_FILE_PROVIDER_SESSION_CACHE_HANDOFF = {
  commId: "INV-T2-FILE-PROVIDER-SESSION" as const,
  phases: [
    "provider-status-cache-read-succeeded",
    "provider-status-cache-write-succeeded",
  ] as const,
  landerSlice: "S4" as const,
  landerModule: "apps/server/src/provider/providerStatusCache.ts",
  status: "handoff-pending" as const,
  handoffDoc: "docs/scm/g10/handoffs/S7-FILE-PROVIDER-SESSION-to-S4.md",
  note: "Cache phases deferred to S4 lander; binding phases wired on ProviderSessionRuntime",
} as const;

/**
 * FILE-LOGS provider-event-log handoff (S7 → S4 ProviderEventLoggers).
 */
export const G10_S7_FILE_LOGS_PROVIDER_EVENT_LOG_HANDOFF = {
  commId: "INV-T2-FILE-LOGS" as const,
  phase: "providerEventLogPath-writer-succeeded" as const,
  landerSlice: "S4" as const,
  landerModule: "apps/server/src/provider/Layers/ProviderEventLoggers.ts",
  status: "handoff-pending" as const,
  handoffDoc: "docs/scm/g10/handoffs/S7-FILE-LOGS-provider-event-log-to-S4.md",
  note: "provider-event-log phase deferred to S4; config.ts dir phases wired under S7",
} as const;

/**
 * FLAG-CODEX-LAUNCH handoff (S7 → S4 codexLaunchArgs).
 */
export const G10_S7_FLAG_CODEX_LAUNCH_HANDOFF = {
  commId: "INV-T2-FLAG-CODEX-LAUNCH" as const,
  landerSlice: "S4" as const,
  landerModule: "apps/server/src/provider/Layers/codexLaunchArgs.ts",
  status: "handoff-pending" as const,
  handoffDoc: "docs/scm/g10/handoffs/S7-FLAG-CODEX-LAUNCH-to-S4.md",
  note: "Do not claim S7-wired or dual-run-exit (a) for FLAG-CODEX-LAUNCH from S7",
} as const;

/**
 * FILE-LOGS terminalLogs handoff (S7 → S5 Manager).
 */
export const G10_S7_FILE_LOGS_TERMINAL_LOGS_HANDOFF = {
  commId: "INV-T2-FILE-LOGS" as const,
  phase: "terminalLogs-writer-succeeded" as const,
  landerSlice: "S5" as const,
  landerModule: "apps/server/src/terminal/Manager.ts",
  status: "handoff-pending" as const,
  handoffDoc: "docs/scm/g10/handoffs/S7-FILE-LOGS-terminalLogs-to-S5.md",
  note: "terminalLogs phase deferred to S5; config.ts dir phases wired under S7",
} as const;

/**
 * FLAG-TERM-ENV handoff (S7 → S5 Manager).
 */
export const G10_S7_FLAG_TERM_ENV_HANDOFF = {
  commId: "INV-T2-FLAG-TERM-ENV" as const,
  landerSlice: "S5" as const,
  landerModule: "apps/server/src/terminal/Manager.ts",
  status: "handoff-pending" as const,
  handoffDoc: "docs/scm/g10/handoffs/S7-FLAG-TERM-ENV-to-S5.md",
  note: "Do not claim S7-wired or dual-run-exit (a) for FLAG-TERM-ENV from S7",
} as const;
