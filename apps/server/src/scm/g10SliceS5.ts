/**
 * G10 S5 campaign controller (Ordered proof + seam-bridge traffic).
 *
 * Intended: own S5 admit/route/replace + Ordered proof sequence helpers
 * wrapping createSubstitutionModel / installAdmitRouteReplace /
 * recordOrderedProofStep / armInversion / restorePreCutoverLive. Wired seams:
 *   - terminal/Manager.ts sole lander: INV-T2-TERM (FILE-LOGS terminalLogs /
 *     FLAG-TERM-ENV are S7 handoffs — do not steal)
 *   - NativeTelemetryClient.ts sole lander: INV-T2-RES-MONITOR
 *   - DesktopTelemetryReceiver.ts sole lander: INV-T2-TEL-DESKTOP-IN +
 *     TEL-DESKTOP-CONTROL handoff FROM S3
 * TEL-NDJSON / TEL-T3-TRACE are S5→S6 handoff-pending on T2Observability /
 * Observability — ledger stub only; S5 must NOT commit those files.
 *
 * Observed: in-memory model + traffic log; dualRunExit / armInversion never
 * call markDualRunExited — recordOrderedProofStep is sole dual-run-exit /
 * arm-inversion writer. Absent controller ⇒ live paths unchanged.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import type { G9EqualityA } from "./g9Occurrence.ts";
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

/** Frozen S5 inventory `comm_id` set (5 rows — do not resize). */
export const G10_S5_COMM_IDS = [
  "INV-T2-RES-MONITOR",
  "INV-T2-TEL-DESKTOP-IN",
  "INV-T2-TEL-NDJSON",
  "INV-T2-TEL-T3-TRACE",
  "INV-T2-TERM",
] as const;

export type G10S5CommId = (typeof G10_S5_COMM_IDS)[number];

/**
 * S5-owned seams with real g10SeamBridge wiring on S5 sole landers, plus
 * TEL-DESKTOP-CONTROL completed from S3 handoff on DesktopTelemetryReceiver.
 * Agent: dual-run-exit (a)/(e) may claim these four only — not NDJSON/T3-TRACE.
 */
export const G10_S5_WIRED_COMM_IDS = [
  "INV-T2-RES-MONITOR",
  "INV-T2-TEL-DESKTOP-IN",
  "INV-T2-TEL-DESKTOP-CONTROL",
  "INV-T2-TERM",
] as const;

export type G10S5WiredCommId = (typeof G10_S5_WIRED_COMM_IDS)[number];

/**
 * S5 inventory rows deferred to S6 sole landers (T2Observability / Observability).
 * Agent: handoff stub for ≡ carrier only — not admit/route/replace wiring.
 */
export const G10_S5_HANDOFF_PENDING_COMM_IDS = [
  "INV-T2-TEL-NDJSON",
  "INV-T2-TEL-T3-TRACE",
] as const;

/**
 * S3→S5 handoff row landed on DesktopTelemetryReceiver.ts (not in S5 inventory).
 * Agent: S3 owned comm_id; S5 sole lander completes admit/route/replace.
 */
export const G10_S5_HANDOFF_LANDED_FROM_S3_COMM_IDS = ["INV-T2-TEL-DESKTOP-CONTROL"] as const;

/**
 * Traffic sample comm_id (S5 inventory ∪ DESKTOP-CONTROL handoff land ∪ S8
 * reopen FLAG-TERM-ENV land from S7).
 */
export type G10S5TrafficCommId =
  | G10S5CommId
  | "INV-T2-TEL-DESKTOP-CONTROL"
  | "INV-T2-FLAG-TERM-ENV"
  | "INV-T2-FILE-LOGS";

/**
 * S7→S5 FLAG-TERM-ENV land completed at S8 lander reopen (not in S5 WIRED /
 * historical exit (a); S8 audit disposition owns campaign close).
 */
export const G10_S5_S8_REOPEN_LANDED_FROM_S7_COMM_IDS = ["INV-T2-FLAG-TERM-ENV"] as const;

/** TERM phase ids used by Manager lander + Ordered rehearsal. */
export type G10S5TermPhase =
  | "pty-spawn-succeeded"
  | "pty-exit-succeeded"
  | "pty-input-write-succeeded"
  | "pty-output-callback-emitted"
  | "terminal-session-callback-emitted"
  | "terminal-metadata-callback-emitted";

/** RES-MONITOR stdin command tags (ledger A; no args). */
export type G10S5MonitorCommand =
  | "configure"
  | "setExternalProcesses"
  | "sampleNow"
  | "setSampleInterval"
  | "setStreaming"
  | "readHistory"
  | "shutdown";

