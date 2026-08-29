//! The sweep both prose-contract checks are built on — Phase 2d-4a-C step 2.
//!
//! Two modules in this crate pin a family of documentation claims to a recorded
//! inventory: [`crate::liveness_contract`], for the observation pipeline's
//! liveness contract (Phase 2d-3-C), and [`crate::retained_state_contract`], for
//! its scoped-lifetime contract (Phase 2d-4a-C). Everything the two need
//! identically lives here.
//!
//! **It is shared rather than copied, and that is the point of the module.** A
//! fix applied to one copy of a mechanism and not to the other is this project's
//! recurring failure mode — `docs/decisions/2c-4a-2-notes.md` §7.6.2 is one
//! record of it and `2d-3-notes.md` §20.7 item 41 is another — so the second
//! check was built by extracting this module out of the first rather than by
//! duplicating its 150 lines.
//!
//! A caller supplies a phrase family, the trees to walk and the files to leave
//! out; it gets back every occurrence with its position and a window of text for
//! the failure report. It then hands that back with its own inventory and gets
//! the disagreements between the two — [`complaints_against`], added by Phase
//! 2d-4a-C's step-2 round 1, because the comparison had been copied into both
//! checks and the copy had already propagated one defect into both.
//!
//! The walk's file selection is also a caller-visible answer of its own,
//! [`selected_files`], added by that step's round 2. A check that wants to assert
//! it covers a particular file cannot do it through a phrase hit — a file with no
//! hit and a file the walk never opened look alike from the hits — so it asks
//! which files were selected instead, through the very function [`sweep`]
//! selects with.
//!
//! **Judging those occurrences stays the caller's**, because that judgement is
//! the whole of what a contract check is for: the inventory that says which
//! positions are acceptable and why is the caller's, and so is the sentence the
//! caller wraps a non-empty complaint list in, which names its own contract
//! module and its own `INVENTORY` path.
//!
//! # The one part that is load-bearing rather than convenient
//!
//! [`prose_units`] joins a run of comment lines into a single unit before
//! matching. This workspace wraps its doc comments at about 76 columns, so a
//! claim of eleven words straddles a line break as a matter of course, and a
//! line-based sweep — which is what every hand-run round of both phases' reviews
//! used — cannot see it. Phase 2d-3-C measured seven such claims in the tree it
//! shipped against. **Altering that join changes what both checks can see**, so
//! it is not a detail either of them may tune for itself.
//!
//! # What this module deliberately does not do
//!
//! It matches plain substrings, lowercased, and it knows nothing about meaning.
//! It cannot tell a claim from a mention of one, it cannot judge whether a
//! passage's claim is true, and it walks source trees only — the limits each
//! check inherits are stated in that check's own module documentation, where a
//! reader of the failure message will find them.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

/// One judged position: how many times one phrase may appear in one file, and
/// why every one of those occurrences is acceptable.
///
/// The key is `(file, phrase)` rather than `(file, line)` because a line number
/// moves whenever anything above it is edited, and a guard that fails on an
/// unrelated edit is a guard people learn to re-baseline without reading.
pub(crate) struct Judged {
    /// The file, relative to the workspace root.
    pub(crate) file: &'static str,
    /// The phrase, exactly as it appears in the check's own phrase family.
    pub(crate) phrase: &'static str,
    /// How many occurrences of `phrase` this file may hold.
    pub(crate) count: usize,
    /// Why they are acceptable — one line, and one of four kinds: it is the
    /// contract itself; it is a pointer at the contract; it is a local fact that
    /// does not restate the contract; it is a false positive of the pattern from
    /// an unrelated subsystem.
    ///
    /// **A passage that restates an obligation and hands it on is a pointer,
    /// not a local fact**, whichever contract it hands it to — Phase 2d-4a's
    /// round-1 fix filed two positions restating the 2d design consult's Q3
    /// obligation on a *future* consumer as local facts, and round 2 found that
    /// this records incorrectly the one distinction these checks exist to make a
    /// reviewer draw: a local fact is a claim the code beside it keeps.
    pub(crate) reason: &'static str,
}

