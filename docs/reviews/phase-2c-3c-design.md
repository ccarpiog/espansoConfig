# Phase 2c-3c — Duplicate design consult

`OWNER DECISION` — Phase 2c-3c builds a **true duplicate**: it copies the existing match's exact
owned source bytes and inserts that copy. It is not a `NewMatch` reconstructed from the projection,
and this consult does not reopen that choice. The operation must preserve key order, scalar spelling,
unknown fields, comments, line endings and every other source fact carried by the item.

`VERDICT` — Add one batch-only core edit named `DuplicateItem`, make the product operation mean
**duplicate immediately after the source in the same sequence**, and leave the duplicate's trigger
definition byte-identical. The save transaction should interrupt the first attempt with a new
acknowledgeable suspicion that says only the provable thing: the duplicate keeps the same trigger
definition. Split 2c-3c into three checkpoints—core primitive, command/model integration, then the
component and screen evidence—because the preservation proof is substantial enough to review before
any identity or presentation work rests on it.

`Q1` — The primitive should be `DuplicateItem { item: DocumentPath }`, with the landing fixed to the
slot immediately after `item`. “The exact source subtree” must mean the item's **owned physical-line
runs**, not `MatchView.source_text`, not the syntax node's span, and not the contiguous ownership hull.
The existing machinery already supplies the definition:

- `editable_sequence_item` establishes that the path names an item of a safe block sequence;
- `item_own_lines` independently bounds the item's physical lines and includes the contiguous leading
  comment-only block which `leading_comment_block_start` gives to the item;
- `entry_owned_runs(source, index, trivia, item, item)` gives those lines minus the file-owned comment
  lines and the blank runs which keep those comments file-owned; and
- `lift_item`/`removal_envelope` demonstrate the same run-based ownership answer for move and remove.

The clone therefore includes the owned leading comment block; the sequence dash; every key, value,
unknown subtree and nested collection; block-scalar headers and bodies; inline comments; trailing
spaces; and each copied physical line's original LF, CRLF or bare-CR bytes. It does **not** copy a
blank separator above the leading comment block, a file-owned comment inside the hull, or the blank
runs which keep that comment file-owned. Those bytes are not the item's subtree under the existing
ownership rules. A comment on the item's last line and that line's terminator are owned and do copy;
layout after the last owned line does not.

Do not call `lift_item` wholesale if doing so imports a refusal whose premise is deletion. A duplicate
leaves the source in place, so it creates no `MoveSeam::SourceCloses`, never exposes the source-side
kept-comment join, and cannot extend a neighbour by removing the source. Factor or reuse the owned-run
derivation below those removal-only checks. At the destination it still creates the other move-class
seams: arrival lands, arrival closes, and one internal seam for each adjacent pair of copied runs.
The three synthetic fixtures named in `CLAUDE.md`—`move-block-scalar-seams.yml`,
`move-run-joins.yml` and `move-kept-comment-joins-a-block.yml`—must each get duplicate cases. Their
accepted/refused rows will differ from move exactly where the absent source-close seam says they
should, not because duplicate has a looser ownership rule.

No item byte is rendered, decoded, re-encoded, re-indented or re-terminated. The insertion replacement
is the source runs concatenated in order. The one allowed non-item byte is the same EOF seam
`InsertItem` already needs: when the landing is an unterminated end of file, copy the locally observed
line ending **in front of** the clone, so the source becomes terminated, the clone retains the source
item's unterminated bytes, and the file remains without a final newline. If `line_ending_before` finds
no expressible evidence, return `NoObservableLineEnding`; never default to LF. This is pure byte-copy
plus insertion-seam handling, not reformatting the copied subtree.

The primitive needs its own verification expectation, not an `InsertItem` expectation pretending the
copy was synthesized fields. Independently verify: one zero-width arrival at the derived boundary;
the arrival's item bytes equal the concatenation of the original owned runs byte-for-byte (apart from
the separately identified EOF separator); every original sequence item remains in its original order
and with its original digest; the inserted position has the source item's subtree digest; existing
file-owned comments survive; and the copied owned comments have the same relative ownership inside
the clone. Scan candidate trivia for this operation, as move does, because byte equality alone cannot
detect a seam changing a comment's owner.

Name the failures for duplicate rather than reporting move or removal prose. At minimum the design
needs equivalents of `MoveCarriesMoreThanTheItem` and `MovedBytesWereRewritten`, a batch-only refusal,
the no-observable-line-ending case, an unterminated-copy case if the EOF-prefix rule cannot represent
it, a terminal keep-chomped-block refusal, and block-scalar seam refusals which identify landing,
closing or copied-run joins. `RemovalCarriesMoreThanTheEntry` is the right independent-bound pattern,
but `Removal…` is the wrong wire-facing provenance. The original item must remain byte-identical; any
replacement covering a non-zero source span is itself a verification failure.

