# Design consult — Phase 4, variables and forms

- **Provider:** **Codex** (OpenAI, through the `codex-companion` runtime), job `task-mui8fw1w-ga5pke`,
  dispatched with `task --background --effort high`, default model (no `--model` passed). Created
  2026-09-26 10:14:09 UTC, completed 10:25:54 UTC (about 11 minutes 45 seconds). It wrote none of the
  code, the brief or the records it rules on.
- **Date:** 2026-09-26.
- **Dispatch mode:** driven — the worker launched the job with the companion CLI and waited in the
  foreground. `codex-wait.sh task-mui8fw1w-ga5pke 540 300 20` exited **3** at its first window because
  the job's `updatedAt` froze at 10:15:43 while the log kept advancing to 10:19:15 (the false stall
  `docs/decisions/codex-dispatch-procedure.md` records). A bounded replica polling `.job.status` and the
  log's mtime then exited 3 again when the log went quiet for 308 s; the log's last line was the
  consultant announcing that it was drafting its final rulings, with no repeated `Searching:` line, so
  the job was **not** cancelled. A third bounded wait with a 1200 s log-stall threshold saw
  `completed`. The reply was captured with `node "$CC" result`. There was one consult; the job was not
  cancelled or re-dispatched, and the fallback agent was not used.
- **Brief:** [`docs/decisions/4-design-brief.md`](../decisions/4-design-brief.md) (Q1–Q13).
- **No gate was run** — no `cargo`, no `npm`, no launch — by the consultant (the brief forbids them)
  or by the worker who captured it. The real corpus was not opened.
- **Edits to the reply:** the only one permitted by the dispatch procedure — the Codex session-ID
  trailer (two lines) was dropped. Everything below the rule is the reply verbatim; its `## VERDICT`
  and `###` headings are its own.

---

## VERDICT

Proceed with Phase 4 after fixing A1. Build narrowly typed nested edits before exposing variable controls, promote forms and choices ahead of the remaining popovers, and retain R25’s separate-save rule for reordering. Override automatic form-definition synchronization and any promise of an espanso-equivalent preview. Creation remains variable-free; variable-bearing recovery must refuse partial recreation explicitly.

This consultation used repository reads only; no files were changed, no web requests were made, and no tests, application launches or window readings were performed.

### Q1 — A1 and the candidate defects

**Ruling:** Fix both A1 paths together in **4-1**, before feature work. Use plain-source emission for the seven bulk options **and `paragraph`**; retain string encoding for `anchor`. Reproduce B1 separately in **4-2**.

A1 is a defect against the project’s source-text option contract. Its mechanism is established by reading, although its regression tests still must demonstrate failure on the unchanged tree:

- Creation converts all nine options into `EntryValue::Scalar`, including boolean-looking text.
- The single-match planner uses decoded-text equality and `ScalarEdit::new`.
- Bulk explicitly handles the equal-decoded-text/different-spelling case and emits `ScalarEdit::plain_source`.

Evidence: `crates/espansoconfig-core/src/draft/new_match.rs:306`, `crates/espansoconfig-core/src/draft/plan.rs:1500`, `crates/espansoconfig-core/src/draft/bulk.rs:602`.

The policy is **eight plain-source options, one string option**. `paragraph` joins the seven bulk fields because the authoritative model describes it as boolean. `anchor` remains a string: forbidding text that needs quoting would impose an unnecessary restriction on that field. All nine retain textual controls; emission policy does not authorize type inference or checkboxes. This deliberately rejects the question’s apparent seven-or-nine dichotomy. Evidence: `IMPLEMENTATION_PLAN.md:124`, `IMPLEMENTATION_PLAN.md:130`, `crates/espansoconfig-core/src/draft/new_match.rs:236`, `docs/decisions/3-split-notes.md:599`.

For the eight plain-source fields:

- Validate every explicit `Set` and creation value with the shared parser-backed plain-source check before attempting a transaction.
- Refuse empty text, line breaks, quoted fragments, comments, aliases, tags and collection syntax when they fail that check.
- `Unchanged` preserves existing bytes, including `'true'`.
- An explicit `Set("true")` rewrites an existing quoted spelling to plain `true`.
- Typing and then undoing back to the original buffer remains `Unchanged`; merely visiting a control must not migrate its spelling.

The final point follows the current intent model: `fieldIntent` compares the final buffer with the baseline, rather than recording that a control was touched. Evidence: `crates/espansoconfig-core/src/draft/bulk.rs:301`, `src/lib/browser/matchEditor.ts:1676`.

Replace the `NewMatch` comment’s claim that quoting `on` and `yes` is intended with an explicit distinction: **the eight option values are validated plain source; trigger, content, metadata and `anchor` are logical strings encoded by the scalar codec**. Update the adjacent “every value is a logical string” paragraph too. D2u does not justify changing an authored option into a YAML string. Evidence: `crates/espansoconfig-core/src/draft/new_match.rs:175`, `crates/espansoconfig-core/src/draft/new_match.rs:185`.

Widening the ambiguity exemption is acceptable **only to the exact candidate value nodes corresponding to explicitly requested `PlainSource` entries in inserted items**. Do not exempt an item, subtree, key name or source spelling globally. Derive candidate positions from insertion expectations, including preceding insertions and removals, and independently verify plain style and exact bytes.

The decisive negative test must deliberately corrupt a neighbouring ordinary string value into an ambiguous plain scalar while leaving the intended plain-source option correct. Verification must reject that candidate. Add variants with equal text in a key, sibling item and scalar-list element; none receives the exemption. Test multiple inserted items and candidate-index shifts. Today the renderer writes such entries verbatim, while `plain_source_nodes` visits scalar edits and field expectations only. Evidence: `crates/espansoconfig-core/src/patch/edit.rs:7607`, `crates/espansoconfig-core/src/patch/edit.rs:9256`, `crates/espansoconfig-core/src/patch/edit.rs:9482`.

No sidecar format or seeding change is needed. Defaults already carry strings, and creation forwards them unchanged. Core emission and refusal contracts change; frontend contract mirrors, translations and end-to-end request tests change as necessary. Empty or otherwise inadmissible stored defaults remain visible and removable rather than silently coerced. Evidence: `src-tauri/src/sidecar.rs:181`, `src/lib/browser/matchCreation.ts:1018`, `src/lib/browser/matchCreation.ts:1669`.

B1 belongs in 4-2 because new structural drafts must not inherit an unexplained conflict-delivery failure. Reproduce the observation-to-model-to-mounted-panel chain with an added list item, then distinguish missing delivery, missing model state and missing rendering. The record explicitly leaves that distinction unresolved. Evidence: `docs/decisions/3-6-3-notes.md:120`.

Take **B5** in the early window half, 4-13, with a failing visible overflow measurement before any wrapping correction. **B2–B4** remain outside this phase’s feature dependencies. **B6** requires the owner’s real paste observation; scripted input cannot settle it. These are candidates, not defects established by this consultation. Evidence: `docs/decisions/3-closure-notes.md:224`.

### Q2 — The narrowly lifted core surface

