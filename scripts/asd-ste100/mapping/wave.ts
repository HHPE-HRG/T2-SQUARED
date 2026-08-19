import { execFileSync } from "node:child_process";
import path from "node:path";

import {
  DEFAULT_CHUNK_PAGES,
  MAX_CHUNK_PAGES,
  MIN_CHUNK_PAGES,
  buildChunkFromManifest,
  validateChunkSize,
  type ManifestPage,
  type PageChunk,
} from "./chunk.ts";
import {
  SYNTHETIC_DICTIONARY_NEEDLES,
  mergeMappings,
  scanMappingLeak,
  writeMappingRecords,
  type MappingAgentChunk,
  type MappingLeakScan,
  type MappingRow,
} from "./merge.ts";

export { SYNTHETIC_DICTIONARY_NEEDLES };

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
    throw new Error("cannot absorb `remainder` while `keeping` `chunk` `sizes` in 10-40");
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
    throw new Error("`ordered` set `is` empty");
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

export type MappingAgent = (job: WaveJob) => MappingAgentChunk | Promise<MappingAgentChunk>;

export interface RunWavesOptions {
  outputDir: string;
  heuristicCardPath?: string;
  maxAttempts?: number;
  gitCwd?: string;
}

export interface RunWavesResult {
  records: Array<MappingRow>;
  recordsPath: string;
  attemptsByWave: Array<number>;
}

const JPEG_SOI = "\xff\xd8";
const JPEG_SOI_HEX = /ff\s*d8\s*ff/i;
const JPEG_BASE64 = /\/9j\//;
const JPEG_BINARY_FILES = /Binary files .*\.jpe?g/i;

export function scanGitDiffLeak(
  diffText: string,
  officialNeedles: ReadonlyArray<string> = SYNTHETIC_DICTIONARY_NEEDLES,
): MappingLeakScan {
  if (
    diffText.includes(JPEG_SOI) ||
    JPEG_SOI_HEX.test(diffText) ||
    JPEG_BASE64.test(diffText) ||
    JPEG_BINARY_FILES.test(diffText)
  ) {
    return { ok: false, reason: "`jpg` `byte` leak" };
  }
  for (const needle of officialNeedles) {
    if (needle.length > 0 && diffText.includes(needle)) {
      return { ok: false, reason: "`official` `dictionary` `word` leak" };
    }
  }
  return { ok: true, reason: "" };
}

function assertChunkMatchesJob(chunk: MappingAgentChunk, job: WaveJob): void {
  if (chunk.startPage !== job.startPage || chunk.endPage !== job.endPage) {
    throw new Error(
      `agent returned range ${chunk.startPage}-${chunk.endPage}, expected ${job.startPage}-${job.endPage}`,
    );
  }
  for (const row of chunk.rows) {
    for (const page of row.sourcePages) {
      if (page < job.startPage || page > job.endPage) {
        throw new Error(`source page ${page} outside wave range ${job.startPage}-${job.endPage}`);
      }
    }
  }
}

function readGitDiff(cwd: string): string {
  const run = (args: Array<string>): string => {
    try {
      return execFileSync("git", args, {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      const err = error as { stdout?: string; message?: string };
      const stdout = typeof err.stdout === "string" ? err.stdout : "";
      if (stdout.trim() !== "") {
        return stdout;
      }
      throw new Error("`git` `diff` `failed`");
    }
  };
  const untracked = run(["ls-files", "--others", "--exclude-standard"]);
  const parts = [run(["diff", "HEAD"]), run(["diff", "--cached"])];
  for (const rel of untracked.split("\n").filter(Boolean)) {
    parts.push(run(["diff", "--no-index", "--", "/dev/null", path.join(cwd, rel)]));
  }
  return parts.join("\n");
}

async function runWaveWithRetry(
  job: WaveJob,
  agent: MappingAgent,
  maxAttempts: number,
): Promise<{ chunk: MappingAgentChunk; attempts: number }> {
  let lastError: Error | undefined;
  for (let attempts = 1; attempts <= maxAttempts; attempts += 1) {
    try {
      const chunk = await agent(job);
      assertChunkMatchesJob(chunk, job);
      const leak = scanMappingLeak(chunk.rows);
      if (!leak.ok) {
        throw new Error(leak.reason);
      }
      return { chunk, attempts };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error(`wave ${job.startPage}-${job.endPage} failed`);
}

export async function runWaves(
  waves: ReadonlyArray<PageChunk>,
  agent: MappingAgent,
  options: RunWavesOptions,
): Promise<RunWavesResult> {
  const heuristicCardPath = options.heuristicCardPath ?? HEURISTIC_CARD_PATH;
  const maxAttempts = options.maxAttempts ?? 2;
  const chunks: Array<MappingAgentChunk> = [];
  const attemptsByWave: Array<number> = [];

  for (const wave of waves) {
    const job = buildWaveJob(wave, heuristicCardPath);
    const { chunk, attempts } = await runWaveWithRetry(job, agent, maxAttempts);
    chunks.push(chunk);
    attemptsByWave.push(attempts);
  }

  const records = mergeMappings(chunks);
  const payload = `${JSON.stringify(records, null, 2)}\n`;
  const gitCwd = options.gitCwd;
  const workspace = gitCwd === undefined ? payload : `${payload}\n${readGitDiff(gitCwd)}`;
  const diffScan = scanGitDiffLeak(workspace, SYNTHETIC_DICTIONARY_NEEDLES);
  if (!diffScan.ok) {
    throw new Error(diffScan.reason);
  }
  const recordsPath = writeMappingRecords(records, options.outputDir);
  return { records, recordsPath, attemptsByWave };
}
