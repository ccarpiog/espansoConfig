//! Phase 1a acceptance: the read-only semantic projection.
//!
//! Every fixture of the synthetic corpus and every file of the real one is
//! projected, and each projection must survive four independent checks:
//!
//! - **it exists at all** — no panic, on a valid file, on a deliberately broken
//!   one, and on every prefix of every fixture;
//! - **no key was dropped** — twice over. For each mapping the projection
//!   walked, the union of its modelled and unknown key nodes is re-derived here
//!   from the syntax index and must equal that mapping's own entries, exactly
//!   and without duplicates; and, because that check can only ever audit the
//!   records that *exist*, every mapping key of the **whole document tree** is
//!   re-derived independently and must be either named by the projection or
//!   inside a span the projection recorded without descending into it. A
//!   mapping for which no record was ever emitted fails the second and is
//!   invisible to the first;
//! - **no scalar was type-inferred** — every [`ScalarView`] the projection
//!   exposes must equal `crate::emit::decode()` of its own span. This is D2u,
//!   and [`an_inferred_scalar_is_caught_by_the_oracle`] shows the check can
//!   disagree rather than merely pass;
//! - **the counts are what they were** — [`SYNTHETIC_PROJECTIONS`] pins a
//!   complete row per fixture and is asserted to cover the corpus exactly, so
//!   two fixtures cannot exchange coverage inside one total and a new fixture
//!   cannot disappear into it.
//!
//! # Privacy
//!
//! The real corpus is the owner's private configuration (`CLAUDE.md` section
//! 1). This file prints file names, counts and byte offsets only. It never
//! prints a scalar, a key, a path or a byte of real content, and every
//! real-corpus test skips cleanly when the directory is absent.

mod common;

use common::{real_corpus, skip_without_real_corpus, synthetic_invalid, synthetic_valid};
use espansoconfig_core::emit::decode;
use espansoconfig_core::model::{
    DiagnosticCode, DocumentContext, DocumentShape, DocumentView, IdentityError, MappingCoverage,
    MatchBadge, ScalarView, UnknownReason, ValueKind, ValueView, VariableKind, MAX_VALUE_DEPTH,
};
use espansoconfig_core::syntax::{NodeId, NodeKind, SyntaxIndex};
use espansoconfig_core::workspace::project_source;
use espansoconfig_core::{DocumentId, ParseOutcome, ScalarStyle, SourceDocument};

/// How many prefixes of each fixture the no-panic sweep projects.
///
/// Every byte offset would be 21 000-odd projections; every seventh is 3 000,
/// runs in under a second, and still crosses every construct boundary in the
/// corpus, because no fixture has a construct only seven bytes wide. The prefix
/// **set** differs per fixture (their lengths differ), so the union across the
/// corpus is not a fixed residue class.
const PREFIX_STRIDE: usize = 7;

