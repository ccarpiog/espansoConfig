# Phase 2c-4a-2 code review

## Findings

### High — Five of the six surfaces still have no confirmed reload path

Files: `src/lib/browser/matchEditor.ts:1593-1609`, `src/lib/browser/matchCreation.ts:1249-1265`, `src/lib/browser/matchDeletion.ts:694-704`, `src/lib/browser/matchMove.ts:1595-1613`, `src/lib/browser/matchDuplication.ts:1035-1052`; `src/lib/components/MatchEditor.svelte:396-404` and the four sibling `conflictAction` switches.

The authoritative scope says “All six get a confirmed reload path,” and the design split assigns “per-surface close/reseed behavior” and the `DetailPane` props to this step. The change implements that protocol only for the raw editor. Every match model hard-codes `offersReload: false`, has no `idle -> confirming -> confirmed` transition, and always calls `conflictChoicesFor(..., 'idle')`. Every corresponding component still returns without doing anything for `reloadDiskVersion` and `confirmReload`.

This is more than withholding a step-3 button. The transition that the future button is meant to invoke does not exist. A real match conflict therefore has only *Keep editing*. After it is dismissed, a second submission cannot even normally reproduce the conflict claimed in the notes: `conflict_after_the_lock` has refreshed the Rust cache to the disk revision, so the command's leading `view_at` rejects the old revision with `identityStaleRevision` before the locked save check. The person is left in the old frontend projection with no in-panel route to adopt the disk projection and close the operation.

The stated concern about dead buttons does not require moving the protocol into step 3: an unoffered transition and its callback can be implemented and tested without drawing its choice. As written, step 3 must invent five model transitions, five close/adopt integrations and their props in addition to drawing them, contrary to the approved split.

The test at `src/lib/browser/saveOutcome.test.ts:512-528` does not guard this requirement. It positively asserts the five omissions. It will fail if a boolean changes before the expected array is edited, but once step 3 intentionally edits that expectation it has no connection to any component arm and cannot tell whether the newly offered action works. This leaves the original “model offers a button whose component does nothing” problem behind a second hand-maintained boolean.

### Medium — Authorization is bound to the source conflict, but spending is not bound or consumed

Files: `src/lib/browser/saveOutcome.ts:603-620`, `src/lib/browser/saveOutcome.ts:704-718`, `src/lib/browser/workspace.svelte.ts:1685-1699`; decision record `docs/decisions/2c-4a-2-notes.md:54-85`.

The `ReloadConfirmation` check is real: the `WeakMap` compares a token minted earlier with the exact `ConflictModel` object supplied later. It is not the old `confirmDelete` defect of comparing two values frozen together, and a confirmation for conflict A cannot authorize conflict B.

However, once `authorizeDiskAdoption(A, confirmationForA)` returns a `DiskAdoption`, no check remains at the spending boundary. The same value can be passed repeatedly to `adoptDiskVersion`, passed to another `BrowserState`, retained until a later conflict, or spent after the same document has advanced again. `BrowserState.adoptDiskVersion` does not know which conflict is currently being resolved, which workspace issued it, or whether it has already been spent; it simply installs `adoption.disk`.

Concrete failure scenario: code wiring a match surface in step 3 retains A's adoption, the window then receives conflict B (or opens another state whose session-local document number happens to match), and the stale callback spends A. TypeScript accepts the call and the window installs A's projection while the panel is resolving B. The current raw-editor handler does not expose this path because it authorizes and spends from one current session in one synchronous call, but the exported protocol and the record's “only door” guarantee are broader than that safe call site.

The two adoption tests at `src/lib/browser/saveOutcome.test.ts:531-549` cover payload copying and a foreign confirmation only. Neither attempts replay, cross-state spending, or spending after a later conflict, so both stay green if the spend boundary accepts the wrong context exactly as it does now.

### Medium — The decision record and changed move documentation claim the wrong second-attempt outcome

Files: `docs/decisions/2c-4a-2-notes.md:202-210`, `src/lib/browser/matchMove.ts:1466-1473`, `src/lib/browser/workspace.test.ts:1904-1905`; governing code `src-tauri/src/commands.rs:783-795`.

