//! Espanso-semantic validation over an already-projected document.
//!
//! **Phase 2a-2a scope: plan section 6.6 step 5, and nothing else.** The six
//! rules the plan lists are implemented here — exactly one content field, a
//! valid trigger combination, valid variable types with their required
//! parameters, unique variable names, `{{references}}` that resolve *where
//! statically knowable*, and a `regex` that compiles.
//!
//! # This is a report, not a gate
//!
//! [`validate`] is a **pure function of a [`DocumentView`]** returning
//! classified [`Finding`]s. It never decides whether a save proceeds, never
//! touches a file and never consults the filesystem. **Blocking policy belongs
//! to the save transaction** (plan section 6.6 steps 1 to 13), which is 2a-2b's
//! to write: a caller chooses what to do with each [`FindingClass`], and this
//! module's only job is to classify honestly. That resolves the tension the
//! placeholder this file replaces recorded — the plan calls step 5 a *semantic
//! gate*, and what is gated on is the classification, not the report.
//!
//! # Diagnostics are risk, not prophecy
//!
//! Plan section 6.6: *"Since the app does not control the daemon, it cannot
//! prove espanso will accept a file. Phrase diagnostics accordingly — 'this
//! looks wrong', not 'espanso will reject this'."* That rule governs every
//! variant name, every doc comment and every test name in this module. Where a
//! claim rests on a vocabulary espanso can extend without telling us, the
//! finding is [`FindingClass::SuspiciousButPermitted`] rather than an error —
//! see [`FindingCode::class`], which states the boundary once.
//!
//! # Which of the plan's four classes this module emits
//!
//! Plan section 6.6 names four: **YAML syntax error**, **editor model error**,
//! **suspicious but permitted** and **cannot be preserved visually**. Only the
//! middle two are produced here, and the omissions are deliberate:
//!
//! - a **YAML syntax error** is what step 4 — reparsing the whole candidate —
//!   reports, and it is already modelled as
//!   [`crate::model::DiagnosticCode::ParseFailed`]. A document that did not
//!   parse reaches this module with no matches at all and therefore yields
//!   nothing; it must not be mistaken for a clean document;
//! - **cannot be preserved visually** is the Phase 0b hazard gate
//!   ([`crate::syntax::HazardKind`], [`crate::model::MatchView::safely_editable`]).
//!   Restating it here would be a second copy of a decision that already has
//!   one owner.
//!
//! [`FindingClass`] therefore has exactly the two variants this module can
//! produce. A class nothing emits is a claim nothing backs.
//!
//! # Two codes this module does not produce
//!
//! Phase 2b-2c-3 added [`FindingCode::DocumentDoesNotParse`], and **[`validate`]
//! never returns it.** It is produced by [`crate::persist::save_document`]'s
//! whole-text replacement mode, where the candidate is the caller's own bytes,
//! the parse is a **fact to report** rather than a gate, and the owner's ruling
//! is that such a text is written anyway once the user confirms it
//! (`docs/reviews/phase-2b-2c-3-design.md`, the section overriding Q2).
//!
//! It lives in *this* enum for one reason: it has to be **acknowledgeable**, and
//! the acknowledgement protocol
//! ([`crate::persist::Acknowledgement::covers_all`]) is an exact multiset of
//! [`Finding`]s and nothing else. A parallel channel beside the findings would be
//! a second consent mechanism with none of this one's content-addressing.
//!
//! **And the content-addressing had to be put into the code itself.** A parse
//! rejection's line, column, byte offset and message describe where the parser
//! stopped, which is a property of the text's *invalid prefix* rather than of the
//! whole text; two byte-distinct candidates sharing that prefix produce equal
//! findings. So the variant carries the candidate's own [`ContentRevision`], and
//! an acknowledgement of one broken text can no longer commit a different one.
//! `tests/persist_raw_save.rs` builds exactly that colliding pair.
//!
//! Phase 2c-3c-1 added [`FindingCode::DuplicateKeepsTriggerDefinition`] on the
//! same terms: produced only by the save transaction, when the batch's one
//! [`crate::patch::DocumentEdit::DuplicateItem`] clones a match with exactly one
//! modelled trigger form. **A generic validator rule for repeated trigger text
//! was considered and rejected** (the 2c-3c design consult's Q3): it would newly
//! interrupt unrelated saves of pre-existing files, and it would still not prove
//! espanso's collision semantics — there is no match-trigger uniqueness rule in
//! this crate's model, and [`FindingCode::DuplicateVariableName`] is scoped to
//! variables alone. The operation-specific finding reports exactly what the one
//! operation did and nothing broader. Its content-addressing is the candidate's
//! own [`ContentRevision`], carried as an operand for `DocumentDoesNotParse`'s
//! reason: the clone-side path, span and node this step first relied on are all
//! equal across a same-length rewrite of the source trigger, so they bind
//! consent to a *shape*, not to a text (the 2c-3c-1 review's finding 1).
//!
//! Phase 2c-4c-1 added [`FindingCode::NewMatchRepeatsLiteralTrigger`] on the
//! same terms again, and deliberately **not** by widening the duplicate's code:
//! that one is produced only for a [`crate::patch::DocumentEdit::DuplicateItem`]
//! batch, and reusing its name for an insertion would be the 2c-3c precedent
//! borrowed under a false name rather than transferred at the right level. What
//! transfers is the *pattern* — a save-transaction code, `SuspiciousButPermitted`,
//! content-addressed by the candidate's own [`ContentRevision`], acknowledged by
//! the ordinary exact-multiset round trip. The rule that it is **not** a generic
//! validator rule holds here for the 2c-3c reason and one more: a rule over every
//! candidate would interrupt saves of files this application never created,
//! while a check that lived only in the window would be bypassable by any other
//! caller of the command.
//!
//! `tests/validate_semantics.rs`'s reachability check names all three as its
//! exemptions rather than losing the check, and asserts that no fixture reaches
//! any of them through [`validate`].
//!
//! # What this module is not
//!
//! - **Not structural well-formedness.** "Is the candidate still valid YAML,
//!   and does it reparse to the values we intended" is step 4's question, asked
//!   of bytes rather than of a projection.
//! - **Not a type resolver** (D2u). Every value it reads is
//!   [`crate::model::ScalarView::text`] — source text as written.
//! - **On the wire since Phase 2b-1, and in both directions since Phase
//!   2b-2a.** [`Finding`], [`FindingCode`] and [`FindingClass`] serialize, and
//!   every variant of the two enums has a `code.` entry in **both**
//!   `src/lib/i18n/en.json` and `es.json` —
//!   `src-tauri/src/dictionary_contract.rs` fails the build without them, which
//!   is why the derives and the strings landed in one change.
//!   [`Finding`] and [`FindingCode`] now also **deserialize**, because an
//!   acknowledgement has to arrive *from* the interface and it is a list of
//!   findings. The whole payload graph reads back: [`ByteSpan`],
//!   [`crate::syntax::NodeId`], [`DocumentPath`] and
//!   [`crate::model::VariableKind`].
//!
//!   **Reading a finding back in establishes nothing about it.** A caller can
//!   construct any finding it likes and hand it over as acknowledged; what makes
//!   the acknowledgement mean something is that
//!   [`crate::persist::verdict`] compares it against findings this module
//!   **recomputed** from the candidate, as an exact multiset. Nothing here, and
//!   nothing in `crate::persist`, can establish that a human saw one — enforcing
//!   presentation is the user interface's obligation
//!   (`docs/decisions/2b-1-notes.md` section 4).
//!
//! # What a successful regex compile here does and does not prove
//!
//! Rule 6 compiles a `regex` trigger with the `regex` crate, this crate's first
//! production dependency since Phase 0a. The asymmetry against espanso is
//! measured rather than assumed, and it is recorded in
//! `docs/decisions/2a-2a-notes.md` section 5: espanso 2.3.0 pins **regex
//! 1.5.5** with default features and compiles the user's pattern **verbatim**,
//! while this crate compiles it with a much later 1.x. A pattern using syntax
//! added after 1.5.5 therefore compiles here and would not compile there, so
//! [`FindingCode::RegexDoesNotCompile`] is evidence in one direction only:
//! *this pattern did not compile*, never *this pattern will work*.

