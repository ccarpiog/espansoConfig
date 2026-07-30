//! Phase 0c-2a acceptance: the structural path resolver.
//!
//! The headline assertion is the **inverse-pair oracle**: for every node of
//! every corpus file, either `path_to` refuses for a reason this test
//! independently re-derives from the tree, or `resolve(path_to(n)) == n`. Step
//! 0c-2b's verify cycle re-finds an edited node in a freshly parsed index by
//! path, so if that pair is not exact the verification is worthless.
//!
//! The oracle deliberately re-derives each refusal reason itself rather than
//! taking the resolver's word for it. A resolver that refused *everything* would
//! satisfy "no round-trip ever failed" while being useless; a resolver that
//! refused for the wrong reason would satisfy a variant-name check while being
//! wrong about the document. Both are caught here.
//!
//! # Privacy
//!
//! The real corpus is the owner's private configuration (`CLAUDE.md` section 1).
//! This file prints file names, node counts and path *shapes* derived from
//! synthetic fixtures only; it never prints a real path, a real key or any real
//! content, and it hard-codes no count taken from private data.

mod common;

use common::{real_corpus, skip_without_real_corpus, synthetic_valid, CorpusFile};
use espansoconfig_core::patch::{
    path_to, resolve, AddressError, DocumentPath, PathError, PathSegment,
};
use espansoconfig_core::syntax::{NodeKind, NodeRole, TriviaIndex};
use espansoconfig_core::SyntaxIndex;

/// What the oracle concluded about one node.
#[derive(Debug, Default, PartialEq, Eq)]
struct Tally {
    /// Nodes whose path resolved back to them.
    addressable: usize,
    /// Document nodes, which are named by a path's document index instead.
    documents: usize,
    /// Mapping keys, and nodes inside one.
    mapping_keys: usize,
    /// Nodes under a key their mapping holds more than once.
    ambiguous: usize,
    /// Nodes under a key that is not a scalar.
    non_scalar_keys: usize,
}

impl Tally {
    /// Every node the oracle looked at.
    fn total(&self) -> usize {
        self.addressable
            + self.documents
            + self.mapping_keys
            + self.ambiguous
            + self.non_scalar_keys
    }

    /// Folds another file's tally into this one.
    fn add(&mut self, other: &Tally) {
        self.addressable += other.addressable;
        self.documents += other.documents;
        self.mapping_keys += other.mapping_keys;
        self.ambiguous += other.ambiguous;
        self.non_scalar_keys += other.non_scalar_keys;
    }
}

/// Runs the inverse-pair oracle over one document.
///
/// For every node: `path_to` either succeeds — in which case the path must
/// resolve back to exactly that node, and its textual form must re-parse to the
/// same path — or refuses, in which case this function re-derives the reason
/// from the tree and requires the resolver to have said the same thing.
fn audit(name: &str, index: &SyntaxIndex) -> Tally {
    let mut tally = Tally::default();

    for node in index.nodes() {
        match path_to(index, node.id) {
            Ok(path) => {
                assert_eq!(
                    resolve(index, &path),
                    Ok(node.id),
                    "{name}: node {} has a path that does not resolve back to it",
                    node.id.get()
                );
                let text = path.to_string();
                assert_eq!(
                    DocumentPath::parse(&text).as_ref(),
                    Ok(&path),
                    "{name}: path text {text:?} does not re-parse to itself"
                );
                assert_eq!(
                    path.document_index(),
                    node.document_index,
                    "{name}: node {} was addressed in the wrong document",
                    node.id.get()
                );
                tally.addressable += 1;
            }
            Err(AddressError::IsDocument { .. }) => {
                assert_eq!(
                    node.kind,
                    NodeKind::Document,
                    "{name}: node {} refused as a document but is not one",
                    node.id.get()
                );
                tally.documents += 1;
            }
            Err(AddressError::IsMappingKey { .. }) => {
                assert!(
                    has_ancestor_with_role(index, node.id, NodeRole::MappingKey),
                    "{name}: node {} refused as a mapping key with no key above it",
                    node.id.get()
                );
                tally.mapping_keys += 1;
            }
            Err(AddressError::AmbiguousKey {
                key, occurrences, ..
            }) => {
                assert!(
                    occurrences > 1,
                    "{name}: ambiguity claimed with {occurrences} occurrences"
                );
                assert!(
                    duplicated_key_above(index, node.id, &key) == Some(occurrences),
                    "{name}: node {} refused for a duplicate {key:?} the tree does not have",
                    node.id.get()
                );
                tally.ambiguous += 1;
            }
            Err(AddressError::NonScalarKey { key, .. }) => {
                assert_ne!(
                    index.node(key).map(|node| node.kind),
                    Some(NodeKind::Scalar),
                    "{name}: node {} refused for a non-scalar key that is a scalar",
                    node.id.get()
                );
                tally.non_scalar_keys += 1;
            }
            Err(other) => panic!("{name}: node {} refused with {other:?}", node.id.get()),
        }
    } // End of the loop over every node of the document

    assert_eq!(
        tally.total(),
        index.nodes().len(),
        "{name}: the oracle did not account for every node"
    );
    tally
} // End of function audit()

