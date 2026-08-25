//! The open-workspace watcher lifecycle — Phase 2d-2.
//!
//! `espansoconfig_core::watch` owns everything a filesystem observation *means*
//! — debounce, stability, hashing, projection, membership — and this module
//! owns the one thing the core deliberately does not: **the lifetime of a
//! running watcher beside the open workspace** (the 2d design consult's Q1 and
//! Q7 item 2). One [`WatcherLifecycle`] exists per open workspace, holding one
//! worker thread that drives one [`ObservationEngine`] with the real clock and
//! the real filesystem. On a successful `open_workspace` the previous lifecycle
//! is **cancelled and joined before that open returns whenever that open runs
//! anywhere but the replaced watcher's own worker thread** — after its
//! successor is installed and the session lock is released, never under the
//! lock, because the worker calls the injected sink and a sink is allowed to
//! call back into the session. A sink callback may go further and tear its own
//! watcher down — by calling `open` itself, or by dropping the last strong
//! session reference — and a thread cannot join itself, so exactly that case
//! hands the join to the **reaper** instead of claiming a join-before-return
//! it cannot give ([`WatcherLifecycle`]'s `Drop` states both cases). On a
//! failed open the previous lifecycle is kept, exactly as the workspace it
//! watches is kept; dropping the session drops it. Replacement and application
//! shutdown are the only two close events, because there is no separate close
//! command.
//!
//! # Epochs
//!
//! Every observation the worker hands to its sink is tagged with the
//! **workspace epoch** the session assigned when it started this watcher
//! ([`EpochObservation`]). The session mints epochs through one
//! [`WorkspaceEpochs`] allocator — [`FIRST_WORKSPACE_EPOCH`] first, then the
//! next value for each successful replacement, checked and **never reused**:
//! an exhausted allocator answers [`EpochSpaceExhausted`] forever rather than
//! saturating, and the workspace then watches nothing
//! ([`WatcherLifecycle::without_epoch`]), because an observation that cannot
//! be attributed to a distinct epoch must not be produced. A replaced watcher
//! is joined **before the open that replaced it returns** — except when that
//! open ran inside the replaced worker's own sink callback, where the join is
//! the reaper's and the worker exits only after the initiating callback
//! returns and its engine pass completes, so observations of the replaced
//! epoch can outlive that one open's return. The tag on each observation is
//! what tells the epochs apart: there, during any in-flight replacement, and
//! again at 2d-4's shared queue once observations outlive their watcher. A
//! late native callback from a replaced watcher finds its channel gone and is
//! discarded before it can name a document (consult Q1).
//!
//! # The polling fallback is a fallback
//!
//! Consult Q1: polling is for an **unavailable native backend, never the
//! primary mechanism**. The worker engages the rescan cadence in exactly three
//! cases — the native backend could not be created at all, a watched root
//! could not be watched (a fresh espanso install may legitimately have only
//! one of the two directories), or the running backend reported an error
//! ([`NativeSignal::Degraded`]) — and in no other. A healthy watch never
//! rescans on a timer. Once engaged, polling persists for the life of this
//! watcher: nothing re-probes the native backend, so a healthy watch returns
//! with the next workspace open. That is a stated cost, not an accident.
//!
//! # What this module must not do yet
//!
//! **No wire.** Nothing here emits a Tauri event, holds a queue, or answers a
//! command — the wake event and `drain_external_changes` are Phase 2d-4's
//! (consult Q3) — and nothing here compares an observation against an
//! app-write ledger, which is Phase 2d-3's. Until 2d-4 wires the queue, the
//! production sink is [`discarding_sink`]: observations are produced and
//! dropped, which is this project's established primitive-before-caller cut —
//! the lifecycle exists and is tested before anything consumes it, exactly as
//! `persist::save_document` existed at 2a with no command behind it.

use std::fmt;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, RecvTimeoutError, Sender, TryRecvError};
use std::sync::{Arc, OnceLock};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use espansoconfig_core::watch::engine::{
    EngineConfig, FsWatchSource, Millis, Observation, ObservationEngine,
};
use espansoconfig_core::watch::native::{NativeSignal, NativeWatch};
use espansoconfig_core::watch::watched_roots;

/// The epoch the session's first successful open assigns.
///
/// One rather than zero, so that a zero read anywhere downstream can only mean
/// *unset* and never a real epoch — the same reason `ContentRevision` refuses
/// malformed hex instead of defaulting it.
pub const FIRST_WORKSPACE_EPOCH: u64 = 1;

/// The epoch value a lifecycle that holds no epoch reports: zero, the value
/// [`FIRST_WORKSPACE_EPOCH`]'s contract reserves to mean *unset* and never a
/// real epoch.
///
/// Only [`WatcherLifecycle::without_epoch`] reports it, only through
/// [`WatchStatusView`], and it never tags an observation — a lifecycle with no
/// epoch has no worker, so it produces nothing to tag.
pub const NO_EPOCH: u64 = 0;

/// The default rescan cadence when the polling fallback is engaged, in
/// milliseconds.
///
/// Comfortably above [`LifecycleConfig`]'s starvation floor for the default
/// engine timing (2 × (200 + 40) = 480), and slow enough that a degraded
/// backend costs one directory walk every two seconds rather than a busy loop.
pub const DEFAULT_POLL_MS: u64 = 2000;

/// How long the worker parks when nothing is pending and nothing polls.
///
/// A bound for hygiene, not a schedule: a native hint or a stop request is a
/// channel message and wakes the worker immediately, so the only thing this
/// number decides is how often an entirely idle worker confirms it is idle.
const QUIET_PARK_MS: u64 = 60_000;

