//! The check that no menu label was ever written in Rust.
//!
//! `scripts/lint/hardcoded-strings.ts` reads `.svelte` **markup** and nothing
//! else (`PROGRESS.md` R31). It cannot see a `<script>` body, it cannot see a
//! `.ts` constant, and it certainly cannot see `src-tauri/src/menu.rs` — so a
//! hardcoded English label in the file that builds the macOS menu would be
//! invisible to every check this repository had before this module. Phase 1b-1's
//! review found exactly that shape once already: an English sentence in
//! `Info.plist` that no check could ever have read.
//!
//! Compiled only for tests. Five things are checked, and each is one way the
//! menu could end up speaking a language nobody chose.
//!
//! 1. **`menu.rs` contains no string literal at all.** Not "no label" — no
//!    literal. An absolute rule needs no allow-list, and an allow-list is where
//!    a label would eventually be parked. The file is **lexed** rather than
//!    masked: Phase 1b-2b's review showed the old line masker blanking a whole
//!    line whenever a block comment began on it, so `*/ let title = "Edit";`
//!    slipped a hardcoded English label past every check below.
//! 2. **Every declared label field is consumed exactly once** by the builder. A
//!    label that crosses the boundary and is then dropped is a translated string
//!    that never reaches a screen, and the item wearing muda's English default
//!    in its place looks identical to a correctly built menu.
//! 3. **No predefined item takes its built-in text.** `PredefinedMenuItem::copy`
//!    accepts `Option<&str>`, and `None` means muda's own English word. An item
//!    added that way would compile, look right in review and ship untranslated.
//! 4. **The field set is exactly the `menu.` namespace of both dictionaries and
//!    exactly `MENU_LABEL_FIELDS` in `src/lib/ipc/menu.ts`**, in both
//!    directions. A label with no string, and a string no label uses, both fail.
//! 5. **What the command validates against is what the declaration says.**
//!    `crate::menu::declared_label_fields` derives the field list from a struct
//!    literal the compiler forces to be exhaustive, and this is what says the
//!    round trip through `serde` really answers with the sixteen names the
//!    source declares — the list `CommandError::InvalidMenuLabels` reports
//!    against.
//!
//! # The naming formula, and why there is not one
//!
//! `menu.<field>`, where `<field>` is the Rust field name unchanged. The
//! `code.` namespace needs a formula because its keys come from Rust *variant*
//! names, which are PascalCase (`crate::dictionary_contract`); a field name is
//! already the spelling the wire uses, so the key is the identity of it. That is
//! also what lets `menu.rs` carry no `#[serde(rename_all = …)]` attribute, and
//! therefore no string literal, which is what makes check 1 absolute.
//!
//! # What this module cannot see
//!
//! - **Whether the menu is right.** It checks that every label is supplied from
//!   the dictionary and used once. It says nothing about which item got which
//!   label, nothing about the order of the submenus, and nothing about what
//!   macOS draws. Only a running application answers that (`PROGRESS.md` R32).
//! - **A label built by a macro or a helper.** The consumption check looks for
//!   the literal text `labels.<field>`. A builder that assembled field access
//!   dynamically would be invisible to it — as would a menu built in a file
//!   other than `menu.rs`, which is why check 3 is written against that file's
//!   own use of `PredefinedMenuItem`.
//! - **Whether a Spanish label is Spanish.** `1b-1-notes.md` section 9, hole 9,
//!   unchanged.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::rust_source::{declared_fields, string_literals};

/// The Rust source that builds the menu, relative to the repository root.
const MENU_SOURCE: &str = "src-tauri/src/menu.rs";

/// The frontend module declaring the wire's label list.
const FRONTEND_SOURCE: &str = "src/lib/ipc/menu.ts";

/// The struct whose fields are the labels.
const LABELS_STRUCT: &str = "MenuLabels";

/// The prefix every dictionary key checked by this module carries.
const MENU_PREFIX: &str = "menu.";

/// How many labels the menu has, as this phase built it.
///
/// The non-vacuity guard, and the same one `crate::dictionary_contract` uses:
/// without it a parser that silently stopped recognising field declarations
/// would agree with an empty expectation, and every check below would pass while
/// reading nothing.
const LABEL_COUNT: usize = 16;

