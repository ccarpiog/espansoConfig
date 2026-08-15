READINESS: NOT READY

### Instrument defects

1. Medium — `src-tauri/src/probe.rs:59-82,228-236,327-331,413-431,504-515`, **Claimed:** exactly three residual rebindings remain: source final component, temporary name after `create_new`, and an ancestor directory of the launch tree. **Actually true:** there is a fourth distinct residual. After `confined_source` returns the canonical source pathname, an ancestor unique to that pathname—most directly the `fixtures` directory—can be rebound before `std::fs::read(source)` resolves it again. “Ancestor directory of the launch tree” covers shared ancestors and the target side, but not `fixtures`, which is a sibling of `launches`. The temporary context mitigates severity but does not make the exhaustive three-item claim true. **Minimal fix:** describe the third category as an ancestor directory of either approved pathname, explicitly including `fixtures`, or list source-ancestor rebinding as a fourth residual everywhere the exhaustive list appears.

2. Low — `src/probe.ts:470-478,483-496`, **Claimed:** “Nothing here scrolls anything.” **Actually true:** the geometry reads do not scroll, but `scroller.scrollTop = held` can scroll the pane if its position changed during the awaited `say`. The following sentences acknowledge exactly that, so the corrected comment contradicts itself. **Minimal fix:** say that the reporter’s geometry reads do not scroll; the later write-back can restore a stale position and is not a guarantee.

### Prose defects

1. Medium — `docs/decisions/2c-5-5a-instrument-rebuild.md:535-554,940-962,1093-1111,1233-1267,1379-1384`, **Claimed:** the source-final-component, temporary-name, and launch-tree-ancestor cases are exactly all residual rebindings. **Actually true:** the record omits rebinding of a source-only ancestor such as `fixtures` between `confined_source` and `std::fs::read`. The reclassification is candid in principle but not exhaustive, so it is still a softened closure. **Minimal fix:** extend every exhaustive list to cover ancestor rebinding on either source or target paths and keep it “open and disclosed.”

2. Medium — `docs/decisions/2c-5-5a-instrument-rebuild.md:1077-1079`, **Claimed:** C06 measures the requirement that the source be a document directly inside `fixtures`. **Actually true:** C06 points the source outside the harness and measures only the “beneath `fixtures`” refusal. It does not exercise a nested regular file beneath `fixtures`, so the direct-child constraint at `src-tauri/src/probe.rs:352-358` is source construction, unmeasured. **Minimal fix:** split the label: beneath-root refusal measured by C06; direct-child shape closed by source construction, unmeasured.

3. Low — `docs/decisions/2c-5-5a-instrument-rebuild.md:85-90,265-269,627-637,793-799`, **Claimed:** the record consistently identifies the proof set. **Actually true:** §1 and §5.10 call nineteen launches the proof set—P37–P48, N07–N08, C05–C07 and C09–C10—while §4 says “P37–P48 are the proof set,” meaning twelve. The corrected total of sixty-six launches is arithmetically correct, but the sweep left this third count/label contradiction. **Minimal fix:** distinguish the twelve plan-proof launches from the nineteen-launch complete proof set consistently.

4. Low — `docs/decisions/2c-5-5a-instrument-rebuild.md:1450-1454`, **Claimed:** “The five above were closed.” **Actually true:** §§11.1–11.2 explicitly took the reclassification branch and withdrew guarantees while leaving pathname holes open. With the additional source-ancestor omission, even the disclosure is incomplete. **Minimal fix:** say the five findings were addressed, while the confinement holes remain open and disclosed; do not call withdrawn guarantees closed.

### Round-3 finding status

1. NOT CLOSED — the comments candidly disclose three holes but falsely present them as exhaustive, omitting source-ancestor rebinding.

2. PARTIALLY CLOSED — §§8.1, 9.1 and 10.1 withdraw the earlier overclaims and call Arm A partially closed, but repeat the incomplete three-residual taxonomy.

3. PARTIALLY CLOSED — per-item labels replaced the buckets, but C06 is wrongly credited with measuring the unexercised direct-child source constraint.

4. CLOSED — §6.1 now states a genuinely general time/corpus/predicate rule; §10.4 correctly says the narrower no-write rule reached §9.2 and §§4.4–4.5, while the wider rule reaches those plus §1’s chronology and scope cases.

5. CLOSED — every current `75 of 78` occurrence agrees, names the same three failures, and matches `78 − 3`.

### The four swept extra instances

1. CLOSED — the total is correctly sixty-six: 48 plan launches + 8 no-plan launches + 10 confinement launches. A separate proof-set count/label contradiction remains as noted above.

2. CLOSED — §5.10 now labels the digest row as the proof generation containing the nineteen-launch proof set plus discarded C08.

3. NOT CLOSED — `reportReach` correctly rejects the old guarantee but introduces the contradictory categorical statement that nothing in the function scrolls.

4. CLOSED — `startProbe` now explicitly identifies the writer’s no-plan refusal as an unmeasured Rust source property.

### Did the fix round create anything?

Yes. The reclassification created an exhaustive “exactly three” taxonomy that misses source-ancestor rebinding; §9.1’s new per-item label overstates C06; the `reportReach` rewrite says nothing in the function scrolls despite its `scrollTop` assignment; and §11.6 calls withdrawn guarantees closed.

I also swept the relevant shapes. The only discarded Rust results remain the two disclosed cleanup attempts. `dispatchEvent` was correctly judged a non-instance: all three constructed events omit `cancelable`, so `preventDefault` cannot make `dispatchEvent` return `false`. The `75 of 78` manifest count and the sixty-six-launch total are correct, but the twelve-versus-nineteen proof-set terminology is not.

Codex session ID: 01a004a8-b79f-7263-8c4e-8248b93d6288
Resume in Codex: codex resume 01a004a8-b79f-7263-8c4e-8248b93d6288
