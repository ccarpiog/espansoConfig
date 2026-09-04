# Phase 2d-5-2a-C — the three fixes review 3 of Phase 2d-5-2a-B returned, applied

**Status: implemented; its own review is what closes it.** Phase 2d-5-2a-B applied the three findings
of review 2, and its own adversarial review
([`docs/reviews/phase-2d-5-2a-B.md`](../reviews/phase-2d-5-2a-B.md)) returned **`ship-with-fixes`,
0 blockers, 3 should-fix**. Those three were deliberately not applied inside 2d-5-2a-B, so that what
was committed there is exactly what was reviewed. **This phase applies all three, and nothing else.**

**Every change in this phase is a comment or a record.** One source file changed —
`src/lib/browser/writeSurfaceRegistry.ts` — and every added and removed line in it is a `//` comment
line. No executable line was touched anywhere: nothing under `crates/` or `src-tauri/` changed, no
`.svelte` file changed, no module was added, no test was added or changed, and **no user-facing string
was added**. The only string this phase's subject matter produces is the registry's `TypeError`
message, which is a programmer's and which nothing renders, so the i18n rule is not engaged.

**The bar this phase was set was not "apply three fixes" but "apply three fixes without creating a
fourth instance".** Each of the two preceding phases created a finding while fixing one, and review
3's finding 1 is the sharpest case: review 2's finding 3 was *about* stale citations, and the fix
answering it wrote a fresh off-by-one. So every citation below — including the ones this phase's own
edit moved — was re-derived by reading the post-edit tree, and §6 says exactly how. §5 records the
three places where the reviewer's own wording does not survive re-derivation, because the last two
phases each found the reviewer wrong about something and the next reader should not inherit it.

---

## 1. Files

| File | What changed |
|---|---|
| `src/lib/browser/writeSurfaceRegistry.ts` | finding 2: the last sentence of `replaceTarget`'s comment, which stated of the whole old re-entry route something true only of one case on it. The rewrite occupies `:555-568`; the comment it sits in runs `:538-568`. **Comment only** (597 → 605 lines) |
| `docs/decisions/2d-5-2a-A-notes.md` | finding 1: a correction block in §3.1, under the 2d-5-2a-B correction block that carries the off-by-one |
| `docs/decisions/2d-5-2a-B-notes.md` | finding 1 (a correction block in §4.1), finding 3 (a correction block in §2.3), and a correction block under §1's table for the two citations **this phase's own edit moved** |
| `docs/decisions/2d-5-2a-C-notes.md` | this record |

`src/lib/browser/workspace.svelte.ts` is **not** in that list: finding 1 is record-only, and the
numbers it corrects describe a file this phase does not touch. It is unchanged at 3 730 lines, so
every `workspace.svelte.ts` citation in the earlier records is as true after this phase as before it.

**No window reading is owed or was taken.** No component, markup, prop or reactive statement exists in
either file that changed, exactly as at 2d-5-2a, 2d-5-2a-A and 2d-5-2a-B.

---

## 2. Finding 1 — the off-by-one, and the end nobody had checked

### 2.1 What the records claimed

