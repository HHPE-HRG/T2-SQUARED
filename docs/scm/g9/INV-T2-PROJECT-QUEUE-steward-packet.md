# INV-T2-PROJECT-QUEUE steward decision packet

<!-- Agent: historical evidence. Resolved by docs/scm/g9/steward-two-decisions.md. Not G9 runtime. -->

Status: **resolved** 2026-09-30 by combined steward record (preferred option applied). Do not treat this packet as current inventory law.

Applied: keep `comm_id`; G1B `callbacks` + `projectEvent`; G9 counted phase `projection-event-succeeded`. Rejected: retire/rename.

## Exact former G1B `queues` wording (historical)

From `docs/scm/g1b/inventory.json` row `INV-T2-PROJECT-QUEUE` before WP0:

- `name`: `OrchestrationProjectionPipeline`
- `sender`: `orchestration events`
- `receiver`: `projection SQL services`
- `transport_boundary`: `in-process projection pipeline queue`
- `mechanism_classes`: `["queues"]`
- `symbols`: `["apps/server/src/orchestration/Services/ProjectionPipeline.ts"]`

G3 placement (unchanged): `node.projection` / `bus.persistence` / origin `home`.

## Live `ProjectionPipeline.projectEvent` call chain

Production path in `apps/server/src/orchestration/Layers/OrchestrationEngine.ts` `processEnvelope`, inside the SQL transaction after `eventStore.append`:

1. `projector.projectEvent(nextCommandReadModel, savedEvent)` — in-memory command read-model fold (`apps/server/src/orchestration/projector.ts`). This is not a queue.
2. `projectionPipeline.projectEvent(savedEvent)` — `OrchestrationProjectionPipeline` service method.

Live implementation (`apps/server/src/orchestration/Layers/ProjectionPipeline.ts`):

- `projectEvent` runs `Effect.forEach(projectors, runProjectorForEvent, { concurrency: 1 })`.
- Success is Effect completion (`Effect.asVoid`) after sequential projector execution.
- Failures are SQL/`ProjectionRepositoryError` via `toPersistenceSqlError("ProjectionPipeline.projectEvent:query")`.
- That layer contains **no** `Queue` import or `Queue.offer`.
- `apps/server/src/orchestration/Services/ProjectionPipeline.ts` declares only `bootstrap` and `projectEvent`.

Command `Queue.offer` remains `INV-T2-ORCH-QUEUE`. `INV-T2-PROJECT-SQL` / `INV-T2-SQLITE` remain independent.
