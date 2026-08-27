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
//! the failure report. **Judging those occurrences stays the caller's**, because
//! that judgement is the whole of what a contract check is for.
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
    /// The file, relative to the workspace root.
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

/// Every occurrence of every phrase in `phrases`, over every `.rs` file of every
/// tree in `trees`, in file order, with each file in `skipped` left out.
///
/// Each skipped path is asserted to exist, so a rename that silently emptied a
/// skip list fails here rather than turning a check into a vacuous pass.
pub(crate) fn sweep(
    phrases: &'static [&'static str],
    trees: &[&str],
    skipped: &[&str],
) -> Vec<Hit> {
    let root = workspace_root();
    for path in skipped {
        assert!(
            root.join(path).is_file(),
            "the skipped file {path} must exist, or the skip list is silently empty"
        );
    }
    let mut hits: Vec<Hit> = Vec::new();
    for tree in trees {
        for path in rust_files_under(&root.join(tree)) {
            let relative = path
                .strip_prefix(&root)
                .expect("a swept file lives under the workspace root")
                .to_string_lossy()
                .into_owned();
            if skipped.contains(&relative.as_str()) {
                continue;
            }
            let source = fs::read_to_string(&path)
                .unwrap_or_else(|error| panic!("cannot read {}: {error}", path.display()));
            for unit in prose_units(&source) {
                let lowered = unit.text.to_lowercase();
                for phrase in phrases {
                    let mut from = 0usize;
                    while let Some(offset) = lowered[from..].find(phrase) {
                        let at = from + offset;
                        hits.push(Hit {
                            file: relative.clone(),
                            line: unit.line,
                            phrase,
                            context: window_around(&unit.text, at, phrase.len()),
                        });
                        from = at + phrase.len();
                    } // End of the loop over one phrase's occurrences in one unit
                } // End of the loop over the phrase family
            } // End of the loop over one file's prose units
        } // End of the loop over one tree's files
    } // End of the loop over the swept trees
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
