//! The espansoConfig application shell.
//!
//! This crate owns the window, the webview and the IPC boundary, and nothing
//! else. Every decision about YAML lives in `espansoconfig-core`, which never
//! depends on tauri (CLAUDE.md section 3) — the dependency runs one way, and
//! `cargo tree -p espansoconfig-core | rg tauri` finding nothing is the check
//! that says so.
//!
//! Phase 1b-2a adds the **read-only** half of the boundary: the five commands
//! of plan section 6.4 and the one piece of state they share. There is still no
//! event and no mutating command; see `commands` and `events` for what each
//! will hold and why neither could honestly be written first.
//!
//! Phase 1b-2b adds one more command, and it is not a workspace command:
//! `menu::set_menu_labels` carries the macOS menu's labels **from** the
//! frontend, because Tauri builds that menu in Rust and the single source of
//! truth for a user-facing string is `src/lib/i18n/{en,es}.json`.
//!
//! Phase 1c-2b-2a adds the seventh and last of Phase 1: `commands::document_text`
//! hands back a document's bytes unchanged. It writes nothing either — it is the
//! read side of the file, not a way to put anything back on it.
//!
//! Phase 2 opens the other direction. `commands::move_match` (2b-2a),
//! `commands::save_match` (2b-2b-3), `commands::create_match` and
//! `commands::delete_match` (both 2b-2c-2), `commands::save_raw_document`
//! (2b-2c-3b) and `commands::duplicate_match` (2c-3c-2) are the six commands
//! that can write a user's file, and every one of them does it through
//! `espansoconfig_core::persist::save_document` and through nothing else — see
//! `commands` for why there is exactly one entry point. The fifth was the last
//! of Phase 2b-2c; the sixth is Phase 2c-3c's true duplicate, riding the
//! `DuplicateItem` primitive 2c-3c-1 built.
//!
//! Phase 2c-5-2 adds three more, and **not one of them writes**:
//! `commands::list_backup_batches`, `commands::list_backup_entries` and
//! `commands::read_backup_text` put Phase 2c-5-1's read-only backup catalogue on
//! the wire. Restore is a **content path on the sixth writer** — the confirmed
//! text goes out through `save_raw_document` — so this phase adds no seventh
//! writing command and no restore-specific finding. See `crate::backup`.
//!
//! Phase 2d-2 adds **no command and no event**: `watch` puts the core's
//! observation engine behind the open workspace — one epoch-tagged watcher per
//! open, cancelled and joined on successful replacement, dropped on shutdown,
//! polling only when the native backend fails. What it observes went to a sink
//! that discarded it until Phase 2d-4a wired the queue and the wake event (the
//! 2d design consult's Q3); `watch_check` is the real-filesystem integration
//! evidence the consult's Q7 item 2 places in this crate.
//!
//! Phase 2d-3 adds **no command and no event either**: `ledger` is the
//! per-document app-write record and the admission gate the session installs
//! between every watcher and its downstream sink, so an observation of bytes
//! this application itself committed is suppressed, a repeat of an already
//! announced state is coalesced, a replaced epoch's observation is discarded,
//! and everything admitted is numbered. The record is written in one place —
//! `commands::commit_and_record`, the window `run_one_save` runs its
//! transaction in, for a committed save and for nothing else — and the two
//! refreshes on the save path (`after_a_save`'s and `conflict_after_the_lock`'s)
//! go through the same coalescing and the same supersession a native hint meets,
//! through doors of their own that cannot spend a sequence and are asked
//! **neither** retaining check: not the chronology one, because they read no
//! clock, and not the suppression one, because a native hint is exactly what
//! they are not. **Seven** things together make a
//! save's own rename un-reportable as somebody else's without losing anybody
//! else's write, and the count is re-derived by counting the list: a **commit
//! gate** distinct from the ledger's state, which makes
//! the transaction and its record one window no admission can *decide* inside; a
//! **stamp** on every observation a *watcher* produces, taken before the reads
//! that produced it,
//! which is what places a reading that was already in hand when that window
//! opened — the gate cannot reach a read that already happened; a **commit
//! anchor** per path, which is what that stamp is compared against and which
//! **outlives the app-write record** it was taken with, since nothing bounds how
//! long a completed settlement may wait to be delivered (this step's round-9
//! second High); a **taken
//! back settlement**, because the engine installs a stabilized state as tracked
//! before the ledger ever sees it, so a refusal that is not answered leaves that
//! state coalescing to nothing forever; the **session lock** the two save-path
//! refreshes already hold, which orders their reads against every record with no
//! clock in between; a **re-observation** asked of the running watcher when a
//! save could not read the file at all, or read it once where the engine reads
//! twice; and the fact that such a request is an **owed** observation rather
//! than a hint. **What that debt guarantees, and what it expressly does not,
//! is [`espansoconfig_core::watch::liveness`]** — the one statement of it in this
//! workspace, which this header points at rather than paraphrasing. Two
//! paraphrases stood at this position through Phase 2d-3, each a promise the
//! engine refuses, and the second survived the round that corrected it
//! everywhere else because that round's sweep read a list of four files and not
//! this one. What is local to this crate is only where the request is made and
//! what it is retained across: `watch::ReObserver` sends it, and
//! `watch::WatchWorker::baseline` holds it until an engine exists to take it.
//!
//! **One more thing is about a different event entirely, and so is not in that
//! list**: `commands::reload_document` is the only read path that can install a
//! revision this session did not already hold, and since the round-9 fix round it
//! tells the ledger, which drops that path's app-write record and its announced
//! state **where each differs** from what the workspace accepted. Left standing,
//! the first made the stamped door suppress a genuine external return to the
//! recorded bytes and the second made a genuine external return to the announced
//! bytes a duplicate — this step's round-9 first and third Highs. A *watcher* reading the session cannot
//! place strictly after its own last commit to that path is discarded rather
//! than published, it does not clear the record, and the engine is told to
//! un-conclude it. **What that rollback restores, and what it does not promise,
//! is [`espansoconfig_core::watch::liveness`]**; this header names the local fact
//! — which door refuses, and that the refusal neither publishes nor clears —
//! and points there for the rest. **The two save-path refreshes are
//! not stamped and cannot be discarded that way**: they run under the session
//! lock, which is the lock every producer of a record holds, so their reads
//! follow any record in program order and no clock decides it — a refusal there
//! had nothing to answer it and lost the external change outright, which was
//! this step's round-4 High. **And where such a refresh *fails*, or a save's own
//! write may have landed without saying what it wrote, nothing is published from
//! the read that did not happen**: the path is handed back to the watcher
//! (`watch::ReObserver`), whose ordinary two reads produce the state and whose
//! stamp places it — this step's round-5 High, which was round 4's exposure
//! reached through an error arm. **Where such a refresh *succeeds*, nothing
//! enters the observation sequence from it either, and a stabilized reading is
//! asked for instead**: one read can be an intermediate state of somebody else's
//! non-atomic write, and publishing one spends a sequence on a state that never
//! stably existed — this step's round-6 second High and its round-7 one. What
//! each successful single read may do is what it can justify and no more:
//! `conflict_after_the_lock`'s **marks** its state so a native duplicate at it
//! coalesces rather than raising a second conflict (the consult's Q5, and the
//! person has been shown that state in the payload), while `after_a_save`'s
//! records nothing at all, because nobody has been shown it and a marker would
//! coalesce the engine's own later reading of it into silence.
//!
//! **Phase 2d-4a is where what the gate admits reaches something that can hand
//! it back**, and it adds the sixteenth workspace command and the first event.
//! `reconciliation` is the
//! typed, ordered, coalescing queue the session holds beside its open
//! workspace: the sink behind the admission gate puts an admitted observation
//! in it — unless it carries a replaced epoch or a sequence a drain has already
//! acknowledged, which are the two arrivals no later drain could return — and
//! emits `events::RECONCILIATION_READY`, and
//! `commands::drain_external_changes` hands the pending ones back as typed wire
//! values, coalesced — one observation per run of one path's sequence-adjacent
//! entries asserting one state. The **event is a hint and the command answer is the authority** (the
//! consult's Q3) — nothing is installed from a wake, and an epoch mismatch
//! makes a wake or a batch stale. This step draws nothing and decides nothing
//! about whether a write surface is open; that is 2d-5's and 2d-6's.