/// The predefined item that carries no text and therefore needs no label.
const TEXTLESS_ITEM: &str = "separator";

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

/// The fields of `MenuLabels`, read from `menu.rs`'s own declaration.
fn label_fields() -> BTreeSet<String> {
    declared_fields(&read_repository_file(MENU_SOURCE), LABELS_STRUCT)
}

/// Every key of one dictionary file whose name starts with `menu.`.
fn menu_keys(relative: &str) -> BTreeSet<String> {
    let text = read_repository_file(relative);
    let parsed: Value = serde_json::from_str(&text)
        .unwrap_or_else(|error| panic!("{relative} is not valid JSON: {error}"));
    parsed
        .as_object()
        .unwrap_or_else(|| panic!("{relative} is not a JSON object"))
        .keys()
        .filter(|key| key.starts_with(MENU_PREFIX))
        .cloned()
        .collect()
} // End of function menu_keys()

/// How many times `source` reads `labels.<field>` as a whole identifier.
///
/// Substring counting is wrong here and the bug is not hypothetical:
/// `labels.hide` is a prefix of `labels.hide_others`, so a plain `matches()`
/// would report the shorter field twice and the check would pass while a label
/// went unused. The character after the name has to be a boundary.
fn count_field_uses(source: &str, field: &str) -> usize {
    let needle = format!("labels.{field}");
    let mut count = 0usize;
    let mut rest = source;
    while let Some(at) = rest.find(&needle) {
        rest = &rest[at + needle.len()..];
        let bounded = rest
            .chars()
            .next()
            .is_none_or(|next| !(next.is_ascii_alphanumeric() || next == '_'));
        if bounded {
            count += 1;
        }
    } // End of the loop over the occurrences of one field name
    count
} // End of function count_field_uses()

/// `source` with every comment and every attribute replaced by spaces.
///
/// Used by checks 2 and 3, which read *code shapes* — `labels.<field>` and one
/// `PredefinedMenuItem::` call per line — rather than tokens. Masking rather
/// than deleting keeps every remaining byte at its original offset, so a
/// reported line number points into the real file.
///
/// **This masker is not what check 1 uses, and the difference is the point.**
/// Phase 1b-2b's review found it blanking a whole line whenever a block comment
/// began on it, even when the comment closed mid-line, which hid
/// `*/ let title = "Edit";` from the literal scan. Check 1 now lexes the file
/// instead. What is left here is a *conservative* reading: masking too much can
/// only make checks 2 and 3 report a label as unused or an item as untranslated,
/// which fails loudly, and `the_masker_is_conservative_about_a_comment_that_
/// closes_mid_line` pins that direction.
fn mask_comments_and_attributes(source: &str) -> String {
    let mut masked = String::with_capacity(source.len());
    let mut in_block_comment = false;
    for line in source.split_inclusive('\n') {
        let trimmed = line.trim_start();
        let blank_this_line = in_block_comment
            || trimmed.starts_with("//")
            || trimmed.starts_with("#[")
            || trimmed.starts_with("#!");
        if trimmed.starts_with("/*") {
            in_block_comment = true;
        }
        if in_block_comment && trimmed.contains("*/") {
            in_block_comment = false;
        }
        if blank_this_line {
            masked.extend(line.chars().map(|c| if c == '\n' { '\n' } else { ' ' }));
        } else {
            masked.push_str(line);
        }
    } // End of the loop over the source's lines
    masked
} // End of function mask_comments_and_attributes()

/// Fails when two key sets differ, saying which side has what.
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

/// The declaration really is being read, in the number this phase built.
#[test]
fn the_label_declaration_yields_the_field_count_this_phase_built() {
    assert_eq!(
        label_fields().len(),
        LABEL_COUNT,
        "the MenuLabels declaration and the count this module pins disagree"
    );
}

