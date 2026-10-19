# S0 contracts evidence (Ordered proof S0 gate)

<!-- Agent: G10 S0 foundation contracts only. No fabric claim. Inversion not armed. -->

- Date: 2026-10-18
- Gate: G10 Ordered proof **S0 gate** (`docs/scm/g10/proof-bar.md`)
- Runtime modules: `apps/server/src/scm/g10*.ts`
- Auth: `docs/scm/g10/authorization.md` + G8 `g9toG10Authorized: true`
- Verdict: **GREEN** (contracts landed; no S1–S8 fabric cutover)

## 1. Substitution model

Per-slice cutover installs a manifold Layer authority path for that slice’s
activatable inventory `comm_id`s via explicit **admit → route → replace**
(`g10Substitution.ts`).

- Default authority remains **today’s live** until Ordered proof dual-run exit.
- G9 `T2CODE_SCM_G9_SHADOW` observe-beside remains available for non-cut-over
  rows but is **not** the cutover switch (`G9_SHADOW_IS_NOT_CUTOVER_SWITCH`).
- Cutover is not post-success `captureOccurrence`.
- Campaign radius is inventory-authoritative
  (`g10CutoverRegistry.ts` ← `docs/scm/g10/seam-inventory-completeness.json`);
  shrink/expand APIs refuse. Dormant `INV-T2-SCM-HOME-BUS-LINK` exempt.

## 2. Rollback switch contract

- Per-slice: `restorePreCutoverLive` restores pre-cutover **live** authority
  (`g10Rollback.ts`).
- Campaign: `runCampaignRollback` hook shape for S8 full restore.
- Rollback **≠** unset `T2CODE_SCM_G9_SHADOW` (`ROLLBACK_IS_NOT_SHADOW_ENV_OFF`;
  `unsetShadowEnv: true` throws).
- Rollback **adds no** halt controller (`ROLLBACK_ADDS_NO_HALT_CONTROLLER`;
  G7 DIP unchanged; `useHaltController: true` throws).

## 3. Proof harness shape

- Normative Ordered proof steps in `g10ProofHarness.ts` /
  `g10Types.ORDERED_PROOF_STEPS`: land → live-rehearsal → cutover-equivalence →
  rollback-drill → dual-run-exit → arm-inversion.
- Cutover ≡ reuses **`G9DeferredEquality`** labels (type-only carrier over
  `G9EqualityA` projections). Type-name substitution alone is not proof.
- Explicitly **forbids** WP8 **763**-fixture-as-G10-proof
  (`refuse763AsProof` / `FORBIDDEN_763_AS_G10_PROOF`).
- Live-rehearsal / ≡ / rollback-drill evidence name stems frozen per
  `proof-bar.md`.

## 4. Inversion policy (not armed)

- Policy text: `G10_INVERSION_POLICY` in `g10Inversion.ts` — after a slice’s
  Ordered proof dual-run exit, manifold failure may fail the user-visible
  operation for that slice’s cut-over rows; pre-exit and non-cut-over keep G9
  observe-beside noninterference; dormant home-bus exempt.
- **`armedAtS0: false`**. `armInversion(slice)` **refuses** until dual-run-exit
  is recorded on that slice’s Ordered proof prefix.
- S0 does not arm inversion on any slice.

## 5. Bootstrap (no fabric)

- Optional env `T2CODE_SCM_G10_CUTOVER` (default off = today’s live)
  (`g10Bootstrap.ts`). Distinct from G9 shadow env.
- Documents future `server.ts` merge; **does not wire** OrchestrationEngine /
  ws / provider fabric at S0. Present-mode Layer remains empty until fabric
  landers exist.

## 6. Hard locks retained

- No codec / nibble / dictionary / eleventh bus.
- No home-bus-link activation.
- No edits to OrchestrationEngine / ws / provider fabric in S0.
- Auth flags not flipped off.
