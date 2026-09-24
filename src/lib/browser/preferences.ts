/**
 * The workspace's application preferences, as values — Phase 3-13-1.
 *
 * **No component and no screen**, as every model in this directory: this is what
 * the sidecar store of Phase 3-12 (`load_sidecar` / `update_sidecar`) means to the
 * window — display names, ordering and the seven per-file new-snippet defaults —
 * and the requests that change it. `./workspace.svelte.ts` holds the one live
 * {@link WorkspacePreferences}; `./matchCreation.ts` seeds a creation draft from a
 * {@link CreationDefaults} snapshot taken from it. 3-13-2 draws them.
 *
 * ## Display names (ruling 28, 3-12 notes §6 item 2)
 *
 * A display name is **user data, carried as written and never translated**, and
 * the real filename is always beside it: {@link fileLabelOf} answers the path in
 * both of its arms, so a screen that shows a name has the filename in the same
 * value and cannot draw one without being handed the other.
 *
 * - **Whitespace is kept.** A name with at least one non-whitespace character is
 *   stored and shown exactly as typed, leading and trailing spaces included —
 *   trimming would be this application deciding what the person meant.
 * - **An empty or whitespace-only name is no name.** {@link displayNameChanges}
 *   turns such a draft into `ClearDisplayName`, never `SetDisplayName("")`, and a
 *   stored name that is empty or whitespace-only (a hand edit, another build) is
 *   read as absent, so the row shows its filename rather than a blank label.
 * - **A name is one line.** A draft holding a line feed or a carriage return is
 *   refused with {@link DisplayNameRefusal} `lineBreak`: an `<input>` could not
 *   hold one (CLAUDE.md §6), and a row label that breaks would push the filename
 *   out of the place it is promised.
 *
 * ## Ordering (3-12 notes §6 item 3)
 *
 * `sortOrder` is a **rank, not a position**: {@link orderedDocuments} puts the
 * files that have one first, ascending; **ties** keep the workspace's own
 * (discovery) order; files with no rank follow, in the workspace's order. So a
 * **newly added file** — one with no entry — appears after every ranked file,
 * and no stored value ever needs rewriting because a file appeared or vanished.
 * {@link reorderRequests} writes a **dense** order (0, 1, 2, …) over the files it
 * is handed and asks only for the ranks that change. Because `update_sidecar`
 * names one file per request, a reordering of N files is up to N requests; a
 * sequence cut short leaves some old and some new ranks, which still sort
 * deterministically by the rule above. It never loses a file.
 *
 * ## Defaults (ruling 28, §5 row 8)
 *
 * The seven bulk-option fields ({@link BULK_OPTIONS}), each **optional text**: a
 * {@link FileDefaults} entry is `null` when the file has no default for that
 * option and a string — `''` included — when it has one. `''` and `null` are
 * different requests all the way to the YAML: an empty default seeds a key with
 * an empty value, an absent one seeds nothing. **Never a boolean**: nothing here
 * reads `'true'` as true, and a suggestion ({@link isSuggestedDefault}) is an
 * exact string compared with `===`.
 *
 * ## Codes, never sentences
 *
 * {@link displayNameRefusalKey} and {@link defaultRefusalKey} map this module's
 * two refusal codes to dictionary keys; `describeDisplayNameRefusal` /
 * `describeDefaultRefusal` in `../i18n/codes.ts` and their reactive wrappers in
 * `../i18n/index.ts` render them. How a preference save ended is
 * {@link PreferenceSaveReport}, rendered through the sidecar's own
 * `describeSidecarUpdateOutcome` / `describeSidecarStatus` and, for a failure of
 * the call, the ordinary IPC failure describer.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type { CommandResult } from '../ipc/commands';
import type { IpcFailure } from '../ipc/errors';
import type {
  BulkOption,
  DocumentId,
  DocumentSummary,
  SidecarChange,
  SidecarDefault,
  SidecarState,
  SidecarStatus,
  SidecarUpdateRequest,
  SidecarUpdateResult
} from '../ipc/types';
import { BULK_OPTIONS, bulkSuggestionsFor, isBulkOption } from './bulkEdit';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/**
 * One file's new-snippet defaults: each of the seven options' text, or `null`
 * when the file has none for it. `''` is an empty default, not an absent one.
 */
export type FileDefaults = Readonly<Record<BulkOption, string | null>>;

