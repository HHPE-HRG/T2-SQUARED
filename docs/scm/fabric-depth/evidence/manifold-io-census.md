# Manifold I/O census (Battery A)

<!-- Agent: census for Fabric-depth ceremony gate. Updated by FD batteries. -->

- Date: 2026-10-19
- Machine: `manifold-io-census.json`
- Baseline: `origin/main` @ `8e96bbfb5`

## Summary

| Class          | Count (rows) |
| -------------- | ------------ |
| real           | 58           |
| stub           | 10           |
| observe        | 0            |
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

- S2: sole-lander debt empty after FD2 (`INV-T2-FLAG-T3-OTEL` **real**;
  ORCH-LIVE handoff-only)
- S4: sole-lander debt empty after FD4 (CLAUDE/OPENCODE/FILE-LOGS/
  FILE-PROVIDER-SESSION/FLAG-CODEX-LAUNCH → real)
- S5: TERM / TEL-DESKTOP-IN / FLAG-TERM-ENV promoted **real** (FD5); NDJSON /
  T3-TRACE remain S5→S6 handoff stubs (lander real on S6)
- S6: ORCH-LIVE + TEL-NDJSON / T3-TRACE / T2-OTLP / T3-OTLP / FLAG-T2-OTEL
  landers **real** (FD6); FLAG-T3-OTEL handoff stub; HOME-BUS dormant

Home-bus remains dormant-exempt.

## Binding

FD Ordered depth (`proof-bar.md`) may not claim sole-I/O GREEN for a seam
while its lander census class is `stub` or `observe`.
