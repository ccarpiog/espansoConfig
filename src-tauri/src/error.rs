//! The error representation that crosses the IPC boundary.
//!
//! Plan section 9: *Rust returns error codes and structured data, never
//! user-facing prose.* [`CommandError`] is that rule as a type. Every variant
//! is a stable machine `code` plus operands that are paths, numbers and other
//! codes; the sentence a user reads is built in the frontend from the code and
//! those operands, in whichever of the two languages is showing.
//!
//! # Three decisions worth stating, because each of them could have gone the
//! other way
//!
//! 1. **This type is defined here and not in the core.** The core's
//!    `WorkspaceError`, `DiscoveryError` and `IdentityError` already serialize
//!    as codes and operands, and this layer could have forwarded them
//!    unchanged. It does not, for two reasons: the shell has failure modes the
//!    core has no vocabulary for ([`CommandError::NoWorkspaceOpen`] is a fact
//!    about the session, not about any file), and the core's nesting —
//!    `{ code: "identity", identity: { "StaleRevision": … } }` — makes the one
//!    code the frontend most needs to branch on two levels deep and spelled in
//!    a different convention from its neighbours. Flattening the nine reachable
//!    conditions into nine top-level codes is what makes the frontend's
//!    `switch` on `error.code` exhaustive.
//! 2. **There is no `Display` impl.** Not a narrow one, not a developer-only
//!    one. The core has them and documents them as log renderings; here, where
//!    the value is one `?` away from being serialized to a webview, the safest
//!    rendering is none at all. `Debug` covers logging.
//! 3. **`Serialize` is hand-written, and it writes [`CommandError::code`].**
//!    A `#[serde(tag = "code", rename = …)]` derive would produce the same JSON
//!    and would spell every code **twice** — once in the attribute and once in
//!    any accessor Rust code branches on. Writing the impl by hand costs forty
//!    lines and leaves exactly one spelling of each code in the crate, which is
//!    the spelling `src/lib/ipc/errors.ts` is checked against.
//!
//! 4. **Every path operand is an [`espansoconfig_core::wire::WirePath`], not a
//!    `PathBuf`.** `serde`'s own `PathBuf` serializer *fails* on a path that is
//!    not valid UTF-8, which would turn a typed refusal into the serializer's
//!    English prose at the one moment there is no second error to fall back on.
//!    A `WirePath` renders lossily and therefore always succeeds, so the claim
//!    in `crate::commands` that every failure crossing this boundary is a
//!    `CommandError` is true of every value the types admit, not only of the
//!    ones this filesystem happens to allow.
//!
//! There is deliberately **no `COMMAND_ERROR_CODES` constant here.** The
//! frontend needs a runtime list because `isCommandError` has to recognise
//! untyped JSON; Rust does not, and a second list nothing reads would be one
//! more thing to keep in step. The Rust-side enumeration lives in
//! [`every_command_error`], is compiled only for tests, and is what
//! `wire_contract.rs` compares against the TypeScript list.

use std::io;

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

use espansoconfig_core::discovery::DiscoveryError;
use espansoconfig_core::model::IdentityError;
use espansoconfig_core::wire::WirePath;
use espansoconfig_core::workspace::WorkspaceError;

