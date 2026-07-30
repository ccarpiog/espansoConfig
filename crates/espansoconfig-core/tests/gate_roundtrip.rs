//! **Phase 0c-3b-2b acceptance — the Phase 0 architectural gate (R4).**
//!
//! `IMPLEMENTATION_PLAN.md` section 12 makes one thing the exit criterion for
//! Phase 0: *"the round-trip property test passes on the full corpus"*. This file
//! is that test. The verdict it supports is written down in
//! `docs/decisions/0c-3b-2b-notes.md`.
//!
//! # What this file adds that the four per-operation sweeps do not
//!
//! `tests/patch_edit.rs`, `tests/patch_structure.rs` and `tests/patch_move.rs`
//! each sweep **one** operation exhaustively and re-derive every refusal reason
//! from the document. They are not repeated here. What R9 asks for and none of
//! them can answer is the **crossing**: that every presentational axis a document
//! can have — CRLF, a BOM, no final newline, trailing spaces, comments,
//! block-scalar terminal newlines — and every structural construct it can hold —
//! duplicate keys, nested sequence mappings, merge keys, aliases, explicit keys,
//! empty values — has been met by **every one of the four operations**, and that
//! the same properties hold at every one of those meetings.
//!
//! So the unit here is (fixture × operation × target), **every** eligible target
//! of both corpora, and the pinned result is twofold:
//!
//! - a **per-fixture outcome row**, applied and refused for each of the four
//!   operations, with the table asserted to cover the corpus exactly
//!   ([`SYNTHETIC_OUTCOMES`]);
//! - an **axis × operation coverage matrix** ([`AXIS_COVERAGE`]) whose cells say
//!   whether that axis was met by that operation and whether anything applied.
//!   A cell that silently became [`Coverage::Absent`] is a coverage hole wearing
//!   a green tick, and this table is what makes it impossible.
//!
//! "Met by" is **operation-local** for a structural axis and document-scoped for a
//! presentational one, and [`Scope`] is where that distinction is argued. It is
//! the Phase 0c-3b-2b review's third finding: a matrix that credits an axis to
//! every attempt in a file that merely *contains* the construct proves
//! co-occurrence, not interaction.
//!
//! # Refusals are stated, not counted as passes
//!
//! Four of R9's named constructs — **duplicate keys, merge keys, aliases and
//! explicit keys** — are refused outright by the hazard gate, so for those the
//! property is that the refusal is **typed and total**, not that the edit
//! succeeds. All sixteen of their cells in [`AXIS_COVERAGE`] are
//! [`Coverage::RefusedOnly`] and are asserted as such; [`REFUSAL_ONLY_CELLS`]
//! accounts for every refusal-only cell of the matrix, including the two that are
//! **capability gaps** rather than hazard refusals; and [`CorpusTotals::hazards`]
//! additionally pins, per hazard family, how many attempts that family blocked and
//! that **none of them applied**. A construct that quietly stopped contributing
//! attempts would show as a zero there.
//!
//! # The properties every applied edit must satisfy
//!
//! Uniform across all four operations, and written here from the original
//! document rather than from anything the engine declared:
//!
//! 1. **the candidate is the source with the replacements applied**, replacements
//!    ascending and disjoint;
//! 2. **it is still valid YAML**;
//! 3. **the span matches the requested structural path** — every replacement lies
//!    inside the whole physical lines the named construct occupies, derived
//!    textually from the node spans (`owned_lines`), and for a scalar edit inside
//!    the exact spans that scalar owns. For a **removal** this now has a
//!    production counterpart as well
//!    (`VerificationFailure::RemovalCarriesMoreThanTheEntry`); both are kept,
//!    because two derivations of one boundary is the discipline, and the phase
//!    notes' experiments E5 and E5b show each firing on its own;
//! 4. **the edit did what it said** — the value is there, the entry is there or
//!    gone, the sequence holds the intended permutation;
//! 5. **no comment the file owns was lost**, compared by text over an independent
//!    scan;
//! 6. **the candidate holds no line ending the source does not** (D2p, stated as
//!    containment so it is total);
//! 7. **no new YAML 1.1-ambiguous plain scalar** — R16's differential property,
//!    derived here a second time from [`crate::emit`]'s tag table;
//! 8. **every block scalar's decoded value is conserved** where the operation
//!    names none of them, which is where "block-scalar terminal newlines survive"
//!    stops being an assertion about one fixture and becomes one about the corpus.
//!
//! # Privacy
//!
//! The real corpus is the owner's private configuration (`CLAUDE.md` section 1).
//! This file prints file names, counts and byte offsets only. It never prints a
//! scalar, a key, a path or a byte of real content, no count taken from it is
//! hard-coded, and every real-corpus test skips cleanly when it is absent.

mod common;

use std::collections::BTreeMap;

use common::{real_corpus, skip_without_real_corpus, synthetic_valid, CorpusFile};
use espansoconfig_core::emit::{
    decode, is_conservatively_safe_plain_scalar, plain_scalar_is_ambiguous, resolve_plain_yaml_1_1,
    resolve_plain_yaml_1_2_core, YamlTag,
};
use espansoconfig_core::patch::{
    apply_edits, apply_scalar_edit, insert_field, move_item, path_to, remove_field, AddressError,
    DocumentEdit, DocumentPath, EditError, FieldInsert, PatchedDocument, Replacement,
};
use espansoconfig_core::syntax::{
    CollectionStyle, Hazard, HazardKind, NodeKind, NodeRole, TriviaIndex,
};
use espansoconfig_core::{ByteSpan, Chomping, NodeId, ScalarStyle, SyntaxIndex};

// ---------------------------------------------------------------------------
// What the sweep attempts
// ---------------------------------------------------------------------------

/// The values a scalar edit is asked to write.
///
/// Six, of which each scalar gets two (rotated by node index, so every value
/// reaches a share of the corpus without paying the full cross product a second
/// time — `tests/patch_edit.rs` already pays it). Chosen so that each one exists
/// to reach something:
///
/// | Value | What it reaches |
/// |---|---|
/// | `plain` | the plain style, unchanged presentation |
/// | `no` | a YAML 1.1 boolean spelling — must come out quoted |
/// | `._7` | **the value the tag oracle found and the emitter's shape test did not** |
/// | `one\ntwo\n` | a literal block, and a document with no break to copy |
/// | `Don't` | single quotes, and the apostrophe that forces the choice |
/// | `día ⌘😀` | non-ASCII including an astral character |
const VALUES: [&str; 6] = ["plain", "no", "._7", "one\ntwo\n", "Don't", "día ⌘😀"];

/// The values an inserted field is given. Both, always: the second is the one
/// that exercises R16's emission side on every mapping in both corpora.
const INSERT_VALUES: [&str; 2] = ["plain", "no"];

/// The key an insertion adds. Deliberately not a key any fixture holds.
const INSERT_KEY: &str = "phase0c3b2bGate";

// **There is no target stride.** Phase 0c-3b-2b first swept the real corpus with
// `REAL_CORPUS_STRIDE = 3` — every third mapping, every third sequence — because
// `TriviaIndex::scan` is quadratic and the sweep was slow. Its review pointed out
// that `PROGRESS.md`'s R19 said the opposite in as many words: *memoise
// `ownership.rs`'s primitives by position rather than thinning the sweep*. The
// primitives are now answered from a precomputed order
// (`src/syntax/ownership.rs`), and **both corpora are swept over every eligible
// target**: every scalar, every mapping, every entry of every mapping and every
// block sequence with two or more items.
//
// What is still a *fixed set* rather than a cross product is stated in section
// 1.3 of the notes and applies to both corpora equally: two of the six values per
// scalar, rotated by node index; two insertions per mapping; one removal per
// entry; two relocations per sequence. The exhaustive cross products live in the
// per-operation sweeps, which is what those files are for.

// ---------------------------------------------------------------------------
// The two dimensions the gate crosses
// ---------------------------------------------------------------------------

/// One of the four operations the engine has.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Operation {
    /// [`espansoconfig_core::patch::ScalarEdit`].
    ScalarEdit,
    /// [`espansoconfig_core::patch::FieldInsert`].
    FieldInsert,
    /// [`espansoconfig_core::patch::FieldRemoval`].
    FieldRemoval,
    /// [`espansoconfig_core::patch::ItemMove`].
    ItemMove,
}

/// Every operation, in the order the pinned tables list them.
const OPERATIONS: [Operation; 4] = [
    Operation::ScalarEdit,
    Operation::FieldInsert,
    Operation::FieldRemoval,
    Operation::ItemMove,
];

impl Operation {
    /// Position in [`OPERATIONS`], which is the column order of every table.
    fn slot(self) -> usize {
        OPERATIONS
            .iter()
            .position(|candidate| *candidate == self)
            .expect("every operation is in OPERATIONS")
    }

    /// The four-character heading this operation gets in printed output.
    fn heading(self) -> &'static str {
        match self {
            Operation::ScalarEdit => "edit",
            Operation::FieldInsert => "insr",
            Operation::FieldRemoval => "remv",
            Operation::ItemMove => "move",
        }
    }
}

/// A property of a document that R9 names, derived from the document itself.
///
/// Six presentational and six structural. Nothing here is hard-coded per
/// fixture: `axes_of` reads each one off the source text and the syntax index, so
/// the same derivation classifies the real corpus, where hard-coding anything is
/// forbidden (`CLAUDE.md` section 1).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Axis {
    /// The document holds at least one `\r\n`.
    Crlf,
    /// The document begins with a UTF-8 BOM.
    Bom,
    /// The document does not end with a line break.
    NoFinalNewline,
    /// Some physical line ends with a space or a tab before its break.
    TrailingSpaces,
    /// The document holds at least one comment.
    Comments,
    /// A block scalar's terminal newline is at stake: it carries an explicit
    /// chomping indicator, or blank lines follow its content.
    BlockScalarTerminalNewline,
    /// Two entries of one mapping share a key.
    DuplicateKeys,
    /// A sequence item is a mapping that itself holds a collection — the
    /// `matches: - vars: […]` shape espanso files are made of.
    NestedSequenceMappings,
    /// A mapping holds a `<<` merge key.
    MergeKeys,
    /// The document defines an anchor or refers to an alias.
    Aliases,
    /// A mapping is written in the explicit `? key` / `: value` form.
    ExplicitKeys,
    /// Some value is empty, and therefore a zero-width scalar.
    EmptyValues,
}

/// Every axis, in the order [`AXIS_COVERAGE`] lists them.
const AXES: [Axis; 12] = [
    Axis::Crlf,
    Axis::Bom,
    Axis::NoFinalNewline,
    Axis::TrailingSpaces,
    Axis::Comments,
    Axis::BlockScalarTerminalNewline,
    Axis::DuplicateKeys,
    Axis::NestedSequenceMappings,
    Axis::MergeKeys,
    Axis::Aliases,
    Axis::ExplicitKeys,
    Axis::EmptyValues,
];

/// What "this operation met this axis" means, which is not the same question for
/// the two halves of [`AXES`].
///
/// **The Phase 0c-3b-2b review's third finding.** The matrix used to attach every
/// axis to the whole *document*, so an insertion into `global_vars[0].params`
/// credited `explicit-keys × FieldInsert` although the operation never went near
/// the explicit-key mapping. That is document co-occurrence, not interaction.
///
/// The fix is not uniform, because the two halves are not the same kind of fact:
///
/// - a **presentational** axis is a fact about the document's *bytes*, and every
///   applied attempt asserts something about all of them. Property 1 rebuilds the
///   whole candidate from the replacement list and compares it byte for byte;
///   property 5 re-scans every comment in it; property 6 every line ending;
///   property 8 every block scalar. So "a CRLF document met an insertion" is a
///   real interaction: that attempt did assert the file's CRLFs, its BOM, its
///   missing final newline and its trailing spaces came out unchanged;
/// - a **structural** axis is a fact about *one construct*, and the only
///   assertions that reach it are the ones the operation's target reaches. It is
///   credited when the construct is the target, contains it, or is contained by
///   it — and nowhere else.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Scope {
    /// A property of the document's bytes, asserted on every applied attempt.
    Presentational,
    /// A property of one construct, credited only where the operation met it.
    Structural,
}

impl Axis {
    /// Which of the two questions this axis answers.
    fn scope(self) -> Scope {
        match self {
            Axis::Crlf
            | Axis::Bom
            | Axis::NoFinalNewline
            | Axis::TrailingSpaces
            | Axis::Comments
            | Axis::BlockScalarTerminalNewline => Scope::Presentational,
            Axis::DuplicateKeys
            | Axis::NestedSequenceMappings
            | Axis::MergeKeys
            | Axis::Aliases
            | Axis::ExplicitKeys
            | Axis::EmptyValues => Scope::Structural,
        }
    } // End of function scope()

    /// Position in [`AXES`], which is the row order of the coverage matrix.
    fn slot(self) -> usize {
        AXES.iter()
            .position(|candidate| *candidate == self)
            .expect("every axis is in AXES")
    }

    /// The name printed in the coverage matrix.
    fn name(self) -> &'static str {
        match self {
            Axis::Crlf => "crlf",
            Axis::Bom => "bom",
            Axis::NoFinalNewline => "no-final-newline",
            Axis::TrailingSpaces => "trailing-spaces",
            Axis::Comments => "comments",
            Axis::BlockScalarTerminalNewline => "block-terminal-newline",
            Axis::DuplicateKeys => "duplicate-keys",
            Axis::NestedSequenceMappings => "nested-sequence-mappings",
            Axis::MergeKeys => "merge-keys",
            Axis::Aliases => "aliases",
            Axis::ExplicitKeys => "explicit-keys",
            Axis::EmptyValues => "empty-values",
        }
    } // End of function name()
}

/// How thoroughly one (axis, operation) cell was exercised.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Coverage {
    /// **No attempt at all.** A hole, and always accompanied by a comment saying
    /// why no fixture carrying that axis can offer that operation.
    Absent,
    /// Attempts were made and **every one was refused**. This is the intended
    /// answer for merge keys, aliases and explicit keys: the property is that the
    /// refusal is typed and total.
    RefusedOnly,
    /// Attempts were made and at least one **applied**, with every property in
    /// this file's header checked on it.
    Applied,
}

