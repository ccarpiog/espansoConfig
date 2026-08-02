//! The session: discovery, plus a document cache keyed by content revision.
//!
//! This is the API the Phase 1b Tauri commands wrap one to one — plan section
//! 6.4's `open_workspace`, `list_documents` and `get_document`. It is
//! deliberately **command-shaped rather than convenient**: each method is what
//! one IPC call needs, so the Tauri layer stays a thin wrapper and no policy
//! leaks into it.
//!
//! Read-only in Phase 1a. There is no save, no watcher and no edit here; those
//! are `crate::persist`, `crate::watch` and `crate::patch`.
//!
//! # Why there is a cache at all — R19's remaining half
//!
//! `TriviaIndex::scan` is the expensive part of opening a document, and
//! `PROGRESS.md` R19 records that the safe entry point re-scans on every call
//! by design. Phase 0c-3b-2b's memoisation made the corpus sweeps fast
//! (87.9 s → 39.4 s for the whole suite) but did not change that: a UI that
//! re-parsed per keystroke would still pay tens of milliseconds per keystroke,
//! which is not viable for an editor.
//!
//! So this module parses **once per [`ContentRevision`]** and serves every
//! later request from the cache:
//!
//! - [`Workspace::open`] enumerates and parses **nothing**. Opening a config
//!   directory is instant however many files it holds.
//! - [`Workspace::get_document`] parses on the first call for a document and
//!   never again while the cached bytes stand. It does **not** touch the disk:
//!   between saves the frontend's draft is the authority (plan section 6.4,
//!   *"do not send every keystroke to Rust"*), and a `get` that stat-ed the
//!   file would reintroduce per-call I/O for an answer the caller did not ask
//!   for.
//! - [`Workspace::refresh`] is the one method that reads the disk. It rehashes
//!   the bytes and **keeps the cached parse when the revision is unchanged**,
//!   which is what makes a watcher notification cheap: plan section 6.5 says to
//!   treat those notifications as hints, and most of them are hints about a
//!   file that did not really change.
//!
//! [`Workspace::parse_count`] exposes how many times a document has actually
//! been parsed, so the cache is observable rather than merely asserted.
//!
//! # What a cache slot may hold
//!
//! **Only what was read from disk.** Plan section 6.4 divides ownership: *Rust
//! owns disk snapshots, the frontend owns the unsaved draft.* There is
//! therefore no method here that installs caller-supplied bytes into a
//! document's cache slot — an earlier `load_from_source` did exactly that, and
//! after it [`Workspace::get_document`] returned a draft while the disk held
//! something else, with only [`Workspace::refresh`] able to restore the truth.
//! A caller that wants a projection of bytes it holds calls
//! [`project_source`], which builds a standalone snapshot and touches no
//! session state.

use std::collections::BTreeMap;
use std::fmt;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock, PoisonError};

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

use crate::discovery::{self, ConfigTree, DiscoveredFile, DiscoveryError, FileKind};
use crate::model::{context_of, DocumentContext, DocumentView, IdentityError, MatchId, MatchView};
use crate::syntax::{SyntaxIndex, TriviaIndex};
use crate::wire::{WirePath, WirePathRef};
use crate::{ContentRevision, DocumentId, LineEnding, ParseOutcome, SourceDocument};

/// Everything that can go wrong in this module.
///
/// Codes plus structured data, never prose (plan section 9). The `Display`
/// impls exist for logs and test output.
///
/// [`Serialize`] is hand-written rather than derived because
/// [`std::io::Error`] is not serializable and must not become a sentence on the
/// wire: the `Io` variant crosses as its [`std::io::ErrorKind`] name, which is
/// a code the frontend translates, exactly like every [`crate::model::
/// DiagnosticCode`].
#[derive(Debug)]
pub enum WorkspaceError {
    /// The configuration directory could not be located or enumerated.
    Discovery(DiscoveryError),
    /// No document of this session has that identity.
    UnknownDocument {
        /// The identity that was asked about.
        id: DocumentId,
    },
    /// A match identity did not resolve — it names another document, another
    /// parse, or no match at all.
    Identity(IdentityError),
    /// The file could not be read.
    Io {
        /// The path being read.
        path: PathBuf,
        /// The underlying error.
        source: io::Error,
    },
    /// The file is not valid UTF-8, so it cannot be a YAML document this crate
    /// understands.
    ///
    /// Reported rather than lossily decoded: a lossy decode would put
    /// replacement characters into bytes the save path promises to preserve.
    NotUtf8 {
        /// The path that failed to decode.
        path: PathBuf,
        /// Byte offset of the first invalid sequence.
        offset: usize,
    },
}

