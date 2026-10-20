# Fabric-depth campaign (named charter — not G11)

<!-- Agent: Fabric-depth completed 2026-10-19 (FD0–FD8 GREEN). Not G11. -->

- Date: 2026-10-19
- Status: **completed** (`manifest.completed: true`; FD0–FD8 GREEN)
- Unlock: `fabricDepthAuthorized: true` (ceremony 2026-10-19, Max Holden)
- Process env: `T2CODE_SCM_FABRIC_DEPTH` (not `T2CODE_SCM_G10_CUTOVER`)
- Relation to G10: G10 sealed **G10 bridge** authority selection
  (`apps/server/src/scm/g10SeamBridge.ts`). **Fabric-depth** makes
  `manifoldEffect` **real I/O** then retires soft live fallback.
- Prerequisite: G10 package complete + live evidence
  `docs/scm/g10/evidence/live-cutover-2026-10-18.md`

## Index

| Doc                                                              | Role                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------- |
| [glossary.md](glossary.md)                                       | Speech lock: fabric seams / G10 bridge / Fabric-depth         |
| [design.md](design.md)                                           | End-state + bridge purity + soft-fallback retire plan         |
| [planning-scope.md](planning-scope.md)                           | In / out / env / ownership fences                             |
| [session-runbook.md](session-runbook.md)                         | FD0–FD8 map → proof-bar                                       |
| [proof-bar.md](proof-bar.md)                                     | Binding Ordered depth law                                     |
| [ops/soft-fallback-signal.md](ops/soft-fallback-signal.md)       | `g10.softFallback` active\|retired                            |
| [evidence/manifold-io-census.md](evidence/manifold-io-census.md) | Stub/observe/real census                                      |
| [manifest.json](manifest.json)                                   | `fabricDepthAuthorized` + `completed: true`                   |
| [authorization.md](authorization.md)                             | Durable unlock (ceremony 2026-10-19)                          |
| [evidence/FD8-campaign-close.md](evidence/FD8-campaign-close.md) | Campaign close (FD8)                                          |
| [ceremony-checklist.md](ceremony-checklist.md)                   | Docs readiness + human unlock complete                        |
| [research/](research/)                                           | Wave 4 def cache + confirm (post-batteries); Wave 1–3 history |

## Explicit

- Do **not** invent numbered gate “G11”.
- Do **not** treat G10 auth / live-cutover alone as Fabric-depth proof.
- Implement under durable `authorization.md` + `T2CODE_SCM_FABRIC_DEPTH`.
