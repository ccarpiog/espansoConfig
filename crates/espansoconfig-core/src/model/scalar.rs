//! The one shape every scalar the projection exposes takes.
//!
//! # D2u — source text, never an inferred type
//!
//! [`ScalarView::text`] is a `String` and always will be. There is no `bool`,
//! no `i64` and no untagged value enum anywhere in [`crate::model`], not even
//! for a schema-boolean field such as `word` or `propagate_case`.
//!
//! The reason is `PROGRESS.md` R16's open half: the *projection* of a
//! pre-existing plain scalar is not proven to agree with espanso's YAML 1.1
//! resolver. 31 synthetic and 65 real plain scalars resolve to something other
//! than `str` under 1.1 today, so a UI that renders `enable: on` as a toggle
//! would be making a claim this project has not earned, in the one place a user
//! trusts it most.
//!
//! What **is** permitted, and is what [`ScalarView::ambiguous_yaml_1_1`]
//! carries, is a statement about *risk*: "the two schemas would not agree about
//! this text." That is provable from `crate::emit::tags`, which is the one
//! resolution table in the crate — this module consults it and does not
//! contain a second copy.

use serde::Serialize;

use crate::emit::{decode, plain_scalar_is_ambiguous};
use crate::syntax::{ByteSpan, Node, NodeId, NodeKind, ScalarStyle};

/// One scalar of the source, projected for display.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ScalarView {
    /// The scalar's text.
    ///
    /// Normally `crate::emit::decode()` of the scalar's content span: escapes
    /// resolved, a block scalar de-indented, folded and chomped. **Never a
    /// parsed value** — see the module documentation.
    pub text: String,
    /// `true` when [`ScalarView::text`] is `decode()`'s output.
    ///
    /// `false` means decoding failed — a double-quoted scalar the substrate
    /// accepted and our decoder did not — and `text` holds the raw source slice
    /// of the content span instead, so the user still sees the bytes. A
    /// [`crate::model::DiagnosticCode::ScalarNotDecodable`] is recorded whenever
    /// this is `false`, and the corpus tests pin the count at zero, so the
    /// fallback is a visible layer rather than a silent one.
    pub decoded: bool,
    /// How the scalar is written in the source.
    pub style: ScalarStyle,
    /// The token's byte span in the original document, BOM included.
    pub span: ByteSpan,
    /// The source node this view projects.
    pub node: NodeId,
    /// `true` when this is a **plain** scalar whose text YAML 1.1 and YAML 1.2
    /// core do not agree about, or which 1.1 resolves to something other than a
    /// string.
    ///
    /// A claim about risk, not about meaning: it says espanso may read these
    /// bytes as a boolean, an octal or a sexagesimal where the substrate this
    /// crate reads with sees a string. Always `false` for a quoted or block
    /// scalar, whose text is a string in both schemas by construction.
    pub ambiguous_yaml_1_1: bool,
}

impl ScalarView {
    /// Projects `node` out of `source`, or returns `None` when it is not a
    /// scalar.
    ///
    /// Total: a span that does not slice the source, or a double-quoted body
    /// our decoder rejects, falls back to the raw slice with
    /// [`ScalarView::decoded`] set to `false` rather than failing or panicking.
    pub fn project(source: &str, node: &Node) -> Option<ScalarView> {
        if node.kind != NodeKind::Scalar {
            return None;
        }
        let scalar = node.scalar.as_ref()?;
        let presentation = &scalar.presentation;
        let (text, decoded) = match decode(source, presentation) {
            Ok(text) => (text, true),
            Err(_) => (
                presentation
                    .content_span
                    .slice(source)
                    .unwrap_or_default()
                    .to_owned(),
                false,
            ),
        };
        let ambiguous_yaml_1_1 =
            presentation.style == ScalarStyle::Plain && plain_scalar_is_ambiguous(&text);
        Some(ScalarView {
            text,
            decoded,
            style: presentation.style,
            span: node.span,
            node: node.id,
            ambiguous_yaml_1_1,
        })
    } // End of function project()

    /// Returns `true` when the scalar's text is empty.
    ///
    /// An empty plain scalar is how the substrate reports `key:` with no value
    /// (`PROGRESS.md` R7), so "present but empty" and "absent" are different
    /// facts and the projection keeps them apart.
    pub fn is_empty(&self) -> bool {
        self.text.is_empty()
    }
}
