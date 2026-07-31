/**
 * Frontend entry point.
 *
 * Svelte 5 mounts explicitly (`mount`) rather than by constructing a component
 * class, which is the Svelte 4 API and is gone in runes mode.
 *
 * Everything with a claim attached to it lives in `lib/bootstrap.ts` and
 * `lib/menu.ts`, both of which are testable; this file is the wiring that
 * supplies the real `document`, the real language state, the real `invoke` and
 * the real mount call, and nothing else.
 */

import { mount } from 'svelte';
import App from './App.svelte';
import { bootstrap } from './lib/bootstrap';
import { reportIpcFailure } from './lib/ipc/errors';
import { setMenuLabels } from './lib/ipc/menu';
import { startMenuLocalization } from './lib/menu';
import { locale } from './lib/stores/locale.svelte';
import './app.css';

// Before the mount, because Tauri installs its own English menu at startup and a
// Spanish user should see it replaced as early as the boundary allows.
//
// Three references and no logic, deliberately. Phase 1b-2b wrote a closure here
// that dropped the returned promise, so a failed rebuild was classified and
// thrown away with the English default menu still on screen — and this file is
// the one place a test cannot reach. The consumption lives in
// `startMenuLocalization`, where `menu.test.ts` drives it; there is no screen to
// show a non-blocking failure on yet (1c owns that), so `reportIpcFailure` sends
// it to the developer console.
startMenuLocalization(locale, setMenuLabels, reportIpcFailure);

export default bootstrap(document, locale.current, (target) => mount(App, { target }));
