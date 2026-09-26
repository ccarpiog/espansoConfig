# Phase 4 — the design consult, and the twenty-four-step split it rules

**Status:** the record of a design decision, taken before any line of Phase 4 exists. It changes no
source file and no other document. [`docs/reviews/phase-4-design.md`](../reviews/phase-4-design.md) is
the consult itself and is the authority for *what* Phase 4 builds, except where §4 below corrects or
narrows it. This file restates it as binding rulings, the step plan, the plan sentences it overrides,
the citation audit and the open-items map. Its shape is [`3-split-notes.md`](3-split-notes.md)'s.

---

## 1. What the consult was, and what it does not cover

- **Provider:** **Codex**, job `task-mui8fw1w-ga5pke`, `--effort high`, default model, created
  2026-09-26 10:14:09 UTC and completed 10:25:54 UTC (about 11 minutes 45 seconds). There was one
  consult; it was not cancelled or re-dispatched, and the fallback agent was not used.
- **The wait.** `codex-wait.sh task-mui8fw1w-ga5pke 540 300 20` (foreground) exited **3** on its first
  window: the job's `updatedAt` froze at 10:15:43 while its log kept advancing — the false stall
  `codex-dispatch-procedure.md` records. A bounded replica polling `.job.status` and the log's mtime
  exited 3 again after 308 s of log silence; the log's last line was the consultant saying it was drafting
  its final rulings, with no repeated `Searching:` line, so the job was judged healthy and not cancelled.
  A third bounded wait (log-stall threshold 1200 s) saw `completed`.
- **The brief** is [`4-design-brief.md`](4-design-brief.md): thirteen questions, Q1–Q13, with its own
  coverage bounds in §8. It takes no position on any question it asks.
- **The reply** is `phase-4-design.md`. Lines 1-24 are this project's provenance header and the reply
  starts at line 26 (`## VERDICT`). Q1–Q13 are under `###` headings (32-424), each opening with a
  **Ruling:** line, and `### The step cut` is at 425-502. The only edit made to the reply is the dropped
  two-line Codex session trailer.
- **What the consult ran:** no gate and no launch, as the brief required. It read committed synthetic
  fixtures (`variable-chain.yml`, `form-layout-and-choice.yml`) and did not open the real corpus.

**What the consult said, in five lines.** Fix A1 first (4-1), on both paths, with one emission contract:
eight options written as validated plain source, `anchor` a string. Reproduce B1 (the 3-6-3 item) on its
own (4-2). Lift D1 through **narrowly typed** nested operations — a closed `NewVariable`, typed list,
choice-record and form-definition edits, no caller YAML, no recursive value writer — before any control
promises them (4-3 … 4-8). Put forms and `choice` first among the surfaces (4-11, 4-12), keep layout text
authoritative for placeholders but never let a layout edit create or delete a field definition, keep
shorthand and verbose apart. Preview is a pure, bounded Rust *illustration* with injected clock and zone
that never executes `shell`/`script` or reads the clipboard; the regex bench is a stateless read-only
command that states the 1.13.1-versus-1.5.5 asymmetry. R25 stands (a variable reorder saves alone).
Twenty-four steps, four of them window halves.

**What this record ran:** `rg`, `sed`, `wc`, `ls` and one Python script that printed each cited line of
the consult. **It ran no gate, no `cargo`, no `npm` and no launch, and it opened no real-config file.**
Every count here was read with those tools on 2026-09-26; none is a compiled figure. The rung stands at
`1555 / 487 / 4074 / 214` (Phase 3 closure) and this phase did not move it.

Four bounds, stated because each could be assumed:

1. **A design consult is not a review round.** Nothing here is a finding with a severity.
2. **No claim here is about what a window draws, or what espanso does at runtime.** R16 and R30 stay open.
   How espanso reads a quoted `'true'`, its form-placeholder grammar and how it scans a regex trigger are
   not established by anything in this record.
3. **Re-deriving a citation is not validating a design.** Only 4-1 and 4-3 … 4-8, run against the
   compiler and the corpus, can test the engine mechanisms the consult proposes.
4. **The tree read was `main` at `e6bbce0`**, clean apart from the modified `PROGRESS.json` and this
   phase's three untracked records.

---

## 2. The twenty-four-step plan

The consult's step cut (`phase-4-design.md:425-502`) is kept **at twenty-four steps, in its order and
with its numbering**. Each step restates the consult's version and adds the narrowings of §4. Each step is
**one autoclaude phase** with one worker and **one adversarial review** (`CLAUDE.md` §7).

Every implementation step owes the machine-checkable gate set of `CLAUDE.md` §4, Rust serially, records its
rung against `1555 / 487 / 4074 / 214`, and explains any module-count change (a new `.ts` module costs
one, a new styled component two; the consult names five new browser modules — `variableEditor.ts`,
`formEditor.ts`, `variableInsertion.ts`, `preview.ts`, `regexBench.ts`). Every step that adds or changes a
wire code also updates, in the same step, its IPC mirror (`src/lib/ipc/`),
`src-tauri/src/{wire_contract,dictionary_contract}.rs`, both dictionaries, the `codes.ts` accessor with its
reactive wrapper in `src/lib/i18n/index.ts`, and their tests (`phase-4-design.md:427`). A defect fix shows
a regression test failing first on the unchanged tree.

Terms, as in `3-split-notes.md` §2: **risk class** is `high` or `routine`; **driven** means an unattended
`autoclaude-until-done` iteration can run the step to closure with the screen possibly locked; a **window
half** is a step that needs a visible, unlocked window and so is **set aside by a driven run** (§3 ruling
29; `3-split-notes.md` §4.8).

**Cutting a step.** An orchestrator that judges a step too large before starting it may cut it into
numeric-suffixed pieces (`4-4-1`, `4-4-2`), never lettered ones, recorded as a dated addendum under the
step. A step is never cut after its review to hold a fix. A capability found missing may justify a new
numeric step **before an unstarted consumer** (ruling 30).

### 4-1 — A1 across creation and single-match editing

