//! The sidecar's on-disk format, version 1, and its lossless path encoding.
//!
//! # The file
//!
//! ```text
//! {
//!   "schemaVersion": 1,
//!   "root": "u:/Users/someone/Library/Application Support/espanso",
//!   "files": {
//!     "u:match/base.yml": {
//!       "displayName": "Everyday",
//!       "sortOrder": 3,
//!       "newSnippetDefaults": { "word": "true", "force_mode": "" },
//!       "orphanedSince": 1790000000
//!     }
//!   }
//! }
//! ```
//!
//! Every field of an entry is optional. `newSnippetDefaults` maps one of the
//! seven bulk-option keys (ruling 20) to **text**, never to a boolean (ruling
//! 28): a key that is absent is an absent default, and a key mapped to `""` is
//! an empty one, and the two stay distinct on disk and on the wire.
//! `orphanedSince` is the Unix second at which this application first saw the
//! entry's file missing from the workspace (see `crate::sidecar`'s orphan
//! policy).
//!
//! Version 1 is read strictly: an unknown field anywhere, a key that is not a
//! canonical encoding, a default keyed by anything but one of the seven option
//! keys, or a `root` that is not this workspace's makes the file **corrupt**.
//! A `schemaVersion` above 1 makes it a **future** file, which is never
//! interpreted and never rewritten. A `schemaVersion` that is not a
//! non-negative integer representable in 64 bits, or is 0, is corrupt.
//!
//! # The lossless encoding
//!
//! A path is a byte string on macOS, and a JSON string cannot hold arbitrary
//! bytes. So every path this format stores — the workspace root and every
//! relative key — is written as one of two spellings:
//!
//! - `u:` followed by the path itself, when its bytes are valid UTF-8;
//! - `x:` followed by the lowercase hexadecimal of its bytes, otherwise.
//!
//! The choice is a function of the bytes, so one byte string has exactly one
//! spelling, and [`decode_key`] refuses the other one (an `x:` key whose bytes
//! are valid UTF-8, or uppercase hex) as non-canonical. Two different byte
//! strings therefore never share a key, and one byte string never has two.
//!
//! # The file name
//!
//! `<sha256 hex>.json`, the digest taken over the domain line
//! `espansoconfig-sidecar-root/1\n` followed by the encoded **canonical** root.
//! The domain line versions the naming scheme independently of the file's own
//! `schemaVersion`. A moved or renamed workspace canonicalizes to another path,
//! hashes to another name, and so opens a fresh sidecar (ruling 26, split-notes
//! §5 row 7); the old file stays where it was.

use std::collections::BTreeMap;
use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

use espansoconfig_core::draft::BulkOption;

/// The only schema version this build reads and writes.
pub const SCHEMA_VERSION: u64 = 1;

/// The domain line the root digest is taken over, versioning the naming scheme.
const ROOT_HASH_DOMAIN: &str = "espansoconfig-sidecar-root/1\n";

/// The prefix of a path whose bytes are valid UTF-8.
const TEXT_PREFIX: &str = "u:";

/// The prefix of a path whose bytes are not valid UTF-8.
const BYTES_PREFIX: &str = "x:";

/// The canonical spelling of one byte string (see the module documentation).
pub fn encode_bytes(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(text) => format!("{TEXT_PREFIX}{text}"),
        Err(_) => {
            let mut spelled = String::with_capacity(BYTES_PREFIX.len() + bytes.len() * 2);
            spelled.push_str(BYTES_PREFIX);
            for byte in bytes {
                spelled.push_str(&format!("{byte:02x}"));
            }
            spelled
        }
    }
} // End of function encode_bytes()

