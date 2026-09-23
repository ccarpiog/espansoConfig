# Design consult brief — Phase 3, complete match editing

_Written 2026-09-23, after 2d-8 closed and before any line of Phase 3 exists, so the rulings can be read
against what was asked. The shape is `docs/decisions/2d-7-design-brief.md`'s: operating conditions first,
bounds named to the consultant rather than hidden._

## 1. Operating conditions — read these first

- **Do NOT use web search and do NOT fetch URLs.** Everything you need is in this repository. **Root:**
  `/Users/ccarpio/Developer/Utils/espansoConfig`. **Branch:** `main` — a Rust workspace (`crates/`,
  `src-tauri/`) plus a Svelte 5 / Tauri v2 frontend (`src/`). Where a question needs a fact about espanso
  itself that the repository does not hold, say so and rule from plan §3 (`IMPLEMENTATION_PLAN.md:71-187`),
  which is the project's authority on the domain model.
- **The real corpus is closed to you.** `crates/espansoconfig-core/tests/corpus/real/` is gitignored
  owner data (`CLAUDE.md` §1). Do not open it, list its contents' text, quote it or propose it as an
  input. File names and counts already written in records may be repeated; content may not.
  `tests/corpus/synthetic/` is committed and yours to read.
- **Read-only.** Do not edit, stage, stash or revert anything. The tree is clean except a modified
  `PROGRESS.json` and this phase's own untracked records. **Do not run `cargo`, `npm`, or the app.** The
  Rust gate is only authoritative serially on this host, and a design consult owes no gate. An
  unrunnable check is not a finding and not a reason to hedge: say in one line what you could not
  verify, and rule anyway.
- **Your final message IS the deliverable**, captured verbatim by the caller into
  `docs/reviews/phase-3-design.md`. The workspace may be mounted read-only and you may be unable to
  write any file; that is expected and must not affect your answer. Do not try to write the file, and
  do not tell the caller to run anything to get it.
- This is an adversarial **design consult**, not a review. Be decisive. Where the plan is wrong or
  underspecified for this codebase, say which sentence you override and why.

## 2. The rules that dominate every design here

Read `CLAUDE.md` in full before ruling, and §3 (`CLAUDE.md:46`), §5's last bullet (`:141-143`) and §6
(`:145-238`) twice.

1. **The file text is the source of truth; the typed model is a read-only projection** (`CLAUDE.md` §3).
   Every edit is a byte-span replacement and everything outside the intended span comes out
   byte-identical. `crates/espansoconfig-core` never depends on `tauri`.
2. **A record or comment claiming a guarantee the code does not give is this project's worst defect
   class** (`CLAUDE.md:141-143`). Where the type system cannot force something, the sentence that says
   what it does force says so. Your step acceptances inherit this: an acceptance that a test cannot fail
   is a claim, not an acceptance.
3. **`save_document` is the only writer of a user's file** (`CLAUDE.md:152-157`;
   `crates/espansoconfig-core/src/persist/save.rs:1167`), the lock is not reentrant, there is no `force`
   flag, findings go out and the acknowledged multiset comes back, and every writing command ends in the
   one `run_one_save` (`src-tauri/src/commands.rs:1830`; `CLAUDE.md:166-167`).
4. **D2u** (`CLAUDE.md:168-169`; `PROGRESS.md:74-76`): the UI shows a scalar's source text as written,
   never an inferred type. `word`/`left_word`/`right_word` stay textual controls, never checkboxes
   (`CLAUDE.md:173-174`). Plan §8.8's "Word boundary [ Whole word ▾ ]" and §8.5's single "Insertion
   method" control are written as if types were known; they are not.
5. **D2r**: `ItemMove` is same-sequence only; **R25**: a move is the only edit in its batch
   (`PROGRESS.md:77-78`, `:124`). Plan §8.8's "Move to file" row in the bulk inspector meets both.