/// Returns `true` when `node` or one of its ancestors has `role`.
fn has_ancestor_with_role(
    index: &SyntaxIndex,
    node: espansoconfig_core::NodeId,
    role: NodeRole,
) -> bool {
    let mut current = index.node(node);
    while let Some(here) = current {
        if here.role == role {
            return true;
        }
        current = here.parent.and_then(|parent| index.node(parent));
    }
    false
}

/// Re-derives the duplicate-key refusal: walks up from `node` looking for a
/// mapping value whose key is `key` and occurs more than once in that mapping.
///
/// Returns the number of occurrences found, so the caller can check the count
/// the resolver reported rather than only the fact of duplication.
fn duplicated_key_above(
    index: &SyntaxIndex,
    node: espansoconfig_core::NodeId,
    key: &str,
) -> Option<usize> {
    let mut current = index.node(node)?;
    loop {
        if current.role == NodeRole::MappingValue {
            let parent = index.node(current.parent?)?;
            let occurrences = parent
                .children
                .chunks(2)
                .filter(|pair| {
                    pair.len() == 2
                        && index
                            .node(pair[0])
                            .and_then(|key_node| key_node.scalar.as_ref())
                            .map(|scalar| scalar.value.as_str())
                            == Some(key)
                })
                .count();
            if occurrences > 1 {
                return Some(occurrences);
            }
        }
        current = index.node(current.parent?)?;
    } // End of the loop that climbs looking for a duplicated key
} // End of function duplicated_key_above()

/// Parses a corpus file, failing loudly with its name if it does not parse.
fn index_of(file: &CorpusFile) -> SyntaxIndex {
    SyntaxIndex::parse(&file.source).unwrap_or_else(|error| {
        panic!("{}: expected a valid fixture, got {error}", file.name);
    })
}

/// The decoded scalar value a path names in `source`.
fn value_at(source: &str, path: &str) -> String {
    let index = SyntaxIndex::parse(source).expect("fixture must parse");
    let path = DocumentPath::parse(path).expect("path must parse");
    let id = resolve(&index, &path).expect("path must resolve");
    index
        .node(id)
        .and_then(|node| node.scalar.as_ref())
        .map(|scalar| scalar.value.clone())
        .expect("path must name a scalar")
}

