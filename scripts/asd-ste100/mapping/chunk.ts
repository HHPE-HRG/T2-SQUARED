export const MIN_CHUNK_PAGES = 10;
export const MAX_CHUNK_PAGES = 40;
export const DEFAULT_CHUNK_PAGES = 20;

export interface ManifestPage {
  page: number;
  path?: string;
}

export interface PageChunk {
  startPage: number;
  endPage: number;
  pageCount: number;
  pages: Array<ManifestPage>;
}

export function validateChunkSize(pageCount: number): number {
  if (pageCount < MIN_CHUNK_PAGES || pageCount > MAX_CHUNK_PAGES) {
    throw new Error(
      `chunk size must be between ${MIN_CHUNK_PAGES} and ${MAX_CHUNK_PAGES} pages (got ${pageCount})`,
    );
  }
  return pageCount;
}

export function buildChunkFromRange(
  startPage: number,
  pageCount: number = DEFAULT_CHUNK_PAGES,
): PageChunk {
  validateChunkSize(pageCount);
  const endPage = startPage + pageCount - 1;
  const pages: Array<ManifestPage> = Array.from({ length: pageCount }, (_, offset) => ({
    page: startPage + offset,
  }));
  return { startPage, endPage, pageCount, pages };
}

export function buildChunkFromManifest(
  manifest: ReadonlyArray<ManifestPage>,
  startPage: number,
  pageCount: number = DEFAULT_CHUNK_PAGES,
): PageChunk {
  validateChunkSize(pageCount);
  const endPage = startPage + pageCount - 1;
  const byPage = new Map(manifest.map((entry) => [entry.page, entry]));
  const pages: Array<ManifestPage> = [];
  for (let page = startPage; page <= endPage; page += 1) {
    const entry = byPage.get(page);
    if (entry === undefined) {
      throw new Error(`requested page range ${startPage}-${endPage} is missing from the manifest`);
    }
    pages.push(entry);
  }
  return { startPage, endPage, pageCount, pages };
}
