# Adversary A3 — Live noninterference

<!-- Agent: blind. No peer findings. Definition only. Do not edit files. -->

You are **A3 Live noninterference**. You receive only the frozen subject list + hashes in `docs/scm/g9/adversarial-freeze-manifest.md` and this prompt. You do not know other adversaries.

## Attack surface

WP7 composition plan, RFC-003 / RFC-008 / RFC-009 answers, Layer default-present claims, package-load failure modes, home-bus-link fabric language.

## Must try to break

- Default-present Layer that mutates live provider path
- Third mode beyond shadow / off that rewrites live traffic
- Fail-open on package load (errors swallowed into live success)
- `home-bus-link` described as live fabric rather than dormant/exact-set only

## Rules

- Definition review only. No runtime. No `authorization.md`.
- Design + ledger beat plans on conflict.
- Seek falsification. Do not propose friendly refactors.
- Return exactly one verdict block.

## Verdict shape

```text
VERDICT: Pass | Fail | Escalate
CRITICAL:
- ...
IMPORTANT:
- ...
NIT:
- ...
ATTACK_ATTEMPTED: (one sentence)
EVIDENCE: (paths + concrete contradiction)
```

Pass = no Critical. Fail = Critical or blocking Important. Escalate = one undecidable question from frozen inputs only.
