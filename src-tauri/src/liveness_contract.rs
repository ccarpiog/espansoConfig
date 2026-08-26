//! The check that keeps the liveness contract in one place — Phase 2d-3-C.
//!
//! `espansoconfig_core::watch::liveness` states the observation pipeline's
//! liveness contract once. This module is what stops it being stated again:
//! it sweeps **both** source trees for the shape family of liveness claims and
//! fails on any hit its recorded inventory does not carry.
//!
//! # Why a check at all
//!
//! Fourteen consecutive review rounds of Phase 2d-3 each found a false claim
//! about this pipeline's liveness, and rounds 12, 13 and 14 each found a claim a
//! *previous fix round* had written. The mechanical causes are on the record:
//! the contract was stated in no single place, so every consumer paraphrased it
//! and every paraphrase could drop a qualification; and round 13's sweep
//! enumerated four files rather than a directory, so its own finding survived
//! its own fix round in `crate::main`'s module header. This module answers the
//! second directly — **it walks directory trees, so a new file joins the swept
//! set with no edit here** — and it is what makes the first stay answered.
//!
//! # What it checks, and what it cannot
//!
//! It checks that every position matching the shape family is one somebody
//! judged and recorded. **It catches an *unmarked* claim and a *new* claim, and
//! it cannot judge whether a passage's claim is true**: a passage that carries a
//! pointer and still says something false passes it, and so does a rewording
//! that keeps the same phrase in the same file. The reason the check is
//! nevertheless worth having is the reduction of surface — one place to be right
//! instead of twenty — and never the check's judgement.
//!
//! Three further limits, stated rather than hoped about:
//!
//! - **A paraphrase built from none of the phrases is invisible.**
//!   [`LIVENESS_SHAPES`] is a family of wordings, not a semantic test. It is
//!   deliberately drawn around *claims* — what will or will not be answered,
//!   observed, owed or coalesced — and not around the vocabulary of the
//!   mechanism, because a pattern widened to every occurrence of *discharge*
//!   buys twenty entries of noise and no claim.
//! - **The sweep skips exactly one file: this one.** Its phrase table contains
//!   the whole family by construction, so including it would mean an inventory
//!   entry per phrase, maintained in step with the phrase list, recording
//!   nothing. [`SKIPPED`] names it, and the sweep asserts that the file exists,
//!   so a rename that silently emptied the skip list would fail here.
//! - **The unit of a hit is a prose unit, not a line.** A run of comment lines
//!   is joined before matching, because this workspace wraps its doc comments at
//!   about 76 columns and **seven** claims in the tree this check was written
//!   against span a line break — including the core engine's own module doc.
//!   A line-based sweep, which is what every round of the 2d-3 review ran by
//!   hand, cannot see them.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

