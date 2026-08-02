/**
 * The wire types of the read-only IPC surface.
 *
 * Every type here mirrors, by hand, what `serde` actually writes for the
 * corresponding type in `espansoconfig-core`. They are **not** generated: a
 * generator would be a fourth build step for nine hundred lines of JSON shapes
 * that change once a phase. The cost of writing them by hand is that they can
 * drift, so the drift is checked mechanically rather than assumed — see
 * `src-tauri/src/wire_contract.rs`, which reads *this file* and compares the
 * property names of each interface below against the JSON keys `serde` emits
 * for a real projected document.
 *
 * ## Three conventions this file follows everywhere
 *
 * 1. **Nullable, never optional.** `serde` writes `null` for a `None`, so the
 *    key is always present. With `exactOptionalPropertyTypes` on, `x?: T` and
 *    `x: T | null` are genuinely different contracts and only the second one is
 *    true of this wire. There is not one `?:` below, deliberately.
 * 2. **`readonly` throughout.** The typed model is a read-only projection over
 *    the file text (CLAUDE.md section 3); nothing the frontend does to one of
 *    these objects can reach the disk, so nothing should look as though it
 *    could.
 * 3. **Field names are the Rust ones**, `snake_case` included. This is the wire,
 *    not an ergonomic API: renaming here would put a translation layer between
 *    the two halves of a boundary whose whole value is that it has none.
 *
 * ## D2u — a scalar is source text
 *
 * {@link ScalarView.text} is a `string` and there is no `boolean`, no `number`
 * and no untagged value type anywhere below, `word` and `propagate_case`
 * included. A UI that renders `on` as a toggle would be making a claim about
 * espanso's YAML 1.1 resolver that this project has not earned.
 * {@link ScalarView.ambiguous_yaml_1_1} is what may be shown instead: a claim
 * about *risk*, not about meaning.
 */

// ---------------------------------------------------------------------------
// Identities and primitives
// ---------------------------------------------------------------------------

/**
 * Session-local identity of a file, for the life of the Rust process.
 *
 * A `DocumentId(u64)` newtype, so it crosses as a plain number. It identifies
 * the *file*, not the snapshot — see {@link ContentRevision}.
 *
 * **The `u64` is wider than this `number`**, and that difference is closed on
 * the Rust side rather than assumed away here: `MAX_EXACT_WIRE_INTEGER` in
 * `crates/espansoconfig-core/src/lib.rs` is `2^53 - 1`, and the identity
 * allocator asserts against it, so no identity that JavaScript could not tell
 * from its neighbour is ever minted. Every other numeric field below is bounded
 * by the size of something already in memory — a file's bytes, a parse's nodes,
 * a directory's files — and the audit is in `docs/decisions/1b-2a-notes.md`.
 */
export type DocumentId = number;

/**
 * A node's index in one parse's arena.
 *
 * Positional across a reparse, which is why {@link MatchId} carries a revision
 * beside it.
 */
export type NodeId = number;

/**
 * The 64-character lowercase hex digest of a document's exact bytes.
 *
 * An opaque concurrency token: compare it, hand it back, never parse it.
 */
export type ContentRevision = string;

/** A half-open byte range `[start, end)` into a document's UTF-8 source. */
export interface ByteSpan {
  /** First byte of the span. */
  readonly start: number;
  /** One past the last byte of the span. */
  readonly end: number;
}

/** One step of a {@link DocumentPath}. */
export type PathSegment = { readonly Key: string } | { readonly Index: number };

/**
 * A path addressing one node of one document.
 *
 * **Positional, and therefore not an identity.** A `Key` step names a mapping
 * entry and survives anything that does not rename the key; an `Index` step
 * names a *sequence position* and survives nothing that inserts, removes or
 * reorders an earlier item. Delete the first match of a file and `matches[1]`
 * still resolves — to what used to be `matches[2]`.
 *
 * It is what the edit engine addresses a node with inside one revision, not a
 * way to carry a selection across an external change. `identityRecovery` in
 * `./errors` states what re-resolution can actually turn up.
 */
export interface DocumentPath {
  /** Zero-based index of the document in the stream. */
  readonly document_index: number;
  /** The steps from that document's root. */
  readonly segments: readonly PathSegment[];
}

// ---------------------------------------------------------------------------
// Enumerations — each is a union of the Rust variant names, verbatim
// ---------------------------------------------------------------------------

/** How a scalar is written in the source. */
export type ScalarStyle = 'Plain' | 'SingleQuoted' | 'DoubleQuoted' | 'Literal' | 'Folded';

/** The dominant line terminator of a document. */
export type LineEnding = 'Lf' | 'Crlf';

/** What espanso treats a discovered file as. */
export type FileKind = 'MatchFile' | 'ConfigProfile' | 'Package';

/** What a document's content looks like, independently of where it sits. */
export type DocumentShape = 'MatchFile' | 'ConfigProfile' | 'Other';

/** What kind of node a value is, without projecting it. */
export type ValueKind = 'Scalar' | 'Sequence' | 'Mapping' | 'Alias' | 'Other';

/** A construct the visual editor must refuse to rewrite. */
export type HazardKind =
  | 'CommentInFlowCollection'
  | 'ExplicitKeyMapping'
  | 'TruncatedBlockScalarHeader'
  | 'UnclassifiedTrivia'
  | 'AnchorDefinition'
  | 'AliasReference'
  | 'MergeKey'
  | 'DuplicateMappingKey'
  | 'ExplicitTag'
  | 'MultiDocumentStream';

/** Which of the three trigger forms a match uses. */
export type TriggerKind = 'Single' | 'Multiple' | 'Regex' | 'Several' | 'Absent';

/** Which of the five content forms a match uses. */
export type ContentKind =
  | 'Replace'
  | 'Markdown'
  | 'Html'
  | 'ImagePath'
  | 'Form'
  | 'Several'
  | 'Absent';

/** Which of espanso's nine variable types a `type` field names. */
export type VariableKind =
  | 'Date'
  | 'Choice'
  | 'Random'
  | 'Clipboard'
  | 'Echo'
  | 'Shell'
  | 'Script'
  | 'Form'
  | 'Match'
  | 'Unrecognised'
  | 'Absent';

/**
 * A marker the snippet list shows next to a match.
 *
 * Every one is derived from a key's presence or from a `type` field's text,
 * never from a scalar's value — there is deliberately no "word boundary on"
 * badge, because producing one would mean deciding that `word: on` is true.
 */
export type MatchBadge =
  | 'Regex'
  | 'MultipleTriggers'
  | 'Form'
  | 'Html'
  | 'Markdown'
  | 'Image'
  | 'Variables'
  | 'Shell'
  | 'Script'
  | 'NotEditable';

// ---------------------------------------------------------------------------
// Unknown entries and the coverage accounting
// ---------------------------------------------------------------------------

/**
 * The name of every {@link UnknownReason} variant.
 *
 * Separate from {@link UnknownReason} because a *name* is what a dictionary key
 * is, and Phase 1b-2b needs one entry per name. {@link unknownReasonName}
 * projects a value onto this union.
 */
export type UnknownReasonName = 'NotModelled' | 'UnexpectedShape' | 'RepeatedKey' | 'NonScalarKey';

/** Why a mapping entry was not modelled. */
export type UnknownReason =
  | 'NotModelled'
  | 'RepeatedKey'
  | 'NonScalarKey'
  | { readonly UnexpectedShape: { readonly found: ValueKind } };

/** One mapping entry the projection did not model, and never discarded. */
export interface UnknownEntry {
  /** The key's decoded text, or `null` for a non-scalar key. */
  readonly key: string | null;
  /** The key node — the identity the coverage accounting balances on. */
  readonly key_node: NodeId;
  /** The key's byte span. */
  readonly key_span: ByteSpan;
  /** The value's byte span, whole and undescended. */
  readonly value_span: ByteSpan;
  /** What the value is, unprojected. */
  readonly value_kind: ValueKind;
  /**
   * The bytes {@link UnknownEntry.value_span} names, exactly as the file writes
   * them — **sliced in Rust**, never here.
   *
   * A `ByteSpan` counts bytes and a JavaScript string index counts UTF-16 code
   * units, so `text.slice(span.start, span.end)` is wrong the moment a document
   * holds one character outside the Basic Multilingual Plane, and wrong by a
   * different amount for every non-ASCII character before the span. Rust cuts
   * the slice where the two agree, and this field carries the result.
   *
   * Never truncated: the whole value crosses however long it is, so nothing on
   * this wire is a prefix pretending to be a value. Empty when the span could
   * not be cut at all, which only a defect could produce — `value_span` is what
   * distinguishes that from a genuinely empty value.
   *
   * Source text, never a resolved value (D2u). It reached the wire at Phase
   * 1c-2b-2a and reached a screen at 1c-2b-2b-1: the detail pane draws it
   * through `SourceText.svelte`, and `browser.detail.unknownValue` was reworded
   * in the same change, because the sentence it used to carry said the value was
   * not shown. `describeUnknown` in `src/lib/browser/detail.ts` is the only
   * reader; how the bytes are drawn is `src/lib/browser/sourceText.ts`.
   */
  readonly value_text: string;
  /** The path naming this entry, or `null` when no path can. */
  readonly path: DocumentPath | null;
  /** Why it was not modelled. */
  readonly reason: UnknownReason;
}

