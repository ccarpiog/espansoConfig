# Phase 2B — verification and review dispositions

_Archived verbatim from `PROGRESS.md` on 2026-08-29, when the checkpoint was split. The text below is unedited; see `PROGRESS.md` for the live state._

---

## Phase 2b-2a review disposition

The review is
[`docs/reviews/phase-2b-2a-save-spine.md`](docs/reviews/phase-2b-2a-save-spine.md), taken over the
whole uncommitted change (26 modified files plus `src-tauri/src/save.rs` and the notes doc).
**Five findings, no blocking one. Nothing was declined**; the finding-by-finding record is
`docs/decisions/2b-2a-notes.md` §11.

The shape of the round is worth keeping, because it is the shape this project keeps producing:
**two were defects and three were tests that passed vacuously.** A test that cannot fail is the
recurring failure mode here, and three of five is the highest proportion yet.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | **High** | Every `saveFailed` left the frontend projection and the raw-text snapshot untouched — **including when the nested `WriteError` says the rename may already have completed**, which is exactly the case the Rust side evicts its cache for. The rename succeeds, then the directory sync or the read-back fails, and the window keeps showing the pre-save order and the pre-save bytes of a file that already holds the moved snippet | **Real, and the two sides of the boundary disagreed.** Closed by making the wire carry the answer rather than letting the frontend re-derive it: `CommandError::SaveFailed` now writes a second operand, `may_have_written`, **computed in the serializer by calling the core's own `SaveError::may_have_written()`**. It is not a field, so nothing can set it wrongly, and there is no list of `WriteStep` names in TypeScript that could drift from the Rust one. `mayHaveWritten()` in `errors.ts` is the single frontend spelling. The old test's fixture failed at `Rename` — which explicitly means the rename did **not** happen — so it passed against the defect; it is kept, with its meaning now stated, and a new test fails *after* the rename |
| 2 | Medium | `ByteSpan`'s derived `Deserialize` fills `start` and `end` directly, bypassing `ByteSpan::new`'s `start <= end` invariant. `{"span":{"start":20,"end":10}}` deserialized into an acknowledgement, and a later `len()` underflows | **Real.** Hand-written `Deserialize` routing through `ByteSpan::new`; an inverted span is a **deserialization error, not a repair**, because a repaired span silently stops matching the recomputed findings and every save would then be refused twice with no explanation. Two tests, one of them the review's exact payload. The rest of the newly-deserializable graph was audited for the same shape — a public constructor enforcing something a derive skips — and `ByteSpan` was the only one |
| 3 | Medium | The conflict test could not discriminate the honesty rule it was named for: its fixture makes `found` and `disk_revision` equal, so an implementation that wrongly set `disk_revision = found` while refreshing `disk` separately would still pass | **Real, and a test defect rather than a code defect** — the production construction was already correct. The payload is now built in one named place, `conflict_after_the_lock`, and a new test drives a **real** refusal through `move_match` for `found`, replaces the file again, and then calls the builder — the interleaving itself. Setting `disk_revision: found` fails it. **The interleaving is not reachable through the command** (both reads are inside one synchronous call), which is why the rule is pinned below the command; recorded as a hole rather than papered over |
| 4 | Low | The frontend treated every `Saved` arm as though bytes had changed, though `committed: false` is a documented **success** — moving one of two byte-identical snippets produces a byte-identical candidate and nothing is written | **Real as an overstatement.** The branch now acts on `committed \|\| revision !== view.revision` rather than on the arm, the comment was corrected, and a new browser test covers `committed: false` — written as a success, because it is one |
| 5 | Low | `a_move_leaves_the_bytes_it_did_not_move_alone` did not prove byte identity outside the move, despite its name. A command that changed `replace: first` to another **same-length** value while preserving the leading comment, the trigger count, the unmodelled-key count and the total length passed every assertion | **Real, and it was checking proxies for the one property this whole project rests on.** It now derives the expected post-move text from the pre-move text and compares the file **byte for byte**. Confirmed by a throwaway `first`→`worst` corruption: all four old assertions passed and the byte comparison caught it |

**Four of the five fixes were confirmed by breaking the code, watching the new test fail, and
restoring** — findings 1 to 5 excluding none; the fifth was confirmed by the corruption test above.
That is the standard this project's review rounds should keep: a fix for a vacuous test is worth
nothing unless someone has seen the replacement fail.

**What the review confirmed rather than faulted**, recorded because it is the expensive half to
re-establish: production writes remain centralised in `save_document`; `covers_all` consumes
distinct matches, so the acknowledgement really is an exact multiset; there is no `force` bypass
anywhere; `move_match` accepts identities and never a wire path; it sends exactly one same-sequence
`MoveItem` and nothing else; backups are always supplied; and the moved identity is resolved at
`resulting_index` against a refreshed matching revision. Dropping `Clone`/`PartialEq`/`Eq` from
`CommandError` was judged reasonable, and the six rewritten assertions lost no discrimination
because `NoWorkspaceOpen` is operand-free.

---

## Phase 2b-1 review disposition

The review ran as **two** files rather than one, and the reason is itself a finding worth keeping. The
first attempt handed a reviewer the whole 3 582-line diff and six review dimensions at once; it read
files steadily for 1m42s and then went silent for thirteen minutes with no output. It was cancelled —
the known runaway signature (a repeating web-search loop) was **absent**, so this was a job too large
to finish, not a job stuck. Split into two single-file briefs, each reading exactly one bounded diff
and nothing else, both finished. **The lesson is the brief's size, not the reviewer**: a review whose
input is a whole phase's diff plus repository exploration plus six dimensions is a review that may
never answer.

- [`docs/reviews/phase-2b-1-wire-boundary.md`](docs/reviews/phase-2b-1-wire-boundary.md) — the
  core-crate diff (797 lines): the format, the deferral, the two lossy reductions, scope.
- [`docs/reviews/phase-2b-1-strings.md`](docs/reviews/phase-2b-1-strings.md) — the i18n diff (372
  lines): the five forbidden claims and the Spanish read as Spanish.

**Nothing was declined.** The finding-by-finding disposition is `docs/decisions/2b-1-notes.md` §7; what
follows is only what a fresh session needs without opening it.

**Review A — the wire format.**

- **A-i, blocking — applied.** `FindingCode::VariableMissingRequiredParam::param` was a `&'static str`,
  which `serde` cannot deserialize into, and the phase's own notes had named it the one type-level
  blocker to the acknowledgement ever coming *back*. The reviewer ruled on all three escape routes and
  called changing the field type soundest. It is now an owned `String`, at four construction sites.
  **The design itself was not touched** — how an acknowledgement round-trips is still 2b-2's to decide;
  this only removed the obstruction to deciding it.
- **A-ii, should-fix — applied, and the timing is the point.** `io::Error`'s `raw_os_error()` was being
  discarded, so genuinely different operating-system failures collapsed into one `ErrorKind` — above all
  into `Other`, which says nothing. The errno now rides beside the kind as a **nullable number** with no
  dictionary entry. It was done *now* because the wire format has no consumer yet: this was the last
  moment at which adding a field cost nothing, and after 2b-2 it is a format change Phases 2c–5 inherit.
- **A-iii, minor — recorded, no code.** A wire path is lossy display text and can never be an
  identifier. Folded into the notes' inheritance section and into this file's Next action.
- **A2 and A4 — clean.** No inconsistency among the eighteen enums' tagging; the hand-written impls
  reproduce what a derive on a sibling produces. No behavioural change in `persist/save.rs`,
  `write.rs` or `backup.rs` — derives, impls, imports, doc comments and tests only.

