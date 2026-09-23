# Phase 2d-7-1 — the `stale` ruling and its fix

**Date:** 2026-09-23.
**Spec:** [`2d-7-split-notes.md`](2d-7-split-notes.md) §2, the *2d-7-1* block; bound by §3 entries 27
and 28 and by §5.9. The handed-on items are [`2d-6-11a-notes.md`](2d-6-11a-notes.md) §5 item 1 and
[`2d-6-9b-3-notes.md`](2d-6-9b-3-notes.md) §6 item 1.
**Risk:** `high`. **No Rust, no string, no component, no instrument path changed.** No window was
launched.

---

## 1. The two items

1. **11a §5 item 1.** A reading arrives while the raw editor is open and its save is out. The
   coordinator marks the file `stale` (`markStaleWhileOurs`, `observationTransitions.ts`), the
   surface hands the reading to `observeExternalChange`, and the barrier holds it. The save commits on
   exactly those bytes. The release drops the reading as `writtenHere`, and the mark used to stay,
   although the window held the bytes the watcher read.
2. **9b-3 §6 item 1.** An automatic read is out with no hold. The coordinator's host member has
   marked the file `stale`. A write that may have written then settles, and it establishes the hold.
   Its re-adoption installs a parse, so the read's projection capture refuses the answer before the
   host's hold recheck runs. Nothing is installed and nothing is registered. The file used to end
   `stale`, held, with nothing to acknowledge: the reread is refused `uncertaintyUnresolved`, and
   `noStandingOrigin` draws no control.

## 2. The ruling

**What `stale` means while a write surface is open.** It means what it means everywhere since
2d-6-9b-1: *the window holds a disk snapshot of this file newer than its installed projection*. An
open write surface is a reason the window may hold such a snapshot without installing it (ruling 19).
It does not change the meaning. So a mark is owed exactly as long as something the window holds backs
it, and it is cleared once nothing does. Two refinements follow:

- **A `writtenHere` release clears the mark when the window holds the dropped reading's bytes and no
  later cause has written the file's status.** The reading names the revision the write ended on. If
  the installed projection is of that revision, the window holds no snapshot newer than what it
  shows. If the re-read after the commit failed, the window does not hold those bytes, and the mark
  stands. If anything wrote the status after the barrier took the reading, that mark belongs to the
  later cause, and it stands.
- **An automatic read that ends under an uncertainty hold, with its observation neither installed nor
  registered, clears the mark it wrote itself if a projection has replaced the one the observation
  arrived at.** Registration would need the generation the observation arrived at. The window has
  moved since, so the origin would be `projectionReplaced` and not acknowledgeable. Registering it at
  today's generation would claim the observation saw a window it never saw, which
  `adoptDiskVersion`'s generation check exists to refuse. So the window holds no snapshot that could
  back the mark. The hold stays, and it is the true statement about the file: this window cannot
  attribute what is on disk. **The file ends not `stale`, under the hold**, which is the state a hold
  with nothing observed already has. Its exits are unchanged: a later write of this window's ending on
  a named revision, `open()`, or a further observation, which is refused and registered, so it is
  acknowledgeable.
- **Without a hold, the second shape keeps its mark.** The person's reread is offered and not refused,
  so the mark has an exit. A conservative mark with an exit is the over-refusal cost ruling 19
  accepts.

**What the ruling does not know, stated.** Revisions are hashes and carry no order.
- In item 2, the re-adoption's `get_document` may have been sent before the observation arrived. Its
  answer is installed after the arrival, but the answer may describe older bytes. The ruling clears
  without knowing which bytes are newer, for the reason given above: under the hold, a mark nothing
  can discharge says nothing the hold does not already say.
- In item 1, a mark written *before* the barrier took the reading is cleared too, whatever wrote it.
  An example is an earlier refused save. The window now holds the bytes of a reading that arrived
  later. "Later" is arrival order in this window, the same inference `adoptDiskVersion`'s clear makes.

### 2.1 Provenance: a registry question, not a new field

