# Re-derivation of the six findings of `phase-2d-5-4-A`

Every finding below was derived again from the source at HEAD (`81e54db`), from the code and not from
the report — the report's bodies arrive truncated at 180 characters, so none of its reasoning past
that point was available to lean on. **No file was changed and no build, test, `cargo` or `npm`
command was run**, per the brief's prohibition; the phase's gate figures are taken as recorded and
were not re-measured.

Files read: `src/lib/browser/workspace.svelte.ts`, `src/lib/browser/observationTransitions.ts`,
`src/lib/browser/reconciliationCoordinator.ts`, `src/lib/browser/selection.ts`,
`src/lib/ipc/commands.ts`, the three suites named in the brief, `docs/decisions/2d-5-4-notes.md` and
`src/lib/components/DetailPane.svelte`.

**Summary: five HOLD as source defects, one is real but is mis-scoped as record-only.** Every one of
the reviewer's `path:line` citations resolved to the expression it claimed, and the one interleaving
that had two candidate shapes (finding 4) is stated in the report in the *reachable* shape and not in
the unreachable one — the arithmetic is right this time.

---

## Finding 1 — Cached projection getters still separate the guard from installation

**HOLDS — source defect** (and it falsifies a sentence in source and a sentence in the record).

### The mechanism

1. `open()` projects every file with the injected command surface and retains its answers **by
   reference**: `const view = await commands.getDocument(document.id);`
   (`src/lib/browser/workspace.svelte.ts:3184`), then `projected.push(view.value);` (`:3189`) and
   `views = projected;` (`:3199`). Nothing copies `view.value`. The five other installers do the same
   — `installView(fresh.value)` at `:4186`, `:4252`, `:4324`, `:4389`, `:4484`. So **`views` holds
   objects this module did not build**, and any one of them may carry an accessor `id`.
2. A `Changed`/`Addressable`/`Projected` observation for some *other* file reaches
   `applyChange` (`src/lib/browser/observationTransitions.ts:850`) and fires
   `workspace.rereadUnderGuard(document, guard)` (`:934`).
3. Inside the private helper the answer is now materialized — `const next: DocumentView = { ...fresh.value };`
   (`workspace.svelte.ts:2682`) — and the three captures are compared on both sides of the guard
   (`:2683`, `:2691`, `:2694`). That part of the fix is real and works: `next.id` is a data property.
4. `forgetFileText()` (`:2700`) then `installView(next)` (`:2701`). Inside `installView`:
   - `invalidateProjectionOf(next.id);` (`:2457`) — **the spend happens first**: the projection
     generation for this file is bumped.
   - `const index = views.findIndex((view) => view.id === next.id);` (`:2458`) — **this reads `.id` on
     every retained element of `views`**, i.e. on objects the injected command supplied. An accessor
     there runs arbitrary code, synchronously, *after* the final `stillCurrent()` at `:2694`.
   - `views = index === -1 ? [...views, next] : views.map((view, at) => (at === index ? next : view));`
     (`:2462`) — `index` was computed against the array as it was before the accessor ran; the `views`
     read on this line is a fresh read of the `$state` binding, so the map runs over whatever the
     accessor left behind.
5. Concrete re-entrancy: the accessor calls any synchronous public door that edits `views` —
   `state.removeDocument(other)` reaches `removeDocumentFromWindow` (`:2538`), which is fully
   synchronous and does `views = views.filter(...)` at `:2541`.

### Decisive lines

- `workspace.svelte.ts:2458` — `const index = views.findIndex((view) => view.id === next.id);`
- `workspace.svelte.ts:2462` — `views = index === -1 ? [...views, next] : views.map((view, at) => (at === index ? next : view));`
- `workspace.svelte.ts:3189` — `projected.push(view.value);` (the ingress that makes the elements caller-controlled)
- `workspace.svelte.ts:2641-2643` — the claim this falsifies (quoted under the JSDoc question below)

### The wrong outcome

Two shapes, both state-visible and both permanent:

