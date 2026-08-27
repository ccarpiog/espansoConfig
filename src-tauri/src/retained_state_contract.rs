//! The check that keeps the scoped-lifetime contract in one place — Phase
//! 2d-4a-C step 2.
//!
//! `espansoconfig_core::watch::retained_state` states the observation
//! pipeline's scoped-lifetime contract once. This module is what stops it being
//! stated again: it sweeps **both** source trees for the shape family of
//! retained-state claims and fails on any hit its recorded inventory does not
//! carry. It is the analogue of [`crate::liveness_contract`] for a second
//! family, and it is built on the same [`crate::prose_sweep`] — extracted from
//! that module rather than copied out of it.
//!
//! # Why a check at all
//!
//! Six consecutive review rounds of Phase 2d-4a each found a false claim about
//! this pipeline's retained state, and **two consecutive rounds found the same
//! failure shape**: a rule stated without the scope that bounds it. Round 5
//! found the queue's retention boundary counting two ways an entry leaves a
//! queue that has three; round 6 found the same shape one level up, on the
//! watermark a consumer stores. Phase 2d-4a-C step 1 answered that by stating
//! the contract once and replacing some fifty paraphrases with pointers at it —
//! and its own four review rounds then found three more instances of the family
//! in the tree, one per round.
//!
//! **Nothing in step 1 is enforced by anything, and that is the measurement this
//! module exists for.** The falsehood step 1's round 3 found survived 1309
//! passing tests, `clippy`, `cargo doc`, a written audit trail and **two** review
//! rounds aimed at its own family. A contract nothing checks is a contract that
//! drifts back.
//!
//! # The family, and why it has to have two halves
//!
//! [`RETAINED_STATE_SHAPES`] is drawn around the **claims**, never around the
//! vocabulary of the mechanism — `espansoconfig_core::watch::liveness`'s own
//! principle, applied to a second family. `crate::persist::backup` holds some
//! forty occurrences of retention vocabulary and not one claim of this family, so
//! a pattern widened to every occurrence of *retained* buys that noise and
//! nothing else.
//!
//! What is inside is three groups of claim:
//!
//! - **how long a retained value survives, and what removes it** — the
//!   enumeration round 5 found miscounted;
//! - **what a number a consumer stores claims over time** — the monotonicity
//!   round 6 found unscoped;
//! - **atomic execution promoted into a correlated post-state when the mutations
//!   have different predicates** — step 1's round 3 named this one precisely, and
//!   the wording matters. It is *not* the vague *two values are always seen
//!   together*. **It must cover both halves or it ships with the blind spot that
//!   produced the finding**: round 2 corrected three sentences describing an
//!   **unconditional paired insertion**, its sweep was written from those three,
//!   and the **conditional paired removal** one method away — two removals with
//!   two independent predicates under one guard — was invisible to it. Round 3
//!   found that one by widening the pattern, not by reading more carefully.
//!
//! # What it checks, and what it cannot
//!
//! It checks that every position matching the shape family is one somebody judged
//! and recorded. **It catches an *unmarked* claim and a *new* claim, and it
//! cannot judge whether a passage's claim is true**: a passage that carries a
//! pointer and still says something false passes it, and so does a rewording that
//! keeps the same phrase in the same file — the key is `(file, phrase)`, so
//! swapping one recorded sentence for a different sentence using the same phrase
//! moves no count. **The reason it is worth having is the reduction of surface —
//! one place to be right instead of fifty — and never the check's judgement.**
//!
//! Four further limits, stated rather than hoped about:
//!
//! - **A paraphrase built from none of the phrases is invisible, and here that is
//!   measured rather than feared.** Step 1's sweep ran 33 probe phrases over 85
//!   prose units of these two trees, comment runs joined — and **four of its 45
//!   pointer passages sat in units none of the 33 phrases matched**
//!   (`ReconciliationWake::newest_sequence`, `ReconciliationQueue::drain`'s inline
//!   `max` comment, `CommitAnchor`, `LedgerState::announced`), with a fifth in
//!   `crates/espansoconfig-core/src/watch/native.rs`. They were found by
//!   **reading the files**. That is direct evidence that **a phrase family is not
//!   the family**, and it is recorded here so this guard is not read as stronger
//!   than it is.
//! - **A judged-out position is inventoried, never pattern-narrowed away.**
//!   `crates/espansoconfig-core/src/persist/write.rs`'s lock registry is one
//!   entry per real path ever written, process-wide and never evicted — the same
//!   shape as the core's identity register, in a second subsystem — and it is
//!   **out** of this contract because nothing decides an observation, a drain, a
//!   suppression, a coalescing or a save admission against it: those mutexes
//!   serialize disk writes. It is in [`INVENTORY`] with that reason. Narrowing
//!   the pattern until a hit disappears is the one move a check of this shape
//!   cannot catch (`docs/decisions/2d-4a-notes.md` §11.4), which is exactly why
//!   the boundary is written down beside the hit rather than into the pattern.
//! - **The sweep skips exactly one file: this one.** Its phrase table contains
//!   the whole family by construction, so including it would mean an inventory
//!   entry per phrase, maintained in step with the phrase list, recording
//!   nothing. [`SKIPPED`] names it, and the sweep asserts that the file exists,
//!   so a rename that silently emptied the skip list would fail here. A
//!   retained-state claim written into this file is invisible to this check, and
//!   nothing else defends that hole.
//! - **It sweeps two source trees and no document.** `docs/` is deliberately not
//!   swept and **cannot be**: `docs/decisions/2d-4a-notes.md` quotes six review
//!   rounds' false sentences on purpose, so a check over the documentation tree
//!   would fail on the record of every defect this phase fixed.
//!
//! # Where the comparison lives
//!
//! In [`crate::prose_sweep::complaints_against`], written once and called from
//! [`every_retained_state_claim_is_judged`] here and from
//! `crate::liveness_contract::every_liveness_claim_is_judged` there. **Neither
//! guard keeps a copy of it.** What each check keeps is what makes it *that*
//! check: its phrase family, its trees, its skip list, its inventory, and the
//! sentence it wraps a non-empty complaint list in, which names its own contract
//! module and its own `INVENTORY` path.
//!
//! It was not always so. Step 2 shipped the comparison duplicated, so that the
//! older check's four tests would pass byte-identical and thereby prove the
//! extraction had taken nothing away from it; step 2's round 1 then found one
//! defect sitting in **both** copies — zero used as an *unseen* sentinel — and
//! folded the loop into the shared module, which rewrote the older check's guard
//! test. **That byte-identity proof is therefore historical**: it stands at commit
//! `65a0138` and cannot be re-derived from this tree. What replaces it is weaker
//! and is stated as weaker in `docs/decisions/2d-4a-C-notes.md` §17.3.

