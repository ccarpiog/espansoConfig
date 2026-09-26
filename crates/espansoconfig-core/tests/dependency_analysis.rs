//! Phase 4-7 acceptance: placeholder, reference and dependency analysis
//! (`docs/decisions/4-split-notes.md` §2, step 4-7).
//!
//! What this file pins:
//!
//! - repeated and malformed placeholders, through a real projection;
//! - `{{f.field}}` sub-references against verbose and shorthand layouts;
//! - explicit and inferred cycles, kept distinguishable;
//! - regex captures in name resolution, and an uncompilable regex keeping the
//!   scope open;
//! - duplicate names resolving to nothing and making the answer incomplete;
//! - `inject_vars` spellings: on, off, and uncertain;
//! - imports keeping the scope open, so no missing-name claim is made;
//! - shorthand `form:` staying out of `rendered_content`;
//! - the two new findings produced only for a variable operation that
//!   introduces or worsens the condition, and bound to the candidate revision:
//!   an unrelated save acquires nothing, and consent for one candidate cannot be
//!   spent on changed text.
//!
//! # Privacy
//!
//! Every fixture is hand-authored, inline or synthetic, and neutral
//! (`CLAUDE.md` section 1).

use espansoconfig_core::analysis::{
    analyze_document, analyze_match, batch_operates_on_variables, EdgeKind, FormSource,
    IncompleteReason, Injection, MatchAnalysis, PlaceholderLayout,
};
use espansoconfig_core::discovery::FileKind;
use espansoconfig_core::model::{DocumentContext, DocumentView};
use espansoconfig_core::patch::{
    DocumentEdit, DocumentPath, ItemPlacement, ItemTextReplacement, ScalarEdit, ScalarItemInsert,
};
use espansoconfig_core::persist::{
    preflight_edits, save_document, Acknowledgement, SaveContent, SaveError, SaveRequest,
    SaveVerdict,
};
use espansoconfig_core::validate::{validate, Finding, FindingClass, FindingCode};
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::{ContentRevision, DocumentId};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/// A clean chain: `b` depends on `c` explicitly; nothing is cyclic or missing.
const CLEAN: &str = "\
matches:
  - trigger: ':one'
    label: first
    replace: '{{a}} {{b}}'
    vars:
      - name: a
        type: echo
        params:
          echo: 'x'
      - name: b
        type: echo
        depends_on:
          - c
        params:
          echo: 'y'
      - name: c
        type: echo
        params:
          echo: 'z'
";

/// A graph that is already imperfect: `p` and `q` form a cycle (explicit both
/// ways, inferred one way) and `p` depends on a `ghost` nothing declares.
const IMPERFECT: &str = "\
matches:
  - trigger: ':two'
    label: second
    replace: '{{p}}'
    vars:
      - name: p
        type: echo
        depends_on:
          - q
          - ghost
        params:
          echo: '{{q}}'
      - name: q
        type: echo
        depends_on:
          - p
        params:
          echo: 'w'
      - name: r
        type: echo
        params:
          echo: 'v'
";

/// [`CLEAN`] with an `imports` entry, which opens the scope.
const WITH_IMPORTS: &str = "\
imports:
  - other.yml
matches:
  - trigger: ':one'
    replace: '{{b}}'
    vars:
      - name: b
        type: echo
        depends_on:
          - c
        params:
          echo: 'y'
      - name: c
        type: echo
        params:
          echo: 'z'
";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// The projection of `source`.
fn view_of(source: &str) -> DocumentView {
    let context = DocumentContext::detached(DocumentId(0), "analysis.yml");
    project_source(&context, source).view
}

/// The analysis of the first match of `source`.
fn first_analysis(source: &str) -> MatchAnalysis {
    let view = view_of(source);
    analyze_match(&view, &view.matches[0])
}

/// A synthetic corpus file.
fn synthetic(name: &str) -> String {
    let path = format!(
        "{}/tests/corpus/synthetic/{name}",
        env!("CARGO_MANIFEST_DIR")
    );
    std::fs::read_to_string(path).expect("the synthetic fixture is readable")
}

/// `matches[0].vars[variable]`, extended by `rest`.
fn var_path(variable: usize) -> DocumentPath {
    DocumentPath::root(0)
        .with_key("matches")
        .with_index(0)
        .with_key("vars")
        .with_index(variable)
}

