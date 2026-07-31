/**
 * The one command that carries strings **into** Rust.
 *
 * Every other command on this boundary answers with codes and structured data
 * and leaves the prose to the frontend (plan section 9). This one runs the other
 * way, for a reason that is specific to macOS: Tauri v2 builds the application
 * menu in Rust, so the only two ways to localize it are to write the labels into
 * `src-tauri/src/menu.rs` — a second string table the i18n layer cannot see and
 * no check in this repository could read — or to send them. It sends them.
 *
 * ## What is in this module and what is not
 *
 * The **wire shape** only: the field list, the type it induces, the command's
 * name, and the call. Which dictionary key fills which field is `src/lib/menu.ts`,
 * because that is an i18n decision and this module must not read a dictionary.
 *
 * ## Why the field list is a value and not only a type
 *
 * {@link MENU_LABEL_FIELDS} is a runtime array because two things read it: the
 * label builder, which has to iterate it, and `src-tauri/src/menu_contract.rs`,
 * which reads *this file* and fails `cargo test` when the array and the fields of
 * the Rust `MenuLabels` struct disagree in either direction. A type alone would
 * be invisible to both.
 */

import { invoke } from '@tauri-apps/api/core';

import { classifyFailure, type IpcFailure } from './errors';

/**
 * Every label the macOS menu needs, in the order the menu shows them.
 *
 * The names are the **wire** names, which are the field names of `MenuLabels` in
 * `src-tauri/src/menu.rs`, which are also the second half of each `menu.` key in
 * `src/lib/i18n/{en,es}.json`. One spelling in three places rather than a
 * formula, so there is nothing to keep in step and nothing to derive wrongly;
 * `menu_contract.rs` compares all three.
 *
 * Sixteen labels, and no more: the application submenu owns ⌘Q, the edit submenu
 * is what makes the standard clipboard shortcuts reach a focused field on macOS,
 * and the window submenu owns ⌘M and ⌘W. Anything further would be a label for
 * behaviour this application does not have.
 */
export const MENU_LABEL_FIELDS = [
  'about',
  'services',
  'hide',
  'hide_others',
  'show_all',
  'quit',
  'edit',
  'undo',
  'redo',
  'cut',
  'copy',
  'paste',
  'select_all',
  'window',
  'minimize',
  'close_window'
] as const;

/** One of {@link MENU_LABEL_FIELDS}. */
export type MenuLabelField = (typeof MENU_LABEL_FIELDS)[number];

/**
 * The whole label set, exactly as `MenuLabels` in `src-tauri/src/menu.rs`
 * deserializes it.
 *
 * Every field is required on both sides. The Rust struct is
 * `deny_unknown_fields` and derives no defaults, so a missing label is a typed
 * refusal at the boundary rather than an item quietly wearing muda's built-in
 * English text.
 */
export type MenuLabels = Readonly<Record<MenuLabelField, string>>;

/**
 * The wire name of every command this module may call.
 *
 * A one-element list rather than a bare constant so that
 * `src-tauri/src/wire_contract.rs` can parse it with the same scanner it already
 * uses for `COMMAND_NAMES`, and so the registered-command check stays a
 * comparison of two sets rather than a set against a special case.
 */
export const MENU_COMMAND_NAMES = ['set_menu_labels'] as const;

const [SET_MENU_LABELS] = MENU_COMMAND_NAMES;

/** The outcome of a menu rebuild: nothing to return, or a classified failure. */
export type MenuResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly failure: IpcFailure };

/**
 * Rebuilds the macOS application menu with these labels.
 *
 * **`ok: true` means a menu was installed**, which it did not before Phase
 * 1b-2b's review: the command used to answer as soon as the AppKit work had been
 * *posted*, so a failure inside it left the previous menu up and reported
 * success. Three refusals are possible and each is a code —
 * `invalidMenuLabels` when this build and the Rust side disagree about the label
 * set, `menuUnavailable` when the event loop is gone, and `menuBuildFailed` when
 * the rebuild ran and AppKit refused.
 *
 * @param labels - Every label, already translated.
 * @returns Nothing on success, or the classified failure.
 */
export async function setMenuLabels(labels: MenuLabels): Promise<MenuResult> {
  try {
    await invoke(SET_MENU_LABELS, { labels });
    return { ok: true };
  } catch (raw: unknown) {
    return { ok: false, failure: classifyFailure(raw) };
  }
} // End of function setMenuLabels()
