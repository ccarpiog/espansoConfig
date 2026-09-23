# Phase 2d-7-10 — the consolidation (notes)

**Date:** 2026-09-23.
**Spec:** [`2d-7-split-notes.md`](2d-7-split-notes.md) §2 *2d-7-10*, bound by §3 entries **5** (baselines
by subtraction from a pristine `git archive HEAD` copy), **32** (the 2d-8 manifest, as corrected by
§5.14), **33** (the carried-forward list), **35** (one review), **36** (drift corrected by the step that
owns the document) and **37** (the owner's standing ruling). Corrections owed here: §5.4 and §5.5.
**Risk:** `routine`. **Driven:** yes (2d-7-9 closed on 2026-09-23, so entry 21's first exit is taken).
**Records only.** This file, one row of
[`2d-6-window-readings-consolidated.md`](2d-6-window-readings-consolidated.md) §5.4, and one path in
`CLAUDE.md` §6. **No launch was made and no window was opened.** No tracked source changed. The
instrument and the harness were not edited. No real-config file was opened, copied, quoted or used.

The owner's standing ruling binds this step, verbatim (record §3 entry 37):

> For the rest of 2d-7, any row the frozen instrument cannot read is recorded unread and hadnded to 2d-7-9 and 2d-7-10.

**What this step ran:**
- `ls -ld` over every manifest path (§4);
- the four gates and `cargo fmt --check` / clippy on the working tree, and the four gates again on a
  pristine `git archive HEAD` copy (§8);
- `/private/tmp/2d7-6-1-hashcheck.sh`;
- one scratch script, `/private/tmp/2d7-10-es-inventory.cjs`. It reads the out-of-app checkers' outputs
  from 2d-7-6-1, 2d-7-6-2, 2d-7-7 and 2d-7-8 and `src/lib/i18n/es.json`, and writes to stdout only.

It re-derived no transcript line. Every class below is the class the cited step's notes give, and a
row 2d-7-9 revisited carries 2d-7-9's class. Where a row was read only in part, the unread half is
carried as unread.

---

## 1. Terms

- **Standing** (the records' words): **read**; **read in part** (the unread half is named and carried
  forward); **unread** (no launch drew it; the missing plan capability is named); **named unreachable**
  (entry 23, never attempted).
- **Entry-17 class** of what was drawn: ***reached*** (real disk, real answers), ***held*** (`delay`
  only), ***constructed*** (a content-changing substitution; never credited as reached), or — when
  nothing was drawn.
- **Launch**: the launch names that carry the reading, or **none**.
- **S5** (2d-7-4-2 §9.5, 2d-7-5 §9): no per-action no-write claim is made on a retained plan. A
  whole-launch `writes=0` or tree diff is a labelled observation, never an entry-16 witness.
- **Visual claims.** 2d-7-5 and 2d-7-6-1 ran under a locked screen, so every visual claim of theirs is
  unread (entry 18). 2d-7-6-2, 2d-7-7 and 2d-7-8 ran unlocked and visible at their sampled instants,
  but each looked at one capture only. The visual claims left over are H8 (§2.4, G5).

---

## 2. The 2d-7 matrix

Three families, each row exactly once in its family. The families overlap by subject, so a row in §2.1
or §2.2 names the G rows that carry its evidence and does not re-class them.

### 2.1 Item 7's clauses (`docs/reviews/phase-2d-design.md:130`)

| # | Clause | Standing | Launch | Evidence and the unread half |
|---|---|---|---|---|
| I1 | "Rebuild the removed harness only after its own review" | **met, as replaced** | none (`K2-*` shakedowns) | Replaced by entry 1 (§5.2): adopt, prune and review once. The single instrument review was 2d-7-4-2's; the reviewed set is `/private/tmp/2d7-instrument-reviewed/`, and `summary ok=18 diff=0` held at every 2d-7 reading and here (§8.3). A matching hash proves the bytes are the reviewed bytes, not that the review was right (entry 3) |
| I2 | The four probe-writer pathname rebindings, inherited "open and accepted, never closed" | **carried** | none | Still open, in their present words (`probe.rs` header). The fifth is closed for the final component only; the sixth is narrowed and disclosed (2d-7-3 §2). All go to the carried-forward list (§5.1) |
| I3 | A Rust command counter and a frontend invoke/event spy, so unchanged bytes separate zero writes from an identical or transient write | **met** (instrument), **used in part** | every 2d-7 launch | Built at 2d-7-3 and 2d-7-4-2 (entries 11-15). Every 2d-7-5 … 2d-7-9 launch reconciled `equal(except-plugin:event)` with `probe-half=ok`. The **per-action** half that the clause is for stayed unread on every retained plan (S5). Only G1 rows 1-3 carry per-action spans (§2.4) |
| I4 | Short fresh-bundle launches with the language selected explicitly | **met** | every 2d-7 launch | One plan per launch, on a fresh bundle path and identifier, with the language set through the picker (each notes file's §2 and §4) |
| I5 | Real external writes under both roots | **read** | `G1-01` | = G1 row 1 |
| I6 | 150–300 ms burst coalescing and stable final content | **read in part** | `G1-02`, `G1-08`, `G1-03`, `G1-09` | = G1 rows 2 and 3, read at two points (60 ms: one emit; 600 ms: two). **Unread:** the 150–300 ms boundary itself. The engine owns it, and entry 24 forbids claiming it |
| I7 | Self-save suppression | **read in part** | `G1-07` | = G1 row 4 (no emit and no drain after two own commits). **Unread:** the row's own acceptance, one save inside its own span (H1) |
| I8 | Raw-view automatic refresh | **read in part** | `G1-04` | = G1 row 5 (the refresh, read in the DOM). **Unread:** its per-action no-write claim (S5) and every visual claim |
| I9 | Every open write surface retaining its draft, request or candidate | **read in part** | `G2-01` … `G2-08`, `G2-11` … `G2-18` | = G2 row a |
| I10 | Compare, copy, keep, reload and recovery | **read in part** | `G3-*`; `G2-01`/`G2-11` for copy | = G3 rows a and b |
| I11 | `installed`, `alreadyThere`, `refused`, and committed-but-reprojection-failed, where reachable | **read in part** | `G3-03` … `G3-05`, `G3-17` … `G3-19` | = G3 rows c-f: `installed` read; `alreadyThere` and `refused` unread; committed-but-reprojection-failed named unreachable |
| I12 | Enabled-state plus disabled-state conflict timing | **read in part** | `G2-*` | = G2 rows b and c |
| I13 | True Tab/default activation and representative pointer hit-testing | **unread** | none | = G5 rows 2 and 3 |
| I14 | Workspace reopen with a late old callback | **unread** | `G1-05` (the reopen alone) | = G1 row 7 |
| I15 | Add and remove | **read in part** | `G1-05`, `G1-06` | = G1 rows 6a and 6b |
| I16 | English and Spanish | **read** (as a reading) | every ES twin | The two steps that compared their EN and ES key sets found them equal (2d-7-6-1: 115 = 115; 2d-7-6-2: 116 = 116), and the out-of-app checkers found 0 problems in every step that ran them. §3 is the ES inventory. **Not** R35's bilingual review, which stays open (entry 25) |
| I17 | Command count zero on every no-write path | **read in part** | G1 rows 1-3; every launch as an observation | The per-action form (entry 16) was read only on G1 rows 1-3. Everywhere else the no-write claim is **unread** (S5), and the whole-launch `rust-writes=0` lines are labelled observations |
| I18 | "Any unreachable inherited state is named as unreachable, not silently credited" | **met** | none | Named up front: committed-but-reprojection-failed (G3 row f), the 9b-1 §8.3 sequence (G4 row 11), and "general wake delivery" and "the full native matrix" (entry 23). The open-surface refusal was not pre-credited (§5.8; G3 row g) |

### 2.2 Consolidated §5.1 — the readings owed

| # | Owed | Standing | Launch | Evidence and the unread half |
|---|---|---|---|---|
| 5.1-1 | A visible-window reading | **read in part** | `G3-*`, `R38-*`, `G4-*` (unlocked and visible at the sampled instants); `G5-01` … `G5-19` (owner present) | The owner's visual judgements (G5 row 6) and 28 identical visible re-take pairs (G5 row 7). **Unread:** every visual claim of 2d-7-5 … 2d-7-8 not put to the owner (H8). The unlocked driven steps each looked at one capture only |
| 5.1-2 | A visible-window foreground reading: real foregrounding; `focus`/`visibilitychange` and a drain; resume after an occlusion stop; one task or two | **read in part** | `G5-02`, `G5-04`, `G5-05`, `G5-06` | = G5 row 1. Read: both events arrive, and each costs one drain (two drains, not coalesced). **Unread:** whether the two run in one task (the page prints no task boundary). **Did not arise:** resume after a stop, because no occlusion stopped the beats. The owner's Dock click came after 8.8-9.8 s, not more than 10 s |
| 5.1-3 | The native watcher matrix, real wake and resume delivery, and R38's window half | **read in part** | `G1-01` … `G1-10`; `R38-01` … `R38-18` | Read: the wake, observed per launch (emitted = delivered at all 31 G1 checkpoints, G1 row 8), and R38's viewer half for all fifteen fixtures (§2.4, R38). **Named unclaimable:** "general wake delivery" and "the full native matrix" (entry 23). **Unread:** resume delivery, and R38's panel/refresh half (H15) |
| 5.1-4 | The copy under a real gesture | **unread** | none | = G5 row 4 (H12) |
| 5.1-5 | Real input generally: keyboard reach, focus order, a real mouse | **unread** | none | = G5 rows 2 and 3. The input tool was never exercised, and Accessibility was never requested |

### 2.3 Consolidated §5.2 — the states named unread, by reading

One line per state. §5.2's own rows are split into their states.

| # | From | State | Standing | Launch | Evidence and the unread half |
|---|---|---|---|---|---|
| 5.2-6c2-a | 6c-2 | The save-arm host beside a recovery form's external arm | **unread** | none | No 2d-7 plan draws a save-arm conflict with a recovery form beside it. `external-recovery` draws the host editor's **external** arm (`G3-01`/`G3-15`) |
| 5.2-6c2-b | 6c-2 | Mounted scenarios 4–6 | **unread** (window) | none | The mounted suites carry them (consolidated §5.2's owner) |
| 5.2-7c-a | 7c | The deleter's *Delete it* disabled under a held reading | **unread** | none | No frozen plan arms `delay` on an operation's send (2d-7-6-1 §3 clause 3) |
| 5.2-7c-b | 7c | `supersededConflict` (`browser.reapply.supersededConflict`, the reapply refusal) | **unread** | none | Never drawn: no checker attributed the key. The conflict's own supersession at the reload's second step was read (`--- superseded <surface>`, `G3-03` … `G3-06`, 2d-7-6-2 reading §2.2), but it is not this sentence |
| 5.2-7c-c | 7c | `noCorrespondence` | **unread** | none | No 2d-7 transcript is cited for it |
| 5.2-7c-d | 7c | The `writeOutcomeUnknown` withholding on the operation panels | **unread** | none | `mayHaveWritten` is armed only on `save_raw_document` and `save_match` (G4 row 3) |
| 5.2-7c-e | 7c | `refusedSave` on the operation panels | **unread** | none | The two save-race plans cover the raw editor and restore only (`G3-12`/`13`/`26`/`27`) |
| 5.2-7c-f | 7c | The locale switch keeping the session (operation) | **unread** | none | = G2 row d, operation family (H7) |
| 5.2-7c-g | 7c | The deleter, the duplicator, the untouched mover and any send over the hard fixture | **read in part** | `G3-03` … `G3-06`, `G3-17` … `G3-20` | Compare, keep (two arms) and the two-step reload were read on all three over hard LF, plus the untouched mover. **Unread:** hard CRLF on these panels (2d-7-4-2 §8 item 8), and any operation send, so the seam refusals stay unexercised |
| 5.2-8c-a | 8c | Raw's notices under *Save*: `observationRetained` | **read** (held) | `G2-09`, `G2-19`, `G4-02`, `G4-10` | Drawn during the held save with the raw editor open, with the retry disabled by `writeInFlight` (2d-7-8 reading §3). Whether it sat under *Save* is a placement the transcripts name as the pane's, not a pixel claim |
| 5.2-8c-b | 8c | Raw's notices under *Save*: `writeOutcomeUnknown` | **constructed** | `G4-03`, `G4-11` | Under `mayHaveWritten`. Never credited as reached (entry 17); carried as constructed (§5.3) |
| 5.2-8c-c | 8c | Restore's notice beside its refusal | **unread** | none | No plan holds or substitutes restore's send |
| 5.2-8c-d | 8c | The no-candidate reload-unavailable sentence | **unread** | none | `reloadUnavailable` appears only in `expect=absent` lines (2d-7-6-2 reading §4) |
| 5.2-8c-e | 8c | *Copy my text* | **unread** | none | = G5 row 4 (H12) |
| 5.2-8c-f | 8c | The reload's `alreadyThere` and `refused` arms | **unread** | none | = G3 rows d and e |
| 5.2-8c-g | 8c | The locale switch beyond raw at one step | **read in part** | `G2-10`, `G2-20`; `G3-08`, `G3-22` | Raw, both directions, reached. **Unread:** restore and every other surface (H7) |
| 5.2-9c | 9c | Its eleven unread states | see G4 | — | Each is a G4 row: rows 1-10 and 13 (§2.4) |
| 5.2-10-a | 10 | The `visibilitychange` arm in a window | **read** | `G5-02` | Fired on hide and on show; one drain on show, none on hide (H14) |
| 5.2-10-b | 10 | The hidden-state refusal in a window | **unread** | none | No plan attempts an action while hidden and prints its answer (H14) |
| 5.2-5-7b-a | 5-7b | Whether WKWebView fires `pagehide`/`unload` on quit | **read in part** | `G5-07` | ⌘Q ended the process with **no** page-lifecycle line. **Unread:** "not fired" against "not flushed", which this instrument cannot separate (`say()` is an IPC round trip) |
| 5.2-5-7b-b | 5-7b | The watermark's advance | **read** | `G1-01`, `-02`/`-08`, `-03`, `-04`, `-05` | = G1 row 9 |

### 2.4 The G rows

**G1 — delivery, watcher and counters** (2d-7-5 §3; handed rows re-classed by 2d-7-9 §3b)

| # | Row | Standing | Class | Launch | Evidence and the unread half |
|---|---|---|---|---|---|
| G1-1 | Both roots, by the script writer | **read** | reached | `G1-01` | Per-root spans `writes=0 emitted+=1 delivered+=1`, each witness `unchanged(except <that file>:as-written=yes)` |
| G1-2 | Burst, three writes 60 ms apart | **read** | reached | `G1-02`, `G1-08` | One emit and one drain at the writer's final hash |
| G1-3 | Control, two writes 600 ms apart | **read** | reached | `G1-03`, `G1-09` | Two emits and two drains. No boundary claim |
| G1-4 | Self-save suppression | **read in part** | reached | `G1-07` | No emit, no delivery and no drain after two own commits. **Unread** (H1): tally 1, one inode change, 2 s of drains, in a span holding one save |
| G1-5 | Raw-view automatic refresh | **read in part** | reached | `G1-04` | The refresh, read in the DOM and byte-equal out of app. **Unread:** the per-action no-write claim (S5) and every visual claim |
| G1-6a | Add and remove, probe writers | **read in part** | reached | `G1-05`, `G1-06` | An unreadable add and both removals, observed. **Unread:** the no-write claims (S5) and a readable add (H2) |
| G1-6b | Add and remove, script under `config/` | **unread** | — | none | H3 |
| G1-7 | Workspace reopen with a late old callback, under `delay` | **unread** | — | `G1-05` (the reopen alone) | H4. The reopen was observed; the late callback was not constructed |
| G1-8 | Emits against deliveries at every checkpoint | **read** | reached | all ten | 31 `--- reconcile` lines, emitted = delivered at every one |
| G1-9 | The watermark's advance | **read** | reached | `G1-01`, `-02`/`-08`, `-03`, `-04`, `-05` | +1 per observation; one sequence for a coalesced burst; reset under `epoch=2` |

**G2 — surface retention and conflict timing** (2d-7-6-1 §3, §3a, §7; the owner's ruling in §3a)

| # | Row | Standing | Class | Launch | Evidence and the unread half |
|---|---|---|---|---|---|
| G2-a | Retention on the eight surfaces, `writes=0` with an unchanged witness | **read in part** | reached | `G2-01` … `G2-08`, `G2-11` … `G2-18` | The retained value read in the DOM on seven surfaces in both languages; raw and restore also byte-exact out of app. **Unread:** the per-action witness on all eight (H5), and the recovery form's own field values (H6). Clause NOT MET, recorded unread by the owner's ruling (2d-7-6-1 §3a) |
| G2-b | Disabled-state timing | **read in part** | held | `G2-09`, `G2-19` | The raw editor under a held save: the held sentence, the disabled controls, the panel after the release. **Unread:** whether the panel existed during the hold; restore; the authored-text and operation families |
| G2-c | Enabled-state timing | **read in part** | reached | the eight retention launches | Operation (all three) and whole file (both) were read. **Unread:** the editor's and the recovery form's send state before the writer, and an enabled creator send |
| G2-d | The locale switch per family | **read in part** | reached | `G2-10`, `G2-20` | Raw, both directions. **Unread:** restore, and the authored-text and operation families (H7). Clause NOT MET, recorded unread by the owner's ruling |

**G3 — choices and adoption arms** (2d-7-6-2 §3, §3b, §7)

| # | Row | Standing | Class | Launch | Evidence and the unread half |
|---|---|---|---|---|---|
| G3-a | Compare, keep, reload (two steps) and recovery on each family | **read in part** | reached | `G3-01` … `G3-14`, `G3-15` … `G3-28` | Operation (hard LF only): compare, keep (two arms) and the reload read; recovery read as refused. Whole file: compare and the reload (reseed, retarget) read, LF and CRLF. Authored text (recovery on the plain set): compare, keep (manual-resolution arm) and recovery read. **Unread:** the authored-text reload (H10); *Keep editing* / *Leave this as it is* on every family (H11); the recovery form's own choices (H13). Clause NOT MET, recorded unread by the owner's ruling |
| G3-b | Copy, pressed by `click()` and recorded as whatever it reads | **read in part** | reached | `G2-01`, `G2-11` | `draftCopyFailed` drawn after the `click()` copy (2d-7-6-1 §7 item 3, cited by 2d-7-6-2 as corroboration only, because its own `external-editor` runs were refused by host clipboard state). **Unread:** raw's *Copy my text* (no plan), and the copy under a real gesture (H12) |
| G3-c | The reload's `installed` arm | **read** | reached | `G3-03` … `G3-05`, `G3-17` … `G3-19` | Credited from `browser.notice.differentMatch`, which in the source only the installing branch produces. That is a reading of the source, not a transcript line (2d-7-6-2 reading §4). keep1's adoption is `installed` or `alreadyThere`, not distinguished |
| G3-d | `alreadyThere` | **unread** | — | none | No plan reaches it. In these plans the confirm issued no command, so a `delay` on `reload_document` would not hold it (2d-7-6-2 §7 item 2) |
| G3-e | `refused` | **unread** | — | none | As G3-d |
| G3-f | Committed-but-reprojection-failed | **named unreachable** | — | none | Entry 23 |
| G3-g | The open-surface refusal | **unread** | — | `G3-14`, `G3-28` | Every `--- restore` line reads `competing=0`, so it is not credited (§5.8) |

**G4 — the status states 9c left unread** (2d-7-8 §3; handed rows re-classed by 2d-7-9 §3b)

| # | Row | Standing | Class | Launch | Missing plan capability / evidence |
|---|---|---|---|---|---|
| G4-1 | The retry enabled and pressed, after `probe_lock_other`, then restored | **unread** | — | `G4-01` (lock half); `G5-18`/`19` re-drew it | H16. See §6.1 item 2: the consult's premise does not match the code |
| G4-2 | `stale` from a `Named` pending row | **unread** | — | none | H17 |
| G4-3 | Six of the eight panels' acknowledgements | **unread** | — | none | H18 |
| G4-4 | A refused acknowledgement press | **unread** | — | none | H19 |
| G4-5 | Empty-workspace retention | **unread** | — | none | H20 |
| G4-6 | `projectionReplaced` reactivity | **unread** | — | none | H21 |
| G4-7 | The outlived route acknowledgement and its exits note | **unread** | — | none | H22 |
| G4-8 | `pathDrift.changed` | **unread** | — | `G4-06` (other arms); `G5-14`/`15` | H23 |
| G4-9 | The two surface notes | **unread** | — | `G4-02`, `G4-10` (absent) | H24 |
| G4-10 | `noTransport` | **unread** | — | `G4-05`, `G4-12` drew `rejected`, which is constructed and not credited | H25. See §6.1 item 1 |
| G4-11 | The 9b-1 §8.3 release-path sequence | **named unreachable** | — | none | Entry 23; 9b-1's own judgement |
| G4-12 | `stale` behind a panel alone | **read** | held | `G4-02`, `G4-10` | Corroborated, not credited, by the constructed `G4-03`/`G4-11` |
| G4-13 | 9b-3 §6 item 1 and its §8 recheck | **unread** | — | `G4-04` (context, constructed) | H26 |
| G4-14 | The `visibilitychange` arm, the hidden-state refusal, `pagehide`/`unload` on quit | **read in part** | reached | `G5-02`, `G5-07` | H14: the arm read, and the quit read as "no line". **Unread:** the hidden-state refusal, and "not fired" against "not flushed" |

**G5 — owner present, unlocked, visible** (2d-7-9 §3a)

| # | Row | Standing | Class | Launch | Evidence and the unread half |
|---|---|---|---|---|---|
| G5-1 | Foreground | **read in part** | reached | `G5-02`, `G5-04`, `G5-05`, `G5-06` | Read, but the premise did not hold (no occlusion stopped the beats). **Unread:** one task or two. **Did not arise:** resume after a stop, and more than 10 s of occlusion before the Dock click |
| G5-2 | Tab and default activation | **unread** | — | none | A plan printing `isTrusted` and `document.activeElement` per key event and waiting for the owner's or the input tool's Tab and Enter |
| G5-3 | Pointer hit-testing | **unread** | — | none | A plan listening for `pointerdown`/`click`, printing `isTrusted` and the target, and waiting for a real click |
| G5-4 | *Copy my text*, pasted into TextEdit | **unread** | — | none | An owner-wait plan over the raw editor's panel. For the authored-text copy, the host clipboard must hold plain text or nothing |
| G5-5 | ⌘Q with `pagehide`/`unload` | **read in part** | reached | `G5-07` | Read as "no page-lifecycle line". **Unread:** fired against flushed (2d-7-9 classes the row read; this matrix carries the indistinguishable half as unread) |
| G5-6 | Visual judgements, EN and ES at 1180x728 | **read in part** | reached | `G5-08` … `G5-13`, `G5-16` … `G5-19` | The owner: the fold (the delete panel's row below it), the marker, the ES row mark, the labels. **Unread in a visible launch:** the fixed disabled status control. A model's look at 2d-7-8 page snapshots saw it muted; that is not a visible claim |
| G5-7 | One visible re-take per family against its twin | **read** | reached | `G5-08` … `G5-14`, `G5-16` … `G5-18` | 28 pairs, 0 differing pixels. The twins were driven unlocked launches, not hidden ones (2d-7-9 §6 item 5) |

**R38 — the fifteen fixtures** (2d-7-7 §3, §3b; not a consult G group, listed so the matrix is whole)

| # | Row | Standing | Class | Launch | Evidence and the unread half |
|---|---|---|---|---|---|
| R38-a | Four SHA-256 values per fixture, source = copy | **read** | reached | `R38-01` … `R38-18` | All four equal in all 18 launches |
| R38-b | The viewer's text compared verbatim against the bytes, out of app | **read** | reached | `R38-01` … `R38-15` | Eleven exact; `bom-utf8.yml` exact after its one marker; the CRLF-bearing fixtures exact except that each CRLF draws as one break, which the DOM cannot separate (2d-7-7 §7 item 2) |
| R38-c | Each fixture's panel or refresh line, and `writes=0` | **unread** | — | none | H15: fifteen successor fixtures and a plan that writes one by name, then reads the refresh and the panel. `writes=0` stands only as a whole-launch observation (S5) |
| R38-d | Three fixtures in ES | **read** | reached | `R38-16`, `R38-17`, `R38-18` | `crlf-line-endings.yml`, `unicode-offsets.yml`, `file-comments-and-mixed-endings.yml` |

**Tally over §2.4's 46 rows** (10 G1, 4 G2, 7 G3, 14 G4, 7 G5, 4 R38): **read 11** · **read in part 13**
· **unread 20** · **named unreachable 2**. Of the drawn rows, one is *held* throughout (G4-12) and one
in part (G2-b); no G row is credited from a *constructed* state. The constructed readings are carried
in §5.3.

---

## 3. The ES sentence inventory (entry 25; R35's input)

**What this is.** Every dictionary key that 2d-7's out-of-app checkers attributed to text drawn in
Spanish, with its `es.json` value and the launches that drew it. **No review of the Spanish was
performed** (entry 25). R35 stays open, owed by the owner before Phase 5.

**How it was drawn** (`/private/tmp/2d7-10-es-inventory.cjs`):
- `attribution <tag> [es] keys=[…]` lines of the `verbatim-9c` outputs of 2d-7-6-1 (`G2-*`), 2d-7-6-2
  (`G3-*`) and 2d-7-8 (`G4-*`);
- `sentence <tag> [es] <key> expect=present disk-dictionary=VERBATIM` lines of 2d-7-7 (`R38-*`) and 2d-7-8;
- `<tag> <key> VERBATIM` lines of 2d-7-6-1's `verbatim.cjs` runs on the ES twins `G2-11` … `G2-13`.

**Limits, stated because each could be assumed:**
- **The text column is the `es.json` value, not a copy of pixels.** The checkers matched the drawn DOM
  text against that value verbatim, with placeholders (`{revision}`, `{path}`, …) filled at draw time.
  A value shown here with a placeholder was drawn with the placeholder filled.
- `a \| b` marks keys whose Spanish values are identical, so the checker could not tell which one drew
  the text. Seven keys appear both alone and inside such a group (E24 in E25, E53 and E122 in E123,
  E58 and E105 in E59, E61 in E62, E99 in E100); they are listed as the checker printed them.
- `G2-10` and `G3-08` are EN-named launches of `external-raw-cr`, which switches to ES mid-plan. Their
  `[es]` lines are Spanish text.
- **Not covered:** 2d-7-5 ran EN only. 2d-7-9 ran no checker; its ES re-takes were pixel-identical to
  their twins (G5-7). Sentences only the unread rows would draw (§5.2) were drawn in neither language.
- 145 lines. Every key resolves in `es.json`. E13's key is printed by the checker as
  `browser.detail.section.fileText(uppercased)`; the text is that key's value, drawn upper-cased by
  the stylesheet.

| # | Key (checker's attribution) | Spanish text (`es.json`) | Launches |
|---|---|---|---|
| E1 | `browser.conflictOrigin.changedWhileOpen` | Lo que se compara aquí viene de la vigilancia del archivo: cambió en el disco mientras esto estaba abierto. No se ha iniciado ningún guardado como respuesta a esta observación, así que desde aquí no se ha escrito nada como respuesta a ella, y esta aplicación no puede decir qué cambió el archivo ni cuándo. | `G2-10`, `G2-11`, `G2-12`, `G2-13`, `G2-14`, `G2-15`, `G2-16`, `G2-17`, `G2-18`, `G2-19`, `G2-20`, `G3-08`, `G3-15`, `G3-16`, `G3-17`, `G3-18`, `G3-19`, `G3-20`, `G3-21`, `G3-22`, `G3-23`, `G3-24`, `G3-25`, `G4-10`, `G4-11` |
| E2 | `browser.conflictOrigin.refusedSave` | Lo que se compara aquí viene de un guardado que intentó esta aplicación: el archivo ya había cambiado desde que su texto se cargó aquí, así que la escritura se rechazó bajo el bloqueo del propio archivo. | `G3-26`, `G3-27` |
| E3 | `browser.detail.empty` | Selecciona un fragmento para verlo aquí. | `G2-14`, `G2-15`, `G2-16`, `G3-17`, `G3-18`, `G3-19` |
| E4 | `browser.detail.field.label` | Etiqueta | `G2-11`, `G2-13`, `G3-15` |
| E5 | `browser.detail.field.leftWord` | Límite por la izquierda | `G2-11`, `G2-13`, `G3-15` |
| E6 | `browser.detail.field.replace` \| `code.contentKind.replace` | Texto de sustitución | `G2-11`, `G2-12`, `G2-13`, `G3-15`, `G3-16` |
| E7 | `browser.detail.field.rightWord` | Límite por la derecha | `G2-11`, `G2-13`, `G3-15` |
| E8 | `browser.detail.field.word` | Palabra completa | `G2-11`, `G2-13`, `G3-15` |
| E9 | `browser.detail.file` | Archivo | `G2-10`, `G2-14`, `G2-15`, `G2-16`, `G2-17`, `G2-19`, `G3-08`, `G3-17`, `G3-18`, `G3-19`, `G3-20`, `G3-21`, `G4-10`, `G4-11` |
| E10 | `browser.detail.fileTextAsWritten` | se muestra aquí desde el primer carácter del archivo hasta el último: los caracteres que no dibujan nada se nombran y cada final de línea se dibuja como un solo salto de línea | `R38-16`, `R38-17`, `R38-18` |
| E11 | `browser.detail.fileTextScope` | Esto es el archivo en sí, no los fragmentos que se leen de él. | `R38-16`, `R38-17`, `R38-18` |
| E12 | `browser.detail.fileTextShow` | Mostrar el texto de este archivo | `G2-14`, `G2-15`, `G2-16`, `G3-17`, `G3-18`, `G3-19` |
| E13 | `browser.detail.section.fileText(uppercased)` | Texto del archivo (drawn upper-cased by the stylesheet) | `R38-16`, `R38-17`, `R38-18` |
| E14 | `browser.detail.section.trigger` \| `browser.detail.field.trigger` | Disparador | `G2-11`, `G2-12`, `G2-13`, `G2-14`, `G2-15`, `G2-16`, `G3-15`, `G3-16`, `G3-17`, `G3-18`, `G3-19`, `G3-20` |
| E15 | `browser.externalConflict.action.acknowledgeSnapshot` | He revisado esta instantánea | `G4-04`, `G4-11` |
| E16 | `browser.externalConflict.action.retry` | Comprobar ahora el cambio observado | `G2-19`, `G4-10` |
| E17 | `browser.externalConflict.affectedFile` | El archivo al que se refiere este cambio: {path} | `G2-12`, `G2-13`, `G3-15`, `G3-16` |
| E18 | `browser.externalConflict.destinationRequired` | Este formulario todavía no indica ningún archivo, así que la única forma de seguir desde este cambio es elegir el archivo en el que va. No se ha elegido ninguno por ti, y ni cargar la versión del disco ni conservar tu borrador se ofrecen hasta que se elija un archivo. | `G2-12`, `G3-16` |
| E19 | `browser.externalConflict.fileChangedWhileOpen` | Este archivo ha cambiado en el disco mientras este panel estaba abierto. No se ha iniciado ningún guardado como respuesta a esta observación, y esta aplicación no puede decir qué cambió el archivo ni cuándo. | `G2-10`, `G2-11`, `G2-12`, `G2-13`, `G2-14`, `G2-15`, `G2-16`, `G2-17`, `G2-18`, `G2-19`, `G2-20`, `G3-08`, `G3-15`, `G3-16`, `G3-17`, `G3-18`, `G3-19`, `G3-20`, `G3-21`, `G3-22`, `G3-23`, `G3-24`, `G3-25`, `G4-10`, `G4-11` |
| E20 | `browser.externalConflict.observationRetained` | Un cambio observado está a la espera de comprobarse frente al estado de esta ventana. | `G2-19`, `G4-10` |
| E21 | `browser.externalConflict.revisionObserved` | La versión leída del disco cuando se observó este cambio es {revision}. | `G2-10`, `G2-11`, `G2-12`, `G2-13`, `G2-14`, `G2-15`, `G2-16`, `G2-17`, `G2-18`, `G2-19`, `G2-20`, `G3-08`, `G3-15`, `G3-16`, `G3-17`, `G3-18`, `G3-19`, `G3-20`, `G3-21`, `G3-22`, `G3-23`, `G3-24`, `G3-25`, `G4-10`, `G4-11` |
| E22 | `browser.externalConflict.route.writeOutcomeUnknown` | Se desconoce el resultado de una escritura anterior en este archivo, y el panel desde el que se hizo se ha cerrado. Mientras siga así, un cambio observado en el disco no se carga en esta ventana por su cuenta. | `G4-04` |
| E23 | `browser.externalConflict.writeOutcomeUnknown` | Se desconoce el resultado de la escritura anterior. Revisar esta instantánea del disco no permite establecer si esa escritura llegó a completarse. | `G4-11` |
| E24 | `browser.externalDocument.action.reread` | Volver a leer este archivo | `G4-04`, `G4-13` |
| E25 | `browser.externalDocument.action.reread` \| `browser.matchMove.recovery.reloadFile` \| `browser.matchDuplication.recovery.reloadFile` | Volver a leer este archivo | `G4-04`, `G4-13` |
| E26 | `browser.externalDocument.row.stale` | Sin conciliar | `G2-19`, `G4-04`, `G4-10`, `G4-13` |
| E27 | `browser.externalDocument.stale` | Lo que esta ventana muestra de este archivo no se ha conciliado con el archivo del disco. | `G2-19`, `G4-04`, `G4-10`, `G4-11`, `G4-13` |
| E28 | `browser.matchCreation.cannotCreate.noDestination` | Elige el archivo al que debe añadirse este fragmento. | `G2-12`, `G3-16` |
| E29 | `browser.matchCreation.create` | Añadir este fragmento | `G2-12`, `G3-16` |
| E30 | `browser.matchCreation.open` | Añadir un fragmento | `G2-14`, `G2-15`, `G2-16`, `G3-17`, `G3-18`, `G3-19` |
| E31 | `browser.matchDeletion.cancel` | Conservarlo | `G2-14`, `G3-17` |
| E32 | `browser.matchDeletion.close` \| `browser.matchDuplication.close` | Dejarlo estar | `G2-14`, `G2-16`, `G3-17`, `G3-19` |
| E33 | `browser.matchDeletion.confirm` | Eliminarlo | `G2-14`, `G3-17` |
| E34 | `browser.matchDeletion.label` | Eliminación de un fragmento | `G2-14`, `G3-17` |
| E35 | `browser.matchDeletion.question` | ¿Eliminar este fragmento del archivo? Se escribe en el disco de inmediato y esta aplicación no puede recuperarlo después. | `G2-14`, `G3-17` |
| E36 | `browser.matchDeletion.reloadIdentifiesNoSnippet` | Esta aplicación no va a adivinar qué fragmento de la versión del disco es el que pediste borrar. Vuelve a abrir el fragmento desde la lista después. | `G2-14`, `G3-17` |
| E37 | `browser.matchDeletion.request` | Eliminar este fragmento | `G2-14`, `G3-17` |
| E38 | `browser.matchDuplication.duplicate` | Duplicar este fragmento | `G2-16`, `G3-19` |
| E39 | `browser.matchDuplication.label` | Duplicado de un fragmento | `G2-16`, `G3-19` |
| E40 | `browser.matchDuplication.landsAfterSource` | La copia se escribe inmediatamente después de este fragmento, en la misma lista, tal como lo escribe el archivo. No hay ningún sitio que elegir. | `G2-16`, `G3-19` |
| E41 | `browser.matchDuplication.reloadIdentifiesNoSnippet` | Esta aplicación no va a adivinar qué fragmento de la versión del disco es el que pediste copiar. Vuelve a abrir el fragmento desde la lista después. | `G2-16`, `G3-19` |
| E42 | `browser.matchMove.cannotMove.alreadyThere` | Aquí es donde el archivo ya escribe este fragmento. Elige otro sitio para él. | `G3-20` |
| E43 | `browser.matchMove.close` | Dejarlo donde está | `G2-15`, `G3-18`, `G3-20` |
| E44 | `browser.matchMove.destination` | Adónde debe ir | `G2-15`, `G3-18`, `G3-20` |
| E45 | `browser.matchMove.label` | Traslado de un fragmento | `G2-15`, `G3-18`, `G3-20` |
| E46 | `browser.matchMove.move` | Mover este fragmento | `G2-15`, `G3-18`, `G3-20` |
| E47 | `browser.matchMove.reloadDropsPositionalDestination` | El destino que elegiste no se conserva: nombra una posición de la lista de fragmentos de este archivo tal y como la leyó esta ventana. Vuelve a elegir un destino desde la lista después. | `G2-15`, `G3-18` |
| E48 | `browser.matchMove.withinThisFile` | Un fragmento se mueve dentro de la lista en la que ya está, así que todos los sitios que se ofrecen aquí están en {file}. Los fragmentos de otros archivos no son destinos posibles. | `G2-15`, `G3-18`, `G3-20` |
| E49 | `browser.notice.differentMatch` | Este archivo ha cambiado en el disco y lo que ahora ocupa esa posición ya no está escrito como estaba el fragmento que tenías seleccionado, así que se ha borrado la selección. Puede ser ese mismo fragmento con cambios, o uno distinto: espansoConfig compara el texto y no puede saberlo. | `G2-14`, `G2-15`, `G2-16`, `G3-17`, `G3-18`, `G3-19` |
| E50 | `browser.notice.dismiss` | Descartar | `G2-14`, `G2-15`, `G2-16`, `G2-18`, `G3-17`, `G3-18`, `G3-19`, `G3-23`, `G3-24` |
| E51 | `browser.rawEditor.close` \| `browser.matchEditor.close` | Dejar de editar | `G2-10`, `G2-17`, `G2-19`, `G3-08`, `G3-21`, `G4-10`, `G4-11` |
| E52 | `browser.rawEditor.diskLineEndingsNotPreserved` | La versión del disco usa retornos de carro en sus saltos de línea, y este editor no puede devolverlos exactamente como están. En lugar de reescribir todos los saltos de línea del archivo sin que nadie lo pida, no cargará esa versión en este editor. Tu texto sigue intacto y el archivo no se escribe en ningún caso. | `G2-10`, `G2-20`, `G3-08`, `G3-22` |
| E53 | `browser.rawEditor.diskVersion` | La versión del disco | `G2-10`, `G2-17`, `G2-20`, `G3-08`, `G3-21`, `G3-22` |
| E54 | `browser.rawEditor.lineEndingsNotPreserved` | Este archivo usa retornos de carro en sus saltos de línea, y este editor no puede devolverlos exactamente como están. En lugar de reescribir todos los saltos de línea del archivo sin que nadie lo pida, no abrirá este archivo para editarlo. | `R38-16`, `R38-18` |
| E55 | `browser.rawEditor.mayHaveWritten` | El guardado no ha terminado, y esta aplicación no puede saber si se ha escrito el archivo. Lo que hay en el disco puede ser el texto de abajo o puede ser lo que había antes. Tu texto sigue aquí; mira el archivo antes de volver a guardar. | `G4-11` |
| E56 | `browser.rawEditor.open` | Editar el texto de este archivo | `R38-17` |
| E57 | `browser.rawEditor.redo` \| `browser.matchEditor.redo` \| `browser.matchCreation.redo` \| `browser.recovery.redo` \| `menu.redo` | Rehacer | `G2-10`, `G2-12`, `G2-13`, `G2-17`, `G2-19`, `G3-08`, `G3-15`, `G3-16`, `G3-21`, `G4-10`, `G4-11` |
| E58 | `browser.rawEditor.revisionDisk` | La versión leída del disco después es {revision}. | `G3-26` |
| E59 | `browser.rawEditor.revisionDisk` \| `browser.matchEditor.revisionDisk` \| `browser.matchCreation.revisionDisk` \| `browser.recovery.revisionDisk` \| `browser.matchDeletion.revisionDisk` \| `browser.matchMove.revisionDisk` \| `browser.matchDuplication.revisionDisk` \| `browser.restore.revisionDisk` | La versión leída del disco después es {revision}. | `G3-26`, `G3-27` |
| E60 | `browser.rawEditor.revisionExpected` | Tu texto se cargó desde la versión {revision}. | `G3-26` |
| E61 | `browser.rawEditor.revisionFound` | El archivo tenía la versión {revision} cuando se rechazó el guardado. | `G3-26` |
| E62 | `browser.rawEditor.revisionFound` \| `browser.matchEditor.revisionFound` \| `browser.matchCreation.revisionFound` \| `browser.recovery.revisionFound` \| `browser.matchDeletion.revisionFound` \| `browser.matchMove.revisionFound` \| `browser.matchDuplication.revisionFound` | El archivo tenía la versión {revision} cuando se rechazó el guardado. | `G3-26` |
| E63 | `browser.rawEditor.save` | Guardar este archivo | `G2-10`, `G2-17`, `G2-19`, `G3-08`, `G3-21`, `G4-10`, `G4-11` |
| E64 | `browser.rawEditor.saving` \| `browser.matchEditor.saving` | Guardando… | `G2-19`, `G4-10` |
| E65 | `browser.rawEditor.savingCannotBeStopped` \| `browser.matchEditor.savingCannotBeStopped` | Este guardado no se puede detener, así que el editor sigue abierto hasta que responda. | `G2-19`, `G4-10` |
| E66 | `browser.rawEditor.undo` \| `browser.matchEditor.undo` \| `browser.matchCreation.undo` \| `browser.recovery.undo` \| `menu.undo` | Deshacer | `G2-10`, `G2-12`, `G2-13`, `G2-17`, `G2-19`, `G3-08`, `G3-15`, `G3-16`, `G3-21`, `G4-10`, `G4-11` |
| E67 | `browser.rawEditor.unsaved` \| `browser.matchEditor.unsaved` | Cambios sin guardar | `G2-17`, `G2-19`, `G3-21`, `G4-10`, `G4-11` |
| E68 | `browser.rawSave.choice.keepEditing` | Seguir editando | `G2-10`, `G2-11`, `G2-12`, `G2-13`, `G2-17`, `G2-19`, `G2-20`, `G3-08`, `G3-15`, `G3-16`, `G3-21`, `G3-22`, `G3-26`, `G4-10`, `G4-11` |
| E69 | `browser.rawSave.replacesWholeDocument` | Al guardar se escribe todo el texto de este archivo tal y como aparece aquí. No es una edición de un fragmento: se reemplaza el documento entero. | `G2-10`, `G2-17`, `G2-19`, `G3-08`, `G3-21`, `G4-10`, `G4-11` |
| E70 | `browser.reapply.externalEvidence.baseRevisionMoved` | La correspondencia que traía esa lectura se calculó a partir de una versión de este archivo distinta de aquella desde la que empezaste, así que no dice nada sobre lo que has conservado. Este intento de reaplicar no ha escrito nada. | `G2-14`, `G2-15`, `G2-16`, `G3-17`, `G3-18`, `G3-19` |
| E71 | `browser.reapply.manualResolution` | espansoConfig no ha aplicado nada. Este intento de reaplicar no ha escrito nada, esta ventana no se ha movido y lo que conservaste sigue aquí exactamente igual. El motivo es el siguiente. | `G2-14`, `G2-15`, `G2-16`, `G3-17`, `G3-18`, `G3-19` |
| E72 | `browser.reapply.ready` | espansoConfig intentará aplicar los cambios que has conservado a la versión de este archivo en disco que se muestra arriba, partiendo de ese documento recién analizado. No se escribe nada si el fragmento al que se refiere este cambio, o alguno de los campos que has modificado, no se puede emparejar con seguridad. Si se pueden emparejar con seguridad, esto puede terminar con que la versión en disco ya contenga los cambios que pediste y no quede nada por enviar, o con un formulario por enviar: ese guardado todavía puede rechazarse, o encontrarse con otro cambio del archivo y volver a entrar en conflicto. Termine como termine, se te dirá, y no se escribe nada hasta que envíes algo. | `G2-11`, `G2-12`, `G2-13`, `G3-15`, `G3-16` |
| E73 | `browser.reapply.readyOperation` | espansoConfig intentará aplicar la acción que has solicitado a la versión de este archivo en disco que se muestra arriba, partiendo de ese documento recién analizado. No se escribe nada si el fragmento al que se refiere esta acción, o la posición que necesita, no se puede emparejar con seguridad. Si se pueden emparejar con seguridad, esto puede terminar con que la versión en disco ya contenga el resultado que pediste y no quede nada por enviar, o con la acción de nuevo preparada sobre esa versión para que la envíes: ese guardado todavía puede rechazarse, o encontrarse con otro cambio del archivo y volver a entrar en conflicto. Termine como termine, se te dirá, y no se escribe nada hasta que envíes algo. | `G2-14`, `G2-15`, `G2-16`, `G3-17`, `G3-18`, `G3-19` |
| E74 | `browser.reapply.reapplied` | Esta ventana muestra ahora la versión en disco, con lo que conservaste preparado sobre ella. Este intento de reaplicar no ha escrito nada: envíalo cuando quieras, y ese guardado todavía puede rechazarse o entrar en conflicto. | `G2-14`, `G2-15`, `G2-16`, `G3-17`, `G3-18`, `G3-19` |
| E75 | `browser.reconciliation.refusal.uncertaintyUnresolved` | Se desconoce el resultado de una escritura anterior en este archivo y no se ha reconocido. | `G4-04` |
| E76 | `browser.reconciliation.refusal.writeInFlight` | Todavía hay una escritura en curso en un archivo. Esto estará disponible cuando termine. | `G2-19`, `G4-10` |
| E77 | `browser.reconciliation.registrationFailed.rejected` | Esta ventana no pudo suscribirse a los avisos de cambios, así que no se le avisa cuando un archivo cambia en el disco. | `G4-12` |
| E78 | `browser.reconciliation.route.snapshot` | La instantánea del disco a la que se refiere este reconocimiento: | `G4-04` |
| E79 | `browser.recovery.create` | Crear este fragmento | `G2-13`, `G3-15` |
| E80 | `browser.recovery.unavailable.operationDraft` | Lo que pediste aquí es una acción sobre un fragmento y no un texto que escribieras, así que no hay nada con lo que crear un fragmento nuevo. Carga la versión en disco, elige un fragmento en ella y vuelve a pedirlo. | `G2-14`, `G2-15`, `G2-16`, `G2-18`, `G3-17`, `G3-18`, `G3-19`, `G3-20`, `G3-23`, `G3-24`, `G3-25` |
| E81 | `browser.recovery.unavailable.wholeDocumentDraft` | Lo que tienes aquí es un archivo entero y no un fragmento, así que no hay nada con lo que crear un fragmento nuevo. Sigue editando, copia tu texto, compáralo con la versión en disco o carga esa versión. | `G2-17`, `G3-21` |
| E82 | `browser.restore.batchesHeading` | Lotes de copias reconocidos | `G2-18`, `G3-23`, `G3-24`, `G3-25` |
| E83 | `browser.restore.batchNamed` | Lote de copias llamado {name} | `G2-18`, `G3-23`, `G3-24`, `G3-25` |
| E84 | `browser.restore.batchOrder` | Se listan primero el nombre más nuevo. El nombre de un lote es una etiqueta de carpeta con la forma que escribe esta aplicación, hecha a partir de una lectura del reloj, con un número detrás que separa las carpetas etiquetadas igual. Reconocer la forma de una etiqueta no es saber qué escribió la carpeta, y la etiqueta no es un registro de cuándo se escribió este archivo ni de lo que tenía. | `G2-18`, `G3-23`, `G3-24`, `G3-25` |
| E85 | `browser.restore.cancel` | No sustituir este archivo | `G2-18`, `G3-23`, `G3-24` |
| E86 | `browser.restore.candidateExact` | Esto es lo que se escribiría, byte a byte tal como se leyó. Un carácter que ninguna tipografía dibuja se escribe abajo con su nombre; el texto en sí no se toca. | `G2-18`, `G3-23`, `G3-24` |
| E87 | `browser.restore.candidateHeading` | El texto que se escribiría | `G2-18`, `G3-23`, `G3-24` |
| E88 | `browser.restore.candidateMeasured` | {bytes} bytes de UTF-8 y {characters} caracteres según los cuenta Unicode. Los dos se han contado aquí, a partir del texto que se leyó. | `G2-18`, `G3-23`, `G3-24` |
| E89 | `browser.restore.close` | Cerrar | `G2-18`, `G3-23`, `G3-24`, `G3-25` |
| E90 | `browser.restore.confirm` | Sustituir el archivo entero por el texto mostrado | `G2-18`, `G3-23`, `G3-24` |
| E91 | `browser.restore.confirmBinding` | Esta pregunta es sobre este archivo, esta entrada, este texto exacto y la lectura de este archivo que esta ventana conserva ahora. Si cambia cualquiera de ellos, se vuelve a preguntar. | `G2-18`, `G3-23`, `G3-24` |
| E92 | `browser.restore.destination` | Esto sustituiría | `G2-18`, `G3-23`, `G3-24`, `G3-25` |
| E93 | `browser.restore.entriesHeading` | Entradas del lote de copias elegido | `G2-18`, `G3-23`, `G3-24`, `G3-25` |
| E94 | `browser.restore.entriesSkipped` | Cosas de dentro de este lote que no son entradas que ofrezca: | `G2-18`, `G3-23`, `G3-24`, `G3-25` |
| E95 | `browser.restore.entryIsAName` | Lo que se dice junto a cada entrada es lo que dice su propio nombre sobre dónde encaja. No es una comprobación de que la entrada tenga una copia de este archivo. Elegir una le pide a esta aplicación que la lea, y la lectura se rechaza salvo que ese lote tenga la entrada con el nombre calculado para este archivo. | `G2-18`, `G3-23`, `G3-24`, `G3-25` |
| E96 | `browser.restore.listedAgrees` | Al listar esta entrada se anotó el mismo número de bytes. | `G2-18`, `G3-23`, `G3-24` |
| E97 | `browser.restore.loadedHeading` | Lo que esta ventana cargó de este archivo | `G2-18`, `G3-23`, `G3-24`, `G3-25` |
| E98 | `browser.restore.loadedObservation` | Este es el texto que esta ventana leyó para este archivo la última vez que lo cargó. Es la observación de esta ventana, no una lectura hecha ahora, así que no tiene por qué ser lo que el archivo tiene. Aquí no se compara con el texto de arriba. | `G2-18`, `G3-23`, `G3-24`, `G3-25` |
| E99 | `browser.restore.open` | Sustituir el texto de este archivo por el de una entrada de copia | `R38-16`, `R38-17`, `R38-18` |
| E100 | `browser.restore.open` \| `browser.restore.label` | Sustituir el texto de este archivo por el de una entrada de copia | `G2-18`, `G3-23`, `G3-24`, `G3-25`, `R38-16`, `R38-17`, `R38-18` |
| E101 | `browser.restore.prepare` | Preparar la sustitución del archivo | `G2-18`, `G3-23`, `G3-24`, `G3-25` |
| E102 | `browser.restore.question` | ¿Sustituir todo el texto de este archivo por el texto que se muestra arriba? | `G2-18`, `G3-23`, `G3-24` |
| E103 | `browser.restore.relistBatches` | Volver a listarlos | `G2-18`, `G3-23`, `G3-24`, `G3-25` |
| E104 | `browser.restore.replaced` | Este intento escribió este archivo entero. Cada fragmento suyo tiene ahora una identidad nueva, así que nada de lo que esta ventana conservaba sobre este archivo sigue valiendo: cierra esto y vuelve a abrir el archivo. | `G2-18`, `G3-23`, `G3-24` |
| E105 | `browser.restore.revisionDisk` | La versión leída del disco después es {revision}. | `G3-27` |
| E106 | `browser.restore.revisionExpected` | Esta sustitución se preparó frente a la versión {revision}. | `G3-27` |
| E107 | `browser.restore.revisionFound` | El archivo tenía la versión {revision} cuando se rechazó la escritura. | `G3-27` |
| E108 | `browser.restore.selectedBatch` | Lote de copias elegido aquí | `G2-18`, `G3-23`, `G3-24`, `G3-25` |
| E109 | `browser.restore.selectedEntry` | Entrada elegida aquí | `G2-18`, `G3-23`, `G3-24` |
| E110 | `browser.restore.warning` | Confirmar aquí abajo escribe este archivo entero. Todo lo que tiene ahora queda sobrescrito por exactamente el texto que se muestra aquí: no se combina nada y no se conserva nada de lo que el archivo tiene ahora. Además, cada fragmento de este archivo pasa a tener una identidad nueva, así que nada de lo que esta ventana conserva sobre él sigue valiendo. | `G2-18`, `G3-23`, `G3-24`, `G3-25` |
| E111 | `browser.saveOutcome.backupTaken` | Se ha guardado una copia de este archivo tal y como estaba antes del primer cambio de esta sesión. La retención se aplica según las etiquetas de las carpetas de sesión y puede fallar, así que esto no garantiza cuánto tiempo seguirá la copia ni que el archivo pueda recuperarse más adelante. | `G2-18`, `G3-23`, `G3-24` |
| E112 | `browser.saveOutcome.changedElsewhere` | Este archivo ha cambiado después de que su texto se cargara aquí, así que el guardado se ha rechazado en lugar de aplicarse encima de ese cambio. | `G3-26`, `G3-27` |
| E113 | `browser.saveOutcome.choice.confirmReload` | Descartar mi texto y cargarla | `G2-10`, `G2-17`, `G2-20`, `G3-08`, `G3-21`, `G3-22` |
| E114 | `browser.saveOutcome.choice.confirmReloadClosing` | Cerrar esto y cargarla | `G2-14`, `G2-15`, `G2-16`, `G3-17`, `G3-18`, `G3-19`, `G3-20` |
| E115 | `browser.saveOutcome.choice.confirmReloadRetargeting` | Cargarla y mantener aquí el texto elegido | `G2-18`, `G3-23`, `G3-24` |
| E116 | `browser.saveOutcome.choice.copyDraft` | Copiar mi texto | `G2-10`, `G2-11`, `G2-12`, `G2-13`, `G2-17`, `G2-19`, `G2-20`, `G3-08`, `G3-15`, `G3-16`, `G3-21`, `G3-22`, `G3-26`, `G4-10`, `G4-11` |
| E117 | `browser.saveOutcome.choice.keepMyDraft` | Conservar mi borrador | `G2-11`, `G2-12`, `G2-13`, `G3-15`, `G3-16` |
| E118 | `browser.saveOutcome.choice.keepMyRequest` | Conservar lo que he pedido | `G2-14`, `G2-15`, `G2-16`, `G3-17`, `G3-18`, `G3-19` |
| E119 | `browser.saveOutcome.choice.keepOperation` | Dejarlo como está | `G2-14`, `G2-15`, `G2-16`, `G2-18`, `G3-17`, `G3-18`, `G3-19`, `G3-20`, `G3-23`, `G3-24`, `G3-25`, `G3-27` |
| E120 | `browser.saveOutcome.choice.reloadDiskVersion` | Cargar la versión del disco | `G2-10`, `G2-11`, `G2-12`, `G2-13`, `G2-14`, `G2-15`, `G2-16`, `G2-17`, `G2-18`, `G2-19`, `G2-20`, `G3-08`, `G3-15`, `G3-16`, `G3-17`, `G3-18`, `G3-19`, `G3-20`, `G3-21`, `G3-22`, `G3-23`, `G3-24`, `G3-25`, `G3-26`, `G3-27`, `G4-10`, `G4-11` |
| E121 | `browser.saveOutcome.copyIsReference` | La copia es una referencia con etiquetas de lo que escribiste, campo por campo. No es YAML y no se puede pegar en un archivo de configuración. | `G2-11`, `G2-12`, `G2-13`, `G3-15`, `G3-16` |
| E122 | `browser.saveOutcome.diskVersion` | La versión del disco | `G2-11`, `G2-14`, `G2-15`, `G2-16`, `G2-18`, `G3-17`, `G3-18`, `G3-19`, `G3-20`, `G3-23`, `G3-24`, `G3-25` |
| E123 | `browser.saveOutcome.diskVersion` \| `browser.rawEditor.diskVersion` | La versión del disco | `G2-10`, `G2-11`, `G2-12`, `G2-13`, `G2-14`, `G2-15`, `G2-16`, `G2-17`, `G2-18`, `G2-19`, `G2-20`, `G3-08`, `G3-15`, `G3-16`, `G3-17`, `G3-18`, `G3-19`, `G3-20`, `G3-21`, `G3-22`, `G3-23`, `G3-24`, `G3-25`, `G3-26`, `G3-27`, `G4-10`, `G4-11` |
| E124 | `browser.saveOutcome.draftCopyFailed` | No se ha podido poner en el portapapeles lo que escribiste. Se sigue mostrando arriba, pero los caracteres que ninguna tipografía puede dibujar se escriben ahí por su nombre y no como tales, así que seleccionarlo a mano no siempre devuelve exactamente lo que escribiste. Cargar la versión del disco lo descarta de todas formas. | `G2-11` |
| E125 | `browser.saveOutcome.draftKeptInMemory` | Tu texto sigue aquí, exactamente como lo escribiste. No se ha descartado nada ni se ha vuelto a cargar nada. | `G2-10`, `G2-11`, `G2-12`, `G2-13`, `G2-17`, `G2-19`, `G2-20`, `G3-08`, `G3-15`, `G3-16`, `G3-21`, `G3-22`, `G3-26`, `G4-10`, `G4-11` |
| E126 | `browser.saveOutcome.field.setting` | se escribiría este texto | `G2-11`, `G2-12`, `G2-13`, `G3-15`, `G3-16` |
| E127 | `browser.saveOutcome.field.unchanged` | se deja tal y como lo tiene el archivo | `G2-11`, `G2-13`, `G3-15` |
| E128 | `browser.saveOutcome.fileWritten` | Se ha escrito el archivo. Lo que hay ahora en el disco es exactamente el texto que se envió. | `G2-18`, `G3-23`, `G3-24` |
| E129 | `browser.saveOutcome.nothingWasWritten` | No se ha escrito nada. El archivo del disco sigue exactamente igual. | `G3-26`, `G3-27` |
| E130 | `browser.saveOutcome.operation.deleteSnippet` | Pediste borrar este fragmento de este archivo. | `G2-14`, `G3-17` |
| E131 | `browser.saveOutcome.operation.duplicateSnippet` | Pediste copiar este fragmento en el mismo archivo, justo detrás de sí mismo. | `G2-16`, `G3-19` |
| E132 | `browser.saveOutcome.operation.moveToTop` | Pediste mover este fragmento al principio de la lista de fragmentos de este archivo. | `G2-15`, `G3-18` |
| E133 | `browser.saveOutcome.operation.replaceFileFromBackup` | Pediste sustituir todo el texto de este archivo por el texto de la entrada de copia de seguridad seleccionada aquí. | `G2-18`, `G3-23`, `G3-24`, `G3-25`, `G3-27` |
| E134 | `browser.saveOutcome.operationIdentityIsOld` | Este panel nombra el fragmento tal y como lo leyó esta ventana antes de que cambiara el archivo. Esta aplicación no busca un fragmento equivalente en la versión del disco, así que nada de lo que hay aquí dice qué contiene esa versión. | `G2-14`, `G2-15`, `G2-16`, `G3-17`, `G3-18`, `G3-19`, `G3-20` |
| E135 | `browser.saveOutcome.operationKeptInMemory` | Lo que pediste aquí sigue preparado, exactamente como lo dejaste. No se ha descartado nada ni se ha vuelto a cargar nada. | `G2-14`, `G2-15`, `G2-16`, `G2-18`, `G3-17`, `G3-18`, `G3-19`, `G3-20`, `G3-23`, `G3-24`, `G3-25`, `G3-27` |
| E136 | `browser.saveOutcome.reloadAbandonsOperation` | Cargar la versión del disco lleva esta ventana a ella y cierra este panel. Lo que pediste aquí no se lleva a cabo, y el archivo no se escribe en ninguno de los dos casos. | `G2-14`, `G2-15`, `G2-16`, `G3-17`, `G3-18`, `G3-19`, `G3-20` |
| E137 | `browser.saveOutcome.reloadClosesSurface` | Cargar la versión del disco lleva esta ventana a ella y cierra este panel. No se carga nada en lugar de lo que escribiste, lo que pediste aquí no se lleva a cabo y el archivo no se escribe en ninguno de los dos casos. Lo que escribiste no se podrá recuperar después, así que cópialo antes si quieres conservarlo. | `G2-11`, `G2-12`, `G2-13`, `G3-15`, `G3-16` |
| E138 | `browser.saveOutcome.reloadDiscardsDraft` | Cargar la versión del disco sustituye tu texto por ella, y después ya no se podrá recuperar. Cópialo antes si quieres conservarlo. | `G2-10`, `G2-17`, `G2-19`, `G2-20`, `G3-08`, `G3-21`, `G3-22`, `G3-26`, `G4-10`, `G4-11` |
| E139 | `browser.saveOutcome.reloadRetargetsCandidate` | Cargar la versión del disco lleva esta ventana a ella y deja este panel abierto con el mismo texto seleccionado aquí. No se descarta nada de lo seleccionado aquí, y el archivo no se escribe en ninguno de los dos casos. Tu confirmación queda retirada, porque la diste sobre la lectura que esta ventana tenía antes: tendrías que leer este texto frente a la versión recién cargada y confirmar otra vez. | `G2-18`, `G3-23`, `G3-24`, `G3-25`, `G3-27` |
| E140 | `browser.saveOutcome.retainedDraft` | Lo que escribiste, conservado aquí | `G2-11`, `G2-12`, `G2-13`, `G3-15`, `G3-16` |
| E141 | `browser.saveOutcome.retainedOperation` | Lo que pediste, conservado aquí | `G2-14`, `G2-15`, `G2-16`, `G2-18`, `G3-17`, `G3-18`, `G3-19`, `G3-23`, `G3-24`, `G3-25`, `G3-27` |
| E142 | `browser.source.invisible.carriageReturn` | retorno de carro {code} | `G2-10`, `G2-20`, `G3-08`, `G3-22`, `G3-24` |
| E143 | `code.backupRootState.present` | La carpeta de copias existe y se listó. | `G2-18`, `G3-23`, `G3-24`, `G3-25` |
| E144 | `code.backupTarget.inConfigRoot` | con el nombre de un archivo de dentro de tu carpeta de configuración | `G2-18`, `G3-23`, `G3-24`, `G3-25` |
| E145 | `code.entrySkipped.marker` | la entrada con el nombre que espansoConfig usa para la marca de propiedad de una carpeta de copias, que no es un archivo copiado | `G2-18`, `G3-23`, `G3-24`, `G3-25` |

---

## 4. The 2d-8 deletion manifest (entry 32 as corrected by §5.14), with `ls` evidence

Every line below is `ls -ld` output taken on 2026-09-23 at about 19:50. **No path was absent.** 2d-8
deletes the entries in §4.1-§4.5, reports §4.6 without deleting it, and leaves §4.7 alone.

### 4.1 The instrument in the repository

```
-rw-r--r--@  1 ccarpio  staff  100061 Sep 23 09:25 src-tauri/src/probe.rs
-rw-r--r--@  1 ccarpio  staff  251256 Sep 23 10:05 src/probe.ts
-rw-r--r--@  1 ccarpio  staff   15652 Sep 21 12:29 src-tauri/src/main.rs
-rw-r--r--@  1 ccarpio  staff    1652 Sep 21 12:29 src/main.ts
```

Only the two hook lines in each of `main.rs` and `main.ts` go. `git diff --stat src-tauri/src/main.rs
src/main.ts` reads `2 files changed, 5 insertions(+), 1 deletion(-)`. 2d-8 also corrects the
`main.rs:214-227` comment and rewrites `CLAUDE.md` §6's instrument bullet (entry 32).

### 4.2 The harness tree

```
drwxr-xr-x@ 15 ccarpio  wheel     480 Sep 23 09:13 /private/tmp/espansoconfig-harness-2d-6-6c-2
```

Its contents, `ls -ld` at the root:

```
drwxr-xr-x@  42 ccarpio  wheel   1344 Sep 23 09:02 fixtures
-rw-r--r--@   1 ccarpio  wheel   4914 Sep 23 09:01 fixtures-7.manifest
drwxr-xr-x@   3 ccarpio  wheel     96 Sep 23 08:58 fixtures-src
-rwxr-xr-x@   1 ccarpio  wheel   7915 Sep 23 06:23 launch-10.sh
-rwxr-xr-x@   1 ccarpio  wheel  40122 Sep 23 10:03 launch-7.sh
-rwxr-xr-x@   1 ccarpio  wheel   6213 Sep 23 02:08 launch-7c.sh
-rwxr-xr-x@   1 ccarpio  wheel   7277 Sep 23 03:24 launch-8c.sh
-rwxr-xr-x@   1 ccarpio  wheel   7062 Sep 23 05:57 launch-9c.sh
-rwxr-xr-x@   1 ccarpio  wheel   5522 Sep 23 00:18 launch.sh
drwxr-xr-x@ 273 ccarpio  wheel   8736 Sep 23 18:41 launches
-rw-r--r--@   1 ccarpio  wheel  22701 Sep 23 18:41 launches-7.ledger
-rwxr-xr-x@   1 ccarpio  wheel    381 Sep 23 05:53 run-9c.sh
drwxr-xr-x@  14 ccarpio  wheel    448 Sep 23 09:14 tools
```

`launches/` holds **271 entries**. By prefix: `G1` 10, `G2` 20, `G3` 28, `G4` 13, `G5` 19, `R38` 18,
`K2` 46, `P8` 21, `P9` 23, `S8` 11, `S9` 20, `S7-race` 6, `F10` 2, and one each of `H01`-`H05`,
`L01`-`L06`, `P01`-`P08`, `S01`-`S04`, `S7-L01`-`S7-L03`, `S7-requests`, `S7-writers`, `T01`-`T05` and
`verbatim.txt`. `tools/` holds `lockstate`, `pbstate`, `post-input` and `winid` (each with its
`.swift` source) and the four `verbatim*.cjs`. The 2d-5-7b harness, `/private/tmp/espansoconfig-harness-2d-5-7b/`,
is **absent** (`No such file or directory`), as consolidated §5.4 already recorded.

### 4.3 The eight probe-related pre-edit files

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

### 4.4 2d-7's own copies

```
-rw-r--r--@  1 ccarpio  wheel   39514 Sep 23 08:22 /private/tmp/2d7-3-probe.rs.orig
-rw-r--r--@  1 ccarpio  wheel  215138 Sep 23 09:20 /private/tmp/2d7-4-probe.ts.orig
drwxr-xr-x@  5 ccarpio  wheel     160 Sep 23 10:11 /private/tmp/2d7-instrument-reviewed
```

### 4.5 Probe WebKit and Caches data

```
drwxr-xr-x@  3 ccarpio  staff      96 Jul 31 17:04 /Users/ccarpio/Library/WebKit/cc.carpio.espansoConfig.probe
drwxr-xr-x@  3 ccarpio  staff      96 Jul 31 17:04 /Users/ccarpio/Library/Caches/cc.carpio.espansoConfig.probe
drwxr-xr-x@  3 ccarpio  staff      96 Jul 31 23:33 /Users/ccarpio/Library/WebKit/cc.carpio.espansoConfigProbe
drwxr-xr-x@  3 ccarpio  staff      96 Jul 31 23:33 /Users/ccarpio/Library/Caches/cc.carpio.espansoConfigProbe
```

The per-launch identifiers `cc.carpio.espansoConfig.probe.<launch>`: **156 directories under
`~/Library/WebKit/` and 156 under `~/Library/Caches/`**, the same names in both. By prefix: `G1` 10,
`G2` 20, `G3` 28, `G4` 13, `G5` 19, `R38` 18, `K2` 42, and one each of `K2-S1`-`K2-S3` and
`S7-L01`-`S7-L03` (`ls -d … | wc -l`, and the prefix counts from the same listing).

### 4.6 Checked and reported, never deleted on a guess

```
drwxr-xr-x@  3 ccarpio  staff      96 Jul 31 14:47 /Users/ccarpio/Library/WebKit/cc.carpio.espansoConfig
drwxr-xr-x@  3 ccarpio  staff      96 Jul 31 14:47 /Users/ccarpio/Library/Caches/cc.carpio.espansoConfig
-rw-r--r--   1 ccarpio  wheel       0 Sep 21 23:38 /private/tmp/espanso.err
-rw-r--r--   1 ccarpio  wheel   16438 Sep 23 19:46 /private/tmp/espanso.out
drwxr-xr-x@  3 ccarpio  staff      96 Jul 31 08:07 /Users/ccarpio/Library/WebKit/espansoconfig
drwxr-xr-x@  3 ccarpio  staff      96 Jul 31 08:07 /Users/ccarpio/Library/Caches/espansoconfig
```

The shipped identifier's two directories are also the owner's own app's. `espanso.err` and
`espanso.out` are of unknown provenance; `espanso.out` was modified at 19:46 today, which no 2d-7 step
did, so it is plausibly a live process's. The lower-case `espansoconfig` pair was first reported by
2d-7-4-1 §8 item 8, origin not established.

### 4.7 Not the instrument, outside item 8's scope

```
drwxr-xr-x@  3 ccarpio  wheel      96 Sep 23 04:08 /private/tmp/9aprobe
```

The per-step scratch in `/private/tmp` is this project's, not the instrument, and 2d-8 may clear it
with the rest. It is listed here so that nothing is missed. Counts are `ls -d <prefix>* | wc -l`:
`2d7-3-*` 19, `2d7-4-1-*` 23, `2d7-4-2-*` 55 (including `2d7-4-2-pristine`, `2d7-4-2-pristine-target`,
`2d7-4-2-probe.rs.before` and `2d7-4-2-launch-7.sh.before`), `2d7-5-*` 9, `2d7-6-1-*` 61 (including
`2d7-6-1-hashcheck.sh`, which 2d-8 still needs until its own last check), `2d7-6-2-*` 66, `2d7-7-*` 46,
`2d7-8-*` 34, `2d7-9-*` 7, `2d71-*` 9, `2d72-*` 7, and this step's `2d7-10-*` (including
`2d7-10-pristine` and `2d7-10-pristine-target`). 2d-7-9's session log is under the Claude scratchpad,
`/private/tmp/claude-501/…/scratchpad/g5-session.md`.

---

## 5. The carried-forward list (entry 33)

**Destination.** Entry 33 records every row here as **permanently unread by a window harness**, and
none of them moves to 2d-8. For an unread row, "goes to" is **no phase named**. A later phase that
wants the row builds the named capability on a new, reviewed instrument. Rulings go to the owner.

### 5.1 The rebindings

| # | Item | State | Goes to |
|---|---|---|---|
| CF-1 … CF-4 | The four pathname rebindings: the fixture's final component between check and read; the temporary's final component between `create_new` and `rename`; a directory above the target; a directory above the fixture | open and accepted (`probe.rs` header) | no phase named; they end when 2d-8 deletes the binary and the tree, which is **not** a proof that they are closed |
| CF-5 | The fifth (`probe_lock_other`): closed for the final component; **a directory above the target** stays in the third's class | residue open | as CF-1 |
| CF-6 | The sixth (`probe_snapshot`): narrowed and **disclosed**; the interval between the completion handler's check and Cocoa's write stays open | disclosed | as CF-1 |

### 5.2 Every unread row, with its missing plan capability

| # | Row (§2) | Missing plan capability | Goes to |
|---|---|---|---|
| CF-7 | G1-4 (H1) self-save, one save in its own span | One unsubstituted `save_match` inside its own checkpointed span | no phase named |
| CF-8 | G1-6a (H2) a readable add | `probe_extra_writer` with `unreadable: false` | no phase named |
| CF-9 | G1-6b (H3) add and remove under `config/` by script | A script-side create and remove under `config/` (a `launch-7.sh` change) | no phase named |
| CF-10 | G1-7 (H4), I14 a late old callback across a reopen | `delay` armed on a drain across a workspace reopen | no phase named |
| CF-11 | G1-5, G1-6a, G2-a (H5), I3, I8, I17 the per-action no-write witness | Action-boundary checkpoints around each external change, and a `probe_witness` right after each writer | no phase named |
| CF-12 | G2-a (H6) the recovery form's retained field values | A plan printing the recovery form's own field values | no phase named |
| CF-13 | G2-b the disabled-state timing beyond raw, and whether the panel existed during the hold | `delay` on each family's send, with a writer during the hold, and a panel sample inside the hold | no phase named |
| CF-14 | G2-c the authored-text send state before the writer; an enabled creator send | A plan printing the editor's and the recovery form's controls before the writer, and a creator with a destination | no phase named |
| CF-15 | G2-d (H7), 5.2-7c-f, 5.2-8c-g the locale switch beyond raw | A `pickLanguage` switch with the conflict standing, then a re-read, on the authored-text and operation families and restore | no phase named |
| CF-16 | G3-a (H10) the authored-text reload | A *Load the version on disk* press, both steps, on the editor, the creator or the recovery form | no phase named |
| CF-17 | G3-a (H11) *Keep editing* / *Leave this as it is* | A press of each on each family, with the panel's and the surface's state read after | no phase named |
| CF-18 | G3-a (H13) the recovery form's own choices | A plan pressing them | no phase named |
| CF-19 | G3-b, G5-4 (H12), 5.1-4, 5.2-8c-e copy under a real gesture, and raw's *Copy my text* | An owner-wait plan over the raw editor's panel. For the authored-text copy, a plain-text or empty host clipboard | no phase named; needs the owner |
| CF-20 | G3-d, G3-e, 5.2-8c-f `alreadyThere`, `refused` | A construction the code path admits. The confirm issued no command in these plans, so a second observation standing between the two steps, not a `delay` on `reload_document` | no phase named |
| CF-21 | G3-g the open-surface refusal | A transcript with `competing≥1`. The instrument's own comment calls the negative half unconstructible from a window | no phase named |
| CF-22 | G4-1 (H16) the retry enabled and pressed | Per §6.1 item 2, re-read as `retryRetainedObservation` enabled (a held observation with no write in flight) and pressed. A mode restore while the app runs no longer bears on it | no phase named |
| CF-23 | G4-2 (H17) `stale` from a `Named` pending row | A plan writing a path the file list names while its row is pending | no phase named |
| CF-24 | G4-3 (H18) six panels' acknowledgements | `mayHaveWritten` armed on those six surfaces' write commands | no phase named |
| CF-25 | G4-4 (H19) a refused acknowledgement press | A plan disabling an acknowledgement and pressing it | no phase named |
| CF-26 | G4-5 (H20) empty-workspace retention | A remover for `match/conflict.yml`, and a plan removing both match files | no phase named |
| CF-27 | G4-6 (H21) `projectionReplaced` reactivity | A plan replacing the projection under a registered origin | no phase named |
| CF-28 | G4-7 (H22) the outlived route acknowledgement | A held-answer plan leaving a route origin standing, then replacing the projection | no phase named |
| CF-29 | G4-8 (H23) `pathDrift.changed` | A writer changing a path the window never named | no phase named |
| CF-30 | G4-9 (H24) the two surface notes | A plan disabling a surface's acknowledgement by `projectionReplaced`/`superseded` or `holdMoved` | no phase named |
| CF-31 | G4-10 (H25) `noTransport` | A substitution removing the transport, or throwing `NO_RECONCILIATION_TRANSPORT` itself, before registration | no phase named |
| CF-32 | G4-13 (H26) 9b-3 §6 item 1 and its §8 recheck | A `delay` on the automatic read with a `mayHaveWritten` save settling inside it, and a failing re-adoption `get_document` | no phase named |
| CF-33 | G4-14, 5.2-10-b (H14) the hidden-state refusal | A plan attempting an action while hidden and printing its answer | no phase named |
| CF-34 | G4-14, G5-5, 5.2-5-7b-a `pagehide`/`unload` fired against flushed | A witness that does not need an IPC round trip at quit, such as `sendBeacon` or a synchronous write | no phase named |
| CF-35 | G5-1, 5.1-2 one task or two; resume after an occlusion stop | A page that prints task boundaries, and a page that does stop, which this instrument's IPC-driven hold does not (§6.2 item 5) | no phase named; needs the owner |
| CF-36 | G5-2, G5-3, I13, 5.1-5 Tab/default activation and pointer hit-testing | An owner-wait plan printing `isTrusted`, `activeElement` and the target; the input tool exercised under Accessibility | no phase named; needs the owner |
| CF-37 | G5-6 the fixed disabled status control in a visible launch | A plan drawing a disabled status control without a substitution (entry 17 forbids them in an owner session) | no phase named |
| CF-38 | H8, 5.1-1 every visual claim of 2d-7-5 … 2d-7-8 not put to the owner | The owner's look at each | no phase named; needs the owner |
| CF-39 | 5.2-6c2-a the save-arm host beside a recovery form | A plan drawing a save-arm conflict with a recovery form beside it | no phase named |
| CF-40 | 5.2-6c2-b mounted scenarios 4–6 in a window | Plans for them | no phase named (the mounted suites carry them) |
| CF-41 | 5.2-7c-a the deleter's *Delete it* disabled under a held reading | `delay` on the deleter's send | no phase named |
| CF-42 | 5.2-7c-b, 5.2-7c-c, 5.2-7c-d `supersededConflict`; `noCorrespondence`; the `writeOutcomeUnknown` withholding on the operation panels | A plan producing each: a keep pressed after the panel's evidence was superseded; a reading with no correspondence; `mayHaveWritten` on an operation's send | no phase named |
| CF-43 | 5.2-7c-e `refusedSave` on the operation panels | A save-race plan for each operation | no phase named |
| CF-44 | 5.2-7c-g the operation panels over hard CRLF, and any operation send and its seam refusals | `--conflict` with matching CRLF writer fixtures for the operation plans, and a send | no phase named |
| CF-45 | 5.2-8c-c, 5.2-8c-d restore's notice beside its refusal; the no-candidate reload-unavailable sentence | A plan holding restore's send, and a plan reaching reload-unavailable | no phase named |
| CF-46 | I6 the 150–300 ms boundary | Not a window claim. It belongs to the engine's own tests (entry 24) | no phase named |
| CF-55 | H9 (read by a model's look only) raw *Undo* pressed under a held save, and *Stop editing* drawn dark where `G2-09` recorded it disabled in the DOM (§6.2 item 4) | A plan holding raw's save (`delay` on its send), pressing *Undo* inside the hold and printing the draft and both controls' `disabled` state in the same launch as the snapshot | no phase named; whether *Undo* should be enabled while `saving` is a ruling owed to a later phase |

### 5.3 Every constructed reading

| # | Reading | Launch | Substitution | Why it is carried |
|---|---|---|---|---|
| CF-47 | `registrationFailed.rejected` drawn | `G4-05`, `G4-12` | `listenRefused` | Constructed; never credited as reached. The disk-reachable cause (a real `listen` refusal) is unread |
| CF-48 | The raw editor's uncertainty acknowledgement, `writeOutcomeUnknown`, and `stale` alone after it (5.2-8c-b) | `G4-03`, `G4-11` | `mayHaveWritten` | As above; only corroboration for G4-12 |
| CF-49 | 9b-3's delivered shape on the route (acknowledge, then reread) | `G4-04` | `mayHaveWritten` | As above; it is not 9b-3 §6 item 1 (CF-32) |

### 5.4 R38's residue, R35, and the rulings owed to the owner

| # | Item | Goes to |
|---|---|---|
| CF-50 | R38's residue: the fifteen shapes read only in the viewer. The panel/refresh half is unread (R38-c, H15: fifteen successor fixtures and a plan that writes one by name), and CRLF against LF per break cannot be seen in the viewer's DOM (2d-7-7 §7 item 2) | no phase named |
| CF-51 | **R35**: no native-speaker review of any Spanish string. §3 is its input | the owner, before Phase 5 |
| CF-52 | **The C1 fold**: the delete panel's choice row below the fold at 1180x728 in EN and ES (the owner's judgement); earlier readings found the same on other panels (consolidated §5.3) | a ruling owed by the owner, for a later phase (entry 26) |
| CF-53 | **The close and keep labels**: the owner judged them "Clear enough"; no change was asked | a ruling owed by the owner, if they ever want one (entry 26) |
| CF-54 | The delete panel's two opening paragraphs saying the same thing (§6.2 item 2) | wording ruling owed to a later phase |

---

## 6. The open items of 2d-7-8 and 2d-7-9, classified

Each item is classed **expected behaviour**, **a gap**, or **a ruling owed to a later phase**. The
classing reads the code named, not a window.

### 6.1 2d-7-8's three

1. **`listenRefused` draws `registrationFailed.rejected`, not `noTransport`** — **expected behaviour.**
   `workspace.svelte.ts:3888-3893` maps a failed registration to `noTransport` only when the error is
   exactly `NO_RECONCILIATION_TRANSPORT` (`reconciliationCoordinator.ts:470`, thrown at `:500` when no
   event source was injected). A refused `listen` is `rejected` by design. The consult's "constructed
   by `listenRefused`" was wrong about the code. `noTransport` stays unread, with the capability in
   CF-31.
2. **`unavailable` draws no retry control** — **expected behaviour.** `decideFileReconciliation`
   (`src/lib/browser/reconciliationStatus.ts`) offers no control for `unavailable`. It offers
   `retryRetainedObservation`, labelled `browser.externalConflict.action.retry`, "while an observation
   is held … disabled only by a write in flight" (its doc comment, and the branch at `:606-610`). The
   consult's G4 row 1 tied the retry to a watcher failure, which the code does not do. The row is
   re-read in CF-22.
3. **The refused-save silence** (`emitted=0` when a foreign write is followed within about 0.1 s by a
   save refused on those bytes) — **expected behaviour**, by the code path `2d-6-9a-notes.md` §3.3
   diagnosed. `conflict_after_the_lock` (`src-tauri/src/commands.rs:2613`) marks the bytes it read under
   the lock and publishes nothing (`:2655`, `:2680`). The watcher's stabilized reading of the same bytes
   is then admitted as a `Duplicate`, and no wake is emitted. Its consequence was ruled on in 2d-6-9b-1:
   a refused save marks the file `stale` itself (`workspace.svelte.ts`, the doc comment at `:4198`).
   **Bound:** 2d-7 printed nothing that says which refusal path answered each of the four launches, so
   this is a reading of the code consistent with the transcripts, not a transcript line.

### 6.2 2d-7-9's nine

1. **The delete panel's choice row below the fold** (the owner) — **a ruling owed to a later phase**
   (entry 26; CF-52).
2. **The delete panel's two opening paragraphs overlap** (a model's look) — **a ruling owed to a later
   phase** (wording; entry 26; CF-54).
3. **The ES row count wraps under the file name** (`G5-19`, a model's look beside the owner's "Name
   intact") — **expected behaviour.** 2d-7-2's fix is to keep the file name whole, and the owner
   confirmed it is. A taller row is what that fix permits. Nothing is owed unless the owner asks.
4. **Raw *Undo* drawn enabled under a held save; *Stop editing* drawn dark where 2d-7-6-1 recorded it
   disabled in the DOM** — two halves:
   - *Undo* enabled: **a gap.** `canUndo` is derived from the draft alone (`rawEditor.ts:1863`), so the
     control is enabled while `saving`. Whether a press changes the draft mid-save is unread (H9's
     unread half), and whether it should be enabled is model work for a later phase.
   - *Stop editing* dark: **not reconciled, and not evidence of a style gap.** `RawEditor.svelte`'s
     component style `button:disabled { color: var(--muted); }` applies to every button in the
     component, the close button included (`disabled={view !== null && view.saving}`). A dark *Stop
     editing* therefore means the control was enabled at the snapshot's instant, or that the model's look
     misread it. The DOM line and the snapshot are different instants of different launches (`G2-09`
     against `G4-02`), and 2d-7 has no line that joins them. Carried unread, with H9 (CF-55).
5. **The foreground premise** (an occluded page holding by IPC round trips did not stop in ≥10 s) —
   **expected behaviour of the instrument, not of the app.** `hold()` → `pause` → invoke keeps the page
   busy with IPC, and `CLAUDE.md` §6's occlusion stop is a `setTimeout` fact. The host fact is neither
   confirmed nor refuted. It goes to 2d-8's §6 rewrite, which keeps host facts (entry 32), unchanged.
6. **Each activation costs one drain per `focus` and one per visible `visibilitychange`** — **expected
   behaviour** (10 N §3's *triggers coalesce* named the two-task cost). It **corrects a record**: the
   split notes' §7 row "Each activation costs one drain" should read "one per event, so two when the
   window was also hidden". Under entry 36 the correction is recorded here and the record is not
   edited in this step (§9 item 2).
7. **The unread rows** — **gaps**, each carried in §5.2 with its capability.
8. **The copy row's host-clipboard refusal** (`launch-7.sh` exit 73) — **expected behaviour** of the
   harness, which refuses to overwrite a clipboard it cannot restore exactly. It is a host precondition
   for any later copy run (CF-19).
9. **Scratch for 2d-8's list** — **expected**; taken into §4 (`G5-*` launches and identifiers, and
   `/private/tmp/2d7-9-*`).

---

## 7. The two corrections

1. **Consolidated §5.4, the pre-edit-copies row** (record §5.4), corrected in place in
   `2d-6-window-readings-consolidated.md`. It named three files and "no record names a deleter". It
   now names the eight probe-related pre-edit copies of entry 32 / §5.14 and gives **2d-8** as the
   owner, citing this file's §4.
2. **`CLAUDE.md` §6's `save_document` location** (record §5.5): `persist/write.rs` →
   `persist/save.rs`, edited in the sentence, with no dated paragraph. Verified by
   `rg -n 'pub fn save_document' crates/`, which gives
   `crates/espansoconfig-core/src/persist/save.rs:1167:pub fn save_document(request: SaveRequest<'_>) -> Result<SavedDocument, SaveError> {`.

---

## 8. Acceptance evidence

### 8.1 The four gates, the working tree (instrument present)

Each command ran alone, with output to a file. Exit statuses come from the tool, never through a pipe.

| Command | Exit | Figure |
|---|---|---|
| `cargo test --workspace -- --test-threads=1 > /private/tmp/2d7-10-cargo.log 2>&1` | 0 | 26 `test result: ok` lines, **1330** passed, 0 failed |
| `npm run check > /private/tmp/2d7-10-check.log 2>&1` | 0 | **462** files, 0 errors, 0 warnings |
| `npm test > /private/tmp/2d7-10-vitest.log 2>&1` | 0 | 72 files, **3547** tests |
| `npm run build > /private/tmp/2d7-10-build.log 2>&1` | 0 | **201** modules |
| `cargo fmt --check` | 0 | no output |
| `cargo clippy --workspace --all-targets -- -D warnings > /private/tmp/2d7-10-clippy.log 2>&1` | 0 | — |
| server-only oracle `rg -c '\$\$payload\|head_payload\|push_element' dist/assets/` | 1 | absent |
| client-only oracle `rg -c 'window\.__svelte\|svelte-trusted-html' dist/assets/` | 0 | `index-CU9iEXcG.js:2` |

`cargo fmt --check` and clippy pass **with** the uncommitted `probe.rs` present, as they have since
2d-7-3 (entry 4).

### 8.2 The pristine copy and the instrument's share (entry 5)

`git archive HEAD` (`c5fed6b`) was extracted to `/private/tmp/2d7-10-pristine`, with `node_modules`
symlinked to the working tree's and `CARGO_TARGET_DIR=/private/tmp/2d7-10-pristine-target`. It holds
neither `src/probe.ts` nor `src-tauri/src/probe.rs`, and its `main.rs`/`main.ts` are the committed ones
(`ls` answered `No such file or directory` for both probe files). The same four measurements, each exit 0:

| Figure | Pristine `HEAD` | Working tree | Instrument's share |
|---|---|---|---|
| Rust tests | **1323** (26 `test result: ok`, 0 failed) | **1330** | **7**, the `probe::tests` (7 `test probe::tests` lines in the tree log) |
| `svelte-check` files | **461** | **462** | **1**, `src/probe.ts` |
| vitest tests | **3546** | **3547** | **1**, `scripts/lint/ipc-detail.test.ts` › "src/probe.ts does not name the developer-string accessor" (JSON reports `/private/tmp/2d7-10-vt-{tree,prist}.json` diffed by name, after the absolute-path prefix is normalized) |
| Vite modules | **200** | **201** | **1**, `src/probe.ts` |

The share is **`7 / 1 / 1 / 1`**, the same as 2d-7-4-2 §5.2's. The rung stays **`1330 / 462 / 3547 /
201`** with the instrument present, normalized **`1323 / 461 / 3546 / 200`**.

### 8.3 The instrument, unchanged

- `/private/tmp/2d7-6-1-hashcheck.sh` at 19:51:28: **`summary ok=18 diff=0`**, binary
  `53d84fb2f2060d03db217cd5381dbaceb884fa1fc236c99b6ce481e0adaa510b`.
- `git diff --stat src-tauri/src/main.rs src/main.ts`: `2 files changed, 5 insertions(+), 1 deletion(-)`.
- `git status --short --untracked-files=all` after the edits: `M CLAUDE.md`, `M PROGRESS.json` (the
  orchestrator's, not touched here), `M docs/decisions/2d-6-window-readings-consolidated.md`, the four
  instrument paths, and this file once written. Nothing was staged, and no `git stash`, `checkout`,
  `restore` or `reset` was run.

### 8.4 The record's acceptance, clause by clause

1. **"The four gates are re-measured, with the instrument's share re-derived from a pristine `git
   archive HEAD` copy."** **Met** (§8.1, §8.2).
2. **"Every manifest entry is shown to exist with `ls`."** **Met** (§4). No entry was absent. The one
   absent path shown, the 2d-5-7b harness, is not a manifest entry.
3. **"Every *constructed* and *unread* row is carried forward."** **Met** (§5). Every row §2 classes
   unread, or read in part, has its unread half in §5.2. The three constructed readings are in §5.3.

---

## 9. Deviations, bounds and open items

1. **§2's classes are the steps' own.** This step re-derived no transcript. Where it changed a class,
   it did so only to carry an unread half that the step had folded into "read": G5-5 and 5.2-5-7b-a
   (fired against flushed), and G3-b (copy read only in 2d-7-6-1's launches). Each is said at its row.
2. **Records noticed and not edited** (entry 36; `CLAUDE.md` §7: noticed, not fixed here):
   - the split notes' §7 row "Each activation costs one drain" (§6.2 item 6);
   - `PROGRESS.md` *Key paths* still names `persist/write.rs` for `save_document`. The checkpoint is
     the orchestrator's to correct;
   - the consult's G4 row 1 and row 10 premises (§6.1 items 1-2). They are corrected here, not in the
     consult, which is a record.
3. **The ES inventory is bounded by what the checkers attributed** (§3). A sentence drawn but not
   attributed, which no checker reported, would be missing. None is known.
4. **Scratch written by this step:** `/private/tmp/2d7-10-*` (gate logs, the pristine copy and its
   target directory, the vitest JSON reports, the inventory script and its outputs). It goes on 2d-8's
   list with the rest (§4.7).
