# G9 steward two-decision record

<!-- Agent: applied WP0. Not G9 runtime. Not writing-plans. Not design approval. -->

Status: **applied** 2026-09-30. Design **approved** 2026-09-30 for planning. Runtime implementation not authorized.

Identifier suffixes (`QUEUE`, `FLAG-TERM-ENV`) remain stable legacy identities and are not authoritative mechanism descriptions.

Historical packets remain: `docs/scm/g9/INV-T2-PROJECT-QUEUE-steward-packet.md`, `docs/scm/g9/INV-T2-FLAG-TERM-ENV-steward-packet.md`.

---

## Decision 1 — `INV-T2-PROJECT-QUEUE`

- Decision date: 2026-09-30
- Approved option: retain `comm_id`; amend G1B to `ProjectionPipeline.projectEvent` callback/service; bind successful Effect completion as G9 `projection-event-succeeded`
- Reason: live path has no queue; inventing `Queue.offer` would falsify inventory; SQL/SQLITE stacking stays independent
- Rejected alternative: retire/rename the row
- `comm_id` stable: yes
- Topology unchanged: `node.projection` / `bus.persistence` / origin `home`
- Affected: G1B inventory + coverage quotes; G1A completeness-manifest class lists; G1A evidence/retained-results/boundary quotes required by G1B coverage; G9 generator/ledgers/fixtures/validation/changelog; this record and the historical packet

## Decision 2 — `INV-T2-FLAG-TERM-ENV`

- Decision date: 2026-09-30
- Approved option: retain `comm_id`; amend G1B to terminal child-environment filtering; keep `process-flags`; G9 `terminal-child-env-filtered` with `A = { kind: "terminal-child-env-filtered" }`, W1 `request_label = terminal-child-env-filtered`, W1 `state_label = exclude-t3code-and-vite`. Policy is total finite W1 state, not a second equality field. Never keys, values, counts, hashes, IDs, commands, paths, or terminal data.
- Reason: Inherited server env does not pass T3CODE*\* or VITE*_ into the PTY. The old forwarded-T3CODE claim is false for inherited env. Caller-supplied runtime env is copied after shouldExcludeTerminalEnvKey and can still set T3CODE\__ on the child.
- Rejected alternative: retire the row
- `comm_id` stable: yes
- Topology unchanged: `node.terminal` / `bus.terminal` / origin `home`
- Affected: same documentation set as Decision 1 for this `comm_id`

Implementation still not started.
