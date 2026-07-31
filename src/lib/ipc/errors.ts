/**
 * The one shape a failed command takes, and how to classify it.
 *
 * Plan section 9: *Rust returns error codes and structured data, never
 * user-facing prose.* This file is the frontend half of that contract. Every
 * member of {@link CommandError} is a stable machine `code` plus operands that
 * are numbers, paths and other codes — never a sentence, never an interpolated
 * message. The Rust `Display` impls exist for logs and are deliberately not on
 * the wire; `src-tauri/src/error.rs` has no `Display` impl at all, so there is
 * no rendering for a future maintainer to send by accident.
 *
 * Phase 1b-2b turns each {@link CommandErrorCode} into an English and a Spanish
 * sentence in `src/lib/i18n/{en,es}.json`, interpolating the operands through
 * the existing `{placeholder}` mechanism. Nothing in this file produces text.
 *
 * ## Why the code list is a value and not only a type
 *
 * {@link COMMAND_ERROR_CODES} is a runtime array because two checks need to
 * read it: {@link isCommandError}, which has to recognise a rejection that
 * arrives as untyped JSON, and `src-tauri/src/wire_contract.rs`, which reads
 * *this file* and fails `cargo test` when the Rust enum and this list disagree.
 * A type alone would be invisible to both.
 */

/**
 * Every code the Rust side may put in a rejection.
 *
 * This array is the **only** list of codes in the frontend, and Rust keeps no
 * list of its own: `CommandError::code()` in `src-tauri/src/error.rs` is the
 * single Rust-side spelling, and `wire_contract.rs` compares the codes those
 * variants produce against this array in both directions. A code here that Rust
 * never writes, and a code Rust writes that is missing here, both fail
 * `cargo test`.
 */
export const COMMAND_ERROR_CODES = [
  'noWorkspaceOpen',
  'configDirNotFound',
  'notADirectory',
  'io',
  'notUtf8',
  'unknownDocument',
  'identityWrongDocument',
  'identityStaleRevision',
  'identityNoSuchMatch'
] as const;

/** One of {@link COMMAND_ERROR_CODES}. */
export type CommandErrorCode = (typeof COMMAND_ERROR_CODES)[number];

/**
 * A command was called before a workspace was opened.
 *
 * Originates in the Tauri layer rather than in the core: it is the shape of the
 * session, not a property of any file.
 */
export interface NoWorkspaceOpenError {
  /** The discriminant. */
  readonly code: 'noWorkspaceOpen';
}

/** No candidate configuration directory existed. */
export interface ConfigDirNotFoundError {
  /** The discriminant. */
  readonly code: 'configDirNotFound';
  /** Candidate paths, in the order they were probed. */
  readonly candidates: readonly string[];
}

/** A path was supplied explicitly and is not a directory. */
export interface NotADirectoryError {
  /** The discriminant. */
  readonly code: 'notADirectory';
  /** The path that is not a directory. */
  readonly path: string;
}

/**
 * The filesystem refused a read.
 *
 * {@link IoError.kind} is the `std::io::ErrorKind` variant name — `NotFound`,
 * `PermissionDenied` and so on. That name *is* the code; the operating system's
 * own message is deliberately not sent, because it is prose in a language
 * nobody chose.
 */
export interface IoError {
  /** The discriminant. */
  readonly code: 'io';
  /** The path being read. */
  readonly path: string;
  /** The `std::io::ErrorKind` variant name. */
  readonly kind: string;
}

/** A file is not valid UTF-8, so it cannot be the YAML document it claims. */
export interface NotUtf8Error {
  /** The discriminant. */
  readonly code: 'notUtf8';
  /** The path that failed to decode. */
  readonly path: string;
  /** Byte offset of the first invalid sequence. */
  readonly offset: number;
}

/** No document of this session has that identity. */
export interface UnknownDocumentError {
  /** The discriminant. */
  readonly code: 'unknownDocument';
  /** The identity that was asked about. */
  readonly document: number;
}

/** A match identity names a different document from the one it was offered to. */
export interface IdentityWrongDocumentError {
  /** The discriminant. */
  readonly code: 'identityWrongDocument';
  /** The document that was asked. */
  readonly expected: number;
  /** The document the identity names. */
  readonly found: number;
}

/**
 * A match identity was minted from another parse of the same document.
 *
 * The refusal `PROGRESS.md` R27 exists for. It is **not** a lookup miss: the
 * node identifier is the parser's arena index, so resolving a stale identity
 * would select whatever now occupies that slot — for two equally shaped matches
 * that swapped places, the other match.
 *
 * It says that **the document moved on**, and nothing more. The match this
 * identity named may have been edited, moved or deleted by whatever changed the
 * bytes; re-resolution is required, and its answer may be "nothing". See
 * {@link identityRecovery}.
 */
