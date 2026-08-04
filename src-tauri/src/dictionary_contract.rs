//! The check that every Rust code the interface can meet has a sentence.
//!
//! Plan section 9 says Rust returns *codes and structured data, never prose*.
//! That rule only works if the other end has prose for every code: a variant
//! added to `DiagnosticCode` and forgotten in `en.json` reaches a screen as
//! nothing at all, and nothing in Phase 1b-2a would have noticed —
//! `1b-2a-notes.md` section 9, hole 4, names this module as the thing that
//! closes it.
//!
//! It is compiled only for tests. It **parses** the enum declarations out of the
//! core's own source and out of `src-tauri/src/error.rs` (`crate::rust_source`),
//! applies the naming formula below, and compares the result against the `code.`
//! keys of `src/lib/i18n/en.json` and `es.json` **in both directions**. A variant
//! with no key fails, and a key naming no variant fails — a stale key left
//! behind by a rename is the same defect seen from the other side, and it is the
//! direction a hand-written list of expected keys would never catch.
//!
//! # The naming formula
//!
//! `code.<enum>.<variant>`, where each name has its first letter lowercased and
//! is otherwise unchanged. `DiagnosticCode::ParseFailed` is
//! `code.diagnosticCode.parseFailed`; `CommandError::NotUtf8` is
//! `code.commandError.notUtf8`. The frontend applies the same formula in
//! `src/lib/i18n/codes.ts`, where TypeScript's `Uncapitalize<…>` makes it a
//! compile-time check for the enums the wire types mirror. This module covers
//! the ones they do not, and covers the surplus direction for all of them.
//!
//! The namespace is **derived** from the enum's own name rather than written
//! beside it, so [`CODE_ENUMS`] has no second spelling that could disagree with
//! the first.
//!
//! # Reading source text, not linking against it
//!
//! The core enums are read as **text**. `espansoconfig-core` must never depend
//! on tauri (CLAUDE.md section 3), and the dependency edge that matters runs the
//! other way, so this crate could have imported them — but half the enums here
//! are matched by a hand-written sample list somewhere, and a check built from a
//! sample list is a check against the samples. `wire_contract.rs` learned that
//! at 1b-2a: its `every_declared_variant_has_an_instance_in_the_enumeration`
//! reads `error.rs`'s own enum block for exactly this reason, and this module is
//! that pattern applied to the other thirty-three enumerations.
//!
//! # The three questions, and which of them is answered
//!
//! Phase 1b-2b's review found this module failing open in two different ways,
//! and only the first two of the three questions below were being asked at all.
//!
//! 1. **Does every variant of a registered enum have a key?** Yes, both ways,
//!    and now parsed rather than line-scanned, so the review's
//!    `#[cfg(…)] Variant,` and `A, B,` counterexamples are read as declarations.
//! 2. **Is every key in the `code.` namespace one a variant asks for?** Yes,
//!    per namespace and over the whole namespace.
//! 3. **Is every enum that can reach a user registered at all?** This is the
//!    review's third escape — a brand-new enum simply not added to
//!    [`CODE_ENUMS`] left the expected key set unchanged, so everything passed
//!    vacuously. It is now asked from **two** derived directions, and both of
//!    them answer it against the **same** two tables:
//!    [`every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code`] walks
//!    both source trees and demands that every enum `serde` can write is either
//!    a [`CODE_ENUMS`] namespace or on [`NOT_A_CODE`] with a reason, and
//!    [`every_typescript_wire_union_has_a_namespace`] demands exactly that of
//!    every string-literal union `src/lib/ipc/types.ts` declares. Neither is a
//!    hand-maintained list of enums; both are derived from source.
//!
//!    **The TypeScript half consulted only the first of the two tables until
//!    Phase 2b-2b-3**, which made the exemption mechanism half a mechanism: an
//!    enum could be a named, reasoned non-code on the Rust side and still be
//!    demanded to own a namespace the moment the frontend mirrored it. The three
//!    field-identifier unions the draft surface put on the wire —
//!    `MatchField`, `SequenceField` and `VariableField`, each of which
//!    serializes as an espanso key rather than as a Rust variant name — are what
//!    found it. The fix was to make the two directions read one table rather
//!    than to add a second, hand-maintained exclusion list beside it; an
//!    exempted union is still **counted** as examined, and how many there are is
//!    asserted, so adding one stays a deliberate act.
//!
//! # What this check cannot see
//!
//! - **An enum a macro produces.** `crate::rust_source` parses; it does not
//!   expand. `macro_rules! wire_enum` generating `pub enum DisplayMode` inside
//!   `crates/espansoconfig-core/src/model/document.rs` is invisible to question
//!   3, and so is any enum reaching a user without `serde` and without a
//!   TypeScript union. That is the residue of the review's third finding, stated
//!   in `docs/decisions/1b-2b-notes.md` rather than papered over.
//! - **Whether the sentence is right.** It checks that a key exists, never what
//!   it says, never that it is in the language its file claims, and never that
//!   anything renders it. `dictionaries.test.ts` covers blankness, placeholder
//!   parity and the untranslated-value heuristic; `codes.test.ts` covers
//!   rendering; nothing anywhere establishes that a Spanish value is Spanish
//!   (`1b-1-notes.md` section 9, hole 9).
//! - **A key outside the `code.` namespace.** `ipc.unexpectedFailure` and every
//!   interface string are the frontend's business and are typed there.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::error::CommandError;
use crate::rust_source::{
    declared_enums, declared_variants, mentions_identifier, modules_not_gated_by_cfg_test,
    serializable_types, unit_variants,
};

