//! The content of a match that does not exist yet.
//!
//! **Phase 2b-2c-2.** [`MatchDraft`](crate::draft::MatchDraft) says what an
//! *existing* match should hold, field by field, as a tri-state per key; this
//! says what a *new* one is born holding, and it is a different type because it
//! answers a different question. A draft's `Unchanged` means "leave the bytes
//! alone", which is meaningless for a match that has no bytes.
//!
//! **Phase 3-4 widened it** from six scalar fields to the whole Phase 3 creation
//! surface: a typed trigger alternative ([`NewTrigger`]), a typed content
//! alternative ([`NewContent`]), `label`, `comment`, the nine match options and
//! the `search_terms` list. `docs/decisions/3-4-notes.md` records which fields
//! and why.

use serde::{Deserialize, Serialize};

use crate::draft::{is_plain_source, DraftError, MatchField, SequenceField};
use crate::patch::EntryValue;

/// How a new match is triggered: exactly one of espanso's three trigger forms.
///
/// **One of three, and never none or two.** A match holding two trigger forms is
/// [`crate::validate::FindingCode::MatchHasSeveralTriggerForms`] and one holding
/// none is [`crate::validate::FindingCode::MatchHasNoTriggerField`]; this enum
/// has no spelling of either, so a creation cannot ask for one.
///
/// On the wire it is externally tagged, like every enum this crate sends:
/// `{"Single": ":hi"}`, `{"Multiple": [":hi", ":hello"]}`, `{"Regex": "..."}`.
/// The variant names are protocol tags and are never shown to anyone.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum NewTrigger {
    /// `trigger:` — one literal abbreviation, as decoded text.
    Single(String),
    /// `triggers:` — several literal aliases, in the order they are written.
    Multiple(TriggerList),
    /// `regex:` — a regular expression, as decoded text. Whether it compiles is
    /// the save's own validation (`RegexDoesNotCompile`), not this type's.
    Regex(String),
}

impl NewTrigger {
    /// The key this form is written under and the value written there.
    fn entry(&self) -> (&'static str, EntryValue) {
        match self {
            NewTrigger::Single(text) => {
                (MatchField::Trigger.key(), EntryValue::Scalar(text.clone()))
            }
            NewTrigger::Multiple(list) => (
                SequenceField::Triggers.key(),
                EntryValue::ScalarList(list.items().to_vec()),
            ),
            NewTrigger::Regex(text) => (MatchField::Regex.key(), EntryValue::Scalar(text.clone())),
        }
    } // End of function entry() for NewTrigger
} // End of impl NewTrigger

/// A `triggers` list that holds **at least one** alias.
///
/// # Why empty is not expressible
///
/// `triggers: []` projects as a `Multiple` trigger form with nothing that can
/// fire, and the save's validation raises no finding for it — so a refusal
/// could only come from here. It is the same decision that makes the content
/// alternative mandatory: this application does not create a snippet that
/// cannot be used. The type is what enforces it: the only constructor is
/// [`TriggerList::new`], which answers `None` for an empty vector, and the wire
/// form goes through the same constructor (`serde(try_from)`), so an empty
/// array is refused while the command's arguments are being read and before any
/// file is opened.
///
/// Duplicated aliases are **not** refused here: the list is written exactly as
/// given, in order. That repetition inside one new match is not detected is a
/// recorded limit (`docs/decisions/3-4-notes.md`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(try_from = "Vec<String>", into = "Vec<String>")]
pub struct TriggerList(Vec<String>);

impl TriggerList {
    /// The list, or `None` when `items` is empty.
    pub fn new(items: Vec<String>) -> Option<TriggerList> {
        (!items.is_empty()).then_some(TriggerList(items))
    }

    /// The aliases, in the order they are written. Never empty.
    pub fn items(&self) -> &[String] {
        &self.0
    }
} // End of impl TriggerList

impl TryFrom<Vec<String>> for TriggerList {
    type Error = &'static str;

