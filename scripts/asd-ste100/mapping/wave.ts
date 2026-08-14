import {
  DEFAULT_CHUNK_PAGES,
  MAX_CHUNK_PAGES,
  MIN_CHUNK_PAGES,
  buildChunkFromManifest,
  validateChunkSize,
  type ManifestPage,
  type PageChunk,
} from "./chunk.ts";

export const HEURISTIC_CARD_PATH = "AGENT_HEURISTIC.md";

export interface CoverageLedgerEntry {
  page: number;
  waveIndex: number;
}

export interface WaveJob extends PageChunk {
  heuristicCardPath: string;
}

function partitionSizes(totalPages: number, chunkSize: number): Array<number> {
  validateChunkSize(chunkSize);
  if (totalPages < MIN_CHUNK_PAGES) {
    throw new Error(`ordered set must have at least ${MIN_CHUNK_PAGES} pages (got ${totalPages})`);
  }
  const fullCount = Math.floor(totalPages / chunkSize);
  const remainder = totalPages % chunkSize;
  if (fullCount === 0) {
    validateChunkSize(totalPages);
    return [totalPages];
  }
  if (remainder === 0) {
    return Array.from({ length: fullCount }, () => chunkSize);
  }
  if (remainder >= MIN_CHUNK_PAGES) {
    return [...Array.from({ length: fullCount }, () => chunkSize), remainder];
  }
  const sizes = Array.from({ length: fullCount }, () => chunkSize);
  let leftover = remainder;
  for (let index = sizes.length - 1; index >= 0 && leftover > 0; index -= 1) {
    const current = sizes[index];
    if (current === undefined) {
      break;
    }
    const room = MAX_CHUNK_PAGES - current;
    const take = Math.min(room, leftover);
    sizes[index] = current + take;
    leftover -= take;
  }
  if (leftover > 0) {
    throw new Error("cannot absorb remainder while keeping chunk sizes in 10-40");
  }
  return sizes;
}

export function partitionWaves(
  manifest: ReadonlyArray<ManifestPage>,
  chunkSize: number = DEFAULT_CHUNK_PAGES,
): Array<PageChunk> {
  validateChunkSize(chunkSize);
  const sizes = partitionSizes(manifest.length, chunkSize);
  const ordered = [...manifest].sort((left, right) => left.page - right.page);
  const firstPage = ordered[0]?.page;
  if (firstPage === undefined) {
    throw new Error("ordered set is empty");
  }
  const waves: Array<PageChunk> = [];
  let cursor = firstPage;
  for (const pageCount of sizes) {
    waves.push(buildChunkFromManifest(manifest, cursor, pageCount));
    cursor += pageCount;
  }
  return waves;
}

export function buildCoverageLedger(waves: ReadonlyArray<PageChunk>): Array<CoverageLedgerEntry> {
  const ledger: Array<CoverageLedgerEntry> = [];
  waves.forEach((wave, waveIndex) => {
    for (const entry of wave.pages) {
      ledger.push({ page: entry.page, waveIndex });
    }
  });
  ledger.sort((left, right) => left.page - right.page);
  return ledger;
}

export function buildWaveJob(chunk: PageChunk, heuristicCardPath: string): WaveJob {
  return {
    startPage: chunk.startPage,
    endPage: chunk.endPage,
    pageCount: chunk.pageCount,
    pages: [...chunk.pages],
    heuristicCardPath,
  };
}