/// One fixture's pinned projection row, in [`Counts`]'s declaration order.
type ProjectionRow = (&'static str, [usize; COLUMNS]);

/// How many columns a [`ProjectionRow`] has.
const COLUMNS: usize = 8;

/// The column headings, for the printed table.
const HEADINGS: &str = "matches  gvars  imports  vars  unknown  diags  scalars  ambig";

/// Everything one document's projection is pinned on.
#[derive(Debug, Default, PartialEq, Eq)]
struct Counts {
    /// Entries of `matches`.
    matches: usize,
    /// Entries of `global_vars`.
    global_vars: usize,
    /// Entries of `imports`.
    imports: usize,
    /// Variables anywhere: a match's `vars` plus `global_vars`.
    variables: usize,
    /// Unknown entries anywhere, nested ones included.
    unknown: usize,
    /// Diagnostics of every code.
    diagnostics: usize,
    /// Scalars the projection exposes.
    scalars: usize,
    /// Of those, the plain ones YAML 1.1 and 1.2 core do not agree about.
    ambiguous: usize,
}

impl Counts {
    /// Reads the counts off a projected view.
    fn of(view: &DocumentView) -> Counts {
        let scalars = view.scalars();
        Counts {
            matches: view.matches.len(),
            global_vars: view.global_vars.len(),
            imports: view.imports.len(),
            variables: view.global_vars.len()
                + view
                    .matches
                    .iter()
                    .map(|entry| entry.vars.len())
                    .sum::<usize>(),
            unknown: view.all_unknown_entries().len(),
            diagnostics: view.diagnostics.len(),
            ambiguous: scalars
                .iter()
                .filter(|scalar| scalar.ambiguous_yaml_1_1)
                .count(),
            scalars: scalars.len(),
        }
    } // End of function of()

    /// Rebuilds a row from its pinned columns.
    fn from_row(row: [usize; COLUMNS]) -> Counts {
        Counts {
            matches: row[0],
            global_vars: row[1],
            imports: row[2],
            variables: row[3],
            unknown: row[4],
            diagnostics: row[5],
            scalars: row[6],
            ambiguous: row[7],
        }
    }

    /// Folds another document's counts into these.
    fn add(&mut self, other: &Counts) {
        self.matches += other.matches;
        self.global_vars += other.global_vars;
        self.imports += other.imports;
        self.variables += other.variables;
        self.unknown += other.unknown;
        self.diagnostics += other.diagnostics;
        self.scalars += other.scalars;
        self.ambiguous += other.ambiguous;
    }

    /// The row as printed columns.
    fn columns(&self) -> String {
        format!(
            "{:>7}  {:>5}  {:>7}  {:>4}  {:>7}  {:>5}  {:>7}  {:>5}",
            self.matches,
            self.global_vars,
            self.imports,
            self.variables,
            self.unknown,
            self.diagnostics,
            self.scalars,
            self.ambiguous
        )
    }
} // End of impl Counts

/// Every synthetic fixture's complete projection row, pinned exactly.
///
/// A complete row per fixture rather than one corpus-wide tally, for the reason
/// the Phase 0c-2b review's finding 4 gave: a single total cannot tell two
/// fixtures that exchanged coverage from two that did not. The list is asserted
/// to cover the corpus exactly, so a new fixture must be given a row rather than
/// vanishing into a sum.
const SYNTHETIC_PROJECTIONS: [ProjectionRow; 33] = [
    ("anchors-aliases-tags-merge.yml", [6, 1, 0, 2, 4, 16, 16, 3]),
    ("blank-lines.yml", [4, 0, 0, 0, 0, 0, 10, 0]),
    ("block-scalar-header-tails.yml", [3, 0, 0, 0, 0, 0, 7, 0]),
    (
        "block-scalar-leading-blank-lines.yml",
        [5, 0, 0, 0, 0, 0, 16, 0],
    ),
    ("block-scalar-terminal-spaces.yml", [2, 0, 0, 0, 0, 0, 6, 0]),
    ("block-scalars.yml", [11, 0, 0, 0, 0, 0, 34, 0]),
    ("bom-utf8.yml", [2, 0, 0, 0, 0, 0, 5, 0]),
    ("comments-everywhere.yml", [3, 0, 0, 0, 0, 0, 8, 0]),
    // No `matches`, `global_vars` or `imports`, so its shape is a profile and
    // every one of its keys is projected shallowly — 42 scalars, 0 unknown.
    // Its one diagnostic is the shape/location disagreement: in this corpus the
    // fixture has no `config/` directory above it.
    ("config-profile.yml", [0, 0, 0, 0, 0, 1, 42, 6]),
    ("crlf-line-endings.yml", [3, 0, 0, 0, 0, 0, 7, 0]),
    // Two repeated modelled keys, recorded as unknown entries rather than
    // silently losing the second occurrence.
    ("duplicate-keys.yml", [3, 0, 0, 2, 2, 5, 15, 0]),
    ("empty-entries-and-extents.yml", [4, 0, 0, 2, 1, 1, 15, 3]),
    ("explicit-key-mappings.yml", [2, 1, 0, 1, 1, 3, 8, 0]),
    // `vars` holds a mapping rather than a sequence in four move fixtures. That
    // is not a shape espanso accepts, so the entry is recorded as
    // `UnexpectedShape` and reported — not modelled, and not dropped either.
    (
        "file-comments-and-mixed-endings.yml",
        [3, 0, 0, 0, 1, 1, 8, 0],
    ),
    ("flow-collections.yml", [5, 0, 0, 1, 0, 1, 25, 0]),
    ("folded-more-indented.yml", [4, 0, 0, 0, 0, 0, 13, 0]),
    ("form-layout-and-choice.yml", [3, 0, 0, 2, 0, 0, 59, 3]),
    ("html-and-markdown.yml", [5, 0, 0, 0, 0, 0, 12, 1]),
    ("imports-and-global-vars.yml", [4, 3, 3, 3, 0, 0, 32, 3]),
    ("move-a-match.yml", [3, 0, 0, 0, 1, 1, 7, 0]),
    ("move-block-scalar-seams.yml", [6, 0, 0, 0, 0, 0, 13, 0]),
    (
        "move-kept-comment-joins-a-block.yml",
        [4, 0, 0, 0, 4, 2, 7, 0],
    ),
    ("move-run-joins.yml", [3, 0, 0, 0, 2, 2, 7, 0]),
    // Three documents; espanso loads the first, and the other two are named by
    // a diagnostic apiece with their bytes rather than dropped.
    ("multi-document.yml", [1, 0, 0, 0, 0, 5, 3, 0]),
    ("no-trailing-newline.yml", [1, 0, 0, 0, 0, 0, 3, 0]),
    ("non-ascii.yml", [6, 0, 0, 1, 0, 0, 17, 0]),
    // Every hazardous value in this fixture is written quoted on purpose, so
    // its ambiguity column is 0: quoting is exactly what removes the ambiguity.
    ("plain-scalar-hazards.yml", [37, 0, 0, 0, 0, 0, 75, 0]),
    ("run-based-removal-boundaries.yml", [2, 0, 0, 0, 2, 2, 5, 0]),
    ("run-based-removal-envelope.yml", [2, 0, 0, 0, 2, 2, 5, 0]),
    ("scalar-styles.yml", [11, 0, 0, 0, 0, 1, 23, 0]),
    // A single line, no line break, and no match-file key: a profile shape.
    ("single-line-no-line-ending.yml", [0, 0, 0, 0, 0, 1, 3, 0]),
    ("unicode-offsets.yml", [0, 0, 0, 0, 0, 1, 9, 0]),
    ("variable-chain.yml", [2, 0, 0, 6, 0, 0, 55, 4]),
];

/// Projects one corpus file the way the workspace would.
fn project(name: &str, source: &str) -> SourceDocument {
    let context = DocumentContext::detached(DocumentId(0), name);
    project_source(&context, source)
}

/// The syntax index of a projected document, or a panic naming the fixture.
fn index_of<'a>(name: &str, document: &'a SourceDocument) -> &'a SyntaxIndex {
    document
        .parse
        .syntax()
        .unwrap_or_else(|| panic!("{name}: expected a valid fixture"))
}

// ---------------------------------------------------------------------------
// The two oracles
// ---------------------------------------------------------------------------

/// Why one projected scalar disagreed with its own source bytes.
///
/// Returned rather than asserted so [`an_inferred_scalar_is_caught_by_the_oracle`]
/// can hand the same function a deliberately wrong view and require it to
/// object. An oracle that cannot disagree is not an oracle.
fn scalar_disagreement(source: &str, index: &SyntaxIndex, scalar: &ScalarView) -> Option<String> {
    let Some(node) = index.node(scalar.node) else {
        return Some(format!("node {} is not in the index", scalar.node.get()));
    };
    if node.kind != NodeKind::Scalar {
        return Some(format!("node {} is not a scalar", scalar.node.get()));
    }
    let Some(detail) = node.scalar.as_ref() else {
        return Some(format!("node {} has no scalar detail", scalar.node.get()));
    };
    if scalar.span != node.span {
        return Some(format!(
            "span {}..{} is not the node's {}..{}",
            scalar.span.start, scalar.span.end, node.span.start, node.span.end
        ));
    }
    if scalar.style != detail.presentation.style {
        return Some(format!(
            "style {:?} is not the source's {:?}",
            scalar.style, detail.presentation.style
        ));
    }
    // The D2u check itself: the text the projection exposes is `decode()` of the
    // span, byte for byte. Anything a type resolver would have produced —
    // `true` for `on`, `10` for `012` — differs from it.
    match decode(source, &detail.presentation) {
        // The comparison is **unconditional**. An earlier form only compared
        // when `scalar.decoded` was true, which left a wrong view carrying
        // `text: "true"` and `decoded: false` over a source `on` uncaught — the
        // oracle's claim was broader than what it enforced. Production only ever
        // clears `decoded` after a real decode failure, so requiring the text to
        // equal a *successful* decode is exactly the invariant, and the
        // disabling experiment below now covers the branch.
        Ok(decoded) => {
            if decoded != scalar.text {
                Some(format!(
                    "projected {} bytes where decode() gives {} (decoded={})",
                    scalar.text.len(),
                    decoded.len(),
                    scalar.decoded
                ))
            } else if !scalar.decoded {
                Some("decode() succeeded but decoded is false".to_owned())
            } else {
                None
            }
        }
        Err(_) if !scalar.decoded => None,
        Err(error) => Some(format!("decode() failed with {error} but decoded is true")),
    }
} // End of function scalar_disagreement()