**Review B — the strings. Three forbidden claims found, a fourth found by the fix worker, and four more
found by the orchestrator in pre-existing strings.**

The rule the project holds is that the app may describe **risk under its own model** and may never
**predict espanso's behaviour** or pronounce a file **valid or invalid absolutely**.
`matchHasSeveralTriggerForms` said *"where espanso expects exactly one"*; `duplicateVariableName` said
*"espanso keeps the last one"*; `verificationFailure.doesNotParse` said *"no longer valid YAML"*. The
fix worker found `editError.sourceDoesNotParse` making the same absolute-validity claim about the
source. All four were corrected in both languages, along with review B's eight further Spanish quality
findings and five English register findings — **10 English and 16 Spanish values edited**.

**The four pre-existing strings are the disposition worth reading, because the rule for them was
deliberately overridden.** The fix worker was told not to rewrite strings the phase had not added, and
it complied, recording `code.diagnosticCode.{parseFailed, fieldHasUnexpectedShape,
matchHasSeveralTriggerForms, matchHasSeveralContentForms}` as owed to *"whichever sub-phase next
touches the diagnostic strings"*. The orchestrator fixed them anyway, for one reason: **2b-2 through 2d
are all about saving, not diagnostics, so the named owner may never arrive**, and a violation the
project has now demonstrated in its own review is worse to leave shipped than a slightly wider phase is
to commit. Eight values changed; each keeps its operands and its shape and changes only the claim.

**What that did not buy is a reading.** Those four appear on the diagnostics surface Phase 1c-2b-1 read
in a running window, and it has not been re-read. The claim recorded is narrower than a screen claim —
that the *strings* no longer predict espanso's behaviour, checked by key and placeholder parity — and
the next phase that opens a window owes the look.

---

## Verification — Phase 2b-2c-3b

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report. Each was run **twice** — on the implementation and again after the review fix
round — and the table records the second run.

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | **1007 passed, 0 failed** (1001 before the phase) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | **no output** — the architecture rule holds (D2x) |
| `npm run check` | 378 files, **0 errors, 0 warnings** |
| `npm run build` | exit 0 |
| `npm test` | **738 passed** (702 before the phase; 728 before the fix round) |
| `git status --short` | nothing under `tests/corpus/`, nothing under `tests/corpus/real/`, `package-lock.json` unmodified |

The Rust total is unchanged across the fix round because two of the four findings were **test
strengthening rather than new tests**: the dispatcher test that claimed to read the disk and the
acknowledgement-mismatch test that compared three operands and named four. The frontend total moved
728 → 738: two tests for the High and eight for the workspace state the Medium forced into existence.

### Phase 2b-2c-3b review disposition

The aggregate code review is `docs/reviews/phase-2b-2c-3b-code.md` and it returned
**`READINESS: NOT READY`** — one High, one Medium, two Low. **All four were fixed before the commit**,
so, as with every phase since `8989c16`, no commit holds a demonstrated defect. The review explicitly
cleared everything else it was asked to attack: the single write entry point, the omission of
`view_at`, the acknowledgement binding, `moved: null`, the error-channel rules, the absence of a
`force` flag, the localization, the no-position case, the four unchanged `run_one_save` callers and
the retabulated contract checks.

| # | Severity | What was actually wrong | How it was closed |
|---|---|---|---|
| 1 | **High** | `saveRawDocument` awaited the caller's `reload` **after a committed write**, inside a `Promise<CommandResult<SaveResult>>`. A rejecting callback threw past the return type: the successful `Saved` was hidden and a caller could retry a write that had already happened. **This is D2 — *a committed write is never afterwards reported as an `Err`* — broken in TypeScript**, an invariant written for the Rust side that the boundary layer had just violated | The wrapper now answers a boundary type `RawSaveOutcome` whose success arm **always** carries the `SaveResult`, beside a required `reload` discriminant — `notOwed` / `done` / `failed`, the last carrying a `classifyFailure`-classified `IpcFailure`. The call is wrapped in `try`/`catch`, so a failing reload can neither reject nor be swallowed. `SaveResult` and `moved: null` are untouched (consult Q3). Two tests pin both halves |
| 2 | Medium | The required callback made **omitting an argument** a compile error, not **ignoring the obligation**: `() => {}` compiles, and the phase's own tests passed exactly that. An asynchronous body could also expose stale projections before invalidating — `await` only protects code after the *caller's* await | `BrowserState.saveRawDocument` now exists in `src/lib/browser/workspace.svelte.ts` with **no callback parameter**, passing its own invalidation: `forgetTheReplacedDocument` runs **synchronously, before any `await`** (drops the projection from `views`, drops the selection, bumps the selection generation, forgets the raw snapshot), then `adoptTheReplacedDocument` re-reads and re-resolves positionally-and-checked, because a replacement has no identity to re-point with. Eight new state tests. No `.svelte` file was touched |
| 3 | Low | The dispatcher test claimed to inspect **bytes on disk** but called `document_text`, which may serve the workspace cache — it would pass if a future command updated cached text without persisting it | The temp directory is retained and `std::fs::read` is compared directly, at all three points (commit, refusal, acknowledged commit) |
| 4 | Low | The command-layer acknowledgement-mismatch test said it proved the two findings had **identical parser stopping points**, but compared only `span`, `node` and `path` before asserting the whole codes differ. It would still have passed if `line`, `column`, `byte_index` or `detail` differed — in which case `revision` would not be what distinguished them | Both codes are destructured, every non-`revision` operand is compared, and each `revision` is checked against `ContentRevision::of_bytes` of **its own** candidate before inequality is asserted |

**The design consult was not re-commissioned**, per the standing instruction: `docs/reviews/phase-2b-2c-3-design.md`
covers the whole of 2b-2c-3 and the owner's ruling overriding its Q2 is appended to it. **A second Codex
round-trip to confirm the fixes was deliberately not taken** — the four fixes are small, each followed the
review's own stated minimal fix, and the orchestrator read the High's fix directly rather than accepting a
report of it. That is a recorded judgement call, not an oversight: a confirmation pass would be the honest
thing if a fix had *departed* from what the review prescribed, and none did.

---

## Verification — Phase 2b-2c-3a

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report. Each was run **three times** — on the implementation and after each of the two
review fix rounds — and the table records the third run.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` | ✅ **1001 tests**, 0 failed (**+18** on 2b-2c-2's 983: +13 for the mode, +3 for the backup fix round, +2 for the acknowledgement fix round) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed — no fixture lost a distinguishing byte, and none was added |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test draft_plan -- every_match_of_the_real_configuration` | ✅ **not a vacuous skip** — 13 files, 65 matches, 417 intents, **0 refusals**, unchanged by this phase |
| `npm test` | ✅ 29 files, **702 tests**, 0 failed (+2 on 700) |
| `npm run check` | ✅ 376 files, 0 errors, 0 warnings |
| `npm run build` | ✅ built |
| `rg -c 'tauri::command' src-tauri/src/commands.rs` | ✅ **10**, unchanged — this phase registers no command |
| `git status --short --untracked-files=all` | ✅ no path under `tests/corpus/real/` |

**The baseline was re-established before the phase began**, not assumed: `cargo test --workspace`
was run at `18195f8` and returned **983**, and `npm test` **700**, both matching the previous
checkpoint exactly.

**Five claims were re-derived by the orchestrator rather than accepted from a worker or the reviewer.**

