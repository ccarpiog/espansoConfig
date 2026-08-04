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
 * fail. The fifth is 2c-3a's, and the last two are 2c-3b's; those three are
 * the only ones that are not about a document moving on **under** the person —
 * they describe a change the person asked this application to make.
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
 * - `keptAfterMove` — `kept`, when the reorder was a move the person asked for.
 *   The repair is identical; only the attribution differs, because opening with
 *   "this file changed on disk" over the person's own committed move is the
 *   false alarm `docs/decisions/2c-3b-2-window-reading.md` section 7.1 measured.
 * - `displacedByMove` — `differentMatch`, when the reorder was a move the person
 *   asked for. The selection is still dropped rather than silently re-pointed
 *   (R27 stands), but the sentence names their own move as the cause, says the
 *   snippet is still in the file, and tells them to pick it in the list again.
 */
export type SelectionNotice =
  | 'kept'
  | 'differentMatch'
  | 'gone'
  | 'unresolved'
  | 'deleted'
  | 'keptAfterMove'
  | 'displacedByMove';

/**
 * Who a selection repair's notice says reordered the file.
 *
 * The fix shape `docs/decisions/2c-3b-1-notes.md` section 5.2 prescribes: an
 * **explicit argument on the adoption**, never a swap inside the repair, because
 * the external sentences are accurate when the file really was changed by
 * another writer (the reading's L4b/L5 launches are the proof). The default is
 * `externalChange`, so every caller that does not pass the argument shows
 * exactly what it showed before.
 *
 * - `externalChange` — the sentences that open "This file changed on disk".
 * - `requestedMove` — the sentences that name the person's own committed move.
 *   Only `BrowserState.moveMatch`'s adoption passes this, and only for a
 *   commit; nothing in TypeScript enforces that restraint, so it is stated here
 *   in the same sentence as what the type does force.
 */
export type RepairAttribution = 'externalChange' | 'requestedMove';

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
    case 'keptAfterMove':
      return 'browser.notice.keptAfterMove';
    case 'displacedByMove':
      return 'browser.notice.displacedByMove';
  }
} // End of function selectionNoticeKey()
