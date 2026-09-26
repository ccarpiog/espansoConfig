//! A local variable that does not exist yet, and the intents that add, remove
//! or reorder the variables of one match (Phase 4-4).
//!
//! # A closed description, never caller YAML
//!
//! [`NewVariable`] is what a new entry of a match's `vars` is **born holding**,
//! for the reason [`crate::draft::NewMatch`] is what a new match is born
//! holding: a draft's `Unchanged` means *leave these bytes alone*, which bytes
//! that do not exist cannot mean. It is closed by its types (ruling 6 of
//! `docs/decisions/4-split-notes.md` §3):
//!
//! - the **common** fields are `name` (a logical string), `inject_vars`
//!   (validated plain source, ruling 4) and `depends_on` (a flat list of logical
//!   strings);
//! - the **kind** is one of nine [`NewVariableParams`] variants, and each variant
//!   names exactly the parameters plan section 3.4 lists for it. `type` is
//!   derived from the variant, so a new variable cannot declare one kind and
//!   carry another's parameters;
//! - a **bounded** list of extra author-named parameters ([`NewParam`], at most
//!   [`NewVariable::MAX_EXTRA_PARAMS`]), each a scalar or a flat list of scalars
//!   under ruling 7's key rules, so a parameter this project does not model can
//!   still be written without caller YAML.
//!
//! Choice records (`{label, id}`) and form field definitions are **not** here:
//! a new `choice` is born holding strings, and records are added to an existing
//! one's `values` afterwards ([`crate::draft::VariableListIntent`], Phase 4-5);
//! form field definitions are step 4-6's.
//!
//! # Typed settings are plain source
//!
//! Ruling 4 names the known non-string settings below a match. Four of them
//! belong to a variable and are written by this type: `inject_vars`, `date`'s
//! `offset`, `shell`'s and `script`'s `trim`, and `shell`'s `debug`
//! ([`VariableSetting`]). Each is written **verbatim as plain source**
//! ([`crate::patch::EntryValue::PlainSource`]) after
//! [`crate::draft::is_plain_source`] accepts it, exactly as the eight match
//! options are since Phase 4-1 — never quoted into a string, which would be A1
//! one level down, and never interpreted (D2u). Every other value is a logical
//! string spelled by the codec. An extra parameter named after a typed setting
//! stays refused ([`crate::draft::DraftError::NewKeyIsATypedSetting`]), so the
//! only route to one is the kind field that owns it.
//!
//! # What the type does not force
//!
//! That a name is unique, that a setting is plain source and that a key meets
//! ruling 7 are checked by [`crate::draft::plan_match_edits`], not by this type:
//! a `String` cannot say any of them. The audit
//! ([`crate::draft::check_closed_surface`]) re-reads the derived batch and
//! refuses an item that does not have a new variable's shape.

use serde::{Deserialize, Serialize};

use crate::draft::match_draft::NewParam;
use crate::draft::sequence::ListPlacement;
use crate::model::VariableKind;
use crate::patch::{EntryValue, ItemValue};

/// The key a variable's name is written under.
pub(crate) const NAME_KEY: &str = "name";
/// The key a variable's type is written under.
pub(crate) const TYPE_KEY: &str = "type";
/// The key a variable's explicit dependencies are written under.
pub(crate) const DEPENDS_ON_KEY: &str = "depends_on";
/// The key a variable's injection switch is written under.
pub(crate) const INJECT_VARS_KEY: &str = "inject_vars";

/// The keys a new variable's own mapping may hold, in the order this module
/// writes them. [`crate::draft::check_closed_surface`] reads the same list.
pub(crate) const NEW_VARIABLE_KEYS: [&str; 5] = [
    NAME_KEY,
    TYPE_KEY,
    DEPENDS_ON_KEY,
    INJECT_VARS_KEY,
    crate::draft::match_draft::PARAMS_KEY,
];

/// The `params` keys a new variable writes **verbatim as plain source**
/// (ruling 4), and no other. [`crate::draft::check_closed_surface`] refuses a
/// plain-source parameter under any other key.
pub(crate) const PLAIN_SOURCE_PARAMS: [&str; 3] = ["offset", "trim", "debug"];