/// A scalar edit at `matches[0].vars[variable].depends_on[entry]`.
fn rename_dependency(variable: usize, entry: usize, to: &str) -> DocumentEdit {
    DocumentEdit::Scalar(ScalarEdit::new(
        var_path(variable).with_key("depends_on").with_index(entry),
        to,
    ))
}

/// A scalar edit of `matches[0].vars[variable].params.echo`.
fn set_echo(variable: usize, to: &str) -> DocumentEdit {
    DocumentEdit::Scalar(ScalarEdit::new(
        var_path(variable).with_key("params").with_key("echo"),
        to,
    ))
}

/// An appended `depends_on` entry.
fn append_dependency(variable: usize, name: &str) -> DocumentEdit {
    DocumentEdit::InsertScalarItems(
        ScalarItemInsert::new(
            var_path(variable).with_key("depends_on"),
            ItemPlacement::End,
            vec![name.to_owned()],
        )
        .expect("one value"),
    )
}

/// The context every preflight runs under.
fn context() -> DocumentContext {
    DocumentContext::detached(DocumentId(0), "analysis.yml")
}

/// The findings a batch's candidate meets.
fn findings_for(source: &str, edits: &[DocumentEdit]) -> Vec<Finding> {
    preflight_edits(&context(), source, edits, &Acknowledgement::none())
        .expect("the batch applies")
        .findings
}

/// Only the two Phase 4-7 codes of a finding list.
fn dependency_codes(findings: &[Finding]) -> Vec<FindingCode> {
    findings
        .iter()
        .filter(|finding| {
            matches!(
                finding.code,
                FindingCode::VariableDependencyCycle { .. }
                    | FindingCode::DependencyHasNoDeclaration { .. }
            )
        })
        .map(|finding| finding.code.clone())
        .collect()
} // End of function dependency_codes()

/// The names of the dependency findings, cycles as `cycle:name:size` and
/// missing names as `missing:name`.
fn summary(findings: &[Finding]) -> Vec<String> {
    dependency_codes(findings)
        .into_iter()
        .map(|code| match code {
            FindingCode::VariableDependencyCycle { name, size, .. } => {
                format!("cycle:{name}:{size}")
            }
            FindingCode::DependencyHasNoDeclaration { name, .. } => format!("missing:{name}"),
            _ => unreachable!(),
        })
        .collect()
} // End of function summary()

// ---------------------------------------------------------------------------
// Placeholders and forms
// ---------------------------------------------------------------------------

/// Repeated placeholders group into one row and a malformed one is reported,
/// on a verbose layout read through a real projection.
#[test]
fn repeated_and_malformed_placeholders_in_a_projected_layout() {
    let source = "\
matches:
  - trigger: ':f'
    replace: '{{f.one}}'
    vars:
      - name: f
        type: form
        params:
          layout: '[[one]] and [[one]] and [[ two ]]'
          fields:
            one:
              default: x
            three:
              default: y
";
    let analysis = first_analysis(source);
    let layout = analysis.scope.declarations[0]
        .layout
        .as_ref()
        .expect("a form layout");
    let groups = layout.layout.groups();
    assert_eq!(groups.len(), 1);
    assert_eq!(groups[0].name, "one");
    assert_eq!(groups[0].occurrences.len(), 2);
    assert_eq!(layout.layout.malformed().count(), 1);
    assert_eq!(
        layout.definitions_without_occurrence,
        vec!["three".to_owned()]
    );
    // The malformed region makes "not found" unsayable for `f`.
    let text = "[[one]] and [[one]] and [[ two ]]";
    let rebuilt: String = PlaceholderLayout::parse(text)
        .segments
        .iter()
        .map(|segment| segment.span().slice(text).expect("in bounds"))
        .collect();
    assert_eq!(rebuilt, text);
} // End of function repeated_and_malformed_placeholders_in_a_projected_layout()