- **A lost install with the invalidation already spent.** `views = [v1, v2, v3]`, the reread is of
  `v3`, `index === 2`; the accessor removes `v1`; `views` is now two long; `views.map` has no index 2,
  so `next` is **silently dropped**. `invalidateProjectionOf(3)` and `forgetFileText()` already ran,
  so the window keeps `v3`'s *old* projection while its projection generation says it was replaced —
  and `repairAfter(next)` at `:2702` then repairs the selection against a parse that is not in
  `views`, leaving a `MatchId` that names a node of a projection this window does not hold.
- **The wrong slot overwritten.** If the accessor appends one view and removes an earlier one, index 2
  now names a *different* document; `next` overwrites it. `views` then holds two entries for one
  document (`viewOf` returns the stale first one, `selection.ts`-style `find`-by-id) and a third
  document's projection is gone with nothing recording it.

Neither is reachable through the real Tauri IPC layer, whose answers are JSON-parsed plain objects.
That is equally true of the defect the previous round fixed at this exact call site, which this
project accepted as a blocker and pinned with `workspace.test.ts`'s *installs nothing when the
answer's own getter opens a surface* (`:8413`) — a test that plants a `value` accessor on an injected
command answer. The threat model is the project's own (`CLAUDE.md`: a property read runs arbitrary
code through a getter or a proxy trap, and `readonly` does not freeze at runtime), and the fix simply
did not reach one level down.

### Does any existing test cover it?

**No.** `workspace.test.ts:8413` plants an accessor on `CommandResult.value` only — the closed
instance. Nothing in `src/lib/browser/*.test.ts` plants an accessor on a `DocumentView.id`, on a
`views` element or on a `matches` element; the only `new Proxy` in the browser suites is
`workspace.test.ts:7172`, over the write-surface array.

### The smallest correct fix

Behaviourally: **`views` must never hold an object this module did not build.** Normalize each
`DocumentView` into a plain own-property object at the single point of ingress into `views` — which is
`installView` itself, plus `open()`'s `projected.push` — so that `findIndex`'s `.id` read is a data
read by construction. That is one copy per install and it closes the class rather than this instance;
a fix confined to `rereadUnderGuard` would leave the same exposure at `:4186`, `:4252`, `:4324`,
`:4389` and `:4484`, none of which materialize anything today. The alternative the report offers —
computing the replacement index before the final guard — fixes this call site only and leaves
`installView` unsafe for its other five callers, so it is smaller but not correct.

This belongs to **this step's fix round**, not to a later one: it is a correctness defect in a source
file inside the region under review, so `CLAUDE.md` §7.3 makes it a blocker rather than something a
phase may adopt.

---

## Finding 2 — `replaceSelection` does not protect repair from nested re-entry

**HOLDS — source defect, and the false claim is written in source (`workspace.svelte.ts:2646-2647`)
and repeated in the record (`2d-5-4-notes.md` §3.3 correction, and §7 item 12).**

### The mechanism

1. The guarded reread reaches its commit block: `installView(next)` (`workspace.svelte.ts:2701`) then
   `repairAfter(next)` (`:2702`). By this point the final `stillCurrent()` (`:2694`) is behind us and
   the install has happened.
2. `repairAfter` (`:4573`) tests `selected === null || selected.document !== view.id` (`:4577`) — both
   safe reads — and then calls `const found = reresolve(selected, view);` (`:4580`).
3. `reresolve` (`src/lib/browser/selection.ts:192`) reads
   `const candidate = view.matches[previous.position];` (`selection.ts:193`). `next.matches` is a data
   property whose **value is the command's own array**, so this index read fires a proxy `get` trap if
   the command returned a proxied array, or an accessor if one was defined on the index.
4. `matchFingerprint(candidate)` (`selection.ts:197`) reads `match.source_text` (`selection.ts:110`) —
   an accessor on the element object is the simplest vector of the two. `candidate.id` is read again at
   `selection.ts:203`.
