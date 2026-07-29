//! Shared helpers for the corpus-driven integration tests.
//!
//! Two tiers of corpus exist (see `tests/corpus/README.md`):
//!
//! - `synthetic/` is committed and always present.
//! - `real/` is gitignored, populated by `scripts/sync-real-corpus.sh`, and may
//!   legitimately be absent. Every helper that touches it returns an empty list
//!   rather than failing, so a fresh clone and CI both pass.

// Each integration test binary uses a different subset of these helpers, so
// unused ones are expected rather than a defect.
#![allow(dead_code)]

use std::path::{Path, PathBuf};

/// A corpus file: its path plus the exact bytes on disk, decoded as UTF-8.
pub struct CorpusFile {
    /// Absolute path to the file.
    pub path: PathBuf,
    /// Path relative to the corpus root, used in test output.
    pub name: String,
    /// Full file contents, byte-for-byte, BOM included if present.
    pub source: String,
}

impl CorpusFile {
    /// Returns the source with a leading UTF-8 BOM removed.
    ///
    /// YAML parsers disagree about whether they tolerate a BOM, so probes strip
    /// it and record separately that it was there.
    pub fn source_without_bom(&self) -> &str {
        self.source.strip_prefix('\u{feff}').unwrap_or(&self.source)
    }

    /// Returns `true` when the file begins with a UTF-8 BOM.
    pub fn has_bom(&self) -> bool {
        self.source.starts_with('\u{feff}')
    }
}

/// Absolute path to the corpus root.
pub fn corpus_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("corpus")
}

/// Loads every `.yml` file directly inside `synthetic/`, excluding `invalid/`.
///
/// These are the files a valid-YAML test may assume parse cleanly. Results are
/// sorted by name so test output is stable and diffable.
pub fn synthetic_valid() -> Vec<CorpusFile> {
    let mut files = read_yaml_dir(&corpus_root().join("synthetic"), false);
    files.sort_by(|a, b| a.name.cmp(&b.name));
    files
}

/// Loads the deliberately broken fixtures in `synthetic/invalid/`.
pub fn synthetic_invalid() -> Vec<CorpusFile> {
    let mut files = read_yaml_dir(&corpus_root().join("synthetic").join("invalid"), false);
    files.sort_by(|a, b| a.name.cmp(&b.name));
    files
}

/// Loads the gitignored real corpus, or returns an empty vector when it is
/// absent or empty.
///
/// Callers must treat an empty result as "skip", never as "fail": the real
/// corpus is the owner's private configuration and is not available in CI or in
/// a fresh clone.
pub fn real_corpus() -> Vec<CorpusFile> {
    let mut files = read_yaml_dir(&corpus_root().join("real"), true);
    files.sort_by(|a, b| a.name.cmp(&b.name));
    files
}

/// Prints a uniform skip notice for a real-corpus test.
///
/// Visible with `cargo test -- --nocapture`. Returns `true` when the caller
/// should skip.
pub fn skip_without_real_corpus(test_name: &str, files: &[CorpusFile]) -> bool {
    if files.is_empty() {
        println!(
            "SKIP {test_name}: no real corpus present. \
             Run ./scripts/sync-real-corpus.sh to populate it locally. \
             It is gitignored and never committed."
        );
        return true;
    }
    false
}

/// Reads YAML files from `dir`, optionally recursing into subdirectories.
///
/// A missing directory yields an empty vector, which is what makes the real
/// corpus optional. Non-UTF-8 files are skipped rather than panicking.
fn read_yaml_dir(dir: &Path, recursive: bool) -> Vec<CorpusFile> {
    let mut out = Vec::new();
    let Ok(entries) = std::fs::read_dir(dir) else {
        return out;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(metadata) = std::fs::symlink_metadata(&path) else {
            continue;
        };

        if metadata.is_dir() {
            if recursive {
                out.extend(read_yaml_dir(&path, recursive));
            }
            continue;
        }

        let is_yaml = path
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("yml") || ext.eq_ignore_ascii_case("yaml"));
        if !is_yaml {
            continue;
        }

        let Ok(bytes) = std::fs::read(&path) else {
            continue;
        };
        let Ok(source) = String::from_utf8(bytes) else {
            continue;
        };

        let name = path
            .strip_prefix(corpus_root())
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        out.push(CorpusFile { path, name, source });
    }
    out
} // End of function read_yaml_dir()
