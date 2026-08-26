//! The check that the hand-written TypeScript types are the wire.
//!
//! `src/lib/ipc/types.ts` and `src/lib/ipc/errors.ts` describe, by hand, what
//! `serde` writes for the read model. Hand-written types drift, and a drifted
//! boundary type is invisible: TypeScript is happy, `serde` is happy, and a
//! field simply reads as `undefined` at runtime in a window nobody has opened
//! yet. So the drift is checked rather than trusted.
//!
//! This module is compiled only for tests. It reads those two TypeScript files
//! as text and compares them against JSON produced by projecting a **synthetic**
//! document — hand-authored and neutral, because no test in this repository may
//! read the owner's real configuration (CLAUDE.md section 1).
//!
//! # What it checks, and what it cannot
//!
//! - **Interface property names**, in both directions: a property `serde` writes
//!   and TypeScript does not declare, and a property TypeScript declares and
//!   `serde` never writes, both fail. This is the strong half.
//! - **Required versus optional.** `serde` always writes the key, so `x?: T` is
//!   a different contract from `x: T | null` and only the second is true of this
//!   wire. A `?` anywhere in an interface under check is a failure with its own
//!   message, rather than being stripped and silently accepted.
//! - **Union members** of the enumerations, in both directions, against a
//!   Rust-side list of variants.
//! - **The operands of every tagged variant**, in both directions: the keys
//!   inside `{ readonly ParseFailed: { … } }` are compared against the keys
//!   `serde` writes for that variant, so a renamed nested field fails.
//! - **The command error codes** and, for each of them, **the error interface
//!   in `errors.ts` and the operand table `isCommandError` validates against**,
//!   names *and* JSON kinds.
//! - **That every `DraftError` variant crosses as an object**, read out of the
//!   core's own declaration rather than out of a sample list. The operand table
//!   pins one shape per code, and a unit variant among the thirty-two would make
//!   that shape false for exactly one refusal.
//! - **The registered command list**, parsed independently out of
//!   `generate_handler!` and compared with the union of `COMMAND_NAMES` and
//!   `MENU_COMMAND_NAMES` in both directions, plus an assertion that none of the
//!   six forbidden mutating names appears in either. Seven commands are
//!   registered as of Phase 1c-2b-2a, the newest being `commands::document_text`.
//!
//! What it still cannot check is the **type text of the read model's own
//! properties**: `readonly byte_len: string` in `types.ts` would pass, because
//! comparing that against a `serde_json::Value` kind would mean reimplementing
//! enough of TypeScript's type syntax to resolve `ScalarView | null` and
//! `readonly ValueView[]`. The error operands *are* type-checked, because their
//! shapes are three primitives rather than a type language. And the Rust-side
//! variant lists below are hand-written, so a variant added to the core and
//! listed in *neither* place is not caught — that gap is Phase 1b-2b's
//! exhaustiveness check, and it is recorded as a hole in
//! `docs/decisions/1b-2a-notes.md`.

use std::collections::{BTreeMap, BTreeSet};
use std::io;
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use espansoconfig_core::discovery::FileKind;
use espansoconfig_core::draft::{DraftError, NewMatch};
use espansoconfig_core::emit::DecodeError;
use espansoconfig_core::emit::NotReencodable;
use espansoconfig_core::model::{
    ContentKind, Diagnostic, DiagnosticCode, DocumentContext, DocumentShape, DocumentView,
    MatchBadge, TriggerKind, UnknownReason, ValueKind, ValueView, VariableKind,
};
use espansoconfig_core::patch::{
    DocumentPath, DuplicateSeam, EditError, MoveSeam, PathError, PathSegment, PresentationNote,
    VerificationFailure,
};
use espansoconfig_core::persist::{
    Acknowledgement, BackupBatchId, BackupEntryId, BackupError, BackupReadError, BackupReadStep,
    BackupRecord, BackupRootState, BackupStep, BackupTarget, BatchSkipped, EntrySkipped, Rotation,
    RotationOutcome, SaveError, SaveRefusal, SaveVerdict, TargetDifference, WriteError, WriteStep,
};
use espansoconfig_core::reconcile::{
    ReapplyEvidence, ReapplyPlacement, ReapplyRefusal, ReapplyResolution,
};
use espansoconfig_core::syntax::{
    HazardKind, InvariantViolation, NodeKind, OffsetOutOfDomain, ParseFailure, SyntaxError,
};
use espansoconfig_core::validate::{Finding, FindingClass, FindingCode};
use espansoconfig_core::wire::WirePath;
use espansoconfig_core::workspace::{project_source, DocumentSummary, WorkspaceSummary};
use espansoconfig_core::{ContentRevision, DocumentId, LineEnding, ScalarStyle};

use crate::error::{every_command_error, CommandError};

/// A synthetic match file exercising every shape the wire types describe.
///
/// Hand-authored and neutral. The anchor on the first trigger and the alias in
/// the third match's `params` are there so that `AliasView` has an instance;
/// the sequence item inside `triggers` is there so that an elided value does.
const MATCH_FILE: &str = concat!(
    "# A synthetic match file.\n",
    "imports:\n",
    "  - ../shared.yml\n",
    "global_vars:\n",
    "  - name: greeting\n",
    "    type: echo\n",
    "    params:\n",
    "      echo: hello\n",
    "matches:\n",
    "  - trigger: &anchored ':one'\n",
    "    replace: first\n",
    "    label: One\n",
    "    comment: a note\n",
    "    search_terms:\n",
    "      - alpha\n",
    "    word: true\n",
    "    left_word: 'no'\n",
    "    right_word: 'no'\n",
    "    propagate_case: true\n",
    "    uppercase_style: capitalize\n",
    "    force_mode: clipboard\n",
    "    force_clipboard: false\n",
    "    paragraph: false\n",
    "    anchor: an-anchor-field\n",
    "    vars:\n",
    "      - name: now\n",
    "        type: date\n",
    "        params:\n",
    "          format: '%Y'\n",
    "        depends_on:\n",
    "          - greeting\n",
    "        inject_vars: true\n",
    "  - triggers:\n",
    "      - ':two'\n",
    "      - [a sequence where a string belongs]\n",
    "    markdown: '**bold**'\n",
    "    invented_by_a_later_espanso: yes\n",
    "    form_fields:\n",
    "      choice:\n",
    "        type: list\n",
    "  - regex: 'a(?P<digits>\\d+)'\n",
    "    html: '<b>three</b>'\n",
    "    vars:\n",
    "      - name: echoed\n",
    "        type: echo\n",
    "        params:\n",
    "          echo: *anchored\n",
    "  - trigger: ':four'\n",
    "    image_path: /tmp/four.png\n",
    "  - trigger: ':five'\n",
    "    form: '[[field]]'\n",
);

/// A synthetic config profile, for [`ConfigProfileView`].
const PROFILE_FILE: &str = concat!(
    "backend: auto\n",
    "filter_title: A Window Title\n",
    "includes:\n",
    "  - default\n",
);

/// Projects `source` with no filesystem behind it.
fn project(name: &str, source: &str) -> DocumentView {
    project_source(&DocumentContext::detached(DocumentId(0), name), source).view
}

/// The JSON `serde` writes for a value.
fn json_of<T: Serialize>(value: &T) -> Value {
    serde_json::to_value(value).expect("the read model must serialize")
}

/// The absolute path of a frontend source file.
fn frontend_file(relative: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join(relative)
}

/// Reads a frontend source file with its comments removed.
///
/// Comments are stripped so that a property name mentioned in a doc comment
/// cannot be mistaken for a declaration, and so a declaration commented out
/// cannot be mistaken for a live one.
pub(crate) fn read_without_comments(relative: &str) -> String {
    let path = frontend_file(relative);
    let source = std::fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("cannot read {}: {error}", path.display()));
    strip_comments(&source)
}

/// Reads a repository file whole, comments included.
///
/// [`read_without_comments`]'s sibling for **Rust** source, where comments are
/// kept rather than stripped: the two readers of a Rust file below are
/// `crate::rust_source`'s lexer, which discards comments and attributes itself,
/// and [`function_body`], which slices a body that has already begun.
fn read_repository_file(relative: &str) -> String {
    let path = frontend_file(relative);
    std::fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("cannot read {}: {error}", path.display()))
}

/// Removes `/* … */` and `// …` from TypeScript source.
///
/// Deliberately naive — it has no notion of a string literal — which is safe
/// here because neither file contains a literal holding `//` or `/*`, and a
/// future one that did would break this loudly rather than quietly.
fn strip_comments(source: &str) -> String {
    let mut out = String::with_capacity(source.len());
    let bytes: Vec<char> = source.chars().collect();
    let mut index = 0usize;
    while index < bytes.len() {
        let rest_is_block = bytes[index] == '/' && bytes.get(index + 1) == Some(&'*');
        let rest_is_line = bytes[index] == '/' && bytes.get(index + 1) == Some(&'/');
        if rest_is_block {
            index += 2;
            while index < bytes.len()
                && !(bytes[index] == '*' && bytes.get(index + 1) == Some(&'/'))
            {
                index += 1;
            }
            index = (index + 2).min(bytes.len());
        } else if rest_is_line {
            while index < bytes.len() && bytes[index] != '\n' {
                index += 1;
            }
        } else {
            out.push(bytes[index]);
            index += 1;
        }
    } // End of the loop over the source's characters
    out
} // End of function strip_comments()

/// The text inside the first `{ … }` of `text`, braces matched.
///
/// `text` must begin at or before the opening brace. Returns the slice between
/// the braces, so a caller can scan it without meeting its own terminator.
fn braced_block<'a>(text: &'a str, what: &str) -> &'a str {
    let open = text
        .find('{')
        .unwrap_or_else(|| panic!("{what} has no opening brace"));
    let mut depth = 1usize;
    for (offset, character) in text[open + 1..].char_indices() {
        match character {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    return &text[open + 1..open + 1 + offset];
                }
            }
            _ => {}
        }
    } // End of the loop looking for the matching closing brace
    panic!("{what} is never closed");
} // End of function braced_block()

/// The text between the braces of `export interface {name} { … }`.
fn interface_body<'a>(source: &'a str, name: &str) -> &'a str {
    let header = format!("export interface {name} {{");
    let start = source
        .find(&header)
        .unwrap_or_else(|| panic!("no TypeScript file under check declares interface {name}"))
        + header.len()
        - 1;
    braced_block(&source[start..], &format!("interface {name}"))
} // End of function interface_body()

/// The property names declared directly by an interface body.
///
/// Only depth zero, so a nested object type's own keys are not mistaken for the
/// interface's.
fn interface_fields(source: &str, name: &str) -> BTreeSet<String> {
    block_fields(interface_body(source, name), &format!("interface {name}"))
}

/// The property names declared directly by an object-type body.
///
/// **Fails on an optional property.** `serde` writes `null` for a `None`, so
/// the key is always present and `x?: T` is a different contract from
/// `x: T | null`; with `exactOptionalPropertyTypes` on, TypeScript agrees they
/// are different. The old version stripped the `?` and compared the name alone,
/// so turning a required property optional passed silently — which is what the
/// review of Phase 1b-2a found.
fn block_fields(body: &str, what: &str) -> BTreeSet<String> {
    let mut fields = BTreeSet::new();
    for declaration in member_declarations(body) {
        let Some((field, optional)) = property_declaration(declaration.trim()) else {
            continue;
        };
        assert!(
            !optional,
            "{what} declares `{field}?:`, but serde always writes the key: \
             a nullable property is `{field}: T | null`, never `{field}?: T`"
        );
        fields.insert(field);
    } // End of the loop over the block's member declarations
    fields
} // End of function block_fields()

/// The member declarations an object-type body holds, at depth zero.
///
/// A member ends at a `;` or a newline outside any nested object type, so a
/// one-line `{ readonly key: string; readonly found: X }` declares two members
/// and not one. Split out of [`block_fields`] so that
/// [`interface_properties`] reads the same segments rather than a second
/// approximation of them.
fn member_declarations(body: &str) -> Vec<String> {
    let mut depth = 0usize;
    let mut segment = String::new();
    let mut segments: Vec<String> = Vec::new();
    for character in body.chars() {
        match character {
            '{' => {
                depth += 1;
                segment.push(character);
            }
            '}' => {
                depth = depth.saturating_sub(1);
                segment.push(character);
            }
            ';' | '\n' if depth == 0 => segments.push(std::mem::take(&mut segment)),
            _ => segment.push(character),
        }
    } // End of the loop over the block's characters
    segments.push(segment);
    segments
} // End of function member_declarations()

/// Every property an interface declares, with its optionality and its type text.
///
/// [`interface_fields`]'s sibling for a **deserialize-side** type, where `x?: T`
/// is a legal and meaningful declaration rather than the mistake
/// [`block_fields`] refuses: `serde` reads an omitted key as the field's
/// default, so an optional property is exactly what a `#[serde(default)]
/// Option<T>` field is. The type text is returned unresolved — this harness
/// resolves no TypeScript types — so a caller can only ask coarse questions of
/// it, such as whether `null` is among the things it admits.
fn interface_properties(source: &str, name: &str) -> BTreeMap<String, (bool, String)> {
    let mut properties = BTreeMap::new();
    for declaration in member_declarations(interface_body(source, name)) {
        let line = declaration.trim();
        let Some((field, optional)) = property_declaration(line) else {
            continue;
        };
        let colon = line.find(':').expect("a property declaration has a colon");
        properties.insert(field, (optional, line[colon + 1..].trim().to_owned()));
    } // End of the loop over the interface's member declarations
    properties
} // End of function interface_properties()

/// The property a line declares — its name, and whether it was written `name?:`.
fn property_declaration(line: &str) -> Option<(String, bool)> {
    let line = line.strip_prefix("readonly ").unwrap_or(line);
    let colon = line.find(':')?;
    let declared = line[..colon].trim();
    let optional = declared.ends_with('?');
    let name = declared.trim_end_matches('?');
    let is_identifier = !name.is_empty()
        && name
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '_');
    if is_identifier {
        Some((name.to_owned(), optional))
    } else {
        None
    }
} // End of function property_declaration()

/// The declaration text of `export type {name} = … ;`, terminator excluded.
///
/// The terminator is the first `;` **at brace depth zero**: a union whose
/// variants carry object types has semicolons inside them, and stopping at the
/// first one would silently truncate the declaration to its first variant.
fn union_body<'a>(source: &'a str, name: &str) -> &'a str {
    let header = format!("export type {name} =");
    let start = source
        .find(&header)
        .unwrap_or_else(|| panic!("src/lib/ipc/types.ts declares no type {name}"))
        + header.len();
    let mut depth = 0usize;
    for (offset, character) in source[start..].char_indices() {
        match character {
            '{' => depth += 1,
            '}' => depth = depth.saturating_sub(1),
            ';' if depth == 0 => return &source[start..start + offset],
            _ => {}
        }
    } // End of the loop looking for the declaration's terminator
    panic!("type {name} is never terminated");
} // End of function union_body()

/// The single-quoted literals of `export type {name} = … ;`.
pub(crate) fn union_members(source: &str, name: &str) -> BTreeSet<String> {
    quoted_literals(union_body(source, name))
}

/// Every name declared by an `export type {name} =` in a TypeScript file.
///
/// `crate::dictionary_contract` uses it to ask its third question — *is every
/// wire enum registered at all* — from the frontend's side, without a list of
/// enums anywhere. Returned in declaration order, deduplicated by the caller's
/// use of it.
pub(crate) fn declared_type_names(source: &str) -> Vec<String> {
    let header = "export type ";
    let mut names = Vec::new();
    let mut rest = source;
    while let Some(at) = rest.find(header) {
        rest = &rest[at + header.len()..];
        let name: String = rest
            .chars()
            .take_while(|character| character.is_ascii_alphanumeric() || *character == '_')
            .collect();
        // A generic or a type this scan cannot address by name is skipped
        // rather than guessed at; every wire enum is a plain identifier.
        if !name.is_empty() && rest[name.len()..].trim_start().starts_with('=') {
            names.push(name);
        }
    } // End of the loop over the file's type declarations
    names
} // End of function declared_type_names()