The acceptance asks how a mark's cause is known (§5.9). **It is a registry question: the file's
status-write count** (`statusWrites` in `workspace.svelte.ts`). `noteDocumentStatus` bumps it and
nothing else does. `ExternalDocumentStatus` keeps `{ kind: 'stale' }` with no cause field.

- A clear captures the count when it takes its cause in. It clears only while the count is unmoved.
  An unmoved count means nothing has written the file's status since that cause was taken in.
- This is the mechanism `adoptDiskVersion` already used (`conflictStatusWrites`, 2d-6-9b-1), and the
  one the reread installation uses (`statusAt`). This phase adds two captures:
  - `RetainedObservation.statusWrites`, taken when the barrier takes a reading in. On the
    coordinator's path the reading's own mark is already counted, because `tellTheSurfaceAbout` marks
    before it calls the surface. A reading coalesced away leaves the held record, capture included,
    untouched.
  - `markedAt` in the host's `rereadUnderGuard` member, taken right after that member's own mark.
- **What the count cannot say:** *who* wrote a mark older than the capture. Section 2 says what the
  ruling does about that: it clears such a mark, and says so.

A new field was rejected for two reasons. It would widen a type that `reconciliationStatus.ts`, both
renderers and the i18n accessors read. And it would still need the same fence, because a field says
who wrote a mark, not whether anything wrote over it since.

### 2.2 9b-3 §6 items 2–3 are not needed

- Item 2 (coalescing into an outlived origin) decides whether a refused observation registers. It does
  not decide whether a mark is backed in either shape above.
- Item 3 (`observationRetained` not asked on the automatic path) concerns installation, not marks.

The ruling is therefore made, and **G4's stale-under-hold rows are not named unread** on this
account.

## 3. The fix

All in `src/lib/browser/workspace.svelte.ts`:

- **`RetainedObservation.statusWrites`**, captured in `retainObservation` whenever a reading replaces
  what is held.
- **`clearTheWrittenReadingsMark(document, statusWrites, revision)`**, called from the lease's
  `close()` on the `writtenHere` arm, before the delivery. It clears only when all three hold:
  - the status is `stale`;
  - the count equals the capture;
  - `viewOf(document)?.revision` equals the revision the write ended on.

  Every operand is this state's own data. The settlement's revision is this module's literal, so the
  caller's observation is not read again inside the `finally`.
- **`clearAnUnbackedMark`** in the coordinator-facing `rereadUnderGuard` member, run once the private
  helper's promise settles. It clears only when all of these hold:
  - this member wrote the mark (`owns()` answered `true`);
  - the observation was not registered;
  - the open generation is unmoved;
  - the count equals `markedAt`;
  - the status is `stale`;
  - the file is under a hold;
  - the projection generation moved since the arrival;
  - a projection is installed.

Comments whose claims the change falsified were corrected:
- the `stale` arm's doc in `observationTransitions.ts` (the provenance and the four clears);
- the coordinator guard's "no arm here clears";
- the private helper's "no arm that refuses clears anything", now scoped to that helper;
- the host member's 9b-3 bullet.

## 4. Tests

**Model, `src/lib/browser/workspace.test.ts`:**

| Case | Pins |
|---|---|
| *clears the mark the held reading wrote when the release drops it as written here* (new suite *a stale mark across a writtenHere release — Phase 2d-7-1*) | item 1 fixed. It uses the real coordinator: a wake behind a registered raw editor whose transition forwards to `observeExternalChange`. |
| *keeps the mark when the committed save could not be re-read…* | mark **stands**: the window does not hold the reading's bytes |
| *keeps a mark written after the reading was held, which is another cause's* | mark **stands**: provenance. A later reading of other bytes marks the file and is never held, so the count moved. |
| *installs nothing when the hold is established while the automatic read is out, and leaves the file not stale* (the 9b-3 pinned case, moved) | item 2: the file ends **not `stale`**, still held, with no origin and nothing installed |
| *keeps the mark of a read the projection capture refused when no hold stands* | mark **stands** without a hold. A committed raw save replaces the projection while the read is out. |