/// One enum whose variants owe a dictionary entry.
struct CodeEnum {
    /// The Rust source file, relative to the repository root.
    source: &'static str,
    /// The enum's own name, which is also where its namespace comes from.
    name: &'static str,
}

impl CodeEnum {
    /// The `code.<namespace>` this enum's variants live under.
    fn namespace(&self) -> String {
        uncapitalize(self.name)
    }
}

/// Every enum whose variants can reach a user, and where its declaration is.
///
/// All but four are on the wire in some form. Those four —
/// `WorkspaceError`, `DiscoveryError`, `IdentityError` and `DocumentShape` as an
/// operand — are here because a code with no string is worse than a code with no
/// caller (`1b-2a-notes.md` section 9, hole 3): the first three never cross the
/// Tauri boundary in their own shape, since `CommandError` flattens their
/// conditions, and they still owe a sentence in case a later phase forwards one.
///
/// **Six were added by Phase 1b-2b's review.** `ScalarStyle`, `LineEnding`,
/// `FileKind`, `TriggerKind`, `ContentKind` and `VariableKind` already cross the
/// wire as fields of the read projection, and the phase had deferred their
/// strings to 1c on the grounds that no message interpolates them. That was the
/// wrong test: a Phase 1c component meeting `trigger.kind = "Single"` with no key
/// can only render the raw Rust identifier or invent an unchecked mapping, which
/// is a hardcoded English string arriving by the back door (CLAUDE.md section 2).
/// A code with no string is worse than a code with no caller — the rule this file
/// already applied to `identityWrongDocument`.
///
/// **Eighteen were added by Phase 2b-1**, in one change, because that is the only
/// size that change comes in: the save transaction's own types (`SaveError`,
/// `SaveVerdict`), the write primitive's (`WriteError`, `WriteStep`,
/// `TargetDifference`), the backup's (`BackupError`, `BackupStep`,
/// `RotationOutcome`), the semantic gate's (`FindingCode`, `FindingClass`), and
/// everything those carry transitively — `EditError`, `MoveSeam`,
/// `VerificationFailure`, `SyntaxError`, `InvariantViolation`, `PathError`,
/// `DecodeError` and `NodeKind`. One variant serialized without its string is a
/// failure of this module, which is why none of them could land alone.
///
/// **Two were added by Phase 2b-2a**, and each arrived by the route this table
/// exists to catch. `NotReencodable` is the `reason` of a
/// `PresentationNote`, which a successful save now carries out — an enum that had
/// lived entirely inside the emitter until the moment a result type carried it.
/// `SaveResult` is the shell type `move_match` answers with, and it is the first
/// entry declared in `src-tauri/` beside `CommandError`.
///
/// **`NodeKind` moved here from [`NOT_A_CODE`] in the same change**, and the
/// exclusion it left is the shape of the rule: its reason was *"a substrate
/// detail the read projection never carries"*, which stopped being true the
/// moment `EditError::NotAScalar { kind: NodeKind }` reached the wire. An
/// exclusion is a claim about what crosses the boundary, and it expires when the
/// boundary moves.
///
/// **`PresentationNote` joined at Phase 2b-2c-2's fix round**, and it arrived by
/// changing shape rather than by crossing a boundary it had not crossed before.
/// It was a struct — one scalar's spelling — and a struct has no variants to give
/// keys to, so nothing here owned it. Generalising it into a tagged union so that
/// a deletion could disclose the doubled blank line it leaves made it an enum a
/// screen renders, and therefore a namespace: `scalarRestyled` is the sentence the
/// old struct never had, and `doubledSequenceSeparation` is the one the whole
/// change exists for.
///
/// **`DraftError` moved here from [`NOT_A_CODE`] at Phase 2b-2b-3**, on the same
/// rule and by the route the entry itself predicted: `save_match` is the first
/// caller `espansoconfig_core::draft` has ever had, so a refusal that could not
/// previously be produced now crosses as `CommandError::DraftRefused`. Its
/// exclusion was the only one ever marked TEMPORARY, and
/// [`the_temporary_draft_error_exclusion_expires_when_anything_names_it`] is what
/// made the deletion a build requirement rather than a note in a decision
/// record — the exhaustiveness checks above would have passed with the exclusion
/// left standing and the thirty-two sentences unwritten.
const CODE_ENUMS: &[CodeEnum] = &[
    CodeEnum {
        source: "crates/espansoconfig-core/src/model/diagnostic.rs",
        name: "DiagnosticCode",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/model/unknown.rs",
        name: "UnknownReason",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/syntax/trivia.rs",
        name: "HazardKind",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/model/value.rs",
        name: "ValueKind",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/model/document.rs",
        name: "DocumentShape",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/model/match_view.rs",
        name: "MatchBadge",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/model/match_view.rs",
        name: "IdentityError",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/workspace/mod.rs",
        name: "WorkspaceError",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/discovery.rs",
        name: "DiscoveryError",
    },
    CodeEnum {
        source: "src-tauri/src/error.rs",
        name: "CommandError",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/syntax/mod.rs",
        name: "ScalarStyle",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/lib.rs",
        name: "LineEnding",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/discovery.rs",
        name: "FileKind",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/model/match_view.rs",
        name: "TriggerKind",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/model/match_view.rs",
        name: "ContentKind",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/model/variable.rs",
        name: "VariableKind",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/syntax/node.rs",
        name: "NodeKind",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/persist/save.rs",
        name: "SaveError",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/persist/save.rs",
        name: "SaveVerdict",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/persist/write.rs",
        name: "WriteError",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/persist/write.rs",
        name: "WriteStep",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/persist/write.rs",
        name: "TargetDifference",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/persist/backup.rs",
        name: "BackupError",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/persist/backup.rs",
        name: "BackupStep",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/persist/backup.rs",
        name: "RotationOutcome",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/validate/mod.rs",
        name: "FindingCode",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/validate/mod.rs",
        name: "FindingClass",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/patch/edit.rs",
        name: "EditError",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/patch/edit.rs",
        name: "MoveSeam",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/patch/edit.rs",
        name: "DuplicateSeam",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/patch/edit.rs",
        name: "VerificationFailure",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/syntax/error.rs",
        name: "SyntaxError",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/syntax/error.rs",
        name: "InvariantViolation",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/patch/path.rs",
        name: "PathError",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/emit/decode.rs",
        name: "DecodeError",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/emit/choose.rs",
        name: "NotReencodable",
    },
    CodeEnum {
        source: "src-tauri/src/save.rs",
        name: "SaveResult",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/draft/error.rs",
        name: "DraftError",
    },
    CodeEnum {
        source: "crates/espansoconfig-core/src/patch/edit.rs",
        name: "PresentationNote",
    },
];

