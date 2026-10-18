// @effect-diagnostics nodeBuiltinImport:off
/**
 * G4 W1 word-type enforcement tests.
 *
 * These tests prove ethos slots exist as T2 types with canonical
 * absence and independent ages. They do not license encodings.
 */
import { assert, describe, it } from "@effect/vitest";

import { loadG3Package } from "./g3Topology.ts";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CANONICAL_ABSENCE,
  checkG4,
  checkW1Word,
  computeG4ReviewedArtifactHash,
  loadG4Package,
  REQUIRED_W1_SLOTS,
} from "./g4Word.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const validWord = {
  bus_id: "bus.rpc",
  node_id: "node.rpc",
  fundamental_state: "idle",
  fundamental_request: CANONICAL_ABSENCE,
  state_age: 0,
  request_age: 0,
  modifier_start: "modifier_start",
  null: "null",
} as const;

describe("G4 W1 word types", () => {
  it("accepts a W1 word with ethos slots and named canonical absence", () => {
    const result = checkW1Word(validWord);
    assert.equal(
      result.ok,
      true,
      result.ok ? "" : result.failures.map((row) => row.message).join("\n"),
    );
    assert.ok(result.ok === true);
    assert.equal(result.word.fundamental_request, CANONICAL_ABSENCE);
    assert.equal(result.word.state_age, 0);
    assert.equal(result.word.request_age, 0);
    for (const slot of REQUIRED_W1_SLOTS) {
      assert.ok(slot in result.word, slot);
    }
  });

  it("binds bus_id to a G3 origin/home bus without encoding", () => {
    const g3 = loadG3Package(repoRoot);
    const mapping = g3.topology.mappings.find((row) => row.comm_id === "INV-T2-RPC-WS");
    assert.ok(mapping);
    const result = checkW1Word({
      ...validWord,
      bus_id: mapping.origin_bus_id,
      node_id: mapping.node_id,
    });
    assert.equal(
      result.ok,
      true,
      result.ok ? "" : result.failures.map((row) => row.message).join("\n"),
    );
    assert.ok(result.ok === true);
    assert.equal(result.word.bus_id, mapping.home_bus_id);
  });

  it("rejects W0 omitted request and a single shared life counter", () => {
    const omitted = { ...validWord } as { fundamental_request?: string };
    delete omitted.fundamental_request;
    const omittedResult = checkW1Word(omitted);
    assert.equal(omittedResult.ok, false);
    assert.ok(
      omittedResult.ok === false && omittedResult.failures.some((row) => row.code === "w0-request"),
    );

    const sharedAge = { ...validWord, life_age: 3 };
    delete (sharedAge as { state_age?: number }).state_age;
    delete (sharedAge as { request_age?: number }).request_age;
    const sharedResult = checkW1Word(sharedAge);
    assert.equal(sharedResult.ok, false);
    assert.ok(
      sharedResult.ok === false && sharedResult.failures.some((row) => row.code === "w0-age"),
    );
  });

  it("rejects encodings, nibble alphabets, and wire values on placeholders", () => {
    const encoded = {
      ...validWord,
      nibble_alphabet: "0123456789abcdef",
      encoding: "can-nibble",
    };
    const encodedResult = checkW1Word(encoded);
    assert.equal(encodedResult.ok, false);
    assert.ok(
      encodedResult.ok === false && encodedResult.failures.some((row) => row.code === "encoding"),
    );

    const wired = { ...validWord, modifier_start: 0x1a, null: 0 };
    const wiredResult = checkW1Word(wired);
    assert.equal(wiredResult.ok, false);
    assert.ok(
      wiredResult.ok === false && wiredResult.failures.some((row) => row.code === "placeholder"),
    );
  });

  it("keeps state_age and request_age independent", () => {
    const result = checkW1Word({ ...validWord, state_age: 4, request_age: 1 });
    assert.equal(
      result.ok,
      true,
      result.ok ? "" : result.failures.map((row) => row.message).join("\n"),
    );
    assert.ok(result.ok === true);
    assert.equal(result.word.state_age, 4);
    assert.equal(result.word.request_age, 1);
    assert.notEqual(result.word.state_age, result.word.request_age);
  });

  it("rejects missing, null, non-finite, and collapsed ages plus malformed envelopes", () => {
    const nullRequest = checkW1Word({ ...validWord, fundamental_request: null });
    assert.equal(nullRequest.ok, false);
    assert.ok(
      nullRequest.ok === false && nullRequest.failures.some((row) => row.code === "w0-request"),
    );

    const missingState = { ...validWord } as { state_age?: number };
    delete missingState.state_age;
    const missingStateResult = checkW1Word(missingState);
    assert.equal(missingStateResult.ok, false);
    assert.ok(
      missingStateResult.ok === false &&
        missingStateResult.failures.some((row) => row.code === "w0-age"),
    );

    for (const age of [Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5, "0"]) {
      const badState = checkW1Word({ ...validWord, state_age: age });
      const badRequest = checkW1Word({ ...validWord, request_age: age });
      assert.equal(badState.ok, false);
      assert.equal(badRequest.ok, false);
    }

    assert.equal(checkW1Word(null).ok, false);
    assert.equal(checkW1Word([]).ok, false);
  });

  it("rejects encoding-shaped keys, dictionary keys, and unknown extra fields", () => {
    for (const key of [
      "codec",
      "wire_value",
      "dictionary",
      "byte",
      "bit",
      "nibble",
      "production_encoding",
    ]) {
      const result = checkW1Word({ ...validWord, [key]: 1 });
      assert.equal(result.ok, false, key);
      assert.ok(result.ok === false && result.failures.some((row) => row.code === "encoding"));
    }

    const extra = checkW1Word({ ...validWord, invented_slot: "nope" });
    assert.equal(extra.ok, false);
    assert.ok(extra.ok === false && extra.failures.some((row) => row.code === "slot"));
  });

  it("treats a second absence spelling as a present request, not canonical absence", () => {
    const result = checkW1Word({ ...validWord, fundamental_request: "none" });
    assert.equal(
      result.ok,
      true,
      result.ok ? "" : result.failures.map((row) => row.message).join("\n"),
    );
    assert.ok(result.ok === true);
    assert.notEqual(result.word.fundamental_request, CANONICAL_ABSENCE);
  });

  it("accepts optional prototype modifiers between placeholders", () => {
    const result = checkW1Word({ ...validWord, modifiers: ["attn-low"] });
    assert.equal(
      result.ok,
      true,
      result.ok ? "" : result.failures.map((f) => f.message).join("\n"),
    );
    assert.ok(result.ok === true);
    assert.deepEqual(result.word.modifiers, ["attn-low"]);
  });

  it("defaults missing modifiers to empty array", () => {
    const result = checkW1Word(validWord);
    assert.ok(result.ok === true);
    assert.deepEqual(result.word.modifiers, []);
  });

  it("rejects non-array or empty-string modifiers", () => {
    assert.equal(checkW1Word({ ...validWord, modifiers: "x" }).ok, false);
    assert.equal(checkW1Word({ ...validWord, modifiers: [""] }).ok, false);
  });
});

