//! The bulk option edit's planning — Phase 3-10.
//!
//! **Bounded core planning for the per-file bulk coordinator** in
//! `src-tauri/src/commands.rs` (`docs/decisions/3-split-notes.md` step 3-10,
//! rulings 19–22). It turns *these seven-or-fewer option intents, applied to
//! these snippets of one file* into **one** [`DocumentEdit`] batch for that file,
//! or refuses by name. It writes nothing, takes no lock and knows nothing about
//! consent: the coordinator hands the batch to the one save transaction, once
//! per file.
//!
//! # The surface is the seven options, and the type says so
//!
//! [`BulkOption`] has exactly the seven variants ruling 20 allows — `word`,
//! `left_word`, `right_word`, `propagate_case`, `uppercase_style`, `force_mode`,
//! `force_clipboard` — so a request naming `paragraph`, `anchor`, content, a
//! trigger or a variable does not deserialize at all. [`BulkValue`] has no
//! *unchanged* arm: an untouched control emits nothing, so a change that says
//! "leave it" is not expressible here.
//!
//! # A value is source text, written verbatim (D2u)
//!
//! What a person types into an option control is the **source text** the file
//! should hold — `word: true`, not the string `"true"`. Until Phase 4-1 the
//! single-match planner treated a drafted option as a string and let the codec
//! quote it (`word: 'true'`) — A1, fixed in 4-1, where the planner and creation
//! adopted this module's contract for the same seven options plus `paragraph`
//! ([`MatchField::PLAIN_SOURCE_OPTIONS`]). So a bulk `Set` is written **verbatim
//! as a plain scalar** ([`crate::patch::ScalarEdit::plain_source`],
//! [`crate::patch::EntryValue::PlainSource`]), and the engine verifies that the
//! written scalar is plain and reads back as exactly that text. A text that
//! cannot be written that way — it would need quotes, holds a line break, a
//! comment, an indicator — is refused up front by [`check_bulk_changes`]
//! ([`BulkPlanError::OptionNotPlainSource`]), never quoted. Equality is by
//! source spelling too: a snippet already holding the plain text is left
//! alone, and one holding `'true'` is rewritten to `true`.
//!
//! # One batch per file, derived by the single-match planner
//!
//! [`plan_bulk_option_edits`] builds one [`MatchDraft`] per selected snippet
//! holding only the options that snippet does not already spell as requested,
//! hands it to [`plan_match_edits`], and turns every value that planner writes
//! into plain source text, concatenating the batches. Since Phase 4-1 the
//! planner already writes the seven options as plain source, so that turn is an
//! identity for them; it is kept as the statement that nothing else reaches a
//! bulk batch as a logical string. The planner's structural
//! rules apply unchanged — the ordered insertion group for several absent
//! options, the hazard gate, the closed-surface and independence audits. A
//! snippet whose option decodes to the requested text but is spelled
//! differently gets a plain-source rewrite of that one value, planned here
//! directly — the same rewrite the single-match planner derives since Phase
//! 4-1.
//! The concatenation is not re-audited here: the batches name disjoint match
//! mappings, and [`crate::patch::apply_edits`] refuses any overlap and reparses
//! and verifies the whole candidate before a byte is written. Nothing in the type
//! system forces the batches to be disjoint; `apply_edits` is what refuses them
//! if they are not.

use std::collections::BTreeSet;
use std::fmt;

use serde::{Deserialize, Serialize};

use crate::draft::error::DraftError;
use crate::draft::field::DraftField;
use crate::draft::match_draft::{MatchDraft, MatchField};
use crate::draft::plan::plan_match_edits;
use crate::model::{DocumentView, IdentityError, MatchId, MatchView, ScalarView};
use crate::patch::{DocumentEdit, EntryValue, FieldInsertGroup, ScalarEdit};
use crate::syntax::SyntaxIndex;
use crate::{DocumentId, ScalarStyle, SourceDocument};

