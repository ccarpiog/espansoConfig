# Phase 2d-7-2 — the presentation and comment fixes, and the ES mounted cases

**Date:** 2026-09-23.
**Spec:** [`2d-7-split-notes.md`](2d-7-split-notes.md) §2, the *2d-7-2* block; bound by §3 entries 28
and 29. The handed-on items are [`2d-6-9c-notes.md`](2d-6-9c-notes.md) §6 items 1 and 2,
[`2d-6-8c-notes.md`](2d-6-8c-notes.md) §4 item 1, [`2d-6-11b-notes.md`](2d-6-11b-notes.md) §6 item 8
and [`2d-6-11a-notes.md`](2d-6-11a-notes.md) §5 item 4.
**Risk:** `routine`. **No Rust, no string, no new module, no instrument path changed.** No window was
launched, and **no window claim is made**: jsdom has no layout, so each visual fix is pinned by a
stylesheet assertion over the component's source, and 2d-7-9 confirms each by eye.

---

## 1. The five items

### 1.1 A distinct disabled style on the status controls (9c §6 item 1)

The window reading drew a disabled reconciliation control with the colour and border of an enabled
one. `ReconciliationStatus.svelte`, `FileReconciliationStatus.svelte` and
`SnapshotAcknowledgement.svelte` styled `button` with `color: inherit` and no `:disabled` rule. Each
now has `button:disabled { color: var(--muted); }`, the same rule the eight editing surfaces
(`MatchEditor.svelte`, `RawEditor.svelte`, …) already use, so a disabled control looks the same
wherever it is drawn.

**Assertion:** `ReconciliationStatus.test.ts`, suite *the status controls and the row marks, as
styled*, one case per component: the `button` rule keeps `color: inherit` and the `button:disabled`
rule sets `color: var(--muted)`.

### 1.2 ES row marks that keep a file name whole (9c §6 item 2)

The cause was the flex row. `.mark` is `flex: 0 0 auto`, so it never shrinks; `.name` is
`flex: 1 1 auto` with `overflow-wrap: anywhere`. When the Spanish mark *Ilegible al observarse* did not
fit beside `match/other.yml`, the name took all the shrinking and broke between two letters. The fix
is `flex-wrap: wrap` on `.row` in `Sidebar.svelte`. Flex lines are collected at each item's
hypothetical size, which for the name is its unbroken width, so the mark moves to the next line. The
name now breaks only when it alone is wider than the row, and `overflow-wrap: anywhere` is kept for
that case. The fix is language-neutral: an English mark that does not fit behaves the same way.

**Assertion:** the same suite. `.row` has `flex-wrap: wrap`, and `.mark` and `.name` keep the flex
values the fix depends on.

### 1.3 The `SourceText` `.invisible` marker — **fixed, not re-commented**

**Choice: the fix.** `.invisible` in `SourceText.svelte` is now `white-space: nowrap` instead of
`normal`. The comment's claim, *"nothing wraps, so every visual line is a line the file has"*, is the
component's premise. The comment is on `.sourceText` and covers every `SourceText`, so weakening it
would give up the property the raw viewer and the conflict panels rely on. `nowrap` keeps what
`normal` was there for: the marker is prose, so its own whitespace collapses. It also removes the one
wrap opportunity `normal` added, between the marker's words. The marker's edges get their wrap
opportunities from the nearest common ancestor, the `pre` container, which offers none. So with the
change the comment's claim is true, and the rule's own comment says why.

**Assertion:** `sourceText.test.ts`, *keeps an invisible-character marker on one visual line*. The
`.invisible` rule body contains `white-space: nowrap;` and not `white-space: normal;`.

### 1.4 The false caller claim in `matchEditor.ts` (11b §6 item 8)

The `supersededEvidence` obstacle's doc comment said *"Rendered through `tSupersededEvidence`"*.
Nothing in production calls that accessor (`src/lib/i18n/index.ts` says so). It now says what
happens: the obstacle key resolves to `SUPERSEDED_EVIDENCE_KEY`, drawn by `MatchEditor.svelte`
through `tEditorReapplyObstacle`, and `tSupersededEvidence` itself has no caller. This is the wording
the sibling surfaces already use (`matchDeletion.ts`, `recovery.ts`, `matchMove.ts`).
`subjectOfEvidence`'s comment had the second mention in the file, *"superseded evidence with
`tSupersededEvidence`'s"*. It now names the `SUPERSEDED_EVIDENCE_KEY` sentence.

