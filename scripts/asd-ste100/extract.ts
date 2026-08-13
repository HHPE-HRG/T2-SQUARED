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