/// How many variants each namespace's enum declares, as this phase measured it.
///
/// The non-vacuity guard. Without it a parser that silently stopped recognising
/// declarations would agree with an empty expectation, and the bidirectional
/// comparison would then report every dictionary key as surplus — which is a
/// failure, but one that points at the dictionary instead of at the parser.
/// With it the parser fails first, with a count.
const VARIANT_COUNTS: &[(&str, usize)] = &[
    ("diagnosticCode", 23),
    ("unknownReason", 4),
    ("hazardKind", 10),
    ("valueKind", 5),
    ("documentShape", 3),
    ("matchBadge", 10),
    ("identityError", 3),
    ("workspaceError", 5),
    ("discoveryError", 3),
    ("commandError", 17),
    ("scalarStyle", 5),
    ("lineEnding", 2),
    ("fileKind", 3),
    ("triggerKind", 5),
    ("contentKind", 7),
    ("variableKind", 11),
    ("nodeKind", 5),
    ("saveError", 10),
    ("saveVerdict", 3),
    ("writeError", 7),
    ("writeStep", 13),
    ("targetDifference", 4),
    ("backupError", 8),
    ("backupStep", 12),
    ("rotationOutcome", 4),
    ("findingCode", 12),
    ("findingClass", 2),
    ("editError", 40),
    ("moveSeam", 4),
    ("duplicateSeam", 3),
    ("verificationFailure", 30),
    ("syntaxError", 3),
    ("invariantViolation", 5),
    ("pathError", 9),
    ("decodeError", 5),
    ("notReencodable", 8),
    ("saveResult", 3),
    ("draftError", 32),
    ("presentationNote", 2),
];

/// Source trees walked when asking whether an enum was registered at all.
///
/// Directories rather than files, because a file list is the hand-maintained
/// thing question 3 exists to stop depending on: a new enum in a new module
/// would be invisible to a list and is not invisible to a walk.
const SCANNED_TREES: &[&str] = &["crates/espansoconfig-core/src", "src-tauri/src"];

/// Enums `serde` can write that deliberately owe no dictionary entry.
///
/// Every entry is a **named** exclusion with a reason, not a category, and the
/// list is asserted in both directions below: an entry that stops being a
/// serializable enum fails just as loudly as an enum that is neither registered
/// nor listed. That is what stops it becoming a suppression list.
///
/// **It governs both derived directions, since Phase 2b-2b-3.** The key is the
/// type's own name, which is the same word on both sides of the boundary because
/// `src/lib/ipc/types.ts` spells every wire type with its Rust name verbatim, so
/// [`every_typescript_wire_union_has_a_namespace`] consults this same table
/// rather than a second list of its own. An exclusion is a claim about what
/// reaches a screen, and a claim answered differently depending on which language
/// asks is not one claim.
const NOT_A_CODE: &[(&str, &str)] = &[
    (
        "ValueView",
        "a value, not a code: its tags name the node shapes `ValueKind` already \
         has strings for, and what a component renders is the value inside",
    ),
    (
        "PathSegment",
        "an address, not a code: `Key`/`Index` are how the edit engine names a \
         node, and a path is never shown as a sentence",
    ),
    (
        "Chomping",
        "a block-scalar header detail the read projection never carries; it is \
         serialized for the syntax tests' own snapshots, not for a screen",
    ),
    (
        "DraftField",
        "a protocol tag, not a code: `Unchanged`/`Set`/`Remove` travel *into* the \
         core as one field's intent and are never rendered — the value inside a \
         `Set` is what a screen shows",
    ),
    (
        "MatchField",
        "a field identifier, not a code: it names an espanso key, and what a \
         screen puts beside a match's field is that key itself, spelled the same \
         in every language. It serializes as that key — `uppercase_style`, not \
         `UppercaseStyle` — which is what makes the sentence above true rather \
         than merely intended; `every_match_field_serializes_as_its_espanso_key` \
         pins it variant by variant",
    ),
    (
        "SequenceField",
        "a field identifier, not a code, for the same reason as `MatchField` and \
         with the same spelling on the wire: it names `triggers` or \
         `search_terms`, which espanso spells one way and which \
         `every_sequence_field_serializes_as_its_espanso_key` pins",
    ),
    (
        "VariableField",
        "a field identifier, not a code, for the same reason as `MatchField` and \
         with the same spelling on the wire: it names `name`, `type` or \
         `inject_vars` inside one variable, which espanso spells one way and \
         which `every_variable_field_serializes_as_its_espanso_key` pins",
    ),
    (
        "NewMatchPosition",
        "a protocol tag, not a code, exactly as `DraftField` is: `Front`, \
         `After` and `End` travel *into* a command as where the caller wants a \
         new snippet put, and are never rendered. What a screen shows is the \
         list itself, and the wire form carries no operand a sentence could be \
         built from beyond a `MatchId`",
    ),
    (
        "DraftTarget",
        "an address, not a code, exactly as `PathSegment` is: it says which \
         drafted value a refusal is about, and everything it can name is \
         rendered literally — the nested \
         `MatchField`/`SequenceField`/`VariableField` serialize as espanso keys \
         and every other operand is an index, deliberately, because an \
         author-chosen key's text is the owner's private configuration",
    ),
];

