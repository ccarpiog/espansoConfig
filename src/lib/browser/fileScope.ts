/**
 * What the file-scope inspector shows about one file, decided here rather than
 * in markup — Phase 3-9-1 (`docs/decisions/3-split-notes.md` §2 step 3-9,
 * ruling 14).
 *
 * `FileScope.svelte` draws these values in the snippet list, beside what
 * `findings.ts` says about the same file; `Sidebar.svelte` draws the one value
 * a row needs ({@link autoLoadOf}). Nothing here writes, resolves or renames:
 * ruling 14 makes the inspector **display only**, and a later import editor
 * needs its own document-level draft surface.
 *
 * ## Three rules govern everything below
 *
 * **The order is the file's order, and every entry is drawn.** One row per item
 * of `DocumentView.imports`, in the order the projection carried them, which is
 * the order the file writes them. An entry the file writes as something other
 * than a single scalar is not dropped: the core elides it **in place**
 * (`model/document.rs`), and it becomes an `unsupported` row at its own position
 * with its reason, so no position shifts and no entry disappears.
 *
 * **An entry is source text, never a resolved path (D2u, ruling 14).** A row
 * carries the scalar exactly as the projection did. Nothing here joins it to the
 * configuration root, looks for the file it names, or says the file exists or
 * is missing — the module holds no path and makes no filesystem request, and the
 * sentence drawn over the list says so to the reader.
 *
 * **Absent is not empty.** `imports_presence` (Phase 3-2) tells a file with no
 * `imports` key from one writing `imports: []` and from one writing `imports`
 * as something other than a list, so the three are three states here. A file the
 * substrate did not accept also answers `Absent` in Rust; it is a fourth state,
 * `notRead`, because saying such a file "has no imports key" would claim
 * something nobody read.
 *
 * **`_` means "not auto-loaded", never "inactive".** `DocumentView.disabled` is
 * the core's "espanso's default include pattern skips this file" — a file name
 * starting with `_` (`classify` in `crates/espansoconfig-core/src/discovery.rs`).
 * A snippet file flagged so is used when something brings it in (`imports`,
 * `includes`, `extra_includes`); a configuration profile flagged so gets a
 * sentence of its own that makes no loading claim ({@link autoLoadOf}). Nothing
 * here or in the dictionaries calls either switched off.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type { DocumentView, FileKind, NodeId, ValueKind, ValueView } from '../ipc/types';
import { scalarDisplay, type ScalarDisplay } from './detail';

// ---------------------------------------------------------------------------
// Auto-loading
// ---------------------------------------------------------------------------

/**
 * What the inspector says about the core's `_` flag for one file.
 *
 * `default` carries no sentence: a file whose name does not start with `_` is
 * loaded or not according to the configuration's include and exclude rules,
 * which this app does not evaluate, so the inspector says nothing rather than
 * "loaded automatically".
 *
 * The flagged states depend on the file's kind (Phase 3-9-1 review fix):
 *
 * - `notAutoLoaded` — a snippet file or a package file. espanso's default include
 *   pattern skips it (`discovery.rs` spells the glob), and the sentence names the
 *   ways such a file is brought in: another file's `imports`, or a
 *   configuration's `includes` or `extra_includes`.
 * - `underscoreProfile` — a configuration profile. The core flags it by the same
 *   name rule, but that include pattern is about snippet files, and this app has
 *   not established what espanso does with a profile named this way, so its
 *   sentence says only that the name starts with `_` and that nothing further is
 *   checked. It makes no loading claim.
 */
export type AutoLoadState =
  | { readonly kind: 'default' }
  | { readonly kind: 'notAutoLoaded' }
  | { readonly kind: 'underscoreProfile' };

/** The flagged states, the ones that carry words. */
export type AutoLoadNote = Exclude<AutoLoadState['kind'], 'default'>;

/** Where a flagged state is drawn: a sidebar mark or the full sentence. */
export type AutoLoadPlacement = 'mark' | 'explanation';

/**
 * The auto-load state of a file, from the core's own flag and kind.
 *
 * Takes the two fields it reads, so a sidebar row (`DocumentSummary`) and a
 * projection (`DocumentView`) are both accepted. Nothing here inspects a file
 * name. A package is a snippet file under `match/packages/`, which the same
 * default pattern covers, so it reads as `notAutoLoaded`.
 *
 * @param file - Anything carrying the core's `disabled` flag and file kind.
 * @returns The state.
 */
export function autoLoadOf(file: {
  readonly disabled: boolean;
  readonly kind: FileKind;
}): AutoLoadState {
  if (!file.disabled) {
    return { kind: 'default' };
  }
  return file.kind === 'ConfigProfile' ? { kind: 'underscoreProfile' } : { kind: 'notAutoLoaded' };
} // End of function autoLoadOf()

/**
 * The dictionary key for a flagged state at one placement.
 *
 * `default` has no sentence, and the parameter type makes asking for its key a
 * compile error.
 *
 * @param note - The flagged state.
 * @param placement - Where it is drawn.
 * @returns The key holding that placement's words.
 */
export function autoLoadKey(note: AutoLoadNote, placement: AutoLoadPlacement): TranslationKey {
  if (note === 'underscoreProfile') {
    return placement === 'mark'
      ? 'browser.fileScope.underscoreProfile.mark'
      : 'browser.fileScope.underscoreProfile.explanation';
  }
  return placement === 'mark'
    ? 'browser.fileScope.notAutoLoaded.mark'
    : 'browser.fileScope.notAutoLoaded.explanation';
} // End of function autoLoadKey()

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