**Mounted, `src/lib/components/DetailPane.test.ts`:** row 7(b)/(c), *a reading held behind a
committed raw save*. The comment that said 11a left the mark open is replaced by assertions:
- `writtenHere` ends with status `null`;
- a reading of other bytes ends `stale` beside the raised conflict.

### 4.1 Shown failing first on the unfixed tree

The tests were written first. Before any source edit, they were run with
`npx vitest run src/lib/browser/workspace.test.ts -t "2d-7-1|hold is established while the automatic read is out|keeps the mark of a read"`,
which gave `Tests  2 failed | 3 passed | 380 skipped (385)`. Verbatim failure lines:

```
 FAIL  src/lib/browser/workspace.test.ts > what a conflict does to this window, and what only a confirmed reload does > entry 15 on the coordinator’s automatic reread — Phase 2d-6-9b-3 > installs nothing when the hold is established while the automatic read is out, and leaves the file not stale
AssertionError: expected { kind: 'stale' } to be null
 ❯ src/lib/browser/workspace.test.ts:13149:47

 FAIL  src/lib/browser/workspace.test.ts > what a conflict does to this window, and what only a confirmed reload does > a stale mark across a writtenHere release — Phase 2d-7-1 > clears the mark the held reading wrote when the release drops it as written here
AssertionError: expected { kind: 'stale' } to be null
 ❯ src/lib/browser/workspace.test.ts:13413:47
```

(The same two cases also tripped the file's `afterEach` undisposed-state check —
`expected 1 to be +0` — because the failing assertion stopped them before `dispose()`.) The three
"stands" cases passed before the fix and after it, as a keep-standing pin should.

## 5. Gates

Each gate was run alone, with its output redirected to a file and read from that file. The tree
includes the uncommitted instrument.

| Command | Result |
|---|---|
| `npm test` | 0 — **3539 passed**, 72 files |
| `npm run check` | 0 — **462 files**, 0 errors, 0 warnings |
| `npm run build` | 0 — **201 modules** |
| `cargo test --workspace -- --test-threads=1` | 0 — **1323 passed**, 0 failed |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | nothing found (server-only absent) |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | `2` (client-only present) |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | `5 insertions(+), 1 deletion(-)`, unchanged |

**Rung:** Rust 1323 / svelte-check 462 / vitest 3535 → **3539** (+4: three cases in the new suite and
the no-hold case; the moved 9b-3 case is the same case) / Vite **201**. **Module-count delta: zero.**
No `.ts` module and no component was added: the fix is inside `workspace.svelte.ts`. `cargo fmt` was
not run, and no Rust changed.

## 6. Open items (not fixed here, `CLAUDE.md` §7)

1. **Hold shapes with the projection unchanged still end `stale` with nothing to acknowledge.** The
   ruling would say *register the observation* (acknowledgeable, because the arrival generation is
   still current), but this phase fixes neither shape:
   - the automatic read **fails** after the hold is established while it is out;
   - the coordinator's guard refuses on the **registry generation** (a surface opened and closed
     during the read) under a hold.

   Both refusals return before the host's installation-time recheck, so `registerTheRefused` never
   runs. The first is also the 9b-3 note's *"same shape"*.
2. **A raw save's re-adoption that drops the projection** (`adoptTheReplacedDocument` whose
   `get_document` fails) while an automatic read is out under a newly established hold. No projection
   is installed, so `clearAnUnbackedMark` keeps the mark, and nothing is registered. The ruling has
   not decided what `stale` means with no projection at all.
3. **A hold refused at the request.**
   - With `owns()` false, nothing is registered and nothing is marked, so no dead mark is left.
   - With a `null` narrowed observation, the mark *is* written and nothing is registered, which is a
     dead mark. `applyChange` returns before the read for non-`Projected` content, so its one call
     passes `null` only if the wire content's `in` check and the narrowing disagree.

   Neither case is touched by this phase.
4. **Clearing a mark older than a `writtenHere` reading**, for example one written by an overlapping
   write's refused save, relies on arrival order (section 2). A later phase that gives revisions an
   order could narrow it.
