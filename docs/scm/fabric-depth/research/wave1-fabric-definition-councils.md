# Wave 1 — Fabric definition research (4 isolated)

<!-- Agent: research wave only. Global cache written. Not authorization.
Confirmation wave reads cache + plan docs in a separate context. -->

- Date: 2026-10-19
- Size: **4** isolated councils; no peer findings
- Global cache: `docs/scm/fabric-depth/research/fabric-definition-cache.json`
  (mirrored to agent store `fabric-definition-cache.json`)
- Baseline: `origin/main` @ `8e96bbfb5`

## Ballot keys

| ID  | Lens                | CACHE_KEY                         |
| --- | ------------------- | --------------------------------- |
| R1  | seam / I/O          | `fabric.def.r1.seam-io`           |
| R2  | product / DoD       | `fabric.def.r2.product-dod`       |
| R3  | runtime / ops       | `fabric.def.r3.runtime-ops`       |
| R4  | vocabulary / radius | `fabric.def.r4.vocabulary-radius` |

## Condensed consensus (orchestrator; not a fifth vote)

“Fabric” is overloaded. Wave 1 separates:

1. **Seam surface (noun)** — inventoried S1–S7 activatable `comm_id`s inside frozen radius (R4).
2. **Bridge cutover (G10)** — authority selection via env-gated stack; live-proven; soft-fallback allowed; stubs may remain (R3 + G10 honesty).
3. **Fabric-depth (named campaign)** — real `manifoldEffect` I/O + soft-fallback retirement; new ceremony; never G11 (R1 + R2).

Agents must **qualify**: say **Fabric-depth** for the campaign; say **G10 bridge / cutover fabric** for Increment 6; say **fabric seams / radius** for the inventory noun.

Full JSON blobs: `fabric-definition-cache.json`.
