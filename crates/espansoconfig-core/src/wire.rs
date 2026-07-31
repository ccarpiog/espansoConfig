//! The representation a filesystem path takes when it crosses the boundary.
//!
//! # Why this module exists
//!
//! `serde`'s own [`std::path::PathBuf`] serializer **fails** on a path that is
//! not valid UTF-8. On Unix a path is a bag of bytes, so such a path is a value
//! the type system admits — and a failure there arrives at the worst possible
//! moment: *after* a command has already returned `Ok`, while Tauri is turning
//! the response into JSON. The webview then receives the serializer's own
//! English prose instead of `{ code, operands }`, which contradicts plan
//! section 9 and the boundary claim in `src-tauri/src/commands.rs`. An error
//! value carrying the same path can fail the same way, so the failure has no
//! typed form to fall back to.
//!
//! [`WirePath`] removes the failure mode **by construction**: it serializes a
//! lossy Unicode rendering, which every path has, so no value of a wire type can
//! fail to serialize because of a path. The wrapper is a distinct type rather
//! than a `#[serde(serialize_with = …)]` attribute precisely so that the
//! compiler — not a reviewer — is what notices a new path field on a wire
//! struct.
//!
//! # What is given up, and what replaces it
//!
//! A lossy rendering is **not** reversible: two distinct paths differing only in
//! invalid bytes render identically, and handing one back to the filesystem
//! would name neither. So a wire path is **display data only**. The identity a
//! caller hands back is [`crate::DocumentId`], an opaque session-local integer
//! that is unaffected by what the path's bytes are. That split — a lossy string
//! for the eye, an opaque token for the machine — is the whole design.
//!
//! On the one platform this application currently targets the lossy branch is
//! unreachable in practice: APFS and HFS+ reject a filename that is not valid
//! UTF-8 with `EILSEQ`, so a non-Unicode name cannot be created. That makes the
//! guarantee cheap, not unnecessary: the type has to be total for the code that
//! reads it to be honest, and the tests construct such a path directly rather
//! than asking the filesystem for one it will not give.

use std::fmt;
use std::ops::Deref;
use std::path::{Path, PathBuf};

use serde::ser::SerializeSeq;
use serde::{Serialize, Serializer};

/// The lossy Unicode rendering of a path, which every path has.
///
/// Invalid sequences become `U+FFFD REPLACEMENT CHARACTER`. This is not prose
/// and needs no translation: it is the operating system's own name for a file,
/// with the bytes no encoding can name replaced by the character that exists to
/// stand for them.
pub fn lossy(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

/// A filesystem path that always serializes.
///
/// Wraps a real [`PathBuf`] — [`Deref`] gives every `Path` method, so code that
/// *uses* the path is unchanged — and overrides only what `serde` does with it.
/// See the module documentation for why the rendering is lossy and what carries
/// identity instead.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct WirePath(PathBuf);

impl WirePath {
    /// Wraps a path.
    pub fn new(path: impl Into<PathBuf>) -> WirePath {
        WirePath(path.into())
    }

    /// The path itself, with its bytes intact.
    pub fn as_path(&self) -> &Path {
        &self.0
    }

    /// The exact string that crosses the boundary.
    pub fn to_wire_string(&self) -> String {
        lossy(&self.0)
    }

    /// Unwraps to the owned path.
    pub fn into_path_buf(self) -> PathBuf {
        self.0
    }
} // End of impl WirePath

impl From<PathBuf> for WirePath {
    fn from(path: PathBuf) -> WirePath {
        WirePath(path)
    }
}

impl From<&Path> for WirePath {
    fn from(path: &Path) -> WirePath {
        WirePath(path.to_path_buf())
    }
}

impl From<WirePath> for PathBuf {
    fn from(path: WirePath) -> PathBuf {
        path.0
    }
}

impl Deref for WirePath {
    type Target = Path;

    fn deref(&self) -> &Path {
        &self.0
    }
}

impl AsRef<Path> for WirePath {
    fn as_ref(&self) -> &Path {
        &self.0
    }
}

impl PartialEq<Path> for WirePath {
    fn eq(&self, other: &Path) -> bool {
        self.0.as_path() == other
    }
}

impl PartialEq<&Path> for WirePath {
    fn eq(&self, other: &&Path) -> bool {
        self.0.as_path() == *other
    }
}

impl PartialEq<PathBuf> for WirePath {
    fn eq(&self, other: &PathBuf) -> bool {
        &self.0 == other
    }
}

impl fmt::Display for WirePath {
    /// The lossy rendering, for logs. Not a user-facing string: a path is a
    /// path in either language.
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.to_wire_string())
    }
}

