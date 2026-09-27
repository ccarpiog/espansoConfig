//! Phase 4-17 acceptance: the pure, bounded illustrative preview
//! (`docs/decisions/4-split-notes.md` §2, step 4-17).
//!
//! What this file pins:
//!
//! - identical requests give identical output;
//! - echo, selected choice (label versus returned id) and random examples,
//!   form and capture samples, and globals;
//! - cycles, missing samples and every other unresolved case terminate with a
//!   code, the reference token kept as written;
//! - the reference tokens the preview resolves are exactly the analysis's;
//! - the output-byte, segment, depth and work limits hold, at the boundary;
//! - `clipboard`, `shell`, `script` and `match` are placeholders, and a shell
//!   command is not run;
//! - hostile HTML comes back as data, unchanged.
//!
//! # Privacy
//!
//! Every fixture is hand-authored, inline and neutral (`CLAUDE.md` section 1).

use espansoconfig_core::analysis::{analyze_match, scan_references};
use espansoconfig_core::discovery::FileKind;
use espansoconfig_core::model::{ContentKind, DocumentContext};
use espansoconfig_core::preview::{
    preview_match, preview_match_with_limits, CaptureSample, FormValueSample, MatchPreview,
    PreviewLimit, PreviewLimits, PreviewPlaceholder, PreviewSamples, PreviewSegment, PreviewSource,
    PreviewUnresolved, SelectionSample, MAX_PREVIEW_ARGUMENTS, MAX_PREVIEW_DEPTH,
    MAX_PREVIEW_OUTPUT_BYTES, MAX_PREVIEW_SEGMENTS,
};
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::{DocumentId, SourceDocument};

/// `source` projected under a neutral context.
fn projected(source: &str) -> SourceDocument {
    let context = DocumentContext {
        id: DocumentId(1),
        path: std::path::PathBuf::from("/nowhere/base.yml"),
        relative_path: std::path::PathBuf::from("base.yml"),
        kind: FileKind::MatchFile,
        disabled: false,
    };
    project_source(&context, source)
}

/// The preview of match `index` of `source`.
fn preview_of(source: &str, index: usize, samples: &PreviewSamples) -> MatchPreview {
    let document = projected(source);
    preview_match(&document.view, &document.view.matches[index], samples)
}

/// The only body of a preview.
fn only_body(preview: &MatchPreview) -> &[PreviewSegment] {
    assert_eq!(preview.bodies.len(), 1, "{preview:?}");
    &preview.bodies[0].segments
}

/// A local variable's address.
fn local(index: usize) -> PreviewSource {
    PreviewSource::Local { index }
}

/// A selection sample.
fn select(variable: PreviewSource, index: usize) -> SelectionSample {
    SelectionSample { variable, index }
}

/// An unresolved segment.
fn unresolved(
    text: &str,
    source: Option<PreviewSource>,
    reason: PreviewUnresolved,
) -> PreviewSegment {
    PreviewSegment::Unresolved {
        text: text.to_owned(),
        source,
        reason,
    }
} // End of function unresolved()

/// A literal segment.
fn literal(text: &str) -> PreviewSegment {
    PreviewSegment::Literal {
        text: text.to_owned(),
    }
}

/// A sample segment.
fn sample(text: &str, source: PreviewSource) -> PreviewSegment {
    PreviewSegment::Sample {
        text: text.to_owned(),
        source,
    }
}

/// Every text a preview body carries, concatenated.
fn flattened(segments: &[PreviewSegment]) -> String {
    segments
        .iter()
        .map(|segment| match segment {
            PreviewSegment::Literal { text }
            | PreviewSegment::Sample { text, .. }
            | PreviewSegment::Unresolved { text, .. } => text.clone(),
            PreviewSegment::Choice { segments, .. } => flattened(segments),
            PreviewSegment::Placeholder { .. } => String::new(),
        })
        .collect()
} // End of function flattened()

/// Echo, choice, random, form and capture in one match, with a global.
const KINDS: &str = "\
global_vars:
  - name: greeting
    type: echo
    params:
      echo: 'Hello {{who}}'
  - name: who
    type: echo
    params:
      echo: world
matches:
  - regex: 'order (?P<num>\\d+)'
    replace: '{{greeting}}: {{pick}} / {{coin}} / {{f.name}} / {{num}} / {{e}}'
    vars:
      - name: pick
        type: choice
        params:
          values:
            - label: 'First option'
              id: 'first-id'
            - 'plain'
      - name: coin
        type: random
        params:
          choices:
            - heads
            - 'tails {{pick}}'
      - name: f
        type: form
        params:
          layout: 'Name [[name]]'
      - name: e
        type: echo
        params:
          echo: 'e says {{pick}}'