impl fmt::Display for WorkspaceError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            WorkspaceError::Discovery(error) => write!(formatter, "{error}"),
            WorkspaceError::UnknownDocument { id } => {
                write!(formatter, "unknown document {}", id.get())
            }
            WorkspaceError::Identity(error) => write!(formatter, "{error}"),
            WorkspaceError::Io { path, source } => {
                write!(formatter, "cannot read {}: {source}", path.display())
            }
            WorkspaceError::NotUtf8 { path, offset } => {
                write!(
                    formatter,
                    "{} is not UTF-8 at byte {offset}",
                    path.display()
                )
            }
        }
    } // End of function fmt() for WorkspaceError
}

impl std::error::Error for WorkspaceError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            WorkspaceError::Discovery(error) => Some(error),
            WorkspaceError::Identity(error) => Some(error),
            WorkspaceError::Io { source, .. } => Some(source),
            _ => None,
        }
    }
}

impl Serialize for WorkspaceError {
    /// Serializes as `{ "code": …, … operands }`.
    ///
    /// Plan section 6.4 lists a `Result<_, AppError>` on every command, so this
    /// type has to cross the IPC boundary; plan section 9 says what it may
    /// carry there. Every field below is a code, a path or a number — never a
    /// rendered message. `Io` carries the [`std::io::ErrorKind`] name because
    /// that *is* the code; the `Display` string is deliberately not sent.
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            WorkspaceError::Discovery(error) => {
                let mut out = serializer.serialize_struct("WorkspaceError", 2)?;
                out.serialize_field("code", "discovery")?;
                out.serialize_field("discovery", error)?;
                out.end()
            }
            WorkspaceError::UnknownDocument { id } => {
                let mut out = serializer.serialize_struct("WorkspaceError", 2)?;
                out.serialize_field("code", "unknownDocument")?;
                out.serialize_field("id", id)?;
                out.end()
            }
            WorkspaceError::Identity(error) => {
                let mut out = serializer.serialize_struct("WorkspaceError", 2)?;
                out.serialize_field("code", "identity")?;
                out.serialize_field("identity", error)?;
                out.end()
            }
            WorkspaceError::Io { path, source } => {
                let mut out = serializer.serialize_struct("WorkspaceError", 3)?;
                out.serialize_field("code", "io")?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.serialize_field("kind", &format!("{:?}", source.kind()))?;
                out.end()
            }
            WorkspaceError::NotUtf8 { path, offset } => {
                let mut out = serializer.serialize_struct("WorkspaceError", 3)?;
                out.serialize_field("code", "notUtf8")?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.serialize_field("offset", offset)?;
                out.end()
            }
        }
    } // End of function serialize() for WorkspaceError
}

impl From<DiscoveryError> for WorkspaceError {
    fn from(error: DiscoveryError) -> WorkspaceError {
        WorkspaceError::Discovery(error)
    }
}

impl From<IdentityError> for WorkspaceError {
    fn from(error: IdentityError) -> WorkspaceError {
        WorkspaceError::Identity(error)
    }
}

/// The session's path-to-identity table.
///
/// Identities used to be the enumeration position of a sorted directory walk,
/// which made a retained [`DocumentId`] **positional**: adding an
/// alphabetically earlier file and reopening silently re-pointed every identity
/// after it at a different file. A monotonic counter keyed by path removes the
/// failure mode by construction — a path keeps its identity for the life of the
/// process, a new file gets a fresh one, and an identity whose file is gone
/// matches nothing and comes back as [`WorkspaceError::UnknownDocument`].
struct SessionIdentities {
    /// The next identity to hand out. Never reused, so a removed file's
    /// identity cannot be inherited by another file.
    next: u64,
    /// Every path this process has ever seen, with the identity it was given.
    by_path: BTreeMap<PathBuf, DocumentId>,
}

