# espansoConfig — project instructions

A macOS Tauri v2 app for editing espanso YAML configuration **without ever reformatting the
parts of the file the user did not edit**. `IMPLEMENTATION_PLAN.md` is the authoritative
specification; this file records only the rules that are easy to violate by accident.

---

## 1. Corpus privacy — read this first

**The GitHub repository is PUBLIC. The owner's live espanso config contains personal email
templates and must never be committed.**

- Committed test data lives in `crates/espansoconfig-core/tests/corpus/synthetic/` and is
  hand-authored with neutral content. No real names, addresses or email bodies, ever.
- The real config is copied on demand into
  `crates/espansoconfig-core/tests/corpus/real/`, which is **gitignored**
  (`.gitignore`, "Real-config test corpus — PRIVACY CRITICAL"). Populate it with
  `./scripts/sync-real-corpus.sh`; that script refuses to copy anything if the ignore rule is
  missing.
- Tests that use the real corpus **skip cleanly** when it is absent, so a fresh clone and CI
  both pass.
- Never quote real config content in a document, a commit message, a code comment or a report.
  File names, counts and error line numbers are fine; content is not.

After touching `.gitignore` or the sync script, verify:

```sh
./scripts/sync-real-corpus.sh
git check-ignore -v crates/espansoconfig-core/tests/corpus/real/match/base.yml
git status --short --untracked-files=all   # no real-config path may appear
```

## 2. Localization

**English and Spanish, both, from day one, via i18n** (plan §2 — a locked decision).
**Never hardcode a user-facing string.** Every label, message and error the user can see goes
through the i18n layer (`src/lib/i18n/{en,es}.json`).

All code, comments, documentation, README files and commit messages are in **English**,
including the Spanish translation files' own comments.

## 3. Architecture rule

**`crates/espansoconfig-core` must never depend on `tauri`**, directly or transitively. It is
the standalone, independently testable and fuzzable domain library (plan §6.1). Tauri lives in
`src-tauri/`, whose commands are thin wrappers over the core.

The file text on disk is the source of truth. The typed model is a read-only *projection* over
it. Every edit is a byte-span replacement, and everything outside the intended span must come
out byte-identical.

## 4. Build and test

```sh
cargo build --workspace
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --check

# The Phase 0 parser evaluation, with its evidence printed
cargo test -p espansoconfig-core --test parser_evaluation -- --nocapture --test-threads=1

# Regenerate the five script-built byte-exact corpus fixtures
# (CRLF, BOM, no final newline, Unicode offsets, block-scalar terminal spaces)
./scripts/build-byte-exact-fixtures.sh

# Copy the live espanso config into the gitignored real corpus
./scripts/sync-real-corpus.sh
```

**Fifteen corpus fixtures must never be "fixed" by an editor or a formatter.** Their whitespace
*is* the test data — a stray "trim trailing whitespace", "add final newline" or "reindent" on save
destroys what they exist to pin:

| Fixture | Bytes that must survive |
|---|---|
| `crlf-line-endings.yml` | `\r\n` line endings |
| `bom-utf8.yml` | the leading `ef bb bf` |
| `no-trailing-newline.yml` | absence of a final newline |
| `unicode-offsets.yml` | precomposed **and** decomposed `é`, astral `😀` — never normalise |
| `block-scalars.yml` | deliberate blank runs inside block scalars |
| `block-scalar-terminal-spaces.yml` | two real trailing spaces, then EOF with no newline |
| `block-scalar-leading-blank-lines.yml` | empty lines directly under a `\|`/`>` header |
| `folded-more-indented.yml` | the extra indentation of more-indented folded lines |
| `block-scalar-header-tails.yml` | three real spaces after a `\|-` indicator, plus comments on a `\|` and a `>2` header line |
| `file-comments-and-mixed-endings.yml` | exactly two CRLF lines among bare-LF ones, the blank line under an interior comment, no final newline |
| `single-line-no-line-ending.yml` | one line and **no line break at all** — the only document that gives an insertion no ending to copy |
| `run-based-removal-boundaries.yml` | four comment lines at **column zero** under a folded block indented six, and a comment block flush against the `vars:` below it with no blank line between — both are indentation, and re-indenting either silently swaps the shape the fixture tests |
| `move-block-scalar-seams.yml` | two `\|` block bodies at **column five** — deeper than their `replace:` key and shallower than the six an emitted block uses — with one leading comment block at column five and one at column two. Every column is the test: "tidying" a body to six, or re-indenting either comment, turns a refused move into its own safe twin |
| `move-run-joins.yml` | two `\|` block bodies at **column seven**, one leading comment block at column seven and one at column four, and the four blank lines that give two interior comments to the file. The blank lines split each envelope into two runs; the columns decide whether concatenating those runs feeds the second one's first comment to the block the first one ends with |
| `move-kept-comment-joins-a-block.yml` | two `\|` block bodies at **column five**, a file-owned comment block at column five and another at column two, and the four blank lines that make both file-owned. The columns are the two sides of R23 seen by a move |