use crate::prose_sweep::{complaints_against, Hit, Judged};

/// One wording of the retained-state shape family, matched case-insensitively as
/// a plain substring of a prose unit.
///
/// Grouped by the claim each makes. Every one of them is a wording a review round
/// of Phase 2d-4a or 2d-4a-C actually found, the correction that answered one, or
/// an obvious inflection of either.
///
/// **Substrings on purpose.** `outlives` covers *outlived* and *outliving*;
/// `can interleave` covers *no decision can interleave*; `cumulative` covers
/// *cumulative and never reset*. Narrowing a phrase to fit today's tree is what
/// makes a pattern miss tomorrow's claim, and narrowing it to fit the wording of
/// the finding that prompted it is the same mistake — which is precisely how
/// step 1's round-2 sweep missed the claim round 3 found.
///
/// **Phrases with no hit today are kept.** Twenty of the 88 match nothing in
/// this tree — `no decision can observe`, `cannot interleave` and
/// `discarded whole` among them — because a fix round removed the sentences that
/// held them, or because the wording is an obvious inflection nobody has written
/// yet. They stay in the family so that writing one of them is a finding rather
/// than a silent arrival.
const RETAINED_STATE_SHAPES: &[&str] = &[
    // How many ways a retained value leaves, and what removes it. This is the
    // enumeration Phase 2d-4a's round 5 found counting two where the code has
    // three — the queue's retention boundary — and the shape of every claim that
    // fixes a set of exits by reading the mutation sites rather than by anything
    // that fails when a further one appears.
    "two ways",
    "three ways",
    "four ways",
    "thing removes",
    "things end",
    "things remove",
    "nothing removes",
    "nothing evicts",
    "nothing prunes",
    "nothing caps",
    "never evicted",
    "never removed",
    "never reset",
    "is not reset",
    "removes an entry",
    "leaves the queue",
    "leaves this queue",
    "never leaves",
    // The scope a retained value's life is bounded by: an epoch, a session, the
    // process. Clause 2 of the contract is that everything but a path identity is
    // scoped to one workspace epoch, and clause 8 is the single exception — both
    // rest on a reading of every mutation of one field, and nothing fails when a
    // further one appears, which is what makes these wordings worth judging.
    "lives as long as",
    "outlives",
    "for the life of",
    "the process has ever",
    "path ever written",
    "one entry per",
    "leaked deliberately",
    "scoped to one",
    "epoch-scoped",
    "within the epoch",
    "within its epoch",
    "within one epoch",
    "across a replacement",
    "across two epochs",
    "until the epoch",
    "survives a replacement",
    "survive a replacement",
    "discards everything",
    "discarded whole",
    "discards the previous",
    "means nothing across",
    "meaningless across",
    "life is the session",
    "session-lived",
    // What a number a consumer stores claims over time. Phase 2d-4a's round 6
    // found `newest_sequence` documented as never falling below the highest
    // watermark this queue or session had *ever* been drained with, and therefore
    // storable *unconditionally* — true within an epoch and false across one.
    // That is round 5's finding one level up, on the number a consumer actually
    // keeps, which is why the two groups are one family and not two checks.
    "never falls",
    "never moves",
    "watermark backwards",
    "walk-back",
    "walks back",
    "monotonic within",
    "and monotonic",
    "cumulative",
    "unconditionally",
    "highest watermark",
    // Atomic execution promoted into a correlated post-state. The first block is
    // the vocabulary of the guard itself and of what it does or does not exclude;
    // the second is the vocabulary of two values said to move as one. Step 1's
    // round 2 corrected three sentences of the **unconditional paired insertion**
    // form and its sweep, written from them, could not reach the **conditional
    // paired removal** in `adopt_reloaded_revision_under_the_session_lock` that
    // round 3 found — two removals with two independent predicates under one
    // guard, where the guard proves only that no decision interleaves *during the
    // call*. Both forms are in this group deliberately.
    "can interleave",
    "cannot interleave",
    "no decision can",
    "no decision can observe",
    "seen together",
    "observed together",
    "co-existence",
    "coexistence",
    "half-written pair",
    "half-applied",
    "under one state guard",
    "under the same state guard",
    "under the same guard",
    "under one guard",
    "written together",
    "cleared apart",
    "same two statements",
    "same line group",
    "in the same block",
    "in one block",
    "in the same call",
    "in one call",
    "in the same statement",
    "in one statement",
    "go together",
    "travel together",
    "move as one",
    "moves as one",
    "as one fact",
    "one fact in two",
    "without the other",
    "both maps",
    "in lockstep",
    "at the same time",
    "cannot observe",
    "never observe",
];

