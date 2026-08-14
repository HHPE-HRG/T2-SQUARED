import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_CHUNK_PAGES,
  buildChunkFromManifest,
  buildChunkFromRange,
  validateChunkSize,
} from "./chunk.ts";

function syntheticManifest(
  startPage: number,
  pageCount: number,
): Array<{ page: number; path?: string }> {
  return Array.from({ length: pageCount }, (_, offset) => {
    const page = startPage + offset;
    return {
      page,
      path: `/off-git/synthetic/page-${String(page).padStart(3, "0")}.bin`,
    };
  });
}

describe("validateChunkSize", () => {
  it("accepts a chunk of 10 pages", () => {
    assert.equal(validateChunkSize(10), 10);
  });

  it("accepts a chunk of 40 pages", () => {
    assert.equal(validateChunkSize(40), 40);
  });

  it("accepts the default size of 20 pages", () => {
    assert.equal(validateChunkSize(DEFAULT_CHUNK_PAGES), 20);
  });

  it("rejects a chunk of 9 pages", () => {
    assert.throws(() => validateChunkSize(9), /10|40|chunk size/i);
  });

  it("rejects a chunk of 41 pages", () => {
    assert.throws(() => validateChunkSize(41), /10|40|chunk size/i);
  });
});

describe("buildChunkFromRange", () => {
  it("returns a closed page range whose count is end minus start plus one", () => {
    const chunk = buildChunkFromRange(21, 20);
    assert.equal(chunk.startPage, 21);
    assert.equal(chunk.endPage, 40);
    assert.equal(chunk.pageCount, 20);
    assert.equal(chunk.pageCount, chunk.endPage - chunk.startPage + 1);
    assert.deepEqual(
      chunk.pages.map((entry) => entry.page),
      Array.from({ length: 20 }, (_, offset) => 21 + offset),
    );
  });

  it("uses the default size of 20 when count is omitted", () => {
    const chunk = buildChunkFromRange(1);
    assert.equal(chunk.pageCount, DEFAULT_CHUNK_PAGES);
    assert.equal(chunk.startPage, 1);
    assert.equal(chunk.endPage, 20);
  });

  it("rejects a range of 9 pages", () => {
    assert.throws(() => buildChunkFromRange(1, 9), /10|40|chunk size/i);
  });
});

describe("buildChunkFromManifest", () => {
  it("assigns a closed range from a synthetic ordered-set slice", () => {
    const manifest = syntheticManifest(1, 50);
    const chunk = buildChunkFromManifest(manifest, 11, 10);
    assert.equal(chunk.startPage, 11);
    assert.equal(chunk.endPage, 20);
    assert.equal(chunk.pageCount, 10);
    assert.equal(chunk.pages.length, 10);
    assert.equal(chunk.pages[0]?.path, "/off-git/synthetic/page-011.bin");
    assert.equal(chunk.pages.at(-1)?.path, "/off-git/synthetic/page-020.bin");
  });

  it("accepts a 40-page manifest slice at the upper bound", () => {
    const manifest = syntheticManifest(100, 40);
    const chunk = buildChunkFromManifest(manifest, 100, 40);
    assert.equal(chunk.pageCount, 40);
    assert.equal(chunk.startPage, 100);
    assert.equal(chunk.endPage, 139);
  });

  it("rejects a 9-page manifest slice", () => {
    const manifest = syntheticManifest(1, 9);
    assert.throws(() => buildChunkFromManifest(manifest, 1, 9), /10|40|chunk size/i);
  });

  it("rejects a 41-page manifest slice", () => {
    const manifest = syntheticManifest(1, 41);
    assert.throws(() => buildChunkFromManifest(manifest, 1, 41), /10|40|chunk size/i);
  });

  it("fails when the requested range is missing from the ordered set", () => {
    const manifest = syntheticManifest(1, 15);
    assert.throws(() => buildChunkFromManifest(manifest, 10, 10), /missing|range|manifest/i);
  });
});
