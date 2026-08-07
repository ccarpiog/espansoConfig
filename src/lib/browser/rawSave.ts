/**
 * What the raw editor tells the user about replacing a whole file.
 *
 * The companion of `findings.ts` and `notices.ts`, and here for the same reason
 * both of those are: **no automated test in this repository renders a Svelte
 * component** (`docs/decisions/1c-1-notes.md` hole 1), so every decision about
 * what is said, and when, is made on this side of the boundary where a test can
 * reach it. The component gets the walk.
 *
 * ## The one thing this module exists to keep true
 *
 * `saveRawDocument` in `../ipc/commands` is the only writing command in this
 * application that is **not an edit**. The other four promise that every byte
 * outside the span they touched comes out identical; this one replaces the file
 * whole and promises only that the submitted bytes are the bytes committed.
 *
 * Design consult Q8 (`docs/reviews/phase-2b-2c-3-design.md`) rules that calling
 * the whole file "the edited span" would make the original guarantee vacuous, so
 * a raw save has to be **presented as replacing the entire document**. That is
 * why {@link describeRawSave} puts `replacesWholeDocument` first in every model
 * it builds, including the ones with nothing else to say: the statement is not a
 * warning attached to a problem, it is what this mode *is*.
 *
 * ## The owner's ruling, as a model rather than as a rule nobody can see
 *
 * A candidate text the YAML parser rejects is **written**, once the person says
 * so. The consult's original Q2 said the opposite and the owner reversed it: a
 * refusal would mean this application cannot repair a file that is already
 * broken, which is the most valuable thing a raw editor does. What the user is
 * owed instead is *"a sentence saying espanso will not load the file until it is
 * fixed, the parser's position if it has one, and the choice"* — never a blocked
 * save.
 *
 * All three are modelled here. The sentence is `willNotLoad`; the position is
 * `stoppedAt`, or `positionUnknown` when the parser reported none; and the
 * choice is {@link RawSaveModel.choices} together with
 * {@link RawSaveModel.acknowledgement}, which is exactly the value that makes
 * the same save proceed.
 *
 * ## Two things it deliberately does not render
 *
 * **The parser's own message.** `DocumentDoesNotParse.detail` comes from
 * `saphyr-parser` and cannot be localized (`2b-2c-3a-notes.md` hole 7.6). It is
 * carried on {@link UnparseableCandidate} so a developer surface can reach it,
 * and nothing here turns it into a user-facing line.
 *
 * **The byte offset.** `byte_index` counts **bytes**, and a JavaScript string
 * index counts UTF-16 code units; the two agree only for ASCII. Handing it to an
 * editor as a caret position would put the caret in the wrong place in exactly
 * the documents this application exists to handle carefully. It is carried and
 * not shown, for the same reason `documentText`'s own contract says never to cut
 * a `ByteSpan` out of a string on this side.
 */

import type { TranslationKey } from '../i18n/dictionaries';
import type { Acknowledgement, Finding, FindingCode, RefusedResult } from '../ipc/types';
import { draftKindWording, type ConflictDraftKind } from './draftKind';

/**
 * The operands `DocumentDoesNotParse` carries, derived from the wire type.
 *
 * Extracted rather than restated, so a phase that adds, removes or renames an
 * operand in `../ipc/types` breaks this file rather than leaving a second
 * declaration quietly describing the old shape.
 */
type DocumentDoesNotParseOperands = Extract<
  FindingCode,
  { readonly DocumentDoesNotParse: unknown }
>['DocumentDoesNotParse'];

/**
 * Where the parser stopped reading the submitted text.
 *
 * Present only when the parser reported a **position**; a syntax failure raised
 * inside this application's own span layer carries none, and that case is
 * {@link UnparseableCandidate.stop} being `null` rather than a line of zero.
 */
export interface ParserStop {
  /** The line the parser stopped at, as the parser counts lines. */
  readonly line: number;
  /** The column it stopped at, on the same terms. */
  readonly column: number;
  /**
   * The same position as a byte offset into the submitted text, when known.
   *
   * **Never a JavaScript string index.** Carried for a developer surface and
   * deliberately not rendered; see this module's own note.
   */
  readonly byteIndex: number | null;
}