`docs/decisions/2d-5-2a-A-notes.md` §3.1 (inside 2d-5-2a-B's own correction block) and
`docs/decisions/2d-5-2a-B-notes.md` §4.1 both said *"the replacement comment block runs
`:1690-1721`"*. That block is the one that replaced the pre-fix comment `2d-5-2a-A-notes.md` cites as
`workspace.svelte.ts:1683` — a citation both records deliberately leave pointing at `15ada19`.

### 2.2 Re-derived, both ends

Derived by `rg -n` for the block's own first sentence and by reading the lines around it, on the tree
this phase leaves:

| What | Line | The line itself |
|---|---|---|
| First line of the block | **1689** | `// **Every write surface this window has told this state about** — Phase 2d-5-2a.` |
| Last comment line of the block | **1721** | `// step that writes components rather than here.` |
| The declaration it introduces | **1722** | `const writeSurfaces = createWriteSurfaceRegistry();` |

**The block is `:1689-1721`.** The start is off by one in both records, as the review says. **The end
was re-derived rather than accepted** — the brief for this phase noted that nobody had checked it —
and it derives to 1721, which is what was already written. Reporting a checked figure that agrees with
an unchecked one is the point of checking it.

Two figures in the same neighbourhood were re-read while the lines were open. *"the direction taken
here is the safe one"* is at **`:1703`**, as review 3's own "not verified" paragraph reports.
`15ada19:src/lib/browser/workspace.svelte.ts:1683` is *"// the safe one costs nothing, because a
workspace that has really been replaced"*, which is what makes `:1683` a correct citation of pre-fix
text rather than a stale one.

### 2.3 What changed for it

**No source.** Two correction blocks, one in each record, each giving the corrected range **and** the
text at both of its ends, so that a reader who inherits a shifted file can tell whether the number is
still the line.

---

## 3. Finding 2 — the source fix: what the old `kind` route actually answered

### 3.1 What the comment claimed

`writeSurfaceRegistry.ts`, on `5ec011e`, said of the ordering that `replaceTarget` replaced:

> That one had no read of `target.document` at all; its own re-entry route was a `kind` accessor on
> the caller's retained surface — gone, now that the stored surface is this module's frozen copy —
> and on that route it answered `staleLease` for a lease that was live.

The last clause is stated of **the route**. It is true of one case on that route.

### 3.2 The two routes, re-derived from both modules

Both statements below were derived by reading the two modules, not by re-running 2d-5-2a-B's
out-of-repository harness (which §6 item 2 of that record already marks as unreproducible here).

**Old (`git show 15ada19:src/lib/browser/writeSurfaceRegistry.ts`).** `registerWriteSurface` read
`surface.kind` (`:365`) and then stored the caller's object itself (`:368` —
`live.set(kind, { serial, surface, transition })`). `replaceTarget` checked the lease (`:399`), built
the new surface with `withTarget(held.surface, target)` (`:410`, and `withTarget` is `:302-309`), and
checked again (`:411` — `if (heldBy(kind, serial) !== held) {`). `withTarget` reads `surface.kind` off
that retained object, so **the single caller-supplied read old `replaceTarget` took was a `kind`
accessor**, and it sat between the two checks. The substring `.document` does not occur anywhere in
that file — `git show 15ada19:… | rg -n '\.document'` exits 1 with no output, re-run here.

**New (shipped).** The stored surface is this module's own frozen copy (`ownedSurface`, `:423-434`,
via `ownedDocumentSurface`, `:388-396`, both `Object.freeze`), so `held.surface.kind` is a data
property and cannot re-enter. The one caller-supplied read is `target.document` (`:573`), and it is
taken **before** the single check (`:574`).

### 3.3 What each re-entry answered, under each ordering

Each row is a re-entry performed by whichever accessor that ordering actually runs — the old one's
`held.surface.kind`, the new one's `target.document`. "Truthful" asks only whether `staleLease`
described a lease that had really stopped naming the live entry.

| The re-entry | Old (`15ada19`) | New (shipped) |
|---|---|---|
| `registerWriteSurface` of **this** kind | outer `staleLease` — **truthful**: the new serial really displaced this lease. Generation +1, the inner registration live | outer `staleLease` — **truthful**, same reason. Generation +1, the inner registration live, and this call wrote nothing |
| `registerWriteSurface` of a **different** kind | outer `replaced`; `heldBy` still answers the same entry object, so neither check fires. Generation +2 | outer `replaced`; the serial is untouched. Generation +2 |
| `replaceTarget` on **this** lease | outer `staleLease` — **untruthful**: the serial was unchanged and the lease still named the live entry; only the entry *object* had been swapped, and the removed second check compares object identity. Generation +1, **the inner call's target installed** | outer **and** inner both `replaced`; the outer finished last and wrote over the inner. Generation +2, **the outer's target installed** |
| `unregister` on **this** lease | outer `staleLease` — **truthful**: the entry is gone. Generation +1 | outer `staleLease` — **truthful**. Generation +1 |

**So exactly one row made the old `staleLease` untruthful, and it is the same-lease `replaceTarget`
row.** On the two rows that answer `staleLease` for a registration or an unregistration, the old code
was right, and the comment said it was wrong. That is the finding, and re-derivation confirms it in
the direction the reviewer states.

