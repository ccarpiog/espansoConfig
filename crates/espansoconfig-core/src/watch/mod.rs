//! Filesystem watching and revision hashing.
//!
//! **Phase 0a scope:** [`ContentRevision`] is implemented, because conflict
//! detection needs a stable content hash and the hash is trivially testable on
//! its own. The debounced watcher itself is a later phase.
//!
//! **Later responsibility:** watch `config/` and `match/` and treat watcher
//! notifications as *hints, not truth* (`IMPLEMENTATION_PLAN.md` section 6.5):
//! debounce 150–300 ms, wait for content to stabilise across consecutive reads,
//! read and hash, and **ignore the event when the hash equals the revision the
//! app just wrote** — that is how the app avoids reacting to its own saves.
//! A clean draft reloads automatically; a dirty draft enters a conflict state in
//! which neither side is overwritten.

use sha2::{Digest, Sha256};
use std::fmt;

/// A content-addressed identity for the exact bytes of a file on disk.
///
/// Used for two things: conflict detection (does the file still hold what we
/// based our edits on?) and self-write suppression (did *we* just write this?).
/// It hashes bytes rather than metadata deliberately — mtime is too coarse and
/// too easy to fake, and a byte-identical rewrite is not a conflict.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ContentRevision([u8; 32]);

impl ContentRevision {
    /// Computes the revision of a byte slice.
    pub fn of_bytes(bytes: &[u8]) -> ContentRevision {
        let mut hasher = Sha256::new();
        hasher.update(bytes);
        let digest = hasher.finalize();
        let mut out = [0u8; 32];
        out.copy_from_slice(&digest);
        ContentRevision(out)
    }

    /// Returns the raw 32-byte digest.
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }

    /// Renders the revision as a lowercase hex string, for logs and IPC.
    pub fn to_hex(self) -> String {
        let mut hex = String::with_capacity(64);
        for byte in self.0 {
            use fmt::Write as _;
            // `write!` to a String cannot fail, so the result is discardable.
            let _ = write!(hex, "{byte:02x}");
        }
        hex
    }
}

impl fmt::Display for ContentRevision {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.to_hex())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identical_bytes_hash_equal_and_differing_bytes_do_not() {
        let a = ContentRevision::of_bytes(b"matches:\n  - trigger: ':hi'\n");
        let b = ContentRevision::of_bytes(b"matches:\n  - trigger: ':hi'\n");
        let c = ContentRevision::of_bytes(b"matches:\n  - trigger: ':ho'\n");
        assert_eq!(a, b);
        assert_ne!(a, c);
    }

    #[test]
    fn a_trailing_newline_change_is_a_different_revision() {
        // This matters: "no trailing newline" is a real corpus case and must
        // never be treated as the same content as the newline-terminated form.
        let with = ContentRevision::of_bytes(b"matches: []\n");
        let without = ContentRevision::of_bytes(b"matches: []");
        assert_ne!(with, without);
    }

    #[test]
    fn hex_rendering_is_64_lowercase_characters() {
        let hex = ContentRevision::of_bytes(b"").to_hex();
        assert_eq!(hex.len(), 64);
        assert!(hex
            .chars()
            .all(|c| c.is_ascii_digit() || ('a'..='f').contains(&c)));
        // Known SHA-256 of the empty input, as an independent cross-check.
        assert_eq!(
            hex,
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }
}