/// One of the typed settings a new variable writes as plain source (Phase 4-4,
/// ruling 4).
///
/// **It serializes as the espanso key** (`inject_vars`, `offset`, `trim`,
/// `debug`), for [`crate::draft::MatchField`]'s reason: a refusal names it, and
/// what a screen puts beside such a setting is that key, spelled the same in
/// every language.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VariableSetting {
    /// `inject_vars`, on the variable itself.
    InjectVars,
    /// `params.offset` of a `date` variable.
    Offset,
    /// `params.trim` of a `shell` or `script` variable.
    Trim,
    /// `params.debug` of a `shell` variable.
    Debug,
}

impl VariableSetting {
    /// The espanso key this setting is written under.
    pub fn key(self) -> &'static str {
        match self {
            VariableSetting::InjectVars => INJECT_VARS_KEY,
            VariableSetting::Offset => "offset",
            VariableSetting::Trim => "trim",
            VariableSetting::Debug => "debug",
        }
    }
} // End of impl VariableSetting

/// The kind-specific parameters of a new variable: **one variant per kind, nine
/// in all** (plan section 3.4), each naming exactly that kind's parameters.
///
/// Every `String` is a logical string spelled by the codec, except the typed
/// settings (`offset`, `trim`, `debug`), which are plain source
/// ([`VariableSetting`]). An `Option` left `None` is a parameter the new variable
/// is not born holding at all; a `Vec` is a flat list written in block style, or
/// `[]` when empty (ruling 8). A required parameter (`validate::required_param`)
/// is a plain field, so it cannot be left out.
///
/// It crosses the wire externally tagged (`{"Echo": {"echo": "…"}}`), each
/// variant closed by `deny_unknown_fields`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum NewVariableParams {
    /// `type: date` — `format`, `offset`, `tz`, `locale`; none is required.
    Date {
        /// `format`, a chrono format string.
        #[serde(default)]
        format: Option<String>,
        /// `offset`, written as plain source.
        #[serde(default)]
        offset: Option<String>,
        /// `tz`, an IANA zone name.
        #[serde(default)]
        tz: Option<String>,
        /// `locale`, a BCP 47 tag.
        #[serde(default)]
        locale: Option<String>,
    },
    /// `type: choice` — `values`, as strings. `{label, id}` records are 4-5's.
    Choice {
        /// `values`.
        values: Vec<String>,
    },
    /// `type: random` — `choices`.
    Random {
        /// `choices`.
        choices: Vec<String>,
    },
    /// `type: clipboard` — no parameters.
    Clipboard {},
    /// `type: echo` — `echo`.
    Echo {
        /// `echo`.
        echo: String,
    },
    /// `type: shell` — `cmd`, `shell`, `trim`, `debug`.
    Shell {
        /// `cmd`.
        cmd: String,
        /// `shell`, the interpreter's name.
        #[serde(default)]
        shell: Option<String>,
        /// `trim`, written as plain source.
        #[serde(default)]
        trim: Option<String>,
        /// `debug`, written as plain source.
        #[serde(default)]
        debug: Option<String>,
    },
    /// `type: script` — `args`, `trim`.
    Script {
        /// `args`.
        args: Vec<String>,
        /// `trim`, written as plain source.
        #[serde(default)]
        trim: Option<String>,
    },
    /// `type: form` — `layout`. Field definitions (`fields`) are 4-6's.
    Form {
        /// `layout`.
        layout: String,
    },
    /// `type: match` — `trigger`, the nested match reference.
    Match {
        /// `trigger`.
        trigger: String,
    },
}

impl NewVariableParams {
    /// The kind this variant is.
    pub fn kind(&self) -> VariableKind {
        match self {
            NewVariableParams::Date { .. } => VariableKind::Date,
            NewVariableParams::Choice { .. } => VariableKind::Choice,
            NewVariableParams::Random { .. } => VariableKind::Random,
            NewVariableParams::Clipboard {} => VariableKind::Clipboard,
            NewVariableParams::Echo { .. } => VariableKind::Echo,
            NewVariableParams::Shell { .. } => VariableKind::Shell,
            NewVariableParams::Script { .. } => VariableKind::Script,
            NewVariableParams::Form { .. } => VariableKind::Form,
            NewVariableParams::Match { .. } => VariableKind::Match,
        }
    } // End of function kind()

