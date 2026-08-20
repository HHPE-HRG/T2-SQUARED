import { createHash } from "node:crypto";

import { checkMechanicalRules } from "./rules.ts";
import type { Finding, RuleInput } from "./rules.ts";

export interface TraceResult {
  ok: boolean;
  reason: string;
  status: "accepted" | "blocked" | "not_applicable";
  findings: Array<Finding>;
}

export interface TraceFixture {
  promptBytes: string;
  conversationBytes: string;
  originSha256: string;
  conversationSha256: string;
  intentBytes: string;
  intentSha256: string;
  intentApproved: boolean;
  systemText: string;
  systemTextSha256: string;
  reviewSha256: string;
  reviewBody: string;
}

export interface RepairAttempt {
  text: string;
  sha256: string;
}

const PRODUCTION_COMMS_FIELDS = ["webhook", "manifold", "runtimeHook"] as const;

const fail = (reason: string, findings: Array<Finding> = []): TraceResult => ({
  ok: false,
  reason,
  status: "blocked",
  findings,
});

const pass = (status: TraceResult["status"] = "accepted"): TraceResult => ({
  ok: true,
  reason: "",
  status,
  findings: [],
});

function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function requireHash(label: string, bytes: string, expected: string): TraceResult | null {
  if (expected.trim() === "") {
    return fail(`missing ${label} hash link`);
  }
  if (sha256Utf8(bytes) !== expected) {
    return fail(`${label} hash mismatch`);
  }
  return null;
}

export function validateOriginHashes(fixture: TraceFixture): TraceResult {
  const origin = requireHash("origin", fixture.promptBytes, fixture.originSha256);
  if (origin !== null) {
    return origin;
  }
  const conversation = requireHash(
    "conversation",
    fixture.conversationBytes,
    fixture.conversationSha256,
  );
  if (conversation !== null) {
    return conversation;
  }
  return pass();
}

export function evaluateGeneratedText(input: {
  path: string;
  text: string;
  kind: RuleInput["kind"];
  claimedStatus: string;
}): TraceResult {
  const findings = checkMechanicalRules({
    path: input.path,
    line: 1,
    column: 1,
    text: input.text,
    kind: input.kind,
  });
  if (findings.length > 0) {
    return {
      ok: false,
      reason: "`generated` `text` `failed` mechanical `rules`",
      status: "blocked",
      findings,
    };
  }
  if (input.claimedStatus === "accepted") {
    return pass("accepted");
  }
  return pass("accepted");
}

export function validateRepair(input: {
  path: string;
  kind: RuleInput["kind"];
  attempts: Array<RepairAttempt>;
  finalText: string;
}): TraceResult {
  if (input.attempts.length === 0) {
    return fail("`repair-attempt` `hashes` `are` `required`");
  }
  for (const attempt of input.attempts) {
    const mismatch = requireHash("repair attempt", attempt.text, attempt.sha256);
    if (mismatch !== null) {
      return mismatch;
    }
  }
  const findings = checkMechanicalRules({
    path: input.path,
    line: 1,
    column: 1,
    text: input.finalText,
    kind: input.kind,
  });
  if (findings.length > 0) {
    return fail("`repaired` `text` `failed` mechanical `rules`", findings);
  }
  return pass();
}

export function validateTraceLinks(fixture: TraceFixture): TraceResult {
  const origin = validateOriginHashes(fixture);
  if (!origin.ok) {
    return origin;
  }
  const intent = requireHash("intent", fixture.intentBytes, fixture.intentSha256);
  if (intent !== null) {
    return intent;
  }
  if (fixture.intentApproved !== true) {
    return fail("missing approved `intent`");
  }
  const systemText = requireHash("system-text", fixture.systemText, fixture.systemTextSha256);
  if (systemText !== null) {
    return systemText;
  }
  const review = requireHash("review", fixture.reviewBody, fixture.reviewSha256);
  if (review !== null) {
    return review;
  }
  return pass();
}

export function evaluateIntentApplicability(input: { changedPaths: Array<string> }): TraceResult {
  const hasIntentArtifact = input.changedPaths.some((changedPath) =>
    /(?:^|\/)(?:intent|trace)\b|\.intent\./i.test(changedPath),
  );
  if (!hasIntentArtifact) {
    return pass("not_applicable");
  }
  return pass("accepted");
}

export function rejectProductionCommsFields(value: Record<string, unknown>): TraceResult {
  const present = PRODUCTION_COMMS_FIELDS.filter((field) => field in value);
  if (present.length > 0) {
    return fail(`production comms field is not permitted: ${present.join(", ")}`);
  }
  return pass();
}
