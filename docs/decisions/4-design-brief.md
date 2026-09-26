# Design consult brief — Phase 4, variables and forms

_Written 2026-09-26, after the Phase 3 closure (`docs/decisions/3-closure-notes.md`) and before any line
of Phase 4 exists, so the rulings can be read against what was asked. The shape is
`docs/decisions/3-design-brief.md`'s: operating conditions first, bounds named to the consultant rather
than hidden._

## 1. Operating conditions — read these first

- **Do NOT use web search and do NOT fetch URLs.** Everything you need is in this repository. **Root:**
  `/Users/ccarpio/Developer/Utils/espansoConfig`. **Branch:** `main` at `e6bbce0` — a Rust workspace
  (`crates/`, `src-tauri/`) plus a Svelte 5 / Tauri v2 frontend (`src/`). Where a question needs a fact
  about espanso itself that the repository does not hold, say so and rule from plan §3
  (`IMPLEMENTATION_PLAN.md:71-189`), which is the project's authority on the domain model, and from what
  the code comments already transcribe from espanso `v2.3.0` (for example
  `crates/espansoconfig-core/src/validate/mod.rs:159-167`, `:1125-1157`).
- **The real corpus is closed to you.** `crates/espansoconfig-core/tests/corpus/real/` is gitignored
  owner data (`CLAUDE.md` §1). Do not open it, list its contents' text, quote it or propose it as an
  input. Figures already written in records (plan §4: 24 `form` variables, 17 `choice`, 9 `date`,
  3 `shell`, 2 `clipboard`) may be repeated; content may not. `tests/corpus/synthetic/` is committed and
  yours to read — `variable-chain.yml`, `form-layout-and-choice.yml` and `imports-and-global-vars.yml`
  are the three that hold variables and forms.
- **Read-only.** Do not edit, stage, stash or revert anything. The tree is clean except a modified
  `PROGRESS.json` and this phase's own untracked records. **Do not run `cargo`, `npm`, or the app.** An
  unrunnable check is not a finding and not a reason to hedge: say in one line what you could not
  verify, and rule anyway.
- **Your final message IS the deliverable**, captured verbatim by the caller into
  `docs/reviews/phase-4-design.md`. The workspace may be mounted read-only; that is expected and must not
  affect your answer. Do not try to write the file.
- This is an adversarial **design consult**, not a review. Be decisive. Where the plan is wrong or
  underspecified for this codebase, say which sentence you override and why.

## 2. The rules that dominate every design here

Read `CLAUDE.md` in full before ruling — §3, §5's last bullet and §6 twice.

1. **The file text is the source of truth; the typed model is a read-only projection** (`CLAUDE.md` §3).
   Every edit is a byte-span replacement and everything outside the intended span comes out
   byte-identical. `crates/espansoconfig-core` never depends on `tauri`.
2. **A record or comment claiming a guarantee the code does not give is this project's worst defect
   class** (`CLAUDE.md` §5, last bullet). An acceptance that no test can fail is a claim, not an
   acceptance.
3. **`save_document` is the only writer of user espanso configuration contents**
   (`crates/espansoconfig-core/src/persist/save.rs:1167`); the lock is not reentrant; there is no
   `force` flag; findings go out and the acknowledged multiset comes back; every writing command ends in
   the one `run_one_save` (`src-tauri/src/commands.rs:2033`). The sidecar writer
   (`src-tauri/src/sidecar/store.rs`) writes application metadata only.
4. **D2u**: the UI shows a scalar's source text as written, never an inferred type. `VariableKind` is a
   string classification of `type`'s text (`crates/espansoconfig-core/src/model/variable.rs:9-13`,
   `:62-76`), which is why it is allowed. `inject_vars` is a `ScalarView`, never a `bool`
   (`variable.rs:113-114`). A form field's `multiline: true`, a date's `offset: 0`, a shell's `trim: true`
   are all source text under the same rule.
5. **D2r** (`ItemMove` same-sequence only) and **R25** (a move is the only edit in its batch;
   `PROGRESS.md` *Open risks* R25). Reordering variables is an `ItemMove` inside `vars` — which R25 then
   forbids combining with any other variable edit in the same save.
