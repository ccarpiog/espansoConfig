//! One Rust parser for every contract check in this crate.
//!
//! Phase 1b-2b shipped two scanners that read Rust as **lines of text** — one
//! for enum variants (`crate::dictionary_contract`), one for string literals
//! (`crate::menu_contract`) — and the review of that phase demonstrated three
//! ways line scanning fails open:
//!
//! - `#[cfg(feature = "x")] AddedWithNoString,` — attribute and variant on one
//!   line. The variant scanner skipped any line starting with `#`, so the
//!   variant was invisible and the pinned count did not move.
//! - `Regex, AddedWithNoString,` — two variants on one line. The scanner took
//!   the leading identifier and stopped.
//! - `*/ let title = "Edit";` — a block comment closing mid-line. The literal
//!   scanner blanked the whole line, so a hardcoded English label slipped past
//!   every menu check.
//!
//! None of the three is a bug in one scanner: each is a property of deciding
//! what a declaration looks like from the shape of a line. So this module stops
//! deciding. `syn` parses the file and `proc_macro2` lexes it, both of which are
//! the compiler's own reading of the same bytes.
//!
//! Compiled only for tests, and `syn`/`proc-macro2` are dev-dependencies of
//! `src-tauri` alone. CLAUDE.md section 3 is untouched: the check is
//!
//! ```sh
//! cargo tree -p espansoconfig-core | rg tauri   # must find nothing
//! ```
//!
//! and `crates/espansoconfig-core/Cargo.toml` names neither `syn` nor `tauri` in
//! any section. **`rg syn` over that tree is not the check**, and saying it was
//! would be a claim that fails on its own terms: `serde_derive` is a proc-macro
//! crate built on `syn`, so `syn` has been in the core's dependency graph since
//! Phase 0 and says nothing about this change either way. The manifest and the
//! `tauri` grep are what say something.
//!
//! # What a parser still cannot see
//!
//! - **An item a macro produces.** `syn` sees `make_enum!(…)` as a macro
//!   invocation, not as the enum it expands to. Nothing short of running the
//!   expansion closes that, and this crate has no such macro.
//! - **An item declared inside a function body.** [`items_of`] descends into
//!   `mod` blocks and nothing else, because that is where every declaration in
//!   this workspace lives.
//! - **Whether a declaration means anything.** These functions answer "what is
//!   declared here", never "does it reach a user". That question is
//!   `crate::dictionary_contract`'s, and its own limits are recorded there.

use std::collections::BTreeSet;

use proc_macro2::{TokenStream, TokenTree};
use syn::{Fields, Item, Meta};

/// Parses Rust source into a syntax tree, failing loudly.
///
/// A file this cannot parse is a file no check below can read, and reporting
/// that as "no declarations found" is the vacuous pass every check in this
/// repository exists to avoid.
///
/// # Panics
///
/// When `source` is not valid Rust.
fn parse(source: &str, what: &str) -> syn::File {
    syn::parse_file(source).unwrap_or_else(|error| panic!("cannot parse {what} as Rust: {error}"))
}

/// Every item of a parsed file, `mod` blocks descended into.
///
/// Returned flat, because every caller wants "the declarations of this file"
/// rather than the module tree they sit in. An inline `#[cfg(test)] mod tests`
/// is descended into deliberately: a declaration that only exists under `cfg`
/// is still a declaration, and hiding one there is precisely the escape the
/// line scanner allowed.
fn items_of(file: &syn::File) -> Vec<&Item> {
    let mut found: Vec<&Item> = Vec::new();
    let mut pending: Vec<&Item> = file.items.iter().collect();
    while let Some(item) = pending.pop() {
        if let Item::Mod(module) = item {
            if let Some((_, inner)) = module.content.as_ref() {
                pending.extend(inner.iter());
            }
        }
        found.push(item);
    } // End of the loop over the file's item tree
    found
} // End of function items_of()