**Row 2 is a scope the reviewer's sentence omits.** *"a re-entrant registration … took a new serial"*
is true only of a registration **of this kind**; one of a different kind takes a new serial that this
lease never consults, and the answer is `replaced`. The rewritten comment says *"of this kind"*.

**The second check the new ordering removed is not protection the new ordering lost.** Row 4 is what
that check existed for — without it the old outer call would have written an unregistered entry back
into the map — and the new ordering catches the same case by moving its single check *after* the
caller-supplied read instead of by taking two.

### 3.4 What changed for it

**No behaviour.** The ordering shipped at 2d-5-2a-A stays and its argument is unchanged. What changed
is the comment's last sentence (`:555-568`), which now states which case it is about: a re-entrant
same-lease `replaceTarget` kept the serial and swapped the entry object, so the old code answered
`staleLease` for a lease that was still live and left the inner call's target installed; a re-entrant
**registration of this kind** through the same accessor took a new serial, so there the old
`staleLease` was correct.

### 3.5 What the fix does not force

**It is a comment, and nothing reads it.** No test can fail for a false sentence in it: the i18n
suites check key parity and placeholder agreement, and no suite reads a doc comment at all.

**Nothing in TypeScript stops a caller supplying an accessor in the first place.**
`WriteSurfaceDocumentTarget.document` is declared `readonly` (`src/lib/browser/restore.ts:379`), which
forces that no code assigns through that property name and does **not** force the property to be a
data property — so the read at `:573` may still run arbitrary code, and what makes that safe is the
ordering, checked by the accessor cases in `writeSurfaceRegistry.test.ts`, not a type.

**The row-3 derivation assumes a re-entry that returns.** Old `replaceTarget` reads
`held.surface.kind` a second time inside the inner call's own `withTarget`, so an accessor that
re-enters unconditionally recurses rather than answering anything; the row describes an accessor that
re-enters once. §7 item 2 records that.

---

## 4. Finding 3 — "share no re-entrancy route", scoped

### 4.1 What the record claimed

`docs/decisions/2d-5-2a-B-notes.md` §2.3: *"So the two orderings share no re-entrancy route."*

### 4.2 Re-derived

**True of `replaceTarget`, false of the modules.** Both read `surface.kind` off the caller's object in
`registerWriteSurface`: `15ada19:src/lib/browser/writeSurfaceRegistry.ts:365` and the current file's
`:503`, each of them `const kind = surface.kind;`, each read on the tree it belongs to rather than
inferred from a diff. That is a shared re-entrancy route, and it is the route
`writeSurfaceRegistry.test.ts`'s kind-drifting cases drive.

**And the new module's registration route is wider, not merely shared.** It also reads
`surface.target` (`:504`) and, inside `ownedSurface`, that target's `kind` and — on the document arm —
its `document`. Old `registerWriteSurface` read `surface.kind` and nothing else. So the honest
statement is not "they share one route" but "they share `surface.kind` at registration, and the new
module takes three more caller-supplied reads there".

**The paragraph's conclusion survives unscoped.** A sentence of the form *"the same answer as the old
ordering"* still has to say which route it means, because the two `replaceTarget` routes really are
disjoint: the old one's is `held.surface.kind` and the new one's is `target.document`, and the old
module contains no `.document` read at all.

### 4.3 What changed for it

**No source.** A correction block on §2.3 giving the scoped sentence, both citations and the wider-not-
shared observation.

---

## 5. Where the reviewer's own wording is imprecise

The three findings are **right in their conclusions** and all three are applied. Three details do not
survive re-derivation and are recorded so the next reader does not inherit them:

1. **Finding 2's citation `:555-557` does not contain the words it quotes.** On `5ec011e`, `:555-557`
   ends at *"the caller's retained surface — gone, now that the stored surface is this"*; the quoted
   clause *"and on that route it answered `staleLease` for a lease that was live"* is at `:558-559`,
   and the sentence runs `:555-559`. The finding is about that sentence and names it unambiguously by
   quotation, so this is a range that undershoots, not a wrong target.