6. **Text on the wire** (`CLAUDE.md` §6): byte spans are sliced in Rust; a `<textarea>` normalizes line
   breaks to LF and an `<input>` deletes `\r`, so every editor that drafts through one refuses text
   holding `\r` at load, at edit and at send. A form `layout` and a shell `cmd` are multi-line text drafted
   through a textarea: they meet this rule.
7. **Frontend structure** (`CLAUDE.md` §6): decisions live in `src/lib/browser/` as values; components
   draw them. `MatchBaseline`/`MatchBuffers`/`fieldIntent`; an initially absent field left blank is
   `'Unchanged'`. A `MatchId` is refused across a revision change (D2v). R36/R37 (`PROGRESS.md`).
8. **Localization** (`CLAUDE.md` §2): EN and ES from day one, through typed `describe*` accessors in
   `src/lib/i18n/codes.ts`; `src-tauri/src/dictionary_contract.rs` fails `cargo test` for a Rust variant
   with no string. R31 — the hardcoded-string check sees markup only. R35 — nothing establishes a Spanish
   string is Spanish; the owner's review is owed before Phase 5.
9. **Reviews and phases** (`CLAUDE.md` §7): one adversarial review per phase; blockers fixed,
   verification re-run, the phase closes. No lettered re-review phase. A step may be cut into numeric
   pieces before it starts, never after its review.
