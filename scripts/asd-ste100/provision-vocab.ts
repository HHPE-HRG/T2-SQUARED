import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { AsdProfile } from "./vocabulary.ts";
import { parseApprovedWordsFromOfficialBytes } from "./vocabulary.ts";

export interface InstallProvisionalVocabularyInput {
  fixturePath: string;
  destDir: string;
  profilePath: string;
  coveragePath: string;
}

export interface InstallProvisionalVocabularyResult {
  vocabularyPath: string;
  vocabularySha256: string;
  lemmaCount: number;
  vocabularyReview: "pending-human";
}

export interface VerifyMountedVocabularyInput {
  profilePath: string;
  vocabularyPath: string;
}

export interface VerifyMountedVocabularyResult {
  pinMatch: boolean;
  lemmaCount: number;
  vocabularyReview: AsdProfile["vocabularyReview"];
}

export interface MountIssue9VocabularyInput {
  sourcePath: string;
  destDir: string;
}

export interface MountIssue9VocabularyResult {
  vocabularyPath: string;
  vocabularySha256: string;
  lemmaCount: number;
}

function sha256Bytes(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

function syntheticFixturePath(repoRoot: string): string {
  return path.join(repoRoot, "scripts/asd-ste100/test/fixtures/vocab/synthetic.json");
}

export function installProvisionalVocabulary(
  input: InstallProvisionalVocabularyInput,
): InstallProvisionalVocabularyResult {
  mkdirSync(input.destDir, { recursive: true });
  mkdirSync(path.dirname(input.coveragePath), { recursive: true });
  const vocabularyPath = path.join(input.destDir, "synthetic.json");
  copyFileSync(input.fixturePath, vocabularyPath);
  const bytes = readFileSync(vocabularyPath);
  const vocabularySha256 = sha256Bytes(bytes);
  const lemmaCount = parseApprovedWordsFromOfficialBytes(bytes).length;
  const profile = JSON.parse(readFileSync(input.profilePath, "utf8")) as AsdProfile;
  profile.vocabularySha256 = vocabularySha256;
  profile.vocabularyReview = "pending-human";
  writeFileSync(input.profilePath, `${JSON.stringify(profile, null, 2)}\n`);
  writeFileSync(
    input.coveragePath,
    `${JSON.stringify(
      {
        coverageKind: "provisional-unreviewed",
        lemmaCount,
        vocabularySha256,
        humanReview: "pending-human",
      },
      null,
      2,
    )}\n`,
  );
  return {
    vocabularyPath,
    vocabularySha256,
    lemmaCount,
    vocabularyReview: "pending-human",
  };
}

export function mountIssue9Vocabulary(
  input: MountIssue9VocabularyInput,
): MountIssue9VocabularyResult {
  mkdirSync(input.destDir, { recursive: true });
  const vocabularyPath = path.join(input.destDir, "approved-words.json");
  copyFileSync(input.sourcePath, vocabularyPath);
  const bytes = readFileSync(vocabularyPath);
  return {
    vocabularyPath,
    vocabularySha256: sha256Bytes(bytes),
    lemmaCount: parseApprovedWordsFromOfficialBytes(bytes).length,
  };
}

export function verifyMountedVocabulary(
  input: VerifyMountedVocabularyInput,
): VerifyMountedVocabularyResult {
  const profile = JSON.parse(readFileSync(input.profilePath, "utf8")) as AsdProfile;
  const bytes = readFileSync(input.vocabularyPath);
  const lemmaCount = parseApprovedWordsFromOfficialBytes(bytes).length;
  return {
    pinMatch: sha256Bytes(bytes) === profile.vocabularySha256,
    lemmaCount,
    vocabularyReview: profile.vocabularyReview,
  };
}

function parseArg(name: string, argv: Array<string>): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) {
    return undefined;
  }
  return argv[index + 1];
}

function hasFlag(name: string, argv: Array<string>): boolean {
  return argv.includes(name);
}

function defaultDestDir(): string {
  return "/home/oldmac-vm/forgejo-runner-t2-trusted/vocab";
}

function resolveVerifyPath(argv: Array<string>): string {
  const explicit = parseArg("--vocabulary", argv);
  if (explicit !== undefined) {
    return explicit;
  }
  const destDir = parseArg("--dest", argv) ?? defaultDestDir();
  const approvedPath = path.join(destDir, "approved-words.json");
  if (existsSync(approvedPath)) {
    return approvedPath;
  }
  return path.join(destDir, "synthetic.json");
}

export function runProvisionCli(argv: Array<string>): number {
  const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const profilePath = parseArg("--profile", argv) ?? path.join(repoRoot, "t2.asd-ste100.json");
  if (hasFlag("--verify-only", argv)) {
    const check = verifyMountedVocabulary({
      profilePath,
      vocabularyPath: resolveVerifyPath(argv),
    });
    process.stdout.write(`${JSON.stringify(check, null, 2)}\n`);
    return check.pinMatch ? 0 : 1;
  }
  const destDir = parseArg("--dest", argv) ?? defaultDestDir();
  const mountSource = parseArg("--mount-source", argv);
  if (mountSource !== undefined) {
    const result = mountIssue9Vocabulary({ sourcePath: mountSource, destDir });
    const check = verifyMountedVocabulary({
      profilePath,
      vocabularyPath: result.vocabularyPath,
    });
    process.stdout.write(`${JSON.stringify({ ...result, pinMatch: check.pinMatch }, null, 2)}\n`);
    return check.pinMatch ? 0 : 1;
  }
  const fixturePath = parseArg("--fixture", argv) ?? syntheticFixturePath(repoRoot);
  const profile = JSON.parse(readFileSync(profilePath, "utf8")) as AsdProfile;
  if (
    profile.vocabularySha256 !== sha256Bytes(readFileSync(fixturePath)) &&
    !hasFlag("--force-fixture", argv)
  ) {
    process.stderr.write("`refuse` to replace an `Issue` 9 `pin` with the `synthetic` `fixture`.\n");
    return 1;
  }
  const result = installProvisionalVocabulary({
    fixturePath,
    destDir,
    profilePath,
    coveragePath:
      parseArg("--coverage", argv) ??
      path.join(repoRoot, "scripts/asd-ste100/mapping/records/vocabulary-coverage.json"),
  });
  const check = verifyMountedVocabulary({
    profilePath,
    vocabularyPath: result.vocabularyPath,
  });
  process.stdout.write(`${JSON.stringify({ ...result, pinMatch: check.pinMatch }, null, 2)}\n`);
  return 0;
}

function main(argv: Array<string>): void {
  const code = runProvisionCli(argv);
  if (code !== 0) {
    process.exit(code);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2));
}