6. **Text on the wire** (`CLAUDE.md:176-193`): byte spans are sliced in Rust; a `<textarea>` normalizes
   every line break to LF and an `<input>` deletes `\r`, so the raw editor and every projected field
   holding a real `\r` refuse rather than reconstruct (`src/lib/browser/matchEditor.ts:953`).
7. **Frontend structure** (`CLAUDE.md:195-227`): decisions live in `src/lib/browser/` as values;
   components draw them. `MatchBaseline`/`MatchBuffers`/`fieldIntent`; an initially absent field left
   blank is `'Unchanged'`, not `Set("")`. A `MatchId` is refused across a revision change (D2v).
8. **Localization** (`CLAUDE.md` §2): English and Spanish from day one, through typed `describe*`
   accessors in `src/lib/i18n/codes.ts`; `dictionary_contract.rs` fails `cargo test` for a Rust variant
   with no string. R31 (`PROGRESS.md:128`) — the hardcoded-string check sees markup only. R35
   (`:131`) — nothing establishes a Spanish string is Spanish; a native-speaker review is the owner's,
   before Phase 5.
9. **Reviews and phases** (`CLAUDE.md` §7, `:240`): one adversarial review per phase; blockers fixed,
   verification re-run, the phase closes. A fix is not owed a review; no phase is named as a letter
   appended to its parent; a corrective phase exists only for substantial new work.
10. **Window readings** (`CLAUDE.md:228-238`): an occluded WKWebView stops `setTimeout` about six seconds
    after launch; LaunchServices drops `--env` for a bundle path it thinks is running; `localStorage`
    follows the bundle identifier. **The tree holds no window-reading instrument** — the one used through
    2d-7 was deleted at 2d-8, and a later reading builds a new one under its own review, never committed.
    A green suite is not a screen (`PROGRESS.md:101`).

Also read: `PROGRESS.md` *Standing rules* (`:65-104`), *Open risks* R12 (`:122`), R16 (`:123`), R25
(`:124`), R29 (`:127`), R30 (`:133`), R31 (`:128`), R35 (`:131`), R36 (`:134`), R37 (`:137`), and *Next
action* (`:148-161`). Plan §3 (`:71-187`), §6.2–§6.6 (`:306-597`), §7 (`:601-623`), §8.2–§8.5
(`:656-744`), §8.8 (`:780-816`), §8.9 (`:818-856`), §12 Phase 3 and 4 (`:1110-1129`), §13 (`:1150-1168`).

## 3. What exists today, verified by reading the files for this brief

Every line below was opened on the current tree on 2026-09-23. Counts are `rg`/`wc` readings, not
compiled ones.

