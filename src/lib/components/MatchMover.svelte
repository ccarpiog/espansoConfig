<script lang="ts">
  import { labelText, triggerLabel } from '../browser/labels';
  import { identityInProjection } from '../browser/matchDeletion';
  import {
    acknowledgementOf,
    acknowledgeMoveFindings,
    applyMove,
    askToReloadDiskVersion,
    baseRevisionOf,
    beginMove,
    canChoose,
    choosePlacement,
    CONFLICT_CAPABILITIES,
    confirmDiskReload,
    dismissMoveOutcome,
    matchMoveView,
    moveCouldNotBeSent,
    movePlacementOptionsOf,
    moveRecoveryFailed,
    reapplyToDiskVersion,
    reloadTheDiskVersion,
    startMatchMove,
    type MatchMoveView,
    type MovePlacementOption,
    type MoveReapplyAttempt,
    type MoveRecovery
  } from '../browser/matchMove';
  import type { RawSaveChoice } from '../browser/rawSave';
  import type { AdoptTheDiskVersion } from '../browser/editorSave';
  import type { MovePlacement } from '../browser/matchMove';
  import { attemptOfReapply, reapplyToShow } from '../browser/reapply';
  import { outcomeReveal, type ConflictChoice } from '../browser/saveOutcome';
  import type { MatchSaveAnswer } from '../browser/workspace.svelte';
  import { revealOutcome } from './reveal';
  import SourceText from './SourceText.svelte';
  import {
    t,
    tConflictChoice,
    tConflictOperation,
    tDetailField,
    tDraftError,
    tEditError,
    tFindingCode,
    tIpcFailure,
    tMoveReapplyObstacle,
    tMoveRecovery,
    tMoveRefusal,
    tMoveReloadWarning,
    tMoveSubmissionRefusal,
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
   * Moving one snippet inside the list it is in: the destination panel.
   *
   * **This file is presentation.** What may be moved, where to, when a move may
   * be sent, what a refusal means, what a commit spends and what the wire takes
   * are all in `../browser/matchMove.ts`, which has a test suite. This is a walk
   * over `matchMoveView`'s answer and `movePlacementOptionsOf`'s list, exactly as
   * `MatchCreator.svelte` and `MatchDeleter.svelte` are walks over theirs — and
   * the smallness is why fourteen review findings were reachable in step 1 with
   * no screen at all.
   *
   * The bolded paragraphs below are the things in this markup that are
   * load-bearing rather than style.
   *
   * **The view, the destinations and the submission identity come from one read
   * of the projections** (`matchMove.ts`'s header, R37). `current` below reads
   * `projections()` **once** and derives all three from that one array, and
   * `runMove` takes the identity it hands `beginMove` out of the same value. The
   * module states plainly that its agreement is one rule over *consistent*
   * inputs and that nothing in a signature can force consistency: three separate
   * reads can fall between two parses, and the panel would then offer a
   * destination list from one projection while refusing — or not refusing —
   * against another. This is the caller that closes that half, and nothing in
   * TypeScript checks that it stays closed.
   *
   * **`view.notMovableToShow` is drawn whenever it is not `null`, and the rule
   * behind that is the model's.** The frozen eligibility and the live refusal
   * answer at two different times: the first was read off the parse this panel
   * opened over and no transition recomputes it, so after a reprojection it is a
   * definite claim about a snippet the window has replaced. `refusalGiven` puts
   * `outOfDate` above `notMovable` for exactly that reason, and handing the frozen
   * reason to a screen unconditionally would put the suppressed certainty straight
   * back on through the other field. Until 2c-4a-3b a condition in *this markup*
   * was the only thing stopping it — the shape `matchDuplication.ts` moved away
   * from at 2c-3c-3's Medium — and the rule now lives in `matchMove.ts`, where a
   * model test drives it and no second renderer can omit it.
   *
   * **The identity `beginMove` checks is read from the live projections, here,
   * at the moment of the click.** `identityInProjection(current.views, …)` and
   * never `session.match`: the session's identity was minted when this panel
   * opened, so it agrees with itself however stale it is, and a panel retained
   * across a re-read of the file would still send. The `projections` prop is a
   * **function** for that reason — a captured array is a snapshot, and a snapshot
   * is what the check exists to notice. What no type here forces, in the same
   * sentence: nothing stops a caller passing a function that answers a stale
   * array, and nothing in `matchMove.ts` can see where its argument came from.
   *
   * **There is no confirmation dialog** (the design consult's Q7). Choosing a
   * destination and pressing *Move this snippet* is already a deliberate
   * two-step interaction, and only a validation refusal introduces the
   * acknowledge-and-retry round. Copying the deletion panel's ceremony here would
   * add a step without resolving any additional risk.
   *
   * **The boundary sentence stays beside the list** (Q4), including in the *All*
   * scope: a move stays inside one snippet list, so the destinations offered here
   * are that file's and no other file's snippet is a candidate. Snippets in other
   * files are outside a move's destination domain rather than failed candidates
   * that each need a disabled row, which is consult correction 8 — the creation
   * form's *show every ineligible destination* rule does not generalise.
   *
   * **The destination list is the file's order, not the search box's** (Q6).
   * `movePlacementOptionsOf` walks the session's own anchors, which
   * `startMatchMove` took from the complete sequence; nothing in this file
   * filters, sorts or renumbers it, and the chosen anchor is *named* rather than
   * being a position the person has to count to.
   *
   * **The destination list is bounded and the action row is sticky, and both are
   * layout rather than policy.** `docs/decisions/2c-3a-2-window-reading.md`
   * section 7.2 measured what an unbounded one-row-per-something list does to
   * this pane: the creation form opened 805 px tall inside a 645 px pane with its
   * primary control below the fold, and got worse with every file in the
   * workspace. This list draws one row per snippet in the sequence, which is the
   * same shape and can be longer, so it has a maximum height and scrolls inside
   * itself. **No destination is hidden and no sentence is truncated.**
   *
   * **A spent session is a dead end with a way out, and the panel says which
   * one.** There is no repair for an `outOfDate`, an `alreadyMoved` or a
   * `mayHaveWritten` session, and the reason is not one reason but three: every
   * identity it holds was minted from a parse that is gone, **or** from a send
   * whose effect this application cannot establish, **or** — after a recovery
   * re-read that failed — from a parse still installed whose identity the command
   * has already contradicted, with no better one obtainable. The third is
   * `moveRecoveryFailed`'s, and it is the case where the parse is *not* gone;
   * saying it is would be this file claiming something the code does not do.
   * The sentence `view.cannotMove` renders is what tells the person to close this
   * and pick the snippet in the list again, and the header's *Leave it where it
   * is* is that exit. Offering a *Move it anyway* would be a control that cannot
   * work.
   *
   * **The conflict panel shows two sides and identifies nothing across them.** The
   * retained side is `view.conflictOperation` — the model's summary of the
   * placement the conflict kept — because a `MovePlacement` is a positional choice
   * and not authored text, which is why the consult's Q4 refuses a copy here as a
   * property of the drafted value and `conflictChoicesFor` refuses it whatever this
   * surface declares. The disk side is the whole file text the command layer read,
   * through `SourceText`; which arm of it is drawn is `conflictDiskText`'s decision
   * and not this markup's. The confirmed reload installs the disk projection and
   * **closes** this panel, and the destination goes with it: an anchor names a
   * snippet of the parse this window read, and finding "the same" one in another
   * revision is 2c-4b.
   *
   * **The panel cannot be left while a move is in flight**, for 2c-1b's reason:
   * the request is authorized and cannot be cancelled, so unmounting would leave
   * it free to commit with its outcome drawn nowhere.
   */

  const {
    projection,
    match,
    file,
    projections,
    unsavedDraftFor,
    move,
    reload,
    adoptDiskVersion,
    close
  }: {
    /**
     * The file's projection, **captured with the snippet**.
     *
     * One assignment at the call site, which is 2c-2-2's High finding one level
     * up: a projection and a snippet taken from two reads type-check perfectly
     * and can describe two different parses. `startMatchMove` checks the pair and
     * refuses one this projection does not describe, so taking them apart turns a
     * real move into a `notInDocument` refusal.
     */
    projection: DocumentView;
    /** The snippet being moved, as it was projected when this opened. */
    match: MatchView;
    /**
     * The file it lives in, for the person to see which one it is.
     *
     * **Not what the boundary sentence names.** That sentence is a claim about
     * where the destinations below it came from, so it is drawn from
     * `projection.relative_path` — the parse this panel actually built them
     * from — and it is therefore drawn whether or not this window lists a summary
     * for the file, which is the consult's Q4 read literally.
     */
    file: DocumentSummary | null;
    /**
     * Every projection this window holds **now**.
     *
     * A function and not an array: see this file's note on the submission
     * identity.
     */
    projections: () => readonly DocumentView[];
    /**
     * The snippet this window is holding unsaved edits for, or `null`.
     *
     * Read once, when this panel opens, and handed straight to
     * `startMatchMove` — the model's `unsavedDraft` arm is this application's
     * workflow policy (consult correction 2), not the file refusing: a committed
     * move gives the snippet a new identity, which strands a draft addressed to
     * the old one.
     *
     * **The comparison is all three fields**, so the identity handed in has to be
     * one the live projection gives that snippet; a draft held over an older
     * parse does not match and the move is allowed. Following a draft across a
     * reparse is not something this application can do — `identityInProjection`
     * resolves by arena node alone and would answer a *different* snippet's
     * identity — so the conservative half is the caller's: see
     * `docs/decisions/2c-3b-2-notes.md` section 3 for what `DetailPane.svelte`
     * supplies and what it cannot.
     */
    unsavedDraftFor: () => MatchId | null;
    /**
     * Sends one move.
     *
     * **`BrowserState.moveMatch` and nothing else.** That method re-reads the
     * file, re-points the selection at the moved snippet and reports what became
     * of the adoption before the answer is handed back; `moveMatch` in
     * `../ipc/commands` is the same call without any of it, and a component that
     * reached for it would leave every `MatchId` this window holds for the file
     * naming bytes that have moved. Nothing in TypeScript stops that, which is
     * why it is written here.
     *
     * @param id - The snippet to move, by the identity checked against the live
     *   projection.
     * @param after - The snippet it should follow, or `null` for the top of the
     *   list. Already lowered: the panel's *end* is an identity by the time it
     *   reaches here, because the wire has no such anchor.
     * @param baseRevision - The revision the session was opened at.
     * @param acknowledgement - The suspicions already shown to a person.
     * @returns The outcome and the adoption's fate, or a typed failure.
     */
    move: (
      id: MatchId,
      after: MatchId | null,
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
    /** Leaves the destination panel. */
    /**
     * Installs the disk observation a conflict carried into the window.
     *
     * `BrowserState.adoptDiskVersion`, the sole frontend transition that moves
     * this window to the disk side of a conflict. It is called by
     * `reloadTheDiskVersion` and by nothing here, so the projection cannot be
     * replaced without this mover closing in the same call — and a `refused` from
     * it is honoured by closing nothing, while an `alreadyThere` is a success the
     * transition finishes on.
     */
    adoptDiskVersion: AdoptTheDiskVersion<MovePlacement>;
    close: () => void;
  } = $props();

  // `$state.raw`: a session is an immutable value replaced whole on every
  // transition, and its draft holds deep-frozen snapshots a reactive proxy has no
  // business walking. Capturing the projection once is the point — a session that
  // re-derived itself from its props would be replaced every time the workspace
  // re-read the file, which is precisely the event `moveSubmissionRefusal` must
  // notice rather than absorb.
  // svelte-ignore state_referenced_locally
  let session = $state.raw(startMatchMove(projection, match, unsavedDraftFor()));

  /**
   * The last *Keep my draft* attempt, or `null` when this panel has made none.
   *
   * **Held with the session it produced**, which is what stops a report outliving
   * what it describes: `reapplyToShow` answers `null` the moment `session` is
   * replaced by anything else, and every transition in the model returns a new
   * value. Nothing here has to remember to clear it.
   */
  let reapplyAttempt = $state.raw<MoveReapplyAttempt | null>(null);

  /** What the last attempt left this panel to say, or `null`. */
  const reapplyReport = $derived(reapplyToShow(reapplyAttempt, session));

  /**
   * Everything derived from **one** read of the current projections.
   *
   * R37, and the reason it is one value rather than three `$derived`s: the view,
   * the destination options and the identity `beginMove` is given must all
   * describe one parse, and three independent reads of `projections()` can fall
   * between two of them. Nothing in `matchMove.ts` can require it; this is where
   * it is done.
   */
  const current: {
    /** The projections everything below was derived from. */
    views: readonly DocumentView[];
    /** What the panel draws about the move itself. */
    view: MatchMoveView;
    /** The destinations the panel offers, in the file's order. */
    options: readonly MovePlacementOption[];
  } = $derived.by(() => {
    const views = projections();
    return {
      views,
      view: matchMoveView(session, views),
      options: movePlacementOptionsOf(session, views)
    };
  });

  /**
   * Whether the destination controls accept a choice at all.
   *
   * **The model's answer, not a condition assembled here.** `canChoose` names
   * five reasons a session stops accepting one — in flight, a conflict on screen,
   * a commit, a send that may already have written, and a projection this session
   * was told had been replaced — and a component enumerating any subset of them
   * would be a second opinion about the model's own rule.
   */
  const choosing = $derived(canChoose(session));

  /** What the snippet fires from, for the person to recognise it by. */
  const named = $derived(triggerLabel(match));

  /** The snippet's own label, or `null`. */
  const label = $derived(labelText(match));

  /** The outcome panel's own element, so it can be brought into view. */
  let outcomePanel = $state<HTMLElement | null>(null);
  /** The conflict arm's row of controls, which is the second step's target. */
  let outcomeChoices = $state<HTMLElement | null>(null);

  /*
   * **The outcome panel is scrolled into view when it appears** — 2c-4a-3c's
   * findings 10.3 and 10.4. This panel opened at y = 469 with its controls at
   * y = 1139 in a 728 px viewport, and `section.detail`'s `scrollTop` was `0` when
   * it appeared. The decision is `./reveal.ts`'s and the two `bind:this` targets are
   * this file's.
   *
   * **The confirmation step is `reloadWarning !== null` here and not a boolean**,
   * which is `matchMove.ts`'s own arrangement: this surface's warning has two arms,
   * so the condition and the arm it selects are decided together rather than in two
   * fields that have to agree.
   */
  const reveal = $derived(
    outcomeReveal(current.view.outcome?.kind ?? null, current.view.reloadWarning !== null)
  );
  $effect(() => {
    revealOutcome(reveal, outcomePanel, outcomeChoices);
  });

  /**
   * Why the last *read this file again* failed, or `null`.
   *
   * Kept here rather than in the model because it is the *reason*, and the reason
   * is about one attempt rather than about the file: the window goes on holding
   * exactly what it held, and without this the control would look like one that
   * does nothing. What the failure means for the session — that it may no longer
   * send anything — is the model's, through `moveRecoveryFailed`.
   */
  let reloadFailure = $state.raw<IpcFailure | null>(null);

  /**
   * Chooses where in the list the snippet should go.
   *
   * The option is looked up by the key its own control carries, so the placement
   * installed is the one the model built rather than one this file assembled from
   * a row index.
   *
   * @param key - The chosen option's key.
   */
  function onPlacement(key: string): void {
    const option = current.options.find((one: MovePlacementOption) => one.key === key);
    if (option === undefined) {
      return;
    }
    // A destination that really moves withdraws everything said about the last
    // attempt, which is `choosePlacement`'s own rule; the re-read's failure is
    // drawn inside that same panel, so it goes with it rather than outliving the
    // send it was about.
    reloadFailure = null;
    session = choosePlacement(session, option.placement);
  } // End of function onPlacement()

  /** Puts the outcome away. The draft, and everything spent, survive it. */
  function onDismiss(): void {
    reloadFailure = null;
    session = dismissMoveOutcome(session);
  } // End of function onDismiss()

  /**
   * Sends the move, optionally accepting the findings on screen first.
   *
   * The acknowledgement is never assembled here: `acknowledgeMoveFindings`
   * records consent through the one function that can, and `beginMove` reads it
   * back through `submissionOf`, so what goes to the boundary is consent bound to
   * the exact destination being sent or nothing at all.
   *
   * **`current` is read once**, after the consent has been recorded, and both the
   * live identity and the verdict the panel was showing come out of that one
   * read. See this file's note on R37.
   *
   * @param acknowledge - Whether this is the *Save anyway* control.
   */
  async function runMove(acknowledge: boolean): Promise<void> {
    if (acknowledge) {
      session = acknowledgeMoveFindings(session);
    }
    const started = beginMove(session, identityInProjection(current.views, session.match));
    if (started === null) {
      // The model refuses, and it has already said why: `current.view.cannotMove`
      // is computed from the same read this call just made, so the sentence beside
      // the control is the reason this returned. A second message here would be
      // this file deciding what a refusal means.
      return;
    }
    session = started.session;
    reloadFailure = null;
    const answer = await move(
      started.match,
      started.after,
      // **The session's own base, never the window's current projection.** A move
      // resolves identities to *positions*, so a session opened at one revision
      // and sent after the window has re-read the file must conflict rather than
      // reorder whatever now sits there.
      baseRevisionOf(started.session),
      acknowledgementOf(started.submission)
    );
    // Three arms, and each says something different about the file. `notAttempted`
    // is this window refusing before a command ran — nothing was sent, so nothing
    // was written and there is no reason to show. `failed` is a command that ran
    // and rejected, and it always carries why.
    if (answer.kind === 'answered') {
      session = applyMove(session, answer.result, answer.adoption);
      return;
    }
    session =
      answer.kind === 'notAttempted'
        ? moveCouldNotBeSent(session, false, null)
        : moveCouldNotBeSent(session, answer.mayHaveWritten, answer.failure);
  } // End of function runMove()

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
   * changed. The decision record claimed the first case for every successful
   * re-read; `docs/decisions/2c-3b-2-notes.md` section 2.7 now says which.
   *
   * **A re-read that fails spends it, and that is `moveRecoveryFailed`'s rule
   * rather than this file's.** The recovery is offered for four codes and all four
   * say the address this window sent does not describe the file the command read,
   * so a read that cannot reach the file leaves the disagreement standing with no
   * way to resolve it. The typed reason stays on screen beside the send failure;
   * the model is what stops anything else being sent.
   *
   * @param choice - The choice the person picked.
   */
  async function recoveryAction(choice: MoveRecovery): Promise<void> {
    switch (choice) {
      case 'reloadFile': {
        const failure = await reload(session.document);
        reloadFailure = failure;
        if (failure !== null) {
          // Read from `session` rather than from a value captured before the
          // await: a destination chosen while the read was in flight has already
          // replaced the session, and spending the one this call started with
          // would put that choice back.
          session = moveRecoveryFailed(session);
        }
        return;
      }
    }
  } // End of function recoveryAction()

  /**
   * Does what one refusal choice says.
   *
   * *Save anyway* records the consent and sends again in one step, which is
   * `MatchCreator.svelte`'s shape rather than `MatchDeleter.svelte`'s: a deletion
   * re-raises its confirmation because `confirmDelete` consumed the pending one,
   * and a move has no confirmation to re-raise (the consult's Q7).
   *
   * @param choice - The choice the person picked.
   */
  function refusalAction(choice: RawSaveChoice): void {
    if (choice === 'saveAnyway') {
      void runMove(true);
      return;
    }
    session = dismissMoveOutcome(session);
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
    const attempt = attemptOfReapply(session, reapplyToDiskVersion(session, unsavedDraftFor(), adoptDiskVersion));
    reapplyAttempt = attempt;
    session = attempt.session;
  } // End of function keepMyDraft()

  /**
   * Does what one conflict choice says.
   *
   * **Three of the four arms are reachable as of 2c-4a-3b.** `matchMove.ts`'s
   * `CONFLICT_CAPABILITIES` declares this draft an `operationChoice` — a placement
   * is a positional choice and not authored text — so *Copy draft* can never be
   * offered here, whatever a later change sets; `offersReload` is now `true`, so
   * `conflictChoicesFor` names the two reload labels and this panel draws them. The
   * reload adopts the disk projection and **closes** the mover; it was built and
   * wired at 2c-4a-2 and is driven by `matchMove.test.ts`.
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
        session = dismissMoveOutcome(session);
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
    }
  } // End of function conflictAction()
</script>

<section class="mover" aria-label={t('browser.matchMove.label')}>
  <div class="head">
    <h2>{t('browser.matchMove.label')}</h2>
    <button type="button" disabled={current.view.moving} onclick={() => close()}>
      {t('browser.matchMove.close')}
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

  <!-- **One condition, and it is a null check rather than a rule.** The model has
       already applied the precedence: `notMovableToShow` is the frozen reason only
       when it is the reason the control is disabled, and `null` whenever a weaker
       live claim — an `outOfDate` above all — won instead. See this file's own note
       on why that decision is no longer made here. -->
  {#if current.view.notMovableToShow !== null}
    <p class="blocked">{tMoveRefusal(current.view.notMovableToShow)}</p>
  {/if}

  {#if current.view.moving}
    <p class="kind">{t('browser.matchMove.movingCannotBeStopped')}</p>
  {/if}

  <div class="field">
    <p class="name">{t('browser.matchMove.destination')}</p>
    <!-- The consult's Q4, kept beside the list in every scope: a move stays
         inside one snippet list, and this sentence is what says which one. -->
    <p class="kind">
      {t('browser.matchMove.withinThisFile', { file: projection.relative_path })}
    </p>
    <!-- One row per destination: top, one per anchor in the file's own order,
         then end. Bounded and scrolling inside itself — see this file's note on
         the 2c-3a-2 layout finding. -->
    <ul class="destinations">
      {#each current.options as option (option.key)}
        <li>
          <button
            type="button"
            class="choice"
            aria-pressed={option.chosen}
            disabled={!choosing}
            onclick={() => onPlacement(option.key)}
          >
            {#if option.placement.kind === 'top'}
              {t('browser.matchMove.position.top')}
            {:else if option.placement.kind === 'end'}
              {t('browser.matchMove.position.end')}
            {:else if option.anchor !== null}
              {@const anchor = triggerLabel(option.anchor)}
              {t('browser.matchMove.position.after', {
                trigger: anchor.kind === 'text' ? anchor.text : tTriggerKind(anchor.code)
              })}
            {/if}
          </button>
          <!-- Two options can carry this at once, and that is the aliasing the
               model exposes rather than hides: for a snippet that is already
               last, *end* and *after the one above it* are one request. -->
          {#if option.current}
            <span class="marker">{t('browser.matchMove.position.current')}</span>
          {/if}
        </li>
      {/each}
    </ul>
  </div>

  <!-- The move control and the sentence that says why it is disabled are one
       block, because they are one statement: a control pinned to the bottom of
       the pane with its reason left above the fold would be a control that has
       stopped saying why. -->
  <div class="actions">
    <p class="choices">
      <button
        type="button"
        disabled={!current.view.canMove}
        onclick={() => void runMove(false)}
      >
        {t('browser.matchMove.move')}
      </button>
      {#if current.view.moving}
        <span class="marker">{t('browser.matchMove.moving')}</span>
      {/if}
    </p>

    <!-- **Every refusal has a code**, and the precedence between them is
         `refusalGiven`'s rather than this file's: where two are true at once the
         one that claims less wins. -->
    {#if current.view.cannotMove !== null}
      <p class="kind">{tMoveSubmissionRefusal(current.view.cannotMove)}</p>
    {/if}
  </div>

  {#if current.view.sendFailure !== null}
    {@const failure = current.view.sendFailure}
    <div class="panel">
      <p>
        {failure.kind === 'mayHaveWritten'
          ? t('browser.matchMove.mayHaveWritten')
          : t('browser.matchMove.sendFailed')}
      </p>
      {#if current.view.failureLines.length > 0}
        <p class="kind">{t('browser.matchMove.failureReason')}</p>
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
              {tMoveRecovery(choice)}
            </button>
          {/each}
        </p>
      {/if}
      {#if reloadFailure !== null}
        <p class="kind">{t('browser.matchMove.reloadFailed')}</p>
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
    <div class="panel" role="status">
      <p>{tReapplyOutcome(report.kind)}</p>
      {#if report.kind === 'manualResolution'}
        <p class="kind">{tMoveReapplyObstacle(report.obstacle)}</p>
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
          <!-- Always empty for a move as the core stands — `plan_move` sets no
               note — and drawn anyway, so that a note the core learns to emit is
               shown rather than dropped (plan section 6.2). -->
          <p class="kind">{t('browser.matchMove.notes')}</p>
          <ul>
            {#each current.view.notes as note, index (index)}
              <li>{tPresentationNote(note)}</li>
            {/each}
          </ul>
        {/if}
        <!-- **This says the snippet was moved and nothing about a re-read**, which
             is the second review's second finding: `view.moved` is true whether the
             adoption succeeded or failed, so a sentence claiming the file had been
             read again was drawn beside `windowOutOfStep`, which says this window
             could not read it back. Where two things could be said, the one that
             claims less wins. -->
        {#if current.view.moved}
          <p class="kind">{t('browser.matchMove.moved')}</p>
          <!-- `landed` is `null` on a legal committed move: the command answers
               no identity when the file changed again between the write and the
               read that followed it, and a screen that could not draw that case
               would be claiming something the wire does not promise. **That
               intervening change may itself have removed or replaced the
               snippet**, so the sentence says the window cannot tell where it is
               or whether it is still there — the third review finding. -->
          {#if current.view.landed === null}
            <p class="kind">{t('browser.matchMove.movedNotIdentified')}</p>
          {/if}
        {/if}
        <p class="choices">
          {#if current.view.spent}
            <button type="button" onclick={() => close()}>
              {t('browser.matchMove.done')}
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
          <p class="kind">{t('browser.matchMove.findings')}</p>
          <ul>
            {#each outcome.findings as finding, index (index)}
              <li>{tFindingCode(finding.code)}</li>
            {/each}
          </ul>
        {/if}
        {#if current.view.findingsAreStale}
          <p class="kind">{t('browser.matchMove.findingsAreStale')}</p>
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
          {t('browser.matchMove.revisionExpected', { revision: conflict.expected })}
        </p>
        <p class="kind">{t('browser.matchMove.revisionFound', { revision: conflict.found })}</p>
        <p class="kind">
          {t('browser.matchMove.revisionDisk', { revision: conflict.diskRevision })}
        </p>

        <h3>{t('browser.saveOutcome.retainedOperation')}</h3>
        <!-- What this session asked for, as the model summarises it from the
             placement the conflict retained. Nothing was typed here, so there is no
             draft to render and no copy to offer (consult Q4). Whether the summary
             may send the reader to the marked destination above is decided against
             the same option list this panel draws, in `matchMove.ts` and not here
             (2c-4a-3b review, finding 2). -->
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
             review, finding 3); it says only what becomes of the destination, and
             **which** of its two sentences that is belongs to the model, because a
             destination that names a snippet and one that names a position lose
             different things (finding 1). -->
        {#if current.view.reloadWarning !== null}
          <p class="kind">{tMoveReloadWarning(current.view.reloadWarning)}</p>
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
  .mover {
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

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .name {
    margin: 0;
    color: var(--muted);
    font-size: 0.8125rem;
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

  /* One row per destination: the top of the list, one per snippet the move can
     be written after, then the bottom.

     **Bounded, and it scrolls inside itself**, which is the creation form's fix
     applied before the same defect can happen here rather than after.
     `docs/decisions/2c-3a-2-window-reading.md` section 7.2 measured a form 805 px
     tall inside a 645 px pane because its list drew one full control per listed
     file with no bound, putting the primary action below the fold on open and
     making it worse with every file the person has. This list is one row per
     snippet **in one file's list**, which is the same shape and is routinely
     longer than a file count. A maximum height turns that into a constant: the
     list is the same height at four snippets and at forty, and what changes is
     how far it scrolls. Nothing is omitted and no label is clipped. */
  .destinations {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 12rem;
    overflow-y: auto;
  }

  .destinations li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.5rem;
  }

  .choice {
    text-align: start;
  }

  .choice[aria-pressed='true'] {
    background: var(--surface-raised);
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

  /* The panel's own action row, with the sentence that says why the move control
     is disabled.

     **Sticky at the bottom of the pane**, which is the half of the 2c-3a-2 fix
     that does not depend on an estimate: bounding the list is what makes the
     panel fit today, and this is what keeps the primary control on screen when
     it does not — a longer translation, an outcome panel below, a refusal with
     several findings. `.mover` is a flex item that shrinks to the pane's height
     with its content overflowing, so its content box bottom *is* the bottom of
     what the pane shows, and `bottom: 0` clamps this row to exactly there.

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

  /* Anything this app says about the move rather than about the snippet: the
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

  /* This app declining to move the snippet at all, bordered like the detail
     pane's own refusal because it is the same kind of statement. */
  .blocked {
    margin: 0;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.8125rem;
  }
</style>
