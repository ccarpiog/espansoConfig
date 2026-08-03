/**
 * What the browser tells the user about a selection that outlived its document.
 *
 * A notice is a **code**, never a sentence, for the same reason a Rust error is
 * (plan section 9): the prose belongs in `src/lib/i18n/{en,es}.json`, where both
 * languages are checked against each other. {@link selectionNoticeKey} is the
 * one place a code becomes a key, and its `switch` is exhaustive, so a further
 * notice with no key fails `npm run check` in this file rather than rendering
 * nothing on a screen.
 *
 * **A component does not call it.** It calls `tSelectionNotice` in `../i18n`,
 * which is the reactive accessor over this function. `DetailPane` used to write
 * `t(selectionNoticeKey(notice))`, which is a component turning a code into a
 * key — the thing CLAUDE.md section 2 forbids, and the thing
 * `scripts/lint/built-translation-keys.ts` now refuses on every component.
 *
 * The first four are R27's three answers plus the case where nothing could be
 * asked: re-resolution needs the document read again, and that read can itself
 * fail. The fifth is 2c-3a's, and it is the only one that is not about a
 * document moving on **under** the person.
 */

import type { TranslationKey } from '../i18n/dictionaries';

/**
 * What happened to the selection when its document moved on.
 *
 * - `kept` — re-resolution found the same snippet, under a fresh identity.
 * - `differentMatch` — that position now holds a **different** snippet. The
 *   selection was dropped rather than moved, because moving it silently is what
 *   R27's correction is about.
 * - `gone` — nothing is there any more.
 * - `unresolved` — the document could not be read again, so which of the three
 *   it is cannot be known.
 * - `deleted` — the selected snippet was deleted **because the person asked for
 *   it**, and the window has read the file again and selected whatever now sits
 *   where it was, or nothing when the file holds none. That is what makes it a
 *   fifth arm rather than `differentMatch`: R27's correction is about a file that
 *   changed underneath somebody, and this is a change they made.
 */
export type SelectionNotice = 'kept' | 'differentMatch' | 'gone' | 'unresolved' | 'deleted';

/**
 * The dictionary key holding one notice's sentence.
 *
 * Written as a `switch` over literal keys rather than as a template, on
 * purpose: a template would type-check against `TranslationKey` only by
 * accident of its own construction, and this way a renamed key is a compile
 * error here.
 *
 * @param notice - What happened to the selection.
 * @returns The key holding that notice's message.
 */
export function selectionNoticeKey(notice: SelectionNotice): TranslationKey {
  switch (notice) {
    case 'kept':
      return 'browser.notice.kept';
    case 'differentMatch':
      return 'browser.notice.differentMatch';
    case 'gone':
      return 'browser.notice.gone';
    case 'unresolved':
      return 'browser.notice.unresolved';
    case 'deleted':
      return 'browser.notice.deleted';
  }
} // End of function selectionNoticeKey()