    /// The wire's door into [`TriggerList::new`], refusing an empty array.
    fn try_from(items: Vec<String>) -> Result<TriggerList, Self::Error> {
        TriggerList::new(items).ok_or("a triggers list holds at least one alias")
    }
}

impl From<TriggerList> for Vec<String> {
    /// The aliases, for the wire.
    fn from(list: TriggerList) -> Vec<String> {
        list.0
    }
}

/// What a new match expands to: exactly one of espanso's five content forms.
///
/// The five are the ones [`crate::draft::ContentForm`] names and a
/// [`crate::draft::FieldSubstitution`] can switch between. `form` is carried as
/// its **layout text** only (ruling 9 of `docs/decisions/3-split-notes.md`):
/// creation writes no `form_fields`, because `form_fields` stays read-only until
/// Phase 4 and would be a nested mapping this type cannot spell.
///
/// On the wire it is externally tagged: `{"Replace": "..."}`,
/// `{"ImagePath": "..."}`. The variant names are protocol tags.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum NewContent {
    /// `replace:` — plain text.
    Replace(String),
    /// `markdown:` — Markdown text.
    Markdown(String),
    /// `html:` — HTML text.
    Html(String),
    /// `image_path:` — a path, as text. Nothing checks that it names a file.
    ImagePath(String),
    /// `form:` — the shorthand form's layout text.
    Form(String),
}

impl NewContent {
    /// The key this form is written under and the text written there.
    fn entry(&self) -> (&'static str, &str) {
        match self {
            NewContent::Replace(text) => (MatchField::Replace.key(), text),
            NewContent::Markdown(text) => (MatchField::Markdown.key(), text),
            NewContent::Html(text) => (MatchField::Html.key(), text),
            NewContent::ImagePath(text) => (MatchField::ImagePath.key(), text),
            NewContent::Form(text) => (MatchField::Form.key(), text),
        }
    } // End of function entry() for NewContent
} // End of impl NewContent