`.gitattributes` in the corpus directory marks it `-text` so git never converts line endings, and
`tests/corpus_integrity.rs` fails the build if any of the fifteen loses its distinguishing bytes.

## 5. Coding conventions (plan §14)

- All code, comments, docs, README files and commit messages in **English**.
- **JSDoc on every JavaScript/TypeScript function.** In Rust, a doc comment on every public
  item; `#![deny(missing_docs)]` enforces it in `espansoconfig-core`.
- Any function or loop longer than 10 lines gets a closing-bracket comment, e.g.
  `// End of function choose_scalar()` or `// End of the loop over the rows array`.
- No TitleCase unless explicitly requested.
- Never run git or clasp unless explicitly asked.
- When telling the user to run a function, always name the file it lives in
  (e.g. "`resolve_config_dir()` in `crates/espansoconfig-core/src/discovery.rs`").
- Commit messages never mention Claude or AI assistance.

## 6. Current phase

**Phase 0 is complete and its architectural gate is PASSED.** The round-trip property test passes
over **every eligible target of both corpora**, so plan §12's exit criterion is discharged in its
strong reading. `PROGRESS.md` is the authoritative state file; the gate verdict with its evidence
is `docs/decisions/0c-3b-2b-notes.md` §8.

The substrate verdict is `docs/parser-evaluation.md` — **`saphyr-parser` 0.0.11 plus a
character-to-byte adapter and our own gap scanner**. On it sit the `SyntaxIndex` (0b), the scalar
codec, path resolver and patch engine (0c), and four operations: edit a scalar, insert and remove
a mapping field, and move a match within one sequence.

**Phase 1 — the read-only browser — is complete through 1c-2b-2b-2, and its stated exit is met.** 1a
(the core-side read model), 1b-1 (the Tauri shell, the Svelte scaffold and the i18n layer), 1b-2a (the
read-only IPC surface), 1b-2b (the Rust-code→string dictionaries, the exhaustiveness check and the
localized macOS menu), 1c-1 (the three-pane shell, the sidebar, the snippet list, search and the
selection), 1c-2a (the detail pane's match), 1c-2b-1 (the hazards and diagnostics), 1c-2b-2a (the
raw-text boundary) and 1c-2b-2b (source text on screen, then the whole document) are all done.

**Plan §12's Phase 1 exit — *the owner can browse their entire real config and every snippet renders
correctly* — was checked in a running window over the real corpus, not assumed**: 13 files, zero load
failures, zero findings, every file's text rendered and all 65 snippets rendered.
`docs/decisions/1c-2b-2b-2-notes.md` §8 is the verdict, recorded as counts and file names only (D1).
It names three things it does not cover; the sharpest is that the real configuration produces **zero**
unmodelled entries, so synthetic fixtures are that surface's only coverage, permanently.

**Phase 2 — editing — is under way, and since 2b-2a this application can write a user's file from a
window.** 2a built the whole save transaction in Rust with no caller (plan §6.6, all thirteen steps);
2b-1 put its types on the wire with no command behind them; **2b-2a registered `move_match`, the
seventh `#[tauri::command]` and the first that is not read-only.**

**2b is complete as of 2b-2c-3b: eleven commands exist and five of them write** — `move_match`,
`save_match`, `create_match`, `delete_match` and `save_raw_document`. **All five end in one
`run_one_save`** in `src-tauri/src/commands.rs`, which carries a `SaveContent` and holds this
layer's single cache-coherency policy; a sixth writing command **calls it rather than copying it**,
because it was four copies once.