";

/// Samples for [`KINDS`].
fn kinds_samples() -> PreviewSamples {
    PreviewSamples {
        selections: vec![select(local(0), 0), select(local(1), 1)],
        form_values: vec![FormValueSample {
            form: local(2),
            field: "name".to_owned(),
            value: "Ada".to_owned(),
        }],
        captures: vec![CaptureSample {
            name: "num".to_owned(),
            value: "42".to_owned(),
        }],
        instant: None,
    }
} // End of function kinds_samples()

#[test]
fn identical_requests_give_identical_output() {
    let samples = kinds_samples();
    let first = preview_of(KINDS, 0, &samples);
    let second = preview_of(KINDS, 0, &samples.clone());
    assert_eq!(first, second);
    assert_eq!(
        serde_json::to_string(&first).expect("serializes"),
        serde_json::to_string(&second).expect("serializes"),
        "the wire form is byte-identical too"
    );
    // A request that differs only in its samples gives another answer, so the
    // equality above is not vacuous.
    let mut other = samples;
    other.selections[0].index = 1;
    assert_ne!(preview_of(KINDS, 0, &other), first);
} // End of function identical_requests_give_identical_output()

#[test]
fn every_supported_kind_previews_its_example() {
    let preview = preview_of(KINDS, 0, &kinds_samples());
    assert_eq!(preview.limit, None);
    assert_eq!(preview.bodies[0].field, ContentKind::Replace);
    let choice = |text: &str| PreviewSegment::Choice {
        source: local(0),
        label: "First option".to_owned(),
        segments: vec![sample(text, local(0))],
    };
    let global = |index: usize| PreviewSource::Global { index };
    assert_eq!(
        only_body(&preview),
        [
            sample("Hello ", global(0)),
            sample("world", global(1)),
            literal(": "),
            // The returned id, enclosed with the displayed label.
            choice("first-id"),
            literal(" / "),
            sample("tails ", local(1)),
            choice("first-id"),
            literal(" / "),
            sample("Ada", local(2)),
            literal(" / "),
            sample(
                "42",
                PreviewSource::Capture {
                    name: "num".to_owned()
                }
            ),
            literal(" / "),
            sample("e says ", local(3)),
            choice("first-id"),
        ]
    );
    // A plain string entry is its own id and carries no label.
    let plain = PreviewSamples {
        selections: vec![select(local(0), 1)],
        ..PreviewSamples::default()
    };
    let preview = preview_of(KINDS, 0, &plain);
    assert!(only_body(&preview).contains(&sample("plain", local(0))));
} // End of function every_supported_kind_previews_its_example()

#[test]
fn missing_and_out_of_range_samples_terminate_with_codes() {
    let preview = preview_of(KINDS, 0, &PreviewSamples::default());
    let body = only_body(&preview);
    for (text, source, reason) in [
        ("{{pick}}", Some(local(0)), PreviewUnresolved::MissingSample),
        ("{{coin}}", Some(local(1)), PreviewUnresolved::MissingSample),
        (
            "{{f.name}}",
            Some(local(2)),
            PreviewUnresolved::MissingSample,
        ),
        (
            "{{num}}",
            Some(PreviewSource::Capture {
                name: "num".to_owned(),
            }),
            PreviewUnresolved::MissingSample,
        ),
    ] {
        assert!(
            body.contains(&unresolved(text, source, reason)),
            "{text}: {body:?}"
        );
    } // End of the loop over the unsampled references
      // A value that needs an unsampled one keeps the inner token identifiable.
    assert!(body.contains(&unresolved(
        "{{pick}}",
        Some(local(0)),
        PreviewUnresolved::MissingSample
    )));
    let beyond = PreviewSamples {
        selections: vec![select(local(0), 2), select(local(1), 7)],
        ..PreviewSamples::default()
    };
    let preview = preview_of(KINDS, 0, &beyond);
    let body = only_body(&preview);
    assert!(body.contains(&unresolved(
        "{{pick}}",
        Some(local(0)),
        PreviewUnresolved::SampleOutOfRange
    )));
    assert!(body.contains(&unresolved(
        "{{coin}}",
        Some(local(1)),
        PreviewUnresolved::SampleOutOfRange
    )));
    // The first sample for an address wins; a later one is ignored.
    let doubled = PreviewSamples {
        selections: vec![select(local(0), 1), select(local(0), 0)],
        ..PreviewSamples::default()
    };
    assert!(only_body(&preview_of(KINDS, 0, &doubled)).contains(&sample("plain", local(0))));
} // End of function missing_and_out_of_range_samples_terminate_with_codes()