| Fact | Where |
|---|---|
| **The projection already models every plan §3.3 key**: 22 `MODELLED_KEYS`, from `trigger`/`triggers`/`regex` through `form_fields`/`vars`/`anchor`. Anything else becomes an `UnknownEntry` | `crates/espansoconfig-core/src/model/match_view.rs:42-65` |
| `TriggerSpec` carries all three trigger fields side by side, with `kind` in `Single`/`Multiple`/`Regex`/`Several`/`Absent`; `triggers` items are `ValueView`s, a non-scalar item elided **in place** | `match_view.rs:147-207` |
| `ContentSpec` carries all five content fields with `kind` in `Replace`/`Markdown`/`Html`/`ImagePath`/`Form`/`Several`/`Absent` | `match_view.rs:211-295` |
| `MatchOptions`: nine options, **every one a `ScalarView`**, "no `bool` here on purpose" | `match_view.rs:297-335` |
| `MatchView.unknown_entries` never discarded; `UnknownEntry` carries `value_text` sliced in Rust, and a `path` that is `None` for `NonScalarKey` and `RepeatedKey` | `match_view.rs:428-429`; `model/unknown.rs:24-111` |
| `MappingCoverage::accounts_for` — the per-mapping modelled/unknown partition, checked in the library | `model/unknown.rs:130-165` |
| `DocumentView` exposes `disabled` (a leading `_`), `read_only` (a Hub package), `imports` (items as `ValueView`s), top-level `unknown_entries`, `coverage` and `undescended` spans | `model/document.rs:103-165`; the three match-file keys at `:35` |
| **The draft surface is closed by type**: `MatchField` (18 scalar keys, `trigger` … `anchor`), `SequenceField` (`triggers`, `search_terms`), `VariableDraft`, `FormFieldDraft`. An `ItemDraft` edits an *existing* element; `Remove` is refused, and adding an element is not expressible | `crates/espansoconfig-core/src/draft/match_draft.rs:1-36`, `:73-173`, `:184-210`, `:351-360`, `:555-622` |
| `check_closed_surface`: an insertion may only join the match's own mapping under a schema-known **scalar** key; an insertion into `<match>.triggers` (a new sequence item) is refused; a `FieldInsert` value is always a scalar | `draft/audit.rs:80-105` |
| The patch engine's seven edits: `Scalar`, `InsertField`, `RemoveField`, `MoveItem`, `InsertItem` (**one new flat block-mapping item**), `RemoveItem`, `DuplicateItem` | `crates/espansoconfig-core/src/patch/edit.rs:941-956`, `:653-681` |
| R25's refusal `MoveMustBeTheOnlyEditInItsBatch` | `patch/edit.rs:1535` |
| `NewMatch` is six fields: `trigger`, `replace` mandatory; `label`, `word`, `left_word`, `right_word` optional, `None` ≠ `Some("")` | `crates/espansoconfig-core/src/draft/new_match.rs:13-131` |
| `SaveContent` has two arms: `Edits` (carries the locality guarantee) and `ReplaceText` (whole file, exact bytes, requires backups, "not a locality-preserving edit and must never be described as one") | `crates/espansoconfig-core/src/persist/save.rs:421-459`; `SaveRequest` at `:466-516` |
| `save_document` takes **one** document per call; nothing in the core commits several files as a unit | `persist/save.rs:1167`; `SaveRequest::context` at `:477` |
| The validation gate already has `MatchHasSeveralTriggerForms`, `MatchHasSeveralContentFields`, `MatchHasNo{Trigger,Content}Field`, the variable rules and `RegexDoesNotCompile` | `crates/espansoconfig-core/src/validate/mod.rs:236-295`, `:756-770` |
| **Sixteen workspace commands** (`open_workspace` … `drain_external_changes`), six of which write through `run_one_save` | `src-tauri/src/commands.rs:3012-3496` |
| **The small editor edits six fields**: `trigger`, `replace`, `label`, `word`, `left_word`, `right_word`. A trigger that is not `Single` is read-only (`triggerNotSingle`); a scalar holding `\r` is read-only (`carriageReturn`) | `src/lib/browser/matchEditor.ts:330-346`, `:361-366`, `:940-960` |
| The detail pane already draws every projected field read-only, including `triggers`, the option groups, variables and a section for unknown entries | `src/lib/components/DetailPane.svelte:1694-1765`; `src/lib/browser/detail.ts:451-871` |
| The sidebar already marks a `_`-disabled file | `src/lib/components/Sidebar.svelte:121` |
| **`imports` is projected but drawn nowhere**: no component under `src/lib/components/` reads it (an `rg` for `imports` finds only the type, the workspace mirror and a fixture) | `src/lib/ipc/types.ts:606-607`; `src/lib/browser/workspace.svelte.ts:703` |
| The raw editor (whole-document `ReplaceText`) derives `canUndo` from the draft alone, so *Undo* is enabled while `saving` (CF-55) | `src/lib/browser/rawEditor.ts:1863` |
| **No sidecar exists.** Nothing in `src/`, `src-tauri/src/` or `crates/` reads or writes an app-container file | `rg -i sidecar` over the three trees: no code hit |
| **No espanso JSON schema is vendored** in the repository (R30) | `rg --files \| rg -i schema`: none |

**Gate rung** (harness-free, 2d-8): `1323 / 461 / 3546 / 200` — Rust tests / `svelte-check` files /
vitest tests / Vite modules (`PROGRESS.md:167-169`). A new `.ts` module costs one module; a new styled
component two.

## 4. What Phase 3 is

