Reviewer: autoclaude adversarial reviewer

# Phase 2d-5-1 — adversarial review

## Blockers

None. No correctness defect found in a source file.

Verified rather than assumed: the shipped `OpenWriteSurface` is the consult's declaration
(`phase-2d-5-design.md:51-63`) with two names substituted — a non-creator kind with an `unknown`
target is not representable. Both predicates switch on `target.kind` with a real `never` terminus
(`restore.ts:487-494`, `:601-604`), and `EVERY_TARGET`/`EVERY_ORIGIN` (`restore.test.ts:826`,
`conflictSource.test.ts:82`) genuinely fail to compile on a new arm — `satisfies Record<Union['kind'],
true>` over a literal missing a member is an error, not a lookalike. `competingSurfaceFor` still
answers `null` for an unknown creator. `conflictChoicesFor` and `adoptDiskVersion` are untouched; no
second producer, no second door. The two `WeakMap` memos have no check-and-spend shape (a `get` is
non-consuming, and a `WeakMap` key fires no proxy trap), and the shallow-freeze claim is exact and
tested. No production import of `src/lib/ipc/events.ts`. Both new keys are reachable only through
`tConflictOriginMessage`; ES is faithful to EN; `this app` and the ASCII apostrophe match the
dictionary's own usage.

## Should fix — all in the record, except item 3

1. **`docs/decisions/2d-5-1-notes.md` §2 overclaims the mounted evidence.** It says the rewritten
   producer is "covered by the existing mounted `DetailPane.test.ts` suite, which runs it through the
   paths that open and close each surface". It does not. `openWriteSurfaces()` has exactly one caller
   — `surfaces={openWriteSurfaces}` at `DetailPane.svelte:966` — inside the `{:else if restoring !==
   null}` branch of the chain that starts `{#if editing !== null}` at `:844`. While RestorePane is
   mounted the other five conditions are false by construction, so five of the six rewritten literals
   cannot execute in production or in any test. Only the `restore` literal is exercised. This is an
   evidence claim the code does not give, in the paragraph that justifies skipping a window reading.

   **On the reading itself, plainly: it is not owed.** No markup, no prop, no reactive statement
   changed; the one reachable literal is executed by the two restore-open cases; the six expressions
   are unchanged from the diff's left side, so behaviour is identical. But the ground recorded for
   that conclusion is false and must be replaced by the true, stronger one.

2. **§5's case attribution is wrong.** Measured on a pristine `git archive HEAD` tree:
   `restore.test.ts` 205 → **218** (+13, not the recorded 15), `conflictSource.test.ts` +12, and
   `scripts/lint/ipc-detail.test.ts` 128 → **130**, because its `it.each(scannableFiles())` at `:79`
   gains one case per new file under `src/`. Total 2202 is right; 15+12 is not, and the third file
   appears in neither §1.1 nor §5.

3. **`restore.test.ts` `coordinator()` (~:529) now models the opposite of production.** Its filter
   keeps an unknown-target creator open and §2 calls that "right"; `invalidateEverySurface` in
   `DetailPane.svelte` (comment at :529-535) closes the new-snippet form "whatever file it names",
   deliberately. No case drives it, so it is inert — but this is a **source** file under §7's closed
   list, so a fix here commissions a round; a fix confined to the notes does not.

4. Low: `targetingSurfaceFor` returns the *first* match, so an unknown creator earlier in the array
   shadows an exact document match later. Harmless for a yes/no question; the returned `kind` is what
   a 2d-5-4 sentence would name.

§7.3 marks are right as written: items 1-5 recorded only, item 6 actionable and naming no correctness
defect in source.

## Not verified

- No window reading exists and I took none; item 1 is my judgement, not evidence a window drew.
- I did not re-run `cargo test`/`clippy`/`fmt`, `npm run check` or `npm run build`; I relied on the
  orchestrator. `git status` confirms nothing under `crates/` or `src-tauri/` changed, so the recorded
  concurrent-`cargo test` hazard cannot bear on this step's source. I did re-run `npm test` myself on
  both HEAD and the working tree.
- Whether the Spanish reads naturally to a native speaker; I checked faithfulness only.
- `ConflictSource`'s fitness for 2d-5-5 — no consumer exists, as the notes state.
