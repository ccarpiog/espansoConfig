/**
 * Wire-shaped values for the browser's own tests.
 *
 * **Test support, imported by no component.** It lives beside the modules it
 * builds values for rather than in a test file, because five test files need
 * the same twenty-field `MatchView` and a copy in each would drift.
 *
 * ## What these fixtures are, and the one thing they are not
 *
 * They are hand-written JSON of the shape `serde` writes — the same shape
 * `src/lib/ipc/types.ts` declares, which `src-tauri/src/wire_contract.rs`
 * compares against what Rust actually emits. So a field renamed in Rust breaks
 * a `cargo test`, and these objects follow.
 *
 * They are **not** evidence about the core. Two values here are transcriptions
 * of something Rust decides, and neither is a measurement of it:
 *
 * - `search_text` is joined here from the same field groups the core's
 *   `build_search_text` joins — **every** content field among them, which is
 *   what the core does since the 1c-1 review. As of 1c-2a the fixture models
 *   every field of that join (`trigger`, `triggers`, `regex`, `label`, all five
 *   content fields in `ContentSpec::collect_scalars` order, `comment` and
 *   `search_terms`), and still nothing outside it. Rust pins the haystack in
 *   `search_text_covers_the_five_fields_plan_section_eight_names` and
 *   `search_text_covers_every_content_form_and_not_only_the_primary_one`;
 * - `source_text` is a *plausible* YAML rendering of the same fields, not the
 *   real slice of a real file. What it faithfully reproduces is the one
 *   property the selection depends on: it changes whenever a field of the match
 *   changes, **including a field no other part of the view carries**, which is
 *   why an option given in `options` below moves it. Rust pins the real slice in
 *   `every_projected_match_carries_exactly_the_bytes_its_span_names`.
 *
 * Recorded as a hole in `docs/decisions/1c-1-notes.md`.
 */

import type {
  AliasView,
  ConflictResult,
  ContentKind,
  ContentRevision,
  ContentSpec,
  Diagnostic,
  DiagnosticCode,
  DocumentId,
  DocumentPath,
  DocumentSummary,
  DocumentView,
  ElidedValue,
  FieldView,
  FileKind,
  HazardKind,
  MatchBadge,
  MatchOptions,
  MatchView,
  ReapplyPlacement,
  ReapplyResolution,
  ScalarStyle,
  ScalarView,
  TriggerKind,
  TriggerSpec,
  UnknownEntry,
  UnknownReason,
  ValueKind,
  ValueView,
  VariableKind,
  VariableView
} from '../ipc/types';

/**
 * A plain scalar carrying source text.
 *
 * D2u: `text` is what the file says, and nothing here decides what it means.
 *
 * @param text - The source text.
 * @param node - The arena node identifier to claim.
 * @returns A scalar view.
 */
export function scalar(text: string, node = 0): ScalarView {
  return {
    text,
    decoded: true,
    style: 'Plain',
    span: { start: 0, end: text.length },
    node,
    ambiguous_yaml_1_1: false
  };
} // End of function scalar()

/**
 * A scalar written in something other than the plain style, or flagged.
 *
 * The detail pane says two things about a scalar beyond its text — how the file
 * spells it, and whether the two YAML versions read it differently — and neither
 * is reachable through {@link scalar}, which is deliberately the ordinary case.
 *
 * @param text - The source text.
 * @param style - How the file writes it.
 * @param ambiguous - Whether YAML 1.1 and 1.2 core disagree about it.
 * @param node - The arena node identifier to claim.
 * @returns A scalar view.
 */
export function styledScalar(
  text: string,
  style: ScalarStyle,
  ambiguous = false,
  node = 0
): ScalarView {
  return { ...scalar(text, node), style, ambiguous_yaml_1_1: ambiguous };
} // End of function styledScalar()

/**
 * A sequence item holding a scalar.
 *
 * @param text - The item's source text.
 * @returns A projected value.
 */
export function scalarItem(text: string): ValueView {
  return { Scalar: scalar(text) };
} // End of function scalarItem()

