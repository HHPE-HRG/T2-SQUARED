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
import { admitFailClosedUncheckable } from "./admission.ts";
import { checkClaims } from "./claim.ts";
import { formatDiagnostic } from "./diagnostics.ts";
import {
  extractJsonYaml,
  extractMarkdown,
  extractTypeScript,
  extractTypeScriptComments,
} from "./extract.ts";
import {
  assertReviewedRulesHaveMappingRecords,
  loadLiveMappingRecords,
} from "./mapping/promote.ts";
import { collectScopeRecords, loadOwnershipManifest } from "./ownership.ts";
import { approvedWordSet, knownNounsFromTerms } from "./membership.ts";
import { ASD_RULE_PREFIX, enforcedChecker } from "./registry.ts";
import { inferMechanicalKind } from "./rules.ts";
import type { Finding } from "./rules.ts";
import { evaluateIntentApplicability } from "./trace.ts";
import type { ForgejoPull, ForgejoReview, ReviewerRoster } from "./forgejo.ts";
import {
  validateOverride,
  validateReview,
  type CurrentFinding,
  type ProposedOverride,
} from "./override.ts";
import {
  parseApprovedWordsFromOfficialBytes,
  validateAnchor,
  validateProfile,
  validateTechnicalTerms,
  VocabularyChecksumMismatchError,
  VocabularyEmptyError,
  VocabularyMissingError,
  VocabularyOpaqueError,
} from "./vocabulary.ts";
import type { AsdAnchor, AsdProfile, TechnicalTerm } from "./vocabulary.ts";

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
  authorIds: Array<number>;
  reviewerIds: Array<number>;
  overrides: Array<unknown>;
  governedSystemTextWithoutTrace: boolean;
  writeOutput: (filePath: string, body: string) => void;
  pull?: ForgejoPull;
  review?: ForgejoReview;
  roster?: ReviewerRoster;
  mergeBaseRoster?: ReviewerRoster;
  proposedOverride?: ProposedOverride;
  overrideCurrentFindings?: Array<CurrentFinding>;
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
  assertReviewedRulesHaveMappingRecords(profile.rules ?? [], loadLiveMappingRecords(root));
  const termsFile = loadJson<{ terms: Array<TechnicalTerm> }>(root, "t2.asd-ste100.terms.json");
  validateTechnicalTerms(termsFile.terms);
  loadOwnershipManifest(path.join(root, "t2.asd-ste100.ownership.json"));
  const anchor = loadJson<AsdAnchor>(root, "t2.asd-ste100.anchor.json");
  validateAnchor(anchor);
}

function connected(mode: CliMode): boolean {
  return mode === "pr" || mode === "main" || mode === "release";
}

function countsTowardG2(finding: Finding, profile: AsdProfile): boolean {
  if (finding.ruleId === "T10") {
    return true;
  }
  if (finding.ruleId === `${ASD_RULE_PREFIX}1.1` || finding.ruleId === `${ASD_RULE_PREFIX}4.5`) {
    return profile.vocabularyReview === "human-verified";
  }
  return finding.ruleId.startsWith(ASD_RULE_PREFIX);
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

function evaluateG5(mode: CliMode, deps: CliDeps): GateResult {
  if (mode !== "pr" && mode !== "release") {
    return { id: "G5", ok: true, status: "not_applicable", reason: "" };
  }
  if (deps.pull === undefined || deps.review === undefined || deps.roster === undefined) {
    return { id: "G5", ok: false, reason: "review is missing" };
  }
  const result = validateReview({
    pull: deps.pull,
    review: deps.review,
    roster: deps.roster,
  });
  return { id: "G5", ok: result.ok, reason: result.reason };
}

function evaluateG6(deps: CliDeps): GateResult {
  if (deps.proposedOverride === undefined && deps.overrides.length === 0) {
    return { id: "G6", ok: true, reason: "" };
  }
  if (
    deps.pull === undefined ||
    deps.review === undefined ||
    deps.roster === undefined ||
    deps.mergeBaseRoster === undefined ||
    deps.proposedOverride === undefined ||
    deps.overrideCurrentFindings === undefined
  ) {
    return { id: "G6", ok: false, reason: "override is missing" };
  }
  const result = validateOverride({
    pull: deps.pull,
    review: deps.review,
    roster: deps.roster,
    mergeBaseRoster: deps.mergeBaseRoster,
    proposed: deps.proposedOverride,
    currentFindings: deps.overrideCurrentFindings,
    changedPaths: deps.changedPaths,
  });
  return { id: "G6", ok: result.ok, reason: result.reason };
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

  const g2ok = !deps.findings.some((finding) => countsTowardG2(finding, profile));
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

  gates.push(evaluateG5(mode, deps));
  gates.push(evaluateG6(deps));

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
    ownershipSha256: sha256Bytes(readFileSync(path.join(deps.cwd, "t2.asd-ste100.ownership.json"))),
    corpusSha256: digestCanonical(scannedPaths),
    vocabularySha256: profile.vocabularySha256,
    profileIssue: profile.issue,
    ruleCoverage: (profile.rules ?? []).map((rule) => rule.id),
    authorIds: [...deps.authorIds],
    reviewerIds: [...deps.reviewerIds],
    findings: deps.findings,
    overrides: [...deps.overrides],
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

const GIT_MAX_BUFFER = 64_000_000;

function git(cwd: string, args: ReadonlyArray<string>): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: GIT_MAX_BUFFER,
  }).trim();
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
  return (
    /\.test\.ts$/.test(filePath) ||
    filePath.includes("/test/") ||
    filePath.endsWith(".yml") ||
    filePath.endsWith(".yaml") ||
    filePath.startsWith("docs/plans/") ||
    filePath.startsWith("scripts/asd-ste100/mapping/records/") ||
    filePath.endsWith("AGENT_HEURISTIC.md")
  );
}