**Delivers** one emission contract for match options on both writing paths that do not use it today:
*Create* (`NewMatch::entries`, `crates/espansoconfig-core/src/draft/new_match.rs:280-323`, options table at
`:306`) and the single-match editor (`plan_scalar`, `draft/plan.rs:1500`, which builds `ScalarEdit::new`).
**Eight options** — `word`, `left_word`, `right_word`, `propagate_case`, `uppercase_style`, `force_mode`,
`force_clipboard`, `paragraph` — are written **verbatim as plain source** (`ScalarEdit::plain_source`,
`EntryValue::PlainSource`), with text that fails `is_plain_source` (`draft/bulk.rs:301`) refused before any
transaction. `anchor` stays a logical string spelled by the codec. `Unchanged` preserves existing bytes,
including `'true'`; an explicit `Set("true")` rewrites a quoted spelling to plain `true`, as bulk does
(`bulk.rs:602`). The ambiguity exemption is widened **only** to the exact candidate value nodes of
explicitly requested `PlainSource` entries in inserted items (today `plain_source_nodes`,
`patch/edit.rs:9256`, covers scalar edits and field-insert groups only, while `render_item` writes a new
item's `PlainSource` verbatim at `:7607-7612`). The `NewMatch` doc comments at `new_match.rs:175-183` and
`:185-190` are rewritten to state the split (eight validated plain-source options; trigger, content,
metadata and `anchor` are logical strings).

**Touches** core `draft/{new_match,plan,bulk,error}.rs`, `patch/edit.rs`, their tests; the command adapters,
IPC mirrors and contracts for any new refusal code; creation and editor request tests. No sidecar format
change (`src-tauri/src/sidecar.rs:181` already stores text).

**Acceptance:**
- Failing first on the unchanged tree: *Create* with a seeded `word` default of text `true` writes
  `word: 'true'`; after the fix it writes `word: true`. The same for the single-match editor setting an
  absent option and rewriting an existing one.
- An untouched existing `'true'` survives byte-identically; typing and undoing back to the baseline stays
  `Unchanged`.
- Text that is not plain source (empty, a line break, a quote, `#`, a flow indicator, an alias, a tag) is
  refused by name, before writing, on both paths.
- **The exemption is exactly as wide as the requested entries:** a candidate in which a neighbouring
  ordinary string value is corrupted into an ambiguous plain scalar while the intended option is correct is
  rejected (`AmbiguousPlainScalarIntroduced`, `edit.rs:3007`); the same text in a key, a sibling item and a
  scalar-list element receives no exemption; several inserted items and index shifts are covered.
- Sidecar bytes and schema unchanged; an empty or otherwise inadmissible stored default stays visible and
  removable in the creator and is refused at *Create* with a named reason rather than coerced (§4.3).
- `cargo tree -p espansoconfig-core | rg tauri` is empty.

**Risk `high`. Driven:** yes. Core-first repair; no new editing surface, so no window half of its own (an
optional visible confirmation rides in 4-13). **Depends on** nothing.

### 4-2 — B1 reproduction and bounded repair

**Delivers** a reproduction of `3-6-3-notes.md` §4 item 1 (a draft holding a list-item addition never drew
the external-change panel) that distinguishes **missing delivery, missing model state and missing
rendering**, and a repair of only the reproduced cause. If no test reproduces it, the candidate is kept
open by name, not marked fixed.

**Touches** `src/lib/browser/{matchEditor,workspace.svelte,reapply}.ts` and the reconciliation modules, the
implicated existing component, and the backend only if the failing trace reaches it.

**Acceptance:** a failing-first case with an added item in `triggers` and in `search_terms`, under external
removal and external change; the draft is retained and the mounted conflict panel draws. **Mounted evidence
is recorded as mounted evidence** (ruling 29).

**Risk `high`. Driven:** yes; its visible counterpart is owed to 4-13. **Depends on** 4-1 by order only
(§4.4).

### 4-3 — Nested presence and author-key foundation

**Delivers** presence and location metadata (absent / empty / supported / unsupported shape) for `vars`,
`params`, `depends_on`, shorthand `form_fields`, verbose `params.fields` and editable nested lists — today
`depends_on`'s presence is computed and discarded (`model/variable.rs:179-194`) and `vars` is only a vector
(`model/match_view.rs:429`). Bounded insertion and removal of an **author-named** scalar or scalar-list
mapping entry (a `params` entry), lifting D1 (`draft/match_draft.rs:29-33`) under the key rules of ruling 7.

**Touches** core `model/{variable,match_view,value}.rs`, `draft/{match_draft,plan,audit,error}.rs`, patch
helpers, projection mirrors in `src/lib/ipc/types.ts`.

**Acceptance:** the four presence states differ on synthetic fixtures; Unicode and punctuation keys
round-trip; a duplicate key refuses, including an equivalently quoted spelling and a pending insertion;
`<<`, an empty key, CR/LF and a one-level-too-deep path refuse; every refusal carries positions and codes,
never the key text; the audit's closed surface (`draft/audit.rs:75-124`) is widened by named shapes only,
and a test one segment deeper than the new surface is refused.

**Risk `high`. Driven:** yes. Core-first, no production UI caller. **Depends on** 4-1.

### 4-4 — Local variable insertion, deletion and movement

**Delivers** a closed `NewVariable` description (common textual fields plus nine kind-specific parameter
variants, with a bounded list of extra author-named scalar/list parameters), insertion into an existing
`vars` and of a whole `vars:` subtree when absent, item removal, and a same-sequence reorder that is **alone
in its batch** (R25). Choice records and form definitions follow in 4-5 and 4-6.

**Touches** new core variable-draft types, planner and audit, patch renderers, expectations and verifiers
(the existing `verify_entry_value`, `patch/edit.rs:9460`, handles scalar, plain-source and scalar-list
values only, so new shapes need their own expectations).

**Acceptance:** all nine kinds have bounded constructors; a new variable plus a content edit applies in one
batch; item-owned and file-owned comments obey the ownership rules; removing the final item leaves an
explicit empty list or goes through an explicit container removal, never an unnoticed null; a reorder
succeeds alone and is refused beside every other edit category (`MoveMustBeTheOnlyEditInItsBatch`).

**Risk `high`. Driven:** yes. Core-first. **Depends on** 4-3.

### 4-5 — Variable lists and labelled choices

**Delivers** item edits, insertion and removal in `depends_on`, `random.choices`, `script.args`, `choice`
string lists and `{label, id}` records (including edits of existing records).

**Acceptance:** first, middle and last additions and removals; empty lists; changed survivors; several
insertions at one boundary; string and record shapes stay distinct; an existing flow list stays flow or is
refused by type (Phase 3 ruling 5); a flow list holding a comment keeps its `CommentInFlowCollection`
refusal (C2) and a test pins that; unknown entries inside a record survive.

**Risk `high`. Driven:** yes. Core-first. **Depends on** 4-4.

### 4-6 — Form-definition structural core

**Delivers** insertion and removal of field definitions and their scalar/list options in shorthand
`form_fields` and verbose `params.fields`, and complete new verbose form descriptions.

**Acceptance:** one intention writes shorthand or verbose shape, never converting; a layout edit plus a
field addition is one batch; deleting a definition touches only its owned span; a scalar-list `values` and a
multiline-string `values` (both in `form-layout-and-choice.yml:43-54`) keep their representation;
unsupported subtrees refuse structured rewriting.

**Risk `high`. Driven:** yes. Core-first. **Depends on** 4-3, 4-5.

### 4-7 — Placeholder, reference and dependency analysis

**Delivers** a core parser for a **named supported placeholder subset** (`[[identifier]]`, identifier
`[A-Za-z_][A-Za-z0-9_]*`) that keeps every character and reports malformed regions; a shared reference
scanner reusing `REFERENCE_PATTERN` (`validate/mod.rs:167`) exactly; a dependency graph (explicit
`depends_on` edges and inferred parameter-value edges when injection is certainly enabled, kept
distinguishable); usage counts; form sub-reference advisories; incomplete-analysis reasons; and two new
**`SuspiciousButPermitted`** findings, `VariableDependencyCycle` and `DependencyHasNoDeclaration`, produced
only for a variable operation that introduces or worsens the condition and bound to the candidate revision.

**Acceptance:** repeated and malformed placeholders; `{{f.field}}` sub-references; explicit and inferred
cycles; regex captures; duplicate names; `inject_vars` spellings; imports keep the scope open (no false
closed-scope claim); an unrelated save acquires no new acknowledgement; consent for one candidate cannot be
spent on changed text. Shorthand `form:` stays out of `rendered_content` (`validate/mod.rs:1076-1093`).

**Risk `high`. Driven:** yes. Core-first. **Depends on** 4-3.

### 4-8 — Revision-bound snapshots and command integration

**Delivers** Rust-cut authoring snapshots, candidate analysis on the wire, the widened `save_match`
(`src-tauri/src/commands.rs:3691`), and a variable-reorder writer that ends in `run_one_save`
(`commands.rs:2033`).

**Acceptance:** stale identities and revisions refuse (D2v); a submitted span is never trusted (R28); every
writer reaches `run_one_save` and none takes a second lock; an atomic content-plus-variable save, an
acknowledgement round trip, a no-op and an uncertain outcome are tested on temporary synthetic files.

**Risk `high`. Driven:** yes; no visible caller yet. **Depends on** 4-4, 4-5, 4-6, 4-7.

### 4-9 — Shared variable editor lifecycle

**Delivers** `variableEditor.ts` and the insertion module: variable baseline and buffers, history, the
compound *Insert* action (caret text plus new variable plus the shared name, one undo step), whole-container
reapply, retention, compare and copy, and the explicit recovery refusal of ruling 21.

**Touches** new browser modules; `matchEditor.ts` at its single composition point (`draftWith`, which today
sends `vars: []` and `form_fields: []`, `matchEditor.ts:1866-1897`), `reapply.ts`, `recovery.ts`,
`workspace.svelte.ts` (kept thin).

**Acceptance:** every drafted scalar and structural action survives both conflict origins; an unchanged
container baseline reapplies; a shifted or changed list collides; a completely present intended result is
satisfied; recovery never creates a snippet whose references lost their definitions; R36's conservative
rule and R37's single read are exercised through callers (TypeScript cannot force R37, and the comment that
states it says so). B1's regression coverage is extended to variable lists.