/// The enum whose exclusion above was temporary, and the namespace it owed.
///
/// Named once, so the expiry test and the failure message it prints cannot come
/// to disagree about which entry they are talking about.
///
/// **The exclusion expired at Phase 2b-2b-3 and has been deleted**, which is the
/// end state it was written for: `DraftError` is a [`CODE_ENUMS`] namespace now,
/// and the checks above own it. The constant and
/// [`the_temporary_draft_error_exclusion_expires_when_anything_names_it`] are
/// kept rather than removed, because the test is written to **self-disable** when
/// its entry is gone — it is a record of the mechanism and the template for the
/// next temporary exclusion, and it costs one early return.
const TEMPORARY_EXCLUSION: &str = "DraftError";

/// The crate root, which is where this crate declares every module it has.
const CRATE_ROOT: &str = "src-tauri/src/main.rs";

/// The TypeScript file every wire type has to be declared in.
const WIRE_TYPES: &str = "src/lib/ipc/types.ts";

/// The prefix every key checked by this module carries.
const CODE_PREFIX: &str = "code.";

/// The absolute path of a file, given its path relative to the repository root.
fn repository_file(relative: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join(relative)
}

/// Reads a repository file, failing loudly rather than silently skipping it.
fn read_repository_file(relative: &str) -> String {
    let path = repository_file(relative);
    std::fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("cannot read {}: {error}", path.display()))
}

/// Every `.rs` file under one repository-relative directory, recursively.
///
/// Sorted, so a failure names the same file every run.
fn rust_files_under(relative: &str) -> Vec<PathBuf> {
    let root = repository_file(relative);
    let mut found = Vec::new();
    let mut pending = vec![root.clone()];
    while let Some(directory) = pending.pop() {
        let entries = std::fs::read_dir(&directory)
            .unwrap_or_else(|error| panic!("cannot read {}: {error}", directory.display()));
        for entry in entries {
            let path = entry
                .unwrap_or_else(|error| panic!("cannot read an entry of {relative}: {error}"))
                .path();
            if path.is_dir() {
                pending.push(path);
            } else if path.extension().is_some_and(|kind| kind == "rs") {
                found.push(path);
            }
        }
    } // End of the walk over one source tree
    found.sort();
    found
} // End of function rust_files_under()

/// A name with its first character lowercased, and nothing else changed.
///
/// The Rust half of the naming formula. TypeScript's `Uncapitalize<S>` is the
/// other half, and `codes.ts` applies it to the same names.
fn uncapitalize(name: &str) -> String {
    let mut characters = name.chars();
    match characters.next() {
        None => String::new(),
        Some(first) => first.to_lowercase().collect::<String>() + characters.as_str(),
    }
}

/// The dictionary keys one enum's declaration demands.
fn expected_keys(entry: &CodeEnum) -> BTreeSet<String> {
    let source = read_repository_file(entry.source);
    declared_variants(&source, entry.name)
        .iter()
        .map(|variant| {
            format!(
                "{CODE_PREFIX}{}.{}",
                entry.namespace(),
                uncapitalize(variant)
            )
        })
        .collect()
}

/// Every namespace [`CODE_ENUMS`] registers.
fn registered_namespaces() -> BTreeSet<String> {
    CODE_ENUMS.iter().map(CodeEnum::namespace).collect()
}

/// The variants one registered enum declares, parsed out of the core's source.
///
/// Exposed for `crate::wire_contract`, whose Phase 2b-1 sample lists are checked
/// against the declaration rather than against themselves. It reads
/// [`CODE_ENUMS`] rather than taking a file path, so there is **one** table of
/// where each enum lives: a second one could name a moved file and answer with a
/// panic that pointed at the wrong module.
///
/// # Panics
///
/// When `name` is not a registered enum, which is the honest answer — an enum
/// with no dictionary namespace has no business being on the wire at all.
pub(crate) fn declared_variants_of(name: &str) -> BTreeSet<String> {
    let entry = CODE_ENUMS
        .iter()
        .find(|entry| entry.name == name)
        .unwrap_or_else(|| panic!("{name} is not registered in CODE_ENUMS"));
    declared_variants(&read_repository_file(entry.source), name)
} // End of function declared_variants_of()