/// The content of a match to be created.
///
/// # Closed: one trigger form, one content form, and fixed optional keys
///
/// Every key this type can cause to be written is fixed by espanso's schema and
/// spelled by [`MatchField::key`] or [`SequenceField::key`] rather than written
/// out here, so the strings this crate emits as keys have one source. **Neither a
/// projection, a comment, an arbitrary key/value list, a nested collection nor
/// YAML source may enter this type**: there is no field any of them could arrive
/// through. Every value is a `String` or a list of `String`s, and on the wire the
/// struct is `deny_unknown_fields`, so a misspelled or invented property is
/// refused rather than silently dropped.
///
/// A [`MatchDraft`](crate::draft::MatchDraft) is deliberately **not** accepted in
/// its place: it can express `vars` and `form_fields`, which creation cannot
/// spell, and the caller would find that out from a refusal rather than from the
/// type. A raw list of key/value pairs is refused by a rule that predates this
/// type: `docs/decisions/2b-2b-2-notes.md` decision D1 forbids this engine
/// emitting a key string that no schema fixes, and its one Phase 4-3 lift — a
/// new `params` entry of an existing variable — never reaches creation.
///
/// **The trigger and the content are mandatory.** A trigger with no body, or a
/// body nothing fires, is not a usable espanso match, and this application
/// should not create one. A *later* save can still add or switch any
/// schema-known field.
///
/// **Every optional field is optional, and `None` is not `Some(String::new())`**
/// (nor `Some(vec![])` for `search_terms`). An absent field is a key the new item
/// is not born holding at all; a present empty one is `label: ''` — or
/// `search_terms: []` — written into the file. A buffer left blank cannot tell
/// those two cases apart, so the caller decides and this type carries the
/// decision rather than inferring it.
///
/// # The options are text, not booleans — and eight of them are source text
///
/// `word`, `propagate_case`, `force_clipboard` and the rest are `Option<String>`
/// for the reason their controls may not be checkboxes: deciding that `word: on`
/// means boolean true is a claim about how espanso's YAML resolver reads a plain
/// scalar, and D2u forbids this application making one.
///
/// **The eight options of [`MatchField::PLAIN_SOURCE_OPTIONS`]** — `word`,
/// `left_word`, `right_word`, `propagate_case`, `uppercase_style`, `force_mode`,
/// `force_clipboard`, `paragraph` — carry the **source text** the file should
/// hold, and it is written verbatim as one plain scalar
/// ([`EntryValue::PlainSource`]): `Some("true")` writes `word: true`, never
/// `word: 'true'` (Phase 4-1, `docs/decisions/4-split-notes.md` §3 ruling 2). A
/// text that cannot be written that way — empty, or holding a line break, a
/// quote, a `#` comment, a flow indicator, an alias or a tag — is refused by name
/// ([`DraftError::OptionNotPlainSource`]) by [`NewMatch::entries`], before any
/// transaction, rather than quoted.
///
/// # Everything else carries decoded text, never YAML
///
/// The trigger, the content, `label`, `comment`, every `search_terms` item and
/// `anchor` are logical strings. Their spelling — plain, quoted, or a `|` block
/// — is [`crate::emit::choose_scalar`]'s decision, exactly as it is for every
/// other value this crate writes, so a value holding a `#`, a line break or a
/// leading `*` is written correctly rather than injected. `anchor` is the one
/// option in this group: forbidding it text that needs quoting would restrict
/// the field for no gain.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NewMatch {
    /// Which trigger form the match is born with, and its value.
    pub trigger: NewTrigger,
    /// Which content form the match is born with, and its value.
    pub content: NewContent,
    /// `label`, when the new item is born holding one.
    ///
    /// `None` means the key is not written at all; `Some(String::new())` means
    /// an empty `label` is. The same holds for every optional field below.
    #[serde(default)]
    pub label: Option<String>,
    /// `comment`, when the new item is born holding one.
    #[serde(default)]
    pub comment: Option<String>,
    /// `search_terms`, in order, when the new item is born holding the list.
    ///
    /// `Some(vec![])` writes `search_terms: []`; `None` writes no key.
    #[serde(default)]
    pub search_terms: Option<Vec<String>>,
    /// `word`, as source text written verbatim as one plain scalar.
    #[serde(default)]
    pub word: Option<String>,
    /// `left_word`, as source text written verbatim as one plain scalar.
    #[serde(default)]
    pub left_word: Option<String>,
    /// `right_word`, as source text written verbatim as one plain scalar.
    #[serde(default)]
    pub right_word: Option<String>,
    /// `propagate_case`, as source text written verbatim as one plain scalar.
    #[serde(default)]
    pub propagate_case: Option<String>,
    /// `uppercase_style`, as source text written verbatim as one plain scalar.
    #[serde(default)]
    pub uppercase_style: Option<String>,
    /// `force_mode`, as source text written verbatim as one plain scalar.
    #[serde(default)]
    pub force_mode: Option<String>,
    /// `force_clipboard`, as source text written verbatim as one plain scalar.
    #[serde(default)]
    pub force_clipboard: Option<String>,
    /// `paragraph`, as source text written verbatim as one plain scalar.
    #[serde(default)]
    pub paragraph: Option<String>,
    /// `anchor`, as a logical string spelled by the codec — the espanso key, not
    /// YAML `&anchor` syntax.
    #[serde(default)]
    pub anchor: Option<String>,
}

impl NewMatch {
    /// A new match with only its trigger and content, every optional field
    /// absent.
    pub fn new(trigger: NewTrigger, content: NewContent) -> NewMatch {
        NewMatch {
            trigger,
            content,
            label: None,
            comment: None,
            search_terms: None,
            word: None,
            left_word: None,
            right_word: None,
            propagate_case: None,
            uppercase_style: None,
            force_mode: None,
            force_clipboard: None,
            paragraph: None,
            anchor: None,
        }
    } // End of function new()