    /// The `type` text this variant is written with — espanso's own word, which
    /// [`VariableKind::from_text`] reads back as [`NewVariableParams::kind`].
    pub fn type_text(&self) -> &'static str {
        match self {
            NewVariableParams::Date { .. } => "date",
            NewVariableParams::Choice { .. } => "choice",
            NewVariableParams::Random { .. } => "random",
            NewVariableParams::Clipboard {} => "clipboard",
            NewVariableParams::Echo { .. } => "echo",
            NewVariableParams::Shell { .. } => "shell",
            NewVariableParams::Script { .. } => "script",
            NewVariableParams::Form { .. } => "form",
            NewVariableParams::Match { .. } => "match",
        }
    } // End of function type_text()

    /// Every `params` key this kind's own fields own, whether or not a given
    /// value sets it. An extra parameter may use none of them.
    pub fn owned_keys(&self) -> &'static [&'static str] {
        match self {
            NewVariableParams::Date { .. } => &["format", "offset", "tz", "locale"],
            NewVariableParams::Choice { .. } => &["values"],
            NewVariableParams::Random { .. } => &["choices"],
            NewVariableParams::Clipboard {} => &[],
            NewVariableParams::Echo { .. } => &["echo"],
            NewVariableParams::Shell { .. } => &["cmd", "shell", "trim", "debug"],
            NewVariableParams::Script { .. } => &["args", "trim"],
            // `fields` is the verbose form's definitions, which 4-6 writes; an
            // extra parameter must not reach it by name either.
            NewVariableParams::Form { .. } => &["layout", "fields"],
            NewVariableParams::Match { .. } => &["trigger"],
        }
    } // End of function owned_keys()

    /// The typed settings this value sets, with their text, in writing order.
    pub fn settings(&self) -> Vec<(VariableSetting, &str)> {
        let mut settings = Vec::new();
        match self {
            NewVariableParams::Date { offset, .. } => {
                settings.extend(
                    offset
                        .as_deref()
                        .map(|text| (VariableSetting::Offset, text)),
                );
            }
            NewVariableParams::Shell { trim, debug, .. } => {
                settings.extend(trim.as_deref().map(|text| (VariableSetting::Trim, text)));
                settings.extend(debug.as_deref().map(|text| (VariableSetting::Debug, text)));
            }
            NewVariableParams::Script { trim, .. } => {
                settings.extend(trim.as_deref().map(|text| (VariableSetting::Trim, text)));
            }
            _ => {}
        }
        settings
    } // End of function settings()

    /// The kind's own `params` entries, in the order plan section 3.4 lists
    /// them, typed as the engine writes them.
    fn entries(&self) -> Vec<(String, EntryValue)> {
        let scalar =
            |key: &str, value: &str| (key.to_owned(), EntryValue::Scalar(value.to_owned()));
        let plain =
            |key: &str, text: &str| (key.to_owned(), EntryValue::PlainSource(text.to_owned()));
        let list =
            |key: &str, items: &[String]| (key.to_owned(), EntryValue::ScalarList(items.to_vec()));
        let mut entries = Vec::new();
        match self {
            NewVariableParams::Date {
                format,
                offset,
                tz,
                locale,
            } => {
                entries.extend(format.as_deref().map(|value| scalar("format", value)));
                entries.extend(offset.as_deref().map(|text| plain("offset", text)));
                entries.extend(tz.as_deref().map(|value| scalar("tz", value)));
                entries.extend(locale.as_deref().map(|value| scalar("locale", value)));
            }
            NewVariableParams::Choice { values } => entries.push(list("values", values)),
            NewVariableParams::Random { choices } => entries.push(list("choices", choices)),
            NewVariableParams::Clipboard {} => {}
            NewVariableParams::Echo { echo } => entries.push(scalar("echo", echo)),
            NewVariableParams::Shell {
                cmd,
                shell,
                trim,
                debug,
            } => {
                entries.push(scalar("cmd", cmd));
                entries.extend(shell.as_deref().map(|value| scalar("shell", value)));
                entries.extend(trim.as_deref().map(|text| plain("trim", text)));
                entries.extend(debug.as_deref().map(|text| plain("debug", text)));
            }
            NewVariableParams::Script { args, trim } => {
                entries.push(list("args", args));
                entries.extend(trim.as_deref().map(|text| plain("trim", text)));
            }
            NewVariableParams::Form { layout } => entries.push(scalar("layout", layout)),
            NewVariableParams::Match { trigger } => entries.push(scalar("trigger", trigger)),
        } // End of the match over the nine kinds
        entries
    } // End of function entries()
} // End of impl NewVariableParams

