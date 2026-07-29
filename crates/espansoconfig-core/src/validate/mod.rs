//! Structural and espanso-semantic validation.
//!
//! **Phase 0a scope:** none. This module is a placeholder.
//!
//! **Later responsibility:** two distinct layers that must not be conflated.
//!
//! 1. **Structural** — is the candidate document still well-formed YAML, and
//!    does it reparse to the values we intended? This layer gates every save.
//! 2. **Espanso-semantic** — exactly one content field per match, a valid
//!    trigger side, known variable types, `depends_on` names that resolve, form
//!    fields that appear in their layout. These are warnings to the user, not
//!    reasons to refuse a write: espanso itself is the authority on its own
//!    config, and refusing to save a file espanso would accept would make the
//!    editor less useful than a text editor.