/// The menu source contains no string literal whatsoever.
///
/// The check the whole module exists for. A hardcoded label is a string literal,
/// and this file is allowed none — so there is no judgement to make about which
/// literals are user-facing and no list for one to hide on.
///
/// **Lexed, not masked.** `crate::rust_source::string_literals` reads the file
/// the way `rustc` does: comments never become tokens at all, so a block comment
/// that closes mid-line hides nothing after it, and a doc comment is an
/// attribute and is skipped along with every other attribute. A literal inside a
/// macro invocation is reported, which the old line masker also managed and a
/// naive AST walk would not.
#[test]
fn the_menu_source_contains_no_string_literal() {
    let source = read_repository_file(MENU_SOURCE);
    let offending: Vec<String> = string_literals(&source)
        .into_iter()
        .map(|literal| format!("{MENU_SOURCE}:{}: {}", literal.line, literal.text))
        .collect();
    assert!(
        offending.is_empty(),
        "{MENU_SOURCE} must hold no string literal — every label comes from the dictionaries:\n{}",
        offending.join("\n")
    );
} // End of function the_menu_source_contains_no_string_literal()

/// Every label that crosses the boundary is used exactly once by the builder.
#[test]
fn every_label_is_used_exactly_once_by_the_builder() {
    let source = mask_comments_and_attributes(&read_repository_file(MENU_SOURCE));
    let fields = label_fields();
    assert_eq!(
        fields.len(),
        LABEL_COUNT,
        "the declaration and LABEL_COUNT disagree — either a label was added or the parser \
         stopped reading; the_label_declaration_yields_the_field_count_this_phase_built says which"
    );
    for field in &fields {
        let uses = count_field_uses(&source, field);
        assert_eq!(
            uses, 1,
            "labels.{field} is used {uses} times in {MENU_SOURCE}; every label is supplied to exactly one item"
        );
    } // End of the loop over the declared labels
} // End of function every_label_is_used_exactly_once_by_the_builder()

/// No predefined menu item is built with its own built-in English text.
///
/// `PredefinedMenuItem::copy(app, None)` compiles, reviews cleanly and ships the
/// word "Copy" in every language. This is what says so.
#[test]
fn no_predefined_item_falls_back_to_its_built_in_text() {
    let source = mask_comments_and_attributes(&read_repository_file(MENU_SOURCE));
    let mut checked = 0usize;
    for line in source.lines() {
        let Some(after) = line.split("PredefinedMenuItem::").nth(1) else {
            continue;
        };
        let item: String = after
            .chars()
            .take_while(|character| character.is_ascii_alphanumeric() || *character == '_')
            .collect();
        if item == TEXTLESS_ITEM {
            continue;
        }
        checked += 1;
        assert!(
            line.contains("Some(labels."),
            "PredefinedMenuItem::{item} is built without a label from the dictionary: {}",
            line.trim()
        );
    } // End of the loop over the builder's predefined items
    assert!(
        checked >= 10,
        "only {checked} predefined items were examined, so this scan is not reading the builder"
    );
} // End of function no_predefined_item_falls_back_to_its_built_in_text()

/// The declared fields are exactly the `menu.` namespace of `en.json`.
#[test]
fn the_menu_namespace_is_exactly_the_declared_label_fields() {
    let expected: BTreeSet<String> = label_fields()
        .iter()
        .map(|field| format!("{MENU_PREFIX}{field}"))
        .collect();
    assert_eq!(
        expected.len(),
        LABEL_COUNT,
        "the declaration and LABEL_COUNT disagree — either a label was added or the parser \
         stopped reading; the_label_declaration_yields_the_field_count_this_phase_built says which"
    );
    assert_same_keys(
        "en.json, the menu namespace",
        "any MenuLabels field",
        &expected,
        &menu_keys("src/lib/i18n/en.json"),
    );
} // End of function the_menu_namespace_is_exactly_the_declared_label_fields()

/// The Spanish dictionary carries the same menu keys as the English one.
///
/// `ExactDictionary` in `dictionaries.ts` already makes this a TypeScript error.
/// It is asserted here as well for the reason `dictionary_contract` gives: a
/// maintainer who adds a label and its English string runs `cargo test`, and
/// should be told about the Spanish one then rather than two commands later.
#[test]
fn the_spanish_dictionary_declares_the_same_menu_keys() {
    assert_same_keys(
        "es.json, the menu namespace",
        "en.json",
        &menu_keys("src/lib/i18n/en.json"),
        &menu_keys("src/lib/i18n/es.json"),
    );
}

