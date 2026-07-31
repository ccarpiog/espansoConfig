//! Structural paths — the stable, textual identity of a value node.
//!
//! # Why a path rather than a [`NodeId`]
//!
//! A [`NodeId`] identifies a node inside **one** [`SyntaxIndex`]. The patch
//! engine cannot work with that alone, because plan section 6.2 requires it to
//! **reparse the entire candidate document and verify** after every edit: the
//! reparse produces a *different* index, whose arena indices are unrelated to
//! the ones the edit was planned against. What survives a reparse is the
//! document's structure, so the thing that must be quoted back at the new index
//! is a structural path — `matches[3].replace` — and not an identifier.
//!
//! A path is therefore a pure function of the document text, and
//! [`resolve`] / [`path_to`] are exact inverses wherever a node has a path at
//! all. That round trip is the property the whole verify step rests on, and
//! `tests/patch_path.rs` asserts it for **every** addressable node of both
//! corpora.
//!
//! # What a path is not
//!
//! It is not a match identity. Plan section 6.2 forbids identifying a match by
//! its position, because positions shift when entries are reordered, and
//! `matches[3]` shifts with them. [`NodeId`] remains the session-local identity
//! of a match; a path is the *addressing* mechanism used to re-find a node
//! after a reparse, within a single edit-and-verify cycle.
//!
//! # Where the hazard gate is, and is not
//!
//! This module answers exactly one question: **which node does this path
//! name?** It deliberately does *not* ask whether that node may be edited.
//! `TriviaIndex::is_safely_editable` answers that, and the mutation entry point
//! must consult it **itself**, not rely on its callers to have done so. Keeping
//! the two apart is what lets the resolver stay a total function of the text
//! while the gate stays free to be pessimistic.
//!
//! So a path resolves happily into an aliased subtree, a tagged scalar or a
//! merge-key mapping, each of which the gate then refuses on its own hazard
//! (`AliasReference`, `ExplicitTag`, `MergeKey`).
//!
//! **A flow collection is the exception, and it is not covered by the gate.**
//! `HazardKind` has no general flow-collection variant — only
//! `CommentInFlowCollection` — so `matches: [{trigger: ":a", replace: old}]` both
//! resolves *and* passes `is_safely_editable`. That is deliberate on the gate's
//! side (D2d only ever promised to refuse a flow collection holding a comment),
//! but it means **flow context is a live constraint the edit engine must carry
//! itself**: a block scalar is illegal inside `{…}`/`[…]`, so an edit that turns
//! a short value into a multi-line one cannot simply hand the job to
//! `choose_scalar` and hope. Step 0c-2b either refuses edits inside a flow
//! collection outright or renders flow-legal bytes; it may not assume the gate
//! has already said no. Recorded as `PROGRESS.md` R17.
//!
//! There is one unavoidable exception. A **duplicate key** does not make a node
//! unsafe to edit, it makes the path *meaningless*: `matches[0].replace` names
//! two different nodes in `duplicate-keys.yml`. Resolution has no single answer
//! to give, so it refuses with [`PathError::DuplicateKey`] and [`path_to`]
//! refuses symmetrically with [`AddressError::AmbiguousKey`].
//!
//! # Documents
//!
//! A path is **document-scoped, not stream-scoped**: it is rooted at one
//! document of a possibly multi-document stream, named by its zero-based index.
//! Espanso itself loads only the first document, but a file may legitimately
//! hold several (`tests/corpus/synthetic/multi-document.yml`), and a path that
//! could not say which one it meant would silently address the wrong file half.
//! The textual form spells a non-zero document as a leading `#N`, and omits it
//! for document 0 — see [`DocumentPath`]'s `Display`.

use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

use crate::syntax::{Node, NodeId, NodeKind, NodeRole, SyntaxIndex};

/// One step of a [`DocumentPath`].
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PathSegment {
    /// Descend into a mapping by key — the `replace` of `matches[0].replace`.
    ///
    /// The key is the **decoded** scalar value of the mapping key, so a source
    /// `replace:`, `'replace':` and `"replace":` are all named by this same
    /// segment. A key that is not a scalar at all — an alias, or a collection
    /// used as a key — can never be named by a segment and is never matched.
    Key(String),
    /// Descend into a sequence by position — the `0` of `matches[0]`.
    Index(usize),
}

impl PathSegment {
    /// Builds a key segment.
    pub fn key(key: impl Into<String>) -> PathSegment {
        PathSegment::Key(key.into())
    }

    /// Returns the key this segment names, or `None` for an index segment.
    pub fn as_key(&self) -> Option<&str> {
        match self {
            PathSegment::Key(key) => Some(key),
            PathSegment::Index(_) => None,
        }
    }

    /// Returns the position this segment names, or `None` for a key segment.
    pub fn as_index(&self) -> Option<usize> {
        match self {
            PathSegment::Key(_) => None,
            PathSegment::Index(index) => Some(*index),
        }
    }
}

/// A structural path rooted at one document of a stream.
///
/// The structured form is primary: it holds a document index plus an ordered
/// list of [`PathSegment`]s, and carries no text at all. The textual form
/// (`Display` and [`FromStr`]) is an **exact serialization**, for tests and for
/// carrying a path across the IPC boundary.
///
/// It is exact rather than legible, and the two goals conflict: a YAML key may
/// hold a NUL, a line break or a `\u{feff}`, and `Display` emits every such
/// character **verbatim** so that [`FromStr`] returns it unchanged. A path is
/// therefore not automatically safe to drop into a line-oriented log — render it
/// with `str::escape_debug` when that matters. Escaping inside the format itself
/// was rejected: it would buy legibility by putting an unescaping step between
/// the two halves of the round trip this type exists to guarantee.
///
/// # Textual form
///
/// | Path | Meaning |
/// |---|---|
/// | `matches[3].replace` | document 0, key `matches`, item 3, key `replace` |
/// | `[0].trigger` | document 0 whose root is a sequence, item 0, key `trigger` |
/// | `#0` | the root node of document 0 |
/// | `#2.matches[0]` | document 2, key `matches`, item 0 |
///
/// A key is written bare when it contains none of `.`, `[`, `]`, `'`, `#` and
/// no whitespace, and is not empty. Otherwise it is written in single quotes
/// with an embedded `'` doubled, exactly YAML's own single-quote convention:
/// `'a.b'`, `'don''t'`, `''`.
///
/// `Display` is canonical and `parse(display(path)) == path` always holds,
/// awkward keys included. The reverse is not guaranteed: parsing accepts the
/// redundant `#0.` prefix and quotes around keys that need none, and `Display`
/// normalises both away.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DocumentPath {
    document_index: usize,
    segments: Vec<PathSegment>,
}