/// The byte string a key spells, or `None` for a key that is not the
/// canonical spelling of any byte string.
pub fn decode_key(key: &str) -> Option<Vec<u8>> {
    if let Some(text) = key.strip_prefix(TEXT_PREFIX) {
        return Some(text.as_bytes().to_vec());
    }
    let hex = key.strip_prefix(BYTES_PREFIX)?;
    if hex.len() % 2 != 0
        || !hex
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return None;
    }
    let bytes: Vec<u8> = (0..hex.len())
        .step_by(2)
        .map(|at| u8::from_str_radix(&hex[at..at + 2], 16))
        .collect::<Result<_, _>>()
        .ok()?;
    // Valid UTF-8 has exactly one spelling, and it is not this one.
    if std::str::from_utf8(&bytes).is_ok() {
        return None;
    }
    Some(bytes)
} // End of function decode_key()

/// The canonical spelling of a path's own bytes.
///
/// Unix only, as the application is (plan section 10): on a Unix target a path
/// **is** its bytes, so nothing is lost. `OsStrExt` does not exist elsewhere,
/// and this function is where a Windows port would have to choose an encoding.
pub fn encode_path(path: &Path) -> String {
    use std::os::unix::ffi::OsStrExt as _;
    encode_bytes(path.as_os_str().as_bytes())
}

/// Which sidecar file belongs to one workspace: the encoded canonical root and
/// the digest the file is named after.
///
/// **The only thing a writer is handed to say which file to write**, and it
/// cannot name a directory: its one constructor hashes, so the name it yields is
/// always 64 lowercase hexadecimal characters and `.json`, and the directory is
/// the store's own.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceKey {
    /// The canonical root, in the lossless spelling.
    encoded_root: String,
    /// The lowercase hexadecimal SHA-256 of the domain line and the encoded root.
    digest: String,
}

impl WorkspaceKey {
    /// The key of the workspace whose **already canonicalized** root is `root`.
    ///
    /// Canonicalizing is the caller's step, because it reads the disk and can
    /// fail; `crate::sidecar` does it and reports a failure as its own status.
    pub fn of_canonical_root(root: &Path) -> WorkspaceKey {
        let encoded_root = encode_path(root);
        let mut hasher = Sha256::new();
        hasher.update(ROOT_HASH_DOMAIN.as_bytes());
        hasher.update(encoded_root.as_bytes());
        let digest = hasher
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        WorkspaceKey {
            encoded_root,
            digest,
        }
    } // End of function of_canonical_root()

    /// The encoded canonical root, as the file records it.
    pub fn encoded_root(&self) -> &str {
        &self.encoded_root
    }

    /// The digest, which is the file's name without its extension.
    pub fn digest(&self) -> &str {
        &self.digest
    }

    /// The sidecar file's name: the digest and `.json`.
    pub fn file_name(&self) -> String {
        format!("{}.json", self.digest)
    }
} // End of impl WorkspaceKey

/// What one file of the workspace carries. Every field is optional.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FileEntry {
    /// The person's label for the file. User data, never translated.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    /// The person's position for the file in the sidebar's ordering.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sort_order: Option<u32>,
    /// New-snippet defaults: option key to source **text**. Absent key, absent
    /// default; `""`, an empty one.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub new_snippet_defaults: BTreeMap<BulkOption, String>,
    /// The Unix second this entry's file was first seen missing, while it is.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub orphaned_since: Option<u64>,
}

impl FileEntry {
    /// Whether the entry holds no preference at all, so keeping it would record
    /// nothing but, at most, an orphan mark.
    pub fn holds_nothing(&self) -> bool {
        self.display_name.is_none()
            && self.sort_order.is_none()
            && self.new_snippet_defaults.is_empty()
    }
} // End of impl FileEntry

/// The interpreted content of one version-1 sidecar: entries by encoded
/// relative path.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SidecarFile {
    /// Every entry, keyed by the lossless spelling of its relative path.
    pub files: BTreeMap<String, FileEntry>,
}

/// The whole version-1 document, as serde reads and writes it.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct OnDisk {
    /// Always [`SCHEMA_VERSION`] when written.
    schema_version: u64,
    /// The encoded canonical root the file belongs to.
    root: String,
    /// Entries by encoded relative path.
    files: BTreeMap<String, FileEntry>,
}