5. Anything running in step 3 or 4 can call a synchronous public door. Two that matter:
   - `state.removeDocument(view.id)` → `removeDocumentFromWindow` (`workspace.svelte.ts:2538`) →
     `replaceSelection(null); notice = 'gone';` (`:2552-2553`), the row and the projection dropped.
   - `state.select(otherMatch)` → `selected = next;` at `:3259`, assigned **synchronously before its
     first await**, with `selectGeneration` bumped at `:3232`.
6. Control returns to `repairAfter`, which has re-checked nothing. It executes
   `replaceSelection(found.selected); notice = keptNoticeFor(attribution);` (`:4582-4583`).

### Decisive lines

- `workspace.svelte.ts:4580` — `const found = reresolve(selected, view);`
- `selection.ts:193` / `:197` / `:203` — `view.matches[previous.position]`, `matchFingerprint(candidate)`, `id: candidate.id`
- `workspace.svelte.ts:4582` — `replaceSelection(found.selected);` — the commit, computed from pre-re-entrancy state
- `workspace.svelte.ts:2330-2333` — `replaceSelection`'s whole body: `selectGeneration += 1; selected = next;`

### The wrong outcome

- **Removal shape.** `selected` ends up naming a document that is no longer in `documents` or `views`,
  and `notice` says `kept` over a file the window has just declared gone. That is the exact defect
  class `CLAUDE.md` names — *a `MatchId` that names nothing selected* — with a notice that asserts the
  opposite of what happened.
- **Click shape.** The person's fresh click is written at `:3259`, then overwritten at `:4582` by the
  repaired old selection; and `replaceSelection`'s bump at `:2331` then makes that click's own
  `get_match` lookup stale (`selectionLookupIsStale` at `:3270`), so the new selection is discarded
  *and* left unrepaired. This is precisely the harm `replaceSelection`'s JSDoc says it exists to
  prevent, happening because `repairAfter` never asks it anything.

### Why `replaceSelection`'s discipline does not bound it

`replaceSelection` does one thing: bump the intent counter in the same synchronous block as the write.
That cancels **asynchronous lookups taken earlier**. It performs no check of its own, it has no
opinion about the value it is handed, and `repairAfter` consults no generation between the
caller-controlled reads at `selection.ts:193-203` and the write at `:4582`. Last write wins, and the
last write is the stale one. The discipline is real; it is simply about a different hazard.

### Does any existing test cover it?

**No.** No suite plants an accessor or a proxy on `DocumentView.matches` or on a `MatchView`. The
nearest case, `workspace.test.ts:8413`, asserts that **nothing is installed** — it never reaches
`repairAfter` at all, because the guard refuses.

### The smallest correct fix

Behaviourally, one of two, and they are not equivalent:

- **Normalize at ingress (preferred, and it subsumes finding 1).** Copy the view *and* the elements of
  `matches` this module will later read into plain own-property objects before anything is retained or
  repaired against. Then `reresolve` reads data properties and no re-entrancy is possible.
- **Validate after the caller-controlled reads.** Have `repairAfter` re-take the state its decision
  depends on — the selection identity, the document's projection generation, and whether the document
  is still held — after `reresolve` returns and before `replaceSelection`, abandoning the repair when
  any moved.

Either is local to this step. The second is smaller but leaves the same hazard for every future reader
of `matches`; the first is the one that makes the sentence in the JSDoc true rather than merely
narrower.

---

## Finding 3 — An obsolete reread failure overwrites newer document status

**HOLDS — source defect.**

### The mechanism

1. A `Changed`/`Addressable`/`Projected` observation for document D, sequence 5, is admitted;
   `applyChange` calls `workspace.rereadUnderGuard(D, guard)`
   (`observationTransitions.ts:934`).
2. The host member marks the file immediately — `noteDocumentStatus(document, { kind: 'stale' });`
   (`workspace.svelte.ts:2120`) — and fires the private helper without awaiting it (`:2121`).
3. While `commands.reloadDocument(D)` (`:2670`) is in flight, a later batch carries a `Removed` for D
   at sequence 6. `applyRemoval` admits it and runs `workspace.removeDocument(route.document);` then
   `workspace.noteDocumentStatus(route.document, { kind: 'removed' });`
   (`observationTransitions.ts:1011-1012`). The row, the projection, the pending mark and the load
   failure are gone; the status is `removed`.
