---
title: T2 OpenTelemetry peer plane - Plan
type: feat
date: 2026-08-23
topic: t2-opentelemetry-peer-plane
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: operator-brief
execution: code
---

# T2 OpenTelemetry peer plane - Plan

## Goal Capsule

- **Objective:** Give T2 a peer OpenTelemetry plane for T2 execution and governance. Keep T3 execution observability in the T3 Effect runtime. Join the two only with `SpanLink` at a closed catalog of architectural boundaries.
- **Product authority:** This document is the T2 observability contract. Do not make T2 a child of T3 traces. Do not call `NodeSDK.start()` or register a process-global OpenTelemetry provider for T2. Do not copy T3 span payload into T2.
- **Stop:** If a unit would call `trace.setGlobalTracerProvider`, `t2Provider.register()`, a second `NodeSDK.start()`, T2 auto-instrumentation, parent/child propagation across the T3/T2 boundary, or treat every T3 span as a T2 compatibility surface, stop.

---

## Product Contract

### Summary

T2 and T3 are separate telemetry systems with independent needs.

They may share the same OpenTelemetry packages. They must not share an instance, a global provider, or a trace tree.

Shared execution boundaries emit one T3 span and one T2 bridge span. The T2 span links to the T3 span. Neither tree is nested in the other.

T2 then extends past the mirror into T2-owned work: evidence, ASD-STE100, authority, work-registry, admission, and other T2 paths.

A later move of the T2 runtime into another process is the same architecture with a stronger isolation boundary. It is not a new model.

### Problem Frame

T2 today inherits T3 `ObservabilityLive`. That layer uses Effect `OtlpTracer`, `T3CODE_OTLP_*`, and `service.runtime: t3-server`. Local NDJSON traces stay T3's source of truth for ordinary local launches.

That is T3 execution observability. It is not a T2 plane.

A convenient `NodeSDK.start()` in the same process would call `trace.setGlobalTracerProvider()`, install a global context manager, and install a global propagator. Duplicate global registration is a known failure. T2 would become the process-global OpenTelemetry runtime, or collide with T3.

### Actors

- A1. **T3 observability:** Effect tracer. `T3CODE_OTLP_*`. Resource `service.name=t3-server`. Existing T3 context and runtime.
- A2. **T2 observability:** Explicit OpenTelemetry `TracerProvider`, `SpanProcessor`, and OTLP exporter. `T2CODE_OTLP_*`. Resource `service.name=t2-server`. T2-owned async context. Tracers from `provider.getTracer("t2")` only.
- A3. **Bridge:** At a named T3 architectural boundary, observe T3 `trace_id` and `span_id`. Start a T2 span in T2 context. Attach one `SpanLink` to the T3 span. Do not copy T3 payload.
- A4. **T2-owned work:** Admission, evidence, ASD-STE100, authority, work-registry, realization/projection, and other T2 paths. These spans exist only on the T2 plane.

### Key Flows

- F1. T3 records execution spans on the T3 Effect tracer. T2 does not parent those spans.
- F2. At each catalog boundary, T2 starts its own trace and bridge span, then links to the T3 boundary span.
- F3. T2 continues the T2 trace under T2 private context for T2-owned work.
- F4. T2 export uses T2 processors and `T2CODE_OTLP_*`. T3 export uses T3 processors and `T3CODE_OTLP_*`.
- F5. Optional later split: move A2 into another process. Keep F2 semantics.

### Requirements

- R1. T3 owns T3 execution observability. Do not change T3's Effect tracer into a T2 child, and do not route T3 spans through the T2 provider.
- R2. T2 owns T2 execution and governance observability. T2 must have true OpenTelemetry behavior as a peer, not a wrapper around T3 `ObservabilityLive`.
- R3. Same OpenTelemetry install is allowed. Instance, resource, context, processor, exporter, and env must be distinct.
- R4. Do not call `trace.setGlobalTracerProvider` for T2.
- R5. Do not call `register()` on the T2 provider.
- R6. Do not call `NodeSDK.start()` for T2.
- R7. Do not enable T2 auto-instrumentation.
- R8. Construct T2 with explicit SDK primitives (`TracerProvider` / `BasicTracerProvider` or the current `sdk-trace-base` equivalent, explicit `SpanProcessor`, explicit OTLP exporter). Obtain tracers with `t2Provider.getTracer("t2")`. Inject the tracer. Do not read T2 spans from the process-global API.
- R9. Give T2 its own `AsyncLocalStorage` execution context. Do not make OpenTelemetry `context.active()` authoritative for T2.
- R10. Correlation across planes is an OpenTelemetry `SpanLink` only. Not parent/child. Not a copied T3 trace. Not a shared trace id for the T2 tree.
- R11. Mirror cardinality is 1:1 at the **architectural boundary catalog** only. Every T3 architectural boundary span has exactly one T2 bridge counterpart. Do not require a T2 counterpart for every T3 span.
- R12. Do not copy T3 span payload, attributes, events, or status into T2. T2 may record T2-owned attributes on T2 spans.
- R13. T2 resource identity is `service.name=t2-server`. T3 remains `service.name=t3-server`.
- R14. T2 env prefix is `T2CODE_OTLP_*`. Do not reuse `T3CODE_OTLP_*` for T2 export.
- R15. T2-owned local span records, if present, must not write T3 `server.trace.ndjson`.
- R16. T2 extends beyond the mirror into evidence, ASD-STE100, authority evaluation, work-registry operations, admission, realization/projection, and other T2-owned paths.
- R17. Separate-process isolation (option 3) keeps R1–R16. It only moves the T2 provider, export, and context into another process.
- R18. Approach 1 (peer Effect clone of T3 `OtlpTracer`) is a prototype only. It is too coupled for the target.