/// How long the reaper parks between finish sweeps while it holds the handle
/// of any worker that has not yet exited, in milliseconds.
///
/// Short enough that a worker's completion handshake stores within about one
/// interval of its exit — the teardown tests poll their join probes on a
/// comparable cadence — and long enough that a reaper holding one permanently
/// parked worker's handle costs a wakeup and a sweep per interval, never a
/// busy loop. While the reaper holds no handle it does not wake at all: it
/// blocks on its channel.
const REAPER_SCAN_MS: u64 = 50;

/// One core observation, tagged with the workspace epoch of the watcher that
/// produced it.
///
/// The epoch is the session's, assigned at [`WatcherLifecycle::start`]; the
/// observation is the engine's, meaning exactly what
/// [`Observation`] documents. Nothing else travels — sequences are facts about
/// 2d-4's queue and are deliberately absent here.
// Read by `crate::watch_check` today and by 2d-4's queue in production; the
// allow is scoped to non-test builds so the fields stay lint-armed exactly
// where their consumers exist.
#[cfg_attr(not(test), allow(dead_code))]
#[derive(Debug)]
pub struct EpochObservation {
    /// The workspace epoch under which this observation was produced.
    pub epoch: u64,
    /// The engine's stabilized conclusion.
    pub observation: Observation,
}

/// Where a watcher's observations go.
///
/// An `Arc` so the session can hand the same sink to every watcher it starts
/// across replacements; `Send + Sync` because the worker calls it from its own
/// thread — synchronously, so a callback that never returns hangs its own
/// worker. A callback is allowed to call back into the session, up to and
/// including tearing its own watcher down — re-entering `open`, or dropping
/// the last strong session reference — and that teardown then routes its join
/// through the reaper rather than joining the running worker on itself (see
/// [`WatcherLifecycle`]'s `Drop`). Phase 2d-4's queue is the intended
/// production implementation; until then the production sink is
/// [`discarding_sink`] and tests inject a channel.
pub type ObservationSink = Arc<dyn Fn(EpochObservation) + Send + Sync>;

/// The production sink until Phase 2d-4 wires the queue: it drops every
/// observation.
///
/// Deliberate and stated rather than smoothed over — the lifecycle is built
/// and tested before its consumer exists, and a sink that pretended to store
/// anything would be a queue built one phase early. Until that consumer
/// exists, observations are produced and deliberately unconsumed in
/// production: a value this sink drops is gone, and no present code recovers
/// it. Whatever recovery 2d-4 offers is 2d-4's to build and to claim.
pub fn discarding_sink() -> ObservationSink {
    Arc::new(|_| {})
}

/// A session's workspace-epoch allocator — checked, and it never hands out
/// the same value twice.
///
/// One per session, asked once per successful open. A `saturating_add` here
/// was round 1's shape and is exactly the defect: pinned at `u64::MAX`, every
/// later successful replacement would reuse that epoch, and once observations
/// outlive their watcher (2d-4's queue) equal epochs stop distinguishing a
/// replaced workspace from its replacement. Exhaustion is therefore a typed
/// terminal state, never a wrap and never a saturate:
/// [`WorkspaceEpochs::allocate`] answers [`EpochSpaceExhausted`] forever once
/// the space is spent, and the caller's policy is written at its one call
/// site — the open still succeeds, and its workspace watches nothing
/// ([`WatcherLifecycle::without_epoch`]).
#[derive(Debug)]
pub struct WorkspaceEpochs {
    /// The next epoch to hand out; `None` once the space is exhausted.
    next: Option<u64>,
}

impl WorkspaceEpochs {
    /// An allocator whose first answer is [`FIRST_WORKSPACE_EPOCH`].
    pub fn new() -> WorkspaceEpochs {
        WorkspaceEpochs {
            next: Some(FIRST_WORKSPACE_EPOCH),
        }
    }

    /// An allocator whose next answer is `next` — the boundary tests' seam.
    #[cfg(test)]
    pub(crate) fn starting_at(next: u64) -> WorkspaceEpochs {
        WorkspaceEpochs { next: Some(next) }
    }

    /// The next epoch, distinct from every epoch this allocator has answered.
    ///
    /// # Errors
    ///
    /// [`EpochSpaceExhausted`], forever, once `u64` is spent. Unreachable in
    /// any physical execution — one allocation per successful workspace open
    /// does not exhaust `u64` in a process lifetime — but reachable by
    /// construction, so the arm is typed rather than hoped away.
    pub fn allocate(&mut self) -> Result<u64, EpochSpaceExhausted> {
        let epoch = self.next.ok_or(EpochSpaceExhausted)?;
        self.next = epoch.checked_add(1);
        Ok(epoch)
    }
}

impl Default for WorkspaceEpochs {
    /// [`WorkspaceEpochs::new`].
    fn default() -> WorkspaceEpochs {
        WorkspaceEpochs::new()
    }
}

/// A session has minted every epoch `u64` can carry.
///
/// Never serialized and never shown to a user — like
/// [`LifecycleConfigError`], it crosses no boundary and owes no dictionary
/// entry. The one call site's policy: the open succeeds and the workspace
/// watches nothing, because a watcher whose observations could not be
/// attributed must not observe.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EpochSpaceExhausted;

/// The lifecycle's two timing parameters, validated at construction.
///
/// The engine's own [`EngineConfig`] plus the rescan cadence the polling
/// fallback uses. They are validated **together** because they interact: a
/// rescan re-hints every listed and tracked path, the engine's debounce is
/// trailing-edge, and so a poll interval at or below the debounce window
/// re-hints everything before anything can stabilize — a poller fast enough
/// starves the pipeline it exists to feed, forever, with nothing failing.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LifecycleConfig {
    engine: EngineConfig,
    poll_ms: u64,
}

