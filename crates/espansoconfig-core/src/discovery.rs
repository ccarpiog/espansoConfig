//! Locate the espanso configuration directory, enumerate its files, and
//! classify them.
//!
//! This is the one module fully implemented in Phase 0a: it is small,
//! self-contained, and every other module needs it to know what to open.
//!
//! The layout it understands (`IMPLEMENTATION_PLAN.md` section 3.1):
//!
//! ```text
//! ~/Library/Application Support/espanso/
//!   config/          # HOW espanso behaves — default.yml + app-specific profiles
//!     default.yml
//!   match/           # WHAT espanso types — snippets
//!     base.yml
//!     *.yml
//!     packages/      # installed Hub packages — TREAT AS READ-ONLY
//! ```
//!
//! Two espanso rules drive the classification and are easy to overlook:
//!
//! - The default include glob is `../match/**/[!_]*.yml`, so **a file whose name
//!   starts with `_` is not auto-loaded**. That is the supported mechanism for
//!   scoping snippets to an app via `extra_includes`, not a mistake, and the
//!   editor must show such files as intentionally disabled rather than hide or
//!   "fix" them.
//! - Anything under `match/packages/` came from the Hub and is read-only.

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};
use std::ffi::OsStr;
use std::fmt;
use std::io;
use std::path::{Path, PathBuf};

use crate::wire::{WirePathRef, WirePaths};

/// What a discovered file is, from espanso's point of view.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
pub enum FileKind {
    /// A snippet file under `match/`, outside `match/packages/`.
    MatchFile,
    /// A profile under `config/`, e.g. `config/default.yml`.
    ConfigProfile,
    /// A file under `match/packages/` — installed from the Hub, read-only.
    Package,
}

impl FileKind {
    /// Returns `true` when the editor must refuse to write this file.
    ///
    /// Package files are owned by the Hub: editing them in place would be
    /// silently undone by the next `espanso package update`.
    pub fn is_read_only(self) -> bool {
        matches!(self, FileKind::Package)
    }
}

impl fmt::Display for FileKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match self {
            FileKind::MatchFile => "match file",
            FileKind::ConfigProfile => "config profile",
            FileKind::Package => "package",
        };
        f.write_str(name)
    }
}

/// One YAML file found inside an espanso configuration directory.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiscoveredFile {
    /// Absolute path to the file.
    pub path: PathBuf,
    /// What espanso treats this file as.
    pub kind: FileKind,
    /// Path relative to the configuration root, for display.
    pub relative_path: PathBuf,
    /// `true` when the file name starts with `_`, so espanso's default include
    /// glob `[!_]*.yml` skips it. Such a file is only loaded when another file
    /// pulls it in through `imports` or `extra_includes`.
    pub disabled: bool,
}

impl DiscoveredFile {
    /// The file's base name as a string, or an empty string for the
    /// (impossible in practice) case of a path with no final component.
    pub fn file_name(&self) -> &str {
        self.path
            .file_name()
            .and_then(OsStr::to_str)
            .unwrap_or_default()
    }
}

/// A located espanso configuration directory and the files inside it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigTree {
    /// The configuration root, i.e. the directory containing `config/` and
    /// `match/`.
    pub root: PathBuf,
    /// Every YAML file found, sorted by path so results are deterministic.
    pub files: Vec<DiscoveredFile>,
}

impl ConfigTree {
    /// Returns only the files of a given kind.
    pub fn of_kind(&self, kind: FileKind) -> impl Iterator<Item = &DiscoveredFile> {
        self.files.iter().filter(move |file| file.kind == kind)
    }

    /// Returns the files espanso loads without an explicit import, i.e. every
    /// enabled match file and config profile. Packages are excluded: they are
    /// loaded, but the editor never writes them.
    pub fn editable(&self) -> impl Iterator<Item = &DiscoveredFile> {
        self.files.iter().filter(|file| !file.kind.is_read_only())
    }
}