The new prose says a dismissed match conflict resends its frozen base to the locked check and “conflicts again.” That is true for raw save, but false for all five match commands. Producing the first conflict calls `conflict_after_the_lock`, whose refresh changes the Rust workspace cache to `disk_revision`. On the next match command, `view_at` compares that cached revision with the frozen base and returns `identityStaleRevision`; the locked save check is never reached.

This does remain write-safe—no stale candidate is retried and no bytes are overwritten—but the record claims a guarantee the implementation does not give. The workspace test proves only that the session retained its old `baseRevision`; it does not send the second command, so its “retry conflicts again” comment can be false while the test passes. The record should distinguish “the resend is refused” from the specific conflict outcome.

### Low — Several new test comments claim checks the tests cannot perform

Files: `src/lib/browser/saveOutcome.test.ts:67-80`, `src/lib/browser/saveOutcome.test.ts:512-528`, `src/lib/browser/workspace.test.ts:5389-5413`; decision record `docs/decisions/2c-4a-2-notes.md:35-42`.

- `EVERY_CONFLICT_CHOICE: readonly ConflictChoice[]` is not exhaustive. Adding a fifth union member does not make that array declaration fail to compile; it remains a valid array containing four members. Other exhaustive production switches may catch such an addition, but the two tests walking this constant do not establish their stated “every member” property.
- The per-writer suite says it proves “re-reads nothing,” but it leaves the raw viewer closed and checks only the count of `getDocument`. Reintroducing `await readFileText()` in every conflict arm would take the viewer-hidden early return and this test would stay green. The separate raw-save test does exercise `document_text` with a visible viewer, but only for raw save, not the other five wrappers.
- The “offers what each surface has actually wired” test reads only the six capability objects. It never imports, mounts, or invokes a component action, so it cannot establish wiring. Its current assertion can only establish that the five booleans remain false.

These are coverage and record-accuracy problems rather than evidence that eager adoption remains: the direct state assertions do catch projection installation, list movement, selection replacement and notices for all six wrappers.

## Other scrutinised points

- The six conflict arms no longer install a view, repair selection, forget viewer text, or trigger a document projection read. Saved and may-have-written paths retain their previous adoption behavior. No conflict path clears the draft or dirty state.
- `adoptDiskVersion` preserves the two-counter selection invariant. `installView` bumps only the adopted document's `projectionGenerations`; `repairAfter` writes through `replaceSelection`, which bumps the global `selectGeneration` in the same synchronous block. There is no await between projection installation and selection repair. A pending lookup for the adopted document is invalidated, while one for another document is not. A leave-and-return during the subsequent file-text await therefore cannot leave an old-parse `MatchId` selected because selection repair has already completed.
- The adoption's trailing `document_text` operation returns a typed `CommandResult` in production because the IPC wrapper catches `invoke` rejection. If an injected `BrowserCommands.documentText` violates that contract and rejects, `DetailPane` discards the promise, so the rejection is unhandled; the projection, selection and clean raw draft have nevertheless already moved synchronously, while the viewer remains without a completed text answer. This is a callback-contract limitation, not a production half-install observed in the reviewed path.
- Replacing `forgetTextOf(document)` with `forgetFileText()` is faithful after removal of the document-keyed `conflictText` cache. The parameter's only work was selecting which conflict capture to clear. No remaining caller depended on any other document-keyed behavior.
- Removing `rawTextOf` is justified. Its cross-navigation guarantee is now supplied more strongly by `ConflictModel.diskText`, which is retained inside the editor session and cannot move with the viewer. The removed cache-staleness tests no longer describe live state. The replacement coverage does pin the payload-backed disk side and no second read, although it does not literally preserve all three old test shapes.
- Deleting `browser.rawEditor.diskVersionUnavailable` is sound. Rust's `SaveResult::Conflict.disk_text` is a required `String`, and the sole production constructor returns no conflict if `Workspace::refresh` cannot read valid UTF-8. Empty text remains distinct and rendered; BOM, CR/LF characters and missing final newline are representable in the string. Carriage returns remain displayable and produce the separate raw-editor reload refusal. Non-UTF-8 and I/O failure produce a command failure, not a conflict with absent text. There is no pre-step-1 production conflict constructor that omits the field.
- `ConflictModel.choices` is gone, and all six production surface models obtain their lists from `conflictChoicesFor`. The permanent `draftKind` classifications match the consult: raw/editor/creator are authored text; move/delete/duplicate are operation choices. The current `offers*` interpretation is the problem described in the High finding, not a second literal choice-list producer.
- The conflict terms were correctly removed from move and duplication invalidation. On the still-held frontend projection their identities remain internally live; actual adoption invalidates through the workspace projection machinery.
- No conflict implementation introduced `saveAnyway`, stale-candidate retry, automatic reload, dirty-state clearing, cross-revision match identification, YAML emitted from a projection, a diff, or a control named/coded “keep my draft.” Existing `saveAnyway` occurrences belong to the separate refusal/acknowledgement protocol.