/// Why a [`LifecycleConfig`] was refused.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LifecycleConfigError {
    /// The poll interval is under twice the debounce-plus-probe span, so a
    /// rescan could re-hint paths before their previous rescan's hints
    /// stabilize. The factor of two is margin for tick scheduling, not a
    /// derived constant; the hard floor is one debounce plus one probe.
    ///
    /// Never serialized and never shown to a user: this is a programmer error
    /// at construction, caught by `cargo test`, not a code that crosses the
    /// IPC boundary — which is why it owes no dictionary entry.
    PollWouldStarveTheDebounce {
        /// The interval that was asked for, in milliseconds.
        requested_ms: u64,
        /// The smallest interval this engine timing accepts, in milliseconds.
        minimum_ms: u64,
    },
}

impl LifecycleConfig {
    /// Validates and builds a configuration.
    ///
    /// # Errors
    ///
    /// [`LifecycleConfigError::PollWouldStarveTheDebounce`] when `poll_ms` is
    /// under `2 × (debounce + probe)` for the given engine timing.
    pub fn new(
        engine: EngineConfig,
        poll_ms: u64,
    ) -> Result<LifecycleConfig, LifecycleConfigError> {
        let minimum_ms = 2 * (engine.debounce_ms() + engine.probe_ms());
        if poll_ms < minimum_ms {
            return Err(LifecycleConfigError::PollWouldStarveTheDebounce {
                requested_ms: poll_ms,
                minimum_ms,
            });
        }
        Ok(LifecycleConfig { engine, poll_ms })
    } // End of function new()

    /// The engine timing this lifecycle runs its engine under.
    // Read by this module's own tests today; production reads the field. The
    // allow is scoped to non-test builds so the accessor stays lint-armed
    // where its consumers exist.
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn engine(&self) -> EngineConfig {
        self.engine
    }

    /// The rescan cadence the polling fallback uses, in milliseconds.
    // Same scoped allow, same reason, as [`LifecycleConfig::engine`].
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn poll_ms(&self) -> u64 {
        self.poll_ms
    }
}

impl Default for LifecycleConfig {
    /// The engine's default timing (200/40) and [`DEFAULT_POLL_MS`].
    fn default() -> LifecycleConfig {
        LifecycleConfig::new(EngineConfig::default(), DEFAULT_POLL_MS)
            .expect("the default poll interval is above the starvation floor")
    }
}

/// One watcher's state, observed.
///
/// An observability accessor's answer, not a control surface (`PROGRESS.md`
/// R24: a property nothing can observe is a property nothing can test). The
/// integration checks in `crate::watch_check` read it to wait for a baseline
/// and to see the fallback engage; nothing in production reads it yet.
// Read by `crate::watch_check` today; nothing in production reads it yet, and
// the allow is scoped to non-test builds so it stays lint-armed where its
// consumers exist.
#[cfg_attr(not(test), allow(dead_code))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WatchStatusView {
    /// The workspace epoch this watcher tags its observations with —
    /// [`NO_EPOCH`] (zero, never a real epoch) for a lifecycle started
    /// without one, which has no worker and tags nothing.
    pub epoch: u64,
    /// Whether the baseline scan has completed and the worker is in its loop.
    /// `false` forever when the worker thread could not be spawned or the
    /// lifecycle is stationary.
    ///
    /// **It claims nothing about the native backend's ability to deliver** —
    /// no API reports that. What holds instead is the worker's ordering: the
    /// native stream is live before the baseline reads a byte (see
    /// `WatchWorker::run`), and every failure the backend *reports* engages
    /// the polling fallback.
    pub ready: bool,
    /// Whether the polling fallback is engaged. `true` only after a native
    /// failure — at start or reported later — and never on a healthy watch.
    pub polling: bool,
}

/// The flags the worker publishes and the lifecycle handle reads.
#[derive(Debug, Default)]
struct SharedStatus {
    ready: AtomicBool,
    polling: AtomicBool,
}

/// What the worker's one inbox can carry.
enum WorkerMessage {
    /// A signal forwarded by the native backend's callback.
    Native(NativeSignal),
    /// The lifecycle handle is shutting this worker down.
    Stop,
}

/// Re-spells backend-reported paths onto the workspace's own root spelling.
///
/// The engine compares hint paths to tracked paths **byte for byte**, and the
/// paths it tracks are spelled the way discovery spelled them — through
/// whatever the workspace root the user opened is called. A native backend is
/// under no such obligation: macOS FSEvents reports **resolved** paths, so a
/// root reached through a symlinked ancestor (`/var/folders/…`, whose `/var`
/// is a symlink to `/private/var`, is every temp directory on macOS) delivers
/// hints the engine's filter would drop as outside the watched roots.
/// Reconciling the backend's spelling with discovery's is exactly the
/// lifecycle obligation `docs/decisions/2d-1-notes.md` §5 item 3 leaves here.
///
/// The reconciliation is deliberately narrow: each watched root is
/// canonicalized **once, at watcher start**, and a hint under a root's
/// canonical form is re-prefixed onto its spelled form. Nothing below the root
/// is resolved — discovery refuses symlinked intermediates inside the tree, so
/// a hint that differs from every tracked path below the root is a hint about
/// a path the walk cannot reach, and dropping it is the correct answer. A root
/// that does not exist at start has no canonical form and no alias; the
/// polling fallback covers it. What this cannot fix, stated plainly: a backend
/// spelling that differs by case only, or a root whose symlinked ancestor is
/// created *after* start, still misses — the engine's own §5 item 3 residue.
struct HintSpelling {
    /// `(canonical form, spelled form)` for each watched root whose two forms
    /// differ. Empty on the common production path, where the espanso
    /// configuration directory contains no symlinked ancestor.
    aliases: Vec<(PathBuf, PathBuf)>,
}

impl HintSpelling {
    /// Captures the canonical-to-spelled mapping for `root`'s watched roots.
    fn of(root: &Path) -> HintSpelling {
        let aliases = watched_roots(root)
            .into_iter()
            .filter_map(|spelled| {
                let canonical = std::fs::canonicalize(&spelled).ok()?;
                (canonical != spelled).then_some((canonical, spelled))
            })
            .collect();
        HintSpelling { aliases }
    }

