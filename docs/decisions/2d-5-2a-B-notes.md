# Phase 2d-5-2a-B — the three fixes review 2 of Phase 2d-5-2a-A returned, applied

**Status: implemented; its own review is what closes it.** Phase 2d-5-2a-A applied the three findings
of 2d-5-2a's review, and its own adversarial review
([`docs/reviews/phase-2d-5-2a-A.md`](../reviews/phase-2d-5-2a-A.md)) returned **`ship-with-fixes`,
0 blockers, 3 should-fix**. Those three were deliberately not applied inside 2d-5-2a-A, so that what
was committed there is exactly what was reviewed. **This phase applies all three, and nothing else.**

**Every change in this phase is a comment, a doc comment or a record.** No executable line was touched:
`git diff HEAD` over the two source files contains no added or removed line that is not a `//` comment,
a `*` doc-comment line or a blank line inside one. Nothing under `crates/` or `src-tauri/` changed
(`git diff --stat HEAD -- crates/ src-tauri/` is empty, and §5 runs the Rust suite anyway), no
`.svelte` file changed, no module was added, no test was added or changed, and **no user-facing string
was added** — the only string this phase's subject matter produces is the registry's `TypeError`
message, which is a programmer's and which nothing renders, so the i18n rule is not engaged.

**Two of the three findings were records claiming a guarantee the code does not give, found inside
correction blocks that were themselves written to correct an earlier instance of that defect.** That is
why every sentence below was re-derived against the code rather than transcribed from the finding —
and why §2 and §4 each end by naming a place where the reviewer's own wording is imprecise. A fix that
restates a reviewer's sentence without re-deriving it is the failure mode this phase exists to close.

---

## 1. Files