    /// The entries the new item is born holding, in write order.
    ///
    /// # One documented order, and only the present fields
    ///
    /// The trigger form (`trigger`, `triggers` or `regex`), the content form
    /// (`replace`, `markdown`, `html`, `image_path` or `form`), then `label`,
    /// `comment`, `search_terms`, and the nine options in
    /// [`MatchField::ALL`](crate::draft::MatchField::ALL)'s relative order:
    /// `word`, `left_word`, `right_word`, `propagate_case`, `uppercase_style`,
    /// `force_mode`, `force_clipboard`, `paragraph`, `anchor`. It is the order the
    /// bytes come out in: [`crate::patch::InsertItem`] renders the entries in
    /// this order, so this vector *is* the item's key order in the file.
    ///
    /// **A field that is `None` is not emitted** — there is no placeholder line,
    /// no empty value and no key with nothing after it. A logical-string field
    /// that is `Some("")` **is** emitted, with whatever the encoder spells an
    /// empty string as, and `search_terms: Some(vec![])` is emitted as `[]`.
    ///
    /// # The eight plain-source options (Phase 4-1)
    ///
    /// Each of [`MatchField::PLAIN_SOURCE_OPTIONS`] that is present becomes an
    /// [`EntryValue::PlainSource`], written verbatim; `anchor` stays an
    /// [`EntryValue::Scalar`]. Because this is the only producer of a new match's
    /// entries, the check below is what every creation passes through before a
    /// transaction exists; a caller that built an [`crate::patch::InsertItem`]
    /// by hand would bypass it, and the engine's own read-back
    /// ([`crate::patch::VerificationFailure::PlainSourceNotReadBack`]) is what
    /// refuses such an item then.
    ///
    /// # Errors
    ///
    /// [`DraftError::OptionNotPlainSource`], naming the first option in write
    /// order whose text fails [`is_plain_source`] — `Some("")` among them, since
    /// an empty plain scalar is a null rather than the empty text.
    pub fn entries(&self) -> Result<Vec<(String, EntryValue)>, DraftError> {
        let (trigger_key, trigger_value) = self.trigger.entry();
        let (content_key, content_text) = self.content.entry();
        let mut entries = vec![
            (trigger_key.to_owned(), trigger_value),
            (
                content_key.to_owned(),
                EntryValue::Scalar(content_text.to_owned()),
            ),
        ];
        let mut push_scalar = |field: MatchField, value: &Option<String>| {
            if let Some(text) = value {
                entries.push((field.key().to_owned(), EntryValue::Scalar(text.clone())));
            }
        };
        push_scalar(MatchField::Label, &self.label);
        push_scalar(MatchField::Comment, &self.comment);
        if let Some(terms) = &self.search_terms {
            entries.push((
                SequenceField::SearchTerms.key().to_owned(),
                EntryValue::ScalarList(terms.clone()),
            ));
        }
        // The nine options, in the one order documented above. Written as a
        // table so that the order is a value this function reads rather than a
        // shape spread over nine statements.
        let options = [
            (MatchField::Word, &self.word),
            (MatchField::LeftWord, &self.left_word),
            (MatchField::RightWord, &self.right_word),
            (MatchField::PropagateCase, &self.propagate_case),
            (MatchField::UppercaseStyle, &self.uppercase_style),
            (MatchField::ForceMode, &self.force_mode),
            (MatchField::ForceClipboard, &self.force_clipboard),
            (MatchField::Paragraph, &self.paragraph),
            (MatchField::Anchor, &self.anchor),
        ];
        for (field, value) in options {
            let Some(text) = value else {
                continue;
            };
            let value = if !field.writes_plain_source() {
                EntryValue::Scalar(text.clone())
            } else if is_plain_source(text) {
                EntryValue::PlainSource(text.clone())
            } else {
                return Err(DraftError::OptionNotPlainSource { field });
            };
            entries.push((field.key().to_owned(), value));
        } // End of the loop over the nine optional match options
        Ok(entries)
    } // End of function entries()
} // End of impl NewMatch

#[cfg(test)]
mod tests {
    use super::{NewContent, NewMatch, NewTrigger, TriggerList};
    use crate::draft::{DraftError, MatchField};
    use crate::patch::EntryValue;

    /// Every optional scalar field's key, in write order, paired with a setter.
    type Setter = fn(&mut NewMatch, Option<String>);

