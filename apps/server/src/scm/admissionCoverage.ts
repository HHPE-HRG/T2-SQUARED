/**
 * Coverage join for admission reconcile.
 *
 * Intended: report only the four review classes. A G10 comm_id or a
 * provider-native tool with no admitted record is executable but unregistered.
 * An admitted id with no seam and no discovered tool is declared but
 * unreachable. An observed activity with no admitted record executed without
 * a policy record. An admitted activity with no effect receipt is
 * policy-approved but unconfirmed.
 *
 * Observed: pure classification of caller-supplied ids and activities. G9
 * occurrences and orchestration activities are inputs, not the legal ledger.
 * N08 spans are not read. Does not resize the 73+1 radius. Does not mark
 * provider-native tools admitted.
 */
import type { CapabilityRecord } from "./admissionCatalog.ts";

export const COVERAGE_CLASSES = [
  "declared-but-unreachable",
  "executable-but-unregistered",
  "executed-without-policy-record",
  "policy-approved-but-unconfirmed",
] as const;

export type CoverageClass = (typeof COVERAGE_CLASSES)[number];

export type CoverageFinding = {
  readonly coverageClass: CoverageClass;
  readonly id: string;
  readonly detail: string;
};

/** One already-emitted tool activity. `hasEffectReceipt` is false when no effect row exists. */
export type ObservedActivity = {
  readonly capabilityId: string;
  readonly source: "orchestration-tool" | "g9-occurrence";
  readonly hasEffectReceipt: boolean;
};

export type CoverageJoinInput = {
  readonly records: readonly CapabilityRecord[];
  /** Invocable discovered capability ids (preview tools, host MCP, scripts). */
  readonly discoveredIds: readonly string[];
  /** Provider-native and other outside-guarantee ids. Always unregistered. */
  readonly outsideGuaranteeIds: readonly string[];
  /** G10 activatable comm_ids. Passed in. This module does not load or edit the inventory. */
  readonly g10CommIds: readonly string[];
  readonly activities: readonly ObservedActivity[];
};

const admittedIds = (records: readonly CapabilityRecord[]): Set<string> =>
  new Set(
    records
      .filter((record) => record.admission_state === "admitted")
      .map((record) => record.capability_id),
  );

/**
 * Join admitted records, discovery, G10 seams, and observed activities.
 * Emits a finding per mismatch. Does not collapse classes into a single GREEN.
 */
export const joinCoverage = (input: CoverageJoinInput): readonly CoverageFinding[] => {
  const admitted = admittedIds(input.records);
  const recordIds = new Set(input.records.map((record) => record.capability_id));
  const recordNodes = new Set(input.records.map((record) => record.node_id));
  const discovered = new Set(input.discoveredIds);
  const findings: CoverageFinding[] = [];

  for (const record of input.records) {
    if (record.admission_state !== "admitted") continue;
    const onSeam =
      input.g10CommIds.includes(record.capability_id) || input.g10CommIds.includes(record.node_id);
    const invocable = discovered.has(record.capability_id);
    if (!onSeam && !invocable) {
      findings.push({
        coverageClass: "declared-but-unreachable",
        id: record.capability_id,
        detail: "admitted record has no G10 comm_id and no discovered invocable tool",
      });
    }
  }

  for (const commId of input.g10CommIds) {
    if (!recordIds.has(commId) && !recordNodes.has(commId)) {
      findings.push({
        coverageClass: "executable-but-unregistered",
        id: commId,
        detail: "G10 comm_id has no capability record",
      });
    }
  }

  for (const id of input.outsideGuaranteeIds) {
    findings.push({
      coverageClass: "executable-but-unregistered",
      id,
      detail:
        "provider-native or opaque tool is outside granular guarantees and is not a capability grant",
    });
  }

  for (const activity of input.activities) {
    if (!admitted.has(activity.capabilityId)) {
      findings.push({
        coverageClass: "executed-without-policy-record",
        id: activity.capabilityId,
        detail: `${activity.source} activity has no admitted policy record`,
      });
      continue;
    }
    if (!activity.hasEffectReceipt) {
      findings.push({
        coverageClass: "policy-approved-but-unconfirmed",
        id: activity.capabilityId,
        detail: `${activity.source} activity has no effect receipt`,
      });
    }
  }

  return findings;
};