/// Everything a read-only command may fail with.
///
/// Serializes as `{ "code": …, … operands }`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CommandError {
    /// A command was called before any workspace was opened.
    ///
    /// The one variant with no counterpart in the core: it is a property of
    /// this layer's session, not of a file.
    NoWorkspaceOpen,
    /// No candidate configuration directory existed.
    ConfigDirNotFound {
        /// Candidate paths, in the order they were probed.
        candidates: Vec<WirePath>,
    },
    /// A path was supplied explicitly and is not a directory.
    NotADirectory {
        /// The path that is not a directory.
        path: WirePath,
    },
    /// The filesystem refused a read.
    Io {
        /// The path being read.
        path: WirePath,
        /// The [`std::io::ErrorKind`] variant name — a code, not a message.
        kind: String,
    },
    /// A file is not valid UTF-8, so it cannot be a YAML document this crate
    /// understands.
    NotUtf8 {
        /// The path that failed to decode.
        path: WirePath,
        /// Byte offset of the first invalid sequence.
        offset: usize,
    },
    /// No document of this session has that identity.
    UnknownDocument {
        /// The identity that was asked about.
        document: u64,
    },
    /// A match identity names a different document from the one it was offered
    /// to.
    IdentityWrongDocument {
        /// The document that was asked.
        expected: u64,
        /// The document the identity names.
        found: u64,
    },
    /// A match identity was minted from another parse of the same document.
    ///
    /// `PROGRESS.md` R27. Kept distinct from
    /// [`CommandError::IdentityNoSuchMatch`] because the two call for different
    /// behaviour: this one means *the document moved on — re-resolve, and be
    /// ready for the answer to be nothing*, that one means *this projection
    /// holds no such node at all*.
    ///
    /// **It does not mean the match still exists.** The bytes changed; the
    /// match may have been edited, moved or deleted by whatever changed them.
    /// A caller that treats this code as "the thing is still there, fetch it
    /// again" is making a claim nothing in this crate supports — see
    /// `identityRecovery` in `src/lib/ipc/errors.ts`, and
    /// `a_document_path_is_positional_so_a_deletion_repoints_it` in
    /// `crate::commands`, which is the counterexample in test form.
    IdentityStaleRevision {
        /// The revision the projection holds, as 64 hex characters.
        expected: String,
        /// The revision the identity was minted from.
        found: String,
    },
    /// Document and revision agree, but no match of this projection is that
    /// node.
    IdentityNoSuchMatch {
        /// The node the identity names.
        node: usize,
    },
    /// The application menu could not be rebuilt because the main thread would
    /// not accept the work.
    ///
    /// The only failure `crate::menu::set_menu_labels` can answer with: menu
    /// construction is AppKit work that has to be posted to the main thread, so
    /// what the command reports is whether the post was **accepted**. A refusal
    /// means the event loop is gone, which in practice means the application is
    /// shutting down. It carries no operand, because the only thing that failed
    /// is the delivery.
    MenuUnavailable,
    /// The label set the frontend sent is not the label set this build
    /// declares.
    ///
    /// **A version-skew refusal, and it exists because the alternative was
    /// untyped prose.** Phase 1b-2b took the labels as a typed `MenuLabels`
    /// argument, so a frontend one release behind was refused *inside Tauri's
    /// command macro*, which answers with an English sentence — ``invalid args
    /// `labels` for command `set_menu_labels`: missing field `quit` `` — and no
    /// `code` at all. That is prose crossing the boundary, which plan section 9
    /// forbids, and `classifyFailure` could only file it under `unexpected`.
    /// The command now takes an untyped envelope and does the deserialization
    /// itself, so the refusal is this code and these two operands.
    ///
    /// Both operands are **wire field names**, not prose: they are the same
    /// identifiers `MenuLabels`, `MENU_LABEL_FIELDS` and the `menu.` dictionary
    /// namespace are spelled with. Neither is interpolated into a message —
    /// `docs/decisions/1b-2b-notes.md` section 2 lists the operands that are
    /// deliberately not rendered, and these join it.
    ///
    /// Both lists are empty when every field is present and one of them is not
    /// a string. That is a real case and not a degenerate one: the code still
    /// says *these labels are not the label set this build expects*, which is
    /// the whole of what the caller can act on.
    InvalidMenuLabels {
        /// Fields this build declares that the label set did not carry.
        missing: Vec<String>,
        /// Fields the label set carried that this build does not declare.
        unexpected: Vec<String>,
    },
    /// The main thread accepted the menu rebuild and the rebuild failed there.
    ///
    /// Kept apart from [`CommandError::MenuUnavailable`] because the two say
    /// different things about the application: that one means the event loop is
    /// gone, this one means the event loop is alive and AppKit refused. Phase
    /// 1b-2b could not tell them apart at all — `set_menu_labels` returned as
    /// soon as the work was *posted*, so a failure inside the closure left
    /// Tauri's English default menu up and reported success. muda's macOS
    /// implementation does not return an error on these paths today, which is
    /// why this code exists to stop tomorrow's failure being silent rather than
    /// to describe one that happens.
    MenuBuildFailed,
} // End of enum CommandError