/// The key nodes of the mapping `id` names, re-derived from the index.
///
/// A second transcription of the flat alternating key/value layout, written
/// here so that a defect in the library's own reader cannot make the coverage
/// check agree with it by construction.
fn mapping_key_nodes(index: &SyntaxIndex, id: NodeId) -> Vec<NodeId> {
    let Some(node) = index.node(id) else {
        return Vec::new();
    };
    if node.kind != NodeKind::Mapping {
        return Vec::new();
    }
    let mut keys = Vec::new();
    let mut position = 0usize;
    while position + 1 < node.children.len() {
        keys.push(node.children[position]);
        position += 2;
    }
    keys
} // End of function mapping_key_nodes()

/// Every mapping key the **document** holds, re-derived from the index.
///
/// The expectation side of the accounting, and it is taken from the syntax tree
/// rather than from anything the projection emitted. That is the difference
/// that matters: a walk over `view.coverage` can only ever audit records that
/// exist, so an entire mapping the projection never scanned — the one nested
/// under an unmodelled key — passes it vacuously and fails this.
fn document_key_nodes(index: &SyntaxIndex) -> Vec<NodeId> {
    let mut keys = Vec::new();
    for node in index.nodes() {
        keys.extend(mapping_key_nodes(index, node.id));
    }
    keys.sort_unstable();
    keys.dedup();
    keys
} // End of function document_key_nodes()

/// Which of the document's keys `view` neither named nor recorded by span.
///
/// The property, stated exactly: *every key is either modelled, or recorded as
/// unknown, or lies inside a span the projection kept without descending into
/// it.* An empty result is the property holding.
fn unaccounted_keys(index: &SyntaxIndex, view: &DocumentView) -> Vec<NodeId> {
    let named = view.named_key_nodes();
    let mut lost = Vec::new();
    for key in document_key_nodes(index) {
        if named.binary_search(&key).is_ok() {
            continue;
        }
        let Some(span) = index.node(key).map(|node| node.span) else {
            lost.push(key);
            continue;
        };
        let recorded = view
            .undescended
            .iter()
            .any(|kept| !kept.is_empty() && kept.contains(span));
        if !recorded {
            lost.push(key);
        }
    } // End of the loop over the document's mapping keys
    lost
} // End of function unaccounted_keys()

/// Why one coverage record failed to account for its mapping.
fn coverage_disagreement(index: &SyntaxIndex, record: &MappingCoverage) -> Option<String> {
    let mut expected = mapping_key_nodes(index, record.mapping);
    expected.sort_unstable();
    let mut claimed: Vec<NodeId> = record
        .modelled
        .iter()
        .chain(record.unknown.iter())
        .copied()
        .collect();
    claimed.sort_unstable();
    let before = claimed.len();
    claimed.dedup();
    if claimed.len() != before {
        return Some(format!(
            "mapping {} claims an entry twice",
            record.mapping.get()
        ));
    }
    if claimed != expected {
        return Some(format!(
            "mapping {} has {} entries and the record accounts for {}",
            record.mapping.get(),
            expected.len(),
            claimed.len()
        ));
    }
    None
} // End of function coverage_disagreement()

/// Runs both oracles over one projected document.
fn audit(name: &str, document: &SourceDocument) {
    let index = index_of(name, document);
    let view = &document.view;

    for record in &view.coverage {
        if let Some(problem) = coverage_disagreement(index, record) {
            panic!("{name}: {problem}");
        }
    }
    // …and the library's own statement of the same invariant must agree with the
    // one re-derived above (`PROGRESS.md` R24). Three layers, and each can
    // contradict the others: this test's re-derivation, the library's
    // `coverage_is_complete`, and the diagnostic the projection raises when its
    // own record does not balance — pinned at zero here.
    assert!(
        view.coverage_is_complete(index),
        "{name}: the library's own coverage check disagrees with this test's"
    );
    assert_eq!(
        view.diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.code == DiagnosticCode::CoverageIsIncomplete)
            .count(),
        0,
        "{name}: the projection reported its own coverage as incomplete"
    );

    // …and the whole-document form, which is the one a missing record cannot
    // hide from. Same three layers: this test's derivation from the tree, the
    // library's own `unaccounted_keys`, and the diagnostic it raises.
    let lost = unaccounted_keys(index, view);
    assert!(
        lost.is_empty(),
        "{name}: {} key(s) are neither named by the projection nor inside a recorded span",
        lost.len()
    );
    assert!(
        view.unaccounted_keys(index).is_empty(),
        "{name}: the library's own key accounting disagrees with this test's"
    );
    assert_eq!(
        view.diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.code == DiagnosticCode::KeyNotAccountedFor)
            .count(),
        0,
        "{name}: the projection reported a key nothing accounted for"
    );
    // The scalar fallback is a visible layer too, and is pinned at zero: no
    // corpus scalar has ever resisted `decode()`.
    assert_eq!(
        view.diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.code == DiagnosticCode::ScalarNotDecodable)
            .count(),
        0,
        "{name}: a scalar could not be decoded"
    );

    for scalar in view.scalars() {
        if let Some(problem) = scalar_disagreement(&document.source, index, scalar) {
            panic!("{name}: node {} {problem}", scalar.node.get());
        }
        // A quoted or block scalar is a string in both schemas by construction,
        // so the ambiguity flag can only ever describe a plain one.
        if scalar.style != ScalarStyle::Plain {
            assert!(
                !scalar.ambiguous_yaml_1_1,
                "{name}: a {:?} scalar is flagged 1.1-ambiguous",
                scalar.style
            );
        }
    } // End of the loop over the document's projected scalars

    // Every unknown entry must be findable in the source, and must name a key
    // the projection genuinely holds no field for.
    for entry in view.all_unknown_entries() {
        assert!(
            index.node(entry.key_node).is_some(),
            "{name}: an unknown entry names a node the index does not have"
        );
        if entry.reason == UnknownReason::NonScalarKey {
            assert!(
                entry.key.is_none(),
                "{name}: a non-scalar key was given a name"
            );
        } else {
            assert!(
                entry.key.is_some(),
                "{name}: a scalar-keyed unknown entry has no name"
            );
        }
    } // End of the loop over the document's unknown entries
} // End of function audit()

/// How one document's keys divide between the two halves of the accounting.
///
/// Returned as `(keys in the tree, keys the projection named)`. The difference
/// is the number of keys accounted for only by lying inside a recorded,
/// undescended span — the population the whole-document check exists for, and a
/// figure worth printing because a zero there would mean the second half of the
/// property was never exercised at all.
fn key_accounting(index: &SyntaxIndex, view: &DocumentView) -> (usize, usize) {
    (
        document_key_nodes(index).len(),
        view.named_key_nodes().len(),
    )
}

// ---------------------------------------------------------------------------
// The corpus sweeps
// ---------------------------------------------------------------------------

