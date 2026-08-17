export interface ExtractedRecord {
  path: string;
  line: number;
  column: number;
  text: string;
}

function offsetToLineColumn(source: string, offset: number): { line: number; column: number } {
  const before = source.slice(0, offset);
  const lines = before.split("\n");
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

function stripInlineCode(text: string): string {
  return text.replace(/`[^`]*`/g, " ");
}

export function extractMarkdown(filePath: string, source: string): Array<ExtractedRecord> {
  let body = source;
  let bodyOffset = 0;
  if (body.startsWith("---\n") || body.startsWith("---\r\n")) {
    const close = body.indexOf("\n---", 4);
    if (close >= 0) {
      const after = close + 4;
      bodyOffset = after;
      body = source.slice(after);
    }
  }
  const records: Array<ExtractedRecord> = [];
  let i = 0;
  while (i < body.length) {
    if (body.startsWith("```", i)) {
      const end = body.indexOf("```", i + 3);
      i = end < 0 ? body.length : end + 3;
      continue;
    }
    const nextFence = body.indexOf("```", i);
    const chunkEnd = nextFence < 0 ? body.length : nextFence;
    const chunk = body.slice(i, chunkEnd);
    const paragraphs = chunk.split(/\n{2,}/);
    let searchFrom = 0;
    for (const paragraph of paragraphs) {
      const prose = stripInlineCode(paragraph).replace(/\s+/g, " ").trim();
      const idx = chunk.indexOf(paragraph, searchFrom);
      searchFrom = idx < 0 ? searchFrom : idx + paragraph.length;
      if (prose.length > 0) {
        const local = paragraph.search(/\S/);
        const absolute = bodyOffset + i + Math.max(idx, 0) + Math.max(local, 0);
        const { line, column } = offsetToLineColumn(source, absolute);
        records.push({ path: filePath, line, column, text: prose });
      }
    }
    i = chunkEnd;
  }
  return records;
}

export function extractTypeScript(filePath: string, source: string): Array<ExtractedRecord> {
  const records: Array<ExtractedRecord> = [];
  const pattern = /(?<quote>["'])(?<text>(?:\\.|(?!\k<quote>).)*)\k<quote>/g;
  for (const match of source.matchAll(pattern)) {
    const text = match.groups?.text;
    if (text === undefined || match.index === undefined) {
      continue;
    }
    if (!/[a-zA-Z]/.test(text)) {
      continue;
    }
    const { line, column } = offsetToLineColumn(source, match.index + 1);
    records.push({ path: filePath, line, column, text });
  }
  return records;
}

export function extractTypeScriptComments(
  filePath: string,
  source: string,
): Array<ExtractedRecord> {
  const records: Array<ExtractedRecord> = [];
  const block = /\/\*\*?([\s\S]*?)\*\//g;
  for (const match of source.matchAll(block)) {
    const body = match[1]
      ?.replace(/^\s*\*/gm, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (body === undefined || body.length === 0 || match.index === undefined) {
      continue;
    }
    const { line, column } = offsetToLineColumn(source, match.index);
    records.push({ path: filePath, line, column, text: body });
  }
  const lineComment = /(^|[^:])\/\/(.*)$/gm;
  for (const match of source.matchAll(lineComment)) {
    const body = match[2]?.trim();
    if (body === undefined || body.length === 0 || match.index === undefined) {
      continue;
    }
    const { line, column } = offsetToLineColumn(source, match.index);
    records.push({ path: filePath, line, column, text: body });
  }
  return records;
}

const DESCRIPTIVE_KEYS = new Set(["title", "description", "summary", "message", "reason"]);

function walkDescriptive(
  value: unknown,
  filePath: string,
  source: string,
  records: Array<ExtractedRecord>,
): void {
  if (typeof value === "string") {
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      walkDescriptive(entry, filePath, source, records);
    }
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (DESCRIPTIVE_KEYS.has(key) && typeof entry === "string" && /[a-zA-Z]/.test(entry)) {
      const idx = source.indexOf(entry);
      const { line, column } = offsetToLineColumn(source, Math.max(idx, 0));
      records.push({ path: filePath, line, column, text: entry });
    }
    walkDescriptive(entry, filePath, source, records);
  }
}

export function extractJsonYaml(filePath: string, source: string): Array<ExtractedRecord> {
  const records: Array<ExtractedRecord> = [];
  try {
    const parsed: unknown = JSON.parse(source);
    walkDescriptive(parsed, filePath, source, records);
  } catch {
    return records;
  }
  return records;
}
