/**
 * What has to happen, in what order, before the interface is mounted.
 *
 * This exists as its own module for one reason: the *order* is a claim, and a
 * claim inside `main.ts` cannot be tested. `main.ts` imports Svelte's `mount`
 * and a real component, so exercising it needs a DOM implementation this
 * project has deliberately not adopted yet. Taking the document and the mount
 * call as arguments moves the ordering claim somewhere a plain object can
 * check it.
 *
 * The claim is: **the document declares the interface language before anything
 * is rendered into it.** `index.html` ships `lang="en"` because a static file
 * cannot know better, and a Spanish user would otherwise have a document that
 * says English for as long as it takes the first frame to paint. A screen
 * reader picks its voice from that attribute, so "for as long as it takes" is
 * long enough to be heard.
 */

import type { Locale } from './i18n/locale';

/** The element id `index.html` gives the mount point. */
export const MOUNT_POINT_ID = 'app';

/**
 * The slice of `document` the bootstrap touches.
 *
 * Structural, and generic in the element type, so a test can hand it two
 * plain objects rather than stand up a DOM.
 *
 * @typeParam TTarget - Whatever `getElementById` returns for this host.
 */
export interface BootstrapDocument<TTarget> {
  /** The root element, whose `lang` attribute is the accessibility signal. */
  readonly documentElement: { lang: string };
  /**
   * Finds an element by its id.
   *
   * @param elementId - The id to look for.
   * @returns The element, or `null` when the document has no such id.
   */
  getElementById(elementId: string): TTarget | null;
}

/**
 * Declares the interface language, then mounts the application into the page.
 *
 * @typeParam TTarget - The element type this document yields.
 * @typeParam TResult - Whatever the mount callback returns.
 * @param doc - The document to prepare and mount into.
 * @param language - The locale the interface will render in.
 * @param mountApp - Mounts the application; called last, on purpose.
 * @returns The mount callback's own return value.
 * @throws When the document has no `#app` mount point.
 */
export function bootstrap<TTarget, TResult>(
  doc: BootstrapDocument<TTarget>,
  language: Locale,
  mountApp: (target: TTarget) => TResult
): TResult {
  // Before the lookup and before the mount, so that no frame is ever painted
  // into a document claiming the wrong language.
  doc.documentElement.lang = language;

  const target = doc.getElementById(MOUNT_POINT_ID);
  if (target === null) {
    // Developer-facing, and therefore deliberately not translated: this can
    // only fire if `index.html` lost its mount point, which no user can cause
    // and no user could act on. Recorded in `1b-1-notes.md` section 8.
    throw new Error(`index.html is missing the #${MOUNT_POINT_ID} mount point`);
  }

  return mountApp(target);
} // End of function bootstrap()
