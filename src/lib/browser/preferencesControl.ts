/**
 * What the screens draw of the application preferences, as values — Phase 3-13-2.
 *
 * **No component**, as every model in this directory. `./preferences.ts` (Phase
 * 3-13-1) holds what the sidecar means; this module holds the decisions the
 * three components of 3-13-2 would otherwise make in markup:
 *
 * - the preferences control's **draft** of one file's display name and seven
 *   defaults ({@link PreferencesDraft}), the one request a save of it sends
 *   ({@link preferencesPlanOf}), and which control draws each value
 *   ({@link preferenceTextControlOf});
 * - the **sentences** a control says about how the preferences were read and
 *   how the last save ended ({@link preferencesReadingLineOf},
 *   {@link preferenceSaveLinesOf}), as codes a component renders through the
 *   reactive wrappers in `../i18n/index.ts`;
 * - what the new-snippet form says about **its seeding** ({@link seedingNoticeOf}).
 *
 * ## One line per box, decided here (`CLAUDE.md` §6)
 *
 * Every text control these values feed is an `<input type="text">`, and an
 * `<input>` deletes a carriage return and a line feed from its value. A value
 * holding either can therefore never be put into one without changing it, so
 * {@link preferenceTextControlOf} answers `shown` for it: a component draws it
 * read-only through `SourceText` and offers only its removal. A value typed into
 * a box has already lost both characters, so nothing is reconstructed. **What
 * this module forces is the answer; nothing in TypeScript forces a component to
 * obey it** — the mounted suites are what check that none draws a `shown` value
 * into a box.
 *
 * ## The draft keeps its own baseline
 *
 * {@link startPreferencesDraft} copies what the file's preferences were when the
 * control opened, and {@link preferencesPlanOf} asks only for what the person
 * changed against that copy. Rust reloads the sidecar under its lock before
 * applying the changes (ruling 26), so a value another instance saved meanwhile
 * and this person did not touch is left as that instance wrote it.
 */

import type { DetailFieldName } from './detail';
import type { IpcFailure } from '../ipc/errors';
import type {
  BulkOption,
  DocumentId,
  FileKind,
  SidecarChange,
  SidecarStatus,
  SidecarUpdateOutcome
} from '../ipc/types';
import { BULK_OPTIONS, bulkOptionField } from './bulkEdit';
import type { CreationSeeding, MatchCreationView } from './matchCreation';
import type { SidebarSelection } from './sidebar';
import {
  defaultChanges,
  displayNameChanges,
  filePreferencesOf,
  type DefaultRefusal,
  type DisplayNameRefusal,
  type FileDefaults,
  type WorkspacePreferences
} from './preferences';
import type { PreferenceSaveState } from './workspace.svelte';

// ---------------------------------------------------------------------------
// Which control draws a value
// ---------------------------------------------------------------------------

/**
 * How one optional text value is drawn.
 *
 * - `absent`: there is no value; the control offers to add one.
 * - `box`: a one-line `<input>` holds it.
 * - `shown`: it holds a line feed or a carriage return, which an `<input>` would
 *   delete, so it is drawn read-only and only its removal is offered.
 */
export type PreferenceTextControl = 'absent' | 'box' | 'shown';

/**
 * Which control draws one optional text value.
 *
 * @param value - The value, or `null` when there is none.
 * @returns The control.
 */
export function preferenceTextControlOf(value: string | null): PreferenceTextControl {
  if (value === null) {
    return 'absent';
  }
  return value.includes('\n') || value.includes('\r') ? 'shown' : 'box';
} // End of function preferenceTextControlOf()

// ---------------------------------------------------------------------------
// The preferences control's draft
// ---------------------------------------------------------------------------

/** The file a preferences control is about, as the window lists or projects it. */
export interface PreferencesTarget {
  /** The file, by this session's identity. */
  readonly id: DocumentId;
  /** Its path relative to the configuration root. */
  readonly relative_path: string;
  /** What kind of file it is. */
  readonly kind: FileKind;
}

