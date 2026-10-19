# G10 adversarial freeze manifest

<!-- Agent: subject hashes for blind panel. Not runtime. -->

- Date: 2026-10-18
- Wave: **wave-2** (new panel after SEAL_FAIL; R0 residual close; 2026-10-18T22:29:48Z)
- Charter: `docs/scm/g10/adversarial-review-charter.md`
- Hash algorithm: SHA-256 of file bytes
- Prior: wave-1 / 1b / 1c ended SEAL_FAIL; repair budget for that panel exhausted

## Law subjects (panel)

| sha256                                                             | path                                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `38bb60f01832d75eae2c0ccf3734085c2f3b030d7321270cc139606b0887a2b6` | `docs/scm/g10/README.md`                                               |
| `064b13e5ad8b38cdd3b8d918b295aaa8610a64bf421f738cf73782735d1eaca9` | `docs/scm/g10/planning-scope.md`                                       |
| `f55b6c7edb334b6624ca550891fe79c0c7e19d252bccb8e6f5dc6b95e0fb9c28` | `docs/scm/g10/design-approval.md`                                      |
| `1993f594df4875d8fff3d9677f8aa4100d0b8eefb96ff276ee4d32d552b3aea9` | `docs/scm/g10/manager-charter.md`                                      |
| `314dfd6658f0027f613426425978582751a09dd1f83676c68b6c5ce71f141823` | `docs/scm/g10/decisions.md`                                            |
| `8ee6d07703c066f6d69a82ee690b69a71e924ec340cdc6bee1e91f903bfb098d` | `docs/scm/g10/integration-readiness.md`                                |
| `50c05b9d24ef2e76162d44dc788fadf20df2cf100266a0c1db2a5870054dfbbc` | `docs/scm/g10/cross-slice-cohesion-index.md`                           |
| `aef1229525e44709ed0e5a9857a4e24ae161a2ead19cfac77348a5a5f64391f2` | `docs/scm/g10/runtime-auth-ceremony.md`                                |
| `368a333ffa065b264f80d76e31f7a17f34d722073a1a6990f9cf8a2d6c6103b3` | `docs/scm/g10/seam-inventory-completeness.md`                          |
| `7b79f490c67c9069e66ad5435dd4404ed5aeb6ea916454edc15a049d82b39dc4` | `docs/scm/g10/seam-inventory-completeness.json`                        |
| `afaf390f76481cb274634a8237c3a813b7c00edd2b66cf173bf7b2e61b8945c1` | `docs/scm/g10/proof-bar.md`                                            |
| `7c1ef2b8970fb110d99c5f86d13e3bc725fede0417fa9abc27d90cafd148e1fd` | `docs/scm/g10/adversarial-review-charter.md`                           |
| `238848b32c386cc6609c58e1ea2f8a055da872eb93d4e04f3c8720f8607714b1` | `docs/superpowers/specs/2026-10-18-scm-g10-cutover-rollback-design.md` |
| `64a3648d51b240308a3230a18e082af73806472a0597bb3d68c6091049dae119` | `docs/superpowers/plans/2026-10-18-scm-g10-cutover-rollback.md`        |

## Read-only authority (panel)

| sha256                                                             | path                               |
| ------------------------------------------------------------------ | ---------------------------------- |
| `de8c3f1cc50d5ffd46f2d201db70538788548a60aa07b260767e9581c62e883e` | `docs/scm/g9/g9-to-g10-recon.md`   |
| `9d5ecf651898136ef3aca060b7e388140b684669192e3bf4781128677a7b3f99` | `docs/scm/g9/coverage-ledger.json` |
| `711c88ae63903bba620292aac58ff7c38f764ec537ddc7f657d50f14e67164c8` | `docs/scm/g9/wp5/bundle-index.md`  |

## Status subjects (excluded from law freeze after seal)

- `docs/scm/g10/definition-progress.md`
- `docs/scm/g10/manifest.json`
- `docs/scm/g10/adversarial-findings.md`

## Locks at freeze

- `docs/scm/g8/manifest.json` → `g9toG10Authorized: false`
- `docs/scm/g10/authorization.md` absent
- No `apps/server/src/scm/g10*`

## R0 residuals closed before this freeze

- S4 Rollback names provider/\*\* + McpHttpServer + environmentHttp + http.ts
- S5 Rollback names Manager + NativeTelemetryClient + DesktopTelemetryReceiver
- S7 Seams name every sole-lander hotspot file