**Risk `high`. Driven:** yes. Model over completed core. **Depends on** 4-2, 4-8.

### 4-10 — Form editor model

**Delivers** `formEditor.ts`: one form model with shorthand and verbose adapters, the explicit *Add field*
compound action, and definition-only rows. The shorthand layout keeps the existing `form` content buffer —
no second textarea draft of one scalar.

**Acceptance:** a layout edit creates or deletes no definition; *Add field* changes both parts and undo
restores both; repeated placeholders share one row; an absent field left blank is `'Unchanged'`; a layout
holding `\r` is refused at load, edit and send (and a CRLF file's untouched bytes are checked separately);
every new value has a lifecycle disposition.

**Risk `high`. Driven:** yes. **Depends on** 4-9.

### 4-11 — Variable group, chips and choice controls

**Delivers** the *Variables and fill-ins* group inside the match editor: the ordered list with dependency
state and "analysis incomplete", chips under content, add/remove/reorder controls, and **Choice**
insertion.

**Acceptance (mounted, recorded as mounted):** controls are not mounted until selected; every declaration
stays reachable; a provisional name is labelled as "available among visible names" under an open scope;
the compound insertion reaches one save; reorder cannot bypass the pending-draft rule or R25; conflict and
recovery states draw.

**Risk `high`. Driven:** yes; **window half owed to 4-13.** **Depends on** 4-9.

### 4-12 — Visual form builder

**Delivers** the synchronized layout display with derived rows, first-class **Choice/List** field controls,
explicit field operations and **Form** insertion, for both storage shapes.

**Acceptance (mounted):** both shapes; layout-only edits; explicit compound additions; definition-only rows;
unknown source visible through `SourceText`; `multiline`, defaults and trimming as textual controls; conflict
compare; the recovery refusal.

**Risk `high`. Driven:** yes; **window half owed to 4-13.** **Depends on** 4-10, 4-11.

### 4-13 — Early authoring window half

**Delivers** EN and ES readings of A1's outcomes, B1's conflict display, the variable and choice controls and
both form representations; **B5** (the disk-version box does not wrap a long line) reproduced by a failing
visible overflow measurement, and corrected only if demonstrated.

**Acceptance:** visible unlocked captures with the language set through the picker; a block-scalar `layout`
under conflict, item-owned comments, a CR refusal, and a CRLF file whose untouched bytes are compared — each
a deliberate R38 touch, named by screen and action; the exact unread rows listed. Any instrument is minimal,
uncommitted and inside the step's single review.

**Risk `high`. Needs a visible window**; the owner only for real input and wording or layout judgements.
**Driven runs set it aside** (ruling 29). **Depends on** 4-11, 4-12.

### 4-14 — Remaining variable-kind authoring models

**Delivers** browser submodels for Date, Random, Echo, Clipboard, Shell, Script and Match: closed wire
shapes, required-parameter readiness (`required_param`, `validate/mod.rs:699-712`; `date.format` is **not**
required), warning values.

**Acceptance:** each kind produces its closed shape, keeps unfamiliar text, handles `\r`, and takes part in
undo, conflict and recovery; no execution and no clipboard-read path is introduced (a test asserts that no
command in the tree reads the clipboard or spawns a process for a variable).

**Risk `high`. Driven:** yes. **Depends on** 4-9, 4-10.

### 4-15 — Remaining popovers

**Delivers** the remaining `+ Insert` rows (Date/time, Random choice, Clipboard, Shell command, Script,
Another match), and Echo through *Add variable* (no eleventh row).

**Acceptance (mounted):** caret and selection insertion, cancellation, name collisions, required values,
retained drafts, textual command and argument display with the sentence that espanso may run the command
when the snippet expands and this application does not; no *Run test* and no clipboard-read control;
unsupported preview states are honest.

**Risk `high`. Driven:** yes; **window half owed to 4-16.** **Depends on** 4-11, 4-14.

### 4-16 — Remaining authoring window half

EN and ES readings of every remaining kind and row: a multi-line command draft (not executed), script
argument boundaries, the clipboard placeholder, open-scope naming, a held save and conflict retention. Real
typing, caret and paste acceptance are attributed to the owner separately. **Risk `high`. Needs a visible
window; driven runs set it aside.** **Depends on** 4-15.

### 4-17 — Pure illustrative preview core

**Delivers** a pure, bounded Rust preview in the core: substitution through `REFERENCE_PATTERN`, echo,
selected choice and random examples, form samples, placeholders for clipboard, shell, script and match,
bounded topological evaluation with structured unresolved segments, and a read-only command.

**Acceptance:** identical requests give identical output; cycles and missing samples terminate with codes;
reference-token cases agree with 4-7's analysis; output and depth limits hold; command and clipboard
examples cause no I/O; hostile HTML comes back as data.

**Risk `high`. Driven:** yes. Core-first. **Depends on** 4-7.

### 4-18 — Date preview

**Delivers** pinned `chrono` (and, for named IANA zones, a bounded time-zone crate) in the **core**, with
features that avoid implicit current-time or local-zone reads; instant and zone come in the request.

**Acceptance:** fixed instants around day boundaries and DST changes, explicit zones, malformed formats and
offsets, overflow, `LocaleUnsupported`; no test reads the clock; `cargo tree -p espansoconfig-core | rg
tauri` still empty; the new crates' versions recorded.

**Risk `high`. Driven:** yes. Core-first. **Depends on** 4-17.

### 4-19 — Preview controls and popover samples

**Delivers** `preview.ts` and the preview components: sample inputs, the sample instant and zone drawn
beside the result, illustrative output, limitation states. **Acceptance (mounted):** superseded responses
cannot overwrite current ones; preview changes no draft and no file; unresolved values stay identifiable;
HTML is escaped; no execution or clipboard-read control. **Risk `high`. Driven:** yes; **window half owed
to 4-20.** **Depends on** 4-12, 4-15, 4-17, 4-18.

### 4-20 — Preview window half

EN and ES readings of supported examples and uncertainty: sample instant and zone, choice label versus id,
form samples, unresolved chains, long output, command placeholders. The owner judges whether the wording
over-promises. **Risk `routine`. Needs a visible window; driven runs set it aside.** **Depends on** 4-19.

### 4-21 — Regex bench core and read-only wire

**Delivers** a core first-match search over a sample, named captures (including unmatched optional ones),
and a stateless command `test_regex({ request_id, pattern, sample })` with no document, identity, lock or
file I/O; limits 8 KiB pattern, 64 KiB sample, 128 named groups, 1 MiB compiled size, 1 MiB DFA cache,
128 KiB response; typed `PatternTooLarge`, `SampleTooLarge`, `CaptureLimit`, `CompileRejected`,
`OutputLimit`. The response names the engine (`regex` 1.13.1, `Cargo.lock:2536-2537`).

**Acceptance:** compile / no match / match; optional captures; Unicode; zero-width matches; each limit at and
past its boundary; result text cut in Rust; pattern and sample never logged.

**Risk `high`. Driven:** yes. Core-first. **Depends on** nothing beyond today's `regex` substrate (it may
run earlier if a driven run is otherwise blocked; §4.4).

