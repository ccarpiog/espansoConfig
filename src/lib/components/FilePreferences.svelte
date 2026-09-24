<script lang="ts">
  import { untrack } from 'svelte';
  import type { BulkOption } from '../ipc/types';
  import type { PreferenceSaveReport } from '../browser/preferences';
  import { bulkOptionField, bulkSuggestionsFor } from '../browser/bulkEdit';
  import {
    defaultControlsOf,
    defaultsApplyTo,
    editDraftDefault,
    editDraftName,
    followPreferences,
    preferenceSaveLinesOf,
    preferenceTextControlOf,
    preferencesEditable,
    preferencesPlanOf,
    preferencesReadingLineOf,
    removeDraftDefault,
    startPreferencesDraft,
    type PreferencesDraft,
    type PreferencesTarget
  } from '../browser/preferencesControl';
  import type { BrowserState } from '../browser/workspace.svelte';
  import {
    t,
    tDefaultRefusal,
    tDetailField,
    tDisplayNameRefusal,
    tIpcFailure,
    tSidecarStatus,
    tSidecarUpdateOutcome,
    tWithdrawnPreferenceSave
  } from '../i18n';
  import SourceText from './SourceText.svelte';

  /*
   * The preferences control — Phase 3-13-2, ruling 28: one file's display name
   * and its seven new-snippet defaults, collapsed behind one button until asked
   * for. It sits in the list pane under the file-scope inspector, because both
   * are about the one file in scope.
   *
   * **This file is presentation.** What the draft is, what a save sends, which
   * control draws a value and what is said about a read or a save are all in
   * `../browser/preferencesControl.ts`; this walks its answers.
   *
   * **A save goes through `BrowserState.updatePreferences` and nothing else**, so
   * it joins the window's one serial queue of sidecar reads and updates (Phase
   * 3-13-1). It writes no espanso file. It never rejects; its report is drawn
   * through the sidecar's own reactive describers (`tSidecarUpdateOutcome`,
   * `tSidecarStatus`) and the IPC one. Nothing in TypeScript forces this component
   * to use that method rather than the command wrapper; the composition check in
   * `scripts/lint/composition-guards.ts` refuses a direct command import.
   *
   * **Every box is an `<input type="text">`, decided deliberately** (`CLAUDE.md`
   * §6): an `<input>` deletes a carriage return and a line feed, so a stored value
   * holding either is drawn read-only through `SourceText` and only its removal is
   * offered (`preferenceTextControlOf`), and a sentence beside the boxes says what
   * a pasted one becomes.
   *
   * **The last save said here is this control's own**, not the window's: the
   * report comes back from the call this control made, so opening the control for
   * another file does not show this file's result.
   */

  const { browser, document }: { browser: BrowserState; document: PreferencesTarget } = $props();

  /** Whether the control is expanded. */
  let expanded = $state(false);
  /** What the controls hold, or `null` while collapsed. */
  let draft = $state.raw<PreferencesDraft | null>(null);
  /** Whether a save this control made is out. */
  let saving = $state(false);
  /** How this control's last save ended, or `null`. */
  let report = $state.raw<PreferenceSaveReport | null>(null);

  const editable = $derived(
    preferencesEditable(browser.preferences, saving || browser.preferenceSave.kind === 'saving')
  );
  const readingLine = $derived(preferencesReadingLineOf(browser.preferences));
  const saveLines = $derived(
    preferenceSaveLinesOf(
      saving
        ? { kind: 'saving' }
        : report === null
          ? { kind: 'idle' }
          : { kind: 'ended', report }
    )
  );
  const plan = $derived(draft === null ? null : preferencesPlanOf(draft));
  const nameControl = $derived(draft === null ? 'box' : preferenceTextControlOf(draft.name));
  const controls = $derived(draft === null ? [] : defaultControlsOf(draft));

  /*
   * **A draft nobody changed follows the preferences** — `followPreferences`: a
   * control opened before the first read answered shows the file's values once
   * they arrive. The draft is read untracked, so writing it does not re-run this.
   */
  $effect(() => {
    const now = browser.preferences;
    untrack(() => {
      if (draft !== null) {
        draft = followPreferences(draft, now);
      }
    });
  });

  /** Expands the control over a fresh draft of the file's preferences. */
  function expand(): void {
    draft = startPreferencesDraft(browser.preferences, document.id);
    report = null;
    expanded = true;
  } // End of function expand()

  /** Collapses the control, dropping the draft. */
  function collapse(): void {
    expanded = false;
    draft = null;
  } // End of function collapse()

  /**
   * Records what the name box now holds.
   *
   * @param text - The box's whole value.
   */
  function onName(text: string): void {
    if (draft !== null) {
      draft = editDraftName(draft, text);
    }
  } // End of function onName()

  /**
   * Records one default's text — `''` included, an empty default.
   *
   * @param option - Which option.
   * @param text - Its text.
   */
  function onDefault(option: BulkOption, text: string): void {
    if (draft !== null) {
      draft = editDraftDefault(draft, option, text);
    }
  } // End of function onDefault()

  /**
   * Takes one default away, so a new snippet gets no such key.
   *
   * @param option - Which option.
   */
  function onRemove(option: BulkOption): void {
    if (draft !== null) {
      draft = removeDraftDefault(draft, option);
    }
  } // End of function onRemove()

  /**
   * Sends the draft's changes through the window's preference queue, and starts
   * a fresh draft from what the save installed when it saved or found nothing to
   * change. Any other ending keeps the draft, so nothing typed is lost.
   */
  async function save(): Promise<void> {
    if (draft === null || saving) {
      return;
    }
    const planned = preferencesPlanOf(draft);
    if (planned.kind !== 'ready') {
      return;
    }
    saving = true;
    const ended = await browser.updatePreferences(draft.document, planned.changes);
    saving = false;
    report = ended;
    if (draft !== null && (ended.kind === 'saved' || ended.kind === 'unchanged')) {
      draft = startPreferencesDraft(browser.preferences, draft.document);
    }
  } // End of function save()