/// The frontend's label list is exactly the Rust declaration, both ways.
///
/// The frontend builds the payload by iterating `MENU_LABEL_FIELDS`. A field
/// Rust declares and that array omits is a missing label at validation time; a
/// field the array holds and Rust does not declare is a `deny_unknown_fields`
/// refusal. Both are runtime failures in a window nobody has opened, so both are
/// made compile-time-adjacent here.
#[test]
fn the_frontend_declares_exactly_the_label_fields() {
    let frontend = read_repository_file(FRONTEND_SOURCE);
    let declared = crate::wire_contract::const_array_members(&frontend, "MENU_LABEL_FIELDS");
    assert_same_keys(
        "MENU_LABEL_FIELDS in src/lib/ipc/menu.ts",
        "any MenuLabels field",
        &label_fields(),
        &declared,
    );
} // End of function the_frontend_declares_exactly_the_label_fields()

/// What the command validates against is what the declaration says.
///
/// `crate::menu::declared_label_fields` builds the list by serializing a struct
/// literal the compiler forces to be exhaustive, so it cannot fall *behind* the
/// declaration. What it could do is answer something else entirely — a
/// `#[serde(rename)]` on a field, or a serializer that stopped writing one — and
/// then `CommandError::InvalidMenuLabels` would report field names the frontend
/// has never heard of. This is the comparison that would fail if it did.
#[test]
fn the_validated_field_list_is_the_declared_one() {
    assert_same_keys(
        "MenuLabels::declared_label_fields()",
        "the MenuLabels declaration",
        &label_fields(),
        &crate::menu::declared_label_fields(),
    );
}

#[cfg(test)]
mod scanner_tests {
    use super::{count_field_uses, mask_comments_and_attributes};

    /// A field name that is a prefix of another is not counted twice.
    ///
    /// The bug this helper exists for: `labels.hide` is a prefix of
    /// `labels.hide_others`, and a substring count would say the shorter field
    /// was used twice while the menu never read it at all.
    #[test]
    fn the_use_counter_respects_identifier_boundaries() {
        let source = "Some(labels.hide_others.as_str()), Some(labels.hide.as_str())";
        assert_eq!(count_field_uses(source, "hide"), 1);
        assert_eq!(count_field_uses(source, "hide_others"), 1);
        assert_eq!(count_field_uses(source, "quit"), 0);
    } // End of function the_use_counter_respects_identifier_boundaries()

    /// The masker blanks comments and attributes and nothing else.
    #[test]
    fn the_mask_hides_comments_and_attributes_but_not_code() {
        let masked = mask_comments_and_attributes(concat!(
            "//! A module comment with a \"quotation\" in it.\n",
            "#[serde(rename_all = \"camelCase\")]\n",
            "let visible = \"a literal\";\n",
        ));
        assert!(!masked.lines().next().unwrap_or_default().contains('"'));
        assert!(!masked.lines().nth(1).unwrap_or_default().contains('"'));
        assert!(masked.lines().nth(2).unwrap_or_default().contains('"'));
        assert_eq!(
            masked.lines().count(),
            3,
            "masking must preserve every line"
        );
    } // End of function the_mask_hides_comments_and_attributes_but_not_code()

    /// The masker over-masks a line where a block comment closes, deliberately.
    ///
    /// **The review's finding 6, pinned as a limit rather than left implicit.**
    /// Check 1 no longer uses this function, because for a *literal* scan
    /// over-masking is a false negative and a hardcoded label got through it.
    /// Checks 2 and 3 still do, and for them over-masking is a false
    /// **positive**: a `PredefinedMenuItem` call whose line began inside a
    /// comment reads as an item with no label and fails loudly. This is the
    /// assertion that says which direction the remaining looseness runs in.
    #[test]
    fn the_masker_is_conservative_about_a_comment_that_closes_mid_line() {
        let masked = mask_comments_and_attributes(concat!(
            "/* a comment\n",
            "   closing here */ let title = \"Edit\";\n",
        ));
        assert!(
            !masked.lines().nth(1).unwrap_or_default().contains("title"),
            "the masker still blanks the whole line; checks 2 and 3 fail safe on it"
        );
        assert_eq!(
            crate::rust_source::string_literals(concat!(
                "fn f() {\n",
                "/* a comment\n",
                "   closing here */ let title = \"Edit\";\n",
                "}\n",
            ))
            .len(),
            1,
            "and check 1's lexer sees the literal the masker hides"
        );
    } // End of function the_masker_is_conservative_about_a_comment_that_closes_mid_line()
} // End of module scanner_tests