/// The property names of one externally tagged variant of a union.
///
/// Finds `readonly {variant}: {` inside the union's declaration and reads the
/// object type that follows. Returns `None` for a variant the union declares as
/// a bare string literal, which carries no operands. This is what closes the
/// review's example of a nested field renamed from `byte_index` to `byteIndex`:
/// the union check sees variant *names* only, and would not have noticed.
///
/// **It also answers `None` for a payload written as a type reference**, e.g.
/// `readonly Parse: ParseFailure`. Phase 2b-1 added eleven such variants, and
/// without this guard the scan walked past the reference to the *next* variant's
/// braces and compared one variant's operands against another's — a failure whose
/// message pointed at the wrong declaration entirely. Resolving the reference is
/// deliberately not attempted; the referenced type is checked on its own, exactly
/// as `ValueView`'s named-interface payloads are.
///
/// **`Record<string, never>` is the one reference it does resolve**, and it
/// resolves to the empty operand set. It is the TypeScript spelling of *an
/// object with no properties whatsoever* — the shape `serde` writes for a struct
/// variant with no fields — and treating it as an unresolvable reference made
/// every such variant a **skip**: nothing then pinned that Rust writes `{}` and
/// that TypeScript declares no operands, so an operand added on one side only
/// stayed green.
///
/// **The whole payload must be that spelling and nothing else**, up to the `}`
/// that closes the one-key variant object. Merely *starting with* it is not
/// enough and the difference is the finding this check exists for:
/// `Record<string, never> | { readonly force: boolean }` starts with it, declares
/// a real operand on the TypeScript side alone, and would still have been
/// compared against `serde`'s `{}` and passed. A union, an intersection, an array
/// suffix or any other continuation is therefore not this payload, and answering
/// `None` for one makes it a counted skip rather than a silent check — which the
/// `(checked, nested, unit)` assertion below then fails.
///
/// `{}` is deliberately **not** accepted as the same thing either: in TypeScript
/// it means *any non-nullish value*, which is not an object with no properties,
/// so a real operand could hide behind it.
fn tagged_variant_fields(source: &str, union: &str, variant: &str) -> Option<BTreeSet<String>> {
    let body = union_body(source, union);
    let header = format!("readonly {variant}: ");
    let start = body.find(&header)? + header.len();
    let payload = body[start..].trim_start();
    if let Some(rest) = payload.strip_prefix(EMPTY_PAYLOAD) {
        // The enclosing variant boundary, and nothing between it and the
        // spelling: `}` closes the `{ readonly Variant: … }` object.
        if rest.trim_start().starts_with('}') {
            return Some(BTreeSet::new());
        }
        return None;
    }
    if !payload.starts_with('{') {
        return None;
    }
    let what = format!("the {variant} payload of type {union}");
    let block = braced_block(&body[start..], &what);
    if block.trim().is_empty() {
        return None;
    }
    Some(block_fields(block, &what))
} // End of function tagged_variant_fields()

/// A synthetic union declaring one variant with `payload` as its payload.
///
/// Written as text because [`tagged_variant_fields`] reads text: the point of
/// the tests below is what the **parser** does with a spelling, and building the
/// spelling by hand is the only way to exercise one `src/lib/ipc/types.ts` does
/// not contain.
fn one_variant_union(payload: &str) -> String {
    format!("export type Probe =\n  | {{ readonly Only: {payload} }}\n  | {{ readonly Other: {{ readonly kept: string }} }};\n")
} // End of function one_variant_union()

/// The empty payload is recognised **only** as its exact spelling.
///
/// **The mutation this pins is one-sided, which is why the counts alone could
/// not catch it.** Before the second review round the check accepted any payload
/// that merely *started with* `Record<string, never>`, so
/// `Record<string, never> | { readonly force: boolean }` came back as the empty
/// field set, kept the `(checked, nested, unit)` totals exactly where they were,
/// and compared clean against the `{}` `serde` writes — a real operand declared
/// on the TypeScript side alone, admitted by the very check that claims to
/// forbid it.
///
/// Each rejected spelling below is a distinct way of continuing the reference: a
/// union, an intersection, an array suffix and an identifier suffix. `{}` is
/// rejected for its own reason — it is TypeScript for *any non-nullish value*,
/// not for an object with no properties — and the exact spelling is asserted
/// accepted first, so this cannot pass by rejecting everything.
#[test]
fn only_the_exact_empty_payload_spelling_is_a_checked_zero_field_payload() {
    let exact = one_variant_union(EMPTY_PAYLOAD);
    assert_eq!(
        tagged_variant_fields(&exact, "Probe", "Only"),
        Some(BTreeSet::new()),
        "the exact spelling is the one checked zero-field payload"
    );
    // The premise: a real payload beside it still reads as its own operands, so
    // a rejection below is about the spelling and not about the harness.
    assert_eq!(
        tagged_variant_fields(&exact, "Probe", "Other"),
        Some(BTreeSet::from(["kept".to_owned()])),
        "an ordinary braced payload is unaffected"
    );

    for spelling in [
        "Record<string, never> | { readonly force: boolean }",
        "Record<string, never> & { readonly force: boolean }",
        "Record<string, never>[]",
        "Record<string, never>Extra",
        "{}",
    ] {
        assert_eq!(
            tagged_variant_fields(&one_variant_union(spelling), "Probe", "Only"),
            None,
            "`{spelling}` is not the empty payload and must not be read as one"
        );
    } // End of the loop over the spellings that are not the empty payload
} // End of function only_the_exact_empty_payload_spelling_is_a_checked_zero_field_payload()

/// How `src/lib/ipc/types.ts` spells *an object with no properties at all*.
///
/// Written once because [`tagged_variant_fields`] recognises it as a checked
/// zero-field payload, and a second spelling of it would silently become a skip
/// again.
const EMPTY_PAYLOAD: &str = "Record<string, never>";

/// The `{ code: { operand: 'shape' } }` table declared by `errors.ts`.
///
/// `isCommandError` validates a rejection against this table, so the table is
/// itself part of the wire contract: a shape declared here that Rust does not
/// write would make the guard reject a genuine rejection, and a missing entry
/// would let a malformed one through. Parsed rather than trusted for the same
/// reason every other declaration in these files is.
fn operand_table(source: &str) -> BTreeMap<String, BTreeMap<String, String>> {
    let header = "export const COMMAND_ERROR_OPERANDS";
    let start = source
        .find(header)
        .expect("src/lib/ipc/errors.ts declares no COMMAND_ERROR_OPERANDS");
    let body = braced_block(&source[start..], "COMMAND_ERROR_OPERANDS");

    let mut table = BTreeMap::new();
    let mut rest = body;
    while let Some(colon) = rest.find(':') {
        let code: String = rest[..colon]
            .trim()
            .trim_start_matches([',', '\n'])
            .trim()
            .to_owned();
        let after = &rest[colon + 1..];
        let open = after
            .find('{')
            .unwrap_or_else(|| panic!("the entry for {code} declares no operand object"));
        let group = braced_block(after, &format!("the entry for {code}"));
        table.insert(code, operand_shapes(group));
        // Step past this entry's closing brace, whose offset is the group's end
        // plus the brace itself.
        let consumed = open + 1 + group.len() + 1;
        rest = &after[consumed.min(after.len())..];
    } // End of the loop over the table's entries
    table
} // End of function operand_table()

/// The `name: 'shape'` pairs of one operand object.
fn operand_shapes(group: &str) -> BTreeMap<String, String> {
    let mut shapes = BTreeMap::new();
    for entry in group.split(',') {
        let Some((name, shape)) = entry.split_once(':') else {
            continue;
        };
        let name = name.trim();
        if name.is_empty() {
            continue;
        }
        let shape = shape.trim().trim_matches('\'');
        shapes.insert(name.to_owned(), shape.to_owned());
    }
    shapes
} // End of function operand_shapes()

/// The shape name `errors.ts` uses for a JSON operand.
///
/// `object` arrived at Phase 2b-2a with `CommandError::SaveFailed`, whose first
/// operand is a whole `SaveError`. It is deliberately the **weakest** shape in
/// the table — `isCommandError` can say the operand is there and is an object,
/// and nothing more — because validating a nested wire enum at the guard would
/// mean reimplementing `SaveError`'s nine variants in a runtime check. What keeps
/// that payload honest is the union check over `type SaveError` a few tests up,
/// not this.
///
/// `boolean` arrived with the same variant's **second** operand,
/// `may_have_written`, which is the core's own predicate evaluated at
/// serialization time rather than a field (`crate::error::CommandError`). It is
/// the one operand on this boundary a frontend *branches on to decide what to do
/// with the screen*, so the guard checking its type is the difference between
/// "the file may have been replaced" and `undefined`, which is falsy.
fn shape_of(value: &Value) -> String {
    match value {
        Value::String(_) => "string".to_owned(),
        Value::Number(_) => "number".to_owned(),
        Value::Bool(_) => "boolean".to_owned(),
        Value::Array(items) if items.iter().all(Value::is_string) => "stringArray".to_owned(),
        Value::Object(_) => "object".to_owned(),
        other => panic!("{other} is not a shape the operand table can describe"),
    }
}

/// The TypeScript interface name `errors.ts` gives one error code.
///
/// Mechanical rather than a second hand-written table: the convention is the
/// code with its first letter capitalised, plus `Error`. A file that stopped
/// following it would fail with "declares no interface", which is the point.
fn error_interface_name(code: &str) -> String {
    let mut characters = code.chars();
    let first = characters.next().expect("a code is never empty");
    format!("{}{}Error", first.to_ascii_uppercase(), characters.as_str())
}

/// Every command name registered in `main.rs`'s `generate_handler!`.
///
/// Parsed **independently** of the frontend list. The earlier version filtered
/// the frontend's own names through `main.rs` and so could only ever report
/// names the frontend already knew about: adding `commands::save_match` to the
/// macro and nothing else left every declared name found and the test green,
/// which is exactly the scope creep the test claimed to catch.
///
/// `crate::dispatch_check` calls it too, so the remote-origin sweep attempts
/// the registered commands rather than a list somebody kept in step by hand.
pub(crate) fn registered_commands() -> BTreeSet<String> {
    let main = read_without_comments("src-tauri/src/main.rs");
    let header = "generate_handler![";
    let start = main
        .find(header)
        .expect("main.rs registers commands with generate_handler!")
        + header.len();
    let end = main[start..]
        .find(']')
        .expect("the generate_handler! list is never closed");
    main[start..start + end]
        .split(',')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(|entry| {
            entry
                .rsplit("::")
                .next()
                .expect("a path has a last segment")
                .to_owned()
        })
        .collect()
} // End of function registered_commands()

/// The mutating commands Phase 2 owns and this phase must not ship.
///
/// Named here so that a check can assert their absence rather than a comment
/// asserting an intention. `crate::commands` names the same ones in prose; this
/// is the version that can fail.
///
/// **`move_match` left this list at Phase 2b-2a, `save_match` at Phase 2b-2b-3,
/// `create_match` and `delete_match` at Phase 2b-2c-2, and `save_raw_document`
/// at Phase 2b-2c-3b**, which is the only way a name may leave it: the command
/// exists, is registered, and writes a user's file through
/// `espansoconfig_core::persist::save_document`. `save_raw_document` could not
/// leave it any earlier than it did — a whole-document text is not a span
/// replacement, so `SaveRequest` had to gain a second content mode first
/// (Phase 2b-2c-3a), and forcing the command into existence before that would
/// have meant writing a file outside the transaction.
///
/// **The one that remains has no phase yet.** `validate_match` is Phase 2c's, and
/// its absence is asserted rather than intended.
const FORBIDDEN_COMMANDS: [&str; 1] = ["validate_match"];

/// The single-quoted literals of `export const {name} = [ … ]`.
///
/// `crate::menu_contract` calls this too, for `MENU_LABEL_FIELDS`, so there is
/// one parser of a TypeScript constant array in the crate rather than two that
/// could disagree about what one looks like.
pub(crate) fn const_array_members(source: &str, name: &str) -> BTreeSet<String> {
    let header = format!("export const {name} = [");
    let start = source
        .find(&header)
        .unwrap_or_else(|| panic!("no const {name} was declared"))
        + header.len();
    let end = source[start..]
        .find(']')
        .unwrap_or_else(|| panic!("const {name} is never closed"));
    quoted_literals(&source[start..start + end])
}

/// Every `'single quoted'` run in a slice of TypeScript.
fn quoted_literals(text: &str) -> BTreeSet<String> {
    let mut found = BTreeSet::new();
    let mut rest = text;
    while let Some(open) = rest.find('\'') {
        let after = &rest[open + 1..];
        let Some(close) = after.find('\'') else {
            break;
        };
        found.insert(after[..close].to_owned());
        rest = &after[close + 1..];
    }
    found
} // End of function quoted_literals()

/// The variant name of a serialized value, tagged or not.
///
/// A unit variant crosses as its bare name; a variant with operands crosses as
/// a one-key object whose key is the name.
fn variant_name(value: &Value) -> String {
    match value {
        Value::String(name) => name.clone(),
        Value::Object(map) if map.len() == 1 => map
            .keys()
            .next()
            .expect("a one-key object has a key")
            .clone(),
        other => panic!("{other} is not an externally tagged enum"),
    }
}

/// The variant names of a list of enum values.
fn variant_names<T: Serialize>(values: &[T]) -> BTreeSet<String> {
    values
        .iter()
        .map(|value| variant_name(&json_of(value)))
        .collect()
}

/// Fails when two name sets differ, saying which side has what.
fn assert_same_names(what: &str, rust: &BTreeSet<String>, typescript: &BTreeSet<String>) {
    let missing: Vec<&String> = rust.difference(typescript).collect();
    let surplus: Vec<&String> = typescript.difference(rust).collect();
    assert!(
        missing.is_empty() && surplus.is_empty(),
        "{what}: TypeScript is missing {missing:?} and declares {surplus:?} that Rust never writes"
    );
}

/// The keys of a serialized object.
fn json_keys(value: &Value) -> BTreeSet<String> {
    value
        .as_object()
        .unwrap_or_else(|| panic!("{value} is not a JSON object"))
        .keys()
        .cloned()
        .collect()
}

/// Descends to a `ValueView` variant's payload object.
fn tagged_payload(value: &Value, tag: &str) -> Value {
    value
        .get(tag)
        .unwrap_or_else(|| panic!("the sample value is not a {tag}: {value}"))
        .clone()
}

/// Every interface of `types.ts` paired with the JSON `serde` really writes.
///
/// The projection is the source of every model sample, so what is compared is
/// what a document actually produces rather than what a struct literal could be
/// made to produce. The two summaries are struct literals because they have no
/// projection behind them — and a struct literal has its own guarantee: adding
/// a field to either makes this module fail to compile.
fn samples() -> Vec<(&'static str, Value)> {
    let view = project("match/synthetic.yml", MATCH_FILE);
    let profile = project("config/synthetic.yml", PROFILE_FILE);

    let first = view.matches.first().expect("the fixture has five matches");
    let second = view.matches.get(1).expect("the fixture has five matches");
    let third = view.matches.get(2).expect("the fixture has five matches");

    let scalar = first
        .trigger
        .trigger
        .as_ref()
        .expect("the first match has a trigger");
    let variable = first.vars.first().expect("the first match has a variable");
    let field = variable.params.first().expect("the variable has params");
    let alias_field = third
        .vars
        .first()
        .expect("the third match has a variable")
        .params
        .first()
        .expect("that variable has params");
    assert!(
        matches!(alias_field.value, ValueView::Alias(_)),
        "the fixture's alias stopped being an alias, so AliasView has no sample"
    );
    let elided = second
        .trigger
        .triggers
        .get(1)
        .expect("the second match has two trigger entries");
    assert!(
        matches!(elided, ValueView::Elided { .. }),
        "the fixture's non-scalar trigger entry stopped being elided"
    );
    let unknown = view
        .all_unknown_entries()
        .into_iter()
        .next()
        .expect("the fixture holds an unrecognised key");

    let summary = DocumentSummary {
        id: DocumentId(0),
        path: WirePath::new("/nowhere/match/synthetic.yml"),
        relative_path: WirePath::new("match/synthetic.yml"),
        kind: FileKind::MatchFile,
        disabled: false,
        read_only: false,
        loaded: true,
    };
    let workspace = WorkspaceSummary {
        root: WirePath::new("/nowhere"),
        documents: 2,
        match_files: 1,
        config_profiles: 1,
        packages: 0,
        disabled: 0,
    };

    vec![
        ("ByteSpan", json_of(&first.span)),
        (
            "DocumentPath",
            json_of(first.path.as_ref().expect("a path")),
        ),
        ("ScalarView", json_of(scalar)),
        (
            "AliasView",
            tagged_payload(&json_of(&alias_field.value), "Alias"),
        ),
        ("ElidedValue", tagged_payload(&json_of(elided), "Elided")),
        ("FieldView", json_of(field)),
        ("UnknownEntry", json_of(unknown)),
        (
            "MappingCoverage",
            json_of(view.coverage.first().expect("a coverage record")),
        ),
        (
            "Diagnostic",
            json_of(view.diagnostics.first().expect("a diagnostic")),
        ),
        ("MatchId", json_of(&first.id)),
        ("TriggerSpec", json_of(&first.trigger)),
        ("ContentSpec", json_of(&first.content)),
        ("MatchOptions", json_of(&first.options)),
        ("VariableView", json_of(variable)),
        ("MatchView", json_of(first)),
        (
            "ConfigProfileView",
            json_of(profile.profile.as_ref().expect("a projected profile")),
        ),
        ("DocumentView", json_of(&view)),
        ("DocumentSummary", json_of(&summary)),
        ("WorkspaceSummary", json_of(&workspace)),
    ]
} // End of function samples()

