import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  approvedFormsSet,
  checkApprovedForms,
  checkApprovedPartOfSpeech,
  extractStructuredLexicalEntries,
  loadStructuredLexicalAuthority,
  parseStructuredLexicalAuthority,
  StructuredLexicalAuthorityError,
  type StructuredLexicalAuthority,
} from "./structured-authority.ts";
import { checkVocabularyMembership } from "../membership.ts";

const FIXTURE_TEXTS = [
  "QZVSTEREMOVE (v),",
  "QZVSTEREMOVES,",
  "QZVSTEREMOVED,",
  "QZVSTEREMOVED",
  "QZVSTEREMOVE (v), To take a part away from a unit",
  "qzvstebuild (v)",
  "QZVSTEAID (n)",
  "QZVSTECLEAN (adj)",
  "QZVSTECLEAN (v)",
  "QZVSTESLOW (adj) (QZVSTESLOWER, QZVSTESLOWEST)",
];

function digest(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

describe("extractStructuredLexicalEntries", () => {
  it("keeps approved lemma, POS, pure form lines, and meaning digests without definition text", () => {
    const extracted = extractStructuredLexicalEntries(FIXTURE_TEXTS);
    const remove = extracted.entries.find(
      (entry) => entry.lemma === "qzvsteremove" && entry.pos === "v" && entry.approved,
    );
    assert.ok(remove);
    assert.deepEqual(remove.forms.sort(), [
      "qzvsteremove",
      "qzvsteremoved",
      "qzvsteremoves",
    ]);
    assert.equal(remove.meaningDigests.length > 0, true);
    assert.equal(JSON.stringify(extracted).includes("take a part"), false);

    const build = extracted.entries.find(
      (entry) => entry.lemma === "qzvstebuild" && entry.pos === "v",
    );
    assert.ok(build);
    assert.equal(build.approved, false);

    const slow = extracted.entries.find(
      (entry) => entry.lemma === "qzvsteslow" && entry.pos === "adj" && entry.approved,
    );
    assert.ok(slow);
    assert.equal(slow.forms.includes("qzvsteslower"), true);
    assert.equal(slow.forms.includes("qzvsteslowest"), true);
  });

  it("does not treat STE example ALLCAPS as verb forms", () => {
    const extracted = extractStructuredLexicalEntries([
      "QZVSTEFOLLOW (v), To come after QZVSTEPUMP ASSEMBLY",
      "QZVSTEFOLLOWS, after THE QZVSTEPUMP",
    ]);
    const follow = extracted.entries.find(
      (entry) => entry.lemma === "qzvstefollow" && entry.pos === "v" && entry.approved,
    );
    assert.ok(follow);
    assert.equal(follow.forms.includes("qzvstepump"), false);
    assert.equal(follow.forms.includes("assembly"), false);
  });
});

describe("parseStructuredLexicalAuthority", () => {
  it("fails closed on malformed authority", () => {
    assert.throws(
      () => parseStructuredLexicalAuthority(Buffer.from("{")),
      (error: unknown) => error instanceof StructuredLexicalAuthorityError,
    );
    assert.throws(
      () =>
        parseStructuredLexicalAuthority(
          Buffer.from(JSON.stringify({ coverageKind: "wrong", entries: [] })),
        ),
      (error: unknown) => error instanceof StructuredLexicalAuthorityError,
    );
  });

  it("loads digest-pinned authority and rejects mismatch", () => {
    const extracted = extractStructuredLexicalEntries(FIXTURE_TEXTS);
    const body = `${JSON.stringify(extracted)}\n`;
    const dir = mkdtempSync(path.join(tmpdir(), "t2-struct-auth-"));
    const filePath = path.join(dir, "structured-lexical-authority.json");
    writeFileSync(filePath, body);
    const sha = digest(body);
    const loaded = loadStructuredLexicalAuthority({
      filePath,
      expectedSha256: sha,
    });
    assert.equal(loaded.entryCount, extracted.entryCount);
    assert.throws(
      () =>
        loadStructuredLexicalAuthority({
          filePath,
          expectedSha256: "0".repeat(64),
        }),
      (error: unknown) => error instanceof StructuredLexicalAuthorityError,
    );
  });

  it("fails closed when the private structured authority file is missing", () => {
    assert.throws(
      () =>
        loadStructuredLexicalAuthority({
          filePath: path.join(tmpdir(), "missing-structured-lexical-authority.json"),
          expectedSha256: "0".repeat(64),
        }),
      (error: unknown) => error instanceof StructuredLexicalAuthorityError,
    );
  });
});

describe("approved forms and POS checkers", () => {
  function authority(): StructuredLexicalAuthority {
    return extractStructuredLexicalEntries(FIXTURE_TEXTS);
  }

  it("accepts an approved form and rejects a disallowed invented form token when listed against a non-approved head", () => {
    const auth = authority();
    const forms = approvedFormsSet(auth);
    assert.equal(forms.has("qzvsteremoved"), true);
    assert.equal(forms.has("qzvsteremoving"), false);

    const ok = checkApprovedForms({
      path: "x.md",
      line: 1,
      column: 1,
      text: "Qzvsteremove the unit.",
      authority: auth,
    });
    assert.equal(ok.length, 0);

    const bad = checkApprovedForms({
      path: "x.md",
      line: 1,
      column: 1,
      text: "Qzvstebuild the unit.",
      authority: auth,
    });
    assert.equal(
      bad.some((finding) => finding.ruleId === "ASD-STE100-1.4"),
      true,
    );

    const approvedAlso = checkApprovedForms({
      path: "x.md",
      line: 1,
      column: 1,
      text: "Qzvsteremove the unit.",
      authority: auth,
    });
    assert.equal(approvedAlso.length, 0);
  });

  it("flags a verb-only lemma after an article when POS is determinate", () => {
    const auth = authority();
    const findings = checkApprovedPartOfSpeech({
      path: "x.md",
      line: 1,
      column: 1,
      text: "Open the qzvsteremove.",
      authority: auth,
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-1.2"),
      true,
    );
  });

  it("does not invent a POS pass for multi-POS lemmas", () => {
    const auth = authority();
    const findings = checkApprovedPartOfSpeech({
      path: "x.md",
      line: 1,
      column: 1,
      text: "Keep the qzvsteclean surface.",
      authority: auth,
    });
    assert.equal(
      findings.some((finding) => finding.ruleId === "ASD-STE100-1.2"),
      false,
    );
  });

  it("expands Rule 1.1 membership with approved forms from structured authority", () => {
    const auth = authority();
    const lemmas = new Set(["qzvsteremove"]);
    const withoutForms = checkVocabularyMembership({
      path: "x.md",
      line: 1,
      column: 1,
      text: "Qzvsteremoved the unit.",
      approvedWords: new Set([...lemmas, "the", "unit"]),
      technicalTerms: [],
    });
    assert.equal(
      withoutForms.some(
        (finding) =>
          finding.ruleId === "ASD-STE100-1.1" && finding.message.includes("Qzvsteremoved"),
      ),
      true,
    );

    const withForms = checkVocabularyMembership({
      path: "x.md",
      line: 1,
      column: 1,
      text: "Qzvsteremoved the unit.",
      approvedWords: new Set([...lemmas, "the", "unit", ...approvedFormsSet(auth)]),
      technicalTerms: [],
    });
    assert.equal(withForms.length, 0);
  });

  it("keeps Rule 1.3 as review-required and never returns a mechanical meaning pass", () => {
    const auth = authority();
    assert.equal(
      auth.entries.some((entry) => entry.approved && entry.meaningDigests.length > 0),
      true,
    );
    assert.equal("checkApprovedMeaning" in globalThis, false);
  });
});
