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

export interface WorkRecord {
  kind: "work";
  campaign: string;
  id: string;
}

export interface PullRecord {
  kind: "pull";
  campaign: string;
  id: string;
}

export interface EventRecord {
  kind: "event";
  campaign: string;
  workId: string;
  pullId: string;
}

export interface CompiledSchema {
  product: string;
  campaign: string;
  terms: Array<WorkRegistryTerm>;
  work: WorkRecord;
  pull: PullRecord;
  event: EventRecord;
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

interface YamlLine {
  indent: number;
  text: string;
}

function parseScalar(raw: string): unknown {
  if (raw === "" || raw === "null" || raw === "~") {
    return null;
  }
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  if (
    raw.length >= 2 &&
    ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
  ) {
    return raw.slice(1, -1);
  }
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw)) {
    return Number(raw);
  }
  return raw;
}

function yamlLines(source: string): Array<YamlLine> {
  const out: Array<YamlLine> = [];
  for (const raw of source.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }
    out.push({ indent: raw.length - raw.trimStart().length, text: trimmed });
  }
  return out;
}

function parseYamlMap(
  lines: Array<YamlLine>,
  start: number,
  indent: number,
): { value: Record<string, unknown>; next: number } {
  const obj: Record<string, unknown> = {};
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined || line.indent !== indent || line.text.startsWith("- ")) {
      break;
    }
    const colon = line.text.indexOf(":");
    if (colon < 1) {
      throw new WorkRegistryError("the document is not valid.");
    }
    const key = line.text.slice(0, colon).trim();
    const rest = line.text.slice(colon + 1).trim();
    if (rest.length > 0) {
      obj[key] = parseScalar(rest);
      index += 1;
      continue;
    }
    const nested = lines[index + 1];
    if (nested === undefined || nested.indent <= indent) {
      obj[key] = null;
      index += 1;
      continue;
    }
    const child = parseYamlBlock(lines, index + 1, nested.indent);
    obj[key] = child.value;
    index = child.next;
  }
  return { value: obj, next: index };
}

function parseYamlSeq(
  lines: Array<YamlLine>,
  start: number,
  indent: number,
): { value: Array<unknown>; next: number } {
  const items: Array<unknown> = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined || line.indent !== indent || !line.text.startsWith("- ")) {
      break;
    }
    const rest = line.text.slice(2).trim();
    const nested = lines[index + 1];
    if (rest.length === 0) {
      if (nested === undefined || nested.indent <= indent) {
        items.push(null);
        index += 1;
        continue;
      }
      const child = parseYamlBlock(lines, index + 1, nested.indent);
      items.push(child.value);
      index = child.next;
      continue;
    }
    if (rest.includes(":")) {
      const saved = lines[index];
      lines[index] = { indent: indent + 2, text: rest };
      const child = parseYamlMap(lines, index, indent + 2);
      lines[index] = saved;
      items.push(child.value);
      index = child.next;
      continue;
    }
    items.push(parseScalar(rest));
    index += 1;
  }
  return { value: items, next: index };
}

function parseYamlBlock(
  lines: Array<YamlLine>,
  start: number,
  indent: number,
): { value: unknown; next: number } {
  const first = lines[start];
  if (first === undefined || first.indent !== indent) {
    throw new WorkRegistryError("the document is not valid.");
  }
  if (first.text.startsWith("- ")) {
    return parseYamlSeq(lines, start, indent);
  }
  return parseYamlMap(lines, start, indent);
}

/** JSON form or a small YAML subset. One stem still names one document. */
function parseYamlDocument(source: string): unknown {
  const lines = yamlLines(source);
  if (lines.length === 0) {
    throw new WorkRegistryError("the document is not valid.");
  }
  const parsed = parseYamlBlock(lines, 0, lines[0]?.indent ?? 0);
  if (parsed.next !== lines.length) {
    throw new WorkRegistryError("the document is not valid.");
  }
  return parsed.value;
}

function parseDocument(filePath: string): unknown {
  const text = readFileSync(filePath, "utf8");
  if (filePath.endsWith(".json")) {
    return JSON.parse(text);
  }
  try {
    return JSON.parse(text);
  } catch {
    return parseYamlDocument(text);
  }
}

function yamlQuoteNeeded(value: string): boolean {
  if (value === "" || value === "true" || value === "false" || value === "null" || value === "~") {
    return true;
  }
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    return true;
  }
  return /[:#\n\r]|\s/.test(value) || value.startsWith("-");
}

function yamlScalar(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === true) {
    return "true";
  }
  if (value === false) {
    return "false";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string") {
    return yamlQuoteNeeded(value) ? JSON.stringify(value) : value;
  }
  throw new WorkRegistryError("the document is not valid.");
}

