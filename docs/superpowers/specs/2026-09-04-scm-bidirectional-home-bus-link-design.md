---
title: SCM bidirectional home-bus link design
date: 2026-09-04
status: design-approved-awaiting-plan-review
scope: bounded G6/G8 prototype precursor
checkpoint: 0eaddec54d333a6ac14b057487b3a1166935adb5
---

# SCM bidirectional home-bus link design

## Purpose

Connect two existing SCM home buses in both directions without creating bridge authority, a global manifold node, a codec, or a production cutover. Each eligible word is republished unchanged from its source bus onto the destination bus. Nodes on the destination bus can then receive it through normal bus semantics.

This design extends the completed G5 in-process prototype. It describes a bounded precursor to G6 runtime buses and G8 clock work. It does not complete or authorize G6, G7, G8, G9, or G10.

## Existing constraints

- Each active node publishes one W1 word per fundamental timestep.
- A process interval can cover multiple fundamental timesteps.
- A write at timestep T becomes readable at T+1.
- A node has exactly one home bus. Multiple nodes can share one home bus.
- A node can also have non-home `authority`, `linked`, or `permissioned-child` relationships.
- Buses are passive and memoryless outside their previous-timestep readable state.
- Delivery is open-loop: no ACK, retry, receipt-based control, or destination-readiness query.
- OpenTelemetry observes communication but does not admit, route, mute, satisfy, or halt it.
- G1B, G2, and G3 downstream authorization flags remain false.

## Chosen architecture

Use two explicit directional routes managed by a small link coordinator:

```text
home bus A -- route A-to-B --> home bus B
home bus B -- route B-to-A --> home bus A
```

Conceptually each route has a source-side and destination-side endpoint. Each endpoint belongs to one bus boundary. Implementation does not need separate endpoint classes unless existing code makes them useful. Route data plus one coordinator is preferred over a generalized bridge framework.

The link coordinator is infrastructure, not a node. It has no home bus, semantic state, authority class, halt capability, ACK state, or retry state. It must not be modeled as an authoritative manifold node.

## Why a bridge route is required

Direct manifold attachment is sufficient when one node reads another bus through a non-home relationship. This design has a different goal: a source-bus word must become visible on the other home bus to all eligible destination-bus receivers. Republishing across bus identities is bridge behavior, even when implemented as a route inside a manifold coordinator.

## Route contract

Each directional route contains:

```text
route_id
source_bus_id
destination_bus_id
allowed_origin_node_ids
enabled
```

Initial implementation uses two fixed routes and two fixed existing bus IDs. Dynamic route mutation, discovery, and arbitrary multi-hop routing are excluded.

Requirements:

- Source and destination bus IDs differ.
- Route IDs are unique and non-empty.
- Reverse route is explicit; it is not inferred.
- Only registered, locally originated W1 words are eligible.
- Invalid W1 words fail before destination write.
- Imported words are never forwarded again.
- Duplicate `word_id` on one route is forwarded at most once.
- Disabled route forwards nothing.
- Route failure does not alter source-bus state.

## Word identity and envelope

Bridge transport preserves semantic word fields:

```text
fundamental_state
fundamental_request
state_age
request_age
origin node identity
origin bus identity
source authority class
word_id
origin timestep
```

Destination publication can add route metadata without changing W1 meaning:

```text
route_id
source_bus_id
destination_bus_id
bridge_hop
forwarded_at_timestep
```

The destination copy must not replace original `node_id` or origin bus identity with bridge identity. A bridge contributes no authority. Traveling through an authority-named bus cannot upgrade a word's authority.

## Storage and collision rules

- Local bus storage remains keyed by full origin node identity.
- A remote word cannot overwrite a destination-local node's word.
- Last-write-wins applies only to repeated writes from the same origin node in the same fundamental timestep.
- Repeated delivery of the same `word_id` on the same route is ignored.
- Different origins remain distinct even when W1 content is equal.
- Cross-node semantic equality remains unresolved; this design does not invent it.

## Clock and phase order

Both buses and both routes use one shared fundamental clock for this prototype. Independent clock domains are excluded.

One fundamental timestep executes deterministic phases:

1. Promote each bus's prior writes to readable state.
2. Read newly visible local-origin words eligible for each route.
3. Forward each eligible word once into the destination bus's current write set.
4. Run normal local-node publication for the current timestep.
5. Run eligible receives against current readable state.
6. Finish timestep and emit observational telemetry.

Existing G5 write visibility remains unchanged:

```text
T:   node publishes on home bus A
T+1: word becomes readable on A; route A-to-B writes it to B
T+2: forwarded word becomes readable on B
```

One bridge hop therefore adds one destination-bus visibility interval. The implementation must not expose the forwarded word on B at T or T+1.

## Bidirectional loop prevention

Two routes do not imply unrestricted re-forwarding.

The primary invariant is:

> Only words locally originated on a route's source bus can enter that route.

Therefore:

- An A-origin word can traverse A-to-B once.
- B-to-A must reject that imported A-origin word.
- A B-origin word can traverse B-to-A once.
- A-to-B must reject that imported B-origin word.
- Forward count remains bounded by eligible local-origin publications.

Route provenance includes `route_id` and `bridge_hop: 1`. Multi-hop route paths and hop counts greater than one are excluded from this slice.