use std::collections::HashSet;
use std::fmt;
use std::sync::OnceLock;

use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::model::{
    ContentKind, DocumentView, MatchView, ScalarView, TriggerKind, ValueKind, ValueView,
    VariableKind, VariableView,
};
use crate::patch::DocumentPath;
use crate::syntax::{ByteSpan, NodeId};
use crate::ContentRevision;

/// The pattern espanso uses to find a `{{variable}}` reference in a template.
///
/// Transcribed from `espanso-render/src/renderer/mod.rs` at espanso's `v2.3.0`
/// tag, where it is `VAR_REGEX`. It is quoted rather than approximated because
/// its exact shape decides what counts as a reference at all: a name is `\w+`,
/// an optional `.subname` follows, and surrounding whitespace is allowed. Text
/// such as `{{ not-a-name }}` is **not** a reference to espanso — the hyphen is
/// outside `\w` — so this module must not report it either.
const REFERENCE_PATTERN: &str = r"\{\{\s*((?P<name>\w+)(\.(?P<subname>(\w+)))?)\s*\}\}";

/// The YAML merge key. A mapping holding it takes entries from an anchor
/// defined elsewhere, so its visible keys are not all of its keys.
const MERGE_KEY: &str = "<<";

/// How seriously a caller should take a [`Finding`].
///
/// Two of plan section 6.6's four classes; the module documentation says which
/// two and why the other two belong elsewhere. On the wire since Phase 2b-1, so
/// both variants owe a `code.findingClass.` entry in both dictionaries.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
pub enum FindingClass {
    /// The document contradicts espanso's schema as this editor models it, in
    /// a way that is not explainable by espanso having grown since this crate
    /// was written.
    EditorModelError,
    /// This looks wrong, and the app cannot prove that it is. Every finding
    /// whose claim rests on a vocabulary espanso can extend — a variable type,
    /// a scoping rule — lands here.
    SuspiciousButPermitted,
}

impl FindingClass {
    /// Every class [`validate`] can produce.
    ///
    /// Exists so a test can assert that each one is actually reachable. A
    /// variant nothing emits is a claim nothing backs.
    pub const ALL: [FindingClass; 2] = [
        FindingClass::EditorModelError,
        FindingClass::SuspiciousButPermitted,
    ];

    /// A stable identifier for this class.
    ///
    /// **Not a user-facing string** (plan section 9): it is for logs, test
    /// output and, later, for building a dictionary key.
    pub fn name(self) -> &'static str {
        match self {
            FindingClass::EditorModelError => "EditorModelError",
            FindingClass::SuspiciousButPermitted => "SuspiciousButPermitted",
        }
    }
}

impl fmt::Display for FindingClass {
    /// A developer rendering, for logs and test output. Never shown to a user.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.name())
    }
}