**Phase 2c — the editing UI — is split into ten sub-phases**
(`docs/decisions/2c-split-notes.md`), and **it is complete through 2c-1b: this application can now
be used to write a user's file from a window.** Three of the split's rules bind every later
sub-phase. **Undo is not a sub-phase** — the draft state shape had to express it in 2c-1a or be
rewritten under two editors later. **A projection-based copy is not a duplicate** — it drops
comments, key order and scalar spelling, so calling it *Duplicate* breaks the preservation promise
in the one place nobody checks (2c-3c). And **every sub-phase of 2c owes three kinds of evidence**:
model tests, a **mounted-component test** (taken deliberately in 2c-1b — `vite.config.ts` had held
that decision open since 1b-1), and a manual window reading.

**2c-2, the small editor, is split into two steps and both are complete.**
`src/lib/browser/matchEditor.ts` is the whole editor as a value, exactly as `rawEditor.ts` is for
the raw editor, and `MatchEditor.svelte` draws it. Its decisions are
`docs/reviews/phase-2c-2-design.md` (the consult), `docs/decisions/2c-2-1-notes.md` (the record)
and `docs/decisions/2c-2-2-window-reading.md` (the reading).

**2c-3a is split the same way, and both its steps are complete: `matchCreation.ts` and
`matchDeletion.ts` are new and delete as values, and `MatchCreator.svelte` and `MatchDeleter.svelte`
draw them.** All five writing commands are wired through `BrowserState`; **four are called from a
screen, and `moveMatch` is the one that is not** — 2c-3b step 2 is what draws it. 2c-3a's decisions
are `docs/reviews/phase-2c-3a-design.md` and `docs/decisions/2c-3a-{1,2}-notes.md`.

**2c-3b is complete: `matchMove.ts` is move as a value, `MatchMover.svelte` draws it, and the window
reading is taken** (`docs/decisions/2c-3b-2-window-reading.md` — twelve launches, one Medium found
and fixed, a five-launch re-take). Step 1 also repaired the wrapper that sends it:
`BrowserState.moveMatch` had never had a production caller, which is exactly why it carried three
latent defects — a `SaveResult | null` return where the other four writing wrappers answer a
`MatchSaveAnswer`, a discarded `adoptTheDocumentOnDisk` result that left a **stale projection
installed** when a committed move's re-read failed, and `forgetFileText()` where
`forgetTextOf(document)` belongs. All three are closed. Its decisions are
`docs/reviews/phase-2c-3b-design.md` and `docs/decisions/2c-3b-1-notes.md`.