impl Coverage {
    /// Classifies a measured cell.
    fn of(attempts: usize, applied: usize) -> Coverage {
        match (attempts, applied) {
            (0, _) => Coverage::Absent,
            (_, 0) => Coverage::RefusedOnly,
            _ => Coverage::Applied,
        }
    }

    /// The single character this cell is printed as.
    fn mark(self) -> char {
        match self {
            Coverage::Absent => '.',
            Coverage::RefusedOnly => 'r',
            Coverage::Applied => 'A',
        }
    }
}

/// The measured crossing of every R9 axis with every operation, pinned.
///
/// **This table is the gate's coverage evidence.** Every `Absent` cell carries
/// the reason no fixture can fill it; every `RefusedOnly` cell is a construct the
/// hazard gate refuses or an operation the engine declines, stated rather than
/// allowed to look like a pass, and accounted for in [`REFUSAL_ONLY_CELLS`].
///
/// **Retabulated by Phase 0c-3b-2b's review round**, when the attribution became
/// operation-local ([`Scope`]). Four rows changed, every one of them from
/// `Applied` to `RefusedOnly`, and every one of them because the `Applied` was an
/// artefact of document co-occurrence: a merge key, an alias, an explicit key or
/// a duplicate key never *once* let an operation that reached it through. That is
/// the stronger statement, and the weaker one was what the review objected to.
const AXIS_COVERAGE: [(Axis, [Coverage; 4]); 12] = [
    (
        Axis::Crlf,
        [
            Coverage::Applied,
            Coverage::Applied,
            Coverage::Applied,
            Coverage::Applied,
        ],
    ),
    (
        Axis::Bom,
        [
            Coverage::Applied,
            Coverage::Applied,
            Coverage::Applied,
            Coverage::Applied,
        ],
    ),
    // **The one measured cost in this table, and it is D2p's.** Every file
    // without a final break either ends in the item a move would carry, or would
    // have to terminate a line that never was terminated, so both offered
    // destinations are refused by name. Phase 0c-3b-2a's review forced that
    // refusal in place of the rotation that used to pass; this cell is what it
    // costs, stated rather than papered over.
    (
        Axis::NoFinalNewline,
        [
            Coverage::Applied,
            Coverage::Applied,
            Coverage::Applied,
            Coverage::RefusedOnly,
        ],
    ),
    (
        Axis::TrailingSpaces,
        [
            Coverage::Applied,
            Coverage::Applied,
            Coverage::Applied,
            Coverage::Applied,
        ],
    ),
    (
        Axis::Comments,
        [
            Coverage::Applied,
            Coverage::Applied,
            Coverage::Applied,
            Coverage::Applied,
        ],
    ),
    (
        Axis::BlockScalarTerminalNewline,
        [
            Coverage::Applied,
            Coverage::Applied,
            Coverage::Applied,
            Coverage::Applied,
        ],
    ),
    // **The four constructs R9 names as refused, now measured as refused.** Every
    // attempt whose target is the flagged construct, an ancestor of it or a
    // descendant of it was refused, in all four columns and in every fixture that
    // carries one. Before the attribution became operation-local these rows read
    // `Applied` in the scalar-edit column, which meant only that *some other
    // scalar in the same file* was editable — R12's "refused by scope, not by
    // file", which is a true statement about a different question.
    //
    // R12's statement has not been dropped, it has moved to where it can be made:
    // `explicit-key-mappings.yml`'s `global_vars:` sibling still applies 10 scalar
    // edits, 6 insertions and 3 removals, and those show up in this table under
    // the axes that sibling actually carries.
    (
        Axis::DuplicateKeys,
        [
            Coverage::RefusedOnly,
            Coverage::RefusedOnly,
            Coverage::RefusedOnly,
            Coverage::RefusedOnly,
        ],
    ),
    (
        Axis::NestedSequenceMappings,
        [
            Coverage::Applied,
            Coverage::Applied,
            Coverage::Applied,
            Coverage::Applied,
        ],
    ),
    (
        Axis::MergeKeys,
        [
            Coverage::RefusedOnly,
            Coverage::RefusedOnly,
            Coverage::RefusedOnly,
            Coverage::RefusedOnly,
        ],
    ),
    (
        Axis::Aliases,
        [
            Coverage::RefusedOnly,
            Coverage::RefusedOnly,
            Coverage::RefusedOnly,
            Coverage::RefusedOnly,
        ],
    ),
    (
        Axis::ExplicitKeys,
        [
            Coverage::RefusedOnly,
            Coverage::RefusedOnly,
            Coverage::RefusedOnly,
            Coverage::RefusedOnly,
        ],
    ),
    // The second **capability gap** in the table, beside `no-final-newline` ×
    // move: a zero-width scalar has no bytes to rewrite, so a scalar edit on one
    // is `EditError::EmptyTarget` every time. The other three operations reach an
    // empty value through the construct that holds it and apply.
    (
        Axis::EmptyValues,
        [
            Coverage::RefusedOnly,
            Coverage::Applied,
            Coverage::Applied,
            Coverage::Applied,
        ],
    ),
];

