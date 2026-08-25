//! The native hint source — `notify`, confined to this module.
//!
//! **No other module may import `notify`**, exactly as `saphyr-parser` is
//! confined to `crate::syntax`: the native backend contributes **path hints
//! and nothing else**, and everything the hints mean — debounce, stability,
//! hashing, projection, membership — is decided by the engine in
//! [`crate::watch::engine`], deterministic in observation shapes, revisions
//! and order (its module docs qualify the identity values inside a
//! projection). That split is what keeps the hard part testable
//! with no filesystem and no timer, and it is why nothing here interprets a
//! `notify::EventKind`: an event kind is a claim about what happened, the
//! engine re-derives what happened from reads, and forwarding the claim would
//! invite someone to trust it.
//!
//! # What this module does and does not promise
//!
//! It watches exactly [`crate::watch::watched_roots`] — `<root>/config` and
//! `<root>/match`, recursively — and forwards every event's paths to the
//! caller's sink, on the backend's own thread. It does **not** promise one
//! event per write, delivery order, delivery at all for every write, or that a
//! forwarded path still exists. A backend error is forwarded as
//! [`NativeSignal::Degraded`] so the caller can fall back to the engine's
//! rescan; a root that cannot be watched at all is reported in
//! [`NativeWatch::unavailable`] at start, because a fresh espanso install may
//! legitimately have only one of the two directories.
//!
//! **An event that says the backend dropped events is degradation, not a
//! hint.** `notify` forwards a backend's dropped-events condition — on macOS,
//! FSEvents' `MustScanSubDirs` after a kernel or user-space queue overflow —
//! as a successful event flagged `Rescan`, whose paths name directories to
//! sweep rather than files that changed. Forwarding those paths as hints
//! would let the engine's own YAML/root filter silently discard the one
//! notification that writes were missed, so [`signal_of`] maps any
//! rescan-flagged event to [`NativeSignal::Degraded`]: the caller's rescan is
//! exactly the sweep the flag demands.
//!
//! # Lifetime
//!
//! Dropping the [`NativeWatch`] stops the backend and its callbacks. Who holds
//! it, when it is replaced, and how a late callback from a replaced watcher is
//! discarded are the open-workspace lifecycle's questions (2d-2, in
//! `src-tauri`); this module answers none of them, and its principal
//! real-filesystem integration test lives there for the same reason (the 2d
//! design consult's Q7 item 2).

use std::fmt;
use std::path::{Path, PathBuf};

use notify::{RecommendedWatcher, RecursiveMode, Watcher};

use crate::watch::watched_roots;

/// What the native backend contributes: hints and degradation, never truth.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NativeSignal {
    /// Paths the backend says may have changed. Hints — the engine decides
    /// what, if anything, they mean, and filters them itself.
    Hints(Vec<PathBuf>),
    /// The backend reported an error. The text is diagnostic, for a log line
    /// only — it never crosses the IPC boundary, which carries codes and
    /// operands, never rendered prose. What a caller acts on is the fact of
    /// degradation: schedule rescans until a healthy watch is re-established.
    Degraded(String),
}

/// Why the native watcher could not be created at all.
///
/// Distinct from a root that could not be watched: this is the backend itself
/// refusing to exist, and there is nothing to hold or drop.
#[derive(Debug)]
pub struct NativeWatchError {
    /// Diagnostic text from the backend, for a log line only.
    pub reason: String,
}

impl fmt::Display for NativeWatchError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "native watcher unavailable: {}", self.reason)
    }
}

impl std::error::Error for NativeWatchError {}

/// Maps one backend delivery onto the signal a caller acts on.
///
/// Three arms, and the middle one is the reason this function exists as a
/// testable value rather than inline in the callback: an `Ok` event whose
/// rescan flag is set means the backend **dropped events** and demands a
/// sweep — its paths name directories, which the engine's hint filter would
/// drop — so it is degradation, never hints. An ordinary event contributes
/// its paths as hints; a backend error is degradation with its diagnostic
/// text.
fn signal_of(event: Result<notify::Event, notify::Error>) -> NativeSignal {
    match event {
        Ok(event) if event.need_rescan() => NativeSignal::Degraded(
            "the backend reported dropped events and demands a rescan".to_string(),
        ),
        Ok(event) => NativeSignal::Hints(event.paths),
        Err(error) => NativeSignal::Degraded(error.to_string()),
    }
} // End of function signal_of()

/// A running native watcher over the two watched roots.
///
/// Keeps the backend alive; dropping it stops the callbacks. There is no
/// method to add or remove roots, on purpose — the watch scope is
/// [`watched_roots`]'s one rule, and a second scope would need the larger
/// proof the 2d design consult's Q2 declines.
pub struct NativeWatch {
    /// Held for its lifetime only.
    _watcher: RecommendedWatcher,
    established: Vec<PathBuf>,
    unavailable: Vec<(PathBuf, String)>,
}

