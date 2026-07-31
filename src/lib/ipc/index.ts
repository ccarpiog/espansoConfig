/**
 * The typed IPC boundary, in one import.
 *
 * Components import from here rather than from `@tauri-apps/api/core`, so that
 * `invoke` is called in exactly one file (`commands.ts`) and every value that
 * crosses the boundary has a type that was checked against what Rust actually
 * writes.
 */

export {
  COMMAND_NAMES,
  getDocument,
  getMatch,
  listDocuments,
  openWorkspace,
  reloadDocument
} from './commands';
export type { CommandName, CommandResult } from './commands';

export {
  COMMAND_ERROR_CODES,
  COMMAND_ERROR_OPERANDS,
  classifyFailure,
  identityRecovery,
  isCommandError
} from './errors';
export type {
  CommandError,
  CommandErrorCode,
  ConfigDirNotFoundError,
  IdentityNoSuchMatchError,
  IdentityStaleRevisionError,
  IdentityWrongDocumentError,
  IoError,
  IpcFailure,
  NoWorkspaceOpenError,
  NotADirectoryError,
  NotUtf8Error,
  OperandShape,
  ReselectionOutcome,
  SelectionRecovery,
  UnknownDocumentError
} from './errors';

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