/// One wording of the liveness shape family, matched case-insensitively as a
/// plain substring of a prose unit.
///
/// Grouped by the claim each makes: that something *is answered*, that a debt
/// *stays owed*, that a path *is observed again*, that something *is coalesced
/// into silence*, and that an observation *will arrive*. Every one of them is a
/// wording a review round of Phase 2d-3 actually found, or an obvious inflection
/// of one.
///
/// **Substrings on purpose.** `re-owe` covers `re-owed`, `re-owes` and
/// `re-owing`; `be answered` covers `must be answered`, `will be answered` and
/// `cannot be answered`. Narrowing a phrase to fit today's tree is what makes a
/// pattern miss tomorrow's claim.
const LIVENESS_SHAPES: &[&str] = &[
    // Something is, was, or must be answered.
    "must answer",
    "be answered",
    "is answered",
    "are answered",
    "was answered",
    "never answered",
    "answered by",
    "answers the debt",
    "answers the request",
    // A debt persists, or comes back.
    "re-owe",
    "reowe",
    "owed again",
    "stays owed",
    "still owed",
    "left owed",
    "leaves the state owed",
    "is left owed",
    "remains owed",
    "debt waits",
    "waits with it",
    // A path is observed again.
    "observes the path again",
    "observe the path again",
    "observes it again",
    "observe it again",
    "observed again",
    "re-observes",
    "re-observed",
    "fresh observation",
    "must be observed",
    "will be observed",
    "guaranteed to be observed",
    // Something is coalesced into silence.
    "into silence",
    "coalesce away",
    "coalesces away",
    "coalesced away",
    "coalesce to nothing",
    "coalesces to nothing",
    "coalesced to nothing",
    "coalescing to nothing",
    "coalesce to silence",
    "coalesces to silence",
    "coalesced to silence",
    "coalescing to silence",
    // A lost push is recovered by a later poll — the Phase 2d-4a family, added
    // by that phase's round-1 fix. `src-tauri/src/events.rs` claimed in the
    // present tense that a window which never hears a wake *still drains* after
    // listener registration, after an open and on resume, when no frontend
    // drain existed at all; none of the phrases above matched it, which is why
    // the sweep was green over a false claim. Every wording here is that claim
    // or an obvious inflection of it.
    //
    // The last five were added by that phase's **round-2** fix, which found the
    // first six drawn around the two sentences that had just been rewritten
    // rather than around the family: the passive *drained again*, the prefixed
    // *re-drain* — which covers `re-drains`, `re-drained` and `re-draining` —
    // and both word orders of reconciliation resuming were all obvious ways to
    // make the same claim and all invisible. Narrowing a phrase to fit the
    // wording of the finding that prompted it is the same mistake as narrowing
    // it to fit today's tree.
    "still drain",
    "still reconcile",
    "drain again",
    "drains again",
    "drained again",
    "re-drain",
    "reconcile again",
    "reconciles again",
    "reconciled again",
    "reconciliation resumes",
    "resumes reconciliation",
    // An observation, or a settlement, is promised.
    "observation will arrive",
    "observation arrives",
    "will arrive",
    "guaranteed to arrive",
    "promise of arrival",
    "next settlement",
    "settlement emits",
];

/// The two source trees swept, relative to the workspace root.
///
/// **Trees and never file lists**, which is the whole of `docs/decisions/
/// 2d-3-notes.md` §20.7 item 41: round 13's sweep named the four files its
/// previous findings had touched, and the twin in the fifth file survived the
/// round that closed it everywhere else.
const SWEPT_TREES: &[&str] = &["src-tauri/src", "crates/espansoconfig-core/src"];

/// The one file the sweep skips, and the reason it is skipped.
///
/// This module's own source contains every phrase of [`LIVENESS_SHAPES`] by
/// construction. Sweeping it would mean one inventory entry per phrase, kept in
/// step with the phrase list, recording nothing about the pipeline — so it is
/// skipped, and that is a stated hole: a liveness claim written into this file
/// is invisible to this check.
const SKIPPED: &str = "src-tauri/src/liveness_contract.rs";

/// One judged position: how many times one phrase may appear in one file, and
/// why every one of those occurrences is acceptable.
///
/// The key is `(file, phrase)` rather than `(file, line)` because a line number
/// moves whenever anything above it is edited, and a guard that fails on an
/// unrelated edit is a guard people learn to re-baseline without reading.
struct Judged {
    /// The file, relative to the workspace root.
    file: &'static str,
    /// The phrase, exactly as it appears in [`LIVENESS_SHAPES`].
    phrase: &'static str,
    /// How many occurrences of `phrase` this file may hold.
    count: usize,
    /// Why they are acceptable — one line, and one of four kinds: it is the
    /// contract itself; it is a pointer at the contract; it is a local fact that
    /// does not restate the contract; it is a false positive of the pattern from
    /// an unrelated subsystem.
    ///
    /// **A passage that restates an obligation and hands it on is a pointer,
    /// not a local fact**, whichever contract it hands it to — this module's
    /// subject is `espansoconfig_core::watch::liveness`, but the wake
    /// protocol's two positions restate the 2d design consult's Q3 obligation
    /// on a *future* consumer, and nothing local implements it. Phase 2d-4a's
    /// round-1 fix
    /// filed both as local fact, and round 2 found that this records incorrectly
    /// the one distinction the check exists to make a reviewer judge: a local
    /// fact is a claim this code keeps.
    reason: &'static str,
}