    /// The eleven optional scalar fields, in write order.
    fn optional_scalars() -> Vec<(&'static str, Setter)> {
        vec![
            ("label", |m, v| m.label = v),
            ("comment", |m, v| m.comment = v),
            ("word", |m, v| m.word = v),
            ("left_word", |m, v| m.left_word = v),
            ("right_word", |m, v| m.right_word = v),
            ("propagate_case", |m, v| m.propagate_case = v),
            ("uppercase_style", |m, v| m.uppercase_style = v),
            ("force_mode", |m, v| m.force_mode = v),
            ("force_clipboard", |m, v| m.force_clipboard = v),
            ("paragraph", |m, v| m.paragraph = v),
            ("anchor", |m, v| m.anchor = v),
        ]
    } // End of function optional_scalars()

    /// A match with only a single trigger and a `replace` body.
    fn bare() -> NewMatch {
        NewMatch::new(
            NewTrigger::Single(":one".to_owned()),
            NewContent::Replace("first".to_owned()),
        )
    }

    /// The keys of a match's entries, in order.
    fn keys(new_match: &NewMatch) -> Vec<String> {
        new_match
            .entries()
            .expect("the entries")
            .into_iter()
            .map(|(key, _)| key)
            .collect()
    }

    /// With every optional field absent, exactly the two mandatory entries are
    /// written, and their keys are the schema's own.
    #[test]
    fn a_bare_new_match_is_its_trigger_and_its_content() {
        assert_eq!(
            bare().entries().expect("the entries"),
            vec![
                ("trigger".to_owned(), EntryValue::Scalar(":one".to_owned())),
                ("replace".to_owned(), EntryValue::Scalar("first".to_owned())),
            ]
        );
    } // End of function a_bare_new_match_is_its_trigger_and_its_content()

    /// Each trigger alternative is written under its own key, and a multiple
    /// trigger is a list in the order given.
    #[test]
    fn each_trigger_alternative_names_its_own_key() {
        let cases = [
            (
                NewTrigger::Single(":a".to_owned()),
                "trigger",
                EntryValue::Scalar(":a".to_owned()),
            ),
            (
                NewTrigger::Multiple(
                    TriggerList::new(vec![":b".to_owned(), ":a".to_owned()]).expect("non-empty"),
                ),
                "triggers",
                EntryValue::ScalarList(vec![":b".to_owned(), ":a".to_owned()]),
            ),
            (
                NewTrigger::Regex(":d(\\d)".to_owned()),
                "regex",
                EntryValue::Scalar(":d(\\d)".to_owned()),
            ),
        ];
        for (trigger, key, value) in cases {
            let made = NewMatch::new(trigger, NewContent::Replace("x".to_owned()));
            assert_eq!(
                made.entries().expect("the entries")[0],
                (key.to_owned(), value)
            );
        } // End of the loop over the three trigger alternatives
    } // End of function each_trigger_alternative_names_its_own_key()

    /// Each content alternative is written under its own key.
    #[test]
    fn each_content_alternative_names_its_own_key() {
        let cases = [
            (NewContent::Replace("t".to_owned()), "replace"),
            (NewContent::Markdown("t".to_owned()), "markdown"),
            (NewContent::Html("t".to_owned()), "html"),
            (NewContent::ImagePath("t".to_owned()), "image_path"),
            (NewContent::Form("t".to_owned()), "form"),
        ];
        for (content, key) in cases {
            let made = NewMatch::new(NewTrigger::Single(":a".to_owned()), content);
            assert_eq!(
                made.entries().expect("the entries")[1],
                (key.to_owned(), EntryValue::Scalar("t".to_owned()))
            );
        } // End of the loop over the five content alternatives
    } // End of function each_content_alternative_names_its_own_key()

