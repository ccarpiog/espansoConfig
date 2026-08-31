Reviewer: autoclaude adversarial reviewer

# Phase 2d-4b-G — review of 2d-4b-F's fix (commit `54ef596`)

Scope re-derived before reading any claim about it: `git show 54ef596 -- src/ | grep -c '^@@'` → **1**;
changed lines that are not comments → **0**. Run now `:446-469` (24) over an 8-line stub `:470-477`.

## Re-derived and correct

16 wrappers imported (`workspace.svelte.ts:44-59`), 13 in `REAL_COMMANDS` (`:315-329`), 3 in
`REAL_BACKUP_COMMANDS` (`:387-391`). `core.js:202` is `return window.__TAURI_INTERNALS__…`;
`vite.config.ts` `environment: 'node'`, no `setupFiles`/`globalSetup` (live run: `setup 0ms`);
`call()` catches, `classifyFailure` never rethrows. `invoked`: 1 at `DetailPane.test.ts:534`, 5 at
`RestorePane.test.ts:808/911/941/968/1084`, six distinct `it` blocks; both `afterEach` read `drains`;
both suites state the limit. Only four suites `vi.mock('@tauri-apps/api/core')` — `commands.test.ts`
and `menu.test.ts` have no `afterEach` at all, so **"no suite closes that route file-wide" holds**.
186 passed, live. "Nothing checks a comment" is strong: `ipc-detail.ts:83-88` masks comments by
design, `hardcoded-strings.ts` strips them.

## M1 (Medium, source) — the fix falsified a sentence 150 lines above it

`workspace.test.ts:316-317`: the `drains` docblock says the escaping route is "*stated in full where
the count is incremented*". True at `081ea14` (43-line paragraph), false now — `:466` says
"**They are not repeated here on purpose.**" The `afterEach` at `:503-505` says only "*stated where*"
and survives; this one does not. The chain's signature shape: a narrower instance left standing.

## M2 (Medium, record vs source) — the pointer is not the one the record describes

`:468` cites `2d-4b-notes.md` **§11**. `2d-4b-notes.md:943`, `:1090`, `PROGRESS.md:223,239` all say
§11.8, which exists only to be "*what the pointer must find*". §11 resolves, but opens 156 lines
earlier — inside §11.1, which still carries `DetailPane.test.ts:164-168` and
`RestorePane.test.ts:439-443`, the citations the restructure removed *because nothing keeps them
true*. One of the two texts is wrong.

## M3 (Medium, record) — §11.8 claims more than it delivers

`2d-4b-notes.md:945`: "*Every figure is re-derived below rather than copied*". False of the **254**,
by claim 2's own "*never been broken down per file*" and §11.7 item 2's "*none has re-derived it*";
claim 1 rests on "*Confirmed at rounds C, D, E and F*" — a citation, not a derivation. Wider than its
predicate, in the target the comment now rests on.

## L1 (Low, source)

`:461-464` defers three of §11.8's four claims and omits the 16/13/3/2 split, and calls the 254/186
figures "the measurements behind **that claim**" — they are evidence about the two routes, not about
file-wide closure.

## NOT-VERIFIED

- Workspace gates (`cargo test`, clippy, fmt, `npm run check`/`build`, bundle oracles) not run;
  baseline `1320/434/2175/184` taken from the brief.
- The **254**: re-deriving it means mutating source.
- 2d-4b-B's binding probe against the two component suites: still unrecorded.
- §12.5 items 1-6 acknowledged, not re-filed.

## Where it is thin

1. "Closes that route" is now undefined at the site; its meaning lives only in the notes —
   **recorded only**.
2. "Six review rounds" at `:468`: cross-file line ranges entered at `e510819`, so three rounds
   carried them — **recorded only**.
3. Thirteenth consecutive Opus round, one provider — **recorded only**.
4. M1's class is unbounded: nothing ties a comment to the text it describes — **recorded only**.