/// What a save transaction noticed about a candidate, as a code plus its
/// operands.
///
/// **Ten of the thirteen are [`validate`]'s.** The other three —
/// [`FindingCode::DocumentDoesNotParse`], produced only by
/// [`crate::persist::save_document`]'s whole-text replacement mode,
/// [`FindingCode::DuplicateKeepsTriggerDefinition`], produced only by the same
/// transaction's duplicate batches, and
/// [`FindingCode::NewMatchRepeatsLiteralTrigger`], produced only by its
/// insertion batches — live here because they must be acknowledgeable, and an
/// acknowledgement is a multiset of [`Finding`]s; the module documentation says
/// the rest.
///
/// Plan section 9: *"Rust returns error codes and structured data, never
/// user-facing prose."* Nothing here is a sentence. Every operand is either a
/// number, an enum this crate owns, or **text the file itself supplied**.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum FindingCode {
    /// Rule 1. The match has none of `replace`, `form`, `markdown`, `html` and
    /// `image_path`, so nothing says what it expands to.
    MatchHasNoContentField,
    /// Rule 1. The match has more than one content field. Espanso expects
    /// exactly one, and which of them would win is not something this crate
    /// can read off the file.
    MatchHasSeveralContentFields,
    /// Rule 2. The match has none of `trigger`, `triggers` and `regex`, so
    /// nothing says when it fires.
    MatchHasNoTriggerField,
    /// Rule 2. The match has more than one of `trigger`, `triggers` and
    /// `regex`. Espanso expects exactly one.
    MatchHasSeveralTriggerForms,
    /// Rule 3. A variable has no `type` field, so no extension can evaluate it.
    VariableHasNoType,
    /// Rule 3. A variable's `type` names none of the nine types this crate
    /// knows.
    VariableTypeNotRecognised {
        /// The `type` field's text, exactly as the file writes it.
        declared: String,
    },
    /// Rule 3. A variable of a recognised type is missing the parameter that
    /// type has nothing to evaluate without.
    VariableMissingRequiredParam {
        /// The type the variable declares.
        kind: VariableKind,
        /// The parameter key that is absent. See [`required_param`] for where
        /// each entry of that table comes from.
        ///
        /// **Owned rather than `&'static str`**, even though every value this
        /// crate produces comes from that table. A borrowed static is a type
        /// `serde` cannot read *back* into, so it was the one field in the whole
        /// acknowledgement graph that made [`serde::Deserialize`] impossible to
        /// derive at all. Owning it removes that obstruction; whether an
        /// acknowledgement round-trips, and how, is still Phase 2b-2's decision
        /// (`docs/reviews/phase-2b-1-wire-boundary.md` section 1).
        param: String,
    },
    /// Rule 4. Two variables of one `vars` or `global_vars` sequence declare
    /// the same `name`. The finding is attached to the **later** one.
    DuplicateVariableName {
        /// The repeated name, as the file writes it.
        name: String,
    },
    /// Rule 5. A `{{reference}}` in a content field names something no
    /// variable of this document declares, **and** the set of names in scope
    /// was fully knowable from this document alone.
    ReferenceHasNoDeclaration {
        /// The referenced name, as the file writes it.
        name: String,
    },
    /// Rule 6. A `regex` trigger did not compile under **this crate's** `regex`
    /// version. See the module documentation for what that does and does not
    /// say about espanso's.
    RegexDoesNotCompile {
        /// The `regex` crate's own English diagnostic, carried verbatim.
        ///
        /// **Developer-facing, and never a user-facing string.** It is a third
        /// party's prose in one language; a localized message must be built
        /// from this variant and the pattern, not from this field.
        detail: String,
    },
    /// **Not a rule about espanso, and not [`validate`]'s.** The candidate text
    /// a whole-document replacement submitted is not YAML this crate can index.
    ///
    /// Produced only by [`crate::persist::save_document`]'s replacement mode.
    /// Every other content mode reaches the semantic gate with a candidate the
    /// patch engine has already reparsed, so the code is unreachable there by
    /// construction.
    ///
    /// **It is [`FindingClass::SuspiciousButPermitted`], which is what makes the
    /// owner's ruling both possible and safe.** The ruling is that a raw save may
    /// write text the YAML parser rejects — refusing would mean this application
    /// cannot repair an already-broken file, which is the most valuable thing a
    /// raw editor does. The classification is not a convenience granted to make
    /// that work: it is the honest one. This crate parses with `saphyr-parser`
    /// and espanso does not, so *this parser rejected the text* is a claim about
    /// this crate's substrate, never a proof that espanso will refuse the file —
    /// the same asymmetry [`FindingCode::RegexDoesNotCompile`] is documented
    /// with. The user is told, and confirms by content like any other suspicion.
    ///
    /// **[`Finding::span`] is `None` for it**, deliberately: a parse rejection is
    /// a *position*, not a range of bytes the finding is about, and an empty span
    /// would be a range claiming to be one. The position is these operands.
    ///
    /// **It names the candidate it is about, and that is what makes acknowledging
    /// it safe.** See the `revision` operand: a position and a message describe
    /// where a parser stopped, and two byte-distinct texts that share an invalid
    /// prefix stop it in exactly the same place with exactly the same message. The
    /// acknowledgement protocol matches findings as an exact multiset and knows
    /// nothing else about them, so without an operand naming the bytes, consent
    /// collected for one broken text would silently commit another.
    DocumentDoesNotParse {
        /// The [`ContentRevision`] of the **exact candidate** this finding is
        /// about.
        ///
        /// **The operand that binds an acknowledgement to one text.** The other
        /// three describe the parser's stopping point, and a stopping point is not
        /// an identity: `a: b: c\nfirst\n` and `a: b: c\nsecond\n` are different
        /// documents that fail at the same line, the same column, the same byte
        /// and with the same message. An [`crate::persist::Acknowledgement`] is a
        /// multiset of [`Finding`]s and has no other handle on *which* candidate
        /// the user agreed to, so equal findings would mean transferable consent.
        /// Hashing the candidate makes a different text a different finding, and
        /// the existing exact-multiset machinery does the rest with no new
        /// concept and no change to the protocol.
        ///
        /// **Never rendered.** It is an opaque digest, and no dictionary sentence
        /// names it — the same rule `detail` follows for a different reason.
        revision: ContentRevision,
        /// Line the parser stopped at, as the substrate reported it, or `None`
        /// when the failure carried no position — which is
        /// [`crate::syntax::SyntaxError::Offset`] or
        /// [`crate::syntax::SyntaxError::Invariant`], each a defect in this
        /// crate rather than a property of the text, and neither a reason to
        /// stop the user writing what they typed.
        line: Option<usize>,
        /// Column, as the substrate reported it, on the same terms as `line`.
        column: Option<usize>,
        /// The same position as a byte offset into the **submitted text**, when
        /// it could be converted.
        byte_index: Option<usize>,
        /// The parser's own diagnostic, carried verbatim.
        ///
        /// **Developer-facing, and never a user-facing string**, exactly as
        /// [`FindingCode::RegexDoesNotCompile`]'s is. No dictionary message
        /// interpolates it.
        detail: String,
    },
    /// **Not a rule about espanso, and not [`validate`]'s.** The save the
    /// caller requested inserts a byte-exact copy of an existing match, so the
    /// copy keeps the same trigger definition as its source — and this
    /// application cannot determine how espanso chooses between overlapping
    /// definitions.
    ///
    /// Produced only by [`crate::persist::save_document`] when a
    /// [`crate::patch::DocumentEdit::DuplicateItem`] batch's clone projects as a
    /// match with exactly one modelled trigger form (`Single`, `Multiple` or
    /// `Regex`). When the source has none or several, the editor-model findings
    /// [`FindingCode::MatchHasNoTriggerField`] and
    /// [`FindingCode::MatchHasSeveralTriggerForms`] already refuse the save
    /// outright, and this code deliberately stays silent rather than weakening
    /// that precedence.
    ///
    /// **It is [`FindingClass::SuspiciousButPermitted`], and its sentence is a
    /// claim about risk, never about espanso semantics** (D2u): a match trigger
    /// has no uniqueness rule in espanso's schema as this crate models it, so
    /// the finding must never say *invalid*, *will collide*, *will not work* or
    /// which match wins. The user is told, and confirms by content like any
    /// other suspicion — the exact-multiset acknowledgement round trip that
    /// [`FindingCode::DocumentDoesNotParse`] already travels.
    ///
    /// **It names the candidate it is about, and that is what makes
    /// acknowledging it safe** — [`FindingCode::DocumentDoesNotParse`]'s rule,
    /// learned again the same way. The [`Finding`] it rides in is attached to
    /// the clone's own candidate path, span and node, and this step first
    /// claimed that address was binding enough. It is not: rewrite the source
    /// trigger to another value of the **same byte length** and the new
    /// candidate's clone has the same path, the same span and the same
    /// freshly minted parser node number, so the recomputed finding would equal
    /// the retained one and consent collected for one clone would commit a
    /// byte-different other (the Phase 2c-3c-1 review's finding 1). The
    /// `revision` operand closes that: a different candidate is a different
    /// finding, and [`crate::persist::Acknowledgement`]'s exact-multiset match
    /// does the rest with no new concept.
    DuplicateKeepsTriggerDefinition {
        /// The [`ContentRevision`] of the **exact candidate** this finding is
        /// about — the whole document the clone sits in, not the clone alone.
        ///
        /// **Never rendered.** It is an opaque digest, and no dictionary
        /// sentence names it — the same rule
        /// [`FindingCode::DocumentDoesNotParse`]'s `revision` follows.
        revision: ContentRevision,
    },
    /// The newly created match repeats literal trigger text another match in the
    /// same destination sequence already writes.
    ///
    /// Produced only by [`crate::persist::save_document`], for a batch holding
    /// exactly one [`crate::patch::DocumentEdit::InsertItem`], when the item that
    /// insertion landed projects as a match exposing a **modelled literal**
    /// trigger text equal to one another match of that same sequence exposes.
    /// "Modelled literal" is `trigger:`, or a scalar entry of `triggers:`, whose
    /// text this crate decoded; a `regex:`, an entry it could not decode, and any
    /// trigger shape it does not model at all contribute nothing on either side,
    /// so no comparison is made and no finding is produced. When the new item has
    /// no trigger form or several, the editor-model findings
    /// [`FindingCode::MatchHasNoTriggerField`] and
    /// [`FindingCode::MatchHasSeveralTriggerForms`] already refuse the save
    /// outright, and this code stays silent rather than weakening that
    /// precedence.
    ///
    /// # It is a claim about text, and about risk — never about espanso (D2u)
    ///
    /// [`FindingClass::SuspiciousButPermitted`]. Espanso's schema, as this crate
    /// models it, has **no trigger-uniqueness rule**, so the finding may say only
    /// that the new snippet repeats literal trigger text already present and that
    /// this application cannot determine how espanso will handle overlapping
    /// definitions. It must never say *invalid*, *collision*, which snippet
    /// wins — or, in the other direction, that a *non*-repeating trigger is safe:
    /// two triggers that merely overlap, or that differ only in a plain scalar's
    /// YAML 1.1 reading, are outside what this comparison can see. The user is
    /// told, and confirms by content like any other suspicion.
    ///
    /// # It is not a validator rule, and it is not the duplicate's code
    ///
    /// Not a rule over every candidate: that would newly interrupt saves of
    /// unrelated edits to files this application never wrote, for a repetition
    /// the person did not just create. Not a check in the window either: a check
    /// only the UI performs is bypassed by every other caller of the command.
    /// It is produced inside the one entry point that writes, for insertions
    /// only, and it therefore reaches **ordinary creation** as well as the
    /// recovery route that motivated it — which is correct, because exact
    /// repetition is a property of the candidate rather than of the caller that
    /// built it.
    ///
    /// And it is a **new** code rather than a reuse of
    /// [`FindingCode::DuplicateKeepsTriggerDefinition`], which is produced only
    /// for a duplicate batch. The two sentences differ in what they claim was
    /// done, and one name covering both would make an acknowledgement of a
    /// duplicate readable as an acknowledgement of a creation.
    NewMatchRepeatsLiteralTrigger {
        /// The [`ContentRevision`] of the **exact candidate** this finding is
        /// about — the whole document the new item sits in, not the item alone.
        ///
        /// The same operand, for the same reason, as
        /// [`FindingCode::DuplicateKeepsTriggerDefinition`]'s: the new item's
        /// path, span and node are equal across a same-length rewrite of
        /// anything above it, so all three bind consent to a *shape* rather than
        /// to a text. With the revision, a different candidate is a different
        /// finding and [`crate::persist::Acknowledgement`]'s exact-multiset match
        /// does the rest with no new concept.
        ///
        /// **Never rendered.** It is an opaque digest, and no dictionary sentence
        /// names it.
        revision: ContentRevision,
    },
} // End of enum FindingCode