/// Every variant name declared by `enum <name>` in `source`.
///
/// The whole declaration is parsed, so an attribute and a variant on one line,
/// two variants on one line, a `cfg`-gated variant and a variant carrying a
/// trailing comment are all read exactly as `rustc` reads them.
///
/// `crate::error` calls this too, so there is one reading of an enum in the
/// crate rather than two that could disagree.
///
/// # Panics
///
/// When `source` declares no such enum — a rename or a moved file fails loudly
/// rather than reporting an empty variant set.
pub(crate) fn declared_variants(source: &str, name: &str) -> BTreeSet<String> {
    let file = parse(source, name);
    let declaration = items_of(&file)
        .into_iter()
        .find_map(|item| match item {
            Item::Enum(declaration) if declaration.ident == name => Some(declaration),
            _ => None,
        })
        .unwrap_or_else(|| panic!("no enum {name} is declared in this source"));
    declaration
        .variants
        .iter()
        .map(|variant| variant.ident.to_string())
        .collect()
} // End of function declared_variants()

/// Every field name declared by `struct <name>` in `source`.
///
/// The twin of [`declared_variants`] for a struct. A tuple struct and a unit
/// struct both declare no named field and answer with an empty set; every
/// caller here pins a count, so an empty answer is a failure rather than a pass.
///
/// # Panics
///
/// When `source` declares no such struct.
pub(crate) fn declared_fields(source: &str, name: &str) -> BTreeSet<String> {
    let file = parse(source, name);
    let declaration = items_of(&file)
        .into_iter()
        .find_map(|item| match item {
            Item::Struct(declaration) if declaration.ident == name => Some(declaration),
            _ => None,
        })
        .unwrap_or_else(|| panic!("no struct {name} is declared in this source"));
    match &declaration.fields {
        Fields::Named(named) => named
            .named
            .iter()
            .filter_map(|field| field.ident.as_ref().map(ToString::to_string))
            .collect(),
        Fields::Unnamed(_) | Fields::Unit => BTreeSet::new(),
    }
} // End of function declared_fields()

/// One string literal found in a source file, with the line it sits on.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct FoundLiteral {
    /// 1-based line number, so a failure message points into the real file.
    pub line: usize,
    /// The literal exactly as it is written, quotes and prefix included.
    pub text: String,
}

/// Every string literal in `source` that is not part of an attribute.
///
/// Lexed rather than masked. Comments never reach the token stream at all, so
/// the review's `*/ let title = "Edit";` — a block comment that closes
/// mid-line — is read as the statement it is; the old masker blanked the whole
/// line and let the label through.
///
/// **Attributes are skipped, and doc comments are attributes.** `#[serde(…)]`
/// and `#[derive(…)]` can carry a quoted argument, a `///` line becomes
/// `#[doc = "…"]`, and none of the three can become a menu item's title. That is
/// the same rule the masker had; what changed is that it is now applied to
/// tokens rather than to lines.
///
/// Literals inside a macro invocation **are** reported: a macro's body is a
/// token stream, and walking it is what stops `format!("Edit")` from being a
/// hole this parser opened where the line scanner had none.
pub(crate) fn string_literals(source: &str) -> Vec<FoundLiteral> {
    let tokens: TokenStream = source
        .parse()
        .unwrap_or_else(|error| panic!("cannot lex this source as Rust: {error}"));
    let mut found = Vec::new();
    collect_string_literals(tokens, &mut found);
    found.sort_by_key(|literal| literal.line);
    found
} // End of function string_literals()

/// Walks a token stream, collecting string literals and skipping attributes.
///
/// An attribute is a `#` followed by a bracketed group, with an optional `!`
/// between them for an inner attribute; both shapes are consumed whole.
fn collect_string_literals(tokens: TokenStream, found: &mut Vec<FoundLiteral>) {
    let mut trees = tokens.into_iter().peekable();
    while let Some(tree) = trees.next() {
        match tree {
            TokenTree::Punct(punct) if punct.as_char() == '#' => {
                if matches!(trees.peek(), Some(TokenTree::Punct(next)) if next.as_char() == '!') {
                    trees.next();
                }
                let is_attribute = matches!(
                    trees.peek(),
                    Some(TokenTree::Group(group))
                        if group.delimiter() == proc_macro2::Delimiter::Bracket
                );
                if is_attribute {
                    trees.next();
                }
            }
            TokenTree::Group(group) => collect_string_literals(group.stream(), found),
            TokenTree::Literal(literal) => {
                let text = literal.to_string();
                if is_string_literal(&text) {
                    found.push(FoundLiteral {
                        line: literal.span().start().line,
                        text,
                    });
                }
            }
            TokenTree::Punct(_) | TokenTree::Ident(_) => {}
        }
    } // End of the loop over the token stream
} // End of function collect_string_literals()