/**
 * One entry of a shallowly projected mapping.
 *
 * @param key - The key's source text, or `null` for a key that is not a scalar.
 * @param value - The entry's value.
 * @param keyNode - The key node, which exists whether or not the key is scalar.
 * @returns A field view.
 */
export function field(key: string | null, value: ValueView, keyNode = 0): FieldView {
  return { key: key === null ? null : scalar(key, keyNode), key_node: keyNode, value };
} // End of function field()

/**
 * An alias reference, projected without being followed.
 *
 * @param node - The arena node identifier to claim.
 * @returns A projected value.
 */
export function aliasValue(node = 0): ValueView {
  const alias: AliasView = { span: { start: 0, end: 1 }, node };
  return { Alias: alias };
} // End of function aliasValue()

/**
 * A node the projection recorded without descending into it.
 *
 * @param kind - What the elided node is.
 * @param node - The arena node identifier to claim.
 * @returns A projected value.
 */
export function elidedValue(kind: ValueKind, node = 0): ValueView {
  const elided: ElidedValue = { kind, span: { start: 0, end: 1 }, node };
  return { Elided: elided };
} // End of function elidedValue()

/**
 * Every byte hazard `docs/decisions/1c-2b-2a-notes.md` section 4 lists, in one
 * run of text.
 *
 * **Written as `\u{…}` escapes, and that is the point.** A literal `é` in a
 * source file can be normalised by an editor, at which point a test asserting
 * that nothing normalises it would agree with a normalising boundary instead of
 * catching it. Section 4 states the same rule for the Rust side, and this is its
 * frontend twin.
 *
 * It is a **rendering** fixture: it stands for what a file can hold, not for
 * what any particular wire value can carry. A NUL, for instance, cannot reach an
 * `UnknownEntry.value_text` at all — inside a quoted scalar it fails the parse
 * outright, and inside a plain one the parser **stops** at it, so the NUL and
 * everything after it fall outside every node span. So nothing may use this
 * constant to claim that one does. {@link PARSEABLE_HAZARDS} is the subset that
 * survives a parse.
 */
export const EVERY_TEXT_HAZARD = [
  '  line one  \r\n', // CRLF, and two real trailing spaces before it
  '  line two\n', // a bare LF among the CRLF endings
  '\n', // an empty line, which must stay one line
  '  caf\u{65}\u{301} caf\u{e9} \u{1f600}\n', // decomposed é, precomposed é, astral
  '  soft\u{2028}break\u{2029}here\n', // the two Unicode separators
  '  nul\u{0}here\n', // a NUL
  '  bell\u{7}here\n', // any other C0 control
  '  return\rhere\n', // a carriage return that is not part of a CRLF
  '  zero\u{feff}width\n', // U+FEFF away from the start of a document
  '  tab\there' // a tab, and no final newline
].join('');

/**
 * The hazards a document that **parses** can still put in a value.
 *
 * Measured rather than reasoned, twice. 1c-2b-2a measured that the substrate
 * accepts U+2028 and U+2029 and that a NUL never survives to a span
 * (`docs/decisions/1c-2b-2a-notes.md` section 4). The 1c-2b-2b-1 review measured
 * the rest, because a note claimed it instead:
 * `which_control_characters_can_reach_a_projected_slice` in
 * `crates/espansoconfig-core/tests/model_projection.rs` shows that **the other
 * C0 and C1 controls parse and land inside a match's own span**, and so does a
 * lone carriage return when the line that follows it is properly indented. Both
 * are therefore in this constant.
 *
 * So this is what an unmodelled entry's value can really carry, and it is what a
 * test about `UnknownEntry.value_text` may use.
 */
export const PARSEABLE_HAZARDS = [
  '  keeps  \r\n',
  '  caf\u{65}\u{301} \u{1f600}\n',
  '  bell\u{7}here\n',
  '  return\rhere\n',
  '  zero\u{200b}width\n',
  '  soft\u{2028}break\u{2029}here'
].join('');

