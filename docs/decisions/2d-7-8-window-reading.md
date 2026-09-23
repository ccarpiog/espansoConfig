# Phase 2d-7-8 — G4: the reconciliation-status states 9c left unread (window reading)

**Date:** 2026-09-23.
**Spec:** [`2d-7-split-notes.md`](2d-7-split-notes.md) §2 *2d-7-8*, bound by §3 entries 17, 23 and 37
(and 16, 18, 21 and 35 as cited). The G4 rows are the consult's
([`phase-2d-7-design.md`](../reviews/phase-2d-7-design.md) `:434-452`). What was done and why, the row
table with each row's class, the unread rows' missing capabilities, the owed items and the gates are in
[`2d-7-8-notes.md`](2d-7-8-notes.md).
**Instrument:** frozen. The four instrument paths and the fourteen harness files equal
[`2d-7-4-2-notes.md`](2d-7-4-2-notes.md) §5.3, 18 of 18, before the first launch (17:19:02) and after the
gates (17:27:29) (notes §1).
**Binary for every launch** (`G4-01` … `G4-13`, each launch's `binary.sha256`):
`53d84fb2f2060d03db217cd5381dbaceb884fa1fc236c99b6ce481e0adaa510b`. It was not rebuilt.
**Harness:** `/private/tmp/espansoconfig-harness-2d-6-6c-2/launch-7.sh`, unchanged.

The claims rest on:
- thirteen launches, each on its own bundle path and bundle identifier, and their transcripts
  (`launches/G4-*/probe.log`, and the launch summaries `/private/tmp/2d7-8-G4-*.out`);
- the probe's reconciliation of Rust's tallies against the page's recorded commands (entry 15);
- the frozen `tools/verbatim-9c.cjs`, run over every launch (outputs `/private/tmp/2d7-8-verbatim9c-G4-*.txt`);
- one window capture looked at by the worker (§6).

**The screen read unlocked at every recorded check.** Every preflight and every `lock-at-end` read
`lock=unlocked` (`rule=primary-unlocked-and-cross-check-not-locked`, `CGSSessionScreenIsLocked=absent`);
all 183 recorded beats read `visibility=visible` (47 of them `focus=no`: 25 in `G4-04`, 8 in `G4-05`, 14 in
`G4-06`; no claim here is about focus); all 35 captures are `used=window` (`screencapture -l`). **No
launch ran with `:keepalive`**: the window was visible, and entry 18 forbids the keep-alive in a visible
launch (notes §2, deviation 1). Every launch reached its terminal line without it. Entry 18's
conditions were observed at the sampled instants only. "Drawn" below means **present in the DOM** of the
named region; the one visual look is §6's. Controls were pressed with `click()` (entry 20); nothing is
claimed about real input.

---

## 1. The launches

All: `launch-7.sh launch <plan> <name>`, the hard set (`hard-r0.yml` as `match/conflict.yml`), no
`--config`, no `--conflict`. Every launch: exit 0, `reached-terminal=yes alive-at-kill=yes`, one
`--- end`, `failed-lines=0`, `mismatch-lines=0`, `reconcile-lines=2 void-lines=0` (both
`commands=equal(except-plugin:event) … probe-half=ok`), `--- instrument ok probe-commands=14 page=14`,
`probe.err-bytes=0`, `home-files=0`, `script-writers=0`, clipboard untouched (`copies=no`), language set
through the picker (`--- language picked=<en|es> lang=<en|es> label=ok`), `lsappinfo-bundle-id` equal to
its own `cc.carpio.espansoConfig.probe.G4-NN`; `verbatim-9c` `problems=0 not-found=0` on every one (the
`residues=["match/conflict.yml"]` it lists on five is the file name printed beside a drawn disk text, not
a sentence). **No launch was voided or re-run.**

| Launch | Plan | Substitution (entry 17 class of what it draws) | `end` emitted / delivered | G4 row it serves |
|---|---|---|---|---|
| `G4-01` | `status-unavailable:en` | none (reached) | 1 / 1 | the retry after `probe_lock_other` — lock half only |
| `G4-02` | `status-held:en` | `delay` 7 s on `save_raw_document` (held) | 1 / 1 | `stale` behind a panel alone; the surface notes (absent) |
| `G4-03` | `status-uncertain-raw:en` | `mayHaveWritten` on `save_raw_document` (constructed) | 1 / 1 | `stale` behind a panel alone (corroboration) |
| `G4-04` | `status-uncertain-route:en` | `mayHaveWritten` on `save_raw_document` (constructed) | 1 / 1 | context for 9b-3 §6 item 1 |
| `G4-05` | `status-registration:en` | `listenRefused` (constructed) | 1 / 0 | `noTransport` |
| `G4-06` | `status-membership:en` | none (reached) | 2 / 2 | `pathDrift.changed` (not drawn) |
| `G4-07` | `status-stale:en` | none (reached) | **0 / 0** | the `emitted=0` observation |
| `G4-08` | `raw-save-race:en` | none (reached) | **0 / 0** | the `emitted=0` observation |
| `G4-09` | `restore-save-race:en` | none (reached) | **0 / 0** | the `emitted=0` observation |
| `G4-10` | `status-held:es` | as `G4-02` | 1 / 1 | ES twin of `G4-02` |
| `G4-11` | `status-uncertain-raw:es` | as `G4-03` | 1 / 1 | ES twin of `G4-03` |
| `G4-12` | `status-registration:es` | as `G4-05` | 1 / 0 | ES twin of `G4-05` |
| `G4-13` | `status-stale:es` | none (reached) | **0 / 0** | ES twin of `G4-07` |

Started 17:19:20 (`G4-01`) … 17:24:16 (`G4-13`), one launch after another.

---

## 2. The watcher failure and the retry (`G4-01`)

`probe_lock_other` answered `locked`; the drain 0.3 s later carried `Unreadable seq=1
doc=Addressable:match/other.yml reason=PermissionDenied`. The pane drew
`browser.externalDocument.unavailable` with its reason, the row drew `row.unavailable`, the route was
absent. **The pane drew no control at all** (`region un-pane present controls=[]`), so no retry was
offered in the locked state. The plan ends there: no frozen plan restores `match/other.yml`'s mode while
the app runs (the harness puts the bits back only after the process ends, `launch-7.sh:736`), and no plan
presses a retry. The only retry control in the dictionary for this surface,
`browser.externalConflict.action.retry` (*Check the observed change now*), was drawn in `G4-02` — disabled,
with `browser.reconciliation.refusal.writeInFlight`, under a held save (§3). Its enabled state and its
press were not reached by any launch.

---

## 3. `stale` behind a panel alone (`G4-02`, `G4-10`; `G4-03`, `G4-11`)

- **`G4-02` / `G4-10` (held).** A raw save held 7 s by `delay`; the second writer (hard R1) during the
  hold. During the hold the pane drew `observationRetained`, the retry `[off]` and `writeInFlight`, and
  the row drew *Not reconciled*. After the release (7.07 s) the raw editor's external panel was present
  (`hd released raw-external=present`, choices *Keep editing · Copy my text · Load the version on disk*,
  its disk text hard R1), the route absent, and **the pane drew `browser.externalDocument.stale` and
  nothing else** (`text hd-released-pane What this window shows of this file has not been reconciled with
  the file on disk.`). ES identical in shape (`Lo que esta ventana muestra de este archivo no se ha
  conciliado con el archivo del disco.`). The mark is backed by the panel's snapshot alone: no route
  origin, no banner.
- **`G4-03` / `G4-11` (constructed).** An uncertain raw save (`mayHaveWritten`), the editor left open,
  the writer: the panel drew its acknowledgement (*I have reviewed this snapshot*), the pane drew `stale`
  plus `writeOutcomeUnknown`. After the acknowledgement press (no command, `unchanged=yes`) the panel's
  choices became three and **the pane drew `stale` alone** with the panel present. Constructed, so it is
  corroboration only and is not credited as reached.
- **Not the 2d-7-1 `writtenHere` shape.** In both plans the reading is hard R1, not the bytes the save
  committed, so neither exercises 2d-7-1's clearing of a mark on a `writtenHere` release.

---

## 4. `noTransport` by `listenRefused` (`G4-05`, `G4-12`)

`plugin:event|listen` was answered `error "refused by the probe"` and never issued. The route drew
**`browser.reconciliation.registrationFailed.rejected`** (*This window could not subscribe to change
notifications, …*; ES *Esta ventana no pudo suscribirse a los avisos de cambios, …*), before and 2.5 s
after the second writer; Rust emitted 1, the page received 0, and no drain followed the write (drains
stayed 1; no pane status). **`noTransport` was not drawn.** The app maps a failed registration to
`noTransport` only when the error is exactly its own `NO_RECONCILIATION_TRANSPORT`
(`src/lib/browser/workspace.svelte.ts:3888-3893`); a refused `listen` is `rejected`. The construction the
consult names therefore draws the other arm.

---

## 5. Path drift, the 9b-3 shape, and the save races' silence

- **`G4-06`.** The unreadable `match/extra.yml` drew `pathDrift.unreadable`; its removal drew
  `pathDrift.removed`, `membershipReloadWanted` and *Reload the file list*; the press reopened the
  workspace and the banner went. **`pathDrift.changed` was not drawn**: no frozen writer changes the
  content of a path the window never named.
- **`G4-04`.** 9b-3's delivered shape re-read after 2d-7-1: uncertain raw save, editor discarded, writer
  R1 with no surface open, **0 automatic rereads**, the route's snapshot and enabled acknowledgement, the
  pane `stale` with the reread `[off]` + `uncertaintyUnresolved`; locale switch `unchanged=yes`;
  acknowledgement → no command → reread enabled; reread → `reload_document` + `document_text`, `stale`
  gone. The same as 9c's `P9-01`. It is not 9b-3 §6 item 1 (a hold established *while* an automatic read
  is out) and not its §8 recheck.
