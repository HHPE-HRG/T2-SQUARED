# Admission reconcile

<!-- Agent: Draft charter for catalog drift and coverage reconcile.
Not a numbered G11. Not an authorization. admissionReconcileAuthorized
stays false until a human authorization.md lands in the same changeset
as the flag. -->

- Date: 2026-10-21
- Status: **charter / DRAFT** (`admissionReconcileAuthorized: false`; `completed: false`)
- Campaign: admission-reconcile
- Process env: `T2CODE_SCM_ADMISSION_RECONCILE` (default off; restart required)
- Durable auth: none — do not treat this README as unlock

## Index

| Doc                                                    | Role                                                      |
| ------------------------------------------------------ | --------------------------------------------------------- |
| [planning-scope.md](planning-scope.md)                 | In / out / false friends                                  |
| [contracts.md](contracts.md)                           | Record, drift delta, modes, grant, execution classes      |
| [manifest.json](manifest.json)                         | `admissionReconcileAuthorized: false`; `completed: false` |
| [evidence/current-state.md](evidence/current-state.md) | What this process mediates today                          |
| [gap-matrix.md](gap-matrix.md)                         | Review request against this tree                          |
| [execution-matrix.md](execution-matrix.md)             | Ten execution classes and their verdicts                  |
| [g11-recommendation.md](g11-recommendation.md)         | Ownership recommendation; no numbered gate                |
| [deferred.md](deferred.md)                             | Work this changeset does not pretend to finish            |

## What this charter is

Discovery of a tool catalog may change. A change must not become authority.
The review's reconcile step is the behavior: pending delta on schema, digest,
effect, or destination drift; removal and revocation block dispatch; unknown
machine identifiers fail closed; opaque payloads are not lexicon-checked.

Protected mode binds a grant to that decision for preview MCP tool invoke.
Compatibility mode leaves preview invoke on the session credential and is not
authority. The other nine execution classes stay unmediated.

## What this charter is not

- A numbered G11 gate, and not a reuse of `g9toG10Authorized`
- Home-bus activation, an eleventh bus, or a radius resize
- Codec losslessness, Equality-IR, N08 client traces, or AgentAPPA clearance
- A Tool Registry grant hidden inside the preview session credential `"preview"`
- Mediation of provider-native search, shell, or MCP. Those stay outside
  granular guarantees and show up as executable-but-unregistered
