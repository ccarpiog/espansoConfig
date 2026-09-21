# Review brief — Phase 2d-6-1a

**Repository:** `/Users/ccarpio/Developer/Utils/espansoConfig` (macOS Tauri v2 app; Rust core +
`src-tauri/` + Svelte 5 / TypeScript frontend; Vitest). Review the **uncommitted** working tree.

**Write your report to:** `docs/reviews/phase-2d-6-1a.md` (overwrite it).

**Time budget:** 15 minutes.

---

## The phase and its goal

Phase **2d-6-1a** is the first of three sub-phases the orchestrator cut 2d-6-1 into (recorded in
`docs/decisions/2d-6-split-notes.md` §2, the subsection *"The orchestrator's cut of 2d-6-1"* directly
under the 2d-6-1 definition). It lands, **additively and with no consumer yet**, the pure values, the
shared conflict primitives and the origin-correct EN/ES message values that sub-phases 1b and 1c will
wire into `BrowserState`. **Components: none. No new `workspace.svelte.ts` member. No Rust change.**
The rulings that bind it are the record's §3 entries **4, 10, 11, 13, 14, 15, 24, 32, 39, 40, 41**;
the phase's own record is `docs/decisions/2d-6-1a-notes.md`. In short, the worker claims to have
delivered:

- **The delivery envelope** (entry 4): `ObservationDelivery` in the new
  `src/lib/browser/observationDelivery.ts`, with constructors `arbitratedDelivery` (runs
  `arbitrateObservation` on the observation it seals, so the observation/verdict pairing cannot be
  built wrong) and `retainedDelivery`, plus `isReplacingVerdict`.
- **The shared revision description and type guards** (entry 10): `ConflictRevisionDescription` /
  `conflictRevisionsOf` in `conflictSource.ts` — the save arm carries expected, locked-found and
  observed; the external arm carries **`observed` only**, never `previousRevision` relabelled as
  "expected" and never a manufactured "found"; and the type guards `isSaveConflict` /
  `isExternalConflict`, because the nested discriminant does not narrow the parent (2d-5-5a §8 item 1).
- **The pure per-file automatic-reload guard** (entries 15, 32): `decideAutomaticReload` over
  three per-file inputs, uncertainty-first precedence, holding per **file** and never per mounted panel;
  predicate only — its state is 1b's.
- **`describeExternalConflict` no longer emits `changedElsewhere`** (entry 24): it emits
  `fileChangedWhileOpen`, a new `ExternalConflictMessage` under `browser.externalConflict.*`, with
  `messages` typed per arm so no component or view changed.
- **Four new EN/ES keys** — `browser.externalConflict.fileChangedWhileOpen`, `.observationRetained`
  (entry 13's sentence), `.writeOutcomeUnknown` and `.action.acknowledgeSnapshot` (entry 14's
  sentences) — each with a `describe*` accessor in `codes.ts` and a `t*` wrapper in `index.ts`;
  entry 24's corrections to `browser.conflictOrigin.changedWhileOpen`, the three
  `browser.reapply.externalEvidence.*` endings and `browser.reapply.supersededConflict`; literal EN/ES
  pins and entry-40 absence scans in the new `src/lib/i18n/externalConflictCodes.test.ts`.
- **Entry 41 corrections** in the touched modules, listed in the notes §2.

## The changed files

```
?? src/lib/browser/observationDelivery.ts        402 lines — envelope, guard predicate
?? src/lib/browser/observationDelivery.test.ts   420 lines
?? src/lib/i18n/externalConflictCodes.test.ts    377 lines — literal EN/ES pins, absence scans
?? docs/decisions/2d-6-1a-notes.md               212 lines — the phase record
 M src/lib/browser/conflictSource.ts             +116 −? — revision description, type guards
 M src/lib/browser/conflictSource.test.ts        +112
 M src/lib/browser/saveOutcome.ts                +251 −? — describeExternalConflict, ExternalConflictMessage
 M src/lib/browser/saveOutcome.test.ts           +129
 M src/lib/i18n/codes.ts                         +83
 M src/lib/i18n/index.ts                         +78
 M src/lib/i18n/en.json, es.json                 4 keys added, 5 rewritten, each
 M docs/decisions/2d-6-split-notes.md            +27 — the orchestrator's split record; not under review
 M PROGRESS.json                                 the orchestrator's; not under review
 M src-tauri/src/main.rs, M src/main.ts          the instrument's two hook files, pinned at 5(+)/1(−); never committed
?? src-tauri/src/probe.rs, ?? src/probe.ts       the instrument; never committed; not under review
```

