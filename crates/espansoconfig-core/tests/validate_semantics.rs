//! Phase 2a-2a acceptance: the espanso-semantic gate of plan section 6.6 step 5.
//!
//! Each of the plan's six rules gets fixtures on **both sides** of its
//! condition (`PROGRESS.md` R20): one document the rule must report and one it
//! must stay silent about. The silent side is the one that matters most — a
//! rule that fires on a working configuration is worse than no rule, because it
//! trains the user to ignore the whole report.
//!
//! # Fixtures are top-level constants, not corpus files
//!
//! Every fixture here is a hand-authored neutral `const` declared at the top
//! level of this file, and `every_fixture()` lists all of them. That is not a
//! style preference: the reachability and purity sweeps below are only as wide
//! as that list, so a fixture written inline inside a test silently narrows
//! them. `every_fixture_is_listed_in_every_fixture` reads this file's own source
//! and fails when a constant is declared and not listed.
//!
//! Nothing is added under `tests/corpus/synthetic/`, for two reasons:
//! `model_projection` pins a complete row per synthetic fixture and asserts the
//! table covers the corpus **exactly**, so a new file there would silently
//! change another binary's meaning; and `corpus_integrity` guards the fifteen
//! byte-exact fixtures, which have nothing to do with this phase.
//!
//! # Privacy
//!
//! The real-corpus test at the end reports **counts and file names only**
//! (`CLAUDE.md` section 1). It never prints a scalar, a key, a trigger or a
//! byte of the owner's configuration, and it skips cleanly when the gitignored
//! corpus is absent.

mod common;

use espansoconfig_core::model::DocumentContext;
use espansoconfig_core::patch::DocumentPath;
use espansoconfig_core::validate::{validate, Finding, FindingClass, FindingCode};
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::DocumentId;

/// Projects `source` as a detached match file and validates the projection.
fn findings_of(source: &str) -> Vec<Finding> {
    let context = DocumentContext::detached(DocumentId(1), "validate-fixture.yml");
    let document = project_source(&context, source);
    validate(&document.view)
} // End of function findings_of()

/// The code names `source` produces, in order.
fn code_names(source: &str) -> Vec<&'static str> {
    findings_of(source)
        .iter()
        .map(|finding| finding.code.name())
        .collect()
}

/// Asserts that `source` produces exactly the codes `expected` names.
fn assert_codes(source: &str, expected: &[&str]) {
    let found = code_names(source);
    assert_eq!(
        found, expected,
        "unexpected findings for fixture:\n{source}\nfound {found:?}"
    );
}

/// Asserts that `source` produces no finding at all.
fn assert_silent(source: &str) {
    let found = findings_of(source);
    let names: Vec<&str> = found.iter().map(|f| f.code.name()).collect();
    assert!(
        found.is_empty(),
        "expected no finding for fixture:\n{source}\nfound {names:?}"
    );
}

// ---------------------------------------------------------------------------
// Rule 1 — exactly one content field
// ---------------------------------------------------------------------------

/// Each of the five content fields, alone, with a trigger.
const ONE_CONTENT_FIELD_EACH: [&str; 5] = [
    "matches:\n  - trigger: \":a\"\n    replace: \"alpha\"\n",
    "matches:\n  - trigger: \":a\"\n    markdown: \"**alpha**\"\n",
    "matches:\n  - trigger: \":a\"\n    html: \"<b>alpha</b>\"\n",
    "matches:\n  - trigger: \":a\"\n    image_path: \"$CONFIG/alpha.png\"\n",
    "matches:\n  - trigger: \":a\"\n    form: \"Hello [[who]]\"\n",
];

/// A match with a trigger and no content at all.
const NO_CONTENT_FIELD: &str = "matches:\n  - trigger: \":a\"\n    label: \"alpha\"\n";

/// A match holding two content fields at once.
const TWO_CONTENT_FIELDS: &str =
    "matches:\n  - trigger: \":a\"\n    replace: \"alpha\"\n    html: \"<b>alpha</b>\"\n";

/// A `replace` holding a sequence: a malformed field rather than a content
/// field, which leaves the match with no content at all.
const CONTENT_FIELD_OF_THE_WRONG_SHAPE: &str =
    "matches:\n  - trigger: \":a\"\n    replace:\n      - alpha\n";

#[test]
fn exactly_one_content_field_is_not_reported() {
    for source in ONE_CONTENT_FIELD_EACH {
        assert_silent(source);
    }
}

#[test]
fn a_match_with_no_content_field_is_reported() {
    assert_codes(NO_CONTENT_FIELD, &["MatchHasNoContentField"]);
}

#[test]
fn a_match_with_two_content_fields_is_reported() {
    assert_codes(TWO_CONTENT_FIELDS, &["MatchHasSeveralContentFields"]);
}

/// The content rule counts **modelled** fields, so a `replace` holding a
/// sequence is a malformed field rather than a second content field. It leaves
/// the match with no content at all, which is the honest reading.
#[test]
fn a_content_field_of_the_wrong_shape_is_not_counted_as_a_content_field() {
    assert_codes(
        CONTENT_FIELD_OF_THE_WRONG_SHAPE,
        &["MatchHasNoContentField"],
    );
}

// ---------------------------------------------------------------------------
// Rule 2 — trigger xor triggers xor regex
// ---------------------------------------------------------------------------

/// Each of the three trigger forms, alone, with content.
const ONE_TRIGGER_FORM_EACH: [&str; 3] = [
    "matches:\n  - trigger: \":a\"\n    replace: \"alpha\"\n",
    "matches:\n  - triggers: [\":a\", \":b\"]\n    replace: \"alpha\"\n",
    "matches:\n  - regex: 'colou?r'\n    replace: \"alpha\"\n",
];

/// A match with content and no trigger side.
const NO_TRIGGER_FORM: &str = "matches:\n  - replace: \"alpha\"\n";

/// A match holding both `trigger` and `regex`.
const TWO_TRIGGER_FORMS: &str =
    "matches:\n  - trigger: \":a\"\n    regex: 'colou?r'\n    replace: \"alpha\"\n";

/// A match holding both `trigger` and `triggers`.
const A_TRIGGER_AND_A_TRIGGERS_LIST: &str =
    "matches:\n  - trigger: \":a\"\n    triggers: [\":b\"]\n    replace: \"alpha\"\n";

#[test]
fn exactly_one_trigger_form_is_not_reported() {
    for source in ONE_TRIGGER_FORM_EACH {
        assert_silent(source);
    }
}

#[test]
fn a_match_with_no_trigger_form_is_reported() {
    assert_codes(NO_TRIGGER_FORM, &["MatchHasNoTriggerField"]);
}

#[test]
fn a_match_with_a_trigger_and_a_regex_is_reported() {
    assert_codes(TWO_TRIGGER_FORMS, &["MatchHasSeveralTriggerForms"]);
}

/// `trigger` and `triggers` are two forms, not one — the rule is about the
/// three fields, not about "how many trigger strings".
#[test]
fn a_match_with_a_trigger_and_a_triggers_list_is_reported() {
    assert_codes(
        A_TRIGGER_AND_A_TRIGGERS_LIST,
        &["MatchHasSeveralTriggerForms"],
    );
}

// ---------------------------------------------------------------------------
// Rule 3 — valid variable types with their required params
// ---------------------------------------------------------------------------