#[test]
fn every_synthetic_fixture_projects_with_the_counts_it_has_always_had() {
    let files = synthetic_valid();
    assert!(!files.is_empty(), "the synthetic corpus must be present");
    assert_eq!(
        files.len(),
        SYNTHETIC_PROJECTIONS.len(),
        "every fixture needs a pinned projection row"
    );

    println!("\n--- projection per synthetic fixture ---");
    println!("{:<40} {}", "fixture", HEADINGS);
    let mut total = Counts::default();
    let mut keys_in_tree = 0usize;
    let mut keys_named = 0usize;
    for file in &files {
        let document = project(&file.name, &file.source);
        assert!(
            document.view.parsed,
            "{}: a valid fixture must project as parsed",
            file.name
        );
        audit(&file.name, &document);
        let (tree, named) = key_accounting(index_of(&file.name, &document), &document.view);
        keys_in_tree += tree;
        keys_named += named;
        let counts = Counts::of(&document.view);
        println!("{:<40} {}", file.name, counts.columns());

        let base = file.name.rsplit('/').next().unwrap_or(&file.name);
        let row = SYNTHETIC_PROJECTIONS
            .iter()
            .find(|row| row.0 == base)
            .unwrap_or_else(|| panic!("{} has no pinned projection row", file.name));
        assert_eq!(
            counts,
            Counts::from_row(row.1),
            "{}: projection counts",
            file.name
        );
        total.add(&counts);
    } // End of the loop over the valid synthetic fixtures

    println!("synthetic totals\n{HEADINGS}\n{}", total.columns());
    println!(
        "synthetic keys: {keys_in_tree} in the tree, {keys_named} named, {} inside a recorded span",
        keys_in_tree - keys_named
    );
    // The second half of the accounting must actually be reached: if every key
    // were named, "or lies inside a recorded span" would be an untested clause.
    assert!(
        keys_in_tree > keys_named,
        "no synthetic key is accounted for by a recorded span, so that clause is untested"
    );
    // A projection that produced nothing would satisfy every assertion above.
    assert!(total.matches > 50, "the projection is not reaching matches");
    assert!(
        total.variables > 10,
        "the projection is not reaching variables"
    );
    assert!(
        total.scalars > 500,
        "the projection is not reaching scalars"
    );
} // End of function every_synthetic_fixture_projects_with_the_counts_it_has_always_had()

#[test]
fn every_real_corpus_file_projects_without_losing_a_key_or_inferring_a_type() {
    let files = real_corpus();
    if skip_without_real_corpus("real corpus projection", &files) {
        return;
    }

    println!("\n--- projection per real-corpus file ---");
    println!("{:<40} {}", "file", HEADINGS);
    let mut total = Counts::default();
    let mut parsed = 0usize;
    let mut keys_in_tree = 0usize;
    let mut keys_named = 0usize;
    for file in &files {
        let document = project(&file.name, &file.source);
        if !document.view.parsed {
            println!("{:<40} (not parsed)", file.name);
            continue;
        }
        parsed += 1;
        audit(&file.name, &document);
        let (tree, named) = key_accounting(index_of(&file.name, &document), &document.view);
        keys_in_tree += tree;
        keys_named += named;
        let counts = Counts::of(&document.view);
        println!("{:<40} {}", file.name, counts.columns());
        total.add(&counts);
    } // End of the loop over the real corpus
    println!(
        "real keys: {keys_in_tree} in the tree, {keys_named} named, {} inside a recorded span",
        keys_in_tree - keys_named
    );

    // Computed, never pinned: the real corpus is the owner's private
    // configuration and its shape is not this repository's business.
    println!(
        "real: {parsed} of {} files parsed\n{HEADINGS}\n{}",
        files.len(),
        total.columns()
    );
    assert!(parsed > 0, "no real-corpus file parsed");
    assert!(
        total.matches > 0,
        "the real corpus projected no match at all"
    );
} // End of function every_real_corpus_file_projects_without_losing_a_key_or_inferring_a_type()

// ---------------------------------------------------------------------------
// The oracles must be able to disagree
// ---------------------------------------------------------------------------

#[test]
fn an_inferred_scalar_is_caught_by_the_oracle() {
    // The exact defect D2u forbids: a projection that resolved a plain `on`,
    // `012` or `12:30` to its YAML 1.1 value instead of showing the text. Build
    // one by hand and require the oracle to object — otherwise every "no scalar
    // is type-inferred" pass above is a statement about nothing.
    let source = "matches:\n  - trigger: :flag\n    word: on\n";
    let document = project("inferred.yml", source);
    let index = index_of("inferred.yml", &document);

    let word = document.view.matches[0]
        .options
        .word
        .clone()
        .expect("the fixture sets `word`");
    assert_eq!(word.text, "on", "the projection must show the source text");
    assert!(
        word.ambiguous_yaml_1_1,
        "a plain `on` is 1.1-ambiguous and must be flagged"
    );
    assert!(
        scalar_disagreement(&document.source, index, &word).is_none(),
        "the honest projection must satisfy the oracle"
    );

    let mut inferred = word.clone();
    inferred.text = "true".to_owned();
    assert!(
        scalar_disagreement(&document.source, index, &inferred).is_some(),
        "the oracle failed to notice a type-inferred scalar"
    );

    // The same wrong view with the decode flag cleared. The earlier oracle
    // compared the text **only when `decoded` was true**, so this exact pair —
    // `text: "true"`, `decoded: false`, over a source `on` that decodes fine —
    // slipped through a check whose headline claim covered it.
    let mut inferred_undecoded = word.clone();
    inferred_undecoded.text = "true".to_owned();
    inferred_undecoded.decoded = false;
    assert!(
        scalar_disagreement(&document.source, index, &inferred_undecoded).is_some(),
        "the oracle failed to notice a type-inferred scalar marked as undecoded"
    );

    // …and the flag alone, with honest text: production clears `decoded` only
    // after a real decode failure, so a cleared flag over a decodable scalar is
    // itself a disagreement.
    let mut mislabelled = word.clone();
    mislabelled.decoded = false;
    assert!(
        scalar_disagreement(&document.source, index, &mislabelled).is_some(),
        "the oracle failed to notice a scalar wrongly marked as undecoded"
    );

    // The two other ways a view could drift from its bytes.
    let mut restyled = word.clone();
    restyled.style = ScalarStyle::DoubleQuoted;
    assert!(
        scalar_disagreement(&document.source, index, &restyled).is_some(),
        "the oracle failed to notice a restyled scalar"
    );
    let mut moved = word;
    moved.span.end -= 1;
    assert!(
        scalar_disagreement(&document.source, index, &moved).is_some(),
        "the oracle failed to notice a moved span"
    );
} // End of function an_inferred_scalar_is_caught_by_the_oracle()

