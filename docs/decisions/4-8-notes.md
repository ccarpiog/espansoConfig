# Phase 4-8 — Revision-bound snapshots and command integration

**Status:** implementation record for step 4-8 of [`4-split-notes.md`](4-split-notes.md) §2, under
rulings 10, 12, 14, 22 and 26 of §3, the consult's Q3, Q8 and Q9
([`phase-4-design.md`](../reviews/phase-4-design.md)) and `PROGRESS.md` D2r, D2v, R25 and R28.
Backend integration: **no Svelte component calls anything this step adds** (typed IPC wrappers only).
The step was **not cut**. No window reading was performed or claimed.

---

## 1. What changed and why

### 1.1 Core: `crates/espansoconfig-core/src/authoring.rs` (new module)

- **`AuthoringSnapshot`** `{ id, vars, form_fields, analysis }` — one match's baseline, cut from the
  revision its `MatchId` carries. `vars` and `form_fields` are **`ContainerBaseline`**s, the
  correspondence unit ruling 22 names (the *whole* container): `Absent {}`,
  `Present { text, fingerprint }` or `Uncut {}`. `text` is `source[value_span]` cut in Rust — for a block
  sequence the hull of its items, for a flow collection its brackets — and `fingerprint` is the hash of
  exactly that text in `ContentRevision`'s encoding. `Uncut` exists so a broken projection invariant (a
  span not on the source's character boundaries) is **reported**, never turned into an empty baseline
  that would compare equal to the wrong thing.
- **`AnalysisSummary`** — the wire shape of 4-7's `MatchAnalysis`, **span-free**: declarations
  (`index`, `name`, `kind`, `injection`, `usage`, `layout`), edges and missing dependencies by position,
  cycles, order advisories, form advisories (`form`, `field`), incomplete reasons, `scope_closed`,
  captures, the shorthand layout and its unverified `{{…}}` references (`name`, `subname`). A layout is a
  **`LayoutSummary`** of Rust-cut **`LayoutPiece`**s (`Text`, `Placeholder { name }`,
  `Malformed { text, reason }`, `Uncut {}`) that reproduce the decoded layout exactly.
- **`CandidateOperation`** — the one *inbound* type: `Draft { draft: Box<MatchDraft> }` or
  `VariableMove { variable, to: ListPlacement }`, `deny_unknown_fields`. `plan()` calls the writer's own
  planner (`plan_match_edits` / `plan_variable_move`).
- **`MatchCandidate`** `{ candidate, changes, findings, verdict, analysis }` and
  **`analyze_candidate`** — the save gate's findings pass over the candidate plus the match's analysis in
  it. **`authoring_snapshot`** and **`summarize`** complete the module.
- `persist/save.rs`: **`preflight_candidate`** / **`CandidatePreflight`** answer the candidate text
  beside the preflight; `preflight_edits` and it share one private body (`preflight_patched`), so the
  analysis and the bulk preflight cannot judge a batch differently.
- `analysis/`: the four enums that now cross derive `Serialize` (`IncompleteReason`, `Injection`,
  `EdgeKind`, `MalformedPlaceholder`), and so do `Usage`, `DependencyCycle`, `OrderAdvisory`,
  `FormSource`. For the uniform one-key-object wire rule, `IncompleteReason`'s four unit variants became
  `{}` struct variants and `FormSource` became `Variable { index }` / `Shorthand {}` (4-7's tests
  adjusted mechanically). `FormLayoutAnalysis` gained `text`, the layout it parsed, so a piece can be cut
  in Rust. 4-7 notes §3 item 9 ("the wire shape is 4-8's") is discharged here.

### 1.2 Tauri: three commands, one new error code

