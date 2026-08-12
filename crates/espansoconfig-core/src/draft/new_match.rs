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
/// # Closed, two mandatory fields and four optional ones
///
/// Six keys, every one of them fixed by espanso's schema and spelled by
/// [`MatchField::key`](crate::draft::MatchField::key) rather than written out
/// here, so the strings this crate emits as keys have one source.
///
/// **Phase 2c-4c-1 widened it from two to six**, and the four it added are
/// exactly the four the small editor already drafts beside `trigger` and
/// `replace` (`src/lib/browser/matchEditor.ts`'s `EditableField`): `label`,
/// `word`, `left_word` and `right_word`. The reason they are here is that a
/// recovery creation has to be able to carry what an editing session was holding
/// when its save met a conflict, and a creation that could carry only two of the
/// six would silently drop the other four. Widening the value is the whole of
/// that change: no new [`crate::patch::DocumentEdit`] variant, no second writer.
///
/// A [`MatchDraft`](crate::draft::MatchDraft) is deliberately **not** accepted in
/// its place: it can express twenty-two fields, four of them collections, and
/// [`crate::patch::InsertItem`] synthesizes exactly one **flat** block mapping
/// with scalar fields. Taking a draft would advertise a structure creation cannot
/// spell, and the caller would find that out from a refusal rather than from the
/// type. A raw list of key/value pairs is refused for a different reason and by a
/// rule that predates this type: `docs/decisions/2b-2b-2-notes.md` decision D1
/// forbids this engine emitting a key string that no schema fixes. **Neither a
/// projection, a comment, an arbitrary key/value list nor YAML source may enter
/// this type**, and the six `String`s are what enforces that: there is no field
/// any of them could arrive through.
///
/// **`replace` is mandatory.** A trigger with no body is not a usable espanso
/// match, and this application should not create one. Nothing prevents a *later*
/// save from adding another schema-known scalar key to the match's own mapping —
/// that is the one insertion 2b-2b-2's D1 does permit — so this is a decision
/// about what is worth creating rather than a limit of the engine.
///
/// **The four added fields are optional, and `None` is not `Some(String::new())`.**
/// An absent field is a key the new item is not born holding at all; a present
/// empty one is `label: ''` written into the file. [`MatchDraft`]'s own
/// `Unchanged`/`Set` distinction is the same one, learned in Phase 2c-2: a buffer
/// left blank cannot tell those two cases apart, so the caller decides and this
/// type carries the decision rather than inferring it.
///
/// # The three word-boundary fields are text, not booleans
///
/// `word`, `left_word` and `right_word` are `Option<String>` for the reason a
/// word-boundary *control* may not be a checkbox: deciding that `word: on` means
/// boolean true is a claim about how espanso's YAML resolver reads a plain
/// scalar, and D2u forbids this application making one. What is written is the
/// text the caller supplied, spelled by the encoder like every other value.
///
/// # It carries decoded text, never YAML
///
/// Every value is a logical string. Its spelling — plain, quoted, or a `|`
/// block — is [`crate::emit::choose_scalar`]'s decision, exactly as it is for
/// every other value this crate writes, so a value holding a `#`, a line break or
/// a leading `*` is written correctly rather than injected.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NewMatch {
    /// The literal text that fires the snippet — espanso's `trigger`.
    pub trigger: String,
    /// What the snippet expands to — espanso's `replace`.
    pub replace: String,
    /// `label`, when the new item is born holding one.
    ///
    /// `None` means the key is not written at all; `Some(String::new())` means
    /// an empty `label` is.
    #[serde(default)]
    pub label: Option<String>,
    /// `word`, as source text, when the new item is born holding it.
    #[serde(default)]
    pub word: Option<String>,
    /// `left_word`, as source text, when the new item is born holding it.
    #[serde(default)]
    pub left_word: Option<String>,
    /// `right_word`, as source text, when the new item is born holding it.
    #[serde(default)]
    pub right_word: Option<String>,
}

