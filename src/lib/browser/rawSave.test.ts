/**
 * What the raw editor says about replacing a whole file, and when.
 *
 * Three groups of claim, and each is one the type system has no opinion about:
 *
 * 1. **The statement this mode always owes.** Design consult Q8 rules that a raw
 *    save must be presented as *replacing the entire document* rather than as an
 *    edit. A model that only produced that line when something went wrong would
 *    compile, type-check and quietly present a whole-file rewrite as a change to
 *    one snippet — so what is pinned here is that the line comes first in every
 *    model, including the one built before any save has been attempted.
 * 2. **The owner's ruling, as three separate things.** *A sentence saying espanso
 *    will not load the file until it is fixed, the parser's position if it has
 *    one, and the choice.* "If it has one" is a case rather than a formatting
 *    accident, and the tests below drive both sides of it.
 * 3. **The choice is only offered when it can be kept.** A verdict no
 *    acknowledgement can move must not come with a "save anyway" button, and the
 *    model refuses to build the acknowledgement for it either.
 *
 * The sentences themselves are checked the way `notices.test.ts` checks its own:
 * which key each code maps to, that both languages read as sentences, and that
 * they really differ from each other.
 */

import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../i18n/dictionaries';
import { LOCALES } from '../i18n/locale';
import { placeholdersOf } from '../i18n/dictionaries';
import type { Finding, FindingCode, RefusedResult } from '../ipc/types';
import type { ConflictDraftKind } from './draftKind';
import {
  describeRawSave,
  parseRejectionOf,
  parserStopOf,
  rawSaveChoiceKey,
  rawSaveMessageKey,
  rawSaveMessageParams,
  type RawSaveChoice,
  type RawSaveMessage
} from './rawSave';

/** A revision, in the 64 hex characters the wire uses. */
const REVISION = 'c'.repeat(64);

/**
 * A parse rejection as the boundary writes one.
 *
 * @param overrides - The operands to change; every one is optional on the wire.
 * @returns The finding, with no span, node or path — a rejection is a position,
 *   not a range of bytes.
 */
function rejection(
  overrides: Partial<{
    line: number | null;
    column: number | null;
    byte_index: number | null;
    detail: string;
  }> = {}
): Finding {
  const code: FindingCode = {
    DocumentDoesNotParse: {
      revision: REVISION,
      line: 1,
      column: 15,
      byte_index: 15,
      detail: 'mapping values are not allowed in this context',
      ...overrides
    }
  };
  return { code, span: null, node: null, path: null };
} // End of function rejection()

/** A finding the semantic rules raise, for the "everything else" list. */
const ORDINARY: Finding = {
  code: { ReferenceHasNoDeclaration: { name: 'who' } },
  span: null,
  node: null,
  path: null
};

/**
 * A refusal carrying the findings given.
 *
 * @param findings - What the gate reported.
 * @param verdict - Which arm refused; the acknowledgeable one by default.
 * @returns The `refused` outcome as it crosses the boundary.
 */
function refusedWith(
  findings: readonly Finding[],
  verdict: RefusedResult['verdict'] = 'RefusedForUnacknowledgedSuspicions'
): RefusedResult {
  return { outcome: 'refused', verdict, findings };
}

describe('what a raw save always says', () => {
  it('leads with "this replaces the entire document", before any save is attempted', () => {
    // Q8 as a test rather than as a paragraph: the statement is what this mode
    // *is*, not a warning attached to a problem it found.
    const model = describeRawSave(null);
    expect(model.messages).toEqual([{ kind: 'replacesWholeDocument' }]);
    expect(model.unparseable).toBeNull();
    expect(model.otherFindings).toEqual([]);
    expect(model.choices).toEqual([]);
    expect(model.acknowledgement).toBeNull();
  });

  it('leads with it again when the save was refused, rather than only warning', () => {
    const model = describeRawSave(refusedWith([rejection()]));
    expect(model.messages[0]).toEqual({ kind: 'replacesWholeDocument' });
  });
}); // End of the "what a raw save always says" suite

