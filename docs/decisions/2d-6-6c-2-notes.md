# Phase 2d-6-6c-2 — the window reading, two carried fixes, and 2d-6-6's acceptance in one place

**Status: implemented, reviewed once (Codex, 1 BLOCKER, held), fixed, gates green.** §6 records the fix round. Risk class: **high**. This is the second
half of 2d-6-6c ([`2d-6-split-notes.md`](2d-6-split-notes.md) §2, *The orchestrator's cut of
2d-6-6*). It covers three things:
- the narrow window reading of the three authored panels, recorded in
  [`2d-6-6c-2-window-reading.md`](2d-6-6c-2-window-reading.md);
- the two code items carried from [`2d-6-6c-1-notes.md`](2d-6-6c-1-notes.md) §4, items 6 and 7;
- 2d-6-6's whole acceptance, checked clause by clause in §3.

**No new key, no new module, no new component, and no tracked `src-tauri/` file changed.** The
instrument's untracked files changed. They are recorded in the reading, §2.

---

## 1. What changed

### 1.1 Carried item 6 — the editor's copy disclosure bound to its snapshot

The problem: `MatchEditor.svelte` kept one component-wide flag,
`copied: 'none' | 'copied' | 'failed'`. Only *Keep editing* and a new save reset it. An editor's
external conflict can be replaced by a later change to the same file while the editor stays open,
and the flag then told the person that the new conflict's draft had been copied. A clipboard answer
that arrived late was also installed over whatever conflict was on screen when it landed.

The fix follows 6c-1's review fix in `MatchCreator.svelte` exactly:
- `copied` is now `CopyDisclosure | null` (`MatchEditor.svelte:447`). It records the conflict object
  the copy was made under, the exact text handed to the clipboard (`tDraftCopy(view.retainedDraft)`,
  taken **before** the clipboard is asked), and the result.
- The drawn disclosure is `copyShown` (`:469`), a `$derived` that answers the result only while
  `view.conflict` is that same object **and** the retained draft still renders to that exact text.
- `copyTheDraft` (`:726`) records the answer against its own snapshot.
- The two resets now write `null`. The comment at the save reset was corrected: it had argued
  reachability, and it now says that `copyShown` already hides a stale record.

**Not forced:** that the clipboard still holds the text. The sentence says that a copy was made.

**Cases** (`MatchEditor.test.ts`, the new suite *the small editor's copy disclosure belongs to the
snapshot it copied*, `:1992`). `mountEditor` now captures the reported receiver as `deliver`, and
`changeTo(sequence, revision)` seals a `raised` envelope about the editor's own file. The two cases:
- *never shows a copy made under one conflict as a copy under the next* (`:1993`);
- *ignores a clipboard completion that arrives for a conflict no longer shown* (`:2024`), with
  `navigator.clipboard.writeText` held open across the second delivery.

**Pre-fix failure, verbatim, both cases** (run against the unchanged component; output in
`/tmp/6c2-editor-prefix.txt`): `AssertionError: expected true to be false // Object.is equality`,
at `expect(says(editor.target, 'browser.saveOutcome.draftCopied')).toBe(false)` (`:2013` and
`:2052`). **After the fix:** the file passes 48 of 48.

### 1.2 Carried item 7 — `BrowserState.saveMatch` after a commit

The problem: `saveMatch` recorded the commit with `write.expect(settlementOfOutcome(…))`. It then
awaited `adoptTheDocumentOnDisk` and `readFileText` with no catch. An exception out of either step
rejected the wrapper's promise, so a committed write surfaced as an error (`PROGRESS.md` D2,
`CLAUDE.md` §6). This is the shape 6c-1's finding 1 fixed in `createMatch`.

**Case** (`workspace.test.ts:4316`, `it.each` over `getDocument` and `documentText`): *answers a
committed field save as saved when the %s that follows it throws*. It runs through the real
`createBrowserState` over scripted commands. **Pre-fix failure, verbatim, both rows**
(`/tmp/6c2-save-prefix.txt`): `Error: the read after the commit threw`. The promise rejected instead
of answering.

**Fix** (`workspace.svelte.ts`, `saveMatch`, the block that ends at `// End of the post-commit
adoption and re-read`). It is the same `try`/`catch` as `createMatch`'s:
- An exception is answered as `adoption: { kind: 'failed', failure: classifyFailure(raw) }` beside
  the unchanged `saved` result. **Corrected by the fix round (§6):** as first written, this held only
  while `classifyFailure` itself did not throw. A thrown value whose `code` getter throws escaped the
  catch. The classification is now guarded as well.