| File | What changed |
|---|---|
| `src/lib/browser/writeSurfaceRegistry.ts` | finding 3's source half in **three** places, not the one the review named — the interface doc comment (`:241-250`), `ownedSurface`'s doc comment (`:412-416`) and the inline comment in `registerWriteSurface`'s body (`:495-502`) — plus an `@throws` tag on the interface method (`:258-260`), and finding 1's source half: the `replaceTarget` comment (`:538-560`), which asserted a refusal that does not happen. **Comment only** (565 → 597 lines) |
| `src/lib/browser/workspace.svelte.ts` | finding 2: `BrowserState.registerWriteSurface` (`:1477-1530`) gains a paragraph naming the throw, what reaches it, and that uncaught on a mount path it is a blank pane (`:1502-1514`), plus an `@throws TypeError` tag (`:1520-1525`). **Comment only** (3 710 → 3 730 lines) |
| `docs/decisions/2d-5-2a-A-notes.md` | correction blocks on §2.4 (finding 3's record half — the refusal claim), §3.1 (finding 3 — the citations) and §4 (finding 1) |
| `docs/decisions/2d-5-2a-notes.md` | correction blocks on §3.8's own correction (finding 3 — the citation) and §4's own correction (finding 1) |
| `docs/decisions/2d-5-2a-B-notes.md` | this record |

> **Correction — Phase 2d-5-2a-C, 2026-09-04.** **The two `writeSurfaceRegistry.ts` ranges this record
> gives for the `replaceTarget` comment name the tree at `52ff829`, and 2d-5-2a-C has moved them.**
> Review 3 finding 2 sent that phase back into the comment's last sentence, and the replacement is
> eight lines longer. Re-derived by reading the file after that edit rather than by adding eight to a
> remembered number: the comment now runs **`:538-568`** — `:538` is unmoved, `:568` is
> *"// section 3 carry both derivations."* — and the module is **605** lines, not 597. Section 2.5's
> second `:538-560` is the same range and moves with it. **Every other citation in the table is before
> the edited region or in a file 2d-5-2a-C does not touch**, and each was re-read on the post-edit
> tree: `:241-250`, `:258-260`, `:412-416`, `:421`, `:495-502` and `:106-120` in the registry, and
> `:1477-1530`, `:1502-1514`, `:1520-1525` in `src/lib/browser/workspace.svelte.ts`, which is
> unchanged at 3 730 lines.

`src/lib/browser/workspace.svelte.ts` is a **`.ts` module**, not a Svelte component. No component,
markup, prop or reactive statement was touched, so **no window reading is owed or was taken**, exactly
as at 2d-5-2a and 2d-5-2a-A.

---

## 2. Finding 1 — the ordering change is not outcome-preserving, and it is less alike than the review says

### 2.1 What the records claimed

`docs/decisions/2d-5-2a-A-notes.md` §4 and `docs/decisions/2d-5-2a-notes.md` §4's correction block both
said that after 2d-5-2a-A's read-then-check reordering of `replaceTarget`, *"the answer is the same
`staleLease` the old ordering produced"*. The second added that *"the suite's case still pins it"*.

### 2.2 How it was derived, rather than read

Both modules were **run against each other**. `15ada19`'s `writeSurfaceRegistry.ts` and the shipped one
were extracted to a scratch directory outside the repository, transpiled with this repository's own
`node_modules/typescript/bin/tsc` (both files import types only, so the emitted JavaScript is the
module), and driven from a throwaway ESM harness that reports each call's answer, the generation delta
taken **before** anything reads the live set, and which target ends up installed. Nothing was added to
the repository: the scope bound for this phase is comment-only, and a case pinning row 2 below is a
source change. §6 item 1 carries that as an open check.

Measuring rather than reading is what caught the part the review also got wrong.

### 2.3 The old ordering never read `target.document` at all

`withTarget` returned `{ kind, target }` — **the caller's target object, kept by reference** — so the
substring `.document` does not occur anywhere in
`15ada19:src/lib/browser/writeSurfaceRegistry.ts`. The single caller-supplied read the old
`replaceTarget` took was `held.surface.kind`, off the registered object the registry also kept by
reference; that is what the removed second check (`heldBy(...) !== held`,
`15ada19:src/lib/browser/writeSurfaceRegistry.ts:411`) was guarding.

**So the two orderings share no re-entrancy route.** The new one's stored surface is the registry's own
frozen copy, so `kind` is a data property and cannot re-enter; its only caller-supplied read is
`target.document`, which the old one never took. Any sentence of the form *"the same answer as the old
ordering"* is therefore comparing outcomes across two different routes, and has to say which.

> **Correction — Phase 2d-5-2a-C, 2026-09-04, review 3 finding 3.** ***"So the two orderings share no
> re-entrancy route"* is true of `replaceTarget` and false of the two modules.** The sentence with its
> scope stated, which is what this paragraph should have said: **the two `replaceTarget` orderings
> share no re-entrancy route.** Registration is a shared one. Both modules read `surface.kind` off the
> caller's object in `registerWriteSurface` — `git show 15ada19:src/lib/browser/writeSurfaceRegistry.ts`
> line **365** and the current file's line **503**, each `const kind = surface.kind;`, each re-derived
> by reading that line on the tree it belongs to. The new module reads more there, not less:
> `surface.target` at `:504`, and inside `ownedSurface` that target's `kind` and then, on the document
> arm, its `document`. The old `registerWriteSurface` read nothing but `surface.kind`, so the shared
> registration route is exactly that one property and the new module's is strictly wider. **The
> paragraph's conclusion survives unscoped**: a sentence of the form *"the same answer as the old
> ordering"* still has to say which route it means, because the `replaceTarget` routes really are
> disjoint.

### 2.4 The three routes, measured

| The re-entry, and what drives it | Old (`15ada19`) | New (shipped) |
|---|---|---|
| A registration of this kind, from the reported `target.document` | outer `'replaced'`, generation +1 — the accessor does not run during the call, so it fires later, inside whatever consumer first reads `.document` off `openWriteSurfaces()` | outer `'staleLease'`, generation +1, the inner registration live |
| `replaceTarget` on the same lease, from the reported `target.document` | outer `'replaced'`, generation +1; the inner call does not run during the call either | outer **and** inner both `'replaced'`, generation +2, **the outer's target installed** |
| `replaceTarget` on the same lease, from the registered surface's `kind` accessor | outer `'staleLease'`, generation +1, **the inner's target installed** | the route does not exist |

Three things follow, and the records said none of them.

**The new ordering is stricter on row 1, which is the row the suite pins.** The case at
`src/lib/browser/writeSurfaceRegistry.test.ts:520-544` drives exactly that route and asserts
`'staleLease'`. Against the pre-fix module it fails, answering `'replaced'` — which is consistent with
2d-5-2a-A's own *"7 of 28 fail"* count and inconsistent with the sentence beside it. *"The suite's case
still pins it"* had it backwards: the case is evidence that the two orderings differ.

**The new ordering is looser on row 2, and that is the defensible half.** A target replacement keeps the
serial, so the outer call's `heldBy` matches and the outer writes over the inner: both calls report
success and the last finisher wins. That is this module's registration rule seen through a lease, and it
is what `registerWriteSurface`'s own read-first ordering already decides for a re-entrant registration.
It is right; it was simply never named.

**And the new ordering made `'staleLease'` truthful.** Under the old one, row 3 answered `'staleLease'`
for a lease that was live and had not been displaced — a refusal wearing the name of a stale lease,
which `WriteSurfaceTargetReplacement`'s doc comment (`writeSurfaceRegistry.ts:106-120`) does not
describe. Under the new one
`'staleLease'` is returned only when `heldBy` fails, which is exactly when the lease no longer names the
live entry. The doc comment became true without being weakened.

### 2.5 What changed for it

**No behaviour.** The ordering shipped at 2d-5-2a-A stays, and the argument for it is unchanged: a
check and a spend with nothing caller-supplied between them is the shape `CLAUDE.md` asks for. What
changed is three sentences — the two records, and one the review did not name.

**The one the review did not name is a source comment.** `replaceTarget`'s own comment said that if a
re-entry *"displaced this kind's entry, the check that follows sees the newer registration and this call
refuses"*. True of a re-entrant registration; **false of a re-entrant same-lease `replaceTarget`**,
which replaces the entry object without displacing the registration, so the check matches and the call
does not refuse. It now states both cases separately (`writeSurfaceRegistry.ts:538-560`). Leaving it
would have been the
finding's own defect class standing in source after being closed in the record, which is the miss
`CLAUDE.md` names twice.

### 2.6 Where the review's own wording is imprecise

The finding is **right in its conclusion** — the change is not outcome-preserving and both records say
it is — and this phase applies it. Two details in it do not survive re-derivation, and are recorded
because the next reader will otherwise inherit them:

- It says the old code refused *"a `target.document` getter that calls `lease.replaceTarget(t2)`"*.
  That getter cannot run inside the old `replaceTarget`, which never read it; on that route the old
  code answers `'replaced'` (row 2, left). The refusal it describes is real but belongs to the `kind`
  route (row 3), which the new module does not have.
- Its citation `:404` for `heldBy(...) !== held` is a line of the comment above it; the comparison is at
  `:411`. The finding writes it as `git show HEAD:…`, which named the pre-fix blob during the review and
  names the post-fix one now that 2d-5-2a-A is committed — the same class as finding 3. `PROGRESS.md`
  §"What 2d-5-2a-B is" item 1 resolves `HEAD` to `15ada19` but carries both imprecisions forward.

---

## 3. Finding 2 — the door 2d-5-2b's components call documented no throw

### 3.1 What it was, verified

`BrowserState.registerWriteSurface` delegates straight through
(`src/lib/browser/workspace.svelte.ts:3210-3217`) to
`WriteSurfaceRegistry.registerWriteSurface`, which throws a `TypeError` on a `kind`/`target` pairing
`OpenWriteSurface` cannot represent. The interface member's doc comment had neither prose about it nor
an `@throws` tag, while the convention exists in this repository at `src/lib/bootstrap.ts:53`
(`@throws When …`) and `src/lib/browser/writeSurfaceRegistry.ts:421` (`@throws TypeError - When …`).
Both were read; the tag written here follows the second, because naming the error type is what a caller
needs in order to catch it.

### 3.2 What it says, and why in those terms

The member now carries a paragraph and a tag (`:1502-1514` and `:1520-1525`). What triggers the throw is
stated as something a caller can act on rather than as a restatement of the registry's internals:

- **It is not reachable from a well-typed literal.** `OpenWriteSurface` (`src/lib/browser/restore.ts`)
  correlates the two — `matchCreator` takes a `WriteSurfaceTarget`, every other kind takes a
  `WriteSurfaceDocumentTarget` — so the compiler already rejects the pairing.
- **It becomes reachable when a caller takes them apart**: a widened `kind` variable paired with a
  separately built target and reconciled by a cast or an assertion.
- **Or when a property read answers something other than its declared type**, because the registry reads
  `kind` and `target` where it is called and not where they were written.
- **Uncaught inside a mount effect that is a blank pane**, not a refused registration. So a host that
  cannot hand over a correlated literal is the host that has to catch.

The tag also says what a refusal leaves behind, in the form §4 establishes: nothing this call would have
written is written, but a registration the caller's own reads performed on the way in stands.

### 3.3 What the fix does not force

**It is a sentence.** Nothing makes a host read it, nothing makes a host catch, and no type expresses
"this may throw" in TypeScript. The compiler force that does exist is upstream and unchanged — the
correlated union — and it is defeated by exactly the two routes named. Whether a real host blanks a pane
on the `TypeError` is unverifiable until 2d-5-2b's mounted evidence, which the review's own "not
verified" list already says.

---

## 4. Finding 3 — a citation that outlived what it was derived from, and a sentence true of a name

### 4.1 The citations, re-derived rather than transcribed

`docs/decisions/2d-5-2a-notes.md:237` and `docs/decisions/2d-5-2a-A-notes.md:161` both cite
`workspace.svelte.ts:2269` for *"Their identities are reallocated by the load below"*. Checked against
the two commits rather than against the finding:

| Tree | Where that sentence is |
|---|---|
| `15ada19` (pre-2d-5-2a-A) | `:2269` |
| `9f32cc5` (2d-5-2a-A, the commit both records describe) | `:2286` |
| after this phase's +20 doc-comment lines | **`:2306`**, in the block `:2305-2309`, above `projectionGenerations.clear()` at **`:2310`** |

So the citation was **already wrong when it was committed**, and by its own phase's doing: 2d-5-2a-A's
replacement for the `open()` comment is seventeen lines longer than what it replaced. The review's
replacement figure `:2286` was right for the tree it read and is wrong for this one, which is the
finding demonstrating itself; both correction blocks therefore give the number **and** the quoted text,
and say which tree the number belongs to.

**One citation in the same paragraph is deliberately left alone.** `2d-5-2a-A-notes.md`'s
`workspace.svelte.ts:1683` sits in a section headed *"What it was"* and points at pre-fix text: at
`15ada19`, `:1683` is *"the safe one costs nothing, because a workspace that has really been
replaced"* — checked. It names nothing on this tree, where the phrase exists nowhere under `src/` and
the replacement comment block runs `:1690-1721`. The correction block says so instead of renumbering a
historical pointer. `2d-5-2a-A-notes.md:41`'s `writeSurfaceRegistry.ts:245-249` is the same shape and is
left for the same reason (§6 item 3).

> **Correction — Phase 2d-5-2a-C, 2026-09-04, review 3 finding 1.** **`:1690-1721` above is off by one
> at its start**, and this record introduced it inside the fix that answered a stale-citation finding.
> Re-derived on the post-edit tree, with `rg -n` for the block's own first sentence and by reading the
> lines around it: the block's first line —
> `// **Every write surface this window has told this state about** — Phase 2d-5-2a.` — is
> `src/lib/browser/workspace.svelte.ts:1689`; its last comment line is `:1721`; and `:1722` is the
> `const writeSurfaces = createWriteSurfaceRegistry();` it introduces. **The block is `:1689-1721`.**
> The **end** was derived rather than carried forward — no earlier round had checked it — and 1721 is
> what it derives to. The identical range in `2d-5-2a-A-notes.md` §3.1 carries the same correction.
> `workspace.svelte.ts` is untouched by 2d-5-2a-C, so `:1689-1721` describes `5ec011e` and this
> phase's tree alike.

The *"586 lines further down"* figure in `2d-5-2a-notes.md` §3.8's correction is **dropped rather than
re-derived**: it subtracts two line numbers in a file every later step of 2d-5 edits, so it goes stale
for reasons unrelated to what it claims.

### 4.2 The refusal sentence, verified before it was rewritten

The comment claimed *"a refused registration leaves the registry exactly as it was and moves no
generation"*. Run rather than reasoned about: a surface whose `target` getter registers a `matchCreator`
and then answers `{ kind: 'unknown' }` for a `matchEditor` kind throws the `TypeError` **and leaves that
`matchCreator` live with the generation moved by one**. The claim is false on the accessor route — one
of the two routes the same paragraph names — and true on the cast route.

**Rewritten to be true of its predicate rather than of the function's name**: the throw happens before
the serial is taken and before the map is touched, so *this call* takes no serial, stores no entry under
the kind it read and moves no generation of its own — and that is a claim about the call, not about the
registry, because the caller's own reads can register on the way in.

**The same sentence stood in three places, and the review named one.** Sweeping for the shape rather
than for the finding's words found the other two: `ownedSurface`'s doc comment (*"a throw here leaves
the registry exactly as it was"*) and the inline comment in `registerWriteSurface`'s body (*"a refused
registration changes nothing at all"*). All three now say the narrower true thing. Closing one and
leaving two is the miss `CLAUDE.md` records against 2c-4a-2 and 2c-4a-3a.

### 4.3 What was checked and deliberately not changed

The case at `src/lib/browser/writeSurfaceRegistry.test.ts:427-449` asserts that a refused registration
changes nothing. It is **sound and untouched**: it drives both cast routes with plain data objects, on
which the claim holds exactly as written. `2d-5-2a-A-notes.md` §2.5 and §6 item 3 describe that case, so
those descriptions are still true of the case; it was the general sentence that was not true of the
routes, and the correction block on §2.4 says which is which.

---

## 5. The gates, measured

Every command was run **on its own**, never chained. The baseline this phase inherits is
**1320 / 438 / 2235 / 186**, and a comment-only change should move none of them. **None moved.**

| Gate | Result |
|---|---|
| `git diff --stat HEAD -- crates/ src-tauri/` | empty — no Rust file touched |
| `cargo test --workspace` | pass, **1320** tests (summed over every `test result:` line) |
| `cargo clippy --workspace --all-targets -- -D warnings` | pass, no warnings |
| `cargo fmt --check` | pass, no output |
| `cargo tree -p espansoconfig-core \| rg tauri` | **no match** — the architecture rule holds |
| `npm run check` | **438 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS** |
| `npm test` | **2235** passed, 59 files |
| `npm run build` | **186** modules transformed |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | **no match** — the server build did not leak in |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | **2** — the discriminating half of the oracle can match, so the negative above is not vacuous |

Both bundle oracles were run, not just the negative one, for the reason `CLAUDE.md` §4 gives: searching
for `svelte/internal/server` is vacuous, and a negative with no positive control beside it is empty.

---

## 6. Where it is thin

Marked per `CLAUDE.md` §7.3. **No item here commissions a review round** — §7.1 is the only mechanism
and it reads a diff. **No item names a correctness defect in a source file**, so none is a blocker and
none holds this step open.

1. **Row 2 of §2.4 is derived and measured but not pinned by a committed case — *actionable*, and not a
   correctness defect.** The check that would pin it: register a surface, call `replaceTarget` with a
   target whose `document` accessor calls `replaceTarget` again on the same lease, and assert both
   answers are `'replaced'`, that the outer target is installed, and that the generation moved twice.
   It was **not** added, because this phase's scope bound is comment-only and a test file is source. It
   names a coverage gap, not a wrong line, so a later phase may adopt it — 2d-5-2b is the natural place,
   since it is the first phase with a reason to touch this suite again.

2. **The measurement in §2 lives outside the repository — *recorded only*.** The harness was transpiled
   into a scratch directory and discarded. Nothing in the tree reproduces the table; what the tree has
   is the comment in `replaceTarget` stating the outcome, and item 1's case would be the thing that
   makes it re-runnable. Anyone re-deriving it starts from `git show 15ada19:` and does the work again.

3. **Two historical citations elsewhere in `2d-5-2a-A-notes.md` are unverified in the same way the
   corrected ones were — *actionable*, a defect in the record at worst.** `:41` cites
   `writeSurfaceRegistry.ts:245-249` and `:161` cites `workspace.svelte.ts:1683`, both inside *"What it
   was"* sections. `:1683` was checked against `15ada19` and is right; `:245-249` was not checked
   against anything, and this phase's own edits moved that region again. Neither names source, so
   neither blocks.

4. **`'replaced'` is a point-in-time answer and no comment says so — *recorded only*.** On row 2 of
   §2.4 the inner call answers `'replaced'` truthfully and is then overwritten by the outer before
   either returns to a caller. That is true of any `replaceTarget` followed by another one and is not
   special to re-entrancy, so it is not written into the type's doc comment; it is named here because
   a reader of that row will notice it.

5. **Nothing in this repository registers a surface — *recorded only*, inherited unchanged from
   2d-5-2a and 2d-5-2a-A.** The `@throws` paragraph §3 adds describes a hazard on a mount path, and
   there is no mount path yet. Whether a host blanks a pane on the `TypeError`, catches it, or never
   reaches it is 2d-5-2b's mounted evidence.

6. **No test can fail for any of this — *recorded only*, and it is the whole shape of the phase.**
   Every change here is prose. The i18n suites check key parity and placeholder agreement, never what a
   sentence claims, and no suite reads a doc comment at all. The four gates prove only that nothing
   broke, which for a comment-only diff they would do whether the new sentences were true or false.

7. **These corrections were not reviewed when they were written — *recorded only*.** §7.1 owes this
   phase's source changes a round, and that round is this phase's own review. Until it has run,
   everything above is a claim by the author of the change, including the claim that three sentences
   which were wrong are now right — which is exactly what 2d-5-2a-A's §6 item 7 said before this phase
   found two more instances inside its correction blocks.
