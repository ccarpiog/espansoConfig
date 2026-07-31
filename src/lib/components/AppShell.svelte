<script lang="ts">
  import { onMount } from 'svelte';
  import { createBrowserState } from '../browser/workspace.svelte';
  import { t, tIpcFailure, tLocaleName } from '../i18n';
  import type { IpcFailure } from '../ipc/errors';
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

  const browser = createBrowserState();

  onMount(() => {
    // `null` means "probe the standard locations in order", which is what a
    // user who has never opened the settings expects. A directory the user
    // chose is Phase 2's picker; there is nowhere to store one yet.
    void browser.open(null);
  });

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
