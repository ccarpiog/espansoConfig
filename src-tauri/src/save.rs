//! What a mutating command answers with — the `Ok` half of a save.
//!
//! Plan section 6.4 sketches `SaveResult { Saved{revision, match_id},
//! Conflict{disk_revision, disk, base, draft} }`. That shape is a **match
//! draft's**, and Phase 2b-2a deliberately does not build it: `move_match` has no
//! draft, `save_raw_document` will have no match, and a result type shaped like
//! one operation is a result type every other operation has to work around. What
//! is here is **document-level** — three outcomes of *a save*, with the parts an
//! operation happens to have carried as fields it may leave empty.
//!
//! `docs/decisions/2b-2a-notes.md` records the deviations, and the one worth
//! naming here is `base`: the plan lists it and this type omits it. The frontend
//! already holds what it opened — that is the whole meaning of "base" — so
//! sending it back would be the application quoting the caller to itself.
//!
//! # Three outcomes in the `Ok` channel, and everything else an `Err`
//!
//! A **refusal is not an error.** The semantic gate declining to write is the
//! expected second half of a save that found something: the caller shows the
//! findings, the user says yes, the caller calls again with an
//! [`espansoconfig_core::persist::Acknowledgement`]. Filing that under `Err`
//! would make the ordinary path an exception. A **conflict** is the same shape:
//! the file moved on, the caller reloads and tries again. Everything left —
//! a read-only document, an unpatchable candidate, a filesystem that refused —
//! is [`CommandError`], and the save's own typed failure travels inside
//! [`crate::error::CommandError::SaveFailed`] whole.
//!
//! # The wire convention, chosen rather than drifted into
//!
//! **Flat**, like [`CommandError`]: one `outcome` discriminant plus the operands
//! that outcome declares. Not the core's externally tagged convention, and the
//! reason is what this type *is*. Phase 2b-1 settled that the core writes its own
//! errors externally tagged and that a frontend wanting flat top-level codes
//! **builds a shell type the way `CommandError` already does**
//! (`docs/decisions/2b-1-notes.md` section 1.2). This is that shell type. It
//! lives beside `CommandError` on the same boundary, it is switched on the same
//! way, and one boundary spelling its two discriminants two different ways would
//! be the drift both conventions exist to prevent.
//!
//! What it carries is **not** reshaped: a [`Finding`], a [`SaveVerdict`], a
//! [`PresentationNote`] and a [`DocumentView`] all cross exactly as the core
//! writes them. The shell is flat; the cargo keeps its own convention, which is
//! precisely the arrangement `CommandError` has held since Phase 1b-2a.

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

use espansoconfig_core::model::{DocumentView, MatchId};
use espansoconfig_core::patch::PresentationNote;
use espansoconfig_core::persist::SaveVerdict;
use espansoconfig_core::validate::Finding;
use espansoconfig_core::ContentRevision;