/** The modelled/unmodelled split of one mapping the projection walked. */
export interface MappingCoverage {
  /** The mapping node. */
  readonly mapping: NodeId;
  /** The path naming the mapping, when it has one. */
  readonly path: DocumentPath | null;
  /** Key nodes of entries the projection modelled by name. */
  readonly modelled: readonly NodeId[];
  /** Key nodes of entries recorded as unknown. */
  readonly unknown: readonly NodeId[];
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

/**
 * The name of every {@link DiagnosticCode} variant.
 *
 * This union is the dictionary key set Phase 1b-2b owes a string for, in both
 * languages. It is checked against the Rust enum by
 * `src-tauri/src/wire_contract.rs`, so a code added in Rust and forgotten here
 * fails `cargo test` rather than reaching a screen with no text.
 */
export type DiagnosticCodeName =
  | 'ParseFailed'
  | 'IndexRejected'
  | 'NoDocument'
  | 'EmptyDocument'
  | 'AdditionalDocumentNotProjected'
  | 'RootIsNotAMapping'
  | 'FieldHasUnexpectedShape'
  | 'RepeatedKey'
  | 'NonScalarKey'
  | 'ShapeDisagreesWithLocation'
  | 'MatchHasNoTrigger'
  | 'MatchHasSeveralTriggerForms'
  | 'MatchHasNoContent'
  | 'MatchHasSeveralContentForms'
  | 'MatchIsNotAMapping'
  | 'VariableIsNotAMapping'
  | 'VariableHasNoName'
  | 'VariableHasNoType'
  | 'ScalarNotDecodable'
  | 'ValueTooDeep'
  | 'CoverageIsIncomplete'
  | 'KeyNotAccountedFor'
  | 'Hazard';

/**
 * One thing the projection noticed, as a code plus operands.
 *
 * Externally tagged: a variant with no operands crosses as its bare name, and a
 * variant with operands crosses as a one-key object. Nothing here is prose.
 */
export type DiagnosticCode =
  | 'IndexRejected'
  | 'NoDocument'
  | 'NonScalarKey'
  | 'MatchHasNoTrigger'
  | 'MatchHasNoContent'
  | 'VariableHasNoName'
  | 'VariableHasNoType'
  | 'ScalarNotDecodable'
  | 'CoverageIsIncomplete'
  | 'KeyNotAccountedFor'
  | {
      readonly ParseFailed: {
        readonly line: number;
        readonly column: number;
        readonly byte_index: number | null;
      };
    }
  | { readonly EmptyDocument: { readonly document_index: number } }
  | { readonly AdditionalDocumentNotProjected: { readonly document_index: number } }
  | { readonly RootIsNotAMapping: { readonly found: ValueKind } }
  | { readonly FieldHasUnexpectedShape: { readonly key: string; readonly found: ValueKind } }
  | { readonly RepeatedKey: { readonly key: string } }
  | { readonly ShapeDisagreesWithLocation: { readonly shape: DocumentShape } }
  | { readonly MatchHasSeveralTriggerForms: { readonly count: number } }
  | { readonly MatchHasSeveralContentForms: { readonly count: number } }
  | { readonly MatchIsNotAMapping: { readonly found: ValueKind } }
  | { readonly VariableIsNotAMapping: { readonly found: ValueKind } }
  | { readonly ValueTooDeep: { readonly depth: number } }
  | { readonly Hazard: { readonly kind: HazardKind } };

/** One diagnostic, with the bytes and the node it is about. */
export interface Diagnostic {
  /** What was noticed. */
  readonly code: DiagnosticCode;
  /** The bytes it is about, when it is about bytes. */
  readonly span: ByteSpan | null;
  /** The node it is about, when one is identifiable. */
  readonly node: NodeId | null;
  /** The path naming that node, when it has one. */
  readonly path: DocumentPath | null;
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

/** One scalar of the source, projected for display. */
export interface ScalarView {
  /** The scalar's text, as written. Never a parsed value (D2u). */
  readonly text: string;
  /** `true` when {@link ScalarView.text} is the decoder's output. */
  readonly decoded: boolean;
  /** How the scalar is written in the source. */
  readonly style: ScalarStyle;
  /** The token's byte span in the original document, BOM included. */
  readonly span: ByteSpan;
  /** The source node this view projects. */
  readonly node: NodeId;
  /**
   * `true` when this is a plain scalar YAML 1.1 and YAML 1.2 core disagree
   * about. A claim about risk, not about meaning.
   */
  readonly ambiguous_yaml_1_1: boolean;
}

/** An alias reference, projected without following it. */
export interface AliasView {
  /** The alias node's byte span. */
  readonly span: ByteSpan;
  /** The source node. */
  readonly node: NodeId;
}

/** One entry of a shallowly projected mapping. */
export interface FieldView {
  /** The key, when it is a scalar; `null` for an alias or collection key. */
  readonly key: ScalarView | null;
  /** The key node, scalar or not. Always present. */
  readonly key_node: NodeId;
  /** The value. */
  readonly value: ValueView;
}

/** The node exists but the projection stopped at it. */
export interface ElidedValue {
  /** What the elided node is. */
  readonly kind: ValueKind;
  /** Its byte span. */
  readonly span: ByteSpan;
  /** Its source node. */
  readonly node: NodeId;
}

/** A value of the source, projected without interpretation. */
export type ValueView =
  | { readonly Scalar: ScalarView }
  | { readonly Sequence: readonly ValueView[] }
  | { readonly Mapping: readonly FieldView[] }
  | { readonly Alias: AliasView }
  | { readonly Elided: ElidedValue };

// ---------------------------------------------------------------------------
// Matches and variables
// ---------------------------------------------------------------------------

/**
 * Session-local identity of one match, scoped to the parse it came from.
 *
 * Hold it, hand it back to {@link import('./commands').getMatch}, and be ready
 * for `identityStaleRevision` — the revision is part of the identity precisely
 * so that a lookup crossing a reparse is refused rather than silently resolved
 * to whatever now occupies that arena slot.
 */
export interface MatchId {
  /** The document the match lives in. */
  readonly document: DocumentId;
  /** The revision of the bytes this identity was minted from. */
  readonly revision: ContentRevision;
  /** The mapping node the match is, in that parse's arena. */
  readonly node: NodeId;
}

/** A match's trigger side. All three fields are carried, never collapsed. */
export interface TriggerSpec {
  /** `trigger`, as source text. */
  readonly trigger: ScalarView | null;
  /** `triggers`, one item per source entry, in source order. */
  readonly triggers: readonly ValueView[];
  /** `regex`, as source text. */
  readonly regex: ScalarView | null;
  /** Whether the three fields form a shape espanso accepts. */
  readonly kind: TriggerKind;
}

/** A match's content side. */
export interface ContentSpec {
  /** `replace`, as source text. */
  readonly replace: ScalarView | null;
  /** `markdown`, as source text. */
  readonly markdown: ScalarView | null;
  /** `html`, as source text. */
  readonly html: ScalarView | null;
  /** `image_path`, as source text. */
  readonly image_path: ScalarView | null;
  /** `form`, as source text. */
  readonly form: ScalarView | null;
  /** Whether the five fields form a shape espanso accepts. */
  readonly kind: ContentKind;
}

/** The word-boundary, case and injection options, every one as source text. */
export interface MatchOptions {
  /** `word`. */
  readonly word: ScalarView | null;
  /** `left_word`. */
  readonly left_word: ScalarView | null;
  /** `right_word`. */
  readonly right_word: ScalarView | null;
  /** `propagate_case`. */
  readonly propagate_case: ScalarView | null;
  /** `uppercase_style`. */
  readonly uppercase_style: ScalarView | null;
  /** `force_mode`. */
  readonly force_mode: ScalarView | null;
  /** `force_clipboard`. */
  readonly force_clipboard: ScalarView | null;
  /** `paragraph`. */
  readonly paragraph: ScalarView | null;
  /** `anchor`. */
  readonly anchor: ScalarView | null;
}

/** One variable of a `vars` or `global_vars` sequence. */
export interface VariableView {
  /** The mapping node this variable projects. */
  readonly node: NodeId;
  /** The path naming it, when the containing document has one. */
  readonly path: DocumentPath | null;
  /** Its byte span. */
  readonly span: ByteSpan;
  /** `name`, as source text. */
  readonly name: ScalarView | null;
  /** `type`, as source text. The authoritative value. */
  readonly declared_type: ScalarView | null;
  /** Which of the nine types {@link VariableView.declared_type} names. */
  readonly kind: VariableKind;
  /** `params`, projected shallowly and completely. */
  readonly params: readonly FieldView[];
  /** `depends_on`, one item per source entry, in source order. */
  readonly depends_on: readonly ValueView[];
  /** `inject_vars`, as source text. */
  readonly inject_vars: ScalarView | null;
  /** Entries this projection did not model, never discarded. */
  readonly unknown_entries: readonly UnknownEntry[];
}

/** One espanso match. */
export interface MatchView {
  /** Session-local identity: document, revision and source node. */
  readonly id: MatchId;
  /** The mapping node the match is. */
  readonly source_node: NodeId;
  /** The path that addresses it, for the edit engine. */
  readonly path: DocumentPath | null;
  /** The match's byte span. */
  readonly span: ByteSpan;
  /**
   * The bytes {@link MatchView.span} names, exactly as the file writes them.
   *
   * A fact about how the file is written, never a resolved value (D2u). It is
   * the only field on this view that is *complete*: everything else is a
   * projection, and two matches differing only in an option the projection does
   * not surface look identical through it. `selection.ts` compares this and
   * nothing else.
   *
   * The slice is the match's own mapping, so a comment on the line above it is
   * not part of it.
   */
  readonly source_text: string;
  /** The trigger side. */
  readonly trigger: TriggerSpec;
  /** The content side. */
  readonly content: ContentSpec;
  /** `label`, as source text. */
  readonly label: ScalarView | null;
  /** `comment`, as source text. */
  readonly comment: ScalarView | null;
  /** `search_terms`, one item per source entry, in source order. */
  readonly search_terms: readonly ValueView[];
  /** The word-boundary, case and injection options. */
  readonly options: MatchOptions;
  /** `vars`. */
  readonly vars: readonly VariableView[];
  /** `form_fields`, projected shallowly and completely. */
  readonly form_fields: readonly FieldView[];
  /** The markers the snippet list shows, sorted and deduplicated. */
  readonly badges: readonly MatchBadge[];
  /** The hazard that makes this match un-editable, or `null`. */
  readonly blocking_hazard: HazardKind | null;
  /** Whether the visual editor may edit this match. */
  readonly safely_editable: boolean;
  /** Entries this projection did not model, never discarded. */
  readonly unknown_entries: readonly UnknownEntry[];
  /** The text a search covers, precomputed in Rust. */
  readonly search_text: string;
}

/** One `config/*.yml` profile, projected shallowly. */
export interface ConfigProfileView {
  /** The root mapping node, or `null` when the document has no root. */
  readonly node: NodeId | null;
  /** Every entry of the profile, in source order. */
  readonly entries: readonly FieldView[];
}

// ---------------------------------------------------------------------------
// Documents and the workspace
// ---------------------------------------------------------------------------

/** One file, projected for the read-only browser. */
export interface DocumentView {
  /** Session-local identity, and the only thing to hand back. */
  readonly id: DocumentId;
  /**
   * Absolute path on disk, **for display only**.
   *
   * A lossy Unicode rendering of the real path (`WirePath` in
   * `crates/espansoconfig-core/src/wire.rs`): bytes no encoding can name arrive
   * as `U+FFFD`, so the string always exists but does not necessarily name the
   * file. Address the file by {@link DocumentView.id}.
   */
  readonly path: string;
  /** Path relative to the configuration root, for display. Lossy, as above. */
  readonly relative_path: string;
  /** What espanso treats the file as. */
  readonly kind: FileKind;
  /** Whether espanso's default include glob skips the file. */
  readonly disabled: boolean;
  /** Whether the editor must refuse to write the file. */
  readonly read_only: boolean;
  /** Revision of the bytes this view projects. */
  readonly revision: ContentRevision;
  /** Length of those bytes, BOM included. */
  readonly byte_len: number;
  /** Dominant line ending. */
  readonly line_ending: LineEnding;
  /** Whether the file starts with a UTF-8 BOM. */
  readonly bom: boolean;
  /**
   * Whether the substrate accepted the file.
   *
   * `false` is not an error: every projection field below is empty, the
   * diagnostics say why, and the raw text is still readable.
   */
  readonly parsed: boolean;
  /** How many YAML documents the stream holds. Espanso loads the first. */
  readonly stream_documents: number;
  /** What the content looks like. */
  readonly shape: DocumentShape;
  /** Every top-level key of the projected document, in source order. */
  readonly top_level_keys: readonly ScalarView[];
  /** `matches`. */
  readonly matches: readonly MatchView[];
  /** `global_vars`. */
  readonly global_vars: readonly VariableView[];
  /** `imports`, one item per source entry, in source order. */
  readonly imports: readonly ValueView[];
  /** The profile projection, for a document whose shape is a config profile. */
  readonly profile: ConfigProfileView | null;
  /** Top-level entries this projection did not model, never discarded. */
  readonly unknown_entries: readonly UnknownEntry[];
  /** One record per mapping the projection modelled. */
  readonly coverage: readonly MappingCoverage[];
  /** Byte spans the projection recorded without descending into them. */
  readonly undescended: readonly ByteSpan[];
  /** Everything the projection noticed, as codes and operands. */
  readonly diagnostics: readonly Diagnostic[];
  /** The distinct hazard kinds present anywhere in the file, sorted. */
  readonly hazards: readonly HazardKind[];
  /** Whether the visual editor may edit the document's root at all. */
  readonly safely_editable: boolean;
}

/** One row of the document list, with no parse behind it. */
export interface DocumentSummary {
  /** Session-local identity, and the only thing to hand back. */
  readonly id: DocumentId;
  /** Absolute path on disk, lossily rendered — see {@link DocumentView.path}. */
  readonly path: string;
  /** Path relative to the configuration root, for display. Lossy, as above. */
  readonly relative_path: string;
  /** What espanso treats the file as. */
  readonly kind: FileKind;
  /** Whether espanso's default include glob skips the file. */
  readonly disabled: boolean;
  /** Whether the editor must refuse to write it. */
  readonly read_only: boolean;
  /** Whether this document has been parsed and is served from the cache. */
  readonly loaded: boolean;
}

/** What opening a workspace answers with. */
export interface WorkspaceSummary {
  /** The configuration root, lossily rendered — see {@link DocumentView.path}. */
  readonly root: string;
  /** How many YAML files were found. */
  readonly documents: number;
  /** How many are match files. */
  readonly match_files: number;
  /** How many are config profiles. */
  readonly config_profiles: number;
  /** How many came from the Hub and are read-only. */
  readonly packages: number;
  /** How many are not auto-loaded because their name starts with `_`. */
  readonly disabled: number;
}


// ---------------------------------------------------------------------------
// The save transaction — Phase 2b-1
// ---------------------------------------------------------------------------

/**
 * The wire form of everything the save transaction can hand a caller.
 *
 * Every type below mirrors a `espansoconfig-core` type that gained `Serialize`
 * at Phase 2b-1, and every enum's variants have a `code.` entry in both
 * dictionaries — `src-tauri/src/dictionary_contract.rs` fails `cargo test`
 * otherwise. **No command answers with any of them yet**; the boundary exists
 * before the commands that will cross it, exactly as the i18n layer shipped
 * before anything rendered a string.
 *
 * Three conventions, all inherited from the read model above:
 *
 * 1. **Externally tagged.** A variant with no operands crosses as its bare name
 *    and a variant with operands as a one-key object. A `…Name` union beside a
 *    value union is the *name set*, which is what a dictionary key is built from.
 * 2. **A path is a lossy string, for display only.** Every `path` below is a
 *    `WirePath` rendering (`crates/espansoconfig-core/src/wire.rs`), so bytes no
 *    encoding can name arrive as `U+FFFD`. Nothing addresses a file by one:
 *    two distinct filenames can render to the same string, and the string cannot
 *    be handed back to name either of them. The real `PathBuf` stays in the
 *    transaction, so a wire path is never an identifier and never round-trippable.
 * 3. **An I/O failure crosses as a `kind`, never as a message.** `kind` holds a
 *    `std::io::ErrorKind` variant name — `NotFound`, `PermissionDenied` — which
 *    is a code, not prose, and is deliberately never interpolated into a
 *    sentence (see `src/lib/i18n/codes.ts`). Beside it rides `raw_os_error`, the
 *    system's own error number as a nullable **number**: `kind` is coarse enough
 *    to collapse several actionable failures into `Other`, and the number is
 *    diagnostic data with no dictionary entry, not a second code to branch on.
 */

/** What kind of YAML construct a node is. */
export type NodeKind = 'Document' | 'Mapping' | 'Sequence' | 'Scalar' | 'Alias';

/** Which arm of the blocking policy decided a save. */
export type SaveVerdict =
  | 'Proceed'
  | 'RefusedForEditorModelErrors'
  | 'RefusedForUnacknowledgedSuspicions';

/** How seriously a caller should take a {@link Finding}. */
export type FindingClass = 'EditorModelError' | 'SuspiciousButPermitted';

/** Which step of the atomic write an I/O failure happened on. */
export type WriteStep =
  | 'ResolveTarget'
  | 'InspectTarget'
  | 'ReadTarget'
  | 'CreateTempFile'
  | 'WriteTempFile'
  | 'SyncTempFile'
  | 'CopyMetadata'
  | 'ApplyModeBits'
  | 'VerifyTempIdentity'
  | 'RecheckTarget'
  | 'Rename'
  | 'SyncDirectory'
  | 'ReadBack';

/** Which part of taking a backup failed. */
export type BackupStep =
  | 'CreateBackupRoot'
  | 'InspectBackupRoot'
  | 'CreateBatch'
  | 'WriteBatchMarker'
  | 'CreateBackupParents'
  | 'CreateBackupFile'
  | 'WriteBackupFile'
  | 'CopyExtendedAttributes'
  | 'ApplyModeBits'
  | 'SyncBackupFile'
  | 'VerifyBackupFile'
  | 'PublishBackupFile';

/**
 * How far the tidy-up of older backups got.
 *
 * Not the same question as what it removed: `ScanFailed` and a `Scanned` that
 * removed nothing produce the same counts and mean opposite things.
 */
export type RotationOutcome = 'NotAttempted' | 'Refused' | 'ScanFailed' | 'Scanned';

/** Which join of a move a block-scalar refusal is about. */
export type MoveSeam = 'SourceCloses' | 'ArrivalLands' | 'ArrivalCloses' | 'CarriedRunsJoin';

/** The name of every {@link DecodeError} variant. */
export type DecodeErrorName =
  | 'SpanOutsideSource'
  | 'UnknownEscape'
  | 'MalformedNumericEscape'
  | 'InvalidCodePoint'
  | 'TrailingBackslash';

/** Why a scalar's source bytes could not be decoded. */
export type DecodeError =
  | 'TrailingBackslash'
  | { readonly SpanOutsideSource: { readonly span: ByteSpan; readonly source_len: number } }
  | { readonly UnknownEscape: { readonly escape: string } }
  | { readonly MalformedNumericEscape: { readonly introducer: string } }
  | { readonly InvalidCodePoint: { readonly value: number } };

/** The name of every {@link InvariantViolation} variant. */
export type InvariantViolationName =
  | 'InvertedSpan'
  | 'SpanOutsideSource'
  | 'BlockHeaderNotFound'
  | 'FrontierOverlap'
  | 'UnbalancedEvents';

/** An internal consistency failure of the span index. Always a fault in this app. */
export type InvariantViolation =
  | { readonly InvertedSpan: { readonly start: number; readonly end: number } }
  | {
      readonly SpanOutsideSource: {
        readonly start: number;
        readonly end: number;
        readonly source_len: number;
      };
    }
  | { readonly BlockHeaderNotFound: { readonly start: number; readonly end: number } }
  | {
      readonly FrontierOverlap: { readonly previous_end: number; readonly next_start: number };
    }
  | { readonly UnbalancedEvents: { readonly depth: number } };

/** A parse rejection, located precisely enough to drive an editor gutter. */
export interface ParseFailure {
  /** Offset in Unicode scalar values, as the substrate reported it. */
  readonly char_index: number;
  /** The same position as a byte offset into the original document, or `null`. */
  readonly byte_index: number | null;
  /** Line number, as the substrate reports it. */
  readonly line: number;
  /** Column number, as the substrate reports it. */
  readonly column: number;
  /**
   * The substrate's own message.
   *
   * A developer diagnostic in one language, and **never displayed** — the same
   * rule `IoError.kind` follows. A localized message is built from the code.
   */
  readonly detail: string;
}

/** A character offset the document's conversion table cannot map. */
export interface OffsetOutOfDomain {
  /** The offending character index. */
  readonly char_index: number;
  /** Number of Unicode scalar values in the document. */
  readonly char_len: number;
}

/** The name of every {@link SyntaxError} variant. */
export type SyntaxErrorName = 'Parse' | 'Offset' | 'Invariant';

/** Why a document could not be turned into a span index. */
export type SyntaxError =
  | { readonly Parse: ParseFailure }
  | { readonly Offset: OffsetOutOfDomain }
  | { readonly Invariant: InvariantViolation };

/** The name of every {@link PathError} variant. */
export type PathErrorName =
  | 'NoSuchDocument'
  | 'EmptyDocument'
  | 'NoSuchKey'
  | 'DuplicateKey'
  | 'KeyIntoNonMapping'
  | 'IndexIntoNonSequence'
  | 'IndexOutOfRange'
  | 'NoKeySegment'
  | 'MalformedIndex';

/** Why a {@link DocumentPath} could not be resolved against a document. */
export type PathError =
  | 'NoKeySegment'
  | {
      readonly NoSuchDocument: { readonly document_index: number; readonly documents: number };
    }
  | { readonly EmptyDocument: { readonly document_index: number } }
  | {
      readonly NoSuchKey: { readonly key: string; readonly segment: number; readonly node: NodeId };
    }
  | {
      readonly DuplicateKey: {
        readonly key: string;
        readonly occurrences: number;
        readonly segment: number;
        readonly node: NodeId;
      };
    }
  | {
      readonly KeyIntoNonMapping: {
        readonly key: string;
        readonly segment: number;
        readonly node: NodeId;
        readonly kind: NodeKind;
      };
    }
  | {
      readonly IndexIntoNonSequence: {
        readonly index: number;
        readonly segment: number;
        readonly node: NodeId;
        readonly kind: NodeKind;
      };
    }
  | {
      readonly IndexOutOfRange: {
        readonly index: number;
        readonly len: number;
        readonly segment: number;
        readonly node: NodeId;
      };
    }
  | { readonly MalformedIndex: { readonly node: NodeId } };

/** The name of every {@link VerificationFailure} variant. */
export type VerificationFailureName =
  | 'DoesNotParse'
  | 'TargetLost'
  | 'TargetKindChanged'
  | 'ValueMismatch'
  | 'DecoderDisagreement'
  | 'Undecodable'
  | 'BytesOutsideTheSpanChanged'
  | 'SpanNotPermitted'
  | 'LengthMismatch'
  | 'MappingLost'
  | 'FieldNotInserted'
  | 'FieldNotRemoved'
  | 'SiblingChanged'
  | 'EntryCountChanged'
  | 'EnvelopeCoversAnotherNode'
  | 'EnvelopeMissesTheEntry'
  | 'InsertionPointInsideANode'
  | 'FileCommentLost'
  | 'ItemsNotInTheIntendedOrder'
  | 'ConstructChangedOutsideTheMove'
  | 'DocumentLinesNotConserved'
  | 'MoveCarriesMoreThanTheItem'
  | 'MovedBytesWereRewritten'
  | 'CommentOwnershipChanged'
  | 'AmbiguousPlainScalarIntroduced'
  | 'RemovalCarriesMoreThanTheEntry';

/**
 * Why a candidate document was rejected after being reparsed.
 *
 * Every one of these discards the candidate: there is no path from a
 * verification failure to bytes anything could write.
 */
export type VerificationFailure =
  | { readonly DoesNotParse: SyntaxError }
  | { readonly TargetLost: { readonly edit: number; readonly error: PathError } }
  | { readonly TargetKindChanged: { readonly edit: number; readonly kind: NodeKind } }
  | {
      readonly ValueMismatch: {
        readonly edit: number;
        readonly wanted_len: number;
        readonly found_len: number;
        readonly first_difference: number;
      };
    }
  | { readonly DecoderDisagreement: { readonly edit: number } }
  | { readonly Undecodable: { readonly edit: number; readonly error: DecodeError } }
  | { readonly BytesOutsideTheSpanChanged: { readonly at: number } }
  | { readonly SpanNotPermitted: { readonly at: ByteSpan } }
  | { readonly LengthMismatch: { readonly expected: number; readonly found: number } }
  | { readonly MappingLost: { readonly edit: number; readonly error: PathError } }
  | { readonly FieldNotInserted: { readonly edit: number; readonly key_len: number } }
  | { readonly FieldNotRemoved: { readonly edit: number; readonly key_len: number } }
  | { readonly SiblingChanged: { readonly edit: number; readonly entry: number } }
  | {
      readonly EntryCountChanged: {
        readonly edit: number;
        readonly expected: number;
        readonly found: number;
      };
    }
  | { readonly EnvelopeCoversAnotherNode: { readonly at: ByteSpan; readonly node: NodeId } }
  | { readonly EnvelopeMissesTheEntry: { readonly at: ByteSpan; readonly node: NodeId } }
  | { readonly InsertionPointInsideANode: { readonly at: number; readonly node: NodeId } }
  | { readonly FileCommentLost: { readonly at: number } }
  | { readonly ItemsNotInTheIntendedOrder: { readonly edit: number; readonly position: number } }
  | { readonly ConstructChangedOutsideTheMove: { readonly edit: number; readonly node: NodeId } }
  | { readonly DocumentLinesNotConserved: { readonly at: number } }
  | {
      readonly MoveCarriesMoreThanTheItem: {
        readonly edit: number;
        readonly at: ByteSpan;
        readonly lines: ByteSpan;
      };
    }
  | {
      readonly MovedBytesWereRewritten: {
        readonly edit: number;
        readonly at: number;
        readonly first_difference: number;
      };
    }
  | { readonly CommentOwnershipChanged: { readonly edit: number; readonly at: number } }
  | { readonly AmbiguousPlainScalarIntroduced: { readonly at: number; readonly len: number } }
  | { readonly RemovalCarriesMoreThanTheEntry: { readonly at: ByteSpan; readonly lines: ByteSpan } };

/** The name of every {@link EditError} variant. */
export type EditErrorName =
  | 'SourceDoesNotParse'
  | 'Unresolvable'
  | 'NotAScalar'
  | 'EmptyTarget'
  | 'Refused'
  | 'OverlappingEdits'
  | 'TrailingNewlinesNotRepresentable'
  | 'MalformedSpan'
  | 'NotAMapping'
  | 'FlowCollection'
  | 'KeyAlreadyPresent'
  | 'NoSuchSibling'
  | 'InconsistentEntryIndentation'
  | 'EntryDoesNotOwnItsLines'
  | 'RemovalWouldExtendAKeptBlock'
  | 'RemovalWouldDeleteAFileComment'
  | 'RemovalWouldExtendABlockScalar'
  | 'NoObservableLineEnding'
  | 'LastEntryOfMapping'
  | 'NotASequenceItem'
  | 'NoSuchDestinationItem'
  | 'MoveChangesNothing'
  | 'MoveMustBeTheOnlyEditInItsBatch'
  | 'MoveWouldInventALineEnding'
  | 'MoveWouldTerminateTheFinalLine'
  | 'MoveWouldExtendAKeptBlock'
  | 'MoveWouldExtendABlockScalar'
  | 'Verification';

/** Why a change was not applied to a document's bytes. */
export type EditError =
  | { readonly SourceDoesNotParse: SyntaxError }
  | { readonly Unresolvable: { readonly edit: number; readonly error: PathError } }
  | {
      readonly NotAScalar: {
        readonly edit: number;
        readonly node: NodeId;
        readonly kind: NodeKind;
      };
    }
  | {
      readonly EmptyTarget: { readonly edit: number; readonly node: NodeId; readonly at: ByteSpan };
    }
  | {
      readonly Refused: {
        readonly edit: number;
        readonly node: NodeId;
        readonly hazard: HazardKind;
        readonly at: ByteSpan;
      };
    }
  | { readonly OverlappingEdits: { readonly first: ByteSpan; readonly second: ByteSpan } }
  | {
      readonly TrailingNewlinesNotRepresentable: {
        readonly edit: number;
        readonly wanted: number;
        readonly following: number;
      };
    }
  | { readonly MalformedSpan: { readonly edit: number; readonly at: ByteSpan } }
  | {
      readonly NotAMapping: {
        readonly edit: number;
        readonly node: NodeId;
        readonly kind: NodeKind;
      };
    }
  | { readonly FlowCollection: { readonly edit: number; readonly node: NodeId } }
  | { readonly KeyAlreadyPresent: { readonly edit: number; readonly mapping: NodeId } }
  | { readonly NoSuchSibling: { readonly edit: number; readonly mapping: NodeId } }
  | {
      readonly InconsistentEntryIndentation: {
        readonly edit: number;
        readonly mapping: NodeId;
        readonly expected: number;
        readonly found: number;
      };
    }
  | { readonly EntryDoesNotOwnItsLines: { readonly edit: number; readonly at: ByteSpan } }
  | { readonly RemovalWouldExtendAKeptBlock: { readonly edit: number; readonly block: NodeId } }
  | {
      readonly RemovalWouldDeleteAFileComment: {
        readonly edit: number;
        readonly comment: ByteSpan;
      };
    }
  | { readonly RemovalWouldExtendABlockScalar: { readonly edit: number; readonly block: NodeId } }
  | { readonly NoObservableLineEnding: { readonly edit: number; readonly at: number } }
  | { readonly LastEntryOfMapping: { readonly edit: number; readonly mapping: NodeId } }
  | {
      readonly NotASequenceItem: {
        readonly edit: number;
        readonly node: NodeId;
        readonly kind: NodeKind;
      };
    }
  | {
      readonly NoSuchDestinationItem: {
        readonly edit: number;
        readonly sequence: NodeId;
        readonly items: number;
      };
    }
  | { readonly MoveChangesNothing: { readonly edit: number; readonly item: NodeId } }
  | {
      readonly MoveMustBeTheOnlyEditInItsBatch: { readonly edit: number; readonly edits: number };
    }
  | { readonly MoveWouldInventALineEnding: { readonly edit: number; readonly at: number } }
  | { readonly MoveWouldTerminateTheFinalLine: { readonly edit: number; readonly at: number } }
  | { readonly MoveWouldExtendAKeptBlock: { readonly edit: number; readonly block: NodeId } }
  | {
      readonly MoveWouldExtendABlockScalar: {
        readonly edit: number;
        readonly block: NodeId;
        readonly seam: MoveSeam;
      };
    }
  | { readonly Verification: VerificationFailure };

/** The name of every {@link FindingCode} variant. */
export type FindingCodeName =
  | 'MatchHasNoContentField'
  | 'MatchHasSeveralContentFields'
  | 'MatchHasNoTriggerField'
  | 'MatchHasSeveralTriggerForms'
  | 'VariableHasNoType'
  | 'VariableTypeNotRecognised'
  | 'VariableMissingRequiredParam'
  | 'DuplicateVariableName'
  | 'ReferenceHasNoDeclaration'
  | 'RegexDoesNotCompile';

/** What the semantic gate noticed about a candidate, as a code plus operands. */
export type FindingCode =
  | 'MatchHasNoContentField'
  | 'MatchHasSeveralContentFields'
  | 'MatchHasNoTriggerField'
  | 'MatchHasSeveralTriggerForms'
  | 'VariableHasNoType'
  | { readonly VariableTypeNotRecognised: { readonly declared: string } }
  | {
      readonly VariableMissingRequiredParam: {
        readonly kind: VariableKind;
        readonly param: string;
      };
    }
  | { readonly DuplicateVariableName: { readonly name: string } }
  | { readonly ReferenceHasNoDeclaration: { readonly name: string } }
  | {
      readonly RegexDoesNotCompile: {
        /**
         * The `regex` crate's own English diagnostic, carried verbatim.
         *
         * Developer-facing, and never rendered: a localized message is built
         * from the code and the pattern, not from this.
         */
        readonly detail: string;
      };
    };

/** One thing the semantic gate noticed about a candidate about to be written. */
export interface Finding {
  /** What was noticed. */
  readonly code: FindingCode;
  /** The bytes it is about, when it is about bytes. */
  readonly span: ByteSpan | null;
  /** The node it is about, when one is identifiable. */
  readonly node: NodeId | null;
  /** The path naming that node, when it has one. */
  readonly path: DocumentPath | null;
}

/**
 * The findings a caller has already shown someone and has chosen to save past.
 *
 * **Content-addressed, never a flag.** A save is refused until every suspicion
 * the candidate produces is matched, as a multiset, by a finding in here — so a
 * `force: true` has no equivalent on this wire and adding one would undo the
 * design.
 *
 * **It crosses outward only, as of Phase 2b-1.** Nothing in the core
 * deserializes it yet; the request type that carries one back in is Phase 2b-2's,
 * and `docs/decisions/2b-1-notes.md` records what has to change first.
 */
export interface Acknowledgement {
  /** The suspicions the caller accepted, in the order it supplied them. */
  readonly accepted: readonly Finding[];
}

/** Why the semantic gate refused a save, with its evidence. */
export interface SaveRefusal {
  /** Which arm of the policy refused. */
  readonly verdict: SaveVerdict;
  /** Every finding the candidate produced, of both classes, in report order. */
  readonly findings: readonly Finding[];
}

/** The name of every {@link TargetDifference} variant. */
export type TargetDifferenceName = 'Retargeted' | 'Vanished' | 'Identity' | 'Contents';

/** How the target differed, just before the commit, from what was inspected. */
export type TargetDifference =
  | 'Vanished'
  | 'Identity'
  | { readonly Retargeted: { readonly now: string } }
  | {
      readonly Contents: {
        readonly expected: ContentRevision;
        readonly found: ContentRevision;
      };
    };

/** The name of every {@link WriteError} variant. */
export type WriteErrorName =
  | 'TargetMissing'
  | 'TargetNotRegularFile'
  | 'RevisionMismatch'
  | 'TargetChangedDuringWrite'
  | 'TempFileChangedDuringWrite'
  | 'VerificationFailed'
  | 'Io';

/** Everything the atomic write primitive can refuse or fail on. */
export type WriteError =
  | { readonly TargetMissing: { readonly path: string } }
  | { readonly TargetNotRegularFile: { readonly path: string } }
  | {
      readonly RevisionMismatch: {
        readonly path: string;
        readonly expected: ContentRevision;
        readonly found: ContentRevision;
      };
    }
  | {
      readonly TargetChangedDuringWrite: {
        readonly path: string;
        readonly difference: TargetDifference;
      };
    }
  | { readonly TempFileChangedDuringWrite: { readonly path: string } }
  | {
      readonly VerificationFailed: {
        readonly path: string;
        readonly expected: ContentRevision;
        readonly found: ContentRevision;
      };
    }
  | {
      readonly Io: {
        readonly step: WriteStep;
        readonly path: string;
        /** A `std::io::ErrorKind` variant name. A code, never a message. */
        readonly kind: string;
        /**
         * The operating system's own error number, or `null` when the failure
         * did not come from one.
         *
         * Diagnostic data, not a code: it has no dictionary entry, nothing
         * branches on it and no message interpolates it. It exists because
         * `kind` is coarse enough to collapse several actionable failures into
         * one name.
         */
        readonly raw_os_error: number | null;
      };
    };

/** The name of every {@link BackupError} variant. */
export type BackupErrorName =
  | 'Io'
  | 'BatchNameExhausted'
  | 'NotADirectory'
  | 'BackupRootNotPrivate'
  | 'ConfigRootIsAutoLoaded'
  | 'TempFileChangedDuringWrite'
  | 'DestinationExists'
  | 'BackupNameExhausted';

/** Why the copy taken before a file's first change of a session was not made. */
export type BackupError =
  | {
      readonly Io: {
        readonly step: BackupStep;
        readonly path: string;
        /** A `std::io::ErrorKind` variant name. A code, never a message. */
        readonly kind: string;
        /**
         * The operating system's own error number, or `null` when the failure
         * did not come from one. Diagnostic data with no dictionary entry, for
         * the same reason as {@link WriteError}'s.
         */
        readonly raw_os_error: number | null;
      };
    }
  | { readonly BatchNameExhausted: { readonly path: string } }
  | { readonly NotADirectory: { readonly path: string } }
  | {
      readonly BackupRootNotPrivate: { readonly path: string; readonly mode: number };
    }
  | { readonly ConfigRootIsAutoLoaded: { readonly path: string } }
  | { readonly TempFileChangedDuringWrite: { readonly path: string } }
  | { readonly DestinationExists: { readonly path: string } }
  | { readonly BackupNameExhausted: { readonly path: string } };

/**
 * What the tidy-up of older backups did, on the one save per session that runs it.
 *
 * Counts plus an outcome, never an error: a tidy-up failure must not fail a save
 * that has already been decided. A non-zero `failed`, a non-zero `unreadable` or
 * an outcome other than `Scanned` all mean one thing — **the backups folder is
 * not known to hold at most ten batches**, which is untidy and is not dangerous.
 */
export interface Rotation {
  /** How far the tidy-up got. */
  readonly outcome: RotationOutcome;
  /** Batch folders removed. */
  readonly removed: number;
  /** Batch folders the tidy-up tried to remove and could not. */
  readonly failed: number;
  /** Entries of the backups folder it did not recognise as its own. */
  readonly unrecognised: number;
  /** Entries the folder listing itself could not produce. */
  readonly unreadable: number;
}

/**
 * One file copied before a session's first change to it, and what the tidy-up did.
 *
 * **Not a promise that the file is recoverable.** Retention is ten batches and a
 * batch is a session, so the eleventh session after this one removes this one's
 * copies. It is also not a version history: it holds the file as it was before
 * the session's first change, not before each change.
 */
export interface BackupRecord {
  /** Where the copy was written. Lossy — see {@link DocumentView.path}. */
  readonly path: string;
  /** The batch folder the copy is inside. Lossy, as above. */
  readonly batch: string;
  /** What the tidy-up did. All zeroes on every save but the one that ran it. */
  readonly rotation: Rotation;
}

/** The name of every {@link SaveError} variant. */
export type SaveErrorName =
  | 'DocumentIsReadOnly'
  | 'Target'
  | 'TargetNotUtf8'
  | 'RevisionMismatch'
  | 'Patch'
  | 'CandidateParseDisagrees'
  | 'Refused'
  | 'Backup'
  | 'Write';

/**
 * Why a save did not commit.
 *
 * **A refusal is not a failure.** A refusal is a check of this application
 * declining to write and is worth offering to retry differently; a failure is a
 * disk, a permission or a filesystem. `SaveError::is_refusal` in
 * `crates/espansoconfig-core/src/persist/save.rs` is the authority on which is
 * which, and it does not cross this boundary — a caller that needs the answer
 * asks for it there rather than re-deriving it here.
 *
 * Every carried error stays **whole** rather than being flattened, because
 * `WriteError::may_have_written` is the one question whose answer changes what a
 * caller does next and flattening loses the step it is computed from.
 */
export type SaveError =
  | { readonly DocumentIsReadOnly: { readonly path: string } }
  | { readonly Target: WriteError }
  | { readonly TargetNotUtf8: { readonly path: string; readonly offset: number } }
  | {
      readonly RevisionMismatch: {
        readonly path: string;
        readonly expected: ContentRevision;
        readonly found: ContentRevision;
      };
    }
  | { readonly Patch: EditError }
  | {
      readonly CandidateParseDisagrees: { readonly path: string; readonly error: SyntaxError };
    }
  | { readonly Refused: SaveRefusal }
  | { readonly Backup: BackupError }
  | { readonly Write: WriteError };

/** The name of every {@link NotReencodable} variant. */
export type NotReencodableName =
  | 'FoldedStyle'
  | 'FoldedFlowScalar'
  | 'NonCanonicalEscaping'
  | 'NonCanonicalBlankLine'
  | 'MixedLineBreaks'
  | 'BareCarriageReturn'
  | 'SynthesisedFinalBreak'
  | 'Undecodable';

/**
 * Why a value could not be written back in exactly the spelling it had.
 *
 * **Not a failure.** Each names a presentation that is genuinely lossy in the
 * reading direction, so "read it, then write it again" cannot be the identity
 * however the writer is built. It is the `reason` of a {@link PresentationNote}.
 */
export type NotReencodable =
  | 'FoldedStyle'
  | 'FoldedFlowScalar'
  | 'NonCanonicalEscaping'
  | 'NonCanonicalBlankLine'
  | 'MixedLineBreaks'
  | 'BareCarriageReturn'
  | 'SynthesisedFinalBreak'
  | { readonly Undecodable: DecodeError };

/**
 * A change of *spelling* an edit had to make, reported rather than performed
 * silently.
 *
 * Plan section 6.2 — never silently normalise. A note says the value's spelling
 * changed as well as its content: a folded block rewritten as a literal one, a
 * plain value quoted because its new content is no longer plain-safe. Every note
 * is about bytes **inside** the edited value; everything outside it is
 * byte-identical either way.
 */
export interface PresentationNote {
  /**
   * The edit's position in the batch that was requested.
   *
   * An index into the list of edits the command sent, **not** an identifier. It
   * means nothing to a caller that did not send that list.
   */
  readonly edit: number;
  /** The style the value was written in. */
  readonly from: ScalarStyle;
  /** The style it is written in now. */
  readonly to: ScalarStyle;
  /** Why the old spelling could not be reproduced, when a reason is known. */
  readonly reason: NotReencodable | null;
}

/** The discriminant of every {@link SaveResult} arm. */
export type SaveResultName = 'saved' | 'conflict' | 'refused';

/**
 * The save ran to the end: both gates passed and the transaction returned facts.
 *
 * **It does not say the file is now what you asked for.** The write lock excludes
 * only this application's own writers, so espanso, an editor or a sync agent can
 * replace the file between the transaction's last look and this value reaching
 * the screen.
 */
export interface SavedResult {
  /** Which arm this is. */
  readonly outcome: 'saved';
  /**
   * The revision the file held when the transaction last looked at it — the new
   * base revision to send with the next save.
   */
  readonly revision: ContentRevision;
  /**
   * Whether the file was actually rewritten.
   *
   * **`false` is a success.** A result byte-identical to what the file already
   * held is not written, because replacing a file drops metadata and buys
   * nothing. Both gates still ran.
   */
  readonly committed: boolean;
  /** Spelling changes the edit had to make, for the interface to surface. */
  readonly notes: readonly PresentationNote[];
  /**
   * Whether this save wrote a pre-save copy of the file.
   *
   * **`false` is a success**: no copy was asked for, nothing was rewritten, or
   * this session had already copied this file. A `true` is **not** a promise that
   * the file can be recovered — only ten sessions' worth of copies are kept — and
   * no message may say otherwise.
   */
  readonly backup_taken: boolean;
  /**
   * The affected snippet's identity **in the new revision**, when the command had
   * one.
   *
   * **Every {@link MatchId} held before a save is stale afterwards**, because an
   * identity records the revision it was minted from. `null` when the command
   * acted on no single snippet, when nothing was committed, or when the file
   * changed again between the write and the read that followed it — in which case
   * the document has to be read again.
   */
  readonly moved: MatchId | null;
}

/**
 * The file did not hold what the request was based on, and **nothing was
 * written**.
 *
 * ## Two revisions, and they are two observations
 *
 * {@link ConflictResult.found} is what the file held **under the write lock** —
 * the bytes that refused the save. {@link ConflictResult.disk_revision} is a
 * **fresh read taken afterwards**, once the lock was released, because the save
 * transaction reports a stale base without handing back any bytes. They are
 * usually equal and they need not be: when they differ, the file changed again in
 * between, and nothing here may present the two as descriptions of the same
 * bytes.
 */
export interface ConflictResult {
  /** Which arm this is. */
  readonly outcome: 'conflict';
  /** The revision the request was based on. */
  readonly expected: ContentRevision;
  /** The revision the locked read found — the bytes that refused the save. */
  readonly found: ContentRevision;
  /** The revision of the fresh read taken after the refusal. */
  readonly disk_revision: ContentRevision;
  /**
   * The projection of that fresh read: what the file holds, as far as a read
   * taken after the refusal can say.
   */
  readonly disk: DocumentView;
}

/**
 * The semantic gate refused, and **nothing was written**.
 *
 * The expected, actionable second half of a save that found something: show the
 * findings, and — if the person says so, and only for the ones that can be
 * acknowledged at all — call again with an {@link Acknowledgement} built from
 * exactly these.
 */
export interface RefusedResult {
  /** Which arm this is. */
  readonly outcome: 'refused';
  /** Which arm of the policy refused. */
  readonly verdict: SaveVerdict;
  /** **Every** finding the result produced, of both classes, in report order. */
  readonly findings: readonly Finding[];
}

/**
 * How one save ended.
 *
 * **Document-level, not match-shaped**, and flat rather than externally tagged.
 * The three arms are the three outcomes that are *a save* rather than a failure;
 * everything else rejects with a {@link CommandError}. Switch on `outcome`.
 */
export type SaveResult = SavedResult | ConflictResult | RefusedResult;

// ---------------------------------------------------------------------------
// The draft surface — Phase 2b-2b-3
// ---------------------------------------------------------------------------

/**
 * What the visual editor wants one match to say, and why that can be refused.
 *
 * Every type below mirrors a `espansoconfig_core::draft` type, and this is the
 * **first group on this wire that travels inwards**: a {@link MatchDraft} is
 * deserialized by `save_match`, where every other type in this file is only ever
 * written. Two consequences shape the whole group.
 *
 * 1. **A malformed draft must fail closed.** The Rust side reads a draft with
 *    `deny_unknown_fields`, so a key it does not model is a deserialization
 *    error rather than a silent no-op, and {@link DraftField} is an explicit
 *    tri-state rather than a nullable value — see its own note for the failure
 *    that shape exists to prevent.
 * 2. **A refusal carries indices, never the owner's text.** Twelve
 *    {@link DraftError} variants address something below the match mapping, and
 *    every one of them does it with a **position in the projection** this window
 *    already holds. That is not terseness: a refusal crosses the process
 *    boundary and the configuration is private (CLAUDE.md section 1). A caller
 *    that wants to name the failing field resolves the index against what it is
 *    already showing, and nothing here should ever gain a field to save it the
 *    trouble.
 *
 * The three field-identifier unions — {@link MatchField}, {@link SequenceField}
 * and {@link VariableField} — are spelled as **espanso's own keys** rather than
 * as Rust variant names, because that is what `serde` writes for them and
 * because an espanso key is the same word in every language. They are named on
 * `NOT_A_CODE` in `src-tauri/src/dictionary_contract.rs`, with a reason each, and
 * that table is what exempts them from owning a `code.` dictionary namespace.
 */

/**
 * One schema-known scalar field of a match, spelled as its espanso key.
 *
 * **A field identifier, not a code.** It crosses as the key itself —
 * `uppercase_style`, never `UppercaseStyle` — so a screen that puts it beside a
 * field is showing espanso's own spelling rather than a Rust identifier, and it
 * therefore owes no dictionary entry. `every_match_field_serializes_as_its_espanso_key`
 * in `crates/espansoconfig-core/tests/draft_plan.rs` pins the two spellings
 * against each other, variant by variant.
 */
export type MatchField =
  | 'trigger'
  | 'regex'
  | 'replace'
  | 'markdown'
  | 'html'
  | 'image_path'
  | 'form'
  | 'label'
  | 'comment'
  | 'word'
  | 'left_word'
  | 'right_word'
  | 'propagate_case'
  | 'uppercase_style'
  | 'force_mode'
  | 'force_clipboard'
  | 'paragraph'
  | 'anchor';

/**
 * One schema-known sequence of strings a match may hold.
 *
 * A field identifier for {@link MatchField}'s reason, and pinned by
 * `every_sequence_field_serializes_as_its_espanso_key`.
 */
export type SequenceField = 'triggers' | 'search_terms';

/**
 * One schema-known scalar field of a variable of `vars`.
 *
 * A field identifier for {@link MatchField}'s reason, and pinned by
 * `every_variable_field_serializes_as_its_espanso_key`. `params` is absent on
 * purpose: espanso does not fix its keys, so it is addressed by index
 * ({@link EntryDraft}) rather than by name.
 */
export type VariableField = 'name' | 'type' | 'inject_vars';

/**
 * What the caller wants one field of a match to become: a **tri-state**.
 *
 * ## Why this is not `T | null | undefined`, and must never become it
 *
 * A draft has to say three different things about one field — *leave it alone*,
 * *make it this*, and *take it away* — and the encoding that spells all three
 * with `null` and `undefined` is the one this shape exists to refuse.
 * `undefined`, a missing key and `null` are routinely collapsed into one another
 * by form libraries, serializers and generated clients, and the state they
 * collapse to is the **removal**. A field the user never touched would delete
 * itself, silently, on a boundary nobody looks at.
 *
 * The three states are therefore three distinct tags, with no encoding shared
 * between any two of them: `'Unchanged'`, `{ Set: value }` and `'Remove'`. A
 * `null` where a tag belongs is a **deserialization error** in Rust rather than
 * an unintended mutation — `a_null_draft_field_is_a_deserialization_error_and_never_a_removal`
 * in `crates/espansoconfig-core` is that fact under test.
 *
 * ## An omitted field fails closed, twice over
 *
 * Rust reads an absent field as `Unchanged` (`#[serde(default)]` on every field
 * of `MatchDraft`), which is the one collapse that is safe because it collapses
 * towards *doing nothing*. This file is narrower still: **no property of a draft
 * below is optional**, so a field left out of a draft literal is a compile error
 * rather than a default nobody wrote down. A caller that means *leave this
 * alone* says `'Unchanged'` and can be seen to have said it.
 *
 * @typeParam T - The logical value a `Set` carries. Always `string` today: the
 *   drafted surface is the part of espanso's schema that holds text.
 */
export type DraftField<T> =
  | 'Unchanged'
  | { readonly Set: T }
  | 'Remove';

/**
 * One drafted element of a string sequence, addressed by index.
 *
 * The index is a position in the **original** document — the projection the
 * draft was built against — so it never means "wherever this ends up". That is
 * why {@link import('./commands').saveMatch} sends a base revision beside the
 * draft, and why a stale one is refused rather than applied.
 */
export interface ItemDraft {
  /** The element's index in the original sequence. */
  readonly index: number;
  /**
   * What the caller wants that element to become.
   *
   * `'Remove'` is refused: taking an element away changes the sequence's
   * cardinality, and this surface makes no such change.
   */
  readonly value: DraftField<string>;
}

/**
 * One drafted entry of an **open** mapping, addressed by its index in the
 * projection.
 *
 * An open mapping is one espanso does not fix the keys of: a variable's `params`
 * and the option mapping under one `form_fields` entry. The index is a position
 * in the projected entry list, which is source order, so a caller names an entry
 * it was **shown** rather than a key it composed.
 *
 * {@link EntryDraft.value} covers an entry whose value is a scalar and
 * {@link EntryDraft.items} one whose value is a sequence of scalars. Drafting
 * both on one entry is two answers to one question, and is refused by name
 * (`EntryDraftsAScalarAndASequence`) rather than resolved by precedence.
 */
export interface EntryDraft {
  /** The entry's index in the projected mapping. */
  readonly index: number;
  /** What the caller wants the entry's scalar value to become. */
  readonly value: DraftField<string>;
  /** Drafted elements of the entry's sequence value, by original index. */
  readonly items: readonly ItemDraft[];
}

/**
 * One drafted variable of `vars`, addressed by its index in the projection.
 *
 * The three schema-known scalars are named; everything else a variable holds is
 * addressed positionally through {@link VariableDraft.params}. `depends_on` is
 * deliberately absent — it is a sequence this surface does not draft.
 *
 * **An absent field is refused, never inserted.** Nothing below the match
 * mapping is created by a draft.
 */
export interface VariableDraft {
  /** The variable's index in the projected `vars` list. */
  readonly index: number;
  /** `name`. */
  readonly name: DraftField<string>;
  /** `type`. The wire key is espanso's, not the Rust field's `declared_type`. */
  readonly type: DraftField<string>;
  /** `inject_vars`. */
  readonly inject_vars: DraftField<string>;
  /** Drafted entries of the variable's `params` mapping. */
  readonly params: readonly EntryDraft[];
}

/**
 * One drafted entry of `form_fields`, addressed by its index in the projection.
 *
 * A `form_fields` entry's value is the option mapping espanso reads, so the only
 * thing drafted here is {@link FormFieldDraft.options}. The entry itself is never
 * removed: its value is a mapping, and this surface replaces no collection node
 * and discards no subtree it never displayed.
 */
export interface FormFieldDraft {
  /** The form field's index in the projected `form_fields` list. */
  readonly index: number;
  /** Drafted entries of that form field's own option mapping. */
  readonly options: readonly EntryDraft[];
}

/**
 * A caller's intent for one match, over the drafted surface.
 *
 * **One intention, not a script.** The Rust planner derives the *smallest* edit
 * batch that realises it, so a field left `'Unchanged'` contributes no edit and
 * cannot rewrite bytes nobody touched — its spelling, its quoting and the
 * comments around it stay outside every span the save replaces. Field order
 * implies nothing about edit order.
 *
 * Every property is required, for the reason {@link DraftField} gives: a field
 * omitted by accident is a compile error here rather than a default nobody
 * wrote.
 */
export interface MatchDraft {
  /** `trigger`. */
  readonly trigger: DraftField<string>;
  /** `regex`. */
  readonly regex: DraftField<string>;
  /** `replace`. */
  readonly replace: DraftField<string>;
  /** `markdown`. */
  readonly markdown: DraftField<string>;
  /** `html`. */
  readonly html: DraftField<string>;
  /** `image_path`. */
  readonly image_path: DraftField<string>;
  /** `form`. */
  readonly form: DraftField<string>;
  /** `label`. */
  readonly label: DraftField<string>;
  /** `comment`. */
  readonly comment: DraftField<string>;
  /** `word`. */
  readonly word: DraftField<string>;
  /** `left_word`. */
  readonly left_word: DraftField<string>;
  /** `right_word`. */
  readonly right_word: DraftField<string>;
  /** `propagate_case`. */
  readonly propagate_case: DraftField<string>;
  /** `uppercase_style`. */
  readonly uppercase_style: DraftField<string>;
  /** `force_mode`. */
  readonly force_mode: DraftField<string>;
  /** `force_clipboard`. */
  readonly force_clipboard: DraftField<string>;
  /** `paragraph`. */
  readonly paragraph: DraftField<string>;
  /** `anchor`. */
  readonly anchor: DraftField<string>;
  /** Drafted elements of `triggers`, by index in the original document. */
  readonly triggers: readonly ItemDraft[];
  /** Drafted elements of `search_terms`, by index in the original document. */
  readonly search_terms: readonly ItemDraft[];
  /** Drafted variables of `vars`, by index in the projected list. */
  readonly vars: readonly VariableDraft[];
  /** Drafted entries of `form_fields`, by index in the projected list. */
  readonly form_fields: readonly FormFieldDraft[];
}

/**
 * What a refusal is about, named by schema keys and by indices only.
 *
 * **An address, not a code**, exactly as {@link PathSegment} is: everything it
 * can name is rendered literally, and nothing in it is a sentence. The nested
 * {@link MatchField}, {@link SequenceField} and {@link VariableField} are keys
 * espanso's schema fixes and are safe to carry; the text of a key no schema
 * fixes is the owner's private configuration and is **deliberately absent** from
 * every variant. A variable, a `params` entry, a `form_fields` entry and one of
 * its options are each named by their index in the projection — the same address
 * the draft used to ask for them.
 */
export type DraftTarget =
  | { readonly Field: MatchField }
  | { readonly Item: { readonly field: SequenceField; readonly index: number } }
  | { readonly Variable: { readonly index: number } }
  | {
      readonly VariableScalar: { readonly variable: number; readonly field: VariableField };
    }
  | { readonly Param: { readonly variable: number; readonly entry: number } }
  | {
      readonly ParamItem: {
        readonly variable: number;
        readonly entry: number;
        readonly item: number;
      };
    }
  | { readonly FormField: { readonly index: number } }
  | { readonly FormFieldOption: { readonly field: number; readonly option: number } }
  | {
      readonly FormFieldOptionItem: {
        readonly field: number;
        readonly option: number;
        readonly item: number;
      };
    };

/** The name of every {@link DraftError} variant. */
export type DraftErrorName =
  | 'MatchHasNoPath'
  | 'MatchNotEditable'
  | 'AmbiguousKey'
  | 'NotDecodable'
  | 'NotAScalar'
  | 'FieldHasAnUnmodelledShape'
  | 'RemovalWouldDiscardUnshownStructure'
  | 'TargetOwnsNoBytes'
  | 'SequenceItemDoesNotExist'
  | 'SequenceItemRemoval'
  | 'SequenceItemDraftedTwice'
  | 'NoInsertionAnchor'
  | 'InsertionAnchorRemoved'
  | 'InsertionAnchorIsInserted'
  | 'InsertionAnchorNotInOriginal'
  | 'SharedInsertionAnchor'
  | 'RemovalContainsAnEdit'
  | 'ScalarEditedTwice'
  | 'OutsideTheClosedSurface'
  | 'MoveIsNotADraftEdit'
  | 'TargetDoesNotExist'
  | 'VariableHasNoPath'
  | 'AmbiguousVariableKey'
  | 'VariableFieldHasNoScalar'
  | 'EntryDraftsAScalarAndASequence'
  | 'TargetIsNotNameable'
  | 'TargetKeyIsAmbiguous'
  | 'NestedValueIsACollection'
  | 'NestedRemovalWouldDiscardUnshownStructure'
  | 'NestedItemRemoval'
  | 'TargetDraftedTwice'
  | 'AmbiguousNestedKey';

/**
 * Why a draft could not be turned into an edit batch.
 *
 * **A planning-time refusal, and it is not a {@link SaveResult}.** No batch was
 * derived, no transaction ran, and no acknowledgement can change the answer:
 * the request itself cannot be represented, so the user has to change what they
 * asked for. It arrives as `CommandError::DraftRefused` — see
 * {@link import('./errors').DraftRefusedError}, which states what that means for
 * how it should be presented.
 *
 * **Every operand is a position, a count, a shape or an espanso key.** Not one
 * variant carries a byte of the owner's configuration, and adding a field to
 * carry a key, a trigger or a value would undo the rule rather than improve the
 * message (CLAUDE.md section 1).
 *
 * **Every member is an object, including the one that carries nothing.** Rust
 * declares `MatchHasNoPath {}` as an empty *struct* variant rather than as a unit
 * variant, so `serde` writes `{"MatchHasNoPath": {}}` and not the bare string a
 * unit variant would produce. That uniformity is what lets
 * {@link import('./errors').COMMAND_ERROR_OPERANDS} pin this reason's shape as
 * `'object'` for all thirty-two rather than for thirty-one of them — see the
 * JSDoc on {@link import('./errors').DraftRefusedError.error}. A new member added
 * here as a bare string literal would be a member no refusal can produce.
 */
export type DraftError =
  | { readonly MatchHasNoPath: Record<string, never> }
  | { readonly MatchNotEditable: { readonly hazard: HazardKind | null } }
  | { readonly AmbiguousKey: { readonly field: MatchField | null } }
  | { readonly NotDecodable: { readonly target: DraftTarget } }
  | { readonly NotAScalar: { readonly target: DraftTarget } }
  | {
      readonly FieldHasAnUnmodelledShape: {
        readonly field: MatchField;
        readonly found: ValueKind;
      };
    }
  | {
      readonly RemovalWouldDiscardUnshownStructure: {
        readonly field: MatchField;
        readonly found: ValueKind;
      };
    }
  | { readonly TargetOwnsNoBytes: { readonly target: DraftTarget } }
  | {
      readonly SequenceItemDoesNotExist: {
        readonly field: SequenceField;
        readonly index: number;
        readonly length: number;
      };
    }
  | {
      readonly SequenceItemRemoval: { readonly field: SequenceField; readonly index: number };
    }
  | {
      readonly SequenceItemDraftedTwice: {
        readonly field: SequenceField;
        readonly index: number;
        readonly first: number;
        readonly second: number;
      };
    }
  | { readonly NoInsertionAnchor: { readonly field: MatchField } }
  | { readonly InsertionAnchorRemoved: { readonly edit: number } }
  | { readonly InsertionAnchorIsInserted: { readonly edit: number } }
  | { readonly InsertionAnchorNotInOriginal: { readonly edit: number } }
  | { readonly SharedInsertionAnchor: { readonly first: number; readonly second: number } }
  | { readonly RemovalContainsAnEdit: { readonly removal: number; readonly edit: number } }
  | { readonly ScalarEditedTwice: { readonly first: number; readonly second: number } }
  | { readonly OutsideTheClosedSurface: { readonly edit: number } }
  | { readonly MoveIsNotADraftEdit: { readonly edit: number } }
  | { readonly TargetDoesNotExist: { readonly target: DraftTarget; readonly length: number } }
  | { readonly VariableHasNoPath: { readonly index: number } }
  | { readonly AmbiguousVariableKey: { readonly variable: number } }
  | {
      readonly VariableFieldHasNoScalar: {
        readonly variable: number;
        readonly field: VariableField;
      };
    }
  | { readonly EntryDraftsAScalarAndASequence: { readonly target: DraftTarget } }
  | { readonly TargetIsNotNameable: { readonly target: DraftTarget } }
  | {
      readonly TargetKeyIsAmbiguous: { readonly target: DraftTarget; readonly other: number };
    }
  | {
      readonly NestedValueIsACollection: {
        readonly target: DraftTarget;
        readonly found: ValueKind;
      };
    }
  | {
      readonly NestedRemovalWouldDiscardUnshownStructure: {
        readonly target: DraftTarget;
        readonly found: ValueKind;
      };
    }
  | { readonly NestedItemRemoval: { readonly target: DraftTarget } }
  | {
      readonly TargetDraftedTwice: {
        readonly target: DraftTarget;
        readonly first: number;
        readonly second: number;
      };
    }
  | { readonly AmbiguousNestedKey: { readonly edit: number } };

// ---------------------------------------------------------------------------
// Projections onto the name unions
// ---------------------------------------------------------------------------

/**
 * The name of a diagnostic code, whether or not it carries operands.
 *
 * This is the function Phase 1b-2b's dictionary lookup is built on: a bare
 * string variant is its own name, and a variant with operands is a one-key
 * object whose single key is the name.
 *
 * @param code - A diagnostic code as it crossed the boundary.
 * @returns The variant name, which is a {@link DiagnosticCodeName}.
 */
export function diagnosticCodeName(code: DiagnosticCode): DiagnosticCodeName {
  if (typeof code === 'string') {
    return code;
  }
  // A struct variant is externally tagged, so it has exactly one key and that
  // key is the variant name. `Object.keys` returns `string[]`, and the cast
  // states the invariant serde guarantees rather than checking it — a runtime
  // check here could only throw, and there is no honest thing to throw.
  return Object.keys(code)[0] as DiagnosticCodeName;
} // End of function diagnosticCodeName()

/**
 * The name of an unknown-entry reason, whether or not it carries operands.
 *
 * @param reason - A reason as it crossed the boundary.
 * @returns The variant name, which is an {@link UnknownReasonName}.
 */
export function unknownReasonName(reason: UnknownReason): UnknownReasonName {
  if (typeof reason === 'string') {
    return reason;
  }
  return 'UnexpectedShape';
} // End of function unknownReasonName()

/**
 * The operands a diagnostic code carries, or `null` when it carries none.
 *
 * Structured data, never a sentence: 1b-2b interpolates these into a
 * `{placeholder}` in the dictionary, which is where the prose lives.
 *
 * @param code - A diagnostic code as it crossed the boundary.
 * @returns The operand object, or `null` for a variant with no operands.
 */
export function diagnosticCodeOperands(code: DiagnosticCode): Readonly<Record<string, unknown>> | null {
  if (typeof code === 'string') {
    return null;
  }
  const operands = Object.values(code)[0];
  return operands === undefined ? null : (operands as Readonly<Record<string, unknown>>);
} // End of function diagnosticCodeOperands()

/**
 * The variant name of any externally tagged wire value.
 *
 * The generic twin of {@link diagnosticCodeName}, added at Phase 2b-1 because
 * eleven more tagged unions arrived at once and eleven near-identical projections
 * would have been eleven places for one of them to be wrong. `serde` writes a
 * variant with no operands as its bare name and a variant with operands as a
 * one-key object, so the rule is the same for all of them.
 *
 * The cast states the invariant `serde` guarantees rather than checking it — a
 * runtime check here could only throw, and there is no honest thing to throw. The
 * *type* is still checked where it matters: the caller names the union, and every
 * key builder in `src/lib/i18n/codes.ts` takes that union and returns a
 * `TranslationKey`, so a name with no dictionary entry is a compile error there.
 *
 * @typeParam Name - The `…Name` union the value's variants are drawn from.
 * @param value - An externally tagged value as it crossed the boundary.
 * @returns The variant name.
 */
export function wireVariantName<Name extends string>(
  value: string | Readonly<Record<string, unknown>>
): Name {
  if (typeof value === 'string') {
    return value as Name;
  }
  return Object.keys(value)[0] as Name;
} // End of function wireVariantName()

/**
 * The operands an externally tagged wire value carries, or `null` for none.
 *
 * Structured data, never a sentence: the prose lives in the dictionary, and these
 * fill its `{placeholder}` tokens.
 *
 * A variant whose payload is another tagged value — `SaveError.Patch` carries a
 * whole `EditError` — answers with that value, because there is no shape here
 * that could distinguish the two. What keeps a nested error out of a sentence is
 * the operand collector in `src/lib/i18n/codes.ts`, which keeps strings and
 * numbers and drops everything else.
 *
 * @param value - An externally tagged value as it crossed the boundary.
 * @returns The payload object, or `null` for a bare-name variant.
 */
export function wireVariantOperands(
  value: string | Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> | null {
  if (typeof value === 'string') {
    return null;
  }
  const payload = Object.values(value)[0];
  if (payload === undefined || payload === null || typeof payload !== 'object') {
    return null;
  }
  return payload as Readonly<Record<string, unknown>>;
} // End of function wireVariantOperands()
