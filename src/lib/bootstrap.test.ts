/**
 * The bootstrap ordering, and the static language `index.html` ships with.
 *
 * The claim under test is an *order*, not a value: the document's `lang` is
 * already the interface language at the moment the application is mounted. A
 * version that sets it afterwards — which is what an `$effect` in the root
 * component does — leaves the first painted frame declaring the wrong language.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bootstrap, MOUNT_POINT_ID } from './bootstrap';
import { DEFAULT_LOCALE } from './i18n/locale';

/** A stand-in mount target; nothing in `bootstrap()` looks inside it. */
interface FakeTarget {
  /** Distinguishes this object from any other in an assertion. */
  readonly id: string;
}

/**
 * A minimal document with a settable `lang` and one findable element.
 *
 * @param ids - The element ids this document contains.
 * @returns A document stand-in plus the target it will hand out.
 */
function fakeDocument(...ids: string[]): {
  documentElement: { lang: string };
  getElementById(elementId: string): FakeTarget | null;
} {
  return {
    documentElement: { lang: 'zz' },
    getElementById(elementId: string): FakeTarget | null {
      return ids.includes(elementId) ? { id: elementId } : null;
    }
  };
} // End of function fakeDocument()

describe('bootstrap()', () => {
  it('declares the interface language before the application is mounted', () => {
    const doc = fakeDocument(MOUNT_POINT_ID);
    let langAtMountTime: string | null = null;

    bootstrap(doc, 'es', (target) => {
      langAtMountTime = doc.documentElement.lang;
      return target;
    });

    // Read *inside* the mount callback, so moving the assignment after the
    // mount fails here rather than passing on the final value.
    expect(langAtMountTime).toBe('es');
    expect(doc.documentElement.lang).toBe('es');
  });

  it('declares English just as readily as Spanish', () => {
    const doc = fakeDocument(MOUNT_POINT_ID);
    bootstrap(doc, 'en', (target) => target);
    expect(doc.documentElement.lang).toBe('en');
  });

  it('mounts into the #app element and returns whatever the mount produced', () => {
    const doc = fakeDocument(MOUNT_POINT_ID);
    const mounted = bootstrap(doc, 'en', (target) => target.id);
    expect(mounted).toBe(MOUNT_POINT_ID);
  });

  it('throws rather than mounting into nothing when the mount point is gone', () => {
    const doc = fakeDocument('something-else');
    let mountCalls = 0;

    expect(() =>
      bootstrap(doc, 'en', (target) => {
        mountCalls += 1;
        return target;
      })
    ).toThrow(/#app/);
    expect(mountCalls).toBe(0);
  });
}); // End of the "bootstrap()" suite

describe('index.html', () => {
  const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');

  it('declares the fallback locale, which is the only honest static answer', () => {
    // Before any script runs there is no `navigator` reading to negotiate
    // against, so the static attribute can only be the locale the negotiator
    // itself falls back to. If `DEFAULT_LOCALE` ever changes, this fails.
    expect(html).toContain(`<html lang="${DEFAULT_LOCALE}">`);
  });

  it('still carries the mount point the bootstrap looks for', () => {
    expect(html).toContain(`id="${MOUNT_POINT_ID}"`);
  });
}); // End of the "index.html" suite
