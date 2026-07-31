//! The IPC surface — thin wrappers over [`espansoconfig_core`].
//!
//! **Deliberately empty in Phase 1b-1.** The commands themselves are 1b-2, and
//! writing them before the frontend that calls them would mean guessing at
//! shapes the plan already fixes. What 1b-2 adds here, and nothing more, is
//! plan section 6.4's *read-only* set: `open_workspace`, `list_documents`,
//! `get_document`, `get_match` and `reload_document`, each a one-to-one wrapper
//! over `espansoconfig_core::workspace::Workspace`.
//!
//! Three constraints this module inherits and must not quietly drop:
//!
//! - **No mutating command exists yet.** Saving is Phase 2 and the save
//!   transaction it needs is not written. A command that writes a file must not
//!   appear here before that transaction does.
//! - **`Workspace` takes `&mut self`** where it fills its cache, so the state
//!   this module registers with Tauri holds it behind a `Mutex`.
//! - **Rust returns codes, never prose** (plan section 9). Every error crossing
//!   this boundary is a serializable code plus operands; the `Display` impls in
//!   the core are developer renderings for logs and are not the IPC
//!   representation.

#[cfg(test)]
mod tests {
    use std::path::Path;

    /// The core dependency resolves and is callable **from the test target**.
    ///
    /// That is the whole of the claim, and the name says so because the
    /// stronger one would be false: this is the only reference to
    /// `espansoconfig_core` in the crate and it sits behind `#[cfg(test)]`, so
    /// **a production build of this shell contains no reference to the core at
    /// all**. This test would pass unchanged if it did not. What it does prove
    /// is that the dependency edge in `Cargo.toml` resolves and that 1b-2 can
    /// add commands without touching the manifest.
    ///
    /// It calls the pure resolver in
    /// `crates/espansoconfig-core/src/discovery.rs` rather than anything
    /// environment-dependent, so it has no opinion about whether espanso is
    /// installed on the machine running it.
    #[test]
    fn the_core_dependency_is_callable_from_the_test_target() {
        let resolved = espansoconfig_core::discovery::resolve_config_dir(
            None,
            Some(Path::new("/nonexistent-xdg-config-home")),
            Some(Path::new("/nonexistent-home")),
        );
        assert!(
            resolved.is_err(),
            "neither probe path exists, so resolution must fail rather than invent a directory"
        );
    }
}
