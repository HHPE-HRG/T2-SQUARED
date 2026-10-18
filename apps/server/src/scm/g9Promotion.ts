/**
 * G9 promotion selection, retained current, and toW1 ages (WP2 / Task 5).
 *
 * Intended law (bind here):
 * - At most one queued occurrence promotes per live node per fundamental timestep
 *   (coordinator enforces the one-candidate loop; this module picks the candidate).
 * - FIFO head beats repeating retained current.
 * - retainCurrentAfterPublish true ⇒ retained after successful publish; false ⇒ empty.
 * - FIFO empty + retained ⇒ repeat via toW1(retained, lastPublished, framing).
 * - FIFO empty + no retained ⇒ inactive.
 * - Does not dequeue (coordinator commit owns dequeue).
 * - Failed preflight / withheld must not call nextAges (coordinator); toW1 itself
 *   always applies nextAges when invoked.
 *
 * Observed: selectPromotion peeks only; toW1 uses nextAges + checkW1Word and
 * throws G9InvariantFault("w1-invalid") on check failure. Task 14: toW1 / retain
 * accept any ledger-projected G9Occurrence (labels/equality/retain); no
 * ORCH-QUEUE-only literals.
 *
 * Consumes g8SharedClock.nextAges / loadG8FramingParameters types and g4Word.
 */
import { checkW1Word, type W1Word } from "./g4Word.ts";
import { nextAges, type G8FramingParameters } from "./g8SharedClock.ts";
import type { G9NodeFifos } from "./g9Fifo.ts";
import { G9InvariantFault, type G9Occurrence } from "./g9Occurrence.ts";

/**
 * Per-node shadow promotion state owned by the coordinator.
 * lastPublished holds the last successfully published W1 (ages source).
 * retained holds retainCurrentAfterPublish survivors keyed by node_id.
 */
export interface NodeShadowState {
  fifo: G9NodeFifos;
  lastPublished: Map<string, W1Word>;
  retained: Map<string, G9Occurrence>;
}

export type G9PromotionCandidate =
  | { readonly kind: "fifo"; readonly occurrence: G9Occurrence }
  | { readonly kind: "repeat"; readonly word: W1Word }
  | { readonly kind: "inactive" };

/**
 * Select the promotion candidate for one node this fundamental timestep.
 *
 * FIFO head wins over retained repeat. Repeat rebuilds W1 via toW1 using the
 * retained occurrence and lastPublished ages. Does not dequeue.
 *
 * Parameters
 * ----------
 * node_id : string
 *     Live placed node under consideration.
 * state : NodeShadowState
 *     FIFO + retained + last-published snapshot.
 * framing : G8FramingParameters
 *     Named placeholders for toW1 on the repeat path.
 *
 * Returns
 * -------
 * G9PromotionCandidate
 *     fifo | repeat | inactive.
 */
export const selectPromotion = (
  node_id: string,
  state: NodeShadowState,
  framing: G8FramingParameters,
): G9PromotionCandidate => {
  const head = state.fifo.peekHead(node_id);
  if (head !== undefined) return { kind: "fifo", occurrence: head };
  const cur = state.retained.get(node_id);
  if (cur !== undefined) {
    const prev = state.lastPublished.get(node_id);
    return { kind: "repeat", word: toW1(cur, prev, framing) };
  }
  return { kind: "inactive" };
};

/**
 * Project an occurrence to a checked W1 word with G8 ages.
 *
 * Parameters
 * ----------
 * occurrence : G9Occurrence
 *     Candidate or retained occurrence.
 * prev : W1Word | undefined
 *     Last successfully published word on this node, or undefined for first.
 * framing : G8FramingParameters
 *     modifier_start / null placeholders from docs/scm/g8/framing-parameters.json.
 *
 * Returns
 * -------
 * W1Word
 *     Checked word with nextAges applied.
 *
 * Throws
 * ------
 * G9InvariantFault
 *     code w1-invalid when checkW1Word fails.
 */
export const toW1 = (
  occurrence: G9Occurrence,
  prev: W1Word | undefined,
  framing: G8FramingParameters,
): W1Word => {
  const ages = nextAges(
    prev === undefined
      ? undefined
      : {
          fundamental_state: prev.fundamental_state,
          fundamental_request: prev.fundamental_request,
          state_age: prev.state_age,
          request_age: prev.request_age,
        },
    occurrence.state_label,
    occurrence.request_label,
  );
  const word = {
    bus_id: occurrence.origin_bus_id,
    node_id: occurrence.node_id,
    fundamental_state: occurrence.state_label,
    fundamental_request: occurrence.request_label,
    state_age: ages.state_age,
    request_age: ages.request_age,
    modifier_start: framing.modifier_start,
    null: framing.null,
    modifiers: [] as const,
  };
  const checked = checkW1Word(word);
  if (!checked.ok) {
    throw new G9InvariantFault("w1-invalid", checked.failures[0]?.message ?? "w1");
  }
  return checked.word;
};