#[test]
fn every_addressable_node_of_the_synthetic_corpus_round_trips_through_its_path() {
    let files = synthetic_valid();
    assert!(!files.is_empty(), "the synthetic corpus must be present");

    let mut total = Tally::default();
    for file in &files {
        let index = index_of(file);
        total.add(&audit(&file.name, &index));
    }

    println!(
        "synthetic: {} nodes, {} addressable, {} documents, {} mapping keys, \
         {} ambiguous, {} non-scalar keys",
        total.total(),
        total.addressable,
        total.documents,
        total.mapping_keys,
        total.ambiguous,
        total.non_scalar_keys
    );

    // Pinned exactly, so a change in the resolver's reach shows up as a failing
    // number rather than as silently narrower addressing. The two opposing
    // drifts a single total could hide are separated into their own figures.
    // Phase 0c-2b's fix round added `block-scalar-header-tails.yml`, which moved
    // every figure below by exactly the fixture's own shape: 19 nodes = 1
    // document + 1 root mapping + the `matches` key + the sequence + 3 item
    // mappings + 12 scalars. So +1 document, +7 mapping keys (`matches` and each
    // item's `trigger` and `replace`), +11 addressable (the root mapping, the
    // sequence, the 3 item mappings and the 6 values), and no new ambiguity.
    //
    // Phase 0c-3a added `empty-entries-and-extents.yml` the same way: 40 nodes =
    // 1 document + 1 root mapping + the `matches` sequence + 4 item mappings +
    // the nested `vars` sequence + its item mapping + 31 scalars. So +1
    // document, +16 mapping keys (`matches`, `trailing`, each item's `trigger`,
    // `replace` and `label`, `vars`, and the nested `name` and `type`), and +23
    // addressable — its 8 collections, its 10 values with a token, and its **5
    // zero-width values**, which are addressable although they own no bytes
    // (R7): four empty entries and one bare sequence item.
    //
    // The Phase 0c-3a **review's fix round** added two more, and every figure
    // below moves by exactly their own shapes.
    // `file-comments-and-mixed-endings.yml`: 27 nodes = 1 document + 6
    // collections (the root mapping, the `matches` sequence, 3 item mappings and
    // the nested `vars` mapping) + 20 scalars, of which 11 are keys and 9 are
    // values. So +1 document, +11 mapping keys, +15 addressable (6 collections +
    // 9 values). `single-line-no-line-ending.yml`: 4 nodes = 1 document + the
    // root mapping + its one key and one value, so +1 document, +1 mapping key,
    // +2 addressable.
    //
    // Phase 0c-3b-1 added `run-based-removal-envelope.yml`, again by exactly its
    // own shape: 26 nodes = 1 document + 6 collections (the root mapping, the
    // `matches` sequence, 2 item mappings and their 2 nested `vars` mappings) + 19
    // scalars, of which 11 are keys (`matches`, each item's `trigger`, `replace`
    // and `vars`, and the four keys inside the two `vars` mappings) and 8 are
    // values. So +1 document, +11 mapping keys, +14 addressable (6 collections + 8
    // values), and no new ambiguity.
    //
    // That phase's **review** added `run-based-removal-boundaries.yml`, whose node
    // shape is the same again — 26 nodes = 1 document + 6 collections + 19 scalars,
    // 11 keys and 8 values — so it moves every figure by the same deltas: +1
    // document, +11 mapping keys, +14 addressable, no new ambiguity. What differs
    // is its trivia, not its tree, which is why `trivia_scanner.rs` separates the
    // two fixtures and this file does not.
    //
    // Phase 0c-3b-2a added the two move fixtures, and again each moves every
    // figure by exactly its own shape. `move-a-match.yml`: 25 nodes = 1 document
    // + 5 collections (the root mapping, the `matches` sequence, 3 item mappings
    // — one of which carries a nested `vars` mapping, so 6 in all) + scalars, and
    // `move-block-scalar-seams.yml`: 38 nodes over 6 matches, two of which carry
    // a one-entry `vars` mapping. Their exact splits are in
    // `docs/decisions/0c-3b-2a-notes.md` section 6.
    //
    // That phase's **review** added two more, and again each moves every figure by
    // exactly its own shape. `move-run-joins.yml`: 31 nodes = 1 document + 7
    // collections (the root mapping, the `matches` sequence, 3 item mappings and 2
    // nested `vars` mappings) + 23 scalars, 13 keys and 10 values, so +1 document,
    // +13 mapping keys and +17 addressable. `move-kept-comment-joins-a-block.yml`:
    // 28 nodes = 1 document + 6 collections (the root mapping, the `matches`
    // sequence and 4 item mappings) + 21 scalars, 11 keys and 10 values, so +1
    // document, +11 mapping keys and +16 addressable. Neither adds an ambiguity.
    assert_eq!(total.total(), 1355);
    assert_eq!(total.addressable, 780);
    // 31 single-document fixtures plus multi-document.yml's three.
    assert_eq!(total.documents, 34);
    assert_eq!(total.mapping_keys, 537);
    // Exactly the four values under a duplicated key in duplicate-keys.yml:
    // `replace` twice in `matches[0]` and `label` twice in `matches[2]`.
    assert_eq!(total.ambiguous, 4);
    assert_eq!(total.non_scalar_keys, 0);
} // End of function every_addressable_node_of_the_synthetic_corpus_round_trips_through_its_path()

