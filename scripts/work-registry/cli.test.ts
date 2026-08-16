import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { runCli } from "./cli.ts";
import { PRODUCT_NAME } from "./glossary.ts";
import { lookupSchema } from "./registry.ts";

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
    writeFileSync(path.join(campaignDir, "proposal.md"), "The campaign uses the work-registry.\n");
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
});