/// One variable of every recognised type, each with the parameter espanso
/// 2.3.0 fails without, and each with a distinct name so rule 4 stays quiet.
///
/// `form` and `match` are here too: neither opens the reference scope, and this
/// fixture also exercises rule 5's silent side.
const EVERY_TYPE_WITH_ITS_PARAM: &str = "\
matches:
  - trigger: \":a\"
    replace: \"{{d}} {{c}} {{r}} {{cb}} {{e}} {{sh}} {{sc}} {{fm}} {{sub}}\"
    vars:
      - name: d
        type: date
        params:
          format: \"%Y\"
      - name: c
        type: choice
        params:
          values:
            - one
            - two
      - name: r
        type: random
        params:
          choices:
            - one
            - two
      - name: cb
        type: clipboard
      - name: e
        type: echo
        params:
          echo: \"text\"
      - name: sh
        type: shell
        params:
          cmd: \"echo hi\"
      - name: sc
        type: script
        params:
          args:
            - \"/bin/echo\"
            - \"hi\"
      - name: fm
        type: form
        params:
          layout: \"[[who]]\"
      - name: sub
        type: match
        params:
          trigger: \":b\"
";

/// A `date` variable with no `format`. Espanso 2.3.0 falls back to RFC 2822,
/// so nothing here may report it — this is the fixture that would fail if the
/// required-parameter table had been copied from espanso's documentation table
/// instead of from its source.
const DATE_WITHOUT_FORMAT: &str = "\
matches:
  - trigger: \":a\"
    replace: \"{{now}}\"
    vars:
      - name: now
        type: date
";

/// A `shell` variable with a `params` mapping that has no `cmd`.
const SHELL_WITHOUT_CMD: &str = "\
matches:
  - trigger: \":a\"
    replace: \"{{out}}\"
    vars:
      - name: out
        type: shell
        params:
          trim: true
";

/// A `shell` variable with no `params` key at all.
const SHELL_WITHOUT_ANY_PARAMS: &str =
    "matches:\n  - trigger: \":a\"\n    replace: \"x\"\n    vars:\n      - name: out\n        type: shell\n";

/// A variable with a `name` and no `type`.
const VARIABLE_WITHOUT_TYPE: &str = "\
matches:
  - trigger: \":a\"
    replace: \"{{thing}}\"
    vars:
      - name: thing
        params:
          echo: \"text\"
";

/// A variable whose `type` names none of the nine.
const VARIABLE_WITH_UNKNOWN_TYPE: &str = "\
matches:
  - trigger: \":a\"
    replace: \"{{thing}}\"
    vars:
      - name: thing
        type: teleport
        params:
          destination: \"there\"
";

/// A `type: match` variable whose `params` has no `trigger`.
///
/// Espanso's `get_matching_template` returns `None` without it and the renderer
/// answers that with `RendererError::MissingSubMatch`.
const MATCH_VARIABLE_WITHOUT_A_TRIGGER: &str = "\
matches:
  - trigger: \":a\"
    replace: \"{{sub}}\"
    vars:
      - name: sub
        type: match
        params:
          label: \"not a trigger\"
";

/// A `type: match` variable with the `trigger` espanso looks up.
const MATCH_VARIABLE_WITH_A_TRIGGER: &str = "\
matches:
  - trigger: \":a\"
    replace: \"{{sub}}\"
    vars:
      - name: sub
        type: match
        params:
          trigger: \":b\"
";

/// A `params` mapping whose keys come from an anchor defined elsewhere.
const SHELL_PARAMS_FROM_A_MERGE_KEY: &str = "\
defaults: &defaults
  cmd: \"echo hi\"
matches:
  - trigger: \":a\"
    replace: \"{{out}}\"
    vars:
      - name: out
        type: shell
        params:
          <<: *defaults
";

/// A `params` that is an alias to a node defined elsewhere in the document.
const SHELL_PARAMS_ARE_AN_ALIAS: &str = "\
defaults: &defaults
  cmd: \"echo hi\"
matches:
  - trigger: \":a\"
    replace: \"{{out}}\"
    vars:
      - name: out
        type: shell
        params: *defaults
";

/// A `params` that is a scalar. A scalar holds no mapping entry under any key,
/// so `cmd` really is absent.
const SHELL_PARAMS_ARE_A_SCALAR: &str = "\
matches:
  - trigger: \":a\"
    replace: \"{{out}}\"
    vars:
      - name: out
        type: shell
        params: \"echo hi\"
";

/// The same for a `params` that is a sequence.
const SHELL_PARAMS_ARE_A_SEQUENCE: &str = "\
matches:
  - trigger: \":a\"
    replace: \"{{out}}\"
    vars:
      - name: out
        type: shell
        params:
          - \"echo hi\"
";

#[test]
fn every_recognised_type_with_its_required_param_is_not_reported() {
    assert_silent(EVERY_TYPE_WITH_ITS_PARAM);
}

#[test]
fn a_date_variable_without_a_format_is_not_reported() {
    assert_silent(DATE_WITHOUT_FORMAT);
}

#[test]
fn a_shell_variable_without_a_cmd_is_reported() {
    assert_codes(SHELL_WITHOUT_CMD, &["VariableMissingRequiredParam"]);
}

#[test]
fn a_shell_variable_with_no_params_mapping_at_all_is_reported() {
    assert_codes(SHELL_WITHOUT_ANY_PARAMS, &["VariableMissingRequiredParam"]);
}

#[test]
fn a_variable_with_no_type_is_reported() {
    assert_codes(VARIABLE_WITHOUT_TYPE, &["VariableHasNoType"]);
}

#[test]
fn a_variable_whose_type_is_not_one_of_the_nine_is_reported_as_suspicious() {
    let found = findings_of(VARIABLE_WITH_UNKNOWN_TYPE);
    assert_eq!(found.len(), 1, "one finding, found {found:?}");
    assert_eq!(
        found[0].code,
        FindingCode::VariableTypeNotRecognised {
            declared: "teleport".to_owned()
        }
    );
    assert_eq!(found[0].class(), FindingClass::SuspiciousButPermitted);
} // End of function a_variable_whose_type_is_not_one_of_the_nine_is_reported_as_suspicious()

/// The `match` type is resolved by espanso's renderer rather than by one of its
/// eight registered extensions, and without `params.trigger` that resolution
/// fails: `get_matching_template` returns `None` and the renderer turns that
/// into `RendererError::MissingSubMatch`. That is the same kind of evidence as
/// every other row of the required-parameter table.
#[test]
fn a_match_variable_without_a_trigger_param_is_reported() {
    let found = findings_of(MATCH_VARIABLE_WITHOUT_A_TRIGGER);
    assert_eq!(found.len(), 1, "one finding, found {found:?}");
    assert_eq!(
        found[0].code,
        FindingCode::VariableMissingRequiredParam {
            kind: espansoconfig_core::model::VariableKind::Match,
            param: "trigger".to_owned(),
        }
    );
} // End of function a_match_variable_without_a_trigger_param_is_reported()

#[test]
fn a_match_variable_with_a_trigger_param_is_not_reported() {
    assert_silent(MATCH_VARIABLE_WITH_A_TRIGGER);
}

/// A `params` this crate could not read is a `params` it must not judge. The
/// merge key takes entries from an anchor defined elsewhere in the document, so
/// `cmd` may well be there.
#[test]
fn a_shell_variable_whose_params_come_from_a_merge_key_is_not_reported() {
    assert_silent(SHELL_PARAMS_FROM_A_MERGE_KEY);
}

/// The same for an alias: `params: *defaults` names a node this crate did not
/// follow, and that node may be a mapping holding `cmd`.
#[test]
fn a_shell_variable_whose_params_are_an_alias_is_not_reported() {
    assert_silent(SHELL_PARAMS_ARE_AN_ALIAS);
}

/// A scalar `params` is a different case from an alias, and the difference is
/// the whole point: a scalar cannot hold a mapping entry under **any** key, so
/// the absence of `cmd` is a fact rather than a gap in what was read. Espanso
/// agrees about the shape — `YAMLVariable::params` is a `Mapping`, so such a
/// file does not deserialize at all.
#[test]
fn a_shell_variable_whose_params_are_a_scalar_is_reported() {
    assert_codes(SHELL_PARAMS_ARE_A_SCALAR, &["VariableMissingRequiredParam"]);
}

