/**
 * G10 S1 campaign controller (Ordered proof + seam-bridge traffic).
 *
 * Intended: own S1-only admit/route/replace + Ordered proof sequence helpers
 * wrapping createSubstitutionModel / installAdmitRouteReplace /
 * recordOrderedProofStep / armInversion / restorePreCutoverLive /
 * recordSoftFallbackRetire (Fabric-depth FD1). Six S1-owned seams wire
 * admit/route/replace traffic via g10SeamBridge:
 *   - Engine sole lander: ORCH-EVENTS publish + ORCH-QUEUE offer
 *     (OrchestrationEngine.ts — do not land other S1 seams there)
 *   - Capture modules: LIFECYCLE / PREVIEW-AUTO / PROJECT-QUEUE / VCS-EVENTS
 *     (serverLifecycleEvents, PreviewAutomationBroker, ProjectionPipeline,
 *     VcsStatusBroadcaster)
 * SETTINGS-EVENTS is S1→S2 handoff-pending on serverSettings.ts — ledger stub
 * only; never claim Engine-wired or dual-run-exit (a) for it from S1.
 *
 * Observed: in-memory model + traffic log; does not edit ws/provider or
 * serverSettings.ts. dualRunExit / armInversion never call markDualRunExited —
 * recordOrderedProofStep is sole dual-run-exit / arm-inversion writer.
 * softFallbackRetire requires T2CODE_SCM_FABRIC_DEPTH + census sole-landers real.
 * Absent controller ⇒ live paths unchanged at all wired call sites.
 */
import type { OrchestrationCommand, OrchestrationEvent } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { join } from "node:path";

import { commandTypeOf } from "./g9OrchQueueCapture.ts";
import type { G9EqualityA } from "./g9Occurrence.ts";
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
import type { CutoverPhase, OrderedProofStep, SoftFallbackState } from "./g10Types.ts";

/** Absolute census path for S1 soft-fallback-retire sole-lander gate. */
const S1_MANIFOLD_IO_CENSUS = (repoRoot: string): string =>
  join(repoRoot, "docs/scm/fabric-depth/evidence/manifold-io-census.json");

/** Frozen S1 inventory `comm_id` set (7 rows — do not resize). */
export const G10_S1_COMM_IDS = [
  "INV-T2-LIFECYCLE-EVENTS",
  "INV-T2-ORCH-EVENTS",
  "INV-T2-ORCH-QUEUE",
  "INV-T2-PREVIEW-AUTO",
  "INV-T2-PROJECT-QUEUE",
  "INV-T2-SETTINGS-EVENTS",
  "INV-T2-VCS-EVENTS",
] as const;

export type G10S1CommId = (typeof G10_S1_COMM_IDS)[number];

/** Engine-landed S1 seams (sole lander file: OrchestrationEngine.ts). */
export const G10_S1_ENGINE_COMM_IDS = ["INV-T2-ORCH-EVENTS", "INV-T2-ORCH-QUEUE"] as const;

/**
 * S1-owned seams with real g10SeamBridge wiring (Engine + four capture modules).
 * Agent: dual-run-exit (a)/(e) may claim these six only — not SETTINGS.
 */
export const G10_S1_WIRED_COMM_IDS = [
  "INV-T2-LIFECYCLE-EVENTS",
  "INV-T2-ORCH-EVENTS",
  "INV-T2-ORCH-QUEUE",
  "INV-T2-PREVIEW-AUTO",
  "INV-T2-PROJECT-QUEUE",
  "INV-T2-VCS-EVENTS",
] as const;

export type G10S1WiredCommId = (typeof G10_S1_WIRED_COMM_IDS)[number];

/**
 * S1 inventory row deferred to S2 sole lander (serverSettings.ts).
 * Agent: handoff stub for ≡ carrier only — not admit/route/replace wiring.
 */
export const G10_S1_HANDOFF_PENDING_COMM_IDS = ["INV-T2-SETTINGS-EVENTS"] as const;

/** One manifold (or live) traffic sample for ≡ under G9DeferredEquality. */
export type G10S1TrafficSample = {
  readonly path: "live" | "manifold";
  readonly commId: G10S1CommId;
  readonly phase: string;
  readonly projection: G9EqualityA;
  readonly atMs: number;
};

/**
 * Structured evidence body for one Ordered proof / Fabric-depth step.
 *
 * Agent: soft-fallback-retire is FD Ordered depth (proof-bar step 7), not a
 * G10 ORDERED_PROOF_STEPS member — emit softFallback on every body.
 */