/**
 * One mapping entry the projection did not model.
 *
 * @param key - The key's decoded text, or `null` for a non-scalar key.
 * @param reason - Why it was not modelled.
 * @param keyNode - The key node the coverage accounting balances on.
 * @param valueText - The value's source text, as Rust sliced it.
 * @returns An unknown entry.
 */
export function unknownEntry(
  key: string | null,
  reason: UnknownReason = 'NotModelled',
  keyNode = 0,
  valueText = 'x'
): UnknownEntry {
  return {
    key,
    key_node: keyNode,
    key_span: { start: 0, end: 1 },
    // Empty exactly when the text is, and never measured out of it. The wire's
    // spans count bytes and this is a JavaScript string, so a fixture that cut
    // one out of the other would model the exact confusion the field exists to
    // avoid — but a fixture whose span said "one byte" while its text said
    // "nothing" would contradict itself, and `sourceSlice()` in `./detail.ts`
    // reads precisely that pair to tell an empty value from an unreadable one.
    value_span: { start: 1, end: valueText === '' ? 1 : 2 },
    value_kind: 'Scalar',
    // Carried since Phase 1c-2b-2a, and drawn on screen since 1c-2b-2b-1.
    value_text: valueText,
    path: null,
    reason
  };
} // End of function unknownEntry()

/**
 * One diagnostic of the shape the boundary delivers.
 *
 * The span and the node are what distinguish two diagnostics carrying the same
 * code, so they are parameters rather than constants: a test of the
 * deduplication rule in `findings.ts` needs two records that differ **only**
 * there, which is precisely the pair the rule collapses.
 *
 * @param code - The code and its operands.
 * @param node - The node the diagnostic is about, or `null`.
 * @param start - The first byte of its span; the span is one byte long.
 * @returns A diagnostic.
 */
export function diagnostic(code: DiagnosticCode, node: number | null = null, start = 0): Diagnostic {
  return { code, span: { start, end: start + 1 }, node, path: null };
} // End of function diagnostic()

/** What {@link makeVariable} needs, all of it optional. */
export interface VariableOverrides {
  /** The mapping node this variable projects. */
  readonly node?: number;
  /** `name`, as source text. */
  readonly name?: string | null;
  /** `type`, as source text — the authoritative value. */
  readonly declaredType?: string | null;
  /** Which of the nine types the core read that as. */
  readonly kind?: VariableKind;
  /** `params`, shallowly projected, in source order. */
  readonly params?: readonly FieldView[];
  /** `depends_on`, one item per source entry. */
  readonly dependsOn?: readonly ValueView[];
  /** `inject_vars`, as source text. */
  readonly injectVars?: string | null;
  /** Entries the projection did not model. */
  readonly unknownEntries?: readonly UnknownEntry[];
}

/**
 * Builds a `VariableView` of the shape the boundary delivers.
 *
 * @param overrides - Whatever the test cares about; everything else is absent.
 * @returns A variable view.
 */
export function makeVariable(overrides: VariableOverrides = {}): VariableView {
  const declared = overrides.declaredType;
  return {
    node: overrides.node ?? 10,
    path: null,
    span: { start: 0, end: 1 },
    name: overrides.name === undefined || overrides.name === null ? null : scalar(overrides.name),
    declared_type: declared === undefined || declared === null ? null : scalar(declared),
    kind: overrides.kind ?? 'Absent',
    params: overrides.params ?? [],
    depends_on: overrides.dependsOn ?? [],
    inject_vars:
      overrides.injectVars === undefined || overrides.injectVars === null
        ? null
        : scalar(overrides.injectVars),
    unknown_entries: overrides.unknownEntries ?? []
  };
} // End of function makeVariable()

/**
 * A scalar for a field a test supplied, and `null` for one it did not.
 *
 * The overrides below use `undefined` for "the test said nothing" and `null` for
 * "the file does not have this key", and the wire has only the second. Both
 * become `null` here, which is what a projection of a file without the key
 * carries.
 *
 * @param text - The source text, or nothing.
 * @returns A scalar view, or `null`.
 */
function optionalScalar(text: string | null | undefined): ScalarView | null {
  return text === undefined || text === null ? null : scalar(text);
} // End of function optionalScalar()

