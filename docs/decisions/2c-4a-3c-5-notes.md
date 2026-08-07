# 2c-4a-3c step 5 — the confirmation pass's Medium, and the probe's removal

Two jobs, in that order, and **no production behaviour changed by either**. Step 5 closes the one
finding the 2c-4a-3c code review's round 2 left open, then takes the temporary window-reading
harness back out of the tree.

---

## 1. The Medium — an exhaustive claim that was not exhaustive

`docs/reviews/phase-2c-4a-3c-code.md` § *Round 2 — confirmation pass* found three passages saying
that `BrowserState.adoptDiskVersion()` answers `refused` **only** for a conflict the window did not
register, an unprojected document, or a projection generation that has moved. The implementation has
**five** refusal returns, so the word *only* was false by inspection — this project's named worst
defect class (`CLAUDE.md` §6), a record claiming a guarantee the code does not give, and the one
class no test can fail.

The three passages were:

| Passage | What it is |
|---|---|
| `src/lib/browser/saveOutcome.ts` — the JSDoc on `reloadUnavailableKey` | production doc comment |
| `docs/decisions/2c-4a-3c-4-notes.md` §2.4 | step 4's record of O1 |
| `docs/decisions/2c-4a-3c-4-retake.md` §8 item 1 | the re-take's "what this reading does not cover" |

### 1.1 The five guards, in the code's own order

`src/lib/browser/workspace.svelte.ts:1768–1811`:

1. **the confirmation was issued for another conflict** — `authorizeDiskAdoption(conflict,
   confirmation)` answers `null` (1768–1772);
2. **the confirmation has already been spent** through this state — `spentConfirmations.has(...)`
   (1773–1779);
3. **this state never registered that conflict**, or the origin `rememberTheConflict` recorded names
   a different document from the one the payload carries — `conflictOrigins.get(conflict.source)` is
   `undefined`, or `origin.document !== adoption.disk.id` (1780–1786);
4. **the document is no longer projected here** — `viewOf(origin.document)` is `undefined`
   (1787–1792);
5. **the projection generation has moved** since the conflict arrived —
   `origin.generation !== projectionGenerationOf(origin.document)` (1802–1811).

The `alreadyThere` success sits between 4 and 5 and is not a refusal at all.

**The two that were omitted are the two a caller supplies**, which is why the omission was not
cosmetic: a list that names only 3, 4 and 5 describes what the *window* can reach and passes itself
off as a description of the *method*. The interface JSDoc at `workspace.svelte.ts:615–625` had all
five in a numbered list the whole time; the three passages paraphrased it and dropped two.

### 1.2 The conclusion stands, and it is now argued rather than asserted

Neither localized `reloadUnavailable` sentence is reachable through the current window controls. The
argument is **separate from the list**, and each guard is answered in its own terms:

- **Guards 1 and 2 — a wrong or spent confirmation.** `reloadConfirmed()` in `editorSave.ts` mints
  the token from the conflict the session is showing and stores it on that session's `ReloadStep`;
  `DetailPane.svelte:219–224` forwards the conflict and that confirmation together and retains
  neither; every surface mints and spends in **one synchronous expression** (`MatchEditor.svelte:510`
  and its four twins, `RawEditor.svelte:278`); and the spend leaves the `confirmed` step in the same
  handler — `NOT_RELOADING` on a success, `RELOAD_REFUSED` on a refusal. From `refused`,
  `offeredReloadStep()` returns `unavailable` and `conflictChoicesFor()` names no reload label at
  all, so the control that could only be refused again is not drawn.
- **Guard 3 — an unregistered conflict.** Every conflict a surface can show arrived through one of
  the six writing wrappers, each of which calls `rememberTheConflict(document, answer.value)` at the
  moment it arrived. There is no other route by which a `ConflictModel` reaches a surface.
- **Guards 4 and 5 — the projection.** The generation moves only through `installView`, and no
  control drawn while a conflict panel owns the interaction reaches it: the panel offers *Keep
  editing*, the copy where it is honest, and the reload pair. The single control that calls
  `BrowserState.rereadDocument` — `reloadFile`, on the mover and the duplicator — is offered from
  `moveRecoveryChoices(session.sendFailure?.reason ?? null)`, and a conflict outcome does not set
  `sendFailure`.

