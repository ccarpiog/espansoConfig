<script lang="ts">
  import {
    acknowledgeBulkRefusal,
    bulkConsentReview,
    bulkConsentReviewStatus,
    bulkControls,
    bulkExclusionRows,
    bulkFileLines,
    bulkNarrowingOffered,
    bulkOptionField,
    bulkOutcomeCounts,
    bulkPlanCounts,
    bulkSuggestionsFor,
    canRedoBulkDraft,
    canUndoBulkDraft,
    chooseBulkIntent,
    EMPTY_BULK_DRAFT,
    failedSpellingReads,
    grantsAfterBulkAnswer,
    matchKeyOf,
    prepareBulkApply,
    redoBulkDraft,
    setBulkIntent,
    spellingReadOf,
    spellingReadsWanted,
    summarizeBulkResult,
    typeBulkIntentText,
    undoBulkDraft,
    withoutFailedReads,
    type BulkApplyAnswer,
    type BulkConsentGrant,
    type BulkDraft,
    type BulkIntentChoice,
    type BulkPlan,
    type BulkSelection,
    type BulkSubmission,
    type SpellingRead
  } from '../browser/bulkEdit';
  import { triggerLabel } from '../browser/labels';
  import type { CommandResult } from '../ipc/commands';
  import type {
    BulkOption,
    BulkOptionSpellings,
    BulkOptionsRequest,
    DocumentId,
    DocumentSummary,
    DocumentView,
    MatchId
  } from '../ipc/types';
  import {
    t,
    tBulkBlocker,
    tBulkCount,
    tBulkExclusion,
    tBulkFileOutcome,
    tBulkOptionSummary,
    tBulkOutcomeHeadline,
    tCommandError,
    tDetailField,
    tFindingCode,
    tIpcFailure,
    tSaveVerdict,
    tTriggerKind
  } from '../i18n';
  import SourceText from './SourceText.svelte';

  /*
   * The bulk option inspector — Phase 3-11-2 (`docs/decisions/3-split-notes.md`
   * §2 step 3-11; rulings 20–22). It draws the values `../browser/bulkEdit.ts`
   * decides, and decides nothing itself: which options exist, how each is
   * written across the selection (*Mixed* included, from Rust-cut spellings),
   * what the controls hold, what is left out and why, what blocks an apply, the
   * consent review and the counted outcome are all that module's.
   *
   * **What this component holds** is session state no other component needs:
   * the spelling reads taken so far, the drafted intents with their history, the
   * consent grants and the last answer. The selection is the window's
   * (`BrowserState.bulkSelection`), handed in, because the snippet list draws it
   * too.
   *
   * **Every option is a textual control** (`CLAUDE.md` §6): a choice of
   * *leave / set / remove* and a text box holding exactly what will be written.
   * No checkbox decides that `true` is a boolean. A text box here holds only what
   * the person typed; a file's own spelling is drawn through `SourceText`, never
   * put into a box, so the `\r` normalization of an `<input>` can never touch a
   * file's bytes.
   *
   * **Undo is the draft's.** *Undo* and *Redo* walk the drafted intents and touch
   * no file; the sentence beside the apply says that a saved file is not taken
   * back by anything here (ruling 21).
   *
   * **This inspector registers no write surface**, deliberately
   * (`docs/decisions/3-11-2-notes.md` §2 D1): `DetailPane.svelte` counts it in
   * `busy`, so no other write surface can open while it is drawn, and a reload
   * under it only makes the selection stale, which blocks.
   */

  const {
    selection,
    views,
    documents,
    openDrafts,
    readSpellings,
    apply,
    replaceSelection,
    stop
  }: {
    /** The window's bulk selection. */
    selection: BulkSelection;
    /** The window's live projections. */
    views: readonly DocumentView[];
    /** The files the window lists, for their names. */
    documents: readonly DocumentSummary[];
    /** Every snippet the window has a match editor open over, dirty or not. */
    openDrafts: readonly MatchId[];
    /** `BrowserState.matchOptionSpellings`. */
    readSpellings: (id: MatchId) => Promise<CommandResult<BulkOptionSpellings>>;
    /** `BrowserState.applyBulkOptions`. */
    apply: (request: BulkOptionsRequest) => Promise<BulkApplyAnswer>;
    /** `BrowserState.replaceBulkSelection`. */
    replaceSelection: (next: BulkSelection) => void;
    /** Stops selecting several, which closes this inspector. */
    stop: () => void;
  } = $props();

  /** One sent request and what came back for it. */
  interface LastApply {
    /** What was sent. */
    readonly submission: BulkSubmission;
    /** The plan it was built from. */
    readonly plan: BulkPlan;
    /** The selection it was built from — what the answer is about. */
    readonly selection: BulkSelection;
    /** What came back. */
    readonly answer: BulkApplyAnswer;
  }

  let reads = $state.raw<ReadonlyMap<string, SpellingRead>>(new Map());
  let draft = $state.raw<BulkDraft>(EMPTY_BULK_DRAFT);
  let grants = $state.raw<readonly BulkConsentGrant[]>([]);
  let applying = $state(false);
  let last = $state.raw<LastApply | null>(null);

  // Keys of reads in flight. Not reactive: the effect below writes it, and a
  // reactive set would make the effect depend on its own writes.
  const pending = new Set<string>();

  const readiness = $derived(
    prepareBulkApply({
      selection,
      views,
      reads,
      intents: draft.intents,
      openDrafts,
      grants
    })
  );
  const controls = $derived(bulkControls(selection, reads, draft.intents));
  const exclusions = $derived(bulkExclusionRows(readiness.plan, views));
  const counts = $derived(bulkPlanCounts(readiness.plan));
  const unreadable = $derived(failedSpellingReads(selection, reads));

  /**
   * Reads one snippet's spellings and records the answer under its key.
   *
   * @param id - The snippet.
   */
  async function readOne(id: MatchId): Promise<void> {
    const key = matchKeyOf(id);
    pending.add(key);
    try {
      const answer = await readSpellings(id);
      reads = new Map(reads).set(key, spellingReadOf(answer));
    } finally {
      pending.delete(key);
    }
  } // End of function readOne()

  // Which reads to take is the model's (`spellingReadsWanted`); this only runs them.
  $effect(() => {
    for (const id of spellingReadsWanted(selection, reads, pending)) {
      void readOne(id);
    } // End of the loop over the reads to take
  });

  /**
   * Sends the request the model built, if it built one.
   */
  async function onApply(): Promise<void> {
    const ready = readiness;
    if (ready.kind !== 'ready' || applying) {
      return;
    }
    applying = true;
    const sent = grants;
    const submitted = selection;
    try {
      const answer = await apply(ready.submission.request);
      last = { submission: ready.submission, plan: ready.plan, selection: submitted, answer };
      if (answer.kind === 'answered') {
        grants = grantsAfterBulkAnswer(sent, answer.result);
      }
    } finally {
      applying = false;
    }
  } // End of function onApply()

  /**
   * Records the person's consent for one refused file of the last answer.
   *
   * @param document - The file.
   */
  function onConsent(document: DocumentId): void {
    if (last === null || last.answer.kind !== 'answered' || reviewStatus(document) !== 'offered') {
      return;
    }
    grants = acknowledgeBulkRefusal(grants, last.submission, last.answer.result, document);
  } // End of function onConsent()

  /**
   * Where one refused file's review stands now: `bulkConsentReviewStatus` over
   * the key the last submission was built under and the plan and intents now.
   *
   * @param document - The file.
   * @returns `offered`, `recorded` or `outdated`.
   */
  function reviewStatus(document: DocumentId): 'offered' | 'recorded' | 'outdated' {
    const reviewed = last?.submission.keys.find((entry) => entry.document === document)?.key;
    return bulkConsentReviewStatus(reviewed, readiness.plan, draft.intents, grants, document);
  } // End of function reviewStatus()

  /**
   * Applies a choice from one option's intent control.
   *
   * @param option - The option.
   * @param event - The `change` event of its `<select>`.
   */
  function onChoose(option: BulkOption, event: Event): void {
    const choice = (event.currentTarget as HTMLSelectElement).value as BulkIntentChoice;
    draft = chooseBulkIntent(draft, option, choice);
  } // End of function onChoose()

  /**
   * Records what one option's text box now holds.
   *
   * @param option - The option.
   * @param event - The `input` event of its box.
   */
  function onType(option: BulkOption, event: Event): void {
    draft = typeBulkIntentText(draft, option, (event.currentTarget as HTMLInputElement).value);
  } // End of function onType()

  /**
   * The relative path of one file, or `null` when the window no longer lists it.
   *
   * @param document - The file.
   * @returns Its path as the window lists it.
   */
  function fileName(document: DocumentId): string | null {
    return documents.find((held) => held.id === document)?.relative_path ?? null;
  } // End of function fileName()