**Ruling:** Lift D1 through explicit variable, parameter and form operations. Keep `EntryValue` nonrecursive, accept no caller-written YAML, leave globals display-only, and retain R25.

First add presence and location metadata for `vars`, `params`, `depends_on`, shorthand `form_fields`, verbose `fields`, and editable nested lists. Distinguish absent, empty, supported and unsupported shapes. An empty projected vector is insufficient authority to insert a container: `depends_on` currently discards its presence metadata, and `vars` is exposed only as a vector. Evidence: `crates/espansoconfig-core/src/model/variable.rs:179`, `crates/espansoconfig-core/src/model/match_view.rs:429`.

The minimum operations and independent checks are:

| Typed operation | Required verifier | Closed audit clause |
|---|---|---|
| Insert/remove an existing variable scalar or scalar/list parameter entry | Exact inserted key and value; retained mapping entries and outside bytes unchanged | Only a local variable’s schema scalar or immediate `params` entry |
| Add `vars` when absent; insert a variable into an existing list | Exact closed variable shape, sequence cardinality/order, scalar decoding, retained siblings | Only `<match>.vars`; absent-container insertion carries the complete new subtree |
| Remove a variable | Exact removed item and owned trivia; surviving items unchanged | Only an original local `vars` item |
| Reorder a variable | Existing move ownership/permutation checks | One same-sequence `ItemMove`, alone in its batch |
| Edit/add/remove scalar-list items | Exact order/cardinality/style and survivor mapping | Only `depends_on`, scalar `choice.values`, `random.choices`, `script.args`, and supported form-option lists |
| Edit/add/remove choice records | Exact `{label,id}` entries and record-list cardinality; retained unknown entries unchanged | Only a choice variable’s `params.values` |
| Add/remove form definitions and options | Exact field-map shape, decoded keys, retained entries and owned trivia | Only shorthand `form_fields` or verbose `params.fields` |

Existing scalar edits should continue using the existing draft surface. Its current positional addressing and refusal vocabulary are useful; its prohibition on absent nested entries is what changes. Evidence: `crates/espansoconfig-core/src/draft/match_draft.rs:23`, `crates/espansoconfig-core/src/draft/plan.rs:1178`, `crates/espansoconfig-core/src/draft/plan.rs:1298`.

Use a **closed `NewVariable` description** with common textual fields and nine kind-specific parameter variants. Reusable nonrecursive leaves may include:

- encoded string;
- validated plain-source scalar;
- scalar list;
- choice records;
- form definitions, whose options are scalar or scalar-list values.

Allow additional author-named scalar/list parameters through an explicitly bounded extension list. Do not allow arbitrary nesting, arbitrary YAML fragments or a recursive `Map<String, Value>` writer. This accommodates extensions without pretending the nine known kinds are espanso’s permanent schema.

A one-level generic mapping is insufficient: verbose forms require `params.fields.<field>.<option>`, and choices require mappings inside a sequence. The existing verifier handles only scalar, plain-source and scalar-list values, so new shapes need their own expectations and verification; they cannot inherit a guarantee merely by reaching `verify_entry_value`. Evidence: `crates/espansoconfig-core/src/patch/edit.rs:663`, `crates/espansoconfig-core/src/patch/edit.rs:9460`, `IMPLEMENTATION_PLAN.md:142`, `IMPLEMENTATION_PLAN.md:148`.

For author-chosen keys:

- New keys are decoded text, encoded with `choose_scalar` in key context.
- Reject empty keys, CR/LF, unsupported control characters and the merge-key spelling `<<`.
- Reject duplicates against existing decoded keys and all pending insertions, including differently quoted equivalent spellings.
- Refuse ambiguous, non-scalar or undecodable addressing.
- Keep existing targets positional; only insertion requests carry a new key string.
- Refusals identify positions and reason codes, never echo the submitted key into an error or log.

There is already a useful precedent: item rendering uses key context, and inserted-key errors carry positions rather than key text. Evidence: `crates/espansoconfig-core/src/patch/edit.rs:7594`, `crates/espansoconfig-core/src/patch/edit.rs:7314`.

Known non-string settings—`inject_vars`, `offset`, `trim`, `debug`, `multiline`, `trim_string_values`—need explicit plain-source emission policies, while their controls remain textual. Otherwise Phase 4 would reproduce A1 below the match mapping. String parameters, names, list strings and choice labels/IDs use string encoding. Unknown scalar options need an explicit representation choice; never infer their YAML type.

Preserve existing collection style. New nonempty collections use block style; explicit empty collections use `[]` or `{}`. Remove a container only through an explicit container-removal intent. Do not silently turn deletion of its final child into YAML null. Unsupported flow-mapping structural edits remain named refusals; do not convert them to block style.

`global_vars` remains display-only and contributes to analysis. Document-wide editing and conflicts deserve their own later scope. Reordering remains a dedicated command through `run_one_save`; neither D2r nor R25 is reopened. R25’s untested move-versus-edit overlap case therefore remains open. Evidence: `crates/espansoconfig-core/src/model/document.rs:141`, `PROGRESS.md:122`, `src-tauri/src/commands.rs:2033`.

### Q3 — Ordering and `depends_on`

**Ruling:** Preserve authored order, expose dependencies, and warn before an order inversion; do not automatically sort or prohibit an otherwise safe move.

Compute a pure dependency analysis in the core:

- Vertices are declarations identified by their scoped positions.
- Edges are explicit `depends_on` names plus references in parameter **values** when injection is certainly enabled.
- Keep explicit and inferred edges distinguishable.
- Globals and regex captures participate in name resolution, but do not acquire an invented position in the local strip.
- Duplicate names, elided values and open scopes make parts of the answer uncertain.

The validator already scans parameter values recursively and deliberately ignores mapping keys. Its injection predicate recognizes absent `inject_vars` and certain textual spellings; that is a conservative analysis rule, not an espanso resolver. Reuse that rule and its limits. Evidence: `crates/espansoconfig-core/src/validate/mod.rs:990`, `crates/espansoconfig-core/src/validate/mod.rs:1028`, `crates/espansoconfig-core/src/validate/mod.rs:1056`.

Introduce `VariableDependencyCycle` and `DependencyHasNoDeclaration` as **`SuspiciousButPermitted`**, never a new blocking class. Show analysis live. Produce save-time acknowledgements only for relevant variable operations that introduce or worsen those conditions, bound to the candidate revision. An unrelated label save must not acquire new acknowledgement requirements because an old graph is imperfect. This follows the existing operation-specific finding precedent. Evidence: `crates/espansoconfig-core/src/validate/mod.rs:72`, `crates/espansoconfig-core/src/validate/mod.rs:179`.

A move that places a consumer before a known dependency receives a concrete advisory naming the two displayed declarations. It remains available after the user sees that advisory; file order is not established here as espanso’s complete execution order. The synthetic chain is useful test data, but its explanatory comment is not an upstream runtime oracle. Evidence: `crates/espansoconfig-core/tests/corpus/synthetic/variable-chain.yml:1`.

The strip shows declaration-order numbers, dependency links, and an “analysis incomplete” state. The expanded list includes every declaration, including those with no visible reference. A reorder saves alone and is unavailable while other draft changes are pending.