/** What {@link makeMatch} needs, all of it optional. */
export interface MatchOverrides {
  /** The arena node, which is also the identity's node. */
  readonly node?: number;
  /** The document the match belongs to. */
  readonly document?: DocumentId;
  /** The revision the identity is scoped to. */
  readonly revision?: string;
  /** `trigger`, as source text. */
  readonly trigger?: string | null;
  /** `triggers`, as source text, one entry per item. */
  readonly triggers?: readonly string[];
  /** `regex`, as source text. */
  readonly regex?: string | null;
  /** Which trigger shape the core decided this is. */
  readonly triggerKind?: TriggerKind;
  /** `replace`, as source text. */
  readonly replace?: string | null;
  /** `markdown`, as source text. */
  readonly markdown?: string | null;
  /** `html`, as source text. */
  readonly html?: string | null;
  /** `image_path`, as source text. */
  readonly imagePath?: string | null;
  /** `form`, as source text — the shorthand layout, not the form fields. */
  readonly form?: string | null;
  /** Which content shape the core decided this is. */
  readonly contentKind?: ContentKind;
  /** `label`, as source text. */
  readonly label?: string | null;
  /** `comment`, as source text. */
  readonly comment?: string | null;
  /** `search_terms`, as source text, one entry per item. */
  readonly searchTerms?: readonly string[];
  /**
   * Any option, as source text, keyed by its wire name.
   *
   * One way to set an option, not two. There was a second — a `word` override
   * beside this one, with a merge block reconciling them — and nothing in the
   * types stopped a test from writing both and meaning different things by
   * them. `word` is the option a search must **not** cover, so it is the one
   * tests reach for; it is `options: { word: … }` like every other.
   */
  readonly options?: Readonly<Partial<Record<keyof MatchOptions, string>>>;
  /** `vars`, in source order. */
  readonly vars?: readonly VariableView[];
  /** `form_fields`, shallowly projected, in source order. */
  readonly formFields?: readonly FieldView[];
  /** Top-level entries of the match the projection did not model. */
  readonly unknownEntries?: readonly UnknownEntry[];
  /** The badges the core computed. Never derived from the fields above. */
  readonly badges?: readonly MatchBadge[];
  /**
   * Whether the visual editor may edit this match.
   *
   * Independent of {@link MatchOverrides.blockingHazard} on purpose. In Rust
   * the two come from one call and cannot disagree; here they can, which is
   * what lets a test drive the contradiction `matchEditability` has a defined
   * answer for.
   */
  readonly safelyEditable?: boolean;
  /** The hazard the core says blocks editing this match. */
  readonly blockingHazard?: HazardKind | null;
  /** `search_text`, when a test needs one the join below would not produce. */
  readonly searchText?: string;
  /**
   * `source_text`, when a test needs a slice the rendering below would not
   * produce — two byte-identical twins, for instance.
   */
  readonly sourceText?: string;
  /**
   * `path` — the address the edit engine works from.
   *
   * **The default is `null`, which is not what a real projection produces**, and
   * the asymmetry is deliberate: every match of a parsed snippet file has a path,
   * and no test needed one until 2c-3b, so defaulting to `null` leaves the
   * fixtures every existing suite was written against byte-for-byte unchanged. A
   * test about a *sequence position* sets it, and {@link matchListPath} is the
   * shape a snippet-list item really has.
   */
  readonly path?: DocumentPath | null;
}

/**
 * The path a snippet of a file's own `matches:` list is addressed by.
 *
 * The shape `project_document` in `crates/espansoconfig-core/src/model/document.rs`
 * builds for every item of the snippet list: the first document of the stream, the
 * `matches` key, then the item's index. A **transcription** of what Rust does, in
 * the sense this file's header means — not a measurement of it.
 *
 * @param index - The item's position in the list.
 * @param documentIndex - Which document of the stream, when a test needs one that
 *   is not the first.
 * @returns The path.
 */