1. **No reentrancy path exists.** `rg -n 'lock_path\('` over the crate finds exactly **one**
   production call (`persist/save.rs:1183`); the other two are in a `#[cfg(test)]` module.
   `replace_locked_file` is called from exactly one place, inside the transaction, holding that
   lock. `replace_file_atomically`, which takes the lock itself, is called from nowhere but its own
   definition, and `src-tauri/` mentions both only in a doc comment.
2. **The new refusal really is pre-lock.** `ReplacementRequiresBackups` is raised at `save.rs:1176`;
   `lock_path` is at `save.rs:1183`. Read, not reported.
3. **The byte-fidelity test is not a proxy.** It reads each of the 15 committed byte-exact fixtures,
   submits its text, and compares `fs::read(target)` against the **original bytes**, pinning the
   14-committed / 1-refused split so a fixture silently dropping out of the sweep fails the test.
4. **The deadlock instrument is real.** `within()` spawns the work on its own thread and waits with
   `recv_timeout`, so a second lock acquisition **fails** the test instead of hanging the suite.
5. **The collision test cannot pass vacuously.** It asserts that *every operand the finding carried
   before the fix round* — stopping point, span, node, path — is **equal** between the two
   candidates, and only then that the findings differ. Remove the `revision` operand and the test
   fails, which is what makes it a test of the fix rather than of the fixtures.

## Phase 2b-2c-3a review disposition

The design consult for the whole of 2b-2c-3 was taken **before any line of it existed** and was
**not re-commissioned** (`docs/reviews/phase-2b-2c-3-design.md`, eight rulings, its Q2 overridden by
the owner). The aggregate code review is `docs/reviews/phase-2b-2c-3a-code.md` and it returned
**READINESS: NOT READY**. That verdict was **accepted rather than argued with**: the High and the
Medium were both fixed and re-verified, and the phase was not committed until they were.

**The first Codex review attempt hung** — `updatedAt` froze 87 seconds in while the job reported
`running` for nine minutes. It was cancelled per the watchdog procedure and relaunched with a
narrowed brief, which finished in 1m41s. **The hung attempt was not wasted**: its last captured
message named the backup mismatch, and that lead was confirmed independently and fixed as round one
before the second review ever ran.

| # | Where | Ruling or finding | Disposition |
|---|---|---|---|
| Design Q1 | consult | The substitute for the patch engine's proof is a successful reparse **and** the validation/acknowledgement gate | **Adopted as narrowed by the owner's override.** The reparse can no longer be a gate, so it is a **fact established and reported**. Q5 carries the weight instead |
| Design Q2 | owner | ~~Do not write text the parser rejects~~ — **OVERRIDDEN.** A raw save MAY write unparseable text | **Implemented as the owner ruled.** `an_already_broken_file_can_be_repaired_by_a_replacement` is the test that proves the point of the override |
| Design Q3 | consult | Keep `SaveResult`; `moved: None` | Deferred to 2b-2c-3b, which is where `moved` exists. The core reports the facts a caller needs |
| Design Q4 | consult | **One** entry point branching internally — the lock is not reentrant | **Adopted.** The mode is a **field** of `SaveRequest`, not a second function and not an enum over the whole request, so no caller can construct a raw save that skips the revision check by construction |
| Design Q5 | consult | A raw save fully participates in acknowledgement | **Adopted, and it is the load-bearing decision** — it forced "does not parse" to be a `Finding` rather than the `CommandError` the consult had suggested, because a `CommandError` cannot be acknowledged |
| Design Q6 | consult | No backup for a byte-identical result; **every committed raw replacement must have a recoverable pre-commit image** | **Not honoured by the implementation. Found and fixed as round one** — see Fix 1 |
| Design Q7 | consult | The named stale-revision test | **Adopted verbatim**, with the bounded-timeout instrument the ruling asked for |
| Design Q8 | consult | A raw save is a separate replacement mode with a **different promise** | **Adopted**, and the promise is stated on the `ReplaceText` variant itself, where a caller reads it |
| Fix 1 | orchestrator | **The backup path was content-mode-neutral**, so a raw save with `backups: None` committed a whole-file replacement leaving **no recoverable image of the bytes it destroyed**. `every_byte_exact_fixture_is_committed_exactly_as_submitted` passed `None` and committed 14 of them, so **a test codified the wrong behaviour** — the same shape as 2b-2c-2's Low | **Fixed.** `SaveError::ReplacementRequiresBackups { path }`, a struct variant, raised **before the lock**, below the read-only check on purpose. Nine tests now pass a real session. **The two lookalike outcomes are distinguished and the distinction is tested**: a session that has *already* copied the file is Q6's recoverable image and still commits (`a_second_replacement_in_one_session_commits_with_no_second_copy` asserts the commit **and** that the first snapshot survives). Only a **missing** session is refused |
| Code 1–4 | review | **No finding** in transaction ordering, reentrancy, byte fidelity, or the stale-revision defence. The reviewer confirmed the compared revision is the one read under the lock and that the TOCTOU window is closed for cooperating writers | Each reported as an explicit "no finding", not left silent |
| Code 5 | review | **High, and the NOT READY** — an acknowledgement for one unparseable text could acknowledge a **different** one. `DocumentDoesNotParse` carried the parser's position and message but **no identity of the candidate**, so two texts sharing an invalid prefix and differing only after the failure point produced **identical** findings. The existing test could not catch it: it asserts `assert_ne!` on the two findings | **Fixed, not dispositioned.** The finding gained a `revision: ContentRevision` operand — the hash of the **submitted text** — so a different text is simply a different finding and the existing exact-multiset machinery does the binding. `Acknowledgement`'s shape, `covers_all` and the `Edits` mode are untouched. This **restores a property consult Q5 had assumed**: *"changing the text requires recomputing findings and matching a new exact multiset"* |
| Code 6 | review | **Medium** — four tests assert proxies and would pass against a broken implementation | **All four fixed.** The byte-identical test now compares **inode and mtime** and pins that a real commit *does* change the inode; both `*_refused_before_anything_is_read` tests now delete the target and repeat the call, and were **renamed** to `*_is_refused_without_consulting_the_target` because a discarded read is invisible to a black-box test and the old names claimed more than they proved; the presentation-note test now asserts bytes at all four stages; the stale test matches the **typed** `RevisionMismatch` instead of `contains("holds")` |
| — | worker | The brief asked for a test pinning that a **surplus** acknowledgement is *rejected*. The worker reported this **contradicts deliberate existing behaviour**: `a_surplus_acknowledgement_does_not_refuse` pins that extra acknowledged findings do not refuse — the rule is *every candidate suspicion is covered*, not *every acknowledgement is used* | **The worker was right and the brief was wrong.** Existing behaviour was left alone; the reading with teeth was pinned instead by `an_acknowledgement_of_findings_that_were_never_issued_commits_nothing`, whose second half exercises the surplus-plus-covering case so the two statements cannot be confused |
| — | worker | The reviewer asked whether the new operand must appear as a dictionary placeholder | **Checked rather than assumed**: `every_save_transaction_placeholder_names_an_operand_serde_writes` is **one-directional** (placeholder → operand), so an opaque hash is **not** forced into a user-facing sentence. `saveCodes.test.ts` now asserts its **absence** from both renderings |

---

