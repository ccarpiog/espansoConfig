<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    acknowledgeSnapshot,
    acknowledgeFindings,
    acknowledgementOf,
    askToReload,
    CONFLICT_CAPABILITIES,
    beginSave,
    confirmReload,
    editText,
    keepEditing,
    loadDiskVersion,
    rawEditorRefusal,
    rawEditorView,
    redoEdit,
    saveCouldNotBeSent,
    startRawEditor,
    textToCopy,
    undoEdit,
    applySave,
    applyObservation,
    type RawEditorView,
    type RoundTripText
  } from '../browser/rawEditor';
  import type { BindObservationReceiver } from '../browser/surfaceReceivers';
  import type { RawSaveAnswer } from '../browser/workspace.svelte';
  import type { AdoptTheDiskVersion } from '../browser/editorSave';
  import type { RawSaveChoice } from '../browser/rawSave';
  import { conflictOriginMessage, conflictRevisionsOf } from '../browser/conflictSource';
  import {
    isExternalConflict,
    outcomeReveal,
    type ConflictChoice,
    type ConflictModel
  } from '../browser/saveOutcome';
  import {
    t,
    tConflictChoice,
    tConflictMessage,
    tConflictOriginMessage,
    tFindingCode,
    tPresentationNote,
    tRawEditorDiskRefusal,
    tRawEditorRefusal,
    tRawSaveChoice,
    tReloadUnavailable,
    tRawSaveMessage,
    tSaveOutcomeMessage,
    tSaveVerdict
  } from '../i18n';
  import type {
    Acknowledgement,
    ContentRevision,
    DocumentId,
    DocumentSummary
  } from '../ipc/types';
  import { copyReferenceText } from './clipboard';
  import RecoveryWithoutCreation from './RecoveryWithoutCreation.svelte';
  import { revealOutcome } from './reveal';
  import {
    decideSurfaceAcknowledgement,
    surfaceAcknowledgementOwed,
    type ReconciliationRefusal,
    type SurfaceAcknowledgementPort
  } from '../browser/reconciliationStatus';
  import SnapshotAcknowledgement from './SnapshotAcknowledgement.svelte';
  import SourceText from './SourceText.svelte';

  /*
   * The raw editor: one file's whole text, drafted and saved.
   *
   * **This file is presentation.** Every decision about what the editor may do,
   * what it says and when — dirtiness, undo, the acknowledgement round trip, the
   * three outcome arms, the terminal conflict state and its confirmed reload — is
   * in `../browser/rawEditor.ts`, which has a test suite. Nothing put here can be
   * checked by anything except a person looking at a window, which is why so
   * little is here.
   *
   * Eight things in the markup below are load-bearing and are not style.
   *
   * **The text area is controlled, not bound.** `value={view.text}` with an
   * `oninput` that hands the whole value to the model means the model is the only
   * thing that decides what the box holds — so undo, redo and a reload of the
   * disk version all take effect, and an edit the model refuses (during a save,
   * or during a conflict) does not.
   *
   * **The save control is gated on `view.canSave`**, which is `dirty` and nothing
   * else standing in the way. A clean draft has nothing to send: the save would be
   * legal — `committed: false` is a documented success — and it would still take
   * the write lock, reparse the file and open a backup batch for nothing.
   *
   * **The *Save anyway* control is withdrawn the moment the text changes.** The
   * findings a refusal carries are about **one exact candidate**, and the gate
   * matches them as an exact multiset against the suspicions of the text that is
   * actually sent. `view.refusalChoices` is what withdraws it, and
   * `browser.rawEditor.findingsAreStale` is what says why rather than leaving a
   * control to vanish silently.
   *
   * **The conflict panel offers *Copy draft* before the destructive choice, and
   * the destructive choice is two clicks.** Both are the split's requirements
   * (`docs/decisions/2c-split-notes.md` section 6) and both are the model's
   * ordering, not this file's: `view.conflictChoices` answers one list before the
   * warning and another after it.
   *
   * **No control here is called "keep my draft", and on this surface that is
   * permanent.** Since 2c-4b-3 the phrase names a real operation and five panels
   * draw it, and this one never will: `rawEditor.ts`'s `CONFLICT_CAPABILITIES`
   * declares `reapplySupport: 'unavailable'` — the consult's Q4 ruling that a
   * whole-document candidate has no target, no field intent and no operation to
   * re-resolve — so `conflictChoicesFor` names no reapply here whatever this
   * surface's `offersReapply` said. What is offered is *Keep editing*, *Copy my
   * text* and *Load the version on disk*, and 2c-4c owns the recovery this editor
   * is left with.
   *
   * **And what 2c-4c-3b made of that is one sentence and no new control.** The
   * consult's Q4 puts this editor **in** the recovery contract and **out** of
   * save-as-new: a whole document holds no match-shaped value to send to
   * `create_match`, there is no document-creation command, and V1 forbids both an
   * automatic merge and a stale overwrite. So `RecoveryPanel.svelte` is not mounted
   * here — every control in it is about a new snippet — and what is mounted instead
   * is `RecoveryWithoutCreation.svelte`, whose one sentence names the four things
   * this editor really does offer. **This surface is the reason that gate asks about the
   * conflict before it asks about the reapply**: `reapplySupport` is `unavailable`,
   * so a `manualResolution` is unreachable here and an entry condition written on one
   * would have silenced this sentence permanently.
   *
   * **A save that failed is never drawn as "nothing was written" unless it was.**
   * A failure at or after the rename may have left the candidate on disk, and the
   * boundary says so; `view.sendFailure` has two arms and the indeterminate one
   * gets its own sentence. Collapsing them would be `PROGRESS.md` D2 broken from
   * the other side — this application telling a person their file is untouched
   * when it may not be.
   *
   * **The editor cannot be left while a save is in flight.** The request is
   * already authorized and cannot be cancelled, so unmounting would leave it free
   * to commit with its outcome drawn nowhere. The close control is disabled and
   * `requestClose` refuses as well — a disabled control says *not now* where a
   * silent no-op says nothing — and a discard confirmation raised before a save
   * started is withdrawn when one does, because that dialog says the changes have
   * not been written.
   *
   * **There is no `diskText` prop, and there was one until 2c-4a-2.** It carried
   * `browser.rawTextOf(id)` — a `RawDocumentText | null` from a *separate* read —
   * while `ConflictModel.diskText` is a `string` on the conflict payload. Two
   * different things under one name on one screen is how a wrong value gets drawn,
   * and a person reading this file has no type checker. The prop is gone; the disk
   * side is `view.diskText`, which is the conflict's own text paired with
   * `conflict.diskRevision` by the command layer.
   *
   * **`adoptDiskVersion` is what makes the reload one operation.** A conflict no
   * longer installs anything into the window (consult Q2), so confirming the reload
   * has to install the disk projection *and* reseed the draft; `loadDiskVersion`
   * does both, calling this prop itself, and nothing here can do one without the
   * other.
   *
   * **A conflict of either origin is drawn, and each panel says which origin it
   * has** — Phase 2d-6-8b, the 2d-6 record's §3 entries 10 and 23, in the shape
   * `MatchEditor.svelte` has had since 2d-6-6c-1. A save conflict stays inside
   * the outcome panel, where the save that produced it is described; a change the
   * watcher observed has no outcome at all (the session keeps it in
   * `externalConflict`, beside `outcome`), so it is drawn by a panel of its own
   * **outside the save-outcome branch**. Both open with `tConflictOriginMessage`,
   * and each names only the revisions its origin has — three for a refused save,
   * the observed one alone for an observation. What the two share — the whole
   * disk text, the carriage-return refusal beside it, the reload-unavailable line,
   * the copy disclosure and the choices — is one `comparison` snippet, so the two
   * arms cannot drift apart. The draft side of the comparison is the box above,
   * read-only under either origin and holding no carriage return by construction
   * (`startRawEditor` refuses one, and so does the reseed). Which arm is drawn is
   * decided by `isExternalConflict`, the one tested guard, because the nested
   * `source.kind` does not narrow the model. **The reload reseeds under both
   * origins** — the box takes the disk text and the panel goes — which is this
   * surface's declared `reseedsDraft`, never the restore pane's retarget or a
   * match panel's close. **What no type forces** is that this markup draws the
   * origin line or the acknowledgement at all; `RawEditor.test.ts` and
   * `DetailPane.test.ts` read them off the screen in both languages.
   */

  const {
    file,
    baseRevision,
    text,
    adoptDiskVersion,
    save,
    reportReceiver,
    acknowledgement,
    close
  }: {
    /** The file being edited. Its path is what tells the person which one it is. */
    file: DocumentSummary;
    /** The revision its text was read at, and the base every save sends. */
    baseRevision: ContentRevision;
    /** Its whole text, as `document_text` answered it. */
    text: string;
    /**
     * Installs the disk observation a conflict carried into the window.
     *
     * `BrowserState.adoptDiskVersion`, which is the sole frontend transition that
     * moves this window to the disk side of a conflict. It is called by
     * `loadDiskVersion` and by nothing here, so the projection cannot be replaced
     * without the draft being reseeded in the same call — and a `refused` from it is
     * a refusal `loadDiskVersion` honours by reseeding nothing, while an
     * `alreadyThere` is a success it finishes on.
     */
    adoptDiskVersion: AdoptTheDiskVersion<RoundTripText>;
    /**
     * Sends one save.
     *
     * Answers a **sealed** outcome, so this component cannot learn anything about
     * the save without discharging the invalidation — which `applySave` does — or
     * a typed failure that says whether the file may already have been written.
     *
     * @param document - The file to replace.
     * @param baseRevision - The revision the text was drafted from.
     * @param text - The whole new text.
     * @param acknowledgement - The suspicions already shown to a person.
     * @returns The sealed outcome, or the failure.
     */
    save: (
      document: DocumentId,
      baseRevision: ContentRevision,
      text: string,
      acknowledgement: Acknowledgement
    ) => Promise<RawSaveAnswer>;
    /**
     * Reports this editor's observation receiver to the host — Phase 2d-6-8a,
     * the 2d-6 record's §3 entry 1, the pattern `MatchEditor.svelte` has followed
     * since 2d-6-6b.
     *
     * **Required**, so a host cannot mount this editor without a way to be told
     * what the window decided about its file. It is called once, when this
     * component starts, and the binding it answers is withdrawn when it is
     * destroyed; what the receiver does is `applyObservation` in
     * `../browser/rawEditor.ts`, installed over whatever this editor holds.
     * **What the required prop forces is that a host supplies one; nothing in
     * TypeScript forces this component to call it or to withdraw** — the mounted
     * suites are what establish both.
     */
    reportReceiver: BindObservationReceiver;
    /**
     * The window's side of the acknowledgement this panel offers for an unknown
     * write outcome — Phase 2d-6-9b-2. `surfaceAcknowledgementPortOf(browser)` in
     * `../browser/reconciliationStatus.ts`, built by `DetailPane.svelte`; **required,
     * and what that forces is only that a host supplies one** — nothing in
     * TypeScript forces it to ask the window.
     */
    acknowledgement: SurfaceAcknowledgementPort;
    /** Leaves the editor. */
    close: () => void;
  } = $props();

  // `$state.raw`, not `$state`: a session is an immutable value replaced whole on
  // every transition, and its draft holds deep-frozen snapshots that a reactive
  // proxy has no business walking.
  //
  // **Capturing the initial values is the whole point**, which is why the warning
  // is suppressed rather than designed around. A draft that re-derived itself from
  // its props would be discarded every time the workspace re-read the file — which
  // it does after every committed save and after every conflict. The three props
  // are read once, here, and the session owns the text from then on.
  // svelte-ignore state_referenced_locally
  let session = $state.raw(startRawEditor(file.id, baseRevision, text));

  /*
   * **The receiver, reported when this editor starts and withdrawn when it is
   * destroyed** — Phase 2d-6-8a, `MatchEditor.svelte`'s pattern. A synchronous
   * call in the component's own initialisation rather than an effect: the host
   * registers this editor as a write surface from an effect of its own, which
   * runs after this, so a surface the coordinator can see always has its
   * receiver. The receiver installs `applyObservation`'s answer over the session
   * held **now**, so a delivery that arrives while this editor's own write is in
   * flight is held inside the session and consumed by `applySave` or
   * `saveCouldNotBeSent` (entry 5). The binding is instance-bound: a later
   * editor's report displaces this one, and this one's withdrawal then reaches
   * nothing.
   *
   * **A text holding a carriage return opens no session** (`startRawEditor`
   * answers `null`, `CLAUDE.md` §6), and then a delivery installs nothing: there
   * is no draft for the change to conflict with and no save door to refuse. The
   * pane still registers the surface, so the coordinator's own effect — the file
   * marked stale — is what remains. What a delivery installs on a live session
   * is drawn since Phase 2d-6-8b: the external panel below; the held and unknown-outcome
   * sentences are the pane's since Phase 2d-6-9b-2.
   */
  // svelte-ignore state_referenced_locally
  const receiving = reportReceiver((delivery) => {
    if (session !== null) {
      session = applyObservation(session, delivery);
    }
  });
  onDestroy(() => {
    receiving.withdraw();
  });
  const view = $derived(session === null ? null : rawEditorView(session));

  /**
   * Why this text will not be edited at all, or `null`.
   *
   * `session === null` **is** the refusal — `startRawEditor` answers that and
   * nothing else for a text it cannot hold unchanged — and this is the reason to
   * put on screen beside it. `DetailPane` withdraws the *Edit* control for the same
   * texts, so in the running application this branch is a second gate rather than
   * the first; it is here because a component that could be mounted into a dead end
   * should say so rather than draw an empty box.
   */
  // svelte-ignore state_referenced_locally
  const refusal = rawEditorRefusal(text);

  /**
   * One *Copy my text* and what became of it — Phase 2d-6-8b, the shape
   * `MatchEditor.svelte` has had since 2d-6-6c-2.
   *
   * The conflict on screen when the copy was asked for, by identity, and the
   * text handed to the clipboard. Both are needed: a later change to the file
   * replaces the conflict with a new object over the same retained draft (the
   * 2d-6 record's §3 entry 12 — copy feedback is cleared where it would describe
   * the wrong panel).
   */
  interface CopyDisclosure {
    /** The conflict on screen when the copy was asked for. */
    readonly conflict: ConflictModel<RoundTripText>;
    /** The exact text handed to the clipboard. */
    readonly text: string;
    /** Whether the clipboard took it. */
    readonly result: 'copied' | 'failed';
  }

  /** What became of the last *Copy my text*, so the person is told either way. */
  let copied = $state.raw<CopyDisclosure | null>(null);

  /**
   * What the copy disclosure may say about the conflict **on screen now**.
   *
   * Shown only while the conflict it was made under is still the one on screen
   * and the draft still is exactly the text that was copied. **What this
   * compares is identity and text, and what it cannot know** is whether the
   * clipboard still holds that text; the sentence says a copy was made, never
   * that it is still there.
   */
  const copyShown = $derived(
    copied !== null &&
      view !== null &&
      copied.conflict === view.conflict &&
      session !== null &&
      copied.text === textToCopy(session)
      ? copied.result
      : 'none'
  );
  /** Whether leaving the editor is waiting on a confirmation. */
  let leaving = $state(false);

  /** The outcome panel's own element, so a reveal has something to point at. */
  let outcomePanel = $state<HTMLElement | null>(null);
  /** The conflict arm's row of controls, which is the second step's target. */
  let outcomeChoices = $state<HTMLElement | null>(null);

  /**
   * The external conflict on screen, narrowed, or `null` — Phase 2d-6-8b.
   *
   * Through `isExternalConflict` rather than `view.conflict.source.kind`: the
   * nested discriminant narrows the source and leaves the model the union (the
   * 2d-6 record's §3 entry 10), so this is the one place the panel below learns
   * that it may read the external arm.
   */
  const external = $derived(
    view !== null && view.conflict !== null && isExternalConflict(view.conflict)
      ? view.conflict
      : null
  );
  /** The external conflict panel's own element, the reveal's target when it shows. */
  let externalPanel = $state<HTMLElement | null>(null);

  /*
   * **The acknowledgement this panel offers for its own conflict** — Phase
   * 2d-6-9b-2, the 2d-6 record's §3 entries 14 and 15. Whether it is drawn and
   * whether it is enabled are `decideSurfaceAcknowledgement`'s, asked about
   * `external.source`, the origin this panel draws; the press runs `acknowledgeSnapshot`, whose
   * closure hands the session's own conflict source (the same object) to the port.
   */
  const acknowledgementControl = $derived(
    external === null
      ? null
      : decideSurfaceAcknowledgement(
          surfaceAcknowledgementOwed(view?.externalNotices ?? []),
          acknowledgement.refusalFor(external.source)
        )
  );

  /**
   * Presses the acknowledgement: the session's own transition, which asks the
   * window through the port at most once and changes the session only when the
   * window ended the hold.
   *
   * @returns The refusal the window answered, or `null` when it ended the hold.
   */
  function acknowledgeTheSnapshot(): ReconciliationRefusal | null {
    const held = session;
    if (held === null) {
      return null;
    }
    const answer: { refusal: ReconciliationRefusal | null } = { refusal: null };
    session = acknowledgeSnapshot(held, (source) => {
      answer.refusal = acknowledgement.acknowledge(source);
      return answer.refusal === null ? 'acknowledged' : 'refused';
    });
    return answer.refusal;
  } // End of function acknowledgeTheSnapshot()

  /*
   * **The outcome panel’s appearance asks for a scroll into view** — 2c-4a-3c's
   * findings 10.3 and 10.4. The window reading measured every one of the six write
   * surfaces putting its controls below a 728 px fold with `section.detail`'s
   * `scrollTop` at `0` and nothing moving it; on the match editor the whole panel
   * was below it, so the sentence *Nothing was written* was invisible in English
   * and entirely absent from the screen in Spanish.
   *
   * The decision is `./reveal.ts`'s and the two `bind:this` targets are this
   * file's. A `$derived` cue rather than the outcome object itself, so the effect
   * re-runs when the *state* changes and not on every keystroke that leaves the
   * same panel up.
   *
   * **An active external conflict is revealed ahead of any outcome kept as
   * history** (Phase 2d-6-8b, the shape 2d-6-7b's review gave the operation
   * panels): a refusal or a success stays in `outcome` beside it (entry 7), and
   * a cue taken from that outcome would point the reveal at the old panel and
   * never at the reload's second step.
   */
  const reveal = $derived(
    outcomeReveal(
      external !== null ? 'conflict' : (view?.outcome?.kind ?? null),
      view?.awaitingReloadConfirmation ?? false
    )
  );
  /**
   * Whether the external panel, rather than the outcome one, is the reveal's
   * target. A boolean `$derived` rather than a read of `view` inside the effect:
   * `view` is a new object on every transition, so the effect would re-run — and
   * ask for a scroll again — on transitions that changed no cue.
   */
  const externalShown = $derived(external !== null);
  $effect(() => {
    revealOutcome(reveal, externalShown ? externalPanel : outcomePanel, outcomeChoices);
  });

  /**
   * Sends the draft, optionally accepting the findings on screen first.
   *
   * The acknowledgement is never assembled here: `acknowledgeFindings` records
   * consent through the one function that can, and `beginSave` reads it back
   * through `submissionOf`, so what goes to the boundary is consent bound to the
   * exact candidate being sent or nothing at all.
   *
   * @param acknowledge - Whether this is the *Save anyway* control.
   */
  async function runSave(acknowledge: boolean): Promise<void> {
    if (session === null) {
      return;
    }
    const held = session;
    const consented = acknowledge ? acknowledgeFindings(held) : held;
    // **The reader answers the consented session while the installed one is still
    // the session it was derived from**, and the installed session otherwise
    // (`ReadTheInstalledSession` in `rawEditor.ts`). `session` is non-null for the
    // whole handler: nothing here or in the model sets it back to `null`.
    const started = beginSave(consented, () => (session === held || session === null ? consented : session));
    if (started === null) {
      return;
    }
    session = started.session;
    copied = null;
    // A leaving confirmation raised before the save started is about a question
    // this save has just answered differently, and leaving is refused for as long
    // as one is in flight anyway.
    leaving = false;
    const answer = await save(
      file.id,
      started.submission.baseRevision,
      started.submission.candidate,
      acknowledgementOf(started.submission)
    );
    session =
      answer.kind === 'sealed'
        ? applySave(session, answer.sealed, () => session ?? started.session)
        : saveCouldNotBeSent(session, answer.mayHaveWritten, () => session ?? started.session);
  } // End of function runSave()

  /**
   * Adopts the version on disk and starts again from it.
   *
   * The confirmation is issued and spent in one handler because the *two steps
   * the person sees* are the warning and this click, not two clicks after the
   * warning. What the token still buys is that `reloadDiskVersion` refuses one
   * issued for a different conflict, which is checked in `rawEditor.test.ts`.
   *
   * **The workspace adoption is not performed here.** `loadDiskVersion` calls
   * `adoptDiskVersion` itself, after every check has passed, so a refused reload
   * cannot move the window and this handler cannot move it without reseeding.
   */
  function loadTheDiskVersion(): void {
    if (session === null) {
      return;
    }
    const held = session;
    const confirmed = confirmReload(held);
    // The reader answers the confirmed session while the installed one is still
    // the session it was derived from, and the installed session otherwise.
    session = loadDiskVersion(confirmed, adoptDiskVersion, () =>
      session === held || session === null ? confirmed : session
    );
    copied = null;
  } // End of function loadTheDiskVersion()

  /**
   * Puts the draft on the clipboard, by whichever route this webview allows.
   *
   * **The routine moved to `./clipboard.ts` at 2c-4a-3a and this component no
   * longer carries its own copy of it.** It was duplicated the moment two more
   * surfaces needed the same *copy your text before discarding it* step, and a
   * second copy of a routine whose failure mode is silence is a second place for
   * it to be relaxed. What it does is unchanged: the asynchronous API first,
   * because it works everywhere else and needs no selection, then a selection
   * carrier, with every step of putting the screen back separately non-throwing.
   *
   * **The carriage-return refusal `copyReferenceText` adds cannot fire here**, and
   * saying so is the point: this editor refuses to open a text containing one at
   * all (`startRawEditor`), so the draft handed over never holds a `\r`. The rule
   * exists for the match editor, whose buffers can.
   *
   * **A refusal by both routes is still disclosed** — replacing an honest failure
   * with a silent one would be worse than the failure, and the read-only box above
   * holds the same bytes for a manual selection either way, which for *this*
   * surface is true because the box is a `<textarea>` holding the draft itself.
   */
  async function copyTheDraft(): Promise<void> {
    const conflict = view === null ? null : view.conflict;
    const value = session === null ? null : textToCopy(session);
    if (conflict === null || value === null) {
      return;
    }
    // **The snapshot is taken before the clipboard is asked**, and the answer is
    // recorded against it: the clipboard answers asynchronously, and by then a
    // delivery may have replaced the conflict. `copyShown` then shows it only
    // while that snapshot is still the one on screen.
    const result = (await copyReferenceText(value)) ? 'copied' : 'failed';
    copied = { conflict, text: value, result };
  } // End of function copyTheDraft()

  /**
   * Records what the text area now holds.
   *
   * A named handler rather than an expression in the markup, so the guard on a
   * refused text lives beside the other seven and TypeScript can see it.
   *
   * @param value - The text area's whole value.
   */
  function onTyped(value: string): void {
    if (session !== null) {
      session = editText(session, value);
    }
  } // End of function onTyped()

  /** Goes back one step. */
  function onUndo(): void {
    if (session !== null) {
      session = undoEdit(session);
    }
  } // End of function onUndo()

  /** Goes forward one step. */
  function onRedo(): void {
    if (session !== null) {
      session = redoEdit(session);
    }
  } // End of function onRedo()

  /** Puts the outcome panel away and gives the box back. */
  function onDismiss(): void {
    if (session !== null) {
      session = keepEditing(session);
    }
  } // End of function onDismiss()

  /**
   * Does what one conflict choice says.
   *
   * @param choice - The choice the person picked.
   */
  function conflictAction(choice: ConflictChoice): void {
    if (session === null) {
      return;
    }
    switch (choice) {
      case 'keepEditing':
        session = keepEditing(session);
        copied = null;
        return;
      case 'copyDraft':
        void copyTheDraft();
        return;
      case 'keepMyDraft':
        // Never offered here, and not because a boolean is `false`: this
        // surface's `reapplySupport` is permanently `unavailable`, and
        // `conflictChoicesFor` requires it to be `supported` before it will name
        // this choice. `rawEditor.reapplyToDiskVersion` takes no adoption
        // function at all, so there is nothing this arm could call. It exists so
        // the `switch` stays exhaustive and a sixth member of `ConflictChoice`
        // is a compile error here.
        return;
      case 'reloadDiskVersion':
        session = askToReload(session);
        return;
      case 'confirmReload':
        loadTheDiskVersion();
        return;
      case 'confirmReloadKeeping':
        // Never offered here: this surface's declared `reloadOutcome` is not
        // `retargetsCandidate`, and `conflictChoicesFor` names this second step
        // only for one that is. The arm exists so the `switch` stays exhaustive —
        // and it is a compile error until it is written, which is what made this
        // sixth member of `ConflictChoice` cheap to add (2c-5-4b).
        return;
    }
  } // End of function conflictAction()

  /**
   * Does what one refusal choice says.
   *
   * @param choice - The choice the person picked.
   */
  function refusalAction(choice: RawSaveChoice): void {
    if (choice === 'saveAnyway') {
      void runSave(true);
      return;
    }
    if (session !== null) {
      session = keepEditing(session);
    }
  } // End of function refusalAction()

  /**
   * Leaves the editor, asking first when there is unsaved text to lose.
   *
   * **Refused outright while a save is in flight.** The request has already been
   * authorized and cannot be cancelled; unmounting the editor would leave it free
   * to commit with its outcome drawn nowhere, under a dialog that had just said
   * the changes were not written. That is the 2c-1b review's fourth finding, and
   * the control is disabled for the same reason rather than only guarded here — a
   * disabled control says *not now*, where a silent no-op says nothing.
   */
  function requestClose(): void {
    if (view === null) {
      // Nothing was ever drafted, so there is nothing to lose and nothing to ask.
      close();
      return;
    }
    if (view.saving) {
      return;
    }
    if (view.dirty) {
      leaving = true;
      return;
    }
    close();
  } // End of function requestClose()

  /** Leaves the editor, discarding the draft. Refused while a save is in flight. */
  function discardAndClose(): void {
    if (view !== null && view.saving) {
      return;
    }
    close();
  } // End of function discardAndClose()