/// `{{f.field}}` against a verbose layout: a present field says nothing, a
/// missing one is an advisory, and a layout outside the subset is a reason.
#[test]
fn form_sub_references_are_checked_against_the_supported_layout() {
    let source = "\
matches:
  - trigger: ':f'
    replace: '{{f.one}} {{f.nope}} {{g.any}}'
    vars:
      - name: f
        type: form
        params:
          layout: 'A [[one]]'
      - name: g
        type: form
        params:
          layout: 'B [[ spaced ]]'
";
    let analysis = first_analysis(source);
    let advisories = &analysis.scope.form_advisories;
    assert_eq!(advisories.len(), 1);
    assert_eq!(advisories[0].field, "nope");
    assert_eq!(advisories[0].form, FormSource::Variable(0));
    assert!(analysis
        .scope
        .incomplete
        .contains(&IncompleteReason::LayoutUnsupported {
            form: FormSource::Variable(1)
        }));
    // The body references still count as usage of both forms.
    assert_eq!(analysis.scope.declarations[0].usage.body, 2);
    assert_eq!(analysis.scope.declarations[1].usage.body, 1);
} // End of function form_sub_references_are_checked_against_the_supported_layout()

/// The synthetic form file: every sub-reference of the verbose form is found,
/// and the shorthand form's definitions all have occurrences.
#[test]
fn the_synthetic_forms_have_no_advisory() {
    let view = view_of(&synthetic("form-layout-and-choice.yml"));
    let analysis = analyze_document(&view);
    for entry in &analysis.matches {
        assert!(entry.scope.form_advisories.is_empty());
    }
    let shorthand = analysis.matches[0]
        .shorthand_form
        .as_ref()
        .expect("the shorthand layout");
    assert!(shorthand.layout.is_fully_supported());
    assert!(shorthand.definitions_without_occurrence.is_empty());
    assert_eq!(shorthand.layout.groups().len(), 3);
    assert_eq!(analysis.matches[1].scope.declarations[0].usage.body, 3);
} // End of function the_synthetic_forms_have_no_advisory()

/// Shorthand `form:` stays out of `rendered_content`: its `{{…}}` are
/// unverified layout references, counted apart, never a rule 5 finding.
#[test]
fn shorthand_form_references_are_unverified_and_not_rendered_content() {
    let source = "\
matches:
  - trigger: ':s'
    form: 'Hi [[who]] {{missing}} {{local}}'
    vars:
      - name: local
        type: echo
        params:
          echo: 'x'
";
    let view = view_of(source);
    assert!(
        validate(&view).is_empty(),
        "the shorthand layout is not rendered content"
    );
    let analysis = analyze_match(&view, &view.matches[0]);
    let names: Vec<&str> = analysis
        .unverified_layout_references
        .iter()
        .map(|token| token.name.as_str())
        .collect();
    assert_eq!(names, vec!["missing", "local"]);
    let usage = analysis.scope.declarations[0].usage;
    assert_eq!(usage.unverified_layout, 1);
    assert_eq!(usage.body, 0);
    assert!(analysis.scope.missing_dependencies.is_empty());
} // End of function shorthand_form_references_are_unverified_and_not_rendered_content()

/// `form1.field` resolves to the shorthand layout when the loader would
/// synthesise it.
#[test]
fn the_synthesised_form_answers_sub_references_against_the_shorthand_layout() {
    let source = "\
matches:
  - trigger: ':s'
    form: 'Hi [[who]]'
    vars:
      - name: shout
        type: echo
        params:
          echo: '{{form1.who}} {{form1.nobody}}'
";
    let analysis = first_analysis(source);
    let advisories = &analysis.scope.form_advisories;
    assert_eq!(advisories.len(), 1);
    assert_eq!(advisories[0].form, FormSource::Shorthand);
    assert_eq!(advisories[0].field, "nobody");
} // End of function the_synthesised_form_answers_sub_references_against_the_shorthand_layout()

// ---------------------------------------------------------------------------
// The graph
// ---------------------------------------------------------------------------