/// The process-wide identity table.
///
/// "Session" means the running process, which is what a `DocumentId` is
/// documented to be scoped to. The table grows by one entry per distinct path
/// ever opened; a config tree is tens of files, so it never becomes a
/// consideration.
fn session_identities() -> &'static Mutex<SessionIdentities> {
    static IDENTITIES: OnceLock<Mutex<SessionIdentities>> = OnceLock::new();
    IDENTITIES.get_or_init(|| {
        Mutex::new(SessionIdentities {
            next: 0,
            by_path: BTreeMap::new(),
        })
    })
}

/// The session-stable identity of `path`, minting one on first sight.
///
/// Poisoning is absorbed rather than propagated: this module must not panic,
/// and a poisoned table is still a correct table — the panic that poisoned it
/// happened elsewhere and left no partial write here, because every mutation
/// below is two infallible statements.
fn identity_of(path: &Path) -> DocumentId {
    let mut table = session_identities()
        .lock()
        .unwrap_or_else(PoisonError::into_inner);
    if let Some(id) = table.by_path.get(path) {
        return *id;
    }
    let id = mint(table.next);
    table.next += 1;
    table.by_path.insert(path.to_path_buf(), id);
    id
} // End of function identity_of()

/// Turns the counter's next value into an identity, or refuses.
///
/// A [`DocumentId`] is a `u64` and crosses the boundary as a JSON number, which
/// the webview reads as an IEEE-754 double. Above
/// [`crate::MAX_EXACT_WIRE_INTEGER`] two distinct identities become the same
/// JavaScript number, and an identity that cannot be told from another is not
/// an identity. **The invariant is stated and checked here rather than assumed
/// in a comment**: the counter is monotonic and one file costs one increment,
/// so reaching the bound would take nine quadrillion distinct paths in one
/// process — but "unreachable" is a claim, and a claim about a wire type
/// belongs at the site that mints the value.
///
/// A panic is the right refusal because there is no honest alternative: handing
/// out an ambiguous identity is worse, and no caller could act on an error here
/// that it could not act on by not having asked.
fn mint(next: u64) -> DocumentId {
    assert!(
        next <= crate::MAX_EXACT_WIRE_INTEGER,
        "a DocumentId above 2^53-1 cannot be told from its neighbour once it reaches JavaScript"
    );
    DocumentId(next)
} // End of function mint()

/// What `list_documents` returns: one row per file, with no parse behind it.
///
/// Everything here comes from [`crate::discovery`], so building the whole list
/// costs one directory walk and no YAML work at all. The sidebar can therefore
/// render before a single file has been opened.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DocumentSummary {
    /// Session-local identity.
    pub id: DocumentId,
    /// Absolute path on disk.
    ///
    /// A [`WirePath`]: it renders lossily on the wire so that no path can make
    /// this row fail to serialize, and [`DocumentSummary::id`] — not this — is
    /// what a caller hands back. See `crate::wire`.
    pub path: WirePath,
    /// Path relative to the configuration root, for display.
    pub relative_path: WirePath,
    /// What espanso treats the file as.
    pub kind: FileKind,
    /// Whether espanso's default include glob skips the file (a leading `_`).
    pub disabled: bool,
    /// Whether the editor must refuse to write it (a Hub package).
    pub read_only: bool,
    /// Whether this document has been parsed and is being served from cache.
    pub loaded: bool,
}

/// What `open_workspace` returns.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct WorkspaceSummary {
    /// The configuration root, as a lossily rendered [`WirePath`].
    pub root: WirePath,
    /// How many YAML files were found.
    pub documents: usize,
    /// How many are match files.
    pub match_files: usize,
    /// How many are config profiles.
    pub config_profiles: usize,
    /// How many came from the Hub and are read-only.
    pub packages: usize,
    /// How many are not auto-loaded because their name starts with `_`.
    pub disabled: usize,
}

/// One document of the session, with its cache slot.
#[derive(Debug)]
struct Entry {
    summary: DocumentSummary,
    context: DocumentContext,
    loaded: Option<SourceDocument>,
}

/// A located espanso configuration directory and its parsed documents.
///
/// Methods that can populate the cache take `&mut self`. That is deliberate:
/// the alternative is interior mutability, which buys a `&self` signature and
/// costs the ability to hand out a plain `&SourceDocument`. The Tauri layer
/// holds one of these behind a `Mutex` regardless, because a command that
/// mutates the cache must not run concurrently with one that reads it.
#[derive(Debug)]
pub struct Workspace {
    root: PathBuf,
    entries: Vec<Entry>,
    by_path: BTreeMap<PathBuf, DocumentId>,
    parses: u64,
}