/// And a sequence, for the same reason.
#[test]
fn a_shell_variable_whose_params_are_a_sequence_is_reported() {
    assert_codes(
        SHELL_PARAMS_ARE_A_SEQUENCE,
        &["VariableMissingRequiredParam"],
    );
}

// ---------------------------------------------------------------------------
// Rule 4 — unique variable names
// ---------------------------------------------------------------------------

/// Two variables of one match, with different names.
const TWO_DISTINCT_NAMES: &str = "\
matches:
  - trigger: \":a\"
    replace: \"{{one}} {{two}}\"
    vars:
      - name: one
        type: echo
        params:
          echo: \"1\"
      - name: two
        type: echo
        params:
          echo: \"2\"
";

/// Two variables of one match declaring the same name.
const TWO_IDENTICAL_NAMES: &str = "\
matches:
  - trigger: \":a\"
    replace: \"{{one}}\"
    vars:
      - name: one
        type: echo
        params:
          echo: \"1\"
      - name: one
        type: echo
        params:
          echo: \"2\"
";

/// Two `global_vars` declaring the same name.
const TWO_IDENTICAL_GLOBAL_NAMES: &str = "\
global_vars:
  - name: one
    type: echo
    params:
      echo: \"a\"
  - name: one
    type: echo
    params:
      echo: \"b\"
matches:
  - trigger: \":a\"
    replace: \"{{one}}\"
";

/// A match-local variable with the same name as a global one. Espanso's
/// documented shadowing, and **not** a duplicate: uniqueness is scoped to one
/// sequence.
const MATCH_VARIABLE_SHADOWS_A_GLOBAL: &str = "\
global_vars:
  - name: one
    type: echo
    params:
      echo: \"global\"
matches:
  - trigger: \":a\"
    replace: \"{{one}}\"
    vars:
      - name: one
        type: echo
        params:
          echo: \"local\"
";

#[test]
fn two_variables_with_different_names_are_not_reported() {
    assert_silent(TWO_DISTINCT_NAMES);
}

#[test]
fn two_variables_of_one_match_with_the_same_name_are_reported() {
    assert_codes(TWO_IDENTICAL_NAMES, &["DuplicateVariableName"]);
}

#[test]
fn a_match_variable_shadowing_a_global_variable_is_not_reported() {
    assert_silent(MATCH_VARIABLE_SHADOWS_A_GLOBAL);
}

#[test]
fn two_global_variables_with_the_same_name_are_reported() {
    assert_codes(TWO_IDENTICAL_GLOBAL_NAMES, &["DuplicateVariableName"]);
}

/// The finding's node and span are the **second** declaration's, so an editor
/// puts the caret on the later of the two rather than on the earlier.
///
/// That is all this test proves. It says nothing about which declaration
/// espanso uses — for that, see `docs/decisions/2a-2a-notes.md` section 12,
/// which records what espanso's own dependency graph does with a repeated name
/// and why the finding is still attached here.
#[test]
fn the_duplicate_finding_names_the_second_declaration() {
    let context = DocumentContext::detached(DocumentId(1), "validate-fixture.yml");
    let document = project_source(&context, TWO_IDENTICAL_NAMES);
    let first = &document.view.matches[0].vars[0];
    let second = &document.view.matches[0].vars[1];
    let found = validate(&document.view);
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].node, Some(second.node));
    assert_eq!(found[0].span, Some(second.span));
    assert_ne!(
        found[0].node,
        Some(first.node),
        "the two declarations must be distinguishable"
    );
} // End of function the_duplicate_finding_names_the_second_declaration()

/// Duplicate detection over a large sequence stays correct.
///
/// **Not a benchmark and not a timing assertion.** It exists because the
/// duplicate check and the reference lookup are the two places a document can
/// make this pass quadratic, and this pass runs while the save lock is held;
/// this fixture is the size at which a defect in the set-based bookkeeping
/// shows up as a wrong answer rather than as a slow one.
#[test]
fn a_large_variable_scope_still_reports_exactly_the_one_duplicate() {
    let mut source = String::from("global_vars:\n");
    for index in 0..1_000 {
        source.push_str(&format!(
            "  - name: v{index}\n    type: echo\n    params:\n      echo: \"{index}\"\n"
        ));
    }
    source.push_str("  - name: v0\n    type: echo\n    params:\n      echo: \"again\"\n");
    source.push_str("matches:\n  - trigger: \":a\"\n    replace: \"{{v0}} {{v999}}\"\n");
    assert_codes(&source, &["DuplicateVariableName"]);
} // End of function a_large_variable_scope_still_reports_exactly_the_one_duplicate()

// ---------------------------------------------------------------------------
// Rule 5 — {{references}} where statically knowable
// ---------------------------------------------------------------------------

/// A reference to a name nothing declares, in a document with a closed scope.
const UNDECLARED_REFERENCE: &str = "\
matches:
  - trigger: \":a\"
    replace: \"Hello {{nobody}}\"
";

/// The same reference in `markdown`.
const UNDECLARED_REFERENCE_IN_MARKDOWN: &str =
    "matches:\n  - trigger: \":a\"\n    markdown: \"**{{nobody}}**\"\n";

/// The same reference in `html`.
const UNDECLARED_REFERENCE_IN_HTML: &str =
    "matches:\n  - trigger: \":a\"\n    html: \"<b>{{nobody}}</b>\"\n";

/// A regex whose named capture group is the name the body references.
const REGEX_CAPTURE_GROUP_REFERENCE: &str =
    "matches:\n  - regex: '(?P<who>\\w+)-greet'\n    replace: \"Hello {{who}}\"\n";

/// The same document with the group renamed, so the reference no longer
/// resolves.
const REGEX_CAPTURE_GROUP_RENAMED: &str =
    "matches:\n  - regex: '(?P<other>\\w+)-greet'\n    replace: \"Hello {{who}}\"\n";

/// A document with `imports`, which bring another file's `global_vars` in.
const REFERENCE_WITH_IMPORTS: &str =
    "imports:\n  - \"shared.yml\"\nmatches:\n  - trigger: \":a\"\n    replace: \"Hello {{nobody}}\"\n";

/// A `form:` shorthand holding a brace pair, and no other content field.
const FORM_SHORTHAND_WITH_A_BRACE_PAIR: &str =
    "matches:\n  - trigger: \":a\"\n    form: \"Hello [[who]] {{nobody}}\"\n";

/// A `form:` shorthand **beside** a `replace`.
///
/// Espanso's loader takes `replace`/`markdown`/`html` first and only falls
/// through to `form` when none is present, so in this shape no `form1` variable
/// is synthesised and the body's reference really is unresolved.
const FORM_SHORTHAND_BESIDE_A_REPLACE: &str =
    "matches:\n  - trigger: \":a\"\n    form: \"[[who]]\"\n    replace: \"Hello {{nobody}}\"\n";

/// `global_vars` that is not a sequence.
const UNREADABLE_GLOBAL_VARS: &str =
    "global_vars: \"not a sequence\"\nmatches:\n  - trigger: \":a\"\n    replace: \"{{nobody}}\"\n";

/// A match's `vars` that is not a sequence.
const UNREADABLE_VARS: &str =
    "matches:\n  - trigger: \":a\"\n    replace: \"{{nobody}}\"\n    vars: \"not a sequence\"\n";

/// An `imports` that is not a sequence.
const UNREADABLE_IMPORTS: &str =
    "imports: \"shared.yml\"\nmatches:\n  - trigger: \":a\"\n    replace: \"{{nobody}}\"\n";

/// A `type: form` variable and a dotted reference under its own name.
const FORM_VARIABLE_WITH_A_DOTTED_REFERENCE: &str = "\
matches:
  - trigger: \":a\"
    replace: \"Hello {{f.who}}\"
    vars:
      - name: f
        type: form
        params:
          layout: \"[[who]]\"
";

