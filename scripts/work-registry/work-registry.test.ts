import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { PRODUCT_NAME, REQUIRED_WORK_REGISTRY_TERMS } from "./glossary.ts";
import {
  appendEpoch,
  checkDrift,
  checkWorkRegistry,
  compileCampaign,
  dumpWorkRegistry,
  lookupSchema,
  registerCampaign,
  WorkRegistryError,
} from "./registry.ts";

const SAMPLE_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function writeCampaign(input: {
  forgejoApproved?: boolean;
  humanApproved?: boolean;
  humanOverride?: boolean;
  proposal: string;
  extraMarkdown?: string;
  ideationFile?: boolean;
  schema?: string;
  schemaName?: string;
  progeny?: boolean;
  dualSchema?: boolean;
  omitGenesis?: boolean;
  omitIdentity?: boolean;
}): string {
  const dir = mkdtempSync(path.join(tmpdir(), "t2-work-registry-"));
  const schemaName = input.schemaName ?? "schema.json";
  writeFileSync(
    path.join(dir, "manifest.json"),
    `${JSON.stringify(
      {
        product: PRODUCT_NAME,
        campaign: "sample",
        proposal: "proposal.md",
        schema: schemaName,
        forgejoApproved: input.forgejoApproved ?? true,
        humanApproved: input.humanApproved ?? true,
        humanOverride: input.humanOverride ?? false,
      },
      null,
      2,
    )}\n`,
  );
  const forgejoApproved = input.forgejoApproved ?? true;
  const reviewId = forgejoApproved ? "41" : "none";
  const proposal =
    input.omitIdentity === true || /The Forgejo-review is `/.test(input.proposal)
      ? input.proposal
      : `${input.proposal.trim()}\nThe genesis is this campaign. The Forgejo-review is \`${reviewId}\`.\n`;
  writeFileSync(path.join(dir, "proposal.md"), proposal);
  if (input.omitGenesis !== true) {
    writeFileSync(
      path.join(dir, "genesis.json"),
      `${JSON.stringify(
        {
          kind: "genesis",
          campaign: "sample",
          commitSha: SAMPLE_SHA,
          forgejoReviewId: forgejoApproved ? "41" : null,
        },
        null,
        2,
      )}\n`,
    );
  }
  if (input.extraMarkdown !== undefined) {
    writeFileSync(path.join(dir, "biography.md"), input.extraMarkdown);
  }
  if (input.ideationFile === true) {
    mkdirSync(path.join(dir, "ideation"));
    writeFileSync(path.join(dir, "ideation", "notes.md"), "notes\n");
  }
  if (input.schema !== undefined) {
    writeFileSync(path.join(dir, schemaName), input.schema);
  }
  if (input.progeny === true) {
    mkdirSync(path.join(dir, "progeny"));
    writeFileSync(
      path.join(dir, "progeny", "child-one.json"),
      `${JSON.stringify(
        {
          kind: "progeny",
          campaign: "sample",
          genesis: "sample",
          id: "child-one",
          commitSha: SAMPLE_SHA,
        },
        null,
        2,
      )}\n`,
    );
  }
  if (input.dualSchema === true) {
    writeFileSync(path.join(dir, "schema.json"), "{}\n");
    writeFileSync(path.join(dir, "schema.yaml"), "{}\n");
  }
  return dir;
}

describe("glossary", () => {
  it("lists dump and lookup as verbs", () => {
    assert.equal(
      REQUIRED_WORK_REGISTRY_TERMS.some((term) => term.term === "dump" && term.kind === "verb"),
      true,
    );
    assert.equal(
      REQUIRED_WORK_REGISTRY_TERMS.some((term) => term.term === "lookup" && term.kind === "verb"),
      true,
    );
  });
});

