Reviewer: autoclaude adversarial reviewer

# Phase 2d-4b-H — review of 2d-4b-G's fix (commit `07744ae`)

Scope re-derived before reading any claim about it: `git show 07744ae -- src/ | grep -c '^@@'` → **2**;
`git show 07744ae --numstat -- src/` → **11 added, 10 removed**; non-comment changed lines → **0**.

## Re-derived and correct

`:466` cites §11.8 and it resolves to `2d-4b-notes.md:942`. The enumeration at `:462-465` matches
§11.8's four claims **in both directions** — wrapper split, two routes, swallowing, partial trap.
Claims re-checked against code: 16 wrappers imported (`workspace.svelte.ts:44-61`), 13 in
`REAL_COMMANDS`, 3 in `REAL_BACKUP_COMMANDS`; `core.js:202` is
`return window.__TAURI_INTERNALS__.invoke(...)`; no `vi.mock`/`@vitest-environment` in
`workspace.test.ts`; `invoked` asserted 1× (`DetailPane.test.ts:534`) and 5×
(`RestorePane.test.ts:808/911/941/968/1084`) across six distinct `it` blocks, never in an `afterEach`;
`npx vitest run src/lib/browser/workspace.test.ts` → **186 passed**, live. Question 2: docblock
`:316-317`, increment site `:453-459` and `afterEach` `:505-506` now agree — none of the three claims
completeness. §13.2's "byte-identical at `081ea14`" verified.

## S1 (should-fix, record) — the replacement overclaims where the original did

`2d-4b-notes.md:946`: "**Each figure below says how far it has been checked**". Below, claim 2 states
the **254** and says only that it has never been broken down per file — a granularity limit, not a
check status; the words that give its status ("*none has re-derived it*") are §11.7 item 2's, i.e.
*above*, in a different subsection, and "carried forward from the phase that recorded it" appears only
in the preamble itself. Claim 3's figures and claim 4's once/five/six carry no check status at all.
Same sentence position, same shape as the M3 it replaces. Relatedly, "*which claim 2 … contradict*" is
loose: claim 2's own words never say the 254 was not re-derived.

## S2 (should-fix, record) — §11.8 contradicts itself about citations

`:986`: "**Line citations are deliberately absent from this subsection's four claims.**" Claim 3 at
`:971` cites `node_modules/@tauri-apps/api/core.js:202` — a line citation, into an untracked
version-pinned file that a dependency bump falsifies silently and no gate reads. Correct today
(verified). This is the paragraph that explains why the comment stopped carrying citations.

## S3 (should-fix, record) — the recorded source-diff figure omits one of the two fixes

`2d-4b-notes.md:1201` and `PROGRESS.md:254,296,465` all say the source diff is **`+9 / −8`**. It is
`+11 / −10`; `+9/−8` is hunk 2 alone and drops the `:316-317` docblock hunk — M2's entire fix.
`PROGRESS.md:465` names both hunks and then gives one hunk's arithmetic. That figure was handed to this
round as its scope bound.

## L1 (Low, record) — an off-by-one line citation inside the citation-hygiene round

`2d-4b-notes.md:1157` (and the brief) cite the `afterEach` as `:503-505` and quote "*are stated where
{@link drains} is incremented*". That text is at `:506`; `:503-505` is the three lines before it.
§10.3's shape, in the round that fixed a pointer.

## §13.7 item 2

Agreed as marked. "Six review rounds" reads against *counts and line ranges*; counts have been repaired
in each of B–G, so **recorded only** stands. Not re-filed.

## NOT-VERIFIED

- Workspace gates (`cargo test`, clippy, fmt, `npm run check`/`build`/`test`, bundle oracles) not run;
  `1320/434/2175/184` taken from the brief. The diff is comment-only.
- The **254**: re-deriving it still means mutating source.
- 2d-4b-B's binding probe against the two component suites: unrecorded, as before.
- Whether §11.8's four claims were "carried in full" by the *pre-B* comment — checked at `081ea14`
  only.

## Where it is thin

1. `2d-4b-notes.md:946` and claim 2 both state "the 254 has never been broken down per file"; two
   statements of one fact, 10 lines apart, nothing checks either — **recorded only**.
2. S3's class: every phase in this chain records its own diff size by hand and none re-derives it from
   `git`. `git show <sha> --numstat -- src/` is the check — **actionable** (record, not source).
3. `core.js:202` is pinned to `@tauri-apps/api`'s current build; a bump falsifies §11.8 claim 3 and
   §11.3 with no failing gate — **recorded only**.
4. Fourteenth consecutive Opus round, one provider — **recorded only**.
5. The escaping route is still stated, not closed; 2d-5 owes three files (§13.7 item 5, not re-filed) —
   **recorded only**.