## Verification — Phase 2b-2c-2

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report. Each was run **twice** — once on the implementation and again after the review fix
round — and the table records the second run.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` | ✅ **983 tests across 21 binaries**, 0 failed (**+24** on 2b-2c-1's 959: +20 for the two commands, +4 for the fix round) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed — no fixture lost a distinguishing byte, and none was added |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test draft_plan -- every_match_of_the_real_configuration` | ✅ **not a vacuous skip** — 13 files, 65 matches, 65 planned to an empty batch, 417 intents, **0 refusals**, unchanged by this phase |
| `npm test` | ✅ 29 files, **700 tests**, 0 failed (+4 on 696: the new codes and the new union member) |
| `npm run check` | ✅ 376 files, 0 errors, 0 warnings |
| `npm run build` | ✅ built |
| `git status --short --untracked-files=all` | ✅ no path under `tests/corpus/real/` |

**The baseline was re-established before the phase began**, not assumed: `cargo test --workspace` was
run at `3160be2` and returned **959 across 22 result lines**, matching the previous checkpoint exactly.

**Four claims were re-derived by the orchestrator rather than accepted from a worker or the reviewer.**

1. **Nothing writes outside `save_document`.** `rg -n 'replace_file_atomically|replace_locked_file'
   src-tauri/src/` returns exactly **one** line, and it is a doc comment. The non-reentrant lock is
   not reachable from a command.
2. **The headline test is not a proxy.**
   `delete_match_never_deletes_the_item_at_a_stale_ids_old_path` asserts its own **premise** — that
   B's former path now resolves to A — before asserting the refusal, then compares the whole
   post-creation file byte for byte. A test that skipped the premise would pass even if the fixture
   stopped exercising the shift.
3. **The D5 check the design ruling was conditional on exists and observes a real value.**
   `every_edit_error_variant_crosses_as_an_object` derives its variant lists by parsing the source
   (36 `EditError`, 9 `SaveError`), asserts no unit variants, and then serializes a real
   `SaveFailed{Patch(RemovalWouldEmptyTheSequence)}` and reads the operand through **both** tags.
4. **The reshaped note breaks no existing reader.** `PresentationNote` changed from a struct to a
   tagged union, and `save_match` already emits it — but no component reads `notes`
   (`rg` over `src/lib` outside the types and tests finds only the accessors), and `svelte-check`
   is clean, so the change has no consumer to break. It is a wire-format change made while the
   field still has **no reader**, which is the only cheap moment it had.

## Phase 2b-2c-2 review disposition

Two consultations, both closed. The design consult was taken **before any line existed**
(`docs/reviews/phase-2b-2c-2-design.md`); the aggregate code review was taken over the whole working
tree **before the commit** (`docs/reviews/phase-2b-2c-2-code.md`), and it returned
**READINESS: NOT READY**. That verdict was **accepted rather than dispositioned away**: both findings
were fixed, re-verified, and the phase was not committed until they were.

| # | Where | Ruling or finding | Disposition |
|---|---|---|---|
| Design Q1 | consult | `create_match` accepts a **closed** `NewMatch { trigger, replace }`, both mandatory — never a raw pair list, never a full `MatchDraft` | **Adopted.** The author-chosen-key ban settles the pair list on its own; a `MatchDraft` would advertise structure a flat item cannot spell |
| Design Q1 | consult | *Reasoning corrected before it was acted on.* The consult justified the mandatory `replace` by claiming `save_match` could not later insert one. **That is false** — 2b-2b-2's D1 permits exactly one insertion, a schema-known scalar key into the match's own mapping | **Ruling kept, reason replaced**: a trigger with no body is not a usable espanso match. The incorrect reasoning appears in no comment or document |
| Design Q2 | consult | The core gains an explicit **front** insertion reusing `plan_move`'s own derivation; not a command-layer reconstruction, not append-then-move | **Adopted.** R25 forbids a move in a batch with anything else, so append-then-move would cost two transactions, two backups and two acknowledgement rounds, and would leave an intermediate state on disk. `insert_item()`'s `after: Option<usize>` became `at: ItemPlacement`; the reviewer confirmed **no `None` call site silently became `Front`** |
| Design Q3 | consult | Target the top-level `matches` value only, by opaque `DocumentId`; a file with **no `matches:` key at all** is refused by name in the `Err` channel; a **bare** `matches:` is still promoted | **Adopted** as `CommandError::DocumentHasNoMatchList` |
| Design Q4 | consult | `delete_match` answers `moved: None` — routine, not defensive. No neighbour identity | **Adopted.** Returning a neighbour would overload `moved` with UI selection policy and re-introduce positional identity |
| Design Q5 | consult | The eight `EditError` refusals arrive **wrapped** as `SaveFailed`; the command layer does **not** pre-plan the primitive | **Adopted.** Pre-planning would resolve the document twice and let the two layers disagree. The ruling was **conditional** on the object-shape contract test, which now exists |
| Design Q6 | consult | A deletion that doubles a blank separation owes a `PresentationNote` | **Adopted after one refusal.** See Code 1 |
| Design Q7 | consult | The named stale-identity test | **Adopted verbatim**, premise included |
| Code 1 | review | **Medium, and the NOT READY** — the Q6 note was **not** emitted. The implementer's diagnosis was accepted as sound (the old `PresentationNote` was a scalar-*spelling* record with no honest `ScalarStyle` for "a deletion left two blank lines") but the deferral still left the user with no disclosure | **Fixed, not dispositioned.** `PresentationNote` became a tagged union — `ScalarRestyled` carrying the old four operands verbatim, plus `DoubledSequenceSeparation { edit }`. Detected in `plan_item_removal` via `removal_doubles_a_blank_separation`; **`lift_item()` and `ItemMove`'s output untouched**, so a move's `notes` stays empty and is now **pinned by a test** rather than only documented. **Neither blank line is collapsed** |
| Code 2 | review | **Low** — `ItemPlacement::After(0)` was accepted against a bare implicit-null `matches:`, which has zero items, contradicting `After`'s own contract. A test codified the three placements as equivalent there, **including the nonexistent anchor** | **Fixed.** The implicit-null branch now returns `NoSuchDestinationItem { items: 0, … }` for every `After(_)`. The old test was **renamed** to `front_and_end_promote_a_bare_key_to_the_same_bytes` — its previous name asserted the very equivalence the finding says is wrong — and `a_promotion_refuses_every_after_anchor` was added beside it |
| Code 3 | review | The single most valuable **missing** test, named | **Added**: `deletion_that_creates_doubled_separation_returns_a_layout_presentation_note` asserts the byte-exact doubled gap, the note in `SaveResult::Saved`, its one-key object on the wire, **and** the negative case |
| Code 4–6 | review | **No finding** in the two commands' correctness, in the invariants (no write outside `save_document`, no `force`, no finding cache, R25, D2), or in i18n and wire-contract completeness | Each reported as an explicit "no finding", not left silent |
| — | orchestrator | The reviewer noted it could not re-run the test and lint totals under its read-only constraint | **Discharged by the table above**, which is the orchestrator's own second run |

---

## Verification — Phase 2b-2c-1

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` | ✅ **959 tests across 21 binaries**, 0 failed (**+32** on 2b-2b-3's 927 — exactly the new `tests/patch_item.rs`) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed — no fixture lost a distinguishing byte, and none was added |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test draft_plan -- every_match_of_the_real_configuration` | ✅ **not a vacuous skip** — 13 files, 65 matches, **65 planned to an empty batch**, 417 intents, **0 refusals**, unchanged by this phase |
| `npm test` | ✅ 29 files, **696 tests**, 0 failed (unchanged — the eight new keys are covered by the existing parity sweeps) |
| `npm run check` | ✅ 376 files, 0 errors, 0 warnings |
| `npm run build` | ✅ built |
| `git status --short --untracked-files=all` | ✅ no path under `tests/corpus/real/` |

