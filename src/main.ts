/**
 * Frontend entry point.
 *
 * Svelte 5 mounts explicitly (`mount`) rather than by constructing a component
 * class, which is the Svelte 4 API and is gone in runes mode.
 *
 * Everything with a claim attached to it lives in `lib/bootstrap.ts`, which is
 * testable; this file is the wiring that supplies the real `document`, the real
 * language state and the real mount call, and nothing else.
 */

import { mount } from 'svelte';
import App from './App.svelte';
import { bootstrap } from './lib/bootstrap';
import { locale } from './lib/stores/locale.svelte';
import './app.css';

export default bootstrap(document, locale.current, (target) => mount(App, { target }));
