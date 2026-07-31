/**
 * What a row shows, and where each part of it comes from.
 *
 * The badge assertions are the ones with teeth. A badge is computed in the core
 * from a key's presence or a `type` field's text, and D2u forbids deriving one
 * from a scalar's *value*. The frontend is where that would come back: a row
 * that has `content.html` in hand and wants an HTML badge can produce one in a
 * single line, and no Rust test would ever see it.
 *
 * So two fixtures below disagree with each other on purpose — a match whose
 * `html` field is set and whose badge list is empty, and a match with an `Html`
 * badge and no `html` field. Badge data wins in both. An implementation that
 * looked at the fields would fail one of them whichever way it leaned.
 */

import { describe, expect, it } from 'vitest';
import { makeMatch, scalarItem } from './fixtures';
import { badgesOf, labelText, matchKey, triggerLabel, valueScalar } from './labels';

describe('badges come from badge data', () => {
  it('shows exactly what the core computed', () => {
    const match = makeMatch({ badges: ['Form', 'Shell'] });
    expect(badgesOf(match)).toEqual(['Form', 'Shell']);
  });

  it('shows no badge for a field the core did not badge', () => {
    // `html` is set and `badges` is empty. A frontend deriving badges from
    // fields would answer `['Html']` here.
    const match = makeMatch({ html: '<p>hello</p>', contentKind: 'Html', badges: [] });
    expect(badgesOf(match)).toEqual([]);
  });

  it('shows a badge the core computed even with no field to see it in', () => {
    // The mirror image: the badge list says `Html` and no content field does.
    // A frontend deriving badges from fields would answer `[]` here.
    const match = makeMatch({ html: null, badges: ['Html'] });
    expect(badgesOf(match)).toEqual(['Html']);
  });

  it('does not reorder or deduplicate what arrived', () => {
    // The core sorts and deduplicates its own list, so a repeated badge can
    // only arrive from a core that changed its mind — and the frontend's job is
    // to show what arrived, not to tidy it. A list with no duplicate in it
    // tests only the ordering half of this name.
    const match = makeMatch({ badges: ['Variables', 'Form', 'Variables'] });
    expect(badgesOf(match)).toEqual(['Variables', 'Form', 'Variables']);
  });
}); // End of the "badges" suite

describe('the trigger a row shows', () => {
  it('is the single trigger, as source text', () => {
    expect(triggerLabel(makeMatch({ trigger: ':sig' }))).toEqual({ kind: 'text', text: ':sig' });
  });

  it('is the first entry of a triggers list when there is no single trigger', () => {
    const match = makeMatch({ trigger: null, triggers: [':one', ':two'], triggerKind: 'Multiple' });
    expect(triggerLabel(match)).toEqual({ kind: 'text', text: ':one' });
  });

  it('is the regex source when that is the only trigger form', () => {
    const match = makeMatch({ trigger: null, regex: 'gr[ae]y', triggerKind: 'Regex' });
    expect(triggerLabel(match)).toEqual({ kind: 'text', text: 'gr[ae]y' });
  });

  it('is a code, not an empty string, when the match has no trigger', () => {
    const match = makeMatch({ trigger: null, triggerKind: 'Absent' });
    expect(triggerLabel(match)).toEqual({ kind: 'code', code: 'Absent' });
  });

  it('renders text that looks like a YAML value as that text (D2u)', () => {
    // `on` resolves to `true` under YAML 1.1. Nothing here resolves it, and a
    // trigger of `on` is shown as the two characters the file holds.
    expect(triggerLabel(makeMatch({ trigger: 'on' }))).toEqual({ kind: 'text', text: 'on' });
  });
}); // End of the "trigger" suite

describe('the label a row shows', () => {
  it('is the source text when there is one', () => {
    expect(labelText(makeMatch({ label: 'Signature' }))).toBe('Signature');
  });

  it('is null rather than an invented placeholder', () => {
    expect(labelText(makeMatch({ label: null }))).toBeNull();
  });
}); // End of the "label" suite

describe('supporting projections', () => {
  it('reads a scalar out of a projected value and refuses anything else', () => {
    expect(valueScalar(scalarItem('one'))?.text).toBe('one');
    expect(valueScalar({ Sequence: [] })).toBeNull();
    expect(valueScalar({ Mapping: [] })).toBeNull();
  });

  it('keys a row by document, revision and node', () => {
    const key = matchKey({ document: 2, revision: 'rev-b', node: 7 });
    expect(key).toBe('2:rev-b:7');
    expect(matchKey({ document: 2, revision: 'rev-c', node: 7 })).not.toBe(key);
  });
}); // End of the "supporting projections" suite