#[test]
fn cycles_terminate_with_codes() {
    let source = "\
matches:
  - trigger: ':c'
    replace: '{{a}}|{{b}}|{{s}}|{{d}}|{{x}}|{{c}}'
    vars:
      - name: a
        type: echo
        params:
          echo: 'A{{b}}'
      - name: b
        type: echo
        params:
          echo: 'B{{a}}'
      - name: s
        type: echo
        params:
          echo: 'S{{s}}'
      - name: d
        type: echo
        depends_on:
          - x
        params:
          echo: D
      - name: x
        type: echo
        depends_on:
          - d
        params:
          echo: X
      - name: c
        type: echo
        params:
          echo: 'C{{a}}'
";
    let preview = preview_of(source, 0, &PreviewSamples::default());
    let body = only_body(&preview);
    for (text, index) in [
        ("{{a}}", 0),
        ("{{b}}", 1),
        ("{{s}}", 2),
        ("{{d}}", 3),
        ("{{x}}", 4),
    ] {
        assert!(
            body.contains(&unresolved(
                text,
                Some(local(index)),
                PreviewUnresolved::Cycle
            )),
            "{text} is a cycle member (inferred, self-loop or explicit): {body:?}"
        );
    }
    // A consumer of a cycle member is evaluated, and the member stays a code.
    assert!(body.contains(&sample("C", local(5))));
    assert!(body.ends_with(&[
        sample("C", local(5)),
        unresolved("{{a}}", Some(local(0)), PreviewUnresolved::Cycle),
    ]));
} // End of function cycles_terminate_with_codes()

/// A chain of `length` echo variables, `v0` referencing `v1` and so on, the
/// body referencing `v0`.
fn chain(length: usize) -> String {
    let mut source =
        String::from("matches:\n  - trigger: ':d'\n    replace: '{{v0}}'\n    vars:\n");
    for index in 0..length {
        let echo = if index + 1 < length {
            format!("{index}{{{{v{}}}}}", index + 1)
        } else {
            format!("{index}")
        };
        source.push_str(&format!(
            "      - name: v{index}\n        type: echo\n        params:\n          echo: '{echo}'\n"
        ));
    }
    source
} // End of function chain()

#[test]
fn the_depth_limit_holds_at_the_boundary() {
    let at = preview_of(&chain(MAX_PREVIEW_DEPTH), 0, &PreviewSamples::default());
    let text = flattened(only_body(&at));
    let expected: String = (0..MAX_PREVIEW_DEPTH)
        .map(|index| index.to_string())
        .collect();
    assert_eq!(text, expected, "a chain of exactly the limit resolves");
    assert!(only_body(&at)
        .iter()
        .all(|segment| !matches!(segment, PreviewSegment::Unresolved { .. })));

    let beyond = preview_of(&chain(MAX_PREVIEW_DEPTH + 1), 0, &PreviewSamples::default());
    assert_eq!(
        only_body(&beyond),
        [unresolved(
            "{{v0}}",
            Some(local(0)),
            PreviewUnresolved::DepthLimit
        )],
        "one more variable is refused by name, with no partial guess"
    );
} // End of function the_depth_limit_holds_at_the_boundary()

/// A match whose `replace` is `text`, written as a block scalar so no quoting
/// is involved.
fn with_replace(text: &str) -> String {
    format!("matches:\n  - trigger: ':o'\n    replace: |-\n      {text}\n")
}

