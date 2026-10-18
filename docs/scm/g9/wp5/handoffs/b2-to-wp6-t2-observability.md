# B2 → WP6 handoff: `T2Observability.ts`

<!-- Agent: W5a patch description only. WP6-Consumer-Owner is sole lander for T2Observability.ts (RFC-005 A). B2 must not commit T2Observability.ts. -->

- Bundle owner: **B2** (`g9FamilyFileDbProcessConfig.ts`)
- Integrator: **WP6-Consumer-Owner**
- Live file: `apps/server/src/t2Observability/T2Observability.ts`
- Helper module: `apps/server/src/scm/g9FamilyFileDbProcessConfig.ts`
- Row: `INV-T2-FLAG-T2-OTEL` / `flag-resolved`
- Equality A: `G9T2OtelFlagA` (`member` + `state_label`)

## Phase to land

| `comm_id`             | `phase_id`      | Helper export                                                       | Capture input                                                                                                                                     |
| --------------------- | --------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INV-T2-FLAG-T2-OTEL` | `flag-resolved` | `captureFlagT2OtelResolved` / `buildFlagT2OtelResolvedCaptureInput` | `{ member: "T2CODE_TRACE_FILE" \| "T2CODE_OTLP_TRACES_URL" \| "T2CODE_OTLP_SERVICE_NAME", state_label: "configured" \| "defaulted" \| "absent" }` |

## Exact call site

- Layer: `T2ObservabilityLive` (~199–208).
- Reads today:
  - `process.env.T2CODE_OTLP_TRACES_URL` → `tracesUrl`
  - `process.env.T2CODE_TRACE_FILE ?? join(config.logsDir, "t2.trace.ndjson")` → `filePath`
  - `process.env.T2CODE_OTLP_SERVICE_NAME ?? "t2-server"` → `serviceName`
- When: once per member at successful flag resolution while building the live layer options (presence/shape only; no new env parsing).

### `state_label` mapping (declarative)

| `member`                   | `configured`                 | `defaulted`                           | `absent`                                                                                           |
| -------------------------- | ---------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `T2CODE_TRACE_FILE`        | env set non-empty            | env unset, default path used          | (only if a future path treats missing default as absent; current code always defaulted when unset) |
| `T2CODE_OTLP_TRACES_URL`   | env set (Option/url present) | n/a for URL (no default URL)          | env unset → OTLP exporter omitted                                                                  |
| `T2CODE_OTLP_SERVICE_NAME` | env set non-empty            | env unset, `"t2-server"` default used | n/a under current defaults                                                                         |

Capture each member with the matching `state_label` for that resolution. Call:

```ts
yield * captureFlagT2OtelResolved(member, state_label, capture);
```

Do not put URLs, file paths, or span payloads in `input`. Flag presence/shape only.

## Out of scope for this handoff

- `INV-T2-FLAG-T3-OTEL` and `INV-T2-FLAG-SERVER-CONFIG` live on `apps/server/src/cli/config.ts` (B2-owned primary surface; not WP6).
- B5 NDJSON / other T2Observability phases are separate handoffs.
- Effect global patch hooks remain WP6-owned; this handoff is flag resolution only.

## Integrator checklist

1. WP6 lands the hooks; B2 does not open a commit on `T2Observability.ts`.
2. Use live-safe `captureOccurrence` only.
3. Three members → up to three captures at layer construction (one per member resolution), not per span.
4. Run B2 family tests for `buildFlagT2OtelResolvedCaptureInput` after landing.