    /// `path` re-spelled onto the workspace's root spelling when the backend
    /// reported it through a root's canonical form; otherwise unchanged.
    fn respell(&self, path: PathBuf) -> PathBuf {
        for (canonical, spelled) in &self.aliases {
            if let Ok(below) = path.strip_prefix(canonical) {
                return spelled.join(below);
            }
        }
        path
    }
}

/// A running watcher over one open workspace, cancelled and joined by value.
///
/// Constructed by [`WatcherLifecycle::start`] — or stationary, by
/// [`WatcherLifecycle::without_epoch`] when no epoch could be minted — and
/// stopped exactly two ways: [`WatcherLifecycle::shut_down`] at the
/// replacement site, and [`Drop`] everywhere else. Both send the worker a
/// stop message and **join it**, and which thread performs the join is what
/// the teardown decides ([`Drop`]'s impl doc carries both cases): from any
/// thread other than the worker's own, the join runs in place — when the
/// call returns, the worker has exited, its native backend is dropped, and
/// nothing of this epoch can reach the sink again. From the worker's own
/// sink callback — a callback-initiated replacement or final drop — a thread
/// cannot join itself, so the join is handed to the reaper and the call
/// returns without waiting; the worker then exits after the initiating
/// callback returns and its engine pass completes, and until it does,
/// observations of this epoch can still reach the sink, tagged so a consumer
/// can tell them from a successor's.
#[derive(Debug)]
pub struct WatcherLifecycle {
    epoch: u64,
    control: Sender<WorkerMessage>,
    worker: Option<JoinHandle<()>>,
    // Read only through `WatcherLifecycle::status`; see the scoped allow there.
    #[cfg_attr(not(test), allow(dead_code))]
    status: Arc<SharedStatus>,
    /// `true` once this lifecycle's join has returned — stored by the
    /// dropping thread ordinarily, by the reaper on a callback-initiated
    /// teardown, and immediately when there was never a worker to join.
    /// Production writes it and never reads it; the test-only join probe is
    /// its reader, and it exists because a teardown whose completion nothing
    /// can observe is a teardown nothing can test (`PROGRESS.md` R24).
    joined: Arc<AtomicBool>,
}

impl WatcherLifecycle {
    /// Starts a watcher over `root`, tagging everything it observes with
    /// `epoch` and handing it to `sink`.
    ///
    /// Returns immediately: the native watch, the baseline scan and the loop
    /// all run on the worker thread, so an `open_workspace` never waits for a
    /// directory walk it did not ask for. The worker establishes the native
    /// watch **before** the baseline scan — a write that lands during the
    /// baseline is hinted and re-examined, and one that lands before both is
    /// the baseline's to see.
    ///
    /// **A worker that cannot be spawned watches nothing**, and the returned
    /// lifecycle says so observably: [`WatcherLifecycle::status`] answers
    /// `ready: false` forever. The open itself must not fail for it — this
    /// application browsed and edited files for two whole phases with no
    /// watcher, so a missing watcher degrades reconciliation, not the session.
    /// Thread-spawn failure is resource exhaustion, and refusing the workspace
    /// over it would trade a degraded watcher for a dead window.
    pub fn start(
        root: &Path,
        epoch: u64,
        config: LifecycleConfig,
        sink: ObservationSink,
    ) -> WatcherLifecycle {
        let (control, inbox) = std::sync::mpsc::channel();
        let status = Arc::new(SharedStatus::default());
        let worker = {
            let hints = control.clone();
            let status = Arc::clone(&status);
            let root = root.to_path_buf();
            std::thread::Builder::new()
                .name("espansoconfig-watch".into())
                .spawn(move || {
                    WatchWorker {
                        root,
                        epoch,
                        config,
                        sink,
                        status,
                        origin: Instant::now(),
                        source: FsWatchSource,
                        next_poll: None,
                    }
                    .run(inbox, hints)
                })
                .ok()
        };
        WatcherLifecycle {
            epoch,
            control,
            worker,
            status,
            joined: Arc::new(AtomicBool::new(false)),
        }
    } // End of function start()

    /// A lifecycle that watches nothing: same replacement and drop semantics
    /// as a running one, no worker, no native backend, `ready: false`
    /// forever — exactly the observable shape of a worker that could not be
    /// spawned (see [`WatcherLifecycle::start`]), which is why this invents
    /// no new state.
    fn stationary(epoch: u64) -> WatcherLifecycle {
        // The receiver is dropped immediately, so the stop send in `Drop`
        // fails and is ignored — there is nothing to stop.
        let (control, _) = std::sync::mpsc::channel();
        WatcherLifecycle {
            epoch,
            control,
            worker: None,
            status: Arc::new(SharedStatus::default()),
            joined: Arc::new(AtomicBool::new(false)),
        }
    } // End of function stationary()

    /// The watcher a workspace gets when its session's epoch space is
    /// exhausted: it watches nothing and reports [`NO_EPOCH`].
    ///
    /// The one production path to a stationary lifecycle, and the typed
    /// terminal policy for [`EpochSpaceExhausted`]: an observation that
    /// cannot be attributed to a distinct epoch must not be produced, so no
    /// worker starts and nothing ever reaches the sink — where a reused
    /// epoch would instead let a later consumer attribute a replaced
    /// workspace's observations to its replacement.
    pub(crate) fn without_epoch() -> WatcherLifecycle {
        WatcherLifecycle::stationary(NO_EPOCH)
    }

