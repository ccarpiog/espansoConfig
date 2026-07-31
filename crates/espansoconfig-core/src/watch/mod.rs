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

use serde::de::{Deserialize, Deserializer, Error as DeError, Unexpected, Visitor};
use serde::{Serialize, Serializer};
use sha2::{Digest, Sha256};
use std::fmt;

/// A content-addressed identity for the exact bytes of a file on disk.
///
/// Used for two things: conflict detection (does the file still hold what we
/// based our edits on?) and self-write suppression (did *we* just write this?).
/// It hashes bytes rather than metadata deliberately — mtime is too coarse and
/// too easy to fake, and a byte-identical rewrite is not a conflict.
/// It is ordered so that types embedding it — `crate::model::MatchId` — can
/// stay `Ord` and therefore usable as a `BTreeMap` key. The order is the
/// digest's lexicographic byte order and means nothing beyond being total.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
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

    /// Parses a revision back from the 64-character lowercase hex string
    /// [`ContentRevision::to_hex`] produces.
    ///
    /// The inverse of the wire form, needed because a `crate::model::MatchId`
    /// carries a revision and is a **command argument** as well as a command
    /// result (plan section 6.4's `get_match`). Returns `None` for anything
    /// that is not exactly 64 hex digits, so a malformed token from the
    /// frontend becomes a typed rejection rather than a wrong identity.
    pub fn from_hex(text: &str) -> Option<ContentRevision> {
        if text.len() != 64 {
            return None;
        }
        let mut out = [0u8; 32];
        for (index, byte) in out.iter_mut().enumerate() {
            let pair = text.get(index * 2..index * 2 + 2)?;
            *byte = u8::from_str_radix(pair, 16).ok()?;
        }
        Some(ContentRevision(out))
    } // End of function from_hex()

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

impl Serialize for ContentRevision {
    /// Serializes as the 64-character lowercase hex string, not as 32 numbers.
    ///
    /// The revision is an **opaque concurrency token** the frontend hands back
    /// unchanged on every mutation (plan section 6.4). A hex string survives
    /// JSON, a JavaScript `string` comparison and a log line unaltered; a
    /// `number[]` would survive the first two and be unreadable in the third.
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_hex())
    }
}

/// Reads the hex form [`ContentRevision`]'s `Serialize` writes.
struct HexVisitor;

impl Visitor<'_> for HexVisitor {
    type Value = ContentRevision;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a 64-character hexadecimal content revision")
    }

    fn visit_str<E: DeError>(self, value: &str) -> Result<ContentRevision, E> {
        ContentRevision::from_hex(value)
            .ok_or_else(|| E::invalid_value(Unexpected::Str(value), &self))
    }
}

impl<'de> Deserialize<'de> for ContentRevision {
    /// Accepts exactly the hex string the `Serialize` impl writes.
    ///
    /// A revision the frontend hands back is an **opaque token**, so anything
    /// that is not one of ours is rejected here rather than turned into a
    /// digest that would silently fail to match any snapshot.
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<ContentRevision, D::Error> {
        deserializer.deserialize_str(HexVisitor)
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