/// Every position in the two trees that matches the shape family, judged.
///
/// Read this as the answer to *who has looked at this sentence*. A hit that is
/// not here fails [`every_liveness_claim_is_judged`], and an entry that matches
/// nothing fails it too — a reworded passage is a passage nobody has judged in
/// its new wording.
const INVENTORY: &[Judged] = &[
    Judged {
        file: "crates/espansoconfig-core/src/draft/match_draft.rs",
        phrase: "into silence",
        count: 1,
        reason: "false positive: a drafted field read as unchanged would turn a request into silence — the draft model",
    },
    Judged {
        file: "crates/espansoconfig-core/src/patch/edit.rs",
        phrase: "answered by",
        count: 3,
        reason: "false positive: the patch engine on which questions its arithmetic answers and how a bad request is refused",
    },
    Judged {
        file: "crates/espansoconfig-core/src/patch/edit.rs",
        phrase: "are answered",
        count: 1,
        reason: "false positive: the patch engine on which questions its arithmetic answers and how a bad request is refused",
    },
    Judged {
        file: "crates/espansoconfig-core/src/patch/edit.rs",
        phrase: "be answered",
        count: 1,
        reason: "false positive: the patch engine on which questions its arithmetic answers and how a bad request is refused",
    },
    Judged {
        file: "crates/espansoconfig-core/src/patch/edit.rs",
        phrase: "is answered",
        count: 2,
        reason: "false positive: the patch engine on which questions its arithmetic answers and how a bad request is refused",
    },
    Judged {
        file: "crates/espansoconfig-core/src/patch/edit.rs",
        phrase: "must answer",
        count: 1,
        reason: "false positive: the patch engine on which questions its arithmetic answers and how a bad request is refused",
    },
    Judged {
        file: "crates/espansoconfig-core/src/persist/backup.rs",
        phrase: "answered by",
        count: 1,
        reason: "false positive: the backup catalogue on what a confidentiality argument and an occupied destination are answered with",
    },
    Judged {
        file: "crates/espansoconfig-core/src/persist/backup.rs",
        phrase: "be answered",
        count: 1,
        reason: "false positive: the backup catalogue on what a confidentiality argument and an occupied destination are answered with",
    },
    Judged {
        file: "crates/espansoconfig-core/src/persist/backup.rs",
        phrase: "is answered",
        count: 2,
        reason: "false positive: the backup catalogue on what a confidentiality argument and an occupied destination are answered with",
    },
    Judged {
        file: "crates/espansoconfig-core/src/syntax/collection.rs",
        phrase: "is answered",
        count: 1,
        reason: "false positive: an inverted span pair answered rather than panicked on",
    },
    Judged {
        file: "crates/espansoconfig-core/src/syntax/ownership.rs",
        phrase: "are answered",
        count: 1,
        reason: "false positive: R19's primitives answered from an order rather than a scan",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/correspond.rs",
        phrase: "are answered",
        count: 1,
        reason: "false positive: correspondence rows resolved against one fresh document — no liveness claim",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "answered by",
        count: 2,
        reason: "local fact: an unwatched path answered by silence, and a test comment on what the restore prevents",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "coalesce to nothing",
        count: 1,
        reason: "local fact: the module doc's *what stabilizes* section, the ordinary coalescing rule",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "coalesce to silence",
        count: 1,
        reason: "local fact: `start`'s doc, on why a baseline-established path needs a debt rather than a hint",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "coalesces to nothing",
        count: 2,
        reason: "local fact: the module doc's *provisional* section and `rescan`'s doc, both about ordinary coalescing",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "coalesces to silence",
        count: 1,
        reason: "local fact: the module doc's *owed* section, the same point at its source",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "coalescing to nothing",
        count: 1,
        reason: "local fact: `revert_settlement` naming what the rollback stops the retry doing",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "debt waits",
        count: 1,
        reason: "local fact: `observe_owed`'s own *what this does not do* paragraph, which the contract cites",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "fresh observation",
        count: 1,
        reason: "local fact: `revert_settlement` saying what comes back *if* the retry stabilizes",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "is answered",
        count: 8,
        reason: "local fact: the module doc, `Observation`'s doc, and five test assertions over an engine the tests tick themselves",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "is left owed",
        count: 1,
        reason: "local fact: a test comment about a path this engine does not watch, driven by the test below it",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "left owed",
        count: 1,
        reason: "local fact: the same test comment, matched by the shorter phrase too",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "next settlement",
        count: 2,
        reason: "local fact: the engine's own statement of what a debt makes the next settlement do",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "observe the path again",
        count: 1,
        reason: "local fact: the module doc quoting the instruction a caller gives, beside `revert_settlement`'s own *it emits nothing itself*",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "observed again",
        count: 2,
        reason: "local fact: a test comment and its assertion message, over ticks the test drives",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "owed again",
        count: 1,
        reason: "local fact: `revert_settlement`'s own conditional sentence, stated with its `if`",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "re-observed",
        count: 1,
        reason: "local fact: a closing-bracket comment naming the match it ends",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "re-owe",
        count: 1,
        reason: "local fact: `settle`'s comment on where a refused owed observation is re-owed, true by construction there",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "stays owed",
        count: 1,
        reason: "local fact: the `owed` field's own doc, one of the clauses the contract is derived from",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "still owed",
        count: 2,
        reason: "local fact: `Undone`'s own doc, and one test assertion message over an engine the test ticks",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "waits with it",
        count: 1,
        reason: "local fact: the same sentence of `observe_owed`'s doc",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/engine.rs",
        phrase: "will be observed",
        count: 1,
        reason: "local fact: `observe_owed` saying it promises nothing about what will be observed",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/liveness.rs",
        phrase: "answered by",
        count: 1,
        reason: "the contract itself",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/liveness.rs",
        phrase: "coalesced away",
        count: 1,
        reason: "the contract itself",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/liveness.rs",
        phrase: "debt waits",
        count: 1,
        reason: "the contract itself",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/liveness.rs",
        phrase: "into silence",
        count: 2,
        reason: "the contract itself",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/liveness.rs",
        phrase: "is answered",
        count: 1,
        reason: "the contract itself",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/liveness.rs",
        phrase: "must answer",
        count: 1,
        reason: "the contract itself",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/liveness.rs",
        phrase: "never answered",
        count: 1,
        reason: "the contract itself",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/liveness.rs",
        phrase: "observes the path again",
        count: 1,
        reason: "the contract itself",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/liveness.rs",
        phrase: "re-owe",
        count: 2,
        reason: "the contract itself",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/liveness.rs",
        phrase: "waits with it",
        count: 1,
        reason: "the contract itself",
    },
    Judged {
        file: "crates/espansoconfig-core/src/watch/liveness.rs",
        phrase: "will be observed",
        count: 1,
        reason: "the contract itself",
    },
    Judged {
        file: "src-tauri/src/backup.rs",
        phrase: "re-observed",
        count: 1,
        reason: "false positive: a backup entry re-observed by the mapping that verified it",
    },
    Judged {
        file: "src-tauri/src/events.rs",
        phrase: "drains again",
        count: 1,
        reason: "a pointer: `wake_emitter` restating the 2d consult's Q3 obligation on a future consumer, and denying in the next paragraph that anything local performs it",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "drains again",
        count: 1,
        reason: "a pointer: the same Q3 obligation at `ReconciliationQueue::wake`, handed to 2d-4b and 2d-5 — the wire's recovery from a dropped hint, implemented by nothing here",
    },
    Judged {
        file: "src-tauri/src/reconciliation.rs",
        phrase: "must answer",
        count: 1,
        reason: "false positive: `address_of_minted` requiring the open workspace to resolve a path to the *same* identity a snapshot minted, which round 5 turned into a `debug_assert_eq!` — an assertion about two identity sources agreeing, not about whether a path is ever looked at again",
    },
    Judged {
        file: "src-tauri/src/commands.rs",
        phrase: "coalesce to nothing",
        count: 1,
        reason: "local fact: the module header naming the defect the rollback closes, not what it promises",
    },
    Judged {
        file: "src-tauri/src/commands.rs",
        phrase: "coalesced away",
        count: 1,
        reason: "local fact: a test comment on what the withholding door defers",
    },
    Judged {
        file: "src-tauri/src/commands.rs",
        phrase: "into silence",
        count: 4,
        reason: "local fact: the marking and withholding decisions, which are about coalescing a later reading",
    },
    Judged {
        file: "src-tauri/src/commands.rs",
        phrase: "is answered",
        count: 7,
        reason: "false positive: a save outcome answered as `Saved`, an operation's two identities answered separately, and an uncertain write answered `None` — the save subsystem, not the watcher",
    },
    Judged {
        file: "src-tauri/src/commands.rs",
        phrase: "must answer",
        count: 1,
        reason: "false positive: an assertion that `document_text` answers the file's bytes",
    },
    Judged {
        file: "src-tauri/src/commands.rs",
        phrase: "never answered",
        count: 1,
        reason: "local fact: a reading is never answered *self-write* at this door — suppression, not liveness",
    },
    Judged {
        file: "src-tauri/src/commands.rs",
        phrase: "was answered",
        count: 1,
        reason: "local fact: what the pre-round-8 door answered, in the same passage",
    },
    Judged {
        file: "src-tauri/src/dictionary_contract.rs",
        phrase: "answered by",
        count: 1,
        reason: "false positive: the dictionary check on which of its three questions is answered",
    },
    Judged {
        file: "src-tauri/src/dictionary_contract.rs",
        phrase: "is answered",
        count: 1,
        reason: "false positive: the dictionary check on which of its three questions is answered",
    },
    Judged {
        file: "src-tauri/src/dispatch_check.rs",
        phrase: "be answered",
        count: 2,
        reason: "false positive: dispatcher assertions about what a command must answer and what may not be answered from a cache",
    },
    Judged {
        file: "src-tauri/src/dispatch_check.rs",
        phrase: "must answer",
        count: 3,
        reason: "false positive: dispatcher assertions about what a command must answer and what may not be answered from a cache",
    },
    Judged {
        file: "src-tauri/src/error.rs",
        phrase: "is answered",
        count: 1,
        reason: "false positive: a refusal's doc saying a cross-file move's questions are not answered",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "answered by",
        count: 1,
        reason: "local fact: a save-path refresh had nothing to answer its refusal, which is round 4's finding and not a liveness promise",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "coalesces to nothing",
        count: 1,
        reason: "local fact: a test comment describing the defect the test drives",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "guaranteed to arrive",
        count: 1,
        reason: "local fact: a negative about native delivery, citing 2d-2-notes.md §2.3",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "into silence",
        count: 2,
        reason: "local fact: the `announced` map and a test comment, both about what a marker would coalesce",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "is answered",
        count: 2,
        reason: "local fact: two test positions, over engines the tests tick themselves",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "must answer",
        count: 1,
        reason: "local fact: `PrecedesACommit` is the one arm `admitting_sink` must map to `Undecided`, with the contract pointed at beside it",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "observed again",
        count: 3,
        reason: "local fact: two assertion messages and one test comment, each in a test that drives its own ticks",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "promise of arrival",
        count: 1,
        reason: "local fact: the negative clause of that same sentence",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "re-observed",
        count: 2,
        reason: "local fact: the module-doc heading, plus the sentence saying that heading contrasts with *published* and promises no arrival",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "re-owe",
        count: 1,
        reason: "a pointer: the topic list of the sentence that hands the claim to the contract",
    },
    Judged {
        file: "src-tauri/src/ledger.rs",
        phrase: "was answered",
        count: 2,
        reason: "local fact: the same sentence, and one test assertion message about what the engine no longer believes",
    },
    Judged {
        file: "src-tauri/src/main.rs",
        phrase: "coalescing to nothing",
        count: 1,
        reason: "local fact: the crate header naming the defect an unanswered refusal would leave",
    },
    Judged {
        file: "src-tauri/src/main.rs",
        phrase: "into silence",
        count: 1,
        reason: "local fact: the crate header on what a marker would coalesce",
    },
    Judged {
        file: "src-tauri/src/watch.rs",
        phrase: "answered by",
        count: 1,
        reason: "local fact: a test comment on the premise of the test containing it",
    },
    Judged {
        file: "src-tauri/src/watch.rs",
        phrase: "be answered",
        count: 2,
        reason: "local fact: the same test comment, over a tree the test builds and a baseline it waits for",
    },
    Judged {
        file: "src-tauri/src/watch.rs",
        phrase: "coalesces to nothing",
        count: 2,
        reason: "local fact: `ObservationOutcome` and `deliver` describing the defect the rollback exists to close",
    },
    Judged {
        file: "src-tauri/src/watch.rs",
        phrase: "coalesces to silence",
        count: 1,
        reason: "local fact: `baseline`'s doc, on why the retained requests go in as debts",
    },
    Judged {
        file: "src-tauri/src/watch.rs",
        phrase: "is answered",
        count: 2,
        reason: "local fact: a failed send answered as `NoWatcher`, and one test assertion message",
    },
    Judged {
        file: "src-tauri/src/watch.rs",
        phrase: "never answered",
        count: 1,
        reason: "local fact: `ReObserveOutcome`'s own doc, the source of the contract's fifth *not guaranteed* clause",
    },
    Judged {
        file: "src-tauri/src/watch.rs",
        phrase: "observation will arrive",
        count: 1,
        reason: "local fact: the same doc, saying an `Asked` promises an inbox and not an observation",
    },
    Judged {
        file: "src-tauri/src/watch.rs",
        phrase: "observed again",
        count: 4,
        reason: "local fact: the *a save may ask* heading (ask is the verb), `ObservationOutcome`'s defect description, `HintOrigin::Application` and the worker loop, each naming a message rather than promising an arrival",
    },
    Judged {
        file: "src-tauri/src/watch.rs",
        phrase: "re-observed",
        count: 1,
        reason: "local fact: `Undecided`'s rule that a refusal re-reading cannot change must not be reverted",
    },
    Judged {
        file: "src-tauri/src/watch.rs",
        phrase: "will arrive",
        count: 1,
        reason: "local fact: the same sentence, matched by the shorter phrase too",
    },
    Judged {
        file: "src-tauri/src/watch.rs",
        phrase: "will be observed",
        count: 1,
        reason: "local fact: `ReObserveOutcome`'s opening line, which claims nothing about what will be observed",
    },
    Judged {
        file: "src-tauri/src/watch_check.rs",
        phrase: "observation arrives",
        count: 2,
        reason: "local fact: this suite's waiting policy — a bounded wait returns when its observation arrives — and never a claim that one will",
    },
]; // End of the recorded liveness inventory

