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
 * **The one quantity that is not so bounded crosses as digits rather than as a
 * number**: {@link BackupEntry.length} is a length `stat` reported for a file in
 * an untrusted backup batch, so it is a `string`.
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

/**
 * Where one modelled mapping entry sits in the source, read off the syntax index
 * in Rust (Phase 3-2).
 *
 * The spans count **bytes**; a JavaScript string index counts UTF-16 code units,
 * so `text.slice(span.start, span.end)` is wrong for any document holding a
 * non-ASCII character before the span. They are carried for Rust's own later use
 * and never sliced here.
 */
export interface FieldLocation {
  /** The key node. */
  readonly key_node: NodeId;
  /** The key's byte span. */
  readonly key_span: ByteSpan;
  /** The value node. */
  readonly value_node: NodeId;
  /** The value's byte span. */
  readonly value_span: ByteSpan;
  /** The path that names the value, or `null` when the mapping has none. */
  readonly path: DocumentPath | null;
}

/** The names of {@link SequencePresence}'s four states. */
export type SequencePresenceName = 'Absent' | 'Empty' | 'Items' | 'UnsupportedShape';

/**
 * Whether a schema-known list — `triggers`, `search_terms`, a document's
 * `imports` — is written at all, and in what shape (Phase 3-2).
 *
 * The item array alone cannot tell an absent key from `key: []`; this can. Every
 * state crosses as a one-key object, `Absent` included.
 */
export type SequencePresence =
  | { readonly Absent: Record<string, never> }
  | { readonly Empty: { readonly location: FieldLocation } }
  | {
      readonly Items: {
        readonly location: FieldLocation;
        readonly flow: boolean;
        readonly count: number;
      };
    }
  | { readonly UnsupportedShape: { readonly location: FieldLocation; readonly found: ValueKind } };

/**
 * Whether a mapping-valued entry below a match — a variable's `params`, a
 * verbose form's `params.fields`, a match's `form_fields`, one form field's
 * options — is written at all, and in what shape (Phase 4-3).
 *
 * The mapping twin of {@link SequencePresence}: the projected entry array alone
 * cannot tell an absent key from `key: {}` or from a key holding a scalar. Every
 * state crosses as a one-key object, `Absent` included. No screen draws it yet.
 */
export type MappingPresence =
  | { readonly Absent: Record<string, never> }
  | { readonly Empty: { readonly location: FieldLocation } }
  | {
      readonly Entries: {
        readonly location: FieldLocation;
        readonly flow: boolean;
        readonly count: number;
      };
    }
  | { readonly UnsupportedShape: { readonly location: FieldLocation; readonly found: ValueKind } };

/**
 * The container shape of one form field definition (Phase 4-3), one per entry of
 * `form_fields` or of a verbose form's `params.fields`, parallel to that
 * mapping's projected entries.
 */
export interface FormFieldShape {
  /** The definition's own value, read as an option mapping. Never `Absent`. */
  readonly options: MappingPresence;
  /** The `values` option inside it; `Absent` when there is none. */
  readonly values: SequencePresence;
}