describe("G4 package completeness", () => {
  it("rejects withheld, wrong-identity, arbitrary-hash, and one-byte-drift completion", () => {
    const pkg = loadG4Package(repoRoot);
    const disk = checkG4(pkg);
    assert.equal(disk.ok, true, disk.ok ? "" : disk.failures.map((row) => row.message).join("\n"));
    assert.equal(pkg.manifest.doesNotAuthorizeLaterGates, true);
    assert.equal(pkg.manifest.g6toG10Authorized, false);

    const completed = structuredClone(pkg);
    completed.manifest.status = "completed";
    completed.manifest.authorized = true;
    completed.manifest.completed = true;

    const withheld = structuredClone(completed);
    const withheldReview = withheld.manifest.review;
    assert.ok(withheldReview);
    withheld.manifest.review = {
      ...withheldReview,
      status: "withheld",
      reviewedArtifactHash: "",
    };
    const withheldResult = checkG4(withheld);
    assert.equal(withheldResult.ok, false);
    assert.ok(
      withheldResult.ok === false && withheldResult.failures.some((row) => row.code === "review"),
    );

    const bind = (identity: string, independent: boolean, note: string) => {
      const next = structuredClone(completed);
      next.manifest.review = {
        status: "approved",
        identity,
        independentOfImplementationAuthor: independent,
        reviewedArtifactHash: "",
        note,
      };
      next.manifest.review.reviewedArtifactHash = computeG4ReviewedArtifactHash(next);
      return next;
    };

    const wrongIdentity = checkG4(bind("self-review", true, "wrong identity"));
    assert.equal(wrongIdentity.ok, false);
    assert.ok(
      wrongIdentity.ok === false && wrongIdentity.failures.some((row) => row.code === "review"),
    );

    const dependent = checkG4(bind("codex-independent-review", false, "dependent"));
    assert.equal(dependent.ok, false);
    assert.ok(dependent.ok === false && dependent.failures.some((row) => row.code === "review"));

    const unbound = structuredClone(completed);
    unbound.manifest.review = {
      status: "approved",
      identity: "codex-independent-review",
      independentOfImplementationAuthor: true,
      reviewedArtifactHash: "a".repeat(64),
      note: "unbound",
    };
    const unboundResult = checkG4(unbound);
    assert.equal(unboundResult.ok, false);
    assert.ok(
      unboundResult.ok === false && unboundResult.failures.some((row) => row.code === "review"),
    );

    const bound = bind("codex-independent-review", true, "bound");
    const boundResult = checkG4(bound);
    assert.equal(
      boundResult.ok,
      true,
      boundResult.ok ? "" : boundResult.failures.map((row) => row.message).join("\n"),
    );

    const drift = structuredClone(bound);
    drift.manifest.authorization = {
      ...drift.manifest.authorization,
      note: `${drift.manifest.authorization.note}x`,
    };
    const driftResult = checkG4(drift);
    assert.equal(driftResult.ok, false);
    assert.ok(
      driftResult.ok === false && driftResult.failures.some((row) => row.code === "review"),
    );
  });

  it("rejects later-gate authorization flags", () => {
    const pkg = loadG4Package(repoRoot);
    const mutated = structuredClone(pkg);
    mutated.manifest.g6toG10Authorized = true;
    mutated.manifest.doesNotAuthorizeLaterGates = false;
    const result = checkG4(mutated);
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.failures.some((row) => row.code === "later-gates"));
  });
});
