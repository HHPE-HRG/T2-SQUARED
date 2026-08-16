import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PRODUCT_NAME, REQUIRED_WORK_REGISTRY_TERMS, type WorkRegistryTerm } from "./glossary.ts";

export class WorkRegistryError extends Error {
  override readonly name = "WorkRegistryError";
  constructor(message: string) {
    super(message);
  }
}

export interface CampaignManifest {
  product: string;
  campaign: string;
  proposal: string;
  schema: string;
  forgejoApproved: boolean;
  humanApproved: boolean;
  humanOverride: boolean;
}

export interface CompiledSchema {
  product: string;
  campaign: string;
  terms: Array<WorkRegistryTerm>;
}

export interface EpochRow {
  kind: "epoch";
  campaign: string;
  subject: "genesis" | "progeny";
  id: string;
  commitSha: string;
}

export interface GenesisRecord {
  kind: "genesis";
  campaign: string;
  commitSha: string;
  forgejoReviewId: string | null;
}

export interface ProgenyRecord {
  kind: "progeny";
  campaign: string;
  genesis: string;
  id: string;
  commitSha: string;
}

const COMMIT_SHA = /^[a-f0-9]{40}$/;

const STRUCTURED_EXT = [".json", ".yaml"] as const;
const EXTRA_JSON_DIRS = new Set(["progeny"]);
const EXTRA_JSON_FILES = new Set(["genesis", "epoch"]);

function posixRel(from: string, to: string): string {
  return path.relative(from, to).split(path.sep).join("/");
}

function listFiles(dir: string, acc: Array<string> = []): Array<string> {
  for (const name of readdirSync(dir)) {
    const next = path.join(dir, name);
    if (statSync(next).isDirectory()) {
      listFiles(next, acc);
    } else {
      acc.push(next);
    }
  }
  return acc;
}