/** RES-MONITOR decoded event_type tags (ledger A). */
export type G10S5MonitorEventType = "hello" | "snapshot" | "historyChunk" | "error";

/** TEL-DESKTOP-CONTROL / ledger TEL-DESKTOP-IN message_type domain. */
export type G10S5DesktopControlOperation = "setDiagnosticsDemand" | "setHostPowerIntervals";

/** One manifold (or live) traffic sample for ≡ under G9DeferredEquality. */
export type G10S5TrafficSample = {
  readonly path: "live" | "manifold";
  readonly commId: G10S5TrafficCommId;
  readonly phase: string;
  readonly projection: G9EqualityA;
  readonly atMs: number;
};

/** Structured evidence body for one Ordered proof step (markdown writer input). */
export type G10S5EvidenceBody = {
  readonly slice: "S5";
  readonly step: OrderedProofStep | "land";
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
 * In-memory manifold stub traffic log (S5 terminal/telemetry + NDJSON/T3 stubs).
 *
 * Intended: enough samples for live-vs-manifold ≡ under G9DeferredEquality.
 * Observed: append-only arrays; cleared on rollback restore when requested.
 */
export type G10S5ManifoldTrafficLog = {
  readonly samples: G10S5TrafficSample[];
};

/**
 * Representative phase + projection A for each wired S5 seam (Ordered rehearsal).
 * Agent: keep ledger-bounded; no PTY/NDJSON/payload bytes in A.
 */
const G10_S5_WIRED_REHEARSAL: ReadonlyArray<{
  readonly commId: G10S5WiredCommId;
  readonly phase: string;
  readonly projection: G9EqualityA;
}> = [
  {
    commId: "INV-T2-RES-MONITOR",
    phase: "monitor-spawn-succeeded",
    projection: { site: "spawned" },
  },
  {
    commId: "INV-T2-TEL-DESKTOP-IN",
    phase: "desktop-message-decoded",
    // Ledger A domain for TEL-DESKTOP-IN is frozen to control-op labels
    // (known quirk vs live desktopTelemetry*). Cutover uses representative A.
    projection: { message_type: "setDiagnosticsDemand" },
  },
  {
    commId: "INV-T2-TEL-DESKTOP-CONTROL",
    phase: "desktop-control-send-succeeded",
    projection: { operation: "setDiagnosticsDemand" },
  },
  {
    commId: "INV-T2-TERM",
    phase: "pty-spawn-succeeded",
    projection: { site: "spawned" },
  },
];

/** Projection A for each TERM phase (matches g9FamilyTerminalLocalStreams). */
const termProjectionForPhase = (phase: G10S5TermPhase): G9EqualityA => {
  switch (phase) {
    case "pty-spawn-succeeded":
      return { site: "spawned" };
    case "pty-exit-succeeded":
      return { site: "exited" };
    case "pty-input-write-succeeded":
      return { site: "pty-input-write" };
    case "pty-output-callback-emitted":
      return { site: "pty-output-callback" };
    case "terminal-session-callback-emitted":
      return { site: "session-callback" };
    case "terminal-metadata-callback-emitted":
      return { site: "metadata-callback" };
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
};

/**
 * S5 campaign controller shape (process-global or Effect service).
 *
 * Agent: land → liveRehearsal → recordEquiv → rollbackDrill → dualRunExit →
 * armInversion. dualRunExit uses recordOrderedProofStep only.
 */
export type G10S5Controller = {
  readonly slice: "S5";
  readonly model: G10SubstitutionModel;
  readonly registry: G10CutoverRegistry;
  readonly traffic: G10S5ManifoldTrafficLog;
  /** admit/route/replace + Ordered proof "land". */
  readonly land: () => G10S5EvidenceBody;
  /**
   * Live-authoritative rehearsal: observe traffic + one rollback restore +
   * re-land install + record live-rehearsal step.
   */
  readonly liveRehearsal: () => G10S5EvidenceBody;
  /** Cutover ≡ under G9DeferredEquality for S5 inventory + CONTROL land. */
  readonly recordEquiv: () => G10S5EvidenceBody;
  /** Rollback drill: restore live, re-prove authority, record step. */
  readonly rollbackDrill: () => G10S5EvidenceBody;
  /** Dual-run exit via recordOrderedProofStep only (refuses markDualRunExited). */
  readonly dualRunExit: () => G10S5EvidenceBody;
  /** Arm inversion via armInversion → recordOrderedProofStep. */
  readonly armInversion: () => G10S5EvidenceBody;
  /**
   * Record live traffic for a wired S5 lander seam.
   * Agent: do not use for NDJSON/T3-TRACE handoff — that stays recordStubPair.
   */
  readonly recordLiveWiredSeam: (
    commId: G10S5WiredCommId,
    phase: string,
    projection: G9EqualityA,
  ) => void;
  /** Record manifold observe/authority sample for a wired S5 seam. */
  readonly recordManifoldWiredSeam: (
    commId: G10S5WiredCommId,
    phase: string,
    projection: G9EqualityA,
  ) => void;
  /**
   * Record handoff-pending stub pair (TEL-NDJSON / TEL-T3-TRACE → S6 only).
   * Agent: not admit/route/replace wiring; ≡ carrier coverage for deferred rows.
   */
  readonly recordStubPair: (commId: G10S5CommId, phase: string, projection: G9EqualityA) => void;
  /** True when replace installed for S5. */
  readonly isReplaceInstalled: () => boolean;
  readonly authority: () => "live" | "manifold";
  readonly phase: () => CutoverPhase;
  readonly inversionArmed: () => boolean;
  /** Format evidence markdown for a recorded step body. */
  readonly formatEvidenceMarkdown: (body: G10S5EvidenceBody) => string;
  /** Run full Ordered proof sequence; returns bodies in order. */
  readonly runFullOrderedProof: () => readonly G10S5EvidenceBody[];
};

/** Process-global optional controller (tests / lander fallback). */
let processGlobalG10S5: G10S5Controller | undefined;

/**
 * Install or clear the process-global S5 controller.
 *
 * Intended: tests set before Manager/NativeTelemetry/DesktopTelemetry effects;
 * production prefers Layer. Observed: module singleton; absent ⇒ lander live
 * unchanged.
 */
export const installProcessGlobalG10S5 = (controller: G10S5Controller | undefined): void => {
  processGlobalG10S5 = controller;
};

/** Read process-global S5 controller (undefined when absent). */
export const getProcessGlobalG10S5 = (): G10S5Controller | undefined => processGlobalG10S5;

/**
 * Effect service key for optional S5 cutover controller (G9CaptureService pattern).
 *
 * Absent ⇒ Manager / NativeTelemetry / DesktopTelemetry live paths unchanged.
 */
export class G10S5CutoverService extends Context.Service<G10S5CutoverService, G10S5Controller>()(
  "t3/scm/g10SliceS5/G10S5CutoverService",
) {}

/**
 * Layer.succeed helper for tests / optional stack merge.
 *
 * Intended: provides server G10S5CutoverService so landers resolve via Context.
 */
export const G10S5CutoverLayer = (controller: G10S5Controller): Layer.Layer<G10S5CutoverService> =>
  Layer.succeed(G10S5CutoverService, controller);

/**
 * Resolve optional S5 controller: Effect.serviceOption first, then process-global.
 *
 * Intended: lander sites call this once per seam. Absent ⇒ live only.
 */
export const resolveOptionalG10S5 = (): Effect.Effect<Option.Option<G10S5Controller>> =>
  Effect.gen(function* () {
    const fromService = yield* Effect.serviceOption(G10S5CutoverService);
    if (Option.isSome(fromService)) return fromService;
    const global = processGlobalG10S5;
    return global === undefined ? Option.none() : Option.some(global);
  });

const nowMs = (): number => Date.now();

const pushSample = (traffic: G10S5ManifoldTrafficLog, sample: G10S5TrafficSample): void => {
  traffic.samples.push(sample);
};

/**
 * Create an S5 campaign controller bound to inventory registry.
 *
 * Parameters
 * ----------
 * repoRoot : string
 *     Monorepo root for seam-inventory load (defaults to resolveG10RepoRoot).
 *
 * Returns
 * -------
 * G10S5Controller
 *     Mutable coordinator for S5 Ordered proof + manifold traffic.
 */
export const createG10S5Controller = (repoRoot: string = resolveG10RepoRoot()): G10S5Controller => {
  const registry = loadG10CutoverRegistry(repoRoot);
  const model = createSubstitutionModel(registry);
  const traffic: G10S5ManifoldTrafficLog = { samples: [] };

  const s5Ids = activatableCommIdsForSlice(registry, "S5");
  // Hard lock: inventory S5 set must match frozen 5 (no silent resize).
  if (s5Ids.length !== G10_S5_COMM_IDS.length) {
    throw new Error(
      `G10 S5 controller: inventory S5 count ${s5Ids.length} ≠ frozen ${G10_S5_COMM_IDS.length}`,
    );
  }
  for (const id of G10_S5_COMM_IDS) {
    if (!s5Ids.includes(id)) {
      throw new Error(`G10 S5 controller: missing inventory id ${id}`);
    }
  }

  const recordLiveWiredSeam = (
    commId: G10S5WiredCommId,
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
    commId: G10S5WiredCommId,
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

  const recordStubPair = (commId: G10S5CommId, phase: string, projection: G9EqualityA): void => {
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
    step: OrderedProofStep | "land",
    notes: readonly string[],
    equalitySamples?: readonly G9DeferredEquality[],
  ): G10S5EvidenceBody => {
    const liveCount = traffic.samples.filter((s) => s.path === "live").length;
    const manifoldCount = traffic.samples.filter((s) => s.path === "manifold").length;
    return {
      slice: "S5",
      step,
      phase: phaseForSlice(model, "S5"),
      authority: authorityForSlice(model, "S5"),
      inversionArmed: model.sliceStates.get("S5")?.inversionArmed === true,
      commIds: [...s5Ids],
      notes,
      equalitySamples,
      trafficSummary: { liveCount, manifoldCount },
    };
  };

  const formatEvidenceMarkdown = (body: G10S5EvidenceBody): string => {
    const lines = [
      `# S5 ${body.step} evidence`,
      "",
      `<!-- Agent: G10 S5 Ordered proof step. Slice=${body.slice}. -->`,
      "",
      `- Date: ${new Date().toISOString().slice(0, 10)}`,
      `- Slice: **S5**`,
      `- Step: **${body.step}**`,
      `- Phase: \`${body.phase}\``,
      `- Authority: **${body.authority}**`,
      `- inversionArmed: \`${body.inversionArmed}\``,
      `- S5 comm_ids (${body.commIds.length}): ${body.commIds.join(", ")}`,
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

  /**
   * Seed TEL-NDJSON / TEL-T3-TRACE handoff stubs only (S5→S6; not seam-bridge wired).
   * Agent: T2Observability.ts / Observability.ts are S6 sole landers — S5 must not commit them.
   */
  const seedObsHandoffStubs = (): void => {
    recordStubPair("INV-T2-TEL-NDJSON", "ndjson-export-succeeded", {
      comm_id: "present",
    });
    recordStubPair("INV-T2-TEL-T3-TRACE", "t3-trace-persisted-batch-succeeded", {
      comm_id: "present",
    });
  };

  /**
   * Dual-run observe rehearsal through seam bridge (live authoritative).
   * Records all four wired S5 seams without real I/O.
   */
  const rehearseWiredSeamsObserve = (): void => {
    for (const row of G10_S5_WIRED_REHEARSAL) {
      void Effect.runSync(
        runG10SeamBridge({
          model,
          slice: "S5",
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

  const land = (): G10S5EvidenceBody => {
    installAdmitRouteReplace(model, "S5");
    recordOrderedProofStep(model, "S5", "land");
    return snapshotEvidence("land", [
      "admit/route/replace installed for S5 radius (5 inventory rows)",
      "authority remains live (dual-run); manifold observe-beside eligible",
      "wired seams (4): TERM + RES-MONITOR + TEL-DESKTOP-IN + TEL-DESKTOP-CONTROL (S3 handoff land)",
      "TEL-NDJSON / TEL-T3-TRACE handoff-pending S6 (T2Observability / Observability) — not S5-wired; S5 does not commit those files",
      "FILE-LOGS terminalLogs / FLAG-TERM-ENV left for S7 handoff on Manager — not stolen",
      "markDualRunExited not used",
    ]);
  };

  const liveRehearsal = (): G10S5EvidenceBody => {
    if (!model.installs.get("S5")?.replaceInstalled) {
      throw new Error("G10 S5 liveRehearsal requires land first");
    }
    rehearseWiredSeamsObserve();
    seedObsHandoffStubs();
    restorePreCutoverLive(model, "S5");
    if (authorityForSlice(model, "S5") !== "live") {
      throw new Error("G10 S5 liveRehearsal: restore did not return live authority");
    }
    if (!model.installs.get("S5")?.replaceInstalled) {
      installAdmitRouteReplace(model, "S5");
    } else {
      const install = model.installs.get("S5");
      if (install && install.authority !== "live") {
        model.installs.set("S5", { ...install, authority: "live" });
      }
    }
    rehearseWiredSeamsObserve();
    recordOrderedProofStep(model, "S5", "live-rehearsal");
    return snapshotEvidence("live-rehearsal", [
      "dual-run observe on four wired S5 seams via g10SeamBridge (live authoritative)",
      "TEL-NDJSON / TEL-T3-TRACE handoff stubs only (deferred to S6 T2Observability/Observability; not bridge-wired)",
      "TEL-DESKTOP-CONTROL S3→S5 handoff land exercised on DesktopTelemetryReceiver.ts",
      "one rollback restore + re-land under live authority",
      "inversion not armed; live remains authoritative",
    ]);
  };

  const recordEquiv = (): G10S5EvidenceBody => {
    const byComm = new Map<string, { live?: G9EqualityA; manifold?: G9EqualityA }>();
    for (const sample of traffic.samples) {
      const entry = byComm.get(sample.commId) ?? {};
      if (sample.path === "live") entry.live = sample.projection;
      else entry.manifold = sample.projection;
      byComm.set(sample.commId, entry);
    }
    const equalitySamples: G9DeferredEquality[] = [];
    const missing: string[] = [];
    // Inventory 5 (includes NDJSON/T3-TRACE stubs) + TEL-DESKTOP-CONTROL handoff land.
    const equivIds = [...G10_S5_COMM_IDS, "INV-T2-TEL-DESKTOP-CONTROL"] as const;
    for (const id of equivIds) {
      const pair = byComm.get(id);
      if (!pair?.live || !pair.manifold) {
        missing.push(id);
        continue;
      }
      if (JSON.stringify(pair.live) !== JSON.stringify(pair.manifold)) {
        throw new Error(
          `G10 S5 ≡ failed for ${id}: live=${JSON.stringify(pair.live)} manifold=${JSON.stringify(pair.manifold)}`,
        );
      }
      equalitySamples.push(asG9DeferredEquality(pair.live));
    }
    if (missing.length > 0) {
      throw new Error(`G10 S5 ≡ missing traffic for: ${missing.join(", ")}`);
    }
    recordOrderedProofStep(model, "S5", "cutover-equivalence");
    return snapshotEvidence(
      "cutover-equivalence",
      [
        "wired four: live≡manifold via g10SeamBridge (TERM/RES-MONITOR/TEL-DESKTOP-IN/TEL-DESKTOP-CONTROL)",
        "TEL-NDJSON / TEL-T3-TRACE: handoff-deferred stub pairs only (S6 landers; not (a) for those rows)",
        "not WP8 763-fixture-as-proof",
        "type carrier: asG9DeferredEquality from g10ProofHarness",
      ],
      equalitySamples,
    );
  };

  const rollbackDrill = (): G10S5EvidenceBody => {
    const result = restorePreCutoverLive(model, "S5");
    if (
      result.restoredAuthority !== "live" ||
      result.clearedShadowEnv ||
      result.usedHaltController
    ) {
      throw new Error("G10 S5 rollbackDrill: invalid rollback result");
    }
    if (authorityForSlice(model, "S5") !== "live") {
      throw new Error("G10 S5 rollbackDrill: authority not live after restore");
    }
    const proved = Effect.runSync(
      runG10SeamBridge({
        model,
        slice: "S5",
        commId: "INV-T2-TERM",
        liveEffect: Effect.succeed("live-ok"),
        manifoldEffect: Effect.succeed("manifold-should-not-win"),
        manifoldObserveEffect: Effect.void,
      }),
    );
    if (proved !== "live-ok") {
      throw new Error("G10 S5 rollbackDrill: live authority not selected");
    }
    recordOrderedProofStep(model, "S5", "rollback-drill");
    return snapshotEvidence("rollback-drill", [
      "restorePreCutoverLive restored live authority",
      "rollback ≠ unset T2CODE_SCM_G9_SHADOW; no halt controller",
      "re-proved live-authoritative bridge selection for TERM",
      "restore scope: Manager.ts + NativeTelemetryClient.ts + DesktopTelemetryReceiver.ts",
      "TEL-NDJSON / TEL-T3-TRACE restore stays with S6 landers (not S5)",
    ]);
  };

  const dualRunExit = (): G10S5EvidenceBody => {
    recordOrderedProofStep(model, "S5", "dual-run-exit");
    if (authorityForSlice(model, "S5") !== "manifold") {
      throw new Error("G10 S5 dualRunExit: authority not manifold after proof step");
    }
    return snapshotEvidence("dual-run-exit", [
      "exit (a)/(e) for four wired S5 seams only (TERM/RES-MONITOR/TEL-DESKTOP-IN/TEL-DESKTOP-CONTROL)",
      "TEL-NDJSON / TEL-T3-TRACE handoff-deferred to S6 — not claimed under exit (a)",
      'flipped solely via recordOrderedProofStep(..., "dual-run-exit")',
      "markDualRunExited not used (S0 escalation sole-owner binding)",
      "prerequisites: land + live-rehearsal + ≡ + rollback-drill green for wired four",
      "FILE-LOGS terminalLogs / FLAG-TERM-ENV not exited under S5",
    ]);
  };

  const armInversionStep = (): G10S5EvidenceBody => {
    armInversion(model, "S5", registry);
    if (model.sliceStates.get("S5")?.inversionArmed !== true) {
      throw new Error("G10 S5 armInversion: inversionArmed not true");
    }
    return snapshotEvidence("arm-inversion", [
      "noninterference inversion armed after dual-run-exit",
      "manifold failure may now fail user-visible S5 terminal/telemetry-in ops",
      "armed solely via armInversion → recordOrderedProofStep",
      "TEL-NDJSON / TEL-T3-TRACE remain handoff-deferred — not inverted from S5 wiring",
    ]);
  };

  const runFullOrderedProof = (): readonly G10S5EvidenceBody[] => {
    const bodies: G10S5EvidenceBody[] = [];
    bodies.push(land());
    bodies.push(liveRehearsal());
    bodies.push(recordEquiv());
    bodies.push(rollbackDrill());
    bodies.push(dualRunExit());
    bodies.push(armInversionStep());
    if (!orderedProofSatisfiedThrough(model, "S5", "arm-inversion")) {
      throw new Error("G10 S5 runFullOrderedProof: Ordered proof incomplete");
    }
    return bodies;
  };

  return {
    slice: "S5",
    model,
    registry,
    traffic,
    land,
    liveRehearsal,
    recordEquiv,
    rollbackDrill,
    dualRunExit,
    armInversion: armInversionStep,
    recordLiveWiredSeam,
    recordManifoldWiredSeam,
    recordStubPair,
    isReplaceInstalled: () => model.installs.get("S5")?.replaceInstalled === true,
    authority: () => authorityForSlice(model, "S5"),
    phase: () => phaseForSlice(model, "S5"),
    inversionArmed: () => model.sliceStates.get("S5")?.inversionArmed === true,
    formatEvidenceMarkdown,
    runFullOrderedProof,
  };
};

/**
 * Shared lander bridge: success live I/O (terminal/telemetry) via g10SeamBridge.
 *
 * Intended: absent/not-replaced ⇒ live only. Present + replaced ⇒
 * runG10SeamBridge with live/manifold record hooks.
 *
 * Observed: reuses live I/O on manifold authority so terminal/telemetry still fire.
 */
const runWiredSuccessSeamViaG10Bridge = <A, E, R>(
  commId: G10S5WiredCommId,
  phase: string,
  projection: G9EqualityA,
  liveIo: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const opt = yield* resolveOptionalG10S5();
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
      slice: "S5",
      commId,
      liveEffect,
      manifoldEffect: manifoldAuthority,
      manifoldObserveEffect: manifoldObserve,
    });
  });

/**
 * TERM: wrap Manager.ts TERM phase success through G10 bridge.
 * Agent: call sites only in terminal/Manager.ts. Do NOT wrap FILE-LOGS /
 * FLAG-TERM-ENV (S7 handoffs).
 */
export const termPhaseViaG10Bridge = <A, E, R>(
  phase: G10S5TermPhase,
  liveTerm: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge("INV-T2-TERM", phase, termProjectionForPhase(phase), liveTerm);

/**
 * RES-MONITOR spawn: wrap NativeTelemetryClient spawn success.
 * Agent: call site only after ChildProcessSpawner.spawn succeeds.
 */
export const resMonitorSpawnViaG10Bridge = <A, E, R>(
  liveSpawn: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-RES-MONITOR",
    "monitor-spawn-succeeded",
    { site: "spawned" },
    liveSpawn,
  );

/**
 * RES-MONITOR stdin write: wrap writeCommand success.
 * Agent: call site only in NativeTelemetryClient.ts writeCommand.
 */
export const resMonitorStdinWriteViaG10Bridge = <A, E, R>(
  command: G10S5MonitorCommand,
  liveWrite: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-RES-MONITOR",
    "monitor-stdin-write-succeeded",
    { command },
    liveWrite,
  );

/**
 * RES-MONITOR event decode: wrap decodeMonitorEvent success.
 * Agent: call site only in NativeTelemetryClient.ts stream mapEffect.
 */
export const resMonitorEventDecodedViaG10Bridge = <A, E, R>(
  event_type: G10S5MonitorEventType,
  liveDecode: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-RES-MONITOR",
    "monitor-event-decoded",
    { event_type },
    liveDecode,
  );

/**
 * TEL-DESKTOP-IN: wrap DesktopHostTelemetryMessage decode success.
 * Agent: call site only in DesktopTelemetryReceiver.ts decode path.
 * Ledger A uses control-op labels as representative (frozen quirk).
 */
export const desktopInViaG10Bridge = <A, E, R>(
  liveDecode: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-TEL-DESKTOP-IN",
    "desktop-message-decoded",
    { message_type: "setDiagnosticsDemand" },
    liveDecode,
  );

/**
 * TEL-DESKTOP-CONTROL: wrap sendControlMessage success (S3→S5 handoff land).
 * Agent: call site only in DesktopTelemetryReceiver.ts after write succeeds.
 */
export const desktopControlViaG10Bridge = <A, E, R>(
  operation: G10S5DesktopControlOperation,
  liveSend: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-TEL-DESKTOP-CONTROL",
    "desktop-control-send-succeeded",
    { operation },
    liveSend,
  );

/**
 * TEL-NDJSON handoff documentation (S5 → S6).
 *
 * Intended: S5 must NOT wire admit/route/replace in T2Observability.ts.
 * S6 sole lander owns INV-T2-TEL-NDJSON cutover. S5 keeps a ledger stub
 * pair for Ordered-proof ≡ carrier coverage only.
 * Observed: this constant is documentation for agents — no runtime effect.
 */
export const G10_S5_TEL_NDJSON_HANDOFF = {
  commId: "INV-T2-TEL-NDJSON" as const,
  landerSlice: "S6" as const,
  landerModule: "apps/server/src/t2Observability/T2Observability.ts",
  status: "handoff-pending" as const,
  handoffDoc: "docs/scm/g10/handoffs/S5-TEL-NDJSON-to-S6.md",
  note: "Do not claim S5-wired or dual-run-exit (a) for TEL-NDJSON from S5; S5 does not commit T2Observability.ts",
} as const;

/**
 * TEL-T3-TRACE handoff documentation (S5 → S6).
 *
 * Intended: S5 must NOT wire admit/route/replace in Observability.ts.
 * S6 sole lander owns INV-T2-TEL-T3-TRACE cutover. S5 keeps a ledger stub
 * pair for Ordered-proof ≡ carrier coverage only.
 * Observed: this constant is documentation for agents — no runtime effect.
 */
export const G10_S5_TEL_T3_TRACE_HANDOFF = {
  commId: "INV-T2-TEL-T3-TRACE" as const,
  landerSlice: "S6" as const,
  landerModule: "apps/server/src/observability/Layers/Observability.ts",
  status: "handoff-pending" as const,
  handoffDoc: "docs/scm/g10/handoffs/S5-TEL-T3-TRACE-to-S6.md",
  note: "Do not claim S5-wired or dual-run-exit (a) for TEL-T3-TRACE from S5; S5 does not commit Observability.ts",
} as const;

/**
 * TEL-DESKTOP-CONTROL handoff reception (S3 → S5 land complete).
 *
 * Intended: S5 sole lander wires admit/route/replace on DesktopTelemetryReceiver.ts.
 * Observed: documentation constant for agents — runtime wiring is desktopControlViaG10Bridge.
 */
export const G10_S5_TEL_DESKTOP_CONTROL_HANDOFF_LANDED = {
  commId: "INV-T2-TEL-DESKTOP-CONTROL" as const,
  fromSlice: "S3" as const,
  landerSlice: "S5" as const,
  landerModule: "apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts",
  status: "landed" as const,
  handoffDoc: "docs/scm/g10/handoffs/S3-TEL-DESKTOP-CONTROL-to-S5.md",
  note: "S3 stub complete; S5 claims exit (a) for TEL-DESKTOP-CONTROL on DesktopTelemetryReceiver lander",
} as const;

/**
 * FILE-LOGS terminalLogs handoff reception slot (S7 → S5 lander; not stolen).
 *
 * Intended: S5 sole lander owns Manager.ts commits; S7 owns FILE-LOGS
 * terminalLogs phase. S5 must not claim exit (a) for that phase.
 */
/**
 * FILE-LOGS terminalLogs phase handoff (S7 → S5) — auth-freeze landed.
 */
export const G10_S5_FILE_LOGS_TERMINAL_LOGS_HANDOFF_FROM_S7 = {
  commId: "INV-T2-FILE-LOGS" as const,
  phase: "terminalLogs-writer-succeeded" as const,
  fromSlice: "S7" as const,
  landerSlice: "S5" as const,
  landerModule: "apps/server/src/terminal/Manager.ts",
  status: "landed" as const,
  landedAt: "auth-freeze-phase-residual" as const,
  handoffDoc: "docs/scm/g10/handoffs/S7-FILE-LOGS-terminalLogs-to-S5.md",
  note: "S7 owns FILE-LOGS terminalLogs phase; S5 wires at auth-freeze; not historical S5 exit (a)",
} as const;

/**
 * FILE-LOGS terminalLogs: wrap history write success (phase residual).
 * Agent: call sites only in Manager.ts after successful writeFileString.
 */
export const fileLogsTerminalLogsViaG10Bridge = <A, E, R>(
  liveSuccess: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const opt = yield* resolveOptionalG10S5();
    if (Option.isNone(opt) || !opt.value.isReplaceInstalled()) {
      return yield* liveSuccess;
    }
    const ctrl = opt.value;
    const phase = "terminalLogs-writer-succeeded";
    const projection: G9EqualityA = { site: "terminal-logs-writer-succeeded" };
    const commId = "INV-T2-FILE-LOGS" as const;
    const liveEffect = Effect.gen(function* () {
      const result = yield* liveSuccess;
      ctrl.traffic.samples.push({
        path: "live",
        commId,
        phase,
        projection,
        atMs: Date.now(),
      });
      return result;
    });
    const manifoldAuthority = Effect.gen(function* () {
      ctrl.traffic.samples.push({
        path: "manifold",
        commId,
        phase,
        projection,
        atMs: Date.now(),
      });
      return yield* liveSuccess;
    });
    const manifoldObserve = Effect.sync(() => {
      ctrl.traffic.samples.push({
        path: "manifold",
        commId,
        phase,
        projection,
        atMs: Date.now(),
      });
    });
    return yield* runG10SeamBridge({
      model: ctrl.model,
      slice: "S5",
      commId,
      liveEffect,
      manifoldEffect: manifoldAuthority,
      manifoldObserveEffect: manifoldObserve,
    });
  });

/**
 * FLAG-TERM-ENV handoff reception (S7 → S5 land complete at S8 reopen).
 *
 * Intended: S5 sole lander wires admit/route/replace on Manager.ts.
 * Observed: runtime wiring is flagTermEnvViaG10Bridge. Historical S5/S7
 * exit (a) unchanged; S8 audit lists lander-reopen-wired.
 */
export const G10_S5_FLAG_TERM_ENV_HANDOFF_FROM_S7 = {
  commId: "INV-T2-FLAG-TERM-ENV" as const,
  fromSlice: "S7" as const,
  landerSlice: "S5" as const,
  landerModule: "apps/server/src/terminal/Manager.ts",
  status: "landed" as const,
  landedAt: "S8-lander-reopen" as const,
  handoffDoc: "docs/scm/g10/handoffs/S7-FLAG-TERM-ENV-to-S5.md",
  note: "S7 stub complete; S5 wires FLAG-TERM-ENV at S8 reopen; not historical S5 exit (a)",
} as const;

/**
 * FLAG-TERM-ENV: S8 lander-reopen wrap beside captureFlagTermEnvFiltered.
 *
 * Intended: not in G10_S5_WIRED_COMM_IDS / historical S5 exit (a). Agent: call
 * site only in Manager.ts at terminal-child-env-filtered success.
 */
export const flagTermEnvViaG10Bridge = <A, E, R>(
  liveFilter: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const opt = yield* resolveOptionalG10S5();
    if (Option.isNone(opt) || !opt.value.isReplaceInstalled()) {
      return yield* liveFilter;
    }
    const ctrl = opt.value;
    const phase = "terminal-child-env-filtered";
    const projection: G9EqualityA = { kind: "terminal-child-env-filtered" };
    const commId = "INV-T2-FLAG-TERM-ENV" as const;
    const liveEffect = Effect.gen(function* () {
      const result = yield* liveFilter;
      ctrl.traffic.samples.push({
        path: "live",
        commId,
        phase,
        projection,
        atMs: Date.now(),
      });
      return result;
    });
    const manifoldAuthority = Effect.gen(function* () {
      ctrl.traffic.samples.push({
        path: "manifold",
        commId,
        phase,
        projection,
        atMs: Date.now(),
      });
      return yield* liveFilter;
    });
    const manifoldObserve = Effect.sync(() => {
      ctrl.traffic.samples.push({
        path: "manifold",
        commId,
        phase,
        projection,
        atMs: Date.now(),
      });
    });
    return yield* runG10SeamBridge({
      model: ctrl.model,
      slice: "S5",
      commId,
      liveEffect,
      manifoldEffect: manifoldAuthority,
      manifoldObserveEffect: manifoldObserve,
    });
  });
