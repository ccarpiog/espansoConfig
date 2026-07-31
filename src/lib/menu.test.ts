/**
 * The menu labels, and the link between them and the language picker.
 *
 * Three claims, and none of them is about what macOS draws:
 *
 * 1. every label the wire needs has a dictionary entry, in both languages;
 * 2. the two languages really are different, for every one of the sixteen —
 *    there is no exception list here, unlike the badge labels of
 *    `dictionaries.test.ts`;
 * 3. a language change produces a new label set, which is the claim that would
 *    otherwise rest on a Svelte `$effect` this suite cannot run at all.
 *
 * Per `docs/decisions/1b-2a-notes.md` section 14, an `it` callback whose sibling
 * argument is already its description carries no JSDoc of its own.
 */

import { describe, expect, it } from 'vitest';
import { DICTIONARIES, LOCALES, type Locale } from './i18n';
import type { IpcFailure } from './ipc/errors';
import { MENU_LABEL_FIELDS, type MenuLabels, type MenuResult } from './ipc/menu';
import { menuLabelKey, menuLabels, startMenuLocalization } from './menu';
import { createLocaleState, type LocaleStorage } from './stores/locale.svelte';

/**
 * A recorder standing in for the real `setMenuLabels` and `reportIpcFailure`.
 *
 * The `send` half answers whatever `outcome` says, so both arms of the result
 * can be driven; the `report` half records what reached it, which is the claim
 * Phase 1b-2b's review found unmade — `main.ts` dropped the promise, so nothing
 * ever reached a reporter at all.
 *
 * @param outcome - What every send should answer with.
 * @returns The two ports, plus the lists they filled.
 */
function recorder(outcome: MenuResult = { ok: true }): {
  send: (labels: MenuLabels) => Promise<MenuResult>;
  report: (failure: IpcFailure) => void;
  sent: MenuLabels[];
  reported: IpcFailure[];
} {
  const sent: MenuLabels[] = [];
  const reported: IpcFailure[] = [];
  return {
    send: (labels: MenuLabels): Promise<MenuResult> => {
      sent.push(labels);
      return Promise.resolve(outcome);
    },
    report: (failure: IpcFailure): void => {
      reported.push(failure);
    },
    sent,
    reported
  };
} // End of function recorder()

/**
 * An in-memory override store, so no test touches `localStorage`.
 *
 * @param initial - The value already persisted before the app started.
 * @returns A storage port over a private slot.
 */
function memoryStorage(initial: string | null = null): LocaleStorage {
  let value = initial;
  return {
    read: (): string | null => value,
    write: (next: string | null): void => {
      value = next;
    }
  };
} // End of function memoryStorage()

describe('menuLabelKey()', () => {
  it('names a real entry of both dictionaries for every label', () => {
    for (const field of MENU_LABEL_FIELDS) {
      const key = menuLabelKey(field);
      expect(key).toBe(`menu.${field}`);
      for (const locale of LOCALES) {
        expect(DICTIONARIES[locale][key], `${locale}:${key}`).toBeTypeOf('string');
        expect(DICTIONARIES[locale][key].trim(), `${locale}:${key}`).not.toBe('');
      }
    } // End of the loop over the label fields
  }); // End of the "names a real entry" case
}); // End of the "menuLabelKey()" suite

