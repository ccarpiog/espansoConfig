<script lang="ts">
  import {
    addFormValuesItems,
    discardAddedFormField,
    discardFormValuesItem,
    editFormLayout,
    editFormOption,
    editFormValuesItem,
    editFormValuesText,
    focusField,
    removeFormField,
    removeFormFields,
    removeFormOption,
    removeFormValuesItem,
    restoreFormField,
    restoreFormFields,
    restoreFormOption,
    restoreFormValuesItem,
    fieldLabelName,
    type MatchEditorSession,
    type TextSelection
  } from '../browser/matchEditor';
  import {
    addField,
    fieldAdditionViewOf,
    formBuilderViewOf,
    formInsertionDraftOf,
    formInsertionViewOf,
    formSelectionOfSeed,
    insertForm,
    INSERTED_FIELD_KINDS,
    NEW_FIELD_KINDS,
    NO_FORM_SELECTION,
    seededFormSelection,
    withInsertedField,
    type FieldDraft,
    type FormBuilderSelection,
    type FormInsertionDraft,
    type FormInsertionProblem,
    type FormRowKey,
    type InsertedFieldDraft,
    type InsertedFieldKind,
    type NewFieldKind,
    type SeededFormSelection
  } from '../browser/formBuilder';
  import type { FormAdditionRefusal, FormOptionKey, ValuesAdditionProblem } from '../browser/formEditor';
  import { analysisOf, type HeldAnalysis, type VariableGroupPort } from '../browser/variableGroup';
  import { variableStructureGrantOf } from '../browser/variableEditor';
  import { nameContextOf, type InsertRefusal, type ReferenceField } from '../browser/variableInsertion';
  import {
    t,
    tDetailField,
    tFormAdditionRefusal,
    tFormFieldRefusal,
    tFormInsertionProblem,
    tFormRowAdvisory,
    tFormRowStatus,
    tInsertRefusal,
    tLayoutMalformation,
    tNameVerdict,
    tNewFieldKind,
    tRemoveAllRefusal,
    tValueKind,
    tValuesProblem,
    tVariableAdditionRefusal,
    tVariableMoveRefusal
  } from '../i18n';
  import SourceText from './SourceText.svelte';

  /*
   * The visual form builder — Phase 4-12: every form of the snippet (the
   * shorthand `form` + `form_fields`, and each `type: form` variable), with the
   * synchronized layout display, the rows derived from it, the controls of the
   * one selected row (Choice and List first-class), the explicit field
   * operations, and the **Form** insertion.
   *
   * **This file is presentation.** What is drawn and offered is
   * `../browser/formBuilder.ts`'s, over the transitions of
   * `../browser/matchEditor.ts`; it holds no session — every result goes back
   * through `apply` to the editor's one session (ruling 24).
   *
   * **A shorthand layout has no box here**: it is the match editor's own `form`
   * box above (ruling 17, one draft of one scalar). The builder draws that text
   * as a display whose placeholders follow every keystroke, and nothing it draws
   * writes a definition because the layout changed (ruling 15).
   *
   * **Options are text boxes** (D2u): `multiline`, `default` and
   * `trim_string_values` are never checkboxes; a suggestion is an exact string put
   * into the box. An option this editor does not draft is drawn through
   * `SourceText` or by its shape's name, never hidden (ruling 19).
   *
   * **A press mints its grant and name context from a read taken at the press**
   * (R37); nothing in TypeScript forces that, and each handler below does it.
   */

  const {
    session,
    held,
    port,
    apply,
    selectionOf
  }: {
    /** The editor's session, as it stands now. */
    session: MatchEditorSession;
    /** The authoring snapshot the editor holds for its identity, or `null`. */
    held: HeldAnalysis | null;
    /** The window's side: the structure read. */
    port: VariableGroupPort;
    /**
     * Installs a transition's result as the editor's session.
     *
     * @param next - The session a transition answered.
     */
    apply: (next: MatchEditorSession) => void;
    /**
     * The selection of one content box of the editor (a reference target, or the
     * shorthand layout's `form` box), in UTF-16 code units — non-integers when it
     * is not drawn.
     *
     * @param field - The content key.
     * @returns Its selection.
     */
    selectionOf: (field: ReferenceField | 'form') => TextSelection;
  } = $props();

  /** The espanso key of a definition's values — file text, drawn as a key, not prose. */
  const VALUES_KEY = 'values';

  /** What is open, bound to the forms baseline it was chosen over. */
  let seeded = $state.raw<SeededFormSelection>(NO_FORM_SELECTION);
  const selection = $derived(formSelectionOfSeed(session, seeded));
  /** The open new-definition panel (*Add field*, or defining a placeholder), or `null`. */
  let fieldDraft = $state.raw<FieldDraft | null>(null);
  /** The new values typed for the selected definition's list. */
  let newValues = $state('');
  /** The **Form** insertion's panel, or `null`. */
  let insertion = $state.raw<FormInsertionDraft | null>(null);
  /** The last refusal a press met, held with the session it was refused over. */
  let refused = $state.raw<{
    readonly session: MatchEditorSession;
    readonly refusal:
      | { readonly kind: 'field'; readonly refusal: FormAdditionRefusal }
      | { readonly kind: 'values'; readonly problem: ValuesAdditionProblem | 'structure' }
      | { readonly kind: 'insert'; readonly refusal: InsertRefusal }
      | { readonly kind: 'insertProblem'; readonly problem: FormInsertionProblem };
  } | null>(null);
  /** The builder's own element, where a verbose layout box is looked for. */
  let root = $state<HTMLElement | null>(null);

  const read = $derived(port.structureRead(session.match.document));
  const grant = $derived(variableStructureGrantOf(session.match, read));
  const view = $derived(formBuilderViewOf(session, selection, grant));
  const context = $derived(nameContextOf(session, analysisOf(session, held).analysis, read.document));
  const insertionView = $derived(
    insertion === null || !view.insertOpen ? null : formInsertionViewOf(session, context, grant, insertion)
  );
  const lastRefusal = $derived(refused !== null && refused.session === session ? refused.refusal : null);
  const unnamed = $derived(t('browser.formBuilder.unnamed'));

  /**
   * Opens something, or closes it when it is already open.
   *
   * @param next - What to open.
   */
  function open(next: FormBuilderSelection): void {
    const same = JSON.stringify(next) === JSON.stringify(selection);
    seeded = seededFormSelection(session, same ? null : next);
    fieldDraft = null;
    newValues = '';
    insertion = null;
    refused = null;
  } // End of function open()

  /**
   * Selects one row; a placeholder with no definition opens its definition panel.
   *
   * @param form - The form's position.
   * @param row - The row's key.
   * @param name - The row's name.
   */
  function chooseRow(form: number, row: FormRowKey, name: string | null): void {
    open({ kind: 'row', form, row });
    if (row.startsWith('placeholder:') && selection !== null) {
      fieldDraft = { name: name ?? '', kind: 'text', values: '' };
    }
  } // End of function chooseRow()

  /**
   * Opens a form's *Add field* panel.
   *
   * @param form - The form's position.
   */
  function openAddField(form: number): void {
    open({ kind: 'addField', form });
    if (selection !== null) {
      fieldDraft = { name: '', kind: 'text', values: '' };
    }
  } // End of function openAddField()

  /** Opens the **Form** insertion with a provisional name. */
  function openInsertion(): void {
    open({ kind: 'insertForm' });
    if (selection !== null) {
      insertion = formInsertionDraftOf(session, context);
    }
  } // End of function openInsertion()

  /** Closes whatever is open. */
  function close(): void {
    seeded = NO_FORM_SELECTION;
    fieldDraft = null;
    newValues = '';
    insertion = null;
    refused = null;
  } // End of function close()

  /**
   * A structure grant minted from a read taken now (R37).
   *
   * @returns The grant.
   */
  function grantNow(): ReturnType<typeof variableStructureGrantOf> {
    return variableStructureGrantOf(session.match, port.structureRead(session.match.document));
  } // End of function grantNow()

  /** Ends the open typing run, as leaving any box of the editor does. */
  function blurred(): void {
    apply(focusField(session, null));
  } // End of function blurred()

  /**
   * The selection of one form's layout control.
   *
   * @param form - The form's position.
   * @param shorthand - Whether the layout is the `form` content box.
   * @returns Its selection.
   */
  function layoutSelection(form: number, shorthand: boolean): TextSelection {
    if (shorthand) {
      return selectionOf('form');
    }
    const box = root?.querySelector(`textarea[data-form-layout="${form}"]`);
    return box instanceof HTMLTextAreaElement
      ? { start: box.selectionStart, end: box.selectionEnd }
      : { start: Number.NaN, end: Number.NaN };
  } // End of function layoutSelection()

  /**
   * Records one part of the open definition panel.
   *
   * @param part - Which part.
   * @param value - Its whole new value.
   */
  function editFieldDraft(part: 'name' | 'kind' | 'values', value: string): void {
    if (fieldDraft !== null) {
      fieldDraft = part === 'kind' ? { ...fieldDraft, kind: value as NewFieldKind } : { ...fieldDraft, [part]: value };
    }
  } // End of function editFieldDraft()

  /**
   * *Add*: the compound addition — with the layout's selection for *Add field*,
   * alone for a placeholder the layout holds. One history step.
   *
   * @param form - The form's position.
   * @param shorthand - Whether the layout is the `form` content box.
   * @param withPlaceholder - Whether `[[name]]` goes into the layout too.
   */
  function addTheField(form: number, shorthand: boolean, withPlaceholder: boolean): void {
    if (fieldDraft === null) {
      return;
    }
    const outcome = addField(
      session,
      grantNow(),
      form,
      fieldDraft,
      withPlaceholder ? layoutSelection(form, shorthand) : null
    );
    if (outcome.kind === 'added') {
      apply(outcome.session);
      const position = (outcome.session.draft.value.forms.forms[form]?.added.length ?? 1) - 1;
      seeded = seededFormSelection(outcome.session, { kind: 'row', form, row: `added:${position}` });
      fieldDraft = null;
      refused = null;
      return;
    }
    if (outcome.kind === 'refused') {
      refused = { session, refusal: { kind: 'field', refusal: outcome.refusal } };
    }
  } // End of function addTheField()

  /**
   * *Add values*: new items at the end of the selected definition's list.
   *
   * @param form - The form's position.
   * @param definition - The definition's position.
   */
  function addValues(form: number, definition: number): void {
    const outcome = addFormValuesItems(session, grantNow(), form, definition, newValues);
    if (outcome.kind === 'added') {
      apply(outcome.session);
      newValues = '';
      refused = null;
      return;
    }
    refused = { session, refusal: { kind: 'values', problem: outcome.problem } };
  } // End of function addValues()

  /**
   * Records one part of the **Form** insertion's panel.
   *
   * @param part - Which part.
   * @param value - Its whole new value.
   */
  function editInsertion(part: 'name' | 'layout' | 'target', value: string): void {
    if (insertion !== null) {
      insertion =
        part === 'target' ? { ...insertion, target: value as ReferenceField } : { ...insertion, [part]: value };
    }
  } // End of function editInsertion()

  /**
   * Records one placeholder's choices in the **Form** insertion.
   *
   * @param field - The placeholder's current choices.
   * @param change - What changes.
   */
  function editInserted(
    field: InsertedFieldDraft,
    change: { readonly kind?: InsertedFieldKind; readonly values?: string; readonly referenced?: boolean }
  ): void {
    if (insertion !== null) {
      insertion = withInsertedField(insertion, { ...field, ...change });
    }
  } // End of function editInserted()

  /** *Insert*: the reference and the new form variable, one history step (R37 read now). */
  function insertTheForm(): void {
    if (insertion === null) {
      return;
    }
    const now = port.structureRead(session.match.document);
    const names = nameContextOf(session, analysisOf(session, held).analysis, now.document);
    const outcome = insertForm(
      session,
      variableStructureGrantOf(session.match, now),
      names,
      insertion,
      selectionOf(insertion.target)
    );
    if (outcome.kind === 'inserted') {
      apply(outcome.session);
      close();
      return;
    }
    refused =
      outcome.kind === 'problem'
        ? { session, refusal: { kind: 'insertProblem', problem: outcome.problem } }
        : { session, refusal: { kind: 'insert', refusal: outcome.refusal } };
  } // End of function insertTheForm()

  /**
   * Records whatever one option box holds.
   *
   * @param form - The form's position.
   * @param definition - The definition's position.
   * @param key - The option.
   * @param text - The box's whole value.
   */
  function typedOption(form: number, definition: number, key: FormOptionKey, text: string): void {
    apply(editFormOption(session, form, definition, key, text));
  } // End of function typedOption()
