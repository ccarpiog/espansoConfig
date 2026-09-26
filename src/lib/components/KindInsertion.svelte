<script lang="ts">
  import type { MatchEditorSession, TextSelection } from '../browser/matchEditor';
  import { analysisOf, type HeldAnalysis, type VariableGroupPort } from '../browser/variableGroup';
  import { variableStructureGrantOf } from '../browser/variableEditor';
  import {
    editKindInsertion,
    insertKindRow,
    kindInsertionViewOf,
    type InsertRowKind,
    type KindEditRefusal,
    type KindInsertionDraft,
    type KindPart
  } from '../browser/variableKinds';
  import { nameContextOf, type InsertRefusal, type ReferenceField } from '../browser/variableInsertion';
  import { fieldLabelName } from '../browser/matchEditor';
  import {
    t,
    tDetailField,
    tInsertRefusal,
    tInsertRow,
    tKindEditRefusal,
    tKindPart,
    tKindPreview,
    tKindProblem,
    tKindWarning,
    tNameVerdict,
    tVariableAdditionRefusal,
    tVariableMoveRefusal
  } from '../i18n';
  import SourceText from './SourceText.svelte';

  /*
   * One `+ Insert` row's popover — Phase 4-15: Date/time, Random choice,
   * Clipboard, Shell command, Script or Another match, drawn inside the
   * *Variables and fill-ins* group (`VariableGroup.svelte`) the way the Choice
   * insertion is.
   *
   * **This file is presentation.** Every decision is
   * `../browser/variableKinds.ts`'s (`kindInsertionViewOf`, `editKindInsertion`,
   * `insertKindRow`), over Phase 4-9's `insertVariable`: *Insert* is one history
   * step and one save, and undo, conflict, reapply and recovery are the
   * existing ones — nothing here copies them.
   *
   * **The popover's value is the parent's** (`draft`, handed back through
   * `keep`), so it is retained while another row, a chip or a form is looked at;
   * only *Cancel* and a successful *Insert* drop it. Nothing in TypeScript forces
   * a parent to keep what `keep` hands it; `VariableGroup.svelte` does.
   *
   * **Nothing here runs a command or reads the clipboard**, and there is no
   * *Run test* and no clipboard-read control (ruling 26): a command and its
   * arguments are drawn as text through `SourceText`, and the preview line says
   * that no preview is available rather than inventing one.
   *
   * **A press mints its permission from a read taken at the press** (R37): the
   * grant and the name context *Insert* spends come from `port.structureRead`
   * called in the handler. Nothing in TypeScript forces that; the handler does.
   *
   * **Carriage returns** (`CLAUDE.md` §6): a popover opens blank (load); every
   * box's edit goes through `editKindInsertion`, which refuses a `\r` (and a line
   * feed in a one-line box) and this component puts the box back and says why
   * (edit); and *Insert* refuses one through `kindVariableOf`, `insertVariable`
   * and `beginSave` (send).
   */

  const {
    row,
    session,
    held,
    port,
    draft,
    keep,
    inserted,
    cancel,
    selectionOf
  }: {
    /** The row's kind. */
    row: InsertRowKind;
    /** The editor's session, as it stands now. */
    session: MatchEditorSession;
    /** The authoring snapshot the editor holds for its identity, or `null`. */
    held: HeldAnalysis | null;
    /** The window's side: the structure read. */
    port: VariableGroupPort;
    /** The popover's value, held by the parent. */
    draft: KindInsertionDraft;
    /**
     * Hands the parent the popover's new value to hold.
     *
     * @param next - The new value.
     */
    keep: (next: KindInsertionDraft) => void;
    /**
     * Hands the parent the session *Insert* answered; the parent installs it and
     * drops this row's value.
     *
     * @param next - The session with the reference and the variable drafted.
     */
    inserted: (next: MatchEditorSession) => void;
    /** *Cancel*: the parent drops this row's value and closes the popover. */
    cancel: () => void;
    /**
     * The selection of one content key's box, in UTF-16 code units — non-integers
     * when the box is not drawn, which the insertion reads as the text's end.
     *
     * @param field - The content key.
     * @returns Its selection.
     */
    selectionOf: (field: ReferenceField) => TextSelection;
  } = $props();

  /** The last edit the model refused, held with the value it was refused over. */
  let editRefused = $state.raw<{
    readonly draft: KindInsertionDraft;
    readonly part: KindPart | 'name';
    readonly reason: KindEditRefusal;
  } | null>(null);
  /** The last *Insert* the model refused, held with the session it was refused over. */
  let refused = $state.raw<{ readonly session: MatchEditorSession; readonly refusal: InsertRefusal } | null>(null);

  /** The window, read for this drawing. */
  const read = $derived(port.structureRead(session.match.document));
  /** The names the new variable is checked against, for the live verdict. */
  const context = $derived(nameContextOf(session, analysisOf(session, held).analysis, read.document));
  const said = $derived(kindInsertionViewOf(session, context, variableStructureGrantOf(session.match, read), draft));
  const editRefusal = $derived(editRefused !== null && editRefused.draft === draft ? editRefused : null);
  const refusal = $derived(refused !== null && refused.session === session ? refused.refusal : null);

  /**
   * Records one box. A refused edit leaves the value as it was, puts the box
   * back to its text and says why.
   *
   * @param part - `'name'` or the part.
   * @param box - The box that was typed into.
   */
  function edit(part: KindPart | 'name', box: HTMLInputElement | HTMLTextAreaElement): void {
    const current = draft;
    const answer = editKindInsertion(current, part, box.value);
    if ('reason' in answer) {
      editRefused = { draft: current, part, reason: answer.reason };
      box.value = part === 'name' ? current.form.name : current.form.parts[part];
      return;
    }
    editRefused = null;
    keep(answer.draft);
  } // End of function edit()

  /**
   * Chooses the content key the reference goes into.
   *
   * @param target - The content key.
   */
  function chooseTarget(target: ReferenceField): void {
    keep({ form: draft.form, target });
  } // End of function chooseTarget()

  /**
   * *Insert*: one history step. The grant and the names come from a read taken
   * now (R37); the value and its target are read once, so the selection taken is
   * the selection of the box the reference goes into.
   */
  function insertIt(): void {
    const current = draft;
    const value: KindInsertionDraft = { form: current.form, target: current.target };
    const now = port.structureRead(session.match.document);
    const grant = variableStructureGrantOf(session.match, now);
    const names = nameContextOf(session, analysisOf(session, held).analysis, now.document);
    const outcome = insertKindRow(session, grant, names, value, selectionOf(value.target));
    if (outcome.kind === 'inserted') {
      refused = null;
      inserted(outcome.session);
      return;
    }
    if (outcome.kind === 'refused') {
      refused = { session, refusal: outcome.refusal };
    }
  } // End of function insertIt()