4. The earlier read now rejects — which is the *likely* outcome, since the file it names is gone. The
   private helper takes its failure arm **without consulting `stillCurrent()` at all**:
   `if (!fresh.ok) { report(fresh.failure); return fresh.failure; }` (`:2671-2677`).
5. The host's `.then` callback (`:2127-2132`) sees a non-null failure and writes
   `noteDocumentStatus(document, { kind: 'stale' });` (`:2131`). `noteDocumentStatus` (`:2573`) drops
   the previous entry for that document whether or not a new one replaces it, so **`removed` is
   overwritten by `stale`** — for a document the window no longer holds a row for.

### The same defect has a second, sharper interleaving the report did not reach

Two overlapping rereads of one file. Read #1 (sequence 5) is in flight; a `Changed` at sequence 6
starts read #2. Read #2 succeeds, so its guard clears the mark —
`workspace.noteDocumentStatus(document, null);` (`observationTransitions.ts:931`) — and installs the
current bytes. Read #1 then comes back a failure and re-marks `stale` at `workspace.svelte.ts:2131`.
The window is showing the newest bytes and is marked as showing older ones. This matters because
**the source comment defending that write asserts the opposite**:

> `workspace.svelte.ts:2107-2109` — *"Marking it again when the read fails is not redundant: an
> overlapping reread of the same file may have cleared it in between, and this read's failure is still
> the newest true thing about it."*

An overlapping reread that cleared the mark cleared it **by installing**, which is exactly the case in
which the failure is *not* the newest true thing about the file. The same sentence stands in the
record at `docs/decisions/2d-5-4-notes.md:269-270`.

### Decisive lines

- `workspace.svelte.ts:2671-2677` — the failure arm returns before any capture is compared
- `workspace.svelte.ts:2127-2132` — the callback, which consults nothing
- `workspace.svelte.ts:2573-2579` — `noteDocumentStatus`, last-writer-wins by construction
- `observationTransitions.ts:1011-1012` / `:931` — the two newer statuses this can overwrite

### The wrong outcome

`externalDocumentStatus(D)` answers `{ kind: 'stale' }` — *"The file changed on disk and this window
is still showing the older projection"* (`observationTransitions.ts:122-124`) — when the truth is
either *removed* (the window holds nothing at all for D) or *reconciled* (the window holds the newest
bytes). The `Unreadable` variant is the same shape and loses a typed `UnreadableReason` that is never
re-derived, because the watermark has advanced past the observation that carried it. Nothing draws the
status today, so the harm is state-visible rather than user-visible until 2d-6 — which is the step
whose whole job is drawing it.

### Does any existing test cover it?

**No.** `workspace.test.ts:8378` (*leaves the file marked stale when the guarded reread fails*) drives
the failure arm with nothing else happening. No case in any of the three suites overlaps a failing
reread with a newer observation or with a second reread of the same file.

### The smallest correct fix

The failure arm must re-state staleness **only while its read is still the newest thing the window
knows about that file** — and never for a file the window no longer holds. Concretely: the host member
captures what the private helper already captures (the re-read generation for that document, and the
open generation), and the callback writes only when they still hold and `holdsDocument(document)` is
true. Equivalently, the private helper can answer *whether the failure was still current* rather than
bare `IpcFailure | null`, which keeps the comparison in the one function that owns those captures.
This step's fix round, not a later one.

---

## Finding 4 — The stopped-session arm erases a newer unreadable reason

**HOLDS — source defect, and it is a regression introduced by the previous round's own fix.**

### The mechanism

1. Document A gets a `Changed`/`Addressable`/`Projected` observation at sequence 4. No surface targets
   A, so `applyChange` reaches `workspace.rereadUnderGuard(document, guard)`
   (`observationTransitions.ts:934`) and the read goes out.
2. A later batch carries an `Unreadable` for A at sequence 5. `applyUnreadable` admits it and records
   `workspace.noteDocumentStatus(route.document, { kind: 'unavailable', reason: route.reason });`
   (`:1036`). **Note what it does not do**: it installs nothing and invalidates no projection, so the
   in-flight read's three captures are all still intact.
