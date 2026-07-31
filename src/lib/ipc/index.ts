/**
 * The typed IPC boundary, in one import.
 *
 * Components import from here rather than from `@tauri-apps/api/core`, so that
 * `invoke` is called in exactly two files — `commands.ts` for everything the
 * interface reads, and `menu.ts` for the one command that carries strings the
 * other way — and every value that crosses the boundary has a type that was
 * checked against what Rust actually writes.
 */

export {
  COMMAND_NAMES,
  documentText,
  getDocument,
  getMatch,
  listDocuments,
  openWorkspace,
  reloadDocument
} from './commands';
export type { CommandName, CommandResult } from './commands';

// `developerDetail` is deliberately **not** re-exported. It is the one value on
// this boundary that must never reach a screen, and a barrel export is an
// invitation; a caller that genuinely needs it for a console can import it from
// `./errors` by name and will be reported by `scripts/lint/ipc-detail.ts` for
// doing so. `reportIpcFailure` is the sanctioned destination and is exported.
export {
  COMMAND_ERROR_CODES,
  COMMAND_ERROR_OPERANDS,
  classifyFailure,
  identityRecovery,
  isCommandError,
  reportIpcFailure
} from './errors';
export type {
  CommandError,
  CommandErrorCode,
  ConfigDirNotFoundError,
  IdentityNoSuchMatchError,
  IdentityStaleRevisionError,
  IdentityWrongDocumentError,
  InvalidMenuLabelsError,
  IoError,
  IpcFailure,
  MenuBuildFailedError,
  MenuUnavailableError,
  NoWorkspaceOpenError,
  NotADirectoryError,
  NotUtf8Error,
  OperandShape,
  ReselectionOutcome,
  SelectionRecovery,
  UnexpectedFailure,
  UnknownDocumentError
} from './errors';

export { MENU_COMMAND_NAMES, MENU_LABEL_FIELDS, setMenuLabels } from './menu';
export type { MenuLabelField, MenuLabels, MenuResult } from './menu';

export { diagnosticCodeName, diagnosticCodeOperands, unknownReasonName } from './types';
export type {
  AliasView,
  ByteSpan,
  ConfigProfileView,
  ContentKind,
  ContentSpec,
  ContentRevision,
  Diagnostic,
  DiagnosticCode,
  DiagnosticCodeName,
  DocumentId,
  DocumentPath,
  DocumentShape,
  DocumentSummary,
  DocumentView,
  ElidedValue,
  FieldView,
  FileKind,
  HazardKind,
  LineEnding,
  MappingCoverage,
  MatchBadge,
  MatchId,
  MatchOptions,
  MatchView,
  NodeId,
  PathSegment,
  ScalarStyle,
  ScalarView,
  TriggerKind,
  TriggerSpec,
  UnknownEntry,
  UnknownReason,
  UnknownReasonName,
  ValueKind,
  ValueView,
  VariableKind,
  VariableView,
  WorkspaceSummary
} from './types';