**The baseline was re-established before the phase began**, not assumed: `cargo test --workspace` was
run at `0cf7420` and returned **927 across 21 binaries**, matching the previous checkpoint exactly.

**Two claims were re-derived by the orchestrator rather than accepted from the worker or the reviewer.**

1. **The CRLF fix.** `leading_comment_block_start` (`crates/espansoconfig-core/src/patch/edit.rs:6613`)
   steps back over the **whole** terminator — two bytes for `\r\n`, one for a bare `\n` or `\r` —
   before asking `line_start_of` for the line above. That is the defect's actual shape, and the fix
   addresses it rather than papering over it.
2. **The headline test is not a proxy.** `lift_site_of_a_move` in `tests/patch_item.rs` applies a real
   `ItemMove`, discards the landing replacement, splices the departures itself, and compares the
   resulting **bytes** against `RemoveItem`'s output — not two `Ok`s, not a summary.

## Phase 2b-2c-1 review disposition

Two consultations, both closed. The design consult was taken **before any line existed**
(`docs/reviews/phase-2b-2c-1-design.md`); the aggregate code review was taken over the whole
working tree **before the commit** (`docs/reviews/phase-2b-2c-1-code.md`).

| # | Where | Ruling or finding | Disposition |
|---|---|---|---|
| Design Q1 | consult | The three-way cut; `InsertItem` and `RemoveItem` **paired**; `save_raw_document` last | **Adopted** — it is the split table above |
| Design Q2 | consult | `InsertItem` takes a **flat list of scalar key/value pairs**, never caller-supplied YAML text and never an espanso-shaped seed | **Adopted.** Caller-supplied text would put preservation-critical structure in the untrusted caller — the same reason the frontend sends a `MatchDraft` and not an edit list (2b-2b). A typed seed would put espanso's schema inside the generic patch engine |
| Design Q2 | consult | The "no synthesized collection" rule is **narrowed by an explicit exception**, not weakened | **Adopted verbatim** as the variant's doc comment |
| Design Q3 | consult | Flow sequences refused; inconsistent indentation refused; a bare implicit-null `matches:` **promoted**, with a named refusal when its trivia is ambiguous | **Adopted**, error names included. Without the promotion the app could never create the first match in a fresh file |
| Design Q4 | consult | `RemoveItem` is `ItemMove`'s lift half in **shared code**, not a second implementation that agrees | **Adopted**, and pinned by a test that compares the two outputs byte for byte |
| Design Q5 | consult | Removing the only item is refused by name; the UI explains it | **Adopted.** `matches: []` would synthesize a collection; a bare `matches:` would turn a sequence into YAML null. Neither is "remove one existing item" |
| Design Q6 | consult | A `SaveRequest` variant for whole text, never a full-span `DocumentEdit` | **Recorded for 2b-2c-3**, deliberately not built here |
| Code 1 | review | **Low** — §5 of the notes claimed `crlf-line-endings.yml` has *no* entry or item with a leading comment block. It does: a two-line block at column zero above `matches:` | **Fixed**, after independent confirmation — `rg -n '#'` returns exactly lines 1–2 and `rg -n '^[a-zA-Z]'` returns exactly `3:matches:`, so the entry carrying that block is the root mapping's only one and is refused before any envelope is derived. §5 now makes the narrower true claim and names the block rather than denying it |
| Code 2–6 | review | **No finding** in byte preservation, the `ItemMove` regression surface, vacuous tests, the refusals, or the wire additions | Each reported as an explicit "no findings", not left silent. The reviewer re-derived the two claims the brief singled out rather than accepting the implementer's framing |

---

## Verification — Phase 2b-2b-3

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` | ✅ **927 tests across 21 binaries**, 0 failed (**+10** on 2b-2b-2's 917) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed — no fixture lost a distinguishing byte |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test draft_plan -- every_match_of_the_real_configuration` | ✅ **not a vacuous skip** — 13 files, 65 matches, **65 planned to an empty batch**, 417 intents, **0 refusals**, unchanged by this phase |
| `npm test` | ✅ 29 files, **696 tests**, 0 failed (**+11** on 685) |
| `npm run check` | ✅ 376 files, 0 errors, 0 warnings |
| `npm run build` | ✅ built |
| `rg -c '#\[tauri::command\]' src-tauri/src/` | ✅ `commands.rs:8`, `menu.rs:1` — **the eighth command**, and the second that writes |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1); no corpus fixture modified; **no probe scaffold left behind** |

**One verification caught a failure a worker's report did not.** The step-C worker reported
`cargo test --workspace` green; the orchestrator's own run came back **121 passed / 1 failed** —
`every_typescript_wire_union_has_a_namespace` panicking with *"only 43 unions were examined"*. The
non-vacuity floor had been set to the measured 44, and making `DraftError` uniformly object-shaped
removed the only single-quoted member it had, so it stopped counting as a union at all. Fixed in
place, with the reason written at the assertion (D6, `2b-2b-3-notes.md` §5). **This is the whole
argument for re-running every gate rather than reading a report**, and it is the second time this
project has been paid for it.

**What this phase proves.** `save_match` exists, is registered, is reachable through the real
dispatcher, and writes a user's file through `save_document` and nothing else. A drafted scalar
change commits and re-mints an identity; a draft that changes nothing comes back `committed: false`
as a **success**; a `DraftError` crosses as `draftRefused` carrying indices only; a stale
`base_revision` is refused before any transaction is built; and a `PresentationNote` reaches
`SaveResult::Saved::notes` — its **first producer** since 2b-1 put it on the wire.

**Four things it does *not* prove.**

- **No screen calls it.** There is a command, a typed wrapper and a compile-checked accessor, and no
  component invokes any of them. The thirty-two `code.draftError.*` strings have never been drawn.
- **The real configuration exercises none of the interesting path.** All 65 real matches plan to an
  **empty** batch — the property 2b-2b-1 and 2b-2b-2 wanted, and the reason the real corpus says
  nothing about a batch that is not empty.
- **32 Spanish values were added and are checked only by heuristic**, like the 170+ before them.
- **The clean review is weaker than it looks.** See the disposition below.

---

## Phase 2b-2b-3 review disposition

Two Codex consultations, both recorded in full.

| Consult | File | Outcome |
|---|---|---|
| Design, **before** implementation | [`docs/reviews/phase-2b-2b-3-design.md`](docs/reviews/phase-2b-2b-3-design.md) | Three rulings, all three adopted unchanged — D1/D2/D3 in `2b-2b-3-notes.md` §2 |
| Aggregate code review, before the commit | [`docs/reviews/phase-2b-2b-3-code.md`](docs/reviews/phase-2b-2b-3-code.md) | **No finding at any severity**; readiness verdict for 2b-2c |

**The design consult's three rulings were adopted as written**, and each is recorded with the
argument *against* it rather than only the argument for:

- **D1** — a `DraftError` is an `Err(CommandError::DraftRefused)`, not a `SaveResult` variant,
  because it is planning-time and **non-overridable** where `SaveResult::Refused` is transactional
  and overridable. The cost the consult named and the phase accepted: a draft refusal is an expected
  domain outcome, so generic `Err` handling will render it as a toast unless the frontend routes
  this code to inline form feedback. **That obligation is now owed by whichever phase builds the
  editor screen.**
- **D2** — a success re-mints its identity from the match's **own** projected path, so a match that
  is not addressable as a sequence item is still editable. A committed write is never afterwards an
  `Err`.
- **D3** — an empty batch still goes to `save_document`, so the under-lock revision check is never
  skipped.