/// One of the seven match options a bulk edit may write (ruling 20).
///
/// **It serializes as the espanso key**, for [`MatchField`]'s reason: a screen
/// that names it shows espanso's own spelling, so it owes no dictionary entry.
/// `every_bulk_option_serializes_as_its_espanso_key` in `tests/draft_bulk.rs`
/// pins the two spellings against each other.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BulkOption {
    /// `word`.
    Word,
    /// `left_word`.
    LeftWord,
    /// `right_word`.
    RightWord,
    /// `propagate_case`.
    PropagateCase,
    /// `uppercase_style`.
    UppercaseStyle,
    /// `force_mode`.
    ForceMode,
    /// `force_clipboard`.
    ForceClipboard,
}

impl BulkOption {
    /// Every option a bulk edit may write, in [`MatchField::ALL`]'s order.
    pub const ALL: [BulkOption; 7] = [
        BulkOption::Word,
        BulkOption::LeftWord,
        BulkOption::RightWord,
        BulkOption::PropagateCase,
        BulkOption::UppercaseStyle,
        BulkOption::ForceMode,
        BulkOption::ForceClipboard,
    ];

    /// The match field this option is written as.
    pub fn field(self) -> MatchField {
        match self {
            BulkOption::Word => MatchField::Word,
            BulkOption::LeftWord => MatchField::LeftWord,
            BulkOption::RightWord => MatchField::RightWord,
            BulkOption::PropagateCase => MatchField::PropagateCase,
            BulkOption::UppercaseStyle => MatchField::UppercaseStyle,
            BulkOption::ForceMode => MatchField::ForceMode,
            BulkOption::ForceClipboard => MatchField::ForceClipboard,
        }
    }

    /// The espanso key this option is written under.
    pub fn key(self) -> &'static str {
        self.field().key()
    }
} // End of impl BulkOption

/// What a bulk edit asks of one option: a logical value, or its removal.
///
/// Externally tagged with the variant names verbatim (`{"Set": "…"}`,
/// `"Remove"`), exactly as [`DraftField`] is, so a casing slip or a `null` is a
/// deserialization error rather than an unintended mutation. **There is no
/// `Unchanged` arm**: an option the person did not touch is absent from the
/// request, never present with a *leave it* value.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum BulkValue {
    /// The option should hold this **source text**, written verbatim as a
    /// plain scalar (D2u). A snippet that already holds exactly this plain
    /// text derives no edit; a text that cannot be written as a plain scalar
    /// is refused ([`BulkPlanError::OptionNotPlainSource`]).
    Set(String),
    /// The option should be absent. A snippet that already lacks it derives no
    /// edit.
    Remove,
}

impl BulkValue {
    /// The single-match draft intent this value is.
    fn draft_field(&self) -> DraftField<String> {
        match self {
            BulkValue::Set(text) => DraftField::Set(text.clone()),
            BulkValue::Remove => DraftField::Remove,
        }
    }
}

/// One option intent of a bulk edit, applied to every selected snippet.
///
/// `deny_unknown_fields`, so a misspelled property — or a `force` flag, which
/// this design deliberately has none of — is refused on the wire rather than
/// ignored.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BulkOptionChange {
    /// The option to write.
    pub option: BulkOption,
    /// What it should become.
    pub value: BulkValue,
}

/// Why a bulk edit, or one file of it, would not be planned.
///
/// **Diagnostics, not prose**, exactly as [`DraftError`] is: every string a user
/// reads is built in the frontend from `code.bulkPlanError.*`. Every variant is a
/// struct variant, including those with no operands, so each crosses the wire
/// as a one-key object. No variant carries a byte of the document: positions
/// in the request, option keys and the core's own nested refusals only.
///
/// The first five are about the **request as a whole** and refuse it before
/// any file is read; the last four are about **one file** and are that file's
/// preflight blocker.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum BulkPlanError {
    /// The request names no option change, so there is nothing to apply.
    NoOptionChanges {},
    /// The request names the same option twice, so two intents would compete
    /// for one key.
    OptionRepeated {
        /// The repeated option.
        option: BulkOption,
    },
    /// The text requested for an option cannot be written as one plain scalar
    /// holding exactly those bytes — it would need quotes, or holds a line
    /// break, a comment or a YAML indicator — so it is refused rather than
    /// quoted (Phase 3-10's review). The text itself is not carried.
    OptionNotPlainSource {
        /// The option whose text was refused.
        option: BulkOption,
    },
    /// The request names no file to apply the changes to.
    NoFiles {},
    /// The request names the same file twice — as two applied files, or as an
    /// applied file and an excluded one.
    DocumentRepeated {
        /// The repeated document.
        document: DocumentId,
    },
    /// A file of the request selects no snippet.
    NoMatches {},
    /// A file of the request selects the same snippet twice.
    MatchRepeated {
        /// The position of the second occurrence in that file's selection.
        index: usize,
    },
    /// A selected snippet's identity does not resolve in the projection the
    /// file's base revision names.
    Identity {
        /// The snippet's position in that file's selection.
        index: usize,
        /// The read model's own refusal.
        error: IdentityError,
    },
    /// The single-match planner refused a selected snippet.
    Draft {
        /// The snippet's position in that file's selection.
        index: usize,
        /// The planner's own refusal.
        error: DraftError,
    },
}

