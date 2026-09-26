<script lang="ts">
  import {
    discardAddedVariable,
    editVariableField,
    focusField,
    removeVariable,
    removeVariables,
    restoreVariable,
    restoreVariables,
    type MatchEditorSession,
    type TextSelection
  } from '../browser/matchEditor';
  import {
    addEcho,
    analysisOf,
    choiceDraftOf,
    choiceInsertionViewOf,
    echoAdditionViewOf,
    echoDraftOf,
    insertChoice,
    NO_SELECTION,
    sameSelection,
    seededSelection,
    selectionOfSeed,
    variableGroupViewOf,
    type ChoiceDraft,
    type EchoDraft,
    type GroupSelection,
    type HeldAnalysis,
    type SeededSelection,
    type VariableGroupPort
  } from '../browser/variableGroup';
  import { variableStructureGrantOf } from '../browser/variableEditor';
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
   * the `echo` *Add variable*), inside the match editor.
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
  /** The *Add variable* form's value while it is open, or `null`. */
  let echo = $state.raw<EchoDraft | null>(null);
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
  const echoView = $derived(
    echo === null || view.selection?.kind !== 'echo'
      ? null
      : echoAdditionViewOf(session, context, variableStructureGrantOf(session.match, read), echo)
  );
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
    echo = null;
  } // End of function choose()

  /** Opens the **Choice** form with a provisional name the visible names do not refuse. */
  function openChoice(): void {
    select({ kind: 'choice' });
    choice = choiceDraftOf(session, context);
    echo = null;
  } // End of function openChoice()

  /** Opens the *Add variable* form with a provisional name. */
  function openEcho(): void {
    select({ kind: 'echo' });
    echo = echoDraftOf(context);
    choice = null;
  } // End of function openEcho()

  /** Closes whichever form or controls are open. */
  function closeSelection(): void {
    select(null);
    choice = null;
    echo = null;
  } // End of function closeSelection()

  /**
   * Records one part of the *Add variable* form.
   *
   * @param part - Which part.
   * @param value - Its whole new value.
   */
  function editEcho(part: 'name' | 'echo', value: string): void {
    if (echo !== null) {
      echo = { ...echo, [part]: value };
    }
  } // End of function editEcho()

  /** *Add*: one history step; the grant and the names come from a read taken now (R37). */
  function addTheEcho(): void {
    if (echo === null) {
      return;
    }
    const now = port.structureRead(session.match.document);
    const grant = variableStructureGrantOf(session.match, now);
    const names = nameContextOf(session, analysisOf(session, held).analysis, now.document);
    const outcome = addEcho(session, grant, names, echo);
    if (outcome.kind === 'inserted') {
      apply(outcome.session);
      refused = null;
      echo = null;
      select({ kind: 'added', position: outcome.session.draft.value.variables.added.length - 1 });
      return;
    }
    refused = { session, refusal: outcome.refusal };
  } // End of function addTheEcho()

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
    <button type="button" disabled={view.selection?.kind === 'echo'} onclick={() => openEcho()}>
      {t('browser.variableGroup.echo.open')}
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
  {:else if echo !== null && echoView !== null}
    {@const form = echo}
    {@const said = echoView}
    <!-- **Add variable** (ruling 20: Echo is authored this way): a provisional
         name with its live verdict and the text it echoes; nothing is inserted
         into a content key. One *Add* is one history step. -->
    <div class="panel controls echoForm" role="group" aria-label={t('browser.variableGroup.echo.heading')}>
      <p class="name">{t('browser.variableGroup.echo.heading')}</p>
      <label>
        <span class="name">{t('browser.variableGroup.name')}</span>
        <input
          class="text"
          type="text"
          spellcheck="false"
          value={form.name}
          oninput={(event) => editEcho('name', event.currentTarget.value)}
        />
      </label>
      <p class="kind verdict" role="status">{tNameVerdict(said.verdict)}</p>
      <label>
        <span class="name">{t('browser.variableGroup.echo.text')}</span>
        <textarea
          class="text"
          spellcheck="false"
          value={form.echo}
          oninput={(event) => editEcho('echo', event.currentTarget.value)}
        ></textarea>
      </label>
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
        <button type="button" disabled={!said.canAdd} onclick={() => addTheEcho()}>
          {t('browser.variableGroup.echo.add')}
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

  .variableField {
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
