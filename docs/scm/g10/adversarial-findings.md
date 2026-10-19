# G10 adversarial findings ledger

<!-- Agent: Manager fills only after blind verdicts return. Not runtime. -->

Status: **SEAL_PASS** (wave-2)
Prior panel: wave-1 / 1b / 1c **SEAL_FAIL** (historical; repair budget exhausted)
Wave-2 repair cycles used: **0**

---

## Historical: Wave-1 → 1c (SEAL_FAIL)

### Wave-1 (claimed; findings artifact not persisted)

| ID  | Persona                    | Verdict | Blocking? |
| --- | -------------------------- | ------- | --------- |
| A1  | Exact-set / seam inventory | Pass    | No        |
| A2  | Authorization / gate       | Pass    | No        |
| A3  | Cutover vs capture         | Fail    | Yes       |
| A4  | S0–S8 DoD completeness     | Fail    | Yes       |
| A5  | Serial file ownership      | Fail    | Yes       |
| A6  | Proof-bar / false friends  | Pass    | No        |

### Wave-1b (re-blind A3 / A4 / A5)

| ID  | Persona                | Verdict | Blocking? |
| --- | ---------------------- | ------- | --------- |
| A3  | Cutover vs capture     | Pass    | No        |
| A4  | S0–S8 DoD completeness | Fail    | Yes       |
| A5  | Serial file ownership  | Pass    | No        |

A4 Critical: S4 HTTP seams omitted; S5 RES-MONITOR omitted; S7 config.ts /
ProviderSessionRuntime omitted. One repair applied; re-froze wave-1c.

### Wave-1c (re-blind A4 only)

| ID  | Persona                | Verdict | Blocking? |
| --- | ---------------------- | ------- | --------- |
| A4  | S0–S8 DoD completeness | Fail    | Yes       |

A4 Critical residual: S4 Rollback still “provider/MCP” only (HTTP omitted).
**SEAL_FAIL** — charter repair budget spent.

---

## R0 constructive residual unit (pre–wave-2)

Docs-only close of wave-1c residuals (new unit, not a second wave-1 repair):

- S4 Rollback names `provider/**`, `McpHttpServer.ts`, `environmentHttp.ts`,
  `http.ts`
- S5 Rollback names `Manager.ts`, `NativeTelemetryClient.ts`,
  `DesktopTelemetryReceiver.ts`
- S7 Seams name every sole-lander hotspot file (Projection\*, NodeSqlite,
  Normalizer, config.ts, ProviderSessionRuntime, UsageService,
  GitVcsDriverCore, FILE-RUNTIME-STATE set, …)

---

## Wave-2 (fresh full panel)

Freeze: `docs/scm/g10/adversarial-freeze-manifest.md` (**wave-2**)

| ID  | Persona                    | Verdict | Blocking? |
| --- | -------------------------- | ------- | --------- |
| A1  | Exact-set / seam inventory | Pass    | No        |
| A2  | Authorization / gate       | Pass    | No        |
| A3  | Cutover vs capture         | Pass    | No        |
| A4  | S0–S8 DoD completeness     | Pass    | No        |
| A5  | Serial file ownership      | Pass    | No        |
| A6  | Proof-bar / false friends  | Pass    | No        |

### A1 Pass

74/74 `comm_id`, 184/184 phases; orphans 0; double-owns 0; MD/JSON/ledger
assignment rules agree.

### A2 Pass

`g9toG10Authorized: false`; `authorization.md` absent; no `g10*` runtime;
ceremony design-only; G9 auth ≠ G10 unlock.

### A3 Pass

Cutover ≠ captureOccurrence; inversion present S0–S7. Non-blocking Important:
S2 “success boundaries” vocab residual.

### A4 Pass

R0 S4/S5 Rollback and S7 named Seams verified closed. Non-blocking Important:
S6 Seams omit explicit `cli/config.ts` for FLAG-T3-OTEL (cohesion has handoff);
S7 Rollback references Seams by pointer.

### A5 Pass

Nine multi-slice hotspots + `provider/**` each have one sole lander + handoff.
Nits only on restated handoff prose.

### A6 Pass

763 / captureOccurrence / shadow env-off forbidden as G10 proof/rollback.
Non-blocking Important: IR proof-column abbreviation omits `G9DeferredEquality`
label on S2–S7; S6 IR rollback wording residual misread risk.

## Manager synthesis (wave-2)

Full-panel wave-2: all six Pass; no Critical; no seal-blocking Important.
Repair not required. Wave-1 history retained as SEAL_FAIL record.

**SEAL_PASS**

Runtime remains unauthorized. Do not create `authorization.md`. Do not flip
`g9toG10Authorized`.

## Seal

**SEAL_PASS**

`adversarial_seal`: **pass**

Final panel (wave-2): A1 Pass · A2 Pass · A3 Pass · A4 Pass · A5 Pass · A6 Pass
