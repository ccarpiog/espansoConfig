# Phase 2d-6-11b — reviewed bilingual fixtures, the production-comment sweep and the baselines

**Date:** 2026-09-23
**Scope:** the second half of 2d-6-11 (`2d-6-split-notes.md` §2, the *2d-6-11* block and the 11a/11b
cut under it). It closes 2d-6-11, and 2d-6 with it. Bound by entries 35, 40, 41 and 42.
**Components:** none changed. **Rust:** comments only (§3). **Instrument:** the four uncommitted paths
untouched; `git diff --stat src-tauri/src/main.rs src/main.ts` still `5 insertions(+), 1 deletion(-)`.

## 1. What changed

1. **`src/lib/i18n/bilingualFixtures.test.ts` (new).** Literal EN and ES expectations for every
   safety-critical sentence under entry 40's seven bounds (30 sentences: stale 3, not watched 1, failed
   registration 2, removed 2, uncertainty 6, origin and reapply 14, supersession 2), each rendered
   through the accessor a renderer uses — a `describe*` accessor in `codes.ts`, or `translate` over a
   key function with a `never` terminus (`conflictOriginMessageKey`, `reapplyOutcomeKey`,
   `externalEvidenceRefusalKey`, `SUPERSEDED_EVIDENCE_KEY`). No key is built by hand. A second table
   pins the 15 further sentences 2d-6-11a's bilingual mounted cases compare against
   `translate(lang, …)` (`2d-6-11a-notes.md` §5 item 2): the lost-history banner and control, the retry
   and retained sentences, the unreadable header, mark and reason, the observed revision, the affected
   file, the destination-less line, the three reload consequences and the two copy lines. Where a
   component itself names a literal key (`t('browser.recovery.reloadEndsRecovery')`), the fixture
   names the same literal `TranslationKey`. Further cases: every bound has at least one fixture; every
   fixture has two non-empty, different literals; the removed and supersession sentences carry no
   deletion and no newer disk; the deleter's and duplicator's close label differs from *keep what I
   asked for* in both languages.
2. **Three Spanish corrections (four keys) in `es.json`** after the prose review (§2):
   - `browser.reconciliation.refusal.superseded`: *Las pruebas de este panel han quedado sustituidas…*
     → *La evidencia de este panel ha quedado sustituida por otra lectura aceptada.* "Las pruebas" also
     reads as "the tests", and every other supersession and correspondence sentence says *evidencia*.
   - `browser.matchCreation.reloadSeedsNoForm`: *En el disco no hay ningún fragmento a medio escribir…*
     claimed there was no half-written snippet **anywhere on the disk**. The English says *a file on
     disk*. Now *Un archivo en disco no contiene ningún fragmento a medio escribir, así que ahí no hay
     nada con lo que rellenar este formulario. …*, the same shape as `browser.recovery.reloadEndsRecovery`.
   - `browser.matchDeletion.close` and `browser.matchDuplication.close`: *Dejarlo como está* →
     *Dejarlo estar*. Under a conflict the panel drew two controls with that one label and opposite
     effects (close vs keep); 2d-6-7b notes §4 item 1 handed it to this review.
   No English string changed.
3. **Test comments that the review falsified**, corrected in place: the headers and two inline comments
   of `externalConflictCodes.test.ts` and `reconciliationStatusCodes.test.ts` said the Spanish "has had
   no bilingual review"; `MatchDeleter.test.ts`'s `externalPanel` doc said the two labels "read
   identically". The existing literal pin of `refusal.superseded` in `reconciliationStatusCodes.test.ts`
   moved with the dictionary.
4. **The entry-41 sweep** (§3): production comments only.
5. **`docs/decisions/2d-6-window-readings-consolidated.md` (new)** — the six narrow readings (2d-5-7b,
   6c-2, 7c, 8c, 9c, 10) in one record: what each read, how, over which synthetic fixtures, what it
   found, what it left unread, ruling 38 condition by condition, and one list of what stays owed. It
   says at the top that it is **not the 2d-7 matrix**, runs no launch and makes **no new window claim**;
   every statement cites its source record.

