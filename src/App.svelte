<script lang="ts">
  import AppShell from './lib/components/AppShell.svelte';
  import { t } from './lib/i18n';
  import { locale } from './lib/stores/locale.svelte';

  /*
   * The document language is a real accessibility signal — a screen reader
   * picks its voice from it — so it has to track the interface language rather
   * than stay at the static `lang` attribute `index.html` ships with.
   *
   * This effect keeps it *in step*; it does not establish it. The first value
   * is written by `bootstrap()` in `lib/bootstrap.ts` before this component
   * exists, because an effect runs after the first render and would leave the
   * opening frame declaring the wrong language. Both halves are needed: the
   * language changes when the user picks one and when the platform reports a
   * `languagechange`, and only this half sees either.
   */
  $effect(() => {
    document.documentElement.lang = locale.current;
  });
</script>

<svelte:head>
  <title>{t('app.name')}</title>
</svelte:head>

<AppShell />