describe('a candidate the YAML reader rejects', () => {
  it('says espanso will not load the file, and where the reader stopped', () => {
    // The owner's ruling, in the order the user reads it.
    const model = describeRawSave(refusedWith([rejection()]));
    expect(model.messages).toEqual([
      { kind: 'replacesWholeDocument' },
      { kind: 'willNotLoad' },
      { kind: 'stoppedAt', line: 1, column: 15 }
    ]);
    expect(model.unparseable?.stop).toEqual({ line: 1, column: 15, byteIndex: 15 });
  });

  it('treats "no position" as its own case rather than as a half-filled sentence', () => {
    // All three operands are optional, because a syntax failure raised inside
    // this application's own span layer is a defect in it rather than a property
    // of the user's text — and the bytes are never withheld over that. A model
    // that formatted `null` into the position sentence would say "line null".
    const model = describeRawSave(
      refusedWith([rejection({ line: null, column: null, byte_index: null })])
    );
    expect(model.messages).toEqual([
      { kind: 'replacesWholeDocument' },
      { kind: 'willNotLoad' },
      { kind: 'positionUnknown' }
    ]);
    expect(model.unparseable?.stop).toBeNull();
  });

  it('reports no position when the reader gave a line but no column', () => {
    // Half a position is not a position. The wire allows it because each operand
    // is independently optional, and rendering "line 4, column null" would be
    // worse than saying nothing.
    expect(parserStopOf({ revision: REVISION, line: 4, column: null, byte_index: 9, detail: '' })).toBeNull();
  });

  it('keeps the byte offset without rendering it', () => {
    // A byte offset is not a JavaScript string index, and handing one to an
    // editor as a caret position puts the caret in the wrong place in exactly the
    // documents this application exists to handle carefully. It is carried for a
    // developer surface; no message names it.
    const model = describeRawSave(refusedWith([rejection({ byte_index: 42 })]));
    expect(model.unparseable?.stop?.byteIndex).toBe(42);
    for (const message of model.messages) {
      expect(JSON.stringify(message)).not.toContain('42');
    }
  });

  it('keeps the reader’s own message off every sentence it builds', () => {
    // `detail` comes from `saphyr-parser` and cannot be localized. It is carried
    // so a developer surface can reach it, and the localized sentence is the one
    // *around* it.
    const model = describeRawSave(refusedWith([rejection({ detail: 'while parsing a block node' })]));
    expect(model.unparseable?.detail).toBe('while parsing a block node');
    expect(JSON.stringify(model.messages)).not.toContain('while parsing');
  });

  it('hands the finding back whole, because the gate matches it by content', () => {
    // Not a copy rebuilt from the fields above: the finding is bound to the exact
    // text it is about by its `revision` operand, and the gate matches the
    // candidate's suspicions as an exact multiset.
    const finding = rejection();
    const model = describeRawSave(refusedWith([finding, ORDINARY]));
    expect(model.unparseable?.finding).toBe(finding);
    expect(model.acknowledgement).toEqual({ accepted: [finding, ORDINARY] });
  });

  it('carries every other finding rather than dropping it', () => {
    const model = describeRawSave(refusedWith([ORDINARY, rejection()]));
    expect(model.otherFindings).toEqual([ORDINARY]);
    expect(model.unparseable).not.toBeNull();
  });

  it('answers null for a code that is not a parse rejection', () => {
    expect(parseRejectionOf(ORDINARY.code)).toBeNull();
    expect(parseRejectionOf('MatchHasNoContentField')).toBeNull();
  });
}); // End of the "candidate the YAML reader rejects" suite

describe('the choice', () => {
  it('offers "save anyway" when handing the findings back would really work', () => {
    const model = describeRawSave(refusedWith([rejection()]));
    expect(model.choices).toEqual(['saveAnyway', 'keepEditing']);
    expect(model.acknowledgement).not.toBeNull();
  });

  it('withholds it from a refusal that carries nothing to acknowledge', () => {
    // Defensive rather than reachable — the gate cannot produce this verdict with
    // no findings — and checked because the alternative is a button whose only
    // possible effect is the same refusal again.
    const model = describeRawSave(refusedWith([]));
    expect(model.choices).toEqual(['keepEditing']);
    expect(model.acknowledgement).toBeNull();
  });

  it('withholds it from a verdict no acknowledgement can move', () => {
    // A finding of the editor-model class refuses whatever the caller sends, so
    // an offer to save anyway would be one this application cannot keep — and
    // the acknowledgement is withheld too, so a caller cannot route around the
    // missing button.
    const model = describeRawSave(refusedWith([ORDINARY], 'RefusedForEditorModelErrors'));
    expect(model.choices).toEqual(['keepEditing']);
    expect(model.acknowledgement).toBeNull();
  });
}); // End of the "choice" suite