    /// With every field present, every key is written once, in the documented
    /// order.
    #[test]
    fn every_present_field_is_written_in_the_documented_order() {
        let mut whole = bare();
        for (_, set) in optional_scalars() {
            set(&mut whole, Some("v".to_owned()));
        }
        whole.search_terms = Some(vec!["b".to_owned(), "a".to_owned()]);
        assert_eq!(
            keys(&whole),
            vec![
                "trigger",
                "replace",
                "label",
                "comment",
                "search_terms",
                "word",
                "left_word",
                "right_word",
                "propagate_case",
                "uppercase_style",
                "force_mode",
                "force_clipboard",
                "paragraph",
                "anchor",
            ]
        );
        let terms = whole
            .entries()
            .expect("the entries")
            .into_iter()
            .find(|(key, _)| key == "search_terms")
            .map(|(_, value)| value);
        assert_eq!(
            terms,
            Some(EntryValue::ScalarList(vec!["b".to_owned(), "a".to_owned()])),
            "list order survives"
        );
    } // End of function every_present_field_is_written_in_the_documented_order()

    /// For every optional field, `None` writes no key. `Some("")` writes the key
    /// with an empty value for the three logical-string fields (`label`,
    /// `comment`, `anchor`) — and only that key changes — and is refused by name
    /// for each of the eight plain-source options, because an empty plain scalar
    /// is a null rather than the empty text (Phase 4-1).
    #[test]
    fn none_and_empty_differ_for_every_optional_field() {
        for (key, set) in optional_scalars() {
            let mut absent = bare();
            set(&mut absent, None);
            assert!(!keys(&absent).iter().any(|k| k == key), "{key}: absent");

            let mut empty = bare();
            set(&mut empty, Some(String::new()));
            let field = MatchField::from_key(key).expect("a schema-known key");
            if field.writes_plain_source() {
                assert_eq!(
                    empty.entries(),
                    Err(DraftError::OptionNotPlainSource { field }),
                    "{key}: an empty option is refused, never quoted"
                );
                continue;
            }
            let entries = empty.entries().expect("the entries");
            assert_eq!(
                entries.last(),
                Some(&(key.to_owned(), EntryValue::Scalar(String::new()))),
                "{key}: an empty value is still a key"
            );
            assert_eq!(entries.len(), 3, "{key}: only that key is added");
        } // End of the loop over the eleven optional scalar fields

        let mut empty_terms = bare();
        empty_terms.search_terms = Some(Vec::new());
        assert_eq!(
            empty_terms.entries().expect("the entries").last(),
            Some(&(
                "search_terms".to_owned(),
                EntryValue::ScalarList(Vec::new())
            ))
        );
        assert!(!keys(&bare()).iter().any(|k| k == "search_terms"));
    } // End of function none_and_empty_differ_for_every_optional_field()

    /// The split of Phase 4-1: the eight plain-source options become
    /// [`EntryValue::PlainSource`] holding the text as typed, and `anchor`, the
    /// trigger, the content, `label` and `comment` stay [`EntryValue::Scalar`] —
    /// even when their text is the same ambiguous `true`.
    #[test]
    fn eight_options_are_plain_source_and_every_other_value_is_a_string() {
        let mut whole = NewMatch::new(
            NewTrigger::Single("true".to_owned()),
            NewContent::Replace("true".to_owned()),
        );
        for (_, set) in optional_scalars() {
            set(&mut whole, Some("true".to_owned()));
        }
        for (key, value) in whole.entries().expect("the entries") {
            let field = MatchField::from_key(&key).expect("a schema-known key");
            let wanted = if field.writes_plain_source() {
                EntryValue::PlainSource("true".to_owned())
            } else {
                EntryValue::Scalar("true".to_owned())
            };
            assert_eq!(value, wanted, "{key}");
        } // End of the loop over the written entries
        assert_eq!(MatchField::PLAIN_SOURCE_OPTIONS.len(), 8);
        assert!(!MatchField::Anchor.writes_plain_source());
    } // End of function eight_options_are_plain_source_and_every_other_value_is_a_string()

