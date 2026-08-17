import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { applyPinAtGitMerge, exportWordsJson } from "./export.ts";
import { importOriginals, LexiconError, listEntities, type OriginalItem } from "./import.ts";
import { applyLayoutAutomation, guessLayoutKind } from "./layout.ts";
import { mutateFrozenLexicon } from "./mutate.ts";
import { exportApprovedWordsJson } from "./normalize.ts";
import { ocrJpgToSidecar } from "./ocr.ts";

export const DEFAULT_SRC = "/Users/maxholden/Downloads/ASD-STE100_Issue9_JPG_Ordered_Set/pages";
export const DEFAULT_DEST = "/Users/maxholden/T2-SQUARED-References/lexicon-private/bridge.sqlite";

export interface LexiconScanInput {
  src: string;
  dest: string;
  actorId: string;
  ocrPage?: (jpgPath: string, txtPath: string) => void;
}

export function destInsideGitWorkTree(destPath: string): boolean {
  const resolved = path.resolve(destPath);
  let dir =
    existsSync(resolved) && statSync(resolved).isDirectory() ? resolved : path.dirname(resolved);
  while (true) {
    if (existsSync(path.join(dir, ".git"))) {
      return true;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return false;
    }
    dir = parent;
  }
}

export function destRootFromSqlite(dest: string): string {
  return path.dirname(path.resolve(dest));
}

export function sidecarDir(destRoot: string): string {
  return path.join(destRoot, "sidecars");
}

function jpgNames(srcDir: string): Array<string> {
  const names = readdirSync(srcDir)
    .filter((name) => /\.jpe?g$/i.test(name))
    .sort();
  if (names.length === 0) {
    throw new LexiconError("no jpg files in src.");
  }
  return names;
}

function stemOf(name: string): string {
  return name.replace(/\.jpe?g$/i, "");
}

export function ensureSidecars(
  srcDir: string,
  destRoot: string,
  ocrPage: (jpgPath: string, txtPath: string) => void = ocrJpgToSidecar,
): Array<string> {
  mkdirSync(sidecarDir(destRoot), { recursive: true });
  const written: Array<string> = [];
  for (const name of jpgNames(srcDir)) {
    const stem = stemOf(name);
    const destTxt = path.join(sidecarDir(destRoot), `${stem}.txt`);
    const srcTxt = path.join(srcDir, `${stem}.txt`);
    if (!existsSync(destTxt) && existsSync(srcTxt)) {
      copyFileSync(srcTxt, destTxt);
    }
    if (!existsSync(destTxt)) {
      process.stderr.write(`sidecar ${written.length + 1} ${stem}\n`);
      ocrPage(path.join(srcDir, name), destTxt);
    }
    if (!existsSync(destTxt)) {
      throw new LexiconError(`missing sidecar for ${name}`);
    }
    written.push(destTxt);
  }
  return written;
}

export function itemsFromJpgDir(srcDir: string, destRoot: string): Array<OriginalItem> {
  return jpgNames(srcDir).map((name, index) => {
    const sidecar = path.join(sidecarDir(destRoot), `${stemOf(name)}.txt`);
    const originalText = readFileSync(sidecar, "utf8").trim();
    return {
      page: index + 1,
      kind: guessLayoutKind(originalText),
      originalText,
    };
  });
}

export function runLexiconScan(input: LexiconScanInput): void {
  if (destInsideGitWorkTree(input.dest)) {
    throw new LexiconError("dest must stay off the git work tree.");
  }
  const destRoot = destRootFromSqlite(input.dest);
  mkdirSync(destRoot, { recursive: true });
  ensureSidecars(input.src, destRoot, input.ocrPage ?? ocrJpgToSidecar);
  if (!(existsSync(input.dest) && listEntities(input.dest).length > 0)) {
    importOriginals(input.dest, {
      actorId: input.actorId,
      items: itemsFromJpgDir(input.src, destRoot),
    });
    applyLayoutAutomation(input.dest, {
      actorId: input.actorId,
      agentCorrect: (entity) => entity.kind,
    });
  }
  mutateFrozenLexicon(input.dest, input.actorId);
  exportWordsJson(input.dest, path.join(destRoot, "words.json"), input.actorId);
  exportApprovedWordsJson(input.dest, path.join(destRoot, "approved-words.json"), input.actorId);
}

function flagValue(argv: Array<string>, name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) {
    return undefined;
  }
  return argv[index + 1];
}

export function main(argv: Array<string> = process.argv.slice(2)): number {
  try {
    if (argv.includes("--git-merge")) {
      const wordsPath = flagValue(argv, "--words");
      const profilePath = flagValue(argv, "--profile");
      const termsPath = flagValue(argv, "--terms");
      if (wordsPath === undefined || profilePath === undefined || termsPath === undefined) {
        process.stderr.write("pin apply needs --git-merge --words --profile --terms.\n");
        return 1;
      }
      const surfaces = (flagValue(argv, "--surfaces") ?? "")
        .split(",")
        .map((row) => row.trim())
        .filter((row) => row.length > 0);
      applyPinAtGitMerge({
        gitMerge: true,
        wordsPath,
        profilePath,
        termsPath,
        surfaces,
      });
      return 0;
    }
    const src = flagValue(argv, "--src") ?? DEFAULT_SRC;
    const dest = flagValue(argv, "--dest") ?? DEFAULT_DEST;
    const actorId = flagValue(argv, "--actor") ?? "operator";
    runLexiconScan({ src, dest, actorId });
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "lexicon scan failed.";
    process.stderr.write(`${message}\n`);
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = main();
}
