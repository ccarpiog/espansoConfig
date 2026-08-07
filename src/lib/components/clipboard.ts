/**
 * Putting one text on the clipboard, by whichever route this webview allows.
 *
 * **The technique is `RawEditor.svelte`'s and this is now its only home.** That
 * component carried the asynchronous API, the selection fallback and the focus
 * restoration from 2c-1b, where the window reading found
 * `navigator.clipboard.writeText` rejected with `NotAllowedError` — and the
 * re-take established that the machine's screen was locked and
 * `document.hasFocus()` was false throughout, so **whether the shipped WKWebView
 * refuses `navigator.clipboard` is still unsettled** (`2c-1b-notes.md` sections
 * 9.11.4 and 8.12). What stands on its own is that a *copy your text before
 * discarding it* step must not rest on a single route.
 *
 * 2c-4a-3a gave two more surfaces that step, and all three call this. The first
 * round of that step left the raw editor's copy in place and recorded the
 * duplication as a hole; the review that followed sent it back into that
 * component for three other reasons, so the duplicate went with them — a routine
 * whose failure mode is silence is exactly the kind that must not exist twice.
 * **The raw editor's window reading is owed again because of it**, which is
 * recorded in `docs/decisions/2c-4a-3a-notes.md` rather than left to be noticed.
 *
 * **This file is DOM machinery, not a model.** It decides nothing about *what* is
 * copied — that is `referenceCopyOf` in `../browser/saveOutcome` — and everything
 * about *how*, which is a question only a document can answer.
 */

/**
 * What was focused and selected before the carrier took both.
 *
 * Two kinds, because the platform has two: a form control carries its own
 * selection offsets, and everything else carries document ranges. Restoring only
 * the focused element puts the caret back at the start of whatever the person had
 * highlighted.
 */
interface SelectionSnapshot {
  /** The element that had focus, or `null`. */
  readonly element: HTMLElement | null;
  /** The focused form control's selection offsets, when it had them. */
  readonly offsets: { readonly start: number; readonly end: number } | null;
  /** The document's own selection ranges, cloned so nothing aliases them. */
  readonly ranges: readonly Range[];
}

/**
 * Runs one step of putting the screen back, and swallows its failure.
 *
 * Named rather than inlined so that "this must not throw" is a property a reader
 * can see at every call site instead of a `try` block they have to read past.
 *
 * @param step - The restoration step to attempt.
 */
function quietly(step: () => void): void {
  try {
    step();
  } catch {
    // Cleanup that fails is not worth an error the person cannot act on: what
    // matters is that the answer still reaches the screen.
  }
} // End of function quietly()

/**
 * Records what has focus and what is selected, before either is taken away.
 *
 * @returns The snapshot, empty rather than throwing when the platform refuses any
 *   part of the question — `selectionStart` throws on some input types.
 */
function captureSelection(): SelectionSnapshot {
  const active = document.activeElement;
  const element = active instanceof HTMLElement ? active : null;
  let offsets: { readonly start: number; readonly end: number } | null = null;
  quietly(() => {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      const start = element.selectionStart;
      const end = element.selectionEnd;
      if (start !== null && end !== null) {
        offsets = { start, end };
      }
    }
  });
  const ranges: Range[] = [];
  quietly(() => {
    const selection = document.getSelection();
    for (let index = 0; index < (selection?.rangeCount ?? 0); index += 1) {
      const range = selection?.getRangeAt(index);
      if (range !== undefined) {
        ranges.push(range.cloneRange());
      }
    } // End of the loop over the document's selection ranges
  });
  return { element, offsets, ranges };
} // End of function captureSelection()

/**
 * Puts focus and the selection back where {@link captureSelection} found them.
 *
 * Three independent steps, each swallowed on its own: a focus that will not
 * return must not stop the offsets being restored, and neither must stop the
 * caller answering.
 *
 * @param snapshot - What was there before.
 */