## Verdict

The eager conflict adoption is successfully removed and the raw-editor adoption is coherent, but the assigned per-surface protocol is incomplete for five surfaces, and the reusable adoption brand does not enforce the spending context its documentation implies. Those must be corrected before step 3 draws the controls.

VERDICT: NOT READY

## Confirmation pass

### Closure of the original findings

- **High — five match surfaces had no confirmed reload path: closed.** The shared
  `ReloadStep` machine exists, all five sessions and views carry the new state, their
  apply/dismiss paths reset it, their destructive transition closes only after a successful
  adoption, the component arms invoke those transitions, and `DetailPane` supplies the
  adoption callback to all six writers. Keeping `offersReload: false` correctly leaves drawing
  the controls to step 3.
- **Medium — authorization was bound but spending was not: not closed.** Removing the exported
  `DiskAdoption` handoff closes replay of that intermediate value, and the confirmation is
  one-shot within one `BrowserState`. The actual spend still is not bound to the state that
  produced the conflict or to the projection against which it was produced, however. This is
  the High finding below.
- **Medium — the second match attempt was documented as another conflict: closed.** Section
  2.5, the move/duplication module prose and the affected test comments now correctly say the
  next match command is refused by `view_at` with `identityStaleRevision` before the locked
  conflict check.
- **Low — three tests claimed properties they did not check: closed.** The choice list is now
  compile-time exhaustive, the per-writer case opens the viewer and observes the relevant text
  read, and the capability test now expressly disclaims component-wiring coverage.

### New findings

#### High — A confirmed reload can replace a newer projection with the stale conflict snapshot

File: `src/lib/browser/workspace.svelte.ts:1711-1751`; misleading coverage and disposition:
`src/lib/browser/workspace.test.ts:5491-5550`,
`docs/decisions/2c-4a-2-notes.md:446-457`.

`adoptDiskVersion` verifies the confirmation/conflict pair and rejects only an absent document
or a projection already at `diskRevision`. It never verifies that the currently held projection
is still `conflict.expected`, the window state against which this conflict session was created.
Consequently every *different* current revision is accepted, including one newer than the
conflict payload.

Concrete failure scenario: a raw conflict is retained for window revision A and carries disk
snapshot C. The person presses *Reload disk version* and sees the warning. Before confirmation,
an already-running `rereadDocument` (or any other projection replacement) installs revision D.
The session and its `confirming` step survive because a workspace reprojection is not an
`apply*` outcome or a dismissal. Pressing *Confirm reload* then passes the valid token;
`held.revision !== C`, so the method installs C over D, repairs selection against C, and reports
success. The raw editor reseeds to C; a match surface would close. The frontend has moved
backwards to an obsolete projection even though the disk observation it just loaded was D.

The inverse branch is also wrong for the caller's boolean contract. If the intervening
projection is C, line 1734 returns `false`; raw reload does not reseed and match reload does not
close, although the window has already achieved the requested disk projection. The session is
left at `confirmed`, so another confirm repeats the same refusal and there is no reload-path
progress. “Already at that revision” is successful satisfaction, not indistinguishable from a
foreign token or an unprojected document.

The retained-conflict test does not cover this ordering: it first successfully spends its token,
leaves the window at C, then reuses that already-spent token after a second command. It would
remain green if an unspent confirmation for C incorrectly installed C over D. The same boundary
also still accepts a conflict and confirmation produced by a second `BrowserState` when its
session-local document number happens to exist here, a limitation the notes now acknowledge but
which means the original reusable-boundary finding cannot be called closed.

#### Medium — The fix round added a record that says the newly wired arms still do nothing