### Boundary catalog

The interoperability surface is this closed table. Implementation-level T3 spans outside the table are not a T2 compatibility contract.

| T3 boundary | T2 counterpart |
| --- | --- |
| RPC | RPC bridge span |
| orchestration | orchestration bridge span |
| provider turn | provider-turn bridge span |
| git | git bridge span |
| sqlite | sqlite bridge span |
| terminal | terminal bridge span |

T2 independently adds:

- admission
- evidence evaluation
- ASD-STE100
- authority evaluation
- work-registry operations
- realization/projection
- other T2-owned paths

### Invariants

```
mirror cardinality = 1:1   (catalog boundaries only)
trace identity       ≠ 1:1
parentage            ≠ shared
payload              ≠ copied
correlation          = OTel SpanLink
```

Example:

```
T3:
trace A
└── orchestration span X

T2:
trace B
└── orchestration bridge span Y
    └── link → { trace_id: A, span_id: X }
```

Forbidden:

```
T3 trace A
└── T3 span X
    └── T2 span Y
```

Forbidden:

```
T2 copies T3 trace A
```

### Runtime split

```
PROCESS
│
├── T3 observability
│   ├── Effect tracer
│   ├── T3CODE_OTLP_*
│   ├── resource: service.name=t3-server
│   └── existing T3 context/runtime
│
└── T2 observability
    ├── explicit OTel TracerProvider
    ├── explicit SpanProcessor
    ├── explicit OTLP exporter
    ├── T2CODE_OTLP_*
    ├── resource: service.name=t2-server
    ├── T2-owned async context
    └── provider.getTracer("t2")
```

Context:

```
T3 active context ─────────────── T3 trace
        │
        │ bridge observes IDs
        ▼
T2 bridge span ── link ───────── T3 boundary span
        │
        ▼
T2 private context ───────────── T2 trace
```

Later isolation (same contract):

```
M2 / now
┌──────────── process ─────────────┐
│ T3 runtime │ T2 isolated runtime │
└────────────┴─────────────────────┘

later
┌── T3 process ──┐      ┌── T2 process ──┐
│ T3 runtime     │─────▶│ T2 runtime     │
└────────────────┘      └────────────────┘
```

### Ranking

| Approach | Assessment |
| --- | --- |
| 1. Peer Effect clone | Valid prototype. Too coupled. |
| 2. Explicit official OpenTelemetry provider, non-global | Correct first implementation. |
| 3. Separate process | Correct later isolation if operations need it. |

### Acceptance Examples

- AE1. **Covers R4–R8.** Given a T2 server process, when T2 tracing starts, then no `trace.setGlobalTracerProvider`, no T2 `provider.register()`, and no `NodeSDK.start()` run. `getTracer("t2")` comes from the injected T2 provider.
- AE2. **Covers R10–R12.** Given one orchestration command, when both planes record, then T3 has trace A span X, T2 has a different trace B span Y, Y links to `{trace_id: A, span_id: X}`, Y is not a child of X, and T2 does not copy X attributes.
- AE3. **Covers R11.** Given extra T3 helper spans under an RPC boundary, when T2 mirrors, then T2 emits one RPC bridge span, not one span per T3 helper.
- AE4. **Covers R13–R14.** Given `T2CODE_OTLP_TRACES_URL` and `T3CODE_OTLP_TRACES_URL`, when both export, then T2 resource is `t2-server` and T3 resource is `t3-server`. Unset T2 URL does not disable T3 export.
- AE5. **Covers R16.** Given an ASD-STE100 check or work-registry operation with no T3 boundary, when T2 records, then a T2-owned span exists with no required T3 parent and no required T3 link.

### Success Criteria

- T2 has an independently instantiated OpenTelemetry runtime that is never the process-global provider.
- Catalog boundaries have a 1:1 span-link mirror.
- T2-owned governance and evidence paths exist on the T2 plane only.
- T3 Effect observability remains the T3 plane.
- A later process split can reuse this contract.

### Out of scope

- Replacing T3 Effect `OtlpTracer` with the official Node SDK.
- T2 auto-instrumentation of HTTP, DNS, filesystem, or Node core.
- Copying T3 metrics, logs, or NDJSON into T2.
- Claiming language-authority approval for ASD-STE100.
- Shipping option 3 (separate process) on this branch.

---

## Outstanding Questions

- OQ1. T2 local span file format (T2-owned NDJSON vs OTLP-only until a collector is present). Resolve in the implementation plan. Default if unset: T2-owned local file, never T3 `server.trace.ndjson`.
- OQ2. First implementation slice: provider + context + tests for R4–R10, then one catalog boundary, then the rest of the table. Resolve in the implementation plan. Default if unset: runtime first, then RPC, then the remaining catalog, then T2-owned paths.