function parseDocument(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function encodeDocument(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function stem(rel: string): string {
  return rel.replace(/\.(json|yaml)$/i, "");
}

function isStructured(rel: string): boolean {
  return STRUCTURED_EXT.some((ext) => rel.endsWith(ext));
}

export function campaignIsApproved(manifest: CampaignManifest): boolean {
  if (!manifest.humanApproved) {
    return false;
  }
  return manifest.forgejoApproved || manifest.humanOverride;
}

export function loadManifest(campaignDir: string): CampaignManifest {
  const jsonPath = path.join(campaignDir, "manifest.json");
  const yamlPath = path.join(campaignDir, "manifest.yaml");
  if (existsSync(jsonPath) && existsSync(yamlPath)) {
    throw new WorkRegistryError("the campaign has two documents.");
  }
  const filePath = existsSync(jsonPath) ? jsonPath : yamlPath;
  if (!existsSync(filePath)) {
    throw new WorkRegistryError("the manifest is not valid.");
  }
  const payload = parseDocument(filePath) as CampaignManifest;
  if (
    payload.product !== PRODUCT_NAME ||
    typeof payload.campaign !== "string" ||
    typeof payload.proposal !== "string" ||
    typeof payload.schema !== "string" ||
    typeof payload.forgejoApproved !== "boolean" ||
    typeof payload.humanApproved !== "boolean" ||
    typeof payload.humanOverride !== "boolean"
  ) {
    throw new WorkRegistryError("the manifest is not valid.");
  }
  return payload;
}

function termHit(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^A-Za-z])${escaped}(?:[^A-Za-z]|$)`, "i").test(text);
}

export function termsFromProposal(text: string): Array<WorkRegistryTerm> {
  return REQUIRED_WORK_REGISTRY_TERMS.filter((term) => termHit(text, term.term)).sort(
    (left, right) => left.term.localeCompare(right.term),
  );
}

function glossaryNames(): Set<string> {
  return new Set(REQUIRED_WORK_REGISTRY_TERMS.map((term) => term.term.toLowerCase()));
}

function hyphenatedTokens(text: string): Array<string> {
  return text.match(/\b[A-Za-z][A-Za-z]*-[A-Za-z][A-Za-z'-]*\b/g) ?? [];
}

export function assertNounTranslation(text: string): void {
  const known = glossaryNames();
  const sentences = text.split(/(?<=\.)\s+/);
  for (const token of hyphenatedTokens(text)) {
    if (known.has(token.toLowerCase())) {
      continue;
    }
    const sentence = sentences.find((part) => termHit(part, token));
    const translated =
      sentence !== undefined &&
      REQUIRED_WORK_REGISTRY_TERMS.some(
        (term) => term.kind === "noun" && termHit(sentence, term.term),
      );
    if (!translated) {
      throw new WorkRegistryError("the proposal must translate the new noun.");
    }
  }
}

function isCommitSha(value: unknown): value is string {
  return typeof value === "string" && COMMIT_SHA.test(value);
}

function findNamedDocument(campaignDir: string, name: string): string | undefined {
  const jsonPath = path.join(campaignDir, `${name}.json`);
  const yamlPath = path.join(campaignDir, `${name}.yaml`);
  if (existsSync(jsonPath) && existsSync(yamlPath)) {
    throw new WorkRegistryError("the campaign has two documents.");
  }
  if (existsSync(jsonPath)) {
    return jsonPath;
  }
  if (existsSync(yamlPath)) {
    return yamlPath;
  }
  return undefined;
}

function validateGenesis(manifest: CampaignManifest, campaignDir: string): GenesisRecord {
  const filePath = findNamedDocument(campaignDir, "genesis");
  if (filePath === undefined) {
    throw new WorkRegistryError("the genesis is missing.");
  }
  const payload = parseDocument(filePath) as GenesisRecord;
  const reviewOk =
    manifest.forgejoApproved === false
      ? payload.forgejoReviewId === null
      : typeof payload.forgejoReviewId === "string" && payload.forgejoReviewId.length > 0;
  if (
    payload.kind !== "genesis" ||
    payload.campaign !== manifest.campaign ||
    !isCommitSha(payload.commitSha) ||
    !reviewOk
  ) {
    throw new WorkRegistryError("the genesis is not valid.");
  }
  return payload;
}

function validateProgeny(manifest: CampaignManifest, campaignDir: string): void {
  const progenyDir = path.join(campaignDir, "progeny");
  if (!existsSync(progenyDir) || !statSync(progenyDir).isDirectory()) {
    return;
  }
  for (const name of readdirSync(progenyDir)) {
    const filePath = path.join(progenyDir, name);
    if (!statSync(filePath).isFile() || !isStructured(name)) {
      continue;
    }
    const payload = parseDocument(filePath) as ProgenyRecord;
    if (
      payload.kind !== "progeny" ||
      payload.campaign !== manifest.campaign ||
      payload.genesis !== manifest.campaign ||
      typeof payload.id !== "string" ||
      payload.id.length === 0 ||
      !isCommitSha(payload.commitSha)
    ) {
      throw new WorkRegistryError("the progeny is not valid.");
    }
  }
}

function validateEpoch(manifest: CampaignManifest, campaignDir: string): void {
  const filePath = findNamedDocument(campaignDir, "epoch");
  if (filePath === undefined) {
    return;
  }
  const parsed = parseDocument(filePath);
  if (!Array.isArray(parsed)) {
    throw new WorkRegistryError("the epoch is not valid.");
  }
  for (const row of parsed as Array<EpochRow>) {
    if (
      row.kind !== "epoch" ||
      row.campaign !== manifest.campaign ||
      (row.subject !== "genesis" && row.subject !== "progeny") ||
      typeof row.id !== "string" ||
      row.id.length === 0 ||
      !isCommitSha(row.commitSha)
    ) {
      throw new WorkRegistryError("the epoch is not valid.");
    }
  }
}

function extraStructuredAllowed(rel: string): boolean {
  const parts = rel.split("/");
  const file = parts.at(-1);
  if (file === undefined || !isStructured(rel)) {
    return false;
  }
  const name = stem(file);
  if (parts.length === 1 && EXTRA_JSON_FILES.has(name)) {
    return true;
  }
  if (parts.length === 2 && EXTRA_JSON_DIRS.has(parts[0] ?? "") && parts[0] !== undefined) {
    return true;
  }
  return false;
}

function assertOneDocumentPerStem(rels: ReadonlyArray<string>): void {
  const seen = new Map<string, string>();
  for (const rel of rels) {
    if (!isStructured(rel)) {
      continue;
    }
    const key = stem(rel);
    const prior = seen.get(key);
    if (prior !== undefined && prior !== rel) {
      throw new WorkRegistryError("the campaign has two documents.");
    }
    seen.set(key, rel);
  }
}

export function registerCampaign(campaignDir: string): CampaignManifest {
  const manifest = loadManifest(campaignDir);
  if (!campaignIsApproved(manifest)) {
    throw new WorkRegistryError("the campaign is not approved.");
  }
  const proposalPath = path.join(campaignDir, manifest.proposal);
  if (!existsSync(proposalPath) || !manifest.proposal.endsWith(".md")) {
    throw new WorkRegistryError("the manifest must name one proposal.");
  }
  const rels = listFiles(campaignDir).map((filePath) => posixRel(campaignDir, filePath));
  assertOneDocumentPerStem(rels);
  const allowed = new Set([
    "manifest.json",
    "manifest.yaml",
    posixRel(campaignDir, proposalPath),
    posixRel(campaignDir, path.join(campaignDir, manifest.schema)),
  ]);
  for (const rel of rels) {
    if (rel.split("/").includes("ideation")) {
      throw new WorkRegistryError("ideation is not a campaign.");
    }
    if (rel.endsWith(".md") && rel !== posixRel(campaignDir, proposalPath)) {
      throw new WorkRegistryError("the campaign has extra markdown.");
    }
    if (allowed.has(rel) || extraStructuredAllowed(rel)) {
      continue;
    }
    throw new WorkRegistryError("the campaign has extra files.");
  }
  assertNounTranslation(readFileSync(proposalPath, "utf8"));
  validateGenesis(manifest, campaignDir);
  validateProgeny(manifest, campaignDir);
  validateEpoch(manifest, campaignDir);
  return manifest;
}

function compiledFromProposal(campaignDir: string): CompiledSchema {
  const manifest = registerCampaign(campaignDir);
  const text = readFileSync(path.join(campaignDir, manifest.proposal), "utf8");
  return {
    product: PRODUCT_NAME,
    campaign: manifest.campaign,
    terms: termsFromProposal(text),
  };
}

export function compileCampaign(campaignDir: string): CompiledSchema {
  const manifest = loadManifest(campaignDir);
  const schema = compiledFromProposal(campaignDir);
  writeFileSync(path.join(campaignDir, manifest.schema), encodeDocument(schema));
  return schema;
}

export function lookupSchema(campaignDir: string): CompiledSchema {
  const manifest = loadManifest(campaignDir);
  const schemaPath = path.join(campaignDir, manifest.schema);
  if (!existsSync(schemaPath)) {
    throw new WorkRegistryError("the schema is missing.");
  }
  return parseDocument(schemaPath) as CompiledSchema;
}

export function checkDrift(campaignDir: string): void {
  const manifest = loadManifest(campaignDir);
  const schemaPath = path.join(campaignDir, manifest.schema);
  const expected = encodeDocument(compiledFromProposal(campaignDir));
  if (!existsSync(schemaPath) || readFileSync(schemaPath, "utf8") !== expected) {
    throw new WorkRegistryError("the schema has drift.");
  }
}

function epochPath(campaignDir: string): string {
  const jsonPath = path.join(campaignDir, "epoch.json");
  const yamlPath = path.join(campaignDir, "epoch.yaml");
  if (existsSync(jsonPath) && existsSync(yamlPath)) {
    throw new WorkRegistryError("the campaign has two documents.");
  }
  if (existsSync(yamlPath)) {
    return yamlPath;
  }
  return jsonPath;
}

export function appendEpoch(
  campaignDir: string,
  input: { subject: "genesis" | "progeny"; id: string; commitSha: string },
): EpochRow {
  const manifest = registerCampaign(campaignDir);
  if (!isCommitSha(input.commitSha)) {
    throw new WorkRegistryError("the epoch is not valid.");
  }
  const filePath = epochPath(campaignDir);
  let rows: Array<EpochRow> = [];
  if (existsSync(filePath)) {
    const parsed = parseDocument(filePath);
    if (!Array.isArray(parsed)) {
      throw new WorkRegistryError("the epoch is not valid.");
    }
    rows = parsed as Array<EpochRow>;
  }
  const row: EpochRow = {
    kind: "epoch",
    campaign: manifest.campaign,
    subject: input.subject,
    id: input.id,
    commitSha: input.commitSha,
  };
  rows.push(row);
  writeFileSync(filePath, encodeDocument(rows));
  return row;
}

export function checkWorkRegistry(root: string): void {
  const base = path.join(root, PRODUCT_NAME);
  if (!existsSync(base) || !statSync(base).isDirectory()) {
    return;
  }
  for (const name of readdirSync(base)) {
    const campaignDir = path.join(base, name);
    if (!statSync(campaignDir).isDirectory()) {
      continue;
    }
    registerCampaign(campaignDir);
    checkDrift(campaignDir);
  }
}