/// Explicit and inferred cycles are both found, and their edge kinds kept
/// apart.
#[test]
fn explicit_and_inferred_cycles_are_distinguishable() {
    let source = "\
matches:
  - trigger: ':c'
    replace: '{{a}}'
    vars:
      - name: a
        type: echo
        depends_on:
          - b
        params:
          echo: 'x'
      - name: b
        type: echo
        depends_on:
          - a
        params:
          echo: 'y'
      - name: c
        type: echo
        params:
          echo: '{{d}}'
      - name: d
        type: echo
        params:
          echo: '{{c}}'
      - name: e
        type: echo
        depends_on:
          - e
        params:
          echo: 'z'
";
    let analysis = first_analysis(source);
    let cycles = &analysis.scope.cycles;
    assert_eq!(cycles.len(), 3);
    assert_eq!(cycles[0].members, vec![0, 1]);
    assert!(cycles[0].explicit && !cycles[0].inferred);
    assert_eq!(cycles[1].members, vec![2, 3]);
    assert!(!cycles[1].explicit && cycles[1].inferred);
    assert_eq!(cycles[2].members, vec![4]);
    let kinds: Vec<EdgeKind> = analysis.scope.edges.iter().map(|edge| edge.kind).collect();
    assert!(kinds.contains(&EdgeKind::Explicit) && kinds.contains(&EdgeKind::Inferred));
} // End of function explicit_and_inferred_cycles_are_distinguishable()

/// The synthetic chain has no cycle, no missing name, and a usage count for
/// every declaration; its second match turns injection off.
#[test]
fn the_synthetic_chain_is_acyclic_and_fully_used() {
    let view = view_of(&synthetic("variable-chain.yml"));
    let analysis = analyze_document(&view);
    let chain = &analysis.matches[0].scope;
    assert!(chain.cycles.is_empty());
    assert!(chain.missing_dependencies.is_empty());
    assert!(chain.scope_closed);
    assert!(
        chain.order_advisories.is_empty(),
        "authored after its dependencies"
    );
    for declaration in &chain.declarations {
        assert!(declaration.usage.has_visible_reference());
    }
    let literal = &analysis.matches[1].scope;
    assert_eq!(literal.declarations[0].injection, Injection::Disabled);
    assert!(literal.edges.is_empty());
} // End of function the_synthetic_chain_is_acyclic_and_fully_used()

/// A consumer authored before its dependency is an order advisory; the graph
/// is not re-sorted.
#[test]
fn a_consumer_before_its_dependency_is_an_advisory() {
    let source = "\
matches:
  - trigger: ':o'
    replace: '{{late}}'
    vars:
      - name: early
        type: echo
        depends_on:
          - late
        params:
          echo: 'x'
      - name: late
        type: echo
        params:
          echo: 'y'
";
    let analysis = first_analysis(source);
    assert_eq!(analysis.scope.order_advisories.len(), 1);
    assert_eq!(analysis.scope.order_advisories[0].consumer, 0);
    assert_eq!(analysis.scope.order_advisories[0].dependency, 1);
    // "No visible reference found" is a count, never "no effect".
    assert!(analysis.scope.declarations[0].usage.depends_on == 0);
    assert!(!analysis.scope.declarations[0].usage.has_visible_reference());
} // End of function a_consumer_before_its_dependency_is_an_advisory()

/// Regex captures resolve names, add no local vertex, and an uncompilable
/// regex keeps the scope open.
#[test]
fn regex_captures_take_part_in_resolution() {
    let source = "\
matches:
  - regex: ':x(?P<cap>\\d+)'
    replace: '{{v}}'
    vars:
      - name: v
        type: echo
        depends_on:
          - cap
        params:
          echo: '{{cap}}'
  - regex: ':y(?P<cap'
    replace: '{{v}}'
    vars:
      - name: v
        type: echo
        depends_on:
          - cap
        params:
          echo: 'x'
";
    let view = view_of(source);
    let compiled = analyze_match(&view, &view.matches[0]);
    assert_eq!(compiled.captures, vec!["cap".to_owned()]);
    assert!(compiled.scope.missing_dependencies.is_empty());
    assert!(compiled.scope.edges.is_empty());
    assert!(compiled.scope.scope_closed);
    let broken = analyze_match(&view, &view.matches[1]);
    assert!(!broken.scope.scope_closed);
    assert!(broken
        .scope
        .incomplete
        .contains(&IncompleteReason::RegexCapturesUnknown));
    assert!(broken.scope.missing_dependencies.is_empty());
} // End of function regex_captures_take_part_in_resolution()