### 4-22 — Regex bench UI and capture insertion

**Delivers** `regexBench.ts`, the bench component, the *Regex capture* `+ Insert` row (shown only for a
current, compiling regex trigger; inserts `{{name}}` and creates no variable), and replacement wording for
D11 **to be presented to the owner**, not adopted by the step. **Acceptance (mounted):** out-of-order
replies ignored; captures from the current pattern; the compatibility sentence drawn in EN and ES. **Risk
`routine`. Driven:** yes; **window half owed to 4-23.** **Depends on** 4-11, 4-21.

### 4-23 — Regex window half

EN and ES readings: compile failure distinct from no match, optional captures and Unicode, insertion at the
intended caret, the engine-version sentence readable; D11 gets an explicit owner disposition or stays owed.
**Risk `routine`. Needs a visible window and, for D11, the owner; driven runs set it aside.** **Depends on**
4-22.

### 4-24 — Inventory, reconciliation and closure record

**Delivers** the Phase 4 translation-review inventory (key, EN, ES, step, producer) produced by an
**in-repository** reproducible procedure (answering E4), the corrected carried records (E1, E2, E3, E5, E6),
actual gate and module accounting, and the list of window halves with each one's state. Records only.

**Acceptance:** every new code has both strings and a typed producer; every carried item of §7 has a
disposition; gate counts come from runs; R16, R25, R29, R30, R35, R36, R37 and R38 are not closed by
assertion; no instrument is committed. **It does not edit `PROGRESS.md`, `PROGRESS.json`,
`IMPLEMENTATION_PLAN.md` or `CLAUDE.md`** (§4.5).

**Risk `routine`. Driven:** yes. It may run with window halves owed and lists them as owed; it closes Phase
4 **only** if none is owed (§4.6). **Depends on** every implementation step.

---

## 3. The binding rulings

Each entry names the consult question it comes from. Where §4 narrows an entry, the entry says so.

**A1 and candidate defects (Q1)**

1. **A1 is fixed first, in 4-1, on both paths together**, before any Phase 4 feature. It is a defect
   against the project's source-text option contract; its mechanism is established by reading and its
   regression tests must still fail first.
2. **Eight options are validated plain source; `anchor` is a logical string.** All nine keep textual
   controls (Phase 3 ruling 10; D2u). Emission policy authorizes no type inference and no checkbox.
3. **The ambiguity exemption is exactly as wide as the requested plain-source entries** of inserted items:
   no item, subtree, key name or spelling is exempted globally, and a negative test proves a corrupted
   neighbour is still refused.
4. **Known non-string settings below the match mapping** — `inject_vars`, `offset`, `trim`, `debug`,
   `multiline`, `trim_string_values` — get explicit plain-source policies in the step that first writes
   them (4-4 … 4-6), with textual controls. Otherwise Phase 4 would reproduce A1 one level down. Strings
   (names, list items, choice labels and ids, layouts, commands) use the codec.