impl DocumentPath {
    /// The path that names the root node of document `document_index`.
    pub fn root(document_index: usize) -> DocumentPath {
        DocumentPath {
            document_index,
            segments: Vec::new(),
        }
    }

    /// Builds a path from a document index and its segments.
    pub fn new(document_index: usize, segments: Vec<PathSegment>) -> DocumentPath {
        DocumentPath {
            document_index,
            segments,
        }
    }

    /// The zero-based index of the document this path is rooted at.
    pub fn document_index(&self) -> usize {
        self.document_index
    }

    /// The path's segments, outermost first.
    pub fn segments(&self) -> &[PathSegment] {
        &self.segments
    }

    /// Returns `true` when the path names a document's root node.
    pub fn is_root(&self) -> bool {
        self.segments.is_empty()
    }

    /// Appends a key segment, consuming and returning the path.
    pub fn with_key(mut self, key: impl Into<String>) -> DocumentPath {
        self.segments.push(PathSegment::Key(key.into()));
        self
    }

    /// Appends an index segment, consuming and returning the path.
    pub fn with_index(mut self, index: usize) -> DocumentPath {
        self.segments.push(PathSegment::Index(index));
        self
    }

    /// Parses the textual form, e.g. `matches[3].replace`.
    ///
    /// This is what [`FromStr`] calls; it exists as an inherent method so
    /// callers do not have to name the target type.
    pub fn parse(text: &str) -> Result<DocumentPath, PathParseError> {
        parse_path(text)
    }
}

impl fmt::Display for DocumentPath {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        // The `#0` prefix is redundant for document 0, except for the root
        // path, which would otherwise render as the empty string and parse back
        // as a parse error rather than as itself.
        if self.document_index != 0 || self.segments.is_empty() {
            write!(formatter, "#{}", self.document_index)?;
        }

        for (position, segment) in self.segments.iter().enumerate() {
            match segment {
                PathSegment::Key(key) => {
                    // A key needs a separator unless it opens a document-0 path.
                    if position > 0 || self.document_index != 0 {
                        formatter.write_str(".")?;
                    }
                    write_key(formatter, key)?;
                }
                PathSegment::Index(index) => write!(formatter, "[{index}]")?,
            }
        }
        Ok(())
    } // End of function fmt() for DocumentPath
}

impl FromStr for DocumentPath {
    type Err = PathParseError;

    fn from_str(text: &str) -> Result<DocumentPath, PathParseError> {
        parse_path(text)
    }
}

/// Characters that force a key into its quoted form.
///
/// `.`, `[` and `]` are the path grammar's own punctuation; `'` opens a quoted
/// key; `#` opens a document prefix at the head of a path. Whitespace is quoted
/// too — not because the parser needs it, but because an unquoted trailing space
/// is invisible in a log line.
const KEY_MUST_QUOTE: [char; 5] = ['.', '[', ']', '\'', '#'];

/// Writes a key segment in its bare form when possible, quoted otherwise.
fn write_key(formatter: &mut fmt::Formatter<'_>, key: &str) -> fmt::Result {
    let bare = !key.is_empty()
        && !key
            .chars()
            .any(|character| KEY_MUST_QUOTE.contains(&character) || character.is_whitespace());
    if bare {
        return formatter.write_str(key);
    }
    formatter.write_str("'")?;
    for character in key.chars() {
        if character == '\'' {
            formatter.write_str("''")?;
        } else {
            write!(formatter, "{character}")?;
        }
    }
    formatter.write_str("'")
} // End of function write_key()

/// Why a textual path could not be parsed.
///
/// These are **diagnostics, not user-facing prose** — every string a user reads
/// goes through the frontend i18n layer (plan section 9). Each `at` is a byte
/// offset into the text that was parsed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PathParseError {
    /// The text was empty. The root path is spelled `#0`, never `""`.
    Empty,
    /// A `#` document prefix was not followed by at least one decimal digit.
    MalformedDocumentPrefix {
        /// Byte offset of the `#`.
        at: usize,
    },
    /// A document index did not fit in a `usize`.
    DocumentIndexOverflow {
        /// Byte offset of the `#`.
        at: usize,
    },
    /// A `.` separator was not followed by a key segment.
    ExpectedKey {
        /// Byte offset just past the separator.
        at: usize,
    },
    /// A bare key contained a character that only the quoted form may hold.
    ReservedCharacterInBareKey {
        /// The offending character.
        character: char,
        /// Its byte offset.
        at: usize,
    },
    /// A quoted key ran to the end of the text without a closing `'`.
    UnterminatedQuotedKey {
        /// Byte offset of the opening `'`.
        at: usize,
    },
    /// A `[` index segment was not closed by a `]`.
    UnterminatedIndex {
        /// Byte offset of the `[`.
        at: usize,
    },
    /// An index segment held something other than decimal digits, or nothing.
    MalformedIndex {
        /// Byte offset of the `[`.
        at: usize,
    },
    /// An index did not fit in a `usize`.
    IndexOverflow {
        /// Byte offset of the `[`.
        at: usize,
    },
    /// A segment was followed by a character that cannot continue a path.
    UnexpectedCharacter {
        /// The offending character.
        character: char,
        /// Its byte offset.
        at: usize,
    },
}