**What the fixtures are, and what they are not (R35).** They protect approved wording. They fail when a
sentence drifts from what was reviewed; they cannot fail when the reviewed sentence is wrong,
ungrammatical or not Spanish, and they prove neither meaning, translation quality nor that anything
draws the sentence. The review below is the implementing agent's reading, **not a native speaker's**.

## 2. The bilingual prose review

Each ES string was read against its EN string and, where it carries one, against its entry-40 bound.
"OK" means the Spanish says what the English says, claims nothing more, and keeps the bound.

### 2.1 2d-6-9a (31 keys added in `3fdbeae`)

| Key (`browser.` omitted) | Bound | Disposition |
|---|---|---|
| `externalDocument.stale` | stale | OK — *no se ha conciliado*; names no cause and no writer |
| `externalDocument.unavailable` | — | OK |
| `externalDocument.removed` | removed | OK — *ya no está presente en el espacio de trabajo observado*; no *borrado/eliminado* |
| `externalDocument.pathDrift.changed` / `.removed` / `.unreadable` | removed (the second) | OK |
| `externalDocument.action.reread` | — | OK |
| `externalConflict.route.writeOutcomeUnknown` | uncertainty | superseded twice (9b-1, 9b-3); reviewed in §2.4 |
| `externalConflict.action.retry` | — | OK |
| `reconciliation.notWatched` | not watched | OK — *no se detectan aquí*: no coverage, nothing more |
| `reconciliation.registrationFailed.noTransport` | failed registration | OK — says the window has no source of notices, not that observation stopped |
| `reconciliation.registrationFailed.rejected` | failed registration | OK — *no pudo suscribirse* |
| `reconciliation.lostHistory` | — | OK |
| `reconciliation.membershipReloadWanted` | — | OK |
| `reconciliation.action.membershipReload` / `.lostHistoryRecovery` | — | OK |
| `reconciliation.refusal.disposed`, `.workspaceNotReady`, `.writeInFlight`, `.surfaceOpen`, `.notBlocked`, `.notAddressable`, `.blockedByLostHistory` | — | OK |
| `reconciliation.refusal.uncertaintyUnresolved` | uncertainty | OK — *se desconoce el resultado* |
| `reconciliation.refusal.observationRetained`, `.nothingRetained`, `.unknown`, `.spent`, `.workspaceReplaced`, `.projectionReplaced` | — | OK |
| `reconciliation.refusal.superseded` | supersession | **Corrected** (§1 item 2): *pruebas* → *evidencia* |
| `reconciliation.refusal.holdMoved` | uncertainty | OK |

### 2.2 2d-6-9b-1 (six keys added in `2cf57ca`, one sentence shortened)

| Key | Bound | Disposition |
|---|---|---|
| `externalDocument.row.stale` — *Sin conciliar* | stale | OK |
| `externalDocument.row.unavailable` — *Ilegible al observarse* | — | OK |
| `reconciliation.label` | — | OK |
| `reconciliation.route.unlistedFile` | — | OK |
| `reconciliation.route.snapshot` | — | OK |
| `reconciliation.route.projectionReplacedExits` | — | rewritten by 9b-3; reviewed in §2.4 |

### 2.3 2d-6-9b-2 (two keys added in `5b24da5`)

| Key | Disposition |
|---|---|
| `reconciliation.surface.observationExit` | OK — *hasta que se observe otro cambio … y se muestre aquí* |
| `reconciliation.surface.holdEnded` | OK |

### 2.4 2d-6-9b-3 (its two changed sentences, `5ff784e`)

| Key | Disposition |
|---|---|
| `externalConflict.route.writeOutcomeUnknown` | OK — *Mientras siga así, un cambio observado en el disco no se carga en esta ventana por su cuenta* matches "While this stands … is not loaded into this window on its own"; the unknown outcome stays unknown |
| `reconciliation.route.projectionReplacedExits` | OK — the three exits in the English order |

### 2.5 The entry-40 sentences from earlier steps, and 11a's `translate` sentences