impl fmt::Display for BulkPlanError {
    /// A developer rendering, for logs and test output. Never shown to a user.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BulkPlanError::NoOptionChanges {} => formatter.write_str("no option changes"),
            BulkPlanError::OptionRepeated { option } => {
                write!(formatter, "option {} repeated", option.key())
            }
            BulkPlanError::OptionNotPlainSource { option } => {
                write!(
                    formatter,
                    "option {} is not writable as plain source",
                    option.key()
                )
            }
            BulkPlanError::NoFiles {} => formatter.write_str("no files"),
            BulkPlanError::DocumentRepeated { document } => {
                write!(formatter, "document {} repeated", document.0)
            }
            BulkPlanError::NoMatches {} => formatter.write_str("no matches selected"),
            BulkPlanError::MatchRepeated { index } => {
                write!(formatter, "selection item {index} repeated")
            }
            BulkPlanError::Identity { index, error } => {
                write!(formatter, "selection item {index}: {error}")
            }
            BulkPlanError::Draft { index, error } => {
                write!(formatter, "selection item {index}: {error}")
            }
        }
    } // End of function fmt() for BulkPlanError
}

impl std::error::Error for BulkPlanError {}

/// Refuses a request's option changes when there are none, when one option is
/// named twice, or when a requested text cannot be written as plain source.
///
/// # Errors
///
/// [`BulkPlanError::NoOptionChanges`], [`BulkPlanError::OptionRepeated`] and
/// [`BulkPlanError::OptionNotPlainSource`].
pub fn check_bulk_changes(changes: &[BulkOptionChange]) -> Result<(), BulkPlanError> {
    if changes.is_empty() {
        return Err(BulkPlanError::NoOptionChanges {});
    }
    let mut seen = BTreeSet::new();
    for change in changes {
        if !seen.insert(change.option) {
            return Err(BulkPlanError::OptionRepeated {
                option: change.option,
            });
        }
        if let BulkValue::Set(text) = &change.value {
            if !is_plain_source(text) {
                return Err(BulkPlanError::OptionNotPlainSource {
                    option: change.option,
                });
            }
        }
    } // End of the loop over the requested changes
    Ok(())
} // End of function check_bulk_changes()

/// Whether `text` can be written verbatim as the value of a block-mapping
/// entry and read back as one plain scalar whose bytes and decoded value are
/// exactly `text`.
///
/// Decided by the parser rather than by a list of rules: `text` is written
/// after a key in a one-line probe document, and the probe must parse with a
/// plain scalar spanning exactly those bytes. A line break, a comment, a quote,
/// a flow indicator, an anchor, a tag or an alias fails it. It is a statement
/// about the probe; the engine re-checks the same property on the real
/// candidate ([`crate::patch::VerificationFailure::PlainSourceNotReadBack`]).
pub fn is_plain_source(text: &str) -> bool {
    if text.is_empty() || text.contains(['\n', '\r']) {
        return false;
    }
    const KEY: &str = "probe: ";
    let probe = format!("{KEY}{text}\n");
    let Ok(index) = SyntaxIndex::parse(&probe) else {
        return false;
    };
    let start = KEY.len();
    let end = start + text.len();
    index.nodes().iter().any(|node| {
        node.span.start == start
            && node.span.end == end
            && node.scalar.as_ref().is_some_and(|scalar| {
                scalar.presentation.style == ScalarStyle::Plain && scalar.value == text
            })
    })
} // End of function is_plain_source()

