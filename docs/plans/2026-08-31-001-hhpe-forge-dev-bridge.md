# HHPE-Forge development bridge

Status: interim. Not G6–G10.

## Goal Capsule

Move T2-SQUARED SCM implementation from the Mac checkout to the `hhpe-forge` isolated `agent` environment, without copying restricted reference packs and without authorizing G6.

## Pickup

Read `docs/operations/hhpe-forge-dev-handoff.md` first.

Mac checkpoint: `feat/t2-opentelemetry` @ `0eaddec54d333a6ac14b057487b3a1166935adb5`. Not on Forgejo until a human pushes `forgejo`. Guest `/home/agent/work/T2-SQUARED` is a placeholder, not a git tree.

## Human gates still required

1. Push `feat/t2-opentelemetry` to Forgejo (not implied by this plan).
2. Clone that branch into `/home/agent/work/T2-SQUARED`.
3. Run the six SCM test files; expect 80 passed at this checkpoint.
4. Separate later authorization for G6/G7.
