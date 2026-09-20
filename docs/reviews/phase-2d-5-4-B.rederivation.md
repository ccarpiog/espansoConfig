# Re-derivation — Phase 2d-5-4-B's six findings

Read-only. **No build, test, package or `cargo`/`npm` command of any kind was run**; only `git show`,
`rg`, `sed`/`awk` and file reads. The only file this step created or modified is this one.

Why this document exists: the Codex report `docs/reviews/phase-2d-5-4-B.md` renders finding bodies to a
fixed width and truncates them at ~180 characters, so **no finding may be accepted on the report's
strength**. Each of the six below is re-derived from the code at `HEAD` (the fix under review is
`ee78429`), with the decisive lines quoted and the reviewer's line numbers corrected where they are
wrong.

## Verdicts at a glance

| # | Anchor as reported | Verdict | Defect in |
|---|---|---|---|
| 1 | `workspace.svelte.ts:3455` | **HOLDS** | source (+ a false comment) |
| 2 | `workspace.svelte.ts:498` | **HOLDS**, and wider than reported | source (+ two false records) |
| 3 | `workspace.svelte.ts:2963` → **2966** | **HOLDS** | source (+ a false comment at 3603–3607) |
| 4 | `workspace.svelte.ts:2339` → the read is at **2343** | **HOLDS** | source |
| 5 | `observationTransitions.ts:968` | **HOLDS IN PART** | source comment at 969–972; the write is reachable only through one narrower door than reported |
| 6 | `2d-5-4-A-notes.md:172` | **HOLDS** | record only |

**Five source, one record.** Under `CLAUDE.md` §7.1 the fix for any one of findings 1–5 changes a
source file, so the fix round for this review commissions a further round regardless of how findings 3–5
are ranked.

---

## Finding 1 — `open()` normalizes *after* its last generation check

**Verdict: HOLDS.** The defect is that `open()`'s only generation comparison for a document happens
**before** the caller-controlled property reads that `ownedProjectionOf` performs, and the publication of
the whole load (`views`, `status`, `reconciliation.workspaceReady()`) happens **after** them with no
further check — so a getter on the *last* document's answer can supersede the open and the superseded
open still publishes. This is the exact inversion of the ordering `ownedProjectionOf`'s own JSDoc
promises.