#[test]
fn a_dropped_key_is_caught_by_the_coverage_oracle() {
    let source = "matches:\n  - trigger: :a\n    replace: b\n    surprising: c\n";
    let document = project("dropped.yml", source);
    let index = index_of("dropped.yml", &document);

    let record = document
        .view
        .coverage
        .iter()
        .find(|record| record.modelled.len() + record.unknown.len() == 3)
        .expect("the match mapping has three entries")
        .clone();
    assert!(coverage_disagreement(index, &record).is_none());

    // Drop one, as a projection that silently discarded an unrecognised key
    // would, and require the oracle to notice.
    let mut lossy = record.clone();
    lossy.unknown.clear();
    assert!(
        coverage_disagreement(index, &lossy).is_some(),
        "the oracle failed to notice a dropped key"
    );

    // …and the mirror image: an entry both modelled and recorded, which a plain
    // count of the two lists against the entry count would let through.
    let mut doubled = record;
    doubled.unknown.push(doubled.modelled[0]);
    assert!(
        coverage_disagreement(index, &doubled).is_some(),
        "the oracle failed to notice a double-counted key"
    );
} // End of function a_dropped_key_is_caught_by_the_coverage_oracle()

#[test]
fn a_key_nested_under_an_unmodelled_entry_lies_inside_a_recorded_span() {
    // The Phase 1a review's finding 2, as input. `future_option` is recorded as
    // one unknown entry and is **not descended into**, so `nested_key` is named
    // nowhere — and a coverage audit that iterates the records the projection
    // emitted cannot see that, because no record was ever emitted for the nested
    // mapping. The property therefore has to be stated over the document tree.
    let source = concat!(
        "matches:\n",
        "  - trigger: :a\n",
        "    replace: A\n",
        "    future_option:\n",
        "      nested_key: nested_value\n",
    );
    let document = project("nested.yml", source);
    let index = index_of("nested.yml", &document);
    let view = &document.view;

    let unknown = view
        .all_unknown_entries()
        .into_iter()
        .find(|entry| entry.key.as_deref() == Some("future_option"))
        .expect("the unmodelled key is recorded");
    assert_eq!(unknown.value_kind, ValueKind::Mapping);

    // `nested_key` is a key of the document that the projection does not name…
    let nested = document_key_nodes(index)
        .into_iter()
        .find(|node| {
            index
                .node(*node)
                .and_then(|n| n.span.slice(source))
                .is_some_and(|text| text == "nested_key")
        })
        .expect("the nested key exists in the tree");
    assert!(
        !view.named_key_nodes().contains(&nested),
        "the nested key is deliberately not named"
    );
    // …and is nevertheless accounted for, because it lies inside the whole,
    // recorded, undescended value span of the entry above it.
    let nested_span = index.node(nested).expect("the key node").span;
    assert!(
        unknown.value_span.contains(nested_span),
        "the recorded span must cover the key it stands for"
    );
    assert!(unaccounted_keys(index, view).is_empty());
    assert!(view.unaccounted_keys(index).is_empty());

    // The oracle must be able to disagree, on **both** halves of the property.
    //
    // Half one: the record disappears. This is the disabling experiment the
    // review asked for — not "an entry removed from a record that already
    // exists", but the creation of a record suppressed altogether.
    let match_mapping = view.matches[0].source_node;
    let mut without_record = view.clone();
    without_record
        .coverage
        .retain(|record| record.mapping != match_mapping);
    assert!(
        !unaccounted_keys(index, &without_record).is_empty(),
        "the oracle failed to notice a coverage record that was never emitted"
    );

    // Half two: the span disappears — a projection that skipped the entry
    // without recording what it skipped.
    let mut without_span = view.clone();
    without_span.undescended.clear();
    let lost = unaccounted_keys(index, &without_span);
    assert!(
        lost.contains(&nested),
        "the oracle failed to notice a key inside no recorded span"
    );
} // End of function a_key_nested_under_an_unmodelled_entry_lies_inside_a_recorded_span()

#[test]
fn a_non_scalar_item_of_a_scalar_sequence_is_elided_in_place_rather_than_dropped() {
    // The Phase 1a review's finding 5. `scalar_sequence` documents an elided
    // placeholder; it used to emit a diagnostic and drop the item, which shifted
    // every later item one position left — a positional lie in a read model a
    // later phase would address by index.
    let source = concat!(
        "matches:\n",
        "  - trigger: :a\n",
        "    replace: A\n",
        "    search_terms:\n",
        "      - first\n",
        "      - nested: mapping\n",
        "      - third\n",
    );
    let document = project("elided-item.yml", source);
    let view = &document.view;
    let terms = &view.matches[0].search_terms;

    assert_eq!(terms.len(), 3, "one item per source entry, none dropped");
    assert_eq!(terms[0].as_scalar().map(|s| s.text.as_str()), Some("first"));
    assert!(
        matches!(
            terms[1],
            ValueView::Elided {
                kind: ValueKind::Mapping,
                ..
            }
        ),
        "the malformed item is elided rather than removed"
    );
    // The point of the whole fix: the item after it kept its index.
    assert_eq!(terms[2].as_scalar().map(|s| s.text.as_str()), Some("third"));

    // It is reported, and its bytes are still named.
    assert!(view.diagnostics.iter().any(|diagnostic| matches!(
        &diagnostic.code,
        DiagnosticCode::FieldHasUnexpectedShape { key, .. } if key == "search_terms"
    )));
    assert!(
        !terms[1].span().is_empty(),
        "an elided item still carries its bytes"
    );
    // …and the mapping hidden inside it is accounted for by that span, which is
    // the same property the nested-key test states.
    let index = index_of("elided-item.yml", &document);
    assert!(unaccounted_keys(index, view).is_empty());

    // The other side of the condition: an all-scalar sequence is untouched by
    // any of this (`PROGRESS.md` R20 — a fixture on each side, never one
    // inside).
    let healthy = project(
        "healthy-items.yml",
        "matches:\n  - trigger: :a\n    replace: A\n    search_terms:\n      - one\n      - two\n",
    );
    let healthy_terms = &healthy.view.matches[0].search_terms;
    assert_eq!(healthy_terms.len(), 2);
    assert!(healthy_terms.iter().all(|item| item.as_scalar().is_some()));
    assert!(healthy.view.diagnostics.iter().all(|diagnostic| !matches!(
        diagnostic.code,
        DiagnosticCode::FieldHasUnexpectedShape { .. }
    )));
} // End of function a_non_scalar_item_of_a_scalar_sequence_is_elided_in_place_rather_than_dropped()

// ---------------------------------------------------------------------------
// Never panic on any input
// ---------------------------------------------------------------------------