function restoreSelection(snapshot: SelectionSnapshot): void {
  const element = snapshot.element;
  if (element !== null) {
    quietly(() => element.focus({ preventScroll: true }));
  }
  const offsets = snapshot.offsets;
  if (
    offsets !== null &&
    (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)
  ) {
    quietly(() => element.setSelectionRange(offsets.start, offsets.end));
    return;
  }
  if (snapshot.ranges.length === 0) {
    return;
  }
  quietly(() => {
    const selection = document.getSelection();
    selection?.removeAllRanges();
    for (const range of snapshot.ranges) {
      selection?.addRange(range);
    } // End of the loop over the ranges that were there before
  });
} // End of function restoreSelection()

/**
 * Copies one text by selecting it in a carrier text area.
 *
 * `document.execCommand('copy')` over a real selection needs neither a permission
 * prompt nor a new dependency — deliberately not
 * `@tauri-apps/plugin-clipboard-manager`, which would be a dependency plus Rust.
 * The carrier is offscreen rather than `hidden` or `display: none`: an element
 * that is not rendered cannot hold a selection, which is the usual way this
 * fallback is written and does nothing.
 *
 * **It always answers a boolean, and every step of putting the screen back is
 * separately non-throwing.** Silence is the worst answer this path can give — on
 * the one control that exists to keep a draft from being lost — so nothing in the
 * cleanup is allowed to produce it.
 *
 * @param value - The text to put on the clipboard. Must hold no carriage return;
 *   {@link copyReferenceText} is what enforces that, because a text area
 *   normalises one and this route would then copy something else.
 * @returns `true` when the copy command reported success and `false` for every
 *   other ending — a throw anywhere in the selection, an absent `execCommand`, or
 *   a command that answered `false`. **A failure of the cleanup afterwards does
 *   not change the answer**: the copy either reached the clipboard or it did not,
 *   and reporting a successful copy as a failure because a carrier would not
 *   detach would send a person to hand-copy text they already have. That is the
 *   2c-4a-3a review's finding 7, where this doc said the opposite of the code.
 */
function copyBySelecting(value: string): boolean {
  const before = captureSelection();
  const carrier = document.createElement('textarea');
  let copied = false;
  try {
    carrier.value = value;
    carrier.setAttribute('aria-hidden', 'true');
    carrier.style.position = 'fixed';
    carrier.style.top = '-1000px';
    carrier.style.opacity = '0';
    document.body.append(carrier);
    carrier.focus({ preventScroll: true });
    carrier.select();
    carrier.setSelectionRange(0, carrier.value.length);
    copied = typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch {
    copied = false;
  }
  // Outside the `try`, and each half guarded on its own, so a carrier that will
  // not detach cannot stop focus being restored and neither can stop the answer.
  quietly(() => carrier.remove());
  restoreSelection(before);
  return copied;
} // End of function copyBySelecting()

/**
 * Puts one text on the clipboard, exactly, or says it could not.
 *
 * The asynchronous API first, because it is the one that works everywhere else and
 * needs no selection; the selection fallback when it rejects or is absent.
 *
 * **The fallback is refused for a text holding a carriage return**, and that is
 * the one rule this file adds to the raw editor's routine. A `<textarea>`'s API
 * value has every line break normalised to LF — measured in this application's own
 * WKWebView, where `"x\ry\r\nz"` reads back as `"x\ny\nz"`
 * (`2c-2-2-window-reading.md` section 6) — so the carrier would put *different
 * characters* on the clipboard and report success. A projected value the small
 * editor shows read-only may hold a real carriage return, so this is reachable
 * rather than theoretical.
 *
 * **A refusal here is a real loss and the caller's sentence must say so.** There
 * is no second route in this webview that is known to preserve a carriage return:
 * `navigator.clipboard.writeText` takes the string as it is and is the only one
 * that could, and whether it is granted at all is unsettled. Falling back to a
 * lossy copy that reports success would be worse — the person would take the
 * altered text and discard the original — so the copy fails, and the caller must
 * not tell them to select it off the panel instead: `SourceText` writes the
 * *name* of a carriage return where the character was (2c-4a-3a review,
 * finding 1).
 *
 * @param value - The text to copy, byte for byte.
 * @returns Whether the clipboard now holds exactly that text.
 */
export async function copyReferenceText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // Refused, or absent outside a secure context. Fall through.
  }
  return value.includes('\r') ? false : copyBySelecting(value);
} // End of function copyReferenceText()
