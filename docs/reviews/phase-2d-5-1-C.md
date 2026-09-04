Reviewer: autoclaude adversarial reviewer

# Phase 2d-5-1-C — review of one comment in `src/lib/browser/restore.ts`

Scope confirmed: `git show --stat 1d623dc` lists four files; three are on `CLAUDE.md` §7's closed
record list. The only source hunk is `restore.ts` `-3/+10`, all `//` lines. Line numbers re-derived
on the working tree (clean): comment `608-617`, declaration `618`, loop read `623`, write `624`,
exact-match return `629`, `return unnamedCreator` `638`. The brief's citations match.

## The four claims, derived

1. **Gated on `creatorEligible`.** `grep -n unnamedCreator` returns exactly four sites. The only
   non-initialiser write is `:624`, whose sole guard is the `if` at `:623` beginning
   `eligibility === 'creatorEligible' &&`. Everything the variable ever holds passed that gate. **True.**
2. **Gate false ⇒ nothing kept, answer `null`.** `CreatorEligibility` (`:513`) has two members, so
   "anything else" is `notCreatorEligible`; `:623` is then always false, `:624` unreachable, `:638`
   returns the `null` from `:618`. Independent of how many `unknown` targets the list holds — the loop
   has no other write. **True.**
3. **`:623` is a first-wins guard.** Second conjunct `unnamedCreator === null`. `surface.kind` is a
   string-literal union (`:340-353`), never nullish, so after one assignment the conjunct is false for
   every later `unknown` surface. **True.**
4. **`:638` is the deferred read; an exact match never reaches it.** `:629` `return surface.kind`
   exits from inside the loop; `:638` runs only on loop completion. `:623` does not wait for the list.
   **True.** The comment does not claim `:629` is the only in-loop return, so the `never` terminus at
   `:634` does not contradict it.

**Frequency.** No "once", "each", "every" or "per" in `608-617`. The one count phrase, "however many
such creators the list holds", counts list members, not executions. Both reads are named by location.
No frequency claim crept back.

**Two reads.** `:623` and `:638` are the only syntactic reads; `:618` and `:624` are writes. "Two
reads, two rules" is exact, and each rule matches its site.

**"Destination-less creator" verified, not assumed.** `OpenWriteSurface` (`:423-433`) gives the
non-`matchCreator` arm a `WriteSurfaceDocumentTarget`, so `target.kind === 'unknown'` implies
`kind === 'matchCreator'`. The noun is right.

## Findings

**Blockers: none. Should-fix: none. Low: none.**

Not a finding, recorded: because of that same union shape, dropping `&& unnamedCreator === null`
would change no returned value — every destination-less surface answers `'matchCreator'`. The comment
claims only that the guard preserves the earlier entry, which is true of the variable, and claims
nothing about the answer. Rewriting it would touch source for no truth gained.

Project rules checked and not in play: no user-facing string, no i18n key, no accessor, no Rust.

## NOT-VERIFIED

The four gates (`1320 / 436 / 2205 / 185`), clippy, fmt, `cargo tree`, both bundle oracles — taken
from the brief, not re-measured; `cargo test --workspace` is unsafe to run concurrently here and
nothing under `crates/`/`src-tauri/` changed. I did run `npx vitest run src/lib/browser/restore.test.ts`
myself: 221 passed. No window reading; none is owed by a comment.