/**
 * A file with no defaults at all. Its keys are {@link BULK_OPTIONS}, in that
 * order, and the type makes a missing or an eighth key a compile error.
 */
export const NO_FILE_DEFAULTS: FileDefaults = Object.freeze({
  word: null,
  left_word: null,
  right_word: null,
  propagate_case: null,
  uppercase_style: null,
  force_mode: null,
  force_clipboard: null
});

/**
 * The defaults one sidecar entry holds, as a record.
 *
 * **Copied at ingress** (`CLAUDE.md` §6: a property read can run caller code), and
 * an entry naming anything but one of the seven is ignored rather than trusted —
 * Rust refuses such a file as corrupt, so this is a second line and nothing more.
 * A later entry for the same option wins, as `SidecarChange`s do.
 *
 * @param defaults - The entry's defaults, as they crossed the boundary.
 * @returns A frozen record with every option present.
 */
export function fileDefaultsOf(defaults: readonly SidecarDefault[]): FileDefaults {
  const record: Record<BulkOption, string | null> = { ...NO_FILE_DEFAULTS };
  for (const entry of defaults) {
    const option: unknown = entry.option;
    const value: unknown = entry.value;
    if (isBulkOption(option) && typeof value === 'string') {
      record[option] = value;
    }
  } // End of the loop over the entry's defaults
  return Object.freeze(record);
} // End of function fileDefaultsOf()

/**
 * The options one file has a default for, in {@link BULK_OPTIONS} order.
 *
 * @param defaults - The file's defaults.
 * @returns Every option whose default is present, `''` included.
 */
export function presentDefaults(defaults: FileDefaults): readonly BulkOption[] {
  return BULK_OPTIONS.filter((option) => defaults[option] !== null);
} // End of function presentDefaults()

/**
 * Whether a default's text is one of its option's suggestions — exactly.
 *
 * `===` and nothing else: `'True'` is not `'true'`, and neither is a boolean.
 *
 * @param option - The option.
 * @param value - The default's text.
 * @returns `true` only for an exact suggested string.
 */
export function isSuggestedDefault(option: BulkOption, value: string): boolean {
  return bulkSuggestionsFor(option).some((suggestion) => suggestion === value);
} // End of function isSuggestedDefault()

/**
 * Why a default cannot be saved or seeded.
 *
 * **One member**, `carriageReturn`: no text box in this window can hold one
 * (`CLAUDE.md` §6), so a default holding one could never be shown in the box it
 * would be seeded into. A code; {@link defaultRefusalKey} names its sentence.
 */
export type DefaultRefusal = 'carriageReturn';

/**
 * Why one default's text cannot be used, or `null` when it can.
 *
 * @param value - The text.
 * @returns The refusal, or `null`.
 */
export function defaultRefusal(value: string): DefaultRefusal | null {
  return value.includes('\r') ? 'carriageReturn' : null;
} // End of function defaultRefusal()

/**
 * The dictionary key holding one default refusal's sentence.
 *
 * @param reason - The refusal.
 * @returns Its key.
 */
export function defaultRefusalKey(reason: DefaultRefusal): TranslationKey {
  switch (reason) {
    case 'carriageReturn':
      return 'browser.sidecar.defaultRefusal.carriageReturn';
  }
} // End of function defaultRefusalKey()

/** What changing one file's defaults would ask, or why it cannot. */
export type DefaultChanges =
  | {
      /** The changes, in {@link BULK_OPTIONS} order; empty when nothing moves. */
      readonly kind: 'ready';
      /** `SetDefault` for a present value that differs, `ClearDefault` for one removed. */
      readonly changes: readonly SidecarChange[];
    }
  | {
      /** A drafted value cannot be stored. Nothing is sent. */
      readonly kind: 'refused';
      /** The first option refused, in option order. */
      readonly option: BulkOption;
      /** Why. */
      readonly reason: DefaultRefusal;
    };

/**
 * The sidecar changes that turn one file's defaults into another set.
 *
 * **Absent and empty stay apart**: `null → ''` is a `SetDefault` with `''`,
 * `'' → null` is a `ClearDefault`, and an unchanged value asks nothing.
 *
 * @param current - What the file's defaults are now.
 * @param next - What they should be.
 * @returns The changes, or the first refusal.
 */
