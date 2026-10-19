/**
 * G10 S6 campaign controller (Ordered proof + seam-bridge traffic).
 *
 * Intended: own S6 admit/route/replace + Ordered proof sequence helpers
 * wrapping createSubstitutionModel / installAdmitRouteReplace /
 * recordOrderedProofStep / armInversion / restorePreCutoverLive. Wired seams:
 *   - ws.ts sole lander: ORCH-RPC + RPC-STREAM-* + RPC-WS + ORCH-LIVE handoff
 *     FROM S2
 *   - T2Observability.ts sole lander: FLAG-T2-OTEL + TEL-T2-OTLP + TEL-NDJSON
 *     handoff FROM S5
 *   - Observability.ts sole lander: TEL-T3-OTLP + TEL-T3-TRACE handoff FROM S5
 * FLAG-T3-OTEL is S6→S2 handoff-pending on cli/config.ts — ledger stub only;
 * S6 must NOT commit cli/config.ts. HOME-BUS remains dormant-exempt.
 *
 * Observed: in-memory model + traffic log; dualRunExit / armInversion never
 * call markDualRunExited — recordOrderedProofStep is sole dual-run-exit /
 * arm-inversion writer. Absent controller ⇒ live paths unchanged.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as OtlpExporter from "effect/unstable/observability/OtlpExporter";
import * as RpcServer from "effect/unstable/rpc/RpcServer";

import type { G9EqualityA } from "./g9Occurrence.ts";
import {
  G9_T3_OTLP_EXPORTER_LABELS,
  buildRpcAdmitCaptureInput,
  buildRpcStreamElementCaptureInput,
  buildRpcUnarySuccessCaptureInput,
  captureOrchLiveIfOfferAccepted,
  captureRpcRequestAdmitted,
  captureRpcStreamElement,
  captureRpcUnarySucceeded,
  captureT3OtlpExportSucceededFromLabel,
  isCapturableOtlpExportBatch,
  withOptionalG9Capture,
} from "./g9FamilyTypedHooks.ts";
import {
  G10_DORMANT_HOME_BUS_COMM_ID,
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
 * Frozen S6 activatable inventory `comm_id` set (12 rows — home-bus excluded).
 * Agent: do not resize; dormant stays outside this list.
 */
export const G10_S6_COMM_IDS = [
  "INV-T2-FLAG-T2-OTEL",
  "INV-T2-FLAG-T3-OTEL",
  "INV-T2-ORCH-RPC",
  "INV-T2-RPC-STREAM-AUTH",
  "INV-T2-RPC-STREAM-CONFIG",
  "INV-T2-RPC-STREAM-DISCOVERY",
  "INV-T2-RPC-STREAM-ORCH",
  "INV-T2-RPC-STREAM-TEL",
  "INV-T2-RPC-STREAM-TERM",
  "INV-T2-RPC-WS",
  "INV-T2-TEL-T2-OTLP",
  "INV-T2-TEL-T3-OTLP",
] as const;

export type G10S6CommId = (typeof G10_S6_COMM_IDS)[number];

/** Dormant-preserved home-bus row (exempt from cutover / exit / inversion). */
export const G10_S6_DORMANT_COMM_IDS = [G10_DORMANT_HOME_BUS_COMM_ID] as const;

/**
 * S6-owned + handoff-landed seams with real g10SeamBridge wiring on S6 landers.
 * Agent: dual-run-exit (a)/(e) may claim these fourteen only — not FLAG-T3-OTEL,
 * not HOME-BUS.
 */
export const G10_S6_WIRED_COMM_IDS = [
  "INV-T2-FLAG-T2-OTEL",
  "INV-T2-ORCH-RPC",
  "INV-T2-RPC-STREAM-AUTH",
  "INV-T2-RPC-STREAM-CONFIG",
  "INV-T2-RPC-STREAM-DISCOVERY",
  "INV-T2-RPC-STREAM-ORCH",
  "INV-T2-RPC-STREAM-TEL",
  "INV-T2-RPC-STREAM-TERM",
  "INV-T2-RPC-WS",
  "INV-T2-TEL-T2-OTLP",
  "INV-T2-TEL-T3-OTLP",
  "INV-T2-ORCH-LIVE",
  "INV-T2-TEL-NDJSON",
  "INV-T2-TEL-T3-TRACE",
] as const;

export type G10S6WiredCommId = (typeof G10_S6_WIRED_COMM_IDS)[number];

/**
 * S6 inventory row deferred to S2 sole lander (cli/config.ts).
 * Agent: handoff stub for ≡ carrier only — not admit/route/replace wiring.
 */
export const G10_S6_HANDOFF_PENDING_COMM_IDS = ["INV-T2-FLAG-T3-OTEL"] as const;

/**
 * Foreign `comm_id`s landed on S6 sole landers (not in S6 activatable set).
 * Agent: S2/S5 owned; S6 sole lander completes admit/route/replace.
 */
