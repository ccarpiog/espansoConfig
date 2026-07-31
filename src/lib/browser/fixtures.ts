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
 *   what the core does since the 1c-1 review; this fixture models the subset of
 *   those fields {@link MatchOverrides} exposes (`trigger`, `triggers`,
 *   `regex`, `label`, `replace`, `html`, `comment`, `search_terms`) and no
 *   other. Rust pins the haystack in
 *   `search_text_covers_the_five_fields_plan_section_eight_names` and
 *   `search_text_covers_every_content_form_and_not_only_the_primary_one`;
 * - `source_text` is a *plausible* YAML rendering of the same fields, not the
 *   real slice of a real file. What it faithfully reproduces is the one
 *   property the selection depends on: it changes whenever a field of the match
 *   changes, **including a field no other part of the view carries**, which is
 *   why the `word` override below moves it. Rust pins the real slice in
 *   `every_projected_match_carries_exactly_the_bytes_its_span_names`.
 *
 * Recorded as a hole in `docs/decisions/1c-1-notes.md`.
 */

import type {
  ContentKind,
  ContentSpec,
  DocumentId,
  DocumentSummary,
  DocumentView,
  FileKind,
  MatchBadge,
  MatchOptions,
  MatchView,
  ScalarView,
  TriggerKind,
  TriggerSpec,
  ValueView
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
 * A sequence item holding a scalar.
 *
 * @param text - The item's source text.
 * @returns A projected value.
 */
export function scalarItem(text: string): ValueView {
  return { Scalar: scalar(text) };
} // End of function scalarItem()

/** Every option field absent, which is the common case. */
const NO_OPTIONS: MatchOptions = {
  word: null,
  left_word: null,
  right_word: null,
  propagate_case: null,
  uppercase_style: null,
  force_mode: null,
  force_clipboard: null,
  paragraph: null,
  anchor: null
};

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
  /** `html`, as source text. */
  readonly html?: string | null;
  /** Which content shape the core decided this is. */
  readonly contentKind?: ContentKind;
  /** `label`, as source text. */
  readonly label?: string | null;
  /** `comment`, as source text. */
  readonly comment?: string | null;
  /** `search_terms`, as source text, one entry per item. */
  readonly searchTerms?: readonly string[];
  /** `word`, as source text — a field search must **not** cover. */
  readonly word?: string | null;
  /** The badges the core computed. Never derived from the fields above. */
  readonly badges?: readonly MatchBadge[];
  /** `search_text`, when a test needs one the join below would not produce. */
  readonly searchText?: string;
  /**
   * `source_text`, when a test needs a slice the rendering below would not
   * produce — two byte-identical twins, for instance.
   */
  readonly sourceText?: string;
}

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
    trigger: overrides.trigger === undefined || overrides.trigger === null
      ? null
      : scalar(overrides.trigger),
    triggers: (overrides.triggers ?? []).map(scalarItem),
    regex: overrides.regex === undefined || overrides.regex === null
      ? null
      : scalar(overrides.regex),
    kind: overrides.triggerKind ?? 'Single'
  };
  const content: ContentSpec = {
    replace: overrides.replace === undefined || overrides.replace === null
      ? null
      : scalar(overrides.replace),
    markdown: null,
    html: overrides.html === undefined || overrides.html === null ? null : scalar(overrides.html),
    image_path: null,
    form: null,
    kind: overrides.contentKind ?? 'Replace'
  };
  const label = overrides.label === undefined || overrides.label === null
    ? null
    : scalar(overrides.label);
  const comment = overrides.comment === undefined || overrides.comment === null
    ? null
    : scalar(overrides.comment);
  const searchTerms = overrides.searchTerms ?? [];

  // The second transcription this module's header warns about: the same field
  // groups the core joins, joined again here — `replace` *and* `html`, because
  // the core indexes every content field rather than the primary one. A test
  // asserting what the *predicate* does with such a haystack is sound; a test
  // asserting what the core puts in one would be circular, and lives in Rust.
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
  if (content.replace !== null) {
    parts.push(content.replace.text);
  }
  if (content.html !== null) {
    parts.push(content.html.text);
  }
  if (comment !== null) {
    parts.push(comment.text);
  }
  parts.push(...searchTerms);

  // The second transcription's other half: a YAML rendering of the same
  // fields, standing in for the byte slice the core takes out of the file. It
  // covers `word`, which nothing else on the view does, because a comparison
  // blind to `word` is exactly the defect this fixture has to be able to show.
  const lines: string[] = [`- trigger: ${overrides.trigger ?? ''}`];
  for (const entry of overrides.triggers ?? []) {
    lines.push(`  - ${entry}`);
  }
  for (const [key, value] of [
    ['regex', overrides.regex],
    ['replace', overrides.replace],
    ['html', overrides.html],
    ['label', overrides.label],
    ['comment', overrides.comment],
    ['word', overrides.word]
  ] as const) {
    if (value !== undefined && value !== null) {
      lines.push(`  ${key}: ${value}`);
    }
  } // End of the loop over the scalar fields the rendering shows
  for (const term of searchTerms) {
    lines.push(`    - ${term}`);
  }

  return {
    id: { document, revision, node },
    source_node: node,
    path: null,
    span: { start: 0, end: 1 },
    source_text: overrides.sourceText ?? lines.join('\n'),
    trigger,
    content,
    label,
    comment,
    search_terms: searchTerms.map(scalarItem),
    options:
      overrides.word === undefined || overrides.word === null
        ? NO_OPTIONS
        : { ...NO_OPTIONS, word: scalar(overrides.word) },
    vars: [],
    form_fields: [],
    badges: overrides.badges ?? [],
    blocking_hazard: null,
    safely_editable: true,
    unknown_entries: [],
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
    parsed: true,
    stream_documents: 1,
    shape: 'MatchFile',
    top_level_keys: [],
    matches: overrides.matches ?? [],
    global_vars: [],
    imports: [],
    profile: null,
    unknown_entries: [],
    coverage: [],
    undescended: [],
    diagnostics: [],
    hazards: [],
    safely_editable: true
  };
} // End of function makeDocument()
