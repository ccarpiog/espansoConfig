# Phase 2c-3c-2 — decision record

**The boundary and the model, and no screen.** `duplicate_match` exists, is registered and is
driven through the real dispatcher; `matchDuplication.ts` is duplicate-as-a-value; and
`BrowserState.duplicateMatch` is the sixth writing wrapper, with full `MatchSaveAnswer` parity.
No `.svelte` file was touched — the component, the mounted test and the bilingual window reading
are step 3's, and 2c-3c is not done without them.

The authority for the decisions below is `docs/reviews/phase-2c-3c-design.md` — its Q5, Q6 and Q8
above all (Q7's split, item 2). Where this record and that document disagree, the consult is right
and this is a bug.

---

## 1. What this step built

| File | What it is |
|---|---|
| `src-tauri/src/commands.rs` | `duplicate_one_match`, `WorkspaceSession::duplicate_match`, the `#[tauri::command] duplicate_match` — the twelfth command, sixth writer, routed through `run_one_save` with `at` = the clone's post-insertion path; three command tests |
| `src-tauri/src/error.rs` | `CommandError::DuplicateSourceNotASequenceItem` — the duplicate's own spelling of the negative claim, so no move-named code leaks (consult Q5) |
| `src-tauri/src/main.rs` | the command registered; the surface is thirteen registered commands |
| `src-tauri/src/dispatch_check.rs` | `duplicate_match_is_reachable_and_round_trips_its_own_finding`; the remote-origin sweep grown to thirteen |
| `src-tauri/src/wire_contract.rs` | the registered-commands check retabulated: twelve workspace commands and the menu one |
| `src-tauri/src/dictionary_contract.rs` | `VARIANT_COUNTS`: `commandError` 16 → 17 |
| `src/lib/ipc/commands.ts` | `duplicateMatch(id, baseRevision, acknowledgement)` and `duplicate_match` in `COMMAND_NAMES` |
| `src/lib/ipc/errors.ts` | the new code in `COMMAND_ERROR_CODES`, its interface, its operand entry, its `identityRecovery` arm |
| `src/lib/browser/matchDuplication.ts` | **new** — the session value: eligibility, refusal precedence, `beginDuplicate`'s live-identity gate, `applyDuplication`, the sticky spent facts, the recovery, the view, the key builders |
| `src/lib/browser/workspace.svelte.ts` | `BrowserState.duplicateMatch`; `repairAfter` generalised over a three-valued `RepairAttribution` |
| `src/lib/browser/notices.ts` | `keptAfterDuplicate`, `displacedByDuplicate`; `RepairAttribution` gains `requestedDuplicate` |
| `src/lib/i18n/{en,es}.json` | the `browser.matchDuplication.*` namespace (31 keys per language), the two notice sentences, `code.commandError.duplicateSourceNotASequenceItem` — all at parity |
| `src/lib/i18n/index.ts` | `tDuplicationRefusal`, `tDuplicationSubmissionRefusal`, `tDuplicationRecovery` |
| `src/lib/browser/matchDuplication.test.ts` | **new** — 34 model tests |
| `src/lib/browser/workspace.test.ts` | 14 wrapper tests in a `duplicating a snippet` suite, plus the `duplicates` script arm |
| `src/lib/browser/notices.test.ts`, `src/lib/ipc/commands.test.ts`, `src/lib/i18n/codes.test.ts` | the hand-maintained walks extended for the new arms, the twelfth wrapper and the seventeenth command error |
| `src/lib/components/{DetailPane,MatchDeleter,MatchMover}.test.ts` | the scripted `BrowserCommands` stubs gain the required `duplicateMatch` member (refusing) |

**No `.svelte` file was touched, no corpus fixture's bytes changed, and nothing under
`crates/espansoconfig-core/` changed at all** — the core primitive is 2c-3c-1's, finished, and this
step only calls it.

---

## 2. The decisions

### 2.1 D1 — the command's shape is the consult's, verbatim (consult Q5)

`duplicate_match(id, base_revision, acknowledgement)` and nothing else: no destination argument,
because the clone lands immediately after its source by design (Q4), so no anchor exists to go
stale. `duplicate_one_match` follows `delete_one_match`'s identity discipline — `view_at` first,
`addressed_item`, one `DocumentEdit::DuplicateItem` — and the landed address handed to
`run_one_save` is **`DuplicateItem::resulting_path()`**, the primitive's own arithmetic, so
`SaveResult.moved` names the clone in the fresh revision (Q8) and this layer holds no second copy
of where the clone went. The `None` arm of that `Option` is mapped to the command's own refusal
rather than unwrapped: `addressed_item` has already excluded it, so the arm is defensive, and a
defensive arm that panics in a command would be a defect.

### 2.2 D2 — a duplicate-specific command code, not a renamed shared one (consult Q5)

`addressed_item` answers `CommandError::MoveNotWithinOneSequence`, and the consult forbids leaking
a code named *move* as a duplicate's user-facing reason. Two repairs were possible; the smaller
claim won. Renaming the shared code would be a **wire change three shipped commands inherit** —
`move_match`, `create_match` and `delete_match` all raise it today, and
`docs/decisions/2b-2c-2-notes.md` already records that rename as a deliberate follow-up rather
than something to do in passing. So `duplicate_one_match` maps the refusal to a new
`CommandError::DuplicateSourceNotASequenceItem`, raised by this command alone, with the same
negative-claim sentence said about a copy. The cascade: `code()`, the serializer, the operand
count, `every_command_error()`, the operand table in `error.rs`'s tests, `COMMAND_ERROR_CODES` and
`COMMAND_ERROR_OPERANDS` in `errors.ts`, `identityRecovery`'s `none` arm, the `codes.test.ts`
sample table, `commandError` 16 → 17 in `VARIANT_COUNTS`, and one sentence per language.

**Like its move twin, the code is believed unreachable through today's projection** — every match a
`DocumentView` holds is an item of the one `matches` sequence with a path ending in its index —
and it is kept for the same reason: the guarantee has to survive the day the projection grows a
match it cannot address, and a guarantee with no code is a comment. `duplicationRecoveryChoices`
offers the re-read for it, in place of the move code, beside the three identity codes.

### 2.3 D3 — the session is `Draft<MatchId>`, and the consent is the ordinary path (consult Q6)

`matchDuplication.ts` mirrors `matchDeletion.ts`'s carrier decision — the draft holds the base
revision, the one candidate and the refusal consent, and is never edited — and `matchMove.ts`'s
spending machinery: `duplicated`, `invalidated` and `mayHaveWritten` are three or-ed, never-cleared
facts, `dismissDuplicationOutcome` clears the panel and not them, and a `committed: false` whose
adoption was not owed spends nothing even though insertion makes that arm practically unreachable
(the consult says to keep it honest rather than hopeful, and the test drives it).

What is *unlike* every sibling: **refuse-then-acknowledge is this operation's ordinary path**, not
its exceptional one — the transaction interrupts the first attempt with
`DuplicateKeepsTriggerDefinition` whenever the source has a modelled trigger form. The consent
machinery is therefore load-bearing on the happy path, and both the model suite and the dispatch
test drive the full round trip: refusal out, findings back by content, commit.

There is **no pending-confirmation phase**. A deletion destroys and asks first; a duplicate
destroys nothing and its deliberate second step is the acknowledgement round the transaction
already imposes. `beginDuplicate` still takes the identity the **live projection** gives the
snippet and requires all three fields to equal the session's own *and* the draft's candidate —
`confirmDelete`'s comparison minus the pending arm — and the module header says, in the same
sentence, that no type can prove where the argument came from.

### 2.4 D4 — `unsavedDraftInDocument` is a boolean the coordinator supplies (consult Q6)

The eligibility's last arm is document-wide on purpose: a committed duplicate mints a new revision
and strands a dirty draft held for **any** snippet of the file, not only the source. The fact
arrives as a required, undefaulted `boolean` rather than a `MatchId` — the consult's own
instruction, and it designs out the hole `moveEligibility`'s narrower `unsavedDraft` arm records:
a `{document, node}` pair cannot be followed across a reparse, and a document-wide boolean is a
question the coordinator that owns the open editors can answer honestly at the moment it opens the
session. Nothing in TypeScript can check the boolean was computed rather than invented; the
parameter being required is what stops silence compiling into "there are none".

### 2.5 D5 — the refusal precedence is the consult's order, and each adjacency is a test (consult Q6)

`{mayHaveWritten, alreadyDuplicated, saveInFlight, conflict, outOfDate, notDuplicable}`, computed
in one private `refusalGiven` that both the view side and `beginDuplicate` call — the one-rule
arrangement `matchMove.ts` earned over four review passes, inherited here as a rule rather than
re-learned. The two pairs with history are where the standing rule bites: `mayHaveWritten` above
the definite `alreadyDuplicated` (in both arrival orders), and `outOfDate` above the frozen
`notDuplicable`. `matchDuplication.test.ts` has one test per **adjacent pair** of the order;
where no transition can reach a pair (a committed session re-entering flight, a conflict during
flight), the state is constructed through the structural interface and the test says so — what it
pins is the order of the checks, not a reachable history. There is no `alreadyThere` arm at all:
a duplicate always changes the document.

### 2.6 D6 — the wrapper is `moveMatch`'s shape, member for member (consult Q5, Q8)

`BrowserState.duplicateMatch` answers `MatchSaveAnswer` with the same four paths: `notAttempted`
for a document this state does not hold; `failed` carrying `mayHaveWritten` and the required
failure; `answered` with the adoption's fate beside the outcome; and the conflict arm that installs
the supplied disk projection, repairs, and stays `adoption: notOwed` — which is exactly why
`applyDuplication` derives the session's invalidation from the arm, as `applyMove` does. A
committed adoption that cannot re-read drops everything through `forgetTheReplacedDocument` and
answers `failed` **beside** the committed outcome, never in place of it (D2). The base revision is
the caller's, forwarded unchanged. Both selection counters are untouched machinery: every
selection write goes through `replaceSelection` (or the two documented exceptions), and
`installView`/`forgetTheReplacedDocument` bump the per-document projection generation — duplicate
introduces no third spelling of either rule.

**The selection follows `moved` to the clone only while the held selection is still the source
that initiated the operation** — `adoptTheDocumentOnDisk(document, source, moved)`, the consult's
own phrasing — and is repaired, never hijacked, otherwise. The two-document race test pins the
never-reclaimed half: a snippet of file 3 clicked mid-flight stays selected after file 2's commit.

**A `may_have_written` failure re-reads cautiously and asserts nothing**: the adoption is given no
target and no `moved`, so nothing is selected on the clone's account and the repair keeps the
external sentences. The test parks the selection on the position the clone would occupy and
asserts `differentMatch`, not `displacedByDuplicate` — an uncertain write cannot claim the copy.

### 2.7 D7 — the committed adoption gets its own attribution, `requestedDuplicate` (the choice the task left open)

The mechanism is reused and the claim is not. `RepairAttribution` gains a third value, honoured
through the same guard (`fromThisWrite`: only against the parse the write itself produced, else
the external fallback), and `repairAfter` maps attributions to notices through two small named
functions instead of a ternary. **Reusing `requestedMove` was considered and refused**: its
sentences say the person's move *reordered* the file, which an insertion did not do, and a notice
claiming it would be a false record — this project's named worst defect class, met at the exact
place 2c-3b's window reading found the mirror-image false alarm. The two new notices,
`keptAfterDuplicate` and `displacedByDuplicate`, say the copy *grew* the file;
`displacedByDuplicate` is the routine answer for a selection below the source, because the
insertion shifts every later position down by one. `notices.test.ts` asserts each duplicate arm
differs from its external twin **and** from its move twin, in both languages. `gone` keeps the
external sentence under every attribution: a duplicate only grows its sequence, so a vanished
position means something else also happened, and the sentence that claims less wins.

### 2.8 D8 — the dictionary surface is the move's minus placement, plus the landing sentence

31 `browser.matchDuplication.*` keys per language, at parity, Spanish on `fragmento` throughout.
There is no destination vocabulary at all; in its place one static sentence,
`landsAfterSource`, states where the clone goes — the panel's honest replacement for a placement
product (Q4). `duplicatedNotIdentified` exists because `moved: null` on a commit is legal and a
screen has to be able to draw it. The three typed accessors follow the established pattern; no
key is built in a component, and no component exists yet to build one. The adoption-failure line
rides the existing shared `saveOutcome` machinery (`invalidationFailureMessage` →
`windowOutOfStep`), so it needed no new key — the model test pins it appearing **beside**
`fileWritten`, never in place of it.

---

## 3. Verification

- `cargo test --workspace` — **1045 passed, 0 failed** (baseline 1041; plus three command tests
  and the dispatch reachability test).
- `cargo clippy --workspace --all-targets -- -D warnings` — clean.
- `cargo fmt --check` — clean.
- `npm test` — **1297 passed, 45 files** (baseline 1244, 44 files; plus the 34 model tests, 14
  wrapper tests, the twelfth-wrapper case and its argument case in `commands.test.ts`, the grown
  notice walks, and the retabulated counts).
- `npm run check` — 409 files, 0 errors, 0 warnings.
- `npm run build` — **169 modules** (baseline 168). The +1 is `matchDuplication.ts`, production-
  reachable because `src/lib/i18n/index.ts` imports its three key builders — exactly the shape the
  guard permits: a count moved by the number of new source modules. `svelte/internal/server` is
  not in the bundle (checked by search, not assumed).
- `cargo tree -p espansoconfig-core | rg tauri` — empty.

The dispatch test pins the wire facts a direct call cannot: the refusal crosses in the `Ok`
channel carrying `DuplicateKeepsTriggerDefinition` with a 64-hex `revision` operand that is **not**
the request's base; the acknowledged retry commits; `moved` resolves through `get_match` to the
clone at `matches[1]`; the held identity answers `identityStaleRevision`; and the disk bytes are
the source's owned lines twice, byte for byte.

---

## 4. Holes this step leaves open, each with its reason

1. **`DuplicateSourceNotASequenceItem` has no reaching test through a real projection**, and is
   believed unreachable today, exactly as the cross-sequence half of `MoveNotWithinOneSequence`
   is (`error.rs` records both). The mapping in `duplicate_one_match` is two lines a review can
   read; constructing a projection that defeats `addressed_item` would mean hand-building a view
   the core cannot produce, which proves the fixture rather than the command.
2. **Nothing enforces that step 3's component derives view, eligibility and submission identity
   from one synchronous projection read.** The model gives one rule over consistent inputs, not
   agreement by construction — the same stated residue `matchMove.ts` carries, closed there by
   `MatchMover.svelte` and owed here by the component this step deliberately did not write.
3. **The coordinator's `unsavedDraftInDocument` boolean has no producer yet.** The session
   requires it and no screen computes it until step 3 wires the panel beside the open editors.
   The parameter being required and undefaulted is what keeps the debt visible.
4. **`requestedDuplicate` is honoured only through `BrowserState.duplicateMatch`'s committed
   adoption, and nothing in TypeScript enforces that restraint** — the same unenforced-restraint
   sentence `requestedMove` carries, extended rather than solved.
5. **The Spanish sentences have not been read on a screen.** The parity suites prove keys and
   placeholders, never prose; the bilingual window reading is step 3's, and `PROGRESS.md`'s
   standing debt about `browser.matchDeletion.sendFailed` and `browser.rawEditor.discardWarning`
   is untouched — this step touched neither screen.
6. **`landed` is carried and nothing draws it yet.** The consult's Q8 makes the returned identity
   the only safe continuation; the wrapper follows it for the selection, the session records it,
   and what a screen offers about it is step 3's decision.

---

## 5. What this step deliberately did not do

- **No `.svelte` file, no mounted test, no window reading** — step 3 (consult Q7), and
  `CLAUDE.md`'s standing rule that none of the three steps is independently the completed
  sub-phase.
- **No change under `crates/espansoconfig-core/`.** The primitive, its finding and its
  verification are 2c-3c-1's, closed; this step is strictly above them.
- **No rename of `MoveNotWithinOneSequence`** — D2 above; the follow-up recorded at 2b-2c-2
  stands rather than being done in passing.
- **No placement argument, no `Front | After | End` product** — consult Q4, refused there and not
  reopened here.
- **No `force` anywhere, no weakening of the acknowledgement protocol**: the duplicate's finding
  rides the exact-multiset machinery unchanged, and its `ContentRevision` operand crosses the wire
  intact — the dispatch test asserts the operand, not only the code.

---

## 6. The review round

`docs/reviews/phase-2c-3c-2-code.md` — Codex, READINESS: NOT READY, one High, one Medium, two
Low. All four are accepted and fixed; none is disputed as a false positive. Sections 1–5 above are
left as they were written, per the standing rule; where a fix falsifies a sentence up there, this
section is the correction.

### 6.1 Finding 1 (High) — the selection could be reclaimed after the person moved it. Accepted, fixed.

**What was wrong.** `duplicateMatch` captured nothing before its `await` and handed only the
source identity to `adoptTheDocumentOnDisk`, which compares the **current** selection against it.
Two histories defeated that: start the duplicate while another snippet is selected and click the
source mid-flight, or start on the source, leave it and return before the answer. In both, the
current comparison succeeds and the adoption selected the clone — a hijack of an intent the person
expressed *after* the operation began, violating Q6/Q8's rule. **This corrects §2.6's sentence
"only while the held selection is still the source that initiated the operation"** — the code
compared the current selection, not the initiating one, so the record claimed a guarantee the code
did not give. (The same comparison shape exists in `moveMatch`, where `moved` is the *same
snippet's* new identity, so following it re-points the person at the snippet they just
re-selected rather than at a different one; whether that residue deserves the same capture is
recorded here as an open question rather than fixed in passing, because changing a shipped,
window-read wrapper is its own decision.)

**The fix.** The wrapper now captures, synchronously before the command, the initiating
`SelectedMatch` (required to be the source, by all three identity fields) **and** the global
`selectGeneration`. The clone is followed only when that captured object is still the held
selection *and* the generation has not moved; otherwise the adoption is given **no target**, so
its identity-following branch cannot fire and the ordinary R27 repair runs. `moved` is still
passed either way, because it is also the attribution's voucher — nulling it would silently
demote the person's own committed copy to an external change. The generation half is not
redundant with the reference half: a `select()` that bumps the counter at entry and then fails to
resolve is an expressed intent with no assignment, which only the counter sees. The two new
deferred-command tests drive exactly the review's two histories and assert the selection lands on
the repaired source (`keptAfterDuplicate`), never on the clone.

### 6.2 Finding 2 (Medium) — `moved: null` was attributed to a second file change. Accepted, fixed.

**What was wrong.** `after_a_save` answers `moved: None` on a commit not only when the fresh
revision disagrees, but also when its own re-read fails, or when the fresh same-revision
projection holds no match at the landed path — and the new JSDoc in `commands.ts`, the `landed`
doc in `matchDuplication.ts` and both `duplicatedNotIdentified` sentences stated "the file
changed again" as fact. A transient post-commit read failure would have been reported as a second
writer that never existed — the false-certainty class this record's own §2.7 argues against.

**The fix.** Every one of those four sites now claims only *the clone could not be identified in
the read that followed the write*, with a deliberately non-exhaustive pair of possible causes
(the file may have changed again; that read may have failed), in both languages. The
`duplicate_match` session method's doc states the same and names `after_a_save`'s three `None`
producers. Two tests pin it: `a_committed_save_whose_re_read_fails_names_nothing_and_stays_saved`
in `commands.rs` drives the shared tail directly with the file deleted between commit and re-read
— the interleaving no command can produce — and asserts `Saved { committed: true, moved: None }`
with no second writer in the premise; and a wrapper case commits with `moved: null`, re-reads
successfully at the transaction's **own** revision, and asserts a `done` adoption with the
external `kept` repair — the no-vouch fallback, which claims less than `keptAfterDuplicate`
because a `null` vouches for nothing. **The same "changed again" pattern stands in
`browser.matchMove.movedNotIdentified` and `browser.matchCreation.createdNotIdentified`**, both
shipped and the first window-read on screen; rewording them is the same fix owed to other
operations' sentences and is left recorded here rather than done in passing.

### 6.3 Finding 3 (Low) — cache content presented as disk evidence. Accepted, fixed.

**What was wrong.** The dispatch test's closing assertion said the duplicated bytes were "on the
disk" but asked `document_text`, which serves `Workspace::document_text` — the session's loaded
cache, with no refresh. The 2b-2c-3b review found this exact conflation in `save_raw_document`'s
dispatcher test and fixed it with `std::fs::read`; this test re-introduced it. **This corrects
§3's sentence "the disk bytes are the source's owned lines twice"** as a claim about what the
dispatch test proved — the direct command test always read the filesystem, so disk evidence
existed, but not where the record pointed.

**The fix.** The test now binds the temporary directory, reads `match/base.yml` with
`std::fs::read` and asserts the expected bytes **before** any claim about the disk, then keeps the
`document_text` assertion re-worded as the separate boundary fact it always was: the session
serves the same bytes it just wrote. The test's doc comment names both oracles and the review
that found the conflation, twice.

### 6.4 Finding 4 (Low) — the attribution type described a duplicate as reordering. Accepted, fixed.

**What was wrong.** `RepairAttribution`'s type-level JSDoc still opened "Who a selection repair's
notice says **reordered** the file" while its own new member documentation — and this record's
§2.7 — say a duplicate grows the file. The public contract contradicted itself at the exact
insertion-versus-reorder distinction the two new notices exist to preserve.

**The fix.** The type-level sentence now says "changed the file", with an explicit note that the
kind of change is each member's own claim — a move reorders, a duplicate grows — and the member
docs are untouched. No dictionary sentence needed changing for this finding; the review itself
verified both languages already say "grew"/"ha hecho crecer".

### 6.5 The gates, re-run after the round

- `cargo test --workspace` — **1046 passed, 0 failed** (1045 after the first pass, plus the
  `after_a_save` boundary test).
- `cargo clippy --workspace --all-targets -- -D warnings` — clean.
- `cargo fmt --check` — clean.
- `npm test` — **1300 passed, 45 files** (1297 after the first pass, plus the two reclamation
  histories and the clone-not-identified wrapper case).
- `npm run check` — 0 errors, 0 warnings.
- `npm run build` — **169 modules**, unchanged; no new source module, and
  `svelte/internal/server` is not in the bundle.
- `cargo tree -p espansoconfig-core | rg tauri` — empty.

### 6.6 The confirmation pass — one residual High, one Low, both accepted and fixed

**The residual High: the first F1 fix closed the pre-command window and left the adoption's own
open.** The capture was validated *between* the command's await and the adoption's, then reduced
to a `MatchId | null` target — and `adoptTheDocumentOnDisk` compares only the **current**
selection's identity against that target after its own `getDocument` await. Leave the source and
return **while that re-read is in flight** and the identity comparison succeeds over two newer
intents; a `select()` that fails to resolve during the same window moves the intent counter
without replacing the held object, which a reduced target cannot see at all. **This corrects
§6.1's unqualified sentence** that the clone is followed only while the captured object and
generation still hold — that was true at the moment the boolean was computed, and the boolean
went stale the moment the re-read yielded. The round-2 tests deferred the *command* and answered
`getDocument` immediately, so neither drove the await the defect lives across.

**The fix moves the decision to the write.** The capture now travels whole, as a
`DuplicateIntent { held, generation }`, into a dedicated `adoptAfterTheDuplicate` — the shape
`adoptTheCreatedSnippet` and `adoptAfterTheDeletion` already gave operation-specific adoptions —
and both halves are required **after that helper's one await, in the same synchronous block as
`replaceSelection`**, with no await between the checks and the write. That is `rereadDocument`'s
established rule (captures before the await, re-checked after) applied to the selection write.
`moved` stays a separate argument because it is the attribution's voucher, and the no-follow path
still installs the fresh projection and repairs or clears synchronously, so no `MatchId` naming
nothing is ever left selected (the 2c-3a-1 rule; the confirmation pass verified that half
independently). Two new tests defer the **adoption's** `getDocument` behind a gate that also
proves the deferred await was really reached before the mid-flight clicks: the exact
leave-and-return history the pass names, and the failed-`select()` case that isolates the
generation half — under the round-2 code both would have selected the clone.

**The Low: one model-test comment kept the certainty the production sentences gave up.** The
comment on `holds the committed arm even when the clone could not be identified` still said a
committed `moved: null` means the file changed again — a premise its `saved(true, null)` fixture
neither contains nor tests, and one the Rust boundary test disproves. Reworded to the same
non-exhaustive claim as the four production sites. The pass also confirms the matching prose on
the shared `after_a_save` tail is **byte-for-byte pre-existing** residue, not this step's
regression; it is left for the follow-up that owns the shared tail's operations, recorded here
beside the `movedNotIdentified`/`createdNotIdentified` twins of §6.2.

### 6.7 The gates, re-run after the confirmation pass

- `cargo test --workspace` — **1046 passed, 0 failed** (unchanged: both fixes are TypeScript).
- `cargo clippy --workspace --all-targets -- -D warnings` — clean.
- `cargo fmt --check` — clean.
- `npm test` — **1302 passed, 45 files** (1300 after round 2, plus the two deferred-adoption
  interleaving tests).
- `npm run check` — 0 errors, 0 warnings.
- `npm run build` — **169 modules**, unchanged; `svelte/internal/server` is not in the bundle.
- `cargo tree -p espansoconfig-core | rg tauri` — empty.
