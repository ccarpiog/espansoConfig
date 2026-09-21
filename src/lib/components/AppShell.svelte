<script lang="ts">
  import { onMount } from 'svelte';
  import { INERT_FOREGROUND_EVENTS } from '../browser/reconciliationCoordinator';
  import {
    createBrowserState,
    REAL_BACKUP_COMMANDS,
    REAL_COMMANDS
  } from '../browser/workspace.svelte';
  import { t, tIpcFailure, tLocaleName } from '../i18n';
  import { reportIpcFailure } from '../ipc/errors';
  import type { IpcFailure } from '../ipc/errors';
  import { REAL_RECONCILIATION_EVENTS } from '../ipc/events';
  import { locale } from '../stores/locale.svelte';
  import DetailPane from './DetailPane.svelte';
  import LanguagePicker from './LanguagePicker.svelte';
  import Sidebar from './Sidebar.svelte';
  import SnippetList from './SnippetList.svelte';

  /*
   * Plan section 8.1's three panes, and the four states the screen can be in
   * before it has three of anything: reading, read and empty, failed to read,
   * and ready.
   *
   * The failure arm has two headings and one message. The message is always
   * `tIpcFailure`, so every failure the boundary can produce has a sentence in
   * both languages; the heading distinguishes "there is no espanso
   * configuration on this machine", which is an ordinary state a first-run user
   * is in, from "something went wrong", which is not.
   */

  /*
   * The production composition, every source named at the call rather than
   * left to a default — Phase 2d-5-7a.
   *
   * The first three are the same values `createBrowserState` would default to;
   * they are written out so that the fourth can be, and so that a reader sees
   * the whole composition in one place. The fourth is the one that matters: it
   * is the first and only production import of `src/lib/ipc/events.ts`, which
   * is what makes Tauri's `listen` reachable from the shipped window and is why
   * `src-tauri/capabilities/default.json` grants `core:event:allow-listen` and
   * `core:event:allow-unlisten`. `createBrowserState`'s own default for it stays
   * the inert source, on purpose: every suite that builds a state without naming
   * a source must keep registering nothing.
   *
   * The fifth is deliberately the inert one. No production `ForegroundSource`
   * exists yet — a DOM `visibilitychange`/focus source is a later phase's, and
   * would be a module of its own — so in the shipped window the foreground and
   * resume trigger never asks for a drain; registration, a finished open and a
   * current-epoch wake are the three that do.
   */
  const browser = createBrowserState(
    REAL_COMMANDS,
    reportIpcFailure,
    REAL_BACKUP_COMMANDS,
    REAL_RECONCILIATION_EVENTS,
    INERT_FOREGROUND_EVENTS
  );

  onMount(() => {
    // **The lifecycle, in the order the design consult's Q4 lists its triggers:
    // registration first, then the open.** `start()` fires the registration
    // and returns — it never awaits, so it cannot delay the open — and putting
    // it first means the registration is in flight before `open_workspace` is
    // asked for; a wake this window is not yet listening for costs a later
    // drain, and the drain after the open is what pays it. Either order is
    // correct, and that is the coordinator's doing rather than this line's:
    // `open()` closes the drain gate synchronously through `workspaceOpened()`
    // before its first await, so a registration that resolves while the load
    // is in flight is recorded and issued by `workspaceReady()`, and one
    // physical drain then satisfies both reasons. A refused open leaves the
    // gate closed, and the *Retry* control below re-runs `open(null)` without
    // touching the subscription.
    browser.start();
    // `null` means "probe the standard locations in order", which is what a
    // user who has never opened the settings expects. A directory the user
    // chose is Phase 2's picker; there is nowhere to store one yet.
    void browser.open(null);
    // **The disposal is what makes `dispose()` a disposal rather than an unused
    // method.** Svelte runs the function `onMount` returns when this component
    // is destroyed; the coordinator then removes the foreground listener
    // synchronously and calls the held unlisten exactly once — and a
    // registration still in flight at that moment is ended by the coordinator
    // when it resolves (ruling 16), which is nothing this host has to do.
    // Nothing in TypeScript forces a host to return this; `AppShell.test.ts`
    // asserts the exact unlisten count instead.
    return () => {
      browser.dispose();
    };
  }); // End of the onMount that starts and disposes the reconciliation lifecycle

  /**
   * The heading a failed load gets.
   *
   * `configDirNotFound` is the one failure that is not a fault: espanso may
   * simply not be installed. Everything else — an unreadable directory, a
   * refused command, a rejection this build does not recognise — gets the
   * generic heading, and the sentence underneath says which.
   *
   * @param failure - The classified failure the load stopped at.
   * @returns The translated heading.
   */
  function failureHeading(failure: IpcFailure): string {
    if (failure.kind === 'command' && failure.error.code === 'configDirNotFound') {
      return t('browser.status.notFound.heading');
    }
    return t('browser.status.failed.heading');
  } // End of function failureHeading()
</script>

<div class="shell">
  <header>
    <h1>{t('app.name')}</h1>
    <LanguagePicker />
  </header>

  {#if browser.status === 'loading'}
    <main class="state">
      <p>{t('browser.status.loading')}</p>
    </main>
  {:else if browser.status === 'failed' && browser.failure !== null}
    {@const failure = browser.failure}
    <main class="state">
      <h2>{failureHeading(failure)}</h2>
      <p>{tIpcFailure(failure)}</p>
      <p>
        <button type="button" onclick={() => void browser.open(null)}>
          {t('browser.status.retry')}
        </button>
      </p>
    </main>
  {:else if browser.documents.length === 0}
    <main class="state">
      <h2>{t('browser.status.empty.heading')}</h2>
      {#if browser.summary !== null}
        <p>{t('browser.status.empty.body', { root: browser.summary.root })}</p>
      {/if}
    </main>
  {:else}
    <main class="panes">
      <Sidebar {browser} />
      <SnippetList {browser} />
      <DetailPane {browser} />
    </main>
  {/if}

  <footer>
    <p>{t('app.tagline')}</p>
    <p>{t('language.active', { language: tLocaleName(locale.current) })}</p>
  </footer>
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
  }

  h1 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }

  /*
   * Three fractions rather than three widths: plan section 9 rules out fixed
   * sizing on anything holding text, and Spanish headings in the sidebar are
   * the first thing a fixed sidebar would clip. Resizable panes are not part of
   * this sub-phase; a correct static layout is.
   */
  .panes {
    flex: 1 1 auto;
    display: grid;
    grid-template-columns: minmax(11rem, 1fr) minmax(14rem, 1.4fr) minmax(16rem, 2fr);
    min-height: 0;
  }

  .state {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.5rem;
    padding: 2rem 1rem;
    max-width: 46rem;
  }

  .state p {
    margin: 0;
    color: var(--muted);
  }

  button {
    font: inherit;
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: inherit;
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--border);
    font-size: 0.8125rem;
  }

  footer p {
    margin: 0;
    color: var(--muted);
  }
</style>
