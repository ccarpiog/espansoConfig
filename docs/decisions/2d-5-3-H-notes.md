# Phase 2d-5-3-H — the round §7.1 commissioned for 2d-5-3-G's fix

**Risk class high; worker model `opus`.** No implementation worker: the phase's product is a review and
its fix, both taken by the orchestrator. Review:
[`docs/reviews/phase-2d-5-3-H.md`](../reviews/phase-2d-5-3-H.md). Verdict **`ship-with-fixes`, 0
blockers**, 5 SHOULD-FIX — 2 in source, 3 in the record. **All five were re-derived against the code by
the orchestrator before any fix was applied, and all five hold.**

**Round 8 of the `reconciliationCoordinator.ts` review tail.** Scoped to 2d-5-3-G's fix and to nothing
else: the two rewritten passages in `src/lib/browser/reconciliationCoordinator.ts`,
`docs/decisions/2d-5-3-G-notes.md` in full, and the four correction blocks that round added to
`2d-5-3-E-notes.md` and `2d-5-3-F-notes.md`. The brief carried the one instruction this tail keeps
being paid by — **check the comments against the code, not the code against the comments** — and it
found both source findings again.

**This round found a real defect in the previous round's fix.** Written with its derivation rather than
as a bare cardinal, which is what §3 and §4 below are about: 2d-5-3-G recorded *six of seven*, this
round adds one to each, so **seven of the eight rounds `2d-5-3-A` … `2d-5-3-H`** — and the denominator
is pinned by the letter sequence rather than by a hand count. 2d-5-3-G's own §8 already said the
header's closure prediction should be read as a wish rather than a figure; that reading is confirmed
once more.

**2d-5-3-G's nominated most likely defect was the wrong one, and that is worth recording.** It named
its first reading of the `WorkspaceSession` struct — the Rust six previous rounds had reasoned around.
That reading was **re-derived here and holds**: `Open` carries `workspace`, `backups` and `watcher`,
`reconciliation` sits beside the session, and its doc says the queue is *"emptied by a replacement
rather than replaced by one"*. What broke instead was the **prose built on top of** that correct
reading: a sentence about the same case that dropped its time index.

---

## 1. SHOULD-FIX (source) — the replacement claim is true only at an instant and was written as true now

**What the comment said**, written by 2d-5-3-G to close its own Medium 2:

> In case 2 the batch already *is* the incoming lifecycle's queue and Rust is still holding that
> lifecycle, so the property *"its `newest_sequence` really is a watermark for the lifecycle Rust is
> still holding"* is satisfied there outright — no second open is needed to arrange it, and none is
> claimed.

**What the code gives.** The claim holds at the instant the drain took the session lock and is not
guaranteed at the instant this arm evaluates it. Re-derived rather than accepted:

- `runOneDrain()` captures `const afterSequence = watermark;` and then `await host.drain(afterSequence)`.
  Everything from there on runs **after** the await, this arm included.
- Nothing gates `open()` on the drain. A further **successful** open in that window installs another
  lifecycle and — by the very Rust §2 of the previous round established — `begin_epoch` **empties** the
  one session-long queue and mints a new epoch. The batch's `newest_sequence` is then a watermark for a
  lifecycle Rust is no longer holding.
- That overlap is driven, not hypothetical: `src/lib/browser/workspace.test.ts`'s *"lets the newer open
  win, however late the older one answers"*, in a suite named **overlapping requests**, runs two
  overlapping `open()` calls — the same test 2d-5-3-G's own Medium 3 used to falsify an absence claim,
  one round earlier.

**The sentence this round replaced was the only one carrying the time index.** 2d-5-3-F's construction
— *"a case-2 batch followed by a **later** open refusing at `Workspace::discover(root)?`"* — was removed
as load-bearing on nothing, and it was; but it was also the clause that placed the property at a
**moment** rather than at the present. Removing it left an unqualified present-tense claim. **This is
not an argument for restoring it**: the construction really was unnecessary and really was unverified.
It is an argument that a removal has to check what else the removed clause was carrying.

**The conclusion of the paragraph is unaffected.** Its job is to show that a reader taking *"this one"*
as the property would find the enumeration short by a case, and that needs the property to hold at
*some* moment in case 2 — which it does.

**Fixed** in source. The passage now says *"at the instant the drain took the session lock … was
satisfied outright"*, states in as many words that the time index is the whole of the claim, and names
what this arm does **not** observe: whether a further successful open has landed in the await window.
The `workspace.test.ts` case is cited by its name so the claim has something a reader can go and look
at, which is 2d-5-3-E's Medium 1 applied rather than quoted.

## 2. SHOULD-FIX (record) — the section removed one unverified absence claim and asserted another in the next clause

`2d-5-3-G-notes.md` §2, one sentence after removing *"`open()` has no re-entrancy guard"* **for being
unverified**, asserts *"nothing has replaced that lifecycle since, so Rust is still holding it"*.