/// Every interface declares exactly the properties `serde` writes.
#[test]
fn every_interface_declares_exactly_the_properties_serde_writes() {
    let source = read_without_comments("src/lib/ipc/types.ts");
    for (name, value) in samples() {
        let declared = interface_fields(&source, name);
        let written = json_keys(&value);
        assert_same_names(&format!("interface {name}"), &written, &declared);
    }
} // End of function every_interface_declares_exactly_the_properties_serde_writes()

/// Compile-time tripwire for the two enumerations most likely to grow.
///
/// A variant added to either makes one of these matches non-exhaustive, which
/// is a compile error in `cargo test`, which is the prompt to extend the lists
/// below **and** `src/lib/ipc/types.ts`. The smaller enumerations have no such
/// tripwire; that is the hole this module's documentation names.
fn tripwire(code: &DiagnosticCode, hazard: HazardKind) {
    match code {
        DiagnosticCode::ParseFailed { .. }
        | DiagnosticCode::IndexRejected
        | DiagnosticCode::NoDocument
        | DiagnosticCode::EmptyDocument { .. }
        | DiagnosticCode::AdditionalDocumentNotProjected { .. }
        | DiagnosticCode::RootIsNotAMapping { .. }
        | DiagnosticCode::FieldHasUnexpectedShape { .. }
        | DiagnosticCode::RepeatedKey { .. }
        | DiagnosticCode::NonScalarKey
        | DiagnosticCode::ShapeDisagreesWithLocation { .. }
        | DiagnosticCode::MatchHasNoTrigger
        | DiagnosticCode::MatchHasSeveralTriggerForms { .. }
        | DiagnosticCode::MatchHasNoContent
        | DiagnosticCode::MatchHasSeveralContentForms { .. }
        | DiagnosticCode::MatchIsNotAMapping { .. }
        | DiagnosticCode::VariableIsNotAMapping { .. }
        | DiagnosticCode::VariableHasNoName
        | DiagnosticCode::VariableHasNoType
        | DiagnosticCode::ScalarNotDecodable
        | DiagnosticCode::ValueTooDeep { .. }
        | DiagnosticCode::CoverageIsIncomplete
        | DiagnosticCode::KeyNotAccountedFor
        | DiagnosticCode::Hazard { .. } => {}
    }
    match hazard {
        HazardKind::CommentInFlowCollection
        | HazardKind::ExplicitKeyMapping
        | HazardKind::TruncatedBlockScalarHeader
        | HazardKind::UnclassifiedTrivia
        | HazardKind::AnchorDefinition
        | HazardKind::AliasReference
        | HazardKind::MergeKey
        | HazardKind::DuplicateMappingKey
        | HazardKind::ExplicitTag
        | HazardKind::MultiDocumentStream => {}
    }
} // End of function tripwire()

/// One value of every [`DiagnosticCode`] variant.
///
/// A function rather than a local, because two tests need it: the union check
/// reads the variant *names* off these, and the tagged-operand check reads what
/// is inside each of them.
fn diagnostic_code_samples() -> Vec<DiagnosticCode> {
    vec![
        DiagnosticCode::ParseFailed {
            line: 1,
            column: 2,
            byte_index: Some(3),
        },
        DiagnosticCode::IndexRejected,
        DiagnosticCode::NoDocument,
        DiagnosticCode::EmptyDocument { document_index: 0 },
        DiagnosticCode::AdditionalDocumentNotProjected { document_index: 1 },
        DiagnosticCode::RootIsNotAMapping {
            found: ValueKind::Sequence,
        },
        DiagnosticCode::FieldHasUnexpectedShape {
            key: "trigger".to_owned(),
            found: ValueKind::Sequence,
        },
        DiagnosticCode::RepeatedKey {
            key: "trigger".to_owned(),
        },
        DiagnosticCode::NonScalarKey,
        DiagnosticCode::ShapeDisagreesWithLocation {
            shape: DocumentShape::MatchFile,
        },
        DiagnosticCode::MatchHasNoTrigger,
        DiagnosticCode::MatchHasSeveralTriggerForms { count: 2 },
        DiagnosticCode::MatchHasNoContent,
        DiagnosticCode::MatchHasSeveralContentForms { count: 2 },
        DiagnosticCode::MatchIsNotAMapping {
            found: ValueKind::Scalar,
        },
        DiagnosticCode::VariableIsNotAMapping {
            found: ValueKind::Scalar,
        },
        DiagnosticCode::VariableHasNoName,
        DiagnosticCode::VariableHasNoType,
        DiagnosticCode::ScalarNotDecodable,
        DiagnosticCode::ValueTooDeep { depth: 64 },
        DiagnosticCode::CoverageIsIncomplete,
        DiagnosticCode::KeyNotAccountedFor,
        DiagnosticCode::Hazard {
            kind: HazardKind::MergeKey,
        },
    ]
} // End of function diagnostic_code_samples()

/// One value of every [`HazardKind`] variant.
fn hazard_samples() -> Vec<HazardKind> {
    vec![
        HazardKind::CommentInFlowCollection,
        HazardKind::ExplicitKeyMapping,
        HazardKind::TruncatedBlockScalarHeader,
        HazardKind::UnclassifiedTrivia,
        HazardKind::AnchorDefinition,
        HazardKind::AliasReference,
        HazardKind::MergeKey,
        HazardKind::DuplicateMappingKey,
        HazardKind::ExplicitTag,
        HazardKind::MultiDocumentStream,
    ]
}

/// One value of every [`UnknownReason`] variant.
fn unknown_reason_samples() -> Vec<UnknownReason> {
    vec![
        UnknownReason::NotModelled,
        UnknownReason::UnexpectedShape {
            found: ValueKind::Sequence,
        },
        UnknownReason::RepeatedKey,
        UnknownReason::NonScalarKey,
    ]
}

