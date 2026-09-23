# Phase 3 — the design consult, and the fifteen-step split it rules

**Status:** the record of a design decision, taken before any line of Phase 3 exists. It changes no
source file and no other document. [`docs/reviews/phase-3-design.md`](../reviews/phase-3-design.md) is
the consult itself and is the authority for *what* Phase 3 builds, except where §4 below corrects or
narrows it. This file restates it as binding rulings, the step plan, the plan sentences it overrides,
the citation audit and the open-items map. Its shape is
[`2d-7-split-notes.md`](2d-7-split-notes.md)'s.

---

## 1. What the consult was, and what it does not cover

- **Provider:** **Codex**, job `task-muehnlmf-likn54`, `--effort high`, default model, dispatched
  2026-09-23 19:21 UTC and completed 19:33 UTC. There was one consult; the fallback agent was not
  used. `codex-wait.sh` exited 3 on its first window because the job's `updatedAt` froze while its log
  advanced. That is the false stall `codex-dispatch-procedure.md` records. The wait continued on the
  log's mtime and `.job.status`, and the job completed. The job was not cancelled or re-dispatched.
- **The brief** is [`3-design-brief.md`](3-design-brief.md): fourteen questions, Q1–Q14, with its own
  coverage bounds in §8. It takes no position on any question it asks.
- **The reply** is `phase-3-design.md`. Lines 1-21 are this project's provenance header, and the reply
  starts at line 23. It has a `## VERDICT` (23-27), Q1–Q14 under `###` headings (29-387), each
  opening with a **Ruling:** line, and `### The step cut` (389-571). The only edit made to the reply is
  the dropped two-line Codex session trailer.
- **What the consult ran:** no gate and no launch, as the brief required (`:27`). It did not open the
  real corpus. It read three committed synthetic fixtures (`flow-collections.yml`,
  `imports-and-global-vars.yml`, `run-based-removal-envelope.yml`). That is permitted.

**What this record ran:** `rg`, `sed`, `wc` and `git status` reads, plus one Python script that printed
each cited line. **It ran no gate, no `cargo`, no `npm` and no launch, and it opened no real-config
file.** Every count here was read with those tools on 2026-09-23. None is a compiled figure. The
harness-free gate rung stands at `1323 / 461 / 3546 / 200` (2d-8) and this phase did not move it.

Four bounds, stated because each could be assumed:

1. **A design consult is not a review round.** Nothing here is a finding with a severity. The review
   policy is `CLAUDE.md` §7's.
2. **No claim here is about what a window draws, or what espanso does at runtime.** Where §2 assigns a
   reading, it states an obligation and is not evidence. R16 and R30 stay open.
3. **Re-deriving a citation is not validating a design.** A resolving line shows that the consult read
   what it named (§6). Only 3-1, 3-2 and 3-3, run against the compiler and the corpus, can test the
   engine mechanisms the consult proposes.
4. **The tree read was `main` at `a56a69d`**, clean apart from the modified `PROGRESS.json` and this
   phase's three untracked records.

---

## 2. The fifteen-step plan

The consult's step cut (`phase-3-design.md:389-571`) is kept **at fifteen steps, in its order and with
its numbering**. Each step below restates the consult's version and adds the narrowings of §4. Each
step is **one autoclaude phase** with one worker and **one adversarial review** (`CLAUDE.md` §7).

Every step owes the machine-checkable gate set of `CLAUDE.md` §4, run serially for Rust. It records its
rung against `1323 / 461 / 3546 / 200` and explains any module-count change. Every step that adds or
changes a wire code also updates, in the same step, its IPC mirror, `src-tauri/src/dictionary_contract.rs`,
both dictionaries, the `codes.ts` accessor with its reactive wrapper, and their tests. The consult asks
for this at `:393`.

Three terms are used below:

- **Risk class** is the workflow's: `high` or `routine`.
- **Driven** means an unattended `autoclaude-until-done` iteration can run the step to closure. Its
  screen may be locked.
- **Window half** means the step owes a look at a visible window before it closes (ruling 30). Such a
  step is *implemented* driven, but only a session that can look at a visible window can close it.

**Cutting a step.** An orchestrator that judges a step too large before starting it may cut it into
numeric-suffixed pieces (`3-5-1`, `3-5-2`), never lettered ones. It records the cut as a dated addendum
under the step. A step is never cut after its review to hold a fix.

### 3-1 — Compositional mapping edits and scalar form substitution

**Delivers** grouped insertion of several absent fields in one batch, with an ordered insertion group
that has its own verified expectation. Planning keeps an anchor that survives the batch. It also adds a
closed scalar-to-scalar **substitution** intent (`trigger`↔`regex`, one content key↔another) that works
on a compact first entry (`- trigger: …`) without removing the sequence dash.

**Why it comes first:** two limits on today's tree, both re-derived for this record (ruling 2):
`plan_match_edits` anchors every insertion after the same last nameable key (`draft/plan.rs:135-141`),
and `check_every_anchor_survives` refuses two insertions that share an anchor (`draft/audit.rs:387-391`).
So **a draft that adds two absent options is refused today.** Separately, removing the first entry of a
compact item is refused (`patch/edit.rs:1286-1292`; the test at `:9977`).

**Touches** `crates/espansoconfig-core/src/draft/{match_draft,plan,audit,error}.rs`,
`patch/edit.rs`, their tests and synthetic fixtures, and the contract and i18n files for any new
refusal code.

**Acceptance:**
- One save adds two absent options, and a test shown failing first on the unchanged tree says so.
- `replace`→`markdown` works with the two keys in either source order.
- `trigger`→`regex` works on a compact first line.
- A stale anchor, a removed anchor and a duplicate key are each refused by name.
- For every success, comments, sibling values and every byte outside the planned spans are checked
  independently of the engine's own verifier.
- `cargo tree -p espansoconfig-core | rg tauri` is empty.

**Risk `high`. Driven:** yes. Core-first, with no production UI caller. **Depends on** nothing.

### 3-2 — Sequence projection and block scalar-list edits

**Delivers** a projection that tells an absent sequence from a present-empty one, a present-nonempty
one and an unsupported shape, with Rust-derived locations. It also delivers scalar-item insertion and
removal in a block scalar sequence, a typed insertion and removal of a scalar-sequence *field*, and
trigger switches that involve a block list. Verification maps each item's original position to its
result position.

**Scope narrowing (§4.3):** presence metadata covers `DocumentView.imports` as well as `triggers` and
`search_terms`, because 3-9 draws absent against empty imports. If that turns out not to fit this step,
3-9 draws the two states as one and says so.

**Touches** the core model and projection (`model/{match_view,document,value}.rs`), `draft/*`,
`patch/edit.rs`, synthetic fixtures, and contract mirrors for the new projection fields.

**Acceptance:**
- Absent and present-empty lists project differently. The empty-sequence anchor limit
  (`draft/plan.rs:852-869`) is either lifted, with a test, or restated.
- A multi-item insertion and a removal land in one batch beside an edited survivor.
- Removing the last item is explicit: refused, or the key removed as a deliberate intent, never a
  stranded null.
- An item's owned comments go with it, and file-owned comments stay.
- A request outside `triggers`/`search_terms` (for example `vars`, `depends_on` or a `params` list) is
  refused by the closed-surface audit.

**Risk `high`. Driven:** yes. **Depends on** 3-1.

### 3-3 — Flow scalar-list cardinality

**Delivers** delimiter-aware insertion and removal inside flow scalar lists, including empty ones,
**without converting presentation**: `[a, b]` never becomes block style.

**Touches** core planning and verification for scalar lists, synthetic flow tests and refusal
contracts.

**Acceptance:**
- Insertion and removal at the first, middle and last positions.
- The commented multi-line flow list in `flow-collections.yml:16-22` is covered.
- Trailing commas where accepted, Unicode and mixed quoting are covered.
- Retained tokens and every outside byte are identical.
- Ambiguous trivia is refused by name.