impl FindingCode {
    /// Every code this enum declares, by name.
    ///
    /// Paired with [`FindingCode::name`], whose `match` is exhaustive: adding a
    /// variant is a compile error there and a length error here, so a code no
    /// fixture reaches cannot hide.
    ///
    /// **Ten of the thirteen are [`validate`]'s**, and the other three —
    /// [`FindingCode::DocumentDoesNotParse`],
    /// [`FindingCode::DuplicateKeepsTriggerDefinition`] and
    /// [`FindingCode::NewMatchRepeatsLiteralTrigger`] — are the save
    /// transaction's. The reachability test that reads this table names all
    /// three explicitly rather than skipping any code it cannot produce.
    pub const ALL_NAMES: [&'static str; 13] = [
        "MatchHasNoContentField",
        "MatchHasSeveralContentFields",
        "MatchHasNoTriggerField",
        "MatchHasSeveralTriggerForms",
        "VariableHasNoType",
        "VariableTypeNotRecognised",
        "VariableMissingRequiredParam",
        "DuplicateVariableName",
        "ReferenceHasNoDeclaration",
        "RegexDoesNotCompile",
        "DocumentDoesNotParse",
        "DuplicateKeepsTriggerDefinition",
        "NewMatchRepeatsLiteralTrigger",
    ];

    /// A stable identifier for this code, without its operands.
    ///
    /// **Not a user-facing string** (plan section 9).
    pub fn name(&self) -> &'static str {
        match self {
            FindingCode::MatchHasNoContentField => "MatchHasNoContentField",
            FindingCode::MatchHasSeveralContentFields => "MatchHasSeveralContentFields",
            FindingCode::MatchHasNoTriggerField => "MatchHasNoTriggerField",
            FindingCode::MatchHasSeveralTriggerForms => "MatchHasSeveralTriggerForms",
            FindingCode::VariableHasNoType => "VariableHasNoType",
            FindingCode::VariableTypeNotRecognised { .. } => "VariableTypeNotRecognised",
            FindingCode::VariableMissingRequiredParam { .. } => "VariableMissingRequiredParam",
            FindingCode::DuplicateVariableName { .. } => "DuplicateVariableName",
            FindingCode::ReferenceHasNoDeclaration { .. } => "ReferenceHasNoDeclaration",
            FindingCode::RegexDoesNotCompile { .. } => "RegexDoesNotCompile",
            FindingCode::DocumentDoesNotParse { .. } => "DocumentDoesNotParse",
            FindingCode::DuplicateKeepsTriggerDefinition { .. } => {
                "DuplicateKeepsTriggerDefinition"
            }
            FindingCode::NewMatchRepeatsLiteralTrigger { .. } => "NewMatchRepeatsLiteralTrigger",
        }
    } // End of function name() for FindingCode

    /// How seriously a caller should take this code.
    ///
    /// **The classification lives here and nowhere else**, so a finding and its
    /// class cannot come to disagree — [`Finding`] has no class field, only
    /// [`Finding::class`], which delegates here.
    ///
    /// The boundary is one question: *does the claim rest on a vocabulary
    /// espanso can extend without telling us?*
    ///
    /// - the trigger and content rules are **structural** — "exactly one of
    ///   these" is a shape, not a list of names espanso grows — so they are
    ///   errors;
    /// - a missing required parameter is an error, because it is only reported
    ///   for a type this crate **recognised**, and each entry of
    ///   [`required_param`] is an observed failure path in espanso 2.3.0's own
    ///   extension sources;
    /// - an unrecognised `type` is **suspicious**: espanso adding a tenth
    ///   variable type is exactly the case where this crate would be wrong, and
    ///   flagging a working configuration as broken is the worse failure;
    /// - an unresolved `{{reference}}` is **suspicious**: espanso's renderer
    ///   does fail on one, but whether the name was really out of scope depends
    ///   on this crate's model of espanso's *scoping* rules — imports, form
    ///   synthesis, regex capture groups — which is a model, not a measurement.
    ///   [`validate`] already declines to report whenever it can see that the
    ///   scope is open; this class covers the case where it cannot see that;
    /// - a candidate that **does not parse** is **suspicious**, and that is the
    ///   honest classification rather than a lenient one: this crate parses with
    ///   `saphyr-parser` and espanso does not, so a rejection here is a fact
    ///   about this substrate. It is also the class that lets the owner's ruling
    ///   hold — a raw save may write such a text, once the user has been told
    ///   and has confirmed it by content;
    /// - a duplicate that **keeps its source's trigger definition** is
    ///   **suspicious**: espanso has no trigger-uniqueness rule this crate can
    ///   read, and how it chooses between overlapping definitions is not
    ///   something this application can determine. The finding is a claim about
    ///   risk, never about espanso semantics (D2u), and the user confirms it by
    ///   content like any other suspicion;
    /// - a newly created match that **repeats literal trigger text** already in
    ///   its destination sequence is **suspicious** for the same reason and by
    ///   the same rule: espanso has no trigger-uniqueness rule this crate can
    ///   read, so the finding claims repetition of text and the inability to
    ///   determine what espanso will do with overlapping definitions, and
    ///   nothing more.
    pub fn class(&self) -> FindingClass {
        match self {
            FindingCode::MatchHasNoContentField
            | FindingCode::MatchHasSeveralContentFields
            | FindingCode::MatchHasNoTriggerField
            | FindingCode::MatchHasSeveralTriggerForms
            | FindingCode::VariableHasNoType
            | FindingCode::VariableMissingRequiredParam { .. }
            | FindingCode::DuplicateVariableName { .. }
            | FindingCode::RegexDoesNotCompile { .. } => FindingClass::EditorModelError,
            FindingCode::VariableTypeNotRecognised { .. }
            | FindingCode::ReferenceHasNoDeclaration { .. }
            | FindingCode::DocumentDoesNotParse { .. }
            | FindingCode::DuplicateKeepsTriggerDefinition { .. }
            | FindingCode::NewMatchRepeatsLiteralTrigger { .. } => {
                FindingClass::SuspiciousButPermitted
            }
        }
    } // End of function class() for FindingCode
} // End of impl FindingCode

impl fmt::Display for FindingCode {
    /// A developer rendering, for logs and test output. Never shown to a user.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FindingCode::VariableTypeNotRecognised { declared } => {
                write!(formatter, "variable type {declared:?} is not recognised")
            }
            FindingCode::VariableMissingRequiredParam { kind, param } => {
                write!(formatter, "{kind:?} variable has no {param:?} parameter")
            }
            FindingCode::DuplicateVariableName { name } => {
                write!(formatter, "variable name {name:?} is declared twice")
            }
            FindingCode::ReferenceHasNoDeclaration { name } => {
                write!(formatter, "reference {name:?} has no declaration")
            }
            FindingCode::RegexDoesNotCompile { detail } => {
                write!(formatter, "regex does not compile: {detail}")
            }
            FindingCode::DocumentDoesNotParse {
                line,
                column,
                detail,
                ..
            } => match (line, column) {
                (Some(line), Some(column)) => write!(
                    formatter,
                    "the submitted text does not parse at line {line} column {column}: {detail}"
                ),
                _ => write!(formatter, "the submitted text does not parse: {detail}"),
            },
            other => formatter.write_str(other.name()),
        }
    } // End of function fmt() for FindingCode
}

/// One thing [`validate`] noticed about a document.
///
/// Shaped like [`crate::model::Diagnostic`] on purpose — a code, the bytes it
/// is about, the node, and the path that addresses it — so a caller that
/// already renders diagnostics has nothing new to learn. It is a separate type
/// because a diagnostic describes *the file as read* and a finding describes
/// *a candidate about to be written*. Both are on the wire; only the diagnostic
/// is ever produced by a read.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Finding {
    /// What was noticed.
    pub code: FindingCode,
    /// The bytes it is about, when it is about bytes.
    pub span: Option<ByteSpan>,
    /// The node it is about, when one is identifiable.
    pub node: Option<NodeId>,
    /// The path naming that node, when it has one.
    pub path: Option<DocumentPath>,
}

