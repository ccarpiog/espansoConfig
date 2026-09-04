<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    describeMatch,
    hasDiscovery,
    indentClass,
    type LineBlock,
    type ScalarDisplay,
    type ScalarRow,
    type SourceSlice,
    type UnknownRow,
    type ValueLine
  } from '../browser/detail';
  import { documentHasUnsavedDraft } from '../browser/matchDuplication';
  import type { RawDocumentText } from '../browser/rawDocument';
  import { rawEditorRefusal } from '../browser/rawEditor';
  // The invalidation supplier below is written against `RawSaveInvalidation` and
  // is checked against `InvalidateEverySurface` where it is passed, which is the
  // prop that requires one — so no type from `../ipc/commands` is needed for it
  // beyond that one.
  import type { OpenWriteSurface, OpenWriteSurfaceKind } from '../browser/restore';
  import type {
    UnregisterWriteSurface,
    WriteSurfaceTransition
  } from '../browser/writeSurfaceRegistry';
  import type {
    ConflictModel,
    DiskAdoptionOutcome,
    ReloadConfirmation
  } from '../browser/saveOutcome';
  import type { BrowserState } from '../browser/workspace.svelte';
  import type { RawSaveInvalidation } from '../ipc/commands';
  import type { Reprojection } from '../browser/matchEditor';
  import type {
    ContentRevision,
    DocumentId,
    DocumentSummary,
    DocumentView,
    MatchId,
    MatchView
  } from '../ipc/types';
  import MatchCreator from './MatchCreator.svelte';
  import MatchDeleter from './MatchDeleter.svelte';
  import MatchDuplicator from './MatchDuplicator.svelte';
  import MatchEditor from './MatchEditor.svelte';
  import MatchMover from './MatchMover.svelte';
  import RawEditor from './RawEditor.svelte';
  import RestorePane from './RestorePane.svelte';
  import SourceText from './SourceText.svelte';
  import {
    t,
    tRawEditorRefusal,
    tContentKind,
    tDetailField,
    tHazard,
    tIpcFailure,
    tOptionGroup,
    tScalarStyle,
    tSelectionNotice,
    tTriggerKind,
    tUnknownCount,
    tUnknownReason,
    tValueKind,
    tVariableKind
  } from '../i18n';

  /*
   * The third pane of plan section 8.1: the selected snippet, field by field —
   * or, since Phase 1c-2b-2b-2, the whole text of one file instead.
   *
   * **This file is presentation.** Everything that decides what appears —
   * which rows exist, how a projected value flattens into lines, which option
   * belongs to which group, what order a variable's parameters come in — is in
   * `../browser/detail.ts`, which has a test suite.
   *
   * The reason is narrower than "markup cannot be tested", and saying it the
   * broad way would be false of this file: `DetailPane.test.ts` opts into jsdom
   * by its docblock and mounts this pane. A **model** test drives values and
   * never markup, so a rule written into one renderer is a rule that renderer's
   * own mounted suite has to carry alone — and a second renderer, or a
   * harmless-looking refactor of this one, can omit it while walking the model
   * faithfully. That, not untestability, is why the decisions live in
   * `../browser/`.
   *
   * Three rules are visible in the markup below.
   *
   * **D2u — every value printed is source text.** `ScalarView.text` and nothing
   * else. There is no checkbox anywhere in this pane and no badge derived from a
   * value: `word: on` renders as the two characters `on`. What is shown beside a
   * value is its *spelling* (`tScalarStyle`, only when the text differs from the
   * bytes) and the core's own 1.1-ambiguity flag, which is a claim about risk.
   *
   * **The three trigger fields and the five content fields are never
   * collapsed.** A match holding both a `trigger` and a `regex` is a real shape
   * — the core reports it as `Several` — and both rows are drawn. The snippet
   * list collapses them on purpose; a detail pane that did the same would hide
   * the thing it exists to show, and the 1c-1 review removed a first attempt at
   * this pane for exactly that.
   *
   * **An absent key draws nothing; a present, empty one draws a marker.** The
   * model answers `null` for a field the file does not have, so a row for it
   * never reaches this file.
   *
   * **An entry this app does not model shows its key, the *shape* of its value,
   * why it was not modelled — and, as of Phase 1c-2b-2b-1, the value's own
   * bytes.** Which of the three things goes in the `dt` — a name, the empty
   * marker, or "not a plain name" — is `describeUnknown`'s decision, not this
   * file's: an entry whose key is the empty string used to reach here as a bare
   * string and draw a blank `dt`. The value arrived on the wire at 1c-2b-2a,
   * sliced in Rust because a JavaScript string index is a UTF-16 offset and a
   * `ByteSpan` is not, and was deliberately left unread until the sentence
   * saying it was not on screen could change in the same commit. It has. The
   * four `code.unknownReason.*` sentences did **not** change and were checked
   * rather than assumed: they say the entry was recorded and is kept exactly as
   * the file writes it, which is a claim about what this app does to the file
   * and is untouched by drawing it. See `docs/decisions/1c-2a-notes.md` section
   * 12 hole 13, `docs/decisions/1c-2b-2a-notes.md` section 10, and
   * `docs/decisions/1c-2b-2b-1-notes.md`.
   *
   * **A sentence sits above the arm it is true of, never above all three.**
   * `SourceSlice` has three arms and `slice` below draws each one differently,
   * so a caption written *outside* the `{#if}` is a caption that has to be true
   * of an unreadable span as well as of a readable one. The 1c-2b-2b-1 review
   * found exactly that: `browser.detail.unknownValue` claimed the bytes were
   * "shown as the file writes it" while the `unavailable` arm underneath said
   * this app could not read them. So `unknownValue` now says only what shape the
   * value has, and the `valueAsWritten` claim — that the bytes below are the
   * file's own — sits inside the `text` arm and nowhere else. `detail.test.ts`
   * asserts that **position**, not merely that the string is used.
   *
   * **The match's own bytes are a section of their own, drawn through
   * `SourceText`.** Not a `<pre>` written here: how a byte survives *rendering*
   * — a line break counted once, a character with no glyph named rather than
   * drawn as nothing, no soft wrap that could pass for a line break — is decided
   * in `../browser/sourceText.ts`, which has a test suite, and is shared with
   * the raw YAML viewer of 1c-2b-2b-2. The scope sentence beside the heading
   * says which part of the file this is, because `source_text` stops at the
   * match's own node and a reader would otherwise take it for the snippet's
   * whole text. It describes **no syntax**: `MatchView::project` projects every
   * item of a `matches` sequence, so the item may be a flow mapping with no `-`
   * and no indentation in front of it, or an empty item whose span is
   * zero-width — measured, and recorded in
   * `docs/decisions/1c-2b-2b-1-notes.md` section 3.
   *
   * **The raw viewer is a mode of this pane, and the toggle is drawn from
   * `browser.fileTextTarget` rather than from the selection.** That is what
   * makes a file which does not *parse* reachable: it has no matches, so
   * nothing in it can be selected, and a viewer keyed on the selected snippet
   * could never show it. Why the third pane rather than the second is written
   * down in `../browser/rawDocument.ts`, with the cost — this pane now has two
   * subjects, and the toggle says which one it is about to show.
   *
   * **The four arms of the file's text are four different facts and are drawn
   * as four.** A file this app cannot decode must not look like an empty one:
   * `notUtf8` is a typed refusal carrying the byte offset of the first invalid
   * sequence, and `RawDocumentText`'s `refused` arm renders it through
   * `tIpcFailure` under a sentence saying the text cannot be shown. `empty`
   * says the file holds no characters, which is a fact about the file;
   * `loading` says the read is still running. Only the `text` arm claims the
   * bytes are the file's own, and it claims it **inside** that arm — the
   * 1c-2b-2b-1 review's first finding, applied to a second surface.
   *
   * **The one judgement in this pane is a refusal, never a permission.**
   * `matchEditability` answers `unrestricted` for most matches and this file
   * draws **nothing** for that arm on purpose: Phase 1 is read-only, so "this
   * snippet can be edited safely" is a promise about an editor the reader
   * cannot reach. A refusal is different — the mutation entry point really does
   * refuse (`EditError::Refused`), and the snippet list already carries the
   * `Not editable` badge for the same fact. What this pane adds is the *reason*.
   *
   * **The raw *editor* is a third subject of this pane, and it outranks the other
   * two while it is open.** Phase 2c-1b makes the raw viewer's file editable, and
   * an editor holding unsaved text may not be dismissed by a click somewhere else
   * in the window: the `{#if}` below therefore tests `editing` **before** it tests
   * the viewer or the selection, so moving the sidebar leaves the editor where it
   * is rather than discarding a draft silently. Leaving is the editor's own
   * control, and it asks before discarding anything.
   *
   * **The base revision is the one captured with the text, never one read now.**
   * `document_text` answers a string and no revision, so the two come from
   * different reads, and reading the projection's revision *at the moment the
   * editor opens* is the version of this that the 2c-1b review found wrong: a
   * projection can be replaced under a held snapshot, so the editor could pair text
   * from one revision with a base from a later one and commit over it.
   * `BrowserState.fileTextRevision` is the revision that was captured when that
   * text read started, and it states in full both what that forces and what it
   * still does not.
   */

  const { browser }: { browser: BrowserState } = $props();

  /** What one open editing session is over: which file, from which revision. */
  interface EditingSession {
    /** The file being edited. */
    readonly file: DocumentSummary;
    /** The revision its text was drafted from. */
    readonly baseRevision: ContentRevision;
    /** Its whole text at that moment. */
    readonly text: string;
  }

  // `$state.raw`: an editing session is captured once and replaced whole, and
  // nothing reads through it reactively.
  let editing = $state.raw<EditingSession | null>(null);

  /**
   * Installs the disk observation a conflict carried, for every write surface.
   *
   * **This replaced the raw editor's `diskText` prop, and the replacement is the
   * point.** That prop carried `browser.rawTextOf(id)` — a text from a *second*
   * read, kept by document — so that a conflict on file A could still show and
   * load the version on disk while the window pointed at file B. The requirement
   * is now met by the conflict payload itself: `ConflictModel.diskText` travels
   * with the outcome, revision-bound, and no click anywhere in this window can
   * move it. What a surface needs from here is the other half — the one
   * transition that installs the disk projection — and each calls it from inside
   * its own reload transition, so the window and the session move together.
   *
   * **It forwards the answer**, which is what keeps the refusal honest: the
   * method says what became of the request, and every surface's reload declines to
   * close or reseed on a `refused` — while treating `alreadyThere` as done. A wrapper returning `void` would
   * have thrown that answer away. It is a function rather than a captured
   * reference because `browser` is a prop, and a reference taken at the top level
   * would freeze whichever state was passed first.
   *
   * @typeParam T - The drafted value the conflict retained.
   * @param conflict - The conflict being resolved.
   * @param confirmation - What was issued for that conflict.
   * @returns What became of the request.
   */
  function adoptDiskVersion<T>(
    conflict: ConflictModel<T>,
    confirmation: ReloadConfirmation
  ): DiskAdoptionOutcome {
    return browser.adoptDiskVersion(conflict, confirmation);
  } // End of function adoptDiskVersion()

  /**
   * Opens the editor over the file's text as it is on screen right now.
   *
   * @param file - The file the viewer is pointed at.
   * @param baseRevision - The revision captured when that text was read. Never one
   *   read now: see this file's own note, and `BrowserState.fileTextRevision`.
   * @param shown - What the viewer is showing of its text.
   */
  function startEditing(
    file: DocumentSummary,
    baseRevision: ContentRevision,
    shown: RawDocumentText
  ): void {
    // A file of zero characters is editable; a file whose text could not be read
    // at all is not, because there would be nothing to send but an invention.
    const text = shown.kind === 'text' ? shown.text : shown.kind === 'empty' ? '' : null;
    if (text === null) {
      return;
    }
    editing = { file, baseRevision, text };
  } // End of function startEditing()

  /** What one open small-editor session is over: which snippet, in which file. */
  interface MatchEditingSession {
    /** The snippet being edited, as it was projected when the editor opened. */
    readonly match: MatchView;
    /**
     * The file it lives in, **captured with it**.
     *
     * The 2c-2-2 review's first finding, and it was a High. `file` was passed as
     * `browser.selectedDocument`, which stays reactive: opening the editor over a
     * snippet of file A and then clicking anything in file B moved the *name* on
     * the editor's header to B while `session.match` — and therefore every byte
     * the save would write — still pointed at A. A screen naming one file while
     * writing another is the worst kind of wrong this application can be, and no
     * amount of care inside `MatchEditor.svelte` could have prevented it, because
     * the value was arriving already wrong. `RawEditor` never had the defect: its
     * `file` prop has always been a captured `DocumentSummary`.
     */
    readonly file: DocumentSummary | null;
  }

  // The session the small editor is open over, or `null`. `$state.raw` for the
  // reason above: a projection is captured once and replaced whole, and the
  // editor owns the draft from then on.
  let editingMatch = $state.raw<MatchEditingSession | null>(null);

  /**
   * The freshly projected snippet of one identity, or why there is none.
   *
   * What `MatchEditorView.needsReprojection` asks the caller for, answered from
   * the selection because `BrowserState.saveMatch` has already re-read the file
   * and re-pointed the selection at the identity the commit answered with. All
   * three fields are compared rather than the node alone: a person who clicked
   * another snippet while the save was in flight keeps their click, and the
   * editor is told this window has no projection to give it rather than being
   * silently re-seeded from a different snippet.
   *
   * **The three refusals are three different facts about this window**, and that
   * is the confirmation pass's third finding: the editor drew one sentence saying
   * the window had moved to another file, which is false for the person who
   * selected another snippet in *this* file and false again after a commit whose
   * adoption dropped the projection. Each branch below now says what actually
   * happened.
   *
   * @param id - The identity the editor now holds.
   * @returns That snippet's projection, or the reason there is none.
   */
  function reprojectMatch(id: MatchId): Reprojection {
    const held = browser.selectedMatch;
    if (held === null) {
      // Nothing is selected at all — the state after a commit whose adoption
      // failed, which drops everything this window held for that file.
      return { kind: 'unavailable', reason: 'notProjected' };
    }
    if (held.id.document !== id.document) {
      return { kind: 'unavailable', reason: 'otherFile' };
    }
    if (held.id.node !== id.node) {
      return { kind: 'unavailable', reason: 'otherSnippet' };
    }
    // Same file and same node at a revision this session did not adopt: this
    // window holds *a* reading of the snippet, but not the one the editor is in
    // step with, so it is no fresher than what the session already has.
    return held.id.revision === id.revision
      ? { kind: 'projected', match: held }
      : { kind: 'unavailable', reason: 'notProjected' };
  } // End of function reprojectMatch()

  /** What one open deletion is over: which snippet, of which parse, in which file. */
  interface MatchDeletingSession {
    /**
     * The file's projection, captured **in the same assignment** as the snippet.
     *
     * `startMatchDeletion` checks the two against each other and refuses a pair
     * this projection does not describe, so taking them from two reads would turn
     * a real deletion into a `notInDocument` refusal — or, worse if the check ever
     * loosened, into a deletion decided against a parse nobody was shown.
     */
    readonly projection: DocumentView;
    /** The snippet being deleted, as it was projected when the panel opened. */
    readonly match: MatchView;
    /** The file it lives in, for the person to see which one it is. */
    readonly file: DocumentSummary | null;
  }

  // The deletion panel's session, or `null`. `$state.raw` for the reason the
  // small editor's is: the three values are captured once and replaced whole, and
  // the panel owns the confirmation from then on.
  let deletingMatch = $state.raw<MatchDeletingSession | null>(null);

  /** What one open move is over: which snippet, of which parse, in which file. */
  interface MatchMovingSession {
    /**
     * The file's projection, captured **in the same assignment** as the snippet.
     *
     * `startMatchMove` checks the two against each other and refuses a pair this
     * projection does not describe, exactly as `startMatchDeletion` does, and it
     * additionally derives the whole destination list from it — so taking the two
     * from two reads would offer anchors from one parse for a snippet addressed in
     * another.
     */
    readonly projection: DocumentView;
    /** The snippet being moved, as it was projected when the panel opened. */
    readonly match: MatchView;
    /** The file it lives in, for the person to see which one it is. */
    readonly file: DocumentSummary | null;
  }

  // The move panel's session, or `null`. `$state.raw` for the reason the deletion
  // panel's is: the three values are captured once and replaced whole, and the
  // panel owns the destination from then on.
  let movingMatch = $state.raw<MatchMovingSession | null>(null);

  /** What one open duplicate is over: which snippet, of which parse, in which file. */
  interface MatchDuplicatingSession {
    /**
     * The file's projection, captured **in the same assignment** as the snippet.
     *
     * `startMatchDuplication` checks the two against each other and refuses a pair
     * this projection does not describe, exactly as `startMatchMove` does — and
     * the copy is planned from the sequence position that one parse gives the
     * snippet, so taking the two from two reads would copy the bytes at a position
     * read off a parse nobody was shown.
     */
    readonly projection: DocumentView;
    /** The snippet being copied, as it was projected when the panel opened. */
    readonly match: MatchView;
    /** The file it lives in, for the person to see which one it is. */
    readonly file: DocumentSummary | null;
  }

  // The duplicate panel's session, or `null`. `$state.raw` for the reason the move
  // panel's is: the three values are captured once and replaced whole, and the
  // panel owns the acknowledgement from then on.
  let duplicatingMatch = $state.raw<MatchDuplicatingSession | null>(null);

  // Whether the new-snippet form is open. It is a flag rather than a captured
  // value because the form captures nothing from this pane: `MatchCreator` reads
  // the files, the projections and the held selection through functions, so that
  // a re-seed after a committed create sees what the window has just re-read.
  let creating = $state(false);

  /**
   * The file the open new-snippet form has chosen, or `null`.
   *
   * **The one piece of a write surface's identity this pane does not own** — Phase
   * 2d-5-2b. Every other surface is opened *over* something this pane captured, so
   * the file it would write is in the session beside it; the form asks which file
   * itself, so the answer has to come back up. `MatchCreator.reportDestination` is
   * what carries it, and this is where it lands.
   *
   * **`null` is `unknown`, not "closed"**: {@link creating} says whether the form
   * is open at all, and the two are separate because a form that is open and has
   * chosen nothing is exactly the state `OpenWriteSurface` models with an unknown
   * target.
   *
   * **Reset when the form opens as well as when it closes**, so a value reported by
   * a previous form cannot describe the next one. The form reports its own initial
   * choice on mount — it may have one, since `startMatchCreation` defaults the
   * destination from the held selection — but that report arrives when the child's
   * effect flushes, and a stale value left here would describe this surface until
   * it did.
   */
  let creatorDestination = $state.raw<DocumentId | null>(null);

  /**
   * Opens the new-snippet form over no chosen destination.
   *
   * A named function rather than two assignments in the markup so that the flag
   * and the destination cannot be moved apart: opening the form without clearing
   * the destination is exactly the stale-value case {@link creatorDestination}
   * describes.
   */
  function startCreating(): void {
    creatorDestination = null;
    creating = true;
  } // End of function startCreating()

  /**
   * Closes the new-snippet form and forgets the file it had chosen.
   *
   * The other half of {@link startCreating}, for the same reason.
   */
  function stopCreating(): void {
    creating = false;
    creatorDestination = null;
  } // End of function stopCreating()

  /**
   * What one open restore is over: which file, of which parse, and what this
   * window had loaded of its text.
   */
  interface RestoringSession {
    /**
     * The file's projection, captured **in the same assignment** as the file and
     * the loaded text.
     *
     * `startRestore` takes the base revision off it, and that revision is the
     * only thing standing between a replacement and silently overwriting whatever
     * has changed the file since (consult Q1 item 3). Taking the three from three
     * reads would let this pane name one file, measure against another parse and
     * show a third file's bytes — the 2c-2-2 High, three ways at once.
     */
    readonly projection: DocumentView;
    /** The file it is a projection of, for the person to see which one it is. */
    readonly file: DocumentSummary;
    /**
     * What this window had loaded of that file's text, or `null`.
     *
     * **Captured, never read live.** `browser.fileText` follows
     * `browser.fileTextTarget`, which a click in the sidebar moves; the restore
     * pane draws this as *what this window loaded of this file*, and a live
     * reader would make that sentence false the moment the person clicked
     * elsewhere.
     */
    readonly loaded: RawDocumentText | null;
  }

  // The restore pane's session, or `null`. `$state.raw` for the reason the other
  // panels' sessions are: the three values are captured once and replaced whole,
  // and the pane owns the catalogue and the confirmation from then on.
  let restoring = $state.raw<RestoringSession | null>(null);

  /**
   * Opens the restore pane over one file, its parse and its loaded text.
   *
   * A named function rather than an assignment in the markup so the three values
   * are captured in **one** statement and TypeScript can see the null check on
   * the projection — a file this window could not read has none, and
   * `startRestore` has no base revision to take from nothing.
   *
   * @param parse - The file's projection, or `null` when this window holds none.
   * @param into - The file itself.
   * @param shown - What the viewer is showing of its text.
   */
  function startRestoring(
    parse: DocumentView | null,
    into: DocumentSummary,
    shown: RawDocumentText
  ): void {
    if (parse === null) {
      return;
    }
    restoring = { projection: parse, file: into, loaded: shown };
  } // End of function startRestoring()

  /**
   * One of this pane's write surfaces while it is open, or `null` while it is
   * not.
   *
   * `null` is *this kind is not open*, and it is a different fact from an
   * `unknown` target, which is *this kind is open and names no file*. Only the
   * new-snippet form can be in the second state.
   */
  type PaneWriteSurface = OpenWriteSurface | null;

  /**
   * This pane's seven write surfaces, keyed by kind.
   *
   * **The exhaustive assembly consult Q1 rules**
   * (`docs/reviews/phase-2d-5-design.md:39-45`), and the whole reason the type is
   * written out here rather than inferred: every member of
   * `OpenWriteSurfaceKind` has to appear, so **deleting a key from
   * {@link openSurfaces} — or adding an eighth kind to the union and not adding a
   * key here — is a compile error in this file**, which is the composition file
   * and the only place that knows what this window can have open.
   *
   * **`OpenWriteSurface & { kind: K }` rather than a second copy of the union.**
   * It intersects the shipped union with the key, so each entry can only be a
   * surface *of the kind it is filed under*: the six non-creator keys reduce to
   * the arm that requires a file, and `matchCreator` reduces to the arm that
   * allows `unknown`. Writing the seven arms out again would be a second
   * definition of `OpenWriteSurface` that can drift from the first.
   *
   * **What that forces, and what it does not.** It forces that every kind is
   * mentioned and that no entry can describe another kind's surface; it does
   * **not** force that the value filed under a key is *true* — a key wired to the
   * wrong session, or to a document identity taken from the wrong side of a
   * session, type-checks perfectly. `DetailPane.test.ts` opens each of the seven
   * and reads back what the registry holds, which is the only thing that can
   * catch that.
   */
  type PaneWriteSurfaces = {
    readonly [K in OpenWriteSurfaceKind]: (OpenWriteSurface & { readonly kind: K }) | null;
  };

  /**
   * What this pane has open, kind by kind.
   *
   * **Two checks, and they overlap deliberately.** The `satisfies
   * Record<OpenWriteSurfaceKind, PaneWriteSurface>` is the construction check the
   * consult names, written where a reader looks for it; the annotation is what
   * additionally ties each entry to its own key, which a `Record` with one value
   * type cannot express. Either one alone turns a missing key into a compile
   * error.
   *
   * **This is the only place in this file that builds an `OpenWriteSurface`.**
   * Until 2d-5-2b the pane assembled a second list of its own and handed it
   * straight to the restore, so the registry and the pane answered one question
   * twice — `2d-5-2a-notes.md` section 7 item 5. The restore now reads
   * `browser.openWriteSurfaces()`, and what puts anything in there is
   * {@link reconcileWriteSurfaces} below, walking this value.
   *
   * **Five of the old producer's six entries could not execute at all**, in
   * production or in any test — 2d-5-1-C's measurement, quoted rather than
   * re-derived: its one caller sat inside the `{:else if restoring !== null}` arm,
   * so `restoring` was non-null and {@link busy} had already made the other five
   * null. Nothing here is conditioned on which arm is being drawn, so all seven
   * entries are live. **What `busy` still means for the live set** is that at most
   * one of them is non-null at a time, so the registry holds at most one entry from
   * this pane and its documented array order decides nothing here.
   */
  const openSurfaces: PaneWriteSurfaces = $derived({
    matchEditor:
      editingMatch === null
        ? null
        : {
            kind: 'matchEditor',
            target: { kind: 'document', document: editingMatch.match.id.document }
          },
    matchCreator: !creating
      ? null
      : {
          kind: 'matchCreator',
          target:
            creatorDestination === null
              ? { kind: 'unknown' }
              : { kind: 'document', document: creatorDestination }
        },
    matchDeleter:
      deletingMatch === null
        ? null
        : {
            kind: 'matchDeleter',
            target: { kind: 'document', document: deletingMatch.projection.id }
          },
    matchMover:
      movingMatch === null
        ? null
        : {
            kind: 'matchMover',
            target: { kind: 'document', document: movingMatch.projection.id }
          },
    matchDuplicator:
      duplicatingMatch === null
        ? null
        : {
            kind: 'matchDuplicator',
            target: { kind: 'document', document: duplicatingMatch.projection.id }
          },
    rawEditor:
      editing === null
        ? null
        : { kind: 'rawEditor', target: { kind: 'document', document: editing.file.id } },
    restore:
      restoring === null
        ? null
        : { kind: 'restore', target: { kind: 'document', document: restoring.projection.id } }
  } satisfies Record<OpenWriteSurfaceKind, PaneWriteSurface>);

  /**
   * What this pane holds for one kind it has registered.
   *
   * The surface is kept beside the lease so that {@link reconcileWriteSurfaces}
   * can tell *nothing changed* from *the file moved* without asking the registry,
   * which answers a snapshot rather than one kind's entry.
   */
  interface HeldRegistration {
    /** The surface this pane last asked the registry to hold for this kind. */
    readonly surface: OpenWriteSurface;
    /** The lease that registration answered. */
    readonly lease: UnregisterWriteSurface;
  }

  /**
   * The leases this pane holds, by kind.
   *
   * **Deliberately not reactive.** It is this pane's own bookkeeping about calls
   * it has already made, read by one effect and by the teardown; making it `$state`
   * would make the effect that writes it depend on it, which is a loop.
   */
  const heldRegistrations = new Map<OpenWriteSurfaceKind, HeldRegistration>();

  /**
   * What a registered surface is told about an external observation of its file.
   *
   * **A no-op, and the same one for all seven kinds** — Phase 2d-5-2b. Nothing
   * invokes a stored transition anywhere in this repository: `transitionFor` is the
   * only reader and it has no caller until 2d-5-4 routes an admitted observation to
   * the surface a reload would strand. Writing seven different bodies now would be
   * seven claims about a protocol that does not exist, and any body that *did*
   * something would be inventing it.
   *
   * **What it will do when it stops being inert, said now rather than discovered
   * later.** Under consult Q5 the coordinator installs no projection when a surface
   * may target the document and hands the observation to that surface instead — so
   * with this body the person's draft survives and they are never told the file
   * moved. That is the conservative half of the rule and the wrong half of the
   * answer, and replacing it is 2d-5-4's and 2d-5-5's work rather than a defect
   * here.
   */
  const tellNobodyYet: WriteSurfaceTransition = () => undefined;

  /**
   * Whether two targets name the same thing.
   *
   * A file compares by identity; two unknown targets are the same state. It has to
   * be written over the discriminant first, because only one arm of
   * `WriteSurfaceTarget` has a `document` to compare at all — which is the shape
   * `restore.ts` chose over an optional field, and for the same reason: an
   * `undefined` equal to an `undefined` would have made *names no file* and *names
   * this file* look like one answer.
   *
   * @param one - One target.
   * @param other - The other.
   * @returns Whether they say the same thing.
   */
  function sameTarget(one: OpenWriteSurface['target'], other: OpenWriteSurface['target']): boolean {
    if (one.kind === 'document' && other.kind === 'document') {
      return one.document === other.document;
    }
    return one.kind === other.kind;
  } // End of function sameTarget()

  /**
   * Registers one surface and records the lease it answers.
   *
   * **`registerWriteSurface` throws a `TypeError` on a pairing `OpenWriteSurface`
   * cannot represent, and a throw on a mount path is a blank pane** — which this
   * project has shipped once (R32). No value that reaches this function can be
   * such a pairing, and the argument is about construction rather than about care:
   * every surface here comes from {@link openSurfaces}, whose entries are object
   * literals written in this file, checked against the shipped union by
   * {@link PaneWriteSurfaces}, and built with no cast and no assertion. The
   * registry's refusal fires on what a *read* answers rather than on what was
   * declared, and neither read can run anything here — the seven sources are
   * `$state.raw` or a boolean, so no reactive proxy stands between the registry
   * and a plain data property, and none of these objects has an accessor.
   *
   * **What that says and what it does not.** It says no production path in this
   * pane can reach the throw. It does not say the throw is unreachable: a caller
   * that takes a kind and a target apart and reconciles them with a cast reaches
   * it, which is the caller the registry's own `@throws` describes.
   *
   * @param surface - The surface to register.
   */
  function registerSurface(surface: OpenWriteSurface): void {
    heldRegistrations.set(surface.kind, {
      surface,
      lease: browser.registerWriteSurface(surface, tellNobodyYet)
    });
  } // End of function registerSurface()

  /**
   * Brings the registry into step with {@link openSurfaces}.
   *
   * **A reconciliation rather than a re-registration.** This runs on every change
   * to any of the seven sessions — a keystroke in the raw editor replaces
   * {@link openSurfaces} whole — and every registration moves the registry's
   * generation, which consult Q5 makes a coordinator's guard. Tearing down and
   * rebuilding here would move that counter for changes nobody made. What this does
   * instead is ask the registry for exactly the three differences that can exist: a
   * kind that has been opened, one that has been closed, and one whose file has
   * moved.
   *
   * **The values are walked, not the keys.** `Object.values` gives entries whose
   * own `kind` the type has already tied to the key they were filed under, so the
   * registry is keyed by the surface rather than by a string this function would
   * have to widen with a cast.
   *
   * **A moved file goes through `replaceTarget`, in place**, which is what the
   * lease exists for: the entry keeps its key, its position and its transition, and
   * the new-snippet form's unknown-to-known step is exactly this case. **Its answer
   * is read** — a consuming operation whose result is discarded is this project's
   * named silent-success defect class — and `staleLease` means a newer registration
   * of that kind displaced this pane's, in which case this pane re-registers rather
   * than believing a report that did not land.
   *
   * **Going back to naming no file is a re-key and cannot be anything else**:
   * `replaceTarget` takes the document arm only, which the registry's own comment
   * argues for, so a form whose destination is taken back unregisters and registers
   * again. That moves the generation twice and sends the entry to the end of the
   * reader's order; neither changes any answer either predicate gives.
   *
   * @param wanted - What this pane has open right now.
   */
  function reconcileWriteSurfaces(wanted: PaneWriteSurfaces): void {
    const open = new Map<OpenWriteSurfaceKind, OpenWriteSurface>();
    const entries: readonly PaneWriteSurface[] = Object.values(wanted);
    for (const surface of entries) {
      if (surface !== null) {
        open.set(surface.kind, surface);
      }
    } // End of the loop over the assembly's seven entries
    for (const kind of [...heldRegistrations.keys()]) {
      if (!open.has(kind)) {
        heldRegistrations.get(kind)?.lease();
        heldRegistrations.delete(kind);
      }
    } // End of the loop over the kinds this pane had registered
    for (const [kind, surface] of open) {
      const current = heldRegistrations.get(kind);
      if (current === undefined) {
        registerSurface(surface);
        continue;
      }
      if (sameTarget(current.surface.target, surface.target)) {
        continue;
      }
      if (surface.target.kind !== 'document') {
        // A destination taken back. The lease cannot express it, so this is a
        // re-key. The old lease is returned before the new registration for
        // legibility rather than for correctness: doing it the other way round
        // would displace this entry and leave an inert lease, which the registry
        // ignores — the end state is the same and the reading is worse.
        current.lease();
        registerSurface(surface);
        continue;
      }
      if (current.lease.replaceTarget(surface.target) === 'replaced') {
        heldRegistrations.set(kind, { surface, lease: current.lease });
        continue;
      }
      // `staleLease`: something displaced this pane's registration of this kind.
      // Nothing in this window does that today, and believing the report landed is
      // the defect either way.
      registerSurface(surface);
    } // End of the loop over the kinds this pane has open
  } // End of function reconcileWriteSurfaces()

  /*
   * **The registration itself.** An effect rather than a call in each opener and
   * each closer: there are seven of the first and more than seven of the second —
   * a `close` prop on six components, {@link invalidateEverySurface}, and the
   * form's own re-seed — and a rule spread over that many call sites is a rule one
   * of them can omit, with no type to notice. Reading {@link openSurfaces} here is
   * what subscribes this to every one of them.
   *
   * **No cleanup is returned**, deliberately. An effect's cleanup runs before each
   * re-run as well as at teardown, so returning the disposal would return every
   * lease this pane holds and take them out again whenever anything moved — a
   * keystroke in the raw editor replaces {@link openSurfaces} whole — which is the
   * churn {@link reconcileWriteSurfaces} exists to avoid. Teardown is `onDestroy`
   * below.
   */
  $effect(() => {
    reconcileWriteSurfaces(openSurfaces);
  });

  /*
   * **Disposal, which no type can force.** `UnregisterWriteSurface` is callable so
   * that a host can return it straight from a cleanup; this one is a loop instead,
   * because {@link heldRegistrations} is keyed by kind and this pane reconciles it
   * rather than owning a single registration for the life of one effect. **How many
   * leases it actually holds is one**, since {@link busy} keeps the seven mutually
   * exclusive — the loop is written over the map rather than over that coincidence.
   * Nothing in TypeScript makes a host call any of them: a pane that dropped its
   * leases would leave its surfaces registered for the life of the window, and
   * `DetailPane.test.ts` is what establishes that this one does not.
   */
  onDestroy(() => {
    for (const registration of heldRegistrations.values()) {
      registration.lease();
    } // End of the loop over every lease this pane holds
    heldRegistrations.clear();
  });

  /**
   * Closes every write surface over a file whose whole text has just been
   * replaced.
   *
   * **Consult Q4's post-commit rule, discharged here because only this pane can
   * discharge it.** A committed whole-document replacement makes every `MatchId`
   * in that file stale at once, so a panel still holding one is holding an
   * address that names nothing; the pre-send open-surface refusal is an
   * affordance, because a surface can open after the preview, and this is the
   * half that actually holds. It is **synchronous and total**, for
   * `ForgetReplacedDocument`'s reason: an asynchronous one leaves a window in
   * which a getter still reads identities minted from bytes that are gone.
   *
   * **The restore pane itself is not closed**, and that is deliberate: it is
   * where the outcome of the write is drawn, and `RestoreSession.restored`
   * already stops it offering to replace anything again.
   *
   * **The new-snippet form is closed whatever file it names, and the reason has
   * changed at 2d-5-2b.** It used to be that this pane could not learn which file
   * the form had chosen; it can now — {@link creatorDestination} is exactly that,
   * reported upward so the form can be registered as a surface over a file. What
   * has not changed is that the form may have chosen **no** file, which is a state
   * no comparison against the replaced document can exclude, so closing it
   * whichever file it names is still the conservative direction and is still what
   * happens. It costs nothing today either way, because {@link busy} means the form
   * cannot be open while a restore is. **Narrowing this to the replaced file is a
   * behaviour change with a live consequence** — a form over another file would
   * survive a restore — and it is not taken here.
   *
   * **What no type forces**, in the same sentence as what one does:
   * `InvalidateEverySurface` forces that a caller supplies a body and never that
   * the body closes anything, so what is written here is the whole of the
   * guarantee. A throw would come back beside the committed outcome and never
   * unwrite the file.
   *
   * @param invalidation - The file that was replaced and the revision it holds
   *   now.
   */
  function invalidateEverySurface(invalidation: RawSaveInvalidation): void {
    const replaced = invalidation.document;
    if (editing !== null && editing.file.id === replaced) {
      editing = null;
    }
    if (editingMatch !== null && editingMatch.match.id.document === replaced) {
      editingMatch = null;
    }
    if (deletingMatch !== null && deletingMatch.projection.id === replaced) {
      deletingMatch = null;
    }
    if (movingMatch !== null && movingMatch.projection.id === replaced) {
      movingMatch = null;
    }
    if (duplicatingMatch !== null && duplicatingMatch.projection.id === replaced) {
      duplicatingMatch = null;
    }
    stopCreating();
  } // End of function invalidateEverySurface()

  /**
   * The snippet this window is holding unsaved edits for, or `null`.
   *
   * **`moveEligibility`'s `unsavedDraftFor` argument, and the whole of what this
   * pane can honestly answer.** A committed move gives the snippet a new identity,
   * which strands a draft addressed to the old one, so `matchMove.ts` refuses the
   * move — this application's workflow policy rather than the file refusing
   * (consult correction 2).
   *
   * **It over-refuses, deliberately, and that is the R36 decision.** This pane
   * cannot see inside `MatchEditor.svelte`, so it answers the identity of the
   * snippet an editor is open over *at all*, dirty or not. Over-refusing costs a
   * person one closed editor; under-refusing strands edits, and there is no
   * relation in this application that can follow an open draft to its snippet
   * across a reparse — `identityInProjection` resolves by arena node alone and
   * would answer a **different** snippet's identity, which is the defect a
   * previous round shipped. So the conservative refusal is what is implemented and
   * a coordinator is not.
   *
   * **Today it always answers `null` while a move panel is open**, and that is a
   * fact about this pane rather than about the rule: the seven write surfaces are
   * mutually exclusive through {@link busy}, so a snippet with an open editor is
   * not offered a move in the first place — which is the same conservative refusal
   * reached one step earlier. The wiring is here so the model's own arm becomes
   * live the first moment that stops being true, and `MatchMover.test.ts` is what
   * drives the non-null case.
   *
   * @returns The identity, as the editor's own captured projection gives it, or
   *   `null`.
   */
  function unsavedDraftFor(): MatchId | null {
    return editingMatch === null ? null : editingMatch.match.id;
  } // End of function unsavedDraftFor()

  /**
   * Every snippet this window has a match editor open over.
   *
   * A list of at most one today, because this pane holds one small-editor
   * session and {@link busy} keeps the write surfaces mutually exclusive. It is
   * a list rather than a nullable identity because the question the model asks
   * is plural — *any* draft in the file — and a second concurrent editor would
   * then be a value added here rather than a rule rewritten in two places.
   *
   * **What it answers is "a draft is open", not "a draft is dirty"**, which is
   * the same R36 over-refusal {@link unsavedDraftFor} records: `isDirty` lives
   * inside `MatchEditor.svelte`'s own session and this pane cannot see it.
   *
   * @returns The identities, or an empty list.
   */
  function openMatchDrafts(): readonly MatchId[] {
    return editingMatch === null ? [] : [editingMatch.match.id];
  } // End of function openMatchDrafts()

  /**
   * Whether this window has a match editor open over any snippet of one file.
   *
   * **`duplicationEligibility`'s third argument, and document-wide on purpose**
   * (consult Q6): a committed duplicate mints a new revision and invalidates
   * every `MatchId` in the file, so a draft held for *any* snippet of it — not
   * only the one being copied — would be stranded by the commit. The comparison
   * itself is `documentHasUnsavedDraft` in `../browser/matchDuplication.ts`,
   * where a test can reach it; what is here is only the pane's own knowledge of
   * which editors are open.
   *
   * **It answers "open", never "dirty", and the refusal's sentence says so.**
   * That is {@link openMatchDrafts}'s R36 over-refusal carried up: a pristine
   * editor makes this `true`, which is correct, and
   * `browser.matchDuplication.refused.unsavedDraftInDocument` therefore claims
   * an open editor and that this application cannot tell whether anything was
   * edited — never that unsaved edits exist.
   *
   * **Today it always answers `false` while a duplicate panel is open**, exactly
   * as {@link unsavedDraftFor} always answers `null` while a move panel is: the
   * write surfaces are mutually exclusive through {@link busy}, so a file with an
   * open editor is not offered a duplicate in the first place — the same
   * conservative refusal reached one step earlier. The wiring is here so the
   * model's own arm becomes live the first moment that stops being true, and
   * `MatchDuplicator.test.ts` is what drives the `true` case.
   *
   * @param document - The file a duplicate would be written to.
   * @returns `true` when this window has a match editor open over that file.
   */
  function unsavedDraftInDocument(document: DocumentId): boolean {
    return documentHasUnsavedDraft(document, openMatchDrafts());
  } // End of function unsavedDraftInDocument()

  /**
   * The projection this window holds of one file, or `null`.
   *
   * A lookup and not a decision: `BrowserState.views` holds one entry per file
   * that *read*, so a file whose `get_document` refused has none. The deletion
   * panel needs one, which is why its control is drawn only when this answers.
   *
   * @param id - The file to look for.
   * @returns Its projection, or `null`.
   */
  function projectionOf(id: number): DocumentView | null {
    return browser.views.find((view) => view.id === id) ?? null;
  } // End of function projectionOf()

  /**
   * Whether one of this pane's seven write surfaces is open.
   *
   * They outrank the pane's read-only subjects and each other: a draft, a pending
   * confirmation, a chosen destination, an acknowledgement on screen or a save in
   * flight may not be dismissed by a click somewhere else in the window, so the
   * openers below are withdrawn while any of them is showing rather than drawn
   * beside it.
   *
   * **This is also where the R36 refusal is actually enforced**: a snippet whose
   * draft is open — whether or not that draft's identity is still live — cannot be
   * moved or duplicated, because neither panel can be opened while the small
   * editor is. {@link unsavedDraftFor} and {@link unsavedDraftInDocument} state
   * the same rule one level down for the day this exclusion stops holding.
   */
  const busy = $derived(
    editing !== null ||
      editingMatch !== null ||
      deletingMatch !== null ||
      movingMatch !== null ||
      duplicatingMatch !== null ||
      restoring !== null ||
      creating
  );