export function matchListPath(index: number, documentIndex = 0): DocumentPath {
  return { document_index: documentIndex, segments: [{ Key: 'matches' }, { Index: index }] };
} // End of function matchListPath()

/**
 * Builds a `MatchView` of the shape the boundary delivers.
 *
 * @param overrides - Whatever the test cares about; everything else is absent.
 * @returns A match view.
 */
export function makeMatch(overrides: MatchOverrides = {}): MatchView {
  const node = overrides.node ?? 1;
  const document = overrides.document ?? 1;
  const revision = overrides.revision ?? 'rev-a';
  const trigger: TriggerSpec = {
    trigger: optionalScalar(overrides.trigger),
    triggers: (overrides.triggers ?? []).map(scalarItem),
    regex: optionalScalar(overrides.regex),
    kind: overrides.triggerKind ?? 'Single'
  };
  const content: ContentSpec = {
    replace: optionalScalar(overrides.replace),
    markdown: optionalScalar(overrides.markdown),
    html: optionalScalar(overrides.html),
    image_path: optionalScalar(overrides.imagePath),
    form: optionalScalar(overrides.form),
    kind: overrides.contentKind ?? 'Replace'
  };
  const label = optionalScalar(overrides.label);
  const comment = optionalScalar(overrides.comment);
  const searchTerms = overrides.searchTerms ?? [];
  const optionTexts: Partial<Record<keyof MatchOptions, string>> = overrides.options ?? {};

  // The second transcription this module's header warns about: the same field
  // groups the core joins, joined again here — every content field, in the
  // order `ContentSpec::collect_scalars` walks them, because the core indexes
  // every one rather than the primary one. A test asserting what the
  // *predicate* does with such a haystack is sound; a test asserting what the
  // core puts in one would be circular, and lives in Rust.
  const parts: string[] = [];
  if (trigger.trigger !== null) {
    parts.push(trigger.trigger.text);
  }
  parts.push(...(overrides.triggers ?? []));
  if (trigger.regex !== null) {
    parts.push(trigger.regex.text);
  }
  if (label !== null) {
    parts.push(label.text);
  }
  for (const present of [
    content.replace,
    content.markdown,
    content.html,
    content.image_path,
    content.form
  ]) {
    if (present !== null) {
      parts.push(present.text);
    }
  } // End of the loop over the content fields the haystack covers
  if (comment !== null) {
    parts.push(comment.text);
  }
  parts.push(...searchTerms);

  // The second transcription's other half: a YAML rendering of the same
  // fields, standing in for the byte slice the core takes out of the file. It
  // covers the options, which nothing else on the view does, because a
  // comparison blind to `word` is exactly the defect this fixture has to be
  // able to show.
  const lines: string[] = [`- trigger: ${overrides.trigger ?? ''}`];
  for (const entry of overrides.triggers ?? []) {
    lines.push(`  - ${entry}`);
  }
  for (const [key, value] of [
    ['regex', overrides.regex],
    ['replace', overrides.replace],
    ['markdown', overrides.markdown],
    ['html', overrides.html],
    ['image_path', overrides.imagePath],
    ['form', overrides.form],
    ['label', overrides.label],
    ['comment', overrides.comment]
  ] as const) {
    if (value !== undefined && value !== null) {
      lines.push(`  ${key}: ${value}`);
    }
  } // End of the loop over the scalar fields the rendering shows
  for (const [key, value] of Object.entries(optionTexts)) {
    lines.push(`  ${key}: ${value}`);
  }
  for (const term of searchTerms) {
    lines.push(`    - ${term}`);
  }

  return {
    id: { document, revision, node },
    source_node: node,
    path: overrides.path ?? null,
    span: { start: 0, end: 1 },
    source_text: overrides.sourceText ?? lines.join('\n'),
    trigger,
    content,
    label,
    comment,
    search_terms: searchTerms.map(scalarItem),
    options: {
      word: optionalScalar(optionTexts.word),
      left_word: optionalScalar(optionTexts.left_word),
      right_word: optionalScalar(optionTexts.right_word),
      propagate_case: optionalScalar(optionTexts.propagate_case),
      uppercase_style: optionalScalar(optionTexts.uppercase_style),
      force_mode: optionalScalar(optionTexts.force_mode),
      force_clipboard: optionalScalar(optionTexts.force_clipboard),
      paragraph: optionalScalar(optionTexts.paragraph),
      anchor: optionalScalar(optionTexts.anchor)
    },
    vars: overrides.vars ?? [],
    form_fields: overrides.formFields ?? [],
    badges: overrides.badges ?? [],
    blocking_hazard: overrides.blockingHazard ?? null,
    safely_editable: overrides.safelyEditable ?? true,
    unknown_entries: overrides.unknownEntries ?? [],
    search_text: overrides.searchText ?? parts.join('\n')
  };
} // End of function makeMatch()