/// The same form variable, plus a bare reference it cannot explain.
const FORM_VARIABLE_WITH_AN_UNDECLARED_REFERENCE: &str = "\
matches:
  - trigger: \":a\"
    replace: \"Hello {{f.who}} {{nobody}}\"
    vars:
      - name: f
        type: form
        params:
          layout: \"[[who]]\"
";

/// A `type: match` variable and a reference to its own name.
const NESTED_MATCH_VARIABLE: &str = "\
matches:
  - trigger: \":a\"
    replace: \"Hello {{sub}}\"
    vars:
      - name: sub
        type: match
        params:
          trigger: \":b\"
";

/// The same nested-match variable, plus a name nothing declares.
const NESTED_MATCH_VARIABLE_WITH_AN_UNDECLARED_REFERENCE: &str = "\
matches:
  - trigger: \":a\"
    replace: \"Hello {{sub}} {{nobody}}\"
    vars:
      - name: sub
        type: match
        params:
          trigger: \":b\"
";

/// A variable that sets `inject_vars: true` and a reference nothing declares.
const INJECTION_ON_WITH_AN_UNDECLARED_REFERENCE: &str = "\
matches:
  - trigger: \":a\"
    replace: \"Hello {{e}} {{nobody}}\"
    vars:
      - name: e
        type: echo
        inject_vars: true
        params:
          echo: \"text\"
";

/// The same document with `inject_vars: false`. Injection is what the field
/// switches off; it does not switch off the body's own references.
const INJECTION_OFF_WITH_AN_UNDECLARED_REFERENCE: &str = "\
matches:
  - trigger: \":a\"
    replace: \"Hello {{e}} {{nobody}}\"
    vars:
      - name: e
        type: echo
        inject_vars: false
        params:
          echo: \"text\"
";

/// A variable with no `name`, and a reference nothing declares.
///
/// The nameless variable cannot be the declaration, and espanso is stricter
/// still: `YAMLVariable::name` has no serde default, so such a file does not
/// load at all.
const VARIABLE_WITH_NO_NAME: &str = "\
matches:
  - trigger: \":a\"
    replace: \"Hello {{nobody}}\"
    vars:
      - type: echo
        params:
          echo: \"text\"
";

/// A nameless variable beside a named one the body actually references.
const VARIABLE_WITH_NO_NAME_BESIDE_A_DECLARED_ONE: &str = "\
matches:
  - trigger: \":a\"
    replace: \"Hello {{who}}\"
    vars:
      - type: echo
        params:
          echo: \"text\"
      - name: who
        type: echo
        params:
          echo: \"world\"
";

/// Text espanso's own `VAR_REGEX` does not recognise.
const BRACE_PAIR_ESPANSO_IGNORES: &str =
    "matches:\n  - trigger: \":a\"\n    replace: \"{{ not-a-name }} and { single }\"\n";

/// A dotted reference whose name before the dot is declared.
const DOTTED_REFERENCE_DECLARED: &str = "\
matches:
  - trigger: \":a\"
    replace: \"{{one.field}}\"
    vars:
      - name: one
        type: echo
        params:
          echo: \"1\"
";

/// A dotted reference whose name before the dot is not declared.
const DOTTED_REFERENCE_UNDECLARED: &str =
    "matches:\n  - trigger: \":a\"\n    replace: \"{{other.field}}\"\n";

/// A brace pair inside an `image_path`, which names a file rather than a
/// template.
const BRACE_PAIR_IN_AN_IMAGE_PATH: &str =
    "matches:\n  - trigger: \":a\"\n    image_path: \"$CONFIG/{{nobody}}.png\"\n";

/// A `shell` variable whose `cmd` references a name nothing declares.
///
/// Espanso substitutes into parameters when `inject_vars` is on, which it is by
/// default, and an unresolvable parameter reference is a `MissingVariable`
/// error from its dependency resolver.
const PARAM_REFERENCES_A_MISSING_NAME: &str = "\
matches:
  - trigger: \":a\"
    replace: \"{{out}}\"
    vars:
      - name: out
        type: shell
        params:
          cmd: \"echo {{nobody}}\"
";

/// The same shape with the referenced name declared beside it.
const PARAM_REFERENCES_A_DECLARED_NAME: &str = "\
matches:
  - trigger: \":a\"
    replace: \"{{out}}\"
    vars:
      - name: who
        type: echo
        params:
          echo: \"world\"
      - name: out
        type: shell
        params:
          cmd: \"echo {{who}}\"
";

/// The same missing name, with injection switched off. Espanso passes the
/// parameter through untouched, so the braces are literal text.
const PARAM_REFERENCE_WITH_INJECTION_OFF: &str = "\
matches:
  - trigger: \":a\"
    replace: \"{{out}}\"
    vars:
      - name: out
        type: shell
        inject_vars: false
        params:
          cmd: \"echo {{nobody}}\"
";

/// A missing name inside a **sequence** parameter, which espanso's parameter
/// walk descends into.
const NESTED_PARAM_REFERENCES_A_MISSING_NAME: &str = "\
matches:
  - trigger: \":a\"
    replace: \"{{out}}\"
    vars:
      - name: out
        type: script
        params:
          args:
            - \"/bin/echo\"
            - \"{{nobody}}\"
";

/// A form variable whose `layout` references a name nothing declares.
const FORM_LAYOUT_REFERENCES_A_MISSING_NAME: &str = "\
matches:
  - trigger: \":a\"
    replace: \"{{f.who}}\"
    vars:
      - name: f
        type: form
        params:
          layout: \"[[who]] {{nobody}}\"
";

/// A brace pair used as a parameter **key**. Espanso walks `params.values()`
/// and, inside an object, `fields.values()`; a key is never a template.
const PARAM_KEY_HOLDING_A_BRACE_PAIR: &str = "\
matches:
  - trigger: \":a\"
    replace: \"{{out}}\"
    vars:
      - name: out
        type: shell
        params:
          cmd: \"echo hi\"
          \"{{nobody}}\": \"value\"
";

#[test]
fn a_reference_to_a_declared_variable_is_not_reported() {
    assert_silent(TWO_DISTINCT_NAMES);
}

#[test]
fn a_reference_to_a_global_variable_is_not_reported() {
    assert_silent(MATCH_VARIABLE_SHADOWS_A_GLOBAL);
}

#[test]
fn a_reference_to_a_name_nothing_declares_is_reported() {
    let found = findings_of(UNDECLARED_REFERENCE);
    assert_eq!(found.len(), 1, "one finding, found {found:?}");
    assert_eq!(
        found[0].code,
        FindingCode::ReferenceHasNoDeclaration {
            name: "nobody".to_owned()
        }
    );
    assert_eq!(found[0].class(), FindingClass::SuspiciousButPermitted);
} // End of function a_reference_to_a_name_nothing_declares_is_reported()

/// Espanso turns a regex's named capture groups into references, so a pattern
/// that declares one closes the scope for it.
#[test]
fn a_reference_to_a_regex_capture_group_is_not_reported() {
    assert_silent(REGEX_CAPTURE_GROUP_REFERENCE);
}

/// The same document with the group renamed: the reference no longer resolves,
/// which is what shows the capture-group half of the scope is really read.
#[test]
fn a_reference_to_a_capture_group_that_does_not_exist_is_reported() {
    assert_codes(REGEX_CAPTURE_GROUP_RENAMED, &["ReferenceHasNoDeclaration"]);
}

/// `imports` bring another file's `global_vars` into scope, and this crate does
/// not read that file. The scope is open, so rule 5 says nothing.
#[test]
fn a_reference_is_not_reported_when_the_document_has_imports() {
    assert_silent(REFERENCE_WITH_IMPORTS);
}