describe('menuLabels()', () => {
  it.each(LOCALES)('builds exactly the fields the wire declares in %s', (locale: Locale) => {
    const labels = menuLabels(locale);
    expect(Object.keys(labels).sort()).toEqual([...MENU_LABEL_FIELDS].sort());
  });

  it.each(LOCALES)('leaves no placeholder unsubstituted in %s', (locale: Locale) => {
    // `translate` deliberately leaves an unfilled `{placeholder}` visible, so
    // its absence here is what says every operand a label names was supplied.
    // A raw `{app}` in a menu item is the failure this catches.
    const labels = menuLabels(locale);
    for (const [field, label] of Object.entries(labels)) {
      expect(label.trim(), `${locale}:${field}`).not.toBe('');
      expect(label, `${locale}:${field}`).not.toMatch(/\{[A-Za-z]/);
      expect(label, `${locale}:${field}`).not.toContain('undefined');
    }
  }); // End of the "no placeholder unsubstituted" case

  it('puts the product name where each language puts it', () => {
    // The three labels macOS spells with the application's name. Spanish moves
    // it — "Salir de espansoConfig" — which is why the name is a placeholder in
    // the dictionary rather than something Rust concatenates.
    expect(menuLabels('en').quit).toBe('Quit espansoConfig');
    expect(menuLabels('es').quit).toBe('Salir de espansoConfig');
    expect(menuLabels('es').about).toContain('espansoConfig');
    expect(menuLabels('es').hide).toContain('espansoConfig');
  }); // End of the "product name" case

  it('translates every single label, with no exception list', () => {
    // The untranslated-value heuristic of `dictionaries.test.ts` allows eight
    // audited exceptions. The menu needs none, so the stronger claim is made
    // here: not one of the sixteen is byte-identical across the two languages.
    const english = menuLabels('en');
    const spanish = menuLabels('es');
    const identical = MENU_LABEL_FIELDS.filter((field) => english[field] === spanish[field]);
    expect(identical).toEqual([]);
  }); // End of the "translates every label" case
}); // End of the "menuLabels()" suite

describe('startMenuLocalization()', () => {
  it('sends the menu once before anything changes', () => {
    const state = createLocaleState(() => ['es-ES'], memoryStorage());
    const { send, report, sent } = recorder();
    const stop = startMenuLocalization(state, send, report);
    // Tauri installs its own English menu at startup, so the first send is not
    // an optimisation: without it a Spanish user keeps that menu until they
    // happen to change language.
    expect(sent).toHaveLength(1);
    expect(sent[0]?.quit).toBe('Salir de espansoConfig');
    stop();
    state.dispose();
  }); // End of the "sends the menu once" case

  it('sends it again, in the new language, when the user picks one', () => {
    const state = createLocaleState(() => ['en'], memoryStorage());
    const { send, report, sent } = recorder();
    const stop = startMenuLocalization(state, send, report);
    state.setOverride('es');
    expect(sent.map((labels) => labels.quit)).toEqual([
      'Quit espansoConfig',
      'Salir de espansoConfig'
    ]);
    stop();
    state.dispose();
  }); // End of the "sends it again" case

  it('stops sending once its return value is called', () => {
    const state = createLocaleState(() => ['en'], memoryStorage());
    const { send, report, sent } = recorder();
    const stop = startMenuLocalization(state, send, report);
    stop();
    state.setOverride('es');
    expect(sent).toHaveLength(1);
    state.dispose();
  }); // End of the "stops sending" case

  it('reports a rebuild that failed instead of dropping it', async () => {
    // **The review's third finding, second half.** `main.ts` discarded the
    // returned promise, so a `menuUnavailable` — and, before the untyped
    // envelope, a whole version skew — was classified and thrown away while
    // Tauri's English default menu stayed up. Nothing could have caught that,
    // because the consumption lived in the one file no test reaches.
    const failure: IpcFailure = {
      kind: 'command',
      error: { code: 'invalidMenuLabels', missing: ['quit'], unexpected: [] }
    };
    const state = createLocaleState(() => ['en'], memoryStorage());
    const { send, report, reported } = recorder({ ok: false, failure });
    const stop = startMenuLocalization(state, send, report);
    await Promise.resolve();
    expect(reported).toEqual([failure]);
    stop();
    state.dispose();
  }); // End of the "reports a rebuild that failed" case

  it('reports nothing when the rebuild succeeded', async () => {
    // The other side of the condition (R20): a reporter that fired on every
    // send would satisfy the case above while saying nothing at all.
    const state = createLocaleState(() => ['en'], memoryStorage());
    const { send, report, reported } = recorder({ ok: true });
    const stop = startMenuLocalization(state, send, report);
    state.setOverride('es');
    await Promise.resolve();
    expect(reported).toEqual([]);
    stop();
    state.dispose();
  }); // End of the "reports nothing when the rebuild succeeded" case
}); // End of the "startMenuLocalization()" suite