/// Everything that can go wrong while locating or reading a config tree.
///
/// [`Serialize`] is hand-written because [`std::io::Error`] is not
/// serializable: the `Io` variant crosses the IPC boundary as its
/// [`std::io::ErrorKind`] name, which is a code the frontend translates, never
/// as a rendered English message (plan section 9).
#[derive(Debug)]
pub enum DiscoveryError {
    /// No candidate directory existed. Carries the paths that were tried, so
    /// the UI can tell the user exactly where it looked.
    ConfigDirNotFound {
        /// Candidate paths, in the order they were probed.
        candidates: Vec<PathBuf>,
    },
    /// A path was supplied explicitly but is not a directory.
    NotADirectory(PathBuf),
    /// The filesystem refused a read.
    Io {
        /// The path being read when the error occurred.
        path: PathBuf,
        /// The underlying error.
        source: io::Error,
    },
}

impl fmt::Display for DiscoveryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DiscoveryError::ConfigDirNotFound { candidates } => {
                write!(f, "no espanso configuration directory found; tried: ")?;
                for (index, candidate) in candidates.iter().enumerate() {
                    if index > 0 {
                        write!(f, ", ")?;
                    }
                    write!(f, "{}", candidate.display())?;
                }
                Ok(())
            }
            DiscoveryError::NotADirectory(path) => {
                write!(f, "not a directory: {}", path.display())
            }
            DiscoveryError::Io { path, source } => {
                write!(f, "cannot read {}: {source}", path.display())
            }
        }
    } // End of function fmt() for DiscoveryError
}

impl Serialize for DiscoveryError {
    /// Serializes as `{ "code": …, … operands }` — codes and data, no prose.
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            DiscoveryError::ConfigDirNotFound { candidates } => {
                let mut out = serializer.serialize_struct("DiscoveryError", 2)?;
                out.serialize_field("code", "configDirNotFound")?;
                out.serialize_field("candidates", &WirePaths(candidates))?;
                out.end()
            }
            DiscoveryError::NotADirectory(path) => {
                let mut out = serializer.serialize_struct("DiscoveryError", 2)?;
                out.serialize_field("code", "notADirectory")?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.end()
            }
            DiscoveryError::Io { path, source } => {
                let mut out = serializer.serialize_struct("DiscoveryError", 3)?;
                out.serialize_field("code", "io")?;
                out.serialize_field("path", &WirePathRef(path))?;
                out.serialize_field("kind", &format!("{:?}", source.kind()))?;
                out.end()
            }
        }
    } // End of function serialize() for DiscoveryError
}

impl std::error::Error for DiscoveryError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            DiscoveryError::Io { source, .. } => Some(source),
            _ => None,
        }
    }
}

/// Resolves the espanso configuration directory from explicit inputs.
///
/// This is the testable core of [`locate_config_dir`]: it takes the
/// environment as arguments instead of reading it, so tests can exercise every
/// branch against a temp tree without mutating process-wide state.
///
/// Probe order, highest priority first:
///
/// 1. `explicit` — a path the user chose in the app's settings.
/// 2. `$XDG_CONFIG_HOME/espanso` — espanso honours this when it is set.
/// 3. `<home>/Library/Application Support/espanso` — the macOS default.
///
/// An `explicit` path is *never* silently skipped: if the user named a
/// directory and it does not exist, that is an error worth surfacing, not a
/// reason to fall back to a different config.
pub fn resolve_config_dir(
    explicit: Option<&Path>,
    xdg_config_home: Option<&Path>,
    home: Option<&Path>,
) -> Result<PathBuf, DiscoveryError> {
    if let Some(path) = explicit {
        if path.is_dir() {
            return Ok(path.to_path_buf());
        }
        return Err(DiscoveryError::NotADirectory(path.to_path_buf()));
    }

    let mut candidates = Vec::new();
    if let Some(xdg) = xdg_config_home {
        candidates.push(xdg.join("espanso"));
    }
    if let Some(home) = home {
        candidates.push(
            home.join("Library")
                .join("Application Support")
                .join("espanso"),
        );
    }

    for candidate in &candidates {
        if candidate.is_dir() {
            return Ok(candidate.clone());
        }
    }
    Err(DiscoveryError::ConfigDirNotFound { candidates })
} // End of function resolve_config_dir()