`IMPLEMENTATION_PLAN.md:1110-1120`, verbatim:

> `triggers` (multiple) and `regex` · Markdown / HTML / `image_path` / shorthand forms · all
> metadata and matching options · cursor hint insertion · `imports` and `_`-disabled files ·
> raw YAML escape hatch per snippet · unknown-field preservation verified end to end ·
> **multi-select bulk edit (§8.8)** · **sidecar display names and per-file new-snippet
> defaults (§8.9)**.
>
> Bulk edit lands here rather than in Phase 2 because it depends on the full option model, and
> because it is the single highest-leverage feature for this corpus — 62 snippets currently carry
> the same two hand-repeated options.

Phase 4 (`:1122-1129`) owns the nine variable types, the `+ Insert` popovers other than the cursor hint,
variable chips, the visual form builder, reference diagnostics, preview and the regex test bench. Plan
§13 (`:1150-1168`) defers visual editing of anchors/aliases/tags/merge keys and bulk editing of content,
triggers or variables.

## 5. What the phase inherits

### 5.1 The carried-forward list

`docs/decisions/2d-7-10-notes.md` §5 (`:494-570`), CF-1 … CF-55. Entry 33 of the 2d-7 record classes
every unread row there as **permanently unread by a window harness, no phase named**; a later phase that
wants a row builds the named capability on a new, reviewed instrument. Two groups need a home in Phase 3's
split, or an explicit ruling that they have none:

- **CF-55** (`2d-7-10-notes.md:552`; §6.2 item 4 at `:611-621`): raw *Undo* is enabled while `saving`
  (`rawEditor.ts:1863`); whether it should be is a ruling owed to a later phase. The per-snippet raw
  escape hatch (Q4) is the next surface to draft raw text.