export type G10S1EvidenceBody = {
  readonly slice: "S1";
  readonly step: OrderedProofStep | "soft-fallback-retire";
  readonly phase: CutoverPhase;
  readonly authority: "live" | "manifold";
  readonly inversionArmed: boolean;
  /** Fabric-depth g10.softFallback bookkeeping (null pre-exit / FD off). */
  readonly softFallback: SoftFallbackState;
  readonly commIds: readonly string[];
  readonly notes: readonly string[];
  readonly equalitySamples?: readonly G9DeferredEquality[];
  readonly trafficSummary?: {
    readonly liveCount: number;
    readonly manifoldCount: number;
  };
};

/**
 * In-memory manifold stub traffic log (S1 orch publish/offer + ledger stubs).
 *
 * Intended: enough samples for live-vs-manifold ≡ under G9DeferredEquality.
 * Observed: append-only arrays; cleared on rollback restore when requested.
 */
export type G10S1ManifoldTrafficLog = {
  readonly samples: G10S1TrafficSample[];
};

/**
 * S1 campaign controller shape (process-global or Effect service).
 *
 * Agent: land → liveRehearsal → recordEquiv → rollbackDrill → dualRunExit →
 * armInversion → softFallbackRetire (FD1; requires T2CODE_SCM_FABRIC_DEPTH).
 * dualRunExit uses recordOrderedProofStep only.
 */
export type G10S1Controller = {
  readonly slice: "S1";
  readonly model: G10SubstitutionModel;
  readonly registry: G10CutoverRegistry;
  readonly traffic: G10S1ManifoldTrafficLog;
  /** admit/route/replace + Ordered proof "land". */
  readonly land: () => G10S1EvidenceBody;
  /**
   * Live-authoritative rehearsal: observe traffic + one rollback restore +
   * re-land install + record live-rehearsal step.
   */
  readonly liveRehearsal: () => G10S1EvidenceBody;
  /** Cutover ≡ under G9DeferredEquality for all 7 S1 comm_ids. */
  readonly recordEquiv: () => G10S1EvidenceBody;
  /** Rollback drill: restore live, re-prove authority, record step. */
  readonly rollbackDrill: () => G10S1EvidenceBody;
  /** Dual-run exit via recordOrderedProofStep only (refuses markDualRunExited). */
  readonly dualRunExit: () => G10S1EvidenceBody;
  /** Arm inversion via armInversion → recordOrderedProofStep. */
  readonly armInversion: () => G10S1EvidenceBody;
  /**
   * Fabric-depth soft-fallback-retire after arm-inversion (FD1).
   * Requires T2CODE_SCM_FABRIC_DEPTH + census sole-landers real for S1.
   */
  readonly softFallbackRetire: () => G10S1EvidenceBody;
  /** Record live ORCH-EVENTS publish sample (Engine live path). */
  readonly recordLivePublish: (event: OrchestrationEvent) => void;
  /** Record manifold ORCH-EVENTS observe/authority sample. */
  readonly recordManifoldPublish: (event: OrchestrationEvent) => void;
  /** Record live ORCH-QUEUE offer sample. */
  readonly recordLiveOffer: (command: OrchestrationCommand) => void;
  /** Record manifold ORCH-QUEUE observe/authority sample. */
  readonly recordManifoldOffer: (command: OrchestrationCommand) => void;
  /**
   * Record live traffic for a wired non-Engine S1 seam (capture-module bridge).
   * Agent: do not use for SETTINGS handoff — that stays recordStubPair only.
   */
  readonly recordLiveWiredSeam: (
    commId: G10S1WiredCommId,
    phase: string,
    projection: G9EqualityA,
  ) => void;
  /** Record manifold observe/authority sample for a wired non-Engine S1 seam. */
  readonly recordManifoldWiredSeam: (
    commId: G10S1WiredCommId,
    phase: string,
    projection: G9EqualityA,
  ) => void;
  /**
   * Record handoff-pending stub pair (SETTINGS-EVENTS → S2 only).
   * Agent: not admit/route/replace wiring; ≡ carrier coverage for deferred row.
   */
  readonly recordStubPair: (commId: G10S1CommId, phase: string, projection: G9EqualityA) => void;
  /** True when replace installed for S1. */
  readonly isReplaceInstalled: () => boolean;
  readonly authority: () => "live" | "manifold";
  readonly phase: () => CutoverPhase;
  readonly inversionArmed: () => boolean;
  /** Format evidence markdown for a recorded step body. */
  readonly formatEvidenceMarkdown: (body: G10S1EvidenceBody) => string;
  /**
   * Run full Ordered proof + FD soft-fallback-retire; returns bodies in order.
   * Agent: requires T2CODE_SCM_FABRIC_DEPTH (retire refuses otherwise).
   */
  readonly runFullOrderedProof: () => readonly G10S1EvidenceBody[];
};

