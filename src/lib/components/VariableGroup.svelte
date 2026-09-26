<script lang="ts">
  import {
    appendVariableListItems,
    discardAddedVariable,
    discardVariableListItem,
    editVariableField,
    editVariableListItem,
    editVariableParam,
    focusField,
    removeVariable,
    removeVariableListItem,
    removeVariables,
    restoreVariable,
    restoreVariableListItem,
    restoreVariables,
    type MatchEditorSession,
    type TextSelection
  } from '../browser/matchEditor';
  import type { ListAddress, ListItemsProblem, ListView } from '../browser/variableParams';
  import {
    analysisOf,
    choiceDraftOf,
    choiceInsertionViewOf,
    insertChoice,
    NO_SELECTION,
    sameSelection,
    seededSelection,
    selectionOfSeed,
    variableGroupViewOf,
    type ChoiceDraft,
    type GroupSelection,
    type HeldAnalysis,
    type SeededSelection,
    type VariableGroupPort
  } from '../browser/variableGroup';
  import { variableStructureGrantOf, type VariablesBaseline } from '../browser/variableEditor';
  import {
    addedParamsOf,
    addKindVariable,
    editKindDraft,
    kindAdditionViewOf,
    kindDraftOf,
    withKind,
    type KindDraft,
    type KindEditRefusal,
    type KindPart,
    type NewVariableKind
  } from '../browser/variableKinds';
  import {
    nameContextOf,
    type InsertRefusal,
    type ReferenceField
  } from '../browser/variableInsertion';
  import { fieldLabelName } from '../browser/matchEditor';
  import {
    t,
    tAnalysisState,
    tChoiceProblem,
    tDeclarationStatus,
    tDetailField,
    tEdgeKind,
    tIncompleteReason,
    tInsertRefusal,
    tKindEditRefusal,
    tKindPart,
    tKindProblem,
    tKindWarning,
    tListItemsProblem,
    tNewVariableKind,
    tParamRefusal,
    tMoveChoice,
    tNameVerdict,
    tRetainedLabel,
    tScalarStyle,
    tVariableAdditionRefusal,
    tVariableFieldRefusal,
    tVariableMoveRefusal
  } from '../i18n';
  import type { ListPlacement, VariableField } from '../ipc/types';
  import SourceText from './SourceText.svelte';

  /*
   * The *Variables and fill-ins* group — Phase 4-11: the chip strip, the ordered
   * list with each declaration's dependency state, the controls of the one
   * selection, and the two forms that add a variable (**Choice** insertion and
   * the *Add a variable* form, which since Phase 4-14-1 offers seven kinds —
   * `../browser/variableKinds.ts`), inside the match editor.
   *
   * **This file is presentation.** What is drawn, what is offered and what a
   * press may change is `../browser/variableGroup.ts`'s, over Phase 4-9's
   * transitions in `../browser/matchEditor.ts`; this is a walk over
   * `variableGroupViewOf`'s answer, and it holds no session of its own — every
   * transition's result goes back through `apply` to the editor's one session
   * (ruling 24: one buffer set, one history, one save, one conflict registry).
   *
   * **Editing controls are not mounted until selected** (override row 7 of
   * `docs/decisions/4-split-notes.md` §5). The chip strip and the list are always
   * drawn; a box exists only inside the selected declaration's block, and only
   * one declaration is selected at a time. A chip stays for a variable drafted for
   * removal, so every declaration stays reachable and its restoration is one
   * press away.
   *
   * **A press mints its permission from a read taken at the press** (R37): the
   * grant a removal spends and the name context an insertion checks against come
   * from `port.structureRead` called in the handler, never from the read the view
   * was drawn with. Nothing in TypeScript forces that; each handler below does it.
   *
   * **Names and values are file text**, drawn as text; a value the model shows
   * read-only goes through `SourceText`, which names a carriage return rather than
   * drawing it as a line break (`CLAUDE.md` §6). The one-line boxes are
   * `<input>`s, and the model refuses a carriage return or a line feed in each.
   * A box of the *Add a variable* form whose edit the model refuses is put back
   * to the form's text, and the refusal is said beside the form.
   *
   * **An existing variable's parameters, list items and `depends_on` items**
   * (Phase 4-14-2) are drawn inside its controls from `paramsViewOf` in
   * `../browser/variableParams.ts`: a typed setting (`offset`, `trim`, `debug`)
   * and every item in a one-line `<input>`, any other text in a `<textarea>`,
   * every refused edit put back to the draft's text with the sentence beside
   * the box. *Take out* and *Add these items* spend a grant minted from a read
   * taken at the press (R36, R37), as the variable's own removal does.
   */

  const {
    session,
    held,
    port,
    apply,
    move,
    selectionOf
  }: {
    /** The editor's session, as it stands now. */
    session: MatchEditorSession;
    /** The authoring snapshot the editor holds for its identity, or `null`. */
    held: HeldAnalysis | null;
    /** The window's side: the structure read (the snapshot and the reorder are the editor's). */
    port: VariableGroupPort;
    /**
     * Installs a transition's result as the editor's session. Required: the group
     * holds no session.
     *
     * @param next - The session a transition answered.
     */
    apply: (next: MatchEditorSession) => void;
    /**
     * Asks the editor to send one reorder — `MatchEditor.svelte`'s
     * `runVariableMove`, which decides it again over a fresh read.
     *
     * @param variable - The variable's position.
     * @param to - Where it goes.
     */
    move: (variable: number, to: ListPlacement) => void;
    /**
     * The selection of one content key's box, in UTF-16 code units — non-integers
     * when the box is not drawn, which the insertion reads as the text's end.
     *
     * @param field - The content key.
     * @returns Its selection.
     */
    selectionOf: (field: ReferenceField) => TextSelection;
  } = $props();

  /**
   * What is selected — whose controls are mounted — bound to the variables
   * baseline it was chosen over, so a re-seed that moved positions clears it
   * (the 4-11 review's second finding; `selectionOfSeed`).
   */
  let seeded = $state.raw<SeededSelection>(NO_SELECTION);
  /** The selection the seeded one still makes over the session now. */
  const selection = $derived(selectionOfSeed(session, seeded));

  /**
   * Selects something over the session's current baseline, or nothing.
   *
   * @param next - What to select.
   */
  function select(next: GroupSelection): void {
    seeded = seededSelection(session, next);
  } // End of function select()
  /** The **Choice** form's value while it is open, or `null`. */
  let choice = $state.raw<ChoiceDraft | null>(null);
  /** The *Add a variable* form's value while it is open, or `null`. */
  let adding = $state.raw<KindDraft | null>(null);
  /**
   * The last edit of the *Add a variable* form the model refused, with the box it
   * was typed into, held with the form value it was refused over.
   */
  let editRefused = $state.raw<{
    readonly draft: KindDraft;
    readonly part: KindPart | 'name';
    readonly reason: KindEditRefusal;
  } | null>(null);
  /**
   * The text of every open *New items* box, by the list's box key
   * ({@link listKey}), **bound to the variables baseline it was typed over** —
   * the 4-14-2 review's fix, `SeededSelection`'s rule: the keys are positions,
   * and a commit, a re-seed or a reapply replaces the baseline whole, after
   * which a position may name another variable. Read through {@link pending},
   * which answers nothing once the baseline is not the one typed over.
   * Component state: lost when the editor closes, like the forms' contents.
   */
  let pendingItems = $state.raw<{
    readonly seed: VariablesBaseline | null;
    readonly texts: Readonly<Record<string, string>>;
  }>({ seed: null, texts: {} });
  /** The pending texts that still belong to the session's baseline. */
  const pending = $derived(
    pendingItems.seed === session.baseline.variables ? pendingItems.texts : ({} as Readonly<Record<string, string>>)
  );

  /**
   * Records one *New items* box's text over the baseline it is typed over,
   * dropping every text typed over a replaced one.
   *
   * @param key - The list's box key.
   * @param text - The box's whole value.
   */
  function setPending(key: string, text: string): void {
    pendingItems = { seed: session.baseline.variables, texts: { ...pending, [key]: text } };
  } // End of function setPending()
  /**
   * The last *Add these items* the model refused, held with the session it was
   * refused over and the list it was about.
   */
  let itemsRefused = $state.raw<{
    readonly session: MatchEditorSession;
    readonly key: string;
    readonly problem: ListItemsProblem;
  } | null>(null);
  /**
   * The last box edit of an existing variable's parameters the model refused,
   * held with the session it was refused over and the box it was typed into.
   */
  let boxRefused = $state.raw<{ readonly session: MatchEditorSession; readonly box: string } | null>(null);
  /**
   * The last *Insert* the model refused, held with the session it was refused
   * over, so it stops drawing the moment anything changes.
   */
  let refused = $state.raw<{
    readonly session: MatchEditorSession;
    readonly refusal: InsertRefusal;
  } | null>(null);

  /** The window, read for this drawing (the view's refusals and offers). */
  const read = $derived(port.structureRead(session.match.document));
  const view = $derived(variableGroupViewOf(session, held, selection, read));
  /** The names a new variable is checked against, for the form's live verdict. */
  const context = $derived(nameContextOf(session, analysisOf(session, held).analysis, read.document));
  const choiceView = $derived(
    choice === null || view.selection?.kind !== 'choice'
      ? null
      : choiceInsertionViewOf(session, context, variableStructureGrantOf(session.match, read), choice)
  );
  const addingView = $derived(
    adding === null || view.selection?.kind !== 'add'
      ? null
      : kindAdditionViewOf(session, context, variableStructureGrantOf(session.match, read), adding)
  );
  /** The refused edit, while the form still holds the value it was refused over. */
  const editRefusal = $derived(editRefused !== null && editRefused.draft === adding ? editRefused : null);
  const refusal = $derived(refused !== null && refused.session === session ? refused.refusal : null);
  const unnamed = $derived(t('browser.variableGroup.unnamed'));

  /**
   * Selects one declaration, or hides its controls when it is already selected.
   *
   * @param chosen - What the chip selects.
   */
  function choose(chosen: Exclude<GroupSelection, null>): void {
    select(sameSelection(view.selection, chosen) ? null : chosen);
    choice = null;
    adding = null;
  } // End of function choose()

  /** Opens the **Choice** form with a provisional name the visible names do not refuse. */
  function openChoice(): void {
    select({ kind: 'choice' });
    choice = choiceDraftOf(session, context);
    adding = null;
  } // End of function openChoice()

  /**
   * Opens the *Add a variable* form on an `echo` variable (ruling 20) with a
   * provisional name, every part blank.
   */
  function openAdding(): void {
    select({ kind: 'add' });
    adding = kindDraftOf('echo', context);
    editRefused = null;
    choice = null;
  } // End of function openAdding()

  /** Closes whichever form or controls are open. */
  function closeSelection(): void {
    select(null);
    choice = null;
    adding = null;
  } // End of function closeSelection()

  /**
   * Chooses the *Add a variable* form's kind; every typed text is kept.
   *
   * @param kind - The kind chosen.
   */
  function chooseKind(kind: NewVariableKind): void {
    if (adding !== null) {
      adding = withKind(adding, kind, context);
    }
  } // End of function chooseKind()

  /**
   * Records one box of the *Add a variable* form. A refused edit leaves the form
   * as it was and puts the box back to the form's text.
   *
   * @param part - `'name'` or the part.
   * @param box - The box that was typed into.
   */
  function editAdding(part: KindPart | 'name', box: HTMLInputElement | HTMLTextAreaElement): void {
    if (adding === null) {
      return;
    }
    const edit = editKindDraft(adding, part, box.value);
    if (edit.kind === 'refused') {
      editRefused = { draft: adding, part, reason: edit.reason };
      box.value = part === 'name' ? adding.name : adding.parts[part];
      return;
    }
    adding = edit.draft;
    editRefused = null;
  } // End of function editAdding()

  /** *Add*: one history step; the grant and the names come from a read taken now (R37). */
  function addTheVariable(): void {
    if (adding === null) {
      return;
    }
    const now = port.structureRead(session.match.document);
    const grant = variableStructureGrantOf(session.match, now);
    const names = nameContextOf(session, analysisOf(session, held).analysis, now.document);
    const outcome = addKindVariable(session, grant, names, adding);
    if (outcome.kind === 'inserted') {
      apply(outcome.session);
      refused = null;
      adding = null;
      select({ kind: 'added', position: outcome.session.draft.value.variables.added.length - 1 });
      return;
    }
    if (outcome.kind === 'refused') {
      refused = { session, refusal: outcome.refusal };
    }
  } // End of function addTheVariable()

  /**
   * Records one part of the **Choice** form.
   *
   * @param part - Which part.
   * @param value - Its whole new value.
   */
  function editChoice(part: 'name' | 'values' | 'target', value: string): void {
    if (choice === null) {
      return;
    }
    choice = part === 'target' ? { ...choice, target: value as ReferenceField } : { ...choice, [part]: value };
  } // End of function editChoice()

  /**
   * *Insert*: the compound action, one history step. The grant and the names
   * come from a read taken now (R37).
   */
  function insertTheChoice(): void {
    if (choice === null) {
      return;
    }
    const now = port.structureRead(session.match.document);
    const grant = variableStructureGrantOf(session.match, now);
    const names = nameContextOf(session, analysisOf(session, held).analysis, now.document);
    const outcome = insertChoice(session, grant, names, choice, selectionOf(choice.target));
    if (outcome.kind === 'inserted') {
      apply(outcome.session);
      refused = null;
      choice = null;
      select({ kind: 'added', position: outcome.session.draft.value.variables.added.length - 1 });
      return;
    }
    if (outcome.kind === 'refused') {
      refused = { session, refusal: outcome.refusal };
    }
  } // End of function insertTheChoice()

  /**
   * Records whatever one scalar box of an existing variable now holds.
   *
   * @param index - The variable's position.
   * @param field - Which scalar.
   * @param text - The box's whole value.
   */
  function typed(index: number, field: VariableField, text: string): void {
    apply(editVariableField(session, index, field, text));
  } // End of function typed()

  /**
   * The key one list's boxes are known by in this component.
   *
   * @param index - The variable's position.
   * @param address - Which list.
   * @returns The key.
   */
  function listKey(index: number, address: ListAddress): string {
    return address.kind === 'dependsOn' ? `${index}:depends_on` : `${index}:params#${address.position}`;
  } // End of function listKey()

  /**
   * Whether the refused box edit is about one box and still current.
   *
   * @param box - The box's key.
   * @returns `true` when its sentence is drawn.
   */
  function refusedHere(box: string): boolean {
    return boxRefused !== null && boxRefused.session === session && boxRefused.box === box;
  } // End of function refusedHere()

  /**
   * Installs an edit of an existing variable's parameter or item box; a refused
   * one puts the box back to what the draft holds and says why beside it.
   *
   * @param next - The session the transition answered.
   * @param box - The element typed into.
   * @param held - What the draft holds for that box.
   * @param key - The box's key.
   */
  function boxEdited(next: MatchEditorSession, box: HTMLInputElement | HTMLTextAreaElement, held: string, key: string): void {
    if (next === session) {
      if (box.value !== held) {
        box.value = held;
        boxRefused = { session, box: key };
      }
      return;
    }
    boxRefused = null;
    apply(next);
  } // End of function boxEdited()

  /**
   * Records whatever one `params` box of an existing variable now holds.
   *
   * @param index - The variable's position.
   * @param position - The entry's position among the drafted entries.
   * @param held - What the draft holds for it.
   * @param box - The box.
   */
  function typedParam(index: number, position: number, held: string, box: HTMLInputElement | HTMLTextAreaElement): void {
    boxEdited(editVariableParam(session, index, position, box.value), box, held, `${index}:param#${position}`);
  } // End of function typedParam()

  /**
   * Records whatever one list item box of an existing variable now holds.
   *
   * @param index - The variable's position.
   * @param address - Which list.
   * @param item - The item's position.
   * @param held - What the draft holds for it.
   * @param box - The box.
   */
  function typedItem(index: number, address: ListAddress, item: number, held: string, box: HTMLInputElement): void {
    const key = `${listKey(index, address)}#${item}`;
    boxEdited(editVariableListItem(session, index, address, item, box.value), box, held, key);
  } // End of function typedItem()

  /**
   * *Take out* one item: spends a grant minted from a read taken now.
   *
   * @param index - The variable's position.
   * @param address - Which list.
   * @param item - The item's position.
   */
  function removeItem(index: number, address: ListAddress, item: number): void {
    const grant = variableStructureGrantOf(session.match, port.structureRead(session.match.document));
    apply(removeVariableListItem(session, grant, index, address, item));
  } // End of function removeItem()

  /**
   * *Add these items*: spends a grant minted from a read taken now; the box is
   * emptied once they are added.
   *
   * @param index - The variable's position.
   * @param address - Which list.
   */
  function appendItems(index: number, address: ListAddress): void {
    const key = listKey(index, address);
    const grant = variableStructureGrantOf(session.match, port.structureRead(session.match.document));
    const outcome = appendVariableListItems(session, grant, index, address, pending[key] ?? '');
    if (outcome.kind === 'refused') {
      itemsRefused = { session, key, problem: outcome.problem };
      return;
    }
    itemsRefused = null;
    setPending(key, '');
    apply(outcome.session);
  } // End of function appendItems()

  /** Ends the open typing run, as leaving any box of the editor does. */
  function blurred(): void {
    apply(focusField(session, null));
  } // End of function blurred()

  /**
   * *Take this variable out*: spends a grant minted from a read taken now.
   *
   * @param index - The variable's position.
   */
  function removeOne(index: number): void {
    const grant = variableStructureGrantOf(session.match, port.structureRead(session.match.document));
    apply(removeVariable(session, grant, index));
  } // End of function removeOne()

  /** *Take out all the variables*: spends a grant minted from a read taken now. */
  function removeAll(): void {
    const grant = variableStructureGrantOf(session.match, port.structureRead(session.match.document));
    apply(removeVariables(session, grant));
  } // End of function removeAll()

  /**
   * *Drop this new variable*, and hides its controls.
   *
   * @param position - Its position among the additions.
   */
  function discard(position: number): void {
    apply(discardAddedVariable(session, position));
    select(null);
  } // End of function discard()