**Risk `high`. Driven:** yes. **Depends on** 3-2.

### 3-4 — Bounded creation for the wider editor

**Delivers** a wider `NewMatch`: typed trigger alternatives (single, multiple, regex), typed content
alternatives, the optional Phase 3 scalar fields, and `triggers`/`search_terms` lists. It never accepts
arbitrary nested YAML or an author-chosen key (D1 of 2b-2b-2 stands).

**Touches** `draft/new_match.rs`, the bounded item insertion, creation validation,
`src-tauri/src/commands.rs` (`create_match`) and the wire and contract tests.

**Acceptance:**
- Every supported form creates exactly one item.
- `None` differs from `Some("")` for every optional field.
- List order survives.
- No arbitrary key or collection can be expressed, and the type is what enforces it.
- Creation still ends in `run_one_save`.

**Risk `high`. Driven:** yes. **Depends on** 3-1, 3-2, 3-3.

### 3-5 — Scalar content and options editor, and the cursor action

**Delivers** every eligible scalar field in the editor (the five content fields, `label`, `comment`,
the nine options), content switching with a preview and confirmation, textual option groups, and the
`$|$` action for `replace` only (ruling 18). Save, conflict, compare, copy, reapply and recovery all
cover every added field. It also delivers **R36's conservative rule** (ruling 24).

**Touches** `src/lib/browser/matchEditor.ts`, `recovery.ts`, `reapply.ts`, the workspace coordination,
`MatchEditor.svelte`, `MatchCreator.svelte`, `RecoveryPanel.svelte`, the detail integration and i18n.

**Acceptance:**
- Every added field survives save, conflict, compare, copy, reapply and recovery, with a model test
  per path.
- A field that was absent and is left blank emits no key.
- A `\r` is refused at eligibility, at `editField` and at `beginSave`.
- No control infers a boolean. `uppercase_style` and `force_mode` are editable text with
  exact-string suggestions, and an unfamiliar value is kept.
- A switch needs a confirmation, and the cursor action is undoable.
- R36's rule is pinned by a test.
- **Window half:** EN and ES, the language set through the picker, including one block-scalar content
  conflict.

**Risk `high`. Driven:** implementation yes; the window half per ruling 30. **Depends on** 3-1, 3-4.

**Addendum, 2026-09-23 — cut into two pieces before starting.** The step touches ten files across three
layers, so the orchestrator cut it:

- **3-5-1 — the model and the coordination.** Everything below the components: the editor model
  (`matchEditor.ts` and its baseline, buffers and `fieldIntent`) widened to every eligible scalar field;
  the content-switch intent as one compound, all-or-nothing save intention whose confirmation state is a
  model value; the buffer-only `$|$` action for `replace` with its undo and its several-markers
  advisory as a code; exact-string suggestion data for `uppercase_style` and `force_mode`; the `\r`
  refusal at eligibility, `editField` and `beginSave` for every added field; save, conflict, compare,
  copy, reapply and recovery (`recovery.ts`, `reapply.ts`) covering every added field with a model test
  per path; R36's conservative rule in the workspace coordination, pinned by a test; and any Rust or wire
  work those need, with its dictionaries and accessors in the same piece. **No window half** — it draws
  nothing new.
- **3-5-2 — the components, the i18n and the window half.** `MatchEditor.svelte`, `MatchCreator.svelte`,
  `RecoveryPanel.svelte` and the detail integration drawing 3-5-1's values; the textual option groups
  (one *Insertion* group for `force_mode` and `force_clipboard`); the switch preview and confirmation;
  the cursor action's control; the dictionary keys those need; mounted tests; and the step's window
  half (EN and ES through the picker, one block-scalar content conflict), per ruling 30 and §4.1.

Each piece is one phase with one worker and one review. The acceptance list above is the union of the
two; 3-5-2 closes the step.

**Addendum, 2026-09-24 — 3-5-2 cut into two pieces before starting.** The driven iteration that took
3-5-2 found the screen locked, so the window half could not be read in it. It cut 3-5-2 so the code
could be reviewed and committed on its own:

- **3-5-2-1 — the components and the i18n.** Everything in 3-5-2 above except the window half: the
  components, the option groups, the switch preview and confirmation, the cursor action's control, the
  dictionary keys and accessors, the mounted tests, the ES sentences for ruling 29's inventory, and the
  creation-form decision. Its record says: *"No window reading was performed or claimed."*
- **3-5-2-2 — the window half.** EN and ES through the picker, one block-scalar content conflict, per
  ruling 30 and §4.1, with a minimal uncommitted instrument brought inside its own single review. It
  needs a visible, unlocked screen, and it closes 3-5-2 and step 3-5.

### 3-6 — Multiple and regex trigger controls, and `search_terms`

**Delivers** list editing, trigger-form switching, the `Several`/`Absent` presentation (no silent
winner, raw repair offered), and conservative list reapply (ruling 23).

**Touches** the sequence and switch submodels inside the match editor, recovery, reapply, IPC
integration, the editor components and i18n.

**Acceptance:**
- Block and flow lists keep their style.
- Additions and removals keep the intended order.
- A failed regex keeps the draft, and the finding is `RegexDoesNotCompile` from the Rust validator,
  never a JavaScript `RegExp`.
- Converting multiple→single never silently drops an alias.
- An external reorder or duplicate-list ambiguity refuses reapply for the whole list.
- Recovery either transfers everything or refuses explicitly.
- **Window half:** EN and ES, including the commented multi-line flow list.

**Risk `high`. Driven:** implementation yes; the window half per ruling 30. **Depends on** 3-2, 3-3,
3-4, 3-5.

### 3-7 — The local raw-item core edit

**Delivers** a Rust-cut, **contiguous** owned-range text for one snippet and an exact replacement of
that range, carried as `SaveContent::Edits` through `run_one_save`. It is a new locality-preserving
edit. It is never `ReplaceText` scrolled to the snippet (ruling 11).

**Touches** the core range planner and verifier, save integration tests, new `src-tauri` read/save
command adapters and their wire contracts.

**Acceptance:**
- Refused: zero or two items in the result, escaped indentation, a changed sibling, a result that does
  not parse, and an owned range with holes (a non-contiguous run set).
- The BOM and every byte outside the range are preserved.
- Both block-scalar seams are checked.
- A stale identity is refused.
- An unknown entry inside the range may change deliberately, and those outside it survive.

**Risk `high`. Driven:** yes. **Depends on** 3-1.

### 3-8 — The local raw UI, and CF-55

**Delivers** local raw drafting, wording for the range and its whole-document fallback, retention under
conflict, and **CF-55's fix on both raw surfaces**: *Undo* and *Redo* are disabled whenever their
transitions refuse (ruling 13).

**Touches** a new browser raw-snippet model and component, `rawEditor.ts`, `RawEditor.svelte`,
workspace invalidation and reconciliation, the detail integration and i18n.

**Acceptance:**
- No JavaScript byte slicing.
- A `\r` is refused at load, at edit and at send.
- Under one held save, *Undo* and *Redo* are neither enabled nor mutating, on both surfaces, with a
  model test and a mounted test.
