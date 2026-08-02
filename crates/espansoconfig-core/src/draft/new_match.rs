//! The content of a match that does not exist yet.
//!
//! **Phase 2b-2c-2.** [`MatchDraft`](crate::draft::MatchDraft) says what an
//! *existing* match should hold, field by field, as a tri-state per key; this
//! says what a *new* one is born holding, and it is a different type because it
//! answers a different question. A draft's `Unchanged` means "leave the bytes
//! alone", which is meaningless for a match that has no bytes.

use serde::{Deserialize, Serialize};

use crate::draft::MatchField;

/// The content of a match to be created.
///
/// # Closed, and both fields mandatory
///
/// Two keys, fixed by espanso's schema and spelled by
/// [`MatchField::key`](crate::draft::MatchField::key) rather than written out
/// here, so the strings this crate emits as keys have one source.
///
/// A [`MatchDraft`](crate::draft::MatchDraft) is deliberately **not** accepted in
/// its place: it can express twenty-two fields, four of them collections, and
/// [`crate::patch::InsertItem`] synthesizes exactly one **flat** block mapping
/// with scalar fields. Taking a draft would advertise a structure creation cannot
/// spell, and the caller would find that out from a refusal rather than from the
/// type. A raw list of key/value pairs is refused for a different reason and by a
/// rule that predates this type: `docs/decisions/2b-2b-2-notes.md` decision D1
/// forbids this engine emitting a key string that no schema fixes.
///
/// **`replace` is mandatory.** A trigger with no body is not a usable espanso
/// match, and this application should not create one. Nothing prevents a *later*
/// save from adding another schema-known scalar key to the match's own mapping —
/// that is the one insertion 2b-2b-2's D1 does permit — so this is a decision
/// about what is worth creating rather than a limit of the engine.
///
/// # It carries decoded text, never YAML
///
/// Both values are logical strings. Their spelling — plain, quoted, or a `|`
/// block — is [`crate::emit::choose_scalar`]'s decision, exactly as it is for
/// every other value this crate writes, so a value holding a `#`, a line break or
/// a leading `*` is written correctly rather than injected.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NewMatch {
    /// The literal text that fires the snippet — espanso's `trigger`.
    pub trigger: String,
    /// What the snippet expands to — espanso's `replace`.
    pub replace: String,
}

impl NewMatch {
    /// The fields the new item is born holding, in write order.
    ///
    /// The order is the order espanso's own documentation writes them in, and it
    /// is the order the bytes come out in: [`crate::patch::InsertItem`] renders
    /// one line per pair.
    pub fn fields(&self) -> Vec<(String, String)> {
        vec![
            (MatchField::Trigger.key().to_owned(), self.trigger.clone()),
            (MatchField::Replace.key().to_owned(), self.replace.clone()),
        ]
    } // End of function fields()
} // End of impl NewMatch

#[cfg(test)]
mod tests {
    use super::NewMatch;

    /// The two keys are the schema's, taken from `MatchField` rather than typed.
    #[test]
    fn a_new_match_is_exactly_the_two_schema_keys_in_order() {
        let fields = NewMatch {
            trigger: ":one".to_owned(),
            replace: "first".to_owned(),
        }
        .fields();
        assert_eq!(
            fields,
            vec![
                ("trigger".to_owned(), ":one".to_owned()),
                ("replace".to_owned(), "first".to_owned()),
            ]
        );
    } // End of function a_new_match_is_exactly_the_two_schema_keys_in_order()

    /// It deserializes from the object a frontend sends, and both keys are
    /// required.
    #[test]
    fn both_fields_are_mandatory_on_the_wire() {
        let whole: NewMatch =
            serde_json::from_str(r#"{"trigger":":one","replace":"first"}"#).expect("a whole match");
        assert_eq!(whole.trigger, ":one");
        assert_eq!(whole.replace, "first");
        assert!(
            serde_json::from_str::<NewMatch>(r#"{"trigger":":one"}"#).is_err(),
            "a trigger with no body is not a usable espanso match"
        );
        assert!(
            serde_json::from_str::<NewMatch>(r#"{"replace":"first"}"#).is_err(),
            "a body with no trigger cannot fire"
        );
    } // End of function both_fields_are_mandatory_on_the_wire()
}
