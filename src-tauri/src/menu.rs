//! The macOS application menu, built in Rust out of labels written in the
//! frontend.
//!
//! Plan section 9 asks for the whole interface in English and Spanish, and
//! CLAUDE.md section 2 forbids hardcoding any user-facing string. Tauri v2
//! builds the macOS menu in **Rust** — `tauri::menu::Menu::default()` installs
//! an English one at startup — so localizing it means one of two things:
//! writing the labels into this file, or having the frontend hand them across
//! IPC. The first is exactly what the plan forbids; it would put a second,
//! unaudited string table in a place `src/lib/i18n/{en,es}.json` cannot see and
//! no check in this repository could read. So the labels cross the boundary,
//! and this module holds none of its own.
//!
//! **This file contains no string literal at all**, and that is a checked
//! property rather than a habit: `crate::menu_contract` lexes it and fails if a
//! single string literal survives outside an attribute. A hardcoded English
//! label in `src-tauri/src/*.rs` is invisible to
//! `scripts/lint/hardcoded-strings.ts`, which reads `.svelte` **markup** only —
//! `1b-1`'s review found an English sentence in `Info.plist` that no check could
//! ever have seen, and this module is the shape that would repeat it.
//!
//! # Why the labels are one struct with no defaults
//!
//! [`MenuLabels`] declares every label as a required `String` and is
//! `deny_unknown_fields`. A frontend that forgets one is refused before this
//! module builds anything, so there is no path on which an item falls back to
//! muda's built-in English text. Every [`tauri::menu::PredefinedMenuItem`] below
//! is therefore constructed with `Some(labels.…)`, never `None`;
//! `crate::menu_contract` checks that too, because a new item added with `None`
//! would compile, look right and ship an untranslated label.
//!
//! # Why the command takes an untyped envelope
//!
//! It did not, and Phase 1b-2b's review found what that cost. With
//! `labels: MenuLabels` in the signature, a frontend one release behind was
//! refused **inside Tauri's command macro**, which answers with its own English
//! sentence — ``invalid args `labels` for command `set_menu_labels`: missing
//! field `quit` `` — carrying no `code`. That is serde prose reaching the
//! webview, which plan section 9 forbids and which `1b-2a-notes.md` section 3
//! had already fixed once for `WirePath`. The command now takes a
//! [`serde_json::Value`] and does the deserialization itself, so a version skew
//! is [`CommandError::InvalidMenuLabels`] with the field names on both sides.
//!
//! # Why the work is posted to the main thread, and why waiting is safe
//!
//! `muda::Menu::new` panics — *"`muda::Menu` can only be created on the main
//! thread"* — anywhere but the main thread, because it allocates `NSMenu`
//! objects. Tauri runs a synchronous command on the main thread today, so
//! building the menu inline would usually work; "usually" is not a property to
//! rest an AppKit call on, and it is not true of every caller a later phase
//! might add. [`set_menu_labels`] therefore posts the whole build onto the main
//! thread.
//!
//! **And it waits for the answer**, which the first version did not: it returned
//! as soon as the post was accepted, so a failure inside the closure left the
//! previous menu up and told nobody. Waiting looks like a deadlock — a task
//! posted to the main thread, awaited by a command that may itself be on the
//! main thread — and it is not, for a reason that was read out of the runtime
//! rather than assumed. `tauri_runtime_wry::send_user_message` is
//!
//! ```text
//! if current_thread().id() == context.main_thread_id { handle_user_message(…) }
//! else { context.proxy.send_event(message) }
//! ```
//!
//! so `run_on_main_thread` **from** the main thread runs the closure inline and
//! returns after it has already sent. Off the main thread, the event loop is
//! free to run it. `MockRuntime` does the same thing for the same reason
//! (`send_message` runs a `Message::Task` inline while the loop is not running),
//! which is why `crate::dispatch_check` does not hang either. If the closure is
//! dropped without running — the event loop went away between the post and the
//! run — the sender drops, `recv` fails, and that is
//! [`CommandError::MenuUnavailable`] rather than a wait with no end.

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::menu::{Menu, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Runtime};

use crate::error::CommandError;

