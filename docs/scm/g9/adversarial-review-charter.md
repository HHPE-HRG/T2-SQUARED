# G9 adversarial multi-blind definition review charter

<!-- Agent: seal gate for closed WP1–WP8 definition. Not runtime. Not authorization.md. -->

Status: **active** for definition seal.
Runtime implementation: **not authorized**.

## Purpose

Independent adversarial challenge of the closed G9 definition package. Separate from the constructive Worker / Reviewer / Planner triplet. The Manager that closed definition and answered RFC-001–010 must not be the sole judge of seal.

“Fully defined” requires `adversarial_seal: pass` on `docs/scm/g9/definition-progress.md`.

## Relation to constructive triplet

| Loop                 | Goal                                                                      |
| -------------------- | ------------------------------------------------------------------------- |
| Constructive triplet | Buildability and cohesion of each unit                                    |
| Adversarial panel    | Falsify law, coverage, ownership, live noninterference, Manager self-deal |

This charter does not replace the triplet for future units.

## Hard bounds

- Definition review only. No `apps/server/src/scm/g9*.ts`. No `authorization.md`.
- No flips of `implementation_authorized`, `g9toG10Authorized`, or later-gate booleans.
- Restricted HHPE stays in `/Users/maxholden/T2-SQUARED-References`.
- Design + ledger beat plans; plans beat Manager narration when hashes conflict.
- Manager answers Escalate RFCs same-turn; cannot mark seal Pass while Critical findings remain.
- Adversaries never edit files and never see peer findings before Manager synthesis.

## Panel

| ID  | Persona               |
| --- | --------------------- |
| A1  | Exact-set / ledger    |
| A2  | Authorization / gate  |
| A3  | Live noninterference  |
| A4  | Capture / payload     |
| A5  | Serial file ownership |
| A6  | Manager self-deal     |

## Blindness

1. Manager freezes subject paths + sha256 in `adversarial-freeze-manifest.md`.
2. All six adversaries dispatch in one parallel wave with identical freeze + persona-only prompt.
3. No adversary receives another’s name, prompt, or findings.
4. Do not resume constructive Reviewer/Planner agents into adversarial seats.

## Verdict contract

```text
VERDICT: Pass | Fail | Escalate
CRITICAL:
IMPORTANT:
NIT:
ATTACK_ATTEMPTED:
EVIDENCE:
```

- Pass: no Critical; Important are optional notes.
- Fail: Critical or blocking Important (law/ownership/coverage break).
- Escalate: single undecidable question → Manager RFC same-turn.

## Seal gate

- **SEAL_PASS**: all six final Pass; no open seal-blocking RFCs. RFC-002 may stay `answered` (regen pending) only if A1 and A2 Pass with that residual explicitly non-blocking.
- **SEAL_FAIL**: any persona still Fail after one repair + re-blind cycle.

### Post-seal status updates (RFC-021)

After final Pass, Manager may update **status-only** subjects without re-blind:

- `docs/scm/g9/definition-progress.md`
- `docs/scm/g9/adversarial-findings.md`

Law subjects (design, ledger, plans, cohesion, catalog, generator, etc.) remain frozen. Record the post-synthesis sha256 of status files in a **post-seal archive** on the freeze manifest or findings. Future freezes **exclude** `definition-progress.md` from subject hashes (status artifact, not law). Wave-6 freeze-time hash of `definition-progress.md` was pre-seal; mismatch after recording SEAL_PASS does not invalidate panel verdicts.

## Artifacts

- `docs/scm/g9/adversarial-freeze-manifest.md`
- `docs/scm/g9/adversarial-findings.md`
- `docs/scm/g9/prompts/adversary-*.md`
- `docs/scm/g9/prompts/adversarial-manager-checklist.md`