describe("registerCampaign", () => {
  it("rejects a campaign unless Forgejo and the human both approve", () => {
    const dir = writeCampaign({
      forgejoApproved: true,
      humanApproved: false,
      proposal: "The campaign uses the work-registry.\n",
    });
    assert.throws(
      () => registerCampaign(dir),
      (error: unknown) =>
        error instanceof WorkRegistryError && error.message === "the campaign `is` not approved.",
    );
  });

  it("accepts a human override of Forgejo approval", () => {
    const dir = writeCampaign({
      forgejoApproved: false,
      humanApproved: true,
      humanOverride: true,
      proposal: "The campaign uses the work-registry.\n",
    });
    const manifest = registerCampaign(dir);
    assert.equal(manifest.product, PRODUCT_NAME);
    assert.equal(manifest.humanOverride, true);
  });

  it("rejects extra markdown and an ideation path", () => {
    const extra = writeCampaign({
      proposal: "The campaign uses the work-registry.\n",
      extraMarkdown: "bio\n",
    });
    assert.throws(
      () => registerCampaign(extra),
      (error: unknown) =>
        error instanceof WorkRegistryError && error.message === "the campaign `has` `extra` `markdown`.",
    );
    const ideation = writeCampaign({
      proposal: "The campaign uses the work-registry.\n",
      ideationFile: true,
    });
    assert.throws(
      () => registerCampaign(ideation),
      (error: unknown) =>
        error instanceof WorkRegistryError && error.message === "`ideation` `is` not a campaign.",
    );
  });

  it("accepts extra progeny json with one proposal markdown", () => {
    const dir = writeCampaign({
      proposal: "The campaign has a genesis. The progeny is a child of the genesis.\n",
      progeny: true,
    });
    const manifest = registerCampaign(dir);
    assert.equal(manifest.campaign, "sample");
  });

  it("rejects json and yaml as two documents for one schema", () => {
    const dir = writeCampaign({
      proposal: "The campaign uses the work-registry.\n",
      dualSchema: true,
    });
    assert.throws(
      () => registerCampaign(dir),
      (error: unknown) =>
        error instanceof WorkRegistryError && error.message === "the campaign `has` `two` `documents`.",
    );
  });

  it("rejects a new hyphenated noun with no translation into the glossary", () => {
    const dir = writeCampaign({
      proposal: "The flux-capacitor is ready.\n",
    });
    assert.throws(
      () => registerCampaign(dir),
      (error: unknown) =>
        error instanceof WorkRegistryError &&
        error.message === "the proposal must `translate` the new `noun`.",
    );
  });

  it("rejects a campaign when the genesis is missing", () => {
    const dir = writeCampaign({
      omitGenesis: true,
      proposal: "The campaign uses the work-registry.\n",
    });
    assert.throws(
      () => registerCampaign(dir),
      (error: unknown) =>
        error instanceof WorkRegistryError && error.message === "the genesis `is` missing.",
    );
  });

  it("rejects an epoch row without a commit SHA", () => {
    const dir = writeCampaign({
      proposal: "The campaign has a genesis.\n",
    });
    writeFileSync(
      path.join(dir, "epoch.json"),
      `${JSON.stringify([{ kind: "epoch", campaign: "sample", subject: "genesis", id: "sample" }], null, 2)}\n`,
    );
    assert.throws(
      () => registerCampaign(dir),
      (error: unknown) =>
        error instanceof WorkRegistryError && error.message === "the epoch `is` not `valid`.",
    );
  });
});