/// One registered enum's declared variants, and the subset of them that declare
/// **no** fields — both from a **single** read of the file that declares it.
///
/// A unit variant is the one shape `serde`'s externally tagged representation
/// writes as a bare JSON string instead of a one-key object, which
/// `crate::wire_contract::every_draft_error_variant_crosses_as_an_object` and its
/// `EditError` twin need to be able to ask about. They ask it together with *how
/// many variants there are*, always: the count is what makes the emptiness claim
/// a claim about a known declaration rather than a vacuous one (`PROGRESS.md`,
/// D2w).
///
/// Two accessors would read and parse the declaring source once each, and
/// `EditError` lives in `crates/espansoconfig-core/src/patch/edit.rs`, which is
/// over four hundred kilobytes. Nothing but test time is at stake, and it is free
/// to stop spending. Reading the same [`CODE_ENUMS`] entry once also means
/// neither answer can be about a different file from the other.
///
/// # Panics
///
/// When `name` is not a registered enum, exactly as [`declared_variants_of`].
pub(crate) fn variants_and_unit_variants_of(name: &str) -> (BTreeSet<String>, BTreeSet<String>) {
    let entry = CODE_ENUMS
        .iter()
        .find(|entry| entry.name == name)
        .unwrap_or_else(|| panic!("{name} is not registered in CODE_ENUMS"));
    let source = read_repository_file(entry.source);
    (
        declared_variants(&source, name),
        unit_variants(&source, name),
    )
} // End of function variants_and_unit_variants_of()

/// Every key of one dictionary file, read as JSON.
fn dictionary_keys(relative: &str) -> BTreeSet<String> {
    let text = read_repository_file(relative);
    let parsed: Value = serde_json::from_str(&text)
        .unwrap_or_else(|error| panic!("{relative} is not valid JSON: {error}"));
    parsed
        .as_object()
        .unwrap_or_else(|| panic!("{relative} is not a JSON object"))
        .keys()
        .cloned()
        .collect()
}

/// The whole of one dictionary file, as key-to-value pairs.
///
/// Exposed for `crate::wire_contract`, which asks a question this module cannot:
/// whether a message's `{placeholder}` names an operand `serde` really writes.
/// That needs the sentence *and* the JSON, and only that module has the JSON.
pub(crate) fn dictionary_values(relative: &str) -> BTreeMap<String, String> {
    let text = read_repository_file(relative);
    let parsed: Value = serde_json::from_str(&text)
        .unwrap_or_else(|error| panic!("{relative} is not valid JSON: {error}"));
    parsed
        .as_object()
        .unwrap_or_else(|| panic!("{relative} is not a JSON object"))
        .iter()
        .map(|(key, value)| {
            let text = value
                .as_str()
                .unwrap_or_else(|| panic!("{relative}'s {key} is not a string"));
            (key.clone(), text.to_owned())
        })
        .collect()
} // End of function dictionary_values()

/// A name with its first character lowercased, for another module's use.
///
/// The naming formula has exactly one implementation in this crate, and this is
/// how `crate::wire_contract` reaches it rather than writing a second one that
/// could disagree about what a key looks like.
pub(crate) fn code_key(namespace: &str, variant: &str) -> String {
    format!(
        "{CODE_PREFIX}{}.{}",
        uncapitalize(namespace),
        uncapitalize(variant)
    )
}

/// The `code.` keys of one dictionary file.
fn code_keys(relative: &str) -> BTreeSet<String> {
    dictionary_keys(relative)
        .into_iter()
        .filter(|key| key.starts_with(CODE_PREFIX))
        .collect()
}

/// Fails when two key sets differ, saying which side has what.
///
/// `expected` is whichever side is authoritative for the comparison — the Rust
/// declarations for the two checks against `en.json`, the English dictionary for
/// the check against `es.json` — and `source` names it in the message, because a
/// failure that says "missing" without saying *from what* sends a reader to the
/// wrong file.
fn assert_same_keys(
    what: &str,
    source: &str,
    expected: &BTreeSet<String>,
    found: &BTreeSet<String>,
) {
    let missing: Vec<&String> = expected.difference(found).collect();
    let surplus: Vec<&String> = found.difference(expected).collect();
    assert!(
        missing.is_empty() && surplus.is_empty(),
        "{what}: missing {missing:?}, and declares {surplus:?} that {source} does not"
    );
} // End of function assert_same_keys()

/// Every key the sixteen declarations demand, across every namespace.
fn every_expected_key() -> BTreeSet<String> {
    CODE_ENUMS.iter().flat_map(expected_keys).collect()
}

/// The scanner reads real declarations, in the numbers this phase measured.
///
/// Runs before the comparison in intent, and independently of it in fact: a
/// parser that stopped recognising variants fails here with a count, rather than
/// downstream with a list of keys that look surplus.
#[test]
fn every_declaration_yields_the_variant_count_this_phase_measured() {
    let measured: BTreeMap<String, usize> = CODE_ENUMS
        .iter()
        .map(|entry| {
            let source = read_repository_file(entry.source);
            (
                entry.namespace(),
                declared_variants(&source, entry.name).len(),
            )
        })
        .collect();
    let pinned: BTreeMap<String, usize> = VARIANT_COUNTS
        .iter()
        .map(|(namespace, count)| ((*namespace).to_owned(), *count))
        .collect();
    assert_eq!(
        measured, pinned,
        "the enum declarations and the counts this module pins disagree"
    );
} // End of function every_declaration_yields_the_variant_count_this_phase_measured()

