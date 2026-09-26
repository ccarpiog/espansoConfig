//! The rules an **author-chosen key** must meet before this engine writes it
//! (Phase 4-3; `docs/decisions/4-split-notes.md` §3 ruling 7).
//!
//! Until Phase 4-3 every key a draft could write was one espanso's schema fixes
//! (decision D1 of `docs/decisions/2b-2b-2-notes.md`). A new `params` entry is
//! the first key whose text the author chooses, so the text-only half of ruling
//! 7 is stated here, once, and read by two callers that must not disagree: the
//! planner refuses a key by name ([`crate::draft::DraftError`]), and
//! [`crate::draft::check_closed_surface`] refuses a hand-built batch holding one
//! as outside the surface.
//!
//! The key is **decoded text**. It is spelled by [`crate::emit::choose_scalar`]
//! in key context by the patch engine, never by a caller, so a key such as
//! `yes`, `a: b` or `#x` is quoted as its text requires and reads back as the
//! same text. What this module refuses is text no spelling should carry into a
//! mapping key. The document-dependent half of ruling 7 — duplicates against the
//! mapping's decoded keys and the batch's pending insertions — needs the
//! projection and lives in the planner.

/// The known non-string settings ruling 4 of `docs/decisions/4-split-notes.md`
/// §3 names, which a new `params` entry may **not** be named (Phase 4-3).
///
/// A new author-named entry's value is a logical string spelled by the codec, so
/// `trim: true` requested that way would be written `trim: 'true'` — A1 one
/// level down. Ruling 4 gives these keys explicit plain-source policies in the
/// step that first writes them: a new variable writes `offset`, `trim` and
/// `debug` through its kind's own fields (Phase 4-4), and a form field
/// definition writes `multiline` and `trim_string_values` through
/// [`crate::draft::FormOptions`] (Phase 4-6). As a new author-named entry — a
/// `params` entry, a new variable's extra parameter or a definition's extra
/// option — every one of the five is refused by name
/// ([`crate::draft::DraftError::NewKeyIsATypedSetting`]) rather than written as
/// a string. `inject_vars` is ruling 4's sixth setting and
/// is absent here because it belongs to the variable's own mapping, never to
/// `params`. The comparison is exact decoded text; the list is this module's
/// reading of the ruling, not a schema espanso publishes.
pub(crate) const TYPED_SETTINGS: [&str; 5] =
    ["offset", "trim", "debug", "multiline", "trim_string_values"];

/// Why an author-chosen key is refused, before any document is consulted.
///
/// Carries no text: the key is the owner's configuration (`CLAUDE.md` §1).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AuthorKeyFault {
    /// The key is the empty string.
    Empty,
    /// The key holds a line break: `\n`, `\r`, NEL (U+0085), LINE SEPARATOR
    /// (U+2028) or PARAGRAPH SEPARATOR (U+2029). The last three are line breaks
    /// to a YAML 1.1 reader and are refused with the first two.
    LineBreak,
    /// The key holds any other control character — a tab included — or the
    /// byte-order mark (U+FEFF).
    ControlCharacter,
    /// The key is exactly `<<`, the merge-key spelling. Refused whatever the
    /// spelling the codec would choose: a quoted `'<<'` is not a merge key to a
    /// YAML 1.2 reader, but it is to a YAML 1.1 one, and this project does not
    /// claim which one espanso is.
    MergeKey,
}

/// The first fault of `key`, or `None` when the text may be written as a new
/// author-chosen key.
///
/// The checks run in the order the variants are declared, so a key that is both
/// a line break and a control character is reported as a line break.
pub(crate) fn author_key_fault(key: &str) -> Option<AuthorKeyFault> {
    if key.is_empty() {
        return Some(AuthorKeyFault::Empty);
    }
    if key
        .chars()
        .any(|c| matches!(c, '\n' | '\r' | '\u{85}' | '\u{2028}' | '\u{2029}'))
    {
        return Some(AuthorKeyFault::LineBreak);
    }
    if key.chars().any(|c| c.is_control() || c == '\u{feff}') {
        return Some(AuthorKeyFault::ControlCharacter);
    }
    if key == "<<" {
        return Some(AuthorKeyFault::MergeKey);
    }
    None
} // End of function author_key_fault()

#[cfg(test)]
mod tests {
    use super::{author_key_fault, AuthorKeyFault};

    #[test]
    fn every_fault_is_named_and_ordinary_text_passes() {
        assert_eq!(author_key_fault(""), Some(AuthorKeyFault::Empty));
        for key in [
            "a\nb",
            "a\rb",
            "a\r\nb",
            "a\u{85}b",
            "a\u{2028}b",
            "a\u{2029}b",
        ] {
            assert_eq!(author_key_fault(key), Some(AuthorKeyFault::LineBreak));
        }
        for key in ["a\tb", "\u{0}", "a\u{7f}", "\u{1b}[0m", "\u{feff}a"] {
            assert_eq!(
                author_key_fault(key),
                Some(AuthorKeyFault::ControlCharacter)
            );
        }
        assert_eq!(author_key_fault("<<"), Some(AuthorKeyFault::MergeKey));
        for key in [
            "<", "<<<", " <<", "a", "é", "😀", "a: b", "#x", "- x", "'q'", "~", "yes",
        ] {
            assert_eq!(author_key_fault(key), None, "{key:?} is ordinary text");
        }
    } // End of function every_fault_is_named_and_ordinary_text_passes()
}