describe("compileCampaign", () => {
  it("writes schema terms found in the proposal from the glossary grep", () => {
    const dir = writeCampaign({
      proposal:
        "The campaign uses the work-registry. Agents compile the schema. The genesis has progeny in the epoch.\n",
    });
    const schema = compileCampaign(dir);
    assert.equal(schema.campaign, "sample");
    assert.equal(schema.product, PRODUCT_NAME);
    assert.deepEqual(
      schema.terms.map((term) => term.term),
      ["campaign", "compile", "epoch", "Forgejo-review", "genesis", "progeny", "schema", "work-registry"],
    );
    assert.deepEqual(lookupSchema(dir), schema);
  });

  it("records the Forgejo-review as a glossary noun in the schema", () => {
    const dir = writeCampaign({
      proposal:
        "The campaign needs the Forgejo-review before the work-registry can register the genesis.\n",
    });
    const schema = compileCampaign(dir);
    assert.equal(
      schema.terms.some((term) => term.term === "Forgejo-review"),
      true,
    );
  });

  it("writes work, pull, and event records from the proposal", () => {
    const dir = writeCampaign({
      proposal:
        "The campaign uses the work-registry. The genesis is this campaign. The progeny is `child-one`. The Forgejo-review is `41`.\n",
    });
    const schema = compileCampaign(dir);
    assert.deepEqual(schema.work, [
      { kind: "work", id: "sample", campaign: "sample", parent: null },
      { kind: "work", id: "child-one", campaign: "sample", parent: "sample" },
    ]);
    assert.deepEqual(schema.pull, [{ kind: "pull", campaign: "sample", reviewId: "41" }]);
    assert.deepEqual(schema.event, [
      { kind: "event", campaign: "sample", subject: "work", id: "sample" },
      { kind: "event", campaign: "sample", subject: "work", id: "child-one" },
      { kind: "event", campaign: "sample", subject: "pull", id: "41" },
    ]);
    assert.deepEqual(lookupSchema(dir), schema);
  });

  it("fails compile when the Forgejo-review identity is missing", () => {
    const dir = writeCampaign({
      proposal: "The campaign uses the work-registry.\n",
      omitIdentity: true,
    });
    assert.throws(
      () => compileCampaign(dir),
      (error: unknown) =>
        error instanceof WorkRegistryError && error.message === "the pull `is` missing.",
    );
  });

  it("fails compile when the genesis review is not the compiled pull", () => {
    const dir = writeCampaign({
      proposal:
        "The campaign uses the work-registry. The genesis is this campaign. The Forgejo-review is `41`.\n",
    });
    writeFileSync(
      path.join(dir, "genesis.json"),
      `${JSON.stringify(
        {
          kind: "genesis",
          campaign: "sample",
          commitSha: SAMPLE_SHA,
          forgejoReviewId: "99",
        },
        null,
        2,
      )}\n`,
    );
    assert.throws(
      () => compileCampaign(dir),
      (error: unknown) =>
        error instanceof WorkRegistryError && error.message === "the pull `is` not the genesis.",
    );
  });

  it("fails when identity records are edited without a proposal change", () => {
    const dir = writeCampaign({
      proposal:
        "The campaign uses the work-registry. The genesis is this campaign. The Forgejo-review is `41`.\n",
    });
    const schema = compileCampaign(dir);
    schema.pull = [{ kind: "pull", campaign: "sample", reviewId: "99" }];
    writeFileSync(path.join(dir, "schema.json"), `${JSON.stringify(schema, null, 2)}\n`);
    assert.throws(
      () => checkDrift(dir),
      (error: unknown) =>
        error instanceof WorkRegistryError && error.message === "the schema `has` `drift`.",
    );
  });

  it("loads one schema document from a yaml path using yaml form", () => {
    const dir = writeCampaign({
      proposal: "The campaign uses the work-registry.\n",
      schemaName: "schema.yaml",
    });
    const schema = compileCampaign(dir);
    const text = readFileSync(path.join(dir, "schema.yaml"), "utf8");
    assert.equal(schema.campaign, "sample");
    assert.equal(text.trimStart().startsWith("{"), false);
    assert.match(text, /^product: /m);
    assert.match(text, /^campaign: sample$/m);
    assert.match(text, /^terms:$/m);
    assert.equal(text.endsWith("\n"), true);
    assert.deepEqual(lookupSchema(dir), schema);
    checkDrift(dir);
  });

  it("loads a yaml manifest that is not json form", () => {
    const dir = writeCampaign({
      proposal: "The campaign uses the work-registry.\n",
    });
    writeFileSync(
      path.join(dir, "manifest.yaml"),
      [
        "product: T2_Squared-Work-Registry",
        "campaign: sample",
        "proposal: proposal.md",
        "schema: schema.json",
        "forgejoApproved: true",
        "humanApproved: true",
        "humanOverride: false",
        "",
      ].join("\n"),
    );
    unlinkSync(path.join(dir, "manifest.json"));
    const manifest = registerCampaign(dir);
    assert.equal(manifest.campaign, "sample");
    assert.equal(manifest.forgejoApproved, true);
  });
});

