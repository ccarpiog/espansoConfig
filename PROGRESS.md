# PROGRESS — espansoConfig

**This file is the authoritative project state.** The conversation is not. A fresh session
should be able to resume from this file alone, without any conversation history.

Plan of record: [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) (§12 holds the phase plan).

---

## Status

| Phase | Scope | State |
|---|---|---|
| **0a** | Workspace scaffold · golden corpus · parser evaluation | ✅ complete |
| **0b-1** | Byte-accurate span layer: `CharToByte`, BOM/line endings, `SyntaxIndex`, span trimming | ✅ complete |
| **0b-2** | Gap scanner: trivia classification, comment ownership, safety gate | ✅ complete — **Phase 0b done**, after the review fix round below |
| **0c-1** | Scalar codec: decode/encode, `choose_scalar`, style preservation | ✅ complete — after the review fix round below |
| **0c-2a** | Structural path resolver: `DocumentPath`, `resolve`, `path_to` | ✅ complete — after the review fix round below |
| **0c-2b** | Span replacement, reparse-verify, the hazard gate at the mutation entry point | ✅ complete — after the review fix round below |
| **0c-3a** | Insert/remove a mapping field · the removal envelope · the block-collection extent (R3) | ✅ complete — after the review fix round below |
| **0c-3b-1** | The run-based envelope (R21 / D2o): an envelope is an ordered set of owned runs, not a hull | ✅ complete — after the review fix round below |
| **0c-3b-2a** | Move a match · the stronger whole-document invariant · the move sweep | ✅ complete — after the review fix round below |
| **0c-3b-2b** | The round-trip property test over both corpora (R9) · R16 · the gate verdict | ✅ complete — after the review fix round below |
| **Phase 0** | **⛔️ architectural gate (R4)** | ✅ **PASSED**, with four named qualifications — see the verdict below |
| **1a** | The core-side read model: the semantic projection · the workspace and its per-revision cache | ✅ complete — after the review fix round below |
| **1b-1** | The Tauri v2 shell · the Svelte 5 + TypeScript + Vite scaffold · the i18n infrastructure in both languages | ✅ complete |
| **1b-2a** | The read-only IPC surface · the wire error type · the typed frontend boundary · R27 corrected | ✅ complete — after the review fix round below |
| **1b-2b** | The Rust-code→string dictionaries · the exhaustiveness check · the localized macOS menu | ✅ complete — after the review fix round below |
| **1c-1** | The three-pane shell and the data path: sidebar, snippet list, search, the selection | ✅ complete — after the review fix round below |
| **1c-2a** | The detail pane's match: plan §3.3's fields, §3.4's variables, §3.5's forms, D2u on a screen | ✅ complete — after the review fix round below |
| **1c-2b-1** | The typed judgements: `HazardKind` on a screen, the diagnostics, the load-failure conflation closed | ✅ complete — after the review fix round below |
| **1c-2b-2a** | The boundary: `document_text` as a command, `UnknownEntry.value_text`, the fidelity rules pinned through the real dispatcher | ✅ complete — after the review fix round below |
| **1c-2b-2b-1** | Source text on a screen: the shared rendering primitive, `MatchView.source_text` and the unmodelled value **drawn** | ✅ complete — after the review fix round below |
| **1c-2b-2b-2** | The raw YAML viewer over `document_text`, the `notUtf8` refusal on a screen, and the **real-corpus browse** | ✅ complete — after the review fix round below. **Phase 1's exit lands here, and is met** |
| **Phase 1** | **The read-only browser** | ✅ complete — plan §12's exit checked in a running window over the real configuration |
| **2a-1** | The durable atomic write primitive: plan §6.6 steps 1, 2, 6–11 · the first code that modifies a user's file | ✅ complete — after the review fix round below |
| **2a-2a** | The **semantic gate**: plan §6.6 step 5 · the six espanso-semantic rules as a pure classified report | ✅ complete — after the review fix round below |
| **2a-2b** | The **save transaction**: plan §6.6 steps 3, 4 and 12 · the blocking policy · the first code that can refuse a save | ✅ complete — after the review fix round below. **2a-2 is closed** |
| **2a-3a** | **Metadata preservation across the rename**: plan §7 row 11's unpaid half · the ACL and the extended attributes · the temp file's own identity | ✅ complete — after the review fix round below |
| **2a-3b** | **Backups and rotation**: plan §6.6 step 13 · the copy taken before the first modification of each file per session · the ten-batch retention · the only destructive operation in the crate | ✅ complete — after the review fix round below. **2a-3 is closed, and with it 2a** |
| **2b-1** | The **wire boundary for `persist`**: every save-transaction type serialized, with its two dictionary entries and the contracts that pin them | ✅ complete — after the review fix round below |
| **2b-2a** | The **save spine and the first mutating command**: the acknowledgement deserialized · the app-owned `BackupSession` · the operation-neutral `SaveResult` · `move_match` · the first code outside the core that writes a user's file | ✅ complete — after the review fix round below |
| **2b-2b-1** | **`MatchDraft`, `DraftField` and the minimal-diff engine** over the closed, schema-known scalar surface of one match, in the core, with **no command**: a field the draft leaves unchanged derives no edit, and neither does one whose drafted logical value already equals the projected one | ✅ complete — after the review fix round below |
| **2b-2b-2** | **The open key surface** — `vars` and `form_fields`, whose keys are the form author's — in the core, with **no command**: an index-addressed draft over a nested open mapping, edit and remove only, and the two batch guards restated per mapping | ✅ complete — after the review fix round below. **Its aggregate code review was run at the head of the next session** and its one finding is closed |
| **2b-2b-3** | **`save_match`, the command**: the draft deserialized off the wire, the batch handed to `save_document`, `SaveResult::Saved::notes` given its first producer, the `draftError` namespace in both languages, cache coherence and the frontend types — plus **the window reading four phases overdue** | ✅ complete — its design consult and its aggregate code review are both closed, the latter with **no finding**. **2b-2b is closed** |
| **2b-2c-1** | **The two missing sequence-item primitives** — `InsertItem` and `RemoveItem` — in the core, with **no command**: a flat block-mapping item synthesized at a sequence-item boundary and spelled by the existing scalar codec, and a removal that is literally `ItemMove`'s lift half | ✅ complete — its design consult and its aggregate code review are both closed, the latter with **no finding in five of six categories** and one Low documentation finding, fixed |
| **2b-2c-2** | **`create_match` and `delete_match`, the ninth and tenth commands**, over those two primitives and through `save_document`: the closed `NewMatch`, the identity-addressed `NewMatchPosition`, a front insertion made a **planner** operation, and `PresentationNote` generalized into a tagged union so a deletion can disclose the blank line it doubles | ✅ complete — its design consult and its aggregate code review are both closed. The review returned **NOT READY** on one Medium finding; **both findings were fixed before the commit** and the verdict's condition discharged |
| **2b-2c-3a** | **The whole-document-text replacement mode**, in the core, with **no command**: `SaveContent::ReplaceText` beside `SaveContent::Edits` inside the one entry point that writes, the parse demoted from a gate to a reported fact, and "does not parse" made an **acknowledgeable finding** so the owner's ruling is safe rather than silent | ✅ complete — after **two** review fix rounds below. The aggregate review returned **NOT READY** on a High finding; **it was fixed before the commit** |
| **2b-2c-3b** | **`save_raw_document`, the eleventh `#[tauri::command]` and the fifth that writes**: the whole-text request off the wire, the mandatory `BackupSession`, `run_one_save` generalized to carry a `SaveContent` so all five writers share one tail, `moved: null` by construction, the Q8 presentation model in both languages, and the **full identity invalidation** moved into the state that owns the cache | ✅ complete — after the review fix round below. The aggregate review returned **NOT READY** on a High finding; **all four findings were fixed before the commit**. **2b-2c is closed, and with it 2b: every command Phase 2b was scoped to deliver exists** |
| **2c split** | **Phase 2c cut into ten sub-phases**, by dependency order and failure mode, after a design consult that changed four of the seven things it was asked about | ✅ complete — `docs/decisions/2c-split-notes.md` is the cut; `docs/reviews/phase-2c-split-design.md` is the consult |
| **2c-1a** | The **draft spine**, with no editor and no screen: `Draft<T>` with undo expressible rather than addable, the one-shot **sealed** whole-document invalidation, and the save-outcome presentation model for all three arms | ✅ complete — after the review fix round below. The aggregate review returned **NOT READY** on three High findings; **all eight were fixed before the commit** |
| **2c-1b** | The **raw editor**, the one vertical slice: the raw pane made editable and saveable over `saveRawDocument`, the three arms drawn, the acknowledgement round trip drawn, the terminal-but-honest conflict state, this project's **first mounted-component test**, and the **first window reading of a screen that writes** | ✅ complete — after **three** review fix rounds below. The aggregate review returned **NOT READY** on three High findings; **all six were fixed**, and then the window reading found **two real defects the whole test suite had passed over**, and a second Codex pass on those two fixes returned **NOT READY** again on one more. **All nine were fixed before the commit** |
| **2c-2-1** | The **small editor's model layer and its command wiring**, with no component and no screen: a five-reason eligibility verdict computed from the projection, the baseline/buffer split with `DraftField` as the authoritative intent, per-field coalesced history on an injected clock, and `saveMatch` wired with identity adoption inside the wrapper | ✅ complete — after **two** review fix rounds below. The aggregate review returned **NOT READY** on five findings; the confirmation pass over those fixes returned **NOT READY** again on two more the fixes had themselves introduced. **All seven were fixed before the commit** |
| **2c-2-2** | The **small editor's screen**: the component, this project's second and third mounted-component tests, and **four window readings over 26 launches** — the two thirds of 2c-2's evidence step 1 did not have. A refused field draws its value in the order the file writes it, each entry named; a committed save owes a re-projection the session cannot be dismissed past; a save that produced no outcome shows *why* | ✅ complete — after **two** Codex rounds, both **NOT READY** (four findings, then three more), plus **four defects the readings found and two the implementer's audit found**. **All thirteen were fixed before the commit**, and eight of them were this project's named worst defect class — three of those in **sentences a person reads**. **2c-2 is closed** |
| **2c-3a-1** | **New and delete as values, with no screen**: `matchCreation.ts` (destinations with typed ineligibility, the three position arms, the two required fields), `matchDeletion.ts` (a two-phase confirmation bound to one identity), both commands wired through `BrowserState` with the adoption inside the wrapper, and a fifth `SelectionNotice` arm for a deletion the person asked for | ✅ complete — after **two** review fix rounds and a **third scoped pass** below. The aggregate review returned **NOT READY** on three High findings; the confirmation pass returned **NOT READY** again on one High the first round's own fix had introduced; the third pass returned one Low. **All ten were fixed before the commit** |
| **2c-3a-2** | **New and delete on a screen**: the components, a mounted-component test and a window reading — the two thirds of 2c-3a's evidence step 1 does not have | ⬜️ **next** |
| 2c-3b … 2c-5 | The rest of the editing UI. See the 2c split table below | ⬜️ not started |
| 2d | External change reconciliation — plan §6.5 | ⬜️ not started |
| 3–5 | See plan §12 | ⬜️ not started |

**Phase 2 is split into 2a / 2b / 2c / 2d**, because plan §12 states it as one phase and it is far
larger than any Phase 0 or Phase 1 sub-phase — it is the whole save transaction, four mutating
operations, the conflict UI, undo and backup restore. The cut is the same dependency order every
earlier split used, and it is **by medium first**: 2a is Rust with no UI and no IPC at all, so the code
that can destroy a file is finished and proven before anything can call it.

| Sub-phase | Scope |
|---|---|
| **2a-1** | The **durable atomic write primitive** — plan §6.6 steps 1, 2, 6–11. Takes finished bytes; builds none |
| **2a-2** | The **save transaction** around it — steps 3–5 and 12. **Split into 2a-2a / 2a-2b** (below) |
| **2a-3** | **Backups and rotation** — step 13, into a location outside every auto-loaded glob. **Split into 2a-3a / 2a-3b** (below) |
| **2b** | The **Tauri mutation surface** — `save_match`, `create_match`, `delete_match`, `move_match`, `save_raw_document`, `reload_document`, and `SaveResult::Conflict` on the wire |
| **2c** | The **editing UI** — the draft model, the small editor (literal trigger · `replace` · label · word boundary), new / duplicate / delete / move, the conflict UI, draft-level undo, restore from backup |
| **2d** | **External change reconciliation** — plan §6.5's debounced watcher, self-write suppression, and the clean-draft reload |

**2c is split into ten sub-phases**, and the cut is `docs/decisions/2c-split-notes.md`. It was put
to a design consult (`docs/reviews/phase-2c-split-design.md`) before any line of 2c was written, by
the same rule 2b-2c followed, and **the consult changed four of the seven things it was asked
about** rather than confirming the proposal. 2c is the first UI in this project that can destroy
data: five commands can write a user's file and no screen calls any of them, so 2c carries the
whole save protocol onto a screen for the first time — three outcome arms, an exact-multiset
acknowledgement round trip, a content-addressed refusal, a conflict that must overwrite neither
side, and an identity invalidation **represented in no type**.

| Sub-phase | Scope | Fails as |
|---|---|---|
| **2c-1a** | The **draft spine**, with no editor: the draft state shape (base revision, base value, current value, undo/redo history, **derived** dirty, history boundaries), the **typed whole-document invalidation effect**, and the save-outcome presentation model for all three arms including the acknowledgement round trip. No screen | a **state-shape** mistake |
| **2c-1b** | The **raw editor**, the one vertical slice: the raw pane made editable and saveable over the already-wired `saveRawDocument`, the three arms drawn, the acknowledgement round trip drawn, the terminal-but-honest conflict state, and this project's **first mounted-component test** | a **protocol** mistake |
| **2c-2** | The **small editor** — literal trigger · `replace` · label · word boundary — over `MatchDraft` and `save_match`, extending undo coverage to per-field editing | a **draft-versus-projection** mistake |
| **2c-3a** | **New and delete**: `create_match` and `delete_match` on a screen, the returned identity adopted, and the selection's behaviour when the selected match is the one deleted | an **identity** mistake |
| **2c-3b** | **Move**: `move_match` on a screen, the new identity adopted, the cross-sequence and combined-edit refusals surfaced rather than hidden | an **identity** mistake |
| **2c-3c** | **Duplicate**, once its semantics are settled — a projection-based copy is **not** a duplicate and would break the preservation promise in the one place nobody checks. May require Rust | a **preservation-promise** mistake |
| **2c-4a** | **Conflict capture and preservation**: retain the draft, load the disk version separately, compare, copy, reload — overwriting neither side | a **both-sides data-loss** mistake |
| **2c-4b** | **Reapply** — "keep my draft" in the plan's strong sense: identify the intended match in the newly parsed document and apply only when confidence suffices | an **algorithmic** mistake |
| **2c-4c** | **Recovery fallback**: save-draft-as-a-new-snippet, and manual resolution when the target is ambiguous or gone | a **dead-end** mistake |
| **2c-5** | **Restore from backup**: a whole-document replacement through the normal save path, with the full identity invalidation | a **destructive** mistake |

**Draft-level undo is deliberately not on that list.** The consult rejected it as a sub-phase:
a draft model built without undo in mind is a `{ value, dirty }` pair, a draft model that can
support undo is a base plus a current plus two stacks plus boundary rules, and the second is not
reachable from the first by addition. So the **shape** is 2c-1a's and its **coverage** extends
editor by editor (2c-1b for the raw text, 2c-2 for the fields). Deferring it would have meant
designing the wrong shape, shipping two editors on it, and rewriting it under both.

**2b is split into 2b-1 / 2b-2**, by the same cut every earlier split used — a dependency order, not a
convenience, and by *failure mode*. 2b was handed two pieces of work that fail differently. The first
is a **data-format decision every later phase inherits**: `SaveError` and the sixteen types it carries
have to cross the wire, and *nothing in `persist` derives `Serialize` today*, deliberately, because the
day any of it does every variant owes a `code.` namespace in **both** `en.json` and `es.json`. The 2a-3b
checkpoint records that this piece is **indivisible** — "one variant serialized without its string is a
dictionary-contract test failure, and half the enum serialized is worse than none" — so it is a phase of
its own, with no command registered, exactly as 1b-1 shipped the i18n layer with no command. The second
is the **commands themselves**, which fail loudly and can only be built on a boundary that already
exists.

| Sub-phase | Scope |
|---|---|
| **2b-1** | The **wire boundary**: `Serialize` on `SaveError`, `SaveVerdict`, `SaveRefusal`, `Acknowledgement`, `Finding`, `FindingCode`, `FindingClass`, `WriteError`, `WriteStep`, `TargetDifference`, `EditError`, `BackupError`, `BackupStep`, `BackupRecord`, `Rotation`, `RotationOutcome`; the `code.` namespaces in both dictionaries; the dictionary-contract and wire-contract extensions; the typed frontend mirror and its `describe*`/`t*` accessors. **No `#[tauri::command]` is registered** |
| **2b-2** | The **six mutating commands** — `save_match`, `create_match`, `delete_match`, `move_match`, `save_raw_document`, `reload_document` — each returning `SaveResult`, each carrying an optimistic-concurrency token, `SaveResult::Conflict` on the wire, the app-owned `BackupSession`, and the first call to `forgetFileText()`. **Split into 2b-2a / 2b-2b / 2b-2c** (below) |

**2b-2 is split into 2b-2a / 2b-2b / 2b-2c**, and this split was forced by a fact rather than
chosen for convenience: **three of the six commands have no core primitive behind them.**
`reload_document` has existed since 1b-2a, so 2b-2 owed five. Of those five, `DocumentEdit` has
**exactly four variants** — `Scalar`, `InsertField` and `RemoveField` (all **mapping**-scoped) and
`MoveItem` (a whole sequence item, **same sequence only**) — so:

- **`create_match` needs a primitive that inserts a whole sequence item.** There is none.
- **`delete_match` needs one that removes a whole sequence item.** `RemoveField` removes a mapping
  entry, which is not the same thing.
- **`save_raw_document` needs a way to save an arbitrary whole-document text.** `SaveRequest` takes
  a list of `DocumentEdit`s and nothing else, and `save_document` is the **only** entry point that
  may write a user's file.

The Codex consultation that confirmed this (`docs/reviews/phase-2b-2a-save-spine.md` is the later
review; the design consult is summarised in `docs/decisions/2b-2a-notes.md`) named the failure mode
in as many words: *the most likely mistake is forcing the planned six-command surface into existence
by inventing writes outside the supported core model — especially implementing `save_raw_document`,
sequence-item creation, or deletion through direct filesystem writes or whole-document replacement*,
which would bypass the single lock, the revision check, the full reparse, the validation verdict, the
acknowledgement handling, the backup policy and the atomic commit in one stroke, **while appearing to
work**. So the missing primitives are built as primitives, in the core, before any command reaches
for them.

The cut is otherwise the usual one — a dependency order, by failure mode. The three sub-phases fail
in three different ways: 2b-2a fails as a **protocol** mistake, 2b-2b as a **byte-preservation**
mistake, 2b-2c as a **missing-primitive** mistake.

| Sub-phase | Scope |
|---|---|
| **2b-2a** | The **spine plus one vertical slice**: `Deserialize` on the acknowledgement graph, the app-owned `BackupSession`, the operation-neutral `SaveResult` (`Saved` / `Conflict` / `Refused`, all in the `Ok` channel), cache coherence after a commit, the first call to `forgetFileText()`, and **`move_match`** — the one command the core already supports end to end |
| **2b-2b** | **`MatchDraft`, the minimal-diff engine and `save_match`**: a draft is a *desired state*, and Rust derives the `DocumentEdit` batch by diffing it against the projection. **A field the draft leaves unchanged must produce no edit at all** — rewriting an unchanged scalar can change its spelling and emit a `PresentationNote`, which is a byte-preservation failure wearing a success's clothes. `SaveResult::Saved::notes` gets its first producer here. **Split into 2b-2b-1 / 2b-2b-2 / 2b-2b-3** (below) |
| **2b-2c** | **The two missing core primitives and the three commands over them**: sequence-item insert and sequence-item remove in `patch/`, with the comment-ownership, indentation and block-scalar answers 0c-3a/0c-3b-1 had to give for mappings; then `create_match`, `delete_match` and `save_raw_document`. **`save_raw_document` needs its own answer** — a whole-document text is not a span replacement, and giving `save_document` one is a change to the one entry point that writes. **Split into 2b-2c-1 / 2b-2c-2 / 2b-2c-3** (below) |

**2b-2c is split into 2b-2c-1 / 2b-2c-2 / 2b-2c-3**, and the cut was put to a design consult before
any line of it was written (`docs/reviews/phase-2b-2c-1-design.md`, Q1) rather than chosen here and
assumed correct. The consult confirmed it, including the two sub-decisions that were live: that
`InsertItem` and `RemoveItem` belong **together** — they share the sequence layout, the envelope, the
indentation and the comment-ownership machinery, so separating them would duplicate the design
validation without isolating much risk — and that `save_raw_document` stays **last** despite being the
one that changes `save_document`'s own signature, because its concurrency and validation behaviour
wants dedicated tests rather than a mechanical preparation landed early.

| Sub-phase | Scope |
|---|---|
| **2b-2c-1** | **The two primitives, in the core, with no command.** `InsertItem` synthesizes exactly one flat block-mapping sequence item with scalar fields, each spelled by the **existing** scalar codec; `RemoveItem` is literally `ItemMove`'s lift half with no landing, sharing the code and not merely agreeing with it. Eight named planning refusals, all struct variants on the wire |
| **2b-2c-2** | **`create_match` and `delete_match`**, the eighth and ninth `#[tauri::command]`, over those primitives and through `save_document` |
| **2b-2c-3** | **`save_raw_document`**: a `SaveRequest` variant, never a full-span `DocumentEdit`. A whole-document text is not a span replacement, so it may not claim the patch engine's locality invariants. **Split into 2b-2c-3a / 2b-2c-3b** (below) |

**2b-2c-3 is split into 2b-2c-3a / 2b-2c-3b**, by the same cut 2b-2c-1 → 2b-2c-2 used and for the
same reason: the core mode is a change to **the one entry point that writes a user's file**, and a
command built on top of a mode that is not yet proven would make a protocol mistake and a
byte-preservation mistake indistinguishable. The split was not put to a fresh consult — the 2b-2c-3
design consult already prescribes exactly this order in its own *"What I would build first"*: its
steps 1–3 are the core mode, its steps 4–5 are the command and the UI boundary.

| Sub-phase | Scope |
|---|---|
| **2b-2c-3a** | **The core mode, with no command.** `SaveContent::{Edits, ReplaceText}` as a field of `SaveRequest`; the branch **inside** `save_document` after the lock and the revision recheck; the parse attempted and reported rather than enforced; `FindingCode::DocumentDoesNotParse` as an **acknowledgeable** finding, content-addressed to the candidate; `SaveError::ReplacementRequiresBackups` before the lock |
| **2b-2c-3b** | **`save_raw_document`, the eleventh `#[tauri::command]`**, over that mode: the whole-text request off the wire, the mandatory `BackupSession`, `moved: None`, and the **full identity invalidation** a committed replacement forces on the frontend — every `MatchId` in the file is stale afterwards |

**2b-2b is split into 2b-2b-1 / 2b-2b-2 / 2b-2b-3**, and the cut is the usual one — a dependency
order, by failure mode — but the fact that forced it is a property of espanso's own schema. A
match's fields are not one surface but **two**:

- a **closed, schema-known set of scalar keys** — `trigger`, `regex`, `replace`, `markdown`,
  `html`, `image_path`, `form`, `label`, `comment` and the nine `MatchOptions` keys. Eighteen keys
  a schema fixes, each holding a scalar. Diffing them is a fixed walk;
- an **open key set whose values may be collections** — `vars` and `form_fields`. A variable's
  `params` is a mapping whose keys are the *form author's*, not espanso's, and whose values are
  legitimately sequences (a `choice` variable's `values:`). Diffing that is an unschema'd mapping
  diff, and it collides head-on with the rule that no primitive may synthesize a collection node.

Writing both in one sub-phase would put a fixed eighteen-key walk and an arbitrary-mapping diff
behind one function and one review. They also fail differently: 2b-2b-1 fails by emitting an edit
for a field nobody changed, 2b-2b-2 by dropping a key it does not model, 2b-2b-3 by protocol.

| Sub-phase | Scope |
|---|---|
| **2b-2b-1** | **The closed scalar surface**: `MatchDraft`, `DraftField<T>`, `DraftError`, `plan_match_edits` and the two batch guards, in the core, **with no command**. The eighteen schema-known keys, plus editing — never adding or deleting — an existing element of `triggers` and `search_terms` |
| **2b-2b-2** | **The open key surface**: `vars` and `form_fields`, whose keys are author-defined and whose values may be collections. Inherits the equality rule and the closed-surface guard unchanged; owes the answer to what an unschema'd mapping diff may express |
| **2b-2b-3** | **`save_match`, the command**: the draft deserialized off the wire, the batch handed to `save_document`, `SaveResult::Saved::notes` given its first producer, the `draftError` dictionary namespace in both languages, cache coherence, and the frontend types |

**2a-3 is split into 2a-3a / 2a-3b**, by the same cut every earlier split used — a dependency order,
not a convenience. 2a-3 was handed *two* pieces of work, and only one of them is step 13. The other is
the review's blocking finding: plan §7 row 11 registers "capture and restore all four" for permissions /
ownership / line endings / BOM, and the write primitive restores **mode bits only**, because a `rename()`
installs a new inode and drops eight metadata classes with it. Backing a file up while every save still
strips its extended attributes and its ACLs is half a safety net — so the leak is closed **first**, and
the backup phase is then built on a primitive that no longer loses metadata. 2a-3a is also the phase
that adds this crate's first **platform** dependency, which is a decision that should not be buried
inside a phase about directories and timestamps.

| Sub-phase | Scope |
|---|---|
| **2a-3a** | **Metadata preservation across the rename** — plan §7 row 11. `copyfile(3)` with `COPYFILE_ACL \| COPYFILE_XATTR` between the temp write and the rename, the failure policy it needs, and the four-way statement of which of row 11's four are restored where |
| **2a-3b** | **Backups and rotation** — plan §6.6 step 13: before the first modification of each file per session, into `.espansoconfig-backups/<timestamp>/…`, retaining the last 10 save batches, with a path for 2c's *Reveal backups in Finder* |

Plan §12's Phase 2 exit — *the owner uses it for a week on their real config with zero data loss* —
lands after **2d**, and is the first exit in this project that cannot be checked in a single session.

**2a-2 was split into 2a-2a / 2a-2b**, by the same cut every earlier split used. The four steps 2a-2
owns are not one piece of work: step 5 is a *judgement about a projection* and steps 3, 4 and 12 are
a *transaction over bytes*. Splitting them means the rule set is finished, reviewed and proven before
any code can decide a save on it — and it means the transaction inherits a **classification** rather
than inventing one while holding a lock.

| Sub-phase | Scope |
|---|---|
| **2a-2a** | The **semantic gate** — step 5 alone. `validate(&DocumentView) -> Vec<Finding>`, pure, classified, no I/O |
| **2a-2b** | The **transaction** — steps 3, 4 and 12: apply patches in memory, reparse the whole candidate (the syntax gate), choose a blocking policy per `FindingClass`, update the in-memory snapshot |

**1c-2b-2b was split into 1c-2b-2b-1 / 1c-2b-2b-2**, by the same cut every earlier split used — a
dependency order rather than a convenience. **-1 is the rendering primitive proved on a small
surface**: a *slice* of a file (a match's bytes, an unmodelled entry's value), where the fidelity
question is answerable but a BOM, a NUL and "no final newline" are unreachable **by construction**,
because a slice out of the middle of a file cannot exhibit them. **-2 is the same primitive over a
whole document**, which is the only surface those rows have, and it carries Phase 1's exit. The split
also isolates the one irreversible-looking piece: -1 changes a string that says the app does *not*
show something, and that rewording had to travel with the code that makes it false or not at all.

**Phase 1 is split into 1a / 1b / 1c** for the reason every Phase 0 split had: one worker cannot hold
it coherently. The cut is by *medium*, not by feature — **1a is Rust with no UI at all**, and it is
what makes "every snippet renders correctly" a checkable claim before a single pixel exists; 1b is the
shell and the boundary, where nothing is yet rendered from real data; 1c is the browser itself. The
plan's stated exit for Phase 1 — *the owner can browse their entire real config and every snippet
renders correctly* — lands at the end of **1c**.

**1b was split once more into 1b-1 / 1b-2**, along the same cut every Phase 0 split used: a
dependency order, not a convenience. 1b-1 is *everything that must exist before a string can be
displayed at all* — the two scaffolds and the i18n layer — and it deliberately ships **no command**,
so a `t()` call is the only way any of its text reaches a screen and the CLAUDE.md §2 habit is
established while the surface is small enough to audit. 1b-2 is the **boundary**: the five read-only
commands over `crate::workspace`, and the dictionaries that turn Rust's codes into prose. The cut
matters because the two halves fail differently — a scaffold defect is loud and immediate, an IPC
defect is a data-format decision that later phases inherit.

**1c is split into 1c-1 / 1c-2**, cut by failure mode, which is the test every split in this project
has used. **1c-1 is the shell and the data path** — the layout, the sidebar, the snippet list, search
and the selection — and it fails **loudly**: wrong data, or nothing on screen at all. **1c-2 is the
detail pane** — plan §3.3's 22 fields, the hazards, the diagnostics and the raw YAML viewer — and it
fails **quietly**: a rendering that looks finished and states something the project has not earned.
Phase 1's stated exit lands at the end of **1c-2**.

**1c-2 was split once more into 1c-2a / 1c-2b**, by the same test. **1c-2a is the match itself** —
§3.3's fields, §3.4's nine variable types, §3.5's forms, the unmodelled entries and D2u's rule that a
scalar renders as source text — and it fails by **misrepresenting a snippet**. **1c-2b is what the app
says *about* that snippet and the file behind it** — the hazards, the diagnostics, the raw YAML viewer
and the load-failure marker — and it fails by **making a claim the project has not earned**. The cut
proved itself immediately: 1c-2a's own review found the pane telling the reader that an unmodelled
entry was "shown as written" while showing only its key, which is exactly 1c-2b's failure mode
appearing inside 1c-2a.

**1c-2b was split once more into 1c-2b-1 / 1c-2b-2**, by the same test, because its five items are of
two different kinds. **1c-2b-1 is the typed judgements** — the hazards, the diagnostics and the
load-failure conflation — all of it read from data **already on the wire**, adding no command and no
wire field, and it fails by **making a claim the app has not earned**. **1c-2b-2 is the raw text
surfaces** — the `document_text` command, the raw YAML viewer, `MatchView.source_text` and the
unmodelled entry's value text — every one of which **widens the boundary**, and it fails the way a
data-format decision fails: later phases inherit it. The cut proved itself the same way 1c-2's did:
1c-2b-1's review found a new string telling the reader that a second YAML document "is shown but not
interpreted" when nothing shows it and the viewer that would is in 1c-2b-2 — 1c-2b-1's own failure
mode, produced by reaching for 1c-2b-2's subject. Phase 1's stated exit now lands at the end of
**1c-2b-2**.

**1c-2b-2 was split once more into 1c-2b-2a / 1c-2b-2b**, and for once not by failure mode alone but by
the cut 1b-2 used, because its four items are of two kinds. **1c-2b-2a is the boundary** — registering
`document_text` as a command and putting the unmodelled entry's value text on the wire — and **every one
of its items widens the wire**, so it fails the way a data-format decision fails: Phases 2–5 inherit it.
**1c-2b-2b is the screens** — the raw YAML viewer, `MatchView.source_text` and that value actually
rendered, plus the real-corpus browse Phase 1's exit is stated in terms of — and it fails as a viewer
that says "as written" with a transformation sitting between the file and the screen. The cut earned
itself the same way the two before it did: 1c-2b-2a's review found **six** claims outrunning their
evidence, four of them in test names and doc comments about *what crosses the boundary* — precisely the
question that has no screen in it, and precisely what would have been buried under a viewer had both
halves shipped together. **Phase 1's stated exit now lands at the end of 1c-2b-2b.**

**1b-2 was split into 1b-2a / 1b-2b** along the same cut: 1b-2a is the **boundary** — the five
read-only commands, the wire error type and the typed frontend mirror — and 1b-2b is the **prose**,
the code→string dictionaries and the localized menu that need a boundary to exist before they have
anything to translate. The two fail differently, which is the test every split in this project has
used: a boundary defect is a data-format decision later phases inherit, a dictionary defect is a
missing string.

Phase 0 as written in the plan was split into **0a / 0b / 0c** because it was too large for one
coherent unit of work, and **0c** was split again into **0c-1 / 0c-2 / 0c-3** for the same reason:
0c-1 is value-level and mutates nothing, 0c-2 mutates one scalar, 0c-3 mutates structure.
**0c-2 was split once more into 0c-2a / 0c-2b**: addressing a node and mutating one are
independent problems, and the addressing half is what the mutating half's verification step
depends on, so it had to be correct and independently tested first. **0c-3 was split into 0c-3a /
0c-3b** along the cut its own "Next action" predicted: 0c-3a changes a mapping's *membership*, where
every byte the edit touches stays in place; 0c-3b *relocates* bytes, which is what breaks the
byte-identity invariant and forces a stronger one. **0c-3b was then split into 0c-3b-1 / 0c-3b-2**
along its own dependency order: a move carries an envelope, and while an envelope is a contiguous
hull it would carry the file's comments to the destination — worse than deleting them — so the
envelope had to become a set of runs before the move could be written at all. **0c-3b-2 was split in
turn into 0c-3b-2a / 0c-3b-2b**, because building the operation that relocates bytes and proving the
whole corpus round-trips are different problems: 0c-3b-2a writes the move and the invariant a
relocation forces, and 0c-3b-2b is the gate itself, which needs that invariant to already exist. The
plan's stated exit criterion for Phase 0 — *the round-trip property test passes on the full
corpus* — is unchanged and lands at the end of **0c-3b-2b**. The architectural gate is not cleared
until then; no UI work begins before it.

**Cross-file move is deliberately not in Phase 0.** Plan §12 scopes the gate to "move whole matches";
drag between files is §8.4, which restricts it to self-contained matches and is a UI-phase concern with
its own dependency analysis. `ItemMove` moves within one document only, and 0c-3b-2a's proofs are
scoped to that (see D2r).

---

## Completed

### Phase 0a — foundation, corpus, parser evaluation

**Workspace.** Cargo workspace at the repo root with a single crate,
[`crates/espansoconfig-core/`](crates/espansoconfig-core/), which has **no tauri dependency** and
never will (verified: `rg -c tauri Cargo.lock` finds nothing). Module skeleton follows plan §6.1:
`discovery` · `syntax` · `model` · `patch` · `emit` · `validate` · `persist` · `watch`.
`#![deny(missing_docs)]` and `-D warnings` are on from the first commit.

**Implemented for real:** [`discovery.rs`](crates/espansoconfig-core/src/discovery.rs) — config
directory resolution (explicit override → `$XDG_CONFIG_HOME/espanso` →
`~/Library/Application Support/espanso`), recursive file enumeration, and classification into
match file / config profile / package, with the `_`-prefixed-disabled flag. 13 unit tests against
synthetic temp trees.

**Defined as types** (from plan §6.2), everything else is a documented stub: `ByteSpan`,
`ScalarStyle`, `Chomping`, `ScalarPresentation`, `ContentRevision` (sha256), `LineEnding`,
`DocumentId`, `SourceDocument`.

**Golden corpus.** 19 valid synthetic fixtures + 4 deliberately invalid ones, in
[`crates/espansoconfig-core/tests/corpus/synthetic/`](crates/espansoconfig-core/tests/corpus/synthetic/),
covering every category in plan §11: all scalar styles, comments in every position, blank-line
runs, anchors/aliases/tags/merge keys, duplicate keys, flow collections, multi-document streams,
CRLF, BOM, no-trailing-newline, non-ASCII (Spanish accents and `⌘`/`⌥`/`⇧`), plus espanso shapes
(form + `choice`, a `form`→`date`→`shell` variable chain, `html`, `imports`, `global_vars`).
Two fixtures were added when the Phase 0a review was closed out: `block-scalars.yml` (the full
`|`/`>` × clip/strip/keep × explicit-indent matrix) and `unicode-offsets.yml` (precomposed `é`,
**decomposed** `é`, astral `😀`, `tail` — the file that pins the offset-counting scheme, and
which must never be Unicode-normalised).

**Parser evaluation.** [`docs/parser-evaluation.md`](docs/parser-evaluation.md) — the full
scorecard, probe evidence and division of labour. Backed by 31 executable tests in
[`tests/parser_evaluation.rs`](crates/espansoconfig-core/tests/parser_evaluation.rs) that pin
every measured behaviour. An adversarial review
([`docs/reviews/phase-0a-parser-substrate.md`](docs/reviews/phase-0a-parser-substrate.md))
found four verification holes; all four are now closed, and one of them **overturned a headline
claim** (see D2).

### Phase 0b — the span-accurate `SyntaxIndex`

Split into **0b-1** (byte-accurate spans) and **0b-2** (trivia and ownership) because one worker
could not hold both coherently. Both are complete; each was adversarially reviewed and each
review's findings were fixed *before* the phase was recorded done.

**0b-1 — the span layer.** `CharToByte` converts saphyr's Unicode-scalar-value offsets to bytes
so no char offset escapes `crate::syntax`, rejecting out-of-domain and inverted spans rather than
clamping. `DocumentPreamble` strips and records a BOM before parsing and detects the line ending;
**every span is a byte offset into the original on-disk bytes, BOM included**. `SyntaxIndex` is an
arena of nodes with stable `NodeId`, parent/child links, kind, scalar style and anchor/tag/alias
data. Block-scalar ends are trimmed off the substrate's overshoot into trailing blank lines and
the next node's indentation; a block whose header cannot be located is **rejected** rather than
published with a known-bad span (R10). The frontier is the ordered, disjoint, non-zero-width
`Scalar` + `Alias` spans, and `segments()`/`gaps()` partition the document.

**0b-2 — trivia and ownership.** `TriviaIndex::scan` classifies every gap byte into a typed
`TriviaItem` — comment, blank line, line break, indentation, spacing, block header, anchor, tag,
directive, document marker, eight punctuation kinds, BOM, unclassified — reusing `block.rs` rather
than re-lexing. `ownership.rs` implements the plan §6.2 comment rules with the precedence and two
documented extensions recorded in D2d, and `HazardKind` / `is_safely_editable` is the
refuse-rather-than-guess gate Phase 0c must consult.

**What is actually proven, over the synthetic corpus (22 fixtures when 0b-2 closed; 28 today) and
the 13 real files:** every byte is
either a frontier leaf or a named trivia item, the two concatenate back to the file **byte for
byte**, and **0 bytes are unclassified in either corpus**. Because tiling alone cannot catch a
*mislabelled* byte, two corpus-wide oracles independently re-derive each item's kind and each
comment's owner from the source text — they re-check 3 072 synthetic and 2 901 real trivia items,
and 77 comment attachments on the real corpus alone. That distinction is not theoretical: injecting
an `Indentation`→`Spacing` mislabel left every tiling and count assertion passing and was caught
**only** by those oracles.

### Phase 0c-1 — the scalar codec

The value-level half of the patch engine: **decode** a scalar's source bytes into its logical
string, and **encode** a logical string back into YAML source bytes. It mutates no document —
that is 0c-2 and 0c-3.

Three entry points, in [`src/emit/`](crates/espansoconfig-core/src/emit/):
`decode()` handles all five styles (plain, single-, double-quoted, literal, folded);
`choose_scalar(value, context)` is plan §6.3's style selector for a **new** value; and
`preserve_scalar(value, presentation, context)` is §6.3's "editing an existing scalar" path, which
keeps the current style whenever the new value is still safely representable in it.
`reencode_in_place()` is the codec's self-check: it returns either **byte-identical** output or a
**typed `NotReencodable` refusal**, never a silent difference.

**What is proven.** Our decoder agrees with the saphyr substrate's own decoded value on
**924/924** synthetic and **1067/1067** real scalars — zero
disagreements, so the decoder is
checked against an independent implementation rather than against itself. (The synthetic figure was
825 when 0c-1 closed and has moved only because later phases added fixtures; every delta is
tabulated in that phase's own notes doc. The five zero-width scalars of
`empty-entries-and-extents.yml` are excluded by name — see D2o's neighbour, `0c-3a-notes.md` §7.2.)
Decode-then-re-encode
is **byte-identical on 910 synthetic and 1056 real** scalars; every remaining scalar is covered by
a named refusal, and the refusals are **structural predicates on the source text**, never "the
bytes came out different" — a self-fulfilling check would prove nothing. `choose_scalar`'s output
is round-tripped through the substrate for 149 adversarial values plus a 1 500-value seeded sweep,
across nine block sites (LF and CRLF, nested indents, deltas of 9, 10 and 20, at EOF and followed)
plus a flow site and a mapping-key site.

### Phase 0c-2a — the structural path resolver

The addressing half of the patch engine, in [`src/patch/path.rs`](crates/espansoconfig-core/src/patch/path.rs).
It mutates nothing; 0c-2b is the first code that does.

`DocumentPath` is a document index plus an ordered list of `PathSegment::Key`/`Index`, with an
exact textual serialization (`matches[3].replace`). `resolve` walks it to the value node's
`NodeId`, `resolve_key` to the key node that introduces it, `resolve_full` reports value, key and
parent together, and `path_to` is the inverse. Every refusal is typed: `PathError` has nine
variants and `AddressError` six, each carrying the segment position and the node the walk reached.

**Why this exists at all, and why it is not a match identity.** Plan §6.2 requires the engine to
reparse the whole candidate document after every edit, and a reparse mints a *new* arena whose
`NodeId`s bear no relation to the ones the edit was planned against. A path is what survives that
reparse, so it is the mechanism the verify step re-finds the edited node with. It is emphatically
**not** the match identity §6.2 forbids being positional — `matches[3]` shifts on reorder, and
`NodeId` remains the session-local identity.

**What is proven.** The headline is a corpus-wide **inverse-pair oracle** over every synthetic
fixture and the 13 real files: for every node, either `path_to` refuses for a reason the test
**re-derives from the tree itself**, or `resolve(path_to(n)) == n` and the path's textual form
re-parses to the same path. The re-derivation matters — a resolver that refused everything would
satisfy "no round trip ever failed" while being useless. Synthetic figures are pinned per
category so two opposing drifts cannot cancel: **1 237 nodes = 713 addressable + 30 documents +
490 mapping keys + 4 ambiguous + 0 non-scalar keys.** The 30 is itself a cross-check: 27
single-document fixtures plus `multi-document.yml`'s three. (These were 1 095 / 634 / 24 / 433 when
0c-2a closed; every later delta is one added fixture's own shape, tabulated in that phase's notes
doc — `0c-2b-notes.md` §7, `0c-3a-notes.md` §8 and §8.1, `0c-3b-1-notes.md` §5.4.) No count from the
real corpus is hard-coded.

The two universal contracts are swept rather than sampled, after the review found them advertised
and untested: **4 000 seeded paths** round-trip through their textual form byte for byte (keys
drawn from an alphabet holding the grammar's own punctuation, `'`, `#`, NUL, BEL, DEL, ESC, `\n`,
`\r`, `\t`, U+0085, U+00A0, the BOM, `é` and `😀`), and **20 000 seeded strings** go through
`DocumentPath::parse` with zero panics. Both use the same hand-written xorshift64* generator
`tests/scalar_codec.rs` already uses, so the crate gains no dependency.

### Phase 0c-2b — the first code that mutates a document

The mutating half of the scalar patch engine, in
[`src/patch/edit.rs`](crates/espansoconfig-core/src/patch/edit.rs). Everything before it read;
this writes.

`apply_scalar_edits(source, &[ScalarEdit])` takes the **source text**, not a pre-built index, so it
parses and scans internally and there is no argument a caller can get wrong. Per edit it resolves
the path, **asks the hazard gate**, renders with `preserve_scalar`, and works out which spans it
replaces. A block scalar's `header_span` and `content_span` are replaced as **two separate spans,
never as one envelope spanning both** — the bytes between them are the header line's tail and its
line break (D2c), they belong to neither span, and rewriting them is the byte-fidelity defect the
review caught. The batch is rejected if any two replacements overlap, spliced **from the highest
byte offset downwards**, then the whole candidate is reparsed and verified. `PatchedDocument` has **no public constructor and no public field**, so the
only way to hold candidate bytes is to have been handed them after `verify()` passed: there is no
code path from a verification failure to a document a caller could write.

Verification is four assertions, each a typed failure rather than a panic: the candidate still
parses; **re-resolving the same `DocumentPath`** against the freshly parsed index decodes — by both
our decoder and the substrate's — to exactly the intended value; **every byte outside the replaced
spans is identical**; and every replacement lies wholly inside a span the syntax index says the
scalar owns. That fourth one is the review's finding 3: without it an oversized *intended* span is
authorised by the very declaration it should be checked against. `VerificationFailure` has nine
variants and `EditError` nine; no variant carries scalar text, because these errors are printed by
tests that sweep the private corpus.

**What is proven.** A corpus-wide sweep attempts every addressable scalar × 12 adversarial
replacement values: **5 220 attempted edits on the synthetic corpus = 4 879 applied + 276 gate
refusals + 60 `EmptyTarget` + 3 `NoObservableLineEnding` + 2
`TrailingNewlinesNotRepresentable`** — and the split is pinned
**per fixture**, a complete row each, so two fixtures cannot exchange eligibility undetected. (It was
4 728 = 4 450 + 276 + 2 + 0 when 0c-2b closed. The `EmptyTarget` zero was a coverage hole rather than
a property and Phase 0c-3a's fixture closed it; the `NoObservableLineEnding` three were *applied*
edits that invented a line ending until the 0c-3a review's fix round, D2p.) Every
refusal reason is **re-derived independently by the test**, walking the tree itself rather than
calling the gate, so an implementation that refused everything fails. The permitted spans are
likewise derived independently of the planner, which is what the review's finding 3 forced. On the
real corpus **2 004 of 2 004 attempted edits applied**, and no count from it is hard-coded.

Two error variants an earlier draft of this phase had are **gone**, because the fix round found they
were refusing edits with an exact lossless answer: `CommentOnBlockHeader` and
`LineNotFreeForBlockScalar`. See the review disposition.

### Phase 0c-3a — the first edits that change a document's structure

0c-2b changed one scalar's bytes in place. 0c-3a changes a mapping's **membership**: `FieldInsert` and
`FieldRemoval` join `ScalarEdit` in a single `DocumentEdit` batch, applied by `apply_edits`
(`apply_scalar_edits` is now a thin wrapper over it). Every byte the edit touches still stays where it
is — *relocating* bytes is 0c-3b-2, and is why the invariant has to change again there.

**The envelope is the phase, not the bytes.** Which colon, line break, blank line and comment travel
with a removed entry is the whole problem; writing the replacement is trivial once that is settled. The
envelope is built from `items_owned_by_subtree` / `comments_owned_by_subtree`, never the direct
queries, and is then widened to whole lines. In 0c-3a it was a **contiguous hull**, and D2o records what
that cost; **0c-3b-1 replaced the hull with an ordered set of runs** and D2o now records both halves.

**R3 is closed by measurement, not by assumption** (D2n). A block collection's end marker was measured
across both corpora *before* any rule was written: it overshoots in 223 of the 235 synthetic block
collections then in the corpus and 228 of 240 real ones, never undershoots, and lands at EOF, on a node
or mid-trivia (111/42/298). It is therefore
unusable *and* unreconstructible, so the published span deliberately stays child-derived and
`CollectionExtent::owned_end()` is a second, **fallible** derivation cross-checked against
`TriviaIndex::subtree_extent` on every block collection of both corpora. (The overshoot count the suite
pins today is **246 of 273** synthetic, the difference being fixtures added since; the ratio and the
verdict are unchanged.)

**Verification is generalised, not weakened** (D2p). "Every byte outside the replaced spans is
identical" cannot survive a removal, which deliberately deletes bytes. The invariant is now: *the
candidate is exactly the source with the declared replacements applied, and every declared replacement
lies wholly inside a span derived from immutable syntax facts.* Byte identity alone cannot police a
removal — an envelope one entry too long confirms itself — so three checks carry the weight, none of
them a restatement of what the planner decided: `StructuralGuard` against the **original** index, a
**sibling digest** proving every unnamed entry still decodes to what it decoded to before (kinds and
lengths as well as values, so `{a: "1"}` and `[a, 1]` cannot collide), and a **file-comment check**
that the review's finding 1 forced.

**What is proven.** A structural sweep over every mapping of every synthetic fixture — every entry
offered for removal, insertions attempted at every position, plus one duplicate key and one missing
sibling per mapping — pinned **per fixture, a complete row each**, with the table asserted to cover the
corpus exactly. When 0c-3a closed it read **2 572 attempted structural edits = 1 503 inserted +
248 removed + 256 gate + 24 flow + 28 last-entry + 136 shares-a-line + 182 duplicate-key +
5 kept-block + 1 file-comment + 182 no-such-sibling + 0 inconsistent-indentation +
7 no-line-ending**; the figures the suite pins today are 0c-3b-1's, below. On the real corpus
**1 856 attempted structural edits — 928 inserted, 419 removed** — and no count from it is hard-coded.
Applied edits are
re-verified from **outside** the engine: the removal envelope satisfies four properties none of which
restates how it was built (eight since 0c-3b-1 and its review), the insertion point three, every line break an
insertion writes is byte-identical to the one already in use where it lands, and every comment the file
owns is still there.

### Phase 0c-3b-1 — the envelope becomes a set of owned runs

**R21 is closed and D2o is complete.** A structural edit's envelope was one contiguous `ByteSpan`; it is
now an **ordered, disjoint set of runs**, spliced as several replacements. The removal the 0c-3a review's
finding 1 demonstrated — the one that deleted a comment the ownership rules give to the file — is a real
edit again, and the comment, its indentation and the blank line under it come out byte for byte. The
decision record is [`docs/decisions/0c-3b-1-notes.md`](docs/decisions/0c-3b-1-notes.md).

**The derivation is three steps, and every input is an ownership fact the planner does not choose.** The
hull comes from `subtree_extent` over the entry's key and value, widened to whole lines exactly as
before; the holes come from `file_comments()` — each comment's whole line, grown over every
`blank_runs()` entry that touches it; the runs are the set difference. `blank_runs()` rather than a
textual "all spaces" test, because it is a **gap-only** answer: a whitespace-only line inside a block
scalar's body is that scalar's content and can never be preserved by mistake.

**The blank-run rule, stated in both directions, because the first write-up left it implicit and
overstated** (the review's finding 1). *A blank run survives a removal exactly when it touches the line
of a file-owned comment the removal preserves; every other blank run inside the hull is deleted with the
entry.* The run **below** a kept comment is ownership: rule 2 reads it to give the comment to the file,
so deleting it re-attributes the very comment the edit kept. The run **above** is adjacency, not
ownership — deleting it would leave the comment file-owned — and it survives because the unit preserved
is the neighbourhood `blank_runs()` groups with the comment's line, which the gap layer does not
arbitrate side by side (D2/D2d). Neither is "the layout the user chose": that wording is **withdrawn**,
because it would apply equally to a blank run touching no comment and such a run is deleted. Both
directions are pinned byte-exactly by
`a_blank_run_survives_only_where_it_touches_a_kept_comment`.

**Moving from a hull to a set made the invariant stronger, not weaker.** With a hull, "the envelope
covers the whole entry" was true by construction and therefore unstated — and the empty set satisfies
"the envelope touches nothing outside the entry" perfectly. `StructuralGuard::Removal` now asserts both
directions, the second by a new `VerificationFailure::EnvelopeMissesTheEntry` over the entry's
**frontier leaves** (a collection's span inside the entry legitimately straddles a preserved comment;
a token never can). Nothing was weakened: the sibling digest, the file-comment check,
`bytes_outside_the_replacements_match`, the permitted-span check and `OverlappingEdits` all still apply,
and the last matters more now that one removal contributes several replacements to one flat batch list.
**What those two halves prove is stated exactly since the review:** the run set covers exactly the
entry's **nodes** — every frontier leaf of it, no node outside it. They say nothing about trivia, because
both are stated over node spans, so unowned trivia inside the hull is invisible to them. The earlier
claim that together they say "the run set is exactly the entry" is withdrawn.

**Punching the comments out is not sufficient, and nothing before this phase said so.** A comment left
directly under a block scalar's content, **at that block's own body column or deeper**, is *content of
the block*: the neighbour's value changes although nothing about it was edited. Refused by name,
`EditError::RemovalWouldExtendABlockScalar` — the same class as `RemovalWouldExtendAKeptBlock` reached
from the other direction. No fixture held the shape (R20, the fifth time), so
`run-based-removal-envelope.yml` was written for it. **The refusal's first form compared no columns and
was therefore over-broad** (the review's finding 2): it turned down a folded block above a *column-zero*
comment, which cannot become block content at all. It now compares the first non-blank preserved line's
column against `ScalarPresentation::indent`, the body column the span layer already published — read,
never re-lexed (D2/D2d) — and refuses unconditionally only where that column was never observed, which
is a block whose content span is **empty**. `run-based-removal-boundaries.yml` was written for the safe
side of the condition, R20's sixth occurrence, together with the entry-owned-leading-comment-block plus
interior-file-comment pairing the notes had admitted neither corpus held.

**What is proven.** The structural sweep now reads **2 696 attempted structural edits = 1 585 inserted +
264 removed + 256 gate + 24 flow + 30 last-entry + 140 shares-a-line + 192 duplicate-key + 5 kept-block
+ 0 file-comment + 1 block-absorbs + 192 no-such-sibling + 0 inconsistent-indentation +
7 no-line-ending**, still per fixture and still asserted to cover the corpus exactly. Every applied
removal's run set satisfies **eight** externally derived properties, four of which only a set needs —
the runs cover every frontier leaf of the entry, **the runs and the bytes the preservation rule protects
partition the envelope's byte range in both directions**, no run intersects a file-owned comment, and
every gap holds whole lines of nothing but comment and blank lines. The real corpus is **unchanged in
every figure**: 1 856 attempts, 928 inserted, 419 removed, before and after the review's fix round.
R21's measured gain is one synthetic removal and zero real ones — exactly the cost D2o measured for the
refusal — and its real value is that a move is impossible on a hull.

**Property 6 was rewritten in the review's fix round, and this is the important half of finding 1.** It
used to require every gap between two runs to hold a file-owned comment, which **codified** the
behaviour: delete the blank line that makes a kept comment file-owned and the gap still holds a comment,
so the property passed, the comment's text survived, no decoded value moved, and the sweep certified a
re-attribution. Demonstrated rather than argued — with the engine broken that way, **both corpus sweeps
pass** (experiment 5b of `0c-3b-1-notes.md` §6). It is now a partition against `preserved_by_the_rule`,
the rule written down once on the test side, and it names the bytes and the direction of any
disagreement: *"the envelope deletes 294..482, which the preservation rule protects…"*. An oracle that
cannot fail for the right reason is not an oracle.

### Phase 0c-3b-2a — the first edit that relocates bytes, and the invariant that forces

`ItemMove` joins `ScalarEdit`, `FieldInsert` and `FieldRemoval` in the `DocumentEdit` batch. A move
relocates a whole **sequence item** — a match — to another position **in the same block sequence**. It is
a removal plus an insertion and needs no second engine: it shares `removal_envelope` with `FieldRemoval`
and `insertion_point` with `FieldInsert`, which is exactly what 0c-3b-1's run set made expressible.

**The carried bytes are copied verbatim — no rendering, no re-indentation** — and that is measured, not
assumed. `PROGRESS.md` predicted a move would re-indent what it carries and that R23's column comparison
could not be reused unchanged; **the prediction was wrong**, because the valid items of one block sequence
share their structural indentation (D2r, notes §7.1). The proof is scoped to that operation and does not
transfer to a differently indented or nested destination.

**Byte identity stopped being sufficient, and the replacement is five production properties** (D2q).
"Every byte outside the replaced spans is identical" survived 0c-3a only because insert and remove never
relocate anything. A move does, so `verify()` now also asserts: the document's lines are conserved as
paired multisets of content and terminator; the items are in the intended order; every construct the move
did not name decodes to the same value, by a lockstep tree walk; **the arrival is the departure**; and
**comment ownership survives**.

**Six typed refusals**: `NotASequenceItem`, `NoSuchDestinationItem`, `MoveChangesNothing`,
`MoveMustBeTheOnlyEditInItsBatch`, `MoveWouldInventALineEnding`, `MoveWouldTerminateTheFinalLine`,
plus `MoveWouldExtendAKeptBlock` and `MoveWouldExtendABlockScalar` at four separately counted `MoveSeam`s.

**What is proven.** A move sweep over every block sequence of all 32 synthetic fixtures and the real
corpus: **2 571 synthetic attempts, 1 790 applied**, pinned per fixture with the table asserted to cover
the corpus exactly, every refusal re-derived independently by the test. The real corpus is **340 attempted,
126 applied**, computed and never hard-coded. `MoveWouldExtendAKeptBlock` was found **by the new invariant**
on `scalar-styles.yml` before the refusal existed — the invariant caught a real defect rather than merely
passing, which is what gives it credibility.

**The review's two High findings were real, and both are closed** — see the disposition below. The
headline one is that the check proving the carried bytes were copied verbatim lived **only in the test
sweep**, so a defective planner that permuted what it carried could still mint a `PatchedDocument`. It is
now a production property derived from independently bounded source runs. Every one of the review's
concrete counterexamples is a **retained test** that fails without the fix, and
`every_other_move_property_certifies_the_permuted_candidate` pins that the other four properties **accept**
the corrupted candidate — so the new one is demonstrably the thing doing the work.

### Phase 0c-3b-2b — the gate, and the verdict

**The Phase 0 architectural gate (R4) is PASSED, with four qualifications.** The full verdict, with its
evidence, is [`docs/decisions/0c-3b-2b-notes.md`](docs/decisions/0c-3b-2b-notes.md) §8. Plan §12's exit
criterion — *"the round-trip property test passes on the full corpus"* — is met, and **"full corpus" means
every eligible target in every file**, not merely every file.

**The R9 sweep** ([`tests/gate_roundtrip.rs`](crates/espansoconfig-core/tests/gate_roundtrip.rs)) crosses
twelve axes — CRLF/LF, BOM, no final newline, trailing spaces, comments, block-scalar terminal newlines,
duplicate keys, nested sequence mappings, merge keys, aliases, explicit keys, empty values — with all four
operations, over both corpora: **2 080 synthetic attempts (1 696 applied) and 1 998 real (1 851 applied),
with no stride and no thinning**. Eight properties are checked on every applied edit; not one verification
failure occurred anywhere. Every refusal is typed, and the hazard families are re-derived from the
document. The 48-cell axis×operation matrix has **no `Absent` cell**; 18 are `RefusedOnly`, each
enumerated and asserted against the measurement rather than read off the table.

**R16 is answered without a second parser, and the reasoning is D2s.** An in-house YAML 1.1 / 1.2-core
tag-resolution table lives in the **library** ([`src/emit/tags.rs`](crates/espansoconfig-core/src/emit/tags.rs)),
is consulted by the emitter, and is asserted in `verify()` as a **differential** property. R16 nonetheless
**stays open** for the projection half — see the risk row, worded so it cannot be mistaken for mitigated.

**The oracle immediately found a real defect, which is the whole argument for building it.** D2h's
plain-safety predicate was **incomplete**: it wrote **34 distinct 1.1-ambiguous values plain** — `=`, an
`._7`/`.__2` family, and `2001-1-1 10:00:00`. Every one of those is a value espanso would have read as a
non-string. Fixed in `is_conservatively_safe_plain_scalar`.

**The first verdict was wrong, and the review caught it.** This section's first draft said PASSED on
evidence that included E5 — a demonstrated production escape — as *supporting* evidence. See the
disposition below. The phase was held open, the blocker was closed **in production**, and the verdict was
**re-derived rather than reworded**.

### Phase 1a — the core-side read model

The first work after the gate, and still **no UI**: `crate::model` projects a parsed document into the
read-only view the browser will render, and `crate::workspace` is the load-and-cache layer Phase 1b's
Tauri commands wrap. The decision record is
[`docs/decisions/1a-notes.md`](docs/decisions/1a-notes.md).

**The projection is a projection, and D2u is a type rather than a note.** `DocumentView` → `MatchView`
(all 22 of plan §3.3's fields) / `VariableView` (the nine §3.4 types, `params` shallow) /
`ConfigProfileView`, with every user-authored scalar exposed as a `ScalarView` holding `decode()`'s
**source text**. There is no `bool`, no `i64` and no value enum anywhere a user's scalar can reach —
`word` and `propagate_case` included, which is the whole point: rendering `on` as a boolean is R16's
open half making a claim this project has not earned. `ScalarView` carries an `ambiguous_yaml_1_1` flag
read off `emit::tags` — a claim about *risk*, which D2u permits. A badge likewise comes from a key's
presence or a `type` field's text, **never from a value**, so there is deliberately no "word boundary
ON" badge; `badges_come_from_key_presence_and_type_text_never_from_a_scalar_value` pins the absence.

**"No key is dropped" is a checked accounting, not a promise.** Every key is either modelled, or
recorded as an `UnknownEntry` by name and path, or **lies inside a recorded undescended span** — the
third clause is the review's finding 2, and it is stated as a bound rather than folded into the claim.
The library checks it itself (`DocumentView::unaccounted_keys` → `DiagnosticCode::KeyNotAccountedFor`),
which is R24 applied before a reviewer had to; and the test-side oracle derives its expectation from
the **document tree**, not from the records the projection emitted, which is what the first version got
wrong. Measured: **546 synthetic keys = 518 named + 28 span-accounted**, and **566 real = 566 named**.

**Identity is scoped to the parse that minted it, and a stale one is refused** (D2v). This is the
review's finding 1 and it was a real defect: `NodeId` is the parser's arena index, so exchanging two
equally shaped matches and reparsing handed `:a`'s identity to `:b`. `MatchId` now carries the
document's `ContentRevision` and `match_by_id` returns `Result<_, IdentityError>`; `DocumentId` comes
from a monotonic session counter keyed by path rather than from sorted enumeration position, so adding
an alphabetically earlier file no longer re-points a retained id at another file.

**The cache is R19's remaining half, answered.** `Workspace::{discover, summary, list_documents,
get_document, get_match, document_view, document_text, refresh, load_all, evict}` builds the
`SyntaxIndex` + `TriviaIndex` **once per `ContentRevision`** and serves views from the cache;
`loading_every_document_parses_each_exactly_once` and
`a_second_view_of_one_revision_is_served_without_reparsing` pin it against an instrumented parse
counter. A cache slot may hold only what the disk held — the draft-injecting entry point the first
version exposed is gone (finding 3), because plan §6.4 gives disk state to Rust and the draft to the
frontend.

**What is proven.** Every match in all 33 synthetic fixtures projects, pinned per fixture in a table
asserted to cover the corpus exactly, and the real corpus projects with every figure computed. Every
fixture survives truncation at every character without a panic; the four deliberately invalid fixtures
yield typed diagnostics and still expose their raw text; a document that is not espanso-shaped at all
projects rather than failing. **471 tests pass**, up from Phase 0's 465.

**Five review findings, all closed, and two of them were real defects** — see the disposition below.

### Phase 1b-1 — the shell, the scaffold, and the i18n layer

The first code in this repository that a user could ever see. `src-tauri/` and `src/` both exist for
the first time; the workspace is no longer a single crate. The decision record is
[`docs/decisions/1b-1-notes.md`](docs/decisions/1b-1-notes.md).

**The architecture rule survived the phase that could break it, and its check changed** (D2x). `src-tauri`
depends on `espansoconfig-core` by path and the arrow points one way only: `cargo tree -p
espansoconfig-core` lists `saphyr-parser`, `serde` and `sha2` and nothing else. **`rg -c tauri Cargo.lock`
is no longer a check** and must not be quoted as one — the lockfile now legitimately contains tauri, so
the old one-liner passes vacuously exactly when it would matter most.

**A missing translation is a compile error in both directions, and that is a type rather than a
convention.** `TranslationKey = keyof typeof en` makes `en.json` the schema, and the binding
`const spanish: ExactDictionary<typeof es> = es` makes a key **missing from** *or* **surplus in**
`es.json` fail `svelte-check`. The second direction is the one a plain `Record<TranslationKey, string>`
would have missed, because excess-property checking does not apply to a non-literal assignment — so
`ExactDictionary` maps every surplus key to `never`. Both directions were verified by disabling
experiments rather than asserted (notes §2).

**Four runtime checks cover what the types cannot see**, because a type says nothing about what a string
*contains*: key-set parity read from the two files rather than from a list, `{placeholder}`-set parity
per key (a translator who drops `{language}` produces a string that type-checks and renders), a
**untranslated-value** heuristic with its exceptions **listed by key** so the exception set is
auditable, and the markup scan below. 71 frontend tests across 8 files.

**That fourth check is a heuristic and its name now says so** — the review's finding 5. It establishes
**non-identity**, not that a value is Spanish: renaming `language.label` to `"Sprache"` leaves it
non-blank, trimmed, unequal to the English and placeholder-clean, so every check passes. The notes said
the runtime tests covered "whether a Spanish value is actually Spanish". They did not, and both the
assertion and every sentence claiming it have been corrected. *An oracle must be able to disagree* (R24)
applies to a test's **name** as much as to its body.

**The hardcoded-string check is stated with its blind spots, not with its result.** It scans
`src/**/*.svelte` markup for literal text that did not come through `t()`, and it **cannot see**
`<script>` bodies, `{'literal'}` expressions, `.ts` string constants or props. A clean run therefore
means *"no literal sits in markup"*, which is weaker than *"no hardcoded string exists"* — the notes say
so in those words (§7). Its blind spots are themselves pinned as tests, and it was proven able to fire
against the real tree rather than only to pass.

**Locale follows the first *servable* tag of `navigator.languages`, not the head of the list.** A user
whose preferences read `[fr, es, en]` gets Spanish, where reading only the head would have given them
English via the fallback. The override lives behind a storage port and is stored as **absence of an
override** rather than as a snapshot of the detected locale, so a user who never chose keeps following
their system.

**What is not there, on purpose:** no IPC command (1b-2), no router, no CodeMirror (Phase 3), no
three-pane layout (1c). **The Tauri capability set is empty** — `"permissions": []` — because the 1b-1
frontend calls no Tauri API at all, and the production CSP has no `'unsafe-inline'`.

**Both of those are the review's High findings, and both were real grants rather than theoretical ones.**
The capability set was `core:default`, which the phase described as "nothing else — no filesystem
permission": it expands to the path, event, window, webview, image, menu and tray defaults, and
`image:allow-from-path` + `image:allow-rgba` alone let a compromised renderer read the pixels of any
local image. The production CSP allowed `'unsafe-inline'` styles although the production bundle emits an
**external** CSS asset and only Vite's dev server ever needed it — so injected markup could hide the
interface and paint its own text. The relaxed policy now lives in `devCsp`, where it is true.

**The declared macOS floor and the compile target now state the same thing, which they did not.**
`vite.config.ts` targets `safari16` while `tauri.conf.json` declared `minimumSystemVersion: "11.0"`,
whose WKWebView predates `Object.hasOwn` (Safari 15.4+) — and `translate()` calls it on the first render,
so a macOS 11 user would have met `TypeError: Object.hasOwn is not a function` and a blank window. The
floor is **13.0** (the release that ships Safari 16), the call is now
`Object.prototype.hasOwnProperty.call`, and `webview-floor.test.ts` fails if the two ever disagree
again. Widening the floor later means lowering the esbuild target, not editing the plist — that is a
Phase 5 packaging decision, recorded so it cannot be taken by accident.

**The fix round found a defect neither the phase nor the review reached, and it invalidated the phase's
own smoke test.** `src-tauri/Cargo.toml` declared no `custom-protocol` feature, so
`tauri::is_dev()` — literally `!cfg!(feature = "custom-protocol")` — was true in every build, and every
binary loaded the dead `devUrl`. The window that 1b-1 reported as "launched and stayed up" was
**blank**. It was separated from a frontend exception by planting a static `<h1>` in `dist/index.html`
and watching that fail to render too. The feature is now declared and off by default. This is R32 in its
sharpest form: *a process that stays up is not a screen that renders*, and only something that looks at
the pixels can tell the two apart.

**Twelve coverage holes are stated as holes** (notes §9) — the unlocalized macOS menu chief among them.
The reviewer argued the phase should not close while it is open; the rebuttal is that localizing it
needs either Spanish strings in Rust (plan §9 forbids) or an IPC command (1b-2 by design). **Both the
objection and the rebuttal are recorded in the notes as a live disagreement**, not resolved by silence.

### Phase 1b-2a — the read-only IPC surface, and the identity claim it had to withdraw

The **boundary**. 1b-1 shipped no command on purpose, so that `t()` was the only route any string
could take to a screen; 1b-2a is the first code that carries data across it. The decision record is
[`docs/decisions/1b-2a-notes.md`](docs/decisions/1b-2a-notes.md).

**Five read-only commands, and nothing else.** `open_workspace`, `list_documents`, `get_document`,
`get_match`, `reload_document` are one-line wrappers over a `WorkspaceSession` holding `Workspace`
behind a std `Mutex`. They are **synchronous**, which is the whole reason no guard can cross an
`.await` — the deadlock class is designed out rather than reviewed for. **No mutating command
exists**, and that is now enforced rather than asserted: `wire_contract.rs` parses the complete
`generate_handler!` list independently and compares it bidirectionally against the frontend's names,
then asserts that none of the six Phase 2 names appears in either set. Before the review that test
compared only one direction, so registering `commands::save_match` and changing nothing else left it
**green** — the oracle could not disagree with the thing it was named for.

**The wire error carries codes and operands, and has no `Display` impl at all.** Nine flat codes with
structured operands, a hand-written `Serialize` that writes `code()` so each code has exactly **one**
spelling in the crate, and `From` impls that match the core's three error enums exhaustively — a new
core variant fails the build. Plan §9's "codes and structured data, never prose" is a property of the
type rather than a habit: there is no developer rendering to leak, because none was written.

**`"permissions": []` is now evidence rather than argument.** `dispatch_check.rs` drives all five
commands through the real Tauri dispatcher (`MockRuntime` plus the **shipped** `tauri.conf.json` and
capability file), so the claim that the empty capability set suffices is measured. A first attempt
used `http://tauri.localhost`, which macOS does not treat as local, and every command was refused;
that accident became `a_remote_origin_is_refused`, pinning **both** sides of the access check. The
1b-1 review's High finding — that `core:default` was a real grant, not a theoretical one — stays
closed.

**R27 was stated falsely in three files and in this checkpoint, and the review caught it.** See the
correction below. `identityRecovery()` now returns
`{action: 'reresolve', mayFind: ['sameMatch', 'differentMatch', 'gone']}` — the three answers as
**data**, so a caller cannot skip one — and `a_document_path_is_positional_so_a_deletion_repoints_it`
is the counterexample in test form.

**A non-UTF-8 path could turn a typed failure into untyped prose, and that is fixed in the core.**
serde's `PathBuf` serializer rejects non-UTF-8 paths, so `list_documents` could return `Ok(...)` and
then fail *during response serialization* — and an `Io` error carrying the same path could fail to
serialize too, delivering serde's generic English to the webview. `crate::wire`'s `WirePath` now
backs all five wire path fields and all four `CommandError` path operands. macOS APFS refuses to
create such a filename (`EILSEQ`, confirmed by trying), so the tests drive the serialization path
directly rather than through the filesystem, and **say so** instead of skipping.

**What is proven.** **514 tests pass** (core 478, up from 471; shell 36, up from 1). Thirteen
disabling experiments are recorded — six of them run against the committed code, including the one
the review required: `commands::save_match` added to `generate_handler!`, the test observed
**failing**, reverted, tree verified clean. Four coverage holes remain, each numbered with the phase
that owns it named.

**Ten review findings, all closed, and two of them were real defects** — see the disposition below.

### Phase 1b-2b — the prose, the exhaustiveness check, and the menu

The **prose**. 1b-2a made the boundary carry codes and structured data with no rendering anywhere;
1b-2b is what turns those codes into sentences a user can read, in both languages, and what makes a
code without a sentence a **build failure** rather than an empty label. The decision record is
[`docs/decisions/1b-2b-notes.md`](docs/decisions/1b-2b-notes.md).

**Sixteen namespaces, 111 code keys, 138 keys per dictionary.** Every enum that can reach the UI —
`DiagnosticCode` (23), `MatchBadge` (10), `HazardKind` (10), `CommandError` (12), `UnknownReason` (4),
`WorkspaceError` (5), `IdentityError` (3), `ValueKind` (5), `DocumentShape` (3), `DiscoveryError` (3),
plus `ScalarStyle`, `LineEnding`, `FileKind`, `TriggerKind`, `ContentKind`, `VariableKind` — has an
`en` and an `es` entry under `code.<enum>.<variant>`. The scheme is an **identity formula** from the
Rust variant name, which is what lets the check below compute the expected key set instead of reading
a list. `src/lib/i18n/codes.ts` gives typed key builders whose template-literal return types make a
missing key a **compile error**, and the operands ride the existing `{placeholder}` interpolation, so
the placeholder-parity test covers them for free.

**The last six were deferred to 1c and the review took the deferral away.** `ScalarStyle`,
`LineEnding`, `FileKind`, `TriggerKind`, `ContentKind` and `VariableKind` already cross the wire in
the read projection; a 1c component meeting `trigger.kind = "Single"` with no string could only render
a raw Rust identifier or invent an unchecked mapping. They are in, and the phase's own argument for
deferring them is withdrawn rather than softened.

**The exhaustiveness check parses Rust properly, because scanning lines failed open three ways.**
`src-tauri/src/rust_source.rs` uses `syn` and `proc-macro2` — **dev-dependencies of `src-tauri` only**,
never of the core — and `dictionary_contract.rs` compares the derived variant set against both
dictionaries **bidirectionally**: a variant with no key fails, and a stale key with no variant fails
too. The registry it checks is no longer trusted either: `every_serializable_enum_is_a_namespace_or_is_named_as_not_a_code`
walks both source trees for `Serialize`-carrying enums and
`every_typescript_wire_union_has_a_namespace` walks `types.ts`'s unions, so a **brand-new enum** is
caught by derivation rather than by someone remembering to add a row. Four enums are excluded by name,
each with a reason.

**What still escapes is written down with a worked example.** A parser cannot expand a macro, so an
enum produced by `macro_rules!` is invisible to both derived checks — planted, all eight
`dictionary_contract` tests observed **passing**, recorded as experiment 12E and as a coverage hole.
The limit is stated because the alternative is a check whose name outruns what its body can see.

**The developer string left the type, because a name scanner could never enforce "never rendered".**
`classifyFailure()`'s `detail` was guarded by a lint forbidding the identifier — and
`JSON.stringify(classifyFailure(x))` names no identifier at all. It is now non-enumerable and
symbol-keyed, readable only through `developerDetail()`, with `reportIpcFailure()` as its console
destination. `JSON.stringify` of a failure is pinned at `{"kind":"unexpected"}`, spread and
`structuredClone` included, so putting it back under any name fails. The notes' claim that "a component
that renders it fails `npm test`" was **false when written** and is withdrawn.

**The macOS menu is localized and no Rust file holds a label.** Tauri v2 builds the menu in Rust, so the
three submenus' 16 labels are translated on the frontend and handed across a sixth command,
`set_menu_labels`; `menu.rs` contains **zero user-facing string literals**, and a check that *lexes* the
file — rather than masking comment lines, which let `*/ let title = "Edit";` through — pins that. The
locale link is `LocaleState.subscribe`, not an `$effect`, because an effect is a no-op under vitest's
node environment and would have been untestable.

**`"permissions": []` survived the phase 1b-1 expected would need the first entry.** A capability governs
**plugin** commands; `set_menu_labels` is this application's own command, and `core:menu` is what a
renderer driving `@tauri-apps/api/menu` itself would need — granting it would let a compromised renderer
replace the application menu. `dispatch_check.rs` drives all **six** commands through the real dispatcher
with the shipped config, so this is measured rather than argued, and `core:default` stays gone.

**Two failure paths were invisible and both are now typed.** A version skew was refused *inside Tauri's
command macro*, producing English prose with no `code`, and `main.ts` dropped the promise — so an English
default menu could stay up forever with nothing reported. The command now takes an untyped envelope and
validates it itself, answering `invalidMenuLabels { missing, unexpected }`. Separately, `{ ok: true }` was
returned before `build_menu()`/`set_menu()` ran; `menu::on_main_thread` now waits on a one-shot channel and
answers `menuBuildFailed`. Waiting cannot deadlock, and the reason is read from the runtime source rather
than assumed: a main-thread post runs **inline** when the caller is already on the main thread.

**What is proven.** **544 Rust tests and 214 frontend tests pass** (from 514 and 104). Sixteen disabling
experiments are recorded verbatim across the two halves and the fix round, and the load-bearing ones break
the *engine* rather than a layer: adding a real `MatchBadge` variant to the core fired both new Rust tests
while all ten `wire_contract` tests passed, which is 1b-2a's hole 4 demonstrated rather than argued.

**Seven review findings, two of them High, all dispositioned** — see the disposition below. Eleven coverage
holes remain, each with the phase that owns it named, and the largest is the honest one: **nothing renders
any of these 111 strings yet**, and nothing establishes that any of the Spanish values is Spanish.

### Phase 1c-1 — the three-pane shell, and the first screen that shows a configuration

The first phase in this project whose deliverable is something a person looks at. `AppShell.svelte` no
longer holds a placeholder: it calls the read-only IPC boundary on mount and renders plan §8.1's three
panes over the result. The decision record is
[`docs/decisions/1c-1-notes.md`](docs/decisions/1c-1-notes.md).

**Four states before there are three of anything**, each localized: reading, read-and-empty, failed, and
ready. The failure arm has two headings and one message — `configDirNotFound` is separated from
everything else, because "espanso is not installed on this machine" is an ordinary state a first-run user
is in and "something went wrong" is not. Every failure sentence is `tIpcFailure`, so no code can reach the
screen without prose.

**Search reads one field, and that is the point.** The core precomputes `MatchView.search_text` from the
five fields plan §8.1 names; the frontend owns only the *matching rule* — case folding via
`toLocaleLowerCase`, and the decision that several words must all appear. Re-deriving the haystack in
TypeScript would make the plan's list two facts in two languages with nothing comparing them.
**The review found the core's own join was short**: it took `ContentSpec::primary()`, so a match holding
`replace` **and** `html` was unsearchable by its `html`. `collect_scalars` replaced it.

**Badges come from badge data.** `MatchView.badges`, rendered verbatim through `tMatchBadge`; nothing in
the frontend derives a badge from a value, and `shows no badge for a field the core did not badge` fires
if anything starts to.

**R32's first half is discharged, and this is the oldest debt in the project.** `open_workspace`,
`list_documents`, `get_document` and `get_match` all survive tree-shaking into `dist` — verified against
the built bundle, not argued. Five readings were taken from a **running window** against a synthetic
config: the populated screen in both languages, a count-of-one tooltip, the partial-total block, and the
no-configuration state; the detail pane was clicked and rendered in both languages. The readings were
**re-taken after the review fix round**, because that round edited two of the components and this project
has already reported a window that "launched and stayed up" while being blank. What the technique
establishes is **layout and text, not pixels** — colour, contrast and paint are unverified, and that
stays a stated hole.

**The review's two High findings were both real, and the first was the serious one.** The selection's
fingerprint compared `search_text`, the badge list and two shape codes — so `word`, `propagate_case`,
variables, form fields, unmodelled entries and every non-primary content field were **invisible to it**.
Two matches differing only in `word: true` / `word: false` fingerprinted identically, and re-resolution
answered `sameMatch` for the wrong snippet. That is the R27 class of defect exactly. It is closed by
**`MatchView.source_text`**, the match's own bytes, which is a fact about how the file is written and so
is D2u-safe. The second: recovery installed the re-resolved identity but never replaced the stale
`DocumentView`, so `selectedMatch` kept resolving the old node behind a fresh id.

**What is proven.** **354 frontend tests across 23 files** (from 318 and 21) and the Rust suite unchanged
in verdict, with `search_text`'s widening pinned in `model_projection.rs`. **Twenty-two disabling
experiments** across the phase and its fix round, each run, recorded and reverted; all fired. One did
**not** fire until its test was strengthened, and that is recorded in the notes rather than tidied away.

### Phase 1c-2a — the detail pane's match, and D2u seen on a screen

The third pane no longer holds a placeholder. `DetailPane.svelte` renders the selected match field by
field: plan §3.3's trigger, content, metadata and option fields, §3.4's nine variable types with their
parameters, §3.5's form fields, and the entries the projection did not model. The decision record is
[`docs/decisions/1c-2a-notes.md`](docs/decisions/1c-2a-notes.md).

**The logic is not in the component, and that is a structural decision rather than a style one.**
Nothing in this repository renders a Svelte component in an automated test, so anything deciding *what*
appears is logic no test can reach. `describeMatch()` and `flattenValue()` live in
[`src/lib/browser/detail.ts`](src/lib/browser/detail.ts) with a suite of their own; the component is
five snippets and one walk. The phase caught itself violating this once — a variable card filtering its
own rows in markup — and moved it.

**D2u was seen rather than asserted.** In a running window, `word: on` renders as the two characters
`on`, the 1.1-ambiguity chip sits on `on`, `true`, `false` and `0` and *not* on `capitalize` or `UTC`,
and a block scalar keeps its lines under the label "Written as a literal block". There is no checkbox
anywhere in the pane and no badge derived from any value.

**Absent is not empty, and both were on screen at once.** A present `comment:` with nothing after it
shows "written as empty text"; a match with no `comment:` key shows no Comment row at all. The one place
the wire cannot tell them apart is a sequence — `triggers: []` and no `triggers:` key both arrive as
`[]` — and that is recorded as a hole whose fix belongs in the core, not guessed at in TypeScript.

**The trigger and content sides are never collapsed.** A match holding both a `trigger` and a `regex`
draws both rows, which is what the 1c-1 review's High finding was about.

**The review found no High finding, and its two Mediums were both real.** The first is the one worth
remembering: the pane told the reader an unmodelled entry was "shown as written" **and did not show
it** — `UnknownEntry` carries `value_kind` and `value_span` but **no value text at all**, so the pane
could not have. Reworded in both languages to claim only what is true (the entry was *recorded and left
untouched* — a statement about the file, not about the screen), with `value_kind` now rendered and the
missing value written down as hole 13 and as Rust-side work for a later phase. The second: a sequence
item's bullet was modelled in `detail.ts` and rendered by nothing, so two `search_terms` whose first
item spanned two lines were indistinguishable from three items.

**D2w recurred, and was closed properly.** The field-coverage test built an input with every field, then
audited only what `describeMatch()` chose to emit and asserted the count was 24 — so a field added to
the union and never emitted would have passed. It is now an **equality** against `EVERY_DETAIL_FIELD`,
pinned to `DetailFieldName` in both directions by two `assertNever<Exclude<…>>()` calls, so the same
omission is a failing test and a new member is a compile error.

**What is proven.** **412 frontend tests across 24 files** (from 410 and 24 at 1c-1's close, itself 354),
the Rust suite unchanged in verdict, and **eighteen disabling experiments** — fourteen in the phase, four
in the fix round — each run, recorded and reverted. **Two deliberately did not fire**, and they retire a
claim it would have been easy to make: neither `svelte-check` nor `vite build` reports an unused CSS
selector, so a `depth-*` rule's presence in `dist` is *not* evidence that it is used.

---

### Phase 1c-2b-1 — the typed judgements, and the third time a written claim ran ahead of its data

The app now says things *about* a snippet and the file behind it. Thirty-two strings that had existed
since 1b-2b with **no caller at all** — ten `tHazard`, twenty-two `tDiagnostic` — reach a screen, and
the load-failure conflation 1c-1 named for 1c-2 is closed. The decision record is
[`docs/decisions/1c-2b-1-notes.md`](docs/decisions/1c-2b-1-notes.md). **No command and no wire field
were added**; every judgement here is read from data that was already on the wire and unread.

**Editability is a verdict plus a reason, and the permissive arm draws nothing.**
`matchEditability()` reads `safely_editable` (the verdict) and `blocking_hazard` (the reason) into
three arms. The pane draws the two refusals and **nothing at all** for the permission — Phase 1 is
read-only, so "this snippet can be edited safely" would be a promise the app cannot keep.

**The findings live in the middle pane, not the detail pane, and the reason is reachability.** A file
that fails to parse has no matches, so it can never be selected into the third pane; a diagnostic
rendered there would be unreachable in exactly the case it exists for.
[`src/lib/browser/findings.ts`](src/lib/browser/findings.ts) unions `DocumentView.hazards` with the
kinds named by `Hazard` diagnostics, filters those diagnostics out of the sentence list, and
deduplicates the rest.

**Could not is now distinguishable from have not.** `loadFailures` carries the `DocumentId` rather
than the path — path matching is unsound because `WirePath` renders unencodable bytes as U+FFFD — so
a refused file's row says "Could not be read" where a never-projected profile shows `–`, and a
refused file is no longer counted as *pending*.

**The review's High finding was this sub-phase's own failure mode, and it recurred twice more.** The
sub-phase existed to avoid claiming on screen what the app does not do, and shipped
`AdditionalDocumentNotProjected` saying a second YAML document "is shown but not interpreted" — while
nothing shows it and the viewer that would is in 1c-2b-2. The string-versus-data sweep that fix forced
then found a **second**: `notEditable` said the *snippet* contains the hazard, but
`disqualifying_hazard` ranges over node-less, same-node, ancestor **and** descendant hazards, so it now
says *this file contains*. A second review pass found the **third**: the notes asserted that profiles
contribute "no snippet-list row" and "stay out of `scopedMatches`" — both false at the time they were
written, because the fix that projected profiles had not guarded the list.

**Projecting profiles was a fix, and it introduced the regression above.** Profiles were skipped at
`open()` on the grounds that they hold no matches — true, and the wrong test: a profile has
*diagnostics*, and a profile with broken YAML was silent in every pane. They are projected now, and
`holdsMatches` governs *counting* only. The leak was that `scopedMatches()` consulted neither. It
consults it in both branches now, **on `kind` (where the file lives — espanso does not load snippets
from `config/`) rather than on `shape` (what its content looks like)**, which is exactly the
distinction a match-shaped profile turns on.

**A displayed index is one-based, and the conversion is a mapped type.** `document_index` is a
zero-based wire operand that was reaching the screen as "Document 0". The conversion happens at the
display boundary and emits under a *display* operand name, so a stale dictionary leaves a visible
`{document_index}` rather than a wrong number. Keyed on the operand spelling it would have let a future
`match_index` render zero-based in silence, so it is now `DIAGNOSTIC_DISPLAY_INDICES`, **a mapped type
over `DiagnosticCodeName` with a row per variant** — a new code without a row is a `svelte-check`
failure naming the variant.

**What is proven.** **479 frontend tests across 25 files** (from 412 at 1c-2a's close), the Rust suite
unchanged in verdict at 547, and **twenty-five disabling experiments** — twenty-two in the phase, three
in the two fix rounds — each run, recorded and reverted. **Three deliberately did not fire**, and the
third is the sharpest the project has recorded: `tHazard(` left in a comment while the markup renders
the raw identifier passes every test, which is the reviewer's own Low 3 scenario demonstrated rather
than asserted. Two window readings were taken across the phase and its fix rounds, in **both
languages**, and the second showed the profile fix on screen: the "All" list reading 7 of 7 against a
sidebar total of 7 where it had read nine rows before.

**One instrument lesson, recorded because it silently invalidated a reading.** `custom-protocol`
embeds `dist` into the binary, so **`cargo build` must follow every `npm run build`** — one reading was
taken against the previous bundle and looked entirely normal.

### Phase 1c-2b-2a — the boundary, and what a byte-fidelity API can actually promise

**`document_text` is a command now, and it never was one.** The claim carried in this file for two
sub-phases — that it was "the one command with no frontend caller, tree-shaken out of `dist`" — was
false: it was a `Workspace` method that `main.rs` had never registered. It is the **seventh** registered
command (six read-only plus `set_menu_labels`), wrapped as `documentText()` in `src/lib/ipc/commands.ts`,
and `dispatch_check.rs` proves seven reachable with `"permissions": []` by invoking each one, not by
arguing from the handler list.

**`UnknownEntry.value_text` closes the known lie-by-omission**, and it is the one wire-field addition of
the sub-phase. An unmodelled entry carried `value_kind` and `value_span` and no text, so the pane could
only say the entry was *recorded and left untouched*. The value's source text is now sliced **in Rust**
and carried, because a JavaScript string index is a UTF-16 code unit and a `ByteSpan` is not — the same
confusion the core's `CharToByte` adapter exists to prevent, prevented once more at the boundary.
**Nothing renders it yet**: `detail.ts` and `DetailPane.svelte` deliberately do not read it, so the
existing "the value is not on screen" strings stay true. Rendering it and changing those strings happen
together in 1c-2b-2b, or not at all.

**The fidelity claim is measured, not argued.** The whole synthetic corpus is copied into a workspace and
asked for over the **real IPC dispatcher**, each answer compared byte for byte with `std::fs::read` —
**33 fixtures, 37 406 bytes, identical**. CRLF, the UTF-8 BOM, a missing final newline, precomposed *and*
decomposed `é`, astral `😀`, block-scalar terminal spaces, NUL and U+2028 / U+2029 all survive. Every
Unicode assertion is written as a `\u{…}` escape, because a literal `é` in a test file can be normalised
by an editor, at which point the test would agree with a normalising boundary instead of catching it.

**What a `CommandResult<string>` can promise, stated narrowly after the review made it say so.** The
contract is **exact preservation of valid UTF-8, and a typed refusal otherwise** — not "the raw file
bytes". A file containing byte `0x80` reads fine with `std::fs::read` and then becomes
`WorkspaceError::NotUtf8 { path, offset }`; it does not panic and is never decoded lossily, but the raw
pane cannot show it at all. That is the sub-phase's most consequential inheritance: widening the wire to
carry arbitrary disk bytes later is a **format change Phases 2–5 would pay for**, and it is recorded as a
decision with its cost rather than discovered in Phase 3.

**Two limits are named rather than implied.** `mock_builder()` swaps out the platform webview, so every
measurement stops at Tauri's own response-body encoder and decoder and says **nothing** about WKWebView,
`postMessage`, or a lone surrogate — closing that needs a reading of a running window, which is 1c-2b-2b's
because it is the sub-phase that will have something on screen to read. And `value_text` is **uncapped**:
disjoint spans bound *duplication* to about one extra document, which is not a bound on *size*, so one
unknown block scalar spanning a very large file is owned by the cache, cloned by `get_document` and
encoded again, on the main thread.

**The review found six claims outrunning their evidence, and four were test names.** A test called
`an_unmodelled_entrys_value_crosses_as_its_own_bytes` never built an app; `a_remote_origin_is_refused`
said "any of the seven commands" and attempted three; `every_command_refuses_before_a_workspace_is_open`
never called `text`; and `capabilities/default.json` said the harness drives "all six commands". All are
closed **in production** — the remote-origin table is now asserted equal in both directions to the names
parsed out of `generate_handler!`, so a command added without an entry fails the test rather than sliding
past it.

**What is proven.** **559 Rust tests across 16 binaries**, 0 failed (547 at 1c-2b-1's close), the frontend
suite unchanged in verdict at **480 across 25 files**, and **fifteen disabling experiments** — ten in the
phase, five in the fix round — each run, recorded and reverted. One (field reordering) correctly fired
nothing, two fired less than they should have and are recorded as such, and one could not be constructed
at all: **this application publishes no per-command ACL manifest**, so no per-command remote break exists
to make; a vacuity check was run in its place and the impossibility is written down as hole 11 rather
than as coverage. **226 dictionary keys, unchanged** — the sub-phase adds no user-facing string, which is
the one thing that makes its "no hardcoded string" claim cheap to believe.

### Phase 2a-1 — the first code that modifies a user's file, and the promise it had to withdraw

**`crates/espansoconfig-core/src/persist/write.rs` is the only code in the crate that opens a file for
writing.** It implements plan §6.6 steps **1, 2 and 6–11** and nothing else: an app-level per-path write
lock, a base-revision re-check, a uniquely named temp file in the target's own directory, a mode-bit
copy, an fsync, an atomic rename, a directory sync, and a read-back-and-hash verification. It takes
**finished bytes** — it does not build them, parse them, validate them, or write a backup. Steps 3–5 and
12–13 are 2a-2's and 2a-3's. Nothing crosses the IPC boundary: no command, no wire type, no dictionary
key, no screen. `WriteError` deliberately does **not** derive `Serialize`, because a wire-visible enum
needs strings in both dictionaries and the save command that will need them does not exist yet.

**The sub-phase's defining sentence was wrong, and the review is what made it right.** It began as *it
replaces the bytes of an existing regular file, atomically and durably, only if the file still holds what
the caller believed it held.* No POSIX or macOS operation can deliver that "only if" against a
non-cooperating writer — the process-wide mutex excludes this app's own threads and nothing else, so vim,
espanso, Dropbox or iCloud Drive can replace the target between the hash and the rename and lose an edit
while the save reports success. **What is built is atomic replacement plus optimistic conflict
detection**, and every doc comment now says so. **D4 records it.**

**The window is narrowed rather than papered over.** `recheck_target()` runs immediately before the
rename — three lines above it — and re-resolves the caller's path, compares device and inode and type
against the object whose bytes were hashed, and re-hashes. A mismatch is `TargetChangedDuringWrite`, a
**refusal that has written nothing to the target**, with a four-arm `TargetDifference`
(`Retargeted` · `Vanished` · `Identity` · `Contents`). It is a separate variant from `RevisionMismatch`
on purpose: the `Identity` arm has an *equal* hash and a different meaning for the user. The residual
race is now **one rename wide**, and is stated as narrowed and not closed.

**`inspect_target()` does one `open` + `fstat` + `read` on a single descriptor**, with `O_NOFOLLOW`, so
the mode bits, the bytes and the `(dev, ino)` identity provably come from one inode. The flag's value is
spelled out per target family rather than pulled from `libc` — this crate still has **no new
dependency** — and a test pins its *meaning* by asserting `ELOOP`, so a wrong constant fails rather than
silently opening a weaker file.

**Two claims were weakened and one reviewer premise was rebutted from the toolchain source.** The
reviewer held that macOS `sync_all()` is plain `fsync`; reading the local `rust-src`
(`library/std/src/sys/fs/unix.rs`) shows `std` issues `fcntl(fd, F_FULLFSYNC)` on Apple targets, which
the 4 ms measurement corroborates. But `ENOTSUP` has no fallback and the **directory** sync measurably
does not do the same work (<0.1 ms), so every durability claim was weakened anyway and the directory sync
is called best effort in the code and in the notes. **The saved bytes are power-cut durable; the rename
that publishes them is not.**

**The guarantee is mode bits, not permissions**, and §4 of the notes enumerates the eight classes a
temp-file-and-rename drops that a truncate-in-place would have kept — owner and group, POSIX ACLs,
extended attributes including Finder tags, resource forks, creation time, BSD flags such as `uchg`, and
hard-link relationships. The consequence that is not cosmetic is called out: **dropping a denying ACL
broadens access.** Implementing any of it needs `libc`; it is recorded as a hole addressed to a later
phase rather than silently accepted.

**The review's sharpest half was the test audit, and it was right.** Four of the ten stated guarantees
were pinned by tests that would have passed against a weaker implementation. The byte-exact fixture
sweep seeded each temp copy with **the fixture's own bytes**, so a writer that did nothing at all passed
it; it now seeds a `PLACEHOLDER` that contradicts all five properties under test, and a companion test
asserts both that the fixtures really contain the hazards and that the placeholder really contradicts
them. The concurrency test had each writer *replace* the file, which passes with no mutex at all, since
any single winner leaves a complete file; it is replaced by
`concurrent_read_modify_write_never_loses_an_update`, where each writer **appends** a unique line under
read-then-write-with-retry so a lost update is a missing line — and it fails with the lock removed. The
`chflags uchg` test could print a skip and pass when `chflags` could not be run; that path is gone.

**What is proven.** **600 Rust tests across 17 binaries**, 0 failed (559 at 1c-2b-2a's close), of which
25 integration and 14 unit tests are new. Six disabling experiments in the phase and more in the fix
round, each run, recorded and reverted. **Two coverage holes are stated in the reviewer's own terms
rather than presented as covered**: no test would fail if either `sync_all` or the read-back
verification were removed, and no test involves a second process. The frontend was not touched and its
suite was not run — this sub-phase adds **no user-facing string and no dictionary key**, which is what
makes its CLAUDE.md §2 compliance cheap to believe.

### Phase 2c-1a — the draft spine, with no editor and no screen

**Three modules in `src/lib/browser/`, and not one line of Rust, Svelte or IPC registration.** The
same shape as 1b-1 (the i18n layer with no command) and 2b-2c-3a (the core mode with no caller):
the state everything later stands on, proven before anything stands on it. `cargo test --workspace`
is in the verification table **precisely because** this phase should not have moved it, and it did
not — 1007, unchanged.

**`draft.ts` — `Draft<T>`, generic over the drafted value**, because the raw editor drafts a
`string` and 2c-2 will draft a structured `MatchDraft`. It carries a base revision **and** a base
value, a current value, past and future steps, and **`isDirty` derived from the base** rather than
stored — editing back to the base value makes it clean again, and there is no flag to forget to
clear. A draft is constructed with **rules**, `{ same, snapshot }`, not merely an equality: every
value it records is a deep-frozen snapshot, which is what stops an in-place mutation of a nested
field moving the base, the history and the consent candidate all at once. Undo, redo, redo cleared
on branching, and a bounded hundred-step history are all here, because
`docs/decisions/2c-split-notes.md` §3 makes undo a property of the shape rather than a later
sub-phase.

**Consent is opaque, branded, and derived — never handed in.** `acknowledgeRefusal(draft,
submission, refusal)` is the only producer, and it checks the base revision, the candidate identity
and acknowledgeability before it will issue one. Editing or undoing invalidates it. This is the
protocol's own content-addressing rule (`FindingCode::DocumentDoesNotParse` carries the candidate's
revision) meeting the fact that undo changes the candidate — put in the state shape because that is
the only place it cannot be forgotten.

**`invalidation.ts` — the obligation that was represented in no type.** After a committed
whole-document replacement every `MatchId` in the file is stale and `moved` is `null` permanently,
and until this phase a caller that ignored that compiled (`2b-2c-3b-notes.md` §7.2). Now the
outcome arrives **sealed**: the sealed object is an empty frozen husk, its payload lives in a
module-private `WeakMap`, and `openWholeDocumentSave(sealed, forget)` is the only way to learn
anything at all — so a caller that does not discharge the invalidation does not have a save result.
The seal is **one-shot**, and the entry is deleted *before* the callback runs, so a `forget` that
re-enters cannot be served either. **A throwing `forget` never unwrites the file**: the throw is
classified and returned beside the committed outcome, because *a committed write is never
afterwards reported as an error* and a previous review had already found that invariant broken in
TypeScript once.

**`saveOutcome.ts` — all three arms, returning codes and never sentences.** `Saved` including
`committed: false` as a legal success and its `notes` disclosures; `Refused` with the
acknowledgeable subset and the **exact-multiset** re-submission, delegating the
`DocumentDoesNotParse` case to `rawSave.ts` rather than restating it; and `Conflict` as the
terminal, honest state of `2c-split-notes.md` §6, whose model **carries the actual `Draft<T>`** and
whose reload is a confirmed transition rather than a descriptive boolean. There is no `scope`
string for a caller to get wrong — `describeWholeDocumentSave` and `describeEditSave` are separate
producers, and the whole-document saved arm **types** `moved: null`. **No affordance is named or
coded "keep my draft"**, and that is a rule rather than an oversight: the phrase means 2c-4b's
rebase.

**Three of the eight review findings were High, and two of the eight were this file's sibling
document claiming a guarantee the code did not give** — that the seal was unreadable, and that a
dishonest conflict model was "not expressible". Both were false as written, both are corrected in
the same words rather than softened, and the honesty rule they produced is now the first rule of
every 2c fix round: **where TypeScript cannot force something, say so in the same sentence that
describes what it does force.**

### Phase 2c-1b — the raw editor, and the first screen that writes a user's file

**Five commands could write a user's file and no screen called any of them. Now one does.** The raw
YAML viewer of 1c-2b-2b-2 became an editor: `rawEditor.ts` holds the whole state machine as a value
and `RawEditor.svelte` is a thin walk over it, which is the standing idiom — `src/lib/browser/`
holds what a test can reach, the component gets the walk. **No Rust: `cargo test --workspace` is
1007, unchanged, and run to prove it.**

**It reuses 2c-1a wholesale rather than restating it.** The drafted value is a `Draft<T>` with
dirty, undo and redo derived; the three arms come from `describeWholeDocumentSave`; the
`DocumentDoesNotParse` refusal is presented by `rawSave.ts`; consent is produced only by
`acknowledgeRefusal` and withdrawn the instant the text changes, with a sentence saying why.

**Hole 4.2 of 2c-1a is decided: sealed.** `BrowserState.saveRawDocument` answers a
`SealedWholeDocumentSave`, because `describeWholeDocumentSave` accepts only what the seal produces
— the alternative was every call site re-asserting the document/result pairing, which is what the
seal exists to stop. What it did **not** buy is written down beside what it did: the seal's callback
is not the cache invalidation, which the workspace already performs, earlier and correctly.

**This project's first mounted-component test, and the jsdom decision `vite.config.ts` had held open
since 1b-1.** It is scoped, not retroactive: `environment: 'node'` stays the default, the component
files opt in by docblock, and the existing six components are **not** back-filled. A first attempt
at `resolve.conditions` silently broke the production build — that option *replaces* Vite's
defaults, so `vite build` went 154→180 modules and pulled in Svelte's server build. **154 modules is
now a regression guard**, checked on every round.

**The window reading is the reason this phase is honest, and it is why the rule exists.** Two real
defects survived 883 passing tests, `svelte-check` and two Codex passes, and were caught only by
looking at a running window:

1. **CRLF was silently normalized.** A `<textarea>`'s value is the HTML **API value**, which the
   specification defines as having every line break normalized to LF — so the first keystroke in a
   CRLF file rewrote every line ending, the save wrote it, and the panel said *"exactly the text
   that was sent"*. **That is this project's central promise broken on the one screen that writes.**
   `crlf-line-endings.yml` exists to pin exactly this, and **no test in the project contained a
   single `\r`.**
2. ***Copy my text* did not copy**, on the one control that exists to keep a draft from being lost
   before the person discards it.

**(1) was fixed as a refusal, not a reconstruction** (D13 of the notes). Reconstruct-on-save is
named and refused: `file-comments-and-mixed-endings.yml` has exactly **two** CRLF lines among
bare-LF ones, so re-applying a dominant convention would reformat lines the user never touched —
the same violation wearing a different hat. The cost is stated rather than hidden: **a CRLF file
now cannot be repaired in the one editor that can repair a broken file.**

**The refusal is structural.** The drafted value is a branded `RoundTripText` whose only constructor
applies the check, so a bare `string` no longer type-checks into a draft, a submission, a history
step or a candidate; all three doors mint one or refuse; and `beginSave` re-checks anyway, because a
brand is a cast at bottom and that is the last line before a wire that replaces a user's file.

**Three of the nine findings were a document claiming a guarantee the code did not give** — the
same class that produced two of 2c-1a's eight. The third occurrence was D13's own first version,
asserting that TypeScript forced what only a `<textarea>`'s behaviour happened to make true. D13 is
now written in three named categories: what the type system enforces, what the run-time guards
enforce, and **what merely happens to be true of the current component path** — that last written as
no guarantee at all.

---

## Decisions (and why — this is what a fresh session cannot re-derive)

### D1 — the real espanso config is never committed

The GitHub repo `ccarpiog/espansoConfig` is **public**, and the owner's live config contains
personal email templates. The product owner chose: **real files stay out of git.**

- Committed fixtures are **synthetic only**, with neutral content.
- [`scripts/sync-real-corpus.sh`](scripts/sync-real-corpus.sh) copies the live config into
  `crates/espansoconfig-core/tests/corpus/real/`, which is **gitignored**
  (`.gitignore:107`).
- [`tests/real_corpus.rs`](crates/espansoconfig-core/tests/real_corpus.rs) **skips cleanly** when
  that directory is absent, so a fresh clone and any CI still pass.

This supersedes plan §11's "checked into the repo" wording for the real-file tier. Do not
re-litigate it, and **never** paste real config content into a committed file, a doc, or a
report.

### D2 — parser substrate is `saphyr-parser` 0.0.11 plus two adapters we own

`saphyr-parser` is the only one of the three candidates that reports where a node **ends**, and
span surgery is impossible without that.

**Corrected twice.** The first write-up claimed end offsets were "exact, every style"; the Phase 0a
review narrowed that to **flow** scalars — 727 in the synthetic corpus then, 877 today, and 980 in the
13 real files reproduce their source token byte for byte, **zero mismatches**, which is what the suite
asserts rather than the count — and **false for block scalars**.

**Phase 0c-2b narrowed it again, to *plain* scalars only.** The flow figure was a statement about
the corpus, not about the substrate. A **quoted** scalar's reported end is also the next token on
its line, so it swallows trailing spaces and a following comment: `a: 'x' # c` reports `'x' # c`,
and `a: ["x" , "y"]` reports `"x" `. A *plain* scalar's end really is exact (`a: x  # c` reports
`x`), which is why nothing noticed — **no corpus fixture puts a comment or a trailing space after a
quoted scalar**, so all 1 892 quoted scalars the two corpora held at the time happened to end their line at their
closing quote. See the 0c-2b disposition for how it was found and fixed.

A `|`/`>` span's end is the position of the next non-whitespace character, so it
swallows trailing blank lines and the next line's indentation: 30 of the 31 block scalars the
synthetic corpus held when this was measured overshot, and **85 of 87 in the real corpus** do. The
old test hid this by
asserting `ScalarStyle::Literal | ScalarStyle::Folded => true` while still counting those
scalars toward the headline figure.

The block-scalar end is still *usable*: it is reconstructible from the reported span, the
`Marker::col()` indentation and the header's chomping indicator, and every corpus block scalar
re-decodes byte-for-byte from those three inputs. The figures the suite pins today are **47 synthetic
block scalars, 44 of them overshooting**; the three that do not are the ones with no following token —
`block-scalar-header-tails.yml`'s `>2` at end of file, `block-scalar-terminal-spaces.yml`'s block that
ends the file, and `multi-document.yml`'s. The growth from 31 is fixtures added by later phases.

Rejected: `yaml-rust2` 0.11 (start `Marker` only, no end) and `marked-yaml` 0.8 (scalar `end()`
is always `None`; also drags in an older `yaml-rust2` 0.10 and rejects anchors outright).

The parser is **not** sufficient alone. Two adapters are ours:

1. **`CharToByte` table.** All three crates report offsets counted in **Unicode scalar values**
   (exactly Rust's `char`) — not bytes, not UTF-16 code units, not grapheme clusters, and despite
   saphyr's own getter documentation claiming bytes. `unicode-offsets.yml` separates all four
   schemes and the test asserts the three rivals are *wrong*. 29 of 33 spans in the non-ASCII
   fixture truncate if the value is trusted as a byte index. Silent-corruption trap, pinned.
2. **Gap scanner.** Comments, blank lines, block-scalar header text, chomping indicators and
   anchor names are exposed by *no* parser — but all of them fall in the gaps *between* reported
   spans. So the scanner is a **gap lexer, not a YAML lexer**: it never decides what a scalar is,
   because the parser already said. This confirms plan §6.2's anticipated outcome while making
   the scanner's job much smaller than feared.

### D2c — one content-start convention for every block scalar

Closed out from the Phase 0b-1 review
([`docs/reviews/phase-0b-1-span-layer.md`](docs/reviews/phase-0b-1-span-layer.md)),
whose top-ranked failure mode was that the span layer used **two** conventions: an
ordinary block started at the first content *character*, leaving that line's indentation
in the gap, while a block opening with empty lines started just past the header's break.
A uniform emitter cannot serve both and would under- or double-indent the first line,
changing YAML structure rather than a value.

**The content span now always begins immediately after the line break that terminates the
header line**, so it carries every body line's indentation, the first included. Decoding is
uniformly "strip `indent` columns from each line", replacement is uniformly "write whole,
`indent`-indented lines", and a block opening with blank lines needs no special case. The
rule is documented on `ScalarPresentation::content_span` and enforced across all three
shapes — ordinary, leading-blank, truncated header (R5) — by
`every_block_shape_uses_the_same_content_start_convention` in `tests/syntax_index.rs`.

Two consequences worth recording:

- A block scalar's reported *end* is no longer the only overshoot: the reported **start**
  is one line's indentation too late for every ordinary block, which
  `docs/parser-evaluation.md`'s "block-scalar start — exact, at the content indent column"
  overstated.
- Corpus-wide blank-line recovery from the gaps dropped from 667 to 636 over the original
  19 fixtures — exactly the 31 block scalars in them. Each one used to leave its first
  line's indentation in the preceding gap, where a per-gap line scan counted that fragment
  as a blank line it never was. The figure is real recovery now, not an artefact.

### D2b — the gap frontier is **trimmed leaf spans**

Measured, not assumed: saphyr's spans **do not nest**. Block collection markers are zero width,
flow ones cover exactly one bracket, document markers exactly `---`/`...`; no non-leaf span
encloses a leaf span anywhere in the corpus. So the review's predicted failure — a comment lost
inside a mapping span — does not occur, and complement-of-all-spans loses no comment today.

It is still the wrong definition. **The frontier is `Scalar` and `Alias` spans only, with every
block-scalar end trimmed to its true content end.** Reasons, both measured:

- Untrimmed, the frontier loses 36 blank lines corpus-wide (631 vs 667) inside block-scalar
  spans — trivia by YAML's own chomping rules.
- Leaf-only rather than all-spans because it stays correct if a future saphyr release gives
  collections real enclosing extents, which is exactly the change the review anticipated.

### D2d — trivia ownership: one deterministic answer per construct

Phase 0b-2 completes Phase 0b. The gaps are no longer opaque: `crate::syntax::trivia`
classifies every gap byte into a typed `TriviaItem`, and `crate::syntax::ownership` attributes
it. **Every byte of a document now belongs to exactly one frontier leaf or exactly one trivia
item** — the Phase 0b-1 reconstruction property, which any ordered disjoint frontier satisfied
trivially, is now a tiling property that cannot hold by accident.

The scanner stays a **gap lexer, not a YAML lexer** (D2). It re-lexes nothing Phase 0b-1 already
decided: block-scalar header spans come from `block::layout` and `---`/`...` spans from the
document nodes, because a second opinion could disagree with the one the trimmed spans were
derived from.

Two primitives decide every attribution, and they are deliberately asymmetric:

- **the deepest node ending at or before a position, on the same line** — what an inline comment
  trails and what a `:` terminates. Deepest, so `trigger: :a # why` attaches to the value rather
  than to the mapping and sequence item that end in the same place. **Zero-width nodes are
  excluded**: they own no bytes, and in `empty: # why` the substrate reports the empty value at
  the byte *before* the colon, so using it would put a trailing comment on the wrong side of the
  punctuation it trails.
- **the outermost node starting at or after a position**, then descended into its first child
  while that child still starts after the position — what a leading comment introduces and what a
  `-`, `?`, `&` or `!` decorates. Outermost-then-descend, because a block sequence's span starts
  at its first item's dash, so the raw answer is the sequence and the wanted answer is the item.

Each of the four plan §6.2 rules is individually observable through `CommentAttachment::rule`,
so each has its own test. The implementation is **not** a literal transcription of §6.2, and
two of the differences are deliberate extensions rather than oversights. Both are recorded here
because a reader comparing plan to code will otherwise find them and distrust one of the two:

- **Rule 3 says "mapping entry"; there is no mapping-entry node.** The index has separate
  `MappingKey` and `MappingValue` children, so an inline comment attaches to the nearest
  non-zero-width node instead — normally the value scalar, and the key when the value is empty
  or written on later lines. Two logically identical entries therefore get different owners
  depending on presentation. That is why the envelope queries below exist: a consumer that means
  "the whole entry" asks for the subtree and gets the whole entry regardless.
- **Rule 1 says "sequence item"; the code accepts any following node.** Any non-header,
  non-blank-separated leading block goes to whatever node follows it, a second top-level mapping
  key included. Restricting it to sequence items would leave those comments owned by nobody,
  which is worse: they would not travel when their key does.

**The rules can overlap, and a fixed precedence resolves them.** A header followed by a blank
line satisfies both rule 4 and rule 2; a header immediately above a root sequence item satisfies
both rule 4 and rule 1. Exactly one rule is ever emitted, decided by
**flow-interior → inline → file-header → blank-line-separated → leading block**, with a trailing
comment falling through to the file. The order is chosen so the safest answer wins every
overlap: the file keeps anything a reorder could otherwise carry away.

The ambiguous cases the 0b-1 review raised now have documented, pinned policies:

| Construct | Policy |
|---|---|
| `empty:` + inline comment (review §3) | Both the `:` and the comment belong to the **key**; the zero-width value is never an owner. No hazard. |
| Bare `- ` item | The `-` belongs to the **item the dash introduces** — the zero-width scalar when the item is empty. An inline comment on that line, having no node before it, attaches forwards to the same item. |
| Compact `- key: value` | The `-` belongs to the **item mapping**, never to its first key, so a reorder moves the dash with the item. |
| Explicit `? key` / `: value` (R7) | `?` owns the key it introduces, a line-leading `:` owns the value; the enclosing mapping raises `HazardKind::ExplicitKeyMapping`. |
| Comment inside a flow collection (R6) | It belongs to the **innermost enclosing flow collection**, which raises `HazardKind::CommentInFlowCollection` and is then refused **outright, whole-collection replacement included**. An earlier draft of this file called that replacement legal while `is_safely_editable` refused it; the gate is the answer of record, because it is the one that cannot lose a comment, and because the gate has no way to express "safe to replace, unsafe to reorder". |

**Direct ownership is a diagnostic; subtree ownership is the envelope.** Trivia is attributed to
the deepest node a rule can name, so a sequence item almost never owns the trivia that visually
belongs to it: the inline comment after its last value is owned by that *value*, the colon after
each key by that *key*. `items_owned_by` / `comments_owned_by` answer "what does this exact node
own", and building a move or delete envelope from them **strands the final inline comment on the
snippet below**. `items_owned_by_subtree` / `comments_owned_by_subtree` are the envelope queries
and the default for Phase 0c; `file_comments()` is what must stay put.

`HazardKind` is the "refuse rather than guess" channel, and it covers every construct plan §7
(rows 6–8, 13) and §13 say must not be edited visually: `CommentInFlowCollection`,
`ExplicitKeyMapping`, `TruncatedBlockScalarHeader` (R5), `UnclassifiedTrivia`,
`AnchorDefinition`, `AliasReference`, `MergeKey` (R8), `DuplicateMappingKey`, `ExplicitTag` and
`MultiDocumentStream`. `TriviaIndex::is_safely_editable` answers pessimistically — a hazard on
the node, on any ancestor or on any descendant disqualifies it, and a hazard with **no** node
(bytes we could not name, lying outside every node) disqualifies the **entire document** —
because refusing a safe edit costs one fallback to the raw YAML editor while accepting an unsafe
one costs the user their file.

**Measured, and pinned exactly for the synthetic corpus:** 3 072 trivia items, 250 comments,
108 blank lines in 104 runs, **18 hazards**, and **0 unclassified spans**. (2 687 / 197 / 94 / 90
when 0b-2 closed; every later delta is one added fixture's own shape, tabulated in that phase's notes
doc, and **the hazard count has never moved** — not one fixture added since raises one.) The hazard
figure was 1
before the 0b-2 review fix round, which was precisely the reviewer's evidence that the gate was
not pessimistic; the 18 are pinned *per family* as well as in aggregate — 3 `AnchorDefinition`,
5 `AliasReference`, 2 `MergeKey`, 2 `ExplicitTag` (all from `anchors-aliases-tags-merge.yml`),
2 `DuplicateMappingKey` (`duplicate-keys.yml`), 3 `MultiDocumentStream` (`multi-document.yml`)
and 1 `CommentInFlowCollection` (`flow-collections.yml`) — so two opposing drifts cannot cancel
inside the total. The 13 real files also produce **0 unclassified spans**; no count from private
data is hard-coded. A truncation sweep over 3 000+ prefixes of three fixtures tiles every prefix
that parses, with 0 unclassified spans.

**Reconstruction is not a semantic oracle, and is no longer the only assertion.** Tiling proves
contiguity and byte-for-byte rebuild, all of which a comment mislabelled as a tag survives
unharmed. Two further layers now sit on top: exact `(span, kind)` goldens for every documented
token spelling, verbatim tags included, and exact `(span, owner, rule)` goldens for ownership;
plus two corpus-wide oracles that re-derive every item's kind and every comment's owner
relationship from the source text independently of the scanner, over **both** corpora.

Two count conventions now coexist and both are pinned, deliberately:
`tests/syntax_index.rs` keeps its per-gap line scan (245 comments, 773 blank lines) as the 0b-1
tripwire on the block-scalar trim; `tests/trivia_scanner.rs` pins the scanner's token-accurate
figures (250 comments, 108 blank lines). The comment difference is five inline comments that share
a line with something else — two with structural punctuation (`matches: # …`), two added by
Phase 0c-2b with a block-scalar header (`replace: | # …`) and one added by Phase 0c-3a with an empty
entry (`label: # …`) — none of which a whole-line scan can
see. Every fixture added since is a cross-check on both conventions at once: it must move the two
counts by amounts that differ by exactly its own inline comments, which is 0 for
`file-comments-and-mixed-endings.yml`, for `run-based-removal-envelope.yml` and for
`run-based-removal-boundaries.yml`. The blank-line
difference is that the line scan counts every gap line that trims to nothing, including the break
that merely *terminates* a content line; the scanner calls that a `LineBreak` and reserves
`BlankLine` for a line that lies wholly inside a gap and holds nothing.

### D2e — the codec is honest or it refuses; it is never silently approximate

Phase 0c-1. The whole crate rests on "everything outside the intended span comes out
byte-identical", so a codec that *usually* reproduces its input is worthless: the failure is
invisible at the call site and lands in the user's file. `reencode_in_place` therefore has exactly
two outcomes — byte-identical, or a typed `NotReencodable` naming the presentation that cannot be
reproduced. The refusal variants are `FoldedStyle`, `FoldedFlowScalar`, `NonCanonicalEscaping`,
`NonCanonicalBlankLine`, `MixedLineBreaks`, `BareCarriageReturn`, `SynthesisedFinalBreak` and
`Undecodable`.

Decisions inside that contract, each pinned by a test:

- **`>` is decode-only.** Folding turns line breaks into spaces, so re-emitting a folded scalar
  means choosing where to fold, and every choice rewrites bytes the user did not edit. Editing a
  multi-line folded scalar rewrites it as `|`. **A single-line replacement falls through to plain
  or single-quoted instead** — the policy is not "folded always becomes literal", and the doc
  comment says so, because the first draft claimed the stronger thing and it was false.
- **A single-line value keeps an existing block scalar.** The user chose that presentation and a
  one-line `|` is idiomatic in espanso; collapsing it to plain would be exactly the unrequested
  reformatting this crate exists to avoid.
- **Prefer single quotes, and quote `,` `[` `]` `{` `}` `\` even in block context.** This is what
  makes a regex trigger come out single-quoted with its backslashes intact.
- **The plain-safety predicate is generous on purpose.** It rejects every YAML 1.1 boolean and
  null spelling (`y`, `n`, `on`, `off`, …), sexagesimals like `12:30`, timestamps, and anything
  that merely *starts* like a number. Espanso's stack is YAML 1.1-ish, and a bare `no` silently
  becoming `false` is the exact corruption this crate exists to prevent. Over-quoting costs two
  apostrophes; under-quoting costs the user their value.
- **`ScalarPlan` holds logical values, not pre-escaped text** — a deliberate deviation from the
  plan §6.3 code sketch, which escaped at construction. Escaping once, in `render_content()`,
  makes double-escaping structurally impossible.
- **`ScalarContext` carries `parent_indent` and a `ScalarRole`.** The indentation indicator is
  relative to the parent node, and a mapping **key** can never be a block scalar.

### D2f — an unrepresentable body column moves the body; it does not clamp the indicator

The Phase 0c-1 review's top finding. YAML's indentation indicator is a single digit `1..=9`, so a
block body more than nine columns past its parent cannot describe itself. The first implementation
clamped the indicator to `9` and still indented the body to the requested column — which does not
fail loudly, it **silently moves the surplus columns into the value**: `" x\n"` at relative indent
10 reparsed as `"  x\n"`.

The fix picks the body column and the indicator **together** (`representable_body_indent`), and
when an indicator is genuinely needed it puts the body at `parent + 9` rather than clamping. The
invariant `indent == parent_indent + indicator` is asserted over a 6×14 sweep.

This is a deliberate divergence from the reviewer, who offered "a different representation **or** a
typed refusal". Re-indentation is chosen because the value survives **byte for byte** and only its
column differs from what the caller asked for — making `choose_scalar` fallible for a case with an
exact lossless answer would push a refusal onto every caller for no gain. `LiteralBlockPlan::indent`
still reports the column actually used, so a caller that cares can see it. Note the same bug
existed independently in `preserved_block`, which copied the source's *relative* indicator digit
onto an *absolute* column; the wider test set is what exposed it.

### D2g — the block-scalar span layer was wrong about the final line, and was fixed, not waived

Also from the 0c-1 review. `block::content_len` decided whether a terminal run of spaces at
end-of-source was scalar content or the next token's indentation **without knowing the block's
indentation column**, so a whitespace-only *final* line was always dropped:
`key: |2-\n   \n   ` decoded to `" "` where the substrate said `" \n "`. The projection was
missing logical data, which is worse than a formatting difference — a value displayed from it and
then saved cannot write back what it never had.

`block::layout` and `content_len` now take the indentation column, threaded from the start
marker's column in `index.rs`, and apply the substrate's own rule: **a whitespace-only final line
at EOF is content exactly when it is wider than `indent`.** The round-trip test's
`known_shortfalls` waiver is **deleted** — a green suite must not depend on an exemption for real
data loss — and the old "known shortfall" test is inverted into one that asserts correct decoding,
plus eight neighbouring shapes.

No committed corpus count moved **at the time**, because no synthetic fixture has a whitespace-only
final line inside a block at EOF: the Phase 0b figures were untouched by this fix. They have since
moved, but only because Phase 0c-2b's fix round added a fixture — see that phase's disposition, not
this one.

### D2h — the destination parser is YAML 1.1, so saphyr agreeing is not sufficient

The round-trip oracle reparses with saphyr, which is YAML 1.2. Espanso's own stack is 1.1-ish, and
three character classes diverge:

- **U+2028 / U+2029** are line separators in YAML 1.1 but ordinary characters in 1.2, and Rust's
  `char::is_control()` is **false** for both (they are categories Zl/Zp). They were passing the
  plain predicate and being emitted raw. They now force double quotes and are emitted as the
  `\L` / `\P` escapes the decoder already understood — encoder and decoder are exact inverses.
- **Unicode noncharacters** (U+FDD0–U+FDEF and `U+xFFFE`/`U+xFFFF` in every plane) are also not
  `is_control()`. Measured first rather than assumed: saphyr accepts them raw *and* escaped, so
  escaping is lossless and was chosen over refusing. They are emitted as `\uNNNN`/`\UNNNNNNNN`.
- **A bare `\r`** inside a block body has no `LineEnding` variant to represent it, so re-encoding
  would rewrite it as LF. It is now refused (`BareCarriageReturn`) instead of silently normalised.

The general lesson, worth keeping for 0c-2: **an oracle that only asks the parser we build on
cannot prove compatibility with the parser that consumes the file.**

### D2i — the block header's indicator order is recorded, not normalised

YAML permits both `|2+` and `|+2`. `ScalarPresentation` recorded the indentation and chomping
meanings but not their **source order**, so a `|+2` header re-encoded to `|2+` and still returned
`Ok` — a byte difference with nothing lossy about it. `HeaderIndicatorOrder` now travels on
`BlockHeader`, `ScalarPresentation` and `LiteralBlockPlan`, and `render_header` reproduces the
order it was given. Recording beats refusing here: the file stays byte-identical, which is the
product's whole premise.

### D2j — the path is document-scoped, refuses ambiguity, and knows nothing about hazards

Phase 0c-2a. Five decisions, each pinned by a test:

- **Document-scoped, not stream-scoped.** A path carries a zero-based document index. Espanso
  loads only the first document, but a file may hold several, and a path that could not say which
  one it meant would silently address the wrong half of the file. The textual form spells a
  non-zero document `#N`; document 0 omits the prefix, except for the root path, which renders
  `#0` so that it is not the empty string.
- **A key segment matches the *decoded* value of the mapping key.** `replace:`, `'replace':` and
  `"replace":` are one segment, so a style change to a key cannot silently break every path
  through it. A key that is not a scalar at all — an alias, or a collection used as a key — never
  matches, and `path_to` refuses it with `NonScalarKey` rather than approximating it from source
  text. This is R13 seen from the resolver's side.
- **A duplicate key refuses in both directions**, and this is the resolver's *only* concession to
  semantics. A duplicate does not make a node unsafe to edit, it makes the path **meaningless**:
  `matches[0].replace` names two nodes in `duplicate-keys.yml`. Ambiguity propagates to
  descendants — the reported key is the duplicated ancestor's, not the descendant's — because
  otherwise `resolve(path_to(n)) == n` would hold only where duplicates happen not to occur.
- **The hazard gate is deliberately not consulted here.** The resolver answers "which node does
  this path name"; `is_safely_editable` answers "may it be edited". Keeping them apart is what
  lets the resolver stay a total function of the text while the gate stays free to be pessimistic.
  The reviewer's condition on this, adopted: **the mutation entry point in 0c-2b must own the gate
  check internally.** Making safety a caller convention would be unacceptable.
- **The textual form is exact, not legible.** A YAML key may hold a NUL or a line break, and
  `Display` emits it verbatim so `FromStr` returns it unchanged. Escaping inside the format was
  rejected: it would buy log-legibility by inserting an unescaping step into the middle of the
  round trip the type exists to guarantee. Callers that need a log-safe rendering use
  `str::escape_debug`.

Nodes inside **flow** collections are addressed exactly like block ones (`vars[0].name`). See R17
for what that costs 0c-2b.

### D2k — R17 is closed by guaranteeing flow-legal bytes, not by refusing flow interiors

Phase 0c-2b's headline decision. R17 was open because the hazard gate does **not** refuse a flow
collection — only `CommentInFlowCollection` exists — while a block scalar is illegal inside
`{…}`/`[…]`, so an edit that turned a short value into a multi-line one would emit invalid YAML.
R17 named two acceptable answers; **option (b) was chosen: thread flow context into rendering.**

`scalar_context()` marks the target `ScalarContextKind::Flow` whenever **any** enclosing collection
is bracket-delimited, and the Phase 0c-1 emitter already refuses to put a block *or* a plain scalar
into flow context (`choose_scalar`'s `!context.is_flow()` guard and
`ScalarContext::can_hold_a_block_scalar`). A multi-line value inside a flow collection therefore
becomes a **double-quoted scalar with `\n` escapes** — one physical line, brackets undisturbed.

Why not refuse:

- **Refusing costs a real espanso config something; this costs it nothing.** `triggers: [":a", ":b"]`
  and inline `vars: [{name: …, type: …}]` are idiomatic espanso, and `flow-collections.yml` alone
  holds 11 editable flow-interior scalars. Refusing would mean the visual editor cannot change a
  trigger list.
- **Refusing is not the cheaper implementation.** Detecting flow context is the same walk either
  way, so (a) is (b) minus the two lines that pass the context on. The safety (a) would buy is
  already provided by construction.
- **Byte fidelity is unaffected.** Only the scalar's own token changes; the commas, brackets and
  spacing around it lie outside every replaced span.

The one cost, documented on the entry point: a **plain** scalar inside a flow collection is requoted
on edit (`vars: [one, two]` → `vars: [one, 'three']`), because a plain scalar in flow context is
terminated by `,`, `]` and `}` and the emitter never writes one there. Two apostrophes inside the
edited token, nothing outside it. Pinned in **both** directions — the same multi-line value becomes
`"one\ntwo\n"` in flow context and a `|` block in block context — and a flow collection that *does*
carry a comment is still refused outright.

### D2l — a block scalar's trailing line breaks keep their layout; the indicator reinterprets them

A block scalar's trailing line breaks are shared property: the chomping indicator decides how many
of the breaks *physically present* after the last content line belong to the value, and the rest are
blank-line trivia the edit must leave alone. `breaks_to_emit()` therefore emits **exactly as many
trailing breaks as the replaced region already held**, so the document's line structure is unchanged
and only the header's indicator changes meaning:

| Source | New value | Result |
|---|---|---|
| `k: \|` + `  a` | `a` | `k: \|-` + `  a` — the terminating break stays put |
| `k: \|-` + `  a` | `a\n` | `k: \|` + `  a` — the break already there serves |
| `k: \|+` + `  a` + 2 blanks | `a\n` | `k: \|` + `  a` + 2 blanks — they become trivia |

Two adjustments, each forced rather than chosen:

- clip and strip need the last body line **terminated**, so when neither the region nor the source
  after it holds a break, one is written — except at end of file, where a strip block legitimately
  ends a file with no final newline (`no-trailing-newline.yml`).
- **keep chomping counts every physical break**, so it is the one indicator that cannot leave a
  trailing break as trivia. There the count is exact, and when the document already holds more
  breaks than the value wants the edit is **refused** (`TrailingNewlinesNotRepresentable`) rather
  than made to absorb blank lines silently.

### D2m — the gate is structural, and a presentation change is reported rather than refused

Two decisions about where safety lives.

**The gate cannot be bypassed, by construction rather than by convention.** The 0c-2a reviewer's
condition was that the mutation entry point must own the check internally (D2j). It is met by the
signature: `apply_scalar_edits` takes the source *text*, so a caller cannot hand it a `TriviaIndex`
that describes a different document, and `plan_one` asks `disqualifying_hazard` **before** it renders
anything. `resolve` is untouched and still knows nothing about hazards. One additive Phase 0b change
supports this: `TriviaIndex::disqualifying_hazard()` returns *which* hazard disqualifies a node and
`is_safely_editable` is now "that returned `None`", so the answer and the reason cannot drift apart
and the mutation layer can refuse by name.

**A spelling change is a `PresentationNote`, not an error.** `PROGRESS.md` previously instructed that
"a scalar that `reencode_in_place` refuses must not be silently rewritten". The operative word is
*silently*: a `>` block rewritten as `|`, a double-quoted scalar re-escaped canonically, or a plain
scalar requoted are all cases where the value is preserved exactly and only its presentation moves.
`PresentationNote` carries `from`, `to` and the `NotReencodable` reason to the caller, which
discharges plan §6.2's "never silently normalise" without blocking an edit that `preserve_scalar`
documents as intended behaviour. Refusing instead would make a folded scalar permanently
uneditable.

### D2n — the collection end marker is unusable, so the published span stays child-derived

Phase 0c-3a, closing **R3**. The substrate's own end marker for a block collection was measured over
both corpora before any rule was adopted: it **overshot in 223 of the 235 synthetic block collections
then in the corpus and in 228 of 240 real ones**, never undershoots, and lands at EOF, on an unrelated
node, or in the middle of trivia
(111 / 42 / 298). Unlike a block scalar's end — which D2 records as *reconstructible* from three known
inputs — a collection's is neither usable nor reconstructible. (The synthetic figure the suite pins
today is **246 of 273**, the difference being fixtures added since; the verdict is unchanged.)

So the published span **deliberately does not change**. Extending it to the measured end would move a
key's `:` and its inline comment into the mapping, breaking the D2d ownership the whole trivia layer
rests on. Instead `CollectionExtent::owned_end()` is a **second, fallible** derivation, cross-checked
against `TriviaIndex::subtree_extent` on every block collection of both corpora, with
`unaccountable_collection_extents()` as the counted observable pinned at zero and
`overshooting_block_collections()` as the R3 observable — the exact counterpart of
`trimmed_block_scalars()`, and restricted to the block styles for the same reason R20 gives.

`owned_end()` returns `Option<usize>`, `None` exactly when the derivation is `Unaccountable`, and the
field is private. That is the review's finding 4: a value known to be wrong must not be publishable as
an ordinary `usize` that a future consumer can read without confronting it. It is the same discipline
`quoted_span` got from 0c-2b's finding E5.

### D2o — the removal envelope is an ordered set of owned **runs**, because a hull is not a set

The Phase 0c-3a review's finding 1, and the phase's most important admission — **completed in
0c-3b-1**, which is where the second half of this entry begins. In 0c-3a a removal envelope was one
contiguous `ByteSpan`, so it necessarily covered everything between the entry's first and last byte —
including trivia that **no node in the entry owns**. The concrete case the reviewer built:

```yaml
a:
  x: 1
  # keep this file comment

  y: 2
b: 3
```

By D2d that comment is separated from `y` by a blank line, so it belongs to the **file** and must
survive any edit. Removing `a` deleted it, and all four layers certified the result: `subtree_extent`'s
hull already crossed it, `StructuralGuard` examined no trivia, the sibling digest compares decoded
nodes and holds no comments, and the external oracle had the same blind spot. This is the structural
form of 0c-2b's E1/E3 — a synthesized envelope, authorised by the very declaration that should have
been checked against it.

**A single contiguous span cannot express "remove the collection but keep this interior file comment."**
0c-3a's answer was to **refuse** such a removal (`EditError::RemovalWouldDeleteAFileComment`) rather than
perform it minus the comment, and to record the cost as **R21**: a removal that ought to be legal is
refused. One synthetic removal hit it; zero real ones did.

The refusal alone was explicitly judged insufficient, because it leaves the *class* invisible.
`VerificationFailure::FileCommentLost` derives the loss from `file_comments()` rather than from the
edit, and the test oracle compares file-owned comments before and after using a comment scan written
independently of `TriviaIndex`. All three layers were confirmed to catch it **independently**, by
disabling each in turn — and re-confirmed the same way in 0c-3b-1, whose notes doc §6 records the four
runs of that experiment and the exact message each layer produced.

**Phase 0c-3b-1 — the set.** The envelope is now the ordered, disjoint set of runs left when every whole
line a file-owned comment occupies, and every blank run touching one of those lines, is punched out of
the hull. `blank_runs()` is used rather than a textual "all spaces" test because it is a gap-only answer
and so can never preserve a fragment of a block scalar's body. The reviewer's example now yields
`  # keep this file comment\n\nb: 3\n`, pinned byte-exactly.

**The blank-run rule, both directions** — implicit and overstated until the 0c-3b-1 review's finding 1
made it explicit. *A blank run survives exactly when it touches the line of a file-owned comment the
removal preserves; every other blank run inside the hull goes with the entry.* The run **below** a kept
comment is ownership: rule 2 reads it, so deleting it re-attributes the comment. The run **above** is
adjacency — deleting it would leave the comment file-owned all the same — and survives because the unit
preserved is the neighbourhood `blank_runs()` groups with the comment's line, which the gap layer does
not arbitrate side by side. **The phrase "a blank line is the file's layout rather than the entry's
trivia" is withdrawn from this entry**: it would apply equally to a blank run touching no comment, and
such a run is deleted. What is declined, and why, is in `0c-3b-1-notes.md` §8.1 — an interior blank run
lies *inside* the span the user asked to remove, and preserving it would invent a leading blank line at
document start that the file never held.

Four things about that are worth keeping:

- **The invariant got stronger.** A hull covered the whole entry by construction; a set does not, and
  the empty set satisfies "touches nothing outside the entry" perfectly. `StructuralGuard::Removal`
  now asserts both directions, the second through
  `VerificationFailure::EnvelopeMissesTheEntry` over the entry's frontier leaves. Nothing was weakened
  to accommodate runs. **What the two halves prove is the entry's *nodes*** — every frontier leaf, no
  foreign node — and **not** its trivia, because both are stated over node spans. The claim that
  together they say "the run set is exactly the entry" is withdrawn (review, finding 1).
- **`RemovalWouldDeleteAFileComment` survives as an assertion, not a policy.** It is now checked against
  the *derived runs*, using `file_comments()` rather than the punch-out's arithmetic, and is argued
  unreachable and pinned at 0 — with experiment 1 of §6 showing it firing, which is more than R22's
  pinned zero can offer.
- **Punching the comments out is not sufficient, and neither this entry nor the review said so.** A
  comment left directly under a block scalar's content, **at that block's body column or deeper**,
  becomes content of the block. Refused by name, `EditError::RemovalWouldExtendABlockScalar`, with a
  fixture written for it because neither corpus held the shape — and a **second** fixture written when
  the review's finding 2 showed the refusal ignored columns and so refused a column-zero comment under
  a folded block, which cannot be absorbed at all (R23).
- **The sweep's own statement of the rule was not an oracle, and now is.** "Every gap holds a file-owned
  comment" could not see the ownership blank line being deleted, and rejected any change to the rule
  mechanically. It is a two-way partition against `preserved_by_the_rule` since the review's fix round,
  with the blindness demonstrated rather than asserted (`0c-3b-1-notes.md` §6, experiments 5 and 5b).

**What R21's closure was worth, measured:** one synthetic removal and zero real ones — exactly the cost
the refusal was measured to have. Its real value is that **there is no version of the move that is
correct on a hull**: a hull would carry the file's comment to the destination, which is worse than
deleting it.

### D2p — a line ending is copied from the most local evidence, never voted on

The review's finding 2, and a defect the fix round then found live in the **scalar** path too, which
the reviewer had not named. `LineEnding::detect` answers LF for a single-line document **by defaulting,
not by measuring**, and both edit paths were writing that document-wide answer. Two failures follow: a
file with no final newline gets an invented LF, and in a mixed document an insertion after a
CRLF-terminated sibling writes LF whenever LF is globally dominant.

The rule is now: **copy the break already in use where the bytes land** — the anchor's own terminated
line for an insertion, the scalar's own line terminator for a scalar edit — and when the document
supplies no break at all, **refuse by name** (`NoObservableLineEnding`) rather than guess. Choosing a
line ending the file never contained is precisely the silent reformatting this crate exists to prevent,
and a document-wide majority is a guess dressed as evidence.

The scalar half is worth recording separately from the insertion half because of **how it was found**:
the two fixtures written to prove the insertion fix walked straight into it, and it had been passing
every sweep for two phases. Fourth time in this project that the corpus, not the code, was the weak
link (R20), and the second time in two rounds that a fixture written for one defect uncovered another.

**0c-3b-2a extended D2p to the move, and its review had to enforce it against the first attempt.** A move
carries its own line breaks verbatim, so nothing is copied and nothing is voted on. The one case that
needs a break it does not have is a destination at the **end of an unterminated file**: the first
implementation *rotated* the moved item's own trailing break from behind the carried bytes to in front of
them. Byte conservation was exact and all the whole-document properties certified it — but the
previously-unterminated destination line thereby acquired a terminator it never had, possibly a CRLF
imposed on an LF file, and **global conservation cannot see which unedited line owned a break**. The notes
argued this satisfied D2p *a fortiori*; that argument was wrong and is withdrawn. The case is now
**refused by name**, `MoveWouldTerminateTheFinalLine`, at a measured cost of 3 synthetic moves and 0 real
ones. `NoObservableLineEnding` is unreachable from a move: a sequence with two items holds at least one
break, and a sequence with one item offers no move.

### D2q — a relocation needs five properties, and byte identity is not one of them

Phase 0c-3b-2a. Every invariant proven up to 0c-3a rested on *nothing moved*: insert and remove change a
mapping's membership, but every byte they do not delete stays at its offset. A move breaks that, so
"every byte outside the replaced spans is identical" stops being **sufficient** — it is still asserted,
but it now only says the splice did what it declared, not that the declaration was right.

The replacement, all five inside `verify()` and each a typed failure:

1. **`document_lines_are_conserved`** — the candidate's lines are the source's, as **paired** multisets of
   content and terminator.
2. **`items_are_in_the_intended_order`** — the sequence is the original permuted exactly as requested.
3. **`constructs_outside_the_move_are_unchanged`** — a lockstep tree walk: everything the edit did not
   name decodes to what it decoded before. This is 0c-3a's sibling digest promoted from local to global.
4. **`the_arrival_is_the_departure`** — the inserted bytes are **exactly** the removed bytes.
5. **`comment_ownership_survives`** — no comment changes owner.

**Why 4 and 5 exist is the important half, and it came from the review.** Properties 1–3 were the phase's
original answer, and they can **jointly certify a corrupted document**. Multiset conservation is
permutation-invariant *by construction*; the digests omit comments; the tree walk sees decoded values and
is blind to presentation. So a planner that swapped two carried comment lines, exchanged LF and CRLF among
carried lines, shuffled a blank line between two strip-chomped blocks, or deleted a comment's ownership
blank line while relocating that line elsewhere, passed all three — and
`bytes_outside_the_replacements_match` authorises the insertion text **the planner itself supplied**.

Property 4's expected bytes are therefore read out of the **original document**, at runs bounded
independently of the planner: by `StructuralGuard::Removal` from both sides, and by the item's own
physical lines derived textually from the source. The insertion string is never an input to what it is
compared against, or the check would be a restatement. Property 5 exists because **no byte comparison can
see re-attribution** — the bytes are all present and all identical; only their ownership moved.

The general lesson, and it is the one this phase cost the most to learn: **a safety property that lives
only in the test suite is not a safety property.** `PatchedDocument` has no public constructor precisely
so candidate bytes cannot exist without having passed `verify()`; a check kept outside `verify()` makes
that guarantee decorative. The test-side copy is **kept** as a second, independent derivation.

### D2r — "no re-indentation" is a fact about one operation, not about moves

Measured, and it corrects a prediction this file made. `ItemMove` moves an item between positions of the
**same block sequence**, and the valid items of one block sequence necessarily share their structural
indentation — so the carried bytes need no adjustment, and deliberately unusual comment indentation
inside the item is preserved rather than normalised.

The scope of that claim is exactly the implemented operation. **Moving between differently indented or
nested sequences is not expressible by `ItemMove`, and the future operation that does it must re-indent
or refuse — it cannot reuse these proofs unchanged.** R23's column comparison would then genuinely need
the rework 0c-3b-1 predicted; today it does not, because nothing moves across an indentation boundary.

### D2s — R16 is answered by our own tag table, not by a second parser

Phase 0c-3b-2b, decided by consultation with a second model and recorded in
[`docs/reviews/phase-0c-3b-2b-r16-consultation.md`](docs/reviews/phase-0c-3b-2b-r16-consultation.md).
**Do not re-open it by adding a YAML crate.**

**Why not a second parser.** A syntax-level reparse is close to theatre here: bytes outside an edit are
already proven identical, and every scalar the emitter *writes* is conservatively quoted. The real danger
class is **implicit type resolution** — in YAML 1.1 the plain scalars `y`, `n`, `on`, `off` are booleans,
`012` is octal and `12:30` is a sexagesimal, while YAML 1.2 core calls them strings. And **no maintained
crate faithfully implements 1.1 resolution**: libyaml's event parser provides no application-level
resolver, `yaml-rust` 0.4 is unmaintained with an unreliable one, `yaml-rust2` and `saphyr` target 1.2,
and `serde_yaml` is `0.9.34+deprecated` (verified against the registry). Adopting one would be
reassurance, not evidence — **a wrong second oracle is worse than an honest single one.**

**What was built instead.** A hand-written table of the 1.1 productions and the 1.2-core ones, in the
library so the **emitter** consults it, and asserted in `verify()`.

**The property is differential, and that is the design point.** It does **not** require the corpus to hold
zero ambiguous plain scalars — real espanso files legitimately contain `on` and `off`, and a test
demanding their absence would be wrong and would have to be deleted the first time it met a real config.
Instead: pre-existing ambiguity is **reported as data** (31 synthetic, 65 real plain scalars are non-`str`
under 1.1), and an edit that **introduces** a new ambiguous plain scalar or **changes** an existing
classification **fails** with `VerificationFailure::AmbiguousPlainScalarIntroduced`.

**The table is hand-maintained, and the first attempt to prove it was circular.** The generated sweep
compared `plain_scalar_is_ambiguous` against a predicate that itself called `plain_scalar_is_ambiguous`,
so "3 M values, 0 gaps" only measured that the emitter is a conservative superset of **its own table**.
The review caught that. There is now a **second, independently written transcription** of the 1.1 half,
swept differentially over 500 000 generated values (43 773 non-string resolutions, zero disagreements)
plus a 77-case hand table on both sides of every family. Four concrete errors the review named are fixed:
a date-only timestamp now admits one- or two-digit month and day (`2001-1-1`), an oversized sexagesimal
classifies by **shape** rather than returning nothing when `i128` overflows, the 1.2-core integer strips
the sign before the radix prefix (`+0o17`), and the `012` documentation was corrected after the *code* was
verified correct. **The 1.2-core half still has no second implementation** — see R16's row.

### D2t — the removal envelope needed a bound derived independently of itself

Phase 0c-3b-2b's blocking finding, and **R24's second occurrence in two phases**.

A removal whose deletion run swallowed one **following blank line the entry does not own** was accepted by
every production check: no node is crossed, the mapping loses exactly one entry, the sibling digests are
unchanged, nothing decodes differently — and `bytes_outside_the_replacements_match` **positively
authorises** the deleted byte, *because the envelope declared it*. Only the test-side sweep saw it.

That is circular authorisation: the envelope is checked against a permission the envelope itself granted.
`RemovalCarriesMoreThanTheEntry` is the sixth verification property (D2q's five plus this). It derives the
entry's allowed physical-line runs from the **key/value frontier**, the textual leading-trivia rule and
D2o's blank-run rule, and **consults nothing `removal_envelope` produced**. A move's source half keeps its
own two bounds via `EnvelopeKind`, so the earlier experiments still fail under their own names.

**The general rule, now twice-learned:** a bound that reads its own declaration proves nothing.
*"Deleting a user's blank line is not acceptable collateral. The distinction is ownership, not whether the
byte decodes to YAML data."*

### D2u — the UI shows a scalar's **source text**, never an inferred type

**Decided by the product owner at the Phase 0 / Phase 1 boundary. This is a locked decision — do not
re-litigate it, and do not "improve" the browser by adding type-aware rendering.**

R16's open half is that the *projection* of a **pre-existing** plain scalar is not proven to match
espanso's resolver. **31 synthetic and 65 real plain scalars resolve non-`str` under YAML 1.1 today**: a
bare `on`, `off`, `012` or `12:30` is a boolean, an octal or a sexagesimal to espanso, and a string to the
YAML 1.2 substrate we read with. So the moment a UI renders one of those *as a type* — a toggle, a
number field, a boolean chip — it makes a claim this project has not earned, in the one place the user
will trust it most.

**The rule:** the browser displays the scalar's source text as written. It may say what the *file* says;
it may not say what the value *means*. Where a type would be useful, show the source and let the user read
it.

**Why this is the right trade rather than a stopgap.** The cost is cosmetic — a value looks like text
instead of a toggle. The cost of the alternative is a user seeing `enable: on` rendered as a boolean,
trusting it, and being wrong about their own config in a tool whose entire promise is fidelity. That
asymmetry is the same one D2e made for the codec (*"over-quoting costs two apostrophes; under-quoting
costs the user their value"*) and the same one the hazard gate makes (*"refusing a safe edit costs one
fallback; accepting an unsafe one costs the user their file"*). This project resolves that asymmetry the
same way every time, and doing so consistently is most of why its guarantees are believable.

**What would unlock type-aware rendering**, if a later phase wants it: close R16's projection half —
prove the projection agrees with espanso's actual resolver, not merely with our own table. Until then a
type is a guess, however well-informed. **Flagging** a scalar as 1.1-ambiguous is permitted and
encouraged, because that is a statement about *risk*, which we can prove, rather than about *meaning*,
which we cannot.

### D2v — an identity is scoped to the parse that minted it, and a stale one is refused

From the Phase 1a review's finding 1, which was a **real defect and not a theoretical one**. `MatchId`
was `DocumentId` + `NodeId`, and both components are positional under the hood: `NodeId` is the parser's
arena index, assigned in emission order, and `DocumentId` was the file's position in the sorted
enumeration. So exchanging two equally shaped matches and reparsing handed `:a`'s former identity to
`:b` — **identity following position, which plan §6.2 forbids in as many words**. The test that claimed
to cover this was named `…survives_a_reordering` and never reordered anything: it is the third
occurrence of the oracle-that-cannot-disagree failure mode (R24), and the first one a reviewer rather
than the phase itself caught.

**The fix is refusal, not reconstruction.** A content-derived stable identity — matching nodes across a
reparse by their content — was considered and rejected: it is a much larger design, it must decide what
"the same match" means when the user edits the trigger, and Phase 1 does not need it. Instead:

- `MatchId` carries the document's `ContentRevision`, and `match_by_id` returns
  `Result<_, IdentityError>`. An identity from a different parse yields `IdentityError::StaleRevision`
  naming both revisions. It is never resolved to *a* match, and above all never to the wrong one.
- `DocumentId` is allocated from a **monotonic session counter keyed by path**, so reopening a directory
  keeps every existing id, a new file gets a fresh one, and a removed file's id becomes a typed
  unknown-document error rather than aliasing whatever slid into its position.

**What this costs, and who pays it.** Phase 1b and every later phase must handle `StaleRevision` on
every lookup that crosses a `refresh()` — which is the correct shape for a UI holding a selection across
an external file change, and is the same conversation plan §6.5's reconciliation already requires. The
mirror image is pinned too: reprojecting the *same* bytes mints the *same* identity, so the refusal is
about the revision changing and not merely about reparsing.

### D2w — an unmodelled subtree is accounted for by span, and that is a bound rather than a claim

Plan §6.2 says unknown entries are never silently discarded. The first Phase 1a draft recorded an
unrecognised key by name and **did not descend into it**, so `future_option: {nested_key: …}` recorded
`future_option` and left `nested_key` recorded nowhere — while every coverage check passed, because they
iterated the records the projection had chosen to emit. A missing record was therefore invisible: the
audit was vacuous in exactly the way `0c-3b-1`'s property 6 was.

**The claim is now stated so it can be false:** *every key is either modelled, or recorded by name and
path, or lies inside a recorded undescended span.* The third clause is a real bound — the span comes
from a node the index published — and it is checked in the **library**
(`DocumentView::unaccounted_keys` → `DiagnosticCode::KeyNotAccountedFor`), not only in a test, per R24.
The test-side oracle derives its expectation from the **document tree**; suppressing a coverage
record's *creation* now fails both corpus sweeps, which the old per-record audit could not see.

**What it does not say.** A key inside an undescended span is *accounted for*; it is **not** addressable,
searchable or displayable as a field. That is the deliberate trade, and a later phase that wants to
render such a subtree must decide how rather than assume the projection already did. Accounting is by
**containment**, so an over-wide recorded span would over-account — unreachable today, and weaker than
per-key attribution would be.

### D2x — the architecture-rule check changed in 1b-1, and the old one must not be quoted again

CLAUDE.md §3 — *`crates/espansoconfig-core` must never depend on `tauri`* — is unchanged and absolute.
**Its check is not.** Until 1b-1 the evidence was `rg -c tauri Cargo.lock` finding nothing. The moment
`src-tauri/` joined the workspace the lockfile gained tauri **legitimately**, so that command now finds
matches whether or not the rule holds — and, worse, a version of it that still passed would be passing
vacuously.

The check is now:

```sh
cargo tree -p espansoconfig-core | rg tauri     # must find nothing
```

It asks the resolver about **one crate's** dependency closure rather than about the workspace's, which is
the question the rule actually poses. Measured at 1b-1: `espansoconfig-core` resolves to `saphyr-parser`,
`serde` and `sha2` (plus four dev-dependencies), and the grep is empty.

The general lesson is the one R24 keeps teaching from a different angle: **a check can stop meaning
anything without ever starting to fail.** When the thing being checked gains a legitimate second source,
re-derive the check rather than keep running it.

### D3b — incomplete input never panics

21 054 prefixes of the valid corpus plus 15 hand-written half-states: **0 panics**, 11 clean
errors with a char index + line + column, 4 accepted. Two accepted classes produce misleading
spans and need Phase 0b guards: a truncated block header (`replace: |`) reports a span that
*includes* the header — the only case where that happens — and implicit/empty nodes produce
zero-width spans.

### D3 — the BOM is stripped and recorded before the parser runs

No parser strips it, and a BOM preceding a comment makes the parse fail outright. `SourceDocument`
carries a `bom` flag so the byte is restored verbatim on write.

### D4 — the write is optimistic conflict detection, not a compare-and-swap, and every doc says so

`replace_file_atomically()` reads the target, compares its `ContentRevision` against what the caller
believed, writes a temp file, and renames. The per-path lock in step 1 is a **process-wide mutex**: it
serialises this application's own threads and has no effect on any other process. So between the hash
and the rename, vim, espanso, Dropbox or iCloud Drive can replace the target, and the rename will
overwrite that change and report success.

**This is not fixable.** There is no ordinary POSIX or macOS pathname operation that means *replace this
name only if its contents hash to X*. Advisory locks, lock files and `flock` bind only cooperating
writers. So the decision is: **build the honest thing and name it honestly.**

- The primitive promises **atomic replacement plus optimistic conflict detection**, and the module doc
  has a `# The residual race` section naming vim, espanso and sync agents by name. It does **not**
  promise "only if the file still holds what you believed".
- `recheck_target()` runs immediately before the rename and refuses on a changed path, a changed
  `(dev, ino)`, a changed type or a changed hash, so the window is **one rename wide** rather than as
  wide as writing and syncing a whole candidate file. Narrowed, and said to be narrowed.
- `TargetChangedDuringWrite` is a **separate variant** from `RevisionMismatch`, because the two mean
  different things to a user: one is *someone else had already changed it before you started*, the other
  is *someone else changed it while you were saving*. The `Identity` arm exists because a file can be
  replaced by different bytes that hash the same only if it is the same content — an inode change with
  an equal hash still means the object is not the one that was inspected.
- `WriteError::may_have_written()` answers *whether **this call's** rename may have completed* — not
  whether the target currently holds anything. Under external writers the target must be re-read.

**What this obliges later phases to do.** 2a-3's backups and 2d's watcher are not conveniences: they are
the recovery path for the race this decision leaves open. A conflict UI that assumes the app's last
write is what is on disk would be wrong for the same reason.

---

## Open risks and deviations

| # | Risk | Mitigation / state |
|---|---|---|
| R1 | `saphyr-parser` is **pre-1.0 (0.0.11)**; the API can break between patch releases | Confined to `crate::syntax` — no other module imports it. 31 pinned tests fail loudly on any behaviour change. Deliberately **not** vendored: vendoring creates ownership without removing upgrade risk. |
| R2 | If a future saphyr release "fixes" `index()` to genuinely return bytes, the `CharToByte` adapter silently becomes wrong | Desired failure mode already wired: `all_three_crates_report_character_offsets_not_byte_offsets` and `saphyr_offsets_count_unicode_scalar_values_not_bytes_utf16_units_or_graphemes` both fail immediately. |
| R3 | **Block-scalar** and block **collection** end offsets overshoot into trailing trivia | **Closed in 0c-3a (D2n).** The block-scalar half was trimmed in 0b. The collection half was *measured* before a rule was chosen — the end marker overshot 223 of the 235 synthetic block collections then in the corpus and 228 of 240 real ones (246 of 273 synthetic is what the suite pins today), never undershoots, and lands at EOF, on a node or mid-trivia (111/42/298), so it is neither usable nor reconstructible. The published span therefore stays child-derived on purpose, and `CollectionExtent::owned_end()` is a second, fallible derivation cross-checked against `TriviaIndex::subtree_extent` over both corpora, with 0 unaccountable extents. |
| R4 | Phase 0 gate is **not yet cleared** — the round-trip property test does not exist yet | **CLOSED in 0c-3b-2b. The gate is PASSED**, with four qualifications, and the verdict with its evidence is `docs/decisions/0c-3b-2b-notes.md` §8. "Passes on the full corpus" is discharged in the strong reading: **every eligible target in every file of both corpora**, no stride and no thinning — 2 080 synthetic attempts (1 696 applied) and 1 998 real (1 851 applied), zero verification failures. **UI work is unblocked**, but only for the operations that exist: editing a scalar, adding and removing a field, and reordering matches **inside one sequence**. It does **not** license presenting a plain scalar's *type* to the user (R16), moving a match between files or sequences (D2r), or combining a move with any other edit in one batch (R25). |
| R5 | An empty block scalar (`replace: \|` mid-keystroke) reports a span that **includes** its header — the one exception to "the header is outside the span" | Phase 0b: the backwards header lexer must refuse to run when the span itself starts with `\|` or `>`. Pinned by `a_truncated_block_scalar_header_produces_a_span_that_swallows_the_header`. The content span now starts past the header *line*, never past the indicator alone, so rewriting it cannot splice a value onto the header line. |
| R6 | **Flow-collection comment ownership** is undefined: in `items: [one, # why` / `two]` the comment belongs to no obvious node | **Closed in 0b-2 (D2d).** The comment attaches to the innermost enclosing flow collection and raises `HazardKind::CommentInFlowCollection`; the collection is then refused **outright**, whole-collection replacement included. Pinned by `a_comment_inside_a_flow_collection_belongs_to_the_collection_and_flags_it`. |
| R7 | **Empty and implicit nodes** (`empty:`, bare `- `, `? key` / `: value`, compact `- key: value`) create zero-width or shared boundaries with no unique owner | **Closed in 0b-2 (D2d).** One documented, tested policy each — see the D2d table. The explicit `?`/`:` form additionally raises `HazardKind::ExplicitKeyMapping`; the other three are safely editable once their punctuation and comments are attributed. |
| R8 | **Merge keys and aliases** can defeat a path resolver that assumes key/value scalar pairs — `<<` arrives as an ordinary scalar key, aliases are not scalar values | **Closed in 0b-2's fix round.** Both are classified syntactically, never positionally: a merge key is a *plain* scalar in key position spelled exactly `<<` (a quoted `'<<'` is an ordinary string key and is deliberately not flagged), and an alias is `NodeKind::Alias`. Each raises its own hazard, so the enclosing mapping and the alias are refused rather than resolved. Pinned by `a_merge_key_is_recognised_syntactically_and_refuses_its_mapping` and `an_anchor_definition_and_its_alias_are_both_refused`. |
| R12 | **Refusal for anchors, aliases, tags, merge keys, duplicate keys and multi-document streams is broad, and was previously recorded here as *total*.** A file using any of them is largely, but not entirely, non-editable in the visual UI | Accepted, and it is the specified behaviour: plan §7 rows 7–8 say *detect and refuse*, and §13 defers visual editing of anchors, aliases, tags and merge keys out of v1. **"Total" was wrong, and 0c-2b measured it.** The gate refuses the flagged node, its ancestors and its descendants, so a **sibling** stays editable: `anchors-aliases-tags-merge.yml` refuses 12 addressable scalars and **applies 5** — `matches[2].trigger` is editable although the explicit-tag hazard sits on the `replace` beside it — and `duplicate-keys.yml` is 2 refused / 8 applied. Only a hazard on a **document** node reaches everything, which is why `multi-document.yml` really is total. The gate's behaviour is unchanged and safe; only this prose needed narrowing. Pinned by `the_hazard_gate_refuses_by_scope_and_not_by_file`. R12's other claim is confirmed: **2 004 of 2 004** attempted real-corpus edits applied, zero refusals, so the breadth costs this corpus nothing today. If a future corpus does trip it, the escape hatch is a *narrower* hazard scope, not a weaker gate. |
| R13 | **Duplicate-key detection compares decoded scalar values only.** A non-scalar key — an alias or a collection used as a mapping key — is skipped by the duplicate check | Accepted: every such key already raises `AliasReference` or sits inside a refused construct, so the mapping is refused anyway. Revisit only if a case appears where a non-scalar key exists without any other hazard. |
| R9 | The missing evaluation criterion is **replacement-envelope correctness**, not endpoint accuracy | Phase 0c. Mutate real documents and assert: the span matches the requested structural path despite duplicate keys, nested sequence mappings, merge keys, aliases, explicit keys and empty values; the replacement reparses to the intended value and stays valid YAML; every byte outside the envelope is identical (CRLF/LF, BOM, missing final newline, trailing spaces, comments, block-scalar terminal newlines). This is the Phase 0 gate's round-trip property test. |
| R14 | **A Markdown table inside `replace: \|` rejected the whole document.** `locate_header` treated any block whose first body line opens with `\|` or `>` as a truncated R5 header | **Fixed in 0c-1.** The backwards lexer runs first and the forward R5 path is the fallback; a genuinely truncated header has nothing but its key on the preceding line, so backwards finds nothing and forwards still fires. Reviewer-approved. Pinned by `a_body_line_opening_with_a_block_indicator_is_not_a_truncated_header`. This was a latent **Phase 0b** bug that the codec work surfaced — a real espanso config with a Markdown table would have been entirely unopenable. |
| R15 | **`NonCanonicalEscaping` is deliberately over-broad**: it refuses every double-quoted source containing any backslash, including already-canonical `\\`, `\"`, `\n`, `\t` | Accepted for now, and safe — it only costs the ability to re-encode such a scalar byte-identically, never correctness. Carries a `TODO(0c-2)` in its doc comment. Narrow it only if 0c-2 finds real files where editing an escaped double-quoted value matters. |
| R16 | **The round-trip oracle parses with saphyr (YAML 1.2), but espanso consumes with a YAML 1.1-ish stack.** Agreement with saphyr does not prove the file means the same thing to espanso | **Partly closed in 0c-3b-2b (D2s), and the open half is stated so it cannot be mistaken for mitigated.** *R16 stays open: byte preservation and conservative emission prevent edits from changing untouched bytes or introducing known YAML 1.1-ambiguous plain scalars, but the UI projection of pre-existing plain scalars is not yet proven to match espanso's resolver.* **Closed half:** an in-house 1.1/1.2-core tag table in the library, consulted by the emitter and asserted in `verify()` as a differential property, so an edit can neither introduce a new ambiguity nor change an existing classification. Building it found D2h's predicate writing **34 distinct 1.1-ambiguous values plain** — a real corruption path, now fixed. **Open half:** the *projection*. 31 synthetic and 65 real plain scalars resolve non-`str` under 1.1 today; the app would display them as strings. **The UI consequence is settled by D2u — the browser shows source text, never an inferred type — so the open half costs display richness, not correctness.** R16 closes only when the projection is proven against espanso's actual resolver, which is also what would unlock type-aware rendering. **Residual risk:** a pre-existing or explicitly tagged scalar may be displayed or used by the typed projection with a different type/value than espanso assigns, and an incomplete hand-maintained resolver table or an espanso-specific schema change could leave that disagreement undetected. **Two named weaknesses:** explicit tags are outside the table entirely, and the **1.2-core half has no second implementation** (the 1.1 half has one, differentially swept over 500 000 values with zero disagreements). Deliberately **no second parser crate** — see D2s for why, and do not add one without re-reading it. |
| R17 | **A flow collection is not refused by the hazard gate.** `HazardKind` has only `CommentInFlowCollection`, so `matches: [{trigger: ":a", replace: old}]` both resolves *and* passes `is_safely_editable`. A block scalar is illegal inside `{…}`/`[…]`, so an edit that turns a short value into a multi-line one would emit invalid YAML | **Closed in 0c-2b (D2k)**, by the second of the two answers R17 named: flow context is threaded into rendering, so a multi-line value inside a flow collection becomes a double-quoted one-liner and a block scalar is never emitted there. Flow-interior edits are **not** refused, because refusing them would cost the visual editor the ability to change a trigger list. The one collateral effect is that a plain scalar in flow context is requoted on edit. Pinned in both directions; a flow collection carrying a comment is still refused outright. |
| R18 | **A node in key position cannot be verified by the path that found it.** Renaming the `replace` of `replace: old` makes the path `replace` resolve to `NoSuchKey` in the reparsed document, so the verify step fails on a *correct* edit | Accepted and bounded. A scalar edit targets `Resolved::value` only; `resolve_key` exists for the **spans** a structural edit needs (where an entry begins, so removing it takes its key too), not as an edit target. Documented on `resolve_key` itself. A key-rename operation needs its own protocol — verify against the **intended new** path, not the old one — and is 0c-3's problem if it is wanted at all. Editing an ordinary value that merely equals some other entry's key string is harmless. |
| R19 | **`TriviaIndex::scan` is quadratic** — `ownership.rs`'s primitives each scan **every node** and are called **once per trivia item**, so the cost is O(items × nodes) | **Largely closed in 0c-3b-2b's fix round, by memoisation rather than by thinning any sweep** — which is what the 0c-3b-2a checkpoint instructed and what the first draft of the gate did *not* do (it strided the real corpus instead; the review caught it). The primitives now answer from precomputed orders, with a differential test asserting they agree with the linear scans they replaced. Measured: the gate binary went **34.3 s → 16.9 s while becoming exhaustive** (real attempts 1 373 → 1 998), `patch_edit` 23.6 s → 7.5 s, `patch_move` 16.4 s → 5.7 s, `patch_structure` 19.6 s → 5.9 s, and the whole suite **87.9 s → 39.4 s**. **Not fully closed:** the safe entry point still re-scans on every call by design, which is a Phase 1 concern — 20 ms per keystroke-triggered rescan is not viable, so the UI needs either a cached index or an incremental one. |
| R20 | **A quoted scalar's reported end overshoots trailing spaces and a following comment**, exactly as a block scalar's does (R3) — the same class of latent silent-corruption bug, in a layer everything else rests on | **Fixed in 0c-2b, in the span layer rather than worked around in the edit engine.** `SyntaxIndex::quoted_span()` trims the reported end back to the closing delimiter, lexing forwards from the opening one (`''` and `\"` are data, not terminators; the scan crosses line breaks so multi-line quoted scalars trim correctly). Unlike `block_layout` it falls back to the reported span rather than rejecting the index, because a quoted scalar with no closing quote inside its own reported span cannot come from a document the substrate accepted, and making a file unopenable for an unreachable case is the R14 mistake. **The residual risk is the corpus, not the code:** this was invisible for three phases because no fixture exercised the shape. `trimmed_block_scalars()` is now restricted to the two block styles so the two overshoots can never again be folded into one figure — which is precisely how this one hid. **Standing instruction, and the 0c-3b-1 review added its second half:** a new hazard gets a *fixture*, not only a unit test — and **a new refusal gets a fixture on each side of its condition**, not one inside it. R23 was pinned as correct for a whole phase with only the refused shape in the corpus, and its over-breadth was invisible until a reviewer constructed the safe one. **Seven occurrences now, and the seventh was closed rather than carried.** 0c-3b-2a's move fixture originally spelled an inline comment after a **single-quoted** scalar, which made the Phase 0a tripwire `saphyr_flow_scalar_end_offsets_are_exact_across_the_whole_valid_corpus` fail — revealing that **no synthetic fixture had ever held a quoted scalar carrying an inline comment**, so that test's claim of exactness was "exact in this corpus" rather than exact. The phase's first response was to change the fixture to a plain scalar and record the hole; **its review overruled that**, on the ground that deleting discovered evidence to preserve a claim is backwards. The quoted shape is now back in `move-a-match.yml` and `parser_evaluation.rs` classifies quoted overshoots in a separately counted, separately asserted bucket, so the tripwire states what is actually true. |
| R10 | A block scalar whose header cannot be located has **no correct span**: the reported one runs into trailing blank lines and the next node's indentation | The index is **rejected** with `InvariantViolation::BlockHeaderNotFound` rather than publishing the known-bad span. There is deliberately no fallback. From the Phase 0b-1 review, ranked failure mode 3. |
| R11 | **Terminal spaces or tabs at end-of-source** are scalar content, not the next token's indentation — there is no next token | `block::content_len` takes `at_end_of_source` and keeps a trailing run that sits on a content line. Pinned by `terminal_spaces_at_end_of_source_stay_inside_the_block_scalar` and the `block-scalar-terminal-spaces.yml` fixture. |
| R21 | **A removal envelope is a contiguous hull, so it cannot express "remove this entry but keep the file-owned comment inside it."** Such a removal was refused rather than performed | **Closed in 0c-3b-1 (D2o).** The envelope is now an ordered, disjoint set of **runs** — the hull with every file-owned comment's whole line, and the blank runs touching it, punched out — spliced as several replacements. The refusal became an *assertion* on the derived run set, argued unreachable and pinned at 0, and the three-layer visibility discipline was re-confirmed by disabling each layer in turn (`docs/decisions/0c-3b-1-notes.md` §6). The change made the invariant **stronger**: `VerificationFailure::EnvelopeMissesTheEntry` states what a hull made unstatable. Measured gain: **1** synthetic removal, **0** real ones — exactly the cost the refusal had — and the real value is that a move is impossible on a hull. Cost: one new refusal, `RemovalWouldExtendABlockScalar`, for the one shape a run set cannot express (a kept comment directly under a block scalar's content, **at or past that block's body column** — the column comparison came from this phase's own review, finding 2), 1 synthetic attempt and 0 real ones. **Re-confirmed after that review**, which changed layer 3: every experiment of §6 was re-run, and two more break the *engine* rather than a layer, which is what shows the sweep can disagree with it. |
| R23 | **A comment a removal *keeps* can be absorbed by a block scalar above it**, changing that block's decoded value although nothing about it was edited — the shape neither D2o nor the 0c-3a review named | Accepted and refused by name (`EditError::RemovalWouldExtendABlockScalar`), the twin of `RemovalWouldExtendAKeptBlock`. **Narrowed by the 0c-3b-1 review's finding 2, which found the first form over-broad.** It now fires on three clauses, not two: the removal has something to preserve, *and* some block scalar's content ends at or before the envelope's first run with nothing but blank lines in between, *and* **the first non-blank line the removal preserves sits at that block's own body column or deeper**. A shallower line ends the block instead of extending it, exactly as the removed entry's key already did, so the reviewer's `>` block above a column-zero comment is a legal removal and is pinned byte-exactly. The body column is `ScalarPresentation::indent`, **read off the span layer and never re-lexed** (D2/D2d); the earlier "only reconstructible" objection was about a block's *end*, not its body column. One case still refuses unconditionally: a block whose content span is **empty** (`replace: \|` with the next sibling under it, the R5 shape), where `indent` holds the header's column rather than any observed body's. Costs the synthetic corpus **1** attempt, in `run-based-removal-envelope.yml`, and the real corpus **0** — unchanged by the narrowing, which let one attempt through and turned none away. `run-based-removal-boundaries.yml` pins the safe side. |
| R22 | **`InconsistentEntryIndentation` is pinned at 0 and is argued to be *unreachable*, not merely unreached** — a coverage hole and a proof look identical in a count | Accepted, with the argument recorded in `docs/decisions/0c-3a-notes.md` §3: a valid block mapping cannot have its keys at two columns, and the two shapes that can are refused earlier by other variants. No fixture was invented to reach it, because an impossible fixture would prove nothing. This is the one refusal family whose pinned zero rests on an argument rather than on a construction — treat it as the weakest pin in the table, and revisit if a real file ever trips it. |
| R24 | **A safety property that lives only in the test suite is not a safety property** — 0c-3b-2a shipped `the_arrival_is_the_departure` in the sweep but not in `verify()`, so a defective planner that permuted the bytes it carried could still mint a `PatchedDocument` | **Closed in 0c-3b-2a's fix round (D2q)**, and recorded as a *class* rather than an incident: the check is now a production property, plus `comment_ownership_survives` for the re-attribution variant no byte comparison can see. **Standing instruction for every later phase: when a sweep proves something the engine relies on, ask whether the engine asserts it too.** The pattern to watch for is a property whose only home is a test file whose name ends in the thing it protects. Pinned by `every_other_move_property_certifies_the_permuted_candidate`, which asserts the other four properties **accept** the corrupted candidate. **It recurred immediately in 0c-3b-2b** — a removal envelope swallowing an unowned blank line was caught by nothing in production, because `bytes_outside_the_replacements_match` authorised it from the envelope's own declaration. Closed by `RemovalCarriesMoreThanTheEntry` (D2t). **The gate now rests on no property whose only home is a test file**, and that sentence is the closure condition: check it again whenever a sweep gains a property. |
| R25 | **Move verification is not compositional** — `MoveMustBeTheOnlyEditInItsBatch` refuses a batch pairing a move with any other edit, including the safe and obvious "move this match and change its `replace`" | Accepted as a **deliberate phase-scope limit, not an invariant**, and relabelled as such after the 0c-3b-2a review found the original circularity argument unconvincing. It conceals no demonstrated splice-order bug — a single move still exercises descending application of its own runs. Two costs, both recorded: the safe combined request above is refused, and **`OverlappingEdits` is consequently never tested against a move-versus-edit conflict**, because the restriction rejects such batches before overlap analysis runs. Closing it means applying the permutation to a combined expectation and exempting precisely the independently verified rewritten node, which is how field batching already works. Revisit when the UI needs it or when cross-file move lands. |
| R26 | **`shares_a_line` and the move sweep's second derivation of `comment_ownership_survives` are pinned or covered more weakly than the rest** | Accepted and named rather than papered over. `shares_a_line` is **reachable** — via a compact nested sequence such as `outer[0][1]` in `- - first` — and is driven by a hand-written unit test rather than a corpus fixture, because neither corpus holds that shape; it is weaker than corpus coverage and R20's rule would prefer a fixture. `comment_ownership_survives` has a production derivation but **no independent second derivation in the sweep**, deferred on R19 cost grounds (`docs/decisions/0c-3b-2a-notes.md` §3.4). Both are the weakest pins added by 0c-3b-2a; R22 remains the weakest in the table overall. |
| R27 | **A held identity goes stale on every reparse, and the UI is what holds identities.** `MatchId` is refused across a revision change (D2v), which is correct and is not free: a selection, a scroll position or an open editor pane held across an external file change now meets `IdentityError::StaleRevision` | Accepted, and it is the specified behaviour — refusing beats resolving to the wrong match, which is what the code did before the Phase 1a review. **The cost lands squarely on Phase 1b/1c**: every lookup that can cross a `refresh()` must handle the error rather than unwrap it, and the UI needs a re-selection policy (most likely: re-resolve by `DocumentPath`, which is the thing designed to survive a reparse, then fall back to clearing the selection). Plan §6.5's reconciliation already requires that conversation, so this adds a case to it rather than a new mechanism. Pinned in both directions by `an_identity_from_before_a_reordering_is_refused_rather_than_resolved`, which also asserts that reprojecting *identical* bytes mints the *same* identity. |
| R28 | **`Deserialize` on `ByteSpan` bypasses `ByteSpan::new`'s inverted-span assertion.** A frontend-supplied span is currently only ever echoed back, but nothing in the type system says so | Accepted **for a read-only phase, and dangerous the moment a mutation trusts a span that crossed the IPC boundary.** `serde` is `Serialize`-only except for a named list — `DocumentId`, `NodeId`, `DocumentPath`, `PathSegment`, `ByteSpan`, `MatchId` — which are exactly plan §6.4's command *arguments*. `ContentRevision`'s hand-written `Deserialize` accepts only the 64-character hex string its `Serialize` writes, so a malformed concurrency token is a typed rejection rather than a digest that quietly matches nothing. **Phase 2 must not let a deserialized `ByteSpan` reach the patch engine without revalidating it**, and must not widen the `Deserialize` list without re-reading `docs/decisions/1a-notes.md` §9 hole 6. |
| R29 | **An unmodelled subtree is accounted for by span, not by name** (D2w): a key nested under an unrecognised option is proven present but is not addressable, searchable or displayable | Accepted as the deliberate trade, and recorded as a hole rather than folded into the "no key is dropped" claim — which is how the Phase 1a review found it. Measured cost: **28 of 546 synthetic keys** are span-accounted rather than named, and **0 of 566 real ones**, so the live config loses nothing today. Two second-order weaknesses named with it: accounting is by *containment*, so an over-wide recorded span would over-account (unreachable today, since every span comes from a published node), and two `UnknownEntry` reasons carry no path by construction — `NonScalarKey` (no `PathSegment` can spell such a key) and `RepeatedKey` (a path would name the *first* entry, not this one). A later phase that wants to render such a subtree must decide how, not assume the projection already did. |
| R31 | **The hardcoded-string check sees markup only.** It scans `src/**/*.svelte` for literal text outside `t()`, and is blind to `<script>` bodies, `{'literal'}` expressions, `.ts` string constants and props — so a clean run means *"no literal sits in markup"*, not *"no hardcoded string exists"* | Accepted and **stated in those words** rather than as a passing check (`docs/decisions/1b-1-notes.md` §7). Its blind spots are pinned as tests, so the boundary is asserted rather than remembered, and it was proven able to fire against the real tree rather than only to pass. The residual exposure grows with every phase: 1c is almost entirely user-facing strings, and the class of string this check cannot see — an error message assembled in a `.ts` store — is exactly what 1b-2's code dictionaries produce. **Re-read this row before adding any string outside markup.** |
| R32 | **Nothing renders, and "the process stayed up" is not evidence that anything did.** No test mounts `AppShell` or asserts that switching the picker re-renders; `npm run tauri build` has never been run, so the bundler, the `.app` layout, the `Info.plist` merge and the production CSP are untested end to end | Accepted for 1b-1 and **owed by 1c**, which is the first phase with a screen worth asserting about. **This risk stopped being hypothetical inside the phase itself.** 1b-1 first reported the shell "smoke-launched and stayed up"; the fix round found a missing `custom-protocol` feature meant every binary loaded the dead `devUrl`, so that window was **blank** and `npm run tauri build` could not have succeeded. A launched process proved the window and webview were created and **nothing whatever** about what was painted in them — which is precisely what the risk says, demonstrated. It was separated from a frontend exception only by planting a static `<h1>` in `dist/index.html` and watching that fail too. A DOM environment (`jsdom` / `@testing-library/svelte`) is a deliberate future decision rather than a default, and `vite.config.ts` says so at its `environment: 'node'` line; the `$effect` half of the document-language sync is untested for the same reason. The bundler half is Phase 5's subject (plan §10, `SIGN_AND_NOTARIZE.md`). **Standing instruction: never again record a hand launch as evidence about rendering.** |
| R34 | **The macOS application menu is unlocalized**, so a Spanish user meets an English menu bar — a live exception to CLAUDE.md §2, which is non-negotiable | **Open, owed by 1b-2, and it is a recorded disagreement rather than a settled hole.** The Phase 1b-1 reviewer's position is that the phase should not have closed while it stands. The rebuttal on file: Tauri v2 builds the default menu in Rust, so localizing it needs either Spanish strings in Rust — which plan §9 forbids in as many words — or menu labels handed across IPC, which needs a command, and 1b-2 is the phase that has one. `CFBundleLocalizations = [en, es]` and `CFBundleDevelopmentRegion = en` are already declared. Both halves of the argument are in `docs/decisions/1b-1-notes.md` §9 hole 1 so a later session can overrule this one **on the evidence** rather than rediscover the question. |
| R35 | **Nothing establishes that a Spanish string is Spanish.** The dictionary suite checks key parity, placeholder parity and non-identity with the English value — a translation reading `"Sprache"` passes every one | Accepted, and the *claim* was corrected rather than the code: the suite is named for the untranslated-value heuristic it is, per the review's finding 5, and the `"Sprache"` counterexample is written into the notes and the module doc comments so the boundary cannot be forgotten. Closing this needs reviewed expected translations or a bilingual review gate — a process, not a test — and the cost grows with every phase, since 1c is almost entirely user-facing strings. Two smaller relatives named with it: the duplicate-key scanner compares **key text** rather than decoded escapes, and `webview-floor.test.ts` pins the esbuild target against the plist floor for *consistency* only — esbuild constrains syntax, not library APIs, so a newly used API with a higher baseline than the target would still slip through. `Object.hasOwn` was exactly that shape. |
| R33 | **TypeScript is pinned to 6.0.3, one major behind 7.0.2**, because `svelte-check@4.7.4` declares `typescript: ^5 \|\| ^6` | Accepted and dated. The whole i18n guarantee is a *compile-time* one, so the version that compiles it is load-bearing: an upgrade that changes how `Record<Exclude<keyof T, TranslationKey>, never>` behaves would weaken `ExactDictionary` silently. The four disabling experiments of `1b-1-notes.md` §2 are the tripwire — **re-run them after any TypeScript or `svelte-check` upgrade**, because they are the only thing that would notice. |
| R30 | **Nothing in the projection is proven against espanso itself.** The field list is plan §3's, verified against espanso 2.3.0 and its JSON schemas — but by the plan's author, not by any test in this repository | Accepted, and the failure mode is the right one rather than a silent one: a field espanso has and plan §3 lacks lands in `unknown_entries`, where D2w's accounting proves it survived and R29 records that it is not rendered. That is not the same as being correct. Closing this means a differential check against espanso's own schema, which is a Phase 3 concern at the earliest (plan §12 puts unknown-field preservation *verified end to end* there). |

---

## Phase 2c-1b review disposition

**Three rounds, nine findings, and the sharpest two were found by neither of the reviews.** The
mandatory once-per-phase adversarial review is `docs/reviews/phase-2c-1b-code.md`; the second pass
on the reading's fixes is appended to the same file. Both returned **`READINESS: NOT READY`**.
**All nine were fixed before the commit**, so — as with every phase since `8989c16` — no commit
holds a demonstrated defect.

**Round 1 — the aggregate review. Three High, three Medium.**

| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | **High** | **Stale text could be paired with a newer revision and silently overwrite another program's write.** `installView` replaced the projection at revision R1 while `readFileText` skipped its re-read because the document ID was unchanged, so *Edit* paired text T0 with R1, the revision check passed, and T1 was overwritten. **Wider than the notes' own revert-then-restore argument**, which it falsified | `readFileText` captures the projection's revision **before** the text read and answers it as `BrowserState.fileTextRevision`; `installView` drops a snapshot whose projection it replaces. The notes' §5 was rewritten — the old argument reasoned about two reads and the defect was a third event |
| 2 | **High** | **A failure carrying `may_have_written: true` was drawn as "nothing was written".** Rename succeeds, a later step fails; the file may already hold the candidate. That is *a committed write reported as not-written* | `BrowserState.saveRawDocument` answers a typed `RawSaveAnswer` whose `failed` arm carries `mayHaveWritten`, and an **indeterminate** arm is drawn instead, in both languages |
| 3 | **High** | **A committed save whose re-projection failed was drawn as a clean success.** The workspace reported the reload failure only to the developer channel and sealed only the `SaveResult`, so the editor could not draw *window out of step* | `adoptTheReplacedDocument` returns its failure; `sealWholeDocumentSave` takes it as a required third argument; `applySave` appends `windowOutOfStep` beside the saved arm. Hole 8.3 **deleted rather than reworded** — it had stopped being a hole |
| 4 | Medium | **Closing the editor mid-save let an authorized write commit with its outcome drawn nowhere**, under a dialog saying the changes had not been written | Close and discard-confirm are refused while a save is in flight, a sentence says the save cannot be stopped, and a dialog raised before a save is withdrawn when one starts |
| 5 | Medium | **The conflict read the disk text from the pane's *current* target**, so an editor open on file A while the sidebar pointed elsewhere lost *Reload disk version* entirely — one of the eight §6 requirements | `captureTheDiskText` captures **by document**, read through `BrowserState.rawTextOf(id)` |
| 6 | Medium | **The phase had no window reading**, which `2c-split-notes.md` §7 requires of every 2c sub-phase | Taken. It is §9 of the notes — and it found findings 7 and 8 |

**Round 2 — what the window reading found, which no review and no test did.**

| # | Sev | Finding | Fix |
|---|---|---|---|
| 7 | **High** | **CRLF silently normalized.** Three CRLF endings went in and none came out, while the panel said *"exactly the text that was sent"* | A **refusal**, structural: `RoundTripText`, a branded string whose only constructor applies the CR check. Reconstruct-on-save named and refused (D13) |
| 8 | Medium | ***Copy my text* never copied**, on the conflict's destructive step | `copyBySelecting`: an offscreen carrier text area, `document.execCommand('copy')`, no new dependency, with the existing disclosure still firing when both routes fail |

**Round 3 — Codex on those two fixes. One High, one Medium.**

| # | Sev | Finding | Fix |
|---|---|---|---|
| 9 | **High** | **The CR invariant was not total and D13 claimed it was.** `editText` accepted any string without the check, so `editText(session, "a\rb")` then `beginSave` produced a candidate carrying a CR. Unreachable from the running screen, because a `<textarea>` never emits one — but *that* is a fact about a component, not a guarantee, and the record had written it as a type-system claim | The check moved into the brand's constructor and is applied at all three doors plus `beginSave`. **D13 rewritten into three named categories**: what TypeScript enforces, what the guards enforce, and what merely happens to be true of the current path |
| 10 | Medium | **`copyBySelecting` could throw out of its own cleanup**, so an unguarded `previous.focus()` swallowed *both* disclosures — silence on the one control that exists to keep a draft from being lost | Removal and focus restoration are independently non-throwing through one named `quietly`, the function always returns a boolean, and the previous **selection** is snapshotted and restored beside the active element |

**The reading was then re-taken**, because the fixes changed three files and a claim about a screen
needs a reading of a screen. It confirmed the refusal on screen in both languages, the LF twin still
opening, and the fixture's 375 bytes and thirteen CRLF endings **`cmp`-identical after every one of
five launches**.

**One reading result was withdrawn rather than kept.** The first run measured
`navigator.clipboard.writeText` rejecting and concluded the shipped WKWebView refuses it. The
re-take established the confounder — `document.hasFocus()` false throughout, `lsappinfo front` =
`loginwindow`, `CGSSessionScreenIsLocked = true`; the machine's screen was locked, and both
clipboard routes are gated on a focused document. **The question is open and needs a human at an
unlocked machine** (hole 8.12). D14 survives on its merits — a second route costing no dependency —
with the claim corrected rather than the code. The source comment asserting the withdrawn
measurement was corrected too.

---

## Phase 2c-1a review disposition

The mandatory once-per-phase adversarial review is `docs/reviews/phase-2c-1a-draft-spine.md`. It
returned **`READINESS: NOT READY`** on three High findings. **All eight were fixed before the
commit**, so — as with every phase since `8989c16` — no commit holds a demonstrated defect.

The brief carried the protocol as *rules* rather than as background, so a violation would come
back as a defect and not as taste, and it told the reviewer the tests already passed and to skip
"add a test for X" unless a missing test hid a real defect. **Two of the eight findings were this
project's own decision record asserting a guarantee the code did not give** — the most valuable
thing the review found, because a false claim in a notes file is the one defect no test can fail.

| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | **High** | **The seal was readable by reflection.** The payload sat on the sealed object under a module-private symbol, and `Reflect.ownKeys(sealed)` / `Object.getOwnPropertySymbols` recovered it, as did spreading the object and reflecting on the copy. The seal was also **reusable** — openable again later with a no-op callback. The module doc's claim that the outcome could not be read except through the opener was **false** | The payload moved off the object into a module-private **`WeakMap`**; the sealed object is now an empty frozen husk carrying nothing at all. The entry is **deleted before the callback runs**, so the seal is one-shot *and* a `forget` that re-enters with the same seal cannot be served either. A second open returns `alreadyOpened` and does not call the callback. Six escapes are now tests |
| 2 | **High** | **A throwing `forget` hid a committed save.** The opener let the callback's exception propagate in place of the result, which is exactly the prohibited *"a committed write is never afterwards reported as an error"* — the invariant a prior review had already caught broken in TypeScript once | The throw is caught, classified through the existing `classifyFailure`, and returned **beside** the committed outcome as `invalidation: { kind: 'failed' }`. The file is written and stays written, and the answer says so |
| 3 | **High** | **Structured values were stored by reference.** Acknowledge candidate A, mutate a nested field in place, and `draft.value` and `consent.candidate` are the same object — so consent survives onto candidate B, with no history step and no invalidation. If the base is the same object the mutation moves it too, so `isDirty` stays false. `readonly` is shallow and is not a runtime barrier | A draft carries **rules**, `{ same, snapshot }`, not just an equality. The base, the current value, every history step, the save/reload base and the consent candidate are all snapshots, **deep-frozen unconditionally**. The reviewer's exact scenario is driven with a structured `T` |
| 4 | Medium | **`acknowledgeDraft` accepted any acknowledgement**, so A's consent could be bound to draft B — and **this file's own record claimed the module never produces that pairing**, which was untrue: given A's acknowledgement, it constructed it | `acknowledgeDraft` is **gone**. Consent is opaque and branded, and only `acknowledgeRefusal(draft, submission, refusal)` produces it, checking the base revision, the candidate identity and acknowledgeability. The record was corrected to say what is now true rather than to soften what was wrong |
| 5 | Medium | **The save boundary destroyed history the person still needed.** Submit `2`, type `3` while the save is in flight, succeed: the post-submission edit could no longer be undone back to the saved value | Submissions carry a **history generation**. `savedDraft` cuts the past at the submitted step and **keeps what came after it**. The undone-past and abandoned-branch cases are handled and tested explicitly |
| 6 | Medium | **Scope and document were caller assertions.** `describeSaveOutcome(rawRefusal, 'edit')` suppressed the whole-document disclosure; the wrong `DocumentId` could be sealed against a result; and a whole-document saved arm with a non-`null` `moved` stayed representable although the protocol says it is `null` permanently and by construction | Two producers — `describeWholeDocumentSave` and `describeEditSave` — replace the free-form `scope` string. `WholeDocumentOutcome` is produced **only** by the seal, and its saved arm **types** `moved: null`, rebuilt rather than passed through |
| 7 | Medium | **`draftKept: true` was an adjective, not a guarantee** — a caller could discard the draft and still get a model saying it was kept. **This record called that "not expressible"**, which was untrue | `ConflictModel<T>` **carries the actual `Draft<T>`**. Reload is a confirmed transition, `confirmReloadDiskVersion` → `reloadDiskVersion`, with a token checked against that conflict. This is also the shape 2c-4a inherits |
| 8 | Low | **Unbounded history** — every keystroke would append a whole document string for the life of a session | `HISTORY_LIMIT = 100`, oldest step dropped first, with the memory arithmetic and **what the user loses at the bound** written down. Coalescing is explicitly the editor's job, not this module's, and it says so |

**The review's closing judgement was answered rather than absorbed.** It held that the shape was
*"not yet adequate for `MatchDraft` or later conflict rebase"* on three counts — aliasing,
post-submission history, and a conflict state not carrying the draft. All three are findings 3, 5
and 7, and `docs/decisions/2c-1a-notes.md` §5 answers each **plainly**, including whether 2c-4b
will need more than this shape gives.

**Five residues are recorded rather than claimed closed** (`2c-1a-notes.md` §4), and the first
three are the same shape: **TypeScript has no linear types.** A caller can still read
`submission.acknowledgement` and pass it beside different text straight through
`commands.saveRawDocument`, where the wire's exact-multiset check is the only backstop; nothing
forces a value to be **sealed** in the first place, and `sealWholeDocumentSave(documentB, resultOfA)`
is undetectable here because the pairing is asserted once by the adapter that issued the save;
`() => {}` still satisfies `ForgetReplacedDocument`, because no signature can require a body to
act. Two more are narrower: `reloadedDraft` is exported and reachable without the confirmation
token, and `deepFreeze`/`deepEquals` cover plain data only while the history bound is arithmetic
rather than measurement.

---

## Phase 2c split — consult disposition

The split of Phase 2c was put to a design consult before any line of 2c was written, by the same
rule 2b-2c's split followed. The consult is `docs/reviews/phase-2c-split-design.md` — held to a
self-contained brief with no web search and no repository exploration, so its answers are about
the design as stated rather than about whatever it might have found by reading. The resulting cut
is `docs/decisions/2c-split-notes.md`.

**Seven questions, seven answers, all adopted. Four changed the cut rather than confirming it.**

| # | Question | Answer | Disposition |
|---|---|---|---|
| 1 | Is putting the **raw whole-document editor first** right, or dangerous? | **Raw editor first** — the small editor introduces changed-field tracking, scalar fidelity, optional-field semantics and projection-to-draft conversion *simultaneously*, so a protocol failure could be misattributed to any of them. A raw candidate is one exact string and isolates the protocol unusually well. *"Saving unparseable text is not itself the danger; saving it without content-addressed, draft-specific acknowledgement is."* | **Adopted, with its prerequisite.** The prerequisite is not optional: a committed replacement must produce a **typed** invalidation effect, not a documented obligation. **That moves the effect out of 2c-3 and into 2c-1a** — the first change to the cut |
| 2 | Is a "minimal but honest" conflict state in 2c-1 sound, or a half-built path never revisited? | **Sound** — *"a deliberately terminal conflict state is a complete first implementation, not a partial implementation of rebasing."* Eight requirements listed for it to be honest | Adopted verbatim as `2c-split-notes.md` §6, plus its prohibition: **no control in 2c-1b may be called "Keep my draft"**, because in the plan that phrase means the 2c-4b rebase. No placeholder buttons; 2c-4's behaviour is an explicit Phase 2c exit requirement instead |
| 3 | Where does **draft-level undo** belong? | **Not a sub-phase.** *"Undo is not genuinely separable from the draft architecture. Its state shape must be designed in 2c-1."* Seven state distinctions listed | **Adopted — the second change.** Undo is deleted as a sub-phase; its shape is 2c-1a's and its coverage extends per editor. The seventh distinction is the protocol's own rule meeting undo: **an acknowledgement is bound to the exact current candidate**, so undoing invalidates consent collected for another |
| 4 | Is **duplicate** a trivial addition? | **No.** A projection-based duplicate loses comments, key order, scalar spelling and quoting, unknown fields, tags and anchors — *"Calling that operation 'Duplicate' would violate the app's preservation promise even if the source match itself remains untouched."* A true duplicate clones the exact source subtree, which `create_match` cannot express | **Adopted — the third change.** Duplicate becomes **2c-3c**, owing a decision before it owes code: a true duplicate (Rust work in `patch/`) or an honestly-labelled *New from supported fields*. Not a button |
| 5 | Which sub-phases are themselves too large? | 2c-3 → three; 2c-4 → three (*"'keep my draft' is the dangerous algorithmic part and shouldn't ship alongside five new UI offers in one commit"*); 2c-5 dissolved | **Adopted — the fourth change.** Five sub-phases became ten |
| 6 | The most likely failure the split does **not** protect against? | *"A successful raw save followed by continued use of stale frontend projections and `MatchId`s"* — the screen can present every arm correctly and still leave the workspace holding stale selections, details, search results and draft targets | Adopted and **written into the split as §8 rather than left to be discovered.** Moving the effect into 2c-1a does not by itself close it: the effect must be **unignorable**, and where TypeScript cannot force that, the residue is recorded as a hole rather than claimed closed — as `2b-2c-3b-notes.md` §7.2 already did for `ReloadAfterRawSave` |
| 7 | What acceptance evidence, given no automated test renders a component? | **Three kinds per sub-phase**: automated model/state tests, **at least one mounted-component interaction test**, and a recorded manual window reading. Per-sub-phase specifics given | Adopted, with one addition of our own — see the decision below |

**The one decision taken here rather than by the consult: this project gains mounted-component
tests, in 2c-1b, scoped.** The consult asked for them; the choice of when and how wide is ours.
`vite.config.ts` has anticipated exactly this decision since 1b-1 in as many words — *"Adding
jsdom later is a deliberate decision, not a default"* — and Phase 2c is where the premise behind
that default expires: its components hold interactive state, and **the acknowledgement round trip
is the highest-risk protocol in the application while living entirely inside a component**, where
a model test cannot reach it and a manual reading cannot regress-test it. The decision is scoped
and not retroactive: the harness is added in 2c-1b and used for the interactive components 2c
introduces; existing components are not back-filled; and **the manual window reading is not
replaced** — a mounted test proves a handler fires, not that a window draws.

---

## Phase 0b-2 review disposition

The mandatory once-per-phase adversarial review is
[`docs/reviews/phase-0b-2-trivia-and-ownership.md`](docs/reviews/phase-0b-2-trivia-and-ownership.md).
Its verdict was that the layer was sound as gap tiling and attribution but **not** sound as the
advertised pessimistic safety gate or as a source of move/delete envelopes — "substantive
correctness issues, not polish". Phase 0b was held open and every finding fixed before it was
recorded complete.

| # | Finding | Disposition |
|---|---|---|
| G1 | Direct-owner queries strand a descendant-owned comment on move/delete | **Fixed.** `items_owned_by_subtree` / `comments_owned_by_subtree` added and made the documented default; the direct queries stay, relabelled as diagnostics. |
| G2 | The hazard set is far too narrow to be a pessimistic gate | **Fixed.** Six new `HazardKind` variants: `AnchorDefinition`, `AliasReference`, `MergeKey`, `DuplicateMappingKey`, `ExplicitTag`, `MultiDocumentStream`. Corpus hazards 1 → 18. |
| G3 | A hazard with `node: None` disabled nothing | **Fixed.** Any node-less hazard now refuses the whole document. |
| G4 | Docs said whole-flow replacement stayed legal; the gate refused it | **Fixed, in the gate's favour.** Docs corrected here, in `ownership.rs` and in the test's own prose. |
| G5 | Verbatim tags (`!<…>`) were mis-tokenised despite being documented | **Fixed.** A verbatim tag is lexed to its closing `>`; an unterminated one falls back to the shorthand scan. |
| G6 | Tests checked tiling, never classification or ownership | **Fixed.** Exact `(span, kind)` and `(span, owner, rule)` goldens, plus two corpus-wide oracles that re-derive both from the source independently of the scanner. |
| G7 | A header before the next document's `---` was filed under the previous document | **Fixed.** The file-header rule takes the document from its target node, not from the comment's offset. |
| G8 | `PROGRESS.md` overclaimed the §6.2 rules as implemented "verbatim" | **Fixed.** D2d now states both extensions and the precedence that resolves rule overlaps. |

Two of the reviewer's framings were adjusted rather than adopted verbatim, and both are
recorded above as new risks: the gate's refusal is **total** for anchor/alias/tag/merge/duplicate
/multi-document files rather than scoped (R12), and duplicate detection covers scalar keys only
(R13). Neither weakens the gate; both are cases where a narrower answer would have needed a
policy Phase 0c has not written yet.

## Phase 0c-1 review disposition

The mandatory once-per-phase adversarial review is
[`docs/reviews/phase-0c-1-scalar-codec.md`](docs/reviews/phase-0c-1-scalar-codec.md). Its verdict
was **"should not be accepted unchanged"** — two logical-value corruptions, two byte-identity
violations, and three compatibility gaps. Phase 0c-1 was held open until every one was fixed.

| # | Finding | Disposition |
|---|---|---|
| F1 | Relative indent > 9 clamped the indicator to `\|9` while still indenting the body deeper, moving the surplus columns **into the value** | **Fixed** — body column and indicator chosen together (D2f). Also fixed the same bug independently present in `preserved_block`. |
| F2 | A whitespace-only final line at EOF was dropped by `content_len`, so the projection lost logical data | **Fixed, not waived** (D2g). The indentation column is threaded into `block::layout`; the `known_shortfalls` test waiver is deleted. |
| F3 | U+2028 / U+2029 emitted raw — YAML 1.1 line separators that `char::is_control()` does not catch | **Fixed** — forced to double quotes and emitted as `\L` / `\P` (D2h). |
| F4 | A bare `\r` in a block body returned `Ok` and was rewritten as LF | **Fixed** — new `NotReencodable::BareCarriageReturn`. |
| F5 | `\|+2` re-encoded as `\|2+`, breaking byte identity with nothing lossy | **Fixed** — `HeaderIndicatorOrder` records the source order (D2i). |
| F6 | `is_conservatively_safe_plain_scalar("<<")` was true; no mapping-key role existed | **Fixed** — `ScalarRole` added; `<<` rejected from the plain-safe set unconditionally; a key can never be a block scalar. |
| F7 | Unicode noncharacters had no printability policy | **Fixed** — substrate behaviour measured first, then escaped rather than refused (D2h). |

Coverage gaps the reviewer named are also closed: block sites now cover indent deltas of 9, 10 and
20, a bare-CR body, both header orders, noncharacters, and mapping-key emission; and the corpus
refusal set is pinned **per scalar** (file + byte range + family, 17 entries) rather than per
family, so two scalars can no longer swap eligibility inside one family undetected.

One divergence from the reviewer, recorded in D2f: F1 is fixed by re-indenting rather than by a
typed refusal. Decisions A, B, D and E were approved as implemented.

## Phase 0c-2a review disposition

The review is
[`docs/reviews/phase-0c-2a-path-resolver.md`](docs/reviews/phase-0c-2a-path-resolver.md).
Verdict: **accept with fixes**. Unlike the three previous rounds it found **no counterexample to
either round-trip property and no reachable panic** — it verified `resolve(path_to(n)) == n` by
direct argument and `parse(display(p)) == p` for every Rust `String`, and confirmed
`Resolved::parent` correct. What it did find was one **false claim in the documentation** and a
set of contract-critical branches that were advertised and untested. All six are fixed.

| # | Finding | Disposition |
|---|---|---|
| P1 | The module doc claimed the gate refuses every flow collection a path resolves into. It does not — only `CommentInFlowCollection` exists | **Fixed, and promoted to a risk.** Doc corrected to say exactly which constructs the gate does refuse; the true flow behaviour pinned in both directions by a new test. Recorded as **R17**, which 0c-2b must close. |
| P2 | Editing a node in key position invalidates the path that found it, so the advertised verify cycle cannot check a key rename | **Fixed as documentation plus a constraint.** `resolve_key`'s doc now states that a scalar edit targets `Resolved::value` only and that a rename needs its own protocol. Recorded as **R18**. |
| P3 | `parse(display(p)) == p` and `parse`'s totality were universal claims backed by a hand-picked table | **Fixed.** Two seeded sweeps: 4 000 generated paths round-trip byte for byte, 20 000 generated strings parse with zero panics, over an alphabet holding controls, both YAML 1.1 line separators, the BOM and astral characters. |
| P4 | `AddressError::NonScalarKey` was unreachable from the corpus, so the pinned `0` documented a coverage hole rather than proving the branch; duplicate-key *descendants* and duplicates across scalar presentations were unpinned | **Fixed.** Three new tests: a collection used as an explicit key, a duplicated key with children (ambiguity must name the *ancestor*), and `a` / `'a'` / `"a"` as three spellings of one duplicated key. |
| P5 | `an_unknown_node_identifier_is_refused_not_panicked_on` never passed an unknown `NodeId` to `path_to` | **Fixed.** It now takes a high `NodeId` from a larger index and calls `path_to` on a smaller one, asserting `AddressError::UnknownNode`. |
| P6 | The textual form emits control characters verbatim, which is exact but poor for logs | **Fixed by describing it accurately**, which is the reviewer's first option. Escaping was rejected: it would put an unescaping step inside the round trip the type exists to guarantee. The doc now says the form is an exact serialization, not a log-safe rendering, and points at `str::escape_debug`. |

The reviewer's assessment of the pinned counts is recorded because it is fair and should temper
how much they are trusted: `addressable`, `mapping_keys` and `ambiguous` catch coarse
reachability regressions, the node total is mostly a corpus-shape lock, and **no count can
detect compensating category changes**. That is why the per-category split exists and why the
sweeps and the re-derivation oracle carry the real weight.

## Phase 0c-2b review disposition

The mandatory once-per-phase adversarial review is
[`docs/reviews/phase-0c-2b-span-replacement.md`](docs/reviews/phase-0c-2b-span-replacement.md).
Verdict: **do-not-accept** — one demonstrated byte-fidelity defect, which is the exact failure this
crate exists to prevent. Phase 0c-2b was held open until all five findings were fixed. The review
cleared five categories explicitly, and that distinction is worth keeping: logical value corruption,
R17 flow legality, gate/API bypass, batching, and the BOM/no-final-newline/terminal-spaces/tabs/
non-ASCII set were each **examined and found clean**, not merely unexamined.

| # | Finding | Disposition |
|---|---|---|
| E1 | **High, demonstrated.** A block-to-flow change replaced one synthesized envelope `header_span.start .. content_span.end`. By D2c the content span starts *after* the header line's break, so the envelope swallowed bytes belonging to **neither** span: `k: \|\r\n  body\n` → `""` returned a bare LF, making a CRLF document mixed, and `k: \|   \n  body\n` silently lost the three spaces after the indicator | **Fixed.** The two spans are now replaced **separately**, so the bytes between them are never written. Same class as R3 and R20: the substrate's spans are not the envelope, and a synthesized one is a guess. |
| E2 | **Medium, demonstrated.** `CommentOnBlockHeader` and `LineNotFreeForBlockScalar` refused edits that have an exact lossless answer, and the notes doc's claim that a block-header comment "cannot" survive a style change was **false** | **Fixed.** Both variants **deleted**, not left as dead branches: with the split replacement, `k: \| # why` → `""` is just `k: '' # why`, and a multi-line value on an occupied line renders as a quoted flow scalar. The false claim is corrected. |
| E3 | **Medium.** Verification could not catch E1: it checked the candidate against the **declared** replacements, so an oversized *intended* span was authorised by the very declaration it should have been checked against | **Fixed.** `permitted_spans` derives the allowed spans from immutable syntax facts — a block scalar's `header_span` and `content_span`, and nothing between them — and any replacement outside them is `VerificationFailure::SpanNotPermitted`. What verification still cannot catch is recorded rather than glossed: a defect shared by both decoders, a YAML 1.1 disagreement the 1.2 substrate accepts (**R16**, open), and an addressing mistake made identically in planning and verification. |
| E4 | **Low.** The advertised per-fixture pinning did not exist — one aggregate tally, so two fixtures could exchange eligibility undetected — and the test's allowed-span helper shared the production policy, which is why it authorised E1 | **Fixed.** `SYNTHETIC_OUTCOMES` pins a complete **per-fixture** row and is asserted to cover the corpus exactly, so a new fixture must be given a row. The test's permitted-span derivation is now independent of the planner. |
| E5 | **Low, suspected.** `quoted_span` silently returned the known-bad overshooting span whenever a precondition failed. No reachable counterexample was found, and the forward lexer was confirmed correct on escaped backslashes, backslash parity, doubled-quote runs, multi-line quotes, flow values and keys | **Fixed as an observable, not a refusal.** `quoted_span` returns `Option` and every fallback is **counted** (`SyntaxIndex::unlexable_quoted_scalars`), pinned at zero across both corpora. Rejecting the index was considered and refused: making a real file unopenable for an unreachable case is the **R14** mistake. |

**The coverage hole was the defect.** The first draft pinned a `comment_on_block_header` count at 0
and noted that no fixture carried a comment on a block-scalar header line. That gap was not
harmless — it was precisely the shape whose bytes were being destroyed. The fix round added
[`block-scalar-header-tails.yml`](crates/espansoconfig-core/tests/corpus/synthetic/block-scalar-header-tails.yml),
which pairs a block scalar with a header-line comment, with three trailing spaces after a `|-`
indicator, and with a `>2` header carrying both an indicator and a comment. All **72** of its
attempted edits apply. This is the second time in two phases that the corpus, not the code, was the
weak link (R20), which is why R20 now carries an explicit instruction for 0c-3.

It is the **ninth** fixture whose whitespace *is* the test data, so `CLAUDE.md` §4 lists it and
`tests/corpus_integrity.rs` fails the build if an editor trims it. Every pinned count it moved is
tabulated in `docs/decisions/0c-2b-notes.md` §7, and each delta is exactly the fixture's own shape —
the sharpest cross-check being that the whole-line comment scan gained **6** while the token-accurate
scanner gained **8**, the difference being its two comments that share a header line, which is the
documented distinction between the two conventions (D2d).

## Phase 0c-3a review disposition

The mandatory once-per-phase adversarial review is
[`docs/reviews/phase-0c-3a-structural-edits.md`](docs/reviews/phase-0c-3a-structural-edits.md).
Verdict: **do not accept** — "finding 1 is silent deletion of a byte ownership explicitly says must
remain, and present verification certifies the corrupted result." The phase was held open until all
five were fixed, as the four before it were.

The review also cleared a substantial set **explicitly**, and that distinction is worth keeping:
ordinary removal envelopes correctly use subtree rather than direct ownership; inline comments, leading
comments, file headers, blank runs either side, CRLF, empty values, block scalars, first/last entries
and compact sequence mappings are handled or refused as documented; indentation is learned from sibling
keys including in compact items and deep nesting; node-level verification detects a changed or deleted
kept sibling including nested collections; normal overlap cases classify correctly with no corrupt
interleaving; and the flow, compact-first-entry, last-entry and `RemovalWouldExtendAKeptBlock` refusals
are correctly scoped. Each of those was **examined and found clean**, not merely unexamined.

| # | Finding | Disposition |
|---|---|---|
| 1 | **High, demonstrated.** Removing a collection-valued entry deletes file-owned comments, and every layer certifies the result | **Fixed at four layers** (D2o). `subtree_extent`'s doc claim that file comments are excluded was **false** and is corrected — it is a hull. `EditError::RemovalWouldDeleteAFileComment` refuses; `VerificationFailure::FileCommentLost` makes the class visible to verification, derived from ownership rather than from the edit; the external oracle compares file-owned comments before and after with its own scan. All three confirmed to catch it **independently**, by disabling each in turn. The run-based envelope the reviewer names as the real answer was scheduled into 0c-3b as **R21** with its cost measured, **and landed in 0c-3b-1**: the removal is now performed and the comment kept byte for byte. |
| 2 | **Medium, demonstrated.** Insertion defaults its line ending — and learns from the document's dominant style rather than the anchor | **Fixed** (D2p), **and the same defect fixed in the scalar path**, which the review did not name. The break is copied from the most local evidence; a document supplying none is refused by name rather than given LF. |
| 3 | **Medium, demonstrated.** `[remove a, remove a, remove a]` panics — `fold_expectations` ran before the overlap check and underflowed `usize` | **Fixed twice over**: disjointness is now checked **before** expectations are folded, *and* the fold's arithmetic is checked, so no ordering can panic. Backed by the specific case and a 600-batch seeded sweep. This restores the standing "a public entry point never panics on bad input" property (D3b). |
| 4 | **Medium, suspected.** The collection extent publishes a known-bad `owned_end` as an ordinary `usize` | **Fixed** (D2n). `owned_end()` returns `Option<usize>`, `None` exactly when the derivation is `Unaccountable`, field private. Counted observable still pinned at zero. |
| 5 | **Medium, demonstrated test-claim gap.** "Every refusal is independently re-derived" was false in four ways | **Fixed, all four**, and the false claim corrected rather than softened: `KeyAlreadyPresent` is now checked against a re-derived fact instead of counted blind; `NoSuchSibling` and `InconsistentEntryIndentation` are categories in the tally and the sweep; the removal oracle compares file-owned comments; and two fixtures add the missing shapes. |
| — | The reviewer's optional hardening of the zero-width decoder skip | **Adopted.** `compare_decoders` asserts every skipped node is plain, headerless and has substrate value `~`, so the skip cannot widen later to cover a genuine disagreement. |

**One defect this fix round found that the review did not**, and it is recorded because of how it was
found rather than for its size: the line-ending invention of finding 2 was **also live in the scalar
path**, and the two fixtures written to prove the *insertion* fix walked straight into it. It had been
passing every sweep for two phases. Fourth time the corpus rather than the code was the weak link
(R20), and the second consecutive round in which a fixture written for one defect uncovered another.

## Phase 0c-3b-1 review disposition

The mandatory once-per-phase adversarial review is
[`docs/reviews/phase-0c-3b-1-run-based-envelopes.md`](docs/reviews/phase-0c-3b-1-run-based-envelopes.md).
Two findings, and the phase was held open until both were closed. The full disposition, with the
measured effect of each fix on both corpora, is `docs/decisions/0c-3b-1-notes.md` §8.

The review also cleared a substantial set **explicitly**: run ordering and disjointness; folded `>`
absorption as a *class* (the defect was over-refusal, not under-refusal); reparenting a kept comment
under another mapping or sequence item; empty mapping values, single and batched; first and last document
position; flow collections; `---`/`...` adjacency, where the reviewer found no path by which an entry
hull crosses a document marker; the `RemovalWouldDeleteAFileComment` unreachability argument, accepted as
sound *and* as demonstrably live; line endings including mixed CRLF/LF sites; and batch interaction
across several runs of one envelope. Each was examined and found clean.

| # | Finding | Disposition |
|---|---|---|
| 1 | **Major.** An interior blank run of a removed entry is deleted, while the identical run adjacent to a kept comment survives — so the justification is inconsistent, the rule is implicit, the external oracle *requires* every gap to hold a file comment and therefore codifies the behaviour, and `StructuralGuard`'s two halves do not say the runs are "exactly the entry" | **Partly adopted.** The behaviour the reviewer asks for — preserving the interior blank run — is **declined**: that byte lies *inside* the span the user asked to remove, and preserving it invents a leading blank line at document start the file never held, which is the unrequested reformatting this crate exists to prevent (`0c-3b-1-notes.md` §8.1). The other three claims are **adopted and fixed**: the "layout the user chose" wording is withdrawn from the fixture, from `preserved_regions`, from the notes and from D2o; the rule is now explicit and **pinned in both directions**; the oracle's property 6 is rewritten as a two-way partition against `preserved_by_the_rule`, which names the bytes and the direction of a disagreement instead of rejecting any change to the rule mechanically; and the guard's two halves are restated as proving the entry's **nodes**, not its trivia. The oracle's old blindness is **demonstrated**, not argued: with the engine made to delete a kept comment's ownership blank line, the old property let **both corpus sweeps pass** (§6, experiments 5 and 5b). |
| 2 | **Minor.** `RemovalWouldExtendABlockScalar` (R23) is over-broad — `block_scalar_ending_above` compares no columns, so it refuses removals whose preserved comment is shallower than the block's body indent and therefore cannot become block content | **Adopted in full.** The refusal now compares the first non-blank preserved line's column against `ScalarPresentation::indent`, the body column the span layer already published — read, never re-lexed (D2/D2d). The reviewer's `>` case applies and is pinned byte-exactly in a unit test **and** on corpus data; the indented case is still refused for `>` as well as `\|`; a block with no observed body column (empty content span) is still refused unconditionally. **Two fixtures rather than a unit test** (R20): `run-based-removal-boundaries.yml` carries the safe folded case *and* the entry-owned-leading-comment-block-plus-interior-file-comment pairing the notes had admitted neither corpus held — closing that also let the sweep's own R23 derivation move from `entry_lines` to `entry_hull_lines`, removing a documented oracle/engine disagreement. |

**What this round measured.** Synthetic: 2 634 → **2 696** attempted structural edits, all 62 of them
the new fixture's own shape, with **`block_absorbs` unchanged at 1** — the narrowing let one attempt
through and turned none away. Real corpus: **unchanged in every figure** (1 856 / 928 / 419), and the
rewritten property 6 found **zero** disagreements across 264 synthetic and 419 real applied removals.

**The pattern this round adds to R20**, recorded because it is the sixth occurrence: a new refusal needs
a fixture on **each side** of its condition. R23 was pinned as correct for a whole phase with only the
refused shape in the corpus, and its over-breadth was invisible until a reviewer constructed the safe
one.

## Phase 0c-3b-2a review disposition

Review of record: [`docs/reviews/phase-0c-3b-2a-move-and-invariant.md`](docs/reviews/phase-0c-3b-2a-move-and-invariant.md).
Its verdict was blunt and correct: *"the stronger invariant is not sound as the production safety
boundary"* — the engine usually copied bytes correctly and the sweep checked that it had, but the three
advertised **production** properties could jointly certify presentation corruption. Full per-finding
disposition in [`docs/decisions/0c-3b-2a-notes.md`](docs/decisions/0c-3b-2a-notes.md) §9.

| # | Finding | Disposition |
|---|---|---|
| 1 | **High** — the three properties never prove the carried bytes were copied verbatim; that check lived only in the test sweep | **Adopted in full.** `the_arrival_is_the_departure` is a production property with two typed failures, expected bytes read from the **original** document at independently bounded runs. A fifth property, `comment_ownership_survives`, closes the re-attribution variant no byte comparison can see. All four listed variants have retained tests. See D2q and R24. |
| 2 | **High** — the EOF rotation hands a previously unterminated destination line a terminator it never had, possibly a foreign one | **Adopted in full: the rotation is gone**, refused by name as `MoveWouldTerminateTheFinalLine`. D2p is a recorded decision and overriding it was not this phase's call. Two simplifications fell out at zero measured cost: the line multisets are paired again, and `MoveWouldExtendAKeptBlock` lost a now-dead clause. Cost: 3 synthetic moves, 0 real. |
| 3 | **Medium** — there are more than three seams; concatenating several carried runs creates internal joins none of them examines | **Adopted.** `MoveSeam::CarriedRunsJoin`, one per adjacent pair of carried runs, with `move-run-joins.yml` pinning **both** sides. The decoded-tree walk already rejected the shape, so this was never silent corruption — but the "three seams" claim was false and the typed refusal was missing. |
| 4 | **Medium** — the mutation experiments are documented history, not retained tests, and the weak ones alter multiset counts | **Adopted.** C1/C2/C2b/C4/C5 plus M1 (**permutation-preserving**, the case the originals missed), M3 and M4 drive the complete pipeline via `tampered_move`. `every_other_move_property_certifies_the_permuted_candidate` pins that the other four properties **accept** the corruption. |
| 5 | **Low** — `MoveMustBeTheOnlyEditInItsBatch` is a workaround, not an invariant | **Accepted as stated.** The restriction stays; its doc comment and the notes are rewritten to call it a scope limit, the circularity argument is withdrawn, and the untested `OverlappingEdits` case is recorded. Now **R25**. |
| 6 | **Coverage** — the quoted-scalar hole, R23-for-moves, `entry_hull_lines`, `shares_a_line` | Three closed, one recorded. The quoted shape is **restored** and the tripwire re-bucketed (R20's seventh, above); R23-for-moves gets `move-kept-comment-joins-a-block.yml` on both sides, 0 → 3; `entry_hull_lines`' block-body `#` defect is **fixed** by porting `patch_move.rs`'s version, moving no count; `shares_a_line` stays a unit test and is documented as reachable via `- - first` (**R26**). |
| 7 | **Scope** — "copied verbatim without re-indentation" holds only for one operation | **Recorded as D2r** and in notes §7.7. A differently indented or nested destination must re-indent or refuse and **cannot reuse these proofs**. |

The reviewer's strongest failed attack is worth keeping: changing a neighbouring block scalar's decoded
value at any of the three external joins **is** caught independently by the lockstep tree walk. The
failures were all in presentation-only corruption, terminator ownership, internal run joins and trivia
re-attribution — *"the exact areas decoded-tree equality cannot observe"*.

---

## Phase 2b-2a review disposition

The review is
[`docs/reviews/phase-2b-2a-save-spine.md`](docs/reviews/phase-2b-2a-save-spine.md), taken over the
whole uncommitted change (26 modified files plus `src-tauri/src/save.rs` and the notes doc).
**Five findings, no blocking one. Nothing was declined**; the finding-by-finding record is
`docs/decisions/2b-2a-notes.md` §11.

The shape of the round is worth keeping, because it is the shape this project keeps producing:
**two were defects and three were tests that passed vacuously.** A test that cannot fail is the
recurring failure mode here, and three of five is the highest proportion yet.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | **High** | Every `saveFailed` left the frontend projection and the raw-text snapshot untouched — **including when the nested `WriteError` says the rename may already have completed**, which is exactly the case the Rust side evicts its cache for. The rename succeeds, then the directory sync or the read-back fails, and the window keeps showing the pre-save order and the pre-save bytes of a file that already holds the moved snippet | **Real, and the two sides of the boundary disagreed.** Closed by making the wire carry the answer rather than letting the frontend re-derive it: `CommandError::SaveFailed` now writes a second operand, `may_have_written`, **computed in the serializer by calling the core's own `SaveError::may_have_written()`**. It is not a field, so nothing can set it wrongly, and there is no list of `WriteStep` names in TypeScript that could drift from the Rust one. `mayHaveWritten()` in `errors.ts` is the single frontend spelling. The old test's fixture failed at `Rename` — which explicitly means the rename did **not** happen — so it passed against the defect; it is kept, with its meaning now stated, and a new test fails *after* the rename |
| 2 | Medium | `ByteSpan`'s derived `Deserialize` fills `start` and `end` directly, bypassing `ByteSpan::new`'s `start <= end` invariant. `{"span":{"start":20,"end":10}}` deserialized into an acknowledgement, and a later `len()` underflows | **Real.** Hand-written `Deserialize` routing through `ByteSpan::new`; an inverted span is a **deserialization error, not a repair**, because a repaired span silently stops matching the recomputed findings and every save would then be refused twice with no explanation. Two tests, one of them the review's exact payload. The rest of the newly-deserializable graph was audited for the same shape — a public constructor enforcing something a derive skips — and `ByteSpan` was the only one |
| 3 | Medium | The conflict test could not discriminate the honesty rule it was named for: its fixture makes `found` and `disk_revision` equal, so an implementation that wrongly set `disk_revision = found` while refreshing `disk` separately would still pass | **Real, and a test defect rather than a code defect** — the production construction was already correct. The payload is now built in one named place, `conflict_after_the_lock`, and a new test drives a **real** refusal through `move_match` for `found`, replaces the file again, and then calls the builder — the interleaving itself. Setting `disk_revision: found` fails it. **The interleaving is not reachable through the command** (both reads are inside one synchronous call), which is why the rule is pinned below the command; recorded as a hole rather than papered over |
| 4 | Low | The frontend treated every `Saved` arm as though bytes had changed, though `committed: false` is a documented **success** — moving one of two byte-identical snippets produces a byte-identical candidate and nothing is written | **Real as an overstatement.** The branch now acts on `committed \|\| revision !== view.revision` rather than on the arm, the comment was corrected, and a new browser test covers `committed: false` — written as a success, because it is one |
| 5 | Low | `a_move_leaves_the_bytes_it_did_not_move_alone` did not prove byte identity outside the move, despite its name. A command that changed `replace: first` to another **same-length** value while preserving the leading comment, the trigger count, the unmodelled-key count and the total length passed every assertion | **Real, and it was checking proxies for the one property this whole project rests on.** It now derives the expected post-move text from the pre-move text and compares the file **byte for byte**. Confirmed by a throwaway `first`→`worst` corruption: all four old assertions passed and the byte comparison caught it |

**Four of the five fixes were confirmed by breaking the code, watching the new test fail, and
restoring** — findings 1 to 5 excluding none; the fifth was confirmed by the corruption test above.
That is the standard this project's review rounds should keep: a fix for a vacuous test is worth
nothing unless someone has seen the replacement fail.

**What the review confirmed rather than faulted**, recorded because it is the expensive half to
re-establish: production writes remain centralised in `save_document`; `covers_all` consumes
distinct matches, so the acknowledgement really is an exact multiset; there is no `force` bypass
anywhere; `move_match` accepts identities and never a wire path; it sends exactly one same-sequence
`MoveItem` and nothing else; backups are always supplied; and the moved identity is resolved at
`resulting_index` against a refreshed matching revision. Dropping `Clone`/`PartialEq`/`Eq` from
`CommandError` was judged reasonable, and the six rewritten assertions lost no discrimination
because `NoWorkspaceOpen` is operand-free.

---

## Phase 2b-1 review disposition

The review ran as **two** files rather than one, and the reason is itself a finding worth keeping. The
first attempt handed a reviewer the whole 3 582-line diff and six review dimensions at once; it read
files steadily for 1m42s and then went silent for thirteen minutes with no output. It was cancelled —
the known runaway signature (a repeating web-search loop) was **absent**, so this was a job too large
to finish, not a job stuck. Split into two single-file briefs, each reading exactly one bounded diff
and nothing else, both finished. **The lesson is the brief's size, not the reviewer**: a review whose
input is a whole phase's diff plus repository exploration plus six dimensions is a review that may
never answer.

- [`docs/reviews/phase-2b-1-wire-boundary.md`](docs/reviews/phase-2b-1-wire-boundary.md) — the
  core-crate diff (797 lines): the format, the deferral, the two lossy reductions, scope.
- [`docs/reviews/phase-2b-1-strings.md`](docs/reviews/phase-2b-1-strings.md) — the i18n diff (372
  lines): the five forbidden claims and the Spanish read as Spanish.

**Nothing was declined.** The finding-by-finding disposition is `docs/decisions/2b-1-notes.md` §7; what
follows is only what a fresh session needs without opening it.

**Review A — the wire format.**

- **A-i, blocking — applied.** `FindingCode::VariableMissingRequiredParam::param` was a `&'static str`,
  which `serde` cannot deserialize into, and the phase's own notes had named it the one type-level
  blocker to the acknowledgement ever coming *back*. The reviewer ruled on all three escape routes and
  called changing the field type soundest. It is now an owned `String`, at four construction sites.
  **The design itself was not touched** — how an acknowledgement round-trips is still 2b-2's to decide;
  this only removed the obstruction to deciding it.
- **A-ii, should-fix — applied, and the timing is the point.** `io::Error`'s `raw_os_error()` was being
  discarded, so genuinely different operating-system failures collapsed into one `ErrorKind` — above all
  into `Other`, which says nothing. The errno now rides beside the kind as a **nullable number** with no
  dictionary entry. It was done *now* because the wire format has no consumer yet: this was the last
  moment at which adding a field cost nothing, and after 2b-2 it is a format change Phases 2c–5 inherit.
- **A-iii, minor — recorded, no code.** A wire path is lossy display text and can never be an
  identifier. Folded into the notes' inheritance section and into this file's Next action.
- **A2 and A4 — clean.** No inconsistency among the eighteen enums' tagging; the hand-written impls
  reproduce what a derive on a sibling produces. No behavioural change in `persist/save.rs`,
  `write.rs` or `backup.rs` — derives, impls, imports, doc comments and tests only.

**Review B — the strings. Three forbidden claims found, a fourth found by the fix worker, and four more
found by the orchestrator in pre-existing strings.**

The rule the project holds is that the app may describe **risk under its own model** and may never
**predict espanso's behaviour** or pronounce a file **valid or invalid absolutely**.
`matchHasSeveralTriggerForms` said *"where espanso expects exactly one"*; `duplicateVariableName` said
*"espanso keeps the last one"*; `verificationFailure.doesNotParse` said *"no longer valid YAML"*. The
fix worker found `editError.sourceDoesNotParse` making the same absolute-validity claim about the
source. All four were corrected in both languages, along with review B's eight further Spanish quality
findings and five English register findings — **10 English and 16 Spanish values edited**.

**The four pre-existing strings are the disposition worth reading, because the rule for them was
deliberately overridden.** The fix worker was told not to rewrite strings the phase had not added, and
it complied, recording `code.diagnosticCode.{parseFailed, fieldHasUnexpectedShape,
matchHasSeveralTriggerForms, matchHasSeveralContentForms}` as owed to *"whichever sub-phase next
touches the diagnostic strings"*. The orchestrator fixed them anyway, for one reason: **2b-2 through 2d
are all about saving, not diagnostics, so the named owner may never arrive**, and a violation the
project has now demonstrated in its own review is worse to leave shipped than a slightly wider phase is
to commit. Eight values changed; each keeps its operands and its shape and changes only the claim.

**What that did not buy is a reading.** Those four appear on the diagnostics surface Phase 1c-2b-1 read
in a running window, and it has not been re-read. The claim recorded is narrower than a screen claim —
that the *strings* no longer predict espanso's behaviour, checked by key and placeholder parity — and
the next phase that opens a window owes the look.

---

## Phase 2a-3b review disposition

The review is [`docs/reviews/2a-3b-codex.md`](docs/reviews/2a-3b-codex.md) — an adversarial review
aimed first at the destructive half, rotation. **Eleven findings: one critical, four high, five medium,
one low**, and its verdict was **"not safe to commit as-is"**. All eleven are dispositioned finding by
finding in `docs/decisions/2a-3b-notes.md` §12: **seven fixed, four partly fixed with the residue
disposed** against a named standing rule.

**What the review actually found, and it was right.** The first pass rotated **before** the copy was
written, so a backup that then failed had already spent a retention slot and deleted an older batch —
which falsified the notes' own sentence that a failed backup costs *"the attempt, and nothing else"*.
It also trusted a **timestamp-shaped directory name as proof of ownership**, excluded the current batch
from rotation only by where its name happened to **sort**, and adopted an existing
`.espansoconfig-backups` that might be a **symlink**, which `read_dir` would then follow out of the
tree. Four separate routes to deleting something the application did not create, in the one function
that deletes anything.

**The five that changed the code most.**

- **F3 — rotation now runs *after* the copy is written and fsynced.** §6's structural argument survives
  the reorder and was re-derived rather than assumed: the new batch is still outside the removal
  window.
- **F10 — the current batch is excluded by identity, not by name order.** Its `(device, inode)` pair,
  with its path as a fallback. *Newly created* does not imply *newest by name*: a clock adjusted
  backwards, or ten future-dated directories, would otherwise make the directory holding this session's
  own copies the oldest candidate.
- **F2 — a batch now carries an ownership marker**, `.espansoconfig-batch`, holding a format identifier
  and a version. `rotate` removes only directories that carry it; a timestamp-shaped directory somebody
  else made is `unrecognised` and survives. The marker is forgeable by a principal who can write inside
  the backup root, and **that principal is out of scope by the same standing rule the rename rests on**
  (2a-3a): the operation is by pathname.
- **F7 — a partial backup used to poison every retry in the same session.** `create_new` failed forever
  on the leftover. It now writes to a temp name inside the batch, fsyncs, checks inode identity
  (`names_the_same_inode`, extracted from 2a-3a's `verify_temp_identity`), publishes exclusively, and
  cleans up on `Drop`. **A residue of the same shape survived and was closed by the confirmation
  round** — see below.
- **F1 / F9 — an existing backup root is now type- and mode-checked.** `symlink_metadata` refuses
  anything that is not a real directory, and a group- or other-accessible root is refused rather than
  adopted, because §5's confidentiality argument rests on the tree being `0o700`.

**F4 is the one that stayed open, deliberately.** The backup is taken before `replace_locked_file`'s
own pre-commit identity checks, which can still refuse — so a backup can exist for a save that did not
commit. The full fix is splitting the locked writer into a prepare phase and a commit phase that cannot
refuse, which is a **redesign of 2a-1's write primitive** and is out of this sub-phase. The cheap and
important half *was* fixed: a `discard` path un-captures the file and removes its copy when the commit
did not write, so a retry cannot commit over a newer target with no copy of the bytes it replaced. The
confirmation round restated `discard`'s contract rather than changing that direction: **the un-capture
stays unconditional** — making it depend on the removal succeeding would reopen F4 on exactly the
failure it exists to survive — and **a removal that fails is now recorded** instead of ignored.

**Three disagreements with the orchestrator's triage were argued and accepted**, and they are recorded
because each is a judgement rather than a fact: F5's guard lives in `capture` rather than in
`rooted_at`, so the constructor stays infallible and the check fires exactly where the first byte would
be written; it matches only the **final** component, because refusing every path containing `config`
would break a legitimate `~/config/espanso`; and F7 has no deterministic mid-write OS failure available
without a production seam, so its biting test asserts the *step* in the error plus the session-level
retry, which is stated in the notes rather than papered over.

**The confirmation pass then ran, and its question 2 found one residue — now closed.** Finding 7
removed the *partial copy* that poisoned every retry; it did not remove the *copy that could not be
removed*. `discard` un-captured the file and removed its copy best effort, so a refused `unlink` left
the file un-captured **and** its backup name occupied, and the exclusive publish answered
`BackupError::DestinationExists` on that retry and on **every later attempt in the session** — a file
made permanently unsaveable by a failure that had nothing to do with it. The refusal was the right
*direction*; the permanence was a trap.

`publish_backup` now **disambiguates instead of refusing** when the occupied name is one this session
left behind: `create_batch`'s bounded counter loop one level down, `-1`, `-2`, …, the undisambiguated
name always tried first, every candidate checked to be free before the `rename`. **Nothing is ever
overwritten** — a stale copy may be the only pristine version of an older file — and **a retry can
always take its own backup**. `discard` keeps un-capturing unconditionally (making it conditional would
reopen F4 on exactly the failure it must survive) and now records the failed removal;
`DestinationExists` survives for the case it was written for, two different targets resolving to one
backup path, which is a defect and not a race. `docs/decisions/2a-3b-notes.md` §7.1 and §12 findings 4
and 7 carry the reasoning.

---

## Phase 2a-3a review disposition

The review is [`docs/reviews/2a-3a-codex.md`](docs/reviews/2a-3a-codex.md) — a focused correctness and
security review of the `fcopyfile` step, its ordering, its failure policy and its `unsafe` block.
**Fourteen findings: two blocking, five should-fix, seven nits.** Its verdict was *"No — `fcopyfile`
itself is suitable, but the guaranteed-cleanup / 'nothing written' claim and the named-temp pathname
race should be fixed before committing as safe."* All fourteen are dispositioned finding by finding in
`docs/decisions/2a-3a-notes.md` §11; the two blocking ones are closed **in code**.

**The two blocking findings, and what closed them.**

- **Finding 12 — the temp file was chmod-ed by *pathname*.** `fs::set_permissions(guard.path(), …)`
  named a file even though the trusted inode was already open, so a process able to modify the
  directory could have had one inode chmod-ed, another written through the descriptor, and an
  attacker-supplied entry renamed over the target. Closed two ways: the mode now goes on through
  `handle.set_permissions(…)` — `fchmod` on the descriptor — and a new `verify_temp_identity` proves,
  immediately before the rename, that `guard.path()` still `lstat`s to the same `(dev, ino)` as the
  open handle. A mismatch is the new `WriteError::TempFileChangedDuringWrite`, which is a **refusal**,
  not an I/O failure, and not a *target* change. The rename itself is still by pathname and cannot be
  made descriptor-based here, so **a directory writable by an untrusted principal is now an explicit
  precondition** in the module documentation rather than a solved problem.
- **Finding 8 — "nothing was written" was too strong.** A `CopyMetadata` refusal leaves the *target*
  untouched, but a temp inode has received bytes and the guard swallows `remove_file` errors, so a
  populated temp file can survive. `may_have_written()` deliberately **kept its name** (public API),
  and its doc comment now says explicitly that it is a statement about **the target** and that `false`
  does not mean no inode anywhere received bytes. Every claim that a failure deletes the temp file was
  weakened, in `write.rs`, `persist/mod.rs`, `lib.rs` and the notes, to what is true: *the target keeps
  its bytes and its protection; a temp file may be left behind.*

**The one should-fix that changed the shape of the transaction.** Finding 5 pointed out that widening
the temp file to the target's mode *before* writing its bytes lets any legitimate reader of the target
observe an empty or partial candidate. The steps are now
`create 0o600 → write → flush → fsync → copy metadata → fchmod → fsync again → verify temp identity →
recheck target → rename`. The mode still goes on **after** the metadata copy, so it keeps exactly one
owner. That reordering also **disposed of finding 1 outright** — no data write follows `fcopyfile`, so
no question about either descriptor's file offset can arise — and carried finding 14's second `sync_all`.

**Two findings were accepted in full and deliberately not implemented**, both recorded as holes rather
than fixed:

- **Finding 11** — the pre-commit re-check compares the target's `(dev, ino)` and its content hash, not
  its metadata. Another process can change the target's ACL, xattrs or mode between the copy and the
  rename, and the newer protection is then lost with both checks still passing. The reordering shrinks
  that window; closing it needs a metadata comparison in the re-check or an inter-process lock, and
  that is a design change beyond a fix round. Notes hole 13.
- **Finding 7** — a copied *denying* ACL can make the guard's own `remove_file` fail, so the leftover
  is not merely possible but likelier in exactly the case the copy was added for. The claim was
  removed; the cleanup was not strengthened to neutralise the ACL or stage in a private directory.
  Notes hole 6 names the residue, and 2a-1's rule still holds: the **name**, not the guard, is the
  safety property — a leftover cannot be matched by espanso's include glob.

**Four findings were confirmations that required no change**, and are recorded as such rather than
omitted: 3 (read-only source and write-only destination are both sufficient; `O_NONBLOCK` is
irrelevant on an already-open regular file), 6 (`chmod` does not clear a macOS ACL — **measured here
before it was trusted**, which is what made the ordering safe), 10's `AsRawFd` half, and 13 (excluding
`COPYFILE_STAT` is right, and `COPYFILE_SECURITY` and `COPYFILE_METADATA` are both worse because they
include it).

**The review round cost one restart.** The first Codex job was given the phase diff, the notes and the
implementation file as *paths* and stalled after seven minutes with its `updatedAt` frozen; it was
cancelled and relaunched with the code inlined in the prompt and file reads, shell commands and web
search all forbidden. The second run returned in about four minutes. **A review brief for this project
should carry its code inline.**

---

## Phase 2a-2b review disposition

The review is
[`docs/reviews/phase-2a-2b-save-transaction.md`](docs/reviews/phase-2a-2b-save-transaction.md), an
adversarial correctness review by Codex over `persist/save.rs`, `tests/persist_save.rs` and the
decision record, read against plan §6.6 and §7's hazard register: **eight findings — one blocking,
seven should-fix. Five were fixed, three were dispositioned in writing and none was argued down.**
§9 of `docs/decisions/2a-2b-notes.md` is the finding-by-finding disposition.

**The finding that mattered most was not the blocking one.** Finding 8 is a **concrete deadlock**: the
transaction's step-2 read used `std::fs::read`, bypassing the primitive's regular-file check and its
`O_NOFOLLOW` open. A fifo at the resolved path — planted by a caller's context, or swapped in after
`lock_path()` resolved it — makes that read wait for a writer **with the non-reentrant path lock
held**, so every later save of that path waits behind it forever. The fix needed more than the reuse
the brief asked for: `open(O_RDONLY)` on a fifo blocks *wherever* it is called, and the type check that
would refuse the fifo is downstream of the open, so `inspect_target` itself gained **`O_NONBLOCK`**.
That is the only change this sub-phase made to 2a-1's primitive, and `persist_write.rs` still passes
25/25 unchanged.

**The blocking finding is real and is not this sub-phase's.** Plan §7 row 11 registers "capture and
restore all four" and `write.rs` restores **mode bits only** — 2a-2b changed no line of that code, and
2a-1 notes §4 already enumerates the eight dropped classes. What Codex adds beyond that record is
worth keeping: on macOS the **extended-attribute** case is ordinary rather than exotic (Finder tags,
comments, quarantine flags), and an ACL loss is an access-control **broadening**. It is accepted as a
real deviation from the plan's register, with `copyfile(3)` + `COPYFILE_ACL | COPYFILE_XATTR` between
the temp write and the rename as the named remedy and **2a-3 as its owner**. It is not silently closed.

**Two findings were about the record rather than the code, and both were overclaims.** §2.2 had said a
blanket "accept everything" acknowledgement **cannot be written** — it can, because `validate()` is
public and `Finding` is publicly constructible, so a caller can compute the findings itself and
acknowledge them without showing anyone anything. And hole 1 had said a `regex` version divergence
could bite "today" while **supplying no divergent pattern and no parity experiment anywhere**. Both
claims are withdrawn and replaced with what is established; the missing parity experiment is now its
own hole. This is the project's signature defect for the sixth phase running — a sentence asserting
more than its body can check — and it now appears in a decision record rather than in a test name.

**Findings 5 and 6 were confirmed and deliberately not fixed.** `DuplicateVariableName` and
`RegexDoesNotCompile` stay unoverrideable `EditorModelError`s, so a file espanso demonstrably runs can
be unsaveable through the visual editor. The reasoning, recorded rather than assumed: refusing a save
never destroys data while permitting one might, so the **reversible** direction is to refuse;
reclassifying is a change to `crate::validate`, which is 2a-2a's closed module; and the escape hatch
the plan names is a **raw editor**, which is a user-interface question **2b** answers and not a policy
question this layer can settle.

---

## Phase 2a-2a review disposition

The review is
[`docs/reviews/phase-2a-2a-semantic-gate.md`](docs/reviews/phase-2a-2a-semantic-gate.md), an
adversarial correctness review by Codex over `validate/mod.rs` and `tests/validate_semantics.rs`:
**nine findings — four blocking, four should-fix, one nit. All nine were accepted and all nine are
resolved; nothing was argued down.** §12 of `docs/decisions/2a-2a-notes.md` is the finding-by-finding
disposition.

**The round has one method, and three of the findings turned on it.** Where a fact about espanso
**can** be established, establish it from espanso `v2.3.0`'s own sources and cite it at the code;
where it cannot, the answer is `SuspiciousButPermitted` and a recorded hole — **never silence**.
Silence and certainty are both wrong answers to an unestablished fact, and the first pass had reached
for silence three times.

**The four blocking findings were all the same direction — false negatives, the expensive one.**

- **Rule 5 never looked inside variable parameters.** A `{{missing}}` in a `shell` variable's `cmd`
  is statically knowable and espanso renders it. The first pass recorded this as a *coverage hole*;
  it was an unimplemented half of a required rule. The projection was never in the way — `params` is
  a `Vec<FieldView>` of `ValueView`s, and the first pass simply did not look.
- **A non-mapping `params` suppressed a provably missing required parameter.** The predicate
  conflated an alias (whose target might be a mapping) with a scalar or a sequence (which provably
  hold no entry under any key). The negative-side test *required* the wrong silence — a fixture
  pinning a defect.
- **`type: match` was accepted with no `params.trigger`.** The first pass found no failure path
  because it looked among the eight registered render extensions, and `match` is not one — it is
  resolved in the renderer, where `get_matching_template` begins `params.get("trigger")?` and answers
  `None` with `MissingSubMatch`. **Looking in the right place and finding nothing is not evidence.**
- **Four of rule 5's five scope-openers suppressed real findings.** The sharpest is that
  **`inject_vars: false` opened scope** — the flag that *disables* injection was read as evidence
  that arbitrary names might arrive. A nameless variable cannot declare a name; a `form` variable
  named `f` explains `{{f.who}}` and not `{{nobody}}`. All five are gone, each with a citation.
  Narrowing an opener is the **false-positive** direction, so the real-corpus run is the guard: it
  still reports **zero** findings of either class.

**The four should-fix findings are one shape, and it is this project's signature defect** — a name or
a doc comment asserting more than its body can check, for the fifth phase running:

- `the_real_configuration_produces_no_editor_model_errors` **could skip and pass**, and when it did
  run it asserted only `errors == 0` while *printing* every suspicious finding. A rule 5 that
  reported every brace pair in the config would have passed it. It now asserts both classes are zero,
  and the skip is **demandable** — `ESPANSOCONFIG_REQUIRE_REAL_CORPUS` turns absence into a failure,
  with a four-combination test of the decision itself. A sabotage produces 117 suspicious findings the
  old assertion would have waved through.
- A test named `..._exactly_where_espanso_does` compared six hand-picked strings to hand-written
  expectations. Renamed to what it checks, and joined by one built from **espanso's own unit-test
  expectations**.
- `every_fixture()` **was not every fixture** — many were local `let source` strings, so the
  reachability and purity sweeps covered a subset. All are now top-level `const`s, and
  `every_fixture_is_listed_in_every_fixture` reads the file's own source and fails when one is
  declared and not listed.
- The nit was **backwards, not merely unproven**: the doc comment said the *second* declaration lost.
  `generate_nodes` keys its node map by name, so espanso is last-wins and the **earlier** one is
  inert.

**One should-fix was a genuine cost, not a claim.** Duplicate detection was `Vec` + `contains` and
every reference linearly rescanned the scope, with a clone of every global name per match — quadratic
work about to run **inside the save lock**, where an adversarial but parseable document makes saving
look hung. Now a `HashSet`, with `NameScope` borrowing the document's global names once.

**E20 exposed a defect in the round's own instrument**: a guard meant to prove a `match` arm was
wired matched *its own text*. Recorded in notes §7 rather than quietly fixed — an oracle that cannot
disagree is the standing rule it violated.

**Two things could not be established and are holes, not decisions.** Whether espanso accepts a
pattern its `regex` 1.5.5 compiles and ours rejects (hole 4, unchanged), and whether a `match`
variable's named sub-match exists at all — that is cross-file and unanswerable from one document
(hole 12). **One new fact arrived too late to act on**: espanso 2.3.0 has a **tenth** variable type,
`var_type: "global"`, which this crate reports as `VariableTypeNotRecognised`. It is not fixed here
because `VariableKind` is a **Phase 1 wire type** owing entries in `en.json` *and* `es.json`; the
variant and the two strings land together or neither lands. Hole 13, and **2b owns it**.

---

## Phase 2a-1 review disposition

The review is
[`docs/reviews/phase-2a-1-atomic-write.md`](docs/reviews/phase-2a-1-atomic-write.md), an adversarial
correctness review by Codex over `persist/write.rs` and `tests/persist_write.rs`: **fifteen findings —
two critical, three high, two medium, one low, and six in a test audit.** **Every one is closed or
recorded before the commit**, so no commit holds a demonstrated defect. Section 11 of
`docs/decisions/2a-1-notes.md` is the finding-by-finding table; the summary is below.

**The two critical findings are one thing: the code promised a compare-and-swap it cannot perform.** The
mutex binds only this process, so an external writer can be lost between the hash and the rename. Fixed
by narrowing the window to one rename (`recheck_target()`, a new `TargetChangedDuringWrite` variant with
four arms) **and** by correcting every doc comment that claimed otherwise. **D4** records the decision.

**One reviewer premise was rebutted with evidence, not with an opinion.** The reviewer held that macOS
`sync_all()` is plain `fsync` and that `libc` was needed for `F_FULLFSYNC`. Reading the local `rust-src`
shows `std` already issues `fcntl(fd, F_FULLFSYNC)` on Apple targets. The wording was weakened anyway,
because `ENOTSUP` has no fallback and the directory sync measurably does not do the same work — so the
finding produced a better doc comment and **no new dependency**.

**Two findings were narrowed rather than implemented, both for the same reason.** Full metadata
preservation (ACLs, xattrs, ownership, BSD flags) and `F_FULLFSYNC` on the directory both need `libc`.
Each is renamed to what the code actually guarantees — **mode bits**, and fsync-grade durability for the
bytes with best-effort publication — and enumerated as a hole with an owner. The one consequence that is
not cosmetic is written down: **dropping a denying ACL broadens access.**

**Six of the fifteen were about the tests, and four of those were theatre.** The byte-exact fixture sweep
seeded each copy with the fixture's own bytes, so a no-op writer passed it. The concurrency test had each
writer replace the file, which passes with no mutex at all. The `chflags` test could print a skip and
pass. Two count claims said "three" above five-element lists. All fixed, each verified by a disabling
experiment that now fires. **This is the ninth consecutive sub-phase in which the review's most valuable
finding was a claim outrunning its evidence** — and the first in which most of them were in test bodies
rather than in prose.

**Two holes are stated in the reviewer's own words rather than presented as covered**: no test would fail
if either `sync_all` or the read-back verification were removed, and no test involves a second process.
One incidental narrowing was found while running the experiments — with the lock removed, the read-back
verification *does* fire — so that hole is smaller than stated, not absent.

---

## Phase 1c-2b-2b-2 review disposition

The review is
[`docs/reviews/phase-1c-2b-2b-2-whole-document.md`](docs/reviews/phase-1c-2b-2b-2-whole-document.md):
**eight findings — two blocking, five follow-up and one confirmation.** **Seven are closed** before the
commit, so no commit holds a demonstrated defect; the eighth is a statement about **Phase 2** and is
recorded with an owner rather than fixed. The reviewer found **no** architecture, privacy, i18n-hardcoding,
corpus-fixture or D2u regression, and confirmed the generation check, the identity-guarded getter and
the settled `loading` arm as otherwise sound.

**Five of the eight are one defect.** A sentence claiming more than the thing beneath it establishes —
once on a **screen**, four times in a **test name**. This project has now caught that pattern in eight
consecutive sub-phases, and the corollary is unchanged: read the name, then the body, and ask whether
the body could fail if the name's claim were false.

| # | Kind | Finding | Disposition |
|---|---|---|---|
| 1 | **Blocking** | `browser.detail.fileTextAsWritten` says a document is shown "as the file writes them", which is **false for line endings**: `sourceText.ts` folds a CRLF into one `break` carrying `ending: 'crlf'` and `SourceText.svelte` never reads that field, so CRLF and LF draw as identical unlabelled `<br>` elements — while a **lone** CR is named as a marker. The phase's own measurement (`c-crlf.yml`, `markers=0`, no `0d`) proves it | **Real, and the string changed rather than the renderer.** The "announced on the same screen by the thing that performs it" defence holds for the **prose markers** and does not reach line endings, which nothing on the screen announces at all. Both languages now say: shown from the file's first character to its last, **characters that draw nothing are named**, and **every line ending is drawn as one line break**. Notes §4.2 is the argument, §4's row and §5's rows agree with it, hole 5 says what changed and what did not, and `no longer claims the file's own line endings reach the screen` holds both withdrawn phrases and asserts them gone. **Read on a screen in both languages** (notes §6.5) over a file with two CRLF endings among four LF ones and one soft hyphen: `br=6 markers=1` |
| 2–5 | Follow-up | Ten test names claim more than their bodies establish: two about `rawTarget`/`documentTextState`, two about dictionary strings, four source scans promising that something **"draws"** when they read substrings of `DetailPane.svelte`, and three in `workspace.test.ts` establishing **state** while naming a screen | **All ten renamed to what the body checks, and three bodies strengthened so a name could stay.** No test in this project may promise rendering — nothing here renders a Svelte component (hole 1) — so the four scans now say they check source wiring and placement. `carries the failure whole…` now supplies **all four** refusal codes; `tells a file of no characters apart from one it could not read` now supplies **both** an empty file and an unreadable one, so it can no longer pass if the two were conflated; `reports a refusal to the developer…` now asserts the state as well as the console. Experiments A and Q each fire one more test as a result, and both counts are corrected in the notes' §7 |
| 6 | **Blocking** | `clearSelection()` and the `cleared`/`unresolved` arms of `applyRepair()` can move an "All"-scope target to `null` **without invalidating the held file-text read**, so a later selection of that same file matches the held identity, returns early and **redraws the old snapshot** — and an answer in flight when the target went still lands and populates the cache | **Real, and fixed with one helper rather than three patched call sites.** `forgetFileText()` bumps the generation and nulls the answer and the identity; `readFileText()` calls it whenever the target is `null`, which makes the invalidation **total** instead of a list of remembered places. `clearSelection()` and `select()` (after `applyRepair`) now call `readFileText()`, as `show()` already did; `open()` and `showFileText(false)` use the helper. Notes §2.3. Two new tests cover the re-read and the race, and **experiment T** fires exactly those two. **The sticky `fileTextShown` is deliberately unchanged** — notes §2.2 decided it, the review raises it as an observation, and the defect was the staleness |
| 7 | Confirmation | Apart from the path above, the generation check and the identity-guarded getter prevent a stale answer appearing beneath another file's name, and typed failures settle the `loading` arm | **No action, and nothing weakened.** The getter keeps the comment experiment C earned, which says in the code that no call site can reach the guard. Closing finding 6 removed a way for a stale answer to be reused rather than adding one |
| 8 | Follow-up | **Phase 2 cannot refresh the displayed file after a write**: identity dedup suppresses a re-read and the deliberately-removed `force` path leaves close/re-open as the only refresh. Separately, `RawDocumentText.text` **carries no revision** and must not be treated as sufficient authority for a write | **Recorded, not fixed — deliberately, and with an owner.** Writing an invalidation for a write that does not exist could not be tested. It is **hole 14** of the notes' §9, it is in the notes' §11 inheritance list, and it is in "What Phase 2 inherits" below, so the next phase meets it in the file it will read |

**What the round changed:** two dictionary strings, one module (`workspace.svelte.ts`) and three test
files. **No Rust, no wire change, no new dependency, no dictionary key added or removed**, and the
corpus untouched.

**One thing the round found and deliberately did not fix.** `browser.detail.valueAsWritten` — *"shown
here as the file writes it"*, 1c-2b-2b-1's caption over a **slice** — goes through the same primitive
and inherits the same line-ending overclaim finding 1 is about. It is another sub-phase's string, and
rewording it after this round's window reading would mean re-taking that reading for a surface the
round did not otherwise touch. Named in notes §4.1 so it is not rediscovered; the natural companion to
closing hole 5.

## Phase 1c-2b-2b-1 review disposition

The review is
[`docs/reviews/phase-1c-2b-2b-1-source-text.md`](docs/reviews/phase-1c-2b-2b-1-source-text.md):
**four findings — three Major, one Minor, no Blocking**, and three of the four are the same defect this
project keeps catching, in the one sub-phase whose entire subject was not committing it. All four were
closed before the commit, so no commit holds a demonstrated defect. The reviewer found **no**
architecture, privacy, i18n-hardcoding, corpus-fixture, D2u or HTML-injection regression, and confirmed
the round trip, the astral and lone-surrogate handling, the CRLF counting and the Svelte 5 reactivity.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | **Major** | `browser.detail.unknownValue` says the value is "shown here as the file writes it" above **all three** `SourceSlice` arms, so an unreadable non-empty span makes the pane say the bytes are shown *and*, on the next line, that it could not read them | **Real.** Trigger: `value_text: ""` with a non-empty `value_span`. The claim was attached to the wrong scope — a caption over three branches, true of one. `unknownValue` is now *holds {kind}* / *contiene {kind}* and nothing more; the as-written claim moved into the `text` arm alone as the new `browser.detail.valueAsWritten`. The two-halves guard in `detail.test.ts` gained the newly withdrawn sentence **and a position check on the claim**, so moving it back up fails (experiment N) |
| 2 | **Major** | The scope sentence assumes every match has a block-sequence `-` and indentation before it. `MatchView::project` projects **every** item, so a flow item (`matches: [{trigger: x}]`) has neither, a bare empty item (`matches:\n  -`) has a **zero-width span** with no first or last character, and a terminal empty value stops the span before the final colon | **Real, and it is the rule broken nine times before this: a sentence written from the shape the author had in mind.** All three shapes were **measured** with a throwaway probe and the measurement then *committed* as `every_shape_a_matches_sequence_can_hold_is_projected_with_its_own_span` in `model_projection.rs`, so the next person changes the sentence against a test rather than against a memory. The new sentence names **no syntax at all**, in both languages: *"The part of the file this app reads as the snippet itself…"* |
| 3 | **Major** | The headline claim — a character with no visible shape is *named rather than drawn as nothing* — is wider than the classifier, which covered only NUL, C0/C1, the two separators, a lone CR and U+FEFF. `a\u{200b}b` renders identically to `ab`, which is precisely what the claim denies. Notes hole 7 admitted it while the headline denied it | **Real, and both halves were fixed rather than one.** The classifier widened to the soft hyphen, the zero-width set (U+180E, U+200B, U+2060–U+2064, non-initial U+FEFF) and the bidi controls (U+061C, U+200E–U+200F, U+202A–U+202E, U+2066–U+2069) under three new names. **Joiners, variation selectors, tag characters and combining marks are deliberately excluded** — they modify a neighbour rather than draw nothing, so naming them separately would misdescribe them — and that judgement is recorded as hole 7 rather than left implicit. Round-trip, ordering, exclusion and combining-mark-after-a-marker tests added; the module header, the notes' headline and `browser.source.invisibleDetail` all narrowed to what the classifier does |
| 4 | Minor | Notes §9 hole 1 and the §5 table claim a lone CR and "the other C0/C1 controls" cannot reach the detail pane because a source holding one does not parse — but **only NUL was measured** | **Real, and measuring it inverted the claim.** BEL, ESC, DEL, U+009F and U+0085 **do** parse and land inside a match's span, and so does a lone CR when the next line is indented. **Only NUL is unreachable** — a quoted one fails the parse, a plain one stops it. Pinned by `which_control_characters_can_reach_a_projected_slice`; the §5 rows, hole 1, `PARSEABLE_HAZARDS` and one over-generalised doc comment in `dispatch_check.rs` were all corrected to match. The original note was not merely unproven; it was **wrong** |

**What the review did not close, and it is named rather than papered over.** `SourceSlice`'s
`unavailable` arm is reachable only through a defect, and **nothing in this project renders a Svelte
component in an automated test**, so its string has still never been read in place. It stays hole 8.
The worker was explicitly told not to fake this, and did not.

## Phase 1c-2b-2a review disposition

The review is
[`docs/reviews/phase-1c-2b-2a-raw-text-boundary.md`](docs/reviews/phase-1c-2b-2a-raw-text-boundary.md):
six findings, no Critical, and **every one of them the same defect** — a doc comment, a test name or a
manifest asserting something its body cannot check. All six were closed before the commit, so no commit
holds a demonstrated defect. The reviewer found **no** architecture, privacy, i18n, corpus-fixture or
D2u regression.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | **High** | `document_text` is documented as returning "raw file bytes" / the file "exactly as it is on disk", but its wire type is `String` and the core rejects invalid UTF-8 first | **Real, and the wording was the defect — the behaviour is right.** A file containing `0x80` becomes a typed `{code: "notUtf8", path, offset}`; it does not panic and is not decoded lossily, but it cannot be shown. Every such claim in `commands.rs`, `dispatch_check.rs`, `workspace/mod.rs`, `commands.ts` and the notes is narrowed to **exact preservation of valid UTF-8, typed refusal otherwise**. Notes §3.1 records the `CommandResult<string>` decision, its user cost, and the fact that widening it later is a **wire-format change Phases 2–5 inherit** — the sub-phase's most consequential inheritance, now written down rather than discovered in Phase 3 |
| 2 | **High** | `value_text` has never crossed the Tauri IPC dispatcher in any fidelity test | **Real, and it is the sub-phase's own headline claim not holding for half its subject.** `an_unmodelled_entrys_value_crosses_as_its_own_bytes` projected in-process and called `serde_json::to_value`; the dispatcher sweep invoked only `document_text`. A regression dropping `value_text` in `DocumentView` serialisation alone would have left every test green. New `dispatch_check::an_unmodelled_entrys_value_text_crosses_the_dispatcher_byte_for_byte`: `get_document` over the real dispatcher, entries found **by shape**, each `value_text` compared against `std::fs::read` sliced by the `value_span` that arrived beside it — a different source, so the oracle can disagree |
| 3 | Medium | The tests stop before WKWebView while the public comments claim what the webview receives; NUL and U+2028 / U+2029 are untested | Real on both halves. The three hazards are asserted at command, dispatcher and wrapper level (new `document_text_carries_a_nul_and_the_two_unicode_line_separators`), and the webview claims are removed — `mock_builder()` swaps the platform webview out, so nothing here says anything about `postMessage` or a lone surrogate. **Measured rather than assumed: U+2028/9 *can* reach a `value_text`, a NUL cannot** — a source holding one does not parse. Recorded as hole 9, an **R20 deviation**: all three are pinned by hand-written sources, not corpus fixtures |
| 4 | Medium | The "spans are provably disjoint" argument does not make an uncapped payload safe | Real, and the distinction is exact: disjointness bounds **duplication** at roughly one extra document, not **size**. §3 rewritten — the pathological input is spelled out with its three main-thread copies, and the corpus's 342-byte maximum is labelled a fact about this corpus rather than a bound. **The uncapped decision is kept** — right for a bounded read-only phase — but the saving it does not demonstrate is no longer claimed. Cost recorded as hole 10 |
| 5 | Medium | `a_remote_origin_is_refused` claims all seven commands and attempts three | Real, and a **security** claim with a false body: remote access accidentally permitted for `get_document` left the test green. Extended to all seven with well-formed arguments, and the attempt table is now asserted equal **in both directions** to the names parsed from `generate_handler!` — so a command added without an entry fails the test instead of sliding past it |
| 6 | Low | `every_command_refuses_before_a_workspace_is_open` never calls `text` | Real, and the **seventh** occurrence of "read the test's name, then its body, and ask whether the body could fail if the name's claim were false". `session.text(id)` added, with the test's scope written down |

One change outside the six, found while closing them: `src-tauri/capabilities/default.json` asserted the
harness "drives all six commands", which this sub-phase falsified the moment it registered a seventh.

## Phase 1c-2b-1 review disposition

The review is
[`docs/reviews/phase-1c-2b-1-typed-judgements.md`](docs/reviews/phase-1c-2b-1-typed-judgements.md),
and it was taken in **two passes**: seven findings, then a narrow verification pass over the fix round
that confirmed all seven closed and found **two more the fix round had introduced**. All nine were
closed before the commit, so no commit holds a demonstrated defect.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | **High** | `AdditionalDocumentNotProjected` says the additional document "is shown" | **Real, and it is this sub-phase's own stated failure mode landing inside the sub-phase built to avoid it.** The projection records later documents by span only; the viewer that would show one is deferred to 1c-2b-2. Reworded in both languages to claim only that espanso reads the first document and the later one was not interpreted. The fix forced a sweep of the other five new strings against their data, and **that sweep found a second false claim** — see finding 8 |
| 2 | Medium | Diagnostic identity is the code alone, so distinct occurrences collapse | Real. Twenty `KeyNotAccountedFor` diagnostics rendered as one sentence saying "one key". `occurrenceIdentity()` (code + span + node + path) now sits beside `diagnosticIdentity()` (code only); lines aggregate and carry `occurrences` / `repeated`, rendered "in N places" through a third `plural.ts` pair. **The test was the other half of the finding**: a hand-written `OWED` list that omitted the second input could not disagree with a policy that drops a real finding — R24's corollary again. It is a conservation count derived from the input now |
| 3 | Medium | Findings are unreachable for config profiles | Real, and **completed rather than deferred**. `holdsMatches` refused a profile before `getDocument()`, so a profile with broken YAML was silent in every pane of the application. `open()` projects every listed document now and `holdsMatches` governs counting only. Phase 1's exit is "the owner can browse their **entire** real config". **This fix introduced finding 8** |
| 4 | Medium | Zero-based wire indices displayed as human document numbers | Real — an empty first document displayed as "Document 0". Converted at the display boundary under a *display* operand name, so a stale dictionary leaves a visible placeholder rather than a wrong number. Indices 0 and 1 tested. **Strengthened by finding 9** |
| 5 | Low | The unnamed refusal invents a file-level cause | Real. `safely_editable: false` with `blocking_hazard: null` establishes only that the verdict refuses; "part of the file blocks it" was not in evidence. Now "and no reason was given" |
| 6 | Low | The union does not deduplicate its first input | Real but defensive — the core currently promises a distinct list. Seeded from a `Set` and given a duplicated-summary fixture, because the implementation and its test both claimed "each distinct kind once" while testing only an already-distinct input |
| 7 | Low | Two test names claim more than their bodies can check | Real, and the **sixth** occurrence of "read the test's name, then its body, and ask whether the body could fail if the name's claim were false". Renamed to claim only source occurrence. **Deliberately not closed by adopting a component-rendering library** — that is a decision with its own costs, recorded as one below, not a side effect of a fix round. Experiment Y demonstrates the gap rather than asserting it: `tHazard(` in a comment while the markup renders the raw identifier passes every test |
| 8 | Medium | Match-shaped profiles leak into `scopedMatches` | **Real, and finding 3's own regression** — before that fix such a profile was never projected. A `ConfigProfile` whose content holds match-file keys is deliberately projected as `DocumentShape::MatchFile`, so `view.matches` is populated, while the sidebar count still excluded it: the list showed rows the total did not count. Both branches of `scopedMatches()` consult `holdsMatches` now, **on `kind` rather than `shape`** — where the file lives, not what its content looks like. Experiment Z shows the disagreement (`[90, 91, 10, 11, 20]` against a sidebar total of 3). It also falsified **two sentences the notes already asserted**, which is why it is filed as the third occurrence of *a written claim ahead of its data* rather than as a bug |
| 9 | Low | A future differently-named index operand would silently stay zero-based | Real. The conversion was keyed on the operand spelling `document_index`, so a later `match_index` would render `0` with no placeholder and no failing test. Now `DIAGNOSTIC_DISPLAY_INDICES`, **a mapped type over `DiagnosticCodeName`**: experiment AA deletes the `EmptyDocument` row and `npm run check` fails naming the variant, before any test runs. Placed beside `ENUM_OPERAND_NAMESPACES` and nowhere near the key builders, so `codes.ts`'s existing guarantees are untouched |

## Phase 1c-2a review disposition

The review is [`docs/reviews/phase-1c-2a-detail-pane.md`](docs/reviews/phase-1c-2a-detail-pane.md).
**No High findings.** Two Medium and two Low, all four closed before the commit, so no commit holds a
demonstrated defect.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | Medium | The pane says an unmodelled entry "is shown as written" and shows only its key | **Real, and the sharpest of the four** — it is a claim the project has not earned, the same class as D2u and R16. Verified against the wire first: `UnknownEntry` carries `key`, `key_node`, `key_span`, `value_span`, `value_kind`, `path` and `reason` — **no value text**, so the pane never could have shown it. Six strings reworded in both languages to claim only what is true (*recorded and left untouched*, *kept exactly as the file writes it* — about the file, not the screen), and a new `browser.detail.unknownValue` renders `value_kind` through `tValueKind`: "holds a set of keys, which this pane does not show". **Deliberately not fixed by reconstructing the value in TypeScript from `value_span`** — JS string indices are UTF-16 units, not bytes, and that confusion is exactly what the core's `CharToByte` adapter exists to prevent. Carrying an exact Rust-sliced source span is hole 13 and inherited work |
| 2 | Medium | A sequence item's boundary is invisible | Real. `detail.ts` modelled the item label and the component rendered nothing for that arm, with `list-style: none` removing the native bullet too. Two `search_terms` whose first item held a two-line literal block rendered as three unmarked lines. A `•` in markup — **not a CSS `content:` rule**, so `innerText` can see it and a window reading can check it — plus a stylesheet rule and a text-scan guard |
| 3 | Low | The field-coverage test audits what the implementation emitted | Real, and **D2w recurring**. Closed at the root rather than by rewording the comment: `EVERY_DETAIL_FIELD` is pinned to `DetailFieldName` in both directions by two `assertNever<Exclude<…>>()` calls, and the assertion is now set **equality** rather than a count. Experiment Q adds an unemitted 25th member: the new test fails, and the test it replaced passed |
| 4 | Low | The notes' dictionary counts are wrong and disagree with each other | Real, and verified independently against `0507f6f` — 169 keys at the base. Corrected throughout; the figure is now **50 added, one removed, 218 each**, the extra over the review's arithmetic being `unknownValue`, which finding 1 added after the review was written |

## Phase 1c-1 review disposition

The review is
[`docs/reviews/phase-1c-1-shell-and-data-path.md`](docs/reviews/phase-1c-1-shell-and-data-path.md).
**Eleven items — two High, five Medium, three Low, plus one defect found outside the review — and every
one is closed. Nothing was rejected.** The phase was held open until the fix round finished, so the
commit contains no intermediate state holding a demonstrated defect. The full disposition, with what
each fix cost, is `docs/decisions/1c-1-notes.md` §13.

- **High 1 — the fingerprint could silently confirm a different match.** Real, and the most serious
  finding in the phase. `matchFingerprint` compared `search_text`, the badges and two shape codes, which
  between them carry **no** `word`, `propagate_case`, variable, form field, unmodelled entry or
  non-primary content field. The reviewer's counterexample is two matches differing only in
  `word: true` / `word: false`: identical fingerprints, so `reresolve()` answered `sameMatch` and the
  browser selected the wrong snippet. The notes had admitted only the *identical-twins* limit, which is
  far narrower. Closed by route (a) — a new read-only `MatchView.source_text`, the bytes the match's
  span names, compared alone. Bytes out of the file are a fact about how the file is written, never a
  resolved value, so D2u is untouched. Hole 3 of the notes is rewritten to the true statement: two
  **byte-identical** matches remain indistinguishable, and nothing in the file distinguishes them either.
- **High 2 — recovery installed a fresh identity over a stale document.** Real. `applyRepair()` stored
  the re-resolved id but never replaced the old `DocumentView` in `views`, so `selectedMatch` resolved
  the old node behind the new id, the list kept old rows and the counts stayed stale; deleted snippets
  also stayed visible after `differentMatch` and `gone`. Closed: `repairSelection` returns the projection
  it read and `installView` replaces the document **before** the selection outcome is applied, on both
  the kept and the cleared paths.
- **Medium 1 — an overlapping selection could overwrite a newer choice.** Real. Closed with a generation
  token checked after every `await`. Its experiment is the one that **did not fire** until the test also
  asserted that a superseded selection issues no reload; recorded in the notes rather than tidied away.
- **Medium 2 — reopening kept an invalid file filter and query.** Real. `open()` now resets selection,
  query, documents, summary, views and failures, under an open-generation token.
- **Medium 3 — search omitted secondary content forms.** Real, and it was a **core** defect rather than a
  frontend one: `build_search_text()` took `ContentSpec::primary()`, so `replace: alpha` + `html: needle`
  could not be found by `needle`. Closed by `ContentSpec::collect_scalars`. The notes' claim that
  `fixtures.ts` re-transcribes the core's join faithfully was false — it added both forms where the core
  added one — and both the fixture and the sentence are corrected.
- **Medium 4 — an unreadable file gave a misleading total with no visible failure.** Real, and it
  contradicted the notes' own justification for computing `pending`, which was then never rendered. The
  browser reached `ready` showing "All 2" while a 100-match file had failed to the console alone. Closed
  with `BrowserState.loadFailures` and a localized partial-total block, and **read out of a running
  window** in both languages.
- **Medium 5 — a notice code was turned into a key rather than going through an accessor.** Real, and it
  is the rule CLAUDE.md §2 and this checkpoint both state. Closed with a `tSelectionNotice` accessor —
  and with a **new lint**, `scripts/lint/built-translation-keys.ts`, which refuses any `t(` whose key is
  not written literally. It immediately found a **second, older** instance in `LanguagePicker.svelte`
  that had survived two phases; that is now `tLocaleName`.
- **Low 1** — `buildSidebar()` added a `ConfigProfile`'s count to the total although `holdsMatches` is
  false for one. Closed by guarding the addition.
- **Low 2 — eight test names promised more than their bodies established.** All eight strengthened, one
  narrowed. **This is R24's corollary and its fifth occurrence**, and the sharpest instance is the
  reviewer's own: `does not wait for a profile, which holds no matches` never supplied a profile count,
  so it passed while `buildSidebar()` counted one — the same test the notes had cited as the reason
  experiment E was unnecessary. That claim is corrected too.
- **Low 3** — the "stub" detail pane already rendered `trigger` and `label` through list-oriented helpers
  that collapse several trigger forms, which 1c-2 would have had to undo. Reduced to notice, file and
  placeholder; its two field keys are gone.
- **The plural defect, found outside the review.** `browser.sidebar.snippetCount` was `"{count} snippets"`
  / `"{count} fragmentos"` with no singular, so a one-match file's tooltip read **"1 snippets"** and
  **"1 fragmentos"** — and the phase's own R32 evidence shows one-match files, so it was on screen.
  Closed with a `.one` / `.other` key pair selected on `count === 1`, which is correct for both languages
  and adds no dependency. Confirmed from a running window: `"1 snippet"` and `"1 fragmento"`.

**One defect was found by the re-run readings and deliberately left for 1c-2**: a file that could not be
read shows the same `–` / "Not read yet" marker as a profile nobody has projected, which conflates
*could not* with *have not*. Recorded in `1c-1-notes.md` §10.4.

## Phase 1b-2b review disposition

The review is
[`docs/reviews/phase-1b-2b-dictionaries-and-menu.md`](docs/reviews/phase-1b-2b-dictionaries-and-menu.md).
Seven findings, **two High**, and the phase was held open until every one was dispositioned — so no
commit holds a demonstrated defect. The full disposition, with the disabling experiment for each fix
and the one escape that is **narrowed rather than closed**, is `1b-2b-notes.md` §12.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | High | Six wire-visible enums — `ScalarStyle`, `LineEnding`, `FileKind`, `TriggerKind`, `ContentKind`, `VariableKind` — crossed the boundary with no dictionary entry and no accessor, deferred to 1c as "hole 3". A 1c component meeting `trigger.kind = "Single"` could only render a raw Rust identifier or invent an unchecked mapping | **Fixed, deferral withdrawn.** Six `CODE_ENUMS`/`VARIANT_COUNTS` rows, 33 keys per dictionary, six key builders, six `describe` functions, six reactive wrappers, six sample tables. Sixteen namespaces, 111 code keys. Hole 3 closed |
| 2 | High | The exhaustiveness check failed open three ways: `#[cfg(…)] Variant,` on one line, `A, B,` on one line, and a brand-new enum never added to `CODE_ENUMS` | **Fixed for the first two, narrowed for the third.** `crate::rust_source` parses with `syn` and lexes with `proc-macro2` (dev-dependencies of `src-tauri` only). Two new checks derive the expected enum set from source — every `Serialize`-carrying enum in both trees, every string-literal union in `types.ts`. **An enum a `macro_rules!` expands to still escapes**, demonstrated in notes §12.3 experiment 12E and recorded as hole 2 |
| 3 | Med | A version skew was refused *inside Tauri's command macro* — English prose, no `code` — and `main.ts` discarded the result, so the English default menu stayed up with nothing reported | **Fixed both halves.** The command takes an untyped envelope and validates it itself, answering `invalidMenuLabels` with `missing`/`unexpected` field names; `startMenuLocalization` consumes the result and `main.ts` holds no logic, which is what makes the path testable |
| 4 | Med | The `detail` guard was a name scanner, and `JSON.stringify(classifyFailure(x))` renders the string while naming no guarded identifier | **Fixed in the type, not the scanner.** The developer string left `IpcFailure`: non-enumerable, symbol-keyed, read only by `developerDetail()`, with `reportIpcFailure()` as its destination. `errors.test.ts` pins enumerability, so putting it back under any name fails. Notes §10's "a component that renders it fails `npm test`" was **withdrawn and rewritten** |
| 5 | Med | `{ ok: true }` was returned before `build_menu`/`set_menu` ran, so a failure inside the closure was unobservable | **Fixed.** `menu::on_main_thread` waits on a one-shot channel and answers the new `menuBuildFailed`. Waiting cannot deadlock — `tauri_runtime_wry::send_user_message` runs a main-thread post inline when already on the main thread, quoted in the notes. Hole 3 of §11.8 closed |
| 6 | Med | The menu literal scanner blanked a whole line when a block comment *began* on it, so `*/ let title = "Edit";` slipped a hardcoded English label past every check | **Fixed.** Check 1 lexes instead of masking; the masker survives only for the two checks where over-masking is a loud false positive, with a test pinning that direction |
| 7 | Low | `COMMAND_ERRORS` pinned nine samples against ten variants, so a code could have rendered `""` and "renders every command error" would still pass | **Fixed, and generalised.** All twelve codes are covered and asserted bidirectionally against `COMMAND_ERROR_CODES`; every sample table in `codes.test.ts` is now checked for completeness against its wire union **at compile time** |

The review additionally **confirmed as non-findings**: the capability decision (`"permissions": []`
is correct for an application command from a local origin with no ACL manifest); the architecture
rule; `identityWrongDocument`'s dictionary entries; and the source scanner failing loudly on a
rename.

## Phase 1b-2a review disposition

The review is [`docs/reviews/phase-1b-2a-ipc-surface.md`](docs/reviews/phase-1b-2a-ipc-surface.md).
Ten findings; **all ten closed before the phase was recorded complete**, so no commit holds a
demonstrated defect. The full disposition with the fix for each is `1b-2a-notes.md` §15.

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | High | `identityRecovery()` treated every stale revision as recoverable, and the claim that `DocumentPath` "survives a reparse" and keeps the selection was **false** — a sequence step is `PathSegment::Index(usize)`, so deleting an earlier match silently re-points the selection at a different one | **Fixed.** The three answers are returned as data; the false sentences are gone from `errors.ts`, `types.ts`, `error.rs`, `commands.rs`, the notes **and this file**; `a_document_path_is_positional_so_a_deletion_repoints_it` fails if the claim is reinstated |
| 2 | High | A non-UTF-8 path made serde's `PathBuf` serializer reject the response *after* the command returned `Ok`, so the webview got serde's prose instead of `{code, operands}` — falsifying `commands.rs`'s own module claim | **Fixed** in the core: `crate::wire::WirePath` backs all five wire path fields and all four path operands. Four tests, each asserting the premise (bare `PathBuf` **does** fail) before the fix |
| 3 | Med | `isCommandError()` narrowed to full operand types after checking only `code`, so `{code: 'identityStaleRevision'}` yielded guaranteed-`string` fields that were `undefined` | **Fixed.** A `COMMAND_ERROR_OPERANDS` table validates required operands and primitive shapes; surplus allowed for forward compatibility. The test that licensed the unsoundness was rewritten |
| 4 | Med | `wire_contract.rs` silently passed three concrete divergences: required→optional (`?` was stripped), nested operand names and types, and every frontend *error* interface | **Fixed** all three; hole 2 rewritten to the one thing left (the type text of read-model properties), with its owner named |
| 5 | Med | The no-mutating-command oracle was **one-directional** — registering `commands::save_match` and changing nothing else left the test green, though its name claims to check registrations | **Fixed.** `generate_handler!` parsed independently, compared both ways, six forbidden names asserted absent from both sets. The disabling experiment was run: the test failed, then reverted |
| 6 | Med | `CommandError`'s own enumeration was not mechanically exhaustive, and the notes claimed it was; `identityRecovery()`'s `default` absorbed new variants | **Fixed.** The enumeration test reads `error.rs`'s enum block; `default` → `const unhandled: never`; both false sentences corrected |
| 7 | Med | `DocumentId` is `u64` typed as TS `number`, so values above 2⁵³−1 collide | **Fixed** by stating and **asserting** the invariant: `MAX_EXACT_WIRE_INTEGER` checked at `mint()`, with a `#[should_panic]` test and a full numeric-field audit in notes §16 |
| 8 | Low | Three test names overclaimed what their bodies established — the project's own standing rule | **Fixed**: names narrowed, bodies strengthened (the exports set is now read from the module) |
| 9 | Low | The disabling-experiment table presented historical runs as evidence that the committed state cannot reproduce | **Fixed by honest relabelling.** A–G are marked unreproducible; H–M are new and were run against committed code |
| 10 | Low | Vitest callbacks breached the literal reading of CLAUDE.md's JSDoc / closing-comment rule | **Decided both ways** and recorded (notes §14): closing-bracket comments applied, per-callback JSDoc explicitly exempted with reasoning and an escalation path |

Codex additionally **confirmed as non-findings**: the core has no tauri edge; no mutating command
leaked in; `dispatch_check.rs`'s ACL claim is sound for Tauri 2.11.5 because `get_ipc_response` runs
the same `Webview::on_message` branch as production; the session mutex has no re-entrancy path; no
real-corpus content appears anywhere; and no user-facing prose escapes via `Display`.

## Phase 1b-1 review disposition

The mandatory once-per-phase adversarial review is
[`docs/reviews/phase-1b-1-shell-and-i18n.md`](docs/reviews/phase-1b-1-shell-and-i18n.md). Nine
findings, **two High**, and the phase was held open until every one was dispositioned — so, as with
every phase since `8989c16`, no commit holds a demonstrated defect.

| # | Finding | Disposition |
|---|---|---|
| 1 | **High** — the bundle declares macOS 11.0 but targets `safari16` and calls `Object.hasOwn` (Safari 15.4+), so the first render throws and the window is blank | **Closed, both sides.** The floor is now `13.0`, the release that ships Safari 16, because the *target* is the deliberate value and the plist was the mistake — `vite.config.ts`'s own comment already said the build "may assume a current macOS". `Object.hasOwn` → `Object.prototype.hasOwnProperty.call`, which costs nothing in the one function that runs before anything can report an error. `webview-floor.test.ts` fails if the two ever disagree again. |
| 2 | **High** — `core:default` is not minimal; it grants `image:allow-from-path` and `image:allow-rgba`, so a compromised renderer can read local image pixels, against the phase's claim of "no filesystem permission" | **Closed.** `"permissions": []` — provably sufficient, because the 1b-1 frontend calls no Tauri API. **Verified empirically by launching a production-mode binary**, not by argument. The notes §6 sentence that described `core:default` as minimal is corrected. 1b-2 adds back permissions one at a time, never a `*:default` set. |
| 3 | **Medium** — five hardcoded user-facing strings against CLAUDE.md §2 | **Split, and the split is on file.** *Fixed:* `NSHumanReadableCopyright` was the English sentence "MIT licensed. See LICENSE.", which Finder shows under a Spanish locale — it is now `© 2026 ccarpiog · MIT`, and it was never on the §8 exception list, so no argument had ever been made for it. `index.html`'s hardcoded `lang="en"` is now set from the detected locale by `bootstrap()` **before** mount, with an ordering test. *Upheld:* the two developer-facing messages (a missing `#app`, a webview that cannot be created) — both fire only where no interface exists to render a message **in**, and neither is user-triggerable. *Open:* the macOS menu — see the disagreement below. |
| 4 | **Medium** — the production CSP allows `'unsafe-inline'` styles, so injected markup can hide the interface and paint its own | **Closed.** Production `style-src 'self'`; the relaxed policy moved to `devCsp`, which is where it was ever true. The production bundle emits an **external** CSS asset, so it renders fully styled without it — checked, not assumed. |
| 5 | **Medium** — "the runtime tests cover whether a Spanish value is actually Spanish" is false; they establish only non-identity | **Closed as a correction to the claim, not to the code.** Renaming `language.label` to `"Sprache"` passes every check. The suite is renamed to the untranslated-value heuristic it is, and §2, §3 and two module doc comments are corrected with that counterexample written into them. Establishing that a value is *Spanish* needs a bilingual review gate and is recorded as a hole. |
| 6 | **Medium** — "follows the system" stops following: `system` is computed once, so a platform language change is ignored until restart | **Closed.** `createLocaleState` takes a tag *reader* and re-negotiates on `languagechange`; `dispose()` detaches the listener. Two directions are pinned, and the second matters more: a user who **chose** a language is never overridden by their OS. Experiment F breaks exactly that and fires. |
| 7 | **Low** — duplicate JSON keys bypass every compile-time and runtime check; a translator editing the first occurrence is silently discarded | **Closed.** `scripts/lint/duplicate-json-keys.ts` reads the **raw file text**, because a JSON parse cannot see it by construction. Proven on `es.json`: the compiler stayed silent, the other 22 dictionary tests passed, and only the scanner named the line. |
| 8 | **Low** — `the_core_crate_is_linked_and_callable` names a stronger property than it checks; the only core reference is inside `#[cfg(test)]` | **Closed by renaming**, which is the honest fix: `the_core_dependency_is_callable_from_the_test_target`, with a doc comment saying a production build does not yet reference the core. The notes already admitted this at §6; now the **name** admits it too. This is R24 reaching a test's name rather than its body. |
| 9 | **Low** — the required Node runtime is neither pinned nor declared; Vite 8 needs `^20.19.0 \|\| >=22.12.0` | **Closed.** `engines.node` declared, `.nvmrc` pins 26.5.0, and the notes record which runtime the suite was verified on. `engine-strict` deliberately not set — reason in notes §1. |

**One defect the review did not reach, found by the fix round, and it invalidated the phase's own
evidence.** `src-tauri/Cargo.toml` declared no `custom-protocol` feature, and `tauri::is_dev()` is
literally `!cfg!(feature = "custom-protocol")` — so every build loaded the dead `devUrl` and the window
1b-1 reported as "launched and stayed up" was **blank**. `npm run tauri build` could not have succeeded.
Separated from a frontend exception by planting a static `<h1>` in `dist/index.html` and watching that
fail too. **The lesson is R32's:** a process that stays up is not a screen that renders.

**One live disagreement, recorded rather than resolved by silence.** The reviewer's position is that the
phase should not close while the macOS menu is unlocalized, since CLAUDE.md §2 is non-negotiable. The
rebuttal is that Tauri v2 builds the default menu in Rust, so localizing it means either Spanish strings
in Rust — which plan §9 forbids in as many words — or handing labels across IPC, which needs a command,
which is 1b-2 by design. **1b-2 owes it**, it is hole 1 of notes §9, and both halves of the argument are
written there so a later session can overrule this one on the evidence.

---

## Phase 1a review disposition

Review of record: [`docs/reviews/phase-1a-core-read-model.md`](docs/reviews/phase-1a-core-read-model.md).
Its verdict: **"hold the phase open"** — *"match identity is positional in practice, and the strongest
'no unknown key is lost' oracle cannot detect whole omitted mappings. Both violate explicit Phase 1a
gates."* It was right on both counts, and the phase was held open until all five findings were closed.
**No commit holds the demonstrated defect.**

| # | Finding | Disposition |
|---|---|---|
| 1 | **Match identity is positional after a reparse, and its test never performs a reorder.** `NodeId` is the parser arena index and `DocumentId` was the sorted-enumeration position, so exchanging two equally shaped matches hands `:a`'s identity to `:b`; separately, adding an alphabetically earlier file re-points a retained `DocumentId` at another file | **Adopted in full — this is D2v.** `MatchId` carries the parse's `ContentRevision` and `match_by_id` returns `Result<_, IdentityError>`; `DocumentId` comes from a monotonic session counter keyed by path. Both reviewer counterexamples are **retained tests**, and the mis-named test was renamed to what it actually does. Disabling experiments A and B reproduce the reviewer's two sequences verbatim with the guards removed. |
| 2 | **Keys nested under an unknown entry are neither modelled nor recorded, and the coverage oracle passes vacuously** — records exist only for mappings the schema walk chose to scan, so omitting one entirely is invisible to `all()` over emitted records | **Adopted in full — this is D2w.** The unknown entry's whole value span is recorded, the claim is restated as *named or inside a recorded undescended span*, the **library** checks it (`unaccounted_keys` → `KeyNotAccountedFor`, per R24), and the test oracle now derives its expectation from the **document tree**. Experiment C1 suppresses a record's *creation* and fails both corpus sweeps — which the old audit could not see. |
| 3 | **`load_from_source()` lets an unsaved draft replace Rust's disk snapshot**, contradicting plan §6.4's ownership split; and the API is not yet one-to-one wrappable (`WorkspaceError` unserializable, no `get_match`) | **Adopted in full.** The method is **deleted**, not hidden — its one test now compares `project_source` against the disk path. `WorkspaceError` and `DiscoveryError` gained hand-written code-plus-operand `Serialize`; `Workspace::get_match` added. `SourceDocument` stays unserializable **by design**: `DocumentView` is what crosses the boundary. |
| 4 | **The D2u oracle has a false-negative branch** — text is compared only when `scalar.decoded` is true, so `text = "true"` with `decoded = false` over source `on` escapes | **Adopted.** Text is compared whenever `decode()` succeeds, plus a clause refusing a decodable scalar labelled undecoded. Experiment D constructs the reviewer's exact pair. No production violation was demonstrated; the oracle's *claim* was broader than its enforcement, which is the same defect class in a smaller box. |
| 5 | **Non-scalar items inside a scalar sequence are diagnosed but dropped**, contradicting the doc comment and shifting the positions of the remaining elements | **Adopted, by fixing the implementation rather than the documentation.** `triggers`, `search_terms`, `depends_on` and `imports` are `Vec<ValueView>` and elide such an item **in place**, so positions never shift. Losing positional correspondence in a read model is the kind of thing a later phase silently builds on. |

**Pinned counts moved: none.** All 33 `SYNTHETIC_PROJECTIONS` rows are byte-identical after the fix
round — an elided item contributes no scalar, and neither did a dropped one — which is the desired
outcome for a fix that changes structure rather than content. The new diagnostics are pinned at 0.

**The lesson, and it is the third occurrence.** R24's failure mode — a property whose only home is a
test file, or a test whose name claims more than its body checks — was found here by a *reviewer* rather
than by the phase. Two of the five findings are instances of it: a test called
`…survives_a_reordering` that never reordered, and a coverage audit that could only see what the
implementation had already chosen to tell it. **Both were closed by moving the check into the library
and re-deriving the test's expectation from the document tree**, which is the same shape as every prior
closure of R24.

---

## Phase 0c-3b-2b review disposition

Review of record: [`docs/reviews/phase-0c-3b-2b-the-gate.md`](docs/reviews/phase-0c-3b-2b-the-gate.md).
Its verdict: **"The gate is not genuinely passed."** It was right, and the phase was held open.

| # | Finding | Disposition |
|---|---|---|
| 1 | **High — E5 is a production safety hole and blocks the gate.** A removal swallowing an unowned following blank line passes every production check, and `bytes_outside_the_replacements_match` *authorises* it from the envelope's own declaration; only the test sweep saw it | **Adopted in full — this is D2t.** `RemovalCarriesMoreThanTheEntry` derives the entry's allowed line runs from the key/value frontier, the leading-trivia rule and D2o's blank-run rule, consulting nothing `removal_envelope` produced. E5 re-run is now rejected **by production**; E5b shows the sweep's bound still fires independently. |
| 2 | **Medium — the tag oracle has concrete false negatives, and "0 gaps" is circular** (the test compared the function against a predicate calling it) | **Adopted in full.** All four named errors fixed — `2001-1-1`, oversized sexagesimals, `+0o17`, and the `012` documentation (the *code* was verified correct, so the docs were corrected instead). A second independent transcription of the 1.1 half now sweeps 500 000 generated values with **zero disagreements**, plus 77 hand cases. §4.1's overstatement withdrawn. |
| 3 | **Medium — the matrix proves document co-occurrence, not operation × construct interaction**; `RefusedOnly` is 8 not 5; and the real sweep is *sampled* (`REAL_CORPUS_STRIDE`) | **Adopted in full.** Attribution is operation-local for structural axes; four rows moved `Applied` → `RefusedOnly`; the true count is **18**, enumerated cell by cell and asserted against the measurement. **The stride is gone** — the sweep is exhaustive, bought by the memoisation R19's row records. |

The third finding is the one worth remembering: the checkpoint had explicitly instructed *"memoise rather
than thin the sweep"*, and the phase thinned it anyway, which turned the plan's exit criterion into a
weaker claim wearing the criterion's words. Memoising made the sweep **exhaustive and twice as fast**, so
the instruction was not merely principled — it was cheaper.

---

## Verification — Phase 2c-3a step 1

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report, and re-run after each of the three review rounds. The figures are the final run.

| Command | Result |
|---|---|
| `npm test` | **1116 passed, 40 files** (from 1020 over 38 at the 2c-2-2 checkpoint) |
| `npm run check` | `399 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS` |
| `npm run build` | exit 0, **161 modules** |
| `rg -c 'svelte/internal/server\|node:async_hooks' dist/assets/*.js` | no match — **not** the `resolve.conditions` regression |
| `git status --short` | no `.svelte` file, no Rust file, no corpus file |

**The module guard moved 158 → 161 and the delta is honest**: exactly three new source modules
(`matchCreation.ts`, `matchDeletion.ts`, `typing.ts`), each reaching the bundle through
`i18n/index.ts`'s three new accessors. `vite.config.ts` was not touched, and the bundle was checked
for the server build rather than the count being trusted — a jump to ~180 with
`svelte/internal/server` present is the regression, and it is absent.

`cargo test --workspace` was **not** re-run and does not need to be: this step wrote no Rust, which
`git status` confirms rather than the worker's report. It stands at **1008**.

**One frontend claim was checked against Rust rather than assumed.** Destination eligibility asks
whether a file has a match list, and `matchCreation.ts:301` reads
`view.top_level_keys.some((key) => key.text === 'matches')`. `match_list_of` in
`src-tauri/src/commands.rs:947` reads `view.top_level_keys.iter().any(|key| key.text == MATCH_LIST_KEY)`
with `MATCH_LIST_KEY = "matches"`. Same field, same literal, same comparison — so the affordance
cannot disagree with the authority it defers to. The literal is duplicated because nothing on the
wire carries the name; the module says so.

**What this verification does not cover, and it is two thirds of the phase's evidence.**
`2c-split-notes.md` §7 requires three kinds, and step 1 has one: **the model tests**. There is no
mounted-component test and **no window reading**, because no `.svelte` file was touched. Per
`1c-1-notes.md` hole 1 and 2c-1b's own conclusion, a green suite is not a screen — nothing in this
project renders a Svelte component in an automated test except the three files that opt into jsdom
by docblock. **Step 2 owes both, and until it is done no claim may be made about what any of this
looks like in a window.**

---

## Phase 2c-3a step 1 review disposition

**Three Codex rounds, ten findings, all closed before the commit.** The shape of the rounds is the
finding worth remembering, more than any individual defect: *each round's fix produced the next
round's finding.*

**Round 1 — the aggregate code review** (`docs/reviews/phase-2c-3a-1-code.md`, `NOT READY`):

| # | Finding | Disposition |
|---|---|---|
| 1 | **High — creation consent survived a retarget.** A create refused in file A at `End` could have its findings acknowledged, then be redirected to file B or `Front`, and `beginCreate` reused the old acknowledgement because the drafted buffers had not changed | **Adopted.** `chooseDestination`/`choosePlacement` now withdraw the submission, outcome, extra lines and consent; a destination change re-points the base through the new `retargetedDraft`. A placement equal to the one held is not a change |
| 2 | **High — the wrapper silently rebased a stale form.** `createMatch`/`deleteMatch` took no `baseRevision` and sent `view.revision` read at call time, so a form opened at R0 and submitted after the window reached R1 was committed against a parse it was never based on | **Adopted.** Both now take a `baseRevision` and forward it unchanged. **The record's own hole 3 was wrong** and was rewritten: it argued the disagreement was decided by "the command's own conflict check", and the original base never reached that check |
| 3 | **High — an identity resolved across revisions by node alone.** `positionOf` compares only `node`, so an R1 `moved` could resolve against a fresh R2 projection that had reused the arena slot, selecting an unrelated snippet as the one just created | **Adopted.** New `positionInSameParse` (document + revision + node), used by `adoptTheCreatedSnippet` **and** by `adoptTheDocumentOnDisk`, which serves `saveMatch` and `moveMatch` |
| 4 | **Medium — a save's adoption could be undone by an in-flight selection lookup**, replacing the mandated `deleted` notice with `differentMatch` — telling the person their file moved under them when what happened is the deletion they asked for | **Adopted**, and the fix was itself wrong. See round 2 |
| 5 | **Medium — a reload did not really invalidate pending deletion consent.** `confirmDelete` compared the pending identity against the session's own — two values minted together — so a retained session across a reprojection kept both stale **and equal**. The test manufactured a changed `session.match` and never drove the real path | **Adopted, enforced not narrowed.** `confirmDelete(session, projected)` takes the identity the **current projection** gives that snippet and compares four values; the test drives the retained-session path |
| 6 | **Low — not every open file was offered** as a destination; `destinationsOf` mapped projections, so a file the sidebar names as unreadable vanished from the list | **Adopted.** It maps summaries; a fifth typed refusal `couldNotBeRead` in both dictionaries |

**Round 2 — the confirmation pass** (`docs/reviews/phase-2c-3a-1-confirmation.md`, `NOT READY`):

| # | Finding | Disposition |
|---|---|---|
| 1 | **High — and it was round 1's own fix.** Finding 4 had been closed with one **global** `selectGeneration` bump inside `installView`. A projection replaced in file B therefore killed a pending `select()` for file A, which returned without repairing, **stranding a `MatchId` that names nothing** — this sub-phase's declared worst failure mode, reached from the other side. Every deferred test used one document, so the suite was green for an unrelated reason | **Adopted.** The counter was split in two: a per-document `projectionGenerations` map bumped only by `installView` and `forgetTheReplacedDocument` for their own file, and the global counter kept as *selection intent*, bumped by a new `replaceSelection` through which every write to `selected` passes |
| 2 | **Medium — the deferral was justified by a caller that does not exist.** The record said fixing `saveMatch` and `moveMatch` needed a `.svelte` edit; `BrowserState.moveMatch` has **no production caller at all**, and `matchEditor.baseRevisionOf` is unused | **Adopted.** `moveMatch` now takes and forwards a `baseRevision`; only `saveMatch` is left to step 2, with the true reason. Its other latent shapes are re-recorded as 2c-3b's scope — **not** as blocked by a component |
| 3 | **Low — the record said `draft.ts` was unchanged** after the fix round added two transitions to it, concealing a change to the spine both other editors draft over | **Adopted**, rewritten as the two halves it has |

**Round 3 — a scoped pass over the round-2 refactor alone**
(`docs/reviews/phase-2c-3a-1-third-pass.md`, `NOT READY` on one **Low**): the invariant comment on
`replaceSelection` claimed one deliberate exception when there are two (`select()`'s and `open()`'s),
in the one place a maintainer would look for permission to add a third. Adopted: both are enumerated,
and the comment now says in the same sentence that the list is maintained by hand and that TypeScript
enforces nothing here.

That pass also **settled an open probe** rather than only finding a defect. Round 2's implementer had
honestly reported that dropping the projection half of `selectionLookupIsStale` failed no test. The
answer is that it is redundant in **every reachable ordering**, not merely the tested ones — a live
lookup makes its document the held selection before awaiting, and every same-document invalidation
then synchronously repairs or replaces that selection, bumping the intent counter. So **no honest test
can isolate it**, and none was written pretending to. It is kept as defensive redundancy and
`2c-3a-1-notes.md` §8.2 says so, including the fact that deleting it would break no test today — so
that deleting it is at least a decision.

**Why three rounds.** Two would have shipped the cross-document identity-stranding bug: it was
introduced by the fix for round 1's finding 4 and found only by looking again. The third round was
commissioned for that reason alone and scoped to that one change — the selection machinery serves
every operation in the application, not only this step's two.

---

## Verification — Phase 2c-2-2

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report. Each was re-run after every fix round and after every window reading; the table
records the final run.

| Command | Result |
|---|---|
| `npm test` | **1020 passed, 38 files** (974 / 36 after 2c-2-1; 1007 / 1014 / 1017 at the three reading boundaries) |
| `npm run check` | 394 files, **0 errors, 0 warnings, 0 files with problems** |
| `npm run build` | exit 0, **158 modules** — the guard moved by exactly two, see below |
| `cargo test --workspace` | **1008 passed, 0 failed** — unmoved, because **no Rust was written** |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | no output — the architecture rule holds |
| dictionary keys | **544 in each language** (513 before), parity clean; 31 keys added, one reworded |
| `git status --short --untracked-files=all` | changes only under `src/lib/`, `docs/` and `CLAUDE.md`; **nothing under `src-tauri/` or `crates/`, no corpus path, no probe artefact** |

**The 156-module guard is now 158, and the shape of the move is the check rather than the number.**
The two are `src/lib/components/MatchEditor.svelte` and `src/lib/browser/matchEditor.ts` — the latter
existed after 2c-2-1 but **no component imported it**, so it was tree-shaken out of the production
bundle. `+2` is exactly the number of source modules a screen over an existing model adds. The bundle
was searched for `svelte/internal/server` and `node:async_hooks`: **neither is present**, and
`vite.config.ts` was not touched. The regression this guard exists for is a jump to ~180 *with the
server build pulled in*. **Rebaseline by building a pristine `git archive HEAD` copy and subtracting;
never by editing the `resolve.conditions` condition.**

**The window readings are the third kind of evidence and they are not ceremony.**
`docs/decisions/2c-2-2-window-reading.md` records **four passes, 26 launches**, one plan per launch
into a fresh bundle path over a freshly rebuilt configuration. Every launch reached its own `--- end`
and every `probe.err` was zero bytes. They found **four defects the 1017-test suite, `svelte-check`
and the first Codex pass had all missed**. The probe was removed four times, once per pass;
`src/main.ts` and `src-tauri/src/main.rs` were each restored from copies taken **before** the probe
first existed and compared with `diff` — `IDENTICAL` every time — and every scratch path lived
outside the repository. **The owner's real configuration was never opened**: every fixture was
synthetic and hand-written for the run.

---

## Phase 2c-2-2 review disposition

Two Codex rounds, both saved in full: `docs/reviews/phase-2c-2-2-code.md` (four findings) and
`docs/reviews/phase-2c-2-2-confirmation.md` (all four confirmed fixed, three more). **Both returned
`READINESS: NOT READY`. All seven were fixed before the commit**, as were the four the window
readings found and the two the implementer's own audit found afterwards. The record is
`docs/decisions/2c-2-2-notes.md`; the readings are `docs/decisions/2c-2-2-window-reading.md`.

| # | Finding | Disposition |
|---|---|---|
| 1 | **High — `DetailPane` captured the match but read `file` reactively**, so opening the editor over a snippet of file A and then selecting file B put B's name on the header while every byte a save would write still went to A | **Adopted.** `MatchEditingSession { match, file }` is captured in **one assignment**; the header uses the captured file. `DetailPane.test.ts` exists for this one claim and is mounted over a **real** `createBrowserState` — a stub is not reactive, so the case would have passed before the fix as loudly as after it |
| 2 | **Medium — reprojection was optional.** *Dismiss* cleared the outcome through `keepEditing` and resumed editing on eligibility carried over from bytes the commit had replaced | **Adopted.** `needsReprojection` is a field on `MatchEditorSession`, set by a commit and cleared by **nothing** but `startMatchEditor` over a fresh projection; `isEditable` is `false` while it is `true`; the committed panel offers the re-seed and **no *Dismiss*** |
| 3 | **Medium — the `failure === null` invariant was a comment, not a type.** `{ kind: 'failed', mayHaveWritten: true, failure: null }` type-checked | **Adopted.** `MatchSaveAnswer` has three arms: `answered`, `notAttempted` (no fields, because nothing was sent) and `failed` with `failure: IpcFailure` **required**. This is the prohibited class *a record claiming a guarantee the code does not give*, in a published type |
| 4 | **Low — a mounted test claimed 21 fields unchanged while sampling five** | **Adopted.** `UNTOUCHED: MatchDraft` is an exhaustive typed literal; a twenty-third required property is a compile error |
| 5 | **Low (confirmation) — the caption claimed every refused value is shown "as the file writes it"**, while a `notScalar` arm renders only a localized shape name | **Adopted.** A caption **per arm**: `browser.detail.valueAsWritten` on a `text` arm, the new `browser.matchEditor.shapeOnly` on a `notScalar` one. The blanket caption is gone from the DOM, not overridden |
| 6 | **Low (confirmation) — `unmodelledShape` said the app "cannot show what it holds"** while the component draws `UnknownEntry.value_text` above it | **Adopted, and deliberately not reworded to "the value is shown"** — `shownValuesOf` answers `[]` when `value_text` is empty. It now says the app cannot **edit** the key as one text field and will not write over it, which is true in both cases |
| 7 | **Low (confirmation) — `cannotReproject` gave one cause where three are possible** | **Adopted, as a typed reason rather than a vaguer sentence.** `Reprojection` answers `projected` or `unavailable` over `ReprojectionRefusal = notProjected \| otherFile \| otherSnippet`; the three states have three different ways out, so a neutral sentence would be true and useless |

**Four more came from the window readings, and no test could have.**

| # | Finding | Disposition |
|---|---|---|
| R1 | **A `triggers:`-list snippet's triggers were invisible.** A refused field drew its name and its reason with nothing between them, and D10 replaces the whole detail pane — so the triggers appeared **nowhere in the window**. Measured as `open triggersOnScreen: no` | **Adopted.** `FieldBaseline.shown` / `shownValuesOf`: one entry per trigger, `regex:` included, a non-scalar item **named** rather than dropped |
| R2 | **`shownValuesOf`'s doc claimed "source order" while the code read three fixed slots**, so a file writing `regex:` above `trigger:` drew them the wrong way round | **Fixed in the code, not in the sentence.** Forms are placed by the **first byte of each form's value**; a `triggers:` list's own items are never re-sorted. Weakening the doc was available, correct and cheap — and would have shipped a screen that misorders a snippet's own trigger forms |
| R3 | **The shown boxes were unlabelled**, so a `Several`'s trigger and regex were indistinguishable with the pane that names them off-screen | **Adopted.** `ShownValue.source` rendered with `tDetailField` — the detail pane's own strings, no new key. `tTriggerKind` will not do: it names the whole spec's shape, not a slot |
| R4 | **The unlocated-form branch is unreachable from the projector**, while the doc sold it as a live fallback with a named trigger | **The branch was kept and the comment corrected.** `scalar_sequence()` at `crates/espansoconfig-core/src/model/project.rs:143` emits only `Scalar` or span-bearing `Elided`, so `position: null` cannot arise today — but `ValueView` has five arms and a `MatchView` is a **boundary value** nothing in TypeScript proves came from that writer |

**And two the implementer's own audit found**, after both Codex rounds had passed over them:
`browser.matchEditor.discardWarning` was drafted with the raw editor's *"Your changes have not been
written to the file"*, which is **false** after a `mayHaveWritten` send failure; and the
`fieldRemoved` marker was gated on the buffer's `removed` flag, so it went on promising a future
write after a **committed** removal. It is now gated on `field.intent === 'Remove'`.

**Eight of the thirteen rows above are this project's named worst defect class** — a record, comment
or string claiming a guarantee the code does not give — plus one the tables do not list, the
`matchEditor.ts` module header that said the carriage return is refused *twice* while three gates
existed. That is instances five through thirteen, across three phases (2c-1a had two, 2c-2-1 had
two), and the new thing about this phase is **where** they were: the first three rounds found them in
comments, the last two found them in **sentences a person reads**. Nothing in the test suite,
`svelte-check`, the i18n parity tests or the markup scan can fail on that — every one of those checks
that a key exists and is translated, and every false key existed and was translated.

**One latent instance was found and deliberately not changed.**
`browser.rawEditor.discardWarning` carries the identical false wording and is reachable the same way.
It is 2c-1b's published string and its markup is outside this cut; fixing it here would oblige a
re-take of 2c-1b's window reading for a string this phase does not draw. It is hole 12 of
`2c-2-2-notes.md` §4 rather than a silent carry-over.

**The readings and the reviews found different things and neither subsumes the other.** Codex found
three of the four code findings by reading types; the readings found four defects no type could
express. The fourth reading found nothing, which is what a reading looks like when the fixes are real.

---

## Verification — Phase 2c-2-1

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report. Each was re-run after **both** fix rounds; the table records the final run.

| Command | Result |
|---|---|
| `npm test` | **974 passed, 36 files** (894 / 35 before the phase; 963 and 971 at the two fix rounds) |
| `npm run check` | 391 files, **0 errors, 0 warnings, 0 files with problems** |
| `npm run build` | exit 0, **156 modules** — the guard rebaselined, see below |
| `cargo test --workspace` | **1008 passed, 0 failed** (1007 before — exactly the one Rust test this step added) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | no output — the architecture rule holds |
| `git status --short --untracked-files=all` | changes only under `src/lib/`, `docs/` and `crates/espansoconfig-core/tests/`; **nothing under `src-tauri/`, no corpus path, no probe artefact** |

**The 154-module guard is now 156, and it was rebaselined by measurement rather than by assumption.**
A pristine `git archive HEAD` copy was extracted, given a symlinked `node_modules` and built: it
prints **154**, so the delta is exactly the two new source modules (`matchEditor.ts` and
`editorSave.ts`, both reached from `i18n/index.ts`). The bundle was then searched for
`svelte/internal/server`, `payload.out` and `async_hooks` — **none present**. The guard's real
signature is a jump to ~180 *with the server build pulled in*; that is absent, `vite.config.ts` was
not touched, and the number moved by exactly what a new module costs. **Rebaseline this way or not at
all; never by editing the condition.**

---

## Phase 2c-2-1 review disposition

Two Codex rounds, both saved in full: `docs/reviews/phase-2c-2-model-code.md` (the aggregate review,
five findings) and `docs/reviews/phase-2c-2-model-code-confirmation.md` (the confirmation pass over
the fixes, two more). **Both returned `READINESS: NOT READY`. All seven were fixed before the
commit.** The design consult that preceded the code is `docs/reviews/phase-2c-2-design.md`.

| # | Finding | Disposition |
|---|---|---|
| 1 | **High — `BrowserState.saveMatch` collapsed every command failure to `null`**, discarding the `mayHaveWritten` bit, so a `SyncDirectory` failure after the rename was indistinguishable from `noWorkspaceOpen` and could be reported as *nothing was written* | **Adopted.** `saveMatch` answers `MatchSaveAnswer` — `{kind:'failed', mayHaveWritten}` or `{kind:'answered', result, adoption}` — mirroring `RawSaveAnswer`. The `null` return is gone. This is the prohibited class *a committed or possibly-committed write reported as an error*, reached again by a new route |
| 2 | **Medium — a failed reprojection left stale projections and identities installed** while still returning the committed result, contradicting the adoption guarantee the notes claimed | **Adopted.** `adoptTheDocumentOnDisk` now *returns* the failure; `saveMatch` calls `forgetTheReplacedDocument`, puts `adoption: {kind:'failed'}` **beside** the committed outcome, and `applySave` takes it as a required third argument and adds the `windowOutOfStep` line beside — never in place of — the saved arm |
| 3 | **Medium — no carriage-return gate at save time**, though `MatchBuffers` is unbranded, so `{ Set: "a\rb" }` could reach the wire | **Adopted.** `beginSave` refuses when the **derived draft** would write a `\r` — the derived draft and not the buffers, because a CR-refused field legitimately holds one in its buffer while sending `'Unchanged'`, and gating on buffers would refuse every save on such a snippet |
| 4 | **Low — identity adoption dragged the selection back** to the saved match even when the selection moved while the save was in flight | **Adopted.** Adoption takes the pre-save target identity and re-points only when the held selection is still that snippet; `moveMatch` inherits it |
| 5 | **Low — a net-zero typing burst left a ghost undo step** that changed nothing | **Adopted.** `amendDraft` drops the step it replaces when the replacement equals the step immediately before it, restoring that step's value *and* generation |
| 6 | **Medium (confirmation pass) — `saveMatch` invalidated `fileTextAnswer` but not the separate `conflictText` cache**, so a raw-conflict capture of version A survived a field save that committed version B — and the notes said all raw text was dropped | **Adopted.** `forgetConflictText` / `forgetTextOf` added and called on all three state-changing paths; `forgetTheReplacedDocument`, whose comment claims to be total for one document, drops it too, so that claim became true as well |
| 7 | **Low (confirmation pass) — collapsing a net-zero group could not restore an undo entry the group's own bounded push had already evicted** at the 100-step bound | **Adopted, with the cost stated.** `pushBounded` answers what it dropped, `Draft.evicted` retains it for exactly one group, and every boundary a collapse cannot follow releases it. Worst case moves from 100 retained steps to 101, said in the code comment, in `Draft.evicted`'s doc and as notes hole 10 |

**Findings 6 and 7 exist because of the fixes to 1–5** — the confirmation pass earned its round trip,
exactly as 2c-1b's second pass did. **Run one; the pattern is now twice-attested.**

**Two of the seven were the decision record claiming a guarantee the code did not give** (findings 2
and 6), which is this project's named worst defect class and the one no test can fail. That is the
third and fourth instance across two phases. The notes were swept afterwards rather than patched at
the two named sentences, and the remaining guarantee sentences — the wrapper bypass, *nothing forces
a caller to read `adoption`*, *eligibility is not re-derived*, *the gate cannot explain itself* —
were each confirmed to state their limit in the same sentence as the claim.

**The falsification check is the evidence that the tests are real**, and it was run for both rounds:
with the fixes reverted, exactly the named tests fail (8 of 185, then 3 of 188) and nothing else.

---

## Verification — Phase 2c-1b

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report. Each was re-run after **every one of the three fix rounds**; the table records the
final run.

| Command | Result |
|---|---|
| `npm test` | **894 passed, 35 files** (821 before the phase; 868 / 883 / 892 at the three fix rounds) |
| `npm run check` | 388 files, **0 errors, 0 warnings, 0 files with problems** |
| `npm run build` | exit 0, **154 modules** — the regression guard, see below |
| `cargo test --workspace` | **1007 passed, 0 failed** — *unchanged*, and run to prove it |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `git status --short --untracked-files=all` | changes only under `src/lib/`, `docs/`, `vite.config.ts` and the two package files; **no probe artefact, nothing under `crates/` or `src-tauri/`** |

**The baseline was verified before the phase, not assumed**: `npm test` 821 passed / 33 files and
`cargo test --workspace` 1007 passed were both run at the head of the session, so the +73 frontend
tests are measured against numbers this session observed.

**154 modules is a regression guard, not decoration.** A first attempt at the jsdom decision set
`resolve.conditions` unconditionally; that option *replaces* Vite's defaults, so the production
build silently went to 180 modules and pulled in Svelte's **server** build. Nothing failed. The
module count is checked on every round because it is the only cheap signal that the test and
production resolution paths have not diverged again.

**`cargo test --workspace` is in the table although this phase wrote no Rust** — that is the point
of running it. 2c-1b's claim is that the raw editor needed zero new Rust, and an unchanged 1007 is
the evidence.

**What this table does not establish, and cannot — and this phase is the proof.** The window
reading found **two real defects that 883 passing tests, `svelte-check` and two Codex passes had
all sailed past**, one of which silently rewrote every line ending in a user's file. A green table
is not a screen. The three kinds of evidence `2c-split-notes.md` §7 requires were all taken:
model tests, this project's **first mounted-component tests**, and **two window readings** — the
second because the first one's findings changed three components, and a claim about a screen needs
a reading of a screen.

**Three things the readings did not reach**, recorded as holes rather than rounded up: the
indeterminate `mayHaveWritten` arm (it needs a failure in the microseconds between rename and
read-back), `windowOutOfStep`, and `committed: false` from this screen — the last unreachable by
design, and read rather than merely argued. Whether the shipped WKWebView refuses
`navigator.clipboard` is **unsettled**, not answered: the machine's screen was locked for both
runs. It needs a human at an unlocked machine.

---

## Verification — Phase 2c-1a

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report. Each was run **twice** — on the implementation and again after the review fix
round — and the table records the second run.

| Command | Result |
|---|---|
| `npm test` | **821 passed, 33 files** (738 before the phase; 797 before the fix round) |
| `npm run check` | 384 files, **0 errors, 0 warnings, 0 files with problems** |
| `npm run build` | exit 0, 150 modules |
| `cargo test --workspace` | **1007 passed, 0 failed** — *unchanged*, and run to prove it |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `git status --short` | changes only under `src/lib/` and `docs/` |

**The baseline was verified before the phase, not assumed**: `cargo test --workspace` 1007 passed
and `npm test` 738 passed were both run at the head of the session, so the +83 frontend tests are
measured against a number this session observed.

**`cargo test --workspace` is in the table although this phase wrote no Rust.** That is the point
of running it: 2c-1a's whole claim is that it is TypeScript-only, and an unchanged 1007 is the
evidence. `git status --short` is in the table for the same reason — it is what shows no `.svelte`
file, nothing under `crates/` and nothing under `src-tauri/` was touched.

**What this table does not establish, and cannot.** Nothing in this project renders a Svelte
component in an automated test, and 2c-1a **draws nothing** — no component, no screen, no window
reading. So none of these 821 tests is evidence about a screen, and the phase does not claim to
be. The three kinds of evidence `2c-split-notes.md` §7 requires of every 2c sub-phase are owed
in full by **2c-1b**, which is where the first mounted-component test and the first window reading
of an editing screen both land.

---

## Verification — Phase 2b-2c-3b

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report. Each was run **twice** — on the implementation and again after the review fix
round — and the table records the second run.

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | **1007 passed, 0 failed** (1001 before the phase) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | **no output** — the architecture rule holds (D2x) |
| `npm run check` | 378 files, **0 errors, 0 warnings** |
| `npm run build` | exit 0 |
| `npm test` | **738 passed** (702 before the phase; 728 before the fix round) |
| `git status --short` | nothing under `tests/corpus/`, nothing under `tests/corpus/real/`, `package-lock.json` unmodified |

The Rust total is unchanged across the fix round because two of the four findings were **test
strengthening rather than new tests**: the dispatcher test that claimed to read the disk and the
acknowledgement-mismatch test that compared three operands and named four. The frontend total moved
728 → 738: two tests for the High and eight for the workspace state the Medium forced into existence.

### Phase 2b-2c-3b review disposition

The aggregate code review is `docs/reviews/phase-2b-2c-3b-code.md` and it returned
**`READINESS: NOT READY`** — one High, one Medium, two Low. **All four were fixed before the commit**,
so, as with every phase since `8989c16`, no commit holds a demonstrated defect. The review explicitly
cleared everything else it was asked to attack: the single write entry point, the omission of
`view_at`, the acknowledgement binding, `moved: null`, the error-channel rules, the absence of a
`force` flag, the localization, the no-position case, the four unchanged `run_one_save` callers and
the retabulated contract checks.

| # | Severity | What was actually wrong | How it was closed |
|---|---|---|---|
| 1 | **High** | `saveRawDocument` awaited the caller's `reload` **after a committed write**, inside a `Promise<CommandResult<SaveResult>>`. A rejecting callback threw past the return type: the successful `Saved` was hidden and a caller could retry a write that had already happened. **This is D2 — *a committed write is never afterwards reported as an `Err`* — broken in TypeScript**, an invariant written for the Rust side that the boundary layer had just violated | The wrapper now answers a boundary type `RawSaveOutcome` whose success arm **always** carries the `SaveResult`, beside a required `reload` discriminant — `notOwed` / `done` / `failed`, the last carrying a `classifyFailure`-classified `IpcFailure`. The call is wrapped in `try`/`catch`, so a failing reload can neither reject nor be swallowed. `SaveResult` and `moved: null` are untouched (consult Q3). Two tests pin both halves |
| 2 | Medium | The required callback made **omitting an argument** a compile error, not **ignoring the obligation**: `() => {}` compiles, and the phase's own tests passed exactly that. An asynchronous body could also expose stale projections before invalidating — `await` only protects code after the *caller's* await | `BrowserState.saveRawDocument` now exists in `src/lib/browser/workspace.svelte.ts` with **no callback parameter**, passing its own invalidation: `forgetTheReplacedDocument` runs **synchronously, before any `await`** (drops the projection from `views`, drops the selection, bumps the selection generation, forgets the raw snapshot), then `adoptTheReplacedDocument` re-reads and re-resolves positionally-and-checked, because a replacement has no identity to re-point with. Eight new state tests. No `.svelte` file was touched |
| 3 | Low | The dispatcher test claimed to inspect **bytes on disk** but called `document_text`, which may serve the workspace cache — it would pass if a future command updated cached text without persisting it | The temp directory is retained and `std::fs::read` is compared directly, at all three points (commit, refusal, acknowledged commit) |
| 4 | Low | The command-layer acknowledgement-mismatch test said it proved the two findings had **identical parser stopping points**, but compared only `span`, `node` and `path` before asserting the whole codes differ. It would still have passed if `line`, `column`, `byte_index` or `detail` differed — in which case `revision` would not be what distinguished them | Both codes are destructured, every non-`revision` operand is compared, and each `revision` is checked against `ContentRevision::of_bytes` of **its own** candidate before inequality is asserted |

**The design consult was not re-commissioned**, per the standing instruction: `docs/reviews/phase-2b-2c-3-design.md`
covers the whole of 2b-2c-3 and the owner's ruling overriding its Q2 is appended to it. **A second Codex
round-trip to confirm the fixes was deliberately not taken** — the four fixes are small, each followed the
review's own stated minimal fix, and the orchestrator read the High's fix directly rather than accepting a
report of it. That is a recorded judgement call, not an oversight: a confirmation pass would be the honest
thing if a fix had *departed* from what the review prescribed, and none did.

---

## Verification — Phase 2b-2c-3a

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report. Each was run **three times** — on the implementation and after each of the two
review fix rounds — and the table records the third run.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` | ✅ **1001 tests**, 0 failed (**+18** on 2b-2c-2's 983: +13 for the mode, +3 for the backup fix round, +2 for the acknowledgement fix round) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed — no fixture lost a distinguishing byte, and none was added |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test draft_plan -- every_match_of_the_real_configuration` | ✅ **not a vacuous skip** — 13 files, 65 matches, 417 intents, **0 refusals**, unchanged by this phase |
| `npm test` | ✅ 29 files, **702 tests**, 0 failed (+2 on 700) |
| `npm run check` | ✅ 376 files, 0 errors, 0 warnings |
| `npm run build` | ✅ built |
| `rg -c 'tauri::command' src-tauri/src/commands.rs` | ✅ **10**, unchanged — this phase registers no command |
| `git status --short --untracked-files=all` | ✅ no path under `tests/corpus/real/` |

**The baseline was re-established before the phase began**, not assumed: `cargo test --workspace`
was run at `18195f8` and returned **983**, and `npm test` **700**, both matching the previous
checkpoint exactly.

**Five claims were re-derived by the orchestrator rather than accepted from a worker or the reviewer.**

1. **No reentrancy path exists.** `rg -n 'lock_path\('` over the crate finds exactly **one**
   production call (`persist/save.rs:1183`); the other two are in a `#[cfg(test)]` module.
   `replace_locked_file` is called from exactly one place, inside the transaction, holding that
   lock. `replace_file_atomically`, which takes the lock itself, is called from nowhere but its own
   definition, and `src-tauri/` mentions both only in a doc comment.
2. **The new refusal really is pre-lock.** `ReplacementRequiresBackups` is raised at `save.rs:1176`;
   `lock_path` is at `save.rs:1183`. Read, not reported.
3. **The byte-fidelity test is not a proxy.** It reads each of the 15 committed byte-exact fixtures,
   submits its text, and compares `fs::read(target)` against the **original bytes**, pinning the
   14-committed / 1-refused split so a fixture silently dropping out of the sweep fails the test.
4. **The deadlock instrument is real.** `within()` spawns the work on its own thread and waits with
   `recv_timeout`, so a second lock acquisition **fails** the test instead of hanging the suite.
5. **The collision test cannot pass vacuously.** It asserts that *every operand the finding carried
   before the fix round* — stopping point, span, node, path — is **equal** between the two
   candidates, and only then that the findings differ. Remove the `revision` operand and the test
   fails, which is what makes it a test of the fix rather than of the fixtures.

## Phase 2b-2c-3a review disposition

The design consult for the whole of 2b-2c-3 was taken **before any line of it existed** and was
**not re-commissioned** (`docs/reviews/phase-2b-2c-3-design.md`, eight rulings, its Q2 overridden by
the owner). The aggregate code review is `docs/reviews/phase-2b-2c-3a-code.md` and it returned
**READINESS: NOT READY**. That verdict was **accepted rather than argued with**: the High and the
Medium were both fixed and re-verified, and the phase was not committed until they were.

**The first Codex review attempt hung** — `updatedAt` froze 87 seconds in while the job reported
`running` for nine minutes. It was cancelled per the watchdog procedure and relaunched with a
narrowed brief, which finished in 1m41s. **The hung attempt was not wasted**: its last captured
message named the backup mismatch, and that lead was confirmed independently and fixed as round one
before the second review ever ran.

| # | Where | Ruling or finding | Disposition |
|---|---|---|---|
| Design Q1 | consult | The substitute for the patch engine's proof is a successful reparse **and** the validation/acknowledgement gate | **Adopted as narrowed by the owner's override.** The reparse can no longer be a gate, so it is a **fact established and reported**. Q5 carries the weight instead |
| Design Q2 | owner | ~~Do not write text the parser rejects~~ — **OVERRIDDEN.** A raw save MAY write unparseable text | **Implemented as the owner ruled.** `an_already_broken_file_can_be_repaired_by_a_replacement` is the test that proves the point of the override |
| Design Q3 | consult | Keep `SaveResult`; `moved: None` | Deferred to 2b-2c-3b, which is where `moved` exists. The core reports the facts a caller needs |
| Design Q4 | consult | **One** entry point branching internally — the lock is not reentrant | **Adopted.** The mode is a **field** of `SaveRequest`, not a second function and not an enum over the whole request, so no caller can construct a raw save that skips the revision check by construction |
| Design Q5 | consult | A raw save fully participates in acknowledgement | **Adopted, and it is the load-bearing decision** — it forced "does not parse" to be a `Finding` rather than the `CommandError` the consult had suggested, because a `CommandError` cannot be acknowledged |
| Design Q6 | consult | No backup for a byte-identical result; **every committed raw replacement must have a recoverable pre-commit image** | **Not honoured by the implementation. Found and fixed as round one** — see Fix 1 |
| Design Q7 | consult | The named stale-revision test | **Adopted verbatim**, with the bounded-timeout instrument the ruling asked for |
| Design Q8 | consult | A raw save is a separate replacement mode with a **different promise** | **Adopted**, and the promise is stated on the `ReplaceText` variant itself, where a caller reads it |
| Fix 1 | orchestrator | **The backup path was content-mode-neutral**, so a raw save with `backups: None` committed a whole-file replacement leaving **no recoverable image of the bytes it destroyed**. `every_byte_exact_fixture_is_committed_exactly_as_submitted` passed `None` and committed 14 of them, so **a test codified the wrong behaviour** — the same shape as 2b-2c-2's Low | **Fixed.** `SaveError::ReplacementRequiresBackups { path }`, a struct variant, raised **before the lock**, below the read-only check on purpose. Nine tests now pass a real session. **The two lookalike outcomes are distinguished and the distinction is tested**: a session that has *already* copied the file is Q6's recoverable image and still commits (`a_second_replacement_in_one_session_commits_with_no_second_copy` asserts the commit **and** that the first snapshot survives). Only a **missing** session is refused |
| Code 1–4 | review | **No finding** in transaction ordering, reentrancy, byte fidelity, or the stale-revision defence. The reviewer confirmed the compared revision is the one read under the lock and that the TOCTOU window is closed for cooperating writers | Each reported as an explicit "no finding", not left silent |
| Code 5 | review | **High, and the NOT READY** — an acknowledgement for one unparseable text could acknowledge a **different** one. `DocumentDoesNotParse` carried the parser's position and message but **no identity of the candidate**, so two texts sharing an invalid prefix and differing only after the failure point produced **identical** findings. The existing test could not catch it: it asserts `assert_ne!` on the two findings | **Fixed, not dispositioned.** The finding gained a `revision: ContentRevision` operand — the hash of the **submitted text** — so a different text is simply a different finding and the existing exact-multiset machinery does the binding. `Acknowledgement`'s shape, `covers_all` and the `Edits` mode are untouched. This **restores a property consult Q5 had assumed**: *"changing the text requires recomputing findings and matching a new exact multiset"* |
| Code 6 | review | **Medium** — four tests assert proxies and would pass against a broken implementation | **All four fixed.** The byte-identical test now compares **inode and mtime** and pins that a real commit *does* change the inode; both `*_refused_before_anything_is_read` tests now delete the target and repeat the call, and were **renamed** to `*_is_refused_without_consulting_the_target` because a discarded read is invisible to a black-box test and the old names claimed more than they proved; the presentation-note test now asserts bytes at all four stages; the stale test matches the **typed** `RevisionMismatch` instead of `contains("holds")` |
| — | worker | The brief asked for a test pinning that a **surplus** acknowledgement is *rejected*. The worker reported this **contradicts deliberate existing behaviour**: `a_surplus_acknowledgement_does_not_refuse` pins that extra acknowledged findings do not refuse — the rule is *every candidate suspicion is covered*, not *every acknowledgement is used* | **The worker was right and the brief was wrong.** Existing behaviour was left alone; the reading with teeth was pinned instead by `an_acknowledgement_of_findings_that_were_never_issued_commits_nothing`, whose second half exercises the surplus-plus-covering case so the two statements cannot be confused |
| — | worker | The reviewer asked whether the new operand must appear as a dictionary placeholder | **Checked rather than assumed**: `every_save_transaction_placeholder_names_an_operand_serde_writes` is **one-directional** (placeholder → operand), so an opaque hash is **not** forced into a user-facing sentence. `saveCodes.test.ts` now asserts its **absence** from both renderings |

---

## Verification — Phase 2b-2c-2

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report. Each was run **twice** — once on the implementation and again after the review fix
round — and the table records the second run.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` | ✅ **983 tests across 21 binaries**, 0 failed (**+24** on 2b-2c-1's 959: +20 for the two commands, +4 for the fix round) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed — no fixture lost a distinguishing byte, and none was added |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test draft_plan -- every_match_of_the_real_configuration` | ✅ **not a vacuous skip** — 13 files, 65 matches, 65 planned to an empty batch, 417 intents, **0 refusals**, unchanged by this phase |
| `npm test` | ✅ 29 files, **700 tests**, 0 failed (+4 on 696: the new codes and the new union member) |
| `npm run check` | ✅ 376 files, 0 errors, 0 warnings |
| `npm run build` | ✅ built |
| `git status --short --untracked-files=all` | ✅ no path under `tests/corpus/real/` |

**The baseline was re-established before the phase began**, not assumed: `cargo test --workspace` was
run at `3160be2` and returned **959 across 22 result lines**, matching the previous checkpoint exactly.

**Four claims were re-derived by the orchestrator rather than accepted from a worker or the reviewer.**

1. **Nothing writes outside `save_document`.** `rg -n 'replace_file_atomically|replace_locked_file'
   src-tauri/src/` returns exactly **one** line, and it is a doc comment. The non-reentrant lock is
   not reachable from a command.
2. **The headline test is not a proxy.**
   `delete_match_never_deletes_the_item_at_a_stale_ids_old_path` asserts its own **premise** — that
   B's former path now resolves to A — before asserting the refusal, then compares the whole
   post-creation file byte for byte. A test that skipped the premise would pass even if the fixture
   stopped exercising the shift.
3. **The D5 check the design ruling was conditional on exists and observes a real value.**
   `every_edit_error_variant_crosses_as_an_object` derives its variant lists by parsing the source
   (36 `EditError`, 9 `SaveError`), asserts no unit variants, and then serializes a real
   `SaveFailed{Patch(RemovalWouldEmptyTheSequence)}` and reads the operand through **both** tags.
4. **The reshaped note breaks no existing reader.** `PresentationNote` changed from a struct to a
   tagged union, and `save_match` already emits it — but no component reads `notes`
   (`rg` over `src/lib` outside the types and tests finds only the accessors), and `svelte-check`
   is clean, so the change has no consumer to break. It is a wire-format change made while the
   field still has **no reader**, which is the only cheap moment it had.

## Phase 2b-2c-2 review disposition

Two consultations, both closed. The design consult was taken **before any line existed**
(`docs/reviews/phase-2b-2c-2-design.md`); the aggregate code review was taken over the whole working
tree **before the commit** (`docs/reviews/phase-2b-2c-2-code.md`), and it returned
**READINESS: NOT READY**. That verdict was **accepted rather than dispositioned away**: both findings
were fixed, re-verified, and the phase was not committed until they were.

| # | Where | Ruling or finding | Disposition |
|---|---|---|---|
| Design Q1 | consult | `create_match` accepts a **closed** `NewMatch { trigger, replace }`, both mandatory — never a raw pair list, never a full `MatchDraft` | **Adopted.** The author-chosen-key ban settles the pair list on its own; a `MatchDraft` would advertise structure a flat item cannot spell |
| Design Q1 | consult | *Reasoning corrected before it was acted on.* The consult justified the mandatory `replace` by claiming `save_match` could not later insert one. **That is false** — 2b-2b-2's D1 permits exactly one insertion, a schema-known scalar key into the match's own mapping | **Ruling kept, reason replaced**: a trigger with no body is not a usable espanso match. The incorrect reasoning appears in no comment or document |
| Design Q2 | consult | The core gains an explicit **front** insertion reusing `plan_move`'s own derivation; not a command-layer reconstruction, not append-then-move | **Adopted.** R25 forbids a move in a batch with anything else, so append-then-move would cost two transactions, two backups and two acknowledgement rounds, and would leave an intermediate state on disk. `insert_item()`'s `after: Option<usize>` became `at: ItemPlacement`; the reviewer confirmed **no `None` call site silently became `Front`** |
| Design Q3 | consult | Target the top-level `matches` value only, by opaque `DocumentId`; a file with **no `matches:` key at all** is refused by name in the `Err` channel; a **bare** `matches:` is still promoted | **Adopted** as `CommandError::DocumentHasNoMatchList` |
| Design Q4 | consult | `delete_match` answers `moved: None` — routine, not defensive. No neighbour identity | **Adopted.** Returning a neighbour would overload `moved` with UI selection policy and re-introduce positional identity |
| Design Q5 | consult | The eight `EditError` refusals arrive **wrapped** as `SaveFailed`; the command layer does **not** pre-plan the primitive | **Adopted.** Pre-planning would resolve the document twice and let the two layers disagree. The ruling was **conditional** on the object-shape contract test, which now exists |
| Design Q6 | consult | A deletion that doubles a blank separation owes a `PresentationNote` | **Adopted after one refusal.** See Code 1 |
| Design Q7 | consult | The named stale-identity test | **Adopted verbatim**, premise included |
| Code 1 | review | **Medium, and the NOT READY** — the Q6 note was **not** emitted. The implementer's diagnosis was accepted as sound (the old `PresentationNote` was a scalar-*spelling* record with no honest `ScalarStyle` for "a deletion left two blank lines") but the deferral still left the user with no disclosure | **Fixed, not dispositioned.** `PresentationNote` became a tagged union — `ScalarRestyled` carrying the old four operands verbatim, plus `DoubledSequenceSeparation { edit }`. Detected in `plan_item_removal` via `removal_doubles_a_blank_separation`; **`lift_item()` and `ItemMove`'s output untouched**, so a move's `notes` stays empty and is now **pinned by a test** rather than only documented. **Neither blank line is collapsed** |
| Code 2 | review | **Low** — `ItemPlacement::After(0)` was accepted against a bare implicit-null `matches:`, which has zero items, contradicting `After`'s own contract. A test codified the three placements as equivalent there, **including the nonexistent anchor** | **Fixed.** The implicit-null branch now returns `NoSuchDestinationItem { items: 0, … }` for every `After(_)`. The old test was **renamed** to `front_and_end_promote_a_bare_key_to_the_same_bytes` — its previous name asserted the very equivalence the finding says is wrong — and `a_promotion_refuses_every_after_anchor` was added beside it |
| Code 3 | review | The single most valuable **missing** test, named | **Added**: `deletion_that_creates_doubled_separation_returns_a_layout_presentation_note` asserts the byte-exact doubled gap, the note in `SaveResult::Saved`, its one-key object on the wire, **and** the negative case |
| Code 4–6 | review | **No finding** in the two commands' correctness, in the invariants (no write outside `save_document`, no `force`, no finding cache, R25, D2), or in i18n and wire-contract completeness | Each reported as an explicit "no finding", not left silent |
| — | orchestrator | The reviewer noted it could not re-run the test and lint totals under its read-only constraint | **Discharged by the table above**, which is the orchestrator's own second run |

---

## Verification — Phase 2b-2c-1

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` | ✅ **959 tests across 21 binaries**, 0 failed (**+32** on 2b-2b-3's 927 — exactly the new `tests/patch_item.rs`) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed — no fixture lost a distinguishing byte, and none was added |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test draft_plan -- every_match_of_the_real_configuration` | ✅ **not a vacuous skip** — 13 files, 65 matches, **65 planned to an empty batch**, 417 intents, **0 refusals**, unchanged by this phase |
| `npm test` | ✅ 29 files, **696 tests**, 0 failed (unchanged — the eight new keys are covered by the existing parity sweeps) |
| `npm run check` | ✅ 376 files, 0 errors, 0 warnings |
| `npm run build` | ✅ built |
| `git status --short --untracked-files=all` | ✅ no path under `tests/corpus/real/` |

**The baseline was re-established before the phase began**, not assumed: `cargo test --workspace` was
run at `0cf7420` and returned **927 across 21 binaries**, matching the previous checkpoint exactly.

**Two claims were re-derived by the orchestrator rather than accepted from the worker or the reviewer.**

1. **The CRLF fix.** `leading_comment_block_start` (`crates/espansoconfig-core/src/patch/edit.rs:6613`)
   steps back over the **whole** terminator — two bytes for `\r\n`, one for a bare `\n` or `\r` —
   before asking `line_start_of` for the line above. That is the defect's actual shape, and the fix
   addresses it rather than papering over it.
2. **The headline test is not a proxy.** `lift_site_of_a_move` in `tests/patch_item.rs` applies a real
   `ItemMove`, discards the landing replacement, splices the departures itself, and compares the
   resulting **bytes** against `RemoveItem`'s output — not two `Ok`s, not a summary.

## Phase 2b-2c-1 review disposition

Two consultations, both closed. The design consult was taken **before any line existed**
(`docs/reviews/phase-2b-2c-1-design.md`); the aggregate code review was taken over the whole
working tree **before the commit** (`docs/reviews/phase-2b-2c-1-code.md`).

| # | Where | Ruling or finding | Disposition |
|---|---|---|---|
| Design Q1 | consult | The three-way cut; `InsertItem` and `RemoveItem` **paired**; `save_raw_document` last | **Adopted** — it is the split table above |
| Design Q2 | consult | `InsertItem` takes a **flat list of scalar key/value pairs**, never caller-supplied YAML text and never an espanso-shaped seed | **Adopted.** Caller-supplied text would put preservation-critical structure in the untrusted caller — the same reason the frontend sends a `MatchDraft` and not an edit list (2b-2b). A typed seed would put espanso's schema inside the generic patch engine |
| Design Q2 | consult | The "no synthesized collection" rule is **narrowed by an explicit exception**, not weakened | **Adopted verbatim** as the variant's doc comment |
| Design Q3 | consult | Flow sequences refused; inconsistent indentation refused; a bare implicit-null `matches:` **promoted**, with a named refusal when its trivia is ambiguous | **Adopted**, error names included. Without the promotion the app could never create the first match in a fresh file |
| Design Q4 | consult | `RemoveItem` is `ItemMove`'s lift half in **shared code**, not a second implementation that agrees | **Adopted**, and pinned by a test that compares the two outputs byte for byte |
| Design Q5 | consult | Removing the only item is refused by name; the UI explains it | **Adopted.** `matches: []` would synthesize a collection; a bare `matches:` would turn a sequence into YAML null. Neither is "remove one existing item" |
| Design Q6 | consult | A `SaveRequest` variant for whole text, never a full-span `DocumentEdit` | **Recorded for 2b-2c-3**, deliberately not built here |
| Code 1 | review | **Low** — §5 of the notes claimed `crlf-line-endings.yml` has *no* entry or item with a leading comment block. It does: a two-line block at column zero above `matches:` | **Fixed**, after independent confirmation — `rg -n '#'` returns exactly lines 1–2 and `rg -n '^[a-zA-Z]'` returns exactly `3:matches:`, so the entry carrying that block is the root mapping's only one and is refused before any envelope is derived. §5 now makes the narrower true claim and names the block rather than denying it |
| Code 2–6 | review | **No finding** in byte preservation, the `ItemMove` regression surface, vacuous tests, the refusals, or the wire additions | Each reported as an explicit "no findings", not left silent. The reviewer re-derived the two claims the brief singled out rather than accepting the implementer's framing |

---

## Verification — Phase 2b-2b-3

Every command below was run **by the orchestrator**, each as its own invocation, not taken on a
worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` | ✅ **927 tests across 21 binaries**, 0 failed (**+10** on 2b-2b-2's 917) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed — no fixture lost a distinguishing byte |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test draft_plan -- every_match_of_the_real_configuration` | ✅ **not a vacuous skip** — 13 files, 65 matches, **65 planned to an empty batch**, 417 intents, **0 refusals**, unchanged by this phase |
| `npm test` | ✅ 29 files, **696 tests**, 0 failed (**+11** on 685) |
| `npm run check` | ✅ 376 files, 0 errors, 0 warnings |
| `npm run build` | ✅ built |
| `rg -c '#\[tauri::command\]' src-tauri/src/` | ✅ `commands.rs:8`, `menu.rs:1` — **the eighth command**, and the second that writes |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1); no corpus fixture modified; **no probe scaffold left behind** |

**One verification caught a failure a worker's report did not.** The step-C worker reported
`cargo test --workspace` green; the orchestrator's own run came back **121 passed / 1 failed** —
`every_typescript_wire_union_has_a_namespace` panicking with *"only 43 unions were examined"*. The
non-vacuity floor had been set to the measured 44, and making `DraftError` uniformly object-shaped
removed the only single-quoted member it had, so it stopped counting as a union at all. Fixed in
place, with the reason written at the assertion (D6, `2b-2b-3-notes.md` §5). **This is the whole
argument for re-running every gate rather than reading a report**, and it is the second time this
project has been paid for it.

**What this phase proves.** `save_match` exists, is registered, is reachable through the real
dispatcher, and writes a user's file through `save_document` and nothing else. A drafted scalar
change commits and re-mints an identity; a draft that changes nothing comes back `committed: false`
as a **success**; a `DraftError` crosses as `draftRefused` carrying indices only; a stale
`base_revision` is refused before any transaction is built; and a `PresentationNote` reaches
`SaveResult::Saved::notes` — its **first producer** since 2b-1 put it on the wire.

**Four things it does *not* prove.**

- **No screen calls it.** There is a command, a typed wrapper and a compile-checked accessor, and no
  component invokes any of them. The thirty-two `code.draftError.*` strings have never been drawn.
- **The real configuration exercises none of the interesting path.** All 65 real matches plan to an
  **empty** batch — the property 2b-2b-1 and 2b-2b-2 wanted, and the reason the real corpus says
  nothing about a batch that is not empty.
- **32 Spanish values were added and are checked only by heuristic**, like the 170+ before them.
- **The clean review is weaker than it looks.** See the disposition below.

---

## Phase 2b-2b-3 review disposition

Two Codex consultations, both recorded in full.

| Consult | File | Outcome |
|---|---|---|
| Design, **before** implementation | [`docs/reviews/phase-2b-2b-3-design.md`](docs/reviews/phase-2b-2b-3-design.md) | Three rulings, all three adopted unchanged — D1/D2/D3 in `2b-2b-3-notes.md` §2 |
| Aggregate code review, before the commit | [`docs/reviews/phase-2b-2b-3-code.md`](docs/reviews/phase-2b-2b-3-code.md) | **No finding at any severity**; readiness verdict for 2b-2c |

**The design consult's three rulings were adopted as written**, and each is recorded with the
argument *against* it rather than only the argument for:

- **D1** — a `DraftError` is an `Err(CommandError::DraftRefused)`, not a `SaveResult` variant,
  because it is planning-time and **non-overridable** where `SaveResult::Refused` is transactional
  and overridable. The cost the consult named and the phase accepted: a draft refusal is an expected
  domain outcome, so generic `Err` handling will render it as a toast unless the frontend routes
  this code to inline form feedback. **That obligation is now owed by whichever phase builds the
  editor screen.**
- **D2** — a success re-mints its identity from the match's **own** projected path, so a match that
  is not addressable as a sequence item is still editable. A committed write is never afterwards an
  `Err`.
- **D3** — an empty batch still goes to `save_document`, so the under-lock revision check is never
  skipped.

**The clean code review is honestly weaker than "no defects were present."** One real defect was
found in this phase — `MatchHasNoPath` was the single unit variant of thirty-two and would have
demoted a typed refusal to *unexpected failure* — and it was found **before** the review, by the
orchestrator, reading a worker's own report rather than by any test. The review then looked at the
repaired tree. A clean review of a tree whose one known defect has already been fixed is not the
same evidence as a clean review of the tree as first written, and the review file says so at the
top rather than leaving the reader to notice.

**Why no test caught that defect, which is the part worth keeping.** Both halves of the contract
were individually correct: the dictionary had the string, the exhaustiveness check passed, the
operand-shape table matched its sample. Nothing anywhere asked whether **the sample was
representative**. `every_draft_error_variant_crosses_as_an_object` now asks it, from the enum's
parsed variant list rather than from a sample.

---

## Verification — Phase 2b-2b-2

Every command below was run **by the orchestrator**, each as its own invocation, not taken on the
worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` | ✅ **913 tests across 21 binaries**, 0 failed (**+31** on 2b-2b-1's 882; `draft_plan.rs` holds 82) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed — no fixture lost a distinguishing byte |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test draft_plan -- every_match_of_the_real_configuration` | ✅ **not a vacuous skip** — 13 files, 65 matches, **65 planned to an empty batch**, **417 intents** drafted, **0 refusals**; open half **38 variables, 48 `params` entries, 0 form fields, 0 options** |
| `npm test` | ✅ 28 files, **685 tests** — unchanged, as it must be |
| `npm run check` | ✅ 375 files, 0 errors, 0 warnings |
| `npm run build` | ✅ built |
| `rg -c '#\[tauri::command\]' src-tauri/src/` | ✅ `commands.rs:7`, `menu.rs:1` — **no command added**, which is the point |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1); no corpus fixture modified |

**What this phase proves.** The 2b-2b-1 headline property now runs over the open half too: every one
of the owner's 65 real matches, drafted with **all 417** of its in-scope fields `Set` to the value the
file already holds — 114 of them new, from 38 variables and 48 `params` entries — derives an **empty
batch**. Zero edits, zero refusals. The synthetic twin runs without the real corpus (33 files, 150
matches, 139 planned, 369 intents, 14 variables / 20 params / 3 form fields / 5 options), so CI on a
fresh clone still checks it.

**Two guard tests are the phase's sharpest instruments**, and both were read by the orchestrator
rather than taken on report:

- `a_path_one_segment_deeper_than_the_surface_is_refused` walks **six** paths one segment past the
  deepest legal shape and refuses each as **both** a scalar edit and a removal. This is what stops
  the widening from becoming "anything under `vars`".
- `the_guard_refuses_a_nested_key_the_mapping_writes_twice` gives the guard a `params` written
  `format`, `offset`, `format` and shows it refuses a batch naming `format` while admitting one
  naming `offset`. **The duplicate is at an index the batch does not name** — which is exactly the
  case a guard built from the batch's own keys would pass.

**Four things it does *not* prove.**

- **The aggregate code review was not run *in this phase's session*.** See the disposition below — it
  was a known, recorded gap rather than an omission discovered later, and it was **discharged at the
  head of the following session**: `docs/reviews/phase-2b-2b-2-open-key-code.md`, one finding, closed
  in the fix round recorded under "Verification — Phase 2b-2b-2 code review" below.
- **No screen was read**, and there is still no command, no IPC type and no i18n key for any of this.
  The four `code.diagnosticCode.*` strings 2b-1 corrected are now a debt **four** phases old.
- **The real configuration holds zero `form_fields`.** Every claim about that surface rests on
  synthetic fixtures and will keep doing so — the same permanent shape as 1c-2b-2b-2's finding about
  unmodelled entries. 48 real `params` entries were swept; **0** real form-field options were.
- **Four refusals are unreachable from any document** in either corpus — the hazard gate refuses the
  match first, or the projection never produces the state. Each test says so rather than implying
  coverage. **The code review's fix round made it five**, for the same reason and with the same
  honesty: see below.

---

## Verification — Phase 2b-2b-2 code review

The aggregate code review 2b-2b-2 owed, run at the head of the next session, plus its fix round.
Every command was run **by the orchestrator**, each as its own invocation.

| Command | Result |
|---|---|
| `cargo test --workspace` (baseline, before any change) | ✅ **913 tests**, 0 failed — the checkpoint's figure reproduced exactly on a cold start |
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` (after the fix) | ✅ **917 tests across 21 binaries**, 0 failed (**+4**; `draft_plan.rs` 82 → 86) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo doc -p espansoconfig-core --no-deps` | ✅ **no new warning** — the pre-existing private-item links are unchanged and none is in `draft/error.rs` |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test draft_plan -- every_match_of_the_real_configuration` | ✅ **not a vacuous skip** — figures unchanged from 2b-2b-2: 65 matches, 65 empty batches, 417 intents, 0 refusals |
| `rg -c '#\[tauri::command\]' src-tauri/src/` | ✅ `commands.rs:7`, `menu.rs:1` — still no command, as 2b-2b-2 requires |
| `npm test` / `npm run check` / `npm run build` | **not run, and not needed** — no file under `src/` or `src-tauri/` is touched. Stated rather than implied, the way 2a-1's entry does |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1); no corpus fixture modified |

**The review's one finding, and why the fix is worth having even though nothing can reach it.** Codex
found that a variable's **own** mapping is audited by neither mechanism that refuses an ambiguous key:
`nameable_key` is never consulted for a path composed from `VariableField::key()`, a literal, and
`check_every_named_key_is_unique` only judges a mapping the planner recorded a `NestedKeys` for —
which is the `params` mapping, never the variable's own. Both halves of that are true.

**Its stated consequence is not, and the correction is the most useful thing the round produced.** A
repeated key raises `HazardKind::DuplicateMappingKey` on the mapping holding it, and
`TriviaIndex::disqualifying_hazard` counts a hazard on a **descendant** — so a duplicate inside a
variable disqualifies the whole match, and `plan_match_edits`' third step refuses with
`MatchNotEditable` before `plan_vars` is entered. There is no silent edit and no wrong-node write.
The finding is therefore an **unnamed** ambiguity behind a coarser gate, not an unrefused one.

It was closed anyway, for three reasons recorded in the review file: the masking gate is coarse (one
duplicate anywhere makes a whole match uneditable) and Phase 2c is precisely the phase that will want
to narrow it; this crate already restates invariants across layers on purpose (`draft/mod.rs`: the
closed-surface invariant "is stated three times"); and the projection already held the answer in
`variable.unknown_entries` and was simply not asked.

**The unreachability is asserted, not just documented.** `AmbiguousVariableKey`'s doc comment carries a
*"No projected document reaches it today"* section — placed at the variant because 2b-2b-3 owes it a
dictionary string and would otherwise write a sentence for a code no user can see — and the test helper
`one_match_with_its_duplicate_admitted` **asserts** `blocking_hazard == Some(DuplicateMappingKey)`
before forcing the state. If a later phase narrows the gate, that assertion fails and the claim gets
re-read instead of rotting.

---

## Phase 2b-2b-2 code review disposition

[`docs/reviews/phase-2b-2b-2-open-key-code.md`](docs/reviews/phase-2b-2b-2-open-key-code.md) is the
aggregate **code** review 2b-2b-2 owed and could not afford. It was run at the head of the following
session against the written code, and the brief was narrowed deliberately — three questions, a named
four-file scope, a 900-word cap and an explicit ban on web search — because the previous session's two
Codex jobs on this phase had run 26 and 20 minutes and the first had to be cancelled with zero output
events. **This one returned in 1 minute 53 seconds.** The three questions were the three places the
2b-2b-2 checkpoint itself named as invisible to the 82 tests.

| # | Finding | Disposition |
|---|---|---|
| Q1 | `plan_open_mapping`'s index-to-key resolution: is the index consumed against the same list, in the same order, the projection presented? | **NONE FOUND**, accepted and spot-checked. The index addresses the projected `&[FieldView]` unfiltered and unreordered; out-of-range refuses before a path is built; `nameable_key` refuses a non-scalar, undecoded or duplicated key |
| Q2 | **The one finding.** A variable's own mapping is audited by neither `nameable_key` nor `check_every_named_key_is_unique`, so a repeated `name` / `type` / `inject_vars` / `params` key gets no refusal of its own | **Fixed**, and **downgraded twice while being verified**: not a wrong-node write (projection and resolver both take the first occurrence), and not even an unrefused one (the hazard gate refuses the whole match first). `DraftError::AmbiguousVariableKey { variable }` is the nested refusal, index-only per D1, unreachable today and documented as such |
| Q3 | Does `check_closed_surface` admit a `DocumentPath` shape the seven/four enumeration did not intend? | **NONE FOUND**, accepted. The admitted set was re-derived from the code's suffix patterns rather than its comments, and the two agree |

---

## Phase 2b-2b-2 review disposition

[`docs/reviews/phase-2b-2b-2-open-key-design.md`](docs/reviews/phase-2b-2b-2-open-key-design.md) is a
Codex **design** consult, run before implementation and delivered mid-flight to the worker. It ruled
on D1–D6 as specified and returned one finding that could have produced a wrong-node edit.

**What was reviewed, and what was not — stated plainly because the difference matters.** The consult
judged the *design*, described to it in prose. **No Codex review of the written code was run**, and
the `/goahead` policy asks for one per phase. The reason is not that it was judged unnecessary: two
consecutive Codex jobs on this phase ran 26 and 20 minutes, the first had to be cancelled after
consuming 26 minutes with zero output events, and the orchestrator reached its context budget before
a third round could be spent. **The aggregate code review is therefore carried forward as the first
item of the next session**, below.

| # | Finding | Disposition |
|---|---|---|
| F1 | **The one that mattered.** Grouping derived edits per mapping does not replace a full-mapping duplicate scan: an *unedited* duplicate still makes an edited path ambiguous, because `path::resolve` takes the **first** match | **Fixed as specified.** `NestedKeys` carries the **whole** mapping's key list, with repetitions. Tested with the duplicate at an index the batch does not name — the case a batch-derived key list passes |
| F2 | Prefix containment is sound at mixed depths **only because** paths address concrete syntax nodes and aliases are never followed. That invariant was load-bearing and unwritten | **Fixed.** Written into `check_no_removal_contains_another_edit`, including the harmless disagreement — a removal's envelope swallows comments and blank runs no path names |
| F3 | The equality rule cannot distinguish a quoted `'true'` from a plain `true`; both decode to `"true"` | **Recorded as hole 1, not coded.** The consult's suggested fix — compare source text for `params` — was **refused**: it would be a second equality rule, and 2b-2b-1 §11 is explicit that a second comparison is a second answer to a question that has one. Addressed to `ScalarView`'s owner. `null` vs an empty value *are* distinguished and are excluded from the hole |
| F4 | No refusal is locally more dangerous than acting; the worst case is a user falling back to hand-editing YAML, which is a UX consequence and not permission to delete unseen bytes | **Accepted, no change.** Recorded as the reason D1 and D4 refuse rather than guess |
| F5 | Named what 2b-2c must **undo** rather than extend, and confirmed D1's ban on author-chosen keys need not be undone by sequence insertion | **Recorded** in §11 of the notes |

---

## Verification — Phase 2b-2b-1

Every command below was run by the orchestrator **after** the review fix round, each as its own
invocation, not taken on any worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` | ✅ **882 tests across 21 binaries**, 0 failed (**+54** on 2b-2a's 828: 39 in the first pass, 15 more in the review fix round) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed — no fixture lost a distinguishing byte |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test draft_plan -- every_match_of_the_real_configuration` | ✅ **not a vacuous skip** — 13 files, 65 matches, **65 planned to an empty batch**, 303 intents drafted, **0 refusals** |
| `npm test` | ✅ 28 files, **685 tests** — unchanged, as it must be |
| `npm run check` | ✅ 375 files, 0 errors, 0 warnings |
| `npm run build` | ✅ built |
| `rg -c '#\[tauri::command\]' src-tauri/src/` | ✅ `commands.rs:7`, `menu.rs:1` — **no command added**, which is the point |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1); no corpus fixture modified |
| `git check-ignore -v …/corpus/real/match/base.yml` | ✅ `.gitignore:107` still covers it |

**What this phase proves, and it is the strongest evidence this project has produced for a
byte-preservation rule.** The headline property is not a hand-authored fixture passing: **every one
of the owner's 65 real matches, drafted with all 303 of its in-scope fields `Set` to the value the
file already holds, derives an empty batch.** Zero edits, zero refusals. The synthetic twin runs
the same property without the real corpus (33 files, 150 matches, 139 planned, 315 intents), so CI
on a fresh clone still checks it rather than skipping.

The inline fixture is the sharper instrument, because it is *adversarial*: it asserts its own
non-vacuity before testing anything — that all five scalar styles are present among its eighteen
fields, and that no two fields decode to the same string, so a planner reading one field's value
while writing another's path would still be caught.

**Four guards were verified by making them fail on purpose and reverting**, which is this project's
standing discipline for a check nobody has seen fail: the F5 tripwire (a `DraftError` reference
planted in `save.rs`), the real-corpus skip, the `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1` failure
path, and `git check-ignore` after restoring the corpus.

**Four things it does *not* prove.**

- **No screen was read**, and no command exists to read one through. `plan_match_edits` has no
  caller outside its own tests. **The four `code.diagnosticCode.*` strings 2b-1 corrected are now
  a debt three phases old** — the next phase that opens a window still owes the look.
- **The guards are not independent validation of the planner's intent**, and saying so was a
  review finding. They are closed-surface and batch-dependency checks over a *derived batch*: they
  share the planner's `MatchField::from_key` vocabulary and inspect **paths**, not nodes or
  original cardinality. A hand-built edit to `triggers[999]` passes both. `audit.rs`'s module
  documentation now says this instead of claiming a defect in the planner cannot bend them.
- **`NotDecodable` is reached by constructing the view state**, not by a document. No file in
  either corpus produces `decoded == false` — the corpus tests pin that count at zero — so the
  refusal is real but its trigger has never occurred naturally.
- **Nothing here has met a user's real match through a form.** Whether the eighteen keys are the
  eighteen a form would offer is 2b-2b-3's question, not this phase's answer.

---

## Phase 2b-2b-1 review disposition

[`docs/reviews/phase-2b-2b-1-draft-engine.md`](docs/reviews/phase-2b-2b-1-draft-engine.md) — two
blocking, four should-fix, four overclaims. The design consult that preceded the phase is
[`docs/reviews/phase-2b-2b-draft-design.md`](docs/reviews/phase-2b-2b-draft-design.md), and its six
rulings are what the phase was built to. **Two of the review's fixes were narrowed or refused, and
those are the two worth re-reading before 2b-2b-2.**

| # | Finding | Disposition |
|---|---|---|
| F1 | **Blocking.** Two draft intents at one sequence index: the no-op one is erased as a logical no-op *before* the batch exists, so `ScalarEditedTwice` never fires and draft order silently becomes last-wins | **Fixed.** `check_no_index_is_drafted_twice` runs at intent level, before any diffing, with `DraftError::SequenceItemDraftedTwice`. Batch-only auditing cannot recover an intent already erased — that is the lesson, not the variant. The `MatchField` analogue is closed by serde rejecting a repeated JSON key, and that is **tested rather than assumed** |
| F2 | **Blocking.** `Remove` on a key whose value is a collection is refused by *source* shape, contrary to ruling 4's "removal may discard an existing subtree" | **Refusal kept; fix narrowed.** Deleting bytes the visual editor never displayed is the class of silent destruction this project refuses on principle, and a sub-phase built for conservatism is the wrong place to grant it. Reachability was **answered by a test** — such a match *is* `safely_editable` with no hazard, so the planner is what decides, not the gate. The removal half became `RemovalWouldDiscardUnshownStructure`, named for the real reason. Ruling 4 is narrowed **as a recorded decision**, not an oversight |
| F3 | **Should-fix.** `triggers: []` is invisible to `visible_entries`, so a match whose only entries are empty sequences refuses an insertion that ought to work | **Recorded, not coded.** The proper fix is carrying the sequence entry's own span in `MatchView` — a read-model change, out of scope. Behaviour pinned by a test. The sharper half is now hole 9: **an empty `Vec<ValueView>` cannot distinguish "absent" from "present but empty"**, and that ambiguity is addressed to `model/match_view.rs` by name |
| F4 | **Should-fix.** The guards are not the independent second statement `audit.rs` claimed | **Claim fixed, code kept.** The module documentation now describes what they are and names three things they do not establish |
| F5 | **Should-fix.** The TEMPORARY `DraftError` exclusion makes the exhaustiveness test *pass*, so forgetting to delete it ships an untranslated code silently | **Fixed with a build-failing tripwire.** `the_temporary_draft_error_exclusion_expires_when_anything_names_it` fails the moment production Tauri code names `DraftError` while the exclusion stands, and **self-disables** once the exclusion is gone. It asserts the module scan found ≥5 production modules so it cannot pass vacuously. No dictionary entries added — nothing serializes a refusal yet |
| F6 | **Should-fix.** `MatchField::UppercaseStyle` serialized as `"UppercaseStyle"`, making the `NOT_A_CODE` justification "rendered literally as the espanso key" **false** | **Fixed.** `#[serde(rename_all = "snake_case")]` on both enums, every variant's spelling pinned against `key()`. One existing assertion updated from `"Triggers"` to `"triggers"` |
| F7 | **Note.** Four overclaims in the decision record | **All four corrected**, including the one claiming `dictionary_contract.rs` would fail the build if the temporary exclusion survived — it would not, which is exactly why F5 exists |
| F8 | *Orchestrator's own finding, not the reviewer's* — the headline property ran only over inline fixtures | **Fixed.** Real-corpus sweep plus an always-running synthetic twin. This is the phase's strongest evidence and it did not come from the review |

---

## Verification — Phase 2b-2a

Every command below was run by the orchestrator **after** the review fix round, each as its own
invocation, not taken on any worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo build --workspace` | ✅ built |
| `cargo test --workspace` | ✅ **828 tests across 20 binaries**, 0 failed (**+30** on 2b-1's 798: 25 in the first pass, 5 more in the review fix round) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed — no fixture lost a distinguishing byte |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test persist_save -- saving_the_real_configuration` | ✅ **not a vacuous skip** — 13 files, 65 matches, 13 committed, **0 refusals** |
| `npm test` | ✅ 28 files, **685 tests** (681 before the fix round, 671 at 2b-1) |
| `npm run check` | ✅ 375 files, 0 errors, 0 warnings |
| `npm run build` | ✅ built |
| `rg -c '#\[tauri::command\]' src-tauri/src/` | ✅ `commands.rs:7`, `menu.rs:1` — **exactly one command added**, and it is `move_match` |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1); no corpus fixture modified |

**What this phase proves, and it is a first.** Before it, every `#[tauri::command]` in this
application was read-only and the code that could destroy a file had no caller outside its own
tests. `move_match` is the first path by which a window can change a user's file, and it is proven
end to end: a move commits, its returned identity resolves in the new revision through `get_match`,
the identity that was passed in comes back as `identityStaleRevision`, the session serves the new
bytes from both surfaces that could have served a stale parse, a stale `base_revision` produces the
conflict arm, an unacknowledged suspicion refuses the move until the findings are serialized and
handed back, and the bytes the move did not touch are compared **byte for byte** against a text
derived independently of the command.

**Three things it does *not* prove, each recorded because it will be tempting to assume otherwise.**

- **No screen was read.** Nothing in this project renders a Svelte component in an automated test,
  so the frontend suite passing says nothing about what a window shows. `move_match` has no user
  interface at all yet — 2c owns that — and **the first phase that opens a window still owes the
  look at the four `code.diagnosticCode.*` strings 2b-1 corrected**, which is now a debt two phases
  old.
- **The conflict payload's honesty rule is pinned below the command**, not through it. Both reads
  happen inside one synchronous call, so no test can interleave a third writer between them; the
  rule is discriminated against `conflict_after_the_lock` directly.
- **The cross-*sequence* refusal is unreachable through `move_match`.** Every match a `DocumentView`
  holds is an item of the one `matches` sequence at the root of stream document 0, so two matches of
  one file are always siblings. The check exists to keep D2r true the day the projection grows a
  second sequence; it is exercised against addresses. The cross-**document** case is reachable and
  is tested.

---

## Verification — Phase 2b-1

Every command below was run by the orchestrator **after** the review fix round, each as its own
invocation, not taken on any worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` | ✅ **798 tests across 20 binaries**, 0 failed (**+11** on 2a-3b's 787: 9 in the first pass, 2 more in the review fix round) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed — no fixture lost a distinguishing byte |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test persist_save -- saving_the_real_configuration` | ✅ **not a vacuous skip** — 13 files, 65 matches, 13 committed, **0 refusals** |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test persist_backup -- backing_up_the_real` | ✅ 13 files copied into one batch, 0 with no editable scalar |
| `npm test` | ✅ 28 files, **671 tests** (662 at 2a-3b) |
| `npm run check` | ✅ 375 files, 0 errors, 0 warnings |
| `npm run build` | ✅ built |
| `rg -c '#\[tauri::command\]' src-tauri/src/` | ✅ `commands.rs:6`, `menu.rs:1` — **unchanged from `HEAD`**, checked against `git show HEAD:…` |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1); no corpus fixture modified |

**The claim this phase does *not* make.** 157 variants have shapes and strings and **zero callers**.
The dictionary contract proves every variant has two entries and the wire contract proves the JSON
shape is what it says; **nothing proves any of it is useful**, and nothing will until 2b-2. No Svelte
component calls any of the eighteen new accessors, so **no screen was read for this phase** and none
needed to be. This is the exposure 1b-1 accepted for the i18n layer, deliberately, and it is why 2b-1
is a phase rather than a commit.

**The deletion experiment, re-run by the orchestrator's instruction rather than taken on trust.** With
`code.backupError.destinationExists` removed from `en.json`, **both** sides failed:
`dictionary_contract::the_code_dictionary_is_exactly_the_declared_variants` and
`the_spanish_dictionary_declares_the_same_code_keys` on the Rust side, `dictionaries.test.ts > key sets`
on the frontend. Restored; both suites green. A variant serialized without its string cannot reach a
commit.

---

## Verification — Phase 2a-3b

Every command below was run by the orchestrator **after** the confirmation fix round, each as its own
invocation, not taken on the worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo build --workspace` | ✅ clean |
| `cargo test --workspace` | ✅ **787 tests across 20 binaries**, 0 failed (**+51** on 2a-3a's 736: 34 for the first pass, 15 more in the review fix round, then 2 in the confirmation fix round) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `cargo test -p espansoconfig-core --test corpus_integrity` | ✅ 17 passed — no fixture lost a distinguishing byte |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test persist_backup -- backing_up_the_real` | ✅ **not a vacuous skip** — 13 files copied into one batch, 0 with no editable scalar |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 … --test persist_save -- saving_the_real_configuration` | ✅ 13 files, 65 matches, 13 committed, **0 refusals** |
| `npm test` | ✅ 27 files, 662 tests |
| `npm run check` | ✅ 374 files, 0 errors, 0 warnings |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1); no corpus fixture modified |

**The first Codex review returned `not safe to commit as-is`** with eleven findings, and that verdict
is the reason this phase has a fix round at all. `docs/reviews/2a-3b-codex.md` is the review verbatim;
`docs/decisions/2a-3b-notes.md` §12 is the finding-by-finding disposition. Seven were fixed outright,
four partly fixed with the residue disposed against a named standing rule, and **two of them falsified
sentences the notes had already written** — §4's rotation ordering and §7's *"the attempt, and nothing
else"* — which were rewritten rather than annotated beside the old claim.

**Nine new disabling experiments (E30–E38) all fire**, and E25–E29b were re-measured after the fixes:
E28 dropped from 4 tests to 3 because the ownership marker is now a second defence behind the name
grammar, and E27 now requires both halves of the change to be reverted before it fires. Both sabotaged
files were restored `cmp`-identical.

**The confirmation round added three more (E39a–E39c), and all three fire.** E39a reproduces the
residue itself — `discard` recording nothing when its removal fails, and the retry then refused with
`DestinationExists`; E39b removes the other half, the publish's willingness to use the name it recorded;
E39c drops the guard entirely and fires on the case the fix deliberately does **not** widen, two targets
resolving to one backup path. `persist/backup.rs` was restored `cmp`-identical after each.

**The orchestrator spot-verified the three riskiest fixes directly in the source**, not on the worker's
report: rotation now runs *after* the copy is written and fsynced (`backup.rs` `capture`), the current
batch is excluded from rotation by its `(device, inode)` pair rather than by where its name sorts
(`rotate`'s property 4), and `remove_dir_all` is dominated by the `carries_batch_marker` check.

**The confirmation pass answered those same three questions independently**, and its answers are why
the phase closed here rather than after the first fix round:

| Question | Verdict |
|---|---|
| Can rotation remove a directory holding a copy the running session just took — under a backward clock, or with ten future-dated batches present? | **No.** The copy is published before rotation, and the current batch is excluded by path or `(device, inode)` regardless of timestamp ordering |
| Can the temp-then-publish and `discard` leave an orphan, or make a legitimate retry fail? | **Yes** — the one residue, now closed by `publish_backup`'s disambiguation |
| Does the ownership marker dominate every reachable `remove_dir_all`? | **Yes.** The sole reachable call consumes only `batches`, and an entry joins that collection only after `carries_batch_marker` succeeds |

**Its first attempt stalled and was cancelled**, with `updatedAt` frozen while the job kept reading —
it had been pointed at four files totalling some 5,600 lines. The relaunch named **exact line ranges**
and three questions, and returned in under two minutes. That is the operational lesson worth keeping:
a confirmation pass is a set of questions about named lines, not a second full review.

---

## Verification — Phase 2a-3a

Every command below was run by the orchestrator **after** the review fix round, each as its own
invocation, not taken on the worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo build --workspace` | ✅ clean |
| `cargo test --workspace` | ✅ **736 tests across 19 binaries**, 0 failed (**+13** on 2a-2b's 723: 8 for the copy itself, then 5 more in the fix round — 4 unit tests on `verify_temp_identity` and the widening-window invariant) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way, with `libc` newly in the tree |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 cargo test -p espansoconfig-core --test persist_save -- saving_the_real_configuration` | ✅ **not a vacuous skip** — run with the switch that makes the corpus mandatory; 13 files, 65 matches, 0 refusals |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1); no corpus fixture modified |

**Two macOS behaviours were measured by the orchestrator directly, not taken from either the worker or
the reviewer**, because the whole safety of the step ordering rests on them:

| Question | Command | Answer |
|---|---|---|
| Does `chmod` clear a macOS ACL? | `chmod +a "everyone deny write" f` · `ls -le f` · `chmod 0644 f` · `ls -le f` | **No** — `0: group:everyone deny write` survives. So copying the ACL and *then* applying the mode never discards it |
| Does writing data clear extended attributes? | `xattr -w com.apple.metadata:kMDItemFinderComment …` then a full overwrite, then `xattr -p` | **No** — the value reads back intact. So the reordered write-then-copy is safe in the other direction too |

**The disabling experiments were re-run and reported by the worker**, and are the evidence the tests
are load-bearing rather than decorative: removing the `copy_metadata` call fails **4** tests (3 in
`persist_write`, 1 in `persist_save`); restoring the *old* step ordering fires the new
widening-window test. `write.rs` was restored byte-identically after each, checked with `diff`.

---

## Verification — Phase 2a-2b

Every command below was run by the orchestrator **after** the review fix round, each as its own
invocation, not taken on the worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` | ✅ **723 tests across 19 binaries**, 0 failed (**+45** on 2a-2a's 678: 29 integration in the new `persist_save.rs`, 16 unit across `persist/save.rs` and `persist/write.rs`) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `ESPANSOCONFIG_REQUIRE_REAL_CORPUS=1 cargo test -p espansoconfig-core --test persist_save -- saving_the_real_configuration` | ✅ **not a vacuous skip** — run with the switch that makes the corpus mandatory |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1); no corpus fixture modified |

**The real-corpus run, reported as counts only (D1).** 13 files, 65 matches walked; each file saved
**twice** — once with an empty batch, which exercises the lock, the read, the hash, the
reparse-verify, the projection, the semantic gate and the policy without changing a byte, and once
with a real scalar edit, which additionally exercises the commit. **13 files edited and committed, 0
saves refused by either gate.** Every committed file's bytes were checked by an independent rebuild
from the declared replacements rather than by trusting the candidate.

**`persist_write.rs` still passes 25/25 unchanged**, which is the check that mattered after this
sub-phase modified 2a-1's `inspect_target`. The `O_NONBLOCK` constant is hand-written per platform, so
the test that guards it — `the_non_blocking_flag_opens_a_fifo_without_waiting_for_a_writer` — pins its
**meaning** and not its number: a wrong constant fails rather than silently disabling the fix.

**Two verification facts that are not commands.** **No dependency was added**, in any section, by
either round — the fifo test shells out to `mkfifo(1)` and skips cleanly where it is absent. And
**eighteen disabling experiments** were run across the two rounds; every one fired a **named** test
except E7, which fired nothing and is the reason a test exists that did not before. Every sabotage was
reverted and the touched files diffed byte-identical against pre-experiment copies afterwards.

---

## Verification — Phase 2a-2a

Every command below was run by the orchestrator **after** the review fix round, each as its own
invocation, not taken on the worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo test --workspace` | ✅ **678 tests across 18 binaries**, 0 failed (**+78** on 2a-1's 600: 70 integration in the new `validate_semantics.rs`, 8 unit in `validate/mod.rs`) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way, and re-checked because this sub-phase adds a dependency |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1) |

**The real-corpus run, reported as counts only (D1).** 13 files, 65 matches, 38 variables and **0
regex triggers** walked; **`EditorModelError` 0, `SuspiciousButPermitted` 0** — after the opener
narrowing, which is the direction that could have broken it. The walked-counts are asserted alongside
the zeros, so the zero cannot pass vacuously on an empty walk.

**Two verification facts that are not commands.** The `regex` crate is this crate's **first
production dependency since Phase 0a** — approved in advance against plan §6.6, which names it. And
**22 disabling experiments** were run across the two rounds (E12–E22 in the fix round alone); every
one fired a **named** test, and both source files were diffed byte-identical against pre-experiment
copies afterwards.

---

## Verification — Phase 2a-1

Every command below was run by the orchestrator **after** the review fix round, each as its own
invocation, not taken on the worker's report.

| Command | Result |
|---|---|
| `cargo fmt --check` | ✅ clean |
| `cargo build --workspace` | ✅ clean |
| `cargo test --workspace` | ✅ **600 tests across 17 binaries**, 0 failed (**+41**: 25 integration in the new `persist_write.rs`, 14 unit in `write.rs`, and the pre-existing binaries unchanged) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `git diff --stat -- crates/espansoconfig-core/tests/corpus/` | ✅ **empty** — no fixture's bytes changed |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1) |

The frontend suite was **not** run and is unchanged: this sub-phase touches no file under `src/` or
`src-tauri/`, adds no user-facing string and no dictionary key.

**Acceptance criteria, and whether each was met:**

| Criterion | Met | Evidence |
|---|---|---|
| Plan §6.6 steps 1, 2, 6–11 implemented, and no more | ✅ | `write.rs` is the only code in the crate that opens a file for writing. Steps 3–5 and 12–13 are absent by design and named in the module doc as 2a-2's and 2a-3's |
| A stale base revision refuses and leaves the file byte-identical | ✅ | `RevisionMismatch` carries both the expected and the found revision; pinned by test |
| A missing target refuses and creates nothing | ✅ | `TargetMissing`; the directory is enumerated afterwards and holds only what it held |
| The temp file cannot be matched by espanso's `[!_]*.yml` | ✅ | Asserted against the name `temp_file_name()` actually mints, not a hard-coded string. Two independent reasons: the leading `_` and the non-`.yml` suffix |
| No temp file survives success, refusal or an I/O error | ✅ | RAII guard disarmed only after a successful rename; a test unwinds the stack and checks. **Crash and abort are excluded and said to be** — a leftover is harmless *because of the name* |
| Mode bits are preserved | ✅ **renamed at the review** | The temp file is created `0o600` and widened, never briefly wider than the target. It is **mode bits**, not "permissions" — eight dropped metadata classes are enumerated |
| Symlink behaviour is decided, documented and pinned | ✅ | The target is `canonicalize`d before it is locked, hashed or written, so the real file receives the bytes and the symlink survives. A dangling symlink is `TargetMissing`. A retarget mid-call is refused by `recheck_target()` |
| Concurrent writers cannot lose an update | ✅ **after the review** | The original test would have passed with no mutex at all. `concurrent_read_modify_write_never_loses_an_update` has each writer append a unique line; it **fails with the lock removed** |
| A byte-exact fixture survives a round trip through the writer | ✅ **after the review** | The original sweep seeded each copy with the fixture's own bytes and a no-op writer passed it. Each copy is now seeded with a contradicting placeholder, and a companion test asserts both that the fixtures hold the hazards and that the placeholder contradicts them |
| No new production dependency | ✅ | `std` only; `O_NOFOLLOW` spelled out per target family with its **meaning** pinned by an `ELOOP` assertion |
| The primitive promises only what it can deliver | ✅ **after the review** | The "only if" claim was false against non-cooperating writers and is gone. D4 |
| Durability is not overclaimed | ✅ **after the review** | `std` does issue `F_FULLFSYNC` on Apple targets (verified in `rust-src`), so the bytes are power-cut durable — but `ENOTSUP` has no fallback and the **directory** sync is best effort, so the rename that publishes them is not |
| The residual external-writer race | ❌ **narrowed to one rename, not closed** | Unclosable without cooperating writers. D4, and 2a-3's backups plus 2d's watcher are its recovery path |
| `sync_all` and the read-back have a disabling experiment | ❌ **stated as a hole in the reviewer's terms** | No test would fail if either were removed; neither is reproducible from user space. One narrowing found: with the lock removed, the read-back verification *does* fire |
| A second process is exercised | ❌ **no test involves one** | Every test is in-process. The class of defect D4 describes is therefore reasoned about, not measured |

## Verification — Phase 1c-2b-2b-2

| Command | Result |
|---|---|
| `cargo test --workspace` | ✅ **561 tests**, 0 failed — unchanged, because this sub-phase adds no Rust |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo fmt --check` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `npm test` | ✅ **662 tests across 27 files**, 0 failed (**+77**: 19 in a new `rawDocument.test.ts`, 16 in `workspace.test.ts`, 42 in `sourceText.test.ts`) |
| `npm run check` | ✅ 374 files, **0 errors, 0 warnings** (`--fail-on-warnings`) |
| `npm run build` | ✅ built; `dist/assets/index-CgRncva7.js` 113.30 kB |
| dictionary keys | ✅ **248 and 248** (240 before — **+8**, one of the eight reworded at the review; no pre-existing key touched) |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1) |

**Acceptance criteria, and whether each was met:**

| Criterion | Met | Evidence |
|---|---|---|
| A whole document is on a screen, through the **existing** primitive | ✅ | `documentText()` has a caller at last; `<SourceText text={view.text} documentStart />` is the one call entitled to that flag, and no second renderer for file text exists |
| The `notUtf8` refusal has a screen and does not look like an empty file | ✅ | 1c-2b-2a hole 8, closed. Read in both languages: *This app cannot show this file's text.* above the typed sentence naming byte offset 49. An empty file says something else again |
| The five open fidelity rows are filled by a **window reading** | ✅ | A real BOM, a NUL, five other C0/C1 controls, a lone CR and a file with no final newline, each seen in WKWebView. Notes §5 and §6 |
| Hole 9 — what a large document costs — is measured | ✅ | `2n` segments for *n* lines, asserted to 968 000 bytes; **45 ms and 4 409 DOM nodes** for the largest real file (631 lines, 17 840 bytes) in a window. Nothing is capped, and the reason is written down |
| **Phase 1's exit, checked over the real corpus** | ✅ | 13 files, 0 load failures, 0 findings, every file's whole text rendered, **all 65 snippets clicked and rendered** with 3–6 sections and exactly one source box each. Notes §8, counts only |
| No user-facing string is hardcoded | ✅ | 8 new keys in both languages through typed accessors; R31's blind spots enumerated by name in notes §10.1 |
| Every experiment fires, or the code changes | ✅ | **20** experiments (A–T); **three did not fire**, and two of them changed the code — a dead `force` flag deleted, a too-weak markup scan strengthened until it fired, and an unreachable guard kept with its status written on it. T is the review round's, and thirteen of the twenty were re-run there |
| Every sentence on a screen is true of every case under it | ✅ **after the review** | The as-written caption was **false for line endings** — a CRLF and an LF draw as identical unlabelled breaks — and was reworded in both languages. Notes §4.2, read on a screen in §6.5 |
| No path removes the viewer's target while keeping its snapshot | ✅ **after the review** | `forgetFileText()`, called from `readFileText()` whenever the target is `null`, so every clearing path is covered by one call. Notes §2.3, experiment T |
| The Spanish strings are Spanish | ➖ **unchanged gap** | 8 new Spanish strings read on screen by their author. A bilingual reviewer remains the only instrument that closes this |
| Holes 5, 16 and 2 from earlier sub-phases | ❌ **left open, named, with reasons** | Notes §9 items 2, 4 and 3. Hole 2 is now **seen** rather than argued: a parse-failed file and an empty one show the same `0` on adjacent sidebar rows |

## Verification — Phase 1c-2b-2b-1

Every command below was run by the orchestrator **after** the review fix round, not taken on the
worker's report.

| Command | Result |
|---|---|
| `cargo test --workspace` | ✅ **561 tests**, 0 failed (559 at 1c-2b-2a's close; the two new ones are the measurements findings 2 and 4 demanded) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo fmt --check` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `npm test` | ✅ **583 tests across 26 files**, 0 failed (480 at 1c-2b-2a's close — **+103**) |
| `npm run check` | ✅ 372 files, **0 errors, 0 warnings** (`--fail-on-warnings`) |
| `npm run build` | ✅ built; `dist/assets/index-*.js` 109.11 kB |
| `rg -c '^\s*"' src/lib/i18n/{en,es}.json` | ✅ **240 and 240** (226 before — **+14**, one of them replacing a reworded key's claim) |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1) |

**Acceptance criteria, and whether each was met:**

| Criterion | Met | Evidence |
|---|---|---|
| A match's own bytes are on a screen | ✅ | A *Source text* section renders `MatchView.source_text` through the primitive. Read in a window in both languages |
| The sentence describing them is true of **every** shape the projection produces | ✅ **after the review** | It was false for a flow item, a zero-width item and a terminal empty value. Now shape-neutral, and the three shapes are pinned by `every_shape_a_matches_sequence_can_hold_is_projected_with_its_own_span` |
| An unmodelled entry's value is on a screen | ✅ | `UnknownRow.value: SourceSlice`, rendered by the same primitive |
| The string saying it is **not** shown travelled in the same change | ✅ | `browser.detail.unknownValue` reworded in the same commit; `detail.test.ts` holds a suite asserting both withdrawn sentences are gone, and experiments F and G each fire it |
| Each of the three `SourceSlice` arms says something true of that arm | ✅ **after the review** | Review finding 1. The as-written claim now sits in the `text` arm only, with a position check that fails if it moves back up |
| Rendering is byte-faithful, and it is **measured** | ✅ | `sourceCharacters()` round trip is the oracle; the window reading holds `65 301` uncomposed beside `e9`, `1f600` whole, two trailing spaces as `20 20`, **no `0d` in the DOM**, `white-space` computed `pre`, and `scrollWidth > clientWidth` (it scrolls, it does not wrap) |
| A character with no glyph is named, and the claim matches the classifier | ✅ **after the review** | Review finding 3. Widened to the zero-width, soft-hyphen and bidi sets; joiners and variation selectors excluded **with a stated reason**; every prose claim narrowed to the enumeration |
| No user-facing string is hardcoded | ✅ | 14 new keys in both languages, all through typed accessors; `built-translation-keys.ts` covers the new component. R31's blind spots enumerated by name in notes §8.1 rather than assumed clean |
| Source text cannot become markup | ✅ | No `{@html}` anywhere; file text reaches the DOM as text-node content only. Confirmed by the reviewer |
| **WKWebView is covered** | ✅ **first evidence in this project** | 1c-2b-2a §4.3's named limitation. The reading is the first measurement past Tauri's encoder — narrow, and stated narrowly in notes §5.1 |
| The `unavailable` arm has been seen | ❌ **no, and said so** | Reachable only through a defect, and nothing here instantiates a Svelte component. Hole 8 |
| The Spanish strings are Spanish | ➖ **unchanged gap** | 14 new Spanish strings read on screen by their author. A bilingual reviewer remains the only instrument that closes this |

## Verification — Phase 1c-2b-2a

Every command below was run by the orchestrator **after** the review fix round, not taken on the
worker's report.

| Command | Result |
|---|---|
| `cargo test --workspace` | ✅ **559 tests across 16 binaries**, 0 failed (547 at 1c-2b-1's close; `src-tauri` 73 → 75) |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo fmt --check` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `npm test` | ✅ **480 tests across 25 files**, 0 failed |
| `npm run check` | ✅ 369 files, **0 errors, 0 warnings** (run with `--fail-on-warnings`) |
| `npm run build` | ✅ built; `dist/assets/index-*.js` 103.17 kB |
| `rg -c '^\s*"' src/lib/i18n/{en,es}.json` | ✅ **226 and 226** — unchanged, re-derived not quoted; the sub-phase adds no string |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1) |

**Acceptance criteria, and whether each was met:**

| Criterion | Met | Evidence |
|---|---|---|
| `document_text` is a registered, reachable command | ✅ | Seventh in `generate_handler!`; `dispatch_check.rs` **invokes** all seven with `"permissions": []` rather than arguing from the handler list. `wire_contract.rs` still asserts the six forbidden Phase 2 names absent from both sets |
| The unmodelled entry's value text is on the wire, sliced in Rust | ✅ | `UnknownEntry.value_text`, mirrored in `src/lib/ipc/types.ts`. Experiment J — slicing by `chars()` instead of bytes — fails four tests |
| Every byte hazard survives the crossing | ✅ **for valid UTF-8** | 33 fixtures / 37 406 bytes byte-identical through the **real dispatcher**, plus NUL and U+2028/9 asserted at three levels. The qualification is the point: see the next row |
| The contract is stated no wider than it holds | ✅ **after the review** | Narrowed to *exact preservation of valid UTF-8, typed refusal otherwise*. Invalid UTF-8 is `NotUtf8 { path, offset }` — verified independently in `crates/espansoconfig-core/src/workspace/mod.rs:634`, `String::from_utf8`, never `from_utf8_lossy` |
| Both new values are proven **through the dispatcher** | ✅ **after the review** | This was false at first submission for `value_text` and is review finding 2 |
| No user-facing string is hardcoded | ✅ **and cheaply** | The sub-phase adds **no** user-facing string — 226 keys before and after. R31's blind spots still hold in general and are enumerated by name in the notes |
| No screen changed | ✅ | `detail.ts` and `DetailPane.svelte` are comment-only edits; `value_text` is deliberately unread, so the existing "value not shown" strings stay true |
| WKWebView is covered | ❌ **not established, and said so** | `mock_builder()` swaps it out. Named as a limitation in notes §4.3; closing it needs a window reading, which is 1c-2b-2b's |
| The Spanish strings are Spanish | ➖ **not applicable** | No new Spanish prose this sub-phase. The standing gap is unchanged |

## Verification — Phase 1c-2b-1

Every command below was run by the orchestrator after the **second** fix round, not taken on the
worker's report.

| Command | Result |
|---|---|
| `npm test` | ✅ **479 tests across 25 files**, 0 failed (412 at 1c-2a's close) |
| `npm run check` | ✅ 369 files, **0 errors, 0 warnings** (run with `--fail-on-warnings`) |
| `npm run build` | ✅ built; `dist/assets/index-*.js` 103.17 kB |
| `cargo test --workspace` | ✅ 16 binaries, **0 failed** across every suite |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo fmt --check` | ✅ clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | ✅ **no match** — the architecture rule, checked the D2x way |
| `rg render_probe src src-tauri/src scripts` | ✅ **no match** — the temporary R32 probe is fully reverted |
| `rg -c '^\s*"' src/lib/i18n/{en,es}.json` | ✅ **226 and 226** — re-derived, not quoted (218 at 1c-2a's close) |
| `git status --short --untracked-files=all` | ✅ no real-corpus path appears (D1) |

**Acceptance criteria, and whether each was met:**

| Criterion | Met | Evidence |
|---|---|---|
| `HazardKind` reaches a screen | ✅ | `matchEditability()` and `findings.ts`; the window reading shows a refusal on one snippet and its absence on a sibling one click later, in both languages |
| The diagnostics reach a screen | ✅ | `DocumentView.diagnostics` rendered in the middle pane; the reading shows a parse error with line and column for a zero-match file, and `RootIsNotAMapping` for a profile |
| *Could not be read* is distinguishable from *not read yet* | ✅ | `loadFailures` keyed on `DocumentId`; the reading shows "Could not be read" beside a `–` on two sidebar rows. The reviewer independently confirmed every production read site is updated and a refused document is excluded from `pending` |
| No user-facing string is hardcoded | ⚠️ **partially checkable** | The markup scan and `built-translation-keys.ts` pass, but **R31 still holds**: `hardcoded-strings.ts` sees `.svelte` markup only. The four blind spots are enumerated by name in the notes rather than assumed clean, and experiment Y shows a raw identifier reaching the markup while every test passes |
| Every new string is backed by data that exists | ✅ **after three failures** | Findings 1, 8 and the self-found `notEditable` claim were all this defect. The reviewer verified the corrected `notEditable` against `disqualifying_hazard`'s actual range in `crates/espansoconfig-core/src/syntax/trivia.rs:601` |
| A claim about a screen rests on a reading of a screen | ✅ | Two readings, both languages, probe removed and files byte-restored each time. The stale 1c-2a evidence was re-taken too, and `getComputedStyle` proved `.depth-0` / `.depth-1` in the unscoped `src/app.css` are **applied** (0px / 14px), which no earlier evidence established |
| The Spanish strings are Spanish | ❌ **not established** | Unchanged and unchangeable by any check here — the untranslated-value test establishes non-identity, not meaning. Eight new Spanish values this sub-phase, unreviewed prose. Only a bilingual reader closes this |

## Verification — Phase 1c-2a

Every command below was run by the orchestrator after the fix round, not taken on the worker's report.

| Command | Result |
|---|---|
| `npm test` | ✅ **412 tests across 24 files**, 0 failed |
| `npm run check` | ✅ 366 files, **0 errors, 0 warnings** (run with `--fail-on-warnings`) |
| `npm run build` | ✅ built; `dist/assets/index-*.js` 98.33 kB |
| `cargo test --workspace` | ✅ all suites pass, 0 failed |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ clean |
| `cargo fmt --check` | ✅ clean |
| `rg render_probe src src-tauri/src scripts` | ✅ **no match** — the temporary R32 probe is fully reverted |
| `rg -c '^\s*"' src/lib/i18n/{en,es}.json` | ✅ **218 and 218** — the key parity finding 4 was about, re-derived rather than quoted |

**Acceptance criteria, and whether each was met:**

| Criterion | Met | Evidence |
|---|---|---|
| Every §3.3 field renders when the source has it | ✅ | `describeMatch()` collects all 22; the equality test pins the emitted set against `DetailFieldName` |
| §3.4's nine variable types and §3.5's forms render | ✅ | `describeVariable()`; the window reading shows three variable cards and a form's fields |
| A scalar renders as source text, never an inferred type (D2u) | ✅ | **Seen on a screen**: `word: on` renders as `on`; no checkbox exists in the pane |
| Absent is distinguished from empty | ✅ | Seen side by side on two screens; the one wire-level exception is stated as hole 2 |
| No hardcoded user-facing string | ✅ | Both lints pass, **and** R31's four blind spots are enumerated by name in the notes §8 rather than assumed clean |
| The five uncalled accessors get real callers | ✅ | `tTriggerKind`, `tContentKind`, `tVariableKind`, `tScalarStyle`, `tUnknownReason`, plus the new `tValueKind`, `tDetailField`, `tUnknownCount` |
| A claim about a screen is backed by a reading of a screen (R32) | ✅ | Two readings, both languages, the second **re-taken after the fix round changed the component** |
| No real config content anywhere | ✅ | The readings ran against a hand-written synthetic config with `XDG_CONFIG_HOME` **and** `HOME` overridden |

**What the verification does *not* establish**, carried forward as stated holes: no component is
rendered by any automated test; no pixels, so the indentation and the bullet are known to exist in the
markup and the stylesheet but not known to *paint*; `Alias`, `Elided` and a non-scalar mapping key are
unit-tested and were never on a screen; and nothing establishes that the 50 new Spanish values are
Spanish beyond one bilingual reading.

## Verification — Phase 1c-1

Every command below was run by the **orchestrator** against the working tree, **after** the review fix
round and after the R32 readings were re-taken, not reported by a worker. All exit 0.

| Command | Result |
|---|---|
| `npm run check` | 364 files, **0 errors, 0 warnings** (`--fail-on-warnings`) |
| `npm test` | **354 passed** across 23 files (from 318 across 21) |
| `npm run build` | ok — `dist/assets/index-*.js` 81.30 kB |
| `cargo test --workspace` | 16 suites, **0 failed** anywhere |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | **no output** — the architecture rule holds (D2x) |

Two things were checked by the orchestrator **independently of any worker's claim**, because both are
claims a passing test cannot make:

- **The IPC layer really is in the shipped bundle.** `rg -o` over `dist/assets/*.js` finds
  `open_workspace`, `list_documents`, `get_document`, `get_match` and `set_menu_labels`. `document_text`
  is **absent**, which is correct — the raw YAML viewer is 1c-2 and nothing calls it yet. This is R32's
  first half, the oldest debt in the project, discharged by measurement.
- **The core's search haystack really does cover plan §8.1's five fields.** Read out of
  `build_search_text()` directly rather than taken from the phase's summary: trigger, `triggers`, `regex`,
  label, content, comment and `search_terms`.

The R32 window readings are `docs/decisions/1c-1-notes.md` §10, and they were **re-taken after the fix
round** on the orchestrator's instruction, because that round edited `Sidebar.svelte` and
`DetailPane.svelte` and **nothing in this project renders a Svelte component in an automated test**. A
runtime error in either would have produced an empty pane that all 354 tests pass straight through.
`git status --short` after the readings is byte-identical to before them: the temporary probe is gone.

## Verification — Phase 1b-2b

Every command below was run by the **orchestrator** against the working tree, **after** the review
fix round, not reported by the worker. All exit 0.

| Command | Result |
|---|---|
| `cargo test --workspace` | **544 passed, 0 failed** (was 514) |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** — the architecture rule holds (D2x's check, not the withdrawn `rg -c tauri Cargo.lock`) |
| `npm run check` | 344 files, **0 errors, 0 warnings** (`--fail-on-warnings`) |
| `npm test` | **214 passed** (was 104) |
| `npm run build` | ok — 60.79 kB JS, 1.59 kB CSS |

**Six claims were checked by hand rather than taken from a worker's report**, each because it is a
rule a phase can quietly undo:

- `src-tauri/capabilities/default.json` is still **`"permissions": []`**, and its `description` now
  carries the reasoning so the next phase cannot re-open it by accident.
- **Six** `#[tauri::command]` attributes exist — five in `commands.rs`, one in `menu.rs` — and the
  `generate_handler!` list holds exactly those six. None mutates a file.
- `CommandError` still has **no `Display` impl** anywhere in the crate.
- `syn` and `proc-macro2` are **`[dev-dependencies]` of `src-tauri` only**. `cargo tree -p
  espansoconfig-core -e normal,build,dev -i syn` shows the core reaches `syn` **only** through
  `serde_derive` and `thiserror-impl`, which are proc-macros and were already there before this
  phase. The core's own `Cargo.toml` names neither `syn` nor `tauri`.
- The dictionaries hold **138 keys each**, 111 under `code.` and 16 under `menu.`, with **8 values
  identical across the two files** — matching the exception list exactly, no silent growth.
- **Corpus privacy (D1) intact**: no `corpus/real` path appears anywhere in the tree status, and
  `git check-ignore -v` still resolves the real corpus to `.gitignore:107`.

**The Spanish was read, by a reader, and it is Spanish.** Hole 9 correctly says nothing automated
establishes this — the untranslated-value check establishes only non-identity. A sample of the
`menu.*` block and the first `code.diagnosticCode.*` entries was read in full: the register is right,
the quotation marks are Spanish (`«…»`, not `"…"`), the phrasing is idiomatic rather than calqued
(*"No se ha podido indexar este archivo"*, *"así que"*), and the menu labels are **Apple's own**
Spanish strings — `Edición`, `Ocultar los demás`, `Mostrar todo`, `Seleccionar todo` — rather than
literal translations of the English. This is a **sample read by one reader, not a review of all 111
values**, and hole 9 stays open on those terms.

**R32 was discharged for the menu, and re-run after the fix round changed the thing it measured.**
The fix round altered `set_menu_labels`' signature and the main-thread step, which made the first
reading a description of a slightly different program — so it was taken again against the current
binary rather than carried forward:

- **Spanish** (`-AppleLanguages '(es-ES)'`): the real macOS menu bar read out of the accessibility
  tree gives `Apple, espansoconfig, Edición, Ventana`, with `Acerca de espansoConfig` … `Salir de
  espansoConfig` in the app submenu and `Deshacer, Rehacer, Cortar, Copiar, Pegar, Seleccionar todo`
  under `Edición`.
- **English** (`(en-US)`): `Apple, espansoconfig, Edit, Window`, likewise complete.
- **Every answer is byte-identical to the pre-review reading**, which is what makes it a regression
  check rather than a fresh anecdote.
- **The one-shot channel does not deadlock**: the menu is installed, so the closure ran and the
  channel delivered, and `sample <pid>` shows the main thread idle in `__CFRunLoopServiceMachPort`
  rather than parked in `recv`. `Ok(())` now genuinely means *installed*.
- **The untyped envelope parsed** — a refusal would have left Tauri's `File, Edit, View, Window,
  Help` default standing, which is exactly the failure the first reading could not have
  distinguished.

**Two things were not verified at runtime, and both are recorded as holes rather than assumed.** The
**live** locale switch did not reproduce this time: `System Events` reports 0 windows for the process,
so there is no `window 1` to find the picker in, while `CGWindowListCopyWindowInfo` shows the window
on screen at 1063×685. That is not a code fault, and the discriminating test says so — the
**development-mode** binary, which never runs the frontend and never calls `set_menu_labels` at all,
reports the same 0 windows. Closing it needs a bundled `.app`, which is Phase 5. And
`invalidMenuLabels` cannot be reached without a skewed frontend or a webview console; it is covered by
three `dispatch_check` tests through the real dispatcher instead. `1b-2b-notes.md` §12.5 states both.

## Verification — Phase 1b-2a

Every command below was run by the orchestrator **after** the review fix round, not reported by the
worker. All exit 0.

| Command | Result |
|---|---|
| `cargo build --workspace` | ok |
| `cargo test --workspace` | **514 passed, 0 failed** (core 478, was 471; shell 36, was 1) |
| `cargo clippy --workspace --all-targets -- -D warnings` | clean |
| `cargo fmt --check` | clean |
| `cargo tree -p espansoconfig-core \| rg tauri` | **empty** — the architecture rule holds (D2x's check, not the withdrawn `rg -c tauri Cargo.lock`) |
| `npm run check` | 336 files, **0 errors, 0 warnings** (`--fail-on-warnings`) |
| `npm test` | **104 passed** (was 97) |
| `npm run build` | ok — 38.87 kB JS, 1.59 kB CSS |

Three claims were checked by hand rather than taken from the worker's report, because each is a rule
a phase can quietly undo: `src-tauri/capabilities/default.json` is still `"permissions": []`; exactly
five `#[tauri::command]` attributes exist and `rg` finds no forbidden name in `main.rs` or
`commands.rs` outside a comment; and `CommandError` has no `Display` impl anywhere in the crate.

**R31 was honoured explicitly, and a clean lint run is not the evidence.** `scripts/lint/hardcoded-strings.ts`
scans `.svelte` markup only, and this phase's user-facing strings would live in `.ts` — exactly the class
it cannot see. The check was done by hand; `classifyFailure()`'s `detail` field is documented as a
**developer** string that must never be rendered, and giving the unexpected arm its one generic
dictionary key is 1b-2b's job.

## Verification — Phase 1b-1

Every command below was run by the **orchestrator** against the working tree, **after** the review fix
round, not reported by the worker:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **472 passed, 0 failed, 0 ignored**, across 16 binaries |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |
| `cargo tree -p espansoconfig-core \| rg tauri` | **no output** — the rule holds (D2x) |
| `npm run check` | exit 0 — svelte-check, **0 errors 0 warnings** over 328 files, run with `--fail-on-warnings` |
| `npm run build` | exit 0 — 38.87 kB JS / 1.59 kB CSS, the CSS **external** (which is what makes the production CSP tightenable) |
| `npm test` | exit 0 — **71 passed** across 8 files (45 across 5 before the fix round) |
| `cargo test -p espansoconfig-core --test corpus_integrity` | exit 0 — 17 passed, the fixtures are untouched |

Test count moved 471 → **472**: one Rust test, and it is named for exactly what it can fail on —
`the_core_dependency_is_callable_from_the_test_target`. It is **not** evidence that a production build
references the core, because that reference lives inside `#[cfg(test)]` and no production one exists
yet; the review's finding 8 is that the earlier name (`the_core_crate_is_linked_and_callable`) claimed
otherwise. **No Phase 0 or 1a test was ignored, weakened or deleted**, and the only tracked files the
phase modified are
`Cargo.toml` (one workspace member, two workspace dependencies) and `Cargo.lock`. Nothing under
`crates/espansoconfig-core/src/` or `tests/` changed at all, which is why the 471 carry over unexamined.

**Architecture rule re-verified by the new check** (D2x): `cargo tree -p espansoconfig-core --depth 1`
lists `saphyr-parser`, `serde`, `sha2` and four dev-dependencies. No tauri, direct or transitive.

**Privacy re-verified**: `git status --short --untracked-files=all` shows no path under
`tests/corpus/real/`, and no `node_modules/` or `dist/` path — the pre-existing ignore rules already
covered the frontend.

**Independently spot-checked by the orchestrator**, because the type-level i18n guarantee is the one
claim in this phase that a passing test suite could not establish on its own:
`src/lib/i18n/dictionaries.ts` really does bind `es.json` to `ExactDictionary<typeof es>`, and the
`Record<Exclude<keyof T, TranslationKey>, never>` half really is what rejects a surplus key. The
`identifier` in `src-tauri/tauri.conf.json` is `cc.carpio.espansoConfig`, and `Info.plist` declares
`CFBundleLocalizations`. **The four review fixes were checked in the files rather than taken from the
report**: `"permissions": []`, `minimumSystemVersion: "13.0"`, `'unsafe-inline'` present **only** in
`devCsp`, and `custom-protocol` declared in `src-tauri/Cargo.toml`.

**Seven disabling experiments, each broken, fired and reverted** (A–G in the notes): the macOS floor
dropped to 11.0; a duplicate `app.name` in `es.json`; the document language set after mount rather than
before; `index.html` shipping `lang="es"`; `refreshSystem()` emptied (four tests fired); `refreshSystem()`
also clearing the override; and a no-op `dispose()`. Every new test in this round was shown able to fail.

---

## Verification — Phase 1a

All four run by the orchestrator against the working tree, **after** the review fix round:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **471 passed, 0 failed, 0 ignored**, across 15 binaries |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |

Test count moved 465 (baseline `37cb48d`) → 465 (implementation) → **471** (fix round): +3 projection,
+3 workspace. No test was ignored, weakened or deleted. The suite also passes with
`tests/corpus/real/` absent.

**Architecture rule re-verified**: `rg -c tauri Cargo.lock` finds nothing — `espansoconfig-core` still
has no tauri dependency, direct or transitive, after gaining `serde`.

**Privacy re-verified**: `git status --short --untracked-files=all` shows no path under
`tests/corpus/real/`, and every real-corpus figure is computed rather than hard-coded.

**The load-bearing Phase 0 files were checked by the orchestrator directly**, because a change there is
more dangerous than anything in `model/`: the diffs in `syntax/{mod,node,trivia}.rs`, `patch/path.rs`
and `discovery.rs` are **derive-only** (`Serialize`/`Deserialize`), and `watch/mod.rs` adds one
hand-written `Serialize` emitting the revision as its 64-character hex string rather than as 32
numbers. No Phase 0 behaviour changed, and all 465 Phase 0 tests pass unmodified. The reviewer reached
the same conclusion independently.

**The projection sweep:**

| | Synthetic | Real |
|---|---|---|
| Keys accounted for | 546 | 566 |
| …named (modelled or recorded) | 518 | 566 |
| …inside a recorded undescended span | 28 | 0 |
| Unaccounted keys | 0 | 0 |

---

## Verification — Phase 0c-3b-2b

All four run by the orchestrator against the working tree, **after** the review fix round:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **439 passed, 0 failed, 0 ignored**, across 13 binaries |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |

Test count moved 423 (baseline `d40ec0e`) → 434 (implementation) → **439** (fix round). No test was
ignored, weakened or deleted at any point. The suite also passes with `tests/corpus/real/` absent.

**Privacy re-verified**: `git status --short --untracked-files=all` shows no path under
`tests/corpus/real/`, and every real-corpus figure is computed rather than hard-coded.

**The gate sweep**, exhaustive over both corpora:

| | Synthetic | Real |
|---|---|---|
| Attempts | 2 080 | 1 998 |
| Applied | 1 696 | 1 851 |
| Verification failures | 0 | 0 |

48-cell axis×operation matrix, **no `Absent` cell**, 18 `RefusedOnly` each enumerated. Refusals per hazard
family, attempts / applications: merge keys 23/0, aliases 9/0, anchors 31/0, explicit keys 11/0, tags 9/0,
duplicate keys 15/0, multi-document 33/0, flow comments 18/0.

**Runtime, after memoising `ownership.rs` (R19):** gate binary **34.3 s → 16.9 s** while becoming
exhaustive; whole suite **87.9 s → 39.4 s**.

---

## Verification — Phase 0c-3b-2a

All four run by the orchestrator against the working tree, **after** the review fix round:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **423 passed, 0 failed, 0 ignored**, across 12 binaries |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |

Test count moved 383 (baseline `e712467`) → 411 (implementation) → **423** (fix round). No test was
ignored, weakened or deleted at any point.

**Privacy re-verified after the phase**, per `CLAUDE.md` §1: `./scripts/sync-real-corpus.sh` reports its
ignore-rule probe verified, `git check-ignore -v` resolves the real corpus to `.gitignore:107`, and
`git status --short --untracked-files=all` shows **no path under `tests/corpus/real/`**.

**Headline sweep figures** (synthetic pinned per fixture with the table asserted to cover the corpus
exactly; real corpus computed, never hard-coded, and skipping cleanly when absent):

| Sweep | Synthetic | Real |
|---|---|---|
| Moves | 2 571 attempted, 1 790 applied | 340 attempted, 126 applied |
| Structural edits | 2 974 attempted | 1 856 attempted |
| Scalar edits | 5 700 attempted, 5 359 applied | 2 004 attempted |

New refusal counts: `MoveWouldTerminateTheFinalLine` 3, `MoveSeam::CarriedRunsJoin` 2,
R23-for-moves 3, `MoveWouldExtendAKeptBlock` 8 — synthetic; **0 in every new category on the real
corpus**, which is unchanged at 13 files / 340 attempts / 126 applied across both rounds.

The corpus grew 30 → 32 fixtures; every pinned count that moved is retabulated with its delta attributed
to a named fixture in `docs/decisions/0c-3b-2a-notes.md` §5.2. One regression is deliberate and pinned:
`block-scalar-terminal-spaces.yml` now offers **no applied move at all**, which is the measured cost of
refusing the EOF rotation.

---

## Verification — Phase 0c-3a

All run at the repo root by the orchestrator, independently of the phase worker's own claims, all
exit 0:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **366 tests pass** (202 unit + 13 corpus integrity + 32 parser evaluation + 12 patch edit + 15 patch path + 11 patch structure + 4 real corpus + 15 scalar codec + 30 span layer + 32 trivia scanner) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo doc --no-deps -p espansoconfig-core` | exit 0, no warnings |
| Same suite with `tests/corpus/real/` renamed away | exit 0 — 366 pass; `patch_structure` drops from 17.8 s to 3.7 s and `patch_edit` from 21.1 s to 7.8 s, which is the real-corpus sweep skipping cleanly |
| `./scripts/build-byte-exact-fixtures.sh` | exit 0 — regenerating the fixtures leaves the seven previously tracked ones **byte-identical** (`git status` reports no modification), so the generator is faithful rather than merely present |
| `git status --short --untracked-files=all` | no real-config path present ✅ |

The three regression tests that decide whether the fix round succeeded, all passing:
`removing_a_collection_that_holds_a_file_comment_is_refused_rather_than_applied` (renamed
`…_keeps_the_comment_byte_for_byte` in 0c-3b-1, where the refusal became a real edit),
`the_oracle_catches_a_lost_file_comment_that_every_other_check_accepts` (the finding-1 class is visible
to the *oracle*, not merely refused by the planner), and
`a_malformed_batch_is_refused_by_name_and_never_panics`.

Test output prints counts, file names, byte offsets and synthetic values only — no line of real
configuration content, and no count taken from the real corpus is hard-coded.

## Verification — Phase 0c-3b-1

All run at the repo root, all exit 0. The real corpus **was present**, so the real-corpus sweeps ran
rather than skipping:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **383 tests pass** (213 unit + 14 corpus integrity + 32 parser evaluation + 12 patch edit + 15 patch path + 16 patch structure + 4 real corpus + 15 scalar codec + 30 span layer + 32 trivia scanner). It read 377 when the phase first closed; the review's fix round added 2 unit tests, 1 corpus-integrity byte guard and 3 corpus tests |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo doc --no-deps -p espansoconfig-core` | exit 0, no warnings |
| Same suite with `tests/corpus/real/` renamed away | exit 0 — 377 pass; `patch_structure` drops from 18.2 s to 4.0 s and `patch_edit` from 21.1 s to 8.2 s, which is the real-corpus sweep skipping cleanly. Not re-run in the review's fix round: the real corpus was present throughout and both real-corpus sweeps ran |
| `./scripts/build-byte-exact-fixtures.sh` | exit 0 — regenerating leaves every previously tracked fixture **byte-identical** (`git status` reports no modification) |
| `git check-ignore -v …/corpus/real/match/base.yml` | ignored via `.gitignore:107` ✅ |
| `git status --short --untracked-files=all` | no real-config path present ✅ |

The tests that decide whether this phase succeeded, all passing:
`removing_a_collection_that_holds_a_file_comment_keeps_the_comment_byte_for_byte` (the D2o example,
asserted as exact bytes), `the_one_shape_a_run_based_envelope_still_refuses_is_the_block_scalar_above`
(R23, on corpus data), `a_kept_file_comment_keeps_the_blank_lines_on_both_sides_of_it`,
`every_run_of_a_multi_run_envelope_takes_part_in_the_batch_protocol` and
`the_oracle_catches_a_lost_file_comment_that_every_other_check_accepts`, which is layer 3 of the
visibility discipline and had to stay live now that the planner no longer refuses.

The six the **review's fix round** turns on, also all passing:
`a_kept_comment_shallower_than_the_block_above_it_is_not_absorbed` and
`a_kept_comment_shallower_than_the_folded_block_above_it_applies_byte_for_byte` (finding 2, the
reviewer's own case, in a unit test and on corpus data),
`a_blank_run_survives_only_where_it_touches_a_kept_comment` (the blank-run rule, both directions),
`the_preservation_rule_oracle_reports_a_disagreement_in_both_directions` (the rewritten oracle, driven
against run sets no planner can produce),
`an_entry_owned_leading_comment_block_is_deleted_and_the_interior_file_one_is_kept` (the run-boundary
construct neither corpus held), and
`the_boundaries_fixture_keeps_its_column_zero_comments_and_its_leading_block` (the byte guard on the
twelfth fixture whose whitespace is the test data).

**The three visibility layers were re-demonstrated, not asserted — twice.** Each was disabled in turn and
the next one down caught the class on its own; the runs and the exact message each layer produced are
recorded in `docs/decisions/0c-3b-1-notes.md` §6. All of them were **re-run after the review's fix
round**, because layer 3 changed: experiments 1, 2 and 3 produce the same messages, 3b's catcher moved to
the rewritten property 6, and 3c is new because a third independent view now stands between property 7
and the before/after comment scan. Two further experiments break the **engine** rather than a layer, which
is what shows the oracle can disagree with something: experiment 5 catches an engine that deletes a kept
comment's ownership blank line, and experiment 5b shows the *old* property 6 passing that same engine on
both corpora.

Test output prints counts, file names, byte offsets and synthetic values only — no line of real
configuration content, and no count taken from the real corpus is hard-coded.

## Verification — Phase 0c-2b

All run at the repo root by the orchestrator, independently of the phase worker's own claims, all
exit 0:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **307 tests pass** (163 unit + 11 corpus integrity + 32 parser evaluation + 11 patch edit + 15 patch path + 4 real corpus + 14 scalar codec + 25 span layer + 32 trivia scanner) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo doc --no-deps -p espansoconfig-core` | exit 0, no warnings |
| Same suite with `tests/corpus/real/` renamed away | exit 0 — 307 pass; `patch_edit` drops from 20.3 s to 6.9 s, which is the real-corpus sweep skipping cleanly |
| `git status --short --untracked-files=all` | no real-config path present ✅ |

Test output prints counts, file names, byte offsets and synthetic values only — no line of real
configuration content, and no count taken from the real corpus is hard-coded.

## Verification — Phase 0c-2a

All run at the repo root, all exit 0:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **256 tests pass** (126 unit + 10 corpus integrity + 31 parser evaluation + 15 patch path + 4 real corpus + 14 scalar codec + 24 span layer + 32 trivia scanner) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo doc --no-deps -p espansoconfig-core` | exit 0, no warnings |
| Same suite with `tests/corpus/real/` renamed away | exit 0 — the real-corpus tests skip cleanly |
| `git status --short --untracked-files=all` | no real-config path present ✅ |

Test output prints counts, file names and synthetic path shapes only — no line of real
configuration content, and no count taken from the real corpus is hard-coded.

## Verification — Phase 0c-1

All run at the repo root, all exit 0:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **223 tests pass** (108 unit + 10 corpus integrity + 31 parser evaluation + 4 real corpus + 14 scalar codec + 24 span layer + 32 trivia scanner) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo doc --no-deps -p espansoconfig-core` | exit 0, no warnings |
| Same suite with `tests/corpus/real/` renamed away | exit 0 — the real-corpus tests skip cleanly |
| `git status --short --untracked-files=all` | no real-config path present ✅ |

Test output prints counts and file counts only — no line of real-configuration content.

## Verification — Phase 0b-2

All run at the repo root, all exit 0:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **166 tests pass** (65 unit + 10 corpus integrity + 31 parser evaluation + 4 real corpus + 24 span layer + 32 trivia scanner) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `cargo doc --no-deps -p espansoconfig-core` | exit 0, no warnings |
| Same suite with `tests/corpus/real/` renamed away | exit 0 — the four real-corpus tests skip cleanly |

No test prints a line of real-configuration content: file names, counts and byte offsets only.

## Verification — Phase 0a

All run at the repo root, all exit 0:

| Command | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace` | exit 0 — **62 tests pass** (20 unit + 7 corpus integrity + 31 parser evaluation + 4 real corpus) |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0, no warnings |
| `cargo fmt --check` | exit 0 |
| `git check-ignore -v crates/espansoconfig-core/tests/corpus/real/match/sql.yml` | ignored via `.gitignore:107` ✅ |
| `git status --short --untracked-files=all` | **no real-config path present** ✅ |

Byte-exactness of the awkward fixtures, confirmed with `xxd`: CRLF file contains `0d0a`; BOM file
starts `efbb bf`; no-trailing-newline file ends `0x27` (`'`) with no `0a`; `unicode-offsets.yml`
contains `c3a9` (precomposed é), `65cc81` (**decomposed** é) and `f09f9880` (😀).
`git hash-object`, `--no-filters` and `-c core.autocrlf=true` all agree, proving the corpus
`.gitattributes` `-text` rule stops CRLF normalisation.

---

## Next action

**Phase 2c-3a is split into two steps, and step 1 is complete: new and delete exist as values and
nothing draws them.** `docs/decisions/2c-3a-1-notes.md` is the record (§4 is twelve open holes,
§5 / §7 / §8 are the three review rounds). The design consult for the whole of 2c-3a is
`docs/reviews/phase-2c-3a-design.md`; the three code reviews are
`docs/reviews/phase-2c-3a-1-{code,confirmation,third-pass}.md`, and **all three returned
`READINESS: NOT READY`. All ten findings were fixed before the commit.**

The exact first command a fresh session should run:

```sh
npm install && npm test        # expect 1116 passed, 40 files
```

(`cargo test --workspace` expects **1008**, unchanged — step 1 wrote no Rust, and step 2 should
need none either.)

**The next step is Phase 2c-3a-2 — new and delete on a screen.** Step 1 deliberately touched no
`.svelte` file, so **two of `2c-split-notes.md` §7's three kinds of evidence are still owed**: the
mounted-component test and the window reading. Only the model tests exist.

**Do not re-commission the design consult.** `docs/reviews/phase-2c-3a-design.md` covers the whole
of 2c-3a, step 2 included — its Q1 (the selection after a delete), Q2 (the two-phase confirmation),
Q4 (the position default), Q5 (the destination list) and Q6 (the last snippet) are all statements
about the *screen* that step 1 could only prepare for.

**What step 1 built that step 2 must call and must not redesign.**

- **`src/lib/browser/matchCreation.ts` and `matchDeletion.ts` are the whole of new and delete as
  values**, exactly as `matchEditor.ts` is for the small editor. The components are thin walks
  over them. Every decision — what may be created, where, what a confirmation means, when a save
  may start — is in those two modules, and that is why ten review findings were reachable without
  a screen.
- **Deletion is two phases and `confirmDelete` is the only producer of a `StartedDeletion`.**
  `requestDelete` asks, `cancelDelete` takes it back, `confirmDelete(session, projected)` is the
  only thing that yields something to send. **`projected` must be read from the live projection**,
  never passed back as `session.match` — the module's header says plainly that nothing enforces
  where the argument came from, and a component that hands back the session's own identity defeats
  the whole check.
- **A destination is offered even when it cannot receive a snippet.** Five typed refusals —
  `notASnippetFile`, `readOnly`, `couldNotBeRead`, `notParsed`, `noMatchList` — rendered with
  `tDestinationRefusal`. **Never build the key.** Silently omitting a file the sidebar names is
  what consult Q5 rejects.
- **The `After` anchor is an identity and cannot outlive its file.** Changing the destination
  clears or replaces an incompatible anchor. Do not offer a position picker that stores an ordinal.
- **Both wrappers take a `baseRevision` and forward it unchanged.** Pass the *submission's* base,
  the one the form or session holds — not whatever the window's projection happens to say at the
  moment of the click. That was round 1's second High finding.
- **`code.commandError.documentHasNoMatchList` can finally be drawn**, and only `create_match`
  produces it.

**What step 2 owes, beyond drawing it.**

1. **The three kinds of evidence of `2c-split-notes.md` §7, all three**: model tests (step 1 has
   these), at least one **mounted-component test** (opt in with `/** @vitest-environment jsdom */`
   as the first line, as `MatchEditor.test.ts` and `DetailPane.test.ts` do; **do not back-fill the
   existing six components**), and **a recorded window reading** — `1c-1-notes.md` §10 for the
   technique, `1c-2b-2b-2-notes.md` §6.1 for the WKWebView constraint: **one plan per launch, into
   a fresh bundle path**. A window reading is **re-taken after any change to a component**.
2. **Set the language explicitly through the picker at the top of every plan.** The webview's
   `localStorage` follows the **bundle identifier**, not `HOME` (`CLAUDE.md` §6).
3. **`BrowserState.saveMatch` still substitutes `view.revision`** for the caller's base, the one
   half of round 1's finding 2 that was left. Its caller is `DetailPane.svelte:435`, which step 2
   touches anyway — **fix the signature and the caller together.** `matchEditor.baseRevisionOf`
   exists and is unused; it is what should be passed.
4. **`startMatchCreation` needs `DocumentView[]` and `BrowserState` does not expose one.** A
   projections accessor is owed before a component can build the destination list.
5. **Where `confirmDelete`'s `projected` is read from** is a decision step 2 must make explicitly
   and write down, for the reason in the second bullet above.
6. **Rebaseline the module guard honestly if it moves.** It is **161** now. Build a pristine
   `git archive HEAD` copy and subtract; a delta equal to the number of new source modules is a new
   module, a jump to ~180 with `svelte/internal/server` in the bundle is the `resolve.conditions`
   regression. **Never rebaseline by editing the condition.**

**Two things inherited that are still owed.**

- **`BrowserState.moveMatch` still carries two latent shapes** — a `SaveResult | null` return and a
  stale projection left installed when its own re-read fails. Its `baseRevision` was fixed in this
  step. **It has no production caller**, so nothing about a component blocks fixing the rest;
  **2c-3b is the sub-phase that puts move on a screen and owns them**, and that is the whole reason
  they are deferred.
- **`browser.rawEditor.discardWarning` still says *"Your changes have not been written to the
  file"***, which is false after a `mayHaveWritten` send failure. The small editor's twin was fixed
  in 2c-2-2; the raw editor's was left because its markup is outside that cut and changing it
  obliges a re-take of 2c-1b's window reading. Whichever sub-phase next touches the raw editor
  owes it.

**Everything under "What 2c inherits" and "What 2c must not revisit" further down still binds**,
unchanged.

---

**Phase 2c-2 is complete, both steps: a person can now open one snippet in a window, edit its six
fields, undo, save, and read what the save did.** `docs/decisions/2c-2-2-notes.md` is the record (§4
is fifteen open holes); `docs/decisions/2c-2-2-window-reading.md` is the four window readings, 26
launches, and it is the primary evidence for the phase. The two code reviews are
`docs/reviews/phase-2c-2-2-code.md` and `-confirmation.md`, and **both returned
`READINESS: NOT READY`. All seven findings were fixed before the commit**, as were the four the
window readings found and the two the implementer's own audit found afterwards.

The exact first command a fresh session should run:

```sh
npm install && npm test        # expect 1020 passed, 38 files
```

(`cargo test --workspace` expects **1008**, unchanged — 2c-2-2 wrote no Rust, and 2c-3a should need
none either.)

**The next step is Phase 2c-3a — new and delete on a screen**, per `docs/decisions/2c-split-notes.md`
§2: `create_match` and `delete_match` on a screen, the returned identity adopted, and **the
selection's behaviour when the snippet deleted is the one selected**. It **fails as an identity
mistake**, which is a different failure mode from 2c-2's and needs a different kind of care: 2c-2's
worst case was writing the wrong value into the right place, and 2c-3a's is holding a `MatchId` that
no longer names anything.

**Do not re-commission the 2c design consult.** `docs/reviews/phase-2c-2-design.md` covers 2c-2 only;
the split itself came from `docs/reviews/phase-2c-split-design.md` and covers the whole of 2c.

**What 2c-2-2 built that 2c-3a must call and must not redesign.**

- **`src/lib/components/MatchEditor.svelte` is a walk over `matchEditorView`, and holds no rule.**
  Every decision about what may be edited, what a draft means, when a save may start and what a
  commit moves is in `src/lib/browser/matchEditor.ts`. Keep new screens that shape; it is why this
  phase's four code findings were fixable in a value.
- **A snippet and its file are captured together**, in one assignment
  (`MatchEditingSession` in `DetailPane.svelte`). Passing a second value straight from the live
  selection is the High finding of this phase and type-checks perfectly.
- **A committed save owes a re-projection, and the obligation lives on the session.**
  `needsReprojection` is set by a commit and cleared by **nothing** but `startMatchEditor` over a
  fresh projection; `isEditable` is `false` while it is `true`. There is deliberately **no *Dismiss***
  on a committed panel. A delete has the same problem in a stronger form — see below.
- **`Reprojection` answers a typed reason, never a bare `null`**
  (`notProjected | otherFile | otherSnippet`). A refusal with no reason is not representable, and
  `DetailPane.reprojectMatch` is the one implementation: it compares `document`, then `node`, then
  `revision`.
- **`MatchSaveAnswer` has three arms** — `answered`, `notAttempted` (no fields, because no command
  ran) and `failed` with `failure: IpcFailure` **required**. Wire `createMatch` and `deleteMatch`
  the same way; do not answer `SaveResult | null`.
- **`sendFailureLines` in `editorSave.ts` walks the failure chain once**, in the model, so how deep a
  screen goes is a decision a test can fail on. Reuse it; do not decide it in markup.
- **A refused field shows its value and names where the value came from**
  (`shownValuesOf`, `ShownValue.source`, `tDetailField`). Any new read-only surface owes the same:
  showing a name and a reason with nothing between them is this phase's first window-reading defect.
- **A value's source text goes through `SourceText`, never into a control.** Measured in the shipped
  WKWebView: a `<textarea>` turns `"x\ry\r\nz"` into `"x\ny\nz"` and an `<input>` **deletes** a
  carriage return (`"p\rq"` → `"pq"`). No control in this application can produce one.

**What 2c-3a owes.**

1. **The three kinds of evidence of `2c-split-notes.md` §7, all three**: model tests in
   `src/lib/browser/`, at least one **mounted-component test** (opt in with
   `/** @vitest-environment jsdom */` as the first line, as `MatchEditor.test.ts` and
   `DetailPane.test.ts` do; **do not back-fill the existing six components**), and **a recorded
   window reading** — `1c-1-notes.md` §10 for the technique, `1c-2b-2b-2-notes.md` §6.1 for the
   WKWebView constraint: **one plan per launch, into a fresh bundle path**. A window reading is
   **re-taken after any change to a component**; 2c-2-2 took four.
2. **Set the language explicitly through the picker at the top of every plan.** The webview's
   `localStorage` follows the **bundle identifier**, not `HOME`, so a previous launch's override
   leaks into a fresh bundle with a fresh `HOME`. This **corrects `2c-1b-notes.md` §9.1**, which said
   `HOME` keys it; the correction is in `CLAUDE.md` §6 and cost two launches to find.
3. **Neither `createMatch` nor `deleteMatch` is wired into `BrowserState` yet.** Both exist in
   `src/lib/ipc/commands.ts` (lines 502 and 561) and neither appears in `workspace.svelte.ts` —
   only `moveMatch`, `saveMatch` and `saveRawDocument` do. Wiring them is 2c-3a's, through the
   wrapper, with the adoption performed **before the answer is handed back**.
4. **A deletion answers `moved: null`, and that is the answer rather than a gap.** `deleteMatch`'s
   own JSDoc is explicit: the snippet that was deleted has no identity in the new revision, and
   filling `moved` with a neighbour's identity would put a position back into the one field that
   exists to replace positions with identities. **Every `MatchId` held for that file is stale
   afterwards.** Re-read the document and choose — that choice is this sub-phase's central UI
   question.
5. **Deleting the last snippet of a file is refused** by the core, with `saveFailed` carrying the
   engine's own reason. Offer to delete the file instead, or say so; **do not retry**, and do not
   invent a force flag — there is none anywhere in this design.
6. **`code.commandError.documentHasNoMatchList` can finally be drawn.** `match_list_of` in
   `src-tauri/src/commands.rs` has exactly one caller, `create_one_match`, so **only `create_match`
   produces it** — 2c-2-2 recorded it as a hole precisely because it belongs here.
7. **Rebaseline the module guard honestly if it moves.** It is **158** now. Build a pristine
   `git archive HEAD` copy and subtract; a delta equal to the number of new source modules is a new
   module, a jump to ~180 with `svelte/internal/server` in the bundle is the `resolve.conditions`
   regression. **Never rebaseline by editing the condition.**

**Three things inherited that are still owed.**

- **`BrowserState.moveMatch` still carries all three latent shapes** that findings 1, 2 and 6 fixed
  in `saveMatch`: a `SaveResult | null` return, a stale projection left installed when its own
  re-read fails, and an un-dropped `conflictText`. **No screen calls it yet. 2c-3b is the sub-phase
  that puts move on a screen, and it must fix these first** — they were written down rather than
  changed silently because fixing them alters a published signature outside 2c-2's cut.
- **A component can still bypass the wrapper.** `src/lib/ipc/commands.ts` exports `saveMatch`, and
  nothing in TypeScript, `svelte-check` or the three lint scanners stops a `.svelte` file importing
  it directly and skipping adoption — the same hole `moveMatch` and `saveRawDocument` have had since
  2b-2a. **Today no component imports that module for anything but a type**, which is a fact about
  the code as written and not a guarantee. This is stated in `BrowserState.saveMatch`'s own JSDoc in
  the same sentence as what the wrapper does force, and `createMatch`/`deleteMatch` will inherit it.
- **`browser.rawEditor.discardWarning` still says *"Your changes have not been written to the
  file"***, which is false after a `mayHaveWritten` send failure. The small editor's twin was fixed
  in 2c-2-2; the raw editor's was left because its markup is outside that cut and changing it obliges
  a re-take of 2c-1b's window reading. Whichever sub-phase next touches the raw editor owes it.

**Everything under "What 2c inherits" and "What 2c must not revisit" further down still binds**,
unchanged.

---

**Phase 2c-2 is split into two steps, and step 1 is complete: the small editor exists as a value
and nothing draws it.** `docs/decisions/2c-2-1-notes.md` is the record (§4 is ten open holes). The
design consult for the whole of 2c-2 is `docs/reviews/phase-2c-2-design.md`; the two code reviews
are `docs/reviews/phase-2c-2-model-code.md` and `-confirmation.md`, and **both returned
`READINESS: NOT READY`. All seven findings were fixed before the commit.**

**Do not re-commission the design consult.** `phase-2c-2-design.md` covers the whole of 2c-2,
step 2 included — its Q1 (word boundary), Q2 (the carriage return), Q5 (trigger read-only) and Q7
(the most likely missed defect) are all statements about the *screen* that step 1 could only
prepare for.

The exact first command a fresh session should run:

```sh
npm install && npm test        # expect 974 passed, 36 files
```

(`cargo test --workspace` expects **1008**, and step 2 should write no Rust.)

**The next step is Phase 2c-2-2 — the small editor's screen.** Step 1 deliberately touched no
`.svelte` file, so **two of `2c-split-notes.md` §7's three kinds of evidence are still owed**: the
mounted-component test and the window reading. Only the model tests exist.

**What step 1 built that step 2 must call and must not redesign.**

- **`src/lib/browser/matchEditor.ts` is the whole editor as a value**, exactly as `rawEditor.ts` is
  for the raw editor. The component is a thin walk over it. That is what made step 1's protocol
  testable at all, and it is the only reason the seven review findings were reachable without a
  screen.
- **`MatchBaseline` and `MatchBuffers` are two values and `fieldIntent` is the only reader of
  both.** Do not let a control write into the baseline, and do not seed a buffer from anything but
  the projection. **An initially absent field left blank must stay `'Unchanged'`** — that single
  rule is what stops the app writing `label: ''` into a file that never had a label.
- **Eligibility is computed before anything is bound.** Five reasons: `notDecodable`,
  `carriageReturn`, `ownsNoBytes`, `unmodelledShape`, `triggerNotSingle`. The consult's Q5 asked
  for **read-only, not disabled** — the value stays selectable and the reason is shown inline.
  Render the reason with `tFieldRefusal`; **never build the key.**
- **The word-boundary control is three text fields, and it may not become a checkbox.** D2u forbids
  deciding that `word: on` means true. A screen that wants to name the trigger shape a snippet
  *does* have calls `tTriggerKind`.
- **`describeEditSave`, not `describeWholeDocumentSave`.** The outcome is **not** sealed; a field
  edit invalidates no identity by itself. `editorSave.ts` holds the five save decisions both
  editors share — extend it rather than copying `rawEditor.ts` a second time.
- **`BrowserState.saveMatch` answers `MatchSaveAnswer`, never `null`**, and performs identity
  adoption inside the wrapper. `applySave` requires the `adoption` as its third argument. **A
  failed adoption is reported beside the committed outcome, never in place of it** — the screen
  must say *the file was written and this window is out of step*, never *the save failed*.

**What step 2 owes.**

1. **The component**, plus **the mounted-component test** (opt in with `/** @vitest-environment
   jsdom */` as the first line, per `RawEditor.test.ts`; **do not back-fill the existing six
   components**), plus **a window reading** — `1c-1-notes.md` §10 for the technique,
   `1c-2b-2b-2-notes.md` §6.1 for the WKWebView constraint: **one plan per launch, into a fresh
   bundle path.** A window reading is re-taken after any change to a component.
2. **The consult's Q7 — the single most likely defect all the automated tests pass over: an
   untouched `replace: "a\rb"` reaching a real browser control and being submitted with LF.** Step
   1 proved that projection is genuinely reachable (`an_escaped_carriage_return_decodes_into_a_
   projected_logical_value` in `crates/espansoconfig-core/tests/model_projection.rs`) and gated it
   three times. **The window reading must include that exact case**, because jsdom's normalization
   is not WKWebView's and a mounted test cannot settle it.
3. **The strings still never drawn.** The thirty-two `code.draftError.*`, the thirty-six
   `code.editError.*`, `code.commandError.draftRefused` and `code.commandError.documentHasNoMatchList`
   — `save_match` is the command that produces most of them, so this is the step that can finally
   draw them. (`PROGRESS.md` said *"the eight `code.editError.*`"* before 2c-2-1; the real count is
   **36**.)
4. **Rebaseline the module guard honestly if it moves.** It is **156** now. Build a pristine
   `git archive HEAD` copy and subtract; a jump to ~180 with `svelte/internal/server` in the bundle
   is the regression, a delta equal to the new source modules is not.

**Two things step 1 recorded that a later sub-phase inherits.**

- **Notes hole 9 — `BrowserState.moveMatch` still carries all three latent shapes** that findings 1,
  2 and 6 fixed in `saveMatch`: a `SaveResult | null` return, a stale projection left installed when
  its own re-read fails, and an un-dropped `conflictText`. **No screen calls it yet. 2c-3b is the
  sub-phase that puts move on a screen, and it must fix these first** — they were written down
  rather than changed silently because fixing them alters a published signature outside 2c-2's cut.
- **A component can still bypass the wrapper.** `src/lib/ipc/commands.ts` exports `saveMatch`, and
  nothing in TypeScript, `svelte-check` or the three lint scanners stops a `.svelte` file importing
  it directly and skipping adoption — the same hole `moveMatch` and `saveRawDocument` have had since
  2b-2a. Today no component imports that module for anything but a type. This is stated in
  `BrowserState.saveMatch`'s own JSDoc in the same sentence as what the wrapper does force.

**Everything under "What 2c inherits" and "What 2c must not revisit" further down still binds**,
unchanged.

---

**Phase 2c-1b is complete: this application can now be used to write a user's file from a window.**
`docs/decisions/2c-1b-notes.md` is the record (1417 lines; §9 is the window readings). The aggregate
code review is `docs/reviews/phase-2c-1b-code.md`, and it returned **`READINESS: NOT READY`** twice —
once on the phase, once on the fixes the window reading forced. **All nine findings were fixed
before the commit.** The cut this phase implements is `docs/decisions/2c-split-notes.md`, produced
by the consult `docs/reviews/phase-2c-split-design.md`; **do not re-commission that consult for
2c-2** — it covers the whole of 2c.

The exact first command a fresh session should run:

```sh
npm install && npm test        # expect 894 passed, 35 files
```

(`cargo test --workspace` still expects **1007**, and this phase wrote no Rust.)

**The next step is Phase 2c-2 — the small editor**: literal trigger · `replace` · label · word
boundary, over `MatchDraft` and `save_match`, extending undo coverage to per-field editing. Its
scope is in the 2c split table above, and it **fails as a draft-versus-projection mistake** — which
is the one thing 2c-1b could not test, because a raw candidate is one exact string and a field
candidate is *derived*.

**What 2c-1b built that 2c-2 must not redesign, and the one thing it must not copy.**

- **`Draft<T>` is generic and already carries a structured case.** 2c-1b drafts a `string`, where
  the snapshot is nearly the identity. **2c-2 drafts a structured `MatchDraft`, which is the case
  2c-1a's `{ same, snapshot }` rules and unconditional deep-freezing were built for** — the review
  demonstrated the aliasing defect concretely. Use `structuredDraftRules<T>()`; do not invent a
  shallower one.
- **The three arms, the acknowledgement round trip and the conflict state are drawn once, in
  `rawEditor.ts` + `RawEditor.svelte`.** 2c-2 uses `describeEditSave`, **not**
  `describeWholeDocumentSave`, and its outcome is **not** sealed — a field edit invalidates no
  identity. Read `saveOutcome.ts` before writing a second presenter, and extract rather than copy.
- **`RoundTripText` is the raw editor's brand and does not generalize.** A field editor's values
  pass through `<input>` and `<textarea>` too, so **the CRLF question returns in a different
  shape**: a `replace` block scalar drafted through a text area is subject to the identical API-value
  normalization. **Decide it deliberately in 2c-2; do not assume the brand covers it.** This is the
  single most likely way 2c-2 breaks the preservation promise.
- **`BrowserState.saveRawDocument`'s wiring cannot be copied for `saveMatch`.** `saveRawDocument`
  re-resolves positionally because a replacement has no identity to re-point with;
  `adoptTheDocumentOnDisk` re-points **by identity**. `saveMatch`, `createMatch` and `deleteMatch`
  are still **not** wired into `workspace.svelte.ts` — only `moveMatch` and `saveRawDocument` are.
- **The mounted-component harness exists and is scoped.** `environment: 'node'` stays the default
  and files opt in by docblock. **Do not back-fill the existing six components**, and **do not let
  `npm run build` leave 154 modules** — that number is the guard that the test and production
  resolution paths have not diverged.

**What 2c-2 owes, beyond its own scope.**

1. **The three kinds of evidence of `2c-split-notes.md` §7**, all three: model tests, mounted
   component tests, and **a window reading**. 2c-1b is this project's proof that the third is not
   ceremony — it caught two real defects that 883 passing tests, `svelte-check` and two Codex
   passes had all missed, one of which silently rewrote every line ending in a user's file.
2. **A window reading is re-taken after any change to a component.** 2c-1b took two for that
   reason. Budget for it.
3. **The strings still never drawn.** 2c-1b drew the raw-save subset. The thirty-two
   `code.draftError.*`, the eight `code.editError.*`, `code.commandError.draftRefused` and
   `code.commandError.documentHasNoMatchList` remain on the list — `save_match` is the command
   that produces most of them.
4. **Two questions 2c-1b left open for a human**, neither blocking: whether the shipped WKWebView
   refuses `navigator.clipboard` (both readings ran against a locked screen, which fully explains
   the failure — hole 8.12), and whether the CRLF **refusal** is the right long-term product call
   or whether an editing surface that does not read its value back through a `<textarea>` should be
   built (D13 is written so it can be built on top). **The refusal forecloses nothing.**

**Everything under "What 2c inherits" and "What 2c must not revisit" further down still binds**,
unchanged, except that inherited item 1 is now partly paid: a screen calls one of the five writing
commands.

---

**Phase 2c-1a is complete: the draft spine exists and nothing draws it.**
`docs/decisions/2c-1a-notes.md` is the record; the aggregate code review is
`docs/reviews/phase-2c-1a-draft-spine.md`, and it returned **`READINESS: NOT READY`** on three
High findings. **All eight were fixed before the commit.** The cut this phase implements is
`docs/decisions/2c-split-notes.md`, produced by the consult
`docs/reviews/phase-2c-split-design.md`; **do not re-commission that consult for 2c-1b** — it
covers the whole of 2c.

The exact first command a fresh session should run:

```sh
npm install && npm test        # expect 821 passed, 33 files
```

(`cargo test --workspace` still expects **1007**, and this phase wrote no Rust.)

**The next step is Phase 2c-1b — the raw editor, the one vertical slice of 2c-1.** It is the
first screen in this project that can write a user's file. Its scope is in the 2c split table
above: the raw pane made editable and saveable over the already-wired `saveRawDocument`, the three
outcome arms drawn, the acknowledgement round trip drawn, the terminal-but-honest conflict state,
and **this project's first mounted-component test**.

**What 2c-1a built that 2c-1b calls, and must not redesign.**

- **`Draft<T>` carries rules, `{ same, snapshot }`, not just an equality**, and every value it
  records — base, current, each history step, the save/reload base, the consent candidate — is a
  **deep-frozen snapshot**. The raw editor drafts a `string`, so the snapshot is the identity; do
  not conclude from that that the rules are ceremony. 2c-2 drafts a structured `MatchDraft`, and
  the review demonstrated the aliasing defect that shape exists to prevent.
- **`isDirty` is derived from the base**, not stored. There is no flag to set and none to clear.
- **Consent is opaque and branded, and `acknowledgeDraft` does not exist.** The only producer is
  `acknowledgeRefusal(draft, submission, refusal)`, which checks the base revision, the candidate
  identity and acknowledgeability. Editing or undoing invalidates it. **Do not reach around this**
  by lifting `submission.acknowledgement` and pairing it with different text — that path is still
  reachable (hole 4.1) and the wire's exact-multiset check is the only thing that would catch it.
- **A whole-document outcome arrives sealed.** `openWholeDocumentSave(sealed, forget)` is the only
  way to learn anything about it; the seal is **one-shot**, and a second open returns
  `alreadyOpened` without calling the callback. `forget` is **synchronous** and total — the
  re-read that follows is a separate, asynchronous step and is not this.
- **A throwing `forget` never unwrites the file.** The opener returns the committed outcome beside
  `invalidation: { kind: 'failed' }`. 2c-1b must present that honestly: **the save succeeded and
  the window is out of step**, never "the save failed".
- **Two describers, and no `scope` string**: `describeWholeDocumentSave` and `describeEditSave`.
  A whole-document saved arm **types** `moved: null`. Both return **codes and parameters, never
  sentences**.
- **`ConflictModel<T>` carries the actual `Draft<T>`**, and reload is a confirmed transition —
  `confirmReloadDiskVersion` → `reloadDiskVersion`, with a token checked against that conflict.

**What 2c-1b owes.**

1. **The eight requirements of `2c-split-notes.md` §6**, in a drawn conflict state — and the
   prohibition with them: **no control may be named or coded "keep my draft"**, because that
   phrase means 2c-4b's rebase and using it early would make 2c-4b look already done. **No
   placeholder buttons for 2c-4.**
2. **The mounted-component test**, this project's first. `vite.config.ts` still says
   `environment: 'node'` with a comment reading *"Adding jsdom later is a deliberate decision, not
   a default"* — 2c-1b is where that decision is taken. Scope it to the interactive components 2c
   introduces; **do not back-fill the existing six**, and **do not treat it as replacing the
   window reading** — a mounted test proves a handler fires, not that a window draws.
3. **A window reading**, per `1c-1-notes.md` §10, under the WKWebView constraint of
   `1c-2b-2b-2-notes.md` §6.1: **one plan per launch, into a fresh bundle path.**
4. **The twelve strings 2c-1a added have still never been drawn**, on top of the ~40 already on
   that list. 2c-1b draws the raw-save subset of both.
5. **Nothing forces a caller to seal.** `commands.saveRawDocument` and
   `BrowserState.saveRawDocument` still answer unsealed values (hole 4.2). 2c-1b is where the seal
   is either proved useful at a real call site or found wanting — decide it there, on evidence.

**Everything under "What 2c inherits" and "What 2c must not revisit" further down still binds**,
unchanged. Nothing in 2c-1a supersedes it.

---

**The Phase 2c split is done, and it is the only thing this entry records.** No code was written:
the previous checkpoint's instruction was *"A fresh session's first act is that split, not code"*,
and this is that act. The cut is `docs/decisions/2c-split-notes.md`; the design consult behind it
is `docs/reviews/phase-2c-split-design.md`; the disposition of its seven answers is the section
above. **Four of the seven changed the cut.**

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 1007 tests, 0 failed
```

(and `npm install` before any frontend command, as since 1b-1. `npm test` expects **738**.)
Both were run at the head of this session and both matched, so the split rests on a verified
baseline rather than an assumed one.

**The next step is Phase 2c-1a — the draft spine, with no editor and no screen.** Its scope is in
the 2c split table above. Three things it owes, in the order they matter:

1. **The draft state shape**, designed so undo is expressible rather than addable later: base
   revision **and** base value; the current editable value; past and future states (or reversible
   actions); **dirty derived from the base, never a separate flag**; a history boundary after a
   successful save or a reload; redo cleared when editing resumes from an undone state; and an
   **acknowledgement bound to the exact current candidate**, so that undoing or editing invalidates
   consent collected for a different one. That last one is the protocol's own content-addressing
   rule (`FindingCode::DocumentDoesNotParse` carries the candidate's revision) meeting the fact
   that undo changes the candidate — it belongs in the shape because that is the only place it
   cannot be forgotten.
2. **The typed whole-document invalidation effect.** A committed replacement makes **every**
   `MatchId` in the file stale, and today that obligation is represented in no type: a caller that
   ignores it compiles (`2b-2c-3b-notes.md` §7.2). 2c-1a owes a shape where dropping it does not
   compile — and where TypeScript cannot force that, the residue is **written down as a hole, not
   claimed closed.** This is the consult's answer 6, the single most likely way 2c goes wrong.
3. **The save-outcome presentation model for all three arms** — `Saved` (including
   `committed: false` and the `notes` disclosures), `Refused` (the findings, the acknowledgeable
   subset, and the **exact-multiset** re-submission), and `Conflict`. It lives in
   `src/lib/browser/`, beside `rawSave.ts`, which already models the `DocumentDoesNotParse` case
   specifically and must be **used** by this model rather than duplicated by it.

**2c-1a registers no command, writes no Rust and draws no screen.** It is the same shape as 1b-1
(the i18n layer with no command) and 2b-2c-3a (the core mode with no caller): the state that
everything later stands on, proven before anything stands on it.

**What 2c-1b will need from it, so 2c-1a does not under-build:** a raw text area bound to the
current value, a save control gated on dirty, the three arms drawn, the acknowledgement round trip
drawn, a terminal-but-honest conflict state meeting the eight requirements of
`2c-split-notes.md` §6, and **this project's first mounted-component test** — the deliberate
`jsdom` decision `vite.config.ts` has been holding open since 1b-1.

**Everything under "What 2c inherits" and "What 2c must not revisit" in the entry below still
binds**, unchanged. Read it before starting 2c-1a; nothing in the split supersedes it.

---

**Phase 2b-2c-3b is complete, and with it 2b-2c and the whole of 2b.**
`docs/decisions/2b-2c-3b-notes.md` is the record; the aggregate code review is
`docs/reviews/phase-2b-2c-3b-code.md`, and it returned **`READINESS: NOT READY`** on a High finding.
**All four of its findings were fixed before the commit.** The design consult
(`docs/reviews/phase-2b-2c-3-design.md`) covers the whole of 2b-2c-3, was **not re-commissioned**,
and carries the owner's ruling overriding its Q2 appended at the end.

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 1007 tests, 0 failed
```

(and `npm install` before any frontend command, as since 1b-1. `npm test` expects **738**.)

**Every command Phase 2b was scoped to deliver now exists.** Eleven `#[tauri::command]`s, five of
which write a user's file: `move_match`, `save_match`, `create_match`, `delete_match` and now
`save_raw_document`. All five go through **one** tail, `run_one_save`, which now carries a
`SaveContent` rather than a slice of edits, and through **one** entry point that writes,
`espansoconfig_core::persist::save_document`.

**The next step is Phase 2c — the editing UI.** Its scope in the split table above: the draft model,
the small editor (literal trigger · `replace` · label · word boundary), new / duplicate / delete /
move, the conflict UI, draft-level undo and restore from backup. **It is far too large for one
phase and must be split before any of it is written**, by the same rule every earlier split used — a
dependency order, by failure mode. A fresh session's first act is that split, not code.

**What 2c inherits, and the first item is now the largest single debt in the project.**

1. **Nothing has ever been drawn.** The standing "never been drawn" list is now: the thirty-two
   `code.draftError.*` strings, `code.commandError.draftRefused`, the eight `code.editError.*`
   sentences, `code.commandError.documentHasNoMatchList`, the two `code.presentationNote.*`
   sentences, `code.findingCode.documentDoesNotParse`, `code.saveError.replacementRequiresBackups`
   and the six `browser.rawSave.*` keys. **Five commands can write a user's file and no screen calls
   any of them.** The first phase of 2c owes the look.
2. **`workspace.svelte.ts` wires two of the five writing commands.** `moveMatch` (since 2b-2a) and
   now `saveRawDocument` (forced into existence by the 3b review's Medium). `saveMatch`,
   `createMatch` and `deleteMatch` are **not** there. Note `saveRawDocument`'s wiring **cannot be
   copied** for the other three and vice versa: `adoptTheDocumentOnDisk` re-points a selection **by
   identity**, and a replacement has no identity to re-point with, so it re-resolves positionally
   and checks the result.
3. **`() => {}` still satisfies `ReloadAfterRawSave`, and no type can force `RawSaveOutcome.reload`
   to be *read*.** What is closed is forgetting the obligation, discharging it on the wrong arm, and
   discharging it too late. A caller importing `src/lib/ipc/commands.ts` directly can still opt out;
   only review catches that. Recorded as hole 7.2 of the 3b notes rather than overclaimed.
4. **A re-read that fails after a committed replacement leaves the file unprojected** — reported,
   but absent from `views` rather than marked unreadable, because `loadFailures` is only filled by
   `open()`. Hole 7.3 of the 3b notes.
5. **`SaveError::ReplacementRequiresBackups` is unreachable from the command layer**, because
   `with_open` always hands a real `BackupSession`. That is the intended arrangement — the refusal
   exists to make forgetting impossible — but the only coverage is the core's.
6. **221+ Spanish values are checked only by heuristic** (no sentence byte-identical to its English
   counterpart, placeholders matching). Nothing establishes that any of them is idiomatic.
7. **The real configuration has never had a whole-document replacement applied to it**, and still
   exercises neither `create_match` nor `delete_match`. The real-corpus sweeps cover moves and field
   edits only.
8. **A move still leaves the identical doubled blank line at its origin and says nothing about it**
   (2b-2c-2 hole 6.2); **`create_match` still derives `End` from `view.matches.len()`** (hole 6.8);
   **`verify_items` speaks `verify_field`'s vocabulary** (2b-2c-1 hole 3) and a deletion can still
   report a refusal whose sentence is about a move (2b-2c-2 hole 6.4); three
   `code.diagnosticCode.*` observations remain recorded as non-defects (`2b-2b-3-notes.md` §7.5).

**What 2c must not revisit, inherited from every phase before it.**

- **`espansoconfig_core::persist::save_document` is the only entry point that may write a user's
  file.** Never call `replace_file_atomically` or `replace_locked_file` from a command — **the lock
  is not reentrant, so the process hangs silently and forever.**
- **`run_one_save` is the single copy of this layer's cache-coherency policy.** A sixth writing
  command calls it; it does not copy it.
- **A planning-time refusal goes in the `Err` channel; a transactional one does not** (D1).
  **A committed write is never afterwards reported as an `Err`** (D2) — **and the 3b review found
  that invariant broken in TypeScript, so it binds the boundary layer too, not just Rust.**
- **An empty batch still goes through the transaction** (D3), and so does a replacement whose text
  equals the file's, which is a `Saved` with `committed: false`.
- **Every variant of a wire enum used as an error operand serializes as an object** (D5).
- **A raw save MAY write text the YAML parser rejects** — the owner's settled ruling. Never refused,
  never silent: the acknowledgement protocol is what makes it safe.
- No `force` flag, no acknowledgement bypass, no caching of "the findings I last issued", no wire
  path accepted back as a target. `committed: false` and `backup: None` are legal on a success.
- **Nothing in this project renders a Svelte component in an automated test**, so a claim about a
  screen needs **a reading of a screen**, re-taken after any change to a component
  (`docs/decisions/1c-1-notes.md` §10 records the technique; `1c-2b-2b-2-notes.md` §6.1 records the
  WKWebView constraint — one plan per launch, into a fresh bundle path).
- **The UI shows a scalar's source text as written, never an inferred type** (D2u). Moving a match
  between files or between sequences is refused (D2r). A move may not be combined with any other
  edit in one batch (R25).

---

**Phase 2b-2c-3a is complete.** `docs/decisions/2b-2c-3a-notes.md` is the record; the aggregate code
review is `docs/reviews/phase-2b-2c-3a-code.md`, and it returned **`READINESS: NOT READY`** on a High
finding that was **fixed before the commit**. The design consult
(`docs/reviews/phase-2b-2c-3-design.md`) covers the whole of 2b-2c-3 and was **not re-commissioned**
— **do not re-commission it for 3b either.**

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 1001 tests, 0 failed
```

(and `npm install` before any frontend command, as since 1b-1. `npm test` expects **702**.)

**`save_document` can now replace a whole document, and nothing calls it.** That is the entire state
of 2b-2c-3a: the mode exists, is proven, and has no caller outside tests.

**The next step is Phase 2b-2c-3b — `save_raw_document`, the eleventh `#[tauri::command]`, and the
last of 2b-2c.** With it, 2b-2c closes and every command Phase 2b was scoped to deliver exists.

**What 2b-2c-3a built that 2b-2c-3b calls, and must not redesign.**

- **`SaveContent<'a>` is a field of `SaveRequest`** — `content`, replacing `edits` — with arms
  `Edits(&'a [DocumentEdit])` and `ReplaceText(&'a str)`. It is **core-only and not on the wire**;
  3b decides what the *command* takes, which is not the same type.
- **`SaveContent::ReplaceText` requires a backup session.** `SaveError::ReplacementRequiresBackups
  { path }` is raised **before the lock** when `backups` is `None`. The command layer already owns a
  `BackupSession`, so **pass it** — this refusal exists to make forgetting impossible, not to be
  worked around. Note it also refuses a replacement that would have been byte-identical, which is
  stricter than Q6's letter and was kept deliberately (`2b-2c-3a-notes.md` §5.1): a caller must be
  able to know its request is well-formed **without reading the file**.
- **`FindingCode::DocumentDoesNotParse { revision, line, column, byte_index, detail }`** is
  **acknowledgeable** (class `SuspiciousButPermitted`) and **content-addressed to the candidate**.
  The `revision` operand is what stops consent collected for one text being spent on another; it is
  deliberately **not** in either dictionary sentence, and `saveCodes.test.ts` asserts its absence.
  `line`, `column` and `byte_index` are all `Option` — a crate-internal syntax error yields the
  finding with no position rather than withholding the user's bytes.
- **`validate` does not and must not produce that code.** `every_finding_code_is_reachable` exempts
  it from both sides: no fixture may produce it, and the exemption must still name a declared
  variant.
- **A replacement reports `notes: []` and exactly one whole-document `Replacement`** spanning
  `0..source.len()`. The single span is a **byte-level statement, not a locality claim**.

**What 2b-2c-3b owes, and the first is the one the consult flagged as unfinished.**

1. **The full identity invalidation.** Consult Q3: after `committed: true` the frontend must
   invalidate **all** cached projections and identities and reload the document — **every `MatchId`
   in the file is stale**, and unlike a create or a delete there is no single match to answer with.
   `moved: None` is the permanent answer. **The obligation is currently represented in no type**
   (hole 6.2 of the notes): a caller that ignores it compiles. On `committed: false`, nothing
   becomes stale.
2. **`save_raw_document` must call `run_one_save`, not copy it.** That block is the cache-coherency
   policy and it was four copies before the `35a9e9e` cleanup round.
3. **The UI's own debt, from Q8**: a raw save must be presented as *replacing the entire document*,
   not as an edit, and — from the owner's ruling — when the text does not parse the user gets **a
   sentence saying espanso will not load the file until it is fixed, the parser's position if it has
   one, and the choice**, in both languages. Not a blocked save.
4. **`detail` is the parser's own message and cannot be localized.** The sentence around it is; the
   fragment inside it is not. 3b is where that first becomes visible.

**What 2b-2c-3b inherits from every command before it, and none of it is its to revisit.**

- **`espansoconfig_core::persist::save_document` is the only entry point that may write a user's
  file.** Never call `replace_file_atomically` or `replace_locked_file` from a command — **the lock
  is not reentrant, so the process hangs silently and forever.**
- **A planning-time refusal goes in the `Err` channel; a transactional one does not** (D1).
- **A committed write is never afterwards reported as an `Err`** (D2).
- **An empty batch still goes through the transaction** (D3) — and so does a replacement whose text
  equals the file's, which is a `Saved` with `committed: false`.
- **Every variant of a wire enum used as an error operand serializes as an object** (D5).
- No `force` flag, no acknowledgement bypass, no caching of "the findings I last issued", no wire
  path accepted back as a target. `committed: false` and `backup: None` are **not** failures.

**The debts, retallied.**

- **The thirty-two `code.draftError.*` strings, `code.commandError.draftRefused`, the eight
  `code.editError.*` sentences, `code.commandError.documentHasNoMatchList`, the two
  `code.presentationNote.*` sentences and now `code.findingCode.documentDoesNotParse` and
  `code.saveError.replacementRequiresBackups` have never been drawn.** The first phase to build the
  editor screen owes the look — and 3b adds the raw editor to that list.
- **215+ Spanish values are checked only by heuristic** — two more than at 2b-2c-2.
- **The real configuration has never had a whole-document replacement applied to it**, and still
  exercises neither `create_match` nor `delete_match` (hole 6.3 of 2b-2c-2, extended).
- **A move leaves the identical doubled blank line at its origin and says nothing about it**
  (2b-2c-2 hole 6.2). Unchanged.
- **`create_match` derives `End` from `view.matches.len()`** (2b-2c-2 hole 6.8). Unchanged.
- **`verify_items` speaks `verify_field`'s vocabulary** (2b-2c-1 hole 3), and a deletion can still
  report a refusal whose sentence is about a move (2b-2c-2 hole 6.4).
- **Three `code.diagnosticCode.*` observations remain recorded as non-defects**
  (`2b-2b-3-notes.md` §7.5).

---

**Phase 2b-2c-2 is complete and both of its Codex consultations are closed.**
`docs/decisions/2b-2c-2-notes.md` is the record; the design consult is
`docs/reviews/phase-2b-2c-2-design.md` and the aggregate code review is
`docs/reviews/phase-2b-2c-2-code.md`. **That review returned `READINESS: NOT READY`**, and the
verdict was accepted rather than argued with: its Medium and its Low were both fixed and re-verified
before the commit. **This application can now create and delete a user's snippets.**

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 983 tests across 21 binaries, 0 failed
```

(and `npm install` before any frontend command, as since 1b-1. `npm test` expects **700**.)

The tree is at **`35a9e9e`**, which is the cleanup round, not the phase commit. Both are pushed.

**A cleanup round ran after the phase commit and is already in** (`35a9e9e`). Four independent
quality reviews — reuse, simplification, efficiency, altitude — converged on three duplications, now
removed: the save-transaction tail is **one `run_one_save`** called by all four writing commands
(with `view_at` and `with_open` beside it), the landing index comes from the engine's own
**`ItemPlacement::items_above`**, and both anchor resolutions are **one `anchor_index`**.
**`save_raw_document` must call `run_one_save`, not copy it** — that block is the cache-coherency
policy, and it was four copies before this round.

**The 2b-2c-3 design consult has already been taken** — `docs/reviews/phase-2b-2c-3-design.md`, eight
rulings. **Do not re-commission it.** Its rulings, in one line each:

| Q | Ruling |
|---|---|
| Q1 | The substitute for the patch engine's proof is **both** a successful reparse **and** the existing validation/acknowledgement gate |
| Q2 | ~~A raw save may not write text the YAML parser rejects~~ — **OVERRIDDEN BY THE OWNER, see below** |
| Q3 | Keep `SaveResult`; `moved: None` |
| Q4 | **One** core `save_document(SaveRequest)` entry point branching internally — not a second entry point beside it (the lock is not reentrant) |
| Q5 | A raw save **does** fully participate in acknowledgement for validation findings |
| Q6 | No backup for a byte-identical result; every committed raw replacement must have a recoverable pre-commit image; the revision check is **more** load-bearing here |
| Q7 | The highest risk is **silently overwriting changes made after the raw editor loaded the file** |
| Q8 | A raw save is **a separate replacement mode with a different promise**, not a locality-preserving edit |

**Q2 was put to the owner and the owner reversed it. This is a settled decision, not an open
question — do not re-litigate it and do not re-commission a consult on it.**

> **A raw save MAY write text the YAML parser rejects. Do not refuse to write it.**

The tradeoff as it was put: refusing means **this application cannot be used to repair a file that is
already broken**, which is arguably the single most valuable thing a raw editor does — and the app
already *displays* unparseable files, since a broken file crosses as a view and never as an error.
`docs/reviews/phase-2b-2c-3-design.md` carries the ruling in full, appended below the consult it
overrides.

**Three consequences, and the last one is an inference rather than the owner's words.**

1. **Q1 narrows.** The reparse can no longer be a *gate* — failing it is no longer disqualifying. It
   stays a **fact the transaction must establish and report**, because the answer is what the user is
   told and what the workspace cache must do next.
2. **Q5 now carries the weight.** The acknowledgement protocol is what makes the ruling safe: the app
   does not refuse, and it does not write silently either. *"Refused, not forced"* was never
   *"refused, full stop"* — it is **never written without the user meaning it**.
3. **Silent or acknowledgeable? Assumed acknowledgeable.** The owner's ruling does not settle this.
   The assumption follows plan §6.2 (nothing unrequested happens silently) and the fact that 2b-2c-2
   has just paid to disclose a *doubled blank line* — a far smaller surprise than a file espanso will
   refuse to load. **A phase that finds this assumption wrong should put it back to the owner rather
   than quietly choosing the other reading.**

Everything else in the consult stands: one `save_document` entry point branching internally (Q4 — the
lock is not reentrant), `moved: None` (Q3), the backup and revision rules (Q6), the stale-revision
test as the highest risk (Q7), and Q8's framing of a raw save as a **separate replacement mode with a
different promise**.

**The next step is Phase 2b-2c-3 — `save_raw_document`, the eleventh `#[tauri::command]`, and the
last of 2b-2c.** It is not a small step and it is not like the two before it.

**Start from the answer 2b-2c-1's design consult already gave it** (`docs/reviews/phase-2b-2c-1-design.md`,
Q6, recorded and deliberately not built): **a `SaveRequest` variant for whole text, never a full-span
`DocumentEdit`.** A whole-document text is **not** a span replacement, so it may not claim the patch
engine's locality invariants — the thing every other operation in this application is built to
guarantee. Giving `save_document` a whole-text path is a change to **the one entry point that
writes**, not a new caller of it, and that is the whole difficulty.

**What 2b-2c-2 built that 2b-2c-3 must not redesign.**

- **`PresentationNote` is now a tagged union**, `ScalarRestyled { edit, from, to, reason }` (the old
  struct's four operands, unchanged) plus `DoubledSequenceSeparation { edit }`. Both arms are struct
  variants, so both cross as one-key objects (D5). **A raw save re-encodes nothing and moves nothing,
  so its `notes` should be empty** — but that is a claim to state and test, not to assume.
- **`ItemPlacement { Front, After(usize), End }`** replaced `insert_item()`'s `after: Option<usize>`.
  An implicit-null `matches:` accepts `Front` and `End` and **refuses every `After(_)`** with
  `NoSuchDestinationItem { items: 0, … }`.
- **`NewMatch { trigger, replace }` is closed and both fields are mandatory**, and
  `NewMatchPosition`'s three arms are all struct variants so the position crosses as a uniform
  object. `NewMatchPosition` is **not** a code and has no dictionary namespace.
- **`CommandError::DocumentHasNoMatchList`** is the refusal for a file with no `matches:` key at all.
  A **bare** `matches:` is promoted and is not this refusal.
- **`every_edit_error_variant_crosses_as_an_object`** now covers `EditError` (36) and `SaveError` (9)
  and derives its lists by parsing the source. **A new error enum on this boundary owes the same
  check** — the pinned counts move with the enums.

**What 2b-2c-3 inherits from every command before it, and none of it is its to revisit.**

- **`espansoconfig_core::persist::save_document` is the only entry point that may write a user's
  file.** Never call `replace_file_atomically` or `replace_locked_file` from a command or from inside
  the transaction — **the lock is not reentrant, so the process hangs silently and forever.** This is
  the invariant a whole-text path is most likely to break, because a whole text *feels* like
  something you could just write.
- **A planning-time refusal goes in the `Err` channel; a transactional one does not** (D1).
- **A committed write is never afterwards reported as an `Err`** (D2). A raw save has no single match,
  so **`moved: None` is its permanent answer**, not a failure.
- **An empty batch still goes through the transaction** (D3). A raw save whose text equals the file's
  is a `Saved` with `committed: false`.
- **Every variant of a wire enum used as an error operand serializes as an object** (D5).
- No `force` flag, no acknowledgement bypass, no caching of "the findings I last issued", no wire path
  accepted back as a target. `committed: false` and `backup: None` are **not** failures.

**Three things 2b-2c-3 must decide, and none has been decided yet.**

1. **What a raw save is checked against.** The other operations get their safety from the patch engine
   proving the untouched bytes are untouched. A whole text has no untouched bytes to prove. So what
   plays that role — a reparse that must succeed, a validation verdict, both, or an explicit
   acknowledgement that the user is taking the wheel?
2. **Whether a raw save may write a file the parser rejects.** `document_text` already answers valid
   UTF-8 **or refuses** with a typed `NotUtf8 { path, offset }`; a file it cannot display cannot be
   round-tripped through this command at all. Whether it may write text the *YAML* parser rejects is
   a different question and a sharper one.
3. **What it does to identities.** Every `MatchId` in the file is stale afterwards, and unlike a
   create or a delete there is no single match to answer with.

**Two debts this phase paid.**

- **`SaveResult::Saved::notes` has a second producer**, and the first that is not a scalar
  re-encoding. It still has **no reader** — which is why the union reshape was free, and it will not
  be free again.
- **A move's empty `notes` is now a tested property**, not just a documented one
  (`a_move_out_of_the_same_gap_still_reports_nothing`).

**The debts, retallied.**

- **The thirty-two `code.draftError.*` strings, `code.commandError.draftRefused`, the eight
  `code.editError.*` sentences, and now `code.commandError.documentHasNoMatchList` and the two
  `code.presentationNote.*` sentences have never been drawn.** The first phase to build the editor
  screen owes the look.
- **213+ Spanish values are checked only by heuristic** — three more than at 2b-2c-1. Nothing
  establishes that any is idiomatic.
- **The real configuration exercises neither new command** (hole 6.3 of the notes). It is swept for
  moves and for field edits; nothing has ever been created in it or deleted from it.
- **A move leaves the identical doubled blank line at its origin and says nothing about it**
  (hole 6.2). The removal side is closed; the move side is not, and closing it would change an
  already-shipped command's documented "notes are always empty for a move".
- **`create_match` derives `End` from `view.matches.len()`** (hole 6.8) — a projection count rather
  than something the engine hands back. It can only affect the identity answered in `moved`, never
  a byte.
- **`verify_items` speaks `verify_field`'s vocabulary** (hole 3 of 2b-2c-1), and a deletion can still
  report a refusal whose sentence is about a move (hole 6.4).
- **Three `code.diagnosticCode.*` observations remain recorded as non-defects**
  (`2b-2b-3-notes.md` §7.5).

---

**Phase 2b-2c-1 is complete and both of its Codex consultations are closed.**
`docs/decisions/2b-2c-1-notes.md` is the record; the design consult is
`docs/reviews/phase-2b-2c-1-design.md` and the aggregate code review is
`docs/reviews/phase-2b-2c-1-code.md`, which reported **no finding in five of its six categories** and
one Low documentation finding, since fixed. **The patch engine now has all six primitives it will
ever need for matches** — and nothing calls the two new ones.

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 959 tests across 21 binaries, 0 failed
```

(and `npm install` before any frontend command, as since 1b-1. `npm test` expects **696**.)

**The next step is Phase 2b-2c-2 — `create_match` and `delete_match`, the eighth and ninth
`#[tauri::command]`.** Read the 2b-2c split table above first. `save_raw_document` is **2b-2c-3's**
and must not be reached for here: it is not a span replacement, and giving `save_document` a
whole-text path is a change to the one entry point that writes, not a new caller of it.

**What 2b-2c-1 built that 2b-2c-2 calls, and must not redesign.**

- **`InsertItem { sequence, after: Option<usize>, fields: Vec<(String, String)> }`** — one flat
  block-mapping sequence item, scalar values only, each spelled by the **existing** scalar codec.
  `after: None` appends last. **There is no "before the first item" form** (hole 6): `ItemMove` can go
  to the front and `InsertItem` cannot, so a `create_match` that wants to insert at the top must
  derive the destination the way `plan_move` derives its front, or append and then move.
- **`RemoveItem`** addresses **the item**, not `(sequence, index)` (D1) — it is `ItemMove`'s lift half
  in shared code, and `tests/patch_item.rs` compares the two outputs byte for byte. Do not add a
  second removal path.
- **Eight named refusals, all planning-time and all struct variants on the wire**:
  `NotASequence`, `InsertedItemHasNoFields`, `DuplicateInsertedField`, `InvalidInsertedFieldKey`,
  `FlowSequenceInsertionUnsupported`, `InconsistentSequenceIndentation`,
  `ImplicitNullSequenceHasAmbiguousTrivia`, `RemovalWouldEmptyTheSequence`. Each already has its
  sentence in both languages and its member in the TypeScript union.
- **A bare `matches:` is promoted into its first block-sequence item.** That is what lets the app
  create the first match in a fresh file. Its ambiguity guard is **one line deep** (hole 7) — it
  refuses only when the line immediately below the bare key is a comment.

**What 2b-2c-2 inherits from 2b-2b-3 and 2b-2a, unchanged and not its to revisit.**

- **A planning-time refusal goes in the `Err` channel; a transactional one does not** (D1). A
  `create_match` with no anchor and a `delete_match` naming something that is not an item belong with
  `DraftRefused` and `MoveNotWithinOneSequence`, **not** as new `SaveResult` variants — filing a
  non-overridable refusal beside an overridable one invites a frontend to offer an acknowledgement
  that can never work.
- **A committed write is never afterwards reported as an `Err`** (D2). If post-commit re-resolution
  fails, the answer is `moved: None` and a successful `SaveResult`. **`delete_match` is the first
  command for which `None` is the correct *routine* answer** rather than a defensive one — the match
  it deleted has no identity in the new revision, by construction.
- **An empty batch still goes through the transaction** (D3). No short-circuit.
- **Every variant of a wire enum used as an error operand must serialize as an object** (D5). A single
  unit variant among struct ones silently demotes a typed refusal to *unexpected failure*. A new error
  enum on this boundary owes its own `every_*_variant_crosses_as_an_object` check.
- **`NOT_A_CODE` is read from both directions** (D6), and the non-vacuity floor in
  `every_typescript_wire_union_has_a_namespace` moves with `types.ts`.
- `espansoconfig_core::persist::save_document` is **the only** entry point that may write a user's
  file. Never call `replace_file_atomically` or `replace_locked_file` from a command or from inside
  the transaction — **the lock is not reentrant, so the process hangs silently and forever.**

**What 2b-2c-2 must not do**, all inherited: no `force` flag or acknowledgement bypass; no caching of
"the findings I last issued"; no wire path accepted back as a target; and `committed: false` /
`backup: None` are **not** failures.

**Two things 2b-2c-2 will be the first to feel, both recorded as holes rather than discovered late.**

- **A removal between blank-separated items leaves both blank lines** (hole 5). Removing the middle
  item of a sequence with one blank line between each pair leaves **two** consecutive blank lines;
  with two blanks it leaves four. That is the lift-site join rule applied literally — a blank line
  beside an item is not the item's, and deciding which of two runs to collapse is a layout decision no
  primitive may make. It is pinned as expected bytes, and **a UI that deletes matches will show it.**
- **Deleting the last match of a file is refused**, by design (`RemovalWouldEmptyTheSequence`). The UI
  owes the user a sentence, not a failed save.

**The debts, retallied.**

- **The thirty-two `code.draftError.*` strings, `code.commandError.draftRefused`, and now the eight
  new `code.editError.*` sentences have never been drawn.** So has `SaveResult::Saved::notes`, which
  has a producer and no reader. The first phase to build the editor screen owes the look.
- **210+ Spanish values are checked only by heuristic** — eight more than at 2b-2b-3. Nothing
  establishes that any is idiomatic.
- **The real configuration exercises neither new primitive** (hole 2). It is swept for moves and for
  field edits; nothing has ever been inserted into it or removed from it, so `tests/patch_item.rs` is
  that surface's only coverage.
- **`verify_items` speaks `verify_field`'s vocabulary** (hole 3): a sequence that lost an item reports
  `EntryCountChanged` and an item that changed reports `SiblingChanged`, whose sentences say *entry*
  and *block*. A user never sees it — a verification failure discards the candidate — but a phase that
  surfaces these should split them.
- **Three `code.diagnosticCode.*` observations remain recorded as non-defects**, not fixed
  (`2b-2b-3-notes.md` §7.5).

---

**Phase 2b-2b-3 is complete and both of its Codex consultations are closed — and with it, 2b-2b.**
`docs/decisions/2b-2b-3-notes.md` is the record; the design consult is
`docs/reviews/phase-2b-2b-3-design.md` and the aggregate code review is
`docs/reviews/phase-2b-2b-3-code.md`, which reported **no finding at any severity**. **This
application can now write a match's edited fields to a user's file.**

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 927 tests across 21 binaries, 0 failed
```

(and `npm install` before any frontend command, as since 1b-1. `npm test` expects **696**.)

**The next step is Phase 2b-2c — the two missing core primitives and the three commands over them.**
Read the Phase 2 split table above first. Its scope, unchanged since it was written:

- **sequence-item insert and sequence-item remove in `patch/`**, with the comment-ownership,
  indentation and block-scalar answers 0c-3a and 0c-3b-1 had to give for *mappings*. These are the
  two primitives whose absence is the reason `create_match`, `delete_match` and `save_raw_document`
  do not exist. `DocumentEdit` has exactly four variants today — scalar edit, mapping-field insert,
  mapping-field remove, same-sequence item move;
- then **`create_match`, `delete_match` and `save_raw_document`** over them;
- **`save_raw_document` needs its own answer, and it is not a small one.** A whole-document text is
  **not** a span replacement, and `save_document` is the one entry point that writes. Giving it a
  whole-text path is a change to that entry point, not a new caller of it.

**What 2b-2c inherits from 2b-2b-3, and must not redesign.**

- **A planning-time refusal goes in the `Err` channel; a transactional one does not** (D1). The new
  commands will each have their own planning refusals — a `create_match` with no anchor, a
  `delete_match` naming an item that is not one. They belong with `DraftRefused` and
  `MoveNotWithinOneSequence`, **not** as new `SaveResult` variants, and for the recorded reason:
  filing a non-overridable refusal beside an overridable one invites a frontend to offer an
  acknowledgement that can never work.
- **A committed write is never afterwards reported as an `Err`** (D2). If a post-commit
  re-resolution fails, the answer is `moved: None` and a successful `SaveResult`. `delete_match`
  will be the first command for which `None` is the *correct routine* answer rather than a defensive
  one — the match it deleted has no identity in the new revision, by construction.
- **An empty batch still goes through the transaction** (D3). Do not add a short-circuit for a
  create or a delete that turns out to change nothing.
- **`plan_match_edits` runs both batch guards itself** (D4, `2b-2b-3-notes.md` §3). Do not re-run
  them at the command layer: the independence guard needs the original key lists, which only the
  planner holds, and a copy assembled at the command layer is a weaker second statement wearing the
  same name.
- **Every variant of a wire enum used as an error operand must serialize as an object** (D5). A
  single unit variant among thirty-one struct ones silently demotes a typed refusal to *unexpected
  failure*, because the operand-shape table pins one shape per operand from one sample.
  `every_draft_error_variant_crosses_as_an_object` now catches it for `DraftError`; **a new error
  enum on this boundary owes the same check.**
- **`NOT_A_CODE` is read from both directions** (D6). A union exempted on the Rust side is exempted
  on the TypeScript side, from one table. The non-vacuity floor in
  `every_typescript_wire_union_has_a_namespace` is **43** and moves with the file — a union added to
  `types.ts` raises it, and one that stops carrying single-quoted members lowers it.

**What 2b-2c must not do**, all inherited and none of it its own to revisit: no `force` flag or
acknowledgement bypass; no caching of "the findings I last issued" to police acknowledgements; no
call to `replace_file_atomically` or `replace_locked_file` from a command or from inside the
transaction (**the lock is not reentrant — the process hangs silently and forever**); no wire path
accepted back as a target; and `committed: false` / `backup: None` are **not** failures.

**The debts, retallied.**

- **The four `code.diagnosticCode.*` strings 2b-1 corrected have now been seen on a screen**, in
  both languages, and all four were judged defensible. `docs/decisions/2b-2b-3-notes.md` §7 is the
  reading, with §7.6 stating what it is *not* evidence of. **That debt is closed after five phases.**
- **A new one opens in its place, and it is larger.** Thirty-two `code.draftError.*` strings and one
  `code.commandError.draftRefused` were added in both languages and **have never been drawn**. So
  has `SaveResult::Saved::notes`, which now has a producer and no reader. The first phase to build
  the editor screen owes the look.
- **202+ Spanish values are checked only by heuristic.** Nothing establishes that any is idiomatic.
  The window reading judged **four** of them by eye and found them correct — which is four.
- **Three `code.diagnosticCode.*` observations were recorded as non-defects**, not fixed
  (`2b-2b-3-notes.md` §7.5): `{count}` has no plural rule and is safe only because the Rust guard is
  `> 1`; the two `MatchHasSeveral*` sentences say *"This snippet"* on a file-level pane that does not
  say which; and the key `…ContentForms` disagrees with both its own sentence and the Rust
  `FindingCode::MatchHasSeveralContentFields`.

---

**Phase 2b-2b-2 is complete and BOTH of its reviews are closed.** `docs/decisions/2b-2b-2-notes.md`
is the record; the design consult is `docs/reviews/phase-2b-2b-2-open-key-design.md` and the code
review is `docs/reviews/phase-2b-2b-2-open-key-code.md`, each with its own disposition table above.
**A match's open half can now be drafted, and nothing can call it.**

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 917 tests across 21 binaries, 0 failed
```

(and `npm install` before any frontend command, as since 1b-1.)

**The next step is Phase 2b-2b-3 — `save_match`, the command.** Nothing stands in front of it: the
review debt the previous checkpoint carried forward has been paid, its one finding is fixed, and the
2b-2b-2 code review found no other defect in the three places that checkpoint named as invisible to
the test suite.

**One thing 2b-2b-3 inherits from that fix round, and it is a small obligation with a sharp edge.**
`DraftError` gained a variant, `AmbiguousVariableKey { variable }` — the **twelfth** that carries an
index and nothing else. It is **unreachable from
any projected document today** — the hazard gate refuses the whole match first — and it still owes a
`draftError` string in both languages like every other variant, because a code with no sentence is
worse than a code with no caller. Write that sentence about *ambiguity*, not about something the user
can currently trigger, and do not let the unreachability tempt anyone into skipping it: the
exhaustiveness check will demand it, and the check is right.

**2b-2b-3 is the step that gives every line of 2b-2b-1 and 2b-2b-2 its first caller**, and it carries
four obligations that are already written down:

- **the `draftError` dictionary namespace in both languages**, and the deletion of the TEMPORARY
  `NOT_A_CODE` entry for `DraftError`. `the_temporary_draft_error_exclusion_expires_when_anything_names_it`
  fires the moment production Tauri code names `DraftError` while the exclusion stands, and
  **self-disables** once it is gone. The exhaustiveness test alone would pass — that is why the
  tripwire exists;
- **`SaveResult::Saved::notes` gets its first producer.** `PresentationNote` and `NotReencodable`
  have been on the wire since 2b-1 with no caller. A move re-encodes no scalar; a draft diff will;
- **positional addressing makes `base_revision` load-bearing** in a way the closed surface's
  key-addressing was not. A stale **index** silently names a *different* entry, where a stale key
  merely names a missing one. What makes it safe is the optimistic-concurrency check inside
  `save_document`, taken **under the lock**. It must not be skipped, and the draft must be planned
  against the projection associated with the revision the caller sent;
- **the window reading that is now four phases overdue.** The four `code.diagnosticCode.*` strings
  2b-1 corrected have still never been seen on a screen. 2b-2a, 2b-2b-1 and 2b-2b-2 each opened no
  window. 2b-2b-3 is the first phase since 2b-1 that will have a command to read them through.

**What 2b-2b-3 must not do**, all inherited and none of it its own to revisit: no `force` flag or
acknowledgement bypass; no caching of "the findings I last issued" to police acknowledgements; no
call to `replace_file_atomically` or `replace_locked_file` from a command or from inside the
transaction (**the lock is not reentrant — the process hangs silently and forever**); no wire path
accepted back as a target; and `committed: false` / `backup: None` are **not** failures.

**What 2b-2b-2 established that 2b-2b-3 inherits unchanged:**

- **An address below the match mapping is an index, never a key the owner wrote.** Seven
  `DraftTarget` variants and **twelve** `DraftError` variants carry indices only — eleven as 2b-2b-2
  shipped, plus `AmbiguousVariableKey` from its code review's fix round. This is not a style
  choice — a refusal crosses the process boundary and the owner's configuration is private
  (`CLAUDE.md` §1). A frontend that wants to show *which* param failed resolves the index against the
  projection it already holds.
- **The equality rule is still one line and still the only one.** `scalar.text == value`, through the
  inherited `plan_scalar`. The consult proposed a second, source-text comparison for `params`; it was
  refused, and the resulting gap is hole 1 rather than a second answer.
- **This phase inserts nothing below the match mapping** (D1). A drafted entry that does not exist is
  refused, never inserted. Writing an author-chosen key would be the first key string this engine
  emits that no schema fixes; it needs its own anchor machinery and its own review, and **nothing in
  the current UI can produce one**. That is a decision with a reason, not a limitation found late.
- **The guards are widened, not loosened.** `check_closed_surface` admits exactly seven scalar shapes
  and four removable ones; six over-deep paths are refused as both an edit and a removal.
  `check_batch_independence` takes a fourth argument, `NestedKeys`, carrying each nested mapping's
  **whole** key list — because an unedited duplicate still makes an edited path ambiguous.

**Two debts no test can discharge, both now older.**

- **The four `code.diagnosticCode.*` strings have still not been seen on a screen** — four phases.
- **170+ Spanish values are checked only by heuristic.** Nothing establishes that any is idiomatic.

---

**Phase 2b-2b-1 is complete and its review is closed.** `docs/decisions/2b-2b-1-notes.md` is the
record; the review disposition is the table above and
`docs/reviews/phase-2b-2b-draft-design.md` holds the six design rulings the phase was built to.
**A draft can now be turned into a minimal edit batch, and nothing can call it yet.**

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 882 tests across 21 binaries, 0 failed
```

(and `npm install` before any frontend command, as since 1b-1.)

**The next step is Phase 2b-2b-2 — `vars` and `form_fields`, the open key surface.** Read the
2b-2b split table above first. **2b-2b was split three ways because a match's fields are two
surfaces, not one**, and the second one is where the interesting problem is: a variable's `params`
is a mapping whose keys belong to the *form author*, not to espanso, and whose values are
legitimately sequences. It is an unschema'd mapping diff, and it collides head-on with the rule
that **no primitive may synthesize a collection node**.

**What 2b-2b-2 inherits and must not redesign:**

- **The equality rule is one line and it is the contract**: `scalar.text == value`, the drafted
  logical string against the projection's **decoded** logical value. `ScalarView::text` is already
  `decode()`'s output. A second comparison written anywhere else is a second answer to a question
  that has one.
- **`ScalarView::decoded == false` means `text` is the RAW SOURCE SLICE**, not a logical value, so
  it cannot be compared as one. `DraftError::NotDecodable` refuses it. This trap is not in the
  design consult — it was found in the codebase, and it is the one a new surface will re-open.
- **The surface is closed by a type *and* by a guard, and widening it means widening both.**
  Adding `vars` to `MatchDraft` without adding it to `check_closed_surface` produces a batch that
  refuses **itself** — which is the failure mode this arrangement was designed to have. Expect it,
  and do not "fix" it by loosening the guard.
- **`DraftField<T>` is generic already.** A `DraftField<VariableDraft>` costs nothing and keeps a
  JSON `null` failing closed. **Do not switch to `Option<Option<T>>`** — a frontend collapsing
  `undefined` into `null` would turn an untouched field into a *removal*, and
  `a_null_draft_field_is_a_deserialization_error_and_never_a_removal` is the test that says so.
- **Intent-level duplication must be caught before diffing, not after** (F1). A no-op intent is
  erased before any batch exists, so no batch-level guard can see that it was ever drafted.
- **The two guards are not independent validation of intent** (F4). They inspect paths, not nodes.
  Do not lean on them for a claim they cannot make.

**Three things 2b-2b-2 must not do.**

- **Do not synthesize a collection node**, and do not add a primitive that would. A `params` value
  that is a sequence today may have its *existing* scalar elements edited; it may not gain or lose
  one. That is 2b-2c's work, with 2b-2c's primitives.
- **Do not widen `Remove` to discard structure the editor never displayed.** 2b-2b-1 was asked to
  and refused, deliberately (F2). `RemovalWouldDiscardUnshownStructure` is that decision's name.
  Re-opening it is a decision to make in the open, not a fix to slip in.
- **Do not add a `#[tauri::command]`.** The counts stay `commands.rs:7`, `menu.rs:1` until
  2b-2b-3. `save_match` is 2b-2b-3's, and with it the `draftError` dictionary namespace in both
  languages and the deletion of the TEMPORARY `NOT_A_CODE` entry — which
  `the_temporary_draft_error_exclusion_expires_when_anything_names_it` will force the moment
  production code names the type.

**One debt is now three phases old.** The four `code.diagnosticCode.*` strings 2b-1 corrected have
still not been seen on a screen; 2b-2a opened no window and neither did this phase. **170+ Spanish
values remain checked only by heuristic** — non-blank, non-identical to their English twin, in
placeholder agreement. Nothing establishes that any of them is idiomatic.

---

**Phase 2b-2a is complete and its review is closed.** `docs/decisions/2b-2a-notes.md` is the record;
§11 is the finding-by-finding disposition and §14 is what 2b-2b and 2b-2c inherit. **This application
can now write a user's file from a window** — `move_match` is the seventh `#[tauri::command]` and the
first that is not read-only.

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 828 tests across 20 binaries, 0 failed
```

(and `npm install` before any frontend command, as since 1b-1 — `node_modules/` is gitignored and
`package-lock.json` is committed, so `npm ci` reproduces the pinned tree exactly.)

**The next step is Phase 2b-2b — `MatchDraft`, the minimal-diff engine and `save_match`.** Read the
2b-2 split table above first: **2b-2 was split three ways, and the reason is a fact about the core,
not a preference.** `create_match`, `delete_match` and `save_raw_document` have **no primitive behind
them** and are deferred to 2b-2c along with the primitives they need. Do not reach for them.

**The one rule 2b-2b exists to get right, and it is the whole sub-phase.** A `MatchDraft` is a
*desired state*, and Rust derives the `DocumentEdit` batch by diffing it against the projection. **A
field the draft leaves unchanged must produce no edit at all.** Rewriting an unchanged scalar is not
a harmless no-op: it can change the scalar's spelling and emit a `PresentationNote`, which is a
byte-preservation failure wearing a success's clothes, and it is the failure mode this sub-phase is
cut out to fail at loudly. Diff against the projection associated with **`base_revision`**, and emit
nothing where the projected value already equals the drafted one **even if its YAML spelling
differs**. The draft must be able to say *unchanged*, *set* and *remove* distinctly wherever all
three are meaningful, or the diff is ambiguous and will guess.

**Why the draft, and not an edit list from the frontend.** It was considered and rejected: an
untrusted caller handing over spans and edit kinds would put preservation-critical structure in the
one place this project cannot check, and would let it route around the mapping-scoping and the four
supported operations. Trusted Rust derives the batch. Recorded so it is not re-litigated.

**Everything 2b-2a built that 2b-2b uses unchanged**, and none of it is 2b-2b's to redesign:

- **`SaveResult` is document-level and operation-neutral** — `Saved` / `Conflict` / `Refused`, all
  three in the **`Ok` channel**, because a conflict and a refusal are expected actionable outcomes
  rather than errors. It is **flat**, like `CommandError`, and what it carries keeps the core's own
  convention. `save_match` returns the same type; it does not get its own.
- **`SaveResult::Saved::notes` gets its first producer here.** `PresentationNote` and
  `NotReencodable` are already on the wire with their eight dictionary entries and **no caller** —
  1b-1's shape repeated deliberately. A move re-encodes no scalar; a draft diff will.
- **`moved: MatchId | null` is a fact, never a failure.** It is `null` when the operation had no
  single match, when the commit was skipped, **or when the post-commit read disagrees with the
  revision the transaction established** — meaning another writer reached the file in between.
- **The conflict payload carries `expected`, `found` *and* `disk_revision`**, and the three are not
  interchangeable: `found` is what the **locked** read saw and refused on, `disk_revision` is the
  **fresh read taken after the lock was released**. When they differ the file changed again. No
  string may present them as descriptions of the same bytes. `base` and `draft` are **not** on the
  wire — a deviation from plan §6.4, recorded in `2b-2a-notes.md` §4.
- **`CommandError::SaveFailed` carries a second operand, `may_have_written`**, computed in the
  serializer by calling the core's own `SaveError::may_have_written()`. It is **not a field**, so
  there is no second list of `WriteStep` names anywhere to drift. `mayHaveWritten()` in
  `src/lib/ipc/errors.ts` is the single frontend spelling, and `true` means forget the cached text
  and re-read.
- **`ByteSpan` has a hand-written `Deserialize`** routing through `ByteSpan::new`; an inverted span
  is a **deserialization error**, not a repair. `Acknowledgement`'s is hand-written too and
  re-applies `of()`'s filter. Do not replace either with a derive.
- **`WorkspaceSession` owns an `Open { workspace, backups }`.** The `BackupSession` is constructed
  with the workspace and threaded through every save; **no code path in this crate passes
  `backups: None`**, and if the constructor ever becomes fallible the decision is already written on
  `WorkspaceSession::open` — a save whose safety net cannot be put in place must **refuse**.
- **Cache coherence is the command layer's job**, and `save_document` deliberately does not reach
  into `Workspace`. A committed save refreshes; a conflict refreshes and *that same projection is the
  `disk` payload*, so one read serves both; a failure that may have written **evicts**.

**Five things 2b-2b must not do.**

- **Do not add a `force` flag**, or any acknowledgement bypass. Findings go out, the acknowledged
  subset comes back, matched as an **exact multiset** — `[A, A]` differs from `[A]`, and
  `Acknowledgement::covers_all` consumes matches rather than testing membership.
- **Do not let the command layer cache "the findings I last issued" to police acknowledgements.**
  It cannot prove a human saw anything, it goes stale across reloads and concurrent windows, and
  intersecting sets destroys duplicate multiplicity. Enforcing presentation is the **UI's**
  obligation.
- **Do not call `replace_file_atomically` or `replace_locked_file` from a command**, or from inside
  the transaction — the lock is **not reentrant** and the process hangs silently and forever.
  `save_document` is the only entry point that may write a user's file.
- **Do not accept a wire path back as a target.** Every path crosses as a lossy `String`; two
  distinct non-UTF-8 filenames can render identically. Target by `DocumentId` / `MatchId`.
- **Do not present `committed: false` or `backup: None` as failures.** Both are legal on a success,
  for four documented reasons each.

**Two holes 2b-2a opened that a later phase owns**, beyond the ones listed in the verification
section above:

- **`move_match` holds the session mutex across the whole save** — a lock, two parses, a validation,
  a backup copy and a rename — and every command is synchronous on the main thread. A slow disk
  blocks the window. This was theoretical before 2b-2a; it is not now, and Phase 2's debounced
  editing will make it worse.
- **A committed save writes two files** — the target and, on a first modification, one backup — and
  if the rename then fails, `discard_backup` unrecords the copy but a file may remain. Unchanged
  from 2a-3b hole 2, now reachable from a command.

**Two debts that no test can discharge, both carried forward and both now older.**

- **The four `code.diagnosticCode.*` strings 2b-1 corrected have still not been seen on a screen.**
  CLAUDE.md's rule is that a claim about a screen needs a reading of a screen. 2b-2a opened no
  window, so the next phase that does still owes the look.
- **170 Spanish values are checked only by heuristic** — non-blank, non-identical to their English
  twin, in placeholder agreement with it. 2b-2a added thirteen more. Nothing establishes that any of
  them is idiomatic.

---

**Phase 2b-1 is complete and its review is closed.** `docs/decisions/2b-1-notes.md` is the record; §7 is
the finding-by-finding disposition of both reviews and §4 is what 2b-2 inherits. The save transaction's
types now cross the IPC wire — **18 enums / 157 variants and 7 structs**, each with a `code.` namespace
in both `src/lib/i18n/en.json` and `es.json`, pinned by `src-tauri/src/dictionary_contract.rs` and
`src-tauri/src/wire_contract.rs`. **No `#[tauri::command]` was added**: the count is 6 in
`src-tauri/src/commands.rs` and 1 in `menu.rs`, before and after. This is 1b-1's shape repeated — the
i18n layer shipped with no command behind it for the same reason.

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 798 tests across 20 binaries, 0 failed
```

**The next step is Phase 2b-2 — the six mutating commands**: `save_match`, `create_match`,
`delete_match`, `move_match`, `save_raw_document`, `reload_document`, each returning `SaveResult`, each
carrying an optimistic-concurrency token, with `SaveResult::Conflict` on the wire. It is the first code
that lets anything outside `espansoconfig-core` write a user's file.

**The one thing 2b-2 must do first, and it is a type change before it is a design.** The
acknowledgement has to arrive *from* the interface, and **nothing in the save wire deserializes**.
2b-1 removed the one type-level obstruction — `FindingCode::VariableMissingRequiredParam::param` is now
an owned `String`, not a `&'static str` — but `Deserialize` itself is still absent from `Finding`,
`ByteSpan` and `VariableKind`. Review A (`docs/reviews/phase-2b-1-wire-boundary.md`) ruled on the three
options and named changing the field type the soundest; it is done. What remains:

- **derive `Deserialize` on `Acknowledgement`, `Finding`, `FindingCode` and their complete transitive
  payload graph** — that is `ByteSpan` and `VariableKind` today, and the compiler will name any others;
- **compare acknowledgements as an exact multiset**, consuming matches or counting occurrences, so that
  `[A, A]` differs from `[A]`. Review A calls a set-membership check insufficient, by name;
- **do not** round-trip an index-based selection (unstable if findings reorder between calls) and **do
  not** hand back the exact JSON bytes (JSON permits insignificant byte differences, object-key order
  is not semantic, and Tauri parses the JSON before Rust sees it). Both were considered and rejected.

**Two wire facts 2b-2 inherits and must not re-decide.**

- **A path on the wire is display text, never an identifier.** Every path crosses through `WirePathRef`
  as a *lossy* String, so two distinct non-UTF-8 filenames can render identically and the string cannot
  be copied back to name the file. The real `PathBuf` stays inside the transaction. A command that
  accepts a wire path back as a target is a bug (review A, A-iii).
- **`io::Error` crosses as `kind` plus a nullable numeric `raw_os_error`, never as prose.** The errno
  was added *because* `ErrorKind` collapses distinct failures into `Other`; it is diagnostic data, gets
  **no dictionary entry**, and no message interpolates it. `CommandError::Io` on the read surface was
  deliberately left alone — widening it is a separate decision.

**Five things 2b-2 must not rebuild, and one it must not undo** — unchanged from the 2a-3b checkpoint
and restated because they are still the ones most likely to be re-derived wrongly:

- **An acknowledgement is content-addressed.** The save command carries the findings *out* and the
  acknowledged subset *back in*, matched as a multiset. **A `force: true` parameter would undo the
  whole design.**
- **Nothing in the core can establish that a human saw a finding.** `validate()` is public and `Finding`
  is publicly constructible, so a caller can compute the findings itself and acknowledge them all.
  **Enforcing presentation is the user interface's obligation**; 2b-2 owes the wire shape that makes it
  possible.
- **`save_document` is the only entry point that may write a user's file**, and it writes *two* — the
  target and, on a first modification, one backup. `replace_file_atomically` and `replace_locked_file`
  take finished bytes and validate nothing; **do not call either from a command**, and never from
  inside the transaction (the lock is not reentrant — the process hangs, silently and forever).
- **`SaveRequest::backups` is `Option<&BackupSession>`, and `None` means no backup at all.** 2b-2 must
  construct and own a `BackupSession` for the app session and thread it through, or every save silently
  runs without a safety net. **The user interface owns what a session is** — the core cannot know.
- **`SavedDocument::committed` can be `false` on a success**, and `SavedDocument::backup` can be `None`
  on a success for four documented reasons each. Neither is a failure, and neither may be presented as
  one.
- **`forgetFileText()`** in `src/lib/browser/workspace.svelte.ts` still has **no caller** and must be
  called after a successful write, or the raw viewer keeps the bytes it read before it.

**`SavedDocument` is *not* serialized**, and that is deliberate rather than an omission. It carries
`Replacement` and `PresentationNote`, which are on neither `PROGRESS.md`'s list nor in `SaveError`'s
closure, and which owe their own dictionary entries the day they cross. **What `SaveResult::Saved`
carries out of a successful save is 2b-2's design to make**, not a leftover to pick up.

**`SaveError` is not flattened, and flattening it is 2b-2's call to make explicitly.** The core's types
took the *core's* wire convention — externally tagged, Rust variant names verbatim, `snake_case` fields
— not `CommandError`'s flat `camelCase` `code` + operands. If the frontend wants nine switchable
top-level codes it builds a shell type the way `CommandError` already does for the read surface; it
does not get them from the core.

**Two holes that are still 2b's to close, both inherited unchanged.**

- **Hole 1** — `DuplicateVariableName` and `RegexDoesNotCompile` are unoverrideable `EditorModelError`s,
  so a file espanso demonstrably runs (duplicates are last-wins) can be unsaveable through the visual
  editor. The escape hatch the plan names is the **raw editor**, which is a UI.
- **Hole 13** — espanso 2.3.0 has a tenth variable type, `var_type: "global"`, which this crate reports
  as `VariableTypeNotRecognised`. Fixing it means a `VariableKind` variant, which is a Phase 1 **wire**
  type and owes two dictionary entries.

**What 2c inherits from 2a-3b specifically** (recorded so it is not re-derived): *Reveal backups in
Finder* points at `BackupSession::root()`, **and that directory may not exist** — a session that saved
nothing creates nothing, deliberately. No string may say a file is recoverable; retention is ten
sessions, and the honest sentence names the number. **A backup is not a version history**: it holds the
file as it was before the session's first change to it, not before each change.

**One thing owed that no test can discharge.** Four pre-existing `code.diagnosticCode.*` strings were
corrected during 2b-1's fix round for predicting espanso's behaviour (`parseFailed`,
`fieldHasUnexpectedShape`, `matchHasSeveralTriggerForms`, `matchHasSeveralContentForms` — both
languages, eight values). They appear on the diagnostics surface that Phase 1c-2b-1 read in a running
window, and **that surface has not been re-read since**. CLAUDE.md's rule is that a claim about a screen
needs a reading of a screen; the claim made in `2b-1-notes.md` §7.2 is deliberately narrower — that the
strings no longer predict espanso's behaviour — and the next phase that opens a window owes the look.

**And one that a bilingual reader owes.** 157 Spanish values were written by 2b-1 and checked only for
being non-blank, non-identical to their English twin, and in placeholder agreement with it. That is the
untranslated-value *heuristic*, and `dictionaries.test.ts` says so itself. Review B corrected ten
Spanish strings on quality grounds; nothing establishes that the remaining ones are idiomatic.

---

**Phase 2a-3b is complete, its review is closed, and with it 2a-3 and the whole of 2a.**
`docs/decisions/2a-3b-notes.md` is the record; §12 is the finding-by-finding disposition of all eleven
review findings plus the confirmation pass's one residue, and §11 is what 2b and 2c inherit.
**Plan §6.6 is finished end to end** — all thirteen steps of the save transaction exist, under one
lock, in Rust that no user interface can reach yet.

**The next step is Phase 2b — the Tauri mutation surface**: plan §6.4's six mutating commands
(`save_match`, `create_match`, `delete_match`, `move_match`, `save_raw_document`, `reload_document`),
each returning `SaveResult`, each carrying an optimistic-concurrency token, and `SaveResult::Conflict`
on the wire. It is the first code that lets anything outside `espansoconfig-core` write a user's file.

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 787 tests across 20 binaries, 0 failed
```

**The single largest thing 2b owes, and it is indivisible.** `SaveError` and everything it carries must
cross the wire, and **nothing in `persist` derives `Serialize` today** — deliberately, because the day
any of it does, every variant owes a `code.` namespace in **both** `src/lib/i18n/en.json` and
`es.json`, checked by `src-tauri/src/dictionary_contract.rs`. The full list, which has grown with every
2a sub-phase: `SaveError` (9 variants), `SaveVerdict`, `SaveRefusal`, `Acknowledgement`, `Finding`,
`FindingCode`, `FindingClass`, `WriteError`, `WriteStep`, `TargetDifference`, `EditError`, and now
`BackupError` (with `BackupNameExhausted`), `BackupStep`, `BackupRecord`, `Rotation` and
`RotationOutcome`. **Do not do this piecemeal**; one variant serialized without its string is a
dictionary-contract test failure, and half the enum serialized is worse than none.

**Five things 2b must not rebuild, and one it must not undo.**

- **An acknowledgement is content-addressed.** The save command's wire shape has to carry the findings
  *out* and the acknowledged subset *back in*, matched as a multiset. **A `force: true` parameter would
  undo the whole design.**
- **Nothing in the core can establish that a human saw a finding.** `validate()` is public and `Finding`
  is publicly constructible, so a caller can compute the candidate's findings itself and acknowledge
  them all. **Enforcing presentation is the user interface's obligation, and 2b owes the wire shape
  that makes it possible.**
- **`save_document` is the only entry point that may write a user's file**, and it now writes *two* —
  the target and, on a first modification, one backup. `replace_file_atomically` and
  `replace_locked_file` take finished bytes and validate nothing; **do not call either from a command.**
- **`SaveRequest::backups` is `Option<&BackupSession>`, and `None` means no backup at all.** 2b must
  construct and own a `BackupSession` for the app session and thread it through, or every save silently
  runs without a safety net. **The user interface owns what a session is** — this crate cannot know.
- **`SavedDocument::committed` can be `false` on a success**, and `SavedDocument::backup` can be `None`
  on a success for four different reasons. Neither is a failure, and 2b must not present either as one.
- **`forgetFileText()`** in `src/lib/browser/workspace.svelte.ts` still has no caller and must be called
  after a successful write, or the raw viewer keeps the bytes it read before it.

**Two holes that are 2b's to close, both inherited unchanged.**

- **Hole 1** — `DuplicateVariableName` and `RegexDoesNotCompile` are unoverrideable `EditorModelError`s,
  so a file espanso demonstrably runs (duplicates are last-wins) can be unsaveable through the visual
  editor. The escape hatch the plan names is the **raw editor**, which is a UI.
- **Hole 13** — espanso 2.3.0 has a tenth variable type, `var_type: "global"`, which this crate reports
  as `VariableTypeNotRecognised`. Fixing it means a `VariableKind` variant, which is a Phase 1 **wire**
  type and owes two dictionary entries.

**What 2c inherits from 2a-3b specifically** (recorded here so it is not re-derived): *Reveal backups in
Finder* points at `BackupSession::root()`, **and that directory may not exist** — a session that saved
nothing creates nothing, deliberately. No string may say a file is recoverable; retention is ten
sessions, and the honest sentence names the number. **A backup is not a version history**: it holds the
file as it was before the session's first change to it, not before each change.

---

**Phase 2a-3a is complete and its review is closed.** `docs/decisions/2a-3a-notes.md` is the record;
§11 is the finding-by-finding disposition of all fourteen review findings and §10 is what 2a-3b and 2b
inherit. Plan §7 row 11 is now **three-quarters closed** rather than a quarter: line endings and the
BOM are preserved by construction by the span layer, permissions are restored as mode bits **and** ACL,
and ownership is the one that remains — unfixable by an unprivileged rename-based writer.

Phase 2a-3b was, in its own words, plan §6.6 step **13** and plan §6.6's
"Backups" paragraph. Before the first modification of each file per session, copy the file into a
location that is **not** under an auto-loaded glob, retain the last 10 save batches, and offer *Reveal
backups in Finder*. It is Rust with no UI and no IPC, exactly like 2a-1, 2a-2a, 2a-2b and 2a-3a — the
*Reveal* affordance is a UI and belongs to 2c; what 2a-3b owes it is a path.

The exact first command a fresh session should run:

```sh
cargo test --workspace          # expect 736 tests across 19 binaries, 0 failed
```

**Where the backup step goes, established rather than guessed** (2a-2b notes §8): **between the verdict
and the commit**, inside `save_document`. The lock is already held there, the candidate already
exists, and the target's current bytes are already in memory as `source` — so a backup needs **no extra
read**. It must **not** run before the verdict, or a refused save leaves a backup of a file nobody
changed.

**What 2a-3b inherits from 2a-3a, and must not rebuild.**

- **A backup is a *copy*, and a copy has the same metadata problem the save had.** 2a-3a established
  that `fcopyfile(COPYFILE_ACL | COPYFILE_XATTR)` is how this project carries an ACL and extended
  attributes onto a new inode, and that `COPYFILE_STAT` is **excluded** — measured to restore a stale
  mtime and to copy `uchg`, which then makes a later rename fail and leaves an undeletable file.
  A backup that wants the original's metadata should reuse `copy_metadata`'s decisions, not re-litigate
  them. Whether a backup *should* carry the ACL at all is a real question 2a-3b must answer: an ACL that
  denies deletion, carried onto a backup, makes the backup unrotatable.
- **`copy_metadata` is private to `persist::write`** and takes two `&File`. Exposing it, or a
  `pub(super)` twin, is 2a-3b's call.
- **`SavedDocument::committed` can be `false` on a success.** A candidate byte-identical to the target
  is not rewritten, because every rename installs a new inode and drops metadata for nothing. **A backup
  must not be taken for a save that wrote nothing.**
- **`verify_temp_identity` is the pattern for "the name still means the inode I hold".** A backup that
  writes through a temp file owes the same check, and the same explicit precondition: the rename is by
  pathname, so a directory writable by an untrusted principal is out of scope.
- **A refusal may leave a temp file behind, and 2a-3a stopped claiming otherwise.** Nothing cleans
  leftovers up (notes hole 6). If 2a-3b's backup directory accumulates its own leftovers, it inherits
  that problem rather than solving it, and should say so.

**Three things 2a-3b is most likely to get wrong.**

- **A backup location under an auto-loaded glob is a bug that creates snippets.** Plan §6.6 names
  `~/Library/Application Support/espanso/.espansoconfig-backups/<timestamp>/…`; the leading `.` and the
  directory nesting are both load-bearing, exactly as the temp file's leading `_` and non-`.yml` suffix
  are in 2a-1.
- **"Before the first modification of each file per session" is a statement about session state**, and
  `crate::persist` currently holds none. Where that state lives is 2a-3b's decision to make and to write
  down — a transaction that consulted the caller's cache would be a second owner of the session's state,
  which 2a-2b explicitly refused to become.
- **Diagnostics are phrased as risk, not prophecy**, and this governs variant names, doc comments and
  **test names**. Three sentences a string must never say, inherited rather than invented: *espanso will
  reject this* (plan §6.6); *your edit cannot be lost* (2a-1 D4 — the residual race is one rename wide);
  *this file is valid* (step 4 proves it parses under **our** substrate, step 5 reports under **our**
  model). A backup phase adds a fourth candidate: *your file is recoverable* — retention is 10 batches,
  not forever. 2a-3a added a fifth by removing one: *nothing was written* — a refusal leaves the
  **target** untouched, which is not the same claim.

**What 2a-3b inherits from 2a-2b, and must not rebuild.**

- **`save_document(SaveRequest) -> Result<SavedDocument, SaveError>`** in
  `crates/espansoconfig-core/src/persist/save.rs` is plan §6.6 steps 1 to 12, under **one** lock. It is
  **the only entry point that should ever write a user's file**; `replace_file_atomically` and
  `replace_locked_file` take finished bytes and validate nothing.
- **Do not call `replace_file_atomically` from inside the transaction.** Disabling experiment E12 is
  what happens: the lock is not reentrant and the process hangs, silently and forever.
- **`SavedDocument::committed` can be `false` on a success.** A candidate byte-identical to the target
  is not rewritten, because every rename installs a new inode and drops eight metadata classes for
  nothing. A backup must not be taken for a save that wrote nothing.
- **The blocking policy is one pure function, `verdict(&[Finding], &Acknowledgement)`.** An
  `EditorModelError` refuses with no override; a `SuspiciousButPermitted` refuses until the caller
  acknowledges it **by content**, matched as a **multiset**. Extending it means a `SaveVerdict` variant,
  which is an exhaustive-match compile error.
- **`inspect_target` is the only read of a save target in the crate**, and it is `pub(super)` for that
  reason. It opens `O_NOFOLLOW | O_NONBLOCK` and refuses a non-regular target. A second, unchecked read
  is how finding 8 happened; do not add one.
- **Nothing new derives `Serialize`.** `SaveError` (8 variants), `SaveVerdict`, `SaveRefusal` and
  `Acknowledgement` owe `code.` namespaces in **both** `en.json` and `es.json` the day any of them
  gains it, and they carry `Finding`, `FindingCode`, `FindingClass`, `WriteError`, `WriteStep`,
  `TargetDifference` and `EditError` with them. That is a large, single, indivisible change, and it is
  **2b's**. **2a-3a made it two variants larger and no harder**: `WriteStep::VerifyTempIdentity` and
  `WriteError::TempFileChangedDuringWrite` join the list, and the dictionary contract check
  (`src-tauri/src/dictionary_contract.rs`) was verified to still not see either — neither type derives
  `Serialize`, so **no dictionary key is owed today** and no i18n JSON file was touched.

**What 2b inherits from 2a-2b, and must not rebuild.**

- **An acknowledgement is content-addressed, and 2b must round-trip the findings, not a boolean.** The
  save command's wire shape has to carry the findings out and the acknowledged subset back in. A
  `force: true` parameter would undo the whole design.
- **Nothing in this crate can establish that a human saw a finding.** `validate()` is public and
  `Finding` is publicly constructible, so a caller can compute the candidate's findings itself and
  acknowledge all of them. Enforcing presentation is the **user interface's** obligation, and 2b owes
  it. (This corrects a claim the first pass of the notes made and the review withdrew.)
- **Hole 1 is 2b's to close, not 2a-3's.** `DuplicateVariableName` and `RegexDoesNotCompile` are
  unoverrideable `EditorModelError`s, so a file espanso demonstrably runs — duplicates are last-wins —
  can be unsaveable through the visual editor. The escape hatch the plan names is the **raw editor**,
  which is a UI. Until it exists, the hole is open.
- **Hole 13 is still 2b's**: espanso 2.3.0 has a tenth variable type, `var_type: "global"`, which this
  crate reports as `VariableTypeNotRecognised`. Fixing it means a `VariableKind` variant, which is a
  Phase 1 **wire** type and owes two dictionary entries.

**What the earlier phases leave, and Phase 2 as a whole should not rebuild** — the Phase 1 inheritance
below is still current for 2b and 2c, and the two items addressed to Phase 2 by name are:

- **`forgetFileText()`** in `src/lib/browser/workspace.svelte.ts` must be called after a successful
  write, or the raw viewer keeps the bytes it read **before** it. Nothing fails without it; that is why
  it is written here.
- **`RawDocumentText.text` carries no revision and is not authority for a write.** The viewer's text is
  for reading.

---

**Phase 1c-2b-2b-2 completed Phase 1c-2b-2b, Phase 1c and Phase 1.**
`docs/decisions/1c-2b-2b-2-notes.md` is the record; §8 is the exit verdict and §12 is the
review disposition.

The application can now show **one whole file's text**, drawn through the same primitive the detail
pane uses, with a toggle in the third pane. `documentText()` has a caller at last, so it is in `dist`.
**All five fidelity rows that only a whole document could exhibit are closed by a window reading** — a
real BOM, a NUL, five other C0/C1 controls, a lone CR and a file with no final newline — and a file
that is **not valid UTF-8** draws a typed refusal with its byte offset instead of an empty box, which
closes 1c-2b-2a hole 8.

**Phase 1's stated exit was checked rather than assumed, and it is met.** In a running window over the
owner's real configuration: 13 files, **zero** load failures, **zero** findings, every file's whole
text rendered, and **all 65 snippets clicked and rendered** with 3–6 sections and exactly one
source-text box each. Recorded as counts and file names only (D1). Three things that verdict does
**not** cover are named in notes §8 — the sharpest being that the real configuration produces **zero**
unmodelled entries, so it exercises that surface not at all and synthetic fixtures are its only
coverage, permanently.

**The review round is done: eight findings, two of them blocking, seven closed and the eighth recorded
with Phase 2 as its owner.** See "Phase 1c-2b-2b-2 review disposition" above. The two blocking fixes
were a **user-facing string that was false for line endings** — reworded in both languages and read on
a screen — and a **cleared target that left a stale file-text snapshot**, now invalidated by one
helper called from every path that can remove the target.

**What Phase 2 inherits from Phase 1, and should not rebuild.** (Still current for 2b and 2c; the
authoritative next step is at the top of this section.)

- **`rawDocument.ts` and its four arms.** `loading`, `text`, `empty`, `refused` — a file this
  application cannot show must not look like an empty one, and that rule now has two instances
  (`SourceSlice` over a span, `RawDocumentText` over a file).
- **`documentStart` has exactly one caller and must keep exactly one.** It is the only way a `bom`
  segment is produced; a slice that passed it would claim to know where byte 0 is.
- **`sourceSegments(text, atDocumentStart)` and `SourceText.svelte`, unchanged.** Still the one place
  file text becomes something a screen can draw. **Do not write a second renderer**, and do not
  re-slice by a wire span in JavaScript (`1c-2b-2a-notes.md` §4.2).
- **The corpus sweep in `sourceText.test.ts`.** All 33 committed fixtures now go through the primitive
  and are rebuilt character for character; experiment J shows it catching a normaliser on a real file.
- **The cost model, measured** (notes §8.1): `2n` segments for *n* lines, to 968 000 bytes in a test
  and 17 840 bytes / 45 ms / 4 409 DOM nodes in a window. **Nothing is capped**, deliberately.
- **One plan per launch** (notes §6.1). A WKWebView whose window is occluded stops running `setTimeout`
  about six seconds after launch; `open -a` does not restart it and `-NSAppSleepDisabled` does not
  prevent it. Every window reading from here on must be a short, single-purpose run, relaunched into a
  **fresh bundle path** — LaunchServices silently drops `--env` for a path it thinks is already
  running.
- **Fourteen holes** (notes §9). Three are now holes with **measurements**: the pane still renders file
  text two ways (hole 2, with the reason it was not fixed — the primitive has no inline presentation),
  a parse-failed file still shows `0` like an empty one (hole 3, **seen** on adjacent sidebar rows),
  and mixed line endings are still invisible (hole 5, seen on a 19-break document, and the caption
  above the document now says so rather than implying otherwise).
- **Hole 14 is addressed to Phase 2 by name, and is the one item here a phase can fail by ignoring.**
  It is the review's eighth finding, recorded rather than fixed. Two halves:
  - **There is no way to refresh the file the viewer is showing after a write.** `readFileText()`
    returns early when the target is the file it already holds, and the `force` flag that could have
    overridden that was deleted at experiment E because nothing read-only could reach it. So after a
    successful write the viewer keeps the bytes it read **before** it, and close-and-re-open is the only
    refresh. Phase 2 must call **`forgetFileText()`** (`src/lib/browser/workspace.svelte.ts`) after a
    successful write — deliberately, because **nothing fails without it**.
  - **`RawDocumentText.text` carries no revision and is not authority for a write.** It is a `string`;
    the `ContentRevision` saying which bytes it came from is not on it. Basing an edit on it would be
    writing over whatever is on disk *now* with what was read at some earlier moment. **The viewer's
    text is for reading.**

**What earlier sub-phases leave, and 1c-2b-2b should also not rebuild.**

- **A detail pane, and the rule that keeps it thin.** New work deciding *what* appears goes in
  `src/lib/browser/detail.ts` beside `describeMatch()`; the component gets the walk. The text scan at
  the end of `detail.test.ts` is where a new accessor gets its cheap guard.
- **Seventeen reactive typed accessors** — 1c-1's fourteen plus `tValueKind`, `tDetailField` and
  `tUnknownCount`. **A component calls one and never builds a key.** As of 1c-1 that is enforced rather
  than trusted: `scripts/lint/built-translation-keys.ts` refuses any `t(` whose key is not written
  literally, and it found a two-phase-old instance the moment it was written.
- **226 dictionary keys**, `en.json` still the schema, and the untranslated-value exception list now
  carries `browser.detail.section.variables` by name.
- **`DIAGNOSTIC_DISPLAY_INDICES`, and the pattern it establishes.** New in 1c-2b-1: a **mapped type
  over `DiagnosticCodeName`** that converts a zero-based wire operand into a one-based display number,
  emitting it under a *display* operand name so a stale dictionary leaves a visible placeholder rather
  than a wrong number. A new code without a row is a `svelte-check` failure naming the variant. **Any
  further wire-value-to-display-value conversion belongs here**, beside `ENUM_OPERAND_NAMESPACES` and
  nowhere near the key builders.
- **A working data path, and every file now projected at `open()`.** `browser.status`,
  `browser.documents`, `browser.sidebar`, `browser.scopedMatches`, `browser.visibleMatches`,
  `browser.selected`, `browser.selectedMatch` and `browser.loadFailures` are all live, the selection is
  R27-correct, and **config profiles project too** as of 1c-2b-1. `holdsMatches` governs *counting and
  list membership* only — and it is asked on **`kind`, not `shape`**, because a match-shaped profile is
  still a profile. Both branches of `scopedMatches()` ask it; removing either guard reintroduces a real
  leak (experiment Z).
- **A plural helper.** `src/lib/i18n/plural.ts` selects a `.one` / `.other` key pair on `count === 1`.
  Any new counted string uses it; `"1 snippets"` was a real defect on a real screen.
- **A findings surface in the middle pane**, `src/lib/browser/findings.ts`, with two identities over
  one data type: `diagnosticIdentity` (code only) decides which sentence appears,
  `occurrenceIdentity` (code + span + node + path) decides how many times it is counted. **If a new
  judgement needs a home, it goes here, not into the component.**
- **A notice area, selection-scoped.** If 1c-2b-2 needs somewhere for a non-blocking failure,
  `1c-1-notes.md` hole 5 is the shape of the work: `menuUnavailable`, `menuBuildFailed` and
  `invalidMenuLabels` still have a string and no screen.

**Five rules 1c-2b-2b is most likely to break** — and 1c-2b-2a broke the first of them six times, in
doc comments and test names rather than on a screen, which is the same defect in the one place the
markup scan can never see.

- **Do not claim on screen what the app does not do.** New in 1c-2a, and **1c-2b-1 broke it three
  times in one sub-phase** — a string saying a second YAML document "is shown" when nothing showed it,
  a string saying the *snippet* held a hazard that `disqualifying_hazard` also finds on ancestors, and
  two sentences in its own notes asserting profiles stayed out of `scopedMatches` while they did not.
  The pattern is identical every time: **the sentence was written from the intent, not from the data.**
  1c-2b-2a made it six more, all in doc comments and test names — a test called *…crosses as its own
  bytes* that never built an app, one called *a remote origin is refused* that attempted three of seven,
  one called *every command…* that omitted the new one, and a capability manifest that said "all six"
  the day a seventh was registered. **1c-2b-2b is more exposed than any of them**, because its entire
  subject is *showing bytes* and its most likely failure is a viewer that says "as written" while a
  transformation sits between the file and the screen. **Before writing a string, check the data behind
  it exists and says that** — and before writing a test *name*, read the body and ask whether it could
  fail if the name were false.
- **Never hardcode a user-facing string** (CLAUDE.md §2). Every namespace now has a caller, so a new
  string here is genuinely new prose in **both** dictionaries.
- **R31 — a clean lint run is not evidence.** `scripts/lint/hardcoded-strings.ts` sees `.svelte`
  **markup** only: not `<script>` bodies, not `{'literal'}`, not `.ts` constants, not props. 1c-2a and
  1c-2b-1 both enumerated their blind spots by name rather than assuming them clean; do the same.
  **Experiment Y is the demonstration**: `tHazard(` left in a comment while the markup renders the raw
  identifier passes the entire suite.
- **Nothing establishes that any of the Spanish strings is Spanish.** The untranslated-value check
  establishes non-identity. This now matters more than it ever has: the strings are on a screen, 1c-1
  added 35, 1c-2a added 50 and 1c-2b-1 added 8. A bilingual reader is the only thing that closes it.
  The one defect found here so far — two different Spanish words for one concept, one above the other
  on screen — was found **by reading a screen**, which remains the only instrument that has ever caught
  anything in this area.
- **`cargo build` must follow every `npm run build` before a window reading.** New in 1c-2b-1 and it
  silently invalidated one reading: `custom-protocol` embeds `dist` into the binary, so a window opened
  after only a `vite build` shows the **previous** bundle and looks entirely normal.
- **Nothing renders a Svelte component in an automated test** — `1c-1-notes.md` hole 1, and the reason
  the R32 readings had to be re-taken after the fix round. A component that throws produces an empty
  pane that the whole suite passes straight through. Either adopt a DOM and a component-testing library
  as a deliberate decision with its own costs, or read the window again. **Do not skip both.**
- **A held identity can go stale, and the UI is what holds identities** — R27. `match_by_id` returns
  `Result<_, IdentityError>`; a lookup crossing a `refresh()` may get `StaleRevision`, which means the
  **document moved on**, not that the match survived. Recovery is re-resolution, with three possible
  answers, and `identityRecovery()` returns them as data so a caller cannot skip one. `DocumentPath`
  is **not** a fallback identity — a sequence step is a position. **1c-1 got this wrong once already**
  and a reviewer caught it: the comparison that decided `sameMatch` was blind to `word`, to variables
  and to every non-primary content field. It compares `MatchView.source_text` now — the match's own
  bytes — and **must not be narrowed back to a display projection.**

**Phase 1 is read-only, so it cannot corrupt a file.** That makes it the right place to spend effort on
the UI shell, i18n and the Tauri boundary rather than on fidelity. The fidelity engine is done and
proven, and since 1a the read model is too.

### What Phase 1b inherits from 1a

- **The command surface already exists.** `Workspace::{discover, summary, list_documents,
  get_document, get_match, document_view, document_text, refresh, load_all, evict}` maps onto plan
  §6.4's read-only commands. `DocumentView` is what crosses the boundary; `SourceDocument` is
  deliberately not serializable.
- **A held identity can go stale, and the UI is what holds identities** — R27, **corrected at
  1b-2a**. `match_by_id` returns `Result<_, IdentityError>` and a lookup crossing a `refresh()` may
  get `StaleRevision`. Handle it; do not unwrap it. That code means **the document moved on** — not
  that the match survived. Recovery is *re-resolution*, and re-resolution has three possible answers:
  the same match, a **different** match, or nothing. `DocumentPath` is **not** a fallback identity: a
  sequence step is `PathSegment::Index(usize)`, a position, so an external edit that deletes an
  earlier match leaves the path resolving to a different one. The earlier wording here — "re-resolve
  by `DocumentPath`, the thing designed to survive a reparse" — was **false and is withdrawn**.
- **Scalars arrive as source text**, per D2u. There is no type to render, and no badge derives from a
  value.
- **`Deserialize` is derived on a named list only** — R28. Do not widen it without reading
  `docs/decisions/1a-notes.md` §9 hole 6 first.

### What the gate licenses, and what it does not

**Licensed:** UI work on the operations that exist — editing a scalar, adding and removing a field,
reordering matches **inside one sequence**.

**Not licensed, and each has a reason on file:**

- **Presenting a plain scalar's *type*** to the user. R16's open half: 31 synthetic and 65 real plain
  scalars resolve non-`str` under YAML 1.1, and the projection is not proven to match espanso's resolver.
  A UI that renders `on` as a boolean is making a claim this project has not earned. **This question is
  now decided — see D2u: the browser shows source text, never an inferred type.** Flagging a scalar as
  1.1-ambiguous *is* permitted, because that is a claim about risk rather than about meaning.
- **Moving a match between files or between sequences** (D2r). `ItemMove` is same-sequence only, and its
  "no re-indentation" proof does not transfer. Plan §8.4's drag-between-files needs its own operation.
- **Combining a move with any other edit in one batch** (R25).

### The two concerns this section used to raise before Phase 1, and where they stand

1. **R19's remaining half — ✅ answered by 1a.** The safe entry point re-scanned on every call, and
   ~20 ms per keystroke-triggered rescan is not viable for an editor. `crate::workspace` now builds the
   `SyntaxIndex` + `TriviaIndex` **once per `ContentRevision`** and serves views from the cache, pinned
   against an instrumented parse counter. What is *not* answered is incrementality: a document that
   changes is reparsed whole. That is fine for a browser and will need revisiting when Phase 2 edits on
   a debounce.
2. **Architecture rule (CLAUDE.md §3) — still absolute, and the check changed in 1b-1 (D2x).**
   `crates/espansoconfig-core` must never depend on `tauri`, directly or transitively.
   `rg -c tauri Cargo.lock` **is no longer a check** — `src-tauri/` exists, so the lockfile contains
   tauri legitimately and that command now finds matches whether or not the rule holds. The check is
   `cargo tree -p espansoconfig-core | rg tauri` finding nothing, and it was run and empty at 1b-1.
   Do not quote the old one-liner as evidence again.

### Standing rules that outlive Phase 0

- **R24 — a safety property that lives only in the test suite is not a safety property.** It has now
  occurred **three times, in three consecutive phases**, and the third (Phase 1a) was found by a
  *reviewer* rather than by the phase. Whenever a sweep proves something the engine relies on, ask
  whether the engine asserts it too. The closure condition is the sentence in
  `docs/decisions/0c-3b-2b-notes.md` §8.1: *the gate rests on no property whose only home is a test file.*
  **Its 1a corollary, which is cheaper to check and catches more:** read the test's *name*, then read its
  *body*, and ask whether the body could fail if the name's claim were false. `…survives_a_reordering`
  never reordered anything for a whole phase.
- **An audit that iterates what the implementation emitted is vacuous.** New in 1a (D2w), and it is R24
  seen from the other side: a coverage check that walks the records the code chose to produce cannot see
  a record the code declined to produce. Derive the expectation from the **document**, then compare.
- **R20 — the corpus is the weak link, eight occurrences.** A new refusal gets a fixture on **each side**
  of its condition, never one inside it. The eighth was `ExplicitKeyMapping`, which had no fixture at all
  for five phases while being counted as covered. **1a added two more deviations rather than fixtures** —
  the depth guard and the non-scalar sequence item are pinned by hand-written sources on both sides, not
  by corpus fixtures — and both are recorded as deviations in `1a-notes.md` §9 holes 4 and 10.
- **An oracle must be able to disagree.** Break the **engine** and check the oracle fires, not only the
  reverse.
- **A comparison that decides identity must see everything that distinguishes two things.** New in 1c-1,
  and it is R24's corollary aimed at a *predicate* rather than at a test. The selection's fingerprint was
  assembled from what the **list pane displays** — search text, badges, two shape codes — and was then
  asked to answer a question about **identity**. Two matches differing only in `word: true` / `word: false`
  were identical to it. The lesson generalises: when a comparison is built from a projection, write down
  what the projection drops, then ask whether the question being asked can survive those omissions.
- **A component that no test renders is a component nobody has run.** New in 1c-1. The whole frontend
  suite — 354 tests — passes without instantiating a single Svelte component, so a runtime error in one
  produces a blank pane the suite cannot see. Until that changes, **a claim about a screen needs a
  reading of a screen**, re-taken after any change to a component. 1b-1's blank window is the precedent.
- **An identity that is "designed to survive" something has to be shown surviving it.** New in 1b-2a,
  and the fourth occurrence of the pattern R24's corollary names. The phase wrote that `DocumentPath`
  was the identity designed to survive a reparse, **in three files and in this checkpoint**, without a
  test in which anything survived a reparse. The reviewer wrote the counterexample in four lines. Read
  the *name* of the property, then look for the test that could fail if it were false — the same check
  as R24's corollary, applied to a doc comment instead of to a test name.
- **Corpus privacy (D1) is absolute**, and matters more as the UI grows: no real config content in any
  committed file, screenshot, test name or report. Real-corpus counts computed, never hard-coded; its
  tests skip cleanly when absent.
- **Never hardcode a user-facing string** (CLAUDE.md §2). This is the rule Phase 1 is most likely to
  break, because a browser is almost entirely user-facing strings.

### The weakest pins, if a later phase touches them anyway

**R22** (`InconsistentEntryIndentation` pinned at 0 by argument, not construction — the weakest in the
table), **R25** (move verification is not compositional, so `OverlappingEdits` is never tested against a
move-versus-edit conflict), **R26** (`shares_a_line` is a unit test rather than a fixture), and R16's
1.2-core half, which has no second implementation where the 1.1 half now has one.

---

## Key paths

| Path | Why it matters next |
|---|---|
| [`src/lib/browser/matchCreation.ts`](src/lib/browser/matchCreation.ts) | **The new-snippet form as a value, and 2c-3a-2 draws it without adding a rule to it.** Its own module rather than a mode of `matchEditor.ts` (consult Q3): creation has no projection, no baseline and no absent-key semantics, so the `Unchanged`-versus-`Set("")` distinction that dominates the small editor has no meaning here and must not be imported. `destinationsOf(documents, views)` maps the **summaries**, so a file the sidebar names as unreadable appears as ineligible rather than vanishing — five typed refusals, rendered with `tDestinationRefusal`, **never a built key**. The `After` anchor is an **identity** and a change of destination clears or replaces an incompatible one. `chooseDestination`/`choosePlacement` **withdraw the consent, the submission and the outcome**, which is round 1's first High finding: a create refused in file A and acknowledged there could otherwise be redirected to file B and committed on consent nobody gave for it |
| [`src/lib/browser/matchDeletion.ts`](src/lib/browser/matchDeletion.ts) | **Deletion as a two-phase value (consult Q2), because the protocol's own acknowledgement round trip only engages when there are findings** — a clean delete produces none, so without this one click writes a user's file and there is no in-app undo until 2c-5. `confirmDelete(session, projected)` is the **only** producer of a `StartedDeletion`, and its second argument must come from the **live projection**: the module's header says in the same sentence that nothing enforces where it came from, and a component handing back `session.match` defeats the whole check — that was round 1's fifth finding, where the comparison observed nothing about the world. The last-snippet refusal is an **affordance derived from current state, never authorization**; the core refuses it too and that refusal is what reaches the screen |
| [`src/lib/browser/typing.ts`](src/lib/browser/typing.ts) | The coalescing boundary — `Clock`, `TYPING_GROUP_IDLE_MS`, `TypingRun<F>`, `recordTyping` — **extracted** from `matchEditor.ts` in 2c-3a-1 rather than copied a second time, because two editors now share it. What did **not** move is which actions *close* a run; those are transitions of an editor and each still decides its own. `matchEditor.ts` re-exports `Clock` and `TYPING_GROUP_IDLE_MS` because `MatchEditor.svelte` imports the first from there and step 1 could not touch a `.svelte` file |
| [`docs/reviews/phase-2c-3a-1-confirmation.md`](docs/reviews/phase-2c-3a-1-confirmation.md) | **The clearest case in this project of a fix becoming the next defect, and worth reading before any change to the selection machinery.** Round 1 closed an in-flight-lookup race with one *global* generation bump; this pass showed that a projection replaced in file B then killed a pending `select()` for file A and **stranded a `MatchId` naming nothing** — the sub-phase's declared worst failure, reached from the other side, with a green suite because every deferred test used one document. It is also why `docs/reviews/phase-2c-3a-1-third-pass.md` exists |
| [`src/lib/browser/rawEditor.ts`](src/lib/browser/rawEditor.ts) | **The editor's whole state machine as a value, and the model 2c-2's field editor should follow** — the component is a thin walk over it, which is what let the protocol be tested at all. Its drafted value is `RoundTripText`, a **branded** string whose only constructor applies the carriage-return check, so a bare `string` cannot type-check into a draft, a submission, a history step or a candidate; all three doors mint one or refuse, and `beginSave` re-checks because **a brand is a cast at bottom** and that is the last line before a wire that replaces a user's file. **The brand does not generalize to 2c-2**: a `replace` block scalar drafted through a `<textarea>` meets the identical API-value normalization, and that must be decided deliberately rather than assumed covered |
| [`src/lib/components/RawEditor.svelte`](src/lib/components/RawEditor.svelte) | **The first screen in this project that writes a user's file**, and the first of the three components with a mounted test — `MatchEditor.svelte` and `DetailPane.svelte` gained theirs in 2c-2-2. **The harness is scoped by docblock opt-in, not by default**: `environment: 'node'` stays the suite's default, a file opts in with `/** @vitest-environment jsdom */` as its first line, and the five components with no mounted test are deliberately **not** back-filled — each of the three that has one gained it in the sub-phase that changed it. Read `copyBySelecting` before writing any clipboard code: `navigator.clipboard` is not sufficient on its own here, the carrier must be **offscreen rather than `hidden`** (an unrendered element cannot hold a selection), and every step of putting the screen back is separately non-throwing — because the first version restored focus in an unguarded `finally`, so a throw there produced **no** disclosure at all, neither success nor failure, on the one control that exists to keep a draft from being lost |
| [`docs/decisions/2c-1b-notes.md`](docs/decisions/2c-1b-notes.md) **§9** | **The two window readings, and the reason this project's third kind of evidence is not ceremony.** They found two real defects that 883 passing tests, `svelte-check` and two Codex passes had all sailed past — one of which silently rewrote every line ending in a user's file. §9.11 is the re-take, taken because the fixes changed three components. **§13 is the honesty rule's third occurrence in one phase**: a decision record asserting a guarantee the code did not give. D13 is the corrected shape to copy — three named categories, one of them *what merely happens to be true of the current component path*, written as no guarantee at all |
| [`vite.config.ts`](vite.config.ts) | **The jsdom decision, taken in 2c-1b and scoped**: `environment: 'node'` stays the default and component test files opt in by docblock; the components with no mounted test are **not** back-filled. **`resolve.conditions` is set conditionally and that is load-bearing** — the option *replaces* Vite's defaults, and setting it unconditionally silently took the production build from 154 to 180 modules and pulled in Svelte's **server** build with nothing failing. **The module count is the regression guard and it moves with the source: 154 at 2c-1b, 156 at 2c-2-1, 158 at 2c-2-2, 161 at 2c-3a-1.** The guard is not the number but the *shape of a change to it* — a delta equal to the new source modules is a new module, a jump to ~180 with `svelte/internal/server` in the bundle is the regression. Rebaseline by building a pristine `git archive HEAD` copy and subtracting; **never by editing the condition** |
| [`src/lib/browser/workspace.svelte.ts`](src/lib/browser/workspace.svelte.ts) | **The only place a writing command is wired to real state.** `moveMatch` (2b-2a), `saveRawDocument` (2b-2c-3b) and `saveMatch` (2c-2-1), `createMatch` and `deleteMatch` (2c-3a-1) are all in `BrowserCommands`, `REAL_COMMANDS` and `BrowserState`: **all five writing commands are now wired**, though only three are called from a screen. **`createMatch`, `deleteMatch` and `moveMatch` take a caller-supplied `baseRevision` and forward it unchanged; `saveMatch` still substitutes `view.revision` read at call time** — round 1's second High finding, left because its caller is `DetailPane.svelte:435` and step 1 could not touch a `.svelte` file. **2c-3a-2 fixes the signature and the caller together.** The selection machinery is now **two** counters, not one: a per-document `projectionGenerations` map bumped by `installView`/`forgetTheReplacedDocument` for their own file, and the global `selectGeneration` as *selection intent* bumped by `replaceSelection`. Collapsing them back into one is exactly the cross-document identity-stranding bug the confirmation round found. `saveMatch` answers **`MatchSaveAnswer`** (`answered` / `notAttempted` / `failed` with a **required** `IpcFailure`), never `SaveResult \| null`, and performs the identity adoption **before** the answer is handed back. The two wirings are **not interchangeable**: `adoptTheDocumentOnDisk` re-points a selection **by identity**, while `forgetTheReplacedDocument` + `adoptTheReplacedDocument` must re-resolve **positionally and then check**, because a whole-document replacement leaves no identity to re-point with. `forgetTheReplacedDocument` runs **synchronously, before any `await`** — that ordering is the fix for the 3b review's Medium and is not incidental. `forgetFileText()` still has callers to gain |
| [`src/lib/ipc/commands.ts`](src/lib/ipc/commands.ts) | **The eleven wrappers, five of which write.** `saveRawDocument` is the only one that does not return `CommandResult<SaveResult>`: it returns **`RawSaveOutcome`**, whose success arm always carries the `SaveResult` **plus** a required `reload` discriminant (`notOwed` / `done` / `failed`). That shape exists because the 3b review found **D2 broken in TypeScript** — a rejecting reload callback threw past the return type and hid a *committed* write. **A sixth writing wrapper inherits the rule, not the shape**: whatever it returns, a committed write may never come back as a rejection or an error |
| [`src/lib/browser/rawSave.ts`](src/lib/browser/rawSave.ts) | The Q8 presentation model, in the tested layer rather than in a component. `describeRawSave` puts **"this replaces the entire document"** first in every model — the mode's identity, not a warning — then the owner's ruling when the candidate does not parse: espanso will not load the file, the parser's position **or the explicit no-position case**, and the choice. **`saveAnyway` is withheld for verdicts no acknowledgement can move.** `detail` is the parser's own message: carried, never localized, and deliberately not rendered |
| [`docs/decisions/2b-2c-3b-notes.md`](docs/decisions/2b-2c-3b-notes.md) | Nine decisions with their reasons and the fix round. **§2.2 is the one to read before adding a writing command**: a raw save takes **no `view_at`**, because a replacement turns nothing into a position and — in consult Q7's scenario exactly — the session's cache still holds the loaded revision, so a pre-check would *pass*. Only the transaction's locked read sees it, and `SaveResult::Conflict` is strictly richer than `IdentityStaleRevision` |
| [`docs/reviews/phase-2b-2c-3b-code.md`](docs/reviews/phase-2b-2c-3b-code.md) | The review that returned **NOT READY** and was obeyed. **Its High is the precedent worth keeping**: an invariant stated for Rust (*a committed write is never afterwards reported as an `Err`*) had been broken at the TypeScript boundary, where no Rust test could see it. Its two Lows are the recurring shape — a test that read the cache while claiming to read the disk, and one that compared three operands while naming four |
| [`docs/reviews/phase-2b-2c-1-design.md`](docs/reviews/phase-2b-2c-1-design.md) **§Q6** | The answer 2b-2c-3 was built to, **now built**: `save_raw_document` is a **`SaveRequest` variant for whole text, never a full-span `DocumentEdit`**. A whole text is not a span replacement and does not claim the patch engine's locality invariants |
| [`src-tauri/src/save.rs`](src-tauri/src/save.rs) | **`PresentationNote` is a tagged union as of 2b-2c-2** — `ScalarRestyled` (the old struct's four operands) plus `DoubledSequenceSeparation { edit }`, both struct variants so both cross as one-key objects. The reshape was free because `notes` still has **no reader**; it will not be free again. `SaveResult::Saved` is unchanged otherwise, and `moved: None` is a raw save's permanent answer |
| [`src-tauri/src/commands.rs`](src-tauri/src/commands.rs) | **The eleven commands, and the five that write.** All five end in **one** `run_one_save`, which now takes a **`SaveContent`** rather than a slice of edits — that block is this layer's single cache-coherency policy (commit / conflict-after-the-lock / refusal / failure-with-eviction) and it was four copies before the `35a9e9e` cleanup round. **A sixth writing command calls it; it does not copy it.** The four edit-shaped commands check the projection's revision **before** resolving anything positional and resolve through `MatchId` only; `save_raw_document` deliberately does not, and §2.2 of the 3b notes is why. `after_a_save` centralizes D2, and its return type is what stops a post-commit refresh failure becoming an `Err`. **A raw save has no match to re-mint, so its `moved` is structurally `None`** |
| [`docs/decisions/2b-2c-2-notes.md`](docs/decisions/2b-2c-2-notes.md) | Eight decisions with their reasons, the refusal taxonomy, and eight holes. **§6.2 is the one to read before touching a move**: a move leaves the identical doubled blank line at its origin and says nothing about it, and closing that would change an already-shipped command's documented behaviour. §6.8 is the projection count `End` is derived from |
| [`docs/reviews/phase-2b-2c-2-code.md`](docs/reviews/phase-2b-2c-2-code.md) | The review that returned **NOT READY** and was obeyed. Its Medium is the precedent worth keeping: *"a backend test cannot make the UI not surprised"* — pinning a silent outcome in a test is not the same as disclosing it to the user, and plan §6.2 asks for the second |
| [`crates/espansoconfig-core/src/patch/edit.rs`](crates/espansoconfig-core/src/patch/edit.rs) | **`DocumentEdit` has six variants**, and `InsertItem`/`RemoveItem` now have callers. `insert_item()` takes **`at: ItemPlacement { Front, After(usize), End }`**, not the old `Option<usize>`; an implicit-null `matches:` accepts `Front` and `End` and **refuses every `After(_)`**. `plan_item_removal` detects the doubled blank separation itself — **`lift_item()` is untouched**, which is what keeps a move silent. `RemoveItem` addresses **the item**, not `(sequence, index)`. `editable_sequence_item()`, `lift_item()` and `leading_comment_block_start()` are shared by the move and the removal — **change one and both change**, which is the point. `InsertItem` has **no "before the first item" form**; append and move, or derive the front the way `plan_move` does |
| [`crates/espansoconfig-core/tests/patch_item.rs`](crates/espansoconfig-core/tests/patch_item.rs) | The phase's acceptance evidence, and the model for any later sequence-item test. `lift_site_of_a_move()` applies a real `ItemMove`, discards its landing, splices the departures and compares the **bytes** against `RemoveItem`'s output — the architectural claim, pinned rather than asserted. The removal table crosses first/middle/last with blank-line and comment shapes, in LF **and** CRLF; it is the CRLF twin that found the latent ownership defect |
| [`docs/reviews/phase-2b-2c-1-design.md`](docs/reviews/phase-2b-2c-1-design.md) | The design consult taken **before** the primitives were written. Seven rulings with a disposition table; Q6 is `save_raw_document`'s answer, **recorded and deliberately not built** — a `SaveRequest` variant, never a full-span `DocumentEdit`. 2b-2c-3 starts there |
| [`docs/decisions/2b-2c-1-notes.md`](docs/decisions/2b-2c-1-notes.md) | Eight decisions with their reasons, the refusal taxonomy as a table, **§5 the latent CRLF ownership defect this phase found and fixed**, and **§6's nine holes** — of which 5 (a removal leaves both blank lines) and 6 (no insert-before-first) are the two 2b-2c-2 will feel first |
| [`src-tauri/src/commands.rs`](src-tauri/src/commands.rs) | **The eight commands, and the two that write.** `save_one_match` is the model 2b-2c's three new commands should follow: resolve the projection with **no lock held**, refuse a `base_revision` that is not that projection's, derive the batch (or refuse by name into the `Err` channel), and hand it to `save_document` **even when it is empty**. `after_a_save` takes `at: Option<&DocumentPath>` because its two callers compute the post-save address differently — a move by sequence-path-plus-landing-index, a save by the match's own unchanged path. **Neither command may call `replace_file_atomically` or `replace_locked_file`: the lock is not reentrant** |
| [`src-tauri/src/error.rs`](src-tauri/src/error.rs) | `CommandError`, now nine codes. **`DraftRefused` is the pattern for a planning-time refusal** — it carries the core's own refusal *whole* rather than flattening its taxonomy into a second copy here, and `every_command_error()` samples the one variant that addresses something below the match mapping so the enumeration exercises the **privacy** rule and not just the shape |
| [`src-tauri/src/wire_contract.rs`](src-tauri/src/wire_contract.rs) | **`every_draft_error_variant_crosses_as_an_object` is the check 2b-2c must copy for any new error enum on this boundary.** The operand-shape table pins **one** shape per operand from **one** sample, so a single unit variant among struct ones silently demotes a typed refusal to *unexpected failure*. It derives its variant list by parsing the enum's source, not from a sample |
| [`docs/decisions/2b-2b-3-notes.md`](docs/decisions/2b-2b-3-notes.md) | Phase 2b-2b-3's decision record: what was built (§1), **the three design rulings with the argument against each stated rather than only the argument for (§2)**, D4 — why the batch guards are *not* re-run at the command layer (§3), **D5 — every wire-enum error operand must serialize as an object, and why no test caught that it did not (§4)**, D6 — one exemption table read from both directions, and where the floor now stands (§5), the holes (§6), and **the window reading in full, with its judgement string by string and its "not evidence of" section (§7)** |
| [`docs/reviews/phase-2b-2b-3-design.md`](docs/reviews/phase-2b-2b-3-design.md) | The design consult taken **before** `save_match` was written. Three rulings, all adopted: the `Err`-channel refusal, path-based identity re-minting, and the empty batch that still runs the transaction. Each is the answer 2b-2c's three commands inherit |
| [`docs/reviews/phase-2b-2b-3-code.md`](docs/reviews/phase-2b-2b-3-code.md) | The aggregate code review. **No finding at any severity** — and the file's own header says why that is weaker evidence than it looks: the phase's one real defect was found *before* the review, by the orchestrator, and the review looked at the repaired tree |
| [`crates/espansoconfig-core/src/draft/plan.rs`](crates/espansoconfig-core/src/draft/plan.rs) | **`plan_match_edits` — the whole minimal-diff rule, and `plan_scalar()` is three lines of it.** The guard order is the design: `!scalar.decoded` refuses **before** any comparison (its `text` is a raw source slice, not a logical value), then `scalar.text == value` returns `Ok(None)` — the interesting answer, meaning the file keeps its own spelling and no byte is touched. **Comparing what the codec would emit against the existing source text is never the right test**, however tempting: a codec may canonically emit `"hello"` where the file validly holds `'hello'`, and rewriting that is precisely the preservation bug. Step 4 is `check_no_index_is_drafted_twice`, and it runs **before** diffing because a no-op intent is erased before any batch exists (F1) |
| [`crates/espansoconfig-core/src/draft/audit.rs`](crates/espansoconfig-core/src/draft/audit.rs) | The two guards over a **derived batch**: `check_closed_surface` (a batch may modify or remove existing addressable nodes and insert scalar-valued mapping entries; it may **never** change a sequence's cardinality or synthesize a collection) and `check_batch_independence` (the six batch hazards — anchoring on a key the batch removes or inserts, overlapping removal-and-edit, a scalar edited twice, an ambiguous decoded key, two insertions sharing one anchor). **Read the module doc before trusting them for anything**: they inspect *paths*, not nodes or original cardinality, and they share the planner's `from_key` vocabulary, so they are not independent validation of intent — a review finding, and the doc now says the three things they do not establish |
| [`crates/espansoconfig-core/tests/draft_plan.rs`](crates/espansoconfig-core/tests/draft_plan.rs) | 54 tests, and **two of them are the phase**. `every_field_set_to_its_own_projected_value_derives_an_empty_batch_and_moves_no_byte` asserts its own **non-vacuity first** — all five scalar styles present among the eighteen fields, and no two fields decoding to the same string, so a planner reading one field's value while writing another's path is still caught. `every_match_of_the_real_configuration_drafts_to_an_empty_batch_or_a_named_refusal` runs the same property over **65 real matches and 303 intents** and skips cleanly when the corpus is absent; the synthetic twin never skips. `a_null_draft_field_is_a_deserialization_error_and_never_a_removal` is the one that keeps `DraftField` from being replaced by `Option<Option<T>>` |
| [`docs/decisions/2b-2b-2-notes.md`](docs/decisions/2b-2b-2-notes.md) | Phase 2b-2b-2's decision record: what the surface now is (§2), **D1 — this phase inserts nothing below the match mapping, as a decision with its reason rather than a limitation found late (§3)**, **D2 — an address is an index and never a key the owner wrote, and why that is a privacy rule and not a style choice (§4)**, the equality rule inherited verbatim and still one line (§5), the refusal taxonomy as a table (§6), **the two batch guards, including the invariant prefix containment rests on (§7)**, the headline property over both corpora (§8), the one `src-tauri/` change (§9), **the holes (§10)** — hole 1 is the YAML-type gap addressed to `ScalarView`, hole 2 is that the real config has **zero** `form_fields` and always might — what 2b-2b-3 and 2b-2c inherit (§11), verification (§12) and the design consult (§13) |
| [`docs/reviews/phase-2b-2b-2-open-key-design.md`](docs/reviews/phase-2b-2b-2-open-key-design.md) | The Codex **design** consult for 2b-2b-2, run before implementation. Six rulings; F1 is the one that could have produced a wrong-node edit — grouping derived edits per mapping does not replace a full-mapping duplicate scan. **It reviewed the design, not the code**; the aggregate code review is still owed and is the next session's first item |
| [`docs/decisions/2b-2b-1-notes.md`](docs/decisions/2b-2b-1-notes.md) | Phase 2b-2b-1's decision record: the tri-state and the failure mode it avoids (§2), **the equality rule and why the tempting wrong test is wrong (§3)**, the boundary stated three times (§4), **the narrowing of ruling 4 recorded as a decision rather than an oversight (§4.1)**, the refusal taxonomy as a table (§5), **where an insertion goes and why two of them refuse — one a policy choice, one an existing engine limit the draft merely gives a better name (§6)**, what the phase deliberately does not do (§7), **nine holes stated as holes (§8)** — hole 9 is addressed to `model/match_view.rs` by name — the one `src-tauri/` change (§9), verification **including the four guards disabled on purpose (§10)**, and what 2b-2b-2 and 2b-2b-3 inherit (§11) |
| [`docs/reviews/phase-2b-2b-draft-design.md`](docs/reviews/phase-2b-2b-draft-design.md) | The **design consult taken before a line was written**, and its six rulings are what 2b-2b-1 was built to. Ruling 1 kills `Option<Option<T>>` by naming its catastrophic failure (a frontend collapsing `undefined` into `null` becomes a *removal*); ruling 2 is the equality rule; ruling 3 is the closed-surface invariant; ruling 4 is the asymmetry (collection→scalar may be expressible, scalar→collection is not) **which 2b-2b-1 then narrowed on purpose**; ruling 5 is the six batch hazards; ruling 6 named the likeliest silent failure and the cheapest test for it, which is now the headline test |
| [`docs/reviews/phase-2b-2b-1-draft-engine.md`](docs/reviews/phase-2b-2b-1-draft-engine.md) | The Phase 2b-2b-1 review, dispositioned above. **Its most useful finding is F1 and the reason is general**: a batch-level guard cannot catch an intent that was erased as a no-op *before* the batch existed. Any future guard written over a derived artefact inherits that blind spot. **F2 and F3 are the two whose fix was narrowed or refused** — re-read those before widening the draft surface |
| [`crates/espansoconfig-core/src/wire.rs`](crates/espansoconfig-core/src/wire.rs) | **The single spelling of three wire rules, and 2b-2 must reuse it rather than re-derive it.** `WirePathRef` writes every path as a **lossy** String — because `serde`'s own `PathBuf` serializer *fails* on a non-UTF-8 path, and that failure arrives **after** a command has already answered `Ok`, so the typed refusal meant to carry the news is the value that cannot be written. The consequence is load-bearing: **a wire path is display text and can never be an identifier** — two distinct non-UTF-8 filenames can render identically and the string cannot be copied back to name the file. `io_kind_name` and `io_raw_os_error` are the other two: an `io::Error` crosses as its `ErrorKind` **variant name** plus a **nullable numeric errno**, never as the operating system's own message in the operating system's own language (plan §9). `src-tauri/src/error.rs`'s private copy **delegates** to `io_kind_name` rather than duplicating it |
| [`src-tauri/src/dictionary_contract.rs`](src-tauri/src/dictionary_contract.rs) | **The check that makes 2b-1's derives safe rather than a liability, and the one 2b-2 will trip first.** It parses the Rust source for every registered enum's variants and fails the build if any lacks a `code.<enum>.<variant>` entry in `en.json` **or** in `es.json`. A new variant, or a whole new enum, is a `cargo test` failure — which is the prompt to write the two strings. **A pre-existing parser defect was repaired here**: `tagged_variant_fields` walked past a type-reference payload (`readonly Parse: ParseFailure`) into the *next* variant's braces, silently skipping variants; it now returns `None` for those, and the shape counts (94 struct / 11 newtype / 52 unit) are asserted so a struct variant declared as a reference is a failure rather than a skip. **The one construct that still escapes is an enum a `macro_rules!` expands to** — unchanged since 1b-2b |
| [`docs/decisions/2b-1-notes.md`](docs/decisions/2b-1-notes.md) | Phase 2b-1's decision record: **why the core's wire convention and not `CommandError`'s flat one (§1.1)**, why nested errors stay whole (§1.2), **the five hand-written `Serialize` impls and the two properties a derive cannot buy (§1.3)**, **`io::Error` as `kind` + `raw_os_error`, and why adding the errno *now* was the last free moment (§1.4)**, **Serialize-without-Deserialize and what the review changed about it (§1.5)**, the enum-by-enum inventory (§2), **how the dictionary contract fails, with the deletion experiment as evidence (§3)**, what 2b-2 inherits (§4), the **seven holes stated as holes (§5)**, verification (§6) and the **two-review disposition (§7)** — §7.2 is where the four pre-existing diagnostic strings were fixed rather than deferred, and why |
| [`docs/reviews/phase-2b-1-wire-boundary.md`](docs/reviews/phase-2b-1-wire-boundary.md) | Review A, dispositioned above. **Read it before designing 2b-2's acknowledgement.** It rules on all three ways an acknowledgement could round-trip and rejects two of them by name — index-based selection (unstable if findings reorder between calls) and handing back the exact JSON bytes (JSON permits insignificant byte differences, key order is not semantic, and Tauri parses before Rust sees it) — and it requires **exact multiset** comparison, not set membership, so `[A, A]` differs from `[A]` |
| [`docs/reviews/phase-2b-1-strings.md`](docs/reviews/phase-2b-1-strings.md) | Review B, dispositioned above. **The register rule with worked examples**: three strings predicted espanso's behaviour or pronounced a file absolutely (in)valid, in both languages, and the file gives the corrected sentence for each. Re-read before writing any user-facing string in 2b-2 — this is the sixth phase running in which a claim outran what the code had earned |
| [`crates/espansoconfig-core/src/persist/write.rs`](crates/espansoconfig-core/src/persist/write.rs) | **The only code in the crate that opens a file for writing, and the thing 2a-2 wraps.** `replace_file_atomically(path, expected, bytes)` takes **finished bytes**; `lock_path()` + `replace_locked_file()` exist so the transaction can hold the lock across steps 2–11 — calling `replace_file_atomically()` while holding the lock **deadlocks**. `recheck_target()` runs three lines above the rename and is what narrows D4's race to one rename. `inspect_target()` does one `open` + `fstat` + `read` on one descriptor with **`O_NOFOLLOW \| O_NONBLOCK`**, so mode bits, bytes and `(dev, ino)` come from one inode — and a fifo planted at the resolved path is an open that *returns*, refused as `TargetNotRegularFile`, rather than a wait for a writer with the lock held (2a-2b review finding 8). It is `pub(super)` and is **the only read of a save target in the crate**; a second, unchecked read is exactly how that finding happened. `WriteError` / `WriteStep` / `TargetDifference` **now cross the wire** (2b-1); `WriteError` and `TargetDifference` have **hand-written** impls so every path goes through `WirePathRef` and a new variant is a compile error, and `WriteError::Io` writes `{ step, path, kind, raw_os_error }` — never the operating system's own prose. **2a-3a added steps 7a and 7b and reordered the block:** the temp file is created 0o600, written, flushed and fsynced **while still 0o600**, and only then does `copy_metadata()` carry the target's **ACL and extended attributes** across with `fcopyfile(COPYFILE_ACL \| COPYFILE_XATTR)` — `COPYFILE_STAT` is excluded, measured to restore a stale mtime and to copy `uchg` — after which `handle.set_permissions()` (**`fchmod`, not a path**) applies the mode, a second `sync_all()` persists all three, and `verify_temp_identity()` proves the temp *name* still `lstat`s to the inode the descriptor holds. A metadata-copy failure and a temp-name replacement both **refuse before the rename**; the target keeps its bytes and its protection, but **a temp file may be left behind** — the guard swallows `remove_file` errors and a copied `deny delete` ACL can defeat it. The rename is still by pathname, so **a directory writable by an untrusted principal is an explicit precondition**, not a solved problem |
| [`crates/espansoconfig-core/src/persist/save.rs`](crates/espansoconfig-core/src/persist/save.rs) | **The save transaction, and the only entry point that should ever write a user's file.** `save_document(SaveRequest) -> Result<SavedDocument, SaveError>` is plan §6.6 steps 1–12 under **one** lock: read and hash **inside** the lock, `apply_edits` (whose own `verify` **is** step 4 — not reimplemented), project and validate the **candidate**, apply the policy, commit via `replace_locked_file`. `verdict(&[Finding], &Acknowledgement) -> SaveVerdict` is **the blocking policy**, pure: an `EditorModelError` refuses with **no override**, a `SuspiciousButPermitted` refuses until acknowledged **by content and as a multiset** — never a boolean — and the findings come back on the success path too. A candidate byte-identical to the target is **not rewritten** (`committed: false`), because every rename drops eight metadata classes for nothing; that path re-reads under the lock and answers `RevisionMismatch` rather than returning facts it has not established. `SaveError` has **8** variants and `is_refusal()` / `may_have_written()` / `findings()` / `syntax_gate_failure()` are the four questions a caller asks of one. **`SaveError`, `SaveVerdict`, `SaveRefusal` and `Acknowledgement` now cross the wire (2b-1)**, `SaveError` by a hand-written impl; nested errors stay **whole** rather than flattened, because `WriteError::may_have_written` is computed from the `WriteStep` and a flattened copy would drop it. **`SavedDocument` is still not serialized** — what a successful save carries out is 2b-2's design. **Nothing here derives `Deserialize`**, which is what 2b-2 must add before an acknowledgement can arrive |
| [`crates/espansoconfig-core/src/persist/backup.rs`](crates/espansoconfig-core/src/persist/backup.rs) | **Plan §6.6 step 13, and the only code in the crate that deletes anything but its own temp file.** `BackupSession` is **caller-owned** and threaded through `SaveRequest::backups: Option<&BackupSession>` — a process global and a second reader of the workspace cache were both rejected, and **`None` means no backup at all**. `capture()` mints the batch, writes one copy, then rotates; **a batch is a session**, which is what makes rotation unable to remove a copy the running session took. `BackupSession::root()` is **the path 2c reveals in Finder, and it may not exist**. Five checks guard `rotate`, and each is a check rather than an intention: a strict `YYYY-MM-DDTHHMMSSZ[-n]` name grammar, the **`.espansoconfig-batch` ownership marker** (a name is a shape, not a claim of ownership), `symlink_metadata` so no link is followed, the current batch excluded by **`(device, inode)`** rather than by name order, and a root whose own name must be `.espansoconfig-backups`. Rotation is **counted, never returned**; a **backup that cannot be written fails the save before the commit**. The copy carries the target's bytes (from memory), mode bits and `COPYFILE_XATTR` but **deliberately not the ACL** — a copied `deny delete` makes a backup unrotatable. `publish_backup` **disambiguates rather than refusing** when a name is occupied by a copy this session abandoned, so no file becomes permanently unsaveable; `DestinationExists` survives only for two targets resolving to one path. **`BackupError`, `BackupStep`, `BackupRecord`, `Rotation` and `RotationOutcome` now cross the wire (2b-1)**, `BackupError` and `BackupRecord` by hand-written impls; `Rotation::bounded()` is a **predicate**, not a field, so it does **not** cross — a frontend that wants the answer must get it from a command's own result shape rather than reimplementing it |
| [`docs/decisions/2a-3b-notes.md`](docs/decisions/2a-3b-notes.md) | Phase 2a-3b's decision record: what was built (§1), **the location, and what a target outside the configuration root does (§2 — `_outside`, and why the placement beside `match/` is the defence while the leading dot is only belt-and-braces)**, **where the session state lives, with the two rejected shapes (§3)**, **rotation, the one destructive operation, and its safety properties (§4)**, **what the copy carries and the ACL it deliberately does not (§5)**, **the tension between "first modification per session" and "retain ten batches", removed structurally rather than documented (§6)**, **why a backup that cannot be written fails the save (§7)** with the disabling experiments E25–E39c, what is proven versus assumed (§8), the **holes stated as holes (§9)**, verification (§10), what 2b and 2c inherit (§11) and the **eleven-finding review disposition (§12)** |
| [`docs/reviews/2a-3b-codex.md`](docs/reviews/2a-3b-codex.md) | The Phase 2a-3b review, dispositioned above. **Verdict: `not safe to commit as-is`** — one critical, four high, five medium, one low. **Read findings 1, 2, 3 and 10 before touching `rotate`**: they are four separate routes to deleting a directory the application did not create, and the fixes for them are why the function looks the way it does. Finding 4 is accepted and *not* fully implemented — the prepare/commit split of the locked writer is out of 2a's scope |
| [`docs/reviews/2a-3b-codex-confirmation.md`](docs/reviews/2a-3b-codex-confirmation.md) | The narrowed confirmation pass over the fix round. Three questions about named line ranges; two confirmed closed, one residue found (`discard` leaving a copy it could not remove, making later retries refuse forever) and then fixed. **The shape of this file is the lesson**: the first attempt was pointed at ~5,600 lines and stalled |
| [`docs/decisions/2a-3a-notes.md`](docs/decisions/2a-3a-notes.md) | Phase 2a-3a's decision record: what was built (§1), **the dependency decision — `libc`, macOS-gated in a target section, with `nix` / `xattr` / `rustix` argued down (§2)**, **the flag set: `fcopyfile` over the descriptor form, and the four reasons `COPYFILE_STAT` is out (§3)**, **the failure policy — a metadata copy that fails refuses the write, with the four-point argument against proceed-and-report (§4)**, **plan §7 row 11's four in one table, with ownership stated honestly (§5)**, the **twelve macOS measurements (§6)**, the disabling experiments (§7), the **fifteen holes stated as holes (§8)**, verification (§9), what 2a-3b and 2b inherit (§10) and the **fourteen-finding review disposition (§11)** |
| [`docs/reviews/2a-3a-codex.md`](docs/reviews/2a-3a-codex.md) | The Phase 2a-3a review, dispositioned above. **Two blocking findings, both closed in code**: a temp file chmod-ed by pathname while the trusted inode was already open, and a "nothing was written" claim that was true of the target but not of the temp inode. **Read finding 5 before touching the step order** — it is why the bytes go down before the mode goes up. Findings 7 and 11 are accepted and *not* implemented, and are holes 6 and 13 |
| [`docs/decisions/2a-2b-notes.md`](docs/decisions/2a-2b-notes.md) | Phase 2a-2b's decision record: what was built and the read-only refusal that was not in the brief (§1), **the blocking policy with the six alternatives it rejected (§2)**, **why step 4 is not reimplemented, established by reading `verify()` rather than assumed, with what it does *not* cover (§3)**, the **eighteen disabling experiments — including E7, which fired nothing and is the reason a test exists that did not before, and E12, which hangs forever (§4)**, the verification with the real-corpus counts and **the measured cost of step 5's second parse, where the trivia scan is the super-linear term (§5)**, what was deliberately not done (§6), the **sixteen holes stated as holes (§7)**, what 2a-3 and 2b inherit (§8) and the **eight-finding review disposition (§9)** |
| [`docs/reviews/phase-2a-2b-save-transaction.md`](docs/reviews/phase-2a-2b-save-transaction.md) | The Phase 2a-2b review, dispositioned above. **Its blocking finding — hazard 11's metadata loss — was paid by 2a-3a**; the one that mattered most is finding 8, a concrete deadlock from a second unchecked read. **Two findings were overclaims in the decision record itself** — a property the notes said "cannot be written" that can, and a risk said to bite "today" with no experiment supporting it. Re-read before writing a sentence about what this application guarantees |
| [`docs/decisions/2a-1-notes.md`](docs/decisions/2a-1-notes.md) | Phase 2a-1's decision record: what the primitive actually promises and the residual race (§2), why the new variant is not a reused one (§2.3), resolving the target before locking (§3), **mode bits and the eight metadata classes a rename drops (§4)**, the two independent reasons espanso cannot load the temp file (§5), **the fsync question settled from the toolchain source (§6)**, steps-not-sentences in the error type (§7), the disabling experiments (§9), **the coverage holes stated as holes including the two nothing can test (§10)**, the finding-by-finding **review disposition (§11)** and what 2a-2 inherits (§12) |
| [`docs/reviews/phase-2a-1-atomic-write.md`](docs/reviews/phase-2a-1-atomic-write.md) | The Phase 2a-1 review, dispositioned above. **Read the test audit before writing a test in 2a-2.** Four of the ten stated guarantees were pinned by tests that would have passed against a weaker implementation — a byte-exact sweep seeded with the bytes it wrote back, a concurrency test that passes with no mutex, a `chflags` test that could skip and pass, and two counts that said "three" above five-element lists. **The critical finding is the one to carry forward**: the code promised a compare-and-swap that no POSIX operation can perform |
| [`crates/espansoconfig-core/src/validate/mod.rs`](crates/espansoconfig-core/src/validate/mod.rs) | **The whole semantic gate (step 5), and 2a-2b calls it rather than rebuilding it.** `validate(&DocumentView) -> Vec<Finding>` — pure, no I/O, safe inside the lock. Ten `FindingCode`s over **two** `FindingClass`es (`EditorModelError`, `SuspiciousButPermitted`); the other two of plan §6.6's four classes belong to step 4 and to the 0b hazard gate and are deliberately absent. `FindingCode::class()` is the **only** place classification happens, and the boundary is one question: *does the claim rest on a vocabulary espanso can extend without telling us?* **`Finding`, `FindingCode` and `FindingClass` now cross the wire (2b-1)**, and `FindingCode::VariableMissingRequiredParam::param` is an owned **`String`** rather than the `&'static str` it was — changed on review A's ruling, because it was the one type-level obstruction to ever deriving `Deserialize`, which 2b-2 needs for the acknowledgement's inbound direction. `required_param()` is a table whose every row is an observed failure path in espanso `v2.3.0`'s own source — **not its documentation**, which calls `date`'s `format` required when the source does not, and would have fired on working configs |
| [`docs/decisions/2a-2a-notes.md`](docs/decisions/2a-2a-notes.md) | Phase 2a-2a's decision record: a report and not a gate, with the boundary drawn (§2), which of plan §6.6's four classes this module emits and why the other two have owners elsewhere (§3), **the required-parameter table's provenance, source over documentation (§4)**, `regex` as a production dependency and **exactly what a compile does and does not prove — espanso 2.3.0 pins 1.5.5 and compiles verbatim, so the inference runs one way only (§5)**, rule 5's closure analysis after the openers were removed (§6), the **22 disabling experiments including E20, which found a guard that matched its own text (§7)**, the verification with the real-corpus counts (§8), the **holes stated as holes (§10)** — hole 13 is espanso's tenth variable type and is **2b's** — what 2a-2b inherits (§11) and the **nine-finding review disposition (§12)** |
| [`docs/reviews/phase-2a-2a-semantic-gate.md`](docs/reviews/phase-2a-2a-semantic-gate.md) | The Phase 2a-2a review, dispositioned above. **The four blocking findings are all false negatives, and all one shape**: the phase could not establish what espanso does, so it stayed silent — and silence is a claim. **The four should-fix findings are the project's signature defect for the fifth phase running** — a name or doc comment asserting more than its body can check, including a real-corpus test that could skip and pass while printing the findings it declined to assert on. Re-read before writing a rule or a test name in 2a-2b |
| [`src/lib/browser/rawDocument.ts`](src/lib/browser/rawDocument.ts) | **What the raw YAML viewer shows, and where it lives.** `rawTarget(selection, documents, selected)` — **the sidebar first, the selection second**, which is what keeps a file that does not *parse* reachable — and `documentTextState(answer)`, whose **four** arms are `loading`, `text`, `empty` and `refused`. The module header carries the placement argument (why the third pane, not the second, not a fourth) and its cost: the pane now has two subjects |
| [`docs/decisions/1c-2b-2b-2-notes.md`](docs/decisions/1c-2b-2b-2-notes.md) | Phase 1c-2b-2b-2's decision record: the placement decision with its four constraints (§2), the four arms and why a refusal is not an empty file (§3), the strings with **the cases each one sits above** (§4), **the fidelity table's five open rows now closed by a window reading (§5)**, the readings themselves and what the instrument cost (§6, §6.1), the **twenty** experiments **including the three that did not fire and the two that changed the code** (§7, §7.1), **Phase 1's exit verdict with its evidence and its three named gaps (§8)**, what a large document costs, measured (§8.1), the **fourteen** holes (§9) — hole 14 is addressed to Phase 2 by name — R31's blind spots (§10.1) and **the review disposition (§12)** |
| [`src/lib/browser/sourceText.ts`](src/lib/browser/sourceText.ts) | **The one place file text becomes something a screen can draw**, and 1c-2b-2b-2 uses it unchanged. `sourceSegments(text, atDocumentStart)` returns `text` / `break` (carrying `lf` or `crlf`) / `invisible` (carrying a **code** and the character itself); `sourceCharacters()` rebuilds the input and **is the module's oracle**. `atDocumentStart` is the *only* way a `bom` segment is produced — a slice must never pass it. The classifier names the C0/C1 controls, NUL, U+2028/9, a lone CR, the soft hyphen, the zero-width set and the bidi controls, and deliberately does **not** name joiners, variation selectors, tag characters or combining marks, because those modify a neighbour rather than draw nothing |
| [`src/lib/components/SourceText.svelte`](src/lib/components/SourceText.svelte) | **The only component that draws file text.** A break is a `<br>` (never a newline in a text node), an invisible character is a bordered marker in the *interface's* face, everything else is a text node inside a `white-space: pre` container that scrolls sideways — a soft wrap is indistinguishable from a line break the file does not have. **The markup is one line on purpose**: whitespace written for legibility would be whitespace the file does not have, and a test asserts the exact opening sequence. **No `{@html}`, ever** |
| [`docs/decisions/1c-2b-2b-1-notes.md`](docs/decisions/1c-2b-2b-1-notes.md) | Phase 1c-2b-2b-1's decision record: the primitive instead of a `<pre>` (§2), **the scope sentence written from a committed measurement rather than the field's name (§3)**, the two halves that had to travel together (§4), **the fidelity table's rendering column with its "detail pane / whole document" split — five rows still open and each says why (§5)**, the window readings and what WKWebView evidence they do and do not give (§6, §5.1), the disabling experiments, **R31's blind spots by name (§8.1)**, the coverage holes as holes (§9) and what -2 inherits (§10) |
| [`docs/reviews/phase-1c-2b-2b-1-source-text.md`](docs/reviews/phase-1c-2b-2b-1-source-text.md) | The Phase 1c-2b-2b-1 review, dispositioned above. **Three of its four findings are one shape: a sentence attached to the wrong scope** — a caption over three branches true of one, a description of syntax only some shapes have, a headline wider than the classifier beneath it. The fourth was a note never measured, and **measuring it inverted the claim**. Re-read before writing any string that will sit above more than one case |
| [`src/lib/ipc/commands.ts`](src/lib/ipc/commands.ts) | **The seven typed wrappers, and `documentText(id)` is the one with no caller.** Its contract is stated narrowly and must stay that way: **exact preservation of valid UTF-8, typed refusal otherwise** — a non-UTF-8 file answers `{code: "notUtf8", path, offset}` and cannot be displayed at all, which is a branch the raw viewer needs and the dictionary has no string for yet |
| [`src-tauri/src/dispatch_check.rs`](src-tauri/src/dispatch_check.rs) | **Where reachability and wire fidelity are *measured* rather than argued.** Seven commands invoked with `"permissions": []`; the corpus copied into a workspace and answered byte-for-byte through the real dispatcher (33 fixtures, 37 406 bytes); `value_text` fetched through `get_document` and checked against `std::fs::read` sliced by the span that arrived beside it. The remote-origin table is asserted equal **in both directions** to the names in `generate_handler!` — **add a command and this test fails until its row exists.** What it does *not* cover is WKWebView: `mock_builder()` swaps it out |
| [`docs/decisions/1c-2b-2a-notes.md`](docs/decisions/1c-2b-2a-notes.md) | Phase 1c-2b-2a's decision record: why `document_text` is a command and never was one (§2), the uncapped `value_text` decision with its cost rather than a saving it cannot prove (§3), **the `CommandResult<string>` inheritance Phases 2–5 would pay to widen (§3.1)**, **the fidelity table hazard by hazard — the wire column is done, the *rendering* column is 1c-2b-2b's (§4)**, the WKWebView limitation named rather than implied (§4.3), the fifteen disabling experiments including the one that could not be constructed at all (§6, §6.0), the holes stated as holes (§9) and what 1c-2b-2b inherits (§10) |
| [`docs/reviews/phase-1c-2b-2a-raw-text-boundary.md`](docs/reviews/phase-1c-2b-2a-raw-text-boundary.md) | The Phase 1c-2b-2a review, dispositioned above. **Six findings, and every one the same defect**: a doc comment, a test name or a manifest asserting what its body cannot check. Worth re-reading before writing any test name in 1c-2b-2b — four of the six were names |
| [`src/lib/browser/`](src/lib/browser/) | **The data path 1c-2 renders from.** `workspace.svelte.ts` (`createBrowserState` — the four states, the two generation tokens, `installView`, `loadFailures`), `selection.ts` (**R27 in code**: a position to look at and `MatchView.source_text` to check with, never a display projection), `search.ts` (the matching rule; the haystack is the core's), `sidebar.ts` (grouping, `holdsMatches`, the pending count), `labels.ts`, `notices.ts`, `fixtures.ts` (neutral synthetic builders) |
| [`src/lib/browser/findings.ts`](src/lib/browser/findings.ts) | **What the app says about a *file*, and the home for any new judgement.** Unions `DocumentView.hazards` with the kinds named by `Hazard` diagnostics, filters those out of the sentence list, and carries **two identities over one data type**: `diagnosticIdentity` (code only) decides which sentence appears, `occurrenceIdentity` (code + span + node + path) decides how many times it is counted, rendered "in N places". Rendered by `SnippetList.svelte` — **the middle pane, because a file that fails to parse has no matches and so can never be selected into the third one** |
| [`docs/decisions/1c-2b-1-notes.md`](docs/decisions/1c-2b-1-notes.md) | Phase 1c-2b-1's decision record: where a hazard belongs and why the permissive arm draws nothing, the two diagnostic identities, the profile projection and the `kind`-not-`shape` guard, the display-index mapped type, **the strings and R31's blind spots by name (§6.2 holds the string-versus-data sweep that found a second false claim)**, the twenty-five disabling experiments **including the three that did not fire** (§7), what the phase got wrong (§10.1 — the third occurrence of *a written claim ahead of its data*), the two window readings and the `cargo build`/`npm run build` lesson (§7.7), the coverage holes stated as holes (§11) and the two review dispositions (§13, §13.1) |
| [`docs/reviews/phase-1c-2b-1-typed-judgements.md`](docs/reviews/phase-1c-2b-1-typed-judgements.md) | The Phase 1c-2b-1 review, in **two passes**, dispositioned above. Its High 1 is the sub-phase's own failure mode landing inside the sub-phase built to avoid it. Its second pass is the one to remember structurally: **the fix for Medium 2 introduced Medium 8**, and Medium 8 falsified two sentences the notes had already written — a reviewer checking a fix round is not ceremony |
| [`src/lib/browser/detail.ts`](src/lib/browser/detail.ts) | **The pane's model, and where 1c-2b's new logic goes.** `describeMatch()` (the trigger and content sides kept independent, options grouped by intent per plan §8.5), `flattenValue()` (all five `ValueView` arms, `Elided` included — a node the projection stopped at still gets a line), `scalarDisplay()` (D2u: `empty`, `ambiguous` and `style` are the only three things said about a scalar, and none of them is its meaning), `detailFieldKey()` (a template literal typed as `TranslationKey`, so a field with no string is a compile error **here**) |
| [`src/lib/components/DetailPane.svelte`](src/lib/components/DetailPane.svelte) | **Presentation only, deliberately.** Five snippets and one walk over `describeMatch()`'s output. Nothing in this repository renders a Svelte component in a test, so logic placed here is logic nothing can check — the phase caught itself doing it once and moved it out. The `•` for a sequence item is **markup, not a CSS `content:` rule**, so a window reading's `innerText` can see it |
| [`docs/decisions/1c-2a-notes.md`](docs/decisions/1c-2a-notes.md) | Phase 1c-2a's decision record: why the logic is not in the component (§2), absent vs empty and the one place the wire cannot tell them apart (§3), D2u in the pane (§4), the two sides never collapsed (§5), options by intent (§6), variables and forms (§7), **the strings and R31's four blind spots by name (§8)**, **the eighteen experiments including the two that did not fire (§9)**, what the phase got wrong (§10), **R32's readings and what they do and do not establish (§11)**, **the thirteen coverage holes stated as holes (§12)** and what 1c-2b inherits (§13) |
| [`docs/reviews/phase-1c-2a-detail-pane.md`](docs/reviews/phase-1c-2a-detail-pane.md) | The Phase 1c-2a review, dispositioned above. **No High findings.** Its Medium 1 is the one to remember: a sentence claiming an unmodelled entry was "shown as written" beside a rendering that showed only its key — the data to honour that claim **does not exist on the wire**. Its Low 3 is D2w recurring, caught in a test whose own comment claimed the property it did not have |
| [`scripts/lint/built-translation-keys.ts`](scripts/lint/built-translation-keys.ts) | **Why a code cannot reach the screen through a built key.** Refuses any `t(` whose key is not written literally — the rule CLAUDE.md §2 states and that 1c-1 broke twice. It found the second, two-phase-old instance the moment it existed. Note what it does **not** replace: R31 still applies to `hardcoded-strings.ts` |
| [`docs/decisions/1c-1-notes.md`](docs/decisions/1c-1-notes.md) | Phase 1c-1's decision record: the data path (§2), the four states (§3), search and whose rule is whose (§4), badges as D2u seen from the list (§5), **R27 in the selection (§6)**, the strings and where the lint cannot see them (§7), the **twenty-two disabling experiments including the one that did not fire (§8)**, what the phase got wrong (§9), **R32's five window readings and exactly what they do and do not establish (§10)**, **the coverage holes stated as holes (§11)**, what 1c-2 inherits (§12) and **the review disposition (§13)** |
| [`docs/reviews/phase-1c-1-shell-and-data-path.md`](docs/reviews/phase-1c-1-shell-and-data-path.md) | The Phase 1c-1 review, dispositioned above. Its High 1 is the sharpest finding in the project so far: a fingerprint that decided `sameMatch` while being blind to `word`, to variables, to form fields and to every non-primary content field. Its Low 2 is **R24's corollary for the fifth time**, and one of the eight tests it names was the very test the notes had cited as making an experiment unnecessary |
| [`src/lib/i18n/codes.ts`](src/lib/i18n/codes.ts) | **What a 1c component calls, and the one file it should not work around.** Twelve typed key builders and twelve `describe*` functions over the sixteen namespaces; the reactive `t*` wrappers are in [`index.ts`](src/lib/i18n/index.ts). The builders' template-literal return types make a **missing key a compile error here** rather than a blank label at the call site. Build a key by hand and you have opted out of that |
| [`src/lib/i18n/en.json`](src/lib/i18n/en.json) · [`es.json`](src/lib/i18n/es.json) | The two dictionaries — **240 keys each** as of 1c-2b-2b-1 (138 at 1b-2b, 226 at 1c-2b-2a). `en.json` **is the schema**: the key set is derived from it, never declared separately. Identical values across the two files are on the untranslated-value exception list **by name** |
| [`src-tauri/src/dictionary_contract.rs`](src-tauri/src/dictionary_contract.rs) · [`rust_source.rs`](src-tauri/src/rust_source.rs) | **Why a code cannot reach the UI without a string.** `rust_source` parses with `syn` and lexes with `proc-macro2` (dev-dependencies of `src-tauri` **only**); `dictionary_contract` compares the derived variant set against both dictionaries bidirectionally, and two further checks derive the *registry* from source — every `Serialize` enum in both trees, every union in `types.ts` — so a **new enum** is caught without anyone adding a row. What still escapes: an enum a `macro_rules!` expands to, demonstrated in `1b-2b-notes.md` §12.3 experiment 12E |
| [`src-tauri/src/menu.rs`](src-tauri/src/menu.rs) · [`menu_contract.rs`](src-tauri/src/menu_contract.rs) | The localized menu: three submenus, 16 labels, **zero user-facing string literals in the Rust**, pinned by a check that *lexes* the file rather than masking comment lines. `set_menu_labels` takes an **untyped envelope** and validates it itself so a version skew is `invalidMenuLabels` rather than serde's prose; `on_main_thread` waits on a one-shot channel so a build failure is `menuBuildFailed` rather than a silent `{ ok: true }` |
| [`src-tauri/src/wire_contract.rs`](src-tauri/src/wire_contract.rs) | Reads the `.ts` files as text and compares interface properties, union members, error codes and the `generate_handler!` list against what Rust actually writes — bidirectionally, with the six forbidden Phase 2 command names asserted absent from both sets. **Six commands are registered now**, the sixth being `menu::set_menu_labels`; none mutates a file and the test enforces it |
| [`src-tauri/src/error.rs`](src-tauri/src/error.rs) | The wire error: **twelve** flat codes with structured operands (`invalidMenuLabels`, `menuBuildFailed` and `menuUnavailable` joined the original nine), a hand-written `Serialize` giving each code **one** spelling, exhaustive `From` impls over the core's three error enums, and **no `Display` impl at all** so there is no developer rendering to leak onto the wire |
| [`src/lib/ipc/`](src/lib/ipc/) | The frontend boundary: `types.ts` (the hand-written wire mirror), `errors.ts` (`isCommandError`'s operand validation, `classifyFailure`, `identityRecovery` and its three answers, `developerDetail`, `reportIpcFailure`), `commands.ts` (the typed `invoke` wrapper returning `CommandResult<T>` rather than throwing), `menu.ts`. **The developer string is no longer a property of `IpcFailure`** — non-enumerable and symbol-keyed, so no spread, serialization, enumeration or index reaches it; `JSON.stringify` of a failure is pinned at `{"kind":"unexpected"}` |
| [`crates/espansoconfig-core/src/wire.rs`](crates/espansoconfig-core/src/wire.rs) | `WirePath` — why a non-UTF-8 filename can no longer turn a typed failure into serde's untyped English *after* the command already returned `Ok` |
| [`src-tauri/src/dispatch_check.rs`](src-tauri/src/dispatch_check.rs) | Why `"permissions": []` is evidence rather than argument: all **six** commands driven through the real Tauri dispatcher with the **shipped** config and capability file, plus `a_remote_origin_is_refused` pinning the other side. 1b-2b added the three menu paths, `the_main_thread_step_reports_what_the_work_answered` among them |
| [`docs/decisions/1b-2b-notes.md`](docs/decisions/1b-2b-notes.md) | Phase 1b-2b's decision record: the key scheme and the sixteen namespaces (§1), the dictionaries and the five new exceptions (§2), the typed accessor (§3), **the exhaustiveness check and what it cannot see (§4)**, the developer-string guard (§5), the experiments (§6), what the phase got wrong (§7), **the eleven coverage holes stated as holes (§9)**, **what 1c inherits (§10)**, the menu in full (§11, with R32's evidence in §11.5 and the capability argument in §11.3) and **the review disposition (§12)** |
| [`docs/reviews/phase-1b-2b-dictionaries-and-menu.md`](docs/reviews/phase-1b-2b-dictionaries-and-menu.md) | The Phase 1b-2b review, dispositioned above. Its two High findings were both real: six wire-visible enums deferred to 1c with no strings at all, and an "exhaustiveness" check that failed open on two valid Rust syntaxes and on any new enum. Its finding 4 is the sharpest — the `detail` guard was a name scanner, and `JSON.stringify` names no identifier |
| [`docs/decisions/1b-2a-notes.md`](docs/decisions/1b-2a-notes.md) | Phase 1b-2a's decision record: what crosses and what does not (§1), the synchronous-command/mutex trade (§2), the error representation (§3), **R27 corrected** (§4), the capability argument then its execution (§5), the hand-written mirror and the check that guards it (§6), **why the lint proves nothing here** (§7), what the phase got wrong on the way (§8), **the four remaining coverage holes with owners named** (§9), the thirteen disabling experiments and which six are reproducible (§11), what 1b-2b inherits (§12), the JSDoc exemption decided rather than left open (§14), the review disposition (§15) and the numeric-field audit (§16) |
| [`docs/reviews/phase-1b-2a-ipc-surface.md`](docs/reviews/phase-1b-2a-ipc-surface.md) | The Phase 1b-2a review, dispositioned above. Its two High findings were both real: a **false identity claim** repeated in three files and in this checkpoint, and a serialization failure that could deliver prose to the webview. Its finding 5 is the sharpest — a scope-creep oracle that could not detect the scope creep it was named for |
| [`src-tauri/src/commands.rs`](src-tauri/src/commands.rs) | The six read-only document commands **and, since 2b-2a, `move_match`** — over a `WorkspaceSession` holding `Open { workspace, backups }` behind a std `Mutex`, **synchronous** so no guard can cross an `.await`. Registered in [`src-tauri/src/main.rs`](src-tauri/src/main.rs)'s `generate_handler!` alongside `menu::set_menu_labels`. The mutex is held across the **whole** save, on the main thread — 2b-2a hole 5. `conflict_after_the_lock` is the one place a conflict payload is built |
| [`src-tauri/src/save.rs`](src-tauri/src/save.rs) | **`SaveResult` — the operation-neutral wire result**, `Saved` / `Conflict` / `Refused`, all three in the `Ok` channel because a conflict and a refusal are outcomes rather than errors. **Flat**, like `CommandError`; what it carries keeps the core's own convention. Document-level on purpose: the plan's `Saved { revision, match_id }` is match-shaped, and `save_raw_document` will have no match while `move_match` has no draft |
| [`src/lib/i18n/dictionaries.ts`](src/lib/i18n/dictionaries.ts) | **The i18n enforcement point.** `TranslationKey = keyof typeof en`, and `const spanish: ExactDictionary<typeof es> = es` is the binding that makes a missing *or* surplus Spanish key a compile error. `translate()` interpolates `{placeholder}` and leaves an unknown one verbatim on purpose |
| [`docs/decisions/1b-1-notes.md`](docs/decisions/1b-1-notes.md) | Phase 1b-1's decision record: the pinned versions and why each is exact (§1), what the typed key union enforces and the four disabling experiments that verify both directions (§2), what the types cannot see (§2 end), the runtime checks and the **exception list by key** (§3), locale detection and the override policy (§4), the architecture rule's new check (§5), what the Tauri shell deliberately does not contain (§6), **what the hardcoded-string check cannot see (§7)**, the strings deliberately left untranslated (§8), **the eight coverage holes stated as holes (§9)**, and what 1b-2 inherits (§10) |
| [`scripts/lint/hardcoded-strings.ts`](scripts/lint/hardcoded-strings.ts) | The markup scan behind R31. Read §7 of the notes before trusting a clean run: it sees `.svelte` markup and **not** `<script>` bodies, `{'literal'}`, `.ts` constants or props. Its blind spots are why the review found an English sentence in `Info.plist` that no check could ever have seen |
| [`docs/reviews/phase-1b-1-shell-and-i18n.md`](docs/reviews/phase-1b-1-shell-and-i18n.md) | The Phase 1b-1 review, dispositioned above. Its two High findings were both **real grants** — an over-broad capability set and a production CSP allowing inline styles — and its finding 1 was a crash on the declared minimum macOS. R34 and R35 come from it |
| [`src/lib/stores/locale.svelte.ts`](src/lib/stores/locale.svelte.ts) · [`src/lib/bootstrap.ts`](src/lib/bootstrap.ts) | The locale state and the pre-mount bootstrap. `createLocaleState` takes a tag *reader* and re-negotiates on `languagechange` **without ever touching an explicit override**; `bootstrap()` sets `documentElement.lang` before mount. Both directions are pinned by disabling experiments |
| [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) · [`Info.plist`](src-tauri/Info.plist) · [`capabilities/default.json`](src-tauri/capabilities/default.json) | Identifier `cc.carpio.espansoConfig`, strict CSP, **`"permissions": []`** — measured sufficient for all **six** commands by `dispatch_check.rs`, not merely argued — and `CFBundleLocalizations = [en, es]`. The menu **is** localized as of 1b-2b, and it needed no permission: a capability governs *plugin* commands, and `set_menu_labels` is this application's own. The reasoning is written into the file's `description` field so the next phase cannot re-open it by accident |
| [`crates/espansoconfig-core/src/workspace/mod.rs`](crates/espansoconfig-core/src/workspace/mod.rs) | **What Phase 1b wraps, one command per method.** `discover`, `summary`, `list_documents`, `get_document`, `get_match`, `document_view`, `document_text`, `refresh`, `load_all`, `evict` — plus the per-`ContentRevision` cache that answers R19's remaining half, and the monotonic path-keyed `DocumentId` allocation that D2v's identity fix rests on |
| [`crates/espansoconfig-core/src/model/`](crates/espansoconfig-core/src/model/) | **The read model itself.** `document.rs` (`DocumentView`, `match_by_id`, `unaccounted_keys`, `coverage_is_complete`), `match_view.rs` (plan §3.3's 22 fields, `MatchId`, badges), `variable.rs` (the nine §3.4 types), `scalar.rs` (`ScalarView` — D2u in a type), `unknown.rs` (`UnknownEntry`, the undescended spans of D2w), `diagnostic.rs` (22 codes, no prose), `project.rs` (the walk), `profile.rs`, `value.rs` |
| [`docs/decisions/1a-notes.md`](docs/decisions/1a-notes.md) | Phase 1a's decision record: what the projection is and is not (§1), D2u as a type (§2), the key accounting stated so it can be false (§3), where the schema stops (§4), identity and the design rejected (§5), the workspace and R19 (§6), the disabling experiments (§7 and §12), what the phase got wrong on the way (§8), **the eleven coverage holes stated as holes (§9)**, the dependencies added (§10), what 1b inherits (§11) and the review disposition (§12) |
| [`docs/reviews/phase-1a-core-read-model.md`](docs/reviews/phase-1a-core-read-model.md) | The Phase 1a review, which held the phase open. D2v and D2w and R27–R30 all trace to it; its finding 1 is R24's third occurrence and its finding 2 is the vacuous-audit corollary |
| [`crates/espansoconfig-core/tests/model_projection.rs`](crates/espansoconfig-core/tests/model_projection.rs) | Phase 1a acceptance: the per-fixture `SYNTHETIC_PROJECTIONS` table, the D2u oracle and its disabling experiment, the tree-derived coverage oracle, `an_identity_from_before_a_reordering_is_refused_rather_than_resolved` (the reviewer's counterexample, retained), the truncation sweep and the badge/search pins |
| [`crates/espansoconfig-core/tests/workspace_cache.rs`](crates/espansoconfig-core/tests/workspace_cache.rs) | The cache and identity acceptance: parse-count instrumentation, `an_identity_survives_a_directory_that_gained_and_lost_a_file`, and the refresh/evict/change-and-back sequences the review asked for |
| [`crates/espansoconfig-core/tests/gate_roundtrip.rs`](crates/espansoconfig-core/tests/gate_roundtrip.rs) | **The Phase 0 gate itself** — the R9 sweep over every eligible target of both corpora, the 48-cell axis×operation matrix with `REFUSAL_ONLY_CELLS` enumerated, and `independent_yaml_1_1`, the second transcription of the 1.1 productions that makes the tag table's proof non-circular |
| [`crates/espansoconfig-core/src/emit/tags.rs`](crates/espansoconfig-core/src/emit/tags.rs) | The YAML 1.1 / 1.2-core resolution table (D2s). **Load-bearing in production**: the emitter consults it and `verify()` asserts on it. Hand-maintained — its 1.1 half has an independent second transcription in the gate test, its 1.2-core half does not |
| [`docs/decisions/0c-3b-2b-notes.md`](docs/decisions/0c-3b-2b-notes.md) | Phase 0c-3b-2b's decision record: what the sweep is and is not (§1), what it measured (§2), the tag oracle and D2h's failure (§3), R16's exact open wording (§4), R24 answered (§5), the twelve disabling experiments (§6), and **the gate verdict, re-derived (§8)** |
| [`docs/reviews/phase-0c-3b-2b-the-gate.md`](docs/reviews/phase-0c-3b-2b-the-gate.md) | The review that refused the first verdict. D2s, D2t and the R4 closure all trace to it; its E5 finding is why the removal envelope has a bound derived independently of itself |
| [`crates/espansoconfig-core/tests/patch_move.rs`](crates/espansoconfig-core/tests/patch_move.rs) | **Phase 0c-3b-2a acceptance, and the closest model for the gate's own sweep.** The per-fixture move table, the independently re-derived refusals, `check_the_arrival_is_the_departure` (the test-side second derivation of D2q's property 4), and the **retained mutation tests** — `a_planner_that_permutes_the_carried_lines_is_rejected`, `every_other_move_property_certifies_the_permuted_candidate`, C1/C2/C2b/C4/C5, M1/M3/M4 — which are the pattern for "break the engine, not the oracle" |
| [`docs/decisions/0c-3b-2a-notes.md`](docs/decisions/0c-3b-2a-notes.md) | Phase 0c-3b-2a's decision record: what byte identity stopped being able to say (§1), how the envelope and destination are derived (§2), the five-property invariant and what a hostile reader says it misses (§3), the seam model and the blank-run rule at the destination (§4), every measurement per fixture with deltas attributed (§5), the disabling experiments and the four engine breaks (§6), the claims this phase proved false including the withdrawn EOF argument (§7), what is owed to 0c-3b-2b (§8), and **the review disposition (§9)** |
| [`docs/reviews/phase-0c-3b-2a-move-and-invariant.md`](docs/reviews/phase-0c-3b-2a-move-and-invariant.md) | The Phase 0c-3b-2a review; D2q, D2r and R24–R26 come from the phase and this review, dispositioned above. Its first High finding is why a safety property must live in `verify()` and not only in a sweep; its second is why the EOF rotation is refused |
| [`crates/espansoconfig-core/src/patch/edit.rs`](crates/espansoconfig-core/src/patch/edit.rs) | **Where 0c-3b-2a landed and where the gate reads from.** `apply_edits` is the one batch protocol for `ScalarEdit`, `FieldInsert`, `FieldRemoval` and `ItemMove`; `verify()` holds D2q's five properties, `the_arrival_is_the_departure` and `comment_ownership_survives` among them. Formerly: | `apply_edits` is the one batch protocol for `ScalarEdit`, `FieldInsert` and `FieldRemoval`: plan against the original index, reject overlaps, splice highest-offset-first, reparse, verify. Also `EditError`, `VerificationFailure`, `StructuralGuard`, `PresentationNote`, `PatchedDocument`, and 0c-3b-1's run derivation (`preserved_regions`, `runs_between`, `block_scalar_the_kept_bytes_would_join`, `first_kept_column`, `absorbs_a_line_at`) |
| [`crates/espansoconfig-core/tests/patch_structure.rs`](crates/espansoconfig-core/tests/patch_structure.rs) | **Phase 0c-3a/0c-3b-1 acceptance**, and the sweep 0c-3b-2 extends: the per-fixture `SYNTHETIC_OUTCOMES` table, the independently re-derived refusals, `check_removal_runs`'s **eight** envelope properties, `preserved_by_the_rule` — the preservation rule written down once on the test side — the insertion oracle, and the before/after file-comment scan that finding 1 forced |
| [`docs/decisions/0c-3b-1-notes.md`](docs/decisions/0c-3b-1-notes.md) | Phase 0c-3b-1's decision record: how the run set is derived and what could contradict it (§2), the blank-run rule in both directions (§2.1), the narrowed block-scalar refusal (§3), the eight envelope properties and why the old property 6 was not an oracle (§4), what R21's closure and the narrowing measured (§5), every disabling experiment verbatim including the two that break the engine rather than a layer (§6), what 0c-3a's and this phase's own notes got wrong (§7), and **the review disposition (§8)** |
| [`crates/espansoconfig-core/src/syntax/collection.rs`](crates/espansoconfig-core/src/syntax/collection.rs) | The block-collection extent (D2n, closing R3): the textual derivation, `CollectionExtent::owned_end()` and the `Unaccountable` fallback |
| [`docs/decisions/0c-3a-notes.md`](docs/decisions/0c-3a-notes.md) | Phase 0c-3a's own decision record: what was measured about collection ends before any rule was chosen, the hull-versus-set argument (§2.1), the line-ending rule (§3.1–3.2), the verification invariant (§5), and every claim the review proved false |
| [`crates/espansoconfig-core/tests/patch_edit.rs`](crates/espansoconfig-core/tests/patch_edit.rs) | Phase 0c-2b acceptance: the corpus-wide edit sweep with independently re-derived refusals, the pinned per-fixture counts, the flow-legality pins (R17/D2k) and the hazard-scope pin (R12) |
| [`docs/decisions/0c-2b-notes.md`](docs/decisions/0c-2b-notes.md) | The phase's own decision record: the R17 rationale, every new error variant and why it exists, the three claims it found false, and the coverage holes it pinned at 0 rather than papered over |
| [`crates/espansoconfig-core/src/patch/path.rs`](crates/espansoconfig-core/src/patch/path.rs) | **0c-2a**: `DocumentPath`, `resolve`, `resolve_key`, `resolve_full`, `path_to`. What the edit engine calls to find its target and to re-find it after the reparse |
| [`crates/espansoconfig-core/tests/patch_path.rs`](crates/espansoconfig-core/tests/patch_path.rs) | Phase 0c-2a acceptance: the inverse-pair oracle, the two seeded sweeps, the pinned per-category counts, and the flow-collection gate pin (R17) |
| [`docs/parser-evaluation.md`](docs/parser-evaluation.md) | The Phase 0b build order, in the division-of-labour table |
| [`crates/espansoconfig-core/src/syntax/mod.rs`](crates/espansoconfig-core/src/syntax/mod.rs) | Where 0b is implemented |
| [`crates/espansoconfig-core/src/emit/choose.rs`](crates/espansoconfig-core/src/emit/choose.rs) | `choose_scalar`, `preserve_scalar`, `reencode_in_place`, `NotReencodable` — what 0c-2 calls to render a new value |
| [`crates/espansoconfig-core/src/emit/plan.rs`](crates/espansoconfig-core/src/emit/plan.rs) | `ScalarPlan`, `ScalarContext`, `ScalarRole`; `render_header`/`render_content` give the exact bytes for the header and content spans |
| [`crates/espansoconfig-core/src/emit/decode.rs`](crates/espansoconfig-core/src/emit/decode.rs) | `decode()` — the value a span currently holds |
| [`crates/espansoconfig-core/tests/scalar_codec.rs`](crates/espansoconfig-core/tests/scalar_codec.rs) | Phase 0c-1 acceptance: the substrate-agreement oracle, the corpus identity suite, the adversarial and seeded round-trips |
| [`crates/espansoconfig-core/src/syntax/trivia.rs`](crates/espansoconfig-core/src/syntax/trivia.rs) | The gap scanner: `TriviaKind`, `TriviaIndex`, `HazardKind`, and the envelope queries |
| [`crates/espansoconfig-core/src/syntax/ownership.rs`](crates/espansoconfig-core/src/syntax/ownership.rs) | The §6.2 ownership rules, the ambiguous-case policy table (D2d) and hazard collection |
| [`crates/espansoconfig-core/tests/trivia_scanner.rs`](crates/espansoconfig-core/tests/trivia_scanner.rs) | Phase 0b-2 acceptance: tiling, the four rules, the ambiguous cases, the hazard set, and the classification/ownership goldens |
| [`crates/espansoconfig-core/tests/parser_evaluation.rs`](crates/espansoconfig-core/tests/parser_evaluation.rs) | The 31 pinned parser tests — the upgrade tripwire |
| [`docs/reviews/phase-0a-parser-substrate.md`](docs/reviews/phase-0a-parser-substrate.md) | The adversarial review; R5–R9 come from it |
| [`docs/reviews/phase-0b-1-span-layer.md`](docs/reviews/phase-0b-1-span-layer.md) | The Phase 0b-1 review; D2c and R10–R11 come from it |
| [`docs/reviews/phase-0b-2-trivia-and-ownership.md`](docs/reviews/phase-0b-2-trivia-and-ownership.md) | The Phase 0b-2 review; G1–G8 and R12–R13 come from it |
| [`docs/reviews/phase-0c-1-scalar-codec.md`](docs/reviews/phase-0c-1-scalar-codec.md) | The Phase 0c-1 review; F1–F7, D2f–D2i and R14–R16 come from it |
| [`docs/reviews/phase-0c-2a-path-resolver.md`](docs/reviews/phase-0c-2a-path-resolver.md) | The Phase 0c-2a review; P1–P6, D2j and R17–R18 come from it |
| [`docs/reviews/phase-0c-2b-span-replacement.md`](docs/reviews/phase-0c-2b-span-replacement.md) | The Phase 0c-2b review; D2k–D2m and R19–R20 come from the phase, and this review's findings are dispositioned above |
| [`docs/reviews/phase-0c-3a-structural-edits.md`](docs/reviews/phase-0c-3a-structural-edits.md) | The Phase 0c-3a review; D2n–D2p and R21–R22 come from the phase and this review, dispositioned above. Its finding 1 is the hull-versus-set argument in its concrete form, and is what Phase 0c-3b-1 answered |
| [`docs/reviews/phase-0c-3b-1-run-based-envelopes.md`](docs/reviews/phase-0c-3b-1-run-based-envelopes.md) | The Phase 0c-3b-1 review, dispositioned above and in `0c-3b-1-notes.md` §8. Finding 1 is why the blank-run rule is explicit and why the sweep's property 6 is an oracle rather than a restatement; finding 2 is why R23 compares indentation columns |
| [`crates/espansoconfig-core/tests/corpus/synthetic/run-based-removal-envelope.yml`](crates/espansoconfig-core/tests/corpus/synthetic/run-based-removal-envelope.yml) | The Phase 0c-3b-1 fixture: the two shapes that tell a run set from a hull — a file-owned comment with blank lines on both sides, and one whose lines would join a block scalar above (R23) |
| [`crates/espansoconfig-core/tests/corpus/synthetic/run-based-removal-boundaries.yml`](crates/espansoconfig-core/tests/corpus/synthetic/run-based-removal-boundaries.yml) | The fixture that phase's **review** forced: the *safe* side of R23 (a folded block above a column-zero comment) and an entry-owned leading comment block paired with an interior file comment. Same node shape as the fixture above and different trivia, deliberately, so every trivia delta is attributable — and the **twelfth** entry in `CLAUDE.md` §4's table, because its comment *columns* are the test data |
| [`crates/espansoconfig-core/tests/corpus/synthetic/move-a-match.yml`](crates/espansoconfig-core/tests/corpus/synthetic/move-a-match.yml) | The Phase 0c-3b-2a ownership fixture: what travels with a moved match and what stays behind. Also the **only** fixture holding a quoted scalar with an inline comment — restored by the review after the phase first deleted the shape (R20's seventh) |
| `move-block-scalar-seams.yml` · `move-run-joins.yml` · `move-kept-comment-joins-a-block.yml` | The three Phase 0c-3b-2a fixtures whose **columns are the test data** — CLAUDE.md §4 entries 13–15. Respectively: the three external seams, the internal carried-run join the review found, and R23 seen by a move. Each pins **both** sides of its condition, per R20 |
| [`crates/espansoconfig-core/tests/corpus/synthetic/`](crates/espansoconfig-core/tests/corpus/synthetic/) | The committed corpus — **32 fixtures** |
| [`scripts/sync-real-corpus.sh`](scripts/sync-real-corpus.sh) | Run once locally to enable the real-corpus tests |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) §6.2, §6.3, §11 | Fidelity model, scalar style rules, testing strategy |
| [`CLAUDE.md`](CLAUDE.md) | Project conventions, corpus privacy rule, build commands |

---

## Git state

_Updated at each phase boundary._

| Phase | Commit | Push | Tree |
|---|---|---|---|
| 0a | `10f3e70` | ✅ pushed to `origin/main` | clean |
| 0b-1 | `813f809` | ✅ pushed to `origin/main` | clean |
| 0b-2 | `9825d9e` | ✅ pushed to `origin/main` | clean |
| 0c-1 | `f8693cd` | ✅ pushed to `origin/main` | clean |
| 0c-2a | `f56d5dd` | ✅ pushed to `origin/main` | clean |
| 0c-2b | `4f92c03` | ✅ pushed to `origin/main` | clean |
| 0c-3a | `8989c16` | ✅ pushed to `origin/main` | clean |
| 0c-3b-1 | `4015ff7` | ✅ pushed to `origin/main` | clean |
| 0c-3b-2a | `7fd9850` | ✅ pushed to `origin/main` | clean |
| 0c-3b-2b | `912cb89` | ✅ pushed to `origin/main` | clean |
| 1a | `185c9a6` | ✅ pushed to `origin/main` | clean |
| 1b-1 | `94aa6c9` | ✅ pushed to `origin/main` | clean |
| 1b-2a | `d876eb6` | ✅ pushed to `origin/main` | clean |
| 1b-2b | `065a516` | ✅ pushed to `origin/main` | clean |
| 1c-1 | `59d4207` | ✅ pushed to `origin/main` | clean |
| 1c-2a | `5c830d0` | ✅ pushed to `origin/main` | clean |
| 1c-2a cleanup | `82ad7c5` | ✅ pushed to `origin/main` | clean |
| 1c-2b-1 | `41b5e40` | ✅ pushed to `origin/main` | clean |
| 1c-2b-2a | `16f9a0d` | ✅ pushed to `origin/main` | clean |
| 1c-2b-2b-1 | `20ec090` | ✅ pushed to `origin/main` | clean |
| 1c-2b-2b-2 | `0552004` | ✅ pushed to `origin/main` | clean |
| 2a-1 | `428a83f` | ✅ pushed to `origin/main` | clean |
| 2a-2a | `7128242` | ✅ pushed to `origin/main` | clean |
| 2a-2b | `cbcc25b` | ✅ pushed to `origin/main` | clean |
| 2a-3a | `cda72f3` | ✅ pushed to `origin/main` | clean |
| 2a-3b | `7aab106` | ✅ pushed to `origin/main` | clean |
| 2b-1 | `0229b14` | ✅ pushed to `origin/main` | clean |
| 2b-2a | `c3fe5a6` | ✅ pushed to `origin/main` | clean |
| 2b-2b-2 | `8016a3b` | ✅ pushed to `origin/main` | clean |
| 2b-2b-2 code review | `f1bbad1` | ✅ pushed to `origin/main` | clean |
| 2b-2b-3 | `0cf7420` | ✅ pushed to `origin/main` | clean |
| 2b-2c-1 | `95c1a0b` | ✅ pushed to `origin/main` | clean |
| **2b-2c-2** | **`8d223fc`** | ✅ pushed to `origin/main` | clean |
| **2b-2c-2 cleanup** | **`35a9e9e`** | ✅ pushed to `origin/main` | clean |
| **2b-2c-3a** | **`3375e98`** | ✅ pushed to `origin/main` | clean |
| **2b-2c-3b** | **`d230352`** | ✅ pushed to `origin/main` | clean |
| 2b-2b-1 | `a45424f` | ✅ pushed to `origin/main` | clean |
| **2c split** | **`8b1c050`** | ✅ pushed to `origin/main` | clean |
| **2c-1a** | **`25fcc40`** | ✅ pushed to `origin/main` | clean |
| **2c-1b** | **`fa72d45`** | ✅ pushed to `origin/main` | clean |
| **2c-2 step 1** | **`22a52cc`** | ✅ pushed to `origin/main` | clean |
| **2c-2 step 2** | **`a17d975`** | ✅ pushed to `origin/main` | clean |

`8b1c050` is **not a phase** — it is the **split of Phase 2c**, which the previous checkpoint made a
fresh session's first act in as many words: *"A fresh session's first act is that split, not code."*
No code was written. It contains `docs/decisions/2c-split-notes.md`, the design consult
`docs/reviews/phase-2c-split-design.md`, the ten-row split table and its consult disposition in this
file, and `CLAUDE.md` §6. **Four of the consult's seven answers changed the cut rather than
confirming it**, so a session that reads only the earlier five-way proposal will build the wrong
thing: undo stopped being a sub-phase, duplicate became one, the typed invalidation effect moved
from 2c-3 to 2c-1a, and five sub-phases became ten. The baseline was verified before the split, not
assumed — `cargo test --workspace` 1007 and `npm test` 738, both run.

`fa72d45` is Phase 2c-1b **including all three of its fix rounds** — the phase was held open until
every one of the nine findings was closed, so, as with every phase since `8989c16`, no commit holds
a demonstrated defect. **Two of the nine were found by neither review**: the window reading caught
them after 883 tests, `svelte-check` and two Codex passes had all passed, and one of them silently
rewrote every line ending in a CRLF file while the screen said *"exactly the text that was sent"*.
That is the strongest evidence this project has that a reading of a screen is not ceremony, and it
is why 2c-2 must budget for one — and for a **re-take**, because a claim about a screen has to be
re-read after any change to a component, which is why 2c-1b took two.

`25fcc40` is Phase 2c-1a **including its review fix round** — the phase was held open until all
eight findings were closed, so, as with every phase since `8989c16`, no commit holds the
demonstrated defects: neither the seal whose payload `Reflect.ownKeys` recovered and which could be
opened a second time with a no-op, nor the invalidation callback whose exception replaced a
**committed** save's outcome, nor the structured draft whose base, history and consent candidate
were one aliased object that an in-place mutation moved all at once — **nor the two claims this
project's own decision record made about guarantees the code did not give.** It contains
`src/lib/browser/{draft,invalidation,saveOutcome}.ts` with their three test files, the
behaviour-preserving extraction in `src/lib/browser/rawSave.ts`, twelve new keys in each dictionary
with their accessors in `src/lib/i18n/index.ts`, `docs/decisions/2c-1a-notes.md`,
`docs/reviews/phase-2c-1a-draft-spine.md`, `CLAUDE.md` §6 and this checkpoint. 738 → 821 frontend
tests. **It touches no `.svelte` file and nothing under `crates/` or `src-tauri/`**, and
`cargo test --workspace` was run anyway, unchanged at 1007, because that is the evidence for the
claim. **A fresh session starting Phase 2c-1b should start from `25fcc40` or later.** As at 1b-1,
`npm install` (or `npm ci`) is required before any frontend command will run.

`d230352` is Phase 2b-2c-3b **including its review fix round** — the phase was held open until all
four findings were closed, so, as with every phase since `8989c16`, no commit holds the demonstrated
defects: neither the wrapper that turned a **committed** write into a rejected promise when the
caller's reload happened to fail, nor the invalidation obligation that a `() => {}` discharged, nor
the dispatcher test that read the cache while claiming to read the disk, nor the
acknowledgement-mismatch test that compared three operands and named four. It contains
`save_raw_document` with `save_one_raw_document` and the generalized `run_one_save` in
`src-tauri/src/commands.rs`, the registration in `main.rs`, the retabulated
`dispatch_check.rs` and `wire_contract.rs`, the new `src/lib/browser/rawSave.ts` with its
presentation model, `RawSaveOutcome` and `saveRawDocument` in `src/lib/ipc/commands.ts`,
`BrowserState.saveRawDocument` with `forgetTheReplacedDocument` and `adoptTheReplacedDocument` in
`src/lib/browser/workspace.svelte.ts`, six new `browser.rawSave.*` keys in each dictionary,
`docs/decisions/2b-2c-3b-notes.md` and the review file. **It is the first commit in which this
application can replace a user's whole file, and it closes 2b-2c and with it 2b: all eleven
commands exist.** As at 1b-1, `npm install` (or `npm ci`) is required before any frontend command
will run. **A fresh session starting Phase 2c should start from this commit or later.**

`3375e98` is Phase 2b-2c-3a **including both of its review fix rounds** — the phase was held open
until the High and the Medium were closed, so, as with every phase since `8989c16`, no commit holds
the demonstrated defects: neither the replacement that destroyed a whole file with no recoverable
image of it, nor the acknowledgement that consent for one unparseable text could spend on another.
It contains `SaveContent` and the branch in `crates/espansoconfig-core/src/persist/save.rs`,
`FindingCode::DocumentDoesNotParse` in `validate/mod.rs`, the new
`crates/espansoconfig-core/tests/persist_raw_save.rs` (18 tests), the contract updates in
`src-tauri/src/{dictionary_contract,wire_contract}.rs`, two new strings in each dictionary, the
TypeScript mirror, the review, `docs/decisions/2b-2c-3a-notes.md` and this checkpoint.
983 → 1001 tests. **It registers no command** — `save_raw_document` is 2b-2c-3b's — so `npm install`
is not needed to verify it, but it still is before any frontend command. **A fresh session starting
Phase 2b-2c-3b should start from `3375e98` or later.**

`35a9e9e` is the cleanup round that followed the phase — four independent quality reviews (reuse,
simplification, efficiency, altitude) of `8d223fc`, ten fixes applied, **983 tests still passing and
none merged away**. It removes the four-way copy of the save tail (`run_one_save`, `view_at`,
`with_open`), the hand-written landing arithmetic (`ItemPlacement::items_above` made public), the
duplicated anchor resolution (`anchor_index`), a dead `PresentationNote::edit()`, a whole-projection
clone on every save, and a redundant document check confirmed byte-identical to the one
`match_by_id` already performs. **Its one user-facing change**: `moveNotWithinOneSequence`'s two
sentences no longer say *moves*, because `create_match` and `delete_match` now raise it too and a
user pressing delete was reading a sentence about moving in both languages. It also records four
things deliberately **not** built, as holes 6.8–6.11.

`8d223fc` is Phase 2b-2c-2 **whole** — its design consult, its aggregate code review, **both of that
review's findings fixed before the commit**, and this checkpoint. 29 files, +3477/−246. It contains
`create_match` and `delete_match` in `src-tauri/src/commands.rs`, the closed `NewMatch` in
`crates/espansoconfig-core/src/draft/new_match.rs`, `ItemPlacement` and the front insertion in
`patch/edit.rs`, `PresentationNote` reshaped into a tagged union across `src-tauri/src/save.rs` and
`src/lib/ipc/types.ts`, `CommandError::DocumentHasNoMatchList` with its two sentences, the new
`every_edit_error_variant_crosses_as_an_object`, `docs/decisions/2b-2c-2-notes.md` and the two review
files. **It is the first commit in which this application can create or delete a user's snippet** —
and the first in which a deletion tells the user about the blank line it doubled instead of doing it
silently.

`95c1a0b` is Phase 2b-2c-1 **whole** — both Codex consultations, the one Low documentation finding
fixed before the commit, and this checkpoint. It contains `InsertItem`, `RemoveItem` and the shared
lift (`editable_sequence_item`, `lift_item`, `leading_comment_block_start`) in
`crates/espansoconfig-core/src/patch/edit.rs`, the eight new `EditError` refusals with their
sentences in both dictionaries and their member in `src/lib/ipc/types.ts`, the retabulated counts in
`src-tauri/src/{wire,dictionary}_contract.rs`, the new
`crates/espansoconfig-core/tests/patch_item.rs`, `docs/decisions/2b-2c-1-notes.md` and the two review
files. **It is the first commit in which the patch engine can insert or remove a whole sequence item,
and nothing calls either primitive.** It also carries a **latent-defect fix**: no CRLF document had
ever had an entry's leading comment block counted as owned, so a CRLF removal or move of such an
entry was wrongly refused — `ItemMove` is affected as well as the new removal. As at 1b-1,
`npm install` (or `npm ci`) is required before any frontend command will run. **A fresh session
starting Phase 2b-2c-2 should start from `95c1a0b` or later.**

`0cf7420` is Phase 2b-2b-3 **whole** — both Codex consultations, the one defect found and fixed
before the review, the window reading, and this checkpoint. It contains `save_match` and
`save_one_match` in `src-tauri/src/commands.rs` with `after_a_save` generalized to take an address,
`CommandError::DraftRefused` in `src-tauri/src/error.rs`, `DraftError::MatchHasNoPath {}` in
`crates/espansoconfig-core/src/draft/error.rs`, the 33 new keys in each dictionary, the wire types,
`saveMatch` and `describeDraftError` in `src/lib/`, the two generalized contract tests in
`src-tauri/src/{wire,dictionary}_contract.rs`, `docs/decisions/2b-2b-3-notes.md` and the two review
files. **This is the first commit in which a user's edited match fields can be written to disk from
a window's request.** As at 1b-1, `npm install` (or `npm ci`) is required before any frontend command
will run. **A fresh session starting Phase 2b-2c should start from `0cf7420` or later.**

`c3fe5a6` is Phase 2b-2a **including its review fix round** — the phase was held open until all five
findings were closed, so, as with every phase since `8989c16`, no commit holds the demonstrated
defects: neither the window that kept showing a file's old order and old bytes after a save whose
rename had already completed, nor the acknowledgement that accepted a span running from 20 to 10, nor
the three tests that could not fail — the conflict test whose fixture made the two revisions equal, the
`Saved` handling that no test exercised with `committed: false`, and the test named *leaves the bytes
it did not move alone* that compared four proxies and never the bytes. It contains `src-tauri/src/save.rs`,
`move_match` and the app-owned `BackupSession` in `src-tauri/src/commands.rs`, the two new
`CommandError` variants and the derived `may_have_written` operand in `src-tauri/src/error.rs`, the
`Deserialize` graph across `persist/save.rs`, `validate/mod.rs`, `model/variable.rs` and `syntax/mod.rs`,
`ItemMove::resulting_index` in `patch/edit.rs`, `Workspace::document_context`, 13 new keys in each
dictionary, the frontend boundary in `src/lib/ipc/` and `src/lib/browser/`, the review,
`docs/decisions/2b-2a-notes.md`, `CLAUDE.md` §6 and this checkpoint. **This is the first commit in
which anything outside `espansoconfig-core` can write a user's file. A fresh session starting Phase
2b-2b should start from `c3fe5a6` or later.** As at 1b-1, `npm install` (or `npm ci`) is required
before any frontend command will run.

`f1bbad1` is **not a phase** — it is the aggregate code review Phase 2b-2b-2 owed and could not
afford, run at the head of the next session, plus the fix round for its one finding. It contains
`docs/reviews/phase-2b-2b-2-open-key-code.md`, `DraftError::AmbiguousVariableKey` and
`check_no_key_of_the_variable_is_repeated` in `crates/espansoconfig-core/src/draft/{error,plan}.rs`,
four new tests with their shared helper in `crates/espansoconfig-core/tests/draft_plan.rs`, and this
checkpoint. 913 → 917 tests. It touches no file under `src/` or `src-tauri/` and registers no command,
so `npm install` is not needed to verify it. **With it, every phase from `8989c16` onward has both of
its reviews closed, and a fresh session starting Phase 2b-2b-3 should start from `f1bbad1` or later.**

`7aab106` is Phase 2a-3b **including both its review fix round and the confirmation fix round** — the
phase was held open until all eleven findings and the confirmation pass's one residue were closed, so,
as with every phase since `8989c16`, no commit holds a demonstrated defect. It contains
`persist/backup.rs`, `tests/persist_backup.rs`, the placement in `persist/save.rs`, the two named
`fcopyfile` policies in `persist/write.rs`, both review files, `docs/decisions/2a-3b-notes.md` and this
checkpoint. **It closes 2a-3, and with it the whole of 2a: plan §6.6 exists end to end.**
A fresh session should start from `7aab106` or later.

Two follow-ups landed after `4f92c03`, both documentation only: `3b76697` recorded the commit here,
and `2eb12cb` reconciled the Phase 0a–0c-2a corpus figures in this file with the fixture Phase 0c-2b
added, so no historical paragraph states a count the suite no longer pins.

`8989c16` is Phase 0c-3a **including its review fix round** — the phase was held open until all five
findings were closed, so there is no intermediate commit holding the demonstrated defect. It contains
the implementation, the three new fixtures, the review, the notes doc and this checkpoint. A fresh
session should start from `8989c16` or later.

`4015ff7` is Phase 0c-3b-1 **including its review fix round** — the phase was held open until both
findings were closed, so, as with `8989c16`, no commit holds the demonstrated defect. It contains the
run derivation in `src/patch/edit.rs`, the `subtree_extent` doc correction in `src/syntax/trivia.rs`,
the two new fixtures, the retabulated pins in seven test files, `CLAUDE.md` §4's twelfth fixture row,
the review, `docs/decisions/0c-3b-1-notes.md` and this checkpoint. **A fresh session should start
from `4015ff7` or later.**

`7fd9850` is Phase 0c-3b-2a **including its review fix round** — the phase was held open until all five
findings and three of the four coverage holes were closed, so, as with `8989c16` and `4015ff7`, no commit
holds the demonstrated defect. It contains `ItemMove` and D2q's five verification properties in
`src/patch/edit.rs`, the new `tests/patch_move.rs`, four new fixtures, the quoted-overshoot bucket in
`tests/parser_evaluation.rs`, the `entry_hull_lines` fix in `tests/patch_structure.rs`, retabulated pins
across seven test files, `CLAUDE.md` §4 entries 13–15, the review, `docs/decisions/0c-3b-2a-notes.md` and
this checkpoint. **A fresh session should start from `7fd9850` or later.**

`912cb89` is Phase 0c-3b-2b **including its review fix round** — the phase was held open until the
blocking finding was closed **in production** and the verdict re-derived rather than reworded, so, as with
every phase since `8989c16`, no commit holds the demonstrated defect. It contains `tests/gate_roundtrip.rs`,
`src/emit/tags.rs`, `RemovalCarriesMoreThanTheEntry` in `src/patch/edit.rs`, the memoised
`src/syntax/ownership.rs`, the `explicit-key-mappings.yml` fixture, retabulated pins across seven test
files, the R16 consultation, the review, `docs/decisions/0c-3b-2b-notes.md`, `CLAUDE.md` §6 and this
checkpoint. **This commit closes Phase 0. A fresh session starting Phase 1 should start from `912cb89`
or later.**

`41b5e40` is Phase 1c-2b-1 **including both of its review fix rounds** — the phase was held open until
all nine findings were closed, so, as with every phase since `8989c16`, no commit holds the demonstrated
defect. It contains `src/lib/browser/findings.ts`, the editability arms in `detail.ts`, the profile
projection and the `kind`-not-`shape` guard in `workspace.svelte.ts`, `DIAGNOSTIC_DISPLAY_INDICES` in
`codes.ts`, eight new strings in each dictionary, the two-pass review, `docs/decisions/1c-2b-1-notes.md`
and this checkpoint. **A fresh session should start from `41b5e40` or later.**

`16f9a0d` is Phase 1c-2b-2a **including its review fix round** — the phase was held open until all six
findings were closed, so, as with every phase since `8989c16`, no commit holds the demonstrated defect.
It contains the `document_text` command and its registration in `src-tauri/src/{commands,main}.rs`,
`UnknownEntry.value_text` in `crates/espansoconfig-core/src/model/unknown.rs`, the dispatcher fidelity
sweeps and the seven-command remote-origin table in `src-tauri/src/dispatch_check.rs`, the narrowed
contract wording across five files, `documentText()` in `src/lib/ipc/commands.ts`, the review,
`docs/decisions/1c-2b-2a-notes.md`, `CLAUDE.md` §6 and this checkpoint. **A fresh session should start
from `16f9a0d` or later.**

`20ec090` is Phase 1c-2b-2b-1 **including its review fix round** — the phase was held open until all
four findings were closed, so, as with every phase since `8989c16`, no commit holds the demonstrated
defects: neither the caption claiming bytes were shown as written above the arm that says it could not
read them, nor the scope sentence describing a `-` marker that a flow item does not have, nor the
headline promising every glyphless character was named while a zero-width space drew nothing, nor the
note asserting controls cannot reach the pane when only NUL was ever measured — and measuring the rest
**inverted** it. It contains the rendering primitive and its component
(`src/lib/browser/sourceText.ts`, `src/lib/components/SourceText.svelte`), the source-text section and
the unmodelled value in `src/lib/browser/detail.ts` and `src/lib/components/DetailPane.svelte`, 14 new
dictionary keys in each language with one reworded, the two committed measurements in
`crates/espansoconfig-core/tests/model_projection.rs`, the corrected `PARSEABLE_HAZARDS` in
`src/lib/browser/fixtures.ts`, the review, `docs/decisions/1c-2b-2b-1-notes.md` and this checkpoint.
**A fresh session should start from `20ec090` or later.** As at 1b-1, `npm install` (or `npm ci`) is
required before any frontend command will run.

`428a83f` is Phase 2a-1 **including its review fix round** — the phase was held open until all fifteen
findings were closed or recorded, so, as with every phase since `8989c16`, no commit holds the
demonstrated defects: neither the module doc promising a compare-and-swap that no POSIX operation can
perform, nor the byte-exact fixture sweep that a writer doing nothing at all passed, nor the
concurrency test that passes with no mutex, nor the `chflags` test that could print a skip and pass.
It contains `crates/espansoconfig-core/src/persist/write.rs`, the filled-in
`crates/espansoconfig-core/src/persist/mod.rs`, the `persist` re-exports in `lib.rs`, the new
`crates/espansoconfig-core/tests/persist_write.rs`, `docs/decisions/2a-1-notes.md`,
`docs/reviews/phase-2a-1-atomic-write.md` and this checkpoint. **This commit opens Phase 2. A fresh
session starting Phase 2a-2 should start from `428a83f` or later.** It touches no file under `src/` or
`src-tauri/`, so `npm install` is not needed to verify it — but it still is before any frontend command.

Note: commit `123f5c0` ("Ignore the .claude directory and untrack its settings") landed
out-of-band between the plan commit and 0a. It untracks `.claude/settings.json` and ignores
`.claude/`. Benign and left in place.

`94aa6c9` is Phase 1b-1 **including its review fix round** — the phase was held open until all nine
findings were dispositioned, so, as with every phase since `8989c16`, no commit holds the demonstrated
defects: neither the over-broad `core:default` capability, nor the production CSP allowing inline styles,
nor the macOS floor that would have thrown on first render, nor the missing `custom-protocol` feature
that made every binary load a dead dev URL. It is the first commit to add `src-tauri/` and `src/`, so it
contains the Tauri v2 shell, the Svelte 5 + TypeScript + Vite frontend, the i18n layer in both
languages, three lint scripts, `docs/decisions/1b-1-notes.md`, `docs/reviews/phase-1b-1-shell-and-i18n.md`,
`CLAUDE.md` §6 and this checkpoint. **A fresh session starting Phase 1b-2 should start from `94aa6c9`
or later.** Note that `npm install` is required before any frontend command will run — `node_modules/`
is gitignored and `package-lock.json` is committed, so `npm ci` reproduces the pinned tree exactly.

`d876eb6` is Phase 1b-2a **including its review fix round** — the phase was held open until all ten
findings were closed, so, as with every phase since `8989c16`, no commit holds the demonstrated defects:
neither the false `DocumentPath`-survives-a-reparse claim, nor the non-UTF-8 path that could deliver
serde's prose to the webview, nor the scope-creep oracle that could not detect a registered
`save_match`. It contains the five commands in `src-tauri/src/commands.rs`, the wire error in
`src-tauri/src/error.rs`, the contract and dispatcher checks in `src-tauri/src/{wire_contract,dispatch_check}.rs`,
the new `crates/espansoconfig-core/src/wire.rs` and its four callers in the core, the frontend boundary
in `src/lib/ipc/`, `docs/decisions/1b-2a-notes.md`, `docs/reviews/phase-1b-2a-ipc-surface.md` and this
checkpoint. **A fresh session starting Phase 1b-2b should start from `d876eb6` or later.** As at 1b-1,
`npm install` (or `npm ci`) is required before any frontend command will run.

`065a516` is Phase 1b-2b **including its review fix round** — the phase was held open until all seven
findings were closed, so, as with every phase since `8989c16`, no commit holds the demonstrated defects:
neither the six wire-visible enums deferred with no strings at all, nor the exhaustiveness check that
failed open on two valid Rust syntaxes and on any new enum, nor the `detail` guard that
`JSON.stringify` walked straight past, nor the menu command that answered `{ ok: true }` before it had
built anything. It contains the dictionaries and the typed accessor
(`src/lib/i18n/{codes.ts,en.json,es.json,index.ts}`), the exhaustiveness check and its parser
(`src-tauri/src/{dictionary_contract.rs,rust_source.rs}`), the menu and its checks
(`src-tauri/src/{menu.rs,menu_contract.rs}`, `src/lib/{menu.ts,ipc/menu.ts}`), the developer-string
guard (`src/lib/ipc/errors.ts`, `scripts/lint/ipc-detail.ts`), three new `CommandError` codes,
`docs/decisions/1b-2b-notes.md`, `docs/reviews/phase-1b-2b-dictionaries-and-menu.md`, `CLAUDE.md` §6
and this checkpoint. **This commit closes Phase 1b. A fresh session starting Phase 1c should start from
it or later.** As at 1b-1, `npm install` (or `npm ci`) is required before any frontend command will run.

`5c830d0` is Phase 1c-2a **including its review fix round** — the phase was held open until all four
findings were closed, so, as with every phase since `8989c16`, no commit holds the demonstrated defects:
neither the pane that claimed an unmodelled entry was "shown as written" while showing only its key,
nor the sequence item whose boundary was modelled and rendered by nothing, nor the coverage test that
audited what the implementation chose to emit. It contains the pane's model
(`src/lib/browser/detail.ts` and `detail.test.ts`), the rendered pane
(`src/lib/components/DetailPane.svelte`), 50 new dictionary keys and three new accessors
(`src/lib/i18n/{en.json,es.json,codes.ts,index.ts,plural.ts}`), the extended synthetic builders
(`src/lib/browser/fixtures.ts`), `docs/decisions/1c-2a-notes.md`,
`docs/reviews/phase-1c-2a-detail-pane.md` and this checkpoint. **A fresh session starting Phase 1c-2b
should start from `5c830d0` or later.** As at 1b-1, `npm install` (or `npm ci`) is required before any
frontend command will run.

`82ad7c5` is a **code-quality cleanup pass over 1c-2a**, not a phase: twelve fixes from four
independent review angles (reuse, simplification, efficiency, altitude), no behaviour change intended
and no dictionary key added or removed. Its recurring theme was decisions living in the one file no test
can execute — the option groups, the discovery predicate and the unmodelled-entry key label all moved
into the tested model, and the third was hiding a real defect (an entry whose key is the empty string
rendered a blank `<dt>`). It also stopped two projections discarding node identity the wire had already
carried, lifted the exhaustiveness helpers into `src/lib/i18n/exhaustive.ts`, and moved the `.depth-*`
ladder and the monospace face into `src/app.css`. **The efficiency angle found nothing worth fixing and
said so**: it decompiled the Svelte output to show `describeMatch()` is already a memoized `$.derived`
that unrelated state does not invalidate, and measured it at 9.3 µs on a typical match. 412 → 425
frontend tests. **It changed `DetailPane.svelte` without re-taking a window reading — see the warning at
the top of "Next action".**

`185c9a6` is Phase 1a, the first commit after `37cb48d`, which recorded D2u. Like every phase since `8989c16` it
is committed **including its review fix round** — the phase was held open until all five findings were
closed, so no commit holds the demonstrated positional-identity defect or the vacuous coverage audit.
It contains `src/model/` (nine files), `src/workspace/mod.rs`, the two new test binaries, the
`Serialize`/`Deserialize` derives across `syntax/`, `patch/path.rs`, `discovery.rs` and `watch/`,
`docs/decisions/1a-notes.md`, `docs/reviews/phase-1a-core-read-model.md` and this checkpoint.
**A fresh session starting Phase 1b should start from the 1a commit or later.**