/// The two source trees swept, relative to the workspace root.
///
/// **Trees and never file lists**, which is the whole of `docs/decisions/
/// 2d-3-notes.md` §20.7 item 41: a sweep that names the files its previous
/// findings touched leaves the twin in the file it did not name standing through
/// the round that closed it everywhere else.
const SWEPT_TREES: &[&str] = &["src-tauri/src", "crates/espansoconfig-core/src"];

/// The files the sweep skips — one, this module's own source — and the reason.
///
/// This module's own source contains every phrase of [`RETAINED_STATE_SHAPES`] by
/// construction. Sweeping it would mean one inventory entry per phrase, kept in
/// step with the phrase list, recording nothing about the pipeline — so it is
/// skipped, and that is a stated hole: a retained-state claim written into this
/// file is invisible to this check.
///
/// **A slice, and named once.** [`sweep`] passes it and
/// [`the_sweep_reaches_both_trees`] reads it, so the list the test makes its
/// claim about is the list the walk is given; two spellings of one skip list is
/// the shape that lets a test go on describing a walk that changed.
///
/// **`crate::liveness_contract` is not skipped**, and neither is
/// [`crate::prose_sweep`]. [`the_sweep_reaches_both_trees`] asserts that of this
/// check's own selection — through [`crate::prose_sweep::selected_files`] and
/// never through a phrase hit, because a file this family has nothing to say
/// about and a file the walk never opened are the same absence in a hit list,
/// and `liveness_contract.rs` has been in exactly that position since step 2's
/// round 1 moved its one retained-state-shaped wording into `prose_sweep.rs`.
/// The sibling check's test of the same name asserts the other direction, so
/// *the two checks do not exempt each other* is a claim two tests carry between
/// them and neither carries alone.
const SKIPPED: &[&str] = &["src-tauri/src/retained_state_contract.rs"];