| Key | Bound | Disposition |
|---|---|---|
| `externalConflict.writeOutcomeUnknown` | uncertainty | OK |
| `externalConflict.observationRetained` | — | OK |
| `externalConflict.action.acknowledgeSnapshot` | — | OK |
| `conflictOrigin.changedWhileOpen` | origin | OK — *como respuesta a esta observación* bounds the no-write claim |
| `conflictOrigin.refusedSave` | origin | OK |
| `externalConflict.fileChangedWhileOpen` | origin | OK |
| `reapply.reapplied`, `.alreadySatisfied`, `.manualResolution`, `.adoptionRefused`, `.unavailable`, `.notAttempted` | reapply | OK — each says *este intento de reaplicar no ha escrito nada*, a claim about the attempt |
| `reapply.externalEvidence.*` (five) | reapply | OK — same bounded clause |
| `reapply.supersededConflict` | supersession | OK — *sustituida por otra lectura aceptada*; no newer disk |
| `externalConflict.revisionObserved`, `.affectedFile`, `.destinationRequired` | — | OK |
| `recovery.reloadEndsRecovery` | — | OK |
| `matchEditor.reloadIdentifiesNoSnippet` | — | OK |
| `matchCreation.reloadSeedsNoForm` | — | **Corrected** (§1 item 2): the Spanish claimed more than the English |
| `saveOutcome.draftCopied`, `.draftCopyFailed` | — | OK |
| `code.unreadableReason.permissionDenied` | — | OK |
| `matchDeletion.close`, `matchDuplication.close` | — | **Corrected** (§1 item 2): collided with `saveOutcome.choice.keepOperation` |

Terminology noted, not changed: the ES dictionary says *conciliar* for "reconcile" and *instantánea* for
"snapshot" consistently across these keys.

## 3. The entry-41 production-comment sweep