### Q4 — The form builder

**Ruling:** Layout text is authoritative for placeholder occurrences; field definitions remain independently authored configuration. One shared form model has shorthand and verbose write adapters.

Build a core parser for an explicitly named **supported placeholder subset**, initially `[[identifier]]` with ASCII identifier spelling `[A-Za-z_][A-Za-z0-9_]*`. Return occurrences, repeated-name groups, text segments and unsupported/malformed regions. Preserve every character. Repeated occurrences refer to one displayed field row; definitions without occurrences remain visible separately.

The repository establishes `[[field]]` and the two storage shapes, but does not establish espanso’s complete placeholder grammar, escaping or advanced layout syntax. Do not call this parser espanso-compatible. An owner-supplied, provenance-recorded upstream grammar or offline differential examples would settle the gap. Evidence: `IMPLEMENTATION_PLAN.md:151`, `crates/espansoconfig-core/src/model/match_view.rs:226`, `crates/espansoconfig-core/src/validate/mod.rs:167`.

Override plan §8.6’s automatic synchronization sentence as follows:

- Editing layout immediately recomputes displayed placeholder rows.
- Editing layout **never inserts, deletes or renames a field definition**.
- Explicit **Add field** inserts a placeholder at the chosen caret and drafts any selected field options as one compound intention.
- Removing or renaming a field is explicit and previews affected occurrences and definitions.
- Deleting the last occurrence leaves its definition visible with an advisory.

This retains Phase 3 ruling 9 and prevents a parser approximation from deleting owner data. Evidence: `IMPLEMENTATION_PLAN.md:760`, `docs/decisions/3-split-notes.md:597`.

Use one `FormModel` with a storage discriminator:

- Shorthand writes `form` and `form_fields`.
- Verbose writes the selected variable’s `params.layout` and `params.fields`.
- Neither adapter converts representation.
- The existing shorthand content buffer remains the layout buffer; do not create a second textarea draft for the same scalar.

The shorthand field already travels through `MatchDraft.form`, and content fields already use the multiline control policy. Evidence: `src/lib/browser/matchEditor.ts:1882`, `src/lib/browser/matchEditor.ts:522`.

Make **choice and list** the early, first-class field cases. Selecting a placeholder, then selecting Choice or List opens its values immediately; entering the actual values naturally requires further input. Support both scalar-list and multiline-string values without silent conversion. `multiline`, defaults and trimming remain textual options. Evidence: `IMPLEMENTATION_PLAN.md:165`, `IMPLEMENTATION_PLAN.md:221`, `crates/espansoconfig-core/tests/corpus/synthetic/form-layout-and-choice.yml:39`.

Narrow “unknown or advanced syntax stays visible and editable”: preserve all such text; allow structured editing only where the projection and typed operations support it. Display unsupported subtrees through Rust-cut source text with an explicit raw-edit route. R29 does not authorize inventing fields hidden behind an elided span. Evidence: `IMPLEMENTATION_PLAN.md:762`, `PROGRESS.md:125`, `crates/espansoconfig-core/src/model/value.rs:19`.

A layout containing an actual `\r` is read-only through `SourceText`. Refuse it at load, edit and send, including forged buffers. Test CRLF file bytes separately from CR in the decoded scalar: a CRLF file does not justify blanket normalization or blanket refusal of every projected value. Evidence: `src/lib/browser/matchEditor.ts:536`, `CLAUDE.md:152` and §6’s text-on-screen rules.

### Q5 — Insert popovers and chips

**Ruling:** Deliver all ten planned rows, with form and choice authoring first. Insertion drafts a compound change; it never performs an immediate partial save.

Delivery order:

1. Retain Cursor position.
2. Add Choice and Form.
3. Add Date/time, Random choice and Clipboard.
4. Add Shell command, Script and Another match.
5. Add Regex capture with the regex bench.

Echo remains available through **Add variable** and chip editing; do not invent an eleventh promised popover row. The ten-row list and all nine variable kinds are distinct requirements. Evidence: `IMPLEMENTATION_PLAN.md:676`, `IMPLEMENTATION_PLAN.md:139`. Cursor insertion already exists as a buffer-only action for `replace`. Evidence: `src/lib/browser/matchEditor.ts:3410`, `src/lib/browser/matchEditor.ts:3445`.

Generate names against:

- local declarations;
- visible globals;
- named regex captures;
- pending additions;
- relevant reserved/synthesized names, including shorthand `form1`.

Under imports or otherwise open scope, say **“available among visible names”**, not “collision-free.” Permit a deliberate provisional name, recheck the visible namespace at submission, and never resolve imports merely to improve this claim. Existing reference scope deliberately opens under imports or unsupported declarations. Evidence: `crates/espansoconfig-core/src/validate/mod.rs:1078`, `crates/espansoconfig-core/src/validate/mod.rs:1156`.

An Insert confirmation creates one undoable editor action containing:

- the content-buffer change at the caret;
- the new variable description;
- the name used by both.

Save submits one `MatchDraft` and one transaction. If `vars` is absent, emit one complete `vars` subtree insertion, not a parent insertion followed by an edit addressed into that newly created parent. Combine with the final content edit only where both operations address the original document and their spans and anchors are independent. Coalesce insertions sharing an anchor. Refuse an unsupported combination before sending. Evidence: `crates/espansoconfig-core/src/draft/audit.rs:175`, `src-tauri/src/commands.rs:3657`.

A verbose form inserts selected `{{name.field}}` references, not an unexplained `{{name}}` aggregate. In a shorthand layout, Form opens field authoring; variable-reference insertion is offered only on surfaces whose rendering semantics are established.

Chip editing uses the existing `VariableDraft` for existing scalars and the new typed additions for structure. It is a submodel of the same editor session, not a second writer or independent draft registry. The current wire deliberately sends empty variable/form drafts; replace that composition point. Evidence: `crates/espansoconfig-core/src/draft/match_draft.rs:690`, `src/lib/browser/matchEditor.ts:1896`.

“Orphaned” means **no visible reference found**, not “has no effect.” Show an advisory and never delete automatically. The validator’s transcribed source notes that every local variable may be evaluated even without a body reference. Evidence: `crates/espansoconfig-core/src/validate/mod.rs:694`.

Shell and script authoring is text-only. Say that espanso may execute the authored command when the snippet expands, and that this application does not run it. Show script argument boundaries. Clipboard has no preview read. Match variables author `params.trigger`; suggestions may use visible matches, but must not promise runtime resolution, import coverage or a unique target. Evidence for those parameter shapes: `IMPLEMENTATION_PLAN.md:145`.

### Q6 — Deterministic preview

**Ruling:** Implement a pure, bounded Rust preview service with explicit sample inputs and structured uncertainty. It is an illustrative renderer, not an espanso execution engine.

The core owns reference tokenization, form analysis, dependency analysis and preview. TypeScript coordinates requests and draws results. This avoids a JavaScript approximation of the Rust reference grammar or chrono date formats. The authoritative date format is chrono strftime, and the reference pattern is already transcribed in Rust. Evidence: `IMPLEMENTATION_PLAN.md:141`, `crates/espansoconfig-core/src/validate/mod.rs:159`.