2. **Finding 2 says "a re-entrant registration" where the true claim is "of this kind".** A
   re-entrant registration of a *different* kind never touches this lease's serial and the old code
   answered `replaced` (§3.3 row 2). The rewritten comment carries the narrower wording.
3. **Finding 3's "which is a shared route" understates the difference in the safe direction.** The new
   `registerWriteSurface` takes three caller-supplied reads the old one did not (§4.2), so the
   registration route is wider in the new module rather than identical in both.

The reviewer also notes, under *"judged, not a finding"*, that a re-entrant `unregister` is a third
case the `replaceTarget` comment does not name. This phase did not add it to the comment's
**new-ordering** paragraph, because that paragraph claims no exhaustiveness and the review says so in
as many words; §3.3 row 4 carries it here instead. Nothing in this phase changes what that paragraph
says.

---

## 6. How every citation in this phase was verified

This chain's recurring defect is a citation that was transcribed rather than derived, so the method is
recorded rather than asserted:

1. **Every line number was produced by `rg -n` or by an `awk`/`sed` read that prints the line number
   beside the line**, on the working tree, and the line's own text is quoted beside the number in the
   correction blocks wherever the number could go stale.
2. **Historical numbers were read out of the commit they belong to**, with
   `git show 15ada19:src/lib/browser/writeSurfaceRegistry.ts | awk '…'` — never by counting a diff.
   `:302-309`, `:365`, `:368`, `:399`, `:410` and `:411` were all obtained that way.