describe("appendEpoch", () => {
  it("appends an epoch when the genesis is complete", () => {
    const dir = writeCampaign({
      proposal: "The campaign has a genesis.\n",
    });
    const first = appendEpoch(dir, {
      subject: "genesis",
      id: "sample",
      commitSha: SAMPLE_SHA,
    });
    assert.equal(first.kind, "epoch");
    const again = appendEpoch(dir, {
      subject: "progeny",
      id: "child-one",
      commitSha: SAMPLE_SHA,
    });
    assert.equal(again.subject, "progeny");
    assert.equal(again.kind, "epoch");
  });

  it("appends yaml when the epoch path ends in yaml", () => {
    const dir = writeCampaign({
      proposal: "The campaign has a genesis.\n",
    });
    writeFileSync(
      path.join(dir, "epoch.yaml"),
      [
        "- kind: epoch",
        "  campaign: sample",
        "  subject: genesis",
        "  id: sample",
        `  commitSha: ${SAMPLE_SHA}`,
        "",
      ].join("\n"),
    );
    appendEpoch(dir, {
      subject: "progeny",
      id: "child-one",
      commitSha: SAMPLE_SHA,
    });
    const text = readFileSync(path.join(dir, "epoch.yaml"), "utf8");
    assert.equal(text.trimStart().startsWith("["), false);
    assert.match(text, /^- kind: epoch$/m);
    assert.equal(text.endsWith("\n"), true);
  });
});

describe("checkWorkRegistry", () => {
  it("passes when T2_Squared-Work-Registry has no campaign", () => {
    const root = mkdtempSync(path.join(tmpdir(), "t2-work-registry-root-"));
    mkdirSync(path.join(root, PRODUCT_NAME));
    writeFileSync(path.join(root, PRODUCT_NAME, ".gitkeep"), "");
    checkWorkRegistry(root);
  });

  it("passes the live asd-ste100-compliance campaign", () => {
    const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
    assert.equal(existsSync(path.join(repoRoot, PRODUCT_NAME, "asd-ste100-compliance")), true);
    checkWorkRegistry(repoRoot);
  });

  it("keeps live campaign schema identity as work, pull, and event", () => {
    const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
    for (const name of ["asd-ste100-compliance", "registry-yaml-write"]) {
      const campaignDir = path.join(repoRoot, PRODUCT_NAME, name);
      const schema = lookupSchema(campaignDir);
      const genesis = JSON.parse(readFileSync(path.join(campaignDir, "genesis.json"), "utf8")) as {
        forgejoReviewId: string;
      };
      assert.equal(schema.work.some((row) => row.kind === "work" && row.id === name && row.parent === null), true);
      assert.equal(schema.pull.some((row) => row.kind === "pull" && row.reviewId === genesis.forgejoReviewId), true);
      assert.equal(schema.event.some((row) => row.kind === "event" && row.subject === "work"), true);
      assert.equal(schema.event.some((row) => row.kind === "event" && row.subject === "pull"), true);
    }
  });
});

describe("dumpWorkRegistry", () => {
  it("lists campaigns without a Forgejo-review", () => {
    const root = mkdtempSync(path.join(tmpdir(), "t2-work-registry-dump-"));
    const dir = writeCampaign({
      forgejoApproved: false,
      humanApproved: true,
      humanOverride: true,
      proposal: "The campaign uses the work-registry.\n",
    });
    mkdirSync(path.join(root, PRODUCT_NAME), { recursive: true });
    cpSync(dir, path.join(root, PRODUCT_NAME, "sample"), { recursive: true });
    const dump = dumpWorkRegistry(root);
    assert.equal(dump.length, 1);
    assert.equal(dump[0]?.campaign, "sample");
    assert.equal(dump[0]?.schema, "schema.json");
    assert.equal(dump[0]?.approved, true);
    assert.equal(dump[0]?.forgejoClosed, false);
    assert.equal(dump[0]?.forgejoApproved, false);
    assert.equal(dump[0]?.humanOverride, true);
  });

  it("marks Forgejo-closed only without override", () => {
    const root = mkdtempSync(path.join(tmpdir(), "t2-work-registry-dump-closed-"));
    const dir = writeCampaign({
      forgejoApproved: true,
      humanApproved: true,
      humanOverride: false,
      proposal: "The campaign uses the work-registry.\n",
    });
    mkdirSync(path.join(root, PRODUCT_NAME), { recursive: true });
    cpSync(dir, path.join(root, PRODUCT_NAME, "sample"), { recursive: true });
    const dump = dumpWorkRegistry(root);
    assert.equal(dump[0]?.approved, true);
    assert.equal(dump[0]?.forgejoClosed, true);
  });

  it("keeps live campaigns Forgejo-closed after the Forgejo-review", () => {
    const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const dump = dumpWorkRegistry(repoRoot);
    assert.equal(dump.length > 0, true);
    assert.equal(
      dump.every((entry) => entry.forgejoClosed === true),
      true,
    );
    assert.equal(
      dump.every((entry) => entry.humanOverride === false),
      true,
    );
    assert.equal(
      dump.every((entry) => entry.approved === true),
      true,
    );
  });
});