10. **Window readings** (`CLAUDE.md` §6 *Window readings*): **the tree holds no window-reading
    instrument**; a later reading builds a new one under its own review and never commits it.
    `docs/decisions/3-split-notes.md` §4.1 (a model's look at a `screencapture -l` capture of a visible,
    unlocked window is recorded as a model's look; real input and wording/layout acceptance are a
    person's) and **§4.8, the owner's standing ruling of 2026-09-24: a driven run sets aside, and does not
    take, any step that needs a visible unlocked screen or an owner ruling**, records it as owed, and
    continues. **Ruling 30** of that record: every new visible editing surface owes a window half before
    its step closes.
11. **Security boundary** (plan §8.7, §13, §16): `shell` and `script` variables are **never executed**
    — not for preview, not on a button, not in v1. Plan §8.7's "*Run test* button" is already overridden
    by its own recommendation and by §13 ("Executing shell/script variables for preview"). Treat
    `clipboard` the same way: nothing reads the system clipboard for a preview.

## 3. What exists today, verified by reading the files for this brief

Every line below was opened on the tree at `e6bbce0` on 2026-09-26. Counts are `rg`/`wc` readings.

| Fact | Where |
|---|---|
| **Variables are projected completely and shallowly.** `VariableView` has `name`, `declared_type`, `kind`, `params: Vec<FieldView>`, `depends_on: Vec<ValueView>` (elided in place, never dropped), `inject_vars: Option<ScalarView>`, `unknown_entries`. Five modelled keys; anything else is an `UnknownEntry` | `crates/espansoconfig-core/src/model/variable.rs:24`, `:89-117`, `:125-214` |
| `VariableKind` has the nine types plus `Unrecognised` and `Absent`; `runs_a_command()` is `Shell \| Script` | `variable.rs:38-87` |
| The match carries `vars: Vec<VariableView>` and `form_fields: Vec<FieldView>`; the document carries `global_vars` and `imports` | `model/match_view.rs:429`, `:432`; `model/document.rs:141`, `:147` |
| **The draft can already edit *existing* variable scalars and *existing* entries of open mappings**: `VariableDraft` (`name`, `type`, `inject_vars`, `params: Vec<EntryDraft>`), `EntryDraft` (a scalar value **or** existing sequence items, never both), `FormFieldDraft` (existing options only). Addressing is positional, by projected index. `depends_on` is deliberately not drafted | `crates/espansoconfig-core/src/draft/match_draft.rs:17-36`, `:600-790` |
| **D1 of 2b-2b-2: nothing is inserted below the match mapping.** A drafted entry the projection does not hold is refused by name; inserting an author-chosen key "needs its own anchor machinery and its own review" | `match_draft.rs:29-33`; `plan_vars` at `crates/espansoconfig-core/src/draft/plan.rs:1178`, `plan_form_fields` at `:1298` |
| **The closed-surface audit** refuses any item insertion or removal except in `<match>.triggers` / `<match>.search_terms`: "`vars`, `depends_on`, a `params` list, `form_fields` options and `matches` itself are refused here, whatever the engine could do to them"; an insertion into `<match>.vars[0].params` is refused as D1 stated as a shape | `crates/espansoconfig-core/src/draft/audit.rs:75-124` |
| **The engine's value shapes are closed at two**: `EntryValue::Scalar`, `ScalarList` and (3-10) `PlainSource`. "Nothing here can spell a mapping, a nested list or a caller-written YAML fragment." `InsertItem` writes one new block-mapping item of such entries | `crates/espansoconfig-core/src/patch/edit.rs:655-694`, `:1111-1119`; item rendering `render_item` at `:7583` |
| **The single-match editor sends `vars: []` and `form_fields: []`** — variables and form fields are drawn read-only in the detail pane, never edited | `src/lib/browser/matchEditor.ts:1896-1897`; `src/lib/browser/detail.ts:644-665`; `src/lib/components/DetailPane.svelte:1864-1867` |
| Content kind switching knows `vars`/`form_fields`/`paragraph` as *companions* it keeps and names | `matchEditor.ts:1175` (`CompanionKey`) |
| The cursor action (3-5): `cursorMarkerCount`, `cursorActionOffered`, `insertCursorPosition` — the one `+ Insert` entry that exists | `matchEditor.ts:3398`, `:3410`, `:3445` |
| **Validation already holds four variable rules and one reference rule**: `VariableHasNoType`, `VariableTypeNotRecognised`, `VariableMissingRequiredParam` (table `required_param`), `DuplicateVariableName` (scoped to one sequence), `ReferenceHasNoDeclaration` (rule 5) | `crates/espansoconfig-core/src/validate/mod.rs:236-285`, `:699-712` |
| **Rule 5 scans `replace`/`markdown`/`html` and the match's own variable params (when injection is on)** with espanso's `VAR_REGEX` transcribed; it declines to report whenever the scope is open (the document has `imports`; `global_vars` or `vars` is unknown; a `regex` did not compile). Form `[[field]]` placeholders are not parsed anywhere in the core | `validate/mod.rs:159-167`, `:933-952`, `:1056-1070`, `:1096-1180` |
| `check_regex` compiles a `regex` trigger and returns its **named capture groups** (they enter rule 5's scope). This crate compiles with `regex` **1.13** (`Cargo.toml:29`, lockfile 1.13.1); espanso 2.3.0 pins **1.5.5** — a successful compile here is evidence in one direction only | `validate/mod.rs:132-142`, `:893` |
| **A1's mechanism, read for this brief (not yet proven by a test).** *Create*: `NewMatch::entries` writes every option as `EntryValue::Scalar(text)`, which `choose_scalar` spells — so `true` is quoted, **by design**: the doc comment says a value such as `on` or `yes` "is quoted rather than left as a plain scalar a YAML 1.1 reader could take for a boolean". Single-match editor: `plan_scalar` builds `ScalarEdit::new(at, value)` (the codec chooses the spelling). Only bulk (3-10) uses `ScalarEdit::plain_source` / `EntryValue::PlainSource`, refusing up front any text `is_plain_source` rejects | `crates/espansoconfig-core/src/draft/new_match.rs:175-183`, `:280-323`; `draft/plan.rs:1500-1517`; `draft/bulk.rs:20-33`, `:301-319` |
| **A1's hidden obstacle.** `PlainSource` in a *new item* is rendered verbatim, but "the ambiguity property is not waived for it here, so an ambiguous spelling in a new item is refused rather than written"; `plain_source_nodes` exempts only `ScalarEdit::plain_source` targets and `FieldInsertGroup` entries. `plain_scalar_is_ambiguous("true")` is `true` (YAML 1.1 resolves it to a non-string), so a new item holding `word: true` as plain source would fail `AmbiguousPlainScalarIntroduced` today | `patch/edit.rs:7607-7612`, `:9249-9297`, `:3007`; `crates/espansoconfig-core/src/emit/tags.rs:228-246` |
| **Twenty-two workspace commands** (`open_workspace` … `drain_external_changes`), of which the writers end in `run_one_save` | `src-tauri/src/commands.rs:3544-4180` |
| **No code editor dependency**: `package.json` has one runtime dependency, `@tauri-apps/api` (plan §4 item 5 and §16 name CodeMirror 6; not present) | `package.json:31-33` |

**Gate rung** at the Phase 3 closure: `1555 / 487 / 4074 / 214` — Rust tests / `svelte-check` files /
vitest tests / Vite modules (`PROGRESS.md` *Verification baseline*). A new `.ts` module costs one module;
a new styled component two.

## 4. What Phase 4 is

`IMPLEMENTATION_PLAN.md:1122-1129`, verbatim:

> All nine variable types · the `+ Insert` popovers · variable chips with ordering and
> `depends_on` · **the visual form builder** · reference diagnostics · deterministic preview ·
> regex test bench.
>
> *Given the real-usage data, consider promoting the form builder and `choice` fields earlier —*
> *they are more valuable to this user than `script` or `match` variables.*

The plan sections that describe it: §3.4 (the nine types, `:134-149`), §3.5 (forms, `:151-169`), §4
(usage, `:191-235`), §8.2 (segmented controls; "variable arrays do not render at all until selected",
`:656-669`), §8.3 (`+ Insert`, popovers with live preview, collision-free names, the variables strip,
"warnings, never silent deletion", ordered and reorderable with `depends_on`, `:671-712`), §8.5
(*Variables and fill-ins* group, `:732-744`), §8.6 (form builder: two synchronized panes; shorthand stays
shorthand, verbose stays verbose, no conversion behind the user's back, `:746-765`), §8.7 (preview and its
security boundary, `:767-778`), §7 row 14 ("Saving a half-entered form or variable — validate before
enabling Save", `:620`), §13 (deferrals, `:1150-1168`: no shell/script execution; no bulk editing of
variables).

## 5. What the phase inherits

### 5.1 The 47 open items of `3-closure-notes.md` §6

Listed by id only; their text and sources are in `docs/decisions/3-closure-notes.md:206-317`.

- **A1** — quoted `'true'` from *Create* with a seeded default and from the single-match option editor;
  **candidate blocker-class**. `PROGRESS.md` *Next action* asks this consult to decide whether to take it,
  and where, **before** Phase 4's features. §3 above records its mechanism as read.
- **B1 … B6** — candidate defects, each to be reproduced with a test before deciding. **B1 is the same
  item as `PROGRESS.md` "Handed on by 3-6-3" item 1** (a draft holding a list-item addition never drew the
  external-change panel; `docs/decisions/3-6-3-notes.md` §4 item 1).
- **C1 … C14** — scope left unowned (C1 the creation form's wider fields; C2 the commented-flow-list gate;
  C3 `sortOrder`; C4 preferences refresh; C5 display names in the destination list; C6 the repeated
  opening paragraph on six surfaces; C7 the CF-52 fold on the mover and duplicator; C8 `Several` one-click
  choice; C9 raw-snippet recovery; C10 bulk attribution and conflict origin; C11 bulk inspector residue;
  C12 sidecar residue; C13 `_` profiles and import line breaks; C14 the preferences draft lifetime,
  recorded as a limitation).
- **D1 … D15** — wording and layout questions for the owner.
- **E1 … E7** — records and hygiene.
- **F1** — unread window rows.
- **G1 … G3** — owed by the owner outside any driven step (the Phase 2 exit week; R35/CF-51; 2d-8 §4.6).

### 5.2 Standing constraints carried from Phase 3

`3-split-notes.md` §3 rulings 9 (`form_fields` read-only until Phase 4; editing a placeholder creates or
deletes no field definition), 10 (every option a textual control), 15–17 (unknown-field preservation;
R30 open), 23 (no newly editable field ships without draft retention, conflict compare, reapply and a
recovery disposition in the same step), 24 (R36 conservative rule; R37 one read), 29 (a translation-review
inventory per phase), 30 (window halves), 31 (R38 touched deliberately), 34 (process). §4.1 and §4.8
(window halves and driven runs).

## 6. Constraints you may not trade away

Settled; a ruling that contradicts one is wrong, not brave. **`save_document` is the only writer of user
configuration**, no `force` flag. **No real configuration in any test, fixture or launch.** **D2u, D2r and
R25 stand** unless you name the risk row you close and the test that closes it. **An edit never
reformats bytes outside its span.** **The core never depends on `tauri`.** **Every user-facing string in
EN and ES through the typed accessors.** **§7's review policy.** **A window claim needs a window.**
**`shell` and `script` are never executed, and the clipboard is never read, by any Phase 4 code path.**
**No conversion between shorthand and verbose forms behind the user's back** (plan §8.6).

---

# The questions

Answer each with a **Ruling:** line, then the reasoning, then `file:line` evidence you derived; where
uncertain, say which observation would settle it.

### Q1 — A1 first: the quoted `'true'`, and the other candidate defects

(a) Is A1 a defect to fix before Phase 4 features, and in one step or two (*Create* and the single-match
editor share the planner but not the path)? (b) What is the rule: **options are source text written as
plain scalars** (bulk's rule, `bulk.rs:20-33`), with a text that is not plain source refused up front — or
quoted as today? Which options does it cover (the seven bulk fields, or all nine including `paragraph` and
`anchor`, which is a string)? (c) The `NewMatch` doc comment (`new_match.rs:175-183`) states the quoting as
intended; the 3-10 review ruled it a blocker for bulk. Rule on which stands and what replaces the comment.
(d) The obstacle in §3: a new item's `PlainSource` is not exempted from `AmbiguousPlainScalarIntroduced`
(`edit.rs:7607-7612`, `:9249-9297`). Is widening `plain_source_nodes` to new items safe, and what test
proves the exemption is exactly as wide as the plain-source entries? (e) An existing option spelled
`'true'` that the user does not touch — left alone? An edited one — rewritten plain, as bulk does?
(f) The sidecar's seeded defaults (3-13) are text; does anything in the sidecar or the creation model need
to change, or only the core? (g) **B1** (the 3-6-3 list-item external-change panel): where does its
reproduction belong — the A1 step, a separate step, or the first step that touches reapply for variables
(ruling 23 will make variable fields reapply-bearing)? (h) B2 … B6: take any, and where?

### Q2 — The core surface for variables: what must be lifted, and how narrowly

Today the core edits existing variable scalars and existing `params` entries only, refuses every insertion
below the match mapping (D1), and the audit refuses item cardinality changes in `vars`, `depends_on`,
`params` lists and `form_fields` (`audit.rs:75-124`). Phase 4 needs, at least: add a variable (a new
`vars` item that is a **nested** mapping: `name`, `type`, a `params` mapping, perhaps `depends_on`); add
`vars:` itself when absent; remove a variable; reorder variables; add/remove a `params` entry under an
author-chosen key (D1); add/remove `depends_on` items; edit a `choice`'s `values` list (strings **or**
`{label, id}` mappings) and a `random`'s `choices`; add/remove `form_fields` entries and options. Rule on
(a) the minimal set of new **typed** core operations, each with its verifier and its audit clause — and
whether any may take caller-supplied YAML (Phase 3 ruling 4 said none may); (b) how a new nested variable
item is expressed without generalizing `EntryValue` into an arbitrary tree — a closed `NewVariable` type
per the nine kinds, a generic "mapping of scalars and scalar lists" one level deep, or something else; (c)
**author-chosen keys** (a `params` key, a `form_fields` field name): how D1's "first time this engine
writes a key string no schema fixes" is lifted, with what key-spelling rules (`choose_scalar` in key
context?), what duplicate-key refusal, and what privacy rule for refusals (keys are owner data; the
positional-address rule at `match_draft.rs:23-28`); (d) `global_vars` — in Phase 4 at all, or display only;
(e) whether reorder is an `ItemMove` inside `vars` under R25 (so a reorder is its own save), or R25 is
revisited for this case — and if revisited, which test closes R25's named cost.

### Q3 — Ordering and `depends_on`

Plan §4 item 4 and §8.3: variables are an ordered, interdependent list; the UI must respect ordering and
`depends_on`. Rule on: (a) what "respect" means as a checkable rule — a reorder that would place a
variable before one it depends on (explicitly, or implicitly via a `{{ref}}` in its params when injection
is on) is refused, warned, or allowed; (b) whether the core computes a dependency graph (declared
`depends_on` ∪ parameter references) and reports cycles and unknown names as new `FindingCode`s, and which
`FindingClass` each gets (a new blocking class would interrupt saves of files the app never touched —
the 2c-3c precedent at `validate/mod.rs:72-106`); (c) what the variables strip shows for order.

### Q4 — The form builder (plan §8.6) against byte preservation

Rule on: (a) the form model: layout text is the source of truth and fields are **derived** from
`[[placeholders]]` by a parser in the core, or fields are primary; what a placeholder parse is (espanso's
own grammar — say what you can and cannot establish without the web; the core has no such parser today);
(b) plan §8.6's "adding a field in the right panel inserts the placeholder into the layout, and vice
versa" — which direction is automatic, and does editing layout text ever create or delete a `form_fields`
entry (Phase 3 ruling 9 said no)? (c) shorthand (`form:` + `form_fields:`) versus verbose (`type: form`
with `params.layout`/`params.fields`) — two editors over one model, and how each writes its own shape; no
conversion; (d) `choice`/`list` fields as the plan's "two-click" first-class case (plan §4 item 2); (e)
unknown or advanced form options kept visible and editable (plan §8.6) under R29; (f) the `\r` rule for the
layout textarea; (g) whether the shorthand `form:` layout editor shipped in Phase 3 (ruling 9) is reused.

### Q5 — The `+ Insert` popovers and variable chips (plan §8.3)

Rule on: (a) which of the ten `+ Insert` rows ship in Phase 4 and in what order (plan §12's suggestion:
form builder and `choice` earlier than `script`/`match`); (b) collision-free name generation (`date`,
`date2`, …) — against `vars` only, or also `global_vars`, and what happens under an open scope (imports);
(c) each popover writes **what** in one save: the `{{name}}` at the caret (a buffer edit) **and** a new
`vars` item (a structural edit) — one batch, and how it composes with the content field's own edit under
the audit's independence rules; (d) editing a chip = editing an existing variable through the existing
`VariableDraft` surface, or a new model; (e) orphaned (declared, unused) and unresolved (used, undeclared)
references: "warnings, never silent deletion" — a new finding, a UI-only advisory, or rule 5 widened;
(f) `shell` and `script` popovers: authoring allowed (text only, never executed), with what warning;
(g) `match` variables (`params.trigger`) and `clipboard`.

### Q6 — Deterministic preview (plan §8.7)

Rule on: (a) where preview is computed — Rust (a new pure function in the core, no I/O) or TypeScript —
and why; (b) exactly which types preview: `echo` (its text), `date` (with an **injected clock and time
zone**, never the wall clock inside a test; chrono strftime semantics versus JavaScript), `choice`/`random`
(a selected example, deterministic), `form` (layout with sample inputs), `clipboard` (placeholder only),
`shell`/`script` (**show the command; never run**), `match` (placeholder or nested render?); (c) whether
`{{name}}` substitution in preview follows espanso's `VAR_REGEX` and `inject_vars` exactly as rule 5 does
(`validate/mod.rs:1056-1070`); (d) what the preview must say about what it cannot know (locale, time zone,
espanso's own renderer differences) — R16/R30 honesty; (e) whether `date` preview needs a new dependency
(chrono or similar) in the core or `src-tauri`, and whether that is acceptable.

### Q7 — The regex test bench

Rule on: (a) where the match runs — Rust with this crate's `regex` 1.13, never JavaScript `RegExp`; how
the bench states the 1.13-vs-1.5.5 asymmetry (`validate/mod.rs:132-142`) so it claims nothing about
espanso's acceptance; (b) what it shows: match/no match, named captures becoming `{{name}}`, how espanso
anchors or scans a regex trigger (say what you cannot establish); (c) a new read-only command (no write,
no lock) — its wire, its error codes, and input size limits; (d) whether the bench is a Phase 4 core step
plus a UI step, and whether "Regex capture" in `+ Insert` (only when trigger type is Regex) depends on it.

### Q8 — Reference diagnostics

Rule 5 exists and is deliberately conservative (it declines under an open scope). Rule on what Phase 4
adds: form sub-references `{{form.field}}` checked against the form's placeholders; `depends_on` names;
orphaned variables; references inside `form` layout; whether any new code is a blocking `FindingClass`;
whether diagnostics are save-time findings (the acknowledgement machinery) or live editor advisories, or
both; and how a finding carries **no owner text** beyond what the file supplied (the existing operands
carry the name as written — is that acceptable for new codes?).

### Q9 — Conflict, reapply, recovery and creation for variables (ruling 23, R36, R37)

Ruling 23: no newly editable field ships without draft retention, conflict compare, reapply and an
explicit recovery disposition in the same step. Rule on how that applies to a positional `vars` list whose
indices shift on every insertion, removal or reorder (the reapply of Phase 3 is keyed on fields and on
list baselines); whether a variable draft is reapplied at all or always collides; what recovery offers
(`NewMatch` cannot carry `vars` today, `new_match.rs:193-239`); whether *Create* grows variables (C1 asks
for the wider fields) or creation stays variable-free and variables are added afterwards; R36's
conservative rule for structural variable actions.

### Q10 — Plan §8.2 and the editor's shape

Plan §8.2: "variable arrays do not render at all until selected". Rule on where the variables surface
lives — inside the single-match editor as the *Variables and fill-ins* group (§8.5), as a separate panel,
or as chips under the content field — and whether it grows `EDITABLE_FIELDS` (`matchEditor.ts:463`) or is a
second model beside it, given `matchEditor.ts` is already 7076 lines and `workspace.svelte.ts` 8928
(`wc -l`). Rule on whether the HTML/markdown "real code editor" (plan §4 item 5, CodeMirror 6 in §16) is in
Phase 4 at all; it is not in plan §12's Phase 4 list.

### Q11 — The step cut and its order

Cut Phase 4 into steps sized for **one worker each** (one autoclaude phase, one review). Name them `4-1`,
`4-2`, … in dependency order; **4-1 is A1 unless you rule otherwise and say why.** For each: what it
delivers, which files it may touch (core, `src-tauri`, `src/lib/browser`, components, i18n, records), its
acceptance in checkable terms (a test shown failing first where a defect is claimed), its risk class
(`high`/`routine`), whether it is core-first (Rust with no caller), UI over an already-sufficient core, or a
**window half**, and whether it can run **driven** (unattended, screen possibly locked) or needs the owner
or a visible window (§4.8). Say where the plan's suggestion to promote the form builder and `choice`
lands. Say which plan §12 Phase 4 items belong later or are already done.

### Q12 — i18n, window halves and the carried items

(a) Estimate new EN/ES keys per step (a planning range, not an acceptance); name new `codes.ts` families.
(b) Which steps owe a window half under ruling 30, and whether any Phase 4 surface should touch R38 (a
block-scalar `layout`, a CRLF file) deliberately. (c) Place every one of the 47 items of §5.1 you have a
view on: a step id, "owner", or "no phase — with the reason"; you need not restate each, but name any that
a Phase 4 surface would change (C1 creation, C8, C9, C10, D11 the regex-outcome wording, D15 dormant
content boxes, B1).

### Q13 — What would falsify this plan

Name the two or three observations that would most change your cut (an engine limitation found in the
first core step — for example that a nested new item cannot be verified by today's `verify_entry_value`;
a synthetic shape the corpus lacks; a D2u conflict in preview), and what the split does if one occurs.

## 7. Your output contract

- **Your final message is the deliverable.** Write no file. **Use `###` for your own internal headings,
  never `##`** — one `## VERDICT` of your own at the top is fine, and everything under it is `###`.
- **Open with a short verdict paragraph**, then answer each question under its own `### Qn — <title>`
  heading, each beginning with an explicit **Ruling:** line, and **end with a `### The step cut`
  section**: a dependency-ordered list, each step with scope, deliverables, acceptance, risk class and
  driven/window/owner.
- **Cite `file:line` for every claim about existing code**, derived by you. Where you could not verify
  something, say so plainly in one line rather than asserting it.
- **Do not quote any real-configuration content**, and do not propose a test or launch over the real
  corpus other than the existing skip-when-absent tests.

## 8. What this brief could not establish — its own coverage bounds

1. **No gate and no launch was run for this brief.** Every count in §3 is an `rg`/`wc`/`sed` reading on
   2026-09-26, not a compiled figure.
2. **A1's mechanism in §3 is a reading, not a reproduction.** In particular, that `plain_source_nodes`
   does not exempt a new item's plain-source entry, and so that `word: true` in a new item would be
   refused, was read from `edit.rs:7607-7612` and `:9249-9297` and not run.
3. **Nothing here is a claim about espanso's runtime behaviour** — not how it reads `'true'`, not its form
   placeholder grammar, not how it anchors a regex trigger. Plan §3 is the authority; R16 and R30 say it
   is unverified against espanso itself.
4. **No claim about what a window draws.** There is no instrument.
5. **The questions are open.** A ruling that moves a plan §12 item out of Phase 4, or overrides a plan
   sentence (§8.3's live preview in every popover, §8.6's automatic two-way synchronization, §8.7's *Run
   test* button), is a legitimate outcome provided it names the sentence and the reason.
