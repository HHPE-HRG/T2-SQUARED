import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

function sha256Bytes(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
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

function main(argv: Array<string>): void {
  const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const destDir = parseArg("--dest", argv) ?? "/home/oldmac-vm/forgejo-runner-t2-trusted/vocab";
  const result = installProvisionalVocabulary({
    fixturePath:
      parseArg("--fixture", argv) ??
      path.join(repoRoot, "scripts/asd-ste100/test/fixtures/vocab/synthetic.json"),
    destDir,
    profilePath: parseArg("--profile", argv) ?? path.join(repoRoot, "t2.asd-ste100.json"),
    coveragePath:
      parseArg("--coverage", argv) ??
      path.join(repoRoot, "scripts/asd-ste100/mapping/records/vocabulary-coverage.json"),
  });
  const check = verifyMountedVocabulary({
    profilePath: parseArg("--profile", argv) ?? path.join(repoRoot, "t2.asd-ste100.json"),
    vocabularyPath: result.vocabularyPath,
  });
  process.stdout.write(`${JSON.stringify({ ...result, pinMatch: check.pinMatch }, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2));
}
