# Phase 2c-4a step 3c-1 — the conflict instrument

Step 3c is the window reading 2c-4a-3 owes for six write surfaces. **This step is not that reading**;
it builds the instrument and proves, from a running WKWebView, that a **true `SaveResult::Conflict`**
can be provoked by a second writer that is an external filesystem process. 3c-2 takes the reading.

**The recipe works.** Demonstrated on three surfaces, in both languages, by two independent routes,
with no launch writing anything to disk. That closes the hole `2c-3c-3-window-reading.md` §12.4
recorded — *"the `conflict` outcome was not provoked"* — for the editor, the mover and the duplicator.

## 1. The harness, and where each file is

| File | What it is |
|---|---|
| `src/probe.ts` | the whole driver: the plans, the DOM walk, the transcript. **Temporary** |
| `src-tauri/src/probe.rs` | `probe_plan`, `render_probe`, `probe_second_writer`, `register_with_probe`. **Temporary** |
| `src/main.ts` | two hooks: `import { startProbe }` and `startProbe()` after the mount |
| `src-tauri/src/main.rs` | two hooks: `mod probe;` and `main()` calling `probe::register_with_probe` |
| `<scratch>/launch.sh` | one launch: seeds the config, assembles a fresh bundle, launches, waits for `--- end`, byte-checks |
| `<scratch>/launches/<name>/` | per launch: `xdg/`, `xdg-before/`, `espansoConfig.app`, `probe.log`, `probe.err`, `bytes.txt` |

`<scratch>` is
`/private/tmp/claude-501/-Users-ccarpio-Developer-espansoConfig/5297a7df-1f6e-4dca-8b0a-f02a92f3b872/scratchpad`,
outside the repository. **The owner's real configuration was never opened**: `XDG_CONFIG_HOME` points
at a synthetic three-snippet tree rebuilt per launch and `HOME` at an empty directory, so neither
candidate `resolve_config_dir()` probes can reach it.

## 2. The launch recipe, verbatim

```sh
# once, and IN THIS ORDER — see §5.1
npm run build
cargo build -p espansoconfig --features custom-protocol

# per launch
./launch.sh <surface>:<language>[:external] <name>
```

which does, per launch, into a bundle path never used before:

```sh
open --env "ECFG_PROBE_PLAN=$PLAN" \
     --env "ECFG_PROBE_TARGET=$XDG/espanso/match/conflict.yml" \
     --env "ECFG_PROBE_COMMENT=# a second writer reached this file" \
     --env "XDG_CONFIG_HOME=$XDG" --env "HOME=$LAUNCH/home" \
     --stdout "$LAUNCH/probe.log" --stderr "$LAUNCH/probe.err" \
     "$LAUNCH/espansoConfig.app"
```

Plans: `editorconflict`, `moverconflict`, `duplicatorconflict`, each `:en` or `:es`, optionally
`:external`. Every plan sets the language **through the picker** first and prints the resulting
`documentElement.lang`; every control is reached by `HTMLElement.click()`; every element is reported
with its own `getBoundingClientRect()`.

## 3. The launches

| # | Plan | Lang | Purpose | Result |
|---|---|---|---|---|
| L01 | `editorconflict:en` | en | the authored-text surface | **conflict** |
| L02 | `moverconflict:en` | en | the operation-choice surface | **conflict** |
| L03 | `editorconflict:en:external` | en | the same, by a writer the app never spawned | **conflict** |
| L04 | `moverconflict:es` | es | the Spanish twin | **conflict** |
| L05 | `editorconflict:en` | en | straight after a Spanish launch, to check the picker beats the leaked `localStorage` override | **conflict**, in English |
| L06 | `duplicatorconflict:en` | — | **the instrument was wrong** (§5.1): a stale embedded `dist`, so the plan name was unknown. Reached `--- end`, wrote nothing, taught §5.1 |
| L07 | `duplicatorconflict:en` | en | the corrected launch | **conflict** |

**All seven reached their own `--- end` and all seven `probe.err` files were zero bytes.**

## 4. What the transcripts showed

The same three revisions in every conflicting launch — `expected` at R0, `found` and `diskRevision` at
R1, with `expected ≠ found`, which is a real locked-read mismatch and not an identity refusal:

```
L01 editor outcome: conflict      panel box=658,720,491x1044
    This snippet was loaded from version 50a2bbc3…
    The file held version ba98da75… when the save was refused.
    The version read from disk afterwards is ba98da75…
    buttons: [Keep editing 83x23] [Copy my text 87x23] [Load the version on disk 147x23]
L02 mover outcome: conflict       panel box=658,469,491x684   50a2bbc3… / ba98da75… / ba98da75…
    buttons: [Keep editing 83x23] [Load the version on disk 147x23]
L07 duplicator outcome: conflict  panel box=658,328,491x684   50a2bbc3… / ba98da75… / ba98da75…
    buttons: [Keep editing 83x23] [Load the version on disk 147x23]
```