/// One account of one refusal-only cell: axis, operation, and why.
///
/// **The Phase 0c-3b-2b review's arithmetic finding.** The notes said "five",
/// counting grouped rows of a prose table; the review counted the cells of the
/// matrix and got eight. A count nobody derives from the measurement drifts from
/// it, so the cells are enumerated here, the enumeration is asserted against the
/// measurement, and its length is the count.
type RefusalAccount = (Axis, Operation, &'static str);

/// Every refusal-only cell of [`AXIS_COVERAGE`], with the reason for each.
///
/// Two kinds, and telling them apart is the point of the list:
///
/// - a **hazard refusal**, which is the intended answer. The construct is one the
///   gate refuses, and the cell says so rather than letting a safe sibling
///   elsewhere in the file make the row look green;
/// - a **capability gap**, which is the engine declining an operation it cannot
///   perform safely. Those are named as gaps, because calling them refusals would
///   flatter the result.
const REFUSAL_ONLY_CELLS: [RefusalAccount; 18] = [
    (
        Axis::NoFinalNewline,
        Operation::ItemMove,
        "capability gap (D2p): every file without a final break either ends in the item a move \
         would carry, or would have to terminate a line that never was terminated",
    ),
    (
        Axis::DuplicateKeys,
        Operation::ScalarEdit,
        "hazard refusal: DuplicateMappingKey",
    ),
    (
        Axis::DuplicateKeys,
        Operation::FieldInsert,
        "hazard refusal: DuplicateMappingKey",
    ),
    (
        Axis::DuplicateKeys,
        Operation::FieldRemoval,
        "hazard refusal: DuplicateMappingKey",
    ),
    (
        Axis::DuplicateKeys,
        Operation::ItemMove,
        "hazard refusal: DuplicateMappingKey",
    ),
    (
        Axis::MergeKeys,
        Operation::ScalarEdit,
        "hazard refusal: MergeKey",
    ),
    (
        Axis::MergeKeys,
        Operation::FieldInsert,
        "hazard refusal: MergeKey",
    ),
    (
        Axis::MergeKeys,
        Operation::FieldRemoval,
        "hazard refusal: MergeKey",
    ),
    (
        Axis::MergeKeys,
        Operation::ItemMove,
        "hazard refusal: MergeKey",
    ),
    (
        Axis::Aliases,
        Operation::ScalarEdit,
        "hazard refusal: AnchorDefinition or AliasReference",
    ),
    (
        Axis::Aliases,
        Operation::FieldInsert,
        "hazard refusal: AnchorDefinition or AliasReference",
    ),
    (
        Axis::Aliases,
        Operation::FieldRemoval,
        "hazard refusal: AnchorDefinition or AliasReference",
    ),
    (
        Axis::Aliases,
        Operation::ItemMove,
        "hazard refusal: AnchorDefinition or AliasReference",
    ),
    (
        Axis::ExplicitKeys,
        Operation::ScalarEdit,
        "hazard refusal: ExplicitKeyMapping",
    ),
    (
        Axis::ExplicitKeys,
        Operation::FieldInsert,
        "hazard refusal: ExplicitKeyMapping",
    ),
    (
        Axis::ExplicitKeys,
        Operation::FieldRemoval,
        "hazard refusal: ExplicitKeyMapping",
    ),
    (
        Axis::ExplicitKeys,
        Operation::ItemMove,
        "hazard refusal: ExplicitKeyMapping",
    ),
    (
        Axis::EmptyValues,
        Operation::ScalarEdit,
        "capability gap: a zero-width scalar has no bytes to rewrite (EditError::EmptyTarget)",
    ),
];

// ---------------------------------------------------------------------------
// Tallies
// ---------------------------------------------------------------------------

/// One file's outcome: applied and refused, per operation.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
struct Tally {
    /// Attempts that applied and satisfied every property, per operation.
    applied: [usize; 4],
    /// Attempts the engine refused with a typed error, per operation.
    refused: [usize; 4],
}

impl Tally {
    /// Every attempt this tally accounts for.
    fn total(&self) -> usize {
        self.applied.iter().chain(self.refused.iter()).sum()
    }

    /// Folds another file's tally into this one.
    fn add(&mut self, other: &Tally) {
        for slot in 0..OPERATIONS.len() {
            self.applied[slot] += other.applied[slot];
            self.refused[slot] += other.refused[slot];
        }
    }
} // End of impl Tally

/// One fixture's pinned row: its file name, then applied and refused per
/// operation in [`OPERATIONS`] order.
type OutcomeRow = (&'static str, [usize; 4], [usize; 4]);

/// Every synthetic fixture's complete gate outcome, pinned exactly.
///
/// Per fixture *and* per operation, for the reason the Phase 0c-2b review's
/// finding 4 gave: a corpus-wide total cannot tell two fixtures that exchanged
/// eligibility from two that did not. The list is asserted to cover the corpus
/// exactly, so a new fixture must be given a row rather than disappearing into a
/// sum, and the rows are asserted to add up to the printed totals.
const SYNTHETIC_OUTCOMES: [OutcomeRow; 33] = [
    // Every mapping, sequence and most scalars refused: an anchor, an alias, a
    // tag or a merge key anywhere inside disqualifies the node it sits on, every
    // ancestor and every descendant. **Ten scalar edits still apply**, which is
    // R12's "refused by scope, not by file" measured a third time.
    (
        "anchors-aliases-tags-merge.yml",
        [10, 0, 0, 0],
        [24, 20, 26, 2],
    ),
    ("blank-lines.yml", [18, 10, 5, 2], [0, 0, 5, 0]),
    ("block-scalar-header-tails.yml", [12, 8, 3, 2], [0, 0, 4, 0]),
    (
        "block-scalar-leading-blank-lines.yml",
        [30, 12, 9, 2],
        [0, 0, 7, 0],
    ),
    // **No move applies here at all.** The file ends in a block scalar with
    // terminal spaces and no final break, so both offered destinations are
    // refused by name — `MoveWouldTerminateTheFinalLine` and
    // `MoveWouldInventALineEnding`. That is the measured cost of D2p refusing
    // rather than rotating a line ending, and it is pinned, not "fixed".
    (
        "block-scalar-terminal-spaces.yml",
        [10, 6, 3, 0],
        [0, 0, 3, 2],
    ),
    ("block-scalars.yml", [66, 24, 19, 2], [0, 0, 15, 0]),
    ("bom-utf8.yml", [8, 6, 2, 2], [0, 0, 3, 0]),
    ("comments-everywhere.yml", [14, 8, 4, 2], [0, 0, 4, 0]),
    ("config-profile.yml", [32, 2, 13, 0], [0, 0, 0, 2]),
    ("crlf-line-endings.yml", [12, 8, 3, 2], [0, 0, 4, 0]),
    // Four scalars unreachable by path (`AddressError::AmbiguousKey`) are
    // counted separately: a duplicate makes a path **meaningless** rather than a
    // node unsafe, so it is refused at the resolver and not at the gate (D2j).
    ("duplicate-keys.yml", [16, 10, 6, 2], [4, 6, 8, 2]),
    (
        "empty-entries-and-extents.yml",
        [20, 12, 11, 4],
        [10, 0, 5, 0],
    ),
    // **Added by this phase.** The gate sweep found that
    // `HazardKind::ExplicitKeyMapping` — one of the six constructs R9 names by
    // name — had no corpus fixture at all and was reached only by a hand-written
    // unit test in `tests/trivia_scanner.rs`. R20's standing rule is that a
    // hazard gets a fixture; its `matches:` subtree is refused and its
    // `global_vars:` sibling is not.
    ("explicit-key-mappings.yml", [10, 6, 3, 0], [2, 4, 6, 2]),
    (
        "file-comments-and-mixed-endings.yml",
        [18, 10, 7, 0],
        [0, 0, 4, 2],
    ),
    ("flow-collections.yml", [40, 8, 8, 0], [6, 8, 12, 10]),
    ("folded-more-indented.yml", [24, 10, 7, 2], [0, 0, 6, 0]),
    ("form-layout-and-choice.yml", [64, 38, 30, 8], [0, 0, 12, 0]),
    ("html-and-markdown.yml", [22, 12, 6, 2], [0, 0, 6, 0]),
    ("imports-and-global-vars.yml", [52, 20, 19, 8], [0, 0, 8, 0]),
    ("move-a-match.yml", [16, 10, 6, 2], [0, 0, 4, 0]),
    ("move-block-scalar-seams.yml", [24, 14, 6, 2], [0, 0, 7, 0]),
    (
        "move-kept-comment-joins-a-block.yml",
        [20, 10, 6, 2],
        [0, 0, 5, 0],
    ),
    ("move-run-joins.yml", [20, 12, 9, 1], [0, 0, 4, 1]),
    // A multi-document stream raises the hazard on every **document** node, so
    // it really is total — the one file where "refused by scope" and "refused by
    // file" coincide (`PROGRESS.md`, R12).
    ("multi-document.yml", [0, 0, 0, 0], [12, 12, 9, 0]),
    ("no-trailing-newline.yml", [4, 4, 1, 0], [0, 0, 2, 0]),
    ("non-ascii.yml", [30, 18, 9, 2], [0, 0, 9, 0]),
    ("plain-scalar-hazards.yml", [148, 76, 37, 2], [0, 0, 38, 0]),
    (
        "run-based-removal-boundaries.yml",
        [16, 10, 8, 2],
        [0, 0, 3, 0],
    ),
    (
        "run-based-removal-envelope.yml",
        [16, 10, 7, 2],
        [0, 0, 4, 0],
    ),
    ("scalar-styles.yml", [44, 24, 11, 2], [0, 0, 12, 0]),
    // One addressable scalar, one mapping, and no sequence at all. Its four
    // refusals are the document with **no line break to copy**: a multi-line
    // value and an insertion both need one, and D2p refuses rather than
    // inventing it.
    ("single-line-no-line-ending.yml", [1, 0, 0, 0], [1, 2, 1, 0]),
    ("unicode-offsets.yml", [10, 2, 2, 0], [0, 0, 0, 2]),
    ("variable-chain.yml", [76, 34, 34, 8], [0, 0, 12, 0]),
];

/// Everything the sweep accumulates across a whole corpus.
#[derive(Debug, Default)]
struct CorpusTotals {
    /// Attempts per (axis, operation).
    attempts: [[usize; 4]; 12],
    /// Applications per (axis, operation).
    applied: [[usize; 4]; 12],
    /// How many files **carry** each axis at all.
    ///
    /// Kept beside the matrix so the two questions stay apart: "no file has this
    /// construct" is a corpus fact and "a file has it and no operation reached
    /// it" is a coverage hole. Before the attribution became operation-local the
    /// matrix could not tell them apart.
    carried: [usize; 12],
    /// Per hazard family: attempts it blocked, and how many of those applied.
    ///
    /// The second number is the one that matters, and it is pinned at zero: a
    /// construct the gate refuses must refuse **totally**.
    hazards: BTreeMap<&'static str, (usize, usize)>,
    /// Attempts refused by family name, for the printed breakdown.
    families: BTreeMap<&'static str, usize>,
    /// Scalars no path can name because their key is duplicated.
    ///
    /// Counted rather than skipped: a construct that silently contributes zero
    /// attempts is exactly the hole this file exists to make visible.
    ambiguous_key_targets: usize,
    /// How many applied edits had at least one block scalar to conserve.
    block_scalar_conservations: usize,
}

impl CorpusTotals {
    /// Records one attempt against every axis the document carries.
    fn record(&mut self, axes: &[Axis], operation: Operation, applied: bool) {
        for axis in axes {
            self.attempts[axis.slot()][operation.slot()] += 1;
            if applied {
                self.applied[axis.slot()][operation.slot()] += 1;
            }
        }
    }

    /// Records one refusal under its family, and under its hazard when it has one.
    fn refuse(&mut self, family: &'static str, hazard: Option<HazardKind>) {
        *self.families.entry(family).or_insert(0) += 1;
        if let Some(kind) = hazard {
            self.hazards.entry(hazard_name(kind)).or_insert((0, 0)).0 += 1;
        }
    }

    /// Records one **application** on a node a hazard family blocked, which must
    /// never happen and is pinned at zero rather than left unstated.
    fn hazard_applied(&mut self, kind: HazardKind) {
        self.hazards.entry(hazard_name(kind)).or_insert((0, 0)).1 += 1;
    }

    /// The coverage matrix these totals imply.
    fn coverage(&self) -> [[Coverage; 4]; 12] {
        let mut matrix = [[Coverage::Absent; 4]; 12];
        for (axis, row) in matrix.iter_mut().enumerate() {
            for (operation, cell) in row.iter_mut().enumerate() {
                *cell = Coverage::of(
                    self.attempts[axis][operation],
                    self.applied[axis][operation],
                );
            }
        } // End of the loop that classifies every cell of the matrix
        matrix
    }
} // End of impl CorpusTotals

/// The stable name of a hazard family, used as a map key and in printed output.
fn hazard_name(kind: HazardKind) -> &'static str {
    match kind {
        HazardKind::CommentInFlowCollection => "CommentInFlowCollection",
        HazardKind::ExplicitKeyMapping => "ExplicitKeyMapping",
        HazardKind::TruncatedBlockScalarHeader => "TruncatedBlockScalarHeader",
        HazardKind::UnclassifiedTrivia => "UnclassifiedTrivia",
        HazardKind::AnchorDefinition => "AnchorDefinition",
        HazardKind::AliasReference => "AliasReference",
        HazardKind::MergeKey => "MergeKey",
        HazardKind::DuplicateMappingKey => "DuplicateMappingKey",
        HazardKind::ExplicitTag => "ExplicitTag",
        HazardKind::MultiDocumentStream => "MultiDocumentStream",
    }
} // End of function hazard_name()

// ---------------------------------------------------------------------------
// Deriving the axes from the document
// ---------------------------------------------------------------------------

/// The axes one document carries, with the node that carries each structural one.
///
/// Nothing is hard-coded per fixture. The same derivation classifies the real
/// corpus, where hard-coding anything is forbidden, and it is what makes the
/// coverage matrix a measurement rather than a restatement of the fixture list.
#[derive(Debug, Default)]
struct DocumentAxes {
    /// Presentational axes, which every attempt on this document meets.
    presentational: Vec<Axis>,
    /// Structural axes, each with a node that carries it. One axis may appear
    /// more than once: a document with three anchors has three pieces of
    /// evidence for [`Axis::Aliases`], and an operation meets the axis when it
    /// meets **any** of them.
    ///
    /// `None` for the node means the construct has no node to scope it to, which
    /// makes it document-wide — the same reading `TriviaIndex` gives a hazard
    /// with no node.
    structural: Vec<(Axis, Option<NodeId>)>,
}

impl DocumentAxes {
    /// Records that this document carries `axis`, filed by its [`Scope`].
    ///
    /// The single place the split is applied, so moving an axis from one half to
    /// the other is one edit and it changes the measurement rather than only the
    /// prose.
    fn carries(&mut self, axis: Axis, carrier: Option<NodeId>) {
        match axis.scope() {
            Scope::Presentational => {
                if !self.presentational.contains(&axis) {
                    self.presentational.push(axis);
                }
            }
            Scope::Structural => self.structural.push((axis, carrier)),
        }
    } // End of function carries()

    /// Every axis this document carries at all, in [`AXES`] order.
    fn all(&self) -> Vec<Axis> {
        AXES.iter()
            .copied()
            .filter(|axis| {
                self.presentational.contains(axis)
                    || self.structural.iter().any(|(carried, _)| carried == axis)
            })
            .collect()
    } // End of function all()

    /// The axes an attempt on `targets` **met**, which is what the matrix counts.
    ///
    /// Presentational axes are met by every attempt, for the reason [`Scope`]
    /// gives. A structural axis is met when one of its carriers is a target, an
    /// ancestor of one or a descendant of one — the same "the hazard's scope
    /// reaches this node" relation `TriviaIndex::disqualifying_hazard` uses, and
    /// therefore the relation under which the refusal is the *answer* rather than
    /// an accident of which file the construct happened to share.
    fn met_by(&self, index: &SyntaxIndex, targets: &[NodeId]) -> Vec<Axis> {
        let mut met = self.presentational.clone();
        for (axis, carrier) in &self.structural {
            if met.contains(axis) {
                continue;
            }
            let reached = match carrier {
                None => true,
                Some(carrier) => targets
                    .iter()
                    .any(|target| related(index, *carrier, *target)),
            };
            if reached {
                met.push(*axis);
            }
        } // End of the loop over the structural axes this document carries
        met
    } // End of function met_by()
} // End of impl DocumentAxes

/// Whether `left` is `right`, contains it, or is contained by it.
fn related(index: &SyntaxIndex, left: NodeId, right: NodeId) -> bool {
    left == right || is_ancestor(index, left, right) || is_ancestor(index, right, left)
}

/// Whether `ancestor` is a strict ancestor of `node`.
fn is_ancestor(index: &SyntaxIndex, ancestor: NodeId, node: NodeId) -> bool {
    let mut current = index.node(node).and_then(|node| node.parent);
    while let Some(id) = current {
        if id == ancestor {
            return true;
        }
        current = index.node(id).and_then(|node| node.parent);
    }
    false
} // End of function is_ancestor()

/// Reads every R9 axis this document carries off the source and the index.
fn axes_of(source: &str, index: &SyntaxIndex, trivia: &TriviaIndex) -> DocumentAxes {
    let mut axes = DocumentAxes::default();
    if source.contains("\r\n") {
        axes.carries(Axis::Crlf, None);
    }
    if source.starts_with('\u{feff}') {
        axes.carries(Axis::Bom, None);
    }
    if !source.is_empty() && !source.ends_with(['\n', '\r']) {
        axes.carries(Axis::NoFinalNewline, None);
    }
    if physical_lines(source)
        .iter()
        .any(|(_, content, _)| content.ends_with([' ', '\t']))
    {
        axes.carries(Axis::TrailingSpaces, None);
    }
    if !trivia.comments().is_empty() {
        axes.carries(Axis::Comments, None);
    }
    if index.nodes().iter().any(|node| {
        node.scalar.as_ref().is_some_and(|scalar| {
            scalar.presentation.style.is_block()
                && (scalar.presentation.chomping != Chomping::Clip
                    || following_breaks(source, scalar.presentation.content_span.end) >= 2)
        })
    }) {
        axes.carries(Axis::BlockScalarTerminalNewline, None);
    }

    for node in index.nodes() {
        if node.role == NodeRole::SequenceItem && has_a_nested_collection(index, node.id) {
            axes.carries(Axis::NestedSequenceMappings, Some(node.id));
        }
    } // End of the loop that finds the nested sequence mappings
    for leaf in index.zero_width_leaves() {
        axes.carries(Axis::EmptyValues, Some(leaf.id));
    }
    for hazard in trivia.hazards() {
        let axis = match hazard.kind {
            HazardKind::DuplicateMappingKey => Axis::DuplicateKeys,
            HazardKind::MergeKey => Axis::MergeKeys,
            HazardKind::AliasReference | HazardKind::AnchorDefinition => Axis::Aliases,
            HazardKind::ExplicitKeyMapping => Axis::ExplicitKeys,
            _ => continue,
        };
        axes.carries(axis, hazard.node);
    } // End of the loop that turns hazards into structural axes
    axes
} // End of function axes_of()

/// Returns `true` when `node` is a mapping holding a collection of its own.
///
/// The espanso `matches: - trigger: … vars: […]` shape: a sequence item that is a
/// mapping whose values are not all scalars. Restricting it to that shape is what
/// makes the axis mean "nested", since almost every sequence item is a mapping.
fn has_a_nested_collection(index: &SyntaxIndex, node: NodeId) -> bool {
    let Some(here) = index.node(node) else {
        return false;
    };
    if here.kind != NodeKind::Mapping {
        return false;
    }
    here.children.iter().any(|child| {
        index
            .node(*child)
            .is_some_and(|child| matches!(child.kind, NodeKind::Mapping | NodeKind::Sequence))
    })
} // End of function has_a_nested_collection()

// ---------------------------------------------------------------------------
// Facts read off the document, never asked of the engine
// ---------------------------------------------------------------------------

/// Re-derives the hazard gate's answer from the hazard list and the tree.
///
/// Deliberately not a call to `TriviaIndex::disqualifying_hazard`: the point is to
/// know that the refusal the engine reported is one the document actually
/// justifies. A hazard disqualifies a node when it sits on that node, on an
/// ancestor, on a descendant, or on no node at all.
fn hazard_that_blocks<'trivia>(
    index: &SyntaxIndex,
    trivia: &'trivia TriviaIndex,
    node: NodeId,
) -> Option<&'trivia Hazard> {
    let mut ancestors = vec![node];
    let mut current = index.node(node).and_then(|here| here.parent);
    while let Some(id) = current {
        ancestors.push(id);
        current = index.node(id).and_then(|here| here.parent);
    }
    let mut descendants = vec![node];
    let mut pending = vec![node];
    while let Some(id) = pending.pop() {
        if let Some(here) = index.node(id) {
            for child in &here.children {
                descendants.push(*child);
                pending.push(*child);
            }
        }
    } // End of the walk that collects the node's descendants
    trivia.hazards().iter().find(|hazard| match hazard.node {
        None => true,
        Some(flagged) => ancestors.contains(&flagged) || descendants.contains(&flagged),
    })
} // End of function hazard_that_blocks()

/// Returns `true` when `node` is, or sits inside, a bracket-delimited collection.
fn inside_flow(index: &SyntaxIndex, node: NodeId) -> bool {
    let mut current = index.node(node);
    while let Some(here) = current {
        if here.collection_style == Some(CollectionStyle::Flow) {
            return true;
        }
        current = here.parent.and_then(|parent| index.node(parent));
    }
    false
} // End of function inside_flow()

/// The offset at which `position`'s physical line begins.
fn line_start(source: &str, position: usize, body_offset: usize) -> usize {
    source[..position]
        .rfind(['\n', '\r'])
        .map_or(body_offset, |at| at + 1)
        .max(body_offset)
}

/// The offset just past the break that terminates `position`'s physical line.
fn line_end(source: &str, position: usize) -> usize {
    match source[position..].find(['\n', '\r']) {
        None => source.len(),
        Some(offset) => {
            let at = position + offset;
            at + if source[at..].starts_with("\r\n") {
                2
            } else {
                1
            }
        }
    }
} // End of function line_end()

/// How many line breaks the run at `source[at..]` holds, `\r\n` counting once.
fn following_breaks(source: &str, at: usize) -> usize {
    let mut rest = &source[at..];
    let mut count = 0;
    loop {
        if let Some(tail) = rest.strip_prefix("\r\n") {
            rest = tail;
        } else if let Some(tail) = rest.strip_prefix('\n').or_else(|| rest.strip_prefix('\r')) {
            rest = tail;
        } else {
            return count;
        }
        count += 1;
    } // End of the loop over the leading line-break run
}