/// A `form:` shorthand is not a template: espanso rewrites it into a `replace`
/// plus a synthesised `form1` variable, so the field itself is never scanned.
#[test]
fn a_brace_pair_in_a_form_shorthand_is_not_reported() {
    assert_silent(FORM_SHORTHAND_WITH_A_BRACE_PAIR);
}

/// A `form:` beside a `replace` is a different document, and espanso reads it
/// differently: its loader takes the first of `replace`, `markdown` and `html`
/// and only reaches `form` when none of them is present. No `form1` variable is
/// synthesised, so the body's `{{nobody}}` is as unresolved as it looks.
#[test]
fn a_reference_beside_a_form_field_is_reported_because_espanso_ignores_the_form() {
    assert_codes(
        FORM_SHORTHAND_BESIDE_A_REPLACE,
        &["MatchHasSeveralContentFields", "ReferenceHasNoDeclaration"],
    );
} // End of function a_reference_beside_a_form_field_is_reported_because_espanso_ignores_the_form()

/// `global_vars` that is not a sequence was recorded whole rather than
/// projected, so its members were never read and cannot be said to be absent.
#[test]
fn a_reference_is_not_reported_when_global_vars_could_not_be_read() {
    assert_silent(UNREADABLE_GLOBAL_VARS);
}

/// The same for a match's own `vars`.
#[test]
fn a_reference_is_not_reported_when_vars_could_not_be_read() {
    assert_silent(UNREADABLE_VARS);
}

/// And for an `imports` that is not a sequence: it is still an `imports`, and
/// the file it names may declare the missing variable.
#[test]
fn a_reference_is_not_reported_when_imports_could_not_be_read() {
    assert_silent(UNREADABLE_IMPORTS);
}

/// A `type: form` variable declares its own name and nothing else. The form
/// extension's output is stored under that name as an
/// `ExtensionOutput::Multiple`, which is what makes `{{f.who}}` resolve — the
/// reference pattern's `name` capture stops at the dot.
#[test]
fn a_dotted_reference_under_a_form_variables_name_is_not_reported() {
    assert_silent(FORM_VARIABLE_WITH_A_DOTTED_REFERENCE);
}

/// The other side of that: a form variable explains references under **its**
/// name, not arbitrary ones.
#[test]
fn a_bare_reference_beside_a_form_variable_is_still_reported() {
    assert_codes(
        FORM_VARIABLE_WITH_AN_UNDECLARED_REFERENCE,
        &["ReferenceHasNoDeclaration"],
    );
}

/// A `type: match` variable declares its own name: the renderer's recursive
/// branch does `scope.insert(&variable.name, …)` and renders the sub-match with
/// a scope of its own.
#[test]
fn a_reference_to_a_nested_match_variables_own_name_is_not_reported() {
    assert_silent(NESTED_MATCH_VARIABLE);
}

/// The other side: the sub-match's variables are not visible here, and neither
/// is anything else the outer document does not declare.
#[test]
fn a_bare_reference_beside_a_nested_match_variable_is_still_reported() {
    assert_codes(
        NESTED_MATCH_VARIABLE_WITH_AN_UNDECLARED_REFERENCE,
        &["ReferenceHasNoDeclaration"],
    );
}

/// `inject_vars` decides whether a variable's own **parameters** get
/// substitution. It puts no name into the template's scope, so it cannot
/// explain a body reference — with either value.
#[test]
fn a_body_reference_is_reported_whichever_way_inject_vars_is_written() {
    assert_codes(
        INJECTION_ON_WITH_AN_UNDECLARED_REFERENCE,
        &["ReferenceHasNoDeclaration"],
    );
    assert_codes(
        INJECTION_OFF_WITH_AN_UNDECLARED_REFERENCE,
        &["ReferenceHasNoDeclaration"],
    );
} // End of function a_body_reference_is_reported_whichever_way_inject_vars_is_written()

/// A variable with no `name` declares nothing, so it cannot be the missing
/// declaration.
///
/// "Every variable has a name" is **not** one of plan section 6.6's six rules,
/// so nothing here reports the nameless variable itself — the projection
/// already does, as `DiagnosticCode::VariableHasNoName`.
#[test]
fn a_reference_beside_a_nameless_variable_is_still_reported() {
    assert_codes(VARIABLE_WITH_NO_NAME, &["ReferenceHasNoDeclaration"]);
}

/// The silent side: a nameless variable does not stop a reference that some
/// other variable does declare from resolving.
#[test]
fn a_nameless_variable_does_not_make_a_declared_reference_unresolved() {
    assert_silent(VARIABLE_WITH_NO_NAME_BESIDE_A_DECLARED_ONE);
}

/// Text espanso's own `VAR_REGEX` does not recognise is not a reference, and
/// reporting it would fire on every snippet that expands to a mustache
/// template.
#[test]
fn a_brace_pair_espanso_does_not_recognise_is_not_reported() {
    assert_silent(BRACE_PAIR_ESPANSO_IGNORES);
}

/// A dotted reference resolves on the part before the dot, which is what
/// espanso's `name`/`subname` split does.
#[test]
fn a_dotted_reference_resolves_on_the_name_before_the_dot() {
    assert_silent(DOTTED_REFERENCE_DECLARED);
    let found = findings_of(DOTTED_REFERENCE_UNDECLARED);
    assert_eq!(
        found[0].code,
        FindingCode::ReferenceHasNoDeclaration {
            name: "other".to_owned()
        }
    );
} // End of function a_dotted_reference_resolves_on_the_name_before_the_dot()

/// `markdown` and `html` go through the same renderer as `replace`.
#[test]
fn a_reference_in_markdown_or_html_is_reported_too() {
    assert_codes(
        UNDECLARED_REFERENCE_IN_MARKDOWN,
        &["ReferenceHasNoDeclaration"],
    );
    assert_codes(UNDECLARED_REFERENCE_IN_HTML, &["ReferenceHasNoDeclaration"]);
}

/// `image_path` names a file, not a template, so a brace pair in one is not a
/// reference.
#[test]
fn a_brace_pair_in_an_image_path_is_not_reported() {
    assert_silent(BRACE_PAIR_IN_AN_IMAGE_PATH);
}

/// A parameter is a template too. Espanso's `inject_variables_into_params`
/// runs the same `render_variables` over it that the body gets, and its
/// dependency resolver fails on a name it cannot find.
#[test]
fn a_reference_inside_a_variable_parameter_is_reported() {
    let found = findings_of(PARAM_REFERENCES_A_MISSING_NAME);
    assert_eq!(found.len(), 1, "one finding, found {found:?}");
    assert_eq!(
        found[0].code,
        FindingCode::ReferenceHasNoDeclaration {
            name: "nobody".to_owned()
        }
    );
    assert_eq!(found[0].class(), FindingClass::SuspiciousButPermitted);
} // End of function a_reference_inside_a_variable_parameter_is_reported()

/// The silent side: a parameter reference to a variable declared beside it.
#[test]
fn a_parameter_reference_to_a_declared_name_is_not_reported() {
    assert_silent(PARAM_REFERENCES_A_DECLARED_NAME);
}

/// With `inject_vars: false` espanso passes the parameters through untouched,
/// so the braces are literal text and reporting them would fire on a working
/// configuration. This is the one place the field genuinely changes what rule 5
/// may say.
#[test]
fn a_parameter_reference_is_not_reported_when_injection_is_off() {
    assert_silent(PARAM_REFERENCE_WITH_INJECTION_OFF);
}

/// Espanso's parameter walk recurses into arrays and objects, so a reference
/// inside a sequence parameter is scanned too.
#[test]
fn a_reference_inside_a_nested_parameter_value_is_reported() {
    assert_codes(
        NESTED_PARAM_REFERENCES_A_MISSING_NAME,
        &["ReferenceHasNoDeclaration"],
    );
}

/// A form's `layout` is a parameter like any other.
#[test]
fn a_reference_inside_a_form_layout_is_reported() {
    assert_codes(
        FORM_LAYOUT_REFERENCES_A_MISSING_NAME,
        &["ReferenceHasNoDeclaration"],
    );
}