## Where to be adversarial

1. **Green and false — a comment or doc claiming a guarantee the code does not give** is this
   project's worst defect class. Read every new doc comment in `observationDelivery.ts` and the new
   sections of `conflictSource.ts` and `saveOutcome.ts`: does each say, in the same sentence, what
   the code does **not** force? `arbitratedDelivery` "cannot be built wrong" — can a caller still
   construct an `ObservationDelivery` literal by hand with a mismatched verdict (is the type sealed,
   branded, or merely a shape)? `decideAutomaticReload` "cannot know its inputs are current" — is
   that written where a caller will read it?
2. **The revision description's external arm.** Entry 10: external shows the observed disk revision
   only; never relabel `previousRevision` as "expected" or manufacture "found". Read
   `conflictRevisionsOf` and its tests: is there any path — a default, a spread, a fallback — by which
   an external source yields an `expected` or `found` field, even `undefined`-valued, that a renderer
   could later print? Is the type itself a discriminated union that makes the external arm unable to
   carry them, or a single record with optional fields (which would let a renderer print
   `expected: undefined` as a blank "expected" row)?
3. **The type guards versus the nested discriminant.** Do `isSaveConflict` / `isExternalConflict`
   narrow the **parent** `ConflictModel<T>` (or `ConflictSource`) and not merely `source.kind`? Is
   there a test that a switch on the nested field alone would not have satisfied?
4. **`describeExternalConflict` and `changedElsewhere`.** The pin must be a real negative: for
   **every** external input shape (with and without correspondence, with and without a retained
   draft, each `draftKind`) the message list must not contain `changedElsewhere`. Read the test —
   does it enumerate, or check one fixture? Then check the reverse: does the save-origin
   `describeConflict` still emit `changedElsewhere` (it must — the save origin really was refused),
   and does the `messages` type split (`SaveOutcomeMessage` vs `ExternalConflictMessage`) leave every
   existing renderer compiling **and rendering the same thing** for the save arm? `npm run check` is
   green, but a renderer that matched on `messages[i].kind` with a default branch would silently
   swallow a new kind — find every consumer of `messages` under `src/lib/components/` and confirm.
5. **`decideAutomaticReload`** (entries 15, 32). Its inputs are "unresolved uncertainty hold",
   "retained observation" and "any surface open over the file". Is the precedence the ruling's —
   uncertainty refuses **regardless** of anything else; an open surface refuses automatic reload;
   nothing else permits by default? Does the predicate take a per-**file** input, and is there any
   parameter that would let a caller pass a per-panel fact in its place (a mounted flag, an instance
   token)? A predicate that permits when every input is absent is right only if the ruling says the
   automatic clean path is allowed then (entry 32 says it is); check the doc comment says exactly that
   and no more.
6. **The seven semantic bounds, entry 40, in both languages.** Read the four new sentences and five
   rewritten ones in `en.json` **and** `es.json` (the diff is small). For each: does it say what the
   ruling allows and nothing more — retained "waiting to be checked against this window's state"
   with no promise of automatic processing; uncertainty "outcome is unknown" with no claim about what
   happened; "no save was initiated in response to this observation"; "this reapply attempt wrote
   nothing" (not "nothing was written", which would claim more than the attempt); supersession "accepted
   evidence changed", never "the disk is newer"? Do the Spanish sentences claim exactly as much as the
   English — no *guardado*, *fusionado*, *más reciente*, *eliminado* slipping in? Is the absence scan
   in `externalConflictCodes.test.ts` actually scanning the forbidden words the ruling names, in both
   languages, over **these keys** and not a superset that would hide a false positive?