/// Every declared variant has a dictionary key, and every key a variant.
///
/// Both directions, per namespace and then over the whole `code.` namespace, so
/// that a key in a namespace no enum owns — `code.bogus.thing`, or a namespace
/// left behind by a deleted enum — fails as well as a missing one.
#[test]
fn the_code_dictionary_is_exactly_the_declared_variants() {
    let expected = every_expected_key();
    assert!(
        expected.len() > 100,
        "only {} keys were derived, so the parser is not reading the declarations",
        expected.len()
    );
    for entry in CODE_ENUMS {
        let prefix = format!("{CODE_PREFIX}{}.", entry.namespace());
        let declared = expected_keys(entry);
        let present: BTreeSet<String> = code_keys("src/lib/i18n/en.json")
            .into_iter()
            .filter(|key| key.starts_with(&prefix))
            .collect();
        assert_same_keys(
            &format!("en.json, the {} namespace", entry.namespace()),
            "any Rust variant",
            &declared,
            &present,
        );
    } // End of the loop over the enumerations
    assert_same_keys(
        "en.json, the whole code. namespace",
        "any Rust variant",
        &expected,
        &code_keys("src/lib/i18n/en.json"),
    );
} // End of function the_code_dictionary_is_exactly_the_declared_variants()

/// The Spanish dictionary carries the same code keys as the English one.
///
/// `ExactDictionary` in `dictionaries.ts` already makes a missing or surplus
/// Spanish key a TypeScript error, and `dictionaries.test.ts` asserts the same
/// from the files. Asserted here too because this is the check a Rust-only
/// change runs: a maintainer who adds a variant, adds its English string and
/// runs `cargo test` should be told about the Spanish one then, not two commands
/// later.
#[test]
fn the_spanish_dictionary_declares_the_same_code_keys() {
    assert_same_keys(
        "es.json, the whole code. namespace",
        "en.json",
        &code_keys("src/lib/i18n/en.json"),
        &code_keys("src/lib/i18n/es.json"),
    );
}

/// No two variants of one enum collapse onto the same key.
///
/// The formula only lowercases a first letter, so `Io` and `IO` would produce
/// one key for two conditions — one message for two different failures, which is
/// the thing a code exists to prevent. Nothing in the sixteen enums does this
/// today; the assertion is what keeps it that way.
#[test]
fn no_two_variants_share_a_dictionary_key() {
    for entry in CODE_ENUMS {
        let source = read_repository_file(entry.source);
        let variants = declared_variants(&source, entry.name);
        let keys: BTreeSet<String> = variants.iter().map(|name| uncapitalize(name)).collect();
        assert_eq!(
            keys.len(),
            variants.len(),
            "two variants of {} collapse onto one dictionary key",
            entry.namespace()
        );
    } // End of the loop over the enumerations
} // End of function no_two_variants_share_a_dictionary_key()

/// No two registered enums collapse onto the same namespace.
///
/// The namespace is derived from the enum's own name, so `MatchBadge` in two
/// files — or a `matchBadge` and a `MatchBadge` — would merge two enums' keys
/// into one namespace and make the per-namespace comparison meaningless.
#[test]
fn no_two_enums_share_a_namespace() {
    assert_eq!(
        registered_namespaces().len(),
        CODE_ENUMS.len(),
        "two entries of CODE_ENUMS derive the same namespace"
    );
}

/// The `commandError` namespace is spelled with the wire codes themselves.
///
/// `commandErrorKey()` in `codes.ts` appends `error.code` unchanged rather than
/// uncapitalising a variant name, which is only correct while the two spellings
/// coincide. They do — `CommandError::NoWorkspaceOpen` serializes as
/// `noWorkspaceOpen` — and this is what says so rather than leaving it as a
/// coincidence a rename could quietly break.
#[test]
fn the_command_error_namespace_is_spelled_with_the_wire_codes() {
    let from_codes: BTreeSet<String> = crate::error::every_command_error()
        .iter()
        .map(|error: &CommandError| format!("{CODE_PREFIX}commandError.{}", error.code()))
        .collect();
    let entry = CODE_ENUMS
        .iter()
        .find(|entry| entry.namespace() == "commandError")
        .expect("the commandError namespace is declared above");
    assert_eq!(
        from_codes,
        expected_keys(entry),
        "CommandError::code() and the uncapitalised variant names disagree"
    );
} // End of function the_command_error_namespace_is_spelled_with_the_wire_codes()