The type contract is:

| Type | Phase 4 preview |
|---|---|
| Echo | Its text, with supported parameter injection |
| Date | Explicit sample instant, explicit time zone, supported textual format/offset |
| Choice | User-selected example; distinguish displayed label from returned ID |
| Random | Explicitly selected example, labelled as a sample; no random generator |
| Form | Supported layout segments populated by supplied sample field values |
| Clipboard | Unavailable-value placeholder only |
| Shell | Authored command and uncertainty marker; never execute |
| Script | Authored argument list and uncertainty marker; never execute |
| Match | Nested-match placeholder; no recursive match rendering |

Use a bounded topological evaluation of known dependencies. Cycles, ambiguous declarations, unsupported substitutions and missing sample values produce structured unresolved segments rather than guessed strings. Never substitute an object-valued form as though it were a scalar.

Reuse `VAR_REGEX` exactly for recognized references, including subnames and whitespace. Reuse the conservative injection analysis, but **do not claim it follows espanso exactly**. Its present implementation treats unrecognized textual values as “not certainly enabled”; preview needs to distinguish that uncertainty from a known simulation choice. Evidence: `crates/espansoconfig-core/src/validate/mod.rs:1056`.

D2u still applies: controls display authored scalar text. The preview may apply documented lexical rules to supported sample parameters, but must identify the result as an interpretation for the example. Quoted boolean-like flags, unsupported offset text, unknown locale behavior or ambiguous scalar meanings must not be silently coerced.

Accept `chrono` and, for named IANA zones, a bounded timezone dependency in the **core**, with features chosen to avoid implicit current-time/local-zone reads. Pin and record their versions. Supply the clock and zone through the request; tests never consult the wall clock. Locale-sensitive formats may return `LocaleUnsupported` rather than simulating an unspecified locale. An absent date format can use the RFC 2822 default documented in the validator’s transcribed source. Evidence: `crates/espansoconfig-core/src/validate/mod.rs:690`.

Show the sample instant, zone and limitations beside the result. Preserve unresolved markers, bound output and evaluation work, and render HTML/Markdown source safely without executing embedded content or fetching resources.

Override §8.3’s universal “live preview” promise with **bounded illustrative samples where supported**. Override §8.7’s Run test button and clipboard exception completely. Neither exists in Phase 4. Evidence: `IMPLEMENTATION_PLAN.md:689`, `IMPLEMENTATION_PLAN.md:773`, `IMPLEMENTATION_PLAN.md:1160`. R16 and R30 remain open: `PROGRESS.md:121`, `PROGRESS.md:131`.

### Q7 — Regex test bench

**Ruling:** Use Rust’s current regex dependency in a pure core function, expose a stateless read-only command, and add the UI in a separate step.

The bench must say, in both languages: **“Tested with this editor’s regex 1.13.1. Espanso 2.3.0 uses 1.5.5; this result does not establish acceptance or trigger behavior there.”** Compilation failure describes this engine; compilation success is not compatibility certification. Evidence: `Cargo.lock:2536`, `crates/espansoconfig-core/src/validate/mod.rs:132`.

Use an explicitly documented **first-match search over the supplied sample**, without adding anchors or modifying the pattern. Show:

- compile failure, no match or match;
- the full first match;
- named captures, including unmatched optional captures;
- the corresponding `{{name}}` insertion choices.

The repository documents verbatim compilation and named captures, but does not settle the complete surrounding trigger-buffer, anchoring or scanning behavior. Do not label the sample “what espanso will trigger.” Evidence: `crates/espansoconfig-core/src/validate/mod.rs:138`, `crates/espansoconfig-core/src/validate/mod.rs:893`.

Proposed wire:

`test_regex({ request_id, pattern, sample }) -> { request_id, engine, outcome }`

It takes no document path, identity, save session or acknowledgement. It acquires no workspace/save lock and performs no file I/O. Return Rust-cut text segments or capture strings; never ask JavaScript to slice a UTF-8 byte span.

Initial limits: 8 KiB UTF-8 pattern, 64 KiB sample, 128 named groups, 1 MiB compiled-size budget, 1 MiB DFA cache budget, and 128 KiB aggregate response text. Return typed `PatternTooLarge`, `SampleTooLarge`, `CaptureLimit`, `CompileRejected` and `OutputLimit` outcomes. Compile rejection may carry bounded diagnostic detail for local display; never log pattern/sample text.

The UI drops responses for superseded request generations. Regex capture insertion depends on this service and a current successfully compiled regex draft; it edits content only and creates no variable. A capture name remains insertable even when the current sample does not match.

### Q8 — Reference diagnostics

**Ruling:** Add conservative core analysis and live advisories; retain existing rule 5, and use new save-time findings only for relevant newly introduced dependency problems.

Add:

- explicit dependency-name checking;
- graph-cycle analysis;
- visible-reference usage counts;
- form sub-reference advisories against recognized layout placeholders;
- incomplete-analysis reasons.

A form sub-reference is only analyzed when its declaration resolves uniquely to a known form and the relevant layout is available. Phrase the result as **“field not found in the supported layout syntax”**, not “espanso will reject this field.” Unsupported syntax, aliases, duplicate declarations and elided structure prevent a definitive answer.

Verbose form layout is already inside the parameter-value traversal; do not add a duplicate scan. Shorthand `form` is explicitly excluded from the rendered-content scan because the loader transforms it. Therefore, do not simply widen `rendered_content` to include shorthand layouts. Show double-brace occurrences there as unverified layout references until an offline runtime/source observation establishes the correct semantics. Evidence: `crates/espansoconfig-core/src/validate/mod.rs:1028`, `crates/espansoconfig-core/src/validate/mod.rs:1076`.

Keep orphan warnings advisory-only. A declaration with no body reference may still be evaluated, and dependencies can consume it indirectly. Evidence: `crates/espansoconfig-core/src/validate/mod.rs:694`.

No new diagnostic uses `EditorModelError`. New dependency findings use `SuspiciousButPermitted`, with operation-specific candidate binding as ruled in Q3. Existing rule 5 retains its current save behavior; the new analysis must not turn an open scope into a closed one. Evidence: `crates/espansoconfig-core/src/validate/mod.rs:933`, `crates/espansoconfig-core/src/validate/mod.rs:1116`.

File-supplied name operands are acceptable for local finding display, as they are today. Prefer scoped positions and spans when a name is unnecessary. Do not include command bodies, sample values or unrelated source text. Do not copy owner-text operands into logs, fixtures, review records or telemetry. Distinguish findings from mutation refusals: the latter continue to use positions and reason codes. Evidence: `crates/espansoconfig-core/src/validate/mod.rs:232`, `crates/espansoconfig-core/src/validate/mod.rs:969`, `crates/espansoconfig-core/src/draft/match_draft.rs:23`.

### Q9 — Conflict, reapply, recovery and creation