export interface IdentityStaleRevisionError {
  /** The discriminant. */
  readonly code: 'identityStaleRevision';
  /** The revision the projection holds. */
  readonly expected: string;
  /** The revision the identity was minted from. */
  readonly found: string;
}

/** Document and revision agree, but no match of this projection is that node. */
export interface IdentityNoSuchMatchError {
  /** The discriminant. */
  readonly code: 'identityNoSuchMatch';
  /** The node the identity names. */
  readonly node: number;
}

/** Everything a read-only command may reject with. */
export type CommandError =
  | NoWorkspaceOpenError
  | ConfigDirNotFoundError
  | NotADirectoryError
  | IoError
  | NotUtf8Error
  | UnknownDocumentError
  | IdentityWrongDocumentError
  | IdentityStaleRevisionError
  | IdentityNoSuchMatchError;

/**
 * What a rejected command turned out to be.
 *
 * The second arm exists because not every IPC rejection comes from our code: a
 * capability denial, a malformed argument the command macro refused to
 * deserialize, or a panic all reject with something we did not write. Giving
 * those their own arm keeps them from being mistaken for a {@link CommandError}
 * — and keeps {@link CommandError}'s code list honest, because nothing invents
 * a code the Rust side cannot produce.
 */
export type IpcFailure =
  | { readonly kind: 'command'; readonly error: CommandError }
  | { readonly kind: 'unexpected'; readonly detail: string };

/** The three JSON shapes an operand of a {@link CommandError} can take. */
export type OperandShape = 'string' | 'number' | 'stringArray';

/**
 * The operands each code carries, and the JSON shape of each one.
 *
 * The runtime half of {@link CommandError}: TypeScript's interfaces above are
 * erased, so a guard that narrows to one of them has to check what they declare
 * against a value that arrived as untyped JSON. This table is that declaration
 * in a form the guard can read, and `src-tauri/src/wire_contract.rs` compares it
 * — names **and** shapes — against the JSON `serde` actually writes for every
 * variant of `CommandError`, so it cannot drift from the interfaces it mirrors.
 *
 * Surplus keys are deliberately not listed and deliberately allowed: a Rust
 * variant that gains a field must not stop being recognised. A *missing* or
 * wrongly shaped one is a different matter — that is a malformed rejection, and
 * narrowing it to a typed error is what the review of Phase 1b-2a found this
 * guard doing.
 */
export const COMMAND_ERROR_OPERANDS = {
  noWorkspaceOpen: {},
  configDirNotFound: { candidates: 'stringArray' },
  notADirectory: { path: 'string' },
  io: { path: 'string', kind: 'string' },
  notUtf8: { path: 'string', offset: 'number' },
  unknownDocument: { document: 'number' },
  identityWrongDocument: { expected: 'number', found: 'number' },
  identityStaleRevision: { expected: 'string', found: 'string' },
  identityNoSuchMatch: { node: 'number' }
} as const;

/**
 * Returns `true` when `value` has the declared shape of one operand.
 *
 * @param value - The operand as it arrived.
 * @param shape - The shape {@link COMMAND_ERROR_OPERANDS} declares for it.
 * @returns Whether the value matches that shape.
 */
function hasShape(value: unknown, shape: OperandShape): boolean {
  switch (shape) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'stringArray':
      return Array.isArray(value) && value.every((item) => typeof item === 'string');
  }
} // End of function hasShape()

/**
 * Returns `true` when a value is a {@link CommandError} this build understands.
 *
 * Checks the `code` **and** the operands that code declares in
 * {@link COMMAND_ERROR_OPERANDS}: present, and of the declared JSON shape.
 * Surplus properties are ignored, so a Rust variant that gains a field is still
 * recognised, but a missing or wrongly typed required operand is not.
 *
 * The earlier version checked the code alone, which made the `value is
 * CommandError` narrowing unsound: `{ code: 'identityStaleRevision' }` passed,
 * after which TypeScript treated `.expected` and `.found` as guaranteed strings
 * while both were `undefined`. A guard whose narrowing is a lie is worse than no
 * guard, because every caller downstream is written as though it were true.
 *
 * @param value - Anything a rejected `invoke` produced.
 * @returns Whether `value` is a well-formed {@link CommandError}.
 */
export function isCommandError(value: unknown): value is CommandError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const code: unknown = record.code;
  if (typeof code !== 'string' || !(COMMAND_ERROR_CODES as readonly string[]).includes(code)) {
    return false;
  }
  const operands: Readonly<Record<string, OperandShape>> =
    COMMAND_ERROR_OPERANDS[code as CommandErrorCode];
  return Object.entries(operands).every(([name, shape]) => hasShape(record[name], shape));
} // End of function isCommandError()

