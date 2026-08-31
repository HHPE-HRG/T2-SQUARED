# SCM G4/G5 vertical slice - Plan

Status: implementation-ready constrained slice. Not G6–G10.

## Goal Capsule

G4: T2-owned W1 type, no encodings. G5: two nodes, one in-process bus, unsatisfied repeat, T2 OTEL observe.

Observation contract pick: option 2. Each `t2.scm.publish` / `t2.scm.receive` span carries `t2.scm.word_id` (content hash of W1 slots) plus CAN attributes. No receive `SpanLink`. Not mixed event/SpanLink.

## Scope Boundaries

- No SCM/CAN codec, nibble alphabet, global dictionary, production encoding.
- No DIP mute, halt API, Increment 4 clocks, live fabric, T3 `server.trace.ndjson`.
- Do not set G1B/G2/G3 `g4toG7Authorized` true.
- No `setGlobalTracerProvider`.
- No “tick” synonym for fundamental timestep.

## Files

- `apps/server/src/scm/g4Word.ts`
- `apps/server/src/scm/g5OpenLoop.ts`
- `docs/scm/g4/`
- `docs/scm/g5/`

## Verification

From `apps/server`: `vp test run src/scm/g4Word.test.ts src/scm/g5OpenLoop.test.ts` plus G1–G3 suites.