impl NativeWatch {
    /// Starts watching `<root>/config` and `<root>/match` recursively,
    /// forwarding signals to `sink` on the backend's own thread.
    ///
    /// Each root is attempted independently: a missing `config/` must not cost
    /// the watch on `match/`. A root the backend refused is recorded in
    /// [`NativeWatch::unavailable`] with diagnostic text, and a caller with
    /// any entry there — or with an empty [`NativeWatch::established`] — needs
    /// the engine's rescan as its fallback.
    ///
    /// # Errors
    ///
    /// [`NativeWatchError`] when the backend itself cannot be created.
    pub fn start(
        root: &Path,
        mut sink: impl FnMut(NativeSignal) + Send + 'static,
    ) -> Result<NativeWatch, NativeWatchError> {
        let mut watcher =
            notify::recommended_watcher(move |event: Result<notify::Event, notify::Error>| {
                sink(signal_of(event))
            })
            .map_err(|error| NativeWatchError {
                reason: error.to_string(),
            })?;
        let mut established = Vec::new();
        let mut unavailable = Vec::new();
        for directory in watched_roots(root) {
            match watcher.watch(&directory, RecursiveMode::Recursive) {
                Ok(()) => established.push(directory),
                Err(error) => unavailable.push((directory, error.to_string())),
            }
        } // End of the loop over the two watched roots
        Ok(NativeWatch {
            _watcher: watcher,
            established,
            unavailable,
        })
    } // End of function start()

    /// The roots the backend accepted.
    pub fn established(&self) -> &[PathBuf] {
        &self.established
    }

    /// The roots the backend refused, with diagnostic text for a log line.
    pub fn unavailable(&self) -> &[(PathBuf, String)] {
        &self.unavailable
    }
}

impl fmt::Debug for NativeWatch {
    /// Hand-written because the backend type offers no `Debug` of its own.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("NativeWatch")
            .field("established", &self.established)
            .field("unavailable", &self.unavailable)
            .finish_non_exhaustive()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    /// A sink that drops everything; delivery is deliberately not asserted
    /// here — the real-filesystem integration test belongs to the lifecycle
    /// step in `src-tauri` (2d design consult, Q7 item 2), and a timing-based
    /// assertion here would be the flaky half of that test without its
    /// authority.
    fn discard(_: NativeSignal) {}

    #[test]
    fn both_existing_roots_are_established() {
        let dir = TempDir::new().expect("temp dir");
        fs::create_dir_all(dir.path().join("config")).unwrap();
        fs::create_dir_all(dir.path().join("match")).unwrap();
        let watch = NativeWatch::start(dir.path(), discard).expect("a native watcher");
        assert_eq!(watch.established(), watched_roots(dir.path()).to_vec());
        assert!(watch.unavailable().is_empty());
    }

    #[test]
    fn a_missing_root_is_reported_without_costing_the_other() {
        let dir = TempDir::new().expect("temp dir");
        fs::create_dir_all(dir.path().join("match")).unwrap();
        let watch = NativeWatch::start(dir.path(), discard).expect("a native watcher");
        assert_eq!(watch.established(), vec![dir.path().join("match")]);
        assert_eq!(watch.unavailable().len(), 1);
        assert_eq!(watch.unavailable()[0].0, dir.path().join("config"));
    }

    #[test]
    fn a_root_with_neither_directory_starts_degraded_rather_than_failing() {
        let dir = TempDir::new().expect("temp dir");
        let watch = NativeWatch::start(dir.path(), discard).expect("a native watcher");
        assert!(watch.established().is_empty());
        assert_eq!(watch.unavailable().len(), 2);
    }

    #[test]
    fn an_ordinary_event_becomes_hints_carrying_its_paths() {
        let event = notify::Event::new(notify::EventKind::Any)
            .add_path(PathBuf::from("/somewhere/base.yml"));
        assert_eq!(
            signal_of(Ok(event)),
            NativeSignal::Hints(vec![PathBuf::from("/somewhere/base.yml")])
        );
    }

    #[test]
    fn a_rescan_flagged_event_is_degradation_not_hints() {
        // The shape notify emits for FSEvents' MustScanSubDirs: a successful
        // event, flagged Rescan, whose paths name directories to sweep. Were
        // it forwarded as hints, the engine's YAML filter would silently drop
        // the one notification that writes were missed.
        let event = notify::Event::new(notify::EventKind::Other)
            .add_path(PathBuf::from("/somewhere"))
            .set_flag(notify::event::Flag::Rescan);
        assert!(matches!(signal_of(Ok(event)), NativeSignal::Degraded(_)));
    }

    #[test]
    fn a_backend_error_is_degradation_with_its_text() {
        let error = notify::Error::generic("the backend gave up");
        let NativeSignal::Degraded(reason) = signal_of(Err(error)) else {
            panic!("a backend error must map to Degraded");
        };
        assert!(reason.contains("the backend gave up"));
    }
}