**Ruling:** Reapply positional variable drafts only when their complete addressed container baseline is unchanged, or their complete intended result is already present. Otherwise collide; never follow a variable across revisions by index or name.

Capture a revision-bound baseline for each edited container, including presence, shape, order, source spellings and retained unknown content. Rust supplies exact source slices or content fingerprints. A shifted byte offset alone is not a content change, but a variable insertion, removal, reorder, rename or changed container text defeats positional correspondence.

For variable drafts, initially use the **whole local `vars` container** as the correspondence unit. For shorthand definitions use the whole `form_fields` container. For compound Insert/Add field actions, the content/layout edit and structural edit reapply together or collide together. This is conservative, but checkable.

Do not manufacture stable variable IDs or match by name: names are editable and duplicates are representable. The existing match reapply already treats list changes conservatively and blocks the whole reapply when any subject collides. Evidence: `src/lib/browser/matchEditor.ts:4850`, `src/lib/browser/matchEditor.ts:4975`.

Every newly editable value and structural intention must appear in:

- retained draft and undo history;
- external- and save-origin conflict state;
- compare and copy output;
- reapply decision;
- explicit recovery disposition.

Creation remains variable-free in Phase 4. A variable/form-bearing recovery must **not** silently create a snippet containing references while dropping its definitions. Offer retained source plus a clearly labelled draft description for copying, continued manual resolution where possible, and explicit discard. Disable recreate-as-new whenever the complete variable/form intention cannot be carried. This is a deliberate refusal, not a promise of executable recovery YAML.

That restriction is necessary because `NewMatch` currently has no variables or field definitions, and recovery explicitly excludes both. Evidence: `crates/espansoconfig-core/src/draft/new_match.rs:193`, `src/lib/browser/recovery.ts:60`.

R36 applies to variable insertion/removal/reorder and form structural actions throughout the document whenever a stale match draft is open. Reorder also requires no other pending edit because of R25. Derive displayed eligibility, destination/order choices and submitted identity from one synchronous read of current projections; test the integration, since TypeScript cannot enforce this provenance. Evidence: `docs/decisions/3-split-notes.md:664`, `PROGRESS.md:132`, `PROGRESS.md:135`.

B1 must be reproduced before these paths are trusted. Its window counterpart remains owed even if a model defect is fixed in 4-2.

### Q10 — Editor shape and scope

**Ruling:** Put an expandable **Variables and fill-ins** group inside the existing match editor, with a compact used-variable strip under content. Implement separate browser submodels, not more scalar entries in `EDITABLE_FIELDS`.

The collapsed strip offers navigation and order indicators. The expanded group shows the full ordered list, dependency state, unused declarations and unsupported entries. Selecting Form opens the shared builder. No variable cards or form schemas mount for an ordinary snippet until the group, chip or relevant content mode is selected.

This interprets §8.2’s “do not render” as **do not mount the editing controls until selected**, while retaining the discoverability promised by §8.3’s strip. Evidence: `IMPLEMENTATION_PLAN.md:669`, `IMPLEMENTATION_PLAN.md:704`, `IMPLEMENTATION_PLAN.md:739`.

Create focused modules such as `variableEditor.ts`, `formEditor.ts`, `variableInsertion.ts`, `preview.ts` and `regexBench.ts`. They expose values and transitions. Compose them into one `MatchBuffers`, one history, one save and one conflict registry. `EDITABLE_FIELDS` remains the closed scalar list; nested positional paths do not belong in that enum. Evidence: `src/lib/browser/matchEditor.ts:463`, `src/lib/browser/matchEditor.ts:1875`.

Keep `workspace.svelte.ts` coordination thin. New components draw submodel decisions; they do not independently choose eligibility, infer a scalar type or construct YAML. This follows `CLAUDE.md` §6’s frontend rule and avoids adding another independent interpretation alongside the existing read-only variable detail. Evidence: `src/lib/browser/detail.ts:644`, `src/lib/components/DetailPane.svelte:1864`.

CodeMirror is **not** Phase 4 work. Retain the plan’s broader code-editor requirement for later polish with its own dependency and WKWebView acceptance. The runtime dependency list currently contains only Tauri’s API, and Phase 4’s list does not include a code editor. Evidence: `package.json:31`, `IMPLEMENTATION_PLAN.md:1122`.

D15 remains an owner wording/layout decision; introducing the form builder must not silently claim to have settled the four dormant-content-box question.

### Q11 — The step-cut policy

**Ruling:** Use the dependency-ordered 24-step cut below. Core capabilities precede callers; browser models precede controls; visible readings are separate, predeclared window halves.

4-1 fixes both A1 paths because they share one emission contract and one ambiguity-exemption question, even though creation and editing reach different planners. B1 is isolated in 4-2. Forms and choices become usable in 4-11/4-12, before the remaining popovers in 4-15.

Every implementation step is one worker and one adversarial review. Fix its blockers and rerun verification within that step. A newly discovered substantial capability may justify a new numeric step **before an unstarted consumer**, never a lettered re-review or a post-review subdivision. Evidence: `CLAUDE.md:252`, `docs/decisions/3-split-notes.md:726`.

A driven run skips the numbered window halves, records them as owed and continues through independent implementation dependencies. Closing an implementation portion does not close its visible feature obligation. No phase closure may erase unread halves. Evidence: `docs/decisions/3-split-notes.md:796`.

Keep all nine variable kinds, the form builder, dependency editing, diagnostics, illustrative preview and regex bench in Phase 4. Cursor insertion is already implemented. Defer global editing, import resolution, nested-match rendering, full grammar/runtime equivalence, variable-bearing Create, CodeMirror and bulk variables. Execution and clipboard preview reads remain prohibited. Evidence: `IMPLEMENTATION_PLAN.md:1124`, `IMPLEMENTATION_PLAN.md:1160`, `IMPLEMENTATION_PLAN.md:1168`, `src/lib/browser/matchEditor.ts:3445`.

### Q12 — Localization, windows and carried items

**Ruling:** Each step owns its codes and both languages. Window halves are 4-13, 4-16, 4-20 and 4-23; owner-only judgments remain separately owed.

Planning estimates below are **new keys per language**, not quotas or acceptance counts:

| Step | EN/ES key range | Principal family |
|---|---:|---|
| 4-1 | 1–5 | Existing draft/creation refusals |
| 4-2 | 0–3 | Existing conflict codes |
| 4-3 | 4–10 | Variable draft/refusal codes |
| 4-4 | 5–12 | Variable structural refusals |
| 4-5 | 4–10 | Choice/list refusals |
| 4-6 | 5–12 | Form structural refusals |
| 4-7 | 12–22 | Variable analysis, form analysis, findings |
| 4-8 | 3–8 | Command and snapshot refusals |
| 4-9 | 12–22 | Variable editor/conflict/recovery |
| 4-10 | 10–18 | Form editor model |
| 4-11 | 25–40 | Variable controls, choices, insertion |
| 4-12 | 25–40 | Form builder |
| 4-13 | 0–4 | Corrections within its declared scope |
| 4-14 | 8–15 | Remaining variable kinds |
| 4-15 | 25–40 | Remaining popovers |
| 4-16 | 0–3 | Corrections within its declared scope |
| 4-17 | 10–18 | Preview outcomes |
| 4-18 | 5–10 | Date-preview outcomes |
| 4-19 | 15–25 | Preview controls and limitations |
| 4-20 | 0–3 | Corrections within its declared scope |
| 4-21 | 5–9 | Regex-bench outcomes |
| 4-22 | 12–20 | Regex bench and capture insertion |
| 4-23 | 0–3 | Corrections within its declared scope |
| 4-24 | 0 | Records and inventory |

