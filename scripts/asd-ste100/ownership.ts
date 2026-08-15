import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

export type TextClass =
  | "owned"
  | "owned-delta"
  | "raw"
  | "machine"
  | "fixture"
  | "privileged"
  | "external-evidence"
  | "upstream-unchanged"
  | "unclassified";

export interface OwnershipManifest {
  ownedGlobs: Array<string>;
  rawGlobs: Array<string>;
  machineGlobs: Array<string>;
  fixtureGlobs: Array<string>;
  privilegedGlobs: Array<string>;
  externalEvidenceGlobs: Array<string>;
}

export interface ScopeRecord {
  path: string;
  className: TextClass;
  reason: string;
  includeInCorpusFindings: boolean;
  requiresRedaction: boolean;
}

export interface UpstreamLock {
  url: string;
  acceptedBaseSha: string;
}

export class UpstreamUrlError extends Error {
  override readonly name = "UpstreamUrlError";
  constructor(message: string) {
    super(message);
  }
}

export class UpstreamAncestryError extends Error {
  override readonly name = "UpstreamAncestryError";
  constructor(message: string) {
    super(message);
  }
}

const GLOB_FIELDS = [
  "ownedGlobs",
  "rawGlobs",
  "machineGlobs",
  "fixtureGlobs",
  "privilegedGlobs",
  "externalEvidenceGlobs",
] as const;

function posixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

export function matchGlob(filePath: string, glob: string): boolean {
  const normalized = posixPath(filePath);
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\0")
    .replace(/\*/g, "[^/]*")
    .replace(/\0/g, ".*");
  return new RegExp(`^${escaped}$`).test(normalized);
}

function matchesAny(filePath: string, globs: ReadonlyArray<string>): boolean {
  return globs.some((glob) => matchGlob(filePath, glob));
}

export function classifyPath(filePath: string, manifest: OwnershipManifest): ScopeRecord {
  const normalized = posixPath(filePath);
  const base = {
    path: normalized,
    includeInCorpusFindings: true,
    requiresRedaction: false,
    reason: "",
    className: "unclassified" as TextClass,
  };
  if (matchesAny(normalized, manifest.rawGlobs)) {
    return {
      ...base,
      className: "raw",
      includeInCorpusFindings: false,
      reason: "raw conversation fixture",
    };
  }
  if (matchesAny(normalized, manifest.externalEvidenceGlobs)) {
    return {
      ...base,
      className: "external-evidence",
      includeInCorpusFindings: false,
      requiresRedaction: true,
      reason: "external provider evidence",
    };
  }
  if (matchesAny(normalized, manifest.fixtureGlobs)) {
    return {
      ...base,
      className: "fixture",
      includeInCorpusFindings: false,
      reason: "suite fixture",
    };
  }
  if (matchesAny(normalized, manifest.machineGlobs)) {
    return {
      ...base,
      className: "machine",
      includeInCorpusFindings: false,
      reason: "machine literal exclusion",
    };
  }
  if (matchesAny(normalized, manifest.privilegedGlobs)) {
    return { ...base, className: "privileged", reason: "privileged control path" };
  }
  if (matchesAny(normalized, manifest.ownedGlobs)) {
    return { ...base, className: "owned", reason: "owned glob" };
  }
  return {
    ...base,
    className: "unclassified",
    includeInCorpusFindings: false,
    reason: "no owned pattern",
  };
}

export function classifyCommitMessage(input: {
  sha: string;
  message: string;
  imported: boolean;
}): ScopeRecord {
  if (input.imported) {
    return {
      path: `commit:${input.sha}`,
      className: "upstream-unchanged",
      reason: "imported upstream commit",
      includeInCorpusFindings: false,
      requiresRedaction: false,
    };
  }
  return {
    path: `commit:${input.sha}`,
    className: "owned",
    reason: "fork-authored commit message",
    includeInCorpusFindings: true,
    requiresRedaction: false,
  };
}

function git(cwd: string, args: ReadonlyArray<string>): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function gitOk(cwd: string, args: ReadonlyArray<string>): boolean {
  try {
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}

function listChangedPaths(cwd: string, baseSha: string, headSha: string): Array<string> {
  if (baseSha === headSha) {
    const listed = git(cwd, ["ls-tree", "-r", "--name-only", headSha]);
    return listed === "" ? [] : listed.split("\n");
  }
  const listed = git(cwd, ["diff", "--name-only", "--diff-filter=ACMR", baseSha, headSha]);
  return listed === "" ? [] : listed.split("\n");
}

function existedAt(cwd: string, sha: string, filePath: string): boolean {
  return gitOk(cwd, ["cat-file", "-e", `${sha}:${filePath}`]);
}

export function collectScopeRecords(input: {
  cwd: string;
  mode: "pr" | "corpus";
  baseSha: string;
  headSha: string;
  manifest: OwnershipManifest;
}): Array<ScopeRecord> {
  const paths =
    input.mode === "corpus"
      ? listChangedPaths(input.cwd, input.headSha, input.headSha)
      : listChangedPaths(input.cwd, input.baseSha, input.headSha);
  return paths.map((filePath) => {
    const classified = classifyPath(filePath, input.manifest);
    if (
      input.mode === "pr" &&
      classified.className === "unclassified" &&
      existedAt(input.cwd, input.baseSha, filePath)
    ) {
      return {
        path: posixPath(filePath),
        className: "owned-delta",
        reason: "T2 changed an upstream path",
        includeInCorpusFindings: true,
        requiresRedaction: false,
      };
    }
    return classified;
  });
}

function normalizeRemoteUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function resolveUpstreamAncestry(input: { cwd: string; lock: UpstreamLock }): void {
  let actual: string;
  try {
    actual = git(input.cwd, ["remote", "get-url", "upstream"]);
  } catch {
    throw new UpstreamUrlError("upstream remote is missing");
  }
  if (normalizeRemoteUrl(actual) !== normalizeRemoteUrl(input.lock.url)) {
    throw new UpstreamUrlError("upstream URL does not match the lock");
  }
  if (!gitOk(input.cwd, ["merge-base", "--is-ancestor", input.lock.acceptedBaseSha, "HEAD"])) {
    throw new UpstreamAncestryError("locked upstream base is not an ancestor of HEAD");
  }
}

export function loadOwnershipManifest(filePath: string): OwnershipManifest {
  if (!existsSync(filePath)) {
    throw new Error(`ownership manifest is missing: ${filePath}`);
  }
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
  const manifest: OwnershipManifest = {
    ownedGlobs: [],
    rawGlobs: [],
    machineGlobs: [],
    fixtureGlobs: [],
    privilegedGlobs: [],
    externalEvidenceGlobs: [],
  };
  for (const field of GLOB_FIELDS) {
    const value = parsed[field];
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
      throw new Error(`ownership manifest field ${field} must be an array of strings`);
    }
    manifest[field] = [...value];
  }
  return manifest;
}