/// Every position in the two trees that matches the shape family, judged.
///
/// Read this as the answer to *who has looked at this sentence*. A hit that is
/// not here fails [`every_retained_state_claim_is_judged`], and an entry that
/// matches nothing fails it too — a reworded passage is a passage nobody has
/// judged in its new wording.
///
/// Four kinds of reason, as [`Judged::reason`] describes them: **the contract
/// itself**, **a pointer** at it, **a local fact** the code beside it keeps, and
/// **a false positive** of the pattern from an unrelated subsystem — plus a
/// fifth this family needed and that one does not, **judged out**: a position
/// whose retention really is of this shape and whose *claim* is outside the
/// contract's boundary. `crate::persist::write`'s lock registry is the whole of
/// that fifth kind, and it is written down here rather than narrowed out of the
/// pattern, which is the one move a check of this shape cannot catch.
///
/// A few entries name two kinds, because one `(file, phrase)` key can cover two
/// passages of different kinds; those say both rather than the flattering one.
/// The false positives are carried rather than filtered: a pattern narrowed to
/// make today's noise go away is a pattern that misses tomorrow's claim.
const INVENTORY: &[Judged] = &[
    Judged {
        file: "crates/espansoconfig-core/src/draft/error.rs",
        phrase: "never moves",
        count: 1,
        reason: "false positive: a drafted batch moving nothing, which is `PROGRESS.md` R25",
    },
    Judged {
        file: "crates/espansoconfig-core/src/draft/match_draft.rs",
        phrase: "never removed",
        count: 1,
        reason: "false positive: an options entry the draft engine replaces rather than removes",
    },
    Judged {
        file: "crates/espansoconfig-core/src/draft/plan.rs",
        phrase: "two ways",
        count: 1,
        reason: "false positive: one value written two ways in YAML",
    },
    Judged {
        file: "crates/espansoconfig-core/src/emit/choose.rs",
        phrase: "unconditionally",
        count: 2,
        reason: "false positive: the codec quoting a scalar with no condition attached",
    },
    Judged {
        file: "crates/espansoconfig-core/src/emit/tags.rs",
        phrase: "never leaves",
        count: 1,
        reason: "false positive: a failed tag attempt never leaving the cursor half way through a field",
    },
    Judged {
        file: "crates/espansoconfig-core/src/lib.rs",
        phrase: "for the life of",
        count: 1,
        reason: "a pointer: the crate doc naming a file's identity as session-local and handing its scope to clause 1",
    },
    Judged {
        file: "crates/espansoconfig-core/src/patch/edit.rs",
        phrase: "in lockstep",
        count: 5,
        reason: "false positive: the patch engine walking two parses node for node — an execution statement about a walk",
    },
    Judged {
        file: "crates/espansoconfig-core/src/patch/edit.rs",
        phrase: "in one block",
        count: 4,
        reason: "false positive: two positions in one block sequence sitting at the same column, which is a column argument",
    },
    Judged {
        file: "crates/espansoconfig-core/src/persist/backup.rs",
        phrase: "never observe",
        count: 1,
        reason: "false positive: backup-file rotation — a length no scan measured, refused rather than capped",
    },
    Judged {
        file: "crates/espansoconfig-core/src/persist/backup.rs",
        phrase: "never removed",
        count: 1,
        reason: "false positive: backup-file rotation — an assertion that a foreign directory is left alone",
    },
    Judged {
        file: "crates/espansoconfig-core/src/persist/backup.rs",
        phrase: "two ways",
        count: 2,
        reason: "false positive: backup-file rotation, expressly outside this contract — the two ways a backup path can already exist, and one recognition reached from two callers",
    },
    Judged {
        file: "crates/espansoconfig-core/src/persist/backup.rs",
        phrase: "unconditionally",
        count: 2,
        reason: "false positive: backup-file rotation — a discard that un-captures with no condition, and a refusal to claim the stronger guarantee",
    },
    Judged {
        file: "crates/espansoconfig-core/src/persist/backup.rs",
        phrase: "without the other",
        count: 1,
        reason: "false positive: backup-file rotation — the scan carrying its skipped entries beside its eligible batches",
    },
    Judged {
        file: "crates/espansoconfig-core/src/persist/save.rs",
        phrase: "never leaves",
        count: 1,
        reason: "false positive: where the backup sits in the transaction, so a refused save leaves none",
    },
    Judged {
        file: "crates/espansoconfig-core/src/persist/save.rs",
        phrase: "two ways",
        count: 1,
        reason: "false positive: the two arms of `SaveContent`, the only two producers of candidate bytes",
    },
    Judged {
        file: "crates/espansoconfig-core/src/persist/write.rs",
        phrase: "for the life of",
        count: 2,
        reason: "**judged out**: the poison policy's *for the life of the process*, and one file descriptor held for the life of a transaction — a lock lifetime and a resource lifetime",
    },
    Judged {
        file: "crates/espansoconfig-core/src/persist/write.rs",
        phrase: "leaked deliberately",
        count: 1,
        reason: "**judged out**: the same sentence, which says the leak is deliberate and what it buys",
    },
    Judged {
        file: "crates/espansoconfig-core/src/persist/write.rs",
        phrase: "one entry per",
        count: 1,
        reason: "**judged out**: the same registry sentence, matched by a second phrase of the family; the boundary is drawn on the claim and is recorded here rather than narrowed out of the pattern",
    },
    Judged {
        file: "crates/espansoconfig-core/src/persist/write.rs",
        phrase: "path ever written",
        count: 1,
        reason: "**judged out**: the per-path write-lock registry is one entry per real path ever written, process-wide and never evicted — the identity register's shape in a second subsystem — but nothing decides an observation, a drain, a suppression, a coalescing or a save admission against it: those mutexes serialize disk writes and are read only by the writer of that path",
    },
    Judged {
        file: "crates/espansoconfig-core/src/persist/write.rs",
        phrase: "the process has ever",
        count: 1,
        reason: "**judged out**: `mutex_for`'s doc, one leaked mutex per real path the process has ever written — synchronization, not observation state",
    },
    Judged {
        file: "crates/espansoconfig-core/src/persist/write.rs",
        phrase: "two ways",
        count: 1,
        reason: "false positive: two ways into one file being two places to forget `O_NOFOLLOW`",
    },
    Judged {
        file: "crates/espansoconfig-core/src/reconcile.rs",
        phrase: "in one call",
        count: 1,
        reason: "false positive: two questions resolved against one fresh snapshot in one call — an argument about a shared input",
    },
    Judged {
        file: "crates/espansoconfig-core/src/syntax/collection.rs",
        phrase: "two ways",
        count: 1,
        reason: "false positive: the two ways a collection marker behaves, measured over both corpora",
    },
    Judged {
        file: "crates/espansoconfig-core/src/syntax/ownership.rs",
        phrase: "in the same block",
        count: 1,
        reason: "false positive: two comments joining one comment block",
    },
    Judged {
        file: "crates/espansoconfig-core/src/validate/mod.rs",
        phrase: "scoped to one",
        count: 1,
        reason: "false positive: variable uniqueness scoped to one sequence, a validation rule",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "in the same call",
        count: 3,
        reason: "false positive: the engine updating its tracked table in the same call that returns an observation — an execution fact whose consequence the passage then describes as a problem, never a guarantee about a pair",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "unconditionally",
        count: 1,
        reason: "false positive: the record of an earlier wording that promised a replay with no condition, corrected by Phase 2d-1's review",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/liveness.rs",
        phrase: "outlives",
        count: 1,
        reason: "false positive: the other contract's fourth *not guaranteed* clause, about a worker and a request — a thread lifetime, expressly outside this family",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/liveness.rs",
        phrase: "unconditionally",
        count: 1,
        reason: "false positive: the other contract's clause 3, a rollback with no condition attached",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "across a replacement",
        count: 2,
        reason: "the contract itself: clause 6's falling watermark and N7's incomparable numbers",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "and monotonic",
        count: 1,
        reason: "the contract itself: clause 7, matched by the shorter phrase too",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "cumulative",
        count: 2,
        reason: "the contract itself: clauses 7 and 8",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "discards everything",
        count: 1,
        reason: "the contract itself: clause 4's third way",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "go together",
        count: 1,
        reason: "the contract itself: clause 2, the queue's whole-state assignment",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "life is the session",
        count: 1,
        reason: "the contract itself: clause 8",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "lives as long as",
        count: 2,
        reason: "the contract itself: clause 9's record lifetime, and its account of the round-1 High that gave one lifetime to three subjects",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "meaningless across",
        count: 1,
        reason: "the contract itself: N7",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "means nothing across",
        count: 1,
        reason: "the contract itself: clause 3",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "monotonic within",
        count: 1,
        reason: "the contract itself: clause 7",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "never falls",
        count: 1,
        reason: "the contract itself: clause 6",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "never reset",
        count: 1,
        reason: "the contract itself: clause 8, the decision tally",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "nothing caps",
        count: 1,
        reason: "the contract itself: N1, the same sentence as the eviction half",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "nothing evicts",
        count: 1,
        reason: "the contract itself: N1, the register's unbounded retention (R9)",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "nothing prunes",
        count: 1,
        reason: "the contract itself: N2, the ledger's per-epoch maps",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "nothing removes",
        count: 1,
        reason: "the contract itself: clause 1, the process-wide identity register",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "one entry per",
        count: 1,
        reason: "the contract itself: N2, the announced-state map",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "outlives",
        count: 1,
        reason: "the contract itself: clause 1",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "removes an entry",
        count: 1,
        reason: "the contract itself: clause 1, matched by the longer phrase too",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "scoped to one",
        count: 1,
        reason: "the contract itself: clause 2",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "thing removes",
        count: 2,
        reason: "the contract itself: clause 1's identity register and clause 9's per-path anchor slot, whose one remover is the workspace replacement",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "things end",
        count: 1,
        reason: "the contract itself: clause 9's four ends of an app-write record",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "three ways",
        count: 1,
        reason: "the contract itself: clause 4, the queue's retention boundary",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "two ways",
        count: 1,
        reason: "the contract itself: the introduction's account of the retention boundary Phase 2d-4a's round 5 found miscounted",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "unconditionally",
        count: 1,
        reason: "the contract itself: clause 6",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "until the epoch",
        count: 1,
        reason: "the contract itself: clause 9, the per-path anchor slot",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "walk-back",
        count: 1,
        reason: "the contract itself: clause 6's denial that a replacement epoch is a walk-back",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "within its epoch",
        count: 1,
        reason: "the contract itself: clause 3",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/retained_state.rs",
        phrase: "within the epoch",
        count: 2,
        reason: "the contract itself: clauses 6 and 7",
    },
    Judged {
        file: "crates/espansoconfig-core/src/workspace/mod.rs",
        phrase: "for the life of",
        count: 1,
        reason: "local fact: the identity counter's own doc — a path keeps its identity for the life of the process — which clause 1 is derived from",
    },
    Judged {
        file: "crates/espansoconfig-core/src/workspace/mod.rs",
        phrase: "nothing caps",
        count: 1,
        reason: "local fact: the same sentence, the second of its three negatives",
    },
    Judged {
        file: "crates/espansoconfig-core/src/workspace/mod.rs",
        phrase: "nothing evicts",
        count: 1,
        reason: "local fact: the identity table's own doc, the source of N1 and of R9",
    },
    Judged {
        file: "crates/espansoconfig-core/src/workspace/mod.rs",
        phrase: "one entry per",
        count: 1,
        reason: "local fact: the table's growth stated at the table — one entry per distinct path the watcher stabilizes",
    },
    Judged {
        file: "src-tauri/src/backup.rs",
        phrase: "without the other",
        count: 1,
        reason: "false positive: the backup listing carrying its skipped entries beside its eligible batches, a wire-shape rule",
    },
    Judged {
        file: "src-tauri/src/commands.rs",
        phrase: "across a replacement",
        count: 1,
        reason: "local fact: the `begin_epoch` call comment on why an entry kept across one is not a tidiness question",
    },
    Judged {
        file: "src-tauri/src/commands.rs",
        phrase: "at the same time",
        count: 1,
        reason: "false positive: a borrow rule — no free function takes a `&mut Workspace` and a `SessionSideOfASave` at once",
    },
    Judged {
        file: "src-tauri/src/commands.rs",
        phrase: "in the same block",
        count: 4,
        reason: "local fact: the four statements that the ledger's and the queue's epoch moves happen in one session-lock block — execution location, and none of them claims a decision cannot meet one done and not the other",
    },
    Judged {
        file: "src-tauri/src/commands.rs",
        phrase: "means nothing across",
        count: 1,
        reason: "local fact: an assertion message pinning that a sequence carries no meaning across epochs",
    },
    Judged {
        file: "src-tauri/src/commands.rs",
        phrase: "one entry per",
        count: 1,
        reason: "local fact: the app-write record described as one entry per document, at the door that writes it",
    },
    Judged {
        file: "src-tauri/src/commands.rs",
        phrase: "outlives",
        count: 3,
        reason: "local fact: three test comments taking a stamp strictly after a commit anchor that outlives the record — the ledger's rule read from the caller's side",
    },
    Judged {
        file: "src-tauri/src/commands.rs",
        phrase: "travel together",
        count: 3,
        reason: "false positive: three groupings whose own struct shape is the guarantee — a backup session, a save's three session values and a test fixture's four",
    },
    Judged {
        file: "src-tauri/src/commands.rs",
        phrase: "without the other",
        count: 2,
        reason: "false positive: the same groupings, saying a planner that could reach one without the others could write with no safety net",
    },
    Judged {
        file: "src-tauri/src/dictionary_contract.rs",
        phrase: "two ways",
        count: 1,
        reason: "false positive: the two ways an enum reaches `serde`, both of which that check counts",
    },
    Judged {
        file: "src-tauri/src/dispatch_check.rs",
        phrase: "across a replacement",
        count: 1,
        reason: "local fact: the dispatcher test naming what it does not cover, which is the scope Phase 2d-4a's round 6 added",
    },
    Judged {
        file: "src-tauri/src/dispatch_check.rs",
        phrase: "never moves",
        count: 1,
        reason: "local fact: its assertion message, scoped to one epoch in the same sentence",
    },
    Judged {
        file: "src-tauri/src/dispatch_check.rs",
        phrase: "unconditionally",
        count: 1,
        reason: "local fact: the test's account of what an empty batch lets a caller store, with the epoch scope stated beside it",
    },
    Judged {
        file: "src-tauri/src/dispatch_check.rs",
        phrase: "watermark backwards",
        count: 1,
        reason: "local fact: the same assertion message",
    },
    Judged {
        file: "src-tauri/src/dispatch_check.rs",
        phrase: "within one epoch",
        count: 1,
        reason: "local fact: the same assertion message, which carries the scope the claim holds in",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "across a replacement",
        count: 1,
        reason: "local fact: `begin_epoch`'s own reason for discarding — an entry kept across one could suppress a different directory's file — which clause 2 is derived from",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "can interleave",
        count: 4,
        reason: "local fact: four statements, each narrowed to its own critical section — the module's record/anchor insertion, `record_app_write`'s two, and the reload's, which is Phase 2d-4a-C's round-3 Medium restated to claim interleaving during the call and nothing about the pair afterwards",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "cleared apart",
        count: 1,
        reason: "local fact: `record_app_write`'s heading, *written together and cleared apart*, which is Phase 2d-3's round-9 second High",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "co-existence",
        count: 3,
        reason: "local fact: the three passages naming the wider co-existence claim as the one they do **not** make, each recording the Phase 2d-4a-C round that removed it",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "cumulative",
        count: 2,
        reason: "local fact: `LedgerTally`'s own doc, which clause 8 is derived from, and the wait comment that reads it",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "discards everything",
        count: 1,
        reason: "local fact: `begin_epoch`'s own summary of what it discards — the code clause 2 states",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "for the life of",
        count: 1,
        reason: "local fact: the tally counted for the life of the session, clause 8's source",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "half-applied",
        count: 1,
        reason: "local fact: the round-3 restatement, naming the only thing the reload's guard proves",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "half-written pair",
        count: 2,
        reason: "local fact: what the record/anchor insertion guard excludes during that call, stated at the module and at `record_app_write`",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "lives as long as",
        count: 1,
        reason: "local fact: the module's own two-lifetime summary, the record's half, which clause 9 is derived from",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "meaningless across",
        count: 1,
        reason: "a pointer: the sequence's epoch scope, handed to the contract's clause 3",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "never leaves",
        count: 1,
        reason: "local fact: a supersession never leaving the anchor slot empty — clause 9's slot/value distinction at its source",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "never moves",
        count: 1,
        reason: "false positive: a build with the gate acquisition removed never moving the decision counter, a note about what a test can wait on",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "never reset",
        count: 1,
        reason: "local fact: `LedgerTally`'s own doc, clause 8's source",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "no decision can",
        count: 5,
        reason: "local fact: the commit window no decision can cross, plus the four interleaving statements, each about its own critical section",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "nothing prunes",
        count: 2,
        reason: "local fact: the announced-state map and the anchor map each saying nothing prunes it before the epoch ends — N2 at its source",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "nothing removes",
        count: 1,
        reason: "local fact: the insertion comment on a path this document has moved away from, pointing at clause 9 for the general rule",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "observed together",
        count: 1,
        reason: "local fact: the announcement-removal passage denying the wider co-existence claim",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "outlives",
        count: 12,
        reason: "local fact: *the anchor outlives the record* — the module's own section heading, the passages citing it, the sink's `Arc` lifetime (a scope the language keeps, expressly outside this family) and the test named after it",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "same line group",
        count: 1,
        reason: "local fact: the anchor insertion naming where the code sits, with no post-state attached",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "same two statements",
        count: 2,
        reason: "local fact: `documents_by_path` written and erased in the same two statements as the record, and the supersession that replaces record and anchor together — both true at every mutation site, both cleared by round 3",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "seen together",
        count: 2,
        reason: "local fact: the two passages denying that the record and the anchor are always seen together",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "thing removes",
        count: 1,
        reason: "local fact: the same insertion comment, matched by the shorter phrase too",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "under one state guard",
        count: 1,
        reason: "local fact: the reload's guard, the subject of Phase 2d-4a-C's round-3 Medium",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "under the same guard",
        count: 1,
        reason: "local fact: the anchor insertion comment, a statement about where the code is",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "under the same state guard",
        count: 2,
        reason: "local fact: the record/anchor insertion and the announcement removal, each stating where the code is and denying the wider reading in the next breath",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "until the epoch",
        count: 7,
        reason: "local fact: *a path keeps an anchor until the epoch is replaced* — `CommitAnchor`'s doc, the slot paragraph, `record_app_write`, the wait comment, `decide`'s stamp section and two test comments",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "within its epoch",
        count: 3,
        reason: "local fact: `SequenceSpaceExhausted` is terminal within its epoch — the refusal's doc, the arm that states it and one assertion message",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "written together",
        count: 1,
        reason: "local fact: `record_app_write`'s heading, the insertion half of round 9's second High",
    },
    Judged {
        file: "src-tauri/src/menu.rs",
        phrase: "never observe",
        count: 1,
        reason: "false positive: nothing in libtest can build a `muda::Menu`, so no test looks at the real closure failing",
    },
    Judged {
        file: "src-tauri/src/prose_sweep.rs",
        phrase: "one entry per",
        count: 1,
        reason: "false positive: the shared comparison's assertion that an inventory holds one entry per file and phrase — the machinery both checks share is swept rather than exempted, and this is what that costs. It named src-tauri/src/liveness_contract.rs until 2d-4a-C's review round moved that assertion into `crate::prose_sweep`; only the file moved, and this reverse-direction failure is what made it be judged again",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "across a replacement",
        count: 5,
        reason: "local fact: what a workspace replacement makes stale or unusable — the identity arm, `newest_sequence`'s own falling half, and three test positions",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "across two epochs",
        count: 1,
        reason: "local fact: a test comment on why the successor's smaller answer is not a walk-back",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "and monotonic",
        count: 1,
        reason: "local fact: `ReconciliationBatch::discarded`, the field clause 7 is derived from",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "cumulative",
        count: 2,
        reason: "local fact: `QUEUE_CAPACITY`'s account of what an overflow costs, and `discarded`'s own doc",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "discards everything",
        count: 1,
        reason: "local fact: `ReconciliationQueue::begin_epoch`'s own summary — the third way a stored entry leaves",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "epoch-scoped",
        count: 3,
        reason: "local fact: `newest_sequence` recording that the code has been epoch-scoped since the original round, and two positions about an epoch-scoped identity copy this queue no longer keeps",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "highest watermark",
        count: 2,
        reason: "local fact: `newest_sequence`'s definition of what an empty batch carries, and the assertion message that pins it",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "in the same call",
        count: 1,
        reason: "local fact: the module doc on an entry the capacity bound evicts in the same call as the wake it emits — an execution fact about one call, with no post-state attached",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "leaves the queue",
        count: 1,
        reason: "a pointer: `discarded` naming the third way and handing its scope to clause 4",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "leaves this queue",
        count: 2,
        reason: "a pointer and a local fact: `begin_epoch` naming itself as the third way, and the test comment that drives it",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "means nothing across",
        count: 2,
        reason: "local fact: `begin_epoch`'s reason for discarding, and the test comment on why a smaller successor answer is not a walk-back",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "never evicted",
        count: 1,
        reason: "local fact: `QUEUE_CAPACITY`'s implemented guarantee — a document with one pending entry is never evicted while another has two — which is R10 narrowed to what the tie rule gives",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "never falls",
        count: 2,
        reason: "local fact: `newest_sequence`'s scoped claim, and the test comment recording what Phase 2d-4a's round 6 found over-claiming",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "never moves",
        count: 1,
        reason: "local fact: an assertion message about an empty batch, scoped to one epoch in its own words",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "nothing evicts",
        count: 1,
        reason: "local fact: a test comment establishing that the entry it discards leaves for the replacement and for no other reason",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "outlives",
        count: 2,
        reason: "a pointer and a false positive: path identity outliving a workspace epoch, handed to clause 1, and the wake emitter's `Arc`, which is a scope the language keeps",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "scoped to one",
        count: 2,
        reason: "local fact: `newest_sequence`'s own scope sentence and the test comment that exercises it",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "survives a replacement",
        count: 1,
        reason: "local fact: `begin_epoch`'s reason for discarding — an identity survives where a sequence does not",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "three ways",
        count: 2,
        reason: "a pointer and a false positive: the module doc's retention boundary, which hands the count to clause 4, and `external_observation`'s three ways to an address",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "two ways",
        count: 1,
        reason: "false positive: the two reasons an observation carries no address, which this arm does not distinguish",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "unconditionally",
        count: 2,
        reason: "local fact: `newest_sequence` telling a caller to store it, scoped to the epoch the batch names, and the test comment that repeats the scope",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "walk-back",
        count: 2,
        reason: "local fact: `newest_sequence`'s denial that a replacement epoch is one, and the test comment that drives it",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "watermark backwards",
        count: 3,
        reason: "local fact: `newest_sequence`'s out-of-order-drain paragraph and one assertion message, both scoped to one epoch",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "within one epoch",
        count: 4,
        reason: "local fact: the single-threaded enqueue, the drain's loss statement and two test positions, each naming the scope it holds in",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "within the epoch",
        count: 2,
        reason: "local fact: `newest_sequence`'s canonical scope sentence and `discarded`'s cumulative half",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "without the other",
        count: 1,
        reason: "false positive: two struct variants rather than two `Option`s, so the wire shape cannot carry one operand without the other",
    },
    Judged {
        file: "src-tauri/src/rust_source.rs",
        phrase: "three ways",
        count: 1,
        reason: "false positive: the three ways line scanning fails open, which is why that module parses instead",
    },
    Judged {
        file: "src-tauri/src/rust_source.rs",
        phrase: "two ways",
        count: 1,
        reason: "false positive: the two ways an enum reaches a serializer",
    },
    Judged {
        file: "src-tauri/src/save.rs",
        phrase: "in one call",
        count: 1,
        reason: "false positive: a placement and the item it is placed after coming out of one snapshot — an evidence value, not retained state",
    },
    Judged {
        file: "src-tauri/src/watch.rs",
        phrase: "for the life of",
        count: 2,
        reason: "false positive: two resource lifetimes — a watcher's polling mode once engaged, and one `Reap` per permanently stuck worker — neither of them state any decision consults",
    },
    Judged {
        file: "src-tauri/src/watch.rs",
        phrase: "never observe",
        count: 1,
        reason: "false positive: a state nothing looks at a second time, which is the liveness family and `espansoconfig_core::watch::liveness`'s subject",
    },
    Judged {
        file: "src-tauri/src/watch.rs",
        phrase: "two ways",
        count: 2,
        reason: "false positive: the two ways a refresh can be unusable to a save, and the two ways a watcher is stopped",
    },
]; // End of the recorded retained-state inventory

