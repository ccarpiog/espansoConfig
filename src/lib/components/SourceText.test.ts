/** @vitest-environment jsdom */

/**
 * `SourceText.svelte`, mounted — the 4-13 review's finding on B5's wrap mode.
 *
 * **What is compared** is the DOM each mode draws for the same text. The wrapping
 * mode must draw the default mode's text nodes and `<br>` elements unchanged and
 * add only empty `lineStart` markers, so that what a selection holds, and a copy
 * carries, is the same in both. A first version drew each file line as a block
 * without its `<br>`, which made `a` and `a\n` indistinguishable; the review found
 * it. **What this suite cannot show** is a window: jsdom neither lays out nor
 * copies, so it proves the DOM, not what a WKWebView selection yields
 * (`CLAUDE.md` §6); the markers are empty and their `›` is generated content,
 * which no DOM text holds.
 *
 * Per `1b-2a-notes.md` section 14, a `describe`/`it` callback whose sibling
 * argument is already its description carries no JSDoc of its own; ordinary
 * helpers here do.
 */

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SourceText from './SourceText.svelte';

/**
 * The invoke guard (the 2d-6 record's §3 entry 37): `SourceText` reaches no
 * command, so `@tauri-apps/api/core` is a spy that rejects, and the
 * file-level `afterEach` fails a case that made a call.
 */
const { invoked } = vi.hoisted(() => ({ invoked: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: readonly unknown[]): Promise<never> => {
    invoked(...args);
    return Promise.reject(new Error('this suite invokes no command'));
  }
}));

afterEach(() => {
  const calls = invoked.mock.calls.length;
  invoked.mockClear();
  expect(calls).toBe(0);
});

/**
 * What a container holds that a selection can hold: its non-empty text nodes,
 * its `<br>` elements and its invisible-character markers, in order. Svelte's
 * comment and empty-text anchors are skipped (they hold nothing to select, and
 * the two modes place them differently), and so are the line markers, whose
 * emptiness each case asserts separately.
 *
 * @param box - The `.sourceText` container.
 * @returns One token per selectable node, in document order.
 */
function selectable(box: Element): string[] {
  const tokens: string[] = [];
  for (const node of Array.from(box.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Svelte leaves empty text anchors; they hold nothing to select.
      if ((node.textContent ?? '') !== '') {
        tokens.push(`text:${node.textContent ?? ''}`);
      }
    } else if (node instanceof HTMLBRElement) {
      tokens.push('br');
    } else if (node instanceof HTMLElement && node.classList.contains('invisible')) {
      tokens.push(`invisible:${node.textContent ?? ''}`);
    } else if (node instanceof HTMLElement && !node.classList.contains('lineStart')) {
      tokens.push(`other:${node.tagName}`);
    }
  } // End of the loop over the container's children
  return tokens;
} // End of function selectable()

/**
 * Mounts one `SourceText`, reads its container, and unmounts it.
 *
 * @param text - The text to draw.
 * @param wrap - Whether to draw the wrapping mode.
 * @returns The selectable tokens, the line markers and their combined text.
 */
function draw(
  text: string,
  wrap: boolean
): { tokens: string[]; markers: number; markerText: string } {
  const target = document.createElement('div');
  document.body.append(target);
  const component = mount(SourceText, { target, props: { text, documentStart: true, wrap } });
  flushSync();
  const box = target.querySelector('.sourceText');
  const tokens = box === null ? [] : selectable(box);
  const found = box === null ? [] : Array.from(box.querySelectorAll('.lineStart'));
  const markerText = found.map((marker) => marker.textContent ?? '').join('');
  void unmount(component);
  target.remove();
  return { tokens, markers: found.length, markerText };
} // End of function draw()

const CASES: readonly (readonly [string, string, number])[] = [
  ['one line', 'a', 1],
  ['one line with its break', 'a\n', 1],
  ['two lines', 'a\nb', 2],
  ['an empty line between two', 'a\n\nb', 3],
  ['a CRLF file', 'a\r\nb\r\n', 2],
  ['a lone carriage return', 'a\rb', 1],
  ['a byte order mark at the start', '\u{FEFF}a\nb', 2],
  ['a line that starts with spaces', 'a\n   b', 2],
  ['a line that starts with an invisible character', 'a\n\u{200B}b', 2],
  ['only a break', '\n', 1],
  ['nothing', '', 0]
];

describe('the wrapping mode draws the default mode’s text and breaks unchanged', () => {
  it.each(CASES)('%s', (_, text, lines) => {
    const plain = draw(text, false);
    const wrapped = draw(text, true);
    expect(plain.markers).toBe(0);
    expect(wrapped.markers).toBe(lines);
    expect(wrapped.markerText).toBe('');
    expect(wrapped.tokens).toEqual(plain.tokens);
  });

  it('keeps a text with a final break apart from one without', () => {
    expect(draw('a\n', true).tokens).toEqual(['text:a', 'br']);
    expect(draw('a', true).tokens).toEqual(['text:a']);
  });
}); // End of the wrapping-mode suite
