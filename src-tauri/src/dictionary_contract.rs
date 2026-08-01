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
//!    vacuously. It is now asked from **two** derived directions:
//!    [`every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code`] walks
//!    both source trees and demands that every enum `serde` can write is either
//!    a namespace or on [`NOT_A_CODE`] with a reason, and
//!    [`every_typescript_wire_union_has_a_namespace`] demands the same of every
//!    string-literal union `src/lib/ipc/types.ts` declares. Neither is a
//!    hand-maintained list of enums; both are derived from source.
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
use crate::rust_source::{declared_enums, declared_variants, serializable_types};

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
/// Thirty of the thirty-four are on the wire in some form. The other four —
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
/// **`NodeKind` moved here from [`NOT_A_CODE`] in the same change**, and the
/// exclusion it left is the shape of the rule: its reason was *"a substrate
/// detail the read projection never carries"*, which stopped being true the
/// moment `EditError::NotAScalar { kind: NodeKind }` reached the wire. An
/// exclusion is a claim about what crosses the boundary, and it expires when the
/// boundary moves.
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
    ("commandError", 12),
    ("scalarStyle", 5),
    ("lineEnding", 2),
    ("fileKind", 3),
    ("triggerKind", 5),
    ("contentKind", 7),
    ("variableKind", 11),
    ("nodeKind", 5),
    ("saveError", 9),
    ("saveVerdict", 3),
    ("writeError", 7),
    ("writeStep", 13),
    ("targetDifference", 4),
    ("backupError", 8),
    ("backupStep", 12),
    ("rotationOutcome", 4),
    ("findingCode", 10),
    ("findingClass", 2),
    ("editError", 28),
    ("moveSeam", 4),
    ("verificationFailure", 26),
    ("syntaxError", 3),
    ("invariantViolation", 5),
    ("pathError", 9),
    ("decodeError", 5),
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
];

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

/// Every string-literal union of `types.ts` names a namespace that exists.
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
#[test]
fn every_typescript_wire_union_has_a_namespace() {
    let source = crate::wire_contract::read_without_comments("src/lib/ipc/types.ts");
    let namespaces = registered_namespaces();
    let mut checked = 0usize;
    for name in crate::wire_contract::declared_type_names(&source) {
        // A union with no single-quoted member is a structural type — an
        // address, a value, a payload shape — and carries no variant name a
        // person could be shown.
        if crate::wire_contract::union_members(&source, &name).is_empty() {
            continue;
        }
        let namespace = uncapitalize(name.strip_suffix("Name").unwrap_or(&name));
        assert!(
            namespaces.contains(&namespace),
            "src/lib/ipc/types.ts declares the wire enum {name}, whose members can \
             reach a screen, and no CODE_ENUMS entry owns the {namespace} namespace"
        );
        checked += 1;
    } // End of the loop over the wire's TypeScript unions
    assert!(
        checked >= 12,
        "only {checked} unions were examined, so this scan is not reading types.ts"
    );
} // End of function every_typescript_wire_union_has_a_namespace()