5. **B1 is reproduced in 4-2 before any variable conflict path relies on it.** B5 is reproduced in 4-13.
   B2 … B4 and B6 are not Phase 4's (§7).

**The core surface (Q2)**

6. **D1 is lifted by typed operations only.** `EntryValue` stays non-recursive; no operation accepts
   caller-written YAML (Phase 3 ruling 4 stands); new nested shapes carry their own expectations and
   verifiers and do not inherit a guarantee by reaching `verify_entry_value`.
7. **Author-chosen keys** are decoded text spelled by `choose_scalar` in key context; empty keys, CR/LF,
   unsupported control characters and `<<` are refused; duplicates are refused against decoded keys and
   pending insertions; existing targets stay positional; **refusals carry positions and codes, never the
   key text** (`CLAUDE.md` §1).
8. **Existing collection style is preserved**; a new non-empty collection is block style; an explicit empty
   one is `[]` or `{}`; a container is removed only by an explicit container-removal intent; flow-mapping
   structural edits stay named refusals (Phase 3 ruling 5 carried).
9. **`global_vars` is display-only** in Phase 4 and takes part in analysis.
10. **R25 and D2r stand.** A variable reorder is a same-sequence `ItemMove`, alone in its save, through a
    dedicated writer that ends in `run_one_save`. R25's untested move-versus-edit overlap stays open.

**Ordering and diagnostics (Q3, Q8)**

11. **Authored order is preserved and never auto-sorted.** A move that puts a consumer before a known
    dependency gets an advisory naming both declarations and stays available; file order is not claimed to
    be espanso's complete execution order.
12. **New dependency findings are `SuspiciousButPermitted`**, produced only by a variable operation that
    introduces or worsens the condition, and bound to the candidate revision (the 2c-3c precedent,
    `validate/mod.rs:72-102`). **No new blocking class, and no new `EditorModelError`.** Rule 5 keeps its
    behaviour; new analysis never turns an open scope into a closed one.
13. **"Orphaned" means "no visible reference found"**, never "has no effect": espanso evaluates every local
    variable (`validate/mod.rs:694-697`). Orphans are advisories and are never deleted.
14. A finding may carry a file-supplied name as today; nothing copies owner text into logs, fixtures,
    records or refusals.

**Forms (Q4)**

15. **Layout text is authoritative for placeholder occurrences; field definitions are independently
    authored.** A layout edit **never** inserts, deletes or renames a definition; *Add field* is explicit and
    compound; removing or renaming a field is explicit with a preview; a definition whose last occurrence
    is deleted stays visible with an advisory (§5 row 1). Phase 3 ruling 9's second half carries.
16. **The placeholder parser is a named supported subset**, never called espanso-compatible.
17. **One form model, two write adapters; no conversion between shorthand and verbose.** The shorthand
    layout reuses the existing `form` content buffer.
18. **Choice and List are the first-class field cases.** Scalar-list and multiline-string `values` keep
    their representation.
19. Unknown or advanced form content is **always visible**, structurally editable only where the projection
    and typed operations support it, otherwise shown through Rust-cut source with a raw route (R29; §5
    row 2). A layout holding a real `\r` is read-only.

**Insert, chips, creation and recovery (Q5, Q9, Q10)**

20. **All ten `+ Insert` rows ship in Phase 4**, in the order Cursor (exists) → Choice, Form → Date/time,
    Random, Clipboard → Shell, Script, Another match → Regex capture. Echo is authored through *Add
    variable*. An *Insert* is one undoable compound action and one save; if `vars` is absent, one complete
    `vars` subtree is inserted. Names are checked against locals, visible globals, regex captures, pending
    additions and synthesized names (`form1`); under an open scope the UI says "available among visible
    names", never "collision-free" (§5 row 4).
21. **Creation stays variable-free in Phase 4.** A recovery that would carry variables or form definitions
    **refuses** recreate-as-new rather than creating a snippet whose references lost their definitions
    (`recovery.ts:60-63` already excludes `vars` and `form_fields`); it offers the retained source and a
    labelled draft description to copy, and discard.
22. **Reapply for variables** is keyed on the **whole `vars` container** (and the whole `form_fields`
    container): it reapplies only when the container baseline is unchanged or the whole intended result is
    already present, otherwise it collides. No variable identity by index or name across revisions. Phase 3
    ruling 23 applies in full to every new editable value.
23. **R36's conservative rule** covers variable and form structural actions document-wide while a stale
    draft is open; **R37**'s one-read rule is exercised by caller tests, and the comment says TypeScript
    does not force it.
24. **The variables surface is a group inside the existing match editor plus a chip strip**, built from new
    browser submodels composed into one buffer set, one history, one save and one conflict registry.
    `EDITABLE_FIELDS` (`matchEditor.ts:463`) stays the closed scalar list. `workspace.svelte.ts` stays thin.
25. **CodeMirror is not Phase 4.** The plan's code-editor requirement stays for a later phase with its own
    dependency and WKWebView acceptance.

**Preview and regex bench (Q6, Q7)**

26. **Preview is a pure, bounded Rust illustration**, not an espanso engine. The type table is the consult's
    (`phase-4-design.md:218-228`). **`shell` and `script` are never executed and the clipboard is never read
    by any Phase 4 path**; there is no *Run test* button (§5 rows 5, 6). Preview output is labelled as an
    interpretation for the example; D2u still governs the controls.
27. **Dates:** `chrono` and a bounded time-zone crate may enter the **core**, pinned and recorded; clock and
    zone come in the request; tests never read the wall clock.
28. **The regex bench runs in Rust** with this crate's `regex`, first-match search without added anchors, and
    states in both languages that it tested with 1.13.1 while espanso 2.3.0 uses 1.5.5, so the result
    establishes nothing about acceptance or triggering there. JavaScript `RegExp` is never used.

**Window halves, i18n and process (Q11, Q12)**