/// How one save ended.
///
/// Serializes as `{ "outcome": …, … operands }`.
#[derive(Debug)]
pub enum SaveResult {
    /// The save ran to the end: both gates passed and the transaction returned
    /// facts.
    ///
    /// **It does not say the file is now what the caller wanted, and no string
    /// built on it may.** The lock excludes only this process's cooperating
    /// writers, so vim, espanso or a sync agent can replace the file between the
    /// transaction's last read and this value reaching a screen.
    Saved {
        /// The revision the file held when the transaction last looked at it.
        ///
        /// The caller's new base revision. On a commit it is the hash of the
        /// bytes read back **after** the rename; on a skipped commit it is the
        /// hash of a second read taken under the lock.
        revision: ContentRevision,
        /// Whether the file was actually rewritten.
        ///
        /// **`false` is a success**, not a failure: a candidate byte-identical
        /// to what the file already held is not written, because every rename
        /// installs a new inode and drops eight classes of metadata for nothing.
        /// Both gates still ran.
        committed: bool,
        /// Presentation changes the patch had to make, for the caller to surface
        /// (plan section 6.2: never silently normalise).
        ///
        /// Empty for a move — a move copies the item's own bytes verbatim and
        /// re-encodes no scalar — and the field is here because this type is
        /// operation-neutral, not because `move_match` fills it.
        notes: Vec<PresentationNote>,
        /// Whether this save wrote a pre-save copy of the file.
        ///
        /// **`false` is a success**, for four documented reasons: the caller
        /// asked for no backups, nothing was rewritten, this session had already
        /// copied this file, or the save was refused (in which case there is no
        /// `Saved` at all). A `true` is **not** a promise that the file is
        /// recoverable — retention is ten sessions — and no string built on this
        /// field may say otherwise.
        ///
        /// The [`espansoconfig_core::persist::BackupRecord`] itself is
        /// deliberately not carried: it names a path, and *reveal backups in
        /// Finder* is Phase 2c's screen rather than this phase's operand.
        backup_taken: bool,
        /// The moved, edited or created match's identity **in the new
        /// revision**, when the operation had one.
        ///
        /// **Every [`MatchId`] the caller held is stale the moment a save
        /// commits**, because an identity carries the revision it was minted
        /// from. So a command that acted on one match answers with where that
        /// match is now, rather than leaving the caller to guess that its old
        /// identity still resolves — it does not, and `get_match` says so with
        /// `identityStaleRevision`.
        ///
        /// `None` in three cases, and each is a fact rather than a failure: the
        /// operation had no single match (a whole-document write), the commit was
        /// skipped so no new revision exists to mint an identity in, or the
        /// document changed again between the commit and the re-read, so the
        /// position the move wrote to no longer holds what was written there.
        /// A caller that gets `None` re-reads the document.
        moved: Option<MatchId>,
    },
    /// The file did not hold what the caller believed it held, and **nothing was
    /// written**.
    ///
    /// # The honesty rule, and why there are two revisions here
    ///
    /// [`espansoconfig_core::persist::save_document`] reports this as
    /// `SaveError::RevisionMismatch { path, expected, found }` and hands back
    /// **no bytes**. So the command layer re-reads the file to describe the disk
    /// side — and that read happens **after the lock is released**, which makes
    /// it a *different observation* from the one that caused the refusal.
    ///
    /// [`SaveResult::Conflict::found`] is the revision the transaction saw under
    /// the lock: the bytes that refused the save.
    /// [`SaveResult::Conflict::disk_revision`] is a **fresh read taken
    /// afterwards**. They are usually equal and they need not be: when they
    /// differ, the file changed again in between, and neither this application
    /// nor any string it shows may present the two as descriptions of the same
    /// bytes.
    Conflict {
        /// The revision the caller based its request on.
        expected: ContentRevision,
        /// The revision the locked read found — **the bytes that caused the
        /// refusal**. Nothing was written against them.
        found: ContentRevision,
        /// The revision of the **fresh read**, taken after the lock was released.
        ///
        /// Equal to [`SaveResult::Conflict::disk`]'s own `revision`, and stated
        /// at the top level on purpose: it is the value that has to sit beside
        /// [`SaveResult::Conflict::found`] for the two to be compared without
        /// descending into a projection. A caller that finds them different is
        /// looking at a file that moved twice.
        disk_revision: ContentRevision,
        /// The projection of that fresh read.
        ///
        /// What the file holds now, as far as a read taken after the refusal can
        /// say. The workspace's cache holds the same projection, so a later
        /// `get_document` agrees with this value rather than with the parse the
        /// caller was editing against.
        ///
        /// **Boxed.** A [`DocumentView`] is by far the largest value this enum
        /// carries, and an unboxed one would make every `Saved` — the common
        /// outcome — as wide as the rare conflict. `Box<T>` serializes as `T`, so
        /// the wire shape is unaffected.
        disk: Box<DocumentView>,
    },
    /// The semantic gate refused, and **nothing was written**.
    ///
    /// The expected, actionable second half of a save: show the findings, and —
    /// if the user says so, and only for the ones that can be acknowledged at all
    /// — call again with an acknowledgement built from exactly these.
    Refused {
        /// Which arm of the policy refused.
        verdict: SaveVerdict,
        /// **Every** finding the candidate produced, of both classes, in the
        /// gate's own order.
        ///
        /// All of them rather than only the blocking ones, because the caller
        /// that shows this list is the caller that hands it back.
        findings: Vec<Finding>,
    },
} // End of enum SaveResult

