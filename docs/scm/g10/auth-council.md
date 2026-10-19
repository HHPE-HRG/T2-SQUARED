# G10 runtime auth council

<!-- Agent: advisory votes only. Does NOT create authorization.md.
Does NOT flip g9toG10Authorized. Not runtime. -->

- Date: 2026-10-18
- Ceremony design: `docs/scm/g10/runtime-auth-ceremony.md`
- Adversarial seal: wave-2 **SEAL_PASS** (`adversarial-findings.md`)
- Council size: **5** isolated parallel agents
- Outcome: **DENY** (3 DENY · 2 AUTH)
- Flags after council: `g9toG10Authorized` still **false**; `authorization.md` still **absent**

## Ballot rule

Each councilor voted independently with no peer findings.
`AUTH` = recommend human execute runtime ceremony for full Increment 6 S0–S8.
`DENY` = do not unlock runtime yet (or do not treat current package as unlock).

This ledger is **not** authorization.

## Votes

| ID  | Lens                         | Vote     | Confidence |
| --- | ---------------------------- | -------- | ---------- |
| C1  | Preconditions auditor        | **AUTH** | high       |
| C2  | Lock integrity               | **DENY** | high       |
| C3  | Blast-radius / campaign risk | **DENY** | high       |
| C4  | Adversarial seal quality     | **AUTH** | high       |
| C5  | False-friend / scope skeptic | **DENY** | high       |

### C1 AUTH — Preconditions

G9 Mode B landed/proven with G9 auth present; G10 definition closed +
wave-2 SEAL_PASS; ceremony design exists; campaign shape is full S0–S8 one
session. Conditions: human still must create `authorization.md` + flip
`g9toG10Authorized` same changeset; no OQ7 shortcut.

### C2 DENY — Lock integrity

Ceremony incomplete (`authorization.md` absent; flag still false). G9 auth /
design-approval must not substitute. Later-gate chain healthy and must stay
locked until same-changeset ceremony executes.

### C3 DENY — Blast radius

Definition seal does not shrink one-session live cutover risk across ~74
`comm_id`s with noninterference inversion. Rollback switches and lander graph
are docs-only; no live dual-run rehearsal between G9 Mode B and Increment 6
fabric. Conditions include explicit human acceptance of max blast radius +
session runbook before fabric land.

### C4 AUTH — Seal quality

Wave-2 full panel Pass, zero repairs; R0 closed wave-1c Criticals. Residual
Importants non-blocking. Seal trustworthy to recommend ceremony; seal does
not itself unlock.

### C5 DENY — False friends

Package bars false friends on paper, but AUTH _now_ would ride
definition-closed / SEAL_PASS / Mode B while ceremony body is absent.
Re-vote only after `authorization.md` binds S0–S8 scope and restates forbids.

## Tally

| Vote | Count          |
| ---- | -------------- |
| AUTH | 2 (C1, C4)     |
| DENY | 3 (C2, C3, C5) |

**Council decision: DENY** — do not create `authorization.md`; do not flip
`g9toG10Authorized`; do not create `apps/server/src/scm/g10*`.

## Semantic note

C1/C4 AUTH = “definition/seal ready for human ceremony.”
C2/C5 DENY = “current artifacts must not act as unlock.”
C3 DENY = “prudence against one-session fabric unlock even if ceremony-ready.”

Majority DENY prevails. Human may still execute ceremony under
`runtime-auth-ceremony.md` if they override the advisory DENY.

## Locks verified at tally

- `docs/scm/g8/manifest.json` → `g9toG10Authorized: false`
- `docs/scm/g10/authorization.md` absent
- No `apps/server/src/scm/g10*`

---

## DENY residual docs unit (D1–D3) — 2026-10-18

Docs-only response to C2/C3/C5. **Prior DENY stands** until human ceremony
or a new council. This unit does **not** unlock runtime.

| Item | Landed                                                                   |
| ---- | ------------------------------------------------------------------------ |
| D1a  | S2 Admit/route/replace: I/O authority replace (not “success boundaries”) |
| D1b  | S6 Seams name `cli/config.ts` FLAG-T3-OTEL handoff to S2                 |
| D1c  | IR proof column uses `G9DeferredEquality`; S6 rollback ≠ shadow/capture  |
| D1d  | S7 Rollback names sole-lander file list                                  |
| D2   | `docs/scm/g10/session-runbook.md` (blast radius + barriers + abort)      |
| D3   | Ceremony pre-checklist + draft auth body template (file still absent)    |

C3 conditions 2–3 (runbook + residual Important closes) are **docs-satisfied**.
C3 still requires human blast-radius acceptance via runbook §1 at ceremony.
C2/C5 remain correct that definition/seal alone is not unlock.