impl NewMatch {
    /// The fields the new item is born holding, in write order.
    ///
    /// # One documented order, and only the present fields
    ///
    /// `trigger`, `replace`, `label`, `word`, `left_word`, `right_word` — the
    /// order espanso's own documentation writes them in, which is also the
    /// relative order [`MatchField::ALL`](crate::draft::MatchField::ALL) lists
    /// them in and the order `EDITABLE_FIELDS` draws them in on screen. It is the
    /// order the bytes come out in: [`crate::patch::InsertItem`] renders one line
    /// per pair, so this vector *is* the item's key order in the file.
    ///
    /// **A field that is `None` is not emitted**, and that is the whole of what
    /// "optional" means here — there is no placeholder line, no empty value and
    /// no key with nothing after it. A field that is `Some("")` **is** emitted,
    /// with whatever the encoder spells an empty string as.
    ///
    /// Only these six keys can ever appear, because these six fields are the
    /// only ones this type has.
    pub fn fields(&self) -> Vec<(String, String)> {
        let mut fields = vec![
            (MatchField::Trigger.key().to_owned(), self.trigger.clone()),
            (MatchField::Replace.key().to_owned(), self.replace.clone()),
        ];
        // The four optional keys, in the one order documented above. Written as
        // a table rather than four `if let`s so that the order is a value this
        // function reads rather than a shape spread over four statements.
        let optional = [
            (MatchField::Label, &self.label),
            (MatchField::Word, &self.word),
            (MatchField::LeftWord, &self.left_word),
            (MatchField::RightWord, &self.right_word),
        ];
        for (field, value) in optional {
            if let Some(text) = value {
                fields.push((field.key().to_owned(), text.clone()));
            }
        } // End of the loop over the four optional schema-known fields
        fields
    } // End of function fields()
} // End of impl NewMatch

#[cfg(test)]
mod tests {
    use super::NewMatch;

    /// The bare minimum: with the four optional fields absent, exactly the two
    /// mandatory keys are written, and they are the schema's own — taken from
    /// `MatchField` rather than typed.
    #[test]
    fn a_new_match_is_exactly_the_two_schema_keys_in_order() {
        let fields = bare(":one", "first").fields();
        assert_eq!(
            fields,
            vec![
                ("trigger".to_owned(), ":one".to_owned()),
                ("replace".to_owned(), "first".to_owned()),
            ]
        );
    } // End of function a_new_match_is_exactly_the_two_schema_keys_in_order()

    /// A match with all six fields writes all six, in the one documented order.
    #[test]
    fn all_six_present_fields_are_written_in_the_documented_order() {
        let whole = NewMatch {
            trigger: ":one".to_owned(),
            replace: "first".to_owned(),
            label: Some("a label".to_owned()),
            word: Some("true".to_owned()),
            left_word: Some("false".to_owned()),
            right_word: Some("on".to_owned()),
        };
        let keys: Vec<String> = whole.fields().into_iter().map(|(key, _)| key).collect();
        assert_eq!(
            keys,
            vec![
                "trigger",
                "replace",
                "label",
                "word",
                "left_word",
                "right_word"
            ],
            "the write order is the documented one, and it is the file's key order"
        );
        assert_eq!(
            whole.fields(),
            vec![
                ("trigger".to_owned(), ":one".to_owned()),
                ("replace".to_owned(), "first".to_owned()),
                ("label".to_owned(), "a label".to_owned()),
                ("word".to_owned(), "true".to_owned()),
                ("left_word".to_owned(), "false".to_owned()),
                ("right_word".to_owned(), "on".to_owned()),
            ],
            "every value travels as the text the caller supplied"
        );
    } // End of function all_six_present_fields_are_written_in_the_documented_order()