**The clean code review is honestly weaker than "no defects were present."** One real defect was
found in this phase — `MatchHasNoPath` was the single unit variant of thirty-two and would have
demoted a typed refusal to *unexpected failure* — and it was found **before** the review, by the
orchestrator, reading a worker's own report rather than by any test. The review then looked at the
repaired tree. A clean review of a tree whose one known defect has already been fixed is not the
same evidence as a clean review of the tree as first written, and the review file says so at the
top rather than leaving the reader to notice.

**Why no test caught that defect, which is the part worth keeping.** Both halves of the contract
were individually correct: the dictionary had the string, the exhaustiveness check passed, the
operand-shape table matched its sample. Nothing anywhere asked whether **the sample was
representative**. `every_draft_error_variant_crosses_as_an_object` now asks it, from the enum's
parsed variant list rather than from a sample.

---

## Verification — Phase 2b-2b-2

Every command below was run **by the orchestrator**, each as its own invocation, not taken on the
worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` | ✅ **913 tests across 21 binaries**, 0 failed (**+31** on 2b-2b-1's 882; `draft_plan.rs` holds 82) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed — no fixture lost a distinguishing byte |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test draft_plan -- every_match_of_the_real_configuration` | ✅ **not a vacuous skip** — 13 files, 65 matches, **65 planned to an empty batch**, **417 intents** drafted, **0 refusals**; open half **38 variables, 48 `params` entries, 0 form fields, 0 options** |
| `npm test` | ✅ 28 files, **685 tests** — unchanged, as it must be |
| `npm run check` | ✅ 375 files, 0 errors, 0 warnings |
| `npm run build` | ✅ built |
| `rg -c '#\[tauri::command\]' src-tauri/src/` | ✅ `commands.rs:7`, `menu.rs:1` — **no command added**, which is the point |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1); no corpus fixture modified |

**What this phase proves.** The 2b-2b-1 headline property now runs over the open half too: every one
of the owner's 65 real matches, drafted with **all 417** of its in-scope fields `Set` to the value the
file already holds — 114 of them new, from 38 variables and 48 `params` entries — derives an **empty
batch**. Zero edits, zero refusals. The synthetic twin runs without the real corpus (33 files, 150
matches, 139 planned, 369 intents, 14 variables / 20 params / 3 form fields / 5 options), so CI on a
fresh clone still checks it.

**Two guard tests are the phase's sharpest instruments**, and both were read by the orchestrator
rather than taken on report:

- `a_path_one_segment_deeper_than_the_surface_is_refused` walks **six** paths one segment past the
  deepest legal shape and refuses each as **both** a scalar edit and a removal. This is what stops
  the widening from becoming "anything under `vars`".
- `the_guard_refuses_a_nested_key_the_mapping_writes_twice` gives the guard a `params` written
  `format`, `offset`, `format` and shows it refuses a batch naming `format` while admitting one
  naming `offset`. **The duplicate is at an index the batch does not name** — which is exactly the
  case a guard built from the batch's own keys would pass.

**Four things it does *not* prove.**

- **The aggregate code review was not run *in this phase's session*.** See the disposition below — it
  was a known, recorded gap rather than an omission discovered later, and it was **discharged at the
  head of the following session**: `docs/reviews/phase-2b-2b-2-open-key-code.md`, one finding, closed
  in the fix round recorded under "Verification — Phase 2b-2b-2 code review" below.
- **No screen was read**, and there is still no command, no IPC type and no i18n key for any of this.
  The four `code.diagnosticCode.*` strings 2b-1 corrected are now a debt **four** phases old.
- **The real configuration holds zero `form_fields`.** Every claim about that surface rests on
  synthetic fixtures and will keep doing so — the same permanent shape as 1c-2b-2b-2's finding about
  unmodelled entries. 48 real `params` entries were swept; **0** real form-field options were.
- **Four refusals are unreachable from any document** in either corpus — the hazard gate refuses the
  match first, or the projection never produces the state. Each test says so rather than implying
  coverage. **The code review's fix round made it five**, for the same reason and with the same
  honesty: see below.

---

## Verification — Phase 2b-2b-2 code review

The aggregate code review 2b-2b-2 owed, run at the head of the next session, plus its fix round.
Every command was run **by the orchestrator**, each as its own invocation.