</script>

<div class="panel insertForm" role="group" aria-label={tInsertRow(row)} data-row={row}>
  <p class="name">{tInsertRow(row)}</p>
  <label>
    <span class="name">{t('browser.variableGroup.name')}</span>
    <input
      class="text"
      type="text"
      spellcheck="false"
      value={draft.form.name}
      oninput={(event) => edit('name', event.currentTarget)}
    />
  </label>
  <p class="kind verdict" role="status">{tNameVerdict(said.verdict)}</p>
  <!-- The sentence that espanso may run the command, or reads the clipboard,
       when the snippet expands — and that this application never does. -->
  {#if said.executes}
    <p class="kind note">{t('browser.variableKinds.note.executes')}</p>
  {/if}
  {#if said.readsClipboard}
    <p class="kind note">{t('browser.variableKinds.note.readsClipboard')}</p>
  {/if}
  {#each said.parts as part (part.part)}
    <div class="field" data-part={part.part}>
      <label>
        <span class="name">{tKindPart(part.part)} <code class="source">{part.part}</code></span>
        {#if part.shape === 'oneLine'}
          <input
            class="text"
            type="text"
            spellcheck="false"
            value={part.text}
            oninput={(event) => edit(part.part, event.currentTarget)}
          />
        {:else}
          <textarea
            class="text"
            spellcheck="false"
            value={part.text}
            oninput={(event) => edit(part.part, event.currentTarget)}
          ></textarea>
        {/if}
      </label>
      <p class="kind">
        {part.required ? t('browser.variableKinds.required') : t('browser.variableKinds.optional')}
      </p>
      {#if part.plainSource}
        <p class="kind">{t('browser.variableKinds.plainSource')}</p>
      {/if}
      {#each part.warnings as warning (warning.code)}
        <p class="kind warning">{tKindWarning(warning)}</p>
      {/each}
    </div>
  {/each}
  {#if said.targets.length > 0}
    <p class="name">{t('browser.variableGroup.choice.target')}</p>
    <p class="choices targets">
      {#each said.targets as target (target)}
        <button type="button" aria-pressed={said.target === target} onclick={() => chooseTarget(target)}>
          {tDetailField(fieldLabelName(target))}
        </button>
      {/each}
    </p>
  {/if}
  <!-- **What will be written, as text** — the reference, and the command and
       each argument as its own value, never run. -->
  {#if said.reference !== null}
    <div class="written" data-written="reference">
      <p class="name">{t('browser.kindInsertion.reference')}</p>
      <SourceText text={said.reference} />
    </div>
  {/if}
  {#if said.written.length > 0}
    <p class="name">{t('browser.kindInsertion.written')}</p>
    {#each said.written as param (param.key)}
      <div class="written" data-written={param.key}>
        <code class="source">{param.key}</code>
        {#each param.texts as text, item (item)}
          {#if param.list}
            <span class="kind">{t('browser.kindInsertion.item', { number: item + 1 })}</span>
          {/if}
          <SourceText {text} />
        {/each}
      </div>
    {/each}
  {/if}
  <!-- **An honest preview state**: no preview is invented (ruling 26; the
       preview core is a later step). -->
  <p class="name">{t('browser.kindInsertion.preview.heading')}</p>
  <p class="kind preview">{tKindPreview(said.preview)}</p>
  {#if editRefusal !== null}
    <p class="kind" role="status">{tKindEditRefusal(editRefusal.reason, editRefusal.part)}</p>
  {/if}
  {#if said.problem !== null}
    <p class="kind problem">{tKindProblem(said.problem)}</p>
  {/if}
  {#if said.withheld !== null}
    <p class="kind">
      {said.withheld.kind === 'structure'
        ? tVariableMoveRefusal(said.withheld.reason)
        : said.withheld.kind === 'addition'
          ? tVariableAdditionRefusal(said.withheld.reason)
          : t('browser.variableGroup.notEditable')}
    </p>
  {/if}
  {#if refusal !== null}
    <p class="kind" role="status">{tInsertRefusal(refusal)}</p>
  {/if}
  <p class="kind">{t('browser.kindInsertion.kept')}</p>
  <p class="choices">
    <button type="button" disabled={!said.canInsert} onclick={() => insertIt()}>
      {t('browser.variableGroup.choice.insert')}
    </button>
    <button type="button" onclick={() => cancel()}>
      {t('browser.variableGroup.cancel')}
    </button>
  </p>
</div>

<style>
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

  .field,
  .written,
  label {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.375rem;
  }

  .name {
    color: var(--muted);
    font-size: 0.8125rem;
  }

  .kind {
    font-size: 0.8125rem;
    color: var(--muted);
  }

  /* A box's value, in the face that means "this is what the document holds". */
  .text {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.25rem 0.375rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-raised);
    color: inherit;
  }

  /* `white-space: pre` for `SourceText`'s reason: a soft wrap is indistinguishable
     from a line break the command does not contain. */
  textarea.text {
    white-space: pre;
    overflow: auto;
    min-height: 4rem;
    resize: vertical;
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
</style>
