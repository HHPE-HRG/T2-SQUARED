# T2 ASD-STE100 mechanical rule-subset

This is architecture guidance for T2.

This document is not a language-authority certificate.

The public command is `npm run ci:asd-ste100`.

Results use the claim "ASD-STE100 mechanical rule-subset result".

## Ownership boundary

Upstream T3 text stays outside the governed set when T2 did not change it.

T2-owned text must match a closed ownership glob.

Unclassified new T2 text fails.

Privileged control files need a distinct reviewer.

## Raw conversation exception

Raw prompts stay byte-identical.

Raw conversation fixtures stay byte-identical.

Files under transcripts stay excluded.

The suite stores origin hashes.

It does not rewrite user language.

## Admission scope

The suite is a Forgejo admission gate.

It is not a local commit typecheck.

Lockfiles, images, binaries, and other machine text stay excluded.

This slice does not start work-registry work.

This slice does not start CAN campaign work.

## Checks

Extraction finds Markdown prose and source strings.

Mechanical Issue 9 checks cover sentence length and paragraph length.

Live checks cover vocabulary membership and articles before known nouns.

Heuristic checks cover contractions, semicolons, passive constructions, verb forms, and American spelling.

U10 membership and identification checks are in the public suite.

A prohibited language-authority claim fails.

Private vocabulary stays off Git.

## Review and overrides

Author and reviewer must be different Forgejo users.

Human and agent reviewers use the same checks.

An override binds one finding.

It names file, line, rule, content hash, and repair hashes.

A new head commit invalidates the override.

## Modes

PR mode checks the T2 delta.

Main mode scans the owned corpus.

Release mode needs a current main baseline.

Release mode needs a rule-subset attestation.

GitHub Actions must stay disabled for connected runs.