/** One entry of `imports`, at its position in the file. */
export type ImportRow =
  | {
      /** An entry written as a single scalar, drawn as written (D2u). */
      readonly kind: 'asWritten';
      /** Its 1-based position among the file's entries. */
      readonly position: number;
      /** The scalar and its display facts; `display.scalar.text` is all that is printed. */
      readonly display: ScalarDisplay;
    }
  | {
      /**
       * An entry written as something other than a single scalar. Kept visible
       * with its reason; its content is not drawn.
       */
      readonly kind: 'unsupported';
      /** Its 1-based position among the file's entries. */
      readonly position: number;
      /** The reason code: what the entry is written as instead. */
      readonly found: ValueKind;
      /** The entry's node, or `null` when the wire carried none for it. */
      readonly node: NodeId | null;
    };

/** The state of a file's `imports`, as the inspector draws it. */
export type ImportsState =
  | {
      /** The substrate did not accept the file; nothing is said about its imports. */
      readonly kind: 'notRead';
    }
  | {
      /** The parsed file has no `imports` key. */
      readonly kind: 'absent';
    }
  | {
      /** The file writes `imports` as a list with nothing in it. */
      readonly kind: 'empty';
    }
  | {
      /** The file writes `imports` as something other than a list. */
      readonly kind: 'unsupportedShape';
      /** What it writes it as. */
      readonly found: ValueKind;
    }
  | {
      /** The file writes entries; every one is a row, in file order. */
      readonly kind: 'listed';
      /** One row per projected entry, in the order the file writes them. */
      readonly rows: readonly ImportRow[];
    };

/** The names of {@link ImportsState}'s five states. */
export type ImportsStateName = ImportsState['kind'];

/**
 * The row one projected entry stands for.
 *
 * The core projects an entry as a scalar or elides it in place; the other three
 * arms of `ValueView` are handled too, so a wider projection cannot drop an
 * entry here without a compile error.
 *
 * @param item - One item of `DocumentView.imports`.
 * @param position - Its 1-based position.
 * @returns The row.
 */
function importRowOf(item: ValueView, position: number): ImportRow {
  if ('Scalar' in item) {
    return { kind: 'asWritten', position, display: scalarDisplay(item.Scalar) };
  }
  if ('Elided' in item) {
    return { kind: 'unsupported', position, found: item.Elided.kind, node: item.Elided.node };
  }
  if ('Alias' in item) {
    return { kind: 'unsupported', position, found: 'Alias', node: item.Alias.node };
  }
  // A collection the projection descended into. It has no node of its own on
  // the wire, so the position is its only identity.
  return {
    kind: 'unsupported',
    position,
    found: 'Sequence' in item ? 'Sequence' : 'Mapping',
    node: null
  };
} // End of function importRowOf()

/**
 * The state of one file's `imports`.
 *
 * Any projected entry makes the state `listed`, whatever the presence says, so a
 * disagreement between the two fields can hide nothing; with no entries the
 * presence decides, and an `Items` presence counting none is drawn as `empty`.
 *
 * @param view - The file's projection.
 * @returns The state.
 */
export function importsStateOf(view: DocumentView): ImportsState {
  if (!view.parsed) {
    return { kind: 'notRead' };
  }
  if (view.imports.length > 0) {
    return { kind: 'listed', rows: view.imports.map((item, index) => importRowOf(item, index + 1)) };
  }
  const presence = view.imports_presence;
  if ('UnsupportedShape' in presence) {
    return { kind: 'unsupportedShape', found: presence.UnsupportedShape.found };
  }
  if ('Absent' in presence) {
    return { kind: 'absent' };
  }
  return { kind: 'empty' };
} // End of function importsStateOf()

/**
 * The dictionary key for the sentence drawn for one imports state.
 *
 * `listed` has one too: the sentence over the list, which says the entries are
 * shown as written and that this app does not look up the files they name.
 *
 * @param name - The state's name.
 * @returns The key holding that state's sentence.
 */
export function importsStateKey(name: ImportsStateName): TranslationKey {
  switch (name) {
    case 'notRead':
      return 'browser.fileScope.imports.notRead';
    case 'absent':
      return 'browser.fileScope.imports.absent';
    case 'empty':
      return 'browser.fileScope.imports.empty';
    case 'unsupportedShape':
      return 'browser.fileScope.imports.unsupportedShape';
    case 'listed':
      return 'browser.fileScope.imports.listed';
  }
} // End of function importsStateKey()

/**
 * The dictionary key for an unsupported entry's reason.
 *
 * One reason exists — the entry is not a single scalar — and its operand, what
 * the entry is written as, is drawn through `describeValueKind`.
 *
 * @returns The key holding the reason's sentence.
 */
export function unsupportedImportKey(): TranslationKey {
  return 'browser.fileScope.imports.entryNotAPath';
} // End of function unsupportedImportKey()

// ---------------------------------------------------------------------------
// The whole inspector
// ---------------------------------------------------------------------------

/** Everything the inspector draws for one file. */
export interface FileScope {
  /** What is said about the core's `_` flag, by file kind. */
  readonly autoLoad: AutoLoadState;
  /** The file's `imports`. */
  readonly imports: ImportsState;
}

/**
 * Everything the file-scope inspector draws for one file.
 *
 * @param view - The file's projection.
 * @returns The inspector's values.
 */
export function describeFileScope(view: DocumentView): FileScope {
  return { autoLoad: autoLoadOf(view), imports: importsStateOf(view) };
} // End of function describeFileScope()