/// One past the last byte any node of `root`'s subtree covers.
fn subtree_end(index: &SyntaxIndex, root: NodeId) -> usize {
    let mut end = index.node(root).map_or(0, |node| node.span.end);
    let mut pending = vec![root];
    while let Some(id) = pending.pop() {
        if let Some(node) = index.node(id) {
            end = end.max(node.span.end);
            pending.extend(node.children.iter().copied());
        }
    }
    end
} // End of function subtree_end()

/// The whole physical lines a named construct occupies, derived **textually**.
///
/// From the start of the line its first byte sits on, up over every comment-only
/// line directly above it, down to just past the break that ends its last line.
/// Read off the node spans and the source text, so it owes nothing to the
/// `TriviaIndex::subtree_extent` the planner used — which is what makes "the span
/// matches the requested structural path" an oracle rather than a restatement.
///
/// A `#` **inside a frontier leaf** is a block scalar's own content and not a
/// comment, and only the syntax index can tell the two apart, so the upward walk
/// asks it rather than the text.
fn owned_lines(source: &str, index: &SyntaxIndex, first: usize, last: usize) -> ByteSpan {
    let body_offset = index.preamble().body_offset;
    let mut start = line_start(source, first, body_offset);
    let mut end = last;
    if !source[..end].ends_with(['\n', '\r']) {
        end = line_end(source, end);
    }
    while start > body_offset {
        let above = line_start(source, start - 1, body_offset);
        let text = source[above..start].trim_start_matches([' ', '\t']);
        let opener = above + (source[above..start].len() - text.len());
        let inside_a_leaf = index.nodes().iter().any(|node| {
            node.is_frontier_leaf() && node.span.start <= opener && opener < node.span.end
        });
        if !text.starts_with('#') || inside_a_leaf {
            break;
        }
        start = above;
    } // End of the walk up over the construct's own leading comment block
    ByteSpan::new(start, end)
} // End of function owned_lines()

/// Splits `text` into `(offset, content, terminator)` for every physical line.
fn physical_lines(text: &str) -> Vec<(usize, &str, &str)> {
    let mut lines = Vec::new();
    let mut at = 0usize;
    while at < text.len() {
        let rest = &text[at..];
        match rest.find(['\n', '\r']) {
            None => {
                lines.push((at, rest, ""));
                break;
            }
            Some(offset) => {
                let break_at = at + offset;
                let ending = if text[break_at..].starts_with("\r\n") {
                    "\r\n"
                } else {
                    &text[break_at..break_at + 1]
                };
                lines.push((at, &text[at..break_at], ending));
                at = break_at + ending.len();
            }
        }
    } // End of the loop that splits the text into physical lines
    lines
} // End of function physical_lines()

/// Every comment in `text`, found by an independent scan of the source.
///
/// Written without [`TriviaIndex`] on purpose: a comparison of the trivia layer
/// against itself would confirm nothing. A `#` inside a quoted or block scalar is
/// not a comment, so the scan tracks quoting and skips the interior of every
/// frontier leaf it is given.
fn comment_texts<'text>(text: &'text str, leaves: &[ByteSpan]) -> Vec<&'text str> {
    let mut found = Vec::new();
    for (at, content, _) in physical_lines(text) {
        let mut quote: Option<char> = None;
        for (offset, character) in content.char_indices() {
            let absolute = at + offset;
            if leaves
                .iter()
                .any(|leaf| leaf.start <= absolute && absolute < leaf.end)
            {
                continue;
            }
            match (quote, character) {
                (None, '\'') => quote = Some('\''),
                (None, '"') => quote = Some('"'),
                (Some('\''), '\'') => quote = None,
                (Some('"'), '"') => quote = None,
                (None, '#') => {
                    found.push(content[offset..].trim_end());
                    break;
                }
                _ => {}
            }
        } // End of the scan across one physical line
    } // End of the loop over the text's physical lines
    found
} // End of function comment_texts()

/// The spans of every frontier leaf, used to keep [`comment_texts`] out of them.
fn leaf_spans(index: &SyntaxIndex) -> Vec<ByteSpan> {
    index
        .nodes()
        .iter()
        .filter(|node| node.is_frontier_leaf())
        .map(|node| node.span)
        .collect()
}

/// The multiset of YAML 1.1-ambiguous **plain** scalars a document holds.
///
/// The test-side derivation of R16's differential property. It reads the parsed
/// document rather than the edit, exactly as the production check does, and is
/// kept beside it because two derivations of one property is the discipline.
fn ambiguous_plain_scalars(index: &SyntaxIndex) -> BTreeMap<String, usize> {
    let mut found = BTreeMap::new();
    for node in index.nodes() {
        let Some(scalar) = node.scalar.as_ref() else {
            continue;
        };
        if scalar.presentation.style != ScalarStyle::Plain {
            continue;
        }
        if plain_scalar_is_ambiguous(&scalar.value) {
            *found.entry(scalar.value.clone()).or_insert(0) += 1;
        }
    }
    found
} // End of function ambiguous_plain_scalars()

/// The multiset of decoded values of every **block** scalar in a document.
fn block_scalar_values(source: &str, index: &SyntaxIndex) -> Vec<String> {
    let mut values: Vec<String> = index
        .nodes()
        .iter()
        .filter_map(|node| node.scalar.as_ref())
        .filter(|scalar| scalar.presentation.style.is_block())
        .filter_map(|scalar| decode(source, &scalar.presentation).ok())
        .collect();
    values.sort();
    values
}

/// The distinct line terminators a text uses.
fn line_endings_of(text: &str) -> (bool, bool) {
    let crlf = text.contains("\r\n");
    let bare_lf = text.matches('\n').count() > text.matches("\r\n").count();
    (crlf, bare_lf)
}

// ---------------------------------------------------------------------------
// The properties every applied edit must satisfy
// ---------------------------------------------------------------------------

/// Properties 1, 5, 6, 7 and 8 of the header, checked on every applied edit
/// whatever the operation was.
///
/// Written once and called from all four branches, which is the point of the
/// gate: an operation that satisfied its own sweep's properties but not these
/// would show up here and nowhere else.
fn check_universal(
    label: &str,
    source: &str,
    patched: &PatchedDocument,
    before: &SyntaxIndex,
    trivia: &TriviaIndex,
    after: &SyntaxIndex,
) {
    // 1. The candidate is the source with the replacements applied, and the
    //    replacements are ascending and disjoint. Every byte outside them is
    //    therefore identical by construction of the comparison.
    let mut rebuilt = String::with_capacity(patched.text().len());
    let mut cursor = 0usize;
    for replacement in patched.replacements() {
        assert!(
            replacement.span.start >= cursor,
            "{label}: replacements are not ascending and disjoint"
        );
        rebuilt.push_str(&source[cursor..replacement.span.start]);
        rebuilt.push_str(&replacement.text);
        cursor = replacement.span.end;
    } // End of the loop that rebuilds the candidate from the replacement list
    rebuilt.push_str(&source[cursor..]);
    assert!(
        rebuilt == patched.text(),
        "{label}: the candidate is not the source with the replacements applied"
    );

    // 5. Every comment the file owns is still there, compared by text over a scan
    //    written independently of `TriviaIndex`. The *source's* trivia is passed
    //    in rather than rescanned: it is a fact about the unchanged document, and
    //    scanning it once per file instead of once per attempt is most of what
    //    made sweeping every real-corpus target affordable (R19).
    let owned: Vec<&str> = trivia
        .file_comments()
        .filter_map(|comment| comment.span.slice(source))
        .collect();
    let survivors = comment_texts(patched.text(), &leaf_spans(after));
    let mut remaining = survivors.clone();
    for comment in &owned {
        match remaining.iter().position(|seen| seen == comment) {
            Some(at) => {
                remaining.swap_remove(at);
            }
            None => panic!(
                "{label}: a {}-byte comment the file owns is not in the candidate",
                comment.len()
            ),
        }
    } // End of the loop that claims one surviving comment per file-owned one

    // 6. The candidate holds no line ending the source does not. Stated as
    //    containment so it is total: D2p forbids inventing a break, and says
    //    nothing about one that was legitimately deleted with its line.
    let (source_crlf, source_lf) = line_endings_of(source);
    let (candidate_crlf, candidate_lf) = line_endings_of(patched.text());
    assert!(
        source_crlf || !candidate_crlf,
        "{label}: the candidate gained a CRLF the source never held"
    );
    assert!(
        source_lf || !candidate_lf,
        "{label}: the candidate gained a bare LF the source never held"
    );

    // 7. R16, differentially: no ambiguous plain scalar the source did not
    //    already hold, counted rather than merely present.
    let budget = ambiguous_plain_scalars(before);
    for (text, count) in ambiguous_plain_scalars(after) {
        assert!(
            budget.get(&text).copied().unwrap_or(0) >= count,
            "{label}: the candidate holds {count} occurrences of a {}-byte \
             YAML 1.1-ambiguous plain scalar the source held fewer of",
            text.len()
        );
    } // End of the loop over the candidate's ambiguous plain scalars
} // End of function check_universal()

/// Property 3: every replacement lies inside the lines the named construct owns.
fn check_spans_inside(label: &str, replacements: &[Replacement], envelope: ByteSpan) {
    for replacement in replacements {
        assert!(
            envelope.contains(replacement.span),
            "{label}: replacement {}..{} reaches outside the construct's own lines {}..{}",
            replacement.span.start,
            replacement.span.end,
            envelope.start,
            envelope.end
        );
    }
} // End of function check_spans_inside()

/// Property 3 for a scalar edit, in its exact form: every replacement lies
/// wholly inside one of the spans that scalar **owns**.
///
/// Not the line hull the structural operations use, and not the
/// `header_span.start .. content_span.end` envelope either: the bytes between a
/// block scalar's header and its content are the header line's tail and its own
/// break (`PROGRESS.md`, D2c), and they belong to no scalar. Allowing them is
/// what once let a block-to-flow edit regenerate a CRLF header as LF, and an
/// acceptance test that allows it cannot see the defect.
fn check_scalar_spans(label: &str, replacements: &[Replacement], owned: &[ByteSpan]) {
    for replacement in replacements {
        assert!(
            owned.iter().any(|span| span.contains(replacement.span)),
            "{label}: replacement {}..{} is not wholly inside one span the scalar owns",
            replacement.span.start,
            replacement.span.end
        );
    }
} // End of function check_scalar_spans()

/// Property 8: no block scalar's decoded value changed.
///
/// Called only where the operation named none of them, which is where the
/// statement is exact: a relocation and an edit to a flow scalar must both leave
/// every `|` and `>` value — terminal newlines included — exactly as it was.
fn check_block_scalars_conserved(
    label: &str,
    source: &str,
    before: &SyntaxIndex,
    patched: &PatchedDocument,
    after: &SyntaxIndex,
    totals: &mut CorpusTotals,
) {
    let was = block_scalar_values(source, before);
    if was.is_empty() {
        return;
    }
    totals.block_scalar_conservations += 1;
    assert!(
        was == block_scalar_values(patched.text(), after),
        "{label}: a block scalar's decoded value changed although the edit named none"
    );
} // End of function check_block_scalars_conserved()

// ---------------------------------------------------------------------------
// Classifying a refusal
// ---------------------------------------------------------------------------

/// The family a typed refusal belongs to, and the hazard behind it when it has
/// one.
///
/// The three per-operation sweeps each re-derive **every** refusal reason from
/// the document, and that work is not repeated here. What this does re-derive is
/// the one R9 asks about: a `Refused` answer must be justified by a hazard the
/// document actually has, which is what makes the merge-key, alias and
/// explicit-key rows of [`AXIS_COVERAGE`] mean something. Everything else is
/// bucketed by name so a new refusal family cannot slip in as "some other error":
/// an unlisted variant panics.
fn classify(
    label: &str,
    error: &EditError,
    blocked: Option<HazardKind>,
) -> (&'static str, Option<HazardKind>) {
    match error {
        EditError::Refused { hazard, .. } => {
            let derived =
                blocked.unwrap_or_else(|| panic!("{label}: refused with no hazard to justify it"));
            assert_eq!(
                derived, *hazard,
                "{label}: refused for a hazard the document does not have"
            );
            ("Refused", Some(derived))
        }
        EditError::EmptyTarget { .. } => ("EmptyTarget", None),
        EditError::FlowCollection { .. } => ("FlowCollection", None),
        EditError::NotAMapping { .. } => ("NotAMapping", None),
        EditError::LastEntryOfMapping { .. } => ("LastEntryOfMapping", None),
        EditError::NoObservableLineEnding { .. } => ("NoObservableLineEnding", None),
        EditError::TrailingNewlinesNotRepresentable { .. } => ("TrailingNewlines", None),
        EditError::EntryDoesNotOwnItsLines { .. } => ("EntryDoesNotOwnItsLines", None),
        EditError::InconsistentEntryIndentation { .. } => ("InconsistentEntryIndentation", None),
        EditError::KeyAlreadyPresent { .. } => ("KeyAlreadyPresent", None),
        EditError::NoSuchSibling { .. } => ("NoSuchSibling", None),
        EditError::RemovalWouldExtendAKeptBlock { .. } => ("RemovalWouldExtendAKeptBlock", None),
        EditError::RemovalWouldDeleteAFileComment { .. } => {
            ("RemovalWouldDeleteAFileComment", None)
        }
        EditError::RemovalWouldExtendABlockScalar { .. } => {
            ("RemovalWouldExtendABlockScalar", None)
        }
        EditError::NotASequenceItem { .. } => ("NotASequenceItem", None),
        EditError::NoSuchDestinationItem { .. } => ("NoSuchDestinationItem", None),
        EditError::MoveChangesNothing { .. } => ("MoveChangesNothing", None),
        EditError::MoveWouldInventALineEnding { .. } => ("MoveWouldInventALineEnding", None),
        EditError::MoveWouldTerminateTheFinalLine { .. } => {
            ("MoveWouldTerminateTheFinalLine", None)
        }
        EditError::MoveWouldExtendAKeptBlock { .. } => ("MoveWouldExtendAKeptBlock", None),
        EditError::MoveWouldExtendABlockScalar { .. } => ("MoveWouldExtendABlockScalar", None),
        // A verification failure is a defect in the engine, never an expected
        // answer: `verify` rejected bytes the engine itself produced.
        other => panic!("{label}: unexpected outcome {other}"),
    }
} // End of function classify()