/// Parameter **keys** are not templates: espanso walks values only.
#[test]
fn a_brace_pair_in_a_parameter_key_is_not_reported() {
    assert_silent(PARAM_KEY_HOLDING_A_BRACE_PAIR);
}

/// The parameter finding points at the parameter's own scalar and names it by
/// path, so an editor can put the caret inside the `cmd` rather than on the
/// whole variable.
#[test]
fn a_parameter_finding_names_the_parameter_scalar() {
    let context = DocumentContext::detached(DocumentId(1), "validate-fixture.yml");
    let document = project_source(&context, PARAM_REFERENCES_A_MISSING_NAME);
    let variable = &document.view.matches[0].vars[0];
    let scalar = match &variable.params[0].value {
        espansoconfig_core::model::ValueView::Scalar(scalar) => scalar,
        other => panic!("the fixture's cmd is a scalar, found {other:?}"),
    };
    let found = validate(&document.view);
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].node, Some(scalar.node));
    assert_eq!(found[0].span, Some(scalar.span));
    assert_eq!(
        found[0].path,
        Some(DocumentPath::parse("matches[0].vars[0].params.cmd").expect("a well-formed path"))
    );
} // End of function a_parameter_finding_names_the_parameter_scalar()

// ---------------------------------------------------------------------------
// Rule 6 — the regex compiles
// ---------------------------------------------------------------------------

/// A pattern that compiles under this crate's `regex`.
const REGEX_THAT_COMPILES: &str = "matches:\n  - regex: 'colou?r'\n    replace: \"alpha\"\n";

/// A pattern with an unclosed group.
const REGEX_THAT_DOES_NOT_COMPILE: &str =
    "matches:\n  - regex: '(unclosed'\n    replace: \"alpha\"\n";

/// The same uncompilable pattern, in a match whose body holds a reference.
const REGEX_THAT_DOES_NOT_COMPILE_WITH_A_REFERENCE: &str =
    "matches:\n  - regex: '(unclosed'\n    replace: \"Hello {{who}}\"\n";

#[test]
fn a_regex_that_compiles_is_not_reported() {
    assert_silent(REGEX_THAT_COMPILES);
}

#[test]
fn a_regex_that_does_not_compile_is_reported() {
    let found = findings_of(REGEX_THAT_DOES_NOT_COMPILE);
    assert_eq!(found.len(), 1, "one finding, found {found:?}");
    assert_eq!(found[0].code.name(), "RegexDoesNotCompile");
    assert_eq!(found[0].class(), FindingClass::EditorModelError);
    match &found[0].code {
        FindingCode::RegexDoesNotCompile { detail } => {
            assert!(!detail.is_empty(), "the crate's own diagnostic is carried");
        }
        other => panic!("wrong code: {other:?}"),
    }
} // End of function a_regex_that_does_not_compile_is_reported()

/// The finding points at the `regex` scalar, not at the whole match, so an
/// editor can put the caret on the pattern.
#[test]
fn the_regex_finding_names_the_pattern_scalar() {
    let context = DocumentContext::detached(DocumentId(1), "validate-fixture.yml");
    let document = project_source(&context, REGEX_THAT_DOES_NOT_COMPILE);
    let pattern = document.view.matches[0]
        .trigger
        .regex
        .as_ref()
        .expect("the fixture has a regex");
    let found = validate(&document.view);
    assert_eq!(found[0].node, Some(pattern.node));
    assert_eq!(found[0].span, Some(pattern.span));
} // End of function the_regex_finding_names_the_pattern_scalar()

/// A pattern that does not compile also takes rule 5 out of play: its capture
/// groups could not be read, so the name set is not knowable.
#[test]
fn a_regex_that_does_not_compile_silences_the_reference_rule() {
    assert_codes(
        REGEX_THAT_DOES_NOT_COMPILE_WITH_A_REFERENCE,
        &["RegexDoesNotCompile"],
    );
}

// ---------------------------------------------------------------------------
// Cross-cutting
// ---------------------------------------------------------------------------

/// A document the substrate rejects.
const DOCUMENT_THAT_DOES_NOT_PARSE: &str = "matches:\n  - trigger: \"unterminated\n";

/// A document with nothing in it at all.
const EMPTY_DOCUMENT: &str = "";

/// A document holding only a comment.
const COMMENTS_ONLY_DOCUMENT: &str = "# only a comment\n";

/// A configuration profile, which has no `matches` at all.
const CONFIG_PROFILE: &str = "backend: clipboard\ntoggle_key: ALT\n";

/// A `matches` sequence item that is not a mapping.
const MATCHES_ENTRY_THAT_IS_NOT_A_MAPPING: &str = "matches:\n  - \"just a string\"\n";

/// Three matches, the second and third each missing one side.
const THREE_MATCHES_IN_DOCUMENT_ORDER: &str = "\
matches:
  - trigger: \":a\"
    replace: \"alpha\"
  - trigger: \":b\"
  - replace: \"gamma\"
";

/// Every fixture in this file, so the reachability sweeps below cannot be
/// narrowed by forgetting one.
///
/// `every_fixture_is_listed_in_every_fixture` reads this file's own source and
/// fails when a constant is declared above and not named here, which is what
/// makes the name of this function true rather than aspirational.
fn every_fixture() -> Vec<&'static str> {
    let mut all: Vec<&'static str> = Vec::new();
    all.extend(ONE_CONTENT_FIELD_EACH);
    all.extend(ONE_TRIGGER_FORM_EACH);
    all.extend([
        NO_CONTENT_FIELD,
        TWO_CONTENT_FIELDS,
        CONTENT_FIELD_OF_THE_WRONG_SHAPE,
        NO_TRIGGER_FORM,
        TWO_TRIGGER_FORMS,
        A_TRIGGER_AND_A_TRIGGERS_LIST,
        EVERY_TYPE_WITH_ITS_PARAM,
        DATE_WITHOUT_FORMAT,
        SHELL_WITHOUT_CMD,
        SHELL_WITHOUT_ANY_PARAMS,
        VARIABLE_WITHOUT_TYPE,
        VARIABLE_WITH_UNKNOWN_TYPE,
        MATCH_VARIABLE_WITHOUT_A_TRIGGER,
        MATCH_VARIABLE_WITH_A_TRIGGER,
        SHELL_PARAMS_FROM_A_MERGE_KEY,
        SHELL_PARAMS_ARE_AN_ALIAS,
        SHELL_PARAMS_ARE_A_SCALAR,
        SHELL_PARAMS_ARE_A_SEQUENCE,
        TWO_DISTINCT_NAMES,
        TWO_IDENTICAL_NAMES,
        TWO_IDENTICAL_GLOBAL_NAMES,
        MATCH_VARIABLE_SHADOWS_A_GLOBAL,
        UNDECLARED_REFERENCE,
        UNDECLARED_REFERENCE_IN_MARKDOWN,
        UNDECLARED_REFERENCE_IN_HTML,
        REGEX_CAPTURE_GROUP_REFERENCE,
        REGEX_CAPTURE_GROUP_RENAMED,
        REFERENCE_WITH_IMPORTS,
        FORM_SHORTHAND_WITH_A_BRACE_PAIR,
        FORM_SHORTHAND_BESIDE_A_REPLACE,
        UNREADABLE_GLOBAL_VARS,
        UNREADABLE_VARS,
        UNREADABLE_IMPORTS,
        FORM_VARIABLE_WITH_A_DOTTED_REFERENCE,
        FORM_VARIABLE_WITH_AN_UNDECLARED_REFERENCE,
        NESTED_MATCH_VARIABLE,
        NESTED_MATCH_VARIABLE_WITH_AN_UNDECLARED_REFERENCE,
        INJECTION_ON_WITH_AN_UNDECLARED_REFERENCE,
        INJECTION_OFF_WITH_AN_UNDECLARED_REFERENCE,
        VARIABLE_WITH_NO_NAME,
        VARIABLE_WITH_NO_NAME_BESIDE_A_DECLARED_ONE,
        BRACE_PAIR_ESPANSO_IGNORES,
        DOTTED_REFERENCE_DECLARED,
        DOTTED_REFERENCE_UNDECLARED,
        BRACE_PAIR_IN_AN_IMAGE_PATH,
        PARAM_REFERENCES_A_MISSING_NAME,
        PARAM_REFERENCES_A_DECLARED_NAME,
        PARAM_REFERENCE_WITH_INJECTION_OFF,
        NESTED_PARAM_REFERENCES_A_MISSING_NAME,
        FORM_LAYOUT_REFERENCES_A_MISSING_NAME,
        PARAM_KEY_HOLDING_A_BRACE_PAIR,
        REGEX_THAT_COMPILES,
        REGEX_THAT_DOES_NOT_COMPILE,
        REGEX_THAT_DOES_NOT_COMPILE_WITH_A_REFERENCE,
        DOCUMENT_THAT_DOES_NOT_PARSE,
        EMPTY_DOCUMENT,
        COMMENTS_ONLY_DOCUMENT,
        CONFIG_PROFILE,
        MATCHES_ENTRY_THAT_IS_NOT_A_MAPPING,
        THREE_MATCHES_IN_DOCUMENT_ORDER,
    ]);
    all
} // End of function every_fixture()

