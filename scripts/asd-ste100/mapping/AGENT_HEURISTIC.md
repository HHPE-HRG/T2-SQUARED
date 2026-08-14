# Mapping agent heuristic card

This card is the only committed mapping instruction. Map from the page images in front of you (KTD31). Do not recall a specification from training.

## Source

- Use the supplied consecutive page chunk only.
- Chunk size must be 10 to 40 pages. Default size is 20 pages.

## Extract

Extract instruction, rule, schema, and specification identifiers only.
Do not copy prose, dictionary rows, example sentences, or definitions into git records.

## Classify

For each identifier, set class to exactly one of:

- `deterministic`
- `fail_closed_uncheckable`
- `private_lexicon`

## Git records

A git mapping row may contain:

- identifier
- class
- source page numbers
- proposed checker id
- empty review fields

Do not quote dictionary rows.
Do not quote examples.
Do not quote definitions.

Leave `reviewed` false. Leave `reviewerId` and `reviewNotes` empty until KTD28.

## Forbidden

Official dictionary words used as examples are forbidden.
Copied specification examples are forbidden.