/// Every enum `serde` can write is a namespace or is named as not being a code.
///
/// **The review's third escape, closed as far as parsing can close it.** Before
/// this test, an enum introduced anywhere and simply not added to [`CODE_ENUMS`]
/// left the expected key set unchanged, so every check above passed with no keys
/// for it. The expectation now comes from a **walk of the source trees** rather
/// than from the registry, so the registry cannot be the thing that decides what
/// the registry is checked against.
///
/// Two ways an enum reaches `serde` and both count: a `Serialize` derive and a
/// hand-written `impl Serialize`. `CommandError` is the second, and an audit
/// that read `derive` lists alone would have missed the enum this whole boundary
/// is built around.
///
/// **What still escapes**, stated rather than implied: an enum a macro expands
/// to, and an enum that reaches a user without `serde`. `docs/decisions/
/// 1b-2b-notes.md` carries the worked example.
#[test]
fn every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code() {
    let mut serializable: BTreeSet<String> = BTreeSet::new();
    let mut enums: BTreeSet<String> = BTreeSet::new();
    let mut files = 0usize;
    for tree in SCANNED_TREES {
        for path in rust_files_under(tree) {
            let source = std::fs::read_to_string(&path)
                .unwrap_or_else(|error| panic!("cannot read {}: {error}", path.display()));
            serializable.extend(serializable_types(&source));
            enums.extend(declared_enums(&source));
            files += 1;
        }
    } // End of the walk over both source trees
    assert!(
        files > 20 && enums.len() > 30,
        "the walk found {files} files and {} enums, so it is not reading the trees",
        enums.len()
    );

    // A `Serialize` impl on a struct is not an enum, and only enums have
    // variants to give keys to.
    let wire_enums: BTreeSet<String> = serializable.intersection(&enums).cloned().collect();
    let registered: BTreeSet<String> = CODE_ENUMS
        .iter()
        .map(|entry| entry.name.to_owned())
        .collect();
    let excluded: BTreeSet<String> = NOT_A_CODE
        .iter()
        .map(|(name, _)| (*name).to_owned())
        .collect();

    let unaccounted: Vec<&String> = wire_enums
        .difference(&registered)
        .filter(|name| !excluded.contains(*name))
        .collect();
    assert!(
        unaccounted.is_empty(),
        "these enums are serialized and owe a dictionary namespace, or a named \
         reason in NOT_A_CODE: {unaccounted:?}"
    );

    // The other direction, so the exclusion list cannot rot into a suppression
    // list: an entry that stopped being a serialized enum is a stale exclusion.
    let stale: Vec<&String> = excluded.difference(&wire_enums).collect();
    assert!(
        stale.is_empty(),
        "NOT_A_CODE names {stale:?}, which no longer is an enum serde can write"
    );
    for (name, reason) in NOT_A_CODE {
        assert!(
            !reason.trim().is_empty(),
            "the exclusion of {name} carries no reason"
        );
    }
} // End of function every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code()

/// **A temporary exclusion with an expiry the build enforces.**
///
/// [`NOT_A_CODE`] holds one entry marked TEMPORARY, and the danger is precisely
/// that it makes
/// [`every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code`] **pass**.
/// A later sub-phase that serializes a `DraftError` out of a command and forgets
/// to delete the entry ships a code with no sentence: the refusal reaches a
/// screen with nothing to render, and no test anywhere fails. A note in a
/// decision record is not a mechanism.
///
/// So this asks a question the exclusion cannot answer for itself: **does any
/// production Rust module of this crate, or the wire's own TypeScript, name the
/// excluded type at all?** If one does, the type has left the core and the
/// exclusion has expired.
///
/// Three things make the question narrow enough to be honest:
///
/// - **production** modules only, and derived rather than listed —
///   [`modules_not_gated_by_cfg_test`] reads `main.rs`, so the contract modules
///   that legitimately discuss the type by name are out of scope and a new
///   module is in scope the moment it is declared;
/// - **identifiers**, not text. `"DraftError"` inside [`NOT_A_CODE`] is a string
///   literal, and the doc comment you are reading is an attribute; neither is a
///   reference. `use …::DraftError;` is;
/// - **the wire's TypeScript too**, because a type can reach a screen by being
///   declared in `types.ts` without any Rust in this crate naming it.
///
/// What it does **not** establish: that a type nobody names cannot reach a user
/// some other way. It is a tripwire on the one route this exclusion was written
/// for, not a proof.
#[test]
fn the_temporary_draft_error_exclusion_expires_when_anything_names_it() {
    let excluded = NOT_A_CODE
        .iter()
        .any(|(name, _)| *name == TEMPORARY_EXCLUSION);
    if !excluded {
        // The exclusion is gone, which is the intended end state. The dictionary
        // checks above now own the type, and this guard has nothing to add.
        return;
    }

    let production = modules_not_gated_by_cfg_test(&read_repository_file(CRATE_ROOT));
    assert!(
        production.len() >= 5,
        "only {} production modules were derived from {CRATE_ROOT}, so this scan is not \
         reading the crate root",
        production.len()
    );

    let mut naming: Vec<String> = Vec::new();
    for module in &production {
        let relative = format!("src-tauri/src/{module}.rs");
        if mentions_identifier(&read_repository_file(&relative), TEMPORARY_EXCLUSION) {
            naming.push(relative);
        }
    } // End of the loop over this crate's production modules
    if crate::wire_contract::read_without_comments(WIRE_TYPES).contains(TEMPORARY_EXCLUSION) {
        naming.push(WIRE_TYPES.to_owned());
    }

    assert!(
        naming.is_empty(),
        "{naming:?} names {TEMPORARY_EXCLUSION}, so it is on the wire and its TEMPORARY \
         entry in NOT_A_CODE has expired. Delete that entry and add the draftError \
         namespace to both src/lib/i18n/en.json and src/lib/i18n/es.json in this same \
         change — a code with no string is worse than a code with no caller."
    );
} // End of function the_temporary_draft_error_exclusion_expires_when_anything_names_it()