/** A match's trigger side. All three fields are carried, never collapsed. */
export interface TriggerSpec {
  /** `trigger`, as source text. */
  readonly trigger: ScalarView | null;
  /** `triggers`, one item per source entry, in source order. */
  readonly triggers: readonly ValueView[];
  /** Whether `triggers` is written at all, and in what shape (Phase 3-2). */
  readonly triggers_presence: SequencePresence;
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
  /** Whether `params` is written at all, and in what shape (Phase 4-3). */
  readonly params_presence: MappingPresence;
  /** `depends_on`, one item per source entry, in source order. */
  readonly depends_on: readonly ValueView[];
  /** Whether `depends_on` is written at all, and in what shape (Phase 4-3). */
  readonly depends_on_presence: SequencePresence;
  /**
   * The presence of the kind's one list parameter — `values` for `choice`,
   * `choices` for `random`, `args` for `script` — or `null` for a kind that has
   * none (Phase 4-3).
   */
  readonly list_param_presence: SequencePresence | null;
  /** The presence of a verbose form's `params.fields`, or `null` when the kind is not `form`. */
  readonly fields_presence: MappingPresence | null;
  /** One shape per entry of `params.fields`, parallel to its entries (Phase 4-3). */
  readonly field_shapes: readonly FormFieldShape[];
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
  /** Whether `search_terms` is written at all, and in what shape (Phase 3-2). */
  readonly search_terms_presence: SequencePresence;
  /** The word-boundary, case and injection options. */
  readonly options: MatchOptions;
  /** `vars`. */
  readonly vars: readonly VariableView[];
  /**
   * Whether `vars` is written at all, and in what shape (Phase 4-3). An empty
   * {@link MatchView.vars} is no authority to insert a container or an item.
   */
  readonly vars_presence: SequencePresence;
  /** `form_fields`, projected shallowly and completely. */
  readonly form_fields: readonly FieldView[];
  /** Whether `form_fields` is written at all, and in what shape (Phase 4-3). */
  readonly form_fields_presence: MappingPresence;
  /** One shape per entry of `form_fields`, parallel to its entries (Phase 4-3). */
  readonly form_field_shapes: readonly FormFieldShape[];
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
  /**
   * Whether `imports` is written at all, and in what shape (Phase 3-2). A
   * profile, an unparsed document and a root that is not a mapping answer
   * `Absent`.
   */
  readonly imports_presence: SequencePresence;
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
 * How far the retention tidy-up of recognised backup batches got.
 *
 * Not the same question as what it removed: `ScanFailed` and a `Scanned` that
 * removed nothing produce the same counts and mean opposite things.
 */
export type RotationOutcome = 'NotAttempted' | 'Refused' | 'ScanFailed' | 'Scanned';

/** Which join of a move a block-scalar refusal is about. */
export type MoveSeam = 'SourceCloses' | 'ArrivalLands' | 'ArrivalCloses' | 'CarriedRunsJoin';

/**
 * Which join of a duplicate a block-scalar refusal is about.
 *
 * {@link MoveSeam} minus the source close, under duplicate names: a duplicate
 * leaves the source in place, so the seam a removal and a move both create does
 * not exist for it and this type cannot spell it.
 */
export type DuplicateSeam = 'ArrivalLands' | 'ArrivalCloses' | 'CopiedRunsJoin';

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
  | 'PlainSourceNotReadBack'
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
  | 'RemovalCarriesMoreThanTheEntry'
  | 'DuplicateCarriesMoreThanTheItem'
  | 'DuplicatedBytesWereRewritten'
  | 'DuplicateNotInPlace'
  | 'ConstructChangedOutsideTheDuplicate'
  | 'EntriesNotInTheIntendedOrder'
  | 'ItemNotInserted'
  | 'SequenceStyleChanged'
  | 'ItemTextRangeNotOwned'
  | 'ItemTextIsNotOneItem'
  | 'ItemTextIsNotAMapping'
  | 'ConstructChangedOutsideTheItemText'
  | 'ItemTextExtendsPastItsRange'
  | 'ItemTextEscapesTheItem'
  | 'ItemTextIntroducesAHazard';

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
  | {
      readonly PlainSourceNotReadBack: {
        readonly edit: number;
        readonly at: number;
        readonly len: number;
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
  | { readonly RemovalCarriesMoreThanTheEntry: { readonly at: ByteSpan; readonly lines: ByteSpan } }
  | {
      readonly DuplicateCarriesMoreThanTheItem: {
        readonly edit: number;
        readonly at: ByteSpan;
        readonly lines: ByteSpan;
      };
    }
  | {
      readonly DuplicatedBytesWereRewritten: {
        readonly edit: number;
        readonly at: number;
        readonly first_difference: number;
      };
    }
  | { readonly DuplicateNotInPlace: { readonly edit: number; readonly position: number } }
  | {
      readonly ConstructChangedOutsideTheDuplicate: {
        readonly edit: number;
        readonly node: NodeId;
      };
    }
  | { readonly EntriesNotInTheIntendedOrder: { readonly edit: number; readonly entry: number } }
  | { readonly ItemNotInserted: { readonly edit: number; readonly item: number } }
  | { readonly SequenceStyleChanged: { readonly edit: number } }
  | { readonly ItemTextRangeNotOwned: { readonly edit: number; readonly at: ByteSpan } }
  | {
      readonly ItemTextIsNotOneItem: {
        readonly edit: number;
        readonly expected: number;
        readonly found: number;
      };
    }
  | { readonly ItemTextIsNotAMapping: { readonly edit: number; readonly kind: NodeKind } }
  | {
      readonly ConstructChangedOutsideTheItemText: {
        readonly edit: number;
        readonly node: NodeId;
      };
    }
  | { readonly ItemTextExtendsPastItsRange: { readonly edit: number; readonly at: ByteSpan } }
  | { readonly ItemTextEscapesTheItem: { readonly edit: number; readonly at: ByteSpan } }
  | {
      readonly ItemTextIntroducesAHazard: {
        readonly edit: number;
        readonly hazard: HazardKind;
      };
    };

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
  | 'NotASequence'
  | 'InsertedItemHasNoFields'
  | 'DuplicateInsertedField'
  | 'InvalidInsertedFieldKey'
  | 'FlowSequenceInsertionUnsupported'
  | 'InconsistentSequenceIndentation'
  | 'ImplicitNullSequenceHasAmbiguousTrivia'
  | 'RemovalWouldEmptyTheSequence'
  | 'DuplicateMustBeTheOnlyEditInItsBatch'
  | 'DuplicateWouldCopyAFileComment'
  | 'DuplicateWouldExtendAKeptBlock'
  | 'DuplicateWouldExtendABlockScalar'
  | 'KeyNotSubstitutable'
  | 'ShapeSwitchUnsupported'
  | 'FlowListTriviaAmbiguous'
  | 'FlowListLayoutUnsupported'
  | 'ItemTextMustBeTheOnlyEditInItsBatch'
  | 'ItemRangeNotContiguous'
  | 'ItemTextHoldsCarriageReturn'
  | 'ItemTextLosesItsFinalLineBreak'
  | 'ItemTextEscapesItsIndentation'
  | 'ItemTextWouldExtendABlockScalar'
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
  | {
      readonly NotASequence: {
        readonly edit: number;
        readonly node: NodeId;
        readonly kind: NodeKind;
      };
    }
  | { readonly InsertedItemHasNoFields: { readonly edit: number } }
  | { readonly DuplicateInsertedField: { readonly edit: number; readonly field: number } }
  | { readonly InvalidInsertedFieldKey: { readonly edit: number; readonly field: number } }
  | {
      readonly FlowSequenceInsertionUnsupported: {
        readonly edit: number;
        readonly sequence: NodeId;
      };
    }
  | {
      readonly InconsistentSequenceIndentation: {
        readonly edit: number;
        readonly sequence: NodeId;
        readonly expected: number;
        readonly found: number;
      };
    }
  | {
      readonly ImplicitNullSequenceHasAmbiguousTrivia: {
        readonly edit: number;
        readonly at: number;
      };
    }
  | { readonly RemovalWouldEmptyTheSequence: { readonly edit: number; readonly sequence: NodeId } }
  | {
      readonly DuplicateMustBeTheOnlyEditInItsBatch: {
        readonly edit: number;
        readonly edits: number;
      };
    }
  | { readonly DuplicateWouldCopyAFileComment: { readonly edit: number; readonly comment: ByteSpan } }
  | { readonly DuplicateWouldExtendAKeptBlock: { readonly edit: number; readonly block: NodeId } }
  | {
      readonly DuplicateWouldExtendABlockScalar: {
        readonly edit: number;
        readonly block: NodeId;
        readonly seam: DuplicateSeam;
      };
    }
  | { readonly KeyNotSubstitutable: { readonly edit: number; readonly node: NodeId } }
  | { readonly ShapeSwitchUnsupported: { readonly edit: number; readonly node: NodeId } }
  | {
      readonly FlowListTriviaAmbiguous: {
        readonly edit: number;
        readonly sequence: NodeId;
        readonly at: ByteSpan;
      };
    }
  | { readonly FlowListLayoutUnsupported: { readonly edit: number; readonly sequence: NodeId } }
  | {
      readonly ItemTextMustBeTheOnlyEditInItsBatch: {
        readonly edit: number;
        readonly edits: number;
      };
    }
  | { readonly ItemRangeNotContiguous: { readonly edit: number; readonly hole: ByteSpan } }
  | { readonly ItemTextHoldsCarriageReturn: { readonly edit: number } }
  | { readonly ItemTextLosesItsFinalLineBreak: { readonly edit: number } }
  | { readonly ItemTextEscapesItsIndentation: { readonly edit: number; readonly line: number } }
  | { readonly ItemTextWouldExtendABlockScalar: { readonly edit: number; readonly block: NodeId } }
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
  | 'RegexDoesNotCompile'
  | 'DocumentDoesNotParse'
  | 'DuplicateKeepsTriggerDefinition'
  | 'NewMatchRepeatsLiteralTrigger'
  | 'VariableDependencyCycle'
  | 'DependencyHasNoDeclaration';

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
    }
  | {
      /**
       * The submitted text is not YAML this app can read.
       *
       * Produced only by a whole-document replacement, never by the semantic
       * rules, and it is **acknowledgeable**: the app reports it and writes the
       * text anyway once the user confirms, because refusing would mean an
       * already-broken file could never be repaired here.
       */
      readonly DocumentDoesNotParse: {
        /**
         * The content revision of the exact text this finding is about.
         *
         * What binds an acknowledgement to one candidate. The position and the
         * message describe where the parser stopped, so two different texts that
         * share an invalid prefix produce the same ones; hand a finding back
         * unchanged and it acknowledges that text and no other.
         *
         * Opaque, and never rendered.
         */
        readonly revision: ContentRevision;
        /** Line the parser stopped at, or `null` when it reported no position. */
        readonly line: number | null;
        /** Column the parser stopped at, on the same terms as `line`. */
        readonly column: number | null;
        /** The same position as a byte offset into the submitted text, when known. */
        readonly byte_index: number | null;
        /**
         * The parser's own diagnostic, carried verbatim.
         *
         * Developer-facing, and never rendered — the same rule
         * `RegexDoesNotCompile.detail` follows.
         */
        readonly detail: string;
      };
    }
  | {
      /**
       * The save inserted a byte-exact copy of an existing snippet, so the copy
       * keeps the same trigger definition as its source.
       *
       * Produced only by a duplicate batch, never by the semantic rules, and it
       * is **acknowledgeable**: a claim about risk, never about espanso
       * semantics — this app cannot determine how espanso chooses between
       * overlapping definitions.
       */
      readonly DuplicateKeepsTriggerDefinition: {
        /**
         * The content revision of the exact candidate this finding is about.
         *
         * What binds an acknowledgement to one candidate. The clone's path,
         * span and node also travel on the finding, but all three are equal
         * across a same-length rewrite of the source trigger; hand a finding
         * back unchanged and it acknowledges that text and no other.
         *
         * Opaque, and never rendered.
         */
        readonly revision: ContentRevision;
      };
    }
  | {
      /**
       * The snippet this save creates repeats literal trigger text another
       * snippet of the same list already writes.
       *
       * Produced only by an insertion batch, never by the semantic rules, and it
       * is **acknowledgeable**: a claim about risk, never about espanso
       * semantics — this app cannot determine how espanso handles overlapping
       * definitions, and its silence about a *non*-repeating trigger is not a
       * claim that the trigger is safe.
       *
       * It reaches **ordinary creation** as well as recovery, because exact
       * repetition is a property of the candidate rather than of the route that
       * built it. It is a separate code from
       * `DuplicateKeepsTriggerDefinition`, which is produced only for a
       * duplicate: one name over both would make consent for a duplicate
       * readable as consent for a creation.
       */
      readonly NewMatchRepeatsLiteralTrigger: {
        /**
         * The content revision of the exact candidate this finding is about.
         *
         * What binds an acknowledgement to one candidate. The new item's path,
         * span and node also travel on the finding, but all three are equal
         * across a same-length rewrite above the insertion point; hand a finding
         * back unchanged and it acknowledges that text and no other.
         *
         * Opaque, and never rendered.
         */
        readonly revision: ContentRevision;
      };
    }
  | {
      /**
       * A variable change leaves a local variable in a dependency cycle the
       * file did not have before — a new cycle, or one that grew or merged.
       *
       * Produced only for a save that changes a snippet's variables, never by
       * the semantic rules, and it is **acknowledgeable**: the graph is this
       * app's reading (explicit `depends_on` plus references inside injected
       * parameter values), not espanso's resolver.
       */
      readonly VariableDependencyCycle: {
        /** The content revision of the exact candidate. Opaque, never rendered. */
        readonly revision: ContentRevision;
        /** The cycle's first variable in authored order, as the file writes it. */
        readonly name: string;
        /** How many variables the cycle holds; `1` is a self-dependency. */
        readonly size: number;
      };
    }
  | {
      /**
       * A variable change makes a `depends_on` entry name something no visible
       * declaration carries, under a scope this app can see is closed.
       *
       * Produced only for a save that adds such an entry, never under an open
       * scope (imports among them), and it is **acknowledgeable**.
       */
      readonly DependencyHasNoDeclaration: {
        /** The content revision of the exact candidate. Opaque, never rendered. */
        readonly revision: ContentRevision;
        /** The named dependency, as the file writes it. */
        readonly name: string;
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

/**
 * One snippet's owned physical-line range, cut in Rust and handed out as text
 * for the local raw editor (Phase 3-7) — `match_item_text`'s answer.
 *
 * **It carries no byte offset**, and no caller may cut one out of any other
 * string: a byte span is not a JavaScript string index. The save sends the text
 * back with the match's identity and the base revision, and Rust re-derives the
 * range itself. The two line numbers are display data only.
 */
export interface OwnedItemText {
  /**
   * The range's exact text — leading comment block, dash, every line of the
   * item and each line's own terminator. Never holds a `\r`: such a range is
   * refused by the read.
   */
  readonly text: string;
  /** The physical line the range starts on, one-based. */
  readonly first_line: number;
  /** How many physical lines the range covers. */
  readonly line_count: number;
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
 * What the retention tidy-up of recognised backup batches did, on the one save
 * per session that runs it.
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
 * **Not a promise that the file is recoverable.** Rotation attempts to retain ten
 * recognised batch directories by sortable name, but it promises neither how long
 * this batch remains nor that cleanup succeeds. It is also not a version history:
 * it holds the file as it was before the session's first change, not before each
 * change.
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
  | 'ReplacementRequiresBackups'
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
  | { readonly ReplacementRequiresBackups: { readonly path: string } }
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

/** The name of every {@link PresentationNote} variant. */
export type PresentationNoteName = 'ScalarRestyled' | 'DoubledSequenceSeparation';

/**
 * A change to the file's *appearance* an edit had to make, reported rather than
 * performed silently.
 *
 * Plan section 6.2 — never silently normalise. A note is never a refusal: it is
 * this application telling a person about something it changed and was not asked
 * to change.
 *
 * **Two kinds, and the tag is what tells them apart.** `ScalarRestyled` is about
 * one value's spelling and is the shape this type had until Phase 2b-2c-2.
 * `DoubledSequenceSeparation` is about the file's layout and has no value and no
 * style anywhere in it, which is exactly why it could not be spelled as the
 * first: deleting a snippet from between two blank-separated siblings leaves both
 * blank lines — the correct bytes, because neither blank line belonged to the
 * snippet — so what is owed is the disclosure and not a collapse.
 *
 * Every variant's `edit` is an index into the list of edits the command sent,
 * **not** an identifier. It means nothing to a caller that did not send that
 * list.
 */
export type PresentationNote =
  | {
      readonly ScalarRestyled: {
        readonly edit: number;
        readonly from: ScalarStyle;
        readonly to: ScalarStyle;
        readonly reason: NotReencodable | null;
      };
    }
  | { readonly DoubledSequenceSeparation: { readonly edit: number } };

/** The discriminant of every {@link SaveResult} arm. */
export type SaveResultName = 'saved' | 'conflict' | 'refused';

/**
 * Why a conflict's snippet could not be identified in the file as it is now.
 *
 * Every member is a **negative claim about evidence**, never a claim about what
 * somebody did, about where a snippet went, or about what espanso would accept.
 * None of them says the snippet is gone: the strongest thing any of them says is
 * that no candidate in the snapshot that was examined carried the evidence the
 * operation permits, or that more than one did.
 */
export type ReapplyRefusal =
  | 'NoAnchorInBase'
  | 'WrongDocument'
  | 'DiskDoesNotParse'
  | 'SequenceMissing'
  | 'AmbiguousExact'
  | 'NoExactCorrespondence'
  | 'TargetMissingOrTriggerChanged'
  | 'AmbiguousTrigger'
  | 'NoTriggerToMatch';

/** The variant name of every {@link ReapplyResolution} arm. */
export type ReapplyResolutionName = 'Unsupported' | 'Targetless' | 'Identified' | 'Refused';

/**
 * What the search for a refused operation's **own snippet** found — Phase
 * 2c-4b-1.
 *
 * **Evidence, and only evidence.** It names no control, authorizes nothing, and
 * nothing this application does with a conflict depends on it. `Identified` says
 * exactly one snippet of the conflict's own file, in the snapshot
 * {@link ConflictResult.disk_revision} names, carries evidence at a tier the
 * command selected. It does **not** say the operation would now succeed, that a
 * draft still applies, that nothing else changed, or that the file cannot change
 * again — and where the tier that answered was the editor's trigger fallback, it
 * does not establish that the snippet is the original one either.
 *
 * The two empty arms are deliberately two facts and not one. `Targetless` is a
 * creation: it brings its own snippet and names no existing one to find again.
 * `Unsupported` is a whole-document replacement: there is no snippet, no field
 * and no action in it to find again, permanently and by construction.
 *
 * Every arm is a one-key object, including the two with no operands, so this can
 * be type-guarded without a special case per variant — the convention the core's
 * own tagged enums follow.
 */
export type ReapplyResolution =
  | { readonly Unsupported: Record<string, never> }
  | { readonly Targetless: Record<string, never> }
  | { readonly Identified: { readonly target: MatchView } }
  | { readonly Refused: { readonly reason: ReapplyRefusal } };

/** The variant name of every {@link ReapplyPlacement} arm. */
export type ReapplyPlacementName = 'NotAnchored' | 'Identified' | 'Refused';

/**
 * What the search for a refused operation's **positional anchor** found — Phase
 * 2c-4b-1.
 *
 * A second enum rather than a reuse of {@link ReapplyResolution}, because the two
 * slots answer two questions and their empty arms are two different facts:
 * `Targetless` there says *this change brings its own snippet*, and
 * `NotAnchored` here says *this change is not placed after a named one*. One
 * sentence for both would be untrue of one of them.
 *
 * A placement always requires exact snippet correspondence: an anchor decides
 * where bytes are put, and a snippet that merely still spells its trigger the
 * same way is not evidence of a position. There is no arm for a weaker tier
 * because there is no way to ask for one.
 */
export type ReapplyPlacement =
  | { readonly NotAnchored: Record<string, never> }
  | { readonly Identified: { readonly target: MatchView } }
  | { readonly Refused: { readonly reason: ReapplyRefusal } };

/**
 * Both correspondence operands of one refused operation — Phase 2c-4b-1.
 *
 * **The whole answer, so half an answer cannot be mistaken for one.** A move sent
 * after another snippet has two identities to find again: the snippet it moves
 * and the snippet it is placed after. A reader that consulted only
 * {@link ReapplyEvidence.subject} would have a correct identification of the
 * moved snippet and no evidence at all about whether the destination it was sent
 * to still exists.
 *
 * Both halves are answered against the same snapshot, in one Rust call. Nothing
 * in TypeScript expresses that pairing; what it rests on is that one function
 * builds them.
 */
export interface ReapplyEvidence {
  /** What the search for the operation's own snippet found. */
  readonly subject: ReapplyResolution;
  /** What the search for the operation's positional anchor found. */
  readonly placement: ReapplyPlacement;
}

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
  /**
   * Presentation changes the command had to make, for the interface to surface.
   *
   * **Always empty for a move.** A move copies the snippet's own bytes verbatim,
   * and the doubled blank line it leaves behind is deliberately not reported —
   * only a deletion discloses that one.
   */
  readonly notes: readonly PresentationNote[];
  /**
   * Whether this save wrote a pre-save copy of the file.
   *
   * **`false` is a success**: no copy was asked for, nothing was rewritten, or
   * this session had already copied this file. A `true` is **not** a promise that
   * the file can be recovered: rotation is best-effort, orders batches by
   * directory label and promises no retention duration. No message may say
   * otherwise.
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
 *
 * **That rule binds {@link ConflictResult.disk_text} too.** The text is of the
 * fresh read — the bytes `disk_revision` names — and never of the bytes at `found`
 * that actually refused the save. When the two revisions differ, the text here is
 * of the *later* observation, so drawing it under `found` would label one read's
 * bytes with another read's digest.
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
   * The **whole file text** of that fresh read, unchanged.
   *
   * No line ending converted, no BOM stripped, no normalisation: the file as the
   * disk holds it. {@link ConflictResult.disk} cannot stand in for it — a
   * {@link DocumentView} is a projection, and even a snippet's own `source_text`
   * is one mapping's owned slice.
   *
   * **It is the text at {@link ConflictResult.disk_revision}**, paired with it by
   * the command layer: both come out of one workspace snapshot in the single place
   * in production this payload is built, so there is no second read and no call
   * ordering between them.
   *
   * **What makes the pairing sound is content-hash equality**, not that the two
   * came out of one read: the Rust refresh hashes the bytes it just read and keeps
   * the snapshot it had cached when that hash already matches, so this text can be
   * an earlier read's — of bytes just proved equal to the disk's by digest. What
   * that leaves open is a hash collision. And TypeScript cannot express the pairing
   * at all — these are two ordinary properties — so what it rests on is that one
   * Rust function builds them together.
   *
   * Never `null`. A conflict whose disk text could not be read does not exist:
   * the refresh that produces this payload refuses a file that is not valid
   * UTF-8, and the whole command then rejects instead of reporting a conflict.
   */
  readonly disk_text: string;
  /**
   * The answers to this operation's correspondence questions — one for its own
   * snippet and one for the snippet it is placed after — and where answering one
   * required a search, it is **that same fresh read** that was searched.
   *
   * **Several answers require no search at all**, and none of them is a claim
   * about the disk: a whole-document replacement has no honest reapply, a
   * creation brings its own snippet, an operation may name no positional anchor,
   * and an operand whose evidence could not be recorded before the save was
   * attempted is decided without consulting the current file at all. Only the
   * anchored arms examine it.
   *
   * **Evidence only.** Nothing in this application reads it to decide anything;
   * it exists so that a later phase can, and adding it changed no behaviour.
   *
   * It is bound to {@link ConflictResult.disk_revision} the way
   * {@link ConflictResult.disk_text} is, and by the same construction: one Rust
   * function computes all four from one workspace snapshot. The **questions** it
   * answers are older than that snapshot — the evidence it searches for was
   * recorded before the save was attempted, from the file as the command
   * validated the request against it — which is the point: evidence recorded
   * afterwards would describe the bytes that caused the conflict rather than the
   * bytes the person was working on. TypeScript cannot express either pairing;
   * what they rest on is that one Rust function builds them.
   */
  readonly reapply: ReapplyEvidence;
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
// The bulk option edit — Phase 3-10
// ---------------------------------------------------------------------------

/**
 * One of the seven match options a bulk edit may write (ruling 20), spelled as
 * its espanso key.
 *
 * **A field identifier, not a code**, for {@link MatchField}'s reason: it
 * crosses as the key itself, so a screen that names it shows espanso's own
 * spelling. `every_bulk_option_serializes_as_its_espanso_key` in
 * `crates/espansoconfig-core/tests/draft_bulk.rs` pins the two spellings. No
 * other field can be sent: Rust refuses any other string while reading the
 * request.
 */
export type BulkOption =
  | 'word'
  | 'left_word'
  | 'right_word'
  | 'propagate_case'
  | 'uppercase_style'
  | 'force_mode'
  | 'force_clipboard';

/**
 * What a bulk edit asks of one option: a logical value, or its removal.
 *
 * Externally tagged exactly as {@link DraftField} is, and deliberately **without
 * an `'Unchanged'` member**: an option the person did not touch — a *Mixed*
 * control left alone included — is absent from the request.
 */
export type BulkValue = { readonly Set: string } | 'Remove';

/** One option intent, applied to every selected snippet of every file. */
export interface BulkOptionChange {
  /** The option to write. */
  readonly option: BulkOption;
  /** What it should become. */
  readonly value: BulkValue;
}

/**
 * The consent one file carries: the candidate it was shown, and the findings
 * acknowledged for it (ruling 22).
 *
 * Bound to one candidate by revision, so consent collected for one set of
 * intents or one selection is reported stale rather than spent on another.
 * TypeScript does not tie the two properties together; the Rust preflight is
 * what compares them.
 */
export interface BulkConsent {
  /** The file the consent was collected for. */
  readonly document: DocumentId;
  /** The base revision the consent was collected against. */
  readonly base_revision: ContentRevision;
  /** The intent fingerprint a refusal reported for this file's request. */
  readonly intent: ContentRevision;
  /** The candidate revision the findings were shown for. */
  readonly candidate: ContentRevision;
  /** The findings acknowledged for it. */
  readonly acknowledgement: Acknowledgement;
}

/** One file of a bulk option edit. */
export interface BulkFileRequest {
  /** The file. */
  readonly document: DocumentId;
  /** The revision the selection was made against. */
  readonly base_revision: ContentRevision;
  /** The selected snippets of this file, each at most once. */
  readonly matches: readonly MatchId[];
  /** This file's consent, or `null` on a first attempt. */
  readonly consent: BulkConsent | null;
}

/**
 * One bulk option edit. There is **no `force` flag**: Rust refuses any property
 * it does not declare, at every level of this request.
 */
export interface BulkOptionsRequest {
  /** The option intents, each option at most once. */
  readonly changes: readonly BulkOptionChange[];
  /** The files, in the order they are attempted. */
  readonly files: readonly BulkFileRequest[];
  /** Files excluded before sending; reported, never read or written. */
  readonly excluded: readonly DocumentId[];
}

/** The variant name of every {@link IdentityError} arm. */
export type IdentityErrorName = 'WrongDocument' | 'StaleRevision' | 'NoSuchMatch';

/**
 * Why a snippet identity did not resolve, as the core writes it inside a
 * {@link BulkPlanError}. Elsewhere the same three conditions cross flattened
 * into `CommandError` codes.
 */
export type IdentityError =
  | { readonly WrongDocument: { readonly expected: DocumentId; readonly found: DocumentId } }
  | {
      readonly StaleRevision: {
        readonly expected: ContentRevision;
        readonly found: ContentRevision;
      };
    }
  | { readonly NoSuchMatch: { readonly node: NodeId } };

/** The variant name of every {@link BulkPlanError} arm. */
export type BulkPlanErrorName =
  | 'NoOptionChanges'
  | 'OptionRepeated'
  | 'OptionNotPlainSource'
  | 'NoFiles'
  | 'DocumentRepeated'
  | 'NoMatches'
  | 'MatchRepeated'
  | 'Identity'
  | 'Draft';

/**
 * Why a bulk edit, or one file of it, could not be planned — and **nothing was
 * written**. The first four refuse the whole request; the last four are one
 * file's preflight blocker. `index` is a position in that file's selection.
 */
export type BulkPlanError =
  | { readonly NoOptionChanges: Record<string, never> }
  | { readonly OptionRepeated: { readonly option: BulkOption } }
  | { readonly OptionNotPlainSource: { readonly option: BulkOption } }
  | { readonly NoFiles: Record<string, never> }
  | { readonly DocumentRepeated: { readonly document: DocumentId } }
  | { readonly NoMatches: Record<string, never> }
  | { readonly MatchRepeated: { readonly index: number } }
  | { readonly Identity: { readonly index: number; readonly error: IdentityError } }
  | { readonly Draft: { readonly index: number; readonly error: DraftError } };

/** The discriminant of every {@link BulkFileOutcome} arm (ruling 19). */
export type BulkFileOutcomeName =
  | 'saved'
  | 'alreadyUnchanged'
  | 'conflicted'
  | 'refused'
  | 'consentStale'
  | 'blocked'
  | 'failed'
  | 'writeOutcomeUnknown'
  | 'notAttempted'
  | 'excludedBeforeApply';

/** The file was rewritten. */
export interface BulkSavedOutcome {
  /** Which arm this is. */
  readonly outcome: 'saved';
  /** The revision read back after the write. */
  readonly revision: ContentRevision;
  /**
   * Whether this save wrote a pre-save copy. `false` is a success: this session
   * had already copied the file. Not a promise that the file is recoverable.
   */
  readonly backup_taken: boolean;
  /** Presentation changes the write had to make. */
  readonly notes: readonly PresentationNote[];
}

/** Every selected snippet already held the values; nothing was written or copied. */
export interface BulkAlreadyUnchangedOutcome {
  /** Which arm this is. */
  readonly outcome: 'alreadyUnchanged';
  /** The revision the file held when the save re-read it. */
  readonly revision: ContentRevision;
}

/** The file moved on under the write lock; nothing was written to it. */
export interface BulkConflictedOutcome {
  /** Which arm this is. */
  readonly outcome: 'conflicted';
  /** The revision the request was based on. */
  readonly expected: ContentRevision;
  /** The revision the locked read found. */
  readonly found: ContentRevision;
  /** The revision of a fresh read taken afterwards. */
  readonly disk_revision: ContentRevision;
}

/** The save gate refused this file's candidate; nothing was written to it. */
export interface BulkRefusedOutcome {
  /** Which arm this is. */
  readonly outcome: 'refused';
  /** Which arm of the policy refused. */
  readonly verdict: SaveVerdict;
  /** Every finding the candidate produced. */
  readonly findings: readonly Finding[];
  /** The candidate those findings belong to — what a {@link BulkConsent} names. */
  readonly candidate: ContentRevision;
  /** The intent fingerprint a {@link BulkConsent} for them must name. */
  readonly intent: ContentRevision;
}

/**
 * The consent sent was collected for another file, base revision, intent or
 * candidate; nothing was written anywhere.
 */
export interface BulkConsentStaleOutcome {
  /** Which arm this is. */
  readonly outcome: 'consentStale';
  /** The intent fingerprint a fresh consent must name. */
  readonly intent: ContentRevision;
  /** The candidate the preflight derived, which a fresh consent must name. */
  readonly candidate: ContentRevision;
}

/** The preflight could not plan or judge this file; nothing was written anywhere. */
export interface BulkBlockedOutcome {
  /** Which arm this is. */
  readonly outcome: 'blocked';
  /** Why, as every other command reports it. */
  readonly error: import('./errors').CommandError;
}

/** The save failed and certainly did not write this file. */
export interface BulkFailedOutcome {
  /** Which arm this is. */
  readonly outcome: 'failed';
  /** The failure, as every other command reports it. */
  readonly error: import('./errors').CommandError;
}

/** The save failed after its write may have happened; later files were not attempted. */
export interface BulkWriteOutcomeUnknownOutcome {
  /** Which arm this is. */
  readonly outcome: 'writeOutcomeUnknown';
  /** The failure, as every other command reports it. */
  readonly error: import('./errors').CommandError;
}

/** The run stopped before this file; it was not touched. */
export interface BulkNotAttemptedOutcome {
  /** Which arm this is. */
  readonly outcome: 'notAttempted';
}

/** The caller excluded this file before sending; it was not touched. */
export interface BulkExcludedBeforeApplyOutcome {
  /** Which arm this is. */
  readonly outcome: 'excludedBeforeApply';
}

/** What happened to one file of a bulk option edit. Switch on `outcome`. */
export type BulkFileOutcome =
  | BulkSavedOutcome
  | BulkAlreadyUnchangedOutcome
  | BulkConflictedOutcome
  | BulkRefusedOutcome
  | BulkConsentStaleOutcome
  | BulkBlockedOutcome
  | BulkFailedOutcome
  | BulkWriteOutcomeUnknownOutcome
  | BulkNotAttemptedOutcome
  | BulkExcludedBeforeApplyOutcome;

/** One file's line of a {@link BulkResult}: its identity beside its outcome. */
export type BulkFileReport = { readonly document: DocumentId } & BulkFileOutcome;

/** What one bulk option edit did, file by file. */
export interface BulkResult {
  /** `false` means no file was written and no save ran. */
  readonly preflight_passed: boolean;
  /**
   * `true` only when no file's outcome is `saved` or `writeOutcomeUnknown`.
   * Derived in Rust from the outcomes below, never asserted beside them.
   */
  readonly nothing_written: boolean;
  /** The applied files in request order, then the excluded ones. */
  readonly files: readonly BulkFileReport[];
}

/**
 * How one option is written in one snippet — absent, or present and spelled
 * exactly so (Phase 3-11-1, ruling 20).
 *
 * **Source spelling, cut in Rust, never a decoded value.** `word: true` and
 * `word: 'true'` are two spellings here, where {@link ScalarView.text} would
 * call them equal. A display fact only: nothing built from it is ever sent.
 * `NotOneScalar` is an option written, but not as one scalar the projection
 * models — a collection, an alias or a repeated key; its bytes are not carried.
 */
export type OptionSpelling =
  | { readonly Absent: Record<string, never> }
  | { readonly Written: { readonly source: string } }
  | { readonly NotOneScalar: Record<string, never> };

/**
 * How each of the seven bulk options is written in one snippet, as
 * `match_option_spellings` answers it. One property per {@link BulkOption}.
 */
export interface BulkOptionSpellings {
  /** `word`. */
  readonly word: OptionSpelling;
  /** `left_word`. */
  readonly left_word: OptionSpelling;
  /** `right_word`. */
  readonly right_word: OptionSpelling;
  /** `propagate_case`. */
  readonly propagate_case: OptionSpelling;
  /** `uppercase_style`. */
  readonly uppercase_style: OptionSpelling;
  /** `force_mode`. */
  readonly force_mode: OptionSpelling;
  /** `force_clipboard`. */
  readonly force_clipboard: OptionSpelling;
}

// ---------------------------------------------------------------------------
// The application sidecar store — Phase 3-12
// ---------------------------------------------------------------------------

/** The variant name of every {@link SidecarStatus} (ruling 27). */
export type SidecarStatusName =
  | 'Fresh'
  | 'Loaded'
  | 'Quarantined'
  | 'QuarantineFailed'
  | 'FutureSchema'
  | 'Unreadable'
  | 'RootUnresolved'
  | 'StorageUnavailable';

/**
 * How one sidecar load ended. Only `Fresh`, `Loaded` and `Quarantined` allow a
 * write, which {@link SidecarState.writable} restates.
 *
 * `Quarantined` is built only after the corrupt file **was** renamed aside, to
 * `aside`, inside the application's own folder. `QuarantineFailed`,
 * `FutureSchema` and `Unreadable` leave the file's bytes untouched and refuse
 * every write. `version` is the declared schema version in decimal.
 */
export type SidecarStatus =
  | { readonly Fresh: Record<string, never> }
  | { readonly Loaded: Record<string, never> }
  | { readonly Quarantined: { readonly aside: string } }
  | { readonly QuarantineFailed: Record<string, never> }
  | { readonly FutureSchema: { readonly version: string } }
  | { readonly Unreadable: Record<string, never> }
  | { readonly RootUnresolved: Record<string, never> }
  | { readonly StorageUnavailable: Record<string, never> };

/**
 * One new-snippet default: an option and its source **text** (ruling 28).
 * `''` is an empty default; an option with no entry has no default.
 */
export interface SidecarDefault {
  /** Which of the seven options. */
  readonly option: BulkOption;
  /** The text, exactly as stored. Never a boolean. */
  readonly value: string;
}

/** The sidecar preferences of one listed file. */
export interface SidecarFilePreferences {
  /** The file. */
  readonly document: DocumentId;
  /** The person's label for it, as written — user data, never translated. */
  readonly display_name: string | null;
  /** Its sidebar position, if one is set. */
  readonly sort_order: number | null;
  /** Its defaults, in option order. */
  readonly defaults: readonly SidecarDefault[];
}

/** What `load_sidecar` answers: the preferences in effect and how they were read. */
export interface SidecarState {
  /** How the load ended. */
  readonly status: SidecarStatus;
  /** Whether an update may write; derived in Rust from `status`. */
  readonly writable: boolean;
  /** The listed files that have preferences, in the workspace's order. */
  readonly files: readonly SidecarFilePreferences[];
  /** Entries kept for files the workspace does not list (kept thirty days). */
  readonly retained_orphans: number;
}

/**
 * One change to one file's preferences. Applied in order; a later change to
 * the same field wins.
 */
export type SidecarChange =
  | { readonly SetDisplayName: { readonly name: string } }
  | { readonly ClearDisplayName: Record<string, never> }
  | { readonly SetSortOrder: { readonly order: number } }
  | { readonly ClearSortOrder: Record<string, never> }
  | { readonly SetDefault: { readonly option: BulkOption; readonly value: string } }
  | { readonly ClearDefault: { readonly option: BulkOption } };

/** What `update_sidecar` takes. It carries no path: the file is named by Rust. */
export interface SidecarUpdateRequest {
  /** The file, by session identity. */
  readonly document: DocumentId;
  /** The changes, in order. */
  readonly changes: readonly SidecarChange[];
}

/** The variant name of every {@link SidecarUpdateOutcome}. */
export type SidecarUpdateOutcomeName = 'Saved' | 'Unchanged' | 'NotWritable' | 'WriteFailed';

/**
 * What one sidecar update did. `WriteFailed` means the replacement failed
 * before its rename, so the sidecar holds what it held.
 */
export type SidecarUpdateOutcome =
  | { readonly Saved: Record<string, never> }
  | { readonly Unchanged: Record<string, never> }
  | { readonly NotWritable: Record<string, never> }
  | { readonly WriteFailed: Record<string, never> };

/** What `update_sidecar` answers. */
export interface SidecarUpdateResult {
  /** What the update did. */
  readonly outcome: SidecarUpdateOutcome;
  /** The preferences in effect afterwards. */
  readonly state: SidecarState;
}

// ---------------------------------------------------------------------------
// The read-only backup catalogue — Phase 2c-5-2
// ---------------------------------------------------------------------------

/**
 * The types the three backup commands answer with, and the two a caller hands
 * back.
 *
 * **Nothing in this group writes anything**, and nothing in it is a licence to.
 * A restore is a whole-document replacement sent through
 * `saveRawDocument` — the sixth writer, unchanged — so these types carry a
 * candidate and its identity and no route to write to disk.
 *
 * Three claims none of them makes, each of which the Rust side argues at
 * length:
 *
 * 1. **A recognised batch is not an authentic one.** The ownership marker is
 *    deliberately forgeable by anything able to write inside the backup folder,
 *    so recognition protects against accident and is not authentication.
 * 2. **A batch name is not a time.** It is a sortable directory name derived
 *    from the process clock, with a numeric counter that separates sessions
 *    created under one label. Ordering by it is proved; *"the version from
 *    Tuesday"* is not.
 * 3. **A {@link BackupTarget} is a statement about a name**, never that a file
 *    exists at that path or that this entry's bytes were copied from it.
 */

/** Whether the backup folder was there to be listed. */
export type BackupRootState = 'Missing' | 'Present';

/**
 * Why one entry of the backup folder is not an eligible batch.
 *
 * Every one means *left exactly as found and never counted as a batch*. Only
 * `Unreadable` means nothing was learned about it, which is what makes a
 * listing incomplete.
 */
export type BatchSkipped = 'ForeignName' | 'NotADirectory' | 'NoMarker' | 'Unreadable';

/**
 * Why one thing inside a batch is not an entry the catalogue offers.
 *
 * `Marker` is the batch's own ownership file, which is bookkeeping and not a
 * copied document. `Symlink` is the code for a link the walk **observed** — at
 * any depth, and refused rather than resolved on every platform this application
 * runs on. It is not a claim that a link created after that observation cannot
 * be followed: that guarantee is per target and
 * `src-tauri/src/backup.rs`'s header states both answers.
 */
export type EntrySkipped =
  | 'Marker'
  | 'Symlink'
  | 'NotARegularFile'
  | 'UnusableName'
  | 'Unreadable';

/** Which part of reading the backup folder failed. */
export type BackupReadStep =
  | 'InspectBackupRoot'
  | 'ListBackupRoot'
  | 'InspectBatch'
  | 'ListBatch'
  | 'InspectEntry'
  | 'ReadEntry';

/** The name of every {@link BackupTarget} variant. */
export type BackupTargetName = 'InConfigRoot' | 'OutsideConfigRoot';

/**
 * Which target namespace one entry's **name** occupies.
 *
 * **Mixed in shape**, exactly as {@link UnknownReason} is: `InConfigRoot`
 * carries a relative path and crosses as a one-key object, `OutsideConfigRoot`
 * carries nothing and crosses as a bare string.
 *
 * A syntactic classification of the entry's own path and nothing more. It does
 * not say a file exists at `relative_path`, and it does not say this entry's
 * bytes came from one — a copy published under a disambiguated sibling name
 * classifies as whatever its literal path says.
 */
export type BackupTarget =
  | {
      readonly InConfigRoot: {
        /** The path relative to the configuration folder. Display data. */
        readonly relative_path: string;
      };
    }
  | 'OutsideConfigRoot';

/**
 * The opaque identity of one recognised batch.
 *
 * **Opaque by contract: compare it, hand it back, and do not build a path from
 * it.** Its `name` is an ordinary string and a pathname can be composed from it —
 * what makes it safe is that every command validates it and re-resolves it
 * beneath the workspace-owned backup root, not that composing a path is out of
 * reach. Holding one proves nothing about the folder: every call re-resolves it,
 * and a batch another session's tidy-up removed comes back as a stale refusal
 * rather than as an empty listing.
 */
export interface BackupBatchId {
  /** The batch folder's name. A label, never a timestamp assertion. */
  readonly name: string;
}

/** One recognised batch, as a listing found it. */
export interface BackupBatch {
  /** The identity every later call is made with. */
  readonly id: BackupBatchId;
  /**
   * The folder's name, which is the only label there is.
   *
   * The same characters as {@link BackupBatchId.name}, deliberately: this is
   * what a screen may show, and the id is what a call is made with.
   */
  readonly display_name: string;
}

/**
 * The opaque identity of one entry of one batch.
 *
 * {@link BackupBatchId}'s rules, and one more: `relative_path` is the exact
 * spelling the catalogue addresses the entry by, and it is **not** normalised on
 * the way back. `match/./base.yml` is refused rather than read as
 * `match/base.yml`, so an admitted identity carries only plain relative
 * components and joining it introduces no lexical `.` or `..` escape. Filesystem
 * containment is a separate matter, and it retains the target-specific
 * guarantees the core's `ResolvedDirectory` documents.
 *
 * Every identity a listing offers survives its own rendering byte for byte — an
 * entry whose name cannot be spelled on this wire is counted in
 * {@link BackupEntryListing.unaddressable} instead of being offered.
 */
export interface BackupEntryId {
  /** The batch the entry is inside. */
  readonly batch: BackupBatchId;
  /** The entry's path relative to that batch folder. */
  readonly relative_path: string;
}

/** One entry a batch offers, as a listing found it. */
export interface BackupEntry {
  /** The identity every later call is made with. */
  readonly id: BackupEntryId;
  /** The path relative to the batch folder, for display. Lossy. */
  readonly display_path: string;
  /**
   * The byte length observed when the entry was listed, as decimal digits.
   *
   * A fact about that moment, not a promise about the next read.
   *
   * **A `string`, and that is deliberate.** A filesystem length can exceed
   * JavaScript's safe-integer range, where not every `u64` is exactly
   * representable as a JSON number — for example, `2^53 + 1` is rounded. A batch
   * is untrusted input, so a sparse regular file longer than `2^53 - 1` is
   * reachable. Decimal digits therefore carry every value losslessly. Use
   * `BigInt(length)` to compare one, never `Number(length)`.
   */
  readonly length: string;
  /** Which target namespace the entry's own name occupies. */
  readonly target: BackupTarget;
}

/**
 * What one listing of the backup folder found.
 *
 * The batches **and** what was skipped, never one without the other: *"there
 * are no backups"* is a sentence {@link BackupBatchListing.complete} licenses
 * and an empty `batches` does not.
 */
export interface BackupBatchListing {
  /**
   * Whether the backup folder existed at all.
   *
   * `Missing` is the ordinary state of a configuration this application has
   * never saved from. An outcome, not a failure.
   */
  readonly root: BackupRootState;
  /** The recognised batches, newest name first. */
  readonly batches: readonly BackupBatch[];
  /** One code per entry of the folder that is not an eligible batch. */
  readonly skipped: readonly BatchSkipped[];
  /** How many entries of the folder were read and are not batches. */
  readonly unrecognised: number;
  /** How many entries of the folder nothing could be learned about. */
  readonly unreadable: number;
  /**
   * Whether every entry of the folder was read.
   *
   * Rust's own predicate rather than something derived here from `skipped`:
   * which reasons mean *nothing was learned* is the core's answer, and a second
   * copy of that rule in TypeScript would be a second thing to keep in step.
   */
  readonly complete: boolean;
}

/** What one walk of one batch found. */
export interface BackupEntryListing {
  /** The batch that was walked. */
  readonly batch: BackupBatchId;
  /** The entries it offers and this boundary can name, by relative path. */
  readonly entries: readonly BackupEntry[];
  /** One code per thing inside the batch that is not an entry. */
  readonly skipped: readonly EntrySkipped[];
  /** How many things inside the batch were read and are not entries. */
  readonly unrecognised: number;
  /** How many things inside the batch nothing could be learned about. */
  readonly unreadable: number;
  /**
   * How many entries the batch offers that this boundary cannot name.
   *
   * **A property of the wire, not of the folder.** A file name that is not valid
   * UTF-8 has no exact spelling in a JSON string, so such an entry is counted
   * here rather than offered under an identity that would not come back. It is
   * normally zero, and on a filesystem that enforces UTF-8 file names it cannot
   * be anything else.
   */
  readonly unaddressable: number;
  /**
   * Whether the whole batch was read **and** every entry it offers is listed.
   *
   * Stronger than the folder listing's `complete`, because both
   * {@link BackupEntryListing.unreadable} and
   * {@link BackupEntryListing.unaddressable} make `entries` short.
   */
  readonly complete: boolean;
}

/**
 * One backup entry's exact text, and the live file it maps to.
 *
 * Answered only after the entry has been shown to be the one that batch holds
 * for that document — the check `readBackupText` exists for.
 */
export interface BackupTextResponse {
  /** The entry, as re-observed by the mapping that verified it. */
  readonly entry: BackupEntry;
  /** The document the entry maps to, by its session-local identity. */
  readonly document: DocumentId;
  /**
   * The entry's exact text.
   *
   * Byte for byte what the file held: no line ending converted, no byte-order
   * mark added or removed, no final newline supplied, no normalisation. Bytes
   * that are not valid UTF-8 have no text at all and are refused instead.
   *
   * **Untrusted input.** It came out of a folder anything able to write there
   * could have put a file in.
   */
  readonly text: string;
  /**
   * The revision of exactly those bytes.
   *
   * Evidence that a preview and a later submission are the same bytes. It is
   * **not** a base revision for the live document, which has a revision of its
   * own.
   */
  readonly revision: ContentRevision;
}

/** The name of every {@link BackupReadError} variant. */
export type BackupReadErrorName =
  | 'RootNotADirectory'
  | 'RootNotPrivate'
  | 'StaleBatch'
  | 'StaleEntry'
  | 'Io'
  | 'NotUtf8';

/**
 * Why a backup-catalogue request could not return its requested result.
 *
 * **Not always a failed read**: `NotUtf8` is the arm where the entry opened and
 * every byte arrived, and only turning those bytes into a string did not succeed.
 *
 * **A missing backup folder is not in here**, deliberately: it is the ordinary
 * state of a configuration nothing has been saved from, and it arrives as
 * `root: 'Missing'` on a successful listing instead.
 *
 * `StaleBatch` and `StaleEntry` mean *this identity does not resolve now*, which
 * is a statement about the folder. The two refusals for a forged identity —
 * `unrecognisedBackupBatch` and `unaddressableBackupEntry` in `./errors` — are
 * raised before anything is opened and say nothing about it.
 */
export type BackupReadError =
  | { readonly RootNotADirectory: { readonly path: string } }
  | { readonly RootNotPrivate: { readonly path: string; readonly mode: number } }
  | { readonly StaleBatch: { readonly batch: BackupBatchId } }
  | { readonly StaleEntry: { readonly entry: BackupEntryId } }
  | {
      readonly Io: {
        readonly step: BackupReadStep;
        readonly path: string;
        /** A `std::io::ErrorKind` variant name. A code, never a message. */
        readonly kind: string;
        /**
         * The operating system's own error number, or `null`. Diagnostic data
         * with no dictionary entry, exactly as {@link BackupError}'s is.
         */
        readonly raw_os_error: number | null;
      };
    }
  | {
      readonly NotUtf8: {
        readonly entry: BackupEntryId;
        /** Byte offset of the first invalid sequence. */
        readonly offset: number;
      };
    };

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
 * One of the five content keys, spelled as its espanso key — Phase 3-5-1.
 *
 * Mirrors Rust's `ContentForm`, which serializes as the key for
 * {@link MatchField}'s reason: a field identifier, not a code, so it owes no
 * dictionary entry (`NOT_A_CODE` in `src-tauri/src/dictionary_contract.rs`).
 */
export type ContentForm = 'replace' | 'markdown' | 'html' | 'image_path' | 'form';

/**
 * One of the two scalar trigger keys, spelled as its espanso key — Phase 3-6-1.
 *
 * Mirrors Rust's `TriggerForm`, which serializes as the key for
 * {@link MatchField}'s reason: a field identifier, not a code, so it owes no
 * dictionary entry (`NOT_A_CODE` in `src-tauri/src/dictionary_contract.rs`).
 */
export type TriggerForm = 'trigger' | 'regex';

/**
 * Where new items go in an existing list — Phase 3-6-1, mirroring Rust's
 * `ListPlacement`. An index is a position in the **original** list, never a
 * byte offset and never "wherever this ends up".
 */
export type ListPlacement =
  | { readonly Front: Record<string, never> }
  | { readonly After: { readonly index: number } }
  | { readonly End: Record<string, never> };

/**
 * One intent about the cardinality or presence of `triggers` or
 * `search_terms` — Phase 3-6-1, mirroring Rust's `SequenceIntent`.
 *
 * **What no type here forces, and Rust does**: an `items` array of
 * `InsertItems` is never empty (Rust reads it through `ScalarItems`, which
 * refuses `[]` while the command's arguments are read). `InsertField` with no
 * items is the explicitly requested empty list, written `[]`.
 */
export type SequenceIntent =
  | {
      readonly InsertItems: {
        readonly field: SequenceField;
        readonly at: ListPlacement;
        readonly items: readonly string[];
      };
    }
  | { readonly RemoveItem: { readonly field: SequenceField; readonly index: number } }
  | { readonly InsertField: { readonly field: SequenceField; readonly items: readonly string[] } }
  | { readonly RemoveField: { readonly field: SequenceField } };

/**
 * The switch between a scalar trigger form and a block `triggers` list —
 * Phase 3-6-1, mirroring Rust's `TriggerSwitch`. `ToList.items` is never
 * empty, which Rust forces and this type does not.
 */
export type TriggerSwitch =
  | { readonly ToList: { readonly from: TriggerForm; readonly items: readonly string[] } }
  | { readonly FromList: { readonly to: TriggerForm; readonly value: string } };

/**
 * A drafted change of trigger form — Phase 3-6-1, mirroring Rust's
 * `TriggerFormChange`. `Rename` names only its source, because the
 * destination is the other scalar form; `Switch` carries a {@link TriggerSwitch}.
 */
export type TriggerFormChange =
  | { readonly Rename: { readonly from: TriggerForm } }
  | { readonly Switch: { readonly switch: TriggerSwitch } };

/**
 * A drafted switch of content kind: the match's one content key renamed to
 * another, in place — Phase 3-5-1, mirroring Rust's `ContentSwitch`.
 *
 * **Two different forms.** Rust refuses `from === to` while reading the
 * command's arguments; this type cannot say so, and `contentSwitchOf` in
 * `../browser/matchEditor.ts` is the one producer, which never builds one.
 * What it converts: nothing — the value is kept unless the draft's own field
 * for {@link ContentSwitch.to} says otherwise, and no companion key is added
 * or removed.
 */
export interface ContentSwitch {
  /** The content key the match holds now. */
  readonly from: ContentForm;
  /** The content key it is renamed to. */
  readonly to: ContentForm;
}

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
 * The value of one new author-named `params` entry (Phase 4-3): one scalar or a
 * flat list of scalars, each a logical string spelled by the codec in Rust.
 */
export type NewParamValue =
  | { readonly Scalar: string }
  | { readonly List: readonly string[] };

/**
 * One new **author-named** entry of an existing variable's block `params`
 * mapping (Phase 4-3). The key is decoded text, spelled by Rust in key context;
 * a refusal about it names the insertion's position, never its text.
 */
export interface NewParam {
  /** The new entry's key, as decoded text. */
  readonly key: string;
  /** The new entry's value. */
  readonly value: NewParamValue;
}

/**
 * One of the typed settings written verbatim as plain source below the match
 * mapping (ruling 4): the four a new variable writes (Phase 4-4) and the two a
 * form field definition writes (Phase 4-6). Spelled as the espanso key, so a
 * screen can put the key itself beside a refusal about it.
 */
export type VariableSetting =
  | 'inject_vars'
  | 'offset'
  | 'trim'
  | 'debug'
  | 'multiline'
  | 'trim_string_values';

/**
 * The kind-specific parameters of a new variable (Phase 4-4): one variant per
 * kind, nine in all, each naming exactly that kind's parameters. `type` is
 * derived from the variant in Rust. `offset`, `trim` and `debug` are plain
 * source; every other string is a logical string spelled by the codec. `null`
 * means the new variable is not born holding that parameter.
 */
export type NewVariableParams =
  | {
      readonly Date: {
        readonly format: string | null;
        readonly offset: string | null;
        readonly tz: string | null;
        readonly locale: string | null;
      };
    }
  | { readonly Choice: { readonly values: readonly string[] } }
  | { readonly Random: { readonly choices: readonly string[] } }
  | { readonly Clipboard: Record<string, never> }
  | { readonly Echo: { readonly echo: string } }
  | {
      readonly Shell: {
        readonly cmd: string;
        readonly shell: string | null;
        readonly trim: string | null;
        readonly debug: string | null;
      };
    }
  | { readonly Script: { readonly args: readonly string[]; readonly trim: string | null } }
  | {
      readonly Form: { readonly layout: string; readonly fields: readonly NewFormField[] };
    }
  | { readonly Match: { readonly trigger: string } };

/**
 * Which form's definitions an intent or a refusal is about (Phase 4-6): the
 * match's shorthand `form_fields`, an existing form variable's `params.fields`,
 * or a new form variable's, by position in `var_intents`. Positions only.
 */
export type FormOwner =
  | { readonly Shorthand: Record<string, never> }
  | { readonly Variable: { readonly variable: number } }
  | { readonly NewVariable: { readonly insertion: number } };

/**
 * The `values` of a new `choice` or `list` definition (Phase 4-6), in one of
 * espanso's two representations, never converted into the other.
 */
export type FormValues = { readonly List: readonly string[] } | { readonly Text: string };

/**
 * The options a new definition is born holding, or that are added to an existing
 * one (Phase 4-6). `multiline` and `trim_string_values` are plain source; every
 * other string is a logical string spelled by the codec. `null` means the option
 * is not written. Rust checks the plain-source text, the extras' key rules and
 * their bound (sixteen); TypeScript forces none of it.
 */
export interface FormOptions {
  /** `type`. */
  readonly type: string | null;
  /** `default`. */
  readonly default: string | null;
  /** `multiline`, as plain source. */
  readonly multiline: string | null;
  /** `values`, as a list or as text. */
  readonly values: FormValues | null;
  /** `trim_string_values`, as plain source. */
  readonly trim_string_values: string | null;
  /** Extra author-named options, each a scalar or a flat list of scalars. */
  readonly extra: readonly NewParam[];
}

/** A new form field definition (Phase 4-6): the placeholder's name and its options. */
export interface NewFormField {
  /** The name, as decoded text. */
  readonly name: string;
  /** The options it is born holding; none at all is written `{}`. */
  readonly options: FormOptions;
}

/**
 * One intent about the cardinality or presence of one form's definitions (Phase
 * 4-6). The same intent writes the shorthand shape when carried by
 * {@link MatchDraft.form_intents} and the verbose one when carried by
 * {@link VariableDraft.field_intents}; nothing converts one into the other.
 */
export type FormFieldIntent =
  | { readonly InsertField: { readonly after: number | null; readonly field: NewFormField } }
  | { readonly RemoveField: { readonly index: number } }
  | { readonly RemoveFields: Record<string, never> };

/**
 * One intent about the items of an existing definition's `values` list (Phase
 * 4-6). Rust refuses an empty item array while reading the arguments;
 * TypeScript does not force that.
 */
export type FormValuesIntent =
  | { readonly InsertItems: { readonly at: ListPlacement; readonly items: readonly string[] } }
  | { readonly RemoveItem: { readonly index: number } };

/**
 * A new local variable, as a closed description (Phase 4-4). Rust checks what no
 * type here can: a one-line, unique name; plain-source settings; at most sixteen
 * extra parameters under ruling 7's key rules. No production caller sends one
 * yet.
 */
export interface NewVariable {
  /** `name`, a logical string. */
  readonly name: string;
  /** The kind and its own parameters. */
  readonly params: NewVariableParams;
  /** `inject_vars`, as plain source, or `null`. */
  readonly inject_vars: string | null;
  /** `depends_on`, or `null`; an empty list is written `[]`. */
  readonly depends_on: readonly string[] | null;
  /** Extra author-named parameters, written after the kind's own. */
  readonly extra_params: readonly NewParam[];
}

/**
 * One intent about the cardinality or presence of a match's `vars` (Phase 4-4).
 * A reorder is not one: it is its own writer's, alone in its batch (R25).
 */
export type VarsIntent =
  | {
      readonly InsertVariable: { readonly at: ListPlacement; readonly variable: NewVariable };
    }
  | { readonly RemoveVariable: { readonly index: number } }
  | { readonly RemoveVars: Record<string, never> };

/**
 * One of the four lists of a variable a draft edits by item (Phase 4-5):
 * `depends_on`, and the kind's own list parameter — `values` of a `choice`,
 * `choices` of a `random`, `args` of a `script`. Spelled as the espanso key, so a
 * screen can put the key itself beside a refusal about it.
 */
export type VariableList = 'depends_on' | 'values' | 'choices' | 'args';

/**
 * One of the two entries of a `choice` record a draft rewrites (Phase 4-5),
 * spelled as the espanso key.
 */
export type ChoiceRecordField = 'label' | 'id';

/**
 * One new `{label, id}` record of a `choice` variable's `values` (Phase 4-5).
 * Both are logical strings spelled by the codec in Rust; a new record holds
 * exactly these two entries.
 */
export interface ChoiceRecord {
  /** `label` — the text the choice dialog shows. */
  readonly label: string;
  /** `id` — the text the variable expands to. */
  readonly id: string;
}

/**
 * The new items of one list insertion (Phase 4-5): strings, or records — one
 * shape per insertion. Rust refuses an empty array of either while reading the
 * arguments; TypeScript does not force that.
 */
export type NewListItems =
  | { readonly Strings: readonly string[] }
  | { readonly Records: readonly ChoiceRecord[] };

/**
 * One intent about the cardinality of one list of an existing variable (Phase
 * 4-5). An index is a position in the **original** list.
 */
export type VariableListIntent =
  | {
      readonly InsertItems: {
        readonly list: VariableList;
        readonly at: ListPlacement;
        readonly items: NewListItems;
      };
    }
  | { readonly RemoveItem: { readonly list: VariableList; readonly index: number } };

/**
 * A drafted rewrite of one existing `{label, id}` record, by its index in the
 * original `values` list (Phase 4-5). `null` leaves that entry alone; there is no
 * spelling of removing one, and every other entry of the record is never named.
 */
export interface ChoiceRecordDraft {
  /** The record's index in the original `values` list. */
  readonly index: number;
  /** The new `label`, or `null` for unchanged. */
  readonly label: string | null;
  /** The new `id`, or `null` for unchanged. */
  readonly id: string | null;
}

/**
 * One drafted variable of `vars`, addressed by its index in the projection.
 *
 * The three schema-known scalars are named; everything else a variable holds is
 * addressed positionally through {@link VariableDraft.params}. Since Phase 4-5
 * its four lists are drafted too: existing `depends_on` items
 * ({@link VariableDraft.depends_on}), existing records
 * ({@link VariableDraft.records}) and items added or removed
 * ({@link VariableDraft.lists}).
 *
 * **An absent field is refused, never inserted**, with two exceptions:
 * {@link VariableDraft.insert_params} adds new author-named entries to an
 * existing block `params` mapping (Phase 4-3), and {@link VariableDraft.lists}
 * adds items to an existing list (Phase 4-5). No production caller sends either
 * yet.
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
  /** New author-named `params` entries, in the order they are written (Phase 4-3). */
  readonly insert_params: readonly NewParam[];
  /** Drafted `depends_on` items, by original index (Phase 4-5). */
  readonly depends_on: readonly ItemDraft[];
  /** Drafted rewrites of existing `choice` records (Phase 4-5). */
  readonly records: readonly ChoiceRecordDraft[];
  /** Items added to or removed from the variable's four lists (Phase 4-5). */
  readonly lists: readonly VariableListIntent[];
  /** Drafted definitions of a verbose form's `params.fields` (Phase 4-6). */
  readonly fields: readonly FormFieldDraft[];
  /** Intents about a verbose form's definitions (Phase 4-6). */
  readonly field_intents: readonly FormFieldIntent[];
}

/**
 * One drafted form field definition, addressed by its index in the projection —
 * of the shorthand `form_fields` in {@link MatchDraft.form_fields}, of a verbose
 * form's `params.fields` in {@link VariableDraft.fields}.
 *
 * It drafts the definition's existing options, new options (Phase 4-6) and the
 * items of its `values` list (Phase 4-6); the definition itself is added and
 * removed by a {@link FormFieldIntent}.
 */
export interface FormFieldDraft {
  /** The definition's index in the projected definition list. */
  readonly index: number;
  /** Drafted entries of that definition's own option mapping. */
  readonly options: readonly EntryDraft[];
  /** New options, written after the last option that stays (Phase 4-6). */
  readonly insert_options: FormOptions;
  /** Items added to or removed from its `values` list (Phase 4-6). */
  readonly values: readonly FormValuesIntent[];
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
  /**
   * A drafted switch of content kind, or `null` — Phase 3-5-1.
   *
   * One more substitution beside the draft: its source key must be
   * `'Unchanged'` above, and its destination's value is the destination field
   * above (`'Unchanged'` keeps the value's bytes exactly).
   */
  readonly content_switch: ContentSwitch | null;
  /**
   * A drafted change of trigger form, or `null` — Phase 3-6-1. A `Rename`'s
   * source must be `'Unchanged'` above and its destination's value is the
   * destination field above; a `Switch` is the only intent about `triggers`.
   */
  readonly trigger_form: TriggerFormChange | null;
  /** Drafted list intents about `triggers` and `search_terms` — Phase 3-6-1. */
  readonly sequences: readonly SequenceIntent[];
  /** Drafted intents about `vars` — Phase 4-4. No production caller sends one yet. */
  readonly var_intents: readonly VarsIntent[];
  /**
   * Drafted intents about the shorthand `form_fields` — Phase 4-6. No production
   * caller sends one yet.
   */
  readonly form_intents: readonly FormFieldIntent[];
}

// ---------------------------------------------------------------------------
// The creation surface — Phase 2b-2c-2, widened at Phase 3-4
// ---------------------------------------------------------------------------

/**
 * How a new snippet is triggered: exactly one of espanso's three trigger keys.
 *
 * Mirrors Rust's `NewTrigger` (Phase 3-4). Each arm is a one-key object whose
 * tag is a protocol tag, never shown to anyone: `Single` becomes `trigger:`,
 * `Multiple` becomes a `triggers:` list in the order given, and `Regex` becomes
 * `regex:`. A `Multiple` list holds **at least one** alias — the tuple type says
 * so here, and Rust refuses an empty array while reading the command's
 * arguments — because a `triggers: []` snippet cannot fire.
 */
export type NewTrigger =
  | { readonly Single: string }
  | { readonly Multiple: readonly [string, ...string[]] }
  | { readonly Regex: string };

/**
 * What a new snippet expands to: exactly one of espanso's five content keys.
 *
 * Mirrors Rust's `NewContent` (Phase 3-4). The tag names the key — `Replace`
 * is `replace:`, `ImagePath` is `image_path:` — and the value is logical text.
 * `Form` is the shorthand form's layout text only; creation writes no
 * `form_fields`.
 */
export type NewContent =
  | { readonly Replace: string }
  | { readonly Markdown: string }
  | { readonly Html: string }
  | { readonly ImagePath: string }
  | { readonly Form: string };

/**
 * What a snippet that does not exist yet is born holding.
 *
 * **Closed: one trigger alternative, one content alternative, and twelve
 * optional schema-known fields** (Phase 3-4; Phase 2c-4c-1 had widened it from
 * two keys to six). It is not a {@link MatchDraft}: a draft can express `vars`
 * and `form_fields`, and creation writes exactly one flat mapping of scalars and
 * scalar lists, so accepting a draft would advertise a structure `createMatch`
 * cannot produce and the caller would learn that from a refusal rather than from
 * the type. It is not a list of key/value pairs either — the keys a save writes
 * are fixed by espanso's schema, never composed by a caller. Rust reads it with
 * `deny_unknown_fields`, so a property this interface does not declare is
 * refused rather than dropped.
 *
 * **The trigger and the content are required**, on the ground that a trigger
 * with no body is not a usable espanso snippet and this application should not
 * create one. A later save can still change either, and can add another
 * schema-known field beside them.
 *
 * **An omitted optional field is a key the new snippet is not born holding at
 * all; an empty string is that key written with an empty value** (and an empty
 * `search_terms` array is `search_terms: []`). The two are different requests,
 * and this type carries the caller's decision rather than inferring it from a
 * blank control — the distinction `MatchBaseline` and `MatchBuffers` exist to
 * keep apart when *editing* a snippet.
 *
 * The options are **text, not booleans**, for the reason their controls are:
 * deciding that `word: on` means boolean true is a claim about how espanso reads
 * a plain scalar, and D2u forbids this application making one.
 *
 * Every value is **logical text**, not YAML. How each is spelled — plain,
 * quoted, or a `|` block — is Rust's decision, made by the same encoder every
 * other value this application writes goes through, so a value holding a `#`, a
 * line break or a leading `*` is written correctly rather than injected.
 */
export interface NewMatch {
  /** Which trigger key the new snippet is born with, and its value. */
  readonly trigger: NewTrigger;
  /** Which content key the new snippet is born with, and its value. */
  readonly content: NewContent;
  /** `label`, when the new snippet is born holding one. */
  readonly label?: string | null;
  /** `comment`, when the new snippet is born holding one. */
  readonly comment?: string | null;
  /** `search_terms`, in order, when the new snippet is born holding the list. */
  readonly search_terms?: readonly string[] | null;
  /** `word`, as source text. */
  readonly word?: string | null;
  /** `left_word`, as source text. */
  readonly left_word?: string | null;
  /** `right_word`, as source text. */
  readonly right_word?: string | null;
  /** `propagate_case`, as source text. */
  readonly propagate_case?: string | null;
  /** `uppercase_style`, as source text. */
  readonly uppercase_style?: string | null;
  /** `force_mode`, as source text. */
  readonly force_mode?: string | null;
  /** `force_clipboard`, as source text. */
  readonly force_clipboard?: string | null;
  /** `paragraph`, as source text. */
  readonly paragraph?: string | null;
  /** `anchor`, as source text — the espanso key, not YAML `&anchor` syntax. */
  readonly anchor?: string | null;
}

/**
 * Where a newly created snippet goes in its file's list.
 *
 * **Three places, spelled as three values.** A two-valued `anchor | null` would
 * have to make one of *top*, *after this one* and *bottom* unreachable, and
 * `moveMatch`'s `null` already means the top — so one encoding would have meant
 * two different destinations depending on which command read it.
 *
 * An anchor is an **identity**, never a position, for the reason every address on
 * this wire is: a position re-points itself the moment anything above it is
 * deleted. Rust turns the identity into an index against the parse `baseRevision`
 * names, and refuses if that parse is not the one this window holds.
 *
 * Every arm is an **object**, including the two that carry nothing —
 * `{ Front: {} }` and `{ End: {} }`, never the bare strings a Rust unit variant
 * would have produced. That uniformity is deliberate and is asserted on the Rust
 * side: one shape per wire enum is what lets a value be recognised without a
 * special case per variant. It is a protocol tag rather than a code, and is named
 * on `NOT_A_CODE` in `src-tauri/src/dictionary_contract.rs` with that reason.
 */
export type NewMatchPosition =
  | { readonly Front: Record<string, never> }
  | { readonly After: { readonly anchor: MatchId } }
  | { readonly End: Record<string, never> };

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
  | { readonly NewParam: { readonly variable: number; readonly insertion: number } }
  | { readonly NewVariable: { readonly insertion: number } }
  | { readonly NewVariableParam: { readonly insertion: number; readonly param: number } }
  | {
      readonly VariableListItem: {
        readonly variable: number;
        readonly list: VariableList;
        readonly item: number;
      };
    }
  | {
      readonly ChoiceRecordField: {
        readonly variable: number;
        readonly record: number;
        readonly field: ChoiceRecordField;
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
    }
  | { readonly VariableFormField: { readonly variable: number; readonly field: number } }
  | {
      readonly VariableFormFieldOption: {
        readonly variable: number;
        readonly field: number;
        readonly option: number;
      };
    }
  | {
      readonly VariableFormFieldOptionItem: {
        readonly variable: number;
        readonly field: number;
        readonly option: number;
        readonly item: number;
      };
    }
  | { readonly NewFormField: { readonly form: FormOwner; readonly field: number } }
  | {
      readonly NewFormFieldOption: {
        readonly form: FormOwner;
        readonly field: number;
        readonly option: number;
      };
    }
  | {
      readonly NewFormOption: {
        readonly form: FormOwner;
        readonly field: number;
        readonly option: number;
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
  | 'AmbiguousNestedKey'
  | 'SubstitutionSourceAbsent'
  | 'SubstitutionTargetPresent'
  | 'SubstitutionConflictsWithField'
  | 'SequenceIntentsConflict'
  | 'SequenceFieldAbsent'
  | 'SequenceFieldPresent'
  | 'SequenceHasAnUnsupportedShape'
  | 'SequenceIsAFlowList'
  | 'SequenceWouldBeEmpty'
  | 'SwitchWouldDiscardItems'
  | 'NoSequenceInsertionAnchor'
  | 'OptionNotPlainSource'
  | 'NewKeyIsEmpty'
  | 'NewKeyHasALineBreak'
  | 'NewKeyHasAControlCharacter'
  | 'NewKeyIsAMergeKey'
  | 'NewKeyDuplicatesAnEntry'
  | 'NewKeyDuplicatesAnInsertion'
  | 'NewKeyCannotBeCompared'
  | 'ParamsAbsent'
  | 'ParamsIsAFlowMapping'
  | 'ParamsHasAnUnsupportedShape'
  | 'ParamsWouldBeEmpty'
  | 'NoParamInsertionAnchor'
  | 'NewKeyIsATypedSetting'
  | 'InsertionKeyAlreadyPresent'
  | 'VarsIntentsConflict'
  | 'VarsIsAFlowList'
  | 'VarsHasAnUnsupportedShape'
  | 'VarsWouldBeEmpty'
  | 'NoVarsInsertionAnchor'
  | 'NewVariableNameIsEmpty'
  | 'NewVariableNameIsNotOneLine'
  | 'NewVariableNameDuplicatesAVariable'
  | 'NewVariableNameDuplicatesAnInsertion'
  | 'NewVariableNameCannotBeCompared'
  | 'NewVariableSettingNotPlainSource'
  | 'NewVariableHasTooManyParams'
  | 'NewKeyIsAKindParameter'
  | 'InsertionLandsOnARemoval'
  | 'VariableMoveChangesNothing'
  | 'VariableListIntentsConflict'
  | 'VariableListAbsent'
  | 'VariableListHasAnUnsupportedShape'
  | 'VariableListIsAFlowList'
  | 'VariableListIsNotOfItsKind'
  | 'VariableListWouldBeEmpty'
  | 'VariableListItemShapeMismatch'
  | 'NotAChoiceRecord'
  | 'ChoiceRecordFieldHasNoScalar'
  | 'FormIntentsConflict'
  | 'VariableIsNotAForm'
  | 'FormFieldsIsAFlowMapping'
  | 'FormFieldsHasAnUnsupportedShape'
  | 'FormFieldsWouldBeEmpty'
  | 'NoFormFieldInsertionAnchor'
  | 'FormFieldOptionsAreNotABlockMapping'
  | 'FormFieldWouldHaveNoOptions'
  | 'NoFormOptionInsertionAnchor'
  | 'NewFormOptionNotPlainSource'
  | 'NewKeyIsAFormOption'
  | 'NewFormFieldHasTooManyOptions'
  | 'FormValuesAbsent'
  | 'FormValuesIsNotAList'
  | 'FormValuesWouldBeEmpty'
  | 'FormValuesIntentsConflict';

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
  | { readonly AmbiguousNestedKey: { readonly edit: number } }
  | { readonly SubstitutionSourceAbsent: { readonly field: MatchField } }
  | { readonly SubstitutionTargetPresent: { readonly field: MatchField } }
  | { readonly SubstitutionConflictsWithField: { readonly field: MatchField } }
  | { readonly SequenceIntentsConflict: { readonly field: SequenceField } }
  | { readonly SequenceFieldAbsent: { readonly field: SequenceField } }
  | { readonly SequenceFieldPresent: { readonly field: SequenceField } }
  | {
      readonly SequenceHasAnUnsupportedShape: {
        readonly field: SequenceField;
        readonly found: ValueKind;
      };
    }
  | { readonly SequenceIsAFlowList: { readonly field: SequenceField } }
  | { readonly SequenceWouldBeEmpty: { readonly field: SequenceField } }
  | { readonly SwitchWouldDiscardItems: { readonly field: SequenceField; readonly items: number } }
  | { readonly NoSequenceInsertionAnchor: { readonly field: SequenceField } }
  /**
   * Phase 4-1: the text drafted for one of the eight plain-source options
   * cannot be written verbatim as one plain scalar, so it is refused rather than
   * quoted — by `save_match`'s planner and by `create_match`, before any
   * transaction. `field` is always one of those eight; the text is not carried.
   */
  | { readonly OptionNotPlainSource: { readonly field: MatchField } }
  | { readonly NewKeyIsEmpty: { readonly target: DraftTarget } }
  | { readonly NewKeyHasALineBreak: { readonly target: DraftTarget } }
  | { readonly NewKeyHasAControlCharacter: { readonly target: DraftTarget } }
  | { readonly NewKeyIsAMergeKey: { readonly target: DraftTarget } }
  | { readonly NewKeyDuplicatesAnEntry: { readonly target: DraftTarget; readonly entry: number } }
  | {
      readonly NewKeyDuplicatesAnInsertion: { readonly target: DraftTarget; readonly first: number };
    }
  | { readonly NewKeyCannotBeCompared: { readonly target: DraftTarget; readonly entry: number } }
  | { readonly ParamsAbsent: { readonly variable: number } }
  | { readonly ParamsIsAFlowMapping: { readonly variable: number } }
  | {
      readonly ParamsHasAnUnsupportedShape: { readonly variable: number; readonly found: ValueKind };
    }
  | { readonly ParamsWouldBeEmpty: { readonly variable: number } }
  | { readonly NoParamInsertionAnchor: { readonly variable: number } }
  | { readonly NewKeyIsATypedSetting: { readonly target: DraftTarget } }
  | { readonly InsertionKeyAlreadyPresent: { readonly edit: number } }
  | { readonly VarsIntentsConflict: { readonly intent: number } }
  | { readonly VarsIsAFlowList: Record<string, never> }
  | { readonly VarsHasAnUnsupportedShape: { readonly found: ValueKind } }
  | { readonly VarsWouldBeEmpty: Record<string, never> }
  | { readonly NoVarsInsertionAnchor: Record<string, never> }
  | { readonly NewVariableNameIsEmpty: { readonly target: DraftTarget } }
  | { readonly NewVariableNameIsNotOneLine: { readonly target: DraftTarget } }
  | {
      readonly NewVariableNameDuplicatesAVariable: {
        readonly target: DraftTarget;
        readonly variable: number;
      };
    }
  | {
      readonly NewVariableNameDuplicatesAnInsertion: {
        readonly target: DraftTarget;
        readonly first: number;
      };
    }
  | {
      readonly NewVariableNameCannotBeCompared: {
        readonly target: DraftTarget;
        readonly variable: number;
      };
    }
  | {
      readonly NewVariableSettingNotPlainSource: {
        readonly target: DraftTarget;
        readonly setting: VariableSetting;
      };
    }
  | {
      readonly NewVariableHasTooManyParams: { readonly target: DraftTarget; readonly limit: number };
    }
  | { readonly NewKeyIsAKindParameter: { readonly target: DraftTarget } }
  | {
      readonly InsertionLandsOnARemoval: { readonly insertion: number; readonly removal: number };
    }
  | { readonly VariableMoveChangesNothing: { readonly variable: number } }
  | {
      readonly VariableListIntentsConflict: {
        readonly variable: number;
        readonly list: VariableList;
      };
    }
  | { readonly VariableListAbsent: { readonly variable: number; readonly list: VariableList } }
  | {
      readonly VariableListHasAnUnsupportedShape: {
        readonly variable: number;
        readonly list: VariableList;
        readonly found: ValueKind;
      };
    }
  | {
      readonly VariableListIsAFlowList: { readonly variable: number; readonly list: VariableList };
    }
  | {
      readonly VariableListIsNotOfItsKind: {
        readonly variable: number;
        readonly list: VariableList;
      };
    }
  | {
      readonly VariableListWouldBeEmpty: { readonly variable: number; readonly list: VariableList };
    }
  | {
      readonly VariableListItemShapeMismatch: {
        readonly variable: number;
        readonly list: VariableList;
      };
    }
  | { readonly NotAChoiceRecord: { readonly target: DraftTarget; readonly found: ValueKind } }
  | { readonly ChoiceRecordFieldHasNoScalar: { readonly target: DraftTarget } }
  | { readonly FormIntentsConflict: { readonly form: FormOwner; readonly intent: number } }
  | { readonly VariableIsNotAForm: { readonly variable: number } }
  | { readonly FormFieldsIsAFlowMapping: { readonly form: FormOwner } }
  | {
      readonly FormFieldsHasAnUnsupportedShape: {
        readonly form: FormOwner;
        readonly found: ValueKind;
      };
    }
  | { readonly FormFieldsWouldBeEmpty: { readonly form: FormOwner } }
  | { readonly NoFormFieldInsertionAnchor: { readonly form: FormOwner } }
  | {
      readonly FormFieldOptionsAreNotABlockMapping: {
        readonly target: DraftTarget;
        readonly found: ValueKind;
      };
    }
  | { readonly FormFieldWouldHaveNoOptions: { readonly target: DraftTarget } }
  | { readonly NoFormOptionInsertionAnchor: { readonly target: DraftTarget } }
  | {
      readonly NewFormOptionNotPlainSource: {
        readonly target: DraftTarget;
        readonly setting: VariableSetting;
      };
    }
  | { readonly NewKeyIsAFormOption: { readonly target: DraftTarget } }
  | {
      readonly NewFormFieldHasTooManyOptions: {
        readonly target: DraftTarget;
        readonly limit: number;
      };
    }
  | { readonly FormValuesAbsent: { readonly target: DraftTarget } }
  | { readonly FormValuesIsNotAList: { readonly target: DraftTarget; readonly found: ValueKind } }
  | { readonly FormValuesWouldBeEmpty: { readonly target: DraftTarget } }
  | { readonly FormValuesIntentsConflict: { readonly target: DraftTarget } };

// ---------------------------------------------------------------------------
// The external-change reconciliation wire — Phase 2d-4b
// ---------------------------------------------------------------------------

/**
 * The mirror of everything `src-tauri/src/reconciliation.rs` puts on the wire.
 *
 * **Two halves, and only one of them is authoritative.**
 * {@link ReconciliationWake} is the payload of the
 * `workspace://reconciliation-ready` event and is a *hint*: it carries an epoch
 * and a sequence, nothing is installed from it, and a listener that attached
 * late has missed nothing. {@link ReconciliationBatch} is what
 * `drain_external_changes` answers, and that value — never the wake — is what a
 * caller acts on.
 *
 * ## Every enum here is a uniform one-key object
 *
 * Rust declares every arm of all five as a **struct** variant, empty payloads
 * included, so `serde` writes `{"PermissionDenied":{}}` and never the bare
 * string a unit variant would produce. That is D5's rule, and it is what lets a
 * value be recognised without a special case per variant. `Record<string, never>`
 * is the spelling of an empty payload here, exactly as it is for
 * {@link ReapplyResolution}: `{}` in TypeScript means *any non-nullish value*,
 * which is not the same claim.
 *
 * ## Two limits, stated beside what is enforced
 *
 * 1. **`src-tauri/src/wire_contract.rs` checks property and variant *names*, in
 *    both directions, and does not check TypeScript property *type text***. It
 *    fails when Rust renames or adds a field these declarations do not follow;
 *    it would still pass if `sequence` below were declared `string`, exactly as
 *    that module's own header says of `byte_len`.
 * 2. **Every `u64` on this wire crosses as a JavaScript `number`**, so an epoch
 *    and a sequence are exact only within the safe-integer range
 *    (`Number.MAX_SAFE_INTEGER`, `2^53 - 1`). There is no mathematically exact
 *    `u64` mirror here, and none of these numbers is bounded by the size of
 *    something already in memory the way {@link DocumentView.byte_len} is — what
 *    bounds them is the process's own allocation rate, which no type expresses.
 */

/**
 * The payload of `workspace://reconciliation-ready` — a hint, and the whole of
 * it.
 *
 * **Not a `CommandResult`**, because it reports no requested operation. It
 * carries no observation and no document: everything a caller acts on comes back
 * from the drain, and the only thing this value is good for is deciding to call
 * it.
 */
export interface ReconciliationWake {
  /**
   * The workspace epoch the enqueued observation was produced under.
   *
   * What makes a wake from a replaced workspace visibly stale. Comparing it is
   * the consumer's rule and is Phase 2d-5's; nothing in this module compares it.
   */
  readonly workspace_epoch: number;
  /**
   * The highest sequence the queue held undrained at that moment.
   *
   * **Not a count and not a promise of a batch size.** A later drain may return
   * more than this or fewer; it describes one moment and promises nothing over
   * time.
   */
  readonly newest_sequence: number;
}

/** The variant name of every {@link ObservedDocument} arm. */
export type ObservedDocumentName = 'Addressable' | 'Named' | 'Unnamed';

/**
 * Which document an observation is about — and whether the **open** workspace
 * resolves it.
 *
 * Three arms, because there are three different things this application can
 * truthfully say about a watched path, and every arm carries the display path so
 * no consumer is handed a number as its only handle on a file. `Addressable`
 * says the open workspace resolves the path to that identity, so the number is
 * an address every workspace command accepts today. `Named` says this process
 * minted that identity and the open workspace does **not** hold it, so
 * `document_context` refuses the number. `Unnamed` says no identity for the path
 * has ever been minted anywhere, so the consumer holds nothing under one.
 *
 * ## No identity accessor exists here, deliberately
 *
 * There is no `documentId(document)`, no common-payload projection and no
 * brand — the design consult for this phase rules all three out. An accessor
 * answering *the identity, where there is one* would let a consumer treat
 * `Addressable` and `Named` as one answer with a `?`, and the difference between
 * them is this value's whole subject.
 *
 * **What TypeScript forces, and what it does not, in one sentence each.** It
 * forces narrowing: `document.document` does not compile until the union has
 * been discriminated, and an exhaustive `switch` with a `never` terminus makes a
 * fourth arm added in Rust a compile error at every consumer written that way.
 * It does **not** force `Addressable` and `Named` to be treated differently
 * *after* narrowing — a consumer may deliberately route both branches into one
 * function, and neither the union nor the `never` terminus prevents that
 * collapse. Only Phase 2d-5's model logic and its tests establish that just
 * `Addressable`'s identity reaches an open-workspace command.
 *
 * A brand would not help and would make things worse: both numbered arms carry
 * the same serialized {@link DocumentId}, nothing decodes these values at
 * runtime, and a frontend-only brand would turn a guarantee nothing establishes
 * into a type assertion that looks like one.
 */
export type ObservedDocument =
  | {
      readonly Addressable: {
        /** The identity, as the **open** workspace resolves this path. */
        readonly document: DocumentId;
        /** The path, for display. Lossy — see {@link DocumentView.path}. */
        readonly relative_path: string;
      };
    }
  | {
      readonly Named: {
        /** The identity this process minted, which the open workspace refuses. */
        readonly document: DocumentId;
        /** The path, for display. Lossy — see {@link DocumentView.path}. */
        readonly relative_path: string;
      };
    }
  | {
      readonly Unnamed: {
        /** The path, for display. Lossy — see {@link DocumentView.path}. */
        readonly relative_path: string;
      };
    };

/** The variant name of every {@link UnreadableReason} arm. */
export type UnreadableReasonName =
  | 'NotUtf8'
  | 'PermissionDenied'
  | 'InvalidData'
  | 'TimedOut'
  | 'Interrupted'
  | 'Other';

/**
 * Why this application cannot show a file's text.
 *
 * One type across **three** wire positions, and the whole type at each of them:
 * {@link ExternalObservation}'s `Unreadable` arm, {@link ChangedContent}'s and
 * {@link AddedContent}'s. Only `NotUtf8` reaches the second and third today and
 * only the io arms reach the first; narrowing any of the three fields would be
 * the frontend deciding which failures the engine may report through which
 * observation.
 *
 * The io arms are a **closed** set over an open one — `std::io::ErrorKind` is
 * `#[non_exhaustive]` — so everything the list does not name arrives as `Other`,
 * which carries no operand on purpose: the kind's own spelling is untranslated
 * developer prose and this wire carries no prose.
 */
export type UnreadableReason =
  | {
      readonly NotUtf8: {
        /** Byte offset of the first invalid sequence in the bytes on disk. */
        readonly offset: number;
      };
    }
  | { readonly PermissionDenied: Record<string, never> }
  | { readonly InvalidData: Record<string, never> }
  | { readonly TimedOut: Record<string, never> }
  | { readonly Interrupted: Record<string, never> }
  | { readonly Other: Record<string, never> };

/**
 * Where one base-snapshot match sits in the stabilized snapshot, at both
 * confidence policies.
 *
 * `exact` is the only tier a destructive operation may act on, and it is also
 * the tier a positional placement resolves at. `editor` is the match editor's
 * flexible tier: where it answered below the exact one it is provisional
 * correspondence, not proof the original item remains.
 */
export interface CorrespondenceEntry {
  /**
   * The match this row is about, as the **base** snapshot minted it.
   *
   * Stale by construction — after the change this identity resolves to nothing —
   * which is exactly what lets an open surface holding it find its row.
   */
  readonly base: MatchId;
  /** The exact-item answer. */
  readonly exact: ReapplyResolution;
  /** The match editor's answer. */
  readonly editor: ReapplyResolution;
}

/**
 * Every base-snapshot match's correspondence into one stabilized snapshot.
 *
 * **Snapshot-bound, and it says which two snapshots.** A consumer holding an
 * observation with a different disk revision must treat this table as evidence
 * about a state it was not shown. Nothing in TypeScript pairs a table with the
 * observation it was built for; what that rests on is that one Rust function
 * builds both.
 */
export interface CorrespondenceTable {
  /** The revision the rows' identities were minted from. */
  readonly base_revision: ContentRevision;
  /** The revision every answer was resolved against. */
  readonly disk_revision: ContentRevision;
  /**
   * One row per match of the base snapshot, in the base projection's own order.
   *
   * Empty when the base snapshot projected no matches — a failed parse included,
   * because a projection that failed carries nothing to find again.
   */
  readonly entries: readonly CorrespondenceEntry[];
}

/** The variant name of every {@link AddedContent} arm. */
export type AddedContentName = 'Projected' | 'Unreadable';

/**
 * What one addition's stabilized bytes projected to, or why they did not.
 *
 * A discriminated value rather than an optional field: an absence carries no
 * reason, and the reason is the sentence a person reads. It also keeps the two
 * operand sets apart — a projection always comes with its findings, and an
 * unreadable state never has any.
 *
 * **Neither arm carries the stabilized bytes.** An addition this application
 * cannot read as text is one it will not show as text, exactly as
 * `documentText` refuses rather than decoding lossily.
 */
export type AddedContent =
  | {
      readonly Projected: {
        /** The projection of the stabilized bytes. */
        readonly disk: DocumentView;
        /** The pure semantic report over that projection. */
        readonly findings: readonly Finding[];
      };
    }
  | {
      readonly Unreadable: {
        /** Why the text is not available. */
        readonly reason: UnreadableReason;
      };
    };

/** The variant name of every {@link ChangedContent} arm. */
export type ChangedContentName = 'Projected' | 'Unreadable';

/**
 * What one change's stabilized bytes projected to, or why they did not.
 *
 * {@link AddedContent}'s twin and deliberately the same shape. Routing a
 * non-UTF-8 change to {@link ExternalObservation}'s `Unreadable` arm instead
 * would discard both revisions a change carries, since that arm holds neither —
 * so the two operands a consumer needs would be destroyed by the routing rather
 * than by anything about the bytes.
 *
 * **The unreadable arm carries no bytes.** What it does carry is on the
 * observation above it: a hash of bytes is not a rendering of them.
 */
export type ChangedContent =
  | {
      readonly Projected: {
        /** Those exact bytes, unchanged. The comparison side of a conflict. */
        readonly disk_text: string;
        /**
         * The projection of those same bytes.
         *
         * Paired with `disk_text` by construction, since both come out of one
         * snapshot — a fact about the Rust that builds them, which no type here
         * expresses.
         */
        readonly disk: DocumentView;
        /** The pure semantic report over that projection. */
        readonly findings: readonly Finding[];
        /**
         * Correspondence evidence from the previously projected content into
         * this one, or `null` where either side had no projection.
         *
         * **No reapply anchor crosses**: the anchor is the question, is captured
         * and dropped inside the core, and a table holds answers only.
         */
        readonly correspondences: CorrespondenceTable | null;
      };
    }
  | {
      readonly Unreadable: {
        /** Why the text is not available. */
        readonly reason: UnreadableReason;
      };
    };

/** The variant name of every {@link ExternalObservation} arm. */
export type ExternalObservationName = 'Changed' | 'Added' | 'Removed' | 'Unreadable';

/**
 * One external change, as the frontend meets it.
 *
 * A discriminated value, never rendered prose and never a raw watcher event.
 * **Every variant carries the sequence it was admitted under**, because *which
 * of these is newest for this document* is the consumer's whole arbitration rule
 * and it may not be recovered from a hash.
 *
 * `Changed` and `Added` answer a present-but-not-UTF-8 state with a
 * discriminated content field rather than by changing arm, so both revisions of
 * a change and the sidebar row of an addition survive. What remains on
 * `Unreadable` is the one engine state that is not content: a path whose *read*
 * stably fails, which has no bytes, no revision and no projection anything could
 * have made.
 */
export type ExternalObservation =
  | {
      readonly Changed: {
        /** The sequence this observation was admitted under. */
        readonly sequence: number;
        /** Which document, and whether the open workspace resolves it. */
        readonly document: ObservedDocument;
        /**
         * The last stable revision the engine held, or `null` when it had none.
         *
         * **Not a claim that the caller ever saw that revision**, and not an
         * order: it is what the engine tracked before this reading.
         */
        readonly previous_revision: ContentRevision | null;
        /** The revision of the exact bytes now on disk, text or not. */
        readonly disk_revision: ContentRevision;
        /** The projection of those same bytes, or why there is none. */
        readonly content: ChangedContent;
      };
    }
  | {
      readonly Added: {
        /** The sequence this observation was admitted under. */
        readonly sequence: number;
        /**
         * The row a sidebar draws, built from the discovered file and the
         * identity for its path.
         *
         * **An identity, not an address the open workspace resolves**: an
         * addition is by definition a file that workspace does not hold. Its
         * `loaded` is `false`, and truthfully.
         */
        readonly document_summary: DocumentSummary;
        /** The projection of the stabilized bytes, or why there is none. */
        readonly content: AddedContent;
      };
    }
  | {
      readonly Removed: {
        /** The sequence this observation was admitted under. */
        readonly sequence: number;
        /** Which document, and whether the open workspace resolves it. */
        readonly document: ObservedDocument;
        /** The last stable revision the engine held, or `null` when it had none. */
        readonly previous_revision: ContentRevision | null;
      };
    }
  | {
      readonly Unreadable: {
        /** The sequence this observation was admitted under. */
        readonly sequence: number;
        /** Which document, and whether the open workspace resolves it. */
        readonly document: ObservedDocument;
        /** Why the text is not available. */
        readonly reason: UnreadableReason;
      };
    };

/**
 * What `drainExternalChanges` hands back — the authoritative half of the
 * protocol.
 *
 * **A caller compares {@link ReconciliationBatch.epoch} against the workspace it
 * is showing, and a mismatch makes the whole batch stale and installs nothing.**
 * That comparison, the watermark it advances and what it does about `discarded`
 * are all Phase 2d-5's; nothing in Phase 2d-4b arbitrates or retains any of it.
 */
export interface ReconciliationBatch {
  /**
   * The workspace epoch this queue is holding observations for.
   *
   * Zero — never a real epoch — when the session has adopted none, which means
   * the open found the epoch space exhausted and started a lifecycle with no
   * worker. Such a workspace is watched by nothing and its batch is always
   * empty.
   */
  readonly epoch: number;
  /**
   * The highest sequence in {@link ReconciliationBatch.observations}, or — when
   * the batch is empty — the highest watermark this epoch's queue has been
   * drained with, which is **not** necessarily the `afterSequence` of this call.
   *
   * **Scoped to one epoch: within the epoch {@link ReconciliationBatch.epoch}
   * names, this never falls**, so a caller showing that epoch may store it
   * unconditionally. Across a replacement epoch it does fall, and that is not a
   * walk-back — a batch whose epoch a caller is not showing installs nothing at
   * all, whatever it holds.
   */
  readonly newest_sequence: number;
  /** The observations above the caller's watermark, ordered by sequence. */
  readonly observations: readonly ExternalObservation[];
  /**
   * How many admitted observations this epoch's queue dropped rather than held.
   *
   * **Cumulative within the epoch and monotonic**, so a non-zero value does not
   * say the loss happened since the previous drain. What it does say is that
   * this epoch's observation history has a hole in it, so a consumer must reload
   * the workspace rather than reconcile from these values. Zero on every
   * ordinary run.
   */
  readonly discarded: number;
}

// ---------------------------------------------------------------------------
// Authoring snapshots and candidate analysis — Phase 4-8
// ---------------------------------------------------------------------------

/**
 * What one whole container of a snippet held — `vars` or `form_fields` —
 * mirroring Rust's `ContainerBaseline` (Phase 4-8, ruling 22's correspondence
 * unit).
 *
 * `Present.text` is the value's exact source text, **cut in Rust**: from its
 * first byte to its last, as the projection's value span names them. It may
 * hold a carriage return, so it must never be put into a text box (a textarea
 * normalizes line breaks). `fingerprint` is the hash of exactly that text, in
 * a content revision's encoding; opaque, never rendered, and never sent back —
 * no command accepts a snapshot, a span or a fingerprint (R28). `Uncut` is a
 * broken projection invariant reported rather than hidden: it corresponds to
 * nothing.
 */
export type ContainerBaseline =
  | { readonly Absent: Record<string, never> }
  | {
      readonly Present: {
        /** The container value's exact source text. */
        readonly text: string;
        /** The hash of `text`. Opaque. */
        readonly fingerprint: ContentRevision;
      };
    }
  | { readonly Uncut: Record<string, never> };

/** Whether a variable's parameters take `{{references}}` — Rust's `Injection`. */
export type Injection = 'Enabled' | 'Disabled' | 'Uncertain';

/** How a dependency edge was learnt — Rust's `EdgeKind`. */
export type EdgeKind = 'Explicit' | 'Inferred';

/**
 * Why a region that opens with `[[` is not a supported placeholder — Rust's
 * `MalformedPlaceholder`. The supported subset is named, never
 * espanso-compatible (Phase 4 ruling 16).
 */
export type MalformedPlaceholder = 'Empty' | 'InvalidIdentifier' | 'Unterminated';

/**
 * Which form a sub-reference or an analysis reason is about — Rust's
 * `FormSource`. An address by position, never by name.
 */
export type FormSource =
  | { readonly Variable: { readonly index: number } }
  | { readonly Shorthand: Record<string, never> };

/** The variant names of {@link IncompleteReason}. */
export type IncompleteReasonName =
  | 'ImportsOpenScope'
  | 'GlobalVarsUnreadable'
  | 'LocalVarsUnreadable'
  | 'RegexCapturesUnknown'
  | 'DuplicateDeclaration'
  | 'NameUnreadable'
  | 'LocalNameUnreadable'
  | 'GlobalNameUnreadable'
  | 'DependsOnUnreadable'
  | 'ParamsUnreadable'
  | 'InjectionUncertain'
  | 'LayoutUnavailable'
  | 'LayoutUnsupported';

/**
 * Why part of an analysis is not definitive — Rust's `IncompleteReason`.
 * Positions, never file text.
 */
export type IncompleteReason =
  | { readonly ImportsOpenScope: Record<string, never> }
  | { readonly GlobalVarsUnreadable: Record<string, never> }
  | { readonly LocalVarsUnreadable: Record<string, never> }
  | { readonly RegexCapturesUnknown: Record<string, never> }
  | { readonly DuplicateDeclaration: { readonly declarations: readonly number[] } }
  | { readonly NameUnreadable: { readonly declaration: number } }
  | { readonly LocalNameUnreadable: { readonly declaration: number } }
  | { readonly GlobalNameUnreadable: { readonly declaration: number } }
  | { readonly DependsOnUnreadable: { readonly declaration: number } }
  | { readonly ParamsUnreadable: { readonly declaration: number } }
  | { readonly InjectionUncertain: { readonly declaration: number } }
  | { readonly LayoutUnavailable: { readonly form: FormSource } }
  | { readonly LayoutUnsupported: { readonly form: FormSource } };

/** How often a declaration is referenced, by where — Rust's `Usage`. */
export interface Usage {
  /** References in `replace`, `markdown` or `html`. */
  readonly body: number;
  /** References in parameter values whose injection is enabled. */
  readonly parameters: number;
  /** `depends_on` entries naming it. */
  readonly depends_on: number;
  /** `{{…}}` occurrences in a shorthand layout — unverified. */
  readonly unverified_layout: number;
}

/** One piece of a parsed layout — Rust's `LayoutPiece`, cut in Rust. */
export type LayoutPiece =
  | { readonly Text: { readonly text: string } }
  | { readonly Placeholder: { readonly name: string } }
  | { readonly Malformed: { readonly text: string; readonly reason: MalformedPlaceholder } }
  | { readonly Uncut: Record<string, never> };

/** A form layout in the named supported placeholder subset — `LayoutSummary`. */
export interface LayoutSummary {
  /** The pieces in text order; together they reproduce the layout exactly. */
  readonly pieces: readonly LayoutPiece[];
  /** Whether no malformed region exists. */
  readonly fully_supported: boolean;
  /** Definition keys with no supported placeholder of their name. Advisory. */
  readonly definitions_without_occurrence: readonly string[];
}

/** One local declaration — Rust's `DeclarationSummary`. */
export interface DeclarationSummary {
  /** Its position in `vars`. */
  readonly index: number;
  /** Its `name` text, when this app could read one. File text, not prose. */
  readonly name: string | null;
  /** Its type. */
  readonly kind: VariableKind;
  /** Whether its parameters take references. */
  readonly injection: Injection;
  /** How often it is referenced. */
  readonly usage: Usage;
  /** Its layout, for a `type: form` whose layout is a scalar. */
  readonly layout: LayoutSummary | null;
}

/** A consumer depending on a declaration of the same `vars` — `EdgeSummary`. */
export interface EdgeSummary {
  /** The consumer's position. */
  readonly consumer: number;
  /** The dependency's position. */
  readonly dependency: number;
  /** How the edge was learnt. */
  readonly kind: EdgeKind;
}

/** Declarations that depend on each other — Rust's `DependencyCycle`. */
export interface DependencyCycle {
  /** The positions, ascending. One member is a self-dependency. */
  readonly members: readonly number[];
  /** Whether an explicit edge lies inside the cycle. */
  readonly explicit: boolean;
  /** Whether an inferred edge lies inside the cycle. */
  readonly inferred: boolean;
}

/** A `depends_on` entry naming nothing visible, by position only. */
export interface MissingDependencySummary {
  /** The consumer's position in `vars`. */
  readonly consumer: number;
  /** The entry's position in its `depends_on`. */
  readonly entry: number;
}

/**
 * A consumer authored before a dependency — Rust's `OrderAdvisory`. Advisory:
 * authored order is never re-sorted, and file order is not claimed to be
 * espanso's execution order (Phase 4 ruling 11).
 */
export interface OrderAdvisory {
  /** The consumer's position. */
  readonly consumer: number;
  /** The later dependency's position. */
  readonly dependency: number;
}

/** A `{{form.field}}` whose field is not found in the supported layout syntax. */
export interface FormAdvisorySummary {
  /** The form the name resolved to. */
  readonly form: FormSource;
  /** The field name after the dot, as the reference writes it. */
  readonly field: string;
}

/** One `{{reference}}` of a shorthand layout — unverified. */
export interface ReferenceSummary {
  /** The referenced name. */
  readonly name: string;
  /** The `.subname` after it, when present. */
  readonly subname: string | null;
}

/**
 * A snippet's placeholder, reference and dependency analysis, span-free —
 * Rust's `AnalysisSummary`. Every text in it was cut in Rust.
 */
export interface AnalysisSummary {
  /** Every local declaration, in authored order. */
  readonly declarations: readonly DeclarationSummary[];
  /** Every edge between two local declarations. */
  readonly edges: readonly EdgeSummary[];
  /** Every cycle, ordered by first member. */
  readonly cycles: readonly DependencyCycle[];
  /** Explicit dependencies naming nothing visible; empty unless the scope is closed. */
  readonly missing_dependencies: readonly MissingDependencySummary[];
  /** Consumers authored before a dependency. */
  readonly order_advisories: readonly OrderAdvisory[];
  /** Form sub-references whose field is not found. */
  readonly form_advisories: readonly FormAdvisorySummary[];
  /** Why parts of the answer are uncertain; empty only for a complete one. */
  readonly incomplete: readonly IncompleteReason[];
  /** Whether the set of visible names is closed. */
  readonly scope_closed: boolean;
  /** The regex trigger's named captures. */
  readonly captures: readonly string[];
  /** The shorthand `form:` layout, when there is one. */
  readonly shorthand_form: LayoutSummary | null;
  /** The shorthand layout's `{{…}}` occurrences — never claimed to resolve. */
  readonly unverified_layout_references: readonly ReferenceSummary[];
}

/**
 * One snippet's revision-bound authoring snapshot — `match_authoring_snapshot`'s
 * answer (Phase 4-8). `id.revision` is the revision every baseline describes.
 */
export interface AuthoringSnapshot {
  /** The snippet, in the revision this snapshot was cut from. */
  readonly id: MatchId;
  /** The whole local `vars` container. */
  readonly vars: ContainerBaseline;
  /** The whole shorthand `form_fields` container. */
  readonly form_fields: ContainerBaseline;
  /** The snippet's analysis. */
  readonly analysis: AnalysisSummary;
}

/**
 * One operation a candidate analysis is asked about — Rust's
 * `CandidateOperation`. Inbound: a whole draft, or a variable position and a
 * placement in the **original** list. Never a byte offset (R28).
 */
export type CandidateOperation =
  | { readonly Draft: { readonly draft: MatchDraft } }
  | { readonly VariableMove: { readonly variable: number; readonly to: ListPlacement } };

/**
 * What one drafted operation would produce, judged and analysed —
 * `analyze_match_candidate`'s answer (Phase 4-8).
 *
 * `findings` are the save gate's own, over exactly the candidate `candidate`
 * names. A refusing `verdict` is an answer, not an error.
 *
 * **What consent built from them is bound to.** An {@link Acknowledgement} is
 * matched by finding equality only. Five codes carry the candidate's revision
 * (`DocumentDoesNotParse`, `DuplicateKeepsTriggerDefinition`,
 * `NewMatchRepeatsLiteralTrigger`, `VariableDependencyCycle`,
 * `DependencyHasNoDeclaration`) and cannot be spent on another candidate; every
 * other finding — `ReferenceHasNoDeclaration` among them — is not bound, and
 * consent for it is accepted by any later candidate producing an equal finding,
 * a different draft included. A caller must discard collected consent whenever
 * the draft changes; neither TypeScript nor Rust forces it to.
 */
export interface MatchCandidate {
  /** The revision the candidate would have. Opaque. */
  readonly candidate: ContentRevision;
  /** Whether a save would commit anything. */
  readonly changes: boolean;
  /** Every finding the save gate produces for the candidate. */
  readonly findings: readonly Finding[];
  /** The gate's answer to those findings and the acknowledgement sent. */
  readonly verdict: SaveVerdict;
  /** The snippet's analysis in the candidate, when the candidate holds it. */
  readonly analysis: AnalysisSummary | null;
}

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
