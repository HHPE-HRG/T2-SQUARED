# Manifold I/O census (Battery A)

<!-- Agent: docs-only census for Fabric-depth ceremony gate. Not implement. -->

- Date: 2026-10-19
- Machine: `manifold-io-census.json`
- Baseline: `origin/main` @ `8e96bbfb5`

## Summary

| Class          | Count (rows) |
| -------------- | ------------ |
| real           | 46           |
| stub           | 22           |
| observe        | 5            |
| dormant-exempt | 1            |

**Fabric-depth implement debt** = every activatable row whose **sole lander**
path is still `stub` or `observe` (handoff stubs on non-lander slices do not
double-count when a lander row is already `real`).

## Classes

- **real** — when manifold authority is selected, `manifoldEffect` performs the
  same inventoried verb-class I/O as live (publish/offer/file/flag/spawn/…).
- **stub** — record-only / handoff / capture-after-I/O-outside-bridge.
- **observe** — G9 capture-beside shaped; inventoriable I/O sits outside bridge.
- **dormant-exempt** — `INV-T2-SCM-HOME-BUS-LINK` only.

## Hotspots for FD slices (stub/observe on landers)

- S2: `INV-T2-FLAG-T3-OTEL` (passthrough)
- S4: CLAUDE, OPENCODE, FILE-LOGS (event-log), FILE-PROVIDER-SESSION cache,
  FLAG-CODEX-LAUNCH
- S5: TEL-DESKTOP-IN, TERM, FLAG-TERM-ENV
- S6: ORCH-LIVE lander on `ws.ts` is **real** (S2 stub is handoff-only); TEL-NDJSON,
  T3-TRACE, T2/T3-OTLP, FLAG-T2-OTEL (observe); FLAG-T3-OTEL stub

Home-bus remains dormant-exempt.

## Binding

FD Ordered depth (`proof-bar.md`) may not claim sole-I/O GREEN for a seam
while its lander census class is `stub` or `observe`.