</script>

<!-- A definition's or a placeholder's name, or the sentence for one that could not be read. -->
{#snippet nameOf(name: string | null)}
  {#if name === null || name === ''}
    <span class="kind">{unnamed}</span>
  {:else}
    <code class="source">{name}</code>
  {/if}
{/snippet}

<!-- The Choice/List kind choices and the values box a choice or a list opens at once. -->
{#snippet kindChoices(draft: FieldDraft)}
  <p class="choices" role="group" aria-label={t('browser.formBuilder.kind.heading')}>
    {#each NEW_FIELD_KINDS as kind (kind)}
      <button type="button" aria-pressed={draft.kind === kind} onclick={() => editFieldDraft('kind', kind)}>
        {tNewFieldKind(kind)}
      </button>
    {/each}
  </p>
  {#if draft.kind !== 'text'}
    <label>
      <span class="name">{t('browser.formBuilder.values.lines')}</span>
      <textarea
        class="text"
        spellcheck="false"
        data-form-new-values=""
        value={draft.values}
        oninput={(event) => editFieldDraft('values', event.currentTarget.value)}
      ></textarea>
    </label>
  {/if}
{/snippet}

<div class="group forms" role="group" aria-label={t('browser.formBuilder.heading')} bind:this={root}>
  <h3>{t('browser.formBuilder.heading')}</h3>
  {#if view.forms.length === 0}
    <p class="kind">{t('browser.formBuilder.none')}</p>
  {/if}
  {#if view.structureRefusal !== null}
    <p class="kind">{tVariableMoveRefusal(view.structureRefusal)}</p>
  {/if}

  {#each view.forms as form (form.position)}
    {@const shorthand = form.shape === 'shorthand'}
    {@const heading = shorthand
      ? t('browser.formBuilder.shorthand')
      : t('browser.formBuilder.verbose', { name: form.variableName ?? unnamed })}
    <section class="form" aria-label={heading}>
      <p class="name">{heading}</p>

      <!-- **The layout.** A shorthand layout is the `form` box above; a verbose
           one is a box here, or shown through `SourceText` with its reason. -->
      {#if form.layout.kind === 'contentField'}
        <p class="kind">{t('browser.formBuilder.layout.contentField')}</p>
      {:else if form.layout.kind === 'box'}
        <label>
          <span class="name">{t('browser.formBuilder.layout.label')}</span>
          <textarea
            class="text"
            spellcheck="false"
            data-form-layout={form.position}
            readonly={!form.layout.editable}
            value={form.layout.text}
            oninput={(event) => apply(editFormLayout(session, form.position, event.currentTarget.value))}
            onblur={() => blurred()}
          ></textarea>
        </label>
      {:else}
        <p class="name">{t('browser.formBuilder.layout.label')}</p>
        {#if form.layout.text !== ''}
          <SourceText text={form.layout.text} />
        {/if}
        <p class="kind">{tFormFieldRefusal(form.layout.refusal)}</p>
      {/if}

      <!-- **The synchronized display**: the drafted layout, each supported
           placeholder marked, each region the subset does not read named. -->
      {#if form.pieces.length > 0 && !form.pieces.some((piece) => piece.text.includes('\r'))}
        <div class="layoutDisplay" role="group" aria-label={t('browser.formBuilder.layout.display')}>
          <pre class="source">{#each form.pieces as piece, index (index)}{#if piece.kind === 'placeholder'}<mark class="placeholder">{piece.text}</mark>{:else if piece.kind === 'malformed'}<span class="malformed">{piece.text}</span>{:else}{piece.text}{/if}{/each}</pre>
          {#each form.pieces as piece, index (index)}
            {#if piece.kind === 'malformed'}
              <p class="kind"><code class="source">{piece.text}</code> {tLayoutMalformation(piece.reason)}</p>
            {/if}
          {/each}
        </div>
      {/if}

      <!-- **The rows**, derived: one per placeholder name, then the
           definition-only rows with their advisory. -->
      {#if form.rows.length > 0}
        <ol class="formRows">
          {#each form.rows as row (row.key)}
            {@const status = tFormRowStatus(row.status)}
            <li class="formRow">
              <button
                type="button"
                class="rowButton"
                aria-pressed={row.selected}
                onclick={() => chooseRow(form.position, row.key, row.name)}
              >
                {@render nameOf(row.name)}
                {#if row.occurrences > 0}
                  <span class="marker">{t('browser.formBuilder.row.occurrences', { count: row.occurrences })}</span>
                {/if}
                {#if row.typeText !== ''}
                  <span class="marker">{row.typeText}</span>
                {/if}
                {#if status !== null}
                  <span class="marker">{status}</span>
                {/if}
              </button>
              {#if row.advisory !== null}
                <p class="kind">{tFormRowAdvisory(row.advisory)}</p>
              {/if}
            </li>
          {/each}
        </ol>
      {:else}
        <p class="kind">{t('browser.formBuilder.noRows')}</p>
      {/if}

      <!-- The form's own actions: *Add field* and the explicit container removal. -->
      <p class="choices">
        <button type="button" disabled={!form.editable} onclick={() => openAddField(form.position)}>
          {t('browser.formBuilder.addField.open')}
        </button>
        {#if form.removeAllDrafted}
          <button type="button" onclick={() => apply(restoreFormFields(session, form.position))}>
            {t('browser.formBuilder.removeAll.restore')}
          </button>
        {:else}
          <button
            type="button"
            disabled={form.removeAllRefusal !== null || view.structureRefusal !== null}
            onclick={() => apply(removeFormFields(session, grantNow(), form.position))}
          >
            {t('browser.formBuilder.removeAll.remove')}
          </button>
        {/if}
      </p>
      {#if form.removeAllDrafted}
        <p class="kind">{t('browser.formBuilder.removeAll.drafted')}</p>
      {:else if form.removeAllRefusal !== null && form.removeAllRefusal !== 'formNotEditable'}
        <p class="kind">{tRemoveAllRefusal(form.removeAllRefusal)}</p>
      {/if}

      <!-- **Add field**: the explicit compound addition — `[[name]]` at the
           layout's caret and the definition, one history step. -->
      {#if form.addFieldOpen && fieldDraft !== null}
        {@const draft = fieldDraft}
        {@const said = fieldAdditionViewOf(session, form.position, grant, draft)}
        <div class="panel controls" role="group" aria-label={t('browser.formBuilder.addField.heading')}>
          <p class="name">{t('browser.formBuilder.addField.heading')}</p>
          <label>
            <span class="name">{t('browser.formBuilder.addField.name')}</span>
            <input
              class="text"
              type="text"
              spellcheck="false"
              value={draft.name}
              oninput={(event) => editFieldDraft('name', event.currentTarget.value)}
            />
          </label>
          {@render kindChoices(draft)}
          <p class="kind">{t('browser.formBuilder.addField.hint')}</p>
          {#if said.problem !== null}
            <p class="kind">{tValuesProblem(said.problem)}</p>
          {/if}
          {#if said.refusal !== null && draft.name !== ''}
            <p class="kind">{tFormAdditionRefusal(said.refusal)}</p>
          {/if}
          {#if lastRefusal !== null && lastRefusal.kind === 'field'}
            <p class="kind" role="status">{tFormAdditionRefusal(lastRefusal.refusal)}</p>
          {/if}
          <p class="choices">
            <button type="button" disabled={!said.canAdd} onclick={() => addTheField(form.position, shorthand, true)}>
              {t('browser.formBuilder.addField.add')}
            </button>
            <button type="button" onclick={() => close()}>{t('browser.formBuilder.close')}</button>
          </p>
        </div>
      {/if}

      <!-- **The selected row's controls — the only boxes the rows mount.** -->
      {#if form.selected !== null && form.selected.kind === 'placeholder' && fieldDraft !== null}
        {@const chosen = form.selected}
        {@const draft = fieldDraft}
        {@const said = fieldAdditionViewOf(session, form.position, grant, draft)}
        <div class="panel controls" role="group" aria-label={t('browser.formBuilder.define.heading', { name: chosen.name })}>
          <p class="name">{t('browser.formBuilder.define.heading', { name: chosen.name })}</p>
          <p class="kind">{t('browser.formBuilder.define.hint')}</p>
          {@render kindChoices(draft)}
          {#if said.problem !== null}
            <p class="kind">{tValuesProblem(said.problem)}</p>
          {/if}
          {#if said.refusal !== null}
            <p class="kind">{tFormAdditionRefusal(said.refusal)}</p>
          {/if}
          {#if lastRefusal !== null && lastRefusal.kind === 'field'}
            <p class="kind" role="status">{tFormAdditionRefusal(lastRefusal.refusal)}</p>
          {/if}
          <p class="choices">
            <button type="button" disabled={!said.canAdd} onclick={() => addTheField(form.position, shorthand, false)}>
              {t('browser.formBuilder.define.add')}
            </button>
            <button type="button" onclick={() => close()}>{t('browser.formBuilder.close')}</button>
          </p>
        </div>
      {:else if form.selected !== null && form.selected.kind === 'added'}
        {@const chosen = form.selected}
        <div class="panel controls" role="group" aria-label={t('browser.formBuilder.selected', { name: chosen.name })}>
          <p class="name">{t('browser.formBuilder.selected', { name: chosen.name })}</p>
          <p class="rowHead">
            <code class="source">{chosen.name}</code>
            {#if chosen.typeText !== ''}
              <span class="marker">{chosen.typeText}</span>
            {/if}
            <span class="marker">{tFormRowStatus('added')}</span>
          </p>
          {#if chosen.values.length > 0}
            <p class="name">{t('browser.formBuilder.values.heading')}</p>
            {#each chosen.values as value, index (index)}
              <SourceText text={value} />
            {/each}
          {/if}
          {#if chosen.placeholderInserted}
            <p class="kind">{t('browser.formBuilder.added.placeholderInserted')}</p>
          {/if}
          <p class="choices">
            <button
              type="button"
              disabled={!form.editable}
              onclick={() => {
                apply(discardAddedFormField(session, form.position, chosen.position));
                close();
              }}
            >
              {t('browser.formBuilder.added.discard')}
            </button>
            <button type="button" onclick={() => close()}>{t('browser.formBuilder.close')}</button>
          </p>
        </div>
      {:else if form.selected !== null && form.selected.kind === 'existing'}
        {@const chosen = form.selected}
        <div
          class="panel controls"
          role="group"
          aria-label={t('browser.formBuilder.selected', { name: chosen.name ?? unnamed })}
        >
          <p class="name">{t('browser.formBuilder.selected', { name: chosen.name ?? unnamed })}</p>
          {#if chosen.removed}
            <p class="kind">{t('browser.formBuilder.field.removedNote')}</p>
          {/if}
          {#if chosen.optionsNotABlockMapping}
            <p class="kind">{t('browser.formBuilder.field.optionsNotABlockMapping')}</p>
          {/if}

          <!-- The four drafted options: text boxes, never checkboxes (D2u). -->
          {#each chosen.options as option (option.key)}
            <div class="formOption">
              <p class="name"><code class="source">{option.key}</code></p>
              {#if option.refusal !== null}
                {#if option.present && option.text !== ''}
                  <SourceText text={option.text} />
                {/if}
                <p class="kind">{tFormFieldRefusal(option.refusal)}</p>
              {:else if option.removed}
                <SourceText text={option.text} />
                <p class="kind">{t('browser.formBuilder.option.removed')}</p>
                <p class="choices">
                  <button
                    type="button"
                    onclick={() =>
                      option.option !== null &&
                      apply(restoreFormOption(session, form.position, chosen.index, option.option))}
                  >
                    {t('browser.formBuilder.option.restore')}
                  </button>
                </p>
              {:else}
                {#if option.oneLine}
                  <input
                    class="text"
                    type="text"
                    spellcheck="false"
                    aria-label={option.key}
                    data-form-option={option.key}
                    readonly={!option.editable}
                    value={option.text}
                    oninput={(event) => typedOption(form.position, chosen.index, option.key, event.currentTarget.value)}
                    onblur={() => blurred()}
                  />
                {:else}
                  <textarea
                    class="text"
                    spellcheck="false"
                    aria-label={option.key}
                    data-form-option={option.key}
                    readonly={!option.editable}
                    value={option.text}
                    oninput={(event) => typedOption(form.position, chosen.index, option.key, event.currentTarget.value)}
                    onblur={() => blurred()}
                  ></textarea>
                {/if}
                {#if !option.present}
                  <p class="kind">{t('browser.formBuilder.option.absent')}</p>
                {/if}
                {#if option.suggestions.length > 0}
                  <p class="choices suggestions">
                    <span class="marker">{t('browser.formBuilder.option.suggestions')}</span>
                    {#each option.suggestions as suggestion (suggestion)}
                      <button
                        type="button"
                        class="source"
                        disabled={!option.editable}
                        onclick={() => typedOption(form.position, chosen.index, option.key, suggestion)}
                      >
                        {suggestion}
                      </button>
                    {/each}
                  </p>
                {/if}
                {#if option.canRemove && option.option !== null}
                  {@const at = option.option}
                  <p class="choices">
                    <button
                      type="button"
                      onclick={() => apply(removeFormOption(session, grantNow(), form.position, chosen.index, at))}
                    >
                      {t('browser.formBuilder.option.remove')}
                    </button>
                  </p>
                {/if}
              {/if}
            </div>
          {/each}

          <!-- **values**, in the representation the file uses (ruling 18). -->
          {#if chosen.values.kind === 'list'}
            {@const values = chosen.values}
            <div class="formOption valuesList" role="group" aria-label={t('browser.formBuilder.values.heading')}>
              <p class="name"><code class="source">{VALUES_KEY}</code></p>
              {#if values.removed}
                <p class="kind">{t('browser.formBuilder.option.removed')}</p>
                <p class="choices">
                  <button
                    type="button"
                    onclick={() => apply(restoreFormOption(session, form.position, chosen.index, values.option))}
                  >
                    {t('browser.formBuilder.option.restore')}
                  </button>
                </p>
              {:else}
                {#if values.flow}
                  <p class="kind">{t('browser.formBuilder.values.flow')}</p>
                {/if}
                <ol class="valueItems">
                  {#each values.items as item, index (index)}
                    <li class="valueItem">
                      {#if item.removed}
                        <SourceText text={item.fileText} />
                        <span class="marker">{tFormRowStatus('removed')}</span>
                        <button
                          type="button"
                          onclick={() => apply(restoreFormValuesItem(session, form.position, chosen.index, index))}
                        >
                          {t('browser.formBuilder.values.restoreItem')}
                        </button>
                      {:else if item.refusal !== null}
                        <SourceText text={item.fileText} />
                        <p class="kind">{tFormFieldRefusal(item.refusal)}</p>
                      {:else}
                        <input
                          class="text"
                          type="text"
                          spellcheck="false"
                          data-form-value={index}
                          readonly={!item.editable}
                          value={item.text}
                          oninput={(event) =>
                            apply(editFormValuesItem(session, form.position, chosen.index, index, event.currentTarget.value))}
                          onblur={() => blurred()}
                        />
                        <button
                          type="button"
                          disabled={!item.canRemove}
                          onclick={() => apply(removeFormValuesItem(session, grantNow(), form.position, chosen.index, index))}
                        >
                          {t('browser.formBuilder.values.removeItem')}
                        </button>
                      {/if}
                    </li>
                  {/each}
                  {#each values.added as value, index (index)}
                    <li class="valueItem">
                      <SourceText text={value} />
                      <span class="marker">{tFormRowStatus('added')}</span>
                      <button
                        type="button"
                        onclick={() => apply(discardFormValuesItem(session, form.position, chosen.index, index))}
                      >
                        {t('browser.formBuilder.values.discardItem')}
                      </button>
                    </li>
                  {/each}
                </ol>
                {#if values.canAdd}
                  <label>
                    <span class="name">{t('browser.formBuilder.values.newLines')}</span>
                    <textarea
                      class="text"
                      spellcheck="false"
                      data-form-add-values=""
                      value={newValues}
                      oninput={(event) => (newValues = event.currentTarget.value)}
                    ></textarea>
                  </label>
                  <p class="choices">
                    <button type="button" onclick={() => addValues(form.position, chosen.index)}>
                      {t('browser.formBuilder.values.add')}
                    </button>
                    {#if values.canRemove}
                      <button
                        type="button"
                        onclick={() => apply(removeFormOption(session, grantNow(), form.position, chosen.index, values.option))}
                      >
                        {t('browser.formBuilder.option.remove')}
                      </button>
                    {/if}
                  </p>
                {/if}
                {#if lastRefusal !== null && lastRefusal.kind === 'values'}
                  <p class="kind" role="status">
                    {lastRefusal.problem === 'structure'
                      ? t('browser.formBuilder.values.structure')
                      : tValuesProblem(lastRefusal.problem)}
                  </p>
                {/if}
              {/if}
            </div>
          {:else if chosen.values.kind === 'text'}
            {@const values = chosen.values}
            <div class="formOption">
              <p class="name"><code class="source">{VALUES_KEY}</code></p>
              <p class="kind">{t('browser.formBuilder.values.text')}</p>
              {#if values.refusal !== null}
                <SourceText text={values.text} />
                <p class="kind">{tFormFieldRefusal(values.refusal)}</p>
              {:else if values.removed}
                <SourceText text={values.text} />
                <p class="kind">{t('browser.formBuilder.option.removed')}</p>
                <button
                  type="button"
                  onclick={() => apply(restoreFormOption(session, form.position, chosen.index, values.option))}
                >
                  {t('browser.formBuilder.option.restore')}
                </button>
              {:else}
                <textarea
                  class="text"
                  spellcheck="false"
                  data-form-values-text=""
                  readonly={!values.editable}
                  value={values.text}
                  oninput={(event) =>
                    apply(editFormValuesText(session, form.position, chosen.index, event.currentTarget.value))}
                  onblur={() => blurred()}
                ></textarea>
                {#if values.canRemove}
                  <p class="choices">
                    <button
                      type="button"
                      onclick={() => apply(removeFormOption(session, grantNow(), form.position, chosen.index, values.option))}
                    >
                      {t('browser.formBuilder.option.remove')}
                    </button>
                  </p>
                {/if}
              {/if}
            </div>
          {:else if chosen.values.kind === 'unsupported'}
            <div class="formOption">
              <p class="name"><code class="source">{VALUES_KEY}</code></p>
              <p class="kind">{t('browser.formBuilder.values.unsupported')}</p>
            </div>
          {/if}

          <!-- **Unknown source, always visible** (ruling 19): shown through
               `SourceText` or by its shape's name, and only removable. -->
          {#each chosen.others as other (other.option)}
            <div class="formOption otherOption">
              <p class="name">
                {#if other.key === null}
                  <span class="kind">{unnamed}</span>
                {:else}
                  <code class="source">{other.key}</code>
                {/if}
                <span class="marker">{t('browser.formBuilder.option.unknown')}</span>
              </p>
              {#each other.texts as text, index (index)}
                <SourceText {text} />
              {/each}
              {#if other.shape !== null}
                <p class="kind">{tValueKind(other.shape)}</p>
              {/if}
              {#if other.removed}
                <p class="kind">{t('browser.formBuilder.option.removed')}</p>
                <button
                  type="button"
                  onclick={() => apply(restoreFormOption(session, form.position, chosen.index, other.option))}
                >
                  {t('browser.formBuilder.option.restore')}
                </button>
              {:else if other.canRemove}
                <button
                  type="button"
                  onclick={() => apply(removeFormOption(session, grantNow(), form.position, chosen.index, other.option))}
                >
                  {t('browser.formBuilder.option.remove')}
                </button>
              {/if}
            </div>
          {/each}

          <!-- The definition's removal, with ruling 15's preview. -->
          {#if chosen.canRestore}
            <p class="choices">
              <button type="button" onclick={() => apply(restoreFormField(session, form.position, chosen.index))}>
                {t('browser.formBuilder.field.restore')}
              </button>
            </p>
          {:else if !chosen.removed}
            <p class="kind">{t('browser.formBuilder.field.removalPreview', { count: chosen.occurrencesKept })}</p>
            <p class="choices">
              <button
                type="button"
                disabled={!chosen.canRemove}
                onclick={() => apply(removeFormField(session, grantNow(), form.position, chosen.index))}
              >
                {t('browser.formBuilder.field.remove')}
              </button>
            </p>
          {/if}
          <p class="choices">
            <button type="button" onclick={() => close()}>{t('browser.formBuilder.close')}</button>
          </p>
        </div>
      {/if}
    </section>
  {/each}

  <!-- **The Form insertion** (ruling 20): a new `type: form` variable with its
       layout and the Choice and List definitions chosen, and the selected
       `{{name.field}}` references in a content key — one history step. -->
  <p class="choices">
    <button type="button" disabled={view.insertOpen} onclick={() => openInsertion()}>
      {t('browser.formBuilder.insert.open')}
    </button>
  </p>
  {#if insertion !== null && insertionView !== null}
    {@const panel = insertion}
    {@const said = insertionView}
    <div class="panel controls" role="group" aria-label={t('browser.formBuilder.insert.heading')}>
      <p class="name">{t('browser.formBuilder.insert.heading')}</p>
      <label>
        <span class="name">{t('browser.formBuilder.insert.name')}</span>
        <input
          class="text"
          type="text"
          spellcheck="false"
          value={panel.name}
          oninput={(event) => editInsertion('name', event.currentTarget.value)}
        />
      </label>
      <p class="kind verdict" role="status">{tNameVerdict(said.verdict)}</p>
      <label>
        <span class="name">{t('browser.formBuilder.layout.label')}</span>
        <textarea
          class="text"
          spellcheck="false"
          data-form-insert-layout=""
          value={panel.layout}
          oninput={(event) => editInsertion('layout', event.currentTarget.value)}
        ></textarea>
      </label>
      {#each said.fields as field (field.name)}
        <div class="formOption insertedField" role="group" aria-label={field.name}>
          <p class="name"><code class="source">{field.name}</code></p>
          <p class="choices">
            {#each INSERTED_FIELD_KINDS as kind (kind)}
              <button type="button" aria-pressed={field.kind === kind} onclick={() => editInserted(field, { kind })}>
                {tNewFieldKind(kind)}
              </button>
            {/each}
            <button
              type="button"
              aria-pressed={field.referenced}
              onclick={() => editInserted(field, { referenced: !field.referenced })}
            >
              {t('browser.formBuilder.insert.reference')}
            </button>
          </p>
          {#if field.kind !== 'none'}
            <label>
              <span class="name">{t('browser.formBuilder.values.lines')}</span>
              <textarea
                class="text"
                spellcheck="false"
                value={field.values}
                oninput={(event) => editInserted(field, { values: event.currentTarget.value })}
              ></textarea>
            </label>
          {/if}
        </div>
      {/each}
      {#if said.targets.length > 0}
        <p class="name">{t('browser.formBuilder.insert.target')}</p>
        <p class="choices">
          {#each said.targets as target (target)}
            <button type="button" aria-pressed={panel.target === target} onclick={() => editInsertion('target', target)}>
              {tDetailField(fieldLabelName(target))}
            </button>
          {/each}
        </p>
      {/if}
      {#if said.referenceText !== ''}
        <p class="name">{t('browser.formBuilder.insert.written')}</p>
        <SourceText text={said.referenceText} />
      {/if}
      {#if said.problem !== null}
        <p class="kind">{tFormInsertionProblem(said.problem)}</p>
      {/if}
      {#if said.withheld !== null}
        <p class="kind">
          {said.withheld.kind === 'structure'
            ? tVariableMoveRefusal(said.withheld.reason)
            : said.withheld.kind === 'addition'
              ? tVariableAdditionRefusal(said.withheld.reason)
              : t('browser.formBuilder.notEditable')}
        </p>
      {/if}
      {#if lastRefusal !== null && lastRefusal.kind === 'insert'}
        <p class="kind" role="status">{tInsertRefusal(lastRefusal.refusal)}</p>
      {:else if lastRefusal !== null && lastRefusal.kind === 'insertProblem'}
        <p class="kind" role="status">{tFormInsertionProblem(lastRefusal.problem)}</p>
      {/if}
      <p class="choices">
        <button type="button" disabled={!said.canInsert} onclick={() => insertTheForm()}>
          {t('browser.formBuilder.insert.insert')}
        </button>
        <button type="button" onclick={() => close()}>{t('browser.formBuilder.close')}</button>
      </p>
    </div>
  {/if}
</div>

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  h3 {
    margin: 0.375rem 0 0;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding-left: 0.5rem;
    border-left: 2px solid var(--border);
  }

  .form p,
  .panel p {
    margin: 0;
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.375rem;
    margin: 0;
  }

  /* The synchronized display: the layout's own line breaks, never a soft wrap
     that would read as one (`SourceText`'s reason). */
  .layoutDisplay pre {
    margin: 0;
    padding: 0.25rem 0.375rem;
    white-space: pre;
    overflow: auto;
    font-size: 0.8125rem;
    border: 1px dashed var(--border);
    border-radius: 6px;
  }

  .placeholder {
    background: var(--surface-raised);
    color: inherit;
    font-weight: 600;
  }

  .malformed {
    text-decoration: underline dotted;
  }

  .formRows,
  .valueItems {
    margin: 0;
    padding-left: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .rowButton {
    display: inline-flex;
    align-items: baseline;
    gap: 0.25rem;
  }

  .rowButton[aria-pressed='true'],
  button[aria-pressed='true'] {
    border-color: currentColor;
  }

  .rowHead {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.375rem;
  }

  .valueItem {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.375rem;
  }

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

  .formOption {
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
    margin: 0;
    color: var(--muted);
    font-size: 0.8125rem;
  }

  .text {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: 0.25rem 0.375rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-raised);
    color: inherit;
  }

  textarea.text {
    white-space: pre;
    overflow: auto;
    min-height: 4rem;
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

  .kind {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--muted);
  }

  .marker {
    font-size: 0.6875rem;
    color: var(--muted);
  }
</style>
