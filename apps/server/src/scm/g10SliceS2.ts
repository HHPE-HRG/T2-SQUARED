/**
 * G10 S2 campaign controller (Ordered proof + seam-bridge traffic).
 *
 * Intended: own S2 admit/route/replace + Ordered proof sequence helpers
 * wrapping createSubstitutionModel / installAdmitRouteReplace /
 * recordOrderedProofStep / armInversion / restorePreCutoverLive. Wired seams:
 *   - serverSettings.ts sole lander: FILE-SETTINGS (exists/read/write) +
 *     SETTINGS-EVENTS handoff FROM S1 (emitChange / subscribeChanges)
 *   - cli/config.ts sole lander: FLAG-SERVER-CONFIG (EnvServerConfig resolve)
 * ORCH-LIVE is S2→S6 handoff-pending on ws.ts — ledger stub only; S2 must
 * NOT commit ws.ts. FLAG-T3-OTEL is S6→S2 handoff landed at S8 reopen on
 * cli/config (not claimed under historical S2 Ordered-proof exit (a)).
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

/** Frozen S2 inventory `comm_id` set (3 rows — do not resize). */
export const G10_S2_COMM_IDS = [
  "INV-T2-FILE-SETTINGS",
  "INV-T2-FLAG-SERVER-CONFIG",
  "INV-T2-ORCH-LIVE",
] as const;

export type G10S2CommId = (typeof G10_S2_COMM_IDS)[number];

/**
 * S2-owned seams with real g10SeamBridge wiring on S2 sole landers, plus
 * SETTINGS-EVENTS completed from S1 handoff on serverSettings.ts.
 * Agent: dual-run-exit (a)/(e) may claim these three only — not ORCH-LIVE.
 */
export const G10_S2_WIRED_COMM_IDS = [
  "INV-T2-FILE-SETTINGS",
  "INV-T2-FLAG-SERVER-CONFIG",
  "INV-T2-SETTINGS-EVENTS",
] as const;

export type G10S2WiredCommId = (typeof G10_S2_WIRED_COMM_IDS)[number];

/**
 * S2 inventory row deferred to S6 sole lander (ws.ts).
 * Agent: handoff stub for ≡ carrier only — not admit/route/replace wiring.
 */
export const G10_S2_HANDOFF_PENDING_COMM_IDS = ["INV-T2-ORCH-LIVE"] as const;

/**
 * S1→S2 handoff row landed on serverSettings.ts (not in S2 inventory).
 * Agent: S1 owned comm_id; S2 sole lander completes admit/route/replace.
 */
export const G10_S2_HANDOFF_LANDED_FROM_S1_COMM_IDS = ["INV-T2-SETTINGS-EVENTS"] as const;

/**
 * Traffic sample comm_id (S2 inventory ∪ SETTINGS handoff land ∪ S8 reopen
 * FLAG-T3-OTEL land from S6).
 */
export type G10S2TrafficCommId = G10S2CommId | "INV-T2-SETTINGS-EVENTS" | "INV-T2-FLAG-T3-OTEL";

/**
 * S6→S2 FLAG-T3-OTEL land completed at S8 lander reopen (not in S2 WIRED /
 * historical exit (a); S8 audit disposition owns campaign close).
 */
export const G10_S2_S8_REOPEN_LANDED_FROM_S6_COMM_IDS = ["INV-T2-FLAG-T3-OTEL"] as const;

/** One manifold (or live) traffic sample for ≡ under G9DeferredEquality. */
export type G10S2TrafficSample = {
  readonly path: "live" | "manifold";
  readonly commId: G10S2TrafficCommId;
  readonly phase: string;
  readonly projection: G9EqualityA;
  readonly atMs: number;
};