/// A duplicated name resolves to nothing: no edge, no missing claim, a reason.
#[test]
fn duplicate_names_make_the_answer_incomplete() {
    let source = "\
matches:
  - trigger: ':d'
    replace: '{{twin}}'
    vars:
      - name: twin
        type: echo
        params:
          echo: 'x'
      - name: twin
        type: echo
        params:
          echo: 'y'
      - name: user
        type: echo
        depends_on:
          - twin
        params:
          echo: '{{twin}}'
";
    let analysis = first_analysis(source);
    assert!(analysis.scope.edges.is_empty());
    assert!(analysis.scope.missing_dependencies.is_empty());
    assert!(analysis
        .scope
        .incomplete
        .contains(&IncompleteReason::DuplicateDeclaration {
            declarations: vec![0, 1]
        }));
} // End of function duplicate_names_make_the_answer_incomplete()

/// `inject_vars`: absent and the three true spellings infer edges; the three
/// false spellings do not; anything else is uncertain and says so.
#[test]
fn inject_vars_spellings_decide_inferred_edges() {
    let cases: [(&str, Injection); 8] = [
        ("", Injection::Enabled),
        ("        inject_vars: true\n", Injection::Enabled),
        ("        inject_vars: Yes\n", Injection::Enabled),
        ("        inject_vars: ON\n", Injection::Enabled),
        ("        inject_vars: false\n", Injection::Disabled),
        ("        inject_vars: no\n", Injection::Disabled),
        ("        inject_vars: Off\n", Injection::Disabled),
        ("        inject_vars: maybe\n", Injection::Uncertain),
    ];
    for (line, expected) in cases {
        let source = format!(
            "\
matches:
  - trigger: ':i'
    replace: '{{{{u}}}}'
    vars:
      - name: base
        type: echo
        params:
          echo: 'x'
      - name: u
        type: echo
{line}        params:
          echo: '{{{{base}}}}'
"
        );
        let analysis = first_analysis(&source);
        assert_eq!(
            analysis.scope.declarations[1].injection, expected,
            "{line:?}"
        );
        let inferred = analysis
            .scope
            .edges
            .iter()
            .any(|edge| edge.kind == EdgeKind::Inferred);
        assert_eq!(inferred, expected == Injection::Enabled, "{line:?}");
        let uncertain = analysis
            .scope
            .incomplete
            .contains(&IncompleteReason::InjectionUncertain { declaration: 1 });
        assert_eq!(uncertain, expected == Injection::Uncertain, "{line:?}");
    } // End of the loop over the spellings
} // End of function inject_vars_spellings_decide_inferred_edges()

/// Imports keep the scope open: no missing-name claim, in the analysis or in a
/// save that introduces an unknown name — but a local cycle is still certain.
#[test]
fn imports_keep_the_scope_open() {
    let analysis = first_analysis(WITH_IMPORTS);
    assert!(!analysis.scope.scope_closed);
    assert!(analysis
        .scope
        .incomplete
        .contains(&IncompleteReason::ImportsOpenScope));
    let findings = findings_for(WITH_IMPORTS, &[rename_dependency(0, 0, "ghost")]);
    assert!(summary(&findings).is_empty(), "{findings:?}");
    let findings = findings_for(WITH_IMPORTS, &[set_echo(1, "{{b}}")]);
    assert_eq!(summary(&findings), vec!["cycle:b:2".to_owned()]);
} // End of function imports_keep_the_scope_open()

/// Globals are counted across the document and resolve local references
/// without a local vertex.
#[test]
fn globals_take_part_in_resolution_and_usage() {
    let source = "\
global_vars:
  - name: g
    type: echo
    params:
      echo: 'x'
matches:
  - trigger: ':g'
    replace: '{{g}}'
    vars:
      - name: l
        type: echo
        depends_on:
          - g
        params:
          echo: '{{g}}'
";
    let analysis = analyze_document(&view_of(source));
    let usage = analysis.globals.declarations[0].usage;
    assert_eq!((usage.body, usage.parameters, usage.depends_on), (1, 1, 1));
    assert!(analysis.matches[0].scope.edges.is_empty());
    assert!(analysis.matches[0].scope.missing_dependencies.is_empty());
} // End of function globals_take_part_in_resolution_and_usage()

// ---------------------------------------------------------------------------
// The two findings
// ---------------------------------------------------------------------------