/**
 * The file a preferences control is about: the sidebar's selected file, looked
 * up in the window's **listed** files — Phase 3-13-2's review.
 *
 * Deliberately not the file's projection. A whole-file save retires the
 * projection (`forgetTheReplacedDocument` in `./workspace.svelte.ts`) before it
 * awaits the re-read, and a control mounted from the projection was destroyed in
 * that gap with its unsaved draft. The listed summary and the selection both
 * outlive a re-read, so a control keyed on this answer keeps its draft through
 * one. What this cannot keep a draft through is a change of selection or an
 * `open()`, which end the control on purpose.
 *
 * @param selection - What the sidebar has selected.
 * @param documents - Every file the window lists.
 * @returns The selected file's summary, or `null` for the "All" scope or a file
 *   the window no longer lists.
 */
export function preferencesTargetOf(
  selection: SidebarSelection,
  documents: readonly PreferencesTarget[]
): PreferencesTarget | null {
  if (selection.kind !== 'document') {
    return null;
  }
  return documents.find((one) => one.id === selection.id) ?? null;
} // End of function preferencesTargetOf()

/**
 * Whether new-snippet defaults mean anything for a file.
 *
 * Only a snippet file (`MatchFile`) can be a creation destination; a profile
 * holds no snippets and a package is never written, so the control offers no
 * defaults for either. A display name applies to every file.
 *
 * @param target - The file.
 * @returns `true` for a snippet file.
 */
export function defaultsApplyTo(target: PreferencesTarget): boolean {
  return target.kind === 'MatchFile';
} // End of function defaultsApplyTo()

/** What the preferences control holds for one file. */
export interface PreferencesDraft {
  /** The file. */
  readonly document: DocumentId;
  /** The display name the file had when the draft started, or `null`. */
  readonly baseName: string | null;
  /** The defaults the file had when the draft started. */
  readonly baseDefaults: FileDefaults;
  /** What the name control holds; `''` is no name. */
  readonly name: string;
  /** What the default controls hold; `null` is no default, `''` an empty one. */
  readonly defaults: FileDefaults;
}

/**
 * A draft of one file's preferences as they are in effect now.
 *
 * @param preferences - The preferences in effect.
 * @param document - The file.
 * @returns A draft whose values equal its baseline.
 */
export function startPreferencesDraft(
  preferences: WorkspacePreferences,
  document: DocumentId
): PreferencesDraft {
  const file = filePreferencesOf(preferences, document);
  return Object.freeze({
    document,
    baseName: file.displayName,
    baseDefaults: file.defaults,
    name: file.displayName ?? '',
    defaults: file.defaults
  });
} // End of function startPreferencesDraft()

/**
 * The draft with the name control's whole value replaced.
 *
 * @param draft - The draft.
 * @param text - What the control holds.
 * @returns The new draft.
 */
export function editDraftName(draft: PreferencesDraft, text: string): PreferencesDraft {
  return Object.freeze({ ...draft, name: text });
} // End of function editDraftName()

/**
 * The draft with one default set to a text — `''` included, which is an empty
 * default and not the same as none.
 *
 * @param draft - The draft.
 * @param option - Which option.
 * @param text - Its text.
 * @returns The new draft.
 */
export function editDraftDefault(
  draft: PreferencesDraft,
  option: BulkOption,
  text: string
): PreferencesDraft {
  return Object.freeze({ ...draft, defaults: Object.freeze({ ...draft.defaults, [option]: text }) });
} // End of function editDraftDefault()

/**
 * The draft with one default taken away, so a new snippet gets no such key.
 *
 * @param draft - The draft.
 * @param option - Which option.
 * @returns The new draft.
 */
export function removeDraftDefault(draft: PreferencesDraft, option: BulkOption): PreferencesDraft {
  return Object.freeze({ ...draft, defaults: Object.freeze({ ...draft.defaults, [option]: null }) });
} // End of function removeDraftDefault()

/**
 * The draft after the preferences in effect were replaced: a **fresh draft** when
 * this one holds nothing the person changed, and this same draft otherwise.
 *
 * A control opened before the first read answered starts from empty
 * preferences; this is what lets it show the file's real values once they
 * arrive. A draft with changes keeps them and its own baseline, so what it
 * sends is still only what the person changed ({@link preferencesPlanOf}).
 *
 * @param draft - The draft.
 * @param preferences - The preferences now in effect.
 * @returns The draft to hold.
 */
