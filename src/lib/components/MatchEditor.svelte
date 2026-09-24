<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import {
    acknowledgeSnapshot,
    acknowledgeFindings,
    acknowledgementOf,
    addList,
    addListItem,
    applyObservation,
    applySave,
    applySuggestion,
    askToReloadDiskVersion,
    baseRevisionOf,
    beginSave,
    cancelContentSwitch,
    cancelTriggerForm,
    chooseContentSwitch,
    chooseTriggerForm,
    confirmContentSwitch,
    confirmDiskReload,
    confirmTriggerForm,
    CONFLICT_CAPABILITIES,
    editField,
    editListItem,
    editRegex,
    focusField,
    insertCursorPosition,
    keepEditing,
    matchEditorView,
    reapplyToDiskVersion,
    redoEdit,
    reloadTheDiskVersion,
    removeField,
    removeList,
    removeListItem,
    restoreField,
    saveCouldNotBeSent,
    startMatchEditor,
    type Clock,
    type CursorAdvisory,
    type EditableField,
    type EditableFieldModel,
    type EditorReapplyAttempt,
    type ListModel,
    type MatchEditorSession,
    type Reprojection,
    type TriggerShape,
    undoEdit
  } from '../browser/matchEditor';
  import type { AdoptTheDiskVersion } from '../browser/editorSave';
  import type { CreationBuffers } from '../browser/matchCreation';
  import type { MatchBuffers } from '../browser/matchEditor';
  import {
    conflictOriginMessage,
    conflictRevisionsOf,
    type ConflictSource
  } from '../browser/conflictSource';
  import { attemptOfReapply, reapplyReveal, reapplyToShow } from '../browser/reapply';
  import type { BindObservationReceiver } from '../browser/surfaceReceivers';
  import {
    recoveryAvailability,
    startMatchFieldRecovery,
    type CreateARecoveredSnippet
  } from '../browser/recovery';
  import {
    isExternalConflict,
    outcomeReveal,
    type ConflictChoice,
    type ConflictModel
  } from '../browser/saveOutcome';
  import type { RawSaveChoice } from '../browser/rawSave';
  import type { MatchSaveAnswer } from '../browser/workspace.svelte';
  import { copyReferenceText } from './clipboard';
  import RecoveryPanel from './RecoveryPanel.svelte';
  import { revealOutcome, revealReapplyReport } from './reveal';
  import {
    t,
    tConflictChoice,
    tConflictMessage,
    tConflictOriginMessage,
    tContentRoleNote,
    tCursorAdvisory,
    tDetailField,
    tDraftCopy,
    tDraftError,
    tDraftFieldStatus,
    tEditError,
    tEditorReapplyObstacle,
    tFieldRefusal,
    tFindingCode,
    tHazard,
    tIpcFailure,
    tListItemStatus,
    tListRefusal,
    tListStyleNote,
    tOptionGroup,
    tPresentationNote,
    tRawSaveChoice,
    tReapplyOutcome,
    tReapplyReadiness,
    tReloadUnavailable,
    tReprojectionRefusal,
    tSaveError,
    tSaveOutcomeMessage,
    tSaveVerdict,
    tSaveWithheld,
    tTriggerFormChoice,
    tTriggerFormRefusal,
    tTriggerFormTextNote,
    tTriggerPresentation,
    tTriggerRepair,
    tTriggerWithdrawal,
    tValueKind
  } from '../i18n';
  import type {
    Acknowledgement,
    ContentForm,
    ContentRevision,
    DocumentId,
    DocumentSummary,
    DocumentView,
    MatchDraft,
    MatchId,
    MatchView,
    SequenceField
  } from '../ipc/types';
  import {
    decideSurfaceAcknowledgement,
    surfaceAcknowledgementOwed,
    type ReconciliationRefusal,
    type SurfaceAcknowledgementPort
  } from '../browser/reconciliationStatus';
  import SnapshotAcknowledgement from './SnapshotAcknowledgement.svelte';
  import SourceText from './SourceText.svelte';

  /*
   * The small editor: one snippet's editable fields, drafted and saved — seventeen
   * since Phase 3-5-1, drawn in the model's sections since Phase 3-5-2-1, with the
   * change of content kind, the option suggestions and the cursor action; since
   * Phase 3-6-2 the trigger side (the one control of the drafted trigger form, the
   * choices of form and a change's preview) and `search_terms` as list controls.
   *
   * **This file is presentation.** Every decision about what may be edited, what
   * a draft means, when a save may start, what it says and what a commit moves is
   * in `../browser/matchEditor.ts`, which has a test suite. This is a walk over
   * `matchEditorView`'s answer, and the deliberate smallness of it is the reason
   * the seven findings of the 2c-2 review were reachable without a screen at all.
   *
   * The bolded paragraphs below are the things in this markup that are
   * load-bearing rather than style. **Deliberately not counted**: this comment
   * said *seven* over nine of them, which is the same documentation-versus-code
   * mismatch this sub-phase spent its length hunting, in miniature — and a number
   * here goes stale the next time one is added.
   *
   * **Every control is controlled, not bound.** `value={field.text}` with an
   * `oninput` that hands the whole value to the model means the model is the only
   * thing that decides what a box holds — so undo, redo and a rebase after a save
   * all take effect, and an edit the model refuses (during a save, during a
   * conflict, on a field the projection ruled out) does not.
   *
   * **A field the projection refused draws no control at all, and shows its value
   * wherever there is one.** The consult's Q5 asked for read-only rather than
   * disabled: the value stays selectable and the reason is beside it. Such a value
   * goes through `SourceText`, the only rendering surface in this application that
   * *names* a character no font draws. That matters most for a value holding a
   * real carriage return, which a `<textarea>` would draw as an ordinary line
   * break — measured, not assumed: in this application's WKWebView a `<textarea>`
   * turns `"x\ry\r\nz"` into `"x\ny\nz"` and an `<input>` **deletes** the
   * character outright, `"p\rq"` becoming `"pq"`
   * (`docs/decisions/2c-2-2-window-reading.md` §6). So a box would misdraw the
   * file even while refusing to write to it; through `SourceText` the carriage
   * return is a visible marker instead.
   *
   * **The trigger side draws one control, the drafted form's** (Phase 3-6-2,
   * `TriggerFormView.control`): the literal's block, the `regex` box or the
   * `triggers` list. A `Several` draws the literal's refused block, which shows
   * every form the file holds and picks none; an `Absent` draws no control until a
   * form is added. List items are one-line boxes the model refuses a line break or
   * a carriage return in; a read-only list is drawn through `SourceText` from
   * `ListModel.shown`. No list control reorders anything: the core has no
   * capability for it.
   *
   * **What it shows is `field.shown`, which is a list, and each entry may name the
   * key it came from.** The window reading's first finding was that this drew
   * `field.text` — one scalar — so a snippet firing from a `triggers:` list drew a
   * name and a reason and nothing between them, and its triggers appeared nowhere
   * in the window, because this editor replaces the whole detail pane. Its second
   * was that a `Several` then drew two identical unlabelled boxes, one from
   * `trigger:` and one from `regex:`, with the pane that distinguishes them
   * off-screen. The order the entries come in, and why `tTriggerKind` is not the
   * accessor for the label, are both `shownValuesOf`'s to state. `ownsNoBytes`
   * still shows nothing, and that is right: its span is zero-width, so the file
   * holds no value there to show.
   *
   * **The nine options are nine text boxes and none of them is a checkbox.** D2u:
   * this application shows a scalar's source text as written and never an
   * inferred type, and a checkbox over `word` would have to decide that `on`,
   * `yes` and `true` mean the same thing. They are drawn in the four groups of
   * `view.sections` (`OPTION_GROUPS` in `matchEditor.ts`), under the detail
   * pane's own headings through `tOptionGroup`; the *Insertion* group holds
   * `force_mode` and `force_clipboard` as two separately labelled boxes (ruling
   * 10). Suggestions are exact-string buttons, never a replacement for the box.
   *
   * **An absent key says so, in the box that would create it.** The phase's named
   * failure is a draft-versus-projection mistake, and the one rule that pays for
   * the whole arrangement — an initially absent field left blank writes nothing —
   * is invisible unless the screen says which keys the file does not have. It is a
   * sentence under the box rather than a placeholder inside it, because a
   * placeholder is indistinguishable from a value at a glance.
   *
   * **A save that produced no outcome shows *why*, not only *whether*.**
   * `view.failureLines` is the chain — the rejection, then a refused draft's
   * `DraftError`, or a failed save's `SaveError` and the `EditError` under its
   * `Patch` arm. Those sentences existed from Phase 2b-1 and had never been drawn:
   * `save_match`'s commonest rejection is `draftRefused`, which is a validation
   * answer naming a field rather than an infrastructure failure, and it belongs
   * beside the field the person was editing.
   *
   * **A committed save whose adoption failed is drawn as a success with a second
   * line.** `view.messages` is the outcome's own lines followed by anything to be
   * said beside them, and *the window is out of step* is one of those. The file
   * was written (`PROGRESS.md` D2); telling the person the save failed would
   * invite a retry of a write that already happened.
   *
   * **A committed save offers a re-seed and no *Dismiss*.** The model stops
   * accepting changes until a fresh projection has been seeded, and no transition
   * in it clears that — so a *Dismiss* here would draw a control that puts the
   * obligation out of sight without discharging it, which is exactly the defect
   * the 2c-2-2 review found. When this window cannot answer the re-seed the
   * control is disabled with the reason beside it, never absent.
   *
   * **The editor cannot be left while a save is in flight**, for 2c-1b's reason:
   * the request is authorized and cannot be cancelled, so unmounting would leave
   * it free to commit with its outcome drawn nowhere.
   *
   * **The conflict panel shows two sides and identifies nothing across them.** The
   * retained draft comes from `view.retainedDraft` — the model's walk over the
   * *conflict's own* buffers — and the disk side is `conflict.diskText`, the whole
   * file as the command layer read it, through `SourceText`. There is no attempt
   * anywhere here to find "the same snippet" in the disk version, and there must
   * not be: `MatchId` carries a revision and a parse-local node number, so
   * matching by index, trigger or projected field would silently pick the wrong
   * snippet after an external insertion or reorder. That is 2c-4b's confidence
   * work (consult Q5). The confirmed reload therefore closes this editor rather
   * than reseeding it, and the sentence at the confirmation step says so.
   *
   * **A conflict of either origin is drawn, and each panel says which origin it
   * has** — Phase 2d-6-6c-1, the 2d-6 record's §3 entries 10 and 23. A save
   * conflict stays inside the outcome panel, where the save that produced it is
   * described; an external conflict has no outcome at all (the session keeps it
   * in `externalConflict`, beside `outcome`), so it is drawn by a panel of its
   * own **outside the save-outcome branch**. Both open with
   * `tConflictOriginMessage`, and each names only the revisions its origin has:
   * `conflictRevisionsOf` answers three for a refused save and one for an
   * observation, so there is no *expected* or *found* to draw for the second.
   * What the two share — the retained draft, the whole-file disk text, the
   * reload warning, the copy and the choices — is one `comparison` snippet, so
   * the two arms cannot drift apart; which arm is drawn is decided by
   * `isExternalConflict`, the one tested guard, because the nested `source.kind`
   * does not narrow the model. **What no type forces** is that this markup draws
   * the origin line at all; `DetailPane.test.ts` reads it off the screen in both
   * languages.
   */

  const {
    match,
    file,
    documents,
    projections,
    save,
    create,
    reproject,
    adoptDiskVersion,
    adoptRecoveryDiskVersion,
    reportReceiver,
    acknowledgement,
    reportRecovery,
    standingConflictFor,
    close,
    clock = () => Date.now()
  }: {
    /** The snippet being edited, exactly as this window projects it. */
    match: MatchView;
    /** The file it lives in, for the person to see which one it is. */
    file: DocumentSummary | null;
    /**
     * Every file the window lists, in window order.
     *
     * **A function rather than an array, and read only by recovery**: the
     * destination list a recovery form opens with is derived at the moment it is
     * opened, and a captured array would offer files as the window held them when
     * this editor opened — which, after any re-read, is a list of revisions the
     * transaction would refuse.
     */
    documents: () => readonly DocumentSummary[];
    /** Every projection this window holds, read the same way and for the same reason. */
    projections: () => readonly DocumentView[];
    /**
     * Sends one save.
     *
     * **`BrowserState.saveMatch` and nothing else.** That method performs the
     * identity adoption a committed field save owes, before the answer is handed
     * back; `saveMatch` in `../ipc/commands` is the same call without it, and a
     * component that reached for it would succeed once and then hold a stale
     * identity for every later edit, save and selection lookup. Nothing in
     * TypeScript stops that, which is why it is written here.
     *
     * **The base revision is the session's own and is handed over explicitly**,
     * which is the last half of the 2c-3a-1 review's second finding. The wrapper
     * used to read its own projection's revision at the moment of the call, so an
     * editor opened at one revision over a window that had since re-read the file
     * was submitted as though it had been drafted at the newer one — and the core
     * found no conflict to report. `baseRevisionOf` is the read; nothing between
     * here and `save_match` substitutes another, and no signature can require this
     * argument to be the session's rather than the window's.
     *
     * @param id - The snippet to save, by the identity drafted against.
     * @param draft - What the snippet should say, as a whole.
     * @param baseRevision - The revision the draft was seeded from.
     * @param acknowledgement - The suspicions already shown to a person.
     * @returns The outcome and the adoption's fate, or a typed failure.
     */
    save: (
      id: MatchId,
      draft: MatchDraft,
      baseRevision: ContentRevision,
      acknowledgement: Acknowledgement
    ) => Promise<MatchSaveAnswer>;
    /**
     * Sends one recovery create.
     *
     * **`BrowserState.createMatch` and nothing else**, for the reason `save` above
     * is `BrowserState.saveMatch` and nothing else: that method performs the
     * adoption a committed create owes before the answer is handed back, and
     * `createMatch` in `../ipc/commands` is the same call without it. This editor
     * never calls it — it is handed to `RecoveryPanel`, which is
     * the only thing here that can create a snippet, and every recovery write ends
     * in the same `run_one_save` the other six writers do.
     */
    create: CreateARecoveredSnippet;
    /**
     * The freshly projected snippet of one identity, or why there is none.
     *
     * What `MatchEditorView.needsReprojection` asks for. A commit rebases the
     * baselines on what was *written*, which is right about presence and values
     * and says nothing about the new scalars' spelling, spans or decodability —
     * so eligibility is the one thing only a re-projection can refresh. It takes
     * the identity rather than answering "the selected snippet", because a person
     * who clicked elsewhere while the save was in flight must not have this
     * editor re-seeded from a different snippet.
     *
     * **It answers a reason, never a bare `null`.** A refusal becomes a sentence
     * on screen, and the one sentence this replaced named a single cause — *the
     * window is no longer showing the file* — which is false when the person
     * selected another snippet **in that same file**, and false again when a
     * commit's adoption failed.
     *
     * @param id - The identity to look for, as the session now holds it.
     * @returns The projection, or the reason this window has none for it.
     */
    reproject: (id: MatchId) => Reprojection;
    /** Leaves the editor. */
    /**
     * Installs the disk observation a conflict carried into the window.
     *
     * `BrowserState.adoptDiskVersion`, the sole frontend transition that moves
     * this window to the disk side of a conflict. It is called by
     * `reloadTheDiskVersion` and by nothing here, so the projection cannot be
     * replaced without this editor closing in the same call — and a `refused` from
     * it is honoured by closing nothing, while an `alreadyThere` is a success the
     * transition finishes on.
     */
    adoptDiskVersion: AdoptTheDiskVersion<MatchBuffers>;
    /**
     * The same door, for a conflict a **recovery create** of its own ran into.
     *
     * `BrowserState.adoptDiskVersion` again — the method is generic and this is a
     * second instantiation of it, not a second transition. Two props rather than
     * one because `AdoptTheDiskVersion<T>` is contravariant in the drafted value:
     * this editor's conflicts retain `MatchBuffers` and a recovery form's retain
     * the two authored strings, and one prop could not be typed for both. The
     * panel is the only thing here that is handed this one.
     */
    adoptRecoveryDiskVersion: AdoptTheDiskVersion<CreationBuffers>;
    /**
     * Reports this editor's observation receiver to the host — Phase 2d-6-6b, the
     * 2d-6 record's §3 entry 1.
     *
     * **Required**, so a host cannot mount this editor without a way to be told
     * what the window decided about its file. It is called once, when this
     * component starts, and the binding it answers is withdrawn when it is
     * destroyed; what the receiver does is `applyObservation` in
     * `../browser/matchEditor.ts`, installed over whatever this editor holds.
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
    /**
     * The same reporter, for the recovery form this editor mounts — handed to
     * `RecoveryPanel` untouched, because the form's session and destination live
     * inside that panel and the host registers it as a surface of its own
     * (entry 3).
     */
    reportRecovery: BindObservationReceiver;
    /**
     * What origin the window holds as standing for one file **now** —
     * `BrowserState.standingConflictFor`.
     *
     * The live half of the reapply's `StandingOriginGuard` (`../browser/reapply.ts`):
     * this editor asks it about its own file at the end of the entry, and the
     * recovery panel about its destination. Nothing in TypeScript forces a host to
     * hand the window's answer rather than a captured one.
     */
    standingConflictFor: (document: DocumentId) => ConflictSource | null;
    close: () => void;
    /**
     * Where the typing group's boundary readings come from.
     *
     * **The model has no default and this does**, which is the difference between
     * a rule and a wiring. `startMatchEditor` refuses to name `Date.now` because a
     * boundary decided by real time is a boundary no test can drive; this is the
     * one place in the running application that supplies it, and a test that wants
     * to drive the boundary passes its own.
     */
    clock?: Clock;
  } = $props();

  // `$state.raw`, not `$state`: a session is an immutable value replaced whole on
  // every transition, and its draft holds deep-frozen snapshots a reactive proxy
  // has no business walking.
  //
  // **Capturing the initial projection is the whole point**, which is why the
  // warning is suppressed rather than designed around. A session that re-derived
  // itself from its prop would be discarded every time the workspace re-read the
  // file — which it does after every committed save and after every conflict —
  // taking the draft with it. The projection is read once, here; `reproject` is
  // the only way a later one enters, and only when the model asks for it.
  // svelte-ignore state_referenced_locally
  let session = $state.raw(startMatchEditor(match, clock));
  const view = $derived(matchEditorView(session));

  /*
   * **The receiver, reported when this editor starts and withdrawn when it is
   * destroyed** — Phase 2d-6-6b. A synchronous call in the component's own
   * initialisation rather than an effect: the host registers this editor as a
   * write surface from an effect of its own, which runs after this, so a surface
   * the coordinator can see always has its receiver. The receiver installs
   * `applyObservation`'s answer over the session held **now**, so a delivery that
   * arrives during this editor's own save is held inside the session and
   * consumed by `applySave` (entry 5). The binding is instance-bound: a later
   * editor's report displaces this one, and this one's withdrawal then reaches
   * nothing.
   */
  // svelte-ignore state_referenced_locally
  const receiving = reportReceiver((delivery) => {
    session = applyObservation(session, delivery);
  });
  onDestroy(() => {
    receiving.withdraw();
  });

  /**
   * The last *Keep my draft* attempt, or `null` when this panel has made none.
   *
   * **Held with the session it produced**, which is what stops a report outliving
   * what it describes: `reapplyToShow` answers `null` the moment `session` is
   * replaced by anything else, and every transition in the model returns a new
   * value. Nothing here has to remember to clear it.
   */
  let reapplyAttempt = $state.raw<EditorReapplyAttempt | null>(null);

  /** What the last attempt left this panel to say, or `null`. */
  const reapplyReport = $derived(reapplyToShow(reapplyAttempt, session));

  /**
   * Whether recovery has anything to offer, and what it would work from.
   *
   * **Read from the report rather than from the attempt**, so the offer lives
   * exactly as long as the answer that justifies it: `reapplyToShow` is `null` the
   * moment the session is replaced, and recovery's entry condition is a reapply
   * that resolved **nothing** and adopted nothing. The files and the projections
   * are read here rather than captured, so a destination that has stopped being
   * writable stops being offered.
   */
  const recovery = $derived(
    recoveryAvailability('matchFields', reapplyReport, view.conflict, documents(), projections())
  );

  /** Whether leaving the editor is waiting on a confirmation. */
  let leaving = $state(false);

  /**
   * What became of one *Copy my text*, and exactly what it was about — Phase
   * 2d-6-6c-2, the shape 2d-6-6c-1's review gave the creator.
   *
   * The conflict on screen when the copy was asked for, by identity, and the text
   * that was handed to the clipboard. Both are needed: a later change to the file
   * replaces the conflict with a new object over the same retained draft, and a
   * save conflict and an external one can retain drafts that render alike.
   */
  interface CopyDisclosure {
    /** The conflict whose retained draft was copied. */
    readonly conflict: ConflictModel<MatchBuffers>;
    /** The exact text handed to the clipboard. */
    readonly text: string;
    /** Whether the clipboard took it. */
    readonly result: 'copied' | 'failed';
  }

  /** What became of the last *Copy my text*, so the person is told either way. */
  let copied = $state.raw<CopyDisclosure | null>(null);

  /**
   * What the copy disclosure may say about the retained draft **on screen now**.
   *
   * A disclosure is shown only while the conflict it was made under is still the
   * one on screen and the retained draft still renders to exactly the text that
   * was copied. A conflict replaced by a later change to the file is a different
   * snapshot, and nothing was copied of it. **What this compares is identity and
   * text, and what it cannot know** is whether the clipboard still holds that
   * text; the sentence says a copy was made, never that it is still there.
   */
  const copyShown = $derived(
    copied !== null &&
      copied.conflict === view.conflict &&
      copied.text === tDraftCopy(view.retainedDraft)
      ? copied.result
      : 'none'
  );

  /** The outcome panel's own element, so a reveal has something to point at. */
  let outcomePanel = $state<HTMLElement | null>(null);
  /** The conflict arm's row of controls, which is the second step's target. */
  let outcomeChoices = $state<HTMLElement | null>(null);

  /*
   * **The outcome panel’s appearance asks for a scroll into view** — 2c-4a-3c's
   * findings 10.3 and 10.4, and **this surface is where 10.3 was a Medium rather
   * than a Low**. The window reading measured this panel's top at y = 720 in
   * English and y = 771 in Spanish in a 728 px viewport, 1 044 px tall, with
   * `section.detail`'s `scrollTop` at `0` and nothing moving it — so a person who
   * pressed *Save this snippet* and hit a conflict saw eight pixels of it in
   * English and none of it at all in Spanish, and the editor above was unchanged in
   * size and position across the save, so nothing in the visible region marked that
   * anything had happened.
   *
   * The decision is `./reveal.ts`'s and the two `bind:this` targets are this file's.
   */
  /**
   * The external conflict on screen, narrowed, or `null` — Phase 2d-6-6c-1.
   *
   * Through `isExternalConflict` rather than `view.conflict.source.kind`: the nested
   * discriminant narrows the source and leaves the model the union (the 2d-6
   * record's §3 entry 10), so this is the one place the panel below learns that it
   * may read the external arm.
   */
  const external = $derived(
    view.conflict !== null && isExternalConflict(view.conflict) ? view.conflict : null
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
          surfaceAcknowledgementOwed(view.externalNotices),
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
    const answer: { refusal: ReconciliationRefusal | null } = { refusal: null };
    session = acknowledgeSnapshot(session, (source) => {
      answer.refusal = acknowledgement.acknowledge(source);
      return answer.refusal === null ? 'acknowledged' : 'refused';
    });
    return answer.refusal;
  } // End of function acknowledgeTheSnapshot()

  // **An external conflict is revealed as a conflict panel is** (Phase 2d-6-6c-1):
  // it has no outcome arm, so the cue is `conflict` while it shows and no outcome
  // does. A `saved` or `refused` outcome kept as history beside it keeps its own
  // cue, because that panel is the one whose appearance the person caused.
  const reveal = $derived(
    outcomeReveal(
      view.outcome?.kind ?? (external !== null ? 'conflict' : null),
      view.awaitingReloadConfirmation
    )
  );
  /**
   * Whether the outcome panel, rather than the external one, is the reveal's
   * target. A boolean `$derived` rather than a read of `view` inside the effect:
   * `view` is a new object on every transition, so the effect would re-run — and
   * ask for a scroll again — on transitions that changed no cue.
   */
  const outcomeShown = $derived(view.outcome !== null);
  $effect(() => {
    revealOutcome(reveal, outcomeShown ? outcomePanel : externalPanel, outcomeChoices);
  });

  /** The reapply report's own block, so an answer to a press can be seen. */
  let reapplyPanel = $state<HTMLElement | null>(null);

  /*
   * **2c-4b-3c-2's §11.1, on the surface that produced the tallest panel.** The
   * report is drawn *above* the outcome panel, and until this effect existed
   * nothing pointed a viewport at it: that reading measured it entirely above the
   * scrollport in all 42 of its refusal launches, with the outcome panel below it
   * at pixel-identical coordinates, so pressing *Keep my draft* and being refused
   * changed nothing visible and a second press repeated the invisible answer.
   *
   * **`reapplyReport` is read inside the effect on purpose.** The cue is a string
   * and a second refusal produces the same string, so an effect depending on the
   * cue alone would not re-run; the report *object* is rebuilt by every press,
   * because each transition returns a fresh outcome. Nothing in Svelte or in
   * TypeScript enforces that ordering — it is why the call is written this way
   * rather than lifted into a `$derived`.
   */
  $effect(() => {
    revealReapplyReport(reapplyReveal(reapplyReport?.kind ?? null), reapplyPanel);
  });

  /**
   * The projection this editor would re-seed from, or `null`.
   *
   * Asked for **before** the control is drawn rather than only when it is clicked,
   * so a re-seed this window cannot perform is a disabled control with a sentence
   * beside it rather than a button that does nothing. `reproject` is a lookup and
   * is asked only while one is owed.
   */
  const reprojected = $derived(view.needsReprojection ? reproject(session.match) : null);

  /**
   * Records whatever one field's control now holds.
   *
   * @param field - Which field.
   * @param text - The control's whole value.
   */
  function onTyped(field: EditableField, text: string): void {
    session = editField(session, field, text);
  } // End of function onTyped()

  /**
   * Records that one field has the focus, which ends any group in another.
   *
   * @param field - The field that now has it.
   */
  function onFocus(field: EditableField): void {
    session = focusField(session, field);
  } // End of function onFocus()

  /** Records that no field has the focus, which ends the open typing group. */
  function onBlur(): void {
    session = focusField(session, null);
  } // End of function onBlur()

  /**
   * Asks for one field's key to be taken out of the file.
   *
   * @param field - Which field.
   */
  function onRemove(field: EditableField): void {
    session = removeField(session, field);
  } // End of function onRemove()

  /**
   * Takes back a removal, leaving the field holding what it held.
   *
   * @param field - Which field.
   */
  function onRestore(field: EditableField): void {
    session = restoreField(session, field);
  } // End of function onRestore()

  /**
   * Puts one suggested value into its field's box — an exact string from the
   * model's list, as its own history step (`applySuggestion` refuses anything
   * else).
   *
   * @param field - Which field.
   * @param value - The suggestion pressed.
   */
  function onSuggest(field: EditableField, value: string): void {
    session = applySuggestion(session, field, value);
  } // End of function onSuggest()

  /**
   * Drafts a change of content kind, unconfirmed.
   *
   * @param to - The content key to switch to.
   */
  function onSwitch(to: ContentForm): void {
    session = chooseContentSwitch(session, to);
  } // End of function onSwitch()

  /** Confirms the drafted change of content kind after its preview. */
  function onConfirmSwitch(): void {
    session = confirmContentSwitch(session);
  } // End of function onConfirmSwitch()

  /** Withdraws the drafted change of content kind. */
  function onCancelSwitch(): void {
    session = cancelContentSwitch(session);
  } // End of function onCancelSwitch()

  /**
   * Drafts a change of trigger form, or an addition on a snippet with none —
   * `chooseTriggerForm` decides which, and refuses a form it does not offer.
   *
   * @param to - The form chosen.
   */
  function onChooseForm(to: TriggerShape): void {
    session = chooseTriggerForm(session, to);
  } // End of function onChooseForm()

  /** Confirms the drafted change of trigger form after its preview. */
  function onConfirmForm(): void {
    session = confirmTriggerForm(session);
  } // End of function onConfirmForm()

  /** Withdraws the drafted trigger form: a change's cancellation or an addition's. */
  function onWithdrawForm(): void {
    session = cancelTriggerForm(session);
  } // End of function onWithdrawForm()

  /**
   * Records whatever the `regex` box now holds. The model refuses a line break
   * or a carriage return, and compiles nothing: the Rust validator does, on save.
   *
   * @param text - The box's whole value.
   */
  function onRegexTyped(text: string): void {
    session = editRegex(session, text);
  } // End of function onRegexTyped()

  /**
   * Records whatever one list item's box now holds.
   *
   * @param field - Which list.
   * @param position - The item's position in the drafted list.
   * @param text - The box's whole value.
   */
  function onItemTyped(field: SequenceField, position: number, text: string): void {
    session = editListItem(session, field, position, text);
  } // End of function onItemTyped()

  /**
   * Adds one empty item at the end of a list.
   *
   * @param list - The list, as the view describes it.
   */
  function onAddItem(list: ListModel): void {
    session = addListItem(session, list.field, list.items.length);
  } // End of function onAddItem()

  /**
   * Takes one item out of a list; the model refuses the last one.
   *
   * @param field - Which list.
   * @param position - The item's position in the drafted list.
   */
  function onRemoveItem(field: SequenceField, position: number): void {
    session = removeListItem(session, field, position);
  } // End of function onRemoveItem()

  /**
   * Adds a whole list where the snippet holds none (`search_terms` only).
   *
   * @param field - Which list.
   */
  function onAddList(field: SequenceField): void {
    session = addList(session, field);
  } // End of function onAddList()

  /**
   * Takes a whole list out (`search_terms` only).
   *
   * @param field - Which list.
   */
  function onRemoveList(field: SequenceField): void {
    session = removeList(session, field);
  } // End of function onRemoveList()

  /**
   * The cursor action's advisory, held with the session it was answered for.
   *
   * **Held with the session**, as the reapply report is: the advisory is about
   * the body as it stood when the control was pressed, and every transition
   * returns a new session, so `cursorAdvisory` stops drawing it the moment
   * anything changes. Nothing here has to remember to clear it.
   */
  let cursorNotice = $state.raw<{
    readonly session: MatchEditorSession;
    readonly advisory: CursorAdvisory;
  } | null>(null);

  /** The advisory to draw now, or `null`. */
  const cursorAdvisory = $derived(
    cursorNotice !== null && cursorNotice.session === session ? cursorNotice.advisory : null
  );

  /**
   * *Insert cursor position* (ruling 18): hands the body box's selection to the
   * model and, when it answers a range, selects that range in the box.
   *
   * **The decision is `insertCursorPosition`'s** — insert, select the one marker,
   * or answer the several-markers advisory — and this only carries the box's
   * selection in (UTF-16 indices, which is what the model counts in) and the
   * answered range back out, after the box has been redrawn with the new text.
   *
   * @param box - The `replace` field's text area, or `null` when none is drawn.
   */
  async function onInsertCursor(box: HTMLTextAreaElement | null): Promise<void> {
    const selection =
      box === null
        ? { start: Number.NaN, end: Number.NaN }
        : { start: box.selectionStart, end: box.selectionEnd };
    const result = insertCursorPosition(session, selection);
    session = result.session;
    if (result.kind === 'advisory') {
      cursorNotice = { session: result.session, advisory: result.advisory };
      return;
    }
    cursorNotice = null;
    if (result.kind === 'unavailable' || box === null) {
      return;
    }
    await tick();
    box.focus();
    box.setSelectionRange(result.selection.start, result.selection.end);
  } // End of function onInsertCursor()

  /** Goes back one step. */
  function onUndo(): void {
    session = undoEdit(session);
  } // End of function onUndo()

  /** Goes forward one step. */
  function onRedo(): void {
    session = redoEdit(session);
  } // End of function onRedo()

  /** Puts the outcome panel away and gives the controls back. */
  function onDismiss(): void {
    session = keepEditing(session);
  } // End of function onDismiss()

  /**
   * Seeds this editor again from a freshly projected snippet.
   *
   * **The only way out of `needsReprojection`, and the model makes it the only
   * way**: a committed save stops the session accepting changes and no transition
   * in `matchEditor.ts` clears the flag, so there is no *Dismiss* that resumes
   * editing on eligibility computed from bytes that have been replaced. It
   * discards nothing a person can lose — a commit leaves the draft clean by
   * definition, because the base moved to exactly what was written.
   */
  function reloadTheSnippet(): void {
    if (reprojected !== null && reprojected.kind === 'projected') {
      session = startMatchEditor(reprojected.match, clock);
    }
  } // End of function reloadTheSnippet()

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
    const held = session;
    const consented = acknowledge ? acknowledgeFindings(held) : held;
    // **The reader answers the consented session while the installed one is still
    // the session it was derived from**, and the installed session otherwise, so a
    // receiver that replaced it during the door's reads refuses the save
    // (`ReadTheInstalledSession` in `matchEditor.ts`).
    const started = beginSave(consented, () => (session === held ? consented : session));
    if (started === null) {
      return;
    }
    session = started.session;
    // A leaving confirmation raised before the save started is about a question
    // this save has just answered differently, and leaving is refused for as long
    // as one is in flight anyway.
    leaving = false;
    // The copy disclosure belongs to the conflict that was on screen, and
    // `copyShown` already hides it once that conflict is gone; clearing it here
    // as well drops a record nothing can draw again.
    copied = null;
    const answer = await save(
      started.session.match,
      started.draft,
      // **The session's own base, never the window's current projection.** The
      // three values that travel together — the identity, the draft and the
      // revision they were drafted against — all come from the same session here,
      // so a window that re-read the file while this editor was open produces a
      // conflict rather than a silent commit into a parse nobody saw.
      baseRevisionOf(started.session),
      acknowledgementOf(started.submission)
    );
    // Three arms, and each says something different about the file. `notAttempted`
    // is this window refusing before a command ran — nothing was sent, so nothing
    // was written and there is no reason to show. `failed` is a command that ran
    // and rejected, and it always carries why.
    if (answer.kind === 'answered') {
      session = applySave(session, answer.result, answer.adoption, () => session);
      return;
    }
    session =
      answer.kind === 'notAttempted'
        ? saveCouldNotBeSent(session, false, null, () => session)
        : saveCouldNotBeSent(session, answer.mayHaveWritten, answer.failure, () => session);
  } // End of function runSave()

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
    session = keepEditing(session);
  } // End of function refusalAction()

  /**
   * Puts a labelled reference copy of the retained draft on the clipboard.
   *
   * **What is copied is what the panel drew**: `view.retainedDraft` is the one
   * list, `tDraftCopy` is the one renderer of it, and neither is assembled here.
   * It is a reference — labels, exact text, and what a save would do with each key
   * — and it is **never YAML**, which would drop comments, key order and scalar
   * spelling while looking like something that could be pasted back into a
   * configuration file (consult Q4).
   *
   * **A refusal is disclosed rather than swallowed**, and one is reachable: a
   * value holding a real carriage return cannot go through the selection carrier
   * without being changed, so `copyReferenceText` refuses that route.
   *
   * **What the refusal sentence may not say is that the panel can be copied by
   * hand instead**, which is the 2c-4a-3a review's finding 1: `SourceText`
   * replaces every character no font draws — a carriage return, a NUL, a
   * zero-width space, a BOM — with its *localized name*, so what a person selects
   * off the panel is prose where those characters were. The sentence says the copy
   * failed, says that the display names such characters rather than printing them,
   * and warns that loading the disk version discards the draft either way. It does
   * not promise a recovery this application cannot give.
   */
  async function copyTheDraft(): Promise<void> {
    const conflict = view.conflict;
    if (conflict === null) {
      return;
    }
    // **The snapshot is taken before the clipboard is asked**, and the answer is
    // recorded against it: the clipboard answers asynchronously, and by then a
    // delivery may have replaced the conflict. `copyShown` then shows it only
    // while that snapshot is still the one on screen, so a late answer about an
    // old snapshot is recorded and never drawn over a new one.
    const text = tDraftCopy(view.retainedDraft);
    const result = (await copyReferenceText(text)) ? 'copied' : 'failed';
    copied = { conflict, text, result };
  } // End of function copyTheDraft()

  /**
   * Tries what this panel is holding again, against the version on disk.
   *
   * **Two model calls and two assignments, and no rule of its own.**
   * `reapplyToDiskVersion` decides the whole rebase before it asks the window to
   * move, and `attemptOfReapply` is what decides which arms replace the session —
   * that question is answered once, in `../browser/reapply.ts`, because five panels
   * ask it and a rule written into one renderer is carried by that renderer's
   * mounted suite alone.
   */
  function keepMyDraft(): void {
    // **The outcome first, then the session still installed** (the 2d-6-6a
    // review, its third finding): a refused reapply leaves whatever a receiver
    // installed during it, and folding it into a session read beforehand would
    // reinstall the capture.
    //
    // **The standing-origin guard is the window's own answer** (Phase 2d-6-6b),
    // asked about this editor's file, which is the file its conflict is about.
    const document = session.match.document;
    const outcome = reapplyToDiskVersion(
      session,
      adoptDiskVersion,
      () => standingConflictFor(document),
      () => session
    );
    const attempt = attemptOfReapply(session, outcome);
    reapplyAttempt = attempt;
    session = attempt.session;
  } // End of function keepMyDraft()

  /**
   * Does what one conflict choice says.
   *
   * **All four arms are reachable as of 2c-4a-3a.** `matchEditor.ts`'s
   * `CONFLICT_CAPABILITIES` records that this surface's draft **is** authored text
   * a clipboard can preserve, and both its booleans are now `true`, so
   * `conflictChoicesFor` names *Copy my text* and the two reload labels and this
   * panel draws them. The transitions behind them were built and wired at 2c-4a-2
   * and are driven by `matchEditor.test.ts`; what this step added is the controls
   * and the copy.
   *
   * **What the exhaustive switch forces, and what it does not.** A *new member* of
   * `ConflictChoice` fails to compile here, because every existing member is named
   * and there is no `default`. A *newly offered* member does not — offering is the
   * model's, and a choice becomes a control the moment `conflictChoicesFor` names
   * it. No type in this file could have forced that an arm does anything, which is
   * why the mounted suite presses every control this panel draws.
   *
   * @param choice - The choice the person picked.
   */
  function conflictAction(choice: ConflictChoice): void {
    switch (choice) {
      case 'keepEditing':
        session = keepEditing(session);
        copied = null;
        return;
      case 'keepMyDraft':
        keepMyDraft();
        return;
      case 'reloadDiskVersion':
        session = askToReloadDiskVersion(session);
        return;
      case 'confirmReload': {
        // **Two calls, one click**, exactly as the raw editor's reload is: the
        // two steps a person sees are the warning and this press. The window
        // is what decides whether the adoption happened, and the session ends
        // only if it did — so a refusal leaves this panel open rather than
        // closing over a window that never moved.
        //
        // **The reader answers the confirmed session while the installed one is
        // still the session it was derived from**, and the installed session
        // otherwise, so a delivery that displaced it is answered rather than
        // overwritten (Phase 2d-6-6b; `reloadTheDiskVersion` in `matchEditor.ts`).
        const held = session;
        const confirmed = confirmDiskReload(held);
        const reloaded = reloadTheDiskVersion(confirmed, adoptDiskVersion, () =>
          session === held ? confirmed : session
        );
        session = reloaded;
        if (reloaded.closed) {
          close();
        }
        return;
      }
      case 'copyDraft':
        void copyTheDraft();
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
   * Leaves the editor, asking first when there is an unsaved draft to lose.
   *
   * **Refused outright while a save is in flight**, which is 2c-1b's fourth
   * finding: the request has already been authorized and cannot be cancelled, so
   * unmounting would leave it free to commit with its outcome drawn nowhere. The
   * control is disabled for the same reason rather than only guarded here — a
   * disabled control says *not now*, where a silent no-op says nothing.
   */
  function requestClose(): void {
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
    if (view.saving) {
      return;
    }
    close();
  } // End of function discardAndClose()
</script>

<!-- **What a conflict of either origin shows beside its own lines** — Phase
     2d-6-6c-1. One snippet for both panels rather than two copies, so the retained
     draft, the disk side, the reload warning, the copy and the choices cannot drift
     apart between the save arm and the external arm (the 2d-6 record's §3 entry
     23). Only one conflict is active at a time (entry 7), so the one
     `outcomeChoices` element it binds belongs to whichever panel is drawn. -->
{#snippet comparison()}
  <h3>{t('browser.saveOutcome.retainedDraft')}</h3>
  <!-- The conflict's **own** retained buffers, walked by the model, and the
       same list the copy is built from. Through `SourceText` rather than
       into boxes: nothing here is editable while the panel is up, and a
       projected value may hold a real carriage return that a text control
       would silently draw as an ordinary line break. -->
  {#each view.retainedDraft as field (field.label)}
    <div class="shownValue">
      <span class="marker">{tDetailField(field.label)}</span>
      <span class="marker">{tDraftFieldStatus(field.status)}</span>
      <SourceText text={field.text} />
    </div>
  {/each}

  <h3>{t('browser.saveOutcome.diskVersion')}</h3>
  <!-- The whole file as the command layer read it, paired with
       `diskRevision`. **Not** "the same snippet in the disk version": there
       is no trustworthy correspondence across revisions and inventing one is
       2c-4b (consult Q5). Which arm is drawn is `conflictDiskText`'s
       decision and not this markup's: *a file of zero characters is a fact
       about the file rather than a failure to obtain it* was written into
       three renderers until the 2c-4a-3a review's finding 5. -->
  {#if view.diskText !== null && view.diskText.kind === 'text'}
    <SourceText text={view.diskText.text} documentStart />
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

  <!-- The second step's warning. The shared line above is the whole
       close/abandon guarantee and this one never restates it (2c-4a-3b
       review, finding 3); it says only what this surface alone can say —
       that no snippet in the new version will be guessed at, and what to do
       about that afterwards. -->
  {#if view.awaitingReloadConfirmation}
    <p class="kind">{t('browser.matchEditor.reloadIdentifiesNoSnippet')}</p>
  {/if}

  <!-- A control that has just gone, with the reason in its place. The reload
       is not offered again once the window has refused a spend, because the
       refusal came back with no word about its cause. That withholds a
       control; it claims nothing about how a later ask would be answered. -->
  {#if view.reloadUnavailable}
    <p class="kind">{tReloadUnavailable(CONFLICT_CAPABILITIES.draftKind)}</p>
  {/if}

  <p class="kind">{t('browser.saveOutcome.copyIsReference')}</p>
  {#if copyShown === 'copied'}
    <p class="kind">{t('browser.saveOutcome.draftCopied')}</p>
  {:else if copyShown === 'failed'}
    <p class="kind">{t('browser.saveOutcome.draftCopyFailed')}</p>
  {/if}

  <!-- The line beside *Keep my draft*: what this app will **try**, what it
       works from, when it writes nothing, and what a later save may still
       do. Drawn when the model names that choice and never from this
       surface's own declaration, so the sentence and the control cannot
       disagree (consult Q6). -->
  {#if view.reapplyOffered}
    <p class="kind">{tReapplyReadiness(CONFLICT_CAPABILITIES.draftKind)}</p>
  {/if}

  <p class="choices" bind:this={outcomeChoices}>
    {#each view.conflictChoices as choice (choice)}
      <button type="button" onclick={() => conflictAction(choice)}>
        {tConflictChoice(choice, CONFLICT_CAPABILITIES.draftKind)}
      </button>
    {/each}
  </p>
{/snippet}

<!-- One field's block: its label, its control or what it shows instead, and
     whatever the model says beside it. One snippet for every section, so a field
     is drawn the same way under every heading. -->
{#snippet fieldBlock(field: EditableFieldModel)}
  <div class="field">
    {#if field.refusal !== null}
      <!-- Shown and not edited. Through `SourceText` rather than a disabled
           control, because a text control's value normalises every carriage
           return to a line feed and this is exactly the value that may hold
           one — the box would misdraw the file even while refusing to write
           to it.

           **`field.shown`, never `field.text`.** One scalar is not what a
           refused field holds: a `triggers:` list has no scalar behind
           `trigger:` at all, so drawing `field.text` drew nothing and a person
           editing a multi-trigger snippet could see their triggers nowhere,
           because this editor replaces the whole detail pane while it is open.
           The model answers one entry per trigger. -->
      <p class="name">{tDetailField(field.label)}</p>
      {#each field.shown as one, index (index)}
        <div class="shownValue">
          <!-- Which key this value came from, when the field's own label does
               not say. A `Several` draws a `trigger:` box and a `regex:` box
               that are otherwise identical, and while this editor is open the
               detail pane that labels them is not on screen to consult. The
               name is the detail pane's own, through `tDetailField`; the model
               says why `tTriggerKind` will not do. -->
          {#if one.source !== null}
            <span class="marker">{tDetailField(one.source)}</span>
          {/if}
          <!-- **A caption per arm, because the two arms show different things.**
               One `valueAsWritten` above the whole list claimed every entry was
               the file's own bytes, and a `notScalar` entry is a *localized shape
               name* — so a nested list in `triggers:` was captioned "shown here
               as the file writes it" over the words "a list", which the file does
               not contain. Each entry now carries the caption that is true of it. -->
          {#if one.kind === 'text'}
            <span class="marker">{t('browser.detail.valueAsWritten')}</span>
            <SourceText text={one.text} />
          {:else}
            <span class="marker">{t('browser.matchEditor.shapeOnly')}</span>
            <span class="marker">{tValueKind(one.shape)}</span>
          {/if}
        </div>
      {/each}
      <p class="kind">{tFieldRefusal(field.refusal)}</p>
    {:else}
      <label>
        <span class="name">{tDetailField(field.label)}</span>
        <!-- The control is the model's decision (`fieldControlOf` in
             `matchEditor.ts`, Phase 3-5-1): a text input strips line breaks,
             so every field whose value may span lines is a text area. -->
        {#if field.control === 'multiLine'}
          <textarea
            class="text body"
            spellcheck="false"
            readonly={!field.editable}
            value={field.text}
            oninput={(event) => onTyped(field.field, event.currentTarget.value)}
            onfocus={() => onFocus(field.field)}
            onblur={() => onBlur()}
          ></textarea>
        {:else}
          <input
            class="text"
            type="text"
            spellcheck="false"
            readonly={!field.editable}
            value={field.text}
            oninput={(event) => onTyped(field.field, event.currentTarget.value)}
            onfocus={() => onFocus(field.field)}
            onblur={() => onBlur()}
          />
        {/if}
      </label>
      <!-- What a content key's role makes of its box (Phase 3-5-2-1). The model
           says which sentence is owed: *typing in it adds the key* is false for a
           dormant key, so `saysAbsent` is `false` wherever a role note speaks. -->
      {#if field.roleNote !== null}
        <p class="kind">{tContentRoleNote(field.roleNote)}</p>
      {/if}
      {#if field.saysAbsent}
        <p class="kind">{t('browser.matchEditor.fieldAbsent')}</p>
      {/if}
      <!-- **Suggestions are exact strings, offered and never imposed** (ruling
           10, D2u). Each is a button whose label is the value itself, as espanso
           spells it, in every language; pressing one puts exactly that string in
           the box. A value outside the list is kept as written, and the sentence
           under it says so without calling it wrong. -->
      {#if field.suggestions.length > 0}
        <p class="choices suggestions">
          <span class="marker">{t('browser.matchEditor.suggestions')}</span>
          {#each field.suggestions as suggestion (suggestion)}
            <button
              type="button"
              class="source"
              disabled={!field.editable}
              onclick={() => onSuggest(field.field, suggestion)}
            >
              {suggestion}
            </button>
          {/each}
        </p>
        {#if field.unfamiliar}
          <p class="kind">{t('browser.matchEditor.suggestions.unfamiliar')}</p>
        {/if}
      {/if}
      <!-- *Insert cursor position*, `replace` only (ruling 18) — which field
           carries it is the model's `cursorAction`. The box is found from the
           control's own block, so the selection handed over is this field's. -->
      {#if field.cursorAction}
        <p class="choices">
          <button
            type="button"
            onclick={(event) =>
              void onInsertCursor(
                event.currentTarget.closest('.field')?.querySelector('textarea') ?? null
              )}
          >
            {t('browser.matchEditor.cursor.insert')}
          </button>
        </p>
        <p class="kind">{t('browser.matchEditor.cursor.hint')}</p>
        {#if cursorAdvisory !== null}
          <p class="kind" role="status">{tCursorAdvisory(cursorAdvisory)}</p>
        {/if}
      {/if}
      <!-- **Gated on the intent, not on the buffer's flag.** The sentence says
           the key *will be* taken out when you save, and after a committed
           removal the buffer still carries `removed` while the file no longer
           has the key — so a flag-gated marker promised a future write of
           something already written. `field.intent` is what a save would
           actually say about this field. -->
      {#if field.intent === 'Remove'}
        <p class="kind">{t('browser.matchEditor.fieldRemoved')}</p>
      {/if}
      {#if field.present}
        <p class="choices">
          {#if field.removed}
            <button
              type="button"
              disabled={!field.canRestore}
              onclick={() => onRestore(field.field)}
            >
              {t('browser.matchEditor.restore')}
            </button>
          {:else}
            <button
              type="button"
              disabled={!field.canRemove}
              onclick={() => onRemove(field.field)}
            >
              {t('browser.matchEditor.remove')}
            </button>
          {/if}
        </p>
      {/if}
    {/if}
  </div>
{/snippet}

<!-- **One list, `triggers` or `search_terms`** (Phase 3-6-2, `ListModel`). A list
     the model refuses is drawn from `list.shown` through `SourceText`, each item
     captioned by what it is, with the refusal beside it — never as boxes, which
     would normalise a carriage return away. An editable list is one one-line box
     per item, in the drafted order, with its status marker; items are added at
     the end and taken out one at a time (never the last one), and nothing here
     reorders an item. The style note says how the file writes the list and that
     a save keeps it. -->
{#snippet listBlock(list: ListModel)}
  {@const styleNote = tListStyleNote(list.style)}
  <div class="field list">
    <p class="name">{tDetailField(list.label)}</p>
    {#if list.refusal !== null}
      {#each list.shown as one, index (index)}
        <div class="shownValue">
          {#if one.kind === 'text'}
            <span class="marker">{t('browser.detail.valueAsWritten')}</span>
            <SourceText text={one.text} />
          {:else}
            <span class="marker">{t('browser.matchEditor.shapeOnly')}</span>
            <span class="marker">{tValueKind(one.shape)}</span>
          {/if}
        </div>
      {/each}
      <p class="kind">{tListRefusal(list.refusal)}</p>
    {:else}
      {#if styleNote !== null}
        <p class="kind">{styleNote}</p>
      {/if}
      {#if list.saysAbsent}
        <p class="kind">{t('browser.matchEditor.list.absent')}</p>
      {/if}
      {#if list.removing}
        <p class="kind">{t('browser.matchEditor.list.removing')}</p>
      {/if}
      {#if list.saysEmpty}
        <p class="kind">{t('browser.matchEditor.list.empty')}</p>
      {/if}
      {#each list.items as item (item.position)}
        {@const status = tListItemStatus(item.status)}
        <!-- A list the draft takes out keeps its items in its buffer, and the model
             refuses an edit to any of them (`itemsEditable` is `false`), so they are
             shown through `SourceText` rather than as boxes that would keep typed
             text the draft never holds (Phase 3-6-2's review fix). -->
        {#if !list.present}
          <SourceText text={item.text} />
        {:else}
        <div class="item">
          <label>
            <span class="marker">
              {t('browser.matchEditor.list.item', { number: item.position + 1 })}
            </span>
            {#if status !== null}
              <span class="marker">{status}</span>
            {/if}
            <input
              class="text"
              type="text"
              spellcheck="false"
              readonly={!list.itemsEditable}
              value={item.text}
              oninput={(event) => onItemTyped(list.field, item.position, event.currentTarget.value)}
              onblur={() => onBlur()}
            />
          </label>
          <p class="choices">
            <button
              type="button"
              disabled={!list.canRemoveItem}
              onclick={() => onRemoveItem(list.field, item.position)}
            >
              {t('browser.matchEditor.list.removeItem')}
            </button>
          </p>
        </div>
        {/if}
      {/each}
      {#if list.lastItemKept}
        <p class="kind">{t('browser.matchEditor.list.lastItemKept')}</p>
      {/if}
      {#if list.present && list.removed.length > 0}
        <p class="kind">{t('browser.matchEditor.list.removedItems')}</p>
        {#each list.removed as item (item.origin)}
          <SourceText text={item.text} />
        {/each}
      {/if}
      <p class="choices">
        {#if list.present}
          <button type="button" disabled={!list.editable} onclick={() => onAddItem(list)}>
            {t('browser.matchEditor.list.addItem')}
          </button>
        {/if}
        {#if list.canAddList}
          <button type="button" onclick={() => onAddList(list.field)}>
            {t('browser.matchEditor.list.add')}
          </button>
        {/if}
        {#if list.canRemoveList}
          <button type="button" onclick={() => onRemoveList(list.field)}>
            {t('browser.matchEditor.list.remove')}
          </button>
        {/if}
      </p>
    {/if}
  </div>
{/snippet}

<!-- **The `regex` box** (Phase 3-6-2, `RegexFieldModel`). A pattern the
     projection refused is drawn through `SourceText` with its reason; otherwise a
     one-line box. Nothing here or in the model compiles the pattern: whether it
     compiles is the Rust validator's `RegexDoesNotCompile`, answered by a save and
     drawn in the refused outcome below, which keeps the draft. -->
{#snippet regexBlock()}
  {@const regex = view.structure.trigger.regex}
  <div class="field">
    {#if regex.refusal !== null}
      <p class="name">{tDetailField('regex')}</p>
      {#if regex.text !== ''}
        <div class="shownValue">
          <span class="marker">{t('browser.detail.valueAsWritten')}</span>
          <SourceText text={regex.text} />
        </div>
      {/if}
      <p class="kind">{tFieldRefusal(regex.refusal)}</p>
    {:else}
      <label>
        <span class="name">{tDetailField('regex')}</span>
        <input
          class="text"
          type="text"
          spellcheck="false"
          readonly={!regex.editable}
          value={regex.text}
          oninput={(event) => onRegexTyped(event.currentTarget.value)}
          onblur={() => onBlur()}
        />
      </label>
      <p class="kind">{t('browser.matchEditor.regex.hint')}</p>
    {/if}
  </div>
{/snippet}

<!-- **The trigger side** (Phase 3-6-2, `TriggerFormView`): the presentation's
     sentence and, for a `Several`, the raw-repair offer; the one control the model
     names; the choices of form, each offered or refused with its reason (a list of
     more than one item is refused with its count, never converted); and a drafted
     change's preview with its confirmation. The save is withheld until the
     confirmation (`view.saveWithheld`, drawn beside *Save*). -->
{#snippet triggerSide(literal: EditableFieldModel)}
  {@const side = view.structure.trigger}
  {@const presentation = tTriggerPresentation(side.presentation)}
  <div class="group" role="group" aria-label={t('browser.matchEditor.triggerForm.heading')}>
    <h3>{t('browser.matchEditor.triggerForm.heading')}</h3>
    {#if presentation !== null}
      <p class="kind">{presentation}</p>
    {/if}
    {#if side.presentation.kind === 'several'}
      <p class="kind">{tTriggerRepair(side.presentation.repair)}</p>
    {/if}
    {#if side.control === 'literal' || side.control === 'heldForms'}
      {@render fieldBlock(literal)}
    {:else if side.control === 'regex'}
      {@render regexBlock()}
    {:else if side.control === 'triggers'}
      {@render listBlock(side.triggers)}
    {/if}
    {#if side.choices.length > 0}
      <p class="kind">{t('browser.matchEditor.triggerForm.offer')}</p>
      <p class="choices">
        {#each side.choices as choice (choice.to)}
          <button
            type="button"
            disabled={!choice.offered || choice.drafted || !view.editable}
            onclick={() => onChooseForm(choice.to)}
          >
            {tTriggerFormChoice(side.presentation, choice.label)}
          </button>
        {/each}
      </p>
      {#each side.choices as choice (choice.to)}
        {#if choice.offered === false}
          <p class="refusedChoice">
            <span class="marker">{tDetailField(choice.label)}</span>
            <span class="kind">{tTriggerFormRefusal(choice.refusal)}</span>
          </p>
        {/if}
      {/each}
    {/if}
    {#if side.preview !== null}
      {@const preview = side.preview}
      <div class="panel preview" role="status">
        <p>{t('browser.matchEditor.triggerForm.previewFrom', { form: tDetailField(preview.fromLabel) })}</p>
        <p>{t('browser.matchEditor.triggerForm.previewTo', { form: tDetailField(preview.toLabel) })}</p>
        <p class="kind">{tTriggerFormTextNote(preview)}</p>
        {#each preview.texts as text, index (index)}
          <SourceText {text} />
        {/each}
        {#if preview.confirmed}
          <p class="kind">{t('browser.matchEditor.triggerForm.confirmed')}</p>
        {/if}
        <p class="choices">
          {#if !preview.confirmed}
            <button type="button" disabled={!view.editable} onclick={() => onConfirmForm()}>
              {t('browser.matchEditor.triggerForm.confirm')}
            </button>
          {/if}
          {#if side.withdrawal !== null}
            <button type="button" disabled={!view.editable} onclick={() => onWithdrawForm()}>
              {tTriggerWithdrawal(side.withdrawal)}
            </button>
          {/if}
        </p>
      </div>
    {:else if side.withdrawal !== null}
      <p class="choices">
        <button type="button" disabled={!view.editable} onclick={() => onWithdrawForm()}>
          {tTriggerWithdrawal(side.withdrawal)}
        </button>
      </p>
    {/if}
  </div>
{/snippet}

<!-- **The change of content kind** (ruling 8, Phase 3-5-2-1): the choices, then
     the preview of a drafted switch — what is renamed, whether the text is kept
     as written, which companion keys stay — and its confirmation. The save is
     withheld until the confirmation (`view.saveWithheld`, drawn beside *Save*);
     undo takes back the choice and the confirmation one step each. -->
{#snippet contentKind()}
  <div class="group" role="group" aria-label={t('browser.matchEditor.switch.heading')}>
    <h3>{t('browser.matchEditor.switch.heading')}</h3>
    <p class="kind">{t('browser.matchEditor.switch.offer')}</p>
    {#if view.switchChoices.length > 0}
      <p class="choices">
        {#each view.switchChoices as choice (choice.to)}
          <button
            type="button"
            disabled={choice.drafted || !view.editable}
            onclick={() => onSwitch(choice.to)}
          >
            {t('browser.matchEditor.switch.to', { kind: tDetailField(choice.label) })}
          </button>
        {/each}
      </p>
    {/if}
    {#if view.contentSwitch !== null}
      {@const preview = view.contentSwitch}
      <div class="panel preview" role="status">
        <p>
          {t('browser.matchEditor.switch.preview', {
            from: tDetailField(preview.fromLabel),
            to: tDetailField(preview.toLabel)
          })}
        </p>
        <p class="kind">
          {preview.textKept
            ? t('browser.matchEditor.switch.textKept')
            : t('browser.matchEditor.switch.textEdited')}
        </p>
        <!-- The companion keys are drawn as the file spells them: they are keys
             in the file, and the preview is about which of them stay. -->
        {#if preview.companionsKept.length > 0}
          <p class="kind">{t('browser.matchEditor.switch.companionsKept')}</p>
          <ul>
            {#each preview.companionsKept as key (key)}
              <li><code class="source">{key}</code></li>
            {/each}
          </ul>
        {:else if preview.companionsRemoved.length === 0}
          <p class="kind">{t('browser.matchEditor.switch.noCompanions')}</p>
        {/if}
        {#if preview.companionsRemoved.length > 0}
          <p class="kind">{t('browser.matchEditor.switch.companionsRemoved')}</p>
          <ul>
            {#each preview.companionsRemoved as key (key)}
              <li><code class="source">{key}</code></li>
            {/each}
          </ul>
        {/if}
        {#if preview.confirmed}
          <p class="kind">{t('browser.matchEditor.switch.confirmed')}</p>
        {/if}
        <p class="choices">
          {#if !preview.confirmed}
            <button type="button" disabled={!view.editable} onclick={() => onConfirmSwitch()}>
              {t('browser.matchEditor.switch.confirm')}
            </button>
          {/if}
          <button type="button" disabled={!view.editable} onclick={() => onCancelSwitch()}>
            {t('browser.matchEditor.switch.cancel')}
          </button>
        </p>
      </div>
    {/if}
  </div>
{/snippet}

<section class="matchEditor" aria-label={t('browser.matchEditor.label')}>
  <div class="head">
    {#if file !== null}
      <dl>
        <dt>{t('browser.detail.file')}</dt>
        <dd class="source">{file.relative_path}</dd>
      </dl>
    {/if}
    {#if view.dirty}
      <span class="marker warn">{t('browser.matchEditor.unsaved')}</span>
    {/if}
    <button type="button" disabled={view.saving} onclick={() => requestClose()}>
      {t('browser.matchEditor.close')}
    </button>
  </div>

  {#if view.editability.kind === 'blocked'}
    <p class="blocked">
      {t('browser.detail.notEditable', { kind: tHazard(view.editability.hazard) })}
    </p>
  {:else if view.editability.kind === 'blockedUnnamed'}
    <p class="blocked">{t('browser.detail.notEditableUnnamed')}</p>
  {/if}

  {#if view.identityStale}
    <p class="panel">{t('browser.matchEditor.identityStale')}</p>
  {/if}

  {#if view.saving}
    <p class="kind">{t('browser.matchEditor.savingCannotBeStopped')}</p>
  {/if}

  {#if leaving}
    <div class="panel">
      <p>{t('browser.matchEditor.discardWarning')}</p>
      <p class="choices">
        <button type="button" disabled={view.saving} onclick={() => discardAndClose()}>
          {t('browser.matchEditor.discard')}
        </button>
        <button type="button" onclick={() => (leaving = false)}>
          {tRawSaveChoice('keepEditing', CONFLICT_CAPABILITIES.draftKind)}
        </button>
      </p>
    </div>
  {/if}

  <!-- **The sections are the model's** (`view.sections`, Phase 3-5-2-1): the
       trigger side (Phase 3-6-2), the five content keys, the change of content
       kind directly under them when there is one to offer or show, the label and
       the comment, `search_terms` (Phase 3-6-2), then the four option groups under the detail pane's own headings. Each
       option is a text box and never a checkbox (D2u); the *Insertion* group
       holds `force_mode` and `force_clipboard` as two boxes, each with its own
       label, and nothing here relates one to the other. -->
  {#each view.sections as section, index (index)}
    {#if section.kind === 'contentSwitch'}
      {@render contentKind()}
    {:else if section.kind === 'triggerSide'}
      {@render triggerSide(section.literal)}
    {:else if section.kind === 'searchTerms'}
      {@render listBlock(view.structure.searchTerms)}
    {:else if section.group !== null}
      <div class="group" role="group" aria-label={tOptionGroup(section.group)}>
        <h3>{tOptionGroup(section.group)}</h3>
        {#each section.fields as field (field.field)}
          {@render fieldBlock(field)}
        {/each}
      </div>
    {:else}
      {#each section.fields as field (field.field)}
        {@render fieldBlock(field)}
      {/each}
    {/if}
  {/each}

  <p class="choices">
    <button type="button" disabled={!view.canUndo} onclick={() => onUndo()}>
      {t('browser.matchEditor.undo')}
    </button>
    <button type="button" disabled={!view.canRedo} onclick={() => onRedo()}>
      {t('browser.matchEditor.redo')}
    </button>
    <button type="button" disabled={!view.canSave} onclick={() => void runSave(false)}>
      {t('browser.matchEditor.save')}
    </button>
    {#if view.saving}
      <span class="marker">{t('browser.matchEditor.saving')}</span>
    {/if}
  </p>
  <!-- Why a dirty draft cannot be saved yet, beside the control it disables. -->
  {#if view.saveWithheld !== null}
    <p class="kind">{tSaveWithheld(view.saveWithheld)}</p>
  {/if}

  <!-- A reading the window holds undecided and an unknown write outcome are said
       once, above this panel, by the pane's `FileReconciliationStatus.svelte`
       block, so this panel no longer draws its own notices (Phase 2d-6-9b-2);
       the acknowledgement is drawn under the disk snapshot in the conflict panel. -->

  {#if view.sendFailure !== null}
    {@const failure = view.sendFailure}
    <div class="panel">
      <p>
        {failure.kind === 'mayHaveWritten'
          ? t('browser.matchEditor.mayHaveWritten')
          : t('browser.matchEditor.sendFailed')}
      </p>
      {#if view.failureLines.length > 0}
        <p class="kind">{t('browser.matchEditor.failureReason')}</p>
        {#each view.failureLines as line, index (index)}
          <p>
            {#if line.kind === 'failure'}
              {tIpcFailure(line.failure)}
            {:else if line.kind === 'draft'}
              {tDraftError(line.error)}
            {:else if line.kind === 'save'}
              {tSaveError(line.error)}
            {:else}
              {tEditError(line.error)}
            {/if}
          </p>
        {/each}
      {/if}
    </div>
  {/if}

  <!-- What the last *Keep my draft* left to say. Outside the outcome panel on
       purpose: a reapply that succeeded hands back a session with no outcome at
       all, so a report drawn inside that block would disappear at the moment it
       had something to report. `reapplyToShow` is what keeps it from outliving the
       session it describes. -->
  {#if reapplyReport !== null}
    {@const report = reapplyReport}
    <!-- `reapply` distinguishes this block from the outcome panel below it, which
         carries the same class and the same role; `bind:this` is what lets
         `revealReapplyReport` point at it (2c-4b-3c-2 §11.1). -->
    <div class="panel reapply" role="status" bind:this={reapplyPanel}>
      <p>{tReapplyOutcome(report.kind)}</p>
      {#if report.kind === 'manualResolution'}
        <p class="kind">{tEditorReapplyObstacle(report.obstacle)}</p>
      {/if}
    </div>
  {/if}

  <!-- The way out of a conflict nothing could resolve automatically. **Outside the
       outcome panel on purpose**, for the reason the reapply report is: a form the
       person has begun to fill in must not be taken away by *Keep editing* on the
       conflict above it. What it draws when there is nothing to offer is
       `recoveryIsAnswerable`'s decision and not this markup's. -->
  <RecoveryPanel
    availability={recovery}
    open={() =>
      startMatchFieldRecovery(
        reapplyReport,
        view.conflict,
        session.baseline,
        documents(),
        projections(),
        clock
      )}
    {create}
    adoptDiskVersion={adoptRecoveryDiskVersion}
    reportSurface={reportRecovery}
    {acknowledgement}
    {standingConflictFor}
  />

  <!-- **The external conflict, outside the save-outcome branch** (the 2d-6 record's
       §3 entry 10). The origin line first, then the model's own lines for this
       origin — never `view.messages`, which are a save's — then the one revision
       an observation has, then everything the save panel shows (entry 23). -->
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
      {@render comparison()}
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
          <p class="kind">{t('browser.matchEditor.notes')}</p>
          <ul>
            {#each view.notes as note, index (index)}
              <li>{tPresentationNote(note)}</li>
            {/each}
          </ul>
        {/if}
        {#if view.needsReprojection}
          <p class="kind">{t('browser.matchEditor.needsReprojection')}</p>
          {#if reprojected !== null && reprojected.kind === 'unavailable'}
            <p class="kind">{tReprojectionRefusal(reprojected.reason)}</p>
          {/if}
        {/if}
        <!-- **No *Dismiss* while a re-projection is owed.** Dismissing used to
             clear the outcome and give the controls back, which put the
             obligation out of sight and let editing continue on eligibility
             computed from bytes the commit replaced. The model now refuses to
             accept changes until a fresh projection is seeded, so the only
             honest offers here are the re-seed and leaving. -->
        <p class="choices">
          {#if view.needsReprojection}
            <button
              type="button"
              disabled={reprojected === null || reprojected.kind !== 'projected'}
              onclick={() => reloadTheSnippet()}
            >
              {t('browser.matchEditor.reload')}
            </button>
          {:else}
            <button type="button" onclick={() => onDismiss()}>
              {t('browser.notice.dismiss')}
            </button>
          {/if}
        </p>
      {:else if outcome.kind === 'refused'}
        <p class="kind">{tSaveVerdict(outcome.verdict)}</p>
        {#if outcome.findings.length > 0}
          <p class="kind">{t('browser.matchEditor.findings')}</p>
          <ul>
            {#each outcome.findings as finding, index (index)}
              <li>{tFindingCode(finding.code)}</li>
            {/each}
          </ul>
        {/if}
        {#if view.findingsAreStale}
          <p class="kind">{t('browser.matchEditor.findingsAreStale')}</p>
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
        <p class="kind">
          {t('browser.matchEditor.revisionExpected', { revision: conflict.expected })}
        </p>
        <p class="kind">{t('browser.matchEditor.revisionFound', { revision: conflict.found })}</p>
        <p class="kind">
          {t('browser.matchEditor.revisionDisk', { revision: conflict.diskRevision })}
        </p>

        {@render comparison()}
      {/if}
    </div>
  {/if}
</section>

<style>
  .matchEditor {
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

  /* One section of fields under its heading: an option group, or the change of
     content kind. */
  .group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  /* One item of an editable list: its box, then its own *Take this item out*. */
  .item {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  /* A trigger form offered and refused: its name, then why. */
  .refusedChoice {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    margin: 0;
  }

  /* One piece of what a refused field holds, with the key it came from above it.
     A column, so the name sits on its own line and the value below keeps the full
     width `SourceText` needs to scroll sideways in. */
  .shownValue {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .name {
    color: var(--muted);
    font-size: 0.8125rem;
  }

  /* A field's value, in the face that means "this is what the document holds"
     (`src/app.css`) — the same one `SourceText` uses, because this box and that
     box show the same kind of thing. */
  .text {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.25rem 0.375rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-raised);
    color: inherit;
  }

  /* The replacement body is the one field that is routinely several lines, so it
     is the one that gets a resizable box. `white-space: pre` for `SourceText`'s
     reason: a soft wrap is indistinguishable from a line break the value does
     not contain. */
  .body {
    white-space: pre;
    overflow: auto;
    min-height: 8rem;
    resize: vertical;
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

  /* Anything this app says about a save rather than about the snippet: the three
     outcome arms, the leaving warning, a send that never left. */
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

  /* The one judgement this editor draws about the snippet itself, bordered like
     the detail pane's own refusal because it is the same kind of statement. */
  .blocked {
    margin: 0;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.8125rem;
  }
</style>