impl Finding {
    /// How seriously a caller should take this finding.
    ///
    /// Delegates to [`FindingCode::class`]; there is no stored class to fall
    /// out of step with the code.
    pub fn class(&self) -> FindingClass {
        self.code.class()
    }
}

/// The parameter a variable of `kind` has nothing to evaluate without.
///
/// **Every entry is an observed failure path in espanso 2.3.0's own extension
/// sources**, not a reading of the documentation:
///
/// | Type | Parameter | Espanso's message when it is absent |
/// |---|---|---|
/// | `choice` | `values` | *missing values parameter* |
/// | `random` | `choices` | *missing 'choices' parameter* |
/// | `echo` | `echo` | *missing 'echo' parameter* |
/// | `shell` | `cmd` | *missing 'cmd' parameter* |
/// | `script` | `args` | *missing 'args' parameter* |
/// | `form` | `layout` | *missing layout parameter* |
/// | `match` | `trigger` | `RendererError::MissingSubMatch` |
///
/// **The `match` row is not an extension failure**, and that is why it took
/// separate evidence. `match` is not one of espanso 2.3.0's eight registered
/// render extensions; it is resolved earlier, in the renderer itself. At
/// `v2.3.0`, `espanso-render/src/renderer/mod.rs` handles `var_type == "match"`
/// before the extension lookup and calls `get_matching_template`, whose first
/// statement is `let id = variable.params.get("trigger")?;`. A variable with no
/// `params.trigger` makes that function return `None`, and the renderer's
/// answer to `None` is `error!("unable to find sub-match: …")` followed by
/// `RenderResult::Error(RendererError::MissingSubMatch.into())`. That is the
/// same shape of evidence as every other row: an observed failure path in
/// espanso's own source, not a reading of its documentation. Plan section 3.4
/// named this parameter; the source is what makes requiring it a measurement
/// rather than a prophecy.
///
/// Two types are deliberately absent from the table:
///
/// - **`date`** requires nothing. Espanso's own documentation table calls
///   `format` required; its source does not — with no `format` the extension
///   returns RFC 2822. The source wins, and a rule built on the documentation
///   would fire on a working configuration;
/// - **`clipboard`** takes no parameters at all.
///
/// A variable is evaluated whether or not the body references it: espanso's
/// `generate_nodes` in `espanso-render/src/renderer/resolve.rs` makes the body
/// node depend on **every** local variable. So a missing required parameter is
/// a failure of the whole render, not only of the templates that mention the
/// variable.
pub fn required_param(kind: VariableKind) -> Option<&'static str> {
    match kind {
        VariableKind::Choice => Some("values"),
        VariableKind::Random => Some("choices"),
        VariableKind::Echo => Some("echo"),
        VariableKind::Shell => Some("cmd"),
        VariableKind::Script => Some("args"),
        VariableKind::Form => Some("layout"),
        VariableKind::Match => Some("trigger"),
        VariableKind::Date
        | VariableKind::Clipboard
        | VariableKind::Unrecognised
        | VariableKind::Absent => None,
    }
} // End of function required_param()

/// Reports every espanso-semantic finding of `view`, grouped by match in
/// document order.
///
/// Within one match the order is by rule rather than by byte offset, so two
/// findings about the same match arrive in a fixed sequence that does not
/// depend on how the match's keys are written.
///
/// **Pure**: same projection in, same findings out, no I/O and no interior
/// mutability. An empty result means *this pass found nothing*, which is not
/// the same as *this document is fine* — the module documentation lists the two
/// of plan section 6.6's four diagnostic classes that other layers own.
///
/// A document the substrate rejected projects to no matches, so it yields no
/// findings here. That is deliberate and is why step 4 exists.
///
/// **Cost is linear in the document.** Name lookups go through hash sets and
/// the global name set is built once, not once per match: this runs inside the
/// save lock (2a-1 notes section 12), where a document that made it quadratic
/// would make saving look hung.
pub fn validate(view: &DocumentView) -> Vec<Finding> {
    let mut findings = Vec::new();
    let globals = declared_names(&view.global_vars);
    check_variables(&view.global_vars, &mut findings);
    for entry in &view.matches {
        check_trigger_side(entry, &mut findings);
        check_content_side(entry, &mut findings);
        check_variables(&entry.vars, &mut findings);
        let captures = check_regex(entry, &mut findings);
        check_references(view, entry, &globals, captures.as_deref(), &mut findings);
    } // End of the loop over the document's matches
    findings
} // End of function validate()

/// Rule 2 — exactly one of `trigger`, `triggers` and `regex`.
///
/// Reads [`crate::model::TriggerKind`] rather than recounting the fields: the
/// projection already decides which fields were **modelled**, and a `trigger`
/// holding a sequence is an unknown entry rather than a trigger form. Counting
/// again here would be a second opinion that could disagree with the one the
/// browser shows.
fn check_trigger_side(entry: &MatchView, findings: &mut Vec<Finding>) {
    let code = match entry.trigger.kind {
        TriggerKind::Absent => Some(FindingCode::MatchHasNoTriggerField),
        TriggerKind::Several => Some(FindingCode::MatchHasSeveralTriggerForms),
        TriggerKind::Single | TriggerKind::Multiple | TriggerKind::Regex => None,
    };
    if let Some(code) = code {
        findings.push(at_match(entry, code));
    }
} // End of function check_trigger_side()

/// Rule 1 — exactly one of the five content fields.
fn check_content_side(entry: &MatchView, findings: &mut Vec<Finding>) {
    let code = match entry.content.kind {
        ContentKind::Absent => Some(FindingCode::MatchHasNoContentField),
        ContentKind::Several => Some(FindingCode::MatchHasSeveralContentFields),
        ContentKind::Replace
        | ContentKind::Markdown
        | ContentKind::Html
        | ContentKind::ImagePath
        | ContentKind::Form => None,
    };
    if let Some(code) = code {
        findings.push(at_match(entry, code));
    }
} // End of function check_content_side()

/// Rules 3 and 4 over one `vars` or `global_vars` sequence.
///
/// The two rules share a walk because both are per-sequence: uniqueness is
/// scoped to one sequence, so a match-local variable shadowing a global one is
/// **not** a duplicate — that is how espanso is used, not a mistake.
/// A hash set rather than a list scanned linearly: a document is allowed to be
/// adversarial and this runs while the save lock is held.
fn check_variables(variables: &[VariableView], findings: &mut Vec<Finding>) {
    let mut seen: HashSet<&str> = HashSet::new();
    for variable in variables {
        check_variable_type(variable, findings);
        let Some(name) = &variable.name else {
            continue;
        };
        if !seen.insert(name.text.as_str()) {
            findings.push(at_variable(
                variable,
                FindingCode::DuplicateVariableName {
                    name: name.text.clone(),
                },
            ));
        }
    } // End of the loop over the sequence's variables
} // End of function check_variables()

/// Rule 3 for one variable — a known type, and the parameter it needs.
fn check_variable_type(variable: &VariableView, findings: &mut Vec<Finding>) {
    match variable.kind {
        VariableKind::Absent => {
            findings.push(at_variable(variable, FindingCode::VariableHasNoType));
            return;
        }
        VariableKind::Unrecognised => {
            let declared = variable
                .declared_type
                .as_ref()
                .map(|scalar| scalar.text.clone())
                .unwrap_or_default();
            findings.push(at_variable(
                variable,
                FindingCode::VariableTypeNotRecognised { declared },
            ));
            return;
        }
        _ => {}
    }

    let Some(param) = required_param(variable.kind) else {
        return;
    };
    if !params_are_readable(variable) {
        return;
    }
    let present = variable
        .params
        .iter()
        .filter_map(|field| field.key.as_ref())
        .any(|key| key.text == param);
    if !present {
        findings.push(at_variable(
            variable,
            FindingCode::VariableMissingRequiredParam {
                kind: variable.kind,
                param: param.to_owned(),
            },
        ));
    }
} // End of function check_variable_type()

