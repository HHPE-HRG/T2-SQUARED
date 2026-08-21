/**
 * Issue 9 Section 8 counting used by mechanical sentence-length rules.
 * Applies deterministic reductions only. Residual title/proper-noun cases
 * stay under human-review rules 8.x and do not invent ASD authority.
 */

const PAREN_BLOCK = /\([^)]*\)/g;
const QUOTE_BLOCK = /"[^"]*"|'[^']*'|“[^”]*”|‘[^’]*’/g;
const NUMBER_UNIT = /\b\d+(?:[.,]\d+)?(?:\s*[A-Za-zµμ°/%]+)?\b/g;
const ALNUM_ID = /\b[A-Za-z]*\d+[A-Za-z0-9]*\b|\b(?:No|NO)\.?\s*\d+\b/g;
const ABBREV = /\b[A-Z]{2,}(?:\.[A-Z]+)*\.?\b/g;
const HYPHEN_GROUP = /\b[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+\b/g;

function collapseMatches(text: string, pattern: RegExp): string {
  return text.replace(pattern, " __W__ ");
}

/**
 * Count words for Rules 5.1 and 6.3 using Issue 9 Section 8 reductions.
 *
 * Parameters
 * ----------
 * text : string
 *     One sentence or paragraph fragment.
 *
 * Returns
 * -------
 * number
 *     STE word count after parentheses, quotes, units, abbreviations,
 *     alphanumeric identifiers, and hyphenated groups collapse to one word.
 *
 * Example
 * -------
 * >>> steWordCount('The unit weighs 20 kg.')
 * 4
 */
export function steWordCount(text: string): number {
  let normalized = text.trim();
  if (normalized.length === 0) {
    return 0;
  }
  normalized = collapseMatches(normalized, PAREN_BLOCK);
  normalized = collapseMatches(normalized, QUOTE_BLOCK);
  normalized = collapseMatches(normalized, NUMBER_UNIT);
  normalized = collapseMatches(normalized, ALNUM_ID);
  normalized = collapseMatches(normalized, ABBREV);
  normalized = collapseMatches(normalized, HYPHEN_GROUP);
  return normalized
    .split(/\s+/)
    .map((part) => part.replace(/^[^A-Za-z0-9_]+|[^A-Za-z0-9_]+$/g, ""))
    .filter((part) => part.length > 0).length;
}
