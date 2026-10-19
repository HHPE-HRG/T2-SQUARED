# HHPE-Forge development handoff

Pickup for the next agent. Rewritten 2026-10-17 from the single Mac checkout. Not G9–G10 authorization. Not human A7 attestation.

## Why this exists

SCM gates G1–G8 and the T2 OpenTelemetry plane live in one Mac checkout. An older worktree at `/Users/maxholden/T2-SQUARED-forgejo` checked out Forgejo `main`. That commit is an ancestor of this branch. It held no unique commits. The worktree is retired so a second folder cannot be treated as a second implementation.

Restricted source packs stay on the Mac, outside git.

## Current git state (Mac, 2026-10-17)

```text
host: Mac
checkout: /Users/maxholden/T2-SQUARED
branch: feat/t2-opentelemetry
HEAD: 0e8d003e7798fd9c246d1e32c5996bd17d33fc53
subject: docs(scm): package G8 clocks without unlocking G9-G10
origin: https://github.com/HHPE-HRG/T2-SQUARED.git
forgejo: ssh://git@hhpe-forge.local:2222/maxholden/T2-SQUARED.git
forgejo main: 6486a0f8a5a7703b3e7455d6d2f92d5d301cc1c9
merge-base(forgejo main, HEAD): 6486a0f8a5a7703b3e7455d6d2f92d5d301cc1c9
forgejo/feat/t2-opentelemetry: d992dfb403f6f04db889c77b95e52f39b7a1fd22
```

Forgejo `main` is a strict ancestor of `HEAD`. Commits on `HEAD` that `forgejo/feat/t2-opentelemetry` does not have yet:

1. `9328eee88` — name G8 fundamental-clock producer
2. `7dd10e134` — G8 state_age and request_age table
3. `2ad1ae0e8` — observe G8 clock advance and skip frozen buses
4. `0e8d003e7` — package G8 clocks without unlocking G9–G10

Do not push to `forgejo` or `origin` unless the human asks. Do not reimplement G8 because those four commits are still local.

## One checkout

```text
Mac implementation: /Users/maxholden/T2-SQUARED
Retired worktree: /Users/maxholden/T2-SQUARED-forgejo (removed; branch main-final remains in the shared repo)
References (not git): /Users/maxholden/T2-SQUARED-References
```

Do not add another Mac worktree to “match Forgejo main”. Open the workspace on `/Users/maxholden/T2-SQUARED`.

`hhpe-forge` (`agent`, intended guest path `/home/agent/work/T2-SQUARED`) is a separate host. Reach it with `ssh orchestration-vm`. A guest clone, when a human asks for one, tracks this branch. It does not become a third source tree. Leave `/home/agent/work/T2-SQUARED.retired-corrupt-20260823` in place.

## Restricted references (must not move)

Canonical drop on the Mac only:

```text
/Users/maxholden/T2-SQUARED-References
```

Contains Issue 9 / lexicon-private / human-signoff. Not git.

Do not:

- copy Issue 9 or HHPE pack prose into the T2-SQUARED git tree
- upload that folder to `/home/agent`
- use `OrchestrationVM/T2-SQUARED-References` or any SMB share as the working copy
- mount the raw extraction onto `t2-trusted`

## Gate status (do not regress)

```text
G0: packaged — T2 observability plane (apps/server/src/t2Observability)
G1: packaged — inventory / completeness
G2: packaged — WORK-000035 disposition
G3: packaged — node/bus overlay
G4: packaged — W1 type law
G5: packaged — in-process open-loop
G6: packaged — DIP mute (human 2026-09-11). In-process. Not the server entry path.
G7: packaged — DIP freeze/halt (human 2026-09-20). In-process. Not the server entry path.
G8: packaged — clocks/framing (human 2026-09-20). In-process. Not the server entry path.
G9: authorized — Mode B shadow-parity (`docs/scm/g9/authorization.md`)
G10: authorized 2026-10-18 — Increment 6 cutover/rollback runtime
     (`docs/scm/g10/authorization.md` + G8 `g9toG10Authorized: true`)
```

Authorization for a packaged gate lives in that gate’s `docs/scm/gN/authorization.md`. Earlier later-gate booleans stay false except G8’s G10 unlock:

```text
G1B: g3Authorized=false g4toG7Authorized=false
G3: g4toG7Authorized=false
G4 and G5: g6toG10Authorized=false
G6: g7toG10Authorized=false
G7: g8toG10Authorized=false
G8: g9toG10Authorized=true (ceremony 2026-10-18; G9 auth did not unlock)
```

Read those values from the manifests. Do not copy a hash out of this file over a manifest. G6–G8 code is imported only inside `apps/server/src/scm/`. `apps/server/src/server.ts` provides `ObservabilityLive` and `T2ObservabilityLive`. It does not import the gate modules.

## Uncommitted work that stays in this checkout

Do not revert, stage, or treat this as G9 authorization:

```text
modified: docs/scm/g1a/*, docs/scm/g1b/coverage.json, docs/scm/g1b/inventory.json, docs/scm/g3/README.md, docs/scm/g3/manifest.json
```

The G3 manifest note records a G1B steward amendment for `INV-T2-PROJECT-QUEUE` and `INV-T2-FLAG-TERM-ENV`. It says the hash change is not a new independent review and does not authorize G4–G7. `g4toG7Authorized` stays false.

Untracked, and not an authorization to implement:

```text
docs/scm/g9/
docs/superpowers/plans/2026-09-30-scm-g9-foundation-orch-queue-plan.md
docs/superpowers/specs/2026-09-26-scm-g9-row-ledger.md
docs/superpowers/specs/2026-09-26-scm-g9-shadow-parity-design.md
docs/plans/2026-08-31-001-hhpe-forge-dev-bridge.md
```

## Behavior check already run on this checkout

2026-10-17, from `apps/server`:

```text
vp test run g1a g1b g2 g3 g4 g5 g6 g6HomeBusLink g7 g8 T2Observability
11 files, 169 passed
```

Imports of `g5OpenLoop`, `g6DipMute`, `g7HaltFreeze`, and `g8SharedClock` outside `apps/server/src/scm/` : none.

`vp lint` loaded `vite.config.ts` with `typeAware: true` and `typeCheck: true` for `apps/server/src/server.ts` and `apps/server/src/terminal/Manager.ts` and exited 0. Those two options stay on. The catalog-bridge wrappers around existing server effects were left in place. They run the same effect and record span failure. They do not replace `ObservabilityLive`.

## Barriers that stay closed

```text
codec / nibble alphabet / global dictionary / production encoding
live fabric / public canBus rename
G9 semantic parity / shadow fabric claim
G10 live cutover
human A7 attestation
every later-gate boolean listed above
```

G5–G8 in-process modules are packaged prototypes. They are not the live server bus.

Authoritative checks are local `vp test run …` on the files under change. Do not wait on GitHub Actions. Do not push from this handoff.