impl Workspace {
    /// Opens the configuration directory at `root`, without parsing anything.
    pub fn open(root: &Path) -> Result<Workspace, WorkspaceError> {
        let tree = discovery::enumerate(root)?;
        Ok(Workspace::from_tree(tree))
    }

    /// Locates the configuration directory and opens it (plan section 6.4's
    /// `open_workspace`).
    ///
    /// Pass `explicit` when the user has chosen a directory in settings; see
    /// `crate::discovery::resolve_config_dir` for the probe order.
    pub fn discover(explicit: Option<&Path>) -> Result<Workspace, WorkspaceError> {
        let tree = discovery::discover(explicit)?;
        Ok(Workspace::from_tree(tree))
    }

    /// Builds a workspace from an already-enumerated tree.
    ///
    /// Identities come from the **session's path table**, not from the tree's
    /// order, so they are stable across two `open` calls of a directory that
    /// *changed* as well as one that did not: adding a file gives that file a
    /// fresh identity and moves nobody else's, and removing one leaves its
    /// identity unmatched rather than handing it to a neighbour. That is what
    /// lets a UI remember which file was selected without the memory silently
    /// becoming a different file.
    pub fn from_tree(tree: ConfigTree) -> Workspace {
        let mut entries = Vec::with_capacity(tree.files.len());
        let mut by_path = BTreeMap::new();
        for file in tree.files.iter() {
            let id = identity_of(&file.path);
            by_path.insert(file.path.clone(), id);
            entries.push(Entry {
                summary: summary_of(id, file),
                context: context_of(id, file),
                loaded: None,
            });
        } // End of the loop over the enumerated files
        Workspace {
            root: tree.root,
            entries,
            by_path,
            parses: 0,
        }
    } // End of function from_tree()

    /// The configuration root.
    pub fn root(&self) -> &Path {
        &self.root
    }

    /// What `open_workspace` returns.
    pub fn summary(&self) -> WorkspaceSummary {
        let count = |kind: FileKind| {
            self.entries
                .iter()
                .filter(|entry| entry.summary.kind == kind)
                .count()
        };
        WorkspaceSummary {
            root: WirePath::from(self.root.clone()),
            documents: self.entries.len(),
            match_files: count(FileKind::MatchFile),
            config_profiles: count(FileKind::ConfigProfile),
            packages: count(FileKind::Package),
            disabled: self
                .entries
                .iter()
                .filter(|entry| entry.summary.disabled)
                .count(),
        }
    } // End of function summary()

    /// What `list_documents` returns: every file, parsed or not.
    pub fn list_documents(&self) -> Vec<DocumentSummary> {
        self.entries
            .iter()
            .map(|entry| DocumentSummary {
                loaded: entry.loaded.is_some(),
                ..entry.summary.clone()
            })
            .collect()
    }

    /// The identity of the document at `path`, when the session holds one.
    pub fn document_id(&self, path: &Path) -> Option<DocumentId> {
        self.by_path.get(path).copied()
    }

    /// Everything about one document that does not come from its own bytes.
    ///
    /// The value [`crate::persist::SaveRequest::context`] needs, and the reason
    /// this accessor exists: a save has to be given the **absolute path, the file
    /// kind and the identity this session already resolved**, and a caller that
    /// rebuilt a [`DocumentContext`] of its own could disagree with the one the
    /// projection was made against — most sharply about
    /// [`crate::discovery::FileKind::Package`], which is what makes a document
    /// read-only.
    ///
    /// Costs no parse and no read: the context comes from the directory walk.
    ///
    /// # Errors
    ///
    /// [`WorkspaceError::UnknownDocument`] for an identity this session does not
    /// hold.
    pub fn document_context(&self, id: DocumentId) -> Result<&DocumentContext, WorkspaceError> {
        let position = self.position_of(id)?;
        Ok(&self.entries[position].context)
    } // End of function document_context()

    /// How many times any document has been parsed in this session.
    ///
    /// Instrumentation, and the observable half of the cache's contract: two
    /// [`Workspace::get_document`] calls for one document must move this by one.
    /// It is public because a property nothing can observe is a property nothing
    /// can test (`PROGRESS.md` R24).
    pub fn parse_count(&self) -> u64 {
        self.parses
    }

