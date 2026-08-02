# Phase 2c — design consult on the split

**Commissioned:** at the head of the session that opens Phase 2c, before any line of 2c was
written, by the same rule the 2b-2c split followed (`docs/reviews/phase-2b-2c-1-design.md`, Q1):
a split is a design decision, and this project puts one to a consult rather than choosing it and
assuming it correct.

**Constraints given:** no web search, no repository exploration. The brief was self-contained —
it carried the protocol facts (the three `SaveResult` arms, the exact-multiset acknowledgement,
the content-addressed `DocumentDoesNotParse` finding, the identity-invalidation obligation that
is represented in no type), the current frontend inventory with line counts, the plan's verbatim
statement of 2c's scope and its conflict-UI rules, and the proposed five-way cut.

**Reviewer:** Codex, via `codex:codex-rescue`.

---

## The consult, verbatim

### 1. Raw editor first

Yes—put the raw editor first, but only after making whole-document identity invalidation part of the frontend save contract.

The strongest argument for the small editor first is blast radius. A constrained scalar edit exercises the normal patch-and-save path while making it difficult for a UI mistake to replace an entire document or intentionally admit invalid YAML. It would seem like the safer first real-world write.

I would still choose the raw editor first. The small editor introduces several additional uncertainties simultaneously: changed-field tracking, scalar source fidelity, optional-field semantics, and projection-to-draft conversion. A failure could be incorrectly blamed on the save protocol. Raw save has a simple candidate—one exact string—and therefore isolates the protocol unusually well. It also already has a tested presentation model.

Saving unparseable text is not itself the danger; saving it without content-addressed, draft-specific acknowledgement is. That behavior is a deliberate product capability and should be proven before more editors depend on the same refusal machinery.

The prerequisite is important: a committed raw replacement must produce a typed frontend effect such as `invalidateEntireDocument`, rather than relying on every caller to remember to clear cached projections. Do not leave that for 2c-3 merely because 2c-3 is labelled "identity."

### 2. Minimal conflict handling in 2c-1

Deferring rich resolution is sound. A deliberately terminal conflict state is a complete first implementation, not a partial implementation of rebasing.

To be honest, the 2c-1 conflict state must:

- State unambiguously that nothing was written.
- Preserve the user's draft byte-for-byte in memory.
- Never reload automatically or clear the dirty state.
- Never retry by replacing the file with the stale whole-document candidate.
- Offer "Keep editing" and an explicit "Reload disk version."
- Warn that reloading discards the draft, require confirmation, and ideally offer "Copy draft" before doing so.
- Display enough file/revision information to distinguish the disk version from the draft.
- Continue to report a committed save as committed even if the subsequent reload fails.

Do not call any action "Keep my draft" in 2c-1. In the plan that phrase has the stronger meaning of rebasing the draft onto newly parsed disk state, which 2c-1 does not implement.

To prevent 2c-4 from quietly disappearing, make its richer behavior an explicit exit requirement or tracked follow-up, but do not put placeholder buttons on the earlier screen.

### 3. Where draft-level undo belongs

Undo is not genuinely separable from the draft architecture. Its state shape must be designed in 2c-1, and undo should be integrated as each editor is introduced—not bolted on in 2c-5.

The shared draft model should distinguish at least:

- The base revision and base value.
- The current editable value.
- Past and future draft states or reversible draft actions.
- Dirty state derived relative to the base, not maintained as an unrelated flag.
- A history boundary after a successful save or reload.
- A rule for clearing redo history after editing from an undone state.
- Save acknowledgements tied to the exact current candidate, so undoing or editing invalidates consent collected for another candidate.

I would remove undo from 2c-5. Put its core in 2c-1 and extend its coverage in 2c-2. Leave backup restoration as its own later sub-phase.

### 4. Duplicate is not automatically trivial

Duplicate is only trivial if the product explicitly means "create a new supported-fields snippet prefilled from the projection." That is not a faithful duplicate.

A projection-based duplicate can lose comments, key order, scalar spelling and quoting, unknown fields, tags, anchors, and other syntax the visual editor does not model. Calling that operation "Duplicate" would violate the app's preservation promise even if the source match itself remains untouched.

A true duplicate should clone the existing match's exact source subtree and insert that clone, changing only data that must be unique. A projection-based operation should be labelled something like "New from supported fields," with an explicit disclosure that unsupported syntax is not copied. If `create_match` cannot accept or safely derive an exact source-node clone, true duplication needs Rust support, and it should be treated as a distinct 2c-3 sub-phase, not as a trivial extra button.

