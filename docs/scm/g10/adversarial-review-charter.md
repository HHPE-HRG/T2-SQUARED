# G10 adversarial multi-blind definition review charter

<!-- Agent: seal gate for hardened G10 definition. Not runtime. Not authorization.md. -->

Status: **active** for pre-auth hardening seal.
Runtime implementation: **not authorized**.

## Purpose

Independent adversarial challenge of the G10 Increment 6 definition after
constructive hardening (seam inventory, S0–S8 definition DoD, proof bar).
Separate from the constructive Manager/Workers that authored the package.

Hardened definition requires `adversarial_seal: pass` on
`docs/scm/g10/definition-progress.md` before a human may run the runtime
auth ceremony.

## Relation to constructive work

| Loop               | Goal                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| Constructive H1–H3 | Seam inventory, DoD close, proof-bar                                 |
| Adversarial panel  | Falsify coverage, auth locks, cutover≠capture, DoD, ownership, proof |

## Hard bounds

- Definition review only. No `apps/server/src/scm/g10*`. No `authorization.md`.
- No flip of `g9toG10Authorized` or inventing `implementation_authorized`.
- Restricted HHPE stays in `/Users/maxholden/T2-SQUARED-References`.
- Design + ledger + seam inventory beat plans when hashes conflict.
- Manager synthesizes findings but must not sit as an adversary.
- Adversaries never edit files and never see peer findings before synthesis.
- Cap: one repair + re-blind cycle; second Fail ⇒ `SEAL_FAIL`.

## Panel

| ID  | Persona                    | Attack focus                                              |
| --- | -------------------------- | --------------------------------------------------------- |
| A1  | Exact-set / seam inventory | Orphans, double-owns, phase drops vs 74 ledger            |
| A2  | Authorization / gate       | Premature unlock, G9-auth-as-G10, missing ceremony locks  |
| A3  | Cutover vs capture         | Capture treated as cutover; noninterference inversion gap |
| A4  | S0–S8 DoD completeness     | Unchecked/vague definition DoD; S7 catch-all abuse        |
| A5  | Serial file ownership      | Hotspot collisions across slices                          |
| A6  | Proof-bar / false friends  | 763-as-G10; equality drift; rollback = shadow env-off     |

## Blindness

1. Manager freezes subject paths + sha256 in `adversarial-freeze-manifest.md`.
2. All six adversaries dispatch in one parallel wave with identical freeze +
   persona-only prompt.
3. No adversary receives another’s name, prompt, or findings.
4. Do not resume constructive Workers into adversarial seats.

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

- **SEAL_PASS**: all six final Pass; no open seal-blocking RFCs.
- **SEAL_FAIL**: any persona still Fail after one repair + re-blind cycle.

### Post-seal status updates

After final Pass, Manager may update **status-only** subjects without re-blind:

- `docs/scm/g10/definition-progress.md`
- `docs/scm/g10/adversarial-findings.md`
- `docs/scm/g10/manifest.json` (status fields only; `authorized` stays false)

Law subjects (design, plan, decisions, inventory, proof-bar) remain frozen.

## Artifacts

- `docs/scm/g10/adversarial-freeze-manifest.md`
- `docs/scm/g10/adversarial-findings.md`
- `docs/scm/g10/seam-inventory-completeness.md`
- `docs/scm/g10/seam-inventory-completeness.json`
- `docs/scm/g10/proof-bar.md`
