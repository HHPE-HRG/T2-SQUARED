# G9 Manager checklist

<!-- Agent: parent session acting as Manager. -->

## Before each unit

- [ ] Unit does not depend on an unanswered RFC that blocks it
- [ ] Open RFC count checked; if `> 10`, stop new units and present entire open queue to human
- [ ] Frozen inputs listed; Worker brief filled from `prompts/worker.md`
- [ ] Serial hotspot ownership recorded so two units do not collide

## After Worker returns

- [ ] Freeze proposal paths + hash / status snapshot
- [ ] Dispatch Reviewer and Planner in parallel with **identical** proposal text
- [ ] Neither prompt includes the other’s opinion

## After both verdicts

- [ ] Both Accept → mark unit `definition_closed`; update `definition-progress.md`
- [ ] Both Reject, compatible → merge REQUIRED_CHANGES → Worker revision → re-blind
- [ ] Conflict / Escalate → append RFC item to `rfc-queue.md`; set unit `rfc_blocked`; continue independent units
- [ ] Never invent an RFC answer

## RFC answers (Manager resolver)

- [ ] When an RFC is opened, answer it **in the same turn** (`manager_answer` + option); never leave `open` for a human
- [ ] Apply docs-only answers immediately; mark `applied` or leave `answered` if regen/impl required
- [ ] **No Worker/Reviewer/Planner redispatch** until the answered batch reaches **10** (then new batch starts)

## Never in this pass

- [ ] No `g9*.ts` runtime files
- [ ] No `authorization.md`
- [ ] No Effect patch / `server.ts` edits for G9 Layer
- [ ] No commit unless human asks
