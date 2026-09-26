//! The one reference scanner (Phase 4-7).
//!
//! **It reuses [`crate::validate`]'s transcribed `REFERENCE_PATTERN` exactly** —
//! the same compiled constant, reached through the same accessor — so the
//! validator's rule 5, the dependency analysis and any later preview agree by
//! construction on what counts as a `{{reference}}`. A second spelling here
//! would be a second opinion that could disagree with the one the save gate
//! applies.

use crate::syntax::ByteSpan;

/// One `{{reference}}` found in a text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReferenceToken {
    /// The whole `{{ … }}` token, as byte offsets into the scanned text.
    pub span: ByteSpan,
    /// The referenced name — the pattern's `name` group.
    pub name: String,
    /// The `.subname` after it, when present — a form field, for instance.
    pub subname: Option<String>,
}

/// Every reference in `text`, in text order.
///
/// Empty when the transcribed pattern could not be compiled, which is a
/// defect of the constant rather than a property of any text and is pinned by
/// `the_reference_pattern_compiles` in `crate::validate`.
pub fn scan_references(text: &str) -> Vec<ReferenceToken> {
    let Some(pattern) = crate::validate::reference_pattern() else {
        return Vec::new();
    };
    pattern
        .captures_iter(text)
        .filter_map(|capture| {
            let whole = capture.get(0)?;
            let name = capture.name("name")?;
            Some(ReferenceToken {
                span: ByteSpan::new(whole.start(), whole.end()),
                name: name.as_str().to_owned(),
                subname: capture
                    .name("subname")
                    .map(|subname| subname.as_str().to_owned()),
            })
        })
        .collect()
} // End of function scan_references()

#[cfg(test)]
mod tests {
    use super::scan_references;

    /// Names, sub-names and spans, including the spellings the pattern
    /// declines.
    #[test]
    fn the_scanner_reads_what_the_transcribed_pattern_reads() {
        let tokens = scan_references("a {{ x }} b {{f.field}} {{ not-a-name }} {{}}");
        assert_eq!(tokens.len(), 2);
        assert_eq!(tokens[0].name, "x");
        assert_eq!(tokens[0].subname, None);
        assert_eq!(tokens[0].span.start, 2);
        assert_eq!(tokens[0].span.end, 9);
        assert_eq!(tokens[1].name, "f");
        assert_eq!(tokens[1].subname.as_deref(), Some("field"));
    }
}