#[test]
fn every_addressable_node_of_the_real_corpus_round_trips_through_its_path() {
    let files = real_corpus();
    if skip_without_real_corpus("real corpus path round trip", &files) {
        return;
    }

    let mut total = Tally::default();
    for file in &files {
        let index = index_of(file);
        total.add(&audit(&file.name, &index));
    }

    // No count from private data is hard-coded (`PROGRESS.md`, D1). What is
    // asserted is the shape of the result: real files are addressable, and
    // nothing in them defeats the resolver.
    println!(
        "real: {} files, {} nodes, {} addressable",
        files.len(),
        total.total(),
        total.addressable
    );
    assert!(total.addressable > 0);
    assert_eq!(total.non_scalar_keys, 0);
}

#[test]
fn a_duplicate_key_is_refused_rather_than_silently_resolved() {
    let file = synthetic_valid()
        .into_iter()
        .find(|file| file.name.ends_with("duplicate-keys.yml"))
        .expect("duplicate-keys.yml must be in the corpus");
    let index = index_of(&file);

    // `matches[0]` holds `replace` twice: the path names two nodes, so there is
    // no answer to give.
    let path = DocumentPath::parse("matches[0].replace").unwrap();
    assert!(
        matches!(
            resolve(&index, &path),
            Err(PathError::DuplicateKey { occurrences: 2, .. })
        ),
        "a duplicated key must refuse, not pick one"
    );

    // Its unduplicated sibling in the same mapping still resolves.
    let trigger = DocumentPath::parse("matches[0].trigger").unwrap();
    assert!(resolve(&index, &trigger).is_ok());

    // And `vars` holds two entries whose own `name` keys are not duplicated
    // *within* their own mapping, so those stay addressable.
    assert_eq!(
        value_at(&file.source, "matches[1].vars[1].params.echo"),
        "beta"
    );
}

#[test]
fn a_multi_document_stream_addresses_each_document_separately() {
    let file = synthetic_valid()
        .into_iter()
        .find(|file| file.name.ends_with("multi-document.yml"))
        .expect("multi-document.yml must be in the corpus");
    let index = index_of(&file);
    assert_eq!(index.documents().len(), 3);

    assert_eq!(value_at(&file.source, "matches[0].trigger"), ":doc-one");
    assert_eq!(value_at(&file.source, "#1.matches[0].trigger"), ":doc-two");
    assert_eq!(
        value_at(&file.source, "#2.matches[0].trigger"),
        ":doc-three"
    );

    assert!(matches!(
        resolve(&index, &DocumentPath::parse("#3.matches").unwrap()),
        Err(PathError::NoSuchDocument {
            document_index: 3,
            documents: 3
        })
    ));
}

#[test]
fn flow_collections_are_addressable_and_nest_like_block_ones() {
    let file = synthetic_valid()
        .into_iter()
        .find(|file| file.name.ends_with("flow-collections.yml"))
        .expect("flow-collections.yml must be in the corpus");

    assert_eq!(value_at(&file.source, "matches[0].triggers[1]"), ":hello");
    assert_eq!(value_at(&file.source, "matches[1].vars[0].name"), "choice");
    assert_eq!(
        value_at(&file.source, "matches[1].vars[0].params.values[2]"),
        "gamma"
    );
    // A flow collection spanning several lines, with a comment inside it.
    assert_eq!(value_at(&file.source, "matches[3].triggers[0]"), ":one");

    // An empty flow collection is addressable but has no items.
    let index = index_of(&file);
    let empty = resolve(&index, &DocumentPath::parse("matches[4].vars").unwrap()).unwrap();
    assert_eq!(index.node(empty).unwrap().kind, NodeKind::Sequence);
    assert!(matches!(
        resolve(&index, &DocumentPath::parse("matches[4].vars[0]").unwrap()),
        Err(PathError::IndexOutOfRange { len: 0, .. })
    ));
}