    /// What `get_document` returns: the snapshot, parsing it on first use.
    ///
    /// Serves from the cache on every later call, without touching the disk.
    /// Use [`Workspace::refresh`] to re-read a file that may have changed.
    ///
    /// # Errors
    ///
    /// [`WorkspaceError::UnknownDocument`] for an identity this session does not
    /// hold, and [`WorkspaceError::Io`] or [`WorkspaceError::NotUtf8`] when the
    /// file cannot be read. A file that reads but does not *parse* is **not** an
    /// error: it comes back with [`ParseOutcome::Failed`], its raw text and a
    /// diagnostic.
    pub fn get_document(&mut self, id: DocumentId) -> Result<&SourceDocument, WorkspaceError> {
        let position = self.position_of(id)?;
        if self.entries[position].loaded.is_none() {
            let document = self.read_and_project(position)?;
            self.entries[position].loaded = Some(document);
        }
        Ok(self.entries[position]
            .loaded
            .as_ref()
            .expect("the document was just loaded"))
    } // End of function get_document()

    /// The projection of a document, parsing it on first use.
    pub fn document_view(&mut self, id: DocumentId) -> Result<&DocumentView, WorkspaceError> {
        self.get_document(id).map(|document| &document.view)
    }

    /// The whole text of a document, parsing it on first use.
    ///
    /// A `&str`, not bytes: a document only exists here once [`read_utf8`] has
    /// accepted it, so a file that is not valid UTF-8 was already refused with
    /// [`WorkspaceError::NotUtf8`] and never reaches this method. What this
    /// returns is the file unchanged — no line ending converted, no BOM
    /// stripped, no normalisation — for every document there is.
    ///
    /// Always available, **including for a document that failed to parse** —
    /// that is what the raw YAML pane shows, and refusing to hand back the text
    /// of the one file the user needs to fix would be the opposite of useful.
    pub fn document_text(&mut self, id: DocumentId) -> Result<&str, WorkspaceError> {
        self.get_document(id)
            .map(|document| document.source.as_str())
    }

    /// Re-reads the document from disk, reparsing only if its bytes changed.
    ///
    /// The method a watcher notification drives. A notification about a file
    /// whose contents are unchanged — which is most of them, because espanso
    /// and editors both touch files without changing them — costs one read and
    /// one hash, and [`Workspace::parse_count`] does not move.
    pub fn refresh(&mut self, id: DocumentId) -> Result<&SourceDocument, WorkspaceError> {
        let position = self.position_of(id)?;
        let source = read_utf8(&self.entries[position].summary.path)?;
        let revision = ContentRevision::of_bytes(source.as_bytes());
        let unchanged = self.entries[position]
            .loaded
            .as_ref()
            .is_some_and(|document| document.revision == revision);
        if !unchanged {
            let document = self.project(position, source, revision);
            self.entries[position].loaded = Some(document);
        }
        Ok(self.entries[position]
            .loaded
            .as_ref()
            .expect("the document is loaded"))
    } // End of function refresh()

    /// Parses and projects every document of the session.
    ///
    /// What a "browse everything" surface needs — the sidebar's `All (65)`
    /// count, and search across files. Returns the identities that could not be
    /// read, with their errors, rather than failing on the first one: one
    /// unreadable file must not hide the rest of the config.
    pub fn load_all(&mut self) -> Vec<(DocumentId, WorkspaceError)> {
        let ids: Vec<DocumentId> = self.entries.iter().map(|entry| entry.summary.id).collect();
        let mut failures = Vec::new();
        for id in ids {
            if let Err(error) = self.get_document(id) {
                failures.push((id, error));
            }
        }
        failures
    } // End of function load_all()

    /// Every document already in the cache, in identity order.
    pub fn loaded_documents(&self) -> impl Iterator<Item = &SourceDocument> {
        self.entries
            .iter()
            .filter_map(|entry| entry.loaded.as_ref())
    }

    /// Drops the cached parse of one document, keeping its place in the list.
    ///
    /// For the memory-pressure case a long session will eventually want. The
    /// next [`Workspace::get_document`] reparses.
    pub fn evict(&mut self, id: DocumentId) -> Result<(), WorkspaceError> {
        let position = self.position_of(id)?;
        self.entries[position].loaded = None;
        Ok(())
    }