function formatYamlField(key: string, nested: unknown, indent: number): string {
  const pad = " ".repeat(indent);
  if (nested !== null && typeof nested === "object") {
    if (Array.isArray(nested) && nested.length === 0) {
      return `${pad}${key}: []`;
    }
    return `${pad}${key}:\n${formatYaml(nested, indent + 2)}`;
  }
  return `${pad}${key}: ${yamlScalar(nested)}`;
}

function formatYaml(value: unknown, indent: number): string {
  if (value === null || typeof value !== "object") {
    return yamlScalar(value);
  }
  const pad = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `${pad}[]`;
    }
    return value
      .map((item) => {
        if (item !== null && typeof item === "object" && !Array.isArray(item)) {
          const entries = Object.entries(item as Record<string, unknown>);
          if (entries.length === 0) {
            return `${pad}- {}`;
          }
          return entries
            .map(([key, nested], index) => {
              const rendered = formatYamlField(key, nested, indent + 2);
              if (index === 0) {
                return `${pad}- ${rendered.trimStart()}`;
              }
              return rendered;
            })
            .join("\n");
        }
        return `${pad}- ${yamlScalar(item)}`;
      })
      .join("\n");
  }
  return Object.entries(value as Record<string, unknown>)
    .map(([key, nested]) => formatYamlField(key, nested, indent))
    .join("\n");
}

function encodeDocument(value: unknown, filePath: string): string {
  if (filePath.toLowerCase().endsWith(".yaml")) {
    return `${formatYaml(value, 0)}\n`;
  }
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

export function campaignIsForgejoClosed(manifest: CampaignManifest): boolean {
  return manifest.forgejoApproved && manifest.humanApproved && !manifest.humanOverride;
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

const PROGENY_IDENTITY = /The progeny (?:is|`is`) `([^`]+)`\./;
const FORGEJO_REVIEW_IDENTITY = /The Forgejo-review (?:is|`is`) `([^`]+)`\./;

export function identityFromProposal(text: string): { workId: string; pullId: string } {
  const progeny = text.match(PROGENY_IDENTITY);
  const review = text.match(FORGEJO_REVIEW_IDENTITY);
  if (progeny === null || progeny[1] === undefined || progeny[1].length === 0) {
    throw new WorkRegistryError("the pull is missing.");
  }
  if (review === null || review[1] === undefined || review[1].length === 0) {
    throw new WorkRegistryError("the pull is missing.");
  }
  return { workId: progeny[1], pullId: review[1] };
}

function compiledFromProposal(campaignDir: string): CompiledSchema {
  const manifest = registerCampaign(campaignDir);
  const text = readFileSync(path.join(campaignDir, manifest.proposal), "utf8");
  const identity = identityFromProposal(text);
  const genesis = validateGenesis(manifest, campaignDir);
  if (manifest.forgejoApproved && genesis.forgejoReviewId !== identity.pullId) {
    throw new WorkRegistryError("the genesis review does not match the pull.");
  }
  return {
    product: PRODUCT_NAME,
    campaign: manifest.campaign,
    terms: termsFromProposal(text),
    work: { kind: "work", campaign: manifest.campaign, id: identity.workId },
    pull: { kind: "pull", campaign: manifest.campaign, id: identity.pullId },
    event: {
      kind: "event",
      campaign: manifest.campaign,
      workId: identity.workId,
      pullId: identity.pullId,
    },
  };
}

export function compileCampaign(campaignDir: string): CompiledSchema {
  const manifest = loadManifest(campaignDir);
  const schema = compiledFromProposal(campaignDir);
  writeFileSync(path.join(campaignDir, manifest.schema), encodeDocument(schema, manifest.schema));
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
  const expected = encodeDocument(compiledFromProposal(campaignDir), schemaPath);
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
  writeFileSync(filePath, encodeDocument(rows, filePath));
  return row;
}

export interface CampaignDump {
  campaign: string;
  schema: string;
  approved: boolean;
  forgejoClosed: boolean;
  forgejoApproved: boolean;
  humanApproved: boolean;
  humanOverride: boolean;
}

export function dumpWorkRegistry(root: string): Array<CampaignDump> {
  const base = path.join(root, PRODUCT_NAME);
  if (!existsSync(base) || !statSync(base).isDirectory()) {
    return [];
  }
  const rows: Array<CampaignDump> = [];
  for (const name of readdirSync(base)) {
    const campaignDir = path.join(base, name);
    if (!statSync(campaignDir).isDirectory()) {
      continue;
    }
    try {
      const manifest = loadManifest(campaignDir);
      rows.push({
        campaign: manifest.campaign,
        schema: manifest.schema,
        approved: campaignIsApproved(manifest),
        forgejoClosed: campaignIsForgejoClosed(manifest),
        forgejoApproved: manifest.forgejoApproved,
        humanApproved: manifest.humanApproved,
        humanOverride: manifest.humanOverride,
      });
    } catch {
      continue;
    }
  }
  return rows.sort((left, right) => left.campaign.localeCompare(right.campaign));
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