/**
 * Classifies whatever a rejected `invoke` threw.
 *
 * Never throws and never returns `undefined`: a caller that has to decide what
 * to render must always get an answer, and "we do not recognise this" is an
 * answer with its own arm rather than a `null` every call site would have to
 * remember to handle.
 *
 * The `detail` of an unexpected failure is a **developer** string for the
 * console. It must not be rendered: 1b-2b gives the unexpected arm one generic
 * dictionary key, exactly as it does for every other message.
 *
 * @param raw - The value a rejected `invoke` produced.
 * @returns The failure, classified.
 */
export function classifyFailure(raw: unknown): IpcFailure {
  if (isCommandError(raw)) {
    return { kind: 'command', error: raw };
  }
  if (typeof raw === 'string') {
    return { kind: 'unexpected', detail: raw };
  }
  if (raw instanceof Error) {
    return { kind: 'unexpected', detail: raw.message };
  }
  // `JSON.stringify` can return `undefined` (for a function, say) and can throw
  // on a cycle, so neither of its failure modes is allowed to reach the caller.
  try {
    return { kind: 'unexpected', detail: JSON.stringify(raw) ?? String(raw) };
  } catch {
    return { kind: 'unexpected', detail: String(raw) };
  }
} // End of function classifyFailure()

/**
 * What re-resolving a selection can turn out to have found.
 *
 * Every one of the three is reachable, and a caller that handles only the first
 * is the bug this union exists to make hard to write:
 *
 * - `sameMatch` — the match the selection meant is still there.
 * - `differentMatch` — something is at that position, and it is **not** what was
 *   selected. An external edit that deleted an earlier match produces exactly
 *   this, because a `DocumentPath` addresses a sequence *position*.
 * - `gone` — nothing is there any more.
 */
export type ReselectionOutcome = 'sameMatch' | 'differentMatch' | 'gone';

/**
 * What the selection should do about a failure.
 *
 * - `reresolve` — **the document moved on.** The held identity is scoped to a
 *   parse that no longer exists, so it must be resolved again; the arm carries
 *   {@link SelectionRecovery.mayFind}, which is every outcome that resolution
 *   can have. It does **not** mean the match still exists.
 * - `clearSelection` — the identity names something this projection does not
 *   have, and no re-resolution could find it.
 * - `none` — the failure says nothing about the selection.
 */
export type SelectionRecovery =
  | { readonly action: 'reresolve'; readonly mayFind: readonly ReselectionOutcome[] }
  | { readonly action: 'clearSelection' }
  | { readonly action: 'none' };

/**
 * What the holder of a match identity should do about a failed command.
 *
 * ## What `reresolve` does and does not promise
 *
 * A stale revision means the bytes changed. It does **not** mean the match
 * survived the change, and the first version of this function said it did: its
 * documentation told the caller to re-resolve by `DocumentPath` and keep the
 * selection, on the grounds that a `DocumentPath` is "the identity designed to
 * survive a reparse". It is not. `DocumentPath` is a list of `PathSegment`s and
 * a sequence step is `{ Index: number }` — a **position**. Delete the first
 * match of a file and `matches[1]` still resolves, to what used to be
 * `matches[2]`. Re-selecting through it would move the user's selection to a
 * different snippet without saying so.
 *
 * That is why the `reresolve` arm carries {@link ReselectionOutcome}s rather
 * than being a bare instruction: whatever wires this to selection state has to
 * decide what to do when re-resolution finds a *different* match, and when it
 * finds nothing, before it can compile.
 *
 * `an_identity_from_before_a_reordering_is_refused_rather_than_resolved` in
 * `crates/espansoconfig-core/tests/model_projection.rs` is the Rust side of the
 * same fact, and `a_document_path_is_positional_so_a_deletion_repoints_it` in
 * `src-tauri/src/commands.rs` is the counterexample this correction came from.
 *
 * **TODO (Phase 1c): wire this to selection state.** There is no selection in
 * the application yet, so this function classifies and returns rather than
 * acting. What it must not become is an `if (stale) forget()`: R27's whole
 * point is that a stale identity and a missing match call for different
 * behaviour, and this is where that distinction is written down.
 *
 * @param error - A classified command error.
 * @returns The recovery the holder of an identity should perform.
 */
export function identityRecovery(error: CommandError): SelectionRecovery {
  switch (error.code) {
    case 'identityStaleRevision':
      return { action: 'reresolve', mayFind: ['sameMatch', 'differentMatch', 'gone'] };
    case 'identityNoSuchMatch':
    case 'identityWrongDocument':
    case 'unknownDocument':
      return { action: 'clearSelection' };
    case 'noWorkspaceOpen':
    case 'configDirNotFound':
    case 'notADirectory':
    case 'io':
    case 'notUtf8':
      return { action: 'none' };
  }
  // Every member of CommandError has an arm above, so `error` is `never` here.
  // The assignment is the check: a variant added to CommandError with no arm
  // fails to compile rather than falling into a `default` that silently answers
  // "this failure says nothing about the selection".
  const unhandled: never = error;
  return unhandled;
} // End of function identityRecovery()
