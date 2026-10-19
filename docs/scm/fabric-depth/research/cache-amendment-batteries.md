# Cache amendment — batteries charter close (2026-10-19)

<!-- Agent: steward amendment to Wave 1 cache. Does NOT rewrite R1–R4 ballots. -->

- Date: 2026-10-19
- Parent cache: `fabric-definition-cache.json`

## Amendments (locks applied)

1. Unlock flag name: `fabricDepthAuthorized` in `docs/scm/fabric-depth/manifest.json`
2. Process env: `T2CODE_SCM_FABRIC_DEPTH` (distinct from G10 cutover)
3. Soft-fallback signal: `g10.softFallback` = `active` \| `retired` per S1–S7;
   post-exit emits `active` even when `inversionArmed`; rollback must re-emit
   `active`; home-bus omits field
4. Speech: bare “fabric” banned; use fabric seams / G10 bridge / Fabric-depth
5. Census artifact: `evidence/manifold-io-census.json` gates Ordered depth exit
6. Bridge purity + ownership restated in design/glossary/planning-scope

Wave 1 open questions addressed by these locks remain binding for ceremony.
