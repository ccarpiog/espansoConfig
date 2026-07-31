//! `espansoconfig-core` — the fidelity-preserving espanso configuration engine.
//!
//! This crate is the standalone domain library described in
//! `IMPLEMENTATION_PLAN.md` section 6.1. It has **no tauri dependency** and never
//! will: keeping it standalone is what makes the hard part (byte-exact YAML
//! surgery) testable and fuzzable in isolation.
//!
//! # The central invariant
//!
//! The **file text on disk is the source of truth**. The typed model is a
//! read-only *projection* over it. Every edit is a byte-span replacement, and
//! everything outside the intended span must come out byte-identical.
//!
//! # Module map
//!
//! | Module | Responsibility |
//! |---|---|
//! | [`discovery`] | locate the config dir, enumerate files, classify them |
//! | [`syntax`] | span-aware parse + syntax index |
//! | [`model`] | semantic projection (`MatchView`, …) |
//! | [`patch`] | the edit engine — byte-span surgery |
//! | [`emit`] | scalar style selection + block emitter |
//! | [`validate`] | structural + espanso-semantic validation |
//! | [`persist`] | atomic save transaction, backups |
//! | [`watch`] | debounced fs watching, revision hashing |
//! | [`workspace`] | the session: discovery + the per-revision document cache |
//!
//! # Phase status
//!
//! - **0a** — [`discovery`] and the shared vocabulary types.
//! - **0b** — [`syntax`]: byte-accurate spans, the gap frontier, the trivia
//!   scanner and comment ownership.
//! - **0c-1** — [`emit`]: the scalar codec. Source bytes decode to a logical
//!   value; a logical value encodes back to source bytes, in a style chosen by
//!   plan section 6.3's rules.
//! - **0c-2a** — [`patch::path`]: the structural path resolver. A path such as
//!   `matches[3].replace` is the node identity that survives the reparse every
//!   edit must be verified against.
//! - **0c-2b** — [`patch::edit`]: one scalar value rewritten as a byte-span
//!   replacement, with the hazard gate consulted at the mutation entry point
//!   and the whole candidate reparsed and verified before it exists.
//! - **1a** — [`model`]: the read-only semantic projection the browser renders,
//!   and [`workspace`]: discovery plus a per-[`ContentRevision`] document cache,
//!   shaped like the IPC surface the Tauri commands wrap (plan section 6.4).
//!
//! [`validate`] and [`persist`] are still deliberate stubs carrying only the
//! types the plan already specifies, and [`watch`] holds only
//! [`ContentRevision`].

#![deny(missing_docs)]

pub mod discovery;
pub mod emit;
pub mod model;
pub mod patch;
pub mod persist;
pub mod syntax;
pub mod validate;
pub mod watch;
pub mod workspace;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub use model::DocumentView;
pub use syntax::{
    ByteSpan, Chomping, HeaderIndicatorOrder, Node, NodeId, NodeKind, ScalarPresentation,
    ScalarStyle, SyntaxError, SyntaxIndex, TriviaIndex,
};
pub use watch::ContentRevision;

/// Session-local identity of a **file**, for the life of the process.
///
/// Deliberately opaque and *not* a path, and deliberately **not a position**:
/// `crate::workspace` mints it from a monotonic counter keyed by path, so
/// reopening a directory that gained or lost a file keeps every surviving
/// file's identity and gives the new one a number nobody held. An identity
/// whose file is gone matches nothing and is reported as
/// `crate::workspace::WorkspaceError::UnknownDocument`; it is never inherited.
///
/// It identifies the file, **not the snapshot**. Two reads of one path across
/// an external modification share this identity and differ in their
/// [`ContentRevision`], which is why an identity that has to survive a reparse
/// — `crate::model::MatchId` — carries both. Node and match identities are
/// derived from this plus a revision plus a source-node identity, never from an
/// array index (plan section 6.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct DocumentId(pub u64);

impl DocumentId {
    /// Returns the raw session-local identifier.
    pub fn get(self) -> u64 {
        self.0
    }
}

/// The line terminator a document uses on disk.
///
/// Espanso config files are usually LF, but a file that arrived from Windows
/// may be CRLF and must be written back as CRLF. Mixed files exist in the wild;
/// we record the dominant ending and preserve every line's own bytes verbatim
/// through span surgery, so the mixture survives untouched.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize)]
pub enum LineEnding {
    /// `\n` — the default on macOS and Linux.
    #[default]
    Lf,
    /// `\r\n` — Windows-authored files.
    Crlf,
}