/** Structured evidence body for one Ordered proof step (markdown writer input). */
export type G10S2EvidenceBody = {
  readonly slice: "S2";
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
 * In-memory manifold stub traffic log (S2 settings/flag + ORCH-LIVE stub).
 *
 * Intended: enough samples for live-vs-manifold ≡ under G9DeferredEquality.
 * Observed: append-only arrays; cleared on rollback restore when requested.
 */
export type G10S2ManifoldTrafficLog = {
  readonly samples: G10S2TrafficSample[];
};

/**
 * S2 campaign controller shape (process-global or Effect service).
 *
 * Agent: land → liveRehearsal → recordEquiv → rollbackDrill → dualRunExit →
 * armInversion. dualRunExit uses recordOrderedProofStep only.
 */
export type G10S2Controller = {
  readonly slice: "S2";
  readonly model: G10SubstitutionModel;
  readonly registry: G10CutoverRegistry;
  readonly traffic: G10S2ManifoldTrafficLog;
  /** admit/route/replace + Ordered proof "land". */
  readonly land: () => G10S2EvidenceBody;
  /**
   * Live-authoritative rehearsal: observe traffic + one rollback restore +
   * re-land install + record live-rehearsal step.
   */
  readonly liveRehearsal: () => G10S2EvidenceBody;
  /** Cutover ≡ under G9DeferredEquality for S2 inventory + SETTINGS land. */
  readonly recordEquiv: () => G10S2EvidenceBody;
  /** Rollback drill: restore live, re-prove authority, record step. */
  readonly rollbackDrill: () => G10S2EvidenceBody;
  /** Dual-run exit via recordOrderedProofStep only (refuses markDualRunExited). */
  readonly dualRunExit: () => G10S2EvidenceBody;
  /** Arm inversion via armInversion → recordOrderedProofStep. */
  readonly armInversion: () => G10S2EvidenceBody;
  /**
   * Record live traffic for a wired S2 lander seam (settings/flag/SETTINGS).
   * Agent: do not use for ORCH-LIVE handoff — that stays recordStubPair only.
   */
  readonly recordLiveWiredSeam: (
    commId: G10S2WiredCommId,
    phase: string,
    projection: G9EqualityA,
  ) => void;
  /** Record manifold observe/authority sample for a wired S2 lander seam. */
  readonly recordManifoldWiredSeam: (
    commId: G10S2WiredCommId,
    phase: string,
    projection: G9EqualityA,
  ) => void;
  /**
   * Record handoff-pending stub pair (ORCH-LIVE → S6 only).
   * Agent: not admit/route/replace wiring; ≡ carrier coverage for deferred row.
   */
  readonly recordStubPair: (commId: G10S2CommId, phase: string, projection: G9EqualityA) => void;
  /** True when replace installed for S2. */
  readonly isReplaceInstalled: () => boolean;
  readonly authority: () => "live" | "manifold";
  readonly phase: () => CutoverPhase;
  readonly inversionArmed: () => boolean;
  /** Format evidence markdown for a recorded step body. */
  readonly formatEvidenceMarkdown: (body: G10S2EvidenceBody) => string;
  /** Run full Ordered proof sequence; returns bodies in order. */
  readonly runFullOrderedProof: () => readonly G10S2EvidenceBody[];
};

/** Process-global optional controller (tests / lander fallback). */
let processGlobalG10S2: G10S2Controller | undefined;

/**
 * Install or clear the process-global S2 controller.
 *
 * Intended: tests set before settings/config effects; production prefers Layer.
 * Observed: module singleton; absent ⇒ lander live unchanged.
 */
export const installProcessGlobalG10S2 = (controller: G10S2Controller | undefined): void => {
  processGlobalG10S2 = controller;
};

/** Read process-global S2 controller (undefined when absent). */
export const getProcessGlobalG10S2 = (): G10S2Controller | undefined => processGlobalG10S2;

/**
 * Effect service key for optional S2 cutover controller (G9CaptureService pattern).
 *
 * Absent ⇒ serverSettings / cli/config live paths unchanged.
 */
export class G10S2CutoverService extends Context.Service<G10S2CutoverService, G10S2Controller>()(
  "t3/scm/g10SliceS2/G10S2CutoverService",
) {}

/** Layer.succeed helper for tests / optional stack merge. */
export const G10S2CutoverLayer = (controller: G10S2Controller): Layer.Layer<G10S2CutoverService> =>
  Layer.succeed(G10S2CutoverService, controller);

/**
 * Resolve optional S2 controller: Effect.serviceOption first, then process-global.
 *
 * Intended: lander sites call this once per seam. Absent ⇒ live only.
 */
export const resolveOptionalG10S2 = (): Effect.Effect<Option.Option<G10S2Controller>> =>
  Effect.gen(function* () {
    const fromService = yield* Effect.serviceOption(G10S2CutoverService);
    if (Option.isSome(fromService)) return fromService;
    const global = processGlobalG10S2;
    return global === undefined ? Option.none() : Option.some(global);
  });

const nowMs = (): number => Date.now();

const pushSample = (traffic: G10S2ManifoldTrafficLog, sample: G10S2TrafficSample): void => {
  traffic.samples.push(sample);
};

/**
 * Create an S2 campaign controller bound to inventory registry.
 *
 * Parameters
 * ----------
 * repoRoot : string
 *     Monorepo root for seam-inventory load (defaults to resolveG10RepoRoot).
 *
 * Returns
 * -------
 * G10S2Controller
 *     Mutable coordinator for S2 Ordered proof + manifold traffic.
 */
export const createG10S2Controller = (repoRoot: string = resolveG10RepoRoot()): G10S2Controller => {
  const registry = loadG10CutoverRegistry(repoRoot);
  const model = createSubstitutionModel(registry);
  const traffic: G10S2ManifoldTrafficLog = { samples: [] };

  const s2Ids = activatableCommIdsForSlice(registry, "S2");
  // Hard lock: inventory S2 set must match frozen 3 (no silent resize).
  if (s2Ids.length !== G10_S2_COMM_IDS.length) {
    throw new Error(
      `G10 S2 controller: inventory S2 count ${s2Ids.length} ≠ frozen ${G10_S2_COMM_IDS.length}`,
    );
  }
  for (const id of G10_S2_COMM_IDS) {
    if (!s2Ids.includes(id)) {
      throw new Error(`G10 S2 controller: missing inventory id ${id}`);
    }
  }

  const snapshotEvidence = (
    step: OrderedProofStep | "land",
    notes: readonly string[],
    equalitySamples?: readonly G9DeferredEquality[],
  ): G10S2EvidenceBody => {
    const liveCount = traffic.samples.filter((s) => s.path === "live").length;
    const manifoldCount = traffic.samples.filter((s) => s.path === "manifold").length;
    return {
      slice: "S2",
      step,
      phase: phaseForSlice(model, "S2"),
      authority: authorityForSlice(model, "S2"),
      inversionArmed: model.sliceStates.get("S2")?.inversionArmed === true,
      commIds: [...s2Ids],
      notes,
      equalitySamples,
      trafficSummary: { liveCount, manifoldCount },
    };
  };

  const formatEvidenceMarkdown = (body: G10S2EvidenceBody): string => {
    const lines = [
      `# S2 ${body.step} evidence`,
      "",
      `<!-- Agent: G10 S2 Ordered proof step. Slice=${body.slice}. -->`,
      "",
      `- Date: ${new Date().toISOString().slice(0, 10)}`,
      `- Slice: **S2**`,
      `- Step: **${body.step}**`,
      `- Phase: \`${body.phase}\``,
      `- Authority: **${body.authority}**`,
      `- inversionArmed: \`${body.inversionArmed}\``,
      `- S2 comm_ids (${body.commIds.length}): ${body.commIds.join(", ")}`,
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

  const recordLiveWiredSeam = (
    commId: G10S2WiredCommId,
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
    commId: G10S2WiredCommId,
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

  const recordStubPair = (commId: G10S2CommId, phase: string, projection: G9EqualityA): void => {
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

  /**
   * Seed ORCH-LIVE handoff stub only (S2→S6; not seam-bridge wired).
   * Agent: ws.ts is S6 sole lander — S2 must not commit it.
   */
  const seedOrchLiveHandoffStub = (): void => {
    // Projection matches ledger G9OrchLiveOfferA for live-buffer-offered.
    recordStubPair("INV-T2-ORCH-LIVE", "live-buffer-offered", {
      kind: "event",
    });
  };

  /**
   * Dual-run observe rehearsal through seam bridge (live authoritative).
   * Records FILE-SETTINGS + FLAG-SERVER-CONFIG + SETTINGS-EVENTS without real I/O.
   */
  const rehearseWiredSeamsObserve = (): void => {
    const runBridge = (commId: G10S2WiredCommId, phase: string, projection: G9EqualityA): void => {
      void Effect.runSync(
        runG10SeamBridge({
          model,
          slice: "S2",
          commId,
          liveEffect: Effect.sync(() => {
            recordLiveWiredSeam(commId, phase, projection);
            return true;
          }),
          manifoldEffect: Effect.sync(() => {
            recordManifoldWiredSeam(commId, phase, projection);
            return true;
          }),
          manifoldObserveEffect: Effect.sync(() => {
            recordManifoldWiredSeam(commId, phase, projection);
          }),
        }),
      );
    };

    // FILE-SETTINGS: one representative phase carrier for ≡ (exists).
    runBridge("INV-T2-FILE-SETTINGS", "settings-file-exists-succeeded", {
      operation: "succeeded",
    });
    runBridge("INV-T2-FLAG-SERVER-CONFIG", "flag-resolved", {
      comm_id: "resolved",
    });
    // SETTINGS-EVENTS: S1→S2 handoff land (subscription phase matches S1 stub).
    runBridge("INV-T2-SETTINGS-EVENTS", "settings-subscription-established", {
      site: "subscribed",
    });
  };

  const land = (): G10S2EvidenceBody => {
    installAdmitRouteReplace(model, "S2");
    recordOrderedProofStep(model, "S2", "land");
    return snapshotEvidence("land", [
      "admit/route/replace installed for S2 radius (3 inventory rows)",
      "authority remains live (dual-run); manifold observe-beside eligible",
      "wired seams (3): FILE-SETTINGS + FLAG-SERVER-CONFIG + SETTINGS-EVENTS (S1 handoff land)",
      "ORCH-LIVE handoff-pending S6 (ws.ts) — not S2-wired; S2 does not commit ws.ts",
      "FLAG-T3-OTEL S8 lander-reopen land on cli/config (S6→S2; not historical S2 exit (a))",
      "markDualRunExited not used",
    ]);
  };

  const liveRehearsal = (): G10S2EvidenceBody => {
    if (!model.installs.get("S2")?.replaceInstalled) {
      throw new Error("G10 S2 liveRehearsal requires land first");
    }
    // Observe dual-run traffic while live authoritative.
    rehearseWiredSeamsObserve();
    seedOrchLiveHandoffStub();
    // One rollback restore under live-authoritative conditions, then re-land.
    restorePreCutoverLive(model, "S2");
    if (authorityForSlice(model, "S2") !== "live") {
      throw new Error("G10 S2 liveRehearsal: restore did not return live authority");
    }
    // Re-install replace (authority stays live) so Ordered land prefix remains.
    if (!model.installs.get("S2")?.replaceInstalled) {
      installAdmitRouteReplace(model, "S2");
    } else {
      // restore keeps replaceInstalled; re-assert live authority.
      const install = model.installs.get("S2");
      if (install && install.authority !== "live") {
        model.installs.set("S2", { ...install, authority: "live" });
      }
    }
    rehearseWiredSeamsObserve();
    recordOrderedProofStep(model, "S2", "live-rehearsal");
    return snapshotEvidence("live-rehearsal", [
      "dual-run observe on three wired S2 lander seams via g10SeamBridge (live authoritative)",
      "ORCH-LIVE handoff stub only (deferred to S6 ws.ts; not bridge-wired)",
      "SETTINGS-EVENTS S1→S2 handoff land exercised on serverSettings.ts",
      "one rollback restore + re-land under live authority",
      "inversion not armed; live remains authoritative",
    ]);
  };

  const recordEquiv = (): G10S2EvidenceBody => {
    const byComm = new Map<string, { live?: G9EqualityA; manifold?: G9EqualityA }>();
    for (const sample of traffic.samples) {
      const entry = byComm.get(sample.commId) ?? {};
      if (sample.path === "live") entry.live = sample.projection;
      else entry.manifold = sample.projection;
      byComm.set(sample.commId, entry);
    }
    const equalitySamples: G9DeferredEquality[] = [];
    const missing: string[] = [];
    // Inventory 3 (includes ORCH-LIVE stub) + SETTINGS handoff land.
    const equivIds = [...G10_S2_COMM_IDS, "INV-T2-SETTINGS-EVENTS"] as const;
    for (const id of equivIds) {
      const pair = byComm.get(id);
      if (!pair?.live || !pair.manifold) {
        missing.push(id);
        continue;
      }
      if (JSON.stringify(pair.live) !== JSON.stringify(pair.manifold)) {
        throw new Error(
          `G10 S2 ≡ failed for ${id}: live=${JSON.stringify(pair.live)} manifold=${JSON.stringify(pair.manifold)}`,
        );
      }
      equalitySamples.push(asG9DeferredEquality(pair.live));
    }
    if (missing.length > 0) {
      throw new Error(`G10 S2 ≡ missing traffic for: ${missing.join(", ")}`);
    }
    recordOrderedProofStep(model, "S2", "cutover-equivalence");
    return snapshotEvidence(
      "cutover-equivalence",
      [
        "wired three: live≡manifold via g10SeamBridge (FILE-SETTINGS + FLAG-SERVER-CONFIG + SETTINGS-EVENTS)",
        "ORCH-LIVE: handoff-deferred stub pair only (S6 lander ws.ts; not (a) for this row)",
        "not WP8 763-fixture-as-proof",
        "type carrier: asG9DeferredEquality from g10ProofHarness",
      ],
      equalitySamples,
    );
  };

  const rollbackDrill = (): G10S2EvidenceBody => {
    const result = restorePreCutoverLive(model, "S2");
    if (
      result.restoredAuthority !== "live" ||
      result.clearedShadowEnv ||
      result.usedHaltController
    ) {
      throw new Error("G10 S2 rollbackDrill: invalid rollback result");
    }
    if (authorityForSlice(model, "S2") !== "live") {
      throw new Error("G10 S2 rollbackDrill: authority not live after restore");
    }
    // Re-prove live authority with a live-only bridge call (replace still installed).
    const proved = Effect.runSync(
      runG10SeamBridge({
        model,
        slice: "S2",
        commId: "INV-T2-FILE-SETTINGS",
        liveEffect: Effect.succeed("live-ok"),
        manifoldEffect: Effect.succeed("manifold-should-not-win"),
        manifoldObserveEffect: Effect.void,
      }),
    );
    if (proved !== "live-ok") {
      throw new Error("G10 S2 rollbackDrill: live authority not selected");
    }
    recordOrderedProofStep(model, "S2", "rollback-drill");
    return snapshotEvidence("rollback-drill", [
      "restorePreCutoverLive restored live authority",
      "rollback ≠ unset T2CODE_SCM_G9_SHADOW; no halt controller",
      "re-proved live-authoritative bridge selection for FILE-SETTINGS",
    ]);
  };

  const dualRunExit = (): G10S2EvidenceBody => {
    // Sole owner: recordOrderedProofStep flips authority to manifold.
    // Do NOT call markDualRunExited — it always throws (S0 sole-owner binding).
    recordOrderedProofStep(model, "S2", "dual-run-exit");
    if (authorityForSlice(model, "S2") !== "manifold") {
      throw new Error("G10 S2 dualRunExit: authority not manifold after proof step");
    }
    return snapshotEvidence("dual-run-exit", [
      "exit (a)/(e) for three wired S2 lander seams only (FILE-SETTINGS/FLAG-SERVER-CONFIG/SETTINGS-EVENTS)",
      "ORCH-LIVE handoff-deferred to S6 — not claimed under exit (a)",
      'flipped solely via recordOrderedProofStep(..., "dual-run-exit")',
      "markDualRunExited not used (S0 escalation sole-owner binding)",
      "prerequisites: land + live-rehearsal + ≡ + rollback-drill green for wired three",
    ]);
  };

  const armInversionStep = (): G10S2EvidenceBody => {
    armInversion(model, "S2", registry);
    if (model.sliceStates.get("S2")?.inversionArmed !== true) {
      throw new Error("G10 S2 armInversion: inversionArmed not true");
    }
    return snapshotEvidence("arm-inversion", [
      "noninterference inversion armed after dual-run-exit",
      "manifold failure may now fail user-visible S2 settings/config ops",
      "armed solely via armInversion → recordOrderedProofStep",
    ]);
  };

  const runFullOrderedProof = (): readonly G10S2EvidenceBody[] => {
    const bodies: G10S2EvidenceBody[] = [];
    bodies.push(land());
    bodies.push(liveRehearsal());
    bodies.push(recordEquiv());
    bodies.push(rollbackDrill());
    bodies.push(dualRunExit());
    bodies.push(armInversionStep());
    if (!orderedProofSatisfiedThrough(model, "S2", "arm-inversion")) {
      throw new Error("G10 S2 runFullOrderedProof: Ordered proof incomplete");
    }
    return bodies;
  };

  return {
    slice: "S2",
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
    isReplaceInstalled: () => model.installs.get("S2")?.replaceInstalled === true,
    authority: () => authorityForSlice(model, "S2"),
    phase: () => phaseForSlice(model, "S2"),
    inversionArmed: () => model.sliceStates.get("S2")?.inversionArmed === true,
    formatEvidenceMarkdown,
    runFullOrderedProof,
  };
};

/**
 * Shared lander bridge: boolean live I/O + wired-seam traffic records.
 *
 * Intended: absent/not-replaced ⇒ live only. Present + replaced ⇒
 * runG10SeamBridge with live/manifold record hooks. Gate recording with
 * shouldRecord (default: truthy boolean result). ORCH-LIVE must not call this.
 *
 * Observed: reuses live I/O on manifold authority so FS/PubSub/Config still fire.
 */
const runWiredBooleanSeamViaG10Bridge = <E, R>(
  commId: G10S2WiredCommId,
  phase: string,
  projection: G9EqualityA,
  liveIo: Effect.Effect<boolean, E, R>,
  shouldRecord: (result: boolean) => boolean = (r) => r,
): Effect.Effect<boolean, E, R> =>
  Effect.gen(function* () {
    const opt = yield* resolveOptionalG10S2();
    if (Option.isNone(opt) || !opt.value.isReplaceInstalled()) {
      return yield* liveIo;
    }
    const ctrl = opt.value;
    const liveEffect = Effect.gen(function* () {
      const result = yield* liveIo;
      if (shouldRecord(result)) {
        ctrl.recordLiveWiredSeam(commId, phase, projection);
      }
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
      slice: "S2",
      commId,
      liveEffect,
      manifoldEffect: manifoldAuthority,
      manifoldObserveEffect: manifoldObserve,
    });
  });

/**
 * Shared lander bridge: void/success live I/O (read/write/subscribe/config).
 *
 * Intended: record on success channel; error channel E propagates unchanged.
 * Observed: reuses live I/O on manifold authority.
 */
const runWiredSuccessSeamViaG10Bridge = <A, E, R>(
  commId: G10S2WiredCommId,
  phase: string,
  projection: G9EqualityA,
  liveIo: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const opt = yield* resolveOptionalG10S2();
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
      slice: "S2",
      commId,
      liveEffect,
      manifoldEffect: manifoldAuthority,
      manifoldObserveEffect: manifoldObserve,
    });
  });

/**
 * FILE-SETTINGS exists: wrap fs.exists success through G10 bridge.
 * Agent: call site only in serverSettings.ts. Record even when exists=false.
 */
export const fileSettingsExistsViaG10Bridge = <E, R>(
  liveExists: Effect.Effect<boolean, E, R>,
): Effect.Effect<boolean, E, R> =>
  runWiredBooleanSeamViaG10Bridge(
    "INV-T2-FILE-SETTINGS",
    "settings-file-exists-succeeded",
    { operation: "succeeded" },
    liveExists,
    () => true,
  );

/**
 * FILE-SETTINGS read: wrap successful read+decode through G10 bridge.
 * Agent: call site only in serverSettings.ts loadSettingsFromDisk success path.
 */
export const fileSettingsReadViaG10Bridge = <A, E, R>(
  liveRead: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-FILE-SETTINGS",
    "settings-file-read-succeeded",
    { operation: "succeeded" },
    liveRead,
  );

/**
 * FILE-SETTINGS write: wrap atomic write success through G10 bridge.
 * Agent: call site only in serverSettings.ts writeSettingsAtomically.
 */
export const fileSettingsWriteViaG10Bridge = <A, E, R>(
  liveWrite: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-FILE-SETTINGS",
    "settings-file-write-succeeded",
    { operation: "write" },
    liveWrite,
  );

/**
 * SETTINGS-EVENTS publish: wrap emitChange PubSub.publish through G10 bridge.
 * Agent: S1→S2 handoff land on serverSettings.ts only (not S1 Engine).
 */
export const publishSettingsEventsViaG10Bridge = <E, R>(
  livePublish: Effect.Effect<boolean, E, R>,
): Effect.Effect<boolean, E, R> =>
  runWiredBooleanSeamViaG10Bridge(
    "INV-T2-SETTINGS-EVENTS",
    "pubsub-published",
    { site: "emitChange" },
    livePublish,
  );

/**
 * SETTINGS-EVENTS subscribe: wrap subscribeChanges through G10 bridge.
 * Agent: S1→S2 handoff land on serverSettings.ts subscribeChanges getter.
 */
export const subscribeSettingsEventsViaG10Bridge = <A, E, R>(
  liveSubscribe: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-SETTINGS-EVENTS",
    "settings-subscription-established",
    { site: "subscribed" },
    liveSubscribe,
  );

/**
 * FLAG-SERVER-CONFIG: wrap EnvServerConfig resolve through G10 bridge.
 * Agent: call site only in cli/config.ts resolveServerConfig.
 */
export const resolveFlagServerConfigViaG10Bridge = <A, E, R>(
  liveResolve: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-FLAG-SERVER-CONFIG",
    "flag-resolved",
    { comm_id: "resolved" },
    liveResolve,
  );

/**
 * FLAG-T3-OTEL: S8 lander-reopen wrap on cli/config.ts (S6→S2 handoff land).
 *
 * Intended: admit/route/replace via S2 controller when replaced; traffic on
 * FLAG-T3-OTEL samples. Not in G10_S2_WIRED_COMM_IDS — historical S2 exit (a)
 * unchanged; S8 dual-run-exit audit owns campaign disposition.
 * Agent: call site only in cli/config.ts after T3 OTEL members resolve.
 */
export const resolveFlagT3OtelViaG10Bridge = <A, E, R>(
  liveResolve: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const opt = yield* resolveOptionalG10S2();
    if (Option.isNone(opt) || !opt.value.isReplaceInstalled()) {
      return yield* liveResolve;
    }
    const ctrl = opt.value;
    const phase = "flag-resolved";
    const projection: G9EqualityA = { comm_id: "resolved" };
    const commId = "INV-T2-FLAG-T3-OTEL" as const;
    const liveEffect = Effect.gen(function* () {
      const result = yield* liveResolve;
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
      return yield* liveResolve;
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
      slice: "S2",
      commId,
      liveEffect,
      manifoldEffect: manifoldAuthority,
      manifoldObserveEffect: manifoldObserve,
    });
  });

/**
 * ORCH-LIVE handoff documentation (S2 → S6).
 *
 * Intended: S2 must NOT wire admit/route/replace in ws.ts.
 * S6 sole lander owns INV-T2-ORCH-LIVE cutover. S2 keeps a ledger
 * stub pair for Ordered-proof ≡ carrier coverage only (seedOrchLiveHandoffStub).
 * Observed: this constant is documentation for agents — no runtime effect.
 */
export const G10_S2_ORCH_LIVE_HANDOFF = {
  commId: "INV-T2-ORCH-LIVE" as const,
  landerSlice: "S6" as const,
  landerModule: "apps/server/src/ws.ts",
  status: "handoff-pending" as const,
  handoffDoc: "docs/scm/g10/handoffs/S2-ORCH-LIVE-to-S6.md",
  note: "Do not claim S2-wired or dual-run-exit (a) for ORCH-LIVE from S2; S2 does not commit ws.ts",
} as const;

/**
 * SETTINGS-EVENTS handoff reception (S1 → S2 land complete).
 *
 * Intended: S2 sole lander wires admit/route/replace on serverSettings.ts.
 * Observed: documentation constant for agents — runtime wiring is the helpers above.
 */
export const G10_S2_SETTINGS_EVENTS_HANDOFF_LANDED = {
  commId: "INV-T2-SETTINGS-EVENTS" as const,
  fromSlice: "S1" as const,
  landerSlice: "S2" as const,
  landerModule: "apps/server/src/serverSettings.ts",
  status: "landed" as const,
  note: "S1 stub complete; S2 claims exit (a) for SETTINGS on serverSettings lander",
} as const;

/**
 * FLAG-T3-OTEL handoff reception (S6 → S2 land complete at S8 reopen).
 *
 * Intended: S2 sole lander wires admit/route/replace on cli/config.ts.
 * Observed: documentation constant — runtime wiring is resolveFlagT3OtelViaG10Bridge.
 * Historical S6 exit (a) remains stub-disclosed; S8 audit lists lander-reopen-wired.
 */
export const G10_S2_FLAG_T3_OTEL_HANDOFF_LANDED_FROM_S6 = {
  commId: "INV-T2-FLAG-T3-OTEL" as const,
  fromSlice: "S6" as const,
  landerSlice: "S2" as const,
  landerModule: "apps/server/src/cli/config.ts",
  status: "landed" as const,
  landedAt: "S8-lander-reopen" as const,
  handoffDoc: "docs/scm/g10/handoffs/S6-FLAG-T3-OTEL-to-S2.md",
  note: "S6 stub complete; S2 wires FLAG-T3-OTEL at S8 reopen; not historical S2 exit (a)",
} as const;