Add typed accessor families such as `describeVariableEdit`, `describeVariableAnalysis`, `describeFormEdit`, `describeFormAnalysis`, `describeInsertAction`, `describePreviewOutcome` and `describeRegexBenchOutcome`, with reactive wrappers. Existing finding/draft accessors remain the route for their existing enum families. Register every new Rust code enum with the dictionary contract. That contract currently checks enum/key correspondence in both directions; it does not establish translation meaning. Evidence: `src-tauri/src/dictionary_contract.rs:10`, `src/lib/i18n/codes.ts:1095`, `src/lib/i18n/codes.ts:1427`.

Maintain a separate Phase 4 ES review inventory containing key, text and producer. Review TypeScript-produced strings explicitly: markup scanning is insufficient. The owner’s R35 review remains due before Phase 5. Evidence: `docs/decisions/3-split-notes.md:697`.

4-13 deliberately exercises a block-scalar layout conflict, item-owned comments, an actual CR-containing value refusal, and a CRLF file whose untouched bytes are checked. 4-16 exercises a multiline command draft without executing it. These narrow R38; they do not close it wholesale. A model’s window capture reading, mounted test and owner’s real input must remain separately labelled. Evidence: `PROGRESS.md:133`, `docs/decisions/3-split-notes.md:735`, `CLAUDE.md:246`.

Disposition of all 47 carried items, using their definitions in `docs/decisions/3-closure-notes.md:214`:

| Items | Placement |
|---|---|
| A1 | **4-1**; optional visible confirmation included in 4-13 |
| B1 | **4-2**, regression coverage extended in 4-9; visible counterpart **4-13** |
| B2, B3, B4 | **No phase** here: bulk affordance, reason rendering and ordering are independent of variable/form delivery |
| B5 | **4-13**: reproduce visible overflow first; correct only the demonstrated wrapping defect |
| B6 | **Owner**: real paste observation |
| C1 | **No phase**: Create deliberately remains narrow; Q9 records the resulting recovery refusal |
| C2 | **No phase**: retain the commented-flow hazard refusal; Phase 4 must test and explain it |
| C3, C4, C5 | **No phase**: sorting/preferences/destination naming are unrelated |
| C6 | **Owner**: shared conflict prose; new variable prose must not imply this is resolved |
| C7 | **Owner**: mover/duplicator fold reading and acceptance |
| C8 | **No phase**: retain explicit raw repair for `Several`; no opportunistic one-click conversion |
| C9 | **No phase**: raw-snippet recovery is separate; it is not the recovery implementation for variables |
| C10, C11 | **No phase**: bulk attribution, conflict origin and inspector residue remain separate |
| C12 | **No phase**: sidecar storage residue is unrelated |
| C13 | **No phase**: no profile-runtime or import-editing work in this cut |
| C14 | **No phase**: retain the recorded preferences-draft limitation |
| D1–D10 | **Owner** |
| D11 | **Owner**, with replacement regex-bench wording presented in **4-23** after 4-22 |
| D12–D14 | **Owner** |
| D15 | **Owner**, with the new form/variable surface presented in **4-13**; no automatic closure |
| E1, E2, E3, E5 | **4-24**: verify and correct the records |
| E4 | **4-24**: provide a reproducible in-repository inventory procedure rather than rely on private scripts |
| E6 | **4-9** for comments it changes; **4-24** verifies the carried disposition |
| E7 | **No phase**: unrelated repository debris is not a feature dependency |
| F1 | **Owner**; the four window halves credit only the particular rows actually observed |
| G1, G2, G3 | **Owner**, outside driven steps; G2 includes the new Phase 4 inventory before Phase 5 |

C1, C8, C9 and C10 remain deliberately unimplemented; the new surfaces must name those boundaries. D11 and D15 change subject where the new UI replaces or surrounds the old surface, but owner acceptance cannot be inferred from that change. The source categorizes those as owner questions, not established implementation defects. Evidence: `docs/decisions/3-closure-notes.md:235`, `docs/decisions/3-closure-notes.md:270`, `docs/decisions/3-closure-notes.md:303`.

### Q13 — What would falsify the cut

**Ruling:** Three observations would change the cut materially; none permits weakening fidelity or inventing runtime certainty.

1. **Nested rendering cannot be independently verified with bounded expectations.** The current verifier’s flat shape is a known limitation, not itself a surprise. The falsifier is failure to verify a new nested insertion together with a neighbouring content edit, retained unknown subtree or block-scalar seam without trusting the renderer’s own claimed envelope. Keep working operations, refuse the combination and add a numeric core step before the affected UI. Evidence for the current boundary: `crates/espansoconfig-core/src/patch/edit.rs:9460`, `crates/espansoconfig-core/src/patch/edit.rs:9622`.

2. **A synthetic shape exposes missing correspondence or presence information.** Test absent/empty/unsupported containers, duplicate names, flow choice records, definition-only fields and external insertion before a drafted variable. If the snapshot cannot distinguish them, extend 4-3/4-8 before 4-9. If B1 survives model tests but reproduces only through visible delivery, its observation remains owed and the affected feature cannot be declared window-complete. Existing fixtures cover verbose forms and choice records, but do not establish that entire matrix. Evidence: `crates/espansoconfig-core/tests/corpus/synthetic/form-layout-and-choice.yml:23`, `crates/espansoconfig-core/tests/corpus/synthetic/form-layout-and-choice.yml:56`, `docs/decisions/3-6-3-notes.md:120`.

3. **Preview correctness requires inferred YAML types or unestablished form/runtime semantics.** Reduce the affected result to an explicit unresolved/sample-only outcome; do not add a resolver approximation or execute espanso. If that makes date or form preview unhelpful, retain authoring and rescope that preview capability with its exact limitation recorded. R16 and R30 are open boundaries, not promises Phase 4 can close by adding more examples. Evidence: `PROGRESS.md:121`, `PROGRESS.md:131`.

### The step cut

The following touch lists include their focused tests and one owning notes file. Every new wire/code change also includes `src/lib/ipc/`, `src-tauri/src/{wire_contract,dictionary_contract}.rs`, `src/lib/i18n/{codes,index}.ts` and both dictionaries as applicable. Those are part of the owning step, not deferred cleanup.

All implementation acceptances include the applicable repository gates, serial Rust testing, the Tauri-free core dependency check, and independent byte comparisons on synthetic temporary files. Defect fixes require a demonstrated failing regression before the fix. Gate results are future obligations, not results of this consultation.