### 1.3 What the argument is worth, in the same place as the argument

It is about the controls this window **draws**. It is **not** a proof that a reprojection begun
before the panel appeared cannot land while it is open — that is exactly the case guard 5 exists
for, and the interface JSDoc says so in the sentence that introduced it.

**The coverage limit is unchanged and is not strengthened here.** The six mounted suites script the
adoption answer directly, so they do **not** establish which of the five guards produced it; and the
twenty-two launches of `2c-4a-3c-{2,4}` that drew neither sentence are evidence about those
launches, not an exhaustive proof.

### 1.4 What was written where

- `src/lib/browser/saveOutcome.ts` — the `reloadUnavailableKey` JSDoc is **replaced**: a code comment
  describes the code as it is now, so leaving the false version visible would be leaving a false
  comment.
- Both records are **amended with a headed correction block** rather than rewritten, which is this
  project's practice and what `2c-4a-3c-3-notes.md` did: the rejected reasoning stays visible and
  the refutation is appended under it. `2c-4a-3c-4-notes.md` §2.4 carries the full version;
  `2c-4a-3c-4-retake.md` §8 item 1 carries a short one that points at it.

**No component changed and no production behaviour changed, so no window reading is owed by this
step.**

---

## 2. The probe, and its removal

`src/probe.ts` and `src-tauri/src/probe.rs` were deleted; `src/main.ts` and `src-tauri/src/main.rs`
were restored **by hand** to exactly what they held before the probe existed — the `import
{ startProbe }` and the `startProbe()` call after the mount in the first, the `mod probe;` and
`probe::register_with_probe(...)` in `main()` in the second. `git diff -- src/main.ts
src-tauri/src/main.rs` comes back **empty**, and neither file appears in `git status --short
--untracked-files=all`.

```sh
rg "render_probe|probe_plan|probe_second_writer|ECFG_PROBE|startProbe|register_with_probe" \
   src src-tauri/src scripts docs
```

finds nothing under `src`, `src-tauri/src` or `scripts`. Every remaining hit is in a decision record
that **describes** the harness in prose — `2c-4a-3c-1-instrument.md`, the earlier window readings of
1c, 2b, 2c-1b, 2c-2, 2c-3a, 2c-3b and 2c-3c — which is where the technique is meant to live.

Every scratch path the reading used — the bundles, the configurations, the `HOME`s — lived outside
the repository. **No git command that changes anything was run.**

### 2.1 The gates, re-run from the reverted source

```
npm test                                              47 files, 1482 tests, all passing
npm run check                                         415 files, 0 errors, 0 warnings
npm run build                                         174 modules
cargo build --workspace                               clean
cargo test --workspace                                1048 passing
cargo clippy --workspace --all-targets -- -D warnings  clean
cargo fmt --check                                     clean
cargo tree -p espansoconfig-core | rg tauri           finds nothing
```

### 2.2 The module guard, with its arithmetic

**174 is the new production baseline.** The arithmetic, so the next session can check it rather than
accept it:

```
172   the baseline at 2c-4a-3a
+ 1   src/lib/components/reveal.ts      (2c-4a-3c, the reveal cue's DOM half)
+ 1   src/lib/browser/draftKind.ts      (2c-4a-3c, draftKindWording)
= 174
```

With the harness in the tree the three gates read **175 modules / 416 check files / 1483 tests**;
removing `src/probe.ts` took exactly one off each. The test count moves because
`scripts/lint/ipc-detail.test.ts` `it.each`-sweeps every `.ts` under `src/`, so a source file is a
test case there.

**The shape is what is checked, not the number** (`CLAUDE.md` §6): a count that moves by exactly the
number of source modules added or removed is a module change; a jump toward ~180 with
`svelte/internal/server` in the bundle is the `resolve.conditions` regression. `rg` over
`dist/assets/index-*.js` finds **no** `svelte/internal/server` and **no** `async_hooks`.
