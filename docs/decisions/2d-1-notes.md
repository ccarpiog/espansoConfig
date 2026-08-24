# Phase 2d-1 — the core observation engine, with no caller

**The observation side of plan §6.5, built in `espansoconfig-core` alone, with nothing calling
it.** `crate::watch` grew from `ContentRevision` alone into three modules: `watch/engine.rs` is the
engine — hints in, typed observations out, with the clock and the reader injected; deterministic in
observation shapes, revisions and order, with the identity values qualified as §2.2 states —
`watch/correspond.rs` is the snapshot-bound correspondence table a `Changed` observation carries,
and `watch/native.rs` is the `notify`-backed hint source, confined to that file exactly as
`saphyr-parser` is confined to `crate::syntax`. This is the project's established
primitive-before-caller cut: no command reaches any of it, exactly as `persist::save_document` had
none at 2a.

The consult is `docs/reviews/phase-2d-design.md`; **Q7 item 1** is this step's specification, **Q1**
rules the watcher's home and the engine's determinism, **Q2** rules the suppression predicate's
shape and the watch scope, and Q7's closing paragraphs rule what the corpus fixtures and the real
corpus may be used for. Where the consult and plan §6.5 disagree — the plan's step 6 says "no dirty
draft" — the consult wins, and none of that phrase's machinery is in this step anyway: steps 6 and 7
are frontend phases (2d-5, 2d-6).

**No Tauri, no command, no Svelte, no i18n and no save path was touched.** `git status --short
--untracked-files=all` shows changes only under `crates/`, `Cargo.lock`, the workspace root
`Cargo.toml` and this record. The root `Cargo.toml` touch is one dependency declaration
(`notify = "8"`, resolved to 8.2.0) in `[workspace.dependencies]`, where the workspace's own rule
puts every pinned version — the same shape as `regex` at 2a-2a and `libc` at 2a-3a.

---

## 1. What this step built

