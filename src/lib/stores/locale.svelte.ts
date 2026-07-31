/**
 * The reactive interface-language state.
 *
 * Policy (plan section 9): the language **follows the system locale**, and a
 * manual override wins over it. The override is stored as the user's answer to
 * a three-way question — English, Spanish, or "follow the system" — and
 * "follow the system" is stored as the *absence* of an override rather than as
 * a snapshot of today's system language. Storing a snapshot would silently
 * freeze the choice the day the user changed macOS's language.
 *
 * The same argument applies within a single run, and the first version of this
 * module lost it there: the system locale was negotiated once at construction,
 * so changing the platform language while the app was open left "follow the
 * system" following a language the system had stopped using. The platform tags
 * are therefore read through a function, not captured as an array, and the
 * store re-reads them on `window`'s `languagechange` event.
 *
 * Persistence is `localStorage`, chosen because it is the only store available
 * to the frontend that needs no IPC command, and Phase 1b-1 deliberately has no
 * commands. In a Tauri v2 webview it lives in the app's own WebKit data
 * directory, so it is per-app and survives restarts. When Phase 2 introduces a
 * real preferences file this key is the thing to migrate; the storage port
 * below exists so that migration touches one adapter and no policy.
 */

import { isLocale, negotiateLocale, type Locale } from '../i18n/locale';

/** The `localStorage` key holding the manual override, if any. */
export const OVERRIDE_STORAGE_KEY = 'espansoconfig.locale.override';

/**
 * The narrow slice of storage this module needs.
 *
 * A port rather than a direct `localStorage` call so the policy is testable
 * without a DOM, and so Phase 2 can swap in a preferences file.
 */
export interface LocaleStorage {
  /** Reads the persisted override, or `null` when none is stored. */
  read(): string | null;
  /** Persists the override, or clears it when given `null`. */
  write(value: string | null): void;
}

/**
 * A live reading of the platform's language preference order.
 *
 * A function rather than an array because "follow the system" has to keep
 * following it: the platform order can change while the app is open, and a
 * value captured once would freeze the answer until the next restart.
 */
export type SystemLanguageSource = () => readonly string[];

/**
 * The slice of `window` this store listens to.
 *
 * Two methods, so a test can supply a plain object and dispatch the event
 * itself without a DOM implementation.
 */
export interface LanguageChangeTarget {
  /** Registers a listener for the platform's `languagechange` event. */
  addEventListener(type: 'languagechange', listener: () => void): void;
  /** Removes a listener registered by {@link addEventListener}. */
  removeEventListener(type: 'languagechange', listener: () => void): void;
}

/** Reactive interface-language state. */
export interface LocaleState {
  /** The locale the interface is actually rendering in. */
  readonly current: Locale;
  /** The locale negotiated from the platform's reported preference order. */
  readonly system: Locale;
  /** The user's manual choice, or `null` when following the system. */
  readonly override: Locale | null;
  /**
   * Sets or clears the manual override.
   *
   * @param locale - A locale to force, or `null` to follow the system again.
   */
  setOverride(locale: Locale | null): void;
  /**
   * Re-reads the platform preference order and re-negotiates {@link system}.
   *
   * Called for you on `languagechange`; exposed because a caller that has no
   * event target still needs a way to say "ask again".
   */
  refreshSystem(): void;
  /**
   * Detaches the platform listener.
   *
   * Idempotent. The application-wide instance below never needs this — its
   * lifetime is the document's — but any scoped instance, and every test that
   * builds one, must be able to let go of the target it was handed.
   */
  dispose(): void;
}

/**
 * Builds the language state from a platform language source and a storage port.
 *
 * @param readSystemTags - Reads BCP-47 tags in descending preference order.
 * @param storage - Where the manual override is persisted.
 * @param platform - The event target that reports platform language changes.
 * @returns Reactive state whose `current` tracks both inputs.
 */
