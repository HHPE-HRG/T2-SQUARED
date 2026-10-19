# G10 binding decisions (human, 2026-10-18)

<!-- Agent: settled product law for Increment 6 definition. Not runtime auth. -->

Decisions recorded from Max Holden’s authorization to build the G10 docs and
definition package after G9 Mode B land + extended G9→G10 recon. Bound to
DoD gates plan §G10 / Increment 6.

## Settled

### Scope (1A)

G10 is **full Increment 6** cutover and rollback after G9 shadow equivalence.
OQ7 narrow live-projection shortcut is **closed**. No “one surface now,
full cutover later” charter split.

### Granularity and campaign (2A)

Cutover is **per-surface slices** (dual-run exit, rollback drill, proof each).
All surfaces are **encompassed in one workload / one later runtime session**
as ordered slices S0–S8. Do not plan multiple sessions to cut over platforms
separately over time.

### Auth

G10 **runtime** is not authorized by this package. Do not create
`docs/scm/g10/authorization.md` until the ceremony in
`runtime-auth-ceremony.md`. Do not flip
`docs/scm/g8/manifest.json` → `g9toG10Authorized`. G9 `authorization.md`
(WP1–WP8 shadow) does not unlock G10.

### Buses

Ten G9 buses only. Dormant `INV-T2-SCM-HOME-BUS-LINK` stays dormant. Do not
invent an eleventh bus or production home-bus-link in G10 without separate
steward auth.

### Equality / IR

Cutover equivalence reuses `G9DeferredEquality` labels. WORK-000035
losslessness stays deferred. G10 does not claim codec or byte reconstruction.

### Proof

G10 proof bar is **cutover equivalence + rollback drills** (per slice and at
S8 campaign). It is **not** the WP8 763 shadow-label fixture marathon.
Replaying 763 alone never closes a G10 slice.

### Campaign radius (defined)

Blast radius is the inventory-authoritative **activatable** `comm_id` set in
`seam-inventory-completeness.json` (not dormant-preserved home-bus-link).
Defined in `session-runbook.md` §1. Do **not** shrink (OQ7 / multi-session) or
expand (codec / eleventh bus / home-bus activation). Ordered proof and live
rehearsal order risk; they do not resize the set.

### Ordered proof bar

Dual-run exit and noninterference inversion are **deferred** until S0 is green
and, per slice: **live-authoritative rehearsal** + cutover ≡ + rollback drill
are green. Sequence is normative in `docs/scm/g10/proof-bar.md` **Ordered
proof** and `session-runbook.md` §2. Still **one session / full Increment 6**;
**not** OQ7. Ordering when risk arms does **not** change the defined campaign
radius.

### Dual-run exit

For each cut-over surface: after Ordered proof prerequisites, the **live
pre-cutover path is retired** for that surface (manifold is authority).
Surfaces not yet cut over remain on live + optional G9 shadow observe.

**Measurable exit (normative):** a slice exits dual-run only when (a) manifold
admit/route/replace is wired for every activatable inventory `comm_id` in that
slice, (b) live-authoritative rehearsal is green, (c) cutover ≡ evidence under
`G9DeferredEquality` is recorded, (d) rollback drill has been run once
successfully against that slice, (e) an operator/record states live path
retired for those rows. (b)–(d) before (e). See Ordered proof bar.

### Noninterference inversion

On **cut-over** surfaces **after dual-run exit** for that slice (Ordered
proof step 6), manifold failure **may fail** the user-visible operation. This
inverts G9 observe-beside noninterference for those rows only. Non-cut-over
surfaces keep G9 law (SCM/capture failure must not fail live). Each S1–S7 DoD
must restate inversion locally. During dual-run **before** exit (including
live rehearsal), failure-coupling follows the slice’s written
admit/route/replace wiring (live still authoritative until exit criterion
(e) above). Do not arm inversion before exit.

### Rollback

Rollback restores the **pre-cutover live path** for the slice (or full
campaign at S8). It is not “turn off `T2CODE_SCM_G9_SHADOW`.” It does not
add a new campaign halt controller; G7 DIP freeze/halt remains bus-level
safety, separate from G10 cutover rollback switches.

### Fabric claim freeze

| Surface class                    | Pre-G10 authority                      | G10 claim after slice exit                           |
| -------------------------------- | -------------------------------------- | ---------------------------------------------------- |
| Orch events + queue              | Effect pub/sub + Engine queue offers   | Manifold admit/route/replace at Engine / ORCH seams  |
| WS / live buffers                | `ws.ts` liveBuffer offers              | Manifold path for ORCH-LIVE class comms              |
| Server settings / file-db-config | File/DB/process config live I/O        | Manifold for inventoried settings/config comms       |
| Git / VCS                        | VcsDriver / git live                   | Manifold for inventoried GIT comms                   |
| Relay                            | relayClient / cloudflared live         | Manifold for inventoried RELAY comms                 |
| Provider protocol                | Provider runtimes live                 | Manifold for inventoried provider comms              |
| Terminal / Manager               | `terminal/Manager.ts` live             | Manifold for inventoried TERM streams                |
| Observability / Effect consumers | OTEL/Effect observe hooks (G9 capture) | Manifold authority where those rows are cut over     |
| Persistence / remaining locals   | Ledger-backed local boundaries         | Manifold for remaining inventoried locals in S7      |
| MCP HTTP (phase)                 | MCP server live (WP6 seam)             | Included under provider/MCP slice ownership per plan |

### Non-goals (reconfirmed)

- Codec / nibble / dictionary
- Claiming G10 readiness from G9 763
- Restricted-ref copy into git
- Multi-session per-platform cutover campaigns

## Binding pointers

- Design: `docs/superpowers/specs/2026-10-18-scm-g10-cutover-rollback-design.md`
- Plan: `docs/superpowers/plans/2026-10-18-scm-g10-cutover-rollback.md`
- Slice matrix: `docs/scm/g10/integration-readiness.md`
- Recon input: `docs/scm/g9/g9-to-g10-recon.md`