impl SaveResult {
    /// The stable machine discriminant this result crosses the boundary as.
    ///
    /// The **only** spelling of each outcome in this crate: [`Serialize`] below
    /// writes this string rather than a literal of its own, for the reason
    /// [`crate::error::CommandError::code`] gives. Adding a variant makes this
    /// `match` non-exhaustive, which is the prompt to add its two dictionary
    /// entries.
    pub fn outcome(&self) -> &'static str {
        match self {
            SaveResult::Saved { .. } => "saved",
            SaveResult::Conflict { .. } => "conflict",
            SaveResult::Refused { .. } => "refused",
        }
    } // End of function outcome()

    /// How many operand fields this outcome writes, beside its discriminant.
    fn operand_count(&self) -> usize {
        match self {
            SaveResult::Saved { .. } => 5,
            SaveResult::Conflict { .. } => 4,
            SaveResult::Refused { .. } => 2,
        }
    }
} // End of impl SaveResult

impl Serialize for SaveResult {
    /// Serializes as `{ "outcome": …, … operands }`.
    ///
    /// Hand-written for the two reasons [`crate::error::CommandError`]'s impl
    /// states: one spelling of each discriminant in the crate, and a variant
    /// added to the enum is a compile error here rather than a silent default.
    /// No arm renders a sentence, and this type has no `Display` for one to be
    /// taken from.
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut out = serializer.serialize_struct("SaveResult", 1 + self.operand_count())?;
        out.serialize_field("outcome", self.outcome())?;
        match self {
            SaveResult::Saved {
                revision,
                committed,
                notes,
                backup_taken,
                moved,
            } => {
                out.serialize_field("revision", revision)?;
                out.serialize_field("committed", committed)?;
                out.serialize_field("notes", notes)?;
                out.serialize_field("backup_taken", backup_taken)?;
                out.serialize_field("moved", moved)?;
            }
            SaveResult::Conflict {
                expected,
                found,
                disk_revision,
                disk,
            } => {
                out.serialize_field("expected", expected)?;
                out.serialize_field("found", found)?;
                out.serialize_field("disk_revision", disk_revision)?;
                out.serialize_field("disk", disk)?;
            }
            SaveResult::Refused { verdict, findings } => {
                out.serialize_field("verdict", verdict)?;
                out.serialize_field("findings", findings)?;
            }
        } // End of the match over the outcomes' operands
        out.end()
    } // End of function serialize() for SaveResult
}

/// A synthetic document, hand-authored and neutral (CLAUDE.md section 1).
#[cfg(test)]
pub(crate) const SAMPLE_SOURCE: &str = "matches:\n  - trigger: ':one'\n    replace: first\n";

/// One instance of every outcome, in declaration order.
///
/// Compiled only for tests, because nothing in production enumerates the
/// outcomes — but `crate::wire_contract` does, to compare them against the
/// interfaces `src/lib/ipc/types.ts` declares by hand. It lives here rather than
/// inside a `mod tests` so both test modules can reach it, and so it sits
/// directly under the enum it enumerates, exactly as
/// `crate::error::every_command_error` does.
///
/// **The list is mechanically exhaustive**: `every_declared_variant_has_an_instance_in_the_enumeration`
/// below derives its expectation from this file's own `pub enum SaveResult`
/// block, so a variant added to the enum and forgotten here fails `cargo test`
/// rather than reaching a screen with no shape behind it.
#[cfg(test)]
pub(crate) fn every_save_result() -> Vec<SaveResult> {
    use espansoconfig_core::model::DocumentContext;
    use espansoconfig_core::validate::FindingCode;
    use espansoconfig_core::workspace::project_source;
    use espansoconfig_core::{DocumentId, SyntaxIndex};

    let view = project_source(
        &DocumentContext::detached(DocumentId(0), "match/base.yml"),
        SAMPLE_SOURCE,
    )
    .view;
    let identity = MatchId {
        document: DocumentId(0),
        revision: view.revision,
        node: SyntaxIndex::parse(SAMPLE_SOURCE).expect("a parse").nodes()[0].id,
    };
    vec![
        SaveResult::Saved {
            revision: view.revision,
            committed: true,
            notes: vec![PresentationNote {
                edit: 0,
                from: espansoconfig_core::ScalarStyle::Plain,
                to: espansoconfig_core::ScalarStyle::SingleQuoted,
                reason: None,
            }],
            backup_taken: true,
            moved: Some(identity),
        },
        SaveResult::Conflict {
            expected: ContentRevision::of_bytes(b"a"),
            found: ContentRevision::of_bytes(b"b"),
            disk_revision: view.revision,
            disk: Box::new(view),
        },
        SaveResult::Refused {
            verdict: SaveVerdict::RefusedForUnacknowledgedSuspicions,
            findings: vec![Finding {
                code: FindingCode::ReferenceHasNoDeclaration {
                    name: "who".to_owned(),
                },
                span: None,
                node: None,
                path: None,
            }],
        },
    ]
} // End of function every_save_result()

