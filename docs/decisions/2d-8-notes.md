# Phase 2d-8 — instrument removal and harness-free closure

**Spec:** `docs/reviews/phase-2d-design.md` item 8; `docs/decisions/2d-7-split-notes.md` §3 entry 32.
**Deletion manifest:** `docs/decisions/2d-7-10-notes.md` §4. **Carried-forward list:**
`docs/decisions/2d-7-10-notes.md` §5.

2d-8 owes no new model, mounted or window evidence. It deletes the temporary window-reading
instrument and its harness, corrects one comment, re-derives the gates without the instrument, and
carries the reading record forward unchanged. **Deletion proves nothing about any row the instrument
left unread or constructed.**

---

## 1. The manifest check and the deletion

Before deleting anything every §4.1-§4.5 entry was listed with `ls -ld` on 2026-09-23 and compared
with the manifest (type, size, date). **Every entry matched; no mismatch was found and nothing was
left behind for one.** After deletion the same `ls -ld` answered `No such file or directory` for
every entry.

### 1.1 §4.1 The instrument in the repository

Before:

```
-rw-r--r--@  1 ccarpio  staff  100061 Sep 23 09:25 src-tauri/src/probe.rs
-rw-r--r--@  1 ccarpio  staff  251256 Sep 23 10:05 src/probe.ts
```

The hook lines were removed **by editing**, not by any git command: `mod probe;` and
`probe::register_with_probe(…)` → `register(…)` in `src-tauri/src/main.rs`; `import { startProbe }
from './probe';` and the trailing `startProbe();` (with its preceding blank line) in `src/main.ts`.
Then the two files were deleted.

After: `ls: src-tauri/src/probe.rs: No such file or directory`, `ls: src/probe.ts: No such file or
directory`. `git diff src/main.ts` is empty; `git diff src-tauri/src/main.rs` shows only the comment
correction of §3.

### 1.2 §4.2 The harness tree

Before:

```
drwxr-xr-x@ 15 ccarpio  wheel  480 Sep 23 09:13 /private/tmp/espansoconfig-harness-2d-6-6c-2
```

13 root entries and `launches/` holding **271** entries, as the manifest records. After: `No such
file or directory`.

### 1.3 §4.3 The eight probe-related pre-edit files

Before:

```
-rw-r--r--@  1 ccarpio  wheel   18192 Sep 23 00:14 /private/tmp/6c2-probe.rs.orig
-rw-r--r--@  1 ccarpio  wheel   79456 Sep 23 00:14 /private/tmp/6c2-probe.ts.orig
-rw-r--r--@  1 ccarpio  wheel   21088 Sep 23 01:53 /private/tmp/7c-probe-block.ts
-rw-r--r--@  1 ccarpio  wheel  123181 Sep 23 03:19 /private/tmp/espansoconfig-8c-probe.ts.before
-rw-r--r--@  1 ccarpio  wheel   33774 Sep 23 03:19 /private/tmp/espansoconfig-8c-section.ts
-rw-r--r--@  1 ccarpio  wheel   31088 Sep 23 05:33 /private/tmp/9c-probe.rs.orig
-rw-r--r--@  1 ccarpio  wheel  162608 Sep 23 05:33 /private/tmp/9c-probe.ts.orig
-rw-r--r--@  1 ccarpio  wheel  211770 Sep 23 06:23 /private/tmp/10-probe.ts.orig
```

After: all eight `No such file or directory`.

### 1.4 §4.4 2d-7's own copies

Before:

```
-rw-r--r--@  1 ccarpio  wheel   39514 Sep 23 08:22 /private/tmp/2d7-3-probe.rs.orig
-rw-r--r--@  1 ccarpio  wheel  215138 Sep 23 09:20 /private/tmp/2d7-4-probe.ts.orig
drwxr-xr-x@  5 ccarpio  wheel     160 Sep 23 10:11 /private/tmp/2d7-instrument-reviewed
```

(`2d7-instrument-reviewed/` held `harness`, `repo` and `SHA256SUMS`.) After: all three `No such
file or directory`.

### 1.5 §4.5 Probe WebKit and Caches data

Before:

```
drwxr-xr-x@  3 ccarpio  staff  96 Jul 31 17:04 ~/Library/WebKit/cc.carpio.espansoConfig.probe
drwxr-xr-x@  3 ccarpio  staff  96 Jul 31 17:04 ~/Library/Caches/cc.carpio.espansoConfig.probe
drwxr-xr-x@  3 ccarpio  staff  96 Jul 31 23:33 ~/Library/WebKit/cc.carpio.espansoConfigProbe
drwxr-xr-x@  3 ccarpio  staff  96 Jul 31 23:33 ~/Library/Caches/cc.carpio.espansoConfigProbe
```

Per-launch `cc.carpio.espansoConfig.probe.<launch>`: **156** under `~/Library/WebKit/` and **156**
under `~/Library/Caches/`, the same names in both (`diff` of the two listings empty). By prefix: `G1`
10, `G2` 20, `G3` 28, `G4` 13, `G5` 19, `R38` 18, `K2` 42, and one each of `K2-S1`-`K2-S3` and
`S7-L01`-`S7-L03` — exactly the manifest's figures.

After: the four named directories `No such file or directory`; the glob
`cc.carpio.espansoConfig.probe.*` matches nothing in either directory.

---

## 2. §4.6 — checked and reported, not deleted