#[test]
fn the_output_limit_holds_at_the_boundary() {
    let exact = "x".repeat(MAX_PREVIEW_OUTPUT_BYTES);
    let at = preview_of(&with_replace(&exact), 0, &PreviewSamples::default());
    assert_eq!(at.limit, None);
    assert_eq!(flattened(only_body(&at)), exact);

    let over = "x".repeat(MAX_PREVIEW_OUTPUT_BYTES + 1);
    let beyond = preview_of(&with_replace(&over), 0, &PreviewSamples::default());
    assert_eq!(beyond.limit, Some(PreviewLimit::OutputBytes));
    assert_eq!(
        flattened(only_body(&beyond)).len(),
        MAX_PREVIEW_OUTPUT_BYTES
    );

    // The cut lands on a character boundary: a two-byte character straddling
    // the limit is dropped whole.
    let straddling = format!("{}é", "x".repeat(MAX_PREVIEW_OUTPUT_BYTES - 1));
    let cut = preview_of(&with_replace(&straddling), 0, &PreviewSamples::default());
    assert_eq!(cut.limit, Some(PreviewLimit::OutputBytes));
    assert_eq!(
        flattened(only_body(&cut)),
        "x".repeat(MAX_PREVIEW_OUTPUT_BYTES - 1)
    );

    // A variable's value is capped too, and the cap reaches the answer.
    let long = format!(
        "matches:\n  - trigger: ':v'\n    replace: '{{{{a}}}}'\n    vars:\n      - name: a\n        \
         type: echo\n        params:\n          echo: {}\n",
        "y".repeat(MAX_PREVIEW_OUTPUT_BYTES + 10)
    );
    let capped = preview_of(&long, 0, &PreviewSamples::default());
    assert_eq!(capped.limit, Some(PreviewLimit::OutputBytes));
    assert_eq!(
        flattened(only_body(&capped)).len(),
        MAX_PREVIEW_OUTPUT_BYTES
    );
} // End of function the_output_limit_holds_at_the_boundary()

#[test]
fn the_segment_limit_holds_at_the_boundary() {
    let at = preview_of(
        &with_replace(&"{{u}}".repeat(MAX_PREVIEW_SEGMENTS)),
        0,
        &PreviewSamples::default(),
    );
    assert_eq!(at.limit, None);
    assert_eq!(only_body(&at).len(), MAX_PREVIEW_SEGMENTS);

    let beyond = preview_of(
        &with_replace(&"{{u}}".repeat(MAX_PREVIEW_SEGMENTS + 1)),
        0,
        &PreviewSamples::default(),
    );
    assert_eq!(beyond.limit, Some(PreviewLimit::Segments));
    assert_eq!(only_body(&beyond).len(), MAX_PREVIEW_SEGMENTS);
} // End of function the_segment_limit_holds_at_the_boundary()

#[test]
fn the_work_limit_holds_at_the_boundary() {
    let source = "\
matches:
  - trigger: ':w'
    replace: '{{a}}{{b}}'
    vars:
      - name: a
        type: echo
        params:
          echo: abc
      - name: b
        type: echo
        params:
          echo: de
";
    let document = projected(source);
    let run = |work: usize| {
        preview_match_with_limits(
            &document.view,
            &document.view.matches[0],
            &PreviewSamples::default(),
            PreviewLimits {
                work,
                ..PreviewLimits::DEFAULT
            },
        )
    };
    // `a` costs three bytes and one segment, `b` two and one: seven in all.
    let at = run(7);
    assert_eq!(at.limit, None);
    assert_eq!(flattened(only_body(&at)), "abcde");
    let beyond = run(6);
    assert_eq!(beyond.limit, Some(PreviewLimit::Work));
    assert_eq!(
        only_body(&beyond),
        [
            sample("abc", local(0)),
            unresolved("{{b}}", Some(local(1)), PreviewUnresolved::WorkLimit),
        ]
    );
} // End of function the_work_limit_holds_at_the_boundary()