/// Every `.rs` file under `root`, in path order, recursively.
pub(crate) fn rust_files_under(root: &Path) -> Vec<PathBuf> {
    let mut found: Vec<PathBuf> = Vec::new();
    let mut pending: Vec<PathBuf> = vec![root.to_path_buf()];
    while let Some(directory) = pending.pop() {
        let entries = fs::read_dir(&directory)
            .unwrap_or_else(|error| panic!("cannot read {}: {error}", directory.display()));
        for entry in entries {
            let path = entry
                .unwrap_or_else(|error| {
                    panic!("cannot read an entry of {}: {error}", directory.display())
                })
                .path();
            if path.is_dir() {
                pending.push(path);
            } else if path.extension().is_some_and(|extension| extension == "rs") {
                found.push(path);
            }
        } // End of the loop over one directory's entries
    } // End of the walk over the directory tree
    found.sort();
    found
} // End of function rust_files_under()

/// One stretch of prose to match against: a joined run of comment lines, or one
/// non-comment line.
pub(crate) struct ProseUnit {
    /// The 1-based line the unit starts at, for the failure report.
    pub(crate) line: usize,
    /// The text, with `//!`, `///` and `//` markers removed and the run's lines
    /// joined by single spaces.
    pub(crate) text: String,
}

/// Splits `source` into the units a sweep matches against.
///
/// **A contiguous run of comment lines becomes one unit.** This workspace wraps
/// its doc comments at about 76 columns, so a claim of eleven words straddles a
/// line break as a matter of course, and a line-based sweep — which is what
/// every hand-run round of the 2d-3 and 2d-4a reviews used — cannot see it.
/// Everything that is not a comment line stays one unit per line, which is what
/// keeps an assertion message or a test name reported at its own position.
///
/// **That second half is a cost as well as a benefit, and round 7 of Phase
/// 2d-4a's review is where it was written down rather than framed as a benefit
/// alone.** This repository also hand-wraps long assertion messages with
/// backslash string continuations, and those lines are not comment lines, so a
/// claim split across such a break is exactly as invisible here as a claim split
/// across a wrapped comment was before the join above existed. Nothing joins
/// them, and the two callers' phrase families both inherit the hole. **It is a
/// hole in what the guards can see and not a live miss today**: re-running both
/// families over a continuation-joined copy of both swept trees — 88
/// retained-state phrases and 61 liveness phrases — finds **zero** positions
/// that only the joined form matches. That measurement is a hand-run replica of
/// this function and its callers, taken at Phase 2d-4a round 7, and **no test in
/// this repository re-takes it**; it is a reading of one tree at one moment,
/// not a guard.
pub(crate) fn prose_units(source: &str) -> Vec<ProseUnit> {
    let lines: Vec<&str> = source.lines().collect();
    let mut units: Vec<ProseUnit> = Vec::new();
    let mut index = 0usize;
    while index < lines.len() {
        if lines[index].trim_start().starts_with("//") {
            let start = index;
            let mut joined: Vec<&str> = Vec::new();
            while index < lines.len() && lines[index].trim_start().starts_with("//") {
                let trimmed = lines[index].trim_start();
                let body = trimmed
                    .strip_prefix("//!")
                    .or_else(|| trimmed.strip_prefix("///"))
                    .or_else(|| trimmed.strip_prefix("//"))
                    .unwrap_or(trimmed);
                joined.push(body.trim());
                index += 1;
            } // End of the loop over one run of comment lines
            units.push(ProseUnit {
                line: start + 1,
                text: joined.join(" "),
            });
        } else {
            units.push(ProseUnit {
                line: index + 1,
                text: lines[index].to_string(),
            });
            index += 1;
        }
    } // End of the walk over the file's lines
    units
} // End of function prose_units()

/// One occurrence of one phrase in one file.
pub(crate) struct Hit {
    /// The file, relative to the workspace root, spelled as
    /// `SelectedFile::reported` spells it.
    pub(crate) file: String,
    /// The 1-based line the prose unit holding it starts at.
    pub(crate) line: usize,
    /// The phrase that matched.
    pub(crate) phrase: &'static str,
    /// A window of the unit's text around the match, for the failure report.
    pub(crate) context: String,
}

/// The workspace root — this crate's manifest directory's parent.
pub(crate) fn workspace_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri has a parent directory")
        .to_path_buf()
} // End of function workspace_root()