</script>

<!-- One declaration's name, or the sentence for a declaration with none. -->
{#snippet nameOf(name: string)}
  {#if name === ''}
    <span class="kind">{unnamed}</span>
  {:else}
    <code class="source">{name}</code>
  {/if}
{/snippet}

<!-- One list of an existing variable (Phase 4-14-2): one one-line box per item,
     its removal and restoration, the drafted new items, and *Add these items*.
     A value the model does not edit is drawn through `SourceText` with why. -->
{#snippet listControls(index: number, key: string, list: ListView)}
  {@const boxKey = listKey(index, list.address)}
  <div class="itemList" data-list={key}>
    {#if list.flow}
      <p class="kind">{t('browser.variableParams.flow')}</p>
    {/if}
    {#if !list.changeable}
      <p class="kind">{t('browser.variableParams.fixed')}</p>
    {/if}
    {#each list.items as item (item.item)}
      <div class="listItem">
        {#if item.refusal !== null}
          {#if item.text !== ''}
            <SourceText text={item.text} />
          {/if}
          <p class="kind">{tParamRefusal(item.refusal)}</p>
        {:else}
          <input
            class="text"
            type="text"
            spellcheck="false"
            aria-label={t('browser.variableParams.item', { number: item.item + 1, key })}
            readonly={!item.editable}
            value={item.text}
            oninput={(event) => typedItem(index, list.address, item.item, item.text, event.currentTarget)}
            onblur={() => blurred()}
          />
          {#if refusedHere(`${boxKey}#${item.item}`)}
            <p class="kind" role="status">{t('browser.variableParams.editRefused')}</p>
          {/if}
        {/if}
        {#if item.style !== null}
          <p class="kind">{tScalarStyle(item.style)}</p>
        {/if}
        {#if item.removed}
          <p class="kind">{t('browser.variableParams.removedItem')}</p>
        {/if}
        {#if item.canRestore}
          <button type="button" onclick={() => apply(restoreVariableListItem(session, index, list.address, item.item))}>
            {t('browser.variableParams.restoreItem')}
          </button>
        {:else if list.changeable && !item.removed}
          <button type="button" disabled={!item.canRemove} onclick={() => removeItem(index, list.address, item.item)}>
            {t('browser.variableParams.removeItem')}
          </button>
        {/if}
      </div>
    {/each}
    {#each list.added as added, at (at)}
      <div class="listItem">
        <SourceText text={added} />
        <p class="kind">{t('browser.variableParams.newItem')}</p>
        <button type="button" onclick={() => apply(discardVariableListItem(session, index, list.address, at))}>
          {t('browser.variableParams.discardItem')}
        </button>
      </div>
    {/each}
    {#if list.lastItemKept}
      <p class="kind">{t('browser.variableParams.lastItem')}</p>
    {/if}
    {#if list.changeable}
      <label>
        <span class="name">{t('browser.variableParams.newItems', { key })}</span>
        <textarea
          class="text"
          spellcheck="false"
          data-new-items={key}
          readonly={!list.canAdd}
          value={pending[boxKey] ?? ''}
          oninput={(event) => setPending(boxKey, event.currentTarget.value)}
        ></textarea>
      </label>
      <p class="choices">
        <button type="button" disabled={!list.canAdd} onclick={() => appendItems(index, list.address)}>
          {t('browser.variableParams.addItems')}
        </button>
      </p>
      {#if itemsRefused !== null && itemsRefused.session === session && itemsRefused.key === boxKey}
        <p class="kind" role="status">{tListItemsProblem(itemsRefused.problem)}</p>
      {/if}
    {/if}
  </div>
{/snippet}

<div class="group variables" role="group" aria-label={t('browser.variableGroup.heading')}>
  <h3>{t('browser.variableGroup.heading')}</h3>

  <!-- **The chip strip: always drawn**, one chip per declaration in authored
       order, then the draft's new ones. Keyed by the model's key, never by name:
       two variables may share a name, and a duplicate key throws in production
       (B1, `docs/decisions/4-2-notes.md`). `aria-pressed` says which one's
       controls are mounted. -->
  {#if view.chips.length > 0}
    <p class="choices chips" role="group" aria-label={t('browser.variableGroup.chips')}>
      {#each view.chips as chip (chip.key)}
        {@const status = tDeclarationStatus(chip.status)}
        <button
          type="button"
          class="chip"
          aria-pressed={chip.selected}
          onclick={() => choose(chip.selection)}
        >
          {@render nameOf(chip.name)}
          {#if chip.typeText !== ''}
            <span class="marker">{chip.typeText}</span>
          {/if}
          {#if status !== null}
            <span class="marker">{status}</span>
          {/if}
        </button>
      {/each}
    </p>
    {#if view.selection === null}
      <p class="kind">{t('browser.variableGroup.selectHint')}</p>
    {/if}
  {:else}
    <p class="kind">{t('browser.variableGroup.none')}</p>
  {/if}

  {#if view.containerRemoved}
    <p class="kind">{t('browser.variableGroup.containerRemoved')}</p>
  {/if}

  <!-- **The ordered list, with the Rust analysis's dependency state.** The
       sentence above it says what the analysis describes — the file as last
       read — or why none is shown; the reasons it is incomplete follow it. -->
  <p class="kind">{tAnalysisState(view.analysis.state)}</p>
  {#if view.analysis.incomplete.length > 0}
    <p class="kind">{t('browser.variableGroup.analysis.incomplete')}</p>
    <ul class="incomplete">
      {#each view.analysis.incomplete as reason, index (index)}
        <li>{tIncompleteReason(reason)}</li>
      {/each}
    </ul>
  {/if}
  {#if view.rows.length > 0 || view.added.length > 0}
    <ol class="variableList">
      {#each view.rows as row (row.index)}
        {@const status = tDeclarationStatus(row.status)}
        <li class="variableRow">
          <p class="rowHead">
            {@render nameOf(row.name)}
            {#if row.typeText !== ''}
              <span class="marker">{row.typeText}</span>
            {/if}
            {#if status !== null}
              <span class="marker">{status}</span>
            {/if}
          </p>
          {#if row.dependency !== null}
            {@const state = row.dependency}
            <p class="kind">
              {t('browser.variableGroup.row.usage', {
                body: state.usage.body,
                parameters: state.usage.parameters,
                dependsOn: state.usage.depends_on,
                layout: state.usage.unverified_layout
              })}
            </p>
            {#if state.noVisibleReference}
              <p class="kind">{t('browser.variableGroup.row.noVisibleReference')}</p>
            {/if}
            {#each state.dependsOn as link, index (index)}
              <p class="kind">
                {t('browser.variableGroup.row.dependsOn', {
                  name: link.name ?? unnamed,
                  kind: tEdgeKind(link.kind)
                })}
              </p>
            {/each}
            {#each state.usedBy as link, index (index)}
              <p class="kind">
                {t('browser.variableGroup.row.usedBy', {
                  name: link.name ?? unnamed,
                  kind: tEdgeKind(link.kind)
                })}
              </p>
            {/each}
            {#if state.inCycle}
              <p class="kind">{t('browser.variableGroup.row.cycle')}</p>
            {/if}
            {#if state.missingDependencies > 0}
              <p class="kind">
                {t('browser.variableGroup.row.missingDependencies', { count: state.missingDependencies })}
              </p>
            {/if}
            {#each state.writtenBefore as name, index (index)}
              <p class="kind">{t('browser.variableGroup.row.writtenBefore', { name: name ?? unnamed })}</p>
            {/each}
            {#each state.incomplete as reason, index (index)}
              <p class="kind">{tIncompleteReason(reason)}</p>
            {/each}
          {/if}
        </li>
      {/each}
      {#each view.added as row (row.position)}
        <li class="variableRow">
          <p class="rowHead">
            {@render nameOf(row.name)}
            <span class="marker">{row.typeText}</span>
            <span class="marker">{tDeclarationStatus('added')}</span>
          </p>
          <p class="kind">{t('browser.variableGroup.row.new')}</p>
        </li>
      {/each}
    </ol>
  {/if}

  <!-- The group's own actions. A structural action is withheld with its reason
       (R36), and the addition's own refusal is said beside the control. -->
  <p class="choices">
    <button
      type="button"
      disabled={view.selection?.kind === 'choice'}
      onclick={() => openChoice()}
    >
      {t('browser.variableGroup.choice.open')}
    </button>
    <button type="button" disabled={view.selection?.kind === 'add'} onclick={() => openAdding()}>
      {t('browser.variableGroup.addVariable.open')}
    </button>
    {#if view.canRestoreAll}
      <button type="button" onclick={() => apply(restoreVariables(session))}>
        {t('browser.variableGroup.restoreAll')}
      </button>
    {:else if view.shape !== 'absent'}
      <button type="button" disabled={!view.canRemoveAll} onclick={() => removeAll()}>
        {t('browser.variableGroup.removeAll')}
      </button>
    {/if}
  </p>
  {#if view.structureRefusal !== null}
    <p class="kind">{tVariableMoveRefusal(view.structureRefusal)}</p>
  {:else if view.additionRefusal !== null}
    <p class="kind">{tVariableAdditionRefusal(view.additionRefusal)}</p>
  {/if}

  <!-- **The selected declaration's controls — the only boxes this group mounts.** -->
  {#if view.selected !== null && view.selected.kind === 'variable'}
    {@const selected = view.selected}
    <div class="panel controls" role="group" aria-label={t('browser.variableGroup.selected', { name: selected.name === '' ? unnamed : selected.name })}>
      <p class="name">{t('browser.variableGroup.selected', { name: selected.name === '' ? unnamed : selected.name })}</p>
      {#each selected.fields as field (field.field)}
        <div class="variableField">
          {#if field.refusal !== null}
            <p class="name">{tRetainedLabel(field.label)}</p>
            {#if field.text !== ''}
              <SourceText text={field.text} />
            {/if}
            <p class="kind">{tVariableFieldRefusal(field.refusal)}</p>
          {:else}
            <label>
              <span class="name">{tRetainedLabel(field.label)}</span>
              <input
                class="text"
                type="text"
                spellcheck="false"
                readonly={!field.editable}
                value={field.text}
                oninput={(event) => typed(selected.index, field.field, event.currentTarget.value)}
                onblur={() => blurred()}
              />
            </label>
          {/if}
          <!-- D2u: the file's spelling, said beside the box that holds its text. -->
          {#if field.style !== null}
            <p class="kind">{tScalarStyle(field.style)}</p>
            {#if field.refusal === null && (field.style === 'SingleQuoted' || field.style === 'DoubleQuoted')}
              <p class="kind">{t('browser.variableGroup.quotedText')}</p>
            {/if}
          {/if}
          {#if field.editWritesPlain}
            <p class="kind">{t('browser.variableGroup.editWritesPlain')}</p>
          {/if}
        </div>
      {/each}
      <!-- Phase 4-14-2: the parameters, list items and depends_on items. -->
      {#if selected.boxes.params.length > 0}
        <p class="name">{tRetainedLabel('params')}</p>
        {#each selected.boxes.params as param (param.position)}
          {@const boxKey = `${selected.index}:param#${param.position}`}
          <div class="variableField" data-param={param.key}>
            <p class="rowHead"><code class="source">{param.key}</code></p>
            {#if param.text !== null}
              {@const text = param.text}
              {#if text.refusal !== null}
                {#if text.text !== ''}
                  <SourceText text={text.text} />
                {/if}
                <p class="kind">{tParamRefusal(text.refusal)}</p>
              {:else if text.oneLine}
                <input
                  class="text"
                  type="text"
                  spellcheck="false"
                  aria-label={t('browser.variableParams.value', { key: param.key })}
                  readonly={!text.editable}
                  value={text.text}
                  oninput={(event) => typedParam(selected.index, param.position, text.text, event.currentTarget)}
                  onblur={() => blurred()}
                />
              {:else}
                <textarea
                  class="text"
                  spellcheck="false"
                  aria-label={t('browser.variableParams.value', { key: param.key })}
                  readonly={!text.editable}
                  value={text.text}
                  oninput={(event) => typedParam(selected.index, param.position, text.text, event.currentTarget)}
                  onblur={() => blurred()}
                ></textarea>
              {/if}
              {#if refusedHere(boxKey)}
                <p class="kind" role="status">{t('browser.variableParams.editRefused')}</p>
              {/if}
              <!-- D2u: the file's spelling, said beside the box that holds its text. -->
              {#if text.style !== null}
                <p class="kind">{tScalarStyle(text.style)}</p>
                {#if text.refusal === null && (text.style === 'SingleQuoted' || text.style === 'DoubleQuoted')}
                  <p class="kind">{t('browser.variableGroup.quotedText')}</p>
                {/if}
              {/if}
              {#if param.plainSource && text.refusal === null}
                <p class="kind">{t('browser.variableKinds.plainSource')}</p>
              {/if}
              {#if param.editWritesPlain}
                <p class="kind">{t('browser.variableGroup.editWritesPlain')}</p>
              {/if}
            {:else if param.list !== null}
              {@render listControls(selected.index, param.key, param.list)}
            {:else if param.refusal !== null}
              <p class="kind">{tParamRefusal(param.refusal)}</p>
            {/if}
          </div>
        {/each}
      {/if}
      {#if selected.boxes.dependsOn !== null}
        <p class="name">{tRetainedLabel('dependsOn')}</p>
        {@render listControls(selected.index, 'depends_on', selected.boxes.dependsOn)}
      {/if}
      {#if selected.removed}
        <p class="kind">{t('browser.variableGroup.removedNote')}</p>
      {/if}
      <p class="choices">
        {#if selected.canRestore}
          <button type="button" onclick={() => apply(restoreVariable(session, selected.index))}>
            {t('browser.variableGroup.restore')}
          </button>
        {:else if !selected.removed}
          <button type="button" disabled={!selected.canRemove} onclick={() => removeOne(selected.index)}>
            {t('browser.variableGroup.remove')}
          </button>
        {/if}
        <button type="button" onclick={() => closeSelection()}>
          {t('browser.variableGroup.close')}
        </button>
      </p>
      <!-- **The reorder: alone in its save, and only over a clean draft** (R25,
           override row 8). The offer is the model's; a press is decided again
           by the editor over a fresh read before anything is sent. -->
      <p class="name">{t('browser.variableGroup.move.heading')}</p>
      {#if view.moveRefusal !== null}
        <p class="kind">{tVariableMoveRefusal(view.moveRefusal)}</p>
      {:else}
        <p class="kind">{t('browser.variableGroup.move.hint')}</p>
        <p class="choices">
          {#each selected.moves as choiceOfMove, index (index)}
            <button type="button" onclick={() => move(selected.index, choiceOfMove.to)}>
              {tMoveChoice(choiceOfMove, unnamed)}
            </button>
          {/each}
        </p>
      {/if}
    </div>
  {:else if view.selected !== null && view.selected.kind === 'added'}
    {@const selected = view.selected}
    {@const params = addedParamsOf(selected.params)}
    <div class="panel controls" role="group" aria-label={t('browser.variableGroup.selected', { name: selected.name })}>
      <p class="name">{t('browser.variableGroup.selected', { name: selected.name })}</p>
      <p class="rowHead">
        <code class="source">{selected.name}</code>
        <span class="marker">{selected.typeText}</span>
        <span class="marker">{tDeclarationStatus('added')}</span>
      </p>
      {#if selected.values.length > 0}
        <p class="name">{t('browser.variableGroup.added.values')}</p>
        {#each selected.values as value, index (index)}
          <SourceText text={value} />
        {/each}
      {/if}
      {#if params.length > 0}
        <p class="name">{t('browser.variableGroup.added.params')}</p>
        {#each params as param, index (index)}
          <div class="addedParam">
            <code class="source">{param.key}</code>
            {#each param.texts as text, item (item)}
              <SourceText {text} />
            {/each}
          </div>
        {/each}
      {/if}
      {#if selected.insertedInto !== null}
        <p class="kind">
          {t('browser.variableGroup.added.insertedInto', {
            field: tDetailField(fieldLabelName(selected.insertedInto))
          })}
        </p>
      {/if}
      <p class="choices">
        <button type="button" disabled={!selected.canDiscard} onclick={() => discard(selected.position)}>
          {t('browser.variableGroup.discard')}
        </button>
        <button type="button" onclick={() => closeSelection()}>
          {t('browser.variableGroup.close')}
        </button>
      </p>
    </div>
  {:else if choice !== null && choiceView !== null}
    {@const form = choice}
    {@const said = choiceView}
    <!-- **The Choice insertion** (ruling 20): a provisional name with its live
         verdict — "available among visible names" under an open scope, never
         "collision-free" — the values, the content key the reference goes
         into, and one *Insert* that drafts both halves as one history step. -->
    <div class="panel controls choiceForm" role="group" aria-label={t('browser.variableGroup.choice.heading')}>
      <p class="name">{t('browser.variableGroup.choice.heading')}</p>
      <label>
        <span class="name">{t('browser.variableGroup.name')}</span>
        <input
          class="text"
          type="text"
          spellcheck="false"
          value={form.name}
          oninput={(event) => editChoice('name', event.currentTarget.value)}
        />
      </label>
      <p class="kind verdict" role="status">{tNameVerdict(said.verdict)}</p>
      <label>
        <span class="name">{t('browser.variableGroup.choice.values')}</span>
        <textarea
          class="text"
          spellcheck="false"
          value={form.values}
          oninput={(event) => editChoice('values', event.currentTarget.value)}
        ></textarea>
      </label>
      {#if said.targets.length > 0}
        <p class="name">{t('browser.variableGroup.choice.target')}</p>
        <p class="choices">
          {#each said.targets as target (target)}
            <button
              type="button"
              aria-pressed={form.target === target}
              onclick={() => editChoice('target', target)}
            >
              {tDetailField(fieldLabelName(target))}
            </button>
          {/each}
        </p>
      {/if}
      {#if said.problem !== null}
        <p class="kind">{tChoiceProblem(said.problem)}</p>
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
      <p class="choices">
        <button type="button" disabled={!said.canInsert} onclick={() => insertTheChoice()}>
          {t('browser.variableGroup.choice.insert')}
        </button>
        <button type="button" onclick={() => closeSelection()}>
          {t('browser.variableGroup.cancel')}
        </button>
      </p>
    </div>
  {:else if adding !== null && addingView !== null}
    {@const form = adding}
    {@const said = addingView}
    <!-- **Add a variable** (ruling 20: Echo is authored this way; Phase 4-14-1
         widened it to seven kinds): the kind, a provisional name with its live
         verdict, and one textual box per parameter the kind owns — each labelled
         with the espanso key it is written under, required or optional, and
         said to be written as typed when Rust writes it as plain source (D2u).
         Nothing is inserted into a content key. One *Add* is one history step. -->
    <div class="panel controls addForm" role="group" aria-label={t('browser.variableGroup.addVariable.heading')}>
      <p class="name">{t('browser.variableGroup.addVariable.heading')}</p>
      <p class="name">{t('browser.variableKinds.kindLabel')}</p>
      <p class="choices kinds">
        {#each said.kinds as kind (kind)}
          <button type="button" aria-pressed={form.kind === kind} onclick={() => chooseKind(kind)}>
            {tNewVariableKind(kind)}
          </button>
        {/each}
      </p>
      <label>
        <span class="name">{t('browser.variableGroup.name')}</span>
        <input
          class="text"
          type="text"
          spellcheck="false"
          value={form.name}
          oninput={(event) => editAdding('name', event.currentTarget)}
        />
      </label>
      <p class="kind verdict" role="status">{tNameVerdict(said.verdict)}</p>
      {#if said.executes}
        <p class="kind note">{t('browser.variableKinds.note.executes')}</p>
      {/if}
      {#if said.readsClipboard}
        <p class="kind note">{t('browser.variableKinds.note.readsClipboard')}</p>
      {/if}
      {#each said.parts as part (part.part)}
        <div class="variableField" data-part={part.part}>
          <label>
            <span class="name">{tKindPart(part.part)} <code class="source">{part.part}</code></span>
            {#if part.shape === 'oneLine'}
              <input
                class="text"
                type="text"
                spellcheck="false"
                value={part.text}
                oninput={(event) => editAdding(part.part, event.currentTarget)}
              />
            {:else}
              <textarea
                class="text"
                spellcheck="false"
                value={part.text}
                oninput={(event) => editAdding(part.part, event.currentTarget)}
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
      <p class="choices">
        <button type="button" disabled={!said.canAdd} onclick={() => addTheVariable()}>
          {t('browser.variableGroup.addVariable.add')}
        </button>
        <button type="button" onclick={() => closeSelection()}>
          {t('browser.variableGroup.cancel')}
        </button>
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

  .choices {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.375rem;
    margin: 0;
  }

  /* A chip: the name in the document's face, its type and status as markers. */
  .chip {
    display: inline-flex;
    align-items: baseline;
    gap: 0.25rem;
  }

  .chip[aria-pressed='true'] {
    border-color: currentColor;
  }

  .variableList {
    margin: 0;
    padding-left: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .variableRow p {
    margin: 0;
  }

  .rowHead {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.375rem;
  }

  .incomplete {
    margin: 0;
    padding-left: 1.25rem;
    font-size: 0.8125rem;
    color: var(--muted);
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

  .panel p {
    margin: 0;
  }

  .addedParam {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .variableField {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  /* One list of an existing variable, and one of its items (Phase 4-14-2). */
  .itemList,
  .listItem {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .itemList {
    padding-left: 0.75rem;
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
     from a line break the values do not contain. */
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
