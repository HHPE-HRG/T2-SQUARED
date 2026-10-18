# G9 adversarial freeze manifest

<!-- Agent: only shared input for A1–A6. Do not mutate subject paths after freeze without re-blind. -->

freeze_timestamp: `2026-10-18T16:22:39Z`
freeze_wave: `8c` (A5 Important residual — integration-readiness WP5 surfaces; foundation auth blocker prose)
prior_freeze: `2026-10-18T16:12:15Z` (wave 8b)
algorithm: `sha256`
subject_count: 20

## Subject hashes

| sha256                                                             | path                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `7e4fcc881fbfd167551457a1de805480e838af57bac043f04ef21e872ffcb2b7` | `docs/superpowers/specs/2026-09-26-scm-g9-shadow-parity-design.md`       |
| `c044ccce768c4dc02358530970f0cbc0288a1e08df1cc1b2f4cfd25235c14e5d` | `docs/scm/g9/coverage-ledger.json`                                       |
| `4ddade7e417bbc4f3790bbf9ea9fc9214530a8a378aecf2c5dfa2ec02472eab3` | `docs/scm/g9/coverage-validation.json`                                   |
| `bd6c9b37e7be0c038cf68354b02c7f745c58a73558d8ac19768d1ee9f1d28bf5` | `docs/scm/g9/coverage-changelog.md`                                      |
| `9a3da86265356322d6ec322433c8f80f6308a006bb7bea701304b04fa17367c4` | `docs/scm/g9/regen_coverage_ledger.py`                                   |
| `193704ad19e3afc60ed44330601318ec4a4f3119b5ec8a55eae7ad7661db112f` | `docs/scm/g9/phase_source_audits.py`                                     |
| `69e2bbc0e1d881cfa036cbd80ea069d6ffcdb239dfbc87e329f16c67fb077f8c` | `docs/scm/g9/manager-charter.md`                                         |
| `c519185459b6229761ff7429756cf15aa3500f3e8e5564b8790c3202c888147c` | `docs/scm/g9/planning-scope.md`                                          |
| `d0e90546345606b99883bcb20754a7b2dc548d2e0920281d818830084a6b4e09` | `docs/scm/g9/cross-wp-cohesion-index.md`                                 |
| `70f2dd76d0da860d56d09332eb2dee7d9214d9402bd7baea026986185f60aa3c` | `docs/scm/g9/rfc-queue.md`                                               |
| `99b6b8b58a3e05a0ecb8f923591985b9125dae0a1bf07a753401c080a82d9b36` | `docs/superpowers/plans/2026-09-30-scm-g9-foundation-orch-queue-plan.md` |
| `a19707e96aa0a20d19ab3baa557ccefda7cf02599d8e30a5a838c07d2cbc8eee` | `docs/scm/g9/wp1-wp4-foundation-cohesion.md`                             |
| `d8b107327b6c55ab1d3f36555c2c38c9c6ff17a6dc4758105353d5ea911755e0` | `docs/superpowers/plans/2026-10-17-scm-g9-wp5-family-bundles-plan.md`    |
| `e7eb08169ae0fbb45716a9c24bfd8378fb542df751d3fca35b65195249b39b2a` | `docs/superpowers/plans/2026-10-17-scm-g9-wp6-typed-hooks-plan.md`       |
| `0b94a909b61cf0fa3081f0b9df078e746721ae30ac921a38e14f7e42eb7cabc5` | `docs/superpowers/plans/2026-10-17-scm-g9-wp7-composition-plan.md`       |
| `0e6163a6adb521020f9dce1b8f27328bd847f55784b260d03dc55ef1e988c417` | `docs/superpowers/plans/2026-10-17-scm-g9-wp8-exact-set-proof-plan.md`   |
| `67cea7159c2721c7fcfa7b558f8badcf2d6060356056543cdccab0fd8d33f560` | `docs/scm/g9/wp5/bundle-index.md`                                        |
| `096179908d489a8d77510d7fed37e2755493602361bdcbb31879658d381013f8` | `docs/scm/g9/integration-readiness.md`                                   |
| `1b7c30f94af77c5ce72771257d8db2c1f9f80907c98621c1c08a242cb6f52f52` | `docs/scm/g9/observation-catalog.json`                                   |
| `7001f36daf75da36b101bcbd2605b24876a90ebc5c4da50410e79c0756a4b313` | `docs/scm/g9/adversarial-review-charter.md`                              |

## Adversary input contract

Each adversary may read only:

1. This freeze manifest (verify hashes match on-disk before reviewing).
2. Their single persona prompt under `docs/scm/g9/prompts/adversary-*.md`.
3. The frozen subject files listed above.

Do not read other adversary prompts, peer findings, or `adversarial-findings.md` before returning a verdict.
Do not edit any file. Return exactly one verdict block.

## Re-blind scope (wave 8c)

Re-dispatched: **A5** only. A1–A4/A6 stand (wave 8 / 8b Pass).
Residual close: WP5 primary surfaces in `integration-readiness.md` no longer list `OrchestrationEngine.ts` as a WP5 lander (Slice-Foundation-Owner only; RFC-023). Foundation remaining blockers cite validated `authorization.md` + regen true.

**Must specifically try to falsify:**

1. Integration-readiness or plans still authorize B1 dual-landing on `OrchestrationEngine.ts`.
2. Empty family stubs still authorized for WP7.
3. Any other cohesion §2 sole-owner dual-lander on named hotspots.

## Post-seal archive (status-only)

| sha256 (post status updates)                                       | path                                  | note                         |
| ------------------------------------------------------------------ | ------------------------------------- | ---------------------------- |
| `e5d2083d92c4b2e0534447e07004e9078f8461ef79a29b0524a30ddf2dda39c9` | `docs/scm/g9/definition-progress.md`  | SEAL_PASS wave 8c            |
| `972fd9a8aece508be5632fffd449184a0c85752a1fe399ee12c4e20bad189315` | `docs/scm/g9/adversarial-findings.md` | A5 Important residual closed |