export function defaultChanges(current: FileDefaults, next: FileDefaults): DefaultChanges {
  const changes: SidecarChange[] = [];
  for (const option of BULK_OPTIONS) {
    const wanted = next[option];
    if (wanted === current[option]) {
      continue;
    }
    if (wanted === null) {
      changes.push({ ClearDefault: { option } });
      continue;
    }
    const refusal = defaultRefusal(wanted);
    if (refusal !== null) {
      return { kind: 'refused', option, reason: refusal };
    }
    changes.push({ SetDefault: { option, value: wanted } });
  } // End of the loop over the seven options
  return { kind: 'ready', changes };
} // End of function defaultChanges()

// ---------------------------------------------------------------------------
// Display names
// ---------------------------------------------------------------------------

/**
 * Whether a name says nothing: empty, or whitespace only.
 *
 * @param name - The name, as written.
 * @returns `true` when it has no non-whitespace character.
 */
export function isBlankName(name: string): boolean {
  return name.trim() === '';
} // End of function isBlankName()

/** How one file is labelled. The real filename is in both arms. */
export type FileLabel =
  | {
      /** The file has no display name; the path is the label. */
      readonly kind: 'filename';
      /** Its path relative to the configuration root. */
      readonly path: string;
    }
  | {
      /** The file has a display name, shown beside its path. */
      readonly kind: 'displayName';
      /** The name, exactly as stored — user data, never translated. */
      readonly name: string;
      /** Its path relative to the configuration root, always shown too. */
      readonly path: string;
    };

/**
 * How one file is labelled under these preferences.
 *
 * @param preferences - The preferences in effect.
 * @param summary - The file, as the window lists it.
 * @returns The label; the path is in both arms.
 */
export function fileLabelOf(preferences: WorkspacePreferences, summary: DocumentSummary): FileLabel {
  const name = preferences.files.get(summary.id)?.displayName ?? null;
  const path = summary.relative_path;
  return name === null ? { kind: 'filename', path } : { kind: 'displayName', name, path };
} // End of function fileLabelOf()

/**
 * Why a drafted display name cannot be saved.
 *
 * **One member**, `lineBreak`. A code; {@link displayNameRefusalKey} names its
 * sentence. An empty name is not a refusal: it clears the name.
 */
export type DisplayNameRefusal = 'lineBreak';

/**
 * The dictionary key holding one display-name refusal's sentence.
 *
 * @param reason - The refusal.
 * @returns Its key.
 */
export function displayNameRefusalKey(reason: DisplayNameRefusal): TranslationKey {
  switch (reason) {
    case 'lineBreak':
      return 'browser.sidecar.displayNameRefusal.lineBreak';
  }
} // End of function displayNameRefusalKey()

/** What saving a drafted display name would ask, or why it cannot. */
export type DisplayNameChanges =
  | {
      /** One change: set the name as written, or clear it. */
      readonly kind: 'ready';
      /** The change. */
      readonly changes: readonly SidecarChange[];
    }
  | {
      /** The draft cannot be stored. Nothing is sent. */
      readonly kind: 'refused';
      /** Why. */
      readonly reason: DisplayNameRefusal;
    };

/**
 * The sidecar change a drafted display name asks for.
 *
 * A blank draft clears the name; any other is stored **as written**, whitespace
 * included; a line break is refused.
 *
 * @param draft - What the name control holds.
 * @returns The change, or the refusal.
 */
export function displayNameChanges(draft: string): DisplayNameChanges {
  if (draft.includes('\n') || draft.includes('\r')) {
    return { kind: 'refused', reason: 'lineBreak' };
  }
  return isBlankName(draft)
    ? { kind: 'ready', changes: [{ ClearDisplayName: {} }] }
    : { kind: 'ready', changes: [{ SetDisplayName: { name: draft } }] };
} // End of function displayNameChanges()

// ---------------------------------------------------------------------------
// The preferences in effect
// ---------------------------------------------------------------------------

/** One listed file's preferences, as the window reads them. */
export interface FilePreferences {
  /** The display name, or `null` — a stored blank name reads as `null`. */
  readonly displayName: string | null;
  /** The file's rank, or `null` when it has none. */
  readonly sortOrder: number | null;
  /** The file's seven defaults. */
  readonly defaults: FileDefaults;
}

/** A file with no preferences. */
export const NO_FILE_PREFERENCES: FilePreferences = Object.freeze({
  displayName: null,
  sortOrder: null,
  defaults: NO_FILE_DEFAULTS
});