`Q2` — Write the clone byte-exact and unmodified. Do **not** clone and edit the trigger in one batch.
`DocumentEdit::DuplicateItem` should be the only edit in its batch, enforced by a named
`DuplicateMustBeTheOnlyEditInItsBatch` refusal. That is a deliberate scope rule analogous to R25,
not a claim that R25 already mentions duplicate. It gives verification one operation to prove and
prevents a later caller from quietly turning “duplicate” into “duplicate except for one rewritten
field.”

There is a small documentary tension worth recording. `docs/decisions/2c-split-notes.md` §4 describes
the true-duplicate branch as cloning the subtree and changing “only what must be unique,” but neither
`NewMatch`, `validate`, espansoConfig's typed model nor any command establishes that a match trigger
must be unique. The owner's newer, more specific decision says exact source clone, and D2u forbids the
application from inventing semantic meaning for a scalar. Nothing has been shown to “must” change.
The correct disposition is exact clone plus an honest risk warning, not a synthesized trigger and not
a claim that the duplicate trigger is invalid.

`Q3` — Warn through the existing finding/acknowledgement protocol, on the first save attempt and before
any backup or commit. Add a transaction-produced `FindingCode` such as
`DuplicateKeepsTriggerDefinition`, classify it `SuspiciousButPermitted`, attach it to the inserted
match's candidate path/span/node, and let `verdict` plus `Acknowledgement::covers_all` perform the
normal exact-multiset round trip. The English and Spanish copy should say: the duplicate keeps the
same trigger definition as its source, and this application cannot determine how espanso will choose
between overlapping definitions. It must not say “invalid,” “will collide,” “will not work,” or which
match wins.

This finding belongs beside `DocumentDoesNotParse` as a save-transaction-produced code rather than as
a new UI-only consent mechanism. `validate` currently has eleven codes, ten produced by its pure
projection pass and `DocumentDoesNotParse` produced by replacement mode. There is **no** match-trigger
uniqueness rule today; `DuplicateVariableName` is scoped only to variables. A generic validator rule
for repeated trigger text would newly interrupt unrelated saves of pre-existing files and would still
not prove espanso collision semantics. The operation-specific finding reports exactly what this
operation did and nothing broader. A post-save `PresentationNote` is too late, and an unacknowledged
UI notice would bypass the content-bound refusal protocol.

Produce the warning when the source has one modelled trigger form (`Single`, `Multiple` or `Regex`).
If the source has none or several, the existing `MatchHasNoTriggerField` or
`MatchHasSeveralTriggerForms` editor-model finding already wins in `verdict`; the new warning must not
weaken that precedence. Adding the code also means updating `FindingCode::ALL_NAMES`, reachability and
class tests, the Rust dictionary contract, the frontend finding-code union and its typed
`describeFinding`/reactive accessor path—never a hand-built dictionary key.

`Q4` — The minimal honest product is **immediately after the source, with no placement choice**. The
action is then unsurprising, needs no destination panel, and can derive the clone's candidate path as
the source sequence plus `source_index + 1`. Put that arithmetic on `DuplicateItem` itself, as
`ItemMove::resulting_index` and `ItemPlacement::items_above` already do, so the planner and command do
not keep two copies.

Do not reuse creation's full `Front | After | End` product surface in this phase. It would make a
simple duplicate inherit destination selection, anchor liveness, filtered-list explanations and more
ways for an identity to become stale without improving the preservation claim. It can be widened
later through the same placement vocabulary if an observed use needs it.

The clone stays in the source's own sequence and therefore in the same document and file. The core
edit protocol patches one source string, so cross-file copy is not expressible without a second-file
transaction; cross-sequence copying would require proving indentation and semantic context rather
than copying bytes. D2r is formally a move restriction, but its rationale binds here: “same file” is
not a syntax context, while “same sequence” gives equal item indentation and one local insertion
boundary. Do not claim D2r itself forbids cross-sequence duplicate; record same-sequence duplicate as
this phase's own scope.

`Q5` — Add the twelfth command, `duplicate_match`, not a mode of `create_match`. Creation takes a
`DocumentId`, a closed `NewMatch` projection and a `NewMatchPosition`; duplicate takes an existing
source identity and must never pass through `NewMatch::fields()`. Its wire arguments should be exactly
`id: MatchId`, `base_revision: ContentRevision`, and `acknowledgement: Acknowledgement`.

