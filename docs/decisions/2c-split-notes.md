# Phase 2c — the split

**This document is not a phase.** It is the split of Phase 2c into sub-phases, made before any
line of 2c was written, by the rule every earlier split in this project followed: the cut is a
**dependency order, by failure mode**, and it is put to a design consult rather than chosen and
assumed correct. The consult is `docs/reviews/phase-2c-split-design.md`; its disposition is
`PROGRESS.md` § "Phase 2c split — consult disposition".

Four of the consult's seven answers changed the cut rather than confirming it. What follows is
the cut **after** those changes.

---

## 1. What Phase 2c is, and why it cannot be one phase

Its scope, verbatim from `IMPLEMENTATION_PLAN.md` §12: *the draft model, the small editor
(literal trigger · `replace` · label · word boundary), new / duplicate / delete / move, the
conflict UI, draft-level undo, restore from backup.*

Phase 2c's exit **is** the project's Phase 2 exit: *the owner uses it for a week on their real
config with zero data loss.* That is the first exit criterion in this project that is measured in
days of real use rather than in a test run, and it is the reason 2c may not be rushed: every
sub-phase below writes a real file on a real machine.

It cannot be one phase for the same reason 2b could not be. Five commands can write a user's file
and **no screen calls any of them.** 2c is therefore not "add some editing" — it is the first UI
in this project that can destroy data, and it carries the whole save protocol onto a screen for
the first time: three outcome arms, an exact-multiset acknowledgement round trip, a
content-addressed refusal, a conflict that must overwrite neither side, and an identity
invalidation that is **represented in no type**.

---

## 2. The cut

| Sub-phase | Scope | Fails as |
|---|---|---|
| **2c-1a** | The **draft spine**, with no editor: the draft state shape (base revision, base value, current value, undo/redo history, derived dirty, history boundaries), the **typed whole-document invalidation effect**, and the save-outcome presentation model for all three arms including the acknowledgement round trip. No screen | a **state-shape** mistake |
| **2c-1b** | The **raw editor**, the one vertical slice: the raw pane made editable and saveable over the already-wired `saveRawDocument`, the three arms drawn, the acknowledgement round trip drawn, the terminal-but-honest conflict state, and this project's **first mounted-component test** | a **protocol** mistake |
| **2c-2** | The **small editor** — literal trigger · `replace` · label · word boundary — over `MatchDraft` and `save_match`, extending undo coverage to per-field editing | a **draft-versus-projection** mistake |
| **2c-3a** | **New and delete**: `create_match` and `delete_match` on a screen, the returned identity adopted, and the selection's behaviour when the selected match is the one deleted | an **identity** mistake |
| **2c-3b** | **Move**: `move_match` on a screen, the new identity adopted, the cross-sequence and combined-edit refusals surfaced rather than hidden | an **identity** mistake |
| **2c-3c** | **Duplicate**, once its semantics are settled — see §4. May require Rust | a **preservation-promise** mistake |
| **2c-4a** | **Conflict capture and preservation**: retain the draft, load the disk version separately, compare, copy, reload — overwriting neither side | a **both-sides data-loss** mistake |
| **2c-4b** | **Reapply** — "keep my draft" in the plan's strong sense: identify the intended match in the newly parsed document and apply only when confidence suffices | an **algorithmic** mistake |
| **2c-4c** | **Recovery fallback**: save-draft-as-a-new-snippet, and manual resolution when the target is ambiguous or gone | a **dead-end** mistake |
| **2c-5** | **Restore from backup**: a whole-document replacement through the normal save path, with the full identity invalidation | a **destructive** mistake |

**Undo is not on that list, and its absence is the point.** See §3.

---

## 3. Why undo is not a sub-phase

It was one, in the first draft of this cut — listed last, beside restore from backup. The consult
rejected that, and the reason is the one that matters here: *"Undo is not genuinely separable from
the draft architecture. Its state shape must be designed in 2c-1."*

A draft model built without undo in mind is a `{ value, dirty }` pair. A draft model that can
support undo is a base, a current, two stacks and a set of boundary rules — and the second is not
reachable from the first by addition. Deferring undo would mean designing the wrong shape in
2c-1a, shipping two editors on it, and then rewriting it under both.

So the shape is 2c-1a's, and its coverage extends editor by editor: 2c-1b for the raw text,
2c-2 for the fields. What 2c-1a's shape must distinguish, from the consult:

- the base revision **and** the base value;
- the current editable value;
- past and future draft states (or reversible actions);
- dirty **derived** relative to the base, never maintained as an unrelated flag;
- a history boundary after a successful save or a reload;
- redo cleared when editing resumes from an undone state;
- **an acknowledgement bound to the exact current candidate**, so that undoing or editing
  invalidates consent collected for a different one.

