NOT READY

## Findings

### Medium — `adoptForReapply` claims a one-spend guarantee that its callback boundary does not enforce (introduced by the fix round)

**File:** `src/lib/browser/reapply.ts:368`

The rewritten JSDoc says this helper *forces* one wire conflict to yield at most one successful
adoption. It does not. `adoptForReapply` passes the memoized token to an ordinary
`AdoptTheDiskVersion` callback and returns whatever that callback says; calling it twice with the
same conflict and `() => 'installed'` produces two successful answers. The real
`BrowserState.adoptDiskVersion` does enforce the spend, and all five production match transitions
currently pass that method, but the callback type does not bind that implementation. The record
repeats the false guarantee at `docs/decisions/2c-4b-2-notes.md:104`, despite the existing callback
limit already being disclosed for the match editor at `matchEditor.ts:2001-2004`. The current shared
test supplies its own miniature token-checking door, so it proves the memo/key behavior it
implemented, not that the helper forces the door to behave that way.

**Specific fix:** state the implementation fact narrowly: with the real
`BrowserState.adoptDiskVersion` callback used by the five match transitions, the source-keyed memo
and the window's spend check permit at most one successful adoption per wire conflict. In the same
sentence disclose that an arbitrary `AdoptTheDiskVersion` callback can ignore both token and spend;
make the same correction in the decision record.

### Low — The surviving door description still puts `alreadyThere` behind a generation check (survivor of round 1 F1)

**File:** `src/lib/browser/reapply.ts:358`

The header and `adoptForReapply` JSDoc say the existing door applies its origin and
projection-generation checks, and the decision record enumerates “its five existing checks” at
`docs/decisions/2c-4b-2-notes.md:85-89`. `BrowserState.adoptDiskVersion` does not always apply the
generation check: after authorization, spend, origin and projected-document checks, it returns
`alreadyThere` at `workspace.svelte.ts:1793-1800`; only an installation request reaches the
generation comparison at `workspace.svelte.ts:1802`. The corrected paragraph at
`saveOutcome.ts:1165-1169` now says that ordering accurately, but the sweep left the narrower old
claim in the shared module and the record.

This does not reopen the production defect: equal content revisions mean the requested bytes are
already held, and `alreadyThere` spends the token. It does leave two contracts claiming a guard the
successful arm does not execute.

**Specific fix:** say that origin and projected-document checks precede every successful answer,
that `alreadyThere` is decided and spent before generation is inspected, and that the generation
check guards only the branch that would install the conflict snapshot.

### Low — The fix-round record miscounts its mutations and says test/comment fixes were production-code fixes (introduced by the fix round)

**File:** `docs/decisions/2c-4b-2-notes.md:304`

The record says six one-line mutations were run, but the table now contains A through H and its own
line 318 calls them eight. G and H are the two mutations added by this fix round, so the old count
survived the addition. The same new review section says at lines 347-351 that all four round-1
findings “are closed in production code.” Only F1 changed production behavior; F2 narrowed fixture
JSDoc, F3 strengthened a test, and F4 narrowed contracts. Those closures are real, but the stated
location/class of three of them is not.

**Specific fix:** change “Six” to “Eight,” and change the round-1 summary to say all four are closed,
with F1 closed in production code and F2-F4 closed in the fixture/test/contracts where the false
claims lived.

## Confirmed closures

F1 is closed in production code. `REAPPLY_AUTHORIZATIONS` is a
`WeakMap<ConflictResult, ReloadConfirmation>` keyed by `conflict.source`; two models describing one
wire result receive the same token, and the token/model binding makes the second model fail
`authorizeDiskAdoption`. The real-window test constructs two models from one `SaveResult`, so it
exposes the former defect. With `BrowserState.adoptDiskVersion`, a refused adoption does not enter
`spentConfirmations`; `installed` and `alreadyThere` do. The source memo plus the real door therefore
gives one successful spend per wire conflict. `alreadyThere` deliberately precedes the generation
check; an installation still cannot pass after the projection generation moves.

F2 is closed. Both `ConflictOverrides.disk` and `makeConflict` now claim only the equality actually
constructed (`disk_revision === disk.revision`) and disclose that neither revision/text hashing nor
projection/text/identified-item pairing is forced by TypeScript or the fixture.

F3 is closed. The deletion case keeps the positive same-projection assertion but labels its limit,
then builds a third projection at `LATER`, proves its live identity differs from the rebuilt
session's, and requires `confirmDelete` to return `null`. That negative half fails the named
compare-the-session-with-itself mutation and reaches the branch under test directly.

F4's original bypassability claim is closed. The module header now says the five match transitions
use `adoptForReapply` as an implementation fact, discloses the exported APIs that permit direct
composition, and correctly excludes raw: raw's transition takes only its session and reaches no
adoption function. The new overstatement in the helper's own JSDoc is finding 1 above.

## Confirmation sweep

The five production match transitions decide correspondence, eligibility, placement and field
collisions before calling `adoptForReapply`, and all stop only on the `refused` arm. Raw remains
permanently unavailable and has no adoption parameter. The projection-generation guard still
prevents installing a stale conflict snapshot when installation is required. No test exercises a
manual-resolution arm through an unreachable production mode while claiming wire coverage; the
record discloses the fixture-only evidence-shape and second-sequence cases.

No step-3 work leaked in: `ConflictChoice` has no `keepMyDraft` member,
`conflictChoicesFor` is unchanged, no `.svelte` or dictionary file changed, no control was drawn,
and no user-facing string was added. The rest of the step diff showed no additional production
defect beyond round 1's confirmed properties.

`npm test -- --run` passes 1,587 tests in 49 files, and `git diff --check` is clean.