| Command | Result |
|---|---|
| `cargo test --workspace` (baseline, before any change) | ✅ **913 tests**, 0 failed — the checkpoint's figure reproduced exactly on a cold start |
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` (after the fix) | ✅ **917 tests across 21 binaries**, 0 failed (**+4**; `draft_plan.rs` 82 → 86) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo doc -p espansoconfig-core --no-deps` | ✅ **no new warning** — the pre-existing private-item links are unchanged and none is in `draft/error.rs` |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test draft_plan -- every_match_of_the_real_configuration` | ✅ **not a vacuous skip** — figures unchanged from 2b-2b-2: 65 matches, 65 empty batches, 417 intents, 0 refusals |
| `rg -c '#\[tauri::command\]' src-tauri/src/` | ✅ `commands.rs:7`, `menu.rs:1` — still no command, as 2b-2b-2 requires |
| `npm test` / `npm run check` / `npm run build` | **not run, and not needed** — no file under `src/` or `src-tauri/` is touched. Stated rather than implied, the way 2a-1's entry does |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1); no corpus fixture modified |

**The review's one finding, and why the fix is worth having even though nothing can reach it.** Codex
found that a variable's **own** mapping is audited by neither mechanism that refuses an ambiguous key:
`nameable_key` is never consulted for a path composed from `VariableField::key()`, a literal, and
`check_every_named_key_is_unique` only judges a mapping the planner recorded a `NestedKeys` for —
which is the `params` mapping, never the variable's own. Both halves of that are true.

**Its stated consequence is not, and the correction is the most useful thing the round produced.** A
repeated key raises `HazardKind::DuplicateMappingKey` on the mapping holding it, and
`TriviaIndex::disqualifying_hazard` counts a hazard on a **descendant** — so a duplicate inside a
variable disqualifies the whole match, and `plan_match_edits`' third step refuses with
`MatchNotEditable` before `plan_vars` is entered. There is no silent edit and no wrong-node write.
The finding is therefore an **unnamed** ambiguity behind a coarser gate, not an unrefused one.

It was closed anyway, for three reasons recorded in the review file: the masking gate is coarse (one
duplicate anywhere makes a whole match uneditable) and Phase 2c is precisely the phase that will want
to narrow it; this crate already restates invariants across layers on purpose (`draft/mod.rs`: the
closed-surface invariant "is stated three times"); and the projection already held the answer in
`variable.unknown_entries` and was simply not asked.

**The unreachability is asserted, not just documented.** `AmbiguousVariableKey`'s doc comment carries a
*"No projected document reaches it today"* section — placed at the variant because 2b-2b-3 owes it a
dictionary string and would otherwise write a sentence for a code no user can see — and the test helper
`one_match_with_its_duplicate_admitted` **asserts** `blocking_hazard == Some(DuplicateMappingKey)`
before forcing the state. If a later phase narrows the gate, that assertion fails and the claim gets
re-read instead of rotting.

---

## Phase 2b-2b-2 code review disposition

[`docs/reviews/phase-2b-2b-2-open-key-code.md`](docs/reviews/phase-2b-2b-2-open-key-code.md) is the
aggregate **code** review 2b-2b-2 owed and could not afford. It was run at the head of the following
session against the written code, and the brief was narrowed deliberately — three questions, a named
four-file scope, a 900-word cap and an explicit ban on web search — because the previous session's two
Codex jobs on this phase had run 26 and 20 minutes and the first had to be cancelled with zero output
events. **This one returned in 1 minute 53 seconds.** The three questions were the three places the
2b-2b-2 checkpoint itself named as invisible to the 82 tests.

| # | Finding | Disposition |
|---|---|---|
| Q1 | `plan_open_mapping`'s index-to-key resolution: is the index consumed against the same list, in the same order, the projection presented? | **NONE FOUND**, accepted and spot-checked. The index addresses the projected `&[FieldView]` unfiltered and unreordered; out-of-range refuses before a path is built; `nameable_key` refuses a non-scalar, undecoded or duplicated key |
| Q2 | **The one finding.** A variable's own mapping is audited by neither `nameable_key` nor `check_every_named_key_is_unique`, so a repeated `name` / `type` / `inject_vars` / `params` key gets no refusal of its own | **Fixed**, and **downgraded twice while being verified**: not a wrong-node write (projection and resolver both take the first occurrence), and not even an unrefused one (the hazard gate refuses the whole match first). `DraftError::AmbiguousVariableKey { variable }` is the nested refusal, index-only per D1, unreachable today and documented as such |
| Q3 | Does `check_closed_surface` admit a `DocumentPath` shape the seven/four enumeration did not intend? | **NONE FOUND**, accepted. The admitted set was re-derived from the code's suffix patterns rather than its comments, and the two agree |

---

## Phase 2b-2b-2 review disposition

[`docs/reviews/phase-2b-2b-2-open-key-design.md`](docs/reviews/phase-2b-2b-2-open-key-design.md) is a
Codex **design** consult, run before implementation and delivered mid-flight to the worker. It ruled
on D1–D6 as specified and returned one finding that could have produced a wrong-node edit.

**What was reviewed, and what was not — stated plainly because the difference matters.** The consult
judged the *design*, described to it in prose. **No Codex review of the written code was run**, and
the `/goahead` policy asks for one per phase. The reason is not that it was judged unnecessary: two
consecutive Codex jobs on this phase ran 26 and 20 minutes, the first had to be cancelled after
consuming 26 minutes with zero output events, and the orchestrator reached its context budget before
a third round could be spent. **The aggregate code review is therefore carried forward as the first
item of the next session**, below.

| # | Finding | Disposition |
|---|---|---|
| F1 | **The one that mattered.** Grouping derived edits per mapping does not replace a full-mapping duplicate scan: an *unedited* duplicate still makes an edited path ambiguous, because `path::resolve` takes the **first** match | **Fixed as specified.** `NestedKeys` carries the **whole** mapping's key list, with repetitions. Tested with the duplicate at an index the batch does not name — the case a batch-derived key list passes |
| F2 | Prefix containment is sound at mixed depths **only because** paths address concrete syntax nodes and aliases are never followed. That invariant was load-bearing and unwritten | **Fixed.** Written into `check_no_removal_contains_another_edit`, including the harmless disagreement — a removal's envelope swallows comments and blank runs no path names |
| F3 | The equality rule cannot distinguish a quoted `'true'` from a plain `true`; both decode to `"true"` | **Recorded as hole 1, not coded.** The consult's suggested fix — compare source text for `params` — was **refused**: it would be a second equality rule, and 2b-2b-1 §11 is explicit that a second comparison is a second answer to a question that has one. Addressed to `ScalarView`'s owner. `null` vs an empty value *are* distinguished and are excluded from the hole |
| F4 | No refusal is locally more dangerous than acting; the worst case is a user falling back to hand-editing YAML, which is a UX consequence and not permission to delete unseen bytes | **Accepted, no change.** Recorded as the reason D1 and D4 refuse rather than guess |
| F5 | Named what 2b-2c must **undo** rather than extend, and confirmed D1's ban on author-chosen keys need not be undone by sequence insertion | **Recorded** in §11 of the notes |

---

## Verification — Phase 2b-2b-1

Every command below was run by the orchestrator **after** the review fix round, each as its own
invocation, not taken on any worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` | ✅ **882 tests across 21 binaries**, 0 failed (**+54** on 2b-2a's 828: 39 in the first pass, 15 more in the review fix round) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed — no fixture lost a distinguishing byte |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test draft_plan -- every_match_of_the_real_configuration` | ✅ **not a vacuous skip** — 13 files, 65 matches, **65 planned to an empty batch**, 303 intents drafted, **0 refusals** |
| `npm test` | ✅ 28 files, **685 tests** — unchanged, as it must be |
| `npm run check` | ✅ 375 files, 0 errors, 0 warnings |
| `npm run build` | ✅ built |
| `rg -c '#\[tauri::command\]' src-tauri/src/` | ✅ `commands.rs:7`, `menu.rs:1` — **no command added**, which is the point |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1); no corpus fixture modified |
| `git check-ignore -v …/corpus/real/match/base.yml` | ✅ `.gitignore:107` still covers it |

**What this phase proves, and it is the strongest evidence this project has produced for a
byte-preservation rule.** The headline property is not a hand-authored fixture passing: **every one
of the owner's 65 real matches, drafted with all 303 of its in-scope fields `Set` to the value the
file already holds, derives an empty batch.** Zero edits, zero refusals. The synthetic twin runs
the same property without the real corpus (33 files, 150 matches, 139 planned, 315 intents), so CI
on a fresh clone still checks it rather than skipping.

The inline fixture is the sharper instrument, because it is *adversarial*: it asserts its own
non-vacuity before testing anything — that all five scalar styles are present among its eighteen
fields, and that no two fields decode to the same string, so a planner reading one field's value
while writing another's path would still be caught.

**Four guards were verified by making them fail on purpose and reverting**, which is this project's
standing discipline for a check nobody has seen fail: the F5 tripwire (a `DraftError` reference
planted in `save.rs`), the real-corpus skip, the `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1` failure
path, and `git check-ignore` after restoring the corpus.

**Four things it does *not* prove.**

- **No screen was read**, and no command exists to read one through. `plan_match_edits` has no
  caller outside its own tests. **The four `code.diagnosticCode.*` strings 2b-1 corrected are now
  a debt three phases old** — the next phase that opens a window still owes the look.
- **The guards are not independent validation of the planner's intent**, and saying so was a
  review finding. They are closed-surface and batch-dependency checks over a *derived batch*: they
  share the planner's `MatchField::from_key` vocabulary and inspect **paths**, not nodes or
  original cardinality. A hand-built edit to `triggers[999]` passes both. `audit.rs`'s module
  documentation now says this instead of claiming a defect in the planner cannot bend them.
- **`NotDecodable` is reached by constructing the view state**, not by a document. No file in
  either corpus produces `decoded == false` — the corpus tests pin that count at zero — so the
  refusal is real but its trigger has never occurred naturally.
- **Nothing here has met a user's real match through a form.** Whether the eighteen keys are the
  eighteen a form would offer is 2b-2b-3's question, not this phase's answer.

---

## Phase 2b-2b-1 review disposition

[`docs/reviews/phase-2b-2b-1-draft-engine.md`](docs/reviews/phase-2b-2b-1-draft-engine.md) — two
blocking, four should-fix, four overclaims. The design consult that preceded the phase is
[`docs/reviews/phase-2b-2b-draft-design.md`](docs/reviews/phase-2b-2b-draft-design.md), and its six
rulings are what the phase was built to. **Two of the review's fixes were narrowed or refused, and
those are the two worth re-reading before 2b-2b-2.**