/** The submitted text, and what the parser said about it. */
export interface UnparseableCandidate {
  /**
   * The finding whole, exactly as it arrived.
   *
   * What goes back in {@link RawSaveModel.acknowledgement}: the gate matches an
   * acknowledgement against the candidate's suspicions as an **exact multiset**,
   * and this finding is bound to the exact text it is about, so a copy rebuilt
   * from the fields below would acknowledge nothing.
   */
  readonly finding: Finding;
  /** Where the parser stopped, or `null` when it reported no position. */
  readonly stop: ParserStop | null;
  /**
   * The parser's own diagnostic, in its own language.
   *
   * **Not localizable and not for a screen.** It comes from `saphyr-parser`;
   * the sentence around it is translated and this fragment is not.
   */
  readonly detail: string;
}

/**
 * One line the raw editor shows, as a code rather than as a sentence.
 *
 * A code, never prose, for the reason every user-facing string in this project
 * is one (plan section 9 and CLAUDE.md section 2): the prose lives in
 * `src/lib/i18n/{en,es}.json`, where both languages are checked against each
 * other. A component renders one by calling `tRawSaveMessage`, never by building
 * a key.
 */
export type RawSaveMessage =
  | {
      /** Saving writes the file's whole text. Present in every model. */
      readonly kind: 'replacesWholeDocument';
    }
  | {
      /** espanso will not load the file until the text is fixed. */
      readonly kind: 'willNotLoad';
    }
  | {
      /** The parser stopped somewhere, and it said where. */
      readonly kind: 'stoppedAt';
      /** The line it stopped at. */
      readonly line: number;
      /** The column it stopped at. */
      readonly column: number;
    }
  | {
      /** The parser stopped, and reported no position at all. */
      readonly kind: 'positionUnknown';
    };

/**
 * What the person may do about a refused raw save.
 *
 * `saveAnyway` is offered **only** when acknowledging would really make the save
 * proceed — see {@link RawSaveModel.acknowledgement}. Offering it beside a
 * verdict no acknowledgement can move would be this application promising
 * something it will refuse.
 *
 * **`keepEditing` is the choice's stable name and not its label.** The two
 * labels are chosen by {@link rawSaveChoiceKey} from the surface's own
 * {@link ConflictDraftKind}: *Keep editing* where a person typed something, and
 * *Leave this as it is* on the mover, the deleter and the duplicator, where
 * nothing is being edited at all. This union is deliberately **not** widened to
 * a third member — a `keepOperation` value would make both arms nameable on
 * every surface, so each of the six components' exhaustive `switch`es would grow
 * an arm it can never reach.
 */
export type RawSaveChoice = 'saveAnyway' | 'keepEditing';

/** Everything the raw editor says about one save, and what it may do next. */
export interface RawSaveModel {
  /**
   * The lines to show, in order.
   *
   * Always begins with `replacesWholeDocument`, because that is what this mode
   * is rather than a warning about a problem it found.
   */
  readonly messages: readonly RawSaveMessage[];
  /** The parse rejection, when the candidate had one. */
  readonly unparseable: UnparseableCandidate | null;
  /**
   * Everything else the gate reported, in its own order.
   *
   * Rendered through the existing `tFindingCode` accessor: these are ordinary
   * findings and this module has nothing to add to them.
   */
  readonly otherFindings: readonly Finding[];
  /**
   * What the person may do **about a refusal**, in the order to offer it.
   *
   * Empty before a save has been refused: the editor's own save action is not
   * one of these, and putting it here would make the model's meaning depend on
   * which of two moments it was built in.
   */
  readonly choices: readonly RawSaveChoice[];
  /**
   * The value that makes this exact save proceed, or `null`.
   *
   * `null` when there is nothing to acknowledge, and — the case that matters —
   * when the verdict is one no acknowledgement can move: a finding of the
   * editor-model class refuses whatever the caller sends, so a "save anyway"
   * built on it would be an offer this application cannot keep.
   *
   * It holds **every** finding the refusal carried, because the gate matches the
   * multiset and a subset is simply a second refusal.
   *
   * It is `null` for exactly the models whose {@link RawSaveModel.choices} omit
   * `saveAnyway`, so a caller cannot route around a missing button.
   */
  readonly acknowledgement: Acknowledgement | null;
}

/** The model for a save nothing has been said about yet. */
const NOTHING_SAID: RawSaveModel = {
  messages: [{ kind: 'replacesWholeDocument' }],
  unparseable: null,
  otherFindings: [],
  choices: [],
  acknowledgement: null
};