/// Whether a literal token is a string literal rather than a number or a char.
///
/// Covers every spelling Rust admits: `"…"`, `r"…"`, `r#"…"#`, `b"…"`, `br"…"`
/// and `c"…"`. A character literal is deliberately not one of them — it cannot
/// hold a menu label.
fn is_string_literal(text: &str) -> bool {
    let without_prefix = text
        .trim_start_matches(['b', 'c', 'r'])
        .trim_start_matches('#');
    without_prefix.starts_with('"')
} // End of function is_string_literal()

/// Every enum in `source` that `serde` can write, by name.
///
/// Two ways an enum reaches a serializer, and both count: a `Serialize` in a
/// `derive`, and a hand-written `impl Serialize for …`. The second is not
/// hypothetical — `CommandError` in `crate::error` has one, deliberately, and an
/// audit that only read `derive` lists would have missed the one enum this
/// boundary is built around.
///
/// The answer is names, not declarations, because the caller compares it with a
/// registry of namespaces. An `impl` for a type this file does not declare as an
/// enum is still reported; the caller intersects with [`declared_enums`], which
/// is what keeps a `Serialize` impl on a *struct* out of the answer.
pub(crate) fn serializable_types(source: &str) -> BTreeSet<String> {
    let file = parse(source, "a source file");
    let mut found = BTreeSet::new();
    for item in items_of(&file) {
        match item {
            Item::Enum(declaration) if derives_serialize(&declaration.attrs) => {
                found.insert(declaration.ident.to_string());
            }
            Item::Impl(block) => {
                let implements_serialize = block
                    .trait_
                    .as_ref()
                    .and_then(|(_, path, _)| path.segments.last())
                    .is_some_and(|segment| segment.ident == "Serialize");
                if implements_serialize {
                    if let Some(name) = type_name(&block.self_ty) {
                        found.insert(name);
                    }
                }
            }
            _ => {}
        }
    } // End of the loop over the file's items
    found
} // End of function serializable_types()

/// Every enum `source` declares, by name.
pub(crate) fn declared_enums(source: &str) -> BTreeSet<String> {
    let file = parse(source, "a source file");
    items_of(&file)
        .into_iter()
        .filter_map(|item| match item {
            Item::Enum(declaration) => Some(declaration.ident.to_string()),
            _ => None,
        })
        .collect()
} // End of function declared_enums()

/// Whether an attribute list carries `Serialize` inside a `derive`.
fn derives_serialize(attributes: &[syn::Attribute]) -> bool {
    attributes.iter().any(|attribute| {
        let Meta::List(list) = &attribute.meta else {
            return false;
        };
        if !list.path.is_ident("derive") {
            return false;
        }
        list.tokens
            .clone()
            .into_iter()
            .any(|tree| matches!(tree, TokenTree::Ident(ident) if ident == "Serialize"))
    })
} // End of function derives_serialize()