- **The save races emitted no wake — read again.** `G4-08` (`raw-save-race`, save pressed 117 ms after
  the writer was asked) and `G4-09` (`restore-save-race`, 89 ms) both ended `emitted=0 delivered=0` at
  `end` (t = 7979 ms and 8186 ms); `after-reading external=absent savePanel=present drains=1` at about
  3.4 s and 3.6 s. **`G4-07` and `G4-13` (`status-stale`, save 97 ms after the writer) show the same over
  a 20 s launch**: `emitted=0 delivered=0`, drains 1, the pane's `stale` from the refused save only. In
  every launch here where the foreign write came *after* the app's save had committed (`G4-02`, `-03`,
  `-04`, `-10`, `-11`) Rust emitted 1. So the silence is not the race plan's short wait: a foreign write
  followed within about 0.1 s by a save of this window refused on those bytes produced no emitted
  observation at all in these launches. The conflict path's comment in `src-tauri/src/commands.rs`
  (the locked read "marks and does not publish", taking the ledger's coalescing decision) is consistent
  with it; **the cause was not established** and nothing here classes it a defect.

---

## 6. The one look

`G4-02/shots/hd-released-window.png`: the app's own window, not the lock screen. The sidebar with
`match/conflict.yml` selected and its *Not reconciled* mark, and the raw editor's external panel with its
four sentences, the observed revision and *The version on disk* in the monospaced box (hard R1, synthetic).
The pane's `stale` sentence is outside that capture's viewport. Every other visual claim is **unread**
and stays 2d-7-9's.

---

## 7. What this reading does not show

- **Any G4 row the notes class unread** (notes §3): the retry enabled and pressed; `stale` from a `Named`
  pending row; the six other panels' acknowledgements; a refused acknowledgement press; empty-workspace
  retention; `projectionReplaced` reactivity; the outlived route acknowledgement and its exits note;
  `pathDrift.changed`; the two surface notes; `noTransport`; 9b-3 §6 item 1 and its §8 recheck.
- **A per-action no-write witness** (S5): the status plans are retained plans with `start`/`end`
  checkpoints only. The `--- span start→end` lines (`writes=0` on `G4-01`, `-05`, `-06`, `-12`;
  `writes=1 write-commands=[save_raw_document]` on the others) and the tree diffs are whole-launch
  observations, not entry-16 witnesses.
- **Visual judgements** beyond §6; **real input**; **focus** (47 beats read `focus=no`).