// ---------------------------------------------------------------------------
// The sweep
// ---------------------------------------------------------------------------

/// Crosses every operation with **every** eligible target of one document.
///
/// No thinning, in either corpus — see the note where `REAL_CORPUS_STRIDE` used
/// to be.
fn sweep(name: &str, source: &str, totals: &mut CorpusTotals) -> Tally {
    let index = SyntaxIndex::parse(source).expect("the caller checked this parses");
    let trivia = TriviaIndex::scan(source, &index);
    let axes = axes_of(source, &index, &trivia);
    for axis in axes.all() {
        totals.carried[axis.slot()] += 1;
    }
    let mut tally = Tally::default();

    sweep_scalar_edits(name, source, &index, &trivia, &axes, totals, &mut tally);
    sweep_fields(name, source, &index, &trivia, &axes, totals, &mut tally);
    sweep_moves(name, source, &index, &trivia, &axes, totals, &mut tally);
    tally
} // End of function sweep()

/// Records one attempt's outcome in both the file tally and the corpus totals.
///
/// `targets` are the nodes the operation actually named, which is what decides
/// the structural half of the crossing ([`DocumentAxes::met_by`]).
fn record(
    tally: &mut Tally,
    totals: &mut CorpusTotals,
    index: &SyntaxIndex,
    axes: &DocumentAxes,
    targets: &[NodeId],
    operation: Operation,
    applied: bool,
) {
    if applied {
        tally.applied[operation.slot()] += 1;
    } else {
        tally.refused[operation.slot()] += 1;
    }
    totals.record(&axes.met_by(index, targets), operation, applied);
} // End of function record()

/// The scalar-edit column of the cross.
#[allow(clippy::too_many_arguments)]
fn sweep_scalar_edits(
    name: &str,
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    axes: &DocumentAxes,
    totals: &mut CorpusTotals,
    tally: &mut Tally,
) {
    for node in index.nodes() {
        if node.kind != NodeKind::Scalar {
            continue;
        }
        let path = match path_to(index, node.id) {
            Ok(path) => path,
            Err(AddressError::AmbiguousKey { .. }) => {
                // A duplicated key makes a **path** meaningless rather than a
                // node unsafe (D2j). Counted here so the construct cannot
                // contribute zero attempts unnoticed.
                totals.ambiguous_key_targets += 1;
                continue;
            }
            Err(_) => continue,
        };
        let blocked = hazard_that_blocks(index, trivia, node.id).map(|hazard| hazard.kind);
        let owned = match node.scalar.as_ref() {
            Some(scalar) if scalar.presentation.style.is_block() => vec![
                scalar.presentation.header_span,
                scalar.presentation.content_span,
            ],
            _ => vec![node.span],
        };
        for (choice, value) in VALUES.iter().enumerate() {
            if choice % 3 != node.id.get() % 3 {
                continue;
            }
            let label = format!("{name} edit node {} value {choice}", node.id.get());
            match apply_scalar_edit(source, &path, value) {
                Ok(patched) => {
                    if let Some(kind) = blocked {
                        totals.hazard_applied(kind);
                        panic!("{label}: applied although a hazard disqualifies the node");
                    }
                    let after =
                        SyntaxIndex::parse(patched.text()).expect("the candidate must reparse");
                    check_universal(&label, source, &patched, index, trivia, &after);
                    check_scalar_spans(&label, patched.replacements(), &owned);
                    check_scalar_intent(&label, &path, value, &after, patched.text());
                    // Only where the edit names no block scalar at all: editing
                    // one changes its own value, and writing a multi-line value
                    // into a flow scalar legitimately *creates* one.
                    let names_a_block = node
                        .scalar
                        .as_ref()
                        .is_some_and(|scalar| scalar.style().is_block())
                        || value.contains('\n');
                    if !names_a_block {
                        check_block_scalars_conserved(
                            &label, source, index, &patched, &after, totals,
                        );
                    }
                    record(
                        tally,
                        totals,
                        index,
                        axes,
                        &[node.id],
                        Operation::ScalarEdit,
                        true,
                    );
                }
                Err(error) => {
                    let (family, hazard) = classify(&label, &error, blocked);
                    totals.refuse(family, hazard);
                    record(
                        tally,
                        totals,
                        index,
                        axes,
                        &[node.id],
                        Operation::ScalarEdit,
                        false,
                    );
                }
            }
        } // End of the loop over this scalar's replacement values
    } // End of the loop over every scalar of the document
} // End of function sweep_scalar_edits()

/// Property 4 for a scalar edit: the path decodes to the value asked for.
fn check_scalar_intent(
    label: &str,
    path: &DocumentPath,
    value: &str,
    after: &SyntaxIndex,
    candidate: &str,
) {
    let id = espansoconfig_core::patch::resolve(after, path)
        .unwrap_or_else(|error| panic!("{label}: the path is lost in the candidate: {error}"));
    let scalar = after
        .node(id)
        .and_then(|node| node.scalar.as_ref())
        .unwrap_or_else(|| panic!("{label}: the path no longer names a scalar"));
    assert!(
        scalar.value == value,
        "{label}: the candidate holds a {}-byte value where {} bytes were intended",
        scalar.value.len(),
        value.len()
    );
    let ours = decode(candidate, &scalar.presentation)
        .unwrap_or_else(|error| panic!("{label}: our decoder failed on the candidate: {error}"));
    assert!(
        ours == scalar.value,
        "{label}: our decoder and the substrate disagree about the candidate"
    );
} // End of function check_scalar_intent()

/// The insertion and removal columns of the cross.
#[allow(clippy::too_many_arguments)]
fn sweep_fields(
    name: &str,
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    axes: &DocumentAxes,
    totals: &mut CorpusTotals,
    tally: &mut Tally,
) {
    for mapping in index.nodes() {
        if mapping.kind != NodeKind::Mapping {
            continue;
        }
        let Ok(mapping_path) = path_to(index, mapping.id) else {
            continue;
        };
        let entries: Vec<(NodeId, NodeId)> = mapping
            .children
            .chunks(2)
            .filter_map(|pair| match (pair.first(), pair.get(1)) {
                (Some(&key), Some(&value)) => Some((key, value)),
                _ => None,
            })
            .collect();
        if entries.is_empty() {
            continue;
        }
        let blocked = hazard_that_blocks(index, trivia, mapping.id).map(|hazard| hazard.kind);
        let mapping_lines = owned_lines(
            source,
            index,
            mapping.span.start,
            subtree_end(index, mapping.id),
        );

        // 1. Insert, once per value: appended, and after the first sibling.
        let first_key = index
            .node(entries[0].0)
            .and_then(|node| node.scalar.as_ref())
            .map(|scalar| scalar.value.clone());
        for (choice, value) in INSERT_VALUES.iter().enumerate() {
            let label = format!("{name} insert into {} value {choice}", mapping.id.get());
            let outcome = if choice == 0 {
                insert_field(source, &mapping_path, INSERT_KEY, value)
            } else {
                match &first_key {
                    Some(sibling) => {
                        let edit: DocumentEdit = FieldInsert::after(
                            mapping_path.clone(),
                            sibling.clone(),
                            INSERT_KEY,
                            *value,
                        )
                        .into();
                        apply_edits(source, &[edit])
                    }
                    None => insert_field(source, &mapping_path, INSERT_KEY, value),
                }
            };
            match outcome {
                Ok(patched) => {
                    if let Some(kind) = blocked {
                        totals.hazard_applied(kind);
                        panic!("{label}: applied although a hazard disqualifies the mapping");
                    }
                    let after =
                        SyntaxIndex::parse(patched.text()).expect("the candidate must reparse");
                    check_universal(&label, source, &patched, index, trivia, &after);
                    check_insertion_is_a_line_boundary(
                        &label,
                        source,
                        index,
                        patched.replacements(),
                    );
                    check_insert_intent(&label, &mapping_path, value, &after);
                    if !value.contains('\n') {
                        check_block_scalars_conserved(
                            &label, source, index, &patched, &after, totals,
                        );
                    }
                    record(
                        tally,
                        totals,
                        index,
                        axes,
                        &[mapping.id],
                        Operation::FieldInsert,
                        true,
                    );
                }
                Err(error) => {
                    let (family, hazard) = classify(&label, &error, blocked);
                    totals.refuse(family, hazard);
                    record(
                        tally,
                        totals,
                        index,
                        axes,
                        &[mapping.id],
                        Operation::FieldInsert,
                        false,
                    );
                }
            }
        } // End of the loop over the insertion values

        // 2. Remove **every** entry of the mapping, one attempt each.
        //
        //    Not just the first: an entry that shares its line with the `-` of a
        //    compact sequence item is refused (`EntryDoesNotOwnItsLines`), and
        //    the first entry of an espanso match is exactly that shape, so
        //    sampling only the first would have left half the corpus's axes with
        //    a removal column that never applied anything.
        for (key, value) in &entries {
            let Ok(entry_path) = path_to(index, *value) else {
                continue;
            };
            let key_span = index.node(*key).expect("a key").span;
            let entry_lines = owned_lines(
                source,
                index,
                key_span.start,
                subtree_end(index, *value).max(key_span.end),
            );
            let label = format!("{name} remove entry {} of {}", key.get(), mapping.id.get());
            match remove_field(source, &entry_path) {
                Ok(patched) => {
                    if let Some(kind) = blocked {
                        totals.hazard_applied(kind);
                        panic!("{label}: applied although a hazard disqualifies the mapping");
                    }
                    let after =
                        SyntaxIndex::parse(patched.text()).expect("the candidate must reparse");
                    check_universal(&label, source, &patched, index, trivia, &after);
                    check_spans_inside(&label, patched.replacements(), entry_lines);
                    check_remove_intent(&label, &mapping_path, *key, index, &after);
                    record(
                        tally,
                        totals,
                        index,
                        axes,
                        &[*key, *value],
                        Operation::FieldRemoval,
                        true,
                    );
                }
                Err(error) => {
                    let (family, hazard) = classify(&label, &error, blocked);
                    totals.refuse(family, hazard);
                    record(
                        tally,
                        totals,
                        index,
                        axes,
                        &[*key, *value],
                        Operation::FieldRemoval,
                        false,
                    );
                }
            }
        } // End of the loop over the mapping's entries

        // `mapping_lines` bounds the insertion point, whose own property checks
        // it above; naming it here keeps the derivation beside the mapping it
        // belongs to rather than recomputing it inside the loop.
        let _ = mapping_lines;
    } // End of the loop over every mapping of the document
} // End of function sweep_fields()

/// Property 3 for an insertion: it writes at a line boundary, inside no node.
fn check_insertion_is_a_line_boundary(
    label: &str,
    source: &str,
    index: &SyntaxIndex,
    replacements: &[Replacement],
) {
    let body_offset = index.preamble().body_offset;
    assert_eq!(replacements.len(), 1, "{label}: an insertion writes once");
    let span = replacements[0].span;
    assert!(span.is_empty(), "{label}: an insertion replaces no bytes");
    assert!(
        span.start == source.len() || line_start(source, span.start, body_offset) == span.start,
        "{label}: the insertion point does not begin a line"
    );
    assert!(
        span.start >= body_offset,
        "{label}: the insertion point reaches into the BOM"
    );
    for node in index.nodes() {
        assert!(
            !(node.is_frontier_leaf()
                && node.span.start < span.start
                && span.start < node.span.end),
            "{label}: the insertion point falls inside node {}",
            node.id.get()
        );
    } // End of the loop over the frontier leaves
} // End of function check_insertion_is_a_line_boundary()

/// Property 4 for an insertion: the key is there with the intended value.
fn check_insert_intent(label: &str, mapping: &DocumentPath, value: &str, after: &SyntaxIndex) {
    let id = espansoconfig_core::patch::resolve(after, mapping)
        .unwrap_or_else(|error| panic!("{label}: the mapping is lost: {error}"));
    let node = after.node(id).expect("a resolved node exists");
    let found = node
        .children
        .chunks(2)
        .filter_map(|pair| match (pair.first(), pair.get(1)) {
            (Some(&key), Some(&held)) => Some((key, held)),
            _ => None,
        })
        .find(|(key, _)| {
            after
                .node(*key)
                .and_then(|key| key.scalar.as_ref())
                .is_some_and(|scalar| scalar.value == INSERT_KEY)
        });
    let (_, held) = found.unwrap_or_else(|| panic!("{label}: the inserted key is not there"));
    let scalar = after
        .node(held)
        .and_then(|node| node.scalar.as_ref())
        .unwrap_or_else(|| panic!("{label}: the inserted entry holds no scalar"));
    assert!(
        scalar.value == value,
        "{label}: the inserted entry holds {} bytes where {} were intended",
        scalar.value.len(),
        value.len()
    );
} // End of function check_insert_intent()

/// Property 4 for a removal: the key is gone and the mapping is one shorter.
fn check_remove_intent(
    label: &str,
    mapping: &DocumentPath,
    key: NodeId,
    before: &SyntaxIndex,
    after: &SyntaxIndex,
) {
    let gone = before
        .node(key)
        .and_then(|node| node.scalar.as_ref())
        .map(|scalar| scalar.value.clone())
        .unwrap_or_default();
    let id = espansoconfig_core::patch::resolve(after, mapping)
        .unwrap_or_else(|error| panic!("{label}: the mapping is lost: {error}"));
    let node = after.node(id).expect("a resolved node exists");
    let was = before
        .node(
            espansoconfig_core::patch::resolve(before, mapping).expect("the mapping resolved once"),
        )
        .expect("a resolved node exists")
        .children
        .len();
    assert_eq!(
        node.children.len() + 2,
        was,
        "{label}: the mapping did not lose exactly one entry"
    );
    for pair in node.children.chunks(2) {
        let Some(&held) = pair.first() else { continue };
        let present = after
            .node(held)
            .and_then(|key| key.scalar.as_ref())
            .is_some_and(|scalar| scalar.value == gone);
        assert!(!present, "{label}: the removed key is still there");
    } // End of the loop over the mapping's surviving entries
} // End of function check_remove_intent()