3. A later batch raises `discarded`, so `accept()` enters `blockedByLostHistory`
   (`reconciliationCoordinator.ts:899`) and `recoverFromLostHistory()` defers because a write surface
   — over some other file B — is open (`:854-855`). The block stands, so
   `stillApplying: () => !disposed && block.kind !== 'blockedByLostHistory'` (`:934`) now answers
   `false`.
4. A's read resolves successfully. `stillCurrent()` at `workspace.svelte.ts:2683` passes (nothing moved
   the open generation, the re-read generation or A's projection generation — step 2 moved none of
   them), so `guard()` is called.
5. The guard's **first** question refuses and writes:
   `if (!session.stillApplying()) { workspace.noteDocumentStatus(document, { kind: 'stale' }); return false; }`
   (`observationTransitions.ts:908-911`). The question that would have refused *silently* —
   `if (!sequences.isNewest(document, route.sequence)) { return false; }` (`:916-918`), whose whole
   point is that "somebody else's transition owns this file now" — is asked **third**, and never runs.

### Why the ordering is the defect, and why only this arm is reachable

Of the three refusing arms that write a status, `isNewest` can only be pre-empted by the two asked
before it: `stillApplying` (`:908`) and `epochNow` (`:912`). The epoch arm is unreachable from the
production host — `epoch` moves only through `accept()`'s adoption after a `workspaceOpened()`, and
`open()` bumps `openGeneration` in its first statement (`workspace.svelte.ts:3058`), so the pre-guard
`stillCurrent()` at `:2683` refuses before the guard is ever called. **`stillApplying` is therefore the
only question that can mask a newer observation**, and it is the one the previous round added and
placed first. The report's interleaving is stated in the reachable shape: an `Unreadable` at step 2
moves nothing the host captured, whereas a `Removed` would call `invalidateProjectionOf`
(`workspace.svelte.ts:2540`) and the pre-guard comparison would refuse first. The reviewer picked the
right one.

### The wrong outcome

`externalDocumentStatus(A)` answers `{ kind: 'stale' }` instead of `{ kind: 'unavailable', reason }`.
The typed `UnreadableReason` is destroyed and cannot be recovered: a blocked session advances the
watermark (`reconciliationCoordinator.ts:907`), so the observation is never redelivered. When 2d-6
draws these codes, the person is told the file changed on disk when what the engine actually reported
is that its bytes cannot be read, and *why* is gone. **No accessor, no proxy and no exotic host is
needed — this is ordinary batch interleaving.**

### Does any existing test cover it?

**No, and the nearest test states its own blind spot.** `observationTransitions.test.ts:576`
(*refuses and marks stale when the session has stopped applying*) comments at `:581-585`: *"nothing
else the guard compares has moved. The epoch is the same, no newer observation was admitted…"* — the
finding is exactly the case where one has. `:616` (*refuses silently when a newer observation of the
file was admitted*) drives the newer observation with the session still applying. No case combines
them.

### The smallest correct fix

**Ownership before any refusal writes a status.** Ask `sequences.isNewest(document, route.sequence)`
first, so that a guard whose observation has been superseded refuses silently whatever else is also
true; keep `stillApplying` ahead of `tellTheSurfaceAbout` (`:919`), which is the ordering the JSDoc at
`:887-895` actually argues for. This is safe: `isNewest` is a pure read of the accepted-sequence map
(`:215`, `:254`) and fires no callback, so hoisting it above `stillApplying` can only suppress a status
write, never a component callback. Equivalently, leave the order alone and make each of the three
status-writing arms conditional on `isNewest` — same behaviour, three copies of one rule instead of
one, which is the shape this project usually refuses. This step's fix round.

---

## Finding 5 — Successful explicit recovery leaves the new stale mark behind

**HOLDS — source defect, and it is wider than the report states.**

### The mechanism

1. Anything marks D `stale`: the host's mark-before-the-read (`workspace.svelte.ts:2120`), the failure
   arm (`:2131`), `tellTheSurfaceAbout` (`observationTransitions.ts:968`), or any of the guard's
   refusing arms (`:909`, `:913`, `:926`).