#[test]
fn the_four_invalid_fixtures_yield_diagnostics_rather_than_panics_or_silence() {
    let files = synthetic_invalid();
    assert_eq!(files.len(), 4, "the invalid corpus holds four fixtures");

    for file in &files {
        let document = project(&file.name, &file.source);
        // Whether the substrate rejects a given malformation is its business,
        // not this crate's. What must hold either way is that the projection
        // exists, says something, and still carries the bytes.
        assert_eq!(
            document.source, file.source,
            "{}: the raw text must survive",
            file.name
        );
        assert!(
            !document.view.diagnostics.is_empty() || document.view.parsed,
            "{}: a rejected document must carry a diagnostic",
            file.name
        );
        if !document.view.parsed {
            assert!(
                matches!(document.parse, ParseOutcome::Failed(_)),
                "{}: an unparsed view must carry a failed parse",
                file.name
            );
            let coded = document.view.diagnostics.iter().any(|diagnostic| {
                matches!(
                    diagnostic.code,
                    DiagnosticCode::ParseFailed { .. } | DiagnosticCode::IndexRejected
                )
            });
            assert!(coded, "{}: no typed parse diagnostic", file.name);
            assert!(
                document.view.matches.is_empty(),
                "{}: an unparsed document must project no match",
                file.name
            );
        }
        println!(
            "{:<40} parsed={} diagnostics={}",
            file.name,
            document.view.parsed,
            document.view.diagnostics.len()
        );
    } // End of the loop over the invalid fixtures
} // End of function the_four_invalid_fixtures_yield_diagnostics_rather_than_panics_or_silence()

#[test]
fn truncating_every_fixture_never_panics_the_projection() {
    let files = synthetic_valid();
    let mut projected = 0usize;
    let mut parsed = 0usize;
    for file in &files {
        let mut end = 0usize;
        while end <= file.source.len() {
            if file.source.is_char_boundary(end) {
                let document = project(&file.name, &file.source[..end]);
                projected += 1;
                if document.view.parsed {
                    parsed += 1;
                }
            }
            end += PREFIX_STRIDE;
        } // End of the loop over one fixture's prefixes
    } // End of the loop over the valid fixtures
    println!("projected {projected} prefixes, {parsed} of them parsed");
    assert!(projected > 2_000, "the prefix sweep barely ran");
    assert!(parsed > 0, "no prefix parsed, so nothing was projected");
} // End of function truncating_every_fixture_never_panics_the_projection()

#[test]
fn a_document_that_is_not_espanso_shaped_projects_rather_than_failing() {
    // Three shapes a browser will meet and must not choke on: an empty file, a
    // file whose root is a sequence, and one whose root is a bare scalar.
    for (name, source) in [
        ("empty.yml", ""),
        ("sequence-root.yml", "- one\n- two\n"),
        ("scalar-root.yml", "just a string\n"),
        ("comments-only.yml", "# nothing but a comment\n"),
    ] {
        let document = project(name, source);
        assert!(document.view.matches.is_empty(), "{name}: unexpected match");
        assert!(
            !document.view.diagnostics.is_empty(),
            "{name}: an unshaped document must say so"
        );
        assert_eq!(document.source, source, "{name}: the raw text must survive");
    } // End of the loop over the unshaped documents
} // End of function a_document_that_is_not_espanso_shaped_projects_rather_than_failing()

#[test]
fn a_value_nested_past_the_depth_limit_is_elided_rather_than_overflowing() {
    // Both sides of the condition, built from one generator so the depth is the
    // only difference (`PROGRESS.md` R20's rule applied where a corpus fixture
    // cannot express the parameter: two fixtures would pin two fixed depths,
    // and the thing under test is the boundary between them).
    //
    // The nesting goes under a key of a **profile-shaped** document, because
    // that is where a deep descent is actually reachable: a match's unmodelled
    // key is recorded by span and never descended into, so nesting it there
    // would test nothing.
    let nest = |depth: usize| {
        let mut source = String::from("deep:\n");
        for level in 0..depth {
            source.push_str(&" ".repeat(2 + level * 2));
            source.push_str("- ");
            if level + 1 == depth {
                source.push_str("leaf\n");
            } else {
                source.push('\n');
            }
        }
        source
    };
    let too_deep_count = |document: &SourceDocument| {
        document
            .view
            .diagnostics
            .iter()
            .filter(|diagnostic| matches!(diagnostic.code, DiagnosticCode::ValueTooDeep { .. }))
            .count()
    };

    let shallow = project("shallow.yml", &nest(MAX_VALUE_DEPTH / 2));
    assert!(shallow.view.parsed, "the shallow document must parse");
    assert_eq!(
        too_deep_count(&shallow),
        0,
        "a document within the limit must not be elided"
    );
    assert!(
        !shallow.view.scalars().is_empty(),
        "the shallow document must reach its leaf"
    );

    let deep = project("deep.yml", &nest(MAX_VALUE_DEPTH + 4));
    assert!(deep.view.parsed, "the deep document must still parse");
    assert!(
        too_deep_count(&deep) > 0,
        "a document past the limit must be elided rather than recursed into"
    );
} // End of function a_value_nested_past_the_depth_limit_is_elided_rather_than_overflowing()

// ---------------------------------------------------------------------------
// What the projection says about specific corpus shapes
// ---------------------------------------------------------------------------

/// The primary trigger text of the match at `position`.
fn trigger_text(document: &SourceDocument, position: usize) -> &str {
    document.view.matches[position]
        .trigger
        .primary()
        .map(|scalar| scalar.text.as_str())
        .unwrap_or_default()
}

/// Loads one synthetic fixture by base name.
fn fixture(name: &str) -> SourceDocument {
    let file = synthetic_valid()
        .into_iter()
        .find(|file| file.name.ends_with(name))
        .unwrap_or_else(|| panic!("no fixture named {name}"));
    project(&file.name, &file.source)
}

#[test]
fn a_match_identity_is_the_document_the_revision_and_a_node_and_is_unique() {
    // This test does exactly what its name says and no more. Its previous name
    // claimed the identity "survives a reordering"; it never reordered anything
    // and never reparsed, so it was an oracle that could not disagree with the
    // property it advertised. That property now has its own test below, and its
    // answer is a **refusal**, not survival.
    let document = fixture("move-a-match.yml");
    let view = &document.view;
    assert!(view.matches.len() >= 2, "the fixture holds several matches");

    // Two matches never share an identity, and an identity is not the position.
    let mut identities: Vec<_> = view.matches.iter().map(|entry| entry.id).collect();
    let before = identities.len();
    identities.sort_unstable();
    identities.dedup();
    assert_eq!(identities.len(), before, "two matches share an identity");

    for (position, entry) in view.matches.iter().enumerate() {
        assert_eq!(entry.id.node, entry.source_node);
        assert_eq!(entry.id.document, view.id);
        assert_eq!(
            entry.id.revision, view.revision,
            "an identity is scoped to the parse it came from"
        );
        // The position lives in the path, which is exactly what makes the
        // identity independent of it.
        let path = entry.path.as_ref().expect("a match has a path");
        assert_eq!(
            path.segments()
                .last()
                .and_then(|segment| segment.as_index()),
            Some(position)
        );
        assert!(view.match_by_id(entry.id).is_ok());
    } // End of the loop over the fixture's matches

    // The two refusals that do not need a reparse.
    let mut elsewhere = view.matches[0].id;
    elsewhere.document = DocumentId(elsewhere.document.get() + 1);
    assert!(matches!(
        view.match_by_id(elsewhere),
        Err(IdentityError::WrongDocument { .. })
    ));
    // A node of this very parse that is not a match mapping — the trigger
    // scalar inside one — is the third refusal, and shows it is the *match*
    // lookup that fails rather than the arena.
    let mut nowhere = view.matches[0].id;
    nowhere.node = view.matches[0]
        .trigger
        .primary()
        .expect("the fixture's first match has a trigger")
        .node;
    assert!(matches!(
        view.match_by_id(nowhere),
        Err(IdentityError::NoSuchMatch { .. })
    ));
} // End of function a_match_identity_is_the_document_the_revision_and_a_node_and_is_unique()