/// `every_fixture()` really is every fixture.
///
/// The sweeps below are only as wide as that list, so a fixture declared and
/// not listed narrows them silently — which is exactly what this test exists to
/// stop. It reads this file's own source, collects every top-level `const`
/// declared in it, and requires each name to appear as a whole identifier
/// inside `every_fixture`'s body.
///
/// A top-level constant that is genuinely not a fixture has to be named in the
/// exemption list below, with the reason, so that "it is not a fixture" is a
/// decision someone wrote down rather than an omission nobody saw.
#[test]
fn every_fixture_is_listed_in_every_fixture() {
    // Not a document: the name of an environment variable.
    let exempt = ["REQUIRE_REAL_CORPUS"];
    let source = include_str!("validate_semantics.rs");
    let body = source
        .split_once("fn every_fixture() -> Vec<&'static str> {")
        .expect("every_fixture must be declared")
        .1
        .split_once("} // End of function every_fixture()")
        .expect("every_fixture must have its closing comment")
        .0;
    let listed: std::collections::HashSet<&str> = body
        .split(|c: char| !(c.is_alphanumeric() || c == '_'))
        .collect();
    let mut missing: Vec<&str> = Vec::new();
    for line in source.lines() {
        let Some(rest) = line.strip_prefix("const ") else {
            continue;
        };
        let Some((name, _)) = rest.split_once(':') else {
            continue;
        };
        if !listed.contains(name) && !exempt.contains(&name) {
            missing.push(name);
        }
    } // End of the loop over this file's own lines
    assert!(
        missing.is_empty(),
        "fixtures declared but not listed in every_fixture(): {missing:?}"
    );
    for name in exempt {
        assert!(
            source.contains(&format!("const {name}:")),
            "the exemption list names {name}, which this file no longer declares"
        );
    }
} // End of function every_fixture_is_listed_in_every_fixture()

/// Every [`FindingCode`] variant this module can produce is produced by some
/// fixture, and the ones it cannot produce are **named** rather than skipped.
///
/// `FindingCode::ALL_NAMES` is checked against an exhaustive `match` inside the
/// crate, so adding a variant without a fixture fails here rather than becoming
/// a code nothing can reach.
///
/// **`DocumentDoesNotParse`, `DuplicateKeepsTriggerDefinition` and
/// `NewMatchRepeatsLiteralTrigger` are the three exemptions**, and each is one
/// because the code is not a rule about espanso at all: all three are
/// `save_document`'s — the first from its whole-text replacement mode when the
/// submitted text is not YAML this crate can index, the second from a
/// `DuplicateItem` batch whose clone keeps its source's trigger definition, the
/// third from an `InsertItem` batch whose new item repeats literal trigger text
/// its destination sequence already holds — and `validate`, which takes a
/// projection of a document that already parsed and knows nothing about the edit
/// that produced it, has no way to reach any of them. They live in this enum
/// because they must be acknowledgeable, and an acknowledgement is a multiset of
/// `Finding`s. Each exemption is asserted from both sides: no fixture reaches
/// it, **and** it is really declared, so a renamed variant fails here.
/// `tests/persist_raw_save.rs` proves the first reachable and
/// `tests/persist_save.rs` the second and the third.
#[test]
fn every_finding_code_is_reachable() {
    const NOT_VALIDATES: [&str; 3] = [
        "DocumentDoesNotParse",
        "DuplicateKeepsTriggerDefinition",
        "NewMatchRepeatsLiteralTrigger",
    ];

    let mut seen: Vec<&str> = Vec::new();
    for source in every_fixture() {
        seen.extend(code_names(source));
    }
    seen.sort_unstable();
    seen.dedup();
    for exempt in NOT_VALIDATES {
        assert!(
            !seen.contains(&exempt),
            "{exempt} is the save transaction's code; validate must not produce it"
        );
    } // End of the loop over the three save-transaction codes

    let mut expected: Vec<&str> = FindingCode::ALL_NAMES
        .into_iter()
        .filter(|name| !NOT_VALIDATES.contains(name))
        .collect();
    assert_eq!(
        expected.len(),
        FindingCode::ALL_NAMES.len() - NOT_VALIDATES.len(),
        "an exemption names a code the enum no longer declares"
    );
    expected.sort_unstable();
    assert_eq!(seen, expected, "a finding code no fixture produces");
} // End of function every_finding_code_is_reachable()

/// Every [`FindingClass`] variant is produced by some fixture. A class nothing
/// emits is a claim nothing backs.
#[test]
fn every_finding_class_is_reachable() {
    let mut seen: Vec<FindingClass> = Vec::new();
    for source in every_fixture() {
        seen.extend(findings_of(source).iter().map(Finding::class));
    }
    seen.sort_unstable();
    seen.dedup();
    assert_eq!(seen, FindingClass::ALL.to_vec());
} // End of function every_finding_class_is_reachable()

/// The same projection validated twice gives the same answer, for every
/// fixture in the file.
///
/// This is a **repeatability** check and not a proof of purity: it would still
/// pass for a validator that read the clock once and cached the answer. What it
/// rules out is the cheap failure — a rule that mutates the projection, or
/// accumulates into a static, and answers differently the second time.
#[test]
fn validating_the_same_projection_twice_gives_the_same_findings() {
    let context = DocumentContext::detached(DocumentId(1), "validate-fixture.yml");
    for source in every_fixture() {
        let document = project_source(&context, source);
        assert_eq!(validate(&document.view), validate(&document.view));
    }
}

/// A document the substrate rejected projects to no matches, so this pass finds
/// nothing. That silence is the reason step 4 — reparsing the whole candidate —
/// exists, and it must never be mistaken for a clean document.
#[test]
fn a_document_that_does_not_parse_yields_no_findings_here() {
    let context = DocumentContext::detached(DocumentId(1), "validate-fixture.yml");
    let document = project_source(&context, DOCUMENT_THAT_DOES_NOT_PARSE);
    assert!(!document.view.parsed, "the fixture must fail to parse");
    assert!(validate(&document.view).is_empty());
} // End of function a_document_that_does_not_parse_yields_no_findings_here()

/// An empty document, a comments-only document and a config profile all have
/// nothing this pass is about.
#[test]
fn documents_with_no_matches_yield_no_findings() {
    assert_silent(EMPTY_DOCUMENT);
    assert_silent(COMMENTS_ONLY_DOCUMENT);
    assert_silent(CONFIG_PROFILE);
}