#[test]
fn reference_tokens_agree_with_the_analysis() {
    let body = "a {{ x }} b {{f.y}} {{ not-a-name }} {{}} {{x}}{{g}} {{x.sub}} {{nobody}}";
    let source = format!(
        "\
global_vars:
  - name: g
    type: echo
    params:
      echo: G
matches:
  - trigger: ':r'
    replace: '{body}'
    vars:
      - name: x
        type: echo
        params:
          echo: X
      - name: f
        type: form
        params:
          layout: '[[y]]'
"
    );
    let document = projected(&source);
    let entry = &document.view.matches[0];
    let preview = preview_match(&document.view, entry, &PreviewSamples::default());
    let segments = only_body(&preview);
    let tokens = scan_references(body);
    assert_eq!(tokens.len(), 6, "the shared scanner reads six references");
    // Everything that is not a reference is literal text, unchanged — the
    // spellings the pattern declines included.
    let mut outside = String::new();
    let mut at = 0;
    for token in &tokens {
        outside.push_str(&body[at..token.span.start]);
        at = token.span.end;
    }
    outside.push_str(&body[at..]);
    let literals: String = segments
        .iter()
        .filter_map(|segment| match segment {
            PreviewSegment::Literal { text } => Some(text.as_str()),
            _ => None,
        })
        .collect();
    assert_eq!(literals, outside);
    assert!(literals.contains("{{ not-a-name }}") && literals.contains("{{}}"));
    let resolved = segments
        .iter()
        .filter(|segment| !matches!(segment, PreviewSegment::Literal { .. }))
        .count();
    assert_eq!(
        resolved,
        tokens.len(),
        "one segment per reference: {segments:?}"
    );
    // Per declaration, the preview resolves as many body references to it as
    // the analysis counts.
    let analysis = analyze_match(&document.view, entry);
    for declaration in &analysis.scope.declarations {
        let direct = segments
            .iter()
            .filter(|segment| match segment {
                PreviewSegment::Sample { source, .. }
                | PreviewSegment::Unresolved {
                    source: Some(source),
                    ..
                } => *source == local(declaration.index),
                _ => false,
            })
            .count();
        assert_eq!(
            direct, declaration.usage.body,
            "declaration {}",
            declaration.index
        );
    } // End of the loop over the declarations
    assert!(segments.contains(&unresolved(
        "{{x.sub}}",
        Some(local(0)),
        PreviewUnresolved::SubnameUnsupported
    )));
    assert!(segments.contains(&unresolved(
        "{{nobody}}",
        None,
        PreviewUnresolved::UnknownName
    )));
    assert!(segments.contains(&sample("G", PreviewSource::Global { index: 0 })));
} // End of function reference_tokens_agree_with_the_analysis()

#[test]
fn placeholders_stand_for_what_is_never_run_or_read() {
    let marker = std::env::temp_dir().join(format!("espansoconfig-4-17-{}", std::process::id()));
    let _ = std::fs::remove_file(&marker);
    let source = format!(
        "\
matches:
  - trigger: ':p'
    replace: '{{{{clip}}}} {{{{sh}}}} {{{{sc}}}} {{{{m}}}} {{{{e}}}}'
    vars:
      - name: clip
        type: clipboard
      - name: sh
        type: shell
        params:
          cmd: 'touch {marker}'
      - name: sc
        type: script
        params:
          args:
            - /usr/bin/touch
            - '{marker}'
      - name: m
        type: match
        params:
          trigger: ':other'
      - name: e
        type: echo
        params:
          echo: 'wraps {{{{sh}}}}'
",
        marker = marker.display()
    );
    let preview = preview_of(&source, 0, &PreviewSamples::default());
    let body = only_body(&preview);
    let command = format!("touch {}", marker.display());
    let placeholder = |index: usize, placeholder: PreviewPlaceholder| PreviewSegment::Placeholder {
        source: local(index),
        placeholder,
    };
    assert_eq!(body[0], placeholder(0, PreviewPlaceholder::Clipboard {}));
    assert_eq!(
        body[2],
        placeholder(
            1,
            PreviewPlaceholder::Shell {
                command: Some(command.clone())
            }
        )
    );
    assert_eq!(
        body[4],
        placeholder(
            2,
            PreviewPlaceholder::Script {
                args: Some(vec![
                    "/usr/bin/touch".to_owned(),
                    marker.display().to_string()
                ])
            }
        )
    );
    assert_eq!(
        body[6],
        placeholder(
            3,
            PreviewPlaceholder::Match {
                trigger: Some(":other".to_owned())
            }
        )
    );
    // A placeholder inside another value stays a placeholder.
    assert!(body.ends_with(&[
        sample("wraps ", local(4)),
        placeholder(
            1,
            PreviewPlaceholder::Shell {
                command: Some(command)
            }
        ),
    ]));
    assert!(
        !marker.exists(),
        "neither the command nor the script was run"
    );
} // End of function placeholders_stand_for_what_is_never_run_or_read()

