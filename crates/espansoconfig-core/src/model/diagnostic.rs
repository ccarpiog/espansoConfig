//! What the projection has to say about a document, as codes and operands.
//!
//! Plan section 9: *"Rust returns error codes and structured data, never
//! user-facing prose."* Nothing in this module is a sentence. A
//! [`DiagnosticCode`] variant names the condition and carries the numbers and
//! enums a translator needs to build the message; the `Display` impls exist for
//! logs and test output, and are never shown to a user.
//!
//! A diagnostic is also **not** a hazard. `crate::syntax::HazardKind` answers
//! "would rewriting these bytes corrupt something?" and gates editing. A
//! diagnostic answers "is this document shaped the way espanso expects?" and
//! gates nothing — a file full of diagnostics still browses, and Phase 1 is
//! read-only anyway.

use std::fmt;

use serde::Serialize;

use crate::model::ValueKind;
use crate::patch::DocumentPath;
use crate::syntax::{ByteSpan, NodeId};

/// One thing the projection noticed about a document.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Diagnostic {
    /// What was noticed.
    pub code: DiagnosticCode,
    /// The bytes it is about, when it is about bytes.
    pub span: Option<ByteSpan>,
    /// The node it is about, when one is identifiable.
    pub node: Option<NodeId>,
    /// The path naming that node, when it has one.
    pub path: Option<DocumentPath>,
}

impl Diagnostic {
    /// A diagnostic about the document as a whole.
    pub fn document(code: DiagnosticCode) -> Diagnostic {
        Diagnostic {
            code,
            span: None,
            node: None,
            path: None,
        }
    }

    /// A diagnostic about one node.
    pub fn at(code: DiagnosticCode, node: NodeId, span: ByteSpan) -> Diagnostic {
        Diagnostic {
            code,
            span: Some(span),
            node: Some(node),
            path: None,
        }
    }

    /// Attaches a path to this diagnostic.
    pub fn with_path(mut self, path: Option<DocumentPath>) -> Diagnostic {
        self.path = path;
        self
    }
}

/// Every condition the projection reports, as a code plus its operands.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum DiagnosticCode {
    /// The YAML substrate rejected the document. The whole projection is empty
    /// and only the raw text is available.
    ParseFailed {
        /// Line number the substrate reported.
        line: usize,
        /// Column number the substrate reported.
        column: usize,
        /// Byte offset into the original document, when it could be converted.
        byte_index: Option<usize>,
    },
    /// The document parsed but the span layer rejected the index — an offset
    /// out of domain, or one of its own invariants. Always a bug in this crate
    /// rather than a property of the file (`PROGRESS.md` R10).
    IndexRejected,
    /// The stream holds no document at all: an empty file, or one holding only
    /// comments.
    NoDocument,
    /// A document of the stream has no root node.
    EmptyDocument {
        /// Zero-based index of the document.
        document_index: usize,
    },
    /// The stream holds more than one document and espanso loads only the
    /// first. One diagnostic per document past the first, each carrying that
    /// document's bytes, so nothing is dropped without being named.
    AdditionalDocumentNotProjected {
        /// Zero-based index of the document that was not projected.
        document_index: usize,
    },
    /// The root of the projected document is not a mapping, so it has no
    /// top-level keys at all.
    RootIsNotAMapping {
        /// What the root actually is.
        found: ValueKind,
    },
    /// A field the projection models exists but holds the wrong shape — a
    /// `trigger` holding a sequence, a `vars` holding a scalar.
    ///
    /// The key is carried as the file's own text rather than as an enum
    /// variant, because the same condition has to be reportable for a key this
    /// crate does not model, and because a key is data the file supplied, not
    /// prose this crate wrote.
    FieldHasUnexpectedShape {
        /// The key, as source text.
        key: String,
        /// What its value is.
        found: ValueKind,
    },
    /// A mapping the projection models holds the same modelled key twice.
    RepeatedKey {
        /// The key text.
        key: String,
    },
    /// A mapping the projection models has a key that is not a scalar, so no
    /// path can name that entry.
    NonScalarKey,
    /// The file's location says one thing about its shape and its content says
    /// another — a `config/*.yml` holding `matches`, or a `match/*.yml` with no
    /// match-file key at all.
    ShapeDisagreesWithLocation {
        /// What the content looks like.
        shape: crate::model::DocumentShape,
    },
    /// A match has none of `trigger`, `triggers` and `regex`.
    MatchHasNoTrigger,
    /// A match has more than one of `trigger`, `triggers` and `regex`. Espanso
    /// expects exactly one.
    MatchHasSeveralTriggerForms {
        /// How many of the three are present.
        count: usize,
    },
    /// A match has none of `replace`, `form`, `markdown`, `html` and
    /// `image_path`.
    MatchHasNoContent,
    /// A match has more than one content field. Espanso expects exactly one.
    MatchHasSeveralContentForms {
        /// How many content fields are present.
        count: usize,
    },
    /// A match is not a mapping — a bare scalar in the `matches` sequence.
    MatchIsNotAMapping {
        /// What the sequence item actually is.
        found: ValueKind,
    },
    /// A variable is not a mapping.
    VariableIsNotAMapping {
        /// What the sequence item actually is.
        found: ValueKind,
    },
    /// A variable has no `name`, so nothing in a template can reference it.
    VariableHasNoName,
    /// A variable has no `type`, so espanso cannot decide how to evaluate it.
    VariableHasNoType,
    /// A scalar's bytes could not be decoded and its raw source slice is shown
    /// instead. Pinned at zero over both corpora.
    ScalarNotDecodable,
    /// A value nests deeper than `crate::model::MAX_VALUE_DEPTH` and was
    /// truncated rather than recursed into.
    ValueTooDeep {
        /// The depth the descent stopped at.
        depth: usize,
    },
    /// A mapping's coverage record does not account for every one of its
    /// entries — the projection modelled an entry it does not have, recorded
    /// one twice, or dropped one.
    ///
    /// **Always a bug in `crate::model`, never a property of the file**, and
    /// pinned at zero over both corpora. It is a diagnostic rather than an
    /// assertion because this module must not panic on any input, and because
    /// an assertion would abort before the corpus sweep's independent
    /// re-derivation of the same union could disagree with it.
    CoverageIsIncomplete,
    /// A mapping key of the document is neither named by the projection nor
    /// inside a span the projection recorded without descending into it.
    ///
    /// The whole-document form of the previous code, and the one that catches
    /// what a per-record check structurally cannot: an entire mapping for which
    /// **no record was ever emitted**. `CoverageIsIncomplete` audits the records
    /// that exist; this audits the document against them. Both are **always a
    /// bug in `crate::model`, never a property of the file**, and both are
    /// pinned at zero over both corpora.
    KeyNotAccountedFor,
    /// A construct the visual editor must refuse to edit sits in this document.
    /// Carried as a diagnostic as well as a hazard so one list answers "what
    /// should the UI show about this file".
    Hazard {
        /// Which hazard.
        kind: crate::syntax::HazardKind,
    },
} // End of enum DiagnosticCode