/// Every externally tagged variant that carries operands, with its union.
///
/// The two enumerations whose payloads are object types. `ValueView` is
/// deliberately absent: its payloads are named interfaces, which `samples()`
/// already checks one by one.
fn tagged_samples() -> Vec<(&'static str, Value)> {
    let mut samples: Vec<(&'static str, Value)> = diagnostic_code_samples()
        .iter()
        .map(|code| ("DiagnosticCode", json_of(code)))
        .collect();
    samples.extend(
        unknown_reason_samples()
            .iter()
            .map(|reason| ("UnknownReason", json_of(reason))),
    );
    samples
} // End of function tagged_samples()

/// Every enumeration's TypeScript union is exactly its Rust variant set.
#[test]
fn every_union_declares_exactly_the_rust_variants() {
    let source = read_without_comments("src/lib/ipc/types.ts");

    let diagnostic_codes = diagnostic_code_samples();
    let hazards = hazard_samples();
    for code in &diagnostic_codes {
        for hazard in &hazards {
            tripwire(code, *hazard);
        }
    }

    let unions: Vec<(&str, BTreeSet<String>)> = vec![
        ("DiagnosticCodeName", variant_names(&diagnostic_codes)),
        ("HazardKind", variant_names(&hazards)),
        (
            "ScalarStyle",
            variant_names(&[
                ScalarStyle::Plain,
                ScalarStyle::SingleQuoted,
                ScalarStyle::DoubleQuoted,
                ScalarStyle::Literal,
                ScalarStyle::Folded,
            ]),
        ),
        (
            "LineEnding",
            variant_names(&[LineEnding::Lf, LineEnding::Crlf]),
        ),
        (
            "FileKind",
            variant_names(&[
                FileKind::MatchFile,
                FileKind::ConfigProfile,
                FileKind::Package,
            ]),
        ),
        (
            "DocumentShape",
            variant_names(&[
                DocumentShape::MatchFile,
                DocumentShape::ConfigProfile,
                DocumentShape::Other,
            ]),
        ),
        (
            "ValueKind",
            variant_names(&[
                ValueKind::Scalar,
                ValueKind::Sequence,
                ValueKind::Mapping,
                ValueKind::Alias,
                ValueKind::Other,
            ]),
        ),
        (
            "TriggerKind",
            variant_names(&[
                TriggerKind::Single,
                TriggerKind::Multiple,
                TriggerKind::Regex,
                TriggerKind::Several,
                TriggerKind::Absent,
            ]),
        ),
        (
            "ContentKind",
            variant_names(&[
                ContentKind::Replace,
                ContentKind::Markdown,
                ContentKind::Html,
                ContentKind::ImagePath,
                ContentKind::Form,
                ContentKind::Several,
                ContentKind::Absent,
            ]),
        ),
        (
            "VariableKind",
            variant_names(&[
                VariableKind::Date,
                VariableKind::Choice,
                VariableKind::Random,
                VariableKind::Clipboard,
                VariableKind::Echo,
                VariableKind::Shell,
                VariableKind::Script,
                VariableKind::Form,
                VariableKind::Match,
                VariableKind::Unrecognised,
                VariableKind::Absent,
            ]),
        ),
        (
            "MatchBadge",
            variant_names(&[
                MatchBadge::Regex,
                MatchBadge::MultipleTriggers,
                MatchBadge::Form,
                MatchBadge::Html,
                MatchBadge::Markdown,
                MatchBadge::Image,
                MatchBadge::Variables,
                MatchBadge::Shell,
                MatchBadge::Script,
                MatchBadge::NotEditable,
            ]),
        ),
        (
            "UnknownReasonName",
            variant_names(&unknown_reason_samples()),
        ),
    ];

    for (name, rust) in unions {
        let declared = union_members(&source, name);
        assert_same_names(&format!("type {name}"), &rust, &declared);
    } // End of the loop over the enumerations
} // End of function every_union_declares_exactly_the_rust_variants()

/// Every tagged variant's operands are exactly the keys `serde` writes.
///
/// The union check above compares variant *names*; this compares what is inside
/// each variant. Renaming `byte_index` to `byteIndex` in the `ParseFailed`
/// payload, or dropping `document_index` from `EmptyDocument`, passed every
/// check before this one existed.
#[test]
fn every_tagged_variant_declares_exactly_the_operands_serde_writes() {
    let source = read_without_comments("src/lib/ipc/types.ts");
    let mut checked = 0usize;
    for (union, json) in tagged_samples() {
        let Value::Object(map) = &json else {
            continue;
        };
        let variant = variant_name(&json);
        let Some(payload) = map.get(&variant).and_then(Value::as_object) else {
            continue;
        };
        let written: BTreeSet<String> = payload.keys().cloned().collect();
        let declared = tagged_variant_fields(&source, union, &variant).unwrap_or_else(|| {
            panic!("type {union} declares no payload for the {variant} variant")
        });
        assert_same_names(
            &format!("the {variant} payload of type {union}"),
            &written,
            &declared,
        );
        checked += 1;
    } // End of the loop over the tagged samples
    assert_eq!(
        checked, 14,
        "the tagged-variant sample list stopped covering every variant that carries operands"
    );
} // End of function every_tagged_variant_declares_exactly_the_operands_serde_writes()

/// The frontend's error-code list is exactly the codes Rust can produce.
#[test]
fn the_frontend_error_codes_are_exactly_the_rust_codes() {
    let source = read_without_comments("src/lib/ipc/errors.ts");
    let declared = const_array_members(&source, "COMMAND_ERROR_CODES");
    let produced: BTreeSet<String> = every_command_error()
        .iter()
        .map(|error| error.code().to_owned())
        .collect();
    assert_same_names("COMMAND_ERROR_CODES", &produced, &declared);
}

/// Every error interface declares exactly the operands `serde` writes.
///
/// `wire_contract.rs` checked no frontend *error* interface at all before the
/// review of Phase 1b-2a: renaming `IoError.path` to `filename` passed. The
/// interface name is derived from the code rather than listed, so a file that
/// stopped following the naming convention fails here too.
#[test]
fn every_error_interface_declares_exactly_the_operands_serde_writes() {
    let source = read_without_comments("src/lib/ipc/errors.ts");
    for error in every_command_error() {
        let name = error_interface_name(error.code());
        let declared = interface_fields(&source, &name);
        let written = json_keys(&json_of(&error));
        assert_same_names(&format!("interface {name}"), &written, &declared);
    } // End of the loop over every command error
} // End of function every_error_interface_declares_exactly_the_operands_serde_writes()

/// The operand table `isCommandError` validates against is the real operands.
///
/// Names **and** shapes: `notUtf8.offset` declared as `'string'` fails here,
/// which is the type check the read model's own interfaces still do not get.
/// Without this the guard could be strict about the wrong thing and reject a
/// genuine rejection, which is worse than being lax.
#[test]
fn the_frontend_operand_table_is_the_operands_rust_writes() {
    let source = read_without_comments("src/lib/ipc/errors.ts");
    let table = operand_table(&source);
    let codes: BTreeSet<String> = table.keys().cloned().collect();
    let produced: BTreeSet<String> = every_command_error()
        .iter()
        .map(|error| error.code().to_owned())
        .collect();
    assert_same_names("COMMAND_ERROR_OPERANDS", &produced, &codes);

    for error in every_command_error() {
        let code = error.code();
        let declared = table.get(code).expect("the code sets already agree");
        let json = json_of(&error);
        let written: BTreeMap<String, String> = json
            .as_object()
            .expect("an error is a JSON object")
            .iter()
            .filter(|(key, _)| key.as_str() != "code")
            .map(|(key, value)| (key.clone(), shape_of(value)))
            .collect();
        assert_eq!(
            &written, declared,
            "COMMAND_ERROR_OPERANDS[{code}] is not what Rust writes"
        );
    } // End of the loop over every command error
} // End of function the_frontend_operand_table_is_the_operands_rust_writes()

/// Every `DraftError` variant crosses as a JSON **object**, never a bare string.
///
/// The check the operand table cannot make for itself.
/// [`the_frontend_operand_table_is_the_operands_rust_writes`] derives each
/// declared shape from what `serde` writes for a **sampled** variant, and
/// `crate::error::every_command_error` holds one instance per code — so exactly
/// one shape can ever be pinned for `draftRefused.error`, no matter how many
/// variants `DraftError` has. `serde`'s externally tagged representation writes a
/// unit variant as a bare string and everything else as a one-key object, so a
/// single unit variant among the thirty-two would make the pinned `'object'`
/// false for that one refusal: `isCommandError` would reject it, and the user
/// would read the generic fallback instead of the sentence
/// `code.draftError.matchHasNoPath` that exists for it in both dictionaries.
///
/// **Derived from the declaration, not from a list.** The variant set is parsed
/// out of `crates/espansoconfig-core/src/draft/error.rs` — the vacuous-audit
/// corollary (`PROGRESS.md`, D2w) — so a unit variant added there fails this test
/// rather than silently degrading a refusal to "unexpected". `MatchHasNoPath {}`
/// is the empty struct variant that shape rule exists for, and its JSON is
/// asserted here rather than assumed.
#[test]
fn every_draft_error_variant_crosses_as_an_object() {
    let (declared, bare) = crate::dictionary_contract::variants_and_unit_variants_of("DraftError");
    assert_eq!(
        declared.len(),
        32,
        "DraftError declared 32 refusals when this check was written: {declared:?}"
    );
    assert!(
        bare.is_empty(),
        "a unit variant crosses as a bare string, which COMMAND_ERROR_OPERANDS cannot \
         declare beside the thirty-one objects; give it empty braces: {bare:?}"
    );

    // The `serde` behaviour the assertion above stands on, observed rather than
    // taken on trust: an empty struct variant is written as a one-key object.
    let refusal = json_of(&DraftError::MatchHasNoPath {});
    assert_eq!(refusal, serde_json::json!({ "MatchHasNoPath": {} }));

    // And the whole point of it: this refusal now matches the shape the frontend
    // pins, which is what keeps its typed code rather than the generic fallback.
    let declared_shape = operand_table(&read_without_comments("src/lib/ipc/errors.ts"))
        .remove("draftRefused")
        .expect("COMMAND_ERROR_OPERANDS declares draftRefused")
        .remove("error")
        .expect("the draftRefused entry declares an error operand");
    let written = json_of(&CommandError::DraftRefused {
        error: DraftError::MatchHasNoPath {},
    });
    assert_eq!(
        shape_of(&written["error"]),
        declared_shape,
        "the operand table and the refusal with no operands disagree: {written}"
    );
} // End of function every_draft_error_variant_crosses_as_an_object()

/// Every `EditError` variant crosses as a JSON **object**, and so does every
/// `SaveError` that could carry one.
///
/// **The premise Phase 2b-2c-2's design consult made its Q5 ruling conditional
/// on.** `create_match` and `delete_match` deliberately do **not** pre-plan their
/// primitive: the eight insertion and removal refusals are raised inside the
/// transaction, under the lock, and reach a caller as
/// `CommandError::SaveFailed { error: SaveError::Patch(EditError::…) }`. That is
/// only a *typed* refusal on the wire if the whole chain keeps its shape, and the
/// shape is what [`COMMAND_ERROR_OPERANDS`] pins with one word: `error: 'object'`.
///
/// Two levels can break it and both are asserted, because
/// [`the_frontend_operand_table_is_the_operands_rust_writes`] can pin exactly one
/// shape per code and `crate::error::every_command_error` holds one `SaveFailed`
/// sample. A unit variant anywhere in either enum would cross as a **bare
/// string**, `isCommandError` would reject the rejection, and a user would read
/// the generic *something went wrong* instead of the sentence
/// `code.editError.removalWouldEmptyTheSequence` that already exists for it in
/// both dictionaries — which is precisely the refusal a person meets by trying to
/// delete the last snippet of a file.
///
/// **Derived from the declarations, not from a list** (`PROGRESS.md`, D2w), so a
/// unit variant added to either enum fails here rather than degrading a refusal
/// in silence. The `serde` behaviour the assertions stand on is observed at the
/// bottom rather than taken on trust.
#[test]
fn every_edit_error_variant_crosses_as_an_object() {
    for (name, count) in [("EditError", 40), ("SaveError", 10)] {
        let (declared, bare) = crate::dictionary_contract::variants_and_unit_variants_of(name);
        assert_eq!(
            declared.len(),
            count,
            "{name} declared {count} variants when this check was written: {declared:?}"
        );
        assert!(
            bare.is_empty(),
            "a unit variant of {name} crosses as a bare string, which \
             COMMAND_ERROR_OPERANDS cannot declare beside the objects around it; give it \
             empty braces: {bare:?}"
        );
    } // End of the loop over the two enums a failed save nests

    // And the whole point of it, observed on the real value: a refusal raised by
    // the insertion primitive inside the transaction arrives as a one-key object
    // at both levels, matching the shape the frontend pins.
    let refusal = CommandError::SaveFailed {
        error: SaveError::Patch(EditError::RemovalWouldEmptyTheSequence {
            edit: 0,
            sequence: a_node(),
        }),
    };
    let written = json_of(&refusal);
    assert_eq!(written["code"], "saveFailed");
    assert!(
        written["error"]["Patch"]["RemovalWouldEmptyTheSequence"]["edit"].is_number(),
        "the engine's own refusal must survive both tags: {written}"
    );
    let declared_shape = operand_table(&read_without_comments("src/lib/ipc/errors.ts"))
        .remove("saveFailed")
        .expect("COMMAND_ERROR_OPERANDS declares saveFailed")
        .remove("error")
        .expect("the saveFailed entry declares an error operand");
    assert_eq!(
        shape_of(&written["error"]),
        declared_shape,
        "the operand table and a nested patch refusal disagree: {written}"
    );
} // End of function every_edit_error_variant_crosses_as_an_object()

/// The frontend's command names are the registered commands, both ways.
///
/// The earlier version of this test built its `registered` set by filtering the
/// **frontend's own** names through `main.rs`, so a command registered and
/// declared nowhere else was invisible to it: adding `commands::save_match` to
/// `generate_handler!` left all five declared names found and the test green.
/// The registered set is now parsed out of `generate_handler!` independently and
/// compared in both directions, and the mutating names Phase 2 owns but has not
/// yet built are asserted absent from both sets — because "no command this phase
/// did not mean to ship is registered" is the claim this check exists to keep
/// true, and it was not being checked.
///
/// Phase 1b-2b added the menu name, and it is deliberately read from a
/// **different** frontend file: `MENU_COMMAND_NAMES` in `src/lib/ipc/menu.ts`.
/// The menu command is not a workspace command and does not belong in
/// `COMMAND_NAMES`, but it is registered in the same macro, so the union of the
/// two declarations is what the registered set has to equal.
///
/// Phase 1c-2b-2a adds `document_text` to the read-only list, taking it to six
/// and the whole surface to seven. It reads a file and writes nothing, so the
/// forbidden-name assertion below is unaffected — and is checked all the same,
/// because that is the point of writing it as a check.
///
/// Phase 2b-2b-3 adds `save_match`, taking the workspace surface to eight and the
/// whole to nine. It is the **second** name to leave [`FORBIDDEN_COMMANDS`], and
/// both mutating names are asserted present rather than merely absent from that
/// list: "the commands that write are the commands we meant to ship" is a claim
/// with two sides, and only one of them is a list of names that must not appear.
///
/// Phase 2b-2c-2 adds `create_match` and `delete_match`, taking the workspace
/// surface to ten and the whole to eleven. They are the third and fourth names to
/// leave [`FORBIDDEN_COMMANDS`], and they leave it for the reason the list gives:
/// each now has a core primitive behind it — `InsertItem` and `RemoveItem` —
/// rather than being forced into existence by a write outside the transaction.
///
/// Phase 2b-2c-3b adds `save_raw_document`, taking the workspace surface to
/// eleven and the whole to twelve. It is the fifth name to leave
/// [`FORBIDDEN_COMMANDS`] and the last of Phase 2b-2c, and it leaves for the same
/// reason: `SaveContent::ReplaceText`, added to the one writing entry point at
/// Phase 2b-2c-3a, is the mode behind it.
///
/// Phase 2c-3c-2 adds `duplicate_match`, taking the workspace surface to twelve
/// and the whole to thirteen. It was never on [`FORBIDDEN_COMMANDS`] — the rule
/// that put five names there was satisfied before the command existed:
/// `DocumentEdit::DuplicateItem`, built and verified at 2c-3c-1, is the
/// primitive behind it, so the command was registered only after the core could
/// express it.
///
/// Phase 2c-5-2 adds `list_backup_batches`, `list_backup_entries` and
/// `read_backup_text`, taking the workspace surface to fifteen and the whole to
/// sixteen. **None of the three writes**, so the count of writing commands below
/// is asserted to have stayed at six: the phase's design consult rules that a
/// restore is a content path on `save_raw_document`, and a seventh writing name
/// appearing here would be that ruling silently reversed.
///
/// Phase 2d-4a adds `drain_external_changes`, taking the **registered** surface
/// to sixteen workspace commands and seventeen in all, and it writes nothing
/// either. It is the first name ever registered in Rust before the frontend
/// declares it, because `docs/decisions/2d-4-split-notes.md` cuts 2d-4 on the
/// seam the consult's Q3 draws — Rust answers `Result<T, CommandError>` and the
/// TypeScript wrapper turns it into a `CommandResult<T>` — and puts the wrapper
/// in 2d-4b. [`AWAITING_FRONTEND_DECLARATION`] is that asymmetry written down
/// where it fails rather than described in a record, and it is checked in both
/// directions so that 2d-4b cannot add the name without deleting the entry.
#[test]
fn the_registered_commands_are_the_workspace_sixteen_and_the_menu_command() {
    let frontend = read_without_comments("src/lib/ipc/commands.ts");
    let workspace = const_array_members(&frontend, "COMMAND_NAMES");
    let menu = const_array_members(
        &read_without_comments("src/lib/ipc/menu.ts"),
        "MENU_COMMAND_NAMES",
    );
    assert_eq!(
        workspace.len(),
        15,
        "the frontend declares nine read-only commands and six that write; the tenth reader is \
         2d-4b's: {workspace:?}"
    );
    let writing = [
        "move_match",
        "save_match",
        "create_match",
        "delete_match",
        "save_raw_document",
        "duplicate_match",
    ];
    for mutating in writing {
        assert!(
            workspace.contains(mutating),
            "{mutating} writes a user's file and must be declared where the frontend can call it"
        );
    }
    assert_eq!(
        writing.len(),
        6,
        "a restore is a content path on save_raw_document (Phase 2c-5 consult, Q1), so \
         nothing may add a seventh writing command"
    );
    for read_only in [
        "list_backup_batches",
        "list_backup_entries",
        "read_backup_text",
    ] {
        assert!(
            workspace.contains(read_only),
            "{read_only} is Phase 2c-5-2's read-only backup surface and must be declared"
        );
        assert!(
            !writing.contains(&read_only),
            "{read_only} reads the backup tree and must never be counted among the writers"
        );
    } // End of the loop over the backup catalogue's three read-only commands
    assert_eq!(menu.len(), 1, "the menu declares one command: {menu:?}");
    let declared: BTreeSet<String> = workspace.union(&menu).cloned().collect();
    let registered = registered_commands();
    // Both directions on the one deliberate gap, so neither side of it can rot:
    // a name here that Rust does not register is a stale entry, and a name here
    // that the frontend *does* declare is an entry 2d-4b forgot to delete.
    for pending in AWAITING_FRONTEND_DECLARATION {
        assert!(
            registered.contains(*pending),
            "{pending} is listed as awaiting a frontend declaration and is not registered at all"
        );
        assert!(
            !declared.contains(*pending),
            "{pending} is declared by the frontend now, so delete its \
             AWAITING_FRONTEND_DECLARATION entry"
        );
    } // End of the loop over the names Rust registers ahead of the frontend
    let reachable: BTreeSet<String> = declared
        .union(
            &AWAITING_FRONTEND_DECLARATION
                .iter()
                .map(|name| (*name).to_owned())
                .collect(),
        )
        .cloned()
        .collect();
    assert_same_names("the registered commands", &registered, &reachable);
    assert_eq!(
        registered.len(),
        17,
        "Phase 2d-4a registers sixteen workspace commands and one menu command, and no more: {registered:?}"
    );
    for forbidden in FORBIDDEN_COMMANDS {
        assert!(
            !registered.contains(forbidden) && !declared.contains(forbidden),
            "{forbidden} is a Phase 2 mutating command and must not be on this surface"
        );
    }
} // End of function the_registered_commands_are_the_workspace_sixteen_and_the_menu_command()

/// The commands Rust registers that the frontend has not declared yet.
///
/// **A bounded, dated exception and never a suppression list.** Every entry is
/// checked in both directions by the test above: it must be registered, and it
/// must be absent from `COMMAND_NAMES`, so the step that declares it is forced
/// to delete the entry in the same change. An empty list is the ordinary state
/// and is what this list is expected to return to.
///
/// One entry today. `drain_external_changes` is registered by Phase 2d-4a and
/// declared by 2d-4b, because `docs/decisions/2d-4-split-notes.md` cuts the step
/// on the Rust/TypeScript seam and the wrapper is deliberately on the far side
/// of it. What that costs, said plainly: between the two steps the command is
/// dispatchable and **no frontend code can call it**, so nothing in the window
/// reconciles anything.
const AWAITING_FRONTEND_DECLARATION: &[&str] = &["drain_external_changes"];

/// The names no read of the backup tree may so much as mention.
///
/// **A fixed vocabulary, and therefore a tripwire rather than a proof.** A writer
/// introduced under a name that is not on this list is not seen by the scan that
/// reads it.
///
/// Every one is a way bytes reach a user's disk, or a way the *write* side of
/// the backup module is reached. `BackupSession` is on it because it is the
/// stateful half that mints a batch, copies a file and runs
/// `rotate` — this crate's only recursive deletion — and `BackupCatalog` is the
/// read side that shares none of it.
///
/// Deliberately a list of **identifiers** rather than of modules: it is checked
/// with `crate::rust_source::mentions_identifier`, which lexes, so a name in a
/// comment, in a doc comment or inside a string literal is not a mention and
/// `use …::save_document;` is.
const NO_WRITER_IDENTIFIERS: &[&str] = &[
    "save_document",
    "run_one_save",
    "SaveRequest",
    "SaveContent",
    "SaveResult",
    "BackupSession",
    "replace_file_atomically",
    "replace_locked_file",
    "PathWriteLock",
];

/// Regression checks for the intended read-only backup-command paths.
///
/// **These are regression tripwires for the known read-only routes**: the source
/// scan rejects a fixed writer vocabulary and the byte oracle
/// (`crate::backup::tests::no_backup_operation_changes_a_byte_of_the_tree`)
/// covers one exercised tree, so neither their combination nor either test alone
/// proves arbitrary callees side-effect-free. A new writer with an unlisted name,
/// a side-effecting helper, a metadata-only mutation, or a route that fixture
/// does not exercise passes both.
///
/// Two scopes, and the second is what makes the first mean anything:
///
/// - **the whole of `src-tauri/src/backup.rs`**, which is where every line of
///   the three operations lives;
/// - **the six function bodies in `src-tauri/src/commands.rs` that reach it** —
///   three `#[tauri::command]` wrappers and the three `WorkspaceSession` methods
///   under them. `commands.rs` legitimately names every writer, so scanning the
///   file would say nothing; scanning exactly these six bodies says that the
///   path from the IPC boundary into `crate::backup` passes through none of
///   them.
///
/// The non-vacuity guard is the third assertion: the same scanner over
/// `save_raw_document`'s own body **does** find its writer. A scanner that had
/// been broken into matching nothing would pass the first two silently.
#[test]
fn the_known_backup_routes_name_no_writer() {
    let module = read_repository_file("src-tauri/src/backup.rs");
    for forbidden in NO_WRITER_IDENTIFIERS {
        assert!(
            !crate::rust_source::mentions_identifier(&module, forbidden),
            "src-tauri/src/backup.rs names {forbidden}, which this tripwire refuses: a route \
             from the catalogue into the write side must be argued, never introduced quietly"
        );
    } // End of the loop over the forbidden identifiers, over the module

    let commands = read_repository_file("src-tauri/src/commands.rs");
    let reaching = [
        "list_backup_batches",
        "list_backup_entries",
        "read_backup_text",
        "backup_batches",
        "backup_entries",
        "backup_text",
    ];
    for name in reaching {
        let body = function_body(&commands, name);
        for forbidden in NO_WRITER_IDENTIFIERS {
            assert!(
                !body.contains(forbidden),
                "the body of {name} names {forbidden}, so a route intended to be read-only \
                 names a writer"
            );
        } // End of the loop over the forbidden identifiers, over one body
    } // End of the loop over the six functions that reach the backup catalogue

    // The control. `save_raw_document` is the sixth writer, and the same reading
    // of the same file finds what it delegates to — so a negative above is a
    // statement about those six bodies rather than about a scanner that stopped
    // reading.
    assert!(
        function_body(&commands, "save_raw_document").contains("save_one_raw_document"),
        "the body reader stopped finding what a writing command delegates to"
    );
    assert!(
        crate::rust_source::mentions_identifier(&commands, "save_document"),
        "the identifier scanner stopped seeing the writer commands.rs really names"
    );
} // End of function the_known_backup_routes_name_no_writer()

/// The text between the braces of the **first** `fn {name}(` in `source`.
///
/// Brace-matched from the `{` that opens the body, so a nested block, a closure
/// and a `match` arm are all inside the answer. Written here rather than parsed
/// with `syn` because the question is *what does this body mention*, which a
/// slice answers exactly and a token walk would answer at more cost.
///
/// # Panics
///
/// When `source` declares no such function, so a renamed command fails loudly
/// rather than being scanned as an empty body — the vacuous pass every check in
/// this module exists to avoid.
fn function_body<'a>(source: &'a str, name: &str) -> &'a str {
    let marker = format!("fn {name}(");
    let at = source
        .find(&marker)
        .unwrap_or_else(|| panic!("no fn {name}( is declared in this source"));
    let opened = source[at..]
        .find('{')
        .unwrap_or_else(|| panic!("fn {name} declares no body"));
    braced_block(&source[at + opened..], &format!("the body of {name}"))
} // End of function function_body()

/// The three outcomes of a save are declared exactly as Rust writes them.
///
/// `SaveResult` is **flat** — one `outcome` discriminant plus operands — rather
/// than externally tagged like the core's own enums, so it is checked here rather
/// than folded into [`save_transaction_enums`], whose whole machinery reads a
/// one-key object as a variant name. The three claims are the ones that can drift
/// independently: the name union, each outcome's own operand set, and the union
/// that ties the three interfaces together.
#[test]
fn every_save_outcome_declares_exactly_what_rust_writes() {
    let source = read_without_comments("src/lib/ipc/types.ts");
    let results = crate::save::every_save_result();

    let rust: BTreeSet<String> = results
        .iter()
        .map(|result| result.outcome().to_owned())
        .collect();
    assert_eq!(rust.len(), 3, "three outcomes: {rust:?}");
    assert_same_names(
        "type SaveResultName",
        &rust,
        &union_members(&source, "SaveResultName"),
    );

    // Every outcome's interface, by the same naming convention `errors.ts` uses
    // for an error code: the discriminant capitalised, plus a noun.
    for result in &results {
        let outcome = result.outcome();
        let mut characters = outcome.chars();
        let first = characters.next().expect("an outcome is never empty");
        let interface = format!(
            "{}{}Result",
            first.to_ascii_uppercase(),
            characters.as_str()
        );
        let written = json_keys(&json_of(result));
        assert!(
            written.contains("outcome"),
            "{interface} must carry the discriminant it is told apart by"
        );
        assert_same_names(
            &format!("interface {interface}"),
            &written,
            &interface_fields(&source, &interface),
        );
        assert!(
            union_body(&source, "SaveResult").contains(&interface),
            "type SaveResult does not include {interface}"
        );
    } // End of the loop over the three outcomes
} // End of function every_save_outcome_declares_exactly_what_rust_writes()