**Same absence, opposite sign, and no more evidence behind it.** *"No re-entrancy guard"* claims a
second open can arrive; *"nothing has replaced that lifecycle since"* claims none did. Both are claims
about what the code does not prevent, and §1 above shows the second is the false one. That the round
rejecting an unverified absence claim wrote its own in the next clause is the shape, not the sentence:
**an absence claim is not made safe by being the conclusion of a correction.**

**Fixed** in the record — a correction block on §2, carrying the time-indexed claim and saying the
section's conclusion survives. The paragraph is left standing with the correction attached rather than
rewritten, which is this chain's convention since 2d-5-3-F.

## 3. SHOULD-FIX (record, Low) — the section that retired the count asserts the count

`2d-5-3-G-notes.md` §4 says *"Counting production sites that assert the third state, this round gets
**eight**"* four lines above *"**No number is written down as the answer**"*, and above *"Writing
"eight" would be the sixth instance"* — having written it.

**That is a proposition and its negation inside one section, which is that round's own Medium 1**,
occurring in the section written to close the count defect. The correction block §4 produced on
`2d-5-3-E-notes.md` §7 carries the identical pair — *"gives **eight** in production"* against *"this
round asserts **no** figure"*.

**The ruling is the sound half and it stands.** The predicate is ambiguous, so the figure is a function
of the reader; the criterion problem is the finding. What did not survive contact is the prose: **a
figure offered as an illustration of an ambiguous predicate is still a figure the next round
inherits**, and this one was inherited within the same commit, from the E-notes block into §4.

**Fixed** in the record — correction blocks on `2d-5-3-G-notes.md` §4 and on `2d-5-3-E-notes.md` §7.
**Neither number is re-derived**, on the ruling itself.

## 4. SHOULD-FIX (record, Low) — three further uncounted counts, one of them demonstrably underived

2d-5-3-G's Low 2 was *"two fresh uncounted counts in the same commit"*. The commit carried more:

1. *"the **fifth** time this chain has recorded a count with no mechanism behind it"* (§4);
2. *"a **sixth** opening-words anchor"* (§7 item 5);
3. *"`PROGRESS.md` has now nominated a citation checker **five** times without one being built"*
   (§7 item 5).

**The third is checkable and does not hold up.** `docs/progress-archive/next-action-history.md` carries
the archived Next-action blocks of **2d-5-3-E** and of **2d-5-3-F**, and *both* say the checker has been
nominated *"four times"*; nothing between them and 2d-5-3-G records a further nomination. So *"five"* is
an increment with nothing behind it — the same defect as the replacement count, in the same section
that recorded the replacement count's defect.

**Why the round's own sweep missed all three.** It swept for *"three paragraphs"* — the words of its
Low 2 — rather than for the shape: **a bare ordinal or cardinal asserted about this chain's own
history**. That is `CLAUDE.md`'s standing rule, and this is a fresh instance of it inside the round that
quotes it.

**Fixed** in the record — a correction block on `2d-5-3-G-notes.md` §5, naming all three and writing
**no replacement figure**.

## 5. SHOULD-FIX (source, Low) — a citation over-claiming one of its two referents, and a newly ambiguous *"the paragraph above"*

**What the comment said**, in the second passage 2d-5-3-G rewrote:

> So the queue half is **asserted by the paragraph above and rested on by nothing here**: … the
> paragraph below and the one opening *"Which lifecycle the batch describes"* both say the refusal rests
> on unattributability instead.

Two defects, both re-derived:

- **The citation over-claims about one referent.** The paragraph below (*"What makes the refusal right
  in all three is that nothing here can attribute the number"*) does say the refusal rests on
  unattributability. The paragraph opening *"Which lifecycle the batch describes"* says only that the
  lifecycle *"is not knowable here, and the refusal does not need it to be"* — that the refusal does not
  **need** attribution, which is weaker than resting on its absence. *"Both say"* is false of the pair.
- **`the paragraph above` became ambiguous in this round's own rewrite.** Before it, one paragraph
  above asserted the property (the one opening *"A third state is neither of those"*). The case-2
  sentence this round wrote asserts it too, so the phrase now has two referents and the reader cannot
  tell which.

**Fixed** in source. The sentence now names both asserting sites by their opening words rather than by
position, says why it names them, and splits the two justification paragraphs so each is cited for what
it actually says.

---

## 6. Verification

**All four gates run in full by the orchestrator on the inherited tree, and the three the fix can move
re-run after it.** `1320 / 441 / 2307 / 188` — `cargo test --workspace` / `npm run check` files /
`npm test` / `npm run build` modules. The figures are the ladder's, unmoved, and they could not have
moved: the source diff is **comment-only in one file**.

- `cargo test --workspace -- --test-threads=1` — the authoritative serial form on this host — redirected
  to a file, **never read through a pipe**, exit 0. **26** `test result` lines summing to **1320**, and
  the complementary question asked as well: **no line lacking `0 failed`**. The three consequences of
  the host scar were all followed.
- `test watch_check::a_failed_reopen_keeps_the_previous_watcher_watching ... ok` is present in the
  transcript. That is the citation the untouched part of this comment block rests its workspace half on,
  and a citation naming a test that does not run is the defect a later round would find.
- `cargo clippy --workspace --all-targets -- -D warnings` exit 0; `cargo fmt --check` exit 0;
  `cargo tree -p espansoconfig-core | rg tauri` finds nothing.
- `npm run check` → **441 FILES 0 ERRORS 0 WARNINGS**. `npm test` → **60 files, 2307 passed**, exit 0.
  `npm run build` → **188 modules transformed**.
- **Both bundle oracles read, and both lines reported**, the second because it proves the search can
  match at all: server-only markers (`$$payload|head_payload|push_element`) **absent**; client-only
  markers (`window.__svelte|svelte-trusted-html`) **present, 2**.
- **The diff is comment-only, proven mechanically rather than by eye**: `git diff -U0` filtered to
  changed lines that are neither comment lines nor blank returns nothing.
- **No line in the edited file exceeds 90 characters**, checked with `awk`, because 2d-5-3-C shipped a
  112-character line that nothing in this repository catches.
- **The instrument's pin holds** at `5 insertions(+), 1 deletion(-)` across `src-tauri/src/main.rs` and
  `src/main.ts`, checked before the fix and again after it.

**`cargo test` was run rather than inferred, and this round has a sharp excuse not to.** No Rust source
changed, and the phase touches one TypeScript comment. A high-risk phase is not the place to infer a
gate; the six hours of iteration budget were not a reason to weaken it either.

**No gate in this project reads prose.** Four green figures are evidence about code and evidence about
nothing this round changed — which is why the reviewer's `NOT-VERIFIED` list opens with them, and why
that is the correct thing for it to have written rather than a gap.

## 7. Where it is thin

Marks per `CLAUDE.md` §7.3. **No item here commissions a round** — §7.1 does that, and it reads a diff.

1. **The new time index is prose and nothing pins it — *recorded only*.** *"At the instant the drain
   took the session lock"* is checkable by reading `runOneDrain()`, and no test fails if a later round
   drops it again. The class this tail keeps finding is exactly a dropped qualifier.
2. **The overlapping-open case still drives no Rust — *recorded only*, unchanged from 2d-5-3-G §7
   item 2.** `workspace.test.ts` uses `scriptedCommands()`, so what the new citation pins is the
   frontend's behaviour under two opens, never `WorkspaceSession::open`'s. The comment cites it for what
   it drives and no more, but a reader could still take it as Rust coverage.
3. **The queue half is still pinned by nothing — *recorded only*.** A documentation-coverage bound, as
   2d-5-3-G correctly reclassified it. §7.3 holds no step open for it.
4. **2d-5-3's able-to-fail residue (2d-5-3-D §8 item 4) is still unreproduced — *actionable*, and not a
   correctness defect in source.** 2d-5-3-G recorded *four consecutive rounds* clearing none of it and
   this round clears none either, so the figure is **five** by that increment and by nothing else. The
   statement that does not depend on it: **no round of this tail has had the residue in scope**, because
   §7.1 sets each round's scope from the previous fix's diff rather than letting a round choose.
5. **The citation checker is still unbuilt, and this round declined to state how many times it has been
   nominated — *recorded only*.** §4 above is why. What is true without a figure: `PROGRESS.md` and
   these notes have nominated it repeatedly, two archived blocks say *"four times"*, one says *"five"*,
   and nothing derives either. This round added **no** new opening-words anchor beyond naming *"A third
   state is neither of those"*, which was checked and resolves uniquely.
6. **`commands.rs` beyond the three items this tail has read is still unread — *recorded only*,
   unchanged from 2d-5-3-G §7 item 6.** `WorkspaceSession::open`, `drain_external_changes` and the
   `reconciliation` field have been read. What else these comments describe without anyone having opened
   it is not known, and this round read no new Rust.
7. **This round's own most likely defect: §5's split of the two justification paragraphs.** It asserts
   that *"the refusal does not need it to be [knowable]"* is **weaker** than *"the refusal rests on
   unattributability"*. That is a reading of two English sentences, not of code, and no gate and no test
   can separate them. If a later round decides they say the same thing, the source fix is over-precise
   rather than wrong — but it would be the third consecutive round to correct this sentence.

---

## 8. §7.1 — a round is commissioned

**The fix changed one source file**, `src/lib/browser/reconciliationCoordinator.ts`, comment-only, proven
mechanically. Two of the five findings were fixed there (§1 and §5); the other three are record-only.
Under `CLAUDE.md` §7.1 a fix round that changes at least one source file is owed a review round, whatever
the severity that prompted it, so:

**Phase 2d-5-3-H is `SUPERSEDED BY 2d-5-3-I`, never complete.**

**Nothing is `BLOCKED`.** No item in §7 names an unfixed correctness defect in a source file: items 1,
2, 3, 5, 6 and 7 are *recorded only*, and item 4 is *actionable* but is a coverage residue rather than a
defect in source, exactly as the four rounds before it recorded.

**No prediction about closure is written here.** The header of `PROGRESS.md` has now made one for five
rounds running and been wrong every time, always in the same direction. What the mechanism guarantees is
narrower and is the only thing worth writing down: **the first fix round of this tail that changes no
source file is its last**, and nothing in this round's diff says whether the next one will be that.
