# Extended G9 → G10 recon

<!-- Agent: planning recon only. Not G10 runtime. Do not flip g9toG10Authorized. -->

- Date: 2026-10-18
- G9 tip basis: `553adc1da` (`feat(scm): land authorized G9 Mode B shadow parity through WP8`)
- Status: **recon closed for planning**; G10 **unauthorized**

## Verdict

G9 Mode B is **landed and exact-set proven** (74 / 184 / **763/763**). That is **shadow-label parity beside live transports**, not live fabric replacement.

G10 remains a **short product sentence** (Increment 6 cutover/rollback after G9 shadow equivalence) with **no** `docs/scm/g10/` package, no WP-style DoD, and a hard ceremony lock: `docs/scm/g8/manifest.json` → `g9toG10Authorized: false`.

G9 `authorization.md` (WP1–WP8 runtime) does **not** authorize G10.

---

## What G10 requires (product law)

From `docs/plans/2026-08-23-002-feat-scm-dod-gates-plan.md` §G10 and G9 design out-of-scope:

1. **Prerequisite:** G9 shadow equivalence (now claimed in-tree).
2. **Cutover:** chosen T2 modules communicate **through the manifold**, not only via wrapped Effect RPC / other live paths.
3. **Rollback** as part of Increment 6 (named; procedure unspecified).
4. **Not** G5–G9 wrap/project/observe — **replacement** is G10.
5. **Not** codec/nibble/dictionary unless separately authorized.

Unresolved in law: which modules are “chosen,” dual-run exit criteria, rollback procedure, cutover metrics, OQ7 narrow live projection vs full cutover.

---

## What G9 landed (consume vs replace)

| G9 leaves for G10 to reuse                     | G9 deliberately does not do                   |
| ---------------------------------------------- | --------------------------------------------- |
| Ledger / fixtures / generated capture+A unions | Replace Effect RPC / HTTP / queues as fabric  |
| Coordinator, FIFO, hearAs, DIP, waker, fault   | Make shadow buses the authority path          |
| Family A projectors + live capture _sites_     | Invert noninterference (SCM fail ⇒ live fail) |
| Effect optional hook tags (observe seams)      | Production home-bus-link / eleventh bus       |
| Env-gated bootstrap + `G9CaptureService` shape | Flip `g9toG10Authorized`                      |
| WP8 marathon harness (763)                     | Claim G10 readiness from exact-set proof      |

Opt-in today: `T2CODE_SCM_G9_SHADOW=1|true|yes` → `g9ShadowStackLayerFromEnv()` in `apps/server/src/server.ts`. Default off = today’s live.

---

## Gap matrix

| Capability                          | G9 landed                              | G10 requires                       | Severity             |
| ----------------------------------- | -------------------------------------- | ---------------------------------- | -------------------- |
| Auth ceremony (`g9toG10Authorized`) | G9 auth true; G10 flag **false**       | Separate human G10 auth            | **blocker**          |
| Transport fabric                    | Live Effect/HTTP/queues; shadow beside | Modules speak SCM (replace live)   | **blocker**          |
| Per-comm cutover vs dual-run        | Dual-run observe only                  | Explicit cutover selection + exit  | **blocker**          |
| Rollback                            | Env-off = shadow opt-out               | Live-fabric rollback drills        | **blocker**          |
| Bootstrap                           | Optional shadow Layer                  | Live-path substitution             | **blocker**          |
| Proof                               | 763 exact-set shadow                   | Cutover ≡ + rollback proof         | **blocker**          |
| WP5/WP6 sites                       | Post-success capture, `never` channel  | Admit/route/replace at same seams  | **major**            |
| Home-bus / 11th bus                 | Dormant fixtures; ten buses            | Decision under auth; no invent #11 | **major**            |
| Equality / 035                      | `G9DeferredEquality` labels            | Reuse vs new cutover contract      | **major**            |
| Codec / nibble                      | Forbidden                              | Still out unless separate auth     | **n/a** (keep out)   |
| HHPE / restricted refs              | Mac drop folder only                   | Same; no copy into git             | **blocker** (policy) |
| Accidental G10 in tree              | **None found**                         | —                                  | —                    |

---

## False friends

- Capture landings ≠ cut over (optional, post-success, live Exit unchanged).
- Complete G9 ≠ G10 ready (`definition-progress.md` says so explicitly).
- Effect patch hooks ≠ manifold fabric.
- Ledger `capture_module` ≠ every path already live-wired (many WP8 vectors are fixture-driven).
- Ten shadow buses under env ≠ “modules speak SCM.”
- G9 `authorization.md` ≠ later-gate unlock.

---

## Reusable vs must-build

**Reuse:** ledger/unions/package; coordinator + FIFO + hearAs + DIP + waker; family A builders; Effect hook _insertion points_; inventory of tapped live files.

**Must-build for G10 (when authorized):** `docs/scm/g10/` ceremony; live-path substitution for RPC/HTTP/orch/provider/MCP/git/relay/terminal/settings/telemetry/persistence; dual-run exit + rollback; proof bar distinct from 763; home-bus decision; equality/IR stance.

---

## Sequenced next steps (planning only — if human authorizes G10 _planning_)

1. G10 planning charter (cutover/rollback docs only; non-goals: codec, flag flip, runtime, restricted-ref copy).
2. Authorization ceremony design (mirror RFC-021/022; G9 auth insufficient).
3. Freeze “fabric claim” per surface.
4. Cutover granularity (all vs per-`comm_id`/phase) + dual-run exit.
5. Rollback model (per-surface, in-flight words, relation to G7).
6. Map each WP5/WP6 capture site → proposed cutover behavior.
7. Home-bus / eleventh-bus decision record.
8. G10 proof bar ≠ WP8 marathon.
9. Equality/IR stance (`G9DeferredEquality` vs WORK-000035).
10. HHPE boundary checklist for planners.

---

## Hard locks (unchanged)

- `g9toG10Authorized: false`
- No G10 runtime implementation from this recon
- Restricted HHPE texts stay in `/Users/maxholden/T2-SQUARED-References`
- One Mac checkout: `/Users/maxholden/T2-SQUARED`

## Agent panel

Parallel recon agents (2026-10-18): G10 requirements extractor; G9 landed inventory; gap matrix; dual-run risk / false friends. Synthesized here by Impl Orchestrator.