The `WorkspaceSession` method should call a `duplicate_one_match` helper which follows
`delete_one_match`'s identity discipline: `view_at` first, resolve the held identity to its sequence
item, construct exactly one `DocumentEdit::DuplicateItem`, derive the landed path with the primitive's
own arithmetic, and call `run_one_save(..., SaveContent::Edits(&edits), ..., Some(&landed))`. If the
existing `addressed_item` helper is reused, do not leak `MoveNotWithinOneSequence` as the user-facing
reason for a duplicate; generalize the internal resolution or add a duplicate-specific command code.

The Rust command answers `Result<SaveResult, CommandError>`, as all writing commands do. The frontend
`BrowserState.duplicateMatch` wrapper answers `Promise<MatchSaveAnswer>`, as `saveMatch`,
`createMatch`, `deleteMatch` and the repaired `moveMatch` do. It must forward the caller's frozen base
revision unchanged and route every outcome through the existing adoption/cache policy. Register the
command in the Tauri invoke handler and add it to command-count, wire-shape and dispatch tests; a
twelfth function which exists but is not registered is not a command.

`Q6` — Add `matchDuplication.ts` as duplicate-as-a-value, using pure transitions and no component.
Its stable candidate is `Draft<MatchId>`, as deletion's is: the identity is the source bytes at one
revision, and the draft carries the base revision, submitted candidate and refusal consent even
though nothing is typed and there is no undo history. The session should also hold document and
sequence provenance, frozen eligibility, phase/submission/outcome, extra messages, send failure,
sticky `duplicated`, `invalidated` and `mayHaveWritten` facts, and the landed clone identity.

Eligibility should distinguish `notInDocument`, `readOnly`, `noSequencePosition`, and
`unsavedDraftInDocument`. The last is intentionally document-wide: duplicating one item commits a new
revision and invalidates **every** `MatchId` in that file, so a dirty draft for any match in the file
can be stranded, not only a draft for the source. Make the coordinator supply that required fact;
do not repeat `matchMove.ts`'s recorded hole by trying to follow an old `{document,node}` pair across
a reparse. Core hazard/refusal remains authoritative; a projection eligibility is an affordance.

> **Correction (2c-3c-3).** The **dirty** draft is the risk, but it is not the fact the coordinator
> supplies. What shipped — `documentHasUnsavedDraft` in `src/lib/browser/matchDuplication.ts` — is
> deliberately conservative and measures **any open match editor**, dirty or not, because `isDirty`
> is derived inside `MatchEditor.svelte`'s own session and no coordinator can observe it (**R36**,
> argued at length in `DetailPane.svelte`'s `unsavedDraftFor` JSDoc). A pristine editor therefore
> refuses the duplicate: over-refusing costs a person one closed editor, under-refusing strands
> their edits. The `unsavedDraftInDocument` name is kept for the risk; both localized sentences
> claim an open editor and no more.

Submission refusals should include, in precedence order: `mayHaveWritten`, `alreadyDuplicated`,
`saveInFlight`, `conflict`, `outOfDate`, and `notDuplicable`. The first arm is above every definite
claim by the standing rule that **the arm which claims less wins**. A committed duplicate, any owed
adoption, a conflict which installs a new projection, and a send that may have written all spend the
session; dismissal clears the panel, not those facts. A `committed: false` with no adoption owed
spends nothing, even if insertion makes that arm practically unreachable.

There is no destructive confirmation dialog and no editable placement to draft. `beginDuplicate`
must nevertheless take the source identity from the **live projection** and require all three fields
to equal the session's identity before producing a submission. As in `confirmDelete` and `beginMove`,
nothing in TypeScript can prove where that argument came from; say so beside the guarantee and have
the component derive view, eligibility and submission identity from one synchronous projection read.

The two-counter selection machinery binds the wrapper, not the session type. Installing or forgetting
the reprojected document must bump that document's `projectionGenerations` entry; changing selection
must bump the global `selectGeneration` in the same synchronous block. Neither counter substitutes
for the other and duplicate must not introduce a third spelling of their rules. If the source is
still selected when the answer arrives, follow `SaveResult.moved` to the clone; if the person selected
something else, do not reclaim selection.

`Q7` — Split 2c-3c into **three** reviewable steps while keeping it one sub-phase:

1. **2c-3c-1 — core duplicate.** Add `DuplicateItem`, its batch restriction, run derivation,
   destination seam gates, independent verification, the operation-specific finding and Rust model/
   persistence tests. No Tauri command, TypeScript or `.svelte` file. Prove byte-exact behaviour over
   LF, CRLF, BOM, Unicode, mixed endings, no-final-newline, leading comments, file-owned holes,
   block scalars and the three named move-seam fixtures.