| Command | Kind | Path |
|---|---|---|
| `match_authoring_snapshot(id)` | reader | `with_workspace` → `match_by_id` (D2v) → `authoring_snapshot` |
| `analyze_match_candidate(id, operation, baseRevision, acknowledgement)` | reader | `analyze_one_candidate`: `document_at` + `match_by_id` (D2v) → `CandidateOperation::plan` (`draftRefused`) → `analyze_candidate` (`candidateRefused`) |
| `move_variable(id, variable, to, baseRevision, acknowledgement)` | **ninth writer** | `move_one_variable`: `document_at` + `match_by_id` → reapply request → `plan_variable_move` (`draftRefused`) → **`run_one_save`** |

- **`CommandError::CandidateRefused { error: SaveError }`** (`candidateRefused`): the preflight's own
  refusal (package file, engine refusal, reparse disagreement). Deliberately **not** `saveFailed`, which
  says a save was attempted and carries `may_have_written`; nothing is attempted on this path.
- **The widened `save_match`.** Its signature is unchanged — `MatchDraft` has carried
  `var_intents`/list/form intents since 4-4 … 4-6 — and what 4-8 adds is the command-level evidence
  (§2) and the documentation that stopped being true: its doc comment said "this command inserts nothing
  below the match mapping", which it now does through typed intents, one batch and one save.
- **`SaveTail`** (`commands.rs`): the single-save sibling of 3-10's `BulkSave`, the test seam of
  `save_one_match` and `move_one_variable`; production passes `run_one_save` from the two session
  methods. The source scan below pins those two call sites.
- `move_one_variable`'s reapply request: subject `ExactItem` (no trigger fallback — a reorder rewrites a
  whole container, and ruling 22 keys variable correspondence on the container, never on a trigger),
  placement `NotAnchored` (the match does not move), `at` = the match's own path.
- Registered in `main.rs`; the module headers of `commands.rs` and `main.rs` restate the counts
  (twenty-five workspace commands, nine writers).

### 1.3 Wire mirror, contracts, i18n

- `src/lib/ipc/types.ts`: every new type (`ContainerBaseline`, `AnalysisSummary` and its parts,
  `IncompleteReason(Name)`, `Injection`, `EdgeKind`, `MalformedPlaceholder`, `FormSource`,
  `LayoutPiece`, `AuthoringSnapshot`, `CandidateOperation`, `MatchCandidate`).
  `src/lib/ipc/commands.ts`: `matchAuthoringSnapshot`, `analyzeMatchCandidate`, `moveVariable`
  (JSDoc'd), `COMMAND_NAMES` 22 → 25. `src/lib/ipc/errors.ts`: `candidateRefused` (code list, interface,
  union, operand table, `identityRecovery` arm → `none`).
- `wire_contract.rs`: registry test 22 → 25 workspace / 23 → 26 total, writers 8 → 9 with the two new
  readers asserted as readers; the async-attribute scan 22 → 25;
  **`the_authoring_shapes_declare_exactly_what_rust_writes_and_reads`** (12 structs, every variant of
  four tagged unions — 22 payloads — three string unions and the inbound `CandidateOperation`);
  **`the_variable_reorder_writer_reaches_the_one_tail_and_no_lock`** (§2).
- `dictionary_contract.rs`: four new `CODE_ENUMS` namespaces (`incompleteReason` 13, `injection` 3,
  `edgeKind` 2, `malformedPlaceholder` 3), `commandError` 23 → 24; `FormSource`, `ContainerBaseline` and
  `LayoutPiece` on `NOT_A_CODE` with reasons.
- `dispatch_check.rs`: the three commands in the remote-origin sweep (23 → 26) and
  `the_authoring_commands_are_reachable_and_only_the_reorder_writes` through the real dispatcher.
- **i18n: 22 keys per language** — `code.commandError.candidateRefused` and 21 under the four new
  namespaces. `codes.ts`: `incompleteReasonKey`/`describeIncompleteReason`, `injectionKey`/
  `describeInjection`, `edgeKindKey`/`describeEdgeKind`, `malformedPlaceholderKey`/
  `describeMalformedPlaceholder`, registered in `CODE_NAMESPACE_KEY_BUILDERS`; reactive `tIncompleteReason`,
  `tInjection`, `tEdgeKind`, `tMalformedPlaceholder` in `index.ts`. No sentence interpolates an operand
  (the operands are positions; a screen places the sentence beside the declaration) and none claims how
  espanso evaluates a variable — `analysisCodes.test.ts` asserts both.

