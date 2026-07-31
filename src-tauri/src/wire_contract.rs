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
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use espansoconfig_core::discovery::FileKind;
use espansoconfig_core::model::{
    ContentKind, Diagnostic, DiagnosticCode, DocumentContext, DocumentShape, DocumentView,
    MatchBadge, TriggerKind, UnknownReason, ValueKind, ValueView, VariableKind,
};
use espansoconfig_core::syntax::HazardKind;
use espansoconfig_core::wire::WirePath;
use espansoconfig_core::workspace::{project_source, DocumentSummary, WorkspaceSummary};
use espansoconfig_core::{DocumentId, LineEnding, ScalarStyle};

use crate::error::every_command_error;

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
            // A member ends at a `;` or a newline outside any nested object
            // type, so a one-line `{ readonly key: string; readonly found: X }`
            // declares two members and not one.
            ';' | '\n' if depth == 0 => segments.push(std::mem::take(&mut segment)),
            _ => segment.push(character),
        }
    } // End of the loop over the block's characters
    segments.push(segment);

    for declaration in segments {
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
fn tagged_variant_fields(source: &str, union: &str, variant: &str) -> Option<BTreeSet<String>> {
    let body = union_body(source, union);
    let header = format!("readonly {variant}: ");
    let start = body.find(&header)? + header.len();
    let what = format!("the {variant} payload of type {union}");
    Some(block_fields(braced_block(&body[start..], &what), &what))
} // End of function tagged_variant_fields()

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
fn shape_of(value: &Value) -> String {
    match value {
        Value::String(_) => "string".to_owned(),
        Value::Number(_) => "number".to_owned(),
        Value::Array(items) if items.iter().all(Value::is_string) => "stringArray".to_owned(),
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

/// The six mutating commands Phase 2 owns and this phase must not ship.
///
/// Named here so that a check can assert their absence rather than a comment
/// asserting an intention. `crate::commands` names the same six in prose; this
/// is the version that can fail.
const FORBIDDEN_COMMANDS: [&str; 6] = [
    "save_match",
    "create_match",
    "delete_match",
    "move_match",
    "save_raw_document",
    "validate_match",
];

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

/// The frontend's command names are the registered commands, both ways.
///
/// The earlier version of this test built its `registered` set by filtering the
/// **frontend's own** names through `main.rs`, so a command registered and
/// declared nowhere else was invisible to it: adding `commands::save_match` to
/// `generate_handler!` left all five declared names found and the test green.
/// The registered set is now parsed out of `generate_handler!` independently and
/// compared in both directions, and the six mutating names Phase 2 owns are
/// asserted absent from both sets — because "no mutating command is registered"
/// is the claim this check exists to keep true, and it was not being checked.
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
#[test]
fn the_registered_commands_are_the_read_only_six_and_the_menu_command() {
    let frontend = read_without_comments("src/lib/ipc/commands.ts");
    let read_only = const_array_members(&frontend, "COMMAND_NAMES");
    let menu = const_array_members(
        &read_without_comments("src/lib/ipc/menu.ts"),
        "MENU_COMMAND_NAMES",
    );
    assert_eq!(
        read_only.len(),
        6,
        "the read-only surface is six commands: {read_only:?}"
    );
    assert_eq!(menu.len(), 1, "the menu declares one command: {menu:?}");
    let declared: BTreeSet<String> = read_only.union(&menu).cloned().collect();
    let registered = registered_commands();
    assert_same_names("the registered commands", &registered, &declared);
    assert_eq!(
        registered.len(),
        7,
        "Phase 1c-2b-2a registers six read-only commands and one menu command, and no more: {registered:?}"
    );
    for forbidden in FORBIDDEN_COMMANDS {
        assert!(
            !registered.contains(forbidden) && !declared.contains(forbidden),
            "{forbidden} is a Phase 2 mutating command and must not be on this surface"
        );
    }
} // End of function the_registered_commands_are_the_read_only_six_and_the_menu_command()

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