#![deny(missing_docs)]
// Phase 2d-3-C. Every passage in this crate that needs the observation
// pipeline's liveness guarantee links to
// `espansoconfig_core::watch::liveness` instead of restating it, and a link
// that stops resolving must break the build rather than silently orphan the
// pointer.
#![deny(rustdoc::broken_intra_doc_links)]
// The app is macOS-only for now (plan section 10), so no Windows subsystem
// attribute is set here. Add one before the first Windows build, not before.

mod backup;
mod commands;
#[cfg(test)]
mod dictionary_contract;
#[cfg(test)]
mod dispatch_check;
mod error;
mod events;
mod ledger;
#[cfg(test)]
mod liveness_contract;
mod menu;
#[cfg(test)]
mod menu_contract;
mod reconciliation;
#[cfg(test)]
mod rust_source;
mod save;
mod watch;
#[cfg(test)]
mod watch_check;
#[cfg(test)]
mod wire_contract;

/// The compiled configuration: `tauri.conf.json`, the icons and the resolved
/// capability set.
///
/// `generate_context!` may be expanded **once per crate** — it defines the
/// `_EMBED_INFO_PLIST` symbol — so it lives in one function that both `main`
/// and `dispatch_check.rs` call. That is not merely a workaround: it is what
/// makes the dispatcher test exercise the shipped configuration and the shipped
/// capability file rather than a fixture that could disagree with them.
fn context<R: tauri::Runtime>() -> tauri::Context<R> {
    tauri::generate_context!()
}

