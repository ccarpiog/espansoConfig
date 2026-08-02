# Phase 2c-1b — aggregate code review

**Verdict as delivered: `READINESS: NOT READY`**, on three High findings and three Medium.
Held to the files of the phase plus the specification it implements; no web search, no tree
sweep. Reviewer: Codex, via `codex:codex-rescue`.

The brief carried the protocol rules as *rules* — the only entry point that writes, the refusal
rather than a force flag, the content-addressed `DocumentDoesNotParse`, the prohibition on
reporting a committed write as an error, the permanent `moved: null`, the eight conflict
requirements, and the reservation of the phrase *"keep my draft"* for 2c-4b — so that a violation
of one would be reported as a defect rather than as a matter of taste. It also told the reviewer
that all four commands pass and to skip "add a test for X" unless the missing test hid a real
defect. It asked explicitly for the decision record to be reviewed as code, because a record that
claims a guarantee the code does not give is the one class of defect no test can fail.

The brief is `~/.claude/jobs/.../2c-1b-review-brief.md` (not committed); its substance is
reproduced by the rule list above.

**The disposition is `PROGRESS.md` § "Phase 2c-1b review disposition".**

---

## The review, verbatim

1. **Severity: High** — `src/lib/browser/workspace.svelte.ts:606`, `src/lib/browser/workspace.svelte.ts:904`, `src/lib/components/DetailPane.svelte:194`, `docs/decisions/2c-1b-notes.md:220`

   **Failure scenario:** The viewer holds text T0 at revision R0. Another process writes T1/R1. Selecting a snippet triggers stale-identity recovery, which installs the R1 projection, but `readFileText` skips re-reading because the document ID is unchanged. *Edit* then pairs stale T0 with newer R1. Saving an edited T0 passes the revision check and silently overwrites T1. This is a wider window than the record's revert-then-restore case, and falsifies its claim that the base can only be older.

   **Fix:** Couple each text snapshot to the projection revision captured when that text read starts, and use that captured revision when opening the editor. Alternatively, invalidate and re-read held text whenever `installView` replaces its projection. Amend §5 and §8.1 accordingly.

2. **Severity: High** — `src/lib/browser/workspace.svelte.ts:1035`, `src/lib/components/RawEditor.svelte:173`, `src/lib/i18n/en.json:157`, `docs/decisions/2c-1b-notes.md:119`

   **Failure scenario:** The rename succeeds but a later write step such as directory sync fails with `may_have_written: true`. The workspace correctly refreshes its caches, then returns `null`; the editor converts every `null` into "nothing was written." The file may already contain the candidate, directly contradicting the screen and D7's record.

   **Fix:** Return a typed command-failure state that preserves `mayHaveWritten`. Render an indeterminate warning for that arm—never "nothing was written"—while retaining the draft and refreshed workspace state.

3. **Severity: High** — `src/lib/browser/workspace.svelte.ts:1047`, `src/lib/browser/workspace.svelte.ts:1076`, `src/lib/browser/rawEditor.ts:435`, `docs/decisions/2c-1b-notes.md:189`

   **Failure scenario:** A raw save commits, then the workspace cannot re-project the written file. The workspace reports the reload failure only to the developer channel and seals only the `SaveResult`. The editor's seal callback cannot reproduce that failure, so the user sees "file written" without the required "window is out of step" disclosure.

   **Fix:** Carry the workspace reload status alongside—or inside the hidden payload associated with—the sealed outcome, and make `applySave` append `windowOutOfStep` beside the saved arm. A typed `getDocument` failure inside `adoptTheReplacedDocument` must also produce this status rather than being swallowed as a successful callback. Remove §8.3 as an accepted hole.

4. **Severity: Medium** — `src/lib/components/RawEditor.svelte:167`, `src/lib/components/RawEditor.svelte:269`, `src/lib/components/RawEditor.svelte:287`, `src/lib/components/DetailPane.svelte:347`

   **Failure scenario:** The user clicks *Save*, then closes the editor while the request is pending. The dialog states the changes have not been written and that discarding will discard them, but confirming unmounts the editor while the already-authorized request can subsequently commit. Its committed outcome is never drawn.

   **Fix:** Prevent closing or confirming discard while `view.saving` is true. If closing must remain possible, explicitly state that the save cannot be cancelled and may still write, and preserve a surface that receives its outcome.

