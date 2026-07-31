<script lang="ts">
  import { localeNameKey, t } from '../i18n';
  import { locale } from '../stores/locale.svelte';
  import LanguagePicker from './LanguagePicker.svelte';

  /*
   * Phase 1c replaces the <main> below with the three-pane browser (plan
   * section 8.1). Everything here is scaffolding whose job is to prove the
   * shell mounts, the language switches live, and no string is hardcoded.
   */
</script>

<div class="shell">
  <header>
    <h1>{t('app.name')}</h1>
    <LanguagePicker />
  </header>

  <main>
    <h2>{t('shell.placeholder.heading')}</h2>
    <p>{t('shell.placeholder.body')}</p>
  </main>

  <footer>
    <p>{t('app.tagline')}</p>
    <p>{t('language.active', { language: t(localeNameKey(locale.current)) })}</p>
  </footer>
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
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

  main {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.5rem;
    padding: 2rem 1rem;
    max-width: 46rem;
  }

  h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }

  p {
    margin: 0;
    color: var(--muted);
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--border);
    font-size: 0.8125rem;
  }
</style>