#[test]
fn hostile_html_comes_back_as_data() {
    let source = "\
matches:
  - trigger: ':h'
    html: '<script>alert(1)</script>{{a}}<img src=x onerror=alert(2)>{{f.v}}'
    vars:
      - name: a
        type: echo
        params:
          echo: '<b onclick=\"x()\">&amp;</b>'
      - name: f
        type: form
        params:
          layout: '[[v]]'
";
    let samples = PreviewSamples {
        form_values: vec![FormValueSample {
            form: local(1),
            field: "v".to_owned(),
            value: "<iframe src=javascript:alert(3)>".to_owned(),
        }],
        ..PreviewSamples::default()
    };
    let preview = preview_of(source, 0, &samples);
    assert_eq!(preview.bodies[0].field, ContentKind::Html);
    assert_eq!(
        only_body(&preview),
        [
            literal("<script>alert(1)</script>"),
            sample("<b onclick=\"x()\">&amp;</b>", local(0)),
            literal("<img src=x onerror=alert(2)>"),
            sample("<iframe src=javascript:alert(3)>", local(1)),
        ]
    );
} // End of function hostile_html_comes_back_as_data()

#[test]
fn forms_answer_samples_and_say_what_is_missing() {
    let source = "\
matches:
  - trigger: ':f'
    replace: '{{f}} {{f.there}} {{f.gone}} {{u.x}}'
    vars:
      - name: f
        type: form
        params:
          layout: 'A [[there]]'
      - name: u
        type: form
        params:
          layout: 'B [[ bad ]]'
  - trigger: ':s'
    form: 'Hi [[name]], [[ bad ]] {{form1.name}}!'
";
    let preview = preview_of(source, 0, &PreviewSamples::default());
    assert_eq!(
        only_body(&preview),
        [
            unresolved("{{f}}", Some(local(0)), PreviewUnresolved::FormIsNotAScalar),
            literal(" "),
            unresolved(
                "{{f.there}}",
                Some(local(0)),
                PreviewUnresolved::MissingSample
            ),
            literal(" "),
            unresolved(
                "{{f.gone}}",
                Some(local(0)),
                PreviewUnresolved::FieldNotInLayout
            ),
            literal(" "),
            // An unsupported layout cannot say a field is absent.
            unresolved("{{u.x}}", Some(local(1)), PreviewUnresolved::MissingSample),
        ]
    );
    let shorthand = PreviewSource::ShorthandForm {};
    let samples = PreviewSamples {
        form_values: vec![FormValueSample {
            form: shorthand.clone(),
            field: "name".to_owned(),
            value: "Ada".to_owned(),
        }],
        ..PreviewSamples::default()
    };
    let preview = preview_of(source, 1, &samples);
    assert_eq!(preview.bodies[0].field, ContentKind::Form);
    assert_eq!(
        only_body(&preview),
        [
            literal("Hi "),
            sample("Ada", shorthand.clone()),
            literal(", "),
            unresolved(
                "[[ bad ]]",
                None,
                PreviewUnresolved::UnsupportedLayoutSyntax
            ),
            literal(" "),
            unresolved(
                "{{form1.name}}",
                None,
                PreviewUnresolved::UnverifiedLayoutReference
            ),
            literal("!"),
        ]
    );
    let unsampled = preview_of(source, 1, &PreviewSamples::default());
    assert!(only_body(&unsampled).contains(&unresolved(
        "[[name]]",
        Some(shorthand),
        PreviewUnresolved::MissingSample
    )));
} // End of function forms_answer_samples_and_say_what_is_missing()

#[test]
fn uncertain_inputs_are_not_coerced() {
    let source = "\
matches:
  - trigger: ':u'
    replace: '{{on}}|{{off}}|{{maybe}}|{{yes}}|{{d}}|{{k}}|{{dup}}|{{plain}}'
    vars:
      - name: on
        type: echo
        inject_vars: true
        params:
          echo: 'on {{plain}}'
      - name: off
        type: echo
        inject_vars: false
        params:
          echo: 'off {{plain}}'
      - name: maybe
        type: echo
        inject_vars: sometimes
        params:
          echo: 'maybe {{plain}}'
      - name: yes
        type: echo
        params:
          echo: yes
      - name: d
        type: date
        params:
          format: '%Y'
      - name: k
        type: mystery
      - name: dup
        type: echo
        params:
          echo: one
      - name: dup
        type: echo
        params:
          echo: two
      - name: plain
        type: echo
        params:
          echo: P
";
    let preview = preview_of(source, 0, &PreviewSamples::default());
    let body = only_body(&preview);
    assert!(body.starts_with(&[sample("on ", local(0)), sample("P", local(8))]));
    // Injection certainly disabled: the reference is the variable's own text.
    assert!(body.contains(&sample("off {{plain}}", local(1))));
    for (text, source, reason) in [
        (
            "{{maybe}}",
            Some(local(2)),
            PreviewUnresolved::InjectionUncertain,
        ),
        (
            "{{yes}}",
            Some(local(3)),
            PreviewUnresolved::AmbiguousScalar,
        ),
        (
            "{{d}}",
            Some(local(4)),
            PreviewUnresolved::DateInstantMissing,
        ),
        ("{{k}}", Some(local(5)), PreviewUnresolved::KindNotPreviewed),
        ("{{dup}}", None, PreviewUnresolved::AmbiguousName),
    ] {
        assert!(
            body.contains(&unresolved(text, source, reason)),
            "{text}: {body:?}"
        );
    }
} // End of function uncertain_inputs_are_not_coerced()

