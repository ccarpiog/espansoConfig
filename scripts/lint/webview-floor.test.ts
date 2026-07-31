/**
 * The two places that declare which WebKit this app is allowed to assume, and
 * the check that they say the same thing.
 *
 * `vite.config.ts` names an esbuild target; `src-tauri/tauri.conf.json` names a
 * `minimumSystemVersion` that macOS enforces at launch. They are the same claim
 * written twice, in two syntaxes, in two files, owned by two toolchains — and
 * in the first version of Phase 1b-1 they disagreed: the build compiled for
 * Safari 16 while the bundle offered itself to macOS 11, whose WebKit is four
 * major versions older. Nothing anywhere noticed.
 *
 * This is the thing that notices. It is a consistency check and nothing more:
 * it cannot tell whether the floor is the *right* one, only that the two
 * declarations of it agree.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * The macOS major release that *ships* each Safari major.
 *
 * Ventura 13 shipped Safari 16, Sonoma 14 shipped Safari 17, and so on. Older
 * macOS releases can often be updated to a newer Safari, but "can be updated
 * to" is not a floor: `minimumSystemVersion` is checked against the OS version,
 * never against the browser the user happens to have installed.
 */
const MACOS_MAJOR_SHIPPING_SAFARI: ReadonlyMap<number, number> = new Map([
  [14, 11],
  [15, 12],
  [16, 13],
  [17, 14],
  [18, 15]
]);

/**
 * Reads the esbuild target major from the Vite configuration.
 *
 * Read from the file's text rather than by importing it, because importing the
 * config evaluates the Svelte plugin, and this check has no business starting a
 * build to read one string.
 *
 * @returns The Safari major version the frontend is compiled for.
 */
function targetedSafariMajor(): number {
  const source = readFileSync(join(REPO_ROOT, 'vite.config.ts'), 'utf8');
  const match = /target:\s*'safari(\d+)'/.exec(source);
  expect(match, "vite.config.ts must declare a build target of the form 'safariNN'").not.toBeNull();
  return Number(match?.[1]);
} // End of function targetedSafariMajor()

/**
 * Reads the declared minimum macOS version from the Tauri configuration.
 *
 * @returns The `minimumSystemVersion` string, e.g. `"13.0"`.
 */
function declaredMinimumSystemVersion(): string {
  const source = readFileSync(join(REPO_ROOT, 'src-tauri/tauri.conf.json'), 'utf8');
  const config: unknown = JSON.parse(source);
  const value = (config as { bundle?: { macOS?: { minimumSystemVersion?: unknown } } }).bundle?.macOS
    ?.minimumSystemVersion;
  expect(typeof value, 'tauri.conf.json must declare bundle.macOS.minimumSystemVersion').toBe(
    'string'
  );
  return String(value);
} // End of function declaredMinimumSystemVersion()

describe('the declared WebKit floor', () => {
  it('is a Safari major this table knows the macOS release for', () => {
    // If the target moves to a Safari the table has never heard of, this fails
    // rather than letting the comparison below pass vacuously.
    expect([...MACOS_MAJOR_SHIPPING_SAFARI.keys()]).toContain(targetedSafariMajor());
  });

  it('is not undercut by the minimum macOS version the bundle offers itself to', () => {
    const safariMajor = targetedSafariMajor();
    const required = MACOS_MAJOR_SHIPPING_SAFARI.get(safariMajor);
    const declaredMajor = Number(declaredMinimumSystemVersion().split('.')[0]);

    expect(
      declaredMajor,
      `the build targets safari${safariMajor}, which first ships with macOS ${required}, ` +
        `but the bundle declares minimumSystemVersion ${declaredMinimumSystemVersion()}`
    ).toBeGreaterThanOrEqual(Number(required));
  });

  it('is a well-formed macOS version string', () => {
    expect(declaredMinimumSystemVersion()).toMatch(/^\d+\.\d+(\.\d+)?$/);
  });
}); // End of the "declared WebKit floor" suite