/// The projected scalar one option holds in a snippet, if it holds one.
fn option_view(found: &MatchView, option: BulkOption) -> Option<&ScalarView> {
    let options = &found.options;
    match option {
        BulkOption::Word => options.word.as_ref(),
        BulkOption::LeftWord => options.left_word.as_ref(),
        BulkOption::RightWord => options.right_word.as_ref(),
        BulkOption::PropagateCase => options.propagate_case.as_ref(),
        BulkOption::UppercaseStyle => options.uppercase_style.as_ref(),
        BulkOption::ForceMode => options.force_mode.as_ref(),
        BulkOption::ForceClipboard => options.force_clipboard.as_ref(),
    }
} // End of function option_view()

/// How one option is written in one snippet: absent, or present and spelled
/// exactly so (Phase 3-11-1, ruling 20).
///
/// **Presence and source spelling, never a decoded value.** `word: true`,
/// `word: 'true'` and `word: "true"` decode to the same text and are three
/// different spellings here, because [`ScalarView::text`] is the decoder's
/// output and a comparison over it would call them equal. The spelling is cut
/// out of the document's text in Rust, so no caller ever slices a byte span out
/// of a JavaScript string. For a block scalar it runs from the start of the
/// `|`/`>` header to the end of the body, because the projected span is the
/// body alone and `|` and `>` over one body are two spellings (Phase 3-11-1's
/// review).
///
/// A display fact, not an intent: nothing here travels back into a bulk
/// request, and a *Mixed* state built from several of these is never sent.
///
/// Every variant is a struct variant, so each crosses as a one-key object.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum OptionSpelling {
    /// The snippet does not write this option.
    Absent {},
    /// The snippet writes this option once, as one scalar spelled exactly
    /// `source` — quotes, and a block scalar's whole header line (indicator,
    /// chomping and indentation indicators, anything after them on that line)
    /// with its body.
    Written {
        /// The scalar's bytes as the file holds them.
        source: String,
    },
    /// The snippet writes this option, but not as one scalar the projection
    /// models: the value is a collection or an alias, or the key is repeated.
    /// Its bytes are not carried; the entry stays in the file as written.
    NotOneScalar {},
}

/// How each of the seven bulk options is written in one snippet
/// (Phase 3-11-1). One field per [`BulkOption`], named by its espanso key.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct BulkOptionSpellings {
    /// `word`.
    pub word: OptionSpelling,
    /// `left_word`.
    pub left_word: OptionSpelling,
    /// `right_word`.
    pub right_word: OptionSpelling,
    /// `propagate_case`.
    pub propagate_case: OptionSpelling,
    /// `uppercase_style`.
    pub uppercase_style: OptionSpelling,
    /// `force_mode`.
    pub force_mode: OptionSpelling,
    /// `force_clipboard`.
    pub force_clipboard: OptionSpelling,
}

impl BulkOptionSpellings {
    /// The spelling of one option.
    pub fn of(&self, option: BulkOption) -> &OptionSpelling {
        match option {
            BulkOption::Word => &self.word,
            BulkOption::LeftWord => &self.left_word,
            BulkOption::RightWord => &self.right_word,
            BulkOption::PropagateCase => &self.propagate_case,
            BulkOption::UppercaseStyle => &self.uppercase_style,
            BulkOption::ForceMode => &self.force_mode,
            BulkOption::ForceClipboard => &self.force_clipboard,
        }
    }
} // End of impl BulkOptionSpellings