### 5. Sub-phases that need another split

Three need further cutting: 2c-3 into (a) create/delete with selection behavior and returned identities, (b) same-sequence move with new identity and rejected combined edits, and (c) duplicate, once its exact-preservation semantics and backend support are settled. 2c-4 into (a) conflict capture and preservation (retain draft, load disk version separately, compare, copy, reload), (b) reapply ("keep my draft" — identify the intended match in the newly parsed document, apply only when confidence is sufficient), and (c) recovery fallback (save-as-new-snippet, manual resolution for ambiguous/missing targets) — "keep my draft" is the dangerous algorithmic part and shouldn't ship alongside five new UI offers in one commit. 2c-5 should be dissolved: undo folded incrementally into 2c-1/2c-2, and restore-from-backup kept as its own sub-phase (whole-document replacement, full identity invalidation).

### 6. Most likely unprotected failure

A successful raw save followed by continued use of stale frontend projections and `MatchId`s. The save screen can present every protocol arm correctly and still leave the workspace holding selections, details, search results, or draft targets derived from the previous document. A later field edit may then address a stale match, display the wrong match, or fail in a way that looks like an unrelated editor bug. The proposed split places "identity" in 2c-3, but raw replacement creates the strongest identity invalidation in 2c-1 — and since that obligation is represented in no type, this is exactly the kind of omission that compiles and survives model-only tests.

### 7. Acceptance evidence per sub-phase

Every sub-phase needs three kinds of evidence: automated presentation/state tests, at least one mounted-component interaction test, and a recorded manual reading in a running Tauri window — the existing 738 tests alone cannot establish that a screen renders.

- **2c-1**: automated matrix for all `SaveResult` arms (committed:false, notes, exact-multiset acknowledgement, acknowledgement invalidation after any text change, content-hash binding, conflicts, reload failure after committed write); mounted click-through of refusal/acknowledgement; manual bilingual screen reading including notes, unparseable refusal, conflict, and successful reload with stale identities cleared; saved file must exactly equal the submitted candidate.
- **2c-2**: property/table-driven tests proving unchanged fields are omitted, changed fields retained, optional-field removal distinguishable from "unchanged," source text displayed not inferred; mounted per-field edit/save tests; manual byte-diff verification against disposable copies of real files, confined to intended spans.
- **2c-3**: automated identity/selection transition tests for every create/delete/move/duplicate (including deleting the selected item, cross-list moves, rejected cross-sequence moves, returned identities); exact-source tests for true duplicate; manual round-trip in a running window with reload-and-compare.
- **2c-4**: deterministic conflict scenarios per resolution, proving neither version is overwritten before explicit resolution, ambiguous identity blocks reapplication, compare uses the correct two texts, copied text is exact, and "save as new snippet" preserves the original disk match; manual exercise of all five offers including the ambiguous-target path.
- **Backup restore**: automated proof the selected backup becomes the exact replacement candidate via the normal whole-document save path, candidate-addressed acknowledgements still hold, and a committed restore invalidates every cached identity; manual restore with on-disk byte verification and a follow-up edit proving no stale identity remains.
- **Undo**: tested alongside each editor — undo/redo/branching-after-undo/return-to-clean/save-boundary/conflict-preservation/acknowledgement-invalidation — with mounted and manual checks that control enabled-states, dirty indicator, and saved bytes stay synchronized.

---

## Disposition

Every one of the seven answers was adopted. The disposition, finding by finding, is
`PROGRESS.md` § "Phase 2c split — consult disposition"; the resulting cut is
`docs/decisions/2c-split-notes.md`. Four of the seven changed the split rather than confirming
it:

| Answer | Effect on the cut |
|---|---|
| 1 (prerequisite) | The typed whole-document invalidation effect moves **out of 2c-3 and into 2c-1a**. |
| 3 | Undo is **no longer a sub-phase**. Its state shape is 2c-1a's; its coverage extends per editor. |
| 4 | Duplicate becomes **2c-3c**, with its semantics settled first — and may need Rust. |
| 5 | 2c-3 and 2c-4 are each cut three ways; 2c-5 is dissolved into "restore from backup". |

Answer 7 was adopted with one addition of our own: the mounted-component interaction test is a
**new capability for this project**, and `vite.config.ts` anticipated the decision in as many
words — *"Adding jsdom later is a deliberate decision, not a default."* It is taken in 2c-1b,
scoped to the interactive components 2c introduces rather than applied retroactively.
