# S7 → S3 lander handoff: `INV-T2-FILE-CHECKPOINTS` on `VcsDriver.ts`

<!-- Agent: G10 S7 authoring only. Do not edit VcsDriver.ts in S7. -->

- Date: 2026-10-18
- Planning owner: **G10-S7** (FILE-CHECKPOINTS `comm_id`)
- Sole lander: **S3** (`VcsDriver.ts` per `cross-slice-cohesion-index.md`)
- Live file: `apps/server/src/vcs/VcsDriver.ts`
- Prior G9 note: `docs/scm/g9/wp5/handoffs/b2-to-b3-vcs-relay.md`
- Machine note: `G10_S7_FILE_CHECKPOINTS_HANDOFF` in `g10SliceS7.ts`; reception
  `G10_S3_FILE_CHECKPOINTS_HANDOFF_FROM_S7` in `g10SliceS3.ts`
- Status: **landed** (S8 lander reopen on S3 `VcsDriver.ts`;
  `G10_S3_FILE_CHECKPOINTS_HANDOFF_FROM_S7`)

## Why deferred

S7 owns `INV-T2-FILE-CHECKPOINTS` at the `comm_id` layer. Cohesion assigns
**sole file lander** for `VcsDriver.ts` to **S3**. S7 must not commit that
file. S3 already wraps GIT via `gitExecuteViaG10Bridge` and keeps checkpoint
ops as G9 capture-beside only — do not steal under S3 exit (a).

## Phases (S7 owns)

| `comm_id`                 | `phase_id`                                  | Equality A                              |
| ------------------------- | ------------------------------------------- | --------------------------------------- |
| `INV-T2-FILE-CHECKPOINTS` | `checkpoint-captureCheckpoint-succeeded`    | `{ operation: "captureCheckpoint" }`    |
| `INV-T2-FILE-CHECKPOINTS` | `checkpoint-restoreCheckpoint-succeeded`    | `{ operation: "restoreCheckpoint" }`    |
| `INV-T2-FILE-CHECKPOINTS` | `checkpoint-diffCheckpoints-succeeded`      | `{ operation: "diffCheckpoints" }`      |
| `INV-T2-FILE-CHECKPOINTS` | `checkpoint-deleteCheckpointRefs-succeeded` | `{ operation: "deleteCheckpointRefs" }` |
| `INV-T2-FILE-CHECKPOINTS` | `checkpoint-hasCheckpointRef-succeeded`     | `{ operation: "hasCheckpointRef" }`     |

## Patch for S3 sole lander

Wire admit/route/replace via `g10SeamBridge` (S7 controller helpers or S3
shared runner consuming S7 traffic) at each checkpoint op success in
`wrapCheckpointOpsWithG9Capture`. Keep G9 `captureCheckpointSucceeded` as
observe-beside — cutover ≠ capture.

Suggested helper shape (names illustrative; lander implements):

```ts
yield * fileCheckpointsViaG10Bridge("captureCheckpoint", liveOp);
```

Absent S7 controller / not replaced ⇒ today’s checkpoint ops only.

## S7 honesty (do not claim)

- S7 dual-run-exit **(a)/(e)** does **not** include FILE-CHECKPOINTS.
- S7 ≡ includes a FILE-CHECKPOINTS **stub pair** for Ordered-proof carrier only.
- S7 does **not** edit or commit `VcsDriver.ts`.

## Non-goals

- Do not steal INV-T2-GIT under this note (S3).
- Do not land FLAG-CLOUDFLARED here (separate S7→S3 handoff).
- Do not flip auth flags or resize campaign radius.
