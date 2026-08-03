## Low

1. [MatchEditor.svelte:473](/Users/ccarpio/Developer/espansoConfig/src/lib/components/MatchEditor.svelte:473) — the caption claims every refused value is shown “as the file writes it,” but `notScalar` values render only a localized shape name at line 488.

   Concrete failure: a nested sequence in `triggers:` is presented under that caption as “a list”; those words are not the YAML bytes in the file. This is another guarantee the screen does not give.

   Suggested fix: render `valueAsWritten` only for `text` arms. Give `notScalar` arms a separate caption explaining that the value’s shape is named because its text is not displayed.

2. [en.json:177](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/en.json:177) and [es.json:177](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/es.json:177) — the `unmodelledShape` refusal says the app “cannot show what it holds,” while `shownValuesOf` retrieves `UnknownEntry.value_text` at [matchEditor.ts:864](/Users/ccarpio/Developer/espansoConfig/src/lib/browser/matchEditor.ts:864) and the component displays it through `SourceText`.

   Concrete failure: opening an editor over an unmodelled mapping shows its source text immediately above a sentence claiming that text cannot be shown.

   Suggested fix: say the value is shown read-only but cannot be edited as a single text field.

3. [en.json:202](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/en.json:202) and [es.json:202](/Users/ccarpio/Developer/espansoConfig/src/lib/i18n/es.json:202) — `cannotReproject` gives one specific explanation (“no longer showing the file”), but `reprojectMatch` can return `null` while the same file remains selected.

   Concrete failure: while saving snippet A, select snippet B in the same file. Adoption preserves that selection; `reprojectMatch(A)` returns `null`, the reload control is correctly disabled, but the sentence falsely says the window is no longer showing A’s file. The same mismatch can occur when post-commit adoption fails.

   Suggested fix: use a reason-neutral sentence such as “This window does not currently hold a fresh projection of this snippet,” or return a typed reason from `reproject`.

The earlier four code findings are otherwise fixed:

- `MatchEditingSession` captures the match and file together; the header uses `open.file`, saving uses the session identity, and reprojection accepts only an exact live identity.
- `needsReprojection` is session state, is set on commits, survives every transition including `keepEditing`, gates all mutations, and is reset only by `startMatchEditor`. There is still an enabled Stop editing escape; only its explanatory sentence is inaccurate as described above.
- `MatchSaveAnswer` has exhaustive `answered`, `notAttempted`, and `failed` arms. A failed command without an `IpcFailure` is no longer representable. The remaining nullable failure reason is justified by `notAttempted` and the unchanged raw-editor boundary.
- `UNTOUCHED: MatchDraft` is a complete typed literal. Adding a twenty-third required property would make it fail compilation.

I also confirmed the ordering implementation uses scalar starts, the minimum item start for a list, stable sorting for ties, and a stable unlocated partition. `spanStartOf` handles all five `ValueView` arms consistently. Rust’s `scalar_sequence()` emits only `Scalar` or span-bearing `Elided` items, so the current projector cannot reach the unlocated branch.

The CR gates, absent-blank behavior, committed-outcome/adoption reporting, textual word-boundary controls, i18n accessors, and absence of direct IPC command imports from Svelte remain intact.

READINESS: NOT READY

Codex session ID: 019fc6d7-3605-7bf3-9408-a8583d555def
Resume in Codex: codex resume 019fc6d7-3605-7bf3-9408-a8583d555def
