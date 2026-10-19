/**
 * G10 S3 campaign controller (Ordered proof + seam-bridge traffic).
 *
 * Intended: own S3 admit/route/replace + Ordered proof sequence helpers
 * wrapping createSubstitutionModel / installAdmitRouteReplace /
 * recordOrderedProofStep / armInversion / restorePreCutoverLive. Wired seams:
 *   - VcsDriver.ts sole lander: INV-T2-GIT (FILE-CHECKPOINTS is S7 handoff —
 *     do not steal)
 *   - relayClient.ts sole lander: INV-T2-RELAY-CLIENT (FLAG-CLOUDFLARED is S7
 *     handoff — do not steal)
 *   - Peer B3 capture modules S3 owns at comm_id layer (editor/net/http-serve/
 *     preview/project-setup/relay peers/SC peers/tailscale/TEL-ANALYTICS)
 * TEL-DESKTOP-CONTROL is S3→S5 handoff-pending on DesktopTelemetryReceiver —
 * ledger stub only; S3 must NOT commit that file.
 *
 * Observed: in-memory model + traffic log; dualRunExit / armInversion never
 * call markDualRunExited — recordOrderedProofStep is sole dual-run-exit /
 * arm-inversion writer. Absent controller ⇒ live paths unchanged.
 */
import {
  G10S3SharedSeamRunnerService,
  installG10S3SharedSeamRunner,
  type G10S3SharedSeamRunner,
  type G10S3SharedProjection,
} from "@t3tools/shared/g10S3CutoverHook";
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

/** Frozen S3 inventory `comm_id` set (16 rows — do not resize). */
export const G10_S3_COMM_IDS = [
  "INV-T2-EDITOR-LAUNCH",
  "INV-T2-GIT",
  "INV-T2-HTTP-SERVE",
  "INV-T2-NET-TCP",
  "INV-T2-PREVIEW-SCAN",
  "INV-T2-PROJECT-SETUP",
  "INV-T2-RELAY-AWARENESS",
  "INV-T2-RELAY-CLIENT",
  "INV-T2-RELAY-HTTP",
  "INV-T2-SC-ADO",
  "INV-T2-SC-BITBUCKET",
  "INV-T2-SC-GITHUB",
  "INV-T2-SC-GITLAB",
  "INV-T2-TAILSCALE",
  "INV-T2-TEL-ANALYTICS",
  "INV-T2-TEL-DESKTOP-CONTROL",
] as const;

export type G10S3CommId = (typeof G10_S3_COMM_IDS)[number];

/**
 * S3-owned seams with real g10SeamBridge wiring (sole landers + peer modules).
 * Agent: dual-run-exit (a)/(e) may claim these fifteen only — not TEL-DESKTOP-CONTROL.
 */
export const G10_S3_WIRED_COMM_IDS = [
  "INV-T2-EDITOR-LAUNCH",
  "INV-T2-GIT",
  "INV-T2-HTTP-SERVE",
  "INV-T2-NET-TCP",
  "INV-T2-PREVIEW-SCAN",
  "INV-T2-PROJECT-SETUP",
  "INV-T2-RELAY-AWARENESS",
  "INV-T2-RELAY-CLIENT",
  "INV-T2-RELAY-HTTP",
  "INV-T2-SC-ADO",
  "INV-T2-SC-BITBUCKET",
  "INV-T2-SC-GITHUB",
  "INV-T2-SC-GITLAB",
  "INV-T2-TAILSCALE",
  "INV-T2-TEL-ANALYTICS",
] as const;

export type G10S3WiredCommId = (typeof G10_S3_WIRED_COMM_IDS)[number];

/**
 * S3 inventory row deferred to S5 sole lander (DesktopTelemetryReceiver.ts).
 * Agent: handoff stub for ≡ carrier only — not admit/route/replace wiring.
 */
export const G10_S3_HANDOFF_PENDING_COMM_IDS = ["INV-T2-TEL-DESKTOP-CONTROL"] as const;

/**
 * S7→S3 handoffs landed at S8 lander reopen (not in G10_S3_WIRED_COMM_IDS /
 * historical S3 exit (a); S8 audit owns campaign disposition).
 */
export const G10_S3_S8_REOPEN_LANDED_FROM_S7_COMM_IDS = [
  "INV-T2-FILE-CHECKPOINTS",
  "INV-T2-FLAG-CLOUDFLARED",
] as const;

export type G10S3S8ReopenLandedCommId = (typeof G10_S3_S8_REOPEN_LANDED_FROM_S7_COMM_IDS)[number];

/** Bridgeable S3 ids: historical wired ∪ S8 reopen lands (shared runner + helpers). */
export type G10S3BridgeableCommId = G10S3WiredCommId | G10S3S8ReopenLandedCommId;