impl fmt::Display for PathParseError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PathParseError::Empty => formatter.write_str("empty path; the root is spelled `#0`"),
            PathParseError::MalformedDocumentPrefix { at } => {
                write!(formatter, "malformed document prefix at byte {at}")
            }
            PathParseError::DocumentIndexOverflow { at } => {
                write!(formatter, "document index at byte {at} is too large")
            }
            PathParseError::ExpectedKey { at } => {
                write!(formatter, "expected a key at byte {at}")
            }
            PathParseError::ReservedCharacterInBareKey { character, at } => write!(
                formatter,
                "reserved character {character:?} in a bare key at byte {at}; quote the key"
            ),
            PathParseError::UnterminatedQuotedKey { at } => {
                write!(formatter, "unterminated quoted key opened at byte {at}")
            }
            PathParseError::UnterminatedIndex { at } => {
                write!(formatter, "unterminated index opened at byte {at}")
            }
            PathParseError::MalformedIndex { at } => {
                write!(formatter, "malformed index at byte {at}")
            }
            PathParseError::IndexOverflow { at } => {
                write!(formatter, "index at byte {at} is too large")
            }
            PathParseError::UnexpectedCharacter { character, at } => {
                write!(formatter, "unexpected character {character:?} at byte {at}")
            }
        }
    } // End of function fmt() for PathParseError
}

impl std::error::Error for PathParseError {}

/// Parses the textual path form into its structured representation.
///
/// The grammar, with `digit` decimal and `key` either bare or single-quoted:
///
/// ```text
/// path     := [ '#' digit+ ] [ '.' ] tail
/// tail     := ( key | index ) ( '.' key | index )*   (* possibly empty *)
/// index    := '[' digit+ ']'
/// ```
fn parse_path(text: &str) -> Result<DocumentPath, PathParseError> {
    if text.is_empty() {
        return Err(PathParseError::Empty);
    }

    let bytes = text.as_bytes();
    let mut cursor = 0usize;
    let mut document_index = 0usize;

    if bytes[0] == b'#' {
        let digits_start = 1;
        let mut end = digits_start;
        while end < bytes.len() && bytes[end].is_ascii_digit() {
            end += 1;
        }
        if end == digits_start {
            return Err(PathParseError::MalformedDocumentPrefix { at: 0 });
        }
        document_index = text[digits_start..end]
            .parse::<usize>()
            .map_err(|_| PathParseError::DocumentIndexOverflow { at: 0 })?;
        cursor = end;
        // A `.` here separates the prefix from the first key; `[` needs none.
        if cursor < bytes.len() && bytes[cursor] == b'.' {
            cursor += 1;
            if cursor == bytes.len() {
                return Err(PathParseError::ExpectedKey { at: cursor });
            }
        }
    }

    let mut segments = Vec::new();
    let mut expect_separator = false;

    while cursor < bytes.len() {
        match bytes[cursor] {
            b'[' => {
                let (index, next) = parse_index(text, cursor)?;
                segments.push(PathSegment::Index(index));
                cursor = next;
            }
            b'.' => {
                cursor += 1;
                if cursor == bytes.len() {
                    return Err(PathParseError::ExpectedKey { at: cursor });
                }
                if bytes[cursor] == b'[' {
                    return Err(PathParseError::ExpectedKey { at: cursor });
                }
                let (key, next) = parse_key(text, cursor)?;
                segments.push(PathSegment::Key(key));
                cursor = next;
            }
            _ => {
                if expect_separator {
                    let character = text[cursor..].chars().next().unwrap_or('\0');
                    return Err(PathParseError::UnexpectedCharacter {
                        character,
                        at: cursor,
                    });
                }
                let (key, next) = parse_key(text, cursor)?;
                segments.push(PathSegment::Key(key));
                cursor = next;
            }
        }
        // Only the *first* key of a path needs no separator before it. After any
        // segment the next character must be `.`, `[`, or the end of the text,
        // so `'a'b` and `a[0]b` are errors rather than silent concatenations.
        expect_separator = true;
    } // End of the loop over the path's segments

    Ok(DocumentPath {
        document_index,
        segments,
    })
} // End of function parse_path()

/// Parses a `[123]` index segment starting at `open`, returning it and the byte
/// offset just past the `]`.
fn parse_index(text: &str, open: usize) -> Result<(usize, usize), PathParseError> {
    let bytes = text.as_bytes();
    let digits_start = open + 1;
    let mut end = digits_start;
    while end < bytes.len() && bytes[end].is_ascii_digit() {
        end += 1;
    }
    if end == digits_start {
        return Err(PathParseError::MalformedIndex { at: open });
    }
    if end == bytes.len() || bytes[end] != b']' {
        return Err(PathParseError::UnterminatedIndex { at: open });
    }
    let index = text[digits_start..end]
        .parse::<usize>()
        .map_err(|_| PathParseError::IndexOverflow { at: open })?;
    Ok((index, end + 1))
} // End of function parse_index()

/// Parses a key segment starting at `start`, returning it and the byte offset
/// just past it.
///
/// A leading `'` selects the quoted form, in which `''` denotes one `'`.
/// Otherwise the key runs to the next `.` or `[`, and may not contain any other
/// reserved character.
fn parse_key(text: &str, start: usize) -> Result<(String, usize), PathParseError> {
    let bytes = text.as_bytes();
    if bytes[start] == b'\'' {
        return parse_quoted_key(text, start);
    }

    let mut key = String::new();
    let mut cursor = start;
    while cursor < bytes.len() {
        let character = text[cursor..].chars().next().unwrap_or('\0');
        if character == '.' || character == '[' {
            break;
        }
        if KEY_MUST_QUOTE.contains(&character) {
            return Err(PathParseError::ReservedCharacterInBareKey {
                character,
                at: cursor,
            });
        }
        key.push(character);
        cursor += character.len_utf8();
    } // End of the loop over a bare key's characters

    if key.is_empty() {
        return Err(PathParseError::ExpectedKey { at: start });
    }
    Ok((key, cursor))
} // End of function parse_key()

