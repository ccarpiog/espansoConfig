NOT READY

## Round-1 findings

### 1. High — closed

I checked `browser.reapply.ready` and `browser.reapply.readyOperation` in both
`src/lib/i18n/en.json:140-141` and `src/lib/i18n/es.json:140-141` against the five
match-surface reapply transitions and `adoptForReapply`. The strings no longer make safe
correspondence imply a pending form: they name `alreadySatisfied` and `reapplied` as possible
endings, retain the later-save refusal/conflict qualification, and explicitly say that however the
attempt ends it is reported and the reapply itself writes nothing. The Spanish carries the same
narrowing: `esto puede terminar` makes the two successes possibilities, while `Termine como
termine` makes clear that the list is not exhaustive.

The fixer's refusal to use the review's proposed “either … or” is **sustained**. Safe
correspondence is not the last predicate in any of these transitions: surface-specific validation
can still return `manualResolution`, and `adoptForReapply` can still return `adoptionRefused`.
Presenting the two successful shapes as an exhaustive pair would therefore introduce a smaller
false guarantee. The replacement closes the actual finding without doing that.

### 2. Medium — closed

I checked the four result strings at `src/lib/i18n/en.json:142-145` and
`src/lib/i18n/es.json:142-145` against `DiskAdoptionOutcome` and `attemptOfReapply`.
`reapplied` and `alreadySatisfied` now say the window *now shows* the disk version, which is true
for both `installed` and `alreadyThere` and no longer attributes an installation to this click.
`adoptionRefused` no longer claims that the refusal is permanent. English and Spanish say the same
narrowed facts: the window did not move, nothing was rebuilt or written, the retained work remains,
and the person can continue there or reopen from the file.

The fixer's refusal to quote “Keep editing” is **sustained**. `reapplyOutcomeKey` at
`src/lib/browser/reapply.ts:453-468` selects one shared `adoptionRefused` key and does not receive a
draft kind. The dictionaries map the operation-side way out to “Leave this as it is” / “Dejarlo
como está”, and `draftKind.ts:67-71` identifies the mover, deleter and duplicator as the three
operation-choice surfaces. Their components render the choice through the shared typed choice-key
path. A shared outcome sentence that named “Keep editing” would therefore name a control absent on
those three surfaces; “You can carry on here” / “Puede seguir aquí” avoids that error.

### 3. Low — closed

I read `adoptDiskVersion` at `src/lib/browser/workspace.svelte.ts:1778-1841` and checked all nine
corrected contract passages: the five `reloadTheDiskVersion` passages in `matchEditor.ts`,
`matchCreation.ts`, `matchDeletion.ts`, `matchDuplication.ts` and `matchMove.ts`; the raw editor's
`loadDiskVersion` passage; the `adoptionRefused` arm in `reapply.ts`; `DiskAdoption` in
`saveOutcome.ts`; and `ReloadStep.refused` in `editorSave.ts`.

Each now states the five refusal causes in the method's actual order: wrong-conflict confirmation;
spent confirmation; missing or wrong-document conflict origin; unprojected document; and generation
mismatch when the held projection does not already have the requested revision. Each also preserves
the load-bearing ordering fact: equality with the requested revision is guard 5, returns
`alreadyThere`, and spends the confirmation before guard 6 compares the generation. The
`ReloadStep.refused` header now correctly says the confirmation was *presented*, not spent. The
eight corrected test-side copies use the same complete list.

This closes the round-1 incomplete-list finding. A separate overclaim introduced immediately after
one corrected list is reported below as a new finding.

### 4. Low — closed

I checked `src/lib/components/RawEditor.test.ts:1102-1106` against
`conflictChoicesFor` at `src/lib/browser/saveOutcome.ts:454-469`. The comment now says the producer
requires both gates, matching the predicate
`offersReapply && reapplySupport === 'supported'` and the assertions below it.

## New finding

### Low — `src/lib/browser/editorSave.ts:270-273`: the permanence rewrite now promises that guard 5 will be reached

The rewritten `ReloadStep.refused` contract first correctly says that a refusal may have come from
any of `adoptDiskVersion`'s five refusal returns, but then says that because refusal spends nothing,
“a later press over a window that had meanwhile reprojected to the requested revision would be
answered `alreadyThere`.” Reaching that revision is not sufficient. `adoptDiskVersion` still checks
guards 1–4 before revision equality: a confirmation for another conflict, a spent confirmation, a
conflict this window did not produce (or whose disk document differs), or an unprojected document
still returns `refused` before guard 5 can answer `alreadyThere`. “Refusal spends nothing” only
rules out this attempt newly causing guard 2; it neither identifies the original refusal's cause nor
proves that all four earlier guards will pass on a later call.

This is the mirror-image regression the confirmation pass was meant to catch: replacing an
unconditional claim of permanent refusal with an unconditional claim of later success under one
state change.

Concrete fix: remove the `alreadyThere` example from this generic contract and say only that the
opaque refusal does not establish whether a later properly authorized ask would succeed or fail.
Alternatively, qualify the example explicitly: after a generation-mismatch refusal, if a later call
passes guards 1–4 and the window then holds the requested revision, guard 5 answers `alreadyThere`.

The remaining permanence rewrites do not introduce this overclaim. They say only that the UI
withholds a reload control after an opaque refusal and that this presentation decision does not
prove a later ask would be refused. That is truthful even though the terminal `refused` reload step
does not itself offer a second reload: the outcome carries no cause, a refusal does not newly spend
the token, and the remaining/fresh paths must still be judged by the guards they actually reach.

## Deliberate retentions

The six model-suite comments `// Asking again cannot spend anything a second time` are
**sustained**. In each tested value the first refusal changes the reload step from `confirmed` to
`refused`; `reloadTheDiskVersion` accepts only `confirmed`, so the second direct call returns the
same session without invoking the adoption callback. The comment describes that tested second call,
not permanence of the window predicate, and the adjacent call-count assertion proves it.

The comment at `src/lib/components/MatchDeleter.test.ts:388` is **sustained**. That test is not about
disk adoption. The live projection has replaced the deletion session's frozen `MatchId`, so
`identityInProjection` supplies a different-revision identity and `confirmDelete` returns `null`.
Asking the unchanged session again against that same live projection repeats the
`identityStaleRevision` mismatch; the only offered recovery is to leave and select an identity from
the current projection. The sentence is local to that fixture and does not reinstate the generic
adoption-permanence claim.

## Regression and scope checks

No production predicate moved in the fix round account: the widened edits are dictionary prose,
JSDoc, TypeScript comments, test comments, and two markup comments. The relevant executable
predicates remain `conflictChoicesFor`, `attemptOfReapply`, `adoptForReapply`, the five surface
transitions, and `BrowserState.adoptDiskVersion` as reviewed in round 1. The two `.svelte` permanence
edits at `MatchEditor.svelte:914-917` and `RawEditor.svelte:591-594` are inside HTML comments; they
do not alter rendered output, so they do not expand this pass into the later window-reading step.

Apart from the new generic-contract overclaim above, I found no narrower return of a round-1 claim:
the readiness text makes no form guarantee, the outcome text makes no installation or permanence
guarantee, all nine adoption lists contain all five refusal causes with `alreadyThere` in the right
place, and the raw-editor test comment retains both gates.