/**
 * The `DocumentDoesNotParse` operands of one finding code, or `null`.
 *
 * The same shape as `hazardOf` in `findings.ts`, and for the same reason: the
 * boundary writes an externally tagged enum, so a variant with operands is a
 * single-key object and a variant without is a bare string.
 *
 * @param code - A finding code as it crossed the boundary.
 * @returns Its operands, or `null` for any other code.
 */
export function parseRejectionOf(code: FindingCode): DocumentDoesNotParseOperands | null {
  return typeof code === 'string' || !('DocumentDoesNotParse' in code)
    ? null
    : code.DocumentDoesNotParse;
} // End of function parseRejectionOf()

/**
 * Where the parser stopped, from the operands it reported.
 *
 * **"No position" is a case, not a formatting accident.** All three operands are
 * optional on the wire, because a syntax failure raised by this application's own
 * span layer is a defect in it rather than a property of the user's text — and
 * the user's bytes are never withheld over that. A stop is therefore reported
 * only when the parser gave both a line and a column; anything less is `null`,
 * which the model turns into its own sentence rather than into a half-filled one.
 *
 * @param operands - What `DocumentDoesNotParse` carried.
 * @returns The stop, or `null` when there was no position to report.
 */
export function parserStopOf(operands: DocumentDoesNotParseOperands): ParserStop | null {
  if (operands.line === null || operands.column === null) {
    return null;
  }
  return { line: operands.line, column: operands.column, byteIndex: operands.byte_index };
} // End of function parserStopOf()

/**
 * The value that would make a refused save proceed, or `null`.
 *
 * **The one place this decision is made.** It is not raw-specific — the gate's
 * rule is the same for a field save, a creation and a deletion — and it moved
 * here at Phase 2c-1a so that `saveOutcome.ts` could *use* it rather than restate
 * it. `describeRawSave` below calls it too, so the two cannot drift.
 *
 * Only one verdict can be moved by handing the findings back. The other says a
 * finding of the editor-model class refused, and no acknowledgement covers one.
 *
 * The emptiness half is defensive rather than reachable: the gate produces the
 * acknowledgeable verdict only when some suspicion went unacknowledged, so a
 * refusal carrying no findings at all cannot come from the core today. It is
 * checked because the alternative is offering a button whose only possible effect
 * is the same refusal again, which is a promise this application would not keep.
 *
 * It holds **every** finding the refusal carried, because the gate matches the
 * multiset and a subset is simply a second refusal.
 *
 * @param refusal - The `refused` outcome as it crossed the boundary.
 * @returns The acknowledgement to re-submit, or `null` when none would work.
 */
export function refusalAcknowledgement(refusal: RefusedResult): Acknowledgement | null {
  return refusal.verdict === 'RefusedForUnacknowledgedSuspicions' && refusal.findings.length > 0
    ? { accepted: [...refusal.findings] }
    : null;
} // End of function refusalAcknowledgement()

/**
 * What to offer about a refusal, given whether acknowledging would work.
 *
 * Derived from the acknowledgement rather than from the verdict a second time,
 * so `saveAnyway` is offered **exactly** when there is a value that makes the
 * save proceed and a caller cannot route around a missing button.
 *
 * @param acknowledgement - What {@link refusalAcknowledgement} answered.
 * @returns The choices, in the order to offer them.
 */
export function refusalChoices(
  acknowledgement: Acknowledgement | null
): readonly RawSaveChoice[] {
  return acknowledgement === null ? ['keepEditing'] : ['saveAnyway', 'keepEditing'];
} // End of function refusalChoices()

/**
 * Builds what the raw editor says about one save.
 *
 * @param refusal - The `refused` outcome the save came back with, or `null`
 *   before a save has been attempted — in which case the model is the one
 *   statement this mode always owes: it replaces the entire document.
 * @returns The lines, the parse rejection if there was one, the choices, and the
 *   acknowledgement that would make the same save proceed.
 */
