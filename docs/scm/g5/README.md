# G5 open-loop prototype (vertical slice)

Status: **completed**. Human-authorized G4/G5 slice. Does **not** authorize G7–G10.
G6 DIP mute is authorized separately (`docs/scm/g6/authorization.md`); this G5
package still keeps `g6toG10Authorized: false` so G7–G10 stay locked.

In-process open-loop bus: one word per active node per **fundamental timestep**. Write at `T` readable at `T+1`. No delivery ACK. Unsatisfied request repeats without bumping `request_age`. Observed via existing T2 `withOwnedSpan` as `t2.scm.publish` / `t2.scm.receive` with option-2 `t2.scm.word_id`. Observation runs after write/read and does not admit. Global tracer provider identity unchanged. Does not write T3 `server.trace.ndjson`.

Forbidden here: halt (G7), clocks (G8), treating RPC success as satisfaction, “one word per tick”.
DIP mute is G6 work, not part of this G5 package.

README is explanatory. Not a reviewed-package digest.