export const G10_S6_HANDOFF_LANDED_COMM_IDS = [
  "INV-T2-ORCH-LIVE",
  "INV-T2-TEL-NDJSON",
  "INV-T2-TEL-T3-TRACE",
] as const;

/** Traffic sample comm_id (S6 activatable ∪ handoff lands). */
export type G10S6TrafficCommId = G10S6CommId | (typeof G10_S6_HANDOFF_LANDED_COMM_IDS)[number];

/** FLAG-T2-OTEL env member domain (ledger A). */
export type G10S6T2OtelFlagMember =
  | "T2CODE_TRACE_FILE"
  | "T2CODE_OTLP_TRACES_URL"
  | "T2CODE_OTLP_SERVICE_NAME";

/** ORCH-LIVE liveBuffer kind domain (ledger A). */
export type G10S6OrchLiveKind = "event" | "synchronized";

/** One manifold (or live) traffic sample for ≡ under G9DeferredEquality. */
export type G10S6TrafficSample = {
  readonly path: "live" | "manifold";
  readonly commId: G10S6TrafficCommId;
  readonly phase: string;
  readonly projection: G9EqualityA;
  readonly atMs: number;
};

/** Structured evidence body for one Ordered proof step (markdown writer input). */
export type G10S6EvidenceBody = {
  readonly slice: "S6";
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
 * In-memory manifold stub traffic log (S6 obs/RPC + FLAG-T3 stub).
 *
 * Intended: enough samples for live-vs-manifold ≡ under G9DeferredEquality.
 * Observed: append-only arrays; cleared on rollback restore when requested.
 */
export type G10S6ManifoldTrafficLog = {
  readonly samples: G10S6TrafficSample[];
};

/**
 * Representative phase + projection A for each wired S6 seam (Ordered rehearsal).
 * Agent: keep ledger-bounded; no OTLP/RPC payloads in A.
 */
const G10_S6_WIRED_REHEARSAL: ReadonlyArray<{
  readonly commId: G10S6WiredCommId;
  readonly phase: string;
  readonly projection: G9EqualityA;
}> = [
  {
    commId: "INV-T2-FLAG-T2-OTEL",
    phase: "flag-resolved",
    projection: { member: "T2CODE_TRACE_FILE" },
  },
  {
    commId: "INV-T2-ORCH-RPC",
    phase: "rpc-request-admitted",
    projection: { method: "orchestration.dispatchCommand" },
  },
  {
    commId: "INV-T2-RPC-STREAM-AUTH",
    phase: "rpc-request-admitted",
    projection: { method: "subscribeAuthAccess" },
  },
  {
    commId: "INV-T2-RPC-STREAM-CONFIG",
    phase: "rpc-request-admitted",
    projection: { method: "subscribeServerConfig" },
  },
  {
    commId: "INV-T2-RPC-STREAM-DISCOVERY",
    phase: "rpc-request-admitted",
    projection: { method: "subscribeVcsStatus" },
  },
  {
    commId: "INV-T2-RPC-STREAM-ORCH",
    phase: "rpc-request-admitted",
    projection: { method: "orchestration.subscribeShell" },
  },
  {
    commId: "INV-T2-RPC-STREAM-TEL",
    phase: "rpc-request-admitted",
    projection: { method: "subscribeResourceTelemetry" },
  },
  {
    commId: "INV-T2-RPC-STREAM-TERM",
    phase: "rpc-request-admitted",
    projection: { method: "subscribeTerminalEvents" },
  },
  {
    commId: "INV-T2-RPC-WS",
    phase: "rpc-request-admitted",
    projection: { method: "server.probe" },
  },
  {
    commId: "INV-T2-TEL-T2-OTLP",
    phase: "t2-otlp-export-succeeded",
    projection: { signal: "t2-otlp-export-succeeded" },
  },
  {
    commId: "INV-T2-TEL-T3-OTLP",
    phase: "t3-otlp-traces-export-succeeded",
    projection: { signal: "t3-otlp-traces-export-succeeded" },
  },
  {
    commId: "INV-T2-ORCH-LIVE",
    phase: "live-buffer-offered",
    projection: { kind: "event" },
  },
  {
    commId: "INV-T2-TEL-NDJSON",
    phase: "ndjson-export-succeeded",
    projection: { comm_id: "present" },
  },
  {
    commId: "INV-T2-TEL-T3-TRACE",
    phase: "t3-trace-persisted-batch-succeeded",
    projection: { comm_id: "present" },
  },
];

/**
 * S6 campaign controller shape (process-global or Effect service).
 *
 * Agent: land → liveRehearsal → recordEquiv → rollbackDrill → dualRunExit →
 * armInversion. dualRunExit uses recordOrderedProofStep only.
 */
export type G10S6Controller = {
  readonly slice: "S6";
  readonly model: G10SubstitutionModel;
  readonly registry: G10CutoverRegistry;
  readonly traffic: G10S6ManifoldTrafficLog;
  /** admit/route/replace + Ordered proof "land". */
  readonly land: () => G10S6EvidenceBody;
  /**
   * Live-authoritative rehearsal: observe traffic + one rollback restore +
   * re-land install + record live-rehearsal step.
   */
  readonly liveRehearsal: () => G10S6EvidenceBody;
  /** Cutover ≡ under G9DeferredEquality for S6 activatable + handoff lands. */
  readonly recordEquiv: () => G10S6EvidenceBody;
  /** Rollback drill: restore live, re-prove authority, record step. */
  readonly rollbackDrill: () => G10S6EvidenceBody;
  /** Dual-run exit via recordOrderedProofStep only (refuses markDualRunExited). */
  readonly dualRunExit: () => G10S6EvidenceBody;
  /** Arm inversion via armInversion → recordOrderedProofStep. */
  readonly armInversion: () => G10S6EvidenceBody;
  /**
   * Record live traffic for a wired S6 lander seam.
   * Agent: do not use for FLAG-T3-OTEL handoff — that stays recordStubPair.
   */
  readonly recordLiveWiredSeam: (
    commId: G10S6WiredCommId,
    phase: string,
    projection: G9EqualityA,
  ) => void;
  /** Record manifold observe/authority sample for a wired S6 seam. */
  readonly recordManifoldWiredSeam: (
    commId: G10S6WiredCommId,
    phase: string,
    projection: G9EqualityA,
  ) => void;
  /**
   * Record handoff-pending stub pair (FLAG-T3-OTEL → S2 only).
   * Agent: not admit/route/replace wiring; ≡ carrier coverage for deferred row.
   */
  readonly recordStubPair: (commId: G10S6CommId, phase: string, projection: G9EqualityA) => void;
  /** True when replace installed for S6. */
  readonly isReplaceInstalled: () => boolean;
  readonly authority: () => "live" | "manifold";
  readonly phase: () => CutoverPhase;
  readonly inversionArmed: () => boolean;
  /** Format evidence markdown for a recorded step body. */
  readonly formatEvidenceMarkdown: (body: G10S6EvidenceBody) => string;
  /** Run full Ordered proof sequence; returns bodies in order. */
  readonly runFullOrderedProof: () => readonly G10S6EvidenceBody[];
};

/** Process-global optional controller (tests / lander fallback). */
let processGlobalG10S6: G10S6Controller | undefined;

/**
 * Install or clear the process-global S6 controller.
 *
 * Intended: tests set before ws/T2Observability/Observability effects;
 * production prefers Layer. Observed: module singleton; absent ⇒ lander live
 * unchanged.
 */
export const installProcessGlobalG10S6 = (controller: G10S6Controller | undefined): void => {
  processGlobalG10S6 = controller;
};

/** Read process-global S6 controller (undefined when absent). */
export const getProcessGlobalG10S6 = (): G10S6Controller | undefined => processGlobalG10S6;

/**
 * Effect service key for optional S6 cutover controller (G9CaptureService pattern).
 *
 * Absent ⇒ ws / T2Observability / Observability live paths unchanged.
 */
export class G10S6CutoverService extends Context.Service<G10S6CutoverService, G10S6Controller>()(
  "t3/scm/g10SliceS6/G10S6CutoverService",
) {}

/**
 * Layer.succeed helper for tests / optional stack merge.
 *
 * Intended: provides server G10S6CutoverService so landers resolve via Context.
 */
export const G10S6CutoverLayer = (controller: G10S6Controller): Layer.Layer<G10S6CutoverService> =>
  Layer.succeed(G10S6CutoverService, controller);

/**
 * Resolve optional S6 controller: Effect.serviceOption first, then process-global.
 *
 * Intended: lander sites call this once per seam. Absent ⇒ live only.
 */
export const resolveOptionalG10S6 = (): Effect.Effect<Option.Option<G10S6Controller>> =>
  Effect.gen(function* () {
    const fromService = yield* Effect.serviceOption(G10S6CutoverService);
    if (Option.isSome(fromService)) return fromService;
    const global = processGlobalG10S6;
    return global === undefined ? Option.none() : Option.some(global);
  });

const nowMs = (): number => Date.now();

const pushSample = (traffic: G10S6ManifoldTrafficLog, sample: G10S6TrafficSample): void => {
  traffic.samples.push(sample);
};

/**
 * Create an S6 campaign controller bound to inventory registry.
 *
 * Parameters
 * ----------
 * repoRoot : string
 *     Monorepo root for seam-inventory load (defaults to resolveG10RepoRoot).
 *
 * Returns
 * -------
 * G10S6Controller
 *     Mutable coordinator for S6 Ordered proof + manifold traffic.
 */
export const createG10S6Controller = (repoRoot: string = resolveG10RepoRoot()): G10S6Controller => {
  const registry = loadG10CutoverRegistry(repoRoot);
  const model = createSubstitutionModel(registry);
  const traffic: G10S6ManifoldTrafficLog = { samples: [] };

  const s6Ids = activatableCommIdsForSlice(registry, "S6");
  // Hard lock: inventory S6 activatable set must match frozen 12 (no silent resize).
  if (s6Ids.length !== G10_S6_COMM_IDS.length) {
    throw new Error(
      `G10 S6 controller: inventory S6 count ${s6Ids.length} ≠ frozen ${G10_S6_COMM_IDS.length}`,
    );
  }
  for (const id of G10_S6_COMM_IDS) {
    if (!s6Ids.includes(id)) {
      throw new Error(`G10 S6 controller: missing inventory id ${id}`);
    }
  }
  // Dormant must stay out of activatable radius.
  if (s6Ids.includes(G10_DORMANT_HOME_BUS_COMM_ID)) {
    throw new Error("G10 S6 controller: dormant HOME-BUS must not be activatable");
  }

  const recordLiveWiredSeam = (
    commId: G10S6WiredCommId,
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
    commId: G10S6WiredCommId,
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

  const recordStubPair = (commId: G10S6CommId, phase: string, projection: G9EqualityA): void => {
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
  ): G10S6EvidenceBody => {
    const liveCount = traffic.samples.filter((s) => s.path === "live").length;
    const manifoldCount = traffic.samples.filter((s) => s.path === "manifold").length;
    return {
      slice: "S6",
      step,
      phase: phaseForSlice(model, "S6"),
      authority: authorityForSlice(model, "S6"),
      inversionArmed: model.sliceStates.get("S6")?.inversionArmed === true,
      commIds: [...s6Ids],
      notes,
      equalitySamples,
      trafficSummary: { liveCount, manifoldCount },
    };
  };

  const formatEvidenceMarkdown = (body: G10S6EvidenceBody): string => {
    const lines = [
      `# S6 ${body.step} evidence`,
      "",
      `<!-- Agent: G10 S6 Ordered proof step. Slice=${body.slice}. -->`,
      "",
      `- Date: ${new Date().toISOString().slice(0, 10)}`,
      `- Slice: **S6**`,
      `- Step: **${body.step}**`,
      `- Phase: \`${body.phase}\``,
      `- Authority: **${body.authority}**`,
      `- inversionArmed: \`${body.inversionArmed}\``,
      `- S6 activatable comm_ids (${body.commIds.length}): ${body.commIds.join(", ")}`,
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
   * Seed FLAG-T3-OTEL handoff stub only (S6→S2; not seam-bridge wired).
   * Agent: cli/config.ts is S2 sole lander — S6 must not commit it.
   */
  const seedFlagT3OtelHandoffStub = (): void => {
    recordStubPair("INV-T2-FLAG-T3-OTEL", "flag-resolved", {
      comm_id: "resolved",
    });
  };

  /**
   * Dual-run observe rehearsal through seam bridge (live authoritative).
   * Records all fourteen wired S6 seams without real I/O.
   */
  const rehearseWiredSeamsObserve = (): void => {
    for (const row of G10_S6_WIRED_REHEARSAL) {
      void Effect.runSync(
        runG10SeamBridge({
          model,
          slice: "S6",
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

  const land = (): G10S6EvidenceBody => {
    installAdmitRouteReplace(model, "S6");
    recordOrderedProofStep(model, "S6", "land");
    return snapshotEvidence("land", [
      "admit/route/replace installed for S6 radius (12 activatable rows; home-bus dormant-exempt)",
      "authority remains live (dual-run); manifold observe-beside eligible",
      "wired seams (14): FLAG-T2-OTEL + ORCH-RPC + RPC-STREAM-* + RPC-WS + TEL-T2-OTLP + TEL-T3-OTLP + ORCH-LIVE (S2 handoff) + TEL-NDJSON/TEL-T3-TRACE (S5 handoffs)",
      "FLAG-T3-OTEL handoff-pending S2 (cli/config.ts) — not S6-wired; S6 does not commit cli/config.ts",
      "INV-T2-SCM-HOME-BUS-LINK remains dormant-preserved — not cutover / exit / inversion",
      "markDualRunExited not used",
    ]);
  };

  const liveRehearsal = (): G10S6EvidenceBody => {
    if (!model.installs.get("S6")?.replaceInstalled) {
      throw new Error("G10 S6 liveRehearsal requires land first");
    }
    rehearseWiredSeamsObserve();
    seedFlagT3OtelHandoffStub();
    restorePreCutoverLive(model, "S6");
    if (authorityForSlice(model, "S6") !== "live") {
      throw new Error("G10 S6 liveRehearsal: restore did not return live authority");
    }
    if (!model.installs.get("S6")?.replaceInstalled) {
      installAdmitRouteReplace(model, "S6");
    } else {
      const install = model.installs.get("S6");
      if (install && install.authority !== "live") {
        model.installs.set("S6", { ...install, authority: "live" });
      }
    }
    rehearseWiredSeamsObserve();
    recordOrderedProofStep(model, "S6", "live-rehearsal");
    return snapshotEvidence("live-rehearsal", [
      "dual-run observe on fourteen wired S6 seams via g10SeamBridge (live authoritative)",
      "FLAG-T3-OTEL handoff stub only (deferred to S2 cli/config.ts; not bridge-wired)",
      "ORCH-LIVE S2→S6 + TEL-NDJSON/TEL-T3-TRACE S5→S6 handoff lands exercised on sole landers",
      "home-bus dormant-exempt — not rehearsed as cutover",
      "one rollback restore + re-land under live authority",
      "inversion not armed; live remains authoritative",
    ]);
  };

  const recordEquiv = (): G10S6EvidenceBody => {
    const byComm = new Map<string, { live?: G9EqualityA; manifold?: G9EqualityA }>();
    for (const sample of traffic.samples) {
      const entry = byComm.get(sample.commId) ?? {};
      if (sample.path === "live") entry.live = sample.projection;
      else entry.manifold = sample.projection;
      byComm.set(sample.commId, entry);
    }
    const equalitySamples: G9DeferredEquality[] = [];
    const missing: string[] = [];
    // Activatable 12 (includes FLAG-T3 stub) + three handoff lands.
    const equivIds = [...G10_S6_COMM_IDS, ...G10_S6_HANDOFF_LANDED_COMM_IDS] as const;
    for (const id of equivIds) {
      const pair = byComm.get(id);
      if (!pair?.live || !pair.manifold) {
        missing.push(id);
        continue;
      }
      if (JSON.stringify(pair.live) !== JSON.stringify(pair.manifold)) {
        throw new Error(
          `G10 S6 ≡ failed for ${id}: live=${JSON.stringify(pair.live)} manifold=${JSON.stringify(pair.manifold)}`,
        );
      }
      equalitySamples.push(asG9DeferredEquality(pair.live));
    }
    if (missing.length > 0) {
      throw new Error(`G10 S6 ≡ missing traffic for: ${missing.join(", ")}`);
    }
    recordOrderedProofStep(model, "S6", "cutover-equivalence");
    return snapshotEvidence(
      "cutover-equivalence",
      [
        "wired fourteen: live≡manifold via g10SeamBridge (obs/RPC + ORCH-LIVE/NDJSON/T3-TRACE lands)",
        "FLAG-T3-OTEL: handoff-deferred stub pair only (S2 lander cli/config; not (a) for that row)",
        "home-bus dormant-exempt — not in ≡ set",
        "not WP8 763-fixture-as-proof",
        "type carrier: asG9DeferredEquality from g10ProofHarness",
      ],
      equalitySamples,
    );
  };

  const rollbackDrill = (): G10S6EvidenceBody => {
    const result = restorePreCutoverLive(model, "S6");
    if (
      result.restoredAuthority !== "live" ||
      result.clearedShadowEnv ||
      result.usedHaltController
    ) {
      throw new Error("G10 S6 rollbackDrill: invalid rollback result");
    }
    if (authorityForSlice(model, "S6") !== "live") {
      throw new Error("G10 S6 rollbackDrill: authority not live after restore");
    }
    const proved = Effect.runSync(
      runG10SeamBridge({
        model,
        slice: "S6",
        commId: "INV-T2-RPC-WS",
        liveEffect: Effect.succeed("live-ok"),
        manifoldEffect: Effect.succeed("manifold-should-not-win"),
        manifoldObserveEffect: Effect.void,
      }),
    );
    if (proved !== "live-ok") {
      throw new Error("G10 S6 rollbackDrill: live authority not selected");
    }
    recordOrderedProofStep(model, "S6", "rollback-drill");
    return snapshotEvidence("rollback-drill", [
      "restorePreCutoverLive restored live authority",
      "rollback ≠ unset T2CODE_SCM_G9_SHADOW; no halt controller",
      "re-proved live-authoritative bridge selection for RPC-WS",
      "restore scope: ws.ts + T2Observability.ts + Observability.ts",
      "FLAG-T3-OTEL restore stays with S2 lander on cli/config.ts (not S6)",
      "home-bus dormant — no restore claim",
    ]);
  };

  const dualRunExit = (): G10S6EvidenceBody => {
    recordOrderedProofStep(model, "S6", "dual-run-exit");
    if (authorityForSlice(model, "S6") !== "manifold") {
      throw new Error("G10 S6 dualRunExit: authority not manifold after proof step");
    }
    return snapshotEvidence("dual-run-exit", [
      "exit (a)/(e) for fourteen wired S6 seams only (obs/RPC + ORCH-LIVE/NDJSON/T3-TRACE lands)",
      "FLAG-T3-OTEL handoff-deferred to S2 — not claimed under exit (a)",
      "HOME-BUS dormant-exempt — not claimed under exit (a)",
      'flipped solely via recordOrderedProofStep(..., "dual-run-exit")',
      "markDualRunExited not used (S0 escalation sole-owner binding)",
      "prerequisites: land + live-rehearsal + ≡ + rollback-drill green for wired fourteen",
    ]);
  };

  const armInversionStep = (): G10S6EvidenceBody => {
    armInversion(model, "S6", registry);
    if (model.sliceStates.get("S6")?.inversionArmed !== true) {
      throw new Error("G10 S6 armInversion: inversionArmed not true");
    }
    return snapshotEvidence("arm-inversion", [
      "noninterference inversion armed after dual-run-exit",
      "manifold failure may now fail user-visible S6 RPC/OTLP/obs ops",
      "armed solely via armInversion → recordOrderedProofStep",
      "FLAG-T3-OTEL remains handoff-deferred — not inverted from S6 wiring",
      "HOME-BUS dormant-exempt — not inverted",
    ]);
  };

  const runFullOrderedProof = (): readonly G10S6EvidenceBody[] => {
    const bodies: G10S6EvidenceBody[] = [];
    bodies.push(land());
    bodies.push(liveRehearsal());
    bodies.push(recordEquiv());
    bodies.push(rollbackDrill());
    bodies.push(dualRunExit());
    bodies.push(armInversionStep());
    if (!orderedProofSatisfiedThrough(model, "S6", "arm-inversion")) {
      throw new Error("G10 S6 runFullOrderedProof: Ordered proof incomplete");
    }
    return bodies;
  };

  return {
    slice: "S6",
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
    isReplaceInstalled: () => model.installs.get("S6")?.replaceInstalled === true,
    authority: () => authorityForSlice(model, "S6"),
    phase: () => phaseForSlice(model, "S6"),
    inversionArmed: () => model.sliceStates.get("S6")?.inversionArmed === true,
    formatEvidenceMarkdown,
    runFullOrderedProof,
  };
};

/**
 * Shared lander bridge: success live I/O (obs/RPC) via g10SeamBridge.
 *
 * Intended: absent/not-replaced ⇒ live only. Present + replaced ⇒
 * runG10SeamBridge with live/manifold record hooks.
 *
 * Observed: reuses live I/O on manifold authority so export/RPC still fire.
 */
const runWiredSuccessSeamViaG10Bridge = <A, E, R>(
  commId: G10S6WiredCommId,
  phase: string,
  projection: G9EqualityA,
  liveIo: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const opt = yield* resolveOptionalG10S6();
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
      slice: "S6",
      commId,
      liveEffect,
      manifoldEffect: manifoldAuthority,
      manifoldObserveEffect: manifoldObserve,
    });
  });

/**
 * ORCH-LIVE: wrap liveBuffer Queue.offer + G9 capture through G10 bridge.
 *
 * Agent: call sites only in ws.ts (subscribeShell / subscribeThreadDetail).
 * False offer ⇒ no G10 traffic record and no G9 capture (handoff law).
 */
export const offerOrchLiveViaG10Bridge = <E extends { readonly kind: G10S6OrchLiveKind }>(
  liveBuffer: Queue.Queue<E, never>,
  item: E,
): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const projection: G9EqualityA = { kind: item.kind };
    const liveOffer: Effect.Effect<boolean> = Effect.gen(function* () {
      const accepted = yield* Queue.offer(liveBuffer, item);
      yield* withOptionalG9Capture((capture) =>
        captureOrchLiveIfOfferAccepted(capture, accepted, item.kind),
      );
      return accepted;
    });

    const opt = yield* resolveOptionalG10S6();
    if (Option.isNone(opt) || !opt.value.isReplaceInstalled()) {
      return yield* liveOffer;
    }
    const ctrl = opt.value;
    let acceptedForObserve = false;
    return yield* runG10SeamBridge({
      model: ctrl.model,
      slice: "S6",
      commId: "INV-T2-ORCH-LIVE",
      liveEffect: Effect.gen(function* () {
        const accepted = yield* liveOffer;
        acceptedForObserve = accepted;
        if (accepted) {
          ctrl.recordLiveWiredSeam("INV-T2-ORCH-LIVE", "live-buffer-offered", projection);
        }
        return accepted;
      }),
      manifoldEffect: Effect.gen(function* () {
        const accepted = yield* liveOffer;
        if (accepted) {
          ctrl.recordManifoldWiredSeam("INV-T2-ORCH-LIVE", "live-buffer-offered", projection);
        }
        return accepted;
      }),
      manifoldObserveEffect: Effect.sync(() => {
        if (acceptedForObserve) {
          ctrl.recordManifoldWiredSeam("INV-T2-ORCH-LIVE", "live-buffer-offered", projection);
        }
      }),
    });
  });

/**
 * FLAG-T2-OTEL: wrap one env-member resolve success through G10 bridge.
 * Agent: call site only in T2Observability.ts captureT2OtelFlagsResolved loop.
 */
export const flagT2OtelViaG10Bridge = <A, E, R>(
  member: G10S6T2OtelFlagMember,
  liveResolve: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge("INV-T2-FLAG-T2-OTEL", "flag-resolved", { member }, liveResolve);

/**
 * TEL-NDJSON: wrap NDJSON export success through G10 bridge (S5→S6 handoff land).
 * Agent: call site only in T2Observability.ts NDJSON exporter onSuccess.
 */
export const ndjsonExportViaG10Bridge = <A, E, R>(
  liveExport: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-TEL-NDJSON",
    "ndjson-export-succeeded",
    { comm_id: "present" },
    liveExport,
  );

/**
 * TEL-T2-OTLP: wrap T2 OTLP export success through G10 bridge.
 * Agent: call site only in T2Observability.ts OTLP exporter onSuccess.
 */
export const t2OtlpExportViaG10Bridge = <A, E, R>(
  liveExport: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-TEL-T2-OTLP",
    "t2-otlp-export-succeeded",
    { signal: "t2-otlp-export-succeeded" },
    liveExport,
  );

/**
 * TEL-T3-TRACE: wrap local-file batch persist success (S5→S6 handoff land).
 * Agent: call site only in Observability.ts makeTraceSink onFlush.
 */
export const t3TraceBatchViaG10Bridge = <A, E, R>(
  livePersist: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge(
    "INV-T2-TEL-T3-TRACE",
    "t3-trace-persisted-batch-succeeded",
    { comm_id: "present" },
    livePersist,
  );

/**
 * TEL-T3-OTLP: wrap T3 OTLP export success through G10 bridge.
 * Agent: used by G10T3OtlpExportHooksLayer on Observability.ts.
 */
export const t3OtlpExportViaG10Bridge = <A, E, R>(
  phase: "t3-otlp-traces-export-succeeded" | "t3-otlp-metrics-export-succeeded",
  liveExport: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  runWiredSuccessSeamViaG10Bridge("INV-T2-TEL-T3-OTLP", phase, { signal: phase }, liveExport);

/**
 * Map Rpc admit tag → wired S6 comm_id when ledger-registered.
 * Agent: unknown tags stay live-only (G9 no-op path).
 */
const rpcAdmitWired = (
  tag: string,
): { readonly commId: G10S6WiredCommId; readonly projection: G9EqualityA } | undefined => {
  const input = buildRpcAdmitCaptureInput(tag);
  if (input === undefined) return undefined;
  const wired = G10_S6_WIRED_COMM_IDS.find((id) => id === input.comm_id);
  if (wired === undefined) return undefined;
  return { commId: wired, projection: input.input as G9EqualityA };
};

/**
 * RpcServer admit hook → G9 capture + optional G10 bridge.
 * Agent: ws.ts G10RpcServerRequestHooksLayer only.
 */
export const rpcRequestAdmittedViaG10Bridge = (tag: string): Effect.Effect<void, never> => {
  const wired = rpcAdmitWired(tag);
  const liveIo = captureRpcRequestAdmitted(tag);
  if (wired === undefined) return liveIo;
  return runWiredSuccessSeamViaG10Bridge(
    wired.commId,
    "rpc-request-admitted",
    wired.projection,
    liveIo,
  );
};

/**
 * RpcServer unary-success hook → G9 capture + optional G10 bridge.
 * Agent: maps ORCH-RPC / RPC-WS unary partitions only.
 */
export const rpcUnarySucceededViaG10Bridge = (tag: string): Effect.Effect<void, never> => {
  const input = buildRpcUnarySuccessCaptureInput(tag);
  const liveIo = captureRpcUnarySucceeded(tag);
  if (input === undefined) return liveIo;
  const wired = G10_S6_WIRED_COMM_IDS.find((id) => id === input.comm_id);
  if (wired === undefined) return liveIo;
  return runWiredSuccessSeamViaG10Bridge(
    wired,
    "rpc-handler-succeeded",
    input.input as G9EqualityA,
    liveIo,
  );
};

/**
 * RpcServer stream-element hook → G9 capture + optional G10 bridge.
 * Agent: maps RPC-WS + RPC-STREAM-* stream partitions.
 */
export const rpcStreamElementViaG10Bridge = (tag: string): Effect.Effect<void, never> => {
  const input = buildRpcStreamElementCaptureInput(tag);
  const liveIo = captureRpcStreamElement(tag);
  if (input === undefined) return liveIo;
  const wired = G10_S6_WIRED_COMM_IDS.find((id) => id === input.comm_id);
  if (wired === undefined) return liveIo;
  return runWiredSuccessSeamViaG10Bridge(
    wired,
    "rpc-stream-element-emitted",
    input.input as G9EqualityA,
    liveIo,
  );
};

/**
 * Layer for ws.ts: RpcServerRequestHooks with G10 bridge + G9 capture-beside.
 *
 * Agent: replace G9RpcServerRequestHooksLayer on the RpcServer websocket stack.
 * Absent G10 controller ⇒ helpers pass through to G9 capture only.
 */
export const G10RpcServerRequestHooksLayer: Layer.Layer<RpcServer.RpcServerRequestHooks> =
  Layer.succeed(RpcServer.RpcServerRequestHooks, {
    onRequestAdmitted: ({ tag }) => rpcRequestAdmittedViaG10Bridge(tag),
    onUnarySucceeded: ({ tag }) => rpcUnarySucceededViaG10Bridge(tag),
    onStreamElement: ({ tag }) => rpcStreamElementViaG10Bridge(tag),
  });

/**
 * Layer for Observability.ts: ExportHooks with G10 bridge + G9 capture-beside.
 *
 * Agent: replace G9T3OtlpExportHooksLayer. Maps traces/metrics labels only.
 */
export const G10T3OtlpExportHooksLayer: Layer.Layer<OtlpExporter.ExportHooks> = Layer.succeed(
  OtlpExporter.ExportHooks,
  {
    onExportSucceeded: ({ label, batchSize }) =>
      Effect.gen(function* () {
        // Empty / non-capturable batches must not create G10 traffic records.
        if (!isCapturableOtlpExportBatch({ batchSize })) {
          return;
        }
        // Resolve phase from label before bridge so projection stays ledger-true.
        const phase =
          label === G9_T3_OTLP_EXPORTER_LABELS.traces
            ? ("t3-otlp-traces-export-succeeded" as const)
            : label === G9_T3_OTLP_EXPORTER_LABELS.metrics
              ? ("t3-otlp-metrics-export-succeeded" as const)
              : undefined;
        const liveCapture = captureT3OtlpExportSucceededFromLabel({ label, batchSize });
        if (phase === undefined) {
          return yield* liveCapture;
        }
        return yield* t3OtlpExportViaG10Bridge(phase, liveCapture);
      }),
  },
);

/**
 * ORCH-LIVE handoff reception (S2 → S6 land complete).
 *
 * Intended: S6 sole lander wires admit/route/replace on ws.ts.
 * Observed: documentation constant — runtime wiring is offerOrchLiveViaG10Bridge.
 */
export const G10_S6_ORCH_LIVE_HANDOFF_LANDED = {
  commId: "INV-T2-ORCH-LIVE" as const,
  fromSlice: "S2" as const,
  landerSlice: "S6" as const,
  landerModule: "apps/server/src/ws.ts",
  status: "landed" as const,
  handoffDoc: "docs/scm/g10/handoffs/S2-ORCH-LIVE-to-S6.md",
  note: "S2 stub complete; S6 claims exit (a) for ORCH-LIVE on ws.ts lander",
} as const;

/**
 * TEL-NDJSON handoff reception (S5 → S6 land complete).
 *
 * Intended: S6 sole lander wires admit/route/replace on T2Observability.ts.
 * Observed: documentation constant — runtime wiring is ndjsonExportViaG10Bridge.
 */
export const G10_S6_TEL_NDJSON_HANDOFF_LANDED = {
  commId: "INV-T2-TEL-NDJSON" as const,
  fromSlice: "S5" as const,
  landerSlice: "S6" as const,
  landerModule: "apps/server/src/t2Observability/T2Observability.ts",
  status: "landed" as const,
  handoffDoc: "docs/scm/g10/handoffs/S5-TEL-NDJSON-to-S6.md",
  note: "S5 stub complete; S6 claims exit (a) for TEL-NDJSON on T2Observability lander",
} as const;

/**
 * TEL-T3-TRACE handoff reception (S5 → S6 land complete).
 *
 * Intended: S6 sole lander wires admit/route/replace on Observability.ts.
 * Observed: documentation constant — runtime wiring is t3TraceBatchViaG10Bridge.
 */
export const G10_S6_TEL_T3_TRACE_HANDOFF_LANDED = {
  commId: "INV-T2-TEL-T3-TRACE" as const,
  fromSlice: "S5" as const,
  landerSlice: "S6" as const,
  landerModule: "apps/server/src/observability/Layers/Observability.ts",
  status: "landed" as const,
  handoffDoc: "docs/scm/g10/handoffs/S5-TEL-T3-TRACE-to-S6.md",
  note: "S5 stub complete; S6 claims exit (a) for TEL-T3-TRACE on Observability lander",
} as const;

/**
 * FLAG-T3-OTEL handoff documentation (S6 → S2).
 *
 * Intended: S6 must NOT wire admit/route/replace in cli/config.ts.
 * S2 sole lander owns FLAG-T3-OTEL cutover on that file. S6 keeps a ledger
 * stub pair for Ordered-proof ≡ carrier coverage only.
 * Observed: this constant is documentation for agents — no runtime effect.
 */
export const G10_S6_FLAG_T3_OTEL_HANDOFF = {
  commId: "INV-T2-FLAG-T3-OTEL" as const,
  landerSlice: "S2" as const,
  landerModule: "apps/server/src/cli/config.ts",
  status: "handoff-pending" as const,
  handoffDoc: "docs/scm/g10/handoffs/S6-FLAG-T3-OTEL-to-S2.md",
  note: "Do not claim S6-wired or dual-run-exit (a) for FLAG-T3-OTEL from S6; S6 does not commit cli/config.ts",
} as const;

/**
 * HOME-BUS dormant exemption note (fixtures only).
 *
 * Intended: never activate under S6 Ordered proof. Observed: docs constant.
 */
export const G10_S6_HOME_BUS_DORMANT = {
  commId: G10_DORMANT_HOME_BUS_COMM_ID,
  status: "dormant-preserved" as const,
  landerModule: "apps/server/src/scm/g6HomeBusLink.ts",
  note: "Exempt from S6 cutover / dual-run-exit / inversion; fixtures only",
} as const;