describe("checkDrift", () => {
  it("fails when the schema does not match a compile of the proposal", () => {
    const dir = writeCampaign({
      proposal: "The campaign uses the work-registry.\n",
      schema: `${JSON.stringify({ campaign: "sample", terms: [] }, null, 2)}\n`,
    });
    assert.throws(
      () => checkDrift(dir),
      (error: unknown) =>
        error instanceof WorkRegistryError && error.message === "the schema `has` `drift`.",
    );
  });

  it("passes when the schema matches the proposal compile", () => {
    const dir = writeCampaign({
      proposal: "The campaign uses the work-registry.\n",
    });
    compileCampaign(dir);
    checkDrift(dir);
  });
});

describe("acceptance examples AE1-AE5", () => {
  it("AE1 lists one proposal markdown and rejects extra markdown or a CAN ideation path", () => {
    const extra = writeCampaign({
      proposal: "The campaign uses the work-registry.\n",
      extraMarkdown: "bio\n",
    });
    assert.throws(
      () => registerCampaign(extra),
      (error: unknown) =>
        error instanceof WorkRegistryError && error.message === "the campaign `has` `extra` `markdown`.",
    );
    const ideation = writeCampaign({
      proposal: "The campaign uses the work-registry.\n",
      ideationFile: true,
    });
    assert.throws(
      () => registerCampaign(ideation),
      (error: unknown) =>
        error instanceof WorkRegistryError && error.message === "`ideation` `is` not a campaign.",
    );
  });

  it("AE2 compile writes dictionary plus work, pull, and event, and lookup does not run ASD CI", () => {
    const dir = writeCampaign({
      proposal:
        "The campaign uses the work-registry. The genesis is this campaign. The Forgejo-review is `41`.\n",
    });
    const schema = compileCampaign(dir);
    assert.equal(schema.terms.some((term) => term.term === "work-registry"), true);
    assert.equal(schema.work.length > 0, true);
    assert.equal(schema.pull.length > 0, true);
    assert.equal(schema.event.length > 0, true);
    assert.deepEqual(lookupSchema(dir), schema);
  });

  it("AE3 fails when schema is edited without a matching proposal change", () => {
    const dir = writeCampaign({
      proposal:
        "The campaign uses the work-registry. The genesis is this campaign. The Forgejo-review is `41`.\n",
    });
    const schema = compileCampaign(dir);
    schema.work = [];
    writeFileSync(path.join(dir, "schema.json"), `${JSON.stringify(schema, null, 2)}\n`);
    assert.throws(
      () => checkDrift(dir),
      (error: unknown) =>
        error instanceof WorkRegistryError && error.message === "the schema `has` `drift`.",
    );
  });

  it("AE4 lookup reads structured records and registry scripts do not call a language model", () => {
    const dir = writeCampaign({
      proposal: "The campaign uses the work-registry.\n",
    });
    compileCampaign(dir);
    const schema = lookupSchema(dir);
    assert.equal(schema.work[0]?.kind, "work");
    const source = readFileSync(fileURLToPath(new URL("./registry.ts", import.meta.url)), "utf8");
    assert.doesNotMatch(source, /openai|anthropic|language model|completions/i);
  });

  it("AE5 rejects ideation notes when the campaign is not approved", () => {
    const dir = writeCampaign({
      forgejoApproved: false,
      humanApproved: false,
      proposal: "The campaign uses the work-registry.\n",
      ideationFile: true,
    });
    assert.throws(
      () => registerCampaign(dir),
      (error: unknown) =>
        error instanceof WorkRegistryError && error.message === "the campaign `is` not approved.",
    );
  });
});