#[test]
fn an_identity_from_before_a_reordering_is_refused_rather_than_resolved() {
    // The Phase 1a review's finding 1, as input: two equally shaped matches,
    // exchanged and reparsed. The parser emits the new first mapping at the old
    // first mapping's arena position, so a document-plus-node identity would
    // hand `:a`'s former identity to `:b` — identity following position, which
    // plan section 6.2 forbids.
    let before = "matches:\n  - trigger: :a\n    replace: A\n  - trigger: :b\n    replace: B\n";
    let after = "matches:\n  - trigger: :b\n    replace: B\n  - trigger: :a\n    replace: A\n";

    let first = project("reordered.yml", before);
    let a = first.view.matches[0].id;
    assert_eq!(trigger_text(&first, 0), ":a");

    let second = project("reordered.yml", after);
    assert_eq!(trigger_text(&second, 0), ":b");

    // The collision is real and is demonstrated rather than asserted away: the
    // node `:a` used to occupy is now `:b`'s.
    assert_eq!(
        second.view.matches[0].source_node, a.node,
        "the arena position really is reused, which is why this needs refusing"
    );

    // And it is refused. Not resolved to the same match — it *cannot* be, the
    // bytes moved — and above all not resolved to the other one.
    match second.view.match_by_id(a) {
        Err(IdentityError::StaleRevision { expected, found }) => {
            assert_eq!(expected, second.view.revision);
            assert_eq!(found, first.view.revision);
        }
        other => panic!("a stale identity must be refused, got {other:?}"),
    }

    // The mirror image: reprojecting the *same* bytes mints the same identity,
    // so the refusal is about the revision changing and not about reparsing.
    let again = project("reordered.yml", before);
    assert_eq!(again.view.matches[0].id, a);
    assert!(again.view.match_by_id(a).is_ok());
} // End of function an_identity_from_before_a_reordering_is_refused_rather_than_resolved()

#[test]
fn the_nine_variable_types_and_their_open_params_survive_the_projection() {
    let document = fixture("variable-chain.yml");
    let kinds: Vec<VariableKind> = document
        .view
        .matches
        .iter()
        .flat_map(|entry| entry.vars.iter())
        .map(|variable| variable.kind)
        .collect();
    for expected in [
        VariableKind::Form,
        VariableKind::Echo,
        VariableKind::Date,
        VariableKind::Shell,
        VariableKind::Script,
    ] {
        assert!(
            kinds.contains(&expected),
            "no variable of type {expected:?}"
        );
    }

    // `params` is projected shallowly, so a parameter this crate has never
    // heard of is still carried. Every one of them is here, unmodelled by name
    // and unlost.
    let shell = document
        .view
        .matches
        .iter()
        .flat_map(|entry| entry.vars.iter())
        .find(|variable| variable.kind == VariableKind::Shell)
        .expect("the fixture holds a shell variable");
    let keys: Vec<&str> = shell
        .params
        .iter()
        .filter_map(|field| field.key.as_ref())
        .map(|key| key.text.as_str())
        .collect();
    assert!(keys.contains(&"cmd") && keys.contains(&"shell") && keys.contains(&"trim"));
    assert!(
        shell.declared_type.is_some(),
        "the declared type stays as source text"
    );
    assert!(
        !shell.depends_on.is_empty(),
        "`depends_on` is projected per entry"
    );
} // End of function the_nine_variable_types_and_their_open_params_survive_the_projection()

#[test]
fn a_config_profile_is_projected_shallowly_and_completely() {
    let document = fixture("config-profile.yml");
    let view = &document.view;
    assert_eq!(view.shape, DocumentShape::ConfigProfile);
    let profile = view.profile.as_ref().expect("a profile view");

    // Every top-level key of the file is an entry of the profile, and none of
    // them is unknown: a shallow projection cannot lose a key it never claimed
    // to understand.
    assert_eq!(profile.entries.len(), view.top_level_keys.len());
    assert!(
        view.unknown_entries.is_empty(),
        "a shallow profile projection has nothing unknown"
    );
    assert!(
        !profile.filters().is_empty(),
        "the fixture sets filter keys"
    );
    assert!(
        !profile.scoping().is_empty(),
        "the fixture sets scoping keys"
    );

    // Duration values stay text. A projection that read `key_delay: 8` as an
    // integer would be exactly the D2u violation.
    let delay = profile
        .scalar("key_delay")
        .expect("the fixture sets key_delay");
    assert_eq!(delay.text, "8");
    assert_eq!(delay.style, ScalarStyle::Plain);

    // …and the fixture's location, in this corpus, is a match directory, so the
    // disagreement between shape and location is reported rather than guessed
    // away.
    assert!(view.diagnostics.iter().any(|diagnostic| matches!(
        diagnostic.code,
        DiagnosticCode::ShapeDisagreesWithLocation { .. }
    )));
} // End of function a_config_profile_is_projected_shallowly_and_completely()

#[test]
fn the_three_top_level_match_file_keys_are_modelled_and_the_rest_are_recorded() {
    let document = fixture("imports-and-global-vars.yml");
    let view = &document.view;
    assert_eq!(view.shape, DocumentShape::MatchFile);
    assert_eq!(view.imports.len(), 3);
    assert_eq!(view.global_vars.len(), 3);
    assert!(!view.matches.is_empty());
    assert!(view.unknown_entries.is_empty());

    // Key order at the top level is meaningful to the reader and is preserved.
    let keys: Vec<&str> = view
        .top_level_keys
        .iter()
        .map(|key| key.text.as_str())
        .collect();
    assert_eq!(keys, vec!["imports", "global_vars", "matches"]);
} // End of function the_three_top_level_match_file_keys_are_modelled_and_the_rest_are_recorded()