That last is not an undo requirement wearing an undo costume — it is the protocol's own rule
(`FindingCode::DocumentDoesNotParse` is content-addressed to the candidate's revision) meeting
the fact that undo changes the candidate. It belongs in the state shape because that is the only
place it cannot be forgotten.

---

## 4. Why duplicate is its own sub-phase

Duplicate appears in the plan's scope with no command behind it, and the obvious reading is that
it is a `create_match` prefilled from an existing match's projection. The consult refused that
reading, and it is right:

> A projection-based duplicate can lose comments, key order, scalar spelling and quoting, unknown
> fields, tags, anchors, and other syntax the visual editor does not model. Calling that operation
> "Duplicate" would violate the app's preservation promise even if the source match itself remains
> untouched.

This project's whole claim is that it does not reformat what the user did not edit. A button
labelled *Duplicate* that silently drops the source match's comments and quoting style breaks that
claim in the one place a user would never think to check — the copy, not the original.

So 2c-3c owes a decision before it owes code, and there are exactly two honest products:

1. **A true duplicate** — clone the existing match's exact source subtree, insert the clone, and
   change only what must be unique. `create_match` today takes a closed `NewMatch` of scalar
   fields and synthesizes a flat block mapping; it cannot express "these bytes, again". That is
   **Rust work**, in `patch/`, and it is why 2c-3c is a sub-phase rather than a button.
2. **A projection-based new snippet**, labelled as such — *New from supported fields* — with an
   explicit disclosure of what was not copied.

They are not alternatives to choose between casually: (2) is cheap and is not duplicate; (1) is
what the plan's word means. 2c-3c settles that with the owner and, if (1), builds the primitive.

---

## 5. Why the raw editor goes first

The alternative — the small editor first — has the better-sounding argument: a scalar edit has a
smaller blast radius than a whole-document replacement that is *allowed to write unparseable
YAML*. The consult considered it and chose the raw editor anyway, on isolation:

> The small editor introduces several additional uncertainties simultaneously: changed-field
> tracking, scalar source fidelity, optional-field semantics, and projection-to-draft conversion.
> A failure could be incorrectly blamed on the save protocol. Raw save has a simple candidate — one
> exact string — and therefore isolates the protocol unusually well.

And on the danger being misidentified:

> Saving unparseable text is not itself the danger; saving it without content-addressed,
> draft-specific acknowledgement is.

The raw candidate is one string. If the bytes on disk afterwards are not equal to that string,
the protocol is wrong, and nothing else can be blamed. Every later editor sends a *derived*
candidate, so every later editor can blame its derivation. Proving the protocol on the
underivable one first is the whole reason for the order.

It also needs **zero new Rust**: `saveRawDocument` is wired, `rawSave.ts` is written and tested
(347 lines, no component imports it), and its six dictionary strings exist in both languages and
have never been drawn.

**The prerequisite the consult attached is not optional.** A committed raw replacement must
produce a **typed** frontend effect — an `invalidateEntireDocument` the caller cannot fail to
handle — rather than a documented obligation every call site is trusted to remember. That effect
moves out of 2c-3, where the first draft of this cut put it under the heading "identity", and into
**2c-1a**, because 2c-1b is where the strongest invalidation in the whole phase first fires.

---

## 6. What the 2c-1b conflict state must do, and what it must not be called

Rich conflict resolution is 2c-4. 2c-1b ships a **terminal** conflict state, and the consult's
judgement is that this is a complete first implementation rather than half of a later one — *"a
deliberately terminal conflict state is a complete first implementation, not a partial
implementation of rebasing."*

To be honest it must:

- state unambiguously that **nothing was written**;
- preserve the draft **byte-for-byte in memory**;
- never reload automatically, and never clear the dirty state;
- never retry by replacing the file with the stale whole-document candidate;
- offer *Keep editing* and an explicit *Reload disk version*;
- warn that reloading discards the draft, require confirmation, and offer *Copy draft* first;
- show enough file/revision information to tell the disk version from the draft;
- **still report a committed save as committed even if the reload that follows it fails.**

And one prohibition: **no control in 2c-1b may be called "Keep my draft".** In the plan that
phrase means *reapply the draft to the newly parsed disk document*, which is 2c-4b and is the
dangerous algorithmic half of this phase. Using the words early for the weaker behaviour would
teach the owner the wrong meaning and let 2c-4b look already-done.

No placeholder buttons for 2c-4 appear in 2c-1b. Instead, 2c-4's behaviour is an explicit exit
requirement of Phase 2c, recorded in `PROGRESS.md`, so that it cannot quietly disappear.

---

## 7. The evidence rule for every sub-phase of 2c

Every sub-phase owes **three** kinds of evidence, not one:

1. **Automated presentation and state tests** — the existing idiom, in `src/lib/browser/`.
2. **At least one mounted-component interaction test** — new to this project.
3. **A recorded manual reading in a running window** — the existing idiom
   (`docs/decisions/1c-1-notes.md` §10; the WKWebView constraint is `1c-2b-2b-2-notes.md` §6.1:
   one plan per launch, into a fresh bundle path).

(2) is a **new capability**, and it is taken deliberately in **2c-1b**. `vite.config.ts` has
anticipated this decision since 1b-1, in as many words:

```
// Every test here is either pure or reads only what it is handed, so no DOM
// implementation is needed. Adding jsdom later is a deliberate decision, not
// a default.
environment: 'node',
```

Phase 2c is where that stops being true: its components hold interactive state — a dirty text
area, a save control, a two-way acknowledgement choice — and the acknowledgement round trip is
the highest-risk protocol in the application while living **entirely inside a component**, where
model tests cannot reach it and a manual reading cannot regress-test it.

The decision is scoped, not retroactive: the harness is added and used for the interactive
components 2c introduces. Existing components are not back-filled, and the manual window reading
is **not** replaced — a mounted test proves a handler fires, not that a window draws.

---

## 8. The failure this split does not protect against

Stated by the consult as its answer 6, and recorded here rather than discovered later:

> A successful raw save followed by continued use of stale frontend projections and `MatchId`s.
> The save screen can present every protocol arm correctly and still leave the workspace holding
> selections, details, search results, or draft targets derived from the previous document.

It is the reason the typed invalidation effect moved into 2c-1a. But moving it does not by itself
close the hole: the effect must be **unignorable**, and 2c-1a owes a shape where a caller that
drops it does not compile. Where that proves impossible in TypeScript, the residue is written
down as a hole rather than claimed closed — exactly as `2b-2c-3b-notes.md` §7.2 did for
`ReloadAfterRawSave`.