    /// A stationary lifecycle with a real epoch — the test-only economy
    /// `WorkspaceSession::unwatched` buys.
    ///
    /// `cfg(test)` keeps this constructor out of the built application; the
    /// only production path to the same stationary shape is
    /// [`WatcherLifecycle::without_epoch`], which carries no epoch at all
    /// and exists solely for the exhausted-epoch arm.
    #[cfg(test)]
    pub(crate) fn inert(epoch: u64) -> WatcherLifecycle {
        WatcherLifecycle::stationary(epoch)
    }

    /// This watcher's state, observed. See [`WatchStatusView`].
    // Reached through `WorkspaceSession::watch_status`, whose consumers are
    // `crate::watch_check`'s tests today, and directly by this module's own
    // tests; the allow is scoped to non-test builds so the accessor stays
    // lint-armed where its consumers exist.
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn status(&self) -> WatchStatusView {
        WatchStatusView {
            epoch: self.epoch,
            ready: self.status.ready.load(Ordering::SeqCst),
            polling: self.status.polling.load(Ordering::SeqCst),
        }
    }

    /// Cancels this watcher and joins its worker.
    ///
    /// [`Drop`] is the mechanism — this method only consumes the value — and
    /// it exists so the replacement site in `WorkspaceSession::open` reads as
    /// the cancellation the consult's Q1 requires rather than as a variable
    /// going out of scope. Called from any thread but the worker's own, when
    /// it returns the worker has exited and its native callbacks are gone;
    /// called from inside the worker's own sink callback, it returns
    /// immediately and the join is the reaper's — [`Drop`]'s impl doc states
    /// both cases and what each guarantees.
    pub fn shut_down(self) {}

    /// A probe onto this watcher's teardown completion — see [`JoinProbe`].
    #[cfg(test)]
    pub(crate) fn join_probe(&self) -> JoinProbe {
        JoinProbe(Arc::clone(&self.joined))
    }
}

/// A handle onto one watcher's teardown-completion flag — the test seam that
/// keeps "the worker was actually joined, off the worker" observable after
/// the lifecycle value itself is consumed.
///
/// [`JoinProbe::completed`] answers `true` only once the join of this
/// lifecycle's worker has returned — on the dropping thread ordinarily, on
/// the reaper for a callback-initiated teardown — or trivially, for a
/// lifecycle that never had a worker to join.
#[cfg(test)]
#[derive(Debug, Clone)]
pub(crate) struct JoinProbe(Arc<AtomicBool>);

#[cfg(test)]
impl JoinProbe {
    /// Whether this watcher's teardown has completed its join.
    pub(crate) fn completed(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }
}

/// One worker's teardown, shipped to the reaper because it was initiated on
/// the worker's own thread — the one thread that cannot perform the join.
struct Reap {
    /// The worker thread to join once it exits.
    worker: JoinHandle<()>,
    /// The flag to store once the join has returned — the teardown
    /// completion handshake the test-only join probe reads.
    joined: Arc<AtomicBool>,
}

/// Hands one worker's join to the reaper — a process-lifetime thread that is
/// never a worker, spawned on first use, blocked on its channel whenever it
/// holds no handle, and joined by nobody.
///
/// Each of the reaper's sweeps joins **every handle it observes finished,
/// without blocking on unfinished handles and irrespective of earlier
/// handoffs** ([`reap_forever`]) — it never blocks inside a join on a worker
/// that has not exited, so a worker parked forever in its sink callback holds
/// up nothing but its own reap. (The first reaper joined serially in
/// hand-over order, and one such worker blocked every join handed over
/// behind it — round 3's finding.) If the reaper thread cannot
/// be spawned — resource exhaustion, the same arm
/// [`WatcherLifecycle::start`] absorbs — or its channel is gone, the handle
/// is dropped instead: the worker still stops on the message already in its
/// inbox, and the only loss is the join and the completion flag it would
/// have stored. This channel is not the 2d design consult Q3's forbidden
/// wire: it carries thread handles between teardown sites, never an
/// observation, an event or a queue a command could drain.
fn hand_to_reaper(reap: Reap) {
    static REAPER: OnceLock<Option<Sender<Reap>>> = OnceLock::new();
    let reaper = REAPER.get_or_init(|| {
        let (sender, teardowns) = std::sync::mpsc::channel::<Reap>();
        std::thread::Builder::new()
            .name("espansoconfig-watch-reaper".into())
            .spawn(move || reap_forever(teardowns))
            .ok()
            // The reaper's own handle is dropped on purpose: it lives for
            // the process, and there is no shutdown point left to join it at.
            .map(|_| sender)
    });
    if let Some(reaper) = reaper {
        // A failed send means the reaper is gone; dropping the reap detaches
        // the worker, exactly as a reaper that could not spawn does.
        let _ = reaper.send(reap);
    }
} // End of function hand_to_reaper()