### Locks re-verified after D1–D3

- `docs/scm/g8/manifest.json` → `g9toG10Authorized: false`
- `docs/scm/g10/authorization.md` absent
- No `apps/server/src/scm/g10*`

---

## Council wave-2 (post D1–D3) — 2026-10-18

Five isolated agents; no peer findings. Ballot = recommend human ceremony for
full Increment 6 S0–S8 (not that unlock already happened).

| ID  | Lens                         | Vote     | Confidence |
| --- | ---------------------------- | -------- | ---------- |
| C1  | Preconditions auditor        | **AUTH** | high       |
| C2  | Lock integrity               | **DENY** | high       |
| C3  | Blast-radius / campaign risk | **DENY** | medium     |
| C4  | Adversarial seal quality     | **AUTH** | medium     |
| C5  | False-friend / scope skeptic | **AUTH** | high       |

### Summaries

- **C1 AUTH:** Docs preconditions met; human must still accept runbook §1 and
  execute same-changeset ceremony.
- **C2 DENY:** Recommending AUTH still rides non-unlock artifacts; remain
  DENY until human independently initiates ceremony (or explicit override).
- **C3 DENY:** Runbook/residuals docs-satisfied; one-session ~74 inverted
  cutovers still imprudent without human §1 override.
- **C4 AUTH (medium):** Wave-2 SEAL_PASS + D1 closes enough to recommend;
  medium only because D1 drifted freeze hashes without re-panel.
- **C5 AUTH:** Draft template binds S0–S8 + false-friend forbids; recommend
  ceremony no longer collapses into definition-as-auth.

### Tally

| Vote | Count          |
| ---- | -------------- |
| AUTH | 3 (C1, C4, C5) |
| DENY | 2 (C2, C3)     |

**Council decision: AUTH** (advisory majority) — recommend human execute
`runtime-auth-ceremony.md`. This ledger still does **not** create
`authorization.md` or flip `g9toG10Authorized`.

Minority DENY (C2 process, C3 blast radius) remains on record; human may
accept runbook §1 and override those concerns in the authorizing changeset.

### Locks verified after wave-2 council

- `docs/scm/g8/manifest.json` → `g9toG10Authorized: false`
- `docs/scm/g10/authorization.md` absent
- No `apps/server/src/scm/g10*`

---

## Ordered proof unit — 2026-10-18

Docs-only response to C3 “first live cutover = first proof for whole
campaign.” Binds **Ordered proof (in-session)** so dual-run exit and
noninterference inversion cannot arm until S0 green and per-slice ≡ +
rollback drill are green (`proof-bar.md`, `session-runbook.md` §2,
`decisions.md`, plan S0–S8 DoD).

- Still one session / full Increment 6; **not** OQ7.
- Does **not** shrink total blast radius after all slices complete; sequences
  **when** inversion arms.
- Prior wave-2 council **AUTH** majority unchanged (advisory).
- Ceremony / `authorization.md` / `g9toG10Authorized` **not** executed.

### Locks re-verified after Ordered proof unit

- `docs/scm/g8/manifest.json` → `g9toG10Authorized: false`
- `docs/scm/g10/authorization.md` absent
- No `apps/server/src/scm/g10*`

---

## Council wave-3 (give-auth decision) — 2026-10-18

Ballot reframed: auth has **not** been given. Absent `authorization.md` /
false `g9toG10Authorized` are **expected** and **not** DENY reasons.
Agents advise whether the human **should give** auth now.

| ID  | Lens                               | Vote     | Confidence |
| --- | ---------------------------------- | -------- | ---------- |
| C1  | Preconditions / readiness          | **AUTH** | high       |
| C2  | Process fitness (ceremony vehicle) | **AUTH** | high       |
| C3  | Blast-radius prudence              | **DENY** | medium     |
| C4  | Seal / definition quality          | **AUTH** | medium     |
| C5  | False-friend / scope               | **AUTH** | high       |

### Summaries

- **C1 AUTH:** Docs ready to receive auth; recommend ceremony for full S0–S8.
- **C2 AUTH:** Ceremony checklist/template/same-changeset design fit to bind
  unlock if human executes (no longer circular DENY on absent auth file).
- **C3 DENY:** Ordered proof helps timing; end-state ~74 inverted cutovers
  and no live rehearsal still too much to recommend unlock.
- **C4 AUTH (medium):** Seal + Ordered proof quality warrants permission;
  medium for post-freeze hash drift without re-panel.
- **C5 AUTH:** Template + decisions + runbook bind false friends/scope well
  enough to recommend give auth.

### Tally

| Vote | Count              |
| ---- | ------------------ |
| AUTH | 4 (C1, C2, C4, C5) |
| DENY | 1 (C3)             |