export { skipScanPath };

function extractOwned(filePath: string, source: string) {
  if (filePath.endsWith(".md")) {
    return extractMarkdown(filePath, source);
  }
  if (/\.[cm]?[jt]sx?$/.test(filePath)) {
    return [...extractTypeScript(filePath, source), ...extractTypeScriptComments(filePath, source)];
  }
  if (/\.json$/.test(filePath)) {
    return extractJsonYaml(filePath, source);
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
  checkerCwd?: string;
  treeCwd?: string;
  mode: "pr" | "corpus";
  baseSha: string;
  headSha: string;
  officialBytes?: Buffer | null;
}): { paths: Array<string>; findings: Array<Finding> } {
  const checkerCwd = input.checkerCwd ?? input.cwd;
  const treeCwd = input.treeCwd ?? input.cwd;
  const manifest = loadOwnershipManifest(path.join(checkerCwd, "t2.asd-ste100.ownership.json"));
  const records = collectScopeRecords({
    cwd: treeCwd,
    mode: input.mode,
    baseSha: input.baseSha,
    headSha: input.headSha,
    manifest,
  });
  const officialBytes = input.officialBytes ?? null;
  const profile = loadJson<AsdProfile>(checkerCwd, "t2.asd-ste100.json");
  if (officialBytes !== null) {
    if (sha256Bytes(officialBytes) !== profile.vocabularySha256) {
      throw new VocabularyChecksumMismatchError();
    }
  }
  const lexicon = loadScanLexicon(checkerCwd, officialBytes);
  const knownNouns = knownNounsFromTerms(lexicon.technicalTerms);
  const liveRules = profile.rules ?? [];
  const findings: Array<Finding> = [];
  const paths: Array<string> = [];
  const kind = (text: string) => inferMechanicalKind(text);
  for (const record of records) {
    if (!record.includeInCorpusFindings || skipScanPath(record.path)) {
      continue;
    }
    paths.push(record.path);
    const source = gitShow(treeCwd, input.headSha, record.path);
    if (source === null) {
      continue;
    }
    for (const extracted of extractOwned(record.path, source)) {
      findings.push(...checkClaims(extracted));
      for (const rule of liveRules) {
        if (rule.checker === undefined || rule.checker.length === 0) {
          throw new Error(`unregistered checker: (missing)`);
        }
        const checker = enforcedChecker(rule.checker);
        findings.push(
          ...checker.check({
            path: extracted.path,
            line: extracted.line,
            column: extracted.column,
            text: extracted.text,
            kind: kind(extracted.text),
            approvedWords: lexicon.approvedWords,
            technicalTerms: lexicon.technicalTerms,
            knownNouns,
          }),
        );
      }
    }
  }
  for (const row of loadLiveMappingRecords(checkerCwd)) {
    if (row.class !== "fail_closed_uncheckable") {
      continue;
    }
    findings.push(...admitFailClosedUncheckable({ row }).findings);
  }
  return { paths, findings };
}

export function createDefaultDeps(cwd = process.cwd(), mode: CliMode = "fixture"): CliDeps {
  const root = findRepoRoot(cwd);
  const treeCwd = process.env.ASD_STE100_PR_TREE ?? root;
  const actionsEnv = process.env.ASD_STE100_GITHUB_ACTIONS;
  const gitHead = (): string => git(treeCwd, ["rev-parse", "HEAD"]);
  const gitMergeBase = (): string => {
    const base = process.env.ASD_STE100_BASE_SHA;
    if (base !== undefined && base !== "") {
      return git(root, ["merge-base", base, "HEAD"]);
    }
    try {
      return execFileSync("git", ["merge-base", "origin/main", "HEAD"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: GIT_MAX_BUFFER,
      }).trim();
    } catch {
      return git(root, ["rev-parse", "HEAD"]);
    }
  };
  const officialPath = process.env.ASD_STE100_VOCABULARY;
  let officialBytes: Buffer | null = null;
  if (officialPath !== undefined && existsSync(officialPath)) {
    officialBytes = readFileSync(officialPath);
  }
  let scanned = { paths: [] as Array<string>, findings: [] as Array<Finding> };
  if (mode !== "fixture") {
    if (officialBytes === null) {
      throw new VocabularyMissingError();
    }
    scanned = scanGovernedFindings({
      cwd: root,
      checkerCwd: root,
      treeCwd,
      mode: mode === "pr" ? "pr" : "corpus",
      baseSha: gitMergeBase(),
      headSha: gitHead(),
      officialBytes,
    });
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
    authorIds: [],
    reviewerIds: [],
    overrides: [],
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