impl fmt::Display for DiagnosticCode {
    /// A developer rendering, for logs, panics and test output.
    ///
    /// **Never shown to a user.** Every user-visible string is built in the
    /// frontend from the variant name and these operands (plan section 9).
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DiagnosticCode::ParseFailed { line, column, .. } => {
                write!(formatter, "parse failed at line {line} column {column}")
            }
            DiagnosticCode::IndexRejected => formatter.write_str("index rejected"),
            DiagnosticCode::NoDocument => formatter.write_str("no document"),
            DiagnosticCode::EmptyDocument { document_index } => {
                write!(formatter, "document {document_index} is empty")
            }
            DiagnosticCode::AdditionalDocumentNotProjected { document_index } => {
                write!(formatter, "document {document_index} is not projected")
            }
            DiagnosticCode::RootIsNotAMapping { found } => {
                write!(formatter, "root is {found:?}, not a mapping")
            }
            DiagnosticCode::FieldHasUnexpectedShape { key, found } => {
                write!(formatter, "{key:?} is {found:?}")
            }
            DiagnosticCode::RepeatedKey { key } => write!(formatter, "repeated key {key:?}"),
            DiagnosticCode::NonScalarKey => formatter.write_str("non-scalar key"),
            DiagnosticCode::ShapeDisagreesWithLocation { shape } => {
                write!(formatter, "content looks like {shape:?}")
            }
            DiagnosticCode::MatchHasNoTrigger => formatter.write_str("match has no trigger"),
            DiagnosticCode::MatchHasSeveralTriggerForms { count } => {
                write!(formatter, "match has {count} trigger forms")
            }
            DiagnosticCode::MatchHasNoContent => formatter.write_str("match has no content"),
            DiagnosticCode::MatchHasSeveralContentForms { count } => {
                write!(formatter, "match has {count} content forms")
            }
            DiagnosticCode::MatchIsNotAMapping { found } => {
                write!(formatter, "match is {found:?}, not a mapping")
            }
            DiagnosticCode::VariableIsNotAMapping { found } => {
                write!(formatter, "variable is {found:?}, not a mapping")
            }
            DiagnosticCode::VariableHasNoName => formatter.write_str("variable has no name"),
            DiagnosticCode::VariableHasNoType => formatter.write_str("variable has no type"),
            DiagnosticCode::ScalarNotDecodable => formatter.write_str("scalar is not decodable"),
            DiagnosticCode::ValueTooDeep { depth } => {
                write!(formatter, "value nests past depth {depth}")
            }
            DiagnosticCode::CoverageIsIncomplete => {
                formatter.write_str("mapping coverage is incomplete")
            }
            DiagnosticCode::KeyNotAccountedFor => formatter.write_str("key is not accounted for"),
            DiagnosticCode::Hazard { kind } => write!(formatter, "hazard {kind:?}"),
        }
    } // End of function fmt() for DiagnosticCode
}
