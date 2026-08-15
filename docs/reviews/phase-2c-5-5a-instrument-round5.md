READINESS: NOT READY

### Instrument defects

1. Low — `src/probe.ts:487-495`, **Claimed:** after an intervening scroll, the `scrollTop` assignment “scrolls the pane, to a stale position.” **Actually true:** it attempts to restore the earlier numeric value and can scroll the pane, but need not. The value may be unchanged, or layout changes may clamp the old value to the current effective position. The reads themselves genuinely move nothing, and the write-back remains no guarantee. **Minimal fix:** say the write-back “can overwrite a newer position by attempting to restore the earlier value”; do not claim it necessarily scrolls or successfully restores.

### Prose defects

1. Low — `docs/decisions/2c-5-5a-instrument-rebuild.md:1587-1595,1675-1682`, **Claimed:** the write-back “would undo” an intervening scroll and “scrolls the pane whenever the position changed,” restoring a stale position. **Actually true:** assigning the held value can undo an intervening scroll, but it is not guaranteed to change the effective position because `scrollTop` is clamped against the layout existing at assignment time. The record has replaced one categorical claim with another. **Minimal fix:** consistently use “can attempt to restore the earlier position” and retain the statement that this guarantees neither preservation nor restoration.

2. Low — `docs/decisions/2c-5-5a-instrument-rebuild.md:871,1268,1731-1735`, **Claimed:** the two new terms are used consistently everywhere: “twelve plan-proof launches” and “nineteen-launch complete proof set.” **Actually true:** two current references remain outside that terminology: “its own nineteen-launch proof set” at line 871 and “all twelve proof launches” at line 1268. Their numbers make the intended sets recoverable, but §12.5’s exhaustive consistency claim is false. The arithmetic and membership themselves are correct: P37–P48 are twelve, and adding N07–N08, C05–C06, and C07/C09/C10 gives nineteen. **Minimal fix:** change line 871 to “nineteen-launch complete proof set” and line 1268 to “twelve plan-proof launches.”

### Round-4 finding status

1. CLOSED — independent enumeration finds exactly four residual classes: source final-component re-resolution; temporary final-name re-resolution; target/temporary-path ancestor re-resolution; and source-path ancestor re-resolution. There is no fifth: target final-component replacement does not follow a newly planted symlink, while every directory walked by the temporary is already part of the target-path ancestor case.

2. PARTIALLY CLOSED — the false “nothing scrolls” claim is gone and the geometry reads are correctly separated from the write, but the replacement now overstates that the write necessarily scrolls and restores.

3. CLOSED — the record’s exhaustive residual lists now contain all four cases and consistently leave them open and disclosed.

4. CLOSED — every §9.1 label now matches its evidence: C05/C09 measure only outside-launch-root refusal; C10 alone measures target shape; C06 measures only beneath-`fixtures`; direct-child source shape, plan gating, no-shell construction, and third-writer reuse are explicitly unmeasured source properties; C07 measures only a pre-existing temporary entry.

5. PARTIALLY CLOSED — the sets, membership, and 12 + 2 + 2 + 3 = 19 arithmetic are correct, but two references still use the old generic terminology despite §12.5 claiming consistent use everywhere.

6. CLOSED — §11.6 now says “addressed,” identifies §§11.1–11.2 as withdrawals, and keeps the four pathname holes open and disclosed.

The `drop(handle)` disclosure is correct. Rust’s `File` drop path cannot report a close error to this code. A successful checked `sync_all` is a genuine mitigation because it explicitly requests and observes prior data/metadata synchronization; it does not prove that close succeeded or eliminate every possible late filesystem error. Read as an acceptance rationale rather than a guarantee, the current disclosure is not overstated.

### The five swept extra instances

1. CLOSED — seventeen is correct: twelve plan-proof launches + two static controls + three adversarial controls reached `--- end`; N07 and N08 deliberately produced zero-byte transcripts.

2. CLOSED — §1 has four retained generations, while §5.10 has five binary digests because the round-0 generation used two binaries.

3. CLOSED — the record now consistently says five gate readings, including the initial reading plus four fix-round readings.

4. CLOSED — all three equality claims are bound to when the digest was read and distinguish the retained `0a2d3506…` bundles from the current `04988c09…` build-tree binary.

5. CLOSED — the `waitFor`, `enabledNamed`, `confined_target`, registration-arrangement, and temporary-name claims are properly narrowed. The discarded-result audit is also accurate: Rust deliberately discards only the two cleanup results; the swallowed close error is separately disclosed; all three events are non-cancelable; and the `void` IIFE’s truncated-transcript consequence is disclosed.

### Did the fix round create anything?

Yes. The `reportReach` correction created a narrower categorical guarantee: the write-back can scroll toward the previously read value, but does not necessarily scroll or successfully restore it. The proof-set terminology fix also created an exhaustive “used everywhere” claim while leaving two generic references behind.

I specifically swept every writer pathname resolution and spend, every §9.1 launch label, all proof-set terminology, the nineteen-launch membership and `--- end` arithmetic, the five binary/four generation count, discarded results, and §12’s distinction between closing a hole and widening its disclosure.

Codex session ID: 01a004c5-1bf9-7f01-ba00-2c63895b1d3d
Resume in Codex: codex resume 01a004c5-1bf9-7f01-ba00-2c63895b1d3d