2. The person uses the recovery control that the mover and the duplicator draw —
   `reload={(document) => browser.rereadDocument(document)}` in
   `src/lib/components/DetailPane.svelte:1237` and `:1258`.
3. `BrowserState.rereadDocument` is `return rereadUnderGuard(document, ALWAYS_PERMITTED);`
   (`workspace.svelte.ts:3331`, with `ALWAYS_PERMITTED` at `:1772`). The read succeeds, so `:2700-2703`
   runs: `forgetFileText(); installView(next); repairAfter(next); await readFileText();`.
4. **Nothing on that path touches `externalStatuses`.** The only two writes in the whole module are
   `:2120` and `:2131`, both in the coordinator-facing member, and the only clear in the application is
   `workspace.noteDocumentStatus(document, null)` inside the coordinator's guard
   (`observationTransitions.ts:931`) — which `ALWAYS_PERMITTED` is not. The other clear is `open()`'s
   wholesale `externalStatuses = [];` (`workspace.svelte.ts:3110`).

### It is wider than stated

`rereadDocument` is only the reachable instance. **No `installView` caller clears the status**: not
`adoptTheDocumentOnDisk` (`:4186`), not `adoptTheReplacedDocument` (`:4484`), not `applyRepair`
(`:2826`, `:2834`), not `adoptDiskVersion` (`:3048`). A file marked `stale` because a write surface
was open — `tellTheSurfaceAbout` at `observationTransitions.ts:968`, the ordinary conflict path — and
then reconciled by that surface's own save-and-adopt keeps the mark for the rest of the session.

### The wrong outcome

`externalDocumentStatus(D)` keeps asserting *"The file changed on disk and this window is still
showing the older projection"* (`observationTransitions.ts:122-124`) about a file whose projection was
just read from disk. The mark is cleared by nothing short of a coordinator-guarded reread or a whole
`open()`, so it survives indefinitely. As with findings 3 and 4, nothing draws it before 2d-6, so it is
state-visible today and user-visible then.

### Does any existing test cover it?

**No.** `workspace.test.ts` asserts `externalDocumentStatus` at ten places (`:7945`, `:7986`, `:8028`,
`:8029`, `:8076`, `:8182`, `:8220`, `:8255`, `:8408`, `:8472`); none of them follows a stale mark with
a successful `rereadDocument` or with any other install. The `rereadDocument` cases (`:1743`, `:1767`,
`:1789`, `:1817`, `:1850`, `:6186`, `:6491`, `:7082`, `:7132`) predate the status and never read it.

### The smallest correct fix

**A successful install produced by a read taken now clears that file's status, and the clear lives
with the install rather than in the coordinator's guard.** Put it in `rereadUnderGuard`'s success
block, in the same synchronous run as `installView`, and delete the clear at
`observationTransitions.ts:931`. That closes this finding for both callers of the helper, and it
closes `2d-5-4-notes.md` §7 item 7 as a by-product — item 7 exists only because the clear currently
happens inside the guard, *before* the third capture comparison.

**Do not generalize the clear to `installView`.** `adoptDiskVersion` installs `adoption.disk`
(`:3048`), a snapshot carried by a conflict rather than a read taken now, so clearing there would
claim a currency the window does not have. The non-reread installers are a **2d-5-5** question — that
is the step that owns external conflicts and save arbitration, and deciding what a committed save's
adoption may say about a file the watcher reported is its decision, not this round's.

---

## Finding 6 — The corrected command-reachability claim still omits `document_text`

**PARTLY — the defect it names is real; its classification as *record-only* is wrong, and under
`CLAUDE.md` §7.1 that classification is the part that decides whether another round runs.**

### The part that holds: the claim is false

`docs/decisions/2d-5-4-notes.md:317-318` says, after round 1's correction narrowed it from *the
window* to `applyObservation` itself:

> *"The only open-workspace document command **`applyObservation` itself** can reach is
> `reload_document`, through `rereadUnderGuard`, from the `changed`/`Addressable`/`Projected`
> combination alone."*