/// Both codes are suspicions, never editor-model errors.
#[test]
fn both_new_codes_are_suspicious_but_permitted() {
    let revision = ContentRevision::of_bytes(b"x");
    for code in [
        FindingCode::VariableDependencyCycle {
            revision,
            name: "a".to_owned(),
            size: 1,
        },
        FindingCode::DependencyHasNoDeclaration {
            revision,
            name: "a".to_owned(),
        },
    ] {
        assert_eq!(code.class(), FindingClass::SuspiciousButPermitted);
    }
} // End of function both_new_codes_are_suspicious_but_permitted()

/// A variable operation that introduces a missing name or a cycle is told;
/// the finding carries the candidate's revision and points at the variable.
#[test]
fn a_variable_operation_that_introduces_a_condition_is_told() {
    let missing = findings_for(CLEAN, &[rename_dependency(1, 0, "ghost")]);
    assert_eq!(summary(&missing), vec!["missing:ghost".to_owned()]);
    let finding = missing
        .iter()
        .find(|finding| matches!(finding.code, FindingCode::DependencyHasNoDeclaration { .. }))
        .expect("the finding");
    assert_eq!(
        finding.path,
        Some(var_path(1).with_key("depends_on").with_index(0))
    );
    let preflight = preflight_edits(
        &context(),
        CLEAN,
        &[rename_dependency(1, 0, "ghost")],
        &Acknowledgement::none(),
    )
    .expect("applies");
    assert_eq!(
        preflight.verdict,
        SaveVerdict::RefusedForUnacknowledgedSuspicions
    );
    let FindingCode::DependencyHasNoDeclaration { revision, .. } = &finding.code else {
        unreachable!()
    };
    assert_eq!(*revision, preflight.candidate);

    // An inferred edge back from `c` to `b` closes a cycle with the explicit one.
    let cycle = findings_for(CLEAN, &[set_echo(2, "{{b}}")]);
    assert_eq!(summary(&cycle), vec!["cycle:b:2".to_owned()]);
    // A self-dependency is a cycle of one.
    let own = findings_for(CLEAN, &[rename_dependency(1, 0, "b")]);
    assert_eq!(summary(&own), vec!["cycle:b:1".to_owned()]);
} // End of function a_variable_operation_that_introduces_a_condition_is_told()

/// A save that is not a variable operation acquires nothing, however imperfect
/// the graph it leaves alone — and a variable operation that does not worsen
/// the graph acquires nothing either.
#[test]
fn an_unrelated_save_acquires_no_new_acknowledgement() {
    let label = DocumentEdit::Scalar(ScalarEdit::new(
        DocumentPath::root(0)
            .with_key("matches")
            .with_index(0)
            .with_key("label"),
        "renamed",
    ));
    assert!(!batch_operates_on_variables(std::slice::from_ref(&label)));
    let preflight = preflight_edits(&context(), IMPERFECT, &[label], &Acknowledgement::none())
        .expect("applies");
    assert!(preflight.findings.is_empty(), "{:?}", preflight.findings);
    assert_eq!(preflight.verdict, SaveVerdict::Proceed);

    // A variable operation on a variable outside both conditions.
    let unrelated = findings_for(IMPERFECT, &[set_echo(2, "u")]);
    assert!(summary(&unrelated).is_empty(), "{unrelated:?}");

    // Breaking the cycle introduces nothing.
    let shrink = findings_for(IMPERFECT, &[rename_dependency(1, 0, "r")]);
    assert!(summary(&shrink).is_empty(), "{shrink:?}");
} // End of function an_unrelated_save_acquires_no_new_acknowledgement()

/// Worsening is told: a cycle that grows by merging, and a missing name that
/// gains an occurrence or a new spelling.
#[test]
fn a_variable_operation_that_worsens_a_condition_is_told() {
    // q -> r and r -> q merge into the p/q cycle.
    let merged = findings_for(IMPERFECT, &[set_echo(1, "{{r}}"), set_echo(2, "{{q}}")]);
    assert_eq!(summary(&merged), vec!["cycle:p:3".to_owned()]);
    // A second `ghost` is one new finding, on the new occurrence.
    let again = findings_for(IMPERFECT, &[append_dependency(1, "ghost")]);
    assert_eq!(summary(&again), vec!["missing:ghost".to_owned()]);
    let finding = again
        .iter()
        .find(|finding| matches!(finding.code, FindingCode::DependencyHasNoDeclaration { .. }))
        .expect("the finding");
    assert_eq!(
        finding.path,
        Some(var_path(1).with_key("depends_on").with_index(1))
    );
    // Renaming the missing name is a new missing name.
    let renamed = findings_for(IMPERFECT, &[rename_dependency(0, 1, "phantom")]);
    assert_eq!(summary(&renamed), vec!["missing:phantom".to_owned()]);
} // End of function a_variable_operation_that_worsens_a_condition_is_told()