    /// What `get_match` returns: one match of one document (plan section 6.4).
    ///
    /// Parses the document on first use, exactly as [`Workspace::get_document`]
    /// does, then resolves the identity **against that parse**.
    ///
    /// # Errors
    ///
    /// [`WorkspaceError::UnknownDocument`] when the session holds no such
    /// document, [`WorkspaceError::Io`] or [`WorkspaceError::NotUtf8`] when the
    /// file cannot be read, and [`WorkspaceError::Identity`] when the identity
    /// belongs to another document, to another parse of this one, or to no
    /// match. A stale identity is **never** resolved to whichever match now
    /// occupies its node.
    pub fn get_match(&mut self, id: MatchId) -> Result<&MatchView, WorkspaceError> {
        let view = self.document_view(id.document)?;
        view.match_by_id(id).map_err(WorkspaceError::Identity)
    }

    /// The position of `id` in the entry list.
    fn position_of(&self, id: DocumentId) -> Result<usize, WorkspaceError> {
        self.entries
            .iter()
            .position(|entry| entry.summary.id == id)
            .ok_or(WorkspaceError::UnknownDocument { id })
    }

    /// Reads a document from disk and projects it.
    fn read_and_project(&mut self, position: usize) -> Result<SourceDocument, WorkspaceError> {
        let source = read_utf8(&self.entries[position].summary.path)?;
        let revision = ContentRevision::of_bytes(source.as_bytes());
        Ok(self.project(position, source, revision))
    }

    /// Parses and projects `source`, counting the parse.
    ///
    /// The **one** place a `SyntaxIndex` is built in this module, which is what
    /// makes [`Workspace::parse_count`] an honest measure rather than a
    /// hand-maintained tally.
    fn project(
        &mut self,
        position: usize,
        source: String,
        revision: ContentRevision,
    ) -> SourceDocument {
        self.parses += 1;
        let context = &self.entries[position].context;
        let (parse, view) = match SyntaxIndex::parse(&source) {
            Ok(index) => {
                let trivia = TriviaIndex::scan(&source, &index);
                let view = DocumentView::project(context, &source, revision, &index, &trivia);
                (
                    ParseOutcome::Parsed {
                        syntax: index,
                        trivia,
                    },
                    view,
                )
            }
            Err(error) => {
                let view = DocumentView::failed(context, &source, revision, &error);
                (ParseOutcome::Failed(error), view)
            }
        };
        SourceDocument {
            id: context.id,
            path: context.path.clone(),
            line_ending: LineEnding::detect(&source),
            bom: source.starts_with(crate::UTF8_BOM),
            source,
            revision,
            parse,
            view,
        }
    } // End of function project()
} // End of impl Workspace

/// Builds a summary row from a discovered file.
fn summary_of(id: DocumentId, file: &DiscoveredFile) -> DocumentSummary {
    DocumentSummary {
        id,
        path: WirePath::from(file.path.clone()),
        relative_path: WirePath::from(file.relative_path.clone()),
        kind: file.kind,
        disabled: file.disabled,
        read_only: file.kind.is_read_only(),
        loaded: false,
    }
}

/// Reads `path` as UTF-8, reporting the offset of the first invalid sequence.
fn read_utf8(path: &Path) -> Result<String, WorkspaceError> {
    let bytes = std::fs::read(path).map_err(|source| WorkspaceError::Io {
        path: path.to_path_buf(),
        source,
    })?;
    String::from_utf8(bytes).map_err(|error| WorkspaceError::NotUtf8 {
        path: path.to_path_buf(),
        offset: error.utf8_error().valid_up_to(),
    })
}