Files: `src/lib/browser/matchEditor.ts:1692-1702`,
`src/lib/browser/matchCreation.ts:1352-1360`,
`src/lib/browser/matchDeletion.ts:794-797`, `src/lib/browser/matchMove.ts:1713-1716`,
`src/lib/browser/matchDuplication.ts:1149-1152`; sibling component comments include
`src/lib/components/MatchEditor.svelte:404-409` and the corresponding creator, mover and
duplicator blocks.

All five model declarations still state that the component's reload arm “returns without doing
anything” and that step 3 must wire it. The component comments likewise say newly offered arms
“would do nothing.” That directly contradicts both the code in those arms and the decision
record's sections 2.4 and 7.1, which correctly say this fix round wired them and step 3 only flips
the offering booleans (plus its other UI work).

Concrete failure scenario: the step-3 implementer follows the API-adjacent comments, treats the
reload machinery as absent, and rewrites or postpones it instead of merely exposing and testing
the existing transition. At minimum the permanent record then describes two mutually exclusive
states of the same code. This is the false-record defect class the round was specifically meant
to catch.

The original missing-transition finding is fixed, and the original outcome/test prose is
corrected, but the adoption rewrite can install an obsolete projection and its claimed coverage
does not drive that ordering. The contradictory new documentation must also be corrected.

VERDICT: NOT READY

## Round 3 pass

### Medium — The three-valued sweep still leaves the primary record and raw-editor prose describing the old boolean contract

Files: `docs/decisions/2c-4a-2-notes.md:67-88`,
`src/lib/browser/saveOutcome.ts:691-699`, `src/lib/browser/rawEditor.ts:785-789`,
`src/lib/browser/rawEditor.test.ts:743-747`; governing code:
`src/lib/browser/workspace.svelte.ts:1793-1800`.

The new outcome is implemented, but the claimed prose sweep is incomplete. The decision
record's main design section still gives `adoptDiskVersion` a `boolean` return, says its
refusals answer `false`, and calls a projection already at the disk revision a no-op refusal.
The `DiskAdoption` JSDoc likewise includes “bytes already held” among window-side refusals.
The raw-editor model JSDoc says `() => true` still type-checks even though
`AdoptTheDiskVersion` now requires a `DiskAdoptionOutcome`, and the raw-editor refusal test's
comment again calls the answer `false` and lists bytes already held as a refusal. Those claims
directly contradict the live `alreadyThere` branch and even contradict the corrected comments
immediately around that test.

Concrete failure scenario: a step-3 implementer follows §2.1, types a wrapper as returning
`boolean`, and treats an already-held disk revision as failure. That either no longer compiles
against the actual callback type or recreates the stuck confirmation behavior this round added
`alreadyThere` to prevent. The later round-3 disposition in the same record claiming that these
classes were swept makes the permanent record internally contradictory rather than curing it.

No further substantive issue was found in the round-3 code. `ConflictModel.source` retains the
same wire object registered by each of the six conflict arms, and the six component sessions use
`$state.raw`, so the production handoff does not clone or proxy the WeakMap key. The projection
generation is the right narrower guard: `expected` is the session's frozen base, while the
generation changes only when this window's projection is replaced; `alreadyThere` is checked
first, so a replacement that reached the requested revision is satisfaction rather than an
over-refusal. A refused changed-generation confirmation can still leave through the always
present *Keep editing* path and retry or reopen from the current projection. The tests at
`src/lib/browser/workspace.test.ts:5511-5542` and `src/lib/browser/workspace.test.ts:5544-5567`
would fail if the generation and origin guards, respectively, were removed. All six model paths
treat `installed` and `alreadyThere` alike and only stop on `refused`; the raw path reseeds and
the five match paths close. The earlier-confirmed deferred conflict arms, two-counter selection
invariant, synchronous install/repair ordering, `offersReload: false`, and prohibitions remain
undisturbed.

VERDICT: NOT READY

## Round 4 pass

### Medium — The new sweep still missed two record statements that collapse success to `installed`

Files: `docs/decisions/2c-4a-2-notes.md:37`,
`docs/decisions/2c-4a-2-notes.md:234-236`; governing types and code:
`src/lib/browser/saveOutcome.ts:726-732`, `src/lib/browser/editorSave.ts:279-285`,
`src/lib/browser/editorSave.ts:342-350`.