export function followPreferences(
  draft: PreferencesDraft,
  preferences: WorkspacePreferences
): PreferencesDraft {
  return preferencesPlanOf(draft).kind === 'nothing'
    ? startPreferencesDraft(preferences, draft.document)
    : draft;
} // End of function followPreferences()

/**
 * Whether the control accepts changes: the sidecar is writable and no save of
 * this control is out. A save refused as not writable is what `writable: false`
 * would have led to, so the controls say it before a press.
 *
 * @param preferences - The preferences in effect.
 * @param saving - Whether a save is out.
 * @returns `true` when the controls may be edited and saved.
 */
export function preferencesEditable(preferences: WorkspacePreferences, saving: boolean): boolean {
  return preferences.writable && !saving;
} // End of function preferencesEditable()

/** What saving the draft would send, or why it cannot. */
export type PreferencesPlan =
  | {
      /** The draft equals its baseline; nothing would be sent. */
      readonly kind: 'nothing';
    }
  | {
      /** One `update_sidecar` request with these changes, name first. */
      readonly kind: 'ready';
      /** The changes, in order. */
      readonly changes: readonly SidecarChange[];
    }
  | {
      /** The drafted name cannot be stored. Nothing is sent. */
      readonly kind: 'nameRefused';
      /** Why. */
      readonly reason: DisplayNameRefusal;
    }
  | {
      /** A drafted default cannot be stored. Nothing is sent. */
      readonly kind: 'defaultRefused';
      /** The first option refused. */
      readonly option: BulkOption;
      /** Why. */
      readonly reason: DefaultRefusal;
    };

/**
 * What saving the draft asks for: only what the person changed against the
 * draft's baseline. An untouched name or default is never sent.
 *
 * @param draft - The draft.
 * @returns The plan.
 */
export function preferencesPlanOf(draft: PreferencesDraft): PreferencesPlan {
  const changes: SidecarChange[] = [];
  if (draft.name !== (draft.baseName ?? '')) {
    const named = displayNameChanges(draft.name);
    if (named.kind === 'refused') {
      return { kind: 'nameRefused', reason: named.reason };
    }
    changes.push(...named.changes);
  }
  const defaults = defaultChanges(draft.baseDefaults, draft.defaults);
  if (defaults.kind === 'refused') {
    return { kind: 'defaultRefused', option: defaults.option, reason: defaults.reason };
  }
  changes.push(...defaults.changes);
  return changes.length === 0 ? { kind: 'nothing' } : { kind: 'ready', changes };
} // End of function preferencesPlanOf()

/** One default as the control draws it. */
export interface DefaultControlView {
  /** The option, as its espanso key. */
  readonly option: BulkOption;
  /** The detail pane's label for it. */
  readonly label: DetailFieldName;
  /** What the draft holds. */
  readonly value: string | null;
  /** Which control draws it. */
  readonly control: PreferenceTextControl;
}

/**
 * The seven defaults of a draft, in option order, each with its control.
 *
 * @param draft - The draft.
 * @returns One entry per option.
 */
export function defaultControlsOf(draft: PreferencesDraft): readonly DefaultControlView[] {
  return BULK_OPTIONS.map((option) => ({
    option,
    label: bulkOptionField(option),
    value: draft.defaults[option],
    control: preferenceTextControlOf(draft.defaults[option])
  }));
} // End of function defaultControlsOf()

// ---------------------------------------------------------------------------
// What the control says
// ---------------------------------------------------------------------------

/**
 * The one sentence about how the preferences were read, or `null` for none.
 *
 * - `reading`: nothing has answered yet for this workspace;
 * - `status`: the sidecar was read with a status worth saying — every status but
 *   `Loaded`, whose sentence ("Preferences were read") says nothing a person
 *   needs; `Fresh` is said, because it explains why every field is empty;
 * - `readFailed`: the call itself failed, with its failure.
 */
export type PreferencesReadingLine =
  | { readonly kind: 'reading' }
  | { readonly kind: 'status'; readonly status: SidecarStatus }
  | { readonly kind: 'readFailed'; readonly failure: IpcFailure };

/**
 * What the control says about how the preferences were read.
 *
 * @param preferences - The preferences in effect.
 * @returns The line, or `null`.
 */