impl CommandError {
    /// The stable machine code this error crosses the boundary as.
    ///
    /// The **only** spelling of each code in this crate: [`Serialize`] below
    /// writes this string rather than a literal of its own, so the wire form
    /// and anything Rust branches on cannot disagree. Adding a variant makes
    /// this `match` non-exhaustive, which is a compile error, which is the
    /// prompt to add the code to `src/lib/ipc/errors.ts` as well.
    pub fn code(&self) -> &'static str {
        match self {
            CommandError::NoWorkspaceOpen => "noWorkspaceOpen",
            CommandError::ConfigDirNotFound { .. } => "configDirNotFound",
            CommandError::NotADirectory { .. } => "notADirectory",
            CommandError::Io { .. } => "io",
            CommandError::NotUtf8 { .. } => "notUtf8",
            CommandError::UnknownDocument { .. } => "unknownDocument",
            CommandError::IdentityWrongDocument { .. } => "identityWrongDocument",
            CommandError::IdentityStaleRevision { .. } => "identityStaleRevision",
            CommandError::IdentityNoSuchMatch { .. } => "identityNoSuchMatch",
            CommandError::MenuUnavailable => "menuUnavailable",
            CommandError::InvalidMenuLabels { .. } => "invalidMenuLabels",
            CommandError::MenuBuildFailed => "menuBuildFailed",
        }
    } // End of function code()
} // End of impl CommandError

impl Serialize for CommandError {
    /// Serializes as `{ "code": …, … operands }` — codes and data, no prose.
    ///
    /// Every arm writes [`CommandError::code`] rather than its own literal, so
    /// there is one spelling of each code in the crate. Every other field is a
    /// path, a number or another code; no arm renders a sentence, and there is
    /// no `Display` impl for one to be taken from.
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut out = serializer.serialize_struct("CommandError", 1 + self.operand_count())?;
        out.serialize_field("code", self.code())?;
        match self {
            CommandError::NoWorkspaceOpen => {}
            CommandError::ConfigDirNotFound { candidates } => {
                out.serialize_field("candidates", candidates)?;
            }
            CommandError::NotADirectory { path } => {
                out.serialize_field("path", path)?;
            }
            CommandError::Io { path, kind } => {
                out.serialize_field("path", path)?;
                out.serialize_field("kind", kind)?;
            }
            CommandError::NotUtf8 { path, offset } => {
                out.serialize_field("path", path)?;
                out.serialize_field("offset", offset)?;
            }
            CommandError::UnknownDocument { document } => {
                out.serialize_field("document", document)?;
            }
            CommandError::IdentityWrongDocument { expected, found } => {
                out.serialize_field("expected", expected)?;
                out.serialize_field("found", found)?;
            }
            CommandError::IdentityStaleRevision { expected, found } => {
                out.serialize_field("expected", expected)?;
                out.serialize_field("found", found)?;
            }
            CommandError::IdentityNoSuchMatch { node } => {
                out.serialize_field("node", node)?;
            }
            CommandError::MenuUnavailable => {}
            CommandError::InvalidMenuLabels {
                missing,
                unexpected,
            } => {
                out.serialize_field("missing", missing)?;
                out.serialize_field("unexpected", unexpected)?;
            }
            CommandError::MenuBuildFailed => {}
        } // End of the match over the variants' operands
        out.end()
    } // End of function serialize() for CommandError
}

impl CommandError {
    /// How many operand fields this variant writes, beside its code.
    fn operand_count(&self) -> usize {
        match self {
            CommandError::NoWorkspaceOpen
            | CommandError::MenuUnavailable
            | CommandError::MenuBuildFailed => 0,
            CommandError::ConfigDirNotFound { .. }
            | CommandError::NotADirectory { .. }
            | CommandError::UnknownDocument { .. }
            | CommandError::IdentityNoSuchMatch { .. } => 1,
            CommandError::Io { .. }
            | CommandError::NotUtf8 { .. }
            | CommandError::IdentityWrongDocument { .. }
            | CommandError::IdentityStaleRevision { .. }
            | CommandError::InvalidMenuLabels { .. } => 2,
        }
    } // End of function operand_count()
}

