# FD6 depth evidence (Battery FD6 — S6)

<!-- Agent: Fabric-depth FD6 — promote S6 observe sole-landers → real manifold
I/O; soft-fallback-retire under T2CODE_SCM_FABRIC_DEPTH; home-bus dormant.
No G11. Does not edit cli/config.ts (S2 owns FLAG-T3-OTEL). -->

- Date: 2026-10-19
- Battery: **FD6**
- Slice: **S6**
- Status: **GREEN**
- Env: `T2CODE_SCM_FABRIC_DEPTH` (distinct from `T2CODE_SCM_G10_CUTOVER`)
- Census: `manifold-io-census.json` (S6 sole-lander debt empty)

## Observe → real sole-landers

| comm_id               | Lander               | Verb inside bridged liveIo                               |
| --------------------- | -------------------- | -------------------------------------------------------- |
| `INV-T2-FLAG-T2-OTEL` | `T2Observability.ts` | env member resolve                                       |
| `INV-T2-TEL-NDJSON`   | `T2Observability.ts` | NDJSON `SpanExporter.export` (append)                    |
| `INV-T2-TEL-T2-OTLP`  | `T2Observability.ts` | `OTLPTraceExporter.export`                               |
| `INV-T2-TEL-T3-TRACE` | `Observability.ts`   | `TraceSink.flush` (file persist + onFlush)               |
| `INV-T2-TEL-T3-OTLP`  | `Observability.ts`   | OTLP `HttpClient.execute` via `g10T3OtlpHttpClientLayer` |

Left unchanged:

- `INV-T2-ORCH-LIVE` — already **real** on `ws.ts`
- `INV-T2-FLAG-T3-OTEL` — S6→S2 handoff stub (`cli/config.ts` not edited)
- `INV-T2-SCM-HOME-BUS-LINK` — dormant-exempt; **omits** `g10.softFallback`

## Soft-fallback retire

| Step                                | Module                                       | Proof                           |
| ----------------------------------- | -------------------------------------------- | ------------------------------- |
| Ordered depth through arm-inversion | `g10SliceS6.ts`                              | `g10SliceS6.test.ts`            |
| `softFallbackRetire` under FD env   | `recordSoftFallbackRetire` + census gate     | FD6 env tests                   |
| Home-bus omits field                | dormant-exempt (not in soft-fallback slices) | retire notes + dormant constant |

## Explicit

- No G11
- Radius unchanged
- `cli/config.ts` not edited (S2)
- Home-bus not activated