export function describeRawSave(refusal: RefusedResult | null): RawSaveModel {
  if (refusal === null) {
    return NOTHING_SAID;
  }
  const messages: RawSaveMessage[] = [{ kind: 'replacesWholeDocument' }];
  let unparseable: UnparseableCandidate | null = null;
  const otherFindings: Finding[] = [];
  for (const finding of refusal.findings) {
    const operands = parseRejectionOf(finding.code);
    // A second parse rejection cannot happen — one candidate is parsed once — so
    // the first is kept and any other is carried as an ordinary finding rather
    // than dropped. Nothing this module does may lose a finding: the whole list
    // is what goes back in the acknowledgement.
    if (operands === null || unparseable !== null) {
      otherFindings.push(finding);
      continue;
    }
    unparseable = { finding, stop: parserStopOf(operands), detail: operands.detail };
  } // End of the loop over the findings the refusal carried
  if (unparseable !== null) {
    messages.push({ kind: 'willNotLoad' });
    messages.push(
      unparseable.stop === null
        ? { kind: 'positionUnknown' }
        : { kind: 'stoppedAt', line: unparseable.stop.line, column: unparseable.stop.column }
    );
  }
  // Whether handing the findings back would really work, and what to offer, are
  // one decision each and both live above — `saveOutcome.ts` asks the same two
  // questions about the same refusals.
  const acknowledgement = refusalAcknowledgement(refusal);
  return {
    messages,
    unparseable,
    otherFindings,
    choices: refusalChoices(acknowledgement),
    acknowledgement
  };
} // End of function describeRawSave()

/**
 * The dictionary key holding one message's sentence.
 *
 * A `switch` over literal keys rather than a template, on purpose: a template
 * would type-check against {@link TranslationKey} only by accident of its own
 * construction, and this way a renamed key is a compile error here.
 *
 * @param message - A line of the model.
 * @returns The key holding that line's sentence.
 */
export function rawSaveMessageKey(message: RawSaveMessage): TranslationKey {
  switch (message.kind) {
    case 'replacesWholeDocument':
      return 'browser.rawSave.replacesWholeDocument';
    case 'willNotLoad':
      return 'browser.rawSave.willNotLoad';
    case 'stoppedAt':
      return 'browser.rawSave.stoppedAt';
    case 'positionUnknown':
      return 'browser.rawSave.positionUnknown';
  }
} // End of function rawSaveMessageKey()

/**
 * The substitutions one message's sentence needs.
 *
 * @param message - A line of the model.
 * @returns The `{placeholder}` values, or `undefined` for a sentence with none.
 */
export function rawSaveMessageParams(
  message: RawSaveMessage
): { readonly line: number; readonly column: number } | undefined {
  return message.kind === 'stoppedAt'
    ? { line: message.line, column: message.column }
    : undefined;
} // End of function rawSaveMessageParams()

/**
 * The dictionary key holding one choice's label.
 *
 * **The draft kind is required, and the 2c-4a-3c review's Medium is why.** This
 * function returned `browser.rawSave.choice.keepEditing` unconditionally, so the
 * duplicator's *ordinary* first outcome — a byte-exact copy keeps its source's
 * trigger definition, the transaction says so with an acknowledgeable finding,
 * and the panel offers *Save anyway* beside a way out — drew *Keep editing* /
 * *Seguir editando* about a copy nobody typed. The mover and the deleter did the
 * same for any refusal carrying findings.
 *
 * **3c-3 deferred this deliberately and the review overruled the deferral, in
 * terms worth keeping.** The argument was that `rawSave.ts` is three sub-phases
 * older than the finding, that giving `refusalChoices` a draft kind is a
 * signature change, and that no window reading had ever drawn the arm. The
 * answer: *the age of `rawSave.ts` does not make its current output truthful, and
 * absence from a prior window transcript is a gap in evidence, not evidence that
 * a reachable label is correct*. The signature change landed on the **accessor**
 * rather than on the choice, so `refusalChoices` and every view that carries its
 * answer are untouched.
 *
 * `saveAnyway` does not branch: *Save anyway* is a claim about the save and not
 * about what the person was doing beforehand, and it reads the same on all six.
 *
 * @param choice - What the person may do.
 * @param draftKind - What the calling surface's retained draft is, from its own
 *   `CONFLICT_CAPABILITIES`.
 * @returns The key holding that choice's label.
 */
export function rawSaveChoiceKey(
  choice: RawSaveChoice,
  draftKind: ConflictDraftKind
): TranslationKey {
  switch (choice) {
    case 'saveAnyway':
      return 'browser.rawSave.choice.saveAnyway';
    case 'keepEditing':
      // The same pair `conflictChoiceKey` chooses between one arm along, chosen
      // by the same rule and in the same place: this is one sentence of the
      // application, not two that have to be kept in step.
      return draftKindWording(draftKind, {
        authoredText: 'browser.rawSave.choice.keepEditing',
        operationChoice: 'browser.saveOutcome.choice.keepOperation'
      });
  }
} // End of function rawSaveChoiceKey()