/// Every label one build of the application menu needs.
///
/// One field per item the menu shows, named exactly as the wire spells it and
/// exactly as `src/lib/i18n/{en,es}.json` spells the second half of its
/// `menu.<field>` key. One spelling, no formula, and `crate::menu_contract`
/// compares the three sides.
///
/// **Every field is required and unknown fields are refused.** A label the
/// frontend forgets is a typed refusal at the boundary rather than an item
/// quietly wearing muda's English default, and a label the frontend invents is a
/// refusal rather than a value silently dropped.
///
/// Deriving `Deserialize` here does not widen the named list `PROGRESS.md` R28
/// pins: that list is about `espansoconfig-core`'s model types, whose
/// constructors carry invariants a deserializer would bypass. This struct lives
/// in the shell, holds sixteen plain strings, and is a command *argument* —
/// which is the one category R28 exists to admit. `Serialize` is derived for
/// [`declared_label_fields`] alone, and writes nothing to any wire.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct MenuLabels {
    /// The application submenu's "about this application" item.
    pub about: String,
    /// The system services submenu's item.
    pub services: String,
    /// Hides this application.
    pub hide: String,
    /// Hides every other application.
    pub hide_others: String,
    /// Shows every hidden application.
    pub show_all: String,
    /// Quits this application.
    pub quit: String,
    /// The edit submenu's own title.
    pub edit: String,
    /// Reverts the last edit in a text field.
    pub undo: String,
    /// Reapplies a reverted edit.
    pub redo: String,
    /// Moves the selection to the clipboard.
    pub cut: String,
    /// Copies the selection to the clipboard.
    pub copy: String,
    /// Inserts the clipboard at the selection.
    pub paste: String,
    /// Selects everything in the focused field.
    pub select_all: String,
    /// The window submenu's own title.
    pub window: String,
    /// Sends the window to the Dock.
    pub minimize: String,
    /// Closes the window.
    pub close_window: String,
} // End of struct MenuLabels

/// Every field name [`MenuLabels`] declares, taken from the declaration itself.
///
/// **The struct literal is the check.** A field added to [`MenuLabels`] makes
/// this function fail to compile, so the list can never fall behind the
/// declaration — which is what a `const FIELDS: [&str; 16]` would have risked,
/// besides being sixteen string literals in the one file that is allowed none.
/// `String::new()` carries no literal either, and neither does a field name in a
/// struct literal: it is an identifier.
///
/// `crate::menu_contract` asserts that what this returns is exactly what the
/// declaration says, so the round trip through `serde` cannot quietly answer
/// something else.
pub(crate) fn declared_label_fields() -> BTreeSet<String> {
    let probe = MenuLabels {
        about: String::new(),
        services: String::new(),
        hide: String::new(),
        hide_others: String::new(),
        show_all: String::new(),
        quit: String::new(),
        edit: String::new(),
        undo: String::new(),
        redo: String::new(),
        cut: String::new(),
        copy: String::new(),
        paste: String::new(),
        select_all: String::new(),
        window: String::new(),
        minimize: String::new(),
        close_window: String::new(),
    };
    serde_json::to_value(&probe)
        .ok()
        .and_then(|value| value.as_object().map(|map| map.keys().cloned().collect()))
        .unwrap_or_default()
} // End of function declared_label_fields()

/// Turns the wire's envelope into a label set, or says why it is not one.
///
/// The refusal is a **code with operands** rather than serde's own English:
/// `missing` and `unexpected` are field names, computed by comparing the keys
/// that arrived against the ones [`MenuLabels`] declares. Both are empty when
/// every field is present and one of them is not a string — the code still says
/// the labels are not this build's label set, which is the whole of what a
/// caller can act on.
fn parse_labels(envelope: Value) -> Result<MenuLabels, CommandError> {
    let declared = declared_label_fields();
    let received: BTreeSet<String> = envelope
        .as_object()
        .map(|map| map.keys().cloned().collect())
        .unwrap_or_default();
    serde_json::from_value::<MenuLabels>(envelope).map_err(|_| CommandError::InvalidMenuLabels {
        missing: declared.difference(&received).cloned().collect(),
        unexpected: received.difference(&declared).cloned().collect(),
    })
} // End of function parse_labels()

