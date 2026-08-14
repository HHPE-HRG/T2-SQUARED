import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  attestationFilename,
  buildAttestation,
  canonicalize,
  digestCanonical,
  scanForVocabularyLeak,
} from "./attestation.ts";
import type { RuleSubsetAttestation } from "./attestation.ts";
import { checkClaims } from "./claim.ts";
import { formatDiagnostic } from "./diagnostics.ts";
import { extractMarkdown, extractTypeScript } from "./extract.ts";
import { collectScopeRecords, loadOwnershipManifest } from "./ownership.ts";
import {
  approvedWordSet,
  checkMembershipAndIdentification,
  knownNounsFromTerms,
} from "./membership.ts";
import { checkMechanicalRules } from "./rules.ts";
import type { Finding } from "./rules.ts";
import { evaluateIntentApplicability } from "./trace.ts";
import {
  parseApprovedWordsFromOfficialBytes,
  validateProfile,
  validateTechnicalTerms,
  VocabularyChecksumMismatchError,
  VocabularyEmptyError,
  VocabularyMissingError,
  VocabularyOpaqueError,
} from "./vocabulary.ts";
import type { AsdProfile, TechnicalTerm } from "./vocabulary.ts";

export const EXIT = {
  ok: 0,
  internal: 1,
  findings: 10,
  prerequisite: 20,
  api: 30,
  leak: 40,
  github_actions: 50,
} as const;

export type ExitCategory = keyof typeof EXIT;
export type CliMode = "fixture" | "pr" | "main" | "release";

export interface GateResult {
  id: "G1" | "G2" | "G3" | "G4" | "G5" | "G6" | "G7";
  ok: boolean;
  status?: "not_applicable";
  reason: string;
}

export interface CliOutput {
  path: string;
  body: string;
}

export interface CliDeps {
  cwd: string;
  now: () => string;
  githubActionsState: () => "disabled" | "enabled" | "unknown";
  officialVocabularyBytes: () => Buffer;
  leakScanAvailable: boolean;
  gitHead: () => string;
  gitMergeBase: () => string;
  eventHeadSha?: string;
  baseline: { ok: boolean; sourceSha: string };
  attestationPresent: boolean;
  changedPaths: Array<string>;
  corpusPaths: Array<string>;
  findings: Array<Finding>;
  governedSystemTextWithoutTrace: boolean;
  writeOutput: (filePath: string, body: string) => void;
}

export interface CliRunResult {
  ok: boolean;
  reason: string;
  exitCode: number;
  exitCategory: ExitCategory;
  mode: CliMode;
  gates: Array<GateResult>;
  scannedPaths: Array<string>;
  outputs: Array<CliOutput>;
  aggregate: Record<string, unknown>;
  attestation?: RuleSubsetAttestation;
}

export const CACHE_DIR = ".cache/asd-ste100";

function loadJson<T>(root: string, relative: string): T {
  return JSON.parse(readFileSync(path.join(root, relative), "utf8")) as T;
}