/// What a sidecar's bytes turned out to be.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Parsed {
    /// A valid version-1 file belonging to this workspace.
    Current(SidecarFile),
    /// A file declaring a newer schema, recorded in decimal. Not interpreted.
    Future {
        /// The declared version.
        version: String,
    },
    /// Anything else.
    Corrupt,
}

/// Interprets a sidecar's bytes for the workspace `key` names.
pub fn parse(bytes: &[u8], key: &WorkspaceKey) -> Parsed {
    let Ok(value) = serde_json::from_slice::<Value>(bytes) else {
        return Parsed::Corrupt;
    };
    let Some(declared) = value
        .as_object()
        .and_then(|object| object.get("schemaVersion"))
    else {
        return Parsed::Corrupt;
    };
    match declared.as_u64() {
        Some(SCHEMA_VERSION) => {}
        Some(version) if version > SCHEMA_VERSION => {
            return Parsed::Future {
                version: version.to_string(),
            }
        }
        _ => return Parsed::Corrupt,
    }
    let Ok(document) = serde_json::from_value::<OnDisk>(value) else {
        return Parsed::Corrupt;
    };
    if document.root != key.encoded_root() {
        return Parsed::Corrupt;
    }
    if document
        .files
        .keys()
        .any(|entry_key| decode_key(entry_key).is_none_or(|bytes| bytes.is_empty()))
    {
        return Parsed::Corrupt;
    }
    Parsed::Current(SidecarFile {
        files: document.files,
    })
} // End of function parse()