/// Whether the absence of a key from this variable's parameters is a fact
/// rather than a gap in what this crate read.
///
/// The projection records a `params` it did not descend into as an unknown
/// entry, and [`crate::model::UnknownEntry::value_kind`] says what that value
/// was. That distinction is the whole of this predicate, because the two shapes
/// answer the question differently:
///
/// - a **scalar** or a **sequence** `params` provably holds no mapping entry
///   under any key at all, so the required parameter really is absent. Espanso
///   agrees on the shape: `YAMLVariable::params` is a `Mapping` at `v2.3.0`
///   (`espanso-config/src/matches/group/loader/yaml/parse.rs`), so such a file
///   does not even deserialize;
/// - an **alias** — `params: *defaults` — points at a node defined elsewhere in
///   the document, which may well be a mapping holding the key. Nothing read
///   it, so nothing may report on it. Anything else the projection could record
///   is treated the same way, conservatively.
///
/// The second gap is the YAML merge key `<<` inside a `params` mapping that
/// *was* read: it takes entries from an anchor defined elsewhere, so the
/// visible keys are not all the keys.
fn params_are_readable(variable: &VariableView) -> bool {
    let unreadable_shape = variable.unknown_entries.iter().any(|entry| {
        entry.key.as_deref() == Some("params")
            && !matches!(entry.value_kind, ValueKind::Scalar | ValueKind::Sequence)
    });
    let merged = variable
        .params
        .iter()
        .filter_map(|field| field.key.as_ref())
        .any(|key| key.text == MERGE_KEY);
    !unreadable_shape && !merged
} // End of function params_are_readable()

/// Rule 6 — the `regex` trigger compiles.
///
/// Returns the pattern's named capture groups, which rule 5 needs because
/// espanso turns `(?P<name>…)` into a `{{name}}` a template may reference.
/// `None` means *the name set is not knowable*: either the pattern did not
/// compile, in which case its groups cannot be read, or — for a match with no
/// `regex` at all — `Some(empty)` is returned instead, which is a different
/// answer.
fn check_regex(entry: &MatchView, findings: &mut Vec<Finding>) -> Option<Vec<String>> {
    let Some(pattern) = &entry.trigger.regex else {
        return Some(Vec::new());
    };
    match Regex::new(&pattern.text) {
        Ok(compiled) => Some(
            compiled
                .capture_names()
                .flatten()
                .map(str::to_owned)
                .collect(),
        ),
        Err(error) => {
            findings.push(Finding {
                code: FindingCode::RegexDoesNotCompile {
                    detail: error.to_string(),
                },
                span: Some(pattern.span),
                node: Some(pattern.node),
                path: field_path(entry, "regex"),
            });
            None
        }
    }
} // End of function check_regex()

/// Rule 5 — `{{references}}` that resolve, **where statically knowable**.
///
/// The qualifier is the whole rule. A reference is only reported when the set
/// of names in scope is *closed*: see [`closed_name_scope`], which lists every
/// way this crate can tell that it is not.
///
/// **Two surfaces are scanned**, because espanso renders both:
///
/// - the match's `replace`, `markdown` and `html`, whose references become
///   dependencies of the body node in `resolve_evaluation_order`;
/// - the **parameter values of the match's own variables**, when injection is
///   enabled — see [`check_parameter_references`]. A `{{missing}}` in a shell
///   variable's `cmd` fails espanso's dependency resolution exactly as one in
///   the body does.
fn check_references(
    view: &DocumentView,
    entry: &MatchView,
    globals: &HashSet<&str>,
    captures: Option<&[String]>,
    findings: &mut Vec<Finding>,
) {
    let Some(scope) = closed_name_scope(view, entry, globals, captures) else {
        return;
    };
    let Some(pattern) = reference_pattern() else {
        return;
    };
    for (key, scalar) in rendered_content(entry) {
        report_unresolved(pattern, &scope, scalar, field_path(entry, key), findings);
    }
    for variable in &entry.vars {
        check_parameter_references(pattern, &scope, variable, findings);
    }
} // End of function check_references()

/// Reports every reference of one scalar that `scope` cannot account for.
fn report_unresolved(
    pattern: &Regex,
    scope: &NameScope<'_>,
    scalar: &ScalarView,
    path: Option<DocumentPath>,
    findings: &mut Vec<Finding>,
) {
    for capture in pattern.captures_iter(&scalar.text) {
        let Some(name) = capture.name("name") else {
            continue;
        };
        if scope.contains(name.as_str()) {
            continue;
        }
        findings.push(Finding {
            code: FindingCode::ReferenceHasNoDeclaration {
                name: name.as_str().to_owned(),
            },
            span: Some(scalar.span),
            node: Some(scalar.node),
            path: path.clone(),
        });
    } // End of the loop over one scalar's references
} // End of function report_unresolved()

/// Rule 5 over one variable's **parameter values**.
///
/// Espanso substitutes `{{name}}` inside a variable's parameters — see
/// `inject_variables_into_params` in `espanso-render/src/renderer/util.rs` at
/// `v2.3.0`, which recurses into arrays and objects and calls the same
/// `render_variables` the body uses. A name it cannot find is not passed
/// through: `generate_nodes` in the same crate's `resolve.rs` adds every
/// parameter reference to the variable's dependencies, and an unresolvable
/// dependency is `RendererError::MissingVariable`.
///
/// **Only values, never keys.** Espanso's `get_params_variable_names` walks
/// `params.values()` and, inside an object, `fields.values()`; a key holding a
/// brace pair is not a reference to it, so it is not one here either.
///
/// **Only when injection is on**, which is the guard
/// [`injection_is_certainly_enabled`] applies: with `inject_vars: false` the
/// renderer passes the parameters through untouched, so `{{missing}}` is
/// literal text and reporting it would fire on a working configuration.
///
/// An alias or an elided value inside the parameters is simply not walked.
/// That is a false negative and never a false positive: names are declared by
/// `vars`, not by parameters, so text this crate did not read cannot turn a
/// reference it *did* read into a resolved one.
fn check_parameter_references(
    pattern: &Regex,
    scope: &NameScope<'_>,
    variable: &VariableView,
    findings: &mut Vec<Finding>,
) {
    if !injection_is_certainly_enabled(variable) {
        return;
    }
    let base = variable.path.clone().map(|path| path.with_key("params"));
    for field in &variable.params {
        let path = match &field.key {
            Some(key) => base.clone().map(|path| path.with_key(key.text.clone())),
            None => None,
        };
        scan_value_references(pattern, scope, &field.value, path, findings);
    } // End of the loop over one variable's parameters
} // End of function check_parameter_references()

/// Walks one parameter value, reporting the references of every scalar in it.
///
/// The recursion mirrors espanso's `get_value_variable_names_recursively`:
/// strings are scanned, arrays and objects are descended into by **value**, and
/// anything else contributes nothing. Depth is bounded by the projection's own
/// [`crate::model::MAX_VALUE_DEPTH`], past which a value is elided.
fn scan_value_references(
    pattern: &Regex,
    scope: &NameScope<'_>,
    value: &ValueView,
    path: Option<DocumentPath>,
    findings: &mut Vec<Finding>,
) {
    match value {
        ValueView::Scalar(scalar) => report_unresolved(pattern, scope, scalar, path, findings),
        ValueView::Sequence(items) => {
            for (position, item) in items.iter().enumerate() {
                let child = path.clone().map(|path| path.with_index(position));
                scan_value_references(pattern, scope, item, child, findings);
            }
        } // End of the sequence arm
        ValueView::Mapping(fields) => {
            for field in fields {
                let child = match &field.key {
                    Some(key) => path.clone().map(|path| path.with_key(key.text.clone())),
                    None => None,
                };
                scan_value_references(pattern, scope, &field.value, child, findings);
            }
        } // End of the mapping arm
        ValueView::Alias(_) | ValueView::Elided { .. } => {}
    } // End of the match over the parameter value's shape
} // End of function scan_value_references()