#[cfg(test)]
mod tests {
    use std::collections::BTreeSet;

    use espansoconfig_core::ContentRevision;
    use serde_json::Value;

    use super::{every_save_result as every_outcome, SaveResult, SAMPLE_SOURCE as SOURCE};

    /// Every outcome serializes as its discriminant plus its declared operands.
    ///
    /// The point is the *nothing else*: a field that crept in carrying a rendered
    /// sentence would pass a check that only looked at the discriminant. The
    /// expectation table is written out rather than derived from the value, so it
    /// is a second statement of the shape rather than a restatement of the first.
    #[test]
    fn every_outcome_serializes_as_its_discriminant_plus_its_declared_operands() {
        let expected: Vec<(&str, Vec<&str>)> = vec![
            (
                "saved",
                vec!["backup_taken", "committed", "moved", "notes", "revision"],
            ),
            (
                "conflict",
                vec!["disk", "disk_revision", "expected", "found"],
            ),
            ("refused", vec!["findings", "verdict"]),
        ];
        for (result, (outcome, operands)) in every_outcome().iter().zip(expected) {
            let value = serde_json::to_value(result).expect("a save result must serialize");
            let object = value.as_object().expect("a result is a JSON object");
            let mut keys: Vec<&str> = object.keys().map(String::as_str).collect();
            keys.retain(|key| *key != "outcome");
            keys.sort_unstable();
            assert_eq!(
                result.outcome(),
                outcome,
                "the expectation table is out of order"
            );
            assert_eq!(
                keys, operands,
                "{outcome} does not carry exactly its declared operands"
            );
            assert_eq!(value["outcome"], outcome);
        } // End of the loop over the outcomes and their expected operands
    } // End of function every_outcome_serializes_as_its_discriminant_plus_its_declared_operands()

    /// No two outcomes share a discriminant.
    #[test]
    fn no_two_outcomes_share_a_discriminant() {
        let all = every_outcome();
        let distinct: BTreeSet<&str> = all.iter().map(SaveResult::outcome).collect();
        assert_eq!(distinct.len(), all.len());
    }

    /// A conflict carries **two** revisions of the disk side, and they are
    /// distinguishable.
    ///
    /// The honesty rule as a test rather than as a paragraph: `found` is what the
    /// locked read saw and `disk_revision` is a later read, so a payload that
    /// carried one value under both names — or dropped either — would mean the
    /// application could not tell "the file changed once" from "the file changed
    /// twice". The fixture makes all three differ, so no two of them can be
    /// confused for one another by accident.
    #[test]
    fn a_conflict_reports_the_refusing_revision_and_the_fresh_read_separately() {
        let conflict = &every_outcome()[1];
        let value = serde_json::to_value(conflict).expect("a save result must serialize");
        let expected = value["expected"].as_str().expect("a revision is a string");
        let found = value["found"].as_str().expect("a revision is a string");
        let disk = value["disk_revision"]
            .as_str()
            .expect("a revision is a string");
        assert_ne!(expected, found, "the fixture must exercise a real conflict");
        assert_ne!(
            found, disk,
            "the fixture must exercise a file that changed twice, or this proves nothing"
        );
        assert_eq!(
            disk,
            value["disk"]["revision"]
                .as_str()
                .expect("the projection carries its own revision"),
            "disk_revision must be the revision of the projection beside it"
        );
    } // End of function a_conflict_reports_the_refusing_revision_and_the_fresh_read_separately()