/// Every `.rs` file under `root`, in path order, recursively.
fn rust_files_under(root: &Path) -> Vec<PathBuf> {
    let mut found: Vec<PathBuf> = Vec::new();
    let mut pending: Vec<PathBuf> = vec![root.to_path_buf()];
    while let Some(directory) = pending.pop() {
        let entries = fs::read_dir(&directory)
            .unwrap_or_else(|error| panic!("cannot read {}: {error}", directory.display()));
        for entry in entries {
            let path = entry
                .unwrap_or_else(|error| {
                    panic!("cannot read an entry of {}: {error}", directory.display())
                })
                .path();
            if path.is_dir() {
                pending.push(path);
            } else if path.extension().is_some_and(|extension| extension == "rs") {
                found.push(path);
            }
        } // End of the loop over one directory's entries
    } // End of the walk over the directory tree
    found.sort();
    found
} // End of function rust_files_under()

/// One stretch of prose to match against: a joined run of comment lines, or one
/// non-comment line.
struct ProseUnit {
    /// The 1-based line the unit starts at, for the failure report.
    line: usize,
    /// The text, with `//!`, `///` and `//` markers removed and the run's lines
    /// joined by single spaces.
    text: String,
}

/// Splits `source` into the units the sweep matches against.
///
/// **A contiguous run of comment lines becomes one unit.** This workspace wraps
/// its doc comments at about 76 columns, so a claim of eleven words straddles a
/// line break as a matter of course, and a line-based sweep — which is what
/// every hand-run round of the 2d-3 review used — cannot see it. Everything that
/// is not a comment line stays one unit per line, which is what keeps an
/// assertion message or a test name reported at its own position.
fn prose_units(source: &str) -> Vec<ProseUnit> {
    let lines: Vec<&str> = source.lines().collect();
    let mut units: Vec<ProseUnit> = Vec::new();
    let mut index = 0usize;
    while index < lines.len() {
        if lines[index].trim_start().starts_with("//") {
            let start = index;
            let mut joined: Vec<&str> = Vec::new();
            while index < lines.len() && lines[index].trim_start().starts_with("//") {
                let trimmed = lines[index].trim_start();
                let body = trimmed
                    .strip_prefix("//!")
                    .or_else(|| trimmed.strip_prefix("///"))
                    .or_else(|| trimmed.strip_prefix("//"))
                    .unwrap_or(trimmed);
                joined.push(body.trim());
                index += 1;
            } // End of the loop over one run of comment lines
            units.push(ProseUnit {
                line: start + 1,
                text: joined.join(" "),
            });
        } else {
            units.push(ProseUnit {
                line: index + 1,
                text: lines[index].to_string(),
            });
            index += 1;
        }
    } // End of the walk over the file's lines
    units
} // End of function prose_units()