## 2. How each acceptance clause is met

Core: `crates/espansoconfig-core/tests/authoring_snapshots.rs` (8). Command level:
`src-tauri/src/commands/authoring_check.rs` (14), all on temporary synthetic files.

| Clause | Evidence |
|---|---|
| Stale identities and revisions refuse (D2v) | `a_stale_revision_or_identity_is_refused_before_a_reorder_is_planned` (the stale code wins over a planner refusal, so nothing was planned), `the_analysis_refuses_stale_input_and_names_what_it_could_not_judge`, `a_snapshot_is_cut_in_rust_and_refused_for_a_stale_identity`; dispatcher: `…only_the_reorder_writes` |
| A submitted span is never trusted (R28) | No new inbound type carries a span: `the_inbound_operation_carries_no_span_and_refuses_unknown_fields`; the one inbound span is an acknowledgement's, compared as a multiset: `an_acknowledgements_span_is_compared_and_never_trusted` (a well-ordered but different span does not commit; an inverted one is refused at deserialization); no outbound snapshot key holds a span: `the_summary_is_positions_and_rust_cut_text_never_a_span` |
| Every writer reaches `run_one_save`, none takes a second lock | `both_writers_reach_the_one_tail_holding_no_path_lock` (a probing tail takes the path lock from another thread under a 10 s bound, then runs the real `run_one_save`; reached exactly once per writer), `the_analysis_takes_no_path_lock` (returns while another holder has the lock), `the_variable_reorder_writer_reaches_the_one_tail_and_no_lock` (source scan), `a_committed_reorder_records_only_the_revision_it_committed` (the app-write record, which only `run_one_save` takes) |
| Atomic content-plus-variable save | `a_content_edit_and_a_new_variable_commit_together_or_not_at_all` (together: one commit, both present; with a duplicate-named variable: `draftRefused`, file byte-identical — the content edit is not written alone) |
| Acknowledgement round trip | `the_acknowledgement_round_trip_runs_from_the_analysis_to_the_save` (analysis finds `VariableDependencyCycle` bound to its candidate revision; the unacknowledged save is refused with the same multiset; consent from the analysis commits, and the committed revision **is** the analysed candidate); core twin `a_candidate_is_judged_by_the_saves_own_findings_and_its_consent_commits_it` |
| No-op | `a_no_op_is_no_change_in_the_analysis_and_no_commit_in_the_save` (`changes: false` at the base revision; `committed: false`, no backup, identity still valid); `a_reorder_the_planner_refuses_writes_nothing` (`VariableMoveChangesNothing` and three other refusals, no transaction, no backup folder) |
| Uncertain outcome | `an_uncertain_outcome_is_an_error_that_says_it_may_have_written` (see §3 decision 6 for what the seam can and cannot show) |
| Snapshots are Rust-cut and revision-bound | `a_snapshot_cuts_each_whole_container_in_rust` (non-ASCII before the span, a comment inside the hull, absent / flow-empty / block), `a_crlf_container_keeps_its_carriage_returns` |

**Failing-first evidence, by mutation** (git was not used): ten mutations of the new checks, each
applied, run and restored byte for byte by `/private/tmp/4-8/mutate.py`; outputs
`/private/tmp/4-8/mutation-*.txt`, summary `mutation-summary.txt` and `mutation-summary-m6.txt`. Every one
failed a test (a panic, not a build error): M1 reorder skips the revision check, M2 analysis skips it,
M3 snapshot cuts the key span, M4 fingerprint of the whole file, M5 analysis judges the original, M6 the
reorder takes a real second path lock (the probe times out), M6b it merely names one (the scan), M7
`CandidateOperation` reads unknown fields, M8 a candidate refusal reported as `saveFailed`, M9
`save_match` hands a closure instead of `run_one_save`.