Searched: production code in `src/` (no `*.test.ts`, no `src/probe.ts`) and `src-tauri/src/` (no
`probe.rs`), with `rg` over several phrasings per class; every hit read in context and checked against
the code, with callers traced. **27 false sentences corrected in 14 files, comments only**: no code,
no behaviour change. Each replacement names the actual path and its limits. `src-tauri/src/main.rs` was
not touched (lines 214-227 are 2d-8's; its hits at 19, 37, 61 and 221 count commands or "seven
things", which is none of the eight classes). No citation-drift checker was built. Line numbers are
after the edit.

| Class | Hit | Verdict | Disposition |
|---|---|---|---|
| 1 no-op transitions | `reconciliationCoordinator.ts:54` | false | corrected: "every registered transition is a no-op today" → the production transition is `DetailPane.svelte`'s `transitionOf` (2d-6-6b; every kind since 2d-6-8a). It hands the observation to `BrowserState.observeExternalChange` while a receiver of that kind is bound, and does nothing when none is |
| 1 | `writeSurfaceRegistry.ts:38` | false (the count was out of date) | corrected: every kind's transition acts while that kind's receiver is bound, since 2d-6-8a |
| 1, 3, 7 | `workspace.svelte.ts:2620` (`registerWriteSurface` doc) | false (three claims) | corrected: it registers **eight** kinds (recovery since 6b); the transition is `transitionOf`, not a no-op; the live set has more readers than the restore gate (the coordinator, observation routing, `reconciliationStatus.ts`, `DetailPane`'s header files) |
| 1 | `writeSurfaceRegistry.ts:50, 111`; `DetailPane.svelte:746` | true | checked |
| 2 `drainExternalChanges` | `workspace.svelte.ts:361` ("Nothing in this file calls it") | false | corrected: this file calls it in exactly one place, the `drain` callback `createBrowserState` hands to `createReconciliationCoordinator` (`:3541`). The coordinator decides when. Nothing in TypeScript stops another holder of `BrowserCommands` calling it |
| 2 | `ipc/events.ts:8`, `ipc/commands.ts:56, 900`, `reconciliationCoordinator.ts:13`, `workspace.svelte.ts:191` | true | checked |
| 3 no caller / nothing draws | `workspace.svelte.ts:3643` (9b-3 item 4, "Nothing draws either today; 2d-6 does") | false | corrected: the reread failure reaches no screen (`AppShell.svelte` passes `reportIpcFailure`, which writes to the console). The `stale` mark is drawn since 2d-6-9b by `FileReconciliationStatus.svelte` and `Sidebar.svelte` |
| 3 | `workspace.svelte.ts:2800` (`externalDocumentStatus`), `:3465` (`externalStatuses`); `observationTransitions.ts:52, 111` | false | corrected: no component renders the code itself; since 9b its sentences are drawn through `reconciliationStatus.ts` by `FileReconciliationStatus.svelte` and `Sidebar.svelte` (and `ReconciliationStatus.svelte` for the workspace states) |
| 3 | `workspace.svelte.ts:1575` (`rememberExternalConflict`) | false | corrected: the routing does not call it (`arbitrateHere` registers through `rememberTheConflict`). It has no production caller; only suites reach it |
| 3 | `workspace.svelte.ts:3323` | false | corrected: raw and restore have registered receivers since 2d-6-8a |
| 3 | `reconciliationCoordinator.ts:535` | false | corrected: four accessors reach `ReconciliationStatus.svelte` indirectly since 2d-6-9 |
| 3 | `i18n/index.ts:1159` | false | corrected: names the five `t*` called by the write panels; the rest have no production caller |
| 3 | `i18n/index.ts:1585` (`describeSupersededEvidence`) | false | corrected: the key is drawn by the six reapplying surfaces through their obstacle accessors; `describeSupersededEvidence`/`tSupersededEvidence` themselves are not called |
| 3 | `i18n/codes.ts:1231` | false | corrected: `ReapplyRefusal` is drawn (since 2c-4b-3); `ReapplyResolution` and `ReapplyPlacement` have no renderer |
| 3 | `i18n/codes.ts:1370` | false | corrected: five of six are drawn by `RestorePane.svelte`; `tBackupReadStep` has no production caller |
| 3 | `matchEditor.ts:2607`, `matchCreation.ts:2168` | false | corrected: the key function and `t*` accessor exist and the panel draws them |
| 3 | `restore.ts:752` | false | corrected: drawn since 2c-5-4 through `tRestoreRefusal` |
| 3 | `recovery.ts:3050` | false | corrected: `RecoveryPanel.svelte` draws any `keepMyDraft` outcome through `tReapplyOutcome`; whether a closed form offers the choice is `conflictChoicesFor`'s answer |
| 3 | `i18n/index.ts:892, 915`; `observationDelivery.ts:396, 446`; `matchEditor.ts:3007, 3250`; `matchCreation.ts:165, 3252` and the same guard sentence in the move, deletion, duplication and recovery modules; `restore.ts:4351`; `matchDuplication.ts:2415`; `sourceText.ts:137`; `reconciliationCoordinator.ts:172`; `workspace.svelte.ts:1691, 1730, 2733, 3345, 3379`; `reapply.ts:1010` (its "no production caller" part) | true | checked |
| 4 retained released only by settlement or `open()` | `workspace.svelte.ts:1041, 1900`; `conflictSource.ts:541` | true: each names settlement, retry and `open()` | checked against the three release sites (`close()` settlement, the retry, `open()`); no two-exit version is left |
| 5 exactly two uncertainty exits | `workspace.svelte.ts:1793` ("third exit"), `:3288`, `:4560`; `observationDelivery.ts:263`; `matchEditor.ts:2361` | true | checked against the three `uncertainWrites` removals (settlement, acknowledgement, `open()`); no two-exit version is left |
| 6 synchronous-Tauri-focus | `src-tauri/src/events.rs:57`, `src-tauri/src/reconciliation.rs:1123` ("wired to an inert source") | false | corrected: since 2d-6-10 the trigger is the DOM source of `domForeground.ts` (`visibilitychange` to visible, window `focus`), so a dispatched event requests a drain. That WKWebView dispatches one on a real foregrounding is not established by any test |
| 6 | `reconciliationCoordinator.ts:71, 440`; `domForeground.ts:1-41`; `AppShell.svelte:51`; `workspace.svelte.ts:2768` | true (corrected by 2d-6-10) | checked |
| 7 seven-kind / exclusive | `i18n/index.ts:805` | false | corrected: `RestoreRefusal` has nine arms, including the seven competing surfaces `writeSurfaceOpen` can name |
| 7 | `DetailPane.svelte:1066, 1102` | false | corrected: "the write surfaces are mutually exclusive" → the seven top-level write surfaces are; a recovery form may be open beside one |
| 7 | `RestorePane.svelte:1393` | false | corrected: "of the pane's seven top-level write surfaces" |
| 7 | `DetailPane.svelte:647, 954, 1048, 1130, 1179`; `restore.ts:413, 425, 457, 830, 1623`; `rawEditor.ts:308`; `workspace.svelte.ts:3267`; `observationDelivery.ts:109` and the six "seventh arm" tables (seven verdict arms including `writtenHere`); `reconciliationStatus.ts:282` | true | checked |
| 8 "no save was attempted" | `ipc/errors.ts:257, 281`; `reapply.ts:254` | true | checked: `match_list_of` refuses before any transaction; the planner's `DraftError` writes nothing; `alreadySatisfied` sends nothing. The external-origin dictionary sentence was already bounded under entry 24 |

The two `.svelte` files touched (`DetailPane.svelte`, `RestorePane.svelte`) changed in comments only.
This is not a component change. The Rust comments leave `prose_sweep`'s inventory phrases alone, and
`cargo test` passes (§4).

## 4. Baselines (entry 42)

Each command was run on its own, with its output redirected to a file and then grepped. No exit status
was read through a pipe.

| Gate | Result |
|---|---|
| `cargo test --workspace -- --test-threads=1` | exit 0; **1323** passed, 0 failed (the sum of 26 `test result` lines) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warning |
| `cargo fmt --check` | **exit 1, on `src-tauri/src/probe.rs` alone** (ten hunks, lines 844-966), which is the uncommitted instrument this phase may not touch. `rustfmt --check` on the two Rust files this phase edited (`events.rs`, `reconciliation.rs`) exits 0. In the committed tree `probe.rs` does not exist. See §6 item 6 |
| `npm run check` | exit 0; **462** files, 0 errors, 0 warnings |
| `npm test` | exit 0; **3535** passed, 72 files |
| `npm run build` | exit 0; **201** modules |
| bundle oracle | server-only markers absent (`rg -c` found none); client-only markers present (2) |
| instrument pair | `git diff --stat src-tauri/src/main.rs src/main.ts` = `5 insertions(+), 1 deletion(-)` |

**The instrument's contribution, re-derived rather than assumed.** A pristine `git archive HEAD` copy
(no `src/probe.ts`, no hook lines, `node_modules` linked) measured **460 checked files / 3525 tests /
200 modules**, against the live rung's with-instrument `461 / 3526 / 201` at the same HEAD. So the
instrument costs **one checked file** (`src/probe.ts` is in `tsconfig.json`'s include), **one test**
(the `ipc-detail` row `scripts/lint/ipc-detail.test.ts` generates for every `.ts`/`.svelte` file under
`src/`), and **one Vite module**. The Rust side is `probe.rs`, which holds no `#[test]` (`rg -c` finds
none), so it costs 0. The Rust figure was not re-run in a pristine copy. Entry 42's own pair
(`444 → 443`, `2474 → 2473`, `191 → 190`) subtracts the same three ones.

| | Rust tests | checked files | vitest tests | Vite modules |
|---|---|---|---|---|
| **2d-6-11b, with the instrument** | **1323** | **462** | **3535** | **201** |
| **2d-6-11b, normalized** | **1323** | **461** | **3534** | **200** |
| live rung at 2d-6-11a (with) | 1323 | 461 | 3526 | 201 |
| entry 42 (with / normalized) | 1323 / 1323 | 444 / 443 | 2474 / 2473 | 191 / 190 |
| last pre-instrument baseline | 1320 | 438 | 2254 | 186 |

**The deltas, by category:**
- **This phase, against the live rung:** +1 checked file, the new `bilingualFixtures.test.ts`. +9 tests:
  8 in that suite (2 + 1 + 1 + 1 bound cases, 2 for the 11a table, 1 for the labels) and 1 `ipc-detail`
  row for the new file. +0 modules (test code only). Rust +0 (comments only).
- **Normalized, against entry 42's normalized `1323 / 443 / 2473 / 190`**, which is 2d-6 as a whole:
  - Rust +0: 2d-6 changed no Rust behaviour.
  - +18 checked files (the ladder in `PROGRESS.md`): +3 at 6a, +2 at 6b, +4 at 9a, +3 at 9b-1, +1 at
    9b-2, +2 at 10, +2 at 11a (the lint pair), +1 here.
  - +1061 tests: the eight session models and their receivers (2d-6-1 … 2d-6-5, `2474 → 2817`), the
    wiring and the panels' mounted bilingual suites (6a … 8b, `→ 3156`), the reconciliation status and
    its words (9a … 9c, `→ 3366`), the foreground source (10, `→ 3382`), the matrix and the composition
    check (11a, `→ 3526`), and this phase's 9. Each figure is a with-instrument rung, and the instrument's
    one row is constant across them.
  - +10 modules: the reachable browser modules and components 2d-6 added (6a +1, 6b +1, 9a +1, 9b-1
    +4, 9b-2 +2, 10 +1). Each new `.ts` module costs one and a styled component two, as measured per
    rung.
- **Normalized, against the pre-instrument `1320 / 438 / 2254 / 186`:** Rust +3 (2d-5-7a's three
  cases). +23 checked files, +1280 tests and +14 modules: the 2d-5 coordinator, registry and delivery
  work (`→ 443 / 2473 / 190` normalized at entry 42), plus the 2d-6 deltas above. The instrument's one
  file, one row and one module are excluded from both sides.

## 5. Acceptance

| Criterion | Status |
|---|---|
| The fixture suite passes and pins literal EN and ES for every entry-40 bound, through the typed accessors | **Met.** §1 item 1. The "each bound" case fails if a bound has no fixture |
| The literals behind 11a's `translate` cases are pinned | **Met.** 15 sentences |
| Bilingual prose review recorded, with a disposition for each string | **Met.** §2. Three corrections; R35 stated in §1, in the suite header and in both older suites |
| Every entry-41 class searched and each hit dispositioned; no false sentence of those classes left in production code | **Met.** §3: 27 corrected, the rest checked true |
| `main.rs:214-227` unchanged; no citation-drift checker | **Met.** `main.rs` not touched by this phase |
| Four baselines with the instrument and normalized, with both comparisons | **Met.** §4. The instrument's share was re-derived in a pristine copy |
| Consolidated readings record, not called the 2d-7 matrix, no new window claim | **Met.** `2d-6-window-readings-consolidated.md` |
| Gates exit 0 | **Met, except `cargo fmt --check`**, which fails on the uncommitted instrument file alone (§4, §6 item 6) |
| Components none | **Met.** Two `.svelte` comments only (§3) |

## 6. Open items for later phases

1. **"Six surfaces" counts outside entry 41's classes**, noticed by the sweep and not fixed. They date
   from the six-writer save-conflict era and now undercount, since eight sessions carry
   `CONFLICT_CAPABILITIES`. Examples: `saveOutcome.ts:371, 530, 1306, 2156`, `draftKind.ts:16`,
   `editorSave.ts:301`, `reveal.ts:5, 49`, `RestorePane.svelte:191, 504`, `RecoveryPanel.svelte:152,
   630`, `recovery.ts:332, 384, 3617`. Also `matchMove.ts:1290` ("the weakest claim of the seven",
   where `MoveSubmissionRefusal` has nine arms); `reapply.ts:1010` ("the five match transitions";
   recovery's is a sixth); `i18n/index.ts` near 1541 (three panels named as drawing the obstacles,
   six do); `reconciliationCoordinator.ts:172` ("either" is loose, since `notObserved` is drawn as
   nothing). This is for a later comment pass. None of these denies a caller or a drawing.
2. **Refusal wording**, not changed here because it is not a translation defect:
   - 9b-2's five refusal lines that reuse the held-reading sentence;
   - the mover's, duplicator's and restore's refusal repeating `fileChangedWhileOpen` (7b §4 item 3,
     8c §4 item 6);
   - 7b §4 items 2 and 4;
   - the creator's reload warning drawn while the reload is not offered (6c-2 §5 item 4).
   These are wording decisions in the session modules, for a small corrective step. The consolidated
   readings record lists them under "seen but not fixed".
3. **Unused accessors**: `describeSupersededEvidence`/`tSupersededEvidence`, `tBackupReadStep`,
   `rememberExternalConflict` (no production caller; the sweep's corrected comments now say so), and
   9b-2's `noticesBesideRefusal`, `tExternalConflictNotice` and `tExternalConflictAction`. These are
   for a later deletion.
4. **Still open from 11a, 9b-3 and 9c.** The `stale` mark survives a `writtenHere` release (11a §5
   item 1, with 9b-3 items 1-3): it needs a ruling. The composition check's stated gaps (11a §5 item 3).
   `AppShell`'s last-document-removal case and the save-origin adoption loops are EN-only (11a §5 item
   4). 9c items 1-2 and 4.
5. **Owed window readings** (the consolidated record §5). A visible-window reading and a foreground
   reading, both 2d-7's. No window-close `dispose()` path (entry 33).
6. **`cargo fmt --check` fails on `src-tauri/src/probe.rs`**, the uncommitted instrument (ten hunks at
   lines 844-966; this phase did not touch the file). This phase may not modify the instrument, so the
   gate cannot exit 0 in this working tree. The committed tree has no `probe.rs`. 2d-7, which reviews
   the instrument, or 2d-8, which deletes it, closes this.
7. **Terminology.** The prose review is one agent's reading, not a native speaker's (R35). A native
   review of the whole ES dictionary is not scheduled anywhere.
8. **`matchEditor.ts:2664`** still says the editor's `supersededEvidence` obstacle is "Rendered through
   `tSupersededEvidence`". It is the same false caller claim the review found in five other files (§7).
   It was not in the files the review named, so it waits for the comment pass in item 1.
9. **The two close/keep labels are near-synonyms in both languages.** The review's open question: ES
   "Dejarlo estar" (close) and "Dejarlo como está" (keep) no longer collide, but they still mean nearly
   the same thing, and so do the EN labels. `bilingualFixtures.test.ts` checks only that they differ,
   not that a person can tell the two actions apart. That is a wording decision for 2d-7's bilingual
   window reading.

## 7. The review and its disposition

`autoclaude-review.sh` exited 2 (`REASON=usage-limit`; Codex is out of quota until 2026-09-26 19:14).
The **fallback agent `autoclaude-reviewer` (opus)** wrote [`phase-2d-6-11b.md`](../reviews/phase-2d-6-11b.md):
**`ship-with-fixes`, 0 BLOCKERS, 1 SHOULD-FIX**.

- **SHOULD-FIX: five comments still name a caller that does not exist.** `i18n/index.ts` now says
  nothing in production calls `tSupersededEvidence`, but five `supersededEvidence` arm comments still said
  "rendered through `tSupersededEvidence`": `matchCreation.ts`, `matchDeletion.ts`, `matchDuplication.ts`,
  `matchMove.ts` and `recovery.ts`. **Re-derived and held**: each file's obstacle key function returns
  `SUPERSEDED_EVIDENCE_KEY` for that arm, and `rg` finds `tSupersededEvidence` called by no
  component. **Fixed by the orchestrator**, comments only. Each now says the key resolves to
  `SUPERSEDED_EVIDENCE_KEY` and that the component draws it through the surface's reapply-obstacle
  wrapper. `rg` confirmed that each of the six reapplying components calls its `t*ReapplyObstacle`
  wrapper. It also says `tSupersededEvidence` has no caller. After the fix, `npm run check` exited 0
  (462 files, 0/0) and `npm test` exited 0 (3535). Baselines unchanged.
- The same claim in `matchEditor.ts` is outside the files the review named: §6 item 8.
