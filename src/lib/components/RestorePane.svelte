<script lang="ts">
  import type { AdoptTheDiskVersion } from '../browser/editorSave';
  import type { RawDocumentText } from '../browser/rawDocument';
  import type { RawSaveChoice } from '../browser/rawSave';
  import {
    acknowledgeRestoreFindings,
    askToReloadDiskVersion,
    batchesLoaded,
    candidateRead,
    candidateRefused,
    candidateText,
    cancelRestore,
    chooseBatch,
    chooseEntry,
    confirmDiskReload,
    confirmRestore,
    CONFLICT_CAPABILITIES,
    dismissRestoreOutcome,
    entriesLoaded,
    loadingBatches,
    loadingEntries,
    prepareRestore,
    reloadTheDiskVersion,
    restoreView,
    revisionInProjection,
    startRestore,
    targetRevisionObserved,
    type InvalidateEverySurface,
    type OpenWriteSurface,
    type RestoreContext,
    type RestoreSession,
    type RestoreView,
    type StartedRestore
  } from '../browser/restore';
  import { candidateMeasurements, distinctReasons } from '../browser/restoreFacts';
  import { outcomeReveal, type ConflictChoice } from '../browser/saveOutcome';
  import RecoveryWithoutCreation from './RecoveryWithoutCreation.svelte';
  import { revealOutcome } from './reveal';
  import SourceText from './SourceText.svelte';
  import {
    t,
    tBackupRootState,
    tBatchSkipped,
    tConflictChoice,
    tConflictOperation,
    tDraftError,
    tEditError,
    tEntrySkipped,
    tFindingCode,
    tIpcFailure,
    tPresentationNote,
    tRawSaveChoice,
    tRawSaveMessage,
    tReloadUnavailable,
    tRestoreRefusal,
    tSaveError,
    tSaveOutcomeMessage,
    tSaveVerdict,
    tBackupTarget
  } from '../i18n';
  import type { CommandResult } from '../ipc/commands';
  import type {
    BackupBatchId,
    BackupBatchListing,
    BackupEntryId,
    BackupEntryListing,
    BackupTextResponse,
    DocumentId,
    DocumentSummary,
    DocumentView
  } from '../ipc/types';

  /*
   * Replacing one file's whole text with the text of one backup entry: the
   * restore pane, a mode of the third pane reached from the file's whole-text
   * surface (consult Q5, `docs/reviews/phase-2c-5-design.md`).
   *
   * **This file is presentation.** The catalogue, the retained candidate, the
   * confirmation that binds five values to it, the permit that authorizes exactly
   * one send, every refusal and every outcome are in `../browser/restore.ts`,
   * which has a test suite of its own; the measurements beside the candidate are
   * in `../browser/restoreFacts.ts`, which has one too. The reason those live
   * there is narrower than "markup cannot be tested" — `RestorePane.test.ts`
   * mounts this pane and presses its controls — and it is 2c-3c-3's: a *model*
   * test drives values and never markup, so a rule written into one renderer is
   * carried by that renderer's mounted suite alone, and a second renderer can omit
   * it while walking the model faithfully.
   *
   * The bolded paragraphs below are the things in this markup that are
   * load-bearing rather than style.
   *
   * **`SourceText`, and never a `<textarea>` or an `<input>`, for any file text
   * on this screen.** Measured in the shipped WKWebView rather than assumed
   * (`CLAUDE.md` section 6): a `<textarea>` assigned `"x\ry\r\nz"` reads back
   * `"x\ny\nz"`, and an `<input type="text">` assigned `"p\rq"` reads back `"pq"`
   * — one converts a carriage return and the other deletes it. A backup entry may
   * hold either, and a restore exists to put the file's own bytes back, so the
   * candidate is drawn read-only through the primitive that names a character no
   * font draws instead of rendering it and never soft-wraps a line. Nothing on
   * this screen is writable at all: what a person chooses here is an entry, never
   * a character.
   *
   * **One read of the window feeds every gate.** `current` below reads the
   * projections and the open write surfaces **once** and builds one
   * `RestoreContext` from them; `restoreView`, and through it `restoreRefusal`
   * and `canPrepareRestore`, are derived from that one value, and `prepareRestore`
   * and `confirmRestore` are handed the very same object. Four gates over two
   * reads could fall between two parses and disagree about what they are gating —
   * a control drawn against one world and a confirmation checked against another.
   * `RestoreContext.observed` comes from `revisionInProjection`, the model's own
   * named producer, and never from `session.baseRevision`: that is the session's
   * frozen base, it agrees with itself however stale it is, and a confirmation
   * that compares two values minted together observes nothing
   * (`matchDeletion.ts`'s recorded lesson).
   *
   * **The confirm control is disabled from the view and authorized by the
   * model, and those are two different things.** `view.refusal` is an affordance:
   * it says why a control would do nothing, so a person is not left pressing one.
   * What actually authorizes a write is `confirmRestore`'s own checked deletion
   * from a module-private set, which happens inside that call — this file
   * performs no check of its own between deciding and spending, because a check
   * and a spend separated by any property read are not one operation in
   * JavaScript. That defect has shipped twice in this phase, and its shape is a
   * consuming operation whose result is discarded.
   *
   * **The two-stage control is two stages because the second one is
   * destructive.** *Prepare to replace file* produces the opaque pending
   * confirmation and draws the question; *Replace entire file with the shown
   * text* is the only producer of anything to send, and it is styled apart from
   * every other control on the screen. There is no type-the-filename ritual: the
   * consult rules that it adds ritual and no stronger binding.
   *
   * **The batch label is a folder name and never a time.** `display_name` is
   * rendered inside *Backup batch named …* and is not parsed, formatted or turned
   * into a date; the listing arrives newest name first from the core's own shared
   * ordering and is drawn in the order it arrived, with no sort here. Nothing on
   * this screen says a batch was taken at a moment, that it is the newest backup,
   * that it was written by this application, that it is authentic or verified, or
   * that anything is recoverable — consult Q6, which binds this file's comments
   * as well as its dictionary keys.
   *
   * **What is said beside an entry is what the entry's own *name* says.**
   * `tBackupTarget` renders a classification of a path, and the screen says so:
   * whether an entry really is this file's copy is decided by `read_backup_text`,
   * which refuses an entry that does not map to the document it was given. This
   * pane offers every entry the batch listed and lets that refusal be the answer,
   * because a display path is never authority — comparing one here would be this
   * screen inventing a mapping the command already owns.
   *
   * **The second stacked `SourceText` is this window's own past observation and
   * is labelled as one.** It is the text this window read when it last loaded the
   * file, captured with the projection in one assignment by the pane that opened
   * this one, so it cannot follow the selection onto another file (the 2c-2-2
   * review's High, one screen along). It is never called the current state of the
   * file, nothing compares it with the candidate, and there is no diff.
   *
   * **The target's revision is re-observed, and observing it withdraws the
   * confirmation.** That is consult Q4's *changing the observed target revision*,
   * and the effect below is where it happens: a reprojection this window performs
   * moves the base the candidate would be written against, and any confirmation
   * given before it was given about a different reading of the world.
   * `targetRevisionObserved` answers its own argument unchanged when nothing
   * moved, which is what makes that effect idle rather than a loop.
   *
   * **A committed replacement is never afterwards drawn as a failure.** The
   * outcome panel's `saved` arm says the file was written; a window that could not
   * bring itself back into step says so **beside** it, through the shared
   * `windowOutOfStep` line the model puts in `view.messages`, and never in place
   * of it (`PROGRESS.md` D2).
   */

  const {
    projection,
    file,
    loadedText,
    projections,
    surfaces,
    listBatches,
    listEntries,
    readEntry,
    restore,
    invalidate,
    adoptDiskVersion,
    close
  }: {
    /**
     * The destination's projection, **captured with the file**.
     *
     * `startRestore` takes the base revision off it, and that revision is the
     * only thing standing between this replacement and silently overwriting
     * whatever has changed the file since (consult Q1 item 3). One assignment at
     * the call site, which is 2c-2-2's High one level up: a projection and a file
     * taken from two reads type-check perfectly and can describe two different
     * parses.
     */
    projection: DocumentView;
    /** The file it is a projection of, for the person to see which one it is. */
    file: DocumentSummary;
    /**
     * What this window loaded of that file's text, or `null`.
     *
     * **A captured value and not a reader**, unlike `projections` and
     * `surfaces`: it is drawn as *what this window loaded*, so a live reader
     * would let the sentence become false the moment the selection moved to
     * another file, which is the exact defect the small editor's `file` prop had.
     */
    loadedText: RawDocumentText | null;
    /**
     * Every projection this window holds **now**.
     *
     * A function and not an array: a captured array is a snapshot, and a snapshot
     * is what the `targetMoved` refusal exists to notice.
     */
    projections: () => readonly DocumentView[];
    /**
     * Every write surface this window has open **now**, in any order.
     *
     * A function for `projections`' reason. **Nothing here can check that the
     * caller lists every surface it holds open**; the argument being required is
     * what stops silence compiling into *there are none*, and the pre-send refusal
     * it feeds is an affordance rather than the safety proof — a surface can open
     * after the preview, which is why `sendRestore` rechecks and why `invalidate`
     * exists.
     */
    surfaces: () => readonly OpenWriteSurface[];
    /**
     * Lists the recognised backup batches.
     *
     * `BrowserState.listBackupBatches`, which reports a refusal on the developer
     * channel and answers it too. Unmemoised and re-callable, which is what makes
     * *List them again* a real refresh rather than a control that redraws a
     * remembered answer.
     *
     * @returns Whatever `list_backup_batches` answered, unchanged.
     */
    listBatches: () => Promise<CommandResult<BackupBatchListing>>;
    /**
     * Lists one recognised batch's entries.
     *
     * @param batch - The opaque identity a batch listing produced, handed back
     *   unchanged. It is not authority: the command re-resolves it.
     * @returns Whatever `list_backup_entries` answered, unchanged.
     */
    listEntries: (batch: BackupBatchId) => Promise<CommandResult<BackupEntryListing>>;
    /**
     * Reads one entry's exact text for one destination.
     *
     * The command refuses when the entry does not map to the document, which is
     * what stops one file's copy being read under another file's name. This pane
     * adds no second opinion about that and takes none away.
     *
     * @param entry - The opaque identity an entry listing produced.
     * @param document - The live file the entry must map to, by identity.
     * @returns Whatever `read_backup_text` answered, unchanged.
     */
    readEntry: (
      entry: BackupEntryId,
      document: DocumentId
    ) => Promise<CommandResult<BackupTextResponse>>;
    /**
     * Sends one confirmed replacement, and takes its answer.
     *
     * **`BrowserState.restoreDocument` and nothing else.** That method reads the
     * revision half of the window's observation from its own projections, hands
     * `sendRestore` a sender that is `BrowserState.saveRawDocument` — so the lock,
     * the revision check, the reparse, the acknowledgement, the backup, the cache
     * invalidation and the seal are all the ones a raw save already has — and
     * discharges the whole-document invalidation through `applyRestore`. Restore
     * is a content path on the sixth writer and not a seventh command.
     *
     * @param started - What `confirmRestore` produced.
     * @param surfaces - Every write surface this window has open.
     * @param invalidate - What this pane's host does about every write surface
     *   over the replaced file.
     * @returns The session to install, or `null` when this call held no permit and
     *   therefore has nothing to say about any session.
     */
    restore: (
      started: StartedRestore | null,
      surfaces: readonly OpenWriteSurface[],
      invalidate: InvalidateEverySurface
    ) => Promise<RestoreSession | null>;
    /**
     * What the host does about every write surface over the replaced file.
     *
     * Synchronous and total, and handed straight through: a committed
     * whole-document replacement makes every `MatchId` in that file stale at once,
     * so every surface over it has to be closed or marked terminal, and only the
     * component that holds those surfaces can do it. **What no type forces**, in
     * the same sentence as what one does: `() => {}` satisfies this, so the
     * signature forces that a caller supplies one and never that it closes
     * anything. A body that throws comes back as a line beside the committed
     * outcome and never unwrites the file.
     */
    invalidate: InvalidateEverySurface;
    /**
     * Installs the disk observation a conflict carried into the window.
     *
     * `BrowserState.adoptDiskVersion`, the sole frontend transition that moves
     * this window to the disk side of a conflict. It is called by
     * `reloadTheDiskVersion` and by nothing here, so the projection cannot be
     * replaced without this session being re-pointed at it in the same call — and
     * a `refused` is honoured by re-pointing nothing, while an `alreadyThere` is a
     * success the transition finishes on.
     */
    adoptDiskVersion: AdoptTheDiskVersion<string>;
    /** Leaves the restore pane. */
    close: () => void;
  } = $props();

  // `$state.raw`: a session is an immutable value replaced whole on every
  // transition, and its retained candidate holds a deep-frozen draft a reactive
  // proxy has no business walking. Capturing the projection once is the point —
  // a session that re-derived itself from its props would take a fresh base
  // revision every time this window re-read the file, which is precisely the
  // event the `targetMoved` refusal must notice rather than absorb.
  // svelte-ignore state_referenced_locally
  let session = $state.raw(startRestore(projection));

  /**
   * Everything derived from **one** read of the window.
   *
   * One value rather than two `$derived`s, for `MatchDuplicator.svelte`'s reason:
   * the view a control is drawn from and the context the confirmation is checked
   * against must describe one reading of the world, and two independent reads can
   * fall between two parses. `restore.ts`'s header states that no signature can
   * require it; this is where it is done.
   */
  const current: {
    /** What this window observes about the destination and its own surfaces. */
    context: RestoreContext;
    /** What the pane draws about the replacement. */
    view: RestoreView;
  } = $derived.by(() => {
    const context: RestoreContext = {
      observed: revisionInProjection(projections(), session.target),
      surfaces: surfaces()
    };
    return { context, view: restoreView(session, context) };
  });

  /** What the retained candidate measures, or `null` when there is none. */
  const measured = $derived(
    current.view.preview === null
      ? null
      : candidateMeasurements(
          candidateText(current.view.preview),
          current.view.preview.entry.length
        )
  );

  /** The outcome panel's own element, so a reveal has something to point at. */
  let outcomePanel = $state<HTMLElement | null>(null);
  /** The conflict arm's row of controls, which is the second step's target. */
  let outcomeChoices = $state<HTMLElement | null>(null);

  /*
   * **The outcome panel's appearance asks for a scroll into view** — 2c-4a-3c's
   * findings 10.3 and 10.4, which measured every one of the six write surfaces
   * putting its controls below the fold with nothing scrolling them into sight.
   * This pane is the longest of them all: a catalogue, a candidate and a second
   * stacked document sit above its outcome. The decision is `./reveal.ts`'s and
   * the two `bind:this` targets are this file's.
   */
  const reveal = $derived(
    outcomeReveal(current.view.outcome?.kind ?? null, current.view.awaitingReloadConfirmation)
  );
  $effect(() => {
    revealOutcome(reveal, outcomePanel, outcomeChoices);
  });

  /*
   * **Re-observing the destination's revision, which is a withdrawal.** Consult
   * Q4 lists *the observed target revision* among the five changes that withdraw
   * a confirmation and any acknowledgement, and this is the only one of the five
   * that no control produces: the window re-reads a file for its own reasons —
   * after any committed save anywhere, or a reload — and the base this candidate
   * would be written against moves with it.
   *
   * **It converges, and that is why it may write the state it reads.**
   * `targetRevisionObserved` answers its own argument unchanged when the revision
   * it is given is the one the session already holds, and unchanged again while a
   * send is in flight or a replacement has committed; after one re-point the two
   * agree, so the second run assigns nothing. The identity guard is what makes
   * that a property of this file rather than a hope about Svelte's equality rules.
   */
  $effect(() => {
    const moved = targetRevisionObserved(
      session,
      revisionInProjection(projections(), session.target)
    );
    if (moved !== session) {
      session = moved;
    }
  });

  /**
   * Lists the recognised backup batches, or lists them again.
   *
   * **A refresh withdraws the confirmation** — `loadingBatches` does it, not this
   * handler — because the person is about to be shown a different list, and an
   * answer given while another one was on screen is an answer to a question being
   * asked again.
   */
  async function loadTheBatches(): Promise<void> {
    session = loadingBatches(session);
    const answer = await listBatches();
    // Read from `session` rather than from a value captured before the await: an
    // answer that arrived while this read was in flight has already replaced the
    // session, and spending the one this call started with would put it back.
    session = batchesLoaded(session, answer);
  } // End of function loadTheBatches()

  /**
   * Lists one batch's entries, or lists them again.
   *
   * **An answer about another batch is dropped by `entriesLoaded`**, not here: a
   * listing is only about the batch it was asked for, and installing one under a
   * different batch's name would offer entries that do not belong to it.
   *
   * @param batch - The batch to list.
   */
  async function loadTheEntries(batch: BackupBatchId): Promise<void> {
    session = loadingEntries(session);
    const answer = await listEntries(batch);
    session = entriesLoaded(session, answer);
  } // End of function loadTheEntries()

  /**
   * Chooses a batch and lists it.
   *
   * Everything downstream of the batch goes with the choice — the entry listing,
   * the chosen entry and the retained candidate are all statements about the
   * batch being replaced — and `chooseBatch` is what drops them.
   *
   * @param batch - The opaque identity the batch listing produced.
   */
  async function pickBatch(batch: BackupBatchId): Promise<void> {
    session = chooseBatch(session, batch);
    await loadTheEntries(batch);
  } // End of function pickBatch()

  /**
   * Chooses an entry and reads its text once.
   *
   * **Read once and retained byte-exact**, which is consult Q1: the candidate
   * shown is the candidate sent, every finding is computed from that submitted
   * candidate, and nothing re-reads the entry at send time — a second read could
   * answer different bytes and would make the preview a claim about something
   * else.
   *
   * **The refusal an entry that is not this file's copy comes back with is the
   * command's**, not a comparison made here.
   *
   * @param entry - The opaque identity the entry listing produced.
   */
  async function pickEntry(entry: BackupEntryId): Promise<void> {
    session = chooseEntry(session, entry);
    const answer = await readEntry(entry, session.target);
    session = answer.ok
      ? candidateRead(session, answer.value)
      : candidateRefused(session, answer.failure);
  } // End of function pickEntry()

  /** Asks the person the destructive question. */
  function prepare(): void {
    session = prepareRestore(session, current.context);
  } // End of function prepare()

  /** Takes the question back, leaving the candidate exactly where it is. */
  function cancel(): void {
    session = cancelRestore(session);
  } // End of function cancel()

  /**
   * Confirms the replacement and sends it.
   *
   * **`confirmRestore` is the decision and the spend, in one call.** It rechecks
   * the five values the pending question binds, the revision this window projects
   * for the destination and the surfaces it has open, and then takes the question
   * out of a module-private set with a checked deletion whose success *is* the
   * authorization. This handler adds no check of its own around it: a check and a
   * spend separated by any property read are not atomic in JavaScript, because a
   * property read can run arbitrary code through a getter or a proxy trap and
   * `readonly` freezes nothing at runtime. `null` back means nothing was
   * authorized, and `current.view.refusal` beside the control is already the
   * reason.
   *
   * **The window is read once**, before anything is confirmed, and that one
   * context reaches both the confirmation and the coordinator — so the gate that
   * agreed and the send that follows cannot disagree about which surfaces were
   * open. The revision half is read again inside `BrowserState.restoreDocument`,
   * from its own projections, which can only make a send that should be refused
   * actually be refused.
   *
   * **`null` from the coordinator installs nothing.** It means this call held no
   * permit — another call, an earlier one or a re-entrant one that reached the
   * checked deletion first, is the one that spent it and the one that answers for
   * the session — so installing the confirmation's own frozen snapshot here would
   * overwrite whatever that call produced. In this pane there is no such other
   * call: the confirmation is minted and spent in this one handler, and a second
   * press finds nothing pending. The arm is written for what the coordinator's
   * contract says rather than for what this caller can reach.
   */
  async function runRestore(): Promise<void> {
    const now = current;
    const started = confirmRestore(session, now.context);
    if (started === null) {
      return;
    }
    session = started.session;
    const answered = await restore(started, now.context.surfaces, invalidate);
    if (answered !== null) {
      session = answered;
    }
  } // End of function runRestore()

  /** Puts the outcome away. The candidate, and everything spent, survive it. */
  function onDismiss(): void {
    session = dismissRestoreOutcome(session);
  } // End of function onDismiss()

  /**
   * Does what one refusal choice says.
   *
   * ***Save anyway* records what was reported and asks again**, which is
   * `MatchDeleter.svelte`'s shape rather than the duplicator's: `confirmRestore`
   * consumed the pending question when the refused attempt was sent, so the
   * question comes back with the findings still on screen and the person answers
   * it about the transaction they can read. **It is not consent being collected a
   * second time.** The acknowledgement is bound to this exact candidate and is
   * kept across the withdrawal; what is asked again is the confirmation, and
   * `browser.restore.acknowledgedAsksAgain` is the sentence that says so.
   *
   * @param choice - The choice the person picked.
   */
  function refusalAction(choice: RawSaveChoice): void {
    if (choice === 'saveAnyway') {
      session = prepareRestore(acknowledgeRestoreFindings(session), current.context);
      return;
    }
    session = dismissRestoreOutcome(session);
  } // End of function refusalAction()

  /**
   * Does what one conflict choice says.
   *
   * **Three of the five arms are reachable.** `restore.ts`'s
   * `CONFLICT_CAPABILITIES` declares this draft an `operationChoice` — the
   * candidate is the exact text *read from* a backup entry and not something a
   * person produced, so *your text is still here* would describe something they
   * never wrote and a clipboard has nothing to rescue — which is why
   * `conflictChoicesFor` refuses *Copy draft* here as a property of the value.
   * `reapplySupport` is `unavailable` for the raw editor's reason: a whole
   * document has no target, no field intent and no operation to re-resolve.
   * `offersReload` became `true` at 2c-5-4b, and the transition behind it was
   * built and driven at 2c-5-3.
   *
   * **The confirmed reload keeps the candidate and does not close this pane.**
   * That is `retargetsCandidate`, restore's own reload outcome: the adoption
   * installs the disk observation, the base moves to the conflict's
   * `diskRevision`, the confirmation and any acknowledgement are withdrawn, and
   * the person reads the same candidate against what this window now holds and
   * confirms again. There is no *retry anyway*.
   *
   * **What the exhaustive switch forces, and what it does not.** A *new member*
   * of `ConflictChoice` fails to compile here. A *newly offered* member does not
   * — offering is the model's, and a choice becomes a control the moment
   * `conflictChoicesFor` names it — which is why the mounted suite presses every
   * control this pane draws.
   *
   * @param choice - The choice the person picked.
   */
  function conflictAction(choice: ConflictChoice): void {
    switch (choice) {
      case 'keepEditing':
        session = dismissRestoreOutcome(session);
        return;
      case 'reloadDiskVersion':
        session = askToReloadDiskVersion(session);
        return;
      case 'confirmReloadKeeping':
        // **Two calls, one click**, exactly as every other surface's reload is:
        // the two steps a person sees are the warning and this press. The window
        // decides whether the adoption happened, and `reloadTheDiskVersion`
        // re-points nothing when it answers `refused`.
        session = reloadTheDiskVersion(confirmDiskReload(session), adoptDiskVersion);
        return;
      case 'confirmReload':
        // Never offered here, and the distinction is the whole reason this member
        // exists: `conflictChoicesFor` names this one for a surface whose reload
        // discards a draft or closes the panel, and restore's reload does neither.
        // Its label — *Discard my text and load it* or *Close this and load it* —
        // would be false of what this pane does, which is why 2c-5-4b added
        // `confirmReloadKeeping` rather than reusing one of the two.
        return;
      case 'copyDraft':
      case 'keepMyDraft':
        // Never offered here, and not because a boolean is `false`: this
        // surface's declared draft kind refuses the copy and its declared reapply
        // support refuses the reapply, both inside `conflictChoicesFor`. The arms
        // exist so the `switch` stays exhaustive and a sixth member of
        // `ConflictChoice` is a compile error in this file.
        return;
    }
  } // End of function conflictAction()