/// Every occurrence of every [`RETAINED_STATE_SHAPES`] phrase in the two
/// [`SWEPT_TREES`], in file order.
///
/// The walk, the prose-unit split, the matcher and the tally are
/// [`crate::prose_sweep`]'s, shared with [`crate::liveness_contract`]. What this
/// function contributes is the three constants above.
fn sweep() -> Vec<Hit> {
    crate::prose_sweep::sweep(RETAINED_STATE_SHAPES, SWEPT_TREES, SKIPPED)
} // End of function sweep()

#[cfg(test)]
mod tests {
    use super::*;
    use crate::prose_sweep::prose_units;

    /// Every phrase in the family is lowercase, so the case-insensitive
    /// comparison in [`sweep`] can never silently fail to match.
    #[test]
    fn every_shape_is_lowercase() {
        for phrase in RETAINED_STATE_SHAPES {
            assert_eq!(
                *phrase,
                phrase.to_lowercase(),
                "a phrase compared against lowercased text must be lowercase"
            );
        }
    } // End of function every_shape_is_lowercase()

    /// The sweep finds something, in both trees, in the contract itself and in
    /// the machinery the two contract checks share; and its walk covers the
    /// sibling check as well.
    ///
    /// A guard that silently swept an empty set would pass every assertion below
    /// it, which is the vacuous pass every check in this repository exists to
    /// avoid. Beyond that, the assertions worth stating are that the contract this
    /// module is about is swept rather than exempted, and that neither
    /// [`crate::prose_sweep`] nor `crate::liveness_contract` is shielded — a check
    /// does not get to exempt its sibling or the code it shares with it.
    ///
    /// **The assertions after those read the walk's file selection and its skip
    /// list, never its hits**, and that is Phase 2d-4a-C step 2's round-2
    /// finding. The sibling-coverage assertion was hit-based, and it named
    /// `src-tauri/src/liveness_contract.rs` until step 2's round 1 moved the
    /// comparison — and the one retained-state-shaped wording that file held, its
    /// own duplicate-detection assertion message — into `crate::prose_sweep`,
    /// leaving the sibling with nothing for this sweep to find. Re-pointing the
    /// assertion at `prose_sweep.rs` kept it true and left the property it was
    /// defending unguarded: **a hit-based assertion cannot cover a file that
    /// legitimately holds no hit**, so dropping `liveness_contract.rs` from the
    /// walk would have gone unnoticed. [`crate::prose_sweep::selected_files`]
    /// answers which files the walk covers, and [`sweep`] selects through that
    /// same function.
    ///
    /// **What that is worth, exactly.** The call below is a second traversal,
    /// not the `Vec` the sweep above walked — that value belongs to one
    /// invocation of `sweep` and is never handed out. What is asserted here is
    /// what `selected_files` answers for this check's [`SWEPT_TREES`] and
    /// [`SKIPPED`], which is what the guard's own sweep selects from because it
    /// asks the same function with the same two arguments; nothing in the code
    /// holds the two traversals to each other.
    #[test]
    fn the_sweep_reaches_both_trees() {
        let hits = sweep();
        assert!(
            hits.iter().any(|hit| hit.file.starts_with("src-tauri/")),
            "the application tree is swept"
        );
        assert!(
            hits.iter()
                .any(|hit| hit.file.starts_with("crates/espansoconfig-core/")),
            "the core tree is swept"
        );
        assert!(
            hits.iter()
                .any(|hit| hit.file == "crates/espansoconfig-core/src/watch/retained_state.rs"),
            "the contract itself is swept, not exempted"
        );

        let selected = crate::prose_sweep::selected_files(SWEPT_TREES, SKIPPED);
        assert!(
            selected
                .iter()
                .any(|file| file.reported == "src-tauri/src/liveness_contract.rs"),
            "the sibling contract check is covered by this walk, hit or no hit — neither check exempts the other"
        );
        assert!(
            selected
                .iter()
                .any(|file| file.reported == "src-tauri/src/prose_sweep.rs"),
            "the machinery both contract checks share is covered by this walk too"
        );
        assert_eq!(
            SKIPPED,
            ["src-tauri/src/retained_state_contract.rs"],
            "this check skips exactly one file, its own source — the stated hole, and nothing else"
        );
        assert!(
            !selected.iter().any(|file| file.reported == SKIPPED[0]),
            "and the skip list has that effect on the walk"
        );
    } // End of function the_sweep_reaches_both_trees()

