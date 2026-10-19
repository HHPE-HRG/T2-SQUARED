/**
 * G10 campaign cutover stack (auth-freeze process wire).
 *
 * Intended: when `T2CODE_SCM_G10_CUTOVER` is on, install S1–S7 controllers as
 * Effect services + process-globals so seam bridges resolve without per-test
 * setup. Default (env off) remains today’s live — this module is only used
 * from env-gated bootstrap.
 *
 * Observed: creates one controller per fabric slice, installs process globals,
 * returns Layer.mergeAll of CutoverService Layers. Does not activate home-bus,
 * codec, or flip auth. Does not run Ordered proof at boot (live test / ops
 * runbook owns that). Bridge cutover model — not a second physical I/O bus.
 */
import * as Layer from "effect/Layer";

import { resolveG10RepoRoot } from "./g10CutoverRegistry.ts";
import {
  G10S1CutoverLayer,
  G10S1CutoverService,
  createG10S1Controller,
  installProcessGlobalG10S1,
  type G10S1Controller,
} from "./g10SliceS1.ts";
import {
  G10S2CutoverLayer,
  G10S2CutoverService,
  createG10S2Controller,
  installProcessGlobalG10S2,
  type G10S2Controller,
} from "./g10SliceS2.ts";
import {
  G10S3CutoverLayer,
  G10S3CutoverService,
  createG10S3Controller,
  installProcessGlobalG10S3,
  type G10S3Controller,
} from "./g10SliceS3.ts";
import {
  G10S4CutoverLayer,
  G10S4CutoverService,
  createG10S4Controller,
  installProcessGlobalG10S4,
  type G10S4Controller,
} from "./g10SliceS4.ts";
import {
  G10S5CutoverLayer,
  G10S5CutoverService,
  createG10S5Controller,
  installProcessGlobalG10S5,
  type G10S5Controller,
} from "./g10SliceS5.ts";
import {
  G10S6CutoverLayer,
  G10S6CutoverService,
  createG10S6Controller,
  installProcessGlobalG10S6,
  type G10S6Controller,
} from "./g10SliceS6.ts";
import {
  G10S7CutoverLayer,
  G10S7CutoverService,
  createG10S7Controller,
  installProcessGlobalG10S7,
  type G10S7Controller,
} from "./g10SliceS7.ts";

/** Union of Effect services provided by the campaign cutover stack. */
export type G10CampaignCutoverServices =
  | G10S1CutoverService
  | G10S2CutoverService
  | G10S3CutoverService
  | G10S4CutoverService
  | G10S5CutoverService
  | G10S6CutoverService
  | G10S7CutoverService;

/** Controllers installed by a present-mode campaign stack. */
export type G10CampaignControllers = {
  readonly s1: G10S1Controller;
  readonly s2: G10S2Controller;
  readonly s3: G10S3Controller;
  readonly s4: G10S4Controller;
  readonly s5: G10S5Controller;
  readonly s6: G10S6Controller;
  readonly s7: G10S7Controller;
};

/**
 * Build S1–S7 controllers, install process-globals, return merged Layer.
 *
 * Parameters
 * ----------
 * repoRoot : string
 *     Monorepo root for inventory load (defaults to resolveG10RepoRoot).
 *
 * Returns
 * -------
 * { layer, controllers }
 *     Layer provides all CutoverServices; controllers also on process-global.
 */
export const buildG10CampaignCutoverStack = (
  repoRoot: string = resolveG10RepoRoot(),
): {
  readonly layer: Layer.Layer<G10CampaignCutoverServices>;
  readonly controllers: G10CampaignControllers;
} => {
  const s1 = createG10S1Controller(repoRoot);
  const s2 = createG10S2Controller(repoRoot);
  const s3 = createG10S3Controller(repoRoot);
  const s4 = createG10S4Controller(repoRoot);
  const s5 = createG10S5Controller(repoRoot);
  const s6 = createG10S6Controller(repoRoot);
  const s7 = createG10S7Controller(repoRoot);

  installProcessGlobalG10S1(s1);
  installProcessGlobalG10S2(s2);
  installProcessGlobalG10S3(s3);
  installProcessGlobalG10S4(s4);
  installProcessGlobalG10S5(s5);
  installProcessGlobalG10S6(s6);
  installProcessGlobalG10S7(s7);

  const layer = Layer.mergeAll(
    G10S1CutoverLayer(s1),
    G10S2CutoverLayer(s2),
    G10S3CutoverLayer(s3),
    G10S4CutoverLayer(s4),
    G10S5CutoverLayer(s5),
    G10S6CutoverLayer(s6),
    G10S7CutoverLayer(s7),
  );

  return {
    layer,
    controllers: { s1, s2, s3, s4, s5, s6, s7 },
  };
};
