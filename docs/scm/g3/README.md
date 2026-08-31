# G3 node and bus overlay

Status: **completed**. Independent completion review is **approved**. G3 does **not** authorize G4–G7.

G1 inventory remains frozen. Topology is keyed by immutable `comm_id`. This package does not implement runtime buses, W1 types, codecs, clocks, DIP, halt behavior, or live fabric.

G1B `g3Authorized` stays false. Human authorization for this execution lives in this manifest.

Codex review of this package is not human-operator attestation.

## Files

| File                      | Role                                              |
| ------------------------- | ------------------------------------------------- |
| `manifest.json`           | Authorization and completion flags                |
| `node-roster.json`        | Component nodes, halt field, reserved 404         |
| `bus-roster.json`         | Provisional domain buses and node-to-bus bindings |
| `inventory-topology.json` | One mapping per G1 `comm_id`                      |

README is explanatory. It is not included in the reviewed-package digest.

## Invariants

- 73 G1 rows appear exactly once.
- Each placed node has exactly one home bus.
- `origin_bus_id` equals that home bus.
- `origin_relationship` is `home`; `intended_bus_relationship` is dispositioned per row (`authority` for A1/human, `linked` for observers, `permissioned-child` for provider children).
- Observer nodes and reserved `node.observer.404` have `halt_initiator: no`.
- No node has `halt_initiator: yes`.
- Provider runtimes are child nodes on `bus.provider`.
- Git/source-control CLIs are endpoints of `node.source-control`.
- `INV-T2-EDITOR-LAUNCH` keeps row authority `human` on `node.lifecycle`.