- A throw before the adoption answered drops the replaced projection.
- A throw by the re-read keeps the new projection.
- A `failed` the adoption already answered is kept.

The `BrowserState.saveMatch` interface doc now states this.

**After the fix:** `workspace.test.ts` passes 330 of 330.

**Deliberately not touched:** `createMatch`'s identical catch (§5 item 7), and the `deleteMatch`, `moveMatch`, `duplicateMatch` and `saveRawDocument`
wrappers. Their audit is an open item (§5 item 2).

### 1.3 The window reading

Six proof launches, `L01`–`L06`: three panels × two languages, each into a fresh bundle path, with
the language chosen through the picker. There were also four shakedowns. The full record is
[`2d-6-6c-2-window-reading.md`](2d-6-6c-2-window-reading.md). Its findings:
- Every sentence the mounted suites read is drawn **verbatim** in both languages. This was checked
  against the dictionary files by a script outside the application.
- The panel appears about 306 ms after the external write.
- The observed revision equals the fixture's SHA-256.
- The external panel is revealed at the top of the detail scroller. **The editor's and the creator's
  choice rows are below the fold** in the 1180×728 window. The recovery form's panel and its choices
  are fully visible.
- The copy disclosure read `draftCopyFailed` under `click()` in a hidden window.

The host's screen was locked, so the visual evidence is WebKit snapshots taken through a new
instrument command, not a composited window (reading §4.6, §5).

## 2. Decisions

1. **Both carried code items were taken here, before the reading**, so the reading read the final
   code. Item 6 sits in a component the reading draws. Item 7 is a D2 defect that 2d-6-7 would
   otherwise inherit.
2. **The harness was rebuilt under a new name**, `/private/tmp/espansoconfig-harness-2d-6-6c-2/`,
   because the 2d-5-7b tree no longer existed. `HARNESS_ROOT` moved with it. **2d-8 must delete this
   path.**
3. **Placement was measured, and not changed.** The choice row below the fold is a layout
   consequence of a tall comparison block under a reveal that targets the panel's top. Changing the
   reveal target or the block's height is new behaviour, not a fix a window reading owes (§5 item 5).
   **Not forced:** nothing in a type or a test forces the choices into view today, and no mounted
   suite can, because jsdom lays nothing out.
4. **The recovery reading used a host in an external conflict**, not in a save conflict as the
   mounted scenario 3 does. The watcher's ~300 ms delivery races a save, so a save conflict could not
   be produced deterministically. The save-arm host beside a recovery form's external arm is carried
   by `DetailPane.test.ts` alone.

## 3. 2d-6-6's acceptance, checked clause by clause