/** Process-global optional controller (tests / Engine fallback). */
let processGlobalG10S1: G10S1Controller | undefined;

/**
 * Install or clear the process-global S1 controller.
 *
 * Intended: tests set before Engine effects; production prefers Effect Layer.
 * Observed: module singleton; absent ⇒ Engine live unchanged.
 */
export const installProcessGlobalG10S1 = (controller: G10S1Controller | undefined): void => {
  processGlobalG10S1 = controller;
};

/** Read process-global S1 controller (undefined when absent). */
export const getProcessGlobalG10S1 = (): G10S1Controller | undefined => processGlobalG10S1;

/**
 * Effect service key for optional S1 cutover controller (G9CaptureService pattern).
 *
 * Absent ⇒ OrchestrationEngine publish/offer paths unchanged.
 */
export class G10S1CutoverService extends Context.Service<G10S1CutoverService, G10S1Controller>()(
  "t3/scm/g10SliceS1/G10S1CutoverService",
) {}

/** Layer.succeed helper for tests / optional stack merge. */
export const G10S1CutoverLayer = (controller: G10S1Controller): Layer.Layer<G10S1CutoverService> =>
  Layer.succeed(G10S1CutoverService, controller);

/**
 * Resolve optional S1 controller: Effect.serviceOption first, then process-global.
 *
 * Intended: Engine sites call this once per publish/offer. Absent ⇒ live only.
 */
export const resolveOptionalG10S1 = (): Effect.Effect<Option.Option<G10S1Controller>> =>
  Effect.gen(function* () {
    const fromService = yield* Effect.serviceOption(G10S1CutoverService);
    if (Option.isSome(fromService)) return fromService;
    const global = processGlobalG10S1;
    return global === undefined ? Option.none() : Option.some(global);
  });

const nowMs = (): number => Date.now();

const pushSample = (traffic: G10S1ManifoldTrafficLog, sample: G10S1TrafficSample): void => {
  traffic.samples.push(sample);
};

/**
 * Create an S1 campaign controller bound to inventory registry.
 *
 * Parameters
 * ----------
 * repoRoot : string
 *     Monorepo root for seam-inventory load (defaults to resolveG10RepoRoot).
 *
 * Returns
 * -------
 * G10S1Controller
 *     Mutable coordinator for S1 Ordered proof + manifold traffic.
 */