#[test]
fn merge_keys_and_aliases_are_addressed_syntactically() {
    let file = synthetic_valid()
        .into_iter()
        .find(|file| file.name.ends_with("anchors-aliases-tags-merge.yml"))
        .expect("anchors-aliases-tags-merge.yml must be in the corpus");
    let index = index_of(&file);

    // A merge key is an ordinary scalar key spelled `<<`; its value is an alias.
    let merged = resolve(&index, &DocumentPath::parse("matches[0].<<").unwrap()).unwrap();
    assert_eq!(index.node(merged).unwrap().kind, NodeKind::Alias);
    assert_eq!(
        path_to(&index, merged).unwrap().to_string(),
        "matches[0].<<"
    );

    // An alias standing in for a whole sequence entry is addressed by position.
    let aliased = resolve(&index, &DocumentPath::parse("global_vars[0]").unwrap()).unwrap();
    assert_eq!(index.node(aliased).unwrap().kind, NodeKind::Alias);

    // A tagged scalar is addressed like any other; refusing it is the gate's job.
    assert_eq!(value_at(&file.source, "matches[2].replace"), "yes");

    // The resolver never resolves *through* an alias into the anchored mapping:
    // the alias is a leaf, so a key segment applied to it is a kind mismatch.
    assert!(matches!(
        resolve(&index, &DocumentPath::parse("matches[0].<<.word").unwrap()),
        Err(PathError::KeyIntoNonMapping {
            kind: NodeKind::Alias,
            ..
        })
    ));
}

#[test]
fn awkward_documents_resolve_without_panicking() {
    // Empty values, explicit keys, a bare sequence item and a document whose
    // root is a sequence — `PROGRESS.md` R7's list.
    assert_eq!(value_at("empty:\nnext: after\n", "next"), "after");
    assert_eq!(value_at("? explicit\n: value\n", "explicit"), "value");
    assert_eq!(value_at("- one\n- two\n", "[1]"), "two");

    let index = SyntaxIndex::parse("matches:\n  - \n  - trigger: :hi\n").unwrap();
    let bare = resolve(&index, &DocumentPath::parse("matches[0]").unwrap()).unwrap();
    assert!(index.node(bare).unwrap().is_zero_width());
    assert_eq!(
        value_at("matches:\n  - \n  - trigger: :hi\n", "matches[1].trigger"),
        ":hi"
    );

    // A document with no root node at all has nothing to address.
    let empty = SyntaxIndex::parse("---\n").unwrap();
    assert!(matches!(
        resolve(&empty, &DocumentPath::root(0)),
        Err(PathError::EmptyDocument { document_index: 0 }) | Ok(_)
    ));
} // End of function awkward_documents_resolve_without_panicking()

#[test]
fn a_path_built_from_segments_matches_its_parsed_form() {
    let built = DocumentPath::new(
        0,
        vec![
            PathSegment::key("matches"),
            PathSegment::Index(3),
            PathSegment::key("replace"),
        ],
    );
    assert_eq!(built, DocumentPath::parse("matches[3].replace").unwrap());
    assert_eq!(built.to_string(), "matches[3].replace");
    assert_eq!(built.segments().len(), 3);
    assert_eq!(built.segments()[1].as_index(), Some(3));
    assert_eq!(built.segments()[2].as_key(), Some("replace"));
}

#[test]
fn no_path_resolution_panics_on_any_corpus_file() {
    // Every path shape crossed with every fixture, including paths that make no
    // sense for the document. Resolution is a total function of the text.
    let probes = [
        "#0",
        "#1",
        "#99",
        "matches",
        "matches[0]",
        "matches[0].replace",
        "matches[0].replace.deeper",
        "matches[99999]",
        "[0]",
        "[0].trigger",
        "'a.b'",
        "''",
        "<<",
    ];
    let mut files = synthetic_valid();
    files.extend(real_corpus());

    for file in &files {
        let Ok(index) = SyntaxIndex::parse(&file.source) else {
            continue;
        };
        for probe in probes {
            let path = DocumentPath::parse(probe).expect("probe must parse");
            // The result is irrelevant; not panicking is the assertion.
            let _ = resolve(&index, &path);
        }
        for node in index.nodes() {
            let _ = path_to(&index, node.id);
        }
    } // End of the loop over every corpus file
} // End of function no_path_resolution_panics_on_any_corpus_file()

// ---------------------------------------------------------------------------
// The universal contracts, swept rather than sampled
//
// The two claims the resolver makes are universal — `parse(display(p)) == p` for
// *every* path, and `parse` is total over *every* string — and a hand-picked
// table cannot establish either. These sweeps are what turn the doc comments
// into checked assertions. Added after the Phase 0c-2a review, whose third
// finding was that the contracts were advertised and not tested.
// ---------------------------------------------------------------------------

/// A deliberately tiny xorshift64* generator.
///
/// Seeded and deterministic so a failure is reproducible, and hand-written so
/// the crate gains no dependency — the same generator `tests/scalar_codec.rs`
/// uses for its own sweep.
struct Prng(u64);