/// One instance of every [`CommandError`] variant.
///
/// Compiled only for tests, because nothing in production needs to enumerate
/// the codes — but `wire_contract.rs` does, to compare them against
/// `COMMAND_ERROR_CODES` in `src/lib/ipc/errors.ts`. It lives here rather than
/// inside a `mod tests` so both test modules can reach it, and so it sits
/// directly under the enum it enumerates.
///
/// **The list is mechanically exhaustive.** It used to be a hand-written list
/// whose only guard was the doc comment on [`CommandError::code`], so a variant
/// added to the enum *and* to `code()` but to neither this list nor the
/// TypeScript one passed every check — the review of Phase 1b-2a found that,
/// and `every_declared_variant_has_an_instance_in_the_enumeration` closes it by
/// reading this file's own `pub enum CommandError` block and asserting that
/// every variant declared there appears below. A variant that exists in the
/// enum and not here now fails `cargo test`, and because
/// `the_frontend_error_codes_are_exactly_the_rust_codes` compares this list
/// against `COMMAND_ERROR_CODES`, the same failure reaches the TypeScript side.
#[cfg(test)]
pub(crate) fn every_command_error() -> Vec<CommandError> {
    use espansoconfig_core::ContentRevision;
    vec![
        CommandError::NoWorkspaceOpen,
        CommandError::ConfigDirNotFound {
            candidates: vec![WirePath::new("/nowhere")],
        },
        CommandError::NotADirectory {
            path: WirePath::new("/nowhere/file.yml"),
        },
        CommandError::Io {
            path: WirePath::new("/nowhere/file.yml"),
            kind: "NotFound".to_owned(),
        },
        CommandError::NotUtf8 {
            path: WirePath::new("/nowhere/file.yml"),
            offset: 12,
        },
        CommandError::UnknownDocument { document: 7 },
        CommandError::IdentityWrongDocument {
            expected: 1,
            found: 2,
        },
        CommandError::IdentityStaleRevision {
            expected: ContentRevision::of_bytes(b"a").to_hex(),
            found: ContentRevision::of_bytes(b"b").to_hex(),
        },
        CommandError::IdentityNoSuchMatch { node: 3 },
        CommandError::MenuUnavailable,
        CommandError::InvalidMenuLabels {
            missing: vec!["quit".to_owned()],
            unexpected: vec!["renamed_last_week".to_owned()],
        },
        CommandError::MenuBuildFailed,
    ]
} // End of function every_command_error()

/// The variant name of one [`CommandError`], from its derived `Debug`.
///
/// `Debug` on an enum writes the variant name first, so the leading identifier
/// is the name. Used to compare instances against the names declared in this
/// file's source, which is how the enumeration above is kept exhaustive without
/// a macro or a second hand-written list.
#[cfg(test)]
fn variant_name(error: &CommandError) -> String {
    format!("{error:?}")
        .chars()
        .take_while(char::is_ascii_alphanumeric)
        .collect()
}

/// Every variant name declared by `pub enum CommandError` in this file.
///
/// Reads the source rather than any list a maintainer keeps in step, because a
/// list kept in step is exactly what the review found could fall out of step.
///
/// The reader itself lives in `crate::rust_source`, where fifteen other enum
/// declarations are read the same way to check the Rust-code dictionaries. One
/// reader rather than two: a second copy could disagree with this one about what
/// a variant declaration looks like, and only one of the two would be wrong in a
/// way anybody noticed. Phase 1b-2b's review is why it parses rather than scans
/// lines — `#[cfg(…)] Variant,` and `A, B,` are both valid declarations a line
/// scanner missed.
#[cfg(test)]
fn declared_variants() -> std::collections::BTreeSet<String> {
    let source = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/error.rs"))
        .expect("error.rs can read itself");
    crate::rust_source::declared_variants(&source, "CommandError")
} // End of function declared_variants()

/// The [`std::io::ErrorKind`] variant name of an I/O error.
///
/// The `Debug` rendering of an `ErrorKind` is its variant name — `NotFound`,
/// `PermissionDenied` — which is a code. The error's `Display` string is the
/// operating system's own message, in the operating system's own language, and
/// is deliberately never sent. The core's `WorkspaceError` uses the same rule,
/// so the two agree on what a `kind` operand means.
fn io_kind_name(error: &io::Error) -> String {
    format!("{:?}", error.kind())
}