7. **Namespaces and accessors** (entry 39). No frontend state under `code.*`; keys selected
   exhaustively over typed values; no concatenated key anywhere in the new code (`rg "browser\." src/lib/i18n/codes.ts src/lib/browser/observationDelivery.ts src/lib/browser/saveOutcome.ts` and look for template literals). Every new key has a `describe*` in `codes.ts` **and** a `t*`
   in `index.ts`; the i18n parity suites still cover the new keys (they are data-driven — confirm they
   enumerate `en.json`, not a hand list).
8. **Entry 41 corrections.** The notes §2 list them. Check that each sentence the diff falsified in
   a **touched** module was corrected (`rg -n "no save was attempted|exactly two|only by settlement|nothing draws|no production caller" src/lib/browser/saveOutcome.ts src/lib/browser/conflictSource.ts src/lib/i18n/`), and that nothing in an **untouched** module was swept (out of scope for
   this phase — it would be a deviation, not a defect, but name it). The worker left open: four
   umbrella `browser.reapply.*` sentences still saying "Nothing was written" (deferred to 2d-6-2), the
   "exactly two exits" sentences in `workspace.svelte.ts` (deferred to 1b), a stale "nine codes" doc
   in `saveOutcome.ts` / `index.ts`. Are those deferrals legitimate under entry 41 — i.e. did this
   diff **falsify** them (then they are owed now), or merely leave them pending (then deferral is
   right)?
9. **Scope discipline.** No `.svelte` file changed; no `BrowserState` member added; no `src-tauri/`
   file changed beyond the instrument hook. `git diff --stat` and `git status --short` show it.
10. **The counts.** vitest `2474 → 2517` (worker's decomposition: +14 and +19 in the two new test
    files, +4 `conflictSource`, +3 `saveOutcome`, +3 `ipc-detail` rows — the last because
    `scripts/lint/ipc-detail.test.ts` generates one row per file under the scanned roots and three
    files were added). Vite `191 → 192` (one new reachable `.ts` module). svelte-check `444 → 447`.
    Re-derive at least the ipc-detail and Vite deltas; a wrong decomposition is a finding.
11. **The `git stash` incident.** Notes §6 records that a worker Bash call accidentally ran
    `git stash -q` and immediately `git stash pop`. Verify the aftermath: `git stash list` empty,
    the two hook files at exactly `5 insertions(+), 1 deletion(-)`, and the two untracked probe files
    present with plausible sizes (`wc -l src/probe.ts src-tauri/src/probe.rs` — 1979 and a few hundred
    lines respectively at 2d-5-7b).

## Verification already run, by the orchestrator, each gate on its own, instrument in the tree

You do not need to re-run these; report it if you find a figure that is wrong.

| Gate | Result |
|---|---|
| `npm run check` | exit 0, **447 files, 0 errors, 0 warnings** |
| `npm test` | exit 0, **2517 passed, 64 files** |
| `npm run build` | exit 0, **192 modules**; server-only bundle markers **absent**, client-only **present (2)** |
| `cargo test` | **not run** — no file under `src-tauri/` or `crates/` changed; `dictionary_contract.rs:91` excludes `browser.*` |
| `git diff --stat -- src/main.ts src-tauri/src/main.rs` | `5 insertions(+), 1 deletion(-)` |
| `git stash list` | empty |

## Report format

`VERDICT: ship | ship-with-fixes | do-not-ship`, then `BLOCKERS: <n>`, then the findings, each with
severity, `file:line`, what is wrong, and the evidence you re-derived — bodies in full, never
truncated. Do not spend budget on `PROGRESS.json`, on the split record in `2d-6-split-notes.md`, or
on what a window draws (no component changed; 2d-6-6 onward own the drawing).