**Decisive lines** (the review's `3455` is correct for the check; it does not name the publication):

- `src/lib/browser/workspace.svelte.ts:3453-3462`
  ```
  3453:      for (const document of documents) {
  3454:        const view = await commands.getDocument(document.id);
  3455:        if (generation !== openGeneration) {
  3456:          return;
  3457:        }
  3458:        if (view.ok) {
  3462:          projected.push(ownedProjectionOf(view.value));
  ```
- `src/lib/browser/workspace.svelte.ts:3471-3474` — the publication, unguarded:
  ```
  3471:      } // End of the loop over every document of the workspace
  3472:      views = projected;
  3473:      loadFailures = refused;
  3474:      status = 'ready';
  ```
  and `3484: reconciliation.workspaceReady();`.
- The promise it breaks, `workspace.svelte.ts:533-539` (inside `ownedProjectionOf`'s JSDoc): *"Doing all
  of them in this function means they run **before** the comparisons that decide whether the answer may
  be installed, and never between one of those comparisons and the install it approved."*
- The local comment that restates it, `workspace.svelte.ts:3459-3461`: *"**Copied here, not retained.**
  Everything `views` holds has to be an object this module built, because `installView` compares the `id`
  of every element it already holds *after* its caller's last check."* — true of `installView`, and
  silent about the fact that in *this* function the copy is itself after the last check.
- `workspace.svelte.ts:3475-3477`, which the defect falsifies: *"**The second trigger, and only for a load
  that really finished.** Every early return above — a superseded generation, … — leaves this
  unreached"*.

**Failure path.** `open()` bumps `openGeneration` synchronously at `3328` and performs its whole reset —
`documents = []`, `views = []`, `selection`, `query`, `selected`, `externalStatuses`, `pathDrift`,
`pendingAdditions`, `projectionGenerations.clear()`, `forgetFileText()` — at `3364-3379`, all before its
first `await` at `3396`. So: the loop reaches its **final** document; `commands.getDocument` resolves;
the check at `3455` passes; `ownedProjectionOf(view.value)` at `3462` reads `view.value`, then
`view.matches`, then 24 fields and each match's 18; **any one of those accessors calls `state.open(root2)`
synchronously**, which bumps the generation, blanks the window and returns at its first `await`. Control
comes back into `3462`, the loop ends, and `3472-3474` install the *old* workspace's projections and
`status = 'ready'` over a window that has just been cleared for a different root, while `3484` opens the
coordinator's drain gate for a lifecycle that is not ready. The person sees the previous configuration's
file list and snippet counts presented as the new workspace's, until the second load finishes.

Only the final document escapes: for any earlier one, iteration *i*'s getter is caught by iteration
*i+1*'s check at `3455`. The reviewer's "on the final document" is precise and correct.

**Source or record:** **source.** The ordering at `3455`/`3462` is the defect; `3459-3461` and `3475-3477`
are false comments in the same source file, and `533-539` is a false guarantee in the same file.

**Can a test catch it today?** Yes, with harnesses this suite already has. `workspace.test.ts:8493-8499`
builds a `DocumentView` with a `get id()` accessor and `8441-8458` builds a `CommandResult` with a
`get value()` accessor that re-enters a public door. The existing case is deliberately armed *after*
the load — `workspace.test.ts:8519-8520`: *"Armed after the load, so the ingress copy is taken of a
truthful answer"* — which is exactly why it does not reach this. The catching case is the same trap armed
**during** `open()`, on the answer for the **last** identity `listDocuments` returns, calling
`state.open(...)` from the getter, then asserting `state.views`/`state.status` describe the second open
and that `workspaceReady` did not fire for the first.

---

## Finding 2 — the identity object is the command's, and it is read between a selection guard and its write

**Verdict: HOLDS, and the real defect is wider than the truncated claim.** The report's two halves are
both true: `ownedMatchOf` retains the command's `MatchId` at `workspace.svelte.ts:500`, and
`ownedProjectionOf`'s reader enumeration omits `positionInSameParse` → `positionOf`. But the consequence
is not only a stale enumeration: at **three** adoption sites, `positionInSameParse` runs those retained
accessors **between the selection-follow guard and `replaceSelection`**, which is the precise shape
`CLAUDE.md` records as 2c-3c step 2's High ("the selection-follow guard holds at the write, not before
it").

**Decisive lines** (the review's `498` and `500` are correct; `selection.ts:134` is correct):

- `src/lib/browser/workspace.svelte.ts:498-500`
  ```
  498: function ownedMatchOf(match: MatchView): MatchView {
  499:   return {
  500:     id: match.id,
  ```
  and its own JSDoc at `487-491`: *"the **values** of those fields — `id`'s own properties … — are still
  the command's own objects, and a getter or a proxy trap on one of those runs whenever something reads
  it."*
- `src/lib/browser/selection.ts:133-135`
  ```
  133: export function positionOf(view: DocumentView, id: MatchId): number | null {
  134:   const index = view.matches.findIndex((match) => match.id.node === id.node);
  135:   return index === -1 ? null : index;
  ```
  `match.id` is the command's object (line 500 above), so `.node` is a **third-level** read — one level
  below where the normalizer stops.
- `src/lib/browser/workspace.svelte.ts:471-475` — `positionInSameParse` reads `view.id`, `view.revision`,
  `id.document`, `id.revision` and then calls `positionOf`.
- The enumeration that misses it, `workspace.svelte.ts:541-545`: *"Two levels and no more … **That is the
  depth this module reads after a guard** — `installView` reads `next.id` and the `id` of every element of
  `views`; `repairAfter` reads `view.id`, indexes `view.matches`, and `reresolve` reads a candidate's
  `source_text` and its `id`; `readFileText` reads a held view's `revision`."* I checked each of those four
  against the code and each is accurate (`installView` at `2673-2682`; `repairAfter` at `4855-4870` via
  `reresolve` at `selection.ts:192-209`; `readFileText` at `3064`). **`positionInSameParse` is a fifth
  reader and it reads deeper than all four.**
- The three sites where it runs inside the guard's window:
  - `workspace.svelte.ts:4466-4477` (`adoptTheDocumentOnDisk`): guard `moved !== null && selected !== null
    && selected.document === document && isTheSameIdentity(selected.id, target)` → `4474: const position =
    positionInSameParse(next, moved);` → `4476: replaceSelection(selectMatch(next, position));`
  - `workspace.svelte.ts:4533-4540` (`adoptTheCreatedSnippet`): guard `moved !== null && selected ===
    heldBefore && inScope` → `4538` → `4540`
  - `workspace.svelte.ts:4608-4619` (`adoptAfterTheDuplicate`): guard `selected === intent.held &&
    selectGeneration === intent.generation` → `4617` → `4619`
- And the comment the third site carries, `workspace.svelte.ts:4605-4607`: *"**The justification, at the
  write.** Both halves re-validated after the await above — the only await on this path — and **no await
  separates them from the `replaceSelection` they justify.**"* That sentence is literally true about
  *awaits* and false about the guarantee it stands for: `CLAUDE.md` says a check and a spend separated by
  **any property read** are not atomic, because a property read runs arbitrary code.

**Failure path.** A duplicate commits. `adoptAfterTheDuplicate` re-reads, `4608-4612` confirms the person
has not moved the selection (`selected === intent.held`, `selectGeneration === intent.generation`). Then
`4617` calls `positionInSameParse(next, moved)`, whose `positionOf` walks every match and reads
`match.id.node`. One of those `id` objects came from `get_document` and carries a `get node()` that
synchronously calls a public door which writes `selected` (`state.select(...)` or any path through
`replaceSelection`). `positionOf` returns an index; `4619` then writes `replaceSelection(selectMatch(next,
position))` — **the clone hijacks a selection the person moved**, which is the exact outcome the 2c-3c
High was closed to prevent, and the `selectGeneration` half of the intent is not re-read. The same holds at
`4474` and `4538`.

**Source or record:** **source**, and two record defects beside it. The record halves:
`workspace.svelte.ts:541-545` (the incomplete enumeration and the false *"that is the depth"*),
`workspace.svelte.ts:4605-4607` (the "no await separates them" argument), and
`docs/decisions/2d-5-4-notes.md:737-738`, which marks precisely this as surviving *recorded only*:
*"What survives as **recorded only** is the residue — **the third level and below is still the command's
own object**, and no type says so."* Under `CLAUDE.md` §7.3 that mark is wrong: the residue names a
correctness defect in a source file, so it was a **blocker**, not a carried item. `2d-5-4-A-notes.md`
§7 item 1 is marked *actionable* but under-claims in the same way — it says *"A reader added later — a
fourth thing running after a guard — makes the sentence false"*, when a fifth reader was already there
when that sentence was written.

**Can a test catch it today?** Yes. `workspace.test.ts` already drives the duplicate adoption and already
knows how to build a `DocumentView` with accessors (`8493-8499`). The case is: a `getDocument` answer
whose *last* match's `id` is `{ get node() { … } }`, the getter calling a door that replaces `selected`,
then asserting `state.selected` is what the person chose and not the clone. Nothing existing covers it —
every added case in `ee78429` traps at level one or two (`value`, `id` on a `DocumentView`), never on a
`MatchId`.

---

## Finding 3 — an explicit reread clears a status a newer observation set

**Verdict: HOLDS.** `BrowserState.rereadDocument` passes `ALWAYS_PERMITTED`, and `rereadUnderGuard`'s
three captures are blind to `noteDocumentStatus`. A newer `Unreadable` observation for the same file
records `unavailable` with a typed reason and moves **none** of the three, so the held response installs
and then **clears** the newer mark — permanently, because the batch watermark has advanced past the
observation that carried the reason.

**Corrected line number: the clear is at `workspace.svelte.ts:2966`, not 2963** (2960–2965 are the comment
block above it). `observationTransitions.ts:1081-1084` is **correct** as cited.

**Decisive lines:**

- `src/lib/browser/workspace.svelte.ts:2903-2913` — the three captures, and what they are:
  ```
  2903:    const opened = openGeneration;
  2904:    const reread = nextRereadOf(document);
  2905:    const projection = projectionGenerationOf(document);
  ...
  2910:      opened === openGeneration &&
  2911:      reread === rereadGenerations.get(document) &&
  2912:      projection === projectionGenerationOf(document);
  ```
- `src/lib/browser/workspace.svelte.ts:2936-2946, 2966`
  ```
  2936:    if (!guard()) { return null; }
  2939:    if (!stillCurrent()) { return null; }
  2945:    forgetFileText();
  2946:    installView(next);
  2966:    noteDocumentStatus(document, null);
  ```
- `src/lib/browser/workspace.svelte.ts:3608` — `return rereadUnderGuard(document, ALWAYS_PERMITTED);`,
  with `ALWAYS_PERMITTED` at `1928` being `(): boolean => true`.
- `src/lib/browser/observationTransitions.ts:1081-1084`
  ```
  1081:  if (!sequences.admit(route.document, route.sequence)) {
  1082:    return 'superseded';
  1083:  }
  1084:  workspace.noteDocumentStatus(route.document, { kind: 'unavailable', reason: route.reason });
  ```
  `admit` advances the accepted sequence; nothing here touches `openGeneration`, `rereadGenerations` or
  `projectionGenerations`.
- The sentence the defect falsifies, `workspace.svelte.ts:3603-3607`: *"what a person's own recovery does
  **not** have is a coordinator guard, because **nothing has to arbitrate a read somebody asked for
  against an observation nobody has seen**."* By the time the answer lands, the observation **has** been
  seen and admitted.
- The fence that exists and is not used here: `statusWriteOf` at `workspace.svelte.ts:2810-2812`, whose
  own JSDoc (`2799-2806`) says *"Captured by an arm before it awaits, and compared afterwards … A changed
  one means somebody else's transition has spoken since."* `rereadUnderGuard` captures three counters and
  not this one.

**Failure path.** The person clicks the recovery control on `match/base.yml`. `reload_document` goes out
and is slow. The watcher delivers `Unreadable` for that file; `applyUnreadable` admits it at `1081` and
writes `{ kind: 'unavailable', reason }` at `1084`. The reread's answer arrives: `stillCurrent()` passes
(no counter moved), `ALWAYS_PERMITTED` passes, `installView` installs a projection of bytes that predate
the failure, and `2966` sets the status to `null`. The file now reads as *nothing to report* while the
watcher's last word was *unreadable*, and the observation will never be redelivered. Nothing draws
per-document status today, so the visible harm lands at 2d-6 — but the state is already wrong.

Note the asymmetry that proves this is specific to the explicit door: the **coordinator's** reread is
fenced, because its guard asks `sequences.isNewest` at `observationTransitions.ts:957` and a newer
observation makes it refuse; and a newer `Removed` is fenced even on the explicit path, because
`removeDocumentFromWindow` calls `invalidateProjectionOf` (`workspace.svelte.ts:2479-2481`), which moves
the third capture. `Unreadable` is the arm that moves nothing.

**Source or record:** **source** (the missing fence at `2966`), plus a false comment at `3603-3607` in
the same file. `2d-5-4-A-notes.md` §7 item 5 gestures at the area but marks it *recorded only* and
frames it as a disclaimer about **membership**, not as a status a newer observation owns.

**Can a test catch it today?** Yes, and the suite already has the shape: the case
*"keeps an overlapping reread's installed status over an older failure"* added by `ee78429` holds a
deferred command response across an interleaving. The catching case is: open, hold `reloadDocument`'s
promise, call `state.rereadDocument(2)`, deliver an `unreadableDocument` observation for 2, resolve the
held promise, then assert `state.externalDocumentStatus(2)` is still `{ kind: 'unavailable', … }`.

---

## Finding 4 — the failure arm's last read runs caller code after all three fence checks

**Verdict: HOLDS.** The three-capture fence added by this fix is defeated by its own last condition:
`documents.some((held) => held.id === document)` reads `id` on objects the command supplied, and it runs
**after** both the generation comparison and the status-write comparison and **before** the write.

**Corrected line numbers.** The review anchors at `2339`, which is the status-write check
(`if (marked !== statusWriteOf(document))`). The offending read is at **`2343`** and the write it guards
is at **`2348`**. Both the anchor and the body are defensible — the title asks for the row lookup to move
*above* the checks — but a reader looking at 2339 for a property read will not find one.

**Decisive lines**, `src/lib/browser/workspace.svelte.ts:2317-2349`:
```
2317:      rereadUnderGuard: (document: DocumentId, guard: () => boolean): void => {
2318:        const opened = openGeneration;
2319:        noteDocumentStatus(document, { kind: 'stale' });
2322:        const marked = statusWriteOf(document);
...
2333:            if (opened !== openGeneration) { … return; }
2339:            if (marked !== statusWriteOf(document)) { … return; }
2343:            if (!documents.some((held) => held.id === document)) { … return; }
2348:            noteDocumentStatus(document, { kind: 'stale' });
```
`documents` is never normalized. Its two ingresses are `workspace.svelte.ts:3428`
(`documents = listed.value;` — straight from `commands.listDocuments()`) and `addDocument` at
`2713-2721`, whose `summary` arrives from an `Added` observation. There is no `ownedSummaryOf`: the
normalizer built by this fix covers `DocumentView`/`MatchView` only.

The capture at `2322` **is** taken after the arm's own mark at `2319`, as the brief's standing-shape
sweep asks — that half is correct and its comment at `2320-2321` is true.

**Failure path.** A guarded reread fails. In the `.then` callback, `2333` and `2339` both pass. `2343`
iterates `documents`; a `get id()` on one of those summaries synchronously calls
`state.rereadDocument(...)` (which reaches `noteDocumentStatus` at `2966` on success) or any coordinator
door that writes this file's status, or `state.open(...)`. `some` returns `true`, and `2348` writes
`{ kind: 'stale' }` over the newer truth — exactly the class of write the JSDoc at `2284-2294` says the
fence removes: *"the write happens only while all three say this arm still owns what that file's status
says."* It does not: the third condition is the one that can invalidate the first two.

**Source or record:** **source.** The comment at `2284-2294` becomes false as a consequence, but the
ordering is the defect.

**Can a test catch it today?** Yes — the harness exists (`workspace.test.ts:7172` already builds a
`new Proxy([] as OpenWriteSurface[], …)`, and `8493-8499` a getter-bearing view). The case is a
`listDocuments` answer whose summaries carry `get id()`, armed after the load, plus a `reloadDocument`
that fails; assert the status is whatever the getter's re-entry wrote, not `stale`. Note the honest
difficulty `2d-5-4-A-notes.md` §7 item 4 already records: *"no test can distinguish the permitted write
from no write at all"* for the benign case — but **this** case is distinguishable, because the getter
writes a different value.

---

## Finding 5 — the registry arm's positional argument, and its comment

**Verdict: HOLDS IN PART.** The comment at `observationTransitions.ts:969-972` is false as written — it
argues that *reaching* line 968 proves the ownership question is still answered yes, which is a claim
about the past used as a claim about the present. But the reviewer's stated vector overreaches: on the
path that actually reaches `968`, `tellTheSurfaceAbout` returned `false`, which means
`targetingSurfaceFor` answered `null` and the **component transition was never called**. What does run is
`workspace.openWriteSurfaces()` and `workspace.creatorEligibility(route.document)` — host members, and
the second of them reads command-supplied data.

**Line numbers `968` and `971` are correct**, and so is `947`/`944` for `markStaleWhileOurs`.

**Decisive lines**, `src/lib/browser/observationTransitions.ts:957-975`:
```
957:    if (!sequences.isNewest(document, route.sequence)) { return false; }
960:    if (tellTheSurfaceAbout(route, workspace)) {
964:      // `stale` needs no fence: this arm is below the ownership question, so
965:      // reaching it is already the answer to it.
966:      return false;
967:    }
968:    if (workspace.writeSurfaceGeneration() !== registryAt) {
969:      // Unfenced, for the same reason the arm above it is: reaching this line means
970:      // the ownership question two arms up already answered yes. …
973:      workspace.noteDocumentStatus(document, { kind: 'stale' });
```
and `observationTransitions.ts:1004-1023` (`tellTheSurfaceAbout`):
```
1008:  const kind = targetingSurfaceFor(
1009:    route.document,
1010:    workspace.openWriteSurfaces(),
1011:    workspace.creatorEligibility(route.document)
1012:  );
1013:  if (kind === null) { return false; }
1016:  workspace.noteDocumentStatus(route.document, { kind: 'stale' });
1019:  const transition = workspace.transitionFor(kind);
1021:  if (narrowed !== null && transition !== null) { transition(narrowed); }
```
`transition(...)` at `1021` is only reached when `kind !== null`, i.e. on the arm that returns `true` and
so never reaches `968`. The host member that *does* run, `workspace.svelte.ts:2239-2245`:
```
2239:      creatorEligibility: (document: DocumentId): CreatorEligibility => {
2240:        const summary = documents.find((held) => held.id === document);
...
2244:        return creatorEligibilityOf(summary, viewOf(document) ?? null);
```
— the same unnormalized `documents` as finding 4, read here inside the guard.

**Failure path.** Between `957` and `973`: `documents.find((held) => held.id === document)` at
`workspace.svelte.ts:2240` runs a `get id()` on a command-supplied summary (or `creatorEligibilityOf`
runs one on `read_only`/`disabled`/`kind`); that accessor synchronously delivers a newer observation for
the same file — `reconciliation.accept(...)` is synchronous in its `admit` path — so
`sequences.isNewest(document, route.sequence)` is now `false`. Line `973` then writes `stale` over the
newer transition's verdict, which is precisely what `markStaleWhileOurs` was introduced at `943-948` to
stop for the two arms above. `targetingSurfaceFor` (`restore.ts:603-639`) reading component-registered
surface descriptors is a second, softer vector on the same path.

**Two things the review does not say, and they matter.** First, the identical exposure exists at
`observationTransitions.ts:1016` — that write is also after `openWriteSurfaces()`/`creatorEligibility()`
and is defended by the same sentence at `964-965`. Second, the comment's *other* claim at `971-972`
(*"no test could tell it from this one"*) is **true and independently recorded**:
`2d-5-4-A-notes.md:186-188` says a candidate test for exactly this was discarded for passing both ways.
So the sentence is half-true, and the half that is false is the half that justifies the code.

On the brief's question (c): **`sequences.isNewest` is an injected interface method, not a pure read.**
`AcceptedSequences` is an `interface` at `observationTransitions.ts:206-233`, `isNewest` is declared at
`215`, and `applyChange` takes `sequences: AcceptedSequences` as a parameter. The production
implementation returned by `createAcceptedSequences()` (`245-265`) *is* a closure over a plain `Map` —
`isNewest` at `254-256` is `(highest.get(document) ?? 0) === sequence`, pure — so the comment at `940-941`
(*"A pure read of the accepted-sequence map"*) is true of today's only implementation and false of the
type. `2d-5-4-A-notes.md` §7 item 3 already records this, as *recorded only*, which is the right mark: it
names no defect in a source file today.

**Source or record:** **source** — the comment at `969-972` lives in a source file, and under
`CLAUDE.md` §7.1 *"the unit is the file, not the line. Any change to a source file counts, a comment-only
change included."* Whether the *fence* should be added is a judgement; whether the comment's argument is
sound is not, and it is not.

**Can a test catch it today?** Trivially, and more easily than any other finding here, because
`applyChange` takes both `workspace` and `sequences` as parameters: `observationTransitions.test.ts` can
pass a `workspace` whose `creatorEligibility` calls `sequences.admit(document, higher)` and then assert
no `stale` was appended. The case added by `ee78429` — *"reaches neither arm below the ownership question
once it is answered"* — is the positional argument asserted, not the re-entrancy tested.

---

## Finding 6 — the record says nine and enumerates eight

**Verdict: HOLDS.** Counted independently, not taken from the reviewer.

**The claim**, `docs/decisions/2d-5-4-A-notes.md:172`:
> **The nine cases and the failure each produced against the pre-fix code.** Every one was confirmed by
> reverting the change in the tree, running the one suite, recording the message and restoring it:

**What I counted.**

1. **`it(` blocks added by `ee78429`.** `git show ee78429 -- src/lib/browser/workspace.test.ts | rg -c
   '^\+\s+it\('` → **6**; the same over `observationTransitions.test.ts` → **4**; removals (`^-\s+it\(`)
   → **0** and **1** respectively. **Total 10 added, 1 removed.** Read rather than only counted, the ten
   titles are:
   - `workspace.test.ts`: *installs into the slot the projection names…*; *repairs the selection against
     the projection it read…*; *keeps a newer removal over an older reread that came back a failure*;
     *keeps an overlapping reread's installed status over an older failure*; *clears the mark when an
     explicit reread installs the file again*; *sends document_text for the viewer's file after an
     observation installs*.
   - `observationTransitions.test.ts`: *permits the install and writes no status of its own*;
     *preserves a newer unreadable reason when the session has stopped applying*; *preserves a newer
     status when the workspace epoch has moved*; *reaches neither arm below the ownership question once
     it is answered*.
   - The removed one is *permits the install and clears the file's status*, which the first of the four
     above **replaces** — so it is a **rewrite**, not a new case.
2. **Net new tests: 9.** Independently corroborated by the notes' own gate line
   (`2d-5-4-A-notes.md:166`): *"`npm test` → **2389 passed in 61 files**, exit 0 (**2380** before)"* —
   a delta of exactly 9, which is 10 added minus 1 removed.
3. **Rows in the §6 table: 7** (`2d-5-4-A-notes.md:176-183`, excluding the header and separator).
4. **Cases the rows name: 8.** Six rows name one case each; the `4` row names two — *"preserves a newer
   unreadable reason when the session has stopped applying*, **and the same for a moved epoch**"* —
   matching the two `it(` titles above.
5. **Non-discriminating additions: 2**, and the notes say so themselves at `185-190`: *"Two candidate
   cases were discarded for passing both ways… The case that replaced the first is labelled
   non-discriminating by construction; finding 6's is stated as pinning the corrected claim, not as a
   regression test."* Those two are *reaches neither arm below the ownership question once it is
   answered* and *sends document_text for the viewer's file after an observation installs*.

**The true numbers: 10 `it(` blocks added, 1 deleted, net +9 tests; 8 discriminating cases (7 of them
new `it(` blocks and 1 a rewrite); 2 non-discriminating additions.** "Nine" is a real number about the
suite's size and is not the number of discriminating cases; using it as a caption for a table of eight
makes the count unverifiable from the table.

**Source or record:** **record only.** The same "nine cases" wording is in
`docs/reviews/phase-2d-5-4-B.brief.md:63` (*"Nine new cases, each confirmed to fail against the pre-fix
code"*) and in `ee78429`'s own commit message. Both are `docs/` or immutable history; neither is source.
On its own, the fix for this finding would commission no round under `CLAUDE.md` §7.1 — but findings 1–5
do, so a round follows regardless.

**Can a test catch it?** No. This is the gap `CLAUDE.md` names: *"The i18n suites check parity and
placeholder agreement, not meaning… no executable test pins what a JSDoc contract claims."* Only a reader
counting the table catches it.

---

## The brief's five blind spots, answered

**(a) Is `ownedProjectionOf`'s reader enumeration complete apart from finding 2's miss, and is any
ingress still unnormalized?**

Partly. The four enumerated readers are each accurate (checked above). Finding 2's miss —
`positionInSameParse` → `positionOf` — is the only *missing* reader within the guarded-install window,
and it is the one that reads below the promised depth. One further post-guard third-level read exists
outside that window: `workspace.svelte.ts:3511` and `3517` read `match.id.document` in `select()`; that
one is benign because `select()` takes its captures at `3508`/`3513`, i.e. **after** the read, which is
the right order.

On ingresses: I swept every `commands.getDocument` / `commands.reloadDocument` call site rather than the
nine line numbers. There are seven — `2914`, `3454`, `4458`, `4525`, `4598`, `4664`, `4760` — and each is
immediately followed by `ownedProjectionOf`. The other two ingresses are `3249` (`ownedProjectionOf(adoption.disk)`)
and `3559-3560` (`ownedRepair(await repairSelection(…, commands.reloadDocument))`). **All nine are
normalized; I found no tenth `DocumentView` ingress.**

**But `DocumentSummary` is a whole unnormalized ingress class, and nothing in the record says so.**
`documents` holds command-supplied summaries at `3428` (`documents = listed.value`) and at `addDocument`
(`2713-2721`), there is no `ownedSummaryOf`, and those objects are read in at least four places that
matter: `2240` (inside the observation guard — finding 5), `2261`, `2343` (finding 4) and `3184`. That is
the same defect class the fix closed for projections, left open one type over.

**(b) Does the field-by-field copy give the compile-time check its JSDoc claims?**

**Today, yes — and only because neither wire type has an optional member.** `MatchView` is
`src/lib/ipc/types.ts:498-546`: 18 members, every one `readonly` and **none** marked `?`. `DocumentView`
is `src/lib/ipc/types.ts:561-621`: 24 members, same. I counted the copies against them:
`ownedMatchOf` (`498-519`) writes all 18; `ownedProjectionOf` (`557-588`) writes all 24. Both are
complete and both are exhaustive today.

The caveat the brief names is real and unstated: an optional property omitted from an object literal is
not an error, so the moment either type gains a `?` member the guarantee silently weakens for it. The
JSDoc at `481-486` says only *"A field added to {@link MatchView} later is a compile error in this
function"*, without the required/optional distinction. `2d-5-4-A-notes.md` §7 item 2 records exactly this,
*actionable* — correctly, since it names no present defect.

**(c) Is `sequences.isNewest` a pure read or an injected method?** Answered in full under finding 5: it is
an **injected interface method** (`observationTransitions.ts:215`) whose only implementation today
(`254-256`) is pure. The comment at `940-941` claims the implementation's property of the type.

**(d) The clear's new home — is there a path that marks and never clears, or one that clears a mark it
did not set?** Yes, and it is finding 3: the explicit reread at `3608` clears a mark it did not set and
that a newer `Unreadable` owns. I also checked the converse: no path marks and never clears that is not
already the intended blocked-session behaviour, and a newer `Removed` is correctly fenced because
`removeDocumentFromWindow` bumps the projection generation at `2479-2481`. The disclaimer at `2952-2962`
is about *membership*, and finding 3 is about *status ownership* — so the disclaimer does not cover it.

**(e) The six correction blocks in `docs/decisions/2d-5-4-notes.md`.** They are at lines `179`, `230`,
`315`, `394`, `686` and `727`. I checked each against the code it describes. Five are accurate. The
**sixth is not**: `727-738` closes with *"What survives as **recorded only** is the residue — **the third
level and below is still the command's own object**, and no type says so."* That residue is read after a
guard and between a check and a spend at `4474`, `4538` and `4617`, so under `CLAUDE.md` §7.3 it names a
correctness defect in a source file and the correct mark is **blocker**, not *recorded only*. This is the
class the brief warned about — *"a correction block is a source of new false claims in this project's
history"* — and it landed on the one block that decides whether a known defect closes with the step. The
block at `394-403` (the transitive-command count) I verified independently: `rereadUnderGuard` does end
with `await readFileText()` at `workspace.svelte.ts:2968` and the `removeDocument` member does call
`void readFileText()` at `2362-2364`, so *"two, not one"* is correct.

---

## What the review missed

Three things, all findable from the same sweeps:

1. **`DocumentSummary` is an unnormalized command ingress** with four readers, one of them inside the
   observation guard (`workspace.svelte.ts:2240`). Finding 4 touches one symptom; the class is not named.
2. **`observationTransitions.ts:1016` carries the same exposure as `968`** and is defended by the same
   positional sentence at `964-965`. Finding 5 names only the lower arm.
3. **`docs/decisions/2d-5-4-notes.md:737-738` marks finding 2's substance *recorded only***, which under
   §7.3 is the wrong mark for a correctness defect in source and would have let the defect close with the
   step.

And one correction to the review's own arithmetic, for the record: its finding 3 anchors at `2963`, a
comment line; the statement is at `2966`. Its finding 4 anchors at `2339`, the status-write check; the
caller-controlled read is at `2343`. Every other line number it gives — `3455`, `498`, `500`,
`selection.ts:134`, `observationTransitions.ts:968`, `1081-1084`, `2d-5-4-A-notes.md:172` — resolves
exactly.