/// The name a type expression names, when it is a plain path.
///
/// `WirePathRef<'a>` answers `WirePathRef`: the lifetime is not part of the
/// identity the caller is comparing against a list of declared enums.
fn type_name(declared: &syn::Type) -> Option<String> {
    match declared {
        syn::Type::Path(path) => path
            .path
            .segments
            .last()
            .map(|segment| segment.ident.to_string()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{declared_enums, declared_fields, declared_variants, serializable_types};
    use super::{is_string_literal, string_literals};

    /// The three shapes the review's counterexamples used are all read.
    ///
    /// An oracle that can only ever agree with the file it was written against
    /// proves nothing, so the parser is run over sources whose answer is known.
    /// Every line below is one of the escapes the line scanner allowed.
    #[test]
    fn the_variant_reader_sees_what_a_line_scanner_could_not() {
        let source = concat!(
            "pub enum Decoy { NotThisOne }\n",
            "/// A doc comment with a { brace } in it.\n",
            "pub enum Under {\n",
            "    Plain,\n",
            "    #[cfg(feature = \"x\")] AttributeAndVariantOnOneLine,\n",
            "    TwoOnOneLine, AlsoOnThatLine,\n",
            "    WithOperands { count: usize },\n",
            "    Tuple(usize), // a trailing comment\n",
            "}\n",
            "pub enum After { NorThisOne }\n",
        );
        let mut variants: Vec<String> = declared_variants(source, "Under").into_iter().collect();
        variants.sort();
        assert_eq!(
            variants,
            vec![
                "AlsoOnThatLine",
                "AttributeAndVariantOnOneLine",
                "Plain",
                "Tuple",
                "TwoOnOneLine",
                "WithOperands",
            ]
        );
    } // End of function the_variant_reader_sees_what_a_line_scanner_could_not()

    /// A renamed or moved enum fails loudly rather than answering nothing.
    #[test]
    #[should_panic(expected = "no enum Missing is declared")]
    fn a_missing_enum_is_a_failure_and_not_an_empty_set() {
        declared_variants("pub enum Present { A }", "Missing");
    }

    /// The field reader stops at the declaration it was asked for.
    #[test]
    fn the_field_reader_reads_one_declaration() {
        let source = concat!(
            "pub struct Other { pub ignored: String }\n",
            "pub struct MenuLabels {\n",
            "    /// A doc comment: not a field.\n",
            "    pub about: String,\n",
            "    #[serde(skip)] pub hide_others: String,\n",
            "}\n",
            "pub struct After { pub also_ignored: String }\n",
        );
        let fields: Vec<String> = declared_fields(source, "MenuLabels").into_iter().collect();
        assert_eq!(fields, vec!["about", "hide_others"]);
    } // End of function the_field_reader_reads_one_declaration()

    /// A block comment that closes mid-line does not hide the code after it.
    ///
    /// The review's finding 6, verbatim. The masker this replaced blanked the
    /// whole line and reported nothing.
    #[test]
    fn a_comment_closing_mid_line_hides_nothing_after_it() {
        let source = concat!(
            "fn build() {\n",
            "    /* a comment that\n",
            "       runs over lines and closes here */ let title = \"Edit\";\n",
            "}\n",
        );
        let found = string_literals(source);
        assert_eq!(found.len(), 1, "the literal after the comment: {found:?}");
        assert_eq!(found[0].text, "\"Edit\"");
        assert_eq!(found[0].line, 3);
    } // End of function a_comment_closing_mid_line_hides_nothing_after_it()

    /// Comments and attributes carry no literal; code and macros do.
    #[test]
    fn the_literal_reader_skips_comments_and_attributes_but_not_code() {
        let source = concat!(
            "//! A module comment with a \"quotation\" in it.\n",
            "#![allow(dead_code)]\n",
            "/// A doc comment with a \"quotation\" in it.\n",
            "#[serde(rename_all = \"camelCase\")]\n",
            "struct S;\n",
            "fn f() { let visible = \"a literal\"; let also = format!(\"in a macro\"); }\n",
        );
        let texts: Vec<String> = string_literals(source)
            .into_iter()
            .map(|literal| literal.text)
            .collect();
        assert_eq!(texts, vec!["\"a literal\"", "\"in a macro\""]);
    } // End of function the_literal_reader_skips_comments_and_attributes_but_not_code()

    /// Every spelling of a string literal is one, and a char is not.
    #[test]
    fn a_raw_or_byte_string_is_a_string_and_a_char_is_not() {
        assert!(is_string_literal("\"plain\""));
        assert!(is_string_literal("r\"raw\""));
        assert!(is_string_literal("r#\"raw hash\"#"));
        assert!(is_string_literal("b\"bytes\""));
        assert!(is_string_literal("c\"c string\""));
        assert!(!is_string_literal("'c'"));
        assert!(!is_string_literal("12"));
    } // End of function a_raw_or_byte_string_is_a_string_and_a_char_is_not()

    /// A hand-written `impl Serialize` counts, and a struct's does not.
    #[test]
    fn a_hand_written_serialize_impl_is_found_and_a_struct_is_not_an_enum() {
        let source = concat!(
            "#[derive(Serialize)] pub enum Derived { A }\n",
            "pub enum Manual { B }\n",
            "impl Serialize for Manual {}\n",
            "pub struct NotAnEnum;\n",
            "impl serde::Serialize for NotAnEnum {}\n",
            "pub enum Silent { C }\n",
        );
        let serializable = serializable_types(source);
        let enums = declared_enums(source);
        let both: Vec<&String> = serializable.intersection(&enums).collect();
        assert_eq!(both, vec!["Derived", "Manual"]);
        assert!(enums.contains("Silent"), "every enum is still declared");
    } // End of function a_hand_written_serialize_impl_is_found_and_a_struct_is_not_an_enum()
} // End of module tests