- **`crates/espansoconfig-core/src/watch/engine.rs`** — `Millis` (the injected clock's instant),
  `EngineConfig` (validated timing), `ReadOutcome`, the `WatchSource` trait with its production
  `FsWatchSource`, `StableContent`, `Observation`, and `ObservationEngine` itself: `start` (the
  baseline scan), `hint`, `tick`, `rescan`, `next_deadline`, and the observability accessors
  `tracked_paths`, `pending_paths`, `revision_of`, `snapshot_of`.
- **`crates/espansoconfig-core/src/watch/correspond.rs`** — `CorrespondenceTable`,
  `CorrespondenceEntry` and `correspondences_between`, on `crate::reconcile`'s public evidence API.
- **`crates/espansoconfig-core/src/watch/native.rs`** — `NativeWatch`, `NativeSignal`,
  `NativeWatchError`. The only module in the crate that may import `notify`.
- **`crates/espansoconfig-core/src/watch/mod.rs`** — the module docs rewritten (the watcher is no
  longer "a later phase"), `watched_roots()` and `self_write_suppresses()`.
- **`crates/espansoconfig-core/src/discovery.rs`** — `classify_path` (public, filesystem-free) and
  `has_yaml_extension` widened to `pub(crate)`, so the engine classifies and filters with the walk's
  own rules rather than a second copy of them.
- **`crates/espansoconfig-core/src/workspace/mod.rs`** — `identity_of` widened to `pub(crate)`, so
  the engine's projections carry the same process-wide path identities a `Workspace` resolves.
- **`crates/espansoconfig-core/tests/watch_engine.rs`** — 31 deterministic scenario tests over an
  injected `FakeTree` (30 at first submission; the torn-baseline test is the round-1 fix's, §6),
  plus the two corpus sections.
- **`Cargo.toml` / `crates/espansoconfig-core/Cargo.toml` / `Cargo.lock`** — the `notify`
  dependency, with its confinement documented at both declaration sites.
- **`crates/espansoconfig-core/src/lib.rs`** — the 2d-1 phase-status entry, and the closing
  sentence corrected: `watch` no longer "holds only `ContentRevision`".

---

## 2. The decisions

### 2.1 D1 — the engine owns plan §6.5's steps 1, 2, 3 and 5, and deliberately not 4, 6 or 7

Consult Q1. Debounce, stability, exact hashing, and projection/validation are facts about a
directory and are here. Step 4 — *ignore if the hash equals the revision the app just wrote* —
compares against a ledger only the open application session can hold, so what this step defines is
the **predicate's one shape**, `self_write_suppresses(last_committed, observed)`, and no ledger.
The predicate compares two bare revisions, **so its guarantee is conditional in the same sentence
that states it** (the round-1 review's second Medium): it answers byte identity only when the
caller hands it the latest committed revision recorded for the *observed document* in the *current
workspace epoch*, and handed an equal-hashing entry from another document, a replaced workspace, or
a superseded save it suppresses just the same — correct document/epoch/latest-entry selection is
the **caller's obligation**, owned by 2d-3's ledger: recording `SavedDocument::revision` on
`committed: true`, retention through duplicate hints, replacement on the next committed save and
discard on workspace replacement, all beside the session. The predicate's doc comment carries Q2's
exact truthful sentence — *this proves the text is identical, not who wrote it* — with the same
caller obligation stated in its own guarantee sentence, and states what may never be claimed on it:
not that the event "was ours", not that no external write occurred, not that metadata stayed
unchanged. Steps 6 and 7 (automatic reload, conflict) are frontend transitions (2d-5). Sequence
numbers and workspace epochs are likewise absent: they are facts about a session, and this engine
is a fact about a directory.

### 2.2 D2 — determinism in shape by injection: the clock and the reader are arguments, one tick takes one read per path, and identity values come from the process-wide session table

`hint(path, now)` records and never reads. Every hint-driven read happens inside
`tick(now, source)`, **at most one read per path per tick**, so the two stability reads are always
two tick calls — their separation is real wall-clock time under a real caller and two injected
instants under a test, never a loop the engine ran by itself. Observations come out in path order
(the pending table is a `BTreeMap`), so one input schedule produces one output sequence **of
observation shapes** — kinds, revisions, order, texts, findings and correspondence rows are fixed
by the schedule alone — while the `DocumentId` and `MatchId` *values* inside a projection come from
the process-wide session identity table (`identity_of`, `workspace/mod.rs`) and therefore also
depend on which paths anything else in the process identified first (the round-1 review's first
Medium: the unqualified sentence claimed more than the code gives). The registry was **kept rather
than made injectable**, because D7's cross-module agreement is the point of it — the id the
engine's snapshot carries must be the id a `Workspace` of the same process resolves for that path,
and an injected scoped table would either break that agreement or reintroduce it as a threading
obligation on every caller; the smaller honest fix — narrowing this sentence and the module's own
doc sentences (`engine.rs` module docs and `tick`) — is what was chosen. **What Rust forces**: no
code path in the engine can reach a real timer, and no read happens outside an injected
`WatchSource` — the types leave nowhere to hide one. **What it does not force, said in the same
breath**: that a caller's `now` values are monotonic (the engine trusts them; a backwards clock
finds nothing due), and that the caller keeps ticking until `next_deadline()` is `None` — a caller
that stops has pending paths and no observations, not wrong ones.

### 2.3 D3 — trailing-edge debounce inside a *validated* 150–300 ms band

`EngineConfig::new` refuses a debounce outside plan §6.5's band (`DebounceOutOfBand`) and a zero
probe interval (`ProbeIntervalZero`); the default is 200/40. The band is a constructor check rather
than a comment, because a comment is the one form of the rule nothing can fail. The debounce is
trailing-edge — every hint pushes the path's deadline out, and a hint during probing restarts the
debounce, because a fresh hint means fresh writes and a stability attempt over moving bytes proves
nothing worth keeping. **The stated cost**: a file written continuously never stabilizes and never
produces an observation — and no observation about it would be honest while it is still being
written (§5 item 4).

### 2.4 D4 — stability is two equal consecutive outcomes, and equality covers absence and failure too

An outcome is `Present(bytes)`, `Missing`, or `Failed(kind)`, and two consecutive outcomes must be
**equal** — same bytes, same absence, or same failure kind — before anything settles. That single
rule is what makes partial writes, transient deletions and transient read errors all invisible: a
half-written read is followed by an unequal full read and becomes the new first read; a file
deleted and recreated identically inside one window stabilizes to its tracked revision and
coalesces; a read error the next probe does not reproduce never becomes an `Unreadable`. The
stabilized bytes are hashed exactly — `ContentRevision::of_bytes` over what was read, no decode, no
normalization — and a trailing-newline difference is a change, which the suite pins.

### 2.5 D5 — the coalescing rule, and its two deliberate exceptions

A path that stabilizes to its tracked content state emits nothing: a byte-identical rewrite is not
a content observation. Two cases override revision equality, each with its reason written at the
type:

- **recovery after an emitted `Unreadable` is `Changed` even at equal bytes**, because the
  observation it supersedes is the `Unreadable`, not that content. Equal revisions there mean
  *readable again, bytes as before*, and `previous_revision` is the last stable content revision,
  retained across the interlude — the one case where it can equal the new content's revision, and
  the doc comment on `Observation::Changed` says exactly that;
- **recreation after an emitted `Removed` is `Added` even at equal bytes**, because file membership
  changed (consult Q3's ruling verbatim). A deletion and recreation inside one debounce window is
  neither: no absence ever stabilized.

### 2.6 D6 — non-UTF-8 is a typed content state here, not the workspace's refusal

`Workspace` refuses a non-UTF-8 file as `WorkspaceError::NotUtf8` because its callers asked for
text. The engine's callers asked *whether the file changed*, and a watcher that went silent about a
file would be claiming it did not change — so stable non-UTF-8 bytes are
`StableContent::NotUtf8 { revision, offset }` inside a `Changed` or `Added`: hashed exactly, never
decoded lossily, membership and revision intact, and no projection and no correspondences (there is
nothing to anchor from or to). The recovery to valid UTF-8 is a `Changed` from that revision. The
difference from the workspace's behaviour is documented at the variant, not discovered.

### 2.7 D7 — one identity table, one classification rule, and both were widened rather than copied

The engine projects through `workspace::project_source` — the same source-to-document path a
workspace read uses — which needs a `DocumentContext`, which needs an identity. `identity_of`
became `pub(crate)` so the engine mints from the **same process-wide path table** a `Workspace`
does: the id the engine's snapshot carries for a path *is* the id any workspace of the process
resolves for it, with no mapping layer to disagree. A recreated path therefore keeps its identity —
the table is keyed by path for the life of the process, no other file can inherit it — and the
suite pins that across a `Removed`/`Added` pair. Classification went the same way:
`discovery::classify_path` is new and public so a hint-born file gets the kind, `disabled` flag and
relative path a directory walk would have given it, and `has_yaml_extension` is `pub(crate)` so the
hint filter and the walk cannot disagree about what a YAML file is **by name**. The round-1 review
(a High) found the other half of the agreement missing: the walk accepts an entry only when
`symlink_metadata` says it is a regular file (`discovery.rs`), while `FsWatchSource::read` followed
symlinks — so a `.yml` symlink inside `match/` could read and emit content from outside both
watched roots, and a directory named `*.yml` became an `Unreadable` observation. `FsWatchSource::read`
now applies the walk's own predicate first and answers `Missing` for any non-regular entry, the
`WatchSource` trait doc states that contract in the same sentence as the admission that Rust cannot
enforce it on an injected implementation, and the suite pins both shapes
(`a_yaml_symlink_inside_a_watched_root_never_reads_outside_content`,
`a_directory_named_like_a_yaml_file_is_absent_not_unreadable`). The round-2 review found that fix
was only the final component's half of the walk's acceptance, and that a **production route does
name a path through a symlinked intermediate directory**: `rescan` re-hints every *tracked* path,
so replacing an ancestor directory of a tracked file with a symlink made the re-hinted read follow
the intermediate symlink and emit content the walk excludes. The fix chosen — over re-deriving
`rescan`'s hints from the walk alone, which would leave a vanished subtree tracked forever and
would still not close the shape for a hint from any other source — makes the engine's admission
and discovery's acceptance **one predicate applied the same way, on every read route**:
`WatchSource::read` now takes the engine's root, and `FsWatchSource` accepts a path only when it
lies under a watched root, its part below the root is plain names, every intermediate entry is a
real directory by `symlink_metadata` — the walk's own per-entry check — and the final component is
a regular file. What the walk cannot reach, the read answers `Missing` for, so the re-hinted path
stabilizes as absent and emits `Removed` — the walk's own membership answer — and never the
outside bytes. Pinned by `a_rescan_never_reads_through_a_newly_symlinked_ancestor` (`engine.rs`,
`#[cfg(unix)]`), run against a final-component-only read and failed. **What is not forced**:
nothing stops a future caller building a `DocumentContext` by hand with a foreign id —
`project_source` is public and always was; an injected `WatchSource` implementation is trusted
with the read contract (the trait doc states that in the same sentence); and each check and the
read are separate calls, so a swap between them can still be read through — two stable reads
narrow that window, nothing closes it.

### 2.8 D8 — the watch scope is one definition, and the backup root is excluded by construction

`watched_roots(root)` returns exactly `<root>/config` and `<root>/match`, and both the native
adapter and the engine's hint filter consume it — consult Q2's ruling that watching the
configuration root recursively would buy a proof burden over every backup temporary, marker and
rotation for nothing. The engine's `hint` drops anything outside those roots or without a
`.yml`/`.yaml` extension: the backup root is a *sibling* of both, a save's temp file is
deliberately not named `.yml` (plan §6.6's `_x.yml.espansoconfig-<random>.tmp`), and the suite
drives all of it, the rename-away `.bak` included.

### 2.9 D9 — the correspondence table answers both policies against one snapshot, and a placement is the exact answer

`correspondences_between(base, fresh)` builds one row per match of the base projection, each
answered at **both** of `reconcile`'s confidence policies against the **same** `fresh` reference:
`exact` (`ExactItem`) is the only tier a delete, a move or a duplicate may act on **and** the exact
placement correspondence — a `PlacementMode` has no confidence parameter, so a separate placement
column would be a second copy of the same value, and the field's doc comment says both uses in one
sentence. `editor` is the match editor's flexible tier, and where it answered below the exact one it
is provisional correspondence, not proof the original item remains. The table is bound to both
revisions (`base_revision`, `disk_revision`), so a consumer holding an observation with a different
disk revision can refuse evidence about a state it was not shown (consult Q5). **No
`ReapplyAnchor` is stored or crossed** — anchors are captured inside the build and dropped there;
the serialization test asserts the wire form carries no digest field. A base whose anchor cannot be
captured gets two `Refused` rows rather than being skipped, so the row count always equals the base
match count; a base that did not parse yields an **empty table, not a missing one** — a failed
projection carries nothing to find again, and that is an answer. The engine attaches the table
whenever it holds a previous projected snapshot and the new content projects; the pre-error
snapshot is retained through an unreadable interlude precisely so a recovery still carries one.

### 2.10 D10 — the native adapter forwards hints and degradation, and interprets nothing

`NativeWatch::start(root, sink)` watches the two roots recursively and forwards every event's
paths as `NativeSignal::Hints`; a backend error becomes `NativeSignal::Degraded` with diagnostic
text for a log line only — it never crosses the IPC boundary, which carries codes, and the caller
acts on the *fact* of degradation by scheduling rescans. Nothing reads `notify::EventKind`: an
event kind is a claim about what happened, the engine re-derives what happened from reads, and
forwarding the claim would invite someone to trust it. Each root is attempted independently — a
fresh install may have only one of the two directories — and a refused root lands in
`unavailable()` rather than failing the start. Dropping the handle stops the callbacks; who holds
it, replacement, and late callbacks from a replaced watcher are the lifecycle's questions (2d-2).
**No event-delivery test exists in this crate, deliberately**: the consult's Q7 item 2 puts the
real-filesystem integration test in `src-tauri` where open/replace/drop lifetime and native
delivery meet, and a timing-based assertion here would be the flaky half of that test without its
authority. The three tests here prove construction, per-root establishment and degradation
reporting on synthetic temp trees only.

### 2.11 D11 — `rescan` is a hint amplifier: it emits nothing and mints nothing

`rescan(now, source)` enumerates the tree and feeds every listed and every tracked path back
through the ordinary pipeline as hints at `now`. Additions, removals and changes all then earn
their observations through the same debounce-and-stabilize walk a native hint takes — one pipeline,
not two — and everything unchanged stabilizes to its tracked revision and coalesces to nothing.
Existing path identities are preserved **by construction**, because a rescan only asks. A failing
enumeration is a typed refusal that hints nothing. This is also the fallback the lifecycle drives
when the native backend is degraded, and the only way a membership change arrives when the backend
delivered no per-file event (§5 item 5).

### 2.12 D12 — the baseline scan tracks only what two consecutive reads agree on, and observes nothing

`ObservationEngine::start` seeds the tracked table from one enumeration and **two consecutive
reads per file — the same stability criterion the tick pipeline applies** (Q7 item 1; the round-1
review's first High: one read per file shipped first, and a truncate/write race could seed
`tracked` and `snapshot_of` with bytes that never stably existed). A file whose two reads agree is
installed — present bytes are projected, a stable failure is tracked as unreadable so its recovery
is observable, a stable absence is skipped. A file whose two reads **disagree** is never installed:
it is deferred into the ordinary pending pipeline, due at the caller's first tick, and earns its
observation (`Added`, `Unreadable`, or nothing) when it stabilizes there — the suite pins that the
torn bytes appear in no baseline and no observation
(`a_torn_baseline_read_is_never_installed_and_stabilizes_through_the_pipeline`). `start` itself
still emits nothing: the baseline is the caller's opening state, not a change from it, and
whatever could not stabilize at `start` is not part of that opening state. The tracked state is
itself observable — `tracked_paths`, `revision_of`, `snapshot_of` — because a property nothing can
observe is a property nothing can test (`PROGRESS.md` R24), and `snapshot_of` is also what the
lifecycle (2d-2) will read when it installs a stabilized snapshot into the workspace cache instead
of racing a second read against it. **What two adjacent reads cannot rule out, said in the same
sentence**: `start` has no clock, so nothing separates its two reads, and a writer suspended
mid-write across both can still seed equal torn reads — the residual window §5 item 9 states.

---

## 3. The evidence, item by item

Consult Q7 item 1 lists the coverage this step owes. Each is driven deterministically in
`crates/espansoconfig-core/tests/watch_engine.rs` unless named otherwise:

| Owed | Where |
|---|---|
| bursts | `a_burst_of_hints_coalesces_to_one_observation_and_two_reads`, `two_paths_debounce_independently`, `a_hint_during_probing_restarts_the_debounce`, `nothing_is_read_before_the_debounce_deadline` |
| atomic rename shapes | `an_atomic_replacement_is_one_change_carrying_only_the_final_bytes` (temp path dropped by extension, target stabilizes once), `a_rename_away_is_a_removal_and_the_new_name_is_not_watched`, `a_rename_into_the_tree_is_an_addition` |
| partial writes | `a_partial_write_is_never_observed` — the intermediate bytes appear in no observation |
| baseline stability (round-1 fix) | `a_torn_baseline_read_is_never_installed_and_stabilizes_through_the_pipeline` (fails against a single-read `start`), plus the two-reads-per-file assertion in `the_baseline_scan_tracks_without_observing` |
| read-error recovery | `a_transient_read_error_recovers_without_an_unreadable_observation` (in-pipeline), `a_stable_read_error_is_one_unreadable_observation_until_it_changes`, `recovery_after_a_stable_error_is_a_change_even_with_identical_bytes`, `an_error_on_a_never_seen_path_is_typed_and_its_recovery_carries_no_previous` |
| non-UTF-8 | `stable_non_utf8_bytes_are_hashed_and_typed_never_decoded` — hash, offset, no table, and the recovery |
| deletion/recreation | `removal_and_recreation_are_two_observations_even_with_identical_bytes`, `a_transient_deletion_inside_one_debounce_window_is_no_observation` |
| parse failure | `a_parse_failure_is_a_stable_observation_with_diagnostics_not_an_absent_one`, plus `every_invalid_fixture_is_a_stable_projected_observation_with_a_failed_parse` over the committed invalid corpus |
| semantic findings | `an_external_edit_carries_projection_findings_and_the_exact_text` — `MatchHasNoContentField` on the stabilized projection |
| recursive nested match files | `nested_disabled_package_and_profile_files_are_all_watched_and_classified` (`match/scoped/deep/nested.yml`) |
| disabled files | the same test — `match/_off.yml` watched and flagged |
| packages | the same test — `match/packages/pack/package.yml`, kind `Package`, read-only |
| exact hashing | `a_trailing_newline_difference_is_a_change`, `a_byte_identical_rewrite_stabilizes_to_no_observation`, and the byte-identity assertions in the fixture sweep |
| rescan | `a_rescan_finds_additions_and_removals_and_coalesces_everything_unchanged`, `a_failing_enumeration_is_a_typed_refusal_that_hints_nothing` |
| snapshot-bound correspondence tables | `a_changed_observation_carries_a_table_bound_to_both_snapshots`, `a_previous_snapshot_that_did_not_parse_yields_an_empty_table`, the retained-snapshot recovery case, and `correspond.rs`'s four module tests (both-revision binding, the tier asymmetry, the empty table, the anchor-free wire form) |
| the two watched roots and the hint filter | `hints_outside_the_watched_roots_or_without_a_yaml_extension_are_dropped`, `the_watched_roots_are_config_and_match_and_nothing_else` (`watch/mod.rs`) |
| discovery's file-shape acceptance in the read (round-1 fix) | `a_yaml_symlink_inside_a_watched_root_never_reads_outside_content` and `a_directory_named_like_a_yaml_file_is_absent_not_unreadable` (`engine.rs`, real temp trees; both fail against a symlink-following read) |
| discovery's *reachability* acceptance in the read (round-2 fix) | `a_rescan_never_reads_through_a_newly_symlinked_ancestor` (`engine.rs`, real temp tree, `#[cfg(unix)]`; fails against a final-component-only read) |
| the suppression predicate shape | `the_suppression_predicate_answers_byte_identity_not_authorship` (`watch/mod.rs`) |
| config validation | `a_debounce_outside_the_plans_band_is_refused` (`engine.rs`) |
| the native adapter | `native.rs`'s three construction tests on synthetic temp trees |

**The fifteen protected fixtures were enumerated and fed through read/hash tests without being
edited or logged**, per Q7's closing ruling: `every_synthetic_fixture_survives_the_engine_byte_exactly`
reads each committed fixture's exact bytes off disk, feeds them through the engine as an injected
`Added`, and asserts the revision is the hash of those bytes and the observed text is
byte-identical — assertion messages carry file names only. `tests/corpus_integrity.rs` still passes,
and `git status` shows no corpus path.

**The real corpus test reports names, counts and revisions only, and skips cleanly when absent**
(`the_real_corpus_baselines_and_rescans_quietly_reporting_names_and_revisions_only`): it mirrors the
gitignored files into the injected tree, asserts every baseline revision is the hash of the exact
bytes, and asserts a rescan over the unchanged corpus observes nothing. It ran against the synced
corpus on this machine and passed; on a fresh clone it prints the standard skip notice.

**What none of it proves.** The suite drives the engine through injected sources, so it proves the
state machine, never native delivery — no test in this crate observes a `notify` event reaching a
sink, and 2d-2's temp-directory integration test in `src-tauri` is where that is owed. Nothing
proves a caller wires `rescan` to degradation, ticks on time, or applies the suppression predicate:
there is no caller.

---

## 4. The gates

| Gate | Before | After |
|---|---|---|
| `cargo test --workspace` | 1153 passed, 0 failed | **1198 passed, 0 failed** (1194 at the step's first submission; +3 from the round-1 review fixes; +1 from the round-2 fix, §7) |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean | **clean** (exit 0) |
| `cargo fmt --check` | clean | **clean** (exit 0, after one `cargo fmt` over the new Rust files; no corpus fixture is `.rs` and none was touched) |
| `cargo tree -p espansoconfig-core \| rg tauri` | empty | **empty** (rg exit 1, no match — `notify` 8.2.0 is in the tree and pulls in no tauri) |

**The test count moved by 45 over the phase's start and every one is accounted for**: 31 in
`tests/watch_engine.rs`, 4 in `watch/correspond.rs`, 5 in `watch/engine.rs`, 2 new in
`watch/mod.rs`, and 3 in `watch/native.rs`. The figure was measured by summing the run's
`test result` lines, not copied forward — re-measured after the round-1 fixes, whose three new
tests are named in §3 and §6, and again after the round-2 fix, whose one new test
(`watch/engine.rs`'s fifth) is named in §3 and §7.

**The frontend gates were not run, per this step's boundary**; what stands in their place is the
measured working-tree fact: `git status --short --untracked-files=all` lists `Cargo.lock`,
`Cargo.toml`, four modified files under `crates/espansoconfig-core/`, four new files under it, and
this record — no `src/`, no `src-tauri/`, no i18n path. The root `Cargo.toml` is outside the letter
of the step's expected path list and inside its intent: it is the workspace's one home for pinned
versions, and the alternative — a version pinned in the member crate — is what the workspace layout
exists to prevent.

---

## 5. Holes, stated rather than hoped about

1. **No caller exists.** Nothing constructs the engine or the native watch outside tests: no
   lifecycle (2d-2), no suppression ledger (2d-3), no queue or wire (2d-4). Every claim in this
   record is a claim about the core, none about an application.
2. **Native delivery is untested in this crate**, deliberately (§2.10). The three `native.rs` tests
   prove construction and per-root establishment; whether a real write produces a hint that reaches
   a sink is 2d-2's integration test in `src-tauri`, where the consult put it.
3. **Path equality is exact.** The engine compares hint paths to tracked paths byte for byte; a
   native backend that reports a path in a different case, or through a resolved symlink, misses
   the tracked entry and — if it survives the YAML/root filter — is treated as a different file.
   Reconciling the backend's spelling with discovery's is the lifecycle's, beside the backend.
4. **A file written continuously never stabilizes** (§2.3): trailing-edge debounce plus the
   stability requirement mean a nonstop writer produces no observation until it stops. The same
   holds for reads that alternate outcomes indefinitely — the engine keeps probing at each
   deadline, bounded only by the writes actually ceasing.
5. **A directory-shaped hint stabilizes as absent, and is never amplified.** A hint without a YAML
   extension schedules nothing; one whose path *names* a YAML file but resolves to a directory or a
   symlink — or is no longer reachable through real directories under a watched root, an ancestor
   replaced by a symlink included — schedules the ordinary two reads and then stabilizes as absent —
   `FsWatchSource::read` answers `Missing` for anything the walk could not reach, discovery's own
   acceptance — so it observes nothing and reads no content. (The first version of this item was false, the round-1 review found: such
   a hint used to become an `Unreadable` observation, and a `.yml` symlink read content from
   outside both roots. §2.7 records the fix.) Either way, a directory-level operation whose
   per-file events never arrive — `mv` of a whole subtree — is caught only by an explicit `rescan`.
   Auto-rescanning on such hints was considered and rejected: every save's temp file would trigger
   one.
6. **The engine retains a full projected snapshot per tracked file.** That is what makes
   correspondence tables and handover to the workspace cache possible without re-reading, and it is
   a real memory cost proportional to the config tree; sharing one snapshot store with `Workspace`
   (consult Q1's "one observation/coalescing coordinator") is 2d-2's wiring, and nothing here
   prevents or performs it.
7. **`Observation` is not a wire type.** It carries `SourceDocument`, `DiscoveredFile` and
   `io::ErrorKind` and does not serialize; the wire shape — sequences, epochs, `disk_text`, the
   `document_or_relative_path` split — is 2d-4's, and only `CorrespondenceTable` was given
   `Serialize` now because it crosses whole.
8. **A `Changed` can name a path the caller first heard of as `Unreadable`** — a baseline-unreadable
   or hint-born-unreadable file that recovers carries `previous_revision: None` and arrives as
   `Changed`, not `Added`, because the engine announced the path when it reported it unreadable.
   The doc comment on `Observation::Changed` defines "announced"; a 2d-4 consumer that wants a
   different vocabulary maps it there.
9. **The baseline's two reads are consecutive, and nothing separates them** (§2.12). `start` has no
   clock, so its two stability reads per file are adjacent; a writer suspended mid-write across
   both can still seed equal torn reads into the tracked table. A later hint or rescan for the
   path re-runs the pipeline over it and corrects the baseline — and native delivery is expressly
   not guaranteed (§2.10, `native.rs`), so such a baseline can persist until some hint or rescan
   actually occurs, and nothing in this crate schedules one. A full probe-interval dance at
   `start` would need an
   injected instant and a caller-driven wait per file on the opening path; deferring *every* file
   to the pending pipeline instead would make the opening state empty. Accepted — with the
   disagreement case now deferred rather than installed, which was the round-1 review's first High:
   the first version of this item accepted a single-read baseline that installed torn bytes
   outright.
10. **`EngineConfig`'s band check cannot reach a caller that never constructs one.** The plan's
    150–300 ms is enforced at `EngineConfig::new` and nothing forces 2d-2 to use `EngineConfig` at
    all — but there is no other way to construct an `ObservationEngine`, so the only way around the
    band is to not use the engine.
11. **The root `Cargo.toml` is modified**, which the step's expected-path list did not name (§4).
    One declaration, following `regex`'s and `libc`'s precedent; recorded here rather than smoothed
    over.

---

## 6. The round-1 review and its closures

`docs/reviews/phase-2d-1-engine.md` round 1 answered NOT READY — two High, two Medium, one Low —
and every finding was verified against the code. The closures, each checked back against the code
after fixing (a record claiming a guarantee the code does not give is this project's worst defect
class):

> **Correction (round 2).** This section stood as a complete-closure record, and it was not one:
> the round-2 review found a narrower surviving instance behind every item below — the rescan
> route through a newly symlinked ancestor (item 2), a delivery-guaranteed sentence in the
> residual-window record (item 1's residue, §5 item 9), unqualified determinism claims at sites
> the item-3 sweep missed, the authorship gloss at a third site (item 4), and one eleven-line
> loop without its comment (item 5). The items below are left as they were written; §7 is the
> record of what round 2 found and how it was closed.

1. **High — one-read baselines at `start`.** Fixed in code, not prose: `start` installs a baseline
   only when two consecutive reads agree, and a disagreeing pair defers the path into the ordinary
   pending pipeline (§2.12). Pinned by
   `a_torn_baseline_read_is_never_installed_and_stabilizes_through_the_pipeline`, which was run
   against a deliberately neutered stability check and failed. §2.12's "stabilized" handoff claim
   and §5 item 9 now describe what the code does, including the residual adjacent-reads window.
2. **High — hint admission disagreed with discovery.** `FsWatchSource::read` now applies the walk's
   own acceptance (`symlink_metadata`, regular files only, the final component's check exactly as
   the walk checks each entry) before reading, so a `.yml` symlink stabilizes as absent instead of
   emitting outside content and a directory named `*.yml` is excluded instead of `Unreadable`
   (§2.7, §5 item 5). Pinned by the two `engine.rs` tests named in §3, both run against a
   symlink-following read and failed. The trait doc states the contract an injected implementation
   is trusted with; the symlinked-intermediate-directory residue is recorded in §2.7 rather than
   silently inherited.
3. **Medium — the determinism sentence claimed more than `identity_of` gives.** The smaller honest
   fix was chosen over injection, and §2.2 says which and why: the process-wide registry is
   load-bearing for D7's one-table cross-module identity agreement, so the record's and the
   module's own sentences (`engine.rs` module docs, `tick`) now say in one sentence what is
   deterministic — shapes, revisions, order — and what the registry leaves caller-ordering-dependent
   — the identity values.
4. **Medium — `self_write_suppresses`'s guarantee needed its caller obligation in the same
   sentence.** Both the function's doc comment and §2.1 now state, inside the guarantee sentence,
   that document/epoch/latest-entry selection is the caller's (2d-3 owns the ledger) and that an
   equal-hashing entry from another document or a replaced workspace suppresses wrongly.
5. **Low — closing-bracket comments.** All 25 over-ten-line functions in `tests/watch_engine.rs`
   and the new test at `watch/mod.rs` carry them now, and every function this fix round added or
   grew past ten lines got one in the same pass.

The gates in §4 were re-run and re-measured after these fixes; the +3 test delta is the two Highs'
pinning tests (one of them `#[cfg(unix)]`, counted on this macOS tree).

---

## 7. The round-2 review and its closures

Round 2 answered NOT READY again — one High, three Medium, one Low — and every finding was a
**narrower surviving instance** of a round-1 finding §6 records as closed. That is the failure
mode this project has already named: each closure was swept for the words of the finding, not for
its shape. The closures, each checked back against the code:

1. **High — the rescan route through a newly symlinked ancestor.** Round 1's symlink fix checked
   only the final component, and `rescan` re-hints every tracked path — so replacing an ancestor
   directory of a tracked file with a symlink made a production route read through it and emit
   content discovery's walk excludes. Closed at the shape, not the instance: `WatchSource::read`
   now takes the engine's root and `FsWatchSource` applies **discovery's whole acceptance the
   walk's own way** — under a watched root, plain-name components, every intermediate a real
   directory by `symlink_metadata`, the final a regular file — so the engine's admission and the
   walk's acceptance are one predicate on **every** read route (baseline, hint and rescan alike),
   and what the walk cannot reach stabilizes as absent. The alternative — re-deriving rescan's
   hints from the walk — was rejected because a tracked path the walk can no longer reach must
   still stabilize as `Removed`, and because it would close one route while a hand-fed or native
   hint kept the other open. §2.7 carries the full decision. Pinned by
   `a_rescan_never_reads_through_a_newly_symlinked_ancestor` (`engine.rs`, `#[cfg(unix)]`), run
   against a final-component-only read and failed.
2. **Medium — the residual-window record claimed guaranteed delivery.** §5 item 9 said the racing
   writer's own hint corrects an equal torn baseline; native delivery is expressly not guaranteed
   (§2.10), so the truthful sentence — such a baseline can persist until some later hint or
   rescan actually occurs, and nothing in this crate schedules one — now stands in §5 item 9 and
   in `start`'s doc comment, which had repeated the delivery-guaranteed version.
3. **Medium — unqualified determinism claims at other sites.** Round 1 qualified the engine
   module docs, `tick` and §2.2; the crate doc (`lib.rs`), both `notify` declaration comments
   (root and core `Cargo.toml`), `watch/mod.rs`'s module doc, `native.rs`'s module doc, the
   `ObservationEngine` and `Observation` docs, `workspace/mod.rs`'s identity-table docs and this
   record's own opening paragraph still said "deterministic" bare. Every one now carries the same
   qualification — shapes, revisions and order from the schedule; identity values from the
   process-wide session table. The sweep was re-run over the concept (`rg -i determinis` across
   the tree), not the old wording; the remaining hits are other subsystems' claims about their
   own determinism (the backup namer, the sorted walk, seeded tests) and say nothing about this
   engine. **Correction (round 3): "every one" was false when written.** The concept sweep
   matched prose that *discusses* determinism and missed the claim carried as a **name**: the
   module headline still opened "The deterministic observation engine". §8 records the closure;
   this entry is left as written, per this project's correction-block convention.
4. **Medium — the authorship gloss at a third site.** `ContentRevision`'s doc still glossed
   suppression as *did we just write this?* — the exact claim the corrected predicate forbids. It
   now claims only what the predicate measures: bytes hashing to the latest recorded committed
   revision — byte identity, never authorship. The concept sweep found no fourth site: §2.1's
   italic *ignore if the hash equals the revision the app just wrote* is plan §6.5 step 4 quoted,
   and the same paragraph corrects it.
5. **Low — the eleven-line correspondence loop** in
   `a_changed_observation_carries_a_table_bound_to_both_snapshots` now carries its
   closing-bracket comment, and every file this round touched was re-swept for any function or
   loop past ten lines without one.

The gates in §4 were re-run and re-measured after these fixes; the +1 test delta is the High's
pinning test (`#[cfg(unix)]`, counted on this macOS tree).

## 8. The round-3 review and its closure

Round 3 confirmed four of round 2's five closures and answered NOT READY on **one Medium — the
third narrower surviving instance of M1 in as many rounds**: `engine.rs`'s module headline still
opened *"The deterministic observation engine"*, the bare claim carried as a noun phrase, while
the qualified sentence sat in the same module doc a paragraph below. The round-2 concept sweep
(`rg -i determinis`) had **matched the site and misread it** — the headline was reviewed as
prose *near* the qualification rather than as a claim of its own, which is a narrower repeat of
the sweep failure §7 itself names. Closed by making the headline carry the qualification: the
module now opens *"The observation engine — hints in, typed observations out, deterministic in
shape (kinds, revisions, order) while identity values come from the process-wide session
identity table."* §7 item 3's "every one now carries the same qualification" gets a correction
block rather than a rewrite. No other finding: round 3 confirmed the High's one-predicate fix
(admission and discovery's acceptance compared literally, the injected-source contract stating
what Rust cannot force in the same sentence, the pinning test failing without the fix), the H1
residual sentence, the M2 authorship fix, the Low, §6's preserved history, and the scope guard.
The gates in §4 were re-run after this closure; the fix is doc-comment prose plus this record,
so every figure is unchanged and was re-measured rather than assumed.

**Correction (round 4): the closure this section records was itself incomplete.** M1's shape
survived at two further name positions this section's own sweep did not cover — see §9. The
account of rounds 1–3 above is accurate; only the claim of closure was false when written.

## 9. The round-4 review and its closure

Round 4 confirmed the repaired `engine.rs` headline honest (rustdoc's first-sentence summary
carries both the shape qualification and the identity-value exception), §7's correction block
additive, and §8's history accurate — and answered NOT READY on **one Medium, the fourth
name-position survival of M1**: this record's own §2.2 heading claimed *"determinism by
injection"* bare, and the design consult's Q1 ruling names *"the deterministic reconciliation
engine"* unqualified. A heading and a ruling line are read independently of the prose below
them, which is exactly why the qualified paragraphs under each did not close them — the same
mechanism as the `engine.rs` headline in §8. Closed by qualifying the §2.2 heading in place
(*"determinism in shape by injection … and identity values come from the process-wide session
table"* — the heading is this record's living text, not history) and by adding a **correction
block** under the consult's Q1 ruling, leaving the ruling as written, because a captured verdict
is history and this project corrects history beside itself, never over itself. After the fix a
name-position sweep — markdown headings, bold ruling lines, module-doc and struct-doc first
sentences — was run over `docs/` and `crates/`, distinct from the prose-concept sweep §7
records; its remaining hits are qualified in place or claims other subsystems make about
themselves. The gates in §4 were re-run after this closure: markdown-only edits, every figure
unchanged, re-measured rather than assumed.