/// The reaper's loop: each sweep joins **every handle it observes finished,
/// without blocking on unfinished handles and irrespective of earlier
/// handoffs** — a still-unfinished earlier handoff never blocks a finished
/// later one, and no join blocks on a worker that has not exited.
///
/// Each turn takes in newly handed teardowns, then sweeps the handles it
/// holds with [`JoinHandle::is_finished`], joining exactly the workers that
/// have already exited — a finished handle's join returns promptly — and
/// storing each `joined` flag only after that worker's own join returned,
/// which keeps the completion handshake honest. No chronological ordering
/// among the workers a single sweep meets finished is claimed:
/// [`JoinHandle::is_finished`] reports only whether a worker is finished at
/// the instant inspected, never when it exited, so two workers that both
/// exit between sweeps are joined in hand-over order within their sweep.
/// While it holds no handle the
/// loop blocks on its channel and costs no wakeups; while it holds any it
/// parks [`REAPER_SCAN_MS`] between sweeps, so a worker that exits is joined
/// within about one interval, whatever was handed over before it. **The
/// bounded policy for a worker that never exits** — a sink callback parked
/// forever has hung its own worker — **is that its handle simply stays
/// held**: one [`Reap`] of memory per permanently stuck worker, kept for the
/// life of the process, blocking no other worker's join — and the held set
/// grows with nothing else, because every worker that does exit is joined
/// and released by the next sweep.
fn reap_forever(teardowns: Receiver<Reap>) {
    let mut pending: Vec<Reap> = Vec::new();
    let mut connected = true;
    loop {
        // Take in teardowns: block while no handle is held, park one sweep
        // interval while any is. Disconnection is unreachable while the
        // sender lives in `hand_to_reaper`'s static, but the arm is written
        // rather than hoped away: nothing new can arrive, so the loop keeps
        // sweeping what it holds and returns once that is empty.
        match (connected, pending.is_empty()) {
            (true, true) => match teardowns.recv() {
                Ok(reap) => pending.push(reap),
                Err(_) => connected = false,
            },
            (true, false) => match teardowns.recv_timeout(Duration::from_millis(REAPER_SCAN_MS)) {
                Ok(reap) => pending.push(reap),
                Err(RecvTimeoutError::Timeout) => {}
                Err(RecvTimeoutError::Disconnected) => connected = false,
            },
            (false, true) => return,
            (false, false) => std::thread::sleep(Duration::from_millis(REAPER_SCAN_MS)),
        } // End of the match deciding how this turn waits
        while let Ok(reap) = teardowns.try_recv() {
            pending.push(reap);
        }
        // The sweep: join every worker this sweep observes finished —
        // whatever was handed over before it — and keep every one that
        // has not exited.
        for reap in std::mem::take(&mut pending) {
            if reap.worker.is_finished() {
                let _ = reap.worker.join();
                reap.joined.store(true, Ordering::SeqCst);
            } else {
                pending.push(reap);
            }
        } // End of the sweep joining exited workers
    } // End of the reaper's loop
} // End of function reap_forever()

impl Drop for WatcherLifecycle {
    /// Sends the stop message and joins the worker — on whichever thread can.
    ///
    /// The send is allowed to fail — a worker that was never spawned, or one
    /// that already exited, has no receiver. **Which thread joins is decided
    /// here, by comparing thread ids**, because a sink callback may tear its
    /// own watcher down — re-entering `open`, or dropping the last strong
    /// session reference — and a thread synchronously waiting to join itself
    /// can never be satisfied:
    ///
    /// - **On any thread other than the worker's own** — every ordinary
    ///   replacement and shutdown — the join runs in place: when this drop
    ///   returns, the worker has exited and nothing of this epoch can reach
    ///   the sink again. The join result is deliberately discarded: a worker
    ///   that panicked has already stopped watching, and there is nothing
    ///   here to recover or report it to.
    /// - **On the worker's own thread** — teardown reached from inside its
    ///   sink callback — the join is handed to [`hand_to_reaper`] and this
    ///   drop returns without waiting. The stop message is already in the
    ///   worker's inbox, so the worker exits after the initiating callback
    ///   returns and the engine pass it interrupted completes; observations
    ///   of this epoch may reach the sink until then, epoch-tagged, and the
    ///   join itself completes on the reaper thread, which is never a worker.
    ///
    /// Either way the joined flag is stored only after the join has actually
    /// returned — the completion handshake the test-only join probe reads.
    fn drop(&mut self) {
        let _ = self.control.send(WorkerMessage::Stop);
        let Some(worker) = self.worker.take() else {
            // Nothing was ever spawned, or this lifecycle is stationary:
            // there is nothing left to join, so teardown is already complete.
            self.joined.store(true, Ordering::SeqCst);
            return;
        };
        if worker.thread().id() == std::thread::current().id() {
            hand_to_reaper(Reap {
                worker,
                joined: Arc::clone(&self.joined),
            });
            return;
        }
        let _ = worker.join();
        self.joined.store(true, Ordering::SeqCst);
    } // End of function drop()
}

/// The worker: one engine, one native watch, one loop, on one thread.
struct WatchWorker {
    /// The workspace root, spelled as the session spelled it.
    root: PathBuf,
    /// The epoch every observation is tagged with.
    epoch: u64,
    /// The validated timing.
    config: LifecycleConfig,
    /// Where observations go.
    sink: ObservationSink,
    /// The flags the lifecycle handle reads.
    status: Arc<SharedStatus>,
    /// The fixed origin the engine's [`Millis`] instants are measured from.
    origin: Instant,
    /// The real filesystem, behind the engine's injected-reader seam.
    source: FsWatchSource,
    /// `Some(next rescan instant)` once the polling fallback is engaged;
    /// `None` on a healthy native watch, which never rescans on a timer.
    next_poll: Option<Millis>,
}

impl WatchWorker {
    /// Now, on the engine's clock.
    fn now(&self) -> Millis {
        Millis(u64::try_from(self.origin.elapsed().as_millis()).unwrap_or(u64::MAX))
    }

    /// Engages the polling fallback, with the first rescan due at `due`.
    ///
    /// Idempotent: a second degradation report neither resets an already
    /// scheduled rescan nor disturbs the cadence.
    fn engage_polling(&mut self, due: Millis) {
        self.status.polling.store(true, Ordering::SeqCst);
        if self.next_poll.is_none() {
            self.next_poll = Some(due);
        }
    }