3. **The one source edit in this phase moves line numbers, and the citations it moved were found and
   corrected rather than left.** `2d-5-2a-B-notes.md` cited the `replaceTarget` comment as `:538-560`
   in two places (§1's table and §2.5) and the module as 597 lines. After the edit the comment is
   `:538-568` and the module is 605 lines; a correction block under §1's table says so and names both
   occurrences. Found by an `rg -n` sweep for `writeSurfaceRegistry.ts` followed by a line number,
   over the four records of this chain and `PROGRESS.md`, not by memory.
4. **Every other citation in `2d-5-2a-B-notes.md` was re-read on the post-edit tree** and is unmoved:
   `:241-250`, `:258-260`, `:412-416`, `:421`, `:495-502` and `:106-120` in the registry (all before
   the edited region), and `:1477-1530`, `:1502-1514`, `:1520-1525` and `:3210-3217` in
   `workspace.svelte.ts` (an untouched file).

   **Correction (2026-09-04, review 4 finding 2).** This item said *"in `2d-5-2a-B-notes.md` §1's
   table"*, which misattributes one entry: `:3210-3217` is cited at `2d-5-2a-B-notes.md:167`, in **§3**
   rather than in §1's table. The sweep really was over the whole file, so the list is right and only
   its stated scope was wrong. **The two scopes are deliberately not the same**: the correction block
   at `:41-43` lists only §1's table's three ranges, because those are the ones this phase's `+8`
   lines staled, while this item reports the wider re-read that found nothing else moved.
5. **The final pass was run after the last edit**, including the wording change in §3.4's comment that
   itself sits inside the edited block, and it re-confirmed `:538`, `:555`, `:568`, the 605-line count
   and the 3 730-line count.

What none of this forces: **nothing in this repository fails when a citation goes stale.** No gate
reads a line number in a Markdown file, and the four run below would pass over every number in this
record being wrong. §7 item 1 marks that.

---

## 7. Where it is thin

Marked per `CLAUDE.md` §7.3. **No item here commissions a review round** — §7.1 is the only mechanism
and it reads a diff. **No item names a correctness defect in a source file**, so none is a blocker and
none holds this step open.

1. **Nothing mechanically checks a citation — *recorded only*.** Every number in every record of this
   chain is held by a human or an agent having read the line, and the third fix in a row to a citation
   is evidence about how well that holds. A checker would be a source file and a new gate, which is a
   phase decision and not this phase's scope. It names no wrong line, so it is not actionable.

2. **§3.3 row 3 describes an accessor that re-enters once — *recorded only*.** Old `replaceTarget`
   reads `held.surface.kind` again inside the inner call, so an accessor that re-enters every time it
   is read does not terminate and answers nothing. Both this record and 2d-5-2a-B's §2.4 row 3 are
   about a re-entry that returns. This is a limit of the derivation, not a defect in either module —
   the shipped **`replaceTarget`** has no `kind` route, because the surface it reads is this module's
   own frozen copy rather than the caller's object.

   **Correction (2026-09-04, review 4 finding 1).** The sentence above said *"the shipped module has
   no `kind` route at all"*, and that is false of the module. `registerWriteSurface` still reads
   `surface.kind` from the **caller's** object at `writeSurfaceRegistry.ts:503`, exactly as §4.2 of
   this file (`:176-179`) already said, so a `kind` accessor can still re-enter there. What the
   shipped module removed is narrower: a `kind` accessor can no longer make a **held lease observe
   itself stale**, which is the only route this row is about. **This is a fourth occurrence of the
   very shape finding 3 named — a sentence true of a narrow case written as though true of the
   module — and it occurred inside the record written to fix it.** It is recorded rather than quietly
   reworded because that recurrence is the most useful thing this phase measured.

3. **Rows 2 and 4 of §3.3 are derived and not pinned by a committed case — *actionable*, and not a
   correctness defect.** `writeSurfaceRegistry.test.ts:520-544` pins row 1 of the new column. Nothing
   pins a re-entrant registration of a *different* kind, or a re-entrant `unregister` from a
   `target.document` accessor. Adding either is a source change and this phase's scope bound is
   comment-only. It names a coverage gap in a test file, not a wrong line in source, so a later phase
   may adopt it; 2d-5-2b is the natural place, and 2d-5-2a-B's §6 item 1 already nominates the same
   suite for row 3.

4. **Two historical citations in `2d-5-2a-A-notes.md` remain unverified — *actionable*, a defect in
   the record at worst, and inherited unchanged.** `:41` cites `writeSurfaceRegistry.ts:245-249` and
   was never checked against anything; this phase's edit is below that region and does not move it,
   but it also does not confirm it. `:161`'s `workspace.svelte.ts:1683` was checked against `15ada19`
   by 2d-5-2a-B and re-read here. Neither names source, so neither blocks.

5. **The comment this phase rewrote is unread by anything — *recorded only*.** §3.5 is the whole of
   it: no test, no type and no gate can fail for a false sentence in a comment, and the four gates
   below would pass whether the new sentence is true or false. The evidence that it is true is §3.3,
   which is a derivation by the author of the change until a review re-derives it.

6. **Nothing in this repository registers a surface — *recorded only*, inherited unchanged from
   2d-5-2a, 2d-5-2a-A and 2d-5-2a-B.** Every re-entrancy case above is reachable only from a test.
   Whether a real host ever supplies an accessor is 2d-5-2b's mounted evidence.

7. **These corrections were not reviewed when they were written — *recorded only*.** §7.1 owes this
   phase's one source change a round, and that round is this phase's own review. Until it has run,
   everything above is a claim by the author of the change — including the claim that a sentence
   which was wrong is now right, which is what the two preceding phases each said before the next
   review found a fresh instance.

---

## 8. The gates, measured

Every command was run **on its own**, never chained. The baseline this phase inherits is
**1320 / 438 / 2235 / 186**, and a comment-only change should move none of them.

| Gate | Result |
|---|---|
| `git diff --stat HEAD -- crates/ src-tauri/` | empty — no Rust file touched |
| `cargo test --workspace` | pass, **1320** tests |
| `cargo clippy --workspace --all-targets -- -D warnings` | pass, no warnings |
| `cargo fmt --check` | pass, no output |
| `cargo tree -p espansoconfig-core \| rg tauri` | **no match** — the architecture rule holds |
| `npm run check` | **438 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS** |
| `npm test` | **2235** passed |
| `npm run build` | **186** modules transformed |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | **no match** — the server build did not leak in |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | **2** — the discriminating half of the oracle can match, so the negative above is not vacuous |

Both bundle oracles were run, not only the negative one, for the reason `CLAUDE.md` §4 gives: a
negative with no positive control beside it is empty.
