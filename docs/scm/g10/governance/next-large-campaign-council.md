# Next-large-campaign council (13 isolated)

<!-- Agent: advisory only. Not authorization. Does not invent G11.
Does not flip completed. Does not start implement. -->

- Date: 2026-10-18
- Size: **13** isolated agents; no peer findings
- Baseline: `origin/main` @ `d6ca1aaa9` (auth-freeze landed; Forgejo down)
- Question: Given G0–G10 work accomplished, what is the next **large**
  campaign (multiple long-session slices)?

## Ballot

| ID  | Lens                     | CAMPAIGN                                  | SLICES    | NEW_AUTH | PRI |
| --- | ------------------------ | ----------------------------------------- | --------- | -------- | --- |
| N01 | fabric depth             | Fabric-depth redesign (real manifold I/O) | 6–10      | YES      | 1   |
| N02 | codec losslessness       | NONE (codec later)                        | 0         | YES      | 5   |
| N03 | home-bus / eleventh      | NONE (keep dormant)                       | 0         | YES      | 5   |
| N04 | kuatos / closed-loop     | NONE (later product)                      | 5–8 later | YES      | 5   |
| N05 | g5–g8 entry              | home-bus-fabric (not entry merge)         | 5–8       | YES      | 3   |
| N06 | soft-fallback / sole-I/O | fabric-depth-sole-io                      | 6–10      | YES      | 3   |
| N07 | live-proof shape         | G10 Live Ordered Proof                    | 8         | NO       | 1   |
| N08 | product surfaces         | Client OTEL + multi-surface remote        | 5–8       | YES      | 2   |
| N09 | DoD ladder honesty       | Product Live Validation                   | 2–4       | NO       | 1   |
| N10 | g9→g10 recon deferred    | WORK-000035 Equality-IR                   | 5–8       | YES      | 2   |
| N11 | work registry taxonomy   | WORK-000035 pin completion                | 6         | YES      | 3   |
| N12 | multi-session platform   | NONE (G10 non-goal)                       | 0         | NO       | 5   |
| N13 | steward sequencing       | fabric-depth (after live)                 | 6–10      | YES      | 2   |

## Council sense (ordered)

### 0. Immediate steward gate (existing G10 auth — not a new numbered gate)

**Product Live Validation / Live Ordered Proof** (N07, N09; N13 sequencing).

- Multi-session _ops_ under `ops/live-cutover-runbook.md`
- `NEW_AUTH: NO`; do **not** mint G11
- Flip `manifest.completed: true` only after steward-accepted live evidence

Whether this is labeled “campaign” or “ops package,” it is the **first**
multi-long-session body of work. It does not unlock fenced fabric.

### 1. Next large **new-auth** campaign (strongest cluster)

**Fabric-depth redesign** — real manifold I/O + soft-fallback retirement /
sole inverted path (N01, N06, N13; N05 adjacent as home-bus-fabric depth).

- Est. **6–10** long slices
- Requires **new design + human authorization**
- Explicitly **not** Increment 6 bridge cutover; not inventing “G11” as
  DoD ladder number — use a **named charter**
- Prereq: live package honesty (`completed` or steward-accepted live
  evidence) before implement

### 2. Strong runner-up (new auth; often after or parallel-charter)

**WORK-000035 Equality / IR pin completion** (N10, N11).

- Est. **5–8** slices (six deferred G2 pin gaps)
- Retires `G9DeferredEquality` stand-in; **prereq to later codec**
- N02: codec proper stays **later** (PRIORITY 5 / NONE as _next_)

### 3. Alternative non-SCM large (new auth)

**Client OTEL + multi-surface remote readiness** (N08).

- Est. **5–8** slices across web / desktop / mobile + connection modes
- Leaves SCM fabric fences untouched
- Steward choice if product-surface debt outranks manifold depth

### Explicitly **not** next large

| Nominee                             | Why not next                             |
| ----------------------------------- | ---------------------------------------- |
| Codec / nibble / dictionary         | Fenced; needs Equality-IR first (N02)    |
| Home-bus / eleventh / OQ7           | Keep dormant; radius law (N03, N12)      |
| Kuatos / freeze-store / closed-loop | Later separate product stack (N04)       |
| G5–G8 `server.ts` entry alone       | Small / wrong-next; not a campaign (N05) |
| Multi-session per-platform cutover  | G10 non-goal; would reopen OQ7 (N12)     |
| Invented numbered G11               | Forbidden by auth-freeze / N09           |

## Steward decision fork (after live)

Pick **one** primary new-auth charter (or sequence):

1. **Fabric-depth** (manifold honesty) — council majority for SCM-next
2. **WORK-000035 Equality-IR** (proof substrate) — recon/registry cluster
3. **Client OTEL / multi-surface** (product parity) — surfaces lens

Do **not** start any of these under current G10 authorization.

## Not changed by this council

- No ceremony, no radius resize, no `completed` flip, no implement.

---

## Steward choice applied — 2026-10-18 (1B / 2A)

Human directed: address council **0** (live) and **1** (fabric-depth) with:

- **2A** — agent-driven live Ordered proof (pairing/browser allowed)
- **1B** — Fabric-depth **charter/design/DRAFT auth only**; no fabric implement
  until a **separate** ceremony

### Applied outcomes

| Item                     | Result                                                         |
| ------------------------ | -------------------------------------------------------------- |
| Live Ordered proof       | **GREEN** — `docs/scm/g10/evidence/live-cutover-2026-10-18.md` |
| G10 `manifest.completed` | **true**                                                       |
| Fabric-depth charter     | Landed under `docs/scm/fabric-depth/` (DRAFT auth not unlock)  |
| Fabric implement         | **blocked** pending ceremony                                   |
| G11 / home-bus / codec   | Still fenced                                                   |

Next for Fabric-depth: human ceremony promoting
`authorization.DRAFT.md` → durable `authorization.md`.