</script>

{#snippet scalarText(display: ScalarDisplay)}
  <span class="value">
    {#if display.empty}
      <span class="marker">{t('browser.detail.emptyText')}</span>
    {:else}
      <pre class="source">{display.scalar.text}</pre>
    {/if}
    {#if display.style !== null}
      <span class="marker">{tScalarStyle(display.style)}</span>
    {/if}
    {#if display.ambiguous}
      <span class="marker warn" title={t('browser.detail.ambiguousDetail')}>
        {t('browser.detail.ambiguous')}
      </span>
    {/if}
  </span>
{/snippet}

{#snippet slice(one: SourceSlice)}
  {#if one.kind === 'text'}
    <span class="marker">{t('browser.detail.valueAsWritten')}</span>
    <SourceText text={one.text} />
  {:else if one.kind === 'empty'}
    <span class="marker">{t('browser.detail.emptyText')}</span>
  {:else}
    <span class="marker warn">{t('browser.detail.valueUnavailable')}</span>
  {/if}
{/snippet}

{#snippet fileText(view: RawDocumentText)}
  {#if view.kind === 'text'}
    <span class="marker">{t('browser.detail.fileTextAsWritten')}</span>
    <SourceText text={view.text} documentStart />
  {:else if view.kind === 'empty'}
    <span class="marker">{t('browser.detail.fileTextEmpty')}</span>
  {:else if view.kind === 'loading'}
    <p class="kind">{t('browser.detail.fileTextLoading')}</p>
  {:else}
    <div class="refused">
      <p>{t('browser.detail.fileTextUnavailable')}</p>
      <p>{tIpcFailure(view.failure)}</p>
    </div>
  {/if}
{/snippet}

{#snippet rows(list: readonly ScalarRow[])}
  <dl>
    {#each list as row (row.field)}
      <dt>{tDetailField(row.field)}</dt>
      <dd>{@render scalarText(row)}</dd>
    {/each}
  </dl>
{/snippet}

{#snippet lines(list: readonly ValueLine[])}
  <ul class="lines">
    {#each list as line}
      <li class="line {indentClass(line.depth)}">
        {#if line.label.kind === 'key'}
          <span class="key">{line.label.key.text}</span>
        {:else if line.label.kind === 'unnamed'}
          <span class="marker">{t('browser.detail.unnamedKey')}</span>
        {:else if line.label.kind === 'item'}
          <span class="bullet" aria-hidden="true">•</span>
        {/if}
        {#if line.kind === 'scalar'}
          {@render scalarText(line)}
        {:else if line.kind === 'alias'}
          <span class="marker">{t('browser.detail.alias')}</span>
        {:else if line.kind === 'elided'}
          <span class="marker">
            {t('browser.detail.elided', { kind: tValueKind(line.elided.kind) })}
          </span>
        {:else if line.empty}
          <span class="marker">
            {#if line.shape === 'Sequence'}
              {t('browser.detail.emptySequence')}
            {:else}
              {t('browser.detail.emptyMapping')}
            {/if}
          </span>
        {:else}
          <span class="marker">{tValueKind(line.shape)}</span>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet block(one: LineBlock)}
  <p class="blockLabel">{tDetailField(one.field)}</p>
  {@render lines(one.lines)}
{/snippet}

{#snippet unknownEntries(entries: readonly UnknownRow[])}
  <p class="count">{tUnknownCount(entries.length)}</p>
  <dl>
    {#each entries as entry (entry.node)}
      <dt>
        {#if entry.key.kind === 'named'}
          <span class="key">{entry.key.text}</span>
        {:else if entry.key.kind === 'empty'}
          <span class="marker">{t('browser.detail.emptyText')}</span>
        {:else}
          <span class="marker">{t('browser.detail.unnamedKey')}</span>
        {/if}
      </dt>
      <dd class="unknown">
        <p class="says">
          <span class="marker"
            >{t('browser.detail.unknownValue', { kind: tValueKind(entry.valueKind) })}</span
          >
          <span>{tUnknownReason(entry.reason)}</span>
        </p>
        {@render slice(entry.value)}
      </dd>
    {/each}
  </dl>
{/snippet}

<section class="detail" aria-label={t('browser.detail.label')}>
  {#if browser.notice !== null}
    <div class="notice" role="status">
      <p>{tSelectionNotice(browser.notice)}</p>
      <button type="button" onclick={() => browser.dismissNotice()}>
        {t('browser.notice.dismiss')}
      </button>
    </div>
  {/if}

  {#if browser.fileTextTarget !== null && editing === null}
    <p class="toggle">
      <button type="button" onclick={() => void browser.showFileText(!browser.fileTextShown)}>
        {browser.fileTextShown
          ? t('browser.detail.fileTextHide')
          : t('browser.detail.fileTextShow')}
      </button>
    </p>
  {/if}

  <!-- **The new-snippet form is reachable with nothing selected**, and it has to
       be: a person whose window is showing a file that holds no snippets, or the
       "All" scope with no selection, is exactly the person adding their first
       one. The form asks which file itself rather than inheriting the selection,
       and offers every file the window lists (the consult's Q5). -->
  {#if !busy}
    <p class="toggle">
      <button type="button" onclick={startCreating}>
        {t('browser.matchCreation.open')}
      </button>
    </p>
  {/if}

  {#if editing !== null}
    {@const open = editing}
    <RawEditor
      file={open.file}
      baseRevision={open.baseRevision}
      text={open.text}
      {adoptDiskVersion}
      save={(document, baseRevision, text, acknowledgement) =>
        browser.saveRawDocument(document, baseRevision, text, acknowledgement)}
      close={() => (editing = null)}
    />
  {:else if editingMatch !== null}
    {@const open = editingMatch}
    <!-- **The three readers the recovery panel needs are functions**, for
         `MatchCreator`'s reason: a recovery form opened after this window has
         re-read anything must offer the files as they are now, not as they were
         when the editor opened. `adoptRecoveryDiskVersion` is the same generic
         method as `adoptDiskVersion`, at the other drafted value. -->
    <MatchEditor
      match={open.match}
      file={open.file}
      documents={() => browser.documents}
      projections={() => browser.views}
      save={(id, draft, baseRevision, acknowledgement) =>
        browser.saveMatch(id, draft, baseRevision, acknowledgement)}
      create={(document, newMatch, position, baseRevision, acknowledgement) =>
        browser.createMatch(document, newMatch, position, baseRevision, acknowledgement)}
      reproject={reprojectMatch}
      {adoptDiskVersion}
      adoptRecoveryDiskVersion={adoptDiskVersion}
      close={() => (editingMatch = null)}
    />
  {:else if deletingMatch !== null}
    {@const open = deletingMatch}
    <!-- **`projections` is a function, and that is the whole confirmation.** The
         panel reads the window's projections at the instant *Delete it* is
         clicked and hands `confirmDelete` the identity they give this snippet; a
         captured array would be a snapshot minted beside the consent, which is
         the pair that was found agreeing while both were stale. -->
    <MatchDeleter
      projection={open.projection}
      match={open.match}
      file={open.file}
      projections={() => browser.views}
      remove={(id, baseRevision, acknowledgement) =>
        browser.deleteMatch(id, baseRevision, acknowledgement)}
      {adoptDiskVersion}
      close={() => (deletingMatch = null)}
    />
  {:else if movingMatch !== null}
    {@const open = movingMatch}
    <!-- **`projections` is a function, and it is the whole of R37 on this
         screen.** `MatchMover` reads it **once** and derives the view, the
         destination list and the identity `beginMove` checks from that one array;
         a captured array would be a snapshot, and a snapshot is what the live
         check exists to notice. `unsavedDraftFor` is read the same way, when the
         panel opens. -->
    <MatchMover
      projection={open.projection}
      match={open.match}
      file={open.file}
      projections={() => browser.views}
      {unsavedDraftFor}
      move={(id, after, baseRevision, acknowledgement) =>
        browser.moveMatch(id, after, baseRevision, acknowledgement)}
      reload={(document) => browser.rereadDocument(document)}
      {adoptDiskVersion}
      close={() => (movingMatch = null)}
    />
  {:else if duplicatingMatch !== null}
    {@const open = duplicatingMatch}
    <!-- **`projections` is a function, for `MatchMover`'s reason.**
         `MatchDuplicator` reads it **once** and derives both the view and the
         identity `beginDuplicate` checks from that one array; a captured array
         would be a snapshot, and a snapshot is what the live check exists to
         notice. `unsavedDraftInDocument` is read the same way, when the panel
         opens, and is document-wide rather than about the copied snippet: a
         commit invalidates every `MatchId` in the file. -->
    <MatchDuplicator
      projection={open.projection}
      match={open.match}
      file={open.file}
      projections={() => browser.views}
      unsavedDraftInDocument={() => unsavedDraftInDocument(open.projection.id)}
      duplicate={(id, baseRevision, acknowledgement) =>
        browser.duplicateMatch(id, baseRevision, acknowledgement)}
      reload={(document) => browser.rereadDocument(document)}
      {adoptDiskVersion}
      close={() => (duplicatingMatch = null)}
    />
  {:else if creating}
    <!-- Every reader is a function, so a re-seed after a committed create sees
         the files as the window has just re-read them rather than as they were
         when the form opened.

         **`reportDestination` is the one prop that goes the other way**, and it is
         required for that reason (consult Q1): the destination is state that lives
         inside the child, so the only way this pane can register the form as a
         surface over a file is to be told. What it lands in is
         `creatorDestination`, which the assembly above reads. -->
    <MatchCreator
      documents={() => browser.documents}
      projections={() => browser.views}
      held={() => browser.selectedMatch?.id ?? null}
      create={(document, newMatch, position, baseRevision, acknowledgement) =>
        browser.createMatch(document, newMatch, position, baseRevision, acknowledgement)}
      {adoptDiskVersion}
      reportDestination={(document) => (creatorDestination = document)}
      close={stopCreating}
    />
  {:else if restoring !== null}
    {@const open = restoring}
    <!-- **`projections` and `surfaces` are functions, and `loadedText` is not.**
         The first two are what the restore's four gates ask the window about at
         the moment each is asked, so a captured array would be a snapshot and a
         snapshot is what the `targetMoved` refusal exists to notice. The third is
         drawn as *what this window loaded of this file*, so it has to be the
         reading that was captured with the projection: `browser.fileText` follows
         `browser.fileTextTarget`, and reading it live would move that sentence
         onto another file's bytes.

         **`surfaces` is the registry's answer since 2d-5-2b, not this pane's own
         list.** The pane used to build a second array here, so the registry and the
         pane answered one question twice and could disagree; the effect above is
         now the only thing that puts a surface anywhere, and this reads what it
         registered. The same value reaches `restoreDocument`: `RestorePane` reads
         this function once into the value it checks the confirmation against and
         sends *that* list, so the gate and the write cannot be about two
         different readings.
         **What it changes:** the pane's array was built at the instant it was
         asked, and the registry's is in step with the last effect flush — so a
         surface opened in the same synchronous block as the question is not in it
         yet. That is the direction the pre-send refusal was already an affordance
         about: what actually stands between a restore and a file another surface
         is writing is the transaction's own locked read and revision check, never
         this list.

         **The reading is live between flushes, and that took a fix.** The registry
         is a plain `Map`, so this closure gave `RestorePane`'s `$derived.by` no
         dependency that a registration moved: measured, the derived ran *before*
         this pane's registration effect, answered the empty set, and was never
         invalidated again — so a surface opened after it last ran was invisible
         both to the refusal on screen and to what `confirmRestore` was handed.
         `BrowserState.openWriteSurfaces` now reads a signal mirroring the
         registry's generation, so this closure re-runs when the live set moves.
         **`confirmRestore` re-checks the surfaces it is handed** — which is this
         same one reading, taken when the send is pressed — rather than asking the
         registry itself; that it is *current* is the mirror's doing and not
         `confirmRestore`'s. The sentence here used to say it re-asked at the
         write, which claimed a guarantee neither function gave.

         **`invalidateEverySurface` is this pane's, and it is the post-commit half
         of the open-surface rule** — the pre-send refusal is an affordance,
         because a surface can open after the preview. -->
    <RestorePane
      projection={open.projection}
      file={open.file}
      loadedText={open.loaded}
      projections={() => browser.views}
      surfaces={() => browser.openWriteSurfaces()}
      listBatches={() => browser.listBackupBatches()}
      listEntries={(batch) => browser.listBackupEntries(batch)}
      readEntry={(entry, document) => browser.readBackupText(entry, document)}
      restore={(started, surfaces, invalidate) =>
        browser.restoreDocument(started, surfaces, invalidate)}
      invalidate={invalidateEverySurface}
      {adoptDiskVersion}
      close={() => (restoring = null)}
    />
  {:else if browser.fileText !== null && browser.fileTextTarget !== null}
    {@const view = browser.fileText}
    {@const file = browser.fileTextTarget}
    {@const captured = browser.fileTextRevision}
    {@const parse = projectionOf(file.id)}

    <dl>
      <dt>{t('browser.detail.file')}</dt>
      <dd class="source">{file.relative_path}</dd>
    </dl>

    <section>
      <h2>{t('browser.detail.section.fileText')}</h2>
      <p class="kind">{t('browser.detail.fileTextScope')}</p>
      {#if file.read_only}
        <p class="kind">{t('browser.rawEditor.readOnlyFile')}</p>
      {:else if captured === null}
        <p class="kind">{t('browser.rawEditor.notProjected')}</p>
      {:else if view.kind === 'text' && rawEditorRefusal(view.text) !== null}
        {@const refused = rawEditorRefusal(view.text)}
        <!-- The *Edit* control is withdrawn rather than opening into a dead end,
             and the reason is on screen. `startRawEditor` refuses the same texts,
             so this is a control that matches the model rather than a second
             opinion about it. -->
        {#if refused !== null}
          <p class="kind">{tRawEditorRefusal(refused)}</p>
        {/if}
      {:else if view.kind === 'text' || view.kind === 'empty'}
        {@const base = captured}
        <p class="toggle">
          <button type="button" onclick={() => startEditing(file, base, view)}>
            {t('browser.rawEditor.open')}
          </button>
        </p>
      {/if}
      <!-- **The restore mode is reached from here** — the file's whole-text
           surface, which is where a whole-file replacement belongs (consult Q5)
           and the one place in this window that is about a file rather than about
           a snippet.

           **Offered whether or not this application may write the file**, for the
           reason the deletion, move and duplicate controls are: the panel says
           why it may not, inline and localized, and `restoreRefusal` is one
           ordering of reasons rather than a gate repeated here. The one gate is a
           projection to open over — `startRestore` takes the destination's base
           revision off one, and a file this window could not read has none. -->
      {#if parse !== null}
        <p class="toggle">
          <button type="button" onclick={() => startRestoring(parse, file, view)}>
            {t('browser.restore.open')}
          </button>
        </p>
      {:else}
        <p class="kind">{t('browser.restore.notProjected')}</p>
      {/if}
      {@render fileText(view)}
    </section>
  {:else if browser.selectedMatch !== null}
    {@const detail = describeMatch(browser.selectedMatch)}

    {#if browser.selectedDocument !== null}
      <dl>
        <dt>{t('browser.detail.file')}</dt>
        <dd class="source">{browser.selectedDocument.relative_path}</dd>
      </dl>
    {/if}

    {#if detail.editability.kind === 'blocked'}
      <p class="blocked">
        {t('browser.detail.notEditable', { kind: tHazard(detail.editability.hazard) })}
      </p>
    {:else if detail.editability.kind === 'blockedUnnamed'}
      <p class="blocked">{t('browser.detail.notEditableUnnamed')}</p>
    {/if}

    {#if detail.editability.kind === 'unrestricted' && browser.selectedDocument !== null && !browser.selectedDocument.read_only}
      {@const selected = browser.selectedMatch}
      {@const inFile = browser.selectedDocument}
      <!-- The *Edit* control is withdrawn rather than opening into a dead end,
           for the reason the raw editor's is: `startMatchEditor` consults the same
           `matchEditability`, and a read-only file is one this app will not write
           to at all. A snippet whose every field the projection refuses still
           opens, because the editor's own sentences are what say why.

           **The snippet and its file are captured together**, in one assignment,
           so the two cannot come from two reads and disagree afterwards. -->
      <p class="toggle">
        <button type="button" onclick={() => (editingMatch = { match: selected, file: inFile })}>
          {t('browser.matchEditor.open')}
        </button>
      </p>
    {/if}

    {#if browser.selectedDocument !== null}
      {@const target = browser.selectedMatch}
      {@const inFile = browser.selectedDocument}
      {@const parse = projectionOf(inFile.id)}
      <!-- **Offered whether or not the snippet may be deleted**, which is the
           consult's Q6: the panel says why it may not, inline and localized, and
           the core's own refusal is still the one that decides. The one gate is a
           projection to open over — `startMatchDeletion` takes a `DocumentView`,
           and a file this window could not read has none.

           **The snippet and its parse are captured in one assignment**, so the
           two cannot come from two reads and disagree afterwards. -->
      {#if parse !== null && target !== null}
        <p class="toggle">
          <button
            type="button"
            onclick={() =>
              (deletingMatch = { projection: parse, match: target, file: inFile })}
          >
            {t('browser.matchDeletion.open')}
          </button>
        </p>
        <!-- **Offered whether or not the snippet may be moved**, for the reason
             the deletion panel is: the panel says why it may not, inline and
             localized, and the core's own refusal is still the one that decides.
             The one gate is the same one — `startMatchMove` takes a
             `DocumentView`, and a file this window could not read has none.

             **The snippet and its parse are captured in one assignment**, so the
             two cannot come from two reads and disagree afterwards; the whole
             destination list is derived from that one parse. -->
        <p class="toggle">
          <button
            type="button"
            onclick={() => (movingMatch = { projection: parse, match: target, file: inFile })}
          >
            {t('browser.matchMove.open')}
          </button>
        </p>
        <!-- **Offered whether or not the snippet may be duplicated**, for the
             reason the other two panels are: the panel says why it may not,
             inline and localized, and the core's own refusal is still the one
             that decides. The one gate is the same one —
             `startMatchDuplication` takes a `DocumentView`, and a file this
             window could not read has none.

             **The snippet and its parse are captured in one assignment**, so the
             two cannot come from two reads and disagree afterwards; the bytes
             copied are the ones that parse gives this snippet. -->
        <p class="toggle">
          <button
            type="button"
            onclick={() =>
              (duplicatingMatch = { projection: parse, match: target, file: inFile })}
          >
            {t('browser.matchDuplication.open')}
          </button>
        </p>
      {/if}
    {/if}

    <section>
      <h2>{t('browser.detail.section.trigger')}</h2>
      <p class="kind">{t('browser.detail.triggerKind', { kind: tTriggerKind(detail.trigger.kind) })}</p>
      {@render rows(detail.trigger.rows)}
      {#if detail.trigger.triggers !== null}
        {@render block(detail.trigger.triggers)}
      {/if}
    </section>

    <section>
      <h2>{t('browser.detail.section.content')}</h2>
      <p class="kind">{t('browser.detail.contentKind', { kind: tContentKind(detail.content.kind) })}</p>
      {@render rows(detail.content.rows)}
    </section>

    {#if hasDiscovery(detail)}
      <section>
        <h2>{t('browser.detail.section.discovery')}</h2>
        {@render rows(detail.discovery)}
        {#if detail.searchTerms !== null}
          {@render block(detail.searchTerms)}
        {/if}
      </section>
    {/if}

    {#if detail.options.length > 0}
      <section>
        <h2>{t('browser.detail.section.options')}</h2>
        {#each detail.options as group (group.name)}
          <h3>{tOptionGroup(group.name)}</h3>
          {@render rows(group.rows)}
        {/each}
      </section>
    {/if}

    {#if detail.variables.length > 0}
      <section>
        <h2>{t('browser.detail.section.variables')}</h2>
        {#each detail.variables as variable (variable.node)}
          <article class="card">
            <h3>
              {#if variable.name === null}
                <span class="marker">{t('browser.detail.unnamedVariable')}</span>
              {:else}
                {@render scalarText(variable.name)}
              {/if}
            </h3>
            <p class="kind">
              {t('browser.detail.variableKind', { kind: tVariableKind(variable.kind) })}
            </p>
            {@render rows(variable.rows)}
            {#if variable.params !== null}
              {@render block(variable.params)}
            {/if}
            {#if variable.dependsOn !== null}
              {@render block(variable.dependsOn)}
            {/if}
            {#if variable.unknown.length > 0}
              {@render unknownEntries(variable.unknown)}
            {/if}
          </article>
        {/each}
      </section>
    {/if}

    {#if detail.formFields.length > 0}
      <section>
        <h2>{t('browser.detail.section.formFields')}</h2>
        {@render lines(detail.formFields)}
      </section>
    {/if}

    {#if detail.unknown.length > 0}
      <section>
        <h2>{t('browser.detail.section.unknown')}</h2>
        {@render unknownEntries(detail.unknown)}
      </section>
    {/if}

    <section>
      <h2>{t('browser.detail.section.source')}</h2>
      <p class="kind">{t('browser.detail.sourceScope')}</p>
      {@render slice(detail.source)}
    </section>
  {:else}
    <p class="empty">{t('browser.detail.empty')}</p>
  {/if}
</section>

<style>
  .detail {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow: auto;
    padding: 1rem;
  }

  .notice {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface-raised);
  }

  .notice p {
    margin: 0;
    flex: 1 1 16rem;
  }

  button {
    font: inherit;
    padding: 0.125rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: inherit;
  }

  section section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  h2 {
    margin: 0.5rem 0 0;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  h3 {
    margin: 0.375rem 0 0;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.25rem 1rem;
    margin: 0;
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  /* Text taken from the file is shown as written (D2u), so it is set in the
     monospaced face that says "this is what the document holds" — and in a
     `pre`, because a block scalar's newlines are part of what it holds. The
     face itself is `--font-mono` in `src/app.css`, stated once because it
     carries that meaning wherever it appears. */
  .source {
    font-family: var(--font-mono);
  }

  pre.source {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .value {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.5rem;
  }

  .key {
    font-family: var(--font-mono);
    overflow-wrap: anywhere;
  }

  /* The boundary of a sequence item, drawn rather than said. `flattenValue`
     produces a flat list of lines, so without a marker two items whose first
     scalar holds a newline read as three unmarked lines and the reader cannot
     tell two from three. The glyph is in the markup rather than in a `content:`
     rule so that it is part of the DOM's text and the R32 window reading can
     see it; it is `aria-hidden` because the `li` already says "item". */
  .bullet {
    color: var(--muted);
  }

  /* What is said about an entry this app does not model — the shape of its
     value and why it was not modelled — above the value's own bytes. A column,
     because the bytes are a block and belong on their own lines; `.says` is the
     sentence pair, which still reads as one line and wraps like one. */
  .unknown {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .says {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.5rem;
    margin: 0;
  }

  /* Anything this app says *about* a value, rather than the value: the empty
     marker, the spelling, the ambiguity flag, a shape the projection stopped
     at. Never the same face as the file's own text. */
  .marker {
    font-size: 0.6875rem;
    color: var(--muted);
  }

  .warn {
    padding: 0 0.25rem;
    border: 1px solid var(--border);
    border-radius: 4px;
  }

  /* The switch between the two things this pane can be about. It sits at the
     top because it changes everything under it, and it is a plain button
     rather than a tab strip because there are two states and the label says
     which one it will produce. */
  .toggle {
    margin: 0;
  }

  /* This app declining to show a file's text at all — a `notUtf8` refusal, or a
     file that stopped being readable. Bordered like `.blocked` because it is
     the same kind of statement, and two paragraphs because they are two
     different facts: that the text cannot be shown, and the typed reason. */
  .refused {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-raised);
    font-size: 0.8125rem;
  }

  .refused p {
    margin: 0;
  }

  /* The pane's one judgement. Bordered like `.warn` because it is the same
     kind of statement — this app declining to touch something — and set in the
     body face rather than the marker face because it is a sentence the reader
     is meant to read, not a label beside a value. */
  .blocked {
    margin: 0;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-raised);
    font-size: 0.8125rem;
  }

  .kind,
  .count,
  .blockLabel {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .card {
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  .lines {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  /* The `.depth-N` ladder this line's indentation comes from is in
     `src/app.css`, unscoped. A component's `<style>` is scoped by Svelte, so a
     rule written here would compile to `.depth-3.svelte-<hash>` and no second
     pane could ever reach it; indentation is not this pane's private idea.
     `MAX_INDENT_DEPTH` in `../browser/detail.ts` is the contract with that
     file, and `detail.test.ts` checks it there. */
  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.5rem;
  }

  .empty {
    margin: 0;
    color: var(--muted);
  }
</style>