    /// An absent optional field is **omitted**, and the fields around it keep
    /// their order. Each of the four is dropped on its own, so a hole cannot be
    /// hidden by its neighbours.
    #[test]
    fn an_absent_optional_field_is_omitted_and_the_order_survives() {
        let all_four = ["label", "word", "left_word", "right_word"];
        for dropped in all_four {
            let mut candidate = NewMatch {
                trigger: ":one".to_owned(),
                replace: "first".to_owned(),
                label: Some("a label".to_owned()),
                word: Some("true".to_owned()),
                left_word: Some("false".to_owned()),
                right_word: Some("on".to_owned()),
            };
            match dropped {
                "label" => candidate.label = None,
                "word" => candidate.word = None,
                "left_word" => candidate.left_word = None,
                _ => candidate.right_word = None,
            }
            let keys: Vec<String> = candidate.fields().into_iter().map(|(key, _)| key).collect();
            let expected: Vec<String> = ["trigger", "replace"]
                .into_iter()
                .chain(all_four.into_iter().filter(|key| *key != dropped))
                .map(str::to_owned)
                .collect();
            assert_eq!(
                keys, expected,
                "dropping {dropped} must drop only {dropped}"
            );
        } // End of the loop over the four optional fields, each dropped alone
    } // End of function an_absent_optional_field_is_omitted_and_the_order_survives()

    /// `None` and `Some("")` are two different requests, and `fields()` writes
    /// them as two different items: no key at all, or the key with an empty
    /// value.
    #[test]
    fn an_absent_field_and_an_empty_one_are_not_the_same_request() {
        let absent = bare(":one", "first");
        assert!(
            !absent.fields().iter().any(|(key, _)| key == "label"),
            "an absent label is not written at all"
        );

        let mut empty = bare(":one", "first");
        empty.label = Some(String::new());
        assert_eq!(
            empty.fields().last(),
            Some(&("label".to_owned(), String::new())),
            "an empty label is written, with an empty value"
        );
    } // End of function an_absent_field_and_an_empty_one_are_not_the_same_request()

    /// It deserializes from the object a frontend sends: the two mandatory keys
    /// are required, and the four optional ones default to absent — so a payload
    /// written before Phase 2c-4c-1 still means what it meant.
    #[test]
    fn both_fields_are_mandatory_on_the_wire() {
        let whole: NewMatch =
            serde_json::from_str(r#"{"trigger":":one","replace":"first"}"#).expect("a whole match");
        assert_eq!(whole.trigger, ":one");
        assert_eq!(whole.replace, "first");
        assert_eq!(
            whole,
            bare(":one", "first"),
            "the four omitted keys are None"
        );
        assert!(
            serde_json::from_str::<NewMatch>(r#"{"trigger":":one"}"#).is_err(),
            "a trigger with no body is not a usable espanso match"
        );
        assert!(
            serde_json::from_str::<NewMatch>(r#"{"replace":"first"}"#).is_err(),
            "a body with no trigger cannot fire"
        );
    } // End of function both_fields_are_mandatory_on_the_wire()

    /// The four optional keys cross the wire when they are sent, and `null` is
    /// read as absent rather than as an empty string.
    #[test]
    fn the_four_optional_keys_cross_the_wire() {
        let sent: NewMatch = serde_json::from_str(
            r#"{"trigger":":one","replace":"first","label":"a label","word":"true",
                "left_word":"","right_word":null}"#,
        )
        .expect("a widened match");
        assert_eq!(sent.label.as_deref(), Some("a label"));
        assert_eq!(sent.word.as_deref(), Some("true"));
        assert_eq!(
            sent.left_word.as_deref(),
            Some(""),
            "an explicitly empty left_word is a request to write one"
        );
        assert_eq!(
            sent.right_word, None,
            "a null right_word is absent, not empty"
        );
    } // End of function the_four_optional_keys_cross_the_wire()

    /// A match with only the two mandatory fields set.
    fn bare(trigger: &str, replace: &str) -> NewMatch {
        NewMatch {
            trigger: trigger.to_owned(),
            replace: replace.to_owned(),
            label: None,
            word: None,
            left_word: None,
            right_word: None,
        }
    } // End of function bare()
}