    /// A run of comment lines is matched as one unit, so a claim that wraps is
    /// visible.
    ///
    /// Driven rather than argued, and driven with a phrase of **this** family:
    /// the source below holds `within the epoch` across a line break and nowhere
    /// on one line.
    #[test]
    fn a_claim_that_wraps_across_a_line_break_is_seen() {
        let source =
            "/// the watermark never falls within\n/// the epoch the batch names\nfn f() {}\n";
        let units = prose_units(source);
        assert_eq!(units.len(), 2, "one comment run and one code line");
        assert!(
            units[0].text.contains("within the epoch"),
            "the run is joined: {:?}",
            units[0].text
        );
        assert!(
            !source.lines().any(|line| line.contains("within the epoch")),
            "and no single line holds it, which is what a line sweep would miss"
        );
    } // End of function a_claim_that_wraps_across_a_line_break_is_seen()

    /// **The guard.** Every retained-state-shaped position in either tree is one
    /// the inventory carries, and every inventory entry matches something.
    ///
    /// Both directions fail: an unrecorded hit is a claim nobody judged, and an
    /// entry that matches nothing is a passage that was reworded or removed
    /// without being judged again. What this **cannot** do is decide whether a
    /// recorded passage's claim is true — see this module's own documentation.
    ///
    /// The comparison itself is [`crate::prose_sweep::complaints_against`],
    /// shared with [`crate::liveness_contract`] rather than copied out of it.
    /// What stays here is the sentence a non-empty answer is wrapped in, which
    /// names this contract and this file's `INVENTORY`.
    #[test]
    fn every_retained_state_claim_is_judged() {
        let complaints = complaints_against(&sweep(), INVENTORY, RETAINED_STATE_SHAPES);

        assert!(
            complaints.is_empty(),
            "the scoped-lifetime contract is stated once, in \
             espansoconfig_core::watch::retained_state, and every other position points at it \
             rather than restating it. These positions are not in \
             src-tauri/src/retained_state_contract.rs's INVENTORY:\n{}\n\
             Judge each one — is it the contract, a pointer, a local fact, or a false \
             positive? — and record it with its reason.",
            complaints.join("\n")
        );
    } // End of function every_retained_state_claim_is_judged()
}