/// Whether espanso will certainly substitute variables into this variable's
/// parameters.
///
/// `inject_vars` defaults to **true** — `espanso-config`'s
/// `try_convert_into_variable` at `v2.3.0` writes
/// `yaml_var.inject_vars.unwrap_or(true)` — so an absent field means injection
/// is on. When the field *is* written, this crate reads its **source text**
/// (D2u: nothing here resolves a YAML type), and answers `true` only for the
/// spellings it recognises as true. Any other text, `false` included, is
/// treated as injection off, which is the direction that stays silent.
fn injection_is_certainly_enabled(variable: &VariableView) -> bool {
    let Some(written) = &variable.inject_vars else {
        return true;
    };
    let text = written.text.trim();
    text.eq_ignore_ascii_case("true")
        || text.eq_ignore_ascii_case("yes")
        || text.eq_ignore_ascii_case("on")
} // End of function injection_is_certainly_enabled()

/// The content fields espanso runs through its renderer, with their keys.
///
/// `image_path` is **not** one of them: it names a file rather than a template.
/// `form` is not one either — espanso's loader turns a `form:` shorthand into a
/// synthesised `form1` variable **and a rewritten `replace`**, so the field
/// itself is never a template.
fn rendered_content(entry: &MatchView) -> Vec<(&'static str, &ScalarView)> {
    let mut out = Vec::new();
    if let Some(scalar) = &entry.content.replace {
        out.push(("replace", scalar));
    }
    if let Some(scalar) = &entry.content.markdown {
        out.push(("markdown", scalar));
    }
    if let Some(scalar) = &entry.content.html {
        out.push(("html", scalar));
    }
    out
} // End of function rendered_content()

/// The names a template inside one match may reference.
///
/// Three sets rather than one merged list, so that the document's global names
/// are borrowed once for the whole document instead of copied per match.
struct NameScope<'a> {
    /// Every `global_vars` name of the document.
    globals: &'a HashSet<&'a str>,
    /// Every `vars` name of this match.
    locals: HashSet<&'a str>,
    /// Every named capture group of this match's `regex`.
    captures: HashSet<&'a str>,
}

impl NameScope<'_> {
    /// Whether some declaration in scope carries `name`.
    fn contains(&self, name: &str) -> bool {
        self.globals.contains(name) || self.locals.contains(name) || self.captures.contains(name)
    }
}

/// Every name a template inside `entry` may reference, or `None` when this
/// crate cannot see the whole set.
///
/// Reporting an unresolved reference is only honest when the answer is
/// complete, so the scope is declared **open** — and rule 5 declines to say
/// anything at all — whenever any of these holds:
///
/// - the document has `imports`, which bring another file's `global_vars` in;
/// - the document's `global_vars`, or the match's `vars`, was recorded as an
///   unknown entry rather than projected, so its members were never read;
/// - the match has a `regex` that did not compile, so its capture groups —
///   which espanso turns into references — could not be read.
///
/// # Four openers this list used to have, and the source that removed them
///
/// Each of these was a guess about espanso's scoping that
/// `espanso-render/src/renderer/mod.rs` at `v2.3.0` answers directly, and each
/// suppressed rule 5 for a whole match without introducing any name:
///
/// - **a variable setting `inject_vars`.** The field decides whether the
///   variable's own *parameters* get substitution
///   (`if variable.inject_vars { inject_variables_into_params(…) }`); it puts
///   nothing into the template's scope. `inject_vars: false` least of all —
///   it is the branch that disables substitution;
/// - **a `type: match` variable.** The renderer's recursive branch inserts
///   exactly one entry, `scope.insert(&variable.name, …)`. The sub-match is
///   rendered by a separate `render` call with a separate scope, so its
///   variables are not visible to the outer template;
/// - **a `type: form` variable.** The form extension returns an
///   `ExtensionOutput::Multiple`, stored under the variable's own name; a
///   `{{f.who}}` resolves because `f` is declared, which this crate already
///   sees — the reference pattern's `name` capture stops at the dot;
/// - **a variable with no `name`.** It cannot declare one. Espanso is
///   stricter still: `YAMLVariable::name` has no serde default, so a variable
///   without a name makes the whole file fail to load.
///
/// A fifth suppression went with them: the match having a shorthand `form:`
/// **beside** a `replace`. Espanso's loader takes the first of
/// `replace`/`markdown`/`html` and only falls through to `form` when none is
/// present, so in that shape no `form1` variable is synthesised at all.
fn closed_name_scope<'a>(
    view: &'a DocumentView,
    entry: &'a MatchView,
    globals: &'a HashSet<&'a str>,
    captures: Option<&'a [String]>,
) -> Option<NameScope<'a>> {
    let captures = captures?;
    if !view.imports.is_empty() {
        return None;
    }
    if unknown_key(&view.unknown_entries, "global_vars")
        || unknown_key(&view.unknown_entries, "imports")
        || unknown_key(&entry.unknown_entries, "vars")
    {
        return None;
    }
    Some(NameScope {
        globals,
        locals: declared_names(&entry.vars),
        captures: captures.iter().map(String::as_str).collect(),
    })
} // End of function closed_name_scope()

/// Whether `entries` holds an unknown entry under `key`.
fn unknown_key(entries: &[crate::model::UnknownEntry], key: &str) -> bool {
    entries
        .iter()
        .any(|entry| entry.key.as_deref() == Some(key))
}

/// The `name` text of every variable of a sequence that has one.
///
/// Borrowed, not cloned, and a set rather than a list: every reference of every
/// match asks this set a question.
fn declared_names(variables: &[VariableView]) -> HashSet<&str> {
    variables
        .iter()
        .filter_map(|variable| variable.name.as_ref())
        .map(|name| name.text.as_str())
        .collect()
}

/// A finding about a whole match.
fn at_match(entry: &MatchView, code: FindingCode) -> Finding {
    Finding {
        code,
        span: Some(entry.span),
        node: Some(entry.source_node),
        path: entry.path.clone(),
    }
}

/// A finding about a whole variable.
fn at_variable(variable: &VariableView, code: FindingCode) -> Finding {
    Finding {
        code,
        span: Some(variable.span),
        node: Some(variable.node),
        path: variable.path.clone(),
    }
}

/// The path naming one field of a match, when the match itself has a path.
fn field_path(entry: &MatchView, key: &str) -> Option<DocumentPath> {
    entry.path.clone().map(|path| path.with_key(key))
}

/// The compiled [`REFERENCE_PATTERN`], or `None` if it did not build.
///
/// The pattern is a constant, so `None` can only mean a defect in this file
/// rather than a property of any document — and
/// `the_reference_pattern_compiles` fails the build before that could reach a
/// user. Answering `None` rather than panicking is what keeps [`validate`]
/// total on every input, which is this crate's standing rule.
fn reference_pattern() -> Option<&'static Regex> {
    static COMPILED: OnceLock<Option<Regex>> = OnceLock::new();
    COMPILED
        .get_or_init(|| Regex::new(REFERENCE_PATTERN).ok())
        .as_ref()
}

#[cfg(test)]
mod tests {
    use super::{
        injection_is_certainly_enabled, reference_pattern, required_param, FindingClass,
        FindingCode, REFERENCE_PATTERN,
    };
    use crate::model::{ScalarView, VariableKind, VariableView};
    use crate::syntax::{ByteSpan, NodeId, ScalarStyle};

    /// The constant pattern really compiles, so [`reference_pattern`]'s `None`
    /// arm can never be reached in a shipped build.
    #[test]
    fn the_reference_pattern_compiles() {
        assert!(
            reference_pattern().is_some(),
            "REFERENCE_PATTERN must compile: {REFERENCE_PATTERN}"
        );
    }

