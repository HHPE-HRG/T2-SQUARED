# `T2_Squared-Work-Registry`

The `T2` keep this `guidance`.

The `public` `command` `is` `npm run ci:work-registry`.

`STE` `prose` use the work-registry.

`Call` the `product` `T2_Squared-Work-Registry`.

## `Scope`

The work-registry hold work on the `T2` `codebase`.

A campaign live `under` `T2_Squared-Work-Registry`.

A campaign `has` a proposal.

The proposal `is` `markdown`.

Other `files` use `json` or `yaml`.

`Json` and `yaml` name one `document`.

`Yaml` `form` `is` `valid` for one `document`.

Do not add a `second` `markdown` `file`.

## The approve

A campaign `needs` the Forgejo-review.

A campaign also `needs` a `human` who can approve.

The `human` `may` use the override of the Forgejo-review.

`forgejoApproved` `is` `recorded` `provenance` in the `manifest` and the genesis.

`Git` `merge` `is` the `admission` `authority` for the campaign `content`.

`v1` do not `call` `Forgejo` over the `network` to `re-verify` a `review` `id`.

## `Records`

The genesis name the `root` of the campaign.

The progeny `is` `extra` `json`.

The epoch `appends` when the genesis `is` complete.

The epoch also `appends` when the progeny `is` complete.

The schema `is` a compile of `glossary` `terms` in the proposal.

The compile write `work`, `pull`, and `event` from the proposal.

The `work` record name the genesis and the progeny.

The `pull` record name the Forgejo-review.

The `event` record `appends` from the `work` and the `pull`.

`CI` `fails` when the schema `has` a drift.

The lookup read the schema.

The lookup do not `run` `ASD` `CI`.

The dump `flag` `is` `--dump`.

The lookup `flag` `is` `--lookup`.

The dump `lists` the schema `path`.

The dump `lists` the approved `boolean`.

The dump `field` `forgejoClosed` `is` `true` when the Forgejo and the `human` `both` approve without the override.

The compile write `yaml` when the schema `path` `ends` in `yaml`.

The compile write `json` when the schema `path` `ends` in `json`.

The check `flag` can name a campaign.

The check `fail` when the `product` `root` `has` no `campaign`.

## `Live campaign`

The campaign `is` `asd-ste100-compliance`.

The `later` campaign `is` `registry-yaml-write`.

`registry-yaml-write` keep a live `schema.yaml`.

`Both` live `campaigns` `are` `Forgejo-closed`.

The Forgejo-review `id` `is` `7`.

## `v1` `guarantees`

`v1` keep one `proposal` `markdown` `per` `campaign`.

`v1` keep `structured` `companion` `documents`.

`v1` keep `proposal-derived` `schema` with `drift` `detection`.

`v1` keep the genesis, the progeny, and the epoch `identity`.

`v1` keep `work`, `pull`, and `event` compile.

`v1` keep the Forgejo-review `id` as `provenance`, not a live `remote` `gate`.

## `Not` in `v1`

`v1` do not `migrate` `schemas` across `versions`.

`v1` do not `model` `cross-campaign` `dependencies`.

`v1` do not `index` or `query` `beyond` dump and lookup.

`v1` do not start CAN.

`v1` do not `call` `Forgejo` to `re-check` a `review`.

## `Growth` `seams`

`Later` `versions` `may` add `schema` `migration`.

`Later` `versions` `may` add record and `event` `kinds`.

`Later` `versions` `may` `link` `campaigns`.

`Later` `versions` `may` `enrich` `actor` and `artifact` `provenance`.

`Later` `versions` `may` add `index` or `query` `views`.

`Later` `versions` `may` add optional `remote` `review` `verification`.

`Later` `versions` `may` `harden` `registry-root` `baseline` `authority` `beyond` the `empty-root` `fail-closed` check.

## `Later` work

`Issue 9` `rows` stay out of `git`.

This `slice` `does not start CAN campaign` work.