    /// Starts the native backend, forwarding its signals into the inbox.
    ///
    /// The returned handle is held by the worker for its lifetime, so worker
    /// exit is what stops the callbacks. Any failure — the backend refusing to
    /// exist, or any root it could not watch — engages the polling fallback
    /// immediately, with the first rescan due now: the backend just declined
    /// to promise delivery, so the sweep must not wait a full interval.
    ///
    /// **When this returns with a healthy watch, the stream is live, not
    /// merely requested.** On this platform `notify`'s FSEvents backend
    /// blocks each `watch` call until its run-loop thread has created,
    /// scheduled and *started* the stream — the run-loop handshake in notify
    /// 8.2.0's `fsevent.rs`, where `run()` receives the run loop only after
    /// `FSEventStreamStart` — so a write landing after this function returns
    /// lands on a started stream. That is the fact the no-missed-write
    /// ordering in [`WatchWorker::run`] stands on, and it is a property of
    /// the pinned backend, verified in its source rather than assumed.
    fn establish_native(&mut self, hints: Sender<WorkerMessage>) -> Option<NativeWatch> {
        let forward = move |signal: NativeSignal| {
            // A send after the worker exited is a late callback from a
            // replaced or shut-down watcher: the receiver is gone, the send
            // fails, and the hint is discarded here — before it can name a
            // document (consult Q1). The result is intentionally dropped.
            let _ = hints.send(WorkerMessage::Native(signal));
        };
        match NativeWatch::start(&self.root, forward) {
            Ok(watch) => {
                if watch.established().is_empty() || !watch.unavailable().is_empty() {
                    // A root the backend refused — a fresh install may have
                    // only one of the two directories — is a root only the
                    // rescan can cover.
                    self.engage_polling(self.now());
                }
                Some(watch)
            }
            Err(_) => {
                self.engage_polling(self.now());
                None
            }
        }
    } // End of function establish_native()

    /// Runs the baseline scan, retrying on the poll cadence until it succeeds
    /// or the worker is stopped.
    ///
    /// A failing enumeration is a typed refusal, and retrying it is the only
    /// honest response: the engine cannot open over a tree it cannot list.
    /// Hints that arrive while the baseline is failing are consumed and
    /// dropped — the baseline that eventually succeeds reads the tree as it
    /// is then, so nothing a dropped hint pointed at is missed by it.
    fn baseline(&mut self, inbox: &Receiver<WorkerMessage>) -> Option<ObservationEngine> {
        loop {
            match ObservationEngine::start(&self.root, self.config.engine, &mut self.source) {
                Ok(engine) => return Some(engine),
                Err(_) => match inbox.recv_timeout(Duration::from_millis(self.config.poll_ms)) {
                    Ok(WorkerMessage::Stop) | Err(RecvTimeoutError::Disconnected) => return None,
                    Ok(WorkerMessage::Native(_)) | Err(RecvTimeoutError::Timeout) => {}
                },
            }
        }
    } // End of function baseline()

    /// Feeds one native signal into the engine.
    fn absorb(
        &mut self,
        engine: &mut ObservationEngine,
        spelling: &HintSpelling,
        signal: NativeSignal,
    ) {
        match signal {
            NativeSignal::Hints(paths) => {
                let now = self.now();
                for path in paths {
                    engine.hint(&spelling.respell(path), now);
                }
            }
            NativeSignal::Degraded(_reason) => {
                // What a caller acts on is the *fact* of degradation
                // (`watch/native.rs`): from here on the rescan cadence is the
                // delivery mechanism, and the first sweep is due immediately —
                // the backend just said it may have dropped events. The text
                // is diagnostic only and never crosses the IPC boundary.
                self.engage_polling(self.now());
            }
        }
    } // End of function absorb()

    /// How long the loop may sleep before something is due.
    fn wake_after(&self, engine: &ObservationEngine) -> Duration {
        let now = self.now();
        let due = [engine.next_deadline(), self.next_poll]
            .into_iter()
            .flatten()
            .min();
        match due {
            None => Duration::from_millis(QUIET_PARK_MS),
            Some(at) => Duration::from_millis(at.0.saturating_sub(now.0)),
        }
    } // End of function wake_after()

    /// The worker: native watch, baseline, then the loop until stopped.
    ///
    /// **That order is the no-missed-write argument, so it is load-bearing.**
    /// [`WatchWorker::establish_native`] returns only once the stream is
    /// started (its doc carries the backend evidence), and the baseline runs
    /// strictly after it. So any external write divides cleanly: one that
    /// completes before the baseline's read of its file is the baseline's to
    /// see (a torn read defers into the pending pipeline and is re-read);
    /// one that lands after that read landed on an already started stream,
    /// is hinted into the inbox — a successful baseline consumes nothing
    /// from the inbox, so the hint waits for the loop — and is re-examined.
    /// There is no instant after the baseline's read at which the stream is
    /// not yet live, because the stream was live before the baseline began.
    /// What this ordering cannot cover is a backend that silently stops
    /// delivering *without reporting anything*; every failure the backend
    /// does report — creation, a refused root, degradation, a dropped-events
    /// rescan demand — engages the polling fallback.
    ///
    /// The loop's shape is the engine's contract read literally: sleep until
    /// the next deadline or the next rescan (a message wakes it early), absorb
    /// whatever arrived, rescan if the fallback cadence is due, tick, and hand
    /// every stabilized observation to the sink tagged with this watcher's
    /// epoch. The engine trusts this caller to keep ticking until
    /// `next_deadline()` is `None` — that is the caller obligation its module
    /// docs state Rust cannot enforce, and this loop is where it is met.
    fn run(mut self, inbox: Receiver<WorkerMessage>, hints: Sender<WorkerMessage>) {
        let _native = self.establish_native(hints);
        let spelling = HintSpelling::of(&self.root);
        let Some(mut engine) = self.baseline(&inbox) else {
            return;
        };
        self.status.ready.store(true, Ordering::SeqCst);
        loop {
            match inbox.recv_timeout(self.wake_after(&engine)) {
                Ok(WorkerMessage::Stop) | Err(RecvTimeoutError::Disconnected) => return,
                Ok(WorkerMessage::Native(signal)) => self.absorb(&mut engine, &spelling, signal),
                Err(RecvTimeoutError::Timeout) => {}
            }
            // Drain whatever else already arrived, so a burst of native
            // events becomes one pass of hints rather than one loop turn each.
            loop {
                match inbox.try_recv() {
                    Ok(WorkerMessage::Stop) | Err(TryRecvError::Disconnected) => return,
                    Ok(WorkerMessage::Native(signal)) => {
                        self.absorb(&mut engine, &spelling, signal)
                    }
                    Err(TryRecvError::Empty) => break,
                }
            } // End of the drain loop over already queued messages
            let now = self.now();
            if let Some(due) = self.next_poll {
                if now >= due {
                    // A failing enumeration is a typed refusal that hints
                    // nothing; polling continues and the next interval
                    // retries, because a degraded backend over an unreadable
                    // tree is still a tree that may become readable.
                    let _ = engine.rescan(now, &mut self.source);
                    self.next_poll = Some(now.plus(self.config.poll_ms));
                }
            }
            for observation in engine.tick(now, &mut self.source) {
                (self.sink)(EpochObservation {
                    epoch: self.epoch,
                    observation,
                });
            }
        } // End of the worker's main loop
    } // End of function run()
} // End of impl WatchWorker