/// A scalar arrives as text, never as a parsed value (D2u).
///
/// The rule the whole read model is built on, asserted at the boundary rather
/// than only inside the core: `word: true` must cross as the string `"true"`,
/// and nothing in the projection may be a JSON boolean or number where a
/// scalar's value belongs.
#[test]
fn a_schema_boolean_crosses_as_text_not_as_a_boolean() {
    let view = project("match/synthetic.yml", MATCH_FILE);
    let word = view.matches[0]
        .options
        .word
        .as_ref()
        .expect("the first match sets word");
    let json = json_of(word);
    assert_eq!(json["text"], Value::String("true".to_owned()));
    assert_eq!(
        json["ambiguous_yaml_1_1"],
        Value::Bool(true),
        "a plain `true` is exactly the risk this flag exists to report"
    );
} // End of function a_schema_boolean_crosses_as_text_not_as_a_boolean()

/// An unmodelled entry's value crosses as its own bytes, `serde` included.
///
/// Phase 1c-2b-2a's wire-field addition, pinned where `serde` is the thing under
/// test rather than the projection. The value below is written with `\u{…}`
/// escapes so that this source file cannot be normalised into agreeing with a
/// normalising boundary, and it carries the three properties JSON encoding, a
/// Unicode normaliser and a truncation would each break.
#[test]
fn an_unmodelled_entrys_value_crosses_as_its_own_bytes() {
    let source = concat!(
        "matches:\n",
        "  - trigger: ':one'\n",
        "    invented_by_a_later_espanso: \"caf\u{e9} cafe\u{301} \u{1f600}\"\n",
    );
    let view = project("match/unmodelled.yml", source);
    let entry = view
        .all_unknown_entries()
        .into_iter()
        .next()
        .expect("the fixture holds an unrecognised key")
        .clone();
    let json = json_of(&entry);
    let text = json["value_text"].as_str().expect("a source slice");

    // The bytes the span names, re-derived here from the document rather than
    // taken from the entry that is under test.
    let expected = &source[entry.value_span.start..entry.value_span.end];
    assert_eq!(text, expected, "the wire must carry the slice, uncut");
    assert!(text.contains('\u{e9}'), "the precomposed e-acute was lost");
    assert!(
        text.contains("\u{65}\u{301}"),
        "the decomposed e-acute was composed"
    );
    assert!(text.contains('\u{1f600}'), "the astral character was lost");
    assert_eq!(
        text.len(),
        entry.value_span.len(),
        "a value text shorter than its span is a truncation nothing on this wire announces"
    );
} // End of function an_unmodelled_entrys_value_crosses_as_its_own_bytes()

/// A revision crosses as an opaque 64-character string, not as 32 numbers.
#[test]
fn a_revision_crosses_as_a_hex_string() {
    let view = project("match/synthetic.yml", MATCH_FILE);
    let json = json_of(&view);
    let revision = json["revision"].as_str().expect("a hex string");
    assert_eq!(revision.len(), 64);
    assert!(revision
        .chars()
        .all(|character| character.is_ascii_hexdigit()));
    assert_eq!(json["matches"][0]["id"]["revision"], json["revision"]);
}

/// A diagnostic crosses as a code and operands, never as a sentence.
#[test]
fn a_diagnostic_crosses_as_a_code_and_operands() {
    let sample = Diagnostic::document(DiagnosticCode::MatchHasSeveralTriggerForms { count: 2 });
    let json = json_of(&sample);
    assert_eq!(json["code"]["MatchHasSeveralTriggerForms"]["count"], 2);
    assert_eq!(json_keys(&json_of(&sample)).len(), 4);
    let rendered = format!(
        "{}",
        DiagnosticCode::MatchHasSeveralTriggerForms { count: 2 }
    );
    assert!(
        !serde_json::to_string(&json)
            .expect("json")
            .contains(&rendered),
        "the Display rendering is a developer string and must not be on the wire"
    );
}

// ---------------------------------------------------------------------------
// The save transaction — Phase 2b-1
// ---------------------------------------------------------------------------
//
// Eighteen enums and seven structs reached the wire in one change, because that
// is the only size the change came in: one variant serialized without its
// dictionary entry fails `crate::dictionary_contract`, so half of `SaveError` on
// the wire is worse than none of it.
//
// What follows pins the **shape** rather than the strings. Three claims, each a
// test below:
//
// 1. every TypeScript union declares exactly the Rust variants, both ways;
// 2. every tagged variant's operands are exactly the keys `serde` writes;
// 3. every one of the sample lists this module is built on is **complete**,
//    checked against the enum declaration parsed out of the core's own source
//    rather than against itself — the vacuous-audit corollary applied to a
//    sample list (`PROGRESS.md`, D2w), and the same guard `crate::error`'s
//    `every_declared_variant_has_an_instance_in_the_enumeration` gives
//    `CommandError`.

/// A real `NodeId`, taken from a parse.
///
/// `NodeId` cannot be constructed outside the core — deliberately, so that only
/// `SyntaxIndex` mints one — so a sample comes from a trivial document rather
/// than being invented.
fn a_node() -> espansoconfig_core::NodeId {
    espansoconfig_core::SyntaxIndex::parse("a: b")
        .expect("a trivial parse")
        .nodes()[0]
        .id
}

/// A byte span, for a sample that carries one.
fn a_span() -> espansoconfig_core::ByteSpan {
    espansoconfig_core::ByteSpan::new(3, 11)
}

/// A content revision, for a sample that carries one.
fn a_revision() -> espansoconfig_core::ContentRevision {
    espansoconfig_core::ContentRevision::of_bytes(b"a")
}

/// A path that names nothing, for a sample that carries one.
fn a_path() -> PathBuf {
    PathBuf::from("/nowhere/match/base.yml")
}

/// A path resolver failure, for the samples that carry one.
fn a_path_error() -> PathError {
    PathError::NoKeySegment
}

/// One value of every [`NodeKind`] variant.
fn node_kind_samples() -> Vec<NodeKind> {
    vec![
        NodeKind::Document,
        NodeKind::Mapping,
        NodeKind::Sequence,
        NodeKind::Scalar,
        NodeKind::Alias,
    ]
}

/// One value of every [`SaveVerdict`] variant.
fn save_verdict_samples() -> Vec<SaveVerdict> {
    vec![
        SaveVerdict::Proceed,
        SaveVerdict::RefusedForEditorModelErrors,
        SaveVerdict::RefusedForUnacknowledgedSuspicions,
    ]
}

/// One value of every [`FindingClass`] variant.
fn finding_class_samples() -> Vec<FindingClass> {
    vec![
        FindingClass::EditorModelError,
        FindingClass::SuspiciousButPermitted,
    ]
}

/// One value of every [`WriteStep`] variant.
fn write_step_samples() -> Vec<WriteStep> {
    vec![
        WriteStep::ResolveTarget,
        WriteStep::InspectTarget,
        WriteStep::ReadTarget,
        WriteStep::CreateTempFile,
        WriteStep::WriteTempFile,
        WriteStep::SyncTempFile,
        WriteStep::CopyMetadata,
        WriteStep::ApplyModeBits,
        WriteStep::VerifyTempIdentity,
        WriteStep::RecheckTarget,
        WriteStep::Rename,
        WriteStep::SyncDirectory,
        WriteStep::ReadBack,
    ]
} // End of function write_step_samples()

/// One value of every [`BackupStep`] variant.
fn backup_step_samples() -> Vec<BackupStep> {
    vec![
        BackupStep::CreateBackupRoot,
        BackupStep::InspectBackupRoot,
        BackupStep::CreateBatch,
        BackupStep::WriteBatchMarker,
        BackupStep::CreateBackupParents,
        BackupStep::CreateBackupFile,
        BackupStep::WriteBackupFile,
        BackupStep::CopyExtendedAttributes,
        BackupStep::ApplyModeBits,
        BackupStep::SyncBackupFile,
        BackupStep::VerifyBackupFile,
        BackupStep::PublishBackupFile,
    ]
} // End of function backup_step_samples()

/// One value of every [`RotationOutcome`] variant.
fn rotation_outcome_samples() -> Vec<RotationOutcome> {
    vec![
        RotationOutcome::NotAttempted,
        RotationOutcome::Refused,
        RotationOutcome::ScanFailed,
        RotationOutcome::Scanned,
    ]
}

/// One value of every [`DuplicateSeam`] variant.
fn duplicate_seam_samples() -> Vec<DuplicateSeam> {
    vec![
        DuplicateSeam::ArrivalLands,
        DuplicateSeam::ArrivalCloses,
        DuplicateSeam::CopiedRunsJoin,
    ]
} // End of function duplicate_seam_samples()

/// One value of every [`ReapplyRefusal`] variant.
fn reapply_refusal_samples() -> Vec<ReapplyRefusal> {
    vec![
        ReapplyRefusal::NoAnchorInBase,
        ReapplyRefusal::WrongDocument,
        ReapplyRefusal::DiskDoesNotParse,
        ReapplyRefusal::SequenceMissing,
        ReapplyRefusal::AmbiguousExact,
        ReapplyRefusal::NoExactCorrespondence,
        ReapplyRefusal::TargetMissingOrTriggerChanged,
        ReapplyRefusal::AmbiguousTrigger,
        ReapplyRefusal::NoTriggerToMatch,
    ]
} // End of function reapply_refusal_samples()

/// One value of every [`ReapplyResolution`] variant.
///
/// The `Identified` arm carries a **projected** match rather than a synthesized
/// one, because that is what the arm carries in production and a hand-built
/// `MatchView` would be a second description of the read model.
fn reapply_resolution_samples() -> Vec<ReapplyResolution> {
    let view = project("match/synthetic.yml", MATCH_FILE);
    vec![
        ReapplyResolution::Unsupported {},
        ReapplyResolution::Targetless {},
        ReapplyResolution::Identified {
            target: Box::new(view.matches[0].clone()),
        },
        ReapplyResolution::Refused {
            reason: ReapplyRefusal::AmbiguousExact,
        },
    ]
} // End of function reapply_resolution_samples()

/// One value of every [`ReapplyPlacement`] variant.
///
/// The `Identified` arm carries a **projected** match for
/// [`reapply_resolution_samples`]'s reason: a hand-built `MatchView` would be a
/// second description of the read model.
fn reapply_placement_samples() -> Vec<ReapplyPlacement> {
    let view = project("match/synthetic.yml", MATCH_FILE);
    vec![
        ReapplyPlacement::NotAnchored {},
        ReapplyPlacement::Identified {
            target: Box::new(view.matches[0].clone()),
        },
        ReapplyPlacement::Refused {
            reason: ReapplyRefusal::NoExactCorrespondence,
        },
    ]
} // End of function reapply_placement_samples()

/// One value of every [`MoveSeam`] variant.
fn move_seam_samples() -> Vec<MoveSeam> {
    vec![
        MoveSeam::SourceCloses,
        MoveSeam::ArrivalLands,
        MoveSeam::ArrivalCloses,
        MoveSeam::CarriedRunsJoin,
    ]
}

/// One value of every [`DecodeError`] variant.
fn decode_error_samples() -> Vec<DecodeError> {
    vec![
        DecodeError::SpanOutsideSource {
            span: a_span(),
            source_len: 4,
        },
        DecodeError::UnknownEscape { escape: 'q' },
        DecodeError::MalformedNumericEscape { introducer: 'u' },
        DecodeError::InvalidCodePoint { value: 0xd800 },
        DecodeError::TrailingBackslash,
    ]
} // End of function decode_error_samples()

/// One value of every [`NotReencodable`] variant.
///
/// On the wire since Phase 2b-2a, as [`PresentationNote::reason`]: a successful
/// save carries its presentation notes out, and plan section 6.2's *never
/// silently normalise* is only kept if the note reaches a person.
fn not_reencodable_samples() -> Vec<NotReencodable> {
    vec![
        NotReencodable::FoldedStyle,
        NotReencodable::FoldedFlowScalar,
        NotReencodable::NonCanonicalEscaping,
        NotReencodable::NonCanonicalBlankLine,
        NotReencodable::MixedLineBreaks,
        NotReencodable::BareCarriageReturn,
        NotReencodable::SynthesisedFinalBreak,
        NotReencodable::Undecodable(DecodeError::TrailingBackslash),
    ]
} // End of function not_reencodable_samples()

/// One value of every [`PresentationNote`] variant.
///
/// A **tagged union since Phase 2b-2c-2**, and it is in this table rather than
/// among the structs for that reason. `ScalarRestyled` is the shape the struct
/// had; `DoubledSequenceSeparation` is what a deletion between two
/// blank-separated siblings reports, and it carries only the edit it is about
/// because there is no scalar anywhere in it and therefore no honest
/// [`espansoconfig_core::ScalarStyle`] to name.
fn presentation_note_samples() -> Vec<PresentationNote> {
    vec![
        PresentationNote::ScalarRestyled {
            edit: 0,
            from: ScalarStyle::Plain,
            to: ScalarStyle::SingleQuoted,
            reason: Some(NotReencodable::FoldedStyle),
        },
        PresentationNote::DoubledSequenceSeparation { edit: 0 },
    ]
} // End of function presentation_note_samples()

/// One value of every [`InvariantViolation`] variant.
fn invariant_violation_samples() -> Vec<InvariantViolation> {
    vec![
        InvariantViolation::InvertedSpan { start: 9, end: 4 },
        InvariantViolation::SpanOutsideSource {
            start: 0,
            end: 40,
            source_len: 12,
        },
        InvariantViolation::BlockHeaderNotFound { start: 3, end: 11 },
        InvariantViolation::FrontierOverlap {
            previous_end: 12,
            next_start: 8,
        },
        InvariantViolation::UnbalancedEvents { depth: 2 },
    ]
} // End of function invariant_violation_samples()

/// One value of every [`SyntaxError`] variant.
fn syntax_error_samples() -> Vec<SyntaxError> {
    vec![
        SyntaxError::Parse(ParseFailure {
            char_index: 7,
            byte_index: Some(7),
            line: 2,
            column: 3,
            detail: "a developer diagnostic".to_owned(),
        }),
        SyntaxError::Offset(OffsetOutOfDomain {
            char_index: 99,
            char_len: 12,
        }),
        SyntaxError::Invariant(InvariantViolation::UnbalancedEvents { depth: 2 }),
    ]
} // End of function syntax_error_samples()

/// One value of every [`PathError`] variant.
fn path_error_samples() -> Vec<PathError> {
    vec![
        PathError::NoSuchDocument {
            document_index: 3,
            documents: 1,
        },
        PathError::EmptyDocument { document_index: 0 },
        PathError::NoSuchKey {
            key: "replace".to_owned(),
            segment: 1,
            node: a_node(),
        },
        PathError::DuplicateKey {
            key: "replace".to_owned(),
            occurrences: 2,
            segment: 1,
            node: a_node(),
        },
        PathError::KeyIntoNonMapping {
            key: "replace".to_owned(),
            segment: 1,
            node: a_node(),
            kind: NodeKind::Sequence,
        },
        PathError::IndexIntoNonSequence {
            index: 0,
            segment: 1,
            node: a_node(),
            kind: NodeKind::Mapping,
        },
        PathError::IndexOutOfRange {
            index: 4,
            len: 2,
            segment: 1,
            node: a_node(),
        },
        PathError::NoKeySegment,
        PathError::MalformedIndex { node: a_node() },
    ]
} // End of function path_error_samples()