/** What {@link makeDocument} and {@link makeSummary} need. */
export interface DocumentOverrides {
  /** The document's session-local identity. */
  readonly id?: DocumentId;
  /** The path relative to the configuration root. */
  readonly relativePath?: string;
  /** What espanso treats the file as. */
  readonly kind?: FileKind;
  /** Whether espanso's default include glob skips the file. */
  readonly disabled?: boolean;
  /** Whether the editor must refuse to write it. */
  readonly readOnly?: boolean;
  /** The revision the projection is of. */
  readonly revision?: string;
  /** The matches the document holds. */
  readonly matches?: readonly MatchView[];
  /**
   * Every top-level key of the projected document, as source text.
   *
   * **The default is derived rather than pinned**, for the reason
   * {@link DocumentOverrides.hazards} makes about `safely_editable`: a fixture
   * that contradicts itself is a fixture the next reader trusts. A snippet file
   * that parses writes its snippets under `matches:`, so that is what one has; a
   * file the substrate did not accept has no projected keys at all, and neither
   * does a config profile by default.
   *
   * It matters because `destinationEligibility` in `./matchCreation.ts` asks the
   * same question of the same field the core's `match_list_of` does.
   */
  readonly topLevelKeys?: readonly string[];
  /** Whether the substrate accepted the file. */
  readonly parsed?: boolean;
  /** Everything the projection noticed, in source order. */
  readonly diagnostics?: readonly Diagnostic[];
  /** The distinct hazard kinds the core found anywhere in the file. */
  readonly hazards?: readonly HazardKind[];
}

/**
 * Builds a `DocumentSummary` of the shape `list_documents` returns.
 *
 * @param overrides - Whatever the test cares about.
 * @returns A document summary.
 */
export function makeSummary(overrides: DocumentOverrides = {}): DocumentSummary {
  const id = overrides.id ?? 1;
  const relative = overrides.relativePath ?? 'match/base.yml';
  return {
    id,
    path: `/tmp/espanso/${relative}`,
    relative_path: relative,
    kind: overrides.kind ?? 'MatchFile',
    disabled: overrides.disabled ?? false,
    read_only: overrides.readOnly ?? false,
    loaded: false
  };
} // End of function makeSummary()

/**
 * Builds a `DocumentView` of the shape `get_document` returns.
 *
 * @param overrides - Whatever the test cares about.
 * @returns A document projection.
 */