#[test]
fn the_samples_refuse_unknown_fields() {
    let good = serde_json::json!({
        "selections": [{ "variable": { "Local": { "index": 0 } }, "index": 1 }],
        "form_values": [{ "form": { "ShorthandForm": {} }, "field": "a", "value": "b" }],
        "captures": [{ "name": "n", "value": "v" }],
        "instant": null,
    });
    let read: PreviewSamples = serde_json::from_value(good.clone()).expect("reads");
    assert_eq!(serde_json::to_value(&read).expect("writes"), good);
    let mut extra = good.clone();
    extra["force"] = serde_json::json!(true);
    assert!(serde_json::from_value::<PreviewSamples>(extra).is_err());
    let mut span = good;
    span["selections"][0]["span"] = serde_json::json!({ "start": 0, "end": 1 });
    assert!(serde_json::from_value::<PreviewSamples>(span).is_err());
} // End of function the_samples_refuse_unknown_fields()

// ---------------------------------------------------------------------------
// Review fixes (docs/reviews/4-17.md)
// ---------------------------------------------------------------------------

/// What a segment is charged: its texts and label, and one per element of a
/// nested list (a script's arguments, a choice's enclosed segments) besides
/// that element's own charge. Walks the JSON
/// wire form so it reads any segment shape, nested ones included.
fn charged(value: &serde_json::Value) -> usize {
    match value {
        serde_json::Value::String(text) => text.len(),
        serde_json::Value::Array(items) => items.iter().map(|item| 1 + charged(item)).sum(),
        // A `reason` is a code name the wire spells, not payload the preview
        // carries, so it is not charged.
        serde_json::Value::Object(fields) => fields
            .iter()
            .filter(|(key, _)| key.as_str() != "reason")
            .map(|(_, inner)| charged(inner))
            .sum(),
        _ => 0,
    }
} // End of function charged()

/// A match whose `replace` references `s` `references` times, `s` a script
/// whose `args` are `/bin/echo` and `empties` empty strings.
fn script_with_empty_arguments(empties: usize, references: usize) -> String {
    let mut source = format!(
        "matches:\n  - trigger: ':s'\n    replace: '{}'\n    vars:\n      - name: s\n        \
         type: script\n        params:\n          args:\n            - /bin/echo\n",
        "{{s}}".repeat(references)
    );
    for _ in 0..empties {
        source.push_str("            - ''\n");
    }
    source
} // End of function script_with_empty_arguments()

#[test]
fn script_arguments_are_charged_per_element_at_the_boundary() {
    // `/bin/echo` and two empty strings: nine bytes and three elements.
    let document = projected(&script_with_empty_arguments(2, 1));
    let run = |output_bytes: usize| {
        preview_match_with_limits(
            &document.view,
            &document.view.matches[0],
            &PreviewSamples::default(),
            PreviewLimits {
                output_bytes,
                ..PreviewLimits::DEFAULT
            },
        )
    };
    let at = run(12);
    assert_eq!(
        only_body(&at),
        [PreviewSegment::Placeholder {
            source: local(0),
            placeholder: PreviewPlaceholder::Script {
                args: Some(vec!["/bin/echo".to_owned(), String::new(), String::new()]),
            },
        }]
    );
    let beyond = run(11);
    assert_eq!(
        only_body(&beyond),
        [unresolved(
            "{{s}}",
            Some(local(0)),
            PreviewUnresolved::ValueUnreadable
        )],
        "an argument list charged beyond the budget is never built"
    );
} // End of function script_arguments_are_charged_per_element_at_the_boundary()