#[test]
fn badges_come_from_key_presence_and_type_text_never_from_a_scalar_value() {
    let forms = fixture("form-layout-and-choice.yml");
    let badged: Vec<&MatchBadge> = forms
        .view
        .matches
        .iter()
        .flat_map(|entry| entry.badges.iter())
        .collect();
    assert!(badged.contains(&&MatchBadge::Form));
    assert!(badged.contains(&&MatchBadge::Variables));

    let chain = fixture("variable-chain.yml");
    let chained: Vec<&MatchBadge> = chain
        .view
        .matches
        .iter()
        .flat_map(|entry| entry.badges.iter())
        .collect();
    assert!(chained.contains(&&MatchBadge::Shell));
    assert!(chained.contains(&&MatchBadge::Script));

    let rich = fixture("html-and-markdown.yml");
    let riches: Vec<&MatchBadge> = rich
        .view
        .matches
        .iter()
        .flat_map(|entry| entry.badges.iter())
        .collect();
    assert!(riches.contains(&&MatchBadge::Html));
    assert!(riches.contains(&&MatchBadge::Markdown));

    // The badge that does *not* exist, and must not: nothing here can be
    // derived from a boolean field's value (D2u). `word: true` earns a match no
    // badge at all.
    let boundaries = fixture("imports-and-global-vars.yml");
    let worded = boundaries
        .view
        .matches
        .iter()
        .find(|entry| entry.options.word.is_some())
        .expect("the fixture sets `word`");
    assert_eq!(
        worded.options.word.as_ref().map(|s| s.text.as_str()),
        Some("true")
    );
    assert!(
        !worded.badges.contains(&MatchBadge::NotEditable),
        "this match is editable"
    );
} // End of function badges_come_from_key_presence_and_type_text_never_from_a_scalar_value()

#[test]
fn a_hazardous_file_still_projects_and_says_which_matches_it_refuses() {
    for name in [
        "anchors-aliases-tags-merge.yml",
        "duplicate-keys.yml",
        "multi-document.yml",
        "flow-collections.yml",
        "explicit-key-mappings.yml",
    ] {
        let document = fixture(name);
        let view = &document.view;
        assert!(view.parsed, "{name}: must still parse");
        assert!(!view.hazards.is_empty(), "{name}: must report its hazards");
        // Every hazard is also a diagnostic, so one list answers "what should
        // the UI show about this file".
        let hazard_diagnostics = view
            .diagnostics
            .iter()
            .filter(|diagnostic| matches!(diagnostic.code, DiagnosticCode::Hazard { .. }))
            .count();
        assert!(hazard_diagnostics > 0, "{name}: hazards are not reported");
        println!(
            "{name:<40} hazards={:?} matches={} refused={}",
            view.hazards,
            view.matches.len(),
            view.matches
                .iter()
                .filter(|entry| !entry.safely_editable)
                .count()
        );
    } // End of the loop over the hazard-bearing fixtures

    // The gate is scoped, not total (`PROGRESS.md` R12), and the projection
    // reports that scope per match rather than per file. Three fixtures show
    // it: each holds a match the gate refuses *and* a match it does not.
    //
    // `anchors-aliases-tags-merge.yml` is deliberately not one of them. R12's
    // measurement is about *scalars* — `matches[2].trigger` stays editable
    // beside a flagged `replace` — and a match **mapping** contains that
    // flagged descendant, so every one of its six matches is refused. Asserting
    // the scope at match granularity there would be asserting something false.
    for name in [
        "duplicate-keys.yml",
        "flow-collections.yml",
        "explicit-key-mappings.yml",
    ] {
        let document = fixture(name);
        let refused = document
            .view
            .matches
            .iter()
            .filter(|entry| !entry.safely_editable)
            .count();
        assert!(refused > 0, "{name}: no match is refused");
        assert!(
            refused < document.view.matches.len(),
            "{name}: a hazard on one match must not refuse every match of the file"
        );
    } // End of the loop over the fixtures whose refusal is scoped

    // …and a refused match names the reason rather than merely saying no.
    let document = fixture("duplicate-keys.yml");
    let blocked = document
        .view
        .matches
        .iter()
        .find(|entry| !entry.safely_editable)
        .expect("some match is refused");
    assert!(
        blocked.blocking_hazard.is_some(),
        "a refused match must name its hazard"
    );
    assert!(blocked.badges.contains(&MatchBadge::NotEditable));
    // The mirror image, which is what makes the badge worth showing: an
    // editable match does not carry it.
    let editable = document
        .view
        .matches
        .iter()
        .find(|entry| entry.safely_editable)
        .expect("some match is editable");
    assert!(editable.blocking_hazard.is_none());
    assert!(!editable.badges.contains(&MatchBadge::NotEditable));
} // End of function a_hazardous_file_still_projects_and_says_which_matches_it_refuses()

#[test]
fn a_multi_document_stream_projects_the_first_and_names_the_rest() {
    let document = fixture("multi-document.yml");
    let view = &document.view;
    assert!(view.stream_documents > 1);

    let named = view
        .diagnostics
        .iter()
        .filter(|diagnostic| {
            matches!(
                diagnostic.code,
                DiagnosticCode::AdditionalDocumentNotProjected { .. }
            )
        })
        .count();
    assert_eq!(
        named,
        view.stream_documents - 1,
        "every document espanso ignores must be named, with its bytes"
    );
    // Named *with its bytes*: a diagnostic with no span would not let the UI
    // show the user what is being left out.
    assert!(view
        .diagnostics
        .iter()
        .filter(|diagnostic| matches!(
            diagnostic.code,
            DiagnosticCode::AdditionalDocumentNotProjected { .. }
        ))
        .all(|diagnostic| diagnostic.span.is_some_and(|span| !span.is_empty())));
} // End of function a_multi_document_stream_projects_the_first_and_names_the_rest()

#[test]
fn search_text_covers_the_five_fields_plan_section_eight_names() {
    let source = concat!(
        "matches:\n",
        "  - trigger: :sig\n",
        "    label: Signature\n",
        "    replace: Best regards\n",
        "    comment: only for email\n",
        "    search_terms:\n",
        "      - firma\n",
        "      - signature\n",
    );
    let document = project("search.yml", source);
    let entry = &document.view.matches[0];
    for expected in [
        ":sig",
        "Signature",
        "Best regards",
        "only for email",
        "firma",
        "signature",
    ] {
        assert!(
            entry.search_text.contains(expected),
            "search text omits {expected:?}"
        );
    }
} // End of function search_text_covers_the_five_fields_plan_section_eight_names()

#[test]
fn the_read_model_serializes() {
    // A `derive` that compiles is not proof that the shape crosses a boundary:
    // `serde` is here for Phase 1b's Tauri commands, so the model has to reach
    // JSON with its revision as an opaque string and its identities intact.
    let document = fixture("imports-and-global-vars.yml");
    let json = serde_json::to_value(&document.view).expect("the view serializes");
    assert_eq!(json["parsed"], serde_json::json!(true));
    assert!(json["revision"].is_string(), "the revision is a hex string");
    assert_eq!(
        json["revision"].as_str().map(str::len),
        Some(64),
        "a revision is 64 hex characters"
    );
    assert!(json["matches"].is_array());
    assert!(json["matches"][0]["id"]["node"].is_number());
    // Every scalar reaches the boundary as a string, which is D2u seen from the
    // one place a type could still sneak in.
    assert!(json["matches"][0]["trigger"]["trigger"]["text"].is_string());
} // End of function the_read_model_serializes()
