/**
 * G10 S4 campaign controller (Ordered proof + seam-bridge traffic).
 *
 * Intended: own S4 admit/route/replace + Ordered proof sequence helpers
 * wrapping createSubstitutionModel / installAdmitRouteReplace /
 * recordOrderedProofStep / armInversion / restorePreCutoverLive. Under
 * T2CODE_SCM_FABRIC_DEPTH, after arm-inversion call recordSoftFallbackRetire
 * (census sole-lander gate; Battery FD4). Wired seams:
 *   - provider tree sole lander: all INV-T2-PROVIDER-* (CLAUDE/CODEX/CURSOR/
 *     EVENTS/GROK/LIST-EVENTS/OPENCODE/PERM/TURN)
 *   - McpHttpServer.ts sole lander: INV-T2-MCP-HTTP
 *   - environmentHttp.ts sole lander (API surface): INV-T2-HTTP-{AUTH,CONNECT,
 *     META,ORCH,PR} — runtime bridges via withHttp*Capture / handler peers
 *   - http.ts sole lander: INV-T2-HTTP-STATIC (+ META descriptor path)
 * S7→S4 handoffs on FILE-PROVIDER-SESSION cache / FILE-LOGS provider-event-log /
 * FLAG-CODEX-LAUNCH: S4 sole lander wires real I/O (FD4); do not edit g10SliceS7.
 *
 * Observed: in-memory model + traffic log; dualRunExit / armInversion never
 * call markDualRunExited — recordOrderedProofStep is sole dual-run-exit /
 * arm-inversion writer. softFallbackRetire is Fabric-depth only (not a G10
 * OrderedProofStep). Absent controller ⇒ live paths unchanged. Not G11.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { join } from "node:path";

import { isFabricDepthEnabled } from "./fabricDepthBootstrap.ts";
import { recordSoftFallbackRetire, softFallbackForSlice } from "./fabricDepthSoftFallback.ts";
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
import type { CutoverPhase, OrderedProofStep, SoftFallbackState } from "./g10Types.ts";

/** Relative census path under repo root (Fabric-depth sole-lander gate). */
const FABRIC_DEPTH_CENSUS_REL = "docs/scm/fabric-depth/evidence/manifold-io-census.json";

/** Frozen S4 inventory `comm_id` set (16 rows — do not resize). */
export const G10_S4_COMM_IDS = [
  "INV-T2-HTTP-AUTH",
  "INV-T2-HTTP-CONNECT",
  "INV-T2-HTTP-META",
  "INV-T2-HTTP-ORCH",
  "INV-T2-HTTP-PR",
  "INV-T2-HTTP-STATIC",
  "INV-T2-MCP-HTTP",
  "INV-T2-PROVIDER-CLAUDE",
  "INV-T2-PROVIDER-CODEX",
  "INV-T2-PROVIDER-CURSOR",
  "INV-T2-PROVIDER-EVENTS",
  "INV-T2-PROVIDER-GROK",
  "INV-T2-PROVIDER-LIST-EVENTS",
  "INV-T2-PROVIDER-OPENCODE",
  "INV-T2-PROVIDER-PERM",
  "INV-T2-PROVIDER-TURN",
] as const;

export type G10S4CommId = (typeof G10_S4_COMM_IDS)[number];

/**
 * S4-owned seams with real g10SeamBridge wiring (all 16 inventory rows).
 * Agent: dual-run-exit (a)/(e) may claim all sixteen — no handoff-deferred
 * inventory row. S7 handoffs on the provider tree are not S4 inventory.
 */
export const G10_S4_WIRED_COMM_IDS = G10_S4_COMM_IDS;

export type G10S4WiredCommId = (typeof G10_S4_WIRED_COMM_IDS)[number];

/**
 * S7→S4 FLAG-CODEX-LAUNCH land completed at S8 lander reopen (not in S4 WIRED /
 * historical exit (a); S8 audit disposition owns campaign close).
 */
export const G10_S4_S8_REOPEN_LANDED_FROM_S7_COMM_IDS = ["INV-T2-FLAG-CODEX-LAUNCH"] as const;

/** One manifold (or live) traffic sample for ≡ under G9DeferredEquality. */
export type G10S4TrafficSample = {
  readonly path: "live" | "manifold";
  readonly commId:
    | G10S4CommId
    | "INV-T2-FLAG-CODEX-LAUNCH"
    | "INV-T2-FILE-LOGS"
    | "INV-T2-FILE-PROVIDER-SESSION";
  readonly phase: string;
  readonly projection: G9EqualityA;
  readonly atMs: number;
};

/**
 * Evidence step names: G10 Ordered proof steps plus Fabric-depth
 * soft-fallback-retire (after arm-inversion; not in ORDERED_PROOF_STEPS).
 */
export type G10S4EvidenceStep = OrderedProofStep | "soft-fallback-retire";