</script>

<!-- **What a conflict of either origin shows beside its own lines** — Phase
     2d-6-8b. One snippet for both panels rather than two copies, so the disk
     side, the carriage-return refusal, the reload-unavailable line, the copy
     disclosure and the choices cannot drift apart between the save arm and the
     external arm (the 2d-6 record's §3 entry 23). The draft side is the box
     above. Only one conflict is active at a time (entry 7), so the one
     `outcomeChoices` element it binds belongs to whichever panel is drawn. -->
{#snippet comparison(shown: RawEditorView)}
  <h3>{t('browser.rawEditor.diskVersion')}</h3>
  <!-- Which arm is drawn is `conflictDiskText`'s decision and not this
       markup's since 2c-4a-3a: *an empty file is a fact about the file rather
       than a failure to obtain its text* — 2c-4a-1's D1 — was written into
       this renderer and then into two more, which is a semantic decision no
       suite carried. **Through `SourceText` and never into a box**: a disk
       version holding a carriage return is named here, character by
       character, and a `<textarea>` would silently draw it as a line break
       (`CLAUDE.md` §6). -->
  {#if shown.diskText !== null && shown.diskText.kind === 'text'}
    <SourceText text={shown.diskText.text} documentStart />
  {:else}
    <p class="marker">{t('browser.detail.fileTextEmpty')}</p>
  {/if}

  <!-- The acknowledgement of an unknown write outcome, directly under the
       snapshot it is about (Phase 2d-6-9b-2). Only the external arm carries one;
       the sentence that the outcome is unknown is the pane's, above the panel. -->
  {#if external !== null && acknowledgementControl !== null}
    <SnapshotAcknowledgement
      shown={external.source}
      decision={acknowledgementControl}
      acknowledge={acknowledgeTheSnapshot}
    />
  {/if}

  <!-- **The reload's own sentence, and not the opening refusal's** — 2c-4a-3c's
       finding 10.5. Both come from one `rawEditorRefusal` call over two
       different texts, and until that step both drew the same string, which
       ends *"it will not open this file for editing"*: the reason for a
       disabled **reload** confirmation, written about a **different** control,
       beside an editor that is already open over the person's own draft.
       `view.diskRefusal` was always a separate field from the opening refusal,
       so the second sentence cost a second accessor and nothing else. It is the
       carriage-return disclosure of both origins: this editor refuses to reseed
       from a text holding a `
`, and says so beside the text that holds it. -->
  {#if shown.diskRefusal !== null}
    <p class="marker warn">{tRawEditorDiskRefusal(shown.diskRefusal)}</p>
  {/if}

  <!-- A control that has just gone, with the reason in its place: the reload
       is not offered again once the window has refused a spend, because the
       refusal came back with no word about its cause. That withholds a
       control; it claims nothing about how a later ask would be answered. -->
  {#if shown.reloadUnavailable}
    <p class="kind">{tReloadUnavailable(CONFLICT_CAPABILITIES.draftKind)}</p>
  {/if}

  {#if copyShown === 'copied'}
    <p class="kind">{t('browser.rawEditor.draftCopied')}</p>
  {:else if copyShown === 'failed'}
    <p class="kind">{t('browser.rawEditor.draftCopyFailed')}</p>
  {/if}

  <p class="choices" bind:this={outcomeChoices}>
    {#each shown.conflictChoices as choice (choice)}
      <button
        type="button"
        disabled={choice === 'confirmReload' && !shown.canReload}
        onclick={() => conflictAction(choice)}
      >
        {tConflictChoice(choice, CONFLICT_CAPABILITIES.draftKind)}
      </button>
    {/each}
  </p>
{/snippet}

<section class="rawEditor" aria-label={t('browser.rawEditor.label')}>
  <div class="head">
    <dl>
      <dt>{t('browser.detail.file')}</dt>
      <dd class="source">{file.relative_path}</dd>
    </dl>
    {#if view !== null && view.dirty}
      <span class="marker warn">{t('browser.rawEditor.unsaved')}</span>
    {/if}
    <button
      type="button"
      disabled={view !== null && view.saving}
      onclick={() => requestClose()}
    >
      {t('browser.rawEditor.close')}
    </button>
  </div>

  {#if view === null}
    <!-- The refusal, and nothing else: no box, no save control, no draft. A text
         this editor cannot give back unchanged is not opened at all, which is the
         only way to keep the project's central promise on the one screen that can
         write. `rawEditor.ts`'s own note names the alternative that was refused. -->
    <p class="panel">
      {refusal === null
        ? t('browser.rawEditor.notProjected')
        : tRawEditorRefusal(refusal)}
    </p>
  {:else}
  {#if view.saving}
    <p class="kind">{t('browser.rawEditor.savingCannotBeStopped')}</p>
  {/if}

  {#if leaving}
    <div class="panel">
      <p>{t('browser.rawEditor.discardWarning')}</p>
      <p class="choices">
        <button type="button" disabled={view.saving} onclick={() => discardAndClose()}>
          {t('browser.rawEditor.discard')}
        </button>
        <button type="button" onclick={() => (leaving = false)}>
          {tRawSaveChoice('keepEditing', CONFLICT_CAPABILITIES.draftKind)}
        </button>
      </p>
    </div>
  {/if}

  {#each view.rawSave.messages as message, index (index)}
    <p class="kind">{tRawSaveMessage(message)}</p>
  {/each}

  <textarea
    class="text"
    aria-label={t('browser.rawEditor.label')}
    spellcheck="false"
    readonly={!view.editable}
    value={view.text}
    oninput={(event) => onTyped(event.currentTarget.value)}
  ></textarea>

  <p class="choices">
    <button type="button" disabled={!view.canUndo} onclick={() => onUndo()}>
      {t('browser.rawEditor.undo')}
    </button>
    <button type="button" disabled={!view.canRedo} onclick={() => onRedo()}>
      {t('browser.rawEditor.redo')}
    </button>
    <button type="button" disabled={!view.canSave} onclick={() => void runSave(false)}>
      {t('browser.rawEditor.save')}
    </button>
    {#if view.saving}
      <span class="marker">{t('browser.rawEditor.saving')}</span>
    {/if}
  </p>

  <!-- A reading the window holds undecided and an unknown write outcome are said
       once, above this panel, by the pane's `FileReconciliationStatus.svelte`
       block, so this panel no longer draws its own notices (Phase 2d-6-9b-2);
       the acknowledgement is drawn under the disk snapshot in the conflict panel. -->

  {#if view.sendFailure !== null}
    <p class="panel">
      {view.sendFailure.kind === 'mayHaveWritten'
        ? t('browser.rawEditor.mayHaveWritten')
        : t('browser.rawEditor.sendFailed')}
    </p>
  {/if}

  <!-- What recovery is on a surface that cannot create: one sentence, in the place
       the two surfaces that *can* create draw their form, so all six say it in the
       same position. There is no control here — and no save-as-new anywhere on this
       screen — and its absence is the sentence. What the sentence *does* name —
       keep editing, copy, compare, reload — is above and below it.

       **Mounted unconditionally**: whether there is anything to say is the shared
       renderer's decision, taken from the conflict below, and not a condition this
       markup repeats. Four surfaces that each decided it for themselves is the
       finding this component closed. -->
  <RecoveryWithoutCreation kind="wholeDocumentText" conflict={view.conflict} />

  <!-- **The external conflict, outside the save-outcome branch** (the 2d-6
       record's §3 entry 10). The origin line first, then the model's own lines
       for this origin — never `view.messages`, which are a save's — then the one
       revision an observation has, then everything the save panel shows (entry
       23). -->
  {#if external !== null}
    {@const revisions = conflictRevisionsOf(external.source)}
    <div class="panel external" role="status" bind:this={externalPanel}>
      <p>{tConflictOriginMessage(conflictOriginMessage(external.source))}</p>
      {#each view.externalMessages as message, index (index)}
        <p>{tConflictMessage(message)}</p>
      {/each}
      {#if revisions.kind === 'externalChange'}
        <p class="kind">
          {t('browser.externalConflict.revisionObserved', { revision: revisions.observed })}
        </p>
      {/if}
      {@render comparison(view)}
    </div>
  {/if}

  {#if view.outcome !== null}
    {@const outcome = view.outcome}
    <div class="panel" role="status" bind:this={outcomePanel}>
      {#each view.messages as message, index (index)}
        <p>{tSaveOutcomeMessage(message)}</p>
      {/each}

      {#if outcome.kind === 'saved'}
        {#if view.notes.length > 0}
          <p class="kind">{t('browser.rawEditor.notes')}</p>
          <ul>
            {#each view.notes as note, index (index)}
              <li>{tPresentationNote(note)}</li>
            {/each}
          </ul>
        {/if}
        <p class="choices">
          <button type="button" onclick={() => onDismiss()}>
            {t('browser.notice.dismiss')}
          </button>
        </p>
      {:else if outcome.kind === 'refused'}
        <p class="kind">{tSaveVerdict(outcome.verdict)}</p>
        {#if view.rawSave.otherFindings.length > 0}
          <p class="kind">{t('browser.rawEditor.findings')}</p>
          <ul>
            {#each view.rawSave.otherFindings as finding, index (index)}
              <li>{tFindingCode(finding.code)}</li>
            {/each}
          </ul>
        {/if}
        {#if view.findingsAreStale}
          <p class="kind">{t('browser.rawEditor.findingsAreStale')}</p>
        {/if}
        <p class="choices">
          {#each view.refusalChoices as choice (choice)}
            <button type="button" onclick={() => refusalAction(choice)}>
              {tRawSaveChoice(choice, CONFLICT_CAPABILITIES.draftKind)}
            </button>
          {/each}
        </p>
      {:else}
        {@const conflict = outcome}
        <!-- Where this conflict came from: a save this editor attempted. -->
        <p>{tConflictOriginMessage(conflictOriginMessage(conflict.source))}</p>
        <p class="kind">{t('browser.rawEditor.revisionExpected', { revision: conflict.expected })}</p>
        <p class="kind">{t('browser.rawEditor.revisionFound', { revision: conflict.found })}</p>
        <p class="kind">
          {t('browser.rawEditor.revisionDisk', { revision: conflict.diskRevision })}
        </p>

        {@render comparison(view)}
      {/if}
    </div>
  {/if}
  {/if}
</section>

<style>
  .rawEditor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-height: 0;
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
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

  h3 {
    margin: 0.375rem 0 0;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  /* The file's own text, in the face that means "this is what the document
     holds" (`src/app.css`) — the same one `SourceText` uses, because this box
     and that box show the same kind of thing. `white-space: pre` rather than a
     wrap, for `SourceText`'s reason: a soft wrap is indistinguishable from a
     line break the file does not contain. */
  .text {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    white-space: pre;
    overflow: auto;
    min-height: 14rem;
    resize: vertical;
    padding: 0.25rem 0.375rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-raised);
    color: inherit;
  }

  .text[readonly] {
    color: var(--muted);
  }

  .source {
    font-family: var(--font-mono);
  }

  button {
    font: inherit;
    padding: 0.125rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: inherit;
  }

  button:disabled {
    color: var(--muted);
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.375rem;
    margin: 0;
  }

  /* Anything this app says about a save rather than about the file: the three
     outcome arms, the leaving warning, a send that never left. Bordered like the
     detail pane's `.refused` and `.blocked` because it is the same kind of
     statement. */
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin: 0;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-raised);
    font-size: 0.8125rem;
  }

  .panel p {
    margin: 0;
  }

  ul {
    margin: 0;
    padding-left: 1.25rem;
  }

  .kind {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .marker {
    font-size: 0.6875rem;
    color: var(--muted);
  }

  .warn {
    padding: 0 0.25rem;
    border: 1px solid var(--border);
    border-radius: 4px;
  }
</style>
