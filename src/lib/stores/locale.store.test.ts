/**
 * The language override policy.
 *
 * Two claims are worth pinning here, and they are the same claim seen across
 * two different time scales.
 *
 * 1. "Follow the system" is stored as the absence of an override, not as a
 *    snapshot: a user who picks "follow the system" while macOS is in English,
 *    then switches macOS to Spanish, must get a Spanish interface on the next
 *    start. A snapshot implementation passes every other test in this file and
 *    fails that one.
 * 2. The same must hold *without* a restart. The platform can change its
 *    language order while the app is open; the store re-reads it on
 *    `languagechange`. And it must move `system` only — a user who chose a
 *    language must not have that choice overwritten by their operating system.
 */

import { describe, expect, it } from 'vitest';
import {
  createLocaleState,
  type LanguageChangeTarget,
  type LocaleStorage
} from './locale.svelte';

/**
 * An in-memory {@link LocaleStorage} that records what was written to it.
 *
 * @param initial - The value already persisted before the app started.
 * @returns A storage port plus the slot it writes through.
 */
function memoryStorage(initial: string | null = null): LocaleStorage & { value: string | null } {
  return {
    value: initial,
    read(): string | null {
      return this.value;
    },
    write(next: string | null): void {
      this.value = next;
    }
  };
} // End of function memoryStorage()

/** A {@link LanguageChangeTarget} a test can fire by hand, plus its own census. */
interface FakePlatform extends LanguageChangeTarget {
  /** Invokes every currently registered listener. */
  dispatch(): void;
  /** How many listeners are attached right now. */
  readonly listenerCount: number;
}

/**
 * A `languagechange` target with no DOM behind it.
 *
 * `environment: 'node'` in `vite.config.ts` means there is no `window` to
 * dispatch a real event on, and the store takes the target as an argument
 * precisely so that this two-method stand-in is enough.
 *
 * @returns An event target that can be fired and counted.
 */
function fakePlatform(): FakePlatform {
  const listeners = new Set<() => void>();
  return {
    addEventListener(_type: 'languagechange', listener: () => void): void {
      listeners.add(listener);
    },
    removeEventListener(_type: 'languagechange', listener: () => void): void {
      listeners.delete(listener);
    },
    dispatch(): void {
      for (const listener of [...listeners]) {
        listener();
      }
    },
    get listenerCount(): number {
      return listeners.size;
    }
  };
} // End of function fakePlatform()

/**
 * A mutable platform language source, so a test can change the system language.
 *
 * @param initial - The platform's language order at start-up.
 * @returns A reader function with a settable backing slot.
 */
function mutableTags(...initial: string[]): { read: () => readonly string[]; tags: string[] } {
  const box = { tags: [...initial], read: (): readonly string[] => box.tags };
  return box;
} // End of function mutableTags()

describe('createLocaleState()', () => {
  it('follows the system when nothing is persisted', () => {
    const state = createLocaleState(() => ['es-ES', 'en'], memoryStorage());
    expect(state.system).toBe('es');
    expect(state.override).toBeNull();
    expect(state.current).toBe('es');
  });

  it('lets a persisted override win over the system language', () => {
    const state = createLocaleState(() => ['es-ES'], memoryStorage('en'));
    expect(state.system).toBe('es');
    expect(state.override).toBe('en');
    expect(state.current).toBe('en');
  });

  it('ignores a persisted value that is not a supported locale', () => {
    const state = createLocaleState(() => ['en'], memoryStorage('klingon'));
    expect(state.override).toBeNull();
    expect(state.current).toBe('en');
  });

  it('persists an override when one is set', () => {
    const storage = memoryStorage();
    const state = createLocaleState(() => ['en'], storage);
    state.setOverride('es');
    expect(state.current).toBe('es');
    expect(storage.value).toBe('es');
  });

  it('clears the persisted value when the user returns to following the system', () => {
    const storage = memoryStorage('en');
    const state = createLocaleState(() => ['es'], storage);
    state.setOverride(null);
    expect(state.override).toBeNull();
    expect(storage.value).toBeNull();
    expect(state.current).toBe('es');
  });

  it('stores "follow the system" as an absence, never as a snapshot', () => {
    // The user picks "follow the system" while the system is English...
    const storage = memoryStorage();
    const first = createLocaleState(() => ['en'], storage);
    first.setOverride(null);
    expect(storage.value).toBeNull();

    // ...then changes macOS to Spanish and restarts the app.
    const second = createLocaleState(() => ['es'], storage);
    expect(second.current).toBe('es');
  });
}); // End of the "createLocaleState()" suite

