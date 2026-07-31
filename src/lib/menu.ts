/**
 * The macOS application menu, in whichever language the interface is showing.
 *
 * Tauri v2 builds that menu in **Rust**, and `src-tauri/src/menu.rs` holds no
 * string of its own, so the labels have to be translated here and sent. This
 * module is the join: it turns a locale into the wire's label set, and it keeps
 * the menu following the language picker.
 *
 * ## Why a subscription and not an `$effect`
 *
 * An `$effect` is the idiomatic Svelte answer and is what `App.svelte` uses to
 * keep `document.documentElement.lang` in step. It is deliberately not used
 * here, for two reasons.
 *
 * 1. **The menu is not in the component tree.** It belongs to the application,
 *    not to a view, and it outlives every component. Hanging it off a component's
 *    lifecycle would mean the menu's language depended on which screen happened
 *    to be mounted.
 * 2. **An `$effect` here could not be tested.** `vite.config.ts` runs the suite
 *    with `environment: 'node'`, so `svelte` resolves through its `default`
 *    export condition to `index-server.js`, where `$effect` does nothing at all.
 *    A menu wired that way would be a locale link with no test that could fail —
 *    which is the exact shape this project keeps finding in review. This is
 *    plain JavaScript over `LocaleState.subscribe`, and `menu.test.ts` exercises
 *    both halves.
 *
 * What is still untested is what the *operating system* draws; see
 * `docs/decisions/1b-2b-notes.md` section 11.
 */

import { translate, type Locale, type TranslationKey } from './i18n';
import type { IpcFailure } from './ipc/errors';
import { MENU_LABEL_FIELDS, type MenuLabelField, type MenuLabels, type MenuResult } from './ipc/menu';
import type { LocaleState } from './stores/locale.svelte';

/**
 * The dictionary key holding one menu label.
 *
 * The formula is the identity: the wire field name *is* the key's second half,
 * so there is nothing to derive and nothing to derive wrongly. The return type
 * is the enforcement — `` `menu.${MenuLabelField}` `` is a union of sixteen
 * literals, and if one of them is not a key of `en.json` this file fails
 * `npm run check` by name, exactly as `codes.ts` does for the `code.` namespace.
 *
 * @param field - A field of the wire's label set.
 * @returns The translation key holding that label.
 */
export function menuLabelKey(field: MenuLabelField): TranslationKey {
  return `menu.${field}`;
} // End of function menuLabelKey()

/**
 * Translates every menu label into one locale.
 *
 * `{app}` is supplied to every label rather than to the three that use it —
 * "About espansoConfig", "Hide espansoConfig", "Quit espansoConfig", and their
 * Spanish forms, which put the name in a different place. A label with no
 * placeholder ignores the parameter, so there is no per-key special case to keep
 * in step with the dictionary.
 *
 * @param locale - The language to render the menu in.
 * @returns Every label, ready for the wire.
 */
export function menuLabels(locale: Locale): MenuLabels {
  const params = { app: translate(locale, 'app.name') };
  // `Object.fromEntries` is typed as returning an index signature, so one cast
  // is unavoidable here. It is safe by construction: the keys are exactly
  // `MENU_LABEL_FIELDS`, which is what `MenuLabels` is keyed by.
  return Object.fromEntries(
    MENU_LABEL_FIELDS.map((field) => [field, translate(locale, menuLabelKey(field), params)])
  ) as MenuLabels;
} // End of function menuLabels()

/**
 * Sends the menu now, and again on every language change.
 *
 * Sending immediately matters: Tauri installs its own English menu at startup,
 * so until the first call lands a Spanish user is looking at English. The
 * caller is `src/main.ts`, before the interface is mounted.
 *
 * **The result is consumed here rather than in `src/main.ts`, and that is the
 * point.** Phase 1b-2b's review found `main.ts` dropping the promise, so a
 * `menuUnavailable` — and, before the untyped envelope, a whole version skew —
 * was classified and thrown away with the English default menu still on screen.
 * Moving the consumption into this function is what makes it testable: `main.ts`
 * is untested wiring by design, and a failure path that only exists there is a
 * failure path no test can reach. `menu.test.ts` drives both arms.
 *
 * The send is deliberately **not awaited** by the caller: a menu rebuild must
 * not delay the interface.
 *
 * @param state - The application-wide language state.
 * @param send - What to do with a label set; the real one invokes Rust.
 * @param report - Where a failed rebuild goes; the real one is the console.
 * @returns A function that stops following the language.
 */
export function startMenuLocalization(
  state: LocaleState,
  send: (labels: MenuLabels) => Promise<MenuResult>,
  report: (failure: IpcFailure) => void
): () => void {
  const push = (current: Locale): void => {
    void send(menuLabels(current)).then((result) => {
      if (!result.ok) {
        report(result.failure);
      }
    });
  };
  push(state.current);
  return state.subscribe(push);
} // End of function startMenuLocalization()