/** How the preferences in effect were obtained. */
export type PreferencesReading =
  | {
      /** Nothing has been read for this workspace yet, or a read is in flight. */
      readonly kind: 'notRead';
    }
  | {
      /** `load_sidecar` or `update_sidecar` answered; `status` is how it read the file. */
      readonly kind: 'read';
      /** The sidecar's status — ruling 27's outcomes among them. */
      readonly status: SidecarStatus;
    }
  | {
      /** The call itself failed (`noWorkspaceOpen`, or an unexpected failure). */
      readonly kind: 'failed';
      /** The failure. */
      readonly failure: IpcFailure;
    };

/**
 * The preferences in effect for the open workspace.
 *
 * **Empty is always a legal value**: an absent, corrupt, newer-format,
 * unreadable or unreachable sidecar, and a call that failed, all leave `files`
 * empty, and everything that reads this — the creator's defaults above all —
 * treats empty as *no preferences*, never as an error.
 */
export interface WorkspacePreferences {
  /** How they were obtained. */
  readonly reading: PreferencesReading;
  /** Whether an update may write — Rust's `writable`, `false` until read. */
  readonly writable: boolean;
  /** Every listed file that has preferences. A file with no entry has none. */
  readonly files: ReadonlyMap<DocumentId, FilePreferences>;
  /** Entries kept for files the workspace no longer lists. */
  readonly retainedOrphans: number;
}

/** The preferences before anything was read, and after a workspace is replaced. */
export const NO_PREFERENCES: WorkspacePreferences = Object.freeze({
  reading: Object.freeze({ kind: 'notRead' as const }),
  writable: false,
  files: new Map<DocumentId, FilePreferences>(),
  retainedOrphans: 0
});

/**
 * The preferences a sidecar answer holds, copied and frozen.
 *
 * Every field is read once, here, into values this module built (`CLAUDE.md` §6).
 * A stored name that is blank becomes `null` (the display-name rule above).
 *
 * @param state - What `load_sidecar` answered, or an update's `state`.
 * @returns The preferences in effect.
 */
export function preferencesOf(state: SidecarState): WorkspacePreferences {
  const files = new Map<DocumentId, FilePreferences>();
  for (const entry of state.files) {
    const name: unknown = entry.display_name;
    const order: unknown = entry.sort_order;
    files.set(
      entry.document,
      Object.freeze({
        displayName: typeof name === 'string' && !isBlankName(name) ? name : null,
        sortOrder: typeof order === 'number' && Number.isInteger(order) ? order : null,
        defaults: fileDefaultsOf(entry.defaults)
      })
    );
  } // End of the loop over the answer's files
  return Object.freeze({
    reading: Object.freeze({ kind: 'read' as const, status: state.status }),
    writable: state.writable === true,
    files,
    retainedOrphans: state.retained_orphans
  });
} // End of function preferencesOf()

/**
 * The preferences in effect after the read itself failed: none, and not writable.
 *
 * @param failure - How the call failed.
 * @returns Empty preferences that say why.
 */
export function preferencesReadFailed(failure: IpcFailure): WorkspacePreferences {
  return Object.freeze({
    reading: Object.freeze({ kind: 'failed' as const, failure }),
    writable: false,
    files: new Map<DocumentId, FilePreferences>(),
    retainedOrphans: 0
  });
} // End of function preferencesReadFailed()

/**
 * One file's preferences, or none.
 *
 * @param preferences - The preferences in effect.
 * @param document - The file.
 * @returns Its preferences; {@link NO_FILE_PREFERENCES} when it has no entry.
 */
export function filePreferencesOf(
  preferences: WorkspacePreferences,
  document: DocumentId
): FilePreferences {
  return preferences.files.get(document) ?? NO_FILE_PREFERENCES;
} // End of function filePreferencesOf()

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

/**
 * The files in preference order: ranked ones first, ascending, ties in
 * workspace order; unranked ones after, in workspace order.
 *
 * @param documents - Every file the window lists, in workspace order.
 * @param preferences - The preferences in effect.
 * @returns A new array; the argument is untouched.
 */
export function orderedDocuments(
  documents: readonly DocumentSummary[],
  preferences: WorkspacePreferences
): readonly DocumentSummary[] {
  const indexed = documents.map((summary, index) => ({
    summary,
    index,
    rank: preferences.files.get(summary.id)?.sortOrder ?? null
  }));
  indexed.sort((left, right) => {
    if (left.rank !== null && right.rank !== null && left.rank !== right.rank) {
      return left.rank - right.rank;
    }
    if (left.rank === null && right.rank !== null) {
      return 1;
    }
    if (left.rank !== null && right.rank === null) {
      return -1;
    }
    return left.index - right.index;
  }); // End of the comparator that ranks the files
  return indexed.map((entry) => entry.summary);
} // End of function orderedDocuments()