/// Projects a document from bytes alone, with no workspace and no filesystem.
///
/// The entry point the corpus tests drive, and the one a future "open a file
/// the user dragged in" surface will use. Identical to what
/// [`Workspace::get_document`] produces for the same bytes and context.
pub fn project_source(context: &DocumentContext, source: &str) -> SourceDocument {
    let revision = ContentRevision::of_bytes(source.as_bytes());
    let (parse, view) = match SyntaxIndex::parse(source) {
        Ok(index) => {
            let trivia = TriviaIndex::scan(source, &index);
            let view = DocumentView::project(context, source, revision, &index, &trivia);
            (
                ParseOutcome::Parsed {
                    syntax: index,
                    trivia,
                },
                view,
            )
        }
        Err(error) => {
            let view = DocumentView::failed(context, source, revision, &error);
            (ParseOutcome::Failed(error), view)
        }
    };
    SourceDocument {
        id: context.id,
        path: context.path.clone(),
        line_ending: LineEnding::detect(source),
        bom: source.starts_with(crate::UTF8_BOM),
        source: source.to_owned(),
        revision,
        parse,
        view,
    }
} // End of function project_source()

#[cfg(test)]
mod tests {
    use super::{mint, project_source, DocumentSummary, WorkspaceSummary};
    use crate::discovery::FileKind;
    use crate::model::DocumentContext;
    use crate::wire::WirePath;
    use crate::DocumentId;
    use std::path::PathBuf;

    /// The identity counter refuses to leave the range JavaScript can carry.
    ///
    /// The bound itself is asserted, not merely documented: `PROGRESS.md` R24
    /// says a safety property whose only home is a comment is not a safety
    /// property, and "the counter never gets that high" is exactly such a
    /// comment until something checks it.
    #[test]
    fn the_last_exactly_representable_identity_is_still_minted() {
        assert_eq!(
            mint(crate::MAX_EXACT_WIRE_INTEGER),
            DocumentId(crate::MAX_EXACT_WIRE_INTEGER)
        );
    }

    /// One past the bound is refused rather than handed out.
    #[test]
    #[should_panic(expected = "cannot be told from its neighbour")]
    fn an_identity_javascript_could_not_tell_apart_is_refused() {
        let _ = mint(crate::MAX_EXACT_WIRE_INTEGER + 1);
    }

    /// A path whose basename is not valid UTF-8.
    ///
    /// Constructed from bytes: macOS refuses to *create* such a name
    /// (`EILSEQ`), and the property under test is that the wire types are total
    /// for every value their fields admit.
    #[cfg(unix)]
    fn non_utf8_path() -> PathBuf {
        use std::ffi::OsStr;
        use std::os::unix::ffi::OsStrExt;
        let mut path = PathBuf::from("/nowhere/match");
        path.push(OsStr::from_bytes(b"ba\xffse.yml"));
        path
    }

    /// Every wire type carrying a path serializes whatever that path's bytes
    /// are.
    ///
    /// The failure this pins is the one that cannot be caught downstream: a
    /// command returns `Ok`, and *then* the response fails to serialize, so the
    /// webview receives the serializer's English prose where `{ code, operands }`
    /// was promised. The premise — that a bare `PathBuf` really does fail — is
    /// asserted in `crate::wire`'s own tests, so this cannot pass vacuously.
    #[test]
    #[cfg(unix)]
    fn every_wire_type_carrying_a_path_serializes_a_non_utf8_path() {
        let path = non_utf8_path();

        let summary = DocumentSummary {
            id: DocumentId(0),
            path: WirePath::from(path.clone()),
            relative_path: WirePath::from(path.clone()),
            kind: FileKind::MatchFile,
            disabled: false,
            read_only: false,
            loaded: false,
        };
        let json = serde_json::to_value(&summary).expect("a document summary must serialize");
        assert!(json["path"]
            .as_str()
            .expect("a string")
            .contains('\u{fffd}'));

        let workspace = WorkspaceSummary {
            root: WirePath::from(path.clone()),
            documents: 1,
            match_files: 1,
            config_profiles: 0,
            packages: 0,
            disabled: 0,
        };
        serde_json::to_value(&workspace).expect("a workspace summary must serialize");

        // The projection is the real one, driven through the real entry point:
        // only the context's path is unusual, and that is the field under test.
        let context = DocumentContext {
            id: DocumentId(0),
            path: path.clone(),
            relative_path: path,
            kind: FileKind::MatchFile,
            disabled: false,
        };
        let view = project_source(&context, "matches:\n  - trigger: ':one'\n").view;
        let json = serde_json::to_value(&view).expect("a document view must serialize");
        assert!(json["relative_path"]
            .as_str()
            .expect("a string")
            .contains('\u{fffd}'));
    } // End of function every_wire_type_carrying_a_path_serializes_a_non_utf8_path()
}
