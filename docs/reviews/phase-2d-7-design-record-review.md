Reviewer: autoclaude adversarial reviewer

Phase 2d-7-design. Subject: `docs/decisions/2d-7-split-notes.md`. Everything here is a document, so each finding is corrected in place.

## Blockers
None.

## Should-fix
1. **Entry 6 contradicts entries 3 and 2d-7-5 (lines 415-416 against 221-222 and 390-391).** Entry 6 says that if the blocker fixes need more than one session, "The next step prunes further and does not re-review". The next step is 2d-7-5. It is "Records only. The instrument is frozen", and it refuses to read on any hash mismatch. A further prune changes the hashes, so 2d-7-5 cannot read. It also puts unreviewed instrument bytes under the "reviewed set". Say where that prune goes and how its hashes get recorded, or drop the escape.
2. **2d-7-3's acceptance cannot pass as written (lines 163-164).** The rule `rg -n "save_document|…" src-tauri/src/probe.rs` "finds nothing" already fails on `probe.rs:56` (`//! \`espansoconfig_core::persist::save_document\` stays the only entry point…`). A worker would have to delete a safety doc comment to pass. Restrict the check to non-comment lines or to call sites.
3. **Entry 15's command reconciliation is wrong for probe commands (lines 516-518).** Entry 11 tallies probe commands separately in Rust. The page never records a name that is in `PROBE_OWN_COMMANDS` (`probe.ts:552-554`). So every listed probe command is always Rust > page by name. A probe name *missing* from the page's list makes the page record it, which gives equality or page > Rust, not "Rust > page" as the cause claims. Reconcile the application half only, or define the probe half separately.
4. **The cutting rule conflicts with "exactly one" instrument review (lines 78-82 against entry 6 and entry 35).** 2d-7-4 is the largest step: spy, tally lines, heartbeat, prune, selectors, `launch-7.sh`, the CGEvent tool, five shakedowns and a 14-item checklist. It is the likeliest to be cut. Cut pieces are step-phases, and each would owe its own review under entry 35. That makes two instrument reviews, or leaves one piece unreviewed. State how the rule applies to 2d-7-4.
5. **Entry 21 relies on a row that does not exist (line 586).** It sets "the `PROGRESS.json` row for 2d-7-9" to `blocked`. `PROGRESS.json` has a single `"2d-7"` row (line 732). The record never says who creates the ten step rows, or their risk classes, before a driven run selects any of them.
6. **Entry 12 classifies writes with data the witness does not collect (lines 478-484).** The "identical" and "transient" classes use "the same final SHA-256". The witness as specified reports only path, inode, size, mtime and ctime. Either add a hash (read-only) or restate the classes.

## Minor
- Entry 7 item 12 and §5.11 name only `App.svelte`'s graph. `main.ts:15-19` (bootstrap, errors, menu, locale store) also evaluate before `./probe`. Only the wording is affected, because the reconciliation check catches either case.

## Checked and held
- Tauri 2.11.5: `invoke_handler`, `setup` and `on_page_load` replace rather than add; `Invoke.message` is public; `command()` exists.
- `core.js:22`, `:39-41` and `:63-66`; `event.js:76-79` sends `handler: transformCallback`.
- `probe.rs`: line 647 reads `SNAPSHOT_PATH` late, `set_permissions` is at 929, `:751`, 29 = 17+12 commands.
- `commands.rs:1940` `begin_commit`; `observationTransitions.ts:130-140`; `workspace.svelte.ts:4650-4661`; `main.ts` import order; `events.rs` is 71 lines.
- 2d-7-9's driven stop and 2d-7-10's wait on it are coherent. The review policy smuggles in no second review. The never-commit rule and stage-by-path are consistent. No real-corpus content appears. The PROGRESS.md handed-on items are mapped.

## Not verified
- I sampled about 30 of the 154 audit rows, not all of them.
- I did not re-run `cargo fmt --check`.
- Entry 13's "no listener before installation" holds only if installation happens on the first `on_page_load` callback (Started), not on a Finished filter. The record does not say which. I did not check macOS runtime ordering.
