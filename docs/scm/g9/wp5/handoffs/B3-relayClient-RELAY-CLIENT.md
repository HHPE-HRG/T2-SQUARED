# B3 live-landing notes: INV-T2-RELAY-CLIENT on relayClient

**Planning owner:** WP5-B3 (`g9FamilySubprocessExternalTransport.ts`)
**Sole lander:** WP5-B3-Owner (RFC-014 **A**)
**Live file:** `packages/shared/src/relayClient.ts`
**W5a status:** helpers + notes only. Do **not** edit relayClient.ts in W5a.

## Phases

| `comm_id`             | `phase`                       | Helper                             | Equality A            |
| --------------------- | ----------------------------- | ---------------------------------- | --------------------- |
| `INV-T2-RELAY-CLIENT` | `cloudflared-spawn-succeeded` | `captureCloudflaredSpawnSucceeded` | `{ site: "spawned" }` |
| `INV-T2-RELAY-CLIENT` | `cloudflared-exit-succeeded`  | `captureCloudflaredExitSucceeded`  | `{ site: "exited" }`  |

## Live sites (B3 later land)

- **Spawn:** after `makeCloudflaredRelayClient` / `runCommand` `spawner.spawn` succeeds.
- **Exit:** after `child.exitCode` is observed at the declared exit boundary (zero required for command success; this phase is the observed exit boundary).

Do not put command path, args, exitCode numbers, stderr, or error strings into A.

Integrate **B2** `INV-T2-FLAG-CLOUDFLARED` handoff on this file before RELAY-CLIENT capture lands (plan serial hotspot).

`request_label` may list `CANONICAL_ABSENCE` for these phases; that does **not** make them declaration-absence — they remain live success boundaries (plan § B1 acceptance gate).

## Forbidden in W5a

- Commits to `relayClient.ts`
- Payload / error-string retention in equality A
- Treating these phases as fixture-only because of `CANONICAL_ABSENCE` labels