impl Prng {
    /// Returns the next pseudo-random word.
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }

    /// Returns a value in `0..bound`.
    fn below(&mut self, bound: usize) -> usize {
        (self.next() % bound as u64) as usize
    }
}

/// Every character class that could plausibly break the textual form: the
/// grammar's own punctuation, the quote, both YAML 1.1 line separators, C0 and
/// C1 controls, the BOM, an astral character and ordinary text.
const KEY_ALPHABET: [char; 30] = [
    'a', 'Z', '0', '9', '.', '[', ']', '\'', '#', ' ', '\t', '\n', '\r', ':', '-', '<', '>', '{',
    '}', '"', '\\', '\0', '\u{7}', '\u{7f}', '\u{1b}', '\u{85}', '\u{a0}', '\u{feff}', 'é', '😀',
];

#[test]
fn the_textual_form_round_trips_a_seeded_sweep_of_arbitrary_keys() {
    let mut prng = Prng(0x9a7d_10c4_51ee_b00b);
    let cases = 4000;

    for _ in 0..cases {
        let document_index = match prng.below(4) {
            0 => 0,
            1 => 1,
            2 => prng.below(1000),
            _ => usize::MAX,
        };
        let mut segments = Vec::new();
        for _ in 0..prng.below(5) {
            if prng.below(3) == 0 {
                segments.push(PathSegment::Index(match prng.below(3) {
                    0 => 0,
                    1 => prng.below(10_000),
                    _ => usize::MAX,
                }));
                continue;
            }
            let length = prng.below(6);
            let key: String = (0..length)
                .map(|_| KEY_ALPHABET[prng.below(KEY_ALPHABET.len())])
                .collect();
            segments.push(PathSegment::Key(key));
        } // End of the loop that builds one path's segments

        let path = DocumentPath::new(document_index, segments);
        let text = path.to_string();
        assert_eq!(
            DocumentPath::parse(&text).as_ref(),
            Ok(&path),
            "round trip failed for {:?} (rendered {:?})",
            path,
            text.escape_debug().to_string()
        );
    } // End of the loop over the sweep's cases

    println!("textual form: {cases} seeded paths round-tripped byte for byte");
} // End of function the_textual_form_round_trips_a_seeded_sweep_of_arbitrary_keys()

#[test]
fn parsing_is_total_over_a_seeded_sweep_of_arbitrary_text() {
    // `DocumentPath::parse` takes text from outside the crate, so it must answer
    // every string with either a path or a located error, never a panic.
    let mut prng = Prng(0x0bad_1dea_c0ff_ee11);
    let cases = 20_000;
    let mut parsed = 0usize;

    for _ in 0..cases {
        let length = prng.below(9);
        let text: String = (0..length)
            .map(|_| KEY_ALPHABET[prng.below(KEY_ALPHABET.len())])
            .collect();
        // A parse result either round-trips or is a located refusal; either way
        // the assertion is that control returns here at all.
        if let Ok(path) = DocumentPath::parse(&text) {
            parsed += 1;
            assert_eq!(
                DocumentPath::parse(&path.to_string()).as_ref(),
                Ok(&path),
                "a parsed path did not survive re-rendering: {:?}",
                text.escape_debug().to_string()
            );
        }
    } // End of the loop over the sweep's cases

    println!("parsing: {cases} seeded strings, {parsed} parsed, 0 panics");
    assert!(parsed > 0, "the sweep must produce some valid paths");
} // End of function parsing_is_total_over_a_seeded_sweep_of_arbitrary_text()

#[test]
fn a_non_scalar_key_is_refused_rather_than_approximated() {
    // A collection used as a mapping key cannot be spelled as a path segment.
    // `AddressError::NonScalarKey` is unreachable from the corpus — the pinned
    // count for it is 0 — so it needs its own input, or the branch is untested.
    let source = "? [a, b]\n: value\n";
    let index = SyntaxIndex::parse(source).expect("an explicit collection key must parse");

    let value = index
        .nodes()
        .iter()
        .find(|node| node.role == NodeRole::MappingValue)
        .expect("the mapping must have a value");
    assert!(matches!(
        path_to(&index, value.id),
        Err(AddressError::NonScalarKey { .. })
    ));

    // And no key segment can name it, so the value is unreachable from a path
    // in both directions rather than reachable by one and not the other.
    for probe in ["a", "'[a, b]'", "'a, b'", "'a'"] {
        let path = DocumentPath::parse(probe).expect("probe must parse");
        assert!(
            matches!(resolve(&index, &path), Err(PathError::NoSuchKey { .. })),
            "{probe:?} must not name a collection key"
        );
    }
} // End of function a_non_scalar_key_is_refused_rather_than_approximated()