5. **Severity: Medium** — `src/lib/components/DetailPane.svelte:171`, `src/lib/browser/workspace.svelte.ts:1064`, `src/lib/components/RawEditor.svelte:402`, `docs/decisions/2c-1b-notes.md:358`

   **Failure scenario:** The editor remains open for file A while the sidebar points elsewhere—or conflict repair clears an All-scope selection. The conflict handler reads only the workspace's current target, so A's `diskText` is `null`. The required *Reload disk version* flow reaches a permanently disabled confirmation until the user independently navigates back to A.

   **Fix:** Retain/read the conflict disk text by the editing document's ID, independently of the pane's current target. Do not treat navigation-induced loss of the reload affordance as an acceptable hole.

6. **Severity: Medium** — `docs/decisions/2c-split-notes.md:173`, `docs/decisions/2c-1b-notes.md:11`, `docs/decisions/2c-1b-notes.md:390`

   **Failure scenario:** The phase is committed with only model and mounted-component evidence even though §7 requires a recorded WKWebView reading for every sub-phase. The record explicitly confirms that required evidence is absent.

   **Fix:** Perform the prescribed fresh-bundle window reading, record its observations, and update the verification and completion claims before commit.

Clean: acknowledgement remains candidate-bound through the component; editing/undo withdraws consent; no prohibited control name, hardcoded user string, or JavaScript byte-span slicing was introduced. The scoped jsdom configuration and conditional production-build spread are correct. The seal is not pure ceremony—it gates the whole-document describer and one-shot editor rebase—but it does not perform workspace invalidation.

READINESS: NOT READY — findings 1–6 must be fixed before this phase is committed.

---

## Second pass — the two fixes taken after the window reading

The manual reading in a running window (`docs/decisions/2c-1b-notes.md` §9) found two things the
code did not do as claimed: **CRLF was silently normalized** by the textarea's API value, and
*Copy my text* never worked because `navigator.clipboard` is refused in this WKWebView. Both were
fixed — the first as a **refusal** rather than a reconstruction — and the fixes were put back to
Codex on their own, with the brief scoped to them rather than to the whole phase.

**Verdict as delivered: `READINESS: NOT READY`**, on one High and one Medium. Reviewer: Codex, via
`codex:codex-rescue`. No web search, no tree sweep.

### The review, verbatim

1. **Severity: High** — `docs/decisions/2c-1b-notes.md:218`

   **Failure scenario:** The record says TypeScript forces that no session exists for carriage-return text. It does not: `RawEditorSession` is structurally constructible, and `editText(session, next)` accepts any string without applying `rawEditorRefusal` (`src/lib/browser/rawEditor.ts:358`). Starting with a valid LF session, calling `editText(session, "a\rb")` and then `beginSave` produces a save candidate containing `\r`. If that draft reaches a conflict, the carrier textarea normalizes it before copying (`src/lib/components/RawEditor.svelte:296`). The current Svelte input path happens to supply an already-normalized textarea value, but the module's exported API and the claimed TypeScript guarantee are not total.

   **Fix:** Enforce the invariant at every candidate boundary—at minimum reject carriage returns in `editText` and defensively in `beginSave`, or make CR-free text/session construction opaque. Rewrite D13 to distinguish the runtime guards and current component path from what TypeScript actually enforces.

2. **Severity: Medium** — `src/lib/components/RawEditor.svelte:310`

   **Failure scenario:** After both clipboard routes fail—or even after `execCommand` returns successfully—the `finally` block calls `previous.focus()` without protecting cleanup. If focus restoration throws, `copyBySelecting` throws, the assignment to `copied` at line 339 never occurs, and the fire-and-forget handler produces neither the success nor failure disclosure. The code also does not snapshot and restore an existing document selection; it restores only the active element.

   **Fix:** Make removal and focus restoration independently non-throwing, ensure `copyBySelecting` always returns a boolean, and snapshot/restore the previous DOM or form-control selection as applicable.

The `\r`-anywhere predicate, literal `\\r` test, refusal UI, localization accessor/parity, and conflict reload guard are otherwise clean.

The refusal's inability to repair CRLF files is stated plainly in `docs/decisions/2c-1b-notes.md:528`, and the successful-save wording remains accurate on the reviewed paths.

READINESS: NOT READY — findings 1 and 2 must be fixed before this phase is committed.