/// One value of every [`VerificationFailure`] variant.
fn verification_failure_samples() -> Vec<VerificationFailure> {
    vec![
        VerificationFailure::DoesNotParse(SyntaxError::Invariant(
            InvariantViolation::UnbalancedEvents { depth: 1 },
        )),
        VerificationFailure::TargetLost {
            edit: 0,
            error: a_path_error(),
        },
        VerificationFailure::TargetKindChanged {
            edit: 0,
            kind: NodeKind::Mapping,
        },
        VerificationFailure::ValueMismatch {
            edit: 0,
            wanted_len: 4,
            found_len: 5,
            first_difference: 2,
        },
        VerificationFailure::DecoderDisagreement { edit: 0 },
        VerificationFailure::Undecodable {
            edit: 0,
            error: DecodeError::TrailingBackslash,
        },
        VerificationFailure::BytesOutsideTheSpanChanged { at: 12 },
        VerificationFailure::SpanNotPermitted { at: a_span() },
        VerificationFailure::LengthMismatch {
            expected: 40,
            found: 41,
        },
        VerificationFailure::MappingLost {
            edit: 0,
            error: a_path_error(),
        },
        VerificationFailure::FieldNotInserted {
            edit: 0,
            key_len: 5,
        },
        VerificationFailure::FieldNotRemoved {
            edit: 0,
            key_len: 5,
        },
        VerificationFailure::SiblingChanged { edit: 0, entry: 1 },
        VerificationFailure::EntryCountChanged {
            edit: 0,
            expected: 2,
            found: 1,
        },
        VerificationFailure::EnvelopeCoversAnotherNode {
            at: a_span(),
            node: a_node(),
        },
        VerificationFailure::EnvelopeMissesTheEntry {
            at: a_span(),
            node: a_node(),
        },
        VerificationFailure::InsertionPointInsideANode {
            at: 12,
            node: a_node(),
        },
        VerificationFailure::FileCommentLost { at: 12 },
        VerificationFailure::ItemsNotInTheIntendedOrder {
            edit: 0,
            position: 1,
        },
        VerificationFailure::ConstructChangedOutsideTheMove {
            edit: 0,
            node: a_node(),
        },
        VerificationFailure::DocumentLinesNotConserved { at: 12 },
        VerificationFailure::MoveCarriesMoreThanTheItem {
            edit: 0,
            at: a_span(),
            lines: a_span(),
        },
        VerificationFailure::MovedBytesWereRewritten {
            edit: 0,
            at: 12,
            first_difference: 3,
        },
        VerificationFailure::CommentOwnershipChanged { edit: 0, at: 12 },
        VerificationFailure::AmbiguousPlainScalarIntroduced { at: 12, len: 3 },
        VerificationFailure::RemovalCarriesMoreThanTheEntry {
            at: a_span(),
            lines: a_span(),
        },
        VerificationFailure::DuplicateCarriesMoreThanTheItem {
            edit: 0,
            at: a_span(),
            lines: a_span(),
        },
        VerificationFailure::DuplicatedBytesWereRewritten {
            edit: 0,
            at: 12,
            first_difference: 3,
        },
        VerificationFailure::DuplicateNotInPlace {
            edit: 0,
            position: 1,
        },
        VerificationFailure::ConstructChangedOutsideTheDuplicate {
            edit: 0,
            node: a_node(),
        },
    ]
} // End of function verification_failure_samples()

/// One value of every [`EditError`] variant.
fn edit_error_samples() -> Vec<EditError> {
    vec![
        EditError::SourceDoesNotParse(SyntaxError::Invariant(
            InvariantViolation::UnbalancedEvents { depth: 1 },
        )),
        EditError::Unresolvable {
            edit: 0,
            error: a_path_error(),
        },
        EditError::NotAScalar {
            edit: 0,
            node: a_node(),
            kind: NodeKind::Mapping,
        },
        EditError::EmptyTarget {
            edit: 0,
            node: a_node(),
            at: a_span(),
        },
        EditError::Refused {
            edit: 0,
            node: a_node(),
            hazard: HazardKind::MergeKey,
            at: a_span(),
        },
        EditError::OverlappingEdits {
            first: a_span(),
            second: a_span(),
        },
        EditError::TrailingNewlinesNotRepresentable {
            edit: 0,
            wanted: 1,
            following: 3,
        },
        EditError::MalformedSpan {
            edit: 0,
            at: a_span(),
        },
        EditError::NotAMapping {
            edit: 0,
            node: a_node(),
            kind: NodeKind::Sequence,
        },
        EditError::FlowCollection {
            edit: 0,
            node: a_node(),
        },
        EditError::KeyAlreadyPresent {
            edit: 0,
            mapping: a_node(),
        },
        EditError::NoSuchSibling {
            edit: 0,
            mapping: a_node(),
        },
        EditError::InconsistentEntryIndentation {
            edit: 0,
            mapping: a_node(),
            expected: 2,
            found: 4,
        },
        EditError::EntryDoesNotOwnItsLines {
            edit: 0,
            at: a_span(),
        },
        EditError::RemovalWouldExtendAKeptBlock {
            edit: 0,
            block: a_node(),
        },
        EditError::RemovalWouldDeleteAFileComment {
            edit: 0,
            comment: a_span(),
        },
        EditError::RemovalWouldExtendABlockScalar {
            edit: 0,
            block: a_node(),
        },
        EditError::NoObservableLineEnding { edit: 0, at: 12 },
        EditError::LastEntryOfMapping {
            edit: 0,
            mapping: a_node(),
        },
        EditError::NotASequenceItem {
            edit: 0,
            node: a_node(),
            kind: NodeKind::Mapping,
        },
        EditError::NoSuchDestinationItem {
            edit: 0,
            sequence: a_node(),
            items: 2,
        },
        EditError::MoveChangesNothing {
            edit: 0,
            item: a_node(),
        },
        EditError::MoveMustBeTheOnlyEditInItsBatch { edit: 0, edits: 2 },
        EditError::MoveWouldInventALineEnding { edit: 0, at: 12 },
        EditError::MoveWouldTerminateTheFinalLine { edit: 0, at: 12 },
        EditError::MoveWouldExtendAKeptBlock {
            edit: 0,
            block: a_node(),
        },
        EditError::MoveWouldExtendABlockScalar {
            edit: 0,
            block: a_node(),
            seam: MoveSeam::CarriedRunsJoin,
        },
        EditError::NotASequence {
            edit: 0,
            node: a_node(),
            kind: NodeKind::Mapping,
        },
        EditError::InsertedItemHasNoFields { edit: 0 },
        EditError::DuplicateInsertedField { edit: 0, field: 1 },
        EditError::InvalidInsertedFieldKey { edit: 0, field: 1 },
        EditError::FlowSequenceInsertionUnsupported {
            edit: 0,
            sequence: a_node(),
        },
        EditError::InconsistentSequenceIndentation {
            edit: 0,
            sequence: a_node(),
            expected: 2,
            found: 4,
        },
        EditError::ImplicitNullSequenceHasAmbiguousTrivia { edit: 0, at: 12 },
        EditError::RemovalWouldEmptyTheSequence {
            edit: 0,
            sequence: a_node(),
        },
        EditError::DuplicateMustBeTheOnlyEditInItsBatch { edit: 0, edits: 2 },
        EditError::DuplicateWouldCopyAFileComment {
            edit: 0,
            comment: a_span(),
        },
        EditError::DuplicateWouldExtendAKeptBlock {
            edit: 0,
            block: a_node(),
        },
        EditError::DuplicateWouldExtendABlockScalar {
            edit: 0,
            block: a_node(),
            seam: DuplicateSeam::CopiedRunsJoin,
        },
        EditError::Verification(VerificationFailure::DecoderDisagreement { edit: 0 }),
    ]
} // End of function edit_error_samples()

/// One value of every [`FindingCode`] variant.
fn finding_code_samples() -> Vec<FindingCode> {
    vec![
        FindingCode::MatchHasNoContentField,
        FindingCode::MatchHasSeveralContentFields,
        FindingCode::MatchHasNoTriggerField,
        FindingCode::MatchHasSeveralTriggerForms,
        FindingCode::VariableHasNoType,
        FindingCode::VariableTypeNotRecognised {
            declared: "global".to_owned(),
        },
        FindingCode::VariableMissingRequiredParam {
            kind: VariableKind::Echo,
            param: "echo".to_owned(),
        },
        FindingCode::DuplicateVariableName {
            name: "greeting".to_owned(),
        },
        FindingCode::ReferenceHasNoDeclaration {
            name: "greeting".to_owned(),
        },
        FindingCode::RegexDoesNotCompile {
            detail: "a third party's English diagnostic".to_owned(),
        },
        FindingCode::DocumentDoesNotParse {
            revision: a_revision(),
            line: Some(4),
            column: Some(11),
            byte_index: Some(52),
            detail: "the substrate's own English diagnostic".to_owned(),
        },
        FindingCode::DuplicateKeepsTriggerDefinition {
            revision: a_revision(),
        },
        FindingCode::NewMatchRepeatsLiteralTrigger {
            revision: a_revision(),
        },
    ]
} // End of function finding_code_samples()

/// One value of every [`TargetDifference`] variant.
fn target_difference_samples() -> Vec<TargetDifference> {
    vec![
        TargetDifference::Retargeted { now: a_path() },
        TargetDifference::Vanished,
        TargetDifference::Identity,
        TargetDifference::Contents {
            expected: a_revision(),
            found: ContentRevision::of_bytes(b"b"),
        },
    ]
} // End of function target_difference_samples()

/// One value of every [`WriteError`] variant.
fn write_error_samples() -> Vec<WriteError> {
    vec![
        WriteError::TargetMissing { path: a_path() },
        WriteError::TargetNotRegularFile { path: a_path() },
        WriteError::RevisionMismatch {
            path: a_path(),
            expected: a_revision(),
            found: ContentRevision::of_bytes(b"b"),
        },
        WriteError::TargetChangedDuringWrite {
            path: a_path(),
            difference: TargetDifference::Vanished,
        },
        WriteError::TempFileChangedDuringWrite { path: a_path() },
        WriteError::VerificationFailed {
            path: a_path(),
            expected: a_revision(),
            found: ContentRevision::of_bytes(b"b"),
        },
        WriteError::Io {
            step: WriteStep::Rename,
            path: a_path(),
            source: io::Error::from(io::ErrorKind::PermissionDenied),
        },
    ]
} // End of function write_error_samples()

/// One value of every [`BackupError`] variant.
fn backup_error_samples() -> Vec<BackupError> {
    vec![
        BackupError::Io {
            step: BackupStep::CreateBatch,
            path: a_path(),
            source: io::Error::from(io::ErrorKind::PermissionDenied),
        },
        BackupError::BatchNameExhausted { path: a_path() },
        BackupError::NotADirectory { path: a_path() },
        BackupError::BackupRootNotPrivate {
            path: a_path(),
            mode: 0o755,
        },
        BackupError::ConfigRootIsAutoLoaded { path: a_path() },
        BackupError::TempFileChangedDuringWrite { path: a_path() },
        BackupError::DestinationExists { path: a_path() },
        BackupError::BackupNameExhausted { path: a_path() },
    ]
} // End of function backup_error_samples()

/// A finding a caller could be shown and could acknowledge.
fn a_finding() -> Finding {
    Finding {
        code: FindingCode::VariableTypeNotRecognised {
            declared: "global".to_owned(),
        },
        span: Some(a_span()),
        node: Some(a_node()),
        path: Some(DocumentPath::new(
            0,
            vec![PathSegment::key("matches"), PathSegment::Index(0)],
        )),
    }
} // End of function a_finding()

/// One value of every [`SaveError`] variant.
fn save_error_samples() -> Vec<SaveError> {
    vec![
        SaveError::DocumentIsReadOnly { path: a_path() },
        SaveError::ReplacementRequiresBackups { path: a_path() },
        SaveError::Target(WriteError::TargetMissing { path: a_path() }),
        SaveError::TargetNotUtf8 {
            path: a_path(),
            offset: 12,
        },
        SaveError::RevisionMismatch {
            path: a_path(),
            expected: a_revision(),
            found: ContentRevision::of_bytes(b"b"),
        },
        SaveError::Patch(EditError::NoObservableLineEnding { edit: 0, at: 12 }),
        SaveError::CandidateParseDisagrees {
            path: a_path(),
            error: SyntaxError::Invariant(InvariantViolation::UnbalancedEvents { depth: 1 }),
        },
        SaveError::Refused(SaveRefusal {
            verdict: SaveVerdict::RefusedForUnacknowledgedSuspicions,
            findings: vec![a_finding()],
        }),
        SaveError::Backup(BackupError::NotADirectory { path: a_path() }),
        SaveError::Write(WriteError::TempFileChangedDuringWrite { path: a_path() }),
    ]
} // End of function save_error_samples()

/// Every save-transaction struct paired with the JSON `serde` really writes.
///
/// Struct literals rather than a projection, because none of these has one behind
/// it — and a struct literal has its own guarantee: a field added to any of them
/// makes this module fail to compile.
fn save_transaction_structs() -> Vec<(&'static str, Value)> {
    let rotation = Rotation {
        outcome: RotationOutcome::Scanned,
        removed: 1,
        failed: 0,
        unrecognised: 0,
        unreadable: 0,
    };
    vec![
        (
            "ParseFailure",
            json_of(&ParseFailure {
                char_index: 7,
                byte_index: Some(7),
                line: 2,
                column: 3,
                detail: "a developer diagnostic".to_owned(),
            }),
        ),
        (
            "OffsetOutOfDomain",
            json_of(&OffsetOutOfDomain {
                char_index: 99,
                char_len: 12,
            }),
        ),
        ("Finding", json_of(&a_finding())),
        (
            "SaveRefusal",
            json_of(&SaveRefusal {
                verdict: SaveVerdict::RefusedForUnacknowledgedSuspicions,
                findings: vec![a_finding()],
            }),
        ),
        (
            "Acknowledgement",
            json_of(&Acknowledgement::of(&[a_finding()])),
        ),
        ("Rotation", json_of(&rotation)),
        (
            "BackupRecord",
            json_of(&BackupRecord {
                path: a_path(),
                batch: PathBuf::from("/nowhere/.espansoconfig-backups/batch"),
                rotation,
            }),
        ),
        (
            "ReapplyEvidence",
            json_of(&ReapplyEvidence {
                subject: ReapplyResolution::Targetless {},
                placement: ReapplyPlacement::NotAnchored {},
            }),
        ),
    ]
} // End of function save_transaction_structs()

/// Every save-transaction enum, its declaration, and the samples for it.
///
/// The first two columns feed the completeness check against the core's own
/// source; the third is the JSON every shape check is derived from. One table, so
/// a sample list and the union it is compared against cannot name different
/// enums.
fn save_transaction_enums() -> Vec<(&'static str, Vec<Value>)> {
    vec![
        (
            "NodeKind",
            node_kind_samples().iter().map(json_of).collect(),
        ),
        (
            "SaveVerdict",
            save_verdict_samples().iter().map(json_of).collect(),
        ),
        (
            "FindingClass",
            finding_class_samples().iter().map(json_of).collect(),
        ),
        (
            "WriteStep",
            write_step_samples().iter().map(json_of).collect(),
        ),
        (
            "BackupStep",
            backup_step_samples().iter().map(json_of).collect(),
        ),
        (
            "RotationOutcome",
            rotation_outcome_samples().iter().map(json_of).collect(),
        ),
        (
            "MoveSeam",
            move_seam_samples().iter().map(json_of).collect(),
        ),
        (
            "DuplicateSeam",
            duplicate_seam_samples().iter().map(json_of).collect(),
        ),
        (
            "DecodeError",
            decode_error_samples().iter().map(json_of).collect(),
        ),
        (
            "InvariantViolation",
            invariant_violation_samples().iter().map(json_of).collect(),
        ),
        (
            "SyntaxError",
            syntax_error_samples().iter().map(json_of).collect(),
        ),
        (
            "PathError",
            path_error_samples().iter().map(json_of).collect(),
        ),
        (
            "VerificationFailure",
            verification_failure_samples().iter().map(json_of).collect(),
        ),
        (
            "EditError",
            edit_error_samples().iter().map(json_of).collect(),
        ),
        (
            "FindingCode",
            finding_code_samples().iter().map(json_of).collect(),
        ),
        (
            "TargetDifference",
            target_difference_samples().iter().map(json_of).collect(),
        ),
        (
            "WriteError",
            write_error_samples().iter().map(json_of).collect(),
        ),
        (
            "BackupError",
            backup_error_samples().iter().map(json_of).collect(),
        ),
        (
            "SaveError",
            save_error_samples().iter().map(json_of).collect(),
        ),
        (
            "NotReencodable",
            not_reencodable_samples().iter().map(json_of).collect(),
        ),
        (
            "PresentationNote",
            presentation_note_samples().iter().map(json_of).collect(),
        ),
        (
            "ReapplyRefusal",
            reapply_refusal_samples().iter().map(json_of).collect(),
        ),
        (
            "ReapplyResolution",
            reapply_resolution_samples().iter().map(json_of).collect(),
        ),
        (
            "ReapplyPlacement",
            reapply_placement_samples().iter().map(json_of).collect(),
        ),
    ]
} // End of function save_transaction_enums()

/// The TypeScript type whose members are one enum's **names**.
///
/// A union of bare string literals is its own name set; a union with tagged
/// members has a `…Name` twin beside it, exactly as `DiagnosticCodeName` sits
/// beside `DiagnosticCode`. Derived from the JSON rather than listed, so the
/// answer cannot disagree with the samples it is derived from.
fn name_union_of(name: &str, samples: &[Value]) -> String {
    if samples.iter().all(Value::is_string) {
        name.to_owned()
    } else {
        format!("{name}Name")
    }
}