**Council decision: AUTH** — recommend human **give** runtime auth via
`runtime-auth-ceremony.md` (create `authorization.md` + flip
`g9toG10Authorized` same changeset; accept runbook §1).

This ledger does **not** execute the ceremony. Minority C3 prudence DENY
remains on record.

### Locks verified after wave-3 (still pre-ceremony)

- `docs/scm/g8/manifest.json` → `g9toG10Authorized: false`
- `docs/scm/g10/authorization.md` absent
- No `apps/server/src/scm/g10*`

---

## Campaign radius + live rehearsal unit — 2026-10-18

Docs-only response to C3 remaining prudence gap (**live rehearsal**) without
resizing campaign radius.

- **Campaign radius** defined/frozen as the inventory-authoritative
  activatable `comm_id` set (`session-runbook.md` §1; `decisions.md`).
  Neither shrink (OQ7 / multi-session) nor expand (codec / eleventh bus /
  home-bus activation).
- **Live-authoritative rehearsal** bound in Ordered proof between land and
  ≡ (`proof-bar.md`; evidence name `S<n>-live-rehearsal.md`). Rehearsal is
  not exit and not inversion armed.
- Addresses C3 rehearsal gap while keeping full Increment 6 / S0–S8 end-state;
  locks unchanged; ceremony **not** executed.

### Locks re-verified after radius + rehearsal unit

- `docs/scm/g8/manifest.json` → `g9toG10Authorized: false`
- `docs/scm/g10/authorization.md` absent
- No `apps/server/src/scm/g10*`

---

## Council wave-4 (blast radius only) — 2026-10-18

Targeted panel: **five** isolated agents; lenses are blast-radius facets
only (definition freeze, live rehearsal bridge, end-state magnitude,
ordered sequencing, acceptance fitness). No peer findings.

Ballot (wave-3 style): auth has **not** been given. Absent
`authorization.md` / false `g9toG10Authorized` are **expected** and **not**
DENY reasons. Advise whether the human **should give** auth now on
**blast-radius grounds** after the Campaign radius + live rehearsal unit.

| ID  | Lens                                | Vote     | Confidence |
| --- | ----------------------------------- | -------- | ---------- |
| B1  | Radius definition / freeze          | **AUTH** | high       |
| B2  | Live rehearsal bridge               | **AUTH** | medium     |
| B3  | End-state magnitude                 | **DENY** | medium     |
| B4  | Ordered sequencing vs residual risk | **AUTH** | high       |
| B5  | Acceptance fitness                  | **AUTH** | high       |

### Summaries

- **B1 AUTH:** Radius frozen inventory-authoritative (73 activatable + 1
  dormant of 74); resize paths closed; proof/rehearsal order risk only.
- **B2 AUTH (medium):** Mandatory live-authoritative rehearsal gate closes
  prior “no live rehearsal” bridge gap; evidence bodies after auth are
  expected. Condition: human §1 acceptance + prefer abort pre-exit if
  rehearsal fails.
- **B3 DENY (medium):** Freeze/rehearsal do not shrink inverted end-state;
  one-session ~73 activatable inverted cutovers still too large to
  recommend unlock. AUTH only if that maximal magnitude is explicitly
  accepted as intentional at ceremony.
- **B4 AUTH:** Per-slice land→rehearsal→≡→restore→exit→inversion orders when
  risk arms; first exit does not invert the full campaign; abort prefers
  pre-exit.
- **B5 AUTH:** Runbook §1 + ceremony checklist/template bind signing to
  accept the defined frozen radius (not a resize negotiation).

### Tally

| Vote | Count              |
| ---- | ------------------ |
| AUTH | 4 (B1, B2, B4, B5) |
| DENY | 1 (B3)             |

**Council decision: AUTH** (blast-radius panel) — recommend human **give**
runtime auth via `runtime-auth-ceremony.md`, accepting runbook §1 defined
radius. Minority B3: end-state magnitude prudence DENY remains on record.

This ledger does **not** execute the ceremony.

### Locks verified after wave-4 (still pre-ceremony)

- `docs/scm/g8/manifest.json` → `g9toG10Authorized: false`
- `docs/scm/g10/authorization.md` absent
- No `apps/server/src/scm/g10*`

---

## Ceremony executed — 2026-10-18

Human **Max Holden** accepted end-state magnitude / defined campaign radius
(runbook §1), including override of minority wave-4 B3 DENY, and executed
`runtime-auth-ceremony.md`:

- Created `docs/scm/g10/authorization.md`
- Flipped `docs/scm/g8/manifest.json` → `g9toG10Authorized: true` in the
  same authorizing change set

Prior council tallies remain advisory history. This section records unlock;
it is not a substitute for `authorization.md`.
