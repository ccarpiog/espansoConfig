# Phase 2a-2b — the save transaction around the two gates

**What this sub-phase is.** Steps **3, 4 and 12** of `IMPLEMENTATION_PLAN.md` §6.6, wrapped around
the primitive 2a-1 built (steps 1, 2 and 6–11) and the report 2a-2a built (step 5), plus the one
thing neither of them was allowed to decide: **the blocking policy**. It writes no backup (step 13
is 2a-3's), crosses no IPC boundary, renders no screen and derives no `Serialize`.

**The one sentence that defines it:**

> **One lock, taken once, held from the revision check to the rename — with the bytes read inside it,
> both gates run inside it, and a refusal that leaves the file byte-identical.**

Everything else in this document is either a consequence of that sentence or a decision the sentence
does not make. The sharpest of those is §2.

---

## 1. What was built

**`crates/espansoconfig-core/src/persist/save.rs`** — the transaction. Public surface:

| Item | What it is |
|---|---|
| `save_document(SaveRequest) -> Result<SavedDocument, SaveError>` | steps 1 to 12, under one lock |
| `SaveRequest` | the context, the base revision, the edits and the acknowledgement. A struct rather than four positional arguments, because one of them decides whether a user's file is written |
| `SavedDocument` | step 12's answer: the verified revision, the candidate text, the replacements, the presentation notes, the findings, and whether the file was actually rewritten |
| `verdict(&[Finding], &Acknowledgement) -> SaveVerdict` | **the blocking policy**, as a pure function of its two inputs (§2) |
| `SaveVerdict` (3 variants) · `SaveVerdict::proceeds()` · `SaveVerdict::name()` | proceed, refuse for editor-model errors, refuse for unacknowledged suspicions |
| `Acknowledgement` · `none()` · `of()` · `len()` · `is_empty()` · `covers()` · `covers_all()` | acknowledgement **by content**, holding only `SuspiciousButPermitted` findings. `covers` is membership; `covers_all` is the **multiset** match the gate uses (§9, finding 3) |
| `SaveRefusal` | the verdict plus **every** finding of the candidate, both classes |
| `SaveError` (8 variants) · `is_refusal()` · `may_have_written()` · `findings()` · `syntax_gate_failure()` | the typed failures, and the four questions a caller asks of one |

**`crates/espansoconfig-core/tests/persist_save.rs`** — 29 tests. Every fixture is a hand-authored
neutral `const`; the fifteen byte-exact corpus fixtures are **copied into a `TempDir`** before
anything writes, so nothing under `tests/corpus/` is touched. **15 more unit tests** live beside the
code because the policy is a pure function that deserves to be checked without a temp directory.

**`crates/espansoconfig-core/src/persist/write.rs`** — 2a-1's primitive, touched by the review round
and by nothing else (§9, finding 8). `inspect_target` and `InspectedTarget` became `pub(super)` so
the transaction's own read goes through them, and the open gained **`O_NONBLOCK`**. Not one line of
its metadata handling changed, and hazard 11 is exactly where 2a-1 left it (§9, finding 1).

**`crates/espansoconfig-core/src/persist/mod.rs`** — the module documentation gained the 2a-2b scope
and the re-exports; the sentence saying steps 3 to 5 and 12 were "still to come" is gone.

**`crates/espansoconfig-core/src/lib.rs`** — the phase table gained a **2a-2b** row.

Nothing under `tests/corpus/` was added, moved or reformatted, and `tests/corpus_integrity.rs`
passes unchanged.

### One thing was added that the brief did not name, and it is a decision

**A file `FileKind::is_read_only()` calls read-only is refused before the lock is taken.** That
predicate's doc comment has said *"the editor must refuse to write this file"* since Phase 0a, and
`save_document` is the only code in the crate that writes on the editor's behalf — so this is the
place where that sentence either becomes true or stays aspirational. It is one match arm, one
variant (`SaveError::DocumentIsReadOnly`) and one test, and E9 fires. Refusing **before** the lock is
deliberate: locking a path against writers that are never allowed to exist buys nothing.

---

## 2. Decision — the blocking policy

The policy is `verdict(findings, acknowledgement)`, and it is:

| Candidate produces | Result |
|---|---|
| nothing | `Proceed` |
| any `EditorModelError` | `RefusedForEditorModelErrors` — **no override at this entry point** |
| suspicions, none acknowledged | `RefusedForUnacknowledgedSuspicions` |
| suspicions, **all** acknowledged by content | `Proceed`, and the findings are returned on the success path |
| an error beside an unacknowledged suspicion | `RefusedForEditorModelErrors` — the error is what the caller most needs to hear first |

Three properties are load-bearing, and each of them is a thing that could have been done otherwise.

### 2.1 The two classes are treated differently, because they are separated by one question

2a-2a §3 draws the line once: *does the claim rest on a vocabulary espanso can extend without
telling us?*

- **No → `EditorModelError`.** "Exactly one content field", "exactly one trigger form", "a parameter
  whose absence is an observed failure path in espanso 2.3.0's own source". These are shapes espanso
  cannot grow out of. If this crate is wrong about one of them, the answer is to fix the rule — not
  to give every user a button that routes around it. So there is no acknowledgement for one.
- **Yes → `SuspiciousButPermitted`.** This class exists *because* the crate may be wrong. A gate that
  could not be passed on a claim the crate itself calls unprovable would be the app asserting an
  authority it does not have — the same mistake as "espanso will reject this", one level up. So it is
  refused **until acknowledged**, and never silently ignored.

**The refusal is of *this save*, not of the file.** A document that arrives already carrying an
`EditorModelError` can still be repaired through the visual editor: any save that also removes the
finding is accepted. `a_save_that_removes_the_editor_model_error_is_accepted` pins both halves — an
unrelated edit on the same document is refused, and the edit that fixes it is not. What the user
cannot do is **leave** the finding standing, which is exactly plan §7's hazard 4. The residual cost —
a multi-step repair that passes through a still-broken intermediate state cannot be saved
incrementally — is real and is hole 1.

### 2.2 An acknowledgement is by content, never by flag

`Acknowledgement::of(&[Finding])` stores the exact findings the caller was shown, and
`save_document` refuses unless **every** suspicion the candidate produces is one of them.

A boolean — `ignore_warnings: true`, `force: true` — was the obvious alternative and was rejected
outright. It lets a caller wave past findings it never looked at, and plan §6.6's whole reason for
classifying diagnostics is that somebody looks.

**What that buys, stated exactly.** An earlier draft of this section claimed a blanket "accept
everything" *cannot be written*. **That claim was false and is withdrawn** (§9, finding 4).
`crate::validate::validate` is public and `Finding` is publicly constructible, so a caller can
compute the candidate's findings itself and acknowledge every one of them on the first call, without
a refusal ever happening and without a user ever seeing anything. The property that is actually
true is narrower and is worth having on its own:

> An acknowledgement **names specific findings by content**, so it cannot survive the findings
> changing. It is a claim about one candidate's bytes, and any edit that moves a span, changes an
> operand or adds an occurrence invalidates it.

**Nothing in this crate can establish that a human saw a finding.** Content matching is not proof of
presentation and not proof of consent; enforcing presentation is the **user interface's** obligation,
and 2b owes it — the save command must not offer a caller a way to acknowledge findings it did not
first receive from a refusal and display. This project's rule is that silence and certainty are both
wrong answers to an unestablished fact, and an overclaim in a decision record is that same failure in
a different place.

The natural flow is the one the type is shaped for: call once with `Acknowledgement::none()`, get
`SaveError::Refused` carrying the findings, show them, call again with `Acknowledgement::of(...)`.
The second call re-reads under the lock, re-patches and re-validates, so what the user agreed to is
re-derived rather than trusted. Equality is `Finding`'s own — code, operands, span, node and path —
so a finding whose **span moved** is a different finding and the acknowledgement no longer covers it.
That strictness is the point, and E5b is what shows a weaker match would go unnoticed by five
tests.

**Multiplicity is part of the content.** `validate` can report the *same* finding twice — an
unresolved reference is reported once per occurrence while each finding records the whole scalar's
span, node and path rather than the occurrence's — so the gate matches acknowledged against candidate
findings as a **multiset** (`Acknowledgement::covers_all`), and *n* equal suspicions need *n*
acknowledged copies. `Acknowledgement::covers` is still membership and is still public, for a caller
asking *"was this one shown?"*; its doc comment now says plainly that it loses multiplicity and must
not be used to decide whether a candidate may proceed. E15 fires.

`Acknowledgement::of` **drops** anything that is not `SuspiciousButPermitted` at construction rather
than refusing it later, so `len()` reports what was really accepted and a caller cannot come to
believe it has waved an error past. `an_editor_model_error_cannot_be_acknowledged_past` feeds a
refusal's own findings straight back — the strongest acknowledgement a caller could build — and the
verdict does not move.

### 2.3 Findings are returned on the success path too

`SavedDocument::findings` is non-empty exactly when the save proceeded past acknowledged suspicions.
A save that went past something has to be able to say what it went past — for a log, for an "issues"
badge, for the sentence a UI shows afterwards. It never holds an `EditorModelError`, because that
verdict has no success path.

### 2.4 What was rejected, and why

| Alternative | Why not |
|---|---|
| **Refuse on nothing; report only** | Then `validate` and the transaction would both be reports and hazard 4 would have no defence anywhere. Plan §6.6 calls step 5 a **gate**; something has to gate |
| **Refuse on both classes with no override** | An unresolved `{{reference}}` is classed suspicious precisely because this crate's model of espanso's *scoping* is a model (2a-2a §6). Refusing outright on it would make a working configuration unsaveable on the strength of a claim the notes themselves call unprovable |
| **Acknowledge both classes, with two flags** | `SavePolicy { accept_suspicions, accept_errors }` reads as configuration, and `{ true, true }` is one line away from no gate at all. Worse, neither flag proves anyone looked |
| **Refuse only on findings the *edit introduced*** (diff against the original's findings) | Needs a third parse and a projection of the original, and "introduced" is not well defined once spans move: the same finding on a shifted span is not obviously the same finding, and deciding that would be a second, unstated policy |
| **`Ok(SaveOutcome::Refused)` instead of an error variant** | Considered seriously — it makes a refusal maximally distinguishable. Rejected for consistency: 2a-1 already puts its refusals (`RevisionMismatch`, `TargetChangedDuringWrite`) inside `WriteError`, and two conventions for "declined" in one module is how a caller comes to handle one and not the other. `SaveError::is_refusal()` answers the same question, with the `WriteError` arms matched **exhaustively** so a new variant of that type is a compile error rather than a silent default |
| **Put the policy in `crate::validate`** | 2a-2a §11 forbids it, and it is right: the classifier is not the gate. Nothing in `crate::validate` changed in this sub-phase |

### 2.5 One more decision the policy forced: an unchanged candidate is not written

If the candidate comes out **byte-identical** to what the file already holds — which an empty batch
always produces, and an edit that writes a scalar's existing value can — the rename is skipped and
`SavedDocument::committed` is `false`. Both gates still ran.

**That path re-reads the target before it returns** (§9, finding 2). The committed path ends with the
primitive's own read-back at step 11, so its revision describes bytes that were on disk moments
earlier; skipping the commit used to skip every check between the step-2 read and the return, which
made `SavedDocument::revision` a claim about bytes last seen before a patch, two parses, a projection
and a validation. The file is now read again under the lock and compared with `base_revision`, and a
disagreement is `SaveError::RevisionMismatch` — the same answer the committed path gives for the same
situation. This makes the window **one read wide instead of one validation wide**; it does not close
it, and nothing at this layer can (2a-1 D4). `SavedDocument`'s "provably holds" wording is gone from
both fields, on both paths.

The reason is 2a-1 §4: **every rename installs a new inode and drops eight classes of metadata** —
ownership, group, POSIX ACLs, extended attributes, resource forks, creation time, BSD flags and hard
links, with the ACL case being an access-control *broadening*. Paying that for a document that did
not change buys nothing at all. `a_candidate_identical_to_the_target_is_not_rewritten` asserts the
inode is unchanged, which is the same mechanism 2a-1 used to prove the opposite about a real write.
E11 fires on four tests.

---

## 3. Decision — step 4 is not reimplemented, and here is exactly what it covers

`crate::patch::apply_edits` **already performs §6.6 step 4**, and calling it discharges the step.
This was established by reading `verify()` at `crates/espansoconfig-core/src/patch/edit.rs:4677`,
not assumed.

### What `verify` checks, in the order it checks it

| # | Property | Function |
|---|---|---|
| 1 | every replacement lies wholly inside a span the edit is permitted to rewrite | `replacements_stay_inside_the_permitted_spans` |
| 2 | every byte outside the replaced spans is byte-identical, re-derived from the replacement list | `bytes_outside_the_replacements_match` |
| **3** | **the whole candidate parses** — `SyntaxIndex::parse(candidate)`, answered with `VerificationFailure::DoesNotParse` | *this is step 4* |
| 4 | every comment the original assigns to the **file** is still present | `file_comments_survive` |
| 5 | no new YAML 1.1-ambiguous plain scalar was introduced | `no_ambiguous_plain_scalar_is_introduced` |
| 6–10 | for a move only: the arrival is the departure, lines are conserved, the sequence holds the intended permutation, constructs outside the move are unchanged, no comment changed hands | five named functions |
| 11 | for each scalar edit: the path still resolves, the node is still a scalar, **our decoder and the substrate's agree**, and the value is the intended one | the loop at `edit.rs:4709` |
| 12 | for each structural edit: the mapping still resolves, the entry is present with its value or absent, **every other entry decodes to exactly what it decoded to before, in the same order**, and the entry count moved by exactly one | `verify_field` |

**The structural argument is the decisive one.** `PatchedDocument` has private fields and no public
constructor; the only thing that builds one is `apply_edits`, and only after `verify` returned `Ok`.
So **there is no path from a verification failure to bytes a caller could write to disk** — which is
what makes calling `apply_edits` a discharge of step 4 rather than a hope that someone called it.

### What it does *not* cover, stated so it is not mistaken for coverage

- **It parses with this crate's substrate**, `saphyr-parser` 0.0.11 through `SyntaxIndex`, not with
  espanso's YAML reader. *"It parses here"* is not *"it parses there"*, and nothing in this project
  has ever measured the difference.
- **It says nothing about espanso semantics.** That is step 5's, deliberately: 2a-2a §2 records the
  same boundary from the other side.
- **It does not hand back the index it built.** `PatchedDocument` exposes `text()`, `replacements()`,
  `notes()` and `into_text()` and no `SyntaxIndex`, so the projection at step 5 must parse again.
  §5 measures what that costs.
- **It is not a gate on bytes from anywhere else.** It verifies a candidate `apply_edits` itself
  spliced. A caller that assembled bytes some other way is unverified — which is why this
  transaction never does.

### The one place a second parse exists, and why it is not a second gate

`findings_of` parses the candidate again for the projection. If **that** parse fails after `verify`'s
succeeded, the two calls to one parser have contradicted each other about one candidate. It is
reported as **`SaveError::CandidateParseDisagrees { path, error }`**, its own variant, so the
contradiction can never be silent and can never be mistaken for something else.

**It was originally reported as `SaveError::Patch(EditError::Verification(DoesNotParse(_)))` — the
answer step 4 would give — and that was a false provenance** (§9, finding 7). It said the patch
engine's verification refused when in fact verification *passed*: a `PatchedDocument` cannot exist
otherwise. The cost was measurable rather than theoretical — E8a switched off step 4's own parse
rejection and the acceptance test stayed green with an error that named the wrong check.

`SaveError::CandidateParseDisagrees` is therefore:

- **not** a syntax-gate answer: `syntax_gate_failure()` returns `None` for it, which is the whole
  point;
- **not a refusal**: `is_refusal()` answers `false`. No check declined anything — both parses ran and
  they disagreed, which is a defect in this crate or a parser that is not a function of its input,
  and there is no different way for a user to retry it;
- **not a write**: `may_have_written()` answers `false`; it happens before the commit.

With the distinction in place, E8a now **fires in the acceptance binary** as well (§4): the refusal
still happens, and it now says which of the two parses produced it. §7 hole 3 records what remains.

---

## 4. The disabling experiments

Each sabotage was applied, the affected binaries were run, and the change was reverted; all four
touched files were then compared byte for byte against copies taken beforehand
(`persist/save.rs`, `persist/write.rs`, `tests/persist_save.rs`, `patch/edit.rs` — all four restored
identically). E15 to E18 are the review round's; **E8a, E5, E6 and E11 carry their re-run results**,
not their first ones, and **E5b is new** because finding 3's fix moved what E5 used to measure onto a
different function. E1's and E2's counts moved by one and by one-plus-one, because the round added
tests they fire.

**An experiment that fires nothing is a test that measures nothing**, and one of these fired nothing.
It is recorded as what it was — a defect the suite could not see — and it is the reason a test exists
that did not before.

| # | Sabotage | Result |
|---|---|---|
| E1 | `findings_of` returns no findings (the semantic gate is off) | **fires (9)** — both editor-model tests, both suspicion tests, the acknowledgement-does-not-carry test, the candidate-not-original test, the repair test, the byte-exact sweep and (since the review round) the two-equal-suspicions test |
| E2 | `verdict` always answers `Proceed` | **fires (9 + 6)** — the same nine, plus six of the policy's own unit tests |
| E3 | the `EditorModelError` arm of `verdict` is removed, so every class is acknowledgeable | **fires (3 + 2)** — both editor-model tests, the byte-exact sweep, and two unit tests. Narrower than E2, which is the point: it isolates the *class split* from the gate |
| E4 | `Acknowledgement::of` keeps every class | **fires (1 + 1)** — `an_editor_model_error_cannot_be_acknowledged_past` and `an_acknowledgement_holds_only_suspicions` |
| E5 | `Acknowledgement::covers` answers `true` for any non-empty acknowledgement | **re-run after finding 3's fix: fires (0 + 2)** — `an_acknowledgement_holds_only_suspicions` and `a_finding_whose_operand_changed_is_not_the_finding_that_was_acknowledged`, and **nothing in the acceptance binary**. Before the fix it fired (1 + 4). That is not a regression, it is the fix: the gate no longer asks `covers`, so sabotaging it no longer reaches the gate. The experiment that now measures what E5 used to is **E5b** |
| **E5b** | `Acknowledgement::covers_all` answers `true` whenever the acknowledgement is non-empty | **fires (2 + 3)** — the stale-acknowledgement test and the two-equal-suspicions test, plus three unit tests. This is E5's old role, moved to the function the gate actually calls |
| E6 | the revision comparison in `read_target_under_the_lock` is never made | **re-run after finding 2's fix: fires (2 + 1)** — `a_stale_base_revision_refuses_and_writes_nothing`, `a_skipped_commit_re_reads_the_target_and_refuses_a_replacement` and the helper's own unit test. Before the fix the comparison existed once, at step 2, and this fired **1**; it is now shared by both reads, so one sabotage reaches both. `exactly_one_of_several_savers_from_one_base_revision_commits` still stays green, because `replace_locked_file` re-checks the revision at commit time — the belt-and-braces really is belt-and-braces |
| **E7** | the source is read **before** the lock is taken | **fired nothing at first.** Every existing test started its savers from the same base revision, so a pre-lock read was indistinguishable from a locked one. `the_source_is_read_inside_the_lock_and_not_before_it` was written for it — a queued save whose base revision is the one a lock-holding writer is *about* to create — and E7 now **fires (1)** |
| **E8a** | step 4's own `SyntaxIndex::parse(candidate)` no longer rejects | **re-run after finding 7's fix: fires (2), and one of them is the acceptance binary.** `patch::edit::tests::verification_rejects_a_candidate_that_does_not_parse_or_says_the_wrong_thing` fails as before, and now `tests/persist_save.rs::a_candidate_that_would_not_parse_refuses_at_the_syntax_gate_and_writes_nothing` fails too, with *"expected the syntax gate's own answer, got the candidate for … parsed once and not again"*. The refusal still happens either way — that is E8b — but the two parses are now **distinguishable**, which is exactly what the old wrapping destroyed. `tests/patch_edit.rs`, `tests/patch_structure.rs`, `tests/patch_move.rs` and `tests/gate_roundtrip.rs` still stay green: §7 hole 3 is narrowed, not closed. **Before the fix this experiment fired 1**, in a unit test inside `edit.rs`, and the acceptance test passed on an error that named the wrong check |
| E8b | E8a **plus** `findings_of` swallowing its own parse failure | **re-run: fires (1)**, unchanged — `a_candidate_that_would_not_parse_refuses_at_the_syntax_gate_and_writes_nothing`, which is what shows the transaction really refuses on a candidate that does not parse, whichever of the two parses catches it. It is no longer the *only* experiment that reaches that test, which is E8a's whole change |
| E9 | the read-only refusal is removed | **fires (1)** — `a_package_file_is_refused_before_anything_is_read` |
| E10 | the UTF-8 refusal becomes `String::from_utf8_lossy` | **fires (1)** — `a_target_that_is_not_valid_utf8_refuses_and_writes_nothing` |
| E11 | the commit is never skipped (`committed = true` always) | **re-run: fires (4)** — both unchanged-candidate tests, the real-corpus sweep, and the skipped-commit re-read test, which then refuses inside the primitive instead |
| **E12** | the commit calls `replace_file_atomically` instead of `replace_locked_file` | **hangs forever.** `two_saves_in_a_row_do_not_deadlock` never returns; the run was killed after 60 s. That is the whole content of 2a-1 §12's warning, made concrete: the lock is not reentrant, and taking it twice is not an error, it is silence |
| E13 | one row of `BYTE_EXACT_OUTCOMES` changes side | **fires (1)** — `every_byte_exact_fixture_survives_the_transaction`, naming the fixture |
| E14 | the real-corpus test stops consulting the mandatory-corpus switch | **fires (1)** — `the_real_corpus_test_reads_the_switch_that_makes_it_mandatory` |
| **E15** | `Acknowledgement::covers_all` goes back to set membership (`all(covers)`) | **fires (1 + 1)** — `two_equal_suspicions_are_not_covered_by_one_acknowledgement`, in the acceptance binary and as a unit test. This is finding 3's fix, and the pair is deliberate: the unit test pins the policy on two hand-built equal findings, the acceptance test pins that `validate` really produces two equal findings for one scalar holding `{{who}}` twice |
| **E16** | the skipped-commit path returns `base_revision` without re-reading | **fires (1)** — `a_skipped_commit_re_reads_the_target_and_refuses_a_replacement`. **The helper's own unit tests stay green**, which is worth recording: `read_target_under_the_lock` is still correct and still called for step 2; only the *second call site* is gone. A sabotage of the helper instead fires those two as well |
| **E17** | the transaction's reads go back to `std::fs::read` instead of the primitive's checked open | **fires (2)** — `a_directory_at_the_target_is_refused_as_a_non_regular_file` (an unclassified `Io` failure at `readTarget` instead of `TargetNotRegularFile`) and `a_fifo_at_the_target_is_refused_and_does_not_block_the_lock`, which fails **through its five-second deadline** rather than by an assertion: that is the deadlock of finding 8, reproduced, and the deadline is what keeps it from hanging the suite |
| **E18** | `inspect_target` loses `O_NONBLOCK` | **fires (1 + 1)** — the same fifo acceptance test, and `persist::write::tests::the_non_blocking_flag_opens_a_fifo_without_waiting_for_a_writer`. Both fail on their deadline. This is the experiment that shows why reuse alone was not the fix: `open(O_RDONLY)` on a fifo blocks wherever it is called from |

**E7 is the one that found a defect rather than confirming one**, and it is the reason §7 hole 4
exists: a sabotage that fires nothing looks exactly like a property nothing depends on, and the only
way to tell them apart is to try.

**E17 and E18 are the two that must not be run casually.** Both reproduce a call that never returns,
and both are only survivable because the tests that catch them wait on a bounded deadline and then
abandon the thread. A test written the obvious way — call, join, assert — would have hung the suite
in exactly the manner E12 does.

---

## 5. Verification

Each command run separately.

| Command | Exit |
|---|---|
| `cargo fmt --check` | 0 |
| `cargo build --workspace` | 0 |
| `cargo test --workspace` | 0 — **723 tests**, 0 failed, 0 ignored |
| `cargo clippy --workspace --all-targets -- -D warnings` | 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | **1 — nothing found**, which is the required result (`CLAUDE.md` §3, D2x) |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 cargo test -p espansoconfig-core --test persist_save -- saving_the_real_configuration` | 0 — 13 files, 65 matches, 13 committed, **0 refusals** |
| `git status --short --untracked-files=all` | no path under `tests/corpus/real/` appears, and no corpus fixture is modified |

The baseline was **678**; this sub-phase adds **45** — 29 in `tests/persist_save.rs`, 15 unit tests
in `persist/save.rs` and 1 in `persist/write.rs`. **Ten of those are the review round's**: four
acceptance tests (the fifo, the directory, the two equal suspicions, the skipped-commit re-read),
five unit tests in `save.rs` (multiplicity, a surplus acknowledgement, the parse-disagreement
variant, and the locked read in both directions) and one in `write.rs` (the non-blocking open). No
new dependency was added, in any section — the fifo tests shell out to `mkfifo(1)` and skip cleanly
where it is absent, rather than pulling in `libc` or `nix`. `tests/corpus_integrity.rs` passes
unchanged.

### The real configuration — counts only

Each of the owner's files was copied into a temp directory and saved **twice**: once with an empty
batch, which runs the lock, the read, the hash, the reparse-verify, the projection, the semantic gate
and the policy without changing a byte; and once with a real scalar edit, which additionally runs the
commit and the byte-exactness check.

| Measurement | Count |
|---|---|
| files walked | 13 |
| matches walked | 65 |
| files edited **and committed** | 13 |
| saves refused by either gate | **0** |

Every committed file's bytes on disk equal the source with the declared replacements applied, checked
by an independent rebuild rather than by trusting the candidate. Nothing is printed but counts and
file names.

### The byte-exact fixtures

All fifteen fixtures `CLAUDE.md` §4 lists go through the transaction, from a copy in a `TempDir`.
**Fourteen commit**; `move-kept-comment-joins-a-block.yml` is refused with
`RefusedForEditorModelErrors`, because two of its matches have no content field — it exists to pin
comment columns, not to be a valid snippet file. The outcome is a **table**, not a count, so a
fixture that changes side fails with a name on it (E13).

### The cost of step 5's second parse, measured

Release build, this machine (APFS, macOS 27). "step 5" is the whole of
`SyntaxIndex::parse` + `TriviaIndex::scan` + `DocumentView::project` + `validate`.

| Document | Bytes | step 5 | of which parse | of which trivia scan |
|---|---|---|---|---|
| largest synthetic fixture (37 matches) | 2,464 | **302 µs** | 46 µs | 11 µs |
| 50 synthesized matches | 4,279 | 137 µs | 66 µs | 24 µs |
| 100 | 8,579 | 288 µs | 126 µs | 66 µs |
| 200 | 17,479 | 677 µs | 275 µs | 199 µs |
| 400 | 35,279 | 1.585 ms | 517 µs | 691 µs |
| 800 | 70,879 | **4.295 ms** | 1.023 ms | 2.474 ms |

Two things this says, and one it does not.

- **At realistic sizes it is noise.** The owner's entire configuration is 13 files and 65 matches;
  the largest committed fixture costs 302 µs. 2a-1 §6 measured a single `sync_all()` on a file at
  **4.05 ms**, so at every size that resembles an espanso configuration, step 5's second parse is
  one to two orders of magnitude below the fsync the same save already pays.
- **The trivia scan is the super-linear term**, exactly as `PROGRESS.md` R19 says: it grows 24 → 66 →
  199 → 691 → 2,474 µs while the document doubles four times. At 71 KB it overtakes the parse and
  becomes most of the cost. That is the number to watch, not the parse.
- **It does not say the second parse is free.** `apply_edits` already parses the source and the
  candidate and scans the source's trivia, so the transaction pays **three parses and two trivia
  scans** for a scalar edit (a move pays a third scan, inside `verify`). Eliminating one would mean
  widening `PatchedDocument` to carry a `SyntaxIndex` — a change to a Phase 0 type, whose whole point
  is that a candidate is a *verified string*. Not worth 300 µs; recorded so the trade is visible if
  it ever is.

These are **release** numbers. A debug build is several times slower, which matters for the test
suite and not for the shipped app.

---

## 6. What was deliberately not done

- **No backups.** Step 13 is 2a-3's, and no part of it was started. `save_document` does not create
  a directory, does not copy a file and does not rotate anything.
- **No IPC, no command, no wire type, no dictionary key, no screen.** Putting a save on the wire is
  2b's.
- **No `Serialize`, anywhere.** Deriving it on `SaveError` or `SaveVerdict` would have **failed the
  build**: `src-tauri/src/dictionary_contract.rs`'s
  `every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code` demands that every enum `serde`
  can write owns a `code.` namespace in `en.json` **and** `es.json`, or is excluded by name with a
  reason. Same deliberate omission as `WriteError`, `Finding`, `FindingCode` and `FindingClass`; the
  derive and the strings land together, or neither lands.
- **No second syntax gate** (§3), and **no second semantic rule**. `crate::validate` is unchanged by
  this sub-phase — not one line.
- **No cache write.** Step 12 returns the facts a caller needs to update a snapshot; it does not
  reach into `crate::workspace`. A transaction that mutated the caller's cache would be a second
  owner of the session's state.
- **No conflict *resolution*.** A `RevisionMismatch` is a refusal with both revisions in it. Plan
  §6.5's *Keep my draft / Reload / Compare* offer is a UI, and it is 2b's.
- **No `libc`, no metadata beyond mode bits.** 2a-1 §4's eight dropped classes are inherited
  unchanged and are not this sub-phase's to fix. The review round did **not** change that: the two
  syscall constants the primitive uses are still spelled out by hand, and the `copyfile(3)` remedy
  hazard 11 needs is described in §9 finding 1 and assigned to 2a-3, not implemented.
- **`forgetFileText()` was not called from anywhere**, because nothing on the frontend calls a save
  yet. `PROGRESS.md` addresses it to Phase 2 by name, and it belongs to whichever sub-phase first
  writes a file from a window.

---

## 7. Coverage holes, stated as holes

1. **A working configuration that this crate reports an error on cannot be saved through the visual
   editor at all**, and two of the eight `EditorModelError` codes can do that. The two are **not**
   equally established, and an earlier draft of this hole overstated the second (§9, findings 5
   and 6):
   - **`DuplicateVariableName` — established.** 2a-2a §12 finding 9 read espanso's `generate_nodes`,
     which keys its node map by variable name, so a file with a repeated name **loads and runs**,
     last-wins. A document that already contains one cannot be saved through this transaction at all
     until the duplicate is removed. This one is a concrete, reachable refusal of a working file.
   - **`RegexDoesNotCompile` — a version asymmetry, and nothing more.** Espanso `v2.3.0` pins
     `regex 1.5.5` and this crate builds against 1.13, so the two engines *could* disagree. **No
     divergent pattern has been found and no parity experiment has been run**, here or in 2a-2a
     (whose hole 4 says the same). The honest statement is: the risk is structural and unmeasured,
     not that it "can happen today". Hole 15 is the missing experiment.

   The escape hatch the plan names for such a document is the **raw text editor** (plan §7, hazards 7
   and 8: *"detect and refuse; raw editor only"*), which would be a different entry point with
   byte-level semantics rather than an acknowledgement flag on this one. **That editor does not exist
   yet**, so today the hole is open: for those codes, on those documents, the visual editor is the
   only surface and it refuses. The alternative — making errors acknowledgeable — is argued down in
   §2.4 and re-argued in §9, and the argument would change if the raw editor did not arrive.
2. **A multi-step repair cannot be saved incrementally.** A fix that passes through a still-broken
   intermediate state has to be done in one batch. Nothing measures how often that is a real
   constraint, and the batch protocol's own restrictions make it sharper: a move must be the only
   edit in its batch (R25).
3. **Step 4's rejection still has almost no independent coverage, but a regression in it is no longer
   invisible.** Before the review round, E8a switched off `verify`'s parse rejection and *every*
   acceptance binary stayed green — the only failure was one hand-built unit test inside `edit.rs` —
   because `findings_of` refused instead and the refusal was reported as though step 4 had made it.
   With `SaveError::CandidateParseDisagrees` in place (§3, §9 finding 7), E8a **fires in
   `tests/persist_save.rs` too**: the transaction still refuses, and it now says which parse refused.
   What is still open is the other half: the four whole-corpus patch sweeps
   (`tests/patch_edit.rs`, `tests/patch_structure.rs`, `tests/patch_move.rs`,
   `tests/gate_roundtrip.rs`) stay green under E8a, so **nothing shows step 4 refusing on its own
   through a public entry point of `crate::patch`**. That is 0c's coverage, not this transaction's,
   and it is unchanged.
4. **A candidate that does not parse is reachable through exactly one shape.** A sweep of **16,081**
   adversarial edits over the synthetic corpus — twelve hostile scalar values and eight hostile
   insertion keys at every addressable node, plus a removal and four moves each — produced **two**,
   and both are the same shape: a block scalar re-emitted at the six-column indentation this crate
   writes, with a comment below it at a *shallower* column the fixture chose on purpose. So the
   syntax gate is tested with one shape and nothing says the gate would catch a different one. It
   also means the emitter is, on this corpus, very nearly incapable of producing invalid YAML — which
   is reassuring and is **not** the same as a proof. The same sweep says nothing about the *other*
   parse: no input is known that makes `findings_of`'s parse fail after `verify`'s succeeded, so
   `SaveError::CandidateParseDisagrees` is a variant no test can reach through the transaction (see
   hole 16).
5. **The lock tests use threads, never a second process.** The lock excludes only this process's
   cooperating callers, so that is what can be tested — but the case that matters for a user is vim,
   espanso or a sync agent, and 2a-1 hole 1's residual race is completely untouched by anything here.
   No test in this repository involves a second process. The nearest approach is
   `a_skipped_commit_re_reads_the_target_and_refuses_a_replacement`, whose second thread writes the
   target **without taking the lock** — a non-cooperating writer in every respect except the one that
   matters most, which is being another program.
6. **Three tests rest on timing assumptions**, all stated in the test itself.
   `a_save_waits_for_a_lock_another_thread_already_holds` holds the lock for 300 ms and asserts the
   save waited 250; a machine so loaded that a two-line write takes longer would make it pass
   vacuously. `the_source_is_read_inside_the_lock_and_not_before_it` sleeps 200 ms to let the queued
   save reach its read — that only weakens the *sabotaged* direction (a correct implementation passes
   whatever the scheduler does), so an unlucky machine weakens E7 rather than failing the build.
   `a_skipped_commit_re_reads_the_target_and_refuses_a_replacement` needs the replacement to land
   **between** the transaction's two reads: it uses a 3,200-match document, whose empty-batch save
   takes about 190 ms in a debug build on this machine, and a writer that waits 25 ms. The elapsed
   time is what says which read refused — a step-2 refusal returns in milliseconds — and a run that
   returns in under 60 ms **skips with a printed reason** rather than asserting on a run that
   measured nothing. A machine fast enough to skip it always would lose the test silently; measured
   here, it did not skip in five consecutive runs.
7. **`SaveError::may_have_written()` has no test that would fail if it always answered `false`.** The
   only variant for which it can answer `true` is `SaveError::Write`, and no test in this file
   produces a post-rename `WriteError` — 2a-1 hole 2 records the same gap one layer down, where the
   read-back verification and both `sync_all()` calls are equally invisible. What *is* asserted is
   that every refusal answers `false`.
8. **`SaveError::is_refusal()` draws a line this project has not had to defend yet.**
   `VerificationFailed`, `Io` and `CandidateParseDisagrees` are failures; everything else is a
   refusal. The `WriteError` arms are matched exhaustively, so a new variant is a compile error — but
   nothing checks that the *split* is the one a user interface will want, because there is no user
   interface. The third of those is the review round's, and it is the least defended: it is a failure
   because no check declined and there is nothing to retry differently, which is an argument rather
   than a measurement. 2b will find out.
9. **Nothing here has been checked against a running espanso.** Every claim about what espanso does
   is inherited from `crate::validate`, whose own hole 2 says the same thing: the claims come from
   reading espanso's `v2.3.0` sources, not from feeding it a file and watching. In particular,
   **nothing establishes that a document this transaction commits is one espanso loads**, and nothing
   establishes that a document it refuses is one espanso would complain about.
10. **The `DocumentContext` is trusted.** `save_document` writes the path the context names, and a
    caller that supplies a context whose `kind` is wrong gets the wrong read-only decision, while one
    whose `path` is wrong writes the wrong file. The context is not derived from discovery here and
    is not checked against it. In practice the caller is `crate::workspace`, which built the context
    from a `DiscoveredFile` — but nothing in this module requires that.
11. **`Acknowledgement` equality is exact, and nothing measures how often that is annoying.** A
    finding whose span moved by one byte is a different finding, so an acknowledgement is invalidated
    by any edit anywhere earlier in the file. That is the safe direction and it is deliberate; whether
    it produces a UI that asks the same question repeatedly is a question only a UI can answer.
12. **The commit-skip changes what a caller can rely on, and no caller exists to have relied on it.**
    `save_document` never "touches" a file. If some future need wants a write for its own sake — a
    forced mtime bump, a permissions repair — it is not available and would have to be added
    deliberately.
13. **Nothing writes inside a real espanso configuration directory.** Every test runs in a `TempDir`,
    including the real-corpus sweep, which copies each file out first. The interaction that actually
    matters — espanso's daemon watching the directory while the rename happens — has never been
    observed and cannot be from a `cargo test` (2a-1 hole 10, inherited unchanged).
14. **The fifo deadlock is tested by its refusal, not by its hang.**
    `a_fifo_at_the_target_is_refused_and_does_not_block_the_lock` asserts that the save answers
    `TargetNotRegularFile` inside five seconds; what it *cannot* assert is the failure it was written
    for, which is a call that never returns. A deadline is a proxy for "does not block", and a
    machine paused for six seconds by a snapshot or a suspend would fail it spuriously. The
    sabotaged direction is the informative one — under E17 and E18 the deadline is reached and the
    test fails — and the thread is then **abandoned**, blocked on the fifo, until the process exits.
    Nothing here demonstrates the lock actually being held forever by a second save; that would need
    the hang the test exists to avoid.
15. **No parity experiment exists between espanso's `regex 1.5.5` and this crate's 1.13.** Hole 1
    used to claim a divergence could bite "today"; it names no pattern, and none was ever produced.
    The experiment that would settle it — a corpus of patterns compiled against both versions, or at
    minimum a reading of the two changelogs for syntax that 1.13 rejects and 1.5 accepted — has not
    been run in this repository. Until it is, `RegexDoesNotCompile`'s status as an unoverrideable
    error rests on a risk nobody has measured in either direction.
16. **`SaveError::CandidateParseDisagrees` is unreachable through any known input**, so the test that
    pins it hand-builds the variant and checks how the four accessors classify it. That is a pin on
    the *classification*, not on the path that produces it, and there may be no such path: the
    variant exists so that two parsers contradicting each other cannot be silent, and the only
    evidence it is wired correctly is E8a, which reaches it by sabotage.

---

## 8. What 2a-3 and 2b inherit, and should not rebuild

- **`save_document` is the only entry point that should ever write a user's file.**
  `replace_file_atomically` and `replace_locked_file` take **finished bytes** and validate nothing;
  calling either directly with bytes a user's edit produced skips both gates.
- **Do not call `replace_file_atomically` from inside the transaction.** E12 is what happens: the
  lock is not reentrant and the process hangs, silently and forever.
- **Backups (2a-3) go between the verdict and the commit.** The lock is already held there, the
  candidate already exists, and the target's current bytes are already in memory as `source` — so a
  backup step needs no extra read. It must not run before the verdict, or a refused save leaves a
  backup of a file nobody changed.
- **The policy is one function, `verdict`, and it is pure.** If it turns out to be the wrong policy,
  it changes in one place and no rule and no test fixture moves. Extending it means adding a
  `SaveVerdict` variant, which is an exhaustive-match compile error in `name()` and a failure in
  `every_verdict_has_its_own_name_and_only_one_proceeds`.
- **An acknowledgement is content-addressed, and 2b must round-trip the findings, not a boolean.**
  The save command's wire shape has to carry the findings out and the acknowledged subset back in. A
  `force: true` parameter would undo §2.2 entirely. **It must round-trip them with their
  multiplicity**: two equal findings are two things to show and two things to acknowledge, so a wire
  shape that deduplicates them — a set, a map keyed by code, a `Vec` the frontend `uniq`s for display
  — reintroduces exactly the defect `covers_all` fixes.
- **2b owes the part of the acknowledgement this crate cannot supply: proof that somebody looked.**
  Content matching says the findings did not change; it says nothing about presentation or consent,
  and nothing in `espansoconfig-core` can (§2.2). The save command must not let a caller acknowledge
  findings it did not first receive from a refusal and display, and that rule lives in the user
  interface or nowhere.
- **`SaveError`, `SaveVerdict`, `SaveRefusal` and `Acknowledgement` owe `code.` namespaces in
  `en.json` *and* `es.json` the day any of them gains `Serialize`** — and they carry `Finding`,
  `FindingCode`, `FindingClass`, `WriteError`, `WriteStep`, `TargetDifference` and `EditError` with
  them, none of which have theirs either. That is a large, single, indivisible change, and it is 2b's.
- **Three sentences a user-facing string must never say**, each inherited rather than invented here:
  *espanso will reject this* (plan §6.6); *your edit cannot be lost* (2a-1 D4 — the residual race is
  one rename wide); *this file is valid* (step 4 proves it parses under **our** substrate, and step 5
  reports under **our** model).
- **`SavedDocument::committed` can be `false` on a success.** A caller that treats every `Ok` as "the
  file changed" will fire a watcher-suppression entry and a dirty-state reset for a save that wrote
  nothing. It is not an error; it needs a branch.
- **The revision returned is the one to keep**, and on **both** paths it is now the hash of bytes the
  transaction read back: on a commit, the primitive's step-11 read after the rename; on a skipped
  commit, a second read under the lock that had to agree with the base revision. It is simultaneously
  the new base revision and the hash the watcher must ignore (plan §6.5 step 4). **It is not a
  promise about the file now** — the window is one read wide, not zero — so no string may say *your
  edit cannot be lost*, and a caller that needs certainty re-reads.
- **`SaveError` has eight variants, and one of them is not a refusal.**
  `CandidateParseDisagrees` is this crate contradicting itself; `is_refusal()` answers `false` and
  `syntax_gate_failure()` answers `None`. 2b should present it as a problem, never as a choice, and
  must not fold it back into the syntax gate's message — that is the false provenance §9 finding 7
  removed.
- **Every read of a save target goes through `persist::write::inspect_target`.** It is `O_NOFOLLOW`,
  non-blocking and regular-file-checked, and all three matter only because the path lock is already
  held. A later sub-phase that adds a read — a backup source (2a-3), a diff, a preview — must use it
  rather than `std::fs::read`, or it reintroduces finding 8's deadlock at a new call site.
- **`forgetFileText()` in `src/lib/browser/workspace.svelte.ts` still has no caller**, and the
  sub-phase that first saves from a window owes it one, or the raw viewer keeps the bytes it read
  before the write.
- **Hazard 4 now has its named defence** (validation gate before rename) and hazard 1 has a second
  one (the revision check inside the lock, plus the primitive's own re-check at commit). Hazards 11
  and 12 are still only partly closed — 2a-1 §12's last line stands unchanged, and Phase 2 should
  re-read the whole register before claiming it is satisfied. **Hazard 11's gap is now written down
  as a deviation rather than as a limitation** (§9, finding 1), and it is addressed to 2a-3 by name.

---

## 9. Review disposition — the eight findings

`docs/reviews/phase-2a-2b-save-transaction.md` returned eight findings: one blocking, seven
should-fix. **Five are fixed. Three are dispositioned here in writing** — one accepted as a real
deviation whose remedy belongs to a named sub-phase, and two decided as they stand, with the
reasoning recorded and one of this document's own overstatements corrected on the way.

The round's method: a finding is either fixed with an experiment that fires, or answered with the
reason it is not fixed and the name of whoever owns it next. **Two of the eight are answered by
changing this document rather than the code** — finding 4 entirely, and finding 6's second half —
and both were right. A decision record that overclaims is the same failure as a diagnostic that
overclaims, one level up.

### 1 — blocking — hazard 11 restores mode bits only. **Accepted as a real deviation. Not fixed here; owner 2a-3.**

The review is correct, and it is worth stating as a deviation rather than as a limitation. Plan §7
row 11 reads *"Changing permissions / ownership / line endings / BOM → **capture and restore all
four**"*. What is actually true:

- **line endings and BOM are preserved by construction**, not by capture-and-restore: every edit is a
  byte-span replacement and everything outside the span comes out byte-identical. `crlf-line-endings.yml`
  and `bom-utf8.yml` go through the whole transaction and commit (§5);
- **permissions are restored as Unix mode bits**, taken by `fstat` on the same descriptor whose bytes
  were hashed;
- **ownership is not restored at all**, and neither is anything else a new inode drops.

`docs/decisions/2a-1-notes.md` §4 already enumerates the eight classes the rename loses — owner,
group, POSIX ACLs, extended attributes, resource forks, creation time, BSD flags, hard links — and
2a-1 §10 records it as a decision a later phase must revisit. **2a-2b changed no line of `write.rs`'s
metadata handling**: this sub-phase never wrote to that file until the review round, and what the
round changed there is the *read* path (finding 8), not step 7.

What Codex contributes beyond that record, and what makes this worth re-recording rather than
pointing at 2a-1:

- **On macOS the extended-attribute case is not exotic.** Finder tags, Finder comments,
  `com.apple.quarantine`, `com.apple.metadata:*` and Time Machine's own attributes are ordinary
  properties of ordinary files. A user who has tagged their espanso config in Finder loses the tag on
  the first save, silently.
- **An ACL loss is an access-control *broadening*.** A denying ACL on a `0644` file makes it
  unreadable to accounts the mode bits would admit; the replacement has the same mode and no ACL, so
  the save can leave the file *more* accessible than it found it. That is the one item on the list
  that is a security property.
- **A hard-linked config is silently separated from its other name**, which for a dotfiles setup that
  hard-links instead of symlinking means the save stops reaching the file the user thinks it reaches.

**The candidate remedy** is macOS's `copyfile(3)` with `COPYFILE_ACL | COPYFILE_XATTR` (and
`COPYFILE_STAT` for ownership where the process may set it), called on the **temp file** between the
write and the rename, so that the new inode carries the old one's metadata before it takes its name.
It needs a platform-specific dependency — `libc`, or a hand-declared `extern "C"` block — which this
crate has so far avoided entirely (`OPEN_NO_FOLLOW` and `OPEN_NON_BLOCKING` are spelled out by hand
precisely to keep that true), so it is a dependency decision as much as a code change.

**Owner: 2a-3.** It is the sub-phase that already has to decide what a *backup copy* carries, which
is the same question about the same metadata; the same `copyfile(3)` call answers both, and doing it
once is how the two answers stay the same. It is not implemented here, and hazard 11 must not be
described as closed until it is.

### 2 — should-fix — the byte-identical fast path returned facts it had not established. **Fixed.**

The skipped-commit path returned `SavedDocument::revision` and `.text` from the step-2 read, while
`SavedDocument`'s documentation said the file "provably holds" them — with a whole patch, two parses,
a projection and a validation in between, and a lock that excludes only cooperating writers.

The path now **re-reads and re-hashes the target under the lock** before it returns
(`read_target_under_the_lock`, the same checked read step 2 uses): if it still matches, the save
returns as before; if it does not, it is `SaveError::RevisionMismatch`, which is the answer the
committed path already gives for the same situation.

**This does not remove the race**, and the doc comments say so rather than claiming a guarantee: it
makes the window **one read wide instead of one whole validation wide**, and 2a-1's D4 residual race
stands untouched. `SavedDocument::revision` now documents itself as *the revision the file held at
the last moment this transaction looked at it*, on both paths, and `.text` inherits the same
qualification. The phrase "provably holds" is gone.

Coverage, stated exactly: two unit tests pin the helper in both directions, replacing the file from
the same thread between the two calls (which is the only way to schedule it deterministically), and
`a_skipped_commit_re_reads_the_target_and_refuses_a_replacement` pins the call site with a second
thread that writes **without taking the lock**. E16 fires the acceptance test and — deliberately
recorded — leaves the helper's unit tests green, because a sabotage of the call site is not a
sabotage of the helper. The acceptance test rests on a timing assumption and skips loudly rather than
failing when the replacement did not land inside the save; hole 6 says so.

### 3 — should-fix — `Acknowledgement::covers()` lost multiplicity. **Fixed.**

`validate` reports an unresolved reference **once per occurrence** and each finding records the whole
scalar's span, node and path rather than the occurrence's subspan, so one scalar holding `{{who}}`
twice produces two findings that are equal in every field. Under `Vec::contains`, one acknowledged
copy covered both, and the second occurrence was never shown to anyone.

The gate now matches acknowledged against candidate findings as a **multiset**:
`Acknowledgement::covers_all` walks the candidate's suspicions and consumes a **distinct** acknowledged
finding for each, and `verdict` calls it instead of `covers`. `covers` survives as documented
membership — a caller asking *"was this one shown?"* — with a doc comment that says plainly it loses
multiplicity and must not be used to decide whether a candidate may proceed.

**The change is entirely inside `save.rs`; `crate::validate` is still unchanged by this sub-phase, not
one line.** The alternative the review also offered — giving each finding the **occurrence's** subspan
instead of the scalar's — was **not taken**, and the reason is scope rather than preference: it is a
change to 2a-2a's closed classifier, it would move the span of an existing finding (and therefore
invalidate acknowledgements and change what every `validate` test asserts), and it is a better answer
that belongs to whoever next opens that module. It would also make the two findings *unequal*, which
is a different fix for a different reason: the user would then be shown two findings at two places
rather than one finding twice.

Two tests, one at each level: `two_equal_suspicions_are_not_covered_by_one_acknowledgement` as a unit
test on hand-built findings, and the same name in the acceptance binary, which additionally pins that
`validate` really does produce two equal findings for that scalar. E15 fires both.

### 4 — should-fix — §2.2 claimed a blanket acceptance could not be written. **The claim was false and is withdrawn.**

It could be written, trivially: `crate::validate::validate` is public and `Finding` is publicly
constructible, so a caller computes the candidate's findings itself, wraps every one in
`Acknowledgement::of`, and submits once. No refusal happens, nothing is displayed, and the gate is
passed on the first call.

§2.2 now states the property that **is** true — an acknowledgement names specific findings by content,
so it cannot survive the findings changing — and states plainly that **nothing in this crate can
establish that a human saw them**. Enforcing presentation is the user interface's obligation, and §8
now addresses it to 2b by name.

Nothing about the code changed for this finding. That is the point: the defence was always narrower
than the sentence describing it, and the sentence was the defect.

### 5 and 6 — should-fix — `DuplicateVariableName` and `RegexDoesNotCompile` are unoverrideable. **Both stay errors for now. Hole 1 is reworded.**

This is this document's own hole 1, and the review confirms it rather than discovering it. The
decision taken, with its reasoning:

- **Refusing a save never destroys data; permitting one might.** The reversible direction is to
  refuse: a user who cannot save today can still save tomorrow, through a fix or through a surface
  that does not exist yet, and their file is exactly as they left it. A user who saved past a rule
  this crate was right about has a configuration espanso may stop loading, and there is no backup
  before 2a-3.
- **Reclassifying either code is a change to `crate::validate`**, which is 2a-2a's closed module and
  which this sub-phase has not touched. The gate reads `FindingClass` and nothing else, precisely so
  that a class change is a one-line change *there* rather than a policy change here; making it here
  would put two owners on one decision.
- **The escape hatch the plan names is a raw editor** (plan §7, hazards 7 and 8: *"detect and refuse;
  raw editor only"*), which is a **user-interface** question — a second entry point with byte-level
  semantics — and 2b answers it. It is not a policy this layer can settle by adding a flag; §2.4
  argues down the flag at length, and that argument would have to change if the raw editor did not
  arrive.

**Codex's correction is accepted in full and hole 1 is reworded.** The old text said a divergence
between espanso's `regex 1.5.5` and this crate's 1.13 could bite *"today"*. **No concrete divergent
pattern and no parity experiment is supplied anywhere** — not here, not in 2a-2a, whose hole 4 states
the asymmetry and explicitly does not measure it. Hole 1 now separates the two codes:
`DuplicateVariableName` is an established refusal of a working file, read out of espanso's own
`generate_nodes`; `RegexDoesNotCompile` is a structural, **unmeasured** risk. The missing experiment
is now hole 15 in its own right, so that it is a piece of work with a name rather than a caveat
inside another hole.

### 7 — should-fix — the projection parse's failure was attributed to patch verification. **Fixed.**

`findings_of` mapped its own `SyntaxIndex::parse` failure onto
`SaveError::Patch(EditError::Verification(VerificationFailure::DoesNotParse(_)))`, which says the
patch engine's verify refused — when verify had *succeeded*, because a `PatchedDocument` cannot exist
otherwise. A false provenance, and a measurable one: E8a's original run showed the acceptance test
staying green on a regression in step 4, with an error naming the wrong check.

`SaveError` gained an eighth variant, **`CandidateParseDisagrees { path, error }`**, named for what it
is — two calls to one parser contradicting each other over one candidate — rather than for what it
resembles. `syntax_gate_failure()` answers `None` for it; `is_refusal()` answers `false`, because no
check declined anything and there is no different way for a user to retry; `may_have_written()`
answers `false`; `Display` says *"the candidate for <path> parsed once and not again"*; and both
exhaustive matches stayed exhaustive. No `Serialize`, like everything else here.

**E8a was re-run** (§4) and the result changed as intended: it now fires **2**, one of them
`tests/persist_save.rs::a_candidate_that_would_not_parse_refuses_at_the_syntax_gate_and_writes_nothing`,
which fails with *"expected the syntax gate's own answer, got the candidate for … parsed once and not
again"*. The transaction still refuses either way — E8b is unchanged — but the two parses are now
distinguishable, which is the whole content of the fix. Hole 3 is narrowed to what is still true: the
four whole-corpus patch sweeps stay green under E8a, so step 4 still has no independent coverage
through a public entry point of `crate::patch`.

The variant is pinned by a unit test that hand-builds it, because **no input is known that reaches
it** — hole 16.

### 8 — should-fix — the transaction's initial read bypassed `inspect_target()`. **Fixed, and it needed more than reuse.**

`save_document` read the target with `std::fs::read`: no regular-file check and no `O_NOFOLLOW`, both
of which the primitive does. With the non-reentrant path lock already held, a fifo at the resolved
path — from a caller's context, or swapped in by another process after `lock_path` resolved it —
parks the transaction inside the lock until somebody opens the fifo for writing, and every later save
of that resolved path waits behind it, indefinitely.

The read now goes through **`inspect_target`** (made `pub(super)`, with `InspectedTarget`), so there
is one checked open in the crate rather than two ways in. **Reuse alone would not have fixed it**, and
this is worth recording because the review's own reasoning assumed it would: `open(O_RDONLY)` on a
fifo blocks *wherever it is called from*, and `inspect_target`'s type check is downstream of its open.
So the open also gained **`O_NONBLOCK`**, spelled out per platform in the same style as
`OPEN_NO_FOLLOW` and with its meaning pinned by a test rather than its number. A fifo now opens
immediately and is refused as `TargetNotRegularFile`; a regular file is unaffected, and the read only
happens after the type check has passed, so no code here can observe a short non-blocking read. The
primitive gets the same protection at its own step 2, which is where it was equally exposed.

Both of the transaction's reads — step 2 and finding 2's new second read — go through one helper,
`read_target_under_the_lock`.

**What is tested, and what is not.** `a_fifo_at_the_target_is_refused_and_does_not_block_the_lock`
runs the save on another thread with a five-second deadline and asserts the refusal;
`a_directory_at_the_target_is_refused_as_a_non_regular_file` is the same property with no platform
tool involved, for machines without `mkfifo(1)` (the fifo tests skip cleanly there). E17 and E18 both
fire, and both fire *through the deadline* — which is the deadlock, reproduced without hanging the
suite. **The hang itself is untested**: what is asserted is the refusal and its promptness, never the
absence of a block, and no test demonstrates a second save queueing behind a blocked one. Hole 14
says so.