/// Every sample list holds one instance of every variant its enum declares.
///
/// **Read from the core's own source, not from the list.** A list checked against
/// itself is a list that cannot fail, and this is the same guard
/// `crate::error::every_declared_variant_has_an_instance_in_the_enumeration`
/// gives `CommandError` — the vacuous-audit corollary (`PROGRESS.md`, D2w)
/// applied to eighteen enums at once. A variant added in the core and forgotten
/// here fails this test rather than reaching a screen with no shape behind it.
#[test]
fn every_save_transaction_sample_list_is_its_enums_declaration() {
    let mut variants = 0usize;
    for (name, samples) in save_transaction_enums() {
        let declared = crate::dictionary_contract::declared_variants_of(name);
        let enumerated: BTreeSet<String> = samples.iter().map(variant_name).collect();
        assert_eq!(
            declared, enumerated,
            "the {name} sample list and the {name} declaration disagree"
        );
        assert_eq!(
            samples.len(),
            enumerated.len(),
            "the {name} sample list holds two instances of one variant"
        );
        variants += samples.len();
    } // End of the loop over the save-transaction enums
    assert_eq!(
        variants, 206,
        "Phase 2b-1 put 157 variants on the wire, Phase 2b-2a added NotReencodable's \
         eight, Phase 2b-2c-1 added EditError's eight sequence-item refusals, \
         Phase 2b-2c-2's fix round made PresentationNote a two-variant union, \
         Phase 2b-2c-3 added FindingCode::DocumentDoesNotParse and its fix round \
         added SaveError::ReplacementRequiresBackups, Phase 2c-3c-1 added the \
         duplicate's twelve — four EditError refusals, DuplicateSeam's three, \
         VerificationFailure's four and FindingCode::DuplicateKeepsTriggerDefinition \
         — Phase 2c-4b-1 added the correspondence evidence's sixteen: \
         ReapplyRefusal's nine, ReapplyResolution's four and — at the review \
         round, where a move's placement anchor became an operand of its own — \
         ReapplyPlacement's three, and Phase 2c-4c-1 added the creation's own \
         FindingCode::NewMatchRepeatsLiteralTrigger; \
         this list now holds {variants}"
    );
} // End of function every_save_transaction_sample_list_is_its_enums_declaration()

/// Every save-transaction union declares exactly the Rust variants.
#[test]
fn every_save_transaction_union_declares_exactly_the_rust_variants() {
    let source = read_without_comments("src/lib/ipc/types.ts");
    for (name, samples) in save_transaction_enums() {
        let union = name_union_of(name, &samples);
        let rust: BTreeSet<String> = samples.iter().map(variant_name).collect();
        let declared = union_members(&source, &union);
        assert_same_names(&format!("type {union}"), &rust, &declared);
    } // End of the loop over the save-transaction enums
} // End of function every_save_transaction_union_declares_exactly_the_rust_variants()

/// Every save-transaction struct declares exactly the properties `serde` writes.
#[test]
fn every_save_transaction_struct_declares_exactly_the_properties_serde_writes() {
    let source = read_without_comments("src/lib/ipc/types.ts");
    for (name, value) in save_transaction_structs() {
        let declared = interface_fields(&source, name);
        let written = json_keys(&value);
        assert_same_names(&format!("interface {name}"), &written, &declared);
    }
} // End of function every_save_transaction_struct_declares_exactly_the_properties_serde_writes()

/// The six-field creation payload, with every optional key present.
fn a_new_match() -> NewMatch {
    NewMatch {
        trigger: ":new".to_owned(),
        replace: "a new snippet".to_owned(),
        label: Some("a label".to_owned()),
        word: Some("true".to_owned()),
        left_word: Some("false".to_owned()),
        right_word: Some("on".to_owned()),
    }
} // End of function a_new_match()

/// `NewMatch`'s TypeScript interface declares exactly the properties `serde`
/// reads, with the same required-versus-optional behaviour.
///
/// **The one wire value that travels *into* a writing command with a shape of
/// its own**, and the reason it needs its own check: every other test in this
/// module compares what `serde` **writes**, and `serde` reading is not that
/// question's mirror. An unknown JSON property is *ignored* on the way in, so a
/// typo in one TypeScript key — `rightWord` where the field is `right_word` —
/// compiles, type-checks, sends a property no field claims, defaults the Rust
/// field to `None`, and drops that key from the snippet the save writes. Nothing
/// in `svelte-check` and nothing in `cargo test` could see it before this.
///
/// Four claims, and **all six properties contribute to the count**, so a check
/// that stopped exercising one is a failure rather than a smaller pass:
///
/// 1. the names match — the serialize side writes every field, so its keys are
///    the Rust property list;
/// 2. a property TypeScript declares **required** is one `serde` refuses to
///    default, both when the key is omitted and when it is `null`;
/// 3. a property TypeScript declares `?:` is one `serde` accepts omitted **and**
///    accepts as `null`, reading both as absent;
/// 4. an optional property's declared type admits `null`, which is the second
///    spelling of absent this wire really sends.
///
/// What it does **not** check is the type text of a required property beyond its
/// being `string`: this harness resolves no TypeScript types, and that limit is
/// the module's own (see its header).
#[test]
fn the_creation_payload_declares_exactly_the_properties_serde_reads() {
    let source = read_without_comments("src/lib/ipc/types.ts");
    let declared = interface_properties(&source, "NewMatch");
    let whole = json_of(&a_new_match());
    let written = json_keys(&whole);
    assert_same_names(
        "interface NewMatch",
        &written,
        &declared.keys().cloned().collect(),
    );
    assert_eq!(
        serde_json::from_value::<NewMatch>(whole.clone()).expect("the whole payload deserializes"),
        a_new_match(),
        "every declared property must be read back, or one of them is being ignored"
    );

    let Value::Object(object) = &whole else {
        panic!("a struct crosses as an object");
    };
    let mut checked = 0usize;
    for (name, (optional, declared_type)) in &declared {
        let mut without = object.clone();
        without.remove(name);
        let mut nulled = object.clone();
        nulled.insert(name.clone(), Value::Null);
        let omitted = serde_json::from_value::<NewMatch>(Value::Object(without));
        let nulled = serde_json::from_value::<NewMatch>(Value::Object(nulled));
        if *optional {
            let omitted = omitted
                .unwrap_or_else(|error| panic!("`{name}?:` must default when omitted: {error}"));
            let nulled =
                nulled.unwrap_or_else(|error| panic!("`{name}?:` must accept null: {error}"));
            assert_eq!(
                json_of(&omitted)[name],
                Value::Null,
                "an omitted `{name}` must read as absent"
            );
            assert_eq!(
                json_of(&nulled)[name],
                Value::Null,
                "a null `{name}` must read as absent, never as an empty string"
            );
            assert!(
                declared_type.contains("null"),
                "`{name}?: {declared_type}` must admit null, because that is what this \
                 wire sends for an absent optional"
            );
        } else {
            assert!(
                omitted.is_err(),
                "`{name}` is declared required, so omitting it must be refused"
            );
            assert!(
                nulled.is_err(),
                "`{name}` is declared required, so a null must be refused"
            );
            assert_eq!(
                declared_type, "string",
                "a required creation property carries logical text and nothing else"
            );
        }
        checked += 1;
    } // End of the loop over the creation payload's declared properties
    assert_eq!(
        checked, 6,
        "Phase 2b-2c-2 put two properties on this payload and Phase 2c-4c-1 added \
         four optional ones; a property that stopped being exercised is a hole"
    );
} // End of function the_creation_payload_declares_exactly_the_properties_serde_reads()

/// Every tagged save-transaction variant's operands are the keys `serde` writes.
///
/// The union check above compares variant *names*; this compares what is inside
/// each variant, which is where a renamed `first_difference` or a dropped
/// `source_len` would hide.
///
/// **Three shapes, and only one of them is checked here.** A unit variant crosses
/// as a bare string and has nothing to compare. A *newtype* variant —
/// `SaveError::Patch(EditError)`, `SyntaxError::Parse(ParseFailure)` — crosses as
/// a one-key object whose payload is another wire type, which the check for
/// *that* type covers; declaring it as `readonly Patch: EditError` is a type
/// reference this harness deliberately does not resolve, exactly as `ValueView`'s
/// named-interface payloads are left to `samples()`. What is left is the **struct
/// variant**, whose payload is a set of named operands, and the two counts below
/// are pinned so that a struct variant silently declared as a type reference is a
/// failure rather than a skip.
#[test]
fn every_save_transaction_variant_declares_exactly_the_operands_serde_writes() {
    let source = read_without_comments("src/lib/ipc/types.ts");
    let mut checked = 0usize;
    let mut nested = 0usize;
    let mut unit = 0usize;
    for (name, samples) in save_transaction_enums() {
        let union = name_union_of(name, &samples);
        // A `…Name` union carries the names; the *value* union is where the
        // payloads are declared, and for a bare-name-only enum they are one type.
        let value_union = name;
        for json in samples {
            let Value::Object(map) = &json else {
                unit += 1;
                continue;
            };
            let variant = variant_name(&json);
            let Some(payload) = map.get(&variant).and_then(Value::as_object) else {
                // A newtype variant carrying a scalar or a list. None exists
                // today; counted rather than assumed away.
                nested += 1;
                continue;
            };
            let Some(declared) = tagged_variant_fields(&source, value_union, &variant) else {
                nested += 1;
                continue;
            };
            let written: BTreeSet<String> = payload.keys().cloned().collect();
            assert_same_names(
                &format!("the {variant} payload of type {union}"),
                &written,
                &declared,
            );
            checked += 1;
        } // End of the loop over one enum's samples
    } // End of the loop over the save-transaction enums
    assert_eq!(
        (checked, nested, unit),
        (123, 12, 71),
        "Phase 2b-1 put 94 struct variants, 11 newtype variants and 52 unit \
         variants on this wire, Phase 2b-2a's NotReencodable added one newtype \
         and seven unit ones, Phase 2b-2c-1's eight sequence-item refusals are \
         eight more struct ones, PresentationNote's two are two more, \
         Phase 2b-2c-3's DocumentDoesNotParse and ReplacementRequiresBackups are \
         two more, and Phase 2c-3c-1's duplicate added nine struct ones and \
         three unit ones, and Phase 2c-4b-1 added ReapplyRefusal's nine unit \
         ones plus five checked struct ones: ReapplyResolution's four — its two \
         **empty** arms included, because the review round taught \
         `tagged_variant_fields` to read `Record<string, never>` as a checked \
         zero-field payload rather than skip it — and, since the same round made \
         a move's placement anchor an operand of its own, ReapplyPlacement's \
         three, of which one is empty and two carry payloads, and Phase 2c-4c-1 \
         added the creation's own NewMatchRepeatsLiteralTrigger as one more \
         struct variant; \
         a struct variant that became a skip is a hole"
    );
} // End of function every_save_transaction_variant_declares_exactly_the_operands_serde_writes()

/// A path no encoding can name still crosses as a save-transaction error.
///
/// The reason `WriteError`, `BackupError`, `SaveError`, `TargetDifference` and
/// `BackupRecord` have hand-written `Serialize` impls: `serde`'s own `PathBuf`
/// serializer **fails** on such a path, and a failure there arrives *after* the
/// command has answered, with no typed refusal left to fall back on. The premise
/// is asserted first, so this cannot pass with the fix removed.
#[test]
#[cfg(unix)]
fn a_non_utf8_path_crosses_every_save_transaction_error() {
    use std::ffi::OsStr;
    use std::os::unix::ffi::OsStrExt;

    let mut path = PathBuf::from("/nowhere/match");
    path.push(OsStr::from_bytes(b"ba\xffse.yml"));
    assert!(
        serde_json::to_value(&path).is_err(),
        "the premise of this test is that a bare PathBuf cannot carry these bytes"
    );

    let carriers: Vec<(&str, Value)> = vec![
        (
            "SaveError",
            json_of(&SaveError::DocumentIsReadOnly { path: path.clone() }),
        ),
        (
            "WriteError",
            json_of(&WriteError::TargetMissing { path: path.clone() }),
        ),
        (
            "WriteError::Io",
            json_of(&WriteError::Io {
                step: WriteStep::Rename,
                path: path.clone(),
                source: io::Error::from(io::ErrorKind::PermissionDenied),
            }),
        ),
        (
            "BackupError",
            json_of(&BackupError::NotADirectory { path: path.clone() }),
        ),
        (
            "TargetDifference",
            json_of(&TargetDifference::Retargeted { now: path.clone() }),
        ),
        (
            "BackupRecord",
            json_of(&BackupRecord {
                path: path.clone(),
                batch: path.clone(),
                rotation: Rotation::default(),
            }),
        ),
    ];
    for (what, value) in carriers {
        let rendered = serde_json::to_string(&value).expect("a wire value must always serialize");
        assert!(
            rendered.contains('\u{fffd}'),
            "{what} lost the replacement character: {rendered}"
        );
        assert!(
            rendered.contains("se.yml"),
            "{what} lost the rest of the name: {rendered}"
        );
    } // End of the loop over the path-carrying wire values
} // End of function a_non_utf8_path_crosses_every_save_transaction_error()

/// An `io::Error`'s message never reaches the save wire; its kind does.
///
/// "Codes, never prose" (plan section 9) applied to the two variants that carry
/// an [`io::Error`]. The sentence below is what an operating system would supply,
/// in a language nobody chose.
#[test]
fn an_io_errors_message_is_not_on_the_save_wire_but_its_kind_is() {
    let sentence = "the developer-facing sentence that must not be sent";
    let write = json_of(&WriteError::Io {
        step: WriteStep::Rename,
        path: a_path(),
        source: io::Error::new(io::ErrorKind::PermissionDenied, sentence),
    });
    let backup = json_of(&BackupError::Io {
        step: BackupStep::CreateBatch,
        path: a_path(),
        source: io::Error::new(io::ErrorKind::PermissionDenied, sentence),
    });
    for (what, value) in [("WriteError", write), ("BackupError", backup)] {
        let rendered = serde_json::to_string(&value).expect("a wire value must serialize");
        assert!(
            !rendered.contains(sentence),
            "{what} put the io::Error's Display string on the wire: {rendered}"
        );
        assert!(
            rendered.contains("PermissionDenied"),
            "{what} dropped the io::ErrorKind name, which is the code: {rendered}"
        );
        assert!(
            !rendered.contains("\"source\""),
            "{what} still writes a `source` field, which serde cannot render as a code"
        );
        assert!(
            rendered.contains("\"raw_os_error\":null"),
            "{what} must still write the errno field for an error the system did \
             not raise, because the field is nullable rather than optional: {rendered}"
        );
    } // End of the loop over the two I/O carriers
} // End of function an_io_errors_message_is_not_on_the_save_wire_but_its_kind_is()

/// The system's own error number crosses beside the kind, as a number.
///
/// `docs/reviews/phase-2b-1-wire-boundary.md` section 3: [`io::ErrorKind`] is a
/// small stable set, so several actionable operating-system failures collapse
/// into one name and platform-specific distinctions are lost. The errno is the
/// distinction, and it is **a number** — not a code with a dictionary entry, and
/// not the operating system's localized prose, which stays off this wire.
///
/// It is nullable rather than absent, following the wire's own convention
/// (`src/lib/ipc/types.ts`: *nullable, never optional*), so a consumer reads one
/// shape whether or not the system supplied a number.
#[test]
fn an_io_errors_raw_os_error_crosses_as_a_number_beside_its_kind() {
    let from_the_system = json_of(&WriteError::Io {
        step: WriteStep::Rename,
        path: a_path(),
        source: io::Error::from_raw_os_error(28),
    });
    assert_eq!(from_the_system["Io"]["kind"], "StorageFull");
    assert_eq!(
        from_the_system["Io"]["raw_os_error"], 28,
        "the errno the system returned must survive the crossing: {from_the_system}"
    );

    let ours = json_of(&BackupError::Io {
        step: BackupStep::CreateBatch,
        path: a_path(),
        source: io::Error::other("built by this crate, with no errno behind it"),
    });
    assert!(
        ours["Io"]["raw_os_error"].is_null(),
        "an error with no operating system behind it writes null, never an \
         invented number: {ours}"
    );
} // End of function an_io_errors_raw_os_error_crosses_as_a_number_beside_its_kind()

/// A save error keeps the error it carries whole, rather than flattening it.
///
/// The decision `SaveError`'s `Serialize` impl argues, asserted rather than left
/// as prose: `WriteError::may_have_written` is computed from the `WriteStep`, and
/// a flattened copy would drop the step and with it the one question whose answer
/// changes what a caller does next.
#[test]
fn a_save_error_carries_its_write_error_whole() {
    let value = json_of(&SaveError::Write(WriteError::Io {
        step: WriteStep::SyncDirectory,
        path: a_path(),
        source: io::Error::from(io::ErrorKind::PermissionDenied),
    }));
    assert_eq!(value["Write"]["Io"]["step"], "SyncDirectory");
    assert!(
        value["Write"]["Io"]["path"].is_string(),
        "the nested path is a lossy string: {value}"
    );
} // End of function a_save_error_carries_its_write_error_whole()

/// An acknowledgement crosses as the findings it holds, never as a flag.
///
/// The wire form of the whole design: a save is refused until every suspicion the
/// candidate produces is matched, by content, against one of these. A boolean
/// would let a caller wave past findings nobody looked at, and there is
/// deliberately no boolean anywhere on this wire to find.
#[test]
fn an_acknowledgement_crosses_as_its_findings_and_not_as_a_flag() {
    let value = json_of(&Acknowledgement::of(&[a_finding()]));
    let accepted = value["accepted"]
        .as_array()
        .expect("an acknowledgement carries a list of findings");
    assert_eq!(accepted.len(), 1);
    assert!(
        accepted[0]["code"]["VariableTypeNotRecognised"]["declared"] == "global",
        "the finding's own code and operands travel with it: {value}"
    );
    assert!(
        !value.to_string().contains("true") && !value.to_string().contains("false"),
        "nothing on this wire is a boolean override: {value}"
    );
} // End of function an_acknowledgement_crosses_as_its_findings_and_not_as_a_flag()