impl From<IdentityError> for CommandError {
    /// Flattens the three identity refusals into three top-level codes.
    ///
    /// The `match` is exhaustive, so an identity refusal added to the core
    /// fails this crate's build rather than arriving as an unhandled shape.
    fn from(error: IdentityError) -> CommandError {
        match error {
            IdentityError::WrongDocument { expected, found } => {
                CommandError::IdentityWrongDocument {
                    expected: expected.get(),
                    found: found.get(),
                }
            }
            IdentityError::StaleRevision { expected, found } => {
                CommandError::IdentityStaleRevision {
                    expected: expected.to_hex(),
                    found: found.to_hex(),
                }
            }
            IdentityError::NoSuchMatch { node } => {
                CommandError::IdentityNoSuchMatch { node: node.get() }
            }
        }
    } // End of function from() for IdentityError
}

impl From<DiscoveryError> for CommandError {
    /// Exhaustive by construction, for the same reason as the impl above.
    fn from(error: DiscoveryError) -> CommandError {
        match error {
            DiscoveryError::ConfigDirNotFound { candidates } => CommandError::ConfigDirNotFound {
                candidates: candidates.into_iter().map(WirePath::from).collect(),
            },
            DiscoveryError::NotADirectory(path) => CommandError::NotADirectory {
                path: WirePath::from(path),
            },
            DiscoveryError::Io { path, source } => CommandError::Io {
                kind: io_kind_name(&source),
                path: WirePath::from(path),
            },
        }
    } // End of function from() for DiscoveryError
}

impl From<WorkspaceError> for CommandError {
    /// Exhaustive by construction, for the same reason as the impls above.
    fn from(error: WorkspaceError) -> CommandError {
        match error {
            WorkspaceError::Discovery(inner) => CommandError::from(inner),
            WorkspaceError::UnknownDocument { id } => {
                CommandError::UnknownDocument { document: id.get() }
            }
            WorkspaceError::Identity(inner) => CommandError::from(inner),
            WorkspaceError::Io { path, source } => CommandError::Io {
                kind: io_kind_name(&source),
                path: WirePath::from(path),
            },
            WorkspaceError::NotUtf8 { path, offset } => CommandError::NotUtf8 {
                path: WirePath::from(path),
                offset,
            },
        }
    } // End of function from() for WorkspaceError
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeSet;
    use std::path::PathBuf;

    use espansoconfig_core::discovery::DiscoveryError;
    use espansoconfig_core::model::IdentityError;
    use espansoconfig_core::workspace::WorkspaceError;
    use espansoconfig_core::{ContentRevision, DocumentId};
    use serde_json::Value;

    use super::{declared_variants, every_command_error, variant_name, CommandError};

    /// The enumeration holds one instance of every variant the enum declares.
    ///
    /// The review of Phase 1b-2a found that nothing checked this: a variant
    /// added to [`CommandError`] and to `code()` — both of which the compiler
    /// does force — could be omitted from `every_command_error()` *and* from
    /// `COMMAND_ERROR_CODES`, and every contract test would still pass because
    /// both compared sets omitted it. The expectation here is derived from the
    /// **declaration**, not from what the enumeration produced, which is the
    /// vacuous-audit corollary (`PROGRESS.md`, D2w) applied to an enum.
    #[test]
    fn every_declared_variant_has_an_instance_in_the_enumeration() {
        let declared = declared_variants();
        // Non-vacuity: a scanner that found nothing would agree with an empty
        // enumeration and prove nothing at all.
        assert!(
            declared.len() > 1,
            "the source scan found {} variants, so it is not reading the enum",
            declared.len()
        );
        let enumerated: BTreeSet<String> = every_command_error().iter().map(variant_name).collect();
        assert_eq!(
            declared, enumerated,
            "every_command_error() and the CommandError declaration disagree"
        );
    } // End of function every_declared_variant_has_an_instance_in_the_enumeration()