1. **4-1 — A1 across creation and single-match editing.**  
   **Dependencies:** none. **Scope/deliverables:** shared eight-option plain-source policy, `anchor` string exception, exact new-item exemptions, corrected comments and typed refusals. **Touches:** core `draft/{new_match,plan,bulk,error}.rs`, `patch/edit.rs`, command adapters/contracts, creation and editor request tests. **Acceptance:** failing-first tests for Create with seeded `true`, existing/absent single-match options and equal-decoded quoted values; unchanged quoted values survive; invalid plain source refuses before writing; malicious neighbouring ambiguity remains rejected; sidecar bytes and string schema remain unchanged. **Risk:** high. **Mode:** core-first repair, driven; no new editing surface.

2. **4-2 — B1 reproduction and bounded repair.**  
   **Dependencies:** 4-1. **Scope/deliverables:** identify whether list-addition conflicts fail in delivery, state or rendering; repair only the reproduced cause. **Touches:** browser `matchEditor.ts`, `workspace.svelte.ts`, reconciliation/reapply modules and the implicated existing component; backend only if the failing trace reaches it. **Acceptance:** failing-first added-item case for both `triggers` and `search_terms`, external removal/change variants, retained draft and mounted conflict panel; an unreproduced candidate is explicitly retained rather than marked fixed. **Risk:** high. **Mode:** driven repair; visible counterpart owed to 4-13.

3. **4-3 — Nested presence and author-key foundation.**  
   **Dependencies:** 4-1. **Scope/deliverables:** container presence/location metadata, bounded scalar/list mapping insertion and removal, duplicate-key and privacy policy. **Touches:** core `model/{variable,match_view,value}.rs`, `draft/{match_draft,plan,audit,error}.rs`, patch helpers and projection mirrors. **Acceptance:** absent/empty/unsupported states differ; Unicode and punctuation keys round-trip; equivalent quoted duplicate keys refuse; `<<`, invalid keys and one-level-too-deep paths refuse; errors contain positions rather than key text. **Risk:** high. **Mode:** core-first, driven, no production UI caller.

4. **4-4 — Local variable insertion, deletion and movement.**  
   **Dependencies:** 4-3. **Scope/deliverables:** closed `NewVariable` shapes using scalar/list leaves, absent `vars` insertion, item removal and isolated reorder. Choice record values and form field definitions follow in 4-5/4-6. **Touches:** new core variable-draft types, planner/audit, patch renderers/expectations/verifiers. **Acceptance:** all nine kinds have bounded constructors; new variable plus content edit applies atomically; item and file-owned comments obey ownership; removing the final item leaves an explicit empty list or follows explicit container removal; same-sequence move succeeds alone and fails with every other edit category. **Risk:** high. **Mode:** core-first, driven.

5. **4-5 — Variable lists and labelled choices.**  
   **Dependencies:** 4-4. **Scope/deliverables:** `depends_on`, random choices, script args, choice string lists and `{label,id}` records, including existing-record edits. **Touches:** core variable drafts, list planning, choice-specific patch verification and synthetic fixtures. **Acceptance:** first/middle/last additions and removals, empty lists, changed survivors and multiple insertions; string/record shapes remain distinct; retained flow style survives or receives a typed refusal; unknown record entries survive edits. **Risk:** high. **Mode:** core-first, driven.

6. **4-6 — Form-definition structural core.**  
   **Dependencies:** 4-3, 4-5. **Scope/deliverables:** shorthand and verbose field-map insertion/removal, scalar/list options, complete new verbose form descriptions. **Touches:** core form-draft types, planner/audit, patch expectations/verifiers. **Acceptance:** identical intentions write their respective shapes without conversion; layout plus field addition is atomic; deleting a definition touches only its authorized owned span; scalar-list and multiline values retain representation; unsupported subtrees refuse structured rewriting. **Risk:** high. **Mode:** core-first, driven.

7. **4-7 — Placeholder, reference and dependency analysis.**  
   **Dependencies:** 4-3. **Scope/deliverables:** supported placeholder parser, shared reference scanner, graph analysis, usage advisories and operation-specific dependency findings. **Touches:** new core analysis modules, `validate/mod.rs`, relevant save finding production and contracts. **Acceptance:** repeated/malformed placeholders, subreferences, explicit/inferred cycles, captures, duplicate names, injection spellings and imports; no false closed-scope claim; unrelated saves acquire no new dependency acknowledgement; candidate-bound consent cannot be reused for changed text. **Risk:** high. **Mode:** core-first, driven.

8. **4-8 — Revision-bound snapshots and command integration.**  
   **Dependencies:** 4-4, 4-5, 4-6, 4-7. **Scope/deliverables:** Rust-cut authoring snapshots, candidate analysis, extended `save_match`, dedicated variable reorder adapter. **Touches:** core snapshot helpers; `src-tauri/src/{commands,error,lib}.rs`; IPC/contracts. **Acceptance:** stale identities and revisions refuse; submitted spans are never trusted; every writer reaches `run_one_save`; no outer save lock; atomic content-plus-variable save, acknowledgement, no-op and uncertain-outcome tests use temporary synthetic files. **Risk:** high. **Mode:** backend integration, driven; no visible caller yet.

9. **4-9 — Shared variable editor lifecycle.**  
   **Dependencies:** 4-2, 4-8. **Scope/deliverables:** variable baseline/buffers, history, compound insertion, whole-container reapply, retention, compare/copy and recovery refusal. **Touches:** new browser `variableEditor.ts` and insertion module; `matchEditor.ts`, `reapply.ts`, `recovery.ts`, `workspace.svelte.ts`. **Acceptance:** every drafted scalar and structural action survives both conflict origins; unchanged baseline reapplies; shifted/changed list collides; complete intended result is satisfied; partial recovery creation is refused; R36 and a single projection read are exercised through callers. **Risk:** high. **Mode:** model over completed core, driven.

10. **4-10 — Form editor model.**  
    **Dependencies:** 4-9. **Scope/deliverables:** shared form model, shorthand/verbose adapters, explicit Add field compound action and definition-only rows. **Touches:** new browser `formEditor.ts`, variable/content composition and form-specific recovery/reapply tests. **Acceptance:** editing layout creates/deletes no definition; Add field changes both intended parts; undo restores both; repeated placeholders share one row; absent blank stays unchanged; CR refuses at load/edit/send; all new values have lifecycle dispositions. **Risk:** high. **Mode:** model over completed core, driven.

11. **4-11 — Variable group, chips and choice controls.**  
    **Dependencies:** 4-9. **Scope/deliverables:** expandable ordered list, dependency display, chip navigation, add/remove/reorder controls and Choice insertion. **Touches:** focused variable/choice components, `MatchEditor.svelte`, detail integration and i18n. **Acceptance:** mounted tests prove hidden controls are not mounted, all declarations remain reachable, provisional names are labelled, compound insertion reaches one save, reorder cannot bypass pending-draft/R25 restrictions, and conflict/recovery states draw. **Risk:** high. **Mode:** UI implementation, driven; window obligation 4-13.