**2c-3c — Duplicate — is complete: three steps, and all three kinds of evidence.** The owner
decision `2c-split-notes.md` §4 demanded was taken first — a **true duplicate**, the item's exact
owned runs cloned byte-identically, trigger included, never a projection copy. **2c-3c-1** is
`DocumentEdit::DuplicateItem` in the core: the clone lands immediately after its source, same
sequence, with no placement choice; the batch that holds one holds nothing else (R25's precedent);
the seam refusals are destination-only, because the original never moves; and the save carries an
acknowledgeable `FindingCode::DuplicateKeepsTriggerDefinition` claiming risk, never espanso
semantics (D2u), content-addressed by the candidate's `ContentRevision` so consent for one clone
cannot spend on another. **2c-3c-2** is `duplicate_match` — the twelfth command, the sixth writer —
`BrowserState.duplicateMatch` and `matchDuplication.ts`. **2c-3c-3** is `MatchDuplicator.svelte`,
the sixth write surface, its mounted suite, the `unsavedDraftInDocument` producer, and the reading
(`docs/decisions/2c-3c-3-window-reading.md`: 24 launches, PASS on all seven items, no High and no
Medium, no defect in what is written to disk). Its decisions are
`docs/reviews/phase-2c-3c-design.md` (the consult; its Q7 cut the phase into three steps) and
`docs/decisions/2c-3c-{1,2,3}-notes.md`.

**2c-4a — conflict capture and preservation — is complete through step 2, and a conflict now
installs nothing in the window.** Until 2c-4a-2 all six writing wrappers eagerly did
`forgetTextOf` + `installView` + `repairAfter` in their conflict arm, so **a conflict wrote nothing
to disk and yet the snippet list re-ordered and the selection moved before the person had chosen
anything** — leaving their draft on screen against a projection that no longer described it.
"Load the disk version separately" was true of the command layer and false of the window. Step 1
gave `SaveResult::Conflict` a `disk_text` paired with `disk_revision` by content-hash equality;
step 2 deferred the frontend adoption to a **confirmed reload** and built the protocol for all six
surfaces. The Rust-side refresh in `conflict_after_the_lock` **stays** — it is required for the
two-observation truth and for backend cache coherence. Its decisions are
`docs/reviews/phase-2c-4a-design.md` (the consult), `docs/decisions/2c-4a-{1,2}-notes.md` and
`docs/reviews/phase-2c-4a-2-code.md` (four review passes).

**`adoptDiskVersion` is the only door, and `alreadyThere` is success.** It authorizes and installs
in one call and answers `DiskAdoptionOutcome` = `installed | alreadyThere | refused`; every caller
stops only on `refused`. **A boolean cannot carry three answers**, and the round that tried shipped
a window that could not progress: when a reprojection had already reached the requested revision the
method said `false`, so raw reload did not reseed, match reload did not close, and confirming again
repeated the refusal forever. The spend is bound to the conflict's **origin** —
`rememberTheConflict` keys a `WeakMap` on the wire value `ConflictModel.source` carries whole,
recording the document and its projection generation when the conflict arrived — and **not** to
`conflict.expected`, which is the session's frozen base and legitimately differs from what the
window projects. Without the generation check, a `rereadDocument` landing between *Reload disk
version* and *Confirm reload* **installed the older snapshot over the newer projection and reported
success**.

**An unoffered transition can be built and tested without drawing its choice, and that is the right
trade.** Every match surface declares `offersReload: false`, so `conflictChoicesFor` names neither
`reloadDiskVersion` nor `confirmReload` and no control is drawn — but the transitions exist, the
component arms call them, and 2c-4a-3 flips one boolean per surface. The first review round rejected
the opposite trade, where the *transition* was withheld too: that would have made step 3 invent five
model transitions and their `DetailPane` props on top of drawing them. **`conflictChoicesFor` is the
only producer of a choice list**; before it, capability was expressed twice, and that split is why a
newly offered button could compile and do nothing.

**Sweep for what the type now says, not for the words the old type used.** 2c-4a-2 took four review
passes, and the last three each closed a finding and left a **narrower instance of it standing** —
every time because the search was written from the previous wording. `2c-4a-2-notes.md` §7.6.2 is
the record, including the mechanical cause of the worst miss: an edit script asserted through
several replacements, threw on a later one, discarded all its writes including the record's own
primary section, and the retry re-applied only the edit that had failed.

**A dismissed match conflict is refused by `identityStaleRevision`, not by a second conflict.**
`conflict_after_the_lock` has already refreshed the Rust cache, so `view_at` rejects the frozen base
before the locked check. Only a raw save reaches that check twice. Write-safe either way — but they
are different sentences, and the record said the wrong one for two review rounds.

**The selection-follow guard holds at the write, not before it** — step 2's High, which took three
of that review's four rounds. A `DuplicateIntent` captured before the command is re-validated after
the adoption's own await, **in the same synchronous block as `replaceSelection`**, because a
leave-and-return during any await on that path must never end with the clone hijacking a selection
the person moved. `moved: null` claims only that the clone could not be identified in the read that
followed the write.

**The rule that decides between two refusal arms belongs in the model** — step 3's Medium.
`matchDuplicationView.notDuplicableToShow` gives the frozen `notDuplicable` reason **only when
`cannotDuplicate === 'notDuplicable'`**, written against that value rather than against `outOfDate`,
so a refusal added above it suppresses the frozen detail by construction; the unsuppressed verdict
stays on `MatchDuplicationSession.eligibility`. The reason is **not** that markup cannot be tested —
`MatchDuplicator.test.ts` mounts this renderer and checks it — but that **a rule written into one
renderer is carried by that renderer's mounted suite alone, and a second renderer can omit it while
walking the model faithfully**. `MatchMover.svelte:511` still holds the shape duplicate moved away
from, shipped at 2c-3b and window-read there.

**A refusal's sentence must be true of its predicate, not of its name.** `documentHasUnsavedDraft`
measures **any open match editor**, dirty or not: `isDirty` is derived inside `MatchEditor.svelte`'s
own session, so no coordinator can observe it (R36), and over-refusing costs one closed editor where
under-refusing strands edits. Both `unsavedDraftInDocument` sentences therefore claim an open editor
and this application's inability to tell whether it was edited, never that unsaved edits exist —
**"document-wide dirty-draft coordination" is not what shipped**, and `2c-3c-2-notes.md` §2.4 and
`phase-2c-3c-design.md` carry correction blocks saying so.
`browser.matchMove.refused.unsavedDraft` has the identical defect, shipped and untouched.

**"Same sequence" is the invariant a move keeps, and "same file" is not it.** D2r makes `ItemMove`
same-sequence only; today's projection happens to give a snippet file exactly one snippet list, and
encoding *that coincidence* would make the model silently wrong the first time a projection exposes a
second. `sequenceOf()` in `matchMove.ts` reads `MatchView.path`, requires the last step to be an
index, and carries the file's identity **beside** the steps — a `DocumentPath` names no file, so
`matches[0]` of two files is one path and two sequences.

**Where two refusal arms are true at once, the one that claims less wins.** A move that may have been
written says so **above** *this snippet has been moved* and above the liveness check, because the
alternative — which shipped for one review round — drew a definite *"This snippet has been moved"*
beside a send failure saying it may or may not have been. And the terminal state after an uncertain
send is justified by **uncertainty and stale identity, never by duplicate execution**: a session
resends its frozen content-hash revision, so a successful first write makes that base stale and the
retry conflicts. Both dictionaries said otherwise until the third review round.

**The selection machinery is two counters and collapsing them into one is a data defect.** A
per-document `projectionGenerations` map says *this file's projection was replaced*; the global
`selectGeneration` says *the intent this lookup served is gone*. Neither implies the other, and
2c-3a-1 shipped one global counter for a round before the confirmation pass found what it did: a
save committing in file B killed a pending `select()` for file A, which returned without repairing
and **left a `MatchId` that names nothing selected**. Every deferred test used one document, so
1112 tests were green over it. **Every write to `selected` bumps a counter in the same synchronous
block** — through `replaceSelection`, or by the two documented exceptions that bump it themselves —
and nothing in TypeScript enforces that.

**A confirmation that compares two values minted together observes nothing.** `confirmDelete` used
to check the pending identity against the session's own; both were frozen at `startMatchDeletion`,
so a session retained across a reprojection kept them stale **and equal** and the confirmation
still passed. It now takes the identity the **live projection** gives that snippet — and nothing
enforces that the caller reads it from there rather than handing back `session.match`, which the
module's own header says in the same sentence as what it does force.

**A fix is a change, and the round that reviews it is not optional.** Three of 2c-3a-1's ten
findings were regressions or false records introduced by a *previous round's fix*, and the third
review pass was commissioned for that reason alone, scoped to one change. Each round's fix produced
the next round's finding.

**The projection and the draft are two values, and confusing them is 2c-2's named failure mode.**
`MatchBaseline` is what the file held — including *whether it held the key at all* — and
`MatchBuffers` is what the controls hold; `fieldIntent` is the only function that reads both. **An
initially absent field left blank is `'Unchanged'`, not `Set("")`**, because the buffer alone cannot
tell that case from a present field cleared to empty, and getting it wrong writes `label: ''` into a
file that never had a label.

**A word-boundary control may not be a checkbox.** `word`, `left_word` and `right_word` are three
independent source-text fields, and a checkbox would have to decide that `word: on` means boolean
true — precisely the claim D2u forbids. They stay textual.

**A field whose projected value contains a real `\r` is read-only, and the refusal is enforced three
times** — at eligibility, at `editField`, and at `beginSave`. The last one is not redundant:
`MatchBuffers` carries **no brand**, unlike `RoundTripText`, so a well-typed caller can put a
carriage return in a buffer, and without the save-time gate it reaches the wire. The gate asks the
**derived draft**, never the buffers, because a field refused for carrying a CR legitimately holds
one in its buffer while sending `'Unchanged'`.

**A decision record that claims a guarantee the code does not give is this project's worst defect
class, and 2c-2-1 produced two more instances of it** — one per review round, both caught by Codex
and neither by any test. Check the notes against the code, not the code against the notes.

**A `<textarea>`'s value is the HTML *API value*, and it has every line break normalized to LF.**
2c-1b's window reading caught this: one keystroke in a CRLF document rewrote every line ending, the
save wrote it, and the screen said *"exactly the text that was sent"* — this project's central
promise broken on the one screen that writes, past 883 passing tests, `svelte-check` and two Codex
passes. **The raw editor now refuses any text containing a `\r`** rather than reconstructing one:
`file-comments-and-mixed-endings.yml` has exactly two CRLF lines among bare-LF ones, so re-applying
a dominant convention would reformat lines the user never touched. **The refusal does not
generalize** — every later editor that drafts through a `<textarea>` or an `<input>` meets the same
normalization and must decide it deliberately.

**A green test suite is not a screen, and 2c-1b is the proof.** Nothing in this project renders a
Svelte component in an automated test except the files that opt into jsdom by docblock, and a
mounted test proves a handler fires, not that a window draws. **A window reading is re-taken after
any change to a component** — 2c-1b took two for exactly that reason.

**The jsdom decision is scoped, not retroactive**: `environment: 'node'` stays the default and the
existing six components are not back-filled. **`resolve.conditions` in `vite.config.ts` is set
conditionally and that is load-bearing** — the option *replaces* Vite's defaults, and setting it
unconditionally silently took the production build from 154 to 180 modules and pulled in Svelte's
**server** build with nothing failing. **The module count is a regression guard**; check it — it is
**171** as of 2c-4a-2 (unchanged from 2c-3c-3 — that step adds fields, transitions and a prop but no
module, so an unmoved count is the guard passing), and the guard is not the number but the *shape of
a change to it*. A count
that moves by exactly the number of new source modules is a new module; a jump to ~180 with
`svelte/internal/server` in the bundle is the regression. Rebaseline it by building a pristine
`git archive HEAD` copy and subtracting; never by editing the condition.

**A whole-document save outcome arrives sealed, and the seal is one-shot.**
`openWholeDocumentSave(sealed, forget)` in `src/lib/browser/invalidation.ts` is the only way to
learn anything about it — a caller that does not discharge the invalidation does not have a save
result, because after a committed replacement **every `MatchId` in that file is stale** and `moved`
is `null` permanently. `forget` is synchronous and total; the re-read that follows is a separate
step. **A throwing `forget` never unwrites the file** — the throw comes back beside the committed
outcome, never in place of it. In `src/lib/browser/draft.ts`, **`isDirty` is derived and consent is
opaque**: `acknowledgeRefusal` is the only producer, and editing or undoing invalidates it. **No
control anywhere may be named or coded "keep my draft"** before 2c-4b — there it means *rebase the
draft onto the newly parsed document*, and using the words early makes that phase look done.

**Where TypeScript cannot force something, say so in the same sentence that describes what it does
force.** Two of the eight findings in 2c-1a's review were this project's own decision record
claiming a guarantee the code did not give — the one class of defect no test can fail.

**`espansoconfig_core::persist::save_document` is the only entry point that may write a user's file.**
Never call `replace_file_atomically` or `replace_locked_file` from a command, and never from inside the
transaction — **the lock is not reentrant, so the process hangs silently and forever.** A save is
refused, not forced: findings go out and the acknowledged subset comes back, matched as an **exact
multiset**. **There is no `force` flag and adding one would undo the design.** `committed: false` and
`backup: None` are both legal on a *success*.

**2b-2 was split three ways because three of its six commands had no primitive behind them**, and
that is now discharged: 2b-2c-1 added `InsertItem` and `RemoveItem` to `DocumentEdit`, and 2b-2c-3a
added `SaveContent::ReplaceText` beside `SaveContent::Edits` **inside** the one entry point that
writes. The rule that forced the split still binds every later phase: **forcing a write into
existence outside `save_document` bypasses the lock, the revision check, the reparse, the validation
verdict, the acknowledgement and the backup — while appearing to work.**

**A raw save may write text the YAML parser rejects.** That is the owner's settled ruling, not an
oversight: refusing would mean this application cannot repair a file that is *already* broken. It is
never refused and never silent — the candidate comes back with an acknowledgeable
`DocumentDoesNotParse` finding **content-addressed to that exact text**, so consent collected for
one draft cannot be spent on another. **A committed write is never afterwards reported as an error**,
and that binds the TypeScript boundary too, not only Rust — `saveRawDocument` returns
`RawSaveOutcome` precisely because a rejecting reload callback once hid a committed save.

**The raw YAML viewer is a mode of the third pane**, and `documentStart` has **exactly one caller** —
it is the only way a `bom` segment is produced, and a slice must never pass it. `src/lib/browser/`
holds what a test can reach (`rawDocument.ts`); the component gets the walk.

**A window reading must be a short, single-purpose run.** A WKWebView whose window is occluded stops
running `setTimeout` about six seconds after launch — `open -a` does not restart it and
`-NSAppSleepDisabled` does not prevent it — and LaunchServices silently drops `--env` for a bundle path
it thinks is already running. One plan per launch, into a fresh bundle path
(`docs/decisions/1c-2b-2b-2-notes.md` §6.1).

**The webview's `localStorage` is NOT keyed by `HOME`, and this corrects `2c-1b-notes.md` §9.1.**
2c-2-2's reading measured it: a language override set by one launch was still in force in the next,
from a different bundle path, with a `HOME` created seconds earlier — the WebKit data store follows
the **bundle identifier**, which every probe bundle shares. So a plan must set the language
**explicitly through the picker** rather than trust the launch environment; two launches of that
reading failed by looking for an English control on a Spanish screen. The older record is left as it
was written; this is the correction (`docs/decisions/2c-2-2-window-reading.md` §1.2).

**No control in the small editor can produce a carriage return, and the two controls fail
differently.** Measured in the shipped WKWebView, not assumed: a `<textarea>` assigned `"x\ry\r\nz"`
reads back `"x\ny\nz"` — bare CR and CRLF both collapse to one LF — while an `<input type="text">`
assigned `"p\rq"` reads back `"pq"`, **deleting** the character rather than converting it. That
completes the design consult's Q7 as far as a window can, and it is why a projected value holding a
real carriage return is drawn through `SourceText` rather than into any box
(`docs/decisions/2c-2-2-window-reading.md` §6). The open half is stated there as a hole: a person who
pastes CRLF text into the replacement box gets LF written, and nothing on screen says so while they
type.

**A raw-text command answers valid UTF-8 or refuses.** `document_text` returns
`CommandResult<string>`; a file that is not valid UTF-8 becomes a typed `NotUtf8 { path, offset }` and
**cannot be displayed at all**. That is exact preservation of valid UTF-8 plus a typed refusal — never
"the raw file bytes", and widening it later is a wire-format change Phases 2–5 inherit. Byte spans are
sliced **in Rust**: a JavaScript string index is a UTF-16 code unit and a `ByteSpan` counts bytes, so
`text.slice(span.start, span.end)` is wrong for any document with a non-ASCII character before the span.

**Only the seven files that opt into jsdom by docblock render a Svelte component in an automated
test**, and a mounted test proves a handler fires, not that a window draws — so a component that
throws in any of the other six produces a blank pane the suite cannot see. A claim about a screen
therefore needs a **reading of a screen**, re-taken after any change to a component —
`docs/decisions/1c-1-notes.md` §10 records the technique. **The reason a decision belongs in
`src/lib/browser/` is narrower than "markup cannot be tested"**: a *model* test drives values and
never markup, so a rule written into one renderer is carried by that renderer's mounted suite alone
and a second renderer can omit it while walking the model faithfully (2c-3c-3).

**A component renders a code by calling an accessor, never by building a key.**
`src/lib/i18n/codes.ts` gives twelve typed `describe*` functions over sixteen enum namespaces, and
`index.ts` wraps each in a reactive `t*`. The builders' return types make a **missing key a compile
error in that file**; building a key by hand opts out of the only check that catches it. On the Rust
side, a variant with no string — or a whole new enum — is a `cargo test` failure
(`src-tauri/src/dictionary_contract.rs`). The one construct that still escapes is an enum a
`macro_rules!` expands to; that is written down rather than hoped about.

**The architecture-rule check changed at 1b-1 (D2x).** §3 above is unchanged and absolute, but
`rg -c tauri Cargo.lock` is no longer evidence for it — `src-tauri/` exists, so the lockfile contains
tauri legitimately. The check is now:

```sh
cargo tree -p espansoconfig-core | rg tauri     # must find nothing
```

**Frontend build and test:**

```sh
npm run check      # svelte-check, run with --fail-on-warnings
npm run build      # vite
npm test           # vitest — i18n key parity, placeholder parity, the markup scan
```

Three things the gate deliberately does **not** license, each with a reason recorded in `PROGRESS.md`:

- **presenting a plain scalar's *type*** to the user — R16's open half: the projection of a
  pre-existing plain scalar is not proven to match espanso's YAML 1.1 resolver. **Decided (D2u): the
  UI shows a scalar's source text as written, never an inferred type.** Flagging one as
  1.1-ambiguous is permitted — that is a claim about risk, not about meaning;
- **moving a match between files or between sequences** — D2r; `ItemMove` is same-sequence only;
- **combining a move with any other edit in one batch** — R25.