    /// A result carries no prose.
    ///
    /// Plan section 9 at this boundary: the outcome is a machine word, every
    /// operand is a revision, a number, a boolean, a projection or another code,
    /// and nothing anywhere is a sentence for a person to read. The nested
    /// `Finding` is the value most likely to smuggle one, so the assertion looks
    /// for the developer renderings this crate does have.
    #[test]
    fn no_outcome_carries_a_rendered_sentence() {
        for result in every_outcome() {
            let json = serde_json::to_string(&result).expect("a save result must serialize");
            for developer_prose in [
                "espansoConfig",
                "has no declaration",
                "reference \"who\"",
                " with ",
            ] {
                assert!(
                    !json.contains(developer_prose),
                    "{} carries prose: {json}",
                    result.outcome()
                );
            } // End of the loop over the developer renderings this crate can produce
        }
    } // End of function no_outcome_carries_a_rendered_sentence()

    /// Every declared variant has an instance in the enumeration above.
    ///
    /// The vacuous-audit corollary applied to this enum: the checks above are
    /// only worth anything if `every_outcome()` really holds one of each, and a
    /// variant added to `SaveResult` and to `outcome()` — both of which the
    /// compiler forces — could otherwise be omitted here and from every check
    /// silently. The expectation is derived from **this file's own source**, the
    /// way `error.rs` derives `CommandError`'s.
    #[test]
    fn every_declared_variant_has_an_instance_in_the_enumeration() {
        let source = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/save.rs"))
            .expect("save.rs can read itself");
        let declared = crate::rust_source::declared_variants(&source, "SaveResult");
        assert!(
            declared.len() > 1,
            "the source scan found {} variants, so it is not reading the enum",
            declared.len()
        );
        let enumerated: BTreeSet<String> = every_outcome().iter().map(variant_name).collect();
        assert_eq!(
            declared, enumerated,
            "every_outcome() and the SaveResult declaration disagree"
        );
    } // End of function every_declared_variant_has_an_instance_in_the_enumeration()

    /// The variant name of one [`SaveResult`], from its derived `Debug`.
    fn variant_name(result: &SaveResult) -> String {
        format!("{result:?}")
            .chars()
            .take_while(char::is_ascii_alphanumeric)
            .collect()
    }

    /// The `outcome` written is what [`SaveResult::outcome`] returns, and it is
    /// the variant name uncapitalised.
    ///
    /// The second half is what ties the wire word to the dictionary: the
    /// `code.saveResult.*` keys are derived from the **variant** names by
    /// `dictionary_contract.rs`, and a frontend switching on `outcome` reads the
    /// key for the branch it took. They coincide today; this is what says so
    /// rather than leaving it a coincidence a rename could break.
    #[test]
    fn the_serialized_outcome_is_the_uncapitalised_variant_name() {
        for result in every_outcome() {
            let value = serde_json::to_value(&result).expect("a save result must serialize");
            assert_eq!(value["outcome"], result.outcome());
            let name = variant_name(&result);
            let mut characters = name.chars();
            let uncapitalised = match characters.next() {
                None => String::new(),
                Some(first) => first.to_lowercase().collect::<String>() + characters.as_str(),
            };
            assert_eq!(uncapitalised, result.outcome());
        } // End of the loop over the outcomes
    } // End of function the_serialized_outcome_is_the_uncapitalised_variant_name()

    /// A `Saved` with nothing to report still says so explicitly.
    ///
    /// `moved: null` and `notes: []` are written rather than omitted, because
    /// `serde` always writes the key and the frontend's types declare
    /// `MatchId | null` rather than an optional property. A caller must be able
    /// to tell "no identity" from "this build does not send one".
    #[test]
    fn a_saved_with_no_identity_writes_the_key_anyway() {
        let result = SaveResult::Saved {
            revision: ContentRevision::of_bytes(SOURCE.as_bytes()),
            committed: false,
            notes: Vec::new(),
            backup_taken: false,
            moved: None,
        };
        let value: Value = serde_json::to_value(&result).expect("a save result must serialize");
        assert!(value.get("moved").is_some(), "the key must be present");
        assert!(value["moved"].is_null());
        assert_eq!(value["notes"], serde_json::json!([]));
        assert_eq!(value["committed"], false);
        assert_eq!(value["backup_taken"], false);
    } // End of function a_saved_with_no_identity_writes_the_key_anyway()
}
