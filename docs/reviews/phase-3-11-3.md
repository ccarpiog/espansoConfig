Reviewer: codex adversarial review

Codex adversarial review of the working tree at /Users/ccarpio/Developer/Utils/espansoConfig.
Codex verdict: needs-attention. 2 finding(s): 0 blocker(s), 2 should-fix.

Correct the evidence record before closing the phase. The partial success is substantiated, but Spanish capture citations and the unread-row closure justification are not.

- [SHOULD-FIX] medium · confidence 1 — docs/decisions/3-11-3-window-reading.md:134 — Spanish option coverage is credited to captures that omit those controls
    L02 c20 has already scrolled to propagate_case despite its s06 badge; c26 also shows the lower controls. Neither shows word, left_word or right_word, so this pair cannot substantia…
    Fix: Use the verified L02 c18 capture for the first three controls and word Mixed, retaining c20 for the lower controls. Update the coverage tabl…
- [SHOULD-FIX] medium · confidence 0.99 — docs/decisions/3-11-3-notes.md:114 — The unread-row exemption explicitly excludes this phase
    The cited 2d-7 ruling, entry 37, explicitly says its scope reaches 'forward to nothing outside 2d-7'. It therefore cannot justify the blanket conclusion that this phase's unread ro…
    Fix: Remove the out-of-scope waiver, correct the reasons for unread rows, and assess them against Phase 3's actual acceptance requirements. Recor…

Scope: the working tree only — anything already committed for this phase was outside it.

VERDICT: ship-with-fixes
BLOCKERS: none
SHOULD-FIX: docs/decisions/3-11-3-window-reading.md:134 — Spanish option coverage is credited to captures that omit those controls — Use the verified L02 c18 capture for the first three controls and word Mixed, retaining c20 for the lower controls. Update the coverage tabl…
SHOULD-FIX: docs/decisions/3-11-3-notes.md:114 — The unread-row exemption explicitly excludes this phase — Remove the out-of-scope waiver, correct the reasons for unread rows, and assess them against Phase 3's actual acceptance requirements. Recor…
NOT-VERIFIED: Correct both records' capture references and unread-row dispositions before marking the phase closed.