    /// The transcribed pattern behaves as this crate assumed when it was
    /// transcribed.
    ///
    /// **This is not a parity check.** Espanso is not invoked, no independent
    /// oracle is consulted, and the expectations below were written by hand
    /// beside the code they check. A mistranscription that happens to agree on
    /// these strings and disagrees on some other whitespace, Unicode or brace
    /// arrangement passes. What it does establish is that the constant in this
    /// file reads a name where this module's rules assume it does — and, in the
    /// half that matters for false positives, that it declines to.
    /// `the_reference_pattern_agrees_with_espansos_own_unit_tests` is the
    /// weaker-but-independent companion.
    #[test]
    fn the_reference_pattern_reads_the_names_this_crate_transcribed_it_for() {
        let pattern = reference_pattern().expect("the pattern compiles");
        let name_of = |text: &str| {
            pattern
                .captures(text)
                .and_then(|capture| capture.name("name").map(|found| found.as_str().to_owned()))
        };
        assert_eq!(name_of("{{greeting}}"), Some("greeting".to_owned()));
        assert_eq!(name_of("x {{ greeting }} y"), Some("greeting".to_owned()));
        assert_eq!(name_of("{{form1.city}}"), Some("form1".to_owned()));
        // A hyphen is outside `\w`, so espanso leaves this text alone and so
        // must this module.
        assert_eq!(name_of("{{ not-a-name }}"), None);
        assert_eq!(name_of("{ single }"), None);
        assert_eq!(name_of("{{}}"), None);
    } // End of function the_reference_pattern_reads_the_names_this_crate_transcribed_it_for()

    /// The pattern reads the names **espanso's own tests** say it reads.
    ///
    /// The inputs and the expected name sets below are transcribed from the
    /// tests espanso ships beside `VAR_REGEX` — `get_body_variable_names_no_vars`
    /// and `get_body_variable_names_multiple_vars` in
    /// `espanso-render/src/renderer/util.rs` at `v2.3.0` — so the expectations
    /// were written by espanso's authors rather than by this crate's. That is a
    /// genuinely independent oracle, and it is a **narrow** one: two cases, and
    /// neither of them exercises a dotted name, a Unicode name or an unusual
    /// brace arrangement. It bounds the transcription risk; it does not close
    /// it (`docs/decisions/2a-2a-notes.md` section 10).
    #[test]
    fn the_reference_pattern_agrees_with_espansos_own_unit_tests() {
        let pattern = reference_pattern().expect("the pattern compiles");
        let names_of = |text: &str| {
            let mut found: Vec<String> = pattern
                .captures_iter(text)
                .filter_map(|capture| capture.name("name").map(|m| m.as_str().to_owned()))
                .collect();
            found.sort_unstable();
            found.dedup();
            found
        };
        assert_eq!(names_of("no variables"), Vec::<String>::new());
        assert_eq!(
            names_of("hello {{world}} name {{greet}}"),
            vec!["greet".to_owned(), "world".to_owned()]
        );
    } // End of function the_reference_pattern_agrees_with_espansos_own_unit_tests()

    /// Every code has a name, every name is in the table, and the table has no
    /// spare rows.
    #[test]
    fn the_code_name_table_matches_the_codes() {
        let codes = [
            FindingCode::MatchHasNoContentField,
            FindingCode::MatchHasSeveralContentFields,
            FindingCode::MatchHasNoTriggerField,
            FindingCode::MatchHasSeveralTriggerForms,
            FindingCode::VariableHasNoType,
            FindingCode::VariableTypeNotRecognised {
                declared: String::new(),
            },
            FindingCode::VariableMissingRequiredParam {
                kind: VariableKind::Shell,
                param: "cmd".to_owned(),
            },
            FindingCode::DuplicateVariableName {
                name: String::new(),
            },
            FindingCode::ReferenceHasNoDeclaration {
                name: String::new(),
            },
            FindingCode::RegexDoesNotCompile {
                detail: String::new(),
            },
            FindingCode::DocumentDoesNotParse {
                revision: crate::ContentRevision::of_bytes(b""),
                line: None,
                column: None,
                byte_index: None,
                detail: String::new(),
            },
            FindingCode::DuplicateKeepsTriggerDefinition {
                revision: crate::ContentRevision::of_bytes(b""),
            },
            FindingCode::NewMatchRepeatsLiteralTrigger {
                revision: crate::ContentRevision::of_bytes(b""),
            },
        ];
        let names: Vec<&str> = codes.iter().map(FindingCode::name).collect();
        assert_eq!(names, FindingCode::ALL_NAMES.to_vec());
    } // End of function the_code_name_table_matches_the_codes()

    /// Both classes are named, and the two names differ.
    #[test]
    fn every_class_has_a_distinct_name() {
        let mut names: Vec<&str> = FindingClass::ALL.iter().map(|c| c.name()).collect();
        let before = names.len();
        names.sort_unstable();
        names.dedup();
        assert_eq!(names.len(), before);
    }

    /// The required-parameter table says nothing about the two types espanso
    /// 2.3.0 shows require nothing, nor about the two non-types.
    #[test]
    fn the_types_that_require_nothing_require_nothing() {
        assert_eq!(required_param(VariableKind::Date), None);
        assert_eq!(required_param(VariableKind::Clipboard), None);
        assert_eq!(required_param(VariableKind::Unrecognised), None);
        assert_eq!(required_param(VariableKind::Absent), None);
    }

    /// The seven types that do require one, with the key espanso names.
    #[test]
    fn the_required_parameter_table_is_the_one_espanso_2_3_0_enforces() {
        assert_eq!(required_param(VariableKind::Choice), Some("values"));
        assert_eq!(required_param(VariableKind::Random), Some("choices"));
        assert_eq!(required_param(VariableKind::Echo), Some("echo"));
        assert_eq!(required_param(VariableKind::Shell), Some("cmd"));
        assert_eq!(required_param(VariableKind::Script), Some("args"));
        assert_eq!(required_param(VariableKind::Form), Some("layout"));
        // Not an extension failure but a renderer one: `get_matching_template`
        // returns `None` without it, and the renderer answers that with
        // `RendererError::MissingSubMatch`. See `required_param`.
        assert_eq!(required_param(VariableKind::Match), Some("trigger"));
    } // End of function the_required_parameter_table_is_the_one_espanso_2_3_0_enforces()

    /// Injection is on unless the file turns it off, because espanso's own
    /// default is `inject_vars.unwrap_or(true)`.
    ///
    /// The `false` side is the one that matters: it is what stops rule 5 from
    /// reading a parameter espanso passes through as literal text.
    #[test]
    fn injection_is_on_by_default_and_off_when_the_file_says_so() {
        assert!(injection_is_certainly_enabled(&variable_with_inject_vars(
            None
        )));
        for written in ["true", "True", "TRUE", "yes", "on", " true "] {
            assert!(
                injection_is_certainly_enabled(&variable_with_inject_vars(Some(written))),
                "{written:?} must read as injection on"
            );
        }
        for written in ["false", "False", "no", "off", "0", "", "maybe"] {
            assert!(
                !injection_is_certainly_enabled(&variable_with_inject_vars(Some(written))),
                "{written:?} must not read as injection on"
            );
        }
    } // End of function injection_is_on_by_default_and_off_when_the_file_says_so()

    /// A variable carrying nothing but the `inject_vars` text under test.
    fn variable_with_inject_vars(written: Option<&str>) -> VariableView {
        VariableView {
            node: NodeId::from_index(0),
            path: None,
            span: ByteSpan::new(0, 0),
            name: None,
            declared_type: None,
            kind: VariableKind::Echo,
            params: Vec::new(),
            depends_on: Vec::new(),
            inject_vars: written.map(scalar_of),
            unknown_entries: Vec::new(),
        }
    } // End of function variable_with_inject_vars()

    /// A scalar view holding `text` and nothing else that matters here.
    fn scalar_of(text: &str) -> ScalarView {
        ScalarView {
            text: text.to_owned(),
            decoded: true,
            style: ScalarStyle::Plain,
            span: ByteSpan::new(0, 0),
            node: NodeId::from_index(0),
            ambiguous_yaml_1_1: false,
        }
    }
}