describe('the languagechange listener', () => {
  it('moves the interface when the platform language changes and no override is set', () => {
    const source = mutableTags('en');
    const platform = fakePlatform();
    const state = createLocaleState(source.read, memoryStorage(), platform);
    expect(state.current).toBe('en');

    source.tags = ['es-ES', 'en'];
    platform.dispatch();

    expect(state.system).toBe('es');
    expect(state.current).toBe('es');
    state.dispose();
  });

  it('leaves a user who chose a language on that language', () => {
    const source = mutableTags('en');
    const platform = fakePlatform();
    const state = createLocaleState(source.read, memoryStorage('en'), platform);
    expect(state.current).toBe('en');

    source.tags = ['es-ES'];
    platform.dispatch();

    // The system moved. The user's choice did not, and neither did the
    // interface: an operating-system preference must never overwrite an
    // explicit one.
    expect(state.system).toBe('es');
    expect(state.override).toBe('en');
    expect(state.current).toBe('en');
    state.dispose();
  });

  it('takes effect the moment an override is cleared, with no further event', () => {
    const source = mutableTags('en');
    const platform = fakePlatform();
    const state = createLocaleState(source.read, memoryStorage('en'), platform);

    source.tags = ['es'];
    platform.dispatch();
    expect(state.current).toBe('en');

    state.setOverride(null);
    expect(state.current).toBe('es');
    state.dispose();
  });

  it('attaches exactly one listener and dispose() removes it', () => {
    const source = mutableTags('en');
    const platform = fakePlatform();
    const state = createLocaleState(source.read, memoryStorage(), platform);
    expect(platform.listenerCount).toBe(1);

    state.dispose();
    expect(platform.listenerCount).toBe(0);

    // And the detached store no longer follows the platform.
    source.tags = ['es'];
    platform.dispatch();
    expect(state.current).toBe('en');
  });

  it('is optional: a store built with no platform target still negotiates', () => {
    const source = mutableTags('es');
    const state = createLocaleState(source.read, memoryStorage());
    expect(state.current).toBe('es');

    // Nothing fires it, but the door is not locked.
    source.tags = ['en'];
    state.refreshSystem();
    expect(state.current).toBe('en');
    state.dispose();
  });
}); // End of the "languagechange listener" suite

describe('subscribe()', () => {
  it('reports the language the user picked', () => {
    const state = createLocaleState(() => ['en'], memoryStorage());
    const seen: string[] = [];
    state.subscribe((current) => seen.push(current));
    state.setOverride('es');
    expect(seen).toEqual(['es']);
    state.dispose();
  });

  it('reports the language the platform moved to', () => {
    const source = mutableTags('en');
    const platform = fakePlatform();
    const state = createLocaleState(source.read, memoryStorage(), platform);
    const seen: string[] = [];
    state.subscribe((current) => seen.push(current));

    source.tags = ['es-ES'];
    platform.dispatch();
    expect(seen).toEqual(['es']);
    state.dispose();
  }); // End of the "language the platform moved to" case

  it('stays silent when a write leaves the language where it was', () => {
    // Two writes that change a field without changing `current`: the platform
    // moving under an override, and an override set to the language already
    // showing. Both would otherwise rebuild the menu in the language it had.
    const source = mutableTags('en');
    const platform = fakePlatform();
    const state = createLocaleState(source.read, memoryStorage('en'), platform);
    const seen: string[] = [];
    state.subscribe((current) => seen.push(current));

    source.tags = ['es-ES'];
    platform.dispatch();
    state.setOverride('en');
    expect(seen).toEqual([]);

    // And the store is not simply mute: clearing the override reveals the
    // system language it has been tracking all along.
    state.setOverride(null);
    expect(seen).toEqual(['es']);
    state.dispose();
  }); // End of the "silent when nothing changed" case

  it('stops reporting once its unsubscribe is called', () => {
    const state = createLocaleState(() => ['en'], memoryStorage());
    const seen: string[] = [];
    const stop = state.subscribe((current) => seen.push(current));
    state.setOverride('es');
    stop();
    state.setOverride('en');
    expect(seen).toEqual(['es']);
    state.dispose();
  }); // End of the "stops reporting" case

  it('drops every subscriber on dispose()', () => {
    const state = createLocaleState(() => ['en'], memoryStorage());
    const seen: string[] = [];
    state.subscribe((current) => seen.push(current));
    state.dispose();
    state.setOverride('es');
    expect(seen).toEqual([]);
  }); // End of the "drops every subscriber" case
}); // End of the "subscribe()" suite