The acceptance is at the `### 2d-6-6` heading of the split record. The union of 6a, 6b, 6c-1 and
6c-2 is 2d-6-6 (the orchestrator's cut).

| Clause | Evidence | Met? |
|---|---|---|
| **Delivers** receiver reporting and delivery for the editor, the creator and recovery | 6b §1.2. `DetailPane.test.ts`, *the pane as a delivery host — Phase 2d-6-6b* (`:1793`), six cases through the real registry and coordinator. Window: L01–L06, where each panel drew after a real watcher delivery | **met** |
| Recovery as the **eighth** centrally assembled kind | 6b §1.3. `DetailPane.test.ts`, *registers and unregisters its ${kind}* (`:1087`) over the `Record<OpenWriteSurfaceKind, …>` walk, `recovery` included | **met** |
| Delivery to **every affected session** | *gives a host and its recovery form over one file one decision* (`:1934`) and the 6c-1 case at `:2369` (EN, ES): both panels draw the same observation. Window (c): the host and the recovery form each drew their own file's observation (L05, L06) | **met**. The window reading covers only the two-file case |
| The shell **kept mounted** while a retained surface exists over an empty list | 6b §1.4. `AppShell.test.ts`, *keeps the panes mounted while a surface is open, and gives way once it closes* | **met** (mounted only; not read in a window) |
| **Origin, evidence, comparison, copy and recovery rendering** on the three authored panels | 6c-1 §1.1. Window §4.1–§4.3: origin, observed revision, retained draft and disk text, copy (editor and creator), choices, recovery reached from the editor's external conflict via *Keep my draft* → manual resolution | **met**. Under `click()` in a hidden window the copy disclosed a failure, so a successful copy is not window-established (reading §4.1) |
| **First live component path** for `observeExternalChange` and `supersedeConflict` | 6b §1.2 (the surface transition routed through `observeExternalChange`). Window: every proof launch's panel is a real delivery's result | **met** |
| Mounted, bilingual: *a pristine editor conflicts* | `DetailPane.test.ts:1805` (6b) and `:2191` (6c-1), EN + ES | **met** |
| … *an unknown-target creator blocks every eligible target* | `:1839` (6b) and `:2265` (6c-1), EN/ES × two files | **met** |
| … *recovery over B protects B while its host stays over A* | `:1888` (6b) and `:2320` (6c-1), EN + ES | **met** |
| … *host and recovery over one file get one decision* | `:1934` (6b) and `:2369` (6c-1), EN + ES | **met** |
| … *a reopened editor cannot receive an old instance's delivery* | `:1969` (6b) and `:2406` (6c-1), EN + ES | **met** |
| … *a settlement lands in order* | `:2011` (6b) and `:2457` (6c-1), EN + ES | **met** |
| … through the **real registry and coordinator boundary** | Every case above mounts `DetailPane` over a real `BrowserState`, starts the lifecycle over a finite drain queue with `expectedDrains` exact, and wakes the window (6c-1 §3) | **met** |
| **A narrow window reading** | [`2d-6-6c-2-window-reading.md`](2d-6-6c-2-window-reading.md): six proof launches, three panels × EN/ES, fresh bundle paths, the language through the picker, verbatim evidence | **met, narrowly**. It establishes what jsdom could not: placement, visibility, and that the drawn sentences are the suites' own. It does **not** read scenarios 4–6, a save-arm host, the shell over an empty list, or any real input (reading §5) |
| **Components**: `DetailPane`, `AppShell`, `MatchEditor`, `MatchCreator`, `RecoveryPanel` | 6b (all five), 6c-1 (the three panels), 6c-2 (`MatchEditor.svelte`, carried item 6) | **met** |
| The three hand-on obligations of the cut (6a) | [`2d-6-6a-notes.md`](2d-6-6a-notes.md), closed | **met** |

**Every clause is met.** The one qualification is the reading's own narrowness, stated in the row
above. That the rendering stays right as the code changes is carried by the mounted suites alone. No
type forces any clause in the table.

## 4. Verification

Each gate was run on its own, with its exit status read directly from a redirected file:

| Command | Exit | Evidence |
|---|---|---|
| `cargo test --workspace -- --test-threads=1` (`/tmp/6c2-cargo-test.txt`) | 0 | **1323 passed**, 0 failed (unchanged). The first run failed one test, `retained_state_contract::tests::every_retained_state_claim_is_judged`, on the word "outlives" in a new `probe.rs` comment. The comment was reworded, and the rerun passed |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 | clean |
| `cargo fmt --check` | 0 | clean, after `rustfmt` of the untracked `probe.rs` |
| `npm run check` | 0 | **449 files**, 0 errors, 0 warnings |
| `npm test` | 0 | **2924 passed**, 65 files: +4 from 2920 (`MatchEditor.test.ts` +2, `workspace.test.ts` +2) |
| `npm run build` | 0 | **193 modules** (unchanged) |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | 1 | no match: the server-only markers are **absent** |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | 0 | `2`: the client-only markers are **present** |
| `cargo tree -p espansoconfig-core \| rg tauri` | 1 | no match |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | 0 | `5 insertions(+), 1 deletion(-)` |

New rung: **`1323 / 449 / 2924 / 193`**. **Git:** read-only commands only. Nothing was staged,
committed, stashed or reverted.

## 5. Open items for later phases (not fixed here, `CLAUDE.md` §7)

1. **Still open from 6c-1 §4:**
   - (1) the origin line and the external first message repeat one clause. The window shows this in
     every panel: the two opening paragraphs in both languages;
   - (3) the recovery form's refusal repeats the panel's first message. Visible in L05/L06
     `recovery-actions`;
   - (4) five surfaces (deleter, mover, duplicator, raw, restore) still draw nothing for an external
     conflict. These belong to 2d-6-7 and 2d-6-8;
   - (5) `recovery.ts`'s stale "Nothing draws this yet" is not re-audited.
2. **The `deleteMatch`, `moveMatch`, `duplicateMatch` and `saveRawDocument` wrappers are unaudited for
   the post-commit shape** fixed here in `saveMatch` and at 6c-1 in `createMatch`. Each needs a
   failing case through the real `BrowserState` and the same fix **before 2d-6-7 draws those
   surfaces**. Raw's belongs before 2d-6-8.
3. **The copy under a real gesture is not window-established.** In the proof launches the disclosure
   said the copy failed. A shakedown said it succeeded. A reading with a person at the keyboard (2d-7)
   should press *Copy my text* and paste.
4. **The creator's reload warning is drawn while the reload is not offered.** In the
   `destinationRequired` state the panel draws *Loading the version on disk moves this window to it…*
   beside choices that do not include a reload (L03, L04). This is for 2d-6-11's wording review, or
   for a later phase that gates the warning on the choice.
5. **The editor's and the creator's choice rows land below the fold** after the reveal (reading
   §4.5). Revealing the choice row, or bounding the comparison block's height, is new behaviour for a
   later phase to decide.
6. **2d-8 deletes `/private/tmp/espansoconfig-harness-2d-6-6c-2/` as well** (454 MB), together with
   the instrument's new commands `probe_other_writer`, `probe_snapshot` and `probe_snapshot_state`.
7. **`createMatch`'s post-commit catch has the same unguarded classification** that §6 fixed in
   `saveMatch`. `classifyFailure(raw)` sits inside its catch (`workspace.svelte.ts`, `createMatch`),
   so a thrown value whose `code` getter throws still rejects a committed create. The review named
   only `saveMatch`, so this is recorded and not fixed (`CLAUDE.md` §7). It needs the same failing
   case and the same guard.

## 6. The review's finding, re-derived and fixed

**Codex adversarial review: `needs-attention`, 1 BLOCKER, no should-fix**
([`docs/reviews/phase-2d-6-6c-2.md`](../reviews/phase-2d-6-6c-2.md)). Per `CLAUDE.md` §7, no
re-review follows this fix.

### The finding: error classification can reject a committed save (`workspace.svelte.ts:6181`)

**Re-derived, and it held.** The catch that §1.2 added to `saveMatch` classified the exception with
`classifyFailure(raw)`. `classifyFailure` calls `isCommandError`, which reads `code` off the thrown
value (`errors.ts:743`). A `code` getter that throws therefore escaped the catch, the promise
rejected, and a committed write reached `MatchEditor`'s `runSave` as an error (D2).

**Case**, through the real `createBrowserState` (`workspace.test.ts`, *saving one snippet's fields*):
*answers a committed field save as saved when %s throws a value whose classification throws*. It is
an `it.each` over two rows, `the adoption` (`getDocument` throws) and `the re-read` (`documentText`
throws). The thrown value is `Object.defineProperty({}, 'code', { get: () => { throw … } })`.
**Pre-fix failure, verbatim, both rows** (`/tmp/6c2-fix-prefix.txt`):

```
Error: the code getter threw
 ❯ isCommandError src/lib/ipc/errors.ts:743:32
 ❯ classifyFailure src/lib/ipc/errors.ts:769:7
 ❯ Object.saveMatch src/lib/browser/workspace.svelte.ts:6182:55
```

**Fix, in `saveMatch` only.** The classification now runs inside its own `try`. If it throws, the
fallback is `classifyFailure('the exception after a committed save could not be classified')`. That
classifies a fixed string, which `isCommandError` rejects at its `typeof` check, so the thrown value
is never inspected again. The answer is still a `failed` adoption beside the `saved` outcome.

**What this forces and what it does not:**
- Forced: no value thrown by the adoption or the re-read can reject `saveMatch` after a commit.
- Not forced: that `forgetTheReplacedDocument`, an internal function that runs in the same catch,
  never throws. No type forces that.
- `createMatch` keeps the unguarded shape (§5 item 7).

**After the fix:** `workspace.test.ts` passes 332 of 332.

### Gates after the fix round

| Command | Exit | Evidence |
|---|---|---|
| `npm test` | 0 | **2926 passed**, 65 files (+2: the two rows above) |
| `npm run check` | 0 | **449 files**, 0 errors, 0 warnings |
| `npm run build` | 0 | **193 modules** |

No Rust file changed in the fix round, so §4's Rust cells stand. New rung: **`1323 / 449 / 2926 / 193`**.