export function createLocaleState(
  readSystemTags: SystemLanguageSource,
  storage: LocaleStorage,
  platform?: LanguageChangeTarget
): LocaleState {
  let system = $state<Locale>(negotiateLocale(readSystemTags()));
  const stored = storage.read();
  let override = $state<Locale | null>(isLocale(stored) ? stored : null);

  /**
   * Re-negotiates the system locale from a fresh reading of the platform.
   *
   * It writes `system` and never touches `override`, which is the whole point:
   * a user who chose a language keeps it when macOS changes its own.
   */
  function refreshSystem(): void {
    system = negotiateLocale(readSystemTags());
  } // End of function refreshSystem()

  platform?.addEventListener('languagechange', refreshSystem);

  return {
    get current(): Locale {
      return override ?? system;
    },
    get system(): Locale {
      return system;
    },
    get override(): Locale | null {
      return override;
    },
    setOverride(locale: Locale | null): void {
      override = locale;
      storage.write(locale);
    },
    refreshSystem,
    dispose(): void {
      platform?.removeEventListener('languagechange', refreshSystem);
    }
  };
} // End of function createLocaleState()

/**
 * Reads the platform's language preference order.
 *
 * `navigator.languages` is the ordered list; `navigator.language` is only its
 * head. In a macOS WKWebView both reflect the system's language order, which is
 * exactly the signal plan section 9 asks the app to follow. Under a test runner
 * with no `navigator` this returns an empty list and negotiation falls through
 * to the default locale.
 *
 * @returns BCP-47 tags in descending order of user preference.
 */
export function platformLanguageTags(): readonly string[] {
  const nav = globalThis.navigator as Navigator | undefined;
  if (nav === undefined) {
    return [];
  }
  if (Array.isArray(nav.languages) && nav.languages.length > 0) {
    return nav.languages;
  }
  return typeof nav.language === 'string' && nav.language !== '' ? [nav.language] : [];
} // End of function platformLanguageTags()

/**
 * A {@link LocaleStorage} backed by `localStorage`, inert where it is absent.
 *
 * Two guards, for two different reasons. Outside a browser there is no `window`
 * and the port is inert, which keeps a test runner from tripping over a host
 * shim. Inside one, every access is wrapped because `localStorage` *throws*
 * rather than returning `null` when a WebKit privacy setting blocks it, and
 * failing to remember a language preference must never stop the app starting.
 *
 * @returns A storage port that silently does nothing when storage is unusable.
 */
export function webLocaleStorage(): LocaleStorage {
  if (typeof globalThis.window === 'undefined') {
    return { read: () => null, write: () => undefined };
  }
  return {
    read(): string | null {
      try {
        return globalThis.localStorage?.getItem(OVERRIDE_STORAGE_KEY) ?? null;
      } catch {
        return null;
      }
    },
    write(value: string | null): void {
      try {
        if (value === null) {
          globalThis.localStorage?.removeItem(OVERRIDE_STORAGE_KEY);
        } else {
          globalThis.localStorage?.setItem(OVERRIDE_STORAGE_KEY, value);
        }
      } catch {
        // A blocked storage means the choice is not remembered across
        // restarts. That is a degraded preference, not a failure worth
        // surfacing, so it is swallowed on purpose.
      }
    }
  };
} // End of function webLocaleStorage()

/**
 * The `window` this store listens to, where one exists.
 *
 * Absent under a test runner and under any non-browser host, in which case the
 * store simply never refreshes on its own — `refreshSystem()` remains callable.
 *
 * @returns The platform event target, or `undefined` outside a browser.
 */
export function languageChangeTarget(): LanguageChangeTarget | undefined {
  const win = globalThis.window as (Window & typeof globalThis) | undefined;
  return win !== undefined && typeof win.addEventListener === 'function' ? win : undefined;
} // End of function languageChangeTarget()

/**
 * The application-wide language state.
 *
 * Its `languagechange` listener is never removed, and that is not a leak: this
 * instance lives exactly as long as the document that owns the listener, so
 * there is nothing left behind to collect. `dispose()` exists for instances
 * that do not have that lifetime — every one built by a test, and any scoped
 * instance a later phase introduces.
 */
export const locale: LocaleState = createLocaleState(
  platformLanguageTags,
  webLocaleStorage(),
  languageChangeTarget()
);