## Dissemination and receive policy

One route action writes one destination-bus copy. The route does not perform a separate semantic send for each destination node. The destination bus exposes the word to its eligible attached nodes.

This prototype has no DIP mute behavior. All route-eligible words are forwarded. Node consumption can still be restricted by existing registration and relationship rules. Higher-authority mute law remains future G6 work and must not be approximated here.

## Failure behavior

- Invalid source word: reject forwarding; preserve source state; record failure observation.
- Unknown source node: reject forwarding.
- Wrong source home bus: reject forwarding.
- Missing destination bus: record route failure; do not ACK or retry.
- Duplicate route delivery: ignore duplicate; do not emit another destination publish.
- Telemetry failure: must not retract a completed destination write.
- One route failure: reverse route and unrelated local publishers continue.
- Clock stop: no later phase or extra timestep runs.
- Reentrant advance: reject or serialize according to existing clock contract; never overlap phases.

No failure gives an observer, route, or manifold coordinator halt authority.

## OpenTelemetry contract

Use the shipped isolated T2 provider.

Required observations:

```text
t2.scm.publish          source-bus publication
t2.scm.receive          source endpoint reads visible word
t2.scm.bridge.forward   route forwards source to destination
t2.scm.publish          destination-bus publication
t2.scm.receive          destination node reads visible word
```

Bridge-forward attributes:

```text
t2.scm.word_id
t2.scm.origin_node_id
t2.scm.origin_bus_id
t2.scm.source_bus_id
t2.scm.destination_bus_id
t2.scm.route_id
t2.scm.bridge_hop
t2.scm.origin_timestep
t2.scm.forwarded_at_timestep
```

Publish and receive observations retain existing G5 attributes. `word_id` correlates the path. No receive `SpanLink` is introduced. No global tracer provider or T3 trace payload is used.

## Minimal components

Prefer reuse over new framework:

1. Reuse `W1Word` and `checkW1Word` from G4.
2. Reuse or minimally extend `InProcessOpenLoopBus` from G5.
3. Add fixed `BridgeRoute` data.
4. Add one bidirectional link coordinator that executes both routes.
5. Add one injectable shared fundamental clock interface and manual test clock.
6. Add T2-owned bridge-forward observation helper.

Do not introduce dependency, generalized graph router, dynamic registry, persistent queue, or network transport.

## Acceptance tests

### Direction and visibility

- A publishes at T; B cannot read it at T or T+1; B reads it at T+2.
- B publishes at T; A cannot read it at T or T+1; A reads it at T+2.
- Both directions operate during same timestep sequence.
- Zero publications produce zero forwards.
- N locally originated words produce at most N forwards per direction.

### Identity

- Forwarded W1 content is unchanged.
- `word_id`, origin node, origin bus, authority, and origin timestep are preserved.
- Route metadata identifies direction without replacing origin.
- Remote origin cannot overwrite a local destination origin.

### Loop and duplicate safety

- A-origin word is not returned by B-to-A.
- B-origin word is not returned by A-to-B.
- Imported word is never re-forwarded.
- Duplicate `word_id` on one route does not create duplicate destination publication.
- Repeated timesteps do not cause unbounded publish growth.

### Admission and failure

- Unknown node is rejected.
- Node homed on wrong source bus is rejected.
- Invalid W1 is rejected before destination write.
- Disabled route forwards nothing.
- Missing destination creates no retry.
- Telemetry failure after write does not remove delivered word.
- Failure in A-to-B does not stop B-to-A or local publication.

### Clock

- One manual pulse advances one fundamental timestep.
- Multiple elapsed timesteps execute in order.
- No overlapping timestep execution.
- Stop prevents later forward or publish.
- One process interval can advance multiple fundamental timesteps without dropping any.

### Telemetry and boundaries

- Exactly one bridge-forward observation occurs per successful route delivery.
- Publish, forward, and receive observations share `word_id`.
- All spans use T2 provider.
- No ACK, retry, DIP, halt, codec, global tracer provider, or T3 trace output exists.
- G1B and completed G2-G5 downstream authorization fields remain unchanged.

## Non-goals

- Completing G6 or G8.
- G7 halt/freeze behavior.
- DIP mute configuration or authority-sensitive suppression.
- Independent clocks or clock-domain crossing.
- Dynamic routes or more than one hop.
- General manifold runtime or authoritative manifold node.
- Codec, byte, bit, nibble, dictionary, SocketCAN, or ISO-11898 behavior.
- Physical or external transport.
- Semantic parity claim.
- Live communication cutover.
- Push, release, or human attestation beyond the existing G1-G5 checkpoint.

## Authorization boundary

This design records intent only. Implementation requires explicit authorization for a bounded bidirectional home-bus prototype that touches G6 runtime-bus and G8 clock territory. Such authorization must not imply G6/G8 completion or authorize G7, G9, or G10.

## Completion evidence for the future implementation plan

Future plan must require:

- red tests before production changes;
- focused route, clock, G4, and G5 suites;
- G1-G3 regression suites;
- scoped TypeScript lint/type checks;
- `git diff --check`;
- independent completion review;
- explicit preservation of unrelated untracked Forge bridge files;
- no broad staging, commit, push, or PR unless separately authorized.