```
drwxr-xr-x@ 3 ccarpio  staff     96 Jul 31 14:47 ~/Library/WebKit/cc.carpio.espansoConfig
drwxr-xr-x@ 3 ccarpio  staff     96 Jul 31 14:47 ~/Library/Caches/cc.carpio.espansoConfig
-rw-r--r--  1 ccarpio  wheel      0 Sep 21 23:38 /private/tmp/espanso.err
-rw-r--r--  1 ccarpio  wheel  16438 Sep 23 19:46 /private/tmp/espanso.out
drwxr-xr-x@ 3 ccarpio  staff     96 Jul 31 08:07 ~/Library/WebKit/espansoconfig
drwxr-xr-x@ 3 ccarpio  staff     96 Jul 31 08:07 ~/Library/Caches/espansoconfig
```

All six are unchanged from the manifest. **New fact:** `lsof` shows `/private/tmp/espanso.out` and
`/private/tmp/espanso.err` held open by three running `espanso` processes. They are the espanso
daemon's own output files, not this project's, and must not be deleted. The shipped identifier's pair
and the lower-case `espansoconfig` pair stay the owner's to decide. `~/Library/Caches/espanso` also
exists; it is espanso's own and not in any manifest.

## 3. §4.7 — untouched

`/private/tmp/9aprobe` is still present (`drwxr-xr-x@ 3 … Sep 23 04:08`), and the per-step
`/private/tmp/2d7-*` scratch was not touched.

## 4. The `"permissions": []` comment (2d-6 split §7 item 7)

The doc comment on `register()` in `src-tauri/src/main.rs` said `capabilities/default.json` "stays at
`"permissions": []`" and that "the empty permission list … stays exactly as narrow". That has been
false since 2d-5-7a: the file grants `core:event:allow-listen` and `core:event:allow-unlisten`. The
comment now states that the capability grants exactly those two, why (Tauri's `listen` and its
unlisten function invoke the plugin commands `plugin:event|listen` and `plugin:event|unlisten`), that
none of the seventeen application commands needs a permission, that no menu permission is granted,
and that `dispatch_check.rs` drives the application commands and both event-plugin commands through
the real dispatcher with the shipped capability. Checked against `src-tauri/capabilities/default.json`
and `src-tauri/src/dispatch_check.rs`. Comment only; no code changed.

## 5. Records and instruction edits

- **`CLAUDE.md` §6 *Window readings*:** the bullet naming the instrument's paths and hook lines as
  present is replaced by one stating that the tree holds no window-reading instrument, pointing here,
  and that a later reading builds a new instrument under its own review and never commits it. The
  `localStorage` bullet no longer says "probe bundles". The two host facts (occluded-window `setTimeout`
  stop, LaunchServices dropping `--env`; `localStorage` keyed by bundle identifier) are kept. No
  instrument fact (`pause`'s cap, keep-alive) was added, per entry 32; this answers the split notes'
  §7 row "`CLAUDE.md` §6 to gain `pause` and keep-alive" by not adding them.
- **`2d-7-split-notes.md` §7:** the row "Each activation costs one drain" now reads "Each activation
  costs one drain per event, so two when the window was also hidden", the correction 2d-7-10 §6 item 6
  recorded and deferred.

## 6. Gates, harness-free

Every command exited 0; output was redirected to files and read from them.

| Gate | Result |
|---|---|
| `cargo build --workspace` | exit 0 |
| `cargo test --workspace -- --test-threads=1` (`/private/tmp/2d8-cargo.log`) | exit 0; **1323 passed**, 0 failed, 0 ignored, 26 result lines |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo fmt --check` | exit 0 |
| `npm run check` | exit 0; **461 files**, 0 errors, 0 warnings |
| `npm test` | exit 0; 72 files, **3546 passed** |
| `npm run build` | exit 0; **200 modules** transformed |
| `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/` | no match — server-only tokens **absent** |
| `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/` | `index-BGFCvVMD.js:2` — client-only tokens **present** |
| `cargo tree -p espansoconfig-core \| rg tauri` | no match |

The rung is **`1323 / 461 / 3546 / 200`**, exactly the expected harness-free rung (the 2d-7-10 tree
`1330 / 462 / 3547 / 201` minus the instrument's measured share `7 / 1 / 1 / 1`), and equal to the
pristine `c5fed6b` measurement.

**Residue sweep:** no match for `register_with_probe`, `startProbe`, `mod probe`, `probe.rs`,
`probe.ts`, `HARNESS_ROOT` or `espansoconfig-harness` in `src/`, `src-tauri/`, `scripts/`,
`vite.config.ts`, `package.json` or `tsconfig.json`; the built bundle contains no `probe` string.
`git status --short --untracked-files=all` shows only `CLAUDE.md`, `docs/decisions/2d-7-split-notes.md`,
`src-tauri/src/main.rs`, this file, and the orchestrator's `PROGRESS.json`.

## 7. Carried forward, unchanged

**`docs/decisions/2d-7-10-notes.md` §5, rows CF-1 … CF-55, is carried forward in full and
unchanged.** 2d-8 does not copy, shrink, reclassify or close any row. Every row stays what that
section says it is — *permanently unread by a window harness* (or constructed, disclosed, or a
ruling owed to the owner), with the missing plan capability it names and "no phase named" where it
says so. In particular CF-1 … CF-6 (the pathname rebindings) end with the binary and the tree, and
that ending is **not** a proof that they were closed. A later phase that wants any row builds the named
capability on a new, reviewed instrument.

## 8. Open items noticed, not fixed

1. **`PROGRESS.md`'s *READ FIRST* note** still describes the four instrument paths as present; it is
   the orchestrator's to rewrite to present state.
2. **CF-1 … CF-4 cite "(`probe.rs` header)"** as their source. That file no longer exists anywhere,
   including the reviewed copy, and it was never committed, so the header text is no longer
   recoverable. The rows stand as records. Records only, no action taken.
3. **§4.6's shipped-identifier and lower-case `espansoconfig` WebKit/Caches pairs** remain, of
   unestablished origin; deleting them is the owner's call.