/// The bytes one projected scalar is written as, header included.
///
/// A flow or plain scalar's projected span is its whole token, quotes included.
/// A block scalar's projected span is its body only
/// (`SyntaxIndex::push_scalar` publishes the layout's content span), so its
/// spelling is widened back to the header's start, read off the syntax index.
/// `None` when the index cannot vouch for the envelope.
fn scalar_spelling<'a>(
    source: &'a str,
    syntax: Option<&SyntaxIndex>,
    scalar: &ScalarView,
) -> Option<&'a str> {
    if !scalar.style.is_block() {
        return scalar.span.slice(source);
    }
    let presentation = syntax?.node(scalar.node)?.scalar.as_ref()?.presentation;
    if !presentation.style.is_block() || presentation.header_span.start > scalar.span.end {
        return None;
    }
    source.get(presentation.header_span.start..scalar.span.end)
} // End of function scalar_spelling()

/// How one option is written in one snippet of the document `source` holds.
fn option_spelling(
    source: &str,
    syntax: Option<&SyntaxIndex>,
    found: &MatchView,
    option: BulkOption,
) -> OptionSpelling {
    let key = option.key();
    // An unmodelled entry under this key — a collection, an alias, or a second
    // occurrence of the key — means the snippet does not write the option as
    // one scalar, whatever the first occurrence holds.
    let unmodelled = found
        .unknown_entries
        .iter()
        .any(|entry| entry.key.as_deref() == Some(key));
    if unmodelled {
        return OptionSpelling::NotOneScalar {};
    }
    match option_view(found, option) {
        None => OptionSpelling::Absent {},
        Some(scalar) => match scalar_spelling(source, syntax, scalar) {
            Some(spelled) => OptionSpelling::Written {
                source: spelled.to_owned(),
            },
            // A span that does not cut the text it was projected from is a
            // defect, and it is reported as the state that claims least.
            None => OptionSpelling::NotOneScalar {},
        },
    }
} // End of function option_spelling()

/// How each of the seven bulk options is written in one snippet.
///
/// `document` is the snapshot `found` was projected from — its text, and its
/// syntax index for a block scalar's header. Nothing in the type ties the two
/// together; the caller passes one snapshot and one of its matches. It reads
/// nothing else and writes nothing.
pub fn option_spellings(document: &SourceDocument, found: &MatchView) -> BulkOptionSpellings {
    let source = document.source.as_str();
    let syntax = document.parse.syntax();
    let spell = |option| option_spelling(source, syntax, found, option);
    BulkOptionSpellings {
        word: spell(BulkOption::Word),
        left_word: spell(BulkOption::LeftWord),
        right_word: spell(BulkOption::RightWord),
        propagate_case: spell(BulkOption::PropagateCase),
        uppercase_style: spell(BulkOption::UppercaseStyle),
        force_mode: spell(BulkOption::ForceMode),
        force_clipboard: spell(BulkOption::ForceClipboard),
    }
} // End of function option_spellings()

/// Rewrites every value the single-match planner writes into plain source
/// text: a scalar rewrite becomes [`ScalarEdit::plain_source`], and an
/// insertion becomes a [`FieldInsertGroup`] of [`EntryValue::PlainSource`]
/// entries. A removal passes through. The draft holds only option fields, so
/// the planner emits nothing else; any other edit also passes through
/// unchanged, and the engine's verification is what judges it.
fn as_plain_source(edit: DocumentEdit) -> DocumentEdit {
    match edit {
        DocumentEdit::Scalar(scalar) => DocumentEdit::Scalar(ScalarEdit::plain_source(
            scalar.path().clone(),
            scalar.value(),
        )),
        DocumentEdit::InsertField(insert) => FieldInsertGroup::typed(
            insert.mapping().clone(),
            insert.sibling().map(str::to_owned),
            vec![(
                insert.key().to_owned(),
                EntryValue::PlainSource(insert.value().to_owned()),
            )],
        )
        .map_or(
            DocumentEdit::InsertField(insert),
            DocumentEdit::InsertFields,
        ),
        DocumentEdit::InsertFields(group) => {
            let entries = group
                .entries()
                .iter()
                .map(|(key, value)| {
                    let value = match value {
                        EntryValue::Scalar(text) => EntryValue::PlainSource(text.clone()),
                        other => other.clone(),
                    };
                    (key.clone(), value)
                })
                .collect();
            FieldInsertGroup::typed(
                group.mapping().clone(),
                group.sibling().map(str::to_owned),
                entries,
            )
            .map_or(
                DocumentEdit::InsertFields(group),
                DocumentEdit::InsertFields,
            )
        }
        other => other,
    }
} // End of function as_plain_source()

