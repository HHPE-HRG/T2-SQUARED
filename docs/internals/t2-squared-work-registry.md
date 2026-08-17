# T2_Squared-Work-Registry

This is architecture guidance for T2.

The public command is `npm run ci:work-registry`.

STE prose uses the work-registry.

Call the product T2_Squared-Work-Registry.

## Scope

The work-registry holds work on the T2 codebase.

A campaign lives under T2_Squared-Work-Registry.

Each campaign has one proposal.

The proposal is markdown.

Other files use json or yaml.

Json and yaml name one document.

Yaml form is valid for one document.

Do not add a second markdown file.

## Approve

A campaign needs the Forgejo-review.

A campaign also needs a human who can approve.

The human may use the override of the Forgejo-review.

## Records

The genesis names the root of the campaign.

The progeny is extra json.

The epoch appends when the genesis is complete.

The epoch also appends when the progeny is complete.

The schema is a compile of glossary terms in the proposal.

CI fails when the schema has drift.

Lookup reads the schema.

Lookup does not run ASD CI.

The dump flag is `--dump`.

The lookup flag is `--lookup`.

The dump lists the schema path.

The dump lists the approved boolean.

The dump field forgejoClosed is false when the campaign uses the override.

Compile writes yaml when the schema path ends in yaml.

Compile writes json when the schema path ends in json.

The check flag can name one campaign.

## Live campaign

The live campaign is asd-ste100-compliance.

The later campaign is registry-yaml-write.

Both campaigns use the override of the Forgejo-review.

## Later work

Issue 9 rows stay out of git.

This slice does not start CAN campaign work.