/// Registers the ten read-only workspace commands, the six commands that write,
/// the menu command, and the state they share.
///
/// Shared with `dispatch_check.rs` so that the tested application is the built
/// application: a command registered in `main` and absent from the test's
/// builder would make the test's evidence a statement about a different
/// program.
///
/// The original six workspace readers — read a workspace, list its files,
/// project one, project one match, read one's bytes, re-read one — the three
/// backup-catalogue commands `list_backup_batches`, `list_backup_entries` and
/// `read_backup_text`, and Phase 2d-4a's `drain_external_changes` are
/// read-only. The six save commands `move_match`,
/// `save_match`, `create_match`, `delete_match`, `save_raw_document` and
/// `duplicate_match` write, and every one of them does it through
/// `espansoconfig_core::persist::save_document` and through nothing else. The
/// menu command, `set_menu_labels`, does not write a user file either: it hands
/// the macOS menu the strings the frontend translated, because Tauri builds that
/// menu in Rust and hardcoding either language here is what plan section 9
/// forbids. See `crate::menu`.
///
/// `capabilities/default.json` stays at `"permissions": []`, **including for
/// the menu**. A capability grants access to **plugin** commands — everything
/// spelled `plugin:…`, `core:…` included — and an application's own commands
/// are dispatched without consulting the access-control list unless the
/// application publishes an ACL manifest of its own (`tauri::webview`'s
/// dispatcher checks `plugin_command.is_some() || has_app_acl_manifest ||
/// !is_local`). This crate publishes none, the webview's origin is local, and
/// none of the seventeen commands is a plugin command. `core:menu`'s permissions exist for a
/// frontend that builds menus through `@tauri-apps/api/menu`; this one does
/// not, and asks Rust for a rebuild instead, so the empty permission list that
/// Phase 1b-1's review narrowed to stays exactly as narrow and `core:default`
/// stays gone. That paragraph is an argument; `dispatch_check.rs` is the
/// evidence — and it is re-run for every command added, `document_text`
/// included, rather than the argument being extended to cover it.
fn register<R: tauri::Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder
        .manage(commands::WorkspaceSession::new())
        // The session is managed before an application handle exists, so the
        // reconciliation wake's emitter is installed here rather than in the
        // constructor. It is in `register` and not in `main` so that
        // `dispatch_check`'s application is the built application in this
        // respect too.
        .setup(|app| {
            use tauri::Manager as _;
            let emitter = events::wake_emitter(app.handle().clone());
            app.state::<commands::WorkspaceSession>()
                .install_wake_emitter(emitter);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_workspace,
            commands::list_documents,
            commands::get_document,
            commands::get_match,
            commands::document_text,
            commands::reload_document,
            commands::move_match,
            commands::save_match,
            commands::create_match,
            commands::delete_match,
            commands::save_raw_document,
            commands::duplicate_match,
            commands::list_backup_batches,
            commands::list_backup_entries,
            commands::read_backup_text,
            commands::drain_external_changes,
            menu::set_menu_labels,
        ])
} // End of function register()

/// Starts the application.
///
/// A bad `tauri.conf.json` or an unknown capability fails the build rather than
/// the launch, because [`context`] expands at compile time.
fn main() {
    register(tauri::Builder::default())
        .run(context())
        // Developer-facing, and therefore not translated: this fires only when
        // the webview itself cannot be created, before any interface — and so
        // any translation — exists to show a message in.
        .expect("failed to start the espansoConfig window");
}
