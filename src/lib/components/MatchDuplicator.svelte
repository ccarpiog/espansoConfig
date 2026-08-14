<script lang="ts">
  import { labelText, triggerLabel } from '../browser/labels';
  import { identityInProjection } from '../browser/matchDeletion';
  import {
    acknowledgeDuplicationFindings,
    acknowledgementOf,
    applyDuplication,
    askToReloadDiskVersion,
    baseRevisionOf,
    beginDuplicate,
    confirmDiskReload,
    CONFLICT_CAPABILITIES,
    dismissDuplicationOutcome,
    duplicationCouldNotBeSent,
    duplicationRecoveryFailed,
    matchDuplicationView,
    reapplyToDiskVersion,
    reloadTheDiskVersion,
    startMatchDuplication,
    type DuplicationReapplyAttempt,
    type DuplicationRecovery,
    type MatchDuplicationView
  } from '../browser/matchDuplication';
  import type { RawSaveChoice } from '../browser/rawSave';
  import type { AdoptTheDiskVersion } from '../browser/editorSave';
  import { attemptOfReapply, reapplyReveal, reapplyToShow } from '../browser/reapply';
  import { outcomeReveal, type ConflictChoice } from '../browser/saveOutcome';
  import type { MatchSaveAnswer } from '../browser/workspace.svelte';
  import RecoveryWithoutCreation from './RecoveryWithoutCreation.svelte';
  import { revealOutcome, revealReapplyReport } from './reveal';
  import SourceText from './SourceText.svelte';
  import {
    t,
    tConflictChoice,
    tConflictOperation,
    tDetailField,
    tDraftError,
    tDuplicationReapplyObstacle,
    tDuplicationRecovery,
    tDuplicationRefusal,
    tDuplicationSubmissionRefusal,
    tEditError,
    tFindingCode,
    tIpcFailure,
    tPresentationNote,
    tRawSaveChoice,
    tReapplyOutcome,
    tReapplyReadiness,
    tReloadUnavailable,
    tSaveError,
    tSaveOutcomeMessage,
    tSaveVerdict,
    tTriggerKind
  } from '../i18n';
  import type { IpcFailure } from '../ipc/errors';
  import type {
    Acknowledgement,
    ContentRevision,
    DocumentId,
    DocumentSummary,
    DocumentView,
    MatchId,
    MatchView
  } from '../ipc/types';

  /*
   * Copying one snippet in place: the duplicate panel.
   *
   * **This file is presentation.** What may be duplicated, when a duplicate may
   * be sent, what a refusal means, what a commit spends and what the wire takes
   * are all in `../browser/matchDuplication.ts`, which has a test suite. This is
   * a walk over `matchDuplicationView`'s answer, exactly as `MatchMover.svelte`
   * is a walk over its own — and the smallness is why the model's own review
   * could find five findings in step 1 with no screen at all.
   *
   * The bolded paragraphs below are the things in this markup that are
   * load-bearing rather than style.
   *
   * **The view and the submission identity come from one read of the
   * projections** (`matchDuplication.ts`'s header). `current` below reads
   * `projections()` **once**, derives the view from that one array, and
   * `runDuplicate` takes the identity it hands `beginDuplicate` out of the same
   * value. The module states plainly that its agreement is one rule over
   * *consistent* inputs and that nothing in a signature can force consistency:
   * two separate reads can fall between two parses, and the panel would then
   * refuse — or fail to refuse — against a projection it is not drawing. This is
   * the caller that closes that half, and nothing in TypeScript checks that it
   * stays closed.
   *
   * **`view.notDuplicableToShow` is drawn whenever it is not `null`, and this
   * file asks no second question about it.** The frozen eligibility and the
   * live refusal answer at two different times, and where both are true the one
   * that claims less wins — but that precedence is `matchDuplication.ts`'s and
   * not this file's. Until step 3's review it was half here: the view handed
   * out the frozen reason unconditionally and a condition in this markup was
   * the only thing keeping it off the screen beside a live `outOfDate`. A
   * decision written into this markup is one no model test can drive and one a
   * second renderer — or a harmless-looking refactor of this file — could drop
   * while still walking the model faithfully, so the model now returns the
   * presentation-ready answer and this is a walk over it.
   * `MatchDuplicator.test.ts` mounts this panel and asserts both rendered
   * halves; what it no longer has to carry alone is the rule.
   *
   * **The identity `beginDuplicate` checks is read from the live projections,
   * here, at the moment of the click.** `identityInProjection(current.views, …)`
   * and never `session.match`: the session's identity was minted when this panel
   * opened, so it agrees with itself however stale it is, and a panel retained
   * across a re-read of the file would still send. The `projections` prop is a
   * **function** for that reason — a captured array is a snapshot, and a
   * snapshot is what the check exists to notice. What no type here forces, in
   * the same sentence: nothing stops a caller passing a function that answers a
   * stale array, and nothing in `matchDuplication.ts` can see where its argument
   * came from.
   *
   * **There is no destination and no confirmation dialog** (the consult's Q4 and
   * Q6). The copy lands immediately after its source, in the same list, and the
   * panel says so in one static sentence instead of offering a placement nobody
   * chose. The deliberate second step this operation has is the one the
   * transaction already imposes: a byte-exact copy keeps its source's trigger
   * definition, so the first attempt ordinarily comes back refused with
   * `DuplicateKeepsTriggerDefinition` and *Save anyway* is what accepts it. That
   * makes the acknowledgement round trip this panel's **ordinary** path rather
   * than its exceptional one.
   *
   * **The acknowledgement is never assembled here.** `acknowledgeDuplicationFindings`
   * records consent through the one function that can, and `beginDuplicate` reads
   * it back through `submissionOf`, so what crosses the boundary is consent bound
   * to the exact candidate — the finding carries the clone's own
   * `ContentRevision`, and consent collected for one copy therefore cannot be
   * spent on another.
   *
   * **A duplicate is not undo, and nothing here presents it as reversible**
   * (consult Q8). A committed insertion is an ordinary save boundary: the small
   * editor's undo stack cannot remove it, a later deletion is a different
   * operation with its own refusals, and restore-from-backup is Phase 2c-5. So
   * the only control this panel offers after a commit is a way out of it.
   *
   * **What the panel says about the copy claims only what the wire promises.**
   * `view.landed` is `null` on a perfectly legal committed duplicate — the
   * command could not identify the clone in the read that followed the write,
   * and the reasons for that are not exhaustible from here — so the sentence
   * drawn for it says exactly that and never that a second writer exists.
   *
   * **A spent session is a dead end with a way out, and the panel says which
   * one.** There is no repair for an `outOfDate`, an `alreadyDuplicated` or a
   * `mayHaveWritten` session: every identity it holds was minted from a parse
   * that is gone, **or** from a send whose effect this application cannot
   * establish, **or** — after a recovery re-read that failed — from a parse still
   * installed whose identity the command has already contradicted. The sentence
   * `view.cannotDuplicate` renders is what tells the person to close this and
   * pick the snippet in the list again. Offering a *Duplicate it anyway* would be
   * a control that cannot work.
   *
   * **The conflict panel shows two sides and identifies nothing across them.** The
   * retained side is `view.conflictOperation` — the model's summary of what this
   * session asked for — because a `MatchId` is a revision-scoped protocol carrier
   * and not authored text, which is why the consult's Q4 refuses a copy here as a
   * property of the drafted value and `conflictChoicesFor` refuses it whatever this
   * surface declares. The disk side is the whole file text the command layer read,
   * through `SourceText`; which arm of it is drawn is `conflictDiskText`'s decision
   * and not this markup's. The confirmed reload installs the disk projection and
   * **closes** this panel: nothing is loaded in its place, because finding "the
   * same" snippet in another revision is 2c-4b.
   *
   * **The panel cannot be left while a duplicate is in flight**, for 2c-1b's
   * reason: the request is authorized and cannot be cancelled, so unmounting
   * would leave it free to commit with its outcome drawn nowhere.
   *
   * **Recovery here is a reason and not a form** (2c-4c-3b). This surface is one of
   * the four `recoveryAvailability` answers `unavailable` for, so it mounts
   * `RecoveryWithoutCreation.svelte` — which decides both the reason and whether
   * there is one — and draws no control at all: no copy, and no
   * save-as-new — which on this panel would be the split's named failure, a
   * projection-based copy offered as the way to finish a *duplication*. The truthful
   * next step is the confirmed reload this panel already offers, then a fresh
   * selection and a fresh duplicate.
   */

  const {
    projection,
    match,
    file,
    projections,
    unsavedDraftInDocument,
    duplicate,
    reload,
    adoptDiskVersion,
    close
  }: {
    /**
     * The file's projection, **captured with the snippet**.
     *
     * One assignment at the call site, which is 2c-2-2's High finding one level
     * up: a projection and a snippet taken from two reads type-check perfectly
     * and can describe two different parses. `startMatchDuplication` checks the
     * pair and refuses one this projection does not describe, so taking them
     * apart turns a real duplicate into a `notInDocument` refusal.
     */
    projection: DocumentView;
    /** The snippet being copied, as it was projected when this opened. */
    match: MatchView;
    /** The file it lives in, for the person to see which one it is. */
    file: DocumentSummary | null;
    /**
     * Every projection this window holds **now**.
     *
     * A function and not an array: see this file's note on the submission
     * identity.
     */
    projections: () => readonly DocumentView[];
    /**
     * Whether a match editor is open over **any** snippet of that file.
     *
     * **An open editor, dirty or not** (R36): `isDirty` lives inside
     * `MatchEditor.svelte`'s own session and no coordinator can see it, so this
     * is the honest question and the refusal's sentence claims only what it
     * asks. Read once, when this panel opens, and handed straight to
     * `startMatchDuplication`. Document-wide on purpose (consult Q6): a
     * committed duplicate mints a new revision and invalidates every `MatchId`
     * in the file, so a draft held for any snippet of it — not only the source —
     * would be stranded. `documentHasUnsavedDraft` in
     * `../browser/matchDuplication.ts` is the computation; this prop is only how
     * its answer arrives, and nothing here can check the caller looked.
     */
    unsavedDraftInDocument: () => boolean;
    /**
     * Sends one duplicate.
     *
     * **`BrowserState.duplicateMatch` and nothing else.** That method re-reads
     * the file, follows the clone with the selection when the intent that
     * started the operation is still the held one, and reports what became of
     * the adoption before the answer is handed back; `duplicateMatch` in
     * `../ipc/commands` is the same call without any of it, and a component that
     * reached for it would leave every `MatchId` this window holds for the file
     * naming bytes that have shifted. Nothing in TypeScript stops that, which is
     * why it is written here.
     *
     * @param id - The snippet to copy, by the identity checked against the live
     *   projection.
     * @param baseRevision - The revision the session was opened at.
     * @param acknowledgement - The suspicions already shown to a person.
     * @returns The outcome and the adoption's fate, or a typed failure.
     */
    duplicate: (
      id: MatchId,
      baseRevision: ContentRevision,
      acknowledgement: Acknowledgement
    ) => Promise<MatchSaveAnswer>;
    /**
     * Reads one file again, for the one recovery this panel offers.
     *
     * **`BrowserState.rereadDocument`**, which replaces the projection, the two
     * text caches and the selection together. It answers the read's own failure
     * rather than swallowing it, so a control that appeared to do nothing can say
     * why instead.
     *
     * @param document - The file to read again.
     * @returns The failure of the read, or `null` when it did not fail — which
     *   includes an answer the window discarded because something newer had
     *   already replaced that file's projection.
     */
    reload: (document: DocumentId) => Promise<IpcFailure | null>;
    /** Leaves the duplicate panel. */
    /**
     * Installs the disk observation a conflict carried into the window.
     *
     * `BrowserState.adoptDiskVersion`, the sole frontend transition that moves
     * this window to the disk side of a conflict. It is called by
     * `reloadTheDiskVersion` and by nothing here, so the projection cannot be
     * replaced without this duplicator closing in the same call — and a `refused` from
     * it is honoured by closing nothing, while an `alreadyThere` is a success the
     * transition finishes on.
     */
    adoptDiskVersion: AdoptTheDiskVersion<MatchId>;
    close: () => void;
  } = $props();

  // `$state.raw`: a session is an immutable value replaced whole on every
  // transition, and its draft holds deep-frozen snapshots a reactive proxy has no
  // business walking. Capturing the projection once is the point — a session that
  // re-derived itself from its props would be replaced every time the workspace
  // re-read the file, which is precisely the event `duplicationSubmissionRefusal`
  // must notice rather than absorb.
  // svelte-ignore state_referenced_locally
  let session = $state.raw(startMatchDuplication(projection, match, unsavedDraftInDocument()));

  /**
   * The last *Keep my draft* attempt, or `null` when this panel has made none.
   *
   * **Held with the session it produced**, which is what stops a report outliving
   * what it describes: `reapplyToShow` answers `null` the moment `session` is
   * replaced by anything else, and every transition in the model returns a new
   * value. Nothing here has to remember to clear it.
   */
  let reapplyAttempt = $state.raw<DuplicationReapplyAttempt | null>(null);

  /** What the last attempt left this panel to say, or `null`. */
  const reapplyReport = $derived(reapplyToShow(reapplyAttempt, session));

  /**
   * Everything derived from **one** read of the current projections.
   *
   * The rule `matchDuplication.ts`'s header states and cannot enforce, and the
   * reason it is one value rather than two `$derived`s: the view and the
   * identity `beginDuplicate` is given must describe one parse, and two
   * independent reads of `projections()` can fall between two of them. Nothing
   * in the model can require it; this is where it is done.
   */
  const current: {
    /** The projections everything below was derived from. */
    views: readonly DocumentView[];
    /** What the panel draws about the duplicate itself. */
    view: MatchDuplicationView;
  } = $derived.by(() => {
    const views = projections();
    return { views, view: matchDuplicationView(session, views) };
  });

  /** What the snippet fires from, for the person to recognise it by. */
  const named = $derived(triggerLabel(match));

  /** The snippet's own label, or `null`. */
  const label = $derived(labelText(match));

  /** The outcome panel's own element, so a reveal has something to point at. */
  let outcomePanel = $state<HTMLElement | null>(null);
  /** The conflict arm's row of controls, which is the second step's target. */
  let outcomeChoices = $state<HTMLElement | null>(null);

  /*
   * **The outcome panel’s appearance asks for a scroll into view** — 2c-4a-3c's
   * findings 10.3 and 10.4. This panel opened at y = 328 with its controls at
   * y = 982 in a 728 px viewport, and `section.detail`'s `scrollTop` was `0` when it
   * appeared. The decision is `./reveal.ts`'s and the two `bind:this` targets are
   * this file's.
   */
  const reveal = $derived(
    outcomeReveal(current.view.outcome?.kind ?? null, current.view.awaitingReloadConfirmation)
  );
  $effect(() => {
    revealOutcome(reveal, outcomePanel, outcomeChoices);
  });

  /** The reapply report's own block, so an answer to a press can be seen. */
  let reapplyPanel = $state<HTMLElement | null>(null);

  /*
   * **2c-4b-3c-2's §11.1.** The report is drawn *above* the outcome panel, and
   * until this effect existed nothing pointed a viewport at it: that reading
   * measured it entirely above the scrollport in all 42 of its refusal launches,
   * with the outcome panel below it at pixel-identical coordinates, so pressing
   * the reapply control and being refused changed nothing visible, and a second
   * press reproduced the identical invisible answer.
   *
   * **`reapplyReport` is read inside the effect on purpose.** The cue is a string
   * and a second refusal produces the same string, so an effect depending on the
   * cue alone would not re-run; the report *object* is rebuilt by every press,
   * because each transition returns a fresh outcome. Nothing in Svelte or in
   * TypeScript enforces that reasoning — it is why the call is written this way
   * rather than lifted into a `$derived` beside `reveal`.
   */
  $effect(() => {
    revealReapplyReport(reapplyReveal(reapplyReport?.kind ?? null), reapplyPanel);
  });

  /**
   * Why the last *read this file again* failed, or `null`.
   *
   * Kept here rather than in the model because it is the *reason*, and the reason
   * is about one attempt rather than about the file: the window goes on holding
   * exactly what it held, and without this the control would look like one that
   * does nothing. What the failure means for the session — that it may no longer
   * send anything — is the model's, through `duplicationRecoveryFailed`.
   */
  let reloadFailure = $state.raw<IpcFailure | null>(null);

  /** Puts the outcome away. The draft, and everything spent, survive it. */
  function onDismiss(): void {
    reloadFailure = null;
    session = dismissDuplicationOutcome(session);
  } // End of function onDismiss()

  /**
   * Sends the duplicate, optionally accepting the findings on screen first.
   *
   * **`current` is read once**, after the consent has been recorded, and both the
   * live identity and the verdict the panel was showing come out of that one
   * read. See this file's note on the single projection read.
   *
   * @param acknowledge - Whether this is the *Save anyway* control.
   */
  async function runDuplicate(acknowledge: boolean): Promise<void> {
    if (acknowledge) {
      session = acknowledgeDuplicationFindings(session);
    }
    const started = beginDuplicate(session, identityInProjection(current.views, session.match));
    if (started === null) {
      // The model refuses, and it has already said why:
      // `current.view.cannotDuplicate` is computed from the same read this call
      // just made, so the sentence beside the control is the reason this
      // returned. A second message here would be this file deciding what a
      // refusal means.
      return;
    }
    session = started.session;
    reloadFailure = null;
    const answer = await duplicate(
      started.match,
      // **The session's own base, never the window's current projection.** A
      // duplicate resolves an identity to a *position* and copies the bytes it
      // finds there, so a session opened at one revision and sent after the
      // window has re-read the file must conflict rather than copy whatever now
      // sits at that position.
      baseRevisionOf(started.session),
      acknowledgementOf(started.submission)
    );
    // Three arms, and each says something different about the file. `notAttempted`
    // is this window refusing before a command ran — nothing was sent, so nothing
    // was written and there is no reason to show. `failed` is a command that ran
    // and rejected, and it always carries why.
    if (answer.kind === 'answered') {
      session = applyDuplication(session, answer.result, answer.adoption);
      return;
    }
    session =
      answer.kind === 'notAttempted'
        ? duplicationCouldNotBeSent(session, false, null)
        : duplicationCouldNotBeSent(session, answer.mayHaveWritten, answer.failure);
  } // End of function runDuplicate()

  /**
   * Does what one recovery choice says.
   *
   * One arm today, and the exhaustive switch is what makes a second one a compile
   * error here rather than a control that does nothing.
   *
   * **A re-read that succeeds is not reported as a success, and it does not always
   * spend the session.** When the file has really moved on, the projection this
   * window installs is a different one, the live check notices it on the next read
   * and the panel says `outOfDate`. When the bytes have not changed, the re-read
   * answers the same revision, the identity still compares equal and this session
   * goes on being usable — which is right, because nothing about the file has
   * changed.
   *
   * **A re-read that fails spends it, and that is `duplicationRecoveryFailed`'s
   * rule rather than this file's.** The recovery is offered for four codes and all
   * four say the address this window sent does not describe the file the command
   * read, so a read that cannot reach the file leaves the disagreement standing
   * with no way to resolve it. The typed reason stays on screen beside the send
   * failure; the model is what stops anything else being sent.
   *
   * @param choice - The choice the person picked.
   */
  async function recoveryAction(choice: DuplicationRecovery): Promise<void> {
    switch (choice) {
      case 'reloadFile': {
        const failure = await reload(session.document);
        reloadFailure = failure;
        if (failure !== null) {
          // Read from `session` rather than from a value captured before the
          // await: an answer that arrived while the read was in flight has
          // already replaced the session, and spending the one this call started
          // with would put that answer back.
          session = duplicationRecoveryFailed(session);
        }
        return;
      }
    }
  } // End of function recoveryAction()

  /**
   * Does what one refusal choice says.
   *
   * *Save anyway* records the consent and sends again in one step, which is
   * `MatchMover.svelte`'s shape rather than `MatchDeleter.svelte`'s: a deletion
   * re-raises its confirmation because `confirmDelete` consumed the pending one,
   * and a duplicate has no confirmation to re-raise (the consult's Q6).
   *
   * @param choice - The choice the person picked.
   */
  function refusalAction(choice: RawSaveChoice): void {
    if (choice === 'saveAnyway') {
      void runDuplicate(true);
      return;
    }
    session = dismissDuplicationOutcome(session);
  } // End of function refusalAction()

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
    const attempt = attemptOfReapply(session, reapplyToDiskVersion(session, unsavedDraftInDocument(), adoptDiskVersion));
    reapplyAttempt = attempt;
    session = attempt.session;
  } // End of function keepMyDraft()

  /**
   * Does what one conflict choice says.
   *
   * **Three of the four arms are reachable as of 2c-4a-3b.**
   * `matchDuplication.ts`'s `CONFLICT_CAPABILITIES` declares this draft an
   * `operationChoice` — a `MatchId` is a revision-scoped protocol carrier, not user
   * content — so *Copy draft* can never be offered here, whatever a later change
   * sets; `offersReload` is now `true`, so `conflictChoicesFor` names the two
   * reload labels and this panel draws them. The reload adopts the disk projection
   * and **closes** the duplicator; it was built and wired at 2c-4a-2 and is driven
   * by `matchDuplication.test.ts`.
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
        session = dismissDuplicationOutcome(session);
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
        const reloaded = reloadTheDiskVersion(confirmDiskReload(session), adoptDiskVersion);
        session = reloaded;
        if (reloaded.closed) {
          close();
        }
        return;
      }
      case 'copyDraft':
        // Never offered here: this surface's `CONFLICT_CAPABILITIES` says what
        // its draft is, and `conflictChoicesFor` refuses a copy of anything but
        // authored text. The arm exists so the `switch` stays exhaustive.
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
</script>

<section class="duplicator" aria-label={t('browser.matchDuplication.label')}>
  <div class="head">
    <h2>{t('browser.matchDuplication.label')}</h2>
    <button type="button" disabled={current.view.duplicating} onclick={() => close()}>
      {t('browser.matchDuplication.close')}
    </button>
  </div>

  {#if file !== null}
    <dl>
      <dt>{t('browser.detail.file')}</dt>
      <dd class="source">{file.relative_path}</dd>
    </dl>
  {/if}

  <dl>
    <dt>{tDetailField('trigger')}</dt>
    <dd class="source">
      {#if named.kind === 'text'}
        {named.text}
      {:else}
        {tTriggerKind(named.code)}
      {/if}
    </dd>
    {#if label !== null}
      <dt>{tDetailField('label')}</dt>
      <dd>{label}</dd>
    {/if}
  </dl>

  <!-- **One condition, and it is a null check rather than a rule.** The model
       has already applied the precedence: `notDuplicableToShow` is the frozen
       reason only when it is the reason the control is disabled, and `null`
       whenever a weaker live claim — an `outOfDate` above all — won instead.
       See this file's own note on why that decision is not made here. -->
  {#if current.view.notDuplicableToShow !== null}
    <p class="blocked">{tDuplicationRefusal(current.view.notDuplicableToShow)}</p>
  {/if}

  {#if current.view.duplicating}
    <p class="kind">{t('browser.matchDuplication.duplicatingCannotBeStopped')}</p>
  {/if}

  <!-- The consult's Q4, said once and never offered as a choice: the copy lands
       immediately after its source in the same list, so there is no destination
       to pick and no anchor that can go stale. -->
  <p class="kind">{t('browser.matchDuplication.landsAfterSource')}</p>

  <!-- The duplicate control and the sentence that says why it is disabled are one
       block, because they are one statement: a control pinned to the bottom of
       the pane with its reason left above the fold would be a control that has
       stopped saying why. -->
  <div class="actions">
    <p class="choices">
      <button
        type="button"
        disabled={!current.view.canDuplicate}
        onclick={() => void runDuplicate(false)}
      >
        {t('browser.matchDuplication.duplicate')}
      </button>
      {#if current.view.duplicating}
        <span class="marker">{t('browser.matchDuplication.duplicating')}</span>
      {/if}
    </p>

    <!-- **Every refusal has a code**, and the precedence between them is
         `refusalGiven`'s rather than this file's: where two are true at once the
         one that claims less wins. -->
    {#if current.view.cannotDuplicate !== null}
      <p class="kind">{tDuplicationSubmissionRefusal(current.view.cannotDuplicate)}</p>
    {/if}
  </div>

  {#if current.view.sendFailure !== null}
    {@const failure = current.view.sendFailure}
    <div class="panel">
      <p>
        {failure.kind === 'mayHaveWritten'
          ? t('browser.matchDuplication.mayHaveWritten')
          : t('browser.matchDuplication.sendFailed')}
      </p>
      {#if current.view.failureLines.length > 0}
        <p class="kind">{t('browser.matchDuplication.failureReason')}</p>
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
      <!-- The consult's Q8: a typed command failure with a *Read this file
           again* recovery, offered for the four codes that say this window and
           the file disagree about an address and for nothing else. -->
      {#if current.view.recovery.length > 0}
        <p class="choices">
          {#each current.view.recovery as choice (choice)}
            <button type="button" onclick={() => void recoveryAction(choice)}>
              {tDuplicationRecovery(choice)}
            </button>
          {/each}
        </p>
      {/if}
      {#if reloadFailure !== null}
        <p class="kind">{t('browser.matchDuplication.reloadFailed')}</p>
        <p>{tIpcFailure(reloadFailure)}</p>
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
        <p class="kind">{tDuplicationReapplyObstacle(report.obstacle)}</p>
      {/if}
    </div>
  {/if}

  <!-- What recovery is on a surface that cannot create: one sentence, in the place
       the two surfaces that *can* create draw their form, so all six say it in the
       same position. There is no control here — no copy and no save-as-new — and its
       absence is the sentence: a projection-based new snippet offered as the way to
       finish a *duplication* is the split's named failure.

       **Mounted unconditionally**: whether there is anything to say is the shared
       renderer's decision, taken from the conflict below, and not a condition this
       markup repeats. Four surfaces that each decided it for themselves is the
       finding this component closed.

       **Not to be confused with `current.view.recovery`**, this panel's older
       neighbour and a different subject: what to do about a duplication whose send
       may or may not have written. -->
  <RecoveryWithoutCreation kind="operationChoice" conflict={current.view.conflict} />

  {#if current.view.outcome !== null}
    {@const outcome = current.view.outcome}
    <div class="panel" role="status" bind:this={outcomePanel}>
      {#each current.view.messages as message, index (index)}
        <p>{tSaveOutcomeMessage(message)}</p>
      {/each}

      {#if outcome.kind === 'saved'}
        {#if current.view.notes.length > 0}
          <!-- Always empty for a duplicate as the core stands — the clone is the
               item's own bytes and no scalar is re-encoded — and drawn anyway, so
               that a note the core learns to emit is shown rather than dropped
               (plan section 6.2). -->
          <p class="kind">{t('browser.matchDuplication.notes')}</p>
          <ul>
            {#each current.view.notes as note, index (index)}
              <li>{tPresentationNote(note)}</li>
            {/each}
          </ul>
        {/if}
        <!-- **This says the snippet was copied and nothing about a re-read.** The
             sentence is drawn whether the adoption succeeded or failed, so it must
             not claim the file was read again — `windowOutOfStep`, which can sit
             right above it, says this window could not read it back. Where two
             things could be said, the one that claims less wins. -->
        {#if current.view.duplicated}
          <p class="kind">{t('browser.matchDuplication.duplicated')}</p>
          <!-- `landed` is `null` on a legal committed duplicate: the command
               could not identify the clone in the read that followed the write,
               and the causes are not exhaustible from here — the file may have
               changed again, or that read may have failed. So the sentence says
               only that this window cannot say where the copy is, and never that
               a second writer exists. -->
          {#if current.view.landed === null}
            <p class="kind">{t('browser.matchDuplication.duplicatedNotIdentified')}</p>
          {/if}
        {/if}
        <p class="choices">
          {#if current.view.spent}
            <button type="button" onclick={() => close()}>
              {t('browser.matchDuplication.done')}
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
          <!-- **This panel's ordinary path.** A byte-exact copy keeps its
               source's trigger definition, and the transaction says so with an
               acknowledgeable finding on the first attempt; the finding travels
               back to the boundary untouched, so the consent it carries is bound
               to this candidate and no other. -->
          <p class="kind">{t('browser.matchDuplication.findings')}</p>
          <ul>
            {#each outcome.findings as finding, index (index)}
              <li>{tFindingCode(finding.code)}</li>
            {/each}
          </ul>
        {/if}
        {#if current.view.findingsAreStale}
          <p class="kind">{t('browser.matchDuplication.findingsAreStale')}</p>
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
          {t('browser.matchDuplication.revisionExpected', { revision: conflict.expected })}
        </p>
        <p class="kind">
          {t('browser.matchDuplication.revisionFound', { revision: conflict.found })}
        </p>
        <p class="kind">
          {t('browser.matchDuplication.revisionDisk', { revision: conflict.diskRevision })}
        </p>

        <h3>{t('browser.saveOutcome.retainedOperation')}</h3>
        <!-- What this session asked for, as the model summarises it. Nothing was
             typed here and there is no destination to hold — the clone lands
             immediately after its source — so there is no draft to render and no
             copy to offer (consult Q4); the snippet it is about is named at the top
             of this panel, from the projection this session opened over. -->
        {#if current.view.conflictOperation !== null}
          <p>{tConflictOperation(current.view.conflictOperation)}</p>
        {/if}
        <p class="kind">{t('browser.saveOutcome.operationIdentityIsOld')}</p>

        <h3>{t('browser.saveOutcome.diskVersion')}</h3>
        <!-- The whole file as the command layer read it, paired with
             `diskRevision`, and never a projection of "the same snippet" — which
             this application will not identify across revisions (consult Q5).
             Which arm is drawn is `conflictDiskText`'s decision and not this
             markup's (2c-4a-3a review, finding 5). -->
        {#if current.view.diskText !== null && current.view.diskText.kind === 'text'}
          <SourceText text={current.view.diskText.text} documentStart />
        {:else}
          <p class="marker">{t('browser.detail.fileTextEmpty')}</p>
        {/if}

        <!-- The second step's warning. The shared line above is the whole
             close/abandon guarantee and this one never restates it (2c-4a-3b
             review, finding 3); it says only what this surface alone can say —
             that no snippet in the new version will be guessed at, and what to do
             about that afterwards. -->
        {#if current.view.awaitingReloadConfirmation}
          <p class="kind">{t('browser.matchDuplication.reloadIdentifiesNoSnippet')}</p>
        {/if}

        <!-- A control that has just gone, with the reason in its place. -->
        {#if current.view.reloadUnavailable}
          <p class="kind">{tReloadUnavailable(CONFLICT_CAPABILITIES.draftKind)}</p>
        {/if}

        <!-- The line beside *Keep my draft*: what this app will **try**, what it
             works from, when it writes nothing, and what a later save may still
             do. Drawn when the model names that choice and never from this
             surface's own declaration, so the sentence and the control cannot
             disagree (consult Q6). -->
        {#if current.view.reapplyOffered}
          <p class="kind">{tReapplyReadiness(CONFLICT_CAPABILITIES.draftKind)}</p>
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
  .duplicator {
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

  /* The conflict panel's two headings: what was asked for, and what is on disk. */
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

  /* The panel's own action row, with the sentence that says why the duplicate
     control is disabled.

     **Sticky at the bottom of the pane**, which is the move panel's answer to the
     2c-3a-2 layout finding, kept here for the same reason: this panel has no
     destination list and is therefore short today, but an outcome panel, a
     refusal with several findings and a longer translation all grow it, and the
     primary control has to stay on screen when they do. `.duplicator` is a flex
     item that shrinks to the pane's height with its content overflowing, so its
     content box bottom *is* the bottom of what the pane shows, and `bottom: 0`
     clamps this row to exactly there.

     The background is opaque for the only reason a sticky row ever needs one:
     while it is pinned, the panel scrolls underneath it. */
  .actions {
    position: sticky;
    bottom: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.25rem 0;
    background: var(--surface);
  }

  /* Anything this app says about the duplicate rather than about the snippet: the
     outcome arms, a send that never left, a re-read that failed. */
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

  /* This app declining to copy the snippet at all, bordered like the detail
     pane's own refusal because it is the same kind of statement. */
  .blocked {
    margin: 0;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.8125rem;
  }
</style>
