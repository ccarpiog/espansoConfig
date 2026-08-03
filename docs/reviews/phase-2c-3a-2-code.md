1. Medium — `src/lib/components/MatchCreator.svelte:85-93, 463-490`; `src/lib/i18n/en.json:220`; `src/lib/i18n/es.json:220`; `docs/decisions/2c-3a-2-notes.md:149-169`

   The line-ending disclosure contradicts the measured behavior documented beside it. The trigger uses `<input type="text">`, which WKWebView deletes a real `\r`, while the shared message says a pasted carriage return becomes an ordinary line break.

   Concrete failure: pasting `:a\rb` into the trigger produces `:ab`, but the screen tells the user it became a line break. They can consequently create a snippet with a different trigger from the one the disclosure promises.

   Minimal fix: give the trigger and body separate accurate localized disclosures, or explicitly intercept/refuse carriage-return input before the text control deletes it. Update §2.6 of the decision record to describe the chosen behavior accurately.

2. Low — `docs/decisions/2c-3a-2-notes.md:282-283`

   The record says fifty-one Spanish sentences were added, while the actual diff adds fifty keys to each dictionary, consistent with lines 28 and 235-236 of the same record.

   Concrete failure: the decision record contains conflicting verification evidence, so a later audit cannot rely on its stated count.

   Minimal fix: change “Fifty-one” to “Fifty.”

The requested identity checks otherwise hold:

- Every deletion attempt reaches `confirmDelete` through the single `runDelete()` path at `MatchDeleter.svelte:199-215`, which recomputes `identityInProjection(projections(), session.match)` at that click. Reprojection, retry after a send failure, and a vanished projection/node therefore use the live lookup; disappearance returns `null` at `matchDeletion.ts:268-277`.
- Save, create, and delete forward their session/submission base revisions at `MatchEditor.svelte:340-350`, `MatchCreator.svelte:279-299`, and `MatchDeleter.svelte:199-215`.
- The two selection generations remain independent. No changed path adds a direct `selected` assignment; existing assignments either use `replaceSelection()` or synchronously bump `selectGeneration`.
- Committed deletion repair is implemented at `workspace.svelte.ts:2265-2288`. The churned-identity test at `MatchDeleter.test.ts:429-560` would fail if repair were removed because every surviving revision/node changes and the assertions reject every pre-commit identity.
- New user-facing strings use typed translation accessors; I found no constructed translation key or hardcoded user-facing prose.
- No writing-command or transaction changes bypass the central Rust save entry point.

READINESS: NOT READY

Codex session ID: 019fc843-f96e-7113-8d5d-f7e3f2b07f20
Resume in Codex: codex resume 019fc843-f96e-7113-8d5d-f7e3f2b07f20