| # | Finding | Disposition |
|---|---|---|
| F1 | **Blocking.** Two draft intents at one sequence index: the no-op one is erased as a logical no-op *before* the batch exists, so `ScalarEditedTwice` never fires and draft order silently becomes last-wins | **Fixed.** `check_no_index_is_drafted_twice` runs at intent level, before any diffing, with `DraftError::SequenceItemDraftedTwice`. Batch-only auditing cannot recover an intent already erased — that is the lesson, not the variant. The `MatchField` analogue is closed by serde rejecting a repeated JSON key, and that is **tested rather than assumed** |
| F2 | **Blocking.** `Remove` on a key whose value is a collection is refused by *source* shape, contrary to ruling 4's "removal may discard an existing subtree" | **Refusal kept; fix narrowed.** Deleting bytes the visual editor never displayed is the class of silent destruction this project refuses on principle, and a sub-phase built for conservatism is the wrong place to grant it. Reachability was **answered by a test** — such a match *is* `safely_editable` with no hazard, so the planner is what decides, not the gate. The removal half became `RemovalWouldDiscardUnshownStructure`, named for the real reason. Ruling 4 is narrowed **as a recorded decision**, not an oversight |
| F3 | **Should-fix.** `triggers: []` is invisible to `visible_entries`, so a match whose only entries are empty sequences refuses an insertion that ought to work | **Recorded, not coded.** The proper fix is carrying the sequence entry's own span in `MatchView` — a read-model change, out of scope. Behaviour pinned by a test. The sharper half is now hole 9: **an empty `Vec<ValueView>` cannot distinguish "absent" from "present but empty"**, and that ambiguity is addressed to `model/match_view.rs` by name |
| F4 | **Should-fix.** The guards are not the independent second statement `audit.rs` claimed | **Claim fixed, code kept.** The module documentation now describes what they are and names three things they do not establish |
| F5 | **Should-fix.** The TEMPORARY `DraftError` exclusion makes the exhaustiveness test *pass*, so forgetting to delete it ships an untranslated code silently | **Fixed with a build-failing tripwire.** `the_temporary_draft_error_exclusion_expires_when_anything_names_it` fails the moment production Tauri code names `DraftError` while the exclusion stands, and **self-disables** once the exclusion is gone. It asserts the module scan found ≥5 production modules so it cannot pass vacuously. No dictionary entries added — nothing serializes a refusal yet |
| F6 | **Should-fix.** `MatchField::UppercaseStyle` serialized as `"UppercaseStyle"`, making the `NOT_A_CODE` justification "rendered literally as the espanso key" **false** | **Fixed.** `#[serde(rename_all = "snake_case")]` on both enums, every variant's spelling pinned against `key()`. One existing assertion updated from `"Triggers"` to `"triggers"` |
| F7 | **Note.** Four overclaims in the decision record | **All four corrected**, including the one claiming `dictionary_contract.rs` would fail the build if the temporary exclusion survived — it would not, which is exactly why F5 exists |
| F8 | *Orchestrator's own finding, not the reviewer's* — the headline property ran only over inline fixtures | **Fixed.** Real-corpus sweep plus an always-running synthetic twin. This is the phase's strongest evidence and it did not come from the review |

---

## Verification — Phase 2b-2a

Every command below was run by the orchestrator **after** the review fix round, each as its own
invocation, not taken on any worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo build --workspace` | ✅ built |
| `cargo test --workspace` | ✅ **828 tests across 20 binaries**, 0 failed (**+30** on 2b-1's 798: 25 in the first pass, 5 more in the review fix round) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed — no fixture lost a distinguishing byte |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test persist_save -- saving_the_real_configuration` | ✅ **not a vacuous skip** — 13 files, 65 matches, 13 committed, **0 refusals** |
| `npm test` | ✅ 28 files, **685 tests** (681 before the fix round, 671 at 2b-1) |
| `npm run check` | ✅ 375 files, 0 errors, 0 warnings |
| `npm run build` | ✅ built |
| `rg -c '#\[tauri::command\]' src-tauri/src/` | ✅ `commands.rs:7`, `menu.rs:1` — **exactly one command added**, and it is `move_match` |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1); no corpus fixture modified |

**What this phase proves, and it is a first.** Before it, every `#[tauri::command]` in this
application was read-only and the code that could destroy a file had no caller outside its own
tests. `move_match` is the first path by which a window can change a user's file, and it is proven
end to end: a move commits, its returned identity resolves in the new revision through `get_match`,
the identity that was passed in comes back as `identityStaleRevision`, the session serves the new
bytes from both surfaces that could have served a stale parse, a stale `base_revision` produces the
conflict arm, an unacknowledged suspicion refuses the move until the findings are serialized and
handed back, and the bytes the move did not touch are compared **byte for byte** against a text
derived independently of the command.

**Three things it does *not* prove, each recorded because it will be tempting to assume otherwise.**

- **No screen was read.** Nothing in this project renders a Svelte component in an automated test,
  so the frontend suite passing says nothing about what a window shows. `move_match` has no user
  interface at all yet — 2c owns that — and **the first phase that opens a window still owes the
  look at the four `code.diagnosticCode.*` strings 2b-1 corrected**, which is now a debt two phases
  old.
- **The conflict payload's honesty rule is pinned below the command**, not through it. Both reads
  happen inside one synchronous call, so no test can interleave a third writer between them; the
  rule is discriminated against `conflict_after_the_lock` directly.
- **The cross-*sequence* refusal is unreachable through `move_match`.** Every match a `DocumentView`
  holds is an item of the one `matches` sequence at the root of stream document 0, so two matches of
  one file are always siblings. The check exists to keep D2r true the day the projection grows a
  second sequence; it is exercised against addresses. The cross-**document** case is reachable and
  is tested.

---

## Verification — Phase 2b-1

Every command below was run by the orchestrator **after** the review fix round, each as its own
invocation, not taken on any worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` | ✅ **798 tests across 20 binaries**, 0 failed (**+11** on 2a-3b's 787: 9 in the first pass, 2 more in the review fix round) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed — no fixture lost a distinguishing byte |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test persist_save -- saving_the_real_configuration` | ✅ **not a vacuous skip** — 13 files, 65 matches, 13 committed, **0 refusals** |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test persist_backup -- backing_up_the_real` | ✅ 13 files copied into one batch, 0 with no editable scalar |
| `npm test` | ✅ 28 files, **671 tests** (662 at 2a-3b) |
| `npm run check` | ✅ 375 files, 0 errors, 0 warnings |
| `npm run build` | ✅ built |
| `rg -c '#\[tauri::command\]' src-tauri/src/` | ✅ `commands.rs:6`, `menu.rs:1` — **unchanged from `HEAD`**, checked against `git show HEAD:…` |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1); no corpus fixture modified |

**The claim this phase does *not* make.** 157 variants have shapes and strings and **zero callers**.
The dictionary contract proves every variant has two entries and the wire contract proves the JSON
shape is what it says; **nothing proves any of it is useful**, and nothing will until 2b-2. No Svelte
component calls any of the eighteen new accessors, so **no screen was read for this phase** and none
needed to be. This is the exposure 1b-1 accepted for the i18n layer, deliberately, and it is why 2b-1
is a phase rather than a commit.

**The deletion experiment, re-run by the orchestrator's instruction rather than taken on trust.** With
`code.backupError.destinationExists` removed from `en.json`, **both** sides failed:
`dictionary_contract::the_code_dictionary_is_exactly_the_declared_variants` and
`the_spanish_dictionary_declares_the_same_code_keys` on the Rust side, `dictionaries.test.ts > key sets`
on the frontend. Restored; both suites green. A variant serialized without its string cannot reach a
commit.

---