/// Consent collected for one candidate is not spent on a changed one, even
/// when the findings differ only by the candidate they are bound to.
#[test]
fn consent_for_one_candidate_cannot_be_spent_on_changed_text() {
    let first = [rename_dependency(1, 0, "ghost")];
    // The same finding shape, and a same-length change elsewhere: the span,
    // node and path of the finding are equal; only the candidate differs.
    let second = [rename_dependency(1, 0, "ghost"), set_echo(0, "k")];
    let consent = Acknowledgement::of(&findings_for(CLEAN, &first));
    assert_eq!(consent.len(), 1);
    let theirs = findings_for(CLEAN, &second);
    let shape = |findings: &[Finding]| -> Vec<_> {
        findings
            .iter()
            .map(|finding| (finding.span, finding.node, finding.path.clone()))
            .collect()
    };
    assert_eq!(shape(&findings_for(CLEAN, &first)), shape(&theirs));

    let (directory, target) = on_disk(CLEAN);
    let refused = save(&target, &second, &consent).expect_err("the consent is not theirs");
    assert!(matches!(refused, SaveError::Refused(_)), "{refused:?}");
    assert_eq!(std::fs::read_to_string(&target).expect("readable"), CLEAN);
    let saved = save(&target, &first, &consent).expect("the consent is for this candidate");
    assert!(saved.committed);
    drop(directory);
} // End of function consent_for_one_candidate_cannot_be_spent_on_changed_text()

/// A whole-item text replacement rewrites `vars` too, so it counts as a
/// variable operation; a replacement of a different key path does not.
#[test]
fn a_whole_item_replacement_is_a_variable_operation() {
    let item = DocumentPath::root(0).with_key("matches").with_index(0);
    let replacement = DocumentEdit::ReplaceItemText(ItemTextReplacement::new(item, "x"));
    assert!(batch_operates_on_variables(&[replacement]));
    let content = DocumentEdit::Scalar(ScalarEdit::new(
        DocumentPath::root(0)
            .with_key("matches")
            .with_index(0)
            .with_key("replace"),
        "x",
    ));
    assert!(!batch_operates_on_variables(&[content]));
} // End of function a_whole_item_replacement_is_a_variable_operation()

/// A temp directory holding one match file with the given text.
fn on_disk(source: &str) -> (tempfile::TempDir, std::path::PathBuf) {
    let directory = tempfile::tempdir().expect("a temp directory");
    let target = directory.path().join("base.yml");
    std::fs::write(&target, source.as_bytes()).expect("the fixture file is written");
    (directory, target)
}

/// One save of `edits` against `target`, based on [`CLEAN`].
fn save(
    target: &std::path::Path,
    edits: &[DocumentEdit],
    acknowledgement: &Acknowledgement,
) -> Result<espansoconfig_core::persist::SavedDocument, SaveError> {
    let context = DocumentContext {
        id: DocumentId(1),
        path: target.to_path_buf(),
        relative_path: std::path::PathBuf::from("base.yml"),
        kind: FileKind::MatchFile,
        disabled: false,
    };
    save_document(SaveRequest {
        context: &context,
        base_revision: ContentRevision::of_bytes(CLEAN.as_bytes()),
        content: SaveContent::Edits(edits),
        acknowledgement,
        backups: None,
    })
} // End of function save()

// ---------------------------------------------------------------------------
// Review fixes (docs/reviews/4-7.md)
// ---------------------------------------------------------------------------