</script>

<section class="preferences" aria-label={t('browser.filePreferences.label', { path: document.relative_path })}>
  <p class="choices">
    <button
      type="button"
      aria-expanded={expanded ? 'true' : 'false'}
      onclick={() => (expanded ? collapse() : expand())}
    >
      {expanded ? t('browser.filePreferences.close') : t('browser.filePreferences.open')}
    </button>
  </p>

  {#if expanded && draft !== null}
    <div class="panel">
      <h3>{t('browser.filePreferences.label', { path: document.relative_path })}</h3>
      <p class="kind">{t('browser.filePreferences.appOnly')}</p>

      {#if readingLine !== null}
        <p class="kind reading" role="status">
          {#if readingLine.kind === 'reading'}
            {t('browser.filePreferences.reading')}
          {:else if readingLine.kind === 'status'}
            {tSidecarStatus(readingLine.status)}
          {:else}
            {t('browser.filePreferences.readFailed')}
            {tIpcFailure(readingLine.failure)}
          {/if}
        </p>
      {/if}

      <div class="field">
        <label>
          <span class="name">{t('browser.filePreferences.displayName')}</span>
          {#if nameControl === 'shown'}
            <SourceText text={draft.name} />
          {:else}
            <input
              class="text"
              type="text"
              spellcheck="false"
              readonly={!editable}
              value={draft.name}
              oninput={(event) => onName(event.currentTarget.value)}
            />
          {/if}
        </label>
        {#if nameControl === 'shown'}
          <p class="kind">{t('browser.filePreferences.displayNameShown')}</p>
          <p class="choices">
            <button type="button" disabled={!editable} onclick={() => onName('')}>
              {t('browser.filePreferences.clearName')}
            </button>
          </p>
        {/if}
        <p class="kind">{t('browser.filePreferences.displayNameHint')}</p>
      </div>

      <h4>{t('browser.filePreferences.defaultsHeading')}</h4>
      {#if defaultsApplyTo(document)}
        <p class="kind">{t('browser.filePreferences.defaultsHint')}</p>
        <ul class="options">
          {#each controls as control (control.option)}
            {@const suggestions = bulkSuggestionsFor(control.option)}
            <li class="option" data-option={control.option}>
              <p class="optionName">
                <span>{tDetailField(control.label)}</span>
                <span class="source">{control.option}</span>
              </p>
              {#if control.control === 'absent'}
                <p class="kind">{t('browser.filePreferences.noDefault')}</p>
              {:else if control.control === 'box'}
                <input
                  class="text"
                  type="text"
                  spellcheck="false"
                  aria-label={t('browser.filePreferences.valueLabel', {
                    option: tDetailField(control.label)
                  })}
                  readonly={!editable}
                  value={control.value}
                  oninput={(event) => onDefault(control.option, event.currentTarget.value)}
                />
              {:else}
                <SourceText text={control.value ?? ''} />
                <p class="kind">{t('browser.filePreferences.shownDefault')}</p>
              {/if}
              {#if control.value === ''}
                <p class="kind">{t('browser.filePreferences.emptyDefault')}</p>
              {/if}
              <p class="choices">
                {#if control.value === null}
                  <button
                    type="button"
                    disabled={!editable}
                    onclick={() => onDefault(control.option, '')}
                  >
                    {t('browser.filePreferences.addDefault')}
                  </button>
                {:else}
                  <button
                    type="button"
                    class="remove"
                    disabled={!editable}
                    onclick={() => onRemove(control.option)}
                  >
                    {t('browser.filePreferences.removeDefault')}
                  </button>
                {/if}
              </p>
              {#if suggestions.length > 0}
                <p class="choices suggestions">
                  <span class="marker">{t('browser.filePreferences.suggestions')}</span>
                  {#each suggestions as suggestion (suggestion)}
                    <button
                      type="button"
                      class="source"
                      disabled={!editable}
                      onclick={() => onDefault(control.option, suggestion)}
                    >
                      {suggestion}
                    </button>
                  {/each}
                </p>
              {/if}
            </li>
          {/each}
        </ul>
      {:else}
        <p class="kind">{t('browser.filePreferences.defaultsNotApplicable')}</p>
      {/if}

      <p class="kind">{t('browser.filePreferences.lineEndings')}</p>

      <div class="actions">
        <p class="choices">
          <button
            type="button"
            class="save"
            disabled={!editable || plan === null || plan.kind !== 'ready'}
            onclick={() => void save()}
          >
            {t('browser.filePreferences.save')}
          </button>
        </p>
        {#if plan !== null && plan.kind === 'nameRefused'}
          <p class="kind">{tDisplayNameRefusal(plan.reason)}</p>
        {:else if plan !== null && plan.kind === 'defaultRefused'}
          <p class="kind">
            <span class="marker">{tDetailField(bulkOptionField(plan.option))}</span>
            {tDefaultRefusal(plan.reason)}
          </p>
        {/if}
        {#each saveLines as line, index (index)}
          <p class="kind outcome" role="status">
            {#if line.kind === 'saving'}
              {t('browser.filePreferences.saving')}
            {:else if line.kind === 'outcome'}
              {tSidecarUpdateOutcome(line.outcome)}
            {:else if line.kind === 'status'}
              {tSidecarStatus(line.status)}
            {:else if line.kind === 'failure'}
              {tIpcFailure(line.failure)}
            {:else}
              {tWithdrawnPreferenceSave()}
            {/if}
          </p>
        {/each}
      </div>
    </div>
  {/if}
</section>

<style>
  .preferences {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin: 0.25rem 0;
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-raised);
    font-size: 0.8125rem;
  }

  h3,
  h4 {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .field,
  label,
  .option {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .options {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .optionName {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.375rem;
    margin: 0;
  }

  .name {
    color: var(--muted);
  }

  .source {
    font-family: var(--font-mono);
  }

  /* A value stored as written, in the face that means "this is source text". */
  .text {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.25rem 0.375rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: inherit;
  }

  .text[readonly] {
    color: var(--muted);
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

  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .kind {
    margin: 0;
    color: var(--muted);
  }

  .marker {
    font-size: 0.6875rem;
    color: var(--muted);
  }
</style>
