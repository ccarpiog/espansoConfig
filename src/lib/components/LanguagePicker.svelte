<script lang="ts">
  import { LOCALES, isLocale, localeNameKey, t } from '../i18n';
  import { locale } from '../stores/locale.svelte';

  /**
   * The value shown in the picker: a locale tag, or the sentinel meaning
   * "follow the system", which is the absence of an override rather than a
   * fourth language.
   */
  const FOLLOW_SYSTEM = 'system';

  /**
   * Applies the picker's selection to the application-wide language state.
   *
   * @param event - The `change` event from the underlying `<select>`.
   */
  function onChange(event: Event): void {
    const value = (event.currentTarget as HTMLSelectElement).value;
    locale.setOverride(isLocale(value) ? value : null);
  } // End of function onChange()
</script>

<div class="language-picker">
  <label for="language-picker-select">{t('language.label')}</label>
  <select
    id="language-picker-select"
    value={locale.override ?? FOLLOW_SYSTEM}
    onchange={onChange}
  >
    <option value={FOLLOW_SYSTEM}>{t('language.followSystem')}</option>
    {#each LOCALES as candidate (candidate)}
      <option value={candidate}>{t(localeNameKey(candidate))}</option>
    {/each}
  </select>
  {#if locale.override === null}
    <span class="hint">
      {t('language.systemDetected', { language: t(localeNameKey(locale.system)) })}
    </span>
  {/if}
</div>

<style>
  .language-picker {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /*
   * No `width` on the control. Spanish labels run 20-25% longer than English
   * (plan section 9), so every interactive element is sized by its content.
   */
  select {
    font: inherit;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: inherit;
  }

  .hint {
    color: var(--muted);
    font-size: 0.8125rem;
  }
</style>