/// Resolves the espanso configuration directory from the real environment.
///
/// Thin wrapper over [`resolve_config_dir`]; see that function for the probe
/// order. Pass `explicit` when the user has chosen a directory in settings.
pub fn locate_config_dir(explicit: Option<&Path>) -> Result<PathBuf, DiscoveryError> {
    let xdg = std::env::var_os("XDG_CONFIG_HOME").map(PathBuf::from);
    let home = std::env::var_os("HOME").map(PathBuf::from);
    resolve_config_dir(explicit, xdg.as_deref(), home.as_deref())
}

/// Enumerates and classifies every `.yml`/`.yaml` file under `root`.
///
/// Only `config/` and `match/` are walked; anything else in the espanso
/// directory (runtime state, the app's own backups) is ignored on purpose.
/// Results are sorted by path so the file list is stable between runs.
pub fn enumerate(root: &Path) -> Result<ConfigTree, DiscoveryError> {
    if !root.is_dir() {
        return Err(DiscoveryError::NotADirectory(root.to_path_buf()));
    }

    let mut files = Vec::new();
    collect_yaml_files(&root.join("config"), &mut files)?;
    collect_yaml_files(&root.join("match"), &mut files)?;

    let packages_root = root.join("match").join("packages");
    let mut discovered: Vec<DiscoveredFile> = files
        .into_iter()
        .map(|path| classify(root, &packages_root, path))
        .collect();
    discovered.sort_by(|a, b| a.path.cmp(&b.path));

    Ok(ConfigTree {
        root: root.to_path_buf(),
        files: discovered,
    })
} // End of function enumerate()

/// Locates the config directory and enumerates it in one step.
pub fn discover(explicit: Option<&Path>) -> Result<ConfigTree, DiscoveryError> {
    let root = locate_config_dir(explicit)?;
    enumerate(&root)
}

/// Classifies a single path against the espanso layout rules.
///
/// `packages_root` is passed in rather than recomputed so the caller can build
/// it once per enumeration.
fn classify(root: &Path, packages_root: &Path, path: PathBuf) -> DiscoveredFile {
    let kind = if path.starts_with(packages_root) {
        FileKind::Package
    } else if path.starts_with(root.join("config")) {
        FileKind::ConfigProfile
    } else {
        FileKind::MatchFile
    };

    let disabled = path
        .file_name()
        .and_then(OsStr::to_str)
        .is_some_and(|name| name.starts_with('_'));

    let relative_path = path
        .strip_prefix(root)
        .map(Path::to_path_buf)
        .unwrap_or_else(|_| path.clone());

    DiscoveredFile {
        path,
        kind,
        relative_path,
        disabled,
    }
} // End of function classify()

/// Recursively appends every YAML file under `dir` to `out`.
///
/// A missing directory is not an error: a user may legitimately have `match/`
/// but no `config/` yet. Symlinked directories are not followed, to avoid
/// cycles and to keep the editor from wandering outside the config tree.
fn collect_yaml_files(dir: &Path, out: &mut Vec<PathBuf>) -> Result<(), DiscoveryError> {
    if !dir.is_dir() {
        return Ok(());
    }

    let entries = std::fs::read_dir(dir).map_err(|source| DiscoveryError::Io {
        path: dir.to_path_buf(),
        source,
    })?;

    for entry in entries {
        let entry = entry.map_err(|source| DiscoveryError::Io {
            path: dir.to_path_buf(),
            source,
        })?;
        let path = entry.path();
        // `symlink_metadata` rather than `metadata`: a symlinked directory is
        // skipped instead of followed, which would risk a cycle.
        let metadata = std::fs::symlink_metadata(&path).map_err(|source| DiscoveryError::Io {
            path: path.clone(),
            source,
        })?;

        if metadata.is_dir() {
            collect_yaml_files(&path, out)?;
        } else if metadata.is_file() && has_yaml_extension(&path) {
            out.push(path);
        }
    }
    Ok(())
} // End of function collect_yaml_files()

