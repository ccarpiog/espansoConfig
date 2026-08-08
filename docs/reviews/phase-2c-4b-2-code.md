NOT READY

## Findings

### Medium — The one-shot reapply authorization is keyed to a derived model, not to the conflict

**File:** `src/lib/browser/saveOutcome.ts:1122`

`REAPPLY_AUTHORIZATIONS` is keyed by `ConflictModel`, although the conflict identity registered by
`BrowserState` is `ConflictModel.source`. Calling `describeEditSave` twice for the same
`ConflictResult` produces two model objects and therefore two confirmations. The comment at
`saveOutcome.ts:1142-1148` notices that split but says the origin/generation check covers it. It does
not: after the first model installs the conflict snapshot, the second model's fresh token passes
authorization and `BrowserState.adoptDiskVersion` returns `alreadyThere` at
`workspace.svelte.ts:1793-1800` before it checks the now-changed projection generation. Both reapply
attempts therefore receive a successful adoption and can hand back separate rebuilt destructive
sessions from one wire conflict. The current shared test calls twice with the same model object, so
it cannot expose this case.

**Specific fix:** key the memo by `conflict.source`, so a second model of the same wire conflict gets
the first model's confirmation and is refused by `authorizeDiskAdoption`; add a real
`BrowserState` test that describes one `ConflictResult` into two `ConflictModel` values and requires
the first reapply to succeed and the second to return `adoptionRefused`. Correct the decision
record's claim that origin/generation already covers this case.

### Medium — The conflict fixture claims a revision/content pairing that its types and builder do not enforce

**File:** `src/lib/browser/fixtures.ts:660`

The JSDoc says making `disk` required prevents a test from asserting a payload the boundary cannot
produce, and `docs/decisions/2c-4b-2-notes.md:30` strengthens that to “no case can pair a revision
with a projection of other bytes.” `makeConflict` only copies the ordinary string in
`disk.revision` into `disk_revision`. A caller can freely build a `DocumentView` whose revision is
unrelated to its projected fields, and `diskText` is independently overrideable (and defaults to a
fixed string unrelated to the projection). Nothing computes a content revision or binds these
values. This is exactly the unbound-pair guarantee the repository requires prose to disclose.

**Specific fix:** narrow both sentences to the property actually forced: the fixture makes the
`disk_revision` field equal the supplied projection's `revision` field. State in the same sentence
that TypeScript and this fixture do not prove either field is the hash/projection of `disk_text`.

### Low — The renewed-deletion-confirmation assertion compares identities minted together

**File:** `src/lib/browser/matchDeletion.test.ts:709`

The test says the renewed confirmation “really does resolve against the new parse,” but both
`answer.session.match` and `live(disk)` come from the same `target`/`disk` fixture. Replacing
`confirmDelete`'s live-projection argument with the rebuilt session's own identity would leave the
assertions green. The older general deletion test catches that mutation, but this new reapply test
does not establish the reapply-specific claim it makes.

**Specific fix:** after the reapply, request deletion and then pass the identity (or absence) from a
further reprojection; require confirmation to refuse. Keep the existing positive assertion as the
separate proof that the newly rebuilt session can be confirmed while its projection is still live.

### Low — The shared-module contract claims callers cannot bypass a helper that is bypassable

**File:** `src/lib/browser/reapply.ts:60`

The module contract says a surface “cannot reach the adoption without going through
`adoptForReapply`.” Both `reapplyAuthorizationFor` and `BrowserState.adoptDiskVersion` are exposed,
and `confirmReloadDiskVersion` can also mint the accepted token type, so TypeScript does not force
that route. The six transitions currently do use the helper; that implementation fact is the
narrowest guarantee available.

**Specific fix:** say that all six transitions in this change route their adoption through
`adoptForReapply`, and disclose in the same sentence that the exported authorization/adoption APIs
do not prevent another caller from composing the operation directly.

## Confirmed properties

The match editor implements all six Q4 rows. In particular, `fieldIntent` keeps an initially absent
blank field `Unchanged`; the fresh baseline recomputes field eligibility; match-level hazards are
rechecked; and any collision returns only `manualResolution`, without adoption or a rebuilt session.
Creation retargets its draft and clears consent; deletion and duplication start fresh drafts;
duplication therefore drops the content-addressed `DuplicateKeepsTriggerDefinition` consent; and
deletion returns with no pending confirmation. Move compares full `SequenceAddress` values, rebuilds
its members and anchors from the conflict projection, lowers `top`/`end` afresh, uses exact evidence
only for an authored `after`, produces one ordinary move request, and reports `alreadySatisfied`
without a command.

Raw reapply is permanently unavailable. No merge, stale write retry, force path, projection-based
rebuild, node/index carryover, trigger-only destructive correspondence, partial field save,
automatic retry, old consent reuse, or weakened carriage-return gate was added. There is no
`keepMyDraft` member, choice-list change, component change, or new dictionary key. Replacing the
planned temporary `offersReapply: false` with permanent `reapplySupport` is sound for transition
gating, and the unchanged `ConflictChoice`, unchanged `conflictChoicesFor`, and untouched `.svelte`
files—not that capability—are what guarantee this step draws nothing.

`npm test -- --run` passes 1,585 tests in 49 files; `npm run check` reports 418 files with zero errors
and warnings; `npm run build` transforms 175 modules; and `git diff --check` is clean.