/// One occurrence of one phrase in one file.
struct Hit {
    /// The file, relative to the workspace root.
    file: String,
    /// The 1-based line the prose unit holding it starts at.
    line: usize,
    /// The phrase that matched.
    phrase: &'static str,
    /// A window of the unit's text around the match, for the failure report.
    context: String,
}

/// The workspace root — this crate's manifest directory's parent.
fn workspace_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri has a parent directory")
        .to_path_buf()
} // End of function workspace_root()

/// Every occurrence of every [`LIVENESS_SHAPES`] phrase in the two
/// [`SWEPT_TREES`], in file order.
fn sweep() -> Vec<Hit> {
    let root = workspace_root();
    assert!(
        root.join(SKIPPED).is_file(),
        "the skipped file {SKIPPED} must exist, or the skip list is silently empty"
    );
    let mut hits: Vec<Hit> = Vec::new();
    for tree in SWEPT_TREES {
        for path in rust_files_under(&root.join(tree)) {
            let relative = path
                .strip_prefix(&root)
                .expect("a swept file lives under the workspace root")
                .to_string_lossy()
                .into_owned();
            if relative == SKIPPED {
                continue;
            }
            let source = fs::read_to_string(&path)
                .unwrap_or_else(|error| panic!("cannot read {}: {error}", path.display()));
            for unit in prose_units(&source) {
                let lowered = unit.text.to_lowercase();
                for phrase in LIVENESS_SHAPES {
                    let mut from = 0usize;
                    while let Some(offset) = lowered[from..].find(phrase) {
                        let at = from + offset;
                        hits.push(Hit {
                            file: relative.clone(),
                            line: unit.line,
                            phrase,
                            context: window_around(&unit.text, at, phrase.len()),
                        });
                        from = at + phrase.len();
                    } // End of the loop over one phrase's occurrences in one unit
                } // End of the loop over the phrase family
            } // End of the loop over one file's prose units
        } // End of the loop over one tree's files
    } // End of the loop over the swept trees
    hits
} // End of function sweep()