2. **2c-3c-2 — boundary and model.** Add/register `duplicate_match`, route it through `run_one_save`,
   add wire/dispatch tests, implement `BrowserState.duplicateMatch`, and add `matchDuplication.ts`
   with model and wrapper tests. Add the typed i18n accessors and both dictionaries needed by the
   model, but no `.svelte` file. Exercise saved/refused/conflict/failure/adoption and selection-race
   arms, including `mayHaveWritten` and failed re-read.
3. **2c-3c-3 — component and evidence.** Draw the action and acknowledge/retry UI as a rule-free walk
   over the model view, add the mounted-component interaction test, run the full suites/build/module
   guard, and record a fresh English-and-Spanish window reading at the target size.

The first step is not optional bookkeeping. `edit.rs` must add a new verification class over
run-owned bytes and asymmetric copy seams; reviewing that beside a new command, cache adoption,
session state and a component would make a preservation defect hard to localize. None of the three
steps is independently the completed sub-phase: `CLAUDE.md` still requires model tests, a mounted
component test and a window reading before 2c-3c is done.

`Q8` — The largest implementation trap is treating the clone's returned identity as a convenience
rather than as the only safe continuation. `run_one_save` reparses and `after_a_save` refreshes the
document; after a committed insertion every identity in the file is stale. The helper's `at` must be
the clone's post-insertion path so `SaveResult.moved` names the clone in the fresh revision. A failed
post-commit read remains `Saved` plus failed adoption, never “duplicate failed”; drop the replaced
projection with `forgetTheReplacedDocument`. A `may_have_written` failure must attempt the cautious
re-read without asserting that the duplicate exists.

For selection, use `adoptTheDocumentOnDisk(document, source, moved)` semantics: select the clone only
if the source is still the selection that initiated the operation and `moved` resolves in the fresh
projection's own revision. Otherwise repair the current selection without hijacking it. On conflict,
install the supplied disk projection and mark the duplication session invalidated even though
`adoption` is `notOwed`, exactly as move does.

Duplicate is not draft undo. A pending session uses `Draft<MatchId>` only to carry consent; a committed
structural insertion is a save boundary and cannot be removed by the small editor's undo stack.
Calling a later deletion “undo duplicate” would overclaim: deletion has its own comment/seam rules and
may be refused. Until restore-from-backup exists in 2c-5, present duplicate as an ordinary committed
save with the normal backup fact, not as reversible UI state. Refuse while any dirty match draft in
the document would be stranded.

The i18n surface is larger than one button. Add English and Spanish keys for the duplicate action,
eligibility and submission refusals, warning/acknowledgement explanation, progress/saved/no-op states,
send uncertainty, adoption failure and any duplicate-specific command or patch error that reaches a
person. Every component must call typed accessors in `src/lib/i18n/index.ts`; finding and error enums
must go through `src/lib/i18n/codes.ts` and the Rust dictionary contract. No key is built in a
component. Re-check dictionary and placeholder parity, and measure the Spanish panel in the manual
window reading.

`WHAT THE PHASE MUST NOT SHIP WITHOUT`

- A byte oracle proving the inserted item equals the source's owned run bytes and the original is
  unchanged, plus independent bounds proving the planner did not copy a neighbouring blank line or a
  file-owned comment.
- Explicit asymmetric seam coverage: no source-close refusal, but landing, closing, copied-run and
  terminal block-scalar refusals where their conditions hold.
- A batch-only duplicate, an unmodified trigger definition, and an acknowledgeable warning which
  claims risk rather than espanso semantics.
- Same-sequence, immediately-after placement and a returned clone identity minted from the fresh
  projection.
- `MatchSaveAnswer` parity, including refusal, conflict, `mayHaveWritten`, failed adoption,
  `committed:false`, `forgetTextOf` and total stale-projection removal after a known commit.
- Document-wide dirty-draft coordination, live-projection submission validation and selection that is
  never reclaimed after the person moves it.

  > **Correction (2c-3c-3).** "Document-wide **dirty-draft** coordination" is **not** what shipped,
  > and a future session must not read this criterion as met. What shipped is document-wide
  > **open-editor** coordination — the deliberate over-refusal recorded in the Q6 correction above
  > and in `documentHasUnsavedDraft`'s JSDoc in `src/lib/browser/matchDuplication.ts` (**R36**:
  > `isDirty` is unobservable from outside `MatchEditor.svelte`'s session, over-refusing costs one
  > closed editor, under-refusing strands edits).
- Rust/model/wrapper tests, a mounted interaction test, and a fresh bilingual window reading.