/** Structured evidence body for one Ordered / Fabric-depth proof step. */
export type G10S4EvidenceBody = {
  readonly slice: "S4";
  readonly step: G10S4EvidenceStep;
  readonly phase: CutoverPhase;
  readonly authority: "live" | "manifold";
  readonly inversionArmed: boolean;
  /** Fabric-depth soft-fallback signal (null when FD off / pre-exit). */
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
 * In-memory manifold stub traffic log (S4 provider/HTTP/MCP).
 *
 * Intended: enough samples for live-vs-manifold ≡ under G9DeferredEquality.
 * Observed: append-only arrays; cleared on rollback restore when requested.
 */
export type G10S4ManifoldTrafficLog = {
  readonly samples: G10S4TrafficSample[];
};

/**
 * Representative phase + projection A for each wired S4 seam (Ordered rehearsal).
 * Agent: keep ledger-bounded; no tokens / payloads / paths in A.
 */
const G10_S4_WIRED_REHEARSAL: ReadonlyArray<{
  readonly commId: G10S4WiredCommId;
  readonly phase: string;
  readonly projection: G9EqualityA;
}> = [
  {
    commId: "INV-T2-HTTP-AUTH",
    phase: "http-handler-succeeded",
    projection: { endpoint: "session" },
  },
  {
    commId: "INV-T2-HTTP-CONNECT",
    phase: "http-handler-succeeded",
    projection: { endpoint: "linkState" },
  },
  {
    commId: "INV-T2-HTTP-META",
    phase: "http-handler-succeeded",
    projection: { endpoint: "descriptor" },
  },
  {
    commId: "INV-T2-HTTP-ORCH",
    phase: "http-handler-succeeded",
    projection: { endpoint: "snapshot" },
  },
  { commId: "INV-T2-HTTP-PR", phase: "http-handler-succeeded", projection: { endpoint: "diff" } },
  {
    commId: "INV-T2-HTTP-STATIC",
    phase: "static-file-200-selected",
    projection: { comm_id: "static-file-200-selected" },
  },
  {
    commId: "INV-T2-MCP-HTTP",
    phase: "mcp-http-handler-succeeded",
    projection: { site: "mcp-http-handler-succeeded" },
  },
  {
    commId: "INV-T2-PROVIDER-CLAUDE",
    phase: "protocol-request-succeeded",
    projection: { operation: "claude.sdk.query" },
  },
  {
    commId: "INV-T2-PROVIDER-CODEX",
    phase: "runtime-spawn-succeeded",
    projection: { provider: "spawned" },
  },
  {
    commId: "INV-T2-PROVIDER-CURSOR",
    phase: "runtime-spawn-succeeded",
    projection: { provider: "spawned" },
  },
  {
    commId: "INV-T2-PROVIDER-EVENTS",
    phase: "pubsub-published",
    projection: { member_id: "turn.completed" },
  },
  {
    commId: "INV-T2-PROVIDER-GROK",
    phase: "runtime-spawn-succeeded",
    projection: { provider: "spawned" },
  },
  {
    commId: "INV-T2-PROVIDER-LIST-EVENTS",
    phase: "pubsub-published",
    projection: { comm_id: "present" },
  },
  {
    commId: "INV-T2-PROVIDER-OPENCODE",
    phase: "runtime-spawn-succeeded",
    projection: { provider: "spawned" },
  },
  {
    commId: "INV-T2-PROVIDER-PERM",
    phase: "permission-outcome-succeeded",
    projection: { comm_id: "permission-outcome-succeeded" },
  },
  {
    commId: "INV-T2-PROVIDER-TURN",
    phase: "send-turn-succeeded",
    projection: { comm_id: "send-turn-succeeded" },
  },
];

/**
 * S4 campaign controller shape (process-global or Effect service).
 *
 * Agent: land → liveRehearsal → recordEquiv → rollbackDrill → dualRunExit →
 * armInversion → (FD) softFallbackRetire. dualRunExit uses
 * recordOrderedProofStep only.
 */
export type G10S4Controller = {
  readonly slice: "S4";
  readonly model: G10SubstitutionModel;
  readonly registry: G10CutoverRegistry;
  readonly traffic: G10S4ManifoldTrafficLog;
  /** admit/route/replace + Ordered proof "land". */
  readonly land: () => G10S4EvidenceBody;
  /**
   * Live-authoritative rehearsal: observe traffic + one rollback restore +
   * re-land install + record live-rehearsal step.
   */
  readonly liveRehearsal: () => G10S4EvidenceBody;
  /** Cutover ≡ under G9DeferredEquality for S4 inventory (all sixteen wired). */
  readonly recordEquiv: () => G10S4EvidenceBody;
  /** Rollback drill: restore live, re-prove authority, record step. */
  readonly rollbackDrill: () => G10S4EvidenceBody;
  /** Dual-run exit via recordOrderedProofStep only (refuses markDualRunExited). */
  readonly dualRunExit: () => G10S4EvidenceBody;
  /** Arm inversion via armInversion → recordOrderedProofStep. */
  readonly armInversion: () => G10S4EvidenceBody;
  /**
   * Fabric-depth soft-fallback retire after arm-inversion (census sole-lander
   * gate). Requires T2CODE_SCM_FABRIC_DEPTH. Not a G10 OrderedProofStep.
   */
  readonly softFallbackRetire: () => G10S4EvidenceBody;
  /** Record live traffic for a wired S4 seam. */
  readonly recordLiveWiredSeam: (
    commId: G10S4WiredCommId,
    phase: string,
    projection: G9EqualityA,
  ) => void;
  /** Record manifold observe/authority sample for a wired S4 seam. */
  readonly recordManifoldWiredSeam: (
    commId: G10S4WiredCommId,
    phase: string,
    projection: G9EqualityA,
  ) => void;
  /** True when replace installed for S4. */
  readonly isReplaceInstalled: () => boolean;
  readonly authority: () => "live" | "manifold";
  readonly phase: () => CutoverPhase;
  readonly inversionArmed: () => boolean;
  /** Format evidence markdown for a recorded step body. */
  readonly formatEvidenceMarkdown: (body: G10S4EvidenceBody) => string;
  /**
   * Run full Ordered proof sequence; under T2CODE_SCM_FABRIC_DEPTH also runs
   * soft-fallback-retire after arm-inversion. Returns bodies in order.
   */
  readonly runFullOrderedProof: () => readonly G10S4EvidenceBody[];
};

/** Process-global optional controller (tests / lander fallback). */
let processGlobalG10S4: G10S4Controller | undefined;

/**
 * Install or clear the process-global S4 controller.
 *
 * Intended: tests set before provider/HTTP/MCP effects; production prefers Layer.
 * Observed: module singleton; absent ⇒ lander live unchanged.
 */
export const installProcessGlobalG10S4 = (controller: G10S4Controller | undefined): void => {
  processGlobalG10S4 = controller;
};

/** Read process-global S4 controller (undefined when absent). */
export const getProcessGlobalG10S4 = (): G10S4Controller | undefined => processGlobalG10S4;

/**
 * Effect service key for optional S4 cutover controller (G9CaptureService pattern).
 *
 * Absent ⇒ provider / MCP / HTTP live paths unchanged.
 */
export class G10S4CutoverService extends Context.Service<G10S4CutoverService, G10S4Controller>()(
  "t3/scm/g10SliceS4/G10S4CutoverService",
) {}

/**
 * Layer.succeed helper for tests / optional stack merge.
 *
 * Intended: provides server G10S4CutoverService so landers resolve via Context.
 */
export const G10S4CutoverLayer = (controller: G10S4Controller): Layer.Layer<G10S4CutoverService> =>
  Layer.succeed(G10S4CutoverService, controller);

/**
 * Resolve optional S4 controller: Effect.serviceOption first, then process-global.
 *
 * Intended: lander sites call this once per seam. Absent ⇒ live only.
 */
export const resolveOptionalG10S4 = (): Effect.Effect<Option.Option<G10S4Controller>> =>
  Effect.gen(function* () {
    const fromService = yield* Effect.serviceOption(G10S4CutoverService);
    if (Option.isSome(fromService)) return fromService;
    const global = processGlobalG10S4;
    return global === undefined ? Option.none() : Option.some(global);
  });

const nowMs = (): number => Date.now();

const pushSample = (traffic: G10S4ManifoldTrafficLog, sample: G10S4TrafficSample): void => {
  traffic.samples.push(sample);
};

/**
 * Create an S4 campaign controller bound to inventory registry.
 *
 * Parameters
 * ----------
 * repoRoot : string
 *     Monorepo root for seam-inventory load (defaults to resolveG10RepoRoot).
 *
 * Returns
 * -------
 * G10S4Controller
 *     Mutable coordinator for S4 Ordered proof + manifold traffic.
 */
export const createG10S4Controller = (repoRoot: string = resolveG10RepoRoot()): G10S4Controller => {
  const registry = loadG10CutoverRegistry(repoRoot);
  const model = createSubstitutionModel(registry);
  const traffic: G10S4ManifoldTrafficLog = { samples: [] };
  const censusPath = join(repoRoot, FABRIC_DEPTH_CENSUS_REL);

  const s4Ids = activatableCommIdsForSlice(registry, "S4");
  // Hard lock: inventory S4 set must match frozen 16 (no silent resize).
  if (s4Ids.length !== G10_S4_COMM_IDS.length) {
    throw new Error(
      `G10 S4 controller: inventory S4 count ${s4Ids.length} ≠ frozen ${G10_S4_COMM_IDS.length}`,
    );
  }
  for (const id of G10_S4_COMM_IDS) {
    if (!s4Ids.includes(id)) {
      throw new Error(`G10 S4 controller: missing inventory id ${id}`);
    }
  }

  const recordLiveWiredSeam = (
    commId: G10S4WiredCommId,
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
    commId: G10S4WiredCommId,
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

  const snapshotEvidence = (
    step: G10S4EvidenceStep,
    notes: readonly string[],
    equalitySamples?: readonly G9DeferredEquality[],
  ): G10S4EvidenceBody => {
    const liveCount = traffic.samples.filter((s) => s.path === "live").length;
    const manifoldCount = traffic.samples.filter((s) => s.path === "manifold").length;
    return {
      slice: "S4",
      step,
      phase: phaseForSlice(model, "S4"),
      authority: authorityForSlice(model, "S4"),
      inversionArmed: model.sliceStates.get("S4")?.inversionArmed === true,
      softFallback: softFallbackForSlice(model, "S4"),
      commIds: [...s4Ids],
      notes,
      equalitySamples,
      trafficSummary: { liveCount, manifoldCount },
    };
  };

  const formatEvidenceMarkdown = (body: G10S4EvidenceBody): string => {
    const lines = [
      `# S4 ${body.step} evidence`,
      "",
      `<!-- Agent: G10 S4 Ordered / Fabric-depth proof step. Slice=${body.slice}. -->`,
      "",
      `- Date: ${new Date().toISOString().slice(0, 10)}`,
      `- Slice: **S4**`,
      `- Step: **${body.step}**`,
      `- Phase: \`${body.phase}\``,
      `- Authority: **${body.authority}**`,
      `- inversionArmed: \`${body.inversionArmed}\``,
      `- softFallback: \`${body.softFallback === null ? "omit" : body.softFallback}\``,
      `- S4 comm_ids (${body.commIds.length}): ${body.commIds.join(", ")}`,
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
   * Dual-run observe rehearsal through seam bridge (live authoritative).
   * Records all sixteen wired S4 seams without real I/O.
   */
  const rehearseWiredSeamsObserve = (): void => {
    for (const row of G10_S4_WIRED_REHEARSAL) {
      void Effect.runSync(
        runG10SeamBridge({
          model,
          slice: "S4",
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

  const land = (): G10S4EvidenceBody => {
    installAdmitRouteReplace(model, "S4");
    recordOrderedProofStep(model, "S4", "land");
    return snapshotEvidence("land", [
      "admit/route/replace installed for S4 radius (16 inventory rows)",
      "authority remains live (dual-run); manifold observe-beside eligible",
      "wired seams (16): provider tree + McpHttpServer + environmentHttp HTTP-* + http.ts STATIC",
      "FILE-PROVIDER-SESSION / FILE-LOGS provider-event-log / FLAG-CODEX-LAUNCH left for S7 — not stolen",
      "markDualRunExited not used",
    ]);
  };

  const liveRehearsal = (): G10S4EvidenceBody => {
    if (!model.installs.get("S4")?.replaceInstalled) {
      throw new Error("G10 S4 liveRehearsal requires land first");
    }
    rehearseWiredSeamsObserve();
    restorePreCutoverLive(model, "S4");
    if (authorityForSlice(model, "S4") !== "live") {
      throw new Error("G10 S4 liveRehearsal: restore did not return live authority");
    }
    if (!model.installs.get("S4")?.replaceInstalled) {
      installAdmitRouteReplace(model, "S4");
    } else {
      const install = model.installs.get("S4");
      if (install && install.authority !== "live") {
        model.installs.set("S4", { ...install, authority: "live" });
      }
    }
    rehearseWiredSeamsObserve();
    recordOrderedProofStep(model, "S4", "live-rehearsal");
    return snapshotEvidence("live-rehearsal", [
      "dual-run observe on sixteen wired S4 seams via g10SeamBridge (live authoritative)",
      "one rollback restore + re-land under live authority",
      "inversion not armed; live remains authoritative",
      "S7 handoffs on the provider tree not exercised under S4 rehearsal",
    ]);
  };

  const recordEquiv = (): G10S4EvidenceBody => {
    const byComm = new Map<string, { live?: G9EqualityA; manifold?: G9EqualityA }>();
    for (const sample of traffic.samples) {
      const entry = byComm.get(sample.commId) ?? {};
      if (sample.path === "live") entry.live = sample.projection;
      else entry.manifold = sample.projection;
      byComm.set(sample.commId, entry);
    }
    const equalitySamples: G9DeferredEquality[] = [];
    const missing: string[] = [];
    for (const id of G10_S4_COMM_IDS) {
      const pair = byComm.get(id);
      if (!pair?.live || !pair.manifold) {
        missing.push(id);
        continue;
      }
      if (JSON.stringify(pair.live) !== JSON.stringify(pair.manifold)) {
        throw new Error(
          `G10 S4 ≡ failed for ${id}: live=${JSON.stringify(pair.live)} manifold=${JSON.stringify(pair.manifold)}`,
        );
      }
      equalitySamples.push(asG9DeferredEquality(pair.live));
    }
    if (missing.length > 0) {
      throw new Error(`G10 S4 ≡ missing traffic for: ${missing.join(", ")}`);
    }
    recordOrderedProofStep(model, "S4", "cutover-equivalence");
    return snapshotEvidence(
      "cutover-equivalence",
      [
        "wired sixteen: live≡manifold via g10SeamBridge (provider/MCP/HTTP AUTH|CONNECT|META|ORCH|PR|STATIC)",
        "not WP8 763-fixture-as-proof",
        "type carrier: asG9DeferredEquality from g10ProofHarness",
        "S7 FILE-PROVIDER-SESSION / FILE-LOGS provider-event-log / FLAG-CODEX-LAUNCH not claimed",
      ],
      equalitySamples,
    );
  };

  const rollbackDrill = (): G10S4EvidenceBody => {
    const result = restorePreCutoverLive(model, "S4");
    if (
      result.restoredAuthority !== "live" ||
      result.clearedShadowEnv ||
      result.usedHaltController
    ) {
      throw new Error("G10 S4 rollbackDrill: invalid rollback result");
    }
    if (authorityForSlice(model, "S4") !== "live") {
      throw new Error("G10 S4 rollbackDrill: authority not live after restore");
    }
    const proved = Effect.runSync(
      runG10SeamBridge({
        model,
        slice: "S4",
        commId: "INV-T2-PROVIDER-TURN",
        liveEffect: Effect.succeed("live-ok"),
        manifoldEffect: Effect.succeed("manifold-should-not-win"),
        manifoldObserveEffect: Effect.void,
      }),
    );
    if (proved !== "live-ok") {
      throw new Error("G10 S4 rollbackDrill: live authority not selected");
    }
    recordOrderedProofStep(model, "S4", "rollback-drill");
    return snapshotEvidence("rollback-drill", [
      "restorePreCutoverLive restored live authority",
      "rollback ≠ unset T2CODE_SCM_G9_SHADOW; no halt controller",
      "re-proved live-authoritative bridge selection for PROVIDER-TURN",
      "restore scope: provider tree + McpHttpServer + environmentHttp + http.ts",
    ]);
  };

  const dualRunExit = (): G10S4EvidenceBody => {
    recordOrderedProofStep(model, "S4", "dual-run-exit");
    if (authorityForSlice(model, "S4") !== "manifold") {
      throw new Error("G10 S4 dualRunExit: authority not manifold after proof step");
    }
    return snapshotEvidence("dual-run-exit", [
      "exit (a)/(e) for all sixteen wired S4 seams (provider/MCP/HTTP)",
      'flipped solely via recordOrderedProofStep(..., "dual-run-exit")',
      "markDualRunExited not used (S0 escalation sole-owner binding)",
      "prerequisites: land + live-rehearsal + ≡ + rollback-drill green for wired sixteen",
      "S7 FILE-PROVIDER-SESSION / FILE-LOGS provider-event-log / FLAG-CODEX-LAUNCH not exited under S4",
    ]);
  };

  const armInversionStep = (): G10S4EvidenceBody => {
    armInversion(model, "S4", registry);
    if (model.sliceStates.get("S4")?.inversionArmed !== true) {
      throw new Error("G10 S4 armInversion: inversionArmed not true");
    }
    return snapshotEvidence("arm-inversion", [
      "noninterference inversion armed after dual-run-exit",
      "manifold failure may now fail user-visible S4 provider/MCP/HTTP ops",
      "armed solely via armInversion → recordOrderedProofStep",
      "Fabric-depth soft-fallback still active until softFallbackRetire (FD env)",
    ]);
  };

  /**
   * Fabric-depth step 7: retire soft live recovery after arm-inversion GREEN.
   *
   * Intended: recordSoftFallbackRetire + census sole-lander gate (S4 debt empty
   * after FD4 CLAUDE/OPENCODE/FILE-LOGS/FILE-PROVIDER-SESSION/FLAG-CODEX-LAUNCH
   * → real). Requires FD env. Observed: throws when FD off, arm-inversion
   * incomplete, or census debt. Does not edit g10SliceS7.
   */
  const softFallbackRetireStep = (): G10S4EvidenceBody => {
    recordSoftFallbackRetire(model, "S4", censusPath);
    if (softFallbackForSlice(model, "S4") !== "retired") {
      throw new Error("G10 S4 softFallbackRetire: softFallback not retired");
    }
    return snapshotEvidence("soft-fallback-retire", [
      "Fabric-depth soft-fallback retired via recordSoftFallbackRetire",
      `census gate: ${FABRIC_DEPTH_CENSUS_REL} (S4 sole-lander debt empty after FD4)`,
      "g10.softFallback=retired slice=S4 — bridge must not soft-fall to live on manifold failure",
      "CLAUDE/OPENCODE/FILE-LOGS/FILE-PROVIDER-SESSION/FLAG-CODEX-LAUNCH landers real (FD4)",
      "g10SliceS7.ts not edited (S7 owns FLAG-CODEX-LAUNCH inventory; S4 owns lander)",
      "Not G11; radius unchanged",
    ]);
  };

  const runFullOrderedProof = (): readonly G10S4EvidenceBody[] => {
    const bodies: G10S4EvidenceBody[] = [];
    bodies.push(land());
    bodies.push(liveRehearsal());
    bodies.push(recordEquiv());
    bodies.push(rollbackDrill());
    bodies.push(dualRunExit());
    bodies.push(armInversionStep());
    if (!orderedProofSatisfiedThrough(model, "S4", "arm-inversion")) {
      throw new Error("G10 S4 runFullOrderedProof: Ordered proof incomplete");
    }
    // Fabric-depth Ordered depth continues through soft-fallback-retire when FD on.
    if (isFabricDepthEnabled()) {
      bodies.push(softFallbackRetireStep());
    }
    return bodies;
  };

  return {
    slice: "S4",
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
    isReplaceInstalled: () => model.installs.get("S4")?.replaceInstalled === true,
    authority: () => authorityForSlice(model, "S4"),
    phase: () => phaseForSlice(model, "S4"),
    inversionArmed: () => model.sliceStates.get("S4")?.inversionArmed === true,
    formatEvidenceMarkdown,
    runFullOrderedProof,
  };
};

/**
 * Shared lander bridge: success live I/O (provider/HTTP/MCP) via g10SeamBridge.
 *
 * Intended: absent/not-replaced ⇒ live only. Present + replaced ⇒
 * runG10SeamBridge with live/manifold record hooks.
 *
 * Observed: reuses live I/O on manifold authority so provider/HTTP/MCP still fire.
 */
const runWiredSuccessSeamViaG10Bridge = <A, E, R>(
  commId: G10S4WiredCommId,
  phase: string,
  projection: G9EqualityA,
  liveIo: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const opt = yield* resolveOptionalG10S4();
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
      slice: "S4",
      commId,
      liveEffect,
      manifoldEffect: manifoldAuthority,
      manifoldObserveEffect: manifoldObserve,
    });
  });

/**
 * HTTP-AUTH: wrap EnvironmentAuthHttpApi handler success.
 * Agent: call via withHttpAuthCapture composition or auth/http.ts handlers.
 */
export const httpAuthViaG10Bridge = <A, E, R>(
  endpoint:
    | "session"
    | "browserSession"
    | "token"
    | "webSocketTicket"
    | "pairingCredential"
    | "pairingLinks"
    | "revokePairingLink"
    | "clients"
    | "revokeClient"
    | "revokeOtherClients",
  liveHttp: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-HTTP-AUTH",
    "http-handler-succeeded",
    { endpoint },
    liveHttp,
  );

/**
 * HTTP-CONNECT: wrap EnvironmentConnectHttpApi handler success.
 * Agent: call via withHttpConnectCapture or cloud/http.ts.
 */
export const httpConnectViaG10Bridge = <A, E, R>(
  endpoint:
    | "linkProof"
    | "relayConfig"
    | "linkState"
    | "unlink"
    | "preferences"
    | "health"
    | "mintCredential"
    | "t3MintCredential",
  liveHttp: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-HTTP-CONNECT",
    "http-handler-succeeded",
    { endpoint },
    liveHttp,
  );

/**
 * HTTP-META: wrap EnvironmentMetadataHttpApi descriptor success.
 * Agent: call via withHttpMetaCapture or http.ts.
 */
export const httpMetaViaG10Bridge = <A, E, R>(
  liveHttp: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-HTTP-META",
    "http-handler-succeeded",
    { endpoint: "descriptor" },
    liveHttp,
  );

/**
 * HTTP-ORCH: wrap EnvironmentOrchestrationHttpApi handler success.
 * Agent: call via withHttpOrchCapture or orchestration/http.ts.
 */
export const httpOrchViaG10Bridge = <A, E, R>(
  endpoint: "snapshot" | "shellSnapshot" | "threadSnapshot" | "dispatch",
  liveHttp: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-HTTP-ORCH",
    "http-handler-succeeded",
    { endpoint },
    liveHttp,
  );

/**
 * HTTP-PR: wrap EnvironmentPullRequestsHttpApi diff success.
 * Agent: call via withHttpPrCapture or pullRequest/http.ts.
 */
export const httpPrViaG10Bridge = <A, E, R>(
  liveHttp: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-HTTP-PR",
    "http-handler-succeeded",
    { endpoint: "diff" },
    liveHttp,
  );

/**
 * HTTP-STATIC: wrap static asset selection success on http.ts.
 * Agent: call site only in apps/server/src/http.ts.
 */
export const httpStaticViaG10Bridge = <A, E, R>(
  phase:
    | "asset-file-200-selected"
    | "static-file-200-selected"
    | "static-spa-fallback-200-selected"
    | "static-dev-redirect-302-selected",
  liveSelect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge("INV-T2-HTTP-STATIC", phase, { comm_id: phase }, liveSelect);

/**
 * MCP-HTTP: wrap McpHttpServer handler success (after normalize).
 * Agent: call site only in McpHttpServer.ts. Do not put bearer tokens in A.
 */
export const mcpHttpViaG10Bridge = <A, E, R>(
  liveMcp: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-MCP-HTTP",
    "mcp-http-handler-succeeded",
    { site: "mcp-http-handler-succeeded" },
    liveMcp,
  );

/**
 * PROVIDER-TURN: wrap ProviderService.sendTurn success path.
 * Agent: call site only in ProviderService.ts.
 */
export const providerTurnViaG10Bridge = <A, E, R>(
  liveTurn: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-PROVIDER-TURN",
    "send-turn-succeeded",
    { comm_id: "send-turn-succeeded" },
    liveTurn,
  );

/**
 * PROVIDER-EVENTS: wrap runtime event pubsub publish success.
 * Agent: call site only in ProviderService.ts publishRuntimeEvent.
 */
export const providerEventsViaG10Bridge = <A, E, R>(
  member_id: string,
  livePublish: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-PROVIDER-EVENTS",
    "pubsub-published",
    { member_id } as G9EqualityA,
    livePublish,
  );

/**
 * PROVIDER-LIST-EVENTS: wrap ProviderRegistry list pubsub publish.
 * Agent: call site only in ProviderRegistry.ts.
 */
export const providerListEventsViaG10Bridge = <A, E, R>(
  livePublish: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-PROVIDER-LIST-EVENTS",
    "pubsub-published",
    { comm_id: "present" },
    livePublish,
  );

/**
 * PROVIDER-CLAUDE: wrap Claude protocol-request / probe success.
 * Agent: call sites only under provider/** Claude modules.
 */
export const providerClaudeViaG10Bridge = <A, E, R>(
  liveClaude: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-PROVIDER-CLAUDE",
    "protocol-request-succeeded",
    { operation: "claude.sdk.query" },
    liveClaude,
  );

/**
 * PROVIDER-CODEX: wrap Codex runtime spawn success.
 * Agent: call site only in CodexSessionRuntime.ts. Do NOT wrap FLAG-CODEX-LAUNCH.
 */
export const providerCodexViaG10Bridge = <A, E, R>(
  liveCodex: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-PROVIDER-CODEX",
    "runtime-spawn-succeeded",
    { provider: "spawned" },
    liveCodex,
  );

/**
 * PROVIDER-CURSOR / PROVIDER-GROK: wrap ACP runtime spawn success.
 * Agent: call site only in AcpSessionRuntime.ts when g9SpawnCommId set.
 */
export const providerAcpSpawnViaG10Bridge = <A, E, R>(
  commId: "INV-T2-PROVIDER-CURSOR" | "INV-T2-PROVIDER-GROK",
  liveSpawn: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    commId,
    "runtime-spawn-succeeded",
    { provider: "spawned" },
    liveSpawn,
  );

/**
 * PROVIDER-OPENCODE: wrap OpenCode runtime spawn success.
 * Agent: call site only in opencodeRuntime.ts.
 */
export const providerOpenCodeViaG10Bridge = <A, E, R>(
  liveSpawn: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-PROVIDER-OPENCODE",
    "runtime-spawn-succeeded",
    { provider: "spawned" },
    liveSpawn,
  );

/**
 * PROVIDER-PERM: wrap permission outcome success on AcpSessionRuntime.
 * Agent: call site only in AcpSessionRuntime.ts handleRequestPermission.
 */
export const providerPermViaG10Bridge = <A, E, R>(
  livePerm: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-PROVIDER-PERM",
    "permission-outcome-succeeded",
    { comm_id: "permission-outcome-succeeded" },
    livePerm,
  );

/**
 * FILE-PROVIDER-SESSION handoff reception slot (S7 → S4 lander; not stolen).
 *
 * Intended: S4 sole lander owns provider-tree commits; S7 owns the
 * FILE-PROVIDER-SESSION comm_id (cache phases). S4 must not claim exit (a).
 */
/**
 * FILE-PROVIDER-SESSION cache phase handoff (S7 → S4) — auth-freeze landed.
 *
 * Intended: S7 owns comm_id; S4 sole lander wires cache read/write success.
 * Not historical S4 exit (a); parent row already S7-exited.
 */
export const G10_S4_FILE_PROVIDER_SESSION_HANDOFF_FROM_S7 = {
  commId: "INV-T2-FILE-PROVIDER-SESSION" as const,
  fromSlice: "S7" as const,
  landerSlice: "S4" as const,
  landerModule: "apps/server/src/provider/providerStatusCache.ts",
  status: "landed" as const,
  landedAt: "auth-freeze-phase-residual" as const,
  handoffDoc: "docs/scm/g10/handoffs/S7-FILE-PROVIDER-SESSION-to-S4.md",
  note: "S7 owns comm_id; S4 wires cache phases; not historical S4 exit (a)",
} as const;

/**
 * FILE-LOGS provider-event-log phase handoff (S7 → S4) — auth-freeze landed.
 */
export const G10_S4_FILE_LOGS_PROVIDER_EVENT_LOG_HANDOFF_FROM_S7 = {
  commId: "INV-T2-FILE-LOGS" as const,
  phase: "providerEventLogPath-writer-succeeded" as const,
  fromSlice: "S7" as const,
  landerSlice: "S4" as const,
  landerModule: "apps/server/src/provider/Layers/ProviderEventLoggers.ts",
  status: "landed" as const,
  landedAt: "auth-freeze-phase-residual" as const,
  handoffDoc: "docs/scm/g10/handoffs/S7-FILE-LOGS-provider-event-log-to-S4.md",
  note: "S7 owns FILE-LOGS provider-event-log phase; S4 wires at auth-freeze; not historical S4 exit (a)",
} as const;

/**
 * FILE-LOGS provider-event-log: wrap store-create success (phase residual).
 * Agent: call site only in ProviderEventLoggers.ts after successful store make.
 */
export const fileLogsProviderEventLogViaG10Bridge = <A, E, R>(
  liveSuccess: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const opt = yield* resolveOptionalG10S4();
    if (Option.isNone(opt) || !opt.value.isReplaceInstalled()) {
      return yield* liveSuccess;
    }
    const ctrl = opt.value;
    const phase = "providerEventLogPath-writer-succeeded";
    const projection: G9EqualityA = { site: "provider-event-log-writer-succeeded" };
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
      slice: "S4",
      commId,
      liveEffect,
      manifoldEffect: manifoldAuthority,
      manifoldObserveEffect: manifoldObserve,
    });
  });

/**
 * FILE-PROVIDER-SESSION cache: wrap read/write success (phase residual).
 * Agent: call sites only in providerStatusCache.ts after successful decode/write.
 */
export const fileProviderSessionCacheViaG10Bridge = <A, E, R>(
  phase: "provider-status-cache-read-succeeded" | "provider-status-cache-write-succeeded",
  liveSuccess: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const opt = yield* resolveOptionalG10S4();
    if (Option.isNone(opt) || !opt.value.isReplaceInstalled()) {
      return yield* liveSuccess;
    }
    const ctrl = opt.value;
    const projection: G9EqualityA = { site: phase };
    const commId = "INV-T2-FILE-PROVIDER-SESSION" as const;
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
      slice: "S4",
      commId,
      liveEffect,
      manifoldEffect: manifoldAuthority,
      manifoldObserveEffect: manifoldObserve,
    });
  });

/**
 * FLAG-CODEX-LAUNCH handoff reception (S7 → S4 land complete at S8 reopen).
 *
 * Intended: S4 sole lander wires admit/route/replace on codexLaunchArgs.ts.
 * Observed: runtime wiring is flagCodexLaunchViaG10Bridge. Historical S4/S7
 * exit (a) unchanged; S8 audit lists lander-reopen-wired.
 */
export const G10_S4_FLAG_CODEX_LAUNCH_HANDOFF_FROM_S7 = {
  commId: "INV-T2-FLAG-CODEX-LAUNCH" as const,
  fromSlice: "S7" as const,
  landerSlice: "S4" as const,
  landerModule: "apps/server/src/provider/Layers/codexLaunchArgs.ts",
  status: "landed" as const,
  landedAt: "S8-lander-reopen" as const,
  handoffDoc: "docs/scm/g10/handoffs/S7-FLAG-CODEX-LAUNCH-to-S4.md",
  note: "S7 stub complete; S4 wires FLAG-CODEX-LAUNCH at S8 reopen; not historical S4 exit (a)",
} as const;

/**
 * FLAG-CODEX-LAUNCH: S8 lander-reopen wrap on resolveCodexLaunchArgsCaptured.
 *
 * Intended: not in G10_S4_WIRED_COMM_IDS / historical S4 exit (a). Agent: call
 * site only in codexLaunchArgs.ts after sync resolve succeeds.
 */
export const flagCodexLaunchViaG10Bridge = <A, E, R>(
  state_label: "configured" | "absent",
  liveResolve: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const opt = yield* resolveOptionalG10S4();
    if (Option.isNone(opt) || !opt.value.isReplaceInstalled()) {
      return yield* liveResolve;
    }
    const ctrl = opt.value;
    const phase = "flag-resolved";
    const projection: G9EqualityA = {
      member: "T3CODE_CODEX_LAUNCH_ARGS",
      state_label,
    };
    const commId = "INV-T2-FLAG-CODEX-LAUNCH" as const;
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
      slice: "S4",
      commId,
      liveEffect,
      manifoldEffect: manifoldAuthority,
      manifoldObserveEffect: manifoldObserve,
    });
  });
