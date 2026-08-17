import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import { applyPinAtGitMerge } from "./export.ts";
import { importOriginals, LexiconError, type OriginalItem } from "./import.ts";
import { applyLayoutAutomation, guessLayoutKind } from "./layout.ts";

export interface LexiconScanInput {
  src: string;
  dest: string;
  actorId: string;
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

export function itemsFromJpgDir(srcDir: string): Array<OriginalItem> {
  const names = readdirSync(srcDir)
    .filter((name) => /\.jpe?g$/i.test(name))
    .sort();
  if (names.length === 0) {
    throw new LexiconError("no jpg files in src.");
  }
  return names.map((name, index) => {
    const stem = name.replace(/\.jpe?g$/i, "");
    const sidecar = path.join(srcDir, `${stem}.txt`);
    if (!existsSync(sidecar)) {
      throw new LexiconError(`missing sidecar for ${name}`);
    }
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
  mkdirSync(path.dirname(path.resolve(input.dest)), { recursive: true });
  importOriginals(input.dest, {
    actorId: input.actorId,
    items: itemsFromJpgDir(input.src),
  });
  applyLayoutAutomation(input.dest, {
    actorId: input.actorId,
    agentCorrect: (entity) => entity.kind,
  });
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
    const src = flagValue(argv, "--src");
    const dest = flagValue(argv, "--dest");
    const actorId = flagValue(argv, "--actor") ?? "operator";
    if (src === undefined || dest === undefined) {
      process.stderr.write("lexicon scan needs --src and --dest.\n");
      return 1;
    }
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