/// Parses a `'quoted key'` starting at its opening quote.
fn parse_quoted_key(text: &str, open: usize) -> Result<(String, usize), PathParseError> {
    let bytes = text.as_bytes();
    let mut key = String::new();
    let mut cursor = open + 1;
    while cursor < bytes.len() {
        let character = text[cursor..].chars().next().unwrap_or('\0');
        cursor += character.len_utf8();
        if character != '\'' {
            key.push(character);
            continue;
        }
        // A doubled quote is a literal one; a lone quote closes the key.
        if cursor < bytes.len() && bytes[cursor] == b'\'' {
            key.push('\'');
            cursor += 1;
            continue;
        }
        return Ok((key, cursor));
    } // End of the loop over a quoted key's characters
    Err(PathParseError::UnterminatedQuotedKey { at: open })
} // End of function parse_quoted_key()

/// Why a path could not be resolved against a [`SyntaxIndex`].
///
/// Every variant carries the position of the offending segment and the node the
/// walk had reached, so a caller can report *where* the path stopped matching
/// rather than only that it did.
///
/// Resolution never panics, for any path against any document.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PathError {
    /// The stream has no document with that index.
    NoSuchDocument {
        /// The index the path asked for.
        document_index: usize,
        /// How many documents the stream actually holds.
        documents: usize,
    },
    /// The document exists but holds no root node, so nothing is addressable.
    ///
    /// Reachable from a stream whose document is a bare `---` with no content.
    EmptyDocument {
        /// The document the path is rooted at.
        document_index: usize,
    },
    /// No mapping key in the target mapping decodes to this key.
    NoSuchKey {
        /// The key that was looked for.
        key: String,
        /// Position of the offending segment, zero-based.
        segment: usize,
        /// The mapping that was searched.
        node: NodeId,
    },
    /// The key occurs more than once, so the path names more than one node.
    ///
    /// This is the resolver's one concession to semantics: a duplicate key does
    /// not make a node unsafe to edit, it makes the *path ambiguous*, and there
    /// is no answer to return. See the module documentation.
    DuplicateKey {
        /// The duplicated key.
        key: String,
        /// How many mapping entries carry it.
        occurrences: usize,
        /// Position of the offending segment, zero-based.
        segment: usize,
        /// The mapping that was searched.
        node: NodeId,
    },
    /// A key segment was applied to something that is not a mapping.
    KeyIntoNonMapping {
        /// The key that was looked for.
        key: String,
        /// Position of the offending segment, zero-based.
        segment: usize,
        /// The node the walk had reached.
        node: NodeId,
        /// What that node actually is.
        kind: NodeKind,
    },
    /// An index segment was applied to something that is not a sequence.
    IndexIntoNonSequence {
        /// The position that was looked for.
        index: usize,
        /// Position of the offending segment, zero-based.
        segment: usize,
        /// The node the walk had reached.
        node: NodeId,
        /// What that node actually is.
        kind: NodeKind,
    },
    /// The sequence has fewer items than the index asked for.
    IndexOutOfRange {
        /// The position that was looked for.
        index: usize,
        /// How many items the sequence holds.
        len: usize,
        /// Position of the offending segment, zero-based.
        segment: usize,
        /// The sequence that was searched.
        node: NodeId,
    },
    /// [`resolve_key`] was asked for the key of a path that has none.
    ///
    /// A root path and a path ending in an index segment are both introduced by
    /// no mapping key.
    NoKeySegment,
    /// The index's own tree is malformed. Always a bug in this crate.
    MalformedIndex {
        /// The node whose links could not be followed.
        node: NodeId,
    },
}

impl fmt::Display for PathError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PathError::NoSuchDocument {
                document_index,
                documents,
            } => write!(
                formatter,
                "no document {document_index}; the stream holds {documents}"
            ),
            PathError::EmptyDocument { document_index } => {
                write!(formatter, "document {document_index} has no root node")
            }
            PathError::NoSuchKey { key, segment, .. } => {
                write!(formatter, "no key {key:?} at segment {segment}")
            }
            PathError::DuplicateKey {
                key,
                occurrences,
                segment,
                ..
            } => write!(
                formatter,
                "key {key:?} at segment {segment} occurs {occurrences} times; the path is ambiguous"
            ),
            PathError::KeyIntoNonMapping {
                key, segment, kind, ..
            } => write!(
                formatter,
                "key {key:?} at segment {segment} applied to a {kind:?}, not a mapping"
            ),
            PathError::IndexIntoNonSequence {
                index,
                segment,
                kind,
                ..
            } => write!(
                formatter,
                "index {index} at segment {segment} applied to a {kind:?}, not a sequence"
            ),
            PathError::IndexOutOfRange {
                index,
                len,
                segment,
                ..
            } => write!(
                formatter,
                "index {index} at segment {segment} is out of range; the sequence holds {len}"
            ),
            PathError::NoKeySegment => {
                formatter.write_str("the path is not introduced by a mapping key")
            }
            PathError::MalformedIndex { node } => {
                write!(formatter, "malformed syntax index at node {}", node.get())
            }
        }
    } // End of function fmt() for PathError
}

impl std::error::Error for PathError {}

/// Everything one path resolution found.
///
/// [`resolve`] and [`resolve_key`] are thin wrappers over this; the struct
/// exists because a structural edit needs more than the value node. Removing a
/// field needs the **key** node too (its span is where the entry begins), and
/// inserting a sibling needs the **parent** collection.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Resolved {
    /// The node the path names — for a key segment the *value* node, never the
    /// key and never a `MappingValue` wrapper (the index has no such wrapper:
    /// the value node itself carries [`NodeRole::MappingValue`]).
    pub value: NodeId,
    /// The mapping key that introduces [`Resolved::value`].
    ///
    /// `None` for a root path and for a path whose last segment is an index,
    /// because a sequence item is introduced by a `-`, not by a key.
    pub key: Option<NodeId>,
    /// The collection that contains [`Resolved::value`], or `None` for a root
    /// path, whose value is the document root and whose parent is the document.
    pub parent: Option<NodeId>,
}

/// Resolves `path` against `index` to the node it names.
///
/// This is [`Resolved::value`]; use [`resolve_full`] when the key or the parent
/// is needed as well.
pub fn resolve(index: &SyntaxIndex, path: &DocumentPath) -> Result<NodeId, PathError> {
    resolve_full(index, path).map(|resolved| resolved.value)
}

