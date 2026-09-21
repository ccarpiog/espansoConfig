Reviewer: codex adversarial review

Codex adversarial review of the working tree at /Users/ccarpio/Developer/Utils/espansoConfig.
Codex verdict: needs-attention. 2 finding(s): 0 blocker(s), 2 should-fix.

VERDICT: ship-with-fixes; BLOCKERS: 2. Production ordering and capability checks hold up, but two gaps undermine the mounted lifecycle evidence.

- [SHOULD-FIX] medium · confidence 0.99 — /Users/ccarpio/Developer/Utils/espansoConfig/src/lib/components/AppShell.test.ts:300 — Failed cases leave mounted shells and pending registrations behind
    The teardown clears registration handles and resets counters without unmounting surviving shells or settling pending registrations. Any assertion failure before shell.stop() theref…
    Fix: Track mounted components before flushSync(), clean up failed mounts, and add unconditional teardown that unmounts survivors and settles outs…
- [SHOULD-FIX] medium · confidence 1 — /Users/ccarpio/Developer/Utils/espansoConfig/src/lib/components/AppShell.test.ts:111 — The listener mock makes the argument-count assertion vacuous
    The mock forwards only event and handler to listened, discarding any third argument supplied by the real adapter. Consequently, the assertion at line 331 cannot establish the claim…
    Fix: Spy directly on the mocked listen function or forward its complete argument list using rest parameters. Add a negative control demonstrating…

Scope: the working tree only — anything already committed for this phase was outside it.

VERDICT: ship-with-fixes
BLOCKERS: none
SHOULD-FIX: /Users/ccarpio/Developer/Utils/espansoConfig/src/lib/components/AppShell.test.ts:300 — Failed cases leave mounted shells and pending registrations behind — Track mounted components before flushSync(), clean up failed mounts, and add unconditional teardown that unmounts survivors and settles outs…
SHOULD-FIX: /Users/ccarpio/Developer/Utils/espansoConfig/src/lib/components/AppShell.test.ts:111 — The listener mock makes the argument-count assertion vacuous — Spy directly on the mocked listen function or forward its complete argument list using rest parameters. Add a negative control demonstrating…
NOT-VERIFIED: Fix both test-harness gaps and rerun the six mounted cases and their negative controls.