/// Returns `true` for `.yml` and `.yaml`, case-insensitively.
fn has_yaml_extension(path: &Path) -> bool {
    path.extension()
        .and_then(OsStr::to_str)
        .is_some_and(|ext| ext.eq_ignore_ascii_case("yml") || ext.eq_ignore_ascii_case("yaml"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    /// Builds a synthetic espanso tree in a temp directory.
    ///
    /// Deliberately never touches the owner's real configuration: these tests
    /// must pass identically on a machine with no espanso installed.
    fn synthetic_tree() -> TempDir {
        let dir = TempDir::new().expect("temp dir");
        let root = dir.path();

        fs::create_dir_all(root.join("config")).unwrap();
        fs::create_dir_all(root.join("match").join("packages").join("all-emojis")).unwrap();
        fs::create_dir_all(root.join("match").join("scoped")).unwrap();

        fs::write(root.join("config").join("default.yml"), "backend: auto\n").unwrap();
        fs::write(
            root.join("config").join("terminal.yml"),
            "filter_title: Term\n",
        )
        .unwrap();
        fs::write(root.join("match").join("base.yml"), "matches: []\n").unwrap();
        fs::write(root.join("match").join("_disabled.yml"), "matches: []\n").unwrap();
        fs::write(
            root.join("match").join("scoped").join("nested.yml"),
            "matches: []\n",
        )
        .unwrap();
        fs::write(
            root.join("match")
                .join("packages")
                .join("all-emojis")
                .join("package.yml"),
            "matches: []\n",
        )
        .unwrap();
        // Noise that must be ignored: wrong extension, and a directory outside
        // config/ and match/.
        fs::write(root.join("match").join("notes.txt"), "not yaml\n").unwrap();
        fs::create_dir_all(root.join("runtime")).unwrap();
        fs::write(root.join("runtime").join("state.yml"), "ignored: true\n").unwrap();

        dir
    } // End of function synthetic_tree()

    fn names(tree: &ConfigTree) -> Vec<String> {
        tree.files
            .iter()
            .map(|file| file.relative_path.to_string_lossy().replace('\\', "/"))
            .collect()
    }

    #[test]
    fn explicit_override_wins_over_both_environment_candidates() {
        let dir = synthetic_tree();
        let other = TempDir::new().unwrap();
        let resolved =
            resolve_config_dir(Some(dir.path()), Some(other.path()), Some(other.path())).unwrap();
        assert_eq!(resolved, dir.path());
    }

    #[test]
    fn a_bad_explicit_override_errors_instead_of_falling_back() {
        // Falling back here would silently edit a different config than the one
        // the user pointed at, which is worse than an error message.
        let home = TempDir::new().unwrap();
        fs::create_dir_all(home.path().join("Library/Application Support/espanso")).unwrap();
        let missing = home.path().join("does-not-exist");

        let error = resolve_config_dir(Some(&missing), None, Some(home.path())).unwrap_err();
        assert!(matches!(error, DiscoveryError::NotADirectory(path) if path == missing));
    }

    #[test]
    fn xdg_config_home_is_probed_before_the_macos_location() {
        let xdg = TempDir::new().unwrap();
        let home = TempDir::new().unwrap();
        fs::create_dir_all(xdg.path().join("espanso")).unwrap();
        fs::create_dir_all(home.path().join("Library/Application Support/espanso")).unwrap();

        let resolved = resolve_config_dir(None, Some(xdg.path()), Some(home.path())).unwrap();
        assert_eq!(resolved, xdg.path().join("espanso"));
    }

    #[test]
    fn falls_back_to_the_macos_application_support_location() {
        let xdg = TempDir::new().unwrap();
        let home = TempDir::new().unwrap();
        let expected = home.path().join("Library/Application Support/espanso");
        fs::create_dir_all(&expected).unwrap();

        // XDG is set but holds no espanso directory.
        let resolved = resolve_config_dir(None, Some(xdg.path()), Some(home.path())).unwrap();
        assert_eq!(resolved, expected);
    }

    #[test]
    fn reports_every_candidate_when_nothing_is_found() {
        let xdg = TempDir::new().unwrap();
        let home = TempDir::new().unwrap();
        let error = resolve_config_dir(None, Some(xdg.path()), Some(home.path())).unwrap_err();
        match error {
            DiscoveryError::ConfigDirNotFound { candidates } => {
                assert_eq!(candidates.len(), 2);
                assert_eq!(candidates[0], xdg.path().join("espanso"));
                assert!(candidates[1].ends_with("Library/Application Support/espanso"));
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }

    #[test]
    fn enumerate_finds_only_yaml_under_config_and_match() {
        let dir = synthetic_tree();
        let tree = enumerate(dir.path()).unwrap();
        assert_eq!(
            names(&tree),
            vec![
                "config/default.yml",
                "config/terminal.yml",
                "match/_disabled.yml",
                "match/base.yml",
                "match/packages/all-emojis/package.yml",
                "match/scoped/nested.yml",
            ]
        );
    }

    #[test]
    fn classification_matches_the_espanso_layout_rules() {
        let dir = synthetic_tree();
        let tree = enumerate(dir.path()).unwrap();

        let by_name = |name: &str| {
            tree.files
                .iter()
                .find(|file| file.relative_path.to_string_lossy().replace('\\', "/") == name)
                .unwrap_or_else(|| panic!("missing {name}"))
                .clone()
        };

        assert_eq!(by_name("config/default.yml").kind, FileKind::ConfigProfile);
        assert_eq!(by_name("match/base.yml").kind, FileKind::MatchFile);
        assert_eq!(by_name("match/scoped/nested.yml").kind, FileKind::MatchFile);
        assert_eq!(
            by_name("match/packages/all-emojis/package.yml").kind,
            FileKind::Package
        );
    }

    #[test]
    fn underscore_prefixed_files_are_flagged_disabled_but_still_listed() {
        let dir = synthetic_tree();
        let tree = enumerate(dir.path()).unwrap();

        let disabled: Vec<&str> = tree
            .files
            .iter()
            .filter(|file| file.disabled)
            .map(DiscoveredFile::file_name)
            .collect();
        assert_eq!(disabled, vec!["_disabled.yml"]);

        let base = tree
            .files
            .iter()
            .find(|file| file.file_name() == "base.yml")
            .unwrap();
        assert!(!base.disabled);
    }

    #[test]
    fn packages_are_read_only_and_excluded_from_editable() {
        let dir = synthetic_tree();
        let tree = enumerate(dir.path()).unwrap();

        assert_eq!(tree.of_kind(FileKind::Package).count(), 1);
        assert!(tree
            .of_kind(FileKind::Package)
            .all(|file| file.kind.is_read_only()));
        assert!(tree.editable().all(|file| file.kind != FileKind::Package));
        assert_eq!(tree.editable().count(), 5);
    }

    #[test]
    fn a_root_without_config_or_match_enumerates_empty_rather_than_failing() {
        // A fresh espanso install can have only one of the two directories.
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join("match")).unwrap();
        let tree = enumerate(dir.path()).unwrap();
        assert!(tree.files.is_empty());
    }

    #[test]
    fn enumerate_rejects_a_path_that_is_not_a_directory() {
        let dir = TempDir::new().unwrap();
        let file = dir.path().join("plain.txt");
        fs::write(&file, "x").unwrap();
        assert!(matches!(
            enumerate(&file),
            Err(DiscoveryError::NotADirectory(_))
        ));
    }

    #[test]
    fn yaml_extension_check_is_case_insensitive_and_rejects_others() {
        assert!(has_yaml_extension(Path::new("a/base.yml")));
        assert!(has_yaml_extension(Path::new("a/base.YAML")));
        assert!(!has_yaml_extension(Path::new("a/base.yml.tmp")));
        assert!(!has_yaml_extension(Path::new("a/base")));
    }
}