</script>

<section class="restore" aria-label={t('browser.restore.label')}>
  <div class="head">
    <h2>{t('browser.restore.label')}</h2>
    <button type="button" disabled={current.view.restoring} onclick={() => close()}>
      {t('browser.restore.close')}
    </button>
  </div>

  <dl>
    <dt>{t('browser.restore.destination')}</dt>
    <dd class="source">{file.relative_path}</dd>
  </dl>

  <!-- The direct warning, above every control that leads to it rather than
       beside the one that performs it: what this pane does is replace a whole
       file, and that is the first thing it says. -->
  <p class="blocked">{t('browser.restore.warning')}</p>

  {#if current.view.restoring}
    <p class="kind">{t('browser.restore.sendingCannotBeStopped')}</p>
  {/if}

  <!-- Step one of three: the recognised batches. -->
  <section class="step">
    <h3>{t('browser.restore.batchesHeading')}</h3>
    <!-- What a batch name is and what it is not, said once and above the list.
         A folder label of a shape this app writes, ordered by name — never a
         time, never a claim about what wrote the folder (consult Q6). -->
    <p class="kind">{t('browser.restore.batchOrder')}</p>
    <p class="choices">
      <button
        type="button"
        disabled={current.view.restoring}
        onclick={() => void loadTheBatches()}
      >
        {current.view.batches.kind === 'idle'
          ? t('browser.restore.listBatches')
          : t('browser.restore.relistBatches')}
      </button>
    </p>

    {#if current.view.batches.kind === 'loading'}
      <p class="kind">{t('browser.restore.batchesLoading')}</p>
    {:else if current.view.batches.kind === 'failed'}
      {@const failed = current.view.batches.failure}
      <div class="panel">
        <p>{t('browser.restore.entriesRefused')}</p>
        <p>{tIpcFailure(failed)}</p>
      </div>
    {:else if current.view.batches.kind === 'loaded'}
      {@const listing = current.view.batches.listing}
      <!-- A missing backups folder is an outcome and not a failure: it is the
           ordinary state of a configuration this app has never saved from, and
           the core answers it as a successful listing for exactly that reason. -->
      <p class="kind">{tBackupRootState(listing.root)}</p>
      {#if listing.batches.length === 0}
        <p class="kind">{t('browser.restore.batchesNone')}</p>
      {/if}
      {#if !listing.complete}
        <!-- `complete` is Rust's own predicate over which skip reasons mean
             *nothing was learned*, so an incomplete listing says its list may be
             short rather than letting an empty one read as "there are none". -->
        <p class="kind">{t('browser.restore.batchesIncomplete')}</p>
      {/if}
      <ul class="options">
        {#each listing.batches as batch (batch.id.name)}
          <li>
            <button
              type="button"
              disabled={current.view.restoring}
              aria-pressed={current.view.batch?.name === batch.id.name}
              onclick={() => void pickBatch(batch.id)}
            >
              {t('browser.restore.batchNamed', { name: batch.display_name })}
            </button>
          </li>
        {/each}
      </ul>
      {#if listing.skipped.length > 0}
        <p class="kind">{t('browser.restore.batchesSkipped')}</p>
        <ul>
          <!-- One reason each. The listing carries one code per skipped entry,
               and `distinctReasons` is what collapses forty identical sentences
               to one; how many entries each reason covers is `unrecognised` and
               `unreadable`, which are different numbers. -->
          {#each distinctReasons(listing.skipped) as reason (reason)}
            <li>{tBatchSkipped(reason)}</li>
          {/each}
        </ul>
      {/if}
    {/if}
  </section>

  <!-- Step two of three: the entries of the chosen batch. -->
  {#if current.view.batch !== null}
    <section class="step">
      <h3>{t('browser.restore.entriesHeading')}</h3>
      <dl>
        <dt>{t('browser.restore.selectedBatch')}</dt>
        <dd class="source">{current.view.batch.name}</dd>
      </dl>
      <!-- A classification of a name, and the screen says so. Whether an entry
           is this file's copy is `read_backup_text`'s answer, and this pane adds
           no comparison of its own: a display path is never authority. -->
      <p class="kind">{t('browser.restore.entryIsAName')}</p>

      {#if current.view.entries.kind === 'loading'}
        <p class="kind">{t('browser.restore.entriesLoading')}</p>
      {:else if current.view.entries.kind === 'failed'}
        {@const failed = current.view.entries.failure}
        <!-- Both a refused entry listing and a refused text read land here: the
             model puts a refused read on this catalogue, because a candidate it
             could not obtain is a fact about what this batch could give. -->
        <div class="panel">
          <p>{t('browser.restore.entriesRefused')}</p>
          <p>{tIpcFailure(failed)}</p>
        </div>
      {:else if current.view.entries.kind === 'loaded'}
        {@const listing = current.view.entries.listing}
        {#if listing.entries.length === 0}
          <p class="kind">{t('browser.restore.entriesNone')}</p>
        {/if}
        {#if !listing.complete}
          <p class="kind">{t('browser.restore.entriesIncomplete')}</p>
        {/if}
        <ul class="options">
          {#each listing.entries as entry (entry.id.relative_path)}
            <li>
              <button
                type="button"
                disabled={current.view.restoring}
                aria-pressed={current.view.entry?.relative_path === entry.id.relative_path}
                onclick={() => void pickEntry(entry.id)}
              >
                <span class="source">{entry.display_path}</span>
              </button>
              <span class="marker">{tBackupTarget(entry.target)}</span>
            </li>
          {/each}
        </ul>
        {#if listing.skipped.length > 0}
          <p class="kind">{t('browser.restore.entriesSkipped')}</p>
          <ul>
            {#each distinctReasons(listing.skipped) as reason (reason)}
              <li>{tEntrySkipped(reason)}</li>
            {/each}
          </ul>
        {/if}
      {/if}
    </section>
  {/if}

  <!-- Step three of three: the exact candidate, and what it measures. -->
  {#if current.view.preview !== null && measured !== null}
    {@const preview = current.view.preview}
    {@const facts = measured}
    <section class="step">
      <h3>{t('browser.restore.candidateHeading')}</h3>
      <dl>
        <dt>{t('browser.restore.selectedEntry')}</dt>
        <dd class="source">{preview.entry.display_path}</dd>
      </dl>
      <!-- Counted here, from the text that was read, and never taken from a
           number somebody else observed: `../browser/restoreFacts.ts` encodes the
           candidate as UTF-8 and counts the bytes, and counts code points rather
           than UTF-16 code units. -->
      <p class="kind">
        {t('browser.restore.candidateMeasured', {
          bytes: facts.bytes,
          characters: facts.codePoints
        })}
      </p>
      <!-- Two observations taken at two moments, compared and disclosed. Which
           of them describes the entry now is something this app does not know and
           does not say. -->
      {#if facts.agreesWithListing === true}
        <p class="kind">{t('browser.restore.listedAgrees')}</p>
      {:else if facts.agreesWithListing === false && facts.listedLength !== null}
        <p class="kind">
          {t('browser.restore.listedDiffers', { length: facts.listedLength.toString() })}
        </p>
      {:else}
        <p class="kind">{t('browser.restore.listedUnreadable')}</p>
      {/if}
      <p class="marker">{t('browser.restore.candidateExact')}</p>
      <!-- `documentStart`, because this is a whole document: it is the only way a
           byte-order mark is drawn as the segment it is rather than as nothing. -->
      <SourceText text={candidateText(preview)} documentStart />
    </section>
  {/if}

  <!-- This window's own past observation of the destination, and labelled as
       one. Never called the current state of the file, never compared with the
       candidate, and never writable. -->
  {#if loadedText !== null && (loadedText.kind === 'text' || loadedText.kind === 'empty')}
    {@const loaded = loadedText}
    <section class="step">
      <h3>{t('browser.restore.loadedHeading')}</h3>
      <p class="kind">{t('browser.restore.loadedObservation')}</p>
      {#if loaded.kind === 'text'}
        <SourceText text={loaded.text} documentStart />
      {:else}
        <p class="marker">{t('browser.detail.fileTextEmpty')}</p>
      {/if}
    </section>
  {/if}

  <!-- What recovery is on a surface that cannot create: one sentence, or
       nothing. **Mounted unconditionally** — whether there is anything to say is
       the shared renderer's decision, taken from the conflict below, and not a
       condition this markup repeats. Four surfaces that each decided it for
       themselves is the finding that component closed. -->
  <RecoveryWithoutCreation kind="operationChoice" conflict={current.view.conflict} />

  <!-- The two-stage control, with the sentence that says why it is disabled, as
       one sticky block: a control pinned to the bottom of the pane with its
       reason left above the fold would be a control that has stopped saying
       why. -->
  <div class="actions">
    {#if current.view.confirming}
      <p class="question">{t('browser.restore.question')}</p>
      <p class="kind">{t('browser.restore.confirmBinding')}</p>
      <p class="choices">
        <!-- **Visually distinct, and the only producer of anything to send.**
             `disabled` here is an affordance derived from the same one read the
             view came from; what authorizes the write is `confirmRestore`'s own
             checked spend, inside the handler. -->
        <button
          type="button"
          class="destructive"
          disabled={current.view.refusal !== null}
          onclick={() => void runRestore()}
        >
          {t('browser.restore.confirm')}
        </button>
        <button type="button" onclick={() => cancel()}>
          {t('browser.restore.cancel')}
        </button>
      </p>
    {:else}
      <p class="choices">
        <button type="button" disabled={!current.view.canPrepare} onclick={() => prepare()}>
          {t('browser.restore.prepare')}
        </button>
        {#if current.view.restoring}
          <span class="marker">{t('browser.restore.sending')}</span>
        {/if}
      </p>
    {/if}

    <!-- Every refusal has a code, and which one wins where two are true at once
         is `restoreRefusal`'s ordering rather than this file's. -->
    {#if current.view.refusal !== null}
      <p class="kind">{tRestoreRefusal(current.view.refusal)}</p>
    {/if}
  </div>

  {#if current.view.sendFailure !== null}
    {@const failure = current.view.sendFailure}
    <div class="panel">
      <!-- Two arms and two sentences. A failure at or after the rename may have
           left the candidate on disk, and collapsing the two would be this app
           telling a person their file is untouched when it may not be. -->
      <p>
        {failure.kind === 'mayHaveWritten'
          ? t('browser.restore.mayHaveWritten')
          : t('browser.restore.sendFailed')}
      </p>
      {#if current.view.failureLines.length > 0}
        <p class="kind">{t('browser.restore.failureReason')}</p>
        {#each current.view.failureLines as line, index (index)}
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

  {#if current.view.outcome !== null}
    {@const outcome = current.view.outcome}
    <div class="panel" role="status" bind:this={outcomePanel}>
      {#each current.view.messages as message, index (index)}
        <p>{tSaveOutcomeMessage(message)}</p>
      {/each}

      {#if outcome.kind === 'saved'}
        {#if current.view.notes.length > 0}
          <!-- Never dropped: plan section 6.2 is *never silently normalise*, and
               a note dropped here is a normalisation made silent. -->
          <p class="kind">{t('browser.restore.notes')}</p>
          <ul>
            {#each current.view.notes as note, index (index)}
              <li>{tPresentationNote(note)}</li>
            {/each}
          </ul>
        {/if}
        <!-- Drawn only for a committed replacement. `committed: false` is a
             documented success in which nothing was written — the shared
             `nothingToWrite` line above says so — and nothing became stale, so
             this sentence would be false of it. -->
        {#if current.view.restored}
          <p class="kind">{t('browser.restore.replaced')}</p>
        {/if}
        <p class="choices">
          <button type="button" onclick={() => onDismiss()}>
            {t('browser.notice.dismiss')}
          </button>
        </p>
      {:else if outcome.kind === 'refused'}
        <p class="kind">{tSaveVerdict(outcome.verdict)}</p>
        {#if outcome.rawSave !== null}
          <!-- *This replaces the entire document*, then the parse rejection and
               where the parser stopped, if there was one. The model chooses the
               lines; this walks them. -->
          {#each outcome.rawSave.messages as message, index (index)}
            <p class="kind">{tRawSaveMessage(message)}</p>
          {/each}
          {#if outcome.rawSave.otherFindings.length > 0}
            <p class="kind">{t('browser.restore.findings')}</p>
            <ul>
              {#each outcome.rawSave.otherFindings as finding, index (index)}
                <li>{tFindingCode(finding.code)}</li>
              {/each}
            </ul>
          {/if}
        {/if}
        {#if current.view.findingsAreStale}
          <p class="kind">{t('browser.restore.findingsAreStale')}</p>
        {/if}
        {#if current.view.refusalChoices.includes('saveAnyway')}
          <!-- What *Save anyway* does here, drawn only when it is offered: it
               records what was reported and asks the destructive question again,
               because the confirmation was spent by the attempt that was
               refused. What was accepted stays with this exact text. -->
          <p class="kind">{t('browser.restore.acknowledgedAsksAgain')}</p>
        {/if}
        <p class="choices">
          {#each current.view.refusalChoices as choice (choice)}
            <button type="button" onclick={() => refusalAction(choice)}>
              {tRawSaveChoice(choice, CONFLICT_CAPABILITIES.draftKind)}
            </button>
          {/each}
        </p>
      {:else}
        {@const conflict = outcome}
        <p class="kind">
          {t('browser.restore.revisionExpected', { revision: conflict.expected })}
        </p>
        <p class="kind">{t('browser.restore.revisionFound', { revision: conflict.found })}</p>
        <p class="kind">
          {t('browser.restore.revisionDisk', { revision: conflict.diskRevision })}
        </p>

        <h3>{t('browser.saveOutcome.retainedOperation')}</h3>
        <!-- What this session asked for, as the model summarises it. The
             candidate itself is above, unchanged by the conflict; there is
             nothing typed here and no copy to offer (consult Q4). -->
        {#if current.view.conflictOperation !== null}
          <p>{tConflictOperation(current.view.conflictOperation)}</p>
        {/if}

        <h3>{t('browser.saveOutcome.diskVersion')}</h3>
        <!-- The whole file as the command layer read it after the refusal,
             paired with `diskRevision`. Which arm is drawn is
             `conflictDiskText`'s decision and not this markup's. -->
        {#if current.view.diskText !== null && current.view.diskText.kind === 'text'}
          <SourceText text={current.view.diskText.text} documentStart />
        {:else}
          <p class="marker">{t('browser.detail.fileTextEmpty')}</p>
        {/if}

        <!-- A control that has just gone, with the reason in its place: the
             reload is not offered again once the window has refused a spend,
             because the refusal came back with no word about its cause. That
             withholds a control; it claims nothing about a later ask. -->
        {#if current.view.reloadUnavailable}
          <p class="kind">{tReloadUnavailable(CONFLICT_CAPABILITIES.draftKind)}</p>
        {/if}

        <p class="choices" bind:this={outcomeChoices}>
          {#each current.view.conflictChoices as choice (choice)}
            <button type="button" onclick={() => conflictAction(choice)}>
              {tConflictChoice(choice, CONFLICT_CAPABILITIES.draftKind)}
            </button>
          {/each}
        </p>
      {/if}
    </div>
  {/if}
</section>

<style>
  .restore {
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

  h2 {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  /* The three steps' headings, and the conflict panel's two. */
  h3 {
    margin: 0.375rem 0 0;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  /* One step of the three the consult asks for: pick a recognised batch and an
     entry, inspect the candidate, then confirm. They are drawn stacked and in
     order rather than as a wizard, so the evidence stays on screen beside the
     question — a modal detached from its evidence is what the consult refuses. */
  .step {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
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

  /* Text taken from the file, or a name the filesystem holds, in the face that
     means "this is what the disk holds" (`src/app.css`). */
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

  /* The one control on this screen that replaces a file. Set apart from every
     other control by weight and by a heavier border, because the consult asks
     for a *visually distinct* second step and because it is the only irreversible
     thing this pane can do. The colour is the theme's own emphasis rather than a
     new one: a colour is not the distinction, since a person may not see it. */
  .destructive {
    font-weight: 600;
    border-width: 2px;
    border-color: var(--text);
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.375rem;
    margin: 0;
  }

  /* The catalogue's two lists. Plain rows rather than a `<select>`: a listing
     carries a classification beside each entry, and an option element can hold
     only a string. */
  .options {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .options li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.375rem;
  }

  .options button[aria-pressed='true'] {
    border-color: var(--text);
  }

  /* The pane's own action row, with the sentence that says why the control is
     disabled. Sticky at the bottom for `MatchDuplicator.svelte`'s reason, and
     more sharply here: a catalogue, a candidate and a second whole document sit
     above it, so this is the longest of the seven write surfaces and its primary
     control would otherwise be far below the fold. `.restore` is a flex item that
     shrinks to the pane's height with its content overflowing, so its content box
     bottom *is* the bottom of what the pane shows.

     The background is opaque for the only reason a sticky row ever needs one:
     while it is pinned, the pane scrolls underneath it. */
  .actions {
    position: sticky;
    bottom: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.375rem 0;
    background: var(--surface);
  }

  /* The destructive question itself, in the body face rather than the marker
     face: it is a sentence the reader is meant to read. */
  .question {
    margin: 0;
    font-weight: 600;
  }

  /* Anything this app says about the replacement rather than about the file:
     the outcome arms, a send that never left, a refused catalogue read. */
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

  /* What this pane is, said before any control that leads to it. Bordered like
     the detail pane's own refusal because it is the same kind of statement — this
     app saying plainly what it is about to do to a file. */
  .blocked {
    margin: 0;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.8125rem;
  }
</style>
