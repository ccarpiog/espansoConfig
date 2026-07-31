//! The espansoConfig application shell.
//!
//! This crate owns the window, the webview and the IPC boundary, and nothing
//! else. Every decision about YAML lives in `espansoconfig-core`, which never
//! depends on tauri (CLAUDE.md section 3) — the dependency runs one way, and
//! `cargo tree -p espansoconfig-core | rg tauri` finding nothing is the check
//! that says so.
//!
//! Phase 1b-1 scaffolds this crate and stops. There is no command and no event
//! yet; see `commands` and `events` for what each will hold and why neither
//! could honestly be written first.

#![deny(missing_docs)]
// The app is macOS-only for now (plan section 10), so no Windows subsystem
// attribute is set here. Add one before the first Windows build, not before.

mod commands;
mod events;

/// Starts the application.
///
/// `generate_context!` expands the configuration the build script read, so a
/// bad `tauri.conf.json` or an unknown capability fails the build rather than
/// the launch.
fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        // Developer-facing, and therefore not translated: this fires only when
        // the webview itself cannot be created, before any interface — and so
        // any translation — exists to show a message in.
        .expect("failed to start the espansoConfig window");
}