## 3. Decisions

1. **One analysis command for both operations** (`CandidateOperation`), planned by the writers' own
   planners, rather than one analysis command per writer.
2. **`candidateRefused`, a new command error**, rather than reusing `saveFailed` (§1.2).
3. **The container text is the value's span only** — not the key line and not comments trailing the
   hull (see §5 item 1). Chosen because it is what the projection names exactly; a wider "owned run"
   baseline is not defined for a container anywhere in the engine yet.
4. **Positions, not names, on the wire** for missing dependencies and edges; names appear only where
   the projection already shows them (a declaration's `name`, an advisory's `field`). Ruling 14 allows
   file-supplied names; the consult prefers positions where a name is unnecessary.
5. **The analysis enum wire shape was changed in place** (struct variants) rather than mirrored by
   wire-only twins, so one declaration is both the analysis type and the dictionary namespace.
6. **The uncertain outcome is driven through a seam.** No filesystem can be made to produce a
   may-have-written failure on demand, so `SaveTail` lets a test run the real `run_one_save` (which
   commits) and then answer with a fabricated `VerificationFailed` write error. What that shows: both
   writers hand the outcome on as an `Err` whose wire form says `may_have_written: true`, never as a
   success or a refusal, and the session no longer serves the old revision. What it does **not** show:
   `run_one_save`'s own uncertain arm (eviction, re-observation) driven by a real failure through the new
   writer — that arm is covered only by the existing direct test
   `an_uncertain_write_evicts_the_parse_and_asks_for_a_re_observation`.
7. **The seam was added to `save_one_match` as well**, so the widened `save_match` gets the same tail
   and uncertain-outcome evidence as the new writer.
8. **`CandidateOperation::Draft` boxes the draft** (clippy `large_enum_variant`); the wire form is
   unchanged.

## 4. What is and is not guaranteed

- **Guaranteed by types:** nothing in `authoring` derives `Deserialize` except `CandidateOperation`, whose
  arms hold a draft and positions only, so no command added here can accept a span, a snapshot or a
  fingerprint back (R28). A refusal of the new error carries a `SaveError` and nothing written.
- **Guaranteed by construction, pinned by tests but not by the compiler:** that production passes
  `run_one_save` as the `SaveTail` (two call sites, scanned); that no Phase 4-8 body names a lock or write
  primitive (a fixed-vocabulary scan — a primitive reached under another name is not seen); that the
  analysis and the save judge one candidate identically (one shared private body, and the round-trip
  test).
- **Not guaranteed: that consent stays with the candidate it was collected for.** An acknowledgement
  is matched by finding equality only. Five codes carry the candidate's revision
  (`DocumentDoesNotParse`, `DuplicateKeepsTriggerDefinition`, `NewMatchRepeatsLiteralTrigger`,
  `VariableDependencyCycle`, `DependencyHasNoDeclaration`) and cannot be spent on another candidate;
  every other finding — `ReferenceHasNoDeclaration` among them — is accepted by any later candidate that
  produces an equal finding, a different draft included (§7). A caller must discard consent whenever the
  draft changes; nothing in Rust or TypeScript forces it to.
