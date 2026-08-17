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

The work-registry lives in Git.

See `docs/internals/t2-squared-work-registry.md`.

This slice does not start CAN campaign work.

## Checks

Extraction finds Markdown prose and source strings.

Extraction also finds comments and JSON descriptive fields.

Mechanical Issue 9 checks cover sentence length and paragraph length.

Live checks cover vocabulary membership and articles before known nouns.

Heuristic checks cover contractions, semicolons, passive constructions, verb forms, and American spelling.

Heuristic checks also cover question marks and spaced slashes.

Heuristic findings do not fail G2.

Provision mounts the committed fixture.

A pin check can run without flipping review.

A human inspects the private file before any pin change off the fixture.

The live pin is an Issue 9-derived export.

Review stays pending-human until a human inspects that export.

Rule 1.1 and Rule 4.5 fail G2 after that approve.

U10 membership and identification checks are in the public suite.

A prohibited language-authority claim fails.

Private vocabulary stays off Git.

The lexicon bridge writes a private words file.

Git stores the pin.

A git merge is the human gate.

The operator scan writes a private lexicon store.

The dest path must stay off Git.

A jpg sidecar holds scan text.

The private lexicon store lives under T2-SQUARED-References.

Pin apply needs an explicit git-merge flag.

A frozen page splits into line rows.

Product-class forks from the first header.

The leak scan rejects a dump of the private file.

The leak scan does not reject one source token.

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