impl Serialize for WirePath {
    /// Writes the lossy rendering. **Cannot fail on any path**, which is the
    /// entire point of the type.
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_wire_string())
    }
}

/// The borrowed form of [`WirePath`], for a hand-written `Serialize` impl.
///
/// The error types keep their fields as real [`PathBuf`]s because callers read
/// files with them; their `Serialize` impls wrap each path in one of these on
/// the way out, so the same totality holds without changing the field type.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WirePathRef<'a>(pub &'a Path);

impl Serialize for WirePathRef<'_> {
    /// Writes the lossy rendering. Cannot fail on any path.
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&lossy(self.0))
    }
}

/// A borrowed list of paths, serialized as a list of [`WirePathRef`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WirePaths<'a>(pub &'a [PathBuf]);

impl Serialize for WirePaths<'_> {
    /// Writes one lossy rendering per path. Cannot fail on any path.
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut sequence = serializer.serialize_seq(Some(self.0.len()))?;
        for path in self.0 {
            sequence.serialize_element(&WirePathRef(path))?;
        }
        sequence.end()
    }
}

#[cfg(test)]
mod tests {
    use super::{lossy, WirePath, WirePathRef, WirePaths};
    use std::path::{Path, PathBuf};

    /// A path whose basename is not valid UTF-8.
    ///
    /// Built from bytes rather than taken from the filesystem: macOS refuses to
    /// *create* such a name (`EILSEQ`), and the point of the type is that the
    /// serializer is total for every value the type admits, not only for the
    /// values this operating system happens to produce.
    #[cfg(unix)]
    fn non_utf8_path() -> PathBuf {
        use std::ffi::OsStr;
        use std::os::unix::ffi::OsStrExt;
        let mut path = PathBuf::from("/nowhere/match");
        path.push(OsStr::from_bytes(b"ba\xffse.yml"));
        path
    }

    /// The premise: `serde`'s own `PathBuf` serializer rejects such a path.
    ///
    /// Without this assertion every other test in this module could pass with
    /// [`WirePath`] deleted and the plain `PathBuf` left in place.
    #[test]
    #[cfg(unix)]
    fn serdes_own_path_serializer_rejects_a_non_utf8_path() {
        let path = non_utf8_path();
        assert!(
            serde_json::to_value(&path).is_err(),
            "if this ever succeeds, WirePath is solving a problem that no longer exists"
        );
    }

    /// The property: a wire path serializes whatever its bytes are.
    #[test]
    #[cfg(unix)]
    fn a_wire_path_serializes_a_non_utf8_path() {
        let path = non_utf8_path();
        let wrapped = WirePath::from(path.clone());
        let value = serde_json::to_value(&wrapped).expect("a wire path must always serialize");
        let rendered = value.as_str().expect("a wire path crosses as a string");
        assert!(
            rendered.contains('\u{fffd}'),
            "the invalid byte must arrive as the replacement character: {rendered}"
        );
        assert!(
            rendered.ends_with("se.yml"),
            "the rest is intact: {rendered}"
        );

        let borrowed = serde_json::to_value(WirePathRef(&path)).expect("the borrowed form too");
        assert_eq!(borrowed, value, "the two forms must render identically");

        let list = serde_json::to_value(WirePaths(std::slice::from_ref(&path)))
            .expect("a list of wire paths must always serialize");
        assert_eq!(list, serde_json::json!([value]));
    } // End of function a_wire_path_serializes_a_non_utf8_path()

    /// A valid path is unchanged, so the wire form of every real path is what
    /// it always was.
    #[test]
    fn a_valid_path_crosses_exactly_as_serde_would_have_written_it() {
        let path = PathBuf::from("/nowhere/match/base.yml");
        assert_eq!(
            serde_json::to_value(WirePath::from(path.clone())).expect("a wire path serializes"),
            serde_json::to_value(&path).expect("a valid path serializes either way")
        );
        assert_eq!(lossy(&path), "/nowhere/match/base.yml");
    }

    /// The wrapper is still a path everywhere a path is used.
    #[test]
    fn a_wire_path_derefs_to_the_path_it_wraps() {
        let wrapped = WirePath::new("/nowhere/match/base.yml");
        assert_eq!(
            wrapped.file_name().and_then(std::ffi::OsStr::to_str),
            Some("base.yml")
        );
        assert_eq!(wrapped, *Path::new("/nowhere/match/base.yml"));
        assert_eq!(wrapped.as_path(), Path::new("/nowhere/match/base.yml"));
    }
}