    /// A path no encoding can name still crosses as a typed error.
    ///
    /// The review's second High finding: `serde`'s own `PathBuf` serializer
    /// **fails** on a non-UTF-8 path, so before `WirePath` an `Io` or `NotUtf8`
    /// error carrying one would have reached the webview as the serializer's
    /// English prose instead of `{ code, operands }` — the one failure mode a
    /// typed error boundary cannot absorb, because the type that was supposed to
    /// carry the refusal is the type that failed. The premise is asserted first,
    /// so this cannot pass with the fix removed.
    #[test]
    #[cfg(unix)]
    fn a_non_utf8_path_crosses_as_a_code_and_operands() {
        use std::ffi::OsStr;
        use std::os::unix::ffi::OsStrExt;

        let mut path = PathBuf::from("/nowhere/match");
        path.push(OsStr::from_bytes(b"ba\xffse.yml"));
        assert!(
            serde_json::to_value(&path).is_err(),
            "the premise of this test is that a bare PathBuf cannot carry these bytes"
        );

        let error = CommandError::from(WorkspaceError::Io {
            path: path.clone(),
            source: std::io::Error::from(std::io::ErrorKind::PermissionDenied),
        });
        let json = serde_json::to_value(&error).expect("a command error must always serialize");
        assert_eq!(json["code"], "io");
        assert_eq!(json["kind"], "PermissionDenied");
        assert!(json["path"]
            .as_str()
            .expect("a path operand is a string")
            .contains('\u{fffd}'));

        let candidates = CommandError::from(DiscoveryError::ConfigDirNotFound {
            candidates: vec![path],
        });
        let json =
            serde_json::to_value(&candidates).expect("a list of paths must always serialize");
        assert_eq!(json["code"], "configDirNotFound");
        assert_eq!(json["candidates"].as_array().map(Vec::len), Some(1));
    } // End of function a_non_utf8_path_crosses_as_a_code_and_operands()

    /// The `code` field of a serialized error.
    fn code_of(error: &CommandError) -> String {
        let value = serde_json::to_value(error).expect("a command error must serialize");
        value
            .get("code")
            .and_then(Value::as_str)
            .expect("every serialized command error carries a code")
            .to_owned()
    }

    /// What is serialized as `code` is what [`CommandError::code`] returns.
    ///
    /// Trivially true of the impl as written, and kept anyway: it is what fires
    /// if someone reintroduces a literal into one arm of `serialize`, which is
    /// the exact mistake the hand-written impl exists to prevent.
    #[test]
    fn the_serialized_code_is_the_accessors_code() {
        for error in every_command_error() {
            assert_eq!(
                code_of(&error),
                error.code(),
                "the serialized code and CommandError::code() disagree for {error:?}"
            );
        }
    }

    /// No two variants share a code.
    ///
    /// A shared code would give two different conditions one dictionary entry
    /// and one message, which is the failure mode a `code` exists to prevent.
    #[test]
    fn no_two_variants_share_a_code() {
        let variants = every_command_error();
        let distinct: BTreeSet<&str> = variants.iter().map(CommandError::code).collect();
        assert_eq!(
            distinct.len(),
            variants.len(),
            "two CommandError variants serialize as the same code"
        );
    }

    /// A serialized error carries its code and its declared operands, and
    /// nothing else.
    ///
    /// The point is the *nothing else*: a field that crept in carrying a
    /// rendered message would pass a test that only checked the code.
    #[test]
    fn every_variant_serializes_as_a_code_plus_its_declared_operands() {
        let expected: Vec<(&str, Vec<&str>)> = vec![
            ("noWorkspaceOpen", vec![]),
            ("configDirNotFound", vec!["candidates"]),
            ("notADirectory", vec!["path"]),
            ("io", vec!["kind", "path"]),
            ("notUtf8", vec!["offset", "path"]),
            ("unknownDocument", vec!["document"]),
            ("identityWrongDocument", vec!["expected", "found"]),
            ("identityStaleRevision", vec!["expected", "found"]),
            ("identityNoSuchMatch", vec!["node"]),
            ("menuUnavailable", vec![]),
            ("invalidMenuLabels", vec!["missing", "unexpected"]),
            ("menuBuildFailed", vec![]),
        ];
        for (error, (code, operands)) in every_command_error().iter().zip(expected) {
            let value = serde_json::to_value(error).expect("a command error must serialize");
            let object = value.as_object().expect("an error is a JSON object");
            let mut keys: Vec<&str> = object.keys().map(String::as_str).collect();
            keys.retain(|key| *key != "code");
            keys.sort_unstable();
            assert_eq!(error.code(), code, "the expectation table is out of order");
            assert_eq!(
                keys, operands,
                "{code} does not carry exactly its declared operands"
            );
        } // End of the loop over the variants and their expected operands
    } // End of function every_variant_serializes_as_a_code_plus_its_declared_operands()