describe('the sentences behind the model', () => {
  /** Every message the model can build, one of each kind. */
  const MESSAGES: readonly RawSaveMessage[] = [
    { kind: 'replacesWholeDocument' },
    { kind: 'willNotLoad' },
    { kind: 'stoppedAt', line: 3, column: 7 },
    { kind: 'positionUnknown' }
  ];

  /** Every choice the model can offer. */
  const CHOICES: readonly RawSaveChoice[] = ['saveAnyway', 'keepEditing'];

  /** Both draft kinds, so nothing below is checked on one surface's half only. */
  const KINDS: readonly ConflictDraftKind[] = ['authoredText', 'operationChoice'];

  /** The key each message must map to, written out rather than derived. */
  const EXPECTED_KEYS: ReadonlyMap<RawSaveMessage['kind'], string> = new Map([
    ['replacesWholeDocument', 'browser.rawSave.replacesWholeDocument'],
    ['willNotLoad', 'browser.rawSave.willNotLoad'],
    ['stoppedAt', 'browser.rawSave.stoppedAt'],
    ['positionUnknown', 'browser.rawSave.positionUnknown']
  ] as const);

  it('map to the key that names them, so two cannot be swapped', () => {
    for (const message of MESSAGES) {
      expect(rawSaveMessageKey(message), message.kind).toBe(EXPECTED_KEYS.get(message.kind));
    }
    // *Save anyway* is a claim about the save, so it reads the same on all six
    // surfaces and does not branch.
    for (const kind of KINDS) {
      expect(rawSaveChoiceKey('saveAnyway', kind), kind).toBe('browser.rawSave.choice.saveAnyway');
    }
    // **The 2c-4a-3c review's Medium.** The way out of a refusal named an
    // activity nobody started on the mover, the deleter and the duplicator.
    expect(rawSaveChoiceKey('keepEditing', 'authoredText')).toBe(
      'browser.rawSave.choice.keepEditing'
    );
    expect(rawSaveChoiceKey('keepEditing', 'operationChoice')).toBe(
      'browser.saveOutcome.choice.keepOperation'
    );
  });

  it('labels a refusal by what the surface drafts, and never as editing', () => {
    // A word check rather than a meaning check, and the suite says so: what it
    // holds is that the two keys are different, that each kind reaches its own,
    // and that the operation label carries no word from *editing* — with the
    // authored-text label asserted to carry one, so the check is falsifiable
    // rather than vacuous. Reverting `rawSaveChoiceKey`'s branch fails it.
    const editing = { en: /edit/iu, es: /edit/iu } as const;
    for (const locale of LOCALES) {
      const authored = DICTIONARIES[locale][rawSaveChoiceKey('keepEditing', 'authoredText')];
      const operation = DICTIONARIES[locale][rawSaveChoiceKey('keepEditing', 'operationChoice')];
      expect(editing[locale].test(authored), `${locale}:authoredText`).toBe(true);
      expect(editing[locale].test(operation), `${locale}:operationChoice`).toBe(false);
      expect(operation, locale).not.toBe(authored);
    }
  }); // End of the "no editing label on an operation surface" case

  it.each(LOCALES)('all read as a sentence in %s', (locale) => {
    for (const message of MESSAGES) {
      const value = DICTIONARIES[locale][rawSaveMessageKey(message)];
      expect(value.trim().split(/\s+/u).length, `${locale}:${message.kind}`).toBeGreaterThan(4);
      expect(value.trim().endsWith('.'), `${locale}:${message.kind}`).toBe(true);
    }
    // A choice is a button label rather than a sentence, so it is checked the
    // other way round: short, and never punctuated like a sentence.
    for (const choice of CHOICES) {
      // Both kinds, so an operation surface's label is held to the same shape.
      for (const kind of KINDS) {
        const value = DICTIONARIES[locale][rawSaveChoiceKey(choice, kind)];
        expect(value.trim(), `${locale}:${choice}:${kind}`).not.toBe('');
        expect(value.trim().endsWith('.'), `${locale}:${choice}:${kind}`).toBe(false);
      } // End of the loop over the two draft kinds
    }
  });

  it('are translated, and no two of them read the same', () => {
    const keys = [
      ...MESSAGES.map(rawSaveMessageKey),
      // `saveAnyway` gives one key for both kinds, so the set is deduplicated
      // before it is counted.
      ...new Set(CHOICES.flatMap((choice) => KINDS.map((kind) => rawSaveChoiceKey(choice, kind))))
    ];
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(DICTIONARIES.es[key], key).not.toBe(DICTIONARIES.en[key]);
    }
    for (const locale of LOCALES) {
      const rendered = new Set(keys.map((key) => DICTIONARIES[locale][key]));
      expect(rendered.size, locale).toBe(keys.length);
    }
  }); // End of the "are translated" case

  it('substitute the position, and only into the sentence that has one', () => {
    // The placeholder half: a sentence that names `{line}` with nothing to put
    // there would reach a screen with the token in it, and one that carried a
    // position it does not name would silently drop it.
    expect(rawSaveMessageParams({ kind: 'stoppedAt', line: 3, column: 7 })).toEqual({
      line: 3,
      column: 7
    });
    for (const message of MESSAGES) {
      const named = placeholdersOf(DICTIONARIES.en[rawSaveMessageKey(message)]).sort();
      const supplied = Object.keys(rawSaveMessageParams(message) ?? {}).sort();
      expect(supplied, message.kind).toEqual(named);
    }
  }); // End of the "substitute the position" case
}); // End of the "sentences behind the model" suite
