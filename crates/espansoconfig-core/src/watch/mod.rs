//! Filesystem watching and revision hashing.
//!
//! **Phase 0a** implemented [`ContentRevision`], because conflict detection
//! needs a stable content hash and the hash is trivially testable on its own.
//! **Phase 2d-1** added the watcher around it, split so that the hard part is
//! deterministic — in observation shapes, revisions and order; the identity
//! values inside a projection come from the process-wide session table, as
//! [`engine`]'s module docs state (`IMPLEMENTATION_PLAN.md` section 6.5; the
//! Phase 2d design consult's Q1):
//!
//! - [`liveness`] — **the liveness contract of the observation pipeline, in one
//!   place.** It declares nothing; its documentation *is* the contract, and
//!   every passage in either crate that needs the guarantee points at it rather
//!   than restating it. Phase 2d-3-C.
//! - [`engine`] — the observation engine. Hints in, typed observations out,
//!   with the **clock and the reader injected**: per-path debounce, two-read
//!   stability, exact hashing, projection and validation, membership rescan
//!   and snapshot-bound correspondence tables, none of it touching a real
//!   timer or (unless the caller injects one) a real filesystem.
//! - [`correspond`] — the snapshot-bound correspondence tables a `Changed`
//!   observation carries, built on `crate::reconcile`'s evidence.
//! - [`native`] — the `notify`-backed hint source over exactly
//!   `<root>/config` and `<root>/match` ([`watched_roots`]). The native
//!   callback contributes **path hints and nothing else**; every decision is
//!   the engine's.
//!
//! Watcher notifications are *hints, not truth*. Self-write suppression —
//! ignore a stable observation whose bytes hash to the revision the app just
//! committed — is the command layer's step, keyed by a ledger only the open
//! session can hold; [`self_write_suppresses`] is the predicate's one
//! definition and this crate stores no ledger. **This module has no caller in
//! 2d-1**: no command reaches it, exactly as `crate::persist::save_document`
//! had none at Phase 2a.

pub mod correspond;
pub mod engine;
pub mod liveness;
pub mod native;

use serde::de::{Deserialize, Deserializer, Error as DeError, Unexpected, Visitor};
use serde::{Serialize, Serializer};
use sha2::{Digest, Sha256};
use std::fmt;
use std::path::{Path, PathBuf};

/// The exact directories a watcher observes: `<root>/config` and `<root>/match`.
///
/// **These two, recursively, and never the configuration root itself** (the 2d
/// design consult's Q2). The backup root `.espansoconfig-backups` is a
/// deliberate *sibling* of both — that is what keeps batch creation, entry
/// copies, marker writes and rotation out of the watch stream by construction.
/// Watching the root and filtering afterwards would replace that construction
/// with a proof obligation over every backup temporary, and there is no reason
/// to accept it. One definition, used by the native adapter and by the
/// engine's own hint filter, so the two cannot drift apart.
pub fn watched_roots(root: &Path) -> [PathBuf; 2] {
    [root.join("config"), root.join("match")]
}

/// The self-write suppression predicate — byte identity, never authorship.
///
/// `true` exactly when `observed` equals `last_committed` — and because these
/// are two bare revisions, it is the **caller's obligation, not this
/// predicate's**, that `last_committed` is the latest committed revision
/// recorded for the *observed document* in the *current workspace epoch*:
/// handed an equal-hashing entry from another document, from a replaced
/// workspace, or one a later committed save has superseded, this function
/// answers `true` just the same and the observation is wrongly suppressed.
/// The truthful sentence, fixed by the 2d design consult's Q2: *this
/// application ignores a filesystem hint when the bytes now on disk hash to
/// the latest revision it recorded after committing that file; this proves the
/// text is identical, not who wrote it.* An external process rewriting
/// identical bytes is indistinguishable by this predicate, and ignoring it is
/// acceptable because the file text — the source of truth — did not change.
/// Nothing built on it may claim the event "was ours", that no external write
/// occurred, or that metadata stayed unchanged; hash equality proves byte
/// identity subject to the hash's collision limit.
///
/// The ledger whose correct selection the sentence above leans on — recording
/// `SavedDocument::revision` only on `committed: true`, keyed per document and
/// per workspace epoch, retention through the duplicate hints one atomic
/// replacement generates, replacement on the next committed save, discard on
/// workspace replacement — is the command layer's (Phase 2d-3), stored beside
/// the open session. **This crate stores no ledger**, and this function is the
/// predicate's one definition so 2d-3 cannot restate it differently.
pub fn self_write_suppresses(
    last_committed: Option<ContentRevision>,
    observed: ContentRevision,
) -> bool {
    last_committed == Some(observed)
}

/// A content-addressed identity for the exact bytes of a file on disk.
///
/// Used for two things: conflict detection (does the file still hold what we
/// based our edits on?) and self-write suppression (do the bytes now on disk
/// hash to the latest revision this application recorded after committing
/// that file? — byte identity, never authorship: an external write of
/// identical bytes is indistinguishable, as [`self_write_suppresses`] states).
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
    fn the_watched_roots_are_config_and_match_and_nothing_else() {
        let roots = watched_roots(Path::new("/tree"));
        assert_eq!(
            roots,
            [PathBuf::from("/tree/config"), PathBuf::from("/tree/match")]
        );
        // The backup root is a sibling of both, so component-wise prefix
        // matching excludes it without any filter existing.
        let backup = Path::new("/tree/.espansoconfig-backups/2026/match/a.yml");
        assert!(roots.iter().all(|root| !backup.starts_with(root)));
    } // End of function the_watched_roots_are_config_and_match_and_nothing_else()

    #[test]
    fn the_suppression_predicate_answers_byte_identity_not_authorship() {
        let committed = ContentRevision::of_bytes(b"matches: []\n");
        let other = ContentRevision::of_bytes(b"matches: [] \n");
        // No recorded app write suppresses nothing.
        assert!(!self_write_suppresses(None, committed));
        // The exact committed revision is suppressed…
        assert!(self_write_suppresses(Some(committed), committed));
        // …and any other revision is not, however close the bytes are.
        assert!(!self_write_suppresses(Some(committed), other));
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
    } // End of function hex_rendering_is_64_lowercase_characters()
}
