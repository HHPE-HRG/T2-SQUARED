import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { LexiconError } from "./import.ts";

export function ocrJpgToSidecar(jpgPath: string, txtPath: string): void {
  mkdirSync(path.dirname(txtPath), { recursive: true });
  const outBase = txtPath.replace(/\.txt$/i, "");
  try {
    execFileSync("tesseract", [jpgPath, outBase, "-l", "eng"], {
      stdio: ["ignore", "ignore", "pipe"],
      timeout: 120_000,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "tesseract failed.";
    throw new LexiconError(`ocr failed for ${path.basename(jpgPath)}: ${detail}`);
  }
}
