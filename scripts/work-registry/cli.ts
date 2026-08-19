import { pathToFileURL } from "node:url";
import path from "node:path";

import { PRODUCT_NAME } from "./glossary.ts";
import {
  checkDrift,
  checkWorkRegistry,
  compileCampaign,
  dumpWorkRegistry,
  lookupSchema,
  registerCampaign,
} from "./registry.ts";

function parseArg(name: string, argv: Array<string>): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) {
    return undefined;
  }
  return argv[index + 1];
}

export function runCli(argv: Array<string>, cwd: string = process.cwd()): void {
  const root = parseArg("--root", argv) ?? process.env.T2_WORK_REGISTRY_ROOT ?? cwd;
  const compileName = parseArg("--compile", argv);
  const lookupName = parseArg("--lookup", argv);
  const checkName = parseArg("--check", argv);
  if (compileName !== undefined) {
    compileCampaign(path.join(root, PRODUCT_NAME, compileName));
    return;
  }
  if (lookupName !== undefined) {
    process.stdout.write(
      `${JSON.stringify(lookupSchema(path.join(root, PRODUCT_NAME, lookupName)))}\n`,
    );
    return;
  }
  if (argv.includes("--dump")) {
    process.stdout.write(`${JSON.stringify(dumpWorkRegistry(root))}\n`);
    return;
  }
  if (checkName !== undefined) {
    const campaignDir = path.join(root, PRODUCT_NAME, checkName);
    registerCampaign(campaignDir);
    checkDrift(campaignDir);
    return;
  }
  checkWorkRegistry(root);
}

function main(argv: Array<string>): void {
  runCli(argv);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2));
}