/// A `matches` sequence holding something that is not a mapping still projects
/// one row, and that row has neither a trigger nor content.
#[test]
fn a_matches_entry_that_is_not_a_mapping_is_reported_as_empty_on_both_sides() {
    assert_codes(
        MATCHES_ENTRY_THAT_IS_NOT_A_MAPPING,
        &["MatchHasNoTriggerField", "MatchHasNoContentField"],
    );
}

/// Findings arrive grouped by match, in document order, so a UI can render them
/// as a list.
#[test]
fn findings_arrive_in_document_order() {
    let found = findings_of(THREE_MATCHES_IN_DOCUMENT_ORDER);
    let names: Vec<&str> = found.iter().map(|f| f.code.name()).collect();
    assert_eq!(names, ["MatchHasNoContentField", "MatchHasNoTriggerField"]);
    let spans: Vec<usize> = found
        .iter()
        .filter_map(|f| f.span.map(|s| s.start))
        .collect();
    assert!(spans[0] < spans[1], "findings are in document order");
} // End of function findings_arrive_in_document_order()

// ---------------------------------------------------------------------------
// The real corpus — counts only
// ---------------------------------------------------------------------------

/// The environment variable that turns the real-corpus skip into a failure.
///
/// The skip has to stay: a fresh clone and CI both have to pass without the
/// gitignored corpus. What must not stay is a skip that is indistinguishable
/// from a pass, so setting this variable makes the absence of the corpus an
/// error instead. `the_real_corpus_check_can_be_made_mandatory` pins the
/// mechanism itself, so it cannot rot into a name nothing reads.
const REQUIRE_REAL_CORPUS: &str = "ESPANSOCONFIG_REQUIRE_REAL_CORPUS";

/// Whether an absent real corpus should fail rather than skip.
///
/// A separate function taking both inputs, so that the decision can be checked
/// on all four of its combinations without a machine that has no corpus. The
/// test below does exactly that.
fn a_missing_corpus_is_fatal(corpus_is_absent: bool, switch_is_set: bool) -> bool {
    corpus_is_absent && switch_is_set
}

/// The skip is a decision with two inputs, and it is the right decision on all
/// four combinations.
///
/// Only one of them fails the run: no corpus **and** the switch set. In
/// particular a machine that *has* the corpus never fails because of the
/// switch, which is what keeps the switch safe to set globally.
#[test]
fn a_missing_corpus_is_fatal_only_when_the_switch_asks_for_it() {
    assert!(a_missing_corpus_is_fatal(true, true));
    assert!(!a_missing_corpus_is_fatal(true, false));
    assert!(!a_missing_corpus_is_fatal(false, true));
    assert!(!a_missing_corpus_is_fatal(false, false));
}

/// **A rule that fires on a working configuration is a rule that is wrong.**
///
/// The owner's live espanso configuration is loaded by espanso every day, so
/// every finding this pass reports over it — of **either** class — is a defect
/// in this module until proven otherwise. Suspicious findings are asserted too,
/// not merely printed: "this looks wrong" is allowed to be wrong about a
/// document nobody runs, and this one is run daily.
///
/// A zero here is only worth something if the sweep had something to look at,
/// so it counts what it walked and asserts that too (`PROGRESS.md` R24): a
/// projection that produced no match at all would otherwise report the same
/// clean zero as a configuration this module genuinely approves of.
///
/// **What it does not cover.** The corpus holds **no `regex` trigger at all**,
/// so rule 6 is untouched by this test and the walked count of regex triggers
/// is asserted only as the number it is. It is a check of the five other rules'
/// silent side, on one configuration, and of nothing else.
///
/// **It is a no-op without the corpus.** When `tests/corpus/real/` is empty the
/// body below does not run, which on a fresh clone means this test passes
/// without checking anything. Set [`REQUIRE_REAL_CORPUS`] to turn that silence
/// into a failure.
///
/// Prints **counts and file names only** (`CLAUDE.md` section 1).
#[test]
fn the_real_configuration_produces_no_finding_of_either_class() {
    let files = common::real_corpus();
    assert!(
        !a_missing_corpus_is_fatal(
            files.is_empty(),
            std::env::var_os(REQUIRE_REAL_CORPUS).is_some()
        ),
        "{REQUIRE_REAL_CORPUS} is set and the real corpus is absent: \
         run ./scripts/sync-real-corpus.sh to populate it locally"
    );
    if common::skip_without_real_corpus(
        "the_real_configuration_produces_no_finding_of_either_class",
        &files,
    ) {
        return;
    }

    let mut errors = 0usize;
    let mut suspicious = 0usize;
    let mut matches = 0usize;
    let mut variables = 0usize;
    let mut regexes = 0usize;
    let mut by_code: Vec<(&'static str, usize)> = Vec::new();
    let mut offending: Vec<String> = Vec::new();
    for (index, file) in files.iter().enumerate() {
        let context = DocumentContext::detached(DocumentId(index as u64 + 1), &file.name);
        let document = project_source(&context, &file.source);
        matches += document.view.matches.len();
        variables += document.view.global_vars.len();
        for entry in &document.view.matches {
            variables += entry.vars.len();
            if entry.trigger.regex.is_some() {
                regexes += 1;
            }
        } // End of the loop over one file's matches
        for finding in validate(&document.view) {
            match finding.class() {
                FindingClass::EditorModelError => errors += 1,
                FindingClass::SuspiciousButPermitted => suspicious += 1,
            }
            offending.push(format!(
                "{} [{} / {}]",
                file.name,
                finding.code.name(),
                finding.class().name()
            ));
            let name = finding.code.name();
            match by_code.iter_mut().find(|(code, _)| *code == name) {
                Some((_, count)) => *count += 1,
                None => by_code.push((name, 1)),
            }
        } // End of the loop over one file's findings
    } // End of the loop over the real corpus

    by_code.sort_unstable();
    println!(
        "real corpus: {} files, {matches} matches, {variables} variables, \
         {regexes} regex triggers walked",
        files.len()
    );
    println!("  editor-model errors: {errors}");
    println!("  suspicious but permitted: {suspicious}");
    for (code, count) in &by_code {
        println!("  {code}: {count}");
    }
    assert!(
        matches > 0 && variables > 0,
        "the sweep must have walked something: {matches} matches, {variables} variables"
    );
    assert_eq!(
        (errors, suspicious),
        (0, 0),
        "the owner's working configuration must produce no finding of either class; \
         found in {offending:?}"
    );
} // End of function the_real_configuration_produces_no_finding_of_either_class()

/// The real-corpus test really consults the switch.
///
/// [`a_missing_corpus_is_fatal_only_when_the_switch_asks_for_it`] proves the
/// decision is right; this proves it is *taken*. Without it the whole mechanism
/// could be correct and unreachable — the switch would never fire, which on a
/// machine with no corpus looks exactly like a machine that has one. It reads
/// this file's own source because there is no other way to observe a call from
/// outside the call.
#[test]
fn the_real_corpus_test_reads_the_switch_that_makes_it_mandatory() {
    let source = include_str!("validate_semantics.rs");
    let body = source
        .split_once("fn the_real_configuration_produces_no_finding_of_either_class() {")
        .expect("the real-corpus test must be declared")
        .1
        .split_once(
            "} // End of function the_real_configuration_produces_no_finding_of_either_class()",
        )
        .expect("the real-corpus test must have its closing comment")
        .0;
    assert!(
        body.contains("a_missing_corpus_is_fatal(")
            && body.contains("std::env::var_os(REQUIRE_REAL_CORPUS)"),
        "the real-corpus test must decide with a_missing_corpus_is_fatal on {REQUIRE_REAL_CORPUS}"
    );
} // End of function the_real_corpus_test_reads_the_switch_that_makes_it_mandatory()