/**
 * The requests that store an order densely: the first file handed ranks 0, the
 * next 1, and so on. Only a file whose rank changes is asked about.
 *
 * @param order - The files in the order wanted.
 * @param preferences - The preferences in effect.
 * @returns One request per file whose rank moves, in `order`'s order.
 */
export function reorderRequests(
  order: readonly DocumentId[],
  preferences: WorkspacePreferences
): readonly SidecarUpdateRequest[] {
  const requests: SidecarUpdateRequest[] = [];
  order.forEach((document, rank) => {
    if (filePreferencesOf(preferences, document).sortOrder !== rank) {
      requests.push({ document, changes: [{ SetSortOrder: { order: rank } }] });
    }
  });
  return requests;
} // End of function reorderRequests()

// ---------------------------------------------------------------------------
// What the creator is handed
// ---------------------------------------------------------------------------

/**
 * Every file's defaults, as a snapshot a creation form keeps.
 *
 * **A snapshot, not a view**: `./matchCreation.ts` takes one when a form opens
 * and never reads the live preferences again, so a later preference change does
 * not touch a form that is already open.
 */
export type CreationDefaults = ReadonlyMap<DocumentId, FileDefaults>;

/** No defaults for any file: what an absent or unreadable sidecar gives. */
export const NO_CREATION_DEFAULTS: CreationDefaults = new Map<DocumentId, FileDefaults>();

/**
 * The defaults a creation form opened now would seed from.
 *
 * @param preferences - The preferences in effect.
 * @returns A new map of every file that has at least one default.
 */
export function creationDefaultsOf(preferences: WorkspacePreferences): CreationDefaults {
  const snapshot = new Map<DocumentId, FileDefaults>();
  for (const [document, file] of preferences.files) {
    if (presentDefaults(file.defaults).length > 0) {
      snapshot.set(document, file.defaults);
    }
  } // End of the loop over the files with preferences
  return snapshot;
} // End of function creationDefaultsOf()

// ---------------------------------------------------------------------------
// How a save of preferences ended
// ---------------------------------------------------------------------------

/**
 * How one preference save ended — **a value, never a throw**.
 *
 * `saved` and `unchanged` are Rust's; `notWritable` carries the status that
 * refused it (ruling 27's *cannot save preferences*); `writeFailed` left the old
 * file in place; `failed` is the call itself failing; `withdrawn` was never
 * sent, because `open()` replaced the workspace while it waited its turn — a
 * `DocumentId` is session-local, so it might have named another file. None of
 * them touches a snippet or a creation form.
 */
export type PreferenceSaveReport =
  | { readonly kind: 'saved' }
  | { readonly kind: 'unchanged' }
  | {
      readonly kind: 'notWritable';
      /** Why the sidecar refused writes. */
      readonly status: SidecarStatus;
    }
  | { readonly kind: 'writeFailed' }
  | {
      readonly kind: 'failed';
      /** How the call failed. */
      readonly failure: IpcFailure;
    }
  | { readonly kind: 'withdrawn' };

/**
 * The dictionary key for a preference save that was never sent. The other arms
 * of {@link PreferenceSaveReport} are rendered by the sidecar's and the IPC
 * layer's own describers.
 *
 * @returns Its key.
 */
export function withdrawnPreferenceSaveKey(): TranslationKey {
  return 'browser.sidecar.saveWithdrawn';
} // End of function withdrawnPreferenceSaveKey()

/**
 * The report one `update_sidecar` answer gives.
 *
 * @param answer - The command's answer.
 * @returns The report.
 */
export function preferenceSaveReportOf(
  answer: CommandResult<SidecarUpdateResult>
): PreferenceSaveReport {
  if (!answer.ok) {
    return { kind: 'failed', failure: answer.failure };
  }
  const outcome = answer.value.outcome;
  if ('Saved' in outcome) {
    return { kind: 'saved' };
  }
  if ('Unchanged' in outcome) {
    return { kind: 'unchanged' };
  }
  if ('NotWritable' in outcome) {
    return { kind: 'notWritable', status: answer.value.state.status };
  }
  return { kind: 'writeFailed' };
} // End of function preferenceSaveReportOf()