/// One file the walk covers: the path it is read through, and the string it is
/// reported and inventoried under.
///
/// **The two are not interchangeable, which is why both travel.** `relative` is
/// the real path, so joining it to the workspace root names the file on disk
/// whatever bytes its name holds. `reported` is that path through
/// `to_string_lossy`, which is what [`Hit`] carries, what an inventory key's
/// first half is written as, and what a skip list is compared against — a
/// display form, and a lossy one. A `.rs` file whose name is not valid UTF-8
/// gains a replacement character on the way into it, and a read through that
/// string would open some other path or none.
pub(crate) struct SelectedFile {
    /// The file's path relative to the workspace root, losslessly.
    pub(crate) relative: PathBuf,
    /// The same path as a `String`, lossily: [`Hit`]'s `file`, the inventory
    /// key's first half, and the value a skip list is matched against.
    pub(crate) reported: String,
}

/// Which files a sweep of `trees` covers once `skipped` is taken out, in file
/// order, each relative to the workspace root.
///
/// Each skipped path is asserted to exist, so a rename that silently emptied a
/// skip list fails here rather than turning a check into a vacuous pass.
///
/// # Why the selection is a function rather than a step inside [`sweep`]
///
/// So that a check can assert **which files it covers** without going through a
/// phrase hit. A hit-based coverage assertion cannot tell a file the sweep opened
/// and found nothing in from a file the sweep never opened at all, so it goes on
/// passing after the file is dropped from the walk — which is what Phase
/// 2d-4a-C's step-2 round 2 found in both guards' `the_sweep_reaches_both_trees`.
///
/// **What a test calling this gets, stated exactly.** [`sweep`] selects through
/// this function, so a test that calls it with a check's own trees and skip list
/// re-derives that check's selection through the very code the sweep selects
/// with. It does not get the `Vec` the sweep walked: that value belongs to one
/// invocation of [`sweep`] and is never handed out, so a test asking again gets
/// a **second traversal** with the same arguments. The evidence is therefore
/// *what this function answers for those arguments* — weaker than identity, and
/// stronger than a test that rebuilt the walk for itself, which would prove only
/// its own copy.
pub(crate) fn selected_files(trees: &[&str], skipped: &[&str]) -> Vec<SelectedFile> {
    let root = workspace_root();
    for path in skipped {
        assert!(
            root.join(path).is_file(),
            "the skipped file {path} must exist, or the skip list is silently empty"
        );
    }
    let mut selected: Vec<SelectedFile> = Vec::new();
    for tree in trees {
        for path in rust_files_under(&root.join(tree)) {
            let relative = path
                .strip_prefix(&root)
                .expect("a swept file lives under the workspace root")
                .to_path_buf();
            let reported = relative.to_string_lossy().into_owned();
            if !skipped.contains(&reported.as_str()) {
                selected.push(SelectedFile { relative, reported });
            }
        } // End of the loop over one tree's files
    } // End of the loop over the swept trees
    selected
} // End of function selected_files()

/// Every occurrence of every phrase in `phrases`, over every file
/// [`selected_files`] returns for `trees` and `skipped`, in file order.
pub(crate) fn sweep(
    phrases: &'static [&'static str],
    trees: &[&str],
    skipped: &[&str],
) -> Vec<Hit> {
    let root = workspace_root();
    let mut hits: Vec<Hit> = Vec::new();
    for file in selected_files(trees, skipped) {
        let path = root.join(&file.relative);
        let source = fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("cannot read {}: {error}", path.display()));
        for unit in prose_units(&source) {
            let lowered = unit.text.to_lowercase();
            for phrase in phrases {
                let mut from = 0usize;
                while let Some(offset) = lowered[from..].find(phrase) {
                    let at = from + offset;
                    hits.push(Hit {
                        file: file.reported.clone(),
                        line: unit.line,
                        phrase,
                        context: window_around(&unit.text, at, phrase.len()),
                    });
                    from = at + phrase.len();
                } // End of the loop over one phrase's occurrences in one unit
            } // End of the loop over the phrase family
        } // End of the loop over one file's prose units
    } // End of the loop over the selected files
    hits
} // End of function sweep()

/// Up to 70 characters either side of a match, on character boundaries.
pub(crate) fn window_around(text: &str, at: usize, length: usize) -> String {
    let start = (0..=at.saturating_sub(70))
        .rev()
        .find(|candidate| text.is_char_boundary(*candidate))
        .unwrap_or(0);
    let end = (at + length..=(at + length + 70).min(text.len()))
        .rev()
        .find(|candidate| text.is_char_boundary(*candidate))
        .unwrap_or(text.len());
    text[start..end].to_string()
} // End of function window_around()