/// Builds the whole menu from one set of labels.
///
/// Three submenus and no more, which is the smallest set that keeps macOS's
/// standard keyboard behaviour working: the application submenu owns ⌘Q, the
/// edit submenu is what makes ⌘X/⌘C/⌘V/⌘A reach a focused text field on macOS,
/// and the window submenu owns ⌘M and ⌘W. A view submenu and a help submenu
/// would each be a fourth and a fifth label group for behaviour this
/// application does not have — full screen is on the window's own green button,
/// and there is no help book to open.
///
/// The application submenu's title is the package name rather than a label,
/// because macOS renders the first submenu's title from the bundle and because
/// the product name is a proper noun that is the same in both languages —
/// `app.name` is already on `1b-1-notes.md` section 8's deliberately
/// untranslated list.
///
/// **Must run on the main thread.** See the module documentation.
fn build_menu<R: Runtime>(app: &AppHandle<R>, labels: &MenuLabels) -> tauri::Result<Menu<R>> {
    let application = Submenu::with_items(
        app,
        app.package_info().name.clone(),
        true,
        &[
            &PredefinedMenuItem::about(app, Some(labels.about.as_str()), None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, Some(labels.services.as_str()))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, Some(labels.hide.as_str()))?,
            &PredefinedMenuItem::hide_others(app, Some(labels.hide_others.as_str()))?,
            &PredefinedMenuItem::show_all(app, Some(labels.show_all.as_str()))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, Some(labels.quit.as_str()))?,
        ],
    )?;
    let edit = Submenu::with_items(
        app,
        labels.edit.as_str(),
        true,
        &[
            &PredefinedMenuItem::undo(app, Some(labels.undo.as_str()))?,
            &PredefinedMenuItem::redo(app, Some(labels.redo.as_str()))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, Some(labels.cut.as_str()))?,
            &PredefinedMenuItem::copy(app, Some(labels.copy.as_str()))?,
            &PredefinedMenuItem::paste(app, Some(labels.paste.as_str()))?,
            &PredefinedMenuItem::select_all(app, Some(labels.select_all.as_str()))?,
        ],
    )?;
    let window = Submenu::with_items(
        app,
        labels.window.as_str(),
        true,
        &[
            &PredefinedMenuItem::minimize(app, Some(labels.minimize.as_str()))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, Some(labels.close_window.as_str()))?,
        ],
    )?;
    Menu::with_items(app, &[&application, &edit, &window])
} // End of function build_menu()

/// Rebuilds the application menu in the language the interface is showing.
///
/// The frontend calls this once at startup and again on every locale change
/// (`src/lib/menu.ts`), which is what makes the menu follow the language picker
/// without this crate owning a second locale negotiation that could disagree
/// with the one in `src/lib/stores/locale.svelte.ts`.
///
/// **`Ok(())` now means a menu was installed**, not merely that the work was
/// accepted. The module documentation records why waiting on the posted closure
/// cannot deadlock.
///
/// # Errors
///
/// - [`CommandError::InvalidMenuLabels`] when the envelope is not this build's
///   label set — the version-skew refusal, with the field names on both sides.
/// - [`CommandError::MenuUnavailable`] when the main thread will not accept the
///   work, or accepts it and then drops it: the event loop is gone, which in
///   practice means the application is shutting down.
/// - [`CommandError::MenuBuildFailed`] when the closure ran and AppKit refused.
///   muda's macOS implementation does not return an error on these paths today,
///   so this is the code that exists to stop *tomorrow's* failure being silent.
#[tauri::command]
pub fn set_menu_labels<R: Runtime>(app: AppHandle<R>, labels: Value) -> Result<(), CommandError> {
    let labels = parse_labels(labels)?;
    let handle = app.clone();
    on_main_thread(&app, move || {
        build_menu(&handle, &labels)
            .and_then(|menu| handle.set_menu(menu).map(|_| ()))
            .map_err(|_| ())
    })
} // End of function set_menu_labels()

/// Runs AppKit work on the main thread and answers with what it actually did.
///
/// **Separate from [`set_menu_labels`] so that it can be tested.** Nothing in
/// libtest can build a `muda::Menu`, so a test can never observe the real
/// closure failing; what it *can* observe is this function's contract — that a
/// closure answering `Err` becomes [`CommandError::MenuBuildFailed`] rather than
/// `Ok(())`. `crate::dispatch_check` drives both arms with a closure of its own,
/// which is what makes the review's fifth finding falsifiable instead of merely
/// asserted. A `Result<(), ()>` rather than a `tauri::Result` because nothing
/// but the *fact* of failure may cross: a tauri error's message is a developer
/// string, and plan section 9 keeps those off this boundary.
///
/// Waiting here cannot deadlock, and the module documentation is where the
/// runtime source that says so is quoted.
pub(crate) fn on_main_thread<R: Runtime>(
    app: &AppHandle<R>,
    work: impl FnOnce() -> Result<(), ()> + Send + 'static,
) -> Result<(), CommandError> {
    let (sender, receiver) = std::sync::mpsc::channel::<Result<(), ()>>();
    app.run_on_main_thread(move || {
        let _ = sender.send(work());
    })
    .map_err(|_| CommandError::MenuUnavailable)?;
    match receiver.recv() {
        Ok(Ok(())) => Ok(()),
        Ok(Err(())) => Err(CommandError::MenuBuildFailed),
        Err(_) => Err(CommandError::MenuUnavailable),
    }
} // End of function on_main_thread()