/// Up to 70 characters either side of a match, on character boundaries.
fn window_around(text: &str, at: usize, length: usize) -> String {
    let start = (0..=at.saturating_sub(70))
        .rev()
        .find(|candidate| text.is_char_boundary(*candidate))
        .unwrap_or(0);
    let end = (at + length..=(at + length + 70).min(text.len()))
        .rev()
        .find(|candidate| text.is_char_boundary(*candidate))
        .unwrap_or(text.len());
    text[start..end].to_string()
} // End of function window_around()

/// `(file, phrase)` to the number of hits, for one side of the comparison.
fn tally(hits: &[Hit]) -> BTreeMap<(String, &'static str), usize> {
    let mut counted: BTreeMap<(String, &'static str), usize> = BTreeMap::new();
    for hit in hits {
        *counted.entry((hit.file.clone(), hit.phrase)).or_insert(0) += 1;
    }
    counted
} // End of function tally()

#[cfg(test)]
mod tests {
    use super::*;

    /// Every phrase in the family is lowercase, so the case-insensitive
    /// comparison in [`sweep`] can never silently fail to match.
    #[test]
    fn every_shape_is_lowercase() {
        for phrase in LIVENESS_SHAPES {
            assert_eq!(
                *phrase,
                phrase.to_lowercase(),
                "a phrase compared against lowercased text must be lowercase"
            );
        }
    } // End of function every_shape_is_lowercase()

    /// The sweep finds something, in both trees.
    ///
    /// A guard that silently swept an empty set would pass every assertion below
    /// it, which is the vacuous pass every check in this repository exists to
    /// avoid — `crate::rust_source`'s module docs say it of a parser, and it is
    /// as true of a walk.
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
                .any(|hit| hit.file == "crates/espansoconfig-core/src/watch/liveness.rs"),
            "the contract itself is swept, not exempted"
        );
    } // End of function the_sweep_reaches_both_trees()

    /// A run of comment lines is matched as one unit, so a claim that wraps is
    /// visible.
    ///
    /// Driven rather than argued: the source below holds `is answered` across a
    /// line break and nowhere on one line.
    #[test]
    fn a_claim_that_wraps_across_a_line_break_is_seen() {
        let source = "/// the refusal is\n/// answered by the rollback\nfn f() {}\n";
        let units = prose_units(source);
        assert_eq!(units.len(), 2, "one comment run and one code line");
        assert!(
            units[0].text.contains("is answered by"),
            "the run is joined: {:?}",
            units[0].text
        );
        assert!(
            !source.lines().any(|line| line.contains("is answered")),
            "and no single line holds it, which is what a line sweep would miss"
        );
    } // End of function a_claim_that_wraps_across_a_line_break_is_seen()

    /// **The guard.** Every liveness-shaped position in either tree is one the
    /// inventory carries, and every inventory entry matches something.
    ///
    /// Both directions fail: an unrecorded hit is a claim nobody judged, and an
    /// entry that matches nothing is a passage that was reworded or removed
    /// without being judged again. What this **cannot** do is decide whether a
    /// recorded passage's claim is true — see this module's own documentation.
    #[test]
    fn every_liveness_claim_is_judged() {
        let hits = sweep();
        let found = tally(&hits);
        let mut recorded: BTreeMap<(String, &'static str), usize> = BTreeMap::new();
        for entry in INVENTORY {
            assert!(
                LIVENESS_SHAPES.contains(&entry.phrase),
                "the inventory names a phrase the family does not hold: {}",
                entry.phrase
            );
            assert!(
                !entry.reason.is_empty(),
                "every inventory entry carries its reason: {} / {}",
                entry.file,
                entry.phrase
            );
            let slot = recorded
                .entry((entry.file.to_string(), entry.phrase))
                .or_insert(0);
            assert_eq!(*slot, 0, "one entry per file and phrase: {}", entry.file);
            *slot = entry.count;
        } // End of the loop over the recorded inventory

        let mut complaints: Vec<String> = Vec::new();
        for (key, count) in &found {
            let expected = recorded.get(key).copied().unwrap_or(0);
            if expected != *count {
                let where_ = hits
                    .iter()
                    .filter(|hit| hit.file == key.0 && hit.phrase == key.1)
                    .map(|hit| format!("            line {}: …{}…", hit.line, hit.context))
                    .collect::<Vec<String>>()
                    .join("\n");
                complaints.push(format!(
                    "    {} / {:?}: found {}, inventory says {}\n{}",
                    key.0, key.1, count, expected, where_
                ));
            }
        } // End of the loop over what the sweep found
        for (key, count) in &recorded {
            if !found.contains_key(key) && *count > 0 {
                complaints.push(format!(
                    "    {} / {:?}: inventory says {}, found none — reworded or removed, so judge it again",
                    key.0, key.1, count
                ));
            }
        } // End of the loop over what the inventory records

        assert!(
            complaints.is_empty(),
            "the liveness contract is stated once, in \
             espansoconfig_core::watch::liveness, and every other position points at it \
             rather than restating it. These positions are not in \
             src-tauri/src/liveness_contract.rs's INVENTORY:\n{}\n\
             Judge each one — is it the contract, a pointer, a local fact, or a false \
             positive? — and record it with its reason.",
            complaints.join("\n")
        );
    } // End of function every_liveness_claim_is_judged()
}