- **Not guaranteed:** that the TypeScript mirrors are complete beyond what `wire_contract.rs` samples
  (hand-written); that a caller compares snapshots correctly (4-9's); anything about how espanso reads
  a reordered `vars` or evaluates the graph (R16, R30). A candidate analysis is a prediction about text
  the session holds: the save re-reads under its lock, and a file that moved on is a conflict there.

## 5. Open items noticed, not fixed

1. **A change outside a container's value hull is not a container change** for `ContainerBaseline`: the
   key's own spelling, a comment after the last item, or a trailing comment on the key line. 4-9 must
   decide whether its reapply needs a wider unit (the engine's owned runs) before relying on it.
2. **`FormAdvisorySummary` drops the site** of the `{{form.field}}` reference (which scalar); a UI that
   points at the reference needs it added (by field path, never by span).
3. **The candidate analysis costs a third projection** of the candidate (the preflight projects it, the
   variable findings project the original, the analysis projects the candidate again). Not measured.
4. **The candidate's match is found by path**: an operation that relocates the match would get
   `analysis: null`. None of the two planned operations does.
5. **`move_variable`'s conflict payload** carries an `ExactItem` subject only; nothing compares the
   `vars` container across the conflict (ruling 22 is 4-9's).
6. **A stale doc sentence** on `Open::backups` (`commands.rs`) still says every save goes through
   `move_match` or `save_match`; true of neither since 2b-2c. Not in this step's scope.
7. **No sentence has been read on a window**; the 22 new keys per language join the Phase 4 translation
   inventory (4-24).
8. `rustdoc` intra-doc links from `authoring.rs` were not built (not a gate).

## 6. Gate and rung

All exit 0, run serially, outputs under `/private/tmp/4-8/`: `cargo test --workspace -- --test-threads=1`
(`cargo-test.txt`), `cargo clippy --workspace --all-targets -- -D warnings` (`clippy.txt`),
`cargo fmt --check` (`fmt-check.txt`), `npm run check` (`npm-check.txt`: 488 files, 0 errors, 0
warnings), `npm test` (`npm-test.txt`), `npm run build` (`npm-build.txt`); bundle oracle — server-only
pattern absent (rg exit 1), client-only present (2); `cargo tree -p espansoconfig-core | rg tauri` finds
nothing (`cargo-tree.txt`).

Rung **`1726 / 488 / 4092 / 214`** (was `1701 / 487 / 4086 / 214`): +25 Rust tests (8 core, 14 command
level, 2 wire contract, 1 dispatcher); +1 `svelte-check` file (the new `analysisCodes.test.ts`); +6
vitest tests (3 in `analysisCodes.test.ts`, 2 in `commands.test.ts`, 1 from an existing parameterised
suite widened by a table this step extended, not traced further); Vite modules unchanged — no new module
enters the bundle (types, wrappers and accessors were added to existing modules).

## 7. Review fix

The adversarial review ([`docs/reviews/4-8.md`](../reviews/4-8.md)) returned `ship-with-fixes` with
one SHOULD-FIX: **the new Rust and TypeScript contracts claimed that consent could not transfer between
candidates, which is false.** `MatchCandidate`'s documentation said every finding carried the
candidate revision "where its code binds one, so consent … cannot be spent on another candidate";
`analyzeMatchCandidate`'s said consent "is spent by the save of **this** candidate only". But
`ReferenceHasNoDeclaration` carries no revision and `Acknowledgement` keeps only finding identities, so
consent for candidate A is accepted for a different draft B that produces an equal finding.

**Fix (documentation, not behaviour):** every such sentence now says what is actually bound — the five
revision-carrying codes are candidate-bound, every other finding is not — and that callers must
invalidate consent whenever the draft changes, which nothing in Rust or TypeScript forces:
`MatchCandidate` in `crates/espansoconfig-core/src/authoring.rs`, `analyze_one_candidate` in
`src-tauri/src/commands.rs`, `MatchCandidate` in `src/lib/ipc/types.ts`, `analyzeMatchCandidate` in
`src/lib/ipc/commands.ts`, the core test header in `tests/authoring_snapshots.rs`, and §4 above.

**Regression pinning the behaviour:** `consent_for_an_unbound_finding_transfers_between_candidates`
(`src-tauri/src/commands/authoring_check.rs`) takes an acknowledgement from candidate A's
`ReferenceHasNoDeclaration` and shows `save_match` committing a different draft B with it — the committed
revision is B's candidate. It passes on this tree by design: it records the current, documented
behaviour, and a later step that binds consent to the whole candidate must change it deliberately
(open item for 4-9, whose variable editor collects and holds consent).

Gate after the fix, outputs in `/private/tmp/4-8/fix/`: see the report of this fix round.

