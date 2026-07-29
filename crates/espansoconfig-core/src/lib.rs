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
//!
//! # Phase status
//!
//! Phase 0a implements [`discovery`] and the shared vocabulary types. The
//! remaining modules are deliberate stubs carrying only the types the plan
//! already specifies; their internals land in Phase 0b/0c.

#![deny(missing_docs)]

pub mod discovery;
pub mod emit;
pub mod model;
pub mod patch;
pub mod persist;
pub mod syntax;
pub mod validate;
pub mod watch;

use std::path::PathBuf;

pub use syntax::{ByteSpan, Chomping, ScalarPresentation, ScalarStyle, SyntaxIndex};
pub use watch::ContentRevision;

/// Session-local identity of a loaded document.
///
/// Deliberately opaque and *not* a path: two snapshots of the same path taken
/// across an external modification are different documents as far as the editor
/// is concerned. Node and match identities are derived from this plus a
/// source-node identity, never from an array index (plan section 6.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
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
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
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

/// An in-memory snapshot of one file on disk, with everything needed to write
/// it back byte-identically (plan section 6.2).
///
/// The plan's `model: MatchFileModel` projection field is intentionally absent
/// until Phase 0c: the projection cannot be defined honestly before
/// [`SyntaxIndex`] exists, and a placeholder field would invite code that
/// depends on a shape we have not designed yet.
#[derive(Debug, Clone)]
pub struct SourceDocument {
    /// Session-local identity of this snapshot.
    pub id: DocumentId,
    /// Absolute path this snapshot was read from.
    pub path: PathBuf,
    /// Exact bytes read from disk, BOM excluded (see [`SourceDocument::bom`]).
    pub source: String,
    /// Hash of the disk contents this snapshot is based on.
    pub revision: ContentRevision,
    /// Parser output with source locations.
    pub syntax: SyntaxIndex,
    /// Dominant line ending, preserved on save.
    pub line_ending: LineEnding,
    /// Whether the file on disk started with a UTF-8 BOM.
    pub bom: bool,
}
