// @effect-diagnostics nodeBuiltinImport:off
/**
 * G2 WORK-000035 disposition enforcement tests.
 *
 * These tests prove the six pin outputs are dispositioned and that codec
 * work stays forbidden while typed equality is unresolved. They do not
 * claim pin-complete language authority.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, describe, it } from "@effect/vitest";

import { loadG1bPackage } from "./g1bInventory.ts";
import {
  checkG2Disposition,
  computeG2ReviewedArtifactHash,
  G2_OUTPUT_IDS,
  loadG2Package,
  REQUIRED_FORBIDDEN_WORK,
  type G2Gap,
} from "./g2Disposition.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const g2Dir = join(repoRoot, "docs/scm/g2");

describe("G2 WORK-000035 disposition", () => {
  it("loads the G2 package and keeps G1B downstream flags false", () => {
    const pkg = loadG2Package(repoRoot);
    assert.equal(pkg.manifest.gate, "G2");
    assert.equal(pkg.manifest.status, "completed");
    assert.equal(pkg.manifest.authorized, true);
    assert.equal(pkg.manifest.completed, true);
    assert.ok(pkg.manifest.review);
    assert.equal(pkg.manifest.review.status, "approved");
    assert.equal(pkg.manifest.review.reviewedArtifactHash, computeG2ReviewedArtifactHash(pkg));
    assert.equal(existsSync(join(g2Dir, "work-000035-disposition.json")), true);
    assert.equal(existsSync(join(g2Dir, "rationale.md")), true);
    const g1b = loadG1bPackage(repoRoot);
    assert.equal(g1b.manifest.g3Authorized, false);
    assert.equal(g1b.manifest.g4toG7Authorized, false);
    assert.equal(g1b.manifest.g1Closed, true);
  });

  it("accepts the six-row deferred on-disk record", () => {
    const pkg = loadG2Package(repoRoot);
    const result = checkG2Disposition(pkg);
    assert.equal(
      result.ok,
      true,
      result.ok ? "" : result.failures.map((row) => row.message).join("\n"),
    );
    assert.deepEqual(
      pkg.disposition.outputs.map((row) => row.id),
      [...G2_OUTPUT_IDS],
    );
    for (const row of pkg.disposition.outputs) {
      assert.equal(row.status, "deferred");
    }
    assert.equal(pkg.disposition.capturePoint.status, "open");
    assert.equal(
      pkg.disposition.capturePoint.description,
      "after-governed-translation-before-can-encode",
    );
    const ir = pkg.disposition.outputs.find((row) => row.id === "typed-semantic-bindings");
    assert.ok(ir);
    assert.equal(ir.status, "deferred");
  });

  it("rejects missing, duplicate, and unknown output IDs", () => {
    const pkg = loadG2Package(repoRoot);
    const missing = structuredClone(pkg);
    missing.disposition.outputs = missing.disposition.outputs.filter(
      (row) => row.id !== "typed-semantic-bindings",
    );
    const missingResult = checkG2Disposition(missing);
    assert.equal(missingResult.ok, false);
    assert.ok(
      missingResult.ok === false &&
        missingResult.failures.some((row) => row.code === "output-id-set"),
    );

    const duplicate = structuredClone(pkg);
    duplicate.disposition.outputs.push({ ...duplicate.disposition.outputs[0]! });
    const duplicateResult = checkG2Disposition(duplicate);
    assert.equal(duplicateResult.ok, false);
    assert.ok(
      duplicateResult.ok === false &&
        duplicateResult.failures.some((row) => row.code === "output-id-set"),
    );

    const unknown = structuredClone(pkg);
    unknown.disposition.outputs[0] = { ...unknown.disposition.outputs[0]!, id: "invented-output" };
    const unknownResult = checkG2Disposition(unknown);
    assert.equal(unknownResult.ok, false);
    assert.ok(
      unknownResult.ok === false &&
        unknownResult.failures.some((row) => row.code === "output-id-set"),
    );
  });

  it("rejects empty or non-pointer source version", () => {
    const pkg = loadG2Package(repoRoot);
    const emptyVersion = structuredClone(pkg);
    emptyVersion.disposition.sourceVersion = "";
    const emptyResult = checkG2Disposition(emptyVersion);
    assert.equal(emptyResult.ok, false);
    assert.ok(
      emptyResult.ok === false && emptyResult.failures.some((row) => row.code === "source-version"),
    );

    const bareToken = structuredClone(pkg);
    bareToken.disposition.sourceVersion = "not-a-hash-or-pointer";
    const bareResult = checkG2Disposition(bareToken);
    assert.equal(bareResult.ok, false);
    assert.ok(
      bareResult.ok === false && bareResult.failures.some((row) => row.code === "source-version"),
    );
  });

  it("rejects present rows missing evidence, scope, or applicability", () => {
    const pkg = loadG2Package(repoRoot);
    const basePresent = {
      ...pkg.disposition.outputs[0]!,
      status: "present",
      evidence: ["t2.asd-ste100.json"],
      owner: "t2-asd-ste100",
      versionIdentity:
        "t2.asd-ste100.json#vocabularySha256=db49e0d73a35392c190ed529034f4e4a354af54519eb6c88ad7105cbf7e3884e",
      effectiveScope: "mechanical-subset-admission",
      applicableBecause: "named T2 profile for outward communication",
    };
    delete (basePresent as { gap?: unknown }).gap;

    const cases: ReadonlyArray<{ patch: Record<string, unknown>; code: string }> = [
      { patch: { evidence: [] }, code: "present-evidence" },
      { patch: { owner: "" }, code: "present-evidence" },
      { patch: { versionIdentity: "" }, code: "present-evidence" },
      { patch: { effectiveScope: "" }, code: "present-scope" },
      { patch: { applicableBecause: "" }, code: "present-scope" },
    ];
    for (const { patch, code } of cases) {
      const mutated = structuredClone(pkg);
      mutated.disposition.outputs[0] = { ...basePresent, ...patch };
      const result = checkG2Disposition(mutated);
      assert.equal(result.ok, false, JSON.stringify(patch));
      assert.ok(
        result.ok === false && result.failures.some((row) => row.code === code),
        JSON.stringify(patch),
      );
    }
  });

  it("rejects present evidence whose T2-owned path does not exist", () => {
    const pkg = loadG2Package(repoRoot);
    const mutated = structuredClone(pkg);
    mutated.disposition.outputs[0] = {
      ...mutated.disposition.outputs[0]!,
      status: "present",
      evidence: ["docs/scm/g2/missing-evidence.json"],
      owner: "t2-asd-ste100",
      versionIdentity:
        "t2.asd-ste100.json#vocabularySha256=db49e0d73a35392c190ed529034f4e4a354af54519eb6c88ad7105cbf7e3884e",
      effectiveScope: "mechanical-subset-admission",
      applicableBecause: "named T2 profile",
    };
    delete mutated.disposition.outputs[0]!.gap;
    const result = checkG2Disposition(mutated);
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.failures.some((row) => row.code === "evidence-path"));
  });

  it("rejects deferred rows missing gap fields", () => {
    const pkg = loadG2Package(repoRoot);
    const cases: ReadonlyArray<Partial<G2Gap>> = [
      { gapId: "" },
      { steward: "" },
      { consequence: "" },
      { forbiddenWork: [] },
    ];
    for (const patch of cases) {
      const mutated = structuredClone(pkg);
      mutated.disposition.outputs[0] = {
        ...mutated.disposition.outputs[0]!,
        gap: { ...mutated.disposition.outputs[0]!.gap!, ...patch },
      };
      const result = checkG2Disposition(mutated);
      assert.equal(result.ok, false, JSON.stringify(patch));
      assert.ok(
        result.ok === false && result.failures.some((row) => row.code === "deferred-gap"),
        JSON.stringify(patch),
      );
    }
  });

  it("rejects typed IR absence without explicit deferral", () => {
    const pkg = loadG2Package(repoRoot);
    const mutated = structuredClone(pkg);
    const ir = mutated.disposition.outputs.find((row) => row.id === "typed-semantic-bindings");
    assert.ok(ir);
    ir.status = "present";
    ir.evidence = [];
    ir.owner = "";
    ir.versionIdentity = "";
    delete ir.gap;
    const result = checkG2Disposition(mutated);
    assert.equal(result.ok, false);
    assert.ok(
      result.ok === false &&
        result.failures.some((row) => row.code === "typed-ir" || row.code === "present-evidence"),
    );
  });

  it("rejects not-applicable without source-law steward or A3 approval identity", () => {
    const pkg = loadG2Package(repoRoot);
    const mutated = structuredClone(pkg);
    const first = mutated.disposition.outputs[0]!;
    delete first.gap;
    mutated.disposition.outputs[0] = {
      ...first,
      status: "not-applicable",
      notApplicable: { rationale: "", steward: "" },
    };
    const result = checkG2Disposition(mutated);
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.failures.some((row) => row.code === "not-applicable"));

    const missingApproval = structuredClone(pkg);
    delete missingApproval.disposition.outputs[0]!.gap;
    missingApproval.disposition.outputs[0] = {
      ...missingApproval.disposition.outputs[0]!,
      status: "not-applicable",
      notApplicable: {
        rationale: "source-law says this output is outside T2 ownership",
        steward: "t2-10000-foot-steward",
      },
    };
    const missingApprovalResult = checkG2Disposition(missingApproval);
    assert.equal(missingApprovalResult.ok, false);
    assert.ok(
      missingApprovalResult.ok === false &&
        missingApprovalResult.failures.some((row) => row.code === "not-applicable"),
    );

    const wrongApproval = structuredClone(pkg);
    delete wrongApproval.disposition.outputs[0]!.gap;
    wrongApproval.disposition.outputs[0] = {
      ...wrongApproval.disposition.outputs[0]!,
      status: "not-applicable",
      notApplicable: {
        rationale: "source-law says this output is outside T2 ownership",
        steward: "t2-10000-foot-steward",
        approvalIdentity: "invented-approver",
      },
    };
    const wrongApprovalResult = checkG2Disposition(wrongApproval);
    assert.equal(wrongApprovalResult.ok, false);
    assert.ok(
      wrongApprovalResult.ok === false &&
        wrongApprovalResult.failures.some((row) => row.code === "not-applicable"),
    );
  });

  it("rejects Issue 9 body text in evidence pointers", () => {
    const pkg = loadG2Package(repoRoot);
    const mutated = structuredClone(pkg);
    mutated.disposition.outputs[0] = {
      ...mutated.disposition.outputs[0]!,
      evidence: [
        "Issue 9: A sentence of more than twenty words that copies restricted lexicon source into git against R15.",
      ],
    };
    const result = checkG2Disposition(mutated);
    assert.equal(result.ok, false);
    assert.ok(
      result.ok === false && result.failures.some((row) => row.code === "restricted-source"),
    );
  });

  it("allows a T2-SQUARED-References pointer without copying source text", () => {
    const pkg = loadG2Package(repoRoot);
    const mutated = structuredClone(pkg);
    mutated.disposition.outputs[0] = {
      ...mutated.disposition.outputs[0]!,
      evidence: [
        ...mutated.disposition.outputs[0]!.evidence,
        "T2-SQUARED-References/work-000035-pin.md",
      ],
    };
    mutated.manifest.review = {
      ...mutated.manifest.review!,
      reviewedArtifactHash: computeG2ReviewedArtifactHash(mutated),
    };
    const result = checkG2Disposition(mutated);
    assert.equal(
      result.ok,
      true,
      result.ok ? "" : result.failures.map((row) => row.message).join("\n"),
    );
  });

  it("requires mandatory codec bans while typed IR is deferred", () => {
    const pkg = loadG2Package(repoRoot);
    const result = checkG2Disposition(pkg);
    assert.equal(
      result.ok,
      true,
      result.ok ? "" : result.failures.map((row) => row.message).join("\n"),
    );
    assert.ok(result.ok === true);
    for (const item of REQUIRED_FORBIDDEN_WORK) {
      assert.ok(result.forbiddenWork.includes(item), item);
    }

    const mutated = structuredClone(pkg);
    const ir = mutated.disposition.outputs.find((row) => row.id === "typed-semantic-bindings");
    assert.ok(ir?.gap);
    ir.gap.forbiddenWork = ir.gap.forbiddenWork.filter((item) => item !== "scm-can-codec");
    const forbiddenResult = checkG2Disposition(mutated);
    assert.equal(forbiddenResult.ok, false);
    assert.ok(
      forbiddenResult.ok === false &&
        forbiddenResult.failures.some((row) => row.code === "forbidden-work"),
    );
  });

  it("rejects completion that authorizes later gates", () => {
    const pkg = loadG2Package(repoRoot);
    const mutated = structuredClone(pkg);
    mutated.manifest.status = "completed";
    mutated.manifest.authorized = true;
    mutated.manifest.completed = true;
    mutated.manifest.doesNotAuthorizeLaterGates = false;
    mutated.manifest.g4toG7Authorized = true;
    const result = checkG2Disposition(mutated);
    assert.equal(result.ok, false);
    assert.ok(
      result.ok === false &&
        result.failures.some(
          (row) => row.code === "later-gates" || row.code === "g4-g7-authorized",
        ),
    );
  });

  it("enforces legal authorized / in-progress / completed tuples", () => {
    const pkg = loadG2Package(repoRoot);
    const illegal = structuredClone(pkg);
    illegal.manifest.status = "planned-not-authorized";
    illegal.manifest.authorized = true;
    illegal.manifest.completed = false;
    const illegalResult = checkG2Disposition(illegal);
    assert.equal(illegalResult.ok, false);
    assert.ok(
      illegalResult.ok === false &&
        illegalResult.failures.some((row) => row.code === "manifest-tuple"),
    );
  });

  it("rejects completed review that is missing, withheld, or not independent", () => {
    const pkg = loadG2Package(repoRoot);
    const completed = structuredClone(pkg);
    completed.manifest.status = "completed";
    completed.manifest.authorized = true;
    completed.manifest.completed = true;
    completed.manifest.doesNotAuthorizeLaterGates = true;
    completed.manifest.g4toG7Authorized = false;

    const noReview = structuredClone(completed);
    delete (noReview.manifest as { review?: unknown }).review;
    const noReviewResult = checkG2Disposition(noReview);
    assert.equal(noReviewResult.ok, false);
    assert.ok(
      noReviewResult.ok === false && noReviewResult.failures.some((row) => row.code === "review"),
    );

    const withheld = structuredClone(completed);
    const withheldReview = withheld.manifest.review;
    assert.ok(withheldReview);
    withheld.manifest.review = {
      ...withheldReview,
      status: "withheld",
      reviewedArtifactHash: "",
    };
    const withheldResult = checkG2Disposition(withheld);
    assert.equal(withheldResult.ok, false);
    assert.ok(
      withheldResult.ok === false && withheldResult.failures.some((row) => row.code === "review"),
    );

    const dependent = structuredClone(completed);
    dependent.manifest.review = {
      status: "approved",
      identity: "codex-independent-review",
      independentOfImplementationAuthor: false,
      reviewedArtifactHash: "a".repeat(64),
      note: "dependent",
    };
    const dependentResult = checkG2Disposition(dependent);
    assert.equal(dependentResult.ok, false);
    assert.ok(
      dependentResult.ok === false && dependentResult.failures.some((row) => row.code === "review"),
    );

    const wrongIdentity = structuredClone(completed);
    wrongIdentity.manifest.review = {
      status: "approved",
      identity: "self-review",
      independentOfImplementationAuthor: true,
      reviewedArtifactHash: "a".repeat(64),
      note: "wrong identity",
    };
    const wrongIdentityResult = checkG2Disposition(wrongIdentity);
    assert.equal(wrongIdentityResult.ok, false);
    assert.ok(
      wrongIdentityResult.ok === false &&
        wrongIdentityResult.failures.some((row) => row.code === "review"),
    );

    const unboundHash = structuredClone(completed);
    unboundHash.manifest.review = {
      status: "approved",
      identity: "codex-independent-review",
      independentOfImplementationAuthor: true,
      reviewedArtifactHash: "a".repeat(64),
      note: "format-valid hash not bound to artifacts",
    };
    const unboundHashResult = checkG2Disposition(unboundHash);
    assert.equal(unboundHashResult.ok, false);
    assert.ok(
      unboundHashResult.ok === false &&
        unboundHashResult.failures.some((row) => row.code === "review"),
    );
  });

  it("rejects completed review whose digest is bound to a spoofed identity or dependent author", () => {
    const pkg = loadG2Package(repoRoot);
    const bind = (identity: string, independent: boolean) => {
      const next = structuredClone(pkg);
      next.manifest.status = "completed";
      next.manifest.authorized = true;
      next.manifest.completed = true;
      next.manifest.doesNotAuthorizeLaterGates = true;
      next.manifest.g4toG7Authorized = false;
      next.manifest.review = {
        status: "approved",
        identity,
        independentOfImplementationAuthor: independent,
        reviewedArtifactHash: "",
        note: "spoofed identity still hashed",
      };
      next.manifest.review.reviewedArtifactHash = computeG2ReviewedArtifactHash(next);
      return next;
    };

    const dependentResult = checkG2Disposition(bind("codex-independent-review", false));
    assert.equal(dependentResult.ok, false);
    assert.ok(
      dependentResult.ok === false && dependentResult.failures.some((row) => row.code === "review"),
    );

    const wrongIdentityResult = checkG2Disposition(bind("self-review", true));
    assert.equal(wrongIdentityResult.ok, false);
    assert.ok(
      wrongIdentityResult.ok === false &&
        wrongIdentityResult.failures.some((row) => row.code === "review"),
    );
  });

  it("returns shape failures instead of throwing on malformed disposition JSON", () => {
    const pkg = loadG2Package(repoRoot);
    const missingOutputs = structuredClone(pkg);
    (missingOutputs.disposition as { outputs?: unknown }).outputs = undefined;
    const missingOutputsResult = checkG2Disposition(missingOutputs);
    assert.equal(missingOutputsResult.ok, false);
    assert.ok(
      missingOutputsResult.ok === false &&
        missingOutputsResult.failures.some((row) => row.code === "shape"),
    );

    const missingCapture = structuredClone(pkg);
    (missingCapture.disposition as { capturePoint?: unknown }).capturePoint = null;
    const missingCaptureResult = checkG2Disposition(missingCapture);
    assert.equal(missingCaptureResult.ok, false);
    assert.ok(
      missingCaptureResult.ok === false &&
        missingCaptureResult.failures.some((row) => row.code === "shape"),
    );

    const members: ReadonlyArray<unknown> = [null, 42, {}];
    for (const member of members) {
      const mutated = structuredClone(pkg);
      mutated.disposition.outputs = [member as (typeof mutated.disposition.outputs)[number]];
      const result = checkG2Disposition(mutated);
      assert.equal(result.ok, false, JSON.stringify(member));
      assert.ok(
        result.ok === false && result.failures.some((row) => row.code === "shape"),
        JSON.stringify(member),
      );
    }

    const nonStringEvidence = structuredClone(pkg);
    nonStringEvidence.disposition.outputs[0] = {
      ...nonStringEvidence.disposition.outputs[0]!,
      evidence: [null as unknown as string],
    };
    const nonStringEvidenceResult = checkG2Disposition(nonStringEvidence);
    assert.equal(nonStringEvidenceResult.ok, false);
    assert.ok(
      nonStringEvidenceResult.ok === false &&
        nonStringEvidenceResult.failures.some((row) => row.code === "shape"),
    );

    const nullReview = structuredClone(pkg);
    (nullReview.manifest as { review?: unknown }).review = null;
    const nullReviewResult = checkG2Disposition(nullReview);
    assert.equal(nullReviewResult.ok, false);
    assert.ok(
      nullReviewResult.ok === false &&
        nullReviewResult.failures.some((row) => row.code === "review" || row.code === "shape"),
    );

    const nullGap = structuredClone(pkg);
    (nullGap.disposition.outputs[0] as { gap?: unknown }).gap = null;
    const nullGapResult = checkG2Disposition(nullGap);
    assert.equal(nullGapResult.ok, false);
    assert.ok(
      nullGapResult.ok === false &&
        nullGapResult.failures.some((row) => row.code === "deferred-gap" || row.code === "shape"),
    );
  });

  it("binds completed review hash to G2 artifacts and rejects one-byte drift", () => {
    const pkg = loadG2Package(repoRoot);
    const approve = () => {
      const next = structuredClone(pkg);
      next.manifest.status = "completed";
      next.manifest.authorized = true;
      next.manifest.completed = true;
      next.manifest.doesNotAuthorizeLaterGates = true;
      next.manifest.g4toG7Authorized = false;
      next.manifest.review = {
        status: "approved",
        identity: "codex-independent-review",
        independentOfImplementationAuthor: true,
        reviewedArtifactHash: "",
        note: "bound",
      };
      next.manifest.review.reviewedArtifactHash = computeG2ReviewedArtifactHash(next);
      return next;
    };

    const bound = approve();
    const boundResult = checkG2Disposition(bound);
    assert.equal(
      boundResult.ok,
      true,
      boundResult.ok ? "" : boundResult.failures.map((row) => row.message).join("\n"),
    );

    const rationaleDrift = approve();
    rationaleDrift.rationale = `${rationaleDrift.rationale}x`;
    const rationaleResult = checkG2Disposition(rationaleDrift);
    assert.equal(rationaleResult.ok, false);
    assert.ok(
      rationaleResult.ok === false && rationaleResult.failures.some((row) => row.code === "review"),
    );

    const dispositionDrift = approve();
    dispositionDrift.disposition.pin = "WORK-000036";
    const dispositionResult = checkG2Disposition(dispositionDrift);
    assert.equal(dispositionResult.ok, false);
    assert.ok(
      dispositionResult.ok === false &&
        dispositionResult.failures.some((row) => row.code === "review"),
    );

    const manifestDrift = approve();
    const auth = (
      manifestDrift.manifest as {
        authorization?: { identity?: string; scope?: string; note?: string };
      }
    ).authorization;
    (
      manifestDrift.manifest as {
        authorization?: { identity?: string; scope?: string; note?: string };
      }
    ).authorization = {
      identity: auth?.identity ?? "human-operator",
      scope: auth?.scope ?? "g2-execution",
      note: `${auth?.note ?? ""}x`,
    };
    manifestDrift.manifest.review = {
      ...manifestDrift.manifest.review!,
      reviewedArtifactHash: bound.manifest.review!.reviewedArtifactHash,
    };
    const manifestResult = checkG2Disposition(manifestDrift);
    assert.equal(manifestResult.ok, false);
    assert.ok(
      manifestResult.ok === false && manifestResult.failures.some((row) => row.code === "review"),
    );
  });

  it("names remaining gaps and codec bans in rationale", () => {
    const text = readFileSync(join(g2Dir, "rationale.md"), "utf8");
    for (const id of G2_OUTPUT_IDS) {
      assert.ok(text.includes(id), id);
    }
    assert.ok(text.includes("codec"));
    const readme = readFileSync(join(g2Dir, "README.md"), "utf8");
    assert.ok(readme.includes("does not authorize G4"));
  });
});