export function makeDocument(overrides: DocumentOverrides = {}): DocumentView {
  const summary = makeSummary(overrides);
  const parsed = overrides.parsed ?? true;
  const keys =
    overrides.topLevelKeys ?? (parsed && summary.kind !== 'ConfigProfile' ? ['matches'] : []);
  return {
    id: summary.id,
    path: summary.path,
    relative_path: summary.relative_path,
    kind: summary.kind,
    disabled: summary.disabled,
    read_only: summary.read_only,
    revision: overrides.revision ?? 'rev-a',
    byte_len: 0,
    line_ending: 'Lf',
    bom: false,
    parsed,
    stream_documents: 1,
    // Follows the kind rather than being pinned to `MatchFile`: a profile is
    // projected as of the 1c-2b-1 review, so a fixture profile whose *shape*
    // still said "snippet file" would be the kind of self-contradicting fixture
    // the next reader trusts.
    shape: summary.kind === 'ConfigProfile' ? 'ConfigProfile' : 'MatchFile',
    top_level_keys: keys.map((key) => scalar(key)),
    matches: overrides.matches ?? [],
    global_vars: [],
    imports: [],
    profile: null,
    unknown_entries: [],
    coverage: [],
    undescended: [],
    diagnostics: overrides.diagnostics ?? [],
    hazards: overrides.hazards ?? [],
    // The one derived field, and it is derived because the alternative is a
    // fixture that contradicts itself. Rust computes the root's answer with
    // `disqualifying_hazard`, which fires when the flagged node is the node, an
    // ancestor of it **or a descendant of it** — and the root is an ancestor of
    // everything — so any hazard anywhere makes the root un-editable. Nothing
    // in the frontend reads this field yet; it is here so that when something
    // does, the fixture is not the thing that is wrong.
    safely_editable: (overrides.hazards ?? []).length === 0
  };
} // End of function makeDocument()

/** What {@link makeConflict} needs; only the disk projection is required. */
export interface ConflictOverrides {
  /**
   * The newly parsed projection the conflict carries.
   *
   * **Required, and `disk_revision` is copied from its `revision` field** — that
   * one equality is the whole of what this fixture forces, and it is worth forcing
   * because a case that set the two separately would be asserting over a payload
   * whose revision names a projection it does not carry. Neither TypeScript nor
   * this fixture proves anything further: `revision` is an ordinary string, so a
   * caller can hand in a `DocumentView` whose revision is unrelated to its own
   * projected fields, and nothing here hashes
   * {@link ConflictOverrides.diskText} or checks that this projection is a parse
   * of it. In Rust one refresh produces the text, the revision and the projection
   * together; a fixture cannot stand in for that.
   */
  readonly disk: DocumentView;
  /** The revision the save was based on. */
  readonly expected?: ContentRevision;
  /**
   * The revision the locked read found.
   *
   * Defaults to the disk projection's, which is the ordinary case: the file moved
   * once. A case about `changedAgain` sets a third value.
   */
  readonly found?: ContentRevision;
  /**
   * The disk side's whole file text.
   *
   * Independently settable, and its default is a fixed comment line that is not a
   * serialisation of {@link ConflictOverrides.disk}. Nothing binds it to the
   * revision above; a case that needs the two to agree has to say so itself.
   */
  readonly diskText?: string;
  /** What the search for the operation's own snippet found. */
  readonly subject?: ReapplyResolution;
  /** What the search for its positional anchor found. */
  readonly placement?: ReapplyPlacement;
}

/**
 * Builds a `ConflictResult` of the shape the boundary delivers.
 *
 * **The two correspondence operands default to the arms a save that names nothing
 * produces** — `Unsupported` and `NotAnchored` — because that is what every
 * conflict fixture written before 2c-4b-1 carries and what a case not about
 * reapply should go on carrying. A case about reapply sets them.
 *
 * **What it forces, in the same sentence as what it does not.** `disk_revision`
 * equals the supplied projection's `revision`, and `found` defaults to it. It does
 * not force that either names the same bytes as `disk_text`, that the projection is
 * a parse of those bytes, or that the identified subject and placement belong to
 * this projection at all — those are properties of the Rust boundary, and a test
 * built on this fixture is evidence about the transition it drives and not about
 * the payload the wire can produce.
 *
 * @param overrides - The disk projection, and whatever else the case cares about.
 * @returns The conflict, as it crosses the boundary.
 */
export function makeConflict(overrides: ConflictOverrides): ConflictResult {
  return {
    outcome: 'conflict',
    reapply: {
      subject: overrides.subject ?? { Unsupported: {} },
      placement: overrides.placement ?? { NotAnchored: {} }
    },
    expected: overrides.expected ?? 'rev-a',
    found: overrides.found ?? overrides.disk.revision,
    disk_revision: overrides.disk.revision,
    disk_text: overrides.diskText ?? '# the file as it is now\n',
    disk: overrides.disk
  };
} // End of function makeConflict()