Two call chains falsify it, both requiring only that the raw viewer is open (`fileTextShown`):

1. `applyObservation` → `applyChange` (`observationTransitions.ts:850`) → `workspace.rereadUnderGuard`
   (`:934`) → the host's private helper → on success `await readFileText();`
   (`workspace.svelte.ts:2703`) → `const answer = await commands.documentText(target.id);` (`:2800`) →
   `call<string>('document_text', { id })` (`src/lib/ipc/commands.ts:353`). The viewer's snapshot was
   dropped one line earlier by `forgetFileText()` (`:2700`), so the identity comparison at `:2787`
   cannot short-circuit the read — **this path sends `document_text` every time it installs.**
2. `applyObservation` → `applyRemoval` (`observationTransitions.ts:1011`) → the host's
   `removeDocument` member, whose body is `removeDocumentFromWindow(document); void readFileText();`
   (`workspace.svelte.ts:2145-2148`) → the same command. `applyNamedRow`'s `removed` arm (`:1086`)
   reaches it too.

So `applyObservation` can reach **two** open-workspace document commands, not one.

### The part that does not hold: it is not record-only

**The identical claim is in source**, in the JSDoc of `applyObservation` itself:

> `src/lib/browser/observationTransitions.ts:749-751` — *"The only open-workspace document command
> reachable from here is the reread of {@link ReconciliationWorkspace.rereadUnderGuard}, and it is
> reachable from the `changed`/`Addressable`/`Projected` combination alone."*

There is no reading under which that sentence is true and non-vacuous: `rereadUnderGuard` is a host
member, not a command, so the sentence is necessarily about commands reached transitively — and
transitively it reaches `document_text` through two host members. **A fix that corrects the record and
leaves this standing fixes half of the defect; a fix that corrects both touches a source file, and
§7.1 then commissions another round.** That is the orchestrator's decision and it should be taken
knowingly rather than inherited from the report's "record-only" label.

### What the finding is *not*

It is **not** a breach of ruling 28. The identity `document_text` is sent for is `fileTextTarget()`'s
answer (`workspace.svelte.ts:2727-2733`), which filters `pendingAdditions` out of the candidate list,
so no unaddressable identity reaches the command — the route round 1 closed stays closed. What is
wrong is an enumeration presented as exhaustive, in both files. The severity is *a claim that is
false*, not *a command that is unsafe*, and the fix is the sentence, not the code.

### Does any existing test cover it?

**No, and the round-1 fix that rewrote the routing cases cannot see it.** `documentCommandCounts`
(`workspace.test.ts:7886-7899`) does compare `documentText` among its six reading commands, and the
baselines are now taken before a controlled wake — both genuine improvements. But every case runs with
the raw viewer closed, so `readFileText` returns at `if (!fileTextShown) { return; }`
(`workspace.svelte.ts:2784`) and `document_text` is never sent. A case that turns the viewer on
before delivering a `Changed` observation would both demonstrate the reachability and pin whatever the
corrected sentence ends up claiming.

### The smallest correct fix

Rewrite both sentences to say what is true: the observation arms themselves request exactly one
document command, `reload_document`, from the `changed`/`Addressable`/`Projected` combination; and the
host's own viewer refresh, which any projection replacement or removal triggers, sends `document_text`
for the viewer's target when the viewer is open — an addressable identity in every case, so ruling 28
holds. Add the viewer-open case to one routing test if the claim is to be load-bearing.

---

## The JSDoc question: is the sentence finding 2 attacks true?

### The sentence, as it stands in source

`src/lib/browser/workspace.svelte.ts:2640-2647`:

> *"**Exactly what that guarantees, and what it does not.** Between the final `stillCurrent()` and
> `installView` there is now no read of `fresh` and no read of a property this module did not write:
> `installView` takes `next.id` off the copy, which is a data property of an object made here. It does
> **not** deep-copy — `next.matches` is still the command's own array, so `repairAfter`, which runs
> *after* the installation, reads elements this module did not build, and a getter on one of those
> could run there. What bounds that half is `replaceSelection`'s own discipline rather than this
> comparison, and no type expresses either."*

