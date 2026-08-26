//! The Rust to frontend event bridge (plan section 6.1).
//!
//! **Deliberately empty until Phase 2d-4a.** Every event this module could have
//! carried was produced by something that did not exist: `crate::watch`
//! reporting a file changed underneath the user (plan section 6.5), and the save
//! transaction reporting progress (plan section 6.6). Declaring event names then
//! would have been inventing a protocol for a producer nobody had written.
//!
//! Phase 2d-4a declares the first one, and only the first: the save transaction
//! still reports no progress, because a save is a command and its answer is the
//! report.
//!
//! # One event, and it is a hint
//!
//! [`RECONCILIATION_READY`] carries a
//! [`crate::reconciliation::ReconciliationWake`] and nothing else — a workspace
//! epoch and a sequence. It is **expendable**: nothing is installed from it, a
//! listener that attaches late has missed nothing, and the authority is
//! `crate::commands::drain_external_changes` (the 2d design consult's Q3). It is
//! deliberately not a `CommandResult`, because it reports no requested
//! operation.
//!
//! The same rule as `commands` applies to it and to every event added later: a
//! payload is a code plus structured operands, never a rendered English
//! sentence. The frontend owns every word the user reads — and this payload owns
//! no word at all.

use std::sync::Arc;

use tauri::{AppHandle, Emitter, Runtime};

use crate::reconciliation::{ReconciliationWake, WakeEmitter};

/// The one event name this application emits.
///
/// `workspace://` groups it by what it is about rather than by what produces it,
/// so a later watcher-status or save-progress event can join the same family.
/// Tauri accepts alphanumerics, `-`, `/`, `:` and `_` in an event name, so this
/// spelling is a legal name and not a URL.
pub const RECONCILIATION_READY: &str = "workspace://reconciliation-ready";

/// The wake emitter for one application handle.
///
/// Built here rather than in `crate::reconciliation` so that the queue never
/// mentions `tauri` and a test can watch its wakes without a webview.
///
/// **A failed emit is dropped on purpose**, because the event is a hint and the
/// drain command is the authority: the protocol's whole recovery from a lost
/// wake is that the consumer drains again, and the 2d design consult's Q3 puts
/// that obligation — a drain after listener registration, after an open
/// completes, and on foreground or resume — on the frontend coordinator.
///
/// **No such drain exists in Phase 2d-4a.** No frontend code can call
/// `drain_external_changes` until 2d-4b declares it, and 2d-5 is what
/// orchestrates the three drains, so a wake dropped today is recovered by
/// nobody. The paragraph above says what a consumer *will be obliged* to do; an
/// earlier draft of it said what one does, in the present tense, and that was
/// false. `crate::reconciliation::ReconciliationQueue::wake` carries the same
/// correction beside the same decision.
///
/// What this function cannot establish is that any webview is listening; nothing
/// in Tauri reports that, and no sentence anywhere in this application may claim
/// it.
pub fn wake_emitter<R: Runtime>(handle: AppHandle<R>) -> WakeEmitter {
    Arc::new(move |wake: ReconciliationWake| {
        let _ = handle.emit(RECONCILIATION_READY, wake);
    })
}