#[test]
fn the_reviewers_empty_argument_script_stays_inside_the_budget() {
    let preview = preview_of(
        &script_with_empty_arguments(9999, MAX_PREVIEW_SEGMENTS),
        0,
        &PreviewSamples::default(),
    );
    let wire = serde_json::to_value(&preview).expect("serializes");
    let total: usize = wire["bodies"]
        .as_array()
        .expect("bodies")
        .iter()
        .flat_map(|body| body["segments"].as_array().expect("segments").iter())
        .map(charged)
        .sum();
    assert!(
        total <= MAX_PREVIEW_OUTPUT_BYTES,
        "the answer carries {total} charged units, over the {MAX_PREVIEW_OUTPUT_BYTES} budget"
    );
} // End of function the_reviewers_empty_argument_script_stays_inside_the_budget()

/// Whether every JSON object for which `wanted` holds has itself, or an
/// enclosing object, carrying `"label": label`.
fn under_label(
    value: &serde_json::Value,
    label: &str,
    enclosed: bool,
    wanted: &dyn Fn(&serde_json::Value) -> bool,
) -> bool {
    match value {
        serde_json::Value::Object(fields) => {
            let here = enclosed || fields.get("label").and_then(|l| l.as_str()) == Some(label);
            (!wanted(value) || here)
                && fields
                    .values()
                    .all(|inner| under_label(inner, label, here, wanted))
        }
        serde_json::Value::Array(items) => items
            .iter()
            .all(|item| under_label(item, label, enclosed, wanted)),
        _ => true,
    }
} // End of function under_label()

/// Every `"text"` string under `value`, in document order.
fn collect_texts(value: &serde_json::Value, texts: &mut Vec<String>) {
    match value {
        serde_json::Value::Object(fields) => {
            for (key, inner) in fields {
                match (key.as_str(), inner) {
                    ("text", serde_json::Value::String(text)) => texts.push(text.clone()),
                    _ => collect_texts(inner, texts),
                }
            }
        }
        serde_json::Value::Array(items) => items.iter().for_each(|item| collect_texts(item, texts)),
        _ => {}
    }
} // End of function collect_texts()

#[test]
fn a_choice_label_encloses_what_its_id_substitutes() {
    let source = "\
matches:
  - trigger: ':l'
    replace: '[{{pick}}]'
    vars:
      - name: x
        type: echo
        params:
          echo: X
      - name: c
        type: clipboard
      - name: pick
        type: choice
        params:
          values:
            - label: Whole
              id: '{{x}}'
            - label: Mixed
              id: 'a {{x}} {{c}} b'
";
    for (index, label, expected) in [(0, "Whole", "[X]"), (1, "Mixed", "[a X  b]")] {
        let samples = PreviewSamples {
            selections: vec![select(local(2), index)],
            ..PreviewSamples::default()
        };
        let wire = serde_json::to_value(preview_of(source, 0, &samples)).expect("serializes");
        let segments = &wire["bodies"][0]["segments"];
        // Every text, in order, reads as the example.
        let mut texts = Vec::new();
        collect_texts(segments, &mut texts);
        assert_eq!(texts.concat(), expected, "{wire}");
        // Every text the selected entry produced — the substituted `X`
        // included — and the clipboard placeholder inside it sit under the
        // selected entry's label.
        let inside = |value: &serde_json::Value| {
            matches!(
                value.get("text").and_then(|t| t.as_str()),
                Some("X" | "a " | " " | " b")
            ) || value.get("placeholder").is_some()
        };
        assert!(
            under_label(segments, label, false, &inside),
            "{label}: {wire}"
        );
    } // End of the loop over the two entries
} // End of function a_choice_label_encloses_what_its_id_substitutes()

#[test]
fn the_argument_count_cap_holds_at_the_boundary() {
    // `/bin/echo` plus empties: exactly the cap, then one more.
    let at = preview_of(
        &script_with_empty_arguments(MAX_PREVIEW_ARGUMENTS - 1, 1),
        0,
        &PreviewSamples::default(),
    );
    match only_body(&at) {
        [PreviewSegment::Placeholder {
            placeholder: PreviewPlaceholder::Script { args: Some(args) },
            ..
        }] => assert_eq!(args.len(), MAX_PREVIEW_ARGUMENTS),
        other => panic!("the cap itself is shown: {other:?}"),
    }
    let beyond = preview_of(
        &script_with_empty_arguments(MAX_PREVIEW_ARGUMENTS, 1),
        0,
        &PreviewSamples::default(),
    );
    assert_eq!(
        only_body(&beyond),
        [unresolved(
            "{{s}}",
            Some(local(0)),
            PreviewUnresolved::ValueUnreadable
        )]
    );
} // End of function the_argument_count_cap_holds_at_the_boundary()