/// The move column of the cross.
#[allow(clippy::too_many_arguments)]
fn sweep_moves(
    name: &str,
    source: &str,
    index: &SyntaxIndex,
    trivia: &TriviaIndex,
    axes: &DocumentAxes,
    totals: &mut CorpusTotals,
    tally: &mut Tally,
) {
    for sequence in index.nodes() {
        if sequence.kind != NodeKind::Sequence || sequence.children.len() < 2 {
            continue;
        }
        let blocked = hazard_that_blocks(index, trivia, sequence.id).map(|hazard| hazard.kind);
        let flow = inside_flow(index, sequence.id);
        let last = sequence.children.len() - 1;
        // The first item to the back, and the last item to the front: two
        // destinations that between them exercise both directions of the splice
        // and both ends of the sequence.
        for (item, destination) in [
            (sequence.children[0], Some(last)),
            (sequence.children[last], None),
        ] {
            let Ok(item_path) = path_to(index, item) else {
                continue;
            };
            let node = index.node(item).expect("a sequence item");
            let lines = owned_lines(source, index, node.span.start, subtree_end(index, item));
            // The `-` that introduces the item sits before its span, so the
            // envelope legitimately starts on that line rather than at the span.
            let envelope = ByteSpan::new(
                line_start(source, node.span.start, index.preamble().body_offset).min(lines.start),
                lines.end,
            );
            let label = format!("{name} move item {} of {}", item.get(), sequence.id.get());
            match move_item(source, &item_path, destination) {
                Ok(patched) => {
                    if let Some(kind) = blocked {
                        totals.hazard_applied(kind);
                        panic!("{label}: applied although a hazard disqualifies the sequence");
                    }
                    assert!(!flow, "{label}: applied inside a flow collection");
                    let after =
                        SyntaxIndex::parse(patched.text()).expect("the candidate must reparse");
                    check_universal(&label, source, &patched, index, trivia, &after);
                    check_move_is_a_relocation(&label, source, patched.replacements(), envelope);
                    check_lines_are_conserved(&label, source, patched.text());
                    check_block_scalars_conserved(&label, source, index, &patched, &after, totals);
                    record(
                        tally,
                        totals,
                        index,
                        axes,
                        &[item],
                        Operation::ItemMove,
                        true,
                    );
                }
                Err(error) => {
                    let (family, hazard) = classify(&label, &error, blocked);
                    totals.refuse(family, hazard);
                    record(
                        tally,
                        totals,
                        index,
                        axes,
                        &[item],
                        Operation::ItemMove,
                        false,
                    );
                }
            }
        } // End of the loop over this sequence's two offered relocations
    } // End of the loop over every block sequence of the document
} // End of function sweep_moves()

/// Properties 3 and 4 for a move: the runs come from the item's own lines, and
/// the bytes written are exactly the bytes taken.
///
/// The second half is the test-side derivation of `the_arrival_is_the_departure`,
/// kept here as well as in `verify` because two independent derivations of one
/// property is the discipline (`PROGRESS.md`, D2q).
fn check_move_is_a_relocation(
    label: &str,
    source: &str,
    replacements: &[Replacement],
    envelope: ByteSpan,
) {
    let mut carried = String::new();
    let mut arrivals = 0usize;
    for replacement in replacements {
        if replacement.text.is_empty() {
            assert!(
                envelope.contains(replacement.span),
                "{label}: a deleted run {}..{} reaches outside the item's own lines {}..{}",
                replacement.span.start,
                replacement.span.end,
                envelope.start,
                envelope.end
            );
            carried.push_str(replacement.span.slice(source).expect("a run slices"));
        } else {
            assert!(
                replacement.span.is_empty(),
                "{label}: a move writes at a zero-width point"
            );
            arrivals += 1;
            assert!(
                replacement.text == carried
                    || carried.is_empty()
                    || replacement.text.len() == carried.len(),
                "{label}: the arrival is not the departure"
            );
        }
    } // End of the loop over the move's replacements
    assert_eq!(arrivals, 1, "{label}: a move has exactly one arrival");
    let arrival = replacements
        .iter()
        .find(|replacement| !replacement.text.is_empty())
        .expect("checked above");
    assert!(
        arrival.text == carried,
        "{label}: the {} bytes written are not the {} bytes taken",
        arrival.text.len(),
        carried.len()
    );
} // End of function check_move_is_a_relocation()

/// The document's physical lines are conserved, as one multiset of
/// `(content, terminator)` pairs.
fn check_lines_are_conserved(label: &str, source: &str, candidate: &str) {
    let before = physical_lines(source);
    let after = physical_lines(candidate);
    let mut lines: Vec<(&str, &str)> = after.iter().map(|line| (line.1, line.2)).collect();
    for (at, content, ending) in &before {
        match lines.iter().position(|seen| *seen == (*content, *ending)) {
            Some(found) => {
                lines.swap_remove(found);
            }
            None => panic!("{label}: the line at byte {at} is not in the candidate"),
        }
    } // End of the loop that claims one candidate line per original line
    assert!(
        lines.is_empty(),
        "{label}: the candidate holds {} lines the original did not",
        lines.len()
    );
} // End of function check_lines_are_conserved()

// ---------------------------------------------------------------------------
// The gate itself
// ---------------------------------------------------------------------------

/// Prints the axis × operation coverage matrix, and returns how many cells are
/// [`Coverage::RefusedOnly`].
///
/// The count is returned rather than recomputed by the caller because it is
/// pinned: the notes used to say "five", counting grouped table *rows*, and the
/// Phase 0c-3b-2b review counted the **cells** and got eight. A number nobody
/// derives from the measurement drifts from it.
fn print_coverage(label: &str, totals: &CorpusTotals) -> usize {
    let matrix = totals.coverage();
    println!("\n--- {label}: axis x operation coverage (A applied, r refused only, . absent) ---");
    println!(
        "{:<26} {:>6} {:>10} {:>10} {:>10} {:>10}",
        "axis",
        "files",
        OPERATIONS[0].heading(),
        OPERATIONS[1].heading(),
        OPERATIONS[2].heading(),
        OPERATIONS[3].heading()
    );
    let mut refused_only = 0usize;
    for axis in AXES {
        let row = matrix[axis.slot()];
        let cells: Vec<String> = (0..OPERATIONS.len())
            .map(|slot| {
                if row[slot] == Coverage::RefusedOnly {
                    refused_only += 1;
                }
                format!(
                    "{} {:>5}/{}",
                    row[slot].mark(),
                    totals.applied[axis.slot()][slot],
                    totals.attempts[axis.slot()][slot]
                )
            })
            .collect();
        println!(
            "{:<26} {:>6} {:>10} {:>10} {:>10} {:>10}",
            axis.name(),
            totals.carried[axis.slot()],
            cells[0],
            cells[1],
            cells[2],
            cells[3]
        );
    } // End of the loop that prints one row per axis
    println!("{label}: {refused_only} of 48 cells are refusal-only");
    refused_only
} // End of function print_coverage()

#[test]
fn every_r9_axis_meets_every_operation_over_the_synthetic_corpus() {
    let files = synthetic_valid();
    assert!(!files.is_empty(), "the synthetic corpus must be present");
    assert_eq!(
        files.len(),
        SYNTHETIC_OUTCOMES.len(),
        "every fixture needs a pinned gate outcome row"
    );

    let mut totals = CorpusTotals::default();
    let mut overall = Tally::default();
    println!("\n--- gate attempts per synthetic fixture ---");
    println!(
        "{:<40} {:>6} {:>9} {:>9} {:>9} {:>9}",
        "fixture", "total", "edit", "insr", "remv", "move"
    );
    for file in &files {
        let tally = sweep(&file.name, &file.source, &mut totals);
        println!(
            "{:<40} {:>6} {:>4}/{:<4} {:>4}/{:<4} {:>4}/{:<4} {:>4}/{:<4}",
            file.name,
            tally.total(),
            tally.applied[0],
            tally.refused[0],
            tally.applied[1],
            tally.refused[1],
            tally.applied[2],
            tally.refused[2],
            tally.applied[3],
            tally.refused[3]
        );
        // Matched on the whole file name, never on a suffix: `blank-lines.yml`
        // is a suffix of `block-scalar-leading-blank-lines.yml`.
        let base = file.name.rsplit('/').next().unwrap_or(&file.name);
        let row = SYNTHETIC_OUTCOMES
            .iter()
            .find(|row| row.0 == base)
            .unwrap_or_else(|| panic!("{} has no pinned gate outcome row", file.name));
        assert_eq!(
            tally,
            Tally {
                applied: row.1,
                refused: row.2,
            },
            "{}: gate outcome split",
            file.name
        );
        overall.add(&tally);
    } // End of the loop over the valid synthetic fixtures

    println!(
        "synthetic: {} attempts — applied {:?}, refused {:?}",
        overall.total(),
        overall.applied,
        overall.refused
    );
    println!("refusals by family: {:?}", totals.families);
    println!(
        "hazard families (attempts, applications): {:?}",
        totals.hazards
    );
    println!(
        "{} scalars unreachable because their key is duplicated; \
         {} applied edits had a block scalar to conserve",
        totals.ambiguous_key_targets, totals.block_scalar_conservations
    );
    let refused_only = print_coverage("synthetic", &totals);

    // The rows must add up to the totals, so neither can be "fixed" alone.
    assert_eq!(
        overall.total(),
        SYNTHETIC_OUTCOMES
            .iter()
            .map(|row| row.1.iter().chain(row.2.iter()).sum::<usize>())
            .sum::<usize>(),
        "the pinned rows must add up to the swept total"
    );

    // **The coverage matrix**, cell by cell. A cell that quietly became `Absent`
    // is the coverage hole this table exists to make impossible.
    let measured = totals.coverage();
    for (axis, expected) in AXIS_COVERAGE {
        assert_eq!(
            measured[axis.slot()],
            expected,
            "{}: coverage across the four operations",
            axis.name()
        );
    } // End of the loop over the pinned coverage rows
    assert_eq!(
        AXIS_COVERAGE.len(),
        AXES.len(),
        "every axis needs a pinned coverage row"
    );
    // Pinned as a **cell** count, derived from the measurement rather than from
    // reading the table above. See `REFUSAL_ONLY_CELLS` for the account of each.
    assert_eq!(
        refused_only,
        AXIS_COVERAGE
            .iter()
            .flat_map(|(_, row)| row.iter())
            .filter(|cell| **cell == Coverage::RefusedOnly)
            .count(),
        "the pinned matrix and the measurement must agree on how many cells refuse"
    );
    assert_eq!(refused_only, REFUSAL_ONLY_CELLS.len());
    for (axis, operation, _) in REFUSAL_ONLY_CELLS {
        assert_eq!(
            measured[axis.slot()][operation.slot()],
            Coverage::RefusedOnly,
            "{} x {} is accounted for as refusal-only and is not",
            axis.name(),
            operation.heading()
        );
    } // End of the loop over the accounted-for refusal-only cells
      // Every axis a fixture carries was reached by some operation. With the
      // attribution operation-local this is a real statement: an axis no operation
      // targets now shows as zero attempts rather than borrowing its neighbours'.
    for axis in AXES {
        let attempted: usize = totals.attempts[axis.slot()].iter().sum();
        assert_eq!(
            attempted > 0,
            totals.carried[axis.slot()] > 0,
            "{}: carried by {} files and reached by {} attempts",
            axis.name(),
            totals.carried[axis.slot()],
            attempted
        );
    } // End of the loop that pairs "a fixture has it" with "an operation met it"

    // Every construct the hazard gate refuses must have refused **totally**, and
    // must have been reached at all. A zero in the first column would mean the
    // construct contributed no attempts, which is a hole, not a pass.
    for family in [
        "MergeKey",
        "AliasReference",
        "AnchorDefinition",
        "ExplicitKeyMapping",
        "ExplicitTag",
        "DuplicateMappingKey",
        "MultiDocumentStream",
        "CommentInFlowCollection",
    ] {
        let (attempts, applications) = totals
            .hazards
            .get(family)
            .copied()
            .unwrap_or_else(|| panic!("{family} blocked no attempt at all — a coverage hole"));
        assert!(attempts > 0, "{family} blocked no attempt at all");
        assert_eq!(applications, 0, "{family} did not refuse totally");
    } // End of the loop over the hazard families R9 names

    // Pinned exactly, so a construct cannot quietly stop contributing.
    assert_eq!(totals.hazards["MergeKey"].0, 23);
    assert_eq!(totals.hazards["AliasReference"].0, 9);
    assert_eq!(totals.hazards["AnchorDefinition"].0, 31);
    assert_eq!(totals.hazards["ExplicitKeyMapping"].0, 11);
    assert_eq!(totals.hazards["ExplicitTag"].0, 9);
    assert_eq!(totals.hazards["DuplicateMappingKey"].0, 15);
    assert_eq!(totals.hazards["MultiDocumentStream"].0, 33);
    assert_eq!(totals.hazards["CommentInFlowCollection"].0, 18);
    // Scalars of `duplicate-keys.yml` that sit under a duplicated key: no path
    // names them, so they are refused at the resolver rather than at the gate.
    // Counted rather than skipped, because a construct that contributes zero
    // attempts and says nothing is the hole this file exists to close.
    assert_eq!(totals.ambiguous_key_targets, 4);
    // Every applied edit that could conserve a block scalar did.
    assert!(totals.block_scalar_conservations > 0);
} // End of function every_r9_axis_meets_every_operation_over_the_synthetic_corpus()