### What `replaceSelection` actually does

`workspace.svelte.ts:2330-2333`, the entire body:

```
function replaceSelection(next: SelectedMatch | null): void {
  selectGeneration += 1;
  selected = next;
}
```

It increments a counter and assigns. It reads nothing, compares nothing and refuses nothing. Its own
JSDoc (`:2303-2328`) describes its discipline accurately and narrowly: *"no selection is assigned
without `selectGeneration` having been bumped in the same synchronous block, so an answer that lands
afterwards is describing an intent nobody holds"* — a statement about **asynchronous lookups taken
earlier**, and about nothing else.

### What `repairAfter` actually does

`workspace.svelte.ts:4573-4589`: it reads `selected` and `view.id` (`:4577`), calls
`reresolve(selected, view)` (`:4580`) — which reads `view.matches[previous.position]`
(`selection.ts:193`), `candidate.source_text` (`selection.ts:110`, via `:197`) and `candidate.id`
(`selection.ts:203`), all on objects this module did not build — and then commits at `:4582` or
`:4586` **with no re-read of `selected`, no comparison of any generation, and no check that the
document is still held**.

### The verdict, clause by clause

- *"Between the final `stillCurrent()` and `installView` there is now no read of `fresh` and no read
  of a property this module did not write"* — **true-but-narrower-than-it-sounds**, and misleading in
  its second half. Taken literally about the interval between line `:2694` and line `:2701` it is
  true: only `forgetFileText()` runs there. But it is offered as *exactly what that guarantees*, and
  the clause after the colon enumerates `installView`'s caller-controlled reads as **`next.id` alone**
  — which is incomplete. `installView` also runs
  `views.findIndex((view) => view.id === next.id)` (`:2458`) over retained command-supplied objects.
  Finding 1 is that omission.
- *"`repairAfter` … reads elements this module did not build, and a getter on one of those could run
  there"* — **true**, and the honest half of the paragraph.
- *"What bounds that half is `replaceSelection`'s own discipline rather than this comparison"* —
  **false**. `replaceSelection` bounds asynchronous lookups; it does not bound synchronous re-entry,
  and it is not consulted by `repairAfter` about anything. The only true sentence in its neighbourhood
  is far weaker: *whatever a re-entrant caller does, `repairAfter`'s own write still bumps the intent
  counter, so no lookup taken before it survives* — which says nothing about the **value** being
  written, and the value is the defect.
- *"and no type expresses either"* — true, and it is what makes the false clause dangerous: nothing
  can fail it.

The record repeats the false clause twice — `docs/decisions/2d-5-4-notes.md:219-222` (§3.3's round-1
correction block) and `:612-614` (§7 item 12, which additionally asserts *"the installation itself is
now atomic against the final check"*, flatly falsified by finding 1, and marks the item **recorded
only** on that basis). This is `CLAUDE.md`'s named worst defect class — a record claiming a guarantee
the code does not give — reproduced in a **source** file one round after the round that introduced it.

---

## What the orchestrator must decide

1. **Findings 1-5 are source correctness defects inside the fix region.** Under `CLAUDE.md` §7.3 an
   actionable item naming a correctness defect in source is fixed now or the step is `BLOCKED`; none
   of them may be carried.
2. **Finding 6's "record-only" label is wrong.** Fixing only `2d-5-4-notes.md:317` leaves the same
   false claim at `observationTransitions.ts:749-751`. Fixing both touches source, and §7.1 then
   commissions another round scoped to that fix.
3. **§7 item 12 of the notes is marked *recorded only* on the strength of a claim findings 1 and 2
   both falsify.** Whatever else is done, that mark is not defensible as it stands.
4. Findings 1 and 2 share one root — command-supplied objects retained and read after the guard — and
   one fix (normalizing at ingress) closes both. Findings 3, 4 and 5 share a different root: the
   `ExternalDocumentStatus` lifecycle has three writers and one clear, and none of the four is fenced
   by the ownership its own arm already knows about.