impl LineEnding {
    /// Returns the bytes this line ending is written as.
    pub fn as_str(self) -> &'static str {
        match self {
            LineEnding::Lf => "\n",
            LineEnding::Crlf => "\r\n",
        }
    }

    /// Detects the dominant line ending of `source`.
    ///
    /// A document counts as CRLF when at least one `\r\n` occurs and CRLF
    /// endings are not outnumbered by bare LF endings. An empty or
    /// single-line document defaults to [`LineEnding::Lf`].
    pub fn detect(source: &str) -> LineEnding {
        let crlf = source.matches("\r\n").count();
        if crlf == 0 {
            return LineEnding::Lf;
        }
        let total_lf = source.matches('\n').count();
        let bare_lf = total_lf - crlf;
        if crlf >= bare_lf {
            LineEnding::Crlf
        } else {
            LineEnding::Lf
        }
    } // End of function detect()
}

/// The UTF-8 byte-order mark, which some editors prepend to YAML files.
///
/// Espanso tolerates it, so we must round-trip it exactly: strip it before
/// parsing, record its presence, write it back on save.
pub const UTF8_BOM: &str = "\u{feff}";

/// The outcome of parsing one document, kept so that a file which failed to
/// parse is still a first-class citizen of the session.
///
/// The plan's `SourceDocument` sketch has `syntax: SyntaxIndex`, which can only
/// describe a file that parsed. Phase 1 must show a broken file's raw text and
/// its diagnostic rather than hide the file, so the field is fallible here. The
/// trivia index travels with the syntax index because the two are always built
/// together and the hazard gate needs both.
#[derive(Debug, Clone)]
pub enum ParseOutcome {
    /// The document parsed and both indexes were built.
    Parsed {
        /// Parser output with source locations.
        syntax: SyntaxIndex,
        /// The classified gaps, with comment ownership and hazards applied.
        trivia: TriviaIndex,
    },
    /// The document could not be indexed. Its bytes are still available.
    Failed(SyntaxError),
}

impl ParseOutcome {
    /// The syntax index, or `None` when the parse failed.
    pub fn syntax(&self) -> Option<&SyntaxIndex> {
        match self {
            ParseOutcome::Parsed { syntax, .. } => Some(syntax),
            ParseOutcome::Failed(_) => None,
        }
    }

    /// The trivia index, or `None` when the parse failed.
    pub fn trivia(&self) -> Option<&TriviaIndex> {
        match self {
            ParseOutcome::Parsed { trivia, .. } => Some(trivia),
            ParseOutcome::Failed(_) => None,
        }
    }

    /// The failure, or `None` when the parse succeeded.
    pub fn error(&self) -> Option<&SyntaxError> {
        match self {
            ParseOutcome::Parsed { .. } => None,
            ParseOutcome::Failed(error) => Some(error),
        }
    }

    /// Returns `true` when both indexes are available.
    pub fn is_parsed(&self) -> bool {
        matches!(self, ParseOutcome::Parsed { .. })
    }
} // End of impl ParseOutcome

/// An in-memory snapshot of one file on disk, with everything needed to write
/// it back byte-identically (plan section 6.2).
///
/// Two deliberate departures from the plan's sketch, both recorded in
/// `docs/decisions/1a-notes.md`:
///
/// - `syntax: SyntaxIndex` became [`SourceDocument::parse`], because a document
///   that does not parse still has to be listed, opened and shown as raw text;
/// - the plan's `model: MatchFileModel` field arrived as
///   [`SourceDocument::view`], a [`DocumentView`], and is **always present** —
///   a failed parse yields a view holding the diagnostics and nothing else,
///   never an absent projection the UI has to special-case.
#[derive(Debug, Clone)]
pub struct SourceDocument {
    /// Session-local identity of this snapshot.
    pub id: DocumentId,
    /// Absolute path this snapshot was read from.
    pub path: PathBuf,
    /// Exact bytes read from disk, **BOM included**.
    ///
    /// Every span in [`SourceDocument::parse`] indexes into this string, so a
    /// document that starts with a BOM has its first node span starting at
    /// byte 3 or later. Keeping the BOM here is what lets the whole file be
    /// rebuilt from spans and gaps without a special case.
    pub source: String,
    /// Hash of the disk contents this snapshot is based on.
    pub revision: ContentRevision,
    /// Parser output with source locations, or the failure that replaced it.
    pub parse: ParseOutcome,
    /// The read-only semantic projection the editor renders.
    pub view: DocumentView,
    /// Dominant line ending, preserved on save.
    pub line_ending: LineEnding,
    /// Whether the file on disk started with a UTF-8 BOM.
    pub bom: bool,
}