    /// An `io::Error`'s message never reaches the wire; its kind does.
    ///
    /// The concrete form of "codes, never prose": the sentence below is what an
    /// operating system would supply, in a language nobody chose, and it must
    /// not appear in the JSON.
    #[test]
    fn an_io_errors_message_is_not_on_the_wire_but_its_kind_is() {
        let sentence = "the developer-facing sentence that must not be sent";
        let source = std::io::Error::new(std::io::ErrorKind::PermissionDenied, sentence);
        let error = CommandError::from(WorkspaceError::Io {
            path: PathBuf::from("/nowhere/file.yml"),
            source,
        });
        let json = serde_json::to_string(&error).expect("a command error must serialize");
        assert!(
            !json.contains(sentence),
            "the io::Error's Display string reached the wire: {json}"
        );
        assert!(
            json.contains("PermissionDenied"),
            "the io::ErrorKind name is the code and must be sent: {json}"
        );
    } // End of function an_io_errors_message_is_not_on_the_wire_but_its_kind_is()

    /// Every core error condition maps onto exactly one command code.
    ///
    /// The expectation is written from the **core's** enumeration of its own
    /// failure modes rather than from what the mapper produced, which is the
    /// difference between a check and a restatement (`PROGRESS.md`, the vacuous
    /// audit corollary). The mapping's completeness in the other direction is
    /// held by the compiler: each `From` impl matches exhaustively, so a
    /// variant added to the core fails this crate's build.
    #[test]
    fn every_core_error_condition_maps_to_one_command_code() {
        let discovery: Vec<(DiscoveryError, &str)> = vec![
            (
                DiscoveryError::ConfigDirNotFound {
                    candidates: vec![PathBuf::from("/nowhere")],
                },
                "configDirNotFound",
            ),
            (
                DiscoveryError::NotADirectory(PathBuf::from("/nowhere")),
                "notADirectory",
            ),
            (
                DiscoveryError::Io {
                    path: PathBuf::from("/nowhere"),
                    source: std::io::Error::from(std::io::ErrorKind::NotFound),
                },
                "io",
            ),
        ];
        for (error, code) in discovery {
            assert_eq!(CommandError::from(error).code(), code);
        }

        let identity: Vec<(IdentityError, &str)> = vec![
            (
                IdentityError::WrongDocument {
                    expected: DocumentId(1),
                    found: DocumentId(2),
                },
                "identityWrongDocument",
            ),
            (
                IdentityError::StaleRevision {
                    expected: ContentRevision::of_bytes(b"a"),
                    found: ContentRevision::of_bytes(b"b"),
                },
                "identityStaleRevision",
            ),
            (
                IdentityError::NoSuchMatch { node: node_zero() },
                "identityNoSuchMatch",
            ),
        ];
        for (error, code) in identity {
            assert_eq!(CommandError::from(error).code(), code);
        }

        let workspace: Vec<(WorkspaceError, &str)> = vec![
            (
                WorkspaceError::Discovery(DiscoveryError::NotADirectory(PathBuf::from("/nowhere"))),
                "notADirectory",
            ),
            (
                WorkspaceError::UnknownDocument { id: DocumentId(9) },
                "unknownDocument",
            ),
            (
                WorkspaceError::Identity(IdentityError::StaleRevision {
                    expected: ContentRevision::of_bytes(b"a"),
                    found: ContentRevision::of_bytes(b"b"),
                }),
                "identityStaleRevision",
            ),
            (
                WorkspaceError::Io {
                    path: PathBuf::from("/nowhere"),
                    source: std::io::Error::from(std::io::ErrorKind::NotFound),
                },
                "io",
            ),
            (
                WorkspaceError::NotUtf8 {
                    path: PathBuf::from("/nowhere"),
                    offset: 3,
                },
                "notUtf8",
            ),
        ];
        for (error, code) in workspace {
            assert_eq!(CommandError::from(error).code(), code);
        }
    } // End of function every_core_error_condition_maps_to_one_command_code()

    /// A `NodeId` for the identity fixture above.
    ///
    /// `NodeId` cannot be constructed outside the core, so one is taken from a
    /// projection of a one-line document rather than invented.
    fn node_zero() -> espansoconfig_core::NodeId {
        let index = espansoconfig_core::SyntaxIndex::parse("a: b").expect("a trivial parse");
        index.nodes()[0].id
    }
}