impl fmt::Debug for WatchWorker {
    /// Hand-written because a sink is a closure with no `Debug` of its own.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("WatchWorker")
            .field("root", &self.root)
            .field("epoch", &self.epoch)
            .field("next_poll", &self.next_poll)
            .finish_non_exhaustive()
    }
}

impl fmt::Debug for WorkerMessage {
    /// Hand-written for the same reason as [`WatchWorker`]'s: keeping the
    /// derive would demand `Debug` of every future payload for no reader.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            WorkerMessage::Native(signal) => formatter.debug_tuple("Native").field(signal).finish(),
            WorkerMessage::Stop => formatter.write_str("Stop"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn a_poll_interval_that_would_starve_the_debounce_is_refused() {
        let engine = EngineConfig::new(150, 25).expect("a valid engine timing");
        // The floor for 150/25 is 2 × 175 = 350.
        assert_eq!(
            LifecycleConfig::new(engine, 349),
            Err(LifecycleConfigError::PollWouldStarveTheDebounce {
                requested_ms: 349,
                minimum_ms: 350,
            })
        );
        assert!(LifecycleConfig::new(engine, 350).is_ok());
        // The default pairing is valid and keeps its stated numbers.
        let default = LifecycleConfig::default();
        assert_eq!(default.poll_ms(), DEFAULT_POLL_MS);
        assert_eq!(default.engine(), EngineConfig::default());
    } // End of function a_poll_interval_that_would_starve_the_debounce_is_refused()

    #[test]
    fn a_native_hint_is_respelled_onto_the_workspaces_root_spelling() {
        let dir = TempDir::new().expect("temp dir");
        let root = dir.path().join("tree");
        fs::create_dir_all(root.join("config")).expect("the config root");
        fs::create_dir_all(root.join("match")).expect("the match root");
        let spelling = HintSpelling::of(&root);

        // A hint through a root's canonical form lands on the spelled form.
        // On macOS a temp directory makes this non-trivial (`/var` resolves to
        // `/private/var`); where the two forms already agree the alias table
        // is empty and the property holds as the identity.
        for watched in watched_roots(&root) {
            let canonical = fs::canonicalize(&watched).expect("the root canonicalizes");
            assert_eq!(
                spelling.respell(canonical.join("base.yml")),
                watched.join("base.yml"),
                "a hint under the canonical form of {watched:?} must re-spell"
            );
        } // End of the loop over the two watched roots

        // A path under neither root's canonical form passes through unchanged.
        let elsewhere = PathBuf::from("/somewhere/else.yml");
        assert_eq!(spelling.respell(elsewhere.clone()), elsewhere);
    } // End of function a_native_hint_is_respelled_onto_the_workspaces_root_spelling()

    #[test]
    fn epoch_allocation_is_checked_and_never_reuses_a_value() {
        let mut epochs = WorkspaceEpochs::new();
        assert_eq!(epochs.allocate(), Ok(FIRST_WORKSPACE_EPOCH));
        assert_eq!(epochs.allocate(), Ok(FIRST_WORKSPACE_EPOCH + 1));

        // The boundary: the last representable epoch is handed out exactly
        // once, and the exhausted allocator refuses forever rather than
        // saturating — no two calls can ever answer the same epoch.
        let mut epochs = WorkspaceEpochs::starting_at(u64::MAX - 1);
        assert_eq!(epochs.allocate(), Ok(u64::MAX - 1));
        assert_eq!(epochs.allocate(), Ok(u64::MAX));
        assert_eq!(epochs.allocate(), Err(EpochSpaceExhausted));
        assert_eq!(epochs.allocate(), Err(EpochSpaceExhausted));
    } // End of function epoch_allocation_is_checked_and_never_reuses_a_value()

    #[test]
    fn a_lifecycle_without_an_epoch_watches_nothing_and_reports_the_unset_epoch() {
        let lifecycle = WatcherLifecycle::without_epoch();
        let status = lifecycle.status();
        assert_eq!(status.epoch, NO_EPOCH, "no epoch is the unset zero");
        assert!(!status.ready, "a stationary lifecycle never becomes ready");
        assert!(!status.polling, "a stationary lifecycle engages nothing");
        // Consuming it is a no-op join: there is no worker to stop, and the
        // teardown-completion handshake still fires — trivially, because a
        // lifecycle with no worker has nothing left to join.
        let probe = lifecycle.join_probe();
        assert!(!probe.completed(), "nothing has been torn down yet");
        lifecycle.shut_down();
        assert!(
            probe.completed(),
            "consuming the lifecycle completes teardown"
        );
    } // End of function a_lifecycle_without_an_epoch_watches_nothing_and_reports_the_unset_epoch()
}