</script>

<section class="bulk" aria-label={t('browser.bulkInspector.label')}>
  <div class="head">
    <h2>{t('browser.bulkInspector.label')}</h2>
    <button type="button" disabled={applying} onclick={() => stop()}>
      {t('browser.bulkInspector.stop')}
    </button>
  </div>

  <p class="kind">{t('browser.bulkInspector.selected', { count: selection.length })}</p>

  {#if unreadable > 0}
    <div class="panel">
      <p>{t('browser.bulkInspector.readFailed', { count: unreadable })}</p>
      <p class="choices">
        <button type="button" onclick={() => (reads = withoutFailedReads(reads))}>
          {t('browser.bulkInspector.readAgain')}
        </button>
      </p>
    </div>
  {/if}

  <h3>{t('browser.bulkInspector.optionsHeading')}</h3>
  <ul class="options">
    {#each controls as control (control.option)}
      {@const suggestions = bulkSuggestionsFor(control.option)}
      <li class="option" data-option={control.option}>
        <p class="name">
          <span>{tDetailField(bulkOptionField(control.option))}</span>
          <span class="source">{control.option}</span>
        </p>
        <div class="now">
          <span class="marker">{t('browser.bulkInspector.now')}</span>
          {#if control.summary.kind === 'same'}
            <SourceText text={control.summary.source} />
          {:else}
            <span class="summary" data-summary={control.summary.kind}>
              {tBulkOptionSummary(control.summary.kind)}
            </span>
          {/if}
        </div>
        {#if control.showsMixed}
          <p class="kind mixed">{t('browser.bulkInspector.mixedLeft')}</p>
        {/if}
        <p class="choices">
          <select
            aria-label={t('browser.bulkInspector.intentLabel', { option: control.option })}
            value={control.intent}
            disabled={applying}
            onchange={(event) => onChoose(control.option, event)}
          >
            <option value="untouched">{t('browser.bulkInspector.intent.untouched')}</option>
            <option value="set">{t('browser.bulkInspector.intent.set')}</option>
            <option value="remove">{t('browser.bulkInspector.intent.remove')}</option>
          </select>
          {#if control.intent === 'set'}
            <input
              type="text"
              class="source"
              aria-label={t('browser.bulkInspector.valueLabel', { option: control.option })}
              value={control.text ?? ''}
              disabled={applying}
              oninput={(event) => onType(control.option, event)}
            />
          {/if}
        </p>
        {#if suggestions.length > 0}
          <p class="choices suggestions">
            <span class="marker">{t('browser.bulkInspector.suggestions')}</span>
            {#each suggestions as suggestion (suggestion)}
              <button
                type="button"
                class="source"
                disabled={applying}
                onclick={() => (draft = setBulkIntent(draft, control.option, { Set: suggestion }))}
              >
                {suggestion}
              </button>
            {/each}
          </p>
        {/if}
      </li>
    {/each}
  </ul>

  <p class="choices">
    <button
      type="button"
      disabled={applying || !canUndoBulkDraft(draft)}
      onclick={() => (draft = undoBulkDraft(draft))}
    >
      {t('browser.bulkInspector.draftUndo')}
    </button>
    <button
      type="button"
      disabled={applying || !canRedoBulkDraft(draft)}
      onclick={() => (draft = redoBulkDraft(draft))}
    >
      {t('browser.bulkInspector.draftRedo')}
    </button>
  </p>
  <p class="kind">{t('browser.bulkInspector.draftOnly')}</p>

  {#if exclusions.length > 0}
    <h3>{t('browser.bulkInspector.exclusionsHeading')}</h3>
    <ul class="exclusions">
      {#each exclusions as row (matchKeyOf(row.match))}
        <li data-reason={row.reason}>
          <span class="source">
            {#if row.view === null}
              {t('browser.bulkInspector.unknownSnippet')}
            {:else}
              {@const named = triggerLabel(row.view)}
              {#if named.kind === 'text'}
                {named.text}
              {:else}
                {tTriggerKind(named.code)}
              {/if}
            {/if}
          </span>
          <span class="file">{row.file ?? t('browser.bulkInspector.unknownFile')}</span>
          <span class="reason">{tBulkExclusion(row.reason)}</span>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="panel apply">
    <p>{t('browser.bulkInspector.planFiles', { count: counts.files })}</p>
    <p>{t('browser.bulkInspector.planSnippets', { count: counts.snippets })}</p>
    {#if readiness.kind === 'blocked'}
      <ul class="blockers">
        {#each readiness.blockers as blocker (blocker)}
          <li data-blocker={blocker}>{tBulkBlocker(blocker)}</li>
        {/each}
      </ul>
    {/if}
    <p class="choices">
      <button
        type="button"
        class="primary"
        disabled={applying || readiness.kind !== 'ready'}
        onclick={() => void onApply()}
      >
        {t('browser.bulkInspector.apply')}
      </button>
      {#if applying}
        <span class="marker">{t('browser.bulkInspector.applying')}</span>
      {/if}
    </p>
    <p class="kind">{t('browser.bulkInspector.noDiskUndo')}</p>
  </div>

  {#if last !== null}
    {@const answer = last.answer}
    <div class="panel outcome" role="status">
      <h3>{t('browser.bulkInspector.outcomeHeading')}</h3>
      {#if answer.kind === 'answered'}
        {@const summary = summarizeBulkResult(answer.result, last.plan)}
        {@const lines = bulkOutcomeCounts(summary)}
        {@const review = bulkConsentReview(answer.result)}
        {@const narrowed = bulkNarrowingOffered(selection, answer.result, last.selection)}
        <p class="headline" data-headline={summary.headline}>
          {tBulkOutcomeHeadline(summary.headline)}
        </p>
        {#if lines.execution.length > 0}
          <p class="kind">{t('browser.bulkInspector.executionHeading')}</p>
          <ul class="execution">
            {#each lines.execution as line (line.name)}
              <li data-count={line.name}>{tBulkCount(line)}</li>
            {/each}
          </ul>
        {/if}
        {#if lines.exclusions.length > 0}
          <p class="kind">{t('browser.bulkInspector.exclusionCountsHeading')}</p>
          <ul class="excluded">
            {#each lines.exclusions as line (line.name)}
              <li data-count={line.name}>{tBulkCount(line)}</li>
            {/each}
          </ul>
        {/if}
        <ul class="files">
          {#each bulkFileLines(answer.result, answer.adoptions, documents) as line (line.report.document)}
            <li data-outcome={line.report.outcome}>
              <span class="file">{line.file ?? t('browser.bulkInspector.unknownFile')}</span>
              <span>{tBulkFileOutcome(line.report)}</span>
              {#if line.error !== null}
                <span class="kind">{tCommandError(line.error)}</span>
              {/if}
              {#if line.rereadFailure !== null}
                <span class="kind">{t('browser.bulkInspector.rereadFailed')}</span>
                <span class="kind">{tIpcFailure(line.rereadFailure)}</span>
              {/if}
            </li>
          {/each}
        </ul>

        {#if review.length > 0}
          <div class="consent">
            <h3>{t('browser.bulkInspector.consentHeading')}</h3>
            <p class="kind">{t('browser.bulkInspector.consentIntro')}</p>
            {#each review as item (item.document)}
              {@const standing = reviewStatus(item.document)}
              <div class="consentItem" data-document={item.document}>
                <p class="file">{fileName(item.document) ?? t('browser.bulkInspector.unknownFile')}</p>
                <p class="kind">{tSaveVerdict(item.verdict)}</p>
                {#if item.findings.length > 0}
                  <p class="kind">{t('browser.bulkInspector.consentFindings')}</p>
                  <ul>
                    {#each item.findings as finding, index (index)}
                      <li>{tFindingCode(finding.code)}</li>
                    {/each}
                  </ul>
                {/if}
                {#if !item.acknowledgeable}
                  <p class="kind">{t('browser.bulkInspector.consentNotPossible')}</p>
                {:else if standing === 'outdated'}
                  <p class="kind outdated">{t('browser.bulkInspector.consentOutdated')}</p>
                {:else if standing === 'recorded'}
                  <p class="kind consented">{t('browser.bulkInspector.consentHeld')}</p>
                {:else}
                  <p class="choices">
                    <button
                      type="button"
                      disabled={applying}
                      onclick={() => onConsent(item.document)}
                    >
                      {t('browser.bulkInspector.consentGive')}
                    </button>
                  </p>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        {#if narrowed !== null}
          <p class="choices">
            <button type="button" disabled={applying} onclick={() => replaceSelection(narrowed)}>
              {t('browser.bulkInspector.keepRemaining')}
            </button>
          </p>
        {/if}
      {:else if answer.kind === 'notAttempted'}
        <p>{t('browser.bulkInspector.notAttempted')}</p>
      {:else}
        <p>
          {answer.mayHaveWritten
            ? t('browser.bulkInspector.failedMayHaveWritten')
            : t('browser.bulkInspector.failedNothingWritten')}
        </p>
        <p class="kind">{tIpcFailure(answer.failure)}</p>
      {/if}
      <p class="choices">
        <button type="button" disabled={applying} onclick={() => (last = null)}>
          {t('browser.notice.dismiss')}
        </button>
      </p>
    </div>
  {/if}
</section>

<style>
  .bulk {
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

  h3 {
    margin: 0.375rem 0 0;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  p {
    margin: 0;
  }

  ul {
    margin: 0;
    padding-inline-start: 1rem;
  }

  .options {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .option {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  .name {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
    align-items: baseline;
  }

  .now {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
    align-items: baseline;
    min-width: 0;
  }

  .source {
    font-family: var(--font-mono);
    overflow-wrap: anywhere;
  }

  .marker,
  .kind,
  .file {
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .exclusions li,
  .files li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.125rem 0.5rem;
  }

  button,
  select,
  input {
    font: inherit;
    padding: 0.125rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: inherit;
  }

  input {
    min-width: 8rem;
  }

  button:disabled {
    color: var(--muted);
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.375rem;
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  .consent,
  .consentItem {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
</style>