Three things a transcript settled that were arguments before. **The conflict arm's own existence
proves nothing re-read the document in between** — a re-read would have moved the Rust cache to R1,
and `view_at` would then have rejected the session's frozen R0 base with `identityStaleRevision`, a
*send failed* panel and never a conflict; no extra instrumentation could add to that, and none was
built. **`CONFLICT_CAPABILITIES` is visible in the roll of controls**: the editor draws three choices
and the two operation-choice surfaces draw two, so *Copy my text* is absent exactly where
`draftKind: 'operationChoice'` says it must be. And **consult Q7 point 6 holds on a screen** — the
duplicator's ordinary `DuplicateKeepsTriggerDefinition` acknowledgement did **not** appear first.

**The bytes.** Every tree was compared whole against a pristine copy taken before its launch. In every
conflicting launch the only difference was the external writer's own line — `304 → 340 bytes`,
`12a13 > # a second writer reached this file` — and **no `.espansoconfig-backups` directory existed at
all**, the strongest available statement that the transaction never reached its write.

## 5. What the next worker must not re-derive

**5.1 `npm run build` alone changes nothing — the bundle embeds `dist` at *cargo* build time.** L06 is
that mistake, made and recorded: rebuilding only the frontend ran the previous bundle's JavaScript and
answered `unknown plan`. `cargo build -p espansoconfig --features custom-protocol` must follow every
`npm run build`, and **`touch src-tauri/build.rs` first** — cargo did not otherwise notice `dist/`.

**5.2 The second writer is spawned inside the plan, not scheduled by wall clock.**
`probe_second_writer` runs `/bin/sh -c 'printf … >> "$ECFG_PROBE_TARGET"'` and waits for it to exit.
It touches no `Workspace`, no parse and no cache, so it is a second *writer* and not a second
*caller*. Spawning it inside the plan makes the ordering a fact: a `sleep`-scheduled writer races the
webview's start-up, and losing that race silently opens the surface at R1, where no conflict is
possible and the transcript merely looks uninteresting. The `:external` route exists for anyone who
doubts a child process is external enough — the probe prints `--- writer-now`, a process the launch
script started watches for it, appends, and the probe waits 1 800 ms before submitting. **L03 produced
the identical conflict.** Prefer `spawn`: the plan then finishes ~1.4 s after mount rather than ~3.2 s,
well clear of the six-second `setTimeout` cliff.

**5.3 The probe registers its commands beside the shipped list, not inside it.**
`probe::register_with_probe` calls `crate::register` and then replaces the handler, leaving
`main.rs`'s own `generate_handler![…]` untouched — which matters because
`wire_contract::registered_commands()` parses that list textually. **`cargo test -p espansoconfig`
passes with the harness in the tree** because of that one arrangement; do not "simplify" it.

**5.4 The picker beats the leaked override, and the leak is real.** L04 (es) and L05 (en, immediately
after, fresh bundle path, fresh `HOME`) confirm `2c-2-2-window-reading.md` §1.2 again: the WebKit data
store follows the **bundle identifier**, which every probe bundle shares.

**5.5 Three surfaces are proven and three are not.** `RawEditor`, `MatchCreator` and `MatchDeleter`
were **not driven**; nothing suggests they differ — raw save has no `view_at` and goes straight to the
same locked check — but no transcript says so, and consult Q7's points 1, 3 and 4 remain claims. Each
is a short plan on `duplicatorConflict`'s pattern; the deleter needs its confirmation press first.

**5.6 The conflict panel is drawn below the fold in an unscrolled pane.** L01's editor panel is at
`y = 720` in a 728 px viewport and is 1 044 px tall — a reading finding for 3c-2, not an instrument
problem, but a plan reporting only what is inside the viewport would report an empty panel.
`reportPanel` measures rectangles and does not filter by visibility; keep it that way.

## 6. The gates, with the harness in the tree

```
npm test               46 files, 1427 tests, all passing
npm run check          413 files, 0 errors, 0 warnings
npm run build          173 modules
cargo build --workspace / cargo fmt --check / clippy --all-targets -D warnings   all ok
cargo test -p espansoconfig      149 passed, 0 failed
```

**173 is 172 plus `src/probe.ts`** — the "moved by exactly the number of new source modules" shape
CLAUDE.md names, not the `resolve.conditions` regression; it returns to 172 when the probe is deleted.
No git command that changes anything was run, and no scratch path is inside the repository.