/// A new local variable, as a closed description (Phase 4-4).
///
/// See the module documentation for what is closed by the type and what the
/// planner checks. `deny_unknown_fields` is deliberate, for
/// [`crate::draft::MatchDraft`]'s reason.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NewVariable {
    /// `name`, a logical string.
    pub name: String,
    /// The kind and its own parameters; `type` is derived from it.
    pub params: NewVariableParams,
    /// `inject_vars`, as plain source, or `None` for a variable born without it.
    #[serde(default)]
    pub inject_vars: Option<String>,
    /// `depends_on`, as logical strings, or `None` for a variable born without
    /// it. `Some` of an empty list is written `depends_on: []`.
    #[serde(default)]
    pub depends_on: Option<Vec<String>>,
    /// Extra author-named parameters, written after the kind's own, in order.
    /// At most [`NewVariable::MAX_EXTRA_PARAMS`].
    #[serde(default)]
    pub extra_params: Vec<NewParam>,
}

impl NewVariable {
    /// How many extra author-named parameters one new variable may carry.
    ///
    /// A bound, not a measurement of anything espanso limits: it keeps the
    /// description bounded, and a variable needing more is written in the file's
    /// text.
    pub const MAX_EXTRA_PARAMS: usize = 16;

    /// A new variable of the kind `params` describes, with no common field set.
    pub fn new(name: impl Into<String>, params: NewVariableParams) -> NewVariable {
        NewVariable {
            name: name.into(),
            params,
            inject_vars: None,
            depends_on: None,
            extra_params: Vec::new(),
        }
    }

    /// A `date` variable with no parameter set.
    pub fn date(name: impl Into<String>) -> NewVariable {
        NewVariable::new(
            name,
            NewVariableParams::Date {
                format: None,
                offset: None,
                tz: None,
                locale: None,
            },
        )
    } // End of function date()

    /// A `choice` variable offering `values`.
    pub fn choice(name: impl Into<String>, values: Vec<String>) -> NewVariable {
        NewVariable::new(name, NewVariableParams::Choice { values })
    }

    /// A `random` variable choosing among `choices`.
    pub fn random(name: impl Into<String>, choices: Vec<String>) -> NewVariable {
        NewVariable::new(name, NewVariableParams::Random { choices })
    }

    /// A `clipboard` variable.
    pub fn clipboard(name: impl Into<String>) -> NewVariable {
        NewVariable::new(name, NewVariableParams::Clipboard {})
    }

    /// An `echo` variable holding `echo`.
    pub fn echo(name: impl Into<String>, echo: impl Into<String>) -> NewVariable {
        NewVariable::new(name, NewVariableParams::Echo { echo: echo.into() })
    }

    /// A `shell` variable running `cmd`, with no optional parameter set.
    pub fn shell(name: impl Into<String>, cmd: impl Into<String>) -> NewVariable {
        NewVariable::new(
            name,
            NewVariableParams::Shell {
                cmd: cmd.into(),
                shell: None,
                trim: None,
                debug: None,
            },
        )
    } // End of function shell()

    /// A `script` variable running `args`.
    pub fn script(name: impl Into<String>, args: Vec<String>) -> NewVariable {
        NewVariable::new(name, NewVariableParams::Script { args, trim: None })
    }

    /// A `form` variable with `layout`.
    pub fn form(name: impl Into<String>, layout: impl Into<String>) -> NewVariable {
        NewVariable::new(
            name,
            NewVariableParams::Form {
                layout: layout.into(),
            },
        )
    }

    /// A `match` variable referring to the match triggered by `trigger`.
    pub fn match_reference(name: impl Into<String>, trigger: impl Into<String>) -> NewVariable {
        NewVariable::new(
            name,
            NewVariableParams::Match {
                trigger: trigger.into(),
            },
        )
    }

    /// Builder: sets `inject_vars` to a plain-source text.
    pub fn with_inject_vars(mut self, text: impl Into<String>) -> NewVariable {
        self.inject_vars = Some(text.into());
        self
    }

