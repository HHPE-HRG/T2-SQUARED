import type { MappingRow } from "./mapping/merge.ts";
import { validateOverride } from "./override.ts";
import type { ProposedOverride, CurrentFinding } from "./override.ts";
import type { ForgejoPull, ForgejoReview, ReviewerRoster } from "./forgejo.ts";
import type { Finding } from "./rules.ts";

export const UNCHECKABLE_ADMISSION_ID = "T2-ADMISSION-uncheckable";

export interface UncheckableOverrideInput {
  pull: ForgejoPull;
  review: ForgejoReview;
  roster: ReviewerRoster;
  mergeBaseRoster: ReviewerRoster;
  proposed: ProposedOverride;
  currentFindings: Array<CurrentFinding>;
  changedPaths: Array<string>;
}

export interface UncheckableAdmission {
  ok: boolean;
  reason: string;
  findings: Array<Finding>;
}

function namedFailure(row: MappingRow): string {
  return `fail_closed_uncheckable mapping ${row.id} is not admitted without a targeted override from a different principal`;
}

function admissionFinding(row: MappingRow): Finding {
  return {
    path: "admission",
    line: 1,
    column: 1,
    ruleId: UNCHECKABLE_ADMISSION_ID,
    message: namedFailure(row),
  };
}

export function admitFailClosedUncheckable(input: {
  row: MappingRow;
  override?: UncheckableOverrideInput;
}): UncheckableAdmission {
  if (input.row.class !== "fail_closed_uncheckable") {
    throw new Error(
      `admitFailClosedUncheckable requires fail_closed_uncheckable (got ${input.row.class})`,
    );
  }

  if (input.override !== undefined) {
    const validated = validateOverride(input.override);
    if (validated.ok) {
      return { ok: true, reason: "", findings: [] };
    }
    return { ok: false, reason: validated.reason, findings: [] };
  }

  return {
    ok: false,
    reason: namedFailure(input.row),
    findings: [admissionFinding(input.row)],
  };
}