29. **Four window halves: 4-13, 4-16, 4-20, 4-23.** They are ruling 30 of Phase 3 carried: every new visible
    editing surface (4-11, 4-12, 4-15, 4-19, 4-22, and 4-2 if it changes a drawn component) owes its half
    before Phase 4 closes. **A driven run sets each aside** under the owner's standing ruling
    (`3-split-notes.md` §4.8), records it as owed and continues; `3-split-notes.md` §4.1 governs who reads
    (a model's look at a `screencapture -l` capture of a visible, unlocked window is recorded as such; real
    input and wording or layout acceptance are a person's). Mounted evidence is never credited as a screen.
    The steps with no half record *"No window reading was performed or claimed."*
30. **Process:** one worker and one adversarial review per step; blockers fixed, verification re-run, the
    step closes (`CLAUDE.md` §7). If a structural capability fails in 4-3 … 4-6, the step keeps the working
    operations, refuses the combination, and the orchestrator adds a **numbered** core step before any
    control exposes it.
31. **i18n:** new keys land with their owning step; the consult's per-step ranges (`phase-4-design.md:
    349-374`, **186–352 per language in all**, summed here) are planning figures, not acceptances. New
    typed accessor families (`describeVariableEdit`, `describeVariableAnalysis`, `describeFormEdit`,
    `describeFormAnalysis`, `describeInsertAction`, `describePreviewOutcome`, `describeRegexBenchOutcome`)
    with reactive wrappers. A `.ts` model exposes codes and operands, never assembled sentences; R31's
    markup-only scan is not cited as covering them. A **separate Phase 4 translation-review inventory** is
    kept (4-24); R35 stays the owner's before Phase 5.

**Carried from Phase 3, by reference** (`3-split-notes.md` §3): rulings 3 (core before the control), 4 (no
caller YAML), 5 (list styles), 10 (textual options), 15–17 (unknown-field preservation; R30 open), 23
(lifecycle for every newly editable field), 24 (R36, R37), 30 (window halves), 31 (R38 touched, never closed
wholesale), 34 (process), and §4.1 and §4.8. Ruling 9's first half (shorthand `form` editable as layout text)
stands; its second half (`form_fields` read-only) is **superseded** by rulings 15–19 here.

---

## 4. Corrections and narrowings — where this record departs from the consult

### 4.1 Verification of the consult's factual claims

Beyond the citation audit of §6, the claims that carry rulings were re-derived on the tree:

- *Creation writes every option as `EntryValue::Scalar`* — true: `new_match.rs:306-322`.
- *`plain_source_nodes` visits scalar edits and field expectations only; a new item's `PlainSource` is
  rendered verbatim and not exempted* — true: `edit.rs:9256-9297`, `:7607-7612`; and
  `plain_scalar_is_ambiguous` answers `true` for any text YAML 1.1 resolves to a non-string
  (`emit/tags.rs:241-246`), which includes `true`.
- *`depends_on`'s presence is computed and discarded* — true: `variable.rs:179-194`.
- *The engine's value shapes are three* — true: `edit.rs:663-674`.
- *Inserted-field refusals carry positions, never keys* — true: `edit.rs:7305-7318`.
- *Recovery excludes `vars` and `form_fields`* — true: `recovery.ts:60-63`.
- *An absent date `format` yields RFC 2822; every local variable is evaluated* — both are what the
  validator's transcribed comment says (`validate/mod.rs:688-697`); neither is established here against
  espanso.
- *`wire_contract.rs` exists* — true: `src-tauri/src/wire_contract.rs`.

No claim was found false. Seven citations resolve only with a note (§6).

### 4.2 Narrowing: A1 is a defect of this project's contract, not a proven espanso failure

The consult calls A1 "a defect against the project's source-text option contract", which is the right
ground. This record adds nothing about how espanso reads `'true'`: that is R16/R30 territory, and the 3-10
review's statement stays the only one on file (`3-closure-notes.md` §4). 4-1's acceptance is byte-level
(what the file holds), never a claim about espanso's reading.

### 4.3 Narrowing: an inadmissible stored default at *Create*

The consult says an empty or inadmissible stored default "remain[s] visible and removable rather than
silently coerced". Under ruling 2 such a default can no longer be written. 4-1 must therefore make *Create*
refuse it **by name, before the transaction**, with the default still shown and removable; it must not drop
the default silently and must not quote it. Whether an empty `word` default was ever storable is 4-1's to
read in `src-tauri/src/sidecar/format.rs`; this record does not assert it.

### 4.4 Narrowing: dependencies that are order, not code

4-2's stated dependency on 4-1 is an ordering choice (A1 first, as `PROGRESS.md` asks); 4-2 uses nothing
4-1 builds. 4-21 depends on nothing new. The default run order is numeric, skipping set-aside window halves;
an orchestrator may take 4-21 earlier when a driven run would otherwise stop, and records that it did.

### 4.5 Correction: 4-24 does not touch `PROGRESS.md`

The consult's 4-24 "Touches … `PROGRESS.md`". The orchestrator owns `PROGRESS.md` and `PROGRESS.json`, as it
did at the Phase 3 closure (`3-closure-notes.md` §1, last bullet). E2 (the R38 row) is therefore written as a
correction **in 4-24's record** and handed to the orchestrator, not edited by the step.

### 4.6 Narrowing: what closes Phase 4

The consult withholds closure "until the required window halves **and Phase 4 owner acceptances** are
satisfied". Phase 3 closed with every window half read in part by a model's look and **no** owner acceptance
of any wording or layout (`3-closure-notes.md` §2). This record keeps that standard: **Phase 4 closes when no
window half is owed** (each read, at least in part, under §4.1 and ruling 29) and every step is closed. Owner
judgements (D-items, D11 and D15's new subjects, F1, G1–G3) are **carried** as owner items and do not hold the
phase open, unless a step's own acceptance names one (4-23's D11 disposition may be "stays owed").

### 4.7 Narrowing: B5's correction inside a window half

4-13 may change source (a wrapping fix) only after a failing visible measurement, and the change goes through
4-13's single review. Because 4-13 is set aside by driven runs, B5 is repaired only in an attended session;
this is the 3-14 shape (a window step that also changes one drawn thing).

### 4.8 Narrowing: i18n figures are estimates

As `3-split-notes.md` §4.7: no step's acceptance is measured against the consult's key ranges, and each step
records the keys it actually added.

---

## 5. Plan sentences this record overrides

Each override comes from the consult; line numbers are `IMPLEMENTATION_PLAN.md`'s, re-derived. **This phase
edits neither `IMPLEMENTATION_PLAN.md` nor `CLAUDE.md`**; this table is the binding override list, and
`3-split-notes.md` §5 stays in force beside it.

| # | Plan text | Line | Override | Ruling |
|---|---|---|---|---|
| 1 | "adding a field in the right panel inserts the placeholder into the layout, and vice versa" | 760-761 | Layout edits recompute displayed rows but never insert, delete or rename a definition; *Add field* is explicit and compound | 15 |
| 2 | "Unknown or advanced form syntax stays visible and editable in the layout pane" | 762 | Always visible; structurally editable only where supported; otherwise Rust-cut source with a raw route | 19 |
| 3 | "Complex entries open a compact popover with a **live preview**" | 689 | Bounded illustrative samples where supported, labelled as such | 26 |
| 4 | "Variable names are auto-generated collision-free" | 702 | Collision-free among visible names; under an open scope the UI says so and rechecks at submission | 20 |
| 5 | "Show the command, plus an explicit *Run test* button with a clear warning and captured output" | 774-775 | No *Run test*; `shell`/`script` are never executed (the plan's own recommendation at 776 and §13 at 1160) | 26 |
| 6 | "Clipboard preview likewise shows a placeholder unless the user explicitly invokes it" | 778 | Always a placeholder; no invocation reads the clipboard | 26 |
| 7 | "Regex options, form schemas and variable arrays **do not render at all** until selected" | 669 | Editing controls are not **mounted** until selected; the chip strip stays visible | 24 |
| 8 | "the strip is **ordered and reorderable**" | 711-712 | Reorderable one save at a time: a reorder is alone in its batch (R25) and unavailable while other edits are pending | 10 |

Not an override: plan §4 item 5 and §16 (a real code editor, CodeMirror 6) are outside plan §12's Phase 4
list; ruling 25 records that they stay for later.

---

## 6. Citation audit

### 6.1 The consult's citations

**The consult makes 128 backticked `file:line` citations** (a backticked token ending `:NNN` or `:NNN-NNN`,
found by a Python regex over `phase-4-design.md` below its header). They name **118 distinct locations** in
**30 files**. Every file exists. Every one of the 118 was checked by printing the cited line on the current
tree, and the context was read by hand wherever the printed line alone did not carry the claim.

- A citation *resolves* if the named construct is at that line or begins there.
- *With a note* marks an offset, or a line that resolves but does not by itself carry the claim.

**Result: 118 distinct citations; 111 resolve, 7 resolve with a note, 0 do not resolve.** None of the seven
changes a ruling:

| Citation | Consult line | Note |
|---|---|---|
| `IMPLEMENTATION_PLAN.md:139` | 182 | The table header; the nine type rows are 140-149 |
| `IMPLEMENTATION_PLAN.md:145` | 208 | The `echo` row; the sentence concerns `match` (`params.trigger`, row 149) and `clipboard` (143) |
| `IMPLEMENTATION_PLAN.md:676` | 182 | The code fence opening the ten-row `+ Insert` list (676-687) |
| `CLAUDE.md:152` | 168 | The `save_document` bullet; the `\r` rule the sentence relies on is `CLAUDE.md:191` (the sentence also names "§6's text-on-screen rules") |
| `CLAUDE.md:246` | 380 | The instrument-deletion bullet; the model/mounted/owner labelling rule is `3-split-notes.md` §4.1 |
| `crates/espansoconfig-core/src/validate/mod.rs:1078` | 192 | `rendered_content`'s doc; the imports opener is `closed_name_scope`'s doc (1116-1128) and body (1162-1164) |
| `src/lib/browser/matchEditor.ts:1875` | 323 | The `return {` of `draftWith` (1866), the one draft composition point |

The 111 that resolve without a note, by file (distinct locations): `IMPLEMENTATION_PLAN.md` 19,
`crates/espansoconfig-core/src/validate/mod.rs` 18, `src/lib/browser/matchEditor.ts` 10,
`crates/espansoconfig-core/src/patch/edit.rs` 8, `PROGRESS.md` 7, `docs/decisions/3-split-notes.md` 7,
`crates/espansoconfig-core/src/draft/new_match.rs` 5, `docs/decisions/3-closure-notes.md` 5,
`crates/espansoconfig-core/src/draft/plan.rs` 3,
`crates/espansoconfig-core/tests/corpus/synthetic/form-layout-and-choice.yml` 3, two each in
`crates/espansoconfig-core/src/draft/{bulk,match_draft}.rs`, `crates/espansoconfig-core/src/model/match_view.rs`,
`src/lib/browser/matchCreation.ts`, `src/lib/i18n/codes.ts` and `src-tauri/src/commands.rs`, and one each in
`CLAUDE.md`, `Cargo.lock`, `package.json`, `crates/espansoconfig-core/src/draft/audit.rs`,
`crates/espansoconfig-core/src/model/{document,value,variable}.rs`,
`crates/espansoconfig-core/tests/corpus/synthetic/variable-chain.yml`, `docs/decisions/3-6-3-notes.md`,
`src-tauri/src/dictionary_contract.rs`, `src-tauri/src/sidecar.rs`, `src/lib/browser/{detail,recovery}.ts`
and `src/lib/components/DetailPane.svelte` (19+18+10+8+7+7+5+5+3+3+12+14 = 111). The per-location printout
is reproducible with the script described in §1 and is not repeated here.

Two premises that carry rulings were re-derived beyond their line (§4.1): the new-item ambiguity gap
(`edit.rs:7607-7612`, `:9256-9297`, `emit/tags.rs:241-246`) and the recovery exclusion (`recovery.ts:60-63`).

### 6.2 This record's own citations

Every file and function this record names was checked to exist on `e6bbce0`: **47 distinct files** (every
path in §§1–7 and the brief's §3 table), and **23 named functions, types or constants** —
`NewMatch::entries`, `plan_scalar`, `plan_vars`, `plan_form_fields`, `draftWith`, `matchDraftOf`,
`fieldIntent`, `is_plain_source`, `ScalarEdit::plain_source`, `EntryValue::PlainSource`,
`plain_source_nodes`, `render_item`, `verify_entry_value`, `check_inserted_fields`,
`plain_scalar_is_ambiguous`, `AmbiguousPlainScalarIntroduced`, `check_closed_surface`, `required_param`,
`rendered_content`, `closed_name_scope`, `REFERENCE_PATTERN`, `run_one_save`, `save_match` — each found
with `rg -n` at the line cited. `EDITABLE_FIELDS` (`matchEditor.ts:463`) and `seedDefaults`
(`matchCreation.ts:1018`) were read in the same pass. Names this record proposes and that do not exist yet
(`NewVariable`, `variableEditor.ts`, `formEditor.ts`, `variableInsertion.ts`, `preview.ts`,
`regexBench.ts`, `test_regex`, `VariableDependencyCycle`, `DependencyHasNoDeclaration`, the `describe*`
families of ruling 31) are **proposals**, marked as such where they appear. **0 citations failed.**

---

## 7. The open-items map

Every one of the 47 items of `3-closure-notes.md` §6 (`:206-317`), plus `PROGRESS.md` *"Handed on by 3-6-3"*
item 1. *Deferred* means no Phase 4 step takes it; the reason is given, and a later phase may select it.

| Item | What (short) | Disposition |
|---|---|---|
| **A1** | Quoted `'true'` from *Create* and the single-match editor | **4-1** (rulings 1–3); optional visible confirmation in 4-13 |
| **B1** | List-item-addition draft never drew the external-change panel | **4-2**; regression extended in 4-9; visible counterpart **4-13** |
| **3-6-3 item 1** (`PROGRESS.md`) | The same item as B1 | **4-2**, as B1 |
| B2 | Snippet list draws no disabled state | Deferred — a list affordance independent of variables and forms; still a candidate, unreproduced |
| B3 | A failed bulk file's reason is not drawn | Deferred — bulk surface, not touched by Phase 4 |
| B4 | *All* list reorders after a bulk commit | Deferred — bulk surface, not touched by Phase 4 |
| B5 | Disk-version box does not wrap | **4-13** — failing visible measurement first (§4.7) |
| B6 | "A pasted line break is removed" unresolved for a real paste | **Owner** — needs a real ⌘V; scripted input cannot settle it |
| C1 | Creation form's wider fields unowned | Deferred — *Create* stays narrow and variable-free (ruling 21); a later phase selects it |
| C2 | `CommentInFlowCollection` gate never decided | Refusal **retained**; 4-5 pins it for variable lists with a test; the decision itself is deferred |
| C3 | No control sets `sortOrder` | Deferred — preferences, unrelated |
| C4 | Preferences refresh only on `open()` | Deferred — preferences, unrelated |
| C5 | Creator destinations show paths only | Deferred — creation surface, unrelated |
| C6 | Repeated opening paragraph on six conflict surfaces | **Owner** — shared prose; new variable prose must not imply it is resolved |
| C7 | CF-52 fold likely on mover and duplicator | **Owner** — a reading and a layout acceptance |
| C8 | `Several` offers no one-click form choice | Deferred — raw repair stays the route; no opportunistic conversion |
| C9 | Raw-snippet recovery gaps | Deferred — a separate surface; not variable recovery |
| C10 | Bulk attribution, conflict origin, spelling reads, `NotOneScalar` warning | Deferred — bulk surface |
| C11 | Bulk inspector residue | Deferred — bulk surface |
| C12 | Sidecar residue | Deferred — sidecar storage, unrelated |
| C13 | `_` profile semantics; import line-break fixture | Deferred — no profile or import work in Phase 4 |
| C14 | Preferences draft lifetime | Recorded limitation; no phase |
| D1 | Named sidebar row drops its count | **Owner** |
| D2 | Removed default keeps its mark | **Owner** |
| D3 | Creator's pinned block cuts option lines | **Owner** |
| D4 | *Delete this snippet* offered again after *Leave this as it is* | **Owner** |
| D5 | *Applied files* heads a *No file was written* answer | **Owner** |
| D6 | Findings block words an elided import as a shape | **Owner** |
| D7 | `_` profile offers *Add a snippet* | **Owner** |
| D8 | *Redo* enabled after a committed raw save | **Owner** |
| D9 | Raw fallback label promises editing | **Owner** |
| D10 | `run-based-removal-boundaries.yml` snippets refused as disjoint | **Owner** |
| D11 | Regex outcome panel opens with a sentence about shape | **Owner**; replacement wording presented in **4-22/4-23**, adopted only on the owner's disposition |
| D12 | Removed list items look like editable boxes | **Owner** |
| D13 | `wouldDropAliases` follows the file | **Owner** |
| D14 | ES rename sentence article and capitals | **Owner** |
| D15 | Four empty dormant content boxes | **Owner**; the new form surface is shown in **4-13**, with no automatic closure |
| E1 | 53 vs 54 keys in `3-11-2-notes.md` | **4-24** |
| E2 | `PROGRESS.md` R38 row omits Phase 3's touches | **4-24**, written in its record and handed to the orchestrator (§4.5) |
| E3 | Ruling-33 subject changes unmapped | **4-24** |
| E4 | Inventory scripts outside the repository | **4-24** — an in-repository reproducible procedure |
| E5 | Plan text shows a boolean default and old path | **4-24** — recorded; the plan itself is edited only by the orchestrator |
| E6 | Stale sentences in `workspace.svelte.ts` | **4-9** for the comments it changes; **4-24** verifies |
| E7 | Empty debris directories at the root | Deferred — not a feature dependency; empty directories are invisible to git, so any session may remove them on the owner's word |
| F1 | Unread window rows | **Owner**; Phase 4's halves credit only the rows actually observed |
| G1 | Phase 2 exit week | **Owner**, outside driven steps |
| G2 | R35 / CF-51 native-speaker review | **Owner**, before Phase 5; it grows by Phase 4's inventory (4-24) |
| G3 | 2d-8 §4.6 entries | **Owner** |

**Count:** A 1, B 6, C 14, D 15, E 7, F 1, G 3 = **47**, plus the 3-6-3 item (the same as B1) = 48 rows.
Taken by a step: A1, B1, B5, C2 (pinned only), E1–E6 — **10**; owner: B6, C6, C7, D1–D15, F1, G1–G3 —
**22**; deferred or recorded without a phase: B2–B4, C1, C3–C5, C8–C14, E7 — **15** (C2's decision is also
deferred). 10 + 22 + 15 = 47; every row has one disposition.

**The carried-forward list** (`2d-7-10-notes.md` §5, CF-1 … CF-55) keeps the state `3-closure-notes.md` §4.1
records; Phase 4 surfaces change the subject of the recovery rows (CF-12, CF-14 … CF-18, CF-39, CF-40) by
ruling 21's refusal, and of CF-50 (R38) by 4-13's deliberate touches, without closing any. **`2d-6-split-notes.md`
§7 items 1 and 10** stay "no phase" (Phase 3 ruling 32).

---

## 8. What this record could not establish

1. **No gate was run**, so nothing here is evidence that any proposed mechanism compiles or preserves bytes.
   4-1 and 4-3 … 4-6 are where that is first tested.
2. **The citation audit shows the consult read what it cites.** It does not validate the design — in
   particular, that nested new items can be verified without trusting the renderer's own envelope is the
   consult's first falsifier (`phase-4-design.md:419`) and is 4-4's to establish.
3. **Nothing here is about espanso's runtime**: not its reading of `'true'`, its placeholder grammar, its
   regex scanning, its date rendering or its evaluation order. R16 and R30 stay open.
4. **The window halves are obligations, not readings.** None has been taken.