/// Refuses a request's file list when it is empty, or when one document is
/// named twice across the applied and the excluded files.
///
/// # Errors
///
/// [`BulkPlanError::NoFiles`] when `applied` is empty, and
/// [`BulkPlanError::DocumentRepeated`] for the first repetition in `applied`
/// followed by `excluded`.
pub fn check_bulk_documents(
    applied: &[DocumentId],
    excluded: &[DocumentId],
) -> Result<(), BulkPlanError> {
    if applied.is_empty() {
        return Err(BulkPlanError::NoFiles {});
    }
    let mut seen = BTreeSet::new();
    for document in applied.iter().chain(excluded) {
        if !seen.insert(*document) {
            return Err(BulkPlanError::DocumentRepeated {
                document: *document,
            });
        }
    }
    Ok(())
} // End of function check_bulk_documents()

/// Derives the one batch that applies `changes` to every snippet `matches`
/// names in the document `view` projects from `source`, or refuses by name.
///
/// `source` is the text `view` was projected from; it is read only to compare
/// an option's existing spelling with the requested text. Nothing in the type
/// ties the two together — the caller passes one snapshot's text and view.
///
/// The snippets are planned in selection order and their batches concatenated;
/// the order decides nothing about the result, because the patch engine plans
/// against the original index and splices from the highest offset downwards.
/// A snippet that already holds every requested value derives no edit, so the
/// whole batch may be empty — a file that is *already unchanged* — and the
/// caller still hands it to the save transaction, which checks the revision
/// under the lock and answers `committed: false`.
///
/// # Errors
///
/// [`check_bulk_changes`]'s refusals; [`BulkPlanError::NoMatches`] and
/// [`BulkPlanError::MatchRepeated`] for the selection; and, per snippet,
/// [`BulkPlanError::Identity`] and [`BulkPlanError::Draft`] carrying the index
/// in the selection and the core's own refusal.
pub fn plan_bulk_option_edits(
    source: &str,
    view: &DocumentView,
    matches: &[MatchId],
    changes: &[BulkOptionChange],
) -> Result<Vec<DocumentEdit>, BulkPlanError> {
    check_bulk_changes(changes)?;
    if matches.is_empty() {
        return Err(BulkPlanError::NoMatches {});
    }
    let mut seen = BTreeSet::new();
    for (index, id) in matches.iter().enumerate() {
        if !seen.insert(*id) {
            return Err(BulkPlanError::MatchRepeated { index });
        }
    }
    let mut edits = Vec::new();
    for (index, id) in matches.iter().enumerate() {
        let found = view
            .match_by_id(*id)
            .map_err(|error| BulkPlanError::Identity { index, error })?;
        let mut draft = MatchDraft::new();
        for change in changes {
            let held = option_view(found, change.option);
            match (&change.value, held) {
                // Already spelled exactly as requested: nothing to write.
                (BulkValue::Set(text), Some(scalar))
                    if scalar.style == ScalarStyle::Plain
                        && scalar.span.slice(source) == Some(text.as_str()) => {}
                // The same decoded text in another spelling (`'true'` for
                // `true`): the one value is rewritten here, in place — the
                // rewrite the single-match planner also derives since Phase 4-1.
                (BulkValue::Set(text), Some(scalar)) if scalar.text == *text => {
                    let path = found
                        .path
                        .as_ref()
                        .ok_or(BulkPlanError::Draft {
                            index,
                            error: DraftError::MatchHasNoPath {},
                        })?
                        .clone()
                        .with_key(change.option.key());
                    edits.push(DocumentEdit::Scalar(ScalarEdit::plain_source(path, text)));
                }
                (value, _) => *draft.field_mut(change.option.field()) = value.draft_field(),
            }
        } // End of the loop over the requested changes for this snippet
        let planned = plan_match_edits(found, &draft)
            .map_err(|error| BulkPlanError::Draft { index, error })?;
        edits.extend(planned.into_iter().map(as_plain_source));
    } // End of the loop over the selected snippets
    Ok(edits)
} // End of function plan_bulk_option_edits()
