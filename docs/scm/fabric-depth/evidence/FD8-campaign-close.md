# FD8 campaign close evidence (Battery FD8)

<!-- Agent: Fabric-depth campaign close. Soft-fallback retire audit +
aggregate ≡ + campaign rollback. Not G11. Not WP8 763. -->

- Date: 2026-10-20
- Battery: **FD8**
- Status: **GREEN**
- Activatable radius: **73**
- Dormant-exempt: **1**
- Sole-lander debt: **0**
- Aggregate samples: **12**
- forbids763: `true`

## Per-slice soft-fallback retire

| Slice | debt | softFallback | Ordered bodies |
| ----- | ---- | ------------ | -------------- |
| S1    | 0    | retired      | 7              |
| S2    | 0    | retired      | 7              |
| S3    | 0    | retired      | 7              |
| S4    | 0    | retired      | 7              |
| S5    | 0    | retired      | 7              |
| S6    | 0    | retired      | 7              |
| S7    | 0    | retired      | 7              |

## Campaign rollback

- slicesRestored: S1, S2, S3, S4, S5, S6, S7
- softFallback re-emit active: S1, S2, S3, S4, S5, S6, S7

## Notes

- FD1–FD7 Ordered depth through soft-fallback-retire driven under T2CODE_SCM_FABRIC_DEPTH
- Sole-lander census debt empty (handoff stubs remain non-blocking)
- Home-bus dormant-exempt (softFallback field omit)
- Aggregate ≡ under G9DeferredEquality; WP8 763 refused
- Campaign rollback re-emits g10.softFallback=active per restored slice
- G10 live-cutover alone is not Fabric-depth proof
- Not G11

## Verdict

**GREEN** — Fabric-depth campaign close. `manifest.completed` may flip true.