export function preferencesReadingLineOf(
  preferences: WorkspacePreferences
): PreferencesReadingLine | null {
  const reading = preferences.reading;
  switch (reading.kind) {
    case 'notRead':
      return { kind: 'reading' };
    case 'failed':
      return { kind: 'readFailed', failure: reading.failure };
    case 'read':
      return 'Loaded' in reading.status ? null : { kind: 'status', status: reading.status };
  }
} // End of function preferencesReadingLineOf()

/**
 * One sentence about the last preference save. Each arm is rendered by an
 * existing describer: `outcome` by `tSidecarUpdateOutcome`, `status` by
 * `tSidecarStatus`, `failure` by `tIpcFailure`, `withdrawn` by
 * `tWithdrawnPreferenceSave`, and `saving` by the control's own key.
 */
export type PreferenceSaveLine =
  | { readonly kind: 'saving' }
  | { readonly kind: 'outcome'; readonly outcome: SidecarUpdateOutcome }
  | { readonly kind: 'status'; readonly status: SidecarStatus }
  | { readonly kind: 'failure'; readonly failure: IpcFailure }
  | { readonly kind: 'withdrawn' };

/**
 * What the control says about the last preference save.
 *
 * A save refused as not writable says so **and** why (the sidecar's status); a
 * failed call says only its failure. Nothing is said before the first save.
 *
 * @param save - The window's preference-save state.
 * @returns The lines, in order; empty when there is nothing to say.
 */
export function preferenceSaveLinesOf(save: PreferenceSaveState): readonly PreferenceSaveLine[] {
  if (save.kind === 'idle') {
    return [];
  }
  if (save.kind === 'saving') {
    return [{ kind: 'saving' }];
  }
  const report = save.report;
  switch (report.kind) {
    case 'saved':
      return [{ kind: 'outcome', outcome: { Saved: {} } }];
    case 'unchanged':
      return [{ kind: 'outcome', outcome: { Unchanged: {} } }];
    case 'notWritable':
      return [
        { kind: 'outcome', outcome: { NotWritable: {} } },
        { kind: 'status', status: report.status }
      ];
    case 'writeFailed':
      return [{ kind: 'outcome', outcome: { WriteFailed: {} } }];
    case 'failed':
      return [{ kind: 'failure', failure: report.failure }];
    case 'withdrawn':
      return [{ kind: 'withdrawn' }];
  }
} // End of function preferenceSaveLinesOf()

// ---------------------------------------------------------------------------
// What the new-snippet form says about its seeding
// ---------------------------------------------------------------------------

/** What the new-snippet form says about the defaults it seeded. */
export interface SeedingNotice {
  /** The path of the file whose defaults were used. */
  readonly from: string;
  /** Options the seeding put into the draft (each may have been edited or removed since). */
  readonly seeded: readonly DetailFieldName[];
  /** Options that had a default but already held a value, which was kept. */
  readonly kept: readonly DetailFieldName[];
  /** Options whose default was not used, each with why. */
  readonly withheld: readonly WithheldDefault[];
}

/** One default the seeding did not use. */
export interface WithheldDefault {
  /** The option's label. */
  readonly label: DetailFieldName;
  /**
   * Why. `seedDefaults` in `./matchCreation.ts` withholds a default for one reason
   * only, a carriage return, and `CreationSeeding` does not carry it, so this
   * module names it; a second reason there would have to be carried here too.
   */
  readonly reason: DefaultRefusal;
}

/**
 * The seeding notice of one form, or `null` when nothing was seeded.
 *
 * The file is named by the path the form's own destination list carries; a
 * destination the form no longer lists (which no transition produces today)
 * gives no notice rather than an invented name.
 *
 * @param view - The form's view.
 * @returns The notice, or `null`.
 */
export function seedingNoticeOf(
  view: Pick<MatchCreationView, 'destinations' | 'seeding'>
): SeedingNotice | null {
  const seeding: CreationSeeding = view.seeding;
  if (seeding.kind !== 'seeded') {
    return null;
  }
  const source = view.destinations.find((one) => one.document === seeding.from);
  if (source === undefined) {
    return null;
  }
  return {
    from: source.path,
    seeded: seeding.seeded.map(bulkOptionField),
    kept: seeding.kept.map(bulkOptionField),
    withheld: seeding.withheld.map((option) => ({
      label: bulkOptionField(option),
      reason: 'carriageReturn' as const
    }))
  };
} // End of function seedingNoticeOf()