/// Every string-literal union of `types.ts` owns a namespace or is exempt.
///
/// The second half of the review's third escape, from the other side. A new wire
/// enum has to be declared in `src/lib/ipc/types.ts` for the frontend to have a
/// type for it — `wire_contract.rs` fails if it is not — so demanding that every
/// such union map onto a `code.` namespace catches a new enum by the route it
/// actually arrives on, without a list of enums anywhere.
///
/// The mapping is the naming formula plus one rule: a trailing `Name` is
/// dropped, because `DiagnosticCodeName` is the *name set* of `DiagnosticCode`
/// and shares its namespace. That rule is the one place a genuinely new enum
/// called something-`Name` could hide, and it is small enough to say so.
///
/// # The exemption, and why it is not a loosening
///
/// A union on [`NOT_A_CODE`] is exempt — the **same** table
/// [`every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code`] reads,
/// keyed by the type's own name, which is the same word on both sides because
/// `types.ts` mirrors the Rust names verbatim. Before Phase 2b-2b-3 this
/// direction had no exemption at all, so a type could be a named, reasoned
/// non-code in Rust and still be demanded to own a namespace the moment the
/// frontend declared it: `MatchField`, `SequenceField` and `VariableField`
/// serialize as espanso keys — `uppercase_style`, `search_terms`, `inject_vars`
/// — which is precisely why they owe no sentence, and precisely what makes them
/// string-literal unions this scan sees.
///
/// Three things keep that from being a hole:
///
/// - it is **one table, already written, already reasoned**, rather than a second
///   list beside it that could disagree;
/// - an exempted union is **counted as examined**, so it still holds the floor
///   up, and how many exemptions the scan met is asserted exactly — adding a
///   union to `types.ts` and its name to [`NOT_A_CODE`] cannot be done quietly;
/// - the other direction still applies to it. `NOT_A_CODE` is asserted against
///   the set of enums `serde` can actually write, so an entry that stopped being
///   one fails there.
///
/// # What it still cannot see
///
/// A generic declaration. `declared_type_names` reads `export type X =` and skips
/// `export type X<T> =` rather than guessing, so `DraftField<T>` — the drafted
/// tri-state, and a `NOT_A_CODE` entry in its own right — is invisible here. It
/// is covered by the Rust-side direction, which is where the enum is declared.
#[test]
fn every_typescript_wire_union_has_a_namespace() {
    let source = crate::wire_contract::read_without_comments(WIRE_TYPES);
    let namespaces = registered_namespaces();
    let excluded: BTreeMap<&str, &str> = NOT_A_CODE.iter().copied().collect();
    let mut checked = 0usize;
    let mut exempted: Vec<String> = Vec::new();
    for name in crate::wire_contract::declared_type_names(&source) {
        // A union with no single-quoted member is a structural type — an
        // address, a value, a payload shape — and carries no variant name a
        // person could be shown.
        if crate::wire_contract::union_members(&source, &name).is_empty() {
            continue;
        }
        // A `…Name` union is the name set of the type it is named after, so the
        // exemption and the namespace are both looked up under the base name.
        let base = name.strip_suffix("Name").unwrap_or(&name);
        checked += 1;
        if let Some(reason) = excluded.get(base) {
            assert!(
                !reason.trim().is_empty(),
                "the exclusion of {base} carries no reason, so {name} is exempt for none"
            );
            exempted.push(name.clone());
            continue;
        }
        let namespace = uncapitalize(base);
        assert!(
            namespaces.contains(&namespace),
            "{WIRE_TYPES} declares the wire enum {name}, whose members can reach a \
             screen, and no CODE_ENUMS entry owns the {namespace} namespace. If its \
             members are not codes — a field identifier or an address, say — name it \
             in NOT_A_CODE with a reason instead"
        );
    } // End of the loop over the wire's TypeScript unions
      // The floor is what stops the scan passing vacuously by failing to read the
      // file, so it moves with the file. It stood at twelve against thirty-nine
      // unions, which is a floor that had stopped biting; Phase 2b-2b-3's draft
      // surface takes the count to forty-three and the floor with it.
      //
      // Forty-three rather than forty-four because `DraftError` is **not** among
      // them. Making every one of its thirty-two variants serialize as a one-key
      // object left the union with no single-quoted member at all, so it is now
      // read as a structural type and skipped by the guard above. Nothing is lost:
      // its variant names live in `DraftErrorName`, which is examined, and whose
      // `Name` suffix is stripped to find the `draftError` namespace.
      //
      // Forty-four since Phase 2b-2c-2's fix round: `PresentationNote` stopped
      // being an interface and became a tagged union with a `PresentationNoteName`
      // beside it. The value union is skipped for `DraftError`'s reason — every
      // member is a one-key object — and the `Name` union is the one counted here.
    assert!(
        checked >= 44,
        "only {checked} unions were examined, so this scan is not reading {WIRE_TYPES}"
    );
    assert_eq!(
        exempted,
        vec![
            "MatchField".to_owned(),
            "SequenceField".to_owned(),
            "VariableField".to_owned()
        ],
        "the unions exempted by NOT_A_CODE changed. Every one of them is a field \
         identifier that serializes as an espanso key; a new entry here is a claim \
         that something else on this wire is not a code either"
    );
} // End of function every_typescript_wire_union_has_a_namespace()
