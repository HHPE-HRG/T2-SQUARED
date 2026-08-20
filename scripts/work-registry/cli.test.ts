import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { runCli } from "./cli.ts";
import { PRODUCT_NAME } from "./glossary.ts";
import { lookupSchema, WorkRegistryError } from "./registry.ts";

const SAMPLE_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("runCli", () => {
  it("compiles a campaign under T2_Squared-Work-Registry", () => {
    const root = mkdtempSync(path.join(tmpdir(), "t2-work-registry-cli-"));
    const campaignDir = path.join(root, PRODUCT_NAME, "sample");
    mkdirSync(campaignDir, { recursive: true });
    writeFileSync(
      path.join(campaignDir, "manifest.json"),
      `${JSON.stringify(
        {
          product: PRODUCT_NAME,
          campaign: "sample",
          proposal: "proposal.md",
          schema: "schema.json",
          forgejoApproved: true,
          humanApproved: true,
          humanOverride: false,
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      path.join(campaignDir, "proposal.md"),
      "The campaign uses the work-registry. The genesis is this campaign. The Forgejo-review is `41`.\n",
    );
    writeFileSync(
      path.join(campaignDir, "genesis.json"),
      `${JSON.stringify(
        {
          kind: "genesis",
          campaign: "sample",
          commitSha: SAMPLE_SHA,
          forgejoReviewId: "41",
        },
        null,
        2,
      )}\n`,
    );
    runCli(["--root", root, "--compile", "sample"]);
    const schema = lookupSchema(campaignDir);
    assert.equal(schema.campaign, "sample");
    assert.equal(
      schema.terms.some((term) => term.term === "work-registry"),
      true,
    );
  });

  it("dumps campaigns under T2_Squared-Work-Registry", () => {
    const root = mkdtempSync(path.join(tmpdir(), "t2-work-registry-cli-dump-"));
    const campaignDir = path.join(root, PRODUCT_NAME, "sample");
    mkdirSync(campaignDir, { recursive: true });
    writeFileSync(
      path.join(campaignDir, "manifest.json"),
      `${JSON.stringify(
        {
          product: PRODUCT_NAME,
          campaign: "sample",
          proposal: "proposal.md",
          schema: "schema.json",
          forgejoApproved: false,
          humanApproved: true,
          humanOverride: true,
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      path.join(campaignDir, "proposal.md"),
      "The campaign uses the work-registry. The genesis is this campaign. The Forgejo-review is `41`.\n",
    );
    writeFileSync(
      path.join(campaignDir, "genesis.json"),
      `${JSON.stringify(
        {
          kind: "genesis",
          campaign: "sample",
          commitSha: SAMPLE_SHA,
          forgejoReviewId: null,
        },
        null,
        2,
      )}\n`,
    );
    const chunks: Array<string> = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stdout.write;
    try {
      runCli(["--root", root, "--dump"]);
    } finally {
      process.stdout.write = original;
    }
    const payload = JSON.parse(chunks.join("")) as Array<{
      campaign: string;
      schema: string;
      approved: boolean;
      forgejoClosed: boolean;
    }>;
    assert.equal(payload[0]?.campaign, "sample");
    assert.equal(payload[0]?.schema, "schema.json");
    assert.equal(payload[0]?.approved, true);
    assert.equal(payload[0]?.forgejoClosed, false);
  });

  it("prints lookup json for a compiled campaign", () => {
    const root = mkdtempSync(path.join(tmpdir(), "t2-work-registry-cli-lookup-"));
    const campaignDir = path.join(root, PRODUCT_NAME, "sample");
    mkdirSync(campaignDir, { recursive: true });
    writeFileSync(
      path.join(campaignDir, "manifest.json"),
      `${JSON.stringify(
        {
          product: PRODUCT_NAME,
          campaign: "sample",
          proposal: "proposal.md",
          schema: "schema.json",
          forgejoApproved: true,
          humanApproved: true,
          humanOverride: false,
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      path.join(campaignDir, "proposal.md"),
      "The campaign uses the work-registry. The genesis is this campaign. The Forgejo-review is `41`.\n",
    );
    writeFileSync(
      path.join(campaignDir, "genesis.json"),
      `${JSON.stringify(
        {
          kind: "genesis",
          campaign: "sample",
          commitSha: SAMPLE_SHA,
          forgejoReviewId: "41",
        },
        null,
        2,
      )}\n`,
    );
    runCli(["--root", root, "--compile", "sample"]);
    const chunks: Array<string> = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stdout.write;
    try {
      runCli(["--root", root, "--lookup", "sample"]);
    } finally {
      process.stdout.write = original;
    }
    const payload = JSON.parse(chunks.join("")) as { campaign: string };
    assert.equal(payload.campaign, "sample");
    assert.deepEqual(payload, lookupSchema(campaignDir));
  });

  it("checks one campaign for register and drift", () => {
    const root = mkdtempSync(path.join(tmpdir(), "t2-work-registry-cli-check-"));
    const campaignDir = path.join(root, PRODUCT_NAME, "sample");
    mkdirSync(campaignDir, { recursive: true });
    writeFileSync(
      path.join(campaignDir, "manifest.json"),
      `${JSON.stringify(
        {
          product: PRODUCT_NAME,
          campaign: "sample",
          proposal: "proposal.md",
          schema: "schema.json",
          forgejoApproved: true,
          humanApproved: true,
          humanOverride: false,
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      path.join(campaignDir, "proposal.md"),
      "The campaign uses the work-registry. The genesis is this campaign. The Forgejo-review is `41`.\n",
    );
    writeFileSync(
      path.join(campaignDir, "genesis.json"),
      `${JSON.stringify(
        {
          kind: "genesis",
          campaign: "sample",
          commitSha: SAMPLE_SHA,
          forgejoReviewId: "41",
        },
        null,
        2,
      )}\n`,
    );
    assert.throws(
      () => runCli(["--root", root, "--check", "sample"]),
      (error: unknown) =>
        error instanceof WorkRegistryError && error.message === "the schema `has` `drift`.",
    );
    runCli(["--root", root, "--compile", "sample"]);
    runCli(["--root", root, "--check", "sample"]);
  });

  it("checks only the named campaign when a sibling has drift", () => {
    const root = mkdtempSync(path.join(tmpdir(), "t2-work-registry-cli-check-one-"));
    const ready = path.join(root, PRODUCT_NAME, "ready");
    const stale = path.join(root, PRODUCT_NAME, "stale");
    mkdirSync(ready, { recursive: true });
    mkdirSync(stale, { recursive: true });
    for (const [name, dir] of [
      ["ready", ready],
      ["stale", stale],
    ] as const) {
      writeFileSync(
        path.join(dir, "manifest.json"),
        `${JSON.stringify(
          {
            product: PRODUCT_NAME,
            campaign: name,
            proposal: "proposal.md",
            schema: "schema.json",
            forgejoApproved: true,
            humanApproved: true,
            humanOverride: false,
          },
          null,
          2,
        )}\n`,
      );
      writeFileSync(
        path.join(dir, "proposal.md"),
        "The campaign uses the work-registry. The genesis is this campaign. The Forgejo-review is `41`.\n",
      );
      writeFileSync(
        path.join(dir, "genesis.json"),
        `${JSON.stringify(
          {
            kind: "genesis",
            campaign: name,
            commitSha: SAMPLE_SHA,
            forgejoReviewId: "41",
          },
          null,
          2,
        )}\n`,
      );
    }
    runCli(["--root", root, "--compile", "ready"]);
    runCli(["--root", root, "--check", "ready"]);
    assert.throws(
      () => runCli(["--root", root]),
      (error: unknown) =>
        error instanceof WorkRegistryError && error.message === "the schema `has` `drift`.",
    );
  });
});