- A successful save invalidates the old identities.
- An uncertain write keeps the text and needs reconciliation.
- **Window half:** EN and ES, covering a contiguous snippet, a disjoint-ownership refusal and a `\r`
  refusal. The held-save controls and *Stop editing* are read **in the same launch as** their DOM state
  (CF-55's unread half).

**Risk `high`. Driven:** implementation yes; the window half per ruling 30. **Depends on** 3-7.

### 3-9 — File-scope inspector

**Delivers** an ordered display of imports, the absent/empty/unsupported states, and an accurate
explanation of `_` files ("not auto-loaded", never "inactive"). It adds no new writer, no import
resolution and no rename control (ruling 14).

**Touches** the browser file-detail model, the document and detail components, `Sidebar.svelte` and
i18n.

**Acceptance:**
- Every projected import is drawn, and unsupported entries stay visible.
- No invented resolution.
- **Window half:** EN and ES.

**Risk `routine`. Driven:** implementation yes; the window half per ruling 30. **Depends on** 3-2 (§4.3).

### 3-10 — Per-file bulk coordinator

**Delivers** one backend bulk command. It preflights every file, keeps consent per file, and runs one
`run_one_save` per file in sequence, stopping at the first conflict, refusal, failure or uncertain
write. It accounts for every file (ruling 19).

**Touches** bounded core bulk planning if needed, `src-tauri/src/commands.rs`, the bulk request and
result types, command and save integration tests, and i18n codes.

**Acceptance:**
- Several matches and absent options share one save per file.
- A preflight blocker writes nothing.
- An injected second-file failure keeps the first file's success and reports it.
- An uncertain write stops later attempts.
- Each file's actual backup or no-op result is visible.
- No `force` flag, and no path lock held around `run_one_save`.

**Risk `high`. Driven:** yes. **Depends on** 3-1, 3-5.

### 3-11 — Bulk selection and inspector

**Delivers** multi-select, **Mixed** by exact source spelling (ruling 20), explicit intents, exclusions,
consent review and partial outcomes.

**Touches** a browser bulk model, selection and workspace coordination, `SnippetList.svelte`, a new
inspector component and i18n.

**Acceptance:**
- Only the seven allowed options can be submitted.
- An untouched Mixed control emits nothing.
- A stale selection blocks.
- Open drafts are respected.
- Exclusions and execution failures are counted separately.
- Draft undo works, and no disk batch undo is promised.
- **Window half:** EN and ES, including a partial success.

**Risk `high`. Driven:** implementation yes; the window half per ruling 30. **Depends on** 3-6, 3-10.

### 3-12 — The application sidecar store

**Delivers** a versioned per-workspace metadata store in a new `src-tauri` module, confined to the app's
own storage. It has lossless path keying, atomic replacement, truthful quarantine, last-write-wins
behaviour and orphan retention (rulings 25–27).

**Touches** a new `src-tauri` module, the app-path setup and command adapters, storage and contract tests
and i18n codes. **No core dependency on `tauri`.**

**Acceptance:**
- Every write stays under app storage, and the writer takes no destination path.
- A failed quarantine leaves the bytes intact and says so.
- A future schema version is not overwritten.
- An interrupted replacement leaves the old or the new state valid.
- A two-instance race behaves as documented (last write wins).
- The 30-day orphan policy is tested with controlled paths and time.
- **`CLAUDE.md` §6's first bullet gains the application-metadata sentence of ruling 25 in this step**,
  because that is when the second writer exists. The sentence is not written before then.

**Risk `high`. Driven:** yes. **Depends on** nothing in the editor. It is placed here to keep storage
work bounded.

### 3-13 — Display names and visible creation defaults

**Delivers** display names that always show the real filename, and the seven per-file textual defaults,
seeded **visibly** into a new-snippet draft (ruling 28).

**Touches** the browser sidebar, preference and creation models, the workspace integration,
`Sidebar.svelte`, `MatchCreator.svelte`, a preferences control and i18n.

**Acceptance:**
- Every emitted default was on screen before *Create*, and removing one suppresses its key.
- Empty differs from absent.
- A later preference change does not touch an open draft.
- Recovery values are never overridden.
- An absent or corrupt sidecar leaves creation working.
- **Window half:** EN and ES, with a long name.

**Risk `high`. Driven:** implementation yes; the window half per ruling 30. **Depends on** 3-4, 3-5,
3-12.

### 3-14 — Delete-conflict wording and action placement

**Delivers** the fold (CF-52) and paragraph-overlap (CF-54) changes **the owner rules for**. CF-53's
labels are kept (§4.4; ruling 33).

**Touches** `MatchDeleter.svelte`, its message producers where needed, component tests, i18n and records.

**Acceptance:**
- The owner's rulings on CF-52 and CF-54 are quoted verbatim in the step's notes **before** any change.
  If the owner rules "leave as is", the step records that and changes nothing on that row.
- Where a change is ruled, the choices are visible at 1180x728 in EN and ES before the long comparison,
  and keyboard reach and focus are unchanged.
- Repeated opening text is removed without losing a distinct fact.
- The save-origin and external-origin panels are both read.

**Risk `routine`. Driven:** no. It needs the owner's ruling, then the window half. **Depends on** 3-5's
final editor layout.

### 3-15 — Cross-layer preservation and Phase 3 closure

**Delivers** preservation evidence operation by operation, and a scope statement that matches what
shipped (ruling 17).

**Touches** synthetic property and integration tests across the core and `src-tauri`, IPC and model
integration tests, the Phase 3 translation-review inventory (ruling 29), and the phase records.

**Acceptance:**
- Every new writer has a success case and a refusal case.
- Unknown bytes and coverage are conserved outside explicit raw edits, checked through the command path
  (disk bytes and the refreshed projection).
- Stale, uncertain and partial bulk outcomes are covered.
- A deliberately corrupted candidate fails the oracle.
- The window halves owed by 3-5 … 3-14 are listed, each as read (by whom) or unread.
- R16, R30, R35, R38 and the untouched CF rows are stated accurately bounded.

**Risk `high`. Driven:** yes. It makes no new window claim and adds no feature. **Depends on** 3-1 …
3-14.

---

## 3. The binding rulings

Each entry names the consult question it comes from. Where §4 narrows an entry, the entry says so.

**Scope**

1. **Phase 3 keeps** trigger and content switching, scalar metadata and options, list cardinality for
   `triggers`/`search_terms`, the cursor action, local raw editing, bulk options, and the sidecar with
   its defaults. **Phase 4 keeps** variables, the form builder, reference diagnostics, previews and the
   regex test bench. **Out of Phase 3:** import editing and resolution, file renames, cross-file moves,
   post-save batch undo, and visual editing of YAML anchors, aliases, tags and merge keys [Q1].
2. **Two limits of today's engine are facts, not falsifiers**, and 3-1 takes both: several absent
   fields cannot be inserted in one batch (shared anchor), and the first entry of a compact item cannot
   be removed [Q1, Q14; re-derived in §6].
3. **Core capability comes before the control that promises it.** No UI step exposes a structural edit
   whose core step has not closed [Q1].

**The trigger side (Q2)**

4. Four new core capabilities, **narrowly typed**: explicit sequence presence and location; scalar-item
   insertion and removal restricted to `triggers` and `search_terms`; a typed scalar-sequence field
   insertion (`FieldInsert` stays scalar-only); and an explicit trigger-switch intent. None of them takes
   caller-supplied YAML, and `InsertItem` is not generalized into a collection builder.
5. A new non-empty list is emitted in block style. An explicitly requested empty list is `[]`. **A flow
   list stays a flow list.**
6. `Several` shows every form and picks none; raw repair is offered. `Absent` offers an explicit *Add
   trigger*. A switch needs a preview and a confirmation, and removing the final trigger never leaves an
   unnoticed null.
7. `regex` is edited as text and validated by the Rust validator on save. **Phase 3 adds no
   debounce-validation command** (§5 row 1). A `RegexDoesNotCompile` finding establishes compilation under
   this crate's `regex` version, not espanso's runtime acceptance.

**The content side and options (Q3)**

8. Editing an existing content field is UI work over today's scalar draft. A switch of content kind is
   one save intention with a preview. It converts no content and removes no companion field silently.
9. Shorthand `form` is editable **as layout text**. `form_fields` stays read-only until Phase 4, and
   editing a placeholder creates or deletes no field definition.
10. **Every option is a textual control (D2u).** `uppercase_style` and `force_mode` may offer suggestions
    by exact string comparison, and an unfamiliar value is kept. **`force_mode` and `force_clipboard` get
    two separately labelled controls in one *Insertion* group**, with no inferred precedence and no
    migration (§5 row 2). The `anchor:` key is editable text. YAML `&anchor`/`*alias` syntax stays behind
    the hazard gate. One editor session and one registry. No separate "advanced editor".

**The raw escape hatch (Q4)**

11. **The per-snippet hatch is a new locality-preserving core edit** over the snippet's **owned
    physical-line range**. It is never `ReplaceText`. The range must be **contiguous**: an owned run set
    with file-owned holes is refused, and the whole-document editor is offered instead.
12. The `\r` refusal applies to the snippet's owned text only. A snippet whose result does not parse is
    **not** saved through the local edit; the whole-document editor, with its content-addressed
    `DocumentDoesNotParse` consent, stays the repair route.
13. **CF-55, ruled:** *Undo* and *Redo* are disabled whenever their transitions refuse, on both raw
    surfaces. Today `undoEdit` already refuses outside `editing` (`rawEditor.ts:738-741`, through
    `isEditable` at `:696-698`), while the view derives `canUndo` from history alone (`:1863`). CF-55 is
    therefore **an affordance mismatch, not a demonstrated mid-save mutation**. This record's reading of
    the code agrees. Fixed in 3-8.

**Imports and `_` files (Q5)**

14. **Display only.** Every import is drawn in order, including unsupported entries, and no resolution is
    claimed. `_` means "not auto-loaded", never "inactive". **No rename command**, and no copy-and-delete
    emulation of one. A later import editor needs its own document-level draft surface.

**Unknown-field preservation (Q6)**

15. The property is: *every pre-existing unknown entry outside an explicitly authored raw replacement
    survives byte-identically and stays accounted for after a committed Phase 3 edit, and a refused
    operation changes no file bytes.* Coverage is recomputed on the new index, and node ids are never
    compared across parses.
16. It is verified **through `run_one_save`** on temporary synthetic files as well as through the engine.
    Unknown rows stay read-only in the structured editor.
17. **R30 stays open.** A schema file supplied by the owner may later be vendored with its version,
    provenance and licence recorded, followed by an offline differential field-list check. It is not a
    Phase 3 prerequisite, it needs no fetch, and it would not touch R16.

**Cursor hint (Q9)**

18. A buffer-only *Insert cursor position* action, **for `replace` only**. If `$|$` is already present,
    the action selects it. If there are several, a localized advisory is shown. No new `FindingCode` and
    no core work.

**Bulk edit (Q7)**

19. **Per-file atomicity, not cross-file atomicity.** One backend coordinator preflights every file,
    then calls `run_one_save` once per file in sequence. It stops at the first conflict, refusal, failure
    or uncertain write, keeps the earlier results and marks later files *not attempted*. The outcomes are
    **saved / already unchanged / refused or conflicted / write outcome unknown / not attempted /
    excluded before apply**. It never says "nothing was written" unless the execution shows that for the
    whole request (§5 rows 3–5).
20. **Allowed fields:** `word`, `left_word`, `right_word`, `propagate_case`, `uppercase_style`,
    `force_mode`, `force_clipboard`. **Mixed compares presence and the exact source spelling, sliced in
    Rust.** `ScalarView.text` is decoded text (`model/scalar.rs:30-35`), so it cannot be the comparison.
    Mixed is a display state and never a value sent to Rust.
21. The "Move to file" row is **removed** (D2r, R25). One undo entry restores the unsaved bulk *draft*;
    nothing promises a post-save batch undo. Backups follow the existing session policy, and a later save
    in a session may legitimately report no new backup.
22. Consent stays partitioned **per file, base revision, candidate and exact findings multiset**, even
    when one screen summarizes N files. There is no batch-wide force bit. A changed intent, selection or
    candidate invalidates the consent that covered it.

**Conflict, reapply and identity (Q13)**

23. **No newly editable field ships without draft retention, conflict compare, reapply and an explicit
    recovery disposition, in the same step.** Sequence reapply is conservative: it is allowed only when
    the target list's baseline is unchanged, or when the whole intended result is already present.
    Otherwise the whole list collides. A switch is a compound intent, all or nothing.
24. **R36, the conservative rule:** while any stale match draft is open for a document, move and other
    target-changing structural actions in that document are withheld. Never an arena-node lookup as a
    producer. Lands in 3-5. **R37:** the view, the choices and the submission identity come from one read
    of the projection in one synchronous block. TypeScript does not force this, and the code comment that
    states the rule says so.

**The sidecar (Q8)**

25. **The sidecar is application metadata, not a user file, and is not written through
    `save_document`.** The rule becomes: *`save_document` is the only writer of user espanso
    configuration contents; a separate application-metadata writer may write only the application-owned
    sidecar store and accepts no destination path.* That sentence enters `CLAUDE.md` §6 in 3-12, not
    before.
26. Format and I/O live in `src-tauri`, and the core stays Tauri-free. The format is versioned. The file
    name is a stable hash of a versioned, lossless encoding of the canonical root path, and the keys are
    lossless relative paths. **A moved workspace opens a fresh sidecar** (§5 row 7). There is no watcher:
    the sidecar is reloaded on open and before each mutation, and concurrent instances follow
    last-write-wins.
27. Corruption has four truthful outcomes: successful quarantine; failed quarantine (original left
    untouched, in-memory defaults, "cannot save preferences" reported); future schema retained and not
    rewritten; a rename reported only after it happened. Deleting the sidecar loses display names,
    ordering and defaults, and changes no espanso file (§5 row 6).
28. **Defaults** are the seven bulk-option fields, stored as optional **text**, absent distinct from
    empty. They are never booleans (§5 row 8). They seed a creation draft once and visibly, are removable,
    and never override recovery values. Display names are user data and are not translated. The real
    filename stays visible.

**i18n and window evidence (Q10, Q11)**

29. **New keys land with their owning step.** The consult's 125–200 per language is a planning range,
    not a measurement. New families: `browser.bulkEdit.*`, `browser.rawSnippet.*`, `browser.fileScope.*`,
    `browser.sidecar.*`, each through `codes.ts` accessors. A `.ts` model exposes codes and operands,
    never assembled sentences, and R31's markup-only scan is not cited as covering them. **A separate
    Phase 3 translation-review inventory** is kept (added or changed ES sentences, key, producer), and
    2d-7-10's 145-row inventory is not extended. R35 stays the owner's before Phase 5.
30. **Every new visible editing surface owes a window half before its step closes** (3-5, 3-6, 3-8,
    3-9, 3-11, 3-13, 3-14). The steps with none are 3-1, 3-2, 3-3, 3-4, 3-7, 3-10, 3-12 and 3-15, and
    their records say, in the consult's words: *"No window reading was performed or claimed."* **Who
    reads is narrowed in §4.1.** Mounted jsdom evidence is recorded as mounted evidence and is never
    credited as a screen. If a reading needs an instrument, the owning step builds a minimal, uncommitted
    one and brings it inside its single review.
31. **R38 is touched deliberately, never closed wholesale:** a block-scalar content conflict (3-5), a
    commented multi-line flow list (3-6), `\r` and disjoint ownership (3-8), and read-only or excluded
    selections (3-11). Each record names the exact screen and action seen.

**Carried-forward items (Q12)**

32. **CF-55 → 3-8** (entry 13). **CF-52 and CF-54 → 3-14, after the owner's ruling** (§4.4). **CF-53 →
    the owner; the labels are kept.** **CF-51 → the owner, before Phase 5.** **2d-6 §7 item 1** (the
    drift checker) and **item 10** (`dispose()` on close) → **no phase**, because neither is a dependency
    of match editing. Records touched in Phase 3 correct their own citations by hand.
33. CF-1 … CF-50 keep their "no phase named" dispositions. New surfaces **change the subject** of some
    rows without closing them: CF-12, CF-14 … CF-18, CF-39, CF-40 (recovery); CF-13, CF-24, CF-25 (held
    and acknowledgement states); CF-27 … CF-30 (bulk invalidation); CF-50 (R38). No row is claimed
    closed unless its own missing observation is supplied.

**Process**

34. **One worker and one adversarial review per step.** Blockers are fixed, verification is re-run, and
    the step closes. No lettered re-review phase (`CLAUDE.md` §7). If a structural capability fails in
    3-1 … 3-3, the step keeps the working operations, refuses the combination, and the orchestrator adds
    a numbered core step before any control exposes it [Q14].

---

## 4. Corrections and narrowings — where this record departs from the consult

### 4.1 Narrowing: who may take a window half

The consult says every UI step "needs an owner-present window reading before its UI step closes"
(`:297`), and in its step list, "owner for closure". This record narrows **who** reads. A window half is
a look at a **visible** window, which needs an unlocked screen and a `screencapture -l <window>` capture
that is not the lock screen (2d-7's test). **A model's look at such a capture is recorded as a model's
look.** The owner is asked only for what a person must do: real keyboard and pointer input, and
judgements the records reserve to a person (wording clarity, layout acceptance, CF-52/CF-54). This
follows the owner's own instruction in the 2d-7-9 session to read captures rather than spend their time.

Two things do not change:

- A driven step on a locked screen cannot take a window half. It records the half as **owed, unread**,
  and **does not close**. It stops under the workflow's BLOCKED procedure.
- No window half is credited from a hidden-page snapshot or from a mounted test.

### 4.2 Narrowing: raw *Undo*'s unread half stays unread until 3-8 reads it

Ruling 13 adopts the consult's reading that CF-55 is an affordance mismatch. That is **a reading of the
code** (`rawEditor.ts:738-741`, `:1863`), and it matches what this record read. It is not a window
observation. The *Stop editing* half of CF-55 (drawn dark where the DOM recorded it disabled) stays
unreconciled until 3-8 reads the DOM state and the capture **in one launch**.

### 4.3 Narrowing: 3-9's dependency on 3-2 names `imports` explicitly

The consult has 3-9 use "the sequence-presence metadata added in `3-2`" (`:140`). Its 3-2 is described
over match fields (`triggers`, `search_terms`). The import list is a **document-level** field
(`model/document.rs:142-147`). 3-2's scope here therefore names `DocumentView.imports`, and the fallback
in §2 (3-9 draws absent and empty as one state, and says so) keeps 3-9 from depending on an unstated
widening.

### 4.4 Correction: CF-52 and CF-54 are the owner's rulings, not a step's decision

The consult assigns CF-52 and CF-54 to 3-14 as changes (`:328`, `:330`). The records that carry them say
otherwise: CF-52 is "a ruling owed by the owner, for a later phase (entry 26)", and CF-54 is a "wording
ruling owed to a later phase" (`2d-7-10-notes.md:568`, `:570`). Entry 26 of the 2d-7 record
(`2d-7-split-notes.md:740-742`) measured the fold and did not call it a defect. So 3-14 **starts with the
owner's ruling**, quoted verbatim, and changes only what that ruling asks. The consult's layout acceptance
applies only where a change is ruled.

### 4.5 Clarification: CF-1 … CF-50 includes rows with no subject left

The consult says CF-1 … CF-50 "retain their existing no-phase dispositions" (`:336`). For CF-1 … CF-6
(the rebindings) the instrument they describe no longer exists (2d-8). They are not open in any phase
and are not closed by proof. They ended with the binary, as `2d-7-10-notes.md:504` says. CF-47 … CF-49
are constructed readings and are never credited as reached.

### 4.6 Placement note: the `CLAUDE.md` sentence and the plan text

Ruling 25 changes the "only writer" sentence. §5 below overrides several plan sentences. **This phase
edits neither `CLAUDE.md` nor `IMPLEMENTATION_PLAN.md`**, because its deliverables are the three records.
The `CLAUDE.md` sentence lands in 3-12, when the second writer exists. The plan text stays as written,
and **this record's §5 is the binding override list**. A later records step may annotate the plan with a
pointer here.

### 4.7 Narrowing: i18n figures are estimates

The consult's per-step key table (`:269-283`) is a planning range. No step's acceptance is measured
against it, and each step records the keys it actually added.

---

## 5. Plan sentences this record overrides

Each override comes from the consult, and the line numbers are `IMPLEMENTATION_PLAN.md`'s, re-derived.

| # | Plan text | Line | Override | Ruling |
|---|---|---|---|---|
| 1 | "asks Rust to validate on a debounce" | 479-480 | Phase 3 validates on save only; no debounce-validation command | 7 |
| 2 | "Present a single **Insertion method** control" | 743-744 | Two separately labelled textual controls in one *Insertion* group | 10 |
| 3 | "If any file fails validation, **nothing is written anywhere**" | 808-809 | "All selected file candidates are checked before writing begins. Each file is then saved separately with its own revision check. A later failure can leave earlier files saved; the result lists what happened to every file." | 19 |
| 4 | "Move to file [ sql.yml ▾ ]" | 797 | Removed from the bulk inspector | 21 |
| 5 | "One backup per affected file, and a single undo entry covering the batch" | 810 | The existing backup-session policy; one undo entry for the unsaved bulk draft only | 21 |
| 6 | "Deleting the sidecar loses display names and nothing else" | 847 | "…loses display names, ordering preferences and new-snippet defaults. Existing espanso configuration files are unchanged." | 27 |
| 7 | "Keyed by path relative to the config dir, so the whole workspace can move" | 849 | Relative keys, but a moved workspace opens a fresh sidecar | 26 |
| 8 | `"newSnippetDefaults": { "word": true, … }` | 839 | Defaults are optional text, never booleans | 28 |

---

## 6. Citation audit

**The consult makes 145 backticked `file:line` citations**, found with `rg -n -o` for a backticked token
ending `:NNN` or `:NNN-NNN` over `phase-3-design.md` below its header. They name **133 distinct
locations**. Every one of the 133 was checked by opening the cited line on the current tree, using a
script that printed each cited line, and then reading the context by hand wherever the printed line
alone did not carry the claim.

- A single-line citation *resolves* if the named construct is at that line or begins there.
- *With a note* marks an offset, a reversed pair, or a citation that resolves but does not by itself
  carry the claim built on it.

**Result: 133 distinct citations; 124 resolve, 9 resolve with a note, 0 do not resolve.** None of the
nine notes changes a ruling. Two of them confirm a ruling's premise at a neighbouring line (rows 15 and
17: `edit.rs:5197-5198`'s `RemovalWouldEmptyTheSequence`, and `audit.rs:116-117`'s key whitelist).

Two consult premises that carry rulings were re-derived beyond their line, because the step order rests
on them:

- **The shared insertion anchor** (ruling 2). `plan.rs:135-141` builds every `FieldInsert` with
  `FieldInsert::after(path, anchor, …)` using the one `anchor` from `last_nameable_key`.
  `audit.rs:387-391` returns `SharedInsertionAnchor` when a second insertion names an anchor already
  held.
- **The compact first entry** (ruling 2). `edit.rs:1286-1292` documents the refusal ("the reachable
  case is the first entry of a compact `- key: value` mapping"), and `edit.rs:9977` is the test
  `removing_the_first_entry_of_a_compact_item_is_refused`.

The "Lines" column is the line of `phase-3-design.md` where each citation appears. Several lines mean the
consult cites the location more than once.

| # | Lines | Citation | Verdict |
|---|---|---|---|
| 1 | 35 | `crates/espansoconfig-core/src/draft/plan.rs:135` | resolves — `if !insertions.is_empty() {` |
| 2 | 35 | `crates/espansoconfig-core/src/draft/audit.rs:387` | resolves — `if let Some((first, _)) = anchors.iter().find(\|(_, held)\| *held =…` |
| 3 | 36, 91 | `crates/espansoconfig-core/src/patch/edit.rs:1286` | resolves — `/// The entry does not occupy whole lines of its own.` |
| 4 | 36 | `crates/espansoconfig-core/src/patch/edit.rs:9977` | resolves — `fn removing_the_first_entry_of_a_compact_item_is_refused() {` |
| 5 | 37, 55 | `crates/espansoconfig-core/src/draft/plan.rs:852` | resolves — `/// # A sequence is seen only through its first element` |
| 6 | 39 | `crates/espansoconfig-core/src/model/match_view.rs:42` | resolves — `const MODELLED_KEYS: [&str; 22] = [` |
| 7 | 39 | `src/lib/components/DetailPane.svelte:1694` | resolves — `{#if detail.trigger.triggers !== null}` |
| 8 | 39, 142 | `src/lib/components/Sidebar.svelte:121` | resolves — `{#if row.document.disabled}` |
| 9 | 39 | `crates/espansoconfig-core/src/persist/save.rs:430` | resolves — `/// A whole replacement text, written **exactly as submitted**.` |
| 10 | 44 | `IMPLEMENTATION_PLAN.md:1122` | resolves — `### Phase 4 — variables and forms` |
| 11 | 47, 106 | `IMPLEMENTATION_PLAN.md:1162` | resolves — `- Visual editing of anchors, aliases, tags or merge keys` |
| 12 | 55 | `crates/espansoconfig-core/src/model/match_view.rs:171` | resolves — `/// 'triggers', one item per source entry, in source order.` |
| 13 | 57 | `crates/espansoconfig-core/src/patch/edit.rs:584` | resolves — `InsertItem`'s licence: one flat block-mapping item with scalar fields (579-590) |
| 14 | 57 | `crates/espansoconfig-core/src/patch/edit.rs:788` | resolves — `/// One requested change: delete a whole **sequence item**, trivia …` |
| 15 | 57 | `crates/espansoconfig-core/src/patch/edit.rs:5196` | resolves with a note — `editable_sequence_item`; the only-item refusal `RemovalWouldEmptyTheSequence` is at 5197-5198 |
| 16 | 59 | `crates/espansoconfig-core/src/patch/edit.rs:349` | resolves — `pub struct FieldInsert {` |
| 17 | 59 | `crates/espansoconfig-core/src/draft/audit.rs:114` | resolves with a note — the line is the `Scalar` arm; the key whitelist the consult means is the `InsertField` arm at 116-117 |
| 18 | 63 | `crates/espansoconfig-core/src/draft/audit.rs:138` | resolves — `/// Refuses a batch whose edits depend on one another.` |
| 19 | 63 | `crates/espansoconfig-core/src/draft/audit.rs:343` | resolves — `fn check_every_anchor_survives(` |
| 20 | 65, 381 | `crates/espansoconfig-core/src/patch/edit.rs:4320` | resolves with a note — the item-expectation replay; the consult's sentence cites 4320 and 7248 in the reverse order of its two claims |
| 21 | 65, 381 | `crates/espansoconfig-core/src/patch/edit.rs:7248` | resolves with a note — the scalar-verification loop that resolves the edit's original path (7248-7262); see row for 4320 on the order |
| 22 | 67 | `crates/espansoconfig-core/src/patch/edit.rs:799` | resolves — `/// # What travels with it` |
| 23 | 67 | `IMPLEMENTATION_PLAN.md:406` | resolves — `#### Comment ownership rules` |
| 24 | 77 | `crates/espansoconfig-core/src/validate/mod.rs:756` | resolves — `let code = match entry.trigger.kind {` |
| 25 | 77 | `crates/espansoconfig-core/src/validate/mod.rs:570` | resolves — `pub fn class(&self) -> FindingClass {` |
| 26 | 79 | `IMPLEMENTATION_PLAN.md:479` | resolves — `**Do not send every keystroke to Rust.** The frontend edits a DTO l…` |
| 27 | 79 | `crates/espansoconfig-core/src/validate/mod.rs:288` | resolves — `/// Rule 6. A 'regex' trigger did not compile under **this crate's*…` |
| 28 | 81 | `crates/espansoconfig-core/src/patch/edit.rs:1232` | resolves — `/// A structural edit named a **flow** collection, or something ins…` |
| 29 | 81 | `IMPLEMENTATION_PLAN.md:431` | resolves — `**For new scalars:**` |
| 30 | 81 | `IMPLEMENTATION_PLAN.md:456` | resolves — `**Quote a single-line scalar when it** is empty; has leading/traili…` |
| 31 | 81 | `crates/espansoconfig-core/tests/corpus/synthetic/flow-collections.yml:13` | resolves — `search_terms: [greeting, saludo, "hola"]` |
| 32 | 87 | `crates/espansoconfig-core/src/draft/match_draft.rs:73` | resolves — `pub enum MatchField {` |
| 33 | 87 | `crates/espansoconfig-core/src/draft/plan.rs:815` | resolves — the signature line of `plan_scalar` (810-816) |
| 34 | 87 | `src/lib/browser/matchEditor.ts:940` | resolves — `export function fieldEligibility(match: MatchView, field: EditableF…` |
| 35 | 91 | `crates/espansoconfig-core/src/draft/audit.rs:384` | resolves — `if removed.contains(&anchor) {` |
| 36 | 93 | `IMPLEMENTATION_PLAN.md:760` | resolves — `- Fields are extracted from '[[placeholders]]' in the layout; addin…` |
| 37 | 100 | `IMPLEMENTATION_PLAN.md:743` | resolves — `> Do not expose 'force_mode' and 'force_clipboard' as two unrelated…` |
| 38 | 102 | `crates/espansoconfig-core/src/model/match_view.rs:297` | resolves — `/// The match options of plan section 3.3, every one as source text.` |
| 39 | 102 | `crates/espansoconfig-core/src/model/match_view.rs:339` | resolves — `/// **Every badge is derived from a key's presence or from a 'type'…` |
| 40 | 106 | `crates/espansoconfig-core/src/model/match_view.rs:318` | resolves — `/// 'anchor' — plan section 3.3's "other" field.` |
| 41 | 106 | `crates/espansoconfig-core/src/draft/match_draft.rs:108` | resolves — `/// 'anchor'.` |
| 42 | 108 | `src/lib/browser/matchEditor.ts:339` | resolves — `export const EDITABLE_FIELDS: readonly EditableField[] = [` |
| 43 | 108 | `src/lib/browser/matchEditor.ts:1077` | resolves — `export function baselineOf(match: MatchView): MatchBaseline {` |
| 44 | 108, 351 | `src/lib/browser/matchEditor.ts:1162` | resolves — `export function matchDraftOf(baseline: MatchBaseline, buffers: Matc…` |
| 45 | 108 | `src/lib/browser/matchEditor.ts:2583` | resolves — `for (const field of EDITABLE_FIELDS) {` |
| 46 | 122 | `crates/espansoconfig-core/src/persist/save.rs:426` | resolves — `/// **This mode carries the patch engine's guarantee**: every byte …` |
| 47 | 122 | `crates/espansoconfig-core/src/persist/save.rs:439` | resolves — `/// **It is not a locality-preserving edit and must never be descri…` |
| 48 | 124 | `crates/espansoconfig-core/src/model/match_view.rs:399` | resolves — `/// The slice is the match's own node — its mapping — so trivia *ou…` |
| 49 | 124 | `crates/espansoconfig-core/src/patch/edit.rs:841` | resolves — `/// The clone is the item's **owned physical-line runs**: the envelope` |
| 50 | 126 | `crates/espansoconfig-core/src/patch/edit.rs:439` | resolves — `/// # The envelope is a set of runs, not one span ('PROGRESS.md', R…` |
| 51 | 126 | `crates/espansoconfig-core/src/patch/edit.rs:5083` | resolves — `fn lift_item(` |
| 52 | 128 | `CLAUDE.md:178` | resolves — `- 'document_text' answers valid UTF-8 or a typed 'NotUtf8 { path, o…` |
| 53 | 128 | `CLAUDE.md:184` | resolves — `- **A '<textarea>' value has every line break normalized to LF, and…` |
| 54 | 130 | `crates/espansoconfig-core/src/persist/save.rs:1237` | resolves — `let produced = match content {` |
| 55 | 130 | `crates/espansoconfig-core/src/persist/save.rs:1244` | resolves — `// Step 5, over the candidate. The edit branch treats a failed pars…` |
| 56 | 130 | `CLAUDE.md:163` | resolves — `- A raw save may write text the YAML parser rejects — the owner's s…` |
| 57 | 134 | `src/lib/browser/rawEditor.ts:696` | resolves — `export function isEditable(session: RawEditorSession): boolean {` |
| 58 | 134 | `src/lib/browser/rawEditor.ts:738` | resolves — `export function undoEdit(session: RawEditorSession): RawEditorSessi…` |
| 59 | 134 | `src/lib/browser/rawEditor.ts:1852` | resolves — `export function rawEditorView(session: RawEditorSession): RawEditor…` |
| 60 | 142 | `crates/espansoconfig-core/src/model/document.rs:142` | resolves — `/// 'imports', one item per source entry, in source order.` |
| 61 | 142 | `src/lib/browser/workspace.svelte.ts:703` | resolves — `imports: view.imports,` |
| 62 | 144 | `IMPLEMENTATION_PLAN.md:88` | resolves — `- Default include glob: '../match/**/[!_]*.yml'` |
| 63 | 146 | `IMPLEMENTATION_PLAN.md:99` | resolves — `\| 'imports' \| array of paths \| pull in other match files, incl. …` |
| 64 | 146 | `crates/espansoconfig-core/tests/corpus/synthetic/imports-and-global-vars.yml:5` | resolves — `imports:` |
| 65 | 150 | `IMPLEMENTATION_PLAN.md:621` | resolves — `\| 15 \| Rename changing profile precedence or '_' auto-load \| war…` |
| 66 | 150, 191, 222 | `CLAUDE.md:152` | resolves — `- 'espansoconfig_core::persist::save_document' ('crates/espansoconf…` |
| 67 | 162 | `crates/espansoconfig-core/src/model/unknown.rs:94` | resolves — `/// The path that names this entry, or 'None' when **no path can**.` |
| 68 | 162 | `crates/espansoconfig-core/src/model/unknown.rs:130` | resolves — `impl MappingCoverage {` |
| 69 | 166, 191 | `src-tauri/src/commands.rs:1830` | resolves — `fn run_one_save(` |
| 70 | 166 | `src-tauri/src/commands.rs:1934` | resolves — `commit_and_record`, which calls `save_document` at 1941 |
| 71 | 168 | `crates/espansoconfig-core/src/model/unknown.rs:54` | resolves — `/// The value's byte span, **whole and undescended**.` |
| 72 | 168 | `src/lib/browser/detail.ts:621` | resolves — `export function describeUnknown(entry: UnknownEntry): UnknownRow {` |
| 73 | 170, 385 | `PROGRESS.md:123` | resolves — `\| R16 \| **The round-trip oracle parses with saphyr (YAML 1.2), bu…` |
| 74 | 170 | `PROGRESS.md:133` | resolves — `\| R30 \| **Nothing in the projection is proven against espanso its…` |
| 75 | 176 | `IMPLEMENTATION_PLAN.md:808` | resolves — `- The whole operation is **one save transaction per file**, with on…` |
| 76 | 180 | `crates/espansoconfig-core/src/persist/save.rs:466` | resolves — `pub struct SaveRequest<'a> {` |
| 77 | 180 | `crates/espansoconfig-core/src/persist/save.rs:1204` | resolves — step 1, the lock held until `save_document` returns |
| 78 | 203 | `IMPLEMENTATION_PLAN.md:803` | resolves — `- Only **scalar option fields** are bulk-editable: 'word', 'left_wo…` |
| 79 | 204 | `crates/espansoconfig-core/src/model/scalar.rs:30` | resolves — `/// The scalar's text.` |
| 80 | 207 | `IMPLEMENTATION_PLAN.md:797` | resolves — `Move to file [ sql.yml ▾ ]` |
| 81 | 207 | `CLAUDE.md:168` | resolves with a note — cited for D2r and R25; line 168 is D2u, D2r and R25 are at 169-170 |
| 82 | 208, 209 | `IMPLEMENTATION_PLAN.md:810` | resolves — `- One backup per affected file, and a single undo entry covering th…` |
| 83 | 209 | `crates/espansoconfig-core/src/persist/save.rs:493` | resolves — `/// The editing session's backups — step 13 — or 'None' for a save …` |
| 84 | 210 | `src/lib/browser/reapply.ts:781` | resolves — the doc comment of `correspondenceRowFor` (full-identity rule, 782-800) |
| 85 | 222 | `CLAUDE.md:48` | resolves — `**'crates/espansoconfig-core' must never depend on 'tauri'**, direc…` |
| 86 | 224 | `IMPLEMENTATION_PLAN.md:847` | resolves — `- **Purely cosmetic.** Deleting the sidecar loses display names and…` |
| 87 | 228 | `crates/espansoconfig-core/src/model/document.rs:106` | resolves with a note — offset 2: the `WirePath` field and its display-only doc are 108-111 |
| 88 | 228 | `src-tauri/src/commands.rs:3176` | resolves — `/// - 'document' — **the app's opaque identity**, not a wire path. A` |
| 89 | 230 | `IMPLEMENTATION_PLAN.md:849` | resolves — `- **Keyed by path relative to the config dir**, so the whole worksp…` |
| 90 | 239 | `CLAUDE.md:141` | resolves — `- Where TypeScript or Rust cannot force something, the comment that…` |
| 91 | 241 | `IMPLEMENTATION_PLAN.md:853` | resolves — `- The real filename is always visible — as a subtitle in the sideba…` |
| 92 | 243 | `IMPLEMENTATION_PLAN.md:839` | resolves — `"newSnippetDefaults": { "word": true, "forceMode": "clipboard" }` |
| 93 | 243 | `crates/espansoconfig-core/src/draft/new_match.rs:55` | resolves — `/// # The three word-boundary fields are text, not booleans` |
| 94 | 243 | `crates/espansoconfig-core/src/draft/new_match.rs:63` | resolves — `/// # It carries decoded text, never YAML` |
| 95 | 247 | `IMPLEMENTATION_PLAN.md:850` | resolves — `- **Rename handling:** when the app renames a file it moves the sid…` |
| 96 | 255 | `IMPLEMENTATION_PLAN.md:116` | resolves — `\| 'replace' \| string \| plain text; supports '{{vars}}' and '$\|$…` |
| 97 | 255 | `IMPLEMENTATION_PLAN.md:132` | resolves — `**Cursor hint:** '$\|$' inside 'replace' positions the caret after …` |
| 98 | 259 | `IMPLEMENTATION_PLAN.md:1124` | resolves — `All nine variable types · the '+ Insert' popovers · variable chips …` |
| 99 | 287 | `src-tauri/src/dictionary_contract.rs:10` | resolves — `//! It is compiled only for tests. It **parses** the enum declarati…` |
| 100 | 287 | `src/lib/i18n/codes.ts:60` | resolves — `* ## Frontend-state accessors, since Phase 2d-6-1a` |
| 101 | 289 | `PROGRESS.md:128` | resolves — `\| R31 \| **The hardcoded-string check sees markup only.** It scans…` |
| 102 | 291 | `docs/decisions/2d-7-10-notes.md:200` | resolves — `## 3. The ES sentence inventory (entry 25; R35's input)` |
| 103 | 291 | `docs/decisions/2d-7-10-notes.md:223` | resolves — `- 145 lines. Every key resolves in 'es.json'. E13's key is printed …` |
| 104 | 293 | `PROGRESS.md:131` | resolves — `\| R35 \| **Nothing establishes that a Spanish string is Spanish.**…` |
| 105 | 293 | `PROGRESS.md:153` | resolves — `**Owed by the owner, not by a driven run:** plan §12's Phase 2 exit…` |
| 106 | 311 | `docs/decisions/2d-8-notes.md:30` | resolves — the hook lines removed by editing (the instrument's deletion record) |
| 107 | 311 | `CLAUDE.md:230` | resolves — `- A WKWebView whose window is occluded stops running 'setTimeout' a…` |
| 108 | 317 | `CLAUDE.md:202` | resolves — `- Only the files that opt into jsdom by docblock mount a component;…` |
| 109 | 319 | `PROGRESS.md:135` | resolves — `\| R38 \| **Every window reading this project has taken ran on one …` |
| 110 | 319 | `docs/decisions/2d-7-10-notes.md:566` | resolves — `\| CF-50 \| R38's residue: the fifteen shapes read only in the view…` |
| 111 | 334 | `docs/decisions/2d-7-10-notes.md:552` | resolves — `\| CF-55 \| H9 (read by a model's look only) raw *Undo* pressed und…` |
| 112 | 334 | `docs/decisions/2d-7-10-notes.md:568` | resolves — `\| CF-52 \| **The C1 fold**: the delete panel's choice row below th…` |
| 113 | 334 | `docs/decisions/2d-7-10-notes.md:611` | resolves — `4. **Raw *Undo* drawn enabled under a held save; *Stop editing* dra…` |
| 114 | 334 | `docs/decisions/2d-6-split-notes.md:932` | resolves — `\| 1 \| stale cross-file citations in comments; a checker \| **Defe…` |
| 115 | 334 | `docs/decisions/2d-6-split-notes.md:941` | resolves — `\| 10 \| no window-close path runs 'dispose()' \| **Deferred**, no …` |
| 116 | 336 | `docs/decisions/2d-7-10-notes.md:496` | resolves — `**Destination.** Entry 33 records every row here as **permanently u…` |
| 117 | 336 | `docs/decisions/2d-7-10-notes.md:567` | resolves — `\| CF-51 \| **R35**: no native-speaker review of any Spanish string…` |
| 118 | 345 | `docs/decisions/2d-7-10-notes.md:517` | resolves with a note — one row (CF-12) of the §5.2 table (508-552) the sentence describes |
| 119 | 351 | `src/lib/browser/recovery.ts:829` | resolves — `export function newMatchOfRecovery(` |
| 120 | 353 | `src/lib/browser/matchEditor.ts:1133` | resolves — `export function fieldIntent(baseline: FieldBaseline, buffer: FieldB…` |
| 121 | 363 | `src/lib/browser/matchEditor.ts:2474` | resolves — the doc comment of `fieldReapply` (the Q4 table); "any one of them blocks the whole reapply" is at 2535-2536 |
| 122 | 363 | `src/lib/browser/matchEditor.ts:2533` | resolves — `* The drafted fields the new projection does not hold in the state …` |
| 123 | 365 | `crates/espansoconfig-core/src/draft/new_match.rs:21` | resolves — `/// **Phase 2c-4c-1 widened it from two to six**, and the four it a…` |
| 124 | 369 | `PROGRESS.md:134` | resolves — `\| R36 \| **There is no relation that can follow an open draft to t…` |
| 125 | 371 | `PROGRESS.md:137` | resolves — `\| R37 \| **A model rule that reads the live projection agrees with…` |
| 126 | 371 | `CLAUDE.md:211` | resolves with a note — the two-counter selection rule (same synchronous block); R37's one-read requirement itself is `PROGRESS.md:137` |
| 127 | 373 | `CLAUDE.md:208` | resolves — `- 'conflictChoicesFor' is the only producer of a conflict choice li…` |
| 128 | 373 | `src/lib/browser/reapply.ts:688` | resolves — `const tableBase = carried.base_revision;` |
| 129 | 373 | `src/lib/browser/reapply.ts:819` | resolves — `export function correspondenceRowFor(` |
| 130 | 383 | `crates/espansoconfig-core/tests/corpus/synthetic/run-based-removal-envelope.yml:3` | resolves with a note — `matches:`; the run-set shape (a kept file-owned comment inside an item) is at 4-12 |
| 131 | 383 | `crates/espansoconfig-core/tests/corpus/synthetic/flow-collections.yml:16` | resolves — `# Flow collection spanning several lines, with a comment inside it.` |
| 132 | 385 | `crates/espansoconfig-core/src/model/scalar.rs:3` | resolves — `//! # D2u — source text, never an inferred type` |
| 133 | 391 | `CLAUDE.md:242` | resolves — `The autoclaude workflow owns the review policy and this file adds n…` |

---

## 7. The open-items map

**The carried-forward list** (`2d-7-10-notes.md` §5, CF-1 … CF-55), each group placed:

| Rows | What | Phase 3 placement |
|---|---|---|
| CF-1 … CF-6 | The instrument's pathname rebindings | None. They ended with the instrument at 2d-8 and are not closed by proof (§4.5) |
| CF-7 … CF-11, CF-19 … CF-23, CF-26, CF-31 … CF-38, CF-41 … CF-46 | Unread rows of the deleted instrument's plans | No phase named; unchanged |
| CF-12, CF-14 … CF-18, CF-39, CF-40 | Recovery and authored-text conflict rows | Subject changed by 3-5 / 3-6 (wider recovery); not closed unless the exact missing observation is supplied (ruling 33) |
| CF-13, CF-24, CF-25 | Held-save and acknowledgement rows | Subject changed by 3-5, 3-6, 3-8, 3-11; same bound |
| CF-27 … CF-30 | Projection-replacement and surface-note rows | Subject changed by 3-11's selection invalidation; same bound |
| CF-47 … CF-49 | Constructed readings | None; never credited as reached |
| CF-50 | R38's residue | Touched by 3-5, 3-6, 3-8, 3-11 (ruling 31); not closed |
| CF-51 | R35, native-speaker review | The owner, before Phase 5; Phase 3 adds its own translation-review inventory (ruling 29) |
| **CF-52** | The C1 fold on the delete panel (entry 26) | **3-14, after the owner's ruling** (§4.4) |
| **CF-53** | Close/keep labels (entry 26) | **The owner; labels kept** ("Clear enough" stands) |
| **CF-54** | The delete panel's overlapping opening paragraphs (entry 26) | **3-14, after the owner's ruling** (§4.4) |
| **CF-55** | Raw *Undo* enabled while `saving`; *Stop editing* drawn dark | **3-8** (ruling 13; §4.2) |

**The entry-26 wording rulings** are CF-52, CF-53 and CF-54 above. They are the only three, and their
homes are 3-14 (two, owner-first) and the owner (one).

**`2d-6-split-notes.md` §7:**

| Item | What | Placement |
|---|---|---|
| 1 | The `file:line` drift checker for cross-file comment citations | **No phase** (ruling 32). Phase 3 records correct their own citations by hand, and no step claims automated drift prevention |
| 10 | No window-close path runs `dispose()` | **No phase** (ruling 32). Phase 3 does not change the close path |

**Owner obligations outside the split:** plan §12's Phase 2 exit (a week of real use with zero data
loss) is still unrun and blocks nothing here. R35 (CF-51) is the owner's before Phase 5.

---

## 8. What this record could not establish

1. **No gate was run**, so nothing here is evidence that any proposed mechanism compiles or preserves
   bytes. 3-1 … 3-3 are where that is first tested.
2. **The citation audit shows that the consult read what it cites.** It does not validate the design.
   In particular, nothing here tests the consult's claim that sequence verification must translate
   original positions to result positions (`edit.rs:4320`, `:7248`). That is 3-2's to establish.
3. **Nothing here is about espanso's runtime.** The `$|$`-in-`replace`-only rule (ruling 18) rests on
   plan §3 (`IMPLEMENTATION_PLAN.md:116`, `:132`), which R30 says is unverified against espanso.
4. **The window halves are obligations, not readings.** No step's window half has been taken.
