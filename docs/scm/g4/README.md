# G4 W1 types (vertical slice)

Status: **completed**. Human-authorized G4/G5 slice. Does **not** authorize G6–G10.

T2-owned W1 type with ethos slots. Canonical absence is a named value. `state_age` and `request_age` are independent. Placeholders `modifier_start` and `null` have no wire numbers. W0 omitted request and single life counter are rejected. Unknown extra fields and encoding/dictionary keys fail closed.

Forbidden: nibble alphabet, codec, global dictionary, production encoding.

G1B / G2 / G3 `g4toG7Authorized` stays false. This slice uses the 2026-08-29 human execution directive, recorded here, not those flags.

README is explanatory. Not a reviewed-package digest.
