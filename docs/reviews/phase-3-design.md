# Design consult — Phase 3, complete match editing

- **Provider:** **Codex** (OpenAI, through the `codex-companion` runtime), job `task-muehnlmf-likn54`,
  dispatched with `task --background --effort high`, default model (no `--model` passed). Created
  2026-09-23 19:21:01 UTC, completed 19:33:15 UTC (about 12 minutes). It wrote none of the code, the
  brief or the records it rules on.
- **Date:** 2026-09-23.
- **Dispatch mode:** driven — the orchestrating worker launched the job with the companion CLI, waited
  in the foreground (`codex-wait.sh` exited 3 at its first window because the job's `updatedAt` froze
  while the log kept advancing, the false stall `docs/decisions/codex-dispatch-procedure.md` records;
  the wait was continued on the log file's mtime and `.job.status`, which reached `completed`), and
  captured the reply with `node "$CC" result`. The fallback agent was **not** used; there was one
  consult.
- **Brief:** [`docs/decisions/3-design-brief.md`](../decisions/3-design-brief.md) (Q1–Q14).
- **No gate was run** — no `cargo`, no `npm`, no launch — by the consultant (the brief forbids them)
  or by the worker who captured it. The real corpus was not opened.
- **Edits to the reply:** the only one permitted by the dispatch procedure — the Codex session-ID
  trailer (two lines) was dropped. Everything below the rule is the reply verbatim; its `## VERDICT`
  and `###` headings are its own.

---

## VERDICT

Phase 3 should proceed in fifteen bounded steps: establish compositional field edits and scalar-list editing, widen creation and recovery, expose the complete textual editor, add a genuinely local raw-snippet editor, then deliver bulk editing and sidecar preferences. Keep D2u, D2r and R25. Reject cross-file atomicity and post-save batch undo promises. Make imports visible without inventing import resolution or file-renaming behavior. Each step gets one worker and one adversarial review.

I did not run gates or launch the app; this consult establishes source-derived design decisions, not runtime or window verification.

### Q1 — The step cut and its order

**Ruling:** Adopt steps `3-1` through `3-15` in the final section. Core capability must precede the controls that promise it; recovery and reconciliation must widen alongside each editor surface.

Three existing limitations materially change the cut:

- The planner anchors every insertion after the same last nameable key, while the audit rejects two insertions sharing an anchor. Adding several absent options is therefore foundational work, including for bulk editing. Evidence: `crates/espansoconfig-core/src/draft/plan.rs:135`, `crates/espansoconfig-core/src/draft/audit.rs:387`.
- A normal first-line `- trigger:` entry cannot be removed by the existing field-removal primitive. A usable trigger switch needs more than a UI that submits remove-plus-insert. Evidence: `crates/espansoconfig-core/src/patch/edit.rs:1286`, `crates/espansoconfig-core/src/patch/edit.rs:9977`.
- An empty projected sequence does not carry enough information to distinguish absence from a present empty list or to provide its insertion anchor. Evidence: `crates/espansoconfig-core/src/draft/plan.rs:852`.

The already-delivered pieces are the match-field projection, read-only detail presentation, `_`-disabled marking, and whole-document raw replacement. They are substrates, not evidence that Phase 3 editing exists. Evidence: `crates/espansoconfig-core/src/model/match_view.rs:42`, `src/lib/components/DetailPane.svelte:1694`, `src/lib/components/Sidebar.svelte:121`, `crates/espansoconfig-core/src/persist/save.rs:430`.

The phase boundaries are:

- Keep trigger/content switching, scalar metadata/options, list cardinality, cursor insertion, local raw editing, bulk options and sidecar defaults in Phase 3.
- Keep variable editing, the visual form builder, reference diagnostics, previews and the regex test bench in Phase 4, as specified at `IMPLEMENTATION_PLAN.md:1122`.
- Defer dedicated import editing/resolution and file renaming beyond this cut. Phase 3’s file-scope delivery is explicitly display-only.
- Keep cross-file moves and transactional multi-file undo outside this cut.
- Keep actual YAML anchors, aliases, tags and merge-key editing outside visual editing, as specified at `IMPLEMENTATION_PLAN.md:1162`.

### Q2 — Trigger side: `triggers` and `regex`

**Ruling:** Phase 3 supports editing and switching among all three trigger forms. Add narrowly typed structural operations; do not admit arbitrary YAML through `FieldInsert` or generalize `InsertItem` into an unrestricted collection builder.

The core needs four capabilities.

1. **Explicit sequence presence and location.** Project absent, present-empty, present-nonempty and unsupported shape separately, with Rust-derived field/sequence locations. Preserve non-scalar items in their original positions. The existing vector-only representation is insufficient for empty-list editing; existing non-scalar items are deliberately elided in place. Evidence: `crates/espansoconfig-core/src/draft/plan.rs:852`, `crates/espansoconfig-core/src/model/match_view.rs:171`.

2. **Scalar-sequence insertion and removal.** Introduce a scalar-item insertion type accepting logical text. Reuse the existing block-item removal machinery where its contract applies, but expose it through a sequence-specific draft operation restricted to `triggers` and `search_terms`. Do not accidentally enable changes to `vars`, `depends_on` or nested parameter lists. Today’s `InsertItem` creates a flat mapping, while `RemoveItem` already derives item-owned runs but refuses removal of the only item. Evidence: `crates/espansoconfig-core/src/patch/edit.rs:584`, `crates/espansoconfig-core/src/patch/edit.rs:788`, `crates/espansoconfig-core/src/patch/edit.rs:5196`.

3. **A typed scalar-sequence field insertion.** Add a distinct operation accepting a schema-known sequence key and a list of strings. Keep scalar `FieldInsert` scalar-only. Emit a new nonempty list in block style; an explicitly requested empty list uses `[]`, since an empty block sequence has no usable spelling. No caller-supplied YAML and no arbitrary mapping keys. The current scalar-only boundary is enforced by `FieldInsert.value: String` and the audit’s key whitelist. Evidence: `crates/espansoconfig-core/src/patch/edit.rs:349`, `crates/espansoconfig-core/src/draft/audit.rs:114`.

4. **An explicit trigger-switch intent.** Represent replacement of one trigger form by another as one intention planned against the original revision. Lower it to independent removal/insertion spans where possible. For a compact first entry, use a narrowly bounded field substitution that preserves the outer sequence dash and unaffected siblings. Do not weaken `FieldRemoval` merely to make switching pass.

The audit must grow with these operations. It must reject duplicate intents, insertion anchors removed by the same batch, editing a removed item, editing a newly inserted item through an original index, duplicate destination keys and overlapping replacements. Multiple additions at one boundary should become one ordered insertion group with its own verified expectation—not several zero-width edits whose order happens to work. Existing audit checks explicitly require original-tree dependencies and surviving anchors. Evidence: `crates/espansoconfig-core/src/draft/audit.rs:138`, `crates/espansoconfig-core/src/draft/audit.rs:343`.

Sequence verification must also translate original item positions to their resulting positions before checking edited survivors. Merely widening the enum is unsafe: today’s scalar verifier resolves the edit’s original path against the candidate, while item cardinality verification maintains a separate positional replay. Evidence: `crates/espansoconfig-core/src/patch/edit.rs:4320`, `crates/espansoconfig-core/src/patch/edit.rs:7248`.

Comment ownership remains the plan’s ownership rule. Removing an item removes its attached comments; file-owned comments and neighboring bytes remain identical. A switch preview must disclose any owned comments it removes. An uncertain seam produces a typed refusal, not reformatting. Evidence for the existing ownership implementation: `crates/espansoconfig-core/src/patch/edit.rs:799`; specification: `IMPLEMENTATION_PLAN.md:406`.

For the UI:

- **Single/Multiple/Regex:** editable when the selected fields are eligible.
- **Several:** show every form, select none as authoritative, and offer raw repair. Do not silently choose a winner or normalize it by saving another option.
- **Absent:** offer an explicit “Add trigger” choice when the key is genuinely absent and the mapping can accept it. An unsupported existing key is not absence.
- Switching requires a preview of the resulting definition and explicit confirmation. Single-to-multiple may seed one item. Multiple-to-single must not silently discard all but the first alias. Literal-to-regex must not claim equivalent behavior.
- Removing the final trigger item cannot leave an unnoticed null or silently remove the trigger side. Require another form or keep the draft incomplete and unsavable.

The existing validator identifies absent/several forms and treats those findings, plus invalid regex compilation, as editor-model errors. Evidence: `crates/espansoconfig-core/src/validate/mod.rs:756`, `crates/espansoconfig-core/src/validate/mod.rs:570`.

Edit regex as text and use the Rust save validator. Do not use JavaScript `RegExp` as a substitute. Phase 3 does not need a test bench or an additional debounce-validation command: validation on Save is sufficient for this cut, narrowing the debounce expectation at `IMPLEMENTATION_PLAN.md:479`. Report the localized failure and retain the draft. The finding establishes compilation under this crate’s regex version, not espanso’s runtime acceptance. Evidence: `crates/espansoconfig-core/src/validate/mod.rs:288`.

**Flow lists stay flow lists.** Existing scalar edits already support flow context; structural flow editing does not. Add delimiter-aware scalar-list operations in `3-3`, preserving retained tokens, comments and whitespace. Never convert `[a, b]` into block style to simplify insertion. Newly emitted scalars follow the existing conservative emitter, preferring single quotes when quoting is required. Evidence: `crates/espansoconfig-core/src/patch/edit.rs:1232`; specification: `IMPLEMENTATION_PLAN.md:431`, `IMPLEMENTATION_PLAN.md:456`. The committed flow fixture includes both multiline comments and `search_terms`, so these are immediate acceptance cases: `crates/espansoconfig-core/tests/corpus/synthetic/flow-collections.yml:13`.

### Q3 — Content side and options under D2u

**Ruling:** Extend the existing editor and its baseline/buffer protocol. Existing scalar-value editing is UI-led work; switching, multiple field insertion and recovery require the preceding core steps.

Existing `replace`, `markdown`, `html`, `image_path` and shorthand `form` values can use today’s scalar draft machinery. Refuse controls for undecodable text, real carriage returns, zero-width values, unsupported shapes and applicable hazards. Treat `Several` as an unresolved content-side conflict; display all values and offer raw repair. Treat genuine absence as an explicit add-content operation. Evidence: `crates/espansoconfig-core/src/draft/match_draft.rs:73`, `crates/espansoconfig-core/src/draft/plan.rs:815`, `src/lib/browser/matchEditor.ts:940`.

Content switching is allowed as one save intention, with an old-key/new-key preview and explicit confirmation. Preserve text unless the user edits it; do not perform HTML/Markdown conversion. Preserve unrelated `paragraph`, `vars` and `form_fields` bytes, while showing that they remain. A switch must not silently “clean up” companion fields.

Remove-plus-insert is not universally supported today. For example, removing the last visible anchor defeats the draft audit, and compact first-entry removal is refused. The targeted substitution and grouped-insertion work in `3-1` must cover these cases rather than hiding them behind a segmented control. Evidence: `crates/espansoconfig-core/src/draft/audit.rs:384`, `crates/espansoconfig-core/src/patch/edit.rs:1286`.

Shorthand `form` is editable layout text in Phase 3. Its `form_fields` structure remains read-only until Phase 4. Editing placeholders must not create or delete field definitions automatically. This preserves the separation between shorthand text and the synchronized builder promised at `IMPLEMENTATION_PLAN.md:760`.

All options remain textual:

- `word`, `left_word`, `right_word`, `propagate_case`, `force_clipboard` and `paragraph` get independent text controls.
- `uppercase_style` and `force_mode` may offer vocabulary suggestions using exact string comparison. The original text remains visible; an unfamiliar value is retained rather than coerced to a listed value.
- A closed picker that cannot represent existing text is unacceptable. An editable text control with suggestions is acceptable.
- Override `IMPLEMENTATION_PLAN.md:743`: use one **Insertion** group containing separately labelled `force_mode` and `force_clipboard` controls. Infer neither precedence nor equivalence, and perform no automatic legacy migration.

The model already carries every option as `ScalarView`, and its badge policy expressly permits vocabulary comparison while rejecting boolean inference. Evidence: `crates/espansoconfig-core/src/model/match_view.rs:297`, `crates/espansoconfig-core/src/model/match_view.rs:339`.

`label` and `comment` are scalar fields; `search_terms` uses the same sequence work as `triggers`. Show `paragraph` prominently for Markdown, but keep an existing value visible for other content kinds.

Distinguish the modelled scalar key **`anchor:`** from YAML **`&anchor`/`*alias` syntax**. The former may be edited as eligible text; that does not constitute a visual YAML-anchor editor. The latter stays under the hazard refusal and §13 deferral. Evidence: `crates/espansoconfig-core/src/model/match_view.rs:318`, `crates/espansoconfig-core/src/draft/match_draft.rs:108`; specification: `IMPLEMENTATION_PLAN.md:1162`.

Keep the plan’s intent groups: Matching, Discovery, Content, Variables and fill-ins, File and scope, Raw YAML. Expand the existing scalar field registry; add typed sequence and switch submodels inside the same editing session. Do not create an independent “advanced editor” with its own save/reapply rules. The existing registry drives baselines, reapply and retained-field presentation, while `matchDraftOf` explicitly marks the currently unsupported fields unchanged. Evidence: `src/lib/browser/matchEditor.ts:339`, `src/lib/browser/matchEditor.ts:1077`, `src/lib/browser/matchEditor.ts:1162`, `src/lib/browser/matchEditor.ts:2583`.

### Q4 — The per-snippet raw YAML escape hatch

**Ruling:** Build a new locality-preserving core edit for one snippet. Do not present a scrolled whole-document replacement as a snippet edit. Require a parseable, structurally bounded result.

The edit accepts a revision-bound match identity and exact replacement text. Rust derives the original range; the frontend never supplies authoritative byte offsets. The candidate must:

- Contain exactly one mapping item in the original sequence slot.
- Preserve the sequence’s other items, surrounding structure and stream shape.
- Preserve every byte outside the permitted replacement range.
- Preserve neighboring scalar values and ownership at both seams.
- Pass the ordinary save validation and acknowledgement protocol through `run_one_save`.

The whole-document `ReplaceText` mode explicitly carries no locality guarantee and never becomes a `DocumentEdit`. That distinction must remain. Evidence: `crates/espansoconfig-core/src/persist/save.rs:426`, `crates/espansoconfig-core/src/persist/save.rs:439`.

Use the **owned physical-line range**, including the sequence dash, attached leading comments and inline comments—not `MatchView.source_text`, which is only the mapping node slice. Evidence: `crates/espansoconfig-core/src/model/match_view.rs:399`, `crates/espansoconfig-core/src/patch/edit.rs:841`.

There is a necessary Phase 3 restriction: the owned range must be contiguous. Existing ownership can produce several runs separated by file-owned comments. Concatenating those runs into one textarea and redistributing edited text afterward would invent a mapping between old and new text. Refuse that shape for local raw editing and offer the explicitly labelled whole-document editor. Do not replace the hull and accidentally consume the file-owned holes. Evidence: `crates/espansoconfig-core/src/patch/edit.rs:439`, `crates/espansoconfig-core/src/patch/edit.rs:5083`.

Apply the carriage-return refusal to the complete snippet text entering the control, including its comments and terminators. A CR elsewhere in the document does not disqualify an LF-only snippet. Check eligibility, mutation input and submission; do not normalize, reindent or reconstruct submitted text. The wire carries the Rust-cut slice. Evidence for the existing normalization boundary: `CLAUDE.md:178`, `CLAUDE.md:184`.

A parse-rejected local snippet **cannot be saved through this edit**: without a successful document parse, it cannot establish the promised single-item boundary. The whole-document editor remains the repair route for unparseable text, with its content-addressed `DocumentDoesNotParse` consent. This preserves the owner’s ruling while narrowing the local editor’s contract. Evidence: `crates/espansoconfig-core/src/persist/save.rs:1237`, `crates/espansoconfig-core/src/persist/save.rs:1244`, `CLAUDE.md:163`.

Local raw editing may deliberately change unknown bytes inside the selected snippet. Its guarantee concerns the surrounding document, not preservation of every field inside the authored replacement. Permit syntactically bounded raw repair of unsupported constructs without applying the visual field whitelist; retain structural, seam and save validation checks.

**CF-55 is ruled here for both raw surfaces:** Undo and Redo must be disabled whenever their transitions refuse editing, including during saving and a displayed conflict. The current raw transitions already refuse mutation through `isEditable`; the current view derives `canUndo` and `canRedo` from history alone. This is an affordance mismatch, not evidence of a demonstrated mid-save mutation. Evidence: `src/lib/browser/rawEditor.ts:696`, `src/lib/browser/rawEditor.ts:738`, `src/lib/browser/rawEditor.ts:1852`. Fix both controls and test the transition and rendered disabled state under one held save.

### Q5 — `imports` and `_`-disabled files

**Ruling:** Deliver a file-scope inspector showing imports and explaining `_`-disabled status. Dedicated import editing, import resolution and enabling/disabling by rename are outside Phase 3.

Render all import entries in order, including unsupported entries and the distinction between absent and present-empty. Use source-text presentation and the sequence-presence metadata added in `3-2`. Keep import editing available through the existing whole-document raw editor, under that editor’s actual limitations.

The projection already carries import items, and the workspace mirror forwards them. The sidebar already says a leading-underscore file is not auto-loaded. Evidence: `crates/espansoconfig-core/src/model/document.rs:142`, `src/lib/browser/workspace.svelte.ts:703`, `src/lib/components/Sidebar.svelte:121`.

Do not equate “not auto-loaded” with “inactive”: the plan explicitly connects underscore-prefixed files to explicit inclusion. Evidence: `IMPLEMENTATION_PLAN.md:88`.

The repository authority says imports are paths and may be absolute; it does not establish sufficient resolution rules for relative paths, substitutions, cycles or effective inclusion. The synthetic fixture contains several spellings, but a fixture is not a resolver specification. Therefore show the paths without claiming their resolved targets or reading outside the workspace. Evidence: `IMPLEMENTATION_PLAN.md:99`, `crates/espansoconfig-core/tests/corpus/synthetic/imports-and-global-vars.yml:5`.

A later import editor needs a document-level closed draft surface and document-level conflict handling; it must not widen the match audit to reach top-level keys.

A rename is not a content save. Do not add a filesystem rename command under the pretext of `_` support, and do not emulate it through copy-and-delete. Plan §7’s “warn explicitly on rename” specifies a defense when renaming exists; it does not authorize bypassing the sole-writer boundary. Evidence: `IMPLEMENTATION_PLAN.md:621`, `CLAUDE.md:152`.

### Q6 — Unknown-field preservation, verified end to end

**Ruling:** Require conservation tests through the patch engine, save transaction and application command path. Scope the invariant to unknown entries outside the user’s explicitly edited raw region.

The proposed property must not say “every unknown entry survives every Phase 3 save.” A raw-snippet replacement may intentionally remove one. The correct property is:

> Every pre-existing unknown entry outside the explicitly authored raw replacement survives byte-identically and remains accounted for after a committed Phase 3 edit; a refused operation changes no file bytes.

For ordinary field, list, switch, creation and bulk operations, every pre-existing unknown entry is outside the intended edit.

Verify more than `value_text` equality. Assert key/value bytes, occurrence multiplicity, retained order, surrounding unedited bytes, and post-save coverage. Recompute coverage against the new syntax index; do not compare old and new node IDs as persistent identity. Entries without paths must participate through occurrence/span correspondence. Existing coverage balances key-node identities within one parse, and `RepeatedKey`/`NonScalarKey` deliberately lack paths. Evidence: `crates/espansoconfig-core/src/model/unknown.rs:94`, `crates/espansoconfig-core/src/model/unknown.rs:130`.

Tests need non-vacuous successful edits beside unknown data, plus refusals over hazardous shapes. Include nested unknown mappings, duplicate/non-scalar keys, Unicode before spans, comments, block scalars, mixed endings and absent final newlines. Deliberately corrupt a supposedly untouched region in the verification test and establish that the oracle fails.

Exercise the same cases through temporary synthetic files and the session methods that reach `run_one_save`, checking disk bytes, returned projection and refreshed application state. An engine-only property does not establish application-level preservation. `run_one_save` constructs the save request and owns post-save handling; the actual write calls `save_document` through its commit-recording gate. Evidence: `src-tauri/src/commands.rs:1830`, `src-tauri/src/commands.rs:1934`.

Unknown rows remain read-only in the structured inspector. Their entire Rust-sliced values are already available for display; that does not make nested keys independently addressable. The raw editors are the intentional editing route. Evidence: `crates/espansoconfig-core/src/model/unknown.rs:54`, `src/lib/browser/detail.ts:621`.

**R30 remains open.** A schema supplied by the owner may legitimately be vendored with version, provenance and redistribution terms recorded, followed by an offline differential field-list check. It is not a prerequisite for this phase and requires no fetch. Such a test would address schema coverage for that version, not resolve R16’s runtime-resolver uncertainty. The existing risk explicitly distinguishes the plan author’s verification from a repository test. Evidence: `PROGRESS.md:123`, `PROGRESS.md:133`.

### Q7 — Multi-select bulk edit against R25 and `run_one_save`

**Ruling:** Implement per-file atomic option batches, coordinated by one backend bulk command, with explicit partial-result reporting across files. Drop cross-file moves and post-save batch undo.

Replace the sentence at `IMPLEMENTATION_PLAN.md:808` with:

> All selected file candidates are checked before writing begins. Each file is then saved separately with its own revision check. A later failure can leave earlier files saved; the result lists what happened to every file.

Preflight is useful, but it is not a multi-file transaction. `SaveRequest` names one document context, and `save_document` locks, checks and writes that target. Evidence: `crates/espansoconfig-core/src/persist/save.rs:466`, `crates/espansoconfig-core/src/persist/save.rs:1204`.

Use a backend coordinator, not N frontend-driven ordinary match saves. It should:

1. Accept a closed bulk-option intent and full selected identities grouped by file.
2. Reject duplicate targets, stale identities and conflicting per-file revisions.
3. Prepare every file’s combined candidate without writing.
4. Return all blockers and acknowledgement requirements before starting.
5. Revalidate the submitted request and consent, then call the existing `run_one_save` once per file, sequentially.
6. Stop at the first conflict, refusal, failure or uncertain write. Preserve all prior results and mark later files not attempted.

Do not hold core path locks around `run_one_save`; that would reenter the save lock. Do not copy its cache policy. Evidence: `CLAUDE.md:152`, `src-tauri/src/commands.rs:1830`.

Every outcome must distinguish **saved**, **already unchanged**, **refused/conflicted**, **write outcome unknown**, **not attempted**, and **excluded before apply**. Once any write has been attempted, the coordinator must not discard preceding outcomes into an undifferentiated error. Transport loss requires reconciliation, not an assertion that nothing was written.

Use wording such as:

> Saved 2 files. The next file changed on disk, so the remaining 3 files were not attempted. The saved files have not been rolled back.

Do not say “nothing was written” unless the execution evidence establishes that for the whole request.

Other rulings:

- **Allowed fields:** precisely `word`, `left_word`, `right_word`, `propagate_case`, `uppercase_style`, `force_mode`, `force_clipboard`, following `IMPLEMENTATION_PLAN.md:803`.
- **Mixed:** compare presence and exact scalar source spelling, sliced in Rust. `true` and `yes` differ; absent and empty differ. Existing `ScalarView.text` is decoded textual content, not the original token, so a byte-spelling comparison needs an explicit Rust-produced slice. Evidence: `crates/espansoconfig-core/src/model/scalar.rs:30`.
- **Intent:** provide Unchanged, Set text and Remove. Mixed is display state, never a value sent to Rust.
- **Exclusions:** keep excluded rows visible in the review summary, with actual reasons. “3 of 7 skipped” must mean three were excluded before execution; it must not conceal save failures or claim every exclusion is a YAML hazard.
- **Move to file:** remove the row at `IMPLEMENTATION_PLAN.md:797`. D2r and R25 remain intact. Evidence: `CLAUDE.md:168`.
- **Undo:** one undo entry may restore the unsaved bulk draft. After application, no “Undo batch” claim. Override the post-save implication of `IMPLEMENTATION_PLAN.md:810`; restoring several files is separate revision-checked work.
- **Backups:** use and report the existing backup-session policy. Do not promise a fresh backup for every bulk apply: later writes in a session may legitimately return no new backup. Narrow the backup sentence at `IMPLEMENTATION_PLAN.md:810` accordingly. Evidence: `crates/espansoconfig-core/src/persist/save.rs:493`.
- **Selection:** retain full revision-bound IDs while they remain valid. On a changed projection, invalidate the affected selections and preserve the pending bulk intent for review; do not remap by index or arena node. Reselect before retry. Evidence for the identity boundary: `src/lib/browser/reapply.ts:781`.
- **External changes:** an affected file becomes blocked before apply when observed; a race during apply is caught by that file’s save revision check. Previously committed files remain committed.
- **Acknowledgement:** one screen may summarize N files, but consent remains partitioned by file, base revision, candidate and exact findings multiset. Changing an intent, selection or candidate invalidates the relevant consent. There is no batch-wide force bit.

### Q8 — Sidecar display names and per-file defaults

**Ruling:** Put sidecar format and I/O in a dedicated `src-tauri` module, confined to application storage. Treat it as optional app metadata, with defaults that affect future creation only after visible confirmation.

State the writer boundary precisely:

> `save_document` is the only writer of user espanso configuration contents. A separate application-metadata writer may write only the application-owned sidecar store; it accepts no arbitrary destination path.

This is an explicit app-storage exception, not a second route for writing YAML. The core remains Tauri-independent. Evidence for the existing architectural boundary: `CLAUDE.md:48`, `CLAUDE.md:152`.

Override “Deleting the sidecar loses display names and nothing else” at `IMPLEMENTATION_PLAN.md:847`. The specified sidecar also stores defaults and ordering. The accurate sentence is:

> Deleting the sidecar loses display names, ordering preferences and new-snippet defaults. Existing espanso configuration files are unchanged.

Use a versioned format. Derive the workspace filename from a stable cryptographic hash of a versioned, lossless encoding of the canonical workspace-root path. Compute file keys from lossless paths relative to that root. Do not use lossy display strings, lowercase paths or infer identity from filenames shown in the UI. Existing document paths are explicitly display-oriented `WirePath`s; mutation commands reject using them as target authority. Evidence: `crates/espansoconfig-core/src/model/document.rs:106`, `src-tauri/src/commands.rs:3176`.

Relative file keys do not make the root-path hash survive a workspace move. Phase 3 opens a fresh sidecar at a new root unless a later explicit transfer mechanism exists. Narrow the portability implication of `IMPLEMENTATION_PLAN.md:849`; do not silently search for and adopt another workspace’s metadata.

Corruption handling must have truthful outcomes:

- Successful quarantine: preserve the corrupt bytes under a unique name and initialize fresh metadata.
- Failed quarantine: leave the original untouched, use in-memory defaults, and report that preferences cannot presently be saved.
- Unsupported future schema: retain it and refuse rewriting it.
- Successful rename is reported only after it happened.

This makes “rename aside and start fresh” a checked operation rather than a guarantee in a comment, honoring `CLAUDE.md:141`.

Display names are user data and are not translated. Surrounding labels, errors and fallback states are translated. Show the real relative filename as a persistent subtitle and in the file inspector, including with long names and Spanish wrapping, as required at `IMPLEMENTATION_PLAN.md:853`.

Defaults cover exactly the seven bulk-option fields listed in Q7. Store optional textual values, distinguishing absence from an explicitly empty string; do not store booleans as the example at `IMPLEMENTATION_PLAN.md:839` does. Values are logical scalar text passed through the ordinary emitter, not YAML fragments or a promise to reproduce quote spelling. That distinction already exists in `NewMatch`. Evidence: `crates/espansoconfig-core/src/draft/new_match.rs:55`, `crates/espansoconfig-core/src/draft/new_match.rs:63`.

`NewMatch` must grow for the wider editor’s recovery requirements, using closed trigger/content alternatives and explicitly permitted optional fields and scalar lists. Defaults seed the creation draft once, are visibly listed before Create, and can be removed. They never modify existing snippets, never appear only at submission time, and never override a retained recovery draft.

Do not use the espanso-root watcher for sidecars. Reload metadata on workspace open and before a metadata mutation; publish successful local changes to the UI. Atomic replacement prevents partial JSON, while concurrent instances remain last-write-wins without a live synchronization promise. Keep orphan records for 30 days from an observed absence after a successful inventory; failed discovery is not evidence of deletion. Specification: `IMPLEMENTATION_PLAN.md:850`.

### Q9 — Cursor hint insertion

**Ruling:** Phase 3 adds a buffer-only “Insert cursor position” action for `replace`, inserting `$|$` at the caret or replacing the selected text. It adds no core edit.

Use the editor’s ordinary mutation and undo machinery, preserving focus and moving the caret after the inserted token. Browser selection offsets are appropriate inside the browser-owned string; they must never be used to slice a Rust byte span.

Do not offer this action for `image_path`, `html`, `markdown` or `form`. Plan §3 establishes cursor positioning specifically inside `replace`; it does not establish the same behavior for those other fields. Evidence: `IMPLEMENTATION_PLAN.md:116`, `IMPLEMENTATION_PLAN.md:132`. Their text remains freely editable without a runtime promise.

If `$|$` already exists, the insertion action should select that occurrence instead of adding another. If several already exist, preserve the text and show a localized editor advisory. Do not invent a blocking validator finding: the supplied domain authority does not establish multiple-marker semantics. A buffer warning is sufficient; no new `FindingCode` is owed.

The broader insertion popovers remain Phase 4 under `IMPLEMENTATION_PLAN.md:1124`.

### Q10 — i18n cost

**Ruling:** Budget roughly 125–200 new keys per language, delivered with their owning steps. Reuse existing field and kind labels; add typed accessors for every new state.

These are planning ranges, not measured additions:

| Step | New EN keys, each with an ES counterpart | Principal cost |
|---|---:|---|
| 3-1 | 6–10 | Grouped insertion and switch refusals |
| 3-2 | 8–12 | Sequence presence, cardinality and ownership refusals |
| 3-3 | 5–8 | Flow-list boundary refusals |
| 3-4 | 3–5 | Creation alternatives and bounded-shape refusals |
| 3-5 | 14–22 | Content switching, grouped options, cursor advisory |
| 3-6 | 12–18 | Trigger switching, list actions, recovery collisions |
| 3-7 | 7–11 | Raw-item boundary and verification refusals |
| 3-8 | 14–22 | Local raw scope, conflicts and fallback |
| 3-9 | 5–8 | Imports and file-scope explanation |
| 3-10 | 8–12 | Bulk request/result codes |
| 3-11 | 20–30 | Mixed states, exclusions, consent, partial outcomes |
| 3-12 | 10–16 | Sidecar read/write/quarantine/version states |
| 3-13 | 14–22 | Names, defaults and creation review |
| 3-14 | 0–2 | Mostly revisions to existing wording |
| 3-15 | 0 | Tests and records |

Add `browser.bulkEdit.*`, `browser.rawSnippet.*`, `browser.fileScope.*` and `browser.sidecar.*` families with `describe*` accessors in `codes.ts` and reactive wrappers in `index.ts`. New Rust error enums receive corresponding `code.*` namespaces and dictionary-contract registration. Existing field labels should not acquire parallel spellings.

The current Rust contract checks code namespaces, while frontend state accessors require their own enumeration tests. Evidence: `src-tauri/src/dictionary_contract.rs:10`, `src/lib/i18n/codes.ts:60`.

For R31, review each new `.ts` model’s public view values: codes and operands only, no assembled user-facing sentences. Enumerate each new state in accessor tests for EN and ES, and mount each new renderer’s relevant branches. Preserve the exact claim that the hardcoded-string scan checks markup only; it cannot certify those other layers. Evidence: `PROGRESS.md:128`.

Maintain a Phase 3 translation-review inventory containing every added or changed Spanish sentence, its key and its producer, with window evidence separately marked when available. Do not retroactively expand the historic 145-row inventory as though its old launches had drawn new text. That inventory is expressly a reading record, not a Spanish review. Evidence: `docs/decisions/2d-7-10-notes.md:200`, `docs/decisions/2d-7-10-notes.md:223`.

R35 remains the owner’s review before Phase 5; key parity and successful rendering do not close it. Evidence: `PROGRESS.md:131`, `PROGRESS.md:153`.

### Q11 — Window readings without an instrument

**Ruling:** Every new visible editing surface needs an owner-present window reading before its UI step closes. Backend-only steps may close driven. Mounted evidence is recorded as mounted evidence.

Owner-present readings belong to:

- `3-5`: scalar/content editor, option groups, cursor insertion and widened recovery.
- `3-6`: trigger/list controls and their conflict/recovery presentation.
- `3-8`: local raw editor and both raw surfaces’ Undo/Redo state.
- `3-9`: file inspector.
- `3-11`: bulk selection, review and partial-result inspector.
- `3-13`: sidebar names, filename subtitles and visible defaults.
- `3-14`: delete-panel wording and action placement.

Use synthetic workspaces only. Read EN and ES, explicitly selecting the language, including a live locale change on the new surface. Record window dimensions, action, observed state and the distinction between a screenshot and handler evidence.

A manual owner-present reading is the default. If deterministic timing or injected failure requires instrumentation, build a new, minimal, uncommitted instrument within the owning step’s scope and include it in that step’s one adversarial review before crediting its readings. Do not resurrect assumptions about the deleted instrument or create a separate review-of-fixes phase. The deletion and host constraints are recorded at `docs/decisions/2d-8-notes.md:30` and `CLAUDE.md:230`.

Steps `3-1`, `3-2`, `3-3`, `3-4`, `3-7`, `3-10`, `3-12` and `3-15` can close without a window. Their records should say:

> No window reading was performed or claimed. This step’s acceptance concerns core, command, model or contract behavior; its UI caller is named separately.

UI implementation can be driven, but a locked unattended session cannot satisfy its owner/window acceptance. No timer-based workaround earns that evidence. Evidence boundary: `CLAUDE.md:202`.

R38 is touched deliberately, not closed wholesale. Read a block-scalar content conflict in `3-5`, a commented multiline flow list in `3-6`, CR refusal and disjoint ownership in `3-8`, and read-only/excluded selections in `3-11`. Add Unicode and no-final-newline cases where the surface displays them. Record precisely which screen/action pair was observed; the remaining hard-fixture panel/refresh matrix remains open. Evidence: `PROGRESS.md:135`, `docs/decisions/2d-7-10-notes.md:566`.

### Q12 — The carried-forward items

**Ruling:** Assign CF-55 to `3-8`, CF-52 and CF-54 to `3-14`, leave CF-53 with the owner, and do not inherit the old unread matrix as Phase 3 work.

| Item | Disposition |
|---|---|
| **CF-55** | **3-8.** Align Undo/Redo affordances with mutation eligibility on both raw surfaces. Read the held-save state and the close control at the same instant before making a visual claim. |
| **CF-52** | **3-14.** Make delete-conflict actions reachable without scrolling past the diagnostic/source comparison, and read the result at 1180×728 in EN and ES. |
| **CF-53** | **Owner.** Retain the close/keep labels; the recorded owner judgment was “Clear enough,” with no requested change. |
| **CF-54** | **3-14.** Remove duplicated opening information after tracing each paragraph’s producer; preserve distinct facts about origin, pending action and disk state. |
| **2d-6 §7 item 1** | **No phase.** A cross-file citation checker is tooling work, not a dependency of match editing. Derive and correct citations in touched records without promising automated drift prevention. |
| **2d-6 §7 item 10** | **No phase.** Window-close disposal is lifecycle work requiring its own close/quit acceptance; Phase 3 does not change that path. |

Evidence for the recorded obligations: `docs/decisions/2d-7-10-notes.md:552`, `docs/decisions/2d-7-10-notes.md:568`, `docs/decisions/2d-7-10-notes.md:611`, `docs/decisions/2d-6-split-notes.md:932`, `docs/decisions/2d-6-split-notes.md:941`.

CF-1–CF-50 retain their existing no-phase dispositions; CF-51 retains its explicit owner/before-Phase-5 obligation. Do not describe that exception as unassigned. Evidence: `docs/decisions/2d-7-10-notes.md:496`, `docs/decisions/2d-7-10-notes.md:567`.

New surfaces nevertheless change the subject of some old rows:

- Wider recovery touches the shapes in CF-12, CF-14–CF-18 and CF-39–CF-40.
- New save surfaces touch held-state and acknowledgement shapes in CF-13 and CF-24–CF-25.
- Bulk selection/invalidation touches the shapes in CF-27–CF-30.
- The selected hard-fixture readings touch CF-50.

Test and read the new behavior in its owning step. Do not claim those historical rows closed unless the exact missing observation is actually supplied. The carried-forward table names those missing capabilities individually at `docs/decisions/2d-7-10-notes.md:517`.

### Q13 — R36, R37 and conflict/reapply under a wider editor

**Ruling:** No newly editable field may ship without complete draft retention, conflict comparison, reapply behavior and explicit recovery disposition. Keep one editor session and one identity/adoption protocol.

For each scalar field, update the registry, baseline extraction, buffer construction, intent derivation, commit rebasing, compare/copy presentation, reapply and recovery transfer in the same UI step. Adding a name to `EDITABLE_FIELDS` alone is insufficient: `matchDraftOf` and recovery creation currently contain explicit object constructions. Evidence: `src/lib/browser/matchEditor.ts:1162`, `src/lib/browser/recovery.ts:829`.

Retain `fieldIntent`’s distinction between absent-and-blank, present-empty and removed. Do not synthesize a missing key because a new control was mounted. Evidence: `src/lib/browser/matchEditor.ts:1133`.

For sequences:

- Baselines retain presence, shape, ordered items and revision-bound original positions.
- Newly drafted items use draft-local identities, never indices presented as cross-revision identities.
- Start conservatively: structural list reapply is allowed only when the target list’s relevant baseline is unchanged, or when the complete intended result is already present.
- Otherwise report a collision for the whole list. Do not guess correspondence among duplicate aliases or shift old item indices onto newly inserted disk items.
- Treat a trigger/content switch as a compound intent. Reapply all of it or none of it.

This extends the existing scalar policy, where any collision blocks the whole reapply. Evidence: `src/lib/browser/matchEditor.ts:2474`, `src/lib/browser/matchEditor.ts:2533`.

Grow `NewMatch` before exposing these fields. Use closed alternatives for trigger/content and bounded scalar-list fields, not a generic mapping or YAML payload. Recovery must carry every authored Phase 3 field, preserving absence versus empty. The current six-field limit exists specifically to prevent silently dropping editor buffers. Evidence: `crates/espansoconfig-core/src/draft/new_match.rs:21`.

Recovery remains creation from displayed fields, not duplication of the original snippet. Show which source-only structures—variables, form-field definitions, unknown entries and comments—are not transferred; require review of the actual new snippet. Do not apply destination defaults over retained recovery values. If a valid result cannot be created within the bounded type, retain/copy the draft and explain the unavailable creation path.

For R36, take the conservative rule: while any stale match draft remains open for a document, withhold move and other target-changing structural actions in that document until it is resolved. This may block more than one snippet, but it does not invent a cross-revision relation. Never use an arena-node lookup as a producer of replacement identity. The risk explicitly identifies that failure. Evidence: `PROGRESS.md:134`.

For R37, derive the rendered eligibility, choices and submission identity from one read of the current projection state in one synchronous block. Recheck that snapshot against live generations at confirmation. TypeScript does not enforce caller provenance; say that beside the guarantee and exercise inconsistent/stale inputs in tests. Evidence: `PROGRESS.md:137`, `CLAUDE.md:211`.

Continue using `conflictChoicesFor`, `adoptDiskVersion` and revision-checked correspondence. The current correspondence reader checks both revisions, then finds a unique row by full document/revision/node identity; it does not authorize weaker matching. Evidence: `CLAUDE.md:208`, `src/lib/browser/reapply.ts:688`, `src/lib/browser/reapply.ts:819`.

These obligations belong to `3-5`, `3-6`, `3-8` and `3-11` as their surfaces land. They are not postponed to the final test sweep.

### Q14 — What would falsify this plan

**Ruling:** Three observations would change the cut; none permits weakening byte preservation or inventing semantic certainty.

1. **The new compositional verifier cannot preserve surviving targets and seams across a mixed list batch.** A minimized synthetic counterexample involving removal, insertion and a surviving scalar edit would require splitting the failing structural capability into another numbered core step before exposing its control. Keep existing operations working and refuse the unsupported combination. Do not weaken overlap checks or accept verification against the wrong post-edit index. The existing separate positional replay and scalar-path verification make this a concrete risk. Evidence: `crates/espansoconfig-core/src/patch/edit.rs:4320`, `crates/espansoconfig-core/src/patch/edit.rs:7248`.

2. **A missing shape makes the chosen structural/raw boundaries unusably narrow.** Examples are ownership holes, complex flow comments or a field switch embedded in unsupported surrounding syntax. An owner-supplied shape description can be represented by a newly authored neutral synthetic fixture; real content is not an input to this consult or its tests. If the shape cannot meet the current operation’s contract, preserve the refusal and recut a narrowly scoped capability. Do not silently widen raw replacement from owned runs to their hull. The committed corpus already demonstrates ownership holes and commented flow lists. Evidence: `crates/espansoconfig-core/tests/corpus/synthetic/run-based-removal-envelope.yml:3`, `crates/espansoconfig-core/tests/corpus/synthetic/flow-collections.yml:16`.

3. **A planned control requires an espanso meaning the textual projection cannot establish.** Examples are collapsing legacy injection keys, presenting boolean defaults as enabled states, or treating a vocabulary suggestion as runtime validation. Remove that inference and retain text controls. Only independent resolver evidence could justify revisiting D2u; schema field coverage alone cannot. Evidence: `PROGRESS.md:123`, `crates/espansoconfig-core/src/model/scalar.rs:3`.

The compact-first-field removal and shared-insertion-anchor limitations are already observed facts, not future falsifiers. They are included in `3-1`.

### The step cut

Each step is one worker’s phase with one adversarial review. Fix its blockers, rerun the relevant verification and close it; no letter-suffixed review phases. This follows `CLAUDE.md:242`.

All steps may update their own notes, the split record and progress records. Any step changing a wire code also owns its IPC mirrors, `src-tauri/src/dictionary_contract.rs`, EN/ES dictionaries, `codes.ts`, reactive accessors and relevant tests. These contract changes belong with the capability, even when it has no production UI caller.

1. **3-1 — Compositional mapping edits and scalar form substitution**
   
   **Scope:** core `draft/{match_draft,plan,audit,error}.rs`, `patch/edit.rs`, related synthetic tests; contract/i18n maintenance.
   
   **Deliver:** ordered grouped field insertion; surviving-anchor planning; closed scalar-to-scalar trigger/content substitution that handles compact first entries without removing the outer dash.
   
   **Acceptance:** two absent options added in one save; `replace`→`markdown` in both key orders; `trigger`→`regex` on a compact first line; stale/removed anchors and duplicate keys refused; comments, sibling values and outside bytes checked independently.
   
   **Risk:** high. **Execution:** driven, core-first, no new production UI caller.

2. **3-2 — Sequence projection and block scalar-list edits**
   
   **Dependencies:** 3-1.
   
   **Scope:** core model/projection, draft/audit, patch verifier, synthetic fixtures; contract mirrors.
   
   **Deliver:** explicit list presence/shape/location; scalar-item insertion/removal; typed sequence-field insertion/removal; trigger switches involving block lists; original-to-result position verification.
   
   **Acceptance:** absent versus empty lists distinguished; multi-item insertion and removal beside a changed survivor; final-item handling explicit; owned comments removed only with their item; file-owned comments retained; wrong-surface requests rejected.
   
   **Risk:** high. **Execution:** driven, core-first.

3. **3-3 — Flow scalar-list cardinality**
   
   **Dependencies:** 3-2.
   
   **Scope:** core scalar-list planning/verifier and synthetic flow tests; refusal contracts.
   
   **Deliver:** delimiter-aware insertion/removal within flow scalar lists, including empty lists, without converting presentation.
   
   **Acceptance:** first/middle/last insertion and removal, multiline flow comments, trailing commas where accepted, Unicode and mixed quoting; retained tokens and outside bytes identical; ambiguous trivia refused by name.
   
   **Risk:** high. **Execution:** driven, core-first.

4. **3-4 — Bounded creation for the wider editor**
   
   **Dependencies:** 3-1–3-3.
   
   **Scope:** core `draft/new_match.rs`, bounded item insertion, creation validation; `src-tauri/src/commands.rs` and wire/contract tests.
   
   **Deliver:** typed trigger/content alternatives, optional Phase 3 scalar fields, `triggers` and `search_terms`; no arbitrary nested YAML.
   
   **Acceptance:** every supported form creates one item; absence and empty text differ; list order survives; arbitrary keys/collections cannot enter the creation surface; save still reaches the existing `run_one_save`.
   
   **Risk:** high. **Execution:** driven, core-first with command integration.

5. **3-5 — Scalar content/options editor and cursor action**
   
   **Dependencies:** 3-1, 3-4.
   
   **Scope:** `matchEditor.ts`, creation/recovery/reapply presentation, workspace coordination, `MatchEditor.svelte`, `MatchCreator.svelte`, `RecoveryPanel.svelte`, detail integration and i18n.
   
   **Deliver:** all eligible scalar fields, content switching, grouped textual options and cursor insertion; complete scalar recovery/conflict support.
   
   **Acceptance:** every added field survives save, conflict, compare, copy, reapply and recovery; absent blank fields emit no key; CR refuses at all boundaries; no boolean inference; switch confirmation and cursor undo work; EN/ES window reading includes a block-scalar conflict.
   
   **Risk:** high. **Execution:** UI-led over the existing scalar engine plus 3-1/3-4; implementation driven, closure needs owner.

6. **3-6 — Multiple/regex trigger and search-term controls**
   
   **Dependencies:** 3-2–3-5.
   
   **Scope:** sequence/switch submodels within the match editor, recovery and reapply, IPC integration, editor components and i18n.
   
   **Deliver:** list editing, trigger-form switching, Several/Absent presentation and conservative list reapply.
   
   **Acceptance:** block and flow lists retain style; additions/removals preserve intended order; regex failures retain text; no first-alias loss during conversion; external reorder/duplicate-list ambiguity refuses reapply; complete transfer or explicit recovery refusal; EN/ES window reading.
   
   **Risk:** high. **Execution:** driven implementation, owner for closure.

7. **3-7 — Local raw-item core edit**
   
   **Dependencies:** 3-1.
   
   **Scope:** core raw-item range/planner/verifier, save integration tests; new `src-tauri` read/save command adapters and wire contracts.
   
   **Deliver:** Rust-cut contiguous owned-range text and exact replacement through `SaveContent::Edits` and `run_one_save`.
   
   **Acceptance:** reject zero/two items, escaped indentation, changed siblings, bad parse and ownership holes; preserve BOM and bytes outside the range; check both block-scalar seams; refuse stale identity; deliberate inside-unknown edits allowed while outside unknowns survive.
   
   **Risk:** high. **Execution:** driven, core-first with command integration.

8. **3-8 — Local raw UI and CF-55**
   
   **Dependencies:** 3-7.
   
   **Scope:** new browser raw-snippet model/component, `rawEditor.ts`, `RawEditor.svelte`, workspace invalidation/reconciliation, detail integration and i18n.
   
   **Deliver:** local raw drafting, clear range/fallback wording, conflict retention, and consistent Undo/Redo eligibility on both raw surfaces.
   
   **Acceptance:** no JS byte slicing; CR blocked at load/edit/send; held-save Undo/Redo neither enabled nor mutating; successful save invalidates old identities; uncertain write retains text and requires reconciliation; EN/ES readings include contiguous, disjoint and CR cases.
   
   **Risk:** high. **Execution:** driven implementation, owner for closure.

9. **3-9 — File-scope inspector**
   
   **Dependencies:** 3-2.
   
   **Scope:** browser file-detail model, document/detail components, `Sidebar.svelte`, i18n; no new configuration writer.
   
   **Deliver:** ordered import display, absent/empty/unsupported states and accurate underscore-file explanation.
   
   **Acceptance:** every projected import is represented; unsupported entries remain visible; `_` means not auto-loaded rather than inactive; no invented resolution or rename control; EN/ES window reading.
   
   **Risk:** routine. **Execution:** UI-first over projection data; driven implementation, owner for closure.

10. **3-10 — Per-file bulk coordinator**
    
    **Dependencies:** 3-1, 3-5.
    
    **Scope:** bounded core bulk draft planning if needed, `src-tauri/src/commands.rs`, bulk request/result types, command/save integration tests and i18n codes.
    
    **Deliver:** all-file preflight, per-file consent and sequential single-save execution with complete result accounting.
    
    **Acceptance:** several matches and absent options share one transaction per file; a preflight blocker writes nothing; injected second-file failure preserves the first-file success; uncertainty stops later attempts; actual backup/no-op results remain visible; no force flag or nested path lock.
    
    **Risk:** high. **Execution:** driven, backend-first.

11. **3-11 — Bulk selection and inspector**
    
    **Dependencies:** 3-6, 3-10.
    
    **Scope:** browser bulk model, selection/workspace coordination, `SnippetList.svelte`, new inspector component and i18n.
    
    **Deliver:** multi-select, exact-text Mixed states, explicit intents, exclusions, consent review and partial outcomes.
    
    **Acceptance:** only the seven allowed options can be submitted; unchanged Mixed controls emit nothing; stale selections block; open drafts are respected; exclusions and execution failures have separate counts; draft undo works and no disk batch undo is promised; EN/ES window reading includes partial success.
    
    **Risk:** high. **Execution:** driven implementation, owner for closure.

12. **3-12 — Application sidecar store**
    
    **Dependencies:** no editor dependency; scheduled here to keep storage work bounded.
    
    **Scope:** new `src-tauri` metadata module, app-path setup and command adapters, storage/contract tests and i18n codes. No core Tauri dependency.
    
    **Deliver:** versioned workspace metadata, lossless path keying, atomic replacement, truthful quarantine, last-write-wins behavior and orphan retention.
    
    **Acceptance:** all writes remain beneath app storage; corrupt-file quarantine failure leaves bytes intact; future versions are not overwritten; interrupted replacement leaves valid old/new state; two-instance races follow documented last-write-wins behavior; relocation and 30-day orphan policy tested with controlled paths/time.
    
    **Risk:** high. **Execution:** driven, backend-first.

13. **3-13 — Display names and visible creation defaults**
    
    **Dependencies:** 3-4, 3-5, 3-12.
    
    **Scope:** browser sidebar/preferences/creation models, workspace integration, `Sidebar.svelte`, `MatchCreator.svelte`, preferences controls and i18n.
    
    **Deliver:** display names with persistent real filenames; seven textual per-file defaults visibly seeded into new-snippet drafts.
    
    **Acceptance:** every emitted default was shown before Create; removal suppresses its key; empty differs from absent; later preference changes do not alter an open draft; recovery values are not overridden; absent/corrupt sidecar leaves ordinary creation functional; EN/ES long-name window reading.
    
    **Risk:** high. **Execution:** driven implementation, owner for closure.

14. **3-14 — Delete-conflict wording and action placement**
    
    **Dependencies:** 3-5’s final editor layout.
    
    **Scope:** `MatchDeleter.svelte`, its actual message producers where necessary, component tests, i18n and records.
    
    **Deliver:** CF-52 and CF-54 resolution; CF-53 labels retained.
    
    **Acceptance:** at 1180×728, EN and ES, choices are visible before the long comparison; keyboard access and focus remain usable; repeated opening information is removed without losing a distinct fact; save-origin and external-origin panels are both read.
    
    **Risk:** routine. **Execution:** needs owner for layout acceptance; implementation can be driven.

15. **3-15 — Cross-layer preservation and Phase 3 closure**
    
    **Dependencies:** 3-1–3-14.
    
    **Scope:** synthetic property/integration tests across core and `src-tauri`, IPC/model integration tests, translation-review inventory and phase records.
    
    **Deliver:** operation-by-operation preservation evidence and a final scope statement matching what shipped.
    
    **Acceptance:** successful and refused cases for every new writer; unknown-byte and coverage conservation outside explicit raw edits; command-path disk and refreshed-projection checks; stale/uncertain/partial bulk outcomes; deliberately corrupted candidates fail the oracle. Complete the applicable serial Rust and frontend gates, derive module-count changes, record every required owner reading, and leave R16/R30/R35/R38 and untouched CF rows accurately bounded.
    
    **Risk:** high. **Execution:** driven; no new window claim and no new feature work.