export function findRepoRoot(start: string): string {
  let current = path.resolve(start);
  while (true) {
    if (existsSync(path.join(current, "t2.asd-ste100.json"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error("repository root with t2.asd-ste100.json was not found");
    }
    current = parent;
  }
}

export function parseMode(argv: Array<string>): CliMode {
  const flagIndex = argv.findIndex((arg) => arg === "--mode" || arg.startsWith("--mode="));
  if (flagIndex < 0) {
    return "fixture";
  }
  const token = argv[flagIndex] ?? "";
  const value = token.startsWith("--mode=")
    ? token.slice("--mode=".length)
    : (argv[flagIndex + 1] ?? "");
  if (value === "pr" || value === "main" || value === "release" || value === "fixture") {
    return value;
  }
  throw new Error(`unknown mode: ${value}`);
}

export function resolvePrGitRefs(input: {
  gitHead: () => string;
  gitMergeBase: () => string;
  eventHeadSha?: string;
}): { headSha: string; mergeBaseSha: string } {
  void input.eventHeadSha;
  return {
    headSha: input.gitHead(),
    mergeBaseSha: input.gitMergeBase(),
  };
}

export function runFixtureSelfTest(root = process.cwd()): void {
  const profile = loadJson<AsdProfile>(root, "t2.asd-ste100.json");
  validateProfile(profile);
  const termsFile = loadJson<{ terms: Array<TechnicalTerm> }>(root, "t2.asd-ste100.terms.json");
  validateTechnicalTerms(termsFile.terms);
  loadOwnershipManifest(path.join(root, "t2.asd-ste100.ownership.json"));
}

function connected(mode: CliMode): boolean {
  return mode === "pr" || mode === "main" || mode === "release";
}

function sha256Bytes(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

function isVocabularyGateError(error: unknown): boolean {
  return (
    error instanceof VocabularyMissingError ||
    error instanceof VocabularyChecksumMismatchError ||
    error instanceof VocabularyOpaqueError ||
    error instanceof VocabularyEmptyError ||
    (error instanceof Error &&
      (error.name === "VocabularyMissingError" ||
        error.name === "VocabularyChecksumMismatchError" ||
        error.name === "VocabularyOpaqueError" ||
        error.name === "VocabularyEmptyError"))
  );
}

function evaluateG3(mode: CliMode, deps: CliDeps, profile: AsdProfile): GateResult {
  if (!connected(mode)) {
    return { id: "G3", ok: true, reason: "" };
  }
  try {
    const bytes = deps.officialVocabularyBytes();
    if (sha256Bytes(bytes) !== profile.vocabularySha256) {
      return { id: "G3", ok: false, reason: new VocabularyChecksumMismatchError().message };
    }
    parseApprovedWordsFromOfficialBytes(bytes);
    return { id: "G3", ok: true, reason: "" };
  } catch (error) {
    if (isVocabularyGateError(error)) {
      return {
        id: "G3",
        ok: false,
        reason: error instanceof Error ? error.message : "private vocabulary file is missing",
      };
    }
    throw error;
  }
}

function failRun(
  partial: Omit<CliRunResult, "ok" | "exitCode" | "outputs"> & { outputs?: Array<CliOutput> },
): CliRunResult {
  return {
    ...partial,
    ok: false,
    exitCode: EXIT[partial.exitCategory],
    outputs: partial.outputs ?? [],
  };
}

export function runCli(argv: Array<string>, deps: CliDeps): CliRunResult {
  const mode = parseMode(argv);
  const refs = resolvePrGitRefs({
    gitHead: deps.gitHead,
    gitMergeBase: deps.gitMergeBase,
    eventHeadSha: deps.eventHeadSha,
  });
  const scannedPaths = mode === "main" || mode === "release" ? deps.corpusPaths : deps.changedPaths;
  const emptyAggregate = { mode, claim: "ASD-STE100 mechanical rule-subset result" };

  if (connected(mode)) {
    const actions = deps.githubActionsState();
    if (actions !== "disabled") {
      return failRun({
        reason: "GitHub Actions are enabled or their state cannot be verified",
        exitCategory: "github_actions",
        mode,
        gates: [],
        scannedPaths,
        aggregate: emptyAggregate,
      });
    }
  }

  if (mode === "fixture") {
    runFixtureSelfTest(deps.cwd);
  }

  if (connected(mode)) {
    try {
      const connectedProfile = loadJson<AsdProfile>(deps.cwd, "t2.asd-ste100.json");
      validateProfile(connectedProfile);
      deps.officialVocabularyBytes();
    } catch (error) {
      if (
        error instanceof VocabularyMissingError ||
        (error instanceof Error && error.name === "VocabularyMissingError")
      ) {
        const reason =
          error instanceof Error ? error.message : "private vocabulary file is missing";
        return failRun({
          reason,
          exitCategory: "prerequisite",
          mode,
          gates: [{ id: "G3", ok: false, reason }],
          scannedPaths,
          aggregate: emptyAggregate,
        });
      }
      throw error;
    }
  }

  const profile = loadJson<AsdProfile>(deps.cwd, "t2.asd-ste100.json");
  const gates: Array<GateResult> = [];
  gates.push({ id: "G1", ok: true, reason: "" });

  const g2ok = deps.findings.length === 0;
  gates.push({
    id: "G2",
    ok: g2ok,
    reason: g2ok ? "" : "T2-owned changed text has unresolved rule findings",
  });

  gates.push(evaluateG3(mode, deps, profile));

  if (deps.governedSystemTextWithoutTrace) {
    gates.push({
      id: "G4",
      ok: false,
      reason: "governed system text is missing required trace evidence",
    });
  } else {
    const intent = evaluateIntentApplicability({ changedPaths: deps.changedPaths });
    if (intent.status === "not_applicable") {
      gates.push({ id: "G4", ok: true, status: "not_applicable", reason: "no intent artifacts" });
    } else {
      gates.push({ id: "G4", ok: intent.ok, reason: intent.reason });
    }
  }

  const reviewRequired = mode === "pr" || mode === "release";
  gates.push({
    id: "G5",
    ok: true,
    status: reviewRequired ? undefined : "not_applicable",
    reason: "",
  });
  gates.push({ id: "G6", ok: true, reason: "" });

  let reason = "";
  if (mode === "release" && !deps.baseline.ok) {
    reason = "current successful main baseline is missing";
    gates.push({ id: "G7", ok: false, reason });
  } else if (mode === "release" && deps.baseline.sourceSha !== refs.headSha) {
    reason = "baseline source SHA must equal the release candidate SHA";
    gates.push({ id: "G7", ok: false, reason });
  } else if (mode === "release" && !deps.attestationPresent) {
    reason = "rule-subset attestation is missing";
    gates.push({ id: "G7", ok: false, reason });
  } else {
    const requiredFailed = gates.some((gate) => gate.ok === false);
    reason = requiredFailed ? "required gate failure" : "";
    gates.push({ id: "G7", ok: !requiredFailed, reason });
  }

  const g7 = gates.find((gate) => gate.id === "G7");
  const ok = g7?.ok === true;
  const attestation = buildAttestation({
    sourceSha: refs.headSha,
    upstreamSha: loadJson<{ acceptedBaseSha: string }>(deps.cwd, "t2.upstream.json")
      .acceptedBaseSha,
    ownershipSha256: profile.vocabularySha256,
    corpusSha256: digestCanonical(scannedPaths),
    vocabularySha256: profile.vocabularySha256,
    profileIssue: profile.issue,
    ruleCoverage: (profile.rules ?? []).map((rule) => rule.id),
    authorIds: [],
    reviewerIds: [],
    findings: deps.findings,
    overrides: [],
    aggregateOk: ok,
    generatedAt: deps.now(),
  });
  const aggregate = {
    mode,
    claim: profile.claim,
    ok,
    sourceSha: refs.headSha,
    mergeBaseSha: refs.mergeBaseSha,
    findings: deps.findings.map(formatDiagnostic),
    gates,
    scannedPaths,
    generatedAt: deps.now(),
  };

  let officialBytes: Buffer | null = null;
  try {
    officialBytes = deps.officialVocabularyBytes();
  } catch {
    officialBytes = mode === "fixture" ? Buffer.from("fixture-vocab-placeholder") : null;
  }
  if (!deps.leakScanAvailable) {
    officialBytes = null;
  }
  const leak = scanForVocabularyLeak({
    texts: [
      canonicalize(aggregate),
      canonicalize(attestation),
      deps.findings.map(formatDiagnostic).join("\n"),
    ],
    officialBytes,
  });
  if (!leak.ok) {
    return failRun({
      reason: leak.reason,
      exitCategory: "leak",
      mode,
      gates,
      scannedPaths,
      aggregate: { mode, claim: profile.claim },
    });
  }

  const outputs: Array<CliOutput> = [];
  if (ok || mode !== "release") {
    const body = `${canonicalize(aggregate)}\n`;
    const filePath = path.join(CACHE_DIR, `${mode}-result.json`);
    outputs.push({ path: filePath, body });
    deps.writeOutput(filePath, body);
  }
  if (mode === "release" && deps.attestationPresent && ok) {
    const digest = digestCanonical(attestation);
    const filePath = path.join(CACHE_DIR, attestationFilename(digest));
    const body = `${canonicalize(attestation)}\n`;
    outputs.push({ path: filePath, body });
    deps.writeOutput(filePath, body);
  }

  const exitCategory: ExitCategory = ok ? "ok" : "findings";
  return {
    ok,
    reason,
    exitCode: EXIT[exitCategory],
    exitCategory,
    mode,
    gates,
    scannedPaths,
    outputs,
    aggregate,
    attestation,
  };
}

function git(cwd: string, args: ReadonlyArray<string>): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function gitShow(cwd: string, sha: string, filePath: string): string | null {
  try {
    return execFileSync("git", ["show", `${sha}:${filePath}`], {
      cwd,
      encoding: "utf8",
      maxBuffer: 20_000_000,
    });
  } catch {
    return null;
  }
}

function skipScanPath(filePath: string): boolean {
  return /\.test\.ts$/.test(filePath) || filePath.includes("/test/") || filePath.endsWith(".yml");
}

function extractOwned(filePath: string, source: string) {
  if (filePath.endsWith(".md")) {
    return extractMarkdown(filePath, source);
  }
  if (/\.[cm]?[jt]sx?$/.test(filePath)) {
    return extractTypeScript(filePath, source);
  }
  return [];
}

export function loadScanLexicon(
  cwd: string,
  officialBytes: Buffer | null,
): {
  approvedWords: Set<string>;
  technicalTerms: Array<TechnicalTerm>;
} {
  const termsFile = loadJson<{ terms: Array<TechnicalTerm> }>(cwd, "t2.asd-ste100.terms.json");
  validateTechnicalTerms(termsFile.terms);
  const officialWords =
    officialBytes === null ? [] : parseApprovedWordsFromOfficialBytes(officialBytes);
  return {
    approvedWords: approvedWordSet(officialWords),
    technicalTerms: termsFile.terms,
  };
}

export function scanGovernedFindings(input: {
  cwd: string;
  mode: "pr" | "corpus";
  baseSha: string;
  headSha: string;
  officialBytes?: Buffer | null;
}): { paths: Array<string>; findings: Array<Finding> } {
  const manifest = loadOwnershipManifest(path.join(input.cwd, "t2.asd-ste100.ownership.json"));
  const records = collectScopeRecords({
    cwd: input.cwd,
    mode: input.mode,
    baseSha: input.baseSha,
    headSha: input.headSha,
    manifest,
  });
  const lexicon = loadScanLexicon(input.cwd, input.officialBytes ?? null);
  const knownNouns = knownNounsFromTerms(lexicon.technicalTerms);
  const findings: Array<Finding> = [];
  const paths: Array<string> = [];
  for (const record of records) {
    if (!record.includeInCorpusFindings || skipScanPath(record.path)) {
      continue;
    }
    paths.push(record.path);
    const source = gitShow(input.cwd, input.headSha, record.path);
    if (source === null) {
      continue;
    }
    for (const extracted of extractOwned(record.path, source)) {
      findings.push(
        ...checkMechanicalRules({
          path: extracted.path,
          line: extracted.line,
          column: extracted.column,
          text: extracted.text,
          kind: "descriptive",
        }),
        ...checkClaims(extracted),
        ...checkMembershipAndIdentification({
          path: extracted.path,
          line: extracted.line,
          column: extracted.column,
          text: extracted.text,
          approvedWords: lexicon.approvedWords,
          technicalTerms: lexicon.technicalTerms,
          knownNouns,
        }),
      );
    }
  }
  return { paths, findings };
}

export function createDefaultDeps(cwd = process.cwd(), mode: CliMode = "fixture"): CliDeps {
  const root = findRepoRoot(cwd);
  const scanRoot = process.env.ASD_STE100_PR_TREE ?? root;
  const actionsEnv = process.env.ASD_STE100_GITHUB_ACTIONS;
  const gitHead = (): string => git(scanRoot, ["rev-parse", "HEAD"]);
  const gitMergeBase = (): string => {
    const base = process.env.ASD_STE100_BASE_SHA;
    if (base !== undefined && base !== "") {
      return git(scanRoot, ["merge-base", base, "HEAD"]);
    }
    try {
      return execFileSync("git", ["merge-base", "origin/main", "HEAD"], {
        cwd: scanRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    } catch {
      return gitHead();
    }
  };
  const officialPath = process.env.ASD_STE100_VOCABULARY;
  let officialBytes: Buffer | null = null;
  if (officialPath !== undefined && existsSync(officialPath)) {
    officialBytes = readFileSync(officialPath);
  }
  let scanned = { paths: [] as Array<string>, findings: [] as Array<Finding> };
  if (mode !== "fixture") {
    try {
      scanned = scanGovernedFindings({
        cwd: scanRoot,
        mode: mode === "pr" ? "pr" : "corpus",
        baseSha: gitMergeBase(),
        headSha: gitHead(),
        officialBytes,
      });
    } catch (error) {
      if (!isVocabularyGateError(error)) {
        throw error;
      }
    }
  }
  return {
    cwd: root,
    now: () => new Date().toISOString(),
    githubActionsState: () =>
      actionsEnv === "disabled" ? "disabled" : actionsEnv === "enabled" ? "enabled" : "unknown",
    officialVocabularyBytes: () => {
      const officialPath = process.env.ASD_STE100_VOCABULARY;
      if (officialPath === undefined || !existsSync(officialPath)) {
        throw new VocabularyMissingError();
      }
      return readFileSync(officialPath);
    },
    leakScanAvailable: true,
    gitHead,
    gitMergeBase,
    baseline: { ok: false, sourceSha: "" },
    attestationPresent: false,
    changedPaths: mode === "pr" ? scanned.paths : [],
    corpusPaths: mode === "main" || mode === "release" ? scanned.paths : [],
    findings: scanned.findings,
    governedSystemTextWithoutTrace: false,
    writeOutput: (filePath, body) => {
      const absolute = path.join(root, filePath);
      mkdirSync(path.dirname(absolute), { recursive: true });
      writeFileSync(absolute, body);
    },
  };
}

const isDirect =
  process.argv[1]?.endsWith("cli.ts") === true || process.argv[1]?.endsWith("cli.js") === true;
if (isDirect) {
  try {
    const argv = process.argv.slice(2);
    const mode = parseMode(argv);
    const result = runCli(
      argv.length === 0 ? ["--mode", "fixture"] : argv,
      createDefaultDeps(process.cwd(), mode),
    );
    if (!result.ok) {
      process.stderr.write(`${result.reason}\n`);
      const printed = result.aggregate.findings;
      if (Array.isArray(printed)) {
        for (const finding of printed) {
          process.stderr.write(`${String(finding)}\n`);
        }
      }
      process.exitCode = result.exitCode;
    } else if (result.mode === "fixture") {
      process.stdout.write("asd-ste100 fixture self-test passed\n");
    } else {
      process.stdout.write(`asd-ste100 ${result.mode} passed\n`);
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