**Acceptance:** `rg -n tSupersededEvidence src/lib/browser/matchEditor.ts` finds one line, `2665`,
and that line says the accessor has no caller.

### 1.5 ES mounted cases (11a §5 item 4)

Each case now runs through `it.each` with both locales, as the neighbouring bilingual cases do, and
sets the language with `locale.setOverride(lang)`. The EN run is the old case.

- **`AppShell.test.ts`**, *keeps the panes mounted while a surface is open, and gives way once it
  closes, in %s*: the last-document-removal case (row 8(d)). It uses the file's existing `controlIn`
  helper and `DICTIONARIES[lang]`.
- **`MatchEditor.test.ts`** and **`MatchCreator.test.ts`**, *closes on `alreadyThere`, and closes
  nothing on `refused` (%s)*: the save-origin adoption loops. Each file gained one helper,
  `pressIn(scope, lang, key)`, built on its existing `labelledIn`. In `MatchEditor.test.ts`,
  `blockOf` / `boxFor` / `box` / `type` gained an optional trailing `lang` parameter that defaults to
  `'en'`, because the editor's fields are found by their drawn label. Existing callers pass nothing
  and behave as before.

Every label and sentence these cases look up differs between the two dictionaries. The ES run
therefore cannot pass by finding English text.

## 2. Gates

Each gate was run alone, with its output redirected to a file and read from that file. The tree
includes the uncommitted instrument.

| Command | Result |
|---|---|
| `npm test` | 0 — **3547 passed**, 72 files (`/tmp/2d72-gate-test.txt`) |
| `npm run check` | 0 — **462 files**, 0 errors, 0 warnings (`/tmp/2d72-gate-check.txt`) |
| `npm run build` | 0 — **201 modules** (`/tmp/2d72-gate-build.txt`) |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/index-*.js` | nothing found (server-only absent) |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/index-*.js` | `2` (client-only present) |
| `git diff --stat src-tauri/src/main.rs src/main.ts` | `5 insertions(+), 1 deletion(-)`, unchanged |

No Rust tracked file changed, so no Cargo gate is owed.

**Rung:** Rust 1323 / svelte-check 462 / vitest 3539 → **3547** / Vite **201**.

| Figure | Change | Per file |
|---|---|---|
| Rust tests | unchanged | no Rust touched |
| svelte-check files | unchanged | no file added |
| vitest | +8 | `ReconciliationStatus.test.ts` +4 (three disabled-style cases, one row case); `sourceText.test.ts` +1; `AppShell.test.ts` +1, `MatchEditor.test.ts` +1, `MatchCreator.test.ts` +1 (each old case now runs twice) |
| Vite modules | **0** | no `.ts` module and no component added; the edits are to rules inside five existing components and to one comment in `matchEditor.ts` |

## 3. Open items (not fixed here, `CLAUDE.md` §7)

1. **`tExternalEvidenceRefusal` has no production caller either**, yet several comments say an
   obstacle is *"Rendered through `tExternalEvidenceRefusal`"*, or that an accessor *renders* it:
   `matchEditor.ts:2650`, `matchDeletion.ts:1545`, `matchDuplication.ts:1812`, `matchMove.ts:2433`,
   `reapply.ts:481`. This is the same class as item 1.4, outside the one claim this phase names.
2. **The same "superseded evidence with `tSupersededEvidence`'s" sentence** is still in the header
   comments of `matchDeletion.ts` (`:131`, `:1664`), `matchMove.ts` (`:260`) and
   `matchDuplication.ts` (`:1935`). Read as naming a sentence it is ambiguous rather than false. The
   comment pass should settle it with item 1.
3. **Neither visual fix has been seen in a window.** The assertions pin the rules, not what the rules
   paint. 2d-7-9 owns the by-eye confirmation: a disabled route or header control, the ES *Ilegible
   al observarse* row mark beside a name that fits alone, and a marker in a line wider than its box.