#[test]
fn a_duplicated_key_makes_its_whole_subtree_unaddressable() {
    // The four duplicate values in the corpus fixture are all leaf scalars, so
    // the corpus cannot show whether ambiguity propagates to descendants.
    let source = "a:\n  child: one\na:\n  child: two\n";
    let index = SyntaxIndex::parse(source).expect("fixture must parse");

    // Resolution stops at the duplicated `a`, not at `child`.
    assert!(matches!(
        resolve(&index, &DocumentPath::parse("a.child").unwrap()),
        Err(PathError::DuplicateKey {
            occurrences: 2,
            segment: 0,
            ..
        })
    ));

    // Both nested `child` values are unaddressable, and for the ancestor's
    // reason: the key reported is `a`, not `child`.
    let children: Vec<_> = index
        .nodes()
        .iter()
        .filter(|node| {
            node.scalar
                .as_ref()
                .is_some_and(|scalar| scalar.value == "one" || scalar.value == "two")
        })
        .map(|node| path_to(&index, node.id))
        .collect();
    assert_eq!(children.len(), 2);
    for outcome in children {
        match outcome {
            Err(AddressError::AmbiguousKey { key, .. }) => assert_eq!(key, "a"),
            other => panic!("expected an ancestor ambiguity, got {other:?}"),
        }
    }
} // End of function a_duplicated_key_makes_its_whole_subtree_unaddressable()

#[test]
fn duplicate_detection_compares_decoded_values_across_presentations() {
    // `a` and `'a'` are the same key. A duplicate check that compared source
    // text would miss this, and 0c-2b would then happily edit one of two
    // entries the user cannot tell apart.
    let index = SyntaxIndex::parse("a: one\n'a': two\n\"a\": three\n").expect("fixture must parse");
    assert!(matches!(
        resolve(&index, &DocumentPath::parse("a").unwrap()),
        Err(PathError::DuplicateKey { occurrences: 3, .. })
    ));

    // A quoted key that decodes to something *different* is not a duplicate.
    let distinct = SyntaxIndex::parse("a: one\n'b': two\n").expect("fixture must parse");
    assert!(resolve(&distinct, &DocumentPath::parse("a").unwrap()).is_ok());
    assert!(resolve(&distinct, &DocumentPath::parse("b").unwrap()).is_ok());
}

#[test]
fn a_flow_collection_without_a_comment_passes_the_hazard_gate() {
    // This pins the correction the Phase 0c-2a review forced. The module
    // documentation used to claim that every flow collection a path resolves
    // into is refused by `is_safely_editable`. It is not: `HazardKind` has only
    // `CommentInFlowCollection`. An unchecked claim in a doc comment is how the
    // false one survived, so the true one gets a test.
    //
    // The consequence is R17: a block scalar is illegal inside `{…}`/`[…]`, so
    // flow context is a constraint step 0c-2b must carry itself rather than
    // inherit from the gate.
    let source = "matches: [{trigger: \":a\", replace: old}]\n";
    let index = SyntaxIndex::parse(source).expect("fixture must parse");
    let trivia = TriviaIndex::scan(source, &index);

    let target = resolve(&index, &DocumentPath::parse("matches[0].replace").unwrap())
        .expect("a flow-interior value is addressable");
    assert!(
        trivia.is_safely_editable(&index, target),
        "the gate does not refuse a comment-free flow collection; \
         0c-2b must handle flow context itself"
    );

    // The same collection *with* a comment inside it is refused, which is the
    // one flow case the gate does cover.
    let commented = "matches: [\n  {trigger: \":a\", # why\n   replace: old}]\n";
    let index = SyntaxIndex::parse(commented).expect("fixture must parse");
    let trivia = TriviaIndex::scan(commented, &index);
    let target = resolve(&index, &DocumentPath::parse("matches[0].replace").unwrap())
        .expect("still addressable");
    assert!(
        !trivia.is_safely_editable(&index, target),
        "a comment inside a flow collection must refuse it"
    );
} // End of function a_flow_collection_without_a_comment_passes_the_hazard_gate()