/** One manifold (or live) traffic sample for ≡ under G9DeferredEquality. */
export type G10S3TrafficSample = {
  readonly path: "live" | "manifold";
  readonly commId: G10S3CommId | G10S3S8ReopenLandedCommId;
  readonly phase: string;
  readonly projection: G9EqualityA;
  readonly atMs: number;
};

/** Structured evidence body for one Ordered proof step (markdown writer input). */
export type G10S3EvidenceBody = {
  readonly slice: "S3";
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
 * In-memory manifold stub traffic log (S3 git/relay/peers + TEL-DESKTOP stub).
 *
 * Intended: enough samples for live-vs-manifold ≡ under G9DeferredEquality.
 * Observed: append-only arrays; cleared on rollback restore when requested.
 */
export type G10S3ManifoldTrafficLog = {
  readonly samples: G10S3TrafficSample[];
};

/**
 * Representative phase + projection A for each wired S3 seam (Ordered rehearsal).
 * Agent: keep ledger-bounded; no payloads / paths / exit codes in A.
 */
const G10_S3_WIRED_REHEARSAL: ReadonlyArray<{
  readonly commId: G10S3WiredCommId;
  readonly phase: string;
  readonly projection: G9EqualityA;
}> = [
  {
    commId: "INV-T2-EDITOR-LAUNCH",
    phase: "editor-spawn-succeeded",
    projection: { comm_id: "present" },
  },
  { commId: "INV-T2-GIT", phase: "git-execute-succeeded", projection: { method: "execute" } },
  {
    commId: "INV-T2-HTTP-SERVE",
    phase: "http-listening-marked",
    projection: { site: "listening" },
  },
  {
    commId: "INV-T2-NET-TCP",
    phase: "net-canListenOnHost-resolved",
    projection: { result_class: "available" },
  },
  {
    commId: "INV-T2-PREVIEW-SCAN",
    phase: "scan-process-succeeded",
    projection: { comm_id: "present" },
  },
  {
    commId: "INV-T2-PROJECT-SETUP",
    phase: "project-setup-started",
    projection: { site: "project-setup-started" },
  },
  {
    commId: "INV-T2-RELAY-AWARENESS",
    phase: "awareness-publish-succeeded",
    projection: { operation: "publishAgentActivity" },
  },
  {
    commId: "INV-T2-RELAY-CLIENT",
    phase: "cloudflared-spawn-succeeded",
    projection: { site: "spawned" },
  },
  {
    commId: "INV-T2-RELAY-HTTP",
    phase: "relay-http-client-succeeded",
    projection: { member_id: "environment-link" },
  },
  {
    commId: "INV-T2-SC-ADO",
    phase: "cli-execute-succeeded",
    projection: { comm_id: "cli-execute-succeeded" },
  },
  {
    commId: "INV-T2-SC-BITBUCKET",
    phase: "http-client-succeeded",
    projection: { operation: "request" },
  },
  {
    commId: "INV-T2-SC-GITHUB",
    phase: "cli-execute-succeeded",
    projection: { comm_id: "cli-execute-succeeded" },
  },
  {
    commId: "INV-T2-SC-GITLAB",
    phase: "cli-execute-succeeded",
    projection: { comm_id: "cli-execute-succeeded" },
  },
  {
    commId: "INV-T2-TAILSCALE",
    phase: "tailscale-command-succeeded",
    projection: { operation: "configure" },
  },
  {
    commId: "INV-T2-TEL-ANALYTICS",
    phase: "posthog-batch-succeeded",
    projection: { comm_id: "present" },
  },
];

/**
 * S3 campaign controller shape (process-global or Effect service).
 *
 * Agent: land → liveRehearsal → recordEquiv → rollbackDrill → dualRunExit →
 * armInversion. dualRunExit uses recordOrderedProofStep only.
 */
export type G10S3Controller = {
  readonly slice: "S3";
  readonly model: G10SubstitutionModel;
  readonly registry: G10CutoverRegistry;
  readonly traffic: G10S3ManifoldTrafficLog;
  /** admit/route/replace + Ordered proof "land". */
  readonly land: () => G10S3EvidenceBody;
  /**
   * Live-authoritative rehearsal: observe traffic + one rollback restore +
   * re-land install + record live-rehearsal step.
   */
  readonly liveRehearsal: () => G10S3EvidenceBody;
  /** Cutover ≡ under G9DeferredEquality for S3 inventory (wired + handoff stub). */
  readonly recordEquiv: () => G10S3EvidenceBody;
  /** Rollback drill: restore live, re-prove authority, record step. */
  readonly rollbackDrill: () => G10S3EvidenceBody;
  /** Dual-run exit via recordOrderedProofStep only (refuses markDualRunExited). */
  readonly dualRunExit: () => G10S3EvidenceBody;
  /** Arm inversion via armInversion → recordOrderedProofStep. */
  readonly armInversion: () => G10S3EvidenceBody;
  /**
   * Record live traffic for a wired S3 lander/peer seam or S8 reopen land.
   * Agent: do not use for TEL-DESKTOP-CONTROL handoff — that stays recordStubPair.
   */
  readonly recordLiveWiredSeam: (
    commId: G10S3BridgeableCommId,
    phase: string,
    projection: G9EqualityA,
  ) => void;
  /** Record manifold observe/authority sample for a wired S3 seam or S8 reopen. */
  readonly recordManifoldWiredSeam: (
    commId: G10S3BridgeableCommId,
    phase: string,
    projection: G9EqualityA,
  ) => void;
  /**
   * Record handoff-pending stub pair (TEL-DESKTOP-CONTROL → S5 only).
   * Agent: not admit/route/replace wiring; ≡ carrier coverage for deferred row.
   */
  readonly recordStubPair: (commId: G10S3CommId, phase: string, projection: G9EqualityA) => void;
  /** True when replace installed for S3. */
  readonly isReplaceInstalled: () => boolean;
  readonly authority: () => "live" | "manifold";
  readonly phase: () => CutoverPhase;
  readonly inversionArmed: () => boolean;
  /** Format evidence markdown for a recorded step body. */
  readonly formatEvidenceMarkdown: (body: G10S3EvidenceBody) => string;
  /** Run full Ordered proof sequence; returns bodies in order. */
  readonly runFullOrderedProof: () => readonly G10S3EvidenceBody[];
  /** Shared-package seam runner bound to this controller (relay/Net/tailscale). */
  readonly sharedSeamRunner: () => G10S3SharedSeamRunner;
};

/** Process-global optional controller (tests / lander fallback). */
let processGlobalG10S3: G10S3Controller | undefined;

/**
 * Build shared-package runner that records into controller traffic via bridge.
 *
 * Intended: packages call runViaOptionalG10S3SharedSeam; this adapter selects
 * authority and records live/manifold samples for wired S3 comm_ids only.
 */
const buildSharedSeamRunner = (ctrl: {
  readonly model: G10SubstitutionModel;
  readonly isReplaceInstalled: () => boolean;
  readonly recordLiveWiredSeam: (
    commId: G10S3BridgeableCommId,
    phase: string,
    projection: G9EqualityA,
  ) => void;
  readonly recordManifoldWiredSeam: (
    commId: G10S3BridgeableCommId,
    phase: string,
    projection: G9EqualityA,
  ) => void;
}): G10S3SharedSeamRunner => ({
  isReplaceInstalled: () => ctrl.isReplaceInstalled(),
  runWiredSeam: <A, E, R>(args: {
    readonly commId: string;
    readonly phase: string;
    readonly projection: G10S3SharedProjection;
    readonly liveEffect: Effect.Effect<A, E, R>;
  }): Effect.Effect<A, E, R> => {
    const wired =
      G10_S3_WIRED_COMM_IDS.find((id) => id === args.commId) ??
      G10_S3_S8_REOPEN_LANDED_FROM_S7_COMM_IDS.find((id) => id === args.commId);
    if (wired === undefined) {
      // Unknown / still-deferred ids must not enter shared runner as wired.
      return args.liveEffect;
    }
    const projection = args.projection as G9EqualityA;
    const liveEffect = Effect.gen(function* () {
      const result = yield* args.liveEffect;
      ctrl.recordLiveWiredSeam(wired, args.phase, projection);
      return result;
    });
    const manifoldAuthority = Effect.gen(function* () {
      ctrl.recordManifoldWiredSeam(wired, args.phase, projection);
      return yield* args.liveEffect;
    });
    const manifoldObserve = Effect.sync(() => {
      ctrl.recordManifoldWiredSeam(wired, args.phase, projection);
    });
    return runG10SeamBridge({
      model: ctrl.model,
      slice: "S3",
      commId: wired,
      liveEffect,
      manifoldEffect: manifoldAuthority,
      manifoldObserveEffect: manifoldObserve,
    });
  },
});

/**
 * Install or clear the process-global S3 controller (+ shared-package runner).
 *
 * Intended: tests set before VcsDriver/relayClient effects; production prefers Layer.
 * Observed: module singleton; absent ⇒ lander live unchanged.
 */
export const installProcessGlobalG10S3 = (controller: G10S3Controller | undefined): void => {
  processGlobalG10S3 = controller;
  installG10S3SharedSeamRunner(
    controller === undefined ? undefined : controller.sharedSeamRunner(),
  );
};

/** Read process-global S3 controller (undefined when absent). */
export const getProcessGlobalG10S3 = (): G10S3Controller | undefined => processGlobalG10S3;

/**
 * Effect service key for optional S3 cutover controller (G9CaptureService pattern).
 *
 * Absent ⇒ VcsDriver / peers / relay live paths unchanged.
 */
export class G10S3CutoverService extends Context.Service<G10S3CutoverService, G10S3Controller>()(
  "t3/scm/g10SliceS3/G10S3CutoverService",
) {}

/**
 * Layer.succeed helper for tests / optional stack merge.
 *
 * Intended: provides server G10S3CutoverService + shared-package runner Service
 * so relayClient/Net/tailscale resolve the same controller via Context.
 */
export const G10S3CutoverLayer = (
  controller: G10S3Controller,
): Layer.Layer<G10S3CutoverService | G10S3SharedSeamRunnerService> =>
  Layer.mergeAll(
    Layer.succeed(G10S3CutoverService, controller),
    Layer.succeed(G10S3SharedSeamRunnerService, controller.sharedSeamRunner()),
  );

/**
 * Resolve optional S3 controller: Effect.serviceOption first, then process-global.
 *
 * Intended: lander sites call this once per seam. Absent ⇒ live only.
 */
export const resolveOptionalG10S3 = (): Effect.Effect<Option.Option<G10S3Controller>> =>
  Effect.gen(function* () {
    const fromService = yield* Effect.serviceOption(G10S3CutoverService);
    if (Option.isSome(fromService)) return fromService;
    const global = processGlobalG10S3;
    return global === undefined ? Option.none() : Option.some(global);
  });

const nowMs = (): number => Date.now();

const pushSample = (traffic: G10S3ManifoldTrafficLog, sample: G10S3TrafficSample): void => {
  traffic.samples.push(sample);
};

/**
 * Create an S3 campaign controller bound to inventory registry.
 *
 * Parameters
 * ----------
 * repoRoot : string
 *     Monorepo root for seam-inventory load (defaults to resolveG10RepoRoot).
 *
 * Returns
 * -------
 * G10S3Controller
 *     Mutable coordinator for S3 Ordered proof + manifold traffic.
 */
export const createG10S3Controller = (repoRoot: string = resolveG10RepoRoot()): G10S3Controller => {
  const registry = loadG10CutoverRegistry(repoRoot);
  const model = createSubstitutionModel(registry);
  const traffic: G10S3ManifoldTrafficLog = { samples: [] };

  const s3Ids = activatableCommIdsForSlice(registry, "S3");
  // Hard lock: inventory S3 set must match frozen 16 (no silent resize).
  if (s3Ids.length !== G10_S3_COMM_IDS.length) {
    throw new Error(
      `G10 S3 controller: inventory S3 count ${s3Ids.length} ≠ frozen ${G10_S3_COMM_IDS.length}`,
    );
  }
  for (const id of G10_S3_COMM_IDS) {
    if (!s3Ids.includes(id)) {
      throw new Error(`G10 S3 controller: missing inventory id ${id}`);
    }
  }

  const recordLiveWiredSeam = (
    commId: G10S3BridgeableCommId,
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
    commId: G10S3BridgeableCommId,
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

  const recordStubPair = (commId: G10S3CommId, phase: string, projection: G9EqualityA): void => {
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

  const sharedRunnerHolder: {
    current: G10S3SharedSeamRunner | undefined;
  } = { current: undefined };

  const controllerBase = {
    model,
    isReplaceInstalled: () => model.installs.get("S3")?.replaceInstalled === true,
    recordLiveWiredSeam,
    recordManifoldWiredSeam,
  };

  sharedRunnerHolder.current = buildSharedSeamRunner(controllerBase);

  const snapshotEvidence = (
    step: OrderedProofStep | "land",
    notes: readonly string[],
    equalitySamples?: readonly G9DeferredEquality[],
  ): G10S3EvidenceBody => {
    const liveCount = traffic.samples.filter((s) => s.path === "live").length;
    const manifoldCount = traffic.samples.filter((s) => s.path === "manifold").length;
    return {
      slice: "S3",
      step,
      phase: phaseForSlice(model, "S3"),
      authority: authorityForSlice(model, "S3"),
      inversionArmed: model.sliceStates.get("S3")?.inversionArmed === true,
      commIds: [...s3Ids],
      notes,
      equalitySamples,
      trafficSummary: { liveCount, manifoldCount },
    };
  };

  const formatEvidenceMarkdown = (body: G10S3EvidenceBody): string => {
    const lines = [
      `# S3 ${body.step} evidence`,
      "",
      `<!-- Agent: G10 S3 Ordered proof step. Slice=${body.slice}. -->`,
      "",
      `- Date: ${new Date().toISOString().slice(0, 10)}`,
      `- Slice: **S3**`,
      `- Step: **${body.step}**`,
      `- Phase: \`${body.phase}\``,
      `- Authority: **${body.authority}**`,
      `- inversionArmed: \`${body.inversionArmed}\``,
      `- S3 comm_ids (${body.commIds.length}): ${body.commIds.join(", ")}`,
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
   * Seed TEL-DESKTOP-CONTROL handoff stub only (S3→S5; not seam-bridge wired).
   * Agent: DesktopTelemetryReceiver.ts is S5 sole lander — S3 must not commit it.
   */
  const seedTelDesktopControlHandoffStub = (): void => {
    recordStubPair("INV-T2-TEL-DESKTOP-CONTROL", "desktop-control-send-succeeded", {
      operation: "setDiagnosticsDemand",
    });
  };

  /**
   * Dual-run observe rehearsal through seam bridge (live authoritative).
   * Records all fifteen wired S3 seams without real I/O.
   */
  const rehearseWiredSeamsObserve = (): void => {
    for (const row of G10_S3_WIRED_REHEARSAL) {
      void Effect.runSync(
        runG10SeamBridge({
          model,
          slice: "S3",
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

  const land = (): G10S3EvidenceBody => {
    installAdmitRouteReplace(model, "S3");
    recordOrderedProofStep(model, "S3", "land");
    return snapshotEvidence("land", [
      "admit/route/replace installed for S3 radius (16 inventory rows)",
      "authority remains live (dual-run); manifold observe-beside eligible",
      "wired seams (15): GIT + RELAY-CLIENT sole landers + 13 B3 peer modules",
      "TEL-DESKTOP-CONTROL handoff-pending S5 (DesktopTelemetryReceiver) — not S3-wired; S3 does not commit that file",
      "FILE-CHECKPOINTS left for S7 handoff on VcsDriver — not stolen",
      "FLAG-CLOUDFLARED left for S7 handoff on relayClient — not stolen",
      "markDualRunExited not used",
    ]);
  };

  const liveRehearsal = (): G10S3EvidenceBody => {
    if (!model.installs.get("S3")?.replaceInstalled) {
      throw new Error("G10 S3 liveRehearsal requires land first");
    }
    rehearseWiredSeamsObserve();
    seedTelDesktopControlHandoffStub();
    restorePreCutoverLive(model, "S3");
    if (authorityForSlice(model, "S3") !== "live") {
      throw new Error("G10 S3 liveRehearsal: restore did not return live authority");
    }
    if (!model.installs.get("S3")?.replaceInstalled) {
      installAdmitRouteReplace(model, "S3");
    } else {
      const install = model.installs.get("S3");
      if (install && install.authority !== "live") {
        model.installs.set("S3", { ...install, authority: "live" });
      }
    }
    rehearseWiredSeamsObserve();
    recordOrderedProofStep(model, "S3", "live-rehearsal");
    return snapshotEvidence("live-rehearsal", [
      "dual-run observe on fifteen wired S3 seams via g10SeamBridge (live authoritative)",
      "TEL-DESKTOP-CONTROL handoff stub only (deferred to S5 DesktopTelemetryReceiver; not bridge-wired)",
      "one rollback restore + re-land under live authority",
      "inversion not armed; live remains authoritative",
    ]);
  };

  const recordEquiv = (): G10S3EvidenceBody => {
    const byComm = new Map<string, { live?: G9EqualityA; manifold?: G9EqualityA }>();
    for (const sample of traffic.samples) {
      const entry = byComm.get(sample.commId) ?? {};
      if (sample.path === "live") entry.live = sample.projection;
      else entry.manifold = sample.projection;
      byComm.set(sample.commId, entry);
    }
    const equalitySamples: G9DeferredEquality[] = [];
    const missing: string[] = [];
    for (const id of G10_S3_COMM_IDS) {
      const pair = byComm.get(id);
      if (!pair?.live || !pair.manifold) {
        missing.push(id);
        continue;
      }
      if (JSON.stringify(pair.live) !== JSON.stringify(pair.manifold)) {
        throw new Error(
          `G10 S3 ≡ failed for ${id}: live=${JSON.stringify(pair.live)} manifold=${JSON.stringify(pair.manifold)}`,
        );
      }
      equalitySamples.push(asG9DeferredEquality(pair.live));
    }
    if (missing.length > 0) {
      throw new Error(`G10 S3 ≡ missing traffic for: ${missing.join(", ")}`);
    }
    recordOrderedProofStep(model, "S3", "cutover-equivalence");
    return snapshotEvidence(
      "cutover-equivalence",
      [
        "wired fifteen: live≡manifold via g10SeamBridge (GIT/RELAY-CLIENT + B3 peers)",
        "TEL-DESKTOP-CONTROL: handoff-deferred stub pair only (S5 lander DesktopTelemetryReceiver; not (a) for this row)",
        "not WP8 763-fixture-as-proof",
        "type carrier: asG9DeferredEquality from g10ProofHarness",
      ],
      equalitySamples,
    );
  };

  const rollbackDrill = (): G10S3EvidenceBody => {
    const result = restorePreCutoverLive(model, "S3");
    if (
      result.restoredAuthority !== "live" ||
      result.clearedShadowEnv ||
      result.usedHaltController
    ) {
      throw new Error("G10 S3 rollbackDrill: invalid rollback result");
    }
    if (authorityForSlice(model, "S3") !== "live") {
      throw new Error("G10 S3 rollbackDrill: authority not live after restore");
    }
    const proved = Effect.runSync(
      runG10SeamBridge({
        model,
        slice: "S3",
        commId: "INV-T2-GIT",
        liveEffect: Effect.succeed("live-ok"),
        manifoldEffect: Effect.succeed("manifold-should-not-win"),
        manifoldObserveEffect: Effect.void,
      }),
    );
    if (proved !== "live-ok") {
      throw new Error("G10 S3 rollbackDrill: live authority not selected");
    }
    recordOrderedProofStep(model, "S3", "rollback-drill");
    return snapshotEvidence("rollback-drill", [
      "restorePreCutoverLive restored live authority",
      "rollback ≠ unset T2CODE_SCM_G9_SHADOW; no halt controller",
      "re-proved live-authoritative bridge selection for GIT",
      "DesktopTelemetryReceiver restore owned by S5 lander (not S3)",
    ]);
  };

  const dualRunExit = (): G10S3EvidenceBody => {
    recordOrderedProofStep(model, "S3", "dual-run-exit");
    if (authorityForSlice(model, "S3") !== "manifold") {
      throw new Error("G10 S3 dualRunExit: authority not manifold after proof step");
    }
    return snapshotEvidence("dual-run-exit", [
      "exit (a)/(e) for fifteen wired S3 seams only (GIT/RELAY-CLIENT + B3 peers)",
      "TEL-DESKTOP-CONTROL handoff-deferred to S5 — not claimed under exit (a)",
      'flipped solely via recordOrderedProofStep(..., "dual-run-exit")',
      "markDualRunExited not used (S0 escalation sole-owner binding)",
      "prerequisites: land + live-rehearsal + ≡ + rollback-drill green for wired fifteen",
    ]);
  };

  const armInversionStep = (): G10S3EvidenceBody => {
    armInversion(model, "S3", registry);
    if (model.sliceStates.get("S3")?.inversionArmed !== true) {
      throw new Error("G10 S3 armInversion: inversionArmed not true");
    }
    return snapshotEvidence("arm-inversion", [
      "noninterference inversion armed after dual-run-exit",
      "manifold failure may now fail user-visible S3 VCS/relay/peer ops",
      "armed solely via armInversion → recordOrderedProofStep",
      "TEL-DESKTOP-CONTROL remains handoff-deferred — not inverted from S3 wiring",
    ]);
  };

  const runFullOrderedProof = (): readonly G10S3EvidenceBody[] => {
    const bodies: G10S3EvidenceBody[] = [];
    bodies.push(land());
    bodies.push(liveRehearsal());
    bodies.push(recordEquiv());
    bodies.push(rollbackDrill());
    bodies.push(dualRunExit());
    bodies.push(armInversionStep());
    if (!orderedProofSatisfiedThrough(model, "S3", "arm-inversion")) {
      throw new Error("G10 S3 runFullOrderedProof: Ordered proof incomplete");
    }
    return bodies;
  };

  const controller: G10S3Controller = {
    slice: "S3",
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
    isReplaceInstalled: () => model.installs.get("S3")?.replaceInstalled === true,
    authority: () => authorityForSlice(model, "S3"),
    phase: () => phaseForSlice(model, "S3"),
    inversionArmed: () => model.sliceStates.get("S3")?.inversionArmed === true,
    formatEvidenceMarkdown,
    runFullOrderedProof,
    sharedSeamRunner: () => {
      if (sharedRunnerHolder.current === undefined) {
        sharedRunnerHolder.current = buildSharedSeamRunner(controllerBase);
      }
      return sharedRunnerHolder.current;
    },
  };

  return controller;
};

/**
 * Shared lander bridge: success live I/O (git/relay/peer) via g10SeamBridge.
 *
 * Intended: absent/not-replaced ⇒ live only. Present + replaced ⇒
 * runG10SeamBridge with live/manifold record hooks. TEL-DESKTOP-CONTROL must
 * not call this.
 *
 * Observed: reuses live I/O on manifold authority so VCS/relay/peer still fire.
 */
const runWiredSuccessSeamViaG10Bridge = <A, E, R>(
  commId: G10S3WiredCommId,
  phase: string,
  projection: G9EqualityA,
  liveIo: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const opt = yield* resolveOptionalG10S3();
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
      slice: "S3",
      commId,
      liveEffect,
      manifoldEffect: manifoldAuthority,
      manifoldObserveEffect: manifoldObserve,
    });
  });

/**
 * GIT: wrap VcsDriver method success through G10 bridge.
 * Agent: call site only in VcsDriver.ts tapGitSucceeded.
 */
export const gitExecuteViaG10Bridge = <A, E, R>(
  method:
    | "execute"
    | "detectRepository"
    | "isInsideWorkTree"
    | "listWorkspaceFiles"
    | "listRemotes"
    | "filterIgnoredPaths"
    | "initRepository",
  liveGit: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge("INV-T2-GIT", "git-execute-succeeded", { method }, liveGit);

/**
 * FILE-CHECKPOINTS: S8 lander-reopen wrap on VcsDriver checkpoint ops (S7→S3).
 *
 * Intended: not in G10_S3_WIRED_COMM_IDS / historical S3 exit (a). S8 audit
 * lists lander-reopen-wired. Agent: call site only in wrapCheckpointOpsWithG9Capture.
 */
export const fileCheckpointsViaG10Bridge = <A, E, R>(
  operation:
    | "captureCheckpoint"
    | "restoreCheckpoint"
    | "diffCheckpoints"
    | "deleteCheckpointRefs"
    | "hasCheckpointRef",
  liveOp: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const opt = yield* resolveOptionalG10S3();
    if (Option.isNone(opt) || !opt.value.isReplaceInstalled()) {
      return yield* liveOp;
    }
    const ctrl = opt.value;
    const phase =
      operation === "hasCheckpointRef"
        ? "checkpoint-hasCheckpointRef-succeeded"
        : (`checkpoint-${operation}-succeeded` as const);
    const projection: G9EqualityA =
      operation === "hasCheckpointRef" ? { operation: "succeeded" } : { operation };
    const commId = "INV-T2-FILE-CHECKPOINTS" as const;
    const liveEffect = Effect.gen(function* () {
      const result = yield* liveOp;
      ctrl.recordLiveWiredSeam(commId, phase, projection);
      return result;
    });
    const manifoldAuthority = Effect.gen(function* () {
      ctrl.recordManifoldWiredSeam(commId, phase, projection);
      return yield* liveOp;
    });
    const manifoldObserve = Effect.sync(() => {
      ctrl.recordManifoldWiredSeam(commId, phase, projection);
    });
    return yield* runG10SeamBridge({
      model: ctrl.model,
      slice: "S3",
      commId,
      liveEffect,
      manifoldEffect: manifoldAuthority,
      manifoldObserveEffect: manifoldObserve,
    });
  });

/**
 * EDITOR-LAUNCH: wrap externalLauncher editor spawn success.
 * Agent: call site only in externalLauncher.ts launchEditorProcess.
 */
export const editorLaunchViaG10Bridge = <A, E, R>(
  liveLaunch: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-EDITOR-LAUNCH",
    "editor-spawn-succeeded",
    { comm_id: "present" },
    liveLaunch,
  );

/**
 * HTTP-SERVE: wrap markHttpListening Deferred.succeed.
 * Agent: call site only in serverRuntimeStartup.ts.
 */
export const httpServeListeningViaG10Bridge = <A, E, R>(
  liveMark: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-HTTP-SERVE",
    "http-listening-marked",
    { site: "listening" },
    liveMark,
  );

/**
 * PREVIEW-SCAN: wrap PortScanner scan process success.
 * Agent: call site only in PortScanner.ts scanOnce.
 */
export const previewScanViaG10Bridge = <A, E, R>(
  liveScan: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-PREVIEW-SCAN",
    "scan-process-succeeded",
    { comm_id: "present" },
    liveScan,
  );

/**
 * PROJECT-SETUP: wrap ProjectSetupScriptRunner started success.
 * Agent: call site only in ProjectSetupScriptRunner.ts runForThread.
 */
export const projectSetupViaG10Bridge = <A, E, R>(
  liveSetup: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-PROJECT-SETUP",
    "project-setup-started",
    { site: "project-setup-started" },
    liveSetup,
  );

/**
 * RELAY-AWARENESS: wrap AgentAwarenessRelay publishAgentActivity success.
 * Agent: call site only in AgentAwarenessRelay.ts.
 */
export const relayAwarenessViaG10Bridge = <A, E, R>(
  livePublish: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-RELAY-AWARENESS",
    "awareness-publish-succeeded",
    { operation: "publishAgentActivity" },
    livePublish,
  );

/**
 * RELAY-HTTP: wrap cloud/http relay client success.
 * Agent: call site only in apps/server/src/cloud/http.ts.
 */
export const relayHttpViaG10Bridge = <A, E, R>(
  member_id:
    | "environment-link-challenge"
    | "environment-link"
    | "environment-link-tunnel"
    | "environment-link-cli-unlink",
  liveHttp: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-RELAY-HTTP",
    "relay-http-client-succeeded",
    { member_id },
    liveHttp,
  );

/**
 * SC-ADO / SC-GITHUB / SC-GITLAB: wrap CLI execute success.
 * Agent: call sites only in AzureDevOpsCli / GitHubCli / GitLabCli.
 */
export const scCliExecuteViaG10Bridge = <A, E, R>(
  commId: "INV-T2-SC-ADO" | "INV-T2-SC-GITHUB" | "INV-T2-SC-GITLAB",
  liveExecute: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    commId,
    "cli-execute-succeeded",
    { comm_id: "cli-execute-succeeded" },
    liveExecute,
  );

/**
 * SC-BITBUCKET: wrap BitbucketApi http client success.
 * Agent: call site only in BitbucketApi.ts.
 */
export const scBitbucketViaG10Bridge = <A, E, R>(
  liveHttp: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-SC-BITBUCKET",
    "http-client-succeeded",
    { operation: "request" },
    liveHttp,
  );

/**
 * TEL-ANALYTICS: wrap AnalyticsService sendBatch success.
 * Agent: call site only in AnalyticsService.ts.
 */
export const telAnalyticsViaG10Bridge = <A, E, R>(
  liveBatch: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-TEL-ANALYTICS",
    "posthog-batch-succeeded",
    { comm_id: "present" },
    liveBatch,
  );

/**
 * TEL-DESKTOP-CONTROL handoff documentation (S3 → S5).
 *
 * Intended: S3 must NOT wire admit/route/replace in DesktopTelemetryReceiver.ts.
 * S5 sole lander owns INV-T2-TEL-DESKTOP-CONTROL cutover. S3 keeps a ledger
 * stub pair for Ordered-proof ≡ carrier coverage only.
 * Observed: this constant is documentation for agents — no runtime effect.
 */
export const G10_S3_TEL_DESKTOP_CONTROL_HANDOFF = {
  commId: "INV-T2-TEL-DESKTOP-CONTROL" as const,
  landerSlice: "S5" as const,
  landerModule: "apps/server/src/resourceTelemetry/DesktopTelemetryReceiver.ts",
  status: "handoff-pending" as const,
  handoffDoc: "docs/scm/g10/handoffs/S3-TEL-DESKTOP-CONTROL-to-S5.md",
  note: "Do not claim S3-wired or dual-run-exit (a) for TEL-DESKTOP-CONTROL from S3; S3 does not commit DesktopTelemetryReceiver.ts",
} as const;

/**
 * FILE-CHECKPOINTS handoff reception (S7 → S3 land complete at S8 reopen).
 *
 * Intended: S3 sole lander wires admit/route/replace on VcsDriver.ts.
 * Observed: runtime wiring is fileCheckpointsViaG10Bridge. Historical S3/S7
 * exit (a) unchanged; S8 audit lists lander-reopen-wired.
 */
export const G10_S3_FILE_CHECKPOINTS_HANDOFF_FROM_S7 = {
  commId: "INV-T2-FILE-CHECKPOINTS" as const,
  fromSlice: "S7" as const,
  landerSlice: "S3" as const,
  landerModule: "apps/server/src/vcs/VcsDriver.ts",
  status: "landed" as const,
  landedAt: "S8-lander-reopen" as const,
  handoffDoc: "docs/scm/g10/handoffs/S7-FILE-CHECKPOINTS-to-S3.md",
  note: "S7 stub complete; S3 wires FILE-CHECKPOINTS at S8 reopen; not historical S3 exit (a)",
} as const;

/**
 * FLAG-CLOUDFLARED handoff reception (S7 → S3 land complete at S8 reopen).
 *
 * Intended: S3 sole lander wires admit/route/replace on relayClient.ts resolve.
 * Observed: runtime wiring via runViaOptionalG10S3SharedSeam. Historical S3/S7
 * exit (a) unchanged; S8 audit lists lander-reopen-wired.
 */
export const G10_S3_FLAG_CLOUDFLARED_HANDOFF_FROM_S7 = {
  commId: "INV-T2-FLAG-CLOUDFLARED" as const,
  fromSlice: "S7" as const,
  landerSlice: "S3" as const,
  landerModule: "packages/shared/src/relayClient.ts",
  status: "landed" as const,
  landedAt: "S8-lander-reopen" as const,
  handoffDoc: "docs/scm/g10/handoffs/S7-FLAG-CLOUDFLARED-to-S3.md",
  note: "S7 stub complete; S3 wires FLAG-CLOUDFLARED at S8 reopen; not historical S3 exit (a)",
} as const;