The five claimed sites are corrected and agree with the live contract. Section 2.1 types
`adoptDiskVersion` as `DiskAdoptionOutcome`, enumerates the five `refused` reasons, and treats
`alreadyThere` separately as satisfaction. `DiskAdoption`'s JSDoc no longer includes bytes
already held among the refusals; `loadDiskVersion` now uses `() => 'installed'`; the raw refusal
test lists the real refusal cases and points to the `alreadyThere` case immediately above; and
§7.2 no longer lists a projection already at the requested revision as a refusal.

However, the record's file table still says the five match components call `close()` “only when
the window says it installed,” and §2.4 repeats that `confirmReload` calls `close()` “only when
the window says it really installed.” In this three-valued API, `installed` is the exact name of
only one successful outcome. The live `AdoptTheDiskVersion` returns `DiskAdoptionOutcome`, and
`spendTheConfirmedReload` deliberately returns success for both `installed` and `alreadyThere`;
all five match sessions close on either. These two statements therefore preserve the same stale
binary description in a sixth and seventh site. They should say that the window reports the
disk observation satisfied, or equivalently that the answer is not `refused`.

This also makes §7.6's disposition overstate what it verified. The correction block in §7.5.2
is candid about the earlier false sentence, the header correctly says three rounds, and the edit
script failure and incomplete retry are recorded plainly. But §7.6 says every sweep hit was read
against the live type and that the paragraph claims only that sweep. Its listed patterns did not
include prose using “installed” as the success predicate, and the two surviving statements show
that the asserted contract sweep was still incomplete. This is the same completeness failure
that caused rounds 3 and 4, not a new behavioral defect.

The round-4 changes in the two non-test source files are comment-only: the corrected blocks in
`saveOutcome.ts` and `rawEditor.ts` alter JSDoc and do not change declarations, expressions, or
control flow. The test-file change in scope likewise corrects only its explanatory comment.
Per the supplied ground truth, `npm test` remains 46 files / 1380 passed and `npm run check`
remains 411 files / 0 errors / 0 warnings; those commands were not rerun.

VERDICT: NOT READY

## Round 5 — disposition of the round-4 pass

**Closed by the orchestrator directly, not by a fifth review round, and that choice is recorded
rather than assumed.** The round-4 pass named two sites and one overstatement, all in
`docs/decisions/2c-4a-2-notes.md` and all prose; the fix is three sentences. Commissioning a
fifth adversarial pass over three sentences whose exact locations were already given would have
bought nothing, so the confirming sweep was run here instead. What was done:

- `2c-4a-2-notes.md:37` (the file table's component row) and `:236` (§2.4's closing sentence) now
  say `close()` fires when the window reports the disk observation **satisfied** — `installed`
  *or* `alreadyThere`, the two successful arms of `DiskAdoptionOutcome`, never `refused` — and
  §2.4 names `spendTheConfirmedReload` as what deliberately collapses the two, with the reason.
- §7.6.2 was added as a correction block: §7.6.1's sweep was accurate about itself and wrong to
  imply sufficiency, because its patterns were written from the old wording rather than from the
  new contract. It records that three consecutive rounds closed a finding and left a narrower
  instance of it standing for that same reason.

**The confirming sweep**, run independently of the fix:
`rg -n "says it installed|says it really installed|it installed|when installed"` over the record,
`src/lib/browser/` and `src/lib/components/` returns nothing; `rg -n "only when the window|only if
the window|'installed'"` over the same tree returns six hits, all legitimate — the two corrected
sentences, the `DiskAdoptionOutcome` union member at `saveOutcome.ts:728`, the `return 'installed'`
at `workspace.svelte.ts:1824`, and the two places (`2c-4a-2-notes.md:171`, `rawEditor.ts:786`) that
correctly use `() => 'installed'` to make the point that no type forces the callback's body to do
anything.

Gates after the prose fix, both exit 0 and unmoved as a documentation-only change requires:
`npm test` 46 files / 1380 passed; `npm run check` 411 files, 0 errors, 0 warnings.

**No behavioural finding from any of the four passes remains open.** The round-3 pass confirmed
the code sound on its own terms — both new guards mutation-checked, `alreadyThere` ordered first
so no over-refusal, all six callers branching correctly, and every earlier closure undisturbed —
and rounds 4 and 5 were record accuracy only.

VERDICT: READY