/// Resolves `path` and returns the **mapping key node** that introduces it.
///
/// Fails with [`PathError::NoKeySegment`] when the path is a root path or ends
/// in an index segment.
///
/// # A key is not verifiable by the path that found it
///
/// The reparse-verify cycle re-resolves the *same* path against the new index.
/// That works for a value, because editing a value cannot change how it is
/// addressed. It does **not** work for a key: renaming the `replace` of
/// `replace: old` to `replacement` makes the path `replace` resolve to
/// [`PathError::NoSuchKey`] in the reparsed document, so the verification fails
/// on a correct edit.
///
/// Therefore a scalar edit targets [`Resolved::value`] only. This function
/// exists for the *spans* a structural edit needs — where a mapping entry begins,
/// so removing it can take its key with it — and a future key-rename operation
/// needs its own protocol, verifying against the **intended new** path rather
/// than the old one. Editing an ordinary value that merely happens to equal some
/// other entry's key is harmless; only editing a node in key position is not.
pub fn resolve_key(index: &SyntaxIndex, path: &DocumentPath) -> Result<NodeId, PathError> {
    resolve_full(index, path)?
        .key
        .ok_or(PathError::NoKeySegment)
}

/// Resolves `path` against `index`, reporting the value, its key and its parent.
///
/// The walk starts at the root node of the path's document and applies one
/// segment at a time. A key segment scans the mapping's children in source
/// order, comparing each key's **decoded** value; a non-scalar key never
/// matches. An index segment indexes the sequence's children directly.
pub fn resolve_full(index: &SyntaxIndex, path: &DocumentPath) -> Result<Resolved, PathError> {
    let documents = index.documents();
    let document_id = *documents
        .get(path.document_index())
        .ok_or(PathError::NoSuchDocument {
            document_index: path.document_index(),
            documents: documents.len(),
        })?;
    let document = index
        .node(document_id)
        .ok_or(PathError::MalformedIndex { node: document_id })?;
    let root = *document.children.first().ok_or(PathError::EmptyDocument {
        document_index: path.document_index(),
    })?;

    let mut resolved = Resolved {
        value: root,
        key: None,
        parent: None,
    };

    for (segment, step) in path.segments().iter().enumerate() {
        let current = index
            .node(resolved.value)
            .ok_or(PathError::MalformedIndex {
                node: resolved.value,
            })?;
        resolved = match step {
            PathSegment::Key(key) => step_into_key(index, current, key, segment)?,
            PathSegment::Index(position) => step_into_index(current, *position, segment)?,
        };
    } // End of the loop over the path's segments

    Ok(resolved)
} // End of function resolve_full()

/// Applies one key segment to `mapping`.
fn step_into_key(
    index: &SyntaxIndex,
    mapping: &Node,
    key: &str,
    segment: usize,
) -> Result<Resolved, PathError> {
    if mapping.kind != NodeKind::Mapping {
        return Err(PathError::KeyIntoNonMapping {
            key: key.to_owned(),
            segment,
            node: mapping.id,
            kind: mapping.kind,
        });
    }

    let mut found = None;
    let mut occurrences = 0usize;
    // A mapping's children are the flat alternating key/value sequence the
    // substrate emits. An odd trailing child cannot occur from a successful
    // parse — an entry with no value gets a zero-width scalar — but skipping it
    // is what keeps this a total function rather than a panic.
    for pair in mapping.children.chunks(2) {
        let (Some(&key_id), Some(&value_id)) = (pair.first(), pair.get(1)) else {
            continue;
        };
        if decoded_key(index, key_id) != Some(key) {
            continue;
        }
        occurrences += 1;
        if found.is_none() {
            found = Some((key_id, value_id));
        }
    } // End of the loop over the mapping's key/value pairs

    if occurrences > 1 {
        return Err(PathError::DuplicateKey {
            key: key.to_owned(),
            occurrences,
            segment,
            node: mapping.id,
        });
    }
    let Some((key_id, value_id)) = found else {
        return Err(PathError::NoSuchKey {
            key: key.to_owned(),
            segment,
            node: mapping.id,
        });
    };
    Ok(Resolved {
        value: value_id,
        key: Some(key_id),
        parent: Some(mapping.id),
    })
} // End of function step_into_key()

/// Applies one index segment to `sequence`.
fn step_into_index(sequence: &Node, index: usize, segment: usize) -> Result<Resolved, PathError> {
    if sequence.kind != NodeKind::Sequence {
        return Err(PathError::IndexIntoNonSequence {
            index,
            segment,
            node: sequence.id,
            kind: sequence.kind,
        });
    }
    let Some(&item) = sequence.children.get(index) else {
        return Err(PathError::IndexOutOfRange {
            index,
            len: sequence.children.len(),
            segment,
            node: sequence.id,
        });
    };
    Ok(Resolved {
        value: item,
        key: None,
        parent: Some(sequence.id),
    })
} // End of function step_into_index()

/// The decoded value of a mapping key, or `None` when the key is not a scalar.
///
/// A non-scalar key — an alias, or a collection used as a key — can never be
/// named by a [`PathSegment::Key`], so it is reported as unmatchable rather than
/// approximated from its source text. This is `PROGRESS.md` R13 seen from the
/// resolver's side: such a key always sits inside a construct the hazard gate
/// already refuses.
fn decoded_key(index: &SyntaxIndex, key: NodeId) -> Option<&str> {
    let node = index.node(key)?;
    if node.kind != NodeKind::Scalar {
        return None;
    }
    Some(node.scalar.as_ref()?.value.as_str())
}

