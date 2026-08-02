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
//! `commands::delete_match` (both 2b-2c-2) and `commands::save_raw_document`
//! (2b-2c-3b) are the five commands that can write a user's file, and every one
//! of them does it through `espansoconfig_core::persist::save_document` and
//! through nothing else — see `commands` for why there is exactly one entry
//! point. The fifth is the last of Phase 2b-2c: with it, every command Phase 2b
//! was scoped to deliver exists.

#![deny(missing_docs)]
// The app is macOS-only for now (plan section 10), so no Windows subsystem
// attribute is set here. Add one before the first Windows build, not before.

mod commands;
#[cfg(test)]
mod dictionary_contract;
#[cfg(test)]
mod dispatch_check;
mod error;
mod events;
mod menu;
#[cfg(test)]
mod menu_contract;
#[cfg(test)]
mod rust_source;
mod save;
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

/// Registers the six read-only commands, the five that write, the menu command,
/// and the state they share.
///
/// Shared with `dispatch_check.rs` so that the tested application is the built
/// application: a command registered in `main` and absent from the test's
/// builder would make the test's evidence a statement about a different
/// program.
///
/// The first six are the read-only workspace surface — read a workspace, list
/// its files, project one, project one match, read one's bytes, re-read one —
/// and nothing in that half can write to the disk. `move_match`, `save_match`,
/// `create_match`, `delete_match` and `save_raw_document` can, and every one of
/// them does it through `espansoconfig_core::persist::save_document` and through
/// nothing else. The twelfth, `set_menu_labels`, writes nothing either: it hands
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
/// none of the twelve is a plugin command. `core:menu`'s permissions exist for a
/// frontend that builds menus through `@tauri-apps/api/menu`; this one does
/// not, and asks Rust for a rebuild instead, so the empty permission list that
/// Phase 1b-1's review narrowed to stays exactly as narrow and `core:default`
/// stays gone. That paragraph is an argument; `dispatch_check.rs` is the
/// evidence — and it is re-run for every command added, `document_text`
/// included, rather than the argument being extended to cover it.
fn register<R: tauri::Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder
        .manage(commands::WorkspaceSession::new())
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