/// Review finding 1: an `inject_vars` that is written but unreadable (an alias
/// or a mapping) is not the absent default — it is uncertain, infers no edge,
/// and says so.
#[test]
fn an_unreadable_inject_vars_is_uncertain_not_enabled() {
    for written in ["*flag", "{}"] {
        let source = format!(
            "\
anchors:
  flag: &flag true
matches:
  - trigger: ':i'
    replace: '{{{{u}}}}'
    vars:
      - name: base
        type: echo
        params:
          echo: 'x'
      - name: u
        type: echo
        inject_vars: {written}
        params:
          echo: '{{{{base}}}}'
"
        );
        let analysis = first_analysis(&source);
        let user = &analysis.scope.declarations[1];
        assert_eq!(user.injection, Injection::Uncertain, "{written}");
        assert!(
            !analysis
                .scope
                .edges
                .iter()
                .any(|edge| edge.kind == EdgeKind::Inferred),
            "{written}: no inferred edge"
        );
        assert!(analysis
            .scope
            .incomplete
            .contains(&IncompleteReason::InjectionUncertain { declaration: 1 }));
    } // End of the loop over the unreadable spellings
} // End of function an_unreadable_inject_vars_is_uncertain_not_enabled()

/// Review finding 2: a declaration whose `name` is unreadable (an alias)
/// opens the scope — locally and globally — so no missing-name claim is made,
/// in the analysis or at save.
#[test]
fn an_unreadable_declaration_name_opens_the_scope() {
    let local = "\
anchors:
  n: &n hidden
matches:
  - trigger: ':u'
    replace: '{{b}}'
    vars:
      - name: *n
        type: echo
        params:
          echo: 'x'
      - name: b
        type: echo
        depends_on:
          - c
        params:
          echo: 'y'
      - name: c
        type: echo
        params:
          echo: 'z'
";
    let analysis = first_analysis(local);
    assert!(!analysis.scope.scope_closed);
    assert!(analysis
        .scope
        .incomplete
        .contains(&IncompleteReason::LocalNameUnreadable { declaration: 0 }));
    // `b` is at index 1 here.
    let edits = [DocumentEdit::Scalar(ScalarEdit::new(
        var_path(1).with_key("depends_on").with_index(0),
        "hidden",
    ))];
    assert!(summary(&findings_for(local, &edits)).is_empty());

    let global = "\
anchors:
  n: &n hidden
global_vars:
  - name: *n
    type: echo
    params:
      echo: 'x'
matches:
  - trigger: ':g'
    replace: '{{b}}'
    vars:
      - name: b
        type: echo
        depends_on:
          - c
        params:
          echo: 'y'
      - name: c
        type: echo
        params:
          echo: 'z'
";
    let analysis = first_analysis(global);
    assert!(!analysis.scope.scope_closed);
    assert!(analysis
        .scope
        .incomplete
        .contains(&IncompleteReason::GlobalNameUnreadable { declaration: 0 }));
    let edits = [rename_dependency(0, 0, "hidden")];
    assert!(summary(&findings_for(global, &edits)).is_empty());
} // End of function an_unreadable_declaration_name_opens_the_scope()

/// Review finding 3: references between globals count, with and without
/// references from matches.
#[test]
fn global_to_global_usage_is_accumulated() {
    let alone = "\
global_vars:
  - name: g
    type: echo
    params:
      echo: 'x'
  - name: h
    type: echo
    depends_on:
      - g
    params:
      echo: '{{g}}'
";
    let analysis = analyze_document(&view_of(alone));
    let usage = analysis.globals.declarations[0].usage;
    assert_eq!((usage.parameters, usage.depends_on), (1, 1));

    let with_match = format!(
        "{alone}matches:
  - trigger: ':g'
    replace: '{{{{g}}}}'
"
    );
    let analysis = analyze_document(&view_of(&with_match));
    let usage = analysis.globals.declarations[0].usage;
    assert_eq!((usage.body, usage.parameters, usage.depends_on), (1, 1, 1));
} // End of function global_to_global_usage_is_accumulated()

/// Review finding 4: 100 000 unterminated openers parse in linear time.
#[test]
fn many_unterminated_openers_parse_quickly() {
    let text = "[[x".repeat(100_000);
    let started = std::time::Instant::now();
    let layout = PlaceholderLayout::parse(&text);
    let elapsed = started.elapsed();
    assert_eq!(layout.malformed().count(), 100_000);
    assert!(
        elapsed < std::time::Duration::from_millis(1500),
        "took {elapsed:?}"
    );
}