- **The entry-26 wording rulings** (`2d-7-split-notes.md:740-742`): CF-52 (the delete panel's choice row
  below the fold at 1180x728, EN and ES), CF-53 (close/keep labels — the owner judged them "Clear
  enough"), CF-54 (the delete panel's two opening paragraphs overlap). All three are owed to the owner or
  a later phase.

Also `docs/decisions/2d-6-split-notes.md` §7 (`:921-942`): **item 1**, the `file:line` drift checker for
cross-file citations in comments, deferred with no phase named; **item 10**, no window-close path runs
`dispose()`, deferred with no phase named.

### 5.2 Owner obligations that stand outside this consult

Plan §12's Phase 2 exit — *the owner uses it for a week on their real config with zero data loss* — has
not been run and does not block this consult (`PROGRESS.md:153`). R35's native-speaker review is the
owner's, before Phase 5.

## 6. Constraints you may not trade away

Settled; a ruling that contradicts one is wrong, not brave. **`save_document` is the only writer of a
user's file**, with no `force` flag. **No real configuration in any test, fixture or launch.** **D2u, D2r
and R25 stand** unless you name the risk row you close and the test that closes it. **An edit never
reformats bytes outside its span.** **The core never depends on `tauri`.** **Every user-facing string in
EN and ES through the typed accessors.** **§7's review policy.** **A window claim needs a window**, and
there is no instrument in the tree.

---

# The questions

Answer each with a **Ruling:** line, then the reasoning, then `file:line` evidence you derived; where
uncertain, say which observation would settle it.

### Q1 — The step cut and its order

Cut Phase 3 into steps sized for **one worker each** (one autoclaude phase, one review). Name them `3-1`,
`3-2`, … in dependency order. For each: what it delivers, which files it may touch (core, `src-tauri`,
`src/lib/browser`, components, i18n, records), its acceptance in checkable terms, its risk class
(`high`/`routine`), and whether it can run **driven** (an unattended session, screen possibly locked) or
needs the owner. Say which steps are core-first (Rust with no caller, as 2a did) and which are
UI-first over an already-sufficient core. Say whether any plan §12 Phase 3 item belongs in Phase 4 or
later instead, or is already done.

### Q2 — Trigger side: `triggers` and `regex`

The projection holds all three forms (`match_view.rs:147-207`); the draft can edit an existing `trigger`,
`regex` or an **existing** `triggers` element, and cannot add or remove one (`match_draft.rs:351-360`;
`audit.rs:86-93`). Plan §8.2 wants a `[ Text ] [ Multiple ] [ Regex ]` segmented control. Rule on: (a)
what the core must add — scalar-item insertion and removal in a scalar sequence, a `FieldInsert` whose
value is a new block or flow sequence, a "switch form" edit that removes one key and inserts another —
and how each keeps the byte-span guarantee, the comment-ownership rules (plan §6.2 `:406-417`) and the
closed-surface audit; (b) whether switching form (e.g. `trigger` → `triggers`) is in Phase 3 at all or
only editing within a form; (c) what the editor does with `Several` and `Absent` (`MatchHasSeveralTriggerForms`
already refuses a save, `validate/mod.rs:756-758`); (d) how `regex` is edited given `RegexDoesNotCompile`
exists and the regex test bench is Phase 4; (e) flow-style `triggers: [a, b]` against block style — does
the engine edit both, and what does it emit for a new list (plan §6.3 prefers single quotes).

### Q3 — Content side and options under D2u

Markdown, HTML, `image_path` and shorthand `form` are scalar content fields already in `MatchField`;
the nine options are scalars. Rule on: (a) whether editing an **existing** content field of any kind is
UI-only work over today's core, and what the editor must refuse (`Several`, `\r`, non-decodable); (b)
**switching content kind** (`replace` → `markdown`), which is a remove plus an insert in one batch —
allowed, and with what confirmation; (c) the shorthand `form` in Phase 3 against the form builder in
Phase 4 (plan §8.6 `:746-765`): is the layout string editable in Phase 3 as text, and `form_fields`
left to Phase 4?; (d) the options as **textual** controls under D2u, including `uppercase_style` and
`force_mode` whose vocabularies are closed strings, and plan §8.5's single "Insertion method" control
over `force_mode`/`force_clipboard` (`:743-744`) — is a closed-vocabulary picker a D2u violation or a
string comparison like `⌗shell` (`match_view.rs:339-343`)?; (e) `paragraph`, `label`, `comment`,
`search_terms` (a sequence: same cardinality question as Q2), `anchor` (plan §13 defers anchors —
read-only?); (f) plan §8.5's grouping and whether `EditableField` (`matchEditor.ts:330`) grows in place
or a second model is added, given R37 and the 2c conflict/reapply machinery keyed on `EDITABLE_FIELDS`.

### Q4 — The per-snippet raw YAML escape hatch

Plan §6.2 (`:386`, `:401-404`) and §8.5 (`:741`) promise a raw YAML editor per snippet. Today the only
raw editor replaces the **whole document** through `SaveContent::ReplaceText`
(`persist/save.rs:430-458`), which expressly makes no locality claim. Rule on: (a) whether the per-snippet
hatch is a new core edit (replace one item's owned byte range with caller text, then reparse and verify
that exactly one item now stands there and everything outside is byte-identical) or a view over the
whole-document raw editor scrolled to the snippet; (b) what the item's range is (the node span, the
owned-run envelope `DuplicateItem`/`RemoveItem` use, with or without its leading comments); (c) the
`\r` refusal (`CLAUDE.md:184-191`): refuse any snippet whose owned bytes hold `\r`, as the raw editor
does, or something narrower; (d) whether a parse-rejected snippet may be saved (the whole-document
editor may write unparseable text by the owner's ruling, `CLAUDE.md:162-165`) — and if so what
`DocumentDoesNotParse` consent it needs; (e) **CF-55**: does the new surface inherit the raw editor's
*Undo*-while-`saving` behaviour, and is the ruling on CF-55 made here for both surfaces.

### Q5 — `imports` and `_`-disabled files

`imports` is projected (`document.rs:142-147`) and drawn nowhere; `disabled` is drawn in the sidebar
(`Sidebar.svelte:121`). Rule on what "`imports` and `_`-disabled files" means as Phase 3 work: display
only, editing of import paths (a scalar sequence — Q2's cardinality question again), resolving an import
to a workspace document, and whether *enabling/disabling* a file (a rename, plan §7 row 15 "warn
explicitly on rename") is in Phase 3. A file rename is a new kind of write — not `save_document`'s — so
say whether it is in scope at all, and if so what writes it.

### Q6 — Unknown-field preservation, verified end to end (R29, R30)

The accounting exists (`unknown.rs:130-165`) and every edit is byte-local. Rule on what "verified end to
end" means as an acceptance: (a) a property test over the synthetic corpus that every save through each
Phase 3 edit leaves every `UnknownEntry`'s `value_text` byte-identical and still accounted for; (b) a
test through `run_one_save` rather than the engine alone; (c) R30's differential check against espanso's
own schema, which is **not vendored** — is vendoring a copy of `match.schema.json` legitimate (no web
fetch; the owner would supply it), or does R30 stay open with its failure mode restated?; (d) whether any
Phase 3 editor may display an unknown entry's value as editable, or they stay read-only (R29's "a later
phase that wants to render such a subtree must decide how").

### Q7 — Multi-select bulk edit (§8.8) against R25 and `run_one_save`

Plan §8.8 (`:780-816`) asks for one save transaction per file, one `base_revision` per file, **"If any
file fails validation, nothing is written anywhere"**, one backup per file and a single undo entry, and
shows a "Move to file" row. `save_document` writes one file per call (`save.rs:1167`). Rule on: (a) the
cross-file atomicity sentence — achievable (validate all, then commit each; a later commit can still
fail after an earlier one succeeded) or to be narrowed, and in exactly what words the UI and the record
may describe the outcome; (b) whether bulk edit is a new command that loops `run_one_save`, a new core
batch API, or N ordinary saves driven by the frontend; (c) the "Move to file" row under D2r — dropped
from Phase 3, or deferred with cross-file move; (d) **"— Mixed —"** under D2u: mixed by *source text*
(`word: true` vs `word: yes` are different) or by an inferred meaning; (e) exclusion of non-editable
snippets and the "3 of 7 skipped" sentence; (f) the "single undo entry" given undo is draft-level today;
(g) how a bulk selection survives a reparse (R27/D2v, R36) and an external change mid-apply
(plan §6.5); (h) the acknowledgement protocol across N files — one consent per file's findings multiset,
or one screen.

### Q8 — Sidecar display names and per-file new-snippet defaults (§8.9)

Plan §8.9 (`:818-856`) puts the sidecar at `~/Library/Application Support/espansoConfig/workspaces/<hash>.json`,
"purely cosmetic", last-write-wins, atomic temp-then-rename, orphans kept 30 days. Rule on: (a) that it is
**not** a user file and so is not written through `save_document` — and how the "only writer" rule is
stated so it stays true (a second, separately named writer in the app container only?); (b) whether the
core crate owns its format and I/O (it may not depend on `tauri`; the app container path comes from
Tauri) or `src-tauri` does; (c) the hash key and the relative-path keying; (d) corrupt-file handling
("rename it aside and start fresh") against CLAUDE.md §5's last bullet; (e) whether a display name is a
user-facing string that must be localized (it is user data, not UI text) and how the real filename stays
visible (plan §8.4); (f) per-file defaults: which fields, stored as **source text** (D2u), and how they
reach `NewMatch` (`new_match.rs:70-90`, six fields today) — does `NewMatch` grow, and does a default ever
write a key the user did not see?; (g) whether the sidecar needs the watcher (it is outside the espanso
root) and what a second app instance does to it.

### Q9 — Cursor hint insertion

Plan §8.3 (`:671-712`) puts the `+ Insert` affordance in Phase 4 except that §12 names "cursor hint
insertion" in Phase 3. Rule on the Phase 3 slice: inserting `$|$` at the caret of a content field, what
it does in `html`/`markdown`/`form`, whether more than one `$|$` is refused or warned (a new finding
code?), and whether the insertion is a buffer edit only (no new core work).

### Q10 — i18n cost (R31, R35)

Estimate, per step, the new EN/ES keys (field labels, refusal codes, bulk-edit sentences, sidecar
states). Rule on how R31's blind spot is handled for strings built in `.ts` models, whether any new
`codes.ts` namespace is needed, and whether Phase 3 adds anything to the 145-row ES inventory
(`2d-7-10-notes.md` §3) that the owner's R35 review must then cover.

### Q11 — Window readings without an instrument

The instrument was deleted at 2d-8 (`CLAUDE.md:236-238`). Rule on which Phase 3 steps owe a **window
reading** — a new editor surface, the bulk inspector, the sidecar's sidebar names — and how each is
obtained: an owner-present session (the 2d-7-9 shape), a new reviewed and uncommitted instrument, or
mounted jsdom evidence named as such and never credited as a screen. Say which steps may close without a
window reading and in what words their records say so. Say whether R38 (fifteen hard fixtures, window
half unread) is touched by any Phase 3 surface.

### Q12 — The carried-forward items

Place each: **CF-55** (raw *Undo* while `saving`), the **entry-26 rulings** CF-52, CF-53, CF-54, **2d-6
§7 item 1** (the `file:line` drift checker) and **item 10** (`dispose()` on close). For each, a step id,
"owner", or "no phase — with the reason". Confirm or overturn that the remaining CF rows (CF-1 … CF-51)
stay "no phase named" and owe Phase 3 nothing; name any that a Phase 3 surface would change.

### Q13 — R36, R37 and the conflict/reapply machinery under a wider editor

The 2c/2d machinery — reapply (`src/lib/browser/reapply.ts`), conflict choices, recovery creation, the
`fieldIntent` baseline/buffer split — is keyed on the six `EDITABLE_FIELDS`. Rule on how widening the
editor (Q2, Q3) carries through reapply, recovery (`NewMatch` can carry six fields only), conflict
compare and the external-change panels without reopening R36 or R37, and which of these a step must
touch in the same phase as the field it adds.

### Q14 — What would falsify this plan

Name the two or three observations that would most change your cut (an engine limitation found in the
first core step, a real-corpus shape the synthetic corpus lacks, a D2u conflict), and what the split
does if one occurs.

## 7. Your output contract

- **Your final message is the deliverable.** Write no file. **Use `###` for your own internal headings,
  never `##`** — one `## VERDICT` of your own at the top is fine, and everything under it is `###`.
- **Open with a short verdict paragraph** — the whole plan in one place — then answer each question
  under its own `### Qn — <title>` heading, each beginning with an explicit **Ruling:** line, and **end
  with a `### The step cut` section**: a dependency-ordered list, each step with scope, deliverables,
  acceptance, risk class and driven/owner.
- **Cite `file:line` for every claim about existing code**, derived by you. Where you could not verify
  something, say so plainly in one line rather than asserting it.
- **Do not quote any real-configuration content**, and do not propose a test or launch over the real
  corpus other than the existing skip-when-absent tests.

## 8. What this brief could not establish — its own coverage bounds

1. **No gate and no launch was run for this brief.** Every count in §3 is an `rg`/`wc`/`sed` reading on
   2026-09-23, not a compiled figure.
2. **§3 is a reading of named ranges, not a review.** Correct endpoints do not prove the brief
   characterized everything between them. In particular, the brief did not trace how
   `check_batch_independence` (`draft/audit.rs:170`) would treat a form switch, nor whether the patch
   engine's `InsertItem` could be generalized to scalar items without a new variant.
3. **Nothing here is a claim about espanso's runtime behaviour.** Plan §3 is the authority, and R30 says
   it is unverified against espanso itself.
4. **No claim about what a window draws.** There is no instrument; every window statement is quoted from
   a record.
5. **The questions are open.** A ruling that moves a plan §12 item out of Phase 3, or overrides a plan
   sentence (§8.8's atomicity or "Move to file", §8.5's "Insertion method"), is a legitimate outcome
   provided it names the sentence and the reason.