/// `(file, phrase)` to the number of hits, for one side of the comparison.
pub(crate) fn tally(hits: &[Hit]) -> BTreeMap<(String, &'static str), usize> {
    let mut counted: BTreeMap<(String, &'static str), usize> = BTreeMap::new();
    for hit in hits {
        *counted.entry((hit.file.clone(), hit.phrase)).or_insert(0) += 1;
    }
    counted
} // End of function tally()

/// Every disagreement between what a sweep found and what an inventory records,
/// one formatted line per `(file, phrase)`, empty when the two agree.
///
/// This is the whole of both guards' comparison, shared rather than copied. The
/// caller keeps what makes its check *its* check: the phrase family, the trees,
/// the skip list, the inventory and — because the two differ and each names its
/// own module and its own `INVENTORY` path — the final assertion message it
/// wraps a non-empty answer in.
///
/// # What it asserts about the inventory before comparing anything
///
/// Three properties of `inventory`, each a panic rather than a complaint,
/// because a malformed inventory cannot be judged against a sweep at all:
///
/// - every entry's `phrase` is a member of `shapes`, so an entry cannot record
///   a wording the sweep never looks for;
/// - every entry carries a non-empty `reason`;
/// - every entry's `count` is greater than zero. **A zero-count entry is a hard
///   error rather than a recorded absence**: it can match nothing, so it is
///   indistinguishable from the entry not being there, and both comparisons
///   below would silently agree with it. Phase 2d-4a-C's review found the
///   opposite arrangement — zero used as an *unseen* sentinel — defeating the
///   two invariants the guards exist to enforce, in both of them at once.
///
/// # Duplicate detection
///
/// A second entry for one `(file, phrase)` is caught by
/// `BTreeMap::insert(..).is_none()` — the map's own answer about what was
/// already there — never by comparing the slot against a value a legitimate
/// entry could also hold.
///
/// # The two directions, and why both are unconditional
///
/// Forward: a `(file, phrase)` the sweep found whose count differs from the
/// inventory's is a complaint, and an inventory that does not name the key at
/// all supplies an expected count of zero, which is the unrecorded-hit case.
/// The complaint keeps every hit's line and context window, because a reviewer
/// judging a position needs to see it.
///
/// Reverse: **every** recorded key the sweep did not find is a complaint. That
/// is the *reworded or removed, so judge it again* direction, and it carries no
/// condition on the recorded count.
pub(crate) fn complaints_against(
    hits: &[Hit],
    inventory: &[Judged],
    shapes: &[&str],
) -> Vec<String> {
    let found = tally(hits);
    let mut recorded: BTreeMap<(String, &'static str), usize> = BTreeMap::new();
    for entry in inventory {
        assert!(
            shapes.contains(&entry.phrase),
            "the inventory names a phrase the family does not hold: {}",
            entry.phrase
        );
        assert!(
            !entry.reason.is_empty(),
            "every inventory entry carries its reason: {} / {}",
            entry.file,
            entry.phrase
        );
        assert!(
            entry.count > 0,
            "an inventory entry records at least one occurrence — a count of zero can \
             match nothing and is indistinguishable from the entry's absence: {} / {}",
            entry.file,
            entry.phrase
        );
        assert!(
            recorded
                .insert((entry.file.to_string(), entry.phrase), entry.count)
                .is_none(),
            "one entry per file and phrase: {} / {}",
            entry.file,
            entry.phrase
        );
    } // End of the loop over the recorded inventory

    let mut complaints: Vec<String> = Vec::new();
    for (key, count) in &found {
        let expected = recorded.get(key).copied().unwrap_or(0);
        if expected != *count {
            let where_ = hits
                .iter()
                .filter(|hit| hit.file == key.0 && hit.phrase == key.1)
                .map(|hit| format!("            line {}: …{}…", hit.line, hit.context))
                .collect::<Vec<String>>()
                .join("\n");
            complaints.push(format!(
                "    {} / {:?}: found {}, inventory says {}\n{}",
                key.0, key.1, count, expected, where_
            ));
        }
    } // End of the loop over what the sweep found
    for (key, count) in &recorded {
        if !found.contains_key(key) {
            complaints.push(format!(
                "    {} / {:?}: inventory says {}, found none — reworded or removed, so judge it again",
                key.0, key.1, count
            ));
        }
    } // End of the loop over what the inventory records
    complaints
} // End of function complaints_against()