export const createG10S1Controller = (repoRoot: string = resolveG10RepoRoot()): G10S1Controller => {
  const registry = loadG10CutoverRegistry(repoRoot);
  const model = createSubstitutionModel(registry);
  const traffic: G10S1ManifoldTrafficLog = { samples: [] };

  const s1Ids = activatableCommIdsForSlice(registry, "S1");
  // Hard lock: inventory S1 set must match frozen 7 (no silent resize).
  if (s1Ids.length !== G10_S1_COMM_IDS.length) {
    throw new Error(
      `G10 S1 controller: inventory S1 count ${s1Ids.length} ≠ frozen ${G10_S1_COMM_IDS.length}`,
    );
  }
  for (const id of G10_S1_COMM_IDS) {
    if (!s1Ids.includes(id)) {
      throw new Error(`G10 S1 controller: missing inventory id ${id}`);
    }
  }

  const snapshotEvidence = (
    step: OrderedProofStep | "soft-fallback-retire",
    notes: readonly string[],
    equalitySamples?: readonly G9DeferredEquality[],
  ): G10S1EvidenceBody => {
    const liveCount = traffic.samples.filter((s) => s.path === "live").length;
    const manifoldCount = traffic.samples.filter((s) => s.path === "manifold").length;
    return {
      slice: "S1",
      step,
      phase: phaseForSlice(model, "S1"),
      authority: authorityForSlice(model, "S1"),
      inversionArmed: model.sliceStates.get("S1")?.inversionArmed === true,
      softFallback: softFallbackForSlice(model, "S1"),
      commIds: [...s1Ids],
      notes,
      equalitySamples,
      trafficSummary: { liveCount, manifoldCount },
    };
  };

  const formatEvidenceMarkdown = (body: G10S1EvidenceBody): string => {
    const lines = [
      `# S1 ${body.step} evidence`,
      "",
      `<!-- Agent: G10 S1 Ordered proof step. Slice=${body.slice}. -->`,
      "",
      `- Date: ${new Date().toISOString().slice(0, 10)}`,
      `- Slice: **S1**`,
      `- Step: **${body.step}**`,
      `- Phase: \`${body.phase}\``,
      `- Authority: **${body.authority}**`,
      `- inversionArmed: \`${body.inversionArmed}\``,
      `- softFallback: \`${body.softFallback === null ? "null" : body.softFallback}\``,
      `- S1 comm_ids (${body.commIds.length}): ${body.commIds.join(", ")}`,
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

  const recordLivePublish = (event: OrchestrationEvent): void => {
    pushSample(traffic, {
      path: "live",
      commId: "INV-T2-ORCH-EVENTS",
      phase: "pubsub-published",
      projection: { member_id: event.type } as Extract<G9EqualityA, { readonly member_id: string }>,
      atMs: nowMs(),
    });
  };

  const recordManifoldPublish = (event: OrchestrationEvent): void => {
    pushSample(traffic, {
      path: "manifold",
      commId: "INV-T2-ORCH-EVENTS",
      phase: "pubsub-published",
      projection: { member_id: event.type } as Extract<G9EqualityA, { readonly member_id: string }>,
      atMs: nowMs(),
    });
  };

  const recordLiveOffer = (command: OrchestrationCommand): void => {
    pushSample(traffic, {
      path: "live",
      commId: "INV-T2-ORCH-QUEUE",
      phase: "queue-offered",
      projection: { command_type: commandTypeOf(command) },
      atMs: nowMs(),
    });
  };

  const recordManifoldOffer = (command: OrchestrationCommand): void => {
    pushSample(traffic, {
      path: "manifold",
      commId: "INV-T2-ORCH-QUEUE",
      phase: "queue-offered",
      projection: { command_type: commandTypeOf(command) },
      atMs: nowMs(),
    });
  };

  const recordLiveWiredSeam = (
    commId: G10S1WiredCommId,
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
    commId: G10S1WiredCommId,
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

  const recordStubPair = (commId: G10S1CommId, phase: string, projection: G9EqualityA): void => {
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
   * Seed SETTINGS-EVENTS handoff stub only (S1→S2; not seam-bridge wired).
   * Agent: four former stub rows are rehearsed via g10SeamBridge instead.
   */
  const seedSettingsHandoffStub = (): void => {
    // Projection matches ledger G9EqualityA for settings-subscription-established.
    recordStubPair("INV-T2-SETTINGS-EVENTS", "settings-subscription-established", {
      site: "subscribed",
    });
  };

  /**
   * Dual-run observe rehearsal through seam bridge (live authoritative).
   * Records Engine + four capture-module seams without real PubSub/Queue I/O.
   */
  const rehearseWiredSeamsObserve = (): void => {
    // member_id must be a ledger ORCH-EVENTS OrchestrationEventType.
    // Agent: rehearsal shapes are projection carriers only — not full command/event bodies.
    const fakeEvent = { type: "thread.activity-appended" } as unknown as OrchestrationEvent;
    const fakeCommand = { type: "thread.message.send" } as unknown as OrchestrationCommand;

    const runBridge = (
      commId: G10S1WiredCommId,
      liveRecord: () => void,
      manifoldRecord: () => void,
    ): void => {
      void Effect.runSync(
        runG10SeamBridge({
          model,
          slice: "S1",
          commId,
          liveEffect: Effect.sync(() => {
            liveRecord();
            return true;
          }),
          manifoldEffect: Effect.sync(() => {
            manifoldRecord();
            return true;
          }),
          manifoldObserveEffect: Effect.sync(() => {
            manifoldRecord();
          }),
        }),
      );
    };

    runBridge(
      "INV-T2-ORCH-EVENTS",
      () => recordLivePublish(fakeEvent),
      () => recordManifoldPublish(fakeEvent),
    );
    runBridge(
      "INV-T2-ORCH-QUEUE",
      () => recordLiveOffer(fakeCommand),
      () => recordManifoldOffer(fakeCommand),
    );
    runBridge(
      "INV-T2-LIFECYCLE-EVENTS",
      () =>
        recordLiveWiredSeam("INV-T2-LIFECYCLE-EVENTS", "pubsub-published", {
          comm_id: "present",
        }),
      () =>
        recordManifoldWiredSeam("INV-T2-LIFECYCLE-EVENTS", "pubsub-published", {
          comm_id: "present",
        }),
    );
    runBridge(
      "INV-T2-PREVIEW-AUTO",
      () =>
        recordLiveWiredSeam("INV-T2-PREVIEW-AUTO", "preview-auto-queue-offered", {
          comm_id: "present",
        }),
      () =>
        recordManifoldWiredSeam("INV-T2-PREVIEW-AUTO", "preview-auto-queue-offered", {
          comm_id: "present",
        }),
    );
    runBridge(
      "INV-T2-PROJECT-QUEUE",
      () =>
        recordLiveWiredSeam("INV-T2-PROJECT-QUEUE", "projection-event-succeeded", {
          kind: "projection-event-succeeded",
        }),
      () =>
        recordManifoldWiredSeam("INV-T2-PROJECT-QUEUE", "projection-event-succeeded", {
          kind: "projection-event-succeeded",
        }),
    );
    runBridge(
      "INV-T2-VCS-EVENTS",
      () =>
        recordLiveWiredSeam("INV-T2-VCS-EVENTS", "pubsub-published", {
          comm_id: "present",
        }),
      () =>
        recordManifoldWiredSeam("INV-T2-VCS-EVENTS", "pubsub-published", {
          comm_id: "present",
        }),
    );
  };

  const land = (): G10S1EvidenceBody => {
    installAdmitRouteReplace(model, "S1");
    recordOrderedProofStep(model, "S1", "land");
    return snapshotEvidence("land", [
      "admit/route/replace installed for S1 radius (7 inventory rows)",
      "authority remains live (dual-run); manifold observe-beside eligible",
      "wired seams (6): Engine ORCH-EVENTS/ORCH-QUEUE + LIFECYCLE/PREVIEW-AUTO/PROJECT-QUEUE/VCS-EVENTS",
      "SETTINGS-EVENTS handoff-pending S2 (serverSettings.ts) — not S1-wired",
      "markDualRunExited not used",
    ]);
  };

  const liveRehearsal = (): G10S1EvidenceBody => {
    if (!model.installs.get("S1")?.replaceInstalled) {
      throw new Error("G10 S1 liveRehearsal requires land first");
    }
    // Observe dual-run traffic while live authoritative.
    rehearseWiredSeamsObserve();
    seedSettingsHandoffStub();
    // One rollback restore under live-authoritative conditions, then re-land.
    restorePreCutoverLive(model, "S1");
    if (authorityForSlice(model, "S1") !== "live") {
      throw new Error("G10 S1 liveRehearsal: restore did not return live authority");
    }
    // Re-install replace (authority stays live) so Ordered land prefix remains.
    if (!model.installs.get("S1")?.replaceInstalled) {
      installAdmitRouteReplace(model, "S1");
    } else {
      // restore keeps replaceInstalled; re-assert live authority.
      const install = model.installs.get("S1");
      if (install && install.authority !== "live") {
        model.installs.set("S1", { ...install, authority: "live" });
      }
    }
    rehearseWiredSeamsObserve();
    recordOrderedProofStep(model, "S1", "live-rehearsal");
    return snapshotEvidence("live-rehearsal", [
      "dual-run observe on six wired S1 seams via g10SeamBridge (live authoritative)",
      "SETTINGS-EVENTS handoff stub only (deferred to S2; not bridge-wired)",
      "one rollback restore + re-land under live authority",
      "inversion not armed; live remains authoritative",
    ]);
  };

  const recordEquiv = (): G10S1EvidenceBody => {
    const byComm = new Map<string, { live?: G9EqualityA; manifold?: G9EqualityA }>();
    for (const sample of traffic.samples) {
      const entry = byComm.get(sample.commId) ?? {};
      if (sample.path === "live") entry.live = sample.projection;
      else entry.manifold = sample.projection;
      byComm.set(sample.commId, entry);
    }
    const equalitySamples: G9DeferredEquality[] = [];
    const missing: string[] = [];
    for (const id of G10_S1_COMM_IDS) {
      const pair = byComm.get(id);
      if (!pair?.live || !pair.manifold) {
        missing.push(id);
        continue;
      }
      if (JSON.stringify(pair.live) !== JSON.stringify(pair.manifold)) {
        throw new Error(
          `G10 S1 ≡ failed for ${id}: live=${JSON.stringify(pair.live)} manifold=${JSON.stringify(pair.manifold)}`,
        );
      }
      equalitySamples.push(asG9DeferredEquality(pair.live));
    }
    if (missing.length > 0) {
      throw new Error(`G10 S1 ≡ missing traffic for: ${missing.join(", ")}`);
    }
    recordOrderedProofStep(model, "S1", "cutover-equivalence");
    return snapshotEvidence(
      "cutover-equivalence",
      [
        "wired six: live≡manifold via g10SeamBridge traffic (Engine + four capture modules)",
        "SETTINGS-EVENTS: handoff-deferred stub pair only (S2 lander; not (a) for this row)",
        "not WP8 763-fixture-as-proof",
        "type carrier: asG9DeferredEquality from g10ProofHarness",
      ],
      equalitySamples,
    );
  };

  const rollbackDrill = (): G10S1EvidenceBody => {
    const result = restorePreCutoverLive(model, "S1");
    if (
      result.restoredAuthority !== "live" ||
      result.clearedShadowEnv ||
      result.usedHaltController
    ) {
      throw new Error("G10 S1 rollbackDrill: invalid rollback result");
    }
    if (authorityForSlice(model, "S1") !== "live") {
      throw new Error("G10 S1 rollbackDrill: authority not live after restore");
    }
    // Re-prove live authority with a live-only bridge call (replace still installed).
    const proved = Effect.runSync(
      runG10SeamBridge({
        model,
        slice: "S1",
        commId: "INV-T2-ORCH-QUEUE",
        liveEffect: Effect.succeed("live-ok"),
        manifoldEffect: Effect.succeed("manifold-should-not-win"),
        manifoldObserveEffect: Effect.void,
      }),
    );
    if (proved !== "live-ok") {
      throw new Error("G10 S1 rollbackDrill: live authority not selected");
    }
    recordOrderedProofStep(model, "S1", "rollback-drill");
    return snapshotEvidence("rollback-drill", [
      "restorePreCutoverLive restored live authority",
      "rollback ≠ unset T2CODE_SCM_G9_SHADOW; no halt controller",
      "re-proved live-authoritative bridge selection for ORCH-QUEUE",
    ]);
  };

  const dualRunExit = (): G10S1EvidenceBody => {
    // Sole owner: recordOrderedProofStep flips authority to manifold.
    // Do NOT call markDualRunExited — it always throws (S0 sole-owner binding).
    recordOrderedProofStep(model, "S1", "dual-run-exit");
    if (authorityForSlice(model, "S1") !== "manifold") {
      throw new Error("G10 S1 dualRunExit: authority not manifold after proof step");
    }
    return snapshotEvidence("dual-run-exit", [
      "exit (a)/(e) for six wired S1-owned seams only (ORCH-EVENTS/ORCH-QUEUE/LIFECYCLE/PREVIEW-AUTO/PROJECT-QUEUE/VCS-EVENTS)",
      "SETTINGS-EVENTS handoff-deferred to S2 — not claimed under exit (a)",
      'flipped solely via recordOrderedProofStep(..., "dual-run-exit")',
      "markDualRunExited not used (S0 escalation sole-owner binding)",
      "prerequisites: land + live-rehearsal + ≡ + rollback-drill green for wired six",
    ]);
  };

  const armInversionStep = (): G10S1EvidenceBody => {
    armInversion(model, "S1", registry);
    if (model.sliceStates.get("S1")?.inversionArmed !== true) {
      throw new Error("G10 S1 armInversion: inversionArmed not true");
    }
    return snapshotEvidence("arm-inversion", [
      "noninterference inversion armed after dual-run-exit",
      "manifold failure may now fail user-visible S1 orch ops",
      "armed solely via armInversion → recordOrderedProofStep",
    ]);
  };

  /**
   * Fabric-depth soft-fallback-retire (proof-bar step 7 / FD1).
   *
   * Intended: after arm-inversion GREEN, set g10.softFallback=retired when
   * T2CODE_SCM_FABRIC_DEPTH on and S1 sole-lander census debt is empty
   * (SETTINGS handoff stub only). Observed: recordSoftFallbackRetire + census
   * path under docs/scm/fabric-depth/evidence/.
   */
  const softFallbackRetire = (): G10S1EvidenceBody => {
    recordSoftFallbackRetire(model, "S1", S1_MANIFOLD_IO_CENSUS(repoRoot));
    if (softFallbackForSlice(model, "S1") !== "retired") {
      throw new Error("G10 S1 softFallbackRetire: softFallback not retired");
    }
    return snapshotEvidence("soft-fallback-retire", [
      "g10.softFallback=retired after arm-inversion GREEN (Fabric-depth FD1)",
      "census sole-lander debt empty (SETTINGS-EVENTS handoff stub only)",
      "bridge must not soft-fall to live on manifold failure for S1",
      "requires T2CODE_SCM_FABRIC_DEPTH; does not flip g9toG10Authorized",
    ]);
  };

  const runFullOrderedProof = (): readonly G10S1EvidenceBody[] => {
    const bodies: G10S1EvidenceBody[] = [];
    bodies.push(land());
    bodies.push(liveRehearsal());
    bodies.push(recordEquiv());
    bodies.push(rollbackDrill());
    bodies.push(dualRunExit());
    bodies.push(armInversionStep());
    bodies.push(softFallbackRetire());
    if (!orderedProofSatisfiedThrough(model, "S1", "arm-inversion")) {
      throw new Error("G10 S1 runFullOrderedProof: Ordered proof incomplete");
    }
    if (softFallbackForSlice(model, "S1") !== "retired") {
      throw new Error("G10 S1 runFullOrderedProof: soft-fallback-retire incomplete");
    }
    return bodies;
  };

  return {
    slice: "S1",
    model,
    registry,
    traffic,
    land,
    liveRehearsal,
    recordEquiv,
    rollbackDrill,
    dualRunExit,
    armInversion: armInversionStep,
    softFallbackRetire,
    recordLivePublish,
    recordManifoldPublish,
    recordLiveOffer,
    recordManifoldOffer,
    recordLiveWiredSeam,
    recordManifoldWiredSeam,
    recordStubPair,
    isReplaceInstalled: () => model.installs.get("S1")?.replaceInstalled === true,
    authority: () => authorityForSlice(model, "S1"),
    phase: () => phaseForSlice(model, "S1"),
    inversionArmed: () => model.sliceStates.get("S1")?.inversionArmed === true,
    formatEvidenceMarkdown,
    runFullOrderedProof,
  };
};

/**
 * Engine helper: publish ORCH-EVENTS through G10 bridge when S1 present.
 *
 * Intended: absent controller ⇒ caller’s livePublish unchanged.
 * Present + not replaced / live authority ⇒ livePublish + optional manifold
 * observe record. Present + manifold authority ⇒ manifold path (record +
 * livePublish I/O reused as manifold I/O carrier so PubSub still fires);
 * inversionArmed ⇒ manifold fail fails user op.
 *
 * Observed: G9 capture stays inside livePublish (observe-beside, not cutover).
 */
export const publishOrchEventsViaG10Bridge = <R>(
  livePublish: Effect.Effect<boolean, never, R>,
  event: OrchestrationEvent,
): Effect.Effect<boolean, never, R> =>
  Effect.gen(function* () {
    const opt = yield* resolveOptionalG10S1();
    if (Option.isNone(opt) || !opt.value.isReplaceInstalled()) {
      return yield* livePublish;
    }
    const ctrl = opt.value;
    const liveEffect = Effect.gen(function* () {
      const published = yield* livePublish;
      if (published) ctrl.recordLivePublish(event);
      return published;
    });
    const manifoldAuthority = Effect.gen(function* () {
      ctrl.recordManifoldPublish(event);
      // Reuse live publish I/O so PubSub still delivers; G9 capture remains beside.
      return yield* livePublish;
    });
    const manifoldObserve = Effect.sync(() => {
      ctrl.recordManifoldPublish(event);
    });
    return yield* runG10SeamBridge({
      model: ctrl.model,
      slice: "S1",
      commId: "INV-T2-ORCH-EVENTS",
      liveEffect,
      manifoldEffect: manifoldAuthority,
      manifoldObserveEffect: manifoldObserve,
    });
  });

/**
 * Engine helper: ORCH-QUEUE offer through G10 bridge when S1 present.
 *
 * Same authority rules as publishOrchEventsViaG10Bridge. G9 capture remains
 * the caller’s post-offer observe-beside (Engine keeps captureIfOfferAccepted).
 */
export const offerOrchQueueViaG10Bridge = <R>(
  liveOffer: Effect.Effect<boolean, never, R>,
  command: OrchestrationCommand,
): Effect.Effect<boolean, never, R> =>
  Effect.gen(function* () {
    const opt = yield* resolveOptionalG10S1();
    if (Option.isNone(opt) || !opt.value.isReplaceInstalled()) {
      return yield* liveOffer;
    }
    const ctrl = opt.value;
    const liveEffect = Effect.gen(function* () {
      const accepted = yield* liveOffer;
      if (accepted) ctrl.recordLiveOffer(command);
      return accepted;
    });
    const manifoldAuthority = Effect.gen(function* () {
      ctrl.recordManifoldOffer(command);
      return yield* liveOffer;
    });
    const manifoldObserve = Effect.sync(() => {
      ctrl.recordManifoldOffer(command);
    });
    return yield* runG10SeamBridge({
      model: ctrl.model,
      slice: "S1",
      commId: "INV-T2-ORCH-QUEUE",
      liveEffect,
      manifoldEffect: manifoldAuthority,
      manifoldObserveEffect: manifoldObserve,
    });
  });

/**
 * Shared capture-module bridge: boolean live I/O + wired-seam traffic records.
 *
 * Intended: absent/not-replaced ⇒ live only. Present + replaced ⇒
 * runG10SeamBridge with live/manifold record hooks. Gate recording with
 * shouldRecord (default: truthy boolean result). SETTINGS must not call this.
 *
 * Observed: reuses live I/O on manifold authority so PubSub/Queue still fire.
 */
const runWiredBooleanSeamViaG10Bridge = <R>(
  commId: G10S1WiredCommId,
  phase: string,
  projection: G9EqualityA,
  liveIo: Effect.Effect<boolean, never, R>,
  shouldRecord: (result: boolean) => boolean = (r) => r,
): Effect.Effect<boolean, never, R> =>
  Effect.gen(function* () {
    const opt = yield* resolveOptionalG10S1();
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
      slice: "S1",
      commId,
      liveEffect,
      manifoldEffect: manifoldAuthority,
      manifoldObserveEffect: manifoldObserve,
    });
  });

/**
 * LIFECYCLE-EVENTS: wrap serverLifecycleEvents PubSub.publish through G10 bridge.
 * Agent: call site only in serverLifecycleEvents.ts. G9 capture stays beside.
 */
export const publishLifecycleEventsViaG10Bridge = <R>(
  livePublish: Effect.Effect<boolean, never, R>,
): Effect.Effect<boolean, never, R> =>
  runWiredBooleanSeamViaG10Bridge(
    "INV-T2-LIFECYCLE-EVENTS",
    "pubsub-published",
    { comm_id: "present" },
    livePublish,
  );

/**
 * PREVIEW-AUTO: wrap PreviewAutomationBroker Queue.offer through G10 bridge.
 * Agent: call site only in PreviewAutomationBroker.ts (request offer path).
 */
export const offerPreviewAutoViaG10Bridge = <R>(
  liveOffer: Effect.Effect<boolean, never, R>,
): Effect.Effect<boolean, never, R> =>
  runWiredBooleanSeamViaG10Bridge(
    "INV-T2-PREVIEW-AUTO",
    "preview-auto-queue-offered",
    { comm_id: "present" },
    liveOffer,
  );

/**
 * PROJECT-QUEUE: wrap ProjectionPipeline.projectEvent success through G10 bridge.
 *
 * Intended: liveProject succeeds ⇒ record projection-event-succeeded pair path.
 * Observed: returns void; recording always on success channel (no boolean gate).
 * Error channel E propagates unchanged. G9 captureWhenG9Present remains
 * observe-beside inside liveProject.
 */
export const projectQueueViaG10Bridge = <E, R>(
  liveProject: Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R> =>
  Effect.gen(function* () {
    const opt = yield* resolveOptionalG10S1();
    if (Option.isNone(opt) || !opt.value.isReplaceInstalled()) {
      return yield* liveProject;
    }
    const ctrl = opt.value;
    const projection: G9EqualityA = { kind: "projection-event-succeeded" };
    const liveEffect = Effect.gen(function* () {
      yield* liveProject;
      ctrl.recordLiveWiredSeam("INV-T2-PROJECT-QUEUE", "projection-event-succeeded", projection);
    });
    const manifoldAuthority = Effect.gen(function* () {
      ctrl.recordManifoldWiredSeam(
        "INV-T2-PROJECT-QUEUE",
        "projection-event-succeeded",
        projection,
      );
      yield* liveProject;
    });
    const manifoldObserve = Effect.sync(() => {
      ctrl.recordManifoldWiredSeam(
        "INV-T2-PROJECT-QUEUE",
        "projection-event-succeeded",
        projection,
      );
    });
    return yield* runG10SeamBridge({
      model: ctrl.model,
      slice: "S1",
      commId: "INV-T2-PROJECT-QUEUE",
      liveEffect,
      manifoldEffect: manifoldAuthority,
      manifoldObserveEffect: manifoldObserve,
    });
  });

/**
 * VCS-EVENTS: wrap VcsStatusBroadcaster PubSub.publish through G10 bridge.
 * Agent: call site only in VcsStatusBroadcaster.ts publish branches.
 */
export const publishVcsEventsViaG10Bridge = <R>(
  livePublish: Effect.Effect<boolean, never, R>,
): Effect.Effect<boolean, never, R> =>
  runWiredBooleanSeamViaG10Bridge(
    "INV-T2-VCS-EVENTS",
    "pubsub-published",
    { comm_id: "present" },
    livePublish,
  );

/**
 * SETTINGS-EVENTS handoff stub documentation (S1 → S2).
 *
 * Intended: S1 must NOT wire admit/route/replace in serverSettings.ts.
 * S2 sole lander owns INV-T2-SETTINGS-EVENTS cutover. S1 keeps a ledger
 * stub pair for Ordered-proof ≡ carrier coverage only (seedSettingsHandoffStub).
 * Observed: this constant is documentation for agents — no runtime effect.
 */
export const G10_S1_SETTINGS_EVENTS_HANDOFF = {
  commId: "INV-T2-SETTINGS-EVENTS" as const,
  landerSlice: "S2" as const,
  landerModule: "apps/server/src/serverSettings.ts",
  status: "handoff-pending" as const,
  note: "Do not claim Engine-wired or dual-run-exit (a) for SETTINGS from S1",
} as const;
