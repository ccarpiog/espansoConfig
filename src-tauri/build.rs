//! Tauri's build script.
//!
//! It reads `tauri.conf.json` and the `capabilities/` directory and generates
//! the context `tauri::generate_context!()` expands to, so a malformed config
//! or an unknown permission is a build error rather than a runtime surprise.

fn main() {
    tauri_build::build();
}