/// Why a node has no path that names it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AddressError {
    /// The identifier does not belong to this index.
    UnknownNode {
        /// The identifier that was asked about.
        node: NodeId,
    },
    /// The node is a whole document. Documents are named by a path's document
    /// index, not by a path, and their root node has the root path.
    IsDocument {
        /// The document node.
        node: NodeId,
    },
    /// The node is a mapping key, or is inside one.
    ///
    /// A path names values. The key that introduces a value is reachable
    /// through [`resolve_key`] instead.
    IsMappingKey {
        /// The key node that ended the walk.
        node: NodeId,
    },
    /// An ancestor is introduced by a key that its mapping holds more than
    /// once, so no path can name this node unambiguously.
    ///
    /// The symmetric counterpart of [`PathError::DuplicateKey`]: this is what
    /// keeps `resolve(path_to(n)) == n` an honest property rather than one that
    /// holds only where duplicates happen not to occur.
    AmbiguousKey {
        /// The duplicated key.
        key: String,
        /// How many mapping entries carry it.
        occurrences: usize,
        /// The value node the duplicated key introduces.
        node: NodeId,
    },
    /// An ancestor is introduced by a key that is not a scalar, and therefore
    /// cannot be spelled as a path segment.
    NonScalarKey {
        /// The key node that cannot be spelled.
        key: NodeId,
        /// The value node it introduces.
        node: NodeId,
    },
    /// The index's own tree is malformed. Always a bug in this crate.
    MalformedIndex {
        /// The node whose links could not be followed.
        node: NodeId,
    },
}

impl fmt::Display for AddressError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AddressError::UnknownNode { node } => {
                write!(formatter, "node {} is not in this index", node.get())
            }
            AddressError::IsDocument { node } => {
                write!(formatter, "node {} is a document", node.get())
            }
            AddressError::IsMappingKey { node } => {
                write!(formatter, "node {} is a mapping key", node.get())
            }
            AddressError::AmbiguousKey {
                key, occurrences, ..
            } => write!(
                formatter,
                "key {key:?} occurs {occurrences} times; no path names this node"
            ),
            AddressError::NonScalarKey { key, .. } => {
                write!(formatter, "key node {} is not a scalar", key.get())
            }
            AddressError::MalformedIndex { node } => {
                write!(formatter, "malformed syntax index at node {}", node.get())
            }
        }
    } // End of function fmt() for AddressError
}

impl std::error::Error for AddressError {}

/// Produces the path that resolves back to `node`, or says why none exists.
///
/// This is [`resolve`]'s inverse, and the pair is what makes the patch engine's
/// verify step possible: an edit is planned against one index, applied, and then
/// checked by re-resolving the same path against a **freshly parsed** index.
///
/// The walk climbs from `node` to its document, prepending one segment per step:
/// a [`NodeRole::MappingValue`] contributes the decoded key immediately before
/// it in its parent's children, and a [`NodeRole::SequenceItem`] contributes its
/// position among them.
///
/// Nodes inside a **flow** collection are addressed exactly like block ones —
/// `vars[0].name` names the `name` of `vars: [{name: choice}]`. Whether that
/// node may be *edited* is a separate question, and `is_safely_editable`
/// answers it; see the module documentation.
pub fn path_to(index: &SyntaxIndex, node: NodeId) -> Result<DocumentPath, AddressError> {
    let start = index.node(node).ok_or(AddressError::UnknownNode { node })?;
    if start.kind == NodeKind::Document {
        return Err(AddressError::IsDocument { node });
    }

    let mut segments = Vec::new();
    let mut current = start;

    loop {
        match current.role {
            NodeRole::DocumentRoot => break,
            NodeRole::Document => return Err(AddressError::IsDocument { node: current.id }),
            NodeRole::MappingKey => return Err(AddressError::IsMappingKey { node: current.id }),
            NodeRole::MappingValue => {
                let parent = parent_of(index, current)?;
                let position = child_position(parent, current.id)?;
                let key_id = position
                    .checked_sub(1)
                    .and_then(|before| parent.children.get(before).copied())
                    .ok_or(AddressError::MalformedIndex { node: current.id })?;
                let key = decoded_key(index, key_id).ok_or(AddressError::NonScalarKey {
                    key: key_id,
                    node: current.id,
                })?;
                let occurrences = key_occurrences(index, parent, key);
                if occurrences > 1 {
                    return Err(AddressError::AmbiguousKey {
                        key: key.to_owned(),
                        occurrences,
                        node: current.id,
                    });
                }
                segments.push(PathSegment::Key(key.to_owned()));
                current = parent;
            }
            NodeRole::SequenceItem => {
                let parent = parent_of(index, current)?;
                let position = child_position(parent, current.id)?;
                segments.push(PathSegment::Index(position));
                current = parent;
            }
        }
    } // End of the loop that climbs from the node to its document root

    segments.reverse();
    Ok(DocumentPath::new(current.document_index, segments))
} // End of function path_to()

/// The parent of `node`, or a malformed-index error when it has none.
fn parent_of<'index>(
    index: &'index SyntaxIndex,
    node: &Node,
) -> Result<&'index Node, AddressError> {
    let parent = node
        .parent
        .ok_or(AddressError::MalformedIndex { node: node.id })?;
    index
        .node(parent)
        .ok_or(AddressError::MalformedIndex { node: node.id })
}

/// The position of `child` among `parent`'s children.
fn child_position(parent: &Node, child: NodeId) -> Result<usize, AddressError> {
    parent
        .children
        .iter()
        .position(|candidate| *candidate == child)
        .ok_or(AddressError::MalformedIndex { node: child })
}

