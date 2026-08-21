import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { steWordCount } from "./word-count.ts";

describe("steWordCount", () => {
  it("counts a plain sentence by whitespace tokens", () => {
    assert.equal(steWordCount("Put preservation oil into the unit."), 6);
  });

  it("counts hyphenated technical noun groups as one word", () => {
    assert.equal(steWordCount("Do the short-circuit test now."), 5);
    assert.equal(steWordCount("Do the short circuit test now."), 6);
  });

  it("counts a number with its unit as one word", () => {
    assert.equal(steWordCount("The unit weighs 20 kg."), 4);
  });

  it("counts parenthetical text as one word", () => {
    assert.equal(
      steWordCount("Open the panel (refer to the figure) and check the seal."),
      8,
    );
  });

  it("counts quoted text as one word", () => {
    assert.equal(steWordCount('Open the "Service Overview" page.'), 4);
  });

  it("counts abbreviations as one word", () => {
    assert.equal(steWordCount("Connect the VPN cable."), 4);
  });
});