/// The `{placeholder}` names one dictionary value uses.
///
/// The same token grammar `placeholdersOf` applies in
/// `src/lib/i18n/dictionaries.ts`: an ASCII letter followed by letters, digits
/// and underscores, between braces. Written out here rather than shared, because
/// the two live in different languages and the check is only worth anything if
/// this side reads what that side will substitute.
fn placeholders_of(value: &str) -> BTreeSet<String> {
    let mut found = BTreeSet::new();
    let characters: Vec<char> = value.chars().collect();
    let mut index = 0usize;
    while index < characters.len() {
        if characters[index] != '{' {
            index += 1;
            continue;
        }
        let mut end = index + 1;
        while end < characters.len() && characters[end] != '}' {
            end += 1;
        }
        let name: String = characters[index + 1..end.min(characters.len())]
            .iter()
            .collect();
        let is_token = !name.is_empty()
            && name.starts_with(|first: char| first.is_ascii_alphabetic())
            && name
                .chars()
                .all(|character| character.is_ascii_alphanumeric() || character == '_');
        if end < characters.len() && is_token {
            found.insert(name);
        }
        index = end + 1;
    } // End of the walk over the value's characters
    found
} // End of function placeholders_of()

/// Every placeholder of a save-transaction message names an operand `serde` writes.
///
/// **The gap between a sentence and a wire value, and nothing else checks it.**
/// `translate` leaves an unmatched `{placeholder}` in the output verbatim — on
/// purpose, so a gap is visible rather than silently empty — so a message naming
/// `{path}` for a variant that carries no `path` reaches a screen with a brace in
/// it. The dictionary contract sees only keys, `dictionaries.test.ts` sees only
/// that the two languages agree with each other, and neither has the JSON.
///
/// The operand must also be a **string or a number**: `scalarOperands` in
/// `src/lib/i18n/codes.ts` drops everything else, so naming a nested error or an
/// enum operand would leave the same visible brace.
///
/// Both dictionaries are read. The Spanish one is checked separately rather than
/// trusted to `dictionaries.test.ts`'s placeholder-parity assertion, because that
/// assertion says the two agree and this one says they are both right.
#[test]
fn every_save_transaction_placeholder_names_an_operand_serde_writes() {
    let english = crate::dictionary_contract::dictionary_values("src/lib/i18n/en.json");
    let spanish = crate::dictionary_contract::dictionary_values("src/lib/i18n/es.json");
    let mut checked = 0usize;
    for (name, samples) in save_transaction_enums() {
        for json in samples {
            let variant = variant_name(&json);
            let key = crate::dictionary_contract::code_key(name, &variant);
            let operands: BTreeSet<String> = json
                .get(&variant)
                .and_then(Value::as_object)
                .map(|payload| {
                    payload
                        .iter()
                        .filter(|(_, value)| value.is_string() || value.is_number())
                        .map(|(operand, _)| operand.clone())
                        .collect()
                })
                .unwrap_or_default();
            for (locale, dictionary) in [("en", &english), ("es", &spanish)] {
                let sentence = dictionary
                    .get(&key)
                    .unwrap_or_else(|| panic!("{locale}.json has no {key}"));
                let named = placeholders_of(sentence);
                let unbacked: Vec<&String> = named.difference(&operands).collect();
                assert!(
                    unbacked.is_empty(),
                    "{locale}.json's {key} names {unbacked:?}, which {name}::{variant} does \
                     not write as a string or a number, so the brace would reach a screen"
                );
            } // End of the loop over the two dictionaries
            checked += 1;
        } // End of the loop over one enum's samples
    } // End of the loop over the save-transaction enums
    assert_eq!(
        checked, 206,
        "the placeholder check stopped covering every variant"
    );
} // End of function every_save_transaction_placeholder_names_an_operand_serde_writes()

// ---------------------------------------------------------------------------
// The read-only backup catalogue — Phase 2c-5-2
// ---------------------------------------------------------------------------
//
// Its own tables rather than an extension of `save_transaction_enums`, for the
// reason Phase 2b-1 gave that group its own: the counts pinned there are the
// save transaction's, and folding a second family into them would make every one
// of those numbers mean two things at once. The three checks below are the same
// three, over the catalogue's own values.

/// A batch identity, for the samples below.
fn a_batch() -> BackupBatchId {
    BackupBatchId::parse("2026-01-02T030405Z-0").expect("a name the batch grammar admits")
}

/// An entry identity, for the samples below.
fn an_entry() -> BackupEntryId {
    BackupEntryId::in_batch(a_batch(), Path::new("match/base.yml"))
        .expect("a relative path this catalogue can address")
}

/// One value of every [`BackupRootState`] variant.
fn backup_root_state_samples() -> Vec<BackupRootState> {
    vec![BackupRootState::Missing, BackupRootState::Present]
}

/// One value of every [`BatchSkipped`] variant.
fn batch_skipped_samples() -> Vec<BatchSkipped> {
    vec![
        BatchSkipped::ForeignName,
        BatchSkipped::NotADirectory,
        BatchSkipped::NoMarker,
        BatchSkipped::Unreadable,
    ]
}

/// One value of every [`EntrySkipped`] variant.
fn entry_skipped_samples() -> Vec<EntrySkipped> {
    vec![
        EntrySkipped::Marker,
        EntrySkipped::Symlink,
        EntrySkipped::NotARegularFile,
        EntrySkipped::UnusableName,
        EntrySkipped::Unreadable,
    ]
}

/// One value of every [`BackupReadStep`] variant.
fn backup_read_step_samples() -> Vec<BackupReadStep> {
    vec![
        BackupReadStep::InspectBackupRoot,
        BackupReadStep::ListBackupRoot,
        BackupReadStep::InspectBatch,
        BackupReadStep::ListBatch,
        BackupReadStep::InspectEntry,
        BackupReadStep::ReadEntry,
    ]
}

/// One value of every [`BackupTarget`] variant.
fn backup_target_samples() -> Vec<BackupTarget> {
    vec![
        BackupTarget::InConfigRoot {
            relative_path: WirePath::new("match/base.yml"),
        },
        BackupTarget::OutsideConfigRoot,
    ]
}

/// One value of every [`BackupReadError`] variant.
fn backup_read_error_samples() -> Vec<BackupReadError> {
    vec![
        BackupReadError::RootNotADirectory { path: a_path() },
        BackupReadError::RootNotPrivate {
            path: a_path(),
            mode: 0o755,
        },
        BackupReadError::StaleBatch { batch: a_batch() },
        BackupReadError::StaleEntry { entry: an_entry() },
        BackupReadError::Io {
            step: BackupReadStep::ListBatch,
            path: a_path(),
            source: io::Error::from(io::ErrorKind::PermissionDenied),
        },
        BackupReadError::NotUtf8 {
            entry: an_entry(),
            offset: 11,
        },
    ]
} // End of function backup_read_error_samples()

/// A synthetic configuration with one recognised batch holding one copy.
///
/// Hand-authored and neutral (CLAUDE.md section 1). The batch is written
/// directly rather than taken from a save, because the values under test are the
/// **read** side and a fixture that had to write a file first would be measuring
/// the writer.
///
/// The temporary directory is returned beside the workspace: dropping it would
/// remove the tree while the catalogue is still being asked about it.
fn a_catalogued_workspace() -> (tempfile::TempDir, espansoconfig_core::workspace::Workspace) {
    use std::os::unix::fs::PermissionsExt as _;

    let dir = tempfile::TempDir::new().expect("temp dir");
    let root = dir.path();
    std::fs::create_dir_all(root.join("match")).expect("the match directory");
    std::fs::write(root.join("match").join("base.yml"), MATCH_FILE).expect("the live file");

    let batch = root
        .join(espansoconfig_core::persist::BACKUP_DIRECTORY_NAME)
        .join("2026-01-02T030405Z-0");
    std::fs::create_dir_all(batch.join("match")).expect("the batch directory");
    std::fs::write(
        batch.join(espansoconfig_core::persist::BATCH_MARKER_NAME),
        format!("{}\n", espansoconfig_core::persist::BATCH_MARKER_FORMAT),
    )
    .expect("the ownership marker");
    std::fs::write(batch.join("match").join("base.yml"), "matches: []\n").expect("the copy");
    std::fs::set_permissions(
        root.join(espansoconfig_core::persist::BACKUP_DIRECTORY_NAME),
        std::fs::Permissions::from_mode(0o700),
    )
    .expect("a backup root is private to its owner");

    let workspace = espansoconfig_core::workspace::Workspace::open(root).expect("the tree opens");
    (dir, workspace)
} // End of function a_catalogued_workspace()

/// Every backup-catalogue struct paired with the JSON `serde` really writes.
///
/// Driven through the three read operations rather than built from struct
/// literals, because four of the seven shapes have private fields the catalogue
/// fills and a literal would need accessors this crate has no other use for.
/// What that costs is the *a-field-added-here-fails-to-compile* guard
/// `save_transaction_structs` gets from its literals; what replaces it is that
/// these are the values the commands really answer with, which is the stronger
/// half of the same question.
fn backup_catalogue_structs() -> Vec<(&'static str, Value)> {
    let (_dir, workspace) = a_catalogued_workspace();
    let batches = crate::backup::list_batches(&workspace).expect("the root lists");
    let batch = batches
        .batches
        .first()
        .expect("the fixture holds one recognised batch")
        .clone();
    let key = crate::backup::BackupBatchKey {
        name: batch.display_name().to_owned(),
    };
    let entries = crate::backup::list_entries(&workspace, &key).expect("the batch walks");
    let entry = entries
        .entries
        .first()
        .expect("the fixture's batch holds one entry")
        .clone();
    let document = workspace
        .list_documents()
        .iter()
        .find(|summary| summary.relative_path.as_path().ends_with("base.yml"))
        .expect("the tree holds base.yml")
        .id;
    let text = crate::backup::read_text(
        &workspace,
        &crate::backup::BackupEntryKey {
            batch: crate::backup::BackupBatchKey {
                name: entry.id().batch().display_name().to_owned(),
            },
            relative_path: entry.id().relative_path().to_string_lossy().into_owned(),
        },
        document,
    )
    .expect("the mapped entry reads");
    vec![
        ("BackupBatchId", json_of(batch.id())),
        ("BackupBatch", json_of(&batch)),
        ("BackupEntryId", json_of(entry.id())),
        ("BackupEntry", json_of(&entry)),
        ("BackupBatchListing", json_of(&batches)),
        ("BackupEntryListing", json_of(&entries)),
        ("BackupTextResponse", json_of(&text)),
    ]
} // End of function backup_catalogue_structs()

/// Every backup-catalogue enum and the samples for it.
fn backup_catalogue_enums() -> Vec<(&'static str, Vec<Value>)> {
    vec![
        (
            "BackupRootState",
            backup_root_state_samples().iter().map(json_of).collect(),
        ),
        (
            "BatchSkipped",
            batch_skipped_samples().iter().map(json_of).collect(),
        ),
        (
            "EntrySkipped",
            entry_skipped_samples().iter().map(json_of).collect(),
        ),
        (
            "BackupReadStep",
            backup_read_step_samples().iter().map(json_of).collect(),
        ),
        (
            "BackupTarget",
            backup_target_samples().iter().map(json_of).collect(),
        ),
        (
            "BackupReadError",
            backup_read_error_samples().iter().map(json_of).collect(),
        ),
    ]
} // End of function backup_catalogue_enums()

/// Every backup-catalogue sample list is its enum's declaration.
///
/// Read from the core's own source rather than from the list, exactly as the
/// save transaction's twin is: a list checked against itself is a list that
/// cannot fail.
#[test]
fn every_backup_catalogue_sample_list_is_its_enums_declaration() {
    let mut variants = 0usize;
    for (name, samples) in backup_catalogue_enums() {
        let declared = crate::dictionary_contract::declared_variants_of(name);
        let enumerated: BTreeSet<String> = samples.iter().map(variant_name).collect();
        assert_eq!(
            declared, enumerated,
            "the {name} sample list and the {name} declaration disagree"
        );
        assert_eq!(
            samples.len(),
            enumerated.len(),
            "the {name} sample list holds two instances of one variant"
        );
        variants += samples.len();
    } // End of the loop over the backup catalogue's enums
    assert_eq!(
        variants, 25,
        "Phase 2c-5-2 puts twenty-five variants on this wire — BackupRootState's two, \
         BatchSkipped's four, EntrySkipped's five, BackupReadStep's six, BackupTarget's \
         two and BackupReadError's six; this list now holds {variants}"
    );
} // End of function every_backup_catalogue_sample_list_is_its_enums_declaration()

/// Every backup-catalogue union declares exactly the Rust variants.
#[test]
fn every_backup_catalogue_union_declares_exactly_the_rust_variants() {
    let source = read_without_comments("src/lib/ipc/types.ts");
    for (name, samples) in backup_catalogue_enums() {
        let union = name_union_of(name, &samples);
        let rust: BTreeSet<String> = samples.iter().map(variant_name).collect();
        let declared = union_members(&source, &union);
        assert_same_names(&format!("type {union}"), &rust, &declared);
    } // End of the loop over the backup catalogue's enums
} // End of function every_backup_catalogue_union_declares_exactly_the_rust_variants()

/// Every backup-catalogue struct declares exactly what `serde` writes.
#[test]
fn every_backup_catalogue_struct_declares_exactly_the_properties_serde_writes() {
    let source = read_without_comments("src/lib/ipc/types.ts");
    let structs = backup_catalogue_structs();
    assert_eq!(
        structs.len(),
        7,
        "the catalogue puts seven struct shapes on this wire"
    );
    for (name, value) in structs {
        let declared = interface_fields(&source, name);
        let written = json_keys(&value);
        assert_same_names(&format!("interface {name}"), &written, &declared);
    } // End of the loop over the backup catalogue's structs
} // End of function every_backup_catalogue_struct_declares_exactly_the_properties_serde_writes()

/// Every tagged backup-catalogue variant's operands are the keys `serde` writes.
///
/// Two of the six enums are mixed in shape — [`BackupTarget`] carries an operand
/// in one variant and none in the other — so the three counts are pinned exactly,
/// and a struct variant silently declared as a type reference is a failure rather
/// than a skip.
#[test]
fn every_backup_catalogue_variant_declares_exactly_the_operands_serde_writes() {
    let source = read_without_comments("src/lib/ipc/types.ts");
    let mut checked = 0usize;
    let mut nested = 0usize;
    let mut unit = 0usize;
    for (name, samples) in backup_catalogue_enums() {
        let union = name_union_of(name, &samples);
        for json in samples {
            let Value::Object(map) = &json else {
                unit += 1;
                continue;
            };
            let variant = variant_name(&json);
            let Some(payload) = map.get(&variant).and_then(Value::as_object) else {
                nested += 1;
                continue;
            };
            let Some(declared) = tagged_variant_fields(&source, name, &variant) else {
                nested += 1;
                continue;
            };
            let written: BTreeSet<String> = payload.keys().cloned().collect();
            assert_same_names(
                &format!("the {variant} payload of type {union}"),
                &written,
                &declared,
            );
            checked += 1;
        } // End of the loop over one enum's samples
    } // End of the loop over the backup catalogue's enums
    assert_eq!(
        (checked, nested, unit),
        (7, 0, 18),
        "Phase 2c-5-2 puts seven struct variants and eighteen unit variants on this wire: \
         BackupTarget's one operand-carrying arm and BackupReadError's six, against \
         seventeen bare-name members and BackupTarget::OutsideConfigRoot"
    );
} // End of function every_backup_catalogue_variant_declares_exactly_the_operands_serde_writes()

/// An identity a listing produced is exactly what the wire sends back.
///
/// **The round-trip claim, measured rather than argued.** The identities on this
/// wire are opaque, so the only thing that makes handing one back meaningful is
/// that it comes back as the same identity — and `crate::backup` is what keeps
/// that true by never offering one whose rendering is lossy.
#[test]
fn a_backup_identity_crosses_and_returns_unchanged() {
    let entry = an_entry();
    let written = json_of(&entry);
    assert_eq!(written["batch"]["name"], "2026-01-02T030405Z-0");
    assert_eq!(written["relative_path"], "match/base.yml");

    let key: crate::backup::BackupEntryKey =
        serde_json::from_value(written).expect("the wire form is what a caller sends back");
    assert_eq!(key.batch.name, entry.batch().display_name());
    assert_eq!(
        Path::new(&key.relative_path),
        entry.relative_path(),
        "an identity that went out must come back naming the same entry"
    );
} // End of function a_backup_identity_crosses_and_returns_unchanged()