/// The bytes of `file` as a version-1 sidecar for the workspace `key` names.
pub fn render(file: &SidecarFile, key: &WorkspaceKey) -> Vec<u8> {
    let document = OnDisk {
        schema_version: SCHEMA_VERSION,
        root: key.encoded_root().to_owned(),
        files: file.files.clone(),
    };
    let mut bytes = serde_json::to_vec_pretty(&document)
        .expect("a map of strings, integers and option keys always serializes");
    bytes.push(b'\n');
    bytes
} // End of function render()

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsStr;
    use std::os::unix::ffi::OsStrExt as _;

    /// A key for a synthetic root that need not exist.
    fn key() -> WorkspaceKey {
        WorkspaceKey::of_canonical_root(Path::new("/synthetic/config"))
    }

    #[test]
    fn a_utf8_path_and_a_non_utf8_path_each_round_trip_through_one_spelling() {
        let text = Path::new("match/caf\u{e9}.yml");
        assert_eq!(encode_path(text), "u:match/caf\u{e9}.yml");
        assert_eq!(
            decode_key(&encode_path(text)).as_deref(),
            Some(text.as_os_str().as_bytes())
        );
        // Latin-1 é, which is not UTF-8: macOS's APFS refuses to create such a
        // name, so this is a unit test over the bytes rather than a file.
        let raw: &[u8] = b"match/caf\xe9.yml";
        let non_utf8 = Path::new(OsStr::from_bytes(raw));
        let spelled = encode_path(non_utf8);
        assert_eq!(spelled, "x:6d617463682f636166e92e796d6c");
        assert_eq!(decode_key(&spelled).as_deref(), Some(raw));
        assert_ne!(encode_path(text), spelled, "two byte strings, two keys");
    } // End of function a_utf8_path_and_a_non_utf8_path_each_round_trip_through_one_spelling()

    #[test]
    fn a_non_canonical_spelling_is_refused() {
        // The bytes of "a.yml" spelled as hex: valid UTF-8 has only the u: form.
        assert_eq!(decode_key("x:612e796d6c"), None);
        assert_eq!(decode_key("x:E9"), None, "uppercase hex is not canonical");
        assert_eq!(decode_key("x:e"), None, "an odd length spells no bytes");
        assert_eq!(decode_key("match/a.yml"), None, "no prefix, no spelling");
        assert_eq!(decode_key("x:e9"), Some(vec![0xe9]));
    }

    #[test]
    fn the_file_name_is_a_digest_of_the_encoded_root() {
        let one = key();
        assert_eq!(one.digest().len(), 64);
        assert!(one
            .digest()
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte)));
        assert_eq!(one.file_name(), format!("{}.json", one.digest()));
        assert_eq!(one, key(), "stable for one root");
        let moved = WorkspaceKey::of_canonical_root(Path::new("/synthetic/moved"));
        assert_ne!(one.digest(), moved.digest(), "a moved root is another file");
        let raw = WorkspaceKey::of_canonical_root(Path::new(OsStr::from_bytes(b"/r\xe9")));
        assert_eq!(raw.encoded_root(), "x:2f72e9");
    }

    #[test]
    fn a_rendered_file_parses_back_to_itself() {
        let mut file = SidecarFile::default();
        let mut entry = FileEntry {
            display_name: Some("Everyday".to_owned()),
            sort_order: Some(3),
            ..FileEntry::default()
        };
        entry
            .new_snippet_defaults
            .insert(BulkOption::Word, "true".to_owned());
        entry
            .new_snippet_defaults
            .insert(BulkOption::ForceMode, String::new());
        file.files.insert("u:match/base.yml".to_owned(), entry);
        file.files.insert(
            "x:e9".to_owned(),
            FileEntry {
                orphaned_since: Some(7),
                sort_order: Some(1),
                ..FileEntry::default()
            },
        );
        let bytes = render(&file, &key());
        let text = String::from_utf8(bytes.clone()).expect("JSON is UTF-8");
        assert!(
            text.contains("\"force_mode\": \"\""),
            "empty stays empty: {text}"
        );
        assert!(!text.contains("true,"), "no boolean anywhere: {text}");
        assert_eq!(parse(&bytes, &key()), Parsed::Current(file));
    } // End of function a_rendered_file_parses_back_to_itself()

    #[test]
    fn version_and_shape_decide_current_future_or_corrupt() {
        let root = key().encoded_root().to_owned();
        let with = |body: String| parse(body.as_bytes(), &key());
        assert_eq!(
            with(format!(
                "{{\"schemaVersion\":1,\"root\":{root:?},\"files\":{{}}}}"
            )),
            Parsed::Current(SidecarFile::default())
        );
        assert_eq!(
            with("{\"schemaVersion\":2,\"anything\":[1,2]}".to_owned()),
            Parsed::Future {
                version: "2".to_owned()
            }
        );
        for corrupt in [
            "".to_owned(),
            "not json".to_owned(),
            "[]".to_owned(),
            "{\"files\":{}}".to_owned(),
            "{\"schemaVersion\":0}".to_owned(),
            "{\"schemaVersion\":-1}".to_owned(),
            "{\"schemaVersion\":1.5}".to_owned(),
            "{\"schemaVersion\":\"1\"}".to_owned(),
            format!("{{\"schemaVersion\":1,\"root\":{root:?}}}"),
            "{\"schemaVersion\":1,\"root\":\"u:/elsewhere\",\"files\":{}}".to_owned(),
            format!("{{\"schemaVersion\":1,\"root\":{root:?},\"files\":{{}},\"extra\":1}}"),
            format!(
                "{{\"schemaVersion\":1,\"root\":{root:?},\"files\":{{\"match/a.yml\":{{}}}}}}"
            ),
            format!(
                "{{\"schemaVersion\":1,\"root\":{root:?},\"files\":{{\"u:a\":{{\"newSnippetDefaults\":{{\"word\":true}}}}}}}}"
            ),
            format!(
                "{{\"schemaVersion\":1,\"root\":{root:?},\"files\":{{\"u:a\":{{\"newSnippetDefaults\":{{\"paragraph\":\"x\"}}}}}}}}"
            ),
        ] {
            assert_eq!(with(corrupt.clone()), Parsed::Corrupt, "{corrupt}");
        } // End of the loop over the corrupt spellings
    } // End of function version_and_shape_decide_current_future_or_corrupt()
}