12. **4-12 — Visual form builder.**  
    **Dependencies:** 4-10, 4-11. **Scope/deliverables:** synchronized layout display and derived rows, first-class Choice/List controls, explicit field operations and Form insertion. **Touches:** new form components, existing content control integration and i18n. **Acceptance:** mounted tests cover both storage shapes, layout-only edits, explicit compound additions, definition-only rows, unknown-source visibility, textual flags, conflict compare and recovery refusal. **Risk:** high. **Mode:** UI implementation, driven; window obligation 4-13.

13. **4-13 — Early authoring window half.**  
    **Dependencies:** 4-11, 4-12. **Scope/deliverables:** EN/ES readings of A1 outcomes, B1 conflict display, variable/choice controls and both form representations; B5 reproduction and bounded correction if demonstrated. **Touches:** owning records, minimal uncommitted instrument, and only the demonstrated B5 wrapping code if necessary. **Acceptance:** visible unlocked captures with language selected explicitly; block-scalar conflict, comments, CR refusal and CRLF preservation; failing overflow measurement before B5 correction; exact unread rows retained. **Risk:** high. **Mode:** visible window required; owner for real input and wording/layout judgments. Driven runs skip and record as owed.

14. **4-14 — Remaining variable-kind authoring models.**  
    **Dependencies:** 4-9, 4-10. **Scope/deliverables:** Date, Random, Echo, Clipboard, Shell, Script and Match form policies, required-parameter readiness and warning values. **Touches:** browser variable-kind and popover submodels. **Acceptance:** each kind produces its closed wire shape, preserves unfamiliar text, handles CR correctly and participates in undo/conflict/recovery; no execution or clipboard-read dependency is introduced; date format is not incorrectly made mandatory. **Risk:** high. **Mode:** model over completed core, driven.

15. **4-15 — Remaining popovers.**  
    **Dependencies:** 4-11, 4-14. **Scope/deliverables:** remaining planned authoring popovers and Echo through Add variable. **Touches:** focused popover components, Insert menu integration and i18n. **Acceptance:** mounted tests for caret/selection insertion, cancellation, collision checks, required values, retained drafts and textual command/argument display; no Run test or clipboard-read action; unsupported preview states are honest. **Risk:** high. **Mode:** UI implementation, driven; window obligation 4-16.

16. **4-16 — Remaining authoring window half.**  
    **Dependencies:** 4-15. **Scope/deliverables:** EN/ES readings of every remaining kind and insertion row. **Touches:** records and minimal uncommitted instrument. **Acceptance:** multiline command display, argument boundaries, clipboard placeholder, open-scope naming, held save and conflict retention observed; real typing/caret/paste acceptance separately attributed to the owner. **Risk:** high. **Mode:** visible window; owner for real input and acceptance. Driven runs skip.

17. **4-17 — Pure illustrative preview core.**  
    **Dependencies:** 4-7. **Scope/deliverables:** bounded substitution, echo, selected choices/random examples, form samples and unresolved external-effect placeholders. **Touches:** new core preview module and read-only command/IPC adapters. **Acceptance:** identical requests yield identical output; cycles and missing samples terminate with codes; exact reference-token cases match analysis; output/depth limits enforce; command and clipboard examples cause no I/O; hostile HTML is returned as data. **Risk:** high. **Mode:** core-first, driven.

18. **4-18 — Date preview.**  
    **Dependencies:** 4-17. **Scope/deliverables:** pinned date/time dependencies, injected instant and zone, bounded format/offset handling and locale limitations. **Touches:** Cargo manifests/lockfile, core date-preview module and contracts. **Acceptance:** fixed instants around date boundaries and DST changes, explicit zones, malformed formats/offsets, overflow and unsupported locale; no test reads the clock; quoted/ambiguous inputs do not silently gain resolver semantics. **Risk:** high. **Mode:** core-first, driven.

19. **4-19 — Preview controls and popover samples.**  
    **Dependencies:** 4-12, 4-15, 4-17, 4-18. **Scope/deliverables:** sample inputs, explicit clock/zone display, illustrative output and limitation states. **Touches:** browser `preview.ts`, preview components, popover integration and i18n. **Acceptance:** superseded responses cannot overwrite current samples; preview changes no draft or file; unresolved values remain identifiable; HTML is escaped; shell/script have no execution control and clipboard has no read control. **Risk:** high. **Mode:** UI implementation, driven; window obligation 4-20.

20. **4-20 — Preview window half.**  
    **Dependencies:** 4-19. **Scope/deliverables:** EN/ES readings of supported examples and uncertainty. **Touches:** records and minimal uncommitted instrument. **Acceptance:** sample instant/zone, selected choice IDs, form samples, unresolved chains, long output and command placeholders are visible and distinguishable; owner assesses whether the wording overpromises. **Risk:** routine. **Mode:** visible window; owner wording acceptance. Driven runs skip.

21. **4-21 — Regex bench core and read-only wire.**  
    **Dependencies:** none beyond the existing regex substrate. **Scope/deliverables:** first-match search, named capture results, size limits and stateless command. **Touches:** new core regex-bench module, Tauri command registration/errors and IPC/contracts. **Acceptance:** compile/no-match/match outcomes; unmatched optional captures, Unicode, zero-width matches and limit boundaries; Rust-cut result text; no workspace/save lock or file I/O; response identifies the engine version. **Risk:** high. **Mode:** core-first, driven.

22. **4-22 — Regex bench UI and capture insertion.**  
    **Dependencies:** 4-11, 4-21. **Scope/deliverables:** pattern/sample bench, current-result tracking, named capture insertion and proposed replacement wording for D11. **Touches:** browser `regexBench.ts`, bench component, Insert menu and i18n. **Acceptance:** out-of-order replies are ignored; captures come from the current pattern; insertion creates no variable; unsupported/non-regex trigger states expose no capture row; compatibility limits are drawn in both languages. **Risk:** routine. **Mode:** UI implementation, driven; window obligation 4-23.

23. **4-23 — Regex window half.**  
    **Dependencies:** 4-22. **Scope/deliverables:** EN/ES bench and capture-insertion readings, D11 wording presented to the owner. **Touches:** records and minimal uncommitted instrument. **Acceptance:** compilation failure differs visibly from no match; optional captures and Unicode display correctly; insertion affects the intended caret selection; engine/version limitation is readable; D11 receives an explicit owner disposition or remains owed. **Risk:** routine. **Mode:** visible window; owner for real input and wording. Driven runs skip.

24. **4-24 — Inventory, reconciliation and closure record.**  
    **Dependencies:** all implementation steps; record completed or owed status for each window half. **Scope/deliverables:** Phase 4 translation inventory, reproducible inventory procedure, corrected carried records, actual gate/module accounting and exact remaining obligations. **Touches:** `docs/decisions/`, translation inventory/procedure, `PROGRESS.md` and the phase’s existing progress record. **Acceptance:** every new code has both strings and a typed producer; every carried item has a disposition; gate counts come from actual runs; R16/R25/R29/R30/R35/R36/R37/R38 are not closed by assertion; no window instrument is committed. **Risk:** routine. **Mode:** driven records work. Phase closure is withheld until the required window halves and Phase 4 owner acceptances are satisfied; existing owner obligations remain explicitly tracked.