#[test]
fn every_r9_axis_meets_every_operation_over_the_real_corpus() {
    let files = real_corpus();
    if skip_without_real_corpus("gate round trip", &files) {
        return;
    }

    let mut totals = CorpusTotals::default();
    let mut overall = Tally::default();
    for file in &files {
        let _ = index_of(file);
        overall.add(&sweep(&file.name, &file.source, &mut totals));
    } // End of the loop over the real corpus files

    // No count from private data is hard-coded (`PROGRESS.md`, D1). What is
    // asserted is the **shape** of the result: every operation applied at least
    // once, every refusal was typed and justified by `sweep` itself, and every
    // axis a real file carries was reached by some operation.
    println!(
        "\nreal: {} files, {} attempts — applied {:?}, refused {:?}",
        files.len(),
        overall.total(),
        overall.applied,
        overall.refused
    );
    println!("refusals by family: {:?}", totals.families);
    print_coverage("real", &totals);
    for operation in OPERATIONS {
        assert!(
            overall.applied[operation.slot()] > 0,
            "no {} applied anywhere in the real corpus",
            operation.heading()
        );
    }
    for axis in AXES {
        let attempted: usize = totals.attempts[axis.slot()].iter().sum();
        assert_eq!(
            attempted > 0,
            totals.carried[axis.slot()] > 0,
            "{}: carried by {} real files and reached by {} attempts",
            axis.name(),
            totals.carried[axis.slot()],
            attempted
        );
    } // End of the loop over the axes the real corpus carries
} // End of function every_r9_axis_meets_every_operation_over_the_real_corpus()

/// Parses a corpus file, failing loudly with its name if it does not parse.
fn index_of(file: &CorpusFile) -> SyntaxIndex {
    SyntaxIndex::parse(&file.source).unwrap_or_else(|error| {
        panic!("{}: expected a valid fixture, got {error}", file.name);
    })
}

// ---------------------------------------------------------------------------
// R16 — the tag-resolution oracle
// ---------------------------------------------------------------------------

/// **A second transcription of YAML 1.1's implicit resolution, written here.**
///
/// The Phase 0c-3b-2b review's second finding: the generated sweep used to
/// compare `plain_scalar_is_ambiguous` against a predicate that *calls*
/// `plain_scalar_is_ambiguous`, so "0 gaps" measured only that the emitter is a
/// conservative superset of its own table. A table cannot be its own oracle.
///
/// This module answers one question — **does YAML 1.1 resolve this text to
/// something other than a string?** — from the productions of the YAML 1.1 type
/// repository, transcribed separately from `src/emit/tags.rs`. It computes no
/// values: the 1.1/1.2 *value* disagreement is a second property and this is the
/// one that decides whether an emitted plain scalar changes meaning.
///
/// It is written differently on purpose. `tags.rs` resolves with a mutable
/// cursor and returns canonical renderings; this matches with slice predicates
/// and returns `bool`. Where the productions themselves dictate the shape — five
/// integer forms told apart by their prefix — the two necessarily look alike, and
/// the hand-written case tables in
/// [`the_emitters_predicate_never_disagrees_with_an_independent_transcription`]
/// are what carry the external knowledge there.
///
/// **The five deviations `src/emit/tags.rs` documents are transcribed too**, and
/// deliberately so: they are the module's specified behaviour, not accidents, and
/// an oracle that omitted them would report disagreements that are policy rather
/// than defects. They are named at each site.
mod independent_yaml_1_1 {
    /// The twenty-two boolean spellings, listed rather than case-folded.
    const BOOLEANS: [&str; 22] = [
        "y", "Y", "yes", "Yes", "YES", "n", "N", "no", "No", "NO", "true", "True", "TRUE", "false",
        "False", "FALSE", "on", "On", "ON", "off", "Off", "OFF",
    ];

    /// The five null spellings, the empty text included.
    const NULLS: [&str; 5] = ["", "~", "null", "Null", "NULL"];

    /// Whether YAML 1.1 resolves `text` to a tag other than `str`.
    ///
    /// The type repository's resolution order: null, bool, merge, value, int,
    /// float, timestamp, and `str` for everything left.
    pub fn resolves_to_a_non_string(text: &str) -> bool {
        NULLS.contains(&text)
            || BOOLEANS.contains(&text)
            || text == "<<"
            || text == "="
            || matches_an_integer(text)
            || matches_a_float(text)
            || matches_a_timestamp(text)
    } // End of function resolves_to_a_non_string()

    /// `text` with a leading `-` or `+` removed.
    fn unsigned(text: &str) -> &str {
        text.strip_prefix(['-', '+']).unwrap_or(text)
    }

    /// A run of permitted digits and `_` separators holding at least one digit.
    ///
    /// The "at least one digit" clause is `tags.rs`'s [`radix_value`] deviation:
    /// the printed productions admit `0x_`, and no implementation resolves a run
    /// of underscores as a number.
    fn digit_run(text: &str, digit: impl Fn(u8) -> bool) -> bool {
        !text.is_empty()
            && text.bytes().all(|byte| byte == b'_' || digit(byte))
            && text.bytes().any(|byte| byte != b'_')
    } // End of function digit_run()

    /// One base-60 group, `[0-5]?[0-9]`.
    fn base_sixty_group(text: &str) -> bool {
        match text.as_bytes() {
            [only] => only.is_ascii_digit(),
            [tens, units] => (b'0'..=b'5').contains(tens) && units.is_ascii_digit(),
            _ => false,
        }
    } // End of function base_sixty_group()

    /// Whether `text` starts with `1`–`9`.
    fn opens_non_zero(text: &str) -> bool {
        matches!(text.as_bytes().first(), Some(byte) if (b'1'..=b'9').contains(byte))
    }

    /// YAML 1.1's five integer productions.
    ///
    /// ```text
    /// [-+]?0b[0-1_]+                    [-+]?0[0-7_]+
    /// [-+]?(0|[1-9][0-9_]*)             [-+]?0x[0-9a-fA-F_]+
    /// [-+]?[1-9][0-9_]*(:[0-5]?[0-9])+
    /// ```
    fn matches_an_integer(text: &str) -> bool {
        let body = unsigned(text);
        if let Some(digits) = body.strip_prefix("0b") {
            return digit_run(digits, |byte| matches!(byte, b'0' | b'1'));
        }
        if let Some(digits) = body.strip_prefix("0x") {
            return digit_run(digits, |byte| byte.is_ascii_hexdigit());
        }
        if let Some(digits) = body.strip_prefix('0') {
            // The bare `0` of the decimal production, then base 8. A `0`
            // followed by anything else — `08`, `0o17`, `0:30` — matches no
            // production at all.
            return digits.is_empty() || digit_run(digits, |byte| (b'0'..=b'7').contains(&byte));
        }
        // What is left opens with `1`–`9`: plain decimal, or base 60 when it
        // carries at least one `:` group.
        let mut groups = body.split(':');
        let head = groups.next().unwrap_or_default();
        if !opens_non_zero(head) || !digit_run(head, |byte| byte.is_ascii_digit()) {
            return false;
        }
        groups.all(base_sixty_group)
    } // End of function matches_an_integer()

    /// YAML 1.1's four float productions.
    ///
    /// ```text
    /// [-+]?([0-9][0-9_]*)?\.[0-9_]*([eE][-+][0-9]+)?
    /// [-+]?[0-9][0-9_]*(:[0-5]?[0-9])+\.[0-9_]*
    /// [-+]?\.(inf|Inf|INF)               \.(nan|NaN|NAN)
    /// ```
    fn matches_a_float(text: &str) -> bool {
        if matches!(text, ".nan" | ".NaN" | ".NAN") {
            return true;
        }
        let body = unsigned(text);
        if matches!(body, ".inf" | ".Inf" | ".INF") {
            return true;
        }
        matches_a_base_sixty_float(body) || matches_a_base_ten_float(body)
    } // End of function matches_a_float()

    /// `[0-9][0-9_]*(:[0-5]?[0-9])+\.[0-9_]*`, the sign already stripped.
    fn matches_a_base_sixty_float(body: &str) -> bool {
        let Some(point) = body.find('.') else {
            return false;
        };
        let (whole, fraction) = (&body[..point], &body[point + 1..]);
        if !fraction
            .bytes()
            .all(|byte| byte.is_ascii_digit() || byte == b'_')
        {
            return false;
        }
        let mut groups = whole.split(':');
        let head = groups.next().unwrap_or_default();
        if !matches!(head.as_bytes().first(), Some(byte) if byte.is_ascii_digit()) {
            return false;
        }
        if !head
            .bytes()
            .all(|byte| byte.is_ascii_digit() || byte == b'_')
        {
            return false;
        }
        let groups: Vec<&str> = groups.collect();
        !groups.is_empty() && groups.iter().all(|group| base_sixty_group(group))
    } // End of function matches_a_base_sixty_float()

    /// `([0-9][0-9_]*)?\.[0-9_]*([eE][-+][0-9]+)?`, the sign already stripped.
    ///
    /// Two things a 1.2 reader finds surprising, and one of them is `tags.rs`'s
    /// first documented deviation: the exponent's sign is **mandatory**, so
    /// `1.0e3` is a string; and the printed production matches a lone `.`, which
    /// no implementation resolves, so at least one digit is required.
    fn matches_a_base_ten_float(body: &str) -> bool {
        let (mantissa, exponent) = match body.find(['e', 'E']) {
            Some(at) => (&body[..at], Some(&body[at + 1..])),
            None => (body, None),
        };
        let Some(point) = mantissa.find('.') else {
            return false;
        };
        let (whole, fraction) = (&mantissa[..point], &mantissa[point + 1..]);
        let digits_or_underscores = |text: &str| {
            text.bytes()
                .all(|byte| byte.is_ascii_digit() || byte == b'_')
        };
        if !digits_or_underscores(whole) || !digits_or_underscores(fraction) {
            return false;
        }
        if whole.starts_with('_') {
            return false;
        }
        if !whole
            .bytes()
            .chain(fraction.bytes())
            .any(|byte| byte.is_ascii_digit())
        {
            return false;
        }
        match exponent {
            None => true,
            Some(exponent) => match exponent.strip_prefix(['-', '+']) {
                None => false,
                Some(digits) => !digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit()),
            },
        }
    } // End of function matches_a_base_ten_float()

    /// YAML 1.1's timestamp production, with the deviations `tags.rs` records.
    ///
    /// ```text
    /// [0-9]{4}-[0-9]{1,2}-[0-9]{1,2}
    /// [0-9]{4}-[0-9]{1,2}-[0-9]{1,2}([Tt]|[ \t]+)[0-9]{1,2}:[0-9]{2}:[0-9]{2}
    ///   (\.[0-9]*)?([ \t]*(Z|[-+][0-9]{1,2}(:[0-9]{2})?))?
    /// ```
    ///
    /// The date-only form's one-or-two-digit month and day are the third
    /// deviation (Psych rather than the printed regex), and the blanks before a
    /// numeric offset the second (PyYAML rather than the printed regex).
    /// Deliberately **syntactic**: `2001-13-99` is a timestamp, because it is one
    /// to the resolver that uses the production.
    fn matches_a_timestamp(text: &str) -> bool {
        let Some(rest) = fixed_digits(text, 4).and_then(|rest| rest.strip_prefix('-')) else {
            return false;
        };
        let Some(rest) = one_or_two_digits(rest).and_then(|rest| rest.strip_prefix('-')) else {
            return false;
        };
        let Some(rest) = one_or_two_digits(rest) else {
            return false;
        };
        if rest.is_empty() {
            return true;
        }
        let rest = match rest.strip_prefix(['T', 't']) {
            Some(rest) => rest,
            None => {
                let trimmed = rest.trim_start_matches([' ', '\t']);
                if trimmed.len() == rest.len() {
                    return false;
                }
                trimmed
            }
        };
        let Some(rest) = one_or_two_digits(rest) else {
            return false;
        };
        let mut rest = rest;
        for _ in 0..2 {
            let Some(next) = rest
                .strip_prefix(':')
                .and_then(|rest| fixed_digits(rest, 2))
            else {
                return false;
            };
            rest = next;
        } // End of the loop over the minute and second fields
        if let Some(after) = rest.strip_prefix('.') {
            rest = after.trim_start_matches(|character: char| character.is_ascii_digit());
        }
        if rest.is_empty() {
            return true;
        }
        let rest = rest.trim_start_matches([' ', '\t']);
        if let Some(after) = rest.strip_prefix('Z') {
            return after.is_empty();
        }
        let Some(rest) = rest.strip_prefix(['-', '+']).and_then(one_or_two_digits) else {
            return false;
        };
        match rest.strip_prefix(':') {
            None => rest.is_empty(),
            Some(minutes) => fixed_digits(minutes, 2) == Some(""),
        }
    } // End of function matches_a_timestamp()

    /// `text` past exactly `count` leading digits, or `None`.
    fn fixed_digits(text: &str, count: usize) -> Option<&str> {
        let taken = text
            .bytes()
            .take(count)
            .take_while(|byte| byte.is_ascii_digit())
            .count();
        (taken == count).then(|| &text[count..])
    }

    /// `text` past one or two leading digits, greedily, or `None`.
    fn one_or_two_digits(text: &str) -> Option<&str> {
        let taken = text
            .bytes()
            .take(2)
            .take_while(|byte| byte.is_ascii_digit())
            .count();
        (taken >= 1).then(|| &text[taken..])
    }
} // End of module independent_yaml_1_1

/// A seeded xorshift64\* generator, hand-written so the crate gains no
/// dependency — the same one `tests/patch_path.rs` and `tests/scalar_codec.rs`
/// use for their own sweeps.
struct Prng(u64);

impl Prng {
    /// Returns the next pseudo-random word.
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }

    /// Returns a value in `0..bound`.
    fn below(&mut self, bound: usize) -> usize {
        (self.next() % bound as u64) as usize
    }
} // End of impl Prng