/// How many of `mapping`'s entries have a key decoding to `key`.
fn key_occurrences(index: &SyntaxIndex, mapping: &Node, key: &str) -> usize {
    mapping
        .children
        .chunks(2)
        .filter(|pair| pair.len() == 2 && decoded_key(index, pair[0]) == Some(key))
        .count()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Parses a source that must be valid, for brevity in the tests below.
    fn index_of(source: &str) -> SyntaxIndex {
        SyntaxIndex::parse(source).expect("fixture must parse")
    }

    /// The decoded value of the scalar a path names.
    fn value_at(index: &SyntaxIndex, source_path: &str) -> String {
        let path = DocumentPath::parse(source_path).expect("path must parse");
        let id = resolve(index, &path).expect("path must resolve");
        index
            .node(id)
            .and_then(|node| node.scalar.as_ref())
            .map(|scalar| scalar.value.clone())
            .expect("path must name a scalar")
    }

    #[test]
    fn a_path_names_the_value_node_not_the_key() {
        let index = index_of("matches:\n  - trigger: :hi\n    replace: hello\n");
        let path = DocumentPath::parse("matches[0].replace").unwrap();
        let resolved = resolve_full(&index, &path).unwrap();

        let value = index.node(resolved.value).unwrap();
        assert_eq!(value.kind, NodeKind::Scalar);
        assert_eq!(value.role, NodeRole::MappingValue);
        assert_eq!(value.scalar.as_ref().unwrap().value, "hello");

        let key = index.node(resolved.key.unwrap()).unwrap();
        assert_eq!(key.role, NodeRole::MappingKey);
        assert_eq!(key.scalar.as_ref().unwrap().value, "replace");

        assert_eq!(
            index.node(resolved.parent.unwrap()).unwrap().kind,
            NodeKind::Mapping
        );
    }

    #[test]
    fn the_root_path_names_the_document_root() {
        let index = index_of("matches:\n  - trigger: :hi\n");
        let root = resolve(&index, &DocumentPath::root(0)).unwrap();
        assert_eq!(index.node(root).unwrap().role, NodeRole::DocumentRoot);
        assert_eq!(index.node(root).unwrap().kind, NodeKind::Mapping);
    }

    #[test]
    fn a_key_matches_the_decoded_value_whatever_style_it_is_written_in() {
        let index = index_of("'replace': one\n\"label\": two\n");
        assert_eq!(value_at(&index, "replace"), "one");
        assert_eq!(value_at(&index, "label"), "two");
    }

    #[test]
    fn resolution_reports_where_it_stopped_rather_than_panicking() {
        let index = index_of("matches:\n  - trigger: :hi\n");

        assert!(matches!(
            resolve(&index, &DocumentPath::parse("matches[0].nope").unwrap()),
            Err(PathError::NoSuchKey { segment: 2, .. })
        ));
        assert!(matches!(
            resolve(&index, &DocumentPath::parse("matches[7]").unwrap()),
            Err(PathError::IndexOutOfRange {
                index: 7,
                len: 1,
                ..
            })
        ));
        assert!(matches!(
            resolve(&index, &DocumentPath::parse("matches.trigger").unwrap()),
            Err(PathError::IndexIntoNonSequence { .. }) | Err(PathError::KeyIntoNonMapping { .. })
        ));
        assert!(matches!(
            resolve(&index, &DocumentPath::parse("#9.matches").unwrap()),
            Err(PathError::NoSuchDocument {
                document_index: 9,
                documents: 1
            })
        ));
    }

    #[test]
    fn resolve_key_refuses_a_path_no_key_introduces() {
        let index = index_of("matches:\n  - trigger: :hi\n");
        assert_eq!(
            resolve_key(&index, &DocumentPath::parse("matches[0]").unwrap()),
            Err(PathError::NoKeySegment)
        );
        assert_eq!(
            resolve_key(&index, &DocumentPath::root(0)),
            Err(PathError::NoKeySegment)
        );
    }

    #[test]
    fn a_duplicate_key_is_refused_in_both_directions() {
        let index = index_of("a: one\na: two\n");
        let path = DocumentPath::parse("a").unwrap();
        assert!(matches!(
            resolve(&index, &path),
            Err(PathError::DuplicateKey { occurrences: 2, .. })
        ));

        // Both values are unaddressable, and for the symmetric reason.
        let values: Vec<_> = index
            .nodes()
            .iter()
            .filter(|node| node.role == NodeRole::MappingValue)
            .map(|node| path_to(&index, node.id))
            .collect();
        assert_eq!(values.len(), 2);
        for outcome in values {
            assert!(matches!(
                outcome,
                Err(AddressError::AmbiguousKey { occurrences: 2, .. })
            ));
        }
    }

    #[test]
    fn a_mapping_key_has_no_path_but_its_value_does() {
        let index = index_of("a: one\n");
        for node in index.nodes() {
            if node.role == NodeRole::MappingKey {
                assert!(matches!(
                    path_to(&index, node.id),
                    Err(AddressError::IsMappingKey { .. })
                ));
            }
        }
        let value = index
            .nodes()
            .iter()
            .find(|node| node.role == NodeRole::MappingValue)
            .unwrap();
        assert_eq!(
            path_to(&index, value.id).unwrap(),
            DocumentPath::root(0).with_key("a")
        );
    }

    #[test]
    fn a_document_node_has_no_path() {
        let index = index_of("a: one\n");
        let document = index.documents()[0];
        assert!(matches!(
            path_to(&index, document),
            Err(AddressError::IsDocument { .. })
        ));
    }

    #[test]
    fn an_empty_value_resolves_to_its_zero_width_scalar() {
        let index = index_of("empty:\n");
        let id = resolve(&index, &DocumentPath::parse("empty").unwrap()).unwrap();
        let node = index.node(id).unwrap();
        assert_eq!(node.kind, NodeKind::Scalar);
        assert!(node.is_zero_width());
        assert_eq!(path_to(&index, id).unwrap().to_string(), "empty");
    }

    #[test]
    fn a_merge_key_and_an_alias_value_are_addressable_syntactically() {
        let index = index_of("base: &b\n  word: true\nuse:\n  <<: *b\n  extra: 1\n");
        let merged = resolve(&index, &DocumentPath::parse("use.<<").unwrap()).unwrap();
        assert_eq!(index.node(merged).unwrap().kind, NodeKind::Alias);
        assert_eq!(path_to(&index, merged).unwrap().to_string(), "use.<<");
    }

    #[test]
    fn an_explicit_key_mapping_resolves_by_its_decoded_key() {
        let index = index_of("? explicit\n: value\n");
        assert_eq!(value_at(&index, "explicit"), "value");
    }

    #[test]
    fn flow_collections_are_addressed_exactly_like_block_ones() {
        let index = index_of("vars: [{name: choice, type: choice}]\n");
        assert_eq!(value_at(&index, "vars[0].name"), "choice");
        let id = resolve(&index, &DocumentPath::parse("vars[0].type").unwrap()).unwrap();
        assert_eq!(path_to(&index, id).unwrap().to_string(), "vars[0].type");
    }

    #[test]
    fn a_path_is_rooted_at_one_document_of_the_stream() {
        let index = index_of("---\na: one\n---\na: two\n");
        assert_eq!(index.documents().len(), 2);
        assert_eq!(value_at(&index, "a"), "one");
        assert_eq!(value_at(&index, "#1.a"), "two");

        let second = resolve(&index, &DocumentPath::parse("#1.a").unwrap()).unwrap();
        assert_eq!(path_to(&index, second).unwrap().to_string(), "#1.a");
    }

    #[test]
    fn the_textual_form_round_trips_including_awkward_keys() {
        let cases = [
            DocumentPath::root(0),
            DocumentPath::root(3),
            DocumentPath::root(0).with_key("matches"),
            DocumentPath::root(0).with_key("matches").with_index(3),
            DocumentPath::root(0)
                .with_key("matches")
                .with_index(3)
                .with_key("replace"),
            DocumentPath::root(2).with_key("matches").with_index(0),
            DocumentPath::root(0).with_index(0).with_key("trigger"),
            DocumentPath::root(0).with_key("a.b"),
            DocumentPath::root(0).with_key("a[0]"),
            DocumentPath::root(0).with_key("don't"),
            DocumentPath::root(0).with_key("''"),
            DocumentPath::root(0).with_key(""),
            DocumentPath::root(0).with_key("with space"),
            DocumentPath::root(0).with_key("#hash"),
            DocumentPath::root(0).with_key("<<"),
            DocumentPath::root(0).with_key("día ⌘"),
            DocumentPath::root(1).with_key("a b").with_key("c.d"),
        ];
        for path in cases {
            let text = path.to_string();
            assert_eq!(
                DocumentPath::parse(&text).as_ref(),
                Ok(&path),
                "round trip failed for {text:?}"
            );
        }
    } // End of function the_textual_form_round_trips_including_awkward_keys()

    #[test]
    fn the_textual_form_uses_the_documented_spellings() {
        assert_eq!(
            DocumentPath::root(0)
                .with_key("matches")
                .with_index(3)
                .with_key("replace")
                .to_string(),
            "matches[3].replace"
        );
        assert_eq!(DocumentPath::root(0).to_string(), "#0");
        assert_eq!(
            DocumentPath::root(2).with_key("matches").to_string(),
            "#2.matches"
        );
        assert_eq!(
            DocumentPath::root(0)
                .with_index(0)
                .with_key("trigger")
                .to_string(),
            "[0].trigger"
        );
        assert_eq!(DocumentPath::root(0).with_key("a.b").to_string(), "'a.b'");
        assert_eq!(
            DocumentPath::root(0).with_key("don't").to_string(),
            "'don''t'"
        );
        assert_eq!(DocumentPath::root(0).with_key("").to_string(), "''");
    }

    #[test]
    fn parsing_accepts_the_redundant_forms_display_normalises_away() {
        assert_eq!(
            DocumentPath::parse("#0.matches").unwrap(),
            DocumentPath::root(0).with_key("matches")
        );
        assert_eq!(
            DocumentPath::parse("'matches'[0]").unwrap(),
            DocumentPath::root(0).with_key("matches").with_index(0)
        );
    }

    #[test]
    fn parsing_rejects_malformed_paths_with_a_located_error() {
        let cases: [(&str, PathParseError); 9] = [
            ("", PathParseError::Empty),
            ("#", PathParseError::MalformedDocumentPrefix { at: 0 }),
            ("#x.a", PathParseError::MalformedDocumentPrefix { at: 0 }),
            ("a.", PathParseError::ExpectedKey { at: 2 }),
            ("a.[0]", PathParseError::ExpectedKey { at: 2 }),
            ("#1.", PathParseError::ExpectedKey { at: 3 }),
            ("a[", PathParseError::MalformedIndex { at: 1 }),
            ("a[0", PathParseError::UnterminatedIndex { at: 1 }),
            ("'a", PathParseError::UnterminatedQuotedKey { at: 0 }),
        ];
        for (text, expected) in cases {
            assert_eq!(
                DocumentPath::parse(text),
                Err(expected),
                "unexpected parse outcome for {text:?}"
            );
        }
        // A bare key may not hold the grammar's own punctuation, and a quote
        // inside one is that mistake rather than the start of a quoted key.
        assert!(matches!(
            DocumentPath::parse("a]b"),
            Err(PathParseError::ReservedCharacterInBareKey {
                character: ']',
                at: 1
            })
        ));
        assert!(matches!(
            DocumentPath::parse("a'b'"),
            Err(PathParseError::ReservedCharacterInBareKey {
                character: '\'',
                at: 1
            })
        ));
        // Two adjacent keys with no separator are a mistake, not a
        // concatenation. This is the only shape that reaches it: a bare key can
        // only stop at `.`, `[` or the end of the text.
        assert!(matches!(
            DocumentPath::parse("'a'b"),
            Err(PathParseError::UnexpectedCharacter {
                character: 'b',
                at: 3
            })
        ));
        assert!(matches!(
            DocumentPath::parse("a[0]b"),
            Err(PathParseError::UnexpectedCharacter {
                character: 'b',
                at: 4
            })
        ));
    } // End of function parsing_rejects_malformed_paths_with_a_located_error()

    #[test]
    fn an_unknown_node_identifier_is_refused_not_panicked_on() {
        // A `NodeId` is only ever minted by an index, so the only way to hold
        // one that a given index does not know is to take it from a larger
        // index — exactly what a caller that mixes up two parsed documents does.
        let large = index_of("a: one\nb: two\nc: three\nd: four\ne: five\n");
        let small = index_of("a: one\n");
        let beyond = large.nodes().last().expect("a node").id;
        assert!(beyond.get() >= small.nodes().len());

        assert_eq!(
            path_to(&small, beyond),
            Err(AddressError::UnknownNode { node: beyond })
        );
    }
}