    /// Builder: sets `depends_on`.
    pub fn with_depends_on(mut self, names: Vec<String>) -> NewVariable {
        self.depends_on = Some(names);
        self
    }

    /// Builder: adds one extra author-named parameter.
    pub fn with_extra_param(mut self, param: NewParam) -> NewVariable {
        self.extra_params.push(param);
        self
    }

    /// The typed settings this variable sets, with their text: `inject_vars`
    /// first, then the kind's own.
    pub fn settings(&self) -> Vec<(VariableSetting, &str)> {
        self.inject_vars
            .as_deref()
            .map(|text| (VariableSetting::InjectVars, text))
            .into_iter()
            .chain(self.params.settings())
            .collect()
    }

    /// The fields the new item is written with, in writing order: `name`,
    /// `type`, `depends_on`, `inject_vars`, then `params` — the kind's own
    /// parameters followed by the extras — omitted when it would hold nothing.
    ///
    /// Pure translation: nothing is validated here, which is the planner's job.
    pub(crate) fn fields(&self) -> Vec<(String, ItemValue)> {
        let mut fields = vec![
            (
                NAME_KEY.to_owned(),
                ItemValue::Entry(EntryValue::Scalar(self.name.clone())),
            ),
            (
                TYPE_KEY.to_owned(),
                ItemValue::Entry(EntryValue::Scalar(self.params.type_text().to_owned())),
            ),
        ];
        if let Some(names) = &self.depends_on {
            fields.push((
                DEPENDS_ON_KEY.to_owned(),
                ItemValue::Entry(EntryValue::ScalarList(names.clone())),
            ));
        }
        if let Some(text) = &self.inject_vars {
            fields.push((
                INJECT_VARS_KEY.to_owned(),
                ItemValue::Entry(EntryValue::PlainSource(text.clone())),
            ));
        }
        let mut params = self.params.entries();
        params.extend(self.extra_params.iter().map(|param| {
            let value = match &param.value {
                crate::draft::NewParamValue::Scalar(value) => EntryValue::Scalar(value.clone()),
                crate::draft::NewParamValue::List(items) => EntryValue::ScalarList(items.clone()),
            };
            (param.key.clone(), value)
        }));
        if !params.is_empty() {
            fields.push((
                crate::draft::match_draft::PARAMS_KEY.to_owned(),
                ItemValue::Mapping(params),
            ));
        }
        fields
    } // End of function fields()
} // End of impl NewVariable

/// One intent about the **cardinality or the presence** of a match's `vars`
/// (Phase 4-4).
///
/// Every index is a position in the **original** projected list, exactly as a
/// [`crate::draft::SequenceIntent`]'s is. A reorder is deliberately **not** an
/// intent here: a move is alone in its batch (R25), so it has its own planner,
/// [`crate::draft::plan_variable_move`], and a draft cannot carry one beside
/// anything else by construction.
///
/// It crosses the wire as one entry of `MatchDraft::var_intents`, externally
/// tagged, each variant closed by `deny_unknown_fields`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum VarsIntent {
    /// Add one new variable at one place of an existing block `vars`, or — when
    /// the match has no `vars` — add the whole `vars:` subtree holding it
    /// (`Front` or `End` only; there is no item to be `After`).
    InsertVariable {
        /// Where, in the original list.
        at: ListPlacement,
        /// The new variable. Boxed because it is by far the largest variant.
        variable: Box<NewVariable>,
    },
    /// Take one variable away, with the comments it owns.
    ///
    /// Removing every variable this way is refused
    /// ([`crate::draft::DraftError::VarsWouldBeEmpty`]):
    /// [`VarsIntent::RemoveVars`] is the explicit intent for "no `vars`".
    RemoveVariable {
        /// The variable's index in the projected list.
        index: usize,
    },
    /// Remove the whole `vars` entry — key, every variable and the comments they
    /// own — as a deliberate container removal (ruling 8). A match without
    /// `vars` derives no edit.
    RemoveVars {},
}

impl VarsIntent {
    /// The intent that inserts `variable` at `at`.
    pub fn insert(at: ListPlacement, variable: NewVariable) -> VarsIntent {
        VarsIntent::InsertVariable {
            at,
            variable: Box::new(variable),
        }
    }
} // End of impl VarsIntent