/// The hand-written case table, one row per YAML 1.1 family.
///
/// `(text, resolves to a non-string)`. Every family the productions name, on
/// **both** sides of its condition — which is R20's standing rule applied to a
/// table rather than to a corpus. Asserted against the library's resolver *and*
/// against [`independent_yaml_1_1`], so a shared mistake in the two
/// transcriptions still has to survive an externally written expectation.
const YAML_1_1_CASES: [(&str, bool); 77] = [
    // Nulls, and the near misses.
    ("", true),
    ("~", true),
    ("null", true),
    ("Null", true),
    ("NULL", true),
    ("nulL", false),
    ("~~", false),
    // Booleans, and the case mixtures the production does not list.
    ("y", true),
    ("Y", true),
    ("yes", true),
    ("YES", true),
    ("n", true),
    ("no", true),
    ("off", true),
    ("On", true),
    ("TRUE", true),
    ("yEs", false),
    ("oN", false),
    ("yess", false),
    ("truth", false),
    // The two keys only 1.1 has.
    ("<<", true),
    ("=", true),
    ("<<<", false),
    ("==", false),
    // Base 2, 8, 10 and 16, each with a near miss.
    ("0b101", true),
    ("-0b1_0", true),
    ("0b102", false),
    ("0b", false),
    ("0b_", false),
    ("012", true),
    ("0_1", true),
    ("08", false),
    ("0o17", false),
    ("0", true),
    ("-0", true),
    ("123", true),
    ("1_000", true),
    ("+42", true),
    ("1a", false),
    ("_1", false),
    ("0x1f", true),
    ("0X1f", false),
    ("0xg", false),
    // Base 60, both ways, and past what an i128 can hold.
    ("12:30", true),
    ("1:2:3", true),
    ("-12:30", true),
    ("12:99", false),
    ("12:", false),
    ("0:30", false),
    ("999999999999999999999999999999999999999:00", true),
    // Floats: base 10, the mandatory exponent sign, base 60, inf and nan.
    ("1.5", true),
    (".5", true),
    ("5.", true),
    ("._7", true),
    (".__2", true),
    ("._78E-8", true),
    (".", false),
    ("._", false),
    ("1.0e3", false),
    ("1e3", false),
    ("1.0e+3", true),
    ("1.0E-3", true),
    ("1:30.5", true),
    (".inf", true),
    ("-.Inf", true),
    (".INF", true),
    (".nan", true),
    ("-.nan", false),
    ("inf", false),
    // Timestamps, in every admitted form, and four that are not.
    ("2001-12-14", true),
    ("2001-1-1", true),
    ("2001-1-1 10:00:00", true),
    ("2001-12-14t21:59:43.10-05:00", true),
    ("2001-12-14 21:59:43.10 Z", true),
    ("2001-13-99", true),
    ("2001-12-14 21:59", false),
    ("2001-12", false),
];

#[test]
fn the_emitters_predicate_never_disagrees_with_an_independent_transcription() {
    // **The Phase 0c-3b-2b review's second finding, closed.** What used to be
    // here compared the emitter's predicate against a predicate that called the
    // same table, so it could only ever measure that the emitter is a
    // conservative superset of *itself*. The oracle is now a second
    // transcription of the YAML 1.1 productions, written in this file, and the
    // sweep is a genuine differential.
    //
    // Three claims, in order of strength:
    //
    // 1. the hand-written case table is right about both implementations;
    // 2. the library's resolver and the independent transcription agree on every
    //    generated value;
    // 3. the emitter never writes plain anything the **independent** reading of
    //    YAML 1.1 calls a non-string.
    for (text, expected) in YAML_1_1_CASES {
        assert_eq!(
            resolve_plain_yaml_1_1(text).tag != YamlTag::Str,
            expected,
            "src/emit/tags.rs disagrees with the case table about {text:?}"
        );
        assert_eq!(
            independent_yaml_1_1::resolves_to_a_non_string(text),
            expected,
            "the independent transcription disagrees with the case table about {text:?}"
        );
        if expected {
            assert!(
                !is_conservatively_safe_plain_scalar(text),
                "{text:?} is not a YAML 1.1 string and must never be written plain"
            );
        }
    } // End of the loop over the hand-written case table

    // The generated half. Two generators, because one is not enough: an alphabet
    // of the characters that open or continue an implicit type reaches the
    // numeric and timestamp shapes, and a token generator reaches the keyword
    // ones a character generator would need centuries to spell.
    let alphabet: Vec<char> = "0123456789abcdefxoyYnN_.:+-eEtTzZ ~<=|".chars().collect();
    let tokens = [
        "", "-", "+", "0", "0b", "0x", "0o", "1", "9", "_", "12", "30", ":", ".", "e", "E", "inf",
        "nan", "Inf", "NaN", "y", "no", "ON", "off", "true", "False", "null", "~", "<<", "=",
        "2001", "-12", "-14", " ", "T", "t", "Z", "10", "00", "59", "43",
    ];
    let mut prng = Prng(0x9E37_79B9_7F4A_7C15);
    let mut disagreements: Vec<String> = Vec::new();
    let mut gaps: Vec<String> = Vec::new();
    let mut reported = 0usize;
    let attempts = 500_000usize;
    for round in 0..attempts {
        let value: String = if round % 2 == 0 {
            let length = 1 + prng.below(12);
            (0..length)
                .map(|_| alphabet[prng.below(alphabet.len())])
                .collect()
        } else {
            let pieces = 1 + prng.below(6);
            (0..pieces)
                .map(|_| tokens[prng.below(tokens.len())])
                .collect()
        };
        let ours = resolve_plain_yaml_1_1(&value).tag != YamlTag::Str;
        let theirs = independent_yaml_1_1::resolves_to_a_non_string(&value);
        if ours != theirs && !disagreements.contains(&value) {
            disagreements.push(value.clone());
        }
        if theirs {
            reported += 1;
            if is_conservatively_safe_plain_scalar(&value) && !gaps.contains(&value) {
                gaps.push(value);
            }
        }
    } // End of the loop over the generated candidate values

    println!(
        "\n{attempts} generated values: {} resolved non-str by the independent transcription, \
         {} resolver disagreements, {} emitter gaps",
        reported,
        disagreements.len(),
        gaps.len()
    );
    assert!(
        reported > 0,
        "the generators reached no YAML 1.1 non-string at all — a vacuous sweep"
    );
    assert!(
        disagreements.is_empty(),
        "src/emit/tags.rs and the independent transcription disagree about: {disagreements:?}"
    );
    assert!(
        gaps.is_empty(),
        "the emitter would write these YAML 1.1 non-strings plain: {gaps:?}"
    );
} // End of function the_emitters_predicate_never_disagrees_with_an_independent_transcription()

#[test]
fn the_ambiguity_predicate_covers_the_disagreement_half_as_well() {
    // The 1.1 half is measured against an independent transcription above. This
    // is the other half of `plain_scalar_is_ambiguous`: a text YAML 1.1 calls a
    // string that YAML 1.2 core does not, which the substrate that reparses every
    // candidate cannot see because it resolves under 1.2. Hand-built, because
    // there is no second implementation of the 1.2 side either and pretending
    // otherwise is exactly what this phase refused to do for the 1.1 side.
    for value in ["0o17", "+0o17", "0O17"] {
        let one_one = resolve_plain_yaml_1_1(value);
        let one_two = resolve_plain_yaml_1_2_core(value);
        assert_eq!(one_one.tag, YamlTag::Str, "{value:?} is a 1.1 string");
        if one_two.tag != YamlTag::Str {
            assert!(plain_scalar_is_ambiguous(value), "{value:?}");
            assert!(!is_conservatively_safe_plain_scalar(value), "{value:?}");
        }
    } // End of the loop over the 1.2-only integer spellings

    // …and the `012` class: the same tag with a different value, which a
    // tag-only comparison would call a match.
    assert_eq!(resolve_plain_yaml_1_1("012").tag, YamlTag::Int);
    assert_eq!(resolve_plain_yaml_1_2_core("012").tag, YamlTag::Int);
    assert_ne!(
        resolve_plain_yaml_1_1("012").canonical,
        resolve_plain_yaml_1_2_core("012").canonical
    );
} // End of function the_ambiguity_predicate_covers_the_disagreement_half_as_well()

/// One corpus's plain-scalar tag census.
#[derive(Debug, Default)]
struct Census {
    /// Plain scalars examined.
    plain: usize,
    /// Those YAML 1.1 does not resolve to `str`, by tag name.
    one_one: BTreeMap<&'static str, usize>,
    /// Those the two schemas resolve differently, in tag or in value.
    disagreements: usize,
    /// Those whose tags agree but whose values do not — the `012` class.
    same_tag_other_value: usize,
}

/// Classifies every plain scalar of one corpus under both schemas.
fn census(files: &[CorpusFile]) -> Census {
    let mut census = Census::default();
    for file in files {
        let Ok(index) = SyntaxIndex::parse(&file.source) else {
            continue;
        };
        for node in index.nodes() {
            let Some(scalar) = node.scalar.as_ref() else {
                continue;
            };
            if scalar.presentation.style != ScalarStyle::Plain {
                continue;
            }
            census.plain += 1;
            let one_one = resolve_plain_yaml_1_1(&scalar.value);
            let one_two = resolve_plain_yaml_1_2_core(&scalar.value);
            if one_one.tag != YamlTag::Str {
                *census.one_one.entry(one_one.tag.name()).or_insert(0) += 1;
            }
            if one_one != one_two {
                census.disagreements += 1;
                if one_one.tag == one_two.tag {
                    census.same_tag_other_value += 1;
                }
            }
        } // End of the loop over one file's scalars
    } // End of the loop over the corpus files
    census
} // End of function census()

#[test]
fn the_plain_scalar_tag_census_of_both_corpora_is_reported_and_pinned() {
    let synthetic = census(&synthetic_valid());
    println!(
        "\nsynthetic: {} plain scalars, {} not str under YAML 1.1 {:?}, \
         {} 1.1/1.2 disagreements ({} same tag, other value)",
        synthetic.plain,
        synthetic.one_one.values().sum::<usize>(),
        synthetic.one_one,
        synthetic.disagreements,
        synthetic.same_tag_other_value
    );
    // Pinned, because these are the pre-existing ambiguities the projection will
    // have to answer for and a change in them is a change in what the gate
    // measured. **Reported as data, never failed on**: a real espanso file
    // legitimately contains `true`, `on` and `100`, and a test demanding their
    // absence would have to be deleted the first time it met one.
    assert_eq!(synthetic.plain, 823);
    // 19 booleans (`true`, `false`, `yes`, `y`), 5 nulls (every empty value of
    // `empty-entries-and-extents.yml`), 4 integers, 1 float and the 2 `<<` merge
    // keys. Every one of them is a scalar the file **already held**: nothing an
    // edit wrote is in this count, and the differential property in
    // `check_universal` is what keeps it that way.
    assert_eq!(synthetic.one_one.get("bool").copied().unwrap_or(0), 19);
    assert_eq!(synthetic.one_one.get("int").copied().unwrap_or(0), 4);
    assert_eq!(synthetic.one_one.get("float").copied().unwrap_or(0), 1);
    assert_eq!(synthetic.one_one.get("null").copied().unwrap_or(0), 5);
    assert_eq!(synthetic.one_one.get("merge").copied().unwrap_or(0), 2);
    assert_eq!(synthetic.one_one.values().sum::<usize>(), 31);
    // The five places the two schemas actually disagree in this corpus: two
    // `<<` (merge under 1.1, a plain string under 1.2 core), two `y` and one
    // `yes` (boolean under 1.1, string under 1.2). No scalar here is the `012`
    // shape — same tag, different value — which is the class a tag-only
    // comparison would have missed, and it is pinned at zero so its absence is
    // a measurement rather than an oversight.
    assert_eq!(synthetic.disagreements, 5);
    assert_eq!(synthetic.same_tag_other_value, 0);

    let real = real_corpus();
    if skip_without_real_corpus("real corpus tag census", &real) {
        return;
    }
    let measured = census(&real);
    // Counts only, never values (`CLAUDE.md` section 1), and nothing hard-coded.
    println!(
        "real: {} files, {} plain scalars, {} not str under YAML 1.1 {:?}, \
         {} 1.1/1.2 disagreements ({} same tag, other value)",
        real.len(),
        measured.plain,
        measured.one_one.values().sum::<usize>(),
        measured.one_one,
        measured.disagreements,
        measured.same_tag_other_value
    );
    assert!(measured.plain > 0, "no real plain scalar was classified");
} // End of function the_plain_scalar_tag_census_of_both_corpora_is_reported_and_pinned()

#[test]
fn an_edit_never_introduces_an_ambiguous_plain_scalar_even_when_asked_for_one() {
    // `no` and `._7` are both YAML 1.1-ambiguous, and both are in `VALUES`, so
    // the corpus sweep asks for them thousands of times. This pins the shape of
    // the answer on one document rather than only in aggregate: the value
    // arrives intact and the style is one that suppresses implicit resolution.
    let source = "matches:\n  - trigger: ':a'\n    replace: plain\n";
    let path: DocumentPath = "matches[0].replace".parse().expect("a valid path");
    for value in ["no", "._7", "on", "12:30", "012", "="] {
        let patched = apply_scalar_edit(source, &path, value)
            .unwrap_or_else(|error| panic!("{value}: {error}"));
        let index = SyntaxIndex::parse(patched.text()).expect("the candidate parses");
        let id = espansoconfig_core::patch::resolve(&index, &path).expect("the path survives");
        let scalar = index
            .node(id)
            .and_then(|node| node.scalar.as_ref())
            .expect("a scalar");
        assert_eq!(scalar.value, value, "{value}: the value must survive");
        assert_ne!(
            scalar.presentation.style,
            ScalarStyle::Plain,
            "{value}: an ambiguous value must never be written plain"
        );
        assert!(ambiguous_plain_scalars(&index).is_empty());
    } // End of the loop over the ambiguous values
} // End of function an_edit_never_introduces_an_ambiguous_plain_scalar_even_when_asked_for_one()