    /// Text that is not one plain scalar is refused by name for each of the
    /// eight options, and the first refused option in write order is the one
    /// named; the same text in `anchor` is written as a string.
    #[test]
    fn an_option_that_is_not_plain_source_is_refused_by_name() {
        let refused = [
            "",
            "a\nb",
            "a\rb",
            "'true'",
            "\"on\"",
            "a #b",
            "#b",
            "[a]",
            "{a: b}",
            "*alias",
            "&anchor x",
            "!!str x",
            "a: b",
            "- a",
            " a",
            "a ",
        ];
        for text in refused {
            for field in MatchField::PLAIN_SOURCE_OPTIONS {
                let mut made = bare();
                let (_, set) = optional_scalars()
                    .into_iter()
                    .find(|(key, _)| *key == field.key())
                    .expect("every option has a setter");
                set(&mut made, Some(text.to_owned()));
                assert_eq!(
                    made.entries(),
                    Err(DraftError::OptionNotPlainSource { field }),
                    "{text:?} in {}",
                    field.key()
                );
            } // End of the loop over the eight options
            let mut anchored = bare();
            anchored.anchor = Some(text.to_owned());
            assert!(anchored.entries().is_ok(), "{text:?} is a string in anchor");
        } // End of the loop over the refused texts

        let mut two = bare();
        two.force_mode = Some("a #b".to_owned());
        two.word = Some(String::new());
        assert_eq!(
            two.entries(),
            Err(DraftError::OptionNotPlainSource {
                field: MatchField::Word
            }),
            "the first refused option in write order is named"
        );
    } // End of function an_option_that_is_not_plain_source_is_refused_by_name()

    /// An empty `triggers` list cannot be built, in Rust or off the wire.
    #[test]
    fn an_empty_trigger_list_is_not_expressible() {
        assert_eq!(TriggerList::new(Vec::new()), None);
        let refused = serde_json::from_str::<NewMatch>(
            r#"{"trigger":{"Multiple":[]},"content":{"Replace":"x"}}"#,
        );
        assert!(refused.is_err(), "an empty triggers array is refused");
    } // End of function an_empty_trigger_list_is_not_expressible()

    /// The wire form: both alternatives are required, every optional field
    /// defaults to absent when omitted or null, and an unknown property — an
    /// author-chosen key, or the pre-3-4 flat `replace` — is refused.
    #[test]
    fn the_wire_form_is_closed() {
        let minimal: NewMatch =
            serde_json::from_str(r#"{"trigger":{"Single":":one"},"content":{"Replace":"first"}}"#)
                .expect("a minimal match");
        assert_eq!(minimal, bare());

        let nulled: NewMatch = serde_json::from_str(
            r#"{"trigger":{"Single":":one"},"content":{"Replace":"first"},
                "label":null,"search_terms":null,"word":""}"#,
        )
        .expect("nulls are absent");
        assert_eq!(nulled.label, None);
        assert_eq!(nulled.search_terms, None);
        assert_eq!(nulled.word.as_deref(), Some(""));

        for refused in [
            r#"{"trigger":{"Single":":one"}}"#,
            r#"{"content":{"Replace":"first"}}"#,
            r#"{"trigger":":one","replace":"first"}"#,
            r#"{"trigger":{"Single":":one"},"content":{"Replace":"x"},"vars":[]}"#,
            r#"{"trigger":{"Single":":one"},"content":{"Replace":"x"},"rightWord":"on"}"#,
            r#"{"trigger":{"Other":":one"},"content":{"Replace":"x"}}"#,
            r#"{"trigger":{"Single":":one"},"content":{"Vars":"x"}}"#,
            r#"{"trigger":{"Single":{"a":1}},"content":{"Replace":"x"}}"#,
            r#"{"trigger":{"Multiple":[["nested"]]},"content":{"Replace":"x"}}"#,
            r#"{"trigger":{"Single":":one"},"content":{"Replace":"x"},"search_terms":[{"a":1}]}"#,
        ] {
            assert!(
                serde_json::from_str::<NewMatch>(refused).is_err(),
                "must be refused: {refused}"
            );
        } // End of the loop over the refused payloads

        let round_trip: NewMatch =
            serde_json::from_value(serde_json::to_value(bare()).expect("serializes"))
                .expect("reads back");
        assert_eq!(round_trip, bare());
    } // End of function the_wire_form_is_closed()
}
